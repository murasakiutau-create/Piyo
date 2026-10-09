'use strict';
  // =====================================================================
  //  ピヨちゃんの すごろく版（WORLD 1「ピヨちゃんとはじまりの森」全50マス）
  //   通常は 🎲×4。止まったマスのイベントで、4ポケットが一時的に変わる。終わると 🎲 に戻る。
  //   CONFIG.adventure.sugoroku を false にすると、RPG版（HP・ATK・LV・ゲージ）に戻ります
  // =====================================================================
  const SGM = () => !!CONFIG.adventure.sugoroku;
  const SGC = CONFIG.sugoroku;
  const SG = { sq: 1, phase: 'idle', t: 0, ev: null, roll: 0, walkLeft: 0, queued: 0, dice: 'normal', laps: 0, autoRoll: 0, bonusRoll: false, payLeft: 0, payT: 0, feverNext: false, shake: 0, face: 1 };
  const sgTheme = (sq) => (sq <= 10 ? 'plains' : sq <= 20 ? 'forest' : sq <= 30 ? 'cave' : sq <= 40 ? 'castle' : 'volcano');
  const SG_COLORS = ['red', 'blue', 'yellow', 'green'];
  const SG_CNAME = { red: '赤', blue: '青', yellow: '黄', green: '緑' };
  const SG_ENEMY = {                                              // 敵（sprite は ENEMY のなまえ）
    slime: { name: 'SLIME', sprite: 'slime' }, mushroom: { name: 'KINOKO', sprite: 'mushroom' }, bat: { name: 'BAT', sprite: 'bat' },
    armor: { name: 'ARMOR', sprite: 'armor' }, golem: { name: 'GOLEM', sprite: 'golem' }, captain: { name: 'CAPTAIN', sprite: 'captain' }
  };
  // 50マスのデータ（t＝イベントの種類。他の数字は、そのイベントの設定）
  const SG_SQ = (() => {
    const o = {};
    const set = (n, t, x) => { o[n] = Object.assign({ t }, x || {}); };
    for (let i = 1; i <= 50; i++) set(i, 'none');
    set(1, 'start');
    Object.keys(SGC.rewards.medalSquares).forEach((n) => set(+n, 'medal', { medal: SGC.rewards.medalSquares[n] }));
    [5, 14, 36].forEach((n) => set(n, 'chest', { big: false })); [20, 27, 46].forEach((n) => set(n, 'chest', { big: true }));
    [[8, 'slime'], [13, 'mushroom'], [18, 'slime'], [25, 'bat'], [34, 'armor']].forEach(([n, e]) => set(n, 'battle', { enemy: e, hp: 3, strong: false, pay: SGC.rewards.battleNormal }));
    [[29, 'golem'], [37, 'captain'], [45, 'golem']].forEach(([n, e]) => set(n, 'battle', { enemy: e, hp: 5, strong: true, pay: SGC.rewards.battleStrong }));
    [10, 26, 38, 47].forEach((n) => set(n, 'chance'));
    [[11, '森へ'], [21, '洞窟へ'], [31, '古城へ'], [41, 'ドラゴンの山へ']].forEach(([n, name]) => set(n, 'area', { name }));
    set(30, 'area', { name: '洞窟の出口' });
    set(17, 'door', { need: 2, pay: SGC.rewards.door, pockets: ['leaf', 'key', 'leaf', 'key'] });
    set(23, 'color', { seq: ['blue', 'yellow', 'red'], pay: SGC.rewards.color[23] });
    set(33, 'door', { need: 3, pay: SGC.rewards.door, pockets: ['key', 'empty', 'key', 'empty'], keyDoor: true });
    set(39, 'color', { random: 3, pay: SGC.rewards.color[39], gate: true });
    set(40, 'boss', { enemy: 'golem', name: 'BIG GOLEM', hp: 7, mid: true, pay: SGC.rewards.midBoss });
    set(43, 'fire');
    set(48, 'color', { random: 4, pay: SGC.rewards.color[48], final: true });
    (SGC.rewards.luckySquares || []).forEach((n) => { if (o[n] && o[n].t === 'none') set(n, 'lucky'); });
    set(49, 'pre'); set(50, 'boss', { enemy: 'dragon', name: 'DRAGON', hp: 10, dragon: true });
    return o;
  })();
  const SG_MANDATORY = [40, 48, 49];                              // ボス・最終扉・ボス前は、飛ばさず必ず止まる
  const sgPay = (r) => (Array.isArray(r) ? randInt(r[0], r[1]) : r);

  // ---- ポケットの役割・見た目 ----
  function sgRoles() {
    if (G.state === 'GAME_OVER') return ['ring', 'ring', 'ring', 'ring'];
    const ev = SG.ev;
    if (ev) { if (ev.sub) return ev.sub.pockets; if (ev.pockets) return ev.pockets; }
    return ['dice', 'dice', 'dice', 'dice'];
  }
  function sgChange(back) { changePockets(back); }
  function sgEnterMessage() {                                      // 筐体に入ったとき
    const ev = SG.ev;
    if (ev && ev.rule) setMessage(ev.rule, C.yellow);
    else setMessage('マス ' + SG.sq + '：🎲を狙ってすごろくを進めよう！', C.cyan);
  }
  function sgReset() {
    SG.sq = 1; SG.phase = 'idle'; SG.t = 0; SG.ev = null; SG.roll = 0; SG.walkLeft = 0; SG.queued = 0; SG.dice = 'normal'; SG.laps = 0; SG.payLeft = 0; SG.feverNext = false; SG.autoRoll = 0; SG.bonusRoll = false;
    setMessage('🎲を狙って、すごろくを進めよう！（1マス目指せ 50マス）', C.cyan);
  }
  function sgSerialize() { return { sq: SG.sq, dice: SG.dice, laps: SG.laps, queued: SG.queued }; }
  function sgRestore(d) { SG.sq = d.sq || 1; SG.dice = d.dice || 'normal'; SG.laps = d.laps || 0; SG.queued = 0; setMessage('マス ' + SG.sq + 'から続き！', C.cyan); }

  // ---- 入賞 ----
  function sgPocket(role) {
    if (G.state === 'GAME_OVER') return;
    const ev = SG.ev;
    if (ev) { sgEventHit(ev, role); return; }
    if (role === 'dice') {
      if (SG.phase === 'idle') sgRollDice(); else if (SG.queued < 4) SG.queued++;       // 歩いている間に入ったぶんは、順番に振る
    }
  }
  function sgRollDice() {
    let n = randInt(1, 6);
    if (SG.dice === 'gold') n = randInt(4, 6); else if (SG.dice === 'special') n = 6;
    if (SG.dice !== 'normal') { floaterTV(SG.dice === 'gold' ? 'GOLD DICE!' : 'SPECIAL!', C.yellow, 'center'); SG.dice = 'normal'; }
    SG.roll = n; SG.phase = 'rolling'; SG.t = 0; tv.diceKind = SG.dice;
    G.react = null; sfx.good();
  }
  function sgStartWalk() {
    let target = Math.min(50, SG.sq + SG.roll);
    for (const m of SG_MANDATORY) if (SG.sq < m && target > m) { target = m; break; }
    SG.walkLeft = target - SG.sq; SG.phase = 'walk'; SG.t = 0;
    if (SG.walkLeft <= 0) { SG.phase = 'idle'; }
  }

  // ---- マスのイベント ----
  function sgArrive() {
    const d = SG_SQ[SG.sq];
    const bonus = SG.bonusRoll; SG.bonusRoll = false;                 // 「もう1回」で止まったときは、ラッキーを続けて発動しない
    G.sad = 0;
    const st = D_().stats.piyo; if (SG.sq > st.maxLv) st.maxLv = SG.sq;
    const rp = P_().records.piyo; if (SG.sq > rp.bestLv) rp.bestLv = SG.sq;
    const msg = (t, c) => setMessage('マス ' + SG.sq + '：' + t, c || C.text);
    const back = () => { SG.phase = 'idle'; SG.t = 0; };
    switch (d.t) {
      case 'none': msg(pick(SGC.rewards.blankLines), C.dim); return back();
      case 'lucky':
        if (bonus) { msg('ラッキーマス！…でももう1回は続けてもらえないよ', C.dim); return back(); }
        banner('LUCKY! 1MORE', C.yellow, 1.6); G.joy = 1.2; sfx.fanfare(); msg('ラッキー！もう1回サイコロを振れるよ！', C.goldLight);
        SG.autoRoll = 1.1; return back();
      case 'start': return back();
      case 'medal': addPayout(d.medal); G.joy = 1.2; banner('+' + d.medal + ' MEDAL', C.yellow, 1.4); msg('+' + d.medal + ' MEDAL！', C.goldLight); sfx.good(); return back();
      case 'area': banner(d.name.toUpperCase().length < 99 ? 'NEW AREA' : '', C.cyan, 1.8); msg(d.name + 'たどり着いた！', C.cyan); return back();
      case 'chest': return sgChanceEvent({ type: 'chest', big: d.big, pockets: SG_RING4() }, { name: 'TREASURE CHANCE!', tail: '（豪華な宝箱！）', done: sgChestResult }, d.big ? '大きな宝箱！ TREASURE CHANCE！' : '宝箱！ TREASURE CHANCE！');
      case 'door': return sgBegin({ type: 'door', need: d.need, pay: d.pay, got: 0, pockets: d.pockets.slice(), keyDoor: !!d.keyDoor }, (d.keyDoor ? '鍵付きの扉！' : '森の扉！') + '🔑に' + d.need + '回！');
      case 'battle': return sgBegin({ type: 'battle', enemy: SG_ENEMY[d.enemy], need: d.hp, hits: 0, hp: d.hp, maxHp: d.hp, strong: d.strong, pay: d.pay, pockets: ['attack', 'attack', 'power', 'empty'] }, (d.strong ? '強いてき！' : '') + SG_ENEMY[d.enemy].name + 'が現れた！');
      case 'color': {
        const seq = d.seq ? d.seq.slice() : shuffled(SG_COLORS).slice(0, d.random);
        return sgBegin({ type: 'color', seq, idx: 0, pay: d.pay, gate: d.gate, final: d.final, pockets: ['red', 'blue', 'yellow', 'green'] }, (d.final ? '最後の扉！' : d.gate ? '呪文！' : '') + seq.map((c) => SG_CNAME[c]).join(' → ') + 'の順に！');
      }
      case 'fire': return sgBegin({ type: 'fire', water: 0, pockets: ['water', 'fire', 'water', 'fire'] }, '炎が！💧に 3回！🔥は残念');
      case 'chance': return sgChanceEvent({ type: 'chance', pockets: SG_RING4() }, { name: 'CHANCE TIME!', done: sgBonusResult }, 'CHANCE TIME！');
      case 'boss': return sgBegin({ type: 'boss', enemy: SG_ENEMY[d.enemy] || { name: d.name, sprite: d.enemy }, name: d.name, hp: d.hp, maxHp: d.hp, mid: !!d.mid, dragon: !!d.dragon, pay: d.pay, chanceA: false, chanceD: false, pockets: ['attack', 'attack', 'power', 'empty'], dark: 0 }, d.name + 'が現れた！');
      case 'pre': SG.ev = { type: 'pre', t: 0, pockets: ['ring', 'ring', 'ring', 'ring'] }; sgChange(false); setMessage('この先に何かいる……！', C.pink); sfx.encounter(); SG.phase = 'event'; return undefined;
      default: return back();
    }
  }
  // ---- 共通チャンス：制限時間（6秒）のあいだに ⭐ へ2回。成功回数で報酬が変わる。⭐の位置はランダム（2回目は別のポケット） ----
  function sgChance2(ev, cfg) {
    const C2 = SGC.chance2;
    const mk = (avoid) => { const pk = ['ring', 'ring', 'ring', 'ring']; let i; do { i = randInt(0, 3); } while (i === avoid); pk[i] = 'critical'; return pk; };
    ev.chances = (ev.chances || 0) + 1;
    sgSub(ev, { name: cfg.name, rule: C2.time + '秒以内！⭐に' + C2.need + '回入れろ！', hint: 'STAR X' + C2.need, limit: C2.time, star: true, hits: 0, need: C2.need, gap: 0,
      intro: ev.chances > 1 ? 0.6 : C2.intro, cdTime: C2.countdown, pockets: mk(-1),
      onHit: (e, role) => {
        const sb = e.sub;
        if (sb.gap > 0 || role !== 'critical') return;
        sb.hits++; sfx.good();
        if (sb.hits >= sb.need) { sgSubEnd(e, sb.hits); return; }
        const cur = sb.pockets.indexOf('critical');
        sb.pockets = ['ring', 'ring', 'ring', 'ring']; sb.gap = C2.gap;              // 少し間をあけて、またねらう
        sb.next = () => { sb.pockets = mk(cur); pocketFlash[sb.pockets.indexOf('critical')] = 0.9; };
      },
      onEnd: (e, hits) => cfg.done(e, hits) });
  }
  function sgChanceEvent(ev, cfg, text) {                            // イベント名 → ルール説明 → 3,2,1,START! → 6秒チャンス
    ev.startChance = () => sgChance2(ev, cfg); ev.nextIn = 1.4;
    sgBegin(ev, text);
  }
  const SG_RING4 = () => ['ring', 'ring', 'ring', 'ring'];
  const sgGrade = (h) => (h >= 2 ? 'GREAT' : h === 1 ? 'GOOD' : 'MISS...');
  function sgBattleResult(e, h) {
    const pay = SGC.rewards.battle[e.strong ? 'strong' : 'normal'][h];
    if (pay > 0) addPayout(pay);
    e.won = true; floaterTV(h >= 2 ? 'GREAT!' : h === 1 ? 'GOOD' : 'MISS', h ? C.yellow : C.pink, 'enemy');
    banner(h >= 2 ? 'GREAT ATTACK!' : h === 1 ? 'ATTACK!' : 'MISS...', h ? C.yellow : C.pink, 1.5);
    if (h) { G.joy = 1.2; sfx.fanfare(); } else { G.sad = 0.8; sfx.miss(); }
    setMessage(e.enemy.name + 'を倒した！ HIT ' + h + '/2 → +' + pay + '枚', h ? C.goldLight : C.dim);
    sgEnd(e);
  }
  function sgBonusResult(e, h) {                                      // CHANCE TIME
    const R = SGC.rewards.chance;
    const pay = h >= 2 ? sgPay(SGC.chanceBonus) : h === 1 ? R.one : R.zero;
    addPayout(pay);
    banner(h >= 2 ? 'BONUS!' : h === 1 ? 'NICE!' : 'MISS...', h ? C.yellow : C.pink, 1.6);
    if (h) { G.joy = 1.4; sfx.fanfare(); } else { G.sad = 1.0; sfx.miss(); }
    setMessage('CHANCE TIME！ HIT ' + h + '/2 → +' + pay + '枚', h ? C.goldLight : C.dim);
    sgEnd(e);
  }
  function sgChestResult(e, h) {
    const R = SGC.rewards;
    const pickT = (table) => { const t = table.filter((x) => SGC.feverEnabled || x[0] !== 'fever'); let roll = Math.random() * t.reduce((a, x) => a + x[2], 0); for (const x of t) { roll -= x[2]; if (roll < 0) return x; } return t[t.length - 1]; };
    const F = e.big ? R.chestFixed.big : R.chestFixed.small;
    const r = ['medal', F[Math.min(2, h)], 1];                       // 通常宝箱3／⭐宝箱5／⭐⭐宝箱8（GOLD DICE などの表 chestSmall/chestBig は、いまは使わない）
    banner(h >= 2 ? 'GREAT!' : 'OPEN!', C.yellow, 1.6); sfx.fanfare(); G.joy = h ? 1.4 : 0.8;
    if (r[0] === 'medal') { addPayout(r[1]); setMessage('HIT ' + h + '/2　宝箱！ +' + r[1] + '枚', C.goldLight); }
    else if (r[0] === 'gold') { SG.dice = 'gold'; setMessage('HIT ' + h + '/2　GOLD DICE を手に入れた！次は 4〜6', C.goldLight); }
    else if (r[0] === 'special') { SG.dice = 'special'; setMessage('HIT ' + h + '/2　特別なサイコロ！次は必ず 6', C.goldLight); }
    sgEnd(e);
  }
  function sgBossResult(e, h) {                                       // ボス：チャンス1回ごとに ダメージと払い出し。HP0で撃破
    const B = e.dragon ? SGC.rewards.bossDragon : SGC.rewards.bossMid;
    if (B.pay[h] > 0) addPayout(B.pay[h]);
    e.hp = Math.max(0, e.hp - B.dmg[h]); e.hit = 0.3;
    if (B.dmg[h]) floaterTV('-' + B.dmg[h], C.white, 'enemy');
    banner(h >= 2 ? 'GREAT ATTACK!' : h === 1 ? 'ATTACK!' : 'MISS...', h ? C.yellow : C.pink, 1.4);
    if (h) sfx.fanfare(); else { G.sad = 0.8; sfx.miss(); }
    if (e.hp <= 0) return sgWinBattle(e);
    sgSay(e, 'HIT ' + h + '/2　' + B.dmg[h] + 'ダメージ！ +' + B.pay[h] + '枚　残り HP ' + e.hp, h ? C.goldLight : C.dim);
    return sgCheckChance(e);
  }
  function sgStarPockets() { const a = ['ring', 'ring', 'ring', 'ring']; a[randInt(0, 3)] = 'critical'; return a; }
  const SG_EMO = { red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢' };
  function sgRuleOf(ev) {                                          // そのイベントで「何を狙えばいいか」（1〜2行）
    switch (ev.type) {
      case 'battle': return '⚔️＝1HIT 💥＝2HIT！ ' + ev.need + 'HITで倒せる（❌は何も起きない）';
      case 'chest': return 'TREASURE CHANCE！⭐に 2回入れて豪華な宝箱に！';
      case 'door': return '🔑に' + ev.need + '回入れて扉を開けよう！';
      case 'color': return ev.seq.map((c) => SG_EMO[c]).join(' → ') + 'の順に入れよう！';
      case 'fire': return '💧に 3回入れて火を消そう！🔥は 1つ戻る';
      case 'boss': return '⚔️＝1 💥＝2ダメージ！途中で ATTACK CHANCE が来るよ';
      case 'fever': return 'ポケットに入るたびメダルGET！';
      default: return '';
    }
  }
  function sgSay(ev, text, color) { setMessage(text, color); if (ev) ev.back = 1.6; }       // 進み具合を少し見せて、ルール文に戻る
  function sgBegin(ev, text, onReady) {
    ev.t = 0; SG.ev = ev; SG.phase = 'event'; ev.rule = sgRuleOf(ev); ev.back = 1.8;
    sgChange(false); setMessage(text, C.yellow); sfx.encounter();
    if (ev.type !== 'chance') banner(ev.type === 'boss' ? ev.name : ev.type === 'battle' ? 'ENCOUNTER!' : ev.type === 'chest' ? 'TREASURE!' : ev.type === 'fire' ? 'FIRE!' : ev.type.toUpperCase() + '!', C.yellow, 1.4);
    if (onReady) onReady();
  }
  // 時間制限つきのサブ状態：3,2,1,START！ のあと、制限時間
  function sgSub(ev, sub) {
    ev.sub = Object.assign({ cd: 3, run: false, t: 0, left: sub.limit, intro: SGC.introTime }, sub);       // イベント名 → ルール説明 → 3,2,1,START！ → タイマー
    ev.ghost = ev.pockets; sgChange(false);
    banner(sub.name, C.pink, ev.sub.intro); sfx.event(); setMessage(sub.rule || '', C.pink);
  }
  function sgSubEnd(ev, ok) {
    const s = ev.sub; ev.sub = null; sgChange(true);
    s.onEnd(ev, s.need ? (typeof ok === 'number' ? ok : s.hits) : ok);             // 共通チャンスは、成功した回数（0/1/2）を渡す
  }
  function sgEnd(ev) {                                            // イベント終了 → 🎲 にもどる
    SG.ev = null; SG.phase = 'idle'; SG.t = 0; sgChange(true);
    if (SG.feverNext) { SG.feverNext = false; if (SGC.feverEnabled) sgFeverStart(); }
  }
  function sgFeverStart() {
    if (!SGC.feverEnabled) return;
    SG.ev = { type: 'fever', left: SGC.feverTime, pockets: ['critical', 'critical', 'critical', 'critical'], got: 0 }; SG.phase = 'event';
    SG.ev.rule = sgRuleOf(SG.ev);
    sgChange(false); banner('FEVER!!', C.pink, 1.8); setMessage('FEVER！ ' + SG.ev.rule, C.pink); sfx.fanfare();
  }

  function sgEventHit(ev, role) {
    if (ev.sub) {
      if (!ev.sub.run) return;
      ev.sub.onHit(ev, role); return;
    }
    switch (ev.type) {
      case 'fever': { const n = Math.min(Math.max(0, SGC.feverCap - ev.got), randInt(SGC.feverPay[0], SGC.feverPay[1])); if (n > 0) { addPayout(n); ev.got += n; floaterTV('+' + n, C.yellow, 'center'); } else if (!ev.capped) { ev.capped = true; floaterTV('MAX!', C.pink, 'center'); } sfx.good(); return; }
      case 'chest': case 'door':
        if (role === 'key') { ev.got++; sfx.good(); floaterTV('KEY ' + ev.got + '/' + ev.need, C.yellow, 'center'); if (ev.got >= ev.need) sgOpen(ev); else sgSay(ev, 'KEY ' + ev.got + '/' + ev.need + (ev.type === 'chest' ? '　MISS ' + ev.miss + '/' + ev.missMax : ''), C.text); }
        else if (ev.type === 'chest' && role === 'empty') {                  // ❌：宝箱は、失敗で消える（報酬なし）
          ev.miss++; sfx.miss(); SG.shake = 0.3; floaterTV('MISS ' + ev.miss + '/' + ev.missMax, C.pink, 'center');
          if (ev.miss >= ev.missMax) { banner('FAILED...', C.pink, 1.6); G.sad = 1.4; setMessage('残念！空っぽになっちゃった……', C.pink); sgEnd(ev); }
          else sgSay(ev, 'KEY ' + ev.got + '/' + ev.need + '　MISS ' + ev.miss + '/' + ev.missMax, C.pink);
        } else { sfx.miss(); SG.shake = 0.3; }
        return;
      case 'battle': case 'boss': return sgHitEnemy(ev, role);
      case 'color': {
        if (role === ev.seq[ev.idx]) {                           // 正しい色 → 1つ進む。ちがう色 → そのまま（もどらない）
          ev.idx++; sfx.good(); floaterTV('COLOR ' + ev.idx + '/' + ev.seq.length, C.yellow, 'center');
          if (ev.idx >= ev.seq.length) { const n = sgPay(ev.pay); addPayout(n); banner('CLEAR!', C.yellow, 1.6); setMessage((ev.final ? '最後の扉が開いた！' : '開いた！') + (n > 0 ? ' +' + n + '枚' : ''), C.goldLight); G.joy = 1.4; sfx.fanfare(); sgEnd(ev); }
          else sgSay(ev, 'COLOR ' + ev.idx + '/' + ev.seq.length + '　次は' + SG_CNAME[ev.seq[ev.idx]] + '！', C.text);
        } else { sfx.miss(); SG.shake = 0.3; floaterTV('違う！', C.pink, 'center'); }
        return;
      }
      case 'fire':
        if (role === 'water') { ev.water++; sfx.good(); floaterTV('WATER ' + ev.water + '/3', C.cyan, 'center'); if (ev.water >= 3) { const n = sgPay(SGC.rewards.fire); addPayout(n); banner('PUT OUT!', C.cyan, 1.6); setMessage('火を消した！' + (n > 0 ? ' +' + n + '枚' : ''), C.goldLight); G.joy = 1.4; sfx.fanfare(); sgEnd(ev); } else sgSay(ev, 'WATER ' + ev.water + '/3', C.text); }
        else { ev.water = Math.max(0, ev.water - 1); sfx.miss(); SG.shake = 0.3; floaterTV('あちち！', C.pink, 'center'); sgSay(ev, '🔥に入った…… WATER ' + ev.water + '/3', C.pink); }
        return;
      default:
    }
  }
  function sgOpen(ev) {
    if (ev.type === 'door') { const n = sgPay(ev.pay); addPayout(n); banner('OPEN!', C.yellow, 1.6); setMessage('扉が開いた！' + (n > 0 ? ' +' + n + '枚' : ''), C.goldLight); G.joy = 1.4; sfx.fanfare(); return sgEnd(ev); }
    const table = (ev.big ? SGC.rewards.chestBig : SGC.rewards.chestSmall).filter((t) => SGC.feverEnabled || t[0] !== 'fever');       // FEVER なしのときは、表から外す
    let roll = Math.random() * table.reduce((x, t) => x + t[2], 0); let r = table[table.length - 1];
    for (const t of table) { roll -= t[2]; if (roll < 0) { r = t; break; } }
    banner('OPEN!', C.yellow, 1.6); G.joy = 1.4; sfx.fanfare();
    if (r[0] === 'medal') { addPayout(r[1]); setMessage('宝箱！ +' + r[1] + '枚', C.goldLight); }
    else if (r[0] === 'gold') { SG.dice = 'gold'; setMessage('GOLD DICE を手に入れた！次は 4〜6が出るよ', C.goldLight); }
    else if (r[0] === 'special') { SG.dice = 'special'; setMessage('特別なサイコロ！次は必ず 6！', C.goldLight); }
    else { SG.feverNext = true; setMessage('FEVER だ！！', C.pink); }
    return sgEnd(ev);
  }
  function sgDefeat(ev) {                                          // 💀：その敵イベントは、そこで終わり（報酬なし）
    ev.sub = null; G.sad = 1.6; sfx.miss(); banner('DEFEAT...', C.pink, 1.8);
    setMessage('DEFEAT……ピヨちゃんは負けちゃった。報酬はなし', C.pink);
    sgEnd(ev);
  }
  function sgBattleHit(ev, role) {                                 // 通常敵・強敵：⚔️／💥 に入ると ATTACK CHANCE。入っただけでは、ダメージにならない
    if (role === 'skull') return sgDefeat(ev);
    const big = role === 'power';
    if (role !== 'attack' && !big) return undefined;
    const EC = SGC.enemyChance; const dmg = big ? 2 : 1; const lim = big ? EC.bigTime : EC.time;
    sgSub(ev, { name: big ? 'BIG ATTACK CHANCE!' : 'ATTACK CHANCE!', rule: lim + '秒以内！⭐に入れると' + dmg + 'ダメージ！', hint: 'HIT THE STAR!', limit: lim, star: true, intro: EC.intro, cdTime: EC.countdown, pockets: sgStarPockets(),
      onHit: (e, r) => { if (r === 'critical') sgSubEnd(e, true); },
      onEnd: (e, ok) => {
        if (ok) {
          e.hp = Math.max(0, e.hp - dmg); e.hit = 0.3; floaterTV('-' + dmg, C.white, 'enemy'); sfx.fanfare(); banner('ATTACK!!', C.yellow, 1.0);
          if (e.hp <= 0) return sgWinBattle(e);
          return sgSay(e, 'ATTACK!! 残り HP ' + e.hp, C.goldLight);
        }
        G.sad = 0.8; sfx.miss(); banner('MISS...', C.pink, 1.0);
        return sgSay(e, 'MISS……もう一度狙おう', C.dim);
      } });
    return undefined;
  }
  // ボス：⚔️／特殊攻撃 → ATTACK CHANCE（5秒）。⭐＝1ダメージ ／ 💥＝2ダメージ。最初に入ったポケットで、チャンスは終わり（○や時間切れは失敗）
  function sgBossHit(ev, role) {
    if (role === 'skull') { if (ev.dragon) { SG.sq = 49; } return sgDefeat(ev); }
    if (role !== 'attack' && role !== 'power' && role !== 'fire') return undefined;
    const lim = SGC.enemyChance.time;
    const pk = ['ring', 'ring', 'ring', 'ring']; const idx = shuffled([0, 1, 2, 3]); pk[idx[0]] = 'critical'; pk[idx[1]] = 'power';     // ⭐と💥の位置は、毎回ランダム
    sgSub(ev, { name: 'ATTACK CHANCE!', rule: lim + '秒以内！⭐＝1ダメージ／💥＝2ダメージ', hint: 'STAR=1  BLAST=2', limit: lim, star: true, intro: SGC.enemyChance.intro, cdTime: SGC.enemyChance.countdown, pockets: pk,
      onHit: (e, r) => sgSubEnd(e, r === 'critical' ? 1 : r === 'power' ? 2 : 0),
      onEnd: (e, dmg) => {
        if (dmg > 0) {
          e.hp = Math.max(0, e.hp - dmg); e.hit = 0.3; floaterTV('-' + dmg, C.white, 'enemy'); sfx.fanfare(); banner(dmg === 2 ? 'BIG ATTACK!' : 'ATTACK!', C.yellow, 1.2);
          if (e.hp <= 0) return sgWinBattle(e);
          sgSay(e, (dmg === 2 ? 'BIG ATTACK!! 2' : 'ATTACK! 1') + 'ダメージ！残り HP ' + e.hp, C.goldLight);
          return sgCheckChance(e);
        }
        G.sad = 0.8; sfx.miss(); banner('MISS...', C.pink, 1.0);
        return sgSay(e, '攻撃失敗……もう一度！', C.dim);
      } });
    return undefined;
  }
  function sgHitEnemy(ev, role) {
    {
      const dmgR = role === 'attack' ? 1 : role === 'power' ? 2 : 0;
      if (!dmgR) { sfx.miss(); SG.shake = 0.3; floaterTV('MISS', C.dim, 'enemy'); return; }       // ❌：なにも起きない（メダルは使っている）
      sfx.good(); ev.hit = 0.3; floaterTV('+' + dmgR, C.white, 'enemy');
      if (ev.type === 'battle') {
        ev.hits = Math.min(ev.need, ev.hits + dmgR); ev.hp = ev.need - ev.hits;
        if (ev.hits >= ev.need) return sgWinBattle(ev);
        sgSay(ev, 'HIT ' + ev.hits + '/' + ev.need, C.text); return undefined;
      }
      ev.hp = Math.max(0, ev.hp - dmgR);
      if (ev.hp <= 0) return sgWinBattle(ev);
      sgSay(ev, ev.name + 'に' + dmgR + 'ダメージ！残り HP ' + ev.hp, C.text);
      return sgCheckChance(ev);
    }
    let dmg = 0;
    if (role === 'attack') dmg = 1; else if (role === 'power') dmg = 2; else if (role === 'critical') dmg = 3; else if (role === 'fire') dmg = 2;
    if (role === 'skull') { ev.hp = Math.min(ev.maxHp, ev.hp + 1); floaterTV('+1', C.pink, 'enemy'); sfx.miss(); sgSay(ev, ev.enemy.name + 'が回復…… HP ' + ev.hp, C.pink); return; }
    if (!dmg) return;
    ev.hp = Math.max(0, ev.hp - dmg); ev.hit = 0.3; floaterTV('-' + dmg, C.white, 'enemy'); sfx.good();
    sgSay(ev, (ev.name || ev.enemy.name) + 'に' + dmg + 'ダメージ！残り' + ev.hp, C.text);
    if (ev.hp <= 0) return sgWinBattle(ev);
    sgCheckChance(ev);
  }
  function sgCheckChance(ev) {                                    // ボスの途中の、時間制限つき CHANCE（それぞれ一度だけ）。それ以外は、時間無制限でゆっくり
    if (ev.mid && !ev.chanceA && ev.hp <= Math.floor(ev.maxHp / 2)) { ev.chanceA = true; sgChance2(ev, { name: 'ATTACK CHANCE!', done: sgBossResult }); return; }
    if (ev.dragon && !ev.chanceD && ev.hp <= 7) {
      ev.chanceD = true;
      sgSub(ev, { name: 'DEFENSE CHANCE!', rule: SGC.bossChance + '秒以内！🛡️に入れて炎を防げ！', hint: 'HIT THE SHIELD!', limit: SGC.bossChance, pockets: ['shield', 'fire', 'shield', 'fire'], onHit: (e, role) => { if (role === 'shield') sgSubEnd(e, true); else { SG.shake = 0.3; sfx.miss(); } }, onEnd: (e, ok) => { if (ok) { banner('BLOCK!!', C.cyan, 1.6); G.joy = 1.2; sfx.fanfare(); setMessage('BLOCK！たてで炎を防いだ！', C.cyan); } else { e.hp = Math.min(e.maxHp, e.hp + 1); G.sad = 1.2; sfx.miss(); setMessage('熱い！ドラゴンの HPが 1 回復……', C.pink); } } });
      return;
    }
    if (ev.dragon && !ev.chanceA && ev.hp <= 4) { ev.chanceA = true; sgChance2(ev, { name: 'ATTACK CHANCE!', done: sgBossResult }); }
  }
  function sgWinBattle(ev) {
    if (ev.won && ev.type === 'battle' && ev.paid) return;
    ev.won = true; ev.paid = true;
    ev.sub = null; G.joy = 1.6; sfx.fanfare();
    if (ev.dragon) {                                              // WORLD CLEAR：50 MEDAL を 10枚ずつ 5回に分けて
      banner('WORLD CLEAR!', C.yellow, 3.0); setMessage('WORLD CLEAR！！おめでとう！' + SGC.worldClearPay + '枚！', C.goldLight);
      SG.payLeft = Math.ceil(SGC.worldClearPay / 10); SG.payT = 0; SG.ev = { type: 'clear', t: 0, pockets: ['ring', 'ring', 'ring', 'ring'] }; sgChange(false); return;
    }
    const n = sgPay(ev.pay); addPayout(n); banner('WIN! +' + n, C.yellow, 1.6); setMessage((ev.name || ev.enemy.name) + 'を倒した！ +' + n + '枚', C.goldLight);
    sgEnd(ev);
  }

  // ---- 毎フレーム ----
  function sgStep() {
    G.stateT += STEP;
    if (G.banner) { G.banner.t += STEP; if (G.banner.t > G.banner.dur) G.banner = null; }
    if (G.sad > 0) G.sad -= STEP;
    if (G.joy > 0) G.joy -= STEP;
    if (SG.shake > 0) SG.shake -= STEP;
    tv.flash *= 0.94;
    if (G.pocketFx) {
      G.pocketFx.t += STEP; const pc = CONFIG.pocketChange;
      if (G.pocketFx.t >= pc.dark + pc.step * 4 + 0.2) { if (G.pocketFx.back) for (let i = 0; i < pocketFlash.length; i++) pocketFlash[i] = 0.7; G.pocketFx = null; }
    }
    for (const f of tvFloaters) f.t += STEP;
    while (tvFloaters.length && tvFloaters[0].t > 1.0) tvFloaters.shift();
    SG.t += STEP;
    const ev = SG.ev;
    if (ev && ev.hit > 0) ev.hit -= STEP;
    if (ev && ev.nextIn > 0 && !ev.sub) { ev.nextIn -= STEP; if (ev.nextIn <= 0) ev.startChance(); return; }       // 次の6秒チャンスまでの少しの間
    if (ev && ev.back > 0) { ev.back -= STEP; if (ev.back <= 0 && !ev.sub && ev.rule) setMessage(ev.rule, C.yellow); }
    if (ev && (ev.type === 'battle' || ev.type === 'boss') && ev.hp <= 0 && !ev.won) { ev.won = true; sgWinBattle(ev); return; }
    if (ev && ev.type === 'clear') {
      ev.t += STEP; SG.payT += STEP;
      if (SG.payLeft > 0 && SG.payT >= 0.7) { SG.payT = 0; SG.payLeft--; addPayout(10); }
      if (SG.payLeft <= 0 && ev.t > 5) { SG.ev = null; SG.sq = 1; SG.laps++; SG.phase = 'idle'; sgChange(true); P_().records.piyo.worldClears = (P_().records.piyo.worldClears || 0) + 1; setMessage('もう一度 WORLD 1！マス1から！', C.cyan); }
      return;
    }
    if (ev && ev.type === 'pre') { ev.t += STEP; if (ev.t > 3.6) { SG.ev = null; SG.sq = 50; sgChange(true); sgArrive(); } return; }
    if (ev && ev.type === 'fever') { ev.left -= STEP; if (ev.left <= 0) { banner('FEVER END', C.cyan, 1.4); setMessage('FEVER 終わり！ +' + ev.got + '枚！', C.goldLight); sgEnd(ev); } return; }
    if (ev && ev.sub) {
      const s = ev.sub; s.t += STEP;
      if (!s.run) {                                               // ① イベント名＋ルール説明 → ② 3,2,1 → ③ START！でタイマー開始
        if (s.t < s.intro) return;
        const ct = s.cdTime || 3.0; const cd = s.t - s.intro; const c = 3 - Math.floor(cd / (ct / 3));
        if (c !== s.cdShown && c >= 1) { s.cdShown = c; beep(660, 0, 0.1, 0.05); }
        if (cd >= ct) { s.run = true; s.t = 0; banner('START!', C.green, 0.8); beep(1318, 0, 0.3, 0.06, 'square'); if (s.star) { const i = s.pockets.indexOf('critical'); pocketFlash[i] = 0.9; } }
        return;
      }
      if (s.gap > 0) { s.gap -= STEP; if (s.gap <= 0 && s.next) { s.next(); s.next = null; } }       // 1回成功したあと、ポケットがつぎの位置へ
      s.left -= STEP;
      const sec = Math.ceil(s.left);
      if (s.left <= 3 && sec !== s.lastTick) { s.lastTick = sec; beep(880, 0, 0.05, 0.05, 'square'); const i = s.pockets.findIndex((r) => r === 'critical' || r === 'shield'); if (i >= 0) pocketFlash[i] = 0.9; }
      if (s.left <= 0) sgSubEnd(ev, false);
      return;
    }
    if (SG.phase === 'rolling') {
      SG.face = 1 + (Math.floor(SG.t * 14) % 6);
      if (SG.t >= 1.0) { SG.face = SG.roll; if (SG.t >= 1.5) { banner('' + SG.roll, C.yellow, 0.7); sgStartWalk(); } }
    } else if (SG.phase === 'walk') {
      G.travel += STEP * 2.2;
      if (SG.t >= 0.4) { SG.t = 0; SG.sq++; SG.walkLeft--; beep(520, 0, 0.04, 0.03, 'square'); if (SG.walkLeft <= 0) sgArrive(); }
    } else if (SG.phase === 'idle' && !ev) {
      if (SG.autoRoll > 0) { SG.autoRoll -= STEP; if (SG.autoRoll <= 0) { SG.autoRoll = 0; SG.bonusRoll = true; sgRollDice(); } }      // ラッキー：無料のもう1回
      else if (SG.queued > 0 && SG.t > 0.5) { SG.queued--; sgRollDice(); }
    }
  }

  // ---- ピヨちゃんの足元の、すごろくのマス（いまの位置の前後が見える。歩くと、マスが流れる） ----
  const SG_TILE_COL = { plains: ['#9ac860', '#6a9a3a'], forest: ['#7a9a5a', '#4a6a3a'], cave: ['#8a7ac0', '#5a4a8a'], castle: ['#a0a0b8', '#6a6a82'], volcano: ['#e08a50', '#9a4a28'] };
  function sgTileIcon(d) {
    switch (d.t) {
      case 'battle': return d.strong ? ICONS.skull : ICONS.sword;
      case 'chest': case 'door': return ICONS.key;
      case 'lucky': return ICONS.leaf;
      case 'chance': return ICONS.star;
      case 'color': return ICONS.orb_red;
      case 'fire': return ICONS.fire;
      case 'boss': return d.dragon ? ICONS.fire : ICONS.skull;
      case 'pre': return ICONS.ring;
      default: return null;
    }
  }
  function drawSgBoard(cx) {
    const pitch = 15; const ty = GROUND_Y + 4;
    const pos = SG.sq + (SG.phase === 'walk' ? Math.min(1, SG.t / 0.4) : 0);
    rect(SCREEN.x, ty + 1, SCREEN.w, 6, 'rgba(10,6,24,0.35)');
    for (let n = Math.floor(pos) - 4; n <= Math.floor(pos) + 5; n++) {
      if (n < 1 || n > 50) continue;
      const x = cx + (n - pos) * pitch;
      if (x < SCREEN.x - 8 || x > SCREEN.x + SCREEN.w + 8) continue;
      const d = SG_SQ[n]; const cols = SG_TILE_COL[sgTheme(n)];
      if (n < 50) rect(Math.round(x + 5), ty + 3, pitch - 10, 2, '#e8d8a8');                 // 道
      const passed = n < SG.sq;
      ctx.globalAlpha = passed ? 0.55 : 1;
      rect(Math.round(x - 5), ty, 11, 8, '#2a1a40'); rect(Math.round(x - 4), ty + 1, 9, 6, cols[1]); rect(Math.round(x - 4), ty + 1, 9, 2, cols[0]);
      const ic = sgTileIcon(d);
      if (ic) ctx.drawImage(ic, px(x - 3), ty + 1);
      else if (d.t === 'medal') { rect(Math.round(x - 1), ty + 3, 3, 3, C.yellow); }
      else if (d.t === 'start') drawText('S', px(x - 1), ty + 2, C.white, 1);
      else if (d.t === 'area') rect(Math.round(x - 1), ty + 3, 3, 3, C.cyan);
      ctx.globalAlpha = 1;
      if (n === Math.round(pos) && SG.phase !== 'walk') { ctx.globalAlpha = 0.5 + 0.5 * pulse(3); rect(Math.round(x - 6), ty - 1, 13, 1, C.white); rect(Math.round(x - 6), ty + 8, 13, 1, C.white); ctx.globalAlpha = 1; }
    }
  }
  // ---- テレビの描画 ----
  function drawSugorokuScreen() {
    const ev = SG.ev;
    drawScenery(sgTheme(SG.sq), G.travel);
    const baseX = SCREEN.x + (ev && (ev.type === 'battle' || ev.type === 'boss') ? 20 : SCREEN.w / 2 - 2);
    let y = GROUND_Y - 9;                                          // 足元のマスが見えるよう、すこし上に
    let mode = 'idle';
    drawSgBoard(baseX + 1);
    if (SG.phase === 'walk') y -= Math.floor(time * 6) % 2;
    if (G.joy > 0) { mode = 'jump'; y -= Math.abs(Math.sin(time * 6)) * 5; }
    if (SG.shake > 0) y += Math.sin(time * 60) * 1;
    drawPiyo(baseX, y, mode);
    // サイコロ
    if (SG.phase === 'rolling') {
      const k = Math.min(1, SG.t / 1.0);
      const dx = SCREEN.x + SCREEN.w / 2 + (1 - k) * 30; const dy = GROUND_Y - 22 - Math.abs(Math.sin(SG.t * 9)) * 14 * (1 - k * 0.7);
      drawDice(SG.face, dx, dy, SG.t < 1.0 ? SG.t * 14 : 0);
      if (SG.t >= 1.0) drawTextCenter(String(SG.roll), dx + 0.5, dy - 16, C.yellow, 2, '#2a1a40');
    }
    if (ev) drawSgEvent(ev, baseX, y);
    drawFloaters(baseX, y - 10, SCREEN.x + SCREEN.w - 26, y - 10);
  }
  function sgBar(x, y, w, v, max, col) { rect(x, y, w, 4, '#2a2458'); rect(x, y, Math.round(w * v / max), 4, col); }
  function drawSgEvent(ev, baseX, y) {
    const cx = SCREEN.x + SCREEN.w - 26; const groundY = GROUND_Y + 3;
    const sprDraw = (spr, hitFx) => { if (spr) ctx.drawImage(spr, px(cx - spr.width / 2 + (hitFx > 0 ? Math.sin(hitFx * 40) * 2 : 0)), px(groundY - spr.height)); };
    if (ev.type === 'battle' || ev.type === 'boss') {
      const spr = ENEMY[ev.enemy.sprite] || ENEMY.slime; sprDraw(spr, ev.hit);
      sgBar(cx - 18, groundY - spr.height - 8, 36, ev.hp, ev.maxHp, C.pink); drawTextCenter(ev.type === 'battle' ? 'HIT ' + ev.hits + '/' + ev.need : 'HP ' + ev.hp, cx + 0.5, groundY - spr.height - 15, C.white, 1);
      ctx.drawImage(ICONS.sword, px(baseX + 8), px(y - 1));
    } else if (ev.type === 'chest') { sprDraw(ev.big ? ENEMY.bigchest : ENEMY.chest); void 0;
    } else if (ev.type === 'door') { sprDraw(ev.keyDoor ? ENEMY.gate : ENEMY.door); drawTextCenter('KEY ' + ev.got + '/' + ev.need, cx + 0.5, groundY - 36, C.yellow, 1);
    } else if (ev.type === 'fire') { sprDraw(ENEMY.flame); drawTextCenter('WATER ' + ev.water + '/3', cx + 0.5, groundY - 30, C.cyan, 1);
    } else if (ev.type === 'color') {
      const w = ev.seq.length * 12; const x0 = SCREEN.x + SCREEN.w / 2 - w / 2;
      rect(x0 - 3, MAP_TOP + 6, w + 5, 14, 'rgba(10,6,24,0.8)');
      ev.seq.forEach((c, i) => { ctx.globalAlpha = i < ev.idx ? 0.35 : 1; ctx.drawImage(ICONS['orb_' + c], px(x0 + i * 12), px(MAP_TOP + 9)); ctx.globalAlpha = 1; if (i === ev.idx) { ctx.globalAlpha = 0.5 + 0.5 * pulse(4); rect(x0 + i * 12 - 1, MAP_TOP + 18, 9, 1, C.white); ctx.globalAlpha = 1; } if (i < ev.idx) drawText('v', px(x0 + i * 12 + 1), px(MAP_TOP + 9), C.green, 1); });
      drawTextCenter('COLOR ' + ev.idx + '/' + ev.seq.length, SCREEN.x + SCREEN.w / 2, MAP_TOP + 22, C.yellow, 1);
    } else if (ev.type === 'fever') {
      drawTextCenter('FEVER!', SCREEN.x + SCREEN.w / 2, MAP_TOP + 8, C.pink, 2, '#2a1a40'); drawTextCenter('GET MEDALS!', SCREEN.x + SCREEN.w / 2, MAP_TOP + 24, C.white, 1); drawTextCenter(Math.ceil(ev.left) + 's  +' + ev.got, SCREEN.x + SCREEN.w / 2, MAP_TOP + 32, C.yellow, 1);
      for (let i = 0; i < 6; i++) drawStar(px(SCREEN.x + 10 + i * 16), px(MAP_TOP + 40 + ((time * 30 + i * 13) % 30)), C.yellow);
    } else if (ev.type === 'pre') {
      ctx.globalAlpha = Math.min(0.85, ev.t / 1.0); rect(SCREEN.x, MAP_TOP - 8, SCREEN.w, BAR_Y - MAP_TOP + 8, C.black); ctx.globalAlpha = 1;
      if (ev.t > 1.4) { rect(SCREEN.x + SCREEN.w - 32, GROUND_Y - 20, 5, 3, C.pink); rect(SCREEN.x + SCREEN.w - 22, GROUND_Y - 20, 5, 3, C.pink); }
      if (ev.t > 2.2) drawTextCenter('...!', SCREEN.x + SCREEN.w / 2, MAP_TOP + 10, C.white, 2);
    } else if (ev.type === 'clear') {
      drawTextCenter('WORLD CLEAR!', SCREEN.x + SCREEN.w / 2, MAP_TOP + 10, C.yellow, 1);
      for (let i = 0; i < 8; i++) drawStar(px(SCREEN.x + 6 + i * 13), px(MAP_TOP + 20 + Math.sin(time * 3 + i) * 6), [C.yellow, C.pink, C.cyan][i % 3]);
    }
    const s = ev.sub;
    if (s) {                                                      // 時間制限つき CHANCE の表示
      const tx = SCREEN.x + SCREEN.w / 2;
      rect(SCREEN.x, MAP_TOP + 4, SCREEN.w, 22, 'rgba(10,6,24,0.8)');
      if (!s.run) {
        if (s.t < s.intro) { drawTextCenter(s.hint, tx, MAP_TOP + 9, C.white, 1); }
        else drawTextCenter(String(Math.max(1, 3 - Math.floor((s.t - s.intro) / ((s.cdTime || 3) / 3)))), tx, MAP_TOP + 7, C.white, 3, '#2a1a40');
      }
      else {
        const sc = s.left <= 3 ? 3 : 2;
        drawTextCenter(String(Math.ceil(s.left)), tx, MAP_TOP + 7, s.left <= 3 ? C.pink : C.yellow, sc, '#2a1a40');
        drawTextCenter(s.need ? 'HIT ' + s.hits + '/' + s.need : (s.hint || s.name.replace('!', '')), tx, MAP_TOP + 28, s.need ? C.yellow : C.white, 1);
      }
    }
  }

  function drawTV() {
    // 本体（光るときは、ふちが やさしく明るくなるだけ）
    rect(TV.x, TV.y, TV.w, TV.h, C.tvBody);
    if (tv.flash > 0.05) {
      ctx.globalAlpha = tv.flash * 0.5;
      rect(TV.x, TV.y, TV.w, TV.h, C.goldLight);
      ctx.globalAlpha = 1;
    }
    rect(TV.x, TV.y, TV.w, 1, C.tvLight);
    rect(TV.x + 1, TV.y + TV.h - 8, TV.w - 2, 1, C.tvDark);
    rect(TV.x, TV.y + TV.h - 2, TV.w, 2, C.tvDark);
    rect(SCREEN.x - 1, SCREEN.y - 1, SCREEN.w + 2, SCREEN.h + 2, C.tvDark);
    rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h, C.tvScreen);
    for (let i = 0; i < 5; i++) rect(TV.x + 6 + i * 3, TV.y + TV.h - 5, 1, 1, C.tvDark);
    rect(TV.x + TV.w - 14, TV.y + TV.h - 6, 3, 3, C.pink);
    rect(TV.x + TV.w - 9, TV.y + TV.h - 6, 3, 3, C.cyan);

    ctx.save();
    ctx.beginPath();
    ctx.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    ctx.clip();

    const ev = G.event;
    if (SGM()) drawSugorokuScreen();
    else if (G.state === 'AREA_CLEAR') drawClearScreen();
    else if (ev && ev.kind === 'battle') drawBattleScreen(ev);
    else if (ev && ev.kind === 'explore') drawExploreScreen(ev);
    else if (ev && ev.kind === 'treasure') drawTreasureScreen(ev);
    else drawAdventureScreen();

    // 中央の大きな文字（点滅させずに、すっと出す）
    if (G.banner) {
      const b = G.banner;
      const scale = b.text.length > 9 ? 1 : 2;
      const y = MAP_TOP + 31;
      ctx.globalAlpha = Math.min(1, b.t / 0.15, (b.dur - b.t) / 0.3);
      rect(SCREEN.x, y - 3, SCREEN.w, 5 * scale + 6, 'rgba(10,6,24,0.8)');
      drawTextCenter(b.text, SCREEN.x + SCREEN.w / 2, y, b.color, scale, '#2a1a40');
      ctx.globalAlpha = 1;
    }

    // 上の帯：エリア名とボス
    rect(SCREEN.x, SCREEN.y, SCREEN.w, 9, '#120c2a');
    let title = area().label;
    if (SGM()) {                                                     // すごろく版：マス数と進み具合
      drawText('WORLD1  ' + SG.sq + '/50', SCREEN.x + 3, SCREEN.y + 2, SG.ev ? C.yellow : '#8aa0d0', 1);
      rect(SCREEN.x + 62, SCREEN.y + 3, 38, 3, '#2a2458'); rect(SCREEN.x + 62, SCREEN.y + 3, Math.round(38 * SG.sq / 50), 3, C.yellow);
      if (SG.dice !== 'normal') drawStar(SCREEN.x + 56, SCREEN.y + 5, C.yellow);
      if (SG.queued > 0) drawText('x' + SG.queued, SCREEN.x + SCREEN.w - 12, SCREEN.y + 2, C.cyan, 1);
    } else {
    if (ev && ev.kind === 'battle') title = ev.boss ? 'BOSS BATTLE' : 'BATTLE';
    else if (ev && ev.kind === 'treasure') title = 'TREASURE';
    else if (ev && ev.kind === 'explore') title = 'EXPLORE';
    drawText(title, SCREEN.x + 3, SCREEN.y + 2, ev ? C.yellow : '#8aa0d0', 1);
    if (!(ev && ev.kind === 'battle' && ev.boss)) {
      const bt = G.bossCleared ? 'BOSS OK' : G.bossFound ? 'BOSS !' : 'BOSS ???';
      drawText(bt, SCREEN.x + SCREEN.w - textWidth(bt, 1) - 3, SCREEN.y + 2, G.bossFound && !G.bossCleared ? C.pink : '#8aa0d0', 1);
    }
    }

    // 下の帯（日本語メッセージは HTML で上に重ねて表示）
    rect(SCREEN.x, BAR_Y, SCREEN.w, SCREEN.y + SCREEN.h - BAR_Y, '#120c2a');
    rect(SCREEN.x, BAR_Y, SCREEN.w, 1, '#3a2d5a');

    // 走査線
    ctx.globalAlpha = 0.1;
    for (let y = SCREEN.y; y < SCREEN.y + SCREEN.h; y += 2) rect(SCREEN.x, y, SCREEN.w, 1, C.black);
    ctx.globalAlpha = 1;
    ctx.restore();

    // 払い出し口
    rect(TV.x + 8, SLOT_Y - 1, TV.w - 16, 4, '#0a0618');
    rect(TV.x + 8, SLOT_Y - 1, TV.w - 16, 1, payoutQueue > 0 ? C.yellow : C.goldDark);
  }

  // 日本語メッセージ欄の位置を、キャンバスの拡大率に合わせる
  function layoutMessage() {
    if (!msgEl) return;
    const r = canvas.getBoundingClientRect();
    const host = screenEl.getBoundingClientRect();
    const border = 4;
    const sc = (r.width - border * 2) / CW;
    const woff = wideOff();
    // ピヨちゃん筐体はテレビの下、スライムハントは画面の下に、日本語のメッセージを重ねる
    const gtBox = currentMachine && GAME_TYPES[currentMachine.gameType];
    const box = currentMachine && currentMachine.gameType === 'slimeHunt'
      ? SLIME_MSG_BOX
      : gtBox && gtBox.msgBox ? gtBox.msgBox()
      : { x: SCREEN.x, y: BAR_Y + 1, w: SCREEN.w, h: SCREEN.y + SCREEN.h - BAR_Y - 1 };
    msgEl.style.left = (r.left - host.left + border + (box.x + woff) * sc) + 'px';
    msgEl.style.top = (r.top - host.top + border + box.y * sc) + 'px';
    msgEl.style.width = (box.w * sc) + 'px';
    msgEl.style.height = (box.h * sc) + 'px';
    msgEl.style.fontSize = Math.max(9, 6.2 * sc) + 'px';
    hmLayoutButtons();
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'craneGame') crLayoutButtons();
  }


  function drawField() {
    const f = FIELD;
    ctx.drawImage(floorCanvas, f.left, f.top);

    // プッシャー（上面の板）。模様は板と一緒に動く
    const front = px(f.front);
    rect(f.left, f.top, f.right - f.left, front - f.top, C.pusher);
    for (let y = front - 7; y > f.top; y -= 8) rect(f.left, y, f.right - f.left, 1, '#5d6198');
    for (let x = f.left + 6; x < f.right - 4; x += 16) {
      for (let y = front - 11; y > f.top + 1; y -= 16) rect(x, y, 2, 2, C.pusherDark);
    }
    rect(f.left, front - 1, f.right - f.left, 1, C.pusherLight);

    // プッシャーの上のコイン
    const onTop = pusherCoins.slice().sort((a, b) => a.y - b.y);
    for (const c of onTop) drawCoinSprite(coinFull, c.x, c.y - LIFT);

    // プッシャーの前面（警告ストライプ）
    for (let x = f.left; x < f.right; x += 8) {
      rect(x, front, 4, FACE, C.yellow);
      rect(x + 4, front, 4, FACE, C.pusherDark);
    }
    rect(f.left, front + FACE, f.right - f.left, 1, C.black);

    // 奥の固定板（ここでプッシャー上のコインが止まる）
    rect(f.left - 6, f.top - 6, f.right - f.left + 12, 6, C.wallDark);
    rect(f.left - 6, f.top - 6, f.right - f.left + 12, 1, C.wallLight);
    for (let x = f.left; x < f.right; x += 12) rect(x + 4, f.top - 4, 4, 2, C.wall);
    rect(f.left, f.top, f.right - f.left, 1, C.black);

    // 側壁
    for (const x of [f.left - 6, f.right]) {
      rect(x, f.top - 2, 6, f.edge - f.top + 4, C.wall);
      rect(x + 1, f.top - 2, 1, f.edge - f.top + 4, C.wallLight);
      rect(x + 5, f.top - 2, 1, f.edge - f.top + 4, C.wallDark);
    }

    // 1枚目 → 2枚目の順に、奥から描く
    const sorted = coins.slice().sort((a, b) => (a.level - b.level) || (a.y - b.y));
    for (const c of sorted) drawCoinSprite(coinFull, c.x, c.y - c.hy);

    // キラッと光る
    if (sparkle && sparkle.t < 0.45 && (coins.indexOf(sparkle.c) >= 0 || pusherCoins.indexOf(sparkle.c) >= 0)) {
      const sx = px(sparkle.c.x - 2);
      const sy = px(sparkle.c.y - sparkle.c.hy - 3);
      rect(sx, sy - 2, 1, 5, C.white);
      rect(sx - 2, sy, 5, 1, C.white);
    }

    // 手前の縁（獲得ライン）
    rect(f.left + LOST_W, f.edge, f.right - f.left - LOST_W * 2, 2, C.yellow);
    rect(f.left, f.edge, LOST_W, 2, '#e83050');
    rect(f.right - LOST_W, f.edge, LOST_W, 2, '#e83050');
  }

  function drawTray() {
    const f = FIELD;
    const h = H - 10 - (f.edge + 2);
    rect(f.left - 6, f.edge + 2, f.right - f.left + 12, h, '#120b28');
    rect(f.left + LOST_W, f.edge + 2, f.right - f.left - LOST_W * 2, h - 4, '#1d1440');
    if (flash > 0.05) {                       // 獲得したときは、やさしく明るくなるだけ
      ctx.globalAlpha = flash * 0.18;
      rect(f.left + LOST_W, f.edge + 2, f.right - f.left - LOST_W * 2, h - 4, C.yellow);
      ctx.globalAlpha = 1;
    }
    drawTextCenter('WIN', W / 2, f.edge + 7, C.goldDark, 2);
    // 左右の ×（LOST）
    for (const x of [f.left, f.right - LOST_W]) {
      rect(x, f.edge + 2, LOST_W, h - 4, '#0a0414');
      drawTextCenter('X', x + LOST_W / 2 + 0.5, f.edge + 7, '#e83050', 2);
    }
  }

  function drawFalling(kinds) {
    for (const f of falling) {
      if (kinds.indexOf(f.kind) < 0) continue;
      if (f.kind === 'route' && f.t < 0) continue;   // ポケットの中にいる間は見えない
      const frame = spinFrames[Math.floor(Math.abs(f.t) * 30) % spinFrames.length];
      if (f.kind === 'lost') ctx.globalAlpha = 0.6;
      const near = f.kind === 'drop' && f.t / f.dur > 0.85;
      drawCoinSprite(near ? coinFull : frame, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawEffects() {
    for (const p of particles) {
      rect(p.x, p.y, p.size, p.size, p.color);
    }
    for (const o of orbs) {
      const k = Math.min(1, o.t / o.dur);
      const x = o.x0 + (o.x1 - o.x0) * k;
      const y = o.y0 + (o.y1 - o.y0) * k - Math.sin(Math.PI * k) * 14;
      rect(x - 1, y - 1, 3, 3, C.white);
      drawStar(px(x), px(y), o.color);
    }
    for (const fl of floaters) {
      const y = fl.y - fl.t * 26;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, fl.t - 0.4) * 2.5);
      drawTextCenter('+1', fl.x, y, C.goldLight, 2, C.goldEdge);
      ctx.globalAlpha = 1;
    }
  }

  function drawGameOver() {
    if (!gameOver) return;
    ctx.globalAlpha = 0.75;
    rect(8, 8, W - 16, H - 16, C.black);
    ctx.globalAlpha = 1;
    const y0 = 140;
    rect(20, y0, W - 40, 72, C.frame);
    rect(22, y0 + 2, W - 44, 68, '#1a1236');
    drawTextCenter('GAME OVER', W / 2, y0 + 12, C.pink, 3, C.black);
    drawTextCenter('TOTAL WIN', W / 2, y0 + 40, C.dim, 1);
    drawTextCenter(String(won), W / 2, y0 + 50, C.goldLight, 3, C.goldEdge);
  }

  function render() {
    drawFrame();
    drawBoard();
    drawBalls();
    drawChutesBack();
    drawField();
    drawFalling(['drop']);
    drawChutesFront();
    drawTV();
    drawFalling(['route']);   // テレビの前面ガラスの上をすべり落ちる
    drawTray();
    drawFalling(['win', 'lost']);
    drawRail();
    drawHud();
    drawEffects();
    drawGameOver();
  }

