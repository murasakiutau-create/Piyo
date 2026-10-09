'use strict';
  // =====================================================================
  //  🎯 BULL DARTS（ブルダーツ）：7F VIDEO CORNER　電子ダーツ（一人用・COUNT-UP と 301）
  //   ¥100（MONEYのみ・MEDAL不使用）。ボードを見て、指でシュッとフリック。照準は出さない。着弾は「指の入力」から 一貫して決まる（毎回ランダムに外さない）
  //   指を はなした点から、フリックの向きに すこし ふみこんだ先に とぶ（むき・はやさ・ブレは すこしだけ 補正）。調整値は CONFIG.bullDarts
  // =====================================================================
  const BDC = CONFIG.bullDarts;
  const BD_MACHINE = { machineId: 'bd_bulldarts', machineName: 'BULL DARTS', label: 'BULL DARTS', isUnlocked: true, gameType: 'bullDarts', bd: true };
  const BD = { phase: 'menu', sub: 'wait', t: 0, clock: 0, mode: 'countup', round: 1, dart: 1, score: 0, remain: 301, roundStart: 301, thrown: 0, roundHits: [], stuck: [], hist: [], ptr: null, path: [], fly: null, pop: null, pause: false, paying: false, newRecord: false, result: null, glow: 0, sel: 0, last: null, trace: null, dev: { show: false, jitter: true, corr: 1, force: null } };
  const bdRec = () => { const p = P_(); if (!p.bullDarts) p.bullDarts = { v: 1, bestCountUp: 0, best301: 0, clears301: 0, plays: 0 }; const r = p.bullDarts; r.bestCountUp = r.bestCountUp | 0; r.best301 = r.best301 | 0; r.clears301 = r.clears301 | 0; r.plays = r.plays | 0; return r; };
  const bdGeo = () => ({ cx: W / 2, cy: 124, R: BDC.ring.dblOut, numR: BDC.numR, tx: W / 2, ty: 330 });
  function bdScoreAt(x, y) {                                                                                            // 着弾座標から 判定（リング・角度の設定は CONFIG.bullDarts.ring / numbers）
    const G = bdGeo(); const dx = x - G.cx; const dy = y - G.cy; const r = Math.hypot(dx, dy); const Rg = BDC.ring;
    if (r <= Rg.bullIn) return { kind: 'IBULL', num: 25, mult: 2, score: 50, label: 'BULL', r };
    if (r <= Rg.bullOut) return { kind: 'OBULL', num: 25, mult: 1, score: 25, label: 'OUTER BULL', r };
    if (r > Rg.dblOut) return { kind: 'MISS', num: 0, mult: 0, score: 0, label: 'MISS', r };
    let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360; const idx = Math.floor(((ang + 9) % 360) / 18); const num = BDC.numbers[idx];
    if (r > Rg.tripIn && r <= Rg.tripOut) return { kind: 'TRIPLE', num, mult: 3, score: num * 3, label: 'TRIPLE ' + num, r, idx };
    if (r > Rg.dblIn) return { kind: 'DOUBLE', num, mult: 2, score: num * 2, label: 'DOUBLE ' + num, r, idx };
    return { kind: 'SINGLE', num, mult: 1, score: num, label: String(num), r, idx };
  }
  function bdSegCenter(num, kind) { const G = bdGeo(); const Rg = BDC.ring; if (kind === 'IBULL') return { x: G.cx, y: G.cy }; const idx = BDC.numbers.indexOf(num); const a = idx * 18 * Math.PI / 180; const r = kind === 'TRIPLE' ? (Rg.tripIn + Rg.tripOut) / 2 : kind === 'DOUBLE' ? (Rg.dblIn + Rg.dblOut) / 2 : (Rg.bullOut + Rg.tripIn) / 2; return { x: G.cx + Math.sin(a) * r, y: G.cy - Math.cos(a) * r }; }
  function bdAnalyze(path) {                                                                                           // 指の入力 → 着弾点（raw＝補正まえ／final＝補正あと）
    const F = BDC.flick; if (path.length < 2) return null; const S = path[0]; const E = path[path.length - 1]; const dist = Math.hypot(E.x - S.x, E.y - S.y); if (dist < F.minDist || E.y >= S.y - 6) return { cancel: true, dist };
    const tEnd = E.t; let k = path.length - 1; while (k > 0 && tEnd - path[k - 1].t <= F.window) k--; if (k >= path.length - 1) k = Math.max(0, path.length - 3); const A = path[k]; const dt = Math.max(0.016, (E.t - A.t) / 1000); const vx = (E.x - A.x) / dt; const vy = (E.y - A.y) / dt; const v = Math.hypot(vx, vy);
    let dl = Math.hypot(E.x - A.x, E.y - A.y) || 1; const dirL = { x: (E.x - A.x) / dl, y: (E.y - A.y) / dl }; const dirSE = { x: (E.x - S.x) / dist, y: (E.y - S.y) / dist };
    const rawAhead = F.ahead; const raw = { x: E.x + dirL.x * rawAhead, y: E.y + dirL.y * rawAhead };
    // 補正：向きを ぜんたい（S→E）と すこし ブレンド／横ブレの小さいぶんは 吸収／はやさの ちがいは ひかえめ
    const c = BDC.assist * BD.dev.corr; let dx = dirL.x * (1 - c * F.dirBlend) + dirSE.x * c * F.dirBlend; let dy = dirL.y * (1 - c * F.dirBlend) + dirSE.y * c * F.dirBlend; const dn = Math.hypot(dx, dy) || 1; dx /= dn; dy /= dn;
    let wob = 0; for (const p of path) { const d = ((p.x - S.x) * dirSE.y - (p.y - S.y) * dirSE.x); wob = Math.max(wob, Math.abs(d)); } const lateral = Math.max(0, wob - F.wobbleDead * c) * F.wobbleSens * (Math.sign(((E.x - S.x) * 0 + (dirL.x - dirSE.x))) || 0);
    const vr = (F.vIdeal - Math.max(F.vSoft, Math.min(F.vHard, v))) / F.vIdeal; let drop = vr * F.speedGain; if (v < F.vSoft) drop += (F.vSoft - v) / F.vSoft * F.weakDrop; if (v > F.vHard) drop -= (v - F.vHard) / F.vHard * F.strongLift;
    const ahead = F.ahead * (1 + (v - F.vIdeal) / F.vIdeal * F.aheadSpeed * c);
    let fx = E.x + dx * ahead + lateral; let fy = E.y + dy * ahead + drop; if (BD.dev.jitter) { fx += (Math.random() - 0.5) * 2 * BDC.jitter; fy += (Math.random() - 0.5) * 2 * BDC.jitter; }
    return { cancel: false, S, E, v, dist, wob, raw, final: { x: fx, y: fy } };
  }
  function bdInsert() {                                                                                                  // GAME START で ¥100（連打しても1回）
    if (BD.paying || BD.phase !== 'ready') return; if (P_().money < BDC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    BD.paying = true; chargeYen(BDC.price); bdRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); bdStart(BD.mode); BD.paying = false;
  }
  function bdStart(mode) { BD.mode = mode; BD.round = 1; BD.dart = 1; BD.score = 0; BD.remain = 301; BD.roundStart = 301; BD.thrown = 0; BD.roundHits = []; BD.stuck = []; BD.hist = []; BD.ptr = null; BD.path = []; BD.fly = null; BD.pop = null; BD.pause = false; BD.newRecord = false; BD.result = null; BD.phase = 'play'; BD.sub = 'wait'; BD.t = 0; }
  function bdFinish(kind) {                                                                                            // 正式な結果に とどいたときだけ 記録
    const r = bdRec(); BD.newRecord = false;
    if (BD.mode === 'countup') { BD.newRecord = BD.score > r.bestCountUp; if (BD.newRecord) r.bestCountUp = BD.score; BD.result = { kind: 'countup', score: BD.score, best: r.bestCountUp }; }
    else if (kind === 'clear') { BD.newRecord = r.best301 === 0 || BD.thrown < r.best301; if (BD.newRecord) r.best301 = BD.thrown; r.clears301++; BD.result = { kind: '301', darts: BD.thrown, best: r.best301, clear: true }; }
    else BD.result = { kind: '301', darts: BD.thrown, best: r.best301, clear: false };
    writeSave(); BD.phase = 'result'; BD.t = 0; if (BD.newRecord) [988, 1319, 1568, 1976].forEach((f, i) => beep(f, 0.3 + i * 0.09, 0.12, 0.06, 'triangle'));
  }
  function bdLand(P) {                                                                                                 // 着弾：判定 → 得点処理
    const res = bdScoreAt(P.x, P.y); BD.thrown++; BD.roundHits.push(res); const G = bdGeo(); const dd = { x: P.x, y: P.y, res, n: 0, ang: -0.2 + Math.random() * 0.4 };
    for (const o of BD.stuck) if (Math.hypot(o.x - P.x, o.y - P.y) < 5) dd.n++; if (res.kind !== 'MISS' || Math.hypot(P.x - G.cx, P.y - G.cy) < BDC.stickR) BD.stuck.push(dd);
    let busted = false; if (BD.mode === 'countup') BD.score += res.score; else { if (BD.remain - res.score < 0) busted = true; else BD.remain -= res.score; }
    const big = res.kind === 'IBULL' || (res.kind === 'TRIPLE' && res.num >= 19); const sc = res.kind === 'MISS' ? 0 : res.score;
    BD.pop = { t: 0, label: res.kind === 'IBULL' ? 'BULL!' : res.label, score: busted ? 'BUST' : String(sc), kind: res.kind, big }; BD.last = res; BD.sub = 'land'; BD.t = 0;
    if (res.kind === 'MISS') beep(200, 0, 0.18, 0.06, 'sawtooth', 120); else { beep(160, 0, 0.05, 0.08, 'square', 90); noise(0.03, 0.05); if (res.kind === 'TRIPLE') [880, 1175, 1568].forEach((f, i) => beep(f, 0.05 + i * 0.05, 0.08, 0.06, 'triangle')); else if (res.kind === 'DOUBLE') [784, 1047].forEach((f, i) => beep(f, 0.05 + i * 0.05, 0.08, 0.06, 'triangle')); else if (res.kind === 'IBULL') { BD.glow = 0.9; [659, 880, 1319, 1760].forEach((f, i) => beep(f, 0.04 + i * 0.06, 0.12, 0.07, 'square')); } else if (res.kind === 'OBULL') [740, 988].forEach((f, i) => beep(f, 0.05 + i * 0.05, 0.08, 0.05, 'triangle')); else beep(660, 0.05, 0.06, 0.04, 'triangle'); }
    BD.pendBust = busted; BD.pendClear = BD.mode === '301' && !busted && BD.remain === 0;
  }
  function bdAfterLand() {                                                                                             // 得点表示のあと：つぎのダーツ／ラウンド終了／クリア
    if (BD.pendClear) { BD.sub = 'clear'; BD.t = 0; [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.06, 'triangle')); return; }
    if (BD.pendBust) { BD.remain = BD.roundStart; BD.sub = 'bust'; BD.t = 0; [300, 220, 160].forEach((f, i) => beep(f, i * 0.1, 0.14, 0.07, 'sawtooth')); return; }
    if (BD.dart >= 3) { BD.sub = 'round'; BD.t = 0; [523, 659, 784].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05, 'triangle')); return; } BD.dart++; BD.sub = 'wait'; BD.t = 0;
  }
  function bdNextRound() {
    if (BD.mode === 'countup' && BD.round >= BDC.countUpRounds) { BD.sub = 'over'; BD.t = 0; [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.1, 0.14, 0.06, 'triangle')); return; }
    if (BD.mode === '301' && BD.round >= BDC.safetyRounds) { BD.sub = 'over'; BD.t = 0; return; }
    BD.round++; BD.dart = 1; BD.roundHits = []; BD.stuck = []; BD.roundStart = BD.remain; BD.sub = 'wait'; BD.t = 0;
  }
  function bdUpdate(dt) {
    BD.clock += dt; BD.sel += dt; dt = Math.min(dt, 0.05); if (BD.pause) return; BD.t += dt; if (BD.glow > 0) BD.glow -= dt; if (BD.pop) BD.pop.t += dt;
    if (BD.phase !== 'play') return; const s = BD.sub;
    if (s === 'fly') { BD.fly.t += dt; if (BD.fly.t >= BDC.flyTime) { const P = BD.fly.P; BD.fly = null; bdLand(P); } return; }
    if (s === 'land') { if (BD.t >= BDC.landTime) bdAfterLand(); return; }
    if (s === 'round') { if (BD.t >= BDC.roundTime) bdNextRound(); return; }
    if (s === 'bust') { if (BD.t >= 1.3) bdNextRound(); return; }
    if (s === 'clear') { if (BD.t >= 1.8) bdFinish('clear'); return; }
    if (s === 'over') { if (BD.t >= 1.4) bdFinish('over'); return; }
  }
  // ---- 入力：タッチ → フリック → リリース（1本指。なげている間・ほかの指は むし）----
  const bdInZone = (p) => p.y >= BDC.zoneY;
  function bdPointer(e, p) { if (BD.pause) { BD.pause = false; return; } if (BD.phase !== 'play' || BD.sub !== 'wait' || BD.ptr !== null || !bdInZone(p)) return; BD.ptr = e.pointerId; BD.path = [{ x: p.x, y: p.y, t: performance.now() }]; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } }
  function bdPointerMove(e, p) { if (BD.ptr !== e.pointerId || BD.sub !== 'wait') return; BD.path.push({ x: p.x, y: p.y, t: performance.now() }); if (BD.path.length > 80) BD.path.splice(1, 1); }
  function bdPointerUp(e) {
    if (BD.ptr !== e.pointerId) return; BD.ptr = null; if (BD.phase !== 'play' || BD.sub !== 'wait') { BD.path = []; return; } const a = bdAnalyze(BD.path); BD.trace = a; const path = BD.path; BD.path = []; if (!a || a.cancel) return;
    let P = a.final; if (BD.dev.force) { P = BD.dev.force; BD.dev.force = null; } BD.sub = 'fly'; BD.fly = { t: 0, from: { x: bdGeo().tx, y: bdGeo().ty }, P: { x: P.x, y: P.y }, ang: Math.atan2(P.x - bdGeo().tx, 1) }; beep(900, 0, 0.1, 0.05, 'triangle', 1500); noise(0.05, 0.03);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && BD.phase === 'play') { BD.pause = true; BD.ptr = null; BD.path = []; } });
  // ---- 描画 ----
  function bdSector(cx, cy, r0, r1, idx, col) { const a0 = (idx * 18 - 9 - 90) * Math.PI / 180; const a1 = (idx * 18 + 9 - 90) * Math.PI / 180; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r1, a0, a1); ctx.arc(cx, cy, r0, a1, a0, true); ctx.closePath(); ctx.fill(); }
  function bdDrawBoard(hlNum) {
    const G = bdGeo(); const Rg = BDC.ring; const cx = G.cx; const cy = G.cy; ctx.fillStyle = '#05060c'; ctx.beginPath(); ctx.arc(cx, cy, Rg.dblOut + 22, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#10142a'; ctx.beginPath(); ctx.arc(cx, cy, Rg.dblOut + 22, 0, 6.2832); ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a3a8a'; ctx.stroke();
    for (let i = 0; i < 20; i++) { const dark = i % 2 === 0; bdSector(cx, cy, Rg.bullOut, Rg.tripIn, i, dark ? '#16161e' : '#e8dcb0'); bdSector(cx, cy, Rg.tripIn, Rg.tripOut, i, dark ? '#d82a3a' : '#20a850'); bdSector(cx, cy, Rg.tripOut, Rg.dblIn, i, dark ? '#16161e' : '#e8dcb0'); bdSector(cx, cy, Rg.dblIn, Rg.dblOut, i, dark ? '#d82a3a' : '#20a850'); }
    ctx.strokeStyle = 'rgba(210,220,240,0.75)'; ctx.lineWidth = 0.6; for (let i = 0; i < 20; i++) { const a = (i * 18 + 9 - 90) * Math.PI / 180; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * Rg.bullOut, cy + Math.sin(a) * Rg.bullOut); ctx.lineTo(cx + Math.cos(a) * Rg.dblOut, cy + Math.sin(a) * Rg.dblOut); ctx.stroke(); }
    for (const r of [Rg.tripIn, Rg.tripOut, Rg.dblIn, Rg.dblOut]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke(); }
    ctx.fillStyle = '#20a850'; ctx.beginPath(); ctx.arc(cx, cy, Rg.bullOut, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#d82a3a'; ctx.beginPath(); ctx.arc(cx, cy, Rg.bullIn, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(210,220,240,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, Rg.bullOut, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, Rg.bullIn, 0, 6.2832); ctx.stroke();
    if (BD.glow > 0) { ctx.globalAlpha = Math.min(0.6, BD.glow); ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(cx, cy, Rg.bullOut + 4, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
    for (let i = 0; i < 20; i++) { const a = i * 18 * Math.PI / 180; const n = String(BDC.numbers[i]); const x = cx + Math.sin(a) * G.numR; const y = cy - Math.cos(a) * G.numR; const hl = hlNum === BDC.numbers[i]; drawTextCenter(n, Math.round(x), Math.round(y - 5), hl ? '#ffe070' : '#f4f6ff', 2, hl ? '#a0481a' : '#05060c'); }
  }
  function bdDrawDart(x, y, s, ang, col) {                                                                              // ダーツ（ドット絵）：さきが (x,y)。うしろへ のびる
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); ctx.fillStyle = '#c8d0dc'; ctx.fillRect(-0.5, 0, 1, 3); ctx.fillStyle = '#8a94a8'; ctx.fillRect(-1.5, 3, 3, 7); ctx.fillStyle = '#a0a8b8'; ctx.fillRect(-0.5, 10, 1, 4); ctx.fillStyle = col || '#ff4a5a'; ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(-4.5, 20); ctx.lineTo(0, 18); ctx.lineTo(4.5, 20); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function bdDrawHud() {
    const cu = BD.mode === 'countup'; drawText(cu ? 'COUNT-UP' : '301', 8, 6, '#ffe070', 1); drawText('ROUND ' + BD.round + (cu ? '/' + BDC.countUpRounds : ''), 8, 15, '#7dfcff', 1); drawText('DART ' + BD.dart + '/3', 8, 24, '#ffffff', 1);
    const lab = cu ? 'SCORE' : 'REMAIN'; const val = String(cu ? BD.score : BD.remain); drawText(lab, W - 8 - textWidth(lab, 1), 6, '#7dfcff', 1); drawText(val, W - 8 - textWidth(val, cu ? 2 : 3), 14, '#ffffff', cu ? 2 : 3, '#4a2a9a');
  }
  function bdDrawPlay() {
    rect(0, 0, W, H, '#04050c'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#0a0f26', '#02030a', y / H)); drawFrame(); const G = bdGeo();
    const hl = BD.mode === '301' && BD.remain >= 1 && BD.remain <= 20 ? BD.remain : 0; bdDrawBoard(hl); bdDrawHud();
    for (const d of BD.stuck) { const ox = d.n * 3; const oy = d.n * 2; bdDrawDart(Math.round(d.x + ox), Math.round(d.y + oy), 0.72, d.ang + 0.5, ['#ff4a5a', '#4a8aff', '#ffd84a'][BD.stuck.indexOf(d) % 3]); }
    if (BD.fly) { const f = BD.fly; const k = Math.min(1, f.t / BDC.flyTime); const e = 1 - Math.pow(1 - k, 2); const x = f.from.x + (f.P.x - f.from.x) * e; const y = f.from.y + (f.P.y - f.from.y) * e - Math.sin(k * Math.PI) * 10; bdDrawDart(x, y, 1 - 0.28 * e, -Math.atan2(f.P.x - f.from.x, f.from.y - f.P.y) * 0.4, '#ff4a5a'); }
    // 手もとのダーツ・投げるエリア
    rect(10, BDC.zoneY - 4, W - 20, 2, '#1a2a6a'); if (BD.sub === 'wait' && !BD.pause) { const pth = BD.path; if (BD.ptr !== null && pth.length) { const q = pth[pth.length - 1]; bdDrawDart(q.x, q.y, 1, 0.0, '#ff4a5a'); } else { bdDrawDart(G.tx, G.ty - 18, 1.15, 0, '#ff4a5a'); drawTextCenter('FLICK UP!', W / 2, G.ty + 26, '#7dfcff', 1); } }
    const left = Math.max(0, 3 - BD.dart + (BD.sub === 'wait' ? 1 : 0)); for (let i = 0; i < 3; i++) { const used = i < (BD.sub === 'wait' ? BD.dart - 1 : BD.dart); rect(14 + i * 10, H - 26, 6, 10, used ? '#2a3050' : '#e8eef8'); }
    // 得点表示
    if (BD.pop && (BD.sub === 'land' || BD.sub === 'bust' || BD.sub === 'round' || BD.sub === 'clear')) { const p = BD.pop; const a = Math.min(1, p.t * 6); ctx.globalAlpha = a; const col = p.kind === 'IBULL' ? '#ffe070' : p.kind === 'TRIPLE' ? '#ff9a5a' : p.kind === 'DOUBLE' ? '#7dfcff' : p.kind === 'MISS' ? '#ff7a7a' : '#ffffff'; rect(20, 214, W - 40, 36, '#02030a'); rect(20, 214, W - 40, 1, col); drawTextCenter(p.label, W / 2, 218, col, p.label.length > 9 ? 1 : 2, '#101020'); drawTextCenter(p.score, W / 2, 234, '#ffffff', 2, '#4a2a9a'); ctx.globalAlpha = 1; }
    if (BD.sub === 'round') { const sum = BD.roundHits.reduce((a, r) => a + r.score, 0); rect(20, 256, W - 40, 22, '#02030a'); drawTextCenter('ROUND ' + BD.round + '   +' + sum, W / 2, 262, '#ffe070', 1); }
    if (BD.sub === 'bust') { rect(0, 150, W, 44, '#02030a'); drawTextCenter('BUST!', W / 2, 160, '#ff7a7a', 3, '#3a0a0a'); drawTextCenter('BACK TO ' + BD.remain, W / 2, 182, '#ffffff', 1); }
    if (BD.sub === 'clear') { rect(0, 150, W, 44, '#02030a'); drawTextCenter('CLEAR!', W / 2, 160, '#ffe070', 3, '#a0481a'); drawTextCenter(BD.thrown + ' DARTS', W / 2, 182, '#ffffff', 1); }
    if (BD.sub === 'over') { rect(0, 150, W, 40, '#02030a'); drawTextCenter(BD.mode === 'countup' ? 'FINISH!' : 'TIME OVER', W / 2, 162, '#ffe070', 3, '#a0481a'); }
    if (BD.pause) { ctx.globalAlpha = 0.7; rect(0, 0, W, H, '#02030a'); ctx.globalAlpha = 1; drawTextCenter('PAUSE', W / 2, 150, '#ffffff', 3, '#20a8c8'); drawTextCenter('TAP TO RESUME', W / 2, 190, '#ffffff', 1); }
    if (DEV_MODE && BD.dev.show) bdDrawDev();
  }
  function bdDrawDev() {
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; if (BD.path.length > 1) { ctx.beginPath(); BD.path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
    const a = BD.trace; if (a && !a.cancel) { ctx.strokeStyle = '#00ff88'; ctx.beginPath(); ctx.moveTo(a.S.x, a.S.y); ctx.lineTo(a.E.x, a.E.y); ctx.stroke(); ctx.fillStyle = '#ffaa00'; ctx.fillRect(a.raw.x - 2, a.raw.y - 2, 4, 4); ctx.fillStyle = '#ff00ff'; ctx.fillRect(a.final.x - 2, a.final.y - 2, 4, 4); drawText('V ' + Math.round(a.v) + ' D ' + Math.round(a.dist) + ' W ' + a.wob.toFixed(1), 8, 36, '#00ff88', 1); drawText('RAW ' + Math.round(a.raw.x) + ',' + Math.round(a.raw.y), 8, 45, '#ffaa00', 1); drawText('FIN ' + Math.round(a.final.x) + ',' + Math.round(a.final.y), 8, 54, '#ff00ff', 1); }
    if (BD.last) drawText(BD.last.label + ' R' + Math.round(BD.last.r), 8, 63, '#ffffff', 1);
  }
  function bdDrawMenu() {
    rect(0, 0, W, H, '#04050c'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#0a0f26', '#02030a', y / H)); drawFrame(); const G = { cx: W / 2, cy: 100 }; const save = bdGeo; ctx.save(); ctx.translate(0, -24); bdDrawBoard(0); ctx.restore();
    rect(14, 190, W - 28, 30, '#02030a'); rect(14, 190, W - 28, 2, '#d82a3a'); drawTextCenter('BULL', W / 2 - 24, 197, '#ff5a6a', 2, '#4a0a14'); drawTextCenter('DARTS', W / 2 + 24, 197, '#7affc8', 2, '#0a4a2a'); drawTextCenter('YEN ' + P_().money, W / 2, 232, '#a8b8ff', 1);
    const r = bdRec(); drawTextCenter('COUNT-UP BEST ' + r.bestCountUp, W / 2, 246, '#ffe070', 1); drawTextCenter('301 BEST DARTS ' + (r.best301 || '---'), W / 2, 256, '#ffe070', 1);
    if (BD.phase === 'ready') { drawTextCenter(BD.mode === 'countup' ? 'COUNT-UP' : '301', W / 2, 268, '#ffffff', 2, '#4a2a9a'); drawTextCenter('1 PLAY  YEN ' + BDC.price, W / 2, 288, '#a8b8ff', 1); }
  }
  function bdDrawResult() {
    rect(0, 0, W, H, '#04050c'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#0a0f26', '#02030a', y / H)); drawFrame(); const r = BD.result; drawTextCenter('RESULT', W / 2, 40, '#ffffff', 3, '#4a2a9a'); const L = (lab, v, y, col, sc) => { drawTextCenter(lab, W / 2, y, '#7dfcff', 1); drawTextCenter(String(v), W / 2, y + 11, col || '#ffffff', sc || 2, '#4a2a9a'); };
    if (r.kind === 'countup') { drawTextCenter('COUNT-UP', W / 2, 72, '#ffe070', 1); L('FINAL SCORE', r.score, 96, '#ffffff', 3); L('BEST SCORE', r.best, 140, '#ffe070'); } else { drawTextCenter(r.clear ? 'CLEAR!' : 'NOT CLEARED', W / 2, 72, r.clear ? '#ffe070' : '#ff9a9a', 2, r.clear ? '#a0481a' : '#3a0a0a'); L('DARTS USED', r.darts, 96, '#ffffff', 3); L('BEST DARTS', r.best || '---', 140, '#ffe070'); }
    if (BD.newRecord) drawTextCenter('* NEW RECORD! *', W / 2, 176, '#7dff8a', 2, '#0a3a1a'); drawTextCenter('YEN ' + P_().money, W / 2, 204, '#a8b8ff', 1);
  }
  const BD_DOM = {};
  function bdBuildDom() {
    if (BD_DOM.cu) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); BD_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('bd-cu', 'COUNT-UP', 'td-go', () => { BD.mode = 'countup'; BD.phase = 'ready'; beep(880, 0, 0.05, 0.04, 'square'); }); mk('bd-301', '301', 'td-go', () => { BD.mode = '301'; BD.phase = 'ready'; beep(880, 0, 0.05, 0.04, 'square'); });
    mk('bd-help', 'あそびかた', 'hb-sub', () => { showDialog({ title: 'あそびかた', lines: ['下から ボードへ、シュッと フリックして なげよう。', { text: 'COUNT-UP：3本×8ラウンド！高得点をめざそう！', cls: 'big' }, { text: '301：301から点数を引いて、ぴったり0をめざそう！（のこりを こえると BUST）', cls: 'big' }], buttons: [{ label: 'とじる', primary: true }] }); });
    mk('bd-start', 'GAME START　¥' + BDC.price, 'td-go', bdInsert); mk('bd-back', 'もどる', 'hb-sub', () => { BD.phase = 'menu'; beep(520, 0, 0.05, 0.04, 'square'); });
    mk('bd-retry', 'もういちど　¥' + BDC.price, 'td-go', () => { BD.phase = 'ready'; bdInsert(); }); mk('bd-menu', 'モードをえらぶ', 'hb-sub', () => { BD.phase = 'menu'; beep(520, 0, 0.05, 0.04, 'square'); }); mk('bd-out', '7Fにもどる', 'hb-sub', () => { BD.phase = 'menu'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
  }
  function bdUi() {
    bdBuildDom(); const ph = BD.phase; const show = (k, on) => BD_DOM[k].classList.toggle('is-show', !!on); show('cu', ph === 'menu'); show('301', ph === 'menu'); show('help', ph === 'menu'); show('start', ph === 'ready'); show('back', ph === 'ready'); show('retry', ph === 'result'); show('menu', ph === 'result'); show('out', ph === 'result');
    crPlace(BD_DOM.cu, { x: 24, y: 272, w: W - 48, h: 30 }); crPlace(BD_DOM['301'], { x: 24, y: 308, w: W - 48, h: 30 }); crPlace(BD_DOM.help, { x: W / 2 - 44, y: 344, w: 88, h: 22 }); crPlace(BD_DOM.start, { x: 24, y: 300, w: W - 48, h: 36 }); crPlace(BD_DOM.back, { x: W / 2 - 36, y: 344, w: 72, h: 22 });
    crPlace(BD_DOM.retry, { x: 20, y: 236, w: W - 40, h: 34 }); crPlace(BD_DOM.menu, { x: 20, y: 276, w: W - 40, h: 26 }); crPlace(BD_DOM.out, { x: 20, y: 306, w: W - 40, h: 26 });
    for (const k of ['cu', '301', 'help', 'start', 'back', 'retry', 'menu', 'out']) BD_DOM[k].style.fontSize = Math.max(10, parseFloat(BD_DOM[k].style.fontSize) * 0.95) + 'px';
  }
  function bdHide() { if (!BD_DOM.cu) return; Object.keys(BD_DOM).forEach((k) => BD_DOM[k].classList.remove('is-show')); }
  function bdDraw() { const ph = BD.phase; if (ph === 'menu' || ph === 'ready') bdDrawMenu(); else if (ph === 'result') bdDrawResult(); else bdDrawPlay(); bdUi(); }
  function bdLeaveMid() {
    if (BD.phase !== 'play') return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { BD.phase = 'menu'; BD.pause = false; BD.ptr = null; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function openBdDev() {
    const again = (f) => () => { f(); setTimeout(openBdDev, 0); }; const D = BD.dev; const force = (num, kind) => () => { const c = bdSegCenter(num, kind); D.force = { x: c.x, y: c.y }; toast('つぎの1投：' + kind + ' ' + num); };
    showDialog({ title: 'BULL DARTS DEV', wide: true, lines: [{ text: 'MODE ' + BD.mode + ' / PHASE ' + BD.phase + '.' + BD.sub + ' / ROUND ' + BD.round + ' / DART ' + BD.dart + ' / SCORE ' + BD.score + ' / REMAIN ' + BD.remain + ' / ブレ ' + (D.jitter ? 'ON' : 'OFF') + ' / 補正 ×' + D.corr + ' / 軌跡表示 ' + (D.show ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '軌跡・入力ベクトル・補正前後の点 表示 ON/OFF', onClick: again(() => { D.show = !D.show; }) }, { label: 'ランダムブレ ON/OFF', onClick: again(() => { D.jitter = !D.jitter; }) }, { label: '補正強度：0 / 0.5 / 1 / 1.5', onClick: again(() => { D.corr = D.corr === 1 ? 1.5 : D.corr === 1.5 ? 0 : D.corr === 0 ? 0.5 : 1; }) },
      { label: 'COUNT-UP 即開始（料金なし）', onClick: () => { bdStart('countup'); } }, { label: '301 即開始（料金なし）', onClick: () => { bdStart('301'); } },
      { label: 'COUNT-UP ラウンド：1 / 4 / 8', onClick: again(() => { if (BD.mode === 'countup' && BD.phase === 'play') { BD.round = BD.round === 1 ? 4 : BD.round === 4 ? 8 : 1; BD.dart = 1; BD.stuck = []; BD.roundHits = []; BD.sub = 'wait'; } }) }, { label: '301 残り：301 / 60 / 40 / 20 / 18 / 7 / 2', onClick: again(() => { if (BD.mode === '301' && BD.phase === 'play') { const L = [301, 60, 40, 20, 18, 7, 2]; BD.remain = L[(L.indexOf(BD.remain) + 1) % L.length]; BD.roundStart = BD.remain; BD.dart = 1; BD.stuck = []; BD.roundHits = []; BD.sub = 'wait'; } }) },
      { label: '強制：INNER BULL', onClick: force(25, 'IBULL') }, { label: '強制：TRIPLE 20', onClick: force(20, 'TRIPLE') }, { label: '強制：DOUBLE 20', onClick: force(20, 'DOUBLE') }, { label: '強制：SINGLE 20', onClick: force(20, 'SINGLE') }, { label: '強制：TRIPLE 1', onClick: force(1, 'TRIPLE') }, { label: '強制：MISS（ボードの外）', onClick: () => { D.force = { x: 10, y: 60 }; toast('つぎの1投：MISS'); } },
      { label: 'BEST 記録 リセット', onClick: again(() => { const r = bdRec(); r.bestCountUp = 0; r.best301 = 0; r.clears301 = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('bullDarts', {
    reset() { BD.phase = 'menu'; BD.pause = false; BD.ptr = null; }, phase: () => (['menu', 'ready', 'result'].includes(BD.phase) ? 'idle' : 'play'),
    enter() { bdBuildDom(); BD.phase = 'menu'; BD.sel = 0; BD.paying = false; BD.pause = false; BD.ptr = null; BD.path = []; BD.stuck = []; setMessage('', C.cyan); },
    update: bdUpdate, draw: bdDraw, hint: '下から ボードへ、シュッとフリック！',
    pointer: bdPointer, pointerUp: bdPointerUp
  });
  GAME_TYPES.bullDarts.pointerMove = bdPointerMove;
  GAME_TYPES.bullDarts.canLeave = () => ['menu', 'ready', 'result'].includes(BD.phase);
  GAME_TYPES.bullDarts.beforeLeave = () => bdLeaveMid();
  GAME_TYPES.bullDarts.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });


