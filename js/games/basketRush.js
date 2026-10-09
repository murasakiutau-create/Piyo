'use strict';
  // =====================================================================
  //  🏀 BASKET RUSH（バスケットラッシュ）：6F SPORTS CORNER
  //   床にころがる6球のボールを、直接つかんで、ゴールへフリック。30秒で何本入れるか（1本＝1点）。ボールは消えず、ずっと同じ画面の中を、ころがってもどってくる
  //   成功か失敗かは、本物のボールの軌道で決まる（ひみつの抽選は、なし）。残り10秒から、ゴールが左右に動く
  //   物理は、かんたんな円の物理（重力・反発・ころがり・ボールどうしのぶつかり・リングとバックボード）。gameId＝basket_rush（階の番号は、入れない）
  // =====================================================================
  const BRC = CONFIG.basketRush;
  const BR_MACHINE = { machineId: 'br_basketrush', machineName: 'BASKET RUSH', label: 'BASKET RUSH', isUnlocked: true, gameType: 'basketRush', br: true };
  const BRL = { ceil: 30, wallL: 14, floorOff: 36, ringY: 98, boardTop: 52 };                                           // 画面の寸法（W と H から決まる）
  const BR = { phase: 'select', t: 0, clock: 0, timeLeft: 30, score: 0, balls: [], held: null, hist: [], gx: 99, gvx: 0, lastTen: false, gt: 0, banner: 0, netT: 0, flash: 0, best: 0, newRecord: false, result: null, pops: [], bounceCd: 0, sfxCd: 0, throwInfo: '', cnt: 3, hintSeen: false,
    dev: { freeze: false, noMove: false, debug: false, showThrow: false } };
  const brFloorY = () => H - BRL.floorOff;
  const brWallR = () => W - BRL.wallL;
  const brGoalCx = () => Math.round(W / 2);
  const brAmp = () => (brWallR() - BRL.wallL - BRC.goal.boardW - 6) / 2;                                              // ゴールが、画面の外へ出ない 左右のはば
  function brMakeBalls() {
    BR.balls = []; const r = BRC.physics.ballRadius; const n = BRC.ballCount;
    for (let i = 0; i < n; i++) BR.balls.push({ id: i, x: BRL.wallL + r + 6 + (i + 0.5) * ((brWallR() - BRL.wallL - 2 * r - 12) / n) + (Math.random() - 0.5) * 8, y: brFloorY() - r - Math.random() * 2, vx: (Math.random() - 0.5) * 40, vy: 0, r, ang: Math.random() * 6.28, held: false, counted: false, thrown: false, cd: 0 });
    BR.held = null; BR.hist = [];
  }
  function brReset() {
    BR.timeLeft = BRC.timeSec; BR.score = 0; BR.lastTen = false; BR.gt = 0; BR.banner = 0; BR.netT = 0; BR.flash = 0; BR.boardHit = 0; BR.gx = brGoalCx(); BR.gvx = 0; BR.newRecord = false; BR.result = null; BR.pops = []; BR.throwInfo = '';
    brMakeBalls();
  }
  // ---- 物理 ----
  function brHitCircle(b, cx, cy, cr, cvx, cvy, rest, kind) {
    const dx = b.x - cx; const dy = b.y - cy; const d = Math.hypot(dx, dy); const md = b.r + cr; if (d >= md || d === 0) return false;
    const nx = dx / d; const ny = dy / d; b.x = cx + nx * md; b.y = cy + ny * md; const rvx = b.vx - cvx; const rvy = b.vy - cvy; const vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx -= (1 + rest) * vn * nx; b.vy -= (1 + rest) * vn * ny; if (Math.abs(vn) > 40 && BR.sfxCd <= 0) { BR.sfxCd = 0.05; if (kind === 'ring') { beep(1500, 0, 0.05, 0.07, 'triangle'); beep(2200, 0, 0.03, 0.03, 'square'); } } }
    return true;
  }
  function brBoardFace(b) {                                                                                           // バックボード：画面の正面から見た「板の面」。強く上がってきたボールが当たると、勢いが落ちる（バンクショット）。ゆるく上がるボールは、板の手前を通る
    const G = BRC.goal; const bt = BRL.ringY - 8; if (b.banked || b.vy > -G.bankSpeed) return;
    if (Math.abs(b.x - BR.gx) <= G.boardW / 2 + b.r * 0.4 && b.y <= bt + b.r * 0.5 && b.y >= BRL.boardTop - b.r) { b.banked = true; b.vx = b.vx * 0.5 + BR.gvx * 0.5; b.vy *= G.bankKeep; BR.boardHit = 0.12; if (BR.sfxCd <= 0) { BR.sfxCd = 0.05; beep(240, 0, 0.07, 0.08, 'square'); noise(0.03, 0.03); } }
  }
  function brStep(dt) {
    const P = BRC.physics; const G = BRC.goal; const fy = brFloorY(); const wl = BRL.wallL; const wr = brWallR(); const playing = BR.phase === 'play'; BR.sfxCd -= dt;
    for (const b of BR.balls) {
      if (b.held) continue; b.prevY = b.y; b.vy += P.gravity * dt; const damp = Math.exp(-P.airDamping * dt); b.vx *= damp; b.vy *= damp; b.x += b.vx * dt; b.y += b.vy * dt; b.ang += (b.vx / b.r) * dt;
      if (b.x < wl + b.r) { b.x = wl + b.r; if (b.vx < 0) b.vx = -b.vx * P.wallRest; } else if (b.x > wr - b.r) { b.x = wr - b.r; if (b.vx > 0) b.vx = -b.vx * P.wallRest; }
      if (b.y < BRL.ceil + b.r) { b.y = BRL.ceil + b.r; if (b.vy < 0) b.vy = -b.vy * P.wallRest; }
      if (b.y > fy - b.r) {
        b.y = fy - b.r; if (b.vy > 0) { if (b.vy > 90 && b.cd <= 0) { b.cd = 0.09; beep(130 + Math.min(80, b.vy * 0.1), 0, 0.06, 0.06, 'sine'); } b.vy = b.vy > 36 ? -b.vy * P.floorRest : 0; }
        b.vx *= Math.exp(-P.rollFriction * dt); if (Math.abs(b.vx) < 3) b.vx = 0;
      }
      b.cd -= dt;
      if (b.vy > 0) { brHitCircle(b, BR.gx - G.hoopW / 2, BRL.ringY, G.rimR, BR.gvx, 0, P.ringRest, 'ring'); brHitCircle(b, BR.gx + G.hoopW / 2, BRL.ringY, G.rimR, BR.gvx, 0, P.ringRest, 'ring'); }      // リングは、おちてくるボールにだけ当たる（上へ投げたボールは、ゴールの手前を通りぬけて、いったん上へ行く）
      brBoardFace(b);
      const sy = BRL.ringY + G.sensorOffset;                                                                                   // ゴール判定：センサーを、上から下へ通りぬけたとき（1球につき、1回）
      if (b.y < BRL.ringY - 6) b.above = true; else if (b.y > BRL.ringY + 36) { b.above = false; b.banked = false; }
      if (b.y < BRL.ringY - 26) b.counted = false;
      if (!b.counted && b.above && b.prevY < sy && b.y >= sy && b.vy > P.minScoreVy && Math.abs(b.x - BR.gx) <= G.sensorW / 2) {
        b.counted = true; b.above = false; if (playing && BR.timeLeft > 0) { BR.score++; BR.netT = 0.6; BR.flash = 0.18; BR.pops.push({ x: BR.gx, y: BRL.ringY + 22, t: 0 }); beep(1175, 0, 0.06, 0.08, 'triangle'); beep(1568, 0.05, 0.1, 0.08, 'triangle'); noise(0.05, 0.03); }
      }
      if (b.y > H + 60 || b.x < -40 || b.x > W + 40 || !isFinite(b.x + b.y)) { b.x = clamp(Math.random() * W, wl + 10, wr - 10); b.y = fy - b.r; b.vx = 0; b.vy = 0; b.held = false; }       // 万一の復帰（ふつうは見えない）
    }
    for (let i = 0; i < BR.balls.length; i++) for (let j = i + 1; j < BR.balls.length; j++) {                                  // ボールどうしの、かるいぶつかり
      const a = BR.balls[i]; const c = BR.balls[j]; if (a.held || c.held) continue; const dx = c.x - a.x; const dy = c.y - a.y; const d = Math.hypot(dx, dy); const md = a.r + c.r; if (d >= md || d === 0) continue;
      const nx = dx / d; const ny = dy / d; const ov = (md - d) / 2; a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov; const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
      if (vn > 0) { const imp = ((1 + P.ballBallRest) * vn) / 2; a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny; if (vn > 80 && BR.sfxCd <= 0) { BR.sfxCd = 0.05; beep(170, 0, 0.05, 0.05, 'sine'); } }
    }
  }
  // ---- 入力：ボールを直接つかんで、フリック ----
  function brPointer(e, p) {
    if (BR.phase !== 'play' || BR.held) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    let best = null; let bd = 1e9; const pad = BRC.throw.touchPad;
    for (const b of BR.balls) { if (b.held) continue; const d = Math.hypot(b.x - p.x, b.y - p.y); if (d <= b.r + pad && d < bd) { bd = d; best = b; } }
    if (!best) return; best.held = true; best.vx = 0; best.vy = 0; BR.held = { b: best, id: e.pointerId }; BR.hist = [{ t: performance.now(), x: p.x, y: p.y }]; beep(900, 0, 0.03, 0.04, 'triangle');
  }
  function brPointerMove(e, p) {
    const h = BR.held; if (!h || h.id !== e.pointerId) return; const b = h.b; const pad = b.r;
    b.x = clamp(p.x, BRL.wallL + pad, brWallR() - pad); b.y = clamp(p.y, BRL.ceil + pad, brFloorY() - pad); const now = performance.now(); BR.hist.push({ t: now, x: p.x, y: p.y }); while (BR.hist.length > 2 && now - BR.hist[0].t > 140) BR.hist.shift();
  }
  function brLaunch(b, vx, vy) { b.held = false; b.vx = vx; b.vy = vy; b.counted = false; b.banked = false; b.above = false; b.thrown = true; }
  function brAssist(b, vx, vy) {                                                                                      // アーケード的な、ゆるさ：上へ投げたとき、ゴールの真上へ向かう横の速さに、少しだけ近づける（ゴールの位置は、投げた瞬間のもの。動くゴールは、先を読む必要がある）
    const T = BRC.throw; const G = BRC.goal; if (!(T.aimAssist > 0) || vy >= 0) return [vx, vy];
    const yr = BRL.ringY + G.sensorOffset; const disc = vy * vy - 2 * BRC.physics.gravity * (b.y - yr); if (disc <= 0) return [vx, vy];
    const td = (-vy + Math.sqrt(disc)) / BRC.physics.gravity; const need = (BR.gx - b.x) / td; const diff = need - vx; if (Math.abs(diff) <= T.assistRange) vx += diff * T.aimAssist; return [vx, vy];
  }
  function brPointerUp(e) {
    const h = BR.held; if (!h || h.id !== e.pointerId) return; const b = h.b; BR.held = null; const T = BRC.throw; const now = performance.now();
    const hs = BR.hist.filter((q) => now - q.t <= T.window * 1000 + 30); const a = hs[0] || BR.hist[0]; const z = hs[hs.length - 1] || a; const dtm = Math.max(0.016, (z.t - a.t) / 1000);
    let vx = (z.x - a.x) / dtm; let vy = (z.y - a.y) / dtm; const raw = Math.hypot(vx, vy);
    if (BR.phase !== 'play' || raw < T.minFlick) { brLaunch(b, vx * 0.1, Math.max(0, vy) * 0.1); BR.throwInfo = 'DROP'; return; }                  // ゆっくり はなしたときは、投げずに、落とす
    const sp = clamp(raw * T.mul, T.minSpeed, T.maxSpeed); vx = (vx / raw) * sp; vy = (vy / raw) * sp; [vx, vy] = brAssist(b, vx, vy); brLaunch(b, vx, vy); BR.throwInfo = 'RAW ' + Math.round(raw) + ' THROW ' + Math.round(sp) + ' ANG ' + Math.round(Math.atan2(-vy, vx) * 180 / Math.PI);
    beep(420, 0, 0.1, 0.05, 'triangle', 760); noise(0.04, 0.02);
  }
  // ---- 流れ ----
  function brBegin() {
    if (P_().money < BRC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(BRC.price); P_().basketRush.playCount++; writeSave(); brReset(); BR.phase = 'ready'; BR.t = 0; BR.cnt = 3; beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); beep(660, 0.25, 0.1, 0.05, 'square');
  }
  function brUpdate(dt) {
    BR.clock += dt; dt = Math.min(dt, 0.05); const ph = BR.phase; BR.t += dt;
    if (ph === 'select') { BR.sel = (BR.sel || 0) + dt; return; }
    if (ph === 'ready') { if (BR.t > (P_().basketRush.seenHint ? 0.9 : 2.0)) { BR.phase = 'count'; BR.t = 0; BR.cnt = 3; beep(660, 0, 0.1, 0.05, 'square'); } }
    else if (ph === 'count') { const c = 3 - Math.floor(BR.t / 0.8); if (c !== BR.cnt && c >= 1) { BR.cnt = c; beep(660 + (3 - c) * 110, 0, 0.1, 0.05, 'square'); } if (BR.t >= 2.4) { BR.phase = 'play'; BR.t = 0; BR.goT = 0; beep(1568, 0, 0.25, 0.07, 'square'); P_().basketRush.seenHint = true; } }
    else if (ph === 'play') {
      if (!BR.dev.freeze) BR.timeLeft -= dt; const tl = BR.timeLeft;
      if (!BR.lastTen && tl <= BRC.goal.moveStartAt) { BR.lastTen = true; BR.gt = 0; BR.banner = 1.4; [880, 1175, 880, 1175].forEach((f, i) => beep(f, i * 0.09, 0.07, 0.07, 'square')); }
      const sec = Math.ceil(tl); if (BR.lastSec !== sec) { BR.lastSec = sec; if (sec <= 3 && sec >= 1) beep(1319, 0, 0.12, 0.07, 'square'); }
      if (tl <= 0) { BR.timeLeft = 0; BR.phase = 'timeup'; BR.t = 0; if (BR.held) { const b = BR.held.b; BR.held = null; brLaunch(b, 0, 0); } [988, 784, 659, 523].forEach((f, i) => beep(f, i * 0.12, 0.2, 0.08, 'sawtooth')); noise(0.2, 0.06); }
    } else if (ph === 'timeup') { if (BR.t > 1.8) brFinish(); }
    if (BR.banner > 0) BR.banner -= dt; if (BR.netT > 0) BR.netT -= dt; if (BR.flash > 0) BR.flash -= dt; if (BR.boardHit > 0) BR.boardHit -= dt;
    for (const q of BR.pops) q.t += dt; BR.pops = BR.pops.filter((q) => q.t < 0.7);
    const px0 = BR.gx; if (BR.lastTen && !BR.dev.noMove && (ph === 'play' || ph === 'timeup')) { BR.gt += dt; const A = brAmp(); const w = BRC.goal.moveSpeed / A; const ramp = clamp(BR.gt / 0.8, 0, 1); BR.gx = brGoalCx() + BRC.goal.moveDir * A * Math.sin(w * BR.gt) * (ramp * ramp * (3 - 2 * ramp)); }
    BR.gvx = dt > 0 ? (BR.gx - px0) / dt : 0; BR.gvx = clamp(BR.gvx, -BRC.goal.moveSpeed * 1.5, BRC.goal.moveSpeed * 1.5);
    let rem = dt; const sub = 1 / 240; while (rem > 1e-6) { const d = Math.min(rem, sub); brStep(d); rem -= d; }
  }
  function brFinish() {
    const rec = P_().basketRush; BR.result = { score: BR.score }; if (BR.score > rec.bestScore) { rec.bestScore = BR.score; BR.newRecord = true; } BR.best = rec.bestScore; writeSave(); BR.phase = 'result'; BR.t = 0;
    [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle')); if (BR.newRecord) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.5 + i * 0.08, 0.14, 0.05));
  }
  // ---- 描画 ----
  function brBall(b) {                                                                                                  // バスケットボール：オレンジ＋黒いライン（ころがるとき、まわる）
    const r = b.r; ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(1, r - 1, r * 0.9, 2.2, 0, 0, 6.2832); ctx.fill(); ctx.rotate(b.ang);
    ctx.fillStyle = '#7a3208'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffa84a'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.3, r * 0.55, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -r + 1); ctx.lineTo(0, r - 1); ctx.moveTo(-r + 1, 0); ctx.lineTo(r - 1, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(-r * 1.15, 0, r * 0.95, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(r * 1.15, 0, r * 0.95, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-r * 0.6, -r * 0.6, 2, 2); ctx.restore();
  }
  function brGoal() {
    const G = BRC.goal; const gx = BR.gx; const ry = BRL.ringY; const bt = BRL.boardTop; const bw = G.boardW; const bb = ry - 8;
    if (BR.boardHit > 0) { ctx.globalAlpha = BR.boardHit * 5; rect(Math.round(gx - bw / 2) - 4, bt - 4, bw + 8, bb - bt + 8, '#ffe070'); ctx.globalAlpha = 1; }
    rect(Math.round(gx - bw / 2) - 2, bt - 2, bw + 4, bb - bt + 4, '#1a0a04'); rect(Math.round(gx - bw / 2), bt, bw, bb - bt, '#f4f4f4'); rect(Math.round(gx - bw / 2), bt, bw, 2, '#ffffff'); rect(Math.round(gx - bw / 2), bb - 2, bw, 2, '#c8c8c8');       // バックボード
    rect(Math.round(gx - 11), bb - 15, 22, 13, '#ff7a1a'); rect(Math.round(gx - 9), bb - 13, 18, 9, '#f4f4f4'); rect(Math.round(gx - 11), bb - 15, 22, 1, '#ffb060');
    const sw = BR.netT > 0 ? Math.sin(BR.netT * 40) * 3 * (BR.netT / 0.6) : 0; const ext = BR.netT > 0 ? 3 * (BR.netT / 0.6) : 0; const hw = G.hoopW / 2;                       // ネット（入ると、ゆれて、のびる）
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 1; for (let k = 0; k <= 4; k++) { const tx = gx - hw + (G.hoopW * k) / 4; const bx = gx - hw * 0.62 + (hw * 1.24 * k) / 4 + sw; ctx.beginPath(); ctx.moveTo(Math.round(tx), ry + 2); ctx.lineTo(Math.round(bx), ry + 24 + ext); ctx.stroke(); }
    for (const q of [8, 16]) { const f = q / 24; const lx = gx - hw + (hw - hw * 0.62) * f + sw * f; const rx = gx + hw - (hw - hw * 0.62) * f + sw * f; ctx.beginPath(); ctx.moveTo(Math.round(lx), ry + q + 2); ctx.lineTo(Math.round(rx), ry + q + 2); ctx.stroke(); }
    rect(Math.round(gx - hw) - 2, ry - 2, G.hoopW + 4, 4, '#7a2a04'); rect(Math.round(gx - hw) - 1, ry - 2, G.hoopW + 2, 3, '#ff6a1a'); rect(Math.round(gx - hw) - 1, ry - 2, G.hoopW + 2, 1, '#ffb060');                                // リング
  }
  function brScene() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#140a06'); const fy = brFloorY();
    for (let y = BRL.ceil - 4; y < fy; y++) rect(14, y, W - 28, 1, mixHex('#4a2208', '#1a0c04', (y - BRL.ceil) / (fy - BRL.ceil)));
    for (let x = 22; x < W - 20; x += 22) { ctx.globalAlpha = 0.12; rect(x, BRL.ceil, 2, fy - BRL.ceil, '#ff9a3a'); ctx.globalAlpha = 1; }
    rect(8, 8, W - 16, BRL.ceil - 6, '#e8782a'); rect(8, 8, W - 16, 2, '#ffb060'); rect(8, BRL.ceil - 4, W - 16, 2, '#1a0a04');
    rect(8, 8, 6, H - 16, '#e8782a'); rect(W - 14, 8, 6, H - 16, '#e8782a'); for (let y = 14; y < H - 14; y += 14) { rect(8, y, 6, 3, '#1a0a04'); rect(W - 14, y, 6, 3, '#1a0a04'); }
    rect(14, fy, W - 28, H - 8 - fy, '#d8741c'); rect(14, fy, W - 28, 3, '#ffb060'); rect(14, fy + 3, W - 28, 1, '#7a3208'); for (let x = 14; x < W - 14; x += 22) rect(x, fy + 8, 1, H - 16 - fy, '#a85a10'); rect(14, fy + 14, W - 28, 1, '#f4f4f4');
    brGoal(); for (const b of BR.balls) brBall(b);
    for (const q of BR.pops) { ctx.globalAlpha = 1 - q.t / 0.7; drawTextCenter('+1', q.x, q.y - q.t * 30, '#ffffff', 2, '#ff6a1a'); ctx.globalAlpha = 1; }
    if (BR.flash > 0) { ctx.globalAlpha = BR.flash * 1.2; rect(14, BRL.ceil, W - 28, 130, '#fff3c0'); ctx.globalAlpha = 1; }
    if (BR.dev.debug) { const G = BRC.goal; ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; for (const b of BR.balls) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r + BRC.throw.touchPad, 0, 6.2832); ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = '#ffff00'; for (const sx of [BR.gx - G.hoopW / 2, BR.gx + G.hoopW / 2]) { ctx.beginPath(); ctx.arc(sx, BRL.ringY, G.rimR, 0, 6.2832); ctx.stroke(); } ctx.strokeStyle = '#ff00ff'; ctx.strokeRect(BR.gx - G.boardW / 2, BRL.boardTop, G.boardW, BRL.ringY - 8 - BRL.boardTop); ctx.strokeStyle = '#00ffff'; ctx.strokeRect(BR.gx - G.sensorW / 2, BRL.ringY + G.sensorOffset - G.sensorH / 2, G.sensorW, G.sensorH); ctx.strokeStyle = '#ff6a6a'; ctx.beginPath(); ctx.moveTo(14, brFloorY()); ctx.lineTo(W - 14, brFloorY()); ctx.stroke(); }
  }
  function brHud() {
    const tl = Math.max(0, BR.timeLeft); const sec = Math.ceil(tl); const warn = BR.lastTen; const blink = warn && Math.floor(BR.clock * 4) % 2 === 0;
    drawText('TIME', 18, 11, '#ffffff', 1, '#1a0a04'); drawText(String(BR.phase === 'play' || BR.phase === 'timeup' ? sec : BRC.timeSec), 18, 18, sec <= 3 && BR.phase === 'play' ? '#ff4a4a' : warn ? (blink ? '#ff6a4a' : '#ffffff') : '#ffffff', sec <= 3 && BR.phase === 'play' ? 3 : 2, '#1a0a04');
    const ss = String(BR.score); drawText('SCORE', W - 18 - 5 * 4, 11, '#ffffff', 1, '#1a0a04'); drawText(ss, W - 18 - ss.length * 8 - 2, 18, '#ffffff', 2, '#1a0a04');
    if (BR.banner > 0 && BR.phase === 'play') { ctx.globalAlpha = Math.min(1, BR.banner * 2); drawTextCenter('LAST 10!', W / 2, 150, '#ffe070', 4, '#7a2a04'); ctx.globalAlpha = 1; }
    if (BR.phase === 'timeup') drawTextCenter('TIME UP!', W / 2, 150, '#ffffff', 4, '#c03010');
    if (BR.phase === 'ready') { drawTextCenter('READY?', W / 2, 150, '#ffe070', 4, '#7a2a04'); }
    if (BR.phase === 'count') { if (BR.t < 2.4) drawTextCenter(String(BR.cnt), W / 2, 130, '#ffffff', 8, '#ff6a1a'); }
    if (BR.phase === 'play' && BR.t < 0.7) drawTextCenter('GO!', W / 2, 140, '#7dff8a', 6, '#0a3a1a');
    if (BR.dev.showThrow && BR.throwInfo) drawText(BR.throwInfo, 16, 36, '#00ff88', 1);
  }
  function brDrawResult() {
    brScene(); ctx.globalAlpha = 0.84; rect(14, 40, W - 28, 280, '#140a06'); ctx.globalAlpha = 1; rect(14, 40, W - 28, 2, '#ff8a1a'); drawTextCenter('BASKET RUSH', W / 2, 52, '#ff8a1a', 2, '#3a1a04');
    drawTextCenter('SCORE', W / 2, 92, '#ffffff', 1); drawTextCenter(String(BR.result.score), W / 2, 106, '#ffe070', 6, '#7a2a04'); drawTextCenter('BEST', W / 2, 160, '#ffffff', 1); drawTextCenter(String(BR.best), W / 2, 172, '#ffffff', 3, '#3a1a04');
    if (BR.newRecord && Math.floor(BR.clock * 3) % 2 === 0) drawTextCenter('NEW RECORD!', W / 2, 206, '#7dff8a', 2, '#0a3a1a'); drawTextCenter('YEN ' + P_().money, W / 2, 232, '#7ad8ff', 1);
  }
  function brDrawSelect() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#e8782a'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#f08a2c', '#c85a10', (y - 8) / (H - 16)));
    for (let x = 8; x < W - 8; x += 20) rect(x, 8, 8, H - 16, '#d8681a'); rect(8, 8, W - 16, 3, '#ffd0a0');
    rect(16, 18, W - 32, 62, '#1a0a04'); rect(18, 20, W - 36, 58, '#2a1408'); drawTextCenter('BASKET', W / 2, 26, '#ffffff', 3, '#7a2a04'); drawTextCenter('RUSH', W / 2, 52, '#ff8a1a', 3, '#ffffff');
    const t = BR.sel || 0; brBall({ x: 40, y: 98 + Math.round(Math.abs(Math.sin(t * 3)) * -8), r: 11, ang: t * 2 }); brBall({ x: W - 40, y: 98 + Math.round(Math.abs(Math.sin(t * 3 + 1.5)) * -8), r: 11, ang: -t * 2 });
    const save = BR.gx; BR.gx = Math.round(W / 2); const sy = BRL.ringY; BRL.ringY = 138; BRL.boardTop = 98; brGoal(); BRL.ringY = sy; BRL.boardTop = 52; BR.gx = save;
    rect(16, 196, W - 32, 74, '#fff6e0'); rect(16, 196, W - 32, 2, '#ffffff'); rect(16, 268, W - 32, 2, '#c8a870'); drawTextCenter('30 SEC  1 GOAL = 1 POINT', W / 2, 204, '#7a2a04', 1); drawTextCenter('LAST 10 SEC: GOAL MOVES!', W / 2, 218, '#c03010', 1);
    drawTextCenter('BEST ' + P_().basketRush.bestScore, W / 2, 236, '#1a0a04', 2, '#ffd0a0'); drawTextCenter('YEN ' + P_().money + '    PLAY  YEN ' + BRC.price, W / 2, 256, '#7a2a04', 1);
    for (let i = 0; i < 6; i++) brBall({ x: 24 + i * ((W - 48) / 5), y: 300 + (i % 2) * 3, r: 9, ang: i }); rect(16, 312, W - 32, 3, '#7a3208');
  }
  // ---- DOM ----
  const BR_DOM = {};
  function brBuildDom() {
    if (BR_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); BR_DOM[id.slice(3)] = b; return b; };
    mk('br-start', 'PLAY　¥' + BRC.price, 'td-go').addEventListener('click', () => { ensureAudio(); brBegin(); });
    mk('br-retry', 'もういちど　¥' + BRC.price, 'td-go').addEventListener('click', () => { ensureAudio(); brBegin(); });
    mk('br-out', '6Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); BR.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('br-skip', 'SKIP', 'hb-quit st-small').addEventListener('click', () => { ensureAudio(); if (BR.phase === 'ready') { BR.t = 99; } });
    const hint = document.createElement('div'); hint.className = 'prize-info st-say br-hint'; hint.textContent = 'ボールをつかんで ゴールへフリック！'; screenEl.appendChild(hint); BR_DOM.hint = hint;
  }
  function brUi() {
    brBuildDom(); const ph = BR.phase; const show = (k, on) => BR_DOM[k].classList.toggle('is-show', !!on);
    show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); show('skip', ph === 'ready' && !P_().basketRush.seenHint); show('hint', ph === 'ready' && !P_().basketRush.seenHint);
    crPlace(BR_DOM.start, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(BR_DOM.retry, { x: 20, y: 262, w: W - 40, h: 32 }); crPlace(BR_DOM.out, { x: 20, y: 302, w: W - 40, h: 26 }); crPlace(BR_DOM.skip, { x: W - 52, y: 40, w: 40, h: 18 }); crPlace(BR_DOM.hint, { x: 14, y: 200, w: W - 28, h: 40 });
  }
  function brHide() { if (!BR_DOM.start) return; Object.keys(BR_DOM).forEach((k) => BR_DOM[k].classList.remove('is-show')); }
  function brDraw() {
    const ph = BR.phase; if (ph === 'select') brDrawSelect(); else if (ph === 'result') brDrawResult(); else { brScene(); brHud(); } brUi();
  }
  function openBrDev() {
    const again = (f) => () => { f(); setTimeout(openBrDev, 0); }; const P = BRC.physics; const T = BRC.throw; const G = BRC.goal;
    showDialog({ title: 'BASKET RUSH DEV', wide: true, lines: [{ text: 'TIME ' + BR.timeLeft.toFixed(1) + ' / SCORE ' + BR.score + ' / gravity ' + P.gravity + ' / throw ×' + T.mul.toFixed(2) + ' (' + T.minSpeed + '〜' + T.maxSpeed + ')', cls: 'dim' }, { text: 'ゴール速度 ' + G.moveSpeed + ' / 移動 ' + (BR.dev.noMove ? 'OFF' : 'ON') + ' / タイマー ' + (BR.dev.freeze ? '停止' : '動く') + ' / 判定表示 ' + (BR.dev.debug ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'タイマー 停止 ON/OFF', onClick: again(() => { BR.dev.freeze = !BR.dev.freeze; }) }, { label: 'TIME → 残り10秒', onClick: again(() => { BR.timeLeft = Math.min(BR.timeLeft, BRC.goal.moveStartAt + 0.2); }) }, { label: 'TIME → 残り3秒', onClick: again(() => { BR.timeLeft = Math.min(BR.timeLeft, 3.2); }) },
      { label: 'ゴール移動 ON/OFF', onClick: again(() => { BR.dev.noMove = !BR.dev.noMove; }) }, { label: 'ゴール速度 +10', onClick: again(() => { G.moveSpeed += 10; }) }, { label: 'ゴール速度 -10', onClick: again(() => { G.moveSpeed = Math.max(0, G.moveSpeed - 10); }) },
      { label: 'ボール位置リセット', onClick: again(() => { brMakeBalls(); }) },
      { label: 'gravity +60', onClick: again(() => { P.gravity += 60; }) }, { label: 'gravity -60', onClick: again(() => { P.gravity = Math.max(200, P.gravity - 60); }) },
      { label: '投げる速さ ×+0.1', onClick: again(() => { T.mul += 0.1; }) }, { label: '投げる速さ ×-0.1', onClick: again(() => { T.mul = Math.max(0.3, T.mul - 0.1); }) },
      { label: '投球速度の表示 ON/OFF', onClick: again(() => { BR.dev.showThrow = !BR.dev.showThrow; }) }, { label: '判定（ボール・リング・ボード・センサー）表示 ON/OFF', onClick: again(() => { BR.dev.debug = !BR.dev.debug; }) },
      { label: 'BEST SCORE リセット', onClick: again(() => { P_().basketRush.bestScore = 0; writeSave(); }) },
      { label: 'とじる', primary: true } ] });
  }
  mgRegister('basketRush', {
    reset() { BR.phase = 'select'; BR.held = null; }, phase: () => BR.phase,
    enter() { brBuildDom(); BR.phase = 'select'; BR.sel = 0; brReset(); BR.timeLeft = BRC.timeSec; setMessage('', C.cyan); },
    update: brUpdate, draw: brDraw, hint: 'ボールをつかんで ゴールへフリック！',
    pointer: brPointer, pointerUp: brPointerUp
  });
  GAME_TYPES.basketRush.pointerMove = brPointerMove;
  GAME_TYPES.basketRush.canLeave = () => BR.phase === 'select' || BR.phase === 'result';
  GAME_TYPES.basketRush.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

