import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {CDC,SEARCH_PATH,RESULT_PATH,queryText,officialURL,isAsset,parseResults,rewriteHTML,relayResult,search,upstream,searchFields,localRequestURL} from '../backend/cdc-core.mjs';
const fixture='<div id="SearchData" class="card-body"><div class="CaveatDiv"><div class="a-block">第一級:注意(Watch)</div><table><tbody class="box1"><tr><td>霍亂</td><td><a href="/InternationalTravel/Index/test?keyword=MZ">莫三比克</a></td><td></td><td>2023/03/20</td></tr></tbody></table></div></div>';
test('relay payload carries every source row, is inert and bound to the same query',()=>{
  const tr=fixture.match(/<tr>.*<\/tr>/s)[0];
  const large=fixture.replace(tr,Array.from({length:329},(_,i)=>tr.replace('莫三比克','目的地'+i)).join(''));
  const query='</template><img src=x onerror=alert(1)>';
  const dom=new JSDOM(relayResult(large,query));const d=dom.window.document;
  const payload=JSON.parse(d.querySelector('template[data-vaccine-result]').content.textContent);
  assert.equal(payload.count,329);assert.equal(payload.rows[328].country,'目的地328');assert.equal(payload.query,query);assert(!d.querySelector('img'));assert.equal(payload.rows[0].level,'第一級:注意(Watch)');
  assert.throws(()=>relayResult('<div>Error</div>','MZ'));dom.window.close();
});
test('strict query, fixed upstream and asset allowlist',async()=>{
  assert.equal(queryText(' 莫三比克 '),'莫三比克');
  for(const q of ['',null,123,'x'.repeat(101),'hello\nworld'])assert.throws(()=>queryText(q));
  for(const u of ['http://www.cdc.gov.tw/','https://evil.test','https://user@www.cdc.gov.tw/'])assert.throws(()=>officialURL(u));
  assert(isAsset('/Scripts/jquery-3.7.1.js'));assert(!isAsset('/Content/../secret.js'));assert(!isAsset('/File/Get/random'));
  let calls=0;await assert.rejects(upstream('/admin',{fetcher:async()=>{calls++;}}));assert.equal(calls,0);
});
test('parse real table shape, retain date/region/source, fail closed',()=>{
  const rows=parseResults(fixture);assert.equal(rows[0].country,'莫三比克');assert.equal(rows[0].date,'2023/03/20');assert.equal(rows[0].url,CDC+'/InternationalTravel/Index/test?keyword=MZ');
  for(const text of ['{"Code":403}','<html>error</html>',fixture.replace('第一級','unknown'),fixture.replace('2023/03/20','unknown'),fixture.replace('class="box1"','class="newLayout"'),fixture.replace('/InternationalTravel/Index/test?keyword=MZ','https://evil.test'),fixture.replace('CaveatDiv','renamed'),fixture.replace('</tbody>','</tbody><tbody class="newLayout"><tr><td>new unparsed row</td></tr></tbody>'),fixture.replace('</table>','</table><table><tr><td>unrecognized second table</td></tr></table>'),fixture.replace('</div></div>','</div><div class="newGroup">other alert</div></div>'),'<div id="SearchData" class="card-body">Service unavailable</div>','<div id="SearchData" class="card-body"><div class="error">Error</div></div>'])assert.throws(()=>parseResults(text));
  assert.deepEqual(parseResults('<div id="SearchData" class="card-body"></div>'),[]);
  const empty='<div id="SearchData" class="card-body"></div>';
  for(const value of ['Service unavailable'+empty,empty+'Service unavailable','Service unavailable'+fixture,fixture+'Service unavailable'])assert.throws(()=>parseResults(value));
});
test('relay keeps search UI, external links leave relay; query is escaped',()=>{
  const html=rewriteHTML('<html><head><script src="https://www.googletagmanager.com/x"></script></head><body><form id="form0" data-ajax-url="'+RESULT_PATH+'"><input name="SearchData"></form><a href="/Category/Page/x">go</a></body></html>',{full:true,query:'"><script>alert(1)</script>'});
  const d=new JSDOM(html).window.document;
  assert.equal(d.querySelector('input').value,'"><script>alert(1)</script>');assert.equal(d.querySelectorAll('script').length,1);assert.equal(d.querySelector('script').src,'/proxy-client.js');
  assert.equal(d.querySelector('a').href,CDC+'/Category/Page/x');assert.equal(d.querySelector('a').target,'_blank');assert(d.querySelector('#vaccine-proxy-notice'));
});
test('normal anonymous GET+POST session; no forwarded user credentials',async()=>{
  const requests=[];
  const result=await search('莫三比克',{fetcher:async(url,options)=>{
    requests.push({url:String(url),options});
    return requests.length===1?new Response('<input name="__RequestVerificationToken" value="form-token">',{headers:{'Set-Cookie':'anon=cookie; HttpOnly; Secure'}}):new Response(fixture);
  }});
  assert.equal(requests[0].url,CDC+SEARCH_PATH);assert.equal(requests[1].url,CDC+RESULT_PATH);
  assert.equal(requests[1].options.headers.Cookie,'anon=cookie');assert.equal(requests[1].options.body.get('__RequestVerificationToken'),'form-token');
  assert.equal(requests[1].options.redirect,'error');assert.equal(result.rows.length,1);assert(!JSON.stringify(result).includes('form-token'));
});
test('upstream error is never an empty success',async()=>{await assert.rejects(search('莫三比克',{fetcher:async()=>new Response('bad',{status:500})}));});
test('official unobtrusive AJAX marker accepted; extra fields and duplicates denied',()=>{
  const raw='SearchData=MZ&__RequestVerificationToken=test&X-Requested-With=XMLHttpRequest';
  assert.equal(searchFields(raw).get('SearchData'),'MZ');assert(!searchFields(raw).has('X-Requested-With'));
  for(const value of [raw+'&age=30',raw+'&SearchData=JP',raw.replace('XMLHttpRequest','unknown'),'SearchData=MZ'])assert.throws(()=>searchFields(value));
});
test('request origin cannot be changed through an authority-form path',()=>{
  assert.equal(localRequestURL('/api/health','localhost:8901',8901).origin,'http://localhost:8901');
  assert.equal(localRequestURL('/api/health','127.0.0.1:8901',8901).origin,'http://127.0.0.1:8901');
  for(const p of ['//other.test'+RESULT_PATH,'/\\other.test'+RESULT_PATH,'https://other.test'+RESULT_PATH])assert.throws(()=>localRequestURL(p,'localhost:8901',8901));
  assert.throws(()=>localRequestURL('/api/health','other.test',8901));
});
