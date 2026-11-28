(function(root){
  'use strict';
  const site=new URL('./',root.document?.baseURI||root.registration?.scope||root.location.href);
  function base(value) {
    if (!value) return '';
    const url=new URL(value,site);
    if (!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash) throw Error('部署網址格式錯誤');
    return url.href.replace(/\/+$/,'');
  }
  const mediaBase=base(root.LINEAGE_MEDIA_BASE), remote=mediaBase?new URL(mediaBase+'/'):site;
  const localServer=!!root.LINEAGE_LOCAL_SERVER;
  const data=root.LineageMediaPaths, locals=new Set(data.local), sets=new Map();
  const native=/^(?:assets|public|art-fix|art-v3|brace-art|guardring-art)\//;
  // 11-28：這些怪物的方向走路圖去掉了黑底（同路徑換新圖）。R2 圖片快取一年，加上版本參數讓玩過的人也拿到新圖。
  const refreshed=new Set(["卡魯塔", "土精靈王", "地之牙", "地靈之主", "夢幻之島地精靈王", "夢幻之島大鬼火", "夢幻之島水精靈王", "夢幻之島火炎蛋", "夢幻之島火精靈王", "夢幻之島閃電球", "夢幻之島風精靈王", "夢幻之島鬼火", "恐怖的火炎蛋", "水之牙", "水精靈王", "污染的地精靈", "深淵地靈", "深淵水靈", "深淵火靈", "深淵風靈", "火之牙", "火炎蛋", "火焰之靈魂(紅)", "火焰之靈魂(藍)", "火精靈王", "紅鬼魂", "象牙塔閃電球", "風之牙", "風精靈王", "風靈之主", "鬼魂"]);
  function stamp(key){const m=/^assets\/anim\/([^/]+)\/d[0-7]\/walk_\d+\.png$/.exec(key);return m&&refreshed.has(m[1])?'?v=w1128b':'';}
  function has(key) {
    const pos=key.lastIndexOf('/'), dir=key.slice(0,pos);
    if (!Object.hasOwn(data.dirs,dir)) return false;
    const id=data.dirs[dir];
    let files=sets.get(id);
    if (!files) {files=new Set(data.sets[id].split('\n'));sets.set(id,files);}
    return files.has(key.slice(pos+1));
  }
  function keyFor(key) {
    if (locals.has(key)) return null;
    let found=key;
    if (!has(key)) {
      if (!native.test(key)||!/\.(?:png|webp)$/i.test(key)) return null;
      const stem=key.replace(/\.[^.]+$/,'');
      found=[stem+'.png',stem+'.webp',...(/^assets\/area\/1920x1080\//.test(key)?[stem+'.jpg']:[])].find(has);
      if (!found) return null;
    }
    return data.actual[found]||found;
  }
  function underneath(url,dir) {
    if (url.origin!==dir.origin||!url.pathname.startsWith(dir.pathname)) return null;
    try {return decodeURIComponent(url.pathname.slice(dir.pathname.length));} catch {return null;}
  }
  function route(value,relativeTo=site) {
    if (value instanceof URL)value=value.href;
    if (typeof value!=='string'||!value||/^(?:data:|blob:|#)/i.test(value)) return null;
    let u;
    try {u=new URL(value,relativeTo);} catch {return null;}
    const input=underneath(u,site) ?? (u.origin===site.origin?underneath(u,new URL('/',site)):null);
    if (!input) return null;
    const key=keyFor(input);
    if (!key) return null;
    const target=new URL(key.split('/').map(encodeURIComponent).join('/'),remote);
    target.search=u.search||stamp(key);target.hash=u.hash;
    return {url:target.href,key,crossOrigin:target.origin!==site.origin};
  }
  function resolve(value,relativeTo) {
    const r=route(value,relativeTo);return r?r.url:value;
  }
  function remoteKey(value) {
    let url;try{url=new URL(value,site);}catch{return null;}
    const key=underneath(url,remote);
    if (!key) return null;
    return has(key)||Object.values(data.actual).includes(key)?key:null;
  }
  root.LineageMedia=Object.freeze({route,resolve,keyFor,remoteKey,site:site.href,mediaBase,active:!!mediaBase||!localServer});
  const traveler=base(root.LINEAGE_TRAVELER_BASE)||(localServer?site.origin+'/api/traveler':'https://lineage-heartbeat.manuialeaso.workers.dev');
  const serviceBase=localServer?site.origin+'/api':traveler;
  root.LineageSite=Object.freeze({localServer,traveler,sync:serviceBase+'/sync',
    rooms:base(root.LINEAGE_ROOMS_BASE)||serviceBase+'/rooms',roomsEnabled:root.LINEAGE_ROOMS_ENABLED===true});
})(self);
