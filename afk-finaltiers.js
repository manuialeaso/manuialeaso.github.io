/* ============================================================================
 * afk-finaltiers.js — 終焉三階層（玩家 2026-10-29 晚）
 *
 *   第一階層「席琳夢境」：原本的最終決戰（每個角色一次）。打贏才開放第二階層。
 *   第二階層「席琳幻影」：HP、傷害 ×1.25（使徒同比例），可以重複挑戰直到打贏；打贏後才開放第三階層，不能再回頭打第二階層。
 *   第三階層「席琳伴身」：HP、傷害 ×1.5625（再 ×1.25），只能挑戰一次（進場就算用掉）。
 *     入場資格（玩家 2026-10-30 19:09）：統一伺服器（七座城都是你的）＋隊伍裡每個角色（你與每名傭兵的來源存檔）的特殊收藏全滿。
 *   時間封印（10 分鐘）、凝視、死亡之潮照舊。
 *   第一次打贏的獎勵（暫定，可再調）：第二階層＝失去光芒的符文石（階段三）1；第三階層＝解命石 1。
 * 紀錄：player.afkFinalTier = { t2: 'win'|'lose'|null, t3: 'win'|'lose'|null, pending: 'tier2'|'tier3'|null }
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  if (T && T.register) T.register({ id: 'finaltiers', name: '終焉三階層', group: '遊戲玩法',
    desc: '打贏最終決戰（席琳夢境）後開放第二階層「席琳幻影」（HP、傷害 ×1.25，可重複挑戰到贏）與第三階層「席琳伴身」（×1.5625，只能挑戰一次）' });
  if (T && !T.enabled('finaltiers')) return;
  var FB = W.__afkFinalBoss;
  if (!FB || typeof FB.startMode !== 'function') { console.warn('[AFK-finaltiers] 找不到最終決戰，略過'); return; }
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var S = function () { return typeof state !== 'undefined' ? state : {}; };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var rec = function (p) { p = p || P(); if (!p) return {}; if (!p.afkFinalTier || typeof p.afkFinalTier !== 'object') p.afkFinalTier = { t2: null, t3: null, pending: null }; return p.afkFinalTier; };
  var REWARD = { tier2: ['afk_runebox_3', 1], tier3: ['afk_fate_unlock', 1] };
  // 玩家 2026-10-29：先做好、先不開放（獎勵留到做旅人時一起討論）。開放時把 API.OPEN 改成 true。
  var API = { OPEN: false };
  var can = function (t) {
    var p = P(); if (!p) return '請先進入遊戲。';
    if (!API.OPEN) return '尚未開放';
    if (!FB.dreamOn()) return '需在席琳夢域鏡中';
    if (!FB.won(p)) return '要先打贏第一階層「席琳夢境」';
    var r = rec(p);
    if (t === 2) { if (r.t2 === 'win') return '已經打贏了'; if (W.__afkHunter && !W.__afkHunter.isS(p)) return '要先成為 S 級冒險者（冒險者公會）'; return ''; }   // 魔物獵人模式（玩家 2026-10-30）：第二階層要 S 級
    if (r.t2 !== 'win') return '要先打贏第二階層「席琳幻影」';
    if (r.t3) return r.t3 === 'win' ? '已經打贏了' : '已經挑戰過了（只有一次）';
    return tier3Gate(p);
  };
  // 第三階層入場資格（玩家 2026-10-30 19:09）：統一伺服器（七座城都是你的）＋隊伍裡每個角色的特殊收藏全滿
  var tier3Gate = function (p) {
    var CG = W.__afkCastleGuards;
    var held = 0; try { held = CG && CG.held ? CG.held().length : 0; } catch (e) {}
    if (!(CG && CG.unified && CG.unified())) return '要先統一伺服器（七座城都是你的，目前 ' + held + ' 座）';
    var SC = W.__afkSpecialCollection; if (!SC || !SC.full) return '';
    if (!SC.full(p)) return '你的特殊收藏還沒滿';
    var miss = (p.allies || []).filter(Boolean).filter(function (a) {
      var src = null; try { src = typeof _roleReadSavePlayer === 'function' ? _roleReadSavePlayer(a._slot) : null; } catch (e) {}
      return !src || !SC.full(src);
    });
    if (miss.length) return '協力·' + miss.map(function (a) { return a._allyName || ('存檔 ' + a._slot); }).join('、') + ' 的特殊收藏還沒滿';
    return '';
  };
  W.afkFinalTierEnter = function (t) {
    var why = can(t); if (why) { sys('<span class="text-amber-300">' + why + '。</span>'); return; }
    if (S().antharas || S().riftRun || S().prideClimb || S()._afkFinal) { sys('<span class="text-amber-300">你正身在其他副本之中。</span>'); return; }
    var md = t === 2 ? 'tier2' : 'tier3', nm = FB.TIER[md].n;
    var go = function () {
      var r = rec(); r.pending = md;
      if (md === 'tier3') r.t3 = 'lose';   // 進場就算用掉
      FB.startMode(md, '<span class="font-bold" style="color:#c084fc;">你再次沉入死亡之海——這一次，迎接你的是「' + nm + '」。</span><span class="text-amber-200">HP 與傷害 ×' + FB.TIER[md].k + '；時間封印照舊。</span>');
    };
    var msg = '⚠ 終焉第' + (t === 2 ? '二' : '三') + '階層：' + nm + '\n\n席琳的 HP 與傷害 ×' + FB.TIER[md].k + '（使徒同比例），時間封印、凝視、死亡之潮照舊。\n'
      + (t === 3 ? '只能挑戰一次——進場就算用掉，倒下、回村或中途重新整理都算失敗。\n' : '可以重複挑戰，直到打贏為止；打贏後不能再回頭打這一層。\n')
      + '第一次打贏：' + DB.items[REWARD[md][0]].n + ' ×' + REWARD[md][1] + '。\n\n確定要進入嗎？';
    if (W.AFK_UI && AFK_UI.confirm) AFK_UI.confirm({ title: '終焉階層', message: msg, okText: '沉入死亡之海', cancelText: '再準備一下', danger: t === 3, onOk: go });
    else if (confirm(msg)) go();
  };
  var finish = function (md, result, why) {
    var p = P(), r = rec(p), nm = FB.TIER[md].n;
    r.pending = null;
    if (md === 'tier2') { if (result === 'win') r.t2 = 'win'; else if (r.t2 !== 'win') r.t2 = 'lose'; }
    if (md === 'tier3') r.t3 = result === 'win' ? 'win' : 'lose';
    if (result === 'win') {
      var rw = REWARD[md]; if (rw && DB.items[rw[0]]) gainItem(rw[0], rw[1], true, true);
      sys('<span class="font-bold" style="color:#fde047;">🏆 終焉階層「' + nm + '」通關！</span>' + (rw ? '<span class="text-amber-200">得到 ' + DB.items[rw[0]].n + ' ×' + rw[1] + '。</span>' : '') + (md === 'tier2' ? '<span class="text-fuchsia-200">第三階層「席琳伴身」已經開放（只能挑戰一次）。</span>' : ''));
    } else {
      sys('<span class="font-bold text-slate-200">「' + nm + '」把你推回了水面（' + (why || '挑戰失敗') + '）。</span>' + (md === 'tier2' ? '<span class="text-slate-300">可以再挑戰。</span>' : '<span class="text-slate-300">第三階層的機會用掉了。</span>'));
    }
  };
  // 中途重新整理：掛著的挑戰算失敗
  var oTick = W.tick;
  if (typeof oTick === 'function') W.tick = function () { var r = oTick.apply(this, arguments); try { var p = P(), t = p && p.afkFinalTier; if (t && t.pending && !S()._afkFinal) finish(t.pending, 'lose', '中途離開'); } catch (e) {} return r; };
  if (typeof W.renderSherinePray === 'function') {
    var oPray = W.renderSherinePray;
    W.renderSherinePray = function (div) {
      var r = oPray.apply(this, arguments);
      try {
        var p = P(); if (!p || !FB.won(p) || !API.OPEN) return r;
        var box = div.querySelector('.flex.flex-col.gap-3') || div, rr = rec(p);
        var row = function (t) {
          var md = t === 2 ? 'tier2' : 'tier3', why = can(t), ok = !why, res = t === 2 ? rr.t2 : rr.t3;
          return '<button type="button" class="btn py-3 text-base font-bold ' + (ok ? 'bg-fuchsia-950 hover:bg-fuchsia-900 border-fuchsia-500' : 'bg-slate-700 border-slate-600 opacity-60 cursor-not-allowed') + '" ' + (ok ? '' : 'disabled') + ' onclick="afkFinalTierEnter(' + t + ')">'
            + (ok ? '🌑 終焉第' + (t === 2 ? '二' : '三') + '階層：' + FB.TIER[md].n + '（×' + FB.TIER[md].k + '）' : '終焉第' + (t === 2 ? '二' : '三') + '階層：' + why) + (res === 'win' ? '（已通關）' : '') + '</button>';
        };
        box.insertAdjacentHTML('beforeend', '<div class="bg-slate-950/80 border border-fuchsia-700 rounded p-3 text-sm leading-relaxed"><div class="font-bold mb-1 text-fuchsia-300">🌑 終焉階層</div>'
          + '<div class="text-slate-200 text-xs">第一階層「席琳夢境」就是最終決戰。打贏後開放第二階層「席琳幻影」（×1.25，可重複挑戰到贏），再開放第三階層「席琳伴身」（×1.5625，只能挑戰一次）。打贏一層後不能回頭打前一層。第三階層的入場資格：統一伺服器（七座城都是你的），而且隊伍裡每個角色的特殊收藏都要全滿。</div></div>'
          + row(2) + row(3));
      } catch (e) {}
      return r;
    };
  }
  W.__afkFinalTiers = Object.assign(API, { can: can, finish: finish, rec: rec, REWARD: REWARD, tier3Gate: tier3Gate });
  console.log('[AFK-finaltiers] 已啟用：終焉三階層');
})();
