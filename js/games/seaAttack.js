'use strict';
  // =====================================================================
  //  🦀 SEA ATTACK（シーアタック）：7F VIDEO CORNER　固定画面シューティング（クラゲ・イカ・カニの隊列）
  //   ¥100（MONEYのみ・MEDAL不使用）／残機3／WAVEエンドレス／ハイスコアのみ保存。ゲームの動きは すべて delta time（端末のFPSに依存しない）
  // =====================================================================
  const SAC = CONFIG.seaAttack;
  const SA_MACHINE = { machineId: 'sa_seaattack', machineName: 'SEA ATTACK', label: 'SEA ATTACK', isUnlocked: true, gameType: 'seaAttack', sa: true };
  const SA_SPR = {
    jelly: [['....#####....', '..#########..', '.###########.', '.###.###.###.', '.###########.', '..#########..', '..#.#.#.#.#..', '..#.#.#.#.#..', '.#..#.#.#..#.', '.............'], ['....#####....', '..#########..', '.###########.', '.###.###.###.', '.###########.', '..#########..', '..#.#.#.#.#..', '.#..#.#.#..#.', '..#.#.#.#.#..', '.#.........#.']],
    squid: [['.....###.....', '....#####....', '...#######...', '..#########..', '..##.###.##..', '..#########..', '...#.#.#.#...', '..#..#.#..#..', '..#.#...#.#..', '.#.#.....#.#.'], ['.....###.....', '....#####....', '...#######...', '..#########..', '..##.###.##..', '..#########..', '...#.#.#.#...', '..#.#...#.#..', '.#..#...#..#.', '#...#...#...#']],
    crab: [['#.#.......#.#', '#.#.#...#.#.#', '###.#####.###', '..#########..', '.###.###.###.', '#############', '#.#########.#', '..#.#...#.#..', '.#..#...#..#.', '#...........#'], ['#...........#', '##.........##', '#.#.#####.#.#', '..#########..', '.###.###.###.', '#############', '#.#########.#', '.#..#...#..#.', '..#.#...#.#..', '.#.........#.']],
    gold: [['......###......', '...#########.#.', '.###########.##', '#######.#####.#', '.###########.##', '...#########.#.', '......###......']],
    cannon: [['......#......', '.....###.....', '.....###.....', '..#########..', '.###########.', '#############', '#############']]
  };
  const SA_COL = { jelly: '#ff8ae8', squid: '#7affc8', crab: '#ff7a3a', gold: '#ffd84a', cannon: '#e8eef8' };
  const SA = { phase: 'select', t: 0, clock: 0, wave: 1, score: 0, lives: 3, best: 0, fleet: null, bullets: [], eb: [], parts: [], pops: [], shields: [], gold: null, goldT: 12, px: 100, ptrs: {}, moveL: false, moveR: false, shotHeld: false, shotT: 0, dieT: 0, inv: 0, stepT: 0, stepI: 0, ef: 0, fireT: 1, pause: false, resumeT: 0, started: false, paying: false, newRecord: false, result: null, sel: 0, msg: '', dev: { god: false, stepMul: 1, fireMul: 1, pbSpeed: 0, ebSpeed: 0, hit: false, shield: true, mode: null }, shake: 0, killed: 0 };
  const saRec = () => { const p = P_(); if (!p.seaAttack) p.seaAttack = { v: 1, bestScore: 0, bestWave: 0, plays: 0 }; const r = p.seaAttack; r.bestScore = r.bestScore | 0; r.bestWave = r.bestWave | 0; r.plays = r.plays | 0; return r; };
  const SAG = { fx0: 12, fx1: 0, cellW: 22, cellH: 16, sw: 13, sh: 10, goldY: 38, shY: 242, plY: 284, line: 262, ctlY: 306 };
  const saShot = () => SA.dev.mode || SAC.shotMode;
  function saSprDraw(rows, x, y, col, flip) { ctx.fillStyle = col; const w = rows[0].length; for (let r = 0; r < rows.length; r++) { const row = rows[r]; let c = 0; while (c < w) { if (row[c] === '#') { let e = c; while (e < w && row[e] === '#') e++; ctx.fillRect(Math.round(x + (flip ? w - e : c)), Math.round(y + r), e - c, 1); c = e; } else c++; } } }
  function saMakeShield(x) {                                                                                             // サンゴ防壁：ピクセルごとに 削れる
    const w = 28; const h = 18; const m = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const cx = xx - (w - 1) / 2; let on = false; if (y < 5) on = Math.abs(cx) < 6 + y * 2.2; else on = Math.abs(cx) < 13.5; if (y >= 13 && Math.abs(cx) < 4.5) on = false;                         // うえが まるい・下に あなのある アーチ
      if (on && ((xx * 7 + y * 13) % 11 === 0) && y < 4) on = false; if (on) m[y * w + xx] = 1 + ((xx * 3 + y * 5) % 7 === 0 ? 1 : 0) + (y > 10 ? 1 : 0);
    }
    return { x, y: SAG.shY, w, h, m, orig: m.slice() };
  }
  const saShieldCol = ['', '#ff7a9a', '#ffb0c0', '#d84a7a'];
  function saCarve(s, wx, wy, r) { let n = 0; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { if (!s.m[y * s.w + x]) continue; const dx = s.x + x + 0.5 - wx; const dy = s.y + y + 0.5 - wy; if (dx * dx + dy * dy < r * r + Math.random() * r * 1.5) { s.m[y * s.w + x] = 0; n++; } } return n; }
  function saShieldAt(px, py) { for (const s of SA.shields) { const x = Math.floor(px - s.x); const y = Math.floor(py - s.y); if (x >= 0 && y >= 0 && x < s.w && y < s.h && s.m[y * s.w + x]) return s; } return null; }
  function saBuildShields() { SA.shields = []; const n = SAC.shield.count; const gap = (W - 24 - n * 28) / (n - 1); for (let i = 0; i < n; i++) SA.shields.push(saMakeShield(Math.round(12 + i * (28 + gap)))); }
  function saRepairShields() {
    const mode = SAC.shield.repair; for (const s of SA.shields) {
      if (mode === 'full' || (mode === 'every' && (SA.wave - 1) % SAC.shield.repairEvery === 0)) { s.m = s.orig.slice(); continue; } if (mode !== 'partial') continue;
      for (let i = 0; i < s.m.length; i++) if (!s.m[i] && s.orig[i] && Math.random() < SAC.shield.repairRatio) s.m[i] = s.orig[i];
    }
  }
  function saNewFleet() {
    const rows = SAC.rows; const cols = SAC.cols; const kinds = ['jelly', 'squid', 'squid', 'crab', 'crab']; const en = []; const total = rows * cols; const fw = (cols - 1) * SAG.cellW + SAG.sw; const fx = Math.round((W - fw) / 2) - 20; const fy = 58 + Math.min(SA.wave - 1, 4) * 4;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) en.push({ r, c, kind: kinds[r % kinds.length], alive: true });
    SA.fleet = { x: Math.max(14, fx), y: fy, dir: 1, en, total, alive: total }; SA.stepT = 0; SA.stepI = 0; SA.ef = 0; SA.fireT = saFireInterval();
  }
  const saEnPos = (e) => ({ x: SA.fleet.x + e.c * SAG.cellW, y: SA.fleet.y + e.r * SAG.cellH });
  function saStepInterval() { const f = SA.fleet; const t = f.total > 1 ? (f.alive - 1) / (f.total - 1) : 0; const base = Math.max(SAC.minWaveBase, SAC.baseStep - SAC.waveStepUp * (SA.wave - 1)); const mn = SAC.minStep; return Math.max(0.045, (mn + (base - mn) * Math.pow(t, 1.15)) / SA.dev.stepMul); }
  function saFireInterval() { const base = Math.max(SAC.fire.min, SAC.fire.base - SAC.fire.perWave * (SA.wave - 1)); return base * (0.7 + Math.random() * 0.6) / SA.dev.fireMul; }
  const saEbSpeed = () => SA.dev.ebSpeed || Math.min(SAC.ebullet.max, SAC.ebullet.base + SAC.ebullet.perWave * (SA.wave - 1));
  const saMaxEb = () => Math.min(SAC.maxEb.max, SAC.maxEb.base + Math.floor((SA.wave - 1) / 2));
  function saInsert() {                                                                                                  // GAME START を押した時点で ¥100（連打しても1回）
    if (SA.paying || (SA.phase !== 'select' && SA.phase !== 'result')) return; if (P_().money < SAC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    SA.paying = true; chargeYen(SAC.price); saRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); saStart(1); SA.paying = false;
  }
  function saStart(wave) { SA.wave = wave; SA.score = 0; SA.lives = SAC.lives; SA.killed = 0; SA.newRecord = false; SA.result = null; SA.bullets = []; SA.eb = []; SA.parts = []; SA.pops = []; SA.gold = null; SA.goldT = SAC.gold.minGap * 0.7 + Math.random() * 5; SA.px = W / 2; SA.pause = false; SA.ptrs = {}; saBuildShields(); saNewFleet(); SA.phase = 'intro'; SA.t = 0; SA.inv = 0; }
  function saFinish() { const r = saRec(); SA.newRecord = SA.score > r.bestScore; if (SA.newRecord) r.bestScore = SA.score; if (SA.wave > r.bestWave) r.bestWave = SA.wave; SA.result = { score: SA.score, wave: SA.wave, best: r.bestScore }; writeSave(); SA.phase = 'result'; SA.t = 0; }
  function saGameOver(why) { if (SA.phase === 'over' || SA.phase === 'result') return; SA.phase = 'over'; SA.t = 0; SA.why = why; [392, 330, 262, 196].forEach((f, i) => beep(f, i * 0.14, 0.2, 0.06, 'sine')); }
  function saPopScore(x, y, txt, col) { SA.pops.push({ x, y, t: 0.8, txt, col: col || '#ffffff' }); }
  function saBoom(x, y, col, n) { for (let i = 0; i < (n || 8); i++) { if (SA.parts.length > 120) break; const a = Math.random() * 6.28; const sp = 20 + Math.random() * 50; SA.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.25 + Math.random() * 0.15, col, s: 2 }); } }
  function saFire() { if (SA.phase !== 'play' || SA.pause) return false; if (SA.bullets.length >= SAC.maxBullets) return false; SA.bullets.push({ x: SA.px, y: SAG.plY - 4 }); beep(1300, 0, 0.07, 0.05, 'square', 420); return true; }
  const saRect = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const saEnBox = (e) => { const p = saEnPos(e); return { x: p.x + 1, y: p.y + 1, w: SAG.sw - 2, h: SAG.sh - 2 }; };
  function saFleetStep() {
    const f = SA.fleet; const alive = f.en.filter((e) => e.alive); if (!alive.length) return; let mn = 1e9; let mx = -1e9; for (const e of alive) { const x = f.x + e.c * SAG.cellW; mn = Math.min(mn, x); mx = Math.max(mx, x + SAG.sw); }
    const dx = SAC.stepDx * f.dir; if ((f.dir > 0 && mx + dx > W - 12) || (f.dir < 0 && mn + dx < 12)) { f.y += SAC.stepDown + Math.min(3, Math.floor((SA.wave - 1) / 4)); f.dir = -f.dir; } else f.x += dx;
    SA.ef ^= 1; const tones = [98, 87, 78, 73]; beep(tones[SA.stepI++ % 4], 0, 0.06, 0.07, 'square');                    // ドン…ドン…（敵が へるほど 間隔が みじかくなる）
    for (const e of alive) { const b = saEnBox(e); for (const s of SA.shields) if (b.y + b.h > s.y && b.y < s.y + s.h && b.x + b.w > s.x && b.x < s.x + s.w) saCarve(s, b.x + b.w / 2, b.y + b.h, 7); }
  }
  function saPickShooter() { const f = SA.fleet; const lows = {}; for (const e of f.en) if (e.alive && (!lows[e.c] || e.r > lows[e.c].r)) lows[e.c] = e; const arr = Object.values(lows); if (!arr.length) return null; const near = arr.filter((e) => Math.abs(saEnPos(e).x + 6 - SA.px) < 50); const pool = near.length && Math.random() < 0.55 ? near : arr; return pool[Math.floor(Math.random() * pool.length)]; }
  function saKill(e) {
    e.alive = false; SA.fleet.alive--; SA.killed++; const p = saEnPos(e); const sc = SAC.score[e.kind]; SA.score += sc; saBoom(p.x + 6, p.y + 5, SA_COL[e.kind], 7); beep(220, 0, 0.1, 0.07, 'square', 60); noise(0.05, 0.05);
  }
  function saHitPlayer() { if (SA.dev.god || SA.inv > 0 || SA.phase !== 'play') return; SA.lives--; SA.phase = 'die'; SA.dieT = 0; SA.t = 0; saBoom(SA.px, SAG.plY, '#ffffff', 16); saBoom(SA.px, SAG.plY, '#ff7a3a', 10); SA.shake = 0.25; noise(0.3, 0.09); beep(180, 0, 0.35, 0.08, 'sawtooth', 40); SA.eb = []; SA.bullets = []; }
  function saUpdate(dt) {
    SA.clock += dt; SA.sel += dt; dt = Math.min(dt, 0.05); if (SA.pause) { if (SA.resumeT > 0 && !document.hidden) { SA.resumeT -= dt; if (SA.resumeT <= 0) SA.pause = false; } return; }
    SA.t += dt; if (SA.shake > 0) SA.shake -= dt; for (const p of SA.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; } SA.parts = SA.parts.filter((p) => p.t < p.life); for (const q of SA.pops) { q.t -= dt; q.y -= 10 * dt; } SA.pops = SA.pops.filter((q) => q.t > 0);
    const ph = SA.phase; if (ph === 'select' || ph === 'result') return;
    if (ph === 'intro') { if (SA.t >= 1.4) { SA.phase = 'play'; SA.t = 0; } return; }
    if (ph === 'clear') { if (SA.t >= 1.7) { SA.wave++; saRepairShields(); saNewFleet(); SA.bullets = []; SA.eb = []; SA.phase = 'intro'; SA.t = 0; } return; }
    if (ph === 'over') { if (SA.t >= 2.2) saFinish(); return; }
    if (ph === 'die') { if (SA.t >= 1.3) { if (SA.lives <= 0) saGameOver('lives'); else { SA.phase = 'play'; SA.t = 0; SA.inv = SAC.invuln; SA.px = W / 2; } } return; }
    // ---- play ----
    const dir = (SA.moveR ? 1 : 0) - (SA.moveL ? 1 : 0); SA.px = Math.max(16, Math.min(W - 16, SA.px + dir * SAC.playerSpeed * dt)); if (SA.inv > 0) SA.inv -= dt;
    if (saShot() === 'auto' && SA.shotHeld) { SA.shotT -= dt; if (SA.shotT <= 0) { if (saFire()) SA.shotT = SAC.autoInterval; else SA.shotT = 0.03; } }
    const f = SA.fleet; SA.stepT += dt; const iv = saStepInterval(); while (SA.stepT >= iv && f.alive > 0) { SA.stepT -= iv; saFleetStep(); }
    // 侵略ライン
    for (const e of f.en) if (e.alive && saEnPos(e).y + SAG.sh >= SAG.line) { saGameOver('invade'); return; }
    // 敵弾
    SA.fireT -= dt; if (SA.fireT <= 0) { SA.fireT = saFireInterval(); if (SA.eb.length < saMaxEb()) { const e = saPickShooter(); if (e) { const p = saEnPos(e); SA.eb.push({ x: p.x + 6, y: p.y + SAG.sh, k: Math.floor(Math.random() * 2) }); beep(330, 0, 0.05, 0.03, 'triangle', 200); } } }
    const eSp = saEbSpeed(); const pb = SA.dev.pbSpeed || SAC.pbulletSpeed;
    for (const b of SA.bullets) { let rem = pb * dt; while (rem > 0 && !b.dead) { const st = Math.min(2, rem); b.y -= st; rem -= st; if (SAC.shield.enabled && SAC.shield.playerHits && SA.dev.shield) { const s = saShieldAt(b.x, b.y); if (s) { saCarve(s, b.x, b.y, 2.5); b.dead = true; break; } } if (b.y < 28) { b.dead = true; break; } } }
    for (const b of SA.eb) { let rem = eSp * dt; while (rem > 0 && !b.dead) { const st = Math.min(2, rem); b.y += st; rem -= st; if (SA.dev.shield) { const s = saShieldAt(b.x, b.y + 3); if (s) { saCarve(s, b.x, b.y + 3, 3.2); b.dead = true; break; } } if (b.y > SAG.ctlY - 6) { b.dead = true; break; } } }
    // 当たり：自弾→敵・金魚
    for (const b of SA.bullets) { if (b.dead) continue; const bb = { x: b.x - 1, y: b.y, w: 2, h: 5 }; for (const e of f.en) { if (!e.alive) continue; if (saRect(bb, saEnBox(e))) { saKill(e); b.dead = true; saPopScore(saEnPos(e).x + 6, saEnPos(e).y, '' + SAC.score[e.kind], SA_COL[e.kind]); break; } }
      if (!b.dead && SA.gold && saRect(bb, { x: SA.gold.x + 1, y: SAG.goldY, w: 13, h: 7 })) { const sc = SAC.gold.scores[Math.floor(Math.random() * SAC.gold.scores.length)]; SA.score += sc; saBoom(SA.gold.x + 7, SAG.goldY + 3, '#ffd84a', 12); saPopScore(SA.gold.x + 7, SAG.goldY - 4, '+' + sc, '#ffd84a'); [988, 1319, 1760, 2349].forEach((q, i) => beep(q, i * 0.05, 0.09, 0.06, 'triangle')); SA.gold = null; b.dead = true; } }
    SA.bullets = SA.bullets.filter((b) => !b.dead);
    // 敵弾→自機
    const pbx = { x: SA.px - 4, y: SAG.plY, w: 9, h: 6 }; for (const b of SA.eb) { if (!b.dead && saRect({ x: b.x - 1, y: b.y, w: 2, h: 5 }, pbx)) { b.dead = true; saHitPlayer(); break; } } SA.eb = SA.eb.filter((b) => !b.dead);
    // 金色の魚
    if (SA.gold) { SA.gold.x += SA.gold.dir * SAC.gold.speed * dt; if (SA.gold.x < -20 || SA.gold.x > W + 6) SA.gold = null; } else { SA.goldT -= dt; if (SA.goldT <= 0) { const d = Math.random() < 0.5 ? 1 : -1; SA.gold = { x: d > 0 ? -16 : W + 2, dir: d }; SA.goldT = SAC.gold.minGap + Math.random() * (SAC.gold.maxGap - SAC.gold.minGap); [1568, 1976, 1568, 2349].forEach((q, i) => beep(q, i * 0.07, 0.07, 0.05, 'square')); } }
    if (f.alive <= 0 && SA.phase === 'play') { SA.phase = 'clear'; SA.t = 0; SA.eb = []; SA.bullets = []; [784, 988, 1175, 1568].forEach((q, i) => beep(q, i * 0.1, 0.14, 0.06, 'triangle')); }
  }
  // ---- 入力（マルチタッチ：ひだり・みぎ・SHOT・PAUSE を 同時に）----
  const SA_BTN = () => ({ left: { x: 6, y: SAG.ctlY + 4, w: 56, h: 66 }, shot: { x: 66, y: SAG.ctlY + 4, w: W - 132, h: 66 }, right: { x: W - 62, y: SAG.ctlY + 4, w: 56, h: 66 }, pause: { x: W - 30, y: 27, w: 24, h: 18 } });
  function saRegion(p) { const B = SA_BTN(); if (p.y >= SAG.ctlY - 8) { if (p.x < 64) return 'left'; if (p.x >= W - 64) return 'right'; return 'shot'; } if (inRect(p, { x: B.pause.x - 6, y: B.pause.y - 4, w: B.pause.w + 12, h: B.pause.h + 8 })) return 'pause'; return null; }
  function saRecalc() { let l = false; let r = false; let s = false; for (const k in SA.ptrs) { const g = SA.ptrs[k]; if (g === 'left') l = true; else if (g === 'right') r = true; else if (g === 'shot') s = true; } SA.moveL = l && !r; SA.moveR = r && !l; if (l && r) { SA.moveL = false; SA.moveR = false; } SA.shotHeld = s; }
  function saSetPause(on) { if (!['play', 'intro', 'clear', 'die'].includes(SA.phase)) return; if (on) { SA.pause = true; SA.resumeT = 0; SA.ptrs = {}; saRecalc(); } else { SA.resumeT = 2.4; } }
  function saPointer(e, p) {
    if (SA.pause) { if (SA.resumeT <= 0) saSetPause(false); return; } if (!['play', 'intro', 'die', 'clear'].includes(SA.phase)) return; const g = saRegion(p); if (!g) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    if (g === 'pause') { saSetPause(true); return; } SA.ptrs[e.pointerId] = g; saRecalc(); if (g === 'shot') { if (saShot() === 'manual') saFire(); else { SA.shotT = 0; } }
  }
  function saPointerMove(e, p) { if (SA.ptrs[e.pointerId] === undefined) return; const g = saRegion(p); SA.ptrs[e.pointerId] = g === 'pause' ? null : g; saRecalc(); }
  function saPointerUp(e) { if (SA.ptrs[e.pointerId] !== undefined) { delete SA.ptrs[e.pointerId]; saRecalc(); } }
  window.addEventListener('keydown', (ev) => { if (scene !== 'machine' || !currentMachine || currentMachine.gameType !== 'seaAttack') return; if (ev.key === 'ArrowLeft') { SA.moveL = true; ev.preventDefault(); } else if (ev.key === 'ArrowRight') { SA.moveR = true; ev.preventDefault(); } else if (ev.key === ' ') { if (saShot() === 'manual') saFire(); else SA.shotHeld = true; ev.preventDefault(); } });
  window.addEventListener('keyup', (ev) => { if (ev.key === 'ArrowLeft') SA.moveL = false; else if (ev.key === 'ArrowRight') SA.moveR = false; else if (ev.key === ' ') SA.shotHeld = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ['play', 'intro', 'clear', 'die'].includes(SA.phase)) saSetPause(true); });
  // ---- 描画 ----
  function saDrawBg() { rect(0, 0, W, H, '#020818'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#06214a', '#010510', y / H)); ctx.globalAlpha = 0.5; for (let i = 0; i < 28; i++) { const x = (i * 53) % W; const y = (i * 97 + Math.floor(SA.clock * (6 + i % 5))) % (H - 120) + 30; rect(x, y, 1, 1, '#4a8ad8'); } ctx.globalAlpha = 1; drawFrame(); }
  function saDrawHud() {
    drawText('SCORE', 12, 9, '#7dfcff', 1); drawText(String(SA.score), 12, 18, '#ffffff', 1); drawTextCenter('BEST', W / 2, 9, '#7dfcff', 1); drawTextCenter(String(Math.max(saRec().bestScore, SA.score)), W / 2, 18, '#ffe070', 1); drawText('WAVE', W - 12 - 20, 9, '#7dfcff', 1); drawText(String(SA.wave), W - 12 - textWidth(String(SA.wave), 1) - 0, 18, '#ffffff', 1);
    drawText('LIFE', 12, 27, '#7dfcff', 1); for (let i = 0; i < Math.max(0, SA.lives); i++) saSprDraw(SA_SPR.cannon[0].slice(0, 7), 38 + i * 16, 27, '#e8eef8'); const pb = SA_BTN().pause; rect(pb.x, pb.y, pb.w, pb.h, '#10285a'); rect(pb.x, pb.y, pb.w, 1, '#5a8ae0'); rect(pb.x + 8, pb.y + 5, 3, 10, '#ffffff'); rect(pb.x + 14, pb.y + 5, 3, 10, '#ffffff');
  }
  function saDrawPlay() {
    saDrawBg(); ctx.save(); if (SA.shake > 0) ctx.translate(Math.round(Math.sin(SA.clock * 60) * 1.5), 0); saDrawHud();
    for (const s of SA.shields) for (let y = 0; y < s.h; y++) { let x = 0; while (x < s.w) { const v = s.m[y * s.w + x]; if (v) { let e = x; while (e < s.w && s.m[y * s.w + e] === v) e++; ctx.fillStyle = saShieldCol[v]; ctx.fillRect(s.x + x, s.y + y, e - x, 1); x = e; } else x++; } }
    if (SA.gold) saSprDraw(SA_SPR.gold[0], SA.gold.x, SAG.goldY, SA_COL.gold, SA.gold.dir < 0);
    const f = SA.fleet; for (const e of f.en) { if (!e.alive) continue; const p = saEnPos(e); saSprDraw(SA_SPR[e.kind][SA.ef], p.x, p.y, SA_COL[e.kind]); }
    if (SA.phase !== 'die' && SA.phase !== 'over') { ctx.globalAlpha = SA.inv > 0 ? 0.55 : 1; saSprDraw(SA_SPR.cannon[0], SA.px - 6, SAG.plY - 1, SA_COL.cannon); if (SA.inv > 0) { ctx.strokeStyle = '#7dfcff'; ctx.globalAlpha = 0.6; ctx.strokeRect(Math.round(SA.px - 9) + 0.5, SAG.plY - 4.5, 18, 12); } ctx.globalAlpha = 1; }
    for (const b of SA.bullets) rect(Math.round(b.x) - 1, Math.round(b.y), 2, 5, '#ffffff'); for (const b of SA.eb) { rect(Math.round(b.x) - 1, Math.round(b.y), 2, 5, '#ff8a3a'); rect(Math.round(b.x), Math.round(b.y) + (SA.ef ? 0 : 1), 1, 5, '#ffe070'); }
    for (const p of SA.parts) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    for (const q of SA.pops) { ctx.globalAlpha = Math.min(1, q.t * 2.5); drawTextCenter(q.txt, q.x, q.y, q.col, 1, '#020818'); ctx.globalAlpha = 1; }
    rect(8, SAG.line + 6, W - 16, 1, '#1a3a7a'); ctx.restore();
    // 操作ボタン
    const B = SA_BTN(); const on = (k) => (k === 'left' ? SA.moveL : k === 'right' ? SA.moveR : SA.shotHeld);
    for (const k of ['left', 'shot', 'right']) { const b = B[k]; const d = on(k); rect(b.x, b.y, b.w, b.h, d ? '#2a5ab8' : '#10285a'); rect(b.x, b.y, b.w, 2, d ? '#9ad0ff' : '#4a7ad0'); rect(b.x, b.y + b.h - 2, b.w, 2, '#06122e'); }
    ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.moveTo(B.left.x + 38, B.left.y + 18); ctx.lineTo(B.left.x + 38, B.left.y + 48); ctx.lineTo(B.left.x + 16, B.left.y + 33); ctx.fill(); ctx.beginPath(); ctx.moveTo(B.right.x + 18, B.right.y + 18); ctx.lineTo(B.right.x + 18, B.right.y + 48); ctx.lineTo(B.right.x + 40, B.right.y + 33); ctx.fill(); drawTextCenter('SHOT', B.shot.x + B.shot.w / 2, B.shot.y + 26, '#ffffff', 2, '#1a3a7a');
    const ph = SA.phase; if (ph === 'intro') { rect(0, 150, W, 40, '#020818'); drawTextCenter('WAVE ' + SA.wave, W / 2, 162, '#ffe070', 3, '#a0481a'); }
    if (ph === 'clear') drawTextCenter('WAVE CLEAR', W / 2, 160, '#7dfcff', 2, '#0a4a6a'); if (ph === 'over') { drawTextCenter('GAME OVER', W / 2, 150, '#ff7a7a', 3, '#3a0a0a'); if (SA.why === 'invade') drawTextCenter('THEY REACHED THE LINE', W / 2, 176, '#ffffff', 1); }
    if (SA.pause) { ctx.globalAlpha = 0.7; rect(0, 0, W, H, '#01040e'); ctx.globalAlpha = 1; drawTextCenter('PAUSE', W / 2, 140, '#ffffff', 3, '#20a8c8'); if (SA.resumeT > 0) { drawTextCenter('READY?', W / 2, 180, '#ffe070', 2, '#a0481a'); drawTextCenter(String(Math.max(1, Math.ceil(SA.resumeT / 0.8))), W / 2, 204, '#ffffff', 3, '#20a8c8'); } else drawTextCenter('TAP TO RESUME', W / 2, 190, '#ffffff', 1); }
    if (DEV_MODE && SA.dev.hit) { ctx.strokeStyle = '#00ff88'; for (const e of SA.fleet.en) if (e.alive) { const b = saEnBox(e); ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h); } ctx.strokeRect(SA.px - 3.5, SAG.plY + 0.5, 9, 6); }
  }
  function saDrawSelect() {
    saDrawBg(); rect(14, 34, W - 28, 52, '#010510'); rect(14, 34, W - 28, 2, '#20d8f0'); rect(14, 84, W - 28, 2, '#ff7a3a'); drawTextCenter('SEA', W / 2, 42, '#7dfcff', 3, '#0a4a6a'); drawTextCenter('ATTACK', W / 2, 62, '#ff9a5a', 3, '#6a2a0a');
    const ef = Math.floor(SA.sel * 2) % 2; const kinds = ['jelly', 'squid', 'crab']; kinds.forEach((k, i) => saSprDraw(SA_SPR[k][ef], W / 2 - 52 + i * 34, 110 + Math.sin(SA.sel * 2 + i) * 2, SA_COL[k])); drawTextCenter('30     20     10', W / 2 + 0, 128, '#a8b8ff', 1);
    saSprDraw(SA_SPR.gold[0], 20 + ((SA.sel * 30) % (W - 40)), 150, SA_COL.gold); saSprDraw(SA_SPR.cannon[0], W / 2 - 6, 210 , SA_COL.cannon); for (let i = 0; i < 3; i++) rect(30 + i * 60, 190, 28, 6, '#ff7a9a');
    drawTextCenter('BEST ' + saRec().bestScore + '   WAVE ' + saRec().bestWave, W / 2, 238, '#ffe070', 1); drawTextCenter('1 PLAY  YEN ' + SAC.price + '    YEN ' + P_().money, W / 2, 252, '#a8b8ff', 1); drawTextCenter('< >  MOVE / SHOT', W / 2, 268, '#7dfcff', 1);
  }
  function saDrawResult() {
    saDrawBg(); const r = SA.result; drawTextCenter('SEA ATTACK', W / 2, 40, '#7dfcff', 2, '#0a4a6a'); drawTextCenter('GAME OVER', W / 2, 62, '#ff7a7a', 2, '#3a0a0a');
    const L = (lab, v, y, col) => { drawText(lab, 28, y, '#7dfcff', 1); drawText(String(v), W - 28 - textWidth(String(v), 1), y, col || '#ffffff', 1); }; L('SCORE', r.score, 100); L('WAVE', r.wave, 118); L('BEST SCORE', r.best, 136, '#ffe070'); if (SA.newRecord) drawTextCenter('* NEW RECORD! *', W / 2, 166, '#7dff8a', 2, '#0a3a1a'); drawTextCenter('YEN ' + P_().money, W / 2, 200, '#a8b8ff', 1);
  }
  const SA_DOM = {};
  function saBuildDom() {
    if (SA_DOM.start) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); SA_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('sa-start', 'GAME START　¥' + SAC.price, 'td-go', saInsert); mk('sa-retry', 'もういちど　¥' + SAC.price, 'td-go', saInsert); mk('sa-out', '7Fにもどる', 'hb-sub', () => { SA.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
  }
  function saUi() { saBuildDom(); const ph = SA.phase; const show = (k, on) => SA_DOM[k].classList.toggle('is-show', !!on); show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); crPlace(SA_DOM.start, { x: 24, y: 292, w: W - 48, h: 40 }); crPlace(SA_DOM.retry, { x: 20, y: 236, w: W - 40, h: 34 }); crPlace(SA_DOM.out, { x: 20, y: 278, w: W - 40, h: 28 }); for (const k of ['start', 'retry', 'out']) SA_DOM[k].style.fontSize = Math.max(10, parseFloat(SA_DOM[k].style.fontSize) * 0.95) + 'px'; }
  function saHide() { if (!SA_DOM.start) return; Object.keys(SA_DOM).forEach((k) => SA_DOM[k].classList.remove('is-show')); }
  function saDraw() { const ph = SA.phase; if (ph === 'select') saDrawSelect(); else if (ph === 'result') saDrawResult(); else saDrawPlay(); saUi(); }
  function saLeaveMid() {
    if (['select', 'result'].includes(SA.phase)) return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { SA.phase = 'select'; SA.pause = false; SA.ptrs = {}; saRecalc(); standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function openSaDev() {
    const again = (f) => () => { f(); setTimeout(openSaDev, 0); }; const D = SA.dev;
    showDialog({ title: 'SEA ATTACK DEV', wide: true, lines: [{ text: 'PHASE ' + SA.phase + ' / WAVE ' + SA.wave + ' / 残機 ' + SA.lives + ' / 敵移動×' + D.stepMul + ' / 敵弾頻度×' + D.fireMul + ' / 自弾 ' + (D.pbSpeed || SAC.pbulletSpeed) + ' / 敵弾 ' + (D.ebSpeed || Math.round(saEbSpeed())) + ' / SHOT ' + saShot() + ' / 防壁ダメージ ' + (D.shield ? 'ON' : 'OFF') + ' / 無敵 ' + (D.god ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'WAVE 1', onClick: () => { saStart(1); } }, { label: 'WAVE 3', onClick: () => { saStart(3); } }, { label: 'WAVE 5', onClick: () => { saStart(5); } }, { label: 'WAVE 10', onClick: () => { saStart(10); } }, { label: 'WAVE 20', onClick: () => { saStart(20); } },
      { label: '残機：1 / 3 / 9', onClick: again(() => { SA.lives = SA.lives === 1 ? 3 : SA.lives === 3 ? 9 : 1; }) }, { label: '敵 全滅', onClick: () => { if (SA.fleet) for (const e of SA.fleet.en) if (e.alive) { e.alive = false; SA.fleet.alive--; } } },
      { label: '金色の魚 強制出現', onClick: () => { if (SA.phase === 'play') SA.goldT = 0; } }, { label: '敵移動速度 ×0.5 / ×1 / ×2', onClick: again(() => { D.stepMul = D.stepMul === 1 ? 2 : D.stepMul === 2 ? 0.5 : 1; }) }, { label: '敵弾頻度 ×0.5 / ×1 / ×2', onClick: again(() => { D.fireMul = D.fireMul === 1 ? 2 : D.fireMul === 2 ? 0.5 : 1; }) },
      { label: '自弾速度：標準 / 150 / 400', onClick: again(() => { D.pbSpeed = D.pbSpeed === 0 ? 150 : D.pbSpeed === 150 ? 400 : 0; }) }, { label: '敵弾速度：標準 / 50 / 150', onClick: again(() => { D.ebSpeed = D.ebSpeed === 0 ? 50 : D.ebSpeed === 50 ? 150 : 0; }) },
      { label: 'SHOT：manual / auto 切替', onClick: again(() => { D.mode = saShot() === 'manual' ? 'auto' : 'manual'; }) }, { label: '防壁ダメージ ON/OFF', onClick: again(() => { D.shield = !D.shield; }) }, { label: '当たり判定 表示 ON/OFF', onClick: again(() => { D.hit = !D.hit; }) }, { label: '無敵 ON/OFF', onClick: again(() => { D.god = !D.god; }) },
      { label: 'スコア +1000', onClick: again(() => { SA.score += 1000; }) }, { label: 'BEST SCORE リセット', onClick: again(() => { const r = saRec(); r.bestScore = 0; r.bestWave = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('seaAttack', {
    reset() { SA.phase = 'select'; SA.pause = false; SA.ptrs = {}; saRecalc(); }, phase: () => (['select', 'result'].includes(SA.phase) ? 'idle' : SA.phase),
    enter() { saBuildDom(); SA.phase = 'select'; SA.sel = 0; SA.paying = false; SA.pause = false; SA.ptrs = {}; saRecalc(); SA.parts = []; SA.pops = []; setMessage('', C.cyan); },
    update: saUpdate, draw: saDraw, hint: 'ひだり・みぎ いどう　SHOT で うつ',
    pointer: saPointer, pointerUp: saPointerUp
  });
  GAME_TYPES.seaAttack.pointerMove = saPointerMove;
  GAME_TYPES.seaAttack.canLeave = () => ['select', 'result'].includes(SA.phase);
  GAME_TYPES.seaAttack.beforeLeave = () => saLeaveMid();
  GAME_TYPES.seaAttack.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

