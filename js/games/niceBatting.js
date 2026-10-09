'use strict';
  // =====================================================================
  //  ⚾ NICE BATTING（ナイスバッティング）：6F SPORTS CORNER
  //   バッターの斜め後ろから、奥のピッチングマシンを見る、かるい疑似3D。10球を、1球ずつ見て、横にスワイプしてバットを振る
  //   バットの動きは、あらかじめ決めた自然な軌道（プレイヤーは「振るタイミング」と「勢い」だけを決める）。当たったかどうか・打球の向き・強さは、
  //   ボールがとどく時刻と、バットがゾーンを通る時刻の差（timingDelta）と、スワイプの勢いから、計算で決まる（ひみつの抽選は、なし）
  //   gameId＝nice_batting（階の番号は入れない）。BASKET RUSHとちがい、せかさない：1球ずつ、見て、待って、振る
  // =====================================================================
  const NBC = CONFIG.niceBatting;
  const NB_MACHINE = { machineId: 'nb_nicebatting', machineName: 'NICE BATTING', label: 'NICE BATTING', isUnlocked: true, gameType: 'niceBatting', nb: true };
  const NB = { phase: 'select', t: 0, clock: 0, ballNo: 0, score: 0, ball: null, bat: { state: 'idle', t: 0, D: 0.3, used: false, th: -1.2 }, sw: null, pops: [], flash: {}, best: 0, newRecord: false, result: null, lastBall: 0, info: '', after: 0,
    dev: { fixSpeed: false, fixPos: false, window: false, info: false, targets: false, force: null, big100: false, jump: 0 } };
  const nbCx = () => Math.round(W / 2);
  const nbMachinePos = () => ({ x: Math.round(W * 0.4), y: 170 });                                                       // ピッチングマシンの出口（奥）
  const nbZone = () => ({ x: Math.round(W * 0.5), y: 298 });                                                            // バットがボールをとらえる場所（手前）
  const nbPivot = () => ({ x: nbZone().x + NBC.swing.batLen, y: nbZone().y });                                           // バッターの手の位置（右手前）
  function nbTargets() {                                                                                                // 的（奥の防球ネットの上）
    const cx = nbCx(); return NBC.targets.map((t) => ({ score: t.score, x: cx + t.dx, y: t.y, r: (t.score === 100 && NB.dev.big100) ? t.r * 2 : t.r }));
  }
  function nbNewPitch() {
    const P = NBC.pitch; const rnd = () => (Math.random() * 2 - 1);
    const fx = NB.dev.fixSpeed; const fp = NB.dev.fixPos; const T = P.baseTime * (1 + (fx ? 0 : rnd() * P.timeVariance));
    NB.ball = { state: 'pitch', pt: 0, T, hOff: fp ? 0 : rnd() * P.heightVariance, wOff: fp ? 0 : rnd() * P.horizontalVariance, x: 0, y: 0, sc: 0.3, spin: 0 };
    NB.bat = { state: 'idle', t: 0, D: 0.3, used: false, th: NBC.swing.readyAngle }; NB.sw = null; NB.pt0 = performance.now();
    beep(1175, 0, 0.12, 0.06, 'square'); noise(0.05, 0.04);                                                              // ガコン！
  }
  // ---- ボールの位置：奥から手前へ（遠近：近づくほど、大きく、はやく見える） ----
  function nbBallScreen(b) {
    const m = nbMachinePos(); const z = nbZone(); const ez = clamp(b.pt / b.T, 0, 1.4); const p = Math.pow(ez, 1.55);
    const hx = z.x + b.wOff * 8; const hy = z.y - b.hOff * 10;
    const x = m.x + (hx - m.x) * p; const y = m.y + (hy - m.y) * p; const sc = 0.28 + 0.72 * Math.min(1.25, p); return { x, y, sc };
  }
  // ---- スワイプ：横へ ----
  function nbPointer(e, p) { try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } NB.sw = { x: p.x, y: p.y, t: performance.now(), id: e.pointerId, fired: false }; }
  function nbPointerMove(e, p) {
    const s = NB.sw; if (!s || s.fired || s.id !== e.pointerId) return; const S = NBC.swing; const dx = p.x - s.x; const dy = p.y - s.y; const dist = Math.abs(dx);
    if (dist < S.minDistance || Math.abs(dy) > dist * S.slantTolerance) return;                                           // 横へ（すこし斜めでもOK）。タップだけでは、振らない
    s.fired = true; const el = Math.max(0.03, (performance.now() - s.t) / 1000); nbSwing(dist / el);
  }
  function nbPointerUp(e) { if (NB.sw && NB.sw.id === e.pointerId) NB.sw = null; }
  function nbSwing(speed) {
    if (NB.phase !== 'pitch' || !NB.ball || NB.ball.state !== 'pitch' || NB.bat.used) return;                           // 1球につき1回だけ。振りはじめたら、おわるまで次は受けつけない
    const S = NBC.swing; const bat = NB.bat; bat.used = true; bat.state = 'swing'; bat.t = 0;
    const sn = clamp((speed - S.minSpeed) / (S.maxSpeed - S.minSpeed), 0, 1); bat.sn = sn; bat.speed = Math.round(speed);
    bat.D = S.durMax - (S.durMax - S.durMin) * sn; bat.tc = S.contactAt * bat.D;                                           // バットがゾーンを通る時刻（振りはじめから）
    const swingAt = NB.ball.pt; const delta = swingAt + bat.tc - NB.ball.T;                                                // timingDelta：＋＝おそい／−＝はやい
    bat.delta = delta; bat.res = nbResolve(delta, sn); beep(300, 0, 0.12, 0.05, 'sawtooth', 120); noise(0.05, 0.025);       // ブンッ
  }
  function nbResolve(delta, sn) {                                                                                         // 時間のずれと勢いから、打球を決める（乱数は、なし）
    const H = NBC.hit; const b = NB.ball; let d = delta; if (NB.dev.force === 'nice') d = 0; const win = H.window; const res = { hit: false, delta };
    if (NB.dev.force === 'miss' || Math.abs(d - H.perfectCenter) > win) return res;
    const qual = 1 - Math.abs(d - H.perfectCenter) / win; const snn = NB.dev.force === 'nice' ? 1 : sn;
    const power = clamp(H.powerQual * qual + H.powerSpeed * (0.3 + 0.7 * snn), 0, 1); const dirNorm = clamp((d - H.perfectCenter) / win, -1, 1) + b.wOff * NBC.flight.wBias;
    const foul = qual < H.foulQual; const nice = qual >= H.niceQual && power >= H.nicePower;
    const F = NBC.flight; let tx = nbCx() + dirNorm * F.landSx; let ty = Math.max(F.topY, F.baseY - ((power - F.pLow) / (1 - F.pLow)) * F.rise - b.hOff * F.hBias);
    if (foul) { tx = nbCx() + (dirNorm >= 0 ? 1 : -1) * 130; ty = 120 + Math.abs(dirNorm) * 20; }
    Object.assign(res, { hit: true, qual, power, dirNorm, foul, nice, tx, ty, kind: foul ? 'foul' : nice ? 'nice' : power < 0.4 ? 'weak' : 'normal' }); return res;
  }
  // ---- 流れ ----
  function nbBegin() {
    if (P_().money < NBC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(NBC.price); P_().niceBatting.playCount++; writeSave();
    NB.ballNo = 0; NB.score = 0; NB.ball = null; NB.pops = []; NB.flash = {}; NB.newRecord = false; NB.result = null; NB.bat = { state: 'idle', t: 0, D: 0.3, used: false, th: NBC.swing.readyAngle }; NB.phase = 'ready'; NB.t = 0;
    beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05);
    if (NB.dev.jump > 0) { NB.ballNo = NB.dev.jump - 1; }
  }
  function nbStartWind() { NB.ballNo++; NB.phase = 'wind'; NB.t = 0; NB.ball = null; NB.lastBall = NB.ballNo === NBC.ballCount; NB.lastShow = NB.lastBall ? 1.2 : 0; beep(220, 0, NBC.windTime, 0.05, 'sawtooth', 420); }                  // ウィーン……
  function nbEndBall(txt, color, big) { NB.after = NBC.nextPitchDelay; NB.phase = 'after'; NB.t = 0; if (txt) NB.pops.push({ txt, x: nbCx(), y: 120, t: 0, color: color || '#ffffff', big: !!big }); }
  function nbUpdate(dt) {
    NB.clock += dt; dt = Math.min(dt, 0.05); const ph = NB.phase; NB.t += dt; if (ph === 'select') { NB.sel = (NB.sel || 0) + dt; return; }
    for (const q of NB.pops) q.t += dt; NB.pops = NB.pops.filter((q) => q.t < 1.1); for (const k of Object.keys(NB.flash)) { NB.flash[k] -= dt; if (NB.flash[k] <= 0) delete NB.flash[k]; } if (NB.lastShow > 0) NB.lastShow -= dt;
    if (ph === 'ready') { if (NB.t > (P_().niceBatting.seenHint ? 0.7 : 2.2)) { P_().niceBatting.seenHint = true; nbStartWind(); } }
    else if (ph === 'wind') { if (NB.t >= NBC.windTime) { NB.phase = 'pitch'; NB.t = 0; nbNewPitch(); } }
    else if (ph === 'pitch') {
      const b = NB.ball; const bat = NB.bat;
      if (b.state === 'pitch') {
        b.pt += dt; b.spin += dt * 14; const sc = nbBallScreen(b); b.x = sc.x; b.y = sc.y; b.sc = sc.sc;
        if (bat.state === 'swing') {
          bat.t += dt; bat.th = nbBatAngle(bat.t / bat.D);
          if (bat.res && !bat.done && bat.t >= bat.tc) {                                                                                         // バットがゾーンを通る：当たったか？
            bat.done = true; const r = bat.res;
            if (r.hit) { b.state = 'batted'; b.bt = 0; b.sx = b.x; b.sy = b.y; b.ssc = b.sc; b.res = r; nbHitSound(r); NB.info = 'Δ ' + r.delta.toFixed(3) + 's  SPEED ' + bat.speed + '  DIR ' + r.dirNorm.toFixed(2) + '  POWER ' + r.power.toFixed(2) + '  ' + r.kind.toUpperCase(); NB.hitStop = r.nice ? 0.07 : 0; }
            else { NB.info = 'Δ ' + r.delta.toFixed(3) + 's  SPEED ' + bat.speed + '  MISS'; }
          }
          if (bat.t >= bat.D) { bat.state = 'idle'; bat.th = NBC.swing.readyAngle; }
        }
        if (b.pt >= b.T + 0.42 && b.state === 'pitch') { b.state = 'passed'; beep(260, 0, 0.1, 0.05, 'sine'); nbEndBall('MISS', '#b8b8c8', false); }                // 空振りか見送り：奥へぬける
      } else if (b.state === 'batted') {
        if (NB.hitStop > 0) { NB.hitStop -= dt; } else { b.bt += dt; }
        const F = NBC.flight; const f = clamp(b.bt / (F.time * (b.res.nice ? 0.85 : 1)), 0, 1); const r = b.res; const e = f; b.x = b.sx + (r.tx - b.sx) * e; const arc = Math.sin(Math.PI * e) * F.arc * (0.4 + 0.6 * r.power);
        b.y = b.sy + (r.ty - b.sy) * e - arc; b.sc = b.ssc + (0.34 - b.ssc) * e; b.spin += dt * 20;
        if (f >= 1) nbLand(b);
      }
    } else if (ph === 'after') {
      const b = NB.ball; if (b && b.state === 'batted') { b.bt += dt; }
      NB.after -= dt; if (NB.bat.state === 'swing') { NB.bat.t += dt; NB.bat.th = nbBatAngle(NB.bat.t / NB.bat.D); if (NB.bat.t >= NB.bat.D) { NB.bat.state = 'idle'; NB.bat.th = NBC.swing.readyAngle; } }
      if (NB.after <= 0) { if (NB.ballNo >= NBC.ballCount) nbFinish(); else nbStartWind(); }
    }
  }
  function nbHitSound(r) {
    if (r.kind === 'weak' || r.kind === 'foul') { beep(520, 0, 0.05, 0.06, 'square'); noise(0.02, 0.02); }                                           // コッ
    else if (r.kind === 'normal') { beep(1500, 0, 0.07, 0.08, 'triangle'); beep(900, 0, 0.05, 0.05, 'square'); noise(0.03, 0.04); }                       // カン！
    else { beep(2800, 0, 0.4, 0.08, 'sine'); beep(1900, 0.01, 0.3, 0.05, 'triangle'); beep(3300, 0.02, 0.25, 0.04, 'sine'); noise(0.06, 0.07); }      // カキーン！！
  }
  function nbLand(b) {                                                                                                  // 打球が、奥のネット・的に とどく
    const r = b.res; b.state = 'done'; let hit = null;
    if (!r.foul) for (const t of nbTargets()) { if (Math.hypot(r.tx - t.x, r.ty - t.y) <= t.r + 1) { if (!hit || t.score > hit.score) hit = t; } }
    if (hit) { NB.score += hit.score; NB.flash[hit.score + '|' + Math.round(hit.x) + '|' + hit.y] = 0.45; if (hit.score >= 100) { [1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.07, 0.12, 0.06, 'triangle')); NB.hitFlash = 0.3; } else { beep(1175 + hit.score * 4, 0, 0.1, 0.07, 'triangle'); beep(1568 + hit.score * 4, 0.06, 0.1, 0.06, 'triangle'); } nbEndBall(hit.score >= 100 ? '100!!' : '+' + hit.score, hit.score >= 100 ? '#ffe070' : '#7dff8a', hit.score >= 100); NB.netHit = { x: r.tx, y: r.ty, t: 0 }; }
    else if (r.foul) { nbEndBall('FOUL', '#c8c8d8', false); beep(300, 0, 0.1, 0.05, 'sine'); }
    else { noise(0.1, 0.05); beep(180, 0, 0.1, 0.05, 'sine'); NB.netHit = { x: r.tx, y: r.ty, t: 0 }; nbEndBall('', '', false); }
  }
  function nbFinish() { const rec = P_().niceBatting; NB.result = { score: NB.score }; if (NB.score > rec.bestScore) { rec.bestScore = NB.score; NB.newRecord = true; } NB.best = rec.bestScore; writeSave(); NB.phase = 'result'; NB.t = 0; [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle')); if (NB.newRecord) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.5 + i * 0.08, 0.14, 0.05)); }
  // ---- バットの軌道（あらかじめ決めた、自然な振り）----
  function nbBatAngle(u) { u = clamp(u, 0, 1); const S = NBC.swing; const e = u * u * (3 - 2 * u); return S.readyAngle + (S.endAngle - S.readyAngle) * e; }                          // 構える → 振り始め → ゾーン通過 → 振りぬく → もどる（最後の20%で、構えへ）
  // ---- 描画 ----
  function nbBall(x, y, sc, spin) {
    const r = Math.max(2, Math.round(9 * sc)); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(Math.round(x) + 1, Math.round(y) + r, r * 0.9, Math.max(1, r * 0.28), 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#c8c8d0'; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(x) - r * 0.12, Math.round(y) - r * 0.12, r - 1, 0, 6.2832); ctx.fill();
    if (r >= 5) { ctx.strokeStyle = '#d02030'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(x) - r * 1.2 + Math.sin(spin) * 1.5, Math.round(y), r * 0.9, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.round(x) + r * 1.2 + Math.sin(spin) * 1.5, Math.round(y), r * 0.9, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke(); }
  }
  function nbMachine(fire) {                                                                                            // ピッチングマシン（奥・小さめ）
    const m = nbMachinePos(); const x = m.x; const y = m.y; const t = animT();
    rect(x - 15, y - 2, 30, 6, '#1a2a20'); rect(x - 12, y - 20, 24, 20, '#3a5a48'); rect(x - 12, y - 20, 24, 2, '#6a8a78'); rect(x - 12, y - 4, 24, 4, '#d02030'); rect(x - 9, y - 17, 18, 8, '#1a2a20');
    const spinning = NB.phase === 'wind' || NB.phase === 'pitch'; const a = spinning ? t * 14 : 0;
    for (const sx of [-5, 5]) { ctx.fillStyle = '#10201a'; ctx.beginPath(); ctx.arc(x + sx, y - 12, 4.5, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#8aa898'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + sx + Math.cos(a) * 4, y - 12 + Math.sin(a) * 4); ctx.lineTo(x + sx - Math.cos(a) * 4, y - 12 - Math.sin(a) * 4); ctx.stroke(); }
    rect(x - 4, y - 24, 8, 5, '#f4f4f4'); rect(x - 4, y - 24, 8, 1, '#c8c8c8'); drawTextCenter('PITCH', x + 0.5, y - 19, '#ffffff', 1) && 0;
    if (NB.phase === 'wind') { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 8); rect(x - 14, y - 22, 28, 22, '#ffe9a0'); ctx.globalAlpha = 1; }                                // 作動中は、やわらかく光る
  }
  function nbScene() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#0e1c14'); const cx = nbCx();
    for (let y = 8; y < 176; y++) rect(8, y, W - 16, 1, mixHex('#16301f', '#0c1a12', (y - 8) / 168));                                                    // 奥の防球ネット
    ctx.globalAlpha = 0.35; for (let x = 12; x < W - 8; x += 8) rect(x, 30, 1, 146, '#3a7a50'); for (let y = 34; y < 176; y += 8) rect(8, y, W - 16, 1, '#3a7a50'); ctx.globalAlpha = 1;
    rect(8, 8, W - 16, 22, '#2a3a32'); rect(8, 8, W - 16, 2, '#5a7a68'); rect(8, 28, W - 16, 2, '#0a1410'); for (const px of [14, W - 18]) { rect(px, 8, 4, 168, '#4a5a52'); rect(px, 8, 1, 168, '#8aa898'); }
    for (let y = 176; y < H - 8; y++) rect(8, y, W - 16, 1, mixHex('#2a5a34', '#17381f', (y - 176) / (H - 184)));                                       // 人工芝
    for (let y = 178; y < H - 10; y += 10) { ctx.globalAlpha = 0.18; rect(8, y, W - 16, 5, '#0a2a12'); ctx.globalAlpha = 1; }
    const m = nbMachinePos(); const z = nbZone(); ctx.globalAlpha = 0.55; ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(m.x - 8, m.y + 4); ctx.lineTo(z.x - 24, z.y + 12); ctx.moveTo(m.x + 8, m.y + 4); ctx.lineTo(z.x + 26, z.y + 12); ctx.stroke(); ctx.globalAlpha = 1;
    rect(z.x - 14, z.y + 12, 28, 7, '#f4f4f4'); rect(z.x - 14, z.y + 12, 28, 1, '#ffffff'); rect(z.x - 14, z.y + 18, 28, 1, '#a8a8b0');                                          // ホームベース
    for (const t of nbTargets()) {
      const key = t.score + '|' + Math.round(t.x) + '|' + t.y; const fl = NB.flash[key] || 0; const k = 1 + fl * 0.5; const col = t.score === 100 ? '#d02030' : t.score === 50 ? '#f4f4f4' : t.score === 30 ? '#ffd84a' : '#9ad8a8';
      ctx.fillStyle = '#0a1410'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k + 2, 0, 6.2832); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, 6.2832); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.3, t.r * 0.5 * k, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = t.score === 100 ? '#ffe070' : '#d02030'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k - 2, 0, 6.2832); ctx.stroke();
      drawTextCenter(String(t.score), t.x + 0.5, t.y - 3, t.score === 100 ? '#ffffff' : '#2a1a10', t.score === 100 ? 1 : 1) && 0; if (fl > 0) { ctx.globalAlpha = fl * 1.5; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k + 4, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    if (NB.hitFlash > 0) { ctx.globalAlpha = NB.hitFlash * 1.2; rect(8, 30, W - 16, 150, '#fff3c0'); ctx.globalAlpha = 1; NB.hitFlash -= 0.016; }
    nbMachine(); nbBatter();
    const b = NB.ball; if (b && b.state !== 'done' && b.state !== 'passed') nbBall(b.x, b.y, b.sc, b.spin); else if (b && b.state === 'passed') { const f = clamp((b.pt - b.T) / 0.42, 0, 1); ctx.globalAlpha = 1 - f; nbBall(b.x, b.y + f * 20, b.sc + f * 0.2, b.spin); ctx.globalAlpha = 1; }
    if (b && b.state === 'done' && NB.netHit && NB.netHit.t < 0.5) { NB.netHit.t += 0.016; const q = NB.netHit.t / 0.5; ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(NB.netHit.x, NB.netHit.y, 4 + q * 12, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const q of NB.pops) { const a = 1 - q.t / 1.1; ctx.globalAlpha = Math.min(1, a * 1.6); drawTextCenter(q.txt, q.x, q.y - q.t * 14, q.color, q.big ? 4 : q.txt === 'MISS' || q.txt === 'FOUL' ? 1 : 2, q.big ? '#7a2a04' : '#0a1410'); ctx.globalAlpha = 1; }
    if (NB.dev.targets) { ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; for (const t of nbTargets()) { ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 1, 0, 6.2832); ctx.stroke(); } }
  }
  function nbBatter() {                                                                                                 // 手前の右：バッター（うしろすがた）とバット
    const pv = nbPivot(); const bat = NB.bat; const th = bat.th; const L = NBC.swing.batLen; const flat = NBC.swing.flatten; const px = pv.x; const py = pv.y;
    rect(px + 4, py + 30, 10, 36, '#1a2a52'); rect(px + 16, py + 30, 10, 36, '#1a2a52'); rect(px + 2, py + 62, 14, 5, '#10101c'); rect(px + 14, py + 62, 14, 5, '#10101c');                     // 足
    rect(px - 2, py - 6, 34, 40, '#f4f4f8'); rect(px - 2, py - 6, 34, 3, '#ffffff'); rect(px - 2, py + 31, 34, 3, '#d8d8e0'); rect(px + 8, py + 4, 14, 10, '#d02030'); drawTextCenter('7', px + 15.5, py + 6, '#ffffff', 1);               // 背番号
    rect(px + 6, py - 20, 22, 16, '#d02030'); rect(px + 6, py - 20, 22, 3, '#ff6a6a'); rect(px + 4, py - 8, 26, 4, '#a01828'); rect(px + 9, py - 6, 16, 7, '#e8b890');                                 // ヘルメット・首
    const tx = px + Math.cos(th) * L; const ty = py + Math.sin(th) * L * flat;                                          // バット：手を中心に、ゾーンへ弧をえがいて通る（たての長さは、ひらべったく）
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(px + 6, py + 2); ctx.lineTo(px + Math.cos(th) * 6, py + Math.sin(th) * 6 * flat); ctx.stroke();
    ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(px + Math.cos(th) * 8, py + Math.sin(th) * 8 * flat); ctx.lineTo(tx, ty); ctx.stroke(); ctx.strokeStyle = '#d8a860'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(px + Math.cos(th) * 8, py + Math.sin(th) * 8 * flat); ctx.lineTo(tx, ty); ctx.stroke(); ctx.strokeStyle = '#f0c888'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + Math.cos(th) * 10, py + Math.sin(th) * 10 * flat - 1); ctx.lineTo(tx, ty - 1); ctx.stroke(); ctx.restore();
    rect(px + 0, py + 0, 10, 8, '#f4f4f8'); rect(px + 2, py + 2, 5, 5, '#e8b890');                                                                                                      // 手
  }
  function nbHud() {
    const ss = String(NB.score); drawText('BALL', 18, 11, '#ffffff', 1, '#0a1410'); const bn = Math.max(1, Math.min(NBC.ballCount, NB.ballNo)); drawText(bn + '/' + NBC.ballCount, 18, 18, '#ffffff', 2, '#0a1410');
    drawText('SCORE', W - 18 - 5 * 4, 11, '#ffffff', 1, '#0a1410'); drawText(ss, W - 18 - ss.length * 8 - 2, 18, '#ffe070', 2, '#0a1410');
    if (NB.phase === 'ready') drawTextCenter('READY...', W / 2, 190, '#ffffff', 3, '#0a1410');
    if (NB.lastShow > 0 && NB.phase !== 'result') { ctx.globalAlpha = Math.min(1, NB.lastShow); drawTextCenter('LAST BALL', W / 2, 206, '#ffe070', 2, '#7a2a04'); ctx.globalAlpha = 1; }
    if (NB.dev.info && NB.info) drawText(NB.info, 14, 34, '#00ff88', 1);
    if (NB.dev.window) { const z = nbZone(); const bt = NB.ball; if (bt && bt.state === 'pitch') drawText('PT ' + bt.pt.toFixed(2) + ' / T ' + bt.T.toFixed(2) + '  WIN ±' + NBC.hit.window, 14, 44, '#00ff88', 1); ctx.strokeStyle = '#00ff88'; ctx.beginPath(); ctx.arc(z.x, z.y, 12, 0, 6.2832); ctx.stroke(); }
  }
  function nbDrawResult() {
    nbScene(); ctx.globalAlpha = 0.86; rect(14, 40, W - 28, 276, '#0a1410'); ctx.globalAlpha = 1; rect(14, 40, W - 28, 2, '#d02030'); drawTextCenter('NICE BATTING', W / 2, 52, '#ffffff', 2, '#7a1020');
    drawTextCenter('TOTAL SCORE', W / 2, 92, '#ffffff', 1); drawTextCenter(String(NB.result.score), W / 2, 106, '#ffe070', 5, '#7a2a04'); drawTextCenter('BEST', W / 2, 152, '#ffffff', 1); drawTextCenter(String(NB.best), W / 2, 164, '#ffffff', 3, '#0a1410');
    if (NB.newRecord) { ctx.globalAlpha = 0.7 + 0.3 * Math.sin(NB.clock * 3); drawTextCenter('NEW RECORD!', W / 2, 202, '#7dff8a', 2, '#0a3a1a'); ctx.globalAlpha = 1; } drawTextCenter('YEN ' + P_().money, W / 2, 228, '#7ad8ff', 1);
  }
  function nbDrawSelect() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#1f4a30'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#2a5a38', '#143a24', (y - 8) / (H - 16)));
    for (let x = 8; x < W - 8; x += 8) { ctx.globalAlpha = 0.18; rect(x, 8, 1, H - 16, '#8ad0a0'); ctx.globalAlpha = 1; } rect(8, 8, W - 16, 3, '#d8f0e0');
    rect(16, 18, W - 32, 62, '#0e2418'); rect(18, 20, W - 36, 58, '#173a26'); drawTextCenter('NICE', W / 2, 24, '#ffffff', 3, '#d02030'); drawTextCenter('BATTING', W / 2, 50, '#ffffff', 3, '#d02030');
    const t = NB.sel || 0; nbBall(36, 100 + Math.round(Math.abs(Math.sin(t * 2.4)) * -6), 1.1, t * 6); nbBall(W - 36, 100 + Math.round(Math.abs(Math.sin(t * 2.4 + 1.6)) * -6), 1.1, -t * 6);
    const sv = NB.bat.th; NB.bat.th = -2.4 + Math.sin(t * 2.2) * 0.5; const pivSave = nbPivot; ctx.save(); ctx.translate(-34, -150); ctx.scale(1, 1); nbBatter(); ctx.restore(); NB.bat.th = sv;
    rect(16, 196, W - 32, 74, '#f4f4f0'); rect(16, 196, W - 32, 2, '#ffffff'); rect(16, 268, W - 32, 2, '#c8c8c0'); drawTextCenter('10 BALLS', W / 2, 204, '#143a24', 2, '#d8f0e0'); drawTextCenter('SWIPE TO SWING!', W / 2, 224, '#d02030', 1);
    drawTextCenter('BEST ' + P_().niceBatting.bestScore, W / 2, 238, '#0e2418', 2); drawTextCenter('YEN ' + P_().money + '    PLAY  YEN ' + NBC.price, W / 2, 258, '#143a24', 1);
    for (let i = 0; i < 10; i++) nbBall(22 + i * ((W - 44) / 9), 302, 0.7, i);
  }
  const NB_DOM = {};
  function nbBuildDom() {
    if (NB_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); NB_DOM[id.slice(3)] = b; return b; };
    mk('nb-start', 'PLAY　¥' + NBC.price, 'td-go').addEventListener('click', () => { ensureAudio(); nbBegin(); });
    mk('nb-retry', 'もういちど　¥' + NBC.price, 'td-go').addEventListener('click', () => { ensureAudio(); nbBegin(); });
    mk('nb-out', '6Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); NB.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('nb-skip', 'SKIP', 'hb-quit st-small').addEventListener('click', () => { ensureAudio(); if (NB.phase === 'ready') NB.t = 99; });
    const hint = document.createElement('div'); hint.className = 'prize-info st-say br-hint'; hint.innerHTML = 'ボールをよく見て<br>横にスワイプ！<br>タイミングよく バットを振ろう！'; screenEl.appendChild(hint); NB_DOM.hint = hint;
  }
  function nbUi() {
    nbBuildDom(); const ph = NB.phase; const show = (k, on) => NB_DOM[k].classList.toggle('is-show', !!on); const hintOn = ph === 'ready' && !P_().niceBatting.seenHint;
    show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); show('skip', hintOn); show('hint', hintOn);
    crPlace(NB_DOM.start, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(NB_DOM.retry, { x: 20, y: 262, w: W - 40, h: 32 }); crPlace(NB_DOM.out, { x: 20, y: 302, w: W - 40, h: 26 }); crPlace(NB_DOM.skip, { x: W - 52, y: 40, w: 40, h: 18 }); crPlace(NB_DOM.hint, { x: 14, y: 214, w: W - 28, h: 56 });
  }
  function nbHide() { if (!NB_DOM.start) return; Object.keys(NB_DOM).forEach((k) => NB_DOM[k].classList.remove('is-show')); }
  function nbDraw() { const ph = NB.phase; if (ph === 'select') nbDrawSelect(); else if (ph === 'result') nbDrawResult(); else { nbScene(); nbHud(); } nbUi(); }
  function openNbDev() {
    const again = (f) => () => { f(); setTimeout(openNbDev, 0); }; const H = NBC.hit;
    showDialog({ title: 'NICE BATTING DEV', wide: true, lines: [{ text: 'BALL ' + NB.ballNo + '/' + NBC.ballCount + ' / SCORE ' + NB.score + ' / WINDOW ±' + H.window + ' / 球速固定 ' + (NB.dev.fixSpeed ? 'ON' : 'OFF') + ' / 位置固定 ' + (NB.dev.fixPos ? 'ON' : 'OFF') + ' / 強制 ' + (NB.dev.force || 'なし'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '次の開始球 → ' + (((NB.dev.jump || 0) % NBC.ballCount) + 1) + '球目（くり上げ）', onClick: again(() => { NB.dev.jump = ((NB.dev.jump || 0) % NBC.ballCount) + 1; }) },
      { label: '球速固定 ON/OFF', onClick: again(() => { NB.dev.fixSpeed = !NB.dev.fixSpeed; }) }, { label: '投球位置固定 ON/OFF', onClick: again(() => { NB.dev.fixPos = !NB.dev.fixPos; }) },
      { label: 'HIT WINDOW 表示 ON/OFF', onClick: again(() => { NB.dev.window = !NB.dev.window; }) }, { label: 'timingDelta・swingSpeed・打球方向 表示 ON/OFF', onClick: again(() => { NB.dev.info = !NB.dev.info; }) }, { label: 'target 判定 表示 ON/OFF', onClick: again(() => { NB.dev.targets = !NB.dev.targets; }) },
      { label: '強制 NICE HIT（次の1球）', onClick: again(() => { NB.dev.force = 'nice'; }) }, { label: '強制 MISS', onClick: again(() => { NB.dev.force = 'miss'; }) }, { label: '強制 なし', onClick: again(() => { NB.dev.force = null; }) },
      { label: '100点ターゲット 2倍 ON/OFF', onClick: again(() => { NB.dev.big100 = !NB.dev.big100; }) }, { label: 'HIT WINDOW +0.02', onClick: again(() => { H.window = +(H.window + 0.02).toFixed(2); }) }, { label: 'HIT WINDOW -0.02', onClick: again(() => { H.window = Math.max(0.04, +(H.window - 0.02).toFixed(2)); }) },
      { label: 'BEST SCORE リセット', onClick: again(() => { P_().niceBatting.bestScore = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('niceBatting', {
    reset() { NB.phase = 'select'; NB.sw = null; }, phase: () => NB.phase,
    enter() { nbBuildDom(); NB.phase = 'select'; NB.sel = 0; NB.ball = null; NB.sw = null; NB.pops = []; NB.bat = { state: 'idle', t: 0, D: 0.3, used: false, th: NBC.swing.readyAngle }; setMessage('', C.cyan); },
    update: nbUpdate, draw: nbDraw, hint: 'ボールをよく見て、 横にスワイプで 振ろう！',
    pointer: nbPointer, pointerUp: nbPointerUp
  });
  GAME_TYPES.niceBatting.pointerMove = nbPointerMove;
  GAME_TYPES.niceBatting.canLeave = () => NB.phase === 'select' || NB.phase === 'result';
  GAME_TYPES.niceBatting.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

