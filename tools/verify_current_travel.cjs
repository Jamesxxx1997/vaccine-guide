// Data-invariant verification for automated sync; no hard-coded live dates/counts.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const core=require('../travel-data-core.js');
const ctx={};
vm.runInNewContext(fs.readFileSync('review/travel-current.js','utf8')+';this.c=TRAVEL_CURRENT;',ctx);
const c=ctx.c,rebuilt=core.build(c.tables);
assert.equal(JSON.stringify(rebuilt.countries),JSON.stringify(c.countries));
const rawRows={};
for(const [key,t] of Object.entries(c.tables)){
  const bytes=fs.readFileSync(t.p);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),t.sha256);
  const raw=core.parseCSV(bytes.toString('utf8'));
  assert.equal(JSON.stringify(raw.headers),JSON.stringify(t.headers));assert.equal(JSON.stringify(raw.rows),JSON.stringify(t.rows));
  rawRows[key]=core.objects(t);
}
let records=0;
for(const country of Object.values(c.countries)){
  for(const a of [...country.a,...country.unresolved||[]]){
    assert(a[5]?.records.length);
    for(const record of a[5].records){
      const r=rawRows.alerts[record-1];assert(r);
      assert(r.areaDesc.trim()===country.n||r.areaDesc_EN.trim()===country.en);
      assert.equal(r.alert_disease.trim(),a[1]);assert.equal(core.rank(r.severity_level.trim()),a[0]);
      assert.equal(core.dateOf(r.effective),a[2]);assert.equal(r.areaDetail.trim(),a[3]);records++;
    }
  }
  assert(country.a.every(a=>a[1]!=='嚴重特殊傳染性肺炎'));
  for(const v of country.v)assert(rawRows.prescriptions.some(p=>p['疫苗'].trim()===v&&(p['國名(中)'].trim()===country.n||p['國名(英)'].trim()===country.en)));
}
console.log('PASS current official data: immutable bytes, deterministic rebuild, '+records+' source row identities; no obsolete COVID L3 advertised as current.');
