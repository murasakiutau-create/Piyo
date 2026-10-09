'use strict';
  // =====================================================================
  //  B1 PRIZE CORNER ・ クレーンゲーム（共通エンジン）
  //   同じ内部座標（x＝よこ・z＝奥ゆき・y＝高さ）を、正面と横から、カメラだけ切り替えて描きます
  //   景品は、重さ・大きさ・摩擦・転がりやすさ・掴みにくさを持つ簡易剛体。アームの爪が触れると、押す・ずらす・転がす・持ち上げる、が起きます
  //   台ごとの違いは CONFIG.crane.machines（景品のラインナップ・アームの強さ・数）で決まります
  // =====================================================================
  const CRC = CONFIG.crane;
  const CR_IMG = {};
  Object.keys(CRC.prizes).forEach((k) => { const im = new Image(); im.src = CRC.prizes[k].file; CR_IMG[k] = im; });
  const crImg = (k) => { const im = CR_IMG[k]; return im && im.complete && im.naturalWidth ? im : null; };
  const CR_CROP = {};                                            // 画像の「絵のある範囲」（透明な余白を除いた長方形）。足元が浮いて見えないように、これを基準に描く
  function crCrop(k) {
    const im = crImg(k); if (!im) return null;
    const c = CRC.prizes[k].crop;                                  // あらかじめ測った「絵のある範囲」[x, y, 幅, 高さ]
    return c ? { sx: c[0], sy: c[1], sw: c[2], sh: c[3] } : { sx: 0, sy: 0, sw: im.naturalWidth, sh: im.naturalHeight };
  }
  const CRX = CRC.world.WX; const CRZ = CRC.world.WZ; const CRY = CRC.world.WY;
  const CR_PXX0 = 156 / CRX;
  const CR_SC = 1.45;                                            // 景品の表示と、物理の大きさの倍率（見た目と当たり判定は、同じ大きさ）
  const crDim = (t) => { const T = CRC.prizes[t]; const w = T.dw * CR_SC / CR_PXX0; return { w, d: w * (T.shape === 'long' ? 0.7 : 0.85), h: w * T.ratio * 1.05, rad: w * 0.5 }; };       // 物理の高さ＝見た目の高さ（画面の幅には よらない）
  const CR_MACHINES = Object.keys(CRC.machines).map((k) => ({ machineId: CRC.machines[k].id, machineName: CRC.machines[k].name, label: CRC.machines[k].short, isUnlocked: true, gameType: 'craneGame', crane: k }));
  const CRS = { key: 'slime', phase: 'idle', cx: 7, cz: 58, cy: 62, sp: 10, hold: null, moved: false, carry: [], t: 0, clock: 0, vx: 0, vz: 0, got: [], banner: null, glow: 0, lastMsg: '', plays: 0, resT: 0 };
  const crP = () => P_().crane;
  const crDay = () => (P_() ? P_().day : 1);
  const crPick = (key) => { const L = CRC.machines[key].lineup; let r = Math.random() * L.reduce((a, x) => a + x[1], 0); for (const x of L) { r -= x[1]; if (r < 0) return x[0]; } return L[0][0]; };
  const crInChuteZone = (x, z) => x < CRC.chute.x && z > CRC.chute.z;
  function crNewPrize(t, x, z, y) { return { t, x, z, y, vx: 0, vz: 0, vy: 0, rot: rand(-0.25, 0.25), lm: 0, slip: 0, car: false, fall: false }; }
  function crSpawnOne(key, st, high, free) {                      // 1つ置く。free＝すでにある景品に重ならない空きへ（補充用。プレイヤーが寄せた景品を、動かさない）
    const t = crPick(key); const dm = crDim(t);
    if (free) {
      for (let k = 0; k < 60; k++) {
        const x = rand(dm.rad + 2, CRX - dm.rad - 2); const z = rand(dm.rad + 3, CRZ - dm.rad - 3);
        if (crInChuteZone(x + dm.rad, z - dm.rad)) continue;
        if (st.prizes.some((q) => Math.hypot(q.x - x, q.z - z) < (crDim(q.t).rad + dm.rad) * 1.05)) continue;
        st.prizes.push(crNewPrize(t, x, z, 0)); return st.prizes[st.prizes.length - 1];
      }
    }
    for (let k = 0; k < 40; k++) {
      const x = rand(dm.rad + 2, CRX - dm.rad - 2); const z = rand(dm.rad + 3, CRZ - dm.rad - 3);
      if (crInChuteZone(x + dm.rad, z - dm.rad)) continue;
      st.prizes.push(crNewPrize(t, x, z, high ? rand(18, 40) : 0)); return st.prizes[st.prizes.length - 1];
    }
    return null;
  }
  function crInitMachine(key) {
    const M = CRC.machines[key]; const st = { prizes: [], day: crDay(), news: 0 };
    if (key === 'piyo') { [[44, 16], [64, 12], [84, 22]].slice(0, M.count).forEach(([x, z]) => { st.prizes.push(crNewPrize(crPick(key), x, z, 0)); }); }
    else for (let i = 0; i < M.count; i++) crSpawnOne(key, st, true);
    for (let i = 0; i < 360; i++) crPhys(st, 1 / 60);            // 落ち着くまで、先に動かしておく
    st.collected = []; st.prizes = st.prizes.filter((p) => !p.fall && !crInChuteZone(p.x, p.z));       // 初期化中に景品口へ入ったものは、取り除く
    st.prizes.forEach((p) => { p.lm = 0; });
    return st;
  }
  function crState(key) { const c = crP(); if (!c.machines[key]) c.machines[key] = crInitMachine(key); return c.machines[key]; }
  // ---- 景品の物理（簡易剛体）：重力・積み重ね・押し合い・摩擦・転がり・壁・景品口 ----
  function crPhys(st, dt) {
    const PH = CRC.phys; const P = st.prizes;
    for (const p of P) {
      if (p.car) continue;
      const T = CRC.prizes[p.t]; const dm = crDim(p.t);
      let sup = crInChuteZone(p.x - dm.rad * 0.15, p.z + dm.rad * 0.15) ? -60 : 0;                 // 景品口の上は、床がない（縁に引っかかっているだけなら、まだ落ちない）
      for (const q of P) {
        if (q === p || q.car) continue;
        const dq = crDim(q.t); const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d < (dm.rad + dq.rad) * 0.62 && p.y >= q.y + dq.h * 0.45) sup = Math.max(sup, q.y + dq.h * 0.82);
      }
      if (p.fall || p.y > sup + 0.02) {
        p.vy -= PH.gravity * dt; p.y += p.vy * dt;
        if (p.y <= sup && !p.fall) {
          p.y = sup; if (p.vy < -18) p.vx += rand(-4, 4); p.vy = 0;
          for (const q of P) {                                    // 別の景品の上に乗ったとき、ずれていると、すべり落ちる
            if (q === p || q.car) continue;
            const dq = crDim(q.t); const dx = p.x - q.x; const dz = p.z - q.z; const d = Math.hypot(dx, dz) || 0.01;
            if (d < (dm.rad + dq.rad) * 0.62 && q.y + dq.h * 0.7 <= p.y + 0.1) { p.vx += (dx / d) * PH.slide * 0.6 * (0.5 + T.roll); p.vz += (dz / d) * PH.slide * 0.6 * (0.5 + T.roll); }
          }
        }
      } else if (!p.fall) p.y = sup;
      if (crInChuteZone(p.x - dm.rad * 0.15, p.z + dm.rad * 0.15) && p.y <= 3 && !p.fall) { p.fall = true; p.vy = 0; }
      if (p.fall && p.y < -14) p.gone = true;
      // 横の押し合い（同じ高さにいる景品どうし）
      for (const q of P) {
        if (q === p || q.car || q.fall || p.fall) continue;
        const dq = crDim(q.t); const dx = p.x - q.x; const dz = p.z - q.z; const d = Math.hypot(dx, dz) || 0.01; const R = dm.rad + dq.rad;
        if (d < R && Math.abs(p.y - q.y) < Math.min(dm.h, dq.h) * 0.6) {
          const mp = T.weight; const mq = CRC.prizes[q.t].weight; const k = (R - d) / d * 0.5; const wp = mq / (mp + mq); const wq = mp / (mp + mq);
          p.x += dx * k * wp * 1.2; p.z += dz * k * wp * 1.2; q.x -= dx * k * wq * 1.2; q.z -= dz * k * wq * 1.2;
          p.vx += dx / d * 3 * wp; p.vz += dz / d * 3 * wp; q.vx -= dx / d * 3 * wq; q.vz -= dz / d * 3 * wq;
        }
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const decay = Math.pow(1 - Math.min(0.97, T.fric * (1 - T.roll * 0.6) * 0.9), dt * 6 * (T.damp || 1));       // 減衰：ピヨBIGは高め（押されても、すぐ止まる）
      p.vx *= decay; p.vz *= decay; if (Math.abs(p.vx) < 0.15) p.vx = 0; if (Math.abs(p.vz) < 0.15) p.vz = 0;
      if (!p.fall) {
        const rest = T.rest !== undefined ? T.rest : PH.wallBounce;                                       // 反発：ピヨBIGは、ほぼ0（壁でも、はね返らない）
        if (p.x < dm.rad) { p.x = dm.rad; p.vx = Math.abs(p.vx) * rest; } else if (p.x > CRX - dm.rad) { p.x = CRX - dm.rad; p.vx = -Math.abs(p.vx) * rest; }
        if (p.z < dm.rad) { p.z = dm.rad; p.vz = Math.abs(p.vz) * rest; } else if (p.z > CRZ - dm.rad) { p.z = CRZ - dm.rad; p.vz = -Math.abs(p.vz) * rest; }
      }
      p.rot += (p.vx * 0.02 * T.roll) - p.rot * (0.02 + 0.03 * ((T.damp || 1) - 1)); p.rot = clamp(p.rot, -0.4, 0.4);
    }
    for (let i = P.length - 1; i >= 0; i--) if (P[i].gone) { st.collected = st.collected || []; st.collected.push(P[i]); P.splice(i, 1); }
  }
  // ---- アーム ----
  function crPushFrom(st, px, pz, py, dirX, power, dt) {            // 爪が、景品を押す（押す・ずらす・転がす）。触れているあいだだけ、小さな力が続く
    const PH = CRC.phys; let touched = false; const f60 = Math.min(3, dt * 60);
    for (const p of st.prizes) {
      if (p.car) continue; const dm = crDim(p.t); const T = CRC.prizes[p.t];
      if (py > p.y + dm.h) continue;
      const dx = p.x - px; const dz = p.z - CRS.cz; const d = Math.hypot(dx, dz) || 0.01; const over = dm.rad + CRC.claw.prong * 0.9 - d;
      if (over <= 0) continue;
      touched = true;
      const mass = Math.max(0.6, T.weight);
      const cap = PH.maxPush / Math.sqrt(mass);                                           // 重いほど、1フレームに動く距離の上限が小さい
      const step = Math.min(cap, over * power * 0.35 / mass) * f60;                       // 「ゆっくり押す」：重なりに応じた、小さな距離（一瞬のインパルスは使わない）
      p.x += (dx / d) * step * 0.7 + dirX * step * 0.12; p.z += (dz / d) * step * 0.7;
      const v = step / Math.max(dt, 1e-3) * 0.25 / mass;                                  // ほんの少しだけ勢いを残す（重い景品は、ほぼ残さない）
      p.vx += (dx / d) * v * dt * 8; p.vz += (dz / d) * v * dt * 8;
      p.rot += (dx / d) * step * 0.05 / Math.sqrt(mass); p.lm = crDay();                  // 少し傾く
    }
    return touched;
  }
  function crTipLimit(st) {                                       // バー（アームの本体）が、下がれる いちばん低い高さ。爪の長さは固定：バーが景品の上に のるか、爪の先が景品や床に つくと、止まる
    const PL = crPL(); const sp = CRS.sp; let lim = PL + 0.4;
    for (const p of st.prizes) {
      if (p.car || p.fall) continue; const dm = crDim(p.t);
      if (Math.abs(CRS.cx - p.x) < dm.rad * 0.8 + 3 && Math.abs(CRS.cz - p.z) < dm.rad * 0.95 + 2) lim = Math.max(lim, p.y + dm.h + 1.2);       // バーが、景品の上に のる
      for (const px of [CRS.cx - sp, CRS.cx + sp]) {
        if (Math.abs(px - p.x) < dm.rad * 0.55 && Math.abs(CRS.cz - p.z) < dm.rad * 0.9) lim = Math.max(lim, p.y + dm.h * 0.92 + PL);          // 爪の先が、景品の上に のる
      }
    }
    return lim;
  }
  function crDecideGrip(st) {                                     // 爪が閉じたとき、掴めた景品と、その強さを決める（確率抽選ではなく、位置・形・重さから）
    const G = CRC.grab; const M = CRC.machines[CRS.key]; const cand = [];
    for (const p of st.prizes) {
      if (p.car || p.fall) continue; const T = CRC.prizes[p.t]; const dm = crDim(p.t);
      const offX = p.x - CRS.cx; const offZ = p.z - CRS.cz;
      const ty = CRS.cy - crPL(); const depth = (p.y + dm.h) - ty;                            // 爪の先が、景品の上端より、どれだけ下まで届いているか
      let strength = 0; let how = '';
      if (Math.abs(offX) < crSpread() * (CRC.claw.reach || 1.2) + dm.rad * 0.2 && Math.abs(offZ) < dm.rad * (CRC.claw.reachZ || 0.85) + 2.5 && depth > 1.5) {
        const cover = clamp(1 - Math.abs(offX) / (dm.rad + 3), 0, 1) * clamp(1 - Math.abs(offZ) / (dm.rad * 0.9 + 4), 0.15, 1);
        const eng = clamp(depth / (crPL() * 0.8 + 1), 0, 1);
        strength = M.armPower * (0.3 + 0.75 * cover) * (0.35 + 0.65 * eng) / (T.grip * (M.gripMul || 1)) * (T.shape === 'long' ? 1.12 : T.shape === 'flat' ? 0.85 : 1); how = 'body';
      }
      if (T.strap) {                                                // ストラップへの引っ掛け（細い。偶然や、よい腕前で）
        const sx = p.x + (T.strap.ax - 0.5) * dm.w; const sy = p.y + dm.h * (1 - T.strap.ay);
        for (const px of [CRS.cx - CRS.sp, CRS.cx + CRS.sp]) if (Math.hypot(px - sx, CRS.cz - p.z) < CRC.strapHit + CRC.claw.prong * 0.5 && Math.abs((CRS.cy - crPL()) - sy) < 6) { if (strength < 0.62) { strength = 0.62; how = 'strap'; } }
      }
      if (strength >= G.minStrength) cand.push({ p, strength, how });
    }
    if (cand.length) {                                           // 山の境目：いちばん掴めた景品の、すぐとなりにあって、爪の間に入っている景品も、いっしょに掛かることがある（上手く境目を狙ったとき）
      const best = cand.slice().sort((x, y) => y.strength - x.strength)[0]; const db = crDim(best.p.t);
      for (const p of st.prizes) {
        if (p.car || p.fall || cand.some((c) => c.p === p)) continue; const dm = crDim(p.t);
        if (Math.hypot(p.x - best.p.x, p.z - best.p.z) < (db.rad + dm.rad) * (CRC.claw.neighbor || 1.1) && Math.abs(p.x - CRS.cx) < crSpread() * 1.6 && Math.abs(p.z - CRS.cz) < dm.rad * 0.9 + 2.5 && (p.y + dm.h) - (CRS.cy - crPL()) > 1.5) cand.push({ p, strength: best.strength * 0.8 / CRC.prizes[p.t].grip * 0.9, how: 'body' });
      }
    }
    cand.sort((a, b) => b.strength - a.strength);
    if (cand.length && CRC.prizes[cand[0].p.t].weight > CRC.grab.heavy) cand.length = 1;       // 大きくて重い景品（ピヨBIG）は、1体ずつ
    return cand.slice(0, 3).map((c, i) => { c.strength *= Math.pow(G.multiPenalty, i); return c; });
  }
  function crClawHome() { return CRC.home; }
  const crPL = () => CRC.claw.prongLen;                                       // 爪の長さ（全台で固定。掴むときに伸びない。短い爪）
  const crSpread = () => CRC.claw.spread * (CRC.machines[CRS.key].spreadMul || 1);      // この台の、アームを開いたときの、爪の間の半分の幅（ピヨBIGは、大きいぬいぐるみに合わせて、大きい）
  function crReset() { CRS.phase = 'idle'; CRS.cx = CRC.home.x; CRS.cz = CRC.home.z; CRS.cy = CRC.claw.topY; CRS.sp = crSpread(); CRS.hold = null; CRS.moved = false; CRS.carry = []; }
  function crSay(t, c) { if (CRS.lastMsg !== t) { CRS.lastMsg = t; setMessage(t, c || C.cyan); } }
  function crInsert() {
    if (CRS.phase !== 'idle') return;
    if (P_().money < CRC.price) { crSay('お金が足りないよ（¥' + CRC.price + '要るよ）', C.pink); sfx.miss(); return; }
    P_().money -= CRC.price; crP().plays++; CRS.plays++; D_().played = true; D_().paid = true;
    CRS.phase = 'ready'; CRS.cx = CRC.home.x; CRS.cz = CRC.home.z; CRS.cy = CRC.claw.topY; CRS.sp = crSpread(); CRS.moved = false; CRS.carry = []; CRS.got = []; CRS.banner = null;
    beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); writeSave();
  }
  function crButtonAllowed(which) {
    if (which === 'x') return CRS.phase === 'ready';
    if (which === 'z') return CRS.phase === 'ready' || CRS.phase === 'xset';
    return false;
  }
  function crHoldStart(which) { if (!crButtonAllowed(which)) return; CRS.hold = which; if (which === 'z') CRS.phase = 'z'; beep(520, 0, 0.04, 0.03, 'square'); }
  function crHoldEnd() {
    const h = CRS.hold; CRS.hold = null;
    if (h === 'x' && CRS.phase === 'ready' && CRS.moved) CRS.phase = 'xset';
    else if (h === 'z' && CRS.phase === 'z') { CRS.phase = 'descend'; noise(0.12, 0.04); }
  }
  function crUpdate(dt) {
    const st = crState(CRS.key); const C2 = CRC.claw; CRS.clock += dt; CRS.t += dt;
    crPhys(st, dt);
    if (st.collected && st.collected.length) { const list = st.collected; st.collected = []; crGet(list); }
    if (CRS.banner) { CRS.banner.t += dt; if (CRS.banner.t > CRS.banner.dur) CRS.banner = null; }
    if (CRS.glow > 0) CRS.glow -= dt;
    const px0 = CRS.cx; const pz0 = CRS.cz;
    switch (CRS.phase) {
      case 'idle': crSay(P_().money >= CRC.price ? 'ガラス越しに見てみよう。¥' + CRC.price + 'で 1PLAY！床の影がアームの真上だよ' : 'お金が足りないよ（¥' + CRC.price + '要るよ）。見るだけなら無料！', C.cyan); break;
      case 'ready': crSay('①「横」を押して、離したところで位置を決めよう', C.yellow); if (CRS.hold === 'x') { CRS.cx = Math.min(CRX - 6, CRS.cx + C2.xSpeed * dt); if (CRS.cx > CRC.home.x + 0.5) CRS.moved = true; } break;
      case 'xset': crSay('②「奥」を押して、離したところで奥行きを決めよう（床の影が目印）', C.yellow); break;
      case 'z': crSay('奥……離すとアームが降りるよ！', C.yellow); if (CRS.hold === 'z') { CRS.cz = Math.max(6, CRS.cz - C2.zSpeed * dt); if (CRS.cz <= 6) crHoldEnd(); } break;
      case 'descend': {
        crSay('そーっと……', C.text);
        { let touch = false; for (const sgn of [-1, 1]) if (crPushFrom(st, CRS.cx + sgn * CRS.sp, CRS.cz, CRS.cy - crPL() + 1, sgn, CRC.phys.pushPower * 0.5, dt)) touch = true;
          CRS.cy -= C2.descend * dt * (touch ? CRC.phys.contactSlow : 1); }
        const lim = crTipLimit(st);
        if (CRS.cy <= lim + 0.05) { CRS.cy = lim; CRS.phase = 'grab'; CRS.resT = 0; CRS.grip = null; sfx.encounter && 0; beep(300, 0, 0.1, 0.04, 'square', 220); }
        break;
      }
      case 'grab': {
        CRS.resT += dt; const k = Math.min(1, CRS.resT / C2.close);
        if (!CRS.grip) CRS.grip = crDecideGrip(st);                          // 閉じはじめの位置で決める
        const need = CRS.grip.length ? Math.max(...CRS.grip.map((g) => crDim(g.p.t).rad)) * 0.6 : 1.5;
        CRS.sp = Math.max(need, crSpread() * (1 - k) + need * k);
        for (const sgn of [-1, 1]) crPushFrom(st, CRS.cx + sgn * CRS.sp, CRS.cz, CRS.cy - crPL() + 1, -sgn, CRC.phys.pushPower * 0.4, dt);
        if (k >= 1) {
          CRS.carry = CRS.grip.map((g) => { g.p.car = true; g.p.slip = 0; g.p.lm = crDay(); g.p.offX = clamp(g.p.x - CRS.cx, -(CRS.sp + 1.5), CRS.sp + 1.5); g.p.offZ = clamp(g.p.z - CRS.cz, -CRC.claw.holdZ, CRC.claw.holdZ); g.p.dy = g.p.y - CRS.cy; g.p.y0 = g.p.y; g.p.strength = g.strength; g.p.how = g.how; g.p.heavy = CRC.prizes[g.p.t].weight > CRC.grab.heavy; return g.p; });
          CRS.phase = 'lift'; beep(660, 0, 0.06, 0.04, 'square');
        }
        break;
      }
      case 'lift': crSay(CRS.carry.length ? '持ち上がった……！' : '掴めな勝った……', C.text); { CRS.cy = Math.min(C2.topY, CRS.cy + C2.lift * dt); if (CRS.cy >= C2.topY - 0.01) CRS.phase = 'return'; } break;
      case 'return': {
        crSay(CRS.carry.length ? '行け……行け……！' : '戻るよ', C.text);
        const dx = CRC.home.x - CRS.cx; const dz = CRC.home.z - CRS.cz; const d = Math.hypot(dx, dz); const stp = C2.move * dt;
        if (d <= stp) { CRS.cx = CRC.home.x; CRS.cz = CRC.home.z; CRS.phase = 'release'; CRS.resT = 0; } else { CRS.cx += (dx / d) * stp; CRS.cz += (dz / d) * stp; }
        break;
      }
      case 'release': {
        CRS.resT += dt; const k = Math.min(1, CRS.resT / 0.4); CRS.sp = (CRS.carry.length ? CRS.sp : crSpread()) * (1 - k) + crSpread() * k;
        if (k >= 1) {
          for (const p of CRS.carry) { p.car = false; p.vy = 0; p.vx = rand(-1, 1); p.vz = rand(-1, 1); p.offX = 0; }
          if (CRS.carry.length) beep(220, 0, 0.12, 0.05, 'square', 120);
          CRS.carry = []; CRS.phase = 'settle'; CRS.resT = 0;
        }
        break;
      }
      case 'settle': {
        CRS.resT += dt; CRS.sp = crSpread();
        const moving = st.prizes.some((p) => !p.car && (p.fall || Math.abs(p.vx) + Math.abs(p.vz) > 0.4 || p.vy !== 0));
        if (CRS.resT > 0.6 && (!moving || CRS.resT > 4)) { CRS.phase = 'result'; CRS.resT = 0; if (!CRS.got.length) { crSay('残念！でも景品の位置は変わったよ。次は近づくかも', C.dim); sfx.miss(); } }
        break;
      }
      case 'result': CRS.resT += dt; if (CRS.resT > (CRS.got.length ? 1.4 : 0.7)) { crReset(); writeSave(); } break;
      default:
    }
    // 運ぶ景品：爪の動きに合わせて、ぶらさがる。重い・ずれている・ゆれるほど、ぽろっと すべり落ちる
    CRS.vx = (CRS.cx - px0) / Math.max(dt, 1e-3); CRS.vz = (CRS.cz - pz0) / Math.max(dt, 1e-3);
    if (CRS.carry.length) {
      const G = CRC.grab; const swing = Math.min(1, Math.hypot(CRS.vx, CRS.vz) / (C2.move * 1.2));
      for (let i = CRS.carry.length - 1; i >= 0; i--) {
        const p = CRS.carry[i]; const T = CRC.prizes[p.t];
        const loss = Math.max(0.02, T.weight * G.lossBase - p.strength * G.lossBase + swing * G.swing * 0.35 + (p.how === 'strap' ? G.strapBonus : 0) + (CRS.phase === 'lift' ? 0.1 : 0));
        let rate = loss;
        if (p.heavy) { const H = G.heavyHold; rate = H.base + (1 - Math.min(1, p.strength)) * H.grip + swing * H.swing + (CRS.phase === 'lift' ? 0.04 : 0); }       // 重い景品：持ち上がって、上まで行くが、重いのでバランスを崩しやすい（途中で、ぽろっと落ちやすい）
        p.slip += rate * dt;
        p.x = CRS.cx + p.offX * (1 - p.slip * 0.3) + Math.sin(CRS.clock * 6 + i) * swing * 1.2; p.z = CRS.cz + p.offZ; { const dmc = crDim(p.t); const yy = CRS.cy + p.dy; p.y = Math.max(p.y0 - 0.3, Math.min(yy, CRS.cy - dmc.h)); }       // 景品は、アームの下にぶら下がる（アームの上へはみ出さない）
        if (p.slip >= 1 && CRS.phase !== 'release') { p.car = false; p.vy = 0; p.vx = CRS.vx * 0.2; p.vz = CRS.vz * 0.2; CRS.carry.splice(i, 1); beep(260, 0, 0.1, 0.05, 'square', 90); noise(0.06, 0.03); crSay('あっ……ぽろっ！', C.pink); CRS.drop = CRS.clock; }
      }
    }
  }
  function crGet(list) {
    const c = crP(); const names = [];
    for (const p of list) {
      const T = CRC.prizes[p.t]; names.push(T.name);
      const sh = c.shelf[p.t] || (c.shelf[p.t] = { n: 0, first: crDay(), from: CRC.machines[CRS.key].short });
      sh.n++; c.gets++; CRS.got.push(p.t);
    }
    CRS.glow = 1.2; beep(180, 0, 0.18, 0.06, 'square', 60); noise(0.2, 0.05);                                  // ガコン！
    [1047, 1319, 1568].forEach((f, i) => beep(f, 0.25 + i * 0.07, 0.1, 0.05));
    CRS.banner = { lines: [{ text: list.length > 1 ? list.length + ' PRIZES GET!' : 'GET!', scale: 3, color: '#ffe070' }, { text: names.join(' + '), scale: 1, color: '#ffffff' }], t: 0, dur: 2.2 };
    crSay((list.length > 1 ? list.length + '個一度に！' : '') + names.join('・') + 'をゲット！', C.goldLight); writeSave();
  }
  // 翌DAY：取られた空きだけ補充。5DAY動いていない景品だけ、軽く整頓（プレイヤーが動かした景品は、そのまま）
  function crNextDay() {
    const c = crP(); const day = crDay();
    for (const key of Object.keys(CRC.machines)) {
      const st = c.machines[key]; if (!st) continue; const M = CRC.machines[key];
      let added = 0; let rare = false; const old = st.prizes.map((p) => [p, p.x, p.z, p.y]);       // 前日までに あった景品の位置（補充のあとも、そのまま）
      while (st.prizes.length < M.count) { const p = crSpawnOne(key, st, true, true); if (!p) break; p.lm = day; added++; if (CRC.prizes[p.t].rare) rare = true; }
      for (const p of st.prizes) {
        const dm = crDim(p.t);
        if (day - p.lm >= CRC.restock.tidyDays && (p.x < dm.rad + 1.5 || p.x > CRX - dm.rad - 1.5 || p.z < dm.rad + 1.5)) { p.x += (CRX / 2 - p.x) * 0.1; p.z += (CRZ / 2 - p.z) * 0.08; }
      }
      for (let i = 0; i < 300; i++) crPhys(st, 1 / 60);
      for (const [p, x, z, y] of old) { p.x = x; p.z = z; p.y = y; p.vx = 0; p.vz = 0; p.vy = 0; }       // プレイヤーが寄せた景品を、動かさない
      st.prizes.forEach((p) => { p.lm = p.lm || 0; });
      if (rare) st.news = day;
    }
  }
  // ---- 描画：正面（少し見下ろし）と、横（同じ座標を横から） ----
  const crLay = () => { const dx = W - 180; return { vx: 12, vy: 50, vw: 156 + dx, vh: 178, dx }; };
  function crProj(x, z, y) {
    const L = crLay(); const f = 0.56 + 0.44 * (z / CRZ); const cxs = L.vx + L.vw / 2; const k = L.vw / CRX;
    return { sx: cxs + (x - CRX / 2) * k * f * 0.97, sy: L.vy + 52 + (L.vh - 72) * (z / CRZ) - y * k * f * 0.92, f };
  }
  function crDrawShadow(p, scale, side) {                         // 床の影（景品が床に のっていることが、分かるように）。高いところにある景品は、影が小さく・うすい
    const dm = crDim(p.t); const L = crLay(); const k = L.vw / CRX;
    if (side) return;
    const q = crProj(p.x, p.z, 0); const lift = Math.min(1, Math.max(0, p.y) / 30);
    const w = Math.max(5, Math.round(dm.w * k * q.f * 0.9 * (1 - lift * 0.35)));
    ctx.globalAlpha = 0.5 * (1 - lift * 0.6);
    rect(Math.round(q.sx - w / 2), Math.round(q.sy) - 1, w, 3, '#000000'); rect(Math.round(q.sx - w / 2) + 1, Math.round(q.sy) - 2, w - 2, 1, '#000000'); rect(Math.round(q.sx - w / 2) + 1, Math.round(q.sy) + 2, w - 2, 1, '#000000');
    ctx.globalAlpha = 1;
  }
  function crDrawPrize(p, sx, sy, scale, t, side) {
    const T = CRC.prizes[p.t]; const img = crImg(p.t); const dm = crDim(p.t); const L = crLay(); const cr = img ? crCrop(p.t) : null;
    const iw = cr ? cr.sw : (img ? img.naturalWidth : 1); const ih = cr ? cr.sh : (img ? img.naturalHeight : T.ratio);
    let dw; let dh;
    if (side) { dh = Math.max(4, Math.round(dm.h * ((L.vh - 50) / CRY))); dw = img ? Math.round(dh * iw / ih) : Math.round(dh / T.ratio); }
    else { dw = Math.max(4, Math.round(dm.w * (L.vw / CRX) * scale * 0.97)); dh = img ? Math.round(dw * ih / iw) : Math.round(dw * T.ratio); }
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy) + (side ? 0 : 1)); if (Math.abs(p.rot) > 0.04) ctx.rotate(p.rot * 0.6);       // 足元を、床に ほんの少し めり込ませる
    if (img) ctx.drawImage(img, cr.sx, cr.sy, cr.sw, cr.sh, -Math.round(dw / 2), -dh, dw, dh); else rect(-dw / 2, -dh, dw, dh, '#888');
    if (T.strap) {                                                // ストラップ：別パーツ（ボールチェーン＋リング）。ゆらゆら
      const ax = -dw / 2 + T.strap.ax * dw; const ay = -dh + T.strap.ay * dh; const sw = Math.sin(CRS.clock * 3 + (p.x * 0.7)) * 1.2;
      for (let i = 0; i < 3; i++) rect(Math.round(ax + sw * (i + 1) * 0.4), Math.round(ay - 1 - i * 2), 1, 1, i === 2 ? '#ffd040' : '#c8c8d8');
    }
    ctx.restore();
  }
  function crDrawClawBody(sx, sy, spPx, topSy, f, pl) {
    pl = pl || Math.max(3, Math.round(7 * f));
    rect(Math.round(sx), topSy, 1, Math.max(0, sy - topSy - 5), '#8a8aa0');                                            // ワイヤー
    const bw = Math.max(4, Math.round(spPx * 0.5)); rect(Math.round(sx) - bw, Math.round(sy) - 6, bw * 2 + 1, 4, '#c8c8d8'); rect(Math.round(sx) - bw, Math.round(sy) - 6, bw * 2 + 1, 1, '#ffffff');
    for (const sgn of [-1, 1]) {
      const bx = Math.round(sx + sgn * spPx); rect(bx, Math.round(sy) - 2, 1, pl, '#e8e8f4'); rect(bx - (sgn > 0 ? 2 : 0), Math.round(sy) - 2 + pl, 3, 1, '#e8e8f4');
      for (let k = 0; k < spPx; k += 1) rect(Math.round(sx + sgn * k), Math.round(sy) - 3, 1, 1, '#a8a8c0');
    }
  }
  function crDrawMarker(L) {                                      // 床の、やわらかい影：アームの真下（線や枠は使わない。奥へ動くと、いっしょに動く）
    const q = crProj(CRS.cx, CRS.cz, 0); const k = L.vw / CRX; const sx = Math.round(q.sx); const sy = Math.round(q.sy);
    const half = Math.max(7, Math.round((CRS.sp + 3) * k * q.f * 0.97)); const rh = Math.max(3, Math.round(4 * q.f + 1));          // 左右の爪を含む大きさ
    for (let layer = 0; layer < 3; layer++) {                                                                              // 外側ほどうすい：3枚かさねて、ふちをぼかす
      const sc = 1 - layer * 0.22; const hw = Math.round(half * sc); const hh = Math.max(1, Math.round(rh * sc));
      ctx.globalAlpha = 0.13;
      for (let r = -hh; r <= hh; r++) { const w = Math.round(hw * Math.sqrt(Math.max(0, 1 - (r * r) / ((hh + 0.5) * (hh + 0.5))))); if (w > 0) rect(sx - w, sy + r, w * 2 + 1, 1, '#000000'); }
    }
    ctx.globalAlpha = 1;
  }
  function crDrawFront(st) {
    const L = crLay(); const M = CRC.machines[CRS.key];
    rect(L.vx, L.vy, L.vw, L.vh, '#0a0814');
    for (let y = 0; y < L.vh - 120; y++) { rect(L.vx, L.vy + y, L.vw, 1, mixHex('#2a2448', '#161230', y / (L.vh - 120))); }          // 奥の壁
    const fb = L.vy + 52; const ff = L.vy + L.vh - 20;
    for (let y = fb; y < ff; y++) {                                                                                           // 床（奥は せまく、手前は ひろい）
      const z = ((y - fb) / (ff - fb)) * CRZ; const a = crProj(0, z, 0); const b = crProj(CRX, z, 0);
      rect(Math.round(a.sx), y, Math.round(b.sx - a.sx), 1, mixHex(mixHex(M.color, '#10101c', 0.82), '#10101c', (Math.floor((y - fb) / 5) % 2) ? 0.15 : 0));
    }
    rect(L.vx, ff, L.vw, L.vy + L.vh - ff, '#0e0a1c');
    const c0 = crProj(0, CRZ, 0); const c1 = crProj(CRC.chute.x, CRC.chute.z, 0);                                           // 景品口
    const cw = Math.round(c1.sx - c0.sx); rect(Math.round(c0.sx), Math.round(c1.sy), cw, Math.round(c0.sy - c1.sy), CRS.glow > 0 ? '#ffe070' : '#05030a'); rect(Math.round(c0.sx), Math.round(c1.sy), cw, 1, '#ffd040');
    drawText('EXIT', Math.round(c0.sx) + 3, Math.round(c1.sy) + 3, '#7a6a9a', 1);
    crDrawMarker(L);                                              // 床：アームの真下の、影とマーカー（奥行きの目安。アームが奥へ動くと、いっしょに動く）
    const order = st.prizes.slice().sort((a, b) => (a.z - b.z) || (a.y - b.y));
    for (const p of order) crDrawShadow(p, 1, false);
    for (const p of order) if (p.z <= CRS.cz) { const q = crProj(p.x, p.z, p.y); crDrawPrize(p, q.sx, q.sy, q.f, p.t); }       // アームより奥の景品
    const top = crProj(CRS.cx, CRS.cz, CRS.cy); const rail = L.vy + 6;
    rect(L.vx, rail - 3, L.vw, 3, '#4a4a64'); rect(L.vx, rail - 3, L.vw, 1, '#8a8aa8');
    for (const p of CRS.carry) { const q = crProj(p.x, p.z, p.y); crDrawPrize(p, q.sx, q.sy, q.f, p.t); }
    const pl = Math.max(4, Math.round(crPL() * (L.vw / CRX) * top.f * 0.92));                         // 爪の長さ：台ごとに固定（掴むときに伸びない）
    crDrawClawBody(top.sx, top.sy, Math.max(2, Math.round(CRS.sp * (L.vw / CRX) * top.f * 0.97)), rail, top.f, pl);
    for (const p of order) if (p.z > CRS.cz) { const q = crProj(p.x, p.z, p.y); crDrawPrize(p, q.sx, q.sy, q.f, p.t); }       // アームより手前の景品（アームの前に見える）
    drawText('FRONT', L.vx + 3, L.vy + L.vh - 10, '#6a6a88', 1);
  }
  function crBtnBoxes() {
    const dx = W - 180; const half = Math.floor((156 + dx - 4) / 2);
    return { insert: { x: 24, y: 244, w: 132 + dx, h: 48 }, yoko: { x: 12, y: 244, w: half, h: 60 }, oku: { x: 12 + half + 4, y: 244, w: half, h: 60 } };
  }
  const CR_BTN = {};
  function crBuildButtons() {
    if (CR_BTN.insert) return;
    const mk = (id, text) => { const b = document.createElement('button'); b.className = 'cr-btn'; b.id = id; b.textContent = text; b.type = 'button'; screenEl.appendChild(b); return b; };
    CR_BTN.insert = mk('cr-insert', '¥100 入れる'); CR_BTN.yoko = mk('cr-yoko', '横'); CR_BTN.oku = mk('cr-oku', '奥');
    CR_BTN.insert.addEventListener('click', () => { ensureAudio(); crInsert(); });
    for (const [el, which] of [[CR_BTN.yoko, 'x'], [CR_BTN.oku, 'z']]) {
      el.addEventListener('pointerdown', (e) => { ensureAudio(); e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } crHoldStart(which); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, () => { if (CRS.hold === which) crHoldEnd(); });
    }
  }
  function crPlace(el, box) {
    const r = canvas.getBoundingClientRect(); const host = screenEl.getBoundingClientRect(); const sc = (r.width - 8) / CW;
    el.style.left = (r.left - host.left + 4 + (box.x + wideOff()) * sc) + 'px'; el.style.top = (r.top - host.top + 4 + box.y * sc) + 'px';
    el.style.width = box.w * sc + 'px'; el.style.height = box.h * sc + 'px'; el.style.fontSize = Math.max(11, 8.4 * sc) + 'px';
  }
  function crLayoutButtons() { crBuildButtons(); const b = crBtnBoxes(); crPlace(CR_BTN.insert, b.insert); crPlace(CR_BTN.yoko, b.yoko); crPlace(CR_BTN.oku, b.oku); }
  function crHideButtons() { if (!CR_BTN.insert) return; for (const k of Object.keys(CR_BTN)) CR_BTN[k].classList.remove('is-show'); }
  function crUpdateButtons() {
    crBuildButtons(); const idle = CRS.phase === 'idle';
    CR_BTN.insert.classList.toggle('is-show', idle); CR_BTN.insert.classList.toggle('is-off', idle && P_().money < CRC.price);
    CR_BTN.yoko.classList.toggle('is-show', !idle); CR_BTN.oku.classList.toggle('is-show', !idle);
    CR_BTN.yoko.classList.toggle('is-off', !crButtonAllowed('x')); CR_BTN.oku.classList.toggle('is-off', !crButtonAllowed('z'));
    CR_BTN.yoko.classList.toggle('is-on', CRS.hold === 'x'); CR_BTN.oku.classList.toggle('is-on', CRS.hold === 'z');
  }
  function crDraw() {
    const M = CRC.machines[CRS.key]; const st = crState(CRS.key); const dx = W - 180; const hx = Math.round(dx / 2);
    mgFrame('#06060e', mixHex(M.color, '#10101c', 0.55), M.color);
    mgSign(M.short + ' CATCHER', M.color, mixHex(M.color, '#000000', 0.5));
    rect(12, 36, 74 + hx, 11, '#0a0610'); rect(94 + hx, 36, 74 + dx - hx, 11, '#0a0610');
    drawText('MONEY', 15, 39, C.dim, 1); const mt = 'YEN ' + P_().money; drawText(mt, 83 + hx - textWidth(mt, 1), 39, C.goldLight, 1);
    drawText('1 PLAY', 97 + hx, 39, C.dim, 1); const pt = 'YEN ' + CRC.price; drawText(pt, 165 + dx - textWidth(pt, 1), 39, '#9fe8ff', 1);
    crDrawFront(st);
    if (st.news && crDay() - st.news < 1) { rect(14 + dx, 54, 38, 12, '#ff5a6a'); drawText('NEW!', 18 + dx, 57, '#ffffff', 1); }
    mgBannerDraw(CRS.banner, 120);
    crUpdateButtons();
    drawText(CRS.phase === 'idle' ? 'READY' : CRS.phase.toUpperCase(), 14, 312, '#6a6a88', 1);
    const c = crP(); mgStrip([['PLAY ' + CRS.plays, '#e8f0ff'], ['GET ' + CRS.got.length, '#7dff8a'], ['LEFT ' + st.prizes.length, '#ffe070']]);
  }
  mgRegister('craneGame', {
    reset() { crReset(); }, phase: () => CRS.phase,
    enter() { crBuildButtons(); crLayoutButtons(); crReset(); CRS.plays = 0; CRS.got = []; CRS.lastMsg = ''; crState(CRS.key); },
    update: crUpdate, draw: crDraw, hint: '「横」→「奥」でアームを動かそう',
    pointer() {}, pointerUp() {}
  });
  GAME_TYPES.craneGame.canLeave = () => ['idle', 'ready', 'xset', 'result'].includes(CRS.phase);
  GAME_TYPES.craneGame.msgBox = () => ({ x: 14, y: 314, w: 152 + (W - 180), h: 44 });

