'use strict';
  // =====================================================================
  //  LUCKY SLOT（5台目のメダルゲーム）
  //   SPIN(1枚) → 3つのリールが回る → 自分でSTOP → 同じ図柄が3つ揃えば配当
  //   STOPの位置から、0〜2コマ滑って止まる（目押しの意味はあるけれど、100%は狙えない）
  //   内部抽選はありません。結果は「リール配列 ＋ 押したタイミング ＋ 滑り」だけで決まります
  // =====================================================================
  const SLC = CONFIG.luckySlot;
  const SLD = SLC.debug;
  const SL_PRESET = SLC.presets[SLC.preset] || SLC.presets.balanced;
  const SL_KEYS = ['cherry', 'lemon', 'bell', 'star', 'diamond', 'red7'];
  const SL_NAMES = ['CHERRY', 'LEMON', 'BELL', 'STAR', 'DIAMOND', 'RED 7'];
  const SL_LETTER = { C: 0, L: 1, B: 2, S: 3, D: 4, '7': 5 };
  const SL_STRIPS = SLC.reels.map((s) => [...s].map((ch) => SL_LETTER[ch]));
  const SL_PAY = SL_KEYS.map((k) => SL_PRESET.payouts[k]);
  const SL_ROLE_P = SL_KEYS.map((k) => (SL_PRESET.roleProbs && SL_PRESET.roleProbs[k]) || 0);
  const SL_SLIPS = [];
  for (let k = SLC.slipMin; k <= SLC.slipMax; k++) SL_SLIPS.push({ k, w: SL_PRESET.slipWeights[k] || 0 });
  const slSymAt = (r, cell) => { const st = SL_STRIPS[r]; return st[((cell % st.length) + st.length) % st.length]; };

  const SL_CELL = 44;                                   // 1コマの高さ
  const SL_TOP = 56;                                    // 窓の上（3コマぶん：56〜188）
  const SL_MID = SL_TOP + SL_CELL + SL_CELL / 2;        // PAY LINE（まんなかの段）の中心
  let slReelX = (i) => 18 + i * 50;                     // リールの左はし（幅46）
  const slStopRect = (i) => ({ x: slReelX(i), y: 196, w: 46, h: 26 });
  const slDx = () => W - 180;                              // ワイド：広がったぶん
  let SL_SPIN = { x: 24, y: 252, w: 132, h: 34 };
  let SL_MSG_BOX = { x: 14, y: 332, w: 152, h: 25 };

  // URLに ?slotdebug=red7 を付けたときのデバッグ設定
  (function parseSlotDebug() {
    try {
      const q = new URLSearchParams(location.search).get('slotdebug');
      if (!q) return;
      SLD.enabled = true;
      SLD.force = q;
    } catch (e) { /* 何もしない */ }
  })();

  const SL = {
    phase: 'idle',                 // idle（SPINを待つ）/ spin（回転中）/ result（結果）
    t: 0, clock: 0,
    reels: [1, 12, 5].map((p) => ({ state: 'idle', pos: p, v: 0, p0: 0, landing: 0, D: 0, t: 0, T: 0.3, sym: 0 })),
    result: null, reach: null, role: -1,
    fx: [], banner: null, glow: null, noMedalT: 0, lastWin: 0
  };

  // ---------------------------------------------------------------------
  //  効果音（機械的な短いSE）
  // ---------------------------------------------------------------------
  const SLS = {
    spin() { beep(300, 0, 0.12, 0.04, 'square', 520); noise(0.15, 0.03); },
    tick() { noise(0.015, 0.012); },
    press() { beep(900, 0, 0.03, 0.05, 'square'); },
    clack() { noise(0.07, 0.07); beep(150, 0, 0.08, 0.07, 'square', 70); },                 // ガチャン！
    chance(strong) { [880, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.1, 0.05, 'square')); if (strong) [1760, 2349].forEach((f, i) => beep(f, 0.3 + i * 0.09, 0.12, 0.05, 'square')); },
    miss() { beep(260, 0, 0.1, 0.04, 'square', 160); },
    coins(k, step) { for (let i = 0; i < k; i++) beep(rand(1800, 2700), i * step, 0.03, 0.03); },
    win(n) { [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); SLS.coins(Math.min(n, 20), 0.05); },
    big(n) { [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => beep(f, i * 0.08, 0.12, 0.05)); SLS.coins(Math.min(n, 30), 0.05); },
    jackpot(n) { [784, 784, 784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.1, 0.14, 0.05)); SLS.coins(Math.min(n, 40), 0.06); },
    nomedal() { beep(260, 0, 0.12, 0.05, 'square', 180); }
  };

  // ---------------------------------------------------------------------
  //  SPIN と STOP
  // ---------------------------------------------------------------------
  function slSpin() {
    if (SL.phase === 'result') slFinishResult();        // 結果を飛ばして、すぐ次のゲームへ
    if (SL.phase !== 'idle') return;
    if (hand < SLC.betCost) {
      SL.noMedalT = 1.8;
      setMessage('メダルがありません。席を立って貸出機へ行こう', C.pink);
      SLS.nomedal();
      return;
    }
    hand -= SLC.betCost;
    D_().played = true;
    D_().stats.slot.plays++;
    P_().records.slot.plays++;
    noteMedals();
    SL.phase = 'spin';
    SL.t = 0;
    SL.reach = null;
    SL.glow = null;
    SL.banner = null;
    SL.lastWin = 0;
    SL.role = slRollRole();
    SL.reels.forEach((r, i) => {
      r.state = 'spin';
      r.v = SLC.reelSpeed * (SLC.reelSpeedMul[i] || 1);
      r.pos = Math.random() * SL_STRIPS[i].length;
    });
    SLS.spin();
    setMessage('ガラガラ……！ STOPを押して揃えよう！', C.text);
    writeSave();
  }

  function slRollRole() {                                        // SPIN時に、内部成立役を決める（-1 ＝ ハズレ）
    let r = Math.random();
    for (let k = 0; k < SL_ROLE_P.length; k++) { r -= SL_ROLE_P[k]; if (r < 0) return k; }
    return -1;
  }
  function slControl(i, base) {                                  // リール制御：成立役は引き込む。成立していない役は、揃わないようにする
    const others = SL.reels.map((r, j) => ({ r, j })).filter((o) => o.j !== i && (o.r.state === 'stopping' || o.r.state === 'stopped'));
    const osyms = others.map((o) => slSymAt(o.j, o.r.landing));
    const wouldTriple = (sym) => osyms.length === 2 && osyms[0] === osyms[1] && sym === osyms[0];
    if (SL.role >= 0) {
      for (let k = SLC.slipMin; k <= SLC.slipMax; k++) if (slSymAt(i, base + k) === SL.role) return base + k;       // 取れる位置なら、引き込む
    }
    let c = base + slPickSlip();                                  // 取りこぼし・ハズレ：滑りは重みで決めて、役が揃うことだけ避ける
    for (let t = 0; t < 8 && wouldTriple(slSymAt(i, c)); t++) c++;
    return c;
  }
  function slPickSlip() {
    const total = SL_SLIPS.reduce((a, s) => a + s.w, 0);
    if (total <= 0) return 0;
    let r = Math.random() * total;
    for (const s of SL_SLIPS) { r -= s.w; if (r < 0) return s.k; }
    return SL_SLIPS[SL_SLIPS.length - 1].k;
  }

  // デバッグ用：結果を固定するときの止まる位置
  function slForcedLanding(i, base) {
    if (!SLD.enabled || !SLD.force) return null;
    const f = SLD.force;
    const find = (pred) => { for (let k = 0; k < 60; k++) if (pred(slSymAt(i, base + k))) return base + k; return null; };
    const symOf = { cherry: 0, lemon: 1, bell: 2, star: 3, diamond: 4, red7: 5 };
    if (f in symOf) return find((s) => s === symOf[f]);
    const others = SL.reels.map((r, j) => ({ r, j })).filter((o) => o.j !== i && o.r.state !== 'spin' && o.r.state !== 'idle');
    if (f === 'reach7') return others.length < 2 ? find((s) => s === 5) : find((s) => s !== 5);   // 7｜7｜？
    if (f === 'miss') {
      const syms = others.map((o) => slSymAt(o.j, o.r.landing));
      return syms.length === 2 && syms[0] === syms[1] ? find((s) => s !== syms[0]) : null;
    }
    return null;
  }

  function slStop(i) {
    if (SL.phase !== 'spin') return;
    const r = SL.reels[i];
    if (r.state !== 'spin') return;
    r.p0 = r.pos;
    const base = Math.ceil(r.pos - SLC.snap);              // 押したときに、まんなかにある（あるいは、すぐ来る）図柄
    const forced = slForcedLanding(i, base);
    r.landing = forced !== null ? forced : slControl(i, base);        // 成立役を、滑り範囲に入っていれば引き込む
    r.D = r.landing - r.p0;
    r.T = Math.max(0.12, Math.min(0.7, (2 * Math.abs(r.D)) / r.v));
    r.t = 0;
    r.state = 'stopping';
    SLS.press();
  }

  const slEaseBack = (s) => { const c1 = 1.1; const c3 = c1 + 1; return 1 + c3 * Math.pow(s - 1, 3) + c1 * Math.pow(s - 1, 2); };

  function slReelStopped(i) {                               // 1つのリールが、ガチャン！と止まった
    const r = SL.reels[i];
    r.state = 'stopped';
    r.pos = r.landing;
    r.sym = slSymAt(i, r.landing);
    SLS.clack();
    const stopped = SL.reels.filter((x) => x.state === 'stopped');
    if (stopped.length === 3) { slEvaluate(); return; }
    if (stopped.length === 2) {
      const rest = SL.reels.findIndex((x) => x.state === 'spin');
      if (rest >= 0 && stopped[0].sym === stopped[1].sym) {   // リーチ：7｜7｜？
        const strong = stopped[0].sym >= 4;
        SL.reach = { sym: stopped[0].sym, strong, rest };
        SLS.chance(strong);
        setMessage(SL_NAMES[stopped[0].sym] + '……！ ' + SL_NAMES[stopped[0].sym] + '……！期待！', strong ? C.yellow : C.cyan);
      }
    }
  }

  function slEvaluate() {
    const line = SL.reels.map((r) => r.sym);
    const win = line[0] === line[1] && line[1] === line[2];
    SL.phase = 'result';
    SL.t = 0;
    SL.reach = null;
    const sym = line[0];
    const pay = recBonus('slot', win ? SL_PAY[sym] * SLC.betCost : 0);
    SL.result = { win, sym, pay, line };
    SL.lastWin = pay;
    if (win) {
      hand += pay;
      const st = D_().stats.slot;
      const rec = P_().records.slot;
      st.wins++; rec.wins++;
      st.bestPayout = Math.max(st.bestPayout, pay);
      rec.bestPayout = Math.max(rec.bestPayout, pay);
      rec.sym[SL_KEYS[sym]]++;
      if (sym === 5) { st.red7++; rec.red7++; }
      if (sym === 4) { st.diamond++; rec.diamond++; }
      noteMedals();
      const jackpot = sym === 5;
      const big = sym === 4;
      const n = Math.min(pay, jackpot ? 44 : big ? 30 : 18);
      for (let k = 0; k < n; k++) SL.fx.push({ type: 'coin', x: SL_WINX() + 10 + Math.random() * (132 + (W - 180)), y: 40 - Math.random() * 30, vy: rand(0.5, 1.4), wait: (k / n) * (jackpot ? 2.2 : 1), t: 0, dur: 4 });
      if (jackpot || big) for (let k = 0; k < 16; k++) { const a = rand(0, 6.28); const sp = rand(0.6, 2.2); SL.fx.push({ type: 'star', x: 90, y: SL_MID, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, t: 0, dur: rand(0.7, 1.3), color: ['#fff8d0', '#ffd040', '#ff8ef0', '#9ff8ff'][k % 4] }); }
      if (jackpot) { SL.glow = { t: 0, dur: 4 }; SLS.jackpot(pay); }
      else if (big) SLS.big(pay); else SLS.win(pay);
      SL.banner = jackpot
        ? { lines: [{ text: 'JACKPOT!!', scale: 3, color: '#ffe070' }, { text: '+' + pay + ' MEDALS', scale: 2, color: '#ff8ef0' }], t: 0, dur: SLC.resultTime.jackpot - 0.6 }
        : big
          ? { lines: [{ text: 'BIG WIN!', scale: 3, color: '#9ff8ff' }, { text: '+' + pay + ' MEDALS', scale: 2, color: '#ffe070' }], t: 0, dur: SLC.resultTime.big - 0.5 }
          : { lines: [{ text: 'WIN!!', scale: 3, color: '#ffe070' }, { text: '+' + pay + ' MEDALS', scale: 2, color: '#7dff8a' }], t: 0, dur: SLC.resultTime.win - 0.4 };
      setMessage((jackpot ? 'ジャックポット！！ ' : big ? 'ダイヤが揃った！' : '揃った！') + SL_NAMES[sym] + ' ×3  +' + pay + '枚！', C.goldLight);
    } else {
      SLS.miss();
      SL.banner = { lines: [{ text: 'MISS', scale: 3, color: '#a0b0ff' }], t: 0, dur: SLC.resultTime.miss - 0.3 };
      setMessage('残念……もう一回！', C.dim);
    }
    writeSave();
  }
  const SL_WINX = () => 14;

  function slFinishResult() {
    SL.phase = 'idle';
    SL.t = 0;
    SL.banner = null;
    SL.glow = null;
    SL.fx = SL.fx.filter((f) => f.type === 'coin');
    SL.reels.forEach((r) => { r.state = 'idle'; });
    if (hand < SLC.betCost) setMessage('メダルがない！席を立って貸出機へ行こう', C.pink);
    else setMessage('SPINを押して、 STOPで揃えよう！', C.cyan);
  }

  // ---------------------------------------------------------------------
  //  毎フレームの更新
  // ---------------------------------------------------------------------
  function slUpdate(dt) {
    SL.clock += dt;
    SL.t += dt;
    if (SL.noMedalT > 0) SL.noMedalT -= dt;
    if (SL.banner) { SL.banner.t += dt; if (SL.banner.t > SL.banner.dur) SL.banner = null; }
    if (SL.glow) { SL.glow.t += dt; if (SL.glow.t > SL.glow.dur) SL.glow = null; }
    for (let i = SL.fx.length - 1; i >= 0; i--) {
      const f = SL.fx[i];
      if (f.wait > 0) { f.wait -= dt; continue; }
      f.t += dt;
      if (f.type === 'coin') { f.y += f.vy; f.vy += 0.09; }
      if (f.type === 'star') { f.x += f.vx; f.y += f.vy; f.vy += 0.05; }
      if (f.t >= f.dur || f.y > 200) SL.fx.splice(i, 1);
    }
    if (SL.fx.length > 160) SL.fx.splice(0, SL.fx.length - 160);
    SL.reels.forEach((r, i) => {
      if (r.state === 'spin') {
        const before = Math.floor(r.pos);
        r.pos += r.v * dt;
        if (i === 0 && Math.floor(r.pos) !== before) SLS.tick();         // ガラガラ
      } else if (r.state === 'stopping') {
        r.t += dt;
        const s = Math.min(1, r.t / r.T);
        r.pos = r.p0 + r.D * slEaseBack(s);
        if (s >= 1) slReelStopped(i);
      }
    });
    if (SL.phase === 'result') {
      const dur = SL.result.win ? (SL.result.sym === 5 ? SLC.resultTime.jackpot : SL.result.sym === 4 ? SLC.resultTime.big : SLC.resultTime.win) : SLC.resultTime.miss;
      if (SL.t >= dur) slFinishResult();
    }
  }

  function slPointer(e, p) {
    ensureAudio();
    if (SL.phase === 'spin') {
      for (let i = 0; i < 3; i++) if (inRect(p, slStopRect(i))) { slStop(i); return; }
    }
    if (inRect(p, SL_SPIN)) slSpin();
  }
  function slKey(k) {                                           // キーボード：A S D で STOP、スペースで SPIN
    const i = { a: 0, s: 1, d: 2 }[String(k).toLowerCase()];
    if (i !== undefined) { slStop(i); return true; }
    return false;
  }

  // ---------------------------------------------------------------------
  //  保存（リールの途中状態は保存しません）
  // ---------------------------------------------------------------------
  function slResetDay() {
    SL.phase = 'idle'; SL.t = 0; SL.banner = null; SL.glow = null; SL.fx = []; SL.result = null; SL.reach = null; SL.lastWin = 0;
    SL.reels.forEach((r) => { r.state = 'idle'; });
  }
  const slCanLeave = () => SL.phase === 'idle' || SL.phase === 'result';       // 結果の表示中でも、払い出しは済んでいる
  function slEnter() {
    if (hand < SLC.betCost) setMessage('メダルがないよ。席を立って貸出機へ行こう', C.pink);
    else setMessage('SPINを押して、 STOPで揃えよう！', C.cyan);
  }

  // ---------------------------------------------------------------------
  //  図柄のドット絵（コードで描きます。丸っこくて、顔のない、昔ながらの図柄）
  // ---------------------------------------------------------------------
  function slPoly(pts) {
    return (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0]; const yi = pts[i][1]; const xj = pts[j][0]; const yj = pts[j][1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
  }
  function slBuildSymbol(kind) {
    const S = 18;
    const OUT = '#3a0a14';
    let inside;
    let color;
    if (kind === 0) {                                                       // CHERRY
      const d1 = (x, y) => Math.hypot(x - 5, y - 12.5) <= 4.4;
      const d2 = (x, y) => Math.hypot(x - 12.5, y - 12) <= 4.4;
      const near = (x, y, x0, y0, x1, y1) => {
        const t = Math.max(0, Math.min(1, ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2)));
        return Math.hypot(x - (x0 + t * (x1 - x0)), y - (y0 + t * (y1 - y0))) <= 0.8;
      };
      const stem = (x, y) => near(x, y, 5.5, 8.5, 10, 2) || near(x, y, 12.5, 8, 10, 2);
      const leaf = slPoly([[10, 2], [14, 0.8], [16.5, 3], [12, 4.2]]);
      inside = (x, y) => d1(x, y) || d2(x, y) || stem(x, y) || leaf(x, y);
      color = (x, y) => {
        if (leaf(x, y)) return '#4ab04a';
        if (stem(x, y) && !d1(x, y) && !d2(x, y)) return '#7a8a2a';
        const cx = d1(x, y) && (!d2(x, y) || Math.hypot(x - 5, y - 12.5) < Math.hypot(x - 12.5, y - 12)) ? 5 : 12.5;
        const cy = cx === 5 ? 12.5 : 12;
        if (x - cx < -0.5 && y - cy < -0.5 && Math.hypot(x - (cx - 1.6), y - (cy - 1.8)) < 1.7) return '#ffc0c8';
        if (y - cy > 2) return '#a01028';
        return '#e8283c';
      };
    } else if (kind === 1) {                                                // LEMON
      const tipL = slPoly([[0.5, 9.5], [3.2, 7.2], [3.2, 11.8]]);
      const tipR = slPoly([[17.5, 9.5], [14.8, 7.2], [14.8, 11.8]]);
      inside = (x, y) => ((x - 9) / 7.6) ** 2 + ((y - 9.5) / 5.8) ** 2 <= 1 || tipL(x, y) || tipR(x, y);
      color = (x, y) => (x > 4 && x < 9 && y < 8 && y > 5.5 ? '#fff8a0' : y > 12.2 ? '#d8a010' : '#ffe040');
    } else if (kind === 2) {                                                // BELL
      const body = slPoly([[7, 3.2], [11, 3.2], [12.5, 5], [13.4, 10], [14.6, 13], [16.6, 14], [16.6, 15.6], [1.4, 15.6], [1.4, 14], [3.4, 13], [4.6, 10], [5.5, 5]]);
      inside = (x, y) => body(x, y) || Math.hypot(x - 9, y - 2.4) <= 1.8 || Math.hypot(x - 9, y - 16.4) <= 1.7;
      color = (x, y) => (y > 16 ? '#c8861a' : x < 7.8 && y < 12 && y > 5 ? '#fff0a0' : x > 11.5 && y > 6 ? '#c88a10' : '#ffc830');
    } else if (kind === 3) {                                                // STAR
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 ? 3.8 : 8.7;
        pts.push([9 + Math.cos(a) * r, 9.8 + Math.sin(a) * r]);
      }
      inside = slPoly(pts);
      color = (x, y) => (x < 9 && y < 9 ? '#fff4a0' : y > 11.5 ? '#d8a010' : '#ffd83a');
    } else if (kind === 4) {                                                // DIAMOND
      inside = slPoly([[4.5, 3], [13.5, 3], [17, 8], [9, 16.8], [1, 8]]);
      color = (x, y) => {
        if (x < 6 && y < 6.2 && x > 4) return '#ffffff';
        if (y < 8) return x < 9 ? '#a8f0ff' : '#58d0ff';
        return x < 9 ? '#40b4f4' : '#2a80d0';
      };
    } else {                                                                // RED 7
      const bar = (x, y) => x >= 3 && x <= 15.5 && y >= 3 && y <= 6.2;
      const serif = (x, y) => x >= 3 && x <= 5.6 && y >= 3 && y <= 8;
      const stroke = (x, y) => y >= 5 && y <= 16.5 && Math.abs(x - (14.6 - (y - 5) * 0.74)) <= 2.3;
      inside = (x, y) => bar(x, y) || serif(x, y) || stroke(x, y);
      color = (x, y) => (y < 4.6 ? '#ff8a90' : x > 11 && y < 7 ? '#c01430' : stroke(x, y) && x > 12 - (y - 5) * 0.74 ? '#c01430' : '#ff2840');
    }
    const g = [];
    for (let y = 0; y < S; y++) { g.push([]); for (let x = 0; x < S; x++) g[y].push(inside(x + 0.5, y + 0.5)); }
    const c = makeCanvas(S, S);
    const gx = c.getContext('2d');
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (!g[y][x]) continue;
        const edge = !(g[y][x - 1] && g[y][x + 1] && (g[y - 1] || [])[x] && (g[y + 1] || [])[x]);
        gx.fillStyle = edge ? OUT : color(x + 0.5, y + 0.5);
        gx.fillRect(x, y, 1, 1);
      }
    }
    const big = makeCanvas(S * 2, S * 2);
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(c, 0, 0, S * 2, S * 2);
    return { big, mini: c };
  }
  const SL_SPR = [0, 1, 2, 3, 4, 5].map(slBuildSymbol);

  // ---------------------------------------------------------------------
  //  描画
  // ---------------------------------------------------------------------
  function drawSlotFrame() {
    rect(0, 0, W, H, '#14040a');
    rect(1, 1, W - 2, H - 2, '#8a1626');
    rect(8, 8, W - 16, H - 16, '#0a0206');
    const chase = Math.floor(SL.clock * 2);
    bulbs.forEach(([x, y], i) => rect(x, y, 2, 2, (i + chase) % 3 === 0 ? (i % 2 ? '#ffd040' : '#fff3c0') : '#6a3a18'));
  }

  function drawSlotHud() {
    const dx = W - 180; const hx = Math.round(dx / 2);
    rect(24, 11, 132 + dx, 22, '#2a0610');
    rect(24, 11, 132 + dx, 1, '#ffd040'); rect(24, 32, 132 + dx, 1, '#ffd040');
    rect(24, 11, 1, 22, '#ffd040'); rect(155 + dx, 11, 1, 22, '#ffd040');
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(SL.clock * 1.5);
    rect(26, 13, 128 + dx, 18, '#ff6070');
    ctx.globalAlpha = 1;
    drawStar(32, 22, '#ffd040');
    drawStar(148 + dx, 22, '#ffd040');
    drawTextCenter('LUCKY SLOT', 90 + hx, 17, '#fff0b0', 2, '#7a1020');
    const lit = SL.glow ? 0.55 + 0.45 * Math.sin(SL.clock * 4) : 0;
    for (let k = 0; k < 3; k++) {
      const lx = 60 + hx + k * 21;
      rect(lx, 36, 18, 11, '#1a0408');
      rect(lx + 1, 37, 16, 9, '#4a0e18');
      if (lit > 0) { ctx.globalAlpha = lit; rect(lx + 1, 37, 16, 9, '#ffb030'); ctx.globalAlpha = 1; }
      drawTextCenter('7', lx + 9.5, 39, lit > 0 ? '#fff3b0' : '#c02838', 1);
    }
  }

  function drawSlotReels() {
    // 窓のわく
    const dx = W - 180; const hx = Math.round(dx / 2);
    rect(14, 52, 152 + dx, 140, '#3a0a14');
    rect(14, 52, 152 + dx, 2, '#ffd040'); rect(14, 190, 152 + dx, 2, '#ffd040');
    rect(14, 52, 2, 140, '#ffd040'); rect(164 + dx, 52, 2, 140, '#ffd040');
    const pulse = 0.5 + 0.5 * Math.sin(SL.clock * 5);
    SL.reels.forEach((r, i) => {
      const x0 = slReelX(i);
      rect(x0, SL_TOP, 46, SL_CELL * 3, '#fff6dc');
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, SL_TOP, 46, SL_CELL * 3);
      ctx.clip();
      const base = Math.floor(r.pos);
      for (let k = base - 2; k <= base + 3; k++) {
        const yc = SL_MID + (r.pos - k) * SL_CELL;                          // 下へ流れる
        if (yc < SL_TOP - 24 || yc > SL_TOP + SL_CELL * 3 + 24) continue;
        const sym = slSymAt(i, k);
        ctx.drawImage(SL_SPR[sym].big, x0 + 5, Math.round(yc - 18));
      }
      // 円柱のように、上下をうすく暗く
      ctx.globalAlpha = 0.3; rect(x0, SL_TOP, 46, 12, '#3a1010'); rect(x0, SL_TOP + SL_CELL * 3 - 12, 46, 12, '#3a1010');
      ctx.globalAlpha = 0.14; rect(x0, SL_TOP + 12, 46, 12, '#3a1010'); rect(x0, SL_TOP + SL_CELL * 3 - 24, 46, 12, '#3a1010');
      ctx.globalAlpha = 1;
      ctx.restore();
      rect(x0 - 1, SL_TOP, 1, SL_CELL * 3, '#8a1626'); rect(x0 + 46, SL_TOP, 1, SL_CELL * 3, '#8a1626');
      if (SL.reach && SL.reach.rest === i && r.state === 'spin') {                // リーチ：最後のリールを強調
        ctx.globalAlpha = 0.45 + 0.4 * pulse;
        const col = SL.reach.strong ? '#ff5060' : '#ffd040';
        rect(x0 - 2, SL_TOP - 2, 50, 2, col); rect(x0 - 2, SL_TOP + SL_CELL * 3, 50, 2, col);
        rect(x0 - 2, SL_TOP - 2, 2, SL_CELL * 3 + 4, col); rect(x0 + 46, SL_TOP - 2, 2, SL_CELL * 3 + 4, col);
        ctx.globalAlpha = 1;
      }
    });
    // PAY LINE
    const hot = SL.reach || (SL.phase === 'result' && SL.result && SL.result.win);
    ctx.globalAlpha = hot ? 0.55 + 0.45 * pulse : 0.85;
    rect(16, SL_MID - 1, 148, 2, '#ff3050');
    ctx.globalAlpha = 1;
    rect(8, SL_MID - 3, 6, 6, '#ffd040'); rect(166, SL_MID - 3, 6, 6, '#ffd040');
    rect(10, SL_MID - 1, 4, 2, '#8a1626'); rect(166, SL_MID - 1, 4, 2, '#8a1626');
    // 当たりの図柄を、ほんのり光らせる
    if (SL.phase === 'result' && SL.result && SL.result.win) {
      ctx.globalAlpha = 0.18 + 0.12 * pulse;
      for (let i = 0; i < 3; i++) rect(slReelX(i), SL_MID - SL_CELL / 2, 46, SL_CELL, '#ffe070');
      ctx.globalAlpha = 1;
    }
    // CHANCE!（リーチ）
    if (SL.reach && SL.phase === 'spin') {
      ctx.globalAlpha = 0.8;
      rect(14, SL_TOP + 2, 152 + dx, 18, '#05020a');
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      drawTextCenter(SL.reach.strong ? 'BIG CHANCE!!' : 'CHANCE!', 90 + hx, SL_TOP + 5, SL.reach.strong ? '#ff7080' : '#ffe070', 2, '#2a0a10');
      ctx.globalAlpha = 1;
    }
    // 結果
    const b = SL.banner;
    if (b) {
      const a = Math.min(1, b.t / 0.12, (b.dur - b.t) / 0.25);
      const heights = b.lines.map((l) => 5 * l.scale);
      const total = heights.reduce((x, y) => x + y, 0) + (b.lines.length - 1) * 4;
      const y0 = SL_TOP + 22 - total / 2 + (b.lines.length > 1 ? 4 : 0);
      ctx.globalAlpha = Math.max(0, a) * 0.82;
      rect(14, y0 - 4, 152 + dx, total + 8, '#05020a');
      ctx.globalAlpha = Math.max(0, a);
      let yy = y0;
      b.lines.forEach((l, k) => { drawTextCenter(l.text, 90 + hx, yy, l.color, l.scale, '#2a0a10'); yy += heights[k] + 4; });
      ctx.globalAlpha = 1;
    }
    // メダル・星・光
    for (const f of SL.fx) {
      if (f.wait > 0) continue;
      if (f.type === 'coin') drawCoinSprite(coinFull, f.x, f.y);
      else if (f.type === 'star') { ctx.globalAlpha = Math.max(0, 1 - f.t / f.dur); drawStar(px(f.x), px(f.y), f.color); ctx.globalAlpha = 1; }
    }
    if (SL.glow) {
      const env = Math.sin(Math.PI * Math.min(1, SL.glow.t / SL.glow.dur));
      ctx.globalAlpha = 0.16 * env;
      rect(14, 52, 152 + dx, 140, '#ffd040');
      ctx.globalAlpha = 1;
    }
  }

  function drawSlotButtons() {
    const pulse = 0.5 + 0.5 * Math.sin(SL.clock * 5);
    for (let i = 0; i < 3; i++) {
      const r = slStopRect(i);
      const live = SL.phase === 'spin' && SL.reels[i].state === 'spin';
      const hot = live && SL.reach && SL.reach.rest === i;
      rect(r.x, r.y, r.w, r.h, live ? '#ffd040' : '#3a1a20');
      rect(r.x, r.y, r.w, 2, live ? '#fff3b0' : '#5a2a32');
      rect(r.x, r.y + r.h - 3, r.w, 3, live ? '#b07a08' : '#240a10');
      if (hot) { ctx.globalAlpha = 0.25 + 0.25 * pulse; rect(r.x, r.y, r.w, r.h, '#ffffff'); ctx.globalAlpha = 1; }
      drawTextCenter('STOP', r.x + r.w / 2 + 0.5, r.y + 9, live ? '#5a0a14' : '#7a4a52', 2);
    }
    // MEDAL と WIN
    const dx = W - 180; const hx = Math.round(dx / 2);
    rect(12, 226, 74 + hx, 22, '#1a0408'); rect(94 + hx, 226, 74 + dx - hx, 22, '#1a0408');
    rect(12, 226, 74 + hx, 1, '#6a1a28'); rect(94 + hx, 226, 74 + dx - hx, 1, '#6a1a28');
    drawText('MEDAL', 16, 229, C.dim, 1);
    drawText(String(hand), 82 + hx - textWidth(String(hand), 2), 236, C.goldLight, 2, '#3a2000');
    drawText('WIN', 98 + hx, 229, C.dim, 1);
    drawText(String(SL.lastWin), 164 + dx - textWidth(String(SL.lastWin), 2), 236, SL.lastWin > 0 ? '#7dff8a' : '#6a5a60', 2, '#0a2a10');
    // SPIN
    const b = SL_SPIN;
    const can = SL.phase !== 'spin';
    const noMed = SL.noMedalT > 0;
    rect(b.x, b.y, b.w, b.h, noMed ? '#4a1030' : can ? '#ff3a52' : '#3a1a20');
    rect(b.x, b.y, b.w, 3, noMed ? '#ff5090' : can ? '#ff9aa8' : '#5a2a32');
    rect(b.x, b.y + b.h - 3, b.w, 3, noMed ? '#8a2050' : can ? '#a01428' : '#240a10');
    if (can && !noMed) { ctx.globalAlpha = 0.08 + 0.07 * pulse; rect(b.x, b.y, b.w, b.h, '#ffffff'); ctx.globalAlpha = 1; }
    if (noMed) drawTextCenter('NO MEDAL', 90 + hx, b.y + 13, C.pink, 1);
    else if (can) {
      drawTextCenter('SPIN', b.x + 40 + Math.round(dx * 0.3), b.y + 10, '#ffffff', 2, '#6a0818');
      drawTextCenter(SLC.betCost + ' MEDAL', b.x + 96 + Math.round(dx * 0.7), b.y + 14, '#ffe9ee', 1);
    } else drawTextCenter('...', 90 + hx, b.y + 12, '#7a4a52', 1);
    // 配当表（そろった図柄 → 払い出し）
    for (let k = 0; k < 6; k++) {
      const pw = (158 + dx) / 3; const x = Math.round(12 + (k % 3) * pw);
      const y = 292 + Math.floor(k / 3) * 19;
      rect(x, y, Math.round(pw) - 2, 18, '#1a0408');
      ctx.drawImage(SL_SPR[k].mini, x + 2, y);
      drawText('+' + SL_PAY[k] * SLC.betCost, x + 24 + Math.round((pw - 52) / 2), y + 6, k === 5 ? '#ff8a90' : k === 4 ? '#9fe8ff' : '#ffe9b0', 1);
    }
  }

  function drawSlotScreen() {
    drawSlotFrame();
    drawSlotHud();
    drawSlotReels();
    drawSlotButtons();
    const st = D_().stats.slot;
    const dx = W - 180;
    rect(12, 360, 156 + dx, 12, '#14040a');
    drawText('PLAY ' + st.plays, 16, 363, '#e8f0ff', 1);
    drawText('WIN ' + st.wins, 62 + Math.round(dx * 0.3), 363, '#7dff8a', 1);
    drawText('BEST +' + st.bestPayout, 106 + Math.round(dx * 0.65), 363, '#ffe070', 1);
  }

