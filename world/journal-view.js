'use strict';
(() => {
  const journal=window.GiranJournal,game=document.getElementById('logtab-btn-sys');
  const recovery=document.getElementById('giran-transfer');
  if(!game&&!recovery)return;
  const dialog=document.createElement('dialog');dialog.id='giran-history';dialog.setAttribute('aria-labelledby','gh-title');
  dialog.innerHTML='<form method="dialog"><h2 id="gh-title">歷史紀錄</h2><button aria-label="關閉歷史紀錄">關閉</button></form><div class="gh-filters"><label>種類<select><option value="">全部</option><option>戰鬥</option><option>系統</option></select></label><label>搜尋<input type="search" placeholder="角色、地圖或內容"></label></div><p aria-live="polite"></p><ol></ol><button type="button" data-older>顯示較早紀錄</button>';
  document.body.append(dialog);
  const list=dialog.querySelector('ol'),type=dialog.querySelector('select'),search=dialog.querySelector('input'),more=dialog.querySelector('[data-older]'),summary=dialog.querySelector('p');
  const when=new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium',hour12:false});
  let rows=[],limit=40;
  function render(){
    const term=search.value.trim().toLocaleLowerCase();
    const matches=rows.filter(r=>(!type.value||r.kind===type.value)&&(!term||[r.role,r.map,r.text].some(s=>String(s).toLocaleLowerCase().includes(term))));
    list.replaceChildren();
    for(const r of matches.slice(0,limit)){
      const line=document.createElement('li'),meta=document.createElement('small'),body=document.createElement('span');
      meta.textContent=[r.at===null?'原檔未記時間':new Date(r.at).toString()==='Invalid Date'?'':when.format(r.at),r.role,r.kind,r.map].filter(Boolean).join(' · ');
      body.textContent=r.text;line.append(meta,body);list.append(line);
    }
    summary.textContent=matches.length?'顯示 '+Math.min(matches.length,limit)+' / '+matches.length+' 筆':'沒有符合的紀錄';
    if(journal.writeError)summary.textContent+='。瀏覽器暫時無法儲存，最新紀錄可隨完整備份匯出。'+journal.writeError;
    more.hidden=matches.length<=limit;
  }
  type.onchange=search.oninput=()=>{limit=40;render();};
  more.onclick=()=>{limit+=80;render();};
  const open=document.createElement('button');open.type='button';open.textContent='歷史紀錄';open.className=game?'logtab-btn':'';
  open.onclick=()=>{
    if(!dialog.open)dialog.showModal();
    try{rows=journal.current().slice().sort((a,b)=>b.at-a.at);limit=40;render();}catch(e){list.replaceChildren();summary.textContent=e.message;more.hidden=true;}
  };
  // 11-28 Ping：遊戲畫面的「歷史紀錄」分頁拿掉（紀錄照常保存，修復頁面仍可匯出／匯入）
  if(game)return;
  const actions=recovery.querySelector('.actions');actions.append(open);
  const details=document.createElement('details');details.innerHTML='<summary>只匯入戰鬥與系統紀錄</summary><p>選擇匯出的紀錄檔。角色、道具及任務進度分開保存。合併後，戰鬥保留最近 400 筆，系統保留最近 600 筆。</p><label class="file-zone">選擇紀錄檔<input type="file" accept=".json,application/json"></label><div class="actions"><button type="button" disabled>合併紀錄</button></div><output aria-live="polite"></output>';recovery.append(details);
  const input=details.querySelector('input'),apply=details.querySelector('button'),status=details.querySelector('output');
  let selection=null,revision=0;
  const info=r=>'來源 '+r.total+' 筆，重疊 '+r.overlap+' 筆，新增 '+r.added+' 筆，超過保留上限 '+r.expired+' 筆。';
  input.onchange=async()=>{
    const file=input.files[0],version=++revision;selection=null;apply.disabled=true;status.textContent='';
    if(!file)return;
    try{
      const incoming=journal.parseFile(await file.text());if(version!==revision)return;
      const preview=journal.compare(incoming);selection=incoming;status.textContent=info(preview);apply.disabled=!preview.added;
    }catch(e){if(version===revision)status.textContent=e.message;}
  };
  apply.onclick=async()=>{
    if(!selection)return;const incoming=selection,version=revision;apply.disabled=true;
    try{const result=await journal.merge(incoming);if(version===revision)status.textContent='已完成。'+info(result);}
    catch(e){if(version===revision){status.textContent=e.message;apply.disabled=false;}}
  };
})();
