'use strict';
  // =====================================================================
  //  🏒 AIR SMASH（エアースマッシュ）：6F SPORTS CORNER
  //   指で青いマレットを直接ドラッグして、赤いCPUより先に5点。制限時間は なし（見えない安全タイマー約3分）
  //   CPUは、毎プレイ開始時に、5段階の強さ（cpuProfiles）から ランダムに決まる。強さは、画面のどこにも出さない（DEV画面だけ）。試合中は、固定（ラバーバンドなし）
  //   CPUは、少し前（reactionDelay）のパックの状態から、軌道を予測して動く。パックを直接動かさず、マレットで打つ（プレイヤーと同じ物理）
  //   物理：2Dの円。固定ステップ（1/240秒）で、すりぬけ・めりこみを防ぐ。パックには最大速度・ごくわずかな摩擦。ゲームの記録・報酬は、なし
  // =====================================================================
  const ASC = CONFIG.airSmash;
  const AS_MACHINE = { machineId: 'as_airsmash', machineName: 'AIR SMASH', label: 'AIR SMASH', isUnlocked: true, gameType: 'airSmash', as: true };
  const AS = { phase: 'select', t: 0, clock: 0, score: { you: 0, cpu: 0 }, level: 3, prof: null, puck: null, pm: null, cm: null, matchTime: 0, sudden: false, goalT: 0, banner: '', bannerT: 0, flash: 0, flashCol: '#ffffff', winner: '', grab: null, hist: [], stuckT: 0, serveT: 0, sfxCd: 0, lastScorer: '', trail: [], cnt: 3,
    ai: { cpu: null, you: null }, dev: { noAi: false, level: 0, show: false, cpuTarget: false, pred: false, colliders: false, puckSpeed: 0, safety: 0, bot: false, vel: false } };
  function asGeo() {
    const bw = W - 28; const bh = H - 72; const g = { bx: 14, by: 36, bw, bh, cx: 14 + bw / 2, cy: 36 + bh / 2, gw: bw * ASC.goalWidth, pr: bw * ASC.puckRadius, mr: bw * ASC.malletRadius };
    g.homeY = ASC.homeY * bh; return g;
  }
  const asGauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.sqrt(0.5); };
  function asPickLevel() { if (AS.dev.level > 0) return AS.dev.level; const w = ASC.cpuLevelWeights; let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { if (r < w[i]) return i + 1; r -= w[i]; } return 3; }       // 試合のはじめに、1回だけ抽選
  function asResetMallets() { const g = asGeo(); AS.pm = { x: g.cx, y: g.by + g.bh - g.homeY, vx: 0, vy: 0, vvx: 0, vvy: 0, tx: g.cx, ty: g.by + g.bh - g.homeY }; AS.cm = { x: g.cx, y: g.by + g.homeY, vx: 0, vy: 0, vvx: 0, vvy: 0, tx: g.cx, ty: g.by + g.homeY }; }
  function asServe(towardYou) {                                                                                         // パックを中央へ（点を取られた側のほうへ、少しよせる）
    const g = asGeo(); AS.puck = { x: g.cx, y: g.cy + (towardYou ? 18 : -18), vx: 0, vy: 0 }; AS.hist = []; AS.stuckT = 0; AS.stuckA = null; AS.trail = [];
  }
  function asNewMatch() {
    AS.score = { you: 0, cpu: 0 }; AS.level = asPickLevel(); AS.prof = ASC.cpuProfiles[AS.level]; AS.matchTime = 0; AS.sudden = false; AS.winner = ''; AS.lastScorer = ''; AS.banner = ''; AS.flash = 0; AS.grab = null; AS.ai = { cpu: asAiInit(), you: asAiInit() };
    asResetMallets(); asServe(Math.random() < 0.5);
  }
  // ---- CPU：状態は、DEFENSE（守る）／NEUTRAL（もどる）／ATTACK（打つ）。少し前の情報で、軌道を予測する。パックには、ちょく接さわらない ----
  const asAiInit = () => ({ state: 'NEUTRAL', ex: 0, exT: 0, atkUntil: 0, atkAim: 0, atkAimT: -9, striking: false, tgt: { x: 0, y: 0 }, vx: 0, vy: 0, pred: null });
  function asPredictX(px, py, vx, vy, lineY, g) {                                                                       // 局所座標（自分のゴールが y=0）で、パックが自陣のラインに来るときの x（かべの反射つき）
    if (vy >= -1) return null; const t = (py - lineY) / -vy; if (t < 0 || t > 3) return null; let x = px + vx * t; const lo = g.bx + g.pr; const hi = g.bx + g.bw - g.pr; const span = hi - lo; let u = (x - lo) % (2 * span); if (u < 0) u += 2 * span; x = lo + (u > span ? 2 * span - u : u); return { x, t };
  }
  function asAiStep(side, prof, dt) {
    const g = asGeo(); const m = side === 'cpu' ? AS.cm : AS.pm; const st = AS.ai[side]; const sgn = side === 'cpu' ? 1 : -1;                                // cpu＝上（局所yは、そのまま）／you（bot）＝下（上下反転）
    const toL = (y) => (side === 'cpu' ? y - g.by : g.by + g.bh - y); const toW = (yl) => (side === 'cpu' ? g.by + yl : g.by + g.bh - yl);
    const want = AS.clock - prof.reaction; let s = AS.hist[0] || AS.puck; for (let i = AS.hist.length - 1; i >= 0; i--) { if (AS.hist[i].t <= want) { s = AS.hist[i]; break; } }              // reaction秒まえの、パックの状態
    const px = s.x; const py = toL(s.y); const pvx = s.vx; const pvy = side === 'cpu' ? s.vy : -s.vy; const half = g.bh / 2; const speed = Math.hypot(pvx, pvy); const hy = g.homeY;
    if (AS.clock > st.exT) { st.ex = asGauss() * prof.error; st.exT = AS.clock + 0.35 + Math.random() * 0.2; }                                          // 位置どりの、ブレ
    let state = 'NEUTRAL'; const inHalf = py < half - g.mr * 0.8;
    if (inHalf && speed < prof.attackSpeed && (st.state === 'ATTACK' || AS.clock > st.atkUntil)) { if (st.state !== 'ATTACK') { if (Math.random() < prof.aggression) { st.atkUntil = AS.clock + 0.9; st.state = 'ATTACK'; st.striking = false; } else st.atkUntil = AS.clock + 0.3; } state = st.state === 'ATTACK' ? 'ATTACK' : 'NEUTRAL'; if (st.state === 'ATTACK' && AS.clock > st.atkUntil + 0.6) { st.state = 'NEUTRAL'; state = 'NEUTRAL'; } }
    else if (pvy < -25 || (inHalf && speed >= prof.attackSpeed)) { state = 'DEFENSE'; st.state = 'DEFENSE'; }
    else { st.state = 'NEUTRAL'; }
    let tx; let ty; let vmax = prof.speed; st.pred = null;
    if (state === 'DEFENSE') {
      const pr = asPredictX(px, py, pvx, pvy, hy, g); const base = px; let aimx = base; if (pr) { aimx = base * (1 - prof.prediction) + pr.x * prof.prediction; st.pred = { x: pr.x, y: toW(hy) }; }
      tx = aimx + st.ex; ty = hy - (speed < 220 ? 0 : 0) + Math.min(14, Math.max(0, (g.bh / 2 - py) * 0.0));
    } else if (state === 'ATTACK') {
      if (AS.clock - st.atkAimT > 0.5) { const pick = Math.random(); const gw = g.gw; st.atkAim = pick < 0.34 ? 0 : pick < 0.67 ? -gw * 0.32 : gw * 0.32; st.atkAim += asGauss() * prof.error * 1.2; st.atkAimT = AS.clock; }
      const ax = g.cx + st.atkAim; const ay = g.bh; let dx = ax - px; let dy = ay - py; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; const bx2 = px - dx * (g.mr + g.pr + 5); const by2 = py - dy * (g.mr + g.pr + 5); const my = toL(m.y); const dist = Math.hypot(bx2 - m.x, by2 - my);
      if (!st.striking && dist < 14) st.striking = true; if (st.striking && dist > 60) st.striking = false;
      if (st.striking) { tx = px + dx * 46; ty = py + dy * 46; vmax = prof.speed * 1.05; } else { tx = bx2; ty = by2; }
    } else { tx = g.cx + (px - g.cx) * 0.22 + st.ex * 0.5; ty = hy; vmax = prof.speed * 0.8; }
    tx = clamp(tx, g.bx + g.mr, g.bx + g.bw - g.mr); ty = clamp(ty, g.mr + 2, half - g.mr - 2); const wy = toW(ty); st.tgt = { x: tx, y: wy }; st.state = state === 'ATTACK' ? 'ATTACK' : state === 'DEFENSE' ? 'DEFENSE' : st.state === 'ATTACK' ? 'NEUTRAL' : st.state;
    m.tx = tx; m.ty = wy; m.vmax = vmax; m.accel = prof.accel;
  }
  // ---- 物理 ----
  function asStep(dt) {
    const g = asGeo(); const pk = AS.puck; const P = ASC; const prs = g.pr; AS.sfxCd -= dt; const playing = AS.phase === 'play';
    for (const side of ['you', 'cpu']) {                                                                                 // マレットの移動：目的の位置へ、さいだい速度・加速度のなかで（瞬間移動なし）
      const m = side === 'cpu' ? AS.cm : AS.pm; const px0 = m.x; const py0 = m.y; let dx = m.tx - m.x; let dy = m.ty - m.y; const d = Math.hypot(dx, dy);
      if (side === 'you' && !AS.dev.bot) { const step = Math.min(d, P.playerMaxSpeed * dt); if (d > 1e-6) { m.x += (dx / d) * step; m.y += (dy / d) * step; } }
      else { const vm = m.vmax || 300; let wvx = 0; let wvy = 0; if (d > 0.5) { const sp = Math.min(vm, d * 11); wvx = (dx / d) * sp; wvy = (dy / d) * sp; } const dvx = wvx - m.vvx; const dvy = wvy - m.vvy; const dl = Math.hypot(dvx, dvy); const ma = (m.accel || 1500) * dt; const k = dl > ma ? ma / dl : 1; m.vvx = (m.vvx || 0) + dvx * k; m.vvy = (m.vvy || 0) + dvy * k; m.x += m.vvx * dt; m.y += m.vvy * dt; }
      const lo = side === 'cpu' ? g.by + g.mr : g.cy + g.mr + 2; const hi = side === 'cpu' ? g.cy - g.mr - 2 : g.by + g.bh - g.mr; m.x = clamp(m.x, g.bx + g.mr, g.bx + g.bw - g.mr); m.y = clamp(m.y, lo, hi); m.vx = (m.x - px0) / dt; m.vy = (m.y - py0) / dt;
    }
    if (!playing) return;
    pk.vx *= Math.exp(-P.puckFriction * dt); pk.vy *= Math.exp(-P.puckFriction * dt); pk.x += pk.vx * dt; pk.y += pk.vy * dt;
    const L = g.bx + prs; const R = g.bx + g.bw - prs; if (pk.x < L) { pk.x = L; if (pk.vx < 0) { pk.vx = -pk.vx * P.wallRest; asSfx('wall', Math.abs(pk.vx)); } } else if (pk.x > R) { pk.x = R; if (pk.vx > 0) { pk.vx = -pk.vx * P.wallRest; asSfx('wall', Math.abs(pk.vx)); } }
    const open = Math.abs(pk.x - g.cx) <= g.gw / 2 - prs * 0.35;                                                          // ゴールの口（パックの半径をひいた はば）
    if (pk.y < g.by + prs && !open) { pk.y = g.by + prs; if (pk.vy < 0) { pk.vy = -pk.vy * P.wallRest; asSfx('wall', Math.abs(pk.vy)); } }
    if (pk.y > g.by + g.bh - prs && !open) { pk.y = g.by + g.bh - prs; if (pk.vy > 0) { pk.vy = -pk.vy * P.wallRest; asSfx('wall', Math.abs(pk.vy)); } }
    for (const py of [g.by, g.by + g.bh]) for (const sx of [-1, 1]) { const cxp = g.cx + sx * g.gw / 2; const dx = pk.x - cxp; const dy = pk.y - py; const dd = Math.hypot(dx, dy); const md = prs + P.postRadius; if (dd < md && dd > 0) { const nx = dx / dd; const ny = dy / dd; pk.x = cxp + nx * md; pk.y = py + ny * md; const vn = pk.vx * nx + pk.vy * ny; if (vn < 0) { pk.vx -= (1 + P.wallRest) * vn * nx; pk.vy -= (1 + P.wallRest) * vn * ny; asSfx('wall', Math.abs(vn)); } } }   // ゴールのポスト
    for (const m of [AS.pm, AS.cm]) {
      const dx = pk.x - m.x; const dy = pk.y - m.y; const dd = Math.hypot(dx, dy); const md = prs + g.mr; if (dd >= md || dd === 0) continue; const nx = dx / dd; const ny = dy / dd;
      pk.x = m.x + nx * md; pk.y = m.y + ny * md; const rvx = pk.vx - m.vx; const rvy = pk.vy - m.vy; const vn = rvx * nx + rvy * ny;                           // めりこみを おしだし、マレットの速度をふくめた あいてとの速さで、はねかえす
      if (vn < 0) { pk.vx -= (1 + P.malletRest) * vn * nx; pk.vy -= (1 + P.malletRest) * vn * ny; asSfx('mallet', Math.abs(vn)); }
      else { const sp = Math.hypot(m.vx, m.vy); if (sp > 20) { pk.vx += nx * Math.min(sp, 200) * 0.2; pk.vy += ny * Math.min(sp, 200) * 0.2; } }
    }
    pk.x = clamp(pk.x, L, R);                                                                                           // かべへの めりこみ防止
    const vmaxP = AS.dev.puckSpeed > 0 ? AS.dev.puckSpeed : P.puckMaxSpeed; const spd = Math.hypot(pk.vx, pk.vy); if (spd > vmaxP) { pk.vx *= vmaxP / spd; pk.vy *= vmaxP / spd; }
    if (pk.y < g.by - prs * 0.4) asGoal('you'); else if (pk.y > g.by + g.bh + prs * 0.4) asGoal('cpu');
    if (!isFinite(pk.x + pk.y) || pk.y < g.by - 60 || pk.y > g.by + g.bh + 60 || pk.x < g.bx - 20 || pk.x > g.bx + g.bw + 20) { asServe(true); AS.banner = 'RETRY!'; AS.bannerT = 1.1; }              // 万一、盤の外へ出たら、中央へ
  }
  function asSfx(kind, v) {                                                                                             // 音は、短いクールダウンで、かさなりすぎないように
    if (AS.sfxCd > 0 && kind !== 'goal') return; AS.sfxCd = 0.045; const k = clamp(v / ASC.puckMaxSpeed, 0, 1);
    if (kind === 'mallet') { beep(380 + 220 * k, 0, 0.06, 0.06 + 0.04 * k, 'square'); noise(0.025, 0.03 + 0.03 * k); }                // パンッ！
    else if (kind === 'wall') { beep(1500 + 400 * k, 0, 0.04, 0.045 + 0.03 * k, 'triangle'); }                                       // カン！
  }
  function asGoal(who) {                                                                                                // who＝点をとった側（'you' | 'cpu'）
    if (AS.phase !== 'play') return; AS.score[who]++; AS.lastScorer = who; AS.phase = 'goal'; AS.goalT = 0; AS.banner = 'GOAL!'; AS.bannerT = 1; AS.flash = 0.25; AS.flashCol = who === 'you' ? '#7ab8ff' : '#ff7a7a';
    beep(110, 0, 0.18, 0.09, 'square'); noise(0.12, 0.06); beep(who === 'you' ? 880 : 330, 0.05, 0.12, 0.05, 'triangle'); AS.puck.vx = 0; AS.puck.vy = 0;                                             // ガコン！
    const end = AS.sudden || AS.score[who] >= ASC.winScore; if (end) AS.winner = who;
  }
  function asEnd() { AS.phase = 'end'; AS.t = 0; AS.puck.vx = 0; AS.puck.vy = 0; if (AS.winner === 'draw') [523, 523, 659].forEach((f, i) => beep(f, i * 0.12, 0.16, 0.05, 'triangle')); else if (AS.winner === 'you') [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.06, 'triangle')); else [392, 330, 262, 196].forEach((f, i) => beep(f, i * 0.12, 0.2, 0.05, 'sine')); }
  // ---- 流れ ----
  function asBegin() {
    if (P_().money < ASC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(ASC.price); writeSave(); asNewMatch(); AS.phase = 'ready'; AS.t = 0; AS.cnt = 3; beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); beep(660, 0.25, 0.1, 0.05, 'square');
  }
  function asUpdate(dt) {
    AS.clock += dt; dt = Math.min(dt, 0.05); AS.t += dt; const ph = AS.phase; if (ph === 'select') { AS.sel = (AS.sel || 0) + dt; return; }
    if (AS.bannerT > 0) AS.bannerT -= dt; if (AS.flash > 0) AS.flash -= dt;
    if (ph === 'ready') { if (AS.t > (P_().airSmash.seenHint ? 0.8 : 2.2)) { P_().airSmash.seenHint = true; AS.phase = 'count'; AS.t = 0; AS.cnt = 3; beep(660, 0, 0.12, 0.06, 'square'); } }
    else if (ph === 'count') { const c = 3 - Math.floor(AS.t / 0.8); if (c !== AS.cnt && c >= 1) { AS.cnt = c; beep(660 + (3 - c) * 130, 0, 0.12, 0.06, 'square'); } if (AS.t >= 2.4) { AS.phase = 'serve'; AS.t = 0; AS.banner = 'START!'; AS.bannerT = 0.8; [1319, 1760, 2349].forEach((f, i) => beep(f, i * 0.05, 0.14, 0.07, 'square')); } }
    else if (ph === 'serve') { if (AS.t >= 0.5) { AS.phase = 'play'; AS.t = 0; } }
    else if (ph === 'goal') { AS.goalT += dt; if (AS.goalT >= ASC.goalResetDelay) { if (AS.winner) asEnd(); else { asResetMallets(); asServe(AS.lastScorer === 'you'); AS.phase = 'serve'; AS.t = 0; } } }
    else if (ph === 'end') { if (AS.t >= 1.6) { AS.phase = 'result'; AS.t = 0; } }
    if (ph === 'play' || ph === 'serve' || ph === 'goal') {
      if (ph === 'play') {
        AS.matchTime += dt; const safety = AS.dev.safety > 0 ? AS.dev.safety : ASC.safetyTime;                          // 見えない安全タイマー：えんちょう戦の防止
        if (AS.matchTime >= safety && !AS.sudden && !AS.winner) { if (AS.score.you !== AS.score.cpu) { AS.winner = AS.score.you > AS.score.cpu ? 'you' : 'cpu'; AS.phase = 'goal'; AS.goalT = ASC.goalResetDelay - 0.01; AS.banner = ''; } else { AS.sudden = true; AS.banner = 'NEXT GOAL WINS'; AS.bannerT = 1.6; } }
        const pk = AS.puck; const sp = Math.hypot(pk.vx, pk.vy);
        if (!AS.stuckA || Math.hypot(pk.x - AS.stuckA.x, pk.y - AS.stuckA.y) > ASC.stuckRadius) { AS.stuckA = { x: pk.x, y: pk.y }; AS.stuckT = 0; } else AS.stuckT += dt;                   // STUCK：パックが、ずっと同じ場所（stuckRadius以内）にいる。ちょんちょん つつかれていても、動けていなければ、数える
        if (AS.stuckT >= ASC.stuckTime) { asResetMallets(); asServe(true); AS.stuckT = 0; AS.stuckA = null; AS.phase = 'serve'; AS.t = 0; AS.banner = 'RETRY!'; AS.bannerT = 1.1; [880, 1175].forEach((f, i) => beep(f, i * 0.09, 0.1, 0.06, 'triangle')); }                    // パックが動けなくなったときは、「RETRY!」と出して、中央からやり直す（パックは、プレイヤー側に寄せる。得点はそのまま）
        AS.hist.push({ t: AS.clock, x: pk.x, y: pk.y, vx: pk.vx, vy: pk.vy }); while (AS.hist.length > 90) AS.hist.shift();
        if (sp > 380) { AS.trail.push({ x: pk.x, y: pk.y }); if (AS.trail.length > 4) AS.trail.shift(); } else if (AS.trail.length) AS.trail.shift();
        if (!AS.dev.noAi) { AS.aiAcc = (AS.aiAcc || 0) + dt; while (AS.aiAcc >= 1 / 60) { asAiStep('cpu', AS.prof, 1 / 60); if (AS.dev.bot) asAiStep('you', ASC.botProfile, 1 / 60); AS.aiAcc -= 1 / 60; } }                   // CPUの考えは、画面のフレームレートに関係なく、1秒に60回（60Hzでも120Hzでも、同じつよさ）
      }
      let rem = dt; const sub = 1 / 240; while (rem > 1e-7) { const d = Math.min(rem, sub); asStep(d); rem -= d; }
    }
  }
  // ---- 入力：青いマレットを、指で直接ドラッグ ----
  function asPointer(e, p) {
    if (AS.grab || AS.phase === 'select' || AS.phase === 'result' || AS.dev.bot) return; const g = asGeo(); const m = AS.pm; if (Math.hypot(p.x - m.x, p.y - m.y) > g.mr * 2.2) return;                             // マレットの近くを つかむ
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } AS.grab = { id: e.pointerId, ox: m.x - p.x, oy: Math.min(m.y - p.y, -ASC.fingerOffset) };                                          // つかんだあとは、マレットから指が はずれても、そのまま つづく
  }
  function asPointerMove(e, p) { const gr = AS.grab; if (!gr || gr.id !== e.pointerId) return; const g = asGeo(); AS.pm.tx = clamp(p.x + gr.ox, g.bx + g.mr, g.bx + g.bw - g.mr); AS.pm.ty = clamp(p.y + gr.oy, g.cy + g.mr + 2, g.by + g.bh - g.mr); }
  function asPointerUp(e) { if (AS.grab && AS.grab.id === e.pointerId) AS.grab = null; }
  // ---- 描画 ----
  function asRink() {
    const g = asGeo(); drawFrame(); rect(8, 8, W - 16, H - 16, '#1c3a8a'); rect(8, 8, W - 16, 3, '#6a9aff'); rect(8, H - 11, W - 16, 3, '#0e2260');
    rect(g.bx - 6, g.by - 6, g.bw + 12, g.bh + 12, '#0e1c50'); rect(g.bx - 4, g.by - 4, g.bw + 8, g.bh + 8, '#e8e8f0'); rect(g.bx - 4, g.by - 4, g.bw + 8, 2, '#ffffff'); rect(g.bx, g.by, g.bw, g.bh, '#f4f6fa');
    for (let y = g.by; y < g.by + g.bh; y += 10) for (let x = g.bx + ((y / 10) % 2 ? 5 : 0); x < g.bx + g.bw; x += 10) rect(x, y, 1, 1, '#d4d8e4');                                // 空気の あな
    rect(g.bx, Math.round(g.cy) - 1, g.bw, 2, '#c42028'); ctx.strokeStyle = '#2a4aaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.bw * 0.14, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(196,32,40,0.55)'; ctx.beginPath(); ctx.arc(g.cx, g.by, g.gw * 0.78, 0, Math.PI); ctx.stroke(); ctx.strokeStyle = 'rgba(42,74,170,0.55)'; ctx.beginPath(); ctx.arc(g.cx, g.by + g.bh, g.gw * 0.78, Math.PI, 6.2832); ctx.stroke();
    rect(Math.round(g.cx - g.gw / 2), g.by - 10, Math.round(g.gw), 12, '#1a1a24'); rect(Math.round(g.cx - g.gw / 2), g.by - 10, Math.round(g.gw), 2, '#c42028'); rect(Math.round(g.cx - g.gw / 2), g.by + g.bh - 2, Math.round(g.gw), 12, '#1a1a24'); rect(Math.round(g.cx - g.gw / 2), g.by + g.bh + 8, Math.round(g.gw), 2, '#2a5aff');
    rect(Math.round(g.cx - g.gw / 2) - 3, g.by - 4, 6, 6, '#e8e8f0'); rect(Math.round(g.cx + g.gw / 2) - 3, g.by - 4, 6, 6, '#e8e8f0'); rect(Math.round(g.cx - g.gw / 2) - 3, g.by + g.bh - 2, 6, 6, '#e8e8f0'); rect(Math.round(g.cx + g.gw / 2) - 3, g.by + g.bh - 2, 6, 6, '#e8e8f0');
  }
  function asMallet(m, col, hi, dark) {
    const g = asGeo(); const r = g.mr; ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(Math.round(m.x) + 2, Math.round(m.y) + 2, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), r, 0, 6.2832); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), r - 2, 0, 6.2832); ctx.fill();
    ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), r * 0.55, 0, 6.2832); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(Math.round(m.x), Math.round(m.y), r * 0.38, 0, 6.2832); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(Math.round(m.x) - r * 0.18, Math.round(m.y) - r * 0.2, r * 0.14, 0, 6.2832); ctx.fill();
  }
  function asDrawPlay() {
    asRink(); const g = asGeo();
    if (AS.puck) { for (let i = 0; i < AS.trail.length; i++) { ctx.globalAlpha = 0.08 + 0.06 * i; ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.arc(Math.round(AS.trail[i].x), Math.round(AS.trail[i].y), g.pr * 0.9, 0, 6.2832); ctx.fill(); } ctx.globalAlpha = 1; }
    asMallet(AS.cm, '#e8343c', '#ff8a8a', '#7a1018'); asMallet(AS.pm, '#2a6aff', '#8ab4ff', '#102a7a');
    if (AS.puck) { const pk = AS.puck; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(Math.round(pk.x) + 1, Math.round(pk.y) + 2, g.pr, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#14141c'; ctx.beginPath(); ctx.arc(Math.round(pk.x), Math.round(pk.y), g.pr, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.arc(Math.round(pk.x), Math.round(pk.y), g.pr - 1.5, 0, 6.2832); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(Math.round(pk.x) - 2, Math.round(pk.y) - 3, 3, 2); }
    if (AS.flash > 0) { ctx.globalAlpha = clamp(AS.flash * 2, 0, 0.35); rect(g.bx, g.by, g.bw, g.bh, AS.flashCol); ctx.globalAlpha = 1; }
    if (AS.dev.colliders) { ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; for (const m of [AS.pm, AS.cm]) { ctx.beginPath(); ctx.arc(m.x, m.y, g.mr, 0, 6.2832); ctx.stroke(); } if (AS.puck) { ctx.beginPath(); ctx.arc(AS.puck.x, AS.puck.y, g.pr, 0, 6.2832); ctx.stroke(); } ctx.strokeStyle = '#ffff00'; ctx.strokeRect(g.cx - g.gw / 2, g.by - 10, g.gw, 10); ctx.strokeRect(g.cx - g.gw / 2, g.by + g.bh, g.gw, 10); ctx.beginPath(); ctx.moveTo(g.bx, g.cy); ctx.lineTo(g.bx + g.bw, g.cy); ctx.stroke(); }
    if (AS.dev.cpuTarget && AS.ai.cpu) { const t = AS.ai.cpu.tgt; ctx.strokeStyle = '#ff00ff'; ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, 6.2832); ctx.stroke(); if (AS.dev.pred && AS.ai.cpu.pred) { ctx.beginPath(); ctx.moveTo(AS.puck.x, AS.puck.y); ctx.lineTo(AS.ai.cpu.pred.x, AS.ai.cpu.pred.y); ctx.stroke(); } }
    if (AS.dev.show) { const pr = AS.prof; drawText('LV ' + AS.level + ' REACT ' + pr.reaction + ' SPD ' + pr.speed, 16, 38, '#00ff88', 1); drawText((AS.ai.cpu ? AS.ai.cpu.state : '') + (AS.dev.vel && AS.puck ? ' V ' + Math.round(Math.hypot(AS.puck.vx, AS.puck.vy)) : '') + ' T ' + Math.round(AS.matchTime), 16, 46, '#00ff88', 1); }
  }
  function asHud() {
    const g = asGeo(); drawText('CPU', 18, 12, '#ff8a8a', 1, '#14080a'); drawText(String(AS.score.cpu), 18, 19, '#ff5a5a', 2, '#14080a'); drawText('YOU', 18, H - 26, '#8ab4ff', 1, '#08102a'); drawText(String(AS.score.you), 18, H - 19, '#6a9aff', 2, '#08102a');
    drawTextCenter('FIRST TO ' + ASC.winScore, W / 2, 12, '#ffffff', 1, '#0e1c50'); if (DEV_MODE) drawText('LV' + AS.level, W - 36, 12, '#ffe070', 1, '#0e1c50');                                // 開発用：いまの相手のレベル（公開版では出ない） if (AS.sudden && AS.phase !== 'end') drawTextCenter('NEXT GOAL WINS', W / 2, H - 22, '#ffe070', 1, '#08102a');
    if (AS.phase === 'ready') drawTextCenter('READY', W / 2, g.cy - 14, '#ffffff', 4, '#c42028'); if (AS.phase === 'count') drawTextCenter(String(AS.cnt), W / 2, g.cy - 30, '#ffe070', 8, '#c42028');
    if (AS.bannerT > 0 && AS.banner && AS.phase !== 'end') { ctx.globalAlpha = Math.min(1, AS.bannerT * 2); drawTextCenter(AS.banner, W / 2, g.cy - 10, AS.banner === 'RETRY!' ? '#ffe070' : '#ffffff', AS.banner === 'GOAL!' ? 4 : 3, AS.banner === 'RETRY!' ? '#2a52b8' : '#c42028'); ctx.globalAlpha = 1; }
    if (AS.phase === 'end') { const you = AS.winner === 'you'; drawTextCenter(AS.winner === 'draw' ? 'DRAW' : you ? 'YOU WIN!' : 'CPU WIN', W / 2, g.cy - 12, '#ffffff', 4, AS.winner === 'draw' ? '#6a6a88' : you ? '#2a6aff' : '#c42028'); }
  }
  function asLeaveMidMatch() {                                                                                           // 試合のとちゅうで「席を立つ」：いまの点数で、勝ち・負け・引き分け（同点）
    const mid = ['ready', 'count', 'serve', 'play', 'goal'].includes(AS.phase); if (!mid) return false;
    showDialog({ title: '試合の途中です', lines: ['いまの点数で、試合を おわります。', { text: 'YOU ' + AS.score.you + ' - ' + AS.score.cpu + ' CPU' + (AS.score.you === AS.score.cpu ? '　→ 引き分け' : AS.score.you > AS.score.cpu ? '　→ あなたの勝ち' : '　→ CPUの勝ち'), cls: 'gold' }], buttons: [{ label: '席を立つ', primary: true, onClick: () => { if (!['ready', 'count', 'serve', 'play', 'goal'].includes(AS.phase)) return; AS.winner = AS.score.you === AS.score.cpu ? 'draw' : AS.score.you > AS.score.cpu ? 'you' : 'cpu'; AS.grab = null; asEnd(); } }, { label: 'つづける' }] });
    return true;
  }
  function asDrawResult() {
    asDrawPlay(); ctx.globalAlpha = 0.86; rect(14, 40, W - 28, 270, '#0a1030'); ctx.globalAlpha = 1; const you = AS.winner === 'you'; rect(14, 40, W - 28, 2, AS.winner === 'draw' ? '#c8c8d8' : you ? '#2a6aff' : '#c42028'); drawTextCenter('AIR SMASH', W / 2, 52, '#ffffff', 2, '#1c3a8a');
    drawText('YOU', W / 2 - 54, 100, '#8ab4ff', 2); drawText(String(AS.score.you), W / 2 - 54, 120, '#ffffff', 4, '#1c3a8a'); drawText('CPU', W / 2 + 22, 100, '#ff8a8a', 2); drawText(String(AS.score.cpu), W / 2 + 22, 120, '#ffffff', 4, '#7a1018');
    drawTextCenter(AS.winner === 'draw' ? 'DRAW' : you ? 'YOU WIN!' : 'CPU WIN', W / 2, 170, AS.winner === 'draw' ? '#e8e8f0' : you ? '#8ab4ff' : '#ff8a8a', 3, '#0a1030'); drawTextCenter('YEN ' + P_().money, W / 2, 210, '#7ad8ff', 1); if (DEV_MODE) drawTextCenter('DEV  CPU LV ' + AS.level + '  /  NEXT ' + (AS.dev.level ? 'LV' + AS.dev.level : 'RANDOM'), W / 2, 222, '#ffe070', 1);
  }
  function asDrawSelect() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#1c3a8a'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#2a52b8', '#12285e', (y - 8) / (H - 16))); rect(8, 8, W - 16, 3, '#9ab8ff');
    rect(16, 18, W - 32, 62, '#0e1c50'); rect(18, 20, W - 36, 58, '#14286e'); drawTextCenter('AIR', W / 2, 24, '#ffffff', 3, '#c42028'); drawTextCenter('SMASH', W / 2, 50, '#ff6a6a', 3, '#ffffff');
    const g = { cx: W / 2, w: W - 80 }; rect(40, 96, W - 80, 126, '#0e1c50'); rect(42, 98, W - 84, 122, '#f4f6fa'); rect(42, 158, W - 84, 2, '#c42028'); ctx.strokeStyle = '#2a4aaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, 159, 18, 0, 6.2832); ctx.stroke();
    const t = AS.sel || 0; const mx = W / 2 + Math.sin(t * 1.3) * 26; const pxp = W / 2 + Math.sin(t * 1.9 + 1) * 34; const pyp = 159 + Math.sin(t * 2.3) * 22; asMallet({ x: mx, y: 112 }, '#e8343c', '#ff8a8a', '#7a1018'); asMallet({ x: W / 2 - Math.sin(t * 1.1) * 26, y: 206 }, '#2a6aff', '#8ab4ff', '#102a7a');
    ctx.fillStyle = '#14141c'; ctx.beginPath(); ctx.arc(pxp, pyp, 6, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.arc(pxp, pyp, 4.5, 0, 6.2832); ctx.fill();
    rect(16, 240, W - 32, 60, '#f4f4f0'); rect(16, 240, W - 32, 2, '#ffffff'); drawTextCenter('5 POINTS WIN', W / 2, 248, '#7a1018', 2); drawTextCenter('YOU  vs  CPU', W / 2, 268, '#1c3a8a', 1); drawTextCenter('YEN ' + P_().money + '    PLAY  YEN ' + ASC.price, W / 2, 284, '#7a1018', 1);
  }
  const AS_DOM = {};
  function asBuildDom() {
    if (AS_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); AS_DOM[id.slice(3)] = b; return b; };
    mk('as-start', 'PLAY　¥' + ASC.price, 'td-go').addEventListener('click', () => { ensureAudio(); asBegin(); });
    mk('as-retry', 'もういちど　¥' + ASC.price, 'td-go').addEventListener('click', () => { ensureAudio(); asBegin(); });
    mk('as-out', '6Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); AS.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('as-skip', 'SKIP', 'hb-quit st-small').addEventListener('click', () => { ensureAudio(); if (AS.phase === 'ready') AS.t = 99; });
    const hint = document.createElement('div'); hint.className = 'prize-info st-say br-hint'; hint.innerHTML = '青いマレットを<br>指で動かそう！<br>先に5点で勝ち！'; screenEl.appendChild(hint); AS_DOM.hint = hint;
    for (const [k, lv, label] of [['lv1', 1, 'LV1'], ['lv2', 2, 'LV2'], ['lv3', 3, 'LV3'], ['lv4', 4, 'LV4'], ['lv5', 5, 'LV5'], ['lv0', 0, 'RND']]) {                                  // 開発用：CPUのレベルを えらんで たたかう（DEV_MODE のときだけ）
      const b = document.createElement('button'); b.className = 'cr-btn hb-btn hb-sub as-lv'; b.id = 'as-' + k; b.type = 'button'; b.textContent = label; screenEl.appendChild(b); AS_DOM[k] = b; b.addEventListener('click', () => { ensureAudio(); AS.dev.level = lv; beep(880, 0, 0.04, 0.04, 'square'); });
    }
  }
  function asUi() {
    asBuildDom(); const ph = AS.phase; const show = (k, on) => AS_DOM[k].classList.toggle('is-show', !!on); const hintOn = ph === 'ready' && !P_().airSmash.seenHint;
    show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); show('skip', hintOn); show('hint', hintOn);
    crPlace(AS_DOM.start, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(AS_DOM.retry, { x: 20, y: 240, w: W - 40, h: 32 }); crPlace(AS_DOM.out, { x: 20, y: 278, w: W - 40, h: 26 }); crPlace(AS_DOM.skip, { x: W - 52, y: 40, w: 40, h: 18 }); crPlace(AS_DOM.hint, { x: 14, y: 170, w: W - 28, h: 56 });
    const lvOn = DEV_MODE && (ph === 'select' || ph === 'result'); const lvY = ph === 'select' ? 304 : 312; const lw = Math.floor((W - 32 - 5 * 3) / 6);
    [['lv1', 1], ['lv2', 2], ['lv3', 3], ['lv4', 4], ['lv5', 5], ['lv0', 0]].forEach(([k, lv], i) => { show(k, lvOn); AS_DOM[k].classList.toggle('hb-go', AS.dev.level === lv); AS_DOM[k].classList.toggle('hb-sub', AS.dev.level !== lv); crPlace(AS_DOM[k], { x: 16 + i * (lw + 3), y: lvY, w: lw, h: 15 }); AS_DOM[k].style.fontSize = Math.max(8, parseFloat(AS_DOM[k].style.fontSize) * 0.7) + 'px'; });
  }
  function asHide() { if (!AS_DOM.start) return; Object.keys(AS_DOM).forEach((k) => AS_DOM[k].classList.remove('is-show')); }
  function asDraw() { const ph = AS.phase; if (ph === 'select') asDrawSelect(); else if (ph === 'result') asDrawResult(); else { asDrawPlay(); asHud(); } asUi(); }
  // ---- シミュレーション（テスト用：画面なしで、1試合を、はやく進める） ----
  function asSim(level, botProf, maxSec) {
    const save = { phase: AS.phase, bot: AS.dev.bot, lvl: AS.dev.level, clock: AS.clock }; AS.dev.level = level; AS.dev.bot = true; const keepBot = ASC.botProfile; if (botProf) ASC.botProfile = botProf; asNewMatch(); AS.phase = 'play'; AS.clock = 0; let t = 0; const dt = 1 / 60;
    while (t < (maxSec || 200) && AS.phase !== 'end' && AS.phase !== 'result') { asUpdate(dt); t += dt; if (AS.phase === 'goal' && AS.winner) { AS.phase = 'end'; } }
    const out = { winner: AS.winner || (AS.score.you >= AS.score.cpu ? 'you' : 'cpu'), you: AS.score.you, cpu: AS.score.cpu, time: +AS.matchTime.toFixed(1) }; AS.dev.level = save.lvl; AS.dev.bot = save.bot; ASC.botProfile = keepBot; AS.phase = save.phase; return out;
  }
  function openAsDev() {
    const again = (f) => () => { f(); setTimeout(openAsDev, 0); }; const P = ASC;
    showDialog({ title: 'AIR SMASH DEV', wide: true, lines: [{ text: 'CPU LEVEL ' + (AS.dev.level || 'RANDOM') + ' (現在 ' + AS.level + ') / スコア YOU ' + AS.score.you + ' - CPU ' + AS.score.cpu + ' / 安全タイマー ' + (AS.dev.safety || P.safetyTime) + 's', cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '（レベルは、タイトル画面・RESULTの LV1〜5 ボタンでも えらべます）', onClick: again(() => {}) },
      { label: 'LEVEL 1 固定', onClick: again(() => { AS.dev.level = 1; }) }, { label: 'LEVEL 2 固定', onClick: again(() => { AS.dev.level = 2; }) }, { label: 'LEVEL 3 固定', onClick: again(() => { AS.dev.level = 3; }) }, { label: 'LEVEL 4 固定', onClick: again(() => { AS.dev.level = 4; }) }, { label: 'LEVEL 5 固定', onClick: again(() => { AS.dev.level = 5; }) }, { label: 'RANDOM にもどす', onClick: again(() => { AS.dev.level = 0; }) },
      { label: 'CPU LEVEL・reaction・パック速度 表示 ON/OFF', onClick: again(() => { AS.dev.show = !AS.dev.show; AS.dev.vel = AS.dev.show; }) }, { label: 'CPU target・prediction line 表示 ON/OFF', onClick: again(() => { AS.dev.cpuTarget = !AS.dev.cpuTarget; AS.dev.pred = AS.dev.cpuTarget; }) }, { label: 'collider 表示 ON/OFF', onClick: again(() => { AS.dev.colliders = !AS.dev.colliders; }) },
      { label: 'パックの最大速度 ±80', onClick: again(() => { P.puckMaxSpeed = P.puckMaxSpeed >= 800 ? 400 : P.puckMaxSpeed + 80; }) }, { label: 'パック速度を固定（400）ON/OFF', onClick: again(() => { AS.dev.puckSpeed = AS.dev.puckSpeed ? 0 : 400; }) },
      { label: '強制 PLAYER GOAL', onClick: () => { if (AS.phase === 'play') asGoal('you'); } }, { label: '強制 CPU GOAL', onClick: () => { if (AS.phase === 'play') asGoal('cpu'); } },
      { label: '4-4 にする', onClick: again(() => { AS.score = { you: 4, cpu: 4 }; }) }, { label: 'SCORE +1（YOU）', onClick: again(() => { AS.score.you = Math.min(4, AS.score.you + 1); }) },
      { label: 'STUCK 強制（パックを止める）', onClick: () => { if (AS.puck) { AS.puck.vx = 0; AS.puck.vy = 0; AS.stuckT = ASC.stuckTime - 0.4; } } }, { label: '安全タイマー 10秒（ON/OFF）', onClick: again(() => { AS.dev.safety = AS.dev.safety ? 0 : 10; }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('airSmash', {
    reset() { AS.phase = 'select'; AS.grab = null; }, phase: () => AS.phase,
    enter() { asBuildDom(); AS.phase = 'select'; AS.sel = 0; AS.grab = null; asNewMatch(); AS.phase = 'select'; setMessage('', C.cyan); },
    update: asUpdate, draw: asDraw, hint: '青いマレットを 指で動かして、 先に5点！',
    pointer: asPointer, pointerUp: asPointerUp
  });
  GAME_TYPES.airSmash.pointerMove = asPointerMove;
  GAME_TYPES.airSmash.canLeave = () => AS.phase === 'select' || AS.phase === 'result';
  GAME_TYPES.airSmash.beforeLeave = () => asLeaveMidMatch();                                                            // 席を立つ：試合のとちゅうなら、確認して、いまの点数で おわる
  GAME_TYPES.airSmash.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

