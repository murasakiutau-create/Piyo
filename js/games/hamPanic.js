'use strict';
// =====================================================================
  //  ハムちゃん危機一髪！（4台目のメダルゲーム）
  //   START(1枚) → 区間を走る → 突破したら「おりる」か「すすむ！」 → …… 失敗は CRASH!!（配当0）
  //   成功か失敗かは「すすむ！」を押した瞬間に決まります。走行の動きで決まるわけではありません
  // =====================================================================
  const HMC = CONFIG.hamPanic;
  const HMD = HMC.debug;
  const HM_PRESET = HMC.presets[HMC.preset] || HMC.presets.balanced;
  const HM_STAGES = HM_PRESET.payouts.map((payout, i) => ({ payout, rate: HM_PRESET.rates[i], duration: HMC.rideDuration[i] || 3, zone: HMC.zones[i] || HMC.zones[0] }));
  const HM_N = HM_STAGES.length;
  let HM_SCENE = { x: 12, y: 50, w: 156, h: 200 };
  let HM_MSG_BOX = { x: 14, y: 332, w: 152, h: 25 };
  let HM_BTN_START = { x: 24, y: 258, w: 132, h: 66 };
  let HM_BTN_STOP = { x: 24, y: 255, w: 132, h: 33 };      // おりる
  let HM_BTN_GO = { x: 24, y: 300, w: 132, h: 33 };        // すすむ！（おりるから十分はなす）

  // URLに ?hamdebug=final / crash / 5 を付けたときのデバッグ設定
  (function parseHamDebug() {
    try {
      const q = new URLSearchParams(location.search).get('hamdebug');
      if (!q) return;
      HMD.enabled = true;
      if (q === 'final') HMD.forceFinalClear = true;
      else if (q === 'crash') HMD.forceCrash = true;
      else if (/^[0-9]+$/.test(q)) { HMD.forceSuccess = true; HMD.forceCrashStage = parseInt(q, 10); }
    } catch (e) { /* 何もしない */ }
  })();

  const HM = {
    phase: 'idle',            // idle / ready / ride / checkpoint / crash / cashout / final
    t: 0, clock: 0,
    stage: 0,                 // いくつ区間を突破したか（0〜HM_N）
    attempt: 0,               // いま挑戦している区間（0始まり）
    outcome: true,            // その区間の結果（挑戦を始めた瞬間に決まる）
    revealed: false,
    ham: 'cha',
    gain: 0,
    scroll: 0, speed: 0, shake: 0, dark: 0, hop: 0,
    fx: [], banner: null, noMedalT: 0, rumbleT: 0, warned: false,
    crashShown: false
  };
  const hmFaceKey = () => HMC.faceFiles[HMC.faces[Math.min(HM.stage, HMC.faces.length - 1)]];
  const hmHamName = () => (HMC.hams.find((h) => h.id === HM.ham) || HMC.hams[0]).name;
  const hmPayout = (stageCount) => (stageCount > 0 ? HM_STAGES[stageCount - 1].payout * HMC.betCost : 0);

  // ---- 成功か失敗かを決める（「すすむ！」を押した瞬間に1回だけ） ----
  function hmRoll(attempt) {
    if (HMD.enabled) {
      if (HMD.forceCrashStage === attempt + 1) return false;
      if (HMD.forceCrash) return false;
      if (HMD.forceSuccess || HMD.forceFinalClear) return true;
    }
    return Math.random() < HM_STAGES[attempt].rate;
  }

  // ---------------------------------------------------------------------
  //  効果音（レトロな短いSE。CRASH は、ゲームらしい「ドカーン！」）
  // ---------------------------------------------------------------------
  const HMS = {
    start() { beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); },
    clack() { noise(0.03, 0.02); beep(180 + Math.random() * 40, 0, 0.03, 0.02, 'square'); },
    rise(f) { beep(f, 0, 0.1, 0.03, 'triangle'); },
    warn() { beep(880, 0, 0.09, 0.05, 'square'); beep(880, 0.14, 0.09, 0.05, 'square'); },
    safe() { [784, 988, 1319, 1568].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); },
    crash() { noise(0.55, 0.12); beep(160, 0, 0.5, 0.08, 'square', 40); beep(90, 0.05, 0.5, 0.07, 'sawtooth', 30); },
    coins(k, step) { for (let i = 0; i < k; i++) beep(rand(1800, 2700), i * step, 0.03, 0.03); },
    get(n) { [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); HMS.coins(Math.min(n, 24), 0.05); },
    fanfare() { [784, 784, 784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.1, 0.14, 0.05)); HMS.coins(36, 0.06); },
    nomedal() { beep(260, 0, 0.12, 0.05, 'square', 180); }
  };

  // ---------------------------------------------------------------------
  //  操作
  // ---------------------------------------------------------------------
  function hmStart() {
    if (HM.phase !== 'idle') return;
    if (hand < HMC.betCost) {
      HM.noMedalT = 1.8;
      setMessage('メダルがありません。席を立って貸出機へ行こう', C.pink);
      HMS.nomedal();
      return;
    }
    hand -= HMC.betCost;
    D_().played = true;
    D_().stats.ham.plays++;
    P_().records.ham.plays++;
    noteMedals();
    HM.ham = pick(HMC.hams).id;
    HM.stage = 0;
    HM.attempt = 0;
    HM.outcome = hmRoll(0);                 // 1つめの区間の結果は、STARTを押した瞬間に決まる
    HM.phase = 'ready';
    HM.t = 0;
    HM.fx = [];
    HM.dark = 0;
    HM.banner = { lines: [{ text: 'READY...', scale: 3, color: '#ffffff' }], t: 0, dur: HMC.readyTime };
    HMS.start();
    setMessage(hmHamName() + 'ちゃんがトロッコに乗り込んだ！出発進行！', C.yellow);
    writeSave();
  }

  function hmBeginRide() {
    HM.phase = 'ride';
    HM.t = 0;
    HM.revealed = false;
    HM.warned = false;
    HM.hop = 0;
    HM.banner = null;
    setMessage('ガタンゴトン……', C.text);
  }

  function hmGo() {                          // 「すすむ！」：ここで成功・失敗が決まる
    if (HM.phase !== 'checkpoint') return;
    HM.attempt = HM.stage;
    HM.outcome = hmRoll(HM.attempt);
    hmBeginRide();
    writeSave();
  }

  function hmCashOut() {                     // 「おりる」：いまの倍率を確定
    if (HM.phase !== 'checkpoint') return;
    hmPayoutNow('cashout');
  }

  function hmPayoutNow(kind) {
    const pay = recBonus('ham', hmPayout(HM.stage));
    HM.gain = pay;
    hand += pay;
    const st = D_().stats.ham;
    const rec = P_().records.ham;
    st.safes++; rec.safes++;
    st.bestPayout = Math.max(st.bestPayout, pay);
    rec.bestPayout = Math.max(rec.bestPayout, pay);
    if (kind === 'final') { rec.finalClears++; if (pay > rec.best50) rec.best50 = pay; }
    noteMedals();
    HM.phase = kind;
    HM.t = 0;
    HM.fx = [];
    const big = kind === 'final';
    for (let i = 0; i < (big ? 70 : 24); i++) {
      HM.fx.push({ type: 'confetti', x: HM_SCENE.x + Math.random() * HM_SCENE.w, y: HM_SCENE.y - Math.random() * 60, vx: rand(-0.3, 0.3), vy: rand(0.5, 1.4), color: ['#ff5060', '#ffd040', '#7dff8a', '#5ca8ff', '#ff8ef0'][i % 5], t: 0, dur: 5, wait: Math.random() * (big ? 2.2 : 0.8) });
    }
    for (let i = 0; i < Math.min(pay, big ? 44 : 22); i++) {
      HM.fx.push({ type: 'coin', x: HM_SCENE.x + 10 + Math.random() * (HM_SCENE.w - 20), y: HM_SCENE.y - 12 - Math.random() * 20, vy: rand(0.4, 1.2), wait: (i / Math.min(pay, 44)) * (big ? 2.4 : 1.2), t: 0, dur: 4 });
    }
    if (big) HMS.fanfare(); else HMS.get(pay);
    HM.banner = big
      ? { lines: [{ text: 'PERFECT!!', scale: 4, color: '#ffe070' }, { text: 'HAM-CHAN', scale: 2, color: '#ffffff' }, { text: 'SAFE RETURN!', scale: 2, color: '#7dff8a' }, { text: 'X' + HM_STAGES[HM_N - 1].payout + '  +' + pay + ' MEDALS', scale: 2, color: '#ff8ef0' }], t: 0, dur: 5.2 }
      : { lines: [{ text: 'SAFE RETURN!', scale: 3, color: '#7dff8a' }, { text: 'GET', scale: 2, color: '#ffffff' }, { text: '+' + pay + ' MEDALS', scale: 3, color: '#ffe070' }], t: 0, dur: 2.6 };
    setMessage(big ? '全部突破！' + hmHamName() + 'ちゃん無事に帰還！ +' + pay + '枚！' : 'わーい！' + hmHamName() + 'ちゃん無事に帰還！ +' + pay + '枚', C.goldLight);
    writeSave();
  }

  // 危険地点で結果が出る瞬間
  function hmReveal() {
    HM.revealed = true;
    const st = D_().stats.ham;
    const rec = P_().records.ham;
    if (HM.outcome) {
      HM.stage++;                            // 突破！ 表情もここで変わる
      HM.scrollAtReveal = HM.scroll;
      HM.hop = 1;
      HMS.safe();
      HM.banner = { lines: [{ text: 'SAFE!', scale: 4, color: '#7dff8a' }], t: 0, dur: 1.2 };
      if (HM.stage === HM_N - 1) rec.finalReached++;
    } else {
      st.crashes++; rec.crashes++;
      HM.phase = 'crash';
      HM.t = 0;
      HM.shake = 0.3;                          // ガタッ！（ほんの少し揺れて、すぐ暗くなる）
      HM.banner = null;
      HM.crashShown = false;
      HM.failShown = false;
      recBonus('ham', 0);
      setMessage('ガタッ……！', C.dim);
      noteMedals();
      writeSave();
    }
  }

  function hmArrive() {                      // 安全地点に到着
    if (HM.stage >= HM_N) { hmPayoutNow('final'); return; }
    HM.phase = 'checkpoint';
    HM.t = 0;
    HM.speed = 0;
    const m = HM_STAGES[HM.stage - 1].payout;
    const nxt = HM_STAGES[HM.stage].payout;
    const tease = HM.stage >= 7 ? hmHamName() + 'ちゃんは白目だ……。でも×' + nxt + 'が光っている……！'
      : HM.stage >= 6 ? hmHamName() + 'ちゃんは帰りたそう……'
      : HM.stage >= 4 ? hmHamName() + 'ちゃんは不安そう……'
      : hmHamName() + 'ちゃんご機嫌♪';
    setMessage('SAFE！今×' + m + '。 ' + tease, HM.stage >= 6 ? C.pink : C.yellow);
    writeSave();
  }

  function hmFinishRound() {                 // 1回のゲームが終わって、最初の画面へ
    HM.phase = 'idle';
    HM.t = 0;
    HM.stage = 0;
    HM.banner = null;
    HM.fx = HM.fx.filter((f) => f.type === 'coin');
    HM.dark = 0;
    if (hand < HMC.betCost) setMessage('メダルがない！席を立って貸出機へ行こう', C.pink);
    else setMessage('ハムちゃんをトロッコに乗せて出発！' + HMC.betCost + '枚', C.cyan);
    writeSave();
  }

  // ---------------------------------------------------------------------
  //  毎フレームの進行
  // ---------------------------------------------------------------------
  const hmThemeSpeed = (i) => 1 + i * 0.07 + (i === 2 ? 0.35 : 0);
  function hmUpdate(dt) {
    HM.clock += dt;
    HM.t += dt;
    if (HM.noMedalT > 0) HM.noMedalT -= dt;
    if (HM.shake > 0) HM.shake = Math.max(0, HM.shake - dt);
    if (HM.hop > 0) HM.hop = Math.max(0, HM.hop - dt * 2.2);
    if (HM.banner) { HM.banner.t += dt; if (HM.banner.t > HM.banner.dur) HM.banner = null; }
    for (let i = HM.fx.length - 1; i >= 0; i--) {
      const f = HM.fx[i];
      if (f.wait > 0) { f.wait -= dt; continue; }
      f.t += dt;
      if (f.type === 'confetti') { f.x += f.vx + Math.sin(f.t * 4 + f.y * 0.05) * 0.3; f.y += f.vy; }
      if (f.type === 'coin') { f.y += f.vy; f.vy += 0.09; }
      if (f.type === 'star') { f.x += f.vx; f.y += f.vy; f.vy += 0.05; }
      if (f.t >= f.dur || f.y > HM_SCENE.y + HM_SCENE.h + 12) HM.fx.splice(i, 1);
    }
    if (HM.fx.length > 220) HM.fx.splice(0, HM.fx.length - 220);

    const zi = Math.min(HM.attempt, HM_N - 1);
    if (HM.phase === 'ready') {
      HM.speed = 0;
      if (HM.t >= HMC.readyTime) hmBeginRide();
    } else if (HM.phase === 'ride') {
      const dur = HM_STAGES[zi].duration;
      const td = dur * HMC.dangerAt;
      const t = HM.t;
      const vmax = 130 * hmThemeSpeed(zi);
      // 走る速さ：出発で加速 → 一定 → 危険地点の少し手前で、ほんの少しだけ落ち着く（成功でも失敗でも同じ）
      let v = vmax * Math.min(1, t / 0.6);
      if (t > td - 0.5 && t < td) v *= 1 - 0.18 * Math.sin(((t - (td - 0.5)) / 0.5) * Math.PI);
      if (HM.revealed && HM.outcome) v = vmax * Math.max(0, Math.min(1, (dur - t) / Math.max(0.3, dur - td)) ) * 0.9;
      HM.speed = v;
      HM.scroll += v * dt;
      HM.rumbleT += dt;
      if (HM.rumbleT > 0.2 - Math.min(0.1, v / 1500)) { HM.rumbleT = 0; HMS.clack(); }
      if (t < 0.6 && Math.floor(t * 10) !== Math.floor((t - dt) * 10)) HMS.rise(300 + t * 500);
      if (!HM.warned && t >= td - 1.1) { HM.warned = true; HMS.warn(); setMessage('危険地点！祈れ……！', C.yellow); }
      if (!HM.revealed && t >= td) hmReveal();
      if (HM.phase === 'ride' && HM.revealed && t >= dur) hmArrive();
    } else if (HM.phase === 'crash') {
      HM.speed = 0;
      HM.dark = Math.min(1, HM.t / 0.55);      // 完全に暗転（ハムちゃんも、坑道も、見えなくなる）
      if (HM.t >= 0.75 && !HM.crashShown) {    // 真っ暗になってから、CRASH!!
        HM.crashShown = true;
        HMS.crash();
        HM.banner = { lines: [{ text: 'CRASH!!', scale: 5, color: '#ff6040' }], t: 0, dur: 1.5 };
        setMessage('CRASH!!', C.pink);
      }
      if (HM.t >= 2.4 && !HM.failShown) {
        HM.failShown = true;
        HM.banner = { lines: [{ text: 'FAILED...', scale: 3, color: '#a0b0ff' }, { text: '0 MEDAL', scale: 2, color: '#c0c8e0' }], t: 0, dur: 2.0 };
        setMessage('ハムちゃんは元気に戻って来るよ。次こそ！', C.dim);
      }
      if (HM.t >= 4.6) { HM.failShown = false; hmFinishRound(); }
    } else if (HM.phase === 'cashout') {
      HM.speed = 0;
      if (HM.t >= 3.2) hmFinishRound();
    } else if (HM.phase === 'final') {
      HM.speed = 0;
      if (HM.t >= 6.2) hmFinishRound();
    } else {
      HM.speed = 0;
      HM.scroll += 6 * dt;                    // 停止中も、ほんの少しだけ坑道が動く
    }
  }

  // ---------------------------------------------------------------------
  //  保存・再開・リセット
  // ---------------------------------------------------------------------
  function hmResetDay() {
    HM.phase = 'idle'; HM.t = 0; HM.stage = 0; HM.attempt = 0; HM.fx = []; HM.banner = null; HM.dark = 0; HM.shake = 0;
  }
  function hmSerialize() {
    const mid = HM.phase === 'ready' || HM.phase === 'ride' || HM.phase === 'checkpoint';
    return mid ? { phase: HM.phase === 'checkpoint' ? 'checkpoint' : 'ready', stage: HM.stage, attempt: HM.attempt, outcome: HM.outcome, ham: HM.ham } : { phase: 'idle' };
  }
  function hmRestore(d) {
    hmResetDay();
    if (!d || d.phase === 'idle' || typeof d.stage !== 'number' || !HMC.hams.some((h) => h.id === d.ham)) return;
    HM.ham = d.ham;
    HM.stage = Math.min(d.stage, HM_N - 1);
    HM.attempt = d.attempt || 0;
    HM.outcome = d.outcome !== false;
    if (d.phase === 'checkpoint') HM.phase = 'checkpoint';
    else { HM.phase = 'ready'; HM.stage = Math.min(d.stage, HM_N - 1); }      // 出発の途中：同じ結果で、最初から見なおす（メダルは減らない）
  }
  const hmCanLeave = () => HM.phase === 'idle';
  function hmEnter() {
    if (HM.phase === 'checkpoint') setMessage('ハムちゃんは待っている……。降りる？進む？', C.yellow);
    else if (hand < HMC.betCost) setMessage('メダルがないよ。席を立って貸出機へ行こう', C.pink);
    else setMessage('ハムちゃんをトロッコに乗せて出発！' + HMC.betCost + '枚', C.cyan);
  }

  // ---------------------------------------------------------------------
  //  ハムちゃんの絵（assets/ham-chan/<ham>_<表情>.webp）
  //  24枚とも同じ範囲・同じ大きさなので、表情を切り替えても、トロッコの位置はズレません
  // ---------------------------------------------------------------------
  const HM_IMG = {};
  let HM_MINI = null;
  let HM_CART_X = 90;           // トロッコの中心
  const HM_CART_BOTTOM = 232;     // 絵の下（車輪）の高さ
  let HM_FRONT = 146;           // トロッコの前の端
  // ワイド：シーン・ボタン・トロッコの位置を、画面の幅（W）に合わせる（移動は速度から計算しているので、時間は変わりません。ハムちゃん・トロッコの大きさも そのまま）
  function hamRelayout() {
    const dx = W - 180; const hx = Math.round(dx / 2);
    HM_SCENE = { x: 12, y: 50, w: 156 + dx, h: 200 };
    HM_MSG_BOX = { x: 14, y: 332, w: 152 + dx, h: 25 };
    HM_BTN_START = { x: 24, y: 258, w: 132 + dx, h: 66 };
    HM_BTN_STOP = { x: 24, y: 255, w: 132 + dx, h: 33 };
    HM_BTN_GO = { x: 24, y: 300, w: 132 + dx, h: 33 };
    HM_CART_X = 90 + hx; HM_FRONT = 146 + hx;
  }
  (function loadHamImages() {
    const W = HMC.displaySize;
    for (const h of HMC.hams) {
      HM_IMG[h.id] = {};
      for (const key of Object.keys(HMC.faceFiles)) {
        const file = HMC.faceFiles[key];
        const img = new Image();
        img.onload = () => {
          const base = makeCanvas(img.naturalWidth, img.naturalHeight);
          base.getContext('2d').drawImage(img, 0, 0);
          const H = Math.round((W * base.height) / base.width);
          HM_IMG[h.id][file] = resizeSmooth(base, W, H);                    // 縦横比は変えません
          if (h.id === 'cha' && file === 'zone0') HM_MINI = resizeSmooth(base, 22, Math.round((22 * base.height) / base.width));
        };
        img.onerror = () => { /* 画像が無いときは、仮の絵で動きます */ };
        img.src = 'assets/ham-chan/' + h.id + '_' + file + '.webp';
      }
    }
  })();

  function hmDrawHam(file, dy) {
    const W = HMC.displaySize;
    const im = HM_IMG[HM.ham] && HM_IMG[HM.ham][file];
    if (im) {
      ctx.drawImage(im, Math.round(HM_CART_X - im.width / 2), Math.round(HM_CART_BOTTOM - im.height + dy));
      return;
    }
    const y = HM_CART_BOTTOM - W + dy;                                       // 仮の絵（画像がまだ読み込めていないとき）
    rect(HM_CART_X - W / 2 + 6, y + W * 0.5, W - 12, W * 0.45, '#5a5a6a');
    rect(HM_CART_X - W * 0.28, y + W * 0.15, W * 0.56, W * 0.4, '#e8a050');
    rect(HM_CART_X - W / 2 + 14, y + W * 0.9, 16, 10, '#2a2a30'); rect(HM_CART_X + W / 2 - 30, y + W * 0.9, 16, 10, '#2a2a30');
  }

  // ---------------------------------------------------------------------
  //  坑道の見た目（背景のスクロール・障害物・画面ゆれ）
  // ---------------------------------------------------------------------
  const HM_LOOK = [
    { wall: '#4a3a30', rock: '#5c4a3c', dark: 0,    shake: 0.3 },
    { wall: '#483840', rock: '#5a4650', dark: 0,    shake: 1.6 },     // ガタガタ
    { wall: '#3c3c52', rock: '#4c4c68', dark: 0,    shake: 0.6 },     // 下り坂（速い）
    { wall: '#2e3040', rock: '#3c4054', dark: 0.05, shake: 0.5, bridge: true },
    { wall: '#2a2434', rock: '#38304a', dark: 0.5,  shake: 0.5 },     // 暗いトンネル
    { wall: '#443230', rock: '#5a4440', dark: 0.1,  shake: 1.0, rockfall: true },
    { wall: '#2c2438', rock: '#3c3250', dark: 0.25, shake: 1.2, bridge: true, broken: true },
    { wall: '#4e2020', rock: '#6a2c2c', dark: 0.15, shake: 1.4, lava: true }
  ];
  const hmMod = (a, n) => ((a % n) + n) % n;

  function hmVisZone() {
    if (HM.phase === 'idle' || HM.phase === 'ready') return 0;
    if (HM.phase === 'checkpoint') return Math.min(HM.stage, HM_N - 1);
    if (HM.phase === 'cashout' || HM.phase === 'final') return Math.max(0, Math.min(HM.stage - 1, HM_N - 1));
    return Math.min(HM.attempt, HM_N - 1);
  }

  // 危険地点の位置：成功でも失敗でも、危険地点に着くまでは同じ動き
  function hmV(t, zi) {
    const dur = HM_STAGES[zi].duration;
    const td = dur * HMC.dangerAt;
    const vmax = 130 * hmThemeSpeed(zi);
    let v = vmax * Math.min(1, t / 0.6);
    if (t > td - 0.5 && t < td) v *= 1 - 0.18 * Math.sin(((t - (td - 0.5)) / 0.5) * Math.PI);
    return v;
  }
  function hmHazardX(zi) {
    if (HM.phase === 'ride') {
      const td = HM_STAGES[zi].duration * HMC.dangerAt;
      if (!HM.revealed) {
        let d = 0;
        const steps = 14;
        const dtS = Math.max(0, td - HM.t) / steps;
        for (let k = 0; k < steps; k++) d += hmV(HM.t + (k + 0.5) * dtS, zi) * dtS;
        return HM_FRONT + d;
      }
      return HM_FRONT - (HM.scroll - (HM.scrollAtReveal || HM.scroll));
    }
    if (HM.phase === 'crash') return HM_FRONT;
    return 9999;
  }
  function drawHazard(type, x, y) {
    if (type === 'rock') {
      rect(x - 10, y - 12, 20, 12, '#6a6a78'); rect(x - 7, y - 16, 14, 5, '#8a8a98'); rect(x - 10, y - 4, 20, 4, '#4a4a56'); rect(x - 5, y - 14, 4, 2, '#c0c0cc');
    } else if (type === 'boulder') {
      rect(x - 9, y - 22, 18, 22, '#6a6a78'); rect(x - 12, y - 18, 24, 14, '#6a6a78'); rect(x - 6, y - 25, 12, 4, '#8a8a98'); rect(x - 6, y - 20, 5, 4, '#c0c0cc'); rect(x - 12, y - 6, 24, 6, '#4a4a56');
    } else if (type === 'wall') {
      rect(x - 8, y - 24, 16, 24, '#8a6038'); for (let k = 0; k < 4; k++) rect(x - 8, y - 24 + k * 6, 16, 3, k % 2 ? '#ffd040' : '#c8442a'); rect(x - 10, y - 2, 20, 2, '#3a2418');
    } else {                                                   // gap：レースの切れ目
      rect(x - 14, y - 2, 28, 12, '#050408'); rect(x - 16, y - 2, 4, 3, '#6a4a2a'); rect(x + 12, y - 2, 4, 3, '#6a4a2a'); rect(x - 5, y - 5, 10, 3, '#6a4a2a');
    }
  }

  function drawMine(zi) {
    const S = HM_SCENE;
    const look = HM_LOOK[zi];
    const T = HM.clock;
    const sc = HM.scroll;
    const rail = 229;
    rect(S.x, S.y, S.w, S.h, look.wall);
    for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.09 * (5 - i); rect(S.x, S.y + i * 34, S.w, 34, '#000000'); }
    ctx.globalAlpha = 1;
    for (let k = 0; k < 16; k++) {                                              // 岩のしみ（ゆっくり流れる）
      rect(S.x + hmMod(k * 47 - sc * 0.45, S.w + 24) - 12, S.y + 14 + ((k * 29) % 168), 5 + (k % 3) * 3, 3, look.rock);
    }
    for (let k = -1; k < 4; k++) {                                              // 木の支柱とランタン
      const bx = S.x + hmMod(k * 56 - sc * 0.7, 224) - 30;
      rect(bx, S.y, 7, 180, '#7a5530'); rect(bx + 1, S.y, 2, 180, '#9a7040');
      rect(bx - 16, S.y + 6, 39, 6, '#6a4528'); rect(bx - 16, S.y + 6, 39, 2, '#8a6038');
      rect(bx + 3, S.y + 16, 1, 8, '#2a2018'); rect(bx, S.y + 24, 7, 7, '#ffd040'); rect(bx + 1, S.y + 25, 5, 5, '#fff3a0');
      ctx.globalAlpha = 0.1 + 0.04 * Math.sin(T * 2 + k);
      rect(bx - 6, S.y + 18, 19, 19, '#ffd040');
      ctx.globalAlpha = 1;
    }
    // 地面・レール・まくら木
    rect(S.x, rail + 7, S.w, 250 - rail - 7, '#2a1e18');
    for (let k = 0; k < 22; k++) rect(S.x + hmMod(k * 9 - sc, S.w + 8), rail + 9 + ((k * 5) % 12), 2, 1, '#4a3a2e');
    if (look.bridge) {                                                          // 橋の下は、まっくら
      rect(S.x, rail + 6, S.w, 250 - rail - 6, '#07070c');
      for (let k = 0; k < 14; k++) {
        if (look.broken && (k * 7) % 5 === 0) continue;
        rect(S.x + hmMod(k * 14 - sc, S.w + 14) - 4, rail + 7, 3, 14, '#5a3c20');
      }
    }
    if (look.lava) {
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(T * 1.6);
      rect(S.x, 241, S.w, 9, '#ff5020');
      ctx.globalAlpha = 1;
    }
    rect(S.x, rail, S.w, 2, '#d0d0e0'); rect(S.x, rail + 2, S.w, 1, '#7a7a8c');
    for (let k = 0; k < 14; k++) {
      const tx = S.x + hmMod(k * 14 - sc, S.w + 14) - 6;
      const bump = look.shake > 1 ? ((k * 7) % 3) - 1 : 0;                       // ガタガタのレール
      if (look.broken && (k * 7) % 5 === 0) continue;
      rect(tx, rail + 3 + bump, 9, 4, '#6a4528'); rect(tx, rail + 3 + bump, 9, 1, '#8a6038');
    }
    if (look.rockfall) {                                                         // 落石
      for (let k = 0; k < 4; k++) {
        const rx = S.x + hmMod(k * 61 + T * 22, S.w);
        const ry = S.y + hmMod(T * 90 + k * 53, 180);
        rect(rx, ry, 5, 5, '#7a7a88'); rect(rx, ry, 5, 1, '#a0a0b0');
      }
    }
  }

  // ---------------------------------------------------------------------
  //  描画
  // ---------------------------------------------------------------------
  function drawHamFrame() {
    rect(0, 0, W, H, '#140a04');
    rect(1, 1, W - 2, H - 2, '#6a4318');
    rect(8, 8, W - 16, H - 16, '#07040a');
    const chase = Math.floor(HM.clock * 2);
    bulbs.forEach(([x, y], i) => rect(x, y, 2, 2, (i + chase) % 3 === 0 ? (i % 2 ? '#ffb040' : '#ffe9a0') : '#5a3a18'));
  }

  function drawHamHud() {
    const dx = W - 180; const hx = Math.round(dx / 2);
    rect(24, 11, 132 + dx, 22, '#1a0e06');
    rect(24, 11, 132 + dx, 1, '#ffb040'); rect(24, 32, 132 + dx, 1, '#ffb040');
    rect(24, 11, 1, 22, '#ffb040'); rect(155 + dx, 11, 1, 22, '#ffb040');
    ctx.globalAlpha = 0.1 + 0.05 * Math.sin(HM.clock * 1.5);
    rect(26, 13, 128 + dx, 18, '#ff9030');
    ctx.globalAlpha = 1;
    drawTextCenter('HAM-CHAN PANIC!', 90 + hx, 17, '#ffe9b0', 2, '#6a3a08');
    rect(12, 36, 74 + hx, 11, '#1a0e06');
    rect(94 + hx, 36, 74 + dx - hx, 11, '#1a0e06');
    drawText('MEDAL', 15, 39, C.dim, 1);
    drawText(String(hand), 83 + hx - textWidth(String(hand), 1), 39, C.goldLight, 1);
    drawText('STEP', 97 + hx, 39, C.dim, 1);
    const zn = HM.phase === 'idle' ? '-' : String(Math.min(HM.phase === 'checkpoint' ? HM.stage + 1 : HM.attempt + 1, HM_N)) + '/' + HM_N;
    drawText(zn, 165 + dx - textWidth(zn, 1), 39, '#ffd090', 1);
  }

  function drawHamLadder(pulse) {
    const S = HM_SCENE;
    HM_STAGES.forEach((st, i) => {
      const x = S.x + 2 + i * 19.3 * (S.w / 156);
      const cleared = i < HM.stage;
      const next = i === HM.stage && HM.phase !== 'idle';
      rect(x, S.y + 3, 18, 10, cleared ? '#ffd040' : next ? '#c8442a' : '#1a1218');
      if (next) { ctx.globalAlpha = 0.25 + 0.2 * pulse; rect(x - 1, S.y + 2, 20, 12, '#ff8040'); ctx.globalAlpha = 1; }
      rect(x, S.y + 3, 18, 1, cleared ? '#fff3a0' : '#3a3038');
      drawTextCenter('X' + st.payout, x + 9.5, S.y + 6, cleared ? '#3a2000' : next ? '#ffffff' : '#7a6a74', 1);
    });
  }

  function hmCrashBurst(t) {                      // 画面いっぱいの「ドカーン！」（点滅せず、ぐっと大きくなる）
    const k = Math.min(1, t / 0.28);
    const cx = 90 + Math.round((W - 180) / 2);
    const cy = HM_SCENE.y + 92;
    const R = 20 + 70 * k;
    const fade = Math.max(0, 1 - Math.max(0, t - 1.0) / 0.5);
    ctx.globalAlpha = fade;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const len = R * (a % 2 ? 0.62 : 1);
      for (let r = 6; r < len; r += 2) {
        const col = r < len * 0.5 ? '#fff3a0' : '#ff9a30';
        rect(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.9, 3, 3, col);
      }
    }
    rect(cx - 10 * k, cy - 8 * k, 20 * k, 16 * k, '#ffffff');
    ctx.globalAlpha = 1;
  }

  function drawHamScene() {
    const S = HM_SCENE;
    const zi = hmVisZone();
    const look = HM_LOOK[zi];
    const T = HM.clock;
    ctx.save();
    ctx.beginPath();
    ctx.rect(S.x, S.y, S.w, S.h);
    ctx.clip();
    if (HM.shake > 0) {
      const a = HM.shake / 0.45;
      ctx.translate(Math.round(Math.sin(T * 70) * 3 * a), Math.round(Math.cos(T * 55) * 2 * a));
    } else if (HM.phase === 'ride') {
      ctx.translate(0, Math.round(Math.sin(T * 30) * 0.5 * look.shake));
    }
    drawMine(zi);

    // 危険地点（予告の「！」つき）
    if (HM.phase === 'ride' || HM.phase === 'crash') {
      const hx = hmHazardX(zi);
      if (hx < S.x + S.w + 30) {
        drawHazard(HM_STAGES[zi].zone.hazard, hx, 229);
        if (HM.phase === 'ride' && !HM.revealed && hx > HM_FRONT + 4) {
          const by = 196 + Math.round(Math.sin(T * 6) * 2);
          rect(hx - 6, by, 12, 12, '#ffd040'); rect(hx - 6, by, 12, 2, '#fff3a0');
          drawTextCenter('!', hx + 0.5, by + 3, '#6a1a08', 1);
        }
      }
    }

    // ハムちゃんとトロッコ
    const showHam = !(HM.phase === 'crash' && HM.dark >= 1);
    if (showHam) {
      let dy = 0;
      if (HM.phase === 'ride') dy = Math.round(Math.sin(T * 14) * (0.4 + look.shake * 0.5)) - (HM.hop > 0 ? Math.round(Math.sin(Math.PI * (1 - HM.hop)) * 5) : 0);
      else dy = Math.round(Math.sin(T * 2.4) * 0.8);
      const happy = HM.phase === 'cashout' || HM.phase === 'final';
      const file = happy ? HMC.faceFiles.ham_happy : hmFaceKey();
      if (happy) dy -= Math.round(Math.abs(Math.sin(HM.t * 7)) * 5);              // わーい！ と跳ねる
      hmDrawHam(file, dy);
      ctx.globalAlpha = 1;
    }
    const dk = look.dark;
    if (dk > 0) { ctx.globalAlpha = dk; rect(S.x, S.y, S.w, S.h, '#000008'); ctx.globalAlpha = 1; }
    if (look.lava) { ctx.globalAlpha = 0.1 + 0.05 * Math.sin(T * 1.6); rect(S.x, S.y, S.w, S.h, '#ff4020'); ctx.globalAlpha = 1; }

    // 上の表示：倍率のはしご、NOW / NEXT
    drawHamLadder(0.5 + 0.5 * Math.sin(T * 3));
    const showNums = HM.phase === 'idle' || HM.phase === 'ready' || HM.phase === 'ride' || HM.phase === 'checkpoint';
    if (showNums) {
      const now = HM.stage > 0 ? 'X' + HM_STAGES[HM.stage - 1].payout : 'X1';
      const nxt = 'X' + HM_STAGES[Math.min(HM.stage, HM_N - 1)].payout;
      rect(S.x + 3, S.y + 18, 60, 34, 'rgba(10,6,12,0.7)');
      drawText('NOW', S.x + 7, S.y + 21, '#9fe8ff', 1);
      drawText(now, S.x + 7, S.y + 31, '#ffe070', 3, '#4a3008');
      rect(S.x + S.w - 63, S.y + 18, 60, 34, 'rgba(10,6,12,0.7)');
      drawText('NEXT', S.x + S.w - 59, S.y + 21, '#ff9a80', 1);
      const glow = 0.5 + 0.5 * Math.sin(T * 3);
      if (HM.phase === 'checkpoint') { ctx.globalAlpha = 0.18 + 0.14 * glow; rect(S.x + S.w - 63, S.y + 18, 60, 34, '#ff6030'); ctx.globalAlpha = 1; }
      drawText(nxt, S.x + S.w - 59, S.y + 31, '#ff8a50', 3, '#4a1408');
    }
    // 走行中のゾーン名
    if (HM.phase === 'ride') drawTextCenter(HM_STAGES[zi].zone.name, 90 + Math.round((W - 180) / 2), S.y + 66, '#ffd9a0', 1, '#1a0e06');

    // メダル・紙吹雪・星
    for (const f of HM.fx) {
      if (f.wait > 0) continue;
      if (f.type === 'confetti') { rect(f.x, f.y, 3, 3, f.color); rect(f.x + 1, f.y + 3, 1, 2, f.color); }
      else if (f.type === 'coin') drawCoinSprite(coinFull, f.x, f.y);
      else if (f.type === 'star') { ctx.globalAlpha = Math.max(0, 1 - f.t / f.dur); drawStar(px(f.x), px(f.y), f.color); ctx.globalAlpha = 1; }
    }
    if (HM.dark > 0) { ctx.globalAlpha = HM.dark; rect(S.x, S.y, S.w, S.h, '#000000'); ctx.globalAlpha = 1; }   // 画面暗転
    if (HM.phase === 'crash' && HM.crashShown && HM.t < 2.4) hmCrashBurst(HM.t - 0.75);                       // 暗闇の中で「ドカーン！」

    // 大きな文字
    const b = HM.banner;
    if (b) {
      const a = Math.min(1, b.t / 0.15, (b.dur - b.t) / 0.3);
      const heights = b.lines.map((l) => 5 * l.scale);
      const total = heights.reduce((x, y) => x + y, 0) + (b.lines.length - 1) * 4;
      const y0 = b.lines.length > 2 ? S.y + 8 : S.y + 70 - total / 2;
      ctx.globalAlpha = Math.max(0, a) * (HM.phase === 'crash' ? 0 : 0.78);
      rect(S.x, y0 - 5, S.w, total + 10, '#05030a');
      ctx.globalAlpha = Math.max(0, a);
      let yy = y0;
      b.lines.forEach((l, k) => { drawTextCenter(l.text, 90 + Math.round((W - 180) / 2), yy, l.color, l.scale, '#1a0e06'); yy += heights[k] + 4; });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- 下のボタン（HTML）：日本語の文字をきれいに出すため、画面の上に重ねています ----
  const hmBtnStart = document.getElementById('ham-start');
  const hmBtnStop = document.getElementById('ham-stop');
  const hmBtnGo = document.getElementById('ham-go');
  const hmBtnLast = {};
  function hmSetBtn(el, key, main, sub, extra) {
    const sig = main + '|' + sub + '|' + extra;
    if (hmBtnLast[key] === sig) return;
    hmBtnLast[key] = sig;
    el.querySelector('.ham-main').textContent = main;
    el.querySelector('.ham-sub').textContent = sub;
    el.classList.toggle('is-off', extra === 'off');
  }
  function hmPlaceBtn(el, box) {
    const r = canvas.getBoundingClientRect();
    const host = screenEl.getBoundingClientRect();
    const sc = (r.width - 8) / CW;
    el.style.left = (r.left - host.left + 4 + (box.x + wideOff()) * sc) + 'px';
    el.style.top = (r.top - host.top + 4 + box.y * sc) + 'px';
    el.style.width = box.w * sc + 'px';
    el.style.height = box.h * sc + 'px';
    el.style.fontSize = Math.max(11, 7.6 * sc) + 'px';
  }
  function hmLayoutButtons() {
    if (!hmBtnStart) return;
    hmPlaceBtn(hmBtnStart, HM_BTN_START);
    hmPlaceBtn(hmBtnStop, HM_BTN_STOP);
    hmPlaceBtn(hmBtnGo, HM_BTN_GO);
  }
  function hmHideButtons() {
    if (!hmBtnStart) return;
    for (const el of [hmBtnStart, hmBtnStop, hmBtnGo]) el.classList.remove('is-show');
  }
  function hmUpdateButtons() {
    if (!hmBtnStart) return;
    const idle = HM.phase === 'idle';
    const cp = HM.phase === 'checkpoint';
    hmBtnStart.classList.toggle('is-show', idle);
    hmBtnStop.classList.toggle('is-show', cp);
    hmBtnGo.classList.toggle('is-show', cp);
    if (idle) hmSetBtn(hmBtnStart, 'start', 'START', HM.noMedalT > 0 || hand < HMC.betCost ? 'NO MEDAL' : HMC.betCost + ' MEDAL', hand < HMC.betCost ? 'off' : '');
    if (cp) {
      hmSetBtn(hmBtnStop, 'stop', '降りる', '+' + hmPayout(HM.stage) + ' MEDALS', '');
      hmSetBtn(hmBtnGo, 'go', '進む！', 'NEXT ×' + HM_STAGES[Math.min(HM.stage, HM_N - 1)].payout, '');
    }
  }
  if (hmBtnStart) {
    hmBtnStart.addEventListener('click', () => { ensureAudio(); hmStart(); });
    hmBtnStop.addEventListener('click', () => { ensureAudio(); hmCashOut(); });
    hmBtnGo.addEventListener('click', () => { ensureAudio(); hmGo(); });
  }

  function drawHamScreen() {
    drawHamFrame();
    drawHamHud();
    drawHamScene();
    // ボタンの台（ボタンそのものは、画面の上に重ねた HTML のボタン）
    const dx = W - 180;
    rect(12, 252, 156 + dx, 80, '#1a0e06');
    rect(12, 252, 156 + dx, 2, '#6a4318');
    if (HM.phase !== 'idle' && HM.phase !== 'checkpoint') {
      ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(HM.clock * 4));
      const txt = HM.phase === 'crash' ? '...' : HM.phase === 'cashout' || HM.phase === 'final' ? 'SAFE!' : HM.phase === 'ready' ? 'READY' : 'HOLD ON!';
      drawTextCenter(txt, 90 + Math.round(dx / 2), 286, '#ffd090', 2, '#4a2808');
      ctx.globalAlpha = 1;
    }
    hmUpdateButtons();
    const st = D_().stats.ham;
    rect(12, 360, 156 + dx, 12, '#140a04');
    drawText('PLAY ' + st.plays, 16, 363, '#e8f0ff', 1);
    drawText('SAFE ' + st.safes, 52 + Math.round(dx * 0.2), 363, '#7dff8a', 1);
    drawText('CRASH ' + st.crashes, 84 + Math.round(dx * 0.45), 363, '#ff8a70', 1);
    drawText('BEST +' + st.bestPayout, 124 + Math.round(dx * 0.75), 363, '#ffe070', 1);
  }

