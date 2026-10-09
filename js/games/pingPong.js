'use strict';
  // =====================================================================
  //  🏓 PING PONG RALLY（ピンポンラリー）：6F SPORTS CORNER
  //   プレイヤーの後ろ斜めから見た、疑似3Dの卓球。飛んできた球を見て、タイミングよく スワイプして 打ち返す（ラケットは ひっぱらない）
  //   5点先取・デュースなし・2点ごとに サーブこうたい。CPUは、毎試合のはじめに 5段階（cpuProfiles）から ランダムに決まる。強さは 画面に出さない（DEV画面だけ）。試合中は固定
  //   CPUは、少し前（reaction）の球の状態を見て、ラケットを動かす（ワープなし）。打ちかたを決めるだけで、球は プレイヤーと同じ「打球システム」で とぶ
  //   報酬なし・戦績保存なし・MEDAL不使用・¥100（gameId＝ping_pong_rally）
  // =====================================================================
  const TTC = CONFIG.pingPong;
  const TT_MACHINE = { machineId: 'tt_pingpong', machineName: 'PING PONG RALLY', label: 'PING PONG RALLY', isUnlocked: true, gameType: 'pingPong', tt: true };
  const TTW = { half: 50, L: 180, netZ: 90, netH: 10 };
  const TT = { phase: 'select', t: 0, clock: 0, score: { you: 0, cpu: 0 }, level: 3, prof: null, ball: null, hist: [], matchTime: 0, sudden: false, serving: 'you', banner: '', bannerT: 0, flash: 0, point: null, winner: '', cnt: 0, sw: null, swing: null, cpuPlan: null, cpuRacket: { x: 0, swing: 0, dir: 1 }, yourRacket: { x: 0, swing: 0, dir: 1 }, trail: [], lastShot: null, sfxCd: 0, info: '', reToss: 0, lastPlayerShot: null,
    dev: { level: 0, show: false, cpuTarget: false, ballInfo: false, swipeInfo: false, traj: false, mistake: false, forceNet: false, forceOut: false, bot: null, speedScale: 1, noCpu: false } };
  const ttGauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.sqrt(0.5); };
  // ---- 疑似3D：台の上の座標（x：よこ／z：てまえ＝0、おく＝L／h：たかさ）を、画面の点へ ----
  const TTV = { f: 190, zc: 125, camH: 135, y0: 108 };
  function ttProj(x, z, h) { const s = TTV.f / (z + TTV.zc); const kx = W / 198; return { sx: W / 2 + x * s * kx, sy: TTV.y0 + (TTV.camH - (h || 0)) * s, s: s * kx }; }
  function ttPickLevel() { if (TT.dev.level > 0) return TT.dev.level; const w = TTC.cpuLevelWeights; let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { if (r < w[i]) return i + 1; r -= w[i]; } return 3; }
  function ttNewMatch() {
    TT.score = { you: 0, cpu: 0 }; TT.level = ttPickLevel(); TT.prof = TTC.cpuProfiles[TT.level]; TT.matchTime = 0; TT.sudden = false; TT.winner = ''; TT.ball = null; TT.hist = []; TT.swing = null; TT.sw = null; TT.cpuPlan = null; TT.point = null;
    TT.cpuRacket = { x: 0, swing: 0, dir: 1, vx: 0 }; TT.yourRacket = { x: 0, swing: 0, dir: 1 }; TT.lastPlayerShot = null;
  }
  const ttServer = () => (Math.floor((TT.score.you + TT.score.cpu) / 2) % 2 === 0 ? 'you' : 'cpu');                    // 2点ごとに こうたい（さいしょは プレイヤー）
  // ---- 打球システム（プレイヤーも CPU も、これを使う）：目標の着地点・球速・「うまさ」から、はじめの速度をきめる ----
  function ttCalcShot(side, o, x0, z0, hb) {                                                                              // 目標の着地点・球速・「うまさ」から、はじめの速度を計算する（球は まだ動かさない）
    const B = TTC.ball; const q = clamp(o.q == null ? 1 : o.q, 0, 1); const sn = clamp(o.sn, 0, 1);
    const tempo = TTC.tempo[Math.min(TTC.tempo.length - 1, Math.floor((TT.rally || 0) / 5))] || 1;                                                                     // ラリーが つづくほど、すこしずつ 速い（上限つき）
    const hSpeed = clamp((B.minSpeed + (B.maxSpeed - B.minSpeed) * sn) * (0.82 + 0.18 * q) * (side === 'you' ? B.playerScale : B.cpuScale) * (TT.dev.speedScale || 1) * tempo, B.minSpeed * 0.8, B.maxSpeed);                    // 水平の速さ
    const landD = clamp(70 - 55 * (o.depth == null ? sn : o.depth), 12, 70); const tz = side === 'you' ? TTW.L - landD : landD; const tx = o.x;                                                                                                // 着地点：相手コートの、はしからの きょり
    const h0 = clamp(hb, 6, 46); const dx = tx - x0; const dz = tz - z0; const D = Math.hypot(dx, dz); const T = Math.max(0.28, D / hSpeed); const vx = dx / T; const vz = dz / T; let vh = (B.gravity * T) / 2 - h0 / T;
    if (o.lift) vh += o.lift;                                                                                              // ふわっと（甘い球）
    const tn = (TTW.netZ - z0) / vz; const need = TTW.netH + (o.clearance == null ? B.netClearance : o.clearance);
    if (tn > 0) { const hn = h0 + vh * tn - (B.gravity * tn * tn) / 2; if (hn < need) vh += (need - hn) / tn; }                                                                                                                      // ネットを こえる高さ（ひどい打球だと、clearanceが小さく→ネットにかかる）
    return { vx, vz, vh, h0, hSpeed, landD, tx, tz };
  }
  function ttPredictArrival(x, z, h, vx, vz, vh) {                                                                        // CPUが打った球が、プレイヤーのラケットの線に とどく「位置・高さ・時間」を さきに計算する（台でバウンド1回・2回バウンドはNG）
    const G = TTC.ball.gravity; const R = TTC.racket; let t = 0; let bounced = false; const dt = 1 / 120;
    for (let i = 0; i < 480; i++) {
      vh -= G * dt; x += vx * dt; z += vz * dt; h += vh * dt; t += dt;
      if (h <= 0 && vh < 0 && z >= 0 && z <= TTW.L && Math.abs(x) <= TTW.half) { if (bounced) return { ok: false, why: 'double' }; if (z < TTW.netZ) { h = 0; vh = -vh * TTC.ball.tableRest; vx *= 0.985; vz *= 0.985; bounced = true; } else return { ok: false, why: 'ownHalf' }; }                  // CPUの球は、プレイヤーがわ（z<ネット）で、1回バウンドするのが正しい
      if (bounced && z <= R.hitZ) return { ok: true, x, h, t };
      if (h < -12) return { ok: false, why: 'fell' };
    }
    return { ok: false, why: 'timeout' };
  }
  function ttHit(side, o) {
    const b = TT.ball; const dir = side === 'you' ? 1 : -1; let r = ttCalcShot(side, o, b.x, b.z, b.h); const F = TTC.fair; const mistake = (o.clearance != null && o.clearance < 0) || Math.abs(o.x) > TTW.half + 4;
    if (side === 'cpu' && !mistake) {                                                                                     // フェアな球：人間が ラケットを動かして とどく球だけにする
      const R = TT.yourRacket; const budgetSpeed = F.speed; let tries = 0; let adj = 0; TT.fairStats = TT.fairStats || { shots: 0, adjusted: 0, failed: 0 };
      for (; tries < F.tries; tries++) {
        const pr = ttPredictArrival(b.x, b.z, r.h0, r.vx, r.vz, r.vh); let fine = pr.ok && pr.h >= 0 && pr.h <= F.maxH && pr.t >= F.minTime && Math.abs(pr.x) <= TTW.half + 10;
        if (fine) { const d = Math.abs(pr.x - R.x); const budget = budgetSpeed * (pr.t - F.reaction) + TTC.racket.halfW * 0.9; fine = d <= budget; }
        if (fine) break; adj++; const o2 = Object.assign({}, o); o.x = o.x + (R.x - o.x) * 0.3; o.sn = Math.max(0.12, o.sn - 0.07); if (o.depth != null) o.depth = Math.max(0.1, o.depth - 0.07); r = ttCalcShot(side, o, b.x, b.z, b.h);                // コースを寄せ、すこしおそく
      }
      TT.fairStats.shots++; if (adj) TT.fairStats.adjusted++; if (tries >= F.tries) TT.fairStats.failed++;
    }
    const sn = clamp(o.sn, 0, 1); const q = clamp(o.q == null ? 1 : o.q, 0, 1); const B = TTC.ball;
    b.vx = r.vx; b.vz = r.vz; b.vh = r.vh; b.h = r.h0; b.hitter = side; b.stage = 'fly1'; b.recv = side === 'you' ? 'cpu' : 'you'; b.t = 0; b.swung = false; b.botT = 0; TT.swing = null; b.shot = { side, sn, q, tx: r.tx, tz: r.tz, hSpeed: Math.round(r.hSpeed), smash: !!o.smash }; b.sweet = o.sweet || 0; TT.lastShot = b.shot; TT.trail = []; TT.rally = (TT.rally || 0) + 1; TT.fx = { x: b.x, z: b.z, h: b.h, t: 0.28, smash: !!o.smash, side };
    if (TT.rally >= 5 && TT.rally % 5 === 0) { TT.rallyPop = { n: TT.rally, t: 0.95 }; [1047, 1319, 1568].forEach((f, i) => beep(f, 0.04 + i * 0.05, 0.08, 0.04, 'triangle')); }                                                          // RALLY 5! 10! 15! 20!
    const k = clamp(r.hSpeed / B.maxSpeed, 0, 1); if (o.smash) { beep(2000, 0, 0.05, 0.1, 'square'); beep(1100, 0.01, 0.1, 0.09, 'sawtooth'); noise(0.07, 0.09); beep(300, 0.02, 0.08, 0.07, 'square'); TT.shake = TTC.smash.shake; TT.pop = { txt: side === 'you' ? 'SMASH!' : 'CPU SMASH', t: TTC.smash.popT, side }; }                  // パァン！！
    else { const f0 = side === 'you' ? 1560 : 1280; beep(f0 + 160 * k, 0, 0.035, 0.085, 'square'); beep(f0 * 0.5, 0.004, 0.03, 0.04, 'triangle'); noise(0.018, 0.05); }                                                   // ｶﾝｯ（プレイヤーと CPUで、すこし音がちがう）
    if (side === 'you') { TT.lastPlayerShot = { sn, q, x: r.tx, d: r.landD, hSpeed: r.hSpeed, smash: !!o.smash }; b.cpuNoise = ttGauss() * TT.prof.moveError; TT.cpuStartX = TT.cpuRacket.x; } TT.hist = [];                    // CPUのラケットが、打たれた時にいた場所（そこから どれだけ走らされるか）
  }
  function ttBallPoint(who, reason) {                                                                                      // 点が入る：who＝点をとった側
    if (!TT.ball || TT.point) return; const sh = TT.ball.shot; const smashPoint = !!(sh && sh.smash && sh.side === who && reason === 'MISS'); TT.point = { winner: who, reason, smashPoint }; TT.ball.stage = 'dead'; TT.score[who]++; TT.phase = 'point'; TT.t = 0;
    TT.banner = who === 'you' ? 'POINT!' : 'CPU POINT'; TT.sub = reason === 'NET' || reason === 'OUT' ? reason : ''; TT.bannerT = 0.95; TT.flash = smashPoint ? 0.32 : who === 'you' ? 0.12 : 0.1; TT.rallyLast = TT.rally || 0;
    if (reason === 'NET') { noise(0.06, 0.04); beep(190, 0, 0.1, 0.05, 'sine'); } else if (reason === 'OUT') beep(240, 0, 0.14, 0.05, 'sine'); else { beep(who === 'you' ? 880 : 330, 0, 0.1, 0.05, 'triangle'); }
    if (who === 'you') { beep(1175, 0.08, 0.1, 0.05, 'triangle'); } if (smashPoint) { [880, 1175, 1568, 2093].forEach((f, i) => beep(f, i * 0.05, 0.1, 0.07, 'triangle')); noise(0.12, 0.07); }                            // スマッシュで取った点は、すこし強く
    if (TT.score[who] >= TTC.winScore || TT.sudden) TT.winner = who;
  }
  function ttStepBall(dt) {
    const b = TT.ball; if (!b || b.stage === 'dead' || b.stage === 'wait') return; const G = TTC.ball.gravity; const pz = b.z;
    b.vh -= G * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.h += b.vh * dt; b.t += dt;
    if (b.stage === 'fly1' || b.stage === 'fly2') {
      if ((pz - TTW.netZ) * (b.z - TTW.netZ) <= 0 && pz !== b.z && Math.abs(b.x) < TTW.half + 6) { if (b.h < TTW.netH) { ttBallPoint(b.hitter === 'you' ? 'cpu' : 'you', 'NET'); b.vz *= 0.1; b.vx *= 0.1; return; } }          // ネット（台の ま中の たかさ）
    }
    if (b.h <= 0 && b.vh < 0) {
      const onTable = b.z >= 0 && b.z <= TTW.L && Math.abs(b.x) <= TTW.half;
      if (onTable) {
        b.h = 0; b.vh = -b.vh * TTC.ball.tableRest; b.vx *= 0.985; b.vz *= 0.985; const side = b.z < TTW.netZ ? 'you' : 'cpu'; if (TT.sfxCd <= 0) { TT.sfxCd = 0.04; beep(1100, 0, 0.03, 0.05, 'square'); }                                // 台にバウンド：コッ
        if (b.stage === 'toss') { b.stage = 'tossFault'; return; }
        if (b.stage === 'fly1') { if (side === b.hitter) { ttBallPoint(b.recv, b.z > TTW.netZ - 8 && b.z < TTW.netZ + 8 ? 'NET' : 'NET'); return; } b.stage = 'fly2'; b.bounced = true; b.bounceZ = b.z; TT.cpuPlanNeeded = b.recv === 'cpu'; TT.bounceAt = TT.clock; }
        else if (b.stage === 'fly2') { ttBallPoint(b.hitter, 'MISS'); return; }                                                  // 2回バウンド＝返せなかった
      } else if (b.h < -10) { if (b.stage === 'fly1') ttBallPoint(b.recv, 'OUT'); else ttBallPoint(b.hitter, 'MISS'); return; }          // 台の外へ おちた
    }
    if (b.stage === 'fly2' && b.recv === 'you' && b.vz < 0 && pz > TTC.racket.hitZ && b.z <= TTC.racket.hitZ) {                  // ラケットの線を、とおったとき：ラケットの はばに入っていれば、じどうで うちかえす
      const K = TTC.racket; const off = (b.x - TT.yourRacket.x) / K.halfW; if (Math.abs(off) <= 1 + 7 / K.halfW && b.h >= -6 && b.h <= K.maxH + 6) { ttPlayerAutoHit(off); return; }                                    // ラケットの はしの 少しそとでも、あたりにする（取れそうな球は、取れる）
    }
    if (b.stage === 'fly2') { if (b.recv === 'you' && b.z < -26) ttBallPoint('cpu', 'MISS'); else if (b.recv === 'cpu' && b.z > TTW.L + 26) ttBallPoint('you', 'MISS'); }
    if (b.stage === 'fly1' && (b.z < -40 || b.z > TTW.L + 40 || Math.abs(b.x) > 140)) ttBallPoint(b.recv, 'OUT');
  }
  // ---- プレイヤー：ラケットを、ゆびで直接うごかす。ボールが ラケットに当たったら、自動で うちかえす（タップもスワイプも いらない） ----
  const ttPxPerUnit = () => Math.abs(ttProj(1, TTC.racket.hitZ - 4, 0).sx - ttProj(0, TTC.racket.hitZ - 4, 0).sx);
  function ttPointer(e, p) {
    if (TT.phase !== 'rally' && TT.phase !== 'serve' && TT.phase !== 'ready') return; if (TT.dev.bot || TT.grab || TT.tutorial) return; if (p.y < TTC.input.minY * H) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } TT.grab = { id: e.pointerId, sx0: p.x, rx0: TT.yourRacket.x, tx: TT.yourRacket.x };                                                         // つかんだ時点の位置から、ゆびの動きぶんだけ（とびつかない）
  }
  function ttPointerMove(e, p) { const g = TT.grab; if (!g || g.id !== e.pointerId) return; g.tx = clamp(g.rx0 + TTC.racket.fingerGain * (p.x - g.sx0) / ttPxPerUnit(), -TTW.half - 16, TTW.half + 16); }
  function ttPointerUp(e) { if (TT.grab && TT.grab.id === e.pointerId) TT.grab = null; }
  function ttRacketMove(dt) {                                                                                             // ラケットは、ゆびを追う（さいだい速度つき）。ゆびを はなしても、その場に のこる
    const R = TT.yourRacket; const K = TTC.racket; let tgt = R.x; let sp = K.maxSpeed; const bot = TT.dev.bot;
    if (bot) { tgt = ttBotTarget(bot); sp = bot.speed; } else if (TT.grab) tgt = TT.grab.tx;
    tgt = clamp(tgt, -TTW.half - 16, TTW.half + 16); const d = tgt - R.x; const step = Math.min(Math.abs(d), sp * dt); const vx = Math.sign(d) * step / Math.max(dt, 1e-4); R.x += Math.sign(d) * step; R.vx = vx; R.vxs = (R.vxs || 0) * 0.8 + vx * 0.2;
  }
  function ttPlayerAutoHit(off) {                                                                                         // ラケットの、どこに当たったかで、返球の向きが なめらかに かわる：左はし＝左／まんなか＝まんなか／右はし＝右（連続）
    const K = TTC.racket; const S = TTC.smash; const R = TT.yourRacket; const b = TT.ball; off = clamp(off, -1, 1); const edge = Math.max(0, Math.abs(off) - 0.6) / 0.4; let q = 1 - 0.25 * edge;
    let x = K.lateral * off + clamp((R.vxs || 0) * K.moveBonus, -K.moveMax, K.moveMax); x = clamp(x, -K.edgeMax, K.edgeMax);                                                                                          // 動きながら当てると、その向きへ ちょっとだけ
    let sn = clamp(K.baseSn + K.perRally * TT.rally + clamp(Math.abs(R.vxs || 0) / 500, 0, 0.25) * K.moveSpeedBonus, 0.2, K.snCap);
    const sweetBall = b.sweet || 0; const centered = Math.abs(off) <= S.maxOff; const high = b.h >= S.minH; let smash = centered && high && (sweetBall >= TTC.sweet.stressMin || b.h >= S.highH) && TT.rally >= 1;                    // 甘い球を、いい打点（まんなか寄り・たかさ）で とらえたら、じどうで SMASH
    if (TT.dev.forceSmash) { smash = true; TT.dev.forceSmash = false; }
    if (smash) { sn = S.speed; q = 1; x *= 0.85; }
    let clearance = TTC.ball.netClearance; if (TT.dev.forceNet) { clearance = -8; TT.dev.forceNet = false; } if (TT.dev.forceOut) { x = TTW.half + 30; TT.dev.forceOut = false; }
    R.swing = 1; R.dir = off >= 0 ? 1 : -1; TT.lastQ = q; TT.lastOff = off; TT.lastD = off; TT.lastSmash = smash; ttHit('you', { x, sn, q, clearance, smash });
  }
  function ttPlayerServe() {                                                                                              // サーブ：トスの球を、じどうで うつ。向きは、ラケットの位置で きまる
    const b = TT.ball; b.swung = true; const R = TT.yourRacket; R.swing = 1; ttHit('you', { x: clamp(R.x * TTC.racket.serveAim, -40, 40), sn: 0.4, q: 1, depth: 0.45 });
  }
  // ---- CPU ----
  function ttCpuPlan() {                                                                                                  // 台でバウンドした瞬間：CPUが 打ちかたを きめる（球は まだ打たない）
    const b = TT.ball; const P = TT.prof; TT.cpuPlanNeeded = false; if (TT.dev.noCpu) { TT.cpuPlan = null; return; }
    const tArr = (TTW.L - b.z) / b.vz; const timeErr = ttGauss() * P.timingError + P.reaction * 0.12; const mistake = TT.dev.mistake || Math.random() < P.mistakeChance;
    const lp = TT.lastPlayerShot; const sweet = !!lp && !lp.smash && (lp.q < 0.85 || lp.hSpeed < 205 || (Math.abs(lp.x) < 8 && lp.d > 46));                                         // 甘い球（ラケットの はしに当てた／ゆっくり／まんなかで あさい）
    const smash = Math.random() < (sweet ? P.smashChance : P.smashChance * 0.2); const away = TT.yourRacket.x >= 0 ? -1 : 1; const wide = Math.random() < P.aggression;
    let aim = wide ? away * (18 + 24 * P.aggression + Math.random() * 6) : (Math.random() - 0.5) * 16; aim += ttGauss() * P.aimError;
    const sn = smash ? 0.88 + Math.random() * 0.1 : clamp(0.22 + 0.3 * P.aggression + (Math.random() - 0.5) * 0.25, 0.1, 0.8);
    const arrX = b.x + b.vx * Math.max(0, tArr); const travel = Math.abs(arrX - (TT.cpuStartX == null ? TT.cpuRacket.x : TT.cpuStartX));                                                                       // いま ラケットから 球が来る場所まで、どれだけ走らされるか
    TT.cpuPlan = { tHit: TT.clock + tArr + timeErr, timeErr, mistake, aim, sn, smash, noise: ttGauss() * P.moveError, done: false, born: TT.clock, travel };
  }
  function ttCpuThink(dt) {                                                                                               // CPUは「少し前（reaction）の球」を見て、球がとどく場所を予想して、ラケットを動かす（ワープなし・入力の先読みなし）
    const b = TT.ball; const R = TT.cpuRacket; const P = TT.prof; R.swing = Math.max(0, R.swing - dt * 4);
    let target = R.x; const incoming = b && ((b.stage === 'fly1' && b.hitter === 'you') || (b.stage === 'fly2' && b.recv === 'cpu'));
    if (incoming) {
      const want = TT.clock - P.reaction; let s = null; for (let i = TT.hist.length - 1; i >= 0; i--) if (TT.hist[i].t <= want) { s = TT.hist[i]; break; }
      if (s && s.vz > 1) { const t = (TTW.L - s.z) / s.vz; target = s.x + s.vx * Math.max(0, t) + (b.cpuNoise || 0); }
    } else if (b && b.stage === 'fly1' && b.hitter === 'cpu') target = clamp(R.x * 0.7, -20, 20); else if (!b || b.stage === 'toss') target = 0;
    target = clamp(target, -TTW.half - 14, TTW.half + 14); const d = target - R.x; const step = Math.min(Math.abs(d), P.speed * dt); R.x += Math.sign(d) * step; R.vx = Math.sign(d) * step / Math.max(dt, 1e-4);                           // ワープなし：さいだい速度ぶんだけ
    if (TT.cpuPlan && !TT.cpuPlan.done && b && b.stage === 'fly2' && b.recv === 'cpu' && TT.clock >= TT.cpuPlan.tHit) ttCpuHit();
  }
  function ttCpuHit() {
    const pl = TT.cpuPlan; pl.done = true; const b = TT.ball; const P = TT.prof; const R = TT.cpuRacket; const W_ = TTC.window; const S = TTC.sweet;
    const dist = Math.abs(R.x - b.x); if (dist > P.reach) return; if (Math.abs(pl.timeErr) > W_.cpuWindow) return;                                           // 追いつけない／タイミングが合わない
    const inc = b.shot; const smashIn = !!(inc && inc.smash); if (smashIn && Math.random() > P.smashReturn) return;                                                // スマッシュは、レベルによっては 返せない
    let x = pl.aim; let clearance = TTC.ball.netClearance; let sn = pl.sn; let lift = 0; let sweet = 0; let smash = false; let q = clamp(1 - Math.abs(pl.timeErr) / W_.cpuWindow * 0.6, 0.3, 1);
    if (pl.mistake) { if (Math.random() < 0.5) clearance = -6; else x = Math.sign(x || 1) * (TTW.half + 14); sn = Math.min(sn, 0.5); }
    else if (smashIn) { sn = TTC.smash.counterSn + Math.random() * 0.12; }                                                                                      // スマッシュを 返した：そのまま 高速ラリーに
    else {
      const skill = 1.25 - 0.1 * TT.level; const stress = clamp((0.7 * pl.travel / S.travelDiv + 0.25 * Math.abs(pl.timeErr) / W_.cpuWindow + 0.2 * dist / P.reach) * skill, 0, 1.2);        // 体勢のくずれ：大きく走らされた・ぎりぎり
      if (stress >= S.stressMin) { sweet = Math.min(1, stress); sn *= 1 - S.slow * sweet; x *= 1 - S.center * sweet; lift = S.lift * sweet; q = Math.min(q, 0.7); }                                         // くずれた → おそく・まんなか寄りに・ふわっと（甘い球）
      else if (pl.smash) { smash = true; sn = 0.9; }                                                                                                          // 甘い球を もらったので、スマッシュ
    }
    R.swing = 1; R.dir = x >= R.x ? 1 : -1; ttHit('cpu', { x, sn, q, clearance, depth: sn, lift, sweet, smash });
  }
  // ---- サーブ ----
  function ttTossBall(side) {
    const hold = TTC.serve; TT.ball = { x: 0, z: side === 'you' ? 10 : TTW.L - 10, h: hold.startH, vx: 0, vz: 0, vh: hold.tossV, stage: 'toss', hitter: side, recv: side === 'you' ? 'cpu' : 'you', t: 0, swung: false };
    TT.swing = null; TT.cpuPlan = null; TT.reToss = 0; TT.hist = [];
    if (side === 'cpu') { const P = TT.prof; TT.cpuServe = { at: TT.clock + 0.38 + P.reaction * 0.3 + Math.random() * 0.08 }; }
  }
  function ttBegin() {
    if (P_().money < TTC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    chargeYen(TTC.price); writeSave(); ttNewMatch(); TT.phase = 'ready'; TT.t = 0; TT.cnt = 0; beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); beep(660, 0.25, 0.1, 0.05, 'square');
  }
  function ttStartServe() { TT.rally = 0; TT.rallyPop = null; TT.pop = null; TT.serving = ttServer(); TT.phase = 'serve'; TT.t = 0; TT.point = null; TT.ball = null; TT.banner = TT.serving === 'you' ? 'YOUR SERVE' : 'CPU SERVE'; TT.bannerT = 0.9; TT.swing = null; TT.sw = null; TT.cpuPlan = null; }
  const ttEnd = () => { TT.phase = 'end'; TT.t = 0; if (TT.winner === 'you') [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.06, 'triangle')); else if (TT.winner === 'draw') [523, 523, 659].forEach((f, i) => beep(f, i * 0.12, 0.16, 0.05, 'triangle')); else [392, 330, 262, 196].forEach((f, i) => beep(f, i * 0.12, 0.2, 0.05, 'sine')); };
  // ---- 更新 ----
  function ttBotTarget(bot) {                                                                                             // テスト専用：プレイヤーの代わりに ラケットを動かす。少し前の球から場所を予想して、ラケットのどこで打つかも えらぶ
    const b = TT.ball; if (!b) return 0; if (b.stage === 'toss') return 0; if (b.stage !== 'fly2' || b.recv !== 'you') return TT.yourRacket.x * 0.9;
    if (b.botOff == null) { b.botOff = (b.sweet || 0) >= TTC.sweet.stressMin ? (Math.random() - 0.5) * 0.2 : Math.random() < bot.wideChance ? (Math.random() < 0.5 ? -1 : 1) * (0.4 + 0.35 * Math.random()) : (Math.random() - 0.5) * 0.3; b.botNoise = ttGauss() * bot.moveError; }
    const want = TT.clock - bot.reaction; let s = null; for (let i = TT.hist.length - 1; i >= 0; i--) if (TT.hist[i].t <= want) { s = TT.hist[i]; break; } if (!s) s = TT.hist[0]; if (!s || s.vz >= -1) return TT.yourRacket.x;
    const t = (s.z - TTC.racket.hitZ) / -s.vz; return s.x + s.vx * Math.max(0, t) - b.botOff * TTC.racket.halfW + b.botNoise;
  }
  function ttUpdate(dt) {
    TT.clock += dt; dt = Math.min(dt, 0.05); TT.t += dt; const ph = TT.phase; if (ph === 'select') { TT.sel = (TT.sel || 0) + dt; return; }
    TT.sfxCd -= dt; if (TT.bannerT > 0) TT.bannerT -= dt; if (TT.flash > 0) TT.flash -= dt; if (TT.shake > 0) TT.shake -= dt; if (TT.pop && TT.pop.t > 0) TT.pop.t -= dt; if (TT.rallyPop && TT.rallyPop.t > 0) TT.rallyPop.t -= dt; if (TT.fx && TT.fx.t > 0) TT.fx.t -= dt; const R = TT.yourRacket; R.swing = Math.max(0, R.swing - dt * 4); ttRacketMove(dt);
    if (ph === 'ready') { if (TT.t > (P_().pingPongRally.tutorialSeen ? 0.8 : 99) && !TT.tutorial) { ttStartServe(); } if (TT.t > 0.4 && !P_().pingPongRally.tutorialSeen && !TT.tutorialShown) { TT.tutorial = true; TT.tutorialShown = true; } }
    else if (ph === 'serve' || ph === 'rally') {
      if (ph === 'serve' && !TT.ball && TT.t >= 0.9) { ttTossBall(TT.serving); if (TT.serving === 'you') TT.ball.x = clamp(R.x, -30, 30); }
      TT.matchTime += dt; const bs = TT.ball; if (bs && bs.stage === 'toss' && bs.hitter === 'you' && bs.vh < 0 && bs.h <= TTC.serve.hitH && !bs.swung && TT.phase !== 'point') ttPlayerServe();
      if (TT.ball) { const sub = 1 / 240; let rem = dt; while (rem > 1e-7) { const d = Math.min(rem, sub); ttStepBall(d); rem -= d; if (TT.phase === 'point') break; } }
      if (TT.ball) { const b = TT.ball; TT.hist.push({ t: TT.clock, x: b.x, z: b.z, h: b.h, vx: b.vx, vz: b.vz }); while (TT.hist.length > 80) TT.hist.shift(); if (b.stage === 'fly1' || b.stage === 'fly2') TT.phase = 'rally'; if (Math.hypot(b.vx, b.vz) > 230) { TT.trail.push({ x: b.x, z: b.z, h: b.h }); if (TT.trail.length > (b.shot && b.shot.smash ? 8 : 4)) TT.trail.shift(); } else if (TT.trail.length) TT.trail.shift(); }
      if (TT.ball && TT.ball.stage === 'tossFault') { if (TT.ball.hitter === 'you') { ttTossBall('you'); TT.ball.x = clamp(R.x, -30, 30); } else { ttBallPoint('you', 'FAULT'); } }
      if (TT.cpuPlanNeeded && TT.ball && TT.ball.stage === 'fly2') ttCpuPlan();
      if (TT.ball && TT.ball.stage === 'toss' && TT.ball.hitter === 'cpu' && TT.cpuServe && TT.clock >= TT.cpuServe.at && !TT.ball.swung) { TT.ball.swung = true; const P = TT.prof; const mistake = Math.random() < P.mistakeChance * 0.6; const x = (Math.random() - 0.5) * 30 * (0.3 + P.aggression); ttHit('cpu', { x: mistake ? 70 : x, sn: 0.4 + 0.15 * P.aggression, q: 0.8, clearance: mistake ? -6 : TTC.ball.netClearance, depth: 0.5 }); TT.cpuRacket.swing = 1; }
      if (!TT.dev.noCpu) ttCpuThink(dt); else { TT.cpuRacket.x *= 0.95; }
      const safety = TT.dev.safety > 0 ? TT.dev.safety : TTC.safetyTime;                                                   // 見えない安全タイマー
      if (TT.matchTime >= safety && !TT.sudden && !TT.winner) { if (TT.score.you !== TT.score.cpu) { TT.winner = TT.score.you > TT.score.cpu ? 'you' : 'cpu'; ttEnd(); } else TT.sudden = true; }
    } else if (ph === 'point') { if (TT.t >= TTC.pointDelay) { if (TT.winner) ttEnd(); else ttStartServe(); } }
    else if (ph === 'end') { if (TT.t >= 1.6) { TT.phase = 'result'; TT.t = 0; } }
  }
  // ---- 描画 ----
  function ttPoly(pts, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(Math.round(pts[0].sx), Math.round(pts[0].sy)); for (let i = 1; i < pts.length; i++) ctx.lineTo(Math.round(pts[i].sx), Math.round(pts[i].sy)); ctx.closePath(); ctx.fill(); }
  function ttRacket(x, z, h, swing, dir, mine) {
    const p = ttProj(x, z, h); const s = p.s * (mine ? 1.0 : 1.0); const r = (mine ? 9.5 : 8) * s; const sw = Math.sin(swing * 3.14) * 0.9 * dir; const cx = Math.round(p.sx + (mine ? sw * 14 : sw * 8)); const cy = Math.round(p.sy - (mine ? swing * 8 : swing * 3));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(mine ? -0.15 + sw * 0.6 : 3.14 - 0.15 + sw * 0.5); ctx.fillStyle = '#7a4a1c'; ctx.fillRect(-r * 0.22, r * 0.7, r * 0.44, r * 1.15); ctx.fillStyle = '#a8702a'; ctx.fillRect(-r * 0.22, r * 0.7, r * 0.14, r * 1.15);
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(0, 0, r + 1.5, 0, 6.2832); ctx.fill(); ctx.fillStyle = mine ? '#d02030' : '#e04048'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  function ttScene() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#0e2a5a'); for (let y = 8; y < H - 8; y++) rect(8, y, W - 16, 1, y < 150 ? mixHex('#7ad0f0', '#3a90c8', (y - 8) / 142) : mixHex('#1a3a78', '#0a1c44', (y - 150) / (H - 158))); rect(8, 150, W - 16, 2, '#e8f8ff');
    rect(8, 8, W - 16, 22, '#0a2a5a'); drawTextCenter('PING PONG RALLY', W / 2, 14, '#ffffff', 1, '#0a2a5a'); for (let x = 14; x < W - 24; x += 24) { rect(x, 56, 14, 40, '#8ad8f8'); rect(x, 56, 14, 1, '#ffffff'); rect(x, 96, 14, 1, '#3a90c8'); }
    const L = TTW.L; const hw = TTW.half; const g = (x, z) => ttProj(x, z, 0);
    ctx.globalAlpha = 0.35; ttPoly([g(-hw - 6, -4), g(hw + 6, -4), g(hw + 12, L + 6), g(-hw - 12, L + 6)], '#04102a'); ctx.globalAlpha = 1;
    for (const sx of [-1, 1]) { const a = ttProj(sx * (hw - 4), 4, 0); const b2 = ttProj(sx * (hw - 4), 4, -34); rect(Math.round(a.sx) - 2, Math.round(a.sy), 4, Math.round(b2.sy - a.sy), '#10285a'); }
    ttPoly([g(-hw - 3, -3), g(hw + 3, -3), g(hw + 3, L + 3), g(-hw - 3, L + 3)], '#7ad0f0'); ttPoly([g(-hw, 0), g(hw, 0), g(hw, L), g(-hw, L)], '#143a8a');
    const sh = ttProj(0, 0, 0).sy; ctx.strokeStyle = '#f4f8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); const c0 = g(-hw, 0); ctx.moveTo(c0.sx, c0.sy); for (const [x, z] of [[hw, 0], [hw, L], [-hw, L], [-hw, 0]]) { const c = g(x, z); ctx.lineTo(c.sx, c.sy); } ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); const m0 = g(0, 0); const m1 = g(0, L); ctx.moveTo(m0.sx, m0.sy); ctx.lineTo(m1.sx, m1.sy); ctx.stroke();
    const n1 = ttProj(-hw - 6, TTW.netZ, 0); const n2 = ttProj(hw + 6, TTW.netZ, 0); const n3 = ttProj(hw + 6, TTW.netZ, TTW.netH + 2); const n4 = ttProj(-hw - 6, TTW.netZ, TTW.netH + 2);
    ctx.globalAlpha = 0.4; ttPoly([n1, n2, n3, n4], '#e8f0ff'); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; for (let k = 0; k <= 12; k++) { const x = -hw - 6 + (k / 12) * (2 * hw + 12); const a = ttProj(x, TTW.netZ, 0); const b2 = ttProj(x, TTW.netZ, TTW.netH + 2); ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b2.sx, b2.sy); ctx.stroke(); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(n4.sx, n4.sy); ctx.lineTo(n3.sx, n3.sy); ctx.stroke(); for (const p of [n1, n2]) { const t = ttProj(p === n1 ? -hw - 6 : hw + 6, TTW.netZ, TTW.netH + 4); rect(Math.round(p.sx) - 1, Math.round(t.sy), 2, Math.round(p.sy - t.sy), '#c8d0e0'); }
    ttRacket(TT.cpuRacket.x, L + 12, 16, TT.cpuRacket.swing, TT.cpuRacket.dir || 1, false);
    const b = TT.ball; if (b && b.stage !== 'wait') { const sp = ttProj(b.x, b.z, 0); const bp = ttProj(b.x, b.z, Math.max(0, b.h)); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sp.sx, sp.sy, 4 * sp.s, 1.6 * sp.s, 0, 0, 6.2832); ctx.fill();
      const sm = !!(b.shot && b.shot.smash); for (let i = 0; i < TT.trail.length; i++) { const q = ttProj(TT.trail[i].x, TT.trail[i].z, TT.trail[i].h); ctx.globalAlpha = (sm ? 0.2 : 0.12) + (sm ? 0.1 : 0.08) * i; ctx.fillStyle = sm ? '#fff3a0' : '#ffffff'; ctx.beginPath(); ctx.arc(q.sx, q.sy, 3.4 * q.s, 0, 6.2832); ctx.fill(); } ctx.globalAlpha = 1;                    // スマッシュは、少し長い残像
      const r = Math.max(2, 3.6 * bp.s); ctx.fillStyle = '#c8d0dc'; ctx.beginPath(); ctx.arc(Math.round(bp.sx), Math.round(bp.sy), r + 0.8, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(bp.sx), Math.round(bp.sy), r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#fff3a0'; ctx.fillRect(Math.round(bp.sx - r * 0.5), Math.round(bp.sy - r * 0.6), Math.max(1, r * 0.4), Math.max(1, r * 0.3)); }
    if (b && b.stage === 'fly2' && b.recv === 'you' && b.vz < 0) { const ax = clamp(b.x + b.vx * ((b.z - TTC.racket.hitZ) / -b.vz), -TTW.half - 14, TTW.half + 14); const mp = ttProj(ax, TTC.racket.hitZ, 0); ctx.globalAlpha = 0.28 + 0.12 * Math.sin(TT.clock * 7); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(Math.round(mp.sx), Math.round(mp.sy), 7 * mp.s, 2.6 * mp.s, 0, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }                             // 球が ラケットの線に来る場所の、うすい目印
    ttRacket(TT.yourRacket.x, TTC.racket.hitZ - 4, 12, TT.yourRacket.swing, TT.yourRacket.dir || 1, true);
    if (TT.fx && TT.fx.t > 0) { const f = TT.fx; const q = ttProj(f.x, f.z, f.h); const k = 1 - f.t / 0.28; ctx.strokeStyle = f.smash ? '#fff3a0' : '#ffffff'; ctx.lineWidth = f.smash ? 2 : 1; ctx.globalAlpha = 1 - k; const n = f.smash ? 10 : 5; for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + 0.3; const r0 = (3 + k * (f.smash ? 12 : 6)) * q.s; ctx.beginPath(); ctx.moveTo(q.sx + Math.cos(a) * r0, q.sy + Math.sin(a) * r0); ctx.lineTo(q.sx + Math.cos(a) * (r0 + (f.smash ? 6 : 3) * q.s), q.sy + Math.sin(a) * (r0 + (f.smash ? 6 : 3) * q.s)); ctx.stroke(); } ctx.globalAlpha = 1; }                            // ラケットに当たったときの、小さな インパクト
    if (TT.flash > 0) { ctx.globalAlpha = clamp(TT.flash * 1.4, 0, 0.3); rect(8, 150, W - 16, H - 158, '#cfeaff'); ctx.globalAlpha = 1; }
    if (TT.dev.traj && b) { ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.beginPath(); let x = b.x, z = b.z, h = b.h, vx = b.vx, vz = b.vz, vh = b.vh; const q0 = ttProj(x, z, h); ctx.moveTo(q0.sx, q0.sy); for (let i = 0; i < 60; i++) { const dt2 = 1 / 40; vh -= TTC.ball.gravity * dt2; x += vx * dt2; z += vz * dt2; h += vh * dt2; if (h < 0) { h = 0; vh = -vh * TTC.ball.tableRest; } const q = ttProj(x, z, h); ctx.lineTo(q.sx, q.sy); } ctx.stroke(); }
    if (TT.dev.cpuTarget && TT.cpuPlan) { const p = ttProj(TT.cpuPlan.aim, 60, 0); ctx.strokeStyle = '#ff00ff'; ctx.beginPath(); ctx.arc(p.sx, p.sy, 4, 0, 6.2832); ctx.stroke(); }
  }
  function ttHud() {
    drawText('CPU', 14, 33, '#ffb0b0', 1, '#0a2a5a'); drawText(String(TT.score.cpu), 14, 40, '#ff6a6a', 2, '#0a2a5a'); drawText('YOU', W - 36, 33, '#b0d8ff', 1, '#0a2a5a'); drawText(String(TT.score.you), W - 24, 40, '#6ac8ff', 2, '#0a2a5a'); drawTextCenter('FIRST TO ' + TTC.winScore, W / 2, 34, '#ffffff', 1, '#0a2a5a');
    if (DEV_MODE) drawText('LV' + TT.level, W - 36, 56, '#ffe070', 1, '#0a2a5a');                                           // 開発用：いまの相手のレベル（公開版では出ない）
    if (TT.bannerT > 0 && TT.banner) { ctx.globalAlpha = Math.min(1, TT.bannerT * 2); const you = TT.banner === 'POINT!'; drawTextCenter(TT.banner, W / 2, 132, you ? '#ffe070' : '#ffb0b0', you ? 4 : 3, you ? '#7a2a04' : '#4a0a0a'); ctx.globalAlpha = 1; if (TT.sub) drawTextCenter(TT.sub, W / 2, 158, '#ffffff', 1, '#0a2a5a'); if (TT.phase === 'point') drawTextCenter('YOU ' + TT.score.you + ' - ' + TT.score.cpu + ' CPU', W / 2, 172, '#ffffff', 2, '#0a2a5a'); }
    if (TT.rallyPop && TT.rallyPop.t > 0 && TT.phase !== 'point') { const n = TT.rallyPop.n; const a = Math.min(1, TT.rallyPop.t * 2.2); const sc = n >= 20 ? 4 : n >= 15 ? 3 : n >= 10 ? 3 : 2; ctx.globalAlpha = a; drawTextCenter('RALLY ' + n + '!', W / 2, 108, n >= 20 ? '#ff8a4a' : n >= 15 ? '#ffb040' : n >= 10 ? '#ffe070' : '#ffffff', sc, n >= 15 ? '#7a2a04' : '#0a2a5a'); ctx.globalAlpha = 1; }               // RALLY 5! 10! 15! 20!（だんだん大きく）
    if (TT.pop && TT.pop.t > 0) { const a = Math.min(1, TT.pop.t * 2.5); ctx.globalAlpha = a; drawTextCenter(TT.pop.txt, W / 2, TT.pop.side === 'you' ? 136 : 138, TT.pop.side === 'you' ? '#fff3a0' : '#ff9a8a', TT.pop.side === 'you' ? 4 : 3, TT.pop.side === 'you' ? '#c03010' : '#4a0a0a'); ctx.globalAlpha = 1; }                                           // SMASH!（みじかく）
    if (TT.phase === 'end') { const w = TT.winner; drawTextCenter(w === 'draw' ? 'DRAW' : w === 'you' ? 'YOU WIN!' : 'CPU WIN', W / 2, 140, '#ffffff', 4, w === 'you' ? '#2a6aff' : '#c42028'); }
    if (TT.phase === 'ready' && !TT.tutorial) drawTextCenter('READY', W / 2, 140, '#ffffff', 4, '#0a2a5a');
    if (TT.dev.show && TT.prof) drawText('LV ' + TT.level + ' REACT ' + TT.prof.reaction + ' SPD ' + TT.prof.speed, 14, 62, '#00ff88', 1);
    if (TT.dev.ballInfo && TT.ball) drawText('V ' + Math.round(Math.hypot(TT.ball.vx, TT.ball.vz)) + ' ' + TT.ball.stage, 14, 70, '#00ff88', 1);
    if (TT.dev.swipeInfo) drawText('RACKET x ' + Math.round(TT.yourRacket.x) + ' vx ' + Math.round(TT.yourRacket.vxs || 0) + ' HIT ' + (TT.lastOff != null ? TT.lastOff.toFixed(2) : '-') + ' Q ' + (TT.lastQ != null ? TT.lastQ.toFixed(2) : '-') + ' RALLY ' + (TT.rally || 0), 14, 78, '#00ff88', 1);
  }
  function ttDrawResult() {
    ttScene(); ctx.globalAlpha = 0.86; rect(14, 150, W - 28, 176, '#06163a'); ctx.globalAlpha = 1; const you = TT.winner === 'you'; rect(14, 150, W - 28, 2, TT.winner === 'draw' ? '#c8c8d8' : you ? '#2a9aff' : '#c42028'); drawTextCenter('PING PONG RALLY', W / 2, 158, '#ffffff', 1, '#1a4a9a');
    drawText('YOU', W / 2 - 54, 174, '#8ac8ff', 1); drawText(String(TT.score.you), W / 2 - 54, 184, '#ffffff', 4, '#1a4a9a'); drawText('CPU', W / 2 + 22, 174, '#ff8a8a', 1); drawText(String(TT.score.cpu), W / 2 + 22, 184, '#ffffff', 4, '#7a1018');
    drawTextCenter(TT.winner === 'draw' ? 'DRAW' : you ? 'YOU WIN!' : 'CPU WIN', W / 2, 214, TT.winner === 'draw' ? '#e8e8f0' : you ? '#8ac8ff' : '#ff8a8a', 3, '#06163a'); drawTextCenter('YEN ' + P_().money, W / 2, 238, '#7ad8ff', 1); if (DEV_MODE) drawTextCenter('DEV  CPU LV ' + TT.level + '  /  NEXT ' + (TT.dev.level ? 'LV' + TT.dev.level : 'RANDOM'), W / 2, 248, '#ffe070', 1);
  }
  function ttDrawSelect() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#3a9ad8'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#8ad8f8', '#1a5aa8', (y - 8) / (H - 16))); rect(8, 8, W - 16, 3, '#e8f8ff');
    rect(16, 18, W - 32, 62, '#0a2a5a'); rect(18, 20, W - 36, 58, '#123a7a'); drawTextCenter('PING PONG', W / 2, 24, '#ffffff', 2, '#2a6aff'); drawTextCenter('RALLY', W / 2, 46, '#8ad8f8', 3, '#ffffff');
    const t = TT.sel || 0; const sv = { ball: TT.ball, rk: TT.yourRacket, ck: TT.cpuRacket }; TT.ball = null;
    ctx.save(); ctx.beginPath(); ctx.rect(20, 92, W - 40, 138); ctx.clip(); const g = (x, z) => ttProj(x, z, 0); ctx.fillStyle = '#0a2a5a'; ctx.fillRect(20, 92, W - 40, 138); ctx.restore();
    const cx = W / 2; rect(30, 96, W - 60, 128, '#0a2a5a'); const by = 160 + Math.sin(t * 2.2) * 26; const bx = cx + Math.sin(t * 1.4) * 40; rect(36, 100, W - 72, 120, '#143a8a'); rect(36, 160, W - 72, 1, '#f4f8ff'); rect(cx, 100, 1, 120, '#f4f8ff'); rect(34, 98, W - 68, 2, '#7ad0f0'); rect(34, 220, W - 68, 2, '#7ad0f0');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#e04048'; ctx.beginPath(); ctx.arc(cx - Math.sin(t * 1.1) * 30, 108, 7, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.arc(cx + Math.sin(t * 1.3) * 30, 212, 8, 0, 6.2832); ctx.fill();
    TT.ball = sv.ball;
    rect(16, 240, W - 32, 62, '#f4f8ff'); rect(16, 240, W - 32, 2, '#ffffff'); drawTextCenter('FIRST TO 5', W / 2, 248, '#0a2a5a', 2); drawTextCenter('YOU  vs  CPU', W / 2, 268, '#2a6aff', 1); drawTextCenter('YEN ' + P_().money + '    PLAY  YEN ' + TTC.price, W / 2, 284, '#0a2a5a', 1);
  }
  const TT_DOM = {};
  function ttBuildDom() {
    if (TT_DOM.start) return;
    const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); TT_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('tt-start', 'PLAY　¥' + TTC.price, 'td-go', ttBegin); mk('tt-retry', 'もういちど　¥' + TTC.price, 'td-go', ttBegin); mk('tt-out', '6Fにもどる', 'hb-sub', () => { TT.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('tt-tutok', 'OK', 'td-go', () => { TT.tutorial = false; P_().pingPongRally.tutorialSeen = true; writeSave(); beep(880, 0, 0.05, 0.04, 'square'); TT.t = 0; });
    const tut = document.createElement('div'); tut.className = 'prize-info st-say br-hint'; tut.innerHTML = 'ゆびを 左右に うごかして<br>ラケットを ボールに あわせよう！<br>あたれば じどうで 打ち返すよ。<br>ラケットの 当てた場所で 左右に 打ち分け！<br>ふわっとした 甘い球は SMASHの チャンス！'; screenEl.appendChild(tut); TT_DOM.tut = tut;
    for (const [k, lv, label] of [['lv1', 1, 'LV1'], ['lv2', 2, 'LV2'], ['lv3', 3, 'LV3'], ['lv4', 4, 'LV4'], ['lv5', 5, 'LV5'], ['lv0', 0, 'RND']]) {                                  // 開発用：CPUのレベルを えらんで たたかう（DEV_MODE のときだけ）
      const b = document.createElement('button'); b.className = 'cr-btn hb-btn hb-sub as-lv'; b.id = 'tt-' + k; b.type = 'button'; b.textContent = label; screenEl.appendChild(b); TT_DOM[k] = b; b.addEventListener('click', () => { ensureAudio(); TT.dev.level = lv; beep(880, 0, 0.04, 0.04, 'square'); });
    }
  }
  function ttUi() {
    ttBuildDom(); const ph = TT.phase; const show = (k, on) => TT_DOM[k].classList.toggle('is-show', !!on); const tutOn = !!TT.tutorial && ph === 'ready';
    show('start', ph === 'select'); show('retry', ph === 'result'); show('out', ph === 'result'); show('tut', tutOn); show('tutok', tutOn);
    crPlace(TT_DOM.start, { x: 24, y: 322, w: W - 48, h: 36 }); crPlace(TT_DOM.retry, { x: 20, y: 262, w: W - 40, h: 32 }); crPlace(TT_DOM.out, { x: 20, y: 298, w: W - 40, h: 26 }); crPlace(TT_DOM.tut, { x: 14, y: 110, w: W - 28, h: 90 }); crPlace(TT_DOM.tutok, { x: 40, y: 208, w: W - 80, h: 26 });
    const lvOn = DEV_MODE && (ph === 'select' || ph === 'result'); const lvY = ph === 'select' ? 304 : 330; const lw = Math.floor((W - 32 - 5 * 3) / 6);
    [['lv1', 1], ['lv2', 2], ['lv3', 3], ['lv4', 4], ['lv5', 5], ['lv0', 0]].forEach(([k, lv], i) => { show(k, lvOn); TT_DOM[k].classList.toggle('hb-go', TT.dev.level === lv); TT_DOM[k].classList.toggle('hb-sub', TT.dev.level !== lv); crPlace(TT_DOM[k], { x: 16 + i * (lw + 3), y: lvY, w: lw, h: 15 }); TT_DOM[k].style.fontSize = Math.max(8, parseFloat(TT_DOM[k].style.fontSize) * 0.7) + 'px'; });
  }
  function ttHide() { if (!TT_DOM.start) return; Object.keys(TT_DOM).forEach((k) => TT_DOM[k].classList.remove('is-show')); }
  function ttDraw() { const ph = TT.phase; if (ph === 'select') ttDrawSelect(); else if (ph === 'result') ttDrawResult(); else { ctx.save(); if (TT.shake > 0) ctx.translate(0, Math.round(Math.sin(TT.clock * 90) * 2 * (TT.shake / TTC.smash.shake))); ttScene(); ttHud(); if (ph === 'ready' && TT.tutorial) { ctx.globalAlpha = 0.5; rect(8, 100, W - 16, 140, '#04101e'); ctx.globalAlpha = 1; } ctx.restore(); } ttUi(); }
  function ttLeaveMid() {                                                                                                  // 席を立つ：試合のとちゅうでも おわれる。いまの点数で、勝ち・負け・引き分け
    const mid = ['ready', 'serve', 'rally', 'point'].includes(TT.phase); if (!mid) return false;
    showDialog({ title: '試合の途中です', lines: ['いまの点数で、試合を おわります。', { text: 'YOU ' + TT.score.you + ' - ' + TT.score.cpu + ' CPU' + (TT.score.you === TT.score.cpu ? '　→ 引き分け' : TT.score.you > TT.score.cpu ? '　→ あなたの勝ち' : '　→ CPUの勝ち'), cls: 'gold' }], buttons: [{ label: '席を立つ', primary: true, onClick: () => { if (!['ready', 'serve', 'rally', 'point'].includes(TT.phase)) return; TT.winner = TT.score.you === TT.score.cpu ? 'draw' : TT.score.you > TT.score.cpu ? 'you' : 'cpu'; TT.tutorial = false; TT.sw = null; ttEnd(); } }, { label: 'つづける' }] });
    return true;
  }
  function ttSim(level, botProf, maxSec) {                                                                                 // テスト用：画面なしで、1試合を はやく進める
    const sv = { phase: TT.phase, lvl: TT.dev.level, bot: TT.dev.bot, tut: TT.tutorial }; TT.dev.level = level; TT.dev.bot = botProf || TTC.botProfile; P_().pingPongRally.tutorialSeen = true; ttNewMatch(); TT.tutorial = false; ttStartServe(); let t = 0; const dt = 1 / 60;
    while (t < (maxSec || 300) && TT.phase !== 'end' && TT.phase !== 'result') { ttUpdate(dt); t += dt; }
    const out = { winner: TT.winner || (TT.score.you >= TT.score.cpu ? 'you' : 'cpu'), you: TT.score.you, cpu: TT.score.cpu, time: +TT.matchTime.toFixed(1) }; TT.dev.level = sv.lvl; TT.dev.bot = sv.bot; TT.phase = sv.phase; return out;
  }
  function openTtDev() {
    const again = (f) => () => { f(); setTimeout(openTtDev, 0); }; const P = TTC;
    showDialog({ title: 'PING PONG RALLY DEV', wide: true, lines: [{ text: 'CPU LEVEL ' + (TT.dev.level || 'RANDOM') + ' (現在 ' + TT.level + ') / YOU ' + TT.score.you + ' - ' + TT.score.cpu + ' CPU / 球速 ×' + TT.dev.speedScale + ' / ラケット はんぶん ' + P.racket.halfW, cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'LEVEL 1 固定', onClick: again(() => { TT.dev.level = 1; }) }, { label: 'LEVEL 2 固定', onClick: again(() => { TT.dev.level = 2; }) }, { label: 'LEVEL 3 固定', onClick: again(() => { TT.dev.level = 3; }) }, { label: 'LEVEL 4 固定', onClick: again(() => { TT.dev.level = 4; }) }, { label: 'LEVEL 5 固定', onClick: again(() => { TT.dev.level = 5; }) }, { label: 'RANDOM にもどす', onClick: again(() => { TT.dev.level = 0; }) },
      { label: 'CPU LEVEL・reaction 表示 ON/OFF', onClick: again(() => { TT.dev.show = !TT.dev.show; }) }, { label: 'CPU target・aim 表示 ON/OFF', onClick: again(() => { TT.dev.cpuTarget = !TT.dev.cpuTarget; }) }, { label: 'CPU mistake 強制 ON/OFF', onClick: again(() => { TT.dev.mistake = !TT.dev.mistake; }) },
      { label: 'ラケット位置・当たった場所・ラリー数 表示 ON/OFF', onClick: again(() => { TT.dev.swipeInfo = !TT.dev.swipeInfo; }) }, { label: 'ボール速度 表示 ON/OFF', onClick: again(() => { TT.dev.ballInfo = !TT.dev.ballInfo; }) }, { label: '軌道 表示 ON/OFF', onClick: again(() => { TT.dev.traj = !TT.dev.traj; }) },
      { label: '強制 SMASH（次の打球）', onClick: again(() => { TT.dev.forceSmash = true; }) }, { label: '強制 NET（次の打球）', onClick: again(() => { TT.dev.forceNet = true; }) }, { label: '強制 OUT（次の打球）', onClick: again(() => { TT.dev.forceOut = true; }) },
      { label: '強制 PLAYER 得点', onClick: () => { if (TT.ball && !TT.point) ttBallPoint('you', 'DEV'); } }, { label: '強制 CPU 得点', onClick: () => { if (TT.ball && !TT.point) ttBallPoint('cpu', 'DEV'); } }, { label: '4-4 にする', onClick: again(() => { TT.score = { you: 4, cpu: 4 }; }) },
      { label: '球速 ×1.2 / ×0.8', onClick: again(() => { TT.dev.speedScale = TT.dev.speedScale >= 1.2 ? 0.8 : +(TT.dev.speedScale + 0.2).toFixed(1); }) }, { label: 'ラケットの はば +2', onClick: again(() => { P.racket.halfW += 2; }) }, { label: 'ラケットの はば -2', onClick: again(() => { P.racket.halfW = Math.max(6, P.racket.halfW - 2); }) },
      { label: 'とじる', primary: true } ] });
  }
  mgRegister('pingPong', {
    reset() { TT.phase = 'select'; TT.sw = null; }, phase: () => TT.phase,
    enter() { ttBuildDom(); TT.phase = 'select'; TT.sel = 0; TT.sw = null; TT.tutorial = false; TT.tutorialShown = false; ttNewMatch(); TT.phase = 'select'; setMessage('', C.cyan); },
    update: ttUpdate, draw: ttDraw, hint: 'ゆびで ラケットを うごかして ボールに あわせよう！',
    pointer: ttPointer, pointerUp: ttPointerUp
  });
  GAME_TYPES.pingPong.pointerMove = ttPointerMove;
  GAME_TYPES.pingPong.canLeave = () => TT.phase === 'select' || TT.phase === 'result';
  GAME_TYPES.pingPong.beforeLeave = () => ttLeaveMid();
  GAME_TYPES.pingPong.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

