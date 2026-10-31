/* ============================================================================
 * afk-affix-plus.js — 詞綴擴充（玩家 2026-10-26 指定）
 *
 * 原有：屬性（四屬性五階＋屬性魔法星數）、遠古系（遠古／永恆／不朽／太初）、祝福／詛咒
 * 新增（2026-10-28 起全部在燃柳村「龍紋師 艾格尼絲」處理；遺物也能賦予；奧拉奇里亞只留轉生技藝）：
 *   ‧祝福再分三階：祝福的（×1）→ 昇華的祝福（×2）→ 至高的祝福（×3）（item.blessLv＝2／3，item.bless 仍是 true）
 *       掉落：出現祝福時 5% 直接是昇華、1% 直接是至高
 *       （2026-10-28 起：祝福只能打怪取得，NPC 不能升級；製作、兌換、任務、黑市、傳家之寶不再產生祝福）
 *   ‧遠古系三階（2026-10-28）：原名（×1）→ 覺醒的〇〇（×2）→ 創世的〇〇（×3）（item.ancLv＝2／3）；同樣只能打怪取得，
 *       打到帶遠古系詞綴的裝備時 5% 直接第二階、1% 直接第三階（金卡怪掉落、重複遺物、席琳夢域鏡的遺物都算）
 *   ‧不屈者意志（武器）：八職業八種（2026-10-26 補滿）。消耗任一職業的「不屈的命運」1 顆、可選任一種；
 *       限一轉以上、或能進入席琳夢域鏡（Lv80）的角色；被封印輪迴光環封住的角色不行。再次賦予會換掉舊的（數值見 WILL）
 *   ‧龍的印記（武器，左右手只能有一把生效）：隨機四龍之一，對該龍（安塔瑞斯／法利昂／巴拉卡斯／林德拜爾）傷害 +50%
 *   ‧龍的傷痕（盾牌或盔甲）：隨機四龍之一，受到該龍（含各階型態）的傷害 −50%。玩家、傭兵都有效
 *       材料（2026-10-26 改）：同一條龍的「心、爪、眼、牙、肉、骨、血、鱗」一套＝1 個龍印碎片（四大龍副本掉落）；
 *       20 個龍印碎片＝1 顆龍的印記石；印記與傷痕各用 1 顆印記石，可以一直洗到想要的那條龍
 *       升星（2026-10-26）：20 顆印記石升 1 星，最高 3 星，每星效果再 +5%（印記 +55／60／65%、傷痕 −55／60／65%）；洗龍不影響星數
 *       隱藏（不寫進小百科）：同一件洗超過 100 次，第 101 次起永久附加——武器：副本頭目傷害 +50%；防具：四龍傷害再 −50%
 *   ‧神樹者的讚禮（全身任何裝備）：五種抗性隨機兩種各 +10。5 張怪物鑽石卡、成功率 100%；再次賦予會重洗
 *   ‧闇龍的抵抗者（防具，不含飾品）：無屬性抗性 +10。100 個「闇龍的抵抗者意志傳承碎片」
 *       碎片只在席琳夢域鏡掉：一般怪 0.1%、頭目必掉 1 個
 *   抗性一樣受 afk-resist 的總上限（四屬性 800、無屬性 300）限制。
 * ========================================================================== */
(function () {
  'use strict';
  if (typeof DB === 'undefined' || typeof window.recomputeStats !== 'function' || typeof window.getItemFullName !== 'function') { console.warn('[AFK-affix-plus] 缺少核心函式，略過'); return; }
  var W = window, T = W.AFK_TOGGLES;
  // 玩家 2026-10-28：改成外掛開關（預設開）。關掉＝祝福／遠古沒有階段、不限打怪、沒有龍紋師與新詞綴效果（物品定義保留，存檔裡的東西不會消失）
  if (T && T.register) T.register({ id: 'affixplus', name: '祝福／遠古三階與龍紋師', desc: '祝福與遠古系各分三階（打到時 5% 第二階、1% 第三階）、祝福／遠古只能打怪產生；燃柳村龍紋師艾格尼絲賦予不屈者意志、龍的印記／傷痕、神樹者的讚禮、闇龍的抵抗者與祝福賦予卷軸', group: '遊戲玩法' });
  var ON = !T || T.enabled('affixplus');
  var P = function () { return (typeof player !== 'undefined' && player && player.cls) ? player : null; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var sys = function (h) { try { logSys(h); } catch (e) {} };
  var cnt = function (it) { return it && it.cnt == null ? 1 : Math.max(0, Math.floor(Number(it && it.cnt) || 0)); };

  // ── 定義 ──
  var BLESS = { 2: { n: '昇華的祝福', c: '#fbbf24' }, 3: { n: '至高的祝福', c: '#fde047' } };
  // 遠古系三階段（玩家 2026-10-28）：第一階＝原名（遠古／永恆／不朽／太初）×1、第二階「覺醒的」×2、第三階「創世的」×3（item.ancLv＝2／3）
  var ANC_T = { 1: { p: '' }, 2: { p: '覺醒的', st: 'font-weight:700;' }, 3: { p: '創世的', st: 'font-weight:800;text-shadow:0 0 6px currentColor,0 0 10px currentColor;' } };
  var ANC_ST = {
    wpn: { ancient: [['額外傷害', 2], ['魔法傷害', 1]], eternal: [['額外傷害', 4]], immortal: [['額外命中', 4]], primordial: [['魔法傷害', 2]] },
    arm: { ancient: [['傷害減免', 2]], eternal: [['防禦(AC)', -2]], immortal: [['迴避(ER)', 2]], primordial: [['魔防(MR)', 4]] },
    acc: { ancient: [['傷害減免', 1], ['魔防(MR)', 1]], eternal: [['額外傷害', 1], ['防禦(AC)', -1]], immortal: [['額外傷害', 1], ['額外命中', 1]], primordial: [['魔防(MR)', 2], ['額外魔法點數', 2]] }
  };
  var ancTxt = function (slot, v, L) { return ((ANC_ST[slot] || {})[v] || []).map(function (x) { var n = x[1] * L; return x[0] + (n < 0 ? '' : '+') + n; }).join('，'); };
  var ancCls = function (a) { try { return typeof ancColorClass === 'function' ? ancColorClass(a) : 'c-ancient'; } catch (e) { return 'c-ancient'; } };
  var WILL = {
    royal: { n: '不屈者意志(王族)', s: '不屈・王族', d: 'AC −3、魔防 +5、額外命中 +2、HP 自然恢復 +5', lore: '「王冠可以被奪走，王者的背影不會。」——被反王肯恩奪去王座、仍舉起旗幟的亞丁王子', st: { ac: -3, mr: 5, extraHit: 2, hpR: 5 } },
    knight: { n: '不屈者意志(騎士)', s: '不屈・騎士', d: '近距離傷害 +3、AC −2、傷害減免 +2', lore: '「斷了的劍還能握，斷了的誓言就什麼都不剩。」——肯特城最後一名守城騎士', st: { meleeDmg: 3, ac: -2, dr: 2 } },
    elf: { n: '不屈者意志(妖精)', s: '不屈・妖精', d: '遠距離傷害 +3、遠距離命中 +3、MP 自然恢復 +3', lore: '「只要世界樹還有一片葉子，妖精的弓弦就不會鬆。」——妖精森林的守望者', st: { rangedDmg: 3, rangedHit: 3, mpR: 3 } },
    mage: { n: '不屈者意志(法師)', s: '不屈・法師', d: '魔法傷害 +3、額外魔法點數 +3、MP 自然恢復 +5', lore: '「咒文會被打斷，意志不會。」——象牙塔最後一位沒有逃走的魔法師', st: { magicDmg: 3, extraMp: 3, mpR: 5 } },
    dark: { n: '不屈者意志(黑暗妖精)', s: '不屈・黑妖', d: '近距離爆擊 +2%、額外傷害 +2、迴避 +2', lore: '「被放逐到黑暗裡的人，最懂得怎麼在黑暗裡活下去。」——沉默洞穴的暗殺者', st: { meleeCrit: 2, extraDmg: 2, er: 2 } },
    dragon: { n: '不屈者意志(龍騎士)', s: '不屈・龍騎', d: '額外傷害 +2、傷害減免 +2、火／水／風／地屬性抗性各 +5', lore: '「我們的血裡流著龍。龍不會跪。」——貝希摩斯的龍騎士', st: { extraDmg: 2, dr: 2, resFire: 5, resWater: 5, resWind: 5, resEarth: 5 } },
    illusion: { n: '不屈者意志(幻術士)', s: '不屈・幻術', d: '魔法傷害 +2、魔法命中 +3、額外魔法點數 +2', lore: '「幻象會碎，看穿幻象的眼睛不會。」——希培利亞的幻術師', st: { magicDmg: 2, magicHit: 3, extraMp: 2 } },
    warrior: { n: '不屈者意志(戰士)', s: '不屈・戰士', d: '額外傷害 +3、額外命中 +3、傷害減免 +3', lore: '「倒下的次數，只要比站起來的次數少一次就夠了。」——在說話之島的沙灘上醒來無數次的戰士', st: { extraDmg: 3, extraHit: 3, dr: 3 } }
  };
  var DRAGON = {
    earth: { n: '地龍', dn: '安塔瑞斯', re: /安塔瑞斯/, c: '#fcd34d', key: 'antharas' },
    water: { n: '水龍', dn: '法利昂', re: /法利昂/, c: '#7dd3fc', key: 'fafurion' },
    fire: { n: '火龍', dn: '巴拉卡斯', re: /巴拉卡斯/, c: '#fb923c', key: 'valakas' },
    wind: { n: '風龍', dn: '林德拜爾', re: /林德拜爾/, c: '#86efac', key: 'lindvior' }
  };
  var ELES = ['earth', 'water', 'fire', 'wind'];
  var RES = { resFire: '火', resWater: '水', resWind: '風', resEarth: '地', resNone: '無' };
  var RES_KEYS = Object.keys(RES);
  var SHARD = 'afk_dmark_shard', STONE = 'afk_dmark_stone', DRES = 'afk_dres_shard';
  var PARTS = ['heart', 'claw', 'eye', 'fang', 'flesh', 'bone', 'blood', 'scale'];
  var partIds = function (e) { return PARTS.map(function (x) { return 'mat_' + DRAGON[e].key + '_' + x; }); };
  var COST = { stone: 20, mark: 1, scar: 1, star: 20, starMax: 3, starPct: 5, tree: 5, dres: 100, will: 1, asc: 5, supreme: 10, supremeShard: 5, hidden: 100 };
  W.__afkAffixPlus = { on: ON, BLESS: BLESS, ANC_T: ANC_T, WILL: WILL, DRAGON: DRAGON, COST: COST, ancTxt: ancTxt };

  // ── 道具 ──
  var ITEMS = {
    afk_dmark_stone: { n: '龍的印記石', c: 'text-amber-200', img: 'assets/icons/items/受封印 地龍之魔眼.png', d: '二十個龍印碎片壓成的石頭，裡面四條龍的氣息還在互相撕咬。在燃柳村龍紋師艾格尼絲那裡為武器刻上「龍的印記」或為盾牌／盔甲留下「龍的傷痕」，每次 1 顆、龍是隨機的，可以一直洗到想要的那條。' },
    afk_dmark_shard: { n: '龍印碎片', c: 'text-yellow-300', img: 'assets/icons/items/龍之鑽石.png', d: '同一條龍的心、爪、眼、牙、肉、骨、血、鱗湊成一套，在燃柳村龍紋師艾格尼絲那裡換成 1 個碎片。20 個壓成 1 顆龍的印記石；也是至高的祝福的材料。' },
    afk_dres_shard: { n: '闇龍的抵抗者意志傳承碎片', c: 'text-violet-300', img: 'assets/icons/items/黑暗妖精的靈魂水晶.png', d: '曾經對抗闇龍哈爾巴斯、最後在夢中死去的人們留下的意志。只在席琳夢域鏡掉落（一般怪 0.1%、頭目必掉 1 個）。100 個可在燃柳村龍紋師艾格尼絲那裡為防具賦予「闇龍的抵抗者」（無屬性抗性 +10）。' }
  };
  // 祝福賦予卷軸（玩家 2026-10-28）：龍紋師艾格尼絲用祝福的強化卷軸兌換——武器用「祝福的 對武器施法的卷軸」、防具用「祝福的 對盔甲施法的卷軸」；
  //   一階 100 張、二階 500 張、三階 800 張。飾品不能賦予祝福（只能打怪取得）。
  var BSCR = { wpn: { src: 'scroll_weapon_b', n: '武器', img: 'assets/icons/items/祝福的 對武器施法的卷軸.png' }, arm: { src: 'scroll_armor_b', n: '防具', img: 'assets/icons/items/祝福的 對盔甲施法的卷軸.png' } };
  var BCOST = { 1: 100, 2: 500, 3: 800 }, BTIER = { 1: '一階', 2: '二階', 3: '三階' }, BNAME = { 1: '祝福的', 2: '昇華的祝福', 3: '至高的祝福' };
  var bsId = function (k, lv) { return 'afk_bless_' + k + '_' + lv; };
  ['wpn', 'arm'].forEach(function (k) {
    [1, 2, 3].forEach(function (lv) {
      ITEMS[bsId(k, lv)] = { n: BSCR[k].n + '祝福賦予卷軸（' + BTIER[lv] + '）', c: lv === 3 ? 'text-yellow-200' : lv === 2 ? 'text-amber-300' : 'text-yellow-400', img: BSCR[k].img,
        d: '龍紋師艾格尼絲把 ' + BCOST[lv] + ' 張「祝福的 對' + (k === 'wpn' ? '武器' : '盔甲') + '施法的卷軸」重新抄寫成的卷軸。交給她，可以讓一件' + BSCR[k].n + '帶上「' + BNAME[lv] + '」（祝福效果 ×' + lv + '）；只能往上升。' };
    });
  });
  Object.keys(ITEMS).forEach(function (id) {
    if (DB.items[id]) return;
    var x = ITEMS[id];
    DB.items[id] = { n: x.n, type: 'etc', p: 0, c: x.c, img: x.img, noUse: true, gachaWeight: 0, d: x.d };
    try { if (typeof miscCatKey === 'function' && typeof MISC_CAT_ITEMS !== 'undefined') { var k = miscCatKey(id, DB.items[id]); if (k && MISC_CAT_ITEMS[k] && !MISC_ITEM_CAT[id]) { MISC_CAT_ITEMS[k].push(id); MISC_ITEM_CAT[id] = k; if (typeof OBTAINABLE_MISC !== 'undefined') OBTAINABLE_MISC[id] = true; } } } catch (e) {}
  });

  // ── 判斷 ──
  var isAccSlot = function (d) { return d && (d.type === 'acc' || d.slot === 'ring' || d.slot === 'amulet' || d.slot === 'belt' || d.slot === 'ear'); };
  var isEquip = function (d) { return !!d && !d.gmOnly && ((d.type === 'wpn' && !d.isArrow) || ((d.type === 'arm' || d.type === 'acc') && d.slot !== 'petwpn' && d.slot !== 'petarm' && d.slot !== 'doll')); };
  var KIND = {
    weapon: function (d) { return isEquip(d) && d.type === 'wpn'; },
    scar: function (d) { return isEquip(d) && (d.slot === 'shield' || d.slot === 'armor'); },
    armor: function (d) { return isEquip(d) && d.type === 'arm'; },
    any: function (d) { return isEquip(d); },
    blessed: function (d, it) { return isEquip(d) && it && it.bless && it.bless !== 'cursed'; }
  };
  var dragonOf = function (mob) { if (!mob || !mob.n) return null; for (var i = 0; i < ELES.length; i++) if (DRAGON[ELES[i]].re.test(mob.n)) return ELES[i]; return null; };
  var eqList = function (a) { var e = a && a.eq || {}, out = []; for (var k in e) if (e[k] && e[k].id) out.push([k, e[k]]); return out; };
  var stars = function (n) { return Math.max(0, Math.min(COST.starMax, Math.floor(Number(n) || 0))); };
  var markItem = function (a) {   // 左右手只算一把：主手優先
    var e = a && a.eq || {};
    if (e.wpn && e.wpn.dmark) return e.wpn;
    if (e.offwpn && e.offwpn.dmark) return e.offwpn;
    return null;
  };
  var markOf = function (a) { var it = markItem(a); return it ? it.dmark : null; };
  var scarItems = function (a) { return eqList(a).filter(function (x) { var d = DB.items[x[1].id]; return d && (d.slot === 'shield' || d.slot === 'armor'); }).map(function (x) { return x[1]; }); };
  var hasScar = function (a, ele) { return scarItems(a).some(function (it) { return it.dscar && (it.dscar === true || !ele || it.dscar === ele); }); };
  var scarStar = function (a, ele) { var b = -1; scarItems(a).forEach(function (it) { if (it.dscar && (it.dscar === true || it.dscar === ele)) b = Math.max(b, stars(it.dscarStar)); }); return b; };
  var scarHidden = function (a) { return scarItems(a).some(function (it) { return it.dscarHidden; }); };
  var markHidden = function (a) { var e = a && a.eq || {}; return !!((e.wpn && e.wpn.dmarkHidden) || (e.offwpn && e.offwpn.dmarkHidden)); };
  var sealed = function (p) { return !!(p && p.afkFinal2 && p.afkFinal2.result === 'lose' && !p.afkFinal2.pending); };
  var willOk = function (p) { return !!p && !sealed(p) && ((p.rebirth > 0) || (p.lv || 1) >= 80); };

  // ── 物品簽章：新詞綴不同就不疊在一起 ──
  var extraSig = function (it) {
    var s = '';
    if (it.blessLv > 1) s += '|BL' + it.blessLv;
    if (it.ancLv > 1) s += '|AL' + it.ancLv;
    if (it.will) s += '|W' + it.will;
    if (it.dmark) s += '|M' + it.dmark;
    if (it.dscar) s += '|S' + it.dscar;
    if (it.dmarkStar || it.dscarStar) s += '|*' + stars(it.dmarkStar) + stars(it.dscarStar);
    if (it.dmarkN || it.dscarN) s += '|N' + (it.dmarkN || 0) + '.' + (it.dscarN || 0) + (it.dmarkHidden ? 'h' : '') + (it.dscarHidden ? 'H' : '');
    if (it.tree && it.tree.length) s += '|T' + it.tree.join('+');
    if (it.dres) s += '|R';
    return s;
  };
  if (typeof W.itemSig === 'function') { var oSig = W.itemSig; W.itemSig = function (it) { return oSig.apply(this, arguments) + (it ? extraSig(it) : ''); }; }

  // ── 祝福／遠古：只能打怪取得（玩家 2026-10-28）；掉落時各自 5% 第二階、1% 第三階 ──
  //   打怪＝核心擊殺掉落期間（_lootMobInfo 有值，離線結算重放 killMob 也一樣）或血盟／攻城敵人的掉寶（pledgeBonusDrop）。
  //   其他來源（製作、精煉、兌換、任務、黑市、傳家之寶…）不再產生祝福；拿祝福的材料製作，成品照核心規則保留祝福。
  var pledgeDepth = 0;
  var killLoot = function () { if (pledgeDepth > 0) return true; try { return typeof _lootMobInfo !== 'undefined' && !!_lootMobInfo; } catch (e) { return false; } };
  if (ON) W.__afkKillLoot = killLoot;
  if (ON && typeof W.pledgeBonusDrop === 'function') {
    var oPB = W.pledgeBonusDrop;
    W.pledgeBonusDrop = function () { pledgeDepth++; try { return oPB.apply(this, arguments); } finally { pledgeDepth--; } };
  }
  if (ON && typeof W.rollAffixesNew === 'function') {
    var oRoll = W.rollAffixesNew;
    W.rollAffixesNew = function () {
      var r = oRoll.apply(this, arguments);   // 照樣擲（committed RNG 序號不位移），只是非打怪來源不給祝福
      try { if (r && r.bless === true && !killLoot()) r.bless = false; } catch (e) {}
      return r;
    };
  }
  // 傳家之寶（萊利的輔佐官，用積分換）原本 10% 祝福：屬於兌換，不給
  if (ON && typeof W.antHeirloomOpen === 'function') {
    var oHeir = W.antHeirloomOpen;
    W.antHeirloomOpen = function () {
      var p = P(), before = {}, self = this, args = arguments, oLog = W.logSys;
      if (p) p.inv.forEach(function (i) { if (i) before[i.uid] = i.bless; });
      W.logSys = function (h) { if (String(h).indexOf('寶物受到祝福') >= 0) return; return oLog.apply(this, arguments); };
      try { return oHeir.apply(self, args); }
      finally { W.logSys = oLog; try { if (p) p.inv.forEach(function (i) { if (i && i.bless === true && before[i.uid] !== true) i.bless = false; }); } catch (e) {} }
    };
  }
  var rollTier = function () { var x = Math.random(); return x < 0.01 ? 3 : x < 0.06 ? 2 : 0; };
  var ancKey = function (a) { return a === true ? 'ancient' : a; };
  var ancBase = function (a) { return ({ eternal: '永恆', immortal: '不朽', primordial: '太初' })[ancKey(a)] || '遠古'; };
  var ancTierName = function (a, L) { return (ANC_T[L] ? ANC_T[L].p : '') + ancBase(a); };
  if (ON && typeof W.gainItem === 'function') {
    var oGain = W.gainItem;
    W.gainItem = function () {
      var info = oGain.apply(this, arguments);
      try {
        if (info && (info.bless === true || info.anc) && killLoot() && player && player.inv) {
          var bl = info.bless === true ? rollTier() : 0, al = info.anc ? rollTier() : 0;
          if (bl > 1 || al > 1) {
            var it = null;
            for (var i = player.inv.length - 1; i >= 0; i--) {
              var x = player.inv[i];
              if (x && x.id === info.id && (x.bless === true) === (info.bless === true) && x.anc === info.anc && !(x.blessLv > 1) && !(x.ancLv > 1) && (Number(x.en) || 0) === (Number(info.en) || 0)) { it = x; break; }
            }
            if (it) {
              if (cnt(it) > 1) { it.cnt = cnt(it) - 1; it = Object.assign({}, it, { uid: uid(), cnt: 1 }); player.inv.push(it); }
              var d = DB.items[it.id], nm = d ? d.n : '';
              if (bl > 1) { it.blessLv = bl; info.blessLv = bl; sys('<span class="c-sherine font-bold">✦✦ ' + esc(nm) + ' 帶著「' + BLESS[bl].n + '」！（祝福效果 ×' + bl + '）✦✦</span>'); }
              if (al > 1) { it.ancLv = al; info.ancLv = al; sys('<span class="c-sherine font-bold">✦✦ ' + esc(nm) + ' 帶著「' + ancTierName(it.anc, al) + '」！（遠古效果 ×' + al + '）✦✦</span>'); }
            }
          }
        }
      } catch (e) {}
      return info;
    };
  }

  // ── 能力 ──
  var blessSlot = function (k, d) { return (k === 'wpn' || k === 'offwpn' || d.type === 'wpn') ? 'wpn' : (isAccSlot(d) ? 'acc' : 'arm'); };
  var applyItem = function (dd, k, it) {
    var d = DB.items[it.id]; if (!d) return;
    if (it.bless === true && it.blessLv > 1 && typeof applyBlessStats === 'function') for (var i = 1; i < Math.min(3, it.blessLv); i++) applyBlessStats(dd, true, blessSlot(k, d));
    if (it.anc && it.ancLv > 1 && typeof applyAncStats === 'function') for (var j = 1; j < Math.min(3, it.ancLv); j++) applyAncStats(dd, it.anc, blessSlot(k, d));
    if (it.will && WILL[it.will] && d.type === 'wpn') { var st = WILL[it.will].st; for (var s in st) dd[s] = (Number(dd[s]) || 0) + st[s]; }
    if (it.tree && it.tree.length) it.tree.forEach(function (r) { if (RES[r]) dd[r] = (Number(dd[r]) || 0) + 10; });
    if (it.dres && d.type === 'arm') dd.resNone = (Number(dd.resNone) || 0) + 10;
  };
  var oRe = W.recomputeStats;
  W.recomputeStats = function () {
    var r = oRe.apply(this, arguments);
    try { var p = typeof player !== 'undefined' ? player : null; if (ON && p && p.d && p.eq) eqList(p).forEach(function (x) { applyItem(p.d, x[0], x[1]); }); } catch (e) { console.warn('[AFK-affix-plus] recompute', e); }
    return r;
  };

  // ── 龍的印記：對該龍傷害 +50% ──
  var markHooked = false;   // 2026-10-29 修：只包一次——之後 sherine-dream、runefx、caps 再包 C.damage，外層沒有旗標，load 時會再包一層（印記 ×1.5 變成 ×2.25）
  var hookDamage = function () {
    var C = W.AFK_CARD_COMBAT; if (markHooked || !C || typeof C.damage !== 'function' || C.damage.__afkMark) return; markHooked = true;
    var oD = C.damage;
    C.damage = function (actor, target, amount) {
      var v = oD.apply(this, arguments);
      try {
        if (v > 0 && actor && target) {
          var mi = markItem(actor); if (mi && dragonOf(target) === mi.dmark) v = Math.floor(v * (1.5 + COST.starPct / 100 * stars(mi.dmarkStar)));
          if (target.boss && markHidden(actor) && C.inDungeon && C.inDungeon()) v = Math.floor(v * 1.5);
        }
      } catch (e) {}
      return v;
    };
    C.damage.__afkMark = true;
  };
  if (ON) { hookDamage(); W.addEventListener('load', hookDamage); }

  // ── 受到的傷害修正（龍的傷痕；afk-rebirth2 的單人席琳也掛在這裡）──
  //   做法同 afk-arts：攻擊前記下全隊 HP，結算後把該退回的傷害加回去；期間的死亡判定延後到退回之後
  var takenMods = W.__afkTakenMods = W.__afkTakenMods || [];
  if (ON) takenMods.push(function (ent, mob) { var e = dragonOf(mob); if (!e) return 1; var st = scarStar(ent, e); return (st >= 0 ? 0.5 - COST.starPct / 100 * st : 1) * (scarHidden(ent) ? 0.5 : 1); });
  var depth = 0, pendingKill = false;
  var oKill = W.killPlayer;
  if (typeof oKill === 'function') W.killPlayer = function () { if (depth > 0) { pendingKill = true; return; } return oKill.apply(this, arguments); };
  var multFor = function (ent, mob, kind) { var m = 1; takenMods.forEach(function (f) { try { var v = Number(f(ent, mob, kind)); if (v >= 0 && isFinite(v)) m *= v; } catch (e) {} }); return m; };
  // 核心補丁 46：扣血前的受傷掛點（技藝減傷、最終減傷、龍的傷痕、席琳模式都在這裡一次算完；小數連乘、最後取整）
  W.__afkTaken = function (ent, dmg, mob, kind) {
    if (!(dmg > 0)) return dmg;
    var m = multFor(ent, mob, kind), v;
    if (typeof W.__afkArtsTaken === 'function') v = W.__afkArtsTaken(ent, dmg, mob, kind, m);   // 百分比減傷合計最多 75%（在技藝那邊一起夾）
    else v = dmg * Math.max(0.25, m);
    return Math.max(0, Math.floor(v));
  };
  var wrapTaken = function (name, kind) {
    if (W.__afkTakenPatched) return;   // 核心有掛點就不用事後補血
    var o = W[name]; if (typeof o !== 'function') return;
    W[name] = function (mob) {
      var p = P();
      if (!p || depth > 0) return o.apply(this, arguments);
      var party = [p].concat(p.allies || []).filter(Boolean);
      var any = party.some(function (e) { return multFor(e, mob, kind) !== 1; });
      if (!any) return o.apply(this, arguments);
      var snap = party.map(function (e) { return [e, e === p ? p.hp : e.curHp, !!e._downed]; }), r;
      depth++; pendingKill = false;
      try { r = o.apply(this, arguments); }
      finally {
        depth--;
        try {
          snap.forEach(function (row) {
            var e = row[0], before = row[1] || 0, now = e === p ? p.hp : e.curHp, lost = before - (now || 0);
            if (!(lost > 0)) return;
            var back = Math.floor(lost * (1 - multFor(e, mob, kind)));   // 正數＝退回、負數＝加重
            if (!back) return;
            if (e === p) { p.hp += back; if (p.hp <= 0) pendingKill = true; }
            else { e.curHp += back; if (e.curHp > 0 && e._downed && !row[2]) { e._downed = false; e._reviveCd = 0; } else if (e.curHp <= 0) { e.curHp = 0; if (!e._downed) { e._downed = true; e._reviveCd = 150; } } }
          });
        } catch (e) {}
        if (pendingKill) { pendingKill = false; if (p.hp <= 0 && !p.dead) { try { W.killPlayer(); } catch (e) {} } }
      }
      return r;
    };
  };
  [['enemyPhysicalAttack', 'phys'], ['enemyAttackAlly', 'phys'], ['applyMobMagic', 'magic'], ['applyMobMagicToAlly', 'magic']].forEach(function (x) { wrapTaken(x[0], x[1]); });

  // ── 掉落：闇龍的抵抗者意志傳承碎片（席琳夢域鏡）──
  if (ON && typeof W.killMob === 'function') {
    var oKillMob = W.killMob;
    W.killMob = function (idx) {
      var m = (typeof mapState !== 'undefined' && mapState.mobs) ? mapState.mobs[idx] : null;
      var r = oKillMob.apply(this, arguments);
      try {
        if (m && m._dead && !m._afkAxPaid && P()) {
          m._afkAxPaid = true;
          var dream = !!(m._dream || (player.sherineDream && player.sherineMad));
          if (dream && !(typeof state !== 'undefined' && state._afkFinal) && !(m.race === '建築' && m.noAutoTeleport) && !m._dreamStar) {   // 2026-10-31：傲慢之塔的樓梯／遺忘之島傳送門、暗夢星迴頭目不掉
            var k = m.boss ? 1 : (Math.random() < 0.001 ? 1 : 0);
            if (k) { gainItem(DRES, k, true); if (m.boss) sys('<span class="text-violet-300">' + esc(m.n) + ' 身上飄出 1 個闇龍的抵抗者意志傳承碎片。</span>'); }
          }
        }
      } catch (e) { console.warn('[AFK-affix-plus] drop', e); }
      return r;
    };
  }

  // ── 名稱與說明 ──
  var tags = function (it) {
    var t = [];
    if (it.will && WILL[it.will]) t.push('<span style="color:#fca5a5;">〔' + WILL[it.will].s + '〕</span>');
    var sv = function (n) { n = stars(n); return n ? '★'.repeat(n) : ''; };
    if (it.dmark && DRAGON[it.dmark]) t.push('<span style="color:' + DRAGON[it.dmark].c + ';">〔' + DRAGON[it.dmark].n + '印記' + sv(it.dmarkStar) + '〕</span>');
    if (it.dscar) t.push('<span style="color:' + (DRAGON[it.dscar] ? DRAGON[it.dscar].c : '#e2e8f0') + ';">〔' + (DRAGON[it.dscar] ? DRAGON[it.dscar].n : '龍') + '傷痕' + sv(it.dscarStar) + '〕</span>');
    if (it.tree && it.tree.length) t.push('<span style="color:#86efac;">〔神樹・' + it.tree.map(function (k) { return RES[k]; }).join('') + '〕</span>');
    if (it.dres) t.push('<span style="color:#c4b5fd;">〔闇龍抵抗〕</span>');
    return t.join('');
  };
  var oName = W.getItemFullName;
  W.getItemFullName = function (item) {
    var h = oName.apply(this, arguments);
    try {
      if (!item || !ON) return h;
      if (item.bless === true && BLESS[item.blessLv]) h = h.replace('祝福的 </span>', BLESS[item.blessLv].n + ' </span>').replace('class="c-blessed">' + BLESS[item.blessLv].n, 'class="c-blessed" style="color:' + BLESS[item.blessLv].c + ';text-shadow:0 0 6px #b45309;">' + BLESS[item.blessLv].n);
      if (item.anc && item.ancLv > 1 && ANC_T[item.ancLv]) { var ac = ancCls(item.anc), an = ancBase(item.anc); h = h.replace('<span class="' + ac + '">' + an + ' </span>', '<span class="' + ac + '" style="' + ANC_T[item.ancLv].st + '">' + ancTierName(item.anc, item.ancLv) + ' </span>'); }
      var t = tags(item); if (t) h += ' ' + t;
    } catch (e) {}
    return h;
  };
  if (ON && typeof W.buildItemDescHTML === 'function') {
    var oDesc = W.buildItemDescHTML;
    W.buildItemDescHTML = function (item) {
      var h = oDesc.apply(this, arguments);
      try {
        var d = item && DB.items[item.id]; if (!d) return h;
        if (item.bless === true && BLESS[item.blessLv]) {
          var L = item.blessLv, acc = isAccSlot(d);
          var bt = d.type === 'wpn' ? '額外傷害+' + L + '，額外魔法點數+' + (2 * L) + '，額外命中+' + L : (acc ? '防禦(AC)-' + L + '，魔防(MR)+' + L : '防禦(AC)-' + L + '，傷害減免+' + L);
          h = h.replace(/<span class="text-yellow-400">祝福的：[^<]*<\/span>/, '<span style="color:' + BLESS[L].c + ';font-weight:bold;">' + BLESS[L].n + '（祝福效果 ×' + L + '）：' + bt + '</span>');
        }
        if (item.anc && item.ancLv > 1 && ANC_T[item.ancLv]) {
          var AL = item.ancLv, ak = d.type === 'wpn' ? 'wpn' : (isAccSlot(d) ? 'acc' : 'arm'), acl = ancCls(item.anc), anm = ancBase(item.anc);
          var at0 = '<span class="' + acl + '">' + anm + '：', i0 = h.indexOf(at0);
          if (i0 >= 0) { var i1 = h.indexOf('</span>', i0); if (i1 > i0) h = h.slice(0, i0) + '<span class="' + acl + '" style="' + ANC_T[AL].st + '">' + ancTierName(item.anc, AL) + '（遠古效果 ×' + AL + '）：' + ancTxt(ak, ancKey(item.anc), AL) + '</span>' + h.slice(i1 + 7); }
        }
        var add = [];
        if (item.will && WILL[item.will]) add.push('<span style="color:#fca5a5;font-weight:bold;">' + WILL[item.will].n + '：' + WILL[item.will].d + '</span><br><span class="afk-lore">' + WILL[item.will].lore + '</span>');
        if (item.dmark && DRAGON[item.dmark]) add.push('<span style="color:' + DRAGON[item.dmark].c + ';font-weight:bold;">龍的印記（' + DRAGON[item.dmark].n + (stars(item.dmarkStar) ? '・' + stars(item.dmarkStar) + ' 星' : '') + '）：對' + DRAGON[item.dmark].dn + '（含各階型態）傷害 +' + (50 + COST.starPct * stars(item.dmarkStar)) + '%（左右手只有一把生效，主手優先）</span>');
        if (item.dscar) add.push('<span style="color:#e2e8f0;font-weight:bold;">龍的傷痕（' + (DRAGON[item.dscar] ? DRAGON[item.dscar].n : '四龍') + (stars(item.dscarStar) ? '・' + stars(item.dscarStar) + ' 星' : '') + '）：受到' + (DRAGON[item.dscar] ? DRAGON[item.dscar].dn + '（含各階型態）' : '四龍') + '的傷害 −' + (50 + COST.starPct * stars(item.dscarStar)) + '%</span>');
        if (item.dmarkHidden) add.push('<span style="color:#f472b6;font-weight:bold;">龍印的執念：副本頭目傷害 +50%</span>');
        if (item.dscarHidden) add.push('<span style="color:#f472b6;font-weight:bold;">龍痕的執念：受到四龍的傷害再 −50%</span>');
        if (item.tree && item.tree.length) add.push('<span style="color:#86efac;font-weight:bold;">神樹者的讚禮：' + item.tree.map(function (k) { return RES[k] + '屬性抗性 +10'; }).join('、') + '</span>');
        if (item.dres) add.push('<span style="color:#c4b5fd;font-weight:bold;">闇龍的抵抗者：無屬性抗性 +10</span>');
        if (add.length) h += '<br>' + add.join('<br>');
      } catch (e) {}
      return h;
    };
  }

  // ── 材料扣除 ──
  var have = function (id) { var p = P(); return p ? p.inv.reduce(function (n, it) { return n + (it && it.id === id && !it.lock ? cnt(it) : 0); }, 0) : 0; };
  var takeId = function (id, n) {
    var p = P(); if (have(id) < n) return false;
    p.inv.forEach(function (it) { if (n > 0 && it && it.id === id && !it.lock) { var q = Math.min(n, cnt(it)); it.cnt = cnt(it) - q; n -= q; } });
    p.inv = p.inv.filter(function (it) { return cnt(it) > 0; });
    try { if (typeof resetCatchupGainItemIndex === 'function') resetCatchupGainItemIndex(); } catch (e) {}
    return true;
  };
  var diaCards = function () {
    var p = P(), A = W.AFK_CARD_ASCENSION; if (!p) return [];
    return p.inv.filter(function (it) { var d = it && DB.items[it.id]; return d && d.eff === 'card' && d.cardTier === 5 && !it.lock && cnt(it) > 0 && (!A || !A.diamondOwned || A.diamondOwned(d.cardMob, p)); });
  };
  var diaHave = function () { return diaCards().reduce(function (n, it) { return n + cnt(it); }, 0); };
  var takeDia = function (n) {
    var pool = diaCards(); if (pool.reduce(function (v, it) { return v + cnt(it); }, 0) < n) return false;
    pool.forEach(function (it) { var q = Math.min(n, cnt(it)); if (q) { it.cnt = cnt(it) - q; n -= q; } });
    var p = P(); p.inv = p.inv.filter(function (it) { return cnt(it) > 0; });
    try { if (typeof resetCatchupGainItemIndex === 'function') resetCatchupGainItemIndex(); } catch (e) {}
    return true;
  };
  var fates = function () { var p = P(); return p ? p.inv.filter(function (it) { return it && /^afk_fate_/.test(it.id) && !it.lock && cnt(it) > 0; }) : []; };

  // ── 選裝備 ──
  var SLOT_N = { wpn: '主手', offwpn: '副手', shield: '盾牌', armor: '盔甲', helm: '頭盔', cloak: '斗篷', tshirt: 'T恤', gloves: '手套', boots: '長靴', shin: '脛甲', amulet: '項鍊', belt: '腰帶', ring1: '戒指1', ring2: '戒指2', ring3: '戒指3', ring4: '戒指4', ear1: '耳環1', ear2: '耳環2' };
  var candidates = function (kind) {
    var p = P(), out = [], f = KIND[kind]; if (!p || !f) return out;
    eqList(p).forEach(function (x) { var d = DB.items[x[1].id]; if (f(d, x[1])) out.push({ ref: 'eq:' + x[0], it: x[1], d: d, where: '裝備中' + (SLOT_N[x[0]] ? '・' + SLOT_N[x[0]] : '') }); });
    p.inv.forEach(function (it) { var d = it && DB.items[it.id]; if (f(d, it) && !it.lock) out.push({ ref: 'inv:' + it.uid, it: it, d: d, where: '背包' }); });
    return out;
  };
  var lastRef = '', lastMsg = '';
  var resolveRef = function (ref) {
    var p = P(); if (!p || !ref) return null;
    if (ref.indexOf('eq:') === 0) { var k = ref.slice(3); lastRef = ref; return p.eq[k] ? { it: p.eq[k], slot: k } : null; }
    var u = ref.slice(4), it = p.inv.find(function (x) { return x && x.uid === u; });
    if (!it) return null;
    if (cnt(it) > 1) { it.cnt = cnt(it) - 1; var one = Object.assign({}, it, { uid: uid(), cnt: 1 }); p.inv.push(one); it = one; }
    lastRef = 'inv:' + it.uid;
    return { it: it, slot: null };
  };
  var plain = function (it) { var d = DB.items[it.id]; return ((it.en > 0) ? '+' + it.en + ' ' : '') + (d ? d.n : it.id); };
  var done = function (msg) { lastMsg = msg; sys(msg); try { calcStats(); } catch (e) {} try { if (typeof renderTabs === 'function') renderTabs(true); saveGame(); updateUI(); } catch (e) {} };
  // 給其他外掛加項目用（目前沒有人用；原本的蝕刻已搬到 afk-runes 的符文師佐爾頓）：W.__afkAxExtra 回傳一列服務；按鈕 data-ax＝'ext:<名稱>:<參數>'，由 W.__afkAxAct[名稱](選取, 參數, AXH, 讀欄位) 處理
  var AXH = { resolveRef: function (r) { return resolveRef(r); }, done: function (m) { return done(m); }, icoTag: function (u, t, sm) { return icoTag(u, t, sm); }, reqTxt: function (h, n, w) { return reqTxt(h, n, w); }, esc: function (v) { return esc(v); } };

  // ── 操作 ──
  var ACT = {
    exchange: function (all) {
      var sets = ELES.map(function (e) { return { e: e, n: Math.min.apply(Math, partIds(e).map(have)) }; });
      var total = sets.reduce(function (n, x) { return n + x.n; }, 0);
      if (total < 1) return '需要同一條龍的心、爪、眼、牙、肉、骨、血、鱗各 1 個。';
      var got = 0;
      sets.forEach(function (x) { var k = all ? x.n : Math.min(x.n, 1 - got); if (k > 0) { partIds(x.e).forEach(function (id) { takeId(id, k); }); got += k; } });
      gainItem(SHARD, got, true);
      done('<span class="text-yellow-300 font-bold">八樣龍的遺骸在艾格尼絲手中化成 ' + got + ' 個龍印碎片。</span>'); return null;
    },
    stone: function (all) {
      var n = Math.floor(have(SHARD) / COST.stone); if (!all) n = Math.min(n, 1);
      if (n < 1) return '需要 ' + COST.stone + ' 個龍印碎片。';
      takeId(SHARD, n * COST.stone); gainItem(STONE, n, true);
      done('<span class="text-amber-200 font-bold">' + (n * COST.stone) + ' 個龍印碎片壓成了 ' + n + ' 顆龍的印記石。</span>'); return null;
    },
    mark: function (ref) {
      if (have(STONE) < COST.mark) return '需要 1 顆龍的印記石。';
      var p = P(), probe = ref && ref.indexOf('eq:') === 0 ? ref.slice(3) : null;
      if (probe === 'wpn' && p.eq.offwpn && p.eq.offwpn.dmark) return '副手武器已經有龍的印記；左右手只能有一把。';
      if (probe === 'offwpn' && p.eq.wpn && p.eq.wpn.dmark) return '主手武器已經有龍的印記；左右手只能有一把。';
      var x = resolveRef(ref); if (!x) return '找不到這件武器。';
      takeId(STONE, COST.mark);
      var ele = ELES[Math.floor(Math.random() * ELES.length)];
      x.it.dmark = ele; x.it.dmarkN = (Number(x.it.dmarkN) || 0) + 1;
      var msg = '<span class="font-bold" style="color:' + DRAGON[ele].c + ';">「' + esc(plain(x.it)) + '」刻上了' + DRAGON[ele].n + '的印記：對' + DRAGON[ele].dn + '傷害 +50%。</span>';
      if (x.it.dmarkN > COST.hidden && !x.it.dmarkHidden) { x.it.dmarkHidden = true; msg += '<span class="font-bold" style="color:#f472b6;">印記被刻了太多次，四條龍的執念滲進了刀身——副本頭目傷害 +50%。</span>'; }
      done(msg); return null;
    },
    scar: function (ref) {
      if (have(STONE) < COST.scar) return '需要 1 顆龍的印記石。';
      var x = resolveRef(ref); if (!x) return '找不到這件裝備。';
      takeId(STONE, COST.scar);
      var ele = ELES[Math.floor(Math.random() * ELES.length)];
      x.it.dscar = ele; x.it.dscarN = (Number(x.it.dscarN) || 0) + 1;
      var msg = '<span class="font-bold" style="color:' + DRAGON[ele].c + ';">「' + esc(plain(x.it)) + '」留下了' + DRAGON[ele].n + '的傷痕：受到' + DRAGON[ele].dn + '的傷害 −50%。</span>';
      if (x.it.dscarN > COST.hidden && !x.it.dscarHidden) { x.it.dscarHidden = true; msg += '<span class="font-bold" style="color:#f472b6;">傷痕疊了太多層，這件防具記住了四條龍的爪痕——受到四龍的傷害再 −50%。</span>'; }
      done(msg); return null;
    },
    star: function (ref, kind) {
      var p = P(), x0 = ref && ref.indexOf('eq:') === 0 ? p.eq[ref.slice(3)] : p.inv.find(function (z) { return z && z.uid === String(ref || '').slice(4); });
      var key = kind === 'scar' ? 'dscar' : 'dmark', sk = key + 'Star', nm = kind === 'scar' ? '龍的傷痕' : '龍的印記';
      if (!x0 || !x0[key]) return '這件裝備還沒有' + nm + '。';
      if (stars(x0[sk]) >= COST.starMax) return nm + '已經是 ' + COST.starMax + ' 星。';
      if (have(STONE) < COST.star) return '升星需要 ' + COST.star + ' 顆龍的印記石。';
      var x = resolveRef(ref); if (!x) return '找不到這件裝備。';
      takeId(STONE, COST.star); x.it[sk] = stars(x.it[sk]) + 1;
      done('<span class="font-bold text-amber-200">「' + esc(plain(x.it)) + '」的' + nm + '升到 ' + x.it[sk] + ' 星（效果 ' + (kind === 'scar' ? '−' : '+') + (50 + COST.starPct * x.it[sk]) + '%）。</span>'); return null;
    },
    tree: function (ref) {
      if (diaHave() < COST.tree) return '需要 ' + COST.tree + ' 張怪物鑽石卡（已登錄鑽石卡的怪物卡、未上鎖）。';
      var x = resolveRef(ref); if (!x) return '找不到這件裝備。';
      takeDia(COST.tree);
      var pool = RES_KEYS.slice(), a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      x.it.tree = [a, b];
      done('<span class="font-bold" style="color:#86efac;">神樹的葉子落在「' + esc(plain(x.it)) + '」上：' + RES[a] + '、' + RES[b] + '屬性抗性各 +10。</span>'); return null;
    },
    dres: function (ref) {
      if (have(DRES) < COST.dres) return '需要 ' + COST.dres + ' 個闇龍的抵抗者意志傳承碎片。';
      var x = resolveRef(ref); if (!x) return '找不到這件防具。';
      if (x.it.dres) return '這件已經有闇龍的抵抗者了。';
      takeId(DRES, COST.dres); x.it.dres = true;
      done('<span class="font-bold" style="color:#c4b5fd;">一百個抵抗者的意志沉進「' + esc(plain(x.it)) + '」：無屬性抗性 +10。</span>'); return null;
    },
    will: function (ref, kind) {
      var p = P();
      if (!WILL[kind]) return '請選擇意志。';
      if (!willOk(p)) return sealed(p) ? '封印輪迴光環封住了你的意志，無法賦予。' : '需要已經轉生，或能進入席琳夢域鏡（Lv80）。';
      var f = fates(); if (!f.length) return '需要 1 顆不屈的命運（任何職業都可以）。';
      var x = resolveRef(ref); if (!x) return '找不到這件武器。';
      var it = f[0]; it.cnt = cnt(it) - 1; p.inv = p.inv.filter(function (z) { return cnt(z) > 0; });
      x.it.will = kind;
      done('<span class="font-bold" style="color:#fca5a5;">不屈的命運碎裂，「' + esc(plain(x.it)) + '」承接了' + WILL[kind].n + '：' + WILL[kind].d + '。</span>'); return null;
    },
    blessEx: function (k, lv) {
      var c = BSCR[k], need = BCOST[lv]; if (!c || !need) return '請選擇卷軸。';
      if (have(c.src) < need) return '需要 ' + need + ' 張「' + DB.items[c.src].n + '」（未上鎖、放在背包）。';
      takeId(c.src, need); gainItem(bsId(k, lv), 1, true, true);
      done('<span class="font-bold" style="color:#fde68a;">' + need + ' 張祝福的卷軸在艾格尼絲筆下合成一張「' + DB.items[bsId(k, lv)].n + '」。</span>'); return null;
    },
    bless: function (ref, lv) {
      var p = P(), x0 = ref && ref.indexOf('eq:') === 0 ? p.eq[ref.slice(3)] : p.inv.find(function (z) { return z && z.uid === String(ref || '').slice(4); });
      var d = x0 && DB.items[x0.id]; if (!d) return '先選一件裝備。';
      var k = d.type === 'wpn' ? 'wpn' : (d.type === 'arm' && !isAccSlot(d) ? 'arm' : null);
      if (!k || !KIND.any(d)) return '飾品不能用卷軸賦予祝福（只能打怪取得）。';
      if (x0.bless === 'cursed') return '詛咒的裝備要先到象牙塔找碧恩解除詛咒。';
      var cur = x0.bless === true ? (x0.blessLv > 1 ? x0.blessLv : 1) : 0;
      if (lv <= cur) return '這件已經是「' + BNAME[cur] + '」，只能用更高階的卷軸。';
      if (have(bsId(k, lv)) < 1) return '需要 1 張「' + DB.items[bsId(k, lv)].n + '」。';
      var x = resolveRef(ref); if (!x) return '找不到這件裝備。';
      takeId(bsId(k, lv), 1);
      x.it.bless = true; if (lv > 1) x.it.blessLv = lv; else delete x.it.blessLv;
      done('<span class="font-bold" style="color:' + (BLESS[lv] ? BLESS[lv].c : '#facc15') + ';">祝福的光落在「' + esc(plain(x.it)) + '」上——' + BNAME[lv] + '（祝福效果 ×' + lv + '）。</span>'); return null;
    }
  };
  W.__afkAffixPlus.act = ACT;
  W.__afkAffixPlus.blessScroll = { id: bsId, cost: BCOST, src: BSCR };
  W.__afkAffixPlus.markOf = markOf; W.__afkAffixPlus.hasScar = hasScar; W.__afkAffixPlus.partIds = partIds; W.__afkAffixPlus.dragonOf = dragonOf; W.__afkAffixPlus.willOk = willOk;

  // ── NPC：龍紋師 艾格尼絲（燃柳村）「龍紋賦予」（玩家 2026-10-28：詞綴擴充獨立成一位 NPC，面板跟商店一樣列出圖示與詳細資訊）──
  //   奧拉奇里亞只留轉生技藝。祝福與遠古的三個階段只能打怪取得，這裡不能升級。
  var NPC_ID = 'npc_dragon_engraver', NPC_N = '艾格尼絲';
  try {
    var town = DB.towns && DB.towns.town_gludio;
    if (ON && town && Array.isArray(town.npcs) && !town.npcs.some(function (x) { return x.id === NPC_ID; })) {
      town.npcs.push({ id: NPC_ID, n: NPC_N, title: '龍紋賦予', type: 'dragonaffix', d: '光龍奧拉奇里亞的龍人族後裔，龍紋師。她能把龍的力量、神樹的祝福與不屈者的意志刻進裝備裡。' });
      if (typeof NPC_SPR_FIXED !== 'undefined' && !NPC_SPR_FIXED[NPC_ID]) NPC_SPR_FIXED[NPC_ID] = '920';
    }
  } catch (e) {}
  var ICON = { shard: DB.items[SHARD] && DB.items[SHARD].img, stone: DB.items[STONE] && DB.items[STONE].img, dres: DB.items[DRES] && DB.items[DRES].img, dia: 'assets/icons/items/鑽石卡.png', tree: 'assets/icons/items/精靈水晶(世界樹的呼喚).png', fate: 'assets/icons/items/不屈的命運.png' };
  var css = function () {
    if (W.__afkNpcKit) return W.__afkNpcKit.css();
    if (document.getElementById('afk-ax-css')) return;
    var s = document.createElement('style'); s.id = 'afk-ax-css';
    s.textContent = '.afk-ax{color:#e2e8f0;font-size:14px;line-height:1.6}'
      + '.afk-ax .ax-lore{color:#94a3b8;font-size:13px;font-style:italic;margin:0 0 8px}'
      + '.afk-ax .ax-h{color:#fde68a;font-weight:700;font-size:15px;margin:12px 0 6px}'
      + '.afk-ax .ax-ico{width:48px;height:48px;flex:0 0 48px;background:#0f172a;border:1px solid #475569;border-radius:6px;display:flex;align-items:center;justify-content:center}'
      + '.afk-ax .ax-ico img{width:40px;height:40px;object-fit:contain;pointer-events:none}'
      + '.afk-ax .ax-ico.sm{width:32px;height:32px;flex:0 0 32px}.afk-ax .ax-ico.sm img{width:26px;height:26px}'
      + '.afk-ax .ax-mats{display:flex;flex-wrap:wrap;gap:8px}'
      + '.afk-ax .ax-mat{display:flex;align-items:center;gap:6px;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:4px 8px 4px 4px;font-size:13px}'
      + '.afk-ax .ax-mat b{color:#fde68a}'
      + '.afk-ax .ax-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}'
      + '.afk-ax .ax-filter button{padding:4px 12px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#cbd5e1;font-size:13px}'
      + '#interaction-content .afk-ax .ax-filter button.on{background:#854d0e;border-color:#f59e0b;color:#fef3c7}'
      + '.afk-ax .ax-list{max-height:240px;overflow-y:auto;border:1px solid #334155;border-radius:8px;background:rgba(15,23,42,.6)}'
      + '.afk-ax .ax-eq{display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid #1e293b;cursor:pointer}'
      + '.afk-ax .ax-eq:hover{background:#334155}.afk-ax .ax-eq.on{background:#422006;box-shadow:inset 3px 0 0 #f59e0b}'
      + '.afk-ax .ax-eq .ax-where{font-size:12px;color:#94a3b8}'
      + '.afk-ax .ax-sel{display:flex;gap:12px;align-items:flex-start;border:1px solid #a16207;border-radius:8px;padding:10px 12px;background:rgba(66,32,6,.35)}'
      + '.afk-ax .ax-sel ul{margin:4px 0 0;padding-left:18px;font-size:13px}.afk-ax .ax-sel li{margin:1px 0}'
      + '.afk-ax .ax-row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 12px;margin-bottom:8px}'
      + '.afk-ax .ax-row:hover{background:#273449}.afk-ax .ax-row.off{opacity:.75}'
      + '.afk-ax .ax-main{display:flex;gap:12px;align-items:flex-start;min-width:0;flex:1 1 280px}'
      + '.afk-ax .ax-name{font-weight:700;font-size:16px;line-height:1.3}'
      + '.afk-ax .ax-desc{color:#cbd5e1;font-size:13px}.afk-ax .ax-note{color:#94a3b8;font-size:12px}'
      + '.afk-ax .ax-req{font-size:13px;font-weight:700}.afk-ax .ok{color:#4ade80}.afk-ax .no{color:#f87171}'
      + '.afk-ax .ax-act{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
      + '.afk-ax .ax-act button{padding:7px 14px;border-radius:6px;background:#a16207;color:#fff;border:1px solid #f59e0b;font-weight:700;font-size:13px;white-space:nowrap}'
      + '.afk-ax .ax-act button[disabled]{opacity:.4;cursor:not-allowed}'
      + '.afk-ax .ax-act select{background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:6px;font-size:13px}'
      + '.afk-ax .ax-err{color:#fca5a5;font-size:13px;min-height:1.2em;margin:4px 0}'
      + '.afk-ax .ax-msg{color:#86efac;font-size:13px;min-height:1.2em;margin:4px 0}';
    document.head.appendChild(s);
  };
  var iconUrl = function (d) { try { return typeof getIconUrl === 'function' ? getIconUrl(d) : (d && d.img) || ''; } catch (e) { return (d && d.img) || ''; } };
  var icoTag = function (url, tip, sm) { return '<div class="ax-ico' + (sm ? ' sm' : '') + (tip ? ' tip-host' : '') + '"' + (tip || '') + '><img src="' + esc(url || '') + '" alt="" onerror="this.style.visibility=\'hidden\'"></div>'; };
  var itemIco = function (id, sm) { var d = DB.items[id]; return icoTag(iconUrl(d), ' data-tip-id="' + esc(id) + '"', sm); };
  var eqIco = function (x) { return icoTag(iconUrl(x.d), ' data-tip-uid="' + esc(x.it.uid) + '" data-tip-src="' + (x.ref.indexOf('eq:') === 0 ? 'eq' : 'inv') + '"'); };
  var fullName = function (it) { try { return '<span class="' + esc(typeof getItemColor === 'function' ? getItemColor(it) : '') + ' font-bold">' + getItemFullName(it) + '</span>'; } catch (e) { return esc(plain(it)); } };
  var reqTxt = function (have, need, label) { return '<span class="ax-req"><span class="' + (have >= need ? 'ok' : 'no') + '">' + have.toLocaleString() + '</span>/' + need.toLocaleString() + ' ' + label + '</span>'; };
  var SLOT_KIND = { all: '全部', weapon: '武器', armor: '防具', acc: '飾品' };
  var ui = { filter: 'all', sel: '', err: '', msg: '', q: '', more: 0 };
  var PAGE = 60;
  var listAll = function () {
    var c = candidates('any');
    if (ui.filter === 'weapon') c = c.filter(function (x) { return x.d.type === 'wpn'; });
    else if (ui.filter === 'armor') c = c.filter(function (x) { return x.d.type === 'arm'; });
    else if (ui.filter === 'acc') c = c.filter(function (x) { return isAccSlot(x.d); });
    var q = String(ui.q || '').trim();
    if (q) c = c.filter(function (x) { var t = ''; try { t = getItemFullName(x.it).replace(/<[^>]+>/g, ''); } catch (e) { t = plain(x.it); } return t.indexOf(q) >= 0; });
    return c;
  };
  var selOf = function () {
    var p = P(); if (!p || !ui.sel) return null;
    var c = candidates('any');
    for (var i = 0; i < c.length; i++) if (c[i].ref === ui.sel) return c[i];
    return null;
  };
  // 選中的裝備目前有哪些詞綴（含效果）
  var affixLines = function (it, d) {
    var L = [], k = d.type === 'wpn' ? 'wpn' : (isAccSlot(d) ? 'acc' : 'arm');
    if (it.bless === true) { var bl = it.blessLv > 1 ? it.blessLv : 1; L.push('<span style="color:' + (BLESS[bl] ? BLESS[bl].c : '#facc15') + ';">' + (BLESS[bl] ? BLESS[bl].n : '祝福的') + '（×' + bl + '）</span>'); }
    else if (it.bless === 'cursed') L.push('<span class="c-cursed">詛咒的</span>');
    if (it.anc) { var al = it.ancLv > 1 ? it.ancLv : 1; L.push('<span class="' + ancCls(it.anc) + '">' + ancTierName(it.anc, al) + '（×' + al + '）：' + ancTxt(k, ancKey(it.anc), al) + '</span>'); }
    if (it.will && WILL[it.will]) L.push('<span style="color:#fca5a5;">' + WILL[it.will].n + '：' + WILL[it.will].d + '</span>');
    if (it.dmark && DRAGON[it.dmark]) L.push('<span style="color:' + DRAGON[it.dmark].c + ';">龍的印記（' + DRAGON[it.dmark].n + (stars(it.dmarkStar) ? '・' + stars(it.dmarkStar) + ' 星' : '') + '）：對' + DRAGON[it.dmark].dn + '傷害 +' + (50 + COST.starPct * stars(it.dmarkStar)) + '%</span>');
    if (it.dscar) L.push('<span style="color:' + (DRAGON[it.dscar] ? DRAGON[it.dscar].c : '#e2e8f0') + ';">龍的傷痕（' + (DRAGON[it.dscar] ? DRAGON[it.dscar].n : '四龍') + (stars(it.dscarStar) ? '・' + stars(it.dscarStar) + ' 星' : '') + '）：受到的傷害 −' + (50 + COST.starPct * stars(it.dscarStar)) + '%</span>');
    if (it.tree && it.tree.length) L.push('<span style="color:#86efac;">神樹者的讚禮：' + it.tree.map(function (r) { return RES[r] + '抗 +10'; }).join('、') + '</span>');
    if (it.dres) L.push('<span style="color:#c4b5fd;">闇龍的抵抗者：無屬性抗性 +10</span>');
    (W.__afkAxLines || []).forEach(function (f) { try { var r = f(it, d); if (r) L.push(r); } catch (e) {} });
    return L;
  };
  // 每一項賦予：圖示、名稱、效果、材料（持有／需要）、這件能不能做
  var services = function (p, x) {
    var sh = have(SHARD), st = have(STONE), dc = diaHave(), dr = have(DRES), fc = fates().reduce(function (n, it) { return n + cnt(it); }, 0);
    var d = x && x.d, it = x && x.it;
    var isW = !!(d && KIND.weapon(d)), isScar = !!(d && KIND.scar(d)), isArm = !!(d && KIND.armor(d)), any = !!(d && KIND.any(d));
    var noSel = '先在上面選一件裝備';
    var setN = ELES.map(function (e) { return { e: e, n: Math.min.apply(Math, partIds(e).map(have)) }; });
    var sets = setN.reduce(function (n, z) { return n + z.n; }, 0);
    var otherMark = function () { if (!x || x.ref.indexOf('eq:') !== 0) return ''; var k = x.ref.slice(3); if (k === 'wpn' && p.eq.offwpn && p.eq.offwpn.dmark) return '副手已經有龍的印記（左右手只能有一把）'; if (k === 'offwpn' && p.eq.wpn && p.eq.wpn.dmark) return '主手已經有龍的印記（左右手只能有一把）'; return ''; };
    return [
      { key: 'exchange', ico: icoTag(ICON.shard, ' data-tip-id="' + SHARD + '"'), name: '龍印碎片', color: '#fde047',
        desc: '同一條龍的心、爪、眼、牙、肉、骨、血、鱗各 1 個湊成一套，換 1 個龍印碎片（四大龍副本掉落）。',
        note: '可湊成的整套：' + setN.map(function (z) { return '<span style="color:' + DRAGON[z.e].c + ';">' + DRAGON[z.e].dn + ' ' + z.n + '</span>'; }).join('、'),
        req: reqTxt(sets, 1, '套龍的材料'), btns: [['exchange', '換 1 個', sets >= 1], ['exchangeAll', '全部換', sets >= 1]] },
      { key: 'stone', ico: icoTag(ICON.stone, ' data-tip-id="' + STONE + '"'), name: '龍的印記石', color: '#fde68a',
        desc: COST.stone + ' 個龍印碎片壓成 1 顆。刻印記、留傷痕、升星都用它。',
        req: reqTxt(sh, COST.stone, '龍印碎片'), btns: [['stone', '壓 1 顆', sh >= COST.stone], ['stoneAll', '全部壓', sh >= COST.stone]] },
      { key: 'mark', ico: icoTag(ICON.stone, ' data-tip-id="' + STONE + '"'), name: '龍的印記（武器）', color: '#fbbf24',
        desc: '隨機四龍之一：對地龍安塔瑞斯／水龍法利昂／火龍巴拉卡斯／風龍林德拜爾（含各階型態）傷害 +50%。可以一直洗到想要的龍；左右手只能有一把生效。',
        req: reqTxt(st, COST.mark, '龍的印記石'), why: !x ? noSel : !isW ? '只能刻在武器上' : otherMark(), btns: [['mark', it && it.dmark ? '重洗印記' : '刻上印記', st >= COST.mark]] },
      { key: 'markStar', ico: icoTag(ICON.stone, ' data-tip-id="' + STONE + '"'), name: '印記升星', color: '#fbbf24',
        desc: COST.star + ' 顆印記石升 1 星，最高 ' + COST.starMax + ' 星，每星再 +' + COST.starPct + '%（+55／60／65%）；洗龍不影響星數。',
        req: reqTxt(st, COST.star, '龍的印記石'), why: !x ? noSel : !(it && it.dmark) ? '這件還沒有龍的印記' : stars(it.dmarkStar) >= COST.starMax ? '已經 ' + COST.starMax + ' 星' : '', btns: [['markStar', '升 1 星', st >= COST.star]] },
      { key: 'scar', ico: icoTag(ICON.stone, ' data-tip-id="' + STONE + '"'), name: '龍的傷痕（盾牌、盔甲）', color: '#e2e8f0',
        desc: '隨機四龍之一：受到該龍（含各階型態）的傷害 −50%，玩家、傭兵都有效。可以一直洗。',
        req: reqTxt(st, COST.scar, '龍的印記石'), why: !x ? noSel : !isScar ? '只能留在盾牌或盔甲上' : '', btns: [['scar', it && it.dscar ? '重洗傷痕' : '留下傷痕', st >= COST.scar]] },
      { key: 'scarStar', ico: icoTag(ICON.stone, ' data-tip-id="' + STONE + '"'), name: '傷痕升星', color: '#e2e8f0',
        desc: COST.star + ' 顆印記石升 1 星，最高 ' + COST.starMax + ' 星，每星再 −' + COST.starPct + '%（−55／60／65%）；洗龍不影響星數。',
        req: reqTxt(st, COST.star, '龍的印記石'), why: !x ? noSel : !(it && it.dscar) ? '這件還沒有龍的傷痕' : stars(it.dscarStar) >= COST.starMax ? '已經 ' + COST.starMax + ' 星' : '', btns: [['scarStar', '升 1 星', st >= COST.star]] },
      { key: 'tree', ico: icoTag(ICON.tree), name: '神樹者的讚禮（全身）', color: '#86efac',
        desc: '五種抗性（火、水、風、地、無）隨機兩種各 +10；再次賦予會重洗。',
        req: reqTxt(dc, COST.tree, '怪物鑽石卡'), note: '已登錄鑽石卡、未上鎖的怪物卡都能用。', why: !x ? noSel : !any ? '這件不能賦予' : '', btns: [['tree', it && it.tree ? '重洗讚禮' : '賦予讚禮', dc >= COST.tree]] },
      { key: 'dres', ico: icoTag(ICON.dres, ' data-tip-id="' + DRES + '"'), name: '闇龍的抵抗者（防具）', color: '#c4b5fd',
        desc: '無屬性抗性 +10。碎片只在席琳夢域鏡掉落：一般怪 0.1%、頭目必掉 1 個。',
        req: reqTxt(dr, COST.dres, '闇龍的抵抗者意志傳承碎片'), why: !x ? noSel : !isArm ? '只能賦予防具（不含飾品）' : it.dres ? '這件已經有了' : '', btns: [['dres', '傳承意志', dr >= COST.dres]] },
      { key: 'blessExW', ico: icoTag(BSCR.wpn.img, ' data-tip-id="' + BSCR.wpn.src + '"'), name: '武器祝福賦予卷軸', color: '#fde047',
        desc: '用「祝福的 對武器施法的卷軸」兌換：一階 ' + BCOST[1] + ' 張、二階 ' + BCOST[2] + ' 張、三階 ' + BCOST[3] + ' 張。',
        note: '持有：' + [1, 2, 3].map(function (l) { return BTIER[l] + ' ' + have(bsId('wpn', l)); }).join('、'),
        req: reqTxt(have(BSCR.wpn.src), BCOST[1], '祝福的 對武器施法的卷軸'), btns: [1, 2, 3].map(function (l) { return ['blessEx:wpn:' + l, '換' + BTIER[l], have(BSCR.wpn.src) >= BCOST[l]]; }) },
      { key: 'blessExA', ico: icoTag(BSCR.arm.img, ' data-tip-id="' + BSCR.arm.src + '"'), name: '防具祝福賦予卷軸', color: '#fde047',
        desc: '用「祝福的 對盔甲施法的卷軸」兌換：一階 ' + BCOST[1] + ' 張、二階 ' + BCOST[2] + ' 張、三階 ' + BCOST[3] + ' 張。',
        note: '持有：' + [1, 2, 3].map(function (l) { return BTIER[l] + ' ' + have(bsId('arm', l)); }).join('、'),
        req: reqTxt(have(BSCR.arm.src), BCOST[1], '祝福的 對盔甲施法的卷軸'), btns: [1, 2, 3].map(function (l) { return ['blessEx:arm:' + l, '換' + BTIER[l], have(BSCR.arm.src) >= BCOST[l]]; }) },
      (function () {
        var bk = d ? (d.type === 'wpn' ? 'wpn' : (d.type === 'arm' && !isAccSlot(d) ? 'arm' : null)) : null;
        var cur = it && it.bless === true ? (it.blessLv > 1 ? it.blessLv : 1) : 0;
        var hv = function (l) { return bk ? have(bsId(bk, l)) : 0; };
        return { key: 'blessApply', ico: icoTag(BSCR[bk || 'wpn'].img), name: '賦予祝福（武器、防具）', color: '#facc15',
          desc: '用祝福賦予卷軸讓選中的裝備帶上祝福：一階＝祝福的（×1）、二階＝昇華的祝福（×2）、三階＝至高的祝福（×3）。只能往上升；武器用武器卷軸、防具用防具卷軸。',
          note: bk ? '你有' + BSCR[bk].n + '卷軸：' + [1, 2, 3].map(function (l) { return BTIER[l] + ' ' + hv(l); }).join('、') : '',
          req: bk ? reqTxt(hv(1) + hv(2) + hv(3), 1, BSCR[bk].n + '祝福賦予卷軸') : '<span class="ax-req">需要祝福賦予卷軸</span>',
          why: !x ? noSel : !bk ? '飾品不能用卷軸賦予祝福（只能打怪取得）' : it.bless === 'cursed' ? '詛咒的裝備要先到象牙塔找碧恩解除詛咒' : cur >= 3 ? '已經是至高的祝福' : '',
          btns: [1, 2, 3].map(function (l) { return ['bless:' + l, '用' + BTIER[l], hv(l) >= 1 && l > cur]; }) };
      })(),
      { key: 'will', ico: icoTag(ICON.fate), name: '不屈者意志（武器）', color: '#fca5a5',
        desc: '八職業八種，可選任一種；再次賦予會換掉舊的。限一轉以上、或能進入席琳夢域鏡（Lv80）的角色。',
        note: Object.keys(WILL).map(function (k) { return '<span style="color:#fca5a5;">' + WILL[k].s + '</span>：' + WILL[k].d; }).join('<br>'),
        req: reqTxt(fc, COST.will, '不屈的命運（任何職業）'), why: !willOk(p) ? (sealed(p) ? '封印輪迴光環封住了你的意志' : '需要已經轉生，或能進入席琳夢域鏡（Lv80）') : !x ? noSel : !isW ? '只能賦予武器' : '',
        pick: '<select id="afk-ax-will-kind" aria-label="選擇意志">' + Object.keys(WILL).map(function (k) { return '<option value="' + k + '"' + (k === (it && it.will) || (!(it && it.will) && k === p.cls) ? ' selected' : '') + '>' + WILL[k].s + '</option>'; }).join('') + '</select>',
        btns: [['will', '賦予意志', fc >= COST.will]] }
    ].concat((W.__afkAxExtra || []).map(function (f) { try { return f(p, x, AXH); } catch (e) { return null; } }).filter(Boolean));
  };
  var NEED_ITEM = { mark: 1, markStar: 1, scar: 1, scarStar: 1, tree: 1, dres: 1, will: 1, blessApply: 1 };
  var renderPanel = function (box) {
    var p = P(); if (!box || !p) return;
    var x = selOf(); if (!x) ui.sel = '';
    var mats = [[SHARD, have(SHARD)], [STONE, have(STONE)], [DRES, have(DRES)]];
    var h = '<p class="ax-lore">「龍留下的每一道痕跡都還記得牠們的力量。把裝備交給我，我替你把它刻進去。」——龍紋師 ' + NPC_N + '</p>'
      + '<div class="ax-mats">'
      + mats.map(function (m) { return '<div class="ax-mat">' + itemIco(m[0], true) + '<span>' + esc(DB.items[m[0]].n) + ' <b>' + m[1].toLocaleString() + '</b></span></div>'; }).join('')
      + '<div class="ax-mat">' + icoTag(ICON.dia, '', true) + '<span>怪物鑽石卡 <b>' + diaHave().toLocaleString() + '</b></span></div>'
      + '<div class="ax-mat">' + icoTag(ICON.fate, '', true) + '<span>不屈的命運 <b>' + fates().reduce(function (n, it) { return n + cnt(it); }, 0).toLocaleString() + '</b></span></div>'
      + '</div>'
      + '<div class="ax-h">① 選擇裝備</div>'
      + '<div class="ax-filter">' + Object.keys(SLOT_KIND).map(function (k) { return '<button type="button" data-axf="' + k + '"' + (ui.filter === k ? ' class="on"' : '') + '>' + SLOT_KIND[k] + '</button>'; }).join('')
      + '<input id="afk-ax-q" type="search" placeholder="搜尋裝備名稱" aria-label="搜尋裝備名稱" value="' + esc(ui.q) + '" style="flex:1 1 140px;min-width:120px;background:#0f172a;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 8px;font-size:13px"></div>';
    var all = listAll(), lim = PAGE * (1 + ui.more), list = all.slice(0, lim);
    h += '<div class="ax-list">' + (list.length ? list.map(function (c) {
      var tags = affixLines(c.it, c.d).length;
      return '<div class="ax-eq' + (c.ref === ui.sel ? ' on' : '') + '" data-axsel="' + esc(c.ref) + '">' + eqIco(c)
        + '<div style="min-width:0"><div>' + fullName(c.it) + '</div><div class="ax-where">' + esc(c.where) + (tags ? '　・已有 ' + tags + ' 種詞綴' : '') + '</div></div></div>';
    }).join('') + (all.length > lim ? '<div class="ax-eq ax-where" data-axmore="1" style="justify-content:center;color:#fde68a">還有 ' + (all.length - lim).toLocaleString() + ' 件，點這裡多顯示 ' + PAGE + ' 件，或用搜尋縮小範圍</div>' : '') : '<div class="ax-eq ax-where">沒有符合的裝備（上鎖的物品不會列出）。</div>') + '</div>';
    if (x) {
      var L = affixLines(x.it, x.d);
      h += '<div class="ax-h">已選擇</div><div class="ax-sel">' + eqIco(x) + '<div style="min-width:0"><div>' + fullName(x.it) + '</div><div class="ax-where">' + esc(x.where) + '</div>'
        + (L.length ? '<ul>' + L.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' : '<div class="ax-note">目前沒有詞綴。</div>') + '</div></div>';
    }
    h += '<div class="ax-err" id="afk-ax-err">' + esc(ui.err) + '</div><div class="ax-msg">' + ui.msg + '</div>';
    h += '<div class="ax-h">② 賦予與升級</div>';
    services(p, x).forEach(function (s) {
      var blocked = !!s.why;
      h += '<div class="ax-row' + (blocked && NEED_ITEM[s.key] ? ' off' : '') + '"><div class="ax-main">' + s.ico
        + '<div style="min-width:0"><div class="ax-name" style="color:' + s.color + ';">' + s.name + '</div>'
        + '<div class="ax-desc">' + s.desc + '</div>'
        + (s.note ? '<div class="ax-note">' + s.note + '</div>' : '')
        + '<div>' + s.req + (s.why ? '　<span class="no" style="font-size:12px">' + esc(s.why) + '</span>' : '') + '</div></div></div>'
        + '<div class="ax-act">' + (s.pick || '') + s.btns.map(function (b) { return '<button type="button" data-ax="' + b[0] + '"' + (b[2] && !blocked ? '' : ' disabled') + '>' + b[1] + '</button>'; }).join('') + '</div></div>';
    });
    h += '<div class="ax-note">賦予成功率都是 100%。武器、防具的祝福可以用祝福賦予卷軸在這裡賦予；飾品的祝福只能打怪取得。遠古系的三個階段（原名／' + ANC_T[2].p + '／' + ANC_T[3].p + '）只能打怪取得（席琳夢域鏡中萊利的輔佐官換到的裝備也必帶遠古系），不能在這裡升級。</div>';
    var top = box.scrollTop, lst = box.querySelector('.ax-list'), lt = lst ? lst.scrollTop : 0;
    box.innerHTML = h;
    box.scrollTop = top; var nl = box.querySelector('.ax-list'); if (nl) nl.scrollTop = lt;
  };
  var bindPanel = function (host) {
    host.addEventListener('click', function (ev) {
      var f = ev.target.closest('[data-axf]'); if (f) { ui.filter = f.dataset.axf; ui.err = ''; ui.more = 0; renderPanel(host); return; }
      if (ev.target.closest('[data-axmore]')) { ui.more++; renderPanel(host); return; }
      var s = ev.target.closest('[data-axsel]'); if (s) { ui.sel = s.dataset.axsel; ui.err = ''; ui.msg = ''; renderPanel(host); return; }
      var b = ev.target.closest('button[data-ax]'); if (!b || b.disabled) return;
      var a = b.dataset.ax, err = null, v = function (id) { var el = host.querySelector('#' + id); return el ? el.value : ''; };
      var before = ui.sel; lastRef = ''; lastMsg = '';
      if (a === 'exchange' || a === 'exchangeAll') err = ACT.exchange(a === 'exchangeAll');
      else if (a === 'stone' || a === 'stoneAll') err = ACT.stone(a === 'stoneAll');
      else if (a === 'mark') err = ACT.mark(before);
      else if (a === 'markStar') err = ACT.star(before, 'mark');
      else if (a === 'scar') err = ACT.scar(before);
      else if (a === 'scarStar') err = ACT.star(before, 'scar');
      else if (a === 'tree') err = ACT.tree(before);
      else if (a === 'dres') err = ACT.dres(before);
      else if (a === 'will') err = ACT.will(before, v('afk-ax-will-kind'));
      else if (a.indexOf('blessEx:') === 0) { var bp = a.split(':'); err = ACT.blessEx(bp[1], Number(bp[2])); }
      else if (a.indexOf('bless:') === 0) err = ACT.bless(before, Number(a.split(':')[1]));
      else if (a.indexOf('ext:') === 0) { var ep = a.split(':'), fn = (W.__afkAxAct || {})[ep[1]]; err = fn ? fn(before, ep.slice(2).join(':'), AXH, v) : '找不到這個項目。'; }
      ui.err = err || ''; ui.msg = err ? '' : (lastMsg || '');
      // 背包裡一疊拿出一件來賦予時 uid 會變：改成指向剛處理的那件
      if (!err && lastRef) ui.sel = lastRef;
      renderPanel(host);
    });
  };
  var qTimer = 0;
  var bindSearch = function (host) {
    host.addEventListener('input', function (ev) {
      if (!ev.target || ev.target.id !== 'afk-ax-q') return;
      ui.q = ev.target.value; ui.more = 0; clearTimeout(qTimer);
      qTimer = setTimeout(function () { renderPanel(host); var q = host.querySelector('#afk-ax-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} } }, 250);
    });
  };
  var embed = function (div) {
    if (!div) return; css();
    var host = document.createElement('div'); host.className = 'afk-ax'; host.id = 'afk-ax-embed';
    div.innerHTML = ''; div.appendChild(host);
    ui.err = ''; ui.msg = '';
    renderPanel(host); bindPanel(host); bindSearch(host);
  };
  if (typeof W.interactNPC === 'function') {
    var oNpc = W.interactNPC;
    W.interactNPC = function (npcId) {
      if (npcId === NPC_ID && typeof W.openTownFloatWindow === 'function') {
        try { W.openTownFloatWindow(NPC_N, '龍紋賦予', function (div) { embed(div); }); return; } catch (e) { console.warn('[AFK-affix-plus] npc', e); }
      }
      var r = oNpc.apply(this, arguments);
      if (npcId === NPC_ID) { try { embed(document.getElementById('interaction-content')); } catch (e) { console.warn('[AFK-affix-plus] npc', e); } }
      return r;
    };
  }
  W.__afkAffixPlus.render = renderPanel;
  W.__afkAffixPlus.ancTierName = ancTierName;
  W.__afkAffixPlus.ui = ui;
  W.__afkAffixPlus.NPC_ID = NPC_ID;
  console.log('[AFK-affix-plus] 已啟用：祝福／遠古三階（只能打怪取得）、龍紋師艾格尼絲：不屈者意志、龍的印記／傷痕、神樹者的讚禮、闇龍的抵抗者');
})();
