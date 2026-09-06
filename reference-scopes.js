/* Reviewed table coordinates in PDF points. Changed source hashes fail closed. */
const ReferenceScopes=(()=>{
  const hashes={S2:'601cdae83086af6d409a99a40772a19fc2b8fc93d1f8a666771455bd460f1160',
    S3:'87968428ff606fcf8bbf4993d258b8d7bef8a35457de99f0ac9bf7b51ce25563',
    S8:'8bdef52aeff9943e8791bd8e1586d73bf64e4baa569e58c9ff219d7fcc00a6f1'};
  // S2 p1: unique vaccine rows in original order, not fuzzy family-name searches.
  const inact=['hepb','dtap','dtapipv','tdap','tdapipv','dt','td','ipv','jeinact','hepa','hib','flu','rabies','mpsv4','mcv4','pcv','ppv23','hpv','hepahepb','dtap5','hexa'];
  const live=['bcg','var','mmr','yf','rota','opv','jelive','laiv'];
  const edges=[103,120,148,176,204,232,246,260,274,287,301,316,330,344,358,372,386,400,412,428,442,458];
  const liveEdges=[470,485,499,526,541,554,569,597,611];
  function classification(id,doc){
    if(doc.sha256!==hashes.S2)return null;
    const isLive=live.includes(id),ids=isLive?live:inact,i=ids.indexOf(id);
    if(i<0)return null;
    const page=doc.pages[0],e=isLive?liveEdges:edges;
    const row=[153,e[i],467,e[i+1]],category=isLive?[75,609,152,624]:[75,280,152,295];
    const query=page.words.filter(w=>ReferenceGeometry.inside(w,row)||ReferenceGeometry.inside(w,category)).map(w=>w[4]).join(' ');
    const rects=[...ReferenceGeometry.matches(page,query,row,true),...ReferenceGeometry.matches(page,query,category,true)];
    return ReferenceGeometry.context(page,rects,{focus:[row,category],locatedRow:true,anchorKind:'classification',anchorId:id});
  }
  const minRows=[[108,127],[127,175],[175,239],[239,284],[284,307],[307,341],[341,378],[378,442],[442,478],[478,512]];
  const catchupRows={bcg:[138,169],hepb:[170,278],polio:[278,454],dtap:[454,626],mmr:[626,675],var:[675,716],je:[716,916],dtapipv:[916,985]};
  const catchupY={bcg:[155],hepb:[225,245,265],polio:[290,337,357,377,423,443,443],dtap:[465,509,529,549,594,614,614],mmr:[640,660],var:[696],je:[727,747,767,787,815,843,863,883,903],dtapipv:[952]};
  const symbols=[[52,1003,141,1019],[143,1003,231,1019],[234,1003,321,1019],[322,1003,440,1019],[440,1003,592,1019]];
  function pinned(doc,key,pageNumber,bounds,query,options={}){
    if(doc.sha256!==hashes[key])return null;
    const page=doc.pages[pageNumber-1];
    return ReferenceGeometry.context(page,ReferenceGeometry.matches(page,query,bounds,true),{focus:[bounds],locatedRow:true,...options});
  }
  return {hashes,inact,live,minRows,catchupRows,catchupY,symbols,classification,pinned};
})();
