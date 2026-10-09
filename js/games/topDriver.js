'use strict';
  // =====================================================================
  //  🏎️ TOP DRIVER（レースゲーム）
  //   疑似3Dのリアビュー。操作は、画面下の円形ハンドルだけ（指の角度で、本当に回す）。アクセル・ブレーキ・シフトは、なし
  //   プレイヤーも CPU も「道路の上の横の位置（roadX：0＝中央、±1＝道路のはし）」を持つ。車も道路も動く → ライン取りが、生まれる
  //   遅くなるのは、草地・壁・CPU車に当たったときだけ。コースは、データ（CONFIG.topDriver.courses）で、足せる
  // =====================================================================
  const TDC = CONFIG.topDriver;
  const TD_MACHINE = { machineId: 'td_topdriver', machineName: 'TOP DRIVER', label: 'TOP DRIVER', isUnlocked: true, gameType: 'topDriver', td: true };
  const TDV = { top: 8, horizon: 88, bottom: 250, camH: 700, focal: 60, roadHalf: 900, segLen: 200, iMax: 162 };         // 画面の寸法（道路を描く範囲）と、疑似3Dの定数
  TDV.rowZ = []; for (let i = 1; i <= TDV.iMax; i++) TDV.rowZ[i] = TDV.camH * TDV.focal / i;                          // 画面の下から n 行目が、どれだけ先の道路か
  const TD_CAR_ROW = 156;                                                                                              // プレイヤー車が、画面の下の何行目にいるか（足もとの行）
  const TD_CAR_DZ = TDV.camH * TDV.focal / TD_CAR_ROW;                                                                // カメラから、プレイヤー車までの きょり
  let tdBuilt = '';
  let bendDir = 0;                                                                                                     // コースのカードの絵：道路が曲がる向き
  const TD = {
    phase: 'select', courseIdx: 0, course: null, segCurve: [], objs: [], trackLen: 0, clock: 0, t: 0, raceT: 0, paused: false, vtime: null,
    player: null, cpus: [], steer: 0, steerHeld: false, finger: null, shake: 0, bgScroll: 0, hitCd: 0, wallCd: 0, goalT: 0, place: 1, result: null, newRecord: false, parts: [], engT: 0,
    items: [], effect: null, tod: 'day', fxT: 0, lookKey: '', lookObj: null, offer: [],
    dev: { info: false, cpu: false, box: false, road: false, auto: false, cpuMul: 1, items: false }, camZ: 0, cxRow: [], halfRow: [], startOnly: false, startZ: 0, sfxT: 0
  };
  const tdCourse = () => TDC.courses[TD.courseIdx] || TDC.courses[0];
  const TD_TODS = ['day', 'dusk', 'night'];
  const tdPickTod = () => { TD.tod = TD_TODS[Math.floor(Math.random() * TD_TODS.length)]; };                             // 朝・夕方・夜は、ランダムに決まる
  function tdLook() {                                                                                                     // いまの背景＝コースの見た目 × 朝夕晩（空・太陽・暗さ）
    const key = tdCourse().id + '|' + TD.tod; if (TD.lookKey === key && TD.lookObj) return TD.lookObj;
    const base = TDC.looks[TD.tod] || TDC.looks.day; const th = tdCourse().theme; const tint = (c) => { let o = c; if (TD.tod === 'dusk') o = mixHex(o, '#ff9a5a', 0.12); return base.dark > 0 ? mixHex(o, '#0a0a28', base.dark) : o; };
    TD.lookKey = key; TD.lookObj = Object.assign({}, base, { band: th.band, grassA: tint(th.grassA), grassB: tint(th.grassB), roadA: tint(th.roadA), roadB: tint(th.roadB), hill: tint(th.hill), sea: tint(th.ground) }); return TD.lookObj;
  }
  const tdTint = (col) => { const d = TD.tod === 'day' ? 0 : (TDC.looks[TD.tod] || TDC.looks.day).dark; return d > 0 ? mixHex(col, '#0a0a28', d) : col; };                    // 夕方・夜は、ものの色も、暗くする
  function tdBuildCourse() {                                                                                           // コースのデータ → 区間ごとの曲がりぐあい・道ばたの物
    const c = tdCourse(); TD.course = c; TD.segCurve = []; let z = 0;
    let segTotal = 0;
    for (const sec of c.sections) {
      const nSeg = Math.max(1, Math.round(sec.length * TDC.lengthScale)); segTotal += nSeg;
      for (let k = 0; k < nSeg; k++) { const t = k / nSeg; const e = t < 0.25 ? t / 0.25 : t > 0.75 ? (1 - t) / 0.25 : 1; const sm = e * e * (3 - 2 * e); TD.segCurve.push(sec.curve * sm); }
    }
    for (let k = 0; k < 90; k++) TD.segCurve.push(0);                                                                  // ゴールのあとの直線
    TD.trackLen = segTotal * TDV.segLen;
    TD.objs = []; let h = 7; const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
    const wsum = c.objs.reduce((q, o) => q + o[1], 0); const pick = () => { let r = rnd() * wsum; for (const [t, w] of c.objs) { if (r < w) return t; r -= w; } return c.objs[0][0]; };
    for (let zz = 600; zz < TD.trackLen + 8000; zz += 170) {
      if (rnd() > 0.58) continue; const side = rnd() < 0.5 ? -1 : 1; const type = pick();
      const lat = type === 'lamp' ? 1.75 : type === 'building' ? 2.5 + rnd() * 0.7 : type === 'sign' ? 1.95 + rnd() * 0.6 : type === 'rock' ? 2.2 + rnd() * 0.9 : 1.9 + rnd() * 0.9;
      TD.objs.push({ z: zz, lat: side * lat, type, col: ['#ff6a8a', '#ffd84a', '#5ab8ff', '#7dff8a'][Math.floor(rnd() * 4)], bcol: ['#7a86aa', '#8a7a9a', '#6a8aa8', '#9a8a7a'][Math.floor(rnd() * 4)], bh: Math.floor(rnd() * 900) });
    }
    TD.objs.sort((a, b) => a.z - b.z);
  }
  const tdCurveAt = (z) => TD.segCurve[Math.min(TD.segCurve.length - 1, Math.max(0, Math.floor(z / TDV.segLen)))] || 0;
  // ---- レース開始 ----
  function tdNewRace(startZ) {
    const sz = startZ || 500; TD.startZ = sz; const P = TDC.physics;
    TD.player = { z: sz, x: 0, speed: 0, goal: false, goalAt: 0, tilt: 0 };
    const mk = (name, color, dz, x, spd, bias, wob, skill) => ({ name, color, z: sz + dz, x, speed: 0, base: spd, bias, wob, skill, ph: Math.random() * 6.28, goal: false, place: 0 });
    TD.cpus = TDC.cpus.map((c, i) => mk(c.name, c.color, c.startDz, c.startX, c.speedMul, c.lineBias, c.wobble, c.curveSkill));
    TD.steer = 0; TD.steerHeld = false; TD.finger = null; TD.raceT = 0; TD.shake = 0; TD.hitCd = 0; TD.wallCd = 0; TD.goalT = 0; TD.parts = []; TD.result = null; TD.newRecord = false; TD.bgScroll = 0; TD.engT = 0;
    TD.camZ = TD.player.z - TD_CAR_DZ; tdPlaceItems(sz); TD.effect = null;
  }
  function tdPlaceItems(sz) {                                                                                           // アイテムを、コースの3つのゾーンに、1個ずつ。位置も、どれがUPかも、毎回ちがう
    const I = TDC.items; const lo = sz + 9000; const hi = TD.trackLen - 7000; const span = (hi - lo) / I.count; TD.items = [];
    const ups = new Set(); while (ups.size < Math.min(I.upCount, I.count)) ups.add(Math.floor(Math.random() * I.count));
    for (let k = 0; k < I.count; k++) TD.items.push({ z: Math.round(lo + k * span + span * (0.12 + Math.random() * 0.76)), x: Math.round((Math.random() * 1.5 - 0.75) * 100) / 100, kind: ups.has(k) ? 'up' : 'down', used: false });
  }
  function tdBegin() {                                                                                                  // 「¥100でスタート」：¥100をはらう → 6つのうち ランダムな3つのコースから、1つえらぶ
    if (P_().money < TDC.price) { toast('お金が足りないよ（¥' + TDC.price + ' 要るよ）'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(TDC.price); P_().topDriver.playCount++; writeSave();
    const idx = TDC.courses.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    TD.offer = idx.slice(0, Math.min(3, idx.length)); TD.phase = 'pick'; TD.t = 0; TD.parts = []; beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05);
    if (TD.dev.pickIdx !== undefined && TD.dev.pickIdx !== null) tdPickCourse(TD.dev.pickIdx);                       // DEV・テスト用：選ばずに、すぐ開始
  }
  function tdPickCourse(i) {                                                                                            // えらんだコースで、レースの準備（朝・夕方・夜は、ここでランダムに決まる）
    TD.courseIdx = i; tdPickTod(); tdBuildCourse(); tdBuilt = tdCourse().id; tdNewRace(TD.dev.startZ || 500); TD.phase = 'ready'; TD.t = 0; beep(1175, 0, 0.06, 0.05, 'square'); beep(1568, 0.06, 0.1, 0.05, 'square');
  }
  // ---- ハンドル：指の角度を追って、本当に回す ----
  const tdWheel = () => ({ x: Math.round(W / 2), y: 316, r: 52 });
  const tdNorm = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };                           // ±180°のさかいめで、飛ばないように
  const tdAngleOf = (p) => { const w = tdWheel(); return Math.atan2(p.y - w.y, p.x - w.x) * 180 / Math.PI; };
  function tdPointer(e, p) {
    if (TD.phase === 'pick') { for (let k = 0; k < TD.offer.length; k++) { const r = tdCardRect(k); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { tdPickCourse(TD.offer[k]); return; } } return; }
    if (TD.phase !== 'race' && TD.phase !== 'count' && TD.phase !== 'ready') return; if (TD.paused) return;
    const w = tdWheel(); if (p.y < TDV.bottom + 2) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    if (TD.finger) return; TD.finger = { id: e.pointerId, a: tdAngleOf(p), x: p.x, y: p.y }; TD.steerHeld = true;
  }
  function tdPointerMove(e, p) {
    const f = TD.finger; if (!f || f.id !== e.pointerId) return; const a = tdAngleOf(p); const d = tdNorm(a - f.a); f.a = a; f.x = p.x; f.y = p.y;
    const R = TDC.steering; const prev = TD.steer; TD.steer = clamp(TD.steer + d, -R.maxAngle, R.maxAngle);
    if (Math.abs(TD.steer) >= R.maxAngle - 0.01 && Math.abs(prev) < R.maxAngle - 0.01) beep(300, 0, 0.03, 0.03, 'square');                    // 最大まで回したときの、小さな音
  }
  function tdPointerUp(e) { const f = TD.finger; if (f && f.id === e.pointerId) { TD.finger = null; TD.steerHeld = false; } }
  const tdInput = () => { const R = TDC.steering; const n = clamp(TD.steer / R.maxAngle, -1, 1); return Math.sign(n) * Math.pow(Math.abs(n), R.curve) * R.sensitivity; };       // 角度 → -1〜+1（中央付近は、こまかく）
  // ---- 1コマぶんの、ゲームの更新 ----
  function tdStep(dt) {
    const P = TDC.physics; const pl = TD.player; const R = TDC.steering;
    if (!TD.steerHeld) { TD.steer += (0 - TD.steer) * (1 - Math.exp(-R.autoCenterSpeed * dt)); if (Math.abs(TD.steer) < 0.3) TD.steer = 0; }              // 指をはなすと、スルスルッと中央へ
    if (TD.dev.auto) tdAuto();
    const input = tdInput(); const spct = clamp(pl.speed / P.maxSpeed, 0, 1.2);
    const segIdx = Math.floor(pl.z / TDV.segLen); const cur = tdCurveAt(pl.z);
    if (TD.phase === 'race' || TD.phase === 'goal') {
      pl.x += input * P.steeringStrength * (0.35 + 0.65 * spct) * dt;                                                   // ハンドル → 横の移動
      pl.x -= cur * P.curveDriftStrength * spct * spct * dt;                                                           // カーブでは、外へ流れる（ハンドルが、必要）
      const off = Math.abs(pl.x) > P.grassX;                                                                            // 草地：灰色の道路や縁石の上では、遅くならない
      const I = TDC.items; const ef = TD.effect; const emul = ef ? (ef.kind === 'up' ? I.upMul : I.downMul) : 1;
      let target = P.maxSpeed * (off ? P.grassSpeedMultiplier : 1) * emul * (1 - P.steerScrub * input * input); if (TD.phase === 'goal') target = 0;        // 大きくハンドルを切るほど、すこしだけ速さが落ちる（なめらかな運転ほど、速い）
      if (pl.speed < target) pl.speed = Math.min(target, pl.speed + P.acceleration * (ef && ef.kind === 'up' ? 2.2 : spct < 0.85 ? 1.5 : 1) * dt); else pl.speed = Math.max(target, pl.speed - (off || (ef && ef.kind === 'down') ? P.grassDecel : P.coast) * dt);
      if (ef) { ef.t -= dt; if (ef.t <= 0) TD.effect = null; }
      for (const it of TD.items) {                                                                                     // アイテムに ぶつかったら、効果が はじまる（3秒間）
        if (it.used) continue; const dz = it.z - pl.z; if (Math.abs(dz) < I.hitZ && Math.abs(pl.x - it.x) < P.carHalf + I.hitX) {
          it.used = true; TD.effect = { kind: it.kind, t: I.duration }; TD.fxT = 0; TD.shake = it.kind === 'down' ? 0.2 : 0;
          if (it.kind === 'up') { [784, 988, 1319, 1760].forEach((f, k) => beep(f, k * 0.05, 0.08, 0.05, 'square')); } else { [330, 262, 196, 147].forEach((f, k) => beep(f, k * 0.06, 0.1, 0.05, 'sawtooth')); }
        }
      }
      if (off && pl.speed > 300) { TD.shake = Math.max(TD.shake, 0.12); TD.sfxT -= dt; if (TD.sfxT <= 0) { TD.sfxT = 0.09; noise(0.04, 0.03); } }
      TD.wallCd -= dt; if (Math.abs(pl.x) > P.wallX) {                                                                  // 壁・ガードレール：横を止めて、一度だけ減速（止まりつづけない）
        pl.x = Math.sign(pl.x) * P.wallX; if (TD.wallCd <= 0) { TD.wallCd = 0.45; pl.speed *= (1 - P.wallSpeedLoss); TD.shake = 0.3; beep(160, 0, 0.1, 0.06, 'sawtooth', 90); noise(0.08, 0.05); if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* ok */ } } }
      }
      pl.z += pl.speed * dt; pl.tilt += (input * 7 - pl.tilt) * (1 - Math.exp(-10 * dt));
    }
    // CPU
    TD.hitCd -= dt;
    for (const c of TD.cpus) {
      c.ph += dt * (0.6 + c.skill); const cc = tdCurveAt(c.z); const slow = 1 - Math.abs(cc) * TDC.cpuCurvePenalty * (1.2 - c.skill);
      let tspd = TD.phase === 'ready' || TD.phase === 'count' ? 0 : P.maxSpeed * c.base * TD.dev.cpuMul * slow; if (c.goal) tspd *= 0.4;
      if (c.speed < tspd) c.speed = Math.min(tspd, c.speed + P.acceleration * 0.95 * dt); else c.speed = Math.max(tspd, c.speed - P.coast * dt);
      const tx = clamp(c.bias + Math.sin(c.ph) * c.wob, -0.8, 0.8); c.x += (tx - c.x) * (1 - Math.exp(-1.6 * dt)); c.z += c.speed * dt; if (!c.goal && c.z >= TD.trackLen) c.goal = true;
    }
    for (let i = 0; i < TD.cpus.length; i++) for (let j = i + 1; j < TD.cpus.length; j++) {                              // CPU どうしが、かさならないように
      const a = TD.cpus[i]; const b = TD.cpus[j]; if (Math.abs(a.z - b.z) < 220 && Math.abs(a.x - b.x) < 0.3) { const s = a.x >= b.x ? 1 : -1; a.x += s * 0.6 * dt; b.x -= s * 0.6 * dt; }
    }
    if (TD.phase === 'race' || TD.phase === 'goal') {                                                                   // プレイヤーと CPU の、接触
      for (const c of TD.cpus) {
        const dz = c.z - pl.z; const dxr = pl.x - c.x;
        if (Math.abs(dz) < P.hitZ && Math.abs(dxr) < P.hitX) {
          const side = Math.abs(dxr) < 0.02 ? (pl.x >= 0 ? -1 : 1) : Math.sign(dxr);
          pl.x += side * P.collisionPush * dt; c.x -= side * P.collisionPush * 0.6 * dt;
          if (TD.hitCd <= 0) { TD.hitCd = 0.3; pl.speed *= (1 - P.cpuCollisionSpeedLoss); c.speed *= (1 - P.cpuCollisionSpeedLoss * 0.7); TD.shake = 0.25; beep(220, 0, 0.07, 0.06, 'square', 140); noise(0.05, 0.04); if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) { /* ok */ } } }
          if (dz > 0 && Math.abs(dxr) < P.hitX * 0.6) pl.speed = Math.min(pl.speed, c.speed * 0.98);                       // うしろから ぶつかったら、車の中を すりぬけない
        }
      }
    }
    TD.camZ = pl.z - TD_CAR_DZ; TD.shake = Math.max(0, TD.shake - dt * 1.5);
    TD.bgScroll += cur * spct * dt * 18; 
    // 順位
    const all = [{ c: null, z: pl.z }].concat(TD.cpus.map((c) => ({ c, z: c.z }))); all.sort((a, b) => b.z - a.z); TD.place = all.findIndex((q) => q.c === null) + 1;
  }
  function tdAuto() {                                                                                                   // DEV：かんたんな自動運転（ライン取り・カーブの先読み）
    const pl = TD.player; const R = TDC.steering; const P = TDC.physics; const la = P.maxSpeed / 2250; const cur = tdCurveAt(pl.z + 1400 * la); const now = tdCurveAt(pl.z);
    let target = clamp(cur * 0.55, -0.55, 0.55);
    for (const it of TD.items) { if (it.used) continue; const dzi = it.z - pl.z; if (dzi > 0 && dzi < 2200 * la) { if (it.kind === 'up') target = it.x; else if (Math.abs(it.x - target) < 0.4) target = it.x > 0 ? it.x - 0.6 : it.x + 0.6; break; } }
    for (const c of TD.cpus) { const dz = c.z - pl.z; if (dz > 0 && dz < 1500 * la && Math.abs(c.x - target) < 0.45) target = c.x > 0 ? c.x - 0.55 : c.x + 0.55; }
    const err = TD.dev.autoErr || 0; if (err) { TD.dev.errW = (TD.dev.errW || 0) * 0.97 + (Math.random() - 0.5) * 0.12; target += TD.dev.errW * err * 3; }              // テスト用：ヘタな運転（ふらつき・反応のおくれ）
    const need = (target - pl.x) * 1.1 + now * P.curveDriftStrength / P.steeringStrength * 0.9; const n = clamp(need / 1, -1, 1);
    let want = Math.sign(n) * Math.pow(Math.abs(n), 1 / R.curve) * R.maxAngle;
    if (TD.dev.autoHold) { if (!TD.dev.holdT || TD.raceT >= TD.dev.holdT) { TD.dev.holdT = TD.raceT + TD.dev.autoHold; TD.dev.wantAng = want * (TD.dev.autoGain || 1); } want = TD.dev.wantAng; }                // テスト用：反応のおくれ（ホールド）と、切りすぎ・足りなさ
    TD.steer += (clamp(want, -R.maxAngle, R.maxAngle) - TD.steer) * (err ? 0.1 : 0.35); TD.steerHeld = true;
  }
  function tdUpdate(dt) {
    TD.clock += dt; if (TD.paused) return; dt = Math.min(dt, 0.05); const ph = TD.phase;
    if (ph === 'ready') { TD.t += dt; tdStep(dt); if (TD.t > 1.4) { TD.phase = 'count'; TD.t = 0; } }
    else if (ph === 'count') { const was = Math.floor(TD.t / 0.8); TD.t += dt; tdStep(dt); const k = Math.floor(TD.t / 0.8); if (k !== was && k < 3) beep(660 + k * 110, 0, 0.1, 0.05, 'square'); if (TD.t >= 2.4) { TD.phase = 'race'; TD.t = 0; TD.raceT = 0; beep(1568, 0, 0.25, 0.06, 'square'); } }
    else if (ph === 'race') {
      let rem = dt; while (rem > 0) { const d = Math.min(rem, 1 / 120); TD.raceT += d; tdStep(d); rem -= d; if (TD.phase !== 'race') break; if (TD.player.z >= TD.trackLen) { TD.phase = 'goal'; TD.goalT = 0; TD.result = { time: TD.raceT, place: TD.place }; beep(1047, 0, 0.12, 0.06); beep(1568, 0.1, 0.2, 0.06); break; } }
      TD.engT -= dt; if (TD.engT <= 0) { TD.engT = 0.11; beep(70 + clamp(TD.player.speed / TDC.physics.maxSpeed, 0, 1) * 90, 0, 0.07, 0.014, 'sawtooth'); }
    }
    else if (ph === 'goal') { TD.goalT += dt; tdStep(dt); if (TD.goalT > 2.0) tdFinish(); }
    else if (ph === 'result') { TD.t += dt; for (let i = TD.parts.length - 1; i >= 0; i--) { const p = TD.parts[i]; p.life += dt; p.y += p.vy * dt; p.x += p.vx * dt; p.vy += 40 * dt; if (p.life > p.max) TD.parts.splice(i, 1); } if (TD.result && TD.result.place === 1 && TD.parts.length < 40 && Math.random() < 0.3) TD.parts.push({ x: 20 + Math.random() * (W - 40), y: 20, vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 30, life: 0, max: 1.4, color: ['#ffd84a', '#ff7ab8', '#5ab8ff', '#7dff8a'][Math.floor(Math.random() * 4)] }); }
    else if (ph === 'select') TD.t += dt;
  }
  function tdFinish() {
    const R = TD.result; const rec = P_().topDriver.courses[TD.course.id] || (P_().topDriver.courses[TD.course.id] = { bestTime: 0, bestPlace: 0 });
    if (!TD.dev.auto) { if (!rec.bestTime || R.time < rec.bestTime) { rec.bestTime = Math.round(R.time * 100) / 100; TD.newRecord = true; } if (!rec.bestPlace || R.place < rec.bestPlace) rec.bestPlace = R.place; writeSave(); }
    TD.phase = 'result'; TD.t = 0; TD.parts = []; [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle')); if (TD.newRecord) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.5 + i * 0.08, 0.14, 0.05));
  }
  // ---- 描画：疑似3D ----
  function tdProject() {                                                                                                // 画面の1行ごとに、道路の中心の x と、半幅を計算
    const camZ = TD.camZ; const camX = TD.player ? clamp(TD.player.x * TDC.camFollow, -1.5, 1.5) : 0; let x = 0; let dx = 0; const K = TDC.curveScale;
    for (let i = TDV.iMax; i >= 1; i--) {
      const z = TDV.rowZ[i]; const dzr = i === TDV.iMax ? 0 : z - TDV.rowZ[i + 1]; const c = tdCurveAt(camZ + z); dx += c * K * dzr; x += dx * dzr;
      const sc = TDV.focal / z; TD.cxRow[i] = W / 2 + (x - camX * TDV.roadHalf) * sc; TD.halfRow[i] = TDV.roadHalf * sc;
    }
  }
  function tdBand(c, hz, sc) {                                                                                           // 地平線のところの景色：コースごとに ちがう
    const sun = c.sun; const w = W + 80; const wrap = (v) => ((v % w) + w) % w - 40; const lit = c.dark > 0.15;
    if (c.band === 'sea') {
    for (let k = 0; k < 6; k++) { const mx = Math.round(((k * 56 - sc * 0.7) % (W + 80) + (W + 80)) % (W + 80)) - 40; const mh = 12 + (k * 7) % 14; rect(mx, hz - 10 - mh, 44, mh, c.hill); rect(mx + 8, hz - 10 - mh - 5, 24, 5, c.hill); }          // 遠くの山・島
      rect(8, hz - 10, W - 16, 10, c.sea);
      if (c.dark > 0 && c.dark < 0.4) { for (let k = 0; k < 6; k++) { ctx.globalAlpha = 0.28; rect(Math.round(sun.x - 12 - sc * 0.2 + k * 3), hz - 9 + k * 1, 24 - k * 3, 1, sun.c); ctx.globalAlpha = 1; } }                      // 夕日が、海にうつる
      if (c.dark >= 0.4) { for (let k = 0; k < 5; k++) { ctx.globalAlpha = 0.3; rect(Math.round(sun.x - 8 - sc * 0.2 + k * 2), hz - 9 + k * 2, 16 - k * 3, 1, '#d8d8f0'); ctx.globalAlpha = 1; } }          // 月が、海にうつる
      for (let k = 0; k < 14; k++) { const sx = Math.round(((k * 31 - sc * 0.9 + Math.sin(TD.clock + k) * 2) % (W + 20) + (W + 20)) % (W + 20)); ctx.globalAlpha = c.dark > 0.4 ? 0.28 : 0.5; rect(sx, hz - 8 + (k % 3) * 3, 6, 1, c.dark > 0.4 ? '#9ab0e0' : '#ffffff'); ctx.globalAlpha = 1; }
      return;
    }
    if (c.band === 'city') {
      for (let k = 0; k < 13; k++) { const bx = Math.round(wrap(k * 33 - sc * 0.7)); const bh = 14 + ((k * 37) % 32); rect(bx, hz - 8 - bh, 28, bh, c.hill); rect(bx + 4, hz - 8 - bh - 3, 20, 3, c.hill); if (lit) for (let wy = hz - 8 - bh + 3; wy < hz - 10; wy += 5) for (let wx = bx + 3; wx < bx + 25; wx += 6) { if (((wx + wy + k) % 3) !== 0) rect(wx, wy, 2, 2, '#ffe890'); } }
      rect(8, hz - 8, W - 16, 8, c.sea); return;
    }
    if (c.band === 'mountain') {
      for (let k = 0; k < 4; k++) { const bx = Math.round(wrap(k * 70 + 10 - sc * 0.5)); const hh = 40 + ((k * 13) % 16); const bw = 84; for (let r = 0; r < hh; r++) { const ww = Math.round(bw * (r + 1) / hh); rect(bx + Math.round((bw - ww) / 2), hz - 8 - hh + r, ww, 1, r < 9 ? mixHex(c.hill, '#ffffff', 0.7) : c.hill); } }
      rect(8, hz - 8, W - 16, 8, c.sea); return;
    }
    if (c.band === 'dune') {
      for (let k = 0; k < 5; k++) { const bx = Math.round(wrap(k * 56 - sc * 0.6)); const hh = 10 + ((k * 11) % 12); for (let r = 0; r < hh; r++) { const t = r / hh; const ww = Math.round(90 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))); rect(bx + Math.round((90 - ww) / 2), hz - 8 - hh + r, ww, 1, c.hill); } }
      rect(8, hz - 8, W - 16, 8, c.sea); return;
    }
    for (let k = 0; k < 26; k++) {                                                                                      // 森・雪原：木のならび
      const bx = Math.round(wrap(k * 16 - sc * 0.8)); const hh = 12 + ((k * 7) % 12); const snow = c.band === 'snow';
      for (let r = 0; r < hh; r++) { const ww = Math.max(1, Math.round(12 * (r + 1) / hh)); rect(bx + Math.round((12 - ww) / 2), hz - 8 - hh + r, ww, 1, snow ? (r % 5 < 2 ? '#f4f8ff' : mixHex(c.hill, '#3a5a7a', 0.5)) : c.hill); }
    }
    if (c.band === 'snow') for (let k = 0; k < 4; k++) { const bx = Math.round(wrap(k * 64 - sc * 0.4)); for (let r = 0; r < 14; r++) { const ww = Math.round(100 * Math.sqrt(Math.max(0, 1 - (1 - r / 14) * (1 - r / 14)))); rect(bx + Math.round((100 - ww) / 2), hz - 8 - 14 + r, ww, 1, c.hill); } }
    rect(8, hz - 8, W - 16, 8, c.sea);
  }
  function tdSky() {
    const c = tdLook(); const vt = TDV.top; const hz = TDV.horizon; const sc = TD.bgScroll;
    for (let y = vt; y < hz - 10; y++) rect(8, y, W - 16, 1, mixHex(c.skyTop, c.skyBot, (y - vt) / (hz - 10 - vt)));
    if (c.stars) for (let i = 0; i < 40; i++) { const sx = 10 + (i * 37) % (W - 20); const sy = vt + 2 + (i * 53) % 44; ctx.globalAlpha = 0.45 + 0.4 * Math.sin(TD.clock * 0.9 + i * 1.7); rect(Math.round(sx - sc * 0.15) % (W - 16) + 8 > 8 ? Math.round(((sx - sc * 0.15) % (W - 20) + (W - 20)) % (W - 20)) + 10 : sx, sy, 1, 1, '#ffffff'); ctx.globalAlpha = 1; }          // 星（ゆっくり）
    const sun = c.sun; const sx0 = Math.round(sun.x - sc * 0.2); const sy0 = sun.y;                                       // 太陽・夕日・月
    ctx.globalAlpha = sun.glow; rect(sx0 - sun.r - 4, sy0 - sun.r - 4, sun.r * 2 + 8, sun.r * 2 + 8, sun.c); ctx.globalAlpha = 1; rect(sx0 - sun.r, sy0 - sun.r, sun.r * 2, sun.r * 2, sun.c);
    if (c.dark >= 0.4) { rect(sx0 - sun.r + 3, sy0 - sun.r + 1, sun.r, sun.r, mixHex(sun.c, '#8a8aa8', 0.5)); }
    ctx.globalAlpha = c.dark > 0.4 ? 0.5 : 0.85; for (const [cx, cy, cw] of [[30, 38, 26], [118, 28, 32], [170, 48, 22]]) { const ox = Math.round(((cx - sc * 0.4) % (W + 40) + (W + 40)) % (W + 40)) - 20; rect(ox, cy, cw, 5, c.cloud); rect(ox + 4, cy - 3, cw - 10, 4, c.cloud); rect(ox + 2, cy + 5, cw - 6, 2, mixHex(c.cloud, c.skyBot, 0.4)); } ctx.globalAlpha = 1;       // くも
    tdBand(c, hz, sc);
  }
  function tdRoad() {
    const c = tdLook(); const camZ = TD.camZ; const hz = TDV.horizon; const Lf = 8; const Rt = W - 8; const strip = 400;
    for (let i = TDV.iMax; i >= 1; i--) {
      const y = hz + i; const z = TDV.rowZ[i]; const zw = camZ + z; const cx = TD.cxRow[i]; const half = TD.halfRow[i]; const stripe = Math.floor(zw / strip) % 2 === 0;
      rect(Lf, y, Rt - Lf, 1, stripe ? c.grassA : c.grassB);
      const rl = Math.round(cx - half); const rr = Math.round(cx + half); const rw = Math.max(1, Math.round(half * 0.09));
      const rumble = tdTint(Math.floor(zw / 200) % 2 === 0 ? '#ff4a4a' : '#ffffff');
      const l1 = Math.max(Lf, rl - rw); const r1 = Math.min(Rt, rr + rw);
      if (r1 > l1) rect(l1, y, r1 - l1, 1, rumble);
      const a = Math.max(Lf, rl); const b = Math.min(Rt, rr); if (b > a) rect(a, y, b - a, 1, stripe ? c.roadA : c.roadB);
      if (Math.floor(zw / 400) % 2 === 0) { const lw = Math.max(1, Math.round(half * 0.025)); const lx = Math.round(cx - lw / 2); if (lx >= Lf && lx + lw <= Rt) rect(lx, y, lw, 1, c.dark > 0.4 ? '#e8e8ff' : tdTint('#ffffff')); }
      const fz = TD.trackLen; if (zw >= fz && zw < fz + 150) { const q = Math.max(1, Math.round(half / 8)); for (let k = -4; k < 4; k++) { if ((k + Math.floor(zw / 40)) % 2 === 0) { const qx = Math.round(cx + k * q); const ql = Math.max(Lf, qx); const qr = Math.min(Rt, qx + q); if (qr > ql) rect(ql, y, qr - ql, 1, '#ffffff'); else continue; } else { const qx = Math.round(cx + k * q); const ql = Math.max(Lf, qx); const qr = Math.min(Rt, qx + q); if (qr > ql) rect(ql, y, qr - ql, 1, '#222222'); } } }
      const gx = Math.round(half * TDC.physics.wallX * 1.03); const gw = Math.max(1, Math.round(half * 0.03)); const gc = tdTint(stripe ? '#e8e8f0' : '#9aa0b8');           // ガードレール
      const gl = Math.round(cx - gx); const gr = Math.round(cx + gx); if (gl >= Lf && gl < Rt) rect(gl, y, gw, 1, gc); if (gr >= Lf && gr + gw <= Rt) rect(gr, y, gw, 1, gc);
    }
  }
  function tdRowAt(dz) { return clamp(TDV.camH * TDV.focal / dz, 1, TDV.iMax + 40); }
  function tdDrawCar(cx, by, wpx, color, tilt, rear) {
    color = tdTint(color); const night = tdLook().dark > 0.4;                                                                     // 車（うしろ姿）。cx：中心 x／by：足もと y／wpx：よこ幅
    const u = wpx / 30; if (wpx < 3) { rect(Math.round(cx - wpx / 2), Math.round(by - wpx * 0.5), Math.max(2, Math.round(wpx)), Math.max(1, Math.round(wpx * 0.5)), color); return; }
    ctx.save(); ctx.translate(Math.round(cx), Math.round(by)); ctx.rotate((tilt || 0) * Math.PI / 180);
    const R = (x, y, w, h, col) => rect(Math.round(x * u - wpx / 2), Math.round(-(16 - y) * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)), col);
    ctx.globalAlpha = 0.35; rect(Math.round(-wpx / 2 + u), Math.round(-u), Math.round(wpx - 2 * u), Math.max(1, Math.round(2 * u)), '#000000'); ctx.globalAlpha = 1;
    R(0, 11, 5, 5, '#16161e'); R(25, 11, 5, 5, '#16161e');                                    // タイヤ
    R(1, 5, 28, 8, color); R(1, 5, 28, 2, mixHex(color, '#ffffff', 0.35)); R(0, 12, 30, 2, mixHex(color, '#000000', 0.45));   // 車体
    R(6, 0, 18, 7, mixHex(color, '#000000', 0.15)); R(8, 1, 14, 5, '#243a5a'); R(8, 1, 14, 1, '#4a6a9a');                     // キャビン・まど
    R(2, 8, 5, 3, '#ff3a3a'); R(23, 8, 5, 3, '#ff3a3a'); R(12, 10, 6, 3, night ? '#a0a0b0' : '#f0f0f0');            // テールランプ・ナンバー
    if (night) { ctx.globalAlpha = 0.35; R(-1, 7, 8, 5, '#ff4a4a'); R(23, 7, 8, 5, '#ff4a4a'); ctx.globalAlpha = 1; }          // 夜は、テールランプが光る
    ctx.restore();
  }
  function tdDrawObj(o, cx, by, sc) {
    const s = sc; const dk = tdLook().dark;
    if (o.type === 'palm') { const th = 700 * s; const tw = Math.max(1, 60 * s); rect(Math.round(cx - tw / 2), Math.round(by - th), Math.round(tw), Math.round(th), tdTint('#8a5a2a')); const lw = 380 * s; const ly = by - th; rect(Math.round(cx - lw), Math.round(ly - 40 * s), Math.round(lw * 2), Math.max(2, Math.round(70 * s)), tdTint('#2ea84a')); rect(Math.round(cx - lw * 0.7), Math.round(ly - 90 * s), Math.round(lw * 1.4), Math.max(2, Math.round(70 * s)), tdTint('#3ecb5a')); rect(Math.round(cx - lw * 0.5), Math.round(ly), Math.round(lw), Math.max(1, Math.round(50 * s)), tdTint('#2ea84a')); }
    else if (o.type === 'lamp') { const th = 800 * s; const tw = Math.max(1, 40 * s); rect(Math.round(cx - tw / 2), Math.round(by - th), Math.round(tw), Math.round(th), tdTint('#707890')); rect(Math.round(cx - 120 * s), Math.round(by - th - 30 * s), Math.round(240 * s), Math.max(1, Math.round(50 * s)), '#fff3a0'); if (dk > 0.3) { ctx.globalAlpha = 0.28; rect(Math.round(cx - 380 * s), Math.round(by - th - 150 * s), Math.round(760 * s), Math.max(2, Math.round(300 * s)), '#ffe890'); ctx.globalAlpha = 1; } }
    else if (o.type === 'sign') { const th = 500 * s; const tw = Math.max(1, 40 * s); rect(Math.round(cx - tw / 2), Math.round(by - th), Math.round(tw), Math.round(th), tdTint('#707890')); const bw = 360 * s; const bh = 220 * s; rect(Math.round(cx - bw / 2), Math.round(by - th - bh * 0.6), Math.round(bw), Math.round(bh), tdTint('#ffffff')); rect(Math.round(cx - bw / 2 + 2), Math.round(by - th - bh * 0.6 + 2), Math.max(1, Math.round(bw - 4)), Math.max(1, Math.round(bh - 4)), o.col); }
    else if (o.type === 'building') { const bw = 560 * s; const bh = (1100 + o.bh) * s; rect(Math.round(cx - bw / 2), Math.round(by - bh), Math.round(bw), Math.round(bh), tdTint(o.bcol)); rect(Math.round(cx - bw / 2), Math.round(by - bh), Math.round(bw), Math.max(1, Math.round(60 * s)), tdTint('#3a3a50')); const lit = dk > 0.15; for (let wy = by - bh + 150 * s; wy < by - 120 * s; wy += 190 * s) for (let wx = cx - bw / 2 + 90 * s; wx < cx + bw / 2 - 120 * s; wx += 170 * s) rect(Math.round(wx), Math.round(wy), Math.max(1, Math.round(80 * s)), Math.max(1, Math.round(100 * s)), lit ? '#ffe890' : tdTint('#bfd8f0')); }
    else if (o.type === 'pine' || o.type === 'snowpine') { const tw = Math.max(1, 60 * s); rect(Math.round(cx - tw / 2), Math.round(by - 240 * s), Math.round(tw), Math.round(240 * s), tdTint('#6a4a2a')); for (let k = 0; k < 4; k++) { const w2 = (150 + k * 120) * s; const yy = by - (260 + 520 - k * 160) * s; rect(Math.round(cx - w2 / 2), Math.round(yy), Math.round(w2), Math.max(2, Math.round(190 * s)), tdTint(o.type === 'snowpine' && k < 2 ? '#f4f8ff' : '#1f7a3a')); if (o.type === 'snowpine' && k >= 2) rect(Math.round(cx - w2 / 2), Math.round(yy), Math.round(w2), Math.max(1, Math.round(50 * s)), tdTint('#f4f8ff')); } }
    else if (o.type === 'cactus') { const tw = Math.max(2, 90 * s); const th = 560 * s; const cc = tdTint('#3a9a4a'); rect(Math.round(cx - tw / 2), Math.round(by - th), Math.round(tw), Math.round(th), cc); rect(Math.round(cx - 190 * s), Math.round(by - 380 * s), Math.round(150 * s), Math.max(1, Math.round(70 * s)), cc); rect(Math.round(cx - 190 * s), Math.round(by - 520 * s), Math.max(2, Math.round(70 * s)), Math.round(210 * s), cc); rect(Math.round(cx + 40 * s), Math.round(by - 300 * s), Math.round(150 * s), Math.max(1, Math.round(70 * s)), cc); rect(Math.round(cx + 120 * s), Math.round(by - 460 * s), Math.max(2, Math.round(70 * s)), Math.round(210 * s), cc); }
    else { const rw = 420 * s; const rh = 240 * s; rect(Math.round(cx - rw / 2), Math.round(by - rh), Math.round(rw), Math.round(rh), tdTint('#9a9aa8')); rect(Math.round(cx - rw / 2), Math.round(by - rh), Math.round(rw), Math.max(1, Math.round(rh * 0.3)), tdTint('#c0c0d0')); }
  }
  function tdDrawItem(it, cx, by, half) {                                                                                // アイテム：遠くからも、色と形で、見分けられる
    const up = it.kind === 'up'; const w = Math.max(5, Math.round(0.34 * half)); const h = Math.round(w * 0.9); const x = Math.round(cx - w / 2); const y = Math.round(by - h);
    const pul = 0.55 + 0.45 * Math.sin(TD.clock * 4 + it.z);
    ctx.globalAlpha = 0.28 + 0.2 * pul; rect(x - 2, y - 2, w + 4, h + 4, up ? '#b8ff6a' : '#ff6a8a'); ctx.globalAlpha = 1;
    rect(x, y, w, h, up ? '#1a5a1a' : '#4a1a3a'); rect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2), up ? '#7dff4a' : '#ff4a7a');
    if (w >= 9) {
      const cxm = x + w / 2; const m = Math.max(1, Math.round(w / 9));
      for (let k = 0; k < 4; k++) { const rw = (up ? k + 1 : 4 - k) * m * 2; rect(Math.round(cxm - rw / 2 + (up ? 0 : 0)), y + Math.round(h * 0.2) + k * m * 2, rw, m * 2, '#ffffff'); }       // ▲（UP）／▼（DOWN）
      if (!up) rect(Math.round(cxm - m / 2), y + h - m * 3, m, m * 2, '#ffffff');
    }
  }
  function tdSprites() {
    const camZ = TD.camZ; const hz = TDV.horizon; const list = [];
    for (const o of TD.objs) { const dz = o.z - camZ; if (dz > 230 && dz < 14500) list.push({ dz, o }); else if (dz >= 14500) break; }
    for (const c of TD.cpus) { const dz = c.z - camZ; if (dz > 150 && dz < 14500) list.push({ dz, c }); }
    for (const it of TD.items) { if (it.used) continue; const dz = it.z - camZ; if (dz > 120 && dz < 14500) list.push({ dz, it }); }
    list.sort((a, b) => b.dz - a.dz);
    ctx.save(); ctx.beginPath(); ctx.rect(8, TDV.top, W - 16, TDV.bottom - TDV.top); ctx.clip();
    for (const q of list) {
      const i = tdRowAt(q.dz); const ri = Math.min(TDV.iMax, Math.max(1, Math.round(i))); const sc = TDV.focal / q.dz; const half = TDV.roadHalf * sc; const cx = (TD.cxRow[ri] || W / 2); const by = hz + i;
      if (q.o) tdDrawObj(q.o, cx + q.o.lat * half, by, sc);
      else if (q.it) tdDrawItem(q.it, cx + q.it.x * half, by, half);
      else { const wpx = TDC.physics.carHalf * 2 * half; tdDrawCar(cx + q.c.x * half, by, wpx, q.c.color, 0); if (TD.dev.cpu) drawText(q.c.name + ' P' + Math.round(q.c.z / 100), Math.round(cx + q.c.x * half - 12), Math.round(by - wpx), '#ffffff', 1); }
    }
    ctx.restore();
  }
  function tdFx() {                                                                                                      // アイテムの効果：画面のふちに、色とすじ
    const ef = TD.effect; if (!ef) return; TD.fxT += 1 / 60; const up = ef.kind === 'up'; const col = up ? '#9aff5a' : '#ff4a6a';
    ctx.globalAlpha = 0.16 + 0.06 * Math.sin(TD.clock * 6); rect(8, TDV.top, 6, TDV.bottom - TDV.top, col); rect(W - 14, TDV.top, 6, TDV.bottom - TDV.top, col); ctx.globalAlpha = 1;
    if (up) for (let k = 0; k < 10; k++) { const yy = TDV.horizon + 20 + ((TD.clock * 260 + k * 31) % (TDV.bottom - TDV.horizon - 20)); const xx = (k % 2 ? 14 + (k * 7) % 28 : W - 14 - 6 - (k * 5) % 28); ctx.globalAlpha = 0.5; rect(xx, Math.round(yy), 1, 8, '#ffffff'); ctx.globalAlpha = 1; }
    const lab = up ? 'SPEED UP!' : 'SPEED DOWN'; drawTextCenter(lab, W / 2, 46, col, 2, '#10102a'); rect(W / 2 - 24, 64, 48, 3, '#10102a'); rect(W / 2 - 24, 64, Math.round(48 * clamp(ef.t / TDC.items.duration, 0, 1)), 3, col);
  }
  function tdHeadlights() {                                                                                              // 夕方・夜：ヘッドライトが、前の道を てらす
    const dk = tdLook().dark; if (dk < 0.15) return; const cx = TD.cxRow[TD_CAR_ROW]; const pl = TD.player; const camX = clamp(pl.x * TDC.camFollow, -1.5, 1.5); const px0 = cx + pl.x * TD.halfRow[TD_CAR_ROW];
    ctx.save(); ctx.beginPath(); ctx.rect(8, TDV.top, W - 16, TDV.bottom - TDV.top); ctx.clip(); ctx.globalAlpha = Math.min(0.3, dk * 0.55);
    for (let i = TD_CAR_ROW - 8; i > TD_CAR_ROW - 70; i -= 2) { const t = (TD_CAR_ROW - i) / 62; const w2 = Math.round(16 + t * 6); rect(Math.round(px0 - w2), TDV.horizon + i, w2 * 2, 2, '#fff2a8'); ctx.globalAlpha = Math.min(0.3, dk * 0.55) * (1 - t * 0.9); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function tdDrawPlayer() {
    const pl = TD.player; const camX = clamp(pl.x * TDC.camFollow, -1.5, 1.5); const half = TD.halfRow[TD_CAR_ROW]; const cx = TD.cxRow[TD_CAR_ROW] + pl.x * half; const wpx = TDC.physics.carHalf * 2 * half;          // 車の位置＝道路の中心から、実際の roadX ぶん（カメラのずれは、道路のほうに、すでに入っている）
    ctx.save(); ctx.beginPath(); ctx.rect(8, TDV.top, W - 16, TDV.bottom - TDV.top + 4); ctx.clip(); const bob = pl.speed > 200 ? Math.round(Math.sin(TD.clock * 40) * 0.6) : 0; tdDrawCar(cx, TDV.horizon + TD_CAR_ROW + 2 + bob, wpx, '#ff3a5a', pl.tilt); ctx.restore();
    if (TD.dev.box) { rect(Math.round(cx - wpx / 2), TDV.horizon + TD_CAR_ROW - 24, Math.round(wpx), 1, '#00ff88'); rect(Math.round(cx - wpx / 2), TDV.horizon + TD_CAR_ROW, Math.round(wpx), 1, '#00ff88'); }
  }
  function tdWheelDraw(w0, ang0) {
    const w = w0 || tdWheel(); const k = w.r / 52; const ang = ang0 === undefined ? TD.steer : ang0;
    if (!w0) { rect(8, TDV.bottom + 2, W - 16, H - TDV.bottom - 10, '#14141c'); rect(8, TDV.bottom + 2, W - 16, 2, '#3a3a52'); }
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(ang * Math.PI / 180);
    ctx.lineCap = 'butt'; ctx.strokeStyle = '#0a0a10'; ctx.lineWidth = 15 * k; ctx.beginPath(); ctx.arc(0, 0, w.r - 6 * k, 0, 6.2832); ctx.stroke();               // ふち
    ctx.strokeStyle = '#4a4a62'; ctx.lineWidth = 11 * k; ctx.beginPath(); ctx.arc(0, 0, w.r - 6 * k, 0, 6.2832); ctx.stroke(); ctx.strokeStyle = '#6a6a88'; ctx.lineWidth = Math.max(1, 3 * k); ctx.beginPath(); ctx.arc(0, 0, w.r - 9 * k, 3.4, 5.9); ctx.stroke();
    ctx.fillStyle = '#34344a'; for (const a of [Math.PI, 0, Math.PI / 2]) { ctx.save(); ctx.rotate(a); ctx.fillRect(0, -4 * k, w.r - 10 * k, 8 * k); ctx.restore(); }          // スポーク
    ctx.fillStyle = '#ff3a5a'; ctx.fillRect(-3 * k, -w.r + 2 * k, 6 * k, 11 * k);                                                                                           // 12時の目じるし（回っているのが、わかる）
    ctx.fillStyle = '#22222e'; ctx.beginPath(); ctx.arc(0, 0, 14 * k, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(0, 0, 6 * k, 0, 6.2832); ctx.fill();
    ctx.restore();
    if (!w0 && TD.finger) { ctx.globalAlpha = 0.5; rect(Math.round(TD.finger.x) - 3, Math.round(TD.finger.y) - 3, 7, 7, '#ffffff'); ctx.globalAlpha = 1; }
  }
  const tdFmt = (t) => t.toFixed(2);
  const tdOrd = (n) => (n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : '4TH');
  function tdHud() {
    const pl = TD.player; drawText(tdOrd(TD.place), 14, 12, '#ffe070', 2, '#5a3a10'); drawText('/ ' + (TD.cpus.length + 1), 14 + 4 * 6 + 3, 15, '#ffffff', 1);
    drawText('TIME', W - 14 - 4 * 4 - 40, 12, '#ffffff', 1); drawText(tdFmt(TD.raceT || 0), W - 14 - 6 * 8, 20, '#ffffff', 2, '#1a2a5a');
    drawText(Math.round(pl.speed / TDC.physics.maxSpeed * TDC.speedKmh) + ' KMH', 14, 232, '#ffffff', 1, '#1a2a5a');
    const prog = clamp((pl.z - TD.startZ) / (TD.trackLen - TD.startZ), 0, 1); rect(14, 34, W - 28, 3, '#1a2a4a'); rect(14, 34, Math.round((W - 28) * prog), 3, '#7dff8a'); rect(14 + Math.round((W - 28) * prog) - 1, 32, 3, 7, '#ffffff');
    if (TD.phase === 'count') { const k = Math.min(2, Math.floor(TD.t / 0.8)); drawTextCenter(String(3 - k), W / 2, 110, '#ffffff', 8, '#ff7a3a'); }
    else if (TD.phase === 'race' && TD.raceT < 0.9) drawTextCenter('GO!', W / 2, 110, '#7dff8a', 6, '#0a3a1a');
    else if (TD.phase === 'ready') drawTextCenter('READY?', W / 2, 110, '#ffe070', 4, '#5a3a10');
    else if (TD.phase === 'goal') drawTextCenter('GOAL!', W / 2, 100, '#ffe070', 5, '#5a3a10');
  }
  function tdDevInfo() {
    if (!TD.dev.info && !TD.dev.cpu && !TD.dev.items) return; const pl = TD.player; let y = 42;
    if (TD.dev.info) { for (const t of ['ANGLE ' + Math.round(TD.steer), 'INPUT ' + tdInput().toFixed(2), 'ROADX ' + pl.x.toFixed(2), 'SPEED ' + Math.round(pl.speed), 'Z ' + Math.round(pl.z)]) { drawText(t, 14, y, '#00ff88', 1); y += 7; } }
    if (TD.dev.items) { for (const it of TD.items) { drawText((it.used ? 'x ' : '') + it.kind.toUpperCase() + ' z' + Math.round(it.z) + ' x' + it.x.toFixed(2), 14, y, it.kind === 'up' ? '#9aff5a' : '#ff6a8a', 1); y += 7; } }
    if (TD.dev.cpu) for (const c of TD.cpus) { drawText(c.name + ' ' + Math.round(c.z) + ' X' + c.x.toFixed(2) + ' V' + Math.round(c.speed), 14, y, '#ffaa00', 1); y += 7; }
    if (TD.dev.road) { for (let i = 10; i < TDV.iMax; i += 10) { rect(Math.round(TD.cxRow[i] - TD.halfRow[i]), TDV.horizon + i, 2, 1, '#00ffff'); rect(Math.round(TD.cxRow[i] + TD.halfRow[i]) - 2, TDV.horizon + i, 2, 1, '#00ffff'); } }
  }
  function tdScene(noCar) {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#000'); tdProject();
    const sh = TD.shake > 0 ? Math.round((Math.random() - 0.5) * 4 * Math.min(1, TD.shake * 3)) : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(8, TDV.top, W - 16, TDV.bottom - TDV.top); ctx.clip(); ctx.translate(0, sh); tdSky(); tdRoad(); ctx.restore(); ctx.save(); ctx.translate(0, sh); tdSprites(); if (TD.player && !noCar) { tdHeadlights(); tdDrawPlayer(); } ctx.restore();
  }
  function tdDrawSelect() {
    const n = TDC.courses.length; const cyc = Math.floor(TD.clock / 3.2); TD.courseIdx = cyc % n; TD.tod = TD_TODS[(Math.floor(cyc / n) + cyc) % 3];              // 景色は、6つのコースを、ゆっくり見せる（えらべるのは、お金を入れたあと）
    TD.camZ = 0; TD.player = TD.player || { z: 0, x: 0, speed: 0, tilt: 0 }; const save = { x: TD.player.x, z: TD.player.z }; TD.player.x = 0; TD.player.z = TD_CAR_DZ; TD.cpus = []; TD.items = []; tdBuildCourseOnce(); TD.bgScroll = 0; tdScene(); TD.player.x = save.x; TD.player.z = save.z;
    drawTextCenter('TOP DRIVER', W / 2, 14, '#ffe070', 3, '#5a3a10');
    ctx.globalAlpha = 0.62; rect(8, 150, W - 16, 66, '#0a0a1a'); ctx.globalAlpha = 1;
    drawTextCenter('6 COURSES', W / 2, 158, '#ffffff', 2, '#1a2a5a'); drawTextCenter('PICK 1 OF 3 AFTER INSERT', W / 2, 177, '#ffd890', 1);
    drawTextCenter('YEN ' + P_().money + '   1 PLAY  YEN ' + TDC.price, W / 2, 194, '#7ad8ff', 1);
    tdWheelDraw(undefined, Math.sin(TD.clock * 1.3) * 40);                                                                                              // 下の大きなハンドル（ゆっくり、ゆれる）
  }
  function tdCardRect(k) { return { x: 14, y: 44 + k * 70, w: W - 28, h: 62 }; }
  function tdCardArt(c, x0, y0, w, h) {                                                                                 // コースの小さな絵：空・遠景（海・ビル・山・砂丘・森・雪）・道ばたの木・曲がる道路
    const th = c.theme; const sky = TDC.looks.day; const hz = Math.round(h * 0.44); const band = th.band; const cxm = x0 + w / 2;
    for (let y = 0; y < hz; y++) rect(x0, y0 + y, w, 1, mixHex(sky.skyTop, sky.skyBot, y / hz));
    rect(x0 + w - 16, y0 + 4, 7, 7, '#fff3a0'); rect(x0 + 6, y0 + 6, 12, 2, '#ffffff'); rect(x0 + 8, y0 + 4, 8, 2, '#ffffff'); rect(x0 + 30, y0 + 10, 10, 2, '#ffffff');       // 太陽・くも
    const base = y0 + hz;                                                                                                // 遠景
    if (band === 'sea') { rect(x0, base - 7, w, 7, th.ground); for (let k = 0; k < 4; k++) rect(x0 + 6 + k * 18, base - 5 + (k % 2) * 2, 5, 1, '#bfe0ff'); rect(x0 + 4, base - 13, 14, 6, th.hill); rect(x0 + 40, base - 11, 16, 4, th.hill); }
    else if (band === 'city') { for (let k = 0; k < 9; k++) { const bw = 8; const bh = 9 + ((k * 7) % 14); const bx = x0 + 1 + k * 9; rect(bx, base - bh, bw, bh, th.hill); for (let wy = base - bh + 2; wy < base - 2; wy += 3) { rect(bx + 2, wy, 1, 1, '#ffe890'); rect(bx + 5, wy, 1, 1, '#ffe890'); } } rect(x0, base - 2, w, 2, th.ground); }
    else if (band === 'mountain') { for (let k = 0; k < 3; k++) { const mw = 40; const mh = 22 + ((k * 5) % 8); const mx = x0 - 6 + k * 28; for (let r = 0; r < mh; r++) { const ww = Math.round(mw * (r + 1) / mh); rect(Math.max(x0, mx + Math.round((mw - ww) / 2)), base - mh + r, Math.min(ww, x0 + w - Math.max(x0, mx + Math.round((mw - ww) / 2))), 1, r < 5 ? '#eef4ff' : th.hill); } } rect(x0, base - 2, w, 2, th.ground); }
    else if (band === 'dune') { for (let k = 0; k < 3; k++) { const dw = 50; const dh = 9 + ((k * 4) % 6); const dx = x0 - 8 + k * 30; for (let r = 0; r < dh; r++) { const t = r / dh; const ww = Math.round(dw * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))); rect(Math.max(x0, dx + Math.round((dw - ww) / 2)), base - dh + r, Math.max(0, Math.min(ww, x0 + w - Math.max(x0, dx + Math.round((dw - ww) / 2)))), 1, th.hill); } } rect(x0, base - 1, w, 1, th.ground); }
    else { const snow = band === 'snow'; for (let k = 0; k < 14; k++) { const tx = x0 + 2 + k * 5; const hh = 8 + ((k * 7) % 8); for (let r = 0; r < hh; r++) { const ww = Math.max(1, Math.round(5 * (r + 1) / hh)); rect(tx + Math.round((5 - ww) / 2), base - hh + r, ww, 1, snow ? (r % 4 < 2 ? '#f4f8ff' : '#9ab0d0') : th.hill); } } rect(x0, base - 1, w, 1, th.ground); }
    for (let y = hz; y < h; y++) {                                                                                       // 地面と道路（そのコースの、いちばん強いカーブの向きに、すこし曲がる）
      const t = (y - hz) / (h - hz); const stripe = Math.floor((y - hz) / 3) % 2 === 0; rect(x0, y0 + y, w, 1, stripe ? th.grassA : th.grassB);
      const bend = Math.round(bendDir * (1 - t) * (1 - t) * w * 0.28); const hw = Math.round(2 + t * w * 0.34); const cx = cxm + bend;
      rect(cx - hw - 1, y0 + y, hw * 2 + 2, 1, stripe ? '#ff4a4a' : '#ffffff'); rect(cx - hw, y0 + y, hw * 2, 1, stripe ? th.roadA : th.roadB); if (Math.floor((y - hz) / 4) % 2 === 0) rect(cx, y0 + y, 1, 1, '#ffffff');
    }
    const spots = [[0.25, -1], [0.55, 1], [0.85, -1]];                                                                   // 道ばたの物（そのコースらしい物）
    for (const [t, side] of spots) {
      const y = y0 + hz + Math.round(t * (h - hz)); const bend = Math.round(bendDir * (1 - t) * (1 - t) * w * 0.28); const hw = 2 + t * w * 0.34; const ox = Math.round(cxm + bend + side * (hw + 5 + t * 8)); const k = 0.6 + t * 0.9; const type = c.objs[0][0];                                                                                  // そのコースを、いちばん表す物
      if (type === 'palm') { rect(ox, y - Math.round(12 * k), 1, Math.round(12 * k), '#8a5a2a'); rect(ox - Math.round(4 * k), y - Math.round(14 * k), Math.round(9 * k), 2, '#2ea84a'); rect(ox - Math.round(3 * k), y - Math.round(16 * k), Math.round(7 * k), 2, '#3ecb5a'); }
      else if (type === 'building') { rect(ox - 3, y - Math.round(14 * k), 7, Math.round(14 * k), '#8a86aa'); rect(ox - 2, y - Math.round(12 * k), 1, 1, '#ffe890'); rect(ox + 1, y - Math.round(9 * k), 1, 1, '#ffe890'); }
      else if (type === 'pine' || type === 'snowpine') { for (let r = 0; r < 3; r++) rect(ox - Math.round((2 + r) * k), y - Math.round((12 - r * 3) * k), Math.round((4 + r * 2) * k), Math.max(2, Math.round(4 * k)), type === 'snowpine' && r < 2 ? '#f4f8ff' : '#1f7a3a'); rect(ox, y - Math.round(3 * k), 1, Math.round(3 * k), '#6a4a2a'); }
      else if (type === 'cactus') { rect(ox, y - Math.round(11 * k), 2, Math.round(11 * k), '#3a9a4a'); rect(ox - 3, y - Math.round(7 * k), 3, 1, '#3a9a4a'); rect(ox - 3, y - Math.round(10 * k), 1, 4, '#3a9a4a'); rect(ox + 2, y - Math.round(5 * k), 3, 1, '#3a9a4a'); }
      else { rect(ox - 2, y - Math.round(4 * k), 5, Math.round(4 * k), '#9a9aa8'); rect(ox - 2, y - Math.round(4 * k), 5, 1, '#c0c0d0'); }
    }
    rect(x0, y0, w, 1, '#6a6aa0'); rect(x0, y0 + h - 1, w, 1, '#6a6aa0'); rect(x0, y0, 1, h, '#6a6aa0'); rect(x0 + w - 1, y0, 1, h, '#6a6aa0');
  }
  function tdDrawPick() {                                                                                               // コースの選択（3つ）
    drawFrame(); rect(8, 8, W - 16, H - 16, '#0a0a18'); drawTextCenter('SELECT COURSE', W / 2, 16, '#ffe070', 2, '#5a3a10');
    TD.offer.forEach((ci, k) => {
      const c = TDC.courses[ci]; const r = tdCardRect(k); const rec = P_().topDriver.courses[c.id];
      rect(r.x, r.y, r.w, r.h, '#4a4a7a'); rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, '#14142a');
      const first = c.sections.find((q) => Math.abs(q.curve) > 0.3); bendDir = first ? Math.sign(first.curve) : 0;
      tdCardArt(c, r.x + 4, r.y + 4, 84, 54);
      const nx = r.x + 4 + 84 + 7; drawText(c.name, nx, r.y + 10, '#ffffff', 1);
      const maxC = Math.max(...c.sections.map((q) => Math.abs(q.curve)));
      drawText('CURVES', nx, r.y + 27, '#9ab8ff', 1); for (let q = 0; q < 5; q++) rect(nx + 28 + q * 6, r.y + 27, 5, 5, q < Math.round(maxC * 5) ? '#ffd84a' : '#34344a');
      drawText('BEST ' + (rec && rec.bestTime ? rec.bestTime.toFixed(2) : '--.--'), nx, r.y + 44, '#ffe9a0', 1);
    });
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(TD.clock * 4); drawTextCenter('TAP A COURSE', W / 2, 262, '#ffffff', 1); ctx.globalAlpha = 1;
  }
  function tdBuildCourseOnce() { if (tdBuilt !== tdCourse().id) { tdBuildCourse(); tdBuilt = tdCourse().id; } }
  function tdDrawResult() {
    const R = TD.result; const rec = P_().topDriver.courses[TD.course.id] || {};
    tdScene(); ctx.globalAlpha = 0.72; rect(8, 40, W - 16, 196, '#0a0a1a'); ctx.globalAlpha = 1;
    const first = R.place === 1; drawTextCenter(first ? '1ST PLACE!' : tdOrd(R.place) + ' PLACE', W / 2, 56, first ? '#ffe070' : '#ffffff', 3, first ? '#7a4a10' : '#2a2a5a');
    drawTextCenter('TIME ' + tdFmt(R.time), W / 2, 96, '#ffffff', 2, '#1a2a5a'); drawTextCenter('BEST ' + (rec.bestTime ? tdFmt(rec.bestTime) : '--.--'), W / 2, 122, '#ffe9a0', 1);
    if (TD.newRecord && !TD.dev.auto) drawTextCenter('NEW RECORD!', W / 2, 146, '#7dff8a', 2, '#0a3a1a'); if (TD.dev.auto) drawTextCenter('AUTODRIVE  NO RECORD', W / 2, 146, '#ff6a8a', 1);
    drawTextCenter('YEN ' + P_().money, W / 2, 180, '#7ad8ff', 1);
    for (const p of TD.parts) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); rect(Math.round(p.x), Math.round(p.y), 3, 3, p.color); } ctx.globalAlpha = 1;
  }
  // ---- DOM ----
  const TD_DOM = {};
  function tdBuildDom() {
    if (TD_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + (cls || ''); b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); TD_DOM[id.slice(3)] = b; return b; };
    mk('td-start', '¥100 で スタート', 'td-go').addEventListener('click', () => { ensureAudio(); tdBegin(); });
    mk('td-retry', 'もう一度（¥100）', 'td-go').addEventListener('click', () => { ensureAudio(); tdBegin(); });
    mk('td-menu', 'コース選択へ', 'hb-sub').addEventListener('click', () => { ensureAudio(); TD.phase = 'select'; tdPickTod(); beep(520, 0, 0.05, 0.04, 'square'); });
    mk('td-quit', 'やめる', 'hb-quit').addEventListener('click', () => { ensureAudio(); tdAskQuit(); });
    mk('td-prev', '◀', 'hb-arrow').addEventListener('click', () => { ensureAudio(); TD.courseIdx = (TD.courseIdx + TDC.courses.length - 1) % TDC.courses.length; tdPickTod(); beep(660, 0, 0.04, 0.04, 'square'); });
    mk('td-next', '▶', 'hb-arrow').addEventListener('click', () => { ensureAudio(); TD.courseIdx = (TD.courseIdx + 1) % TDC.courses.length; tdPickTod(); beep(660, 0, 0.04, 0.04, 'square'); });
    const hint = document.createElement('div'); hint.className = 'prize-info st-say td-hint'; hint.textContent = 'ハンドルを ぐるっと 回して、 運転しよう！'; screenEl.appendChild(hint); TD_DOM.hint = hint;
  }
  function tdAskQuit() {
    if ((TD.phase !== 'race' && TD.phase !== 'count' && TD.phase !== 'ready' && TD.phase !== 'pick') || TD.paused) return; TD.paused = true; TD.pauseAt = performance.now(); TD.finger = null; TD.steerHeld = false;
    showDialog({ title: 'レースをやめますか？', lines: [{ text: 'やめると、 ¥' + TDC.price + ' は戻らないよ。', cls: 'dim' }], buttons: [{ label: '続ける', primary: true, onClick: () => { TD.paused = false; } }, { label: 'やめる', onClick: () => { TD.paused = false; TD.phase = 'select'; tdPickTod(); } }] });
  }
  function tdUi() {
    tdBuildDom(); const ph = TD.phase; const show = (k, on) => TD_DOM[k].classList.toggle('is-show', !!on);
    show('start', ph === 'select'); show('hint', ph === 'pick'); show('retry', ph === 'result'); show('menu', ph === 'result'); show('quit', (ph === 'race' || ph === 'count' || ph === 'ready' || ph === 'pick') && !TD.paused); show('prev', false); show('next', false);
    TD_DOM.hint.textContent = '3つの コースから、 1つ えらんでね！';
    crPlace(TD_DOM.start, { x: 24, y: 330, w: W - 48, h: 38 }); crPlace(TD_DOM.hint, { x: 12, y: 290, w: W - 24, h: 24 });
    crPlace(TD_DOM.retry, { x: 20, y: 250, w: W - 40, h: 34 }); crPlace(TD_DOM.menu, { x: 20, y: 290, w: W - 40, h: 26 }); crPlace(TD_DOM.quit, ph === 'pick' ? { x: Math.round(W / 2) - 30, y: 344, w: 60, h: 22 } : { x: W - 52, y: 40, w: 40, h: 18 });
  }
  function tdHide() { if (!TD_DOM.start) return; Object.keys(TD_DOM).forEach((k) => TD_DOM[k].classList.remove('is-show')); }
  function tdDraw() {
    const ph = TD.phase;
    if (ph === 'select') { tdDrawSelect(); } else if (ph === 'pick') { tdDrawPick(); }
    else if (ph === 'result') { tdDrawResult(); }
    else { tdScene(); tdHud(); tdFx(); tdWheelDraw(); tdDevInfo(); }
    tdUi();
  }
  function openTdDev() {
    const P = TDC.physics; const R = TDC.steering; const again = (f) => () => { f(); setTimeout(openTdDev, 0); };
    const lines = [{ text: 'maxSpeed ' + P.maxSpeed + ' / steeringStrength ' + P.steeringStrength.toFixed(2) + ' / maxAngle ' + R.maxAngle + ' / autoCenter ' + R.autoCenterSpeed.toFixed(1), cls: 'dim' }, { text: 'curveDrift ' + P.curveDriftStrength.toFixed(2) + ' / CPU速度 ×' + TD.dev.cpuMul.toFixed(2) + ' / AUTODRIVE ' + (TD.dev.auto ? 'ON' : 'OFF') + ' / 開始位置 ' + (TD.dev.startZ || 500), cls: 'dim' }];
    showDialog({ title: 'TOP DRIVER DEV', wide: true, lines, buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'レース即開始（¥なし）', onClick: () => { if (scene === 'machine' && currentMachine && currentMachine.gameType === 'topDriver') { tdBuildCourse(); tdNewRace(TD.dev.startZ || 500); TD.phase = 'count'; TD.t = 0; } else toast('TOP DRIVER の中で、 押してね'); } },
      { label: '開始位置 +20000', onClick: again(() => { TD.dev.startZ = ((TD.dev.startZ || 500) + 20000) % Math.max(1000, TD.trackLen || 70000); }) }, { label: '開始位置 もどす', onClick: again(() => { TD.dev.startZ = 0; }) },
      { label: '情報（角度・入力・roadX）ON/OFF', onClick: again(() => { TD.dev.info = !TD.dev.info; }) }, { label: 'CPU情報 ON/OFF', onClick: again(() => { TD.dev.cpu = !TD.dev.cpu; }) }, { label: '当たり判定の枠 ON/OFF', onClick: again(() => { TD.dev.box = !TD.dev.box; }) }, { label: '道路のはし ON/OFF', onClick: again(() => { TD.dev.road = !TD.dev.road; }) }, { label: 'アイテムの位置 ON/OFF', onClick: again(() => { TD.dev.items = !TD.dev.items; }) },
      { label: 'maxSpeed +100', onClick: again(() => { P.maxSpeed += 100; }) }, { label: 'maxSpeed -100', onClick: again(() => { P.maxSpeed = Math.max(800, P.maxSpeed - 100); }) },
      { label: 'steeringStrength +0.2', onClick: again(() => { P.steeringStrength += 0.2; }) }, { label: 'steeringStrength -0.2', onClick: again(() => { P.steeringStrength = Math.max(0.4, P.steeringStrength - 0.2); }) },
      { label: 'maxSteeringAngle +30', onClick: again(() => { R.maxAngle += 30; }) }, { label: 'maxSteeringAngle -30', onClick: again(() => { R.maxAngle = Math.max(90, R.maxAngle - 30); }) },
      { label: 'autoCenterSpeed +1', onClick: again(() => { R.autoCenterSpeed += 1; }) }, { label: 'autoCenterSpeed -1', onClick: again(() => { R.autoCenterSpeed = Math.max(1, R.autoCenterSpeed - 1); }) },
      { label: 'curveDrift +0.1', onClick: again(() => { P.curveDriftStrength += 0.1; }) }, { label: 'curveDrift -0.1', onClick: again(() => { P.curveDriftStrength = Math.max(0, P.curveDriftStrength - 0.1); }) },
      { label: 'CPU速度 +5%', onClick: again(() => { TD.dev.cpuMul += 0.05; }) }, { label: 'CPU速度 -5%', onClick: again(() => { TD.dev.cpuMul = Math.max(0.5, TD.dev.cpuMul - 0.05); }) },
      { label: 'AUTODRIVE ON/OFF（記録しない）', onClick: again(() => { TD.dev.auto = !TD.dev.auto; }) },
      { label: 'BEST TIME リセット', onClick: again(() => { P_().topDriver.courses = {}; writeSave(); }) },
      { label: 'とじる', primary: true } ] });
  }
  mgRegister('topDriver', {
    reset() { TD.phase = 'select'; TD.paused = false; TD.finger = null; TD.steerHeld = false; }, phase: () => TD.phase,
    enter() { tdBuildDom(); TD.phase = 'select'; TD.paused = false; TD.dev.auto = false; tdPickTod(); setMessage('', C.cyan); },
    update: tdUpdate, draw: tdDraw, hint: 'ハンドルを指でぐるっと回して運転しよう！',
    pointer: tdPointer, pointerUp: tdPointerUp
  });
  GAME_TYPES.topDriver.pointerMove = tdPointerMove;
  GAME_TYPES.topDriver.canLeave = () => TD.phase === 'select' || TD.phase === 'result';
  GAME_TYPES.topDriver.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

