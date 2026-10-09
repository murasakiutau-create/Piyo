'use strict';
  // =====================================================================
  //  👻 GHOST PANIC（お化けパニック）：8F　60秒スコアアタック。出てくるゴーストをタップ。GOLD（500点）・BIG（3回タップで1000点）・COMBO
  //   ¥100（MONEYのみ）。残り30秒から GHOST RUSH！（出現が増え、BIG が出る）。LIFE・ゲームオーバーなし。調整値は CONFIG.ghostRush
  //   素材：assets/ghostpanic/gold_ghost.webp・big_ghost.webp（新）／ふつうのゴーストは assets/cosmo の既存素材をそのまま
  // =====================================================================
  const GPC = CONFIG.ghostRush;
  const GP_MACHINE = { machineId: 'gp_ghostpanic', machineName: 'GHOST PANIC', label: 'GHOST PANIC', isUnlocked: true, gameType: 'ghostRush', gp: true };
  const GP = { phase: 'intro', sub: 'ready', t: 0, clock: 0, time: 60, ghosts: [], fx: [], pops: [], score: 0, kills: { n: 0, g: 0, b: 0, p: 0 }, combo: 0, maxCombo: 0, spawnT: 1, bigCount: 0, bigLast: -99, rush: false, banner: null, pause: false, paying: false, newRecord: false, result: null, lastSec: -1, uid: 0, dev: { boxes: false } };
  const GP_IMG = {}; ['gold_ghost', 'big_ghost'].forEach((n) => { const im = new Image(); im.src = 'assets/ghostpanic/' + n + '.webp'; GP_IMG[n] = im; });
  const gpImg = (n) => { const im = GP_IMG[n]; return im && im.complete && im.naturalWidth ? im : null; };
  const gpRec = () => { const p = P_(); if (!p.ghostRush) p.ghostRush = { v: 1, plays: 0, bestScore: 0, bestCombo: 0 }; const r = p.ghostRush; r.plays = r.plays | 0; r.bestScore = r.bestScore | 0; r.bestCombo = r.bestCombo | 0; return r; };
  const gpRand = (a, b) => a + Math.random() * (b - a);
  const gpField = () => ({ x0: 6, x1: W - 6, y0: 44, y1: 334 });
  function gpInsert() {
    if (GP.paying || GP.phase === 'play') return; if (P_().money < GPC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    GP.paying = true; chargeYen(GPC.price); gpRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); gpStart(); GP.paying = false;
  }
  function gpStart() { GP.ghosts = []; GP.fx = []; GP.pops = []; GP.score = 0; GP.kills = { n: 0, g: 0, b: 0, p: 0 }; GP.combo = 0; GP.maxCombo = 0; GP.time = GPC.gameTime; GP.spawnT = 0.6; GP.bigCount = 0; GP.bigLast = -99; GP.rush = false; GP.banner = null; GP.pause = false; GP.newRecord = false; GP.result = null; GP.lastSec = -1; GP.phase = 'play'; GP.sub = 'ready'; GP.t = 0; beep(660, 0.1, 0.1, 0.04, 'triangle'); }
  // ---- 出現 ----
  function gpActive() { return GP.ghosts.filter((g) => !g.dying); }
  function gpPlace(kind) {
    const f = gpField(); const sz = GPC.size[kind]; const act = gpActive();
    for (let k = 0; k < 24; k++) {
      const x = gpRand(f.x0 + sz.w / 2 + 2, f.x1 - sz.w / 2 - 2); const y = gpRand(f.y0 + sz.h / 2 + 4, f.y1 - sz.h / 2 - 4); let ok = true;
      for (const o of act) { const so = GPC.size[o.kind]; if (Math.abs(o.x - x) < (sz.w + so.w) / 2 * 0.85 && Math.abs(o.y - y) < (sz.h + so.h) / 2 * 0.85) { ok = false; break; } }
      if (ok) return { x, y };
    }
    return null;
  }
  function gpSpawn(kind) {
    const pos = gpPlace(kind); if (!pos) return false; const L = GPC.life[kind]; const g = { id: ++GP.uid, kind, x: pos.x, y: pos.y, age: 0, life: gpRand(L[0], L[1]) * (GP.rush && kind !== 'big' ? GPC.rushLifeMul : 1), hp: kind === 'big' ? GPC.bigGhostHP : 1, variant: Math.floor(Math.random() * 3), ph: Math.random() * 6.28, shake: 0, hurt: 0, dying: false, dt: 0 };
    GP.ghosts.push(g); if (kind === 'gold') { [1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.05, 0.1, 0.04, 'triangle')); gpBurst(g.x, g.y, '#ffe070', 6, 0.7); }
    else if (kind === 'big') { beep(110, 0, 0.3, 0.07, 'sawtooth', 70); beep(165, 0.12, 0.25, 0.06, 'square', 110); GP.bigCount++; GP.bigLast = GP.clock; } return true;
  }
  function gpPickKind() {
    const late = GP.rush; const bigOk = late && GP.bigCount < GPC.bigMax && !GP.ghosts.some((g) => g.kind === 'big' && !g.dying) && GP.clock - GP.bigLast >= GPC.bigGap;
    if (bigOk && Math.random() < GPC.bigSpawnRate) return 'big'; if (Math.random() < (late ? GPC.pumpkinRateLate : GPC.pumpkinRate)) return 'pumpkin'; if (Math.random() < (late ? GPC.goldSpawnRateLate : GPC.goldSpawnRate)) return 'gold'; return 'normal';
  }
  function gpTrySpawn() {
    if (GP.time <= 0.5) return; const max = GP.rush ? GPC.lateMaxEnemies : GPC.earlyMaxEnemies; const n = gpActive().length; const iv = GP.rush ? GPC.lateSpawnInterval : GPC.earlySpawnInterval; if (n < max) gpSpawn(gpPickKind()); GP.spawnT = gpRand(iv[0], iv[1]);
  }
  // ---- 演出 ----
  function gpBurst(x, y, col, n, life) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const v = gpRand(30, 70); GP.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, t: 0, life: life || 0.5, col }); } }
  const gpPop = (x, y, text, col, sc) => { GP.pops.push({ x, y, text, col: col || '#ffffff', sc: sc || 1, t: 0 }); };
  function gpBanner(text, sub, col, dur, top) { GP.banner = { text, sub: sub || '', col: col || '#ffe070', t: 0, dur: dur || 1.2, top: !!top }; }
  // ---- タップ ----
  function gpHit(g, p) { const sz = GPC.size[g.kind]; const pad = g.kind === 'big' ? GPC.hitPad + 6 : GPC.hitPad; return Math.abs(p.x - g.x) <= sz.w / 2 + pad && Math.abs(p.y - g.y) <= sz.h / 2 + pad; }
  function gpPointer(e, p) {
    if (GP.pause) { GP.pause = false; return; } if (GP.phase !== 'play' || GP.sub !== 'run') return;
    const pr = { big: 3, gold: 2, normal: 1, pumpkin: 1 }; let hit = null; for (const g of GP.ghosts) if (!g.dying && gpHit(g, p) && (!hit || pr[g.kind] > pr[hit.kind] || (pr[g.kind] === pr[hit.kind] && g.id > hit.id))) hit = g;
    if (hit) { GP.lastTap = { x: hit.x, y: hit.y, t: GP.clock, r: Math.max(GPC.size[hit.kind].w, GPC.size[hit.kind].h) / 2 + 24 }; gpTap(hit); return; }
    const lt = GP.lastTap; if (lt && GP.clock - lt.t < GPC.tapGrace && Math.hypot(p.x - lt.x, p.y - lt.y) < lt.r) return;                                  // 倒した直後の ダメ押し連打は ミスにしない
    GP.combo = 0; gpPop(p.x, p.y - 6, 'MISS', '#9a8ab8', 1); beep(170, 0, 0.07, 0.04, 'sawtooth', 120);
  }
  function gpAdd(pts, x, y, col, sc) { GP.score += pts; gpPop(x, y - 14, '+' + pts, col, sc); }
  function gpKill(g) {
    g.dying = true; g.dt = 0; GP.combo++; GP.maxCombo = Math.max(GP.maxCombo, GP.combo);
    if (g.kind === 'normal') { GP.kills.n++; gpAdd(GPC.score.normal, g.x, g.y, '#ffffff', 1); beep(880, 0, 0.05, 0.05, 'triangle', 1320); gpBurst(g.x, g.y, '#e8e0ff', 5, 0.4); }
    else if (g.kind === 'gold') { GP.kills.g++; gpAdd(GPC.score.gold, g.x, g.y, '#ffe070', 2); [1175, 1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.05, 0.1, 0.05, 'triangle')); gpBurst(g.x, g.y, '#ffe070', 14, 0.7); }
    else { GP.kills.b++; gpAdd(GPC.score.big, g.x, g.y, '#ffb86a', 2); [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.07, 0.14, 0.06, 'triangle')); noise(0.12, 0.06); gpBurst(g.x, g.y, '#ffffff', 18, 0.8); }
    const b = GPC.comboBonuses[GP.combo]; if (b) { GP.score += b; gpBanner(GP.combo + ' COMBO!', '+' + b, '#7dfcff', 0.9, true); [988, 1319, 1760].forEach((f, i) => beep(f, 0.08 + i * 0.05, 0.08, 0.05, 'square')); }
  }
  function gpTap(g) {
    if (g.kind === 'pumpkin') { g.dying = true; g.dt = 0; GP.kills.p++; GP.combo = 0; const lost = Math.min(GP.score, GPC.pumpkinPenalty); GP.score -= lost; gpPop(g.x, g.y - 14, '-' + lost, '#ff7a7a', 2); beep(220, 0, 0.12, 0.06, 'sawtooth', 110); beep(150, 0.1, 0.16, 0.06, 'square', 90); gpBurst(g.x, g.y, '#ff9a3a', 8, 0.5); return; }
    if (g.kind === 'big') { g.hp--; if (g.hp > 0) { g.shake = 0.35; g.hurt = 0.35; noise(0.05, 0.05); beep(220 + (GPC.bigGhostHP - g.hp) * 90, 0, 0.1, 0.06, 'square', 140); gpBurst(g.x, g.y, '#ffffff', 6, 0.35); return; } }
    gpKill(g);
  }
  // ---- 更新 ----
  function gpFinish() {
    const r = gpRec(); GP.newRecord = GP.score > 0 && GP.score > r.bestScore; if (GP.newRecord) r.bestScore = GP.score; r.bestCombo = Math.max(r.bestCombo, GP.maxCombo);
    GP.result = { score: GP.score, best: r.bestScore, kills: Object.assign({}, GP.kills), maxCombo: GP.maxCombo, bestCombo: r.bestCombo }; writeSave(); GP.phase = 'result'; GP.t = 0; GP.banner = null; if (GP.newRecord) [988, 1319, 1568, 1976].forEach((f, i) => beep(f, 0.2 + i * 0.09, 0.12, 0.06, 'triangle'));
  }
  function gpUpdate(dt) {
    GP.clock += dt; dt = Math.min(dt, 0.05); if (GP.pause) return; GP.t += dt;
    for (const f of GP.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 90 * dt; } GP.fx = GP.fx.filter((f) => f.t < f.life); for (const q of GP.pops) q.t += dt; GP.pops = GP.pops.filter((q) => q.t < 0.9); if (GP.banner) { GP.banner.t += dt; if (GP.banner.t > GP.banner.dur) GP.banner = null; }
    if (GP.phase !== 'play') return;
    for (const g of GP.ghosts) { g.age += dt; if (g.shake > 0) g.shake -= dt; if (g.hurt > 0) g.hurt -= dt; if (g.dying) g.dt += dt; } GP.ghosts = GP.ghosts.filter((g) => (g.dying ? g.dt < 0.3 : g.age < g.life));
    if (GP.sub === 'ready') { if (GP.t >= GPC.readyTime) { GP.sub = 'go'; GP.t = 0; beep(1175, 0, 0.12, 0.06, 'square'); } return; }
    if (GP.sub === 'go') { if (GP.t >= GPC.goTime) { GP.sub = 'run'; GP.t = 0; } return; }
    if (GP.sub === 'timeup') { if (GP.t >= GPC.timeUpTime) gpFinish(); return; }
    GP.time -= dt; if (!GP.rush && GP.time <= GPC.rushAt) { GP.rush = true; gpBanner('GHOST RUSH!', 'LAST ' + GPC.rushAt + ' SEC', '#ff9a5a', 1.5); [392, 523, 659, 784].forEach((f, i) => beep(f, i * 0.07, 0.12, 0.06, 'square')); }
    const sec = Math.ceil(GP.time); if (GP.time <= 10 && sec !== GP.lastSec && sec > 0) { GP.lastSec = sec; beep(sec <= 3 ? 1320 : 988, 0, 0.07, 0.05, 'square'); }
    if (GP.time <= 0) { GP.time = 0; GP.sub = 'timeup'; GP.t = 0; for (const g of GP.ghosts) g.dying = true; gpBanner('TIME UP!', '', '#ffe070', GPC.timeUpTime); [784, 659, 523, 392].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.06, 'triangle')); return; }
    GP.spawnT -= dt; if (GP.spawnT <= 0) gpTrySpawn(); if (!gpActive().length && GP.spawnT > 0.3) GP.spawnT = 0.25;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && GP.phase === 'play') GP.pause = true; });
  // ---- 描画 ----
  function gpBg() {
    rect(0, 0, W, H, '#0c0420'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#1c0a3a', '#08021a', y / H)); drawFrame();
    for (let i = 0; i < 28; i++) { const x = (i * 53 + 17) % (W - 16) + 8; const y = (i * 37 + 11) % 200 + 36; ctx.globalAlpha = 0.25 + 0.2 * ((i % 3) / 2); rect(x, y, 1, 1, '#d8c8ff'); } ctx.globalAlpha = 1;
    ctx.fillStyle = '#f0e8c8'; ctx.beginPath(); ctx.arc(W - 34, 70, 14, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#1c0a3a'; ctx.beginPath(); ctx.arc(W - 29, 66, 12, 0, 6.2832); ctx.fill();
    for (let i = 0; i < 6; i++) { const x = 14 + i * Math.floor((W - 40) / 5); rect(x, 338, 12, 12, '#1a0c34'); rect(x + 1, 336, 10, 2, '#1a0c34'); rect(x + 5, 341, 2, 5, '#2c1a52'); rect(x + 3, 343, 6, 1, '#2c1a52'); }
    rect(8, 352, W - 16, 24, '#0a0418'); for (let x = 8; x < W - 8; x += 6) rect(x, 352, 3, 3, '#1a0c34');
  }
  function gpDrawSpr(g) {
    const sz = GPC.size[g.kind]; const a = g.age; const appear = Math.min(1, a / 0.22); const fadeOut = g.dying ? 1 - g.dt / 0.3 : Math.min(1, (g.life - a) / 0.3); const alpha = Math.max(0, Math.min(1, appear, fadeOut));
    let sc = 0.6 + 0.4 * appear; if (g.dying) sc *= 1 + 0.45 * (g.dt / 0.3); if (g.kind === 'big') sc *= 1 - 0.07 * (GPC.bigGhostHP - g.hp) + (g.hurt > 0 ? 0.04 * Math.sin(g.hurt * 40) : 0);
    const bob = Math.sin(a * 3 + g.ph) * 2; const sx = g.shake > 0 ? Math.sin(g.shake * 90) * 3 * (g.shake / 0.35) : 0; const cx = g.x + sx; const cy = g.y + bob;
    const img = g.kind === 'gold' ? gpImg('gold_ghost') : g.kind === 'big' ? gpImg('big_ghost') : g.kind === 'pumpkin' ? ci('pumpkin') : ci(['ghost_white', 'ghost_purple', 'ghost_green'][g.variant]); if (!img) return;
    if (g.kind === 'gold') { ctx.globalAlpha = alpha * (0.22 + 0.08 * Math.sin(a * 4)); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(cx, cy, sz.w * 0.82, 0, 6.2832); ctx.fill(); ctx.globalAlpha = alpha * 0.22; ctx.fillStyle = '#fff4b0'; ctx.beginPath(); ctx.arc(cx, cy, sz.w * 0.55, 0, 6.2832); ctx.fill(); }
    if (g.kind === 'big') { ctx.globalAlpha = alpha * 0.18; ctx.fillStyle = '#b8a0ff'; ctx.beginPath(); ctx.arc(cx, cy + 4, sz.w * 0.72, 0, 6.2832); ctx.fill(); }
    ctx.globalAlpha = 0.25 * alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, g.y + sz.h / 2 + 3, sz.w * 0.34 * sc, 2.5, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = alpha; const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; const w = Math.round(sz.w * sc); const h = Math.round(sz.h * sc); ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h); ctx.imageSmoothingEnabled = sm; ctx.globalAlpha = 1;
    if (g.kind === 'gold' && !g.dying) { for (let i = 0; i < 6; i++) { const ph = (a * 1.3 + i / 6) % 1; const ang = i * 1.05 + a * 0.9; const rr = sz.w * (0.5 + 0.18 * Math.sin(i * 2.3)); const px = cx + Math.cos(ang) * rr; const py = cy + Math.sin(ang) * rr * 0.9; const k = Math.sin(ph * Math.PI); ctx.globalAlpha = alpha * k * k; const s = 1 + Math.round(k * 1.6); rect(Math.round(px) - s, Math.round(py), s * 2 + 1, 1, '#fff6c0'); rect(Math.round(px), Math.round(py) - s, 1, s * 2 + 1, '#fff6c0'); rect(Math.round(px), Math.round(py), 1, 1, '#ffffff'); } ctx.globalAlpha = 1; }
    if (g.kind === 'big' && !g.dying) { for (let i = 0; i < GPC.bigGhostHP; i++) { rect(Math.round(cx - GPC.bigGhostHP * 4 + i * 8), Math.round(cy - h / 2 - 6), 6, 3, i < g.hp ? '#ff7a8a' : '#3a2a5a'); } }
    if (DEV_MODE && GP.dev.boxes) { ctx.strokeStyle = '#00ff88'; ctx.beginPath(); ctx.ellipse(g.x, g.y, sz.w / 2 + GPC.hitPad, sz.h / 2 + GPC.hitPad, 0, 0, 6.2832); ctx.stroke(); }
  }
  function gpDrawHud() {
    rect(8, 6, W - 16, 30, 'rgba(8,2,20,0.6)'); drawText('SCORE', 12, 8, '#c8a0ff', 1); drawText(String(GP.score), 12, 17, '#ffffff', 2, '#4a2a9a');
    const t = Math.ceil(GP.time); const low = GP.time <= 10 && GP.phase === 'play'; const ts = String(Math.max(0, t)); const sc = low ? 3 : 2; drawTextCenter('TIME', W / 2, 8, low ? '#ff9a9a' : '#c8a0ff', 1); drawTextCenter(ts, W / 2, low ? 15 : 17, low ? '#ff7a7a' : '#ffffff', sc, low ? '#3a0a0a' : '#4a2a9a');
    const cs = 'COMBO'; drawText(cs, W - 12 - textWidth(cs, 1), 8, '#7dfcff', 1); const cv = String(GP.combo); drawText(cv, W - 12 - textWidth(cv, 2), 17, GP.combo >= 5 ? '#7dfcff' : '#ffffff', 2, '#0a3a4a');
  }
  function gpDrawPlay() {
    gpBg(); const order = { normal: 0, pumpkin: 0, gold: 1, big: 2 }; for (const g of GP.ghosts.slice().sort((a, b) => order[a.kind] - order[b.kind])) gpDrawSpr(g);
    for (const f of GP.fx) { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); rect(Math.round(f.x), Math.round(f.y), 2, 2, f.col); } ctx.globalAlpha = 1;
    for (const q of GP.pops) { ctx.globalAlpha = Math.min(1, (0.9 - q.t) * 3); drawTextCenter(q.text, Math.round(q.x), Math.round(q.y - q.t * 18), q.col, q.sc, '#10042a'); } ctx.globalAlpha = 1; gpDrawHud();
    if (GP.banner) { const b = GP.banner; const a = Math.min(1, b.t * 8, (b.dur - b.t) * 6); ctx.globalAlpha = Math.max(0, a); if (b.top) { const y = 40; rect(8, y, W - 16, 22, 'rgba(8,2,20,0.75)'); rect(8, y, W - 16, 1, b.col); drawTextCenter(b.text + '  ' + b.sub, W / 2, y + 7, b.col, 1, '#10042a'); } else { const y = 150; rect(0, y, W, b.sub ? 40 : 28, 'rgba(8,2,20,0.85)'); rect(0, y, W, 1, b.col); drawTextCenter(b.text, W / 2, y + 5, b.col, b.text.length > 11 ? 2 : 3, '#10042a'); if (b.sub) drawTextCenter(b.sub, W / 2, y + 28, '#ffffff', 1); } ctx.globalAlpha = 1; }
    if (GP.sub === 'ready' || GP.sub === 'go') { rect(0, 150, W, 34, 'rgba(8,2,20,0.85)'); drawTextCenter(GP.sub === 'ready' ? 'READY' : 'GO!', W / 2, 156, GP.sub === 'ready' ? '#ffffff' : '#7dff8a', 3, '#10042a'); }
    if (GP.pause) { ctx.globalAlpha = 0.7; rect(0, 0, W, H, '#02030a'); ctx.globalAlpha = 1; drawTextCenter('PAUSE', W / 2, 150, '#ffffff', 3, '#20a8c8'); drawTextCenter('TAP TO RESUME', W / 2, 190, '#ffffff', 1); }
  }
  function gpDrawIntro() {
    gpBg(); drawTextCenter('GHOST', W / 2, 18, '#c8a0ff', 4, '#3a1a6a'); drawTextCenter('PANIC', W / 2, 46, '#ffe070', 4, '#a0481a');
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; const gi = gpImg('gold_ghost'); const bi = gpImg('big_ghost'); const wi = ci('ghost_white');
    if (wi) ctx.drawImage(wi, Math.round(W / 2 - 78), 96, 45, 47); if (gi) ctx.drawImage(gi, Math.round(W / 2 - 22), 94, 44, 47); if (bi) ctx.drawImage(bi, Math.round(W / 2 + 36), 84, 56, 71); ctx.imageSmoothingEnabled = sm;
    drawTextCenter('100', W / 2 - 55, 148, '#ffffff', 1); drawTextCenter('500', W / 2, 148, '#ffe070', 1); drawTextCenter('1000', W / 2 + 64, 158, '#ffb86a', 1);
    drawTextCenter('YEN ' + P_().money, W / 2, 262, '#a8b8ff', 1); const r = gpRec(); drawTextCenter('BEST SCORE ' + r.bestScore, W / 2, 274, '#ffe070', 1); drawTextCenter('1 PLAY  YEN ' + GPC.price, W / 2, 304, '#a8b8ff', 1);
  }
  function gpDrawResult() {
    gpBg(); ctx.globalAlpha = 0.6; rect(0, 0, W, H, '#05020e'); ctx.globalAlpha = 1; const r = GP.result; if (!r) return; drawTextCenter('RESULT', W / 2, 18, '#ffffff', 3, '#3a1a6a');
    drawTextCenter('SCORE', W / 2, 50, '#c8a0ff', 1); drawTextCenter(String(r.score), W / 2, 62, '#ffffff', 4, '#4a2a9a'); const L = (lab, v, y, col) => { drawText(lab, 28, y, '#c8a0ff', 1); const s = String(v); drawText(s, W - 28 - textWidth(s, 1), y, col, 1); };
    L('GHOSTS', r.kills.n, 104, '#ffffff'); L('GOLD', r.kills.g, 118, '#ffe070'); L('BIG', r.kills.b, 132, '#ffb86a'); L('MAX COMBO', r.maxCombo, 146, '#7dfcff'); L('PUMPKIN', r.kills.p, 160, '#ff9a3a'); rect(24, 174, W - 48, 1, '#4a2a7a');
    drawTextCenter('BEST SCORE', W / 2, 182, '#c8a0ff', 1); drawTextCenter(String(r.best), W / 2, 194, '#ffe070', 2, '#a0481a'); if (GP.newRecord) drawTextCenter('* NEW RECORD! *', W / 2, 218, '#7dff8a', 2, '#0a3a1a'); drawTextCenter('YEN ' + P_().money, W / 2, 240, '#a8b8ff', 1);
  }
  const GP_DOM = {};
  function gpBuildDom() {
    if (GP_DOM.play) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); GP_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('gp-play', 'PLAY　¥' + GPC.price, 'hb-go', gpInsert); mk('gp-retry', 'もういちど　¥' + GPC.price, 'hb-go', () => { GP.phase = 'intro'; gpInsert(); });
    const say = document.createElement('div'); say.className = 'nk-say'; say.id = 'gp-say'; say.innerHTML = 'ゴーストを タップして たおそう！<br>金色は 500点！ 大きいのは 3回タップで 1000点！<br>カボチャを さわると げんてん＆COMBOが きれるよ<br><span class="nk-dim">' + GPC.gameTime + 'びょうの スコアアタック／残り' + GPC.rushAt + '秒で GHOST RUSH！</span>'; screenEl.appendChild(say); GP_DOM.say = say;
  }
  function gpUi() {
    gpBuildDom(); const ph = GP.phase; const show = (k, on) => GP_DOM[k].classList.toggle('is-show', !!on); show('play', ph === 'intro'); show('say', ph === 'intro'); show('retry', ph === 'result');
    crPlace(GP_DOM.play, { x: 24, y: 318, w: W - 48, h: 34 }); crPlace(GP_DOM.say, { x: 12, y: 176, w: W - 24, h: 84 }); crPlace(GP_DOM.retry, { x: 20, y: 262, w: W - 40, h: 34 });
    for (const k of ['play', 'retry']) GP_DOM[k].style.fontSize = Math.max(10, parseFloat(GP_DOM[k].style.fontSize) * 0.95) + 'px'; GP_DOM.say.style.fontSize = Math.max(10, parseFloat(GP_DOM.say.style.fontSize) * 0.86) + 'px';
  }
  function gpHide() { if (!GP_DOM.play) return; Object.keys(GP_DOM).forEach((k) => GP_DOM[k].classList.remove('is-show')); }
  function gpDraw() { const ph = GP.phase; if (ph === 'intro') gpDrawIntro(); else if (ph === 'result') gpDrawResult(); else gpDrawPlay(); gpUi(); }
  function gpLeaveMid() {
    if (GP.phase !== 'play') return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ・BESTも きろくされないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { GP.phase = 'intro'; GP.pause = false; GP.ghosts = []; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function openGpDev() {
    const again = (f) => () => { f(); setTimeout(openGpDev, 0); }; const D = GP.dev; const play = () => GP.phase === 'play' && GP.sub === 'run';
    showDialog({ title: 'GHOST PANIC DEV', wide: true, lines: [{ text: 'PHASE ' + GP.phase + '.' + GP.sub + ' / TIME ' + GP.time.toFixed(1) + ' / SCORE ' + GP.score + ' / COMBO ' + GP.combo + ' / 場 ' + GP.ghosts.length + ' / BIG ' + GP.bigCount + ' / 判定枠 ' + (D.boxes ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) }, { label: 'ゲーム即開始（料金なし）', onClick: () => { gpStart(); } },
      { label: 'GOLD を出す', onClick: again(() => { if (play()) gpSpawn('gold'); }) }, { label: 'BIG を出す', onClick: again(() => { if (play()) { GP.bigCount = Math.min(GP.bigCount, GPC.bigMax - 1); gpSpawn('big'); } }) },
      { label: '残り時間：21秒（RUSH直前）/ 11秒 / 4秒', onClick: again(() => { if (play()) GP.time = GP.time > 21 ? 21 : GP.time > 11 ? 11 : GP.time > 4 ? 4 : GPC.gameTime; }) }, { label: 'COMBO を 4 にする', onClick: again(() => { if (play()) GP.combo = 4; }) },
      { label: 'カボチャを出す', onClick: again(() => { if (play()) gpSpawn('pumpkin'); }) }, { label: '判定枠の表示 ON/OFF', onClick: again(() => { D.boxes = !D.boxes; }) }, { label: '結果画面へ（いまのスコアで）', onClick: () => { if (GP.phase === 'play') { gpFinish(); } } },
      { label: 'BEST 記録 リセット', onClick: again(() => { const r = gpRec(); r.bestScore = 0; r.bestCombo = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('ghostRush', {
    reset() { GP.phase = 'intro'; GP.pause = false; GP.ghosts = []; }, phase: () => (GP.phase === 'play' ? 'play' : 'idle'),
    enter() { gpBuildDom(); GP.phase = 'intro'; GP.paying = false; GP.pause = false; GP.ghosts = []; GP.fx = []; GP.pops = []; GP.banner = null; setMessage('', C.cyan); },
    update: gpUpdate, draw: gpDraw, hint: 'ゴーストを タップ！金色と大きいのを ねらえ',
    pointer: gpPointer, pointerUp() {}
  });
  GAME_TYPES.ghostRush.canLeave = () => GP.phase !== 'play';
  GAME_TYPES.ghostRush.beforeLeave = () => gpLeaveMid();
  GAME_TYPES.ghostRush.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });
