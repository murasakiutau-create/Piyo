'use strict';
  // =====================================================================
  //  🎱 NINE BREAK（ナインブレイク）：7F VIDEO CORNER　ひとり用ナインボール（CPUなし・時間制限なし）
  //   ¥100（MONEYのみ）。PLAY ¥100 をおしたときに 支払い。1〜9番の玉を、小さい番号から ねらって、9番を落とせばクリア。少ない SHOT 数を目指す。
  //   物理は すべて「位置・速度・角度」だけで決まる（ひみつの乱数補正なし）。玉の並びだけ ゲームごとに 軽くランダム。調整値は CONFIG.nineBreak
  // =====================================================================
  const NKC = CONFIG.nineBreak;
  const NK_MACHINE = { machineId: 'nk_ninebreak', machineName: 'NINE BREAK', label: 'NINE BREAK', isUnlocked: true, gameType: 'nineBreak', nk: true };
  const NK = { phase: 'intro', sub: 'aim', t: 0, clock: 0, acc: 0, balls: [], tips: [], pocketing: [], popups: [], coll: [], shots: 0, target: 1, ang: 0, power: 0.5, hand: false, ptr: null, mode: null, last: null, hold: 0, gt: 0, spin: { x: 0, y: 0 }, shot: null, banner: null, pause: false, paying: false, newRecord: false, result: null, spot9: { x: 0, y: 0 }, clearT: 0, lastClick: 0, lastWall: 0, rolled: 0, dev: { info: false, coll: false, pockets: false, guide: true, kFric: 1, kWall: 1, kGauge: 1, jaw: true, assist: true } };
  const nkRec = () => { const p = P_(); if (!p.nineBreak) p.nineBreak = { v: 1, plays: 0, clears: 0, bestShots: 0 }; const r = p.nineBreak; r.plays = r.plays | 0; r.clears = r.clears | 0; r.bestShots = r.bestShots | 0; return r; };
  const nkG = () => { const F = NKC.felt; const x0 = Math.round(W / 2 - F.w / 2); return { x0, y0: F.y, x1: x0 + F.w, y1: F.y + F.h, cx: x0 + F.w / 2, ym: F.y + F.h / 2, r: NKC.r }; };
  const nkPockets = () => { const g = nkG(); const c = NKC.pocket; return [{ x: g.x0 - c.cOut, y: g.y0 - c.cOut, cap: c.cornerCap }, { x: g.x1 + c.cOut, y: g.y0 - c.cOut, cap: c.cornerCap }, { x: g.x0 - c.cOut, y: g.y1 + c.cOut, cap: c.cornerCap }, { x: g.x1 + c.cOut, y: g.y1 + c.cOut, cap: c.cornerCap }, { x: g.x0 - c.sOut, y: g.ym, cap: c.sideCap }, { x: g.x1 + c.sOut, y: g.ym, cap: c.sideCap }]; };
  const NK_COL = ['#f4f4f4', '#f2c200', '#1f48c8', '#d62a2a', '#7a34b0', '#ee7020', '#1a9a44', '#8a2020', '#1c1c1c', '#f2c200'];
  const nkBall = (id) => NK.balls[id];
  const nkSpeed = (b) => Math.hypot(b.vx, b.vy);
  // ---- ラック・配置 ----
  function nkRackSlots() {
    const g = nkG(); const dx = 2 * g.r + 0.3; const dy = dx * 0.866; const fy = g.y0 + NKC.footY * (g.y1 - g.y0); const rows = [[0], [-0.5, 0.5], [-1, 0, 1], [-0.5, 0.5], [0]]; const out = [];
    rows.forEach((row, k) => row.forEach((o) => out.push({ x: g.cx + o * dx, y: fy - k * dy })));
    return out;                                                                                                              // 0＝先頭（1番）／4＝まんなか（9番）
  }
  function nkNewRack() {
    const g = nkG(); const sl = nkRackSlots(); const others = [1, 2, 3, 5, 6, 7, 8]; const nums = [2, 3, 4, 5, 6, 7, 8];
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = nums[i]; nums[i] = nums[j]; nums[j] = t; }
    NK.balls = []; NK.balls[0] = { id: 0, x: g.cx, y: g.y0 + NKC.headY * (g.y1 - g.y0), vx: 0, vy: 0, on: true, walls: 0, top: 0, side: 0, ts: 0 };
    const put = (id, s) => { NK.balls[id] = { id, x: s.x, y: s.y, vx: 0, vy: 0, on: true, walls: 0 }; };
    put(1, sl[0]); put(9, sl[4]); others.forEach((si, i) => put(nums[i], sl[si])); NK.spot9 = { x: sl[4].x, y: sl[4].y };
    NK.pocketing = []; NK.popups = []; NK.coll = []; NK.shot = null; NK.target = 1; NK.hand = false; nkAutoAim();
  }
  function nkTarget() { for (let i = 1; i <= 9; i++) if (NK.balls[i].on) return i; return 9; }
  function nkAutoAim() { const c = NK.balls[0]; const t = NK.balls[nkTarget()]; NK.ang = Math.atan2(t.x - c.x, -(t.y - c.y)); }
  function nkFree(x, y, skip) {
    const g = nkG(); const r = g.r; if (x < g.x0 + r || x > g.x1 - r || y < g.y0 + r || y > g.y1 - r) return false;
    for (const p of nkPockets()) if (Math.hypot(p.x - x, p.y - y) < p.cap + 1.5) return false;
    for (const b of NK.balls) if (b && b.on && b.id !== skip && Math.hypot(b.x - x, b.y - y) < 2 * r + 0.3) return false; return true;
  }
  function nkNearestFree(x, y, skip) {
    if (nkFree(x, y, skip)) return { x, y }; const g = nkG();
    for (let rad = 2; rad < 200; rad += 2) { let best = null; let bd = 1e9; for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; const px = x + Math.cos(a) * rad; const py = y + Math.sin(a) * rad; if (nkFree(px, py, skip)) { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x: px, y: py }; } } } if (best) return best; }
    return { x: g.cx, y: g.y0 + NKC.headY * (g.y1 - g.y0) };
  }
  // ---- 物理（固定ステップ。位置・速度・角度だけで決まる）----
  function nkSound(kind, v) {
    const now = performance.now();
    if (kind === 'click') { if (now - NK.lastClick < 45) return; NK.lastClick = now; const k = Math.min(1, v / 300); beep(1400 + k * 700, 0, 0.03, 0.02 + 0.05 * k, 'square', 900); noise(0.015, 0.012 + 0.03 * k); }
    else if (kind === 'wall') { if (now - NK.lastWall < 60) return; NK.lastWall = now; const k = Math.min(1, v / 300); beep(190, 0, 0.05, 0.02 + 0.05 * k, 'triangle', 120); }
  }
  function nkOnHit(a, c, vr) {
    const S = NK.shot; if (S && S.first === null && (a.id === 0 || c.id === 0)) S.first = a.id === 0 ? c.id : a.id;
    nkSound('click', vr); if (NK.dev.coll) { NK.coll.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, t: 0 }); if (NK.coll.length > 40) NK.coll.shift(); }
  }
  function nkBounce(b, nx, ny, jaw) {                                                                                       // 入射角・速度・接線方向（と 手玉の横回転）を見て反射（ランダムなし）。(nx,ny)＝テーブル内向きの法線
    const vn = b.vx * nx + b.vy * ny; if (vn >= 0) return 0; const tx = -ny; const ty = nx; const vt = b.vx * tx + b.vy * ty; const k = Math.min(1, -vn / NKC.vmax); const P = NKC.pocket;
    let e = jaw ? P.eJaw + (P.eJawFast - P.eJaw) * k : NKC.eWall + (NKC.eWallFast - NKC.eWall) * k; if (!jaw) e *= NK.dev.kWall; e = Math.max(0.05, Math.min(0.98, e));
    const u = (!jaw && b.id === 0 && b.side) ? b.side * Math.exp(-NKC.spin.tauS * b.ts) : 0;                                   // 横回転の表面速度（px/s）。右を撞くと 反時計まわり
    const slip = vt - u; const dvt = Math.min(Math.abs(slip) * NKC.wallStick, NKC.wallMu * (1 + e) * -vn) * Math.sign(slip); const nvn = -vn * e; const nvt = vt - dvt; b.vx = nvn * nx + nvt * tx; b.vy = nvn * ny + nvt * ty;
    if (u && !jaw) b.side *= NKC.spin.sideKeep; return -vn;
  }
  function nkJawTips(g) {
    const C = NKC.pocket; const a = C.cornerGap; const s = C.sideGap; return [[g.x0, g.y0 + a], [g.x0 + a, g.y0], [g.x1, g.y0 + a], [g.x1 - a, g.y0], [g.x0, g.y1 - a], [g.x0 + a, g.y1], [g.x1, g.y1 - a], [g.x1 - a, g.y1], [g.x0, g.ym - s], [g.x0, g.ym + s], [g.x1, g.ym - s], [g.x1, g.ym + s]];
  }
  function nkWalls(b, g) {
    const C = NKC.pocket; const r = g.r; let hit = 0;
    const gapV = (y) => y < g.y0 + C.cornerGap || y > g.y1 - C.cornerGap || Math.abs(y - g.ym) < C.sideGap; const gapH = (x) => x < g.x0 + C.cornerGap || x > g.x1 - C.cornerGap;
    if (b.x < g.x0 + r && b.vx < 0 && !gapV(b.y)) { b.x = g.x0 + r; hit = nkBounce(b, 1, 0); }
    else if (b.x > g.x1 - r && b.vx > 0 && !gapV(b.y)) { b.x = g.x1 - r; hit = nkBounce(b, -1, 0); }
    if (b.y < g.y0 + r && b.vy < 0 && !gapH(b.x)) { b.y = g.y0 + r; hit = Math.max(hit, nkBounce(b, 0, 1)); }
    else if (b.y > g.y1 - r && b.vy > 0 && !gapH(b.x)) { b.y = g.y1 - r; hit = Math.max(hit, nkBounce(b, 0, -1)); }
    if (hit > 0) { b.walls++; nkSound('wall', hit); }
    if (NK.dev.jaw) for (const t of NK.tips) {                                                                                  // pocket jaw（クッションの先端）：丸い点として 玉と ぶつかる
      const dx = b.x - t[0]; const dy = b.y - t[1]; const d2 = dx * dx + dy * dy; const R = r + C.jawR + C.jawFastR * Math.max(0, Math.min(1, (nkSpeed(b) - C.fastV) / (NKC.vmax - C.fastV))); if (d2 >= R * R || d2 === 0) continue; const d = Math.sqrt(d2); const nx = dx / d; const ny = dy / d; b.x = t[0] + nx * R; b.y = t[1] + ny * R;
      const v = nkBounce(b, nx, ny, true); if (v > 30) nkSound('wall', v);
    }
  }
  function nkPocketed(b, p) {
    b.on = false; b.vx = 0; b.vy = 0; const S = NK.shot; if (S) S.pocketed.push({ id: b.id, walls: b.walls, order: S.pocketed.length });
    NK.pocketing.push({ id: b.id, x: b.x, y: b.y, px: p.x, py: p.y, t: 0 }); const n = NK.popups.length;
    if (b.id !== 0) NK.popups.push({ text: b.id + ' POCKET!', x: Math.max(40, Math.min(W - 40, p.x)), y: p.y + (p.y < nkG().ym ? 12 : -14) - (n % 3) * 9, t: 0, id: b.id }); else NK.popups.push({ text: 'SCRATCH', x: Math.max(40, Math.min(W - 40, p.x)), y: p.y + (p.y < nkG().ym ? 12 : -14), t: 0, id: 0 });
    beep(260, 0, 0.05, 0.06, 'triangle', 170); beep(180, 0.06, 0.07, 0.06, 'triangle', 120);
  }
  function nkStep(h) {
    const g = nkG(); const r = g.r; const B = NK.balls; const C = NKC; const PC = C.pocket; const pk = nkPockets(); NK.tips = nkJawTips(g);
    for (const b of B) { if (!b.on) continue; b.x += b.vx * h; b.y += b.vy * h; if (b.id === 0) b.ts += h; nkWalls(b, g); }
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (!a.on) continue;
      for (let j = i + 1; j < B.length; j++) {
        const c = B[j]; if (!c.on) continue; const dx = c.x - a.x; const dy = c.y - a.y; const d2 = dx * dx + dy * dy; if (d2 >= 4 * r * r || d2 === 0) continue;
        const d = Math.sqrt(d2); const nx = dx / d; const ny = dy / d; const ov = 2 * r - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; c.x += nx * ov / 2; c.y += ny * ov / 2;
        const vr = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny; if (vr > 0) {
          const cq = a.id === 0 ? a : c.id === 0 ? c : null; const pvx = cq ? cq.vx : 0; const pvy = cq ? cq.vy : 0; const j2 = (1 + C.eBall) * vr / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny; nkOnHit(a, c, vr);
          if (cq && cq.top) { const kk = cq.top * Math.exp(-C.spin.tauV * cq.ts) * (cq.top > 0 ? C.spin.follow : C.spin.draw); cq.vx += pvx * kk; cq.vy += pvy * kk; cq.top = 0; }                 // 押し球・引き球：的球にぶつかった後、手玉が 進んでいた向きへ（または うしろへ）
          if (cq && cq.side) cq.side *= 0.7;
        }      // 法線方向だけを やりとり：正面なら的球へ速度が移り、薄ければ 手玉は 接線方向へ流れる
      }
    }
    for (const b of B) {
      if (!b.on) continue; let sp = nkSpeed(b); let taken = null; const outside = b.x < g.x0 || b.x > g.x1 || b.y < g.y0 || b.y > g.y1; const k = Math.max(0, Math.min(1, (sp - PC.fastV) / (C.vmax - PC.fastV)));
      let best = null; let bd = 1e9; for (const p of pk) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = p; } }
      const p = best; const d = bd; const align = sp > 0 ? (b.vx * (p.x - b.x) + b.vy * (p.y - b.y)) / (sp * (d || 1)) : 1; const need = sp < PC.slowSp ? -2 : PC.entryMin + PC.entryFast * k;       // ポケットへ向かう成分が足りない強い球は、jawに蹴られて戻る
      const capEff = p.cap * (1 - PC.fastShrink * k);
      if (outside) { if (align >= need) taken = p; else { if (b.x < g.x0 && b.vx < 0) { b.x = g.x0 + 0.5; b.vx = -b.vx * PC.eBack; } if (b.x > g.x1 && b.vx > 0) { b.x = g.x1 - 0.5; b.vx = -b.vx * PC.eBack; } if (b.y < g.y0 && b.vy < 0) { b.y = g.y0 + 0.5; b.vy = -b.vy * PC.eBack; } if (b.y > g.y1 && b.vy > 0) { b.y = g.y1 - 0.5; b.vy = -b.vy * PC.eBack; } } }
      else if (d < capEff && align >= need) taken = p;
      else if (NK.dev.assist && d < p.cap * PC.assistR && sp < PC.slowV && align > 0) taken = p;
      if (taken) { nkPocketed(b, taken); continue; }
      if (sp > 0) { sp = nkSpeed(b); const ns = sp - (C.roll + C.drag * sp) * NK.dev.kFric * h; if (ns < C.vStop) { b.vx = 0; b.vy = 0; } else { const q = ns / sp; b.vx *= q; b.vy *= q; } }
    }
    for (const b of B) if (b.on && (b.x < g.x0 - 40 || b.x > g.x1 + 40 || b.y < g.y0 - 40 || b.y > g.y1 + 40)) { b.x = Math.max(g.x0 + r, Math.min(g.x1 - r, b.x)); b.y = Math.max(g.y0 + r, Math.min(g.y1 - r, b.y)); b.vx = 0; b.vy = 0; }       // 安全：万一 遠くへ出た玉は テーブルへ戻す
  }
  const nkMoving = () => NK.balls.some((b) => b.on && (b.vx !== 0 || b.vy !== 0));
  // ---- ショット・ルール判定 ----
  const nkPowerToV = (p) => NKC.vmin + (NKC.vmax - NKC.vmin) * Math.pow(Math.max(0, Math.min(1, p)), NKC.powerCurve);
  function nkShoot(ang, power, sx, sy) {
    if (NK.phase !== 'play' || (NK.sub !== 'aim' && NK.sub !== 'power')) return false; if (ang !== undefined) NK.ang = ang; if (power !== undefined) NK.power = power;
    const c = NK.balls[0]; const v = nkPowerToV(NK.power); c.vx = Math.sin(NK.ang) * v; c.vy = -Math.cos(NK.ang) * v; for (const b of NK.balls) b.walls = 0; if (sx !== undefined) NK.spin = { x: sx, y: sy || 0 };
    const S0 = NK.spin; c.top = S0.y; c.side = -S0.x * NKC.spin.sideV * (0.5 + 0.5 * NK.power); c.ts = 0; NK.lastSpin = { x: S0.x, y: S0.y }; NK.spin = { x: 0, y: 0 };
    NK.shots++; NK.shot = { first: null, pocketed: [], target: nkTarget(), t: 0, n: NK.shots, v, ang: NK.ang }; NK.sub = 'roll'; NK.acc = 0; NK.hand = false; NK.ptr = null; NK.mode = null; NK.hold = 0; NK.last = null;
    noise(0.05, 0.05); beep(520, 0, 0.05, 0.07, 'square', 220); return true;
  }
  function nkResolve() {
    const S = NK.shot; const tgt = S.target; const cueIn = S.pocketed.some((p) => p.id === 0); const foul = cueIn || (S.first !== null && S.first !== tgt);
    const nine = S.pocketed.some((p) => p.id === 9); let objs = S.pocketed.filter((p) => p.id !== 0);
    if (foul && nine) { const b = NK.balls[9]; const q = nkNearestFree(NK.spot9.x, NK.spot9.y, 9); b.x = q.x; b.y = q.y; b.vx = 0; b.vy = 0; b.on = true; objs = objs.filter((p) => p.id !== 9); }       // ファウルで落ちた9番は クリアにならず、もとの位置へ
    if (cueIn) { const c = NK.balls[0]; const g = nkG(); const q = nkNearestFree(g.cx, g.y0 + NKC.headY * (g.y1 - g.y0), 0); c.x = q.x; c.y = q.y; c.vx = 0; c.vy = 0; c.on = true; c.top = 0; c.side = 0; }
    const clear = !foul && nine; const remain = NK.balls.filter((b, i) => i >= 1 && i <= 8 && b.on).length; const n = objs.length; const bank = objs.some((p) => p.walls > 0); const nice = !foul && objs.some((p) => p.id === tgt && p.walls === 0);
    let bn = null; let sub = '';
    if (clear) { bn = { text: 'NINE BREAK!!', col: '#ffe070', sh: '#a0481a' }; if (remain >= NKC.lucky) sub = S.n === 1 ? 'EARLY BREAK!' : 'LUCKY 9!'; }
    else {
      let m = null; if (n >= 4) m = 'MULTI POCKET!'; else if (n === 3) m = 'TRIPLE!'; else if (n === 2) m = 'DOUBLE!'; else if (bank) m = 'BANK SHOT!'; else if (nice) m = 'NICE SHOT!';
      if (foul) { bn = { text: 'FOUL', col: '#ff7a7a', sh: '#3a0a0a' }; sub = cueIn ? 'CUE BALL POCKETED' : 'WRONG BALL FIRST'; }
      else if (m) bn = { text: m, col: n >= 2 ? '#7dfcff' : m === 'BANK SHOT!' ? '#ffb86a' : '#7dff8a', sh: '#0a2a2a' };
    }
    NK.banner = bn ? { text: bn.text, col: bn.col, sh: bn.sh, sub, t: 0, dur: clear ? NKC.clearTime : NKC.bannerTime } : null;
    if (clear) { [784, 988, 1175, 1568, 1976].forEach((f, i) => beep(f, i * 0.09, 0.16, 0.06, 'triangle')); NK.sub = 'clear'; NK.clearT = 0; }
    else { if (foul) { [300, 220, 160].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.06, 'sawtooth')); } else if (nice || bank || n >= 2) [880, 1175, 1568].forEach((f, i) => beep(f, i * 0.06, 0.09, 0.05, 'triangle')); NK.sub = 'aim'; NK.hand = foul; }
    NK.target = nkTarget(); NK.lastResult = { foul, cueIn, first: S.first, pocketed: S.pocketed.map((p) => p.id), clear, text: bn ? bn.text : '' };
    if (!clear) nkAutoAim(); NK.shot = null;
  }
  function nkFinish() {
    const r = nkRec(); NK.newRecord = false; r.clears++; if (r.bestShots === 0 || NK.shots < r.bestShots) { r.bestShots = NK.shots; NK.newRecord = true; }
    NK.result = { shots: NK.shots, best: r.bestShots }; writeSave(); NK.phase = 'result'; NK.t = 0; NK.banner = null; if (NK.newRecord) [988, 1319, 1568, 1976].forEach((f, i) => beep(f, 0.2 + i * 0.09, 0.12, 0.06, 'triangle'));
  }
  function nkInsert() {
    if (NK.paying || NK.phase === 'play') return; if (P_().money < NKC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    NK.paying = true; chargeYen(NKC.price); nkRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); nkStart(); NK.paying = false;
  }
  function nkStart() { nkNewRack(); NK.shots = 0; NK.power = 0.5; NK.banner = null; NK.newRecord = false; NK.result = null; NK.pause = false; NK.ptr = null; NK.mode = null; NK.hold = 0; NK.phase = 'play'; NK.sub = 'aim'; NK.t = 0; NK.rolled = 0; }
  function nkUpdate(dt) {
    NK.clock += dt; dt = Math.min(dt, 0.05); if (NK.pause) return; NK.t += dt;
    for (const q of NK.pocketing) q.t += dt; NK.pocketing = NK.pocketing.filter((q) => q.t < 0.3); for (const q of NK.popups) q.t += dt; NK.popups = NK.popups.filter((q) => q.t < 0.9); for (const q of NK.coll) q.t += dt; if (NK.banner) { NK.banner.t += dt; if (NK.banner.t > NK.banner.dur) NK.banner = null; }
    if (NK.phase !== 'play') return;
    if (NK.sub === 'power') { NK.gt += dt; NK.power = nkGauge(); }
    if (NK.sub === 'aim' && NK.hold && NK.ptr !== null && NK.mode === 'btn') NK.ang += NK.hold * Math.PI / 180 * dt;
    if (NK.sub === 'roll') {
      const S = NK.shot; S.t += dt; NK.acc += dt; const h = 1 / NKC.step; let n = 0; while (NK.acc >= h && n < NKC.maxStepsPerFrame) { nkStep(h); NK.acc -= h; n++; } if (NK.acc > h * NKC.maxStepsPerFrame) NK.acc = 0;
      if (S.t > NKC.maxShotTime) for (const b of NK.balls) { b.vx = 0; b.vy = 0; }                                                // 安全：暴走しても 一定時間で かならず止める
      if (S.t > 0.12 && !nkMoving()) nkResolve();
    } else if (NK.sub === 'clear') { NK.clearT += dt; if (NK.clearT >= NKC.clearTime) nkFinish(); }
  }
  const nkGauge = () => { const ph = (NK.gt * NKC.power.speed * NK.dev.kGauge) % 1; const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2; return Math.max(NKC.power.min, tri); };       // 0→100→0 と往復（時間だけで決まる。ランダムなし）
  function nkShotBtn() {
    if (NK.phase !== 'play' || NK.pause) return;
    if (NK.sub === 'aim') { NK.sub = 'power'; NK.gt = 0; NK.power = nkGauge(); NK.ptr = null; NK.mode = null; NK.hold = 0; beep(880, 0, 0.04, 0.04, 'square'); }
    else if (NK.sub === 'power') { NK.power = nkGauge(); nkShoot(NK.ang, NK.power); }
  }
  // ---- ガイド（最初に当たるところまで。ポケットまでの全軌道は出さない）----
  function nkRay(c, ang) {
    const g = nkG(); const r = g.r; const dx = Math.sin(ang); const dy = -Math.cos(ang); let best = { t: 1e9, kind: 'wall', id: -1 };
    for (const b of NK.balls) { if (!b.on || b.id === 0) continue; const ex = b.x - c.x; const ey = b.y - c.y; const bb = ex * dx + ey * dy; if (bb <= 0) continue; const pp = ex * ex + ey * ey - bb * bb; if (pp > 4 * r * r) continue; const t = bb - Math.sqrt(4 * r * r - pp); if (t < best.t) best = { t, kind: 'ball', id: b.id }; }
    const L = (a, d, lo, hi) => (d > 1e-9 ? (hi - a) / d : d < -1e-9 ? (lo - a) / d : 1e9); const tw = Math.min(L(c.x, dx, g.x0 + r, g.x1 - r), L(c.y, dy, g.y0 + r, g.y1 - r)); if (tw < best.t) best = { t: tw, kind: 'wall', id: -1 };
    best.x = c.x + dx * best.t; best.y = c.y + dy * best.t; best.dx = dx; best.dy = dy; return best;
  }
  // ---- 入力 ----
  const nkAimBtns = () => { const n = 4; const gap = 3; const w = Math.floor((W - 24 - gap * (n - 1)) / n); return [-NKC.aim.fast, -NKC.aim.slow, NKC.aim.slow, NKC.aim.fast].map((v, i) => ({ v, x: 12 + i * (w + gap), y: 290, w, h: 13, i })); };
  const nkSpinGeo = () => ({ cx: 40, cy: 348, R: 20 });
  function nkSetSpin(p) { const G = nkSpinGeo(); let x = (p.x - G.cx) / G.R; let y = (G.cy - p.y) / G.R; const m = Math.hypot(x, y); const mx = NKC.spin.maxR; if (m > mx) { x *= mx / m; y *= mx / m; } if (Math.hypot(x, y) < 0.08) { x = 0; y = 0; } NK.spin = { x, y }; }
  const nkIn = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  function nkPointer(e, p) {
    if (NK.pause) { NK.pause = false; return; } if (NK.phase !== 'play' || NK.ptr !== null) return; const c = NK.balls[0];
    if (NK.sub === 'power') { if (p.y < 289) { NK.sub = 'aim'; beep(400, 0, 0.04, 0.03, 'triangle'); } else if (p.y > 303 && p.y < 330 && p.x > 14) nkShotBtn(); return; }
    if (NK.sub !== 'aim') return;
    const SG = nkSpinGeo(); if (Math.hypot(p.x - SG.cx, p.y - SG.cy) <= SG.R + 4) { NK.ptr = e.pointerId; NK.mode = 'spin'; nkSetSpin(p); beep(1200, 0, 0.02, 0.02, 'square'); try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } return; }
    for (const b of nkAimBtns()) if (nkIn(p, b)) { NK.ptr = e.pointerId; NK.mode = 'btn'; NK.hold = b.v; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } return; }
    if (p.y > 289) return;
    NK.ptr = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    if (NK.hand && Math.hypot(p.x - c.x, p.y - c.y) < 18) { NK.mode = 'cue'; NK.last = { ox: c.x - p.x, oy: c.y - p.y }; } else { NK.mode = 'aim'; NK.last = { x: p.x, y: p.y }; }
  }
  function nkPointerMove(e, p) {
    if (NK.ptr !== e.pointerId || NK.sub !== 'aim') return; const c = NK.balls[0];
    if (NK.mode === 'spin') { nkSetSpin(p); return; }
    if (NK.mode === 'cue') { const g = nkG(); const tx = Math.max(g.x0 + g.r, Math.min(g.x1 - g.r, p.x + NK.last.ox)); const ty = Math.max(g.y0 + g.r, Math.min(g.y1 - g.r, p.y + NK.last.oy)); if (nkFree(tx, ty, 0)) { c.x = tx; c.y = ty; } else if (nkFree(tx, c.y, 0)) c.x = tx; else if (nkFree(c.x, ty, 0)) c.y = ty; return; }
    if (NK.mode === 'aim') {
      const dx = p.x - NK.last.x; const dy = p.y - NK.last.y; NK.last = { x: p.x, y: p.y }; const rx = p.x - dx - c.x; const ry = p.y - dy - c.y; const rr = Math.max(NKC.aim.minRadius, Math.hypot(rx, ry));
      NK.ang += (rx * dy - ry * dx) / (rr * rr) * NKC.aim.orbitGain;                                                           // ゆびが 手玉のまわりを回った分だけ、ねらいが回る（1pxで 大きくジャンプしない）
    }
  }
  function nkPointerUp(e) { if (NK.ptr !== e.pointerId) return; NK.ptr = null; NK.mode = null; NK.hold = 0; NK.last = null; }
  document.addEventListener('visibilitychange', () => { if (document.hidden && NK.phase === 'play') { NK.pause = true; NK.ptr = null; NK.mode = null; NK.hold = 0; } });
  // ---- 描画 ----
  function nkDrawBall(id, x, y, rr, a) {
    const col = NK_COL[id]; ctx.globalAlpha = a === undefined ? 1 : a; ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, rr, 0, 6.2832); ctx.fill();
    ctx.fillStyle = id === 9 ? '#f4f4f4' : col; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.fill();
    if (id === 9) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(x - rr, y - rr * 0.62, rr * 2, rr * 1.24); ctx.restore(); }
    if (rr >= 5) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(Math.round(x - rr * 0.55), Math.round(y - rr * 0.6), 2, 1); }
    if (id > 0 && rr >= 5) { ctx.fillStyle = '#f8f8f8'; ctx.beginPath(); ctx.arc(x, y, rr * 0.56, 0, 6.2832); ctx.fill(); drawTextCenter(String(id), Math.round(x) + (id === 1 ? 0 : 0), Math.round(y) - 2, '#111', 1); }
    ctx.globalAlpha = 1;
  }
  function nkDrawTable() {
    const g = nkG(); const R = NKC.felt.rail; rect(0, 0, W, H, '#07140d'); for (let y = 0; y < H; y += 2) rect(0, y, W, 1, mixHex('#0c2416', '#040c08', y / H)); drawFrame();
    rect(g.x0 - R, g.y0 - R, g.x1 - g.x0 + 2 * R, g.y1 - g.y0 + 2 * R, '#4a2a12'); rect(g.x0 - R, g.y0 - R, g.x1 - g.x0 + 2 * R, 2, '#7a4a22'); rect(g.x0 - R, g.y0 - R, 2, g.y1 - g.y0 + 2 * R, '#6a3a1a'); rect(g.x0 - R + 1, g.y1 + R - 2, g.x1 - g.x0 + 2 * R - 1, 2, '#2a1608');
    rect(g.x0 - 3, g.y0 - 3, g.x1 - g.x0 + 6, g.y1 - g.y0 + 6, '#0e5a34'); rect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, '#1b8050'); rect(g.x0, g.y0, g.x1 - g.x0, 1, '#13663f');
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; const hy = Math.round(g.y0 + NKC.headY * (g.y1 - g.y0)); for (let x = g.x0 + 2; x < g.x1; x += 5) ctx.fillRect(x, hy + 9, 2, 1); const sl = nkRackSlots(); ctx.fillRect(Math.round(sl[0].x) - 1, Math.round(sl[0].y) + 11, 2, 2);
    for (const t of nkJawTips(g)) { ctx.fillStyle = '#c8a060'; ctx.beginPath(); ctx.arc(t[0], t[1], NKC.pocket.jawR + 0.6, 0, 6.2832); ctx.fill(); }
    for (const p of nkPockets()) { ctx.fillStyle = '#05080a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.cap - 0.5, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.cap - 0.5, 0, 6.2832); ctx.stroke(); }
  }
  function nkDrawBalls() {
    for (const b of NK.balls) if (b && b.on) nkDrawBall(b.id, b.x, b.y, NKC.r, 1);
    for (const q of NK.pocketing) { const k = q.t / 0.3; nkDrawBall(q.id, q.x + (q.px - q.x) * k, q.y + (q.py - q.y) * k, NKC.r * (1 - 0.75 * k), 1 - k); }
  }
  function nkDrawGuide() {
    const c = NK.balls[0]; const g = nkG(); const r = nkRay(c, NK.ang); const n = Math.floor(r.t / 4);
    for (let i = 1; i <= n; i++) { const t = i * 4; if (t < r.t) { ctx.fillStyle = i % 2 ? '#ffffff' : '#bfe8ff'; ctx.fillRect(Math.round(c.x + r.dx * t) - 0, Math.round(c.y + r.dy * t) - 0, 1, 1); ctx.fillRect(Math.round(c.x + r.dx * t), Math.round(c.y + r.dy * t) + (Math.abs(r.dx) > 0.7 ? 1 : 0), 1, 1); } }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r.x, r.y, g.r, 0, 6.2832); ctx.stroke();
    if (r.kind === 'ball') {
      const b = NK.balls[r.id]; let nx = b.x - r.x; let ny = b.y - r.y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; const L = NKC.guideLen; const dot = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
      for (let t = g.r + 2; t < L + g.r; t += 3) dot(b.x + nx * t, b.y + ny * t, '#ffe070');
      let tx = r.dx - (r.dx * nx + r.dy * ny) * nx; let ty = r.dy - (r.dx * nx + r.dy * ny) * ny; const tl = Math.hypot(tx, ty); if (tl > 0.08) { tx /= tl; ty /= tl; const L2 = Math.min(NKC.guideCue, 3 + tl * NKC.guideCue * 0.6); for (let t = g.r + 2; t < L2 + g.r; t += 3) dot(r.x + tx * t, r.y + ty * t, '#7dfcff'); }
    }
  }
  function nkDrawHud() {
    const rec = nkRec(); drawText('NINE BREAK', 8, 5, '#7affc8', 1); const sh = 'SHOTS ' + NK.shots; drawText(sh, W - 8 - textWidth(sh, 1), 5, '#ffffff', 1);
    drawText('TARGET', 8, 17, '#ffe070', 1); nkDrawBall(NK.phase === 'play' ? nkTarget() : 1, 56, 20, 6, 1); const be = 'BEST ' + (rec.bestShots || '---'); drawText(be, W - 8 - textWidth(be, 1), 17, '#ffe070', 1);
    for (let i = 1; i <= 9; i++) { const b = NK.balls[i]; const on = b && b.on; const x = Math.round(W / 2 - 45 + (i - 1) * 11 + 5); ctx.globalAlpha = on ? 1 : 0.28; ctx.fillStyle = on ? NK_COL[i] : '#334'; ctx.beginPath(); ctx.arc(x, 35, 4, 0, 6.2832); ctx.fill(); if (i === 9 && on) { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 4, 33, 8, 1); ctx.fillRect(x - 3, 37, 6, 1); } ctx.globalAlpha = 1; drawTextCenter(String(i), x, 33, on ? '#fff' : '#889', 1); }
  }
  function nkTri(x, y, w, h, dir, col) { ctx.fillStyle = col; ctx.beginPath(); if (dir < 0) { ctx.moveTo(x + w, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x + w, y + h); } else { ctx.moveTo(x, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x, y + h); } ctx.closePath(); ctx.fill(); }
  function nkDrawPanel() {
    rect(0, 288, W, H - 288, '#06100a'); rect(0, 288, W, 1, '#1a4a30'); const on = NK.sub === 'aim';
    for (const b of nkAimBtns()) { const held = NK.mode === 'btn' && NK.hold === b.v; rect(b.x, b.y, b.w, b.h, held ? '#3ab87a' : '#16402a'); rect(b.x, b.y, b.w, 1, '#4ad890'); const dir = b.v < 0 ? -1 : 1; const n = Math.abs(b.v) > 10 ? 2 : 1; const cx = b.x + b.w / 2 - (n === 2 ? 5 : 2.5); for (let k = 0; k < n; k++) nkTri(cx + k * 6 + (dir < 0 ? 0 : 0), b.y + 2.5, 5, 8, dir, on ? '#e8fff0' : '#5a7a68'); }
    const gx = 22; const gw = W - 44; const gy = 313; const pw = NK.sub === 'power' ? Math.round(NK.power * 100) : 0; drawText('POWER', 12, 305, '#7affc8', 1); const txt = NK.sub === 'power' ? String(pw) : 'PRESS SHOT'; drawText(txt, W - 12 - textWidth(txt, 1), 305, NK.sub === 'power' ? '#ffffff' : '#7a9a88', 1);
    rect(gx, gy, gw, 10, '#0a1a12'); rect(gx, gy, gw, 1, '#2a6a48'); for (let i = 0; i <= 4; i++) rect(gx + Math.round(gw * i / 4) - (i === 4 ? 1 : 0), gy + 11, 1, 3, '#3a7a58');
    if (NK.sub === 'power') { rect(gx, gy, Math.round(gw * NK.power), 10, mixHex('#3aa860', '#ff7a4a', NK.power)); const hx = Math.round(gx + gw * NK.power); rect(hx - 2, gy - 3, 4, 16, '#ffffff'); rect(hx - 1, gy - 2, 2, 14, '#c8d8d0'); }
  }
  function nkDrawSpin() {
    const G = nkSpinGeo(); const on = NK.sub === 'aim'; ctx.fillStyle = '#0a1a12'; ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R + 2, 0, 6.2832); ctx.fill(); ctx.fillStyle = on ? '#f4f4f4' : '#a8b0ac'; ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(G.cx - 12, G.cy - 15, 5, 2); ctx.strokeStyle = 'rgba(80,100,90,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(G.cx - G.R + 3, G.cy + 0.5); ctx.lineTo(G.cx + G.R - 3, G.cy + 0.5); ctx.moveTo(G.cx + 0.5, G.cy - G.R + 3); ctx.lineTo(G.cx + 0.5, G.cy + G.R - 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,100,90,0.45)'; ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R * NKC.spin.maxR, 0, 6.2832); ctx.stroke();
    const dx = G.cx + NK.spin.x * G.R; const dy = G.cy - NK.spin.y * G.R; ctx.fillStyle = '#e02a2a'; ctx.beginPath(); ctx.arc(dx, dy, 3, 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#601010'; ctx.beginPath(); ctx.arc(dx, dy, 3, 0, 6.2832); ctx.stroke();
    drawTextCenter('SPIN', G.cx, 371, on ? '#7affc8' : '#5a7a68', 1);
  }
  function nkDrawPlay() {
    nkDrawTable(); nkDrawHud(); const g = nkG(); const aim = (NK.sub === 'aim' || NK.sub === 'power') && !NK.pause;
    if (aim && NK.dev.guide) nkDrawGuide(); nkDrawBalls();
    if (aim) { const c = NK.balls[0]; if (NK.hand) { ctx.strokeStyle = NK.mode === 'cue' ? '#ffffff' : '#ffe070'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c.x, c.y, g.r + 3, 0, 6.2832); ctx.stroke(); rect(g.cx - 40, g.y0 + 3, 80, 10, 'rgba(2,10,6,0.7)'); drawTextCenter('DRAG CUE BALL', g.cx, g.y0 + 6, '#ffe070', 1); }
      if (NK.spin.x || NK.spin.y) { ctx.fillStyle = '#e02a2a'; ctx.beginPath(); ctx.arc(c.x + NK.spin.x * g.r * 0.62, c.y - NK.spin.y * g.r * 0.62, 1.4, 0, 6.2832); ctx.fill(); }
      const dx = Math.sin(NK.ang); const dy = -Math.cos(NK.ang); ctx.save(); ctx.beginPath(); ctx.rect(g.x0 - NKC.felt.rail, g.y0 - NKC.felt.rail, g.x1 - g.x0 + 2 * NKC.felt.rail, g.y1 - g.y0 + 2 * NKC.felt.rail); ctx.clip(); ctx.fillStyle = '#f4d078'; for (let t = g.r + 4; t < g.r + 36; t += 1) ctx.fillRect(Math.round(c.x - dx * t), Math.round(c.y - dy * t), 1, 1); ctx.fillStyle = '#7a5a2a'; for (let t = g.r + 36; t < g.r + 52; t += 1) ctx.fillRect(Math.round(c.x - dx * t), Math.round(c.y - dy * t), 1, 1); ctx.restore(); }                       // キュー（手玉のうしろ）
    for (const q of NK.popups) { const a = Math.min(1, (0.9 - q.t) * 3); ctx.globalAlpha = a; const w = textWidth(q.text, 1) + 6; rect(Math.round(q.x - w / 2), Math.round(q.y - q.t * 8) - 2, w, 10, 'rgba(2,10,6,0.78)'); drawTextCenter(q.text, q.x, Math.round(q.y - q.t * 8), q.id === 0 ? '#ff7a7a' : '#ffe070', 1); ctx.globalAlpha = 1; }
    if (NK.dev.coll) for (const q of NK.coll) { ctx.strokeStyle = '#ff00ff'; ctx.beginPath(); ctx.arc(q.x, q.y, 3 + q.t * 10, 0, 6.2832); ctx.stroke(); }
    if (NK.dev.pockets) { ctx.strokeStyle = '#00ff88'; for (const p of nkPockets()) { ctx.beginPath(); ctx.arc(p.x, p.y, p.cap, 0, 6.2832); ctx.stroke(); ctx.strokeStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(p.x, p.y, p.cap * NKC.pocket.assistR, 0, 6.2832); ctx.stroke(); ctx.strokeStyle = '#00ff88'; } }
    if (NK.banner) { const b = NK.banner; const a = Math.min(1, b.t * 8, (b.dur - b.t) * 6); ctx.globalAlpha = Math.max(0, a); const y = g.y0 + 70; rect(g.x0 + 2, y, g.x1 - g.x0 - 4, b.sub ? 34 : 24, 'rgba(2,10,6,0.88)'); rect(g.x0 + 2, y, g.x1 - g.x0 - 4, 1, b.col); drawTextCenter(b.text, g.cx, y + 5, b.col, 2, b.sh); if (b.sub) drawTextCenter(b.sub, g.cx, y + 23, '#ffffff', 1); ctx.globalAlpha = 1; }
    nkDrawPanel(); nkDrawSpin();
    if (NK.pause) { ctx.globalAlpha = 0.7; rect(0, 0, W, H, '#02030a'); ctx.globalAlpha = 1; drawTextCenter('PAUSE', W / 2, 150, '#ffffff', 3, '#20a8c8'); drawTextCenter('TAP TO RESUME', W / 2, 190, '#ffffff', 1); }
    if (DEV_MODE && NK.dev.info) nkDrawDev();
  }
  function nkDrawDev() {
    const c = NK.balls[0]; const mv = NK.balls.filter((b) => b && b.on).reduce((m, b) => Math.max(m, nkSpeed(b)), 0); const L = ['ANG ' + (NK.ang * 180 / Math.PI).toFixed(1), 'GAUGE ' + NK.power.toFixed(2) + ' V ' + Math.round(nkPowerToV(NK.power)), 'MAXV ' + Math.round(mv) + ' CUE ' + Math.round(nkSpeed(c)), 'SPIN ' + NK.spin.x.toFixed(2) + ',' + NK.spin.y.toFixed(2) + ' TOP ' + c.top.toFixed(2) + ' SIDE ' + Math.round(c.side || 0), 'FIRST ' + (NK.shot ? NK.shot.first : '-') + ' T ' + (NK.shot ? NK.shot.t.toFixed(1) : '-')];
    rect(g0(), 44, 78, L.length * 9 + 3, 'rgba(0,0,0,0.6)'); L.forEach((s, i) => drawText(s, g0() + 2, 46 + i * 9, '#00ff88', 1));
  }
  const g0 = () => nkG().x0 + 2;
  function nkDrawIntro() {
    nkDrawTable(); const g = nkG(); for (const b of NK.balls) if (b && b.on) nkDrawBall(b.id, b.x, b.y, NKC.r, 1); ctx.globalAlpha = 0.8; rect(0, 0, W, H, '#02060a'); ctx.globalAlpha = 1;
    drawTextCenter('NINE', W / 2, 16, '#7affc8', 4, '#0a4a2a'); drawTextCenter('BREAK', W / 2, 42, '#ffe070', 4, '#a0481a'); nkDrawBall(9, W / 2, 80, 12, 1);
    drawTextCenter('YEN ' + P_().money, W / 2, 106, '#a8b8ff', 1); const r = nkRec(); drawTextCenter('BEST SHOTS ' + (r.bestShots || '---'), W / 2, 118, '#ffe070', 1);
    drawTextCenter('1 PLAY  YEN ' + NKC.price, W / 2, 302, '#a8b8ff', 1);
  }
  function nkDrawResult() {
    nkDrawTable(); ctx.globalAlpha = 0.82; rect(0, 0, W, H, '#02060a'); ctx.globalAlpha = 1; const r = NK.result; if (!r) return;
    drawTextCenter('RESULT', W / 2, 30, '#ffffff', 3, '#0a4a2a'); drawTextCenter('NINE BREAK!', W / 2, 62, '#ffe070', 2, '#a0481a'); nkDrawBall(9, W / 2, 96, 12, 1);
    drawTextCenter('SHOTS', W / 2, 122, '#7affc8', 1); drawTextCenter(String(r.shots), W / 2, 134, '#ffffff', 4, '#0a4a2a'); drawTextCenter('BEST', W / 2, 164, '#7affc8', 1); drawTextCenter(String(r.best), W / 2, 176, '#ffe070', 3, '#a0481a');
    if (NK.newRecord) drawTextCenter('* NEW RECORD! *', W / 2, 208, '#7dff8a', 2, '#0a3a1a'); drawTextCenter('YEN ' + P_().money, W / 2, 232, '#a8b8ff', 1);
  }
  const NK_DOM = {};
  function nkBuildDom() {
    if (NK_DOM.play) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); NK_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('nk-play', 'PLAY　¥' + NKC.price, 'hb-go', nkInsert); mk('nk-retry', 'もういちど　¥' + NKC.price, 'hb-go', () => { NK.phase = 'intro'; nkInsert(); });
    mk('nk-shot', 'SHOT', 'td-go', () => { /* 実際の処理は pointerdown（タイミングゲージを すぐ止めるため）。キーボードの click は detail=0 */ });
    NK_DOM.shot.addEventListener('pointerdown', (e) => { e.preventDefault(); ensureAudio(); nkShotBtn(); }); NK_DOM.shot.addEventListener('click', (e) => { if (e.detail === 0) nkShotBtn(); });
    const say = document.createElement('div'); say.className = 'nk-say'; say.id = 'nk-say'; say.innerHTML = '小さい番号から ねらおう！<br>9番を落とせばクリア！<br>少ない SHOT 数を目指そう！<br><span class="nk-dim">ドラッグでねらう／SPINで うちどころを えらぶ<br>SHOT→ゲージを とめて うつ</span>'; screenEl.appendChild(say); NK_DOM.say = say;
  }
  function nkUi() {
    nkBuildDom(); const ph = NK.phase; const show = (k, on) => NK_DOM[k].classList.toggle('is-show', !!on);
    show('play', ph === 'intro'); show('say', ph === 'intro'); show('retry', ph === 'result'); show('shot', ph === 'play'); const shotOn = ph === 'play' && (NK.sub === 'aim' || NK.sub === 'power') && !NK.pause; NK_DOM.shot.classList.toggle('is-off', !shotOn); const lab = NK.sub === 'power' ? 'STOP!' : 'SHOT'; if (NK_DOM.shot.textContent !== lab) NK_DOM.shot.textContent = lab;
    crPlace(NK_DOM.play, { x: 24, y: 318, w: W - 48, h: 34 }); crPlace(NK_DOM.say, { x: 14, y: 150, w: W - 28, h: 92 }); crPlace(NK_DOM.retry, { x: 20, y: 262, w: W - 40, h: 34 }); crPlace(NK_DOM.shot, { x: 70, y: 332, w: W - 84, h: 28 });
    for (const k of ['play', 'retry', 'shot']) NK_DOM[k].style.fontSize = Math.max(10, parseFloat(NK_DOM[k].style.fontSize) * 0.95) + 'px'; NK_DOM.say.style.fontSize = Math.max(10, parseFloat(NK_DOM.say.style.fontSize) * 0.92) + 'px';
  }
  function nkHide() { if (!NK_DOM.play) return; Object.keys(NK_DOM).forEach((k) => NK_DOM[k].classList.remove('is-show')); }
  function nkDraw() { const ph = NK.phase; if (ph === 'intro') nkDrawIntro(); else if (ph === 'result') nkDrawResult(); else nkDrawPlay(); nkUi(); }
  function nkLeaveMid() {
    if (NK.phase !== 'play') return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ・BESTも きろくされないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { NK.phase = 'intro'; NK.pause = false; NK.ptr = null; NK.mode = null; NK.shot = null; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function openNkDev() {
    const again = (f) => () => { f(); setTimeout(openNkDev, 0); }; const D = NK.dev; const play = () => NK.phase === 'play';
    showDialog({ title: 'NINE BREAK DEV', wide: true, lines: [{ text: 'PHASE ' + NK.phase + '.' + NK.sub + ' / SHOTS ' + NK.shots + ' / TARGET ' + nkTarget() + ' / ゲージ×' + D.kGauge + ' jaw ' + (D.jaw ? 'ON' : 'OFF') + ' 補助 ' + (D.assist ? 'ON' : 'OFF') + ' 抵抗×' + D.kFric + ' 反発×' + D.kWall + ' / ガイド ' + (D.guide ? 'ON' : 'OFF') + ' / 数値 ' + (D.info ? 'ON' : 'OFF') + ' / 衝突 ' + (D.coll ? 'ON' : 'OFF') + ' / ポケット範囲 ' + (D.pockets ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'ゲーム即開始（料金なし）', onClick: () => { nkStart(); } },
      { label: 'ラックをリセット', onClick: () => { if (play()) { nkNewRack(); NK.sub = 'aim'; NK.banner = null; } } },
      { label: '強制ポケット：いちばん小さい番号', onClick: again(() => { if (play() && NK.sub === 'aim') { const b = NK.balls[nkTarget()]; NK.shot = { first: null, pocketed: [], target: nkTarget(), t: 0, n: NK.shots + 1 }; nkPocketed(b, nkPockets()[1]); NK.sub = 'roll'; } }) },
      { label: '強制ポケット：9番', onClick: again(() => { if (play() && NK.sub === 'aim') { const b = NK.balls[9]; NK.shot = { first: nkTarget(), pocketed: [], target: nkTarget(), t: 0, n: NK.shots + 1 }; NK.shots++; nkPocketed(b, nkPockets()[1]); NK.sub = 'roll'; } }) },
      { label: '9番を移動：コーナーの手前 / ラック中央', onClick: again(() => { if (play()) { const b = NK.balls[9]; const g = nkG(); const near = { x: g.x1 - 22, y: g.y0 + 22 }; if (Math.hypot(b.x - near.x, b.y - near.y) < 4) { b.x = NK.spot9.x; b.y = NK.spot9.y; } else { b.x = near.x; b.y = near.y; } b.vx = 0; b.vy = 0; } }) },
      { label: 'POWERゲージ速度：×0.5 / 1 / 1.5 / 2', onClick: again(() => { D.kGauge = D.kGauge === 1 ? 1.5 : D.kGauge === 1.5 ? 2 : D.kGauge === 2 ? 0.5 : 1; }) }, { label: 'pocket jaw ON/OFF', onClick: again(() => { D.jaw = !D.jaw; }) }, { label: 'ポケット吸い込み補助 ON/OFF', onClick: again(() => { D.assist = !D.assist; }) },
      { label: '転がり抵抗：×0.7 / 1 / 1.4', onClick: again(() => { D.kFric = D.kFric === 1 ? 1.4 : D.kFric === 1.4 ? 0.7 : 1; }) }, { label: 'クッション反発：×0.8 / 1 / 1.15', onClick: again(() => { D.kWall = D.kWall === 1 ? 1.15 : D.kWall === 1.15 ? 0.8 : 1; }) },
      { label: '撞点：中央 / 上 / 下 / 左 / 右', onClick: again(() => { const L = [[0, 0], [0, 0.8], [0, -0.8], [-0.8, 0], [0.8, 0]]; let i = L.findIndex((q) => q[0] === NK.spin.x && q[1] === NK.spin.y); i = (i + 1) % L.length; NK.spin = { x: L[i][0], y: L[i][1] }; }) },
      { label: '数値（パワー・角度・速度）表示 ON/OFF', onClick: again(() => { D.info = !D.info; }) }, { label: '衝突の可視化 ON/OFF', onClick: again(() => { D.coll = !D.coll; }) }, { label: 'ポケット範囲の表示 ON/OFF', onClick: again(() => { D.pockets = !D.pockets; }) }, { label: 'ガイドライン ON/OFF', onClick: again(() => { D.guide = !D.guide; }) },
      { label: '結果画面へ（即クリア）', onClick: () => { if (play()) { if (NK.shots < 1) NK.shots = 1; nkFinish(); } } },
      { label: 'BEST 記録 リセット', onClick: again(() => { const r = nkRec(); r.bestShots = 0; r.clears = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('nineBreak', {
    reset() { NK.phase = 'intro'; NK.pause = false; NK.ptr = null; NK.mode = null; }, phase: () => (NK.phase === 'play' ? 'play' : 'idle'),
    enter() { nkBuildDom(); NK.phase = 'intro'; NK.paying = false; NK.pause = false; NK.ptr = null; NK.mode = null; nkNewRack(); setMessage('', C.cyan); },
    update: nkUpdate, draw: nkDraw, hint: 'ねらって SHOT！ゲージを とめよう',
    pointer: nkPointer, pointerUp: nkPointerUp
  });
  GAME_TYPES.nineBreak.pointerMove = nkPointerMove;
  GAME_TYPES.nineBreak.canLeave = () => NK.phase !== 'play';
  GAME_TYPES.nineBreak.beforeLeave = () => nkLeaveMid();
  GAME_TYPES.nineBreak.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });
