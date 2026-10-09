'use strict';
  // =====================================================================
  //  🥊 POWER PUNCH（パワーパンチ）：6F SPORTS CORNER
  //   1発だけ、下から上へ、一気にスワイプ。そのパンチ力を 0〜999 で測る。報酬なし・記録は BEST POWER だけ（gameId＝power_punch）
  //   POWER ＝ 999 ×（速さの点）^乗数 ×（最低ライン ＋ 残り × 命中の質）。命中の質 ＝ 中心の精度（スワイプの延長線がパッドの芯を通るか）＋ 方向（まっすぐ向かっているか）
  //   座標・速さは、ゲーム領域（高さ）に対する正規化で扱う。ランダムは、なし
  // =====================================================================
  const PPC = CONFIG.powerPunch;
  const PP_MACHINE = { machineId: 'pp_powerpunch', machineName: 'POWER PUNCH', label: 'POWER PUNCH', isUnlocked: true, gameType: 'powerPunch', pp: true };
  const PP = { phase: 'select', t: 0, clock: 0, cnt: 3, sw: null, power: 0, shown: 0, kind: '', miss: false, timeout: false, best: 0, newRecord: false, impact: 0, shake: 0, flash: 0, lines: [], debug: null, resultAt: 0, rate: '',
    dev: { force: null, debug: false, zones: false, skipCount: false } };
  const ppPad = () => ({ x: Math.round(W * PPC.pad.cx), y: Math.round(H * PPC.pad.cy), r: Math.round(W * PPC.pad.r) });
  const ppStart = () => ({ x: Math.round(W * PPC.startZone.x), y: Math.round(H * PPC.startZone.y), w: Math.round(W * PPC.startZone.w), h: Math.round(H * PPC.startZone.h) });
  // ---- 計算：速さ・精度・方向 → POWER ----
  function ppScore(x0, y0, x1, y1, vN) {                                                                                 // スワイプの始点(x0,y0)・いまの点(x1,y1)・終わりぎわの速さ vN（高さ／秒）から POWER を出す
    const S = PPC.swipe; const pad = ppPad(); const dx = x1 - x0; const dy = y1 - y0; const out = { speed: 0, accuracy: 0, direction: 0, power: 0, miss: false, angle: 0 };
    const sn = clamp((vN - S.minSpeed) / (S.maxSpeed - S.minSpeed), 0, 1); out.speed = Math.pow(sn, S.speedCurve);                                  // 速さの点（正規化・上限あり・カーブ）
    const t = (pad.y - y0) / (dy || -1e-6); const xAt = x0 + dx * t; const d = Math.abs(xAt - pad.x) / pad.r; out.d = d;                              // 延長線が、パッドの高さを通る位置と、芯とのきょり（パッド半径が単位）
    if (d > PPC.padHit) { out.miss = true; return out; }                                                                                         // パッドを外した
    out.accuracy = d <= PPC.accPlateau ? 1 : Math.pow(clamp(1 - (d - PPC.accPlateau) / (PPC.padHit - PPC.accPlateau), 0, 1), PPC.accCurve);
    const aim = Math.atan2(pad.x - x0, y0 - pad.y); const dir = Math.atan2(dx, -dy); const diff = Math.abs(aim - dir) * 180 / Math.PI; out.angle = diff;
    out.direction = diff <= PPC.dirPlateau ? 1 : clamp(1 - (diff - PPC.dirPlateau) / (PPC.dirRange - PPC.dirPlateau), 0, 1);
    const q = PPC.accWeight * out.accuracy + PPC.dirWeight * out.direction; const total = Math.pow(out.speed, PPC.speedExp) * (PPC.qFloor + (1 - PPC.qFloor) * q);
    out.power = clamp(Math.round(PPC.maxPower * total), 0, PPC.maxPower); out.q = q; return out;
  }
  // ---- 入力：START付近から、下から上へ ----
  function ppPointer(e, p) {
    if (PP.phase !== 'input') return; const z = ppStart(); const pad = PPC.startZone.tol; if (p.x < z.x - pad || p.x > z.x + z.w + pad || p.y < z.y - pad || p.y > z.y + z.h + pad) return;                       // START領域の外からは、無効
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    PP.sw = { id: e.pointerId, x0: p.x, y0: p.y, pts: [{ t: performance.now(), x: p.x, y: p.y }], fired: false };
  }
  function ppPointerMove(e, p) {
    const s = PP.sw; if (!s || s.id !== e.pointerId || s.fired || PP.phase !== 'input') return; const now = performance.now(); s.pts.push({ t: now, x: p.x, y: p.y }); while (s.pts.length > 2 && now - s.pts[0].t > 220) s.pts.shift();
    ppTry(s, p, false);
  }
  function ppPointerUp(e) { const s = PP.sw; if (!s || s.id !== e.pointerId) return; if (!s.fired && PP.phase === 'input') { const last = s.pts[s.pts.length - 1]; ppTry(s, { x: last.x, y: last.y }, true); } PP.sw = null; }
  function ppTry(s, p, atUp) {                                                                                           // 条件がそろったら、1回だけ採用（ちかすぎ・ゆっくり・横すぎ は、無効＝パンチ権は、つかわない）
    const S = PPC.swipe; const dy = s.y0 - p.y; const dx = p.x - s.x0; const dist = Math.hypot(dx, dy) / H; if (dist < S.minDistance || dy <= 0) return;
    if (Math.atan2(Math.abs(dx), dy) * 180 / Math.PI > S.maxAngle) { if (atUp) PP.debug = { note: '横すぎ' }; return; }                                                      // 横にこすっただけは、無効
    const now = performance.now(); const old = s.pts.find((q) => now - q.t <= S.window * 1000) || s.pts[0]; const el = Math.max(0.016, (now - old.t) / 1000); const vN = Math.hypot(p.x - old.x, p.y - old.y) / H / el;    // 終わりぎわの速さ＝きょり÷時間（H＝高さで正規化）
    if (vN < S.minSpeed) { if (atUp) PP.debug = { note: 'おそい', speed: vN }; return; }
    s.fired = true; ppPunch(s, p, vN);
  }
  function ppPunch(s, p, vN) {
    let r = ppScore(s.x0, s.y0, p.x, p.y, vN); r.vN = vN; const f = PP.dev.force; if (f === 'miss') { r = Object.assign(r, { miss: true, power: 0 }); } else if (typeof f === 'number') { r.power = f; r.miss = false; }
    PP.debug = r; PP.miss = !!r.miss; PP.power = r.miss ? 0 : r.power; PP.phase = 'impact'; PP.t = 0; PP.impact = 0; PP.flash = PP.miss ? 0 : 0.25 + PP.power / 1500; PP.shake = PP.miss ? 0 : 0.28; PP.lines = [];
    const k = PP.miss ? 0 : PP.power / PPC.maxPower; if (PP.miss) { beep(300, 0, 0.18, 0.06, 'sine', 160); noise(0.08, 0.03); }
    else { beep(80 + 40 * (1 - k), 0, 0.22, 0.1 + 0.05 * k, 'square'); noise(0.12, 0.06 + 0.06 * k); beep(180, 0.04, 0.12, 0.07, 'sawtooth'); try { if (navigator.vibrate) navigator.vibrate(20 + Math.round(60 * k)); } catch (er) { /* ok */ } }
    for (let i = 0; i < 14; i++) PP.lines.push({ a: (i / 14) * 6.2832 + Math.random() * 0.2, l: 0.6 + Math.random() * 0.8 });
  }
  // ---- 流れ ----
  function ppBegin() {
    if (P_().money < PPC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(PPC.price); P_().powerPunch.playCount++; writeSave(); PP.phase = 'ready'; PP.t = 0; PP.cnt = 3; PP.power = 0; PP.shown = 0; PP.miss = false; PP.timeout = false; PP.newRecord = false; PP.sw = null; PP.debug = null; PP.flash = 0; PP.shake = 0;
    beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); beep(660, 0.25, 0.1, 0.05, 'square');
    if (PP.dev.skipCount) { PP.phase = 'input'; PP.t = 0; }
  }
  const ppRateText = (p) => (p >= PPC.maxPower ? 'MAX POWER!!' : p >= 950 ? 'AMAZING!' : p >= 850 ? 'GREAT!' : p >= 700 ? 'STRONG!' : p >= 500 ? 'NICE!' : p >= 300 ? 'GOOD!' : 'SOFT...');
  function ppUpdate(dt) {
    PP.clock += dt; dt = Math.min(dt, 0.05); PP.t += dt; const ph = PP.phase; if (ph === 'select') { PP.sel = (PP.sel || 0) + dt; return; }
    if (PP.shake > 0) PP.shake -= dt; if (PP.flash > 0) PP.flash -= dt;
    if (ph === 'ready') { if (PP.t > (P_().powerPunch.seenHint ? 0.8 : 2.2)) { P_().powerPunch.seenHint = true; PP.phase = 'count'; PP.t = 0; PP.cnt = 3; beep(660, 0, 0.12, 0.06, 'square'); } }
    else if (ph === 'count') { const c = 3 - Math.floor(PP.t / 0.8); if (c !== PP.cnt && c >= 1) { PP.cnt = c; beep(660 + (3 - c) * 130, 0, 0.12, 0.06, 'square'); } if (PP.t >= 2.4) { PP.phase = 'input'; PP.t = 0; [1319, 1760, 2349].forEach((f, i) => beep(f, i * 0.05, 0.14, 0.07, 'square')); } }
    else if (ph === 'input') { if (PP.t >= PPC.inputTimeout) { PP.timeout = true; PP.power = 0; PP.phase = 'roll'; PP.t = 0; beep(240, 0, 0.3, 0.06, 'sine', 120); } }
    else if (ph === 'impact') { PP.impact += dt; if (PP.impact >= 0.55) { PP.phase = 'roll'; PP.t = 0; PP.rollTick = -1; } }
    else if (ph === 'roll') {
      const D = PPC.rollDuration; const f = clamp(PP.t / D, 0, 1); const e = 1 - Math.pow(1 - f, 3);
      if (PP.miss || PP.timeout) { PP.shown = 0; if (PP.t >= 0.6) ppSettle(); return; }
      PP.shown = Math.min(PPC.maxPower, Math.round(PP.power * e + (f < 1 ? (Math.sin(PP.t * 53) * 0.5 + 0.5) * 60 * (1 - f) : 0))); const tk = Math.floor(PP.t * 24); if (tk !== PP.rollTick && f < 1) { PP.rollTick = tk; beep(500 + f * 1200, 0, 0.03, 0.03, 'square'); }   // 数字が、高速で のぼっていく
      if (f >= 1) { PP.shown = PP.power; ppSettle(); }
    } else if (ph === 'settled') { /* 少しだけ見せてから、RESULT */ if (PP.t >= (PP.power >= PPC.maxPower ? 2.2 : PP.power >= 900 ? 1.6 : 1.1)) { PP.phase = 'result'; PP.t = 0; } }
  }
  function ppSettle() {
    PP.phase = 'settled'; PP.t = 0; PP.shown = PP.power; const rec = P_().powerPunch; if (PP.power > rec.bestPower) { rec.bestPower = PP.power; PP.newRecord = PP.power > 0; } PP.best = rec.bestPower; writeSave();
    PP.rate = PP.miss ? 'MISS' : PP.timeout ? 'TIME OUT' : ppRateText(PP.power);
    if (PP.power >= PPC.maxPower) { PP.flash = 0.5; PP.shake = 0.45; [784, 988, 1175, 1568, 1976, 2349, 3136].forEach((f, i) => beep(f, i * 0.07, 0.16, 0.07, 'triangle')); noise(0.2, 0.06); }                          // 999専用
    else if (PP.power >= 900) { [988, 1319, 1568].forEach((f, i) => beep(f, i * 0.08, 0.14, 0.06, 'triangle')); }
    else if (!PP.miss && !PP.timeout) { beep(784, 0, 0.1, 0.05, 'triangle'); beep(1047, 0.09, 0.14, 0.05, 'triangle'); }
    if (PP.newRecord) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.55 + i * 0.08, 0.14, 0.05));
  }
  // ---- 描画：7セグ風の赤いLED ----
  const PP_SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  function ppDigit(x, y, n, lit, w, h) {
    const t = Math.max(2, Math.round(w * 0.2)); const segs = { a: [x + t, y, w - 2 * t, t], b: [x + w - t, y + t, t, h / 2 - t], c: [x + w - t, y + h / 2, t, h / 2 - t], d: [x + t, y + h - t, w - 2 * t, t], e: [x, y + h / 2, t, h / 2 - t], f: [x, y + t, t, h / 2 - t], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t] };
    for (const k of Object.keys(segs)) { const on = lit && PP_SEG[n].includes(k); const s = segs[k]; rect(Math.round(s[0]), Math.round(s[1]), Math.round(s[2]), Math.round(s[3]), on ? '#ff2a2a' : '#2e0a0a'); if (on) { rect(Math.round(s[0]), Math.round(s[1]), Math.round(s[2]), 1, '#ff9a8a'); } }
  }
  function ppLed(cx, y, value, w, h, lit) { const s = String(clamp(value, 0, 999)).padStart(3, '0'); const gap = Math.round(w * 0.35); const tw = 3 * w + 2 * gap; for (let i = 0; i < 3; i++) ppDigit(Math.round(cx - tw / 2 + i * (w + gap)), y, +s[i], lit, w, h); }
  function ppPadDraw() {                                                                                                // パンチングパッド：上から つり下がる。ドン！で後ろへ ゆれて、もどる
    const pad = ppPad(); const k = PP.phase === 'impact' ? PP.impact : (PP.phase === 'roll' || PP.phase === 'settled' || PP.phase === 'result') ? 0.6 + (PP.t || 0) : 9; const pw = PP.miss ? 0.15 : PP.power / PPC.maxPower;
    const swing = k < 1.6 ? Math.sin(k * 16) * Math.exp(-k * 3.2) * (0.05 + 0.2 * pw) : 0; const sc = 1 - (k < 0.4 ? Math.sin(Math.min(1, k / 0.4) * Math.PI) * (0.04 + 0.1 * pw) : 0);
    rect(pad.x - 3, 36, 6, pad.y - pad.r - 30, '#9aa0aa'); rect(pad.x - 3, 36, 2, pad.y - pad.r - 30, '#e8ecf4'); rect(pad.x - 12, 32, 24, 6, '#5a606a'); rect(pad.x - 12, 32, 24, 1, '#c8ccd4');
    ctx.save(); ctx.translate(pad.x, pad.y - pad.r - 4); ctx.rotate(swing); ctx.scale(sc, sc); ctx.translate(0, pad.r + 4);
    ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(0, 0, pad.r + 5, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#b8bec8'; ctx.beginPath(); ctx.arc(0, 0, pad.r + 3, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#6a707a'; ctx.beginPath(); ctx.arc(0, 0, pad.r - 1, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#c42028'; ctx.beginPath(); ctx.arc(0, 0, pad.r - 3, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#e83a40'; ctx.beginPath(); ctx.arc(-pad.r * 0.1, -pad.r * 0.12, pad.r * 0.78, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.arc(-pad.r * 0.38, -pad.r * 0.42, pad.r * 0.22, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.2832); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -1, 7, 2); ctx.fillRect(-1, -3, 2, 7);                    // 中心マーク（ここが芯）
    ctx.restore();
    if (PP.phase === 'impact' && PP.impact < 0.4 && !PP.miss) { ctx.globalAlpha = (1 - PP.impact / 0.4) * 0.9; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2; for (const l of PP.lines) { const r0 = pad.r + 6 + PP.impact * 40; ctx.beginPath(); ctx.moveTo(pad.x + Math.cos(l.a) * r0, pad.y + Math.sin(l.a) * r0); ctx.lineTo(pad.x + Math.cos(l.a) * (r0 + 14 * l.l), pad.y + Math.sin(l.a) * (r0 + 14 * l.l)); ctx.stroke(); } ctx.globalAlpha = 1; }
  }
  function ppFist(x, y, s) { rect(x - 8 * s, y - 6 * s, 16 * s, 12 * s, '#e8b890'); rect(x - 8 * s, y - 6 * s, 16 * s, 2 * s, '#f6d0b0'); for (let i = 0; i < 4; i++) rect(x - 8 * s + i * 4 * s, y - 8 * s, 3 * s, 4 * s, '#e8b890'); rect(x - 10 * s, y - 2 * s, 4 * s, 7 * s, '#d8a070'); rect(x - 8 * s, y + 6 * s, 16 * s, 3 * s, '#d02030'); }
  function ppScene() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#14080a'); for (let y = 8; y < H - 8; y++) rect(8, y, W - 16, 1, mixHex('#2a0a0e', '#0e0406', (y - 8) / (H - 16)));
    rect(8, 8, 8, H - 16, '#c42028'); rect(W - 16, 8, 8, H - 16, '#c42028'); rect(8, 8, 2, H - 16, '#ff6a6a'); rect(W - 10, 8, 2, H - 16, '#7a1018'); rect(14, 8, 2, H - 16, '#b8bec8'); rect(W - 16, 8, 2, H - 16, '#b8bec8');
    rect(8, 8, W - 16, 24, '#1a1a22'); rect(8, 8, W - 16, 2, '#b8bec8'); rect(8, 30, W - 16, 2, '#c42028'); drawTextCenter('POWER PUNCH', W / 2, 13, '#ffffff', 2, '#7a1018');
    const pad = ppPad(); const lit = PP.phase !== 'select'; const showV = PP.phase === 'roll' || PP.phase === 'settled' || PP.phase === 'result' ? (PP.phase === 'result' ? PP.power : PP.shown) : 0;
    rect(W / 2 - 40, pad.y + pad.r + 14, 80, 40, '#0a0a10'); rect(W / 2 - 40, pad.y + pad.r + 14, 80, 2, '#b8bec8'); rect(W / 2 - 40, pad.y + pad.r + 52, 80, 2, '#7a1018'); ppLed(W / 2, pad.y + pad.r + 20, showV, 20, 28, true); drawTextCenter('MAX 999', W / 2, pad.y + pad.r + 57, '#8a8a98', 1);
    ppPadDraw();
    const z = ppStart(); if (PP.phase !== 'result') { rect(z.x, z.y, z.w, z.h, '#1e1218'); rect(z.x, z.y, z.w, 2, '#b8bec8'); rect(z.x, z.y + z.h - 2, z.w, 2, '#c42028'); ppFist(z.x + 22, z.y + z.h / 2, 1.3); drawText('START', z.x + 40, z.y + z.h / 2 - 3, '#ffffff', 1); }
    if (PP.phase === 'input') { for (let i = 0; i < 4; i++) { const f = ((PP.clock * 1.2 + i * 0.25) % 1); ctx.globalAlpha = (1 - f) * 0.55; rect(W / 2 - 3, Math.round(z.y - 8 - f * 70 - i * 2), 6, 8, '#ffe9a0'); } ctx.globalAlpha = 1; }                    // 下から上への、ガイド（やさしく流れる）
    if (PP.dev.zones) { ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.strokeRect(z.x - PPC.startZone.tol, z.y - PPC.startZone.tol, z.w + 2 * PPC.startZone.tol, z.h + 2 * PPC.startZone.tol); ctx.strokeStyle = '#ffff00'; ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r * PPC.padHit, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pad.x - 8, pad.y); ctx.lineTo(pad.x + 8, pad.y); ctx.stroke(); }
    if (PP.flash > 0) { ctx.globalAlpha = clamp(PP.flash * 1.4, 0, 0.6); rect(8, 8, W - 16, H - 16, PP.power >= PPC.maxPower ? '#ffd0d0' : '#fff3c0'); ctx.globalAlpha = 1; }
  }
  function ppHud() {
    drawText('BEST ' + P_().powerPunch.bestPower, 18, 36, '#c8ccd4', 1);
    if (PP.phase === 'ready') drawTextCenter('READY', W / 2, 150, '#ffffff', 4, '#7a1018');
    if (PP.phase === 'count') drawTextCenter(String(PP.cnt), W / 2, 130, '#ffe070', 8, '#7a1018');
    if (PP.phase === 'input') { const k = Math.min(1, PP.t / 0.15); drawTextCenter('PUNCH!!', W / 2, 140, '#ffffff', 4 + Math.round((1 - k) * 2), '#c42028'); }
    if (PP.phase === 'settled' || PP.phase === 'roll') { if (PP.miss) drawTextCenter('MISS', W / 2, 140, '#c8c8d8', 3, '#14080a'); else if (PP.timeout) drawTextCenter('TIME OUT', W / 2, 140, '#c8c8d8', 2, '#14080a'); }
    if (PP.phase === 'settled') { const g = PP.power >= PPC.maxPower; const a = 0.75 + 0.25 * Math.sin(PP.clock * 4); ctx.globalAlpha = g ? a : 1; if (!PP.miss && !PP.timeout) drawTextCenter(PP.rate, W / 2, 140, g ? '#ff5a5a' : PP.power >= 900 ? '#ffe070' : '#ffffff', g ? 3 : 2, g ? '#ffffff' : '#7a1018'); ctx.globalAlpha = 1; if (g) { rect(W / 2 - 24, 56, 8, 8, '#ff2a2a'); rect(W / 2 + 16, 56, 8, 8, '#ff2a2a'); } }                 // 999は、赤いランプが、ゆっくり明るくなる
    if (PP.dev.debug && PP.debug) { const d = PP.debug; drawText('SPEED ' + (d.speed != null ? d.speed.toFixed(2) : '-') + ' (' + (d.vN != null ? d.vN.toFixed(2) : '-') + ')', 14, 44, '#00ff88', 1); drawText('ACCURACY ' + (d.accuracy != null ? d.accuracy.toFixed(2) : '-') + ' d ' + (d.d != null ? d.d.toFixed(2) : '-'), 14, 52, '#00ff88', 1); drawText('DIRECTION ' + (d.direction != null ? d.direction.toFixed(2) : '-') + ' ANGLE ' + (d.angle != null ? d.angle.toFixed(1) : '-'), 14, 60, '#00ff88', 1); drawText('POWER ' + (d.power != null ? d.power : '-') + (d.note ? ' ' + d.note : ''), 14, 68, '#00ff88', 1); }
  }
  function ppDrawResult() {                                                                                             // 結果：LEDに、POWER。その下に、BEST と NEW RECORD!（パンチの余韻を、じゃましない）
    ppScene(); const pad = ppPad(); drawTextCenter('POWER', W / 2, pad.y + pad.r + 8, '#c8ccd4', 1);
    drawTextCenter('BEST ' + PP.best, W / 2, pad.y + pad.r + 70, '#ffffff', 2, '#14080a'); if (PP.newRecord) { ctx.globalAlpha = 0.7 + 0.3 * Math.sin(PP.clock * 3); drawTextCenter('NEW RECORD!', W / 2, pad.y + pad.r + 90, '#7dff8a', 2, '#0a3a1a'); ctx.globalAlpha = 1; }
  }
  function ppDrawSelect() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#c42028'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#d83038', '#8a1018', (y - 8) / (H - 16)));
    rect(8, 8, W - 16, 3, '#ffb0b0'); rect(16, 18, W - 32, 62, '#14080a'); rect(18, 20, W - 36, 58, '#22121a'); drawTextCenter('POWER', W / 2, 24, '#ffffff', 3, '#7a1018'); drawTextCenter('PUNCH', W / 2, 50, '#ff6a6a', 3, '#ffffff');
    const t = PP.sel || 0; PP.shown = 0; const pad = { x: W / 2, y: 148, r: 36 };
    ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r + 5, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#b8bec8'; ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r + 3, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#c42028'; ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r - 1, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#e83a40'; ctx.beginPath(); ctx.arc(pad.x - 4, pad.y - 5, pad.r * 0.75, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(pad.x - 3, pad.y - 1, 7, 2); ctx.fillRect(pad.x - 1, pad.y - 3, 2, 7);
    rect(W / 2 - 36, 200, 72, 34, '#0a0a10'); ppLed(W / 2, 205, 999, 16, 24, true); drawTextCenter('MAX 999', W / 2, 238, '#14080a', 1);
    rect(16, 252, W - 32, 52, '#f4f4f0'); rect(16, 252, W - 32, 2, '#ffffff'); drawTextCenter('1 PUNCH ONLY!', W / 2, 258, '#7a1018', 1); drawTextCenter('BEST ' + P_().powerPunch.bestPower, W / 2, 270, '#14080a', 2); drawTextCenter('YEN ' + P_().money + '    PLAY  YEN ' + PPC.price, W / 2, 292, '#7a1018', 1);
  }
  const PP_DOM = {};
  function ppBuildDom() {
    if (PP_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); PP_DOM[id.slice(3)] = b; return b; };
    mk('pp-start', 'PLAY　¥' + PPC.price, 'td-go').addEventListener('click', () => { ensureAudio(); ppBegin(); });
    mk('pp-retry', 'もういちど　¥' + PPC.price, 'td-go').addEventListener('click', () => { ensureAudio(); ppBegin(); });
    mk('pp-out', '6Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); PP.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('pp-skip', 'SKIP', 'hb-quit st-small').addEventListener('click', () => { ensureAudio(); if (PP.phase === 'ready') PP.t = 99; });
    const hint = document.createElement('div'); hint.className = 'prize-info st-say br-hint'; hint.innerHTML = '下から上へ<br>一気にフリック！<br>真ん中を狙おう！'; screenEl.appendChild(hint); PP_DOM.hint = hint;
  }
  function ppUi() {
    ppBuildDom(); const ph = PP.phase; const show = (k, on) => PP_DOM[k].classList.toggle('is-show', !!on); const hintOn = ph === 'ready' && !P_().powerPunch.seenHint;
    show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); show('skip', hintOn); show('hint', hintOn);
    crPlace(PP_DOM.start, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(PP_DOM.retry, { x: 20, y: 322 - 4, w: W - 40, h: 26 }); crPlace(PP_DOM.out, { x: 20, y: 352 - 4, w: W - 40, h: 22 }); crPlace(PP_DOM.skip, { x: W - 52, y: 40, w: 40, h: 18 }); crPlace(PP_DOM.hint, { x: 14, y: 196, w: W - 28, h: 56 });
  }
  function ppHide() { if (!PP_DOM.start) return; Object.keys(PP_DOM).forEach((k) => PP_DOM[k].classList.remove('is-show')); }
  function ppDraw() {
    const ph = PP.phase; if (ph === 'select') { ppDrawSelect(); ppUi(); return; }
    ctx.save(); if (PP.shake > 0) { const a = (PP.power >= PPC.maxPower ? 4 : PP.power >= 900 ? 3 : 2) * (PP.shake / 0.3); ctx.translate(0, Math.round(Math.sin(PP.clock * 80) * a)); }                    // 衝撃（数px・短時間）
    if (ph === 'result') ppDrawResult(); else { ppScene(); ppHud(); } ctx.restore(); ppUi();
  }
  function openPpDev() {
    const again = (f) => () => { f(); setTimeout(openPpDev, 0); }; const P = PPC;
    showDialog({ title: 'POWER PUNCH DEV', wide: true, lines: [{ text: 'BEST ' + P_().powerPunch.bestPower + ' / 強制 ' + (PP.dev.force === null ? 'なし' : PP.dev.force) + ' / デバッグ表示 ' + (PP.dev.debug ? 'ON' : 'OFF') + ' / カウント即スキップ ' + (PP.dev.skipCount ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '強制 POWER 861', onClick: again(() => { PP.dev.force = 861; }) }, { label: '強制 POWER 500', onClick: again(() => { PP.dev.force = 500; }) }, { label: '強制 999', onClick: again(() => { PP.dev.force = 999; }) }, { label: '強制 MISS', onClick: again(() => { PP.dev.force = 'miss'; }) }, { label: '強制 なし', onClick: again(() => { PP.dev.force = null; }) },
      { label: 'speed / accuracy / direction / angle 表示 ON/OFF', onClick: again(() => { PP.dev.debug = !PP.dev.debug; }) }, { label: 'START領域・パッド判定 表示 ON/OFF', onClick: again(() => { PP.dev.zones = !PP.dev.zones; }) },
      { label: 'カウント即スキップ ON/OFF', onClick: again(() => { PP.dev.skipCount = !PP.dev.skipCount; }) }, { label: '最低の速さ ±0.1（今 ' + P.swipe.minSpeed + '）', onClick: again(() => { P.swipe.minSpeed = +(P.swipe.minSpeed + 0.1).toFixed(2); if (P.swipe.minSpeed > 1.5) P.swipe.minSpeed = 0.5; }) },
      { label: 'BEST POWER リセット', onClick: again(() => { P_().powerPunch.bestPower = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('powerPunch', {
    reset() { PP.phase = 'select'; PP.sw = null; }, phase: () => PP.phase,
    enter() { ppBuildDom(); PP.phase = 'select'; PP.sel = 0; PP.sw = null; PP.debug = null; setMessage('', C.cyan); },
    update: ppUpdate, draw: ppDraw, hint: '下から上へ 一気にフリック！ 真ん中を狙おう！',
    pointer: ppPointer, pointerUp: ppPointerUp
  });
  GAME_TYPES.powerPunch.pointerMove = ppPointerMove;
  GAME_TYPES.powerPunch.canLeave = () => PP.phase === 'select' || PP.phase === 'result';
  GAME_TYPES.powerPunch.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

