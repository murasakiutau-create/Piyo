'use strict';
  // =====================================================================
  //  ゲームセンター（ゲーム全体の外側のレイヤー）
  //   DAY START → GAME CENTER → メダル貸出機 / 筐体 / 出口 → DAY RESULT → 次の日
  //   ピヨちゃんRPGは「ゲームセンターに置かれた1台」として動きます
  // =====================================================================
  const ARC = CONFIG.arcade;

  // ---- 筐体の一覧（空きスペースに新台を置くだけで増やせます） ----
  //   gameType は GAME_TYPES の名前。unlocked: false は「???」表示
  // 👻 GHOST PANIC：メダルフロアから 外した（あとで べつの階へ）。ゲーム本体（ghostPanic）・素材・記録は そのまま のこっている。もどすときは、この定義を MACHINES か べつの階へ 入れる
  const GHOST_MACHINE = { machineId: 'ghost', machineName: 'GHOST PANIC', label: 'GHOST PANIC', isUnlocked: true, gameType: 'ghostPanic',
      theme: { body: '#3a1a5a', side: '#6a3a9a', sign: '#c8a0ff', signText: '#2a0a4a', bulb: '#f0e0ff', bulbOff: '#4a2a6a', buttons: ['#ffffff', '#c8a0ff', '#7dff8a'] } };
  const MACHINES = [
    { machineId: 'piyo', machineName: 'ピヨちゃんメダルアドベンチャー', label: 'PIYO ADV', icon: 'piyo', isUnlocked: true, gameType: 'piyoAdventure',
      theme: { body: '#3a2470', side: '#5a3a9a', sign: '#c8a040', signText: '#3a1d00', bulb: '#fff3c0', bulbOff: '#8a6a20', buttons: ['#c8d0f0', '#7dd0ff', '#ffd040', '#ff8ef0'] } },
    { machineId: 'slime', machineName: 'スライムハント', label: 'SLIME HUNT', icon: 'slime', isUnlocked: true, gameType: 'slimeHunt',
      theme: { body: '#1d5a4c', side: '#2f8a6a', sign: '#58c878', signText: '#0a2a1a', bulb: '#e8ffe8', bulbOff: '#2a6a4a', buttons: ['#ff5060', '#ffd040', '#5ce870'] } },
    { machineId: 'duck', machineName: 'ダックレース', label: 'DUCK RACE', icon: 'duck', isUnlocked: true, gameType: 'duckRace',
      theme: { body: '#1d4f8a', side: '#2f7ac0', sign: '#ffd93a', signText: '#3a2a00', bulb: '#fffbe0', bulbOff: '#7a6a20', buttons: ['#ffd93a', '#ff9ab8', '#5ca8ff'] } },
    { machineId: 'ham', machineName: 'ハムちゃん危機一髪！', label: 'HAM PANIC', icon: 'ham', isUnlocked: true, gameType: 'hamPanic',
      theme: { body: '#6a4318', side: '#8a5a24', sign: '#ffb040', signText: '#3a1a00', bulb: '#fff3c0', bulbOff: '#6a4a20', buttons: ['#ff5050', '#ffd040', '#7dff8a'] } },
    { machineId: 'slot', machineName: 'LUCKY SLOT', label: 'LUCKY SLOT', icon: 'slot', isUnlocked: true, gameType: 'luckySlot',
      theme: { body: '#6a1020', side: '#a02030', sign: '#ffd040', signText: '#4a0a10', bulb: '#fff3c0', bulbOff: '#7a5a20', buttons: ['#ffd040', '#ff5060', '#ffffff'] } },
    { machineId: 'star', machineName: 'STAR FLIGHT', label: 'STAR FLIGHT', isUnlocked: true, gameType: 'starFlight',
      theme: { body: '#1a2a6a', side: '#2f48a8', sign: '#9fe8ff', signText: '#0a1a4a', bulb: '#e8ffff', bulbOff: '#2a3a7a', buttons: ['#5ca8ff', '#ffd040', '#ffffff'] } },
    { machineId: 'fish', machineName: 'FISH CATCH', label: 'FISH CATCH', isUnlocked: true, gameType: 'fishCatch',
      theme: { body: '#1a5a7a', side: '#2a88aa', sign: '#7ad0ff', signText: '#06283a', bulb: '#e8ffff', bulbOff: '#1a4a6a', buttons: ['#ff9a4a', '#ffd830', '#e8e0a0'] } },
    { machineId: 'bingo', machineName: 'BIG BINGO', label: 'BIG BINGO', isUnlocked: true, gameType: 'bingo',                       // GHOST PANIC の枠に配置（GHOST PANIC は、GHOST_MACHINE として のこしてある）
      theme: { body: '#b82028', side: '#ffd840', sign: '#ffd840', signText: '#8a1018', bulb: '#fff0b0', bulbOff: '#6a2a20', buttons: ['#ffd840', '#fff3d0', '#ff5a5a'] } },
    { machineId: 'pirate', machineName: 'PIRATE TREASURE', label: 'TREASURE', isUnlocked: true, gameType: 'pirateTreasure',
      theme: { body: '#6a4318', side: '#9a6a28', sign: '#ffd040', signText: '#3a1a00', bulb: '#fff3c0', bulbOff: '#6a4a20', buttons: ['#ffd040', '#ff5060', '#2aaa5a'] } },
    { machineId: 'train', machineName: 'STOP! TRAIN', label: 'STOP! TRAIN', isUnlocked: true, gameType: 'stopTrain',
      theme: { body: '#1a5a4a', side: '#2a8a6a', sign: '#9fffd0', signText: '#06281a', bulb: '#e8fff0', bulbOff: '#1a4a3a', buttons: ['#ff5050', '#ffd040', '#ffffff'] } },
    { machineId: 'balloon', machineName: 'BALLOON SHOOT', label: 'BALLOON', isUnlocked: true, gameType: 'balloonShoot',
      theme: { body: '#8a2a5a', side: '#c84a8a', sign: '#ffd84a', signText: '#4a0a2a', bulb: '#fff3c0', bulbOff: '#6a2a4a', buttons: ['#ff5a6a', '#ffd84a', '#5ca8ff'] } },
    { machineId: 'cosmo', machineName: 'SUPER COSMO', label: 'SUPER COSMO', isUnlocked: true, gameType: 'superCosmo',
      theme: { body: '#2a0a10', side: '#c8a030', sign: '#ffd040', signText: '#4a0008', bulb: '#fff3c0', bulbOff: '#6a3020', buttons: ['#ff3040', '#ffd040', '#ffffff'] } }
  ];

  // ---- 遊び方の種類ごとの「つなぎ口」 ----
  //   resetDaily：その日の状態を初期化 / saveDaily：保存用データ / loadDaily：再開
  //   canLeave：席を立てるか / enter：座ったとき / update：毎フレームの進行 / draw：描画
  //   pointer：タップ / space：スペースキー / hint：画面の下の説明
  const GAME_TYPES = {
    piyoAdventure: {
      resetDaily() { resetPiyoDay(); },
      saveDaily() { return serializePiyo(); },
      loadDaily(data) { if (data) restorePiyo(data); else resetPiyoDay(); },
      canLeave(commit) { return piyoCanLeave(commit); },
      enter() {
        if (SGM()) sgEnterMessage(); else hintNext();
        if (hand <= 0) setMessage('メダルがないよ。席を立って貸出機へ', C.pink);
      },
      update(dt) {
        acc += dt;                 // 筐体に座っているときだけ、盤面とRPGが動く
        while (acc >= STEP) { step(); acc -= STEP; }
      },
      draw() { render(); },
      pointer(e, p) {
        guideX = clampGuide(p.x);
        if (p.y < BOARD.bottom) {        // 盤面より上をタップすると投入
          holding = true;
          if (canvas.setPointerCapture && e) canvas.setPointerCapture(e.pointerId);
          insertCoin(guideX);
        }
      },
      space() { insertCoin(guideX); },
      hint: '上をタップで投入（長押しで連続）'
    },
    slimeHunt: {
      resetDaily() { slimeResetDay(); },
      saveDaily() { return slimeSerialize(); },
      loadDaily(data) { slimeRestore(data); },
      canLeave() { return slimeCanLeave(); },
      enter() { slimeEnter(); },
      update(dt) { slimeUpdate(dt); },
      draw() { drawSlimeScreen(); },
      pointer(e, p) { slimePointer(e, p); },
      space() { slimeSpace(); },
      hint: 'スライムを選んで連打！'
    },
    duckRace: {
      resetDaily() { dkResetDay(); },
      saveDaily() { return dkSerialize(); },
      loadDaily(data) { dkRestore(data); },
      canLeave() { return dkCanLeave(); },
      enter() { dkEnter(); },
      update(dt) { dkUpdate(dt); },
      draw() { drawDuckScreen(); },
      pointer(e, p) { dkPointer(e, p); },
      space() { dkSpace(); },
      msgBox() { return DK_MSG_BOX; },
      hint: 'アヒルを選んで BET！'
    },
    hamPanic: {
      resetDaily() { hmResetDay(); },
      saveDaily() { return hmSerialize(); },
      loadDaily(data) { hmRestore(data); },
      canLeave() { return hmCanLeave(); },
      enter() { hmEnter(); },
      update(dt) { hmUpdate(dt); },
      draw() { drawHamScreen(); },
      pointer() { /* ボタンは、画面の上に重ねた HTML のボタンです */ },
      space() { if (HM.phase === 'idle') hmStart(); },
      msgBox() { return HM_MSG_BOX; },
      hint: '降りるか、進むか……！'
    },
    luckySlot: {
      resetDaily() { slResetDay(); },
      saveDaily() { return {}; },
      loadDaily() { slResetDay(); },
      canLeave() { return slCanLeave(); },
      enter() { slEnter(); },
      update(dt) { slUpdate(dt); },
      draw() { drawSlotScreen(); },
      pointer(e, p) { slPointer(e, p); },
      space() { slSpin(); },
      key(k) { return slKey(k); },
      msgBox() { return SL_MSG_BOX; },
      hint: 'STOPで揃えよう！'
    }
  };


  // ---- HTMLのダイアログ・お知らせ ----
  const dlg = document.getElementById('dialog');
  const dlgTitle = document.getElementById('dialog-title');
  const dlgBody = document.getElementById('dialog-body');
  const dlgButtons = document.getElementById('dialog-buttons');
  const toastEl = document.getElementById('toast');
  const standBtn = document.getElementById('stand');
  const helpBtn = document.getElementById('help');
  const hintEl = document.getElementById('hint');
  let toastTimer = null;

  function escapeHtml(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  let dlgShownAt = 0;
  function showDialog(opt) {
    dialogOpen = true; dlgShownAt = performance.now();
    holding = false;
    dlg.className = 'dialog is-show' + (opt.wide ? ' is-wide' : '') + (opt.card ? ' is-card' : '');
    dlgTitle.textContent = opt.title || '';
    dlgBody.innerHTML = (opt.lines || []).map((l) =>
      typeof l === 'string' ? '<p>' + escapeHtml(l) + '</p>' :
        l.cols ? '<p class="row ' + (l.cls || '') + '"><span>' + escapeHtml(l.cols[0]) + '</span><span>' + escapeHtml(l.cols[1]) + '</span></p>' :
        '<p class="' + (l.cls || '') + '">' + escapeHtml(l.text) + '</p>').join('');
    dlgButtons.innerHTML = '';
    for (const b of opt.buttons || []) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pixel-btn dlg-btn' + (b.primary ? ' is-primary' : '') + (b.sub ? ' dlg-sub' : '');
      el.innerHTML = escapeHtml(b.label) + (b.sub ? '<span>' + escapeHtml(b.sub) + '</span>' : '');
      el.disabled = !!b.disabled;
      el.addEventListener('click', () => {
        if (performance.now() - dlgShownAt < 450) return;                    // 開いた瞬間の「指のはなし」で、下のボタンを押してしまわない
        ensureAudio();
        if (!b.keepOpen) closeDialog();
        if (b.onClick) b.onClick();
      });
      dlgButtons.appendChild(el);
    }
    const first = dlgButtons.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });                          // フォーカスで、下までスクロールしない
    const card = dlg.querySelector('.dialog-card'); if (card) card.scrollTop = 0;       // いつも いちばん上から
  }
  function closeDialog() {
    dialogOpen = false;
    dlg.className = 'dialog';
  }
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2200);
  }
  const yen = (n) => n.toLocaleString('ja-JP') + '円';

  // =====================================================================
  //  DAY の流れ
  // =====================================================================
  function showDayIntro() {
    const p = P_();
    showDialog({
      title: 'DAY ' + p.day,
      lines: [
        { text: '今日もゲームセンターへ遊びに行こう！', cls: 'big' },
        { text: 'お小遣い +' + yen(ARC.dailyAllowance), cls: 'gold' },
        '💴 ' + yen(p.money) + '　🪙 MEDAL ' + hand
      ],
      buttons: [{ label: 'ゲームセンターへ', primary: true, onClick: () => { sfx.event(); } }]
    });
  }

  function canGoHome() {
    const d = D_();
    if (noMoneyNoMedal()) return true;
    if (d.paid) return true;                                                  // クレーン・音ゲーで ¥ を使って遊んだ日は、メダルを買わなくても帰れる
    if (ARC.leaveRequires.bought && !d.bought) return false;
    if (ARC.leaveRequires.played && !d.played) return false;
    return true;
  }
  const minExchange = () => Math.min(...ARC.exchange.map((e) => e.yen));
  const noMoneyNoMedal = () => hand <= 0 && P_().money < minExchange();

  function askGoHome() {
    if (!canGoHome()) {
      showDialog({
        title: '出口',
        lines: ['せっかく来たんだから、ちょっと遊んで行こう！'],
        buttons: [{ label: 'OK', primary: true }]
      });
      return;
    }
    showDialog({
      title: '今日はもう帰りますか？',
      lines: ['残りのお金は明日へ持ち越せます。', { text: '（メダルは持ち越せません）', cls: 'dim' },
        '💴 ' + yen(P_().money) + '　🪙 MEDAL ' + hand],
      buttons: [
        { label: '帰る', primary: true, onClick: () => autoDoorThen(() => startClosing(false)) },
        { label: 'まだ遊ぶ' }
      ]
    });
  }

  function showDayResult(tired) {
    const p = P_();
    const d = D_();
    const st = d.stats.piyo;
    p.records.arcade.days = Math.max(p.records.arcade.days, p.day);
    const sl = d.stats.slime;
    const du = d.stats.duck;
    const hm = d.stats.ham;
    const lk = d.stats.slot;
    const lines = [];
    if (tired) lines.push({ text: '今日はたっぷり遊んだ！', cls: 'big' });
    lines.push(
      { text: '💴使ったお金　' + yen(d.spent), cls: '' },
      { text: '💴残ったお金　' + yen(p.money) + '→明日へ！', cls: 'gold' },
      { text: '🪙 最高メダル　' + d.bestMedal + '枚', cls: '' }
    );
    if (st.coins > 0 || (sl.plays === 0 && du.races === 0 && hm.plays === 0 && lk.plays === 0)) {            // その日に遊んだ台だけを表示
      lines.push(
        { text: '🐥 PIYO ADVENTURE', cls: 'head' },
        { text: '最高LV　LV ' + st.maxLv + '　／　HUNT勝利　' + st.huntWins + '回', cls: '' },
        { text: 'BOSS　' + (st.bossDefeated ? '森の主撃破！' : (G.bossFound ? '発見したけどまだ…' : '？？？')), cls: st.bossDefeated ? 'gold' : '' }
      );
    }
    if (sl.plays > 0) {
      lines.push(
        { text: '⚔️ SLIME HUNT', cls: 'head' },
        { text: 'PLAY ' + sl.plays + '　WIN ' + sl.wins + '　LOSE ' + sl.losses, cls: '' },
        { text: '最高配当　' + (sl.bestWin > 0 ? sl.bestWin + '枚' : 'まだなし'), cls: sl.bestWin >= 20 ? 'gold' : '' }
      );
    }
    if (lk.plays > 0) {
      lines.push(
        { text: '🎰 LUCKY SLOT', cls: 'head' },
        { text: 'PLAY ' + lk.plays + '　WIN ' + lk.wins + (lk.red7 > 0 ? '　777 ' + lk.red7 + '回' : ''), cls: lk.red7 > 0 ? 'gold' : '' },
        { text: '最高配当　' + (lk.bestPayout > 0 ? lk.bestPayout + '枚' : 'まだなし'), cls: lk.bestPayout >= 15 ? 'gold' : '' }
      );
    }
    if (hm.plays > 0) {
      lines.push(
        { text: '🐹 HAM-CHAN PANIC!', cls: 'head' },
        { text: 'PLAY ' + hm.plays + '　SAFE ' + hm.safes + '　CRASH ' + hm.crashes, cls: '' },
        { text: '最高配当　' + (hm.bestPayout > 0 ? hm.bestPayout + '枚' : 'まだなし'), cls: hm.bestPayout >= 12 ? 'gold' : '' }
      );
    }
    if (du.races > 0) {
      lines.push(
        { text: '🦆 DUCK RACE', cls: 'head' },
        { text: 'RACE ' + du.races + '　WIN ' + du.wins, cls: '' },
        { text: '最高配当　' + (du.bestPayout > 0 ? du.bestPayout + '枚（×' + fmtOdds(du.bestOdds) + '）' : 'まだなし'), cls: du.bestPayout >= 20 ? 'gold' : '' }
      );
    }
    showDialog({
      title: 'DAY ' + p.day + ' RESULT',
      wide: true,
      lines,
      buttons: [{ label: '次の日へ', primary: true, onClick: nextDay }]
    });
    sfx.fanfare();
  }

  function nextDay() {                         // 翌日へ（DAYを進めて、開店の演出）
    advanceDay();
    startOpening();
  }

  // =====================================================================
  //  メダル貸出機
  // =====================================================================
  function openMedalMachine() {
    const p = P_();
    showDialog({
      title: 'MEDAL MACHINE',
      lines: ['💴 所持金 ' + yen(p.money) + '　🪙 MEDAL ' + hand],
      buttons: ARC.exchange.map((e) => ({
        label: yen(e.yen) + ' → ' + e.medals + ' MEDAL',
        disabled: p.money < e.yen,
        onClick: () => buyMedals(e)
      })).concat([{ label: 'やめる' }])
    });
  }

  // =====================================================================
  //  ピヨちゃん筐体の「その日の状態」の保存と再開
  // =====================================================================
  const defKeyOf = (def) => Object.keys(MONSTERS).find((k) => MONSTERS[k] === def) ||
    Object.keys(BOSSES).find((k) => BOSSES[k] === def);
  const r1 = (v) => Math.round(v * 10) / 10;

  function serializePiyo() {
    const ev = G.event;
    let evData = null;
    if (ev && ev.kind === 'battle') {
      evData = { kind: 'battle', boss: ev.boss, defKey: defKeyOf(ev.def), forced: ev.forced, gauge: ev.gauge,
        hp: ev.hp, maxHp: ev.maxHp, queue: ev.queue.slice() };
    } else if (ev && ev.kind === 'treasure' && !ev.done) {
      evData = { kind: 'treasure', gauge: 'treasure', pockets: ev.pockets.slice() };
    }
    // 空中や払い出し待ちのメダルは、再開したときにプッシャーへ払い出す（消えないように）
    const inflight = balls.length + falling.filter((f) => f.kind === 'drop' || f.kind === 'route').length + payoutQueue +
      (G.clear ? G.clear.queue.reduce((a, b) => a + b, 0) : 0);
    return {
      sg: SGM() ? sgSerialize() : null,
      gauge: Object.assign({}, G.gauge), piyo: Object.assign({}, G.piyo), exploreCount: G.exploreCount,
      bossFound: G.bossFound, bossCleared: G.bossCleared, pending: G.pending.slice(),
      state: G.state === 'AREA_CLEAR' ? 'AREA_CLEAR' : 'NORMAL', event: evData, won,
      coins: coins.map((c) => [r1(c.x), r1(c.y), c.level]),
      pusherCoins: pusherCoins.map((c) => [r1(c.x), r1(c.y)]),
      inflight
    };
  }

  function restorePiyo(d) {
    resetPiyoDay();
    if (SGM() && d.sg) sgRestore(d.sg);
    Object.assign(G.gauge, d.gauge || {});
    G.piyo = Object.assign(newPiyo(), d.piyo || {});
    G.exploreCount = d.exploreCount || 0;
    G.bossFound = !!d.bossFound;
    G.bossCleared = !!d.bossCleared;
    G.pending = (d.pending || []).slice();
    won = d.won || 0;
    if (d.coins) coins = d.coins.map(([x, y, level]) => newCoin(x, y, level));
    if (d.pusherCoins) pusherCoins = d.pusherCoins.map(([x, y]) => ({ x, y, hy: LIFT, level: 0 }));
    payoutQueue += d.inflight || 0;
    const e = d.event;
    if (e && e.kind === 'battle') {
      const def = e.boss ? BOSSES[e.defKey] : MONSTERS[e.defKey];
      if (def) {
        G.event = { kind: 'battle', boss: e.boss, def, forced: e.forced, gauge: e.gauge, hp: e.hp, maxHp: e.maxHp,
          queue: e.queue || [], phase: 'ready', timer: 0, piyoFx: 0, enemyFx: 0, piyoHitFx: 0, enemyHitFx: 0, done: false,
          pockets: (e.boss ? BATTLE_POCKETS.boss : BATTLE_POCKETS.normal).slice() };
        setState(e.boss ? 'BOSS_BATTLE' : 'BATTLE');
        setMessage(def.name + 'との戦いの続き！', C.text);
      }
    } else if (e && e.kind === 'treasure') {
      G.event = { kind: 'treasure', gauge: 'treasure', done: false, opened: false, pockets: e.pockets };
      setState('TREASURE');
      setMessage('TREASURE CHANCE の続き！', C.goldLight);
    } else if (d.state === 'AREA_CLEAR') {
      setState('AREA_CLEAR');
      G.clear = { queue: [], next: 0, done: true };
      setMessage('始まりの森 CLEAR！また明日遊ぼう', C.cyan);
    }
  }

  function piyoCanLeave(commit) {
    const ev = G.event;
    if (ev && ev.done) return false;                          // 勝ち負けの演出中
    if (G.state === 'AREA_CLEAR' && G.clear && !G.clear.done) return false;   // ごほうびの払い出し中
    if (commit && ev && ev.kind === 'explore') endEvent();    // 探索の演出は終わらせてから
    return true;
  }

  // =====================================================================
  //  ゲームセンター画面の描画（ドット絵）
  // =====================================================================
  let SLOTS = [
    { x: 22, y: 56 }, { x: 98, y: 56 }, { x: 22, y: 158 }, { x: 98, y: 158 }
  ];
  const CAB = { w: 60, h: 94 };
  let MEDAL_MACHINE = { x: 14, y: 250, w: 46, h: 80 };
  let RECORD_BOARD = { x: 52, y: 262, w: 38, h: 30 };
  let EXIT = { x: 92, y: 250, w: 34, h: 80 };
  // ワイド：2×2の筐体の間隔を広げ、記録ボード・出口・階段を、広い部屋に配置する（筐体・看板の大きさは そのまま）
  function centerRelayout() {
    const dx = W - 180; const hx = Math.round(dx / 2); const q = Math.round(dx * 0.25);
    SLOTS = [{ x: 22 + q, y: 56 }, { x: 98 + dx - q, y: 56 }, { x: 22 + q, y: 158 }, { x: 98 + dx - q, y: 158 }];
    MEDAL_MACHINE = { x: 14, y: 250, w: 46, h: 80 };
    RECORD_BOARD = { x: 52, y: 262, w: 38, h: 30 };                                                                      // RECORD：GACHA の右どなり
    { const gap = (W - 70) - 90; const ew = Math.max(34, Math.min(50, gap - 10)); EXIT = { x: Math.round((90 + (W - 70)) / 2 - ew / 2), y: 250, w: ew, h: 80 }; }                                         // 出口：RECORD とエレベーターの あいだの、自動ドア
  }
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  const animT = () => performance.now() / 1000;                                                                         // 5Fなど、メダルゲームの外でも進む、アニメーション用の時計
  const softPulse = (speed, phase) => 0.5 + 0.5 * Math.sin(centerT * speed + (phase || 0));

  function drawLabelArrow(cx, y, text) {
    const a = 0.45 + 0.4 * softPulse(2.2);
    ctx.globalAlpha = a;
    drawTextCenter(text, cx + 0.5, y, C.white, 1, '#2a1a40');
    ctx.globalAlpha = 1;
  }

  function drawCabinet(m, s, i) {
    const x = s.x;
    const y = s.y;
    const on = m.isUnlocked;
    const th = m.theme || { body: '#3a2470', side: '#5a3a9a', sign: '#c8a040', signText: '#3a1d00', bulb: '#fff3c0', bulbOff: '#8a6a20', buttons: ['#c8d0f0', '#7dd0ff', '#ffd040', '#ff8ef0'] };
    // 本体
    rect(x + 2, y + 10, CAB.w - 4, CAB.h - 10, on ? th.body : '#2a2438');
    rect(x + 2, y + 10, 2, CAB.h - 10, on ? th.side : '#38324a');
    // 看板
    rect(x, y, CAB.w, 12, on ? th.sign : '#3a3448');
    drawTextCenter(m.label, x + CAB.w / 2 + 0.5, y + 4, on ? th.signText : '#6a6480', 1);
    // 看板の電球（ゆっくり流れる）
    for (let k = 0; k < 6; k++) {
      const lit = on && (k + Math.floor(centerT * 2)) % 3 === 0;
      rect(x + 4 + k * 10, y + 1, 2, 1, lit ? th.bulb : (on ? th.bulbOff : '#4a4458'));
    }
    // 画面
    const sx = x + 8;
    const sy = y + 16;
    const sw = CAB.w - 16;
    const sh = 34;
    rect(sx - 1, sy - 1, sw + 2, sh + 2, '#120a24');
    if (on && m.machineId === 'slime') {
      // スライムハントの画面：夜の草原と、ゆっくり回るスライム
      rect(sx, sy, sw, sh, '#164a52');
      rect(sx, sy + 20, sw, sh - 20, '#1e6a5a');
      for (let a = 0; a < 360; a += 20) {
        const r = (a * Math.PI) / 180;
        rect(sx + sw / 2 + Math.sin(r) * 17, sy + 17 - Math.cos(r) * 10, 1, 1, '#58e0b0');
      }
      const ang = centerT * 0.7;
      ctx.imageSmoothingEnabled = true;             // 小さく表示するので、なめらかに縮める
      ['leaf', 'fire', 'aqua'].forEach((id, n) => {
        const a2 = ang + n * 2.1;
        drawSprite(SLIME_SPR[id], sx + sw / 2 + Math.sin(a2) * 17, sy + 17 - Math.cos(a2) * 10 - 2, 0.5);
      });
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i);
      rect(sx, sy, sw, sh, C.white);
      ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'star') {
      rect(sx, sy, sw, sh, '#070a24');
      for (let k = 0; k < 10; k++) rect(sx + ((k * 17 - centerT * 22 * (0.4 + (k % 3) * 0.3)) % sw + sw) % sw, sy + 2 + (k * 11) % (sh - 4), 1, 1, '#ffffff');
      for (let k = 0; k < 4; k++) drawStar(px(sx + ((k * 14 + 40 - centerT * 14) % (sw + 8) + sw + 8) % (sw + 8) - 4), sy + 8 + k * 6 + Math.round(Math.sin(centerT + k) * 2), '#ffd830');
      const shy = sy + 17 + Math.round(Math.sin(centerT * 1.6) * 9);
      rect(sx + 4, shy - 2, 10, 4, '#d8e0f0'); rect(sx + 14, shy - 1, 3, 2, '#ff5060'); rect(sx + 1, shy - 1, 3, 2, '#ff9a30');
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i); rect(sx, sy, sw, sh, C.white); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'fish') {
      rect(sx, sy, sw, sh, '#124a7a'); rect(sx, sy + sh - 6, sw, 6, '#c8a868');
      [['#ff9a4a', 9, 1], ['#7ad0ff', 20, -1], ['#ffd830', 27, 1]].forEach((f, n) => { const fx = sx + ((centerT * (6 + n * 3) * f[2] + n * 16) % (sw + 10) + sw + 10) % (sw + 10) - 5; rect(fx - 4, sy + f[1] - 2, 9, 5, f[0]); rect(fx - f[2] * 6, sy + f[1] - 1, 3, 3, f[0]); rect(fx + f[2] * 2, sy + f[1] - 1, 1, 1, '#10081a'); });
      rect(sx + sw / 2 - 1, sy, 2, 10 + Math.round(softPulse(0.9) * 8), '#e8e0c0');
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i); rect(sx, sy, sw, sh, C.white); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'bingo') {
      rect(sx, sy, sw, sh, '#4a0a10'); const dcx = sx + 15; const dcy = sy + 13; ctx.fillStyle = '#2a0a10'; ctx.beginPath(); ctx.arc(dcx, dcy, 11, 0, 6.28); ctx.fill(); ctx.fillStyle = '#5a1a20'; ctx.beginPath(); ctx.arc(dcx, dcy, 10, 0, 6.28); ctx.fill();
      for (let k = 0; k < 7; k++) { const a = centerT * (1.2 + (k % 3) * 0.4) + k * 0.9; ctx.fillStyle = ['#ff5a4a', '#ffd840', '#fff3d0'][k % 3]; ctx.beginPath(); ctx.arc(dcx + Math.cos(a) * 6, dcy + Math.sin(a * 1.1) * 5, 2, 0, 6.28); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dcx, dcy, 10, 0, 6.28); ctx.stroke(); rect(sx + 4, sy + 25, 22, 3, '#ffd840');
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const lit = (r * 3 + c === 4) || (((Math.floor(centerT * 0.8) + r * 2 + c) % 4) === 0); rect(sx + 29 + c * 7, sy + 5 + r * 7, 6, 6, lit ? '#ffd840' : '#fff3d0'); rect(sx + 31 + c * 7, sy + 7 + r * 7, 2, 2, lit ? '#8a1018' : '#c8b090'); }
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i); rect(sx, sy, sw, sh, C.white); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'ghost') {
      rect(sx, sy, sw, sh, '#140a2a');
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const hx = sx + 4 + c * 14; const hy = sy + 5 + r * 15; rect(hx, hy, 10, 11, '#060210'); if (((Math.floor(centerT * 0.9) + r * 2 + c) % 5) === 0) { rect(hx + 2, hy + 2, 6, 9, '#f4f0ff'); rect(hx + 3, hy + 4, 1, 2, '#2a1a3a'); rect(hx + 6, hy + 4, 1, 2, '#2a1a3a'); } }
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i); rect(sx, sy, sw, sh, C.white); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'pirate') {
      rect(sx, sy, sw, sh, '#58b0e8'); rect(sx, sy + 20, sw, 14, '#e8d090'); rect(sx, sy + 14, sw, 6, '#3a88c8');
      rect(sx + 12, sy + 14, 20, 14, '#8a5a30'); rect(sx + 12, sy + 10 - Math.round(softPulse(1.2) * 3), 20, 6, '#a07040'); rect(sx + 20, sy + 18, 4, 5, '#ffd040');
      ctx.globalAlpha = 0.5 + 0.4 * softPulse(2); drawStar(sx + 22, sy + 6, '#fff8c0'); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'train') {
      rect(sx, sy, sw, sh, '#7ac8f0'); rect(sx, sy + 20, sw, 14, '#5aa860'); rect(sx, sy + 26, sw, 2, '#d0d0e0');
      ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
      const tx = sx + ((centerT * 10) % (sw + 30)) - 24;
      rect(tx + 14, sy + 14, 10, 12, '#c83a3a'); rect(tx, sy + 17, 12, 9, '#e8c83a'); rect(tx - 14, sy + 17, 12, 9, '#3a78c8');
      ctx.restore();
      rect(sx + sw - 8, sy + 8, 2, 18, '#ff3040');
    } else if (on && m.machineId === 'balloon') {
      rect(sx, sy, sw, sh, '#7ad0f8'); rect(sx, sy + sh - 4, sw, 4, '#c88a4a');
      ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh - 4); ctx.clip();
      [['#ff5a6a', 10], ['#ffd84a', 22], ['#5ca8ff', 33], ['#ff8ef0', 16]].forEach((b, n) => { const by = sy + sh - 4 - ((centerT * (5 + n * 2) + n * 9) % (sh + 6)); const bx = sx + b[1] + Math.round(Math.sin(centerT + n) * 2); rect(bx - 3, by - 3, 7, 7, b[0]); rect(bx - 2, by - 4, 5, 1, b[0]); rect(bx, by + 4, 1, 4, '#ffffff'); });
      ctx.restore();
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i); rect(sx, sy, sw, sh, C.white); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'cosmo') {
      rect(sx, sy, sw, sh, '#0a0204');
      rect(sx, sy, sw, 1, '#ffd040'); rect(sx, sy + sh - 1, sw, 1, '#ffd040'); rect(sx, sy, 1, sh, '#ffd040'); rect(sx + sw - 1, sy, 1, sh, '#ffd040');
      const lampI = Math.floor(centerT * 3) % 8;
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 4;
        const dx = Math.round(sx + sw / 2 + Math.cos(a) * 13); const dy = Math.round(sy + sh / 2 + Math.sin(a) * 11);
        rect(dx - 2, dy - 2, 5, 5, k === lampI ? '#ffffff' : ['#6a0e18', '#b8801a', '#c8ced8', '#e01a30'][k % 4]);
      }
      rect(sx + sw / 2 - 4, sy + sh / 2 - 3, 9, 7, '#1a0408'); rect(sx + sw / 2 - 2, sy + sh / 2 - 1, 5, 3, '#ffd040');
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i); rect(sx, sy, sw, sh, C.white); ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'slot') {
      // LUCKY SLOT の画面：3つのリールが、ゆっくり回る
      rect(sx, sy, sw, sh, '#2a0610');
      ctx.imageSmoothingEnabled = true;
      for (let k = 0; k < 3; k++) {
        const wx = sx + 3 + k * 14;
        rect(wx, sy + 4, 12, 26, '#fff6dc');
        ctx.save();
        ctx.beginPath();
        ctx.rect(wx, sy + 4, 12, 26);
        ctx.clip();
        const spd = 1.4 + k * 0.5;
        const prog = centerT * spd;
        for (let q = -1; q <= 2; q++) {
          const sym = (((Math.floor(prog) + q + k * 2) % 6) + 6) % 6;
          ctx.drawImage(SL_SPR[sym].mini, wx, sy + 4 + (q + (prog % 1)) * 13 + 1, 12, 12);
        }
        ctx.restore();
      }
      ctx.imageSmoothingEnabled = false;
      rect(sx + 1, sy + 16, sw - 2, 1, '#ff3050');
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i);
      rect(sx, sy, sw, sh, C.white);
      ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'ham') {
      // ハムちゃんの画面：坑道を、トロッコがガタゴト進む
      rect(sx, sy, sw, sh, '#3a2c24');
      for (let k = 0; k < 4; k++) rect(sx + ((k * 17 - centerT * 14) % (sw + 6) + sw + 6) % (sw + 6) - 3, sy + 2, 3, sh - 8, '#7a5530');
      rect(sx, sy + sh - 7, sw, 2, '#d0d0e0'); rect(sx, sy + sh - 5, sw, 5, '#2a1e18');
      if (HM_MINI) ctx.drawImage(HM_MINI, px(sx + (sw - HM_MINI.width) / 2), px(sy + sh - 6 - HM_MINI.height + Math.round(Math.sin(centerT * 9) * 0.7)));
      ctx.globalAlpha = 0.07 + 0.04 * softPulse(1.3, i);
      rect(sx, sy, sw, sh, C.white);
      ctx.globalAlpha = 1;
    } else if (on && m.machineId === 'duck') {
      // ダックレースの画面：3羽が水路を、上へ向かってぷかぷか進む
      rect(sx, sy, sw, sh, '#1e5f9c');
      rect(sx, sy, 2, sh, '#b4d8f0'); rect(sx + sw - 2, sy, 2, sh, '#b4d8f0');
      ['takuan', 'torimomo', 'penguin'].forEach((id, n) => {
        const spr = DK_SPR[id];
        const gy = sy + sh - spr.mh - 2 - ((centerT * (3 + n * 1.5) + n * 11) % (sh - spr.mh - 4));
        ctx.drawImage(spr.mini, px(sx + 4 + n * 13), px(gy) + Math.round(Math.sin(centerT * 3 + n)));
      });
      rect(sx + 2, sy, sw - 4, 2, '#f4f8ff');
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i);
      rect(sx, sy, sw, sh, C.white);
      ctx.globalAlpha = 1;
    } else if (on) {
      rect(sx, sy, sw, sh, '#2a5a8a');
      rect(sx, sy + 22, sw, sh - 22, '#3f8a3f');
      const bob = Math.floor(centerT * 1.5) % 2;
      ctx.drawImage(CHAR_IDLE, px(sx + sw / 2 - 5), px(sy + 12 - bob));
      for (let k = 0; k < 3; k++) rect(sx + 3, sy + 3 + k * 4, 12, 2, ['#e8ecff', '#7dd0ff', '#ffd040'][k]);
      ctx.globalAlpha = 0.08 + 0.05 * softPulse(1.3, i);
      rect(sx, sy, sw, sh, C.white);
      ctx.globalAlpha = 1;
    } else {
      rect(sx, sy, sw, sh, '#151020');
      drawTextCenter('COMING', sx + sw / 2 + 0.5, sy + 10, '#4a4460', 1);
      drawTextCenter('SOON', sx + sw / 2 + 0.5, sy + 18, '#4a4460', 1);
    }
    if (on && D_().rec && D_().rec.active === m.machineId) {      // 📌 店長のおすすめ！（手書き風の張り紙）
      const bob = Math.round(softPulse(1.4) * 1);
      rect(x + 22, y - 6 + bob, 38, 15, '#6a5a20'); rect(x + 23, y - 5 + bob, 36, 13, '#fff3a0');
      rect(x + 38, y - 9 + bob, 4, 4, '#e03040');
      drawText('PICK UP!', x + 26, y - 2 + bob, '#c02030', 1);
    }
    // 操作盤とメダル口
    rect(x + 4, y + 54, CAB.w - 8, 10, on ? th.side : '#38324a');
    const btn = on ? th.buttons : ['#4a4458'];
    for (let k = 0; k < 4; k++) rect(x + 10 + k * 11, y + 57, 5, 4, on ? btn[k % btn.length] : '#4a4458');
    rect(x + CAB.w / 2 - 6, y + 70, 12, 8, '#120a24');
    if (on) drawCoinSprite(coinFull, x + CAB.w / 2, y + 74);
    // いす
    rect(x + CAB.w / 2 - 10, y + CAB.h - 2, 20, 4, on ? '#a03050' : '#3a3448');
    if (on) drawLabelArrow(x + CAB.w / 2, y + CAB.h - 12, 'PLAY');
  }

  function stepArcade(dt) {
    centerT += dt;
    if (!save) return;
    if (zoom) {
      zoom.t += dt;
      if (zoom.t >= ARC.zoomTime) {
        const z = zoom;
        zoom = null;
        if (z.dir === 'in') enterMachine(z.machine);
      }
    }
    if (floorFade) {
      floorFade.t += dt;
      if (!floorFade.done && floorFade.t >= floorFade.dur / 2) { floorFade.done = true; centerFloor = floorFade.to; D_().floor = centerFloor; writeSave(); }
      if (floorFade.t >= floorFade.dur) floorFade = null;
    }
    saveTimer += dt;
    if (saveTimer >= ARC.autosaveEvery) { saveTimer = 0; noteMedals(); writeSave(); }
    if (scene === 'center' && !dialogOpen && !zoom && !floorFade) recCheck();
    if (scene === 'center' && !dialogOpen && !zoom && noMoneyNoMedal() && save && D_().bought) showTired();
  }

  function beginLoaded(loaded) {                                // つづきから：同じDAY・同じ状態から
    save = loaded;
    hand = D_().medals || 0;
    for (const m of MACHINES) {
      if (!m.gameType) continue;
      GAME_TYPES[m.gameType].loadDaily(D_().machines[m.machineId]);
    }
    scene = 'b1';                                                  // つづきから：1F（PRIZE CORNER）から
    centerFloor = Math.min(FLOORS.length - 1, Math.max(0, D_().floor || 0));
    updateSceneUi();
  }
  function beginNew() {                                         // はじめる／はじめから：DAY 1 ＋ 初回の開店演出
    save = newSave();
    hand = 0;
    for (const m of MACHINES) if (m.gameType) GAME_TYPES[m.gameType].resetDaily();
    scene = 'center';
    centerFloor = 0;
    updateSceneUi();
    writeSave();
    startOpening();
  }
  function startArcade() { showTitle(); }

  standBtn.addEventListener('click', () => { ensureAudio(); askStand(); });
  if (helpBtn) helpBtn.addEventListener('click', () => { ensureAudio(); if (scene === 'machine' && !dialogOpen && currentMachine) showHelp(currentMachine); });
  window.addEventListener('pagehide', () => writeSave());
  document.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); });

