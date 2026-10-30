/* ============================================================================
 * afk-caps.js — 副手武器的能力也算進去＋爆擊率／迴避率上限 80%（玩家 2026-10-27）
 *
 * ① 副手武器：轉生後任何武器都能雙持，但核心的副手只當「第二攻擊來源」，
 *    只算祝福／遠古／屬性詞綴，武器本身的固定加成（近距離傷害、命中、爆擊率…）完全沒算 → 玩家看到「有裝備沒效果」。
 *    轉生角色的副手武器，比照主手把這些固定加成也算進去：
 *      近／遠距離傷害與命中（依武器是近戰或遠程）、隨等級成長的傷害／命中、魔法傷害、額外傷害、額外魔法點數、
 *      HP／MP 上限、HP／MP 自然恢復、傷害減免、魔防、近距離爆擊率、近距離爆擊傷害、遠距離爆擊率
 *    不算：強化值的固定加成（副手揮擊自己用自己的強化值）、攻擊速度、遺物的觸發特效。
 *    沒轉生的戰士（迅猛雙斧）維持原版規則。
 * ② 上限：近距離／遠距離／魔法爆擊率最高 80%（重算能力值的最後一步夾住）；
 *    迴避率最高 80%（核心補丁 patchEvadeCap：玩家、傭兵、寵物的迴避判定與面板顯示）。
 * 排在所有包 recomputeStats 的外掛之後（最外層），其他外掛加完的爆擊率也會被夾住。
 * ========================================================================== */
(function () {
  'use strict';
  var W = window, T = W.AFK_TOGGLES;
  var CAP = 80;
  if (T && T.register) T.register({ id: 'statcap', name: '能力上限', desc: '爆擊率、迴避率、命中率最高 80%（敵人永遠有 20% 閃開）；爆擊傷害最多 +500%；HP／MP 消耗最多減半；百分比減傷合計最多 75%（之後才扣最終減傷）；爆擊率堆滿 80% 時，物理爆擊把 50% 傷害濺射給其他敵人（從主目標扣掉）', group: '遊戲玩法' });
  var capOn = !T || T.enabled('statcap');
  W.__afkCritCap = capOn ? CAP : null; W.__afkEvadeCap = capOn ? CAP : null;
  // 2026-10-29 玩家：命中率也最多 80%（判定值 15：2～15＋19 擦傷＋20 重擊＝16/20；核心補丁 66），頭目永遠有 20% 閃開；
  //   爆擊傷害最多 +500%；HP／MP 消耗減免最多 50%；爆擊率堆到 80% 以上時，物理爆擊把該擊傷害的 50% 濺射給其他敵人（從主目標扣掉）
  var CRIT_DMG_CAP = 500, COST_FLOOR = 0.5, SPLASH = 0.5;
  W.__afkHitHv = capOn ? 15 : null;
  if (T && T.register) T.register({ id: 'offhandstats', name: '副手武器能力計入', desc: '轉生後雙持的副手武器，固定加成（傷害、命中、爆擊率…）比照主手算進能力', group: '遊戲玩法' });
  var on = function () { return !T || T.enabled('offhandstats'); };
  var num = function (v) { return Number(v) || 0; };
  function addOffhand(p) {
    var o = p.eq && p.eq.offwpn, d = p.d; if (!o || !d) return;
    var w = DB.items[o.id]; if (!w || w.type !== 'wpn') return;
    var r = !!w.ranged;
    if (r) { d.rangedDmg += num(w.dmgBonus); d.rangedHit += num(w.hit); } else { d.meleeDmg += num(w.dmgBonus); d.meleeHit += num(w.hit); }
    if (w.lvDmgDiv) { var lb = Math.floor((p.lv || 1) / w.lvDmgDiv); if (r) d.rangedDmg += lb; else d.meleeDmg += lb; }
    if (w.lvHitDiv) { var lh = Math.floor((p.lv || 1) / w.lvHitDiv); if (r) d.rangedHit += lh; else d.meleeHit += lh; }
    d.magicDmg += num(w.mdmg); d.extraDmg += num(w.extraDmg); d.extraMp += num(w.extraMp);
    d.mpR += num(w.mpR); d.hpR += num(w.hpR); d.dr += num(w.dr); d.mr += num(w.mr);
    d.meleeCrit += num(w.mcrit); d.meleeCritDmg += num(w.mcritDmg); d.rangedCrit += num(w.rcrit);
    // 最大 HP／MP 改在核心「夾 HP 之前」的掛點加（下方 __afkMaxAdd），否則每次重算 HP 會先被夾到沒有副手加成的上限（2026-10-29 22:19）
  }
  function offhandMax(p) {
    var o = p && p.eq && p.eq.offwpn; if (!o) return;
    var w = DB.items[o.id]; if (!w || w.type !== 'wpn') return;
    if (w.mhp) p.mhp = (Number(p.mhp) || 0) + num(w.mhp);
    if (w.mmp) p.mmp = (Number(p.mmp) || 0) + num(w.mmp);
  }
  function clamp(p) {
    var d = p && p.d; if (!d || !capOn) return;
    p._rawCrit = { melee: num(d.meleeCrit), ranged: num(d.rangedCrit), magic: num(d.magicCrit) };
    ['meleeCrit', 'rangedCrit', 'magicCrit'].forEach(function (k) { if (num(d[k]) > CAP) d[k] = CAP; });
    ['meleeCritDmg', 'rangedCritDmg', 'magicCritDmg'].forEach(function (k) { if (num(d[k]) > CRIT_DMG_CAP) d[k] = CRIT_DMG_CAP; });
    if (typeof d.getMpCost === 'function' && !d.getMpCost._afkCap) {   // MP 消耗最少是原本的一半
      var g = d.getMpCost; d.getMpCost = function (mp) { var c = g.apply(this, arguments); return (mp > 0) ? Math.max(Number(c) || 0, Math.ceil(mp * COST_FLOOR)) : c; }; d.getMpCost._afkCap = true;
    }
  }
  // HP 消耗最少是原本的一半
  if (capOn && typeof W.effHpCost === 'function') {
    var oHp = W.effHpCost;
    W.effHpCost = function (sk) { var c = oHp.apply(this, arguments); var base = (sk && sk.hpCost) || 0; return base > 0 ? Math.max(Number(c) || 0, Math.ceil(base * COST_FLOOR)) : c; };
  }
  // 爆擊溢出：爆擊率（加總前）已到 80% 以上 → 物理爆擊把該擊傷害的 50% 濺射給場上其他敵人（每隻各 50%）。
  //   2026-10-29 晚（玩家）：濺射的部分要從主目標扣掉——有濺到其他敵人時，主目標只吃剩下的 50%；場上沒有別的敵人就不扣。
  //   W.__afkSplashRule(actor, 爆擊率) 可以改規則（符文用）：回傳 { pct: 濺射比例, keep: true＝主目標不扣 }，回傳 null＝不濺射。
  var splashing = false;
  var baseRule = function (actor, rc) { return rc >= CAP ? { pct: SPLASH, keep: false } : null; };
  var splash = function (actor, target, v, opt) {
    var cr = actor && actor._afkCrit; if (!cr || cr.t !== target) return 0;
    actor._afkCrit = null;
    var raw = actor._rawCrit || {}, kind = opt && opt.kind, rc = Number(kind === 'ranged' ? raw.ranged : raw.melee) || 0;
    if (!(v > 0) || typeof mapState === 'undefined') return 0;
    var rule = null; try { rule = typeof W.__afkSplashRule === 'function' ? W.__afkSplashRule(actor, rc, baseRule) : baseRule(actor, rc); } catch (e) { rule = baseRule(actor, rc); }
    if (!rule || !(rule.pct > 0)) return 0;
    var amt = Math.floor(v * rule.pct); if (!(amt > 0)) return 0;
    var hits = 0;
    splashing = true;
    try {
      (mapState.mobs || []).forEach(function (m, i) {
        if (!m || m === target || m._dead || !(m.curHp > 0)) return;
        hits++;
        m.curHp -= amt;
        if (m.curHp <= 0) { try { killMob(i); } catch (e) {} }
      });
    } finally { splashing = false; }
    return hits && !rule.keep ? Math.floor(amt * (rule.deduct != null ? rule.deduct : 1)) : 0;   // deduct：主目標扣多少（濺 ★3＝一半）
  };
  var C = W.AFK_CARD_COMBAT;
  if (capOn && C && typeof C.damage === 'function') {
    var oDmg = C.damage;
    C.damage = function (actor, target, amount, opt) {
      var v = oDmg.apply(this, arguments);
      try { if (!splashing && actor && actor._afkCrit && opt && (opt.kind === 'melee' || opt.kind === 'ranged' || opt.kind === 'phys')) { var cut = splash(actor, target, v, opt); if (cut > 0) v = Math.max(0, v - cut); } } catch (e) {}
      return v;
    };
  }
  W.AFK_SPLASH = { CAP: CAP, PCT: SPLASH, baseRule: baseRule };
  if (typeof W.recomputeStats === 'function') {
    var o = W.recomputeStats;
    W.recomputeStats = function () {
      var r = o.apply(this, arguments);
      try {
        var p = (typeof player !== 'undefined') ? player : null;
        if (p && p.d) {
          if (on() && p.rebirth > 0 && p.eq && p.eq.offwpn) addOffhand(p);
          clamp(p);
        }
      } catch (e) { console.warn('[AFK-caps]', e); }
      return r;
    };
  }
  if (W.__afkMaxAdd && W.__afkMaxAdd.add) W.__afkMaxAdd.add(function (p) {
    try { if (p && p === ((typeof player !== 'undefined') ? player : null) && on() && p.rebirth > 0) offhandMax(p); } catch (e) {}
  });
  W.AFK_CAPS = { cap: CAP, addOffhand: addOffhand, offhandMax: offhandMax, clamp: clamp };
})();
