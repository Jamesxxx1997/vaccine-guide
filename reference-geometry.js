/* Geometry-only helpers. A matching fragment is never a verified clinical claim. */
const ReferenceGeometry = (() => {
  const norm=t=>t.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/g,'');
  const inside=(r,b)=>!b||((r[0]+r[2])/2>=b[0]&&(r[0]+r[2])/2<=b[2]&&(r[1]+r[3])/2>=b[1]&&(r[1]+r[3])/2<=b[3]);
  function merge(rects) {
    const result=[];
    for(const r of [...rects].sort((a,b)=>a[1]-b[1]||a[0]-b[0])) {
      const last=result[result.length-1];
      if(last&&Math.abs(last[1]-r[1])<2&&Math.abs(last[3]-r[3])<2&&r[0]-last[2]<4&&r[0]>=last[0])last[2]=Math.max(last[2],r[2]);
      else result.push(r.slice(0,4));
    }
    return result;
  }
  function matches(page, query, bounds, allowShort=false) {
    const q=norm(query), rects=[];
    if(!q)return rects;
    for(const [lineId,line] of page.lines.entries()) {
      if(!inside(line,bounds))continue;
      const t=norm(line[4]);if(!t)continue;
      // Collect maximal continuous fragments, not isolated numbers or shared jargon.
      const ranges=[];
      for(let start=0;start<t.length;start++) {
        let length=0;
        while(start+length<t.length && q.includes(t.slice(start,start+length+1)))length++;
        const piece=t.slice(start,start+length);
        const minimum=allowShort?2:/[\u3400-\u9fff]/.test(piece)?6:18;
        if(length>=minimum && !/^\d+$/.test(piece)) {ranges.push([start,start+length]);start+=length-1;}
      }
      if(!ranges.length)continue;
      // True character coordinates where available (no uniform-width approximation).
      const chars=(page.chars||[]).filter(c=>c[0]>=line[0]-1&&c[2]<=line[2]+1&&
        (c[1]+c[3])/2>=line[1]-2&&(c[1]+c[3])/2<=line[3]+2).sort((a,b)=>a[0]-b[0]);
      const stream=chars.map(c=>norm(c[4])).join('');
      if(stream===t) {
        let offset=0;
        for(const c of chars){const end=offset+norm(c[4]).length;
          if(ranges.some(([s,e])=>offset<e&&end>s))rects.push(c.slice(0,4));offset=end;}
      } else {
        // Without glyph geometry, only mark complete words entirely inside a match.
        let offset=0;
        for(const w of (page.words||[]).filter(w=>w[5]===lineId)) {
          const end=offset+norm(w[4]).length;
          if(end>offset&&ranges.some(([s,e])=>offset>=s&&end<=e))rects.push(w.slice(0,4));offset=end;
        }
      }
    }
    return merge(rects);
  }
  function context(page, rects=[], options={}) {
    const focus=options.focus||rects;
    const lo=focus.length?Math.min(...focus.map(r=>r[1])):0;
    const hi=focus.length?Math.max(...focus.map(r=>r[3])):page.h;
    const height=Math.min(page.h,Math.max(page.w>page.h?200:250,hi-lo+160));
    const top=Math.max(0,Math.min(page.h-height,(lo+hi-height)/2));
    return {page,rects,top,height,...options};
  }
  // Conversion includes the crop origin. Scaling only the old rectangles would
  // put highlights in the wrong table/column on the full source page.
  function legacy(doc, entry) {
    const page=doc?.pages?.find(p=>p.page===entry.page);
    if(!page||!entry.origin||!entry.dpi)return null;
    const s=72/entry.dpi;
    const rects=(entry.status==='gist'?[]:entry.rects||[]).map(r=>[
      entry.origin[0]+r[0]*s,entry.origin[1]+r[1]*s,
      entry.origin[0]+(r[0]+r[2])*s,entry.origin[1]+(r[1]+r[3])*s]);
    return context(page,rects,{focus:[[entry.origin[0],entry.origin[1],entry.origin[0]+entry.iw*s,entry.origin[1]+entry.ih*s]],grade:entry.status});
  }
  return {norm,inside,merge,matches,context,legacy};
})();
