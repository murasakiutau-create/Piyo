'use strict';
  // =====================================================================
  //  🏚 HORROR HOUSE：8F　洋館を進む 短編ホラー。¥100・LIFEなし・戦わない・隠れてやりすごす
  //   玄関 → 廊下 → 分岐(書斎/食堂) → 廊下 → 分岐(寝室/人形部屋) → 廊下 → 裏口。調整値・イベント表は CONFIG.horror
  //   怪異：WOMAN(赤いハイヒール／追ってくる)・DOLL(茶色いブーツ／見ていない間に動く)・TALL MAN(黒い革靴／横切る)・BOY(裸足／誘う)
  //   素材：assets/horror/<name>.webp（立ち絵＝通常／_x＝異変）と feet_<name>_walk / _stop（隠れ視点の足元）。同名で差し替え可
  //   タイマーは「update時計」だけ（setTimeout/Interval 不使用）→ 退出・捕獲・脱出で全部止まる
  // =====================================================================
  const HHC = CONFIG.horror;
  const HH_MACHINE = { machineId: 'hh_horror', machineName: 'HORROR HOUSE', label: 'HORROR HOUSE', isUnlocked: true, gameType: 'horror', hh: true };
  const HH_VX = 8; const HH_VY = 44; const HH_VH = 232; const hhVW = () => W - 16;
  const HH = { phase: 'intro', t: 0, clock: 0, node: 'hall', view: 'main', q: [], say: '', sayUntil: 0, ev: null, hid: null, trans: null, darkA: 0, darkT: 0, enc: 0, hideDone: false, womanSeen: false, doll: { stage: 0, looks: 0 }, mirror: 0, boy: null, caught: null, end: null, door: 0, amb: 3, paying: false, result: null, sub: null, dev: { god: false, force: null }, grain: [], fadeIn: 0 };
  const HH_ENT = ['woman', 'doll', 'man', 'boy']; const HH_K = { woman: 1, doll: 0.56, man: 1.3, boy: 0.8 };
  const HH_NAMES = []; HH_ENT.forEach((n) => { HH_NAMES.push(n, n + '_x', 'feet_' + n + '_walk', 'feet_' + n + '_stop'); });
  const HH_IMG = {}; HH_NAMES.forEach((n) => { const im = new Image(); im.onerror = () => { im.bad = true; }; im.src = 'assets/horror/' + n + '.webp'; HH_IMG[n] = im; });
  const hhImg = (n) => { const im = HH_IMG[n]; return im && im.complete && im.naturalWidth ? im : null; };
  const hhR = (a, b) => a + Math.random() * (b - a); const hhPick1 = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hhMix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a); const y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const hhAt = (d, fn) => { HH.q.push({ at: HH.clock + d, fn }); };

  // ---- 部屋データ（洋館の地図）----
  const HHR = {
    hall: { name: 'ENTRANCE HALL', paint: 'hall', ex: [{ label: 'すすむ', to: 'corrA' }], look: ['とけいが ゆっくり ときを きざんでいる…', 'ふりかえると、げんかんの とびらは もう あかない。', 'ほこりの においが する。'] },
    corrA: { name: 'LONG CORRIDOR', paint: 'corrA', corr: true, ex: [{ label: 'ひだりへ', to: 'study', side: 0 }, { label: 'みぎへ', to: 'dining', side: 1 }], look: ['ながい ろうか。おくの まどから つきあかり。', 'ゆかが きしむ…。'] },
    study: { name: 'STUDY', paint: 'study', hide: [{ k: 'desk', label: 'つくえの した' }], ex: [{ label: 'ろうかへ でる', to: 'corrB' }], look: ['ふるい ほんが ならんでいる。ほこりだらけ。', 'つくえの うえに、とまった とけい。', 'まどの そとで かぜが なっている。'] },
    dining: { name: 'DINING ROOM', paint: 'dining', hide: [{ k: 'curtain', label: 'カーテンの うら' }], ex: [{ label: 'ろうかへ でる', to: 'corrB' }], look: ['ながい テーブル。ろうそくが ひとつ、ともっている。', 'いすが すこし、ひかれている…。'] },
    corrB: { name: 'SECOND CORRIDOR', paint: 'corrB', corr: true, ex: [{ label: 'ひだりへ', to: 'bedroom', side: 0 }, { label: 'みぎへ', to: 'doll', side: 1 }], look: ['かべの かがみに、じぶんが うつっている。', 'つめたい くうき。'] },
    bedroom: { name: 'BEDROOM', paint: 'bedroom', hide: [{ k: 'bed', label: 'ベッドの した' }, { k: 'closet', label: 'クローゼット' }], ex: [{ label: 'ろうかへ でる', to: 'corrC' }], look: ['しわの ない シーツ。だれかが ねていた あと。', 'まどの カーテンが かすかに ゆれている。'] },
    doll: { name: 'DOLL ROOM', paint: 'doll', ex: [{ label: 'ろうかへ でる', to: 'corrC' }], look: [] },
    corrC: { name: 'BACK CORRIDOR', paint: 'corrC', corr: true, ex: [{ label: 'すすむ', to: 'back' }], look: ['おくに ひかりが みえる…でぐち？', 'もうすこし。'] },
    back: { name: 'BACK DOOR', paint: 'back', ex: [], look: [] }
  };

  // ---- 開始・終了 ----
  function hhInsert() {
    if (HH.paying || HH.phase === 'play') return; if (P_().money < HHC.playCost) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    HH.paying = true; chargeYen(HHC.playCost); writeSave(); beep(220, 0, 0.2, 0.05, 'sine', 160); hhStart(); HH.paying = false;
  }
  function hhStart() {
    Object.assign(HH, { phase: 'play', t: 0, q: [], say: '', sayUntil: 0, ev: null, hid: null, trans: null, darkA: 0, darkT: 0, enc: 0, hideDone: false, womanSeen: false, doll: { stage: 0, looks: 0 }, mirror: 0, boy: null, caught: null, end: null, door: 0, amb: 3, result: null, sub: null, view: 'main', fadeIn: 1 });
    hhEnter('hall');
  }
  function hhFinish(escaped) {
    if (HH.phase !== 'play') return; HH.q = []; HH.ev = null; HH.hid = null; HH.trans = null; HH.end = null; HH.caught = null; HH.sub = null;
    HH.result = { escaped, time: Math.floor(HH.t), enc: HH.enc }; HH.phase = 'result'; HH.t = 0; HH.sayUntil = 0;
  }
  function hhCaught(ent) {
    if (HH.caught || HH.phase !== 'play') return; if (HH.dev.god) { hhSay('（つかまる はずだった…）', 2); HH.ev = null; return; }
    HH.caught = { ent, t: 0 }; HH.q = []; HH.sayUntil = 0; HH.ev = null; HH.hid = null; HH.view = 'main'; HH.darkA = 0; HH.darkT = 0;
    beep(70, 0, 0.7, 0.12, 'sawtooth', 40); noise(0.5, 0.1); beep(1200, 0, 0.5, 0.05, 'square', 300);
  }
  function hhSay(html, dur) { HH.say = html; HH.sayUntil = HH.clock + (dur || 2.8); }

  // ---- 足音（誰か分かる音）----
  function hhStepSnd(e, v) {
    v = Math.max(0.05, Math.min(1, v));
    if (e === 'woman') { noise(0.03, 0.05 * v); beep(2100, 0, 0.035, 0.07 * v, 'square', 1400); beep(880, 0.012, 0.05, 0.05 * v, 'triangle'); }
    else if (e === 'doll') { beep(1500, 0, 0.025, 0.05 * v, 'square', 1100); noise(0.02, 0.03 * v); }
    else if (e === 'man') { beep(105, 0, 0.18, 0.13 * v, 'sine', 55); noise(0.09, 0.07 * v); }
    else { noise(0.07, 0.045 * v); beep(250, 0, 0.09, 0.035 * v, 'sine', 150); }
  }
  const hhAmb = {
    wind() { noise(1.4, 0.014); beep(180, 0, 1.4, 0.012, 'sine', 140); }, creak() { beep(95, 0, 0.45, 0.03, 'sawtooth', 70); noise(0.2, 0.015); },
    tick() { beep(900, 0, 0.02, 0.035, 'square'); beep(700, 0.5, 0.02, 0.03, 'square'); beep(900, 1, 0.02, 0.035, 'square'); }, rattle() { noise(0.1, 0.07); beep(160, 0, 0.1, 0.06, 'square', 110); noise(0.1, 0.06); }
  };

  // ---- 部屋に入る ----
  function hhPoolFor(id) {
    if (HH.dev.force) { const f = HH.dev.force; HH.dev.force = null; return f; }
    const bs = HH.boy; if (bs && bs.pending && (id === 'study' || id === 'dining' || id === 'bedroom' || id === 'doll')) { const side = (id === 'study' || id === 'bedroom') ? 0 : 1; if (bs.side === side) { bs.pending = false; return bs.guide ? 'none' : 'hideWoman'; } }
    if (id === 'bedroom' && !HH.hideDone) return 'hideWoman';
    if (id === 'corrC' && !HH.womanSeen && !HH.hideDone) return 'corrWoman';
    if (id === 'corrC' && HH.doll.stage >= 2) return 'corrDoll';
    const pool = HHC.pools[id] || [['none', 1]]; let tot = 0; pool.forEach((p) => { tot += p[1]; }); let r = Math.random() * tot; for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; } return 'none';
  }
  function hhEnter(id) {
    HH.node = id; HH.view = 'main'; HH.hid = null; HH.sub = null; HH.q = []; HH.ev = null; HH.darkA = 0; HH.darkT = 0; HH.sayUntil = 0; const evId = hhPoolFor(id);
    const dw = HHC.eventDwell; const ev = { id: evId, state: 'wait', t: 0, dwell: hhR(dw[0], dw[1]), stepN: 0 };
    if (evId.startsWith('hide')) { ev.type = 'hide'; ev.ent = { hideWoman: 'woman', hideMan: 'man', hideBoy: 'boy', hideDoll: 'doll' }[evId]; HH.ev = ev; }
    else if (evId === 'fake') { ev.type = 'fake'; HH.ev = ev; }
    else if (evId.startsWith('corr')) { ev.type = evId; ev.ent = { corrWoman: 'woman', corrMan: 'man', corrBoy: 'boy', corrDoll: 'doll' }[evId]; ev.dist = 3; HH.ev = ev; if (evId === 'corrMan') ev.dwell = hhR(3, 5); }
    if (id === 'hall') { hhSay('ふるい やかたの なか。<br>だれも いない…', 3.4); beep(110, 0, 0.9, 0.04, 'sawtooth', 80); hhAt(0.4, () => { hhAmb.tick(); }); }
    if (id === 'doll') { HH.ev = null; if (HH.doll.stage === 0) hhSay('へやの まんなかに、ふるい にんぎょうが すわっている。', 3.4); }
    if (id === 'back') { HH.ev = null; hhSay('でぐちだ…！', 2.2); }
    HH.fadeIn = 1;
  }
  function hhGo(to) {
    if (HH.trans || HH.caught || HH.end) return; HH.trans = { t: 0, dur: 1.5, to, did: false }; hhStepSnd('boy', 0.5); hhAt(0.35, () => hhStepSnd('boy', 0.5)); hhAt(0.7, () => hhStepSnd('boy', 0.4));
  }
  // ---- 隠れる ----
  function hhHideNow(spot) {
    if (HH.phase !== 'play' || HH.trans || HH.caught || HH.hid || HH.view !== 'main') return; const ev = HH.ev; if (ev && ev.type === 'hide' && ev.state !== 'wait' && ev.state !== 'warn') return;
    HH.hid = { spot, t: 0 }; HH.view = 'hide'; HH.sayUntil = 0; noise(0.18, 0.04); beep(140, 0, 0.18, 0.03, 'sine', 90);
  }
  const hhCanUnhide = () => { if (!HH.hid) return false; const ev = HH.ev; if (!ev || ev.state === 'done') return true; if (ev.state === 'wait' && HH.hid.t >= HHC.hideMin) return true; return false; };
  function hhUnhide() { if (!hhCanUnhide()) return; HH.hid = null; HH.view = 'main'; noise(0.15, 0.04); beep(120, 0, 0.2, 0.03, 'sine', 160); if (HH.ev && HH.ev.state === 'done') HH.ev = null; }

  // ---- 操作（ボタン）----
  function hhButtons() {
    if (HH.phase !== 'play' || HH.trans || HH.caught || HH.end || HH.sub) return []; const R = HHR[HH.node]; const ev = HH.ev; const out = [];
    if (HH.view === 'hide') { if (hhCanUnhide()) out.push({ label: 'でる', act: 'unhide' }); return out; }
    const locked = ev && ev.type === 'hide' && (ev.state === 'warn' || ev.state === 'pass' || ev.state === 'look');
    if (HH.node === 'back') { out.push({ label: HH.door >= 2 ? 'とびらを あける！' : 'とびらを あける', act: 'door' }); return out; }
    if (HH.node === 'doll') { out.push({ label: 'たなを みる', act: 'sub:shelf' }, { label: 'まどを みる', act: 'sub:window' }); R.ex.forEach((x) => out.push({ label: x.label, act: 'go:' + x.to })); return out; }
    if (R.look && R.look.length && !locked && !(R.hide && R.hide.length > 1)) out.push({ label: 'しらべる', act: 'look' });
    if (R.hide) R.hide.forEach((h) => out.push({ label: h.label, act: 'hide:' + h.k, cls: 'hh-hide' }));
    if (HH.node === 'bedroom' && !locked) out.push({ label: 'かがみを みる', act: 'sub:mirror' });
    if (!locked) R.ex.forEach((x) => out.push({ label: x.label, act: 'go:' + x.to }));
    return out;
  }
  function hhAct(a) {
    if (HH.phase !== 'play' || HH.trans || HH.caught || HH.end || HH.sub) return;
    if (a === 'unhide') hhUnhide();
    else if (a === 'look') { const L = HHR[HH.node].look; hhSay(hhPick1(L), 3); beep(300, 0, 0.05, 0.02, 'sine'); if (HH.node === 'hall') hhAmb.tick(); }
    else if (a.startsWith('hide:')) hhHideNow(a.slice(5));
    else if (a.startsWith('go:')) hhGo(a.slice(3));
    else if (a.startsWith('sub:')) hhSub(a.slice(4));
    else if (a === 'door') hhDoor();
  }
  function hhSub(k) {
    HH.sub = { k, t: 0, dur: k === 'mirror' ? 4.2 : 2.6 }; HH.sayUntil = 0;
    if (k === 'mirror') { HH.sub.m = HH.mirror++; beep(300, 0, 0.1, 0.02, 'sine'); }
    else { const d = HH.doll; d.looks++; hhAt(0.3, () => { beep(260, 0, 0.1, 0.02, 'sine'); }); hhSay(k === 'shelf' ? 'たなに ふるい おもちゃが ならんでいる…' : 'まどの そとは まっくら。つきが ぼんやり…', 2.3); }
  }
  function hhSubEnd() {
    const s = HH.sub; HH.sub = null; if (!s) return;
    if (s.k === 'mirror') { if (s.m === 1) hhSay('ふりかえる。…だれも いない。', 3); else if (s.m === 0) hhSay('うつっているのは、じぶんだけ。', 2.4); else hhSay('…なにも うつっていない。', 2.4); return; }
    const d = HH.doll;
    if (d.stage === 0) { d.stage = 1; hhSay('…にんぎょうが、こっちを むいている？', 3.2); beep(95, 0, 0.5, 0.05, 'sawtooth', 70); }
    else if (d.stage === 1) { d.stage = 2; HH.enc++; hhSay('いすが…からっぽだ。', 3.2); hhStepSnd('doll', 0.5); hhAt(0.4, () => hhStepSnd('doll', 0.4)); hhAt(0.8, () => hhStepSnd('doll', 0.3)); }
  }
  function hhDoor() {
    const n = ++HH.door;
    if (n === 1) { hhSay('カギは あいている。でも…かたい。', 2.6); noise(0.2, 0.06); beep(180, 0, 0.1, 0.05, 'square'); hhAt(1.6, () => { hhStepSnd('woman', 0.35); }); }
    else if (n === 2) { hhSay('あと すこし…！', 2.2); noise(0.25, 0.07); hhStepSnd('woman', 0.55); hhAt(0.95, () => hhStepSnd('woman', 0.75)); }
    else { HH.end = { t: 0, st: 'open' }; HH.sayUntil = 0; beep(120, 0, 0.9, 0.06, 'sawtooth', 200); noise(0.5, 0.05); }
  }

  // ---- 更新 ----
  function hhUpdate(dt) {
    dt = Math.min(dt, 0.05); HH.clock += dt; HH.t += dt; if (HH.phase !== 'play') return;
    HH.fadeIn = Math.max(0, HH.fadeIn - dt * 1.4);
    if (HH.caught) { HH.caught.t += dt; if (HH.caught.t > 4.2) hhFinish(false); HH.q = []; return; }
    for (let i = 0; i < HH.q.length; i++) { const it = HH.q[i]; if (it && HH.clock >= it.at) { HH.q.splice(i, 1); i--; it.fn(); } }
    HH.darkA += (HH.darkT - HH.darkA) * (1 - Math.exp(-dt * 7));
    if (HH.trans) { const T = HH.trans; T.t += dt; if (!T.did && T.t >= T.dur * 0.5) { T.did = true; hhEnter(T.to); } if (T.t >= T.dur) HH.trans = null; return; }
    if (HH.end) { hhEndUpdate(dt); return; }
    if (HH.sub) { HH.sub.t += dt; const s = HH.sub; if (s.k === 'mirror' && s.m === 1 && s.t > 1.6 && !s.f) { s.f = 1; HH.enc++; beep(70, 0, 0.7, 0.05, 'sawtooth', 50); } if (s.t >= s.dur) hhSubEnd(); }
    if (HH.hid) HH.hid.t += dt;
    hhEvUpdate(dt);
    HH.amb -= dt; if (HH.amb <= 0) { HH.amb = hhR(6, 11); const quiet = HH.ev && (HH.ev.state === 'warn' || HH.ev.state === 'pass' || HH.ev.state === 'stalk'); if (!quiet) { const k = hhPick1(HH.node === 'hall' ? ['wind', 'tick', 'creak'] : ['wind', 'creak', 'wind']); hhAmb[k](); } }
  }
  function hhEvUpdate(dt) {
    const ev = HH.ev; if (!ev) return; const C = HHC; ev.t += dt;
    if (ev.type === 'hide') {
      const st = C.steps[ev.ent];
      if (ev.state === 'wait') { if (ev.t >= ev.dwell) { ev.state = 'warn'; ev.t = 0; ev.stepN = 0; HH.enc++; HH.hideDone = true; if (ev.ent === 'woman') HH.womanSeen = true; } }
      else if (ev.state === 'warn') {
        const gap = st.gap / C.entityMoveSpeed; while (ev.stepN < st.n && ev.t >= ev.stepN * gap) { const v = 0.12 + 0.88 * (ev.stepN / (st.n - 1)); if (!(ev.ent === 'boy' && ev.stepN >= st.n - 2)) hhStepSnd(ev.ent, v); ev.stepN++; }
        if (ev.t >= st.n * gap + C.hideTimingWindow) { if (HH.hid) { ev.state = 'pass'; ev.t = 0; ev.fx = 0; ev.rare = HH.hid.spot === 'closet' && ev.ent === 'woman' && Math.random() < C.rareScareRate; beep(90, 0, 0.5, 0.03, 'sawtooth', 70); noise(0.2, 0.03); }
          else if (ev.ent === 'boy') { ev.state = 'look'; ev.t = 0; HH.sayUntil = 0; } else hhCaught(ev.ent); }
      } else if (ev.state === 'look') { if (ev.t > 3.4) { ev.state = 'done'; ev.t = 0; } }
      else if (ev.state === 'pass') hhPassUpdate(ev);
    } else if (ev.type === 'fake') {
      if (ev.state === 'wait' && ev.t >= ev.dwell) { ev.state = 'rattled'; ev.t = 0; hhAmb.rattle(); }
      else if (ev.state === 'rattled' && ev.t > 5.5) { ev.state = 'done'; if (HH.hid) hhSay('…かぜの おと だった。', 3); }
    } else if (ev.type === 'corrWoman') {
      if (ev.state === 'wait' && ev.t >= ev.dwell) { ev.state = 'stalk'; ev.t = 0; ev.dist = 3; ev.cyc = 0; ev.lit = false; HH.enc++; HH.womanSeen = true; HH.darkT = 0.93; hhAt(0.2, () => hhStepSnd('woman', 0.2)); hhAt(0.8, () => { ev.lit = true; HH.darkT = 0; }); }
      else if (ev.state === 'stalk') {
        if (ev.t >= 2.8) { ev.t = 0; HH.darkT = 0.93; ev.lit = false; hhAt(0.15, () => hhStepSnd('woman', 0.4 + 0.2 * (3 - ev.dist))); hhAt(0.5, () => hhStepSnd('woman', 0.5 + 0.2 * (3 - ev.dist))); hhAt(0.85, () => { ev.dist--; if (ev.dist <= 0) { hhCaught('woman'); return; } ev.lit = true; HH.darkT = 0; }); }
      }
    } else if (ev.type === 'corrMan') {
      if (ev.state === 'wait' && ev.t >= ev.dwell) { ev.state = 'cross'; ev.t = 0; HH.enc++; hhStepSnd('man', 0.5); hhAt(1.7, () => hhStepSnd('man', 0.45)); }
      else if (ev.state === 'cross' && ev.t > 3.6) { ev.state = 'done'; }
    } else if (ev.type === 'corrBoy') {
      if (ev.state === 'wait' && ev.t >= ev.dwell) { ev.state = 'stand'; ev.t = 0; HH.enc++; }
      else if (ev.state === 'stand' && ev.t > 3.2) { ev.state = 'walk'; ev.t = 0; ev.side = Math.random() < 0.5 ? 0 : 1; HH.boy = { side: ev.side, guide: Math.random() < 0.5, pending: true }; for (let i = 0; i < 4; i++) hhAt(i * 0.55, () => hhStepSnd('boy', 0.55 - i * 0.1)); }
      else if (ev.state === 'walk' && ev.t > 2.4) ev.state = 'done';
    } else if (ev.type === 'corrDoll') {
      if (ev.state === 'wait' && ev.t >= ev.dwell) { ev.state = 'scurry'; ev.t = 0; HH.enc++; for (let i = 0; i < 8; i++) hhAt(i * 0.3, () => hhStepSnd('doll', 0.6 - i * 0.05)); }
      else if (ev.state === 'scurry' && ev.t > 2.8) ev.state = 'done';
    }
  }
  // 隠れている目の前を 通過する
  function hhPassUpdate(ev) {
    const e = ev.ent; const T = { in: e === 'man' ? 3.4 : 2.6, stop: e === 'man' ? 4.2 : 3.2, out: e === 'man' ? 3.4 : 2.6, quiet: 3.4 }; const cad = { woman: 0.8, doll: 0.4, man: 1.7, boy: 0.85 }[e];
    if (ev.rare) { T.face = 4.2; }
    const a = T.in; const b = a + T.stop; const f = b + (T.face || 0); const c = f + T.out; const d = c + T.quiet; const t = ev.t;
    ev.ph = t < a ? 'in' : t < b ? 'stop' : t < f ? 'face' : t < c ? 'out' : 'quiet';
    if (ev.ph === 'in' || ev.ph === 'out') { const u = ev.ph === 'in' ? t / a : (t - f) / T.out; const prox = ev.ph === 'in' ? u : 1 - u; if (t >= (ev.nextStep || 0)) { ev.nextStep = t + cad; if (!(e === 'boy' && ev.ph === 'in' && u > 0.55)) hhStepSnd(e, 0.25 + 0.75 * prox); ev.frame = (ev.frame | 0) ^ 1; } }
    ev.u = ev.ph === 'in' ? t / a : ev.ph === 'out' ? (t - f) / T.out : ev.ph === 'face' ? (t - b) / T.face : 0;
    if (ev.rare && ev.ph === 'face' && !ev.fs) { ev.fs = 1; HH.enc++; beep(60, 0, 1.4, 0.05, 'sawtooth', 45); }
    if (t >= d) { ev.state = 'done'; ev.t = 0; }
  }
  // ---- ラスト ----
  function hhEndUpdate(dt) {
    const E = HH.end; E.t += dt;
    if (E.st === 'open') { if (E.t > 0.9 && !E.s1) { E.s1 = 1; hhStepSnd('woman', 0.8); } if (E.t > 1.7) { E.st = 'out'; E.t = 0; beep(320, 0, 0.25, 0.05, 'sine', 500); } }
    else if (E.st === 'out') { if (E.t > 2.2) { E.st = 'shut'; E.t = 0; noise(0.3, 0.1); beep(70, 0, 0.5, 0.12, 'sine', 45); } }
    else if (E.st === 'shut') { if (E.t > 2.6) { E.st = 'esc'; E.t = 0; beep(523, 0, 0.18, 0.04, 'triangle'); beep(659, 0.18, 0.18, 0.04, 'triangle'); beep(784, 0.36, 0.5, 0.04, 'triangle'); } }
    else if (E.st === 'esc') { if (E.t > 3.2) { E.st = 'boy'; E.t = 0; } }
    else if (E.st === 'boy') { if (E.t > 3.6) { E.st = 'fade'; E.t = 0; } }
    else if (E.st === 'fade') { if (E.t > 1.6) hhFinish(true); }
  }

  // =====================================================================
  //  背景ペイント（キャッシュ）
  // =====================================================================
  const HH_CACHE = {};
  const hhK = (g) => ({ R: (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }, Pl: (p, c) => { g.fillStyle = c; g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); }, L: (x0, y0, x1, y1, c) => { g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }, G: (x, y, r, c0) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } });
  const hhRng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  function hhPaintCorr(g, VW, VH, o) {
    const { R, Pl, L, G } = hhK(g); const vx = VW / 2; const vy = VH * 0.46; const Z = 5; const rng = hhRng(o.seed || 7);
    const WL = (z) => vx - VW / 2 / z; const WR = (z) => vx + VW / 2 / z; const CY = (z) => vy - vy / z; const FY = (z) => vy + (VH - vy) / z; const wx = (s, z) => (s ? WR(z) : WL(z)); const wy = (z, v) => CY(z) + (FY(z) - CY(z)) * v;
    R(0, 0, VW, VH, '#06050a'); Pl([[0, VH], [VW, VH], [WR(Z), FY(Z)], [WL(Z), FY(Z)]], '#2c1d1c'); Pl([[0, 0], [VW, 0], [WR(Z), CY(Z)], [WL(Z), CY(Z)]], '#100d16');
    for (let z = 1.12; z < Z; z *= 1.13) L(WL(z), FY(z) + 0.5, WR(z), FY(z) + 0.5, '#190f0f');
    for (let f = -1; f <= 1.01; f += 0.25) L(vx + f * VW / 2, VH, vx + f * VW / 2 / Z, FY(Z), '#1b1111');
    Pl([[vx - VW * 0.17, VH], [vx + VW * 0.17, VH], [vx + VW * 0.17 / Z, FY(Z)], [vx - VW * 0.17 / Z, FY(Z)]], '#3a1119'); L(vx - VW * 0.15, VH, vx - VW * 0.15 / Z, FY(Z), '#7a5a28'); L(vx + VW * 0.15, VH, vx + VW * 0.15 / Z, FY(Z), '#7a5a28');
    const N = 26; for (let k = 0; k < N; k++) { const z0 = 1 + k * (Z - 1) / N; const z1 = 1 + (k + 1) * (Z - 1) / N; const dk = Math.min(0.78, (z0 - 1) / (Z - 1) * 0.78); const c1 = hhMix(k % 2 ? '#3a2d48' : '#2e2339', '#000000', dk); const c2 = hhMix('#2a1a14', '#000000', dk);
      for (let s = 0; s < 2; s++) { Pl([[wx(s, z0), CY(z0)], [wx(s, z1), CY(z1)], [wx(s, z1), wy(z1, 0.64)], [wx(s, z0), wy(z0, 0.64)]], c1); Pl([[wx(s, z0), wy(z0, 0.64)], [wx(s, z1), wy(z1, 0.64)], [wx(s, z1), FY(z1)], [wx(s, z0), FY(z0)]], c2); } }
    for (let s = 0; s < 2; s++) { g.strokeStyle = '#5a4126'; g.beginPath(); g.moveTo(wx(s, 1), wy(1, 0.64)); g.lineTo(wx(s, Z), wy(Z, 0.64)); g.stroke(); }
    (o.pics || []).forEach((p) => { const s = p.s; Pl([[wx(s, p.z0), wy(p.z0, 0.2)], [wx(s, p.z1), wy(p.z1, 0.2)], [wx(s, p.z1), wy(p.z1, 0.5)], [wx(s, p.z0), wy(p.z0, 0.5)]], '#5b4428'); const i0 = p.z0 + (p.z1 - p.z0) * 0.12; const i1 = p.z1 - (p.z1 - p.z0) * 0.12; Pl([[wx(s, i0), wy(i0, 0.25)], [wx(s, i1), wy(i1, 0.25)], [wx(s, i1), wy(i1, 0.45)], [wx(s, i0), wy(i0, 0.45)]], '#14101a'); });
    (o.doors || []).forEach((d) => { const s = d.s; Pl([[wx(s, d.z0), wy(d.z0, 0.08)], [wx(s, d.z1), wy(d.z1, 0.08)], [wx(s, d.z1), FY(d.z1)], [wx(s, d.z0), FY(d.z0)]], '#3b2514'); const i0 = d.z0 + (d.z1 - d.z0) * 0.1; const i1 = d.z1 - (d.z1 - d.z0) * 0.1; Pl([[wx(s, i0), wy(i0, 0.14)], [wx(s, i1), wy(i1, 0.14)], [wx(s, i1), wy(i1, 0.97)], [wx(s, i0), wy(i0, 0.97)]], '#50341f');
      const kz = s ? d.z0 + (d.z1 - d.z0) * 0.18 : d.z0 + (d.z1 - d.z0) * 0.82; R(wx(s, kz) - 1, wy(kz, 0.58), 2, 2, '#d8b060'); if (d.lit) { Pl([[wx(s, i0), wy(i0, 0.95)], [wx(s, i1), wy(i1, 0.95)], [wx(s, i1), wy(i1, 0.99)], [wx(s, i0), wy(i0, 0.99)]], '#c89a58'); } });
    if (o.mirror) { const m = o.mirror; const s = m.s; Pl([[wx(s, m.z0), wy(m.z0, 0.16)], [wx(s, m.z1), wy(m.z1, 0.16)], [wx(s, m.z1), wy(m.z1, 0.6)], [wx(s, m.z0), wy(m.z0, 0.6)]], '#7a5a30'); const i0 = m.z0 + (m.z1 - m.z0) * 0.1; const i1 = m.z1 - (m.z1 - m.z0) * 0.1; Pl([[wx(s, i0), wy(i0, 0.2)], [wx(s, i1), wy(i1, 0.2)], [wx(s, i1), wy(i1, 0.56)], [wx(s, i0), wy(i0, 0.56)]], '#5c6a7c'); Pl([[wx(s, i0), wy(i0, 0.36)], [wx(s, i1), wy(i1, 0.28)], [wx(s, i1), wy(i1, 0.3)], [wx(s, i0), wy(i0, 0.38)]], '#7c8c9e'); }
    const ex = WL(Z); const ey = CY(Z); const ew = WR(Z) - WL(Z); const eh = FY(Z) - CY(Z);
    if (o.end === 'window') { R(ex, ey, ew, eh, '#101826'); R(ex + ew * 0.2, ey + eh * 0.12, ew * 0.6, eh * 0.62, '#86a6cf'); R(ex + ew * 0.49, ey + eh * 0.12, 1, eh * 0.62, '#101826'); R(ex + ew * 0.2, ey + eh * 0.4, ew * 0.6, 1, '#101826'); G(vx, vy, 52, 'rgba(150,190,240,0.30)'); Pl([[ex + ew * 0.2, ey + eh * 0.76], [ex + ew * 0.8, ey + eh * 0.76], [vx + VW * 0.1, VH], [vx - VW * 0.1, VH]], 'rgba(150,190,240,0.07)'); }
    else if (o.end === 'door') { R(ex, ey, ew, eh, '#2a1a10'); R(ex + ew * 0.18, ey + eh * 0.1, ew * 0.64, eh * 0.9, '#8a6a3a'); R(ex + ew * 0.24, ey + eh * 0.16, ew * 0.52, eh * 0.84, '#c8a860'); G(vx, vy, 60, 'rgba(255,220,150,0.34)'); R(ex + ew * 0.66, ey + eh * 0.58, 2, 2, '#fff2c0'); }
    else { R(ex, ey, ew, eh, '#030208'); G(vx, vy, 40, 'rgba(0,0,0,0.5)'); }
    (o.sconce || []).forEach((z) => { for (let s = 0; s < 2; s++) { const x = wx(s, z) + (s ? -2 : 2); const y = wy(z, 0.3); R(x - 1, y - 1, 3, 4, '#f0c878'); G(x, y, 16, 'rgba(240,190,110,0.28)'); } });
    for (let i = 0; i < 90; i++) { const x = rng() * VW; const y = rng() * VH; g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 1, 1); }
  }
  // 正面の部屋の共通：壁紙・幅木・床
  function hhBase(g, VW, VH, o) {
    const { R, Pl, L } = hhK(g); const fl = Math.round(VH * (o.floorY || 0.66)); const rng = hhRng(o.seed || 3);
    R(0, 0, VW, VH, '#07060b'); for (let x = 0; x < VW; x += 8) R(x, 0, 4, fl, o.wall[0]); for (let x = 4; x < VW; x += 8) R(x, 0, 4, fl, o.wall[1]);
    R(0, 0, VW, 6, o.ceil || '#100d16'); R(0, 6, VW, 1, '#40304a'); R(0, Math.round(fl * 0.78), VW, fl - Math.round(fl * 0.78), o.wain || '#241812'); R(0, Math.round(fl * 0.78), VW, 1, '#4e3822'); R(0, fl - 3, VW, 3, '#3a2818');
    R(0, fl, VW, VH - fl, o.floor[0]); let y = fl; let h = 3; let r = 0; while (y < VH) { R(0, y, VW, 1, o.floor[1]); if (o.checker) { for (let x = (r % 2) * h * 2; x < VW; x += h * 4) R(x, y, h * 2, h, o.floor[1]); } y += h; h += 1.4; r++; }
    if (!o.checker) { const vx = VW / 2; for (let f = -3; f <= 3; f += 0.5) L(vx + f * VW * 0.3, VH, vx + f * 14, fl, o.floor[1]); }
    for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(rng() * VW, rng() * fl, 1, 1); }
    return fl;
  }
  function hhWindow(g, x, y, w, h, glow) { const { R, G } = hhK(g); R(x - 2, y - 2, w + 4, h + 4, '#3a2a1c'); R(x, y, w, h, '#86a6cf'); R(x + w / 2, y, 1, h, '#2a2018'); R(x, y + h * 0.45, w, 1, '#2a2018'); R(x + 2, y + 2, 3, h - 6, '#a8c4e4'); if (glow) G(x + w / 2, y + h / 2, w * 1.6, 'rgba(140,180,240,0.22)'); }
  const HH_PAINT = {
    corrA: (g, w, h) => hhPaintCorr(g, w, h, { end: 'window', seed: 11, doors: [{ s: 0, z0: 1.7, z1: 2.5 }, { s: 1, z0: 1.7, z1: 2.5, lit: true }, { s: 0, z0: 3.1, z1: 3.7 }, { s: 1, z0: 3.1, z1: 3.7 }], pics: [{ s: 0, z0: 1.15, z1: 1.55 }, { s: 1, z0: 1.15, z1: 1.55 }, { s: 1, z0: 2.7, z1: 3.0 }], sconce: [2.9] }),
    corrB: (g, w, h) => hhPaintCorr(g, w, h, { end: 'dark', seed: 21, doors: [{ s: 0, z0: 1.7, z1: 2.5, lit: true }, { s: 1, z0: 1.7, z1: 2.5 }, { s: 1, z0: 3.1, z1: 3.7 }], mirror: { s: 0, z0: 3.0, z1: 3.7 }, pics: [{ s: 1, z0: 1.15, z1: 1.55 }, { s: 0, z0: 1.1, z1: 1.45 }], sconce: [1.45, 4.0] }),
    corrC: (g, w, h) => hhPaintCorr(g, w, h, { end: 'door', seed: 31, doors: [{ s: 0, z0: 2.0, z1: 2.8 }, { s: 1, z0: 2.0, z1: 2.8 }], pics: [{ s: 0, z0: 1.2, z1: 1.6 }, { s: 1, z0: 1.2, z1: 1.55 }], sconce: [3.4] }),
    hall: (g, VW, VH) => {
      const { R, Pl, L, G } = hhK(g); const fl = hhBase(g, VW, VH, { wall: ['#2b2236', '#322840'], floor: ['#25252f', '#17171f'], checker: true, floorY: 0.7, seed: 5 }); const cx = VW / 2;
      R(cx - 30, fl - 112, 60, 112, '#030207'); g.fillStyle = '#030207'; g.beginPath(); g.arc(cx, fl - 112, 30, Math.PI, 0); g.fill(); R(cx - 33, fl - 112, 3, 112, '#4a3422'); R(cx + 30, fl - 112, 3, 112, '#4a3422'); G(cx, fl - 60, 46, 'rgba(0,0,0,0.6)');
      R(12, fl - 96, 22, 96, '#3a2414'); R(14, fl - 94, 18, 66, '#2a180c'); g.fillStyle = '#d8d0b0'; g.beginPath(); g.arc(23, fl - 82, 7, 0, 6.3); g.fill(); R(22, fl - 86, 1, 5, '#14100c'); R(22, fl - 82, 4, 1, '#14100c'); R(20, fl - 60, 7, 20, '#6a4a22'); R(23, fl - 56, 1, 10, '#c8a858');
      for (let i = 0; i < 9; i++) { const sx = VW - 74 + i * 7; R(sx, fl - 8 - i * 7, 76 - i * 7 + 4, 8, i % 2 ? '#3a2a24' : '#42322a'); R(sx, fl - 8 - i * 7, 76 - i * 7 + 4, 1, '#5a4636'); } L(VW - 74, fl - 20, VW - 12, fl - 84, '#6a4a28'); for (let i = 0; i < 7; i++) R(VW - 70 + i * 8, fl - 28 - i * 7 - 6, 1, 14, '#6a4a28');
      R(cx - 1, 7, 1, 20, '#4a3a2a'); R(cx - 12, 27, 24, 2, '#6a5030'); for (let i = -2; i <= 2; i++) { R(cx + i * 5, 22, 1, 5, '#e8d090'); } G(cx, 28, 38, 'rgba(240,200,120,0.14)');
    },
    study: (g, VW, VH) => {
      const { R, G } = hhK(g); const fl = hhBase(g, VW, VH, { wall: ['#2a1c14', '#301f16'], floor: ['#2a1a14', '#1a100c'], wain: '#1c120c', floorY: 0.68, seed: 8 }); const cx = VW / 2; const rng = hhRng(9);
      for (const sx of [6, VW - 52]) { R(sx, 14, 46, fl - 12, '#190f09'); for (let r = 0; r < 5; r++) { R(sx + 2, 20 + r * 24, 42, 1, '#4a3420'); let x = sx + 3; while (x < sx + 42) { const bw = 2 + Math.floor(rng() * 3); R(x, 22 + r * 24 + (rng() < 0.2 ? 3 : 0), bw, 20, hhPick1(['#5a2a2a', '#2a3a4a', '#3a4a2a', '#5a4a2a', '#3a2a3a'])); x += bw + 1; } } }
      hhWindow(g, cx - 14, 22, 28, 48, true); R(cx - 18, 18, 36, 4, '#3a1820'); R(cx - 18, 18, 5, 56, '#34141c'); R(cx + 13, 18, 5, 56, '#34141c');
      R(cx - 36, fl - 4, 72, 5, '#4a3018'); R(cx - 34, fl + 1, 5, 34, '#2e1c0e'); R(cx + 29, fl + 1, 5, 34, '#2e1c0e'); R(cx - 26, fl + 1, 52, 16, '#25160a'); R(cx - 24, fl + 3, 22, 11, '#3a2410'); R(cx + 2, fl + 3, 22, 11, '#3a2410'); R(cx - 4, fl + 8, 4, 2, '#c8a858'); R(cx + 22, fl + 8, 3, 2, '#c8a858');
      R(cx + 18, fl - 18, 2, 14, '#1a5a3a'); R(cx + 12, fl - 24, 14, 6, '#1a6a44'); G(cx + 19, fl - 16, 34, 'rgba(255,214,130,0.26)'); R(cx - 28, fl - 12, 10, 8, '#d8d0b0'); R(cx - 24, fl - 18, 3, 7, '#7a6a50');
      R(cx - 8, fl + 22, 16, 18, '#3a2418'); R(cx - 9, fl + 8, 18, 16, '#2a1810');
    },
    dining: (g, VW, VH) => {
      const { R, G } = hhK(g); const fl = hhBase(g, VW, VH, { wall: ['#2a2030', '#30263a'], floor: ['#2c1c18', '#1c1210'], floorY: 0.62, seed: 4 }); const cx = VW / 2;
      for (const wx0 of [22, VW - 54]) { hhWindow(g, wx0, 26, 32, 50, true); R(wx0 - 8, 18, 6, fl - 14, '#4a1a30'); R(wx0 + 34, 18, 6, fl - 14, '#4a1a30'); R(wx0 - 8, 16, 48, 4, '#2a0e1c'); for (let i = 0; i < 4; i++) { R(wx0 - 7 + (i % 2) * 2, 20, 1, fl - 20, '#2e1020'); R(wx0 + 35 + (i % 2), 20, 1, fl - 20, '#2e1020'); } }
      R(cx - 52, fl - 10, 104, 5, '#6a5a48'); R(cx - 50, fl - 5, 100, 22, '#8a8272'); R(cx - 50, fl + 12, 100, 5, '#6a6254'); R(cx - 46, fl + 17, 4, 20, '#2a1a10'); R(cx + 42, fl + 17, 4, 20, '#2a1a10');
      for (let i = 0; i < 6; i++) { const x = cx - 46 + i * 18; R(x, fl - 38, 12, 32, '#2a1810'); R(x + 1, fl - 38, 10, 4, '#3a2418'); R(x + 1, fl - 6, 2, 8, '#1a100a'); }
      for (const x of [cx - 24, cx + 22]) { R(x, fl - 22, 2, 12, '#d8d0b0'); R(x - 0, fl - 25, 2, 3, '#ffd070'); G(x + 1, fl - 24, 28, 'rgba(255,200,110,0.32)'); }
      R(cx, 7, 1, 14, '#4a3a2a'); R(cx - 14, 21, 28, 2, '#6a5030'); for (let i = -2; i <= 2; i++) R(cx + i * 6, 17, 1, 4, '#e8d090');
    },
    bedroom: (g, VW, VH) => {
      const { R, Pl, G } = hhK(g); const fl = hhBase(g, VW, VH, { wall: ['#26303a', '#2c3844'], floor: ['#2a1c18', '#1a1210'], wain: '#1c1816', floorY: 0.66, seed: 6 }); const cx = VW / 2;
      hhWindow(g, cx - 14, 20, 28, 46, true); R(cx - 18, 16, 6, 62, '#3a3a58'); R(cx + 12, 16, 6, 62, '#3a3a58'); R(cx - 18, 14, 36, 3, '#22223a');
      R(8, fl - 26, 70, 4, '#3a2418'); R(8, fl - 22, 66, 18, '#34445f'); R(8, fl - 30, 20, 10, '#cfc8c2'); R(8, fl - 4, 66, 30, '#201410'); R(8, fl + 10, 66, 16, '#2a1c14'); R(6, fl - 40, 5, 66, '#3a2418'); R(74, fl - 14, 5, 30, '#3a2418');
      R(84, fl - 14, 14, 16, '#3a2418'); R(86, fl - 22, 10, 8, '#d8c8a0'); G(91, fl - 20, 26, 'rgba(255,214,130,0.22)');
      R(VW - 54, fl - 76, 46, 90, '#2a1a10'); R(VW - 52, fl - 74, 21, 86, '#3a2414'); R(VW - 30, fl - 74, 21, 86, '#3a2414'); R(VW - 32, fl - 74, 2, 86, '#030207'); R(VW - 35, fl - 36, 2, 4, '#c8a858'); R(VW - 28, fl - 36, 2, 4, '#c8a858');
      g.fillStyle = '#6a4a28'; g.beginPath(); g.ellipse(cx, fl + 10, 12, 16, 0, 0, 6.3); g.fill(); g.fillStyle = '#4a5a6c'; g.beginPath(); g.ellipse(cx, fl + 10, 9, 13, 0, 0, 6.3); g.fill();
    },
    doll: (g, VW, VH) => {
      const { R, G } = hhK(g); const fl = hhBase(g, VW, VH, { wall: ['#32243a', '#3a2a44'], floor: ['#2a1c20', '#1a1014'], floorY: 0.67, seed: 12 }); const cx = VW / 2; const rng = hhRng(14);
      for (const sx of [6, VW - 40]) { R(sx, 22, 34, fl - 22, '#1c1018'); for (let r = 0; r < 4; r++) { R(sx + 1, 28 + r * 34, 32, 2, '#4a3024'); for (let i = 0; i < 4; i++) { const bx = sx + 3 + i * 8; R(bx, 28 + r * 34 - 12 + 2, 6, 10, hhPick1(['#c8b8a0', '#a89888', '#b0a090'])); R(bx + 1, 28 + r * 34 - 18 + 2, 4, 5, '#d8c8b0'); R(bx + 1, 28 + r * 34 - 17 + 2, 1, 1, '#14101a'); R(bx + 3, 28 + r * 34 - 17 + 2, 1, 1, '#14101a'); } } }
      hhWindow(g, cx - 12, 30, 24, 40, true); R(cx - 40, fl + 10, 80, 24, '#3a1424'); R(cx - 40, fl + 10, 80, 2, '#7a5a30'); R(cx - 40, fl + 32, 80, 2, '#7a5a30');
      R(cx - 10, fl + 6, 20, 4, '#3a2418'); R(cx - 9, fl - 24, 2, 28, '#3a2418'); R(cx + 7, fl - 24, 2, 28, '#3a2418'); R(cx - 9, fl - 24, 18, 3, '#4a2e20'); R(cx - 8, fl - 4, 16, 8, '#5a2a30');
      R(VW - 36, fl + 16, 22, 14, '#4a2e20'); R(VW - 36, fl + 16, 22, 2, '#7a5a30');
    },
    back: (g, VW, VH) => {
      const { R, Pl, G } = hhK(g); const fl = hhBase(g, VW, VH, { wall: ['#262030', '#2c2438'], floor: ['#22222c', '#16161e'], checker: true, floorY: 0.7, seed: 15 }); const cx = VW / 2;
      R(cx - 30, fl - 104, 60, 106, '#2a1a10'); R(cx - 26, fl - 100, 52, 100, '#4a3220'); R(cx - 18, fl - 92, 36, 40, '#86a6cf'); R(cx - 1, fl - 92, 2, 40, '#2a1a10'); R(cx - 18, fl - 73, 36, 2, '#2a1a10'); R(cx - 14, fl - 90, 4, 34, '#a8c4e4'); G(cx, fl - 70, 70, 'rgba(150,190,240,0.34)'); R(cx + 16, fl - 48, 4, 4, '#d8b060'); R(cx - 26, fl - 40, 52, 2, '#2a1a10'); R(cx - 26, fl - 22, 52, 2, '#2a1a10');
      R(cx - 36, fl, 72, 5, '#3a2a20'); R(8, fl - 80, 3, 80, '#3a2418'); for (const y of [fl - 76, fl - 62]) R(8, y, 22, 2, '#3a2418'); R(14, fl - 74, 10, 28, '#26202c'); R(VW - 24, fl - 10, 16, 10, '#3a2a20');
    },
    shelf: (g, VW, VH) => { const { R, G } = hhK(g); R(0, 0, VW, VH, '#0c0810'); const rng = hhRng(41); for (let r = 0; r < 3; r++) { const y = 30 + r * 66; R(6, y + 44, VW - 12, 6, '#3a2418'); for (let i = 0; i < 6; i++) { const x = 14 + i * Math.floor((VW - 28) / 6); const k = Math.floor(rng() * 3); if (k === 0) { R(x, y + 16, 14, 28, '#bfae98'); R(x + 2, y + 2, 10, 14, '#d4c4ac'); R(x + 4, y + 8, 2, 2, '#14101a'); R(x + 8, y + 8, 2, 2, '#14101a'); } else if (k === 1) { R(x, y + 24, 18, 20, '#6a2a30'); R(x + 2, y + 14, 14, 10, '#8a3a40'); } else { R(x + 2, y + 30, 12, 14, '#2a4a6a'); R(x + 4, y + 22, 8, 8, '#4a6a8a'); } } } G(VW / 2, 90, 90, 'rgba(255,214,150,0.10)'); },
    window: (g, VW, VH) => { const { R, G } = hhK(g); R(0, 0, VW, VH, '#05060e'); const x = 24; const w = VW - 48; R(x, 22, w, 150, '#0e1626'); R(x, 22, w, 150, '#101c30'); G(VW * 0.72, 56, 60, 'rgba(180,210,255,0.5)'); g.fillStyle = '#cfe0ff'; g.beginPath(); g.arc(VW * 0.72, 56, 11, 0, 6.3); g.fill(); g.fillStyle = '#05060e'; for (let i = 0; i < 6; i++) { const tx = x + i * (w / 5); R(tx - 2, 90 + (i % 2) * 14, 4, 80, '#05060e'); g.beginPath(); g.moveTo(tx - 14, 120 + (i % 2) * 14); g.lineTo(tx, 70 + (i % 2) * 14); g.lineTo(tx + 14, 120 + (i % 2) * 14); g.fill(); } R(x + w / 2, 22, 2, 150, '#2a2018'); R(x, 90, w, 2, '#2a2018'); R(x - 4, 18, w + 8, 4, '#2a2018'); R(x - 4, 172, w + 8, 5, '#2a2018'); R(0, 14, 24, 190, '#3a1424'); R(VW - 24, 14, 24, 190, '#3a1424'); },
    mirror: (g, VW, VH) => { const { R, G } = hhK(g); R(0, 0, VW, VH, '#0a0810'); g.fillStyle = '#7a5a30'; g.beginPath(); g.ellipse(VW / 2, 112, 62, 94, 0, 0, 6.3); g.fill(); g.fillStyle = '#3c4858'; g.beginPath(); g.ellipse(VW / 2, 112, 54, 86, 0, 0, 6.3); g.fill(); g.fillStyle = '#26303c'; g.beginPath(); g.ellipse(VW / 2, 120, 50, 70, 0, 0, 6.3); g.fill(); G(VW / 2 - 14, 60, 40, 'rgba(180,200,230,0.14)'); R(VW / 2 - 20, 150, 40, 40, '#1a1018'); R(VW / 2 - 34, 40, 12, 2, '#5a6a7c'); },
    hide_bed: (g, VW, VH) => { const { R, Pl, L, G } = hhK(g); R(0, 0, VW, VH, '#05040a'); R(0, 120, VW, 112, '#1c1210'); for (let i = 0; i < 9; i++) L(0, 124 + i * 12, VW, 124 + i * 12, '#120b0a'); R(0, 112, VW, 8, '#2a1c18'); G(VW / 2, 170, 80, 'rgba(160,190,240,0.10)'); R(0, 0, VW, 112, '#05040a'); },
    hide_bed_o: (g, VW, VH) => { const { R } = hhK(g); R(0, 0, VW, 112, '#0c0810'); R(0, 0, VW, 8, '#140e18'); R(0, 108, VW, 8, '#201430'); for (let x = 0; x < VW; x += 6) R(x, 112, 3, 8 + (x * 7 % 5), '#241838'); R(0, 196, VW, 36, '#050308'); R(0, 188, VW, 8, '#0a0610'); R(0, 0, 14, VH, '#07050b'); R(VW - 14, 0, 14, VH, '#07050b'); },
    hide_desk: (g, VW, VH) => { const { R, L, G } = hhK(g); R(0, 0, VW, VH, '#07050a'); R(0, 120, VW, 112, '#1e130d'); for (let i = 0; i < 9; i++) L(0, 124 + i * 12, VW, 124 + i * 12, '#150c08'); G(VW / 2, 170, 80, 'rgba(255,210,140,0.10)'); },
    hide_desk_o: (g, VW, VH) => { const { R } = hhK(g); R(0, 0, VW, 112, '#1a0f08'); R(0, 108, VW, 6, '#3a2410'); R(0, 0, 26, VH, '#1a0f08'); R(VW - 26, 0, 26, VH, '#1a0f08'); R(24, 112, 2, 120, '#3a2410'); R(VW - 26, 112, 2, 120, '#3a2410'); R(0, 196, VW, 36, '#050308'); R(VW / 2 - 18, 112, 36, 16, '#120a06'); R(VW / 2 - 2, 120, 4, 3, '#a88a48'); },
    hide_curtain: (g, VW, VH) => { const { R, L, G } = hhK(g); R(0, 0, VW, VH, '#06050b'); R(0, 120, VW, 112, '#201414'); for (let i = 0; i < 9; i++) L(0, 124 + i * 12, VW, 124 + i * 12, '#150c0c'); G(VW / 2, 150, 70, 'rgba(255,200,120,0.12)'); R(VW / 2 - 6, 70, 12, 50, '#8a8272'); R(VW / 2 - 3, 60, 2, 10, '#ffd070'); G(VW / 2, 64, 24, 'rgba(255,200,110,0.3)'); },
    hide_curtain_o: (g, VW, VH) => { const { R } = hhK(g); R(0, 0, VW, VH, '#2a0e1c'); for (let x = 0; x < VW; x += 7) R(x, 0, 3, VH, '#3a1428'); g.clearRect(VW * 0.3, 60, VW * 0.4, 118); R(VW * 0.3 - 2, 60, 2, 118, '#12060c'); R(VW * 0.7, 60, 2, 118, '#12060c'); R(0, 196, VW, 36, '#05020a'); },
    hide_closet: (g, VW, VH) => { const { R, L, G } = hhK(g); R(0, 0, VW, VH, '#05040a'); R(0, 120, VW, 112, '#201512'); for (let i = 0; i < 9; i++) L(0, 124 + i * 12, VW, 124 + i * 12, '#150c0a'); G(VW / 2, 140, 60, 'rgba(160,190,240,0.14)'); },
    hide_closet_o: (g, VW, VH) => { const { R } = hhK(g); R(0, 0, VW, VH, '#150c06'); for (let x = 0; x < VW; x += 6) R(x, 0, 1, VH, '#2a1a0c'); for (let y = 12; y < VH; y += 20) R(0, y, VW, 1, '#0c0603'); g.clearRect(VW / 2 - 9, 40, 18, 140); R(VW / 2 - 11, 40, 2, 140, '#050302'); R(VW / 2 + 9, 40, 2, 140, '#050302'); R(0, 196, VW, 36, '#030206'); }
  };
  const HH_VIEWS = Object.keys(HH_PAINT);
  function hhBg(key) { const VW = hhVW(); const k = key + VW; if (!HH_CACHE[k]) { const c = document.createElement('canvas'); c.width = VW; c.height = HH_VH; const g = c.getContext('2d'); try { HH_PAINT[key](g, VW, HH_VH); } catch (e) { g.fillStyle = '#05040a'; g.fillRect(0, 0, VW, HH_VH); } HH_CACHE[k] = c; } return HH_CACHE[k]; }
  // 立ち絵を 暗く(k)／シルエット化(k=1)して返す
  function hhTint(name, k) { k = Math.round(k * 10) / 10; const key = 'T' + name + k; if (HH_CACHE[key]) return HH_CACHE[key]; const im = hhImg(name); if (!im) return null; const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(4,6,20,' + k + ')'; g.fillRect(0, 0, c.width, c.height); HH_CACHE[key] = c; return c; }
  function hhSpr(name, cx, footY, h, o) {
    o = o || {}; const src = o.tint !== undefined ? hhTint(name, o.tint) : hhImg(name); if (!src) return; const w = h * (src.width || src.naturalWidth) / (src.height || src.naturalHeight);
    ctx.save(); ctx.globalAlpha = (o.a === undefined ? 1 : o.a); ctx.translate(Math.round(cx), Math.round(footY)); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(src, -w / 2, -h, w, h); ctx.imageSmoothingEnabled = sm; ctx.restore();
  }

  // =====================================================================
  //  描画
  // =====================================================================
  function hhCorrXY(z, off) { const VW = hhVW(); const vx = VW / 2; const vy = HH_VH * 0.46; return { x: vx + (off || 0) / z, y: vy + (HH_VH - vy) / z, h: HH_VH * 0.93 / z }; }
  function hhDrawEntities() {
    const ev = HH.ev; const VW = hhVW(); const t = HH.clock; const R = HHR[HH.node];
    if (HH.node === 'doll') {
      const d = HH.doll; const cx = VW / 2; const fy = HH_VH * 0.67 + 6; if (d.stage === 0) hhSpr('doll', cx, fy, 82, { tint: 0.52, flip: true, a: 0.95 }); else if (d.stage === 1) hhSpr('doll', cx, fy, 86, { tint: 0.28, rot: Math.sin(t * 0.7) * 0.01 });
      return;
    }
    if (!ev) return;
    if (ev.type === 'corrWoman' && ev.state === 'stalk' && ev.lit) { const z = [1, 1.7, 2.8, 4.2][ev.dist]; const p = hhCorrXY(z, 0); const sway = Math.sin(t * 2.3) * 1.2; hhSpr('woman', p.x + sway, p.y, p.h * HH_K.woman, { tint: Math.min(0.75, 0.15 + z * 0.12), rot: Math.sin(t * 1.7) * 0.015 }); }
    else if (ev.type === 'corrMan' && ev.state === 'cross') { const u = Math.min(1, ev.t / 3.4); const x = VW * (1.05 - u * 1.15); const p = hhCorrXY(4.4, 0); hhSpr('man', x, p.y, p.h * HH_K.man, { tint: 1, a: Math.min(1, ev.t * 2) * (u > 0.9 ? (1 - u) * 10 : 1) }); }
    else if (ev.type === 'corrBoy' && (ev.state === 'stand' || ev.state === 'walk')) { const u = ev.state === 'walk' ? Math.min(1, ev.t / 2.2) : 0; const z = 4.0 - u * 1.6; const side = ev.side === 1 ? 1 : -1; const p = hhCorrXY(z, side * VW * 0.5 * u * z * 0.55); const a = ev.state === 'stand' ? Math.min(1, ev.t * 1.6) : 1 - Math.max(0, (u - 0.7) / 0.3); hhSpr('boy', p.x, p.y + Math.abs(Math.sin(t * 5)) * (ev.state === 'walk' ? -1.5 : 0), p.h * HH_K.boy, { tint: 0.5, a }); }
    else if (ev.type === 'corrDoll' && ev.state === 'scurry') { const u = Math.min(1, ev.t / 2.6); const p = hhCorrXY(3.2 - u * 1.2, (1 - u * 2) * 110); hhSpr('doll', p.x, p.y + Math.abs(Math.sin(t * 14)) * -2, p.h * HH_K.doll, { tint: 0.5, a: u > 0.9 ? (1 - u) * 10 : 1, flip: u > 0.5 }); }
    else if (ev.type === 'hide' && ev.state === 'look') { const p = hhCorrXY(3.2, 0); hhSpr('boy', VW / 2, HH_VH * 0.66, 78, { tint: 0.55, a: Math.min(1, ev.t * 1.5) * (ev.t > 3 ? (3.4 - ev.t) * 2.5 : 1) }); }
  }
  // 隠れ視点
  const HH_SLIT = (VW, spot) => (spot === 'closet' ? { x: VW / 2 - 9, y: 40, w: 18, h: 140 } : spot === 'curtain' ? { x: VW * 0.3, y: 60, w: VW * 0.4, h: 118 } : { x: spot === 'desk' ? 26 : 14, y: 120, w: VW - (spot === 'desk' ? 52 : 28), h: 76 });
  function hhDrawHide() {
    const VW = hhVW(); const sp = HH.hid.spot; const sl = HH_SLIT(VW, sp); ctx.drawImage(hhBg('hide_' + sp), 0, 0); const ev = HH.ev; const t = HH.clock;
    ctx.save(); ctx.beginPath(); ctx.rect(sl.x, sl.y, sl.w, sl.h); ctx.clip(); const floorY = sl.y + sl.h - (sp === 'closet' ? 8 : 6);
    if (ev && ev.type === 'hide' && ev.state === 'pass') {
      const e = ev.ent; const sc = { woman: 0.4, doll: 0.34, man: 0.44, boy: 0.38 }[e]; const stopX = sl.x + sl.w / 2; let x = stopX; let moving = false; let fr = 'stop';
      if (ev.ph === 'in') { const u = ev.u; x = stopX + (1 - u * u * (3 - 2 * u)) * (VW * 0.62); moving = true; } else if (ev.ph === 'out') { const u = ev.u; x = stopX - (u * u * (3 - 2 * u)) * (VW * 0.7); moving = true; } else if (ev.ph === 'quiet') x = -400;
      fr = moving ? (ev.frame ? 'walk' : 'stop') : 'stop'; const im = hhImg('feet_' + e + '_' + fr);
      if (im && ev.ph !== 'face' && ev.ph !== 'quiet') { const w = im.naturalWidth * sc; const h = im.naturalHeight * sc; const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 0.92; ctx.drawImage(im, x - w / 2, floorY - h, w, h); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = sm; }
      if (ev.ph === 'stop' && ev.rare) { /* 止まったあと… */ }
      if (ev.ph === 'face') { const wi = hhImg('feet_woman_stop'); if (wi) { const w = wi.naturalWidth * sc; const h = wi.naturalHeight * sc; ctx.drawImage(wi, stopX - w / 2, floorY - h, w, h); } const fx = hhImg('woman_x'); if (fx) { const u = ev.u; const sw = fx.naturalWidth; const hs = 20 + u * u * 150; const ws = hs * (sw / 75); ctx.globalAlpha = Math.min(0.9, 0.2 + u); ctx.drawImage(fx, 0, 0, sw, 75, stopX - ws / 2 + Math.sin(t * 1.3) * 2, sl.y + 6 + u * 10, ws, hs); ctx.globalAlpha = 1; } }
    } else if (ev && ev.type === 'fake') { /* なにも通らない */ }
    ctx.restore(); ctx.drawImage(hhBg('hide_' + sp + '_o'), 0, 0);
    if (ev && ev.type === 'hide' && ev.state === 'pass' && ev.ph === 'face') { /* 顔は隙間の奥 */ }
  }
  function hhDrawScene() {
    const VW = hhVW(); const R = HHR[HH.node]; let key = R.paint;
    if (HH.sub) { key = HH.sub.k; } else if (HH.view === 'hide') key = 'hide';
    if (HH.view === 'hide' && !HH.sub) hhDrawHide(); else {
      ctx.drawImage(hhBg(key), 0, 0);
      if (!HH.sub) { hhDrawEntities(); if (HH.node === 'hall') { /* とけいの 振り子 */ const px = 23 + Math.sin(HH.clock * 3) * 3; rect(px - 1, HH_VH * 0.7 - 56, 2, 2, '#c8a858'); } }
      else if (HH.sub.k === 'mirror') { const s = HH.sub; if (s.m === 1 && s.t > 1.6) { const a = Math.min(0.6, (s.t - 1.6) * 0.5) * (s.t > 3.6 ? Math.max(0, (4.2 - s.t) / 0.6) : 1); hhSpr('woman_x', VW / 2 + 12, 196, 150, { tint: 0.72, a }); } }
    }
  }
  function hhVignette() { const VW = hhVW(); const k = 'V' + VW; if (!HH_CACHE[k]) { const c = document.createElement('canvas'); c.width = VW; c.height = HH_VH; const g = c.getContext('2d'); const gr = g.createRadialGradient(VW / 2, HH_VH * 0.48, 28, VW / 2, HH_VH * 0.48, Math.max(VW, HH_VH) * 0.7); gr.addColorStop(0, 'rgba(0,0,6,0.10)'); gr.addColorStop(1, 'rgba(0,0,6,0.86)'); g.fillStyle = gr; g.fillRect(0, 0, VW, HH_VH); HH_CACHE[k] = c; } return HH_CACHE[k]; }
  function hhDrawPlay() {
    rect(0, 0, W, H, '#040308'); const VW = hhVW(); const T = HH.trans; const E = HH.end; const C = HH.caught;
    drawText('HORROR HOUSE', 10, 12, '#6a5a9a', 1); const rn = HHR[HH.node].name; drawText(rn, W - 10 - textWidth(rn, 1), 12, '#8a6a6a', 1); rect(HH_VX - 1, HH_VY - 1, VW + 2, HH_VH + 2, '#241c34');
    ctx.save(); ctx.translate(HH_VX, HH_VY); ctx.beginPath(); ctx.rect(0, 0, VW, HH_VH); ctx.clip();
    if (E && E.st !== 'open' && E.st !== 'out') hhDrawEnding(E); else if (C) hhDrawCaught(C); else {
      let zoom = 1; let black = 0; if (T) { const p = T.t / T.dur; if (p < 0.5) { zoom = 1 + p * 0.5; black = p * 2; } else { zoom = 1.12 - (p - 0.5) * 0.24; black = 1 - (p - 0.5) * 2; } }
      if (E && E.st === 'out') { zoom = 1 + E.t * 0.1; black = 0; }
      ctx.save(); if (zoom !== 1) { ctx.translate(VW / 2, HH_VH * 0.55); ctx.scale(zoom, zoom); ctx.translate(-VW / 2, -HH_VH * 0.55); } hhDrawScene(); ctx.restore();
      if (E && (E.st === 'open' || E.st === 'out')) { const a = E.st === 'open' ? Math.min(0.85, E.t * 0.6) : Math.min(1, 0.85 + E.t * 0.3); ctx.globalAlpha = a; rect(0, 0, VW, HH_VH, '#cfe0ff'); ctx.globalAlpha = 1; }
      const br = HH.dev.bright; if (br) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4; rect(0, 0, VW, HH_VH, '#8a92bc'); ctx.restore(); } else ctx.drawImage(hhVignette(), 0, 0); const da = Math.max(br ? 0 : HH.darkA, black, HH.fadeIn); ctx.globalAlpha = Math.min(1, da); rect(0, 0, VW, HH_VH, '#010104'); ctx.globalAlpha = 1;
      if (da > 0.5) { ctx.globalAlpha = 0.3; for (let i = 0; i < 26; i++) rect(Math.random() * VW, Math.random() * HH_VH, 1, 1, '#6a6a9a'); ctx.globalAlpha = 1; }
    }
    ctx.restore(); hhUi();
  }
  function hhDrawEnding(E) {
    const VW = hhVW(); hhPaintExterior(VW, HH_VH, E.st === 'boy' ? Math.min(1, E.t * 1.6) * (E.t > 2.6 ? Math.max(0, (3.6 - E.t) / 1.0) : 1) : 0);
    if (E.st === 'shut') { ctx.globalAlpha = Math.max(0, 1 - E.t * 1.2); rect(0, 0, VW, HH_VH, '#cfe0ff'); ctx.globalAlpha = 1; }
    if (E.st === 'esc') { ctx.globalAlpha = Math.min(1, E.t * 1.5); drawTextCenter('ESCAPE', VW / 2, 56, '#e8f0ff', 4, '#1a2a5a'); ctx.globalAlpha = 1; }
    if (E.st === 'fade') { ctx.globalAlpha = Math.min(1, E.t / 1.4); rect(0, 0, VW, HH_VH, '#010104'); ctx.globalAlpha = 1; }
  }
  function hhPaintExterior(VW, VH, boyA) {
    for (let y = 0; y < VH; y += 4) rect(0, y, VW, 4, hhMix('#0a1030', '#1c2a58', y / VH)); ctx.globalAlpha = 0.9; rect(VW * 0.74 - 12, 24, 24, 24, '#dfe8ff'); ctx.globalAlpha = 0.18; rect(VW * 0.74 - 22, 14, 44, 44, '#9ab8ff'); ctx.globalAlpha = 1;
    for (let i = 0; i < 18; i++) rect((i * 53) % VW, 6 + (i * 29) % 70, 1, 1, '#8a9acc');
    const gy = VH * 0.74; rect(0, gy, VW, VH - gy, '#0a0e18'); const bx = VW * 0.14; const bw = VW * 0.72; rect(bx, gy - 96, bw, 96, '#0c0e1c'); rect(bx - 6, gy - 104, bw + 12, 10, '#080a14'); rect(bx + bw * 0.38, gy - 132, bw * 0.24, 30, '#0c0e1c');
    ctx.fillStyle = '#080a14'; ctx.beginPath(); ctx.moveTo(bx - 8, gy - 100); ctx.lineTo(VW / 2, gy - 150); ctx.lineTo(bx + bw + 8, gy - 100); ctx.fill();
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const x = bx + 10 + c * (bw - 20) / 4 + 2; const y = gy - 88 + r * 44; rect(x, y, 16, 24, '#14182c'); if (r === 0 && c === 1) { rect(x, y, 16, 24, boyA > 0 ? '#1c2440' : '#14182c'); } if (r === 1 && c === 2) { rect(x, y, 16, 24, '#e8c078'); } }
    const bwx = bx + 10 + 1 * (bw - 20) / 4 + 2; if (boyA > 0) { ctx.save(); ctx.beginPath(); ctx.rect(bwx, gy - 88, 16, 24); ctx.clip(); hhSpr('boy', bwx + 8, gy - 62, 40, { tint: 0.35, a: boyA }); ctx.restore(); rect(bwx + 7, gy - 88, 2, 24, '#0c0e1c'); }
    rect(VW / 2 - 8, gy - 28, 16, 28, '#1a1018'); rect(VW / 2 - 6, gy - 26, 12, 26, '#06060c'); for (let x = 0; x < VW; x += 10) { rect(x, gy + 2, 1, 6, '#161c2c'); } ctx.globalAlpha = 0.16; rect(0, gy - 6, VW, 18, '#7a8ac8'); ctx.globalAlpha = 1;
  }
  function hhDrawCaught(C) {
    const VW = hhVW(); const t = C.t; rect(0, 0, VW, HH_VH, '#030208');
    if (t > 0.2 && t < 1.5) { const u = Math.min(1, (t - 0.2) / 0.5); const a = t < 1.1 ? 1 : (1.5 - t) / 0.4; const sh = t < 0.7 ? (Math.random() - 0.5) * 4 : 0; hhSpr(C.ent + '_x', VW / 2 + sh, HH_VH + 40 + (1 - u) * 20, (150 + u * u * 230) * Math.min(1.1, HH_K[C.ent]), { tint: 0.15, a }); }
    ctx.globalAlpha = 0.35; for (let i = 0; i < 40; i++) rect(Math.random() * VW, Math.random() * HH_VH, 1 + Math.random() * 2, 1, '#6a6a9a'); ctx.globalAlpha = 1;
    if (t > 1.8) { ctx.globalAlpha = Math.min(1, (t - 1.8) * 1.2); drawTextCenter('CAUGHT...', VW / 2, HH_VH / 2 - 8, '#c83040', 3, '#1a0408'); ctx.globalAlpha = 1; }
  }
  function hhDrawIntro() {
    rect(0, 0, W, H, '#05060c'); ctx.save(); ctx.translate(0, 8); hhPaintExterior(W, 260, 0); ctx.restore(); rect(0, 0, W, 8, '#05060c'); rect(0, 268, W, H - 268, '#05040a');
    drawTextCenter('HORROR', W / 2, 22, '#c83040', 4, '#1a0408'); drawTextCenter('HOUSE', W / 2, 52, '#b8a8ff', 4, '#1a1038'); rect(0, 262, W, 1, '#2a2244');
    drawTextCenter('YEN ' + P_().money, W / 2, 278, '#a8b8ff', 1); drawTextCenter('1 PLAY  YEN ' + HHC.playCost, W / 2, 292, '#a8b8ff', 1);
  }
  function hhDrawResult() {
    const R = HH.result; rect(0, 0, W, H, '#05040a'); for (let i = 0; i < 30; i++) rect((i * 47) % W, 80 + (i * 61) % 150, 1, 1, '#2a2a4a');
    drawTextCenter(R.escaped ? 'ESCAPED' : 'CAUGHT...', W / 2, 30, R.escaped ? '#e8f0ff' : '#c83040', 4, R.escaped ? '#1a2a5a' : '#1a0408'); rect(14, 70, W - 28, 1, '#3a2a5a');
    const mm = String(Math.floor(R.time / 60)).padStart(2, '0') + ':' + String(R.time % 60).padStart(2, '0'); const L = (lab, v, y) => { drawText(lab, 18, y, '#a898d8', 1); drawText(String(v), W - 18 - textWidth(String(v), 2), y - 3, '#ffffff', 2, '#3a2a6a'); };
    L('TIME', mm, 92); L('ENCOUNTERS', R.enc, 122); rect(14, 150, W - 28, 1, '#3a2a5a'); drawTextCenter('YEN ' + P_().money, W / 2, 230, '#a8b8ff', 1);
  }

  // ---- DOM ----
  const HH_DOM = { btns: [] };
  function hhBuildDom() {
    if (HH_DOM.play) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); b.addEventListener('click', (e) => { ensureAudio(); fn(b); }); return b; };
    HH_DOM.play = mk('hh-play', 'PLAY　¥' + HHC.playCost, 'hb-go', hhInsert); HH_DOM.retry = mk('hh-retry', 'もういちど　¥' + HHC.playCost, 'hb-go', hhInsert);
    for (let i = 0; i < 6; i++) HH_DOM.btns.push(mk('hh-b' + i, '', '', (b) => { if (b.dataset.act) hhAct(b.dataset.act); }));
    const mkd = (id, html) => { const d = document.createElement('div'); d.className = 'nk-say'; d.id = id; d.innerHTML = html; screenEl.appendChild(d); return d; };
    HH_DOM.bright = mk('hh-bright', '', '', () => { HH.dev.bright = !HH.dev.bright; }); HH_DOM.say = mkd('hh-say', ''); HH_DOM.help = mkd('hh-help', 'くらい やかたを すすんで、<br>でぐちを めざそう。たたかう ことは できない。<br>あしおとに ちゅうい…。<br><span class="nk-dim">かくれる ばしょが あれば、やりすごせる</span>');
  }
  function hhUi() {
    hhBuildDom(); const ph = HH.phase; const show = (el, on) => el.classList.toggle('is-show', !!on); const VW = hhVW();
    show(HH_DOM.play, ph === 'intro'); show(HH_DOM.help, ph === 'intro'); show(HH_DOM.retry, ph === 'result');
    const bs = ph === 'play' ? hhButtons() : []; const n = bs.length; const sayOn = ph === 'play' && HH.sayUntil > HH.clock && !HH.caught && !(HH.end && HH.end.st !== 'open');
    if (sayOn && HH_DOM.say.dataset.h !== HH.say) { HH_DOM.say.innerHTML = HH.say; HH_DOM.say.dataset.h = HH.say; } show(HH_DOM.say, sayOn); const bt = 'あかるく ' + (HH.dev.bright ? 'ON' : 'OFF'); if (HH_DOM.bright.textContent !== bt) HH_DOM.bright.textContent = bt; show(HH_DOM.bright, DEV_MODE && ph !== 'result' && !HH.caught); crPlace(HH_DOM.bright, { x: W - 84, y: ph === 'intro' ? 3 : 22, w: 76, h: 16 }); HH_DOM.bright.style.fontSize = Math.max(9, parseFloat(HH_DOM.bright.style.fontSize) * 0.8) + 'px';
    crPlace(HH_DOM.play, { x: 24, y: 322, w: W - 48, h: 34 }); crPlace(HH_DOM.help, { x: 10, y: 190, w: W - 20, h: 72 }); crPlace(HH_DOM.retry, { x: 20, y: 270, w: W - 40, h: 34 }); crPlace(HH_DOM.say, { x: HH_VX + 4, y: HH_VY + HH_VH - 50, w: VW - 8, h: 46 });
    const cols = n <= 3 ? n : 2; const rows = n <= 3 ? 1 : Math.ceil(n / 2); const bh = n > 3 ? 32 : 40; const y0 = n > 3 ? 284 : 296; const gap = 6; const bw = cols ? (W - 16 - gap * (cols - 1)) / cols : 0;
    HH_DOM.btns.forEach((b, i) => { const o = bs[i]; show(b, !!o); if (!o) { b.dataset.act = ''; return; } if (b.textContent !== o.label) b.textContent = o.label; b.dataset.act = o.act; const r = Math.floor(i / cols); const c = i % cols; crPlace(b, { x: 8 + c * (bw + gap), y: y0 + r * (bh + 4), w: bw, h: bh }); b.style.fontSize = Math.max(10, parseFloat(b.style.fontSize) * 0.9) + 'px'; });
    for (const el of [HH_DOM.play, HH_DOM.retry]) el.style.fontSize = Math.max(10, parseFloat(el.style.fontSize) * 0.95) + 'px'; HH_DOM.help.style.fontSize = Math.max(10, parseFloat(HH_DOM.help.style.fontSize) * 0.9) + 'px'; HH_DOM.say.style.fontSize = Math.max(11, parseFloat(HH_DOM.say.style.fontSize) * 1.05) + 'px';
  }
  function hhHide() { if (!HH_DOM.play) return; [HH_DOM.play, HH_DOM.retry, HH_DOM.say, HH_DOM.help, HH_DOM.bright].forEach((e) => e.classList.remove('is-show')); HH_DOM.btns.forEach((b) => b.classList.remove('is-show')); }
  function hhDraw() { const ph = HH.phase; if (ph === 'intro') hhDrawIntro(); else if (ph === 'result') hhDrawResult(); else hhDrawPlay(); if (ph !== 'play') hhUi(); }
  function hhLeaveMid() {
    if (HH.phase !== 'play') return false;
    showDialog({ title: 'やかたを でますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { HH.q = []; HH.phase = 'intro'; HH.ev = null; HH.trans = null; HH.end = null; HH.caught = null; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function hhDev(node, ev) { if (HH.phase !== 'play') hhStart(); HH.dev.force = ev || null; HH.trans = null; HH.end = null; HH.caught = null; HH.sub = null; hhEnter(node); }
  function openHhDev() {
    const again = (f) => () => { f(); setTimeout(openHhDev, 0); }; const nodes = Object.keys(HHR); const evs = ['hideWoman', 'hideMan', 'hideBoy', 'hideDoll', 'fake', 'corrWoman', 'corrMan', 'corrBoy', 'corrDoll'];
    showDialog({ title: 'HORROR HOUSE DEV', wide: true, lines: [{ text: 'PHASE ' + HH.phase + ' / NODE ' + HH.node + ' / EV ' + (HH.ev ? HH.ev.id + '.' + HH.ev.state : '-') + ' / ENC ' + HH.enc + ' / 無敵 ' + (HH.dev.god ? 'ON' : 'OFF') + ' / 明るい ' + (HH.dev.bright ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) }, { label: 'ゲーム即開始（料金なし）', onClick: () => { hhStart(); } }, { label: '無敵 ON/OFF', onClick: again(() => { HH.dev.god = !HH.dev.god; }) }, { label: 'あかるいモード（こわくない） ' + (HH.dev.bright ? 'ON' : 'OFF'), onClick: again(() => { HH.dev.bright = !HH.dev.bright; }) },
      ...nodes.map((n) => ({ label: '→ ' + n, onClick: () => hhDev(n) })), ...evs.map((e) => ({ label: 'イベント：' + e + '（寝室）', onClick: () => hhDev(e.startsWith('corr') ? 'corrB' : 'bedroom', e) })), { label: 'とじる', primary: true } ] });
  }
  mgRegister('horror', {
    reset() { HH.phase = 'intro'; HH.q = []; HH.ev = null; }, phase: () => (HH.phase === 'play' ? 'play' : 'idle'),
    enter() { hhBuildDom(); HH.phase = 'intro'; HH.paying = false; HH.q = []; HH.ev = null; HH.sayUntil = 0; setMessage('', C.cyan); },
    update: hhUpdate, draw: hhDraw, hint: 'あしおとに ちゅうい。すすむ・かくれる を えらぼう',
    pointer() {}, pointerUp() {}
  });
  GAME_TYPES.horror.canLeave = () => HH.phase !== 'play';
  GAME_TYPES.horror.beforeLeave = () => hhLeaveMid();
  GAME_TYPES.horror.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });
