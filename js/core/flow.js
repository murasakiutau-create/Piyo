'use strict';
  // ---------------------------------------------------------------------
  //  今日遊んだゲーム
  // ---------------------------------------------------------------------
  const TODAY_DEF = [
    { icon: '🐥', name: 'PIYO ADVENTURE', on: (s) => s.piyo.coins > 0, info: (s) => 'すごろく' + s.piyo.maxLv + 'マス', best: () => 0 },
    { icon: '🟢', name: 'SLIME HUNT', on: (s) => s.slime.plays > 0, info: (s) => 'PLAY ' + s.slime.plays, best: (s) => s.slime.bestWin },
    { icon: '🦆', name: 'DUCK RACE', on: (s) => s.duck.races > 0, info: (s) => 'RACE ' + s.duck.races, best: (s) => s.duck.bestPayout },
    { icon: '🐹', name: 'HAM-CHAN PANIC!', on: (s) => s.ham.plays > 0, info: (s) => 'PLAY ' + s.ham.plays, best: (s) => s.ham.bestPayout },
    { icon: '🎰', name: 'LUCKY SLOT', on: (s) => s.slot.plays > 0, info: (s) => 'PLAY ' + s.slot.plays, best: (s) => s.slot.bestPayout },
    { icon: '🚀', name: 'STAR FLIGHT', on: (s) => s.mg.star.plays > 0, info: (s) => 'PLAY ' + s.mg.star.plays, best: (s) => s.mg.star.bestWin },
    { icon: '🐟', name: 'FISH CATCH', on: (s) => s.mg.fish.plays > 0, info: (s) => 'PLAY ' + s.mg.fish.plays, best: (s) => s.mg.fish.bestWin },
    { icon: '🎱', name: 'BIG BINGO', on: (s) => s.mg.bingo.plays > 0, info: (s) => 'PLAY ' + s.mg.bingo.plays, best: (s) => s.mg.bingo.bestWin },
    { icon: '🏴‍☠️', name: 'PIRATE TREASURE', on: (s) => s.mg.pirate.plays > 0, info: (s) => 'PLAY ' + s.mg.pirate.plays, best: (s) => s.mg.pirate.bestWin },
    { icon: '🚂', name: 'STOP! TRAIN', on: (s) => s.mg.train.plays > 0, info: (s) => 'PLAY ' + s.mg.train.plays, best: (s) => s.mg.train.bestWin },
    { icon: '🎈', name: 'BALLOON SHOOT', on: (s) => s.mg.balloon.plays > 0, info: (s) => 'PLAY ' + s.mg.balloon.plays, best: (s) => s.mg.balloon.bestWin },
    { icon: '🌟', name: 'SUPER COSMO', on: (s) => s.mg.cosmo.plays > 0, info: (s) => 'PLAY ' + s.mg.cosmo.plays, best: (s) => s.mg.cosmo.bestWin }
  ];
  function todaySummary() {
    const s = D_().stats;
    const played = TODAY_DEF.filter((g) => g.on(s));
    let best = null;
    for (const g of played) { const b = g.best(s); if (b > 0 && (!best || b > best.b)) best = { name: g.name, b }; }
    return { played, best, s };
  }

  // ---------------------------------------------------------------------
  //  閉店・開店の演出
  //   閉店：筐体音が遠くなる → 今日遊んだ台 → 本日の結果 → 灯りが消える → シャッター → CLOSED → DAY更新
  //   開店：朝 → シャッターが開く → 筐体が起動する → 今日のおこづかい → OPEN!
  // ---------------------------------------------------------------------
  let seq = null;
  const seqTextEl = document.createElement('div');
  seqTextEl.className = 'seq-text';
  screenEl.appendChild(seqTextEl);
  function seqText(html, top) {
    seqTextEl.innerHTML = html || '';
    seqTextEl.classList.toggle('is-show', !!html);
    seqTextEl.classList.toggle('is-top', !!top);
  }
  const OPEN_STEPS = [1.6, 1.8, 1.8, 2.4, 1.3];

  function startClosing(tired) {
    closeDialog();
    scene = 'seq';
    currentMachine = null;
    seq = { kind: 'close', step: 0, t: 0, speed: 1, tired, noSkip: true, tick: 0, dayDone: false };
    updateSceneUi();
  }
  function startOpening() {
    closeDialog();
    scene = 'seq';
    currentMachine = null;
    const p = P_();
    seq = { kind: 'open', step: 0, t: 0, speed: 1, noSkip: p.day === 1, tick: 0, day: p.day, prev: Math.max(0, p.money - ARC.dailyAllowance), total: p.money, chirp: 0 };
    centerFloor = 0;
    updateSceneUi();
  }
  function endSeq() {
    seq = null;
    seqText('');
    scene = 'b1';                                                  // 新しいDAY：1F（PRIZE CORNER）から
    centerFloor = 0;
    updateSceneUi();
    toast('DAY ' + P_().day + '　OPEN!');
    writeSave();
  }
  const seqCanSkip = () => !!seq && !seq.frozen && ((seq.kind === 'open' && !seq.noSkip) || (seq.kind === 'close' && seq.step >= 3));       // 閉店は、「へいてん」を押してからの演出（シャッター・DAYの切り替え）。DAY 1 の最初の開店は、スキップなし
  const seqSkipRect = () => ({ x: 118 + (W - 180), y: 46, w: 54, h: 26 });
  function seqTap(p) {
    if (!seqCanSkip()) return;
    if (inRect(p, seqSkipRect())) skipSeq();                                                       // SKIP だけ（画面をタップしても、早送りは しない）
  }
  let skipBusy = false;
  function skipSeq() {                                                                              // 一瞬 暗転 → いまの演出（閉店 または 開店）だけ、途中で打ち切る → 明転
    if (!seqCanSkip() || skipBusy) return; skipBusy = true; seq.frozen = true;
    let fade = document.getElementById('skip-fade'); if (!fade) { fade = document.createElement('div'); fade.id = 'skip-fade'; screenEl.appendChild(fade); }
    void fade.offsetWidth; fade.classList.add('is-on'); beep(330, 0, 0.08, 0.03, 'triangle');
    setTimeout(() => {
      if (seq && seq.kind === 'close') {                                                            // 閉店の演出だけ、打ち切る → つづけて、次の日の（開店の）演出へ
        if (!seq.dayDone) { seq.dayDone = true; seq.dayFrom = P_().day; advanceDay(); }                  // 日をすすめて（おこづかい）から
        startOpening();
      } else endSeq();                                                                                // 開店の演出をスキップしたときは、開店の演出だけ打ち切って、1F
      setTimeout(() => { fade.classList.remove('is-on'); skipBusy = false; }, 140);
    }, 260);
  }

  function showTodayGames() {
    const sm = todaySummary();
    const lines = [{ text: '今日遊んだゲーム', cls: 'big' }];
    if (!sm.played.length) lines.push({ text: '今日はまだどの台も遊んで以内よ', cls: 'dim' });
    for (const g of sm.played) lines.push({ text: g.icon + ' ' + g.name + '　' + g.info(sm.s), cls: '' });
    showDialog({ title: "TODAY'S GAMES", wide: true, lines, buttons: [{ label: '次へ', primary: true, onClick: () => { seq.step = 2; showTodayResult(); } }] });
  }
  function showTodayResult() {
    const p = P_(); const d = D_(); const sm = todaySummary();
    const lines = [
      { text: 'DAY ' + p.day, cls: 'big' },
      { text: '💴使ったお金　' + yen(d.spent), cls: '' },
      { text: '💴残ったお金　' + yen(p.money), cls: 'gold' },
      { text: '🪙 最高メダル　' + d.bestMedal + '枚', cls: '' },
      { text: '🎮遊んだゲーム　' + sm.played.length + '台', cls: '' }
    ];
    if (sm.best) lines.push({ text: "TODAY'S BEST", cls: 'head' }, { text: sm.best.name + '　WIN ' + sm.best.b + ' MEDALS', cls: 'gold' });
    lines.push({ text: '（残ったお金は明日へ持ち越せます）', cls: 'dim' });
    showDialog({ title: '本日の結果', wide: true, lines, buttons: [{ label: '閉店', primary: true, onClick: () => { seq.step = 3; seq.t = 0; seq.speed = 1; } }] });
  }

  function advanceDay() {                                      // 前の日の残金に おこづかい。メダルと、その日の進行はリセット（記録は残る）
    const p = P_();
    p.day++;
    p.money += ARC.dailyAllowance;
    save.daily = newDaily();
    hand = 0;
    try { crNextDay(); } catch (e) { /* クレーンの補充に失敗しても、ゲームは続ける */ }
    for (const m of MACHINES) if (m.gameType) GAME_TYPES[m.gameType].resetDaily();
    currentMachine = null;
    outOfMedalShown = false;
    centerFloor = 0;
    writeSave();
  }

  function stepSeq(dt) {
    if (!seq || seq.frozen) return;
    dt *= seq.speed;
    seq.t += dt;
    if (seq.kind === 'close') {
      if (seq.step === 0) {                                    // 店内が少し静かに（完全な無音にはしない）
        const k = Math.min(1, seq.t / 1.8);
        seq.tick -= dt;
        if (seq.tick <= 0) { seq.tick = 0.32; beep(rand(1400, 2200), 0, 0.03, 0.035 * (1 - k * 0.8)); }
        if (seq.t >= 1.8) { seq.step = 1; seq.t = 0; showTodayGames(); }
      } else if (seq.step === 3) {                             // 灯りが順番に消える → シャッター → CLOSED
        const t = seq.t;
        for (let i = 0; i < 5; i++) if (t >= 0.4 + i * 0.45 && !seq['l' + i]) { seq['l' + i] = true; beep(600 - i * 60, 0, 0.05, 0.04, 'square'); noise(0.02, 0.02); }   // ﾌﾟﾂｯ
        if (t >= 3.0 && !seq.rumble) { seq.rumble = true; noise(2.2, 0.06); beep(90, 0, 2.2, 0.025, 'sawtooth', 70); }            // ガラガラガラ……
        if (t >= 5.7 && !seq.closed) { seq.closed = true; beep(110, 0, 0.2, 0.05, 'square', 60); }
        if (t >= 7.2) { seq.step = 4; seq.t = 0; seq.speed = 1; }
      } else if (seq.step === 4) {                             // DAY n → DAY n+1
        if (!seq.dayDone) { seq.dayDone = true; seq.dayFrom = P_().day; advanceDay(); }
        if (seq.t >= 2.8) startOpening();
      }
    } else {
      const dur = OPEN_STEPS[seq.step];
      const t = seq.t;
      if (seq.step === 0) {                                    // 朝：鳥のさえずり
        if (t > 0.3 && seq.chirp < 1) { seq.chirp = 1; beep(2400, 0, 0.05, 0.03, 'triangle', 3000); beep(3000, 0.09, 0.05, 0.03, 'triangle', 2600); }
        if (t > 0.9 && seq.chirp < 2) { seq.chirp = 2; beep(2800, 0, 0.05, 0.03, 'triangle', 3300); beep(2300, 0.1, 0.06, 0.03, 'triangle', 2900); }
      } else if (seq.step === 1) {                             // シャッターが開く
        if (t > 0.05 && !seq.rumble) { seq.rumble = true; noise(1.5, 0.06); beep(90, 0, 1.5, 0.025, 'sawtooth', 70); }
      } else if (seq.step === 2) {                             // 筐体が順番に起動
        for (let i = 0; i < 5; i++) if (t >= 0.2 + i * 0.28 && !seq['l' + i]) { seq['l' + i] = true; beep(500 + i * 160 + rand(0, 80), 0, 0.06, 0.04, 'square'); }
        if (t > 1.5 && !seq.hum) { seq.hum = true; beep(660, 0, 0.1, 0.03); beep(880, 0.1, 0.15, 0.03); }
      } else if (seq.step === 4 && t > 0.05 && !seq.chime) { seq.chime = true; [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.09, 0.18, 0.05)); }   // OPEN! のチャイム
      if (t >= dur) {
        seq.step++; seq.t = 0;
        if (seq.step >= OPEN_STEPS.length) { endSeq(); return; }
        Object.keys(seq).filter((k) => /^l\d$|^rumble$|^hum$|^chime$/.test(k)).forEach((k) => delete seq[k]);
      }
    }
  }

  // 店の入口（閉店・開店の絵）
  function drawEntrance(o) {
    const night = ['#05060f', '#0a0c1c', '#10122a', '#14122a'];
    for (let i = 0; i < 8; i++) rect(8, 8 + i * 30, W - 16, 30, mixHex(mixHex('#05060f', '#4a98d8', o.sky), mixHex('#14122a', '#ffd0a0', o.sky), i / 7));
    if (o.sky < 0.7) { ctx.globalAlpha = 1 - o.sky; for (let k = 0; k < 22 + Math.round((W - 180) / 7); k++) rect(14 + (k * 53) % (152 + (W - 180)), 12 + (k * 31) % 90, 1, 1, '#d8e0ff'); ctx.globalAlpha = 1; }
    rect(8, 300, W - 16, 40, '#2a2a34'); for (let k = 0; k < 8 + Math.ceil((W - 180) / 22); k++) rect(14 + k * 22, 318, 12, 2, '#b8b8c8');
    rect(8, 296, W - 16, 5, '#5a5a68');
    ctx.save(); ctx.translate(Math.round((W - 180) / 2), 0);                // 建物は、そのままの形で中央に
    rect(20, 120, 140, 180, '#3a2a50'); rect(20, 120, 140, 6, '#5a4a78'); rect(20, 126, 4, 174, '#2a1e40'); rect(156, 126, 4, 174, '#2a1e40');
    rect(34, 132, 112, 24, '#120a24'); rect(34, 132, 112, 1, '#c85a90'); rect(34, 155, 112, 1, '#c85a90');
    if (o.sign > 0) { ctx.globalAlpha = 0.25 * o.sign; rect(36, 134, 108, 20, '#ff5ca8'); ctx.globalAlpha = 1; }
    drawTextCenter('GAME CENTER', 90, 135, mixHex('#3a2a40', '#ffb8dc', o.sign), 1, mixHex('#1a1020', '#7a2a5a', o.sign));
    drawTextCenter('NEW COSMO', 90, 143, mixHex('#3a2a40', '#ffd0ec', o.sign), 2, mixHex('#1a1020', '#7a2a5a', o.sign));
    rect(26, 162, 128, 6, '#8a2a3a');
    for (let i = 0; i < 5; i++) rect(36 + i * 26, 168, 5, 4, o.lamps[i] ? '#fff3a0' : '#4a3a30');
    rect(36, 176, 108, 112, '#05030a');
    for (let i = 0; i < 4; i++) {                                     // 店の中の筐体（灯りがつくと、色がつく）
      const on = o.inner[i];
      rect(44 + i * 25, 200, 20, 80, on ? ['#3a2470', '#1d5a4c', '#1d4f8a', '#6a4318'][i] : '#10101a');
      rect(47 + i * 25, 206, 14, 14, on ? ['#6ab8ff', '#58e0b0', '#9fe8ff', '#ffd090'][i] : '#06060c');
      if (on) { ctx.globalAlpha = 0.18; rect(40 + i * 25, 196, 28, 88, '#ffe9b0'); ctx.globalAlpha = 1; }
    }
    rect(36, 288, 108, 3, '#3a2a50');
    if (o.shutter > 0) {
      const h = Math.round(112 * o.shutter);
      rect(34, 176, 112, h, '#6a6a78');
      for (let y = 0; y < h; y += 4) rect(34, 176 + y, 112, 1, '#4a4a58');
      rect(34, 176 + h - 3, 112, 3, '#8a8a98'); if (h > 6) rect(86, 176 + h - 6, 8, 3, '#c0c0d0');
      if (o.closed) drawTextCenter('CLOSED', 90, 176 + h - 22, '#d8d8e8', 1, '#2a2a34');
    }
    ctx.restore();
  }

  function drawSeq() {
    drawFrame();
    if (!seq) { rect(8, 8, W - 16, H - 16, '#000000'); return; }
    if (seq.kind === 'close') {
      if (seq.step <= 2) {
        drawCenterRoom();                                              // いつものゲームセンターのまま、少し暗く
        const k = seq.step === 0 ? Math.min(1, seq.t / 1.8) : 1;
        ctx.globalAlpha = 0.45 * k; rect(8, 8, W - 16, H - 16, '#05030a'); ctx.globalAlpha = 1;
      } else if (seq.step === 3) {
        const t = seq.t;
        const lamps = [0, 1, 2, 3, 4].map((i) => t < 0.4 + i * 0.45);
        const inner = [0, 1, 2, 3].map((i) => t < 0.4 + (i + 0.5) * 0.5);
        const sh = t < 3.0 ? 0 : Math.min(1, (t - 3.0) / 2.5);
        const sign = t < 5.5 ? 0.7 : 0.7 * Math.max(0, 1 - (t - 5.5) / 1.2);
        drawEntrance({ sky: 0, shutter: sh, sign, lamps, inner, closed: t >= 5.7 });
        ctx.globalAlpha = 0.18 * Math.min(1, t / 2); rect(8, 8, W - 16, H - 16, '#000010'); ctx.globalAlpha = 1;
      } else {
        rect(8, 8, W - 16, H - 16, '#000000');
        const t = seq.t;
        const a1 = Math.min(1, t / 0.7) * (1 - Math.min(1, Math.max(0, (t - 1.0) / 0.6)));
        const a2 = Math.min(1, Math.max(0, (t - 1.2) / 0.7));
        ctx.globalAlpha = a1; drawTextCenter('DAY ' + (seq.dayFrom || P_().day - 1), 90 + Math.round((W - 180) / 2), 170, '#ffffff', 4, '#4a3a80');
        ctx.globalAlpha = a2; drawTextCenter('DAY ' + P_().day, 90 + Math.round((W - 180) / 2), 170, '#ffe9a0', 4, '#7a5a20');
        ctx.globalAlpha = 1;
      }
    } else {
      const t = seq.t;
      const dur = OPEN_STEPS[seq.step];
      const fadeIn = Math.min(1, t / 0.6);
      if (seq.step === 0) {
        drawEntrance({ sky: Math.min(1, t / 1.4) * 0.9, shutter: 1, sign: 0, lamps: [0, 0, 0, 0, 0], inner: [0, 0, 0, 0] });
        ctx.globalAlpha = 0.45 * (1 - Math.min(1, t / 1.4)); rect(8, 8, W - 16, H - 16, '#000010'); ctx.globalAlpha = 1;
        ctx.globalAlpha = fadeIn; drawTextCenter('DAY ' + seq.day, 90 + Math.round((W - 180) / 2), 70, '#ffffff', 4, '#3a2a60'); ctx.globalAlpha = 1;
        seqText('<span class="seq-sm">朝</span>', true);
      } else if (seq.step === 1) {
        seqText('');
        drawEntrance({ sky: 0.9, shutter: 1 - Math.min(1, t / (dur * 0.9)), sign: 0, lamps: [0, 0, 0, 0, 0], inner: [0, 0, 0, 0] });
      } else if (seq.step === 2) {
        const lamps = [0, 1, 2, 3, 4].map((i) => t >= 0.2 + i * 0.28);
        const inner = [0, 1, 2, 3].map((i) => t >= 0.4 + i * 0.3);
        drawEntrance({ sky: 0.9, shutter: 0, sign: t >= 1.4 ? Math.min(1, (t - 1.4) / 0.4) : 0, lamps, inner });
      } else if (seq.step === 3) {
        drawEntrance({ sky: 0.9, shutter: 0, sign: 1, lamps: [1, 1, 1, 1, 1], inner: [1, 1, 1, 1] });
        ctx.globalAlpha = 0.72 * fadeIn; rect(8, 8, W - 16, H - 16, '#05030a'); ctx.globalAlpha = 1;
        const a = Math.min(1, t / 0.5);
        const b = Math.min(1, Math.max(0, (t - 0.7) / 0.5));
        const c = Math.min(1, Math.max(0, (t - 1.4) / 0.5));
        seqText('<span class="seq-big" style="opacity:' + a + '">DAY ' + seq.day + '</span>' +
          '<span class="seq-md" style="opacity:' + a + '">今日のお小遣い</span>' +
          '<span class="seq-gold" style="opacity:' + b + '">+ ' + yen(ARC.dailyAllowance) + '</span>' +
          '<span class="seq-md" style="opacity:' + c + '">' + yen(seq.prev) + ' ＋ ' + yen(ARC.dailyAllowance) + '<br>＝ <b>' + yen(seq.total) + '</b></span>');
      } else {
        seqText('');
        drawEntrance({ sky: 0.95, shutter: 0, sign: 1, lamps: [1, 1, 1, 1, 1], inner: [1, 1, 1, 1] });
        const a = Math.min(1, t / 0.25);
        ctx.globalAlpha = a; rect(8, 190, W - 16, 40, 'rgba(5,3,10,0.7)'); drawTextCenter('OPEN!', 90 + Math.round((W - 180) / 2), 200, '#ffe070', 4, '#7a4a08'); ctx.globalAlpha = 1;
      }
    }
    if (seqCanSkip()) { const r = seqSkipRect(); rect(r.x + 4, r.y + 6, 46, 16, 'rgba(5,3,10,0.72)'); rect(r.x + 4, r.y + 6, 46, 1, '#8a7ac8'); drawTextCenter('SKIP', r.x + 27, r.y + 11, '#e8e0f0', 1); }
    if (seq.kind === 'close' && seq.step >= 3) seqText('');
  }

  // ---------------------------------------------------------------------
  //  店長のおすすめ！
  // ---------------------------------------------------------------------
  const RCC = CONFIG.recommend;
  function totalPlays() {
    const st = D_().stats;
    return Math.floor(st.piyo.coins / 5) + st.slime.plays + st.duck.races + st.ham.plays + st.slot.plays + Object.values(st.mg).reduce((a, g) => a + g.plays, 0);
  }
  const recInterval = () => randInt(RCC.interval[0], RCC.interval[1]);
  function recSpawn(force) {
    const r = D_().rec;
    if (!RCC.enabled || r.active) return false;
    if (!force && r.done >= RCC.maxPerDay) return false;
    const ms = MACHINES.filter((m) => m.gameType);
    const w = ms.map((m) => { const i = MACHINES.indexOf(m); return TODAY_DEF[i] && TODAY_DEF[i].on(D_().stats) ? 1 : RCC.newBias; });     // まだ遊んでいない台を、やや選ばれやすく
    let t = Math.random() * w.reduce((a, b) => a + b, 0);
    let pick = ms[0];
    for (let i = 0; i < ms.length; i++) { t -= w[i]; if (t < 0) { pick = ms[i]; break; } }
    r.active = pick.machineId; r.piyoBase = D_().stats.piyo.coins;
    toast('📌店長のおすすめ！' + pick.machineName + '（' + medalFloorNo(pick.machineId) + 'F）');
    sfx.event();
    writeSave();
    return true;
  }
  function recCheck() {
    const r = D_().rec;
    if (!r) return;
    if (r.active === 'piyo' && D_().stats.piyo.coins > r.piyoBase) {       // ピヨちゃん：コインを入れたら、ボーナスのメダル
      hand += RCC.piyoBonus; noteMedals(); r.active = null; r.done++; r.base = totalPlays(); r.next = recInterval();
      toast('店長のおすすめボーナス！ +' + RCC.piyoBonus + '枚'); writeSave();
      return;
    }
    if (r.active || r.done >= RCC.maxPerDay) return;
    if (!r.next) { r.next = recInterval(); r.base = totalPlays(); }
    if (totalPlays() - r.base >= r.next) recSpawn(false);
  }
  function recBonus(id, pay) {                                  // おすすめ台の、次の1回だけ、払い出しがUP（ざんねんでも、ペナルティなし）
    const r = D_().rec;
    if (!r || r.active !== id) return pay;
    r.active = null; r.done++; r.base = totalPlays(); r.next = recInterval();
    const extra = pay > 0 ? Math.ceil(pay * (RCC.bonusMul - 1)) : 0;
    toast(extra > 0 ? '店長のおすすめボーナス！ +' + extra + '枚' : '店長のおすすめ：残念……また今度！');
    writeSave();
    return pay + extra;
  }

  // ---------------------------------------------------------------------
  //  タイトル画面
  // ---------------------------------------------------------------------
  const titleEl = document.createElement('div');
  titleEl.className = 'title-screen';
  screenEl.appendChild(titleEl);
  function hideTitle() { titleEl.classList.remove('is-show'); titleEl.innerHTML = ''; }
  function showTitle() {
    scene = 'title'; save = null; hand = 0; currentMachine = null;
    const loaded = readSave();
    titleEl.innerHTML = '<div class="title-logo">きょうもゲーセン。</div><div class="title-sub">GAME CENTER NEW COSMO</div><div class="title-menu"></div>';
    const menu = titleEl.querySelector('.title-menu');
    const add = (label, fn, primary) => {
      const b = document.createElement('button');
      b.className = 'title-btn' + (primary ? ' is-primary' : '');
      b.textContent = label;
      b.addEventListener('click', () => { ensureAudio(); fn(); });
      menu.appendChild(b);
    };
    if (loaded) {
      add('続きから', () => { hideTitle(); beginLoaded(loaded); toast('DAY ' + P_().day + 'の続きから'); }, true);
      add('最初から', () => showDialog({
        title: '最初から', lines: ['セーブデータを消して最初から始めますか？'],
        buttons: [{ label: 'はい', primary: true, onClick: () => { try { localStorage.removeItem(ARC.saveKey); localStorage.removeItem('piyo-arcade-save-v1'); } catch (e) { /* 何もしない */ } hideTitle(); beginNew(); } }, { label: 'いいえ' }]
      }));
    } else add('始める', () => { hideTitle(); beginNew(); }, true);
    titleEl.classList.add('is-show');
    updateSceneUi();
  }
  function drawTitle() {
    drawFrame();
    drawEntrance({ sky: 0, shutter: 0, sign: 0.75 + 0.25 * Math.sin(centerT * 1.5), lamps: [1, 1, 1, 1, 1], inner: [1, 1, 1, 1] });
    ctx.globalAlpha = 0.35; rect(8, 8, W - 16, H - 16, '#05030a'); ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  //  あそびかた（筐体に貼ってある説明カード）。表は、いまの実際の設定値から作ります
  // ---------------------------------------------------------------------
  const pctTxt = (th) => String(+(th * 100).toFixed(1)) + '%';
  function helpRowsPct(bands) {                                  // 割合 → 払い出し
    const asc = bands.slice().sort((a, b) => a[0] - b[0]);
    return [[pctTxt(asc[0][0]) + '未満', '0枚']].concat(asc.map((b) => [pctTxt(b[0]) + ' 〜', b[1] + '枚']));
  }
  function helpRowsInt(bands) {                                  // 点数・合計 → 払い出し
    const asc = bands.slice().sort((a, b) => a[0] - b[0]);
    const rows = [['0〜' + (asc[0][0] - 1), '0枚']];
    asc.forEach((b, i) => rows.push([asc[i + 1] ? b[0] + '〜' + (asc[i + 1][0] - 1) : b[0] + ' 〜', b[1] + '枚']));
    return rows;
  }
  function craneHelp(id) {
    const key = Object.keys(CRC.machines).find((k) => CRC.machines[k].id === id); const M = CRC.machines[key];
    return { name: '🧸 ' + M.name, need: '¥' + CRC.price + '（MONEYから）', how: ['¥' + CRC.price + 'で 1PLAY。見るだけなら無料！', '「横」を押して、離したところで位置を決める。', '床の影（アームの真上）で奥行きを確かめる。', '「奥」を押して離すと、アームが自動で降りる。', '取れなくても景品の位置はそのまま！次の PLAYで続きを狙えるよ。'], goal: '爪やストラップを上手く引っかけて景品を景品口へ！', notes: key === 'piyo' ? ['大きくて重いぬいぐるみ。少しずつ景品口へ寄せよう。'] : [key === 'slime' ? '山を崩すと、周りも動くよ。上手くいくと 2個取れる！' : '丸い子は転がる、長い子は爪が掛かりやすい！'] };
  }
  function helpData(id) {
    if (String(id).indexOf('crane_') === 0) return craneHelp(id);
    if (id === 'jc_jewelchain') return { name: '💎 JEWEL CHAIN', need: '¥' + JCC.price + '（MONEYから）', how: ['同じ色の宝石を 上下左右に 3つ以上 つなげると 消えるよ。', '左右にドラッグ＝いどう　タップ＝回転　下スワイプ＝すばやく落とす。', '消えて 落ちてきた宝石が また つながると「連鎖」！ 連鎖が つづくほど 高得点。', 'たいせんでは、連鎖が お邪魔石に なって 相手に ふるよ。'], goal: 'ひとりは 5分で ハイスコア！ たいせんは 相手を 積みあげさせたら 勝ち。', notes: ['MEDALも MONEYも もらえないよ。'] };
    if (id === 'tt_pingpong') return { name: '🏓 PING PONG RALLY', need: '¥' + TTC.price + '（MONEYから）', how: ['画面に ゆびを おいて、 左右に うごかして、 ラケットを ボールに あわせよう！', 'ボールが バウンドしたあと、 来る場所に 目印が 出るよ。 あたれば、 じどうで 打ち返すよ。', 'ラケットの 左はしに あてると 左へ、 まんなかは まんなか、 右はしは 右へ 飛ぶよ。', '先に 5点とったら 勝ちだよ。 CPUの調子は、 その日でちがうかも…？'], goal: '5点 先取！', notes: ['MEDALも MONEYも もらえないよ。'] };
    if (id === 'sz_strikezone') return { name: '🎳 STRIKE ZONE', need: '¥' + SZC.price + '（MONEYから）', how: ['ボールを 指で つかんで、 上へ スワイプして 投げよう！', '速くスワイプすると ボールも 速くなるよ。', '少し 曲げて 投げると カーブするよ。', '5フレーム。ストライクを つづけると 最高 150点！'], goal: 'BEST SCORE を のばそう！', notes: ['ガターガードは、 はじめに えらべるよ。', 'MEDALも MONEYも もらえないよ。'] };
    if (id === 'as_airsmash') return { name: '🏒 AIR SMASH', need: '¥' + ASC.price + '（MONEYから）', how: ['青いマレットを 指で動かして、 パックを うち返そう！', '赤いCPUより 先に 5点とったら 勝ちだよ。', '強くふると、 パックも 速く飛ぶよ。', 'CPUの調子は、 その日その日で ちがうかも…？'], goal: '5点 先取！', notes: ['MEDALも MONEYも もらえないよ。'] };
    if (id === 'pp_powerpunch') return { name: '🥊 POWER PUNCH', need: '¥' + PPC.price + '（MONEYから）', how: ['1回だけ、 パンチングパッドを 打つよ！', '画面の下の START から、 上のパッドへ 一気にスワイプ！', '速くて、 まっすぐで、 真ん中に 当たるほど 高得点。', '最高は 999！ 1発勝負だよ。'], goal: 'BEST POWER を のばそう！', notes: ['MEDALも MONEYも もらえないよ。'] };
    if (id === 'nb_nicebatting') return { name: '⚾ NICE BATTING', need: '¥' + NBC.price + '（MONEYから）', how: ['奥のピッチングマシンから、 ボールが 10球 飛んでくるよ。', '画面を 横にスワイプして、 バットを 振ろう！', '振るのが はやいと 左へ、 おそいと 右へ 飛ぶよ。', '奥のネットの的に 当てて、 合計点を ねらおう！'], goal: 'BEST SCORE を のばそう！', notes: ['MEDALも MONEYも もらえないよ。'] };
    if (id === 'br_basketrush') return { name: '🏀 BASKET RUSH', need: '¥' + BRC.price + '（MONEYから）', how: ['床にころがる6つのボールを、 指でつかんで、 ゴールへ フリック！', '30秒で、 何本 入るかな？ 1本＝1点だよ。', '入っても、外れても、ボールは 床にもどってくるよ。', '残り10秒から、 ゴールが 左右に動きはじめるよ！'], goal: 'BEST SCORE を のばそう！', notes: ['MEDALも MONEYも もらえないよ。'] };
    if (id === 'td_topdriver') return { name: '🏎️ TOP DRIVER', need: '¥' + TDC.price + '（MONEYから。スタートを押したとき）', how: ['アクセルもブレーキも ないよ。 車は 自動で走る！ 操作は、 画面の下の ハンドルだけ。', 'ハンドルの上に指をおいて、 ぐるっと 円をえがくように回すと、 ハンドルが回って 車が曲がるよ。', '指をはなすと、 ハンドルは スルスルッと 中央に戻るよ。', '右カーブなら 右へ、 左カーブなら 左へ。 草地や壁、 CPU車に当たると 遅くなるよ。', '1位を目指して、 BEST TIME を更新しよう！'], goal: '4台のレースで 1位になろう！', notes: ['MEDALも MONEYも もらえないよ。 失敗しても、 そのまま走りつづけられるよ。'] };
    if (id === 'kc_kawaiiclub') return { name: '📸 KAWAII CLUB', need: '¥' + KCC.price + '（MONEYから。撮影するを決めたとき）', how: ['8人のアバターから 1人えらんで、 背景の色をえらぶよ。', '「撮影する」で 1枚だけ撮影！ そのあと デコ（落書き）タイム。', 'STAMP：スタンプをえらぶ（左右の矢印でページが変わるよ）。 ドラッグで動かして、 四角の右上の「つまみ」で大きさ、 TURN でかたむき、 DELETE で消す。', 'PEN：色と太さをえらんで、 指で好きなものを書こう。 UNDO で ひとつ戻る、 RESET で全部消す。', 'FINISH で完成。 チェキ風の写真が、 1FのRECORD（PHOTO）に保存されるよ。'], goal: 'NEW COSMO に来た日の、 記念写真をのこそう！', notes: ['MEDALも MONEYも もらえないよ。 デコの時間は、 好きなだけ！'] };
    if (id === 'st_sparktap') return { name: '✨ SPARK TAP', need: '¥' + STC.price + '（MONEYから。遊ぶを押したとき）', how: ['9枚のパネルが、ピアノに合わせて光るよ。 光った場所を、音楽に合わせて直接タップ！', 'SPARK：白い光が集まってきて、光った瞬間にタップ。', 'CHARGE：長く光ったら、押しつづけて、最後に離す。', 'CHAIN：色のついたパネルを、1→2→3…の数字の順に、音楽に合わせてタップ（赤・黄・青・緑・紫・オレンジ）。', 'EASYは 1本の指で OK。 NORMAL・HARDは 2本の指まで使うよ。'], goal: 'スコア・ランク・FULL COMBO・ALL PERFECT を目指そう！', notes: ['MEDALも MONEYも もらえないよ。 途中で終わらないから、最後まで遊べるよ。', '「あそびかた」ボタンで、いつでも練習できるよ（無料）。'] };
    if (id === 'hb_happybeat') return { name: '♪ HAPPY BEAT', need: '¥' + HBC.price + '（MONEYから。遊ぶを押したとき）', how: ['難しさを選んで「遊ぶ」。 1曲最後まで遊べるよ（途中で終わらない）。', 'TAP：流れてきたノーツがラインに着いたら、そのレーンをタップ。', 'HOLD：長い帯。押したまま、終わりまで待って、離す。', 'SLIDE HOLD：押したまま、指を滑らせて帯をなぞる（押し直さない）。', 'EASYは 1本の指で OK。 NORMAL・HARDは 2本の指を使うよ。'], goal: 'スコア・ランク・FULL COMBO を目指そう！', notes: ['MEDALも MONEYももらえないよ。楽しく遊ぶだけ！'] };
    switch (id) {
      case 'piyo': return { name: '🐥 PIYO MEDAL ADVENTURE', need: 'メダル 1枚〜（続けて入れる）', how: ['🎲に入れると、ピヨちゃんがサイコロで進むよ（全部で50マス）。', '止まったマスで 4つのポケットが変わる！', 'てき：⚔️＝1HIT 💥＝2HIT。' + 3 + 'HIT（強いてきは' + 5 + 'HIT）で倒せる。時間制限なし、❌は何も起きないよ。', '宝箱・CHANCE TIME は 6秒チャンス！ルール説明の後 3・2・1・START！⭐に 2回入れよう（1回でも 0回でも少しもらえる）。', 'ボスは普段はゆっくり。途中で ATTACK CHANCE（6秒）が来るよ。'], goal: 'ドラゴンを倒して WORLD CLEAR（' + SGC.worldClearPay + '枚）', notes: ['🍀ラッキーマス：もう1回サイコロを振れるよ（続けては出ないよ）。', '扉・色合わせ・炎は時間制限なし（ご褒美はなし）。', '色合わせは、間違えても戻らないよ。'], title: 'ご褒美（メダル）', rows: [['てき（普通）', SGC.rewards.battleNormal[0] + '〜' + SGC.rewards.battleNormal[1] + '枚'], ['てき（強い）', SGC.rewards.battleStrong[0] + '〜' + SGC.rewards.battleStrong[1] + '枚'], ['CHANCE TIME ⭐2/1/0回', SGC.chanceBonus[0] + '〜' + SGC.chanceBonus[1] + ' / ' + SGC.rewards.chance.one + ' / ' + SGC.rewards.chance.zero + '枚'], ['宝箱⭐2/1/0回', SGC.rewards.chestFixed.small[2] + ' / ' + SGC.rewards.chestFixed.small[1] + ' / ' + SGC.rewards.chestFixed.small[0] + '枚']] };
      case 'slime': return { name: '🟢 SLIME HUNT', need: '1枚', how: ['スライムを 1匹選んで、連打で戦う。', 'DRAWはなし。 WIN か LOSE。'], goal: 'WIN で配当', title: 'スライム　（勝てる確率→配当）', rows: SLIMES.map((m) => [m.label + '　' + m.winRate + '%', m.payout + '枚']) };
      case 'duck': return { name: '🦆 DUCK RACE', need: '1〜' + DKC.maxBet + '枚（1つの予想にまとめて）', how: ['アヒルを選んで BET。＋−で枚数。', 'WIN（1着）／ EXACTA（1・2着）／ TRIFECTA（1〜3着）'], goal: '予想が当たれば配当', notes: ['配当＝オッズ× BETの枚数。オッズはアヒルや賭け方で変わるよ。'] };
      case 'ham': return { name: '🐹 HAM-CHAN PANIC!', need: HMC.betCost + '枚', how: ['トロッコで進むか、降りるか選ぶ。', '降りると今の配当。 CRASH なら 0。'], goal: '上手く降りて配当をもらう', title: '進んだ段階→配当', rows: HM_STAGES.map((st, i) => [(i + 1) + '回クリア', st.payout * HMC.betCost + '枚']) };
      case 'slot': return { name: '🎰 LUCKY SLOT', need: SLC.betCost + '枚', how: ['SPIN → STOP を 3回。目押しで揃えよう。', '内部で選ばれた役だけ揃うよ。引き込める範囲で STOP！'], goal: '同じ図柄を 3つ揃える', title: '揃った図柄→配当', rows: SL_KEYS.map((k, i) => [SL_NAMES[i] + ' ×3', SL_PAY[i] * SLC.betCost + '枚']) };
      case 'star': return { name: '🚀 STAR FLIGHT', need: SFC.betCost + '枚（BIG SHIP +' + SFC.sizeUp.cost + 'で合計' + (SFC.betCost + SFC.sizeUp.cost) + '枚）', how: ['UP／DOWN で上下に飛んで⭐を集める。', 'ルートは限られていて、全部は取れないよ。'], goal: '取れる⭐の最大数に対する割合', title: '普通の船　（取った⭐の割合→配当）', rows: helpRowsPct(SFC.payBands), title2: 'BIG SHIP　（船と⭐を取る範囲が大きい）', rows2: helpRowsPct(SFC.sizeUp.payBands) };
      case 'fish': return { name: '🐟 FISH CATCH', need: 'NORMAL NET ' + FCC.nets.normal.cost + '枚／ BIG NET ' + FCC.nets.big.cost + '枚', how: ['網を選ぶ→魚を見て CATCH! で落とす。', 'CATCH! を押して 0.5秒ごに網が着くよ。'], goal: '網に入った魚の配当', notes: ['BIG NETは捕まえやすいだけ。配当は同じ。'], title: '魚　→配当', rows: FCC.types.map((t) => [t.name, t.pay + '枚']) };
      case 'bingo': return { name: '🎱 BIG BINGO', need: '1・3・5枚（えらんで BET）', how: ['3まいの カードから 1まい えらぼう！', '6この ボールが 1こずつ でてくるよ。', 'ならんだ ラインの数で、 メダルが もらえるよ！', '（ボールの数字は 1〜20。 まんなかは FREE）'], goal: 'ラインが 多いほど メダル大量GET！', title: 'ライン→配当（BET×）', rows: [['1 LINE', '×2'], ['2 LINES', '×5'], ['3 LINES', '×10'], ['4 LINES', '×20'], ['5 LINES', '×50']] };
      case 'ghost': return { name: '👻 GHOST PANIC', need: GHC.betCost + '枚', how: ['出てくるゴーストをタップ！' + GHC.duration + '秒間。', '🎃カボチャを叩くと減点。'], goal: '（倒した数−カボチャ）÷出たゴースト', title: '成績→配当', rows: helpRowsPct(GHC.payFrac) };
      case 'pirate': return { name: '🏴‍☠️ PIRATE TREASURE', need: PTC.betCost + '枚', how: ['3ラウンド、 3つの宝箱から 1つ選ぶ。', '箱の見た目と中身は関係なし。選ばな勝った箱も後で開くよ。'], goal: '合計 VALUE が高いほどたくさん', title: '宝の VALUE', rows: PTC.items.map((n, i) => [n, 'VALUE ' + PTC.values[i]]), title2: '3つの合計 VALUE →配当', rows2: helpRowsInt(PTC.payBands) };
      case 'train': return { name: '🚂 STOP! TRAIN', need: TRC.betCost + '枚', how: ['はしる列車のスピードをよく見て、 BRAKE! は 1回。', 'じわじわゲンソクして止まるよ。 STOPマークに近く止めよう。'], goal: 'マークに近く止まる', title: '止まったいち→配当', rows: [['PERFECT STOP!!', TRC.pays.perfect + '枚'], ['GOOD STOP!', TRC.pays.good + '枚'], ['STOP!', TRC.pays.ok + '枚'], ['TOO EARLY!／OVERRUN!', '0枚']] };
      case 'balloon': return { name: '🎈 BALLOON SHOOT', need: BLC.betCost + 'まいで' + BLC.shots + '発（撃ち終わると +' + BLC.extra.cost + 'まいで +' + BLC.extra.shots + '発、 1回だけ）', how: ['照準は自動で動くよ。 FIRE! のタイミングだけ。', '重なった風船は 1発でまとめて割れる。'], goal: 'ポイントを集める', title: '風船　→ポイント', rows: BLC.types.map((t) => [t.id === 'red' ? 'RED（赤）' : t.id === 'silver' ? 'SILVER（銀）' : 'STAR（星）', t.pts + 'pt']), title2: '合計ポイント→配当', rows2: helpRowsInt(BLC.payBands) };
      case 'cosmo': return { name: '🌟 SUPER COSMO', need: 'BET ' + CSC.bets.join('・') + '枚（選ぶ）', how: ['① BETを選んで START。②ランプが止まった目で結果。 NEXT を狙おう。', '③ NEXT なら TAKE（受け取る）か CHALLENGE。④一番奥の JACKPOT は BET×' + CSC.final.find((o) => o.id === 'jp').mul + '。'], goal: 'どこで勝ち逃げするか', notes: ['CHALLENGE の後に LOSE すると、途中の仮の WINも 0 になるよ！', 'BETが大きくても、確率は変わらないよ。'], title: 'BETごとの配当', rows: CSC.bets.map((b) => ['BET ' + b, 'TAKE ' + Math.floor(b * CSC.take1) + ' ／ JACKPOT ' + Math.floor(b * CSC.final.find((o) => o.id === 'jp').mul)]), title2: '途中の配当（BETの何倍）', rows2: [['RETURN', '×1'], ['NEXT の後 TAKE', '×' + CSC.take1], ['BIG CHANCE', '×1 ／ ×1.5 ／ ×2'], ['JACKPOT CHANCE の TAKE', '×' + CSC.take2], ['JACKPOT', '×' + CSC.final.find((o) => o.id === 'jp').mul]] };
      default: return null;
    }
  }
  function showHelp(m) {
    const d = helpData(m.machineId);
    if (!d) return;
    const lines = [{ text: d.name, cls: 'head' }, { cols: ['必要', d.need], cls: 'need' }];
    d.how.forEach((t) => lines.push({ text: t }));
    lines.push({ text: '★ ' + d.goal, cls: 'gold' });
    (d.notes || []).forEach((t) => lines.push({ text: t, cls: 'dim' }));
    if (d.rows) { lines.push({ text: '【配当表】' + (d.title || ''), cls: 'head' }); d.rows.forEach((r) => lines.push({ cols: r })); }
    if (d.rows2) { lines.push({ text: '【配当表】' + d.title2, cls: 'head' }); d.rows2.forEach((r) => lines.push({ cols: r })); }
    showDialog({ title: 'あそびかた', card: true, wide: true, lines, buttons: [{ label: '閉じる', primary: true }] });
  }

