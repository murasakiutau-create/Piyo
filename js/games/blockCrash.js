'use strict';
  // =====================================================================
  //  🧱 BLOCK CRASH（ブロッククラッシュ）：7F VIDEO CORNER　1人用のブロック崩し
  //   ¥100（MONEYのみ・MEDAL不使用）／全5 STAGE／3 BALL／制限時間なし／キャラなし・ストーリーなし
  //   パドルは 指のX座標に ついてくる（ほんの少しだけ なめらかに）。打点で 角度が かわる。アイテム：WIDE／MULTI／POWER／SLOW／BONUS
  // =====================================================================
  const BCC = CONFIG.blockCrash;
  const BC_MACHINE = { machineId: 'bc_blockcrash', machineName: 'BLOCK CRASH', label: 'BLOCK CRASH', isUnlocked: true, gameType: 'blockCrash', bc: true };
  const BC = { phase: 'select', t: 0, clock: 0, stage: 1, balls: 3, score: 0, broken: 0, cells: [], remain: 0, ballsArr: [], items: [], parts: [], pops: [], paddleX: 100, targetX: 100, widen: 0, power: 0, slow: 0, slowK: 1, stall: 0, sinceBreak: 0, combo: 0, comboT: 0, ready: false, startT: 0, paying: false, newRecord: false, allClear: false, result: null, pause: false, resumeT: 0, shake: 0, bgm: 0, bgmI: 0, assistT: 0, flashT: 0, msg: '', dev: { god: false, speedMul: 1, showSpeed: false }, sel: 0, hitsThisFrame: 0 };
  const bcRec = () => { const p = P_(); if (!p.blockCrash) p.blockCrash = { v: 1, high: 0, bestStage: 0, allClear: false, plays: 0 }; const r = p.blockCrash; r.high = r.high | 0; r.bestStage = r.bestStage | 0; r.plays = r.plays | 0; r.allClear = !!r.allClear; return r; };
  const bcGeo = () => { const fx = 10; const fw = W - 20; const bw = Math.floor((fw - 2) / BCC.cols); const ox = fx + Math.floor((fw - bw * BCC.cols) / 2); return { fx, fw, ft: 34, fb: H - 12, bw, bh: BCC.blockH, ox, oy: 128, py: H - 46, ph: 6, r: BCC.ballR }; };
  let bcWideNow = 1;
  const bcPaddleWidth = () => BCC.paddleW * bcWideNow;
  function bcLoadStage(n) {
    const st = BCC.stages[n - 1]; const G = bcGeo(); BC.cells = []; BC.remain = 0;
    st.layout.forEach((row, r) => { for (let c = 0; c < BCC.cols; c++) { const ch = row[c]; if (ch === '.' || ch === ' ' || ch === undefined) continue; const hp = ch === 'h' ? 2 : 1; const b = { c, r, kind: ch === 's' ? 'steel' : ch === 'h' ? 'hard' : ch === 'i' ? 'item' : 'normal', hp, x: G.ox + c * G.bw, y: G.oy + r * G.bh, w: G.bw, h: G.bh, alive: true }; BC.cells.push(b); if (b.kind !== 'steel') BC.remain++; } });
    BC.items = []; BC.parts = []; BC.pops = []; BC.ballsArr = []; BC.widen = 0; BC.power = 0; BC.slow = 0; BC.slowK = 1; bcWideNow = 1; BC.stall = 0; BC.sinceBreak = 0; BC.combo = 0; BC.comboT = 0; BC.assistT = 0;
  }
  function bcStageSpeed() { const st = BCC.stages[BC.stage - 1]; return Math.min(BCC.maxSpeed, st.baseBallSpeed * BC.dev.speedMul) ; }
  function bcTargetSpeed() { let s = bcStageSpeed() * BC.slowK * (1 + BC.stall); return Math.min(BCC.maxSpeed, s); }
  function bcNewBall(onPaddle) { const G = bcGeo(); return { x: BC.paddleX, y: G.py - G.r - 1, vx: 0, vy: 0, s: bcStageSpeed(), stuck: !!onPaddle, trail: [] }; }
  function bcPrepare() { BC.ballsArr = [bcNewBall(true)]; BC.ready = true; BC.widen = 0; BC.power = 0; BC.slow = 0; BC.slowK = 1; bcWideNow = 1; BC.items = []; BC.stall = 0; BC.sinceBreak = 0; BC.combo = 0; }
  function bcLaunch() { const b = BC.ballsArr[0]; if (!b || !b.stuck) return; const s = bcStageSpeed(); const a = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.22); b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s; b.s = s; b.stuck = false; BC.ready = false; BC.msg = 'START!'; BC.startT = 0.7; beep(880, 0, 0.06, 0.05, 'square'); beep(1320, 0.06, 0.1, 0.05, 'square'); }
  function bcInsert() {                                                                                                  // ¥100：PLAYを押した時点で ひかれる（連打しても1回）
    if (BC.paying || BC.phase !== 'select' && BC.phase !== 'result') return; if (P_().money < BCC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    BC.paying = true; chargeYen(BCC.price); bcRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); bcStart(1); BC.paying = false;
  }
  function bcStart(stage) { BC.stage = stage; BC.balls = BCC.startBalls; BC.score = 0; BC.broken = 0; BC.newRecord = false; BC.allClear = false; BC.result = null; BC.paddleX = W / 2; BC.targetX = W / 2; BC.pause = false; bcLoadStage(stage); bcPrepare(); BC.phase = 'stage'; BC.t = 0; BC.bgmI = 0; BC.bgm = 0; }
  function bcFinish(all) {                                                                                               // 正式なリザルトに とどいたときだけ ハイスコアを保存
    const r = bcRec(); BC.allClear = !!all; BC.newRecord = BC.score > r.high; if (BC.newRecord) r.high = BC.score; if (BC.stage > r.bestStage) r.bestStage = BC.stage; if (all) r.allClear = true; BC.result = { score: BC.score, stage: BC.stage, broken: BC.broken, high: r.high, all: !!all }; writeSave(); BC.phase = 'result'; BC.t = 0;
  }
  function bcAddScore(n, x, y, txt) { BC.score += n; if (txt) BC.pops.push({ x, y, t: 0.8, txt, col: '#ffe070' }); }
  function bcBurst(b, big) { const col = bcBlockColor(b); const n = big ? 7 : 4; for (let i = 0; i < n; i++) { if (BC.parts.length > 140) break; BC.parts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (Math.random() - 0.5) * 110, vy: (Math.random() - 0.7) * 90, t: 0, life: 0.35 + Math.random() * 0.25, col, s: big ? 2 : 1 }); } }
  const BC_ROWCOL = ['#18d8f0', '#f040d0', '#ffd820', '#ff8a20', '#30e060', '#a050ff', '#ff5a6a'];
  const bcBlockColor = (b) => (b.kind === 'steel' ? '#aab4c0' : BC_ROWCOL[b.r % BC_ROWCOL.length]);
  function bcPickItem() { const W_ = BCC.itemWeights; let tot = 0; for (const k in W_) tot += W_[k]; let r = Math.random() * tot; for (const k in W_) { r -= W_[k]; if (r <= 0) return k; } return 'BONUS'; }
  function bcDestroy(b, byPower) {
    b.alive = false; BC.remain--; BC.broken++; BC.sinceBreak = 0; BC.stall = Math.max(0, BC.stall - 0.0);
    BC.combo = BC.comboT > 0 ? BC.combo + 1 : 1; BC.comboT = BCC.comboWindow; const sc = b.kind === 'steel' ? BCC.score.steelPower : b.kind === 'hard' ? BCC.score.hardBreak : BCC.score.normal; const bonus = BC.combo >= 2 ? BCC.score.combo * (Math.min(BC.combo, 10) - 1) : 0; bcAddScore(sc + bonus);
    bcBurst(b, b.kind === 'hard' || b.kind === 'steel'); if (BC.combo >= 2 && (BC.ballsArr.length > 1 || BC.power > 0 || BC.combo >= 3)) BC.comboShow = { n: BC.combo, x: Math.max(24, Math.min(W - 24, b.x + b.w / 2)), y: Math.max(46, b.y - 8), t: 0.8 };
    if (b.kind === 'item') BC.items.push({ x: b.x + b.w / 2, y: b.y + b.h, type: bcPickItem(), t: 0 });
    if (b.kind === 'hard' || b.kind === 'steel') { beep(300, 0, 0.07, 0.07, 'square', 200); noise(0.05, 0.05); } else { beep(660 + Math.min(BC.combo, 8) * 60, 0, 0.05, 0.06, 'square'); noise(0.03, 0.04); }
  }
  function bcHitBlock(b, power) {                                                                                         // 1個ぶんの ヒット。つぶれたら true
    BC.assistT = 0;
    if (power) { bcDestroy(b, true); return true; }
    if (b.kind === 'steel') { beep(1500, 0, 0.03, 0.04, 'triangle'); return false; }
    if (b.kind === 'hard' && b.hp > 1) { b.hp--; bcAddScore(BCC.score.hardHit); beep(520, 0, 0.05, 0.07, 'square'); noise(0.02, 0.03); bcBurst(b, false); return false; }
    bcDestroy(b, false); return true;
  }
  function bcOverlapBlocks(x, y, r) {                                                                                     // ボールと かさなる ブロック（円×四角）
    const G = bcGeo(); const out = []; const c0 = Math.floor((x - r - G.ox) / G.bw); const c1 = Math.floor((x + r - G.ox) / G.bw); const r0 = Math.floor((y - r - G.oy) / G.bh); const r1 = Math.floor((y + r - G.oy) / G.bh);
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) { const b = BC.cellMap && BC.cellMap[rr * 16 + cc]; if (!b || !b.alive) continue; const nx = Math.max(b.x, Math.min(x, b.x + b.w)); const ny = Math.max(b.y, Math.min(y, b.y + b.h)); const dx = x - nx; const dy = y - ny; if (dx * dx + dy * dy < r * r) out.push(b); }
    return out;
  }
  const bcIndex = () => { BC.cellMap = {}; for (const b of BC.cells) BC.cellMap[b.r * 16 + b.c] = b; };
  function bcFixAngle(b) {                                                                                                // 水平すぎ・垂直すぎを すこしだけ なおす（永久軌道を作らない）
    const sp = Math.hypot(b.vx, b.vy) || 1; const minV = sp * BCC.minVertical; if (Math.abs(b.vy) < minV) { b.vy = (b.vy >= 0 ? 1 : -1) * minV; b.vx = (b.vx >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, sp * sp - b.vy * b.vy)); }
    if (Math.abs(b.vx) < sp * BCC.minHorizontal) { b.vx = (Math.abs(b.vx) < 0.001 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(b.vx)) * sp * BCC.minHorizontal; b.vy = Math.sign(b.vy || -1) * Math.sqrt(Math.max(0, sp * sp - b.vx * b.vx)); }
  }
  function bcStepBall(b, dt, G) {                                                                                         // 1ボールを すすめる：細かく刻んで（すり抜けない）、軸ごとに 当たりを みる
    const sp = Math.hypot(b.vx, b.vy); const n = Math.max(1, Math.ceil(sp * dt / 1.4)); const h = dt / n; const power = BC.power > 0; const pw = bcPaddleWidth();
    for (let i = 0; i < n; i++) {
      b.x += b.vx * h;
      if (b.x < G.fx + G.r) { b.x = G.fx + G.r; b.vx = Math.abs(b.vx); beep(420, 0, 0.02, 0.025, 'triangle'); } else if (b.x > G.fx + G.fw - G.r) { b.x = G.fx + G.fw - G.r; b.vx = -Math.abs(b.vx); beep(420, 0, 0.02, 0.025, 'triangle'); }
      let hit = bcOverlapBlocks(b.x, b.y, G.r);
      if (hit.length) { if (power) hit.forEach((q) => bcHitBlock(q, true)); else { b.x -= b.vx * h; b.vx = -b.vx; const q = hit[0]; bcHitBlock(q, false); } }
      b.y += b.vy * h;
      if (b.y < G.ft + G.r) { b.y = G.ft + G.r; b.vy = Math.abs(b.vy); beep(480, 0, 0.02, 0.025, 'triangle'); bcFixAngle(b); }
      hit = bcOverlapBlocks(b.x, b.y, G.r);
      if (hit.length) { if (power) hit.forEach((q) => bcHitBlock(q, true)); else { b.y -= b.vy * h; b.vy = -b.vy; bcHitBlock(hit[0], false); bcFixAngle(b); } }
      if (b.vy > 0 && b.y + G.r >= G.py && b.y - G.r <= G.py + G.ph + 3 && b.y - b.vy * h <= G.py + 2) {                       // パドル（当たり判定は 見た目より すこし やさしい）
        const half = pw / 2 + BCC.paddleLenient; if (Math.abs(b.x - BC.paddleX) <= half) {
          const rel = Math.max(-1, Math.min(1, (b.x - BC.paddleX) / half)); const ang = rel * BCC.maxBounceAngle; const s = Math.max(b.s, 1); b.vx = Math.sin(ang) * s; b.vy = -Math.cos(ang) * s; b.y = G.py - G.r; if (Math.abs(b.vx) < s * 0.06) b.vx += (Math.random() < 0.5 ? -1 : 1) * s * 0.05;
          beep(1180, 0, 0.04, 0.08, 'square'); beep(1760, 0.015, 0.05, 0.05, 'triangle'); BC.shake = 0.05; BC.padFlash = 0.12;
        }
      }
    }
  }
  function bcAssist(b, dt) {                                                                                              // 残り3個以下で ずっと当たらないとき：ごく弱い 軌道補正（ホーミングには しない）
    if (BC.remain > BCC.assistRemain || BC.remain <= 0 || BC.assistT < BCC.assistAfter || b.vy > 0) return; let best = null; let bd = 1e9; for (const q of BC.cells) { if (!q.alive || q.kind === 'steel') continue; const d = Math.hypot(q.x + q.w / 2 - b.x, q.y + q.h / 2 - b.y); if (d < bd) { bd = d; best = q; } } if (!best) return;
    const want = Math.atan2(best.y + best.h / 2 - b.y, best.x + best.w / 2 - b.x); const cur = Math.atan2(b.vy, b.vx); let d = want - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const step = Math.max(-BCC.assistRate * dt, Math.min(BCC.assistRate * dt, d)); const sp = Math.hypot(b.vx, b.vy); const na = cur + step; b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; bcFixAngle(b);
  }
  function bcApplyItem(type, x, y) {
    BC.score += BCC.score.item; beep(1320, 0, 0.06, 0.06, 'square'); beep(1760, 0.05, 0.08, 0.06, 'square');
    if (type === 'WIDE') { BC.widen = BCC.wideTime; BC.pops.push({ x, y: y - 8, t: 1, txt: 'WIDE', col: '#7dfcff' }); }
    else if (type === 'SLOW') { BC.slow = BCC.slowTime; BC.pops.push({ x, y: y - 8, t: 1, txt: 'SLOW', col: '#9fd0ff' }); }
    else if (type === 'POWER') { BC.power = BCC.powerTime; BC.pops.push({ x, y: y - 8, t: 1, txt: 'POWER', col: '#ff9a3a' }); [220, 330, 440, 660].forEach((f, i) => beep(f, i * 0.04, 0.12, 0.07, 'sawtooth')); }
    else if (type === 'BONUS') { BC.score += BCC.score.bonus; BC.pops.push({ x, y: y - 8, t: 1.1, txt: '+' + BCC.score.bonus, col: '#ffe070' }); [988, 1175, 1568, 1976].forEach((f, i) => beep(f, i * 0.05, 0.1, 0.06, 'triangle')); }
    else if (type === 'MULTI') {
      if (BC.ballsArr.length >= BCC.maxBalls) { BC.score += BCC.score.bonus; BC.pops.push({ x, y: y - 8, t: 1.1, txt: '+' + BCC.score.bonus, col: '#ffe070' }); return; }
      const src = BC.ballsArr.find((q) => !q.stuck) || BC.ballsArr[0]; if (!src) return; const sp = Math.hypot(src.vx, src.vy) || bcStageSpeed(); const cur = Math.atan2(src.vy, src.vx); const need = BCC.maxBalls - BC.ballsArr.length; const offs = [-0.5, 0.5];
      for (let i = 0; i < need && i < 2; i++) { const a = cur + offs[i]; const nb = { x: src.x, y: src.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: src.s, stuck: false, trail: [] }; bcFixAngle(nb); BC.ballsArr.push(nb); }
      BC.pops.push({ x, y: y - 8, t: 1, txt: 'MULTI!', col: '#ff7ab8' }); [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.05, 0.1, 0.07, 'square'));
    }
  }
  function bcMiss() {
    BC.balls--; BC.shake = 0.2; beep(300, 0, 0.3, 0.08, 'sawtooth', 80); noise(0.2, 0.06); BC.items = []; BC.power = 0; BC.slow = 0; BC.slowK = 1; BC.widen = 0; bcWideNow = 1;
    if (BC.balls <= 0) { BC.phase = 'over'; BC.t = 0; [392, 330, 262, 196].forEach((f, i) => beep(f, 0.3 + i * 0.14, 0.2, 0.06, 'sine')); } else { BC.phase = 'miss'; BC.t = 0; }
  }
  function bcUpdate(dt) {
    BC.clock += dt; BC.sel += dt; dt = Math.min(dt, 0.05);
    if (BC.pause) { if (!document.hidden) { BC.resumeT -= dt; if (BC.resumeT <= 0) { BC.pause = false; } } return; }
    BC.t += dt; if (BC.shake > 0) BC.shake -= dt; if (BC.padFlash > 0) BC.padFlash -= dt; if (BC.startT > 0) BC.startT -= dt;
    for (const p of BC.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; } BC.parts = BC.parts.filter((p) => p.t < p.life); if (BC.comboShow) BC.comboShow.t -= dt; for (const q of BC.pops) { q.t -= dt; q.y -= 14 * dt; } BC.pops = BC.pops.filter((q) => q.t > 0);
    const ph = BC.phase; const G = bcGeo();
    if (ph === 'select' || ph === 'result') return;
    BC.paddleX += (BC.targetX - BC.paddleX) * (1 - Math.exp(-dt * BCC.followRate)); const pwHalf = bcPaddleWidth() / 2; BC.paddleX = Math.max(G.fx + pwHalf, Math.min(G.fx + G.fw - pwHalf, BC.paddleX));
    const wt = BC.widen > 0 ? BCC.wideMul : 1; bcWideNow += (wt - bcWideNow) * (1 - Math.exp(-dt * 10));
    if (ph === 'stage') { if (BC.t >= 1.4) { BC.phase = 'ready'; BC.t = 0; } return; }
    if (ph === 'ready') { const b = BC.ballsArr[0]; if (b) { b.x = BC.paddleX; b.y = G.py - G.r - 1; } return; }
    if (ph === 'miss') { if (BC.t >= 1.2) { bcPrepare(); BC.phase = 'ready'; BC.t = 0; } return; }
    if (ph === 'clear') { if (BC.t >= 2.2) { if (BC.stage >= BCC.stages.length) { BC.phase = 'allclear'; BC.t = 0; BC.flashT = 0.5; [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.09, 0.18, 0.07, 'triangle')); } else { BC.stage++; bcLoadStage(BC.stage); bcPrepare(); BC.phase = 'stage'; BC.t = 0; } } return; }
    if (ph === 'allclear') { if (BC.flashT > 0) BC.flashT -= dt; if (BC.t >= 3.2) bcFinish(true); return; }
    if (ph === 'over') { if (BC.t >= 2.0) bcFinish(false); return; }
    // ---- play ----
    if (BC.widen > 0) BC.widen -= dt; if (BC.power > 0) BC.power -= dt; if (BC.slow > 0) BC.slow -= dt;
    const slowTarget = BC.slow > 0 ? BCC.slowMul : 1; BC.slowK += (slowTarget - BC.slowK) * (1 - Math.exp(-dt * (BC.slow > 0 ? 6 : 1.8)));    // おわるときは じわっと もどる
    BC.sinceBreak += dt; BC.assistT += dt; if (BC.comboT > 0) BC.comboT -= dt;
    if (BC.sinceBreak > BCC.stallAfter) BC.stall = Math.min(BCC.stallMax, BC.stall + BCC.stallRate * dt); else BC.stall = Math.max(0, BC.stall - BCC.stallRecover * dt);
    bcIndex(); const T = bcTargetSpeed();
    for (const b of BC.ballsArr) {
      if (b.stuck) continue; b.s += (T - b.s) * (1 - Math.exp(-dt * 4)); const sp = Math.hypot(b.vx, b.vy) || 1; b.vx *= b.s / sp; b.vy *= b.s / sp; bcAssist(b, dt); bcStepBall(b, dt, G); b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > (BC.power > 0 ? 9 : 5)) b.trail.shift();
    }
    BC.ballsArr = BC.ballsArr.filter((b) => b.stuck || b.y - G.r < H + 6 || BC.dev.god);
    for (const b of BC.ballsArr) if (BC.dev.god && b.y > G.py + 14 && !b.stuck) { b.y = G.py - G.r; b.vy = -Math.abs(b.vy); }
    for (const it of BC.items) { it.t += dt; it.y += BCC.itemFall * dt; }
    const pw = bcPaddleWidth(); BC.items = BC.items.filter((it) => { if (it.y + 4 >= G.py && it.y - 4 <= G.py + G.ph + 2 && Math.abs(it.x - BC.paddleX) <= pw / 2 + 8) { bcApplyItem(it.type, it.x, G.py); return false; } return it.y < H + 8; });
    if (BC.remain <= 0) { BC.phase = 'clear'; BC.t = 0; BC.items = []; const bonus = BCC.score.stageClear + BC.balls * BCC.score.ballLeft; BC.score += bonus; BC.pops.push({ x: W / 2, y: 190, t: 1.8, txt: '+' + bonus, col: '#ffe070' }); [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.07, 'triangle')); for (const b of BC.ballsArr) { b.vx = 0; b.vy = 0; } return; }
    if (BC.ballsArr.length === 0) bcMiss();
    BC.bgm -= dt; if (BC.bgm <= 0 && ph === 'play') { BC.bgm = 0.15; const pat = [262, 0, 330, 0, 392, 0, 330, 0, 294, 0, 349, 0, 440, 0, 349, 0]; const f = pat[BC.bgmI % pat.length]; if (f) beep(f, 0, 0.09, 0.012, 'square'); if (BC.bgmI % 4 === 0) beep(f ? f / 2 : 131, 0, 0.12, 0.016, 'triangle'); BC.bgmI++; }
  }
  // ---- 入力 ----
  const bcSetTarget = (p) => { const G = bcGeo(); BC.targetX = Math.max(G.fx, Math.min(G.fx + G.fw, p.x)); };
  function bcPointer(e, p) {
    if (BC.pause) return; if (!['stage', 'ready', 'play', 'miss'].includes(BC.phase)) return; BC.touch = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } bcSetTarget(p); if (BC.phase === 'ready' && BC.ballsArr[0] && BC.ballsArr[0].stuck) { BC.phase = 'play'; BC.t = 0; bcLaunch(); }
  }
  function bcPointerMove(e, p) { if (BC.touch == null && e.pointerType !== 'mouse') return; if (['stage', 'ready', 'play', 'miss'].includes(BC.phase)) bcSetTarget(p); }
  function bcPointerUp(e) { if (BC.touch === e.pointerId) BC.touch = null; }
  window.addEventListener('keydown', (ev) => { if (scene !== 'machine' || !currentMachine || currentMachine.gameType !== 'blockCrash') return; const G = bcGeo(); if (ev.key === 'ArrowLeft') { BC.targetX = Math.max(G.fx, BC.targetX - 26); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { BC.targetX = Math.min(G.fx + G.fw, BC.targetX + 26); ev.preventDefault(); } else if (ev.key === ' ' && BC.phase === 'ready') { BC.phase = 'play'; BC.t = 0; bcLaunch(); ev.preventDefault(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ['stage', 'ready', 'play', 'miss', 'clear'].includes(BC.phase)) { BC.pause = true; BC.resumeT = 2.4; BC.touch = null; } });   // タブが うらに いったら 自動PAUSE → もどったら READY? → 再開
  // ---- 描画 ----
  function bcDrawBlock(b) {
    const col = bcBlockColor(b); const x = b.x; const y = b.y; const w = b.w - 1; const h = b.h - 1;
    if (b.kind === 'steel') { rect(x, y, w, h, '#6c7480'); rect(x, y, w, 1, '#e0e6ee'); rect(x, y, 1, h, '#c4ccd6'); rect(x, y + h - 1, w, 1, '#3c4250'); rect(x + w - 1, y, 1, h, '#4a505c'); rect(x + 2, y + 2, 1, 1, '#2a2e38'); rect(x + w - 3, y + 2, 1, 1, '#2a2e38'); rect(x + 2, y + h - 3, 1, 1, '#2a2e38'); rect(x + w - 3, y + h - 3, 1, 1, '#2a2e38'); return; }
    const dark = mixHex(col, '#000000', 0.45); const light = mixHex(col, '#ffffff', 0.5);
    if (b.kind === 'hard') { rect(x, y, w, h, dark); rect(x + 1, y + 1, w - 2, h - 2, col); rect(x, y, w, 1, '#ffffff'); rect(x, y, 1, h, '#ffffff'); rect(x + w - 1, y, 1, h, '#ffffff'); rect(x, y + h - 1, w, 1, '#ffffff'); if (b.hp <= 1) { rect(x + 4, y + 1, 1, 3, dark); rect(x + 5, y + 3, 1, 3, dark); rect(x + 6, y + 5, 1, 3, dark); rect(x + 11, y + 1, 1, 2, dark); rect(x + 12, y + 2, 1, 4, dark); rect(x + 13, y + 5, 1, 3, dark); } else { rect(x + 2, y + 2, w - 4, 1, light); } return; }
    rect(x, y, w, h, col); rect(x, y, w, 1, light); rect(x, y, 1, h, light); rect(x, y + h - 1, w, 1, dark); rect(x + w - 1, y, 1, h, dark);
    if (b.kind === 'item') { rect(x + 1, y + 1, w - 2, h - 2, '#fff6c8'); rect(x + 2, y + 2, w - 4, h - 4, col); const cx = x + w / 2; const cy = y + h / 2; rect(cx - 1, cy - 2, 2, 5, '#ffffff'); rect(cx - 2, cy - 1, 5, 2, '#ffffff'); }
  }
  const BC_ITEMCOL = { WIDE: ['#7dfcff', 'W'], MULTI: ['#ff7ab8', 'M'], POWER: ['#ff9a3a', 'P'], SLOW: ['#9fd0ff', 'S'], BONUS: ['#ffe070', 'B'] };
  function bcDrawField(G) {
    rect(0, 0, W, H, '#050818'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#0a1240', '#02030c', y / H)); ctx.globalAlpha = 0.07; for (let x = G.fx; x <= G.fx + G.fw; x += 12) rect(x, G.ft, 1, G.fb - G.ft, '#40a0ff'); for (let y = G.ft; y <= G.fb; y += 12) rect(G.fx, y, G.fw, 1, '#40a0ff'); ctx.globalAlpha = 1;
    drawFrame(); rect(G.fx - 2, G.ft - 2, G.fw + 4, 2, '#20d8f0'); rect(G.fx - 2, G.ft - 2, 2, G.fb - G.ft + 2, '#20d8f0'); rect(G.fx + G.fw, G.ft - 2, 2, G.fb - G.ft + 2, '#20d8f0'); ctx.globalAlpha = 0.25; rect(G.fx - 4, G.ft - 4, G.fw + 8, 2, '#20d8f0'); ctx.globalAlpha = 1;
  }
  function bcDrawHud() {
    drawText('SCORE', 12, 10, '#7dfcff', 1); drawText(String(BC.score), 12, 19, '#ffffff', 1); drawTextCenter('STAGE ' + BC.stage, W / 2, 10, '#ffe070', 1); drawTextCenter(BCC.stages[BC.stage - 1].name, W / 2, 19, '#ff7ab8', 1);
    drawText('BALL', W - 12 - 44, 10, '#7dfcff', 1); for (let i = 0; i < BCC.startBalls; i++) { const bx = W - 12 - 30 + i * 9; ctx.fillStyle = i < BC.balls ? '#ffffff' : '#2a3a6a'; ctx.beginPath(); ctx.arc(bx + 3, 23, 3, 0, 6.2832); ctx.fill(); }
  }
  function bcDrawPlay() {
    const G = bcGeo(); bcDrawField(G); ctx.save(); if (BC.shake > 0 && BC.phase !== 'select') ctx.translate(0, Math.round(Math.sin(BC.clock * 70) * 1.2)); bcDrawHud();
    for (const b of BC.cells) if (b.alive) bcDrawBlock(b);
    const pw = bcPaddleWidth(); const px = Math.round(BC.paddleX - pw / 2); const wide = BC.widen > 0; const warn = wide && BC.widen < 1.8;
    ctx.globalAlpha = 0.25 + (BC.padFlash > 0 ? 0.25 : 0); rect(px - 2, G.py - 2, pw + 4, G.ph + 4, '#20d8f0'); ctx.globalAlpha = 1; rect(px, G.py, pw, G.ph, '#e8eef8'); rect(px, G.py, pw, 2, '#ffffff'); rect(px, G.py + G.ph - 2, pw, 2, '#8aa0c0'); rect(px, G.py, 3, G.ph, warn ? '#ffb040' : '#20d8f0'); rect(px + pw - 3, G.py, 3, G.ph, warn ? '#ffb040' : '#20d8f0');
    for (const it of BC.items) { const d = BC_ITEMCOL[it.type]; rect(Math.round(it.x - 8), Math.round(it.y - 4), 16, 8, '#08102a'); rect(Math.round(it.x - 7), Math.round(it.y - 3), 14, 6, d[0]); rect(Math.round(it.x - 7), Math.round(it.y - 3), 14, 1, '#ffffff'); drawTextCenter(d[1], it.x + 0.5, it.y - 2, '#08102a', 1); }
    for (const b of BC.ballsArr) { const pw2 = BC.power > 0; for (let i = 0; i < b.trail.length; i++) { ctx.globalAlpha = (i + 1) / (b.trail.length + 2) * (pw2 ? 0.5 : 0.28); ctx.fillStyle = pw2 ? '#ff8a20' : '#bfe8ff'; ctx.beginPath(); ctx.arc(b.trail[i].x, b.trail[i].y, G.r - 0.5, 0, 6.2832); ctx.fill(); } ctx.globalAlpha = 1; if (pw2) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff8a20'; ctx.beginPath(); ctx.arc(b.x, b.y, G.r + 3, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; } ctx.fillStyle = pw2 ? '#ffd890' : '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, G.r, 0, 6.2832); ctx.fill(); }
    for (const p of BC.parts) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    if (BC.comboShow && BC.comboShow.t > 0) { const cs = BC.comboShow; ctx.globalAlpha = Math.min(1, cs.t * 3); drawTextCenter('X' + cs.n, cs.x, cs.y, cs.n >= 8 ? '#ff7ab8' : cs.n >= 4 ? '#ffe070' : '#ffffff', cs.n >= 4 ? 2 : 1, '#050818'); ctx.globalAlpha = 1; }
    for (const q of BC.pops) { ctx.globalAlpha = Math.min(1, q.t * 2.5); drawTextCenter(q.txt, q.x, q.y, q.col, 1, '#050818'); ctx.globalAlpha = 1; }
    // 効果の のこり時間（バーで しめす・点滅しない）
    let ey = H - 22; const bar = (label, v, mx, col) => { if (v <= 0) return; drawText(label, 12, ey, col, 1); rect(12 + textWidth(label, 1) + 4, ey + 1, 40, 4, '#1a2448'); rect(12 + textWidth(label, 1) + 4, ey + 1, Math.round(40 * Math.min(1, v / mx)), 4, col); ey -= 8; };
    bar('WIDE', BC.widen, BCC.wideTime, '#7dfcff'); bar('POWER', BC.power, BCC.powerTime, '#ff9a3a'); bar('SLOW', BC.slow, BCC.slowTime, '#9fd0ff');
    ctx.restore();
    const ph = BC.phase; if (ph === 'stage') { rect(0, 150, W, 54, '#050818'); drawTextCenter('STAGE ' + BC.stage, W / 2, 160, '#ffe070', 3, '#a0481a'); drawTextCenter(BCC.stages[BC.stage - 1].name, W / 2, 186, '#7dfcff', 1); }
    if (ph === 'ready') { drawTextCenter('TAP TO START', W / 2, 250, '#ffffff', 1, '#050818'); }
    if (ph === 'play' && BC.startT > 0) drawTextCenter('START!', W / 2, 250, '#ffe070', 2, '#a0481a');
    if (ph === 'miss') { drawTextCenter('MISS!', W / 2, 200, '#ff7a7a', 3, '#3a0a0a'); drawTextCenter('BALL X' + BC.balls, W / 2, 226, '#ffffff', 1); }
    if (ph === 'clear') { drawTextCenter('STAGE CLEAR!', W / 2, 190, '#ffe070', 2, '#a0481a'); drawTextCenter('BALL BONUS X' + BC.balls, W / 2, 212, '#7dfcff', 1); }
    if (ph === 'allclear') { if (BC.flashT > 0) { ctx.globalAlpha = Math.min(0.45, BC.flashT); rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; } drawTextCenter('ALL CLEAR!', W / 2, 180, '#ffe070', 3, '#a0481a'); drawTextCenter('SCORE ' + BC.score, W / 2, 214, '#ffffff', 1); if (Math.random() < 0.5) BC.parts.push({ x: Math.random() * W, y: 40, vx: (Math.random() - 0.5) * 40, vy: 20, t: 0, life: 1.4, col: BC_ROWCOL[Math.floor(Math.random() * 7)], s: 2 }); }
    if (ph === 'over') { drawTextCenter('GAME OVER', W / 2, 190, '#ff7a7a', 3, '#3a0a0a'); }
    if (BC.pause) { ctx.globalAlpha = 0.7; rect(0, 0, W, H, '#02030c'); ctx.globalAlpha = 1; drawTextCenter('PAUSE', W / 2, 150, '#ffffff', 3, '#20a8c8'); if (!document.hidden) { drawTextCenter('READY?', W / 2, 190, '#ffe070', 2, '#a0481a'); drawTextCenter(String(Math.max(1, Math.ceil(BC.resumeT / 0.8))), W / 2, 214, '#ffffff', 3, '#20a8c8'); } }
    if (DEV_MODE && BC.dev.showSpeed) { const b = BC.ballsArr[0]; if (b) drawText('SPD ' + Math.round(Math.hypot(b.vx, b.vy)) + ' T' + Math.round(bcTargetSpeed()) + ' BALLS ' + BC.ballsArr.length + ' REM ' + BC.remain, 12, H - 10, '#00ff88', 1); }
  }
  function bcDrawSelect() {
    const G = bcGeo(); bcDrawField(G); const t = BC.sel;
    rect(18, 40, W - 36, 50, '#02030c'); rect(18, 40, W - 36, 2, '#20d8f0'); rect(18, 88, W - 36, 2, '#f040d0'); drawTextCenter('BLOCK', W / 2, 48, '#18d8f0', 3, '#0a4a6a'); drawTextCenter('CRASH', W / 2, 69, '#f040d0', 3, '#5a0a4a');
    const cols = ['#18d8f0', '#f040d0', '#ffd820', '#ff8a20', '#30e060', '#a050ff']; for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { const b = { kind: 'normal', r: r + c % 2 * 0, x: G.ox + c * G.bw, y: 104 + r * G.bh, w: G.bw, h: G.bh }; b.r = r; bcDrawBlock(b); }
    const bx = G.fx + G.fw / 2 + Math.sin(t * 1.8) * (G.fw * 0.3); const by = 190; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(G.fx + G.fw / 2 + Math.sin(t * 1.1) * 40, 150 + Math.abs(Math.sin(t * 1.4)) * 50, 3, 0, 6.2832); ctx.fill();
    const pw = BCC.paddleW; rect(Math.round(bx - pw / 2), by, pw, 6, '#e8eef8'); rect(Math.round(bx - pw / 2), by, 3, 6, '#20d8f0'); rect(Math.round(bx + pw / 2 - 3), by, 3, 6, '#20d8f0');
    ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(bx, by + 18, 5, 0, 6.2832); ctx.fill(); rect(Math.round(bx - 2), by + 22, 5, 8, '#ffe070');               // 👆（指）
    drawTextCenter('HIGH SCORE', W / 2, 232, '#7dfcff', 1); drawTextCenter(String(bcRec().high), W / 2, 243, '#ffe070', 2, '#a0481a'); drawTextCenter('YEN ' + P_().money + '    1 PLAY  YEN ' + BCC.price, W / 2, 264, '#a8b8ff', 1);
  }
  function bcDrawResult() {
    const G = bcGeo(); bcDrawField(G); const r = BC.result; drawTextCenter('BLOCK CRASH', W / 2, 40, '#18d8f0', 2, '#0a4a6a'); if (r.all) drawTextCenter('ALL CLEAR!', W / 2, 62, '#ffe070', 2, '#a0481a'); else drawTextCenter('GAME OVER', W / 2, 62, '#ff7a7a', 2, '#3a0a0a');
    const L = (lab, v, y, col) => { drawText(lab, 26, y, '#7dfcff', 1); drawText(String(v), W - 26 - textWidth(String(v), 1), y, col || '#ffffff', 1); };
    L('SCORE', r.score, 96, '#ffffff'); L('STAGE', r.stage + ' / ' + BCC.stages.length, 112); L('BROKEN BLOCKS', r.broken, 128); L('HIGH SCORE', r.high, 144, '#ffe070'); if (BC.newRecord) drawTextCenter('* NEW RECORD! *', W / 2, 172, '#7dff8a', 2, '#0a3a1a'); drawTextCenter('YEN ' + P_().money, W / 2, 206, '#a8b8ff', 1);
    for (const p of BC.parts) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
  }
  const BC_DOM = {};
  function bcBuildDom() {
    if (BC_DOM.play) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); BC_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    const txt = (id, html) => { const d = document.createElement('div'); d.className = 'prize-info st-say br-hint'; d.id = id; d.innerHTML = html; screenEl.appendChild(d); BC_DOM[id.slice(3)] = d; return d; };
    mk('bc-play', 'PLAY　¥' + BCC.price, 'td-go', bcInsert); mk('bc-retry', 'もういちど　¥' + BCC.price, 'td-go', bcInsert); mk('bc-out', '7Fにもどる', 'hb-sub', () => { BC.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    txt('bc-info', 'ボールを おとさず、<br>ブロックを ぜんぶ こわせ！<br>ゆびを 左右に うごかして パドルを そうさ');
  }
  function bcUi() {
    bcBuildDom(); const ph = BC.phase; const show = (k, on) => BC_DOM[k].classList.toggle('is-show', !!on); show('play', ph === 'select'); show('info', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result');
    crPlace(BC_DOM.info, { x: 8, y: 276, w: W - 16, h: 38 }); crPlace(BC_DOM.play, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(BC_DOM.retry, { x: 20, y: 236, w: W - 40, h: 34 }); crPlace(BC_DOM.out, { x: 20, y: 278, w: W - 40, h: 28 });
    for (const k of ['play', 'retry', 'out']) BC_DOM[k].style.fontSize = Math.max(10, parseFloat(BC_DOM[k].style.fontSize) * 0.95) + 'px';
  }
  function bcHide() { if (!BC_DOM.play) return; Object.keys(BC_DOM).forEach((k) => BC_DOM[k].classList.remove('is-show')); }
  function bcDraw() { const ph = BC.phase; if (ph === 'select') bcDrawSelect(); else if (ph === 'result') bcDrawResult(); else bcDrawPlay(); bcUi(); }
  function bcLeaveMid() {
    if (['select', 'result'].includes(BC.phase)) return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { BC.phase = 'select'; BC.pause = false; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  // ---- DEV ----
  function bcDevStage(n) { if (BC.phase === 'select' || BC.phase === 'result') { BC.balls = BCC.startBalls; BC.score = 0; BC.broken = 0; BC.paddleX = W / 2; BC.targetX = W / 2; } BC.stage = n; bcLoadStage(n); bcPrepare(); BC.phase = 'stage'; BC.t = 0; BC.pause = false; }
  function bcDevKill(left) { const live = BC.cells.filter((b) => b.alive && b.kind !== 'steel'); while (live.length > left) { const b = live.pop(); b.alive = false; BC.remain--; } }
  function openBcDev() {
    const again = (f) => () => { f(); setTimeout(openBcDev, 0); }; const act = (f) => () => { if (!['play', 'ready'].includes(BC.phase)) { toast('ゲーム中に つかってね'); return; } f(); };
    showDialog({ title: 'BLOCK CRASH DEV', wide: true, lines: [{ text: 'PHASE ' + BC.phase + ' / STAGE ' + BC.stage + ' / BALL ' + BC.balls + ' / 残り ' + BC.remain + ' / 無敵 ' + (BC.dev.god ? 'ON' : 'OFF') + ' / 速度×' + BC.dev.speedMul, cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'STAGE 1', onClick: () => bcDevStage(1) }, { label: 'STAGE 2', onClick: () => bcDevStage(2) }, { label: 'STAGE 3', onClick: () => bcDevStage(3) }, { label: 'STAGE 4', onClick: () => bcDevStage(4) }, { label: 'STAGE 5', onClick: () => bcDevStage(5) },
      { label: 'BALL数：1 / 3 / 5', onClick: again(() => { BC.balls = BC.balls === 1 ? 3 : BC.balls === 3 ? 5 : 1; }) }, { label: '無敵 ON/OFF（落ちない）', onClick: again(() => { BC.dev.god = !BC.dev.god; }) },
      { label: 'ボール速度 ×0.7 / ×1 / ×1.3', onClick: again(() => { BC.dev.speedMul = BC.dev.speedMul === 1 ? 1.3 : BC.dev.speedMul === 1.3 ? 0.7 : 1; }) }, { label: 'ボール速度の可視化 ON/OFF', onClick: again(() => { BC.dev.showSpeed = !BC.dev.showSpeed; }) },
      { label: 'WIDE 強制', onClick: act(() => bcApplyItem('WIDE', BC.paddleX, 330)) }, { label: 'MULTI 強制', onClick: act(() => bcApplyItem('MULTI', BC.paddleX, 330)) }, { label: 'POWER 強制', onClick: act(() => bcApplyItem('POWER', BC.paddleX, 330)) }, { label: 'SLOW 強制', onClick: act(() => bcApplyItem('SLOW', BC.paddleX, 330)) },
      { label: '残りブロック 1個', onClick: act(() => bcDevKill(1)) }, { label: 'STAGE CLEAR', onClick: act(() => { bcDevKill(0); }) },
      { label: 'GAME OVER', onClick: () => { if (['play', 'ready', 'miss', 'stage'].includes(BC.phase)) { BC.balls = 0; BC.phase = 'over'; BC.t = 0; } } }, { label: 'ALL CLEAR', onClick: () => { if (['play', 'ready', 'miss', 'stage', 'clear'].includes(BC.phase)) { BC.phase = 'allclear'; BC.t = 0; BC.flashT = 0.5; } } },
      { label: 'HIGH SCORE リセット', onClick: again(() => { const r = bcRec(); r.high = 0; r.bestStage = 0; r.allClear = false; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('blockCrash', {
    reset() { BC.phase = 'select'; BC.pause = false; }, phase: () => (['select', 'result'].includes(BC.phase) ? 'idle' : BC.phase),
    enter() { bcBuildDom(); BC.phase = 'select'; BC.sel = 0; BC.paying = false; BC.pause = false; BC.touch = null; BC.cells = []; BC.ballsArr = []; BC.parts = []; BC.pops = []; BC.paddleX = W / 2; BC.targetX = W / 2; setMessage('', C.cyan); },
    update: bcUpdate, draw: bcDraw, hint: '指を 左右に うごかして パドルを うごかそう',
    pointer: bcPointer, pointerUp: bcPointerUp
  });
  GAME_TYPES.blockCrash.pointerMove = bcPointerMove;
  GAME_TYPES.blockCrash.canLeave = () => ['select', 'result'].includes(BC.phase);
  GAME_TYPES.blockCrash.beforeLeave = () => bcLeaveMid();
  GAME_TYPES.blockCrash.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

