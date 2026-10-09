'use strict';
  // =====================================================================
  //  👹 HYAKKI YAKO（百鬼夜行）：8F　霊銃のレールシューティング。¥100・LIFE5・6発マガジン・RELOAD。調整値は CONFIG.hyakki
  //   STAGE1 宵の町 → 2 妖しの川辺 → 3 天狗の山 → FINAL 百鬼夜行 → BOSS がしゃどくろ（両手の爪10個 → 両目 → 口）
  //   素材：assets/hyakki/*.webp（ユーザー提供の画像をそのまま使用）。猫又だけは画像なし → nekomata.webp を置けば差し替わる
  // =====================================================================
  const HYC = CONFIG.hyakki;
  const HY_MACHINE = { machineId: 'hy_hyakki', machineName: 'HYAKKI YAKO', label: 'HYAKKI YAKO', isUnlocked: true, gameType: 'hyakki', hy: true };
  const HY = { phase: 'intro', t: 0, clock: 0, life: 5, ammo: 6, reloadT: 0, score: 0, combo: 0, maxCombo: 0, shots: 0, hits: 0, stage: 0, step: -1, wait: 1.5, stepT: 0, pend: [], enemies: [], fx: [], pops: [], flash: 0, shake: 0, banner: null, sayUntil: 0, sayHtml: '', mode: 'stage', modeT: 0, lock: 0, uid: 0, paying: false, result: null, boss: null, kills: 0, dev: { god: false } };
  const HY_NAMES = ['hitotsume', 'karakasa', 'chochin', 'kappa', 'nurikabe', 'rokuro_body', 'rokuro_head', 'tengu', 'kitsune', 'kitsune_fake', 'oni_n', 'oni_a', 'onibi', 'gasha_full', 'gasha_ro', 'gasha_na', 'nekomata'];
  const HY_IMG = {}; HY_NAMES.forEach((n) => { const im = new Image(); im.onerror = () => { im.bad = true; }; im.src = 'assets/hyakki/' + n + '.webp'; HY_IMG[n] = im; });
  const hyImg = (n) => { const im = HY_IMG[n]; return im && im.complete && im.naturalWidth ? im : null; };
  const hyRec = () => { const p = P_(); if (!p.hyakki) p.hyakki = { v: 1, plays: 0, bestScore: 0, clears: 0 }; const r = p.hyakki; r.plays = r.plays | 0; r.bestScore = r.bestScore | 0; r.clears = r.clears | 0; return r; };
  const hyRand = (a, b) => a + Math.random() * (b - a);
  const hyAsp = (n, d) => { const im = hyImg(n); return im ? im.naturalWidth / im.naturalHeight : d; };
  const HY_FY0 = 44; const HY_FY1 = 332; const HY_FCY = 188;
  // ---- 開始 ----
  function hyInsert() {
    if (HY.paying || HY.phase === 'play') return; if (P_().money < HYC.playCost) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    HY.paying = true; chargeYen(HYC.playCost); hyRec().plays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); hyStart(); HY.paying = false;
  }
  function hyStart() {
    Object.assign(HY, { phase: 'play', t: 0, life: HYC.maxLife, ammo: HYC.magazineSize, reloadT: 0, score: 0, combo: 0, maxCombo: 0, shots: 0, hits: 0, enemies: [], fx: [], pops: [], flash: 0, shake: 0, banner: null, sayUntil: 0, mode: 'stage', modeT: 0, lock: 0, result: null, boss: null, kills: 0 });
    hyStartStage(0);
  }
  function hyStartStage(i) {
    HY.stage = i; HY.step = -1; { const n = HYC.stages[i].steps.length; const mid = []; for (let q = 2; q < n - 1; q++) mid.push(q); for (let q = mid.length - 1; q > 0; q--) { const r = Math.floor(Math.random() * (q + 1)); const t = mid[q]; mid[q] = mid[r]; mid[r] = t; } HY.order = [0, 1].slice(0, n).concat(mid, n > 2 ? [n - 1] : []); } HY.wait = 2.0; HY.pend = []; const names = ['宵の町', '妖しの川辺', '天狗の山', '百鬼夜行'];
    HY.sayHtml = HYC.stages[i].no + '<br>' + names[i]; HY.sayUntil = HY.clock + 2.0; beep(523, 0, 0.1, 0.05, 'triangle'); beep(784, 0.1, 0.18, 0.05, 'triangle');
  }
  function hyNextStep() {
    const st = HYC.stages[HY.stage]; HY.step++; const stp = st.steps[(HY.order || [])[HY.step] !== undefined ? HY.order[HY.step] : HY.step];
    if (HY.step >= st.steps.length) { if (HY.stage < HYC.stages.length - 1) hyStartStage(HY.stage + 1); else { HY.mode = 'silence'; HY.modeT = 0; HY.wait = 0; } return; }
    const flip = Math.random() < 0.5; const rr = (v) => (Math.random() - 0.5) * 2 * v; HY.pend = stp.s.map((a) => { let k = a[0]; if (Math.random() < 0.3) k = k === 'hitotsume' ? 'karakasa' : k === 'karakasa' ? 'hitotsume' : k; const x = Math.min(0.9, Math.max(0.1, (flip ? 1 - a[1] : a[1]) + rr(0.08))); return { k, x, y: a[2] + (k === 'chochin' || k === 'tengu' ? rr(14) : 0), d: Math.max(0, a[3] + rr(0.2)) }; }); HY.gap = Math.max(0.2, stp.gap + rr(0.2)); HY.wait = HY.gap + HYC.stepGapAdd; HY.stepT = 0;
  }
  // ---- 敵 ----
  function hySpawn(k, xf, y, extra) {
    const d = HYC.enemy[k]; const e = Object.assign({ id: ++HY.uid, k, hp: d.hp, t: 0, x: xf * W, y, x0: xf * W, y0: y, s: 1, st: 'live', dt: 0, warn: false, hurt: 0, atkT: d.atk, flinch: 0, rt: 0, stun: 0, dir: 1, tx: xf * W, ty: y, mv: 0 }, extra || {});
    if (k === 'neko') { e.dir = Math.random() < 0.5 ? 1 : -1; e.x = e.dir > 0 ? -24 : W + 24; } if (k === 'rokuro') { e.hx = e.x; e.hy = y - 76; e.hs = 0.5; }
    HY.enemies.push(e); return e;
  }
  function hyRect(e) {
    const d = HYC.enemy[e.k]; let img = e.k; if (e.k === 'kitsune' && !e.real) img = 'kitsune_fake'; if (e.k === 'oni') img = e.st === 'raise' ? 'oni_a' : 'oni_n'; if (e.k === 'rokuro') { const h = d.h * e.hs; const w = h * hyAsp('rokuro_head', 0.94); return { x0: e.hx - w / 2, y0: e.hy - h / 2, w, h }; }
    const asp = e.k === 'neko' ? hyAsp('nekomata', 1.3) : hyAsp(img, 0.7); const h = d.h * e.s; const w = h * asp; return { x0: e.x - w / 2, y0: e.y - h, w, h };
  }
  function hyUpdEnemy(e, dt) {
    const d = HYC.enemy[e.k]; e.t += dt; e.hurt = Math.max(0, e.hurt - dt); if (e.st === 'dying') { e.dt += dt; return; }
    switch (e.k) {
      case 'hitotsume': e.s = Math.min(1, 0.4 + e.t * 3); e.warn = e.t > d.atk - 0.8; if (e.t >= d.atk) hyAttack(e); break;
      case 'karakasa': { const u = e.t / d.atk; e.s = 0.45 + 0.8 * u; e.x = e.x0 + Math.sin(e.t * 2.6) * 16 * (0.5 + u); e.y = e.y0 + 22 * u - Math.abs(Math.sin(e.t * 5)) * 9 * e.s; e.warn = u > 0.82; if (u >= 1) hyAttack(e); break; }
      case 'chochin': { e.x = e.x0 + Math.sin(e.t * 1.7) * 16; e.y = e.y0 + Math.sin(e.t * 2.2) * 6; const c = e.t % 1.6; if (c > 1.3) e.x += (c - 1.3) / 0.3 * (e.x0 < W / 2 ? 34 : -34) * Math.sin((c - 1.3) / 0.3 * 3.14); e.warn = e.t > d.atk - 0.8; if (e.t >= d.atk) hyAttack(e); break; }
      case 'neko': e.x += e.dir * (W + 60) / 1.7 * dt; e.y = e.y0 + Math.sin(e.t * 9) * 4; if ((e.dir > 0 && e.x > W + 30) || (e.dir < 0 && e.x < -30)) e.st = 'gone'; break;
      case 'kappa': e.s = Math.min(1, 0.5 + e.t * 3); e.y = e.y0 + Math.sin(e.t * 3) * 2; e.warn = e.t > d.atk - 0.8; if (e.t >= d.atk) hyAttack(e); break;
      case 'rokuro': { const u = Math.min(1, e.t / d.atk); const e2 = u * u * (3 - 2 * u) * 0.5 + u * 0.5; e.hx = e.x0 + (W / 2 + Math.sin(e.t * 2) * 16 - e.x0) * e2; e.hy = (e.y0 - 76) + (205 - (e.y0 - 76)) * e2; e.hs = 0.5 + 1.5 * e2; e.warn = u > 0.8; if (u >= 1) hyAttack(e); break; }
      case 'nurikabe': e.s = Math.min(1, 0.7 + e.t * 0.6); e.warn = e.t > d.atk - 1.2; if (e.t >= d.atk) hyAttack(e); break;
      case 'tengu': { e.s = Math.min(1, 0.5 + e.t * 3); const hold = e.t > d.atk - 1.0; e.warn = hold; e.mv -= dt; if (!hold && e.mv <= 0) { e.mv = 1.0; e.tx = hyRand(0.18, 0.82) * W; e.ty = hyRand(165, 240); } if (!hold) { const k = 1 - Math.exp(-dt * 9); e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; } if (e.t >= d.atk) hyAttack(e); break; }
      case 'kitsune': e.s = Math.min(1, 0.5 + e.t * 3); e.y = e.y0 + Math.sin(e.t * 2 + (e.fakeIx || 0)) * 2; if (e.real) { e.warn = e.t > d.atk - 1.0; if (e.t >= d.atk) hyAttack(e); } break;
      case 'oni': {
        e.s = e.st === 'walk' || e.st === 'live' ? Math.min(1, 0.8 + e.t * 0.1) : e.s; if (e.st === 'live') e.st = 'walk';
        if (e.st === 'walk') { e.rt += dt; if (e.rt >= HYC.oniWalk) { e.st = 'raise'; e.rt = 0; e.flinch = 0; beep(180, 0, 0.3, 0.06, 'sawtooth', 120); } } else if (e.st === 'raise') { e.rt += dt; e.warn = true; if (e.rt >= HYC.oniRaise) { hyDamage(); e.st = 'walk'; e.rt = 0; e.warn = false; } } else if (e.st === 'stun') { e.rt += dt; e.warn = false; if (e.rt >= 0.9) { e.st = 'walk'; e.rt = -1.0; } }
        break;
      }
    }
  }
  function hyAttack(e) { e.st = 'gone'; hyDamage(); hyBurst(e.x, e.y - 20, '#ff5a5a', 8); }
  function hyDamage() {
    if (HY.dev.god) return; HY.life--; HY.flash = 1; HY.shake = 1; beep(150, 0, 0.25, 0.08, 'sawtooth', 70); noise(0.18, 0.06); hyPop(W / 2, 90, 'DAMAGE!', '#ff7a7a', 2);
    if (HY.life <= 0) hyFinish(false);
  }
  const hyPop = (x, y, text, col, sc) => { HY.pops.push({ x, y, text, col: col || '#fff', sc: sc || 1, t: 0 }); };
  function hyBurst(x, y, col, n, life) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; const v = hyRand(30, 80); HY.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, t: 0, life: life || 0.5, col }); } }
  // ---- 射撃 ----
  function hyPointer(e, p) {
    if (HY.phase !== 'play' || HY.lock > 0 || p.y < HY_FY0 - 4 || p.y > HY_FY1 + 2) return; hyShoot(p);
  }
  function hyShoot(p) {
    if (HY.reloadT > 0) return; if (HY.ammo <= 0) { beep(2400, 0, 0.02, 0.05, 'square'); beep(1500, 0.05, 0.03, 0.05, 'square'); hyPop(p.x, p.y - 8, 'EMPTY', '#c8c8d8', 1); return; }
    HY.ammo--; HY.shots++; beep(900, 0, 0.05, 0.05, 'square', 260); noise(0.04, 0.03); HY.fx.push({ ring: true, x: p.x, y: p.y, t: 0, life: 0.16, col: '#fff6c0' });
    const hit = HY.mode === 'boss' ? hyBossShoot(p) : hyShootEnemies(p);
    if (!hit) { if (HY.mode !== 'boss') { HY.combo = 0; beep(160, 0.02, 0.08, 0.04, 'sawtooth', 110); hyPop(p.x, p.y - 8, 'MISS', '#9a8ab8', 1); } }
  }
  function hyTest(e, p) {
    if (e.st === 'dying' || e.st === 'gone') return null; const r = hyRect(e); const pad = HYC.hitPad + (e.k === 'neko' ? 5 : 0); const mx = r.w * 0.1; const my = r.h * 0.05;
    if (e.k === 'rokuro') { const bh = 76; const bw = bh * hyAsp('rokuro_body', 0.6); if (p.x >= e.x0 - bw / 2 - pad && p.x <= e.x0 + bw / 2 + pad && p.y >= e.y0 - bh - pad && p.y <= e.y0 + pad) return 'body'; }
    if (p.x < r.x0 + mx - pad || p.x > r.x0 + r.w - mx + pad || p.y < r.y0 + my - pad || p.y > r.y0 + r.h - my + pad) return null;
    if (e.k === 'kappa' && p.y < r.y0 + r.h * 0.22 && p.x > r.x0 + r.w * 0.12 && p.x < r.x0 + r.w * 0.88) return 'dish';
    if (e.k === 'oni' && e.st === 'raise' && p.x < r.x0 + r.w * 0.46 && p.y < r.y0 + r.h * 0.5) return 'arm'; return 'body';
  }
  function hyShootEnemies(p) {
    const list = HY.enemies.slice().sort((a, b) => b.y - a.y); for (const e of list) { const part = hyTest(e, p); if (part) { hyHit(e, part, p); return true; } } return false;
  }
  function hyHit(e, part, p) {
    const d = HYC.enemy[e.k]; HY.hits++; e.hurt = 0.12;
    if (e.k === 'kitsune' && !e.real) { e.st = 'dying'; e.dt = 0; HY.combo = 0; hyBurst(e.x, e.y - 20, '#9ad8ff', 6); hyPop(e.x, e.y - 40, 'FAKE', '#9ad8ff', 1); beep(300, 0, 0.1, 0.05, 'triangle', 200); return; }
    HY.combo++; HY.maxCombo = Math.max(HY.maxCombo, HY.combo); let dmg = 1; let bonus = 0;
    if (e.k === 'kappa' && part === 'dish') { dmg = e.hp; bonus = HYC.weakBonus; hyPop(e.x, e.y - d.h - 4, 'WEAK!', '#7dfcff', 2); }
    if (e.k === 'oni' && part === 'arm') { e.flinch++; if (e.flinch >= HYC.oniFlinchHits) { e.st = 'stun'; e.rt = 0; e.flinch = 0; hyPop(e.x, e.y - d.h, 'CANCEL!', '#7dfcff', 2); beep(400, 0, 0.2, 0.06, 'square', 800); } }
    e.hp -= dmg; beep(1200, 0, 0.05, 0.06, 'square', 1500); hyBurst(p.x, p.y, '#fff6c0', 5, 0.3);
    if (e.hp <= 0) {
      e.st = 'dying'; e.dt = 0; HY.kills++; let sc = d.sc + bonus; if (e.k === 'neko') hyPop(e.x, e.y - 30, 'BONUS!', '#ffe070', 2); if (e.k === 'kitsune') for (const o of HY.enemies) if (o.grp === e.grp && o !== e) { o.st = 'dying'; o.dt = 0; }
      if (HY.combo % HYC.comboEvery === 0) { sc += HYC.comboBonus; hyPop(W / 2, 74, HY.combo + ' COMBO!', '#7dfcff', 1); } HY.score += sc; hyBurst(e.x, e.y - d.h / 2, '#d8c8ff', 10, 0.6); hyBurst(e.x, e.y - d.h / 2, '#ffffff', 5, 0.4); beep(660, 0, 0.08, 0.06, 'triangle', 990); hyPop(e.x, e.y - d.h - 8, '+' + sc, '#ffffff', 1);
    } else { HY.score += 20; }
  }
  function hyReload() { if (HY.phase !== 'play' || HY.reloadT > 0 || HY.ammo >= HYC.magazineSize || HY.lock > 0) return; HY.reloadT = HYC.reloadTime; HY.rl = true; beep(500, 0, 0.06, 0.05, 'square'); beep(700, 0.15, 0.06, 0.05, 'square'); HY.reloads = (HY.reloads | 0) + 1; }
  // ---- 更新 ----
  function hyUpdate(dt) {
    dt = Math.min(dt, 0.05); HY.clock += dt; HY.t += dt; if (HY.phase !== 'play') return; HY.modeT += dt; HY.lock = Math.max(0, HY.lock - dt); HY.flash = Math.max(0, HY.flash - dt * 2.2); HY.shake = Math.max(0, HY.shake - dt * 3);
    if (HY.reloadT > 0) { HY.reloadT -= dt; if (HY.reloadT <= 0) { HY.reloadT = 0; HY.ammo = HYC.magazineSize; beep(1000, 0, 0.06, 0.05, 'square'); } }
    for (const q of HY.pops) q.t += dt; HY.pops = HY.pops.filter((q) => q.t < 0.9); for (const f of HY.fx) { f.t += dt; if (!f.ring) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.up ? -20 : 90) * dt; } } HY.fx = HY.fx.filter((f) => f.t < f.life); if (HY.banner) { HY.banner.t += dt; if (HY.banner.t > HY.banner.dur) HY.banner = null; }
    if (HY.mode === 'stage') {
      for (const e of HY.enemies) hyUpdEnemy(e, dt); HY.enemies = HY.enemies.filter((e) => e.st !== 'gone' && !(e.st === 'dying' && e.dt > 0.4));
      if (HY.pend.length) { for (const p of HY.pend) p.d -= dt; const now = HY.pend.filter((p) => p.d <= 0); HY.pend = HY.pend.filter((p) => p.d > 0); for (const p of now) { if (p.k === 'kitsune') { const real = (Math.random() * 3) | 0; const grp = ++HY.uid + 1000; [-0.28, 0, 0.28].forEach((o, i) => hySpawn('kitsune', Math.max(0.17, Math.min(0.83, p.x + o)), p.y, { real: i === real, grp, fakeIx: i })); } else hySpawn(p.k, p.x, p.y); } }
      else if (!HY.enemies.length) { if (HY.wait > 0) { HY.wait -= dt; } else hyNextStep(); }
    } else if (HY.mode === 'silence') {
      if (HY.modeT > 2.2 && !HY.rum) { HY.rum = true; HY.shake = 1; beep(60, 0, 1.2, 0.08, 'sawtooth', 40); noise(0.6, 0.04); } if (HY.modeT > 3.4) { HY.sil = false; HY.rum = false; hyBossStart(); }
    } else if (HY.mode === 'boss') hyBossUpdate(dt);
  }
  // ---- ボス：がしゃどくろ ----
  const HYB_L = [[280, 1022], [140, 962], [200, 803], [362, 682], [497, 818]]; const HYB_R = [[973, 873], [1093, 927], [850, 1000], [1043, 1150], [1157, 1080]];
  function hyBossStart() {
    HY.mode = 'boss'; HY.modeT = 0; HY.enemies = []; const G = HYC.gashadokuro; const fires = [];
    HYB_L.slice(0, G.clawCount).forEach((t, i) => fires.push({ kind: 'claw', side: 0, ix: t[0], iy: t[1] - 40, r: 36, fh: 120, alive: true, hp: G.clawHP, t: 0, id: i, on: false }));
    HYB_R.slice(0, G.clawCount).forEach((t, i) => fires.push({ kind: 'claw', side: 1, ix: t[0], iy: t[1] - 40, r: 36, fh: 120, alive: true, hp: G.clawHP, t: 0, id: 10 + i, on: false }));
    fires.push({ kind: 'eye', side: 0, ix: 560, iy: 338, r: 48, fh: 170, alive: true, hp: G.eyeHP, t: 0, id: 20, on: false }, { kind: 'eye', side: 1, ix: 748, iy: 330, r: 48, fh: 170, alive: true, hp: G.eyeHP, t: 0, id: 21, on: false }, { kind: 'mouth', ix: 650, iy: 528, r: 82, fh: 300, alive: true, hp: G.mouthHP, t: 0, id: 30, on: false });
    HY.boss = { state: 'INTRO', t: 0, base: 'gasha_full', cam: { cx: 656, cy: 700, s: W / 1312 }, ox: 0, oy: 300, vis: 0, lunge: 0, atkT: 0, fires, pieces: [], mouthHits: 0, mouthMiss: 0, mouthReloads0: 0, dark: 0, hand: 0, freeze: 0, spirits: [] };
    HY.lock = 2.6; beep(70, 0, 1.6, 0.09, 'sawtooth', 40); noise(0.5, 0.05);
  }
  function hyBossGo(state) { const B = HY.boss; B.state = state; B.t = 0; B.atkT = 0; HY.lock = Math.max(HY.lock, HYC.phaseTransitionTime); HY.reloadT = 0; HY.ammo = Math.max(HY.ammo, 0); }
  function hyBossTarget(B) {
    const s = B.state; if (s === 'INTRO') return { cx: 656, cy: 700, s: W / 1312 * 0.98 }; if (s === 'CLAW_L' || s === 'ARM_BREAK_L') return { cx: 300, cy: 810, s: W / 620 }; if (s === 'CLAW_R' || s === 'ARM_BREAK_R') return { cx: 1012, cy: 810, s: W / 620 };
    if (s === 'EYE_PHASE' || s === 'EYE_BREAK') return { cx: 655, cy: 390, s: W / 560 }; if (s === 'DEFEAT') return { cx: 656, cy: 620, s: W / 1312 * 0.95 }; return { cx: 650, cy: 450, s: W / 430 };
  }
  const hyAlive = (B, kind, side) => B.fires.filter((f) => f.kind === kind && f.alive && (side === undefined || f.side === side));
  function hyBossUpdate(dt) {
    const B = HY.boss; B.t += dt; const T = hyBossTarget(B); const k = 1 - Math.exp(-dt * (B.state === 'INTRO' ? 1.2 : 2.6)); B.cam.cx += (T.cx - B.cam.cx) * k; B.cam.cy += (T.cy - B.cam.cy) * k; B.cam.s += (T.s - B.cam.s) * k;
    const claw = B.state === 'CLAW_L' || B.state === 'CLAW_R'; const eye = B.state === 'EYE_PHASE'; const mouth = B.state === 'MOUTH_PHASE'; const c = HY.clock;
    B.ox = Math.sin(c * 0.9) * (claw ? 22 : 12); B.oy = (B.state === 'INTRO' ? Math.max(0, 300 - B.t * 140) : 0) + Math.sin(c * 0.7) * (claw ? 14 : 8); if (B.state === 'INTRO') B.vis = Math.min(1, B.t * 0.8);
    for (const f of B.fires) { f.t += dt; } B.dark += ((B.state === 'EYE_BREAK' ? (B.t < 1.1 ? 0.8 : 0.0) : 0) - B.dark) * (1 - Math.exp(-dt * 5)); HY.shake = Math.max(HY.shake, B.state === 'INTRO' ? 0.4 : 0);
    for (const q of B.pieces) { q.t += dt; q.vy += 700 * dt; q.y += q.vy * dt; q.rot += q.vr * dt; } B.pieces = B.pieces.filter((q) => q.y < 900); for (const q of B.spirits) { q.t += dt; q.y -= 30 * dt; q.x += Math.sin(q.t * 2 + q.ph) * 8 * dt; } B.spirits = B.spirits.filter((q) => q.t < 4);
    const G = HYC.gashadokuro; const attack = (delay) => { B.atkT += dt; const w = Math.max(0, (B.atkT - (delay - 1.8)) / 1.8); B.warnL = Math.min(1, w); B.lunge = B.atkT < delay ? w * w : Math.max(0, B.lunge - dt * 3); if (B.atkT >= delay) { B.atkT = 0; B.warnL = 0; hyDamage(); HY.shake = 1; hyPop(W / 2, 100, B.state === 'MOUTH_PHASE' ? 'BLAST!' : 'GRAB!', '#ff7a7a', 3); } };
    switch (B.state) {
      case 'INTRO': if (B.t > 2.6) { hyBossGo('CLAW_L'); for (const f of B.fires) if (f.kind === 'claw' && f.side === 0) { f.on = true; f.t = 0; } } break;
      case 'CLAW_L': attack(G.clawAttackDelay); break; case 'CLAW_R': attack(G.clawAttackDelay); break;
      case 'ARM_BREAK_L': B.lunge = Math.max(0, B.lunge - dt * 3); if (B.t > 2.2) { hyBossGo('CLAW_R'); for (const f of B.fires) if (f.kind === 'claw' && f.side === 1) { f.on = true; f.t = 0; } } break;
      case 'ARM_BREAK_R': B.lunge = Math.max(0, B.lunge - dt * 3); if (B.t > 2.2) { hyBossGo('EYE_PHASE'); for (const f of B.fires) if (f.kind === 'eye') { f.on = true; f.t = 0; } B.hand = 0; } break;
      case 'EYE_PHASE': attack(G.eyeAttackDelay); break;
      case 'EYE_BREAK': B.lunge = Math.max(0, B.lunge - dt * 3); if (B.t > 2.4) { hyBossGo('MOUTH_PHASE'); const m = B.fires.find((f) => f.kind === 'mouth'); m.on = true; m.t = 0; B.mouthReloads0 = HY.reloads | 0; B.mouthMiss = 0; } break;
      case 'MOUTH_PHASE': if (!B.minis) { const mo = B.fires.find((f) => f.kind === 'mouth'); if (mo && mo.alive && mo.t > G.miniDelay) { B.minis = true; [0, 1].forEach((sd) => B.fires.push({ kind: 'mini', side: sd, ix: 650, iy: 528, r: 30, fh: 120, alive: true, hp: G.miniHP, t: 0, id: 40 + sd, on: true })); hyBurst(W / 2, 200, '#ff4a2a', 14, 0.8); beep(300, 0, 0.3, 0.07, 'sawtooth', 700); hyPop(W / 2, 110, 'BUNRETSU!', '#ff9a6a', 1); } } if (B.freeze <= 0) attack(G.mouthAttackDelay); break;
      case 'DEFEAT': hyDefeatUpdate(B, dt); break;
    }
  }
  function hyDefeatUpdate(B, dt) {
    B.lunge = 0; if (B.t > 0.7 && !B.boom) { B.boom = true; HY.flash = 0; B.whiteT = 0.5; HY.shake = 1; beep(90, 0, 0.9, 0.1, 'sawtooth', 30); noise(0.5, 0.08); [880, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.2, 0.05, 'triangle')); }
    if (B.t > 1.2 && !B.sp) { B.sp = true; for (let i = 0; i < 16; i++) B.spirits.push({ x: 40 + Math.random() * (W - 80), y: 300 + Math.random() * 40, t: -Math.random() * 1.4, ph: Math.random() * 6 }); }
    if (B.t > 3.4 && !B.dawn) { B.dawn = true; beep(523, 0, 0.6, 0.04, 'triangle'); beep(659, 0.25, 0.6, 0.04, 'triangle'); beep(784, 0.5, 0.9, 0.04, 'triangle'); } if (B.t > 8.2) hyFinish(true);
  }
  function hyBurstScreen(x, y, col, n) { hyBurst(x, y, col, n, 0.6); }
  const hyFirePos = (f) => {
    const B = HY.boss; const c = B.cam; const L = 1 + B.lunge * 0.2; const G = HYC.gashadokuro; let ox = 0; let oy = 0;
    if (f.kind === 'mini') { const e = Math.min(1, f.t * 1.5); const sg = f.side ? 1 : -1; ox = (sg * (G.miniSpread + Math.sin(HY.clock * G.miniFreq + f.id) * 50) ) * e; oy = Math.cos(HY.clock * G.miniFreq * 1.35 + f.id * 2) * 42 * e - 10 * e; } else if (f.kind === 'claw') { const sl = B.fires.filter(z => z.kind === 'claw' && z.side === f.side).sort((a, b) => a.id - b.id); const n = sl.length; const ph = ((f.id % 10) + HY.clock * G.clawWheelSpeed * (f.side ? -1 : 1)) % n; const u = (ph + n) % n; const i0 = Math.floor(u); const fr = u - i0; const A = sl[i0 % n]; const Bn = sl[(i0 + 1) % n]; ox = A.ix + (Bn.ix - A.ix) * fr - f.ix; oy = A.iy + (Bn.iy - A.iy) * fr - f.iy; } else if (f.kind === 'eye') ox = Math.sin(HY.clock * G.eyeShakeFreq + f.id) * G.eyeShakeAmp;
    return { x: W / 2 + (f.ix + ox + B.ox - c.cx) * c.s * L, y: HY_FCY + (f.iy + oy + B.oy - c.cy) * c.s * L, k: c.s * L };
  };
  function hyBossShoot(p) {
    const B = HY.boss; if (B.state === 'INTRO' || B.state === 'DEFEAT' || B.state === 'ARM_BREAK_L' || B.state === 'ARM_BREAK_R' || B.state === 'EYE_BREAK') return true; let best = null; let bd = 1e9;
    for (const f of B.fires) { if (!f.alive || !f.on) continue; const q = hyFirePos(f); const r = f.r * q.k * HYC.gashadokuro.weakPointHitboxScale + 2; const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd <= r && dd < bd) { bd = dd; best = f; } }
    if (!best) { HY.combo = 0; beep(1900, 0, 0.03, 0.06, 'square'); beep(1300, 0.03, 0.04, 0.05, 'triangle'); hyBurst(p.x, p.y, '#ffd890', 4, 0.25); hyPop(p.x, p.y - 8, 'KAN!', '#c8c8d8', 1); if (B.state === 'MOUTH_PHASE') B.mouthMiss++; return true; }
    HY.hits++; HY.combo++; HY.maxCombo = Math.max(HY.maxCombo, HY.combo); const G = HYC.gashadokuro; const q = hyFirePos(best); best.hp--; hyBurst(q.x, q.y, '#ff4a2a', 6, 0.4); hyBurst(q.x, q.y, '#ffffff', 3, 0.3); beep(1400, 0, 0.06, 0.07, 'square', 1800);
    if (best.kind === 'mouth') { B.mouthHits = G.mouthHP - best.hp; best.jit = 1; HY.score += G.mouthScore; HY.shake = Math.max(HY.shake, 0.5); hyPop(q.x, q.y - 20, '+' + G.mouthScore, '#ffffff', 1); if (best.hp <= 0) { best.alive = false; hyMouthCheck(B); } return true; }
    if (best.hp > 0) { best.jit = 1; HY.shake = Math.max(HY.shake, 0.25); return true; } best.alive = false; hyBurst(q.x, q.y, '#ff7a3a', 12, 0.7); beep(500, 0, 0.2, 0.07, 'sawtooth', 1200); noise(0.1, 0.05);
    const sc = best.kind === 'eye' ? G.eyeScore : G.clawScore; HY.score += sc; hyPop(q.x, q.y - 20, '+' + sc, '#ffe070', 1);
    if (best.kind === 'claw') { const left = hyAlive(B, 'claw', best.side).length; if (left === 0) hyArmBreak(B, best.side); } else if (best.kind === 'eye' && hyAlive(B, 'eye').length === 0) { hyBossGo('EYE_BREAK'); beep(120, 0, 0.8, 0.08, 'sawtooth', 50); HY.lock = 2.4; }
    if (best.kind === 'mini') hyMouthCheck(B);
    return true;
  }
  function hyMouthCheck(B) { const mo = B.fires.find((f) => f.kind === 'mouth'); if (mo.alive || B.fires.some((f) => f.kind === 'mini' && f.alive)) return; hyMouthEnd(B); }
  function hyArmBreak(B, side) {
    const k = 1000 / 1312; HY.shake = 1; HY.flash = 0; beep(80, 0, 0.5, 0.1, 'square', 40); noise(0.4, 0.08); hyBanner('BAKI!!', '#ffe070', 1.4, 4);
    B.pieces.push({ img: side === 0 ? 'gasha_full' : 'gasha_ro', x0: side === 0 ? 0 : 790, x1: side === 0 ? 540 : 1312, t: 0, y: 0, vy: -120, rot: 0, vr: side === 0 ? -0.9 : 0.9, px: side === 0 ? 270 : 1050 });
    B.base = side === 0 ? 'gasha_ro' : 'gasha_na'; hyBossGo(side === 0 ? 'ARM_BREAK_L' : 'ARM_BREAK_R'); HY.lock = 2.2; HY.score += 600; hyBurst(W / 2, 200, '#e8d8b8', 20, 0.9);
  }
  function hyMouthEnd(B) {
    const G = HYC.gashadokuro; HY.score += HYC.bossClearBonus; if (B.mouthMiss === 0) { HY.score += HYC.mouthOneMagBonus; hyPop(W / 2, 120, 'NO MISS BONUS!', '#ffe070', 1); }
    B.state = 'DEFEAT'; B.t = 0; B.freeze = 1; HY.lock = 99; B.fireWhite = true; hyBurst(W / 2, 190, '#ffffff', 16, 0.8);
  }
  function hyBanner(text, col, dur, sc) { HY.banner = { text, col, dur, t: 0, sc }; }
  // ---- 終了 ----
  function hyFinish(clear) {
    if (HY.phase !== 'play') return; const r = hyRec(); const isNew = HY.score > r.bestScore; if (isNew) r.bestScore = HY.score; if (clear) r.clears++; writeSave(); const t = HYC.rank; const rank = HY.score >= t.S ? 'S' : HY.score >= t.A ? 'A' : HY.score >= t.B ? 'B' : HY.score >= t.C ? 'C' : 'D';
    HY.result = { clear, score: HY.score, maxCombo: HY.maxCombo, rate: HY.shots ? Math.round(HY.hits / HY.shots * 100) : 0, rank, isNew, best: r.bestScore }; HY.phase = 'result'; HY.t = 0; HY.enemies = []; HY.pend = []; HY.sayUntil = 0; HY.chinUntil = 0; HY.banner = null;
    if (clear) [988, 1319, 1568, 1976].forEach((f, i) => beep(f, 0.1 + i * 0.09, 0.14, 0.05, 'triangle')); else { beep(300, 0, 0.3, 0.07, 'sawtooth', 120); beep(200, 0.25, 0.5, 0.07, 'sawtooth', 70); }
  }
  // ---- 背景（和風の夜） ----
  function hyBgBase(top, bot, moonCol, moonX, moonY, moonR) {
    const g = ctx.createLinearGradient(0, 0, 0, 250); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 22; i++) { ctx.globalAlpha = 0.3 + 0.3 * ((i * 7) % 3) / 2; rect((i * 53 + 11) % W, (i * 31 + 9) % 150 + 40, 1, 1, '#e8e0ff'); } ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.18; ctx.fillStyle = moonCol; ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 1.5, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = moonCol; ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, 6.2832); ctx.fill();
  }
  function hyHouse(x, w, top, base, flip) {
    rect(x, top, w, base - top, '#3a2418'); rect(x, top, w, 2, '#5a3a24'); const rx = flip ? x - 6 : x - 4; rect(rx, top - 10, w + 10, 12, '#1a1018'); rect(rx + 3, top - 16, w + 4, 7, '#241420');
    for (let i = 0; i < 2; i++) { const wx = x + 6 + i * (w / 2 - 2); const wy = top + 14 + i * 4; rect(wx, wy, w / 2 - 10, 26, '#ffd890'); for (let k = 1; k < 3; k++) rect(wx + k * ((w / 2 - 10) / 3), wy, 1, 26, '#8a5a30'); for (let k = 1; k < 4; k++) rect(wx, wy + k * 6, w / 2 - 10, 1, '#8a5a30'); }
    rect(x, base - 12, w, 12, '#2a1a10');
  }
  function hyLantern(x, y, r, c) { const sw = Math.sin(HY.clock * 1.6 + x) * 2; ctx.globalAlpha = 0.22; rkCircle(x + sw, y, r * 2.2, '#ff7a3a'); ctx.globalAlpha = 1; rect(x + sw - 1, y - r - 5, 2, 5, '#1a1018'); rect(x + sw - r * 0.7, y - r, r * 1.4, r * 2, c || '#e8382c'); rect(x + sw - r * 0.7, y - r, r * 1.4, 2, '#1a1018'); rect(x + sw - r * 0.7, y + r - 2, r * 1.4, 2, '#1a1018'); }
  function hyBg(id) {
    ctx.save(); if (HY.shake > 0) ctx.translate((Math.random() - 0.5) * HY.shake * 5, (Math.random() - 0.5) * HY.shake * 5);
    if (id === 'machi' || id === 'final') {
      const fin = id === 'final'; hyBgBase(fin ? '#2a0828' : '#0a1030', fin ? '#6a1838' : '#3a2058', fin ? '#ff9a7a' : '#f4ecc8', W - 40, 66, fin ? 22 : 14);
      for (let i = 0; i < 9; i++) { const x = i * 24 - 6; const h = 30 + (i * 17) % 22; rect(x, 214 - h, 22, h, '#16102a'); rect(x - 2, 214 - h - 6, 26, 6, '#120c22'); }
      rect(0, 214, W, 120, fin ? '#2a1420' : '#2a1c24'); for (let i = 0; i < 7; i++) rect(i * 34 + 8, 300 + (i % 2) * 14, 18, 2, '#3a2a30'); hyHouse(0, 50, 118, 250, false); hyHouse(W - 50, 50, 106, 250, true); hyLantern(58, 128, 8); hyLantern(W - 58, 120, 8); if (fin) { hyLantern(W / 2 - 30, 100, 6, '#7a3ad8'); hyLantern(W / 2 + 30, 108, 6, '#3a8ae8'); }
    } else if (id === 'kawabe') {
      hyBgBase('#0a1840', '#1a3a70', '#f4ecc8', 50, 70, 16); rect(0, 168, W, 30, '#12183a'); for (let i = 0; i < 6; i++) rect(i * 40 - 10, 160 + (i % 2) * 6, 34, 14, '#0e1230');
      rect(W * 0.2, 184, W * 0.6, 14, '#4a4a5a'); ctx.fillStyle = '#12183a'; ctx.beginPath(); ctx.ellipse(W / 2, 198, W * 0.2, 16, 0, Math.PI, 0); ctx.fill(); rect(W * 0.2, 180, W * 0.6, 4, '#6a6a7a'); rect(W * 0.2, 180, 3, 18, '#6a6a7a'); rect(W * 0.8 - 3, 180, 3, 18, '#6a6a7a');
      const g = ctx.createLinearGradient(0, 198, 0, 334); g.addColorStop(0, '#16407a'); g.addColorStop(1, '#06142e'); ctx.fillStyle = g; ctx.fillRect(0, 198, W, 140); for (let i = 0; i < 9; i++) { const y = 206 + i * 14; const x = ((i * 47 + HY.clock * (6 + i)) % (W + 40)) - 20; rect(x, y, 26 + i * 2, 1, '#6aa0e0'); } ctx.globalAlpha = 0.25; rkCircle(50, 232, 12, '#f4ecc8'); ctx.globalAlpha = 1;
      for (let i = 0; i < 7; i++) { rect(4 + i * 5, 258 - (i % 3) * 8, 1, 90, '#1a4a3a'); rect(W - 8 - i * 5, 262 - (i % 3) * 8, 1, 80, '#1a4a3a'); } hyLantern(26, 150, 6); hyLantern(W - 26, 150, 6);
    } else if (id === 'yama') {
      hyBgBase('#14082a', '#40204a', '#e8dcc8', W - 46, 64, 15); ctx.fillStyle = '#1a1030'; ctx.beginPath(); ctx.moveTo(0, 220); ctx.lineTo(W * 0.2, 130); ctx.lineTo(W * 0.42, 210); ctx.lineTo(W * 0.62, 110); ctx.lineTo(W * 0.85, 205); ctx.lineTo(W, 150); ctx.lineTo(W, 240); ctx.lineTo(0, 240); ctx.fill();
      ctx.fillStyle = '#0e0820'; ctx.beginPath(); ctx.moveTo(0, 250); ctx.lineTo(W * 0.3, 190); ctx.lineTo(W * 0.55, 245); ctx.lineTo(W * 0.8, 180); ctx.lineTo(W, 240); ctx.lineTo(W, 260); ctx.lineTo(0, 260); ctx.fill(); rect(0, 240, W, 100, '#1c1426');
      const tx = Math.round(W / 2); rect(tx - 26, 168, 5, 70, '#c8281c'); rect(tx + 21, 168, 5, 70, '#c8281c'); rect(tx - 32, 160, 64, 7, '#e8382c'); rect(tx - 28, 174, 56, 4, '#c8281c'); rect(tx - 34, 157, 68, 3, '#1a1018');
      for (let i = 0; i < 6; i++) { const x = 6 + i * 8; rect(x, 80 + (i % 2) * 20, 3, 200, '#1e5a3a'); for (let k = 0; k < 6; k++) rect(x - 1, 100 + k * 32 + (i % 3) * 5, 5, 2, '#0e3a24'); rect(W - 12 - i * 8, 70 + (i % 2) * 24, 3, 210, '#1e5a3a'); } ctx.globalAlpha = 0.18; rect(0, 230 + Math.sin(HY.clock * 0.5) * 4, W, 30, '#c8b8e8'); ctx.globalAlpha = 1;
    } else {
      hyBgBase('#040812', '#10223a', '#a8b8c8', 44, 62, 12); ctx.fillStyle = '#0a1424'; rect(W / 2 - 50, 150, 100, 70, '#0a1424'); ctx.beginPath(); ctx.moveTo(W / 2 - 66, 152); ctx.lineTo(W / 2 - 40, 128); ctx.lineTo(W / 2 + 40, 128); ctx.lineTo(W / 2 + 66, 152); ctx.fill(); rect(W / 2 - 6, 110, 12, 18, '#0a1424');
      rect(0, 220, W, 120, '#0c1220'); for (let i = 0; i < 7; i++) { const x = 10 + i * 30; const y = 232 + (i * 13) % 40; rect(x, y, 10, 18, '#2a3448'); rect(x + 1, y - 3, 8, 3, '#2a3448'); } ctx.globalAlpha = 0.16; rect(0, 215 + Math.sin(HY.clock * 0.4) * 5, W, 40, '#a8c8e8'); rect(0, 270, W, 30, '#a8c8e8'); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  const HY_BG_IDS = ['machi', 'kawabe', 'yama', 'final'];
  // ---- 描画：敵 ----
  function hyDrawNeko(x, y, dir, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); const b = '#1c1230'; ctx.fillStyle = b; ctx.beginPath(); ctx.ellipse(0, -12, 14, 8, 0, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.arc(13, -18, 7, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -23); ctx.lineTo(9, -31); ctx.lineTo(13, -24); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, -24); ctx.lineTo(18, -31); ctx.lineTo(19, -22); ctx.fill();
    ctx.strokeStyle = b; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-12, -14); ctx.quadraticCurveTo(-24, -26 - i * 4, -20 + Math.sin(t * 9 + i) * 4, -36 + i * 6); ctx.stroke(); } const l = Math.sin(t * 14) * 4; rect(-8, -6, 3, 6 + l * 0.2, b); rect(6, -6, 3, 6 - l * 0.2, b); ctx.fillStyle = '#c8ff5a'; rect(11, -20, 2, 2, '#c8ff5a'); rect(15, -20, 2, 2, '#c8ff5a'); ctx.restore();
  }
  function hyDrawEnemy(e) {
    const d = HYC.enemy[e.k]; const dying = e.st === 'dying'; const a = dying ? Math.max(0, 1 - e.dt / 0.4) : 1; if (a <= 0) return; const r = hyRect(e); const sh = e.warn ? Math.round((Math.random() - 0.5) * 2) : 0; ctx.globalAlpha = a;
    if (e.k === 'neko') { const im = hyImg('nekomata'); if (im) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * a; const g = ctx.createRadialGradient(e.x, e.y - r.h / 2, 2, e.x, e.y - r.h / 2, r.w * 0.8); g.addColorStop(0, 'rgba(190,150,255,0.8)'); g.addColorStop(1, 'rgba(60,20,120,0)'); ctx.fillStyle = g; ctx.fillRect(e.x - r.w, e.y - r.h * 1.5, r.w * 2, r.h * 2); ctx.restore(); ctx.drawImage(im, r.x0, r.y0, r.w, r.h); } else hyDrawNeko(e.x, e.y, e.dir, e.t); ctx.globalAlpha = 1; return; }
    if (e.k === 'rokuro') {
      const bh = 76; const bw = bh * hyAsp('rokuro_body', 0.6); const bi = hyImg('rokuro_body'); const hi = hyImg('rokuro_head'); const bx = e.x0; const by = e.y0; if (bi) ctx.drawImage(bi, bx - bw / 2, by - bh, bw, bh);
      ctx.strokeStyle = '#ece4dc'; ctx.lineWidth = 3 + e.hs * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by - bh + 8); ctx.bezierCurveTo(bx, by - bh - 30, e.hx + Math.sin(e.t * 3) * 14, e.hy + 40, e.hx, e.hy + r.h * 0.35); ctx.stroke(); ctx.strokeStyle = '#8a7a80'; ctx.lineWidth = 1; ctx.stroke();
      if (hi) ctx.drawImage(hi, r.x0 + sh, r.y0, r.w, r.h); ctx.globalAlpha = 1; if (e.warn && !dying) drawTextCenter('!', e.hx, r.y0 - 14, '#ff4a4a', 3, '#300'); return;
    }
    let img = e.k; if (e.k === 'kitsune' && !e.real) img = 'kitsune_fake'; if (e.k === 'oni') img = e.st === 'raise' ? 'oni_a' : 'oni_n'; const im = hyImg(img);
    if (im) { ctx.drawImage(im, r.x0 + sh, r.y0, r.w, r.h); if (e.hurt > 0) { ctx.globalAlpha = a * 0.35; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(im, r.x0 + sh, r.y0, r.w, r.h); ctx.globalCompositeOperation = 'source-over'; } }
    if (e.k === 'oni' && e.st === 'stun') drawTextCenter('?', e.x, r.y0 - 8, '#ffe070', 3, '#300');
    ctx.globalAlpha = 1; if (e.warn && !dying && e.k !== 'oni') drawTextCenter('!', e.x, r.y0 - 14, '#ff4a4a', 3, '#300'); if (e.k === 'oni' && e.warn) drawTextCenter('!', e.x, r.y0 - 8, '#ff4a4a', 3, '#300');
    if (!dying && d.hp > 1 && true) { const kt = e.k === 'kitsune'; const pw = kt ? 9 : 4; const gp = kt ? 12 : 6; const py = Math.round(r.y0 - (kt ? 36 : 4)); for (let i = 0; i < d.hp; i++) { const px = Math.round(e.x - d.hp * gp / 2 + i * gp); if (kt) rect(px - 1, py - 1, pw + 2, 6, '#10042a'); rect(px, py, pw, kt ? 4 : 3, i < (e.k === 'kitsune' && !e.real ? d.hp : e.hp) ? '#ff7a8a' : '#3a2a5a'); } }
  }
  // ---- 描画：ボス ----
  function hyDrawFire(f, B) {
    if (!f.on) return; const q = hyFirePos(f); const ap = Math.min(1, f.t * 3); let sc = ap; const warn = (B.state === 'CLAW_L' || B.state === 'CLAW_R') && f.kind === 'claw' || B.state === 'EYE_PHASE' && f.kind === 'eye' || B.state === 'MOUTH_PHASE' && f.kind === 'mouth'; const wl = warn ? (B.warnL || 0) : 0;
    let jx = 0; let jy = 0; if (f.kind === 'mouth') { const unst = (f.hp < HYC.gashadokuro.mouthHP ? (1 - f.hp / HYC.gashadokuro.mouthHP) : 0) * 5 + (f.jit || 0) * 3; f.jit = Math.max(0, (f.jit || 0) - 0.05); jx = (Math.random() - 0.5) * unst; jy = (Math.random() - 0.5) * unst; sc *= 0.75 + 0.25 * Math.min(1, (B.atkT || 0) / 8) + wl * 0.2 + (f.hp / HYC.gashadokuro.mouthHP) * 0.25; }
    if (f.kind === 'eye') { sc *= 0.62 + 0.38 * f.hp / HYC.gashadokuro.eyeHP; const u = f.jit || 0; f.jit = Math.max(0, u - 0.05); jx = (Math.random() - 0.5) * u * 4; jy = (Math.random() - 0.5) * u * 4; } sc *= 1 + wl * 0.3; const h = f.fh * q.k * sc * (1 + 0.04 * Math.sin(HY.clock * 5 + f.id)); const w = h * hyAsp('onibi', 0.59); const cx = q.x + jx + Math.sin(HY.clock * 3 + f.id) * 0.8; const cy = q.y + jy;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.2 * wl; const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, h * 0.75); g.addColorStop(0, B.fireWhite ? 'rgba(255,255,255,0.9)' : 'rgba(255,60,30,0.8)'); g.addColorStop(1, 'rgba(120,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(cx - h, cy - h, h * 2, h * 2); ctx.restore();
    const im = hyImg('onibi'); if (im) { ctx.globalAlpha = Math.min(1, ap); ctx.drawImage(im, cx - w / 2, cy - h * 0.55, w, h); if (B.fireWhite) { ctx.globalAlpha = 0.8; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(im, cx - w / 2, cy - h * 0.55, w, h); ctx.globalCompositeOperation = 'source-over'; } ctx.globalAlpha = 1; } else rkCircle(cx, cy, h * 0.3, '#e8281c');
    if (DEV_MODE && HY.dev.boxes) { ctx.strokeStyle = '#00ff88'; ctx.beginPath(); ctx.arc(q.x, q.y, f.r * q.k * HYC.gashadokuro.weakPointHitboxScale, 0, 6.2832); ctx.stroke(); }
  }
  let HY_SPIRIT = null;
  function hySpiritImg() {
    if (HY_SPIRIT) return HY_SPIRIT; const im = hyImg('onibi'); if (!im) return null; const c = document.createElement('canvas'); c.width = 60; c.height = 100; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 60, 100); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(24,0,12,0.6)'; g.fillRect(0, 0, 60, 100); HY_SPIRIT = c; return c;
  }
  function hyDrawBoss() {
    const B = HY.boss; const c = B.cam; const L = 1 + B.lunge * 0.2; const k = 1000 / 1312; ctx.save(); ctx.beginPath(); ctx.rect(0, HY_FY0, W, HY_FY1 - HY_FY0); ctx.clip();
    const sx = HY.shake > 0 ? (Math.random() - 0.5) * HY.shake * 6 : 0; const sy = HY.shake > 0 ? (Math.random() - 0.5) * HY.shake * 6 : 0; const s = c.s * L; const dx = W / 2 + (B.ox - c.cx) * s + sx; const dy = HY_FCY + (B.oy - c.cy) * s + sy;
    const draw = (name, x0, x1, extra) => { const im = hyImg(name); if (!im) return; ctx.drawImage(im, x0 * k, 0, (x1 - x0) * k, im.naturalHeight, dx + x0 * s, dy, (x1 - x0) * s, 1199 * s); };
    ctx.globalAlpha = B.vis;
    if (B.state === 'DEFEAT' && B.boom) { const n = 9; const im = hyImg(B.base); if (im) for (let i = 0; i < n; i++) { const t0 = (n - 1 - i) * 0.22 + 0.2; const u = Math.max(0, B.t - 0.7 - t0); const fy = 0.5 * 420 * u * u; const a = Math.max(0, 1 - u * 0.7); if (a <= 0) continue; ctx.globalAlpha = a; const sh = im.naturalHeight / n; ctx.drawImage(im, 0, i * sh, im.naturalWidth, sh, dx, dy + (i * 1199 / n) * s + fy * s * 0.5, 1312 * s, (1199 / n) * s + 1); } }
    else { draw(B.base, 0, 1312); for (const q of B.pieces) { ctx.save(); const px = dx + q.px * s; const py = dy + 800 * s + q.y * s * 0.4; ctx.translate(px, py); ctx.rotate(q.rot); ctx.translate(-px, -py); ctx.globalAlpha = Math.max(0, 1 - q.t * 0.5); ctx.translate(0, q.y * s * 0.4); draw(q.img, q.x0, q.x1); ctx.restore(); } }
    ctx.globalAlpha = 1; if (B.state !== 'DEFEAT' || !B.boom) for (const f of B.fires) if (f.alive) hyDrawFire(f, B);
    if (B.dark > 0.01) { ctx.globalAlpha = B.dark; rect(0, HY_FY0, W, HY_FY1 - HY_FY0, '#000008'); ctx.globalAlpha = 1; } ctx.restore();
    if (B.dawn) { const u = Math.min(1, (B.t - 3.4) / 3.6); const g = ctx.createLinearGradient(0, HY_FY0, 0, HY_FY1); g.addColorStop(0, 'rgba(255,190,150,' + (0.55 * u) + ')'); g.addColorStop(1, 'rgba(255,230,190,' + (0.85 * u) + ')'); ctx.fillStyle = g; ctx.fillRect(0, HY_FY0, W, HY_FY1 - HY_FY0); }
    for (const q of B.spirits) { if (q.t < 0) continue; const a = Math.min(1, q.t * 2) * Math.max(0, 1 - q.t / 4); ctx.globalAlpha = a; const fi = hySpiritImg(); if (fi) ctx.drawImage(fi, q.x - 5, q.y - 8, 10, 16); else rkCircle(q.x, q.y, 3, '#7a1020'); ctx.globalAlpha = 1; }
    if (B.whiteT > 0) { B.whiteT -= 1 / 60; ctx.globalAlpha = Math.min(0.7, B.whiteT * 1.6); rect(0, 0, W, H, "#ffffff"); ctx.globalAlpha = 1; }
  }
  // ---- 描画：HUD・画面 ----
  function hyDrawHud() {
    rect(0, 0, W, 40, 'rgba(6,2,20,0.78)'); for (let i = 0; i < HYC.maxLife; i++) { const x = 8 + i * 10; const on = i < HY.life; rect(x + 1, 8, 3, 2, on ? '#ff3a4a' : '#3a2a44'); rect(x + 5, 8, 3, 2, on ? '#ff3a4a' : '#3a2a44'); rect(x, 10, 9, 3, on ? '#ff3a4a' : '#3a2a44'); rect(x + 1, 13, 7, 2, on ? '#ff3a4a' : '#3a2a44'); rect(x + 3, 15, 3, 2, on ? '#ff3a4a' : '#3a2a44'); }
    const sc = String(HY.score); drawText(sc, W - 8 - textWidth(sc, 2), 8, '#ffffff', 2, '#4a2a9a'); const stn = HY.mode === 'boss' ? 'BOSS' : HY.mode === 'silence' ? '...' : HYC.stages[HY.stage].no; drawText(stn, 8, 26, '#c8a0ff', 1); const cb = 'COMBO ' + HY.combo; drawText(cb, W - 8 - textWidth(cb, 1), 26, HY.combo >= 5 ? '#7dfcff' : '#c8c8e8', 1);
    rect(0, HY_FY1 + 2, W, H - HY_FY1 - 2, '#120a22'); rect(0, HY_FY1 + 2, W, 2, '#6a4aa0'); for (let i = 0; i < HYC.magazineSize; i++) { const x = 12 + i * 12; const on = i < HY.ammo && HY.reloadT <= 0; rkCircle(x, 358, 4.5, on ? '#ffe070' : '#2a2038'); if (on) rkCircle(x - 1, 357, 1.5, '#fff8d0'); } drawText('SHOTS', 8, 342, '#a8b8ff', 1);
    if (HY.reloadT > 0) { rect(8, 368, 84, 4, '#2a2038'); rect(8, 368, Math.round(84 * (1 - HY.reloadT / HYC.reloadTime)), 4, '#7dfcff'); }
    if (HY.ammo === 0 && HY.reloadT <= 0 && HY.mode !== 'silence') drawTextCenter('RELOAD!', W / 2, 310, '#ff7a7a', 3, '#300');
  }
  function hyDrawPlay() {
    if (HY.mode === 'boss' || HY.mode === 'silence') hyBg('grave'); else hyBg(HY_BG_IDS[HY.stage]);
    if (HY.mode === 'boss') hyDrawBoss(); else { for (const e of HY.enemies.slice().sort((a, b) => a.y - b.y)) hyDrawEnemy(e); }
    for (const f of HY.fx) { if (f.ring) { const u = f.t / f.life; ctx.globalAlpha = 1 - u; ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + u * 12, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; } else { ctx.globalAlpha = Math.max(0, 1 - f.t / f.life); rect(Math.round(f.x), Math.round(f.y), 2, 2, f.col); ctx.globalAlpha = 1; } }
    for (const q of HY.pops) { ctx.globalAlpha = Math.max(0, 1 - q.t / 0.9); drawTextCenter(q.text, q.x, q.y - q.t * 24, q.col, q.sc, '#10042a'); ctx.globalAlpha = 1; }
    if (HY.flash > 0) { ctx.globalAlpha = HY.flash * 0.35; rect(0, 0, W, H, '#ff1a1a'); ctx.globalAlpha = 1; }
    hyDrawHud(); if (HY.banner) { const b = HY.banner; const a = Math.min(1, b.t * 8, (b.dur - b.t) * 6); ctx.globalAlpha = Math.max(0, a); drawTextCenter(b.text, W / 2, 120, b.col, Math.min(b.sc, Math.floor((W - 16) / (b.text.length * 4))), '#10042a'); ctx.globalAlpha = 1; }
  }
  function hyDrawIntro() {
    hyBg('machi'); rect(0, 0, W, 96, 'rgba(6,2,20,0.7)'); drawTextCenter('HYAKKI', W / 2, 12, '#ff5a4a', 4, '#2a0a10'); drawTextCenter('YAKO', W / 2, 40, '#ffe070', 4, '#a0481a');
    const t = HY.clock; const items = [['hitotsume', 36, 232, 0.72], ['karakasa', W / 2 + 4, 244, 0.8], ['oni_n', W - 38, 250, 1.0]]; for (const it of items) { const im = hyImg(it[0]); if (!im) continue; const h = it[0] === 'oni_n' ? 74 : 56; const w = h * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, it[1] - w / 2, it[2] - h + Math.sin(t * 2 + it[1]) * 2, w, h); }
    rect(0, 262, W, H - 262, '#120a22'); drawTextCenter('YEN ' + P_().money, W / 2, 272, '#a8b8ff', 1); const r = hyRec(); drawTextCenter('BEST ' + r.bestScore, W / 2, 284, '#ffe070', 1); drawTextCenter('1 PLAY  YEN ' + HYC.playCost, W / 2, 308, '#a8b8ff', 1);
  }
  function hyDrawResult() {
    const R = HY.result; hyBg('grave'); rect(0, 0, W, H, 'rgba(6,2,20,0.78)'); drawFrame(); drawTextCenter(R.clear ? 'CLEAR!' : 'GAME OVER', W / 2, 18, R.clear ? '#ffe070' : '#ff7a7a', R.clear ? 4 : 3, '#2a0a10');
    const L = (lab, v, y, col) => { drawText(lab, 18, y, '#c8a0ff', 1); drawText(String(v), W - 18 - textWidth(String(v), 2), y - 3, col || '#ffffff', 2, '#4a2a9a'); };
    L('SCORE', R.score, 64); L('MAX COMBO', R.maxCombo, 90); L('HIT RATE', R.rate + ' PCT', 116); rect(14, 138, W - 28, 1, '#4a2a7a'); drawTextCenter('RANK', W / 2, 148, '#c8a0ff', 1); const rc = { S: '#ff6ad0', A: '#ffe070', B: '#7dfcff', C: '#a8d8a8', D: '#c8c8e8' }[R.rank]; drawTextCenter(R.rank, W / 2, 164, rc, 7, '#10042a');
    if (R.isNew) drawTextCenter('NEW RECORD!', W / 2, 218, '#ffe070', 2, '#a0481a'); else drawTextCenter('BEST ' + R.best, W / 2, 220, '#ffe070', 1); drawTextCenter('YEN ' + P_().money, W / 2, 246, '#a8b8ff', 1);
  }
  // ---- DOM ----
  const HY_DOM = {};
  function hyBuildDom() {
    if (HY_DOM.play) return; const mk = (id, text, cls, ev, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); HY_DOM[id.slice(3)] = b; b.addEventListener(ev, (e) => { ensureAudio(); if (ev === 'pointerdown') e.preventDefault(); fn(); }); return b; };
    mk('hy-play', 'PLAY　¥' + HYC.playCost, 'hb-go', 'click', hyInsert); mk('hy-retry', 'もういちど　¥' + HYC.playCost, 'hb-go', 'click', hyInsert); mk('hy-reload', 'RELOAD', 'hb-go', 'pointerdown', hyReload);
    const mkd = (id, html) => { const d = document.createElement('div'); d.className = 'nk-say'; d.id = id; d.innerHTML = html; screenEl.appendChild(d); HY_DOM[id.slice(3)] = d; return d; };
    mkd('hy-say', ''); mkd('hy-chin', '百鬼夜行<br>鎮'); mkd('hy-help', 'タップで れいだんを うって ようかいを はらえ！<br>したの RELOADで たまを こめなおせる（6はつ）<br>がしゃどくろは 赤い おにびを うて！<br><span class="nk-dim">ようかいに こうげきされると LIFE -1／5つで おしまい</span>');
  }
  function hyUi() {
    hyBuildDom(); const ph = HY.phase; const show = (k, on) => HY_DOM[k].classList.toggle('is-show', !!on); const sayOn = ph === 'play' && HY.sayUntil > HY.clock; if (sayOn) HY_DOM.say.innerHTML = HY.sayHtml;
    show('play', ph === 'intro'); show('help', ph === 'intro'); show('retry', ph === 'result'); show('reload', ph === 'play'); show('say', sayOn);
    crPlace(HY_DOM.play, { x: 24, y: 322, w: W - 48, h: 34 }); crPlace(HY_DOM.help, { x: 10, y: 104, w: W - 20, h: 86 }); crPlace(HY_DOM.retry, { x: 20, y: 270, w: W - 40, h: 34 }); crPlace(HY_DOM.reload, { x: W - 92, y: 340, w: 84, h: 38 }); crPlace(HY_DOM.say, { x: 20, y: 130, w: W - 40, h: 52 }); crPlace(HY_DOM.chin, { x: 10, y: 120, w: W - 20, h: 90 });
    for (const k of ['play', 'retry']) HY_DOM[k].style.fontSize = Math.max(10, parseFloat(HY_DOM[k].style.fontSize) * 0.95) + 'px'; HY_DOM.help.style.fontSize = Math.max(10, parseFloat(HY_DOM.help.style.fontSize) * 0.84) + 'px'; HY_DOM.say.style.fontSize = Math.max(12, parseFloat(HY_DOM.say.style.fontSize) * 1.15) + 'px'; HY_DOM.chin.style.fontSize = Math.max(18, parseFloat(HY_DOM.chin.style.fontSize) * 2.1) + 'px';
  }
  function hyHide() { if (!HY_DOM.play) return; Object.keys(HY_DOM).forEach((k) => HY_DOM[k].classList.remove('is-show')); }
  function hyDraw() { const ph = HY.phase; if (ph === 'intro') hyDrawIntro(); else if (ph === 'result') hyDrawResult(); else hyDrawPlay(); hyUi(); }
  function hyLeaveMid() {
    if (HY.phase !== 'play') return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ・BESTも きろくされないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { HY.phase = 'intro'; HY.enemies = []; HY.pend = []; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  function openHyDev() {
    const again = (f) => () => { f(); setTimeout(openHyDev, 0); }; const B = HY.boss; const go = (st) => () => { if (HY.phase !== 'play') hyStart(); HY.enemies = []; HY.pend = []; hyStartStage(st); HY.wait = 0.2; };
    const boss = (state) => () => { if (HY.phase !== 'play') hyStart(); hyBossStart(); const b = HY.boss; HY.lock = 0; b.vis = 1; b.oy = 0; b.t = 3; HY.sayUntil = 0;
      if (state === 'CLAW_R') { b.fires.filter((f) => f.side === 0 && f.kind === 'claw').forEach((f) => { f.alive = false; }); b.base = 'gasha_ro'; }
      if (state === 'EYE_PHASE' || state === 'MOUTH_PHASE') { b.fires.filter((f) => f.kind === 'claw').forEach((f) => { f.alive = false; }); b.base = 'gasha_na'; }
      if (state === 'MOUTH_PHASE') b.fires.filter((f) => f.kind === 'eye').forEach((f) => { f.alive = false; });
      b.cam = Object.assign({}, hyBossTarget(Object.assign({}, b, { state }))); b.state = state; b.t = 0; b.fires.forEach((f) => { if (f.alive && ((state.startsWith('CLAW') && f.kind === 'claw' && f.side === (state === 'CLAW_L' ? 0 : 1)) || (state === 'EYE_PHASE' && f.kind === 'eye') || (state === 'MOUTH_PHASE' && f.kind === 'mouth'))) { f.on = true; f.t = 1; } }); };
    showDialog({ title: 'HYAKKI YAKO DEV', wide: true, lines: [{ text: 'PHASE ' + HY.phase + '.' + HY.mode + ' / STAGE ' + HY.stage + ' / LIFE ' + HY.life + ' / AMMO ' + HY.ammo + ' / SCORE ' + HY.score + (B ? ' / BOSS ' + B.state : '') + ' / 無敵 ' + (HY.dev.god ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) }, { label: 'ゲーム即開始（料金なし）', onClick: () => { hyStart(); } },
      { label: 'STAGE 1', onClick: go(0) }, { label: 'STAGE 2', onClick: go(1) }, { label: 'STAGE 3', onClick: go(2) }, { label: 'FINAL', onClick: go(3) },
      { label: 'BOSS：右手の爪（左腕は もげたあと）', onClick: boss('CLAW_R') }, { label: 'BOSS：左手の爪から', onClick: boss('CLAW_L') }, { label: 'BOSS：両目', onClick: boss('EYE_PHASE') }, { label: 'BOSS：口', onClick: boss('MOUTH_PHASE') },
      { label: '無敵 ON/OFF', onClick: again(() => { HY.dev.god = !HY.dev.god; }) }, { label: '判定の表示 ON/OFF', onClick: again(() => { HY.dev.boxes = !HY.dev.boxes; }) }, { label: 'BEST 記録 リセット', onClick: again(() => { const r = hyRec(); r.bestScore = 0; r.clears = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('hyakki', {
    reset() { HY.phase = 'intro'; HY.enemies = []; HY.pend = []; }, phase: () => (HY.phase === 'play' ? 'play' : 'idle'),
    enter() { hyBuildDom(); HY.phase = 'intro'; HY.paying = false; HY.enemies = []; HY.pend = []; HY.fx = []; HY.pops = []; HY.banner = null; HY.sayUntil = 0; HY.chinUntil = 0; setMessage('', C.cyan); },
    update: hyUpdate, draw: hyDraw, hint: 'ようかいを タップで うて！ たまぎれは RELOAD',
    pointer: hyPointer, pointerUp() {}
  });
  GAME_TYPES.hyakki.canLeave = () => HY.phase !== 'play';
  GAME_TYPES.hyakki.beforeLeave = () => hyLeaveMid();
  GAME_TYPES.hyakki.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });
