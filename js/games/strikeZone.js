'use strict';
  // =====================================================================
  //  🎳 STRIKE ZONE（ストライクゾーン）：6F SPORTS CORNER
  //   ボールを指で直接つかんで、上へスワイプして投げる、5フレームのボウリング。1人用・¥100・報酬なし（記録は BEST SCORE だけ）
  //   WHERE＝スワイプの向き／POWER＝スワイプの速さ／SPIN＝スワイプの軌道（弧）。投げたあとは、ボールもピンも、物理で動く（乱数で倒れる数を決めない）
  //   スコア計算（szScore）は、物理から完全に切りはなされた、ただの関数：投球ごとの倒れた本数の列 → フレームの点数
  //   画面：レーンを、ボールの後ろから見た 疑似3D（奥へ細くなる遠近。Canvasの2D）。物理は、レーンの上を見た2D（x＝よこ、z＝おく）
  // =====================================================================
  const SZC = CONFIG.strikeZone;
  const SZ_MACHINE = { machineId: 'sz_strikezone', machineName: 'STRIKE ZONE', label: 'STRIKE ZONE', isUnlocked: true, gameType: 'strikeZone', sz: true };
  // ---- スコアエンジン：投球ごとの pinsDown（倒した本数）の列から、5フレーム（本物と同じ計算・最終フレームはボーナス投球）----
  function szAnalyze(throws) {                                                                                           // フレームごとの投球を、とりだす。つぎの投球が「新しいピン10本」から始まるか・ゲームが終わったか、も返す
    const F = SZC.frames; const frames = []; let i = 0;
    for (let f = 1; f <= F; f++) {
      const rolls = [];
      if (f < F) { if (i < throws.length) { rolls.push(throws[i++]); if (rolls[0] < 10 && i < throws.length) rolls.push(throws[i++]); } }
      else { while (i < throws.length && rolls.length < 3) { rolls.push(throws[i++]); if (rolls.length === 2 && rolls[0] < 10 && rolls[0] + rolls[1] < 10) break; } }               // 最終フレーム：ストライク→あと2投／スペア→あと1投／オープン→おしまい
      frames.push({ f, rolls });
    }
    const done = (fr, k) => { const r = fr.rolls; if (k < F - 1) return r.length > 0 && (r[0] === 10 || r.length === 2); if (r.length < 2) return false; if (r[0] === 10 || r[0] + r[1] === 10) return r.length === 3; return true; };
    const cur = frames.findIndex((fr, k) => !done(fr, k)); const over = cur < 0; let frame = F; let roll = 0; let fresh = true;
    if (!over) { frame = cur + 1; const r = frames[cur].rolls; roll = r.length + 1; const last = cur === F - 1;
      if (r.length === 0) fresh = true; else if (!last) fresh = false; else if (r.length === 1) fresh = r[0] === 10; else fresh = (r[0] === 10 && r[1] === 10) || (r[0] < 10 && r[0] + r[1] === 10); }
    return { frames, over, frame, roll, fresh };
  }
  function szScore(throws) {                                                                                             // 返り値：frames[] { rolls, marks（表示の記号）, total（そのフレームまでの合計。まだ決まらなければ null） }, total
    const A = szAnalyze(throws); const F = SZC.frames; const flat = throws.slice(); let pos = 0; let run = 0; let known = true; const out = [];
    const dig = (v) => (v === 0 ? '-' : String(v));
    A.frames.forEach((fr, k) => {
      const r = fr.rolls; const last = k === F - 1; const start = pos; pos += r.length; let score = null; const marks = [];
      if (!last) {
        if (r.length) {
          if (r[0] === 10) { marks.push('X'); const a1 = flat[start + 1]; const a2 = flat[start + 2]; if (a1 !== undefined && a2 !== undefined) score = 10 + a1 + a2; }                              // ストライク＝10＋次の2投
          else if (r.length === 2) { if (r[0] + r[1] === 10) { marks.push(dig(r[0]), '/'); const a1 = flat[start + 2]; if (a1 !== undefined) score = 10 + a1; } else { marks.push(dig(r[0]), dig(r[1])); score = r[0] + r[1]; } }          // スペア＝10＋次の1投／オープン＝倒した本数
          else marks.push(dig(r[0]));
        }
      } else {
        r.forEach((v, j) => { if (j === 0) marks.push(v === 10 ? 'X' : dig(v)); else if (j === 1) marks.push(r[0] === 10 ? (v === 10 ? 'X' : dig(v)) : (r[0] + v === 10 ? '/' : dig(v))); else marks.push(r[0] === 10 && r[1] < 10 ? (r[1] + v === 10 ? '/' : dig(v)) : (v === 10 ? 'X' : dig(v))); });
        const sum = r.reduce((m, v) => m + v, 0); if (r.length === 3) score = sum; else if (r.length === 2 && r[0] < 10 && r[0] + r[1] < 10) score = sum;                                                       // 最終フレーム：ボーナス投球ぶんまで、そろったら確定
      }
      if (score === null) known = false; if (known) run += score; out.push({ f: fr.f, rolls: r, marks, total: known && score !== null ? run : null });
    });
    const total = out.reduce((m, fr) => (fr.total !== null ? fr.total : m), 0); return { frames: out, total, over: A.over, frame: A.frame, roll: A.roll, fresh: A.fresh };
  }
  const szCounts = (throws) => { const A = szAnalyze(throws); let x = 0; let sp = 0; A.frames.forEach((fr, k) => { const r = fr.rolls; if (!r.length) return; if (k < SZC.frames - 1) { if (r[0] === 10) x++; else if (r.length === 2 && r[0] + r[1] === 10) sp++; } else { if (r[0] === 10) x++; if (r[0] === 10 && r[1] === 10) x++; if (r[0] === 10 && r[1] === 10 && r[2] === 10) x++; if (r[0] < 10 && r.length >= 2 && r[0] + r[1] === 10) sp++; if (r[0] === 10 && r.length >= 3 && r[1] < 10 && r[1] + r[2] === 10) sp++; } }); return { strikes: x, spares: sp }; };
  // ---- 世界（x＝よこ、z＝おく）と、遠近の投影 ----
  const SZ = { phase: 'select', t: 0, clock: 0, throws: [], guard: false, guardRise: 0, ball: null, pins: [], sw: null, msg: '', msgT: 0, msgBig: 1, flash: 0, rackT: 0, sweepT: 0, result: null, best: 0, newBest: false, adj: 0, lastInfo: '', lastSpeed: 0, lastSpin: 0, lastAng: 0, hintSeen: false, perfect: false, force: null, trail: [], pendingEnd: 0, slow: 1,
    dev: { info: false, colliders: false, pinvel: false, trail: false, slow: false, guardForce: null, force: null } };
  const szL = () => SZC.lane; const szHalf = () => szL().width / 2; const szZPins = () => szL().length;
  const szK = () => (W - 36) / (szL().width + 2 * szL().gutter);
  const szFocal = () => SZC.view.focal;
  function szProj(x, z) { const s = szFocal() / (szFocal() + z); return { x: W / 2 + x * szK() * s, y: SZC.view.horizon + (SZC.view.near - SZC.view.horizon) * s, s }; }
  function szMakePins() {
    const L = szL(); const pins = []; let id = 1; for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) { const hx = (j - row / 2) * L.pinSpacing; const hz = L.length + row * L.pinRowDz; pins.push({ id: id++, hx, hz, x: hx, z: hz, vx: 0, vz: 0, st: 'stand', a: 0, w: 0, dx: 0, dz: 1, t: 0, drop: 0 }); } return pins;
  }
  function szNewBall() { SZ.ball = { x: SZ.ball ? SZ.ball.x : 0, z: 0, vx: 0, vz: 0, spin: 0, ang: 0, state: 'aim', gut: 0, r: SZC.ball.radius, speed: 0, rot: 0, lift: 0 }; if (SZ.ball) SZ.ball.x = clamp(SZ.ball.x, -szHalf() + SZ.ball.r, szHalf() - SZ.ball.r); }
  // ---- ピン：たおれる前に、ぐらぐら（傾き a・角速度 w）。ある角度をこえると、パタン。たおれたピンは、すべりながら、ほかのピンに運動量を伝える（伝わるたびに、弱まる）----
  function szPinHit(p, vx, vz) {                                                                                         // ピンに、速さ（vx,vz）をあたえる：じゅうぶん強ければ たおれて すべる／弱ければ ぐらぐら（あとで パタン、または もどる）
    const P = SZC.pin; const sp = Math.hypot(vx, vz); if (sp < 1 || p.st === 'gone') return; const j = 1 + (Math.random() * 2 - 1) * P.jitter; const ja = (Math.random() * 2 - 1) * P.angJitter; const ca = Math.cos(ja); const sa = Math.sin(ja);
    const nx = (vx / sp) * ca - (vz / sp) * sa; const nz = (vx / sp) * sa + (vz / sp) * ca; const v = Math.min(P.maxLinear, sp * j);                                                  // ごく小さな ゆらぎ（強さ・向き）
    if (p.st === 'fall' || p.st === 'down') { p.vx += nx * v; p.vz += nz * v; const m = Math.hypot(p.vx, p.vz); if (m > P.maxLinear) { p.vx *= P.maxLinear / m; p.vz *= P.maxLinear / m; } p.st = 'fall'; p.t = 0; return; }
    p.dx = nx; p.dz = nz;
    if (v >= P.knock) { p.st = 'fall'; p.vx = nx * v; p.vz = nz * v; p.t = 0; p.a = 0.8; p.w = 0; }
    else { p.w = clamp(p.w + v * P.tipImpulse, -P.maxAngular, P.maxAngular); p.st = 'tip'; }
  }
  function szPinStep(p, dt) {
    const P = SZC.pin; if (p.st === 'stand' || p.st === 'gone' || p.st === 'down') return;
    if (p.st === 'tip') {                                                                                                // ぐら…ぐら…
      const acc = Math.abs(p.a) < P.tipCrit ? -P.restore * p.a : P.fallAccel; p.w += acc * dt; p.w *= Math.exp(-P.tipDamp * dt); p.a += p.w * dt;
      if (p.a < 0) { p.a = -p.a; p.w = -p.w; p.dx = -p.dx; p.dz = -p.dz; }
      if (p.a > P.fallAngle) { p.st = 'fall'; p.vx = p.dx * P.tipFallSpeed; p.vz = p.dz * P.tipFallSpeed; p.t = 0; }                                                   // パタン
      else if (p.a < 0.004 && Math.abs(p.w) < 0.05) { p.st = 'stand'; p.a = 0; p.w = 0; }
    } else if (p.st === 'fall') {
      p.t += dt; const f = Math.exp(-P.slideFriction * dt); p.vx *= f; p.vz *= f; p.x += p.vx * dt; p.z += p.vz * dt; p.a = Math.min(1.5, p.a + 6 * dt); if (Math.hypot(p.vx, p.vz) < 8 && p.t > 0.15) { p.st = 'down'; p.vx = 0; p.vz = 0; }
      const L = szL(); if (p.z > L.length + 3 * L.pinRowDz + L.pitDepth * 0.6 || Math.abs(p.x) > szHalf() + L.gutter) p.st = 'down';                       // 奥のピット／ガターへ おちたものは、おしまい
    }
  }
  function szStep(dt) {
    const L = szL(); const B = SZC.ball; const b = SZ.ball; const P = SZC.pin; const hl = szHalf();
    if (b && b.state === 'roll') {
      b.speed = Math.hypot(b.vx, b.vz); b.rot += (b.speed / b.r) * dt; const sp = Math.max(1, b.speed); const f = Math.exp(-B.friction * dt);
      if (b.gut === 0) { const ramp = 0.35 + 0.65 * clamp(b.z / L.length * 1.1, 0, 1); b.vx += b.spin * SZC.swipe.curveStrength * Math.pow(Math.max(0.5, (b.speed0 || sp) / 430), SZC.swipe.curveSpeedExp) * ramp * dt; /* 速い球は 少し曲がりにくく、遅い球は 少し曲がりやすい */ }
      b.vx *= f; b.vz *= f; if (b.vz < B.minRoll && b.z < L.length) b.vz = B.minRoll; b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.gut === 0) {
        if (SZ.guard && SZ.guardRise >= 0.9) { const lim = hl - b.r * 0.2; if (b.x > lim) { b.x = lim; if (b.vx > 0) { b.vx = -b.vx * SZC.guard.restitution; b.spin *= 0.4; if (!b.guardCd) { b.guardCd = 0.1; beep(180, 0, 0.06, 0.05, 'square'); } } } else if (b.x < -lim) { b.x = -lim; if (b.vx < 0) { b.vx = -b.vx * SZC.guard.restitution; b.spin *= 0.4; if (!b.guardCd) { b.guardCd = 0.1; beep(180, 0, 0.06, 0.05, 'square'); } } } }
        else if (Math.abs(b.x) > hl + b.r * 0.35 && b.z < L.length - 30) { b.gut = Math.sign(b.x); b.vx = 0; b.spin = 0; SZ.gutterSeen = true; beep(120, 0, 0.12, 0.05, 'sine'); }                                  // ガターへ おちる（もどらない）
      } else { const gx = b.gut * (hl + L.gutter / 2); b.x += (gx - b.x) * Math.min(1, 10 * dt); }
      if (b.guardCd) b.guardCd = Math.max(0, b.guardCd - dt);
      if (b.gut === 0) for (const p of SZ.pins) {                                                                       // ボール → ピン（ボールは、ピンより、ずっと重い）
        if (p.st !== 'stand' && p.st !== 'tip') continue; const dx = p.x - b.x; const dz = p.z - b.z; const d = Math.hypot(dx, dz); const md = B.hitRadius + P.radius; if (d >= md || d === 0) continue;
        const nx = dx / d; const nz = dz / d; const vn = b.vx * nx + b.vz * nz; if (vn <= 0) continue; const e = P.restitution; const mb = B.mass; const mp = P.mass; const pv = ((1 + e) * mb / (mb + mp)) * vn; const bv = ((1 + e) * mp / (mb + mp)) * vn;
        b.vx -= nx * bv; b.vz -= nz * bv; b.x -= nx * (md - d) * 0.15; b.z -= nz * (md - d) * 0.15; const bx0 = b.vx * 0.22; const bz0 = b.vz * 0.22; szPinHit(p, nx * pv + bx0, nz * pv + bz0); SZ.hitTime = SZ.hitTime || SZ.clock; if (!p.hitSnd) { p.hitSnd = true; if (SZ.sndCd <= 0) { SZ.sndCd = 0.04; noise(0.05, 0.06); beep(900 + Math.random() * 300, 0, 0.05, 0.05, 'triangle'); } }
      }
      if (b.z > L.length + 3 * L.pinRowDz + L.pitDepth * 0.7 || (b.vz < 2 && b.z > L.length + 10)) { b.state = 'done'; SZ.ballDone = true; }
      if (b.vz < 1 && b.z < L.length - 5 && b.gut === 0 && b.speed < 3) { b.vz = B.minRoll; }
    }
    for (const p of SZ.pins) szPinStep(p, dt);
    const rc = P.collideRadius; const pins = SZ.pins;
    for (let i = 0; i < pins.length; i++) {                                                                              // ピン ←→ ピン（すべっているピンが、ほかのピンに ぶつかる。エネルギーは ふえない。ぶつかるたびに、弱まる）
      const p = pins[i]; if (p.st !== 'fall') continue;
      for (let k = 0; k < pins.length; k++) {
        if (k === i) continue; const q = pins[k]; if (q.st === 'gone') continue; const dx = q.x - p.x; const dz = q.z - p.z; const d = Math.hypot(dx, dz); if (d >= 2 * rc || d === 0) continue;
        const nx = dx / d; const nz = dz / d; const vn = (p.vx - q.vx) * nx + (p.vz - q.vz) * nz; if (vn <= 0) continue; const jv = ((1 + P.pinRestitution) / 2) * vn;
        p.vx -= nx * jv; p.vz -= nz * jv; const ov = (2 * rc - d) * 0.5; p.x -= nx * ov; p.z -= nz * ov; if (q.st === 'stand' || q.st === 'tip') { szPinHit(q, nx * jv, nz * jv); } else { q.vx += nx * jv; q.vz += nz * jv; q.st = 'fall'; q.t = 0; q.x += nx * ov; q.z += nz * ov; }
        if (SZ.sndCd <= 0) { SZ.sndCd = 0.05; beep(700 + Math.random() * 400, 0, 0.04, 0.04, 'triangle'); }
      }
    }
    SZ.sndCd -= dt;
  }
  function szPinsMoving() { for (const p of SZ.pins) { if (p.st === 'fall' && Math.hypot(p.vx, p.vz) > 8) return true; if (p.st === 'tip' && (Math.abs(p.w) > 0.06 || p.a > 0.02)) return true; } return false; }
  const szStanding = () => SZ.pins.filter((p) => p.st === 'stand' || p.st === 'tip').map((p) => p.id);
  // ---- スイング解析：向き・速さ・弧（スワイプ全体の軌跡から）----
  function szAnalyzeSwipe(samples) {
    const S = SZC.swipe; if (samples.length < 3) return null; let s0 = 0; for (let i = 1; i < samples.length; i++) { if (Math.hypot(samples[i].x - samples[0].x, samples[i].y - samples[0].y) > 3) { s0 = i - 1; break; } }
    let s1 = samples.length - 1; for (let i = samples.length - 1; i > s0 + 1; i--) { if (Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y) > 0.8) { s1 = i; break; } }                      // 指が止まった おわりの時間は、ふくめない
    const a = samples[s0]; const z = samples[s1]; const vx = z.x - a.x; const vy = z.y - a.y; const len = Math.hypot(vx, vy); const up = -vy / H; if (up < S.minDistance) return { ok: false, why: 'みじかい' };
    const T = Math.max(0.04, (z.t - a.t) / 1000); const speedH = Math.min(S.maxSpeed * 1.5, (len / H) / T); if (speedH < S.minSpeed) return { ok: false, why: 'おそい', speedH };                                                  // 距離÷時間（高さ＝1）
    const sn = clamp((speedH - S.minSpeed) / (S.maxSpeed - S.minSpeed), 0, 1);
    const i1 = s0 + Math.round(0.1 * (s1 - s0)); const i2 = Math.max(i1 + 1, s0 + Math.round(0.5 * (s1 - s0))); const ev = samples[i2].x - samples[i1].x; const ey = samples[i2].y - samples[i1].y; const useEarly = -ey > 4;                                  // 初期の向き：スワイプの はじめのほう（弧の、ふくらむ前）
    const ang = clamp((useEarly ? Math.atan2(ev, -ey) : Math.atan2(vx, -vy)) * S.dirScale, -S.maxAngle, S.maxAngle);
    const ux = vx / len; const uy = vy / len; const nx = -uy; const nyv = ux; let devSum = 0; let n = 0; for (let i = s0; i <= s1; i++) { const t = (i - s0) / Math.max(1, s1 - s0); if (t < 0.25 || t > 0.75) continue; devSum += (samples[i].x - a.x) * nx + (samples[i].y - a.y) * nyv; n++; }
    const kd = (n ? devSum / n : 0) / len; let sp = 0; const ak = Math.abs(kd); if (ak > S.jitterDeadzone) sp = -Math.sign(kd) * (ak - S.jitterDeadzone) * S.spinScale; sp = clamp(sp, -S.spinMax, S.spinMax);               // 弧：右へ ふくらむ軌道 → 左むきの回転…（ふくらみの反対側へ、曲がる）
    const B = SZC.ball; const speed = B.minSpeed + (B.maxSpeed - B.minSpeed) * Math.pow(sn, S.speedCurve); return { ok: true, speed, ang, spin: sp, sn, speedH, curv: kd };
  }
  function szLaunch(r) {
    r = Object.assign({}, r); r.ang = isFinite(r.ang) ? r.ang : 0; r.speed = isFinite(r.speed) ? clamp(r.speed, SZC.ball.minSpeed, SZC.ball.maxSpeed) : SZC.ball.minSpeed; r.spin = isFinite(r.spin) ? r.spin : 0; r.sn = isFinite(r.sn) ? r.sn : 0;                        // 異常な値（NaNなど）が来ても、ボールが壊れないように
    const b = SZ.ball; b.state = 'roll'; b.vx = Math.sin(r.ang) * r.speed; b.vz = Math.cos(r.ang) * r.speed; b.spin = r.spin; b.gut = 0; b.z = 0; b.ang = r.ang; b.speed0 = r.speed; SZ.phase = 'roll'; SZ.t = 0; SZ.hitTime = 0; SZ.ballDone = false; SZ.gutterSeen = false;
    SZ.lastSpeed = Math.round(r.speed); SZ.lastSpin = +r.spin.toFixed(2); SZ.lastAng = +(r.ang * 180 / Math.PI).toFixed(1); SZ.rollT = 0; beep(140, 0, 0.18, 0.04 + 0.02 * r.sn, 'sawtooth', 100 + r.sn * 60); noise(0.08, 0.02 + 0.03 * r.sn);
    if (SZ.dev.force) { SZ.force = SZ.dev.force; SZ.dev.force = null; }
  }
  // ---- 流れ ----
  function szBegin() {
    if (P_().money < SZC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(SZC.price); P_().strikeZone.playCount++; writeSave(); SZ.throws = []; SZ.result = null; SZ.newBest = false; SZ.perfect = false; SZ.phase = 'guard'; SZ.t = 0; SZ.msg = ''; SZ.guardRise = 0; SZ.ball = null; szNewBall(); SZ.pins = szMakePins();
    beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05);
  }
  function szChooseGuard(on) {
    if (SZ.phase !== 'guard') return; SZ.guard = SZC.dev ? on : on; if (SZ.dev.guardForce !== null) SZ.guard = SZ.dev.guardForce; SZ.phase = P_().strikeZone.tutorialSeen ? 'aim' : 'hint'; SZ.t = 0; SZ.guardRise = 0; if (SZ.guard) beep(260, 0, 0.3, 0.05, 'sawtooth', 340);                       // ガードが せりあがる
  }
  function szResetRack(full, keepIds) {
    const L = szL(); SZ.pins = szMakePins(); if (!full && keepIds) for (const p of SZ.pins) if (!keepIds.includes(p.id)) { p.st = 'gone'; } SZ.rackT = 0.4; for (const p of SZ.pins) p.drop = full ? 1 : 0;
  }
  function szFinishThrow() {                                                                                             // 1投のけっか：倒れた本数 → スコアエンジンへ
    const before = SZ.standBefore; const standingNow = SZ.pins.filter((p) => p.st !== 'gone' && (p.st === 'stand' || (p.st === 'tip' && p.a < SZC.pin.downAngle))).map((p) => p.id); let down = before.length - standingNow.length;
    if (SZ.force === 'strike') down = before.length; else if (SZ.force === 'gutter') down = 0; else if (SZ.force === 'spare') down = before.length; if (SZ.force) { const keep = SZ.force === 'gutter' ? before : []; SZ.pins.forEach((p) => { if (p.st !== 'gone') p.st = keep.includes(p.id) ? 'stand' : 'down'; if (keep.includes(p.id)) { p.a = 0; p.x = p.hx; p.z = p.hz; } }); }
    SZ.force = null; down = clamp(down, 0, before.length); const prev = szScore(SZ.throws); SZ.throws.push(down); const sc = szScore(SZ.throws); const gut = SZ.gutterSeen && down === 0; SZ.lastDown = down; SZ.lastIds = SZ.pins.filter((p) => p.st === 'down' || p.st === 'fall').map((p) => p.id);
    let msg = ''; let big = 1; const wasFresh = prev.fresh; const strike = down === 10 && wasFresh && before.length === 10; const spare = !strike && down === before.length && before.length < 10 && before.length > 0;
    if (strike) { msg = 'STRIKE!!'; big = 2; SZ.flash = 0.35; [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.05, 0.14, 0.07, 'square')); noise(0.2, 0.08); } else if (spare) { msg = 'SPARE!'; big = 1; SZ.flash = 0.2; [659, 880, 1175].forEach((f, i) => beep(f, i * 0.07, 0.14, 0.06, 'triangle')); } else if (gut) { msg = 'GUTTER'; big = 0; }
    else if (down === 0) { msg = ''; } SZ.msg = msg; SZ.msgBig = big; SZ.msgT = msg ? 1.1 : 0;
    SZ.phase = 'after'; SZ.t = 0; SZ.afterWait = msg ? 1.1 : 0.55; SZ.sc = sc;
  }
  function szAdvance() {                                                                                                // つぎの投球の準備：ピンの片づけ・セット
    const sc = szScore(SZ.throws);
    if (sc.over) { SZ.phase = 'final'; SZ.t = 0; SZ.result = { score: sc.total, ...szCounts(SZ.throws) }; SZ.perfect = sc.total === 150; const rec = P_().strikeZone; if (sc.total > rec.bestScore) { rec.bestScore = sc.total; SZ.newBest = true; } SZ.best = rec.bestScore; writeSave(); if (SZ.perfect) [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.09, 0.16, 0.07, 'triangle')); else [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle')); if (SZ.newBest) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.7 + i * 0.08, 0.14, 0.05)); return; }
    if (sc.fresh) szResetRack(true); else { const keep = szStanding(); szResetRack(false, keep); } szNewBall(); SZ.ball.x = SZ.ball.x; SZ.phase = 'aim'; SZ.t = 0; beep(520, 0, 0.05, 0.03, 'square');
  }
  function szBeginRoll() { SZ.standBefore = szStanding(); for (const p of SZ.pins) p.hitSnd = false; }
  function szUpdate(dt) {
    SZ.clock += dt; dt = Math.min(dt, 0.05); const ph = SZ.phase; SZ.t += dt; if (SZ.flash > 0) SZ.flash -= dt; if (SZ.msgT > 0) SZ.msgT -= dt; if (SZ.rackT > 0) SZ.rackT -= dt;
    if (ph === 'select') { SZ.sel = (SZ.sel || 0) + dt; return; }
    if (SZ.guard && SZ.guardRise < 1 && ph !== 'select' && ph !== 'guard') SZ.guardRise = Math.min(1, SZ.guardRise + dt / 0.6);
    const dts = dt * (SZ.dev.slow ? 0.2 : 1);
    if (ph === 'roll') {
      SZ.rollT += dts; let rem = dts; const sub = 1 / 240; while (rem > 1e-7) { const d = Math.min(rem, sub); szStep(d); rem -= d; }
      if (SZ.ball.state === 'roll' && SZ.rollT % 0.09 < dts && SZ.ball.gut === 0 && SZ.ball.z < szZPins()) { beep(70 + SZ.ball.speed * 0.12, 0, 0.1, 0.012 + 0.012 * (SZ.ball.speed / SZC.ball.maxSpeed), 'sawtooth'); }                      // ゴロゴロ…（はやいほど、高く）
      const moving = szPinsMoving(); if (SZ.ballDone || SZ.ball.state === 'done') { SZ.settle = (SZ.settle || 0) + dts; if (moving) SZ.settle = Math.min(SZ.settle, SZC.pin.settleTime * 0.4); if ((!moving && SZ.settle >= SZC.pin.settleTime * (SZ.hitTime ? 0.55 : 0.2)) || SZ.rollT > SZC.pin.resultTimeout) { SZ.settle = 0; szFinishThrow(); } } else SZ.settle = 0;
      if (SZ.rollT > SZC.pin.resultTimeout + 3) { SZ.ball.state = 'done'; SZ.ballDone = true; }
    } else if (ph === 'after') {
      SZ.afterWait -= dt; if (SZ.afterWait <= 0) { szSweep(); }
    } else if (ph === 'sweep') { SZ.sweepT += dt; if (SZ.sweepT >= 0.45) { SZ.sweepT = 0; for (const p of SZ.pins) if (p.st === 'down' || p.st === 'fall') p.st = 'gone'; szAdvance(); } }
    else if (ph === 'final') { if (SZ.t >= (SZ.perfect ? 2.4 : 1.4)) { SZ.phase = 'result'; SZ.t = 0; } }
    else if (ph === 'hint') { /* 説明が出ている間 */ }
  }
  function szSweep() { SZ.phase = 'sweep'; SZ.sweepT = 0; beep(240, 0, 0.3, 0.04, 'sawtooth', 160); }
  // ---- 入力 ----
  function szBallScreen() { const b = SZ.ball; const pr = szProj(b.x, b.z); return { x: pr.x, y: pr.y - (b.lift || 0), r: b.r * szK() * pr.s }; }
  function szPointer(e, p) {
    if (SZ.phase !== 'aim' || SZ.sw || !SZ.ball) return; const bs = szBallScreen(); const rad = Math.max(26, bs.r * 2.4); if (Math.hypot(p.x - bs.x, p.y - bs.y) > rad) return;                  // ボールの近くから（ひろめ）
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } SZ.sw = { id: e.pointerId, x0: p.x, y0: p.y, bx0: SZ.ball.x, mode: null, samples: [{ x: p.x, y: p.y, t: performance.now() }] };
  }
  function szPointerMove(e, p) {
    const s = SZ.sw; if (!s || s.id !== e.pointerId || SZ.phase !== 'aim') return; s.samples.push({ x: p.x, y: p.y, t: performance.now() }); const dx = p.x - s.x0; const dy = p.y - s.y0;
    if (!s.mode && Math.hypot(dx, dy) > SZC.swipe.modeDistance) s.mode = (Math.abs(dx) > Math.max(0, -dy) * SZC.swipe.adjustRatio) ? 'adjust' : 'swipe';                                    // よこへ ドラッグ＝位置のちょうせつ／うえへ＝投球
    if (s.mode === 'adjust') { SZ.ball.x = clamp(s.bx0 + dx / szK(), -szHalf() + SZ.ball.r, szHalf() - SZ.ball.r); SZ.ball.lift = 0; }
    else if (s.mode === 'swipe') { SZ.ball.lift = clamp(-dy * 0.35, 0, 26); }
  }
  function szPointerUp(e) {
    const s = SZ.sw; if (!s || s.id !== e.pointerId) return; SZ.sw = null; if (SZ.phase !== 'aim') return; SZ.ball.lift = 0; if (s.mode !== 'swipe') return;
    const r = szAnalyzeSwipe(s.samples); SZ.trail = s.samples.slice(); if (!r || !r.ok) { SZ.lastInfo = r ? r.why : ''; beep(260, 0, 0.06, 0.03, 'sine'); return; }                                                    // よわい／みじかい入力は、投球にしない（ボールは、そのまま）
    szBeginRoll(); szLaunch(r);
  }
  function szSimThrow(x0, ang, speed, spin, guard) {                                                                     // テスト用：画面なしで、1投を、さいごまで動かす → 倒れた本数
    const sv = { phase: SZ.phase, guard: SZ.guard, rise: SZ.guardRise }; SZ.guard = !!guard; SZ.guardRise = 1; SZ.pins = szMakePins(); szNewBall(); SZ.ball.x = x0; szBeginRoll(); const b = SZ.ball; b.state = 'roll'; b.vx = Math.sin(ang) * speed; b.vz = Math.cos(ang) * speed; b.spin = spin; b.gut = 0; b.z = 0; b.speed0 = speed; SZ.ballDone = false; SZ.gutterSeen = false; SZ.hitTime = 0;
    let t = 0; let maxPinSpeed = 0; while (t < 6) { for (let i = 0; i < 4; i++) szStep(1 / 240); t += 1 / 60; for (const p of SZ.pins) maxPinSpeed = Math.max(maxPinSpeed, Math.hypot(p.vx, p.vz)); if ((SZ.ballDone || b.state === 'done') && !szPinsMoving() && t > 1.2) break; }
    const standing = SZ.pins.filter((p) => p.st === 'stand' || (p.st === 'tip' && p.a < SZC.pin.downAngle)).length; const out = { down: 10 - standing, maxPinSpeed, gutter: SZ.gutterSeen, ballX: b.x, time: t }; SZ.guard = sv.guard; SZ.guardRise = sv.rise; return out;
  }
  // ---- 描画：レーンを、ボールのうしろから見た 疑似3D ----
  function szPoly(pts, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(Math.round(pts[0].x), Math.round(pts[0].y)); for (let i = 1; i < pts.length; i++) ctx.lineTo(Math.round(pts[i].x), Math.round(pts[i].y)); ctx.closePath(); ctx.fill(); }
  function szLane() {
    const L = szL(); const hl = szHalf(); const zE = L.length + 3 * L.pinRowDz + L.pitDepth; const g = L.gutter;
    rect(8, 8, W - 16, H - 16, '#0a3a40'); for (let y = 8; y < SZC.view.horizon + 90; y++) rect(8, y, W - 16, 1, mixHex('#0e5a62', '#08262c', (y - 8) / (SZC.view.horizon + 82)));
    const P = (x, z) => szProj(x, z); const gl = [P(-hl - g, 0), P(-hl - g, zE), P(hl + g, zE), P(hl + g, 0)]; szPoly(gl, '#2a2e34');                                                                       // ガター（ふち）
    szPoly([P(-hl, 0), P(-hl, zE), P(hl, zE), P(hl, 0)], '#d8a65a');                                                                                                                                  // レーン（飴色）
    for (let i = -5; i <= 5; i++) { const x = (hl * i) / 5.5; const a = P(x, 0); const b = P(x, zE); ctx.strokeStyle = i % 2 ? '#c4914a' : '#e2b66e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (const x of [-hl, hl]) { const a = P(x, 0); const b = P(x, zE); ctx.strokeStyle = '#6a4a22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (const gx of [-1, 1]) szPoly([P(gx * hl, 0), P(gx * hl, zE), P(gx * (hl + g), zE), P(gx * (hl + g), 0)], '#3a3e46');
    for (const gx of [-1, 1]) { const a = P(gx * (hl + g / 2), 0); const b = P(gx * (hl + g / 2), zE); ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (let k = 0; k < 7; k++) { const x = -hl + (hl * 2 * (k + 0.5)) / 7; const a = P(x, 110 + Math.abs(k - 3) * 14); ctx.fillStyle = '#4a3014'; ctx.beginPath(); ctx.moveTo(a.x, a.y - 3); ctx.lineTo(a.x - 3, a.y + 2); ctx.lineTo(a.x + 3, a.y + 2); ctx.closePath(); ctx.fill(); }          // レーンのやじるし
    const f0 = P(-hl, 0); const f1 = P(hl, 0); rect(Math.round(f0.x), Math.round(f0.y) - 1, Math.round(f1.x - f0.x), 2, '#c42028');                                                                          // ファウルライン
    const pitZ = L.length + 3 * L.pinRowDz + 14; szPoly([P(-hl, pitZ), P(-hl, zE), P(hl, zE), P(hl, pitZ)], '#14161a');                                                                              // ピット（奥）
    const top = P(0, zE); rect(8, 56, W - 16, Math.round(top.y) - 56, '#0b2f35'); const bw = P(-hl - g, zE); rect(Math.round(bw.x), Math.round(top.y) - 14, Math.round(P(hl + g, zE).x - bw.x), 14, '#14161a'); rect(Math.round(bw.x), Math.round(top.y) - 15, Math.round(P(hl + g, zE).x - bw.x), 1, '#20c8b8');
    if (SZ.guard && SZ.guardRise > 0) for (const gx of [-1, 1]) { const hh = 7 * SZ.guardRise; const a = P(gx * hl, 0); const b = P(gx * hl, zE); const a2 = { x: a.x, y: a.y - hh * szK() * a.s }; const b2 = { x: b.x, y: b.y - hh * szK() * b.s }; szPoly([a, b, b2, a2], '#e03030'); ctx.strokeStyle = '#ff9a9a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); }          // ガードのバンパー
  }
  const SZ_PIN_IMG = { img: null, ok: false };                                                                           // ボウリングのピン：ドット絵の画像（assets/strikezone/pin.webp）
  (function loadSzPin() { const im = new Image(); im.onload = () => { SZ_PIN_IMG.img = im; SZ_PIN_IMG.ok = true; }; im.onerror = () => { SZ_PIN_IMG.ok = false; }; im.src = 'assets/strikezone/pin.webp'; })();
  function szPinDraw(p) {
    if (p.st === 'gone') return; const pr = szProj(p.x, p.z); const k = szK() * pr.s; const h = 34 * k; const wd = 11 * k; let ang = 0; let lying = false;
    if (p.st === 'down' || p.st === 'fall') { lying = true; ang = (p.dx >= 0 ? 1 : -1) * 1.35; } else if (p.st === 'tip') ang = clamp(p.a * p.dx * 1.3, -1.2, 1.2) + (Math.abs(p.dx) < 0.1 ? 0 : 0);
    const dropY = p.drop ? -Math.max(0, SZ.rackT) * 60 : 0; ctx.save(); ctx.translate(Math.round(pr.x), Math.round(pr.y + dropY)); ctx.rotate(ang); if (lying) ctx.translate(0, -2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, 1, wd * 0.9, wd * 0.28, 0, 0, 6.2832); ctx.fill();
    if (SZ_PIN_IMG.ok) { const ih = h * 1.18; const iw = ih * (SZ_PIN_IMG.img.width / SZ_PIN_IMG.img.height); const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(SZ_PIN_IMG.img, -iw / 2, -ih + 1, iw, ih); ctx.imageSmoothingEnabled = sm; }                                       // 画像のピン（ドット絵を、ぼかさずに拡大）
    else {     ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.ellipse(0, -h * 0.5, wd * 0.5, h * 0.5, 0, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -h * 0.9, wd * 0.28, h * 0.14, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#d02030'; ctx.fillRect(-wd * 0.3, -h * 0.74, wd * 0.6, Math.max(1, h * 0.06)); ctx.fillRect(-wd * 0.3, -h * 0.66, wd * 0.6, Math.max(1, h * 0.04)); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(wd * 0.1, -h * 0.9, wd * 0.18, h * 0.8); }
    ctx.restore();
  }
  function szBallDraw() {
    const b = SZ.ball; if (!b || (b.state === 'done')) return; const pr = szProj(b.x, b.z); const k = szK() * pr.s; const r = b.r * k; const gy = b.gut ? 4 * k : 0; const cx = Math.round(pr.x); const cy = Math.round(pr.y - r * 0.9 - (b.lift || 0) + gy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, Math.round(pr.y) + 1, r * 0.95, r * 0.28, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#0a5a66'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#1aa6b4'; ctx.beginPath(); ctx.arc(cx - r * 0.12, cy - r * 0.14, r * 0.86, 0, 6.2832); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.42, r * 0.22, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#062c34'; for (let i = 0; i < 3; i++) { const a = b.rot + i * 0.9 + 0.6; const hx = cx + Math.cos(a) * r * 0.42; const hy = cy - Math.abs(Math.sin(a)) * r * 0.5 + r * 0.1; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1, r * 0.1), 0, 6.2832); ctx.fill(); }               // ころがると、あなが まわる
  }
  function szScoreboard() {
    const sc = szScore(SZ.throws); const cw = Math.floor((W - 24) / 5); const x0 = Math.round((W - cw * 5) / 2); const y0 = 10; const ch = 42; const an = szAnalyze(SZ.throws);
    for (let k = 0; k < 5; k++) {
      const x = x0 + k * cw; const fr = sc.frames[k]; const cur = !an.over && an.frame === k + 1 && SZ.phase !== 'select' && SZ.phase !== 'result' && SZ.phase !== 'final';
      rect(x, y0, cw - 1, ch, '#f4f4f0'); rect(x, y0, cw - 1, 8, cur ? '#e03030' : '#20c8b8'); drawText(String(k + 1), x + 3, y0 + 2, '#ffffff', 1);
      const nb = k === 4 ? 3 : 2; const bw = k === 4 ? 9 : 11; for (let j = 0; j < nb; j++) { const bx = x + cw - 2 - (nb - j) * bw; rect(bx, y0 + 9, bw - 1, 11, '#d8e8ea'); const m = fr.marks[j]; if (m) drawText(m, bx + Math.floor((bw - 1) / 2) - 1, y0 + 12, m === 'X' || m === '/' ? '#d02030' : '#14323a', 1); }
      if (fr.total !== null && fr.rolls.length) drawTextCenter(String(fr.total), x + cw / 2, y0 + 26, '#14323a', 1);
    }
    if (SZ.dev.info) drawText('S ' + SZ.lastSpeed + ' SPIN ' + SZ.lastSpin + ' ANG ' + SZ.lastAng + ' ' + SZ.lastInfo, 12, 56, '#00ff88', 1);
  }
  function szDrawPlay() {
    drawFrame(); szLane(); const sorted = SZ.pins.slice().sort((a, b) => b.z - a.z); if (SZ.sweepT > 0) { const f = SZ.sweepT / 0.45; const L = szL(); const a = szProj(-szHalf(), L.length + 3 * L.pinRowDz + 10 - f * 20); ctx.globalAlpha = 0.9; rect(Math.round(a.x), Math.round(a.y) - 3, Math.round(szHalf() * 2 * szK() * a.s), 5, '#c8ced8'); ctx.globalAlpha = 1; }
    for (const p of sorted) szPinDraw(p); szBallDraw();
    if (SZ.phase === 'aim' && SZ.ball && !SZ.sw) { const bs = szBallScreen(); const f = (SZ.clock * 1.4) % 1; ctx.globalAlpha = (1 - f) * 0.6; rect(Math.round(bs.x) - 1, Math.round(bs.y - bs.r - 8 - f * 24), 3, 6, '#ffffff'); ctx.globalAlpha = 1; }
    if (SZ.dev.colliders) { ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; for (const p of SZ.pins) { if (p.st === 'gone') continue; const pr = szProj(p.x, p.z); ctx.beginPath(); ctx.arc(pr.x, pr.y - 3, SZC.pin.radius * szK() * pr.s, 0, 6.2832); ctx.stroke(); if (SZ.dev.pinvel && p.st === 'fall') drawText(String(Math.round(Math.hypot(p.vx, p.vz))), pr.x + 4, pr.y - 12, '#ffff00', 1); } if (SZ.ball) { const pr = szProj(SZ.ball.x, SZ.ball.z); ctx.beginPath(); ctx.arc(pr.x, pr.y - 6, SZ.ball.r * szK() * pr.s, 0, 6.2832); ctx.stroke(); } }
    if (SZ.dev.trail && SZ.trail.length) { ctx.strokeStyle = '#ff00ff'; ctx.beginPath(); SZ.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); }
    if (SZ.flash > 0) { ctx.globalAlpha = clamp(SZ.flash * 1.5, 0, 0.4); rect(8, 56, W - 16, H - 64, SZ.flash > 0.2 ? '#7affee' : '#ffffff'); ctx.globalAlpha = 1; }
    szScoreboard(); szHud();
  }
  function szHud() {
    const an = szAnalyze(SZ.throws); if (SZ.msgT > 0 && SZ.msg) { ctx.globalAlpha = Math.min(1, SZ.msgT * 2); const big = SZ.msgBig; drawTextCenter(SZ.msg, W / 2, 112, SZ.msg === 'GUTTER' ? '#c8ccd4' : '#ffffff', big === 2 ? 4 : big === 1 ? 3 : 2, SZ.msg === 'STRIKE!!' ? '#d02030' : SZ.msg === 'SPARE!' ? '#108a8a' : '#14161a'); ctx.globalAlpha = 1; }
    if (SZ.phase !== 'result' && SZ.phase !== 'select' && SZ.phase !== 'final' && !an.over) drawText('FRAME ' + an.frame + '  THROW ' + an.roll, 14, H - 22, '#d8f4f0', 1, '#08262c');
    if (SZ.phase === 'aim' && SZ.throws.length === 0 && !SZ.sw) drawTextCenter('SWIPE UP!', W / 2, H - 38, '#ffffff', 1, '#08262c');
    if (SZ.phase === 'final') { ctx.globalAlpha = Math.min(1, SZ.t * 3); drawTextCenter(SZ.perfect ? 'PERFECT GAME!' : 'GAME OVER', W / 2, 110, SZ.perfect ? '#ffe070' : '#ffffff', SZ.perfect ? 3 : 3, SZ.perfect ? '#d02030' : '#108a8a'); ctx.globalAlpha = 1; }
  }
  function szDrawResult() {
    szDrawPlay(); ctx.globalAlpha = 0.88; rect(14, 64, W - 28, 252, '#062c34'); ctx.globalAlpha = 1; rect(14, 64, W - 28, 2, '#20c8b8'); const r = SZ.result; drawTextCenter('STRIKE ZONE', W / 2, 74, '#ffffff', 2, '#108a8a'); drawTextCenter('FINAL SCORE', W / 2, 98, '#c8ecec', 1);
    drawTextCenter(String(r.score), W / 2, 112, r.score >= 150 ? '#ffe070' : '#ffffff', 5, '#d02030'); drawTextCenter('STRIKE x' + r.strikes, W / 2, 158, '#ff9a9a', 1); drawTextCenter('SPARE  x' + r.spares, W / 2, 170, '#8ae8e0', 1);
    drawTextCenter('BEST ' + SZ.best, W / 2, 190, '#ffffff', 2, '#062c34'); if (SZ.newBest) { ctx.globalAlpha = 0.7 + 0.3 * Math.sin(SZ.clock * 3); drawTextCenter('NEW BEST!', W / 2, 214, '#7dff8a', 2, '#0a3a1a'); ctx.globalAlpha = 1; } if (SZ.perfect) drawTextCenter('PERFECT GAME!', W / 2, 232, '#ffe070', 1, '#d02030');
  }
  function szDrawSelect() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#14a8a0'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#22c8bc', '#0c7a76', (y - 8) / (H - 16))); rect(8, 8, W - 16, 3, '#c8fff8');
    rect(16, 18, W - 32, 62, '#0a3a40'); rect(18, 20, W - 36, 58, '#0e5a62'); drawTextCenter('STRIKE', W / 2, 24, '#ffffff', 3, '#d02030'); drawTextCenter('ZONE', W / 2, 50, '#ffffff', 3, '#d02030');
    const t = SZ.sel || 0; rect(34, 96, W - 68, 118, '#d8a65a'); rect(34, 96, 8, 118, '#2a2e34'); rect(W - 42, 96, 8, 118, '#2a2e34'); for (let i = 0; i < 9; i++) rect(44 + i * ((W - 90) / 8), 96, 1, 118, '#c4914a');
    for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) { const px = W / 2 + (j - row / 2) * 13; const py = 106 + row * 9; if (SZ_PIN_IMG.ok) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(SZ_PIN_IMG.img, Math.round(px) - 3, py - 4, 6, 15); ctx.imageSmoothingEnabled = sm; } else { rect(Math.round(px) - 2, py, 5, 8, '#f4f4f0'); rect(Math.round(px) - 2, py + 2, 5, 1, '#d02030'); } }
    const bx = W / 2 + Math.sin(t * 1.2) * 20; const by = 200 - Math.abs(Math.sin(t * 2)) * 4; ctx.fillStyle = '#0a5a66'; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#1aa6b4'; ctx.beginPath(); ctx.arc(bx - 1, by - 1, 8, 0, 6.2832); ctx.fill();
    rect(16, 226, W - 32, 78, '#f4f4f0'); rect(16, 226, W - 32, 2, '#ffffff'); drawTextCenter('5 FRAMES  BOWLING', W / 2, 234, '#0a3a40', 1); drawTextCenter('BEST ' + P_().strikeZone.bestScore, W / 2, 248, '#d02030', 2, '#ffd0d0'); drawTextCenter('YEN ' + P_().money + '    PLAY  YEN ' + SZC.price, W / 2, 272, '#0a3a40', 1);
  }
  const SZ_DOM = {};
  function szBuildDom() {
    if (SZ_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); SZ_DOM[id.slice(3)] = b; return b; };
    mk('sz-start', 'PLAY　¥' + SZC.price, 'td-go').addEventListener('click', () => { ensureAudio(); szBegin(); });
    mk('sz-retry', 'もういちど　¥' + SZC.price, 'td-go').addEventListener('click', () => { ensureAudio(); szBegin(); });
    mk('sz-out', '6Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); SZ.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('sz-gon', 'つける', 'td-go').addEventListener('click', () => { ensureAudio(); szChooseGuard(true); });
    mk('sz-goff', 'つけない', 'hb-sub').addEventListener('click', () => { ensureAudio(); szChooseGuard(false); });
    mk('sz-ok', 'OK', 'td-go').addEventListener('click', () => { ensureAudio(); if (SZ.phase === 'hint') { P_().strikeZone.tutorialSeen = true; SZ.phase = 'aim'; SZ.t = 0; writeSave(); } });
    const q = document.createElement('div'); q.className = 'prize-info st-say br-hint'; q.innerHTML = 'ガターガードを<br>つけますか？'; screenEl.appendChild(q); SZ_DOM.q = q;
    const h = document.createElement('div'); h.className = 'prize-info st-say br-hint'; h.innerHTML = 'ボールを 上へスワイプ！<br>速くスワイプすると ボールも速くなる！<br>少し曲げて投げると カーブするよ！'; screenEl.appendChild(h); SZ_DOM.hint = h;
  }
  function szUi() {
    szBuildDom(); const ph = SZ.phase; const show = (k, on) => SZ_DOM[k].classList.toggle('is-show', !!on);
    show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); show('gon', ph === 'guard'); show('goff', ph === 'guard'); show('q', ph === 'guard'); show('ok', ph === 'hint'); show('hint', ph === 'hint');
    crPlace(SZ_DOM.start, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(SZ_DOM.retry, { x: 20, y: 262, w: W - 40, h: 30 }); crPlace(SZ_DOM.out, { x: 20, y: 298, w: W - 40, h: 24 }); crPlace(SZ_DOM.q, { x: 14, y: 140, w: W - 28, h: 44 }); crPlace(SZ_DOM.gon, { x: 30, y: 200, w: W - 60, h: 30 }); crPlace(SZ_DOM.goff, { x: 30, y: 238, w: W - 60, h: 30 });
    crPlace(SZ_DOM.hint, { x: 12, y: 130, w: W - 24, h: 70 }); crPlace(SZ_DOM.ok, { x: 50, y: 214, w: W - 100, h: 28 });
  }
  function szHide() { if (!SZ_DOM.start) return; Object.keys(SZ_DOM).forEach((k) => SZ_DOM[k].classList.remove('is-show')); }
  function szDraw() { const ph = SZ.phase; if (ph === 'select') szDrawSelect(); else if (ph === 'result') szDrawResult(); else szDrawPlay(); szUi(); }
  function szLeaveAsk() {                                                                                               // ゲームのとちゅうで 席を立つ：確認（¥100は もどらない）
    if (['select', 'result'].includes(SZ.phase)) return false; showDialog({ title: 'ゲームの途中です', lines: ['ここで やめて、席を立ちますか？', { text: '¥100は かえってこないよ', cls: 'dim' }], buttons: [{ label: 'やめて 席を立つ', primary: true, onClick: () => { SZ.phase = 'select'; SZ.sw = null; standUp(); } }, { label: 'つづける' }] }); return true;
  }
  function szDevSet(throws) { SZ.throws = throws.slice(); SZ.pins = szMakePins(); const an = szAnalyze(SZ.throws); if (!an.fresh) { const n = Math.max(1, 10 - (SZ.throws[SZ.throws.length - 1] || 0)); const ids = [7, 8, 9, 10, 4, 5, 6, 2, 3, 1].slice(0, n); szResetRack(false, ids); } szNewBall(); SZ.phase = an.over ? 'result' : 'aim'; if (an.over) { SZ.result = { score: szScore(SZ.throws).total, ...szCounts(SZ.throws) }; SZ.best = P_().strikeZone.bestScore; } SZ.sw = null; }
  function openSzDev() {
    const again = (f) => () => { f(); setTimeout(openSzDev, 0); }; const sc = szScore(SZ.throws);
    showDialog({ title: 'STRIKE ZONE DEV', wide: true, lines: [{ text: 'THROWS [' + SZ.throws.join(',') + '] / SCORE ' + sc.total + ' / FRAME ' + sc.frame + '-' + sc.roll + ' / GUARD ' + (SZ.guard ? 'ON' : 'OFF') + ' / 強制 ' + (SZ.dev.force || 'なし') + ' / 最終 速度 ' + SZ.lastSpeed + ' spin ' + SZ.lastSpin + ' 角度 ' + SZ.lastAng, cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '強制 STRIKE（次の1投）', onClick: again(() => { SZ.dev.force = 'strike'; }) }, { label: '強制 SPARE（次の1投）', onClick: again(() => { SZ.dev.force = 'spare'; }) }, { label: '強制 GUTTER（次の1投）', onClick: again(() => { SZ.dev.force = 'gutter'; }) },
      { label: '1本だけ残す（2投目）', onClick: again(() => { szDevSet([9]); szResetRack(false, [10]); }) }, { label: '7-10 スプリット（2投目）', onClick: again(() => { szDevSet([8]); szResetRack(false, [7, 10]); }) }, { label: '全ピンに もどす', onClick: again(() => { szDevSet([]); }) },
      { label: '5フレーム目へ（4フレームぶん スペア）', onClick: again(() => { szDevSet([5, 5, 5, 5, 5, 5, 5, 5]); }) }, { label: 'BONUS THROW テスト（5フレーム目 X のあと）', onClick: again(() => { szDevSet([10, 10, 10, 10, 10]); }) }, { label: 'PERFECT 直前（X×6）', onClick: again(() => { szDevSet([10, 10, 10, 10, 10, 10]); }) },
      { label: 'GUARD 強制 ON', onClick: again(() => { SZ.dev.guardForce = true; SZ.guard = true; SZ.guardRise = 1; }) }, { label: 'GUARD 強制 OFF', onClick: again(() => { SZ.dev.guardForce = false; SZ.guard = false; SZ.guardRise = 0; }) }, { label: 'GUARD 強制 なし', onClick: again(() => { SZ.dev.guardForce = null; }) },
      { label: '速度・spin・初期角度 表示 ON/OFF', onClick: again(() => { SZ.dev.info = !SZ.dev.info; }) }, { label: 'collider・pin velocity 表示 ON/OFF', onClick: again(() => { SZ.dev.colliders = !SZ.dev.colliders; SZ.dev.pinvel = SZ.dev.colliders; }) }, { label: 'swipe 軌跡 表示 ON/OFF', onClick: again(() => { SZ.dev.trail = !SZ.dev.trail; }) }, { label: 'physics スローモーション ON/OFF', onClick: again(() => { SZ.dev.slow = !SZ.dev.slow; }) },
      { label: 'BEST SCORE リセット', onClick: again(() => { P_().strikeZone.bestScore = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('strikeZone', {
    reset() { SZ.phase = 'select'; SZ.sw = null; }, phase: () => SZ.phase,
    enter() { szBuildDom(); SZ.phase = 'select'; SZ.sel = 0; SZ.sw = null; SZ.throws = []; SZ.guard = false; SZ.guardRise = 0; SZ.pins = szMakePins(); szNewBall(); setMessage('', C.cyan); },
    update: szUpdate, draw: szDraw, hint: 'ボールを 上へスワイプして 投げよう！',
    pointer: szPointer, pointerUp: szPointerUp
  });
  GAME_TYPES.strikeZone.pointerMove = szPointerMove;
  GAME_TYPES.strikeZone.canLeave = () => SZ.phase === 'select' || SZ.phase === 'result';
  GAME_TYPES.strikeZone.beforeLeave = () => szLeaveAsk();
  GAME_TYPES.strikeZone.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

