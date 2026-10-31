/* ============================================================================
 * afk-craftinfo.js — 製作清單直接看得到成品能力（玩家 2026-10-29：手機版製作道具不知道做出來有什麼用）
 *
 *   核心的製作清單（renderUniversalCraft，含琉米埃爾、炎魔之影等附加區）只有滑鼠移到圖示上才看得到成品資料，
 *   手機沒有滑鼠（長按圖示才會出來，很多人不知道）。這支在每一列名稱下面加一行「▸ 成品能力」，
 *   點開就是跟電腦版 tooltip 一樣的內容（核心 buildItemDescHTML）。
 *   手機版（上游手機幾何）另外把「數量＋製作」那一塊換到下一行，不再蓋住材料清單。
 *   不改核心：包 renderUniversalCraft，畫完後找 .tip-host[data-tip-craft] 補上。
 *   另外（2026-10-31，開關 craftall）：每一列「製作」旁多一個「全部」，材料夠做幾個就一次做完（先確認）。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'craftinfo', name: '製作清單顯示成品能力', group: '查詢與資訊',
    desc: '製作 NPC 的每一列下面多一行「成品能力」，點開就看得到做出來的東西有什麼能力（手機不用長按圖示）；手機版的製作按鈕換到下一行，不蓋住材料' });
  // ── 一口氣全部做（玩家 2026-10-31 23:48：龜裂之核、歐西里斯／庫庫爾坎寶箱這種材料動輒幾十萬個，一次只能做 1 個）──
  //   每一列「製作」旁多一個「全部」：材料（含自動補製的中間物品、倉庫）夠做幾個就一次做完；超過 1 個先確認。
  //   做法跟在數量格輸入很大的數字一樣（核心 doCraft 本來就會夾到可製作的最大量），只是幫你算好、少按幾下。
  if (T && T.register) T.register({ id: 'craftall', name: '製作：全部做', group: '遊戲介面', seal: true,
    desc: '製作清單每一列多一個「全部」按鈕，材料夠做幾個就一次做完（先確認）' });
  (function () {
    if ((T && !T.enabled('craftall')) || typeof W.craftActionHtml !== 'function' || typeof W.doCraft !== 'function') return;
    var oAct = W.craftActionHtml;
    W.craftActionHtml = function (npcId, idx) {
      var h = oAct.apply(this, arguments);
      try {
        var btn = '<button type="button" class="btn bg-amber-800 hover:bg-amber-700 border-amber-500 py-2 px-3 font-bold shadow" title="材料夠做幾個就一次做完" onclick="event.stopPropagation();__afkCraftAll(\'' + String(npcId).replace(/[^\w-]/g, '') + '\',' + (Number(idx) || 0) + ')">全部</button>';
        var i = h.lastIndexOf('</div>'); if (i < 0) return h;
        return h.slice(0, i) + btn + h.slice(i);
      } catch (e) { return h; }
    };
    try { (0, eval)('craftActionHtml = window.craftActionHtml'); } catch (e) {}
    W.__afkCraftAll = function (npcId, idx) {
      var r = (typeof CRAFT_RECIPES !== 'undefined' && CRAFT_RECIPES[npcId]) ? CRAFT_RECIPES[npcId][idx] : null; if (!r) return;
      var n = 0;
      try { if (typeof RECIPE_BY_RESULT !== 'undefined' && !RECIPE_BY_RESULT && typeof buildRecipeIndex === 'function') buildRecipeIndex(); n = maxMakeRecipe(r); } catch (e) { n = 0; }
      var inp = document.getElementById('craft-qty-' + npcId + '-' + idx);
      var go = function () { if (inp) inp.value = Math.max(1, n); W.doCraft(npcId, idx); };
      if (n < 2) { go(); return; }   // 做不了（核心會列出缺什麼）或只能做 1 個：直接做
      var d = DB.items[r.result] || {}, out = n * (r.yield || 1);
      var msg = '材料夠做 ' + n.toLocaleString() + ' 次，一共得到「' + (d.n || r.result) + '」×' + out.toLocaleString() + '。\n需要的中間材料會自動先做好，背包不夠的材料從倉庫扣。\n\n確定全部製作嗎？';
      if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '全部製作', message: msg, okText: '全部製作', cancelText: '取消', onOk: go });
      else if (W.confirm(msg)) go();
    };
  })();

  if (T && !T.enabled('craftinfo')) return;
  if (typeof W.renderUniversalCraft !== 'function' || typeof W.buildItemDescHTML !== 'function') return;

  var MQ = '(max-width: 768px), (max-height: 520px) and (pointer: coarse)';
  var css = function () {
    if (document.getElementById('afk-craftinfo-css')) return;
    var st = document.createElement('style'); st.id = 'afk-craftinfo-css';
    st.textContent = '.afk-craft-use{margin-top:2px;font-size:13px;color:#cbd5e1;max-width:100%}'
      + '.afk-craft-use>summary{cursor:pointer;color:#7dd3fc;font-weight:700;list-style:none;display:inline-flex;align-items:center;gap:4px;min-height:28px}'
      + '.afk-craft-use>summary::-webkit-details-marker{display:none}'
      + '.afk-craft-use>summary::before{content:"▸";transition:transform .15s}'
      + '.afk-craft-use[open]>summary::before{transform:rotate(90deg)}'
      + '.afk-craft-use .afk-craft-body{margin-top:4px;padding:6px 8px;border:1px solid #334155;border-radius:6px;background:rgba(15,23,42,.7);line-height:1.55}'
      + '@media ' + MQ + '{'
      + '#interaction-content .afk-craft-row{flex-wrap:wrap !important;row-gap:8px}'
      + '#interaction-content .afk-craft-row>div:first-child{flex:1 1 100% !important}'
      + '#interaction-content .afk-craft-row>div:last-child{flex:1 1 100%;justify-content:flex-end}'
      + '.afk-craft-use{font-size:14px}'
      + '}';
    (document.head || document.documentElement).appendChild(st);
  };
  var decorate = function (div) {
    if (!div) return 0;
    css();
    var n = 0;
    div.querySelectorAll('.tip-host[data-tip-craft]').forEach(function (host) {
      var id = host.getAttribute('data-tip-id'), d = id && DB.items[id]; if (!d) return;
      var row = host.closest('.list-item'); if (row) row.classList.add('afk-craft-row');
      var col = host.nextElementSibling; if (!col || col.querySelector('.afk-craft-use')) return;
      var it = { id: id, uid: 'craft-info', cnt: 1, en: 0, bless: false, anc: false, attr: false, seteff: false };
      var body = '';
      try { body = W.buildItemDescHTML(it); } catch (e) { body = ''; }
      if (!body) return;
      var det = document.createElement('details'); det.className = 'afk-craft-use';
      det.innerHTML = '<summary>成品能力</summary><div class="afk-craft-body">' + body + '</div>';
      det.addEventListener('click', function (ev) { ev.stopPropagation(); });   // 不要觸發整列的點擊
      col.appendChild(det); n++;
    });
    return n;
  };
  var o = W.renderUniversalCraft;
  W.renderUniversalCraft = function (div) {
    var r = o.apply(this, arguments);
    try { decorate(div); } catch (e) { console.warn('[AFK-craftinfo]', e); }
    return r;
  };
  W.__afkCraftInfo = { decorate: decorate };
})();
