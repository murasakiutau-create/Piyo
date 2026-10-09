'use strict';
  // =====================================================================
  //  スマートボール盤面
  // =====================================================================
  const pins = [];
  function buildPins() {
    pins.length = 0;
    const p = CONFIG.pins;
    for (let row = 0; row < p.rows; row++) {
      const y = p.top + row * p.dy;
      const offset = row % 2 === 0 ? 0 : p.dx / 2;
      for (let x = BOARD.left + p.margin + offset; x <= BOARD.right - p.margin + 0.1; x += p.dx) {
        pins.push({ x, y, flash: 0 });
      }
    }
    for (const [x, y] of p.extra) pins.push({ x, y, flash: 0 });
    for (const [x, y] of p.remove) {
      let best = -1;
      let bestD = 9;
      pins.forEach((pin, i) => {
        const d = Math.hypot(pin.x - x, pin.y - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) pins.splice(best, 1);
    }
    // ポケットの両側の柱（ピンと同じように跳ね返る）
    for (const cx of POCKETS.centers) {
      pins.push({ x: cx - POCKETS.half, y: POCKETS.y, flash: 0, post: true });
      pins.push({ x: cx + POCKETS.half, y: POCKETS.y, flash: 0, post: true });
      if (POCKETS.guardPin) pins.push({ x: cx, y: POCKETS.y - POCKETS.guardY, flash: 0, guard: true });
    }
    // 柱や守りのピンの近くにある普通のピンは取り除く（メダルが挟まる「かご」を作らないため）
    const need = (BOARD.ballR + CONFIG.pins.radius) * 2 + 1.5;
    const special = pins.filter((pin) => pin.post || pin.guard);
    for (let i = pins.length - 1; i >= 0; i--) {
      const pin = pins[i];
      if (pin.post || pin.guard) continue;
      if (special.some((sp) => Math.hypot(sp.x - pin.x, sp.y - pin.y) < need)) pins.splice(i, 1);
    }
  }
  buildPins();
  const pocketFlash = POCKETS.centers.map(() => 0);

  function dropBall(x, free) {
    balls.push({
      x: clamp(x, BOARD.left + BOARD.ballR, BOARD.right - BOARD.ballR),
      y: BOARD.top + BOARD.ballR + 1,
      vx: rand(-BOARD.dropJitter, BOARD.dropJitter),
      vy: 0.4,
      free: !!free
    });
  }

  function stepBoard() {
    const r = BOARD.ballR;
    const pr = CONFIG.pins.radius;
    const minD = r + pr;
    const sub = BOARD.substeps;
    for (let s = 0; s < sub; s++) {
      for (const b of balls) {
        b.vy += BOARD.gravity / sub;
        b.vx *= BOARD.airDrag;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > BOARD.maxSpeed) {
          b.vx *= BOARD.maxSpeed / sp;
          b.vy *= BOARD.maxSpeed / sp;
        }
        b.x += b.vx / sub;
        b.y += b.vy / sub;
        if (b.x < BOARD.left + r) { b.x = BOARD.left + r; b.vx = Math.abs(b.vx) * BOARD.wallBounce; }
        if (b.x > BOARD.right - r) { b.x = BOARD.right - r; b.vx = -Math.abs(b.vx) * BOARD.wallBounce; }
        if (b.ghost) continue; // 長く止まったメダルはピンをすり抜けて落ちる（最後の安全策）
        for (const p of pins) {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD) continue;
          const d = Math.sqrt(d2) || 0.01;
          const nx = dx / d;
          const ny = dy / d;
          b.x = p.x + nx * minD;
          b.y = p.y + ny * minD;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0) {
            const k = (1 + CONFIG.pins.bounce) * vn;
            b.vx -= k * nx;
            b.vy -= k * ny;
            b.vx += rand(-CONFIG.pins.jitter, CONFIG.pins.jitter);
            p.flash = 1;
            sfx.pin();
          }
        }
      }
      // メダル同士の押し合い
      const dd = r * 2;
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i];
          const b = balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= dd * dd || d2 < 0.0001) continue;
          const d = Math.sqrt(d2);
          const push = (dd - d) * 0.5 * BOARD.ballBallPush;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }

    // 引っかかり防止：ほとんど動かないメダルは横へはじく
    const U = CONFIG.unstuck;
    for (const b of balls) {
      b.age = (b.age || 0) + STEP;
      if (Math.hypot(b.vx, b.vy) < U.speed) b.still = (b.still || 0) + STEP;
      else b.still = 0;
      if (b.still > U.time) {
        b.kicks = (b.kicks || 0) + 1;
        b.vx += (Math.random() < 0.5 ? -1 : 1) * U.kick * Math.min(3, b.kicks);
        b.vy -= 0.3;
        b.still = 0;
        if (b.kicks > U.maxKicks) b.ghost = true;
      }
    }

    // ポケット判定・最下部判定
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.y >= POCKETS.y + 3) {
        const hit = POCKETS.centers.findIndex((cx) => Math.abs(b.x - cx) < POCKETS.half);
        if (hit >= 0) {
          balls.splice(i, 1);
          onPocket(hit, b);
          continue;
        }
      }
      if (b.y >= BOARD.bottom - r) {
        balls.splice(i, 1);
        routeToPusher(b.x, GUTTER_Y, 0);  // 入賞しなかったメダルもプッシャーへ
      }
    }
    for (const p of pins) p.flash *= 0.85;
    for (let i = 0; i < pocketFlash.length; i++) pocketFlash[i] *= 0.94;
  }

  // 盤面の下 → そのまま真下へ（テレビの上もすべり落ちて）→ プッシャーの上へ
  function routeToPusher(x, y, delay) {
    const x1 = clamp(x + rand(-2, 2), FIELD.left + R, FIELD.right - R);
    falling.push({
      kind: 'route', x, y, x0: x, y0: y, x1,
      y1: rand(FIELD.top + R, FIELD.top + R + 8), t: -delay, dur: 0.62
    });
  }


  function onPocket(index, ball) {
    stats.pocketed++;
    stats.lastPocket = index;
    lastActivity = time;
    pocketFlash[index] = 1;
    sfx.pocket();
    const cx = POCKETS.centers[index];
    const roleColor = ROLES[currentRoles()[index]].color;
    spawnBurst(cx, POCKETS.y + 2, 10, [C.white, roleColor, C.goldLight], 0.8);
    // テレビへ視線を誘導する光
    orbs.push({ x0: cx, y0: POCKETS.y, x1: TV.x + TV.w / 2, y1: TV.y + 8, t: 0, dur: 0.35, color: roleColor });
    // いまのポケットの役割に応じて処理（サイコロ・攻撃・カギ など）
    handlePocket(currentRoles()[index]);
    // 入賞したメダルも、少し待ってから別ルートでプッシャーへ
    routeToPusher(ball.x, POCKETS.y + 4, POCKETS.holdTime);
  }

  function stepOrbs() {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.t += STEP;
      const k = Math.min(1, o.t / o.dur);
      const x = o.x0 + (o.x1 - o.x0) * k;
      const y = o.y0 + (o.y1 - o.y0) * k - Math.sin(Math.PI * k) * 14;
      particles.push({ x, y, vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), life: 0.25, max: 0.25, size: 1, color: o.color });
      if (k >= 1) {
        orbs.splice(i, 1);
        tv.flash = 1;
      }
    }
  }

  // =====================================================================
  //  冒険の進行
  //  state: NORMAL / HUNT_INTRO / BATTLE / HUNT_WIN / HUNT_LOSE / EXPLORE /
  //         TREASURE / RANDOM_EVENT / BOSS_INTRO / BOSS_BATTLE / BOSS_WIN /
  //         BOSS_LOSE / AREA_CLEAR / GAME_OVER
  // =====================================================================
  const P = CONFIG.piyo;
  const G = {
    state: 'NORMAL', stateT: 0,
    gauge: { hunt: 0, explore: 0, treasure: 0 },
    gaugeFx: { hunt: 0, explore: 0, treasure: 0 },
    pending: [],          // MAXになって順番待ちのイベント
    cool: 0,
    event: null,          // いま起きているイベント
    piyo: null,           // { lv, hp, maxHp, atk, atkBonus, exp }
    exploreCount: 0,      // EXPLORE の段階（4でボス発見）
    bossFound: false,
    bossCleared: false,
    react: null,          // 通常入賞のリアクション
    idle: null, idleWait: 2,
    travel: 0,
    pocketFx: null,       // ポケットが変身する演出
    aidUsed: 0,
    lastWinT: 0,
    sad: 0, joy: 0, levelFx: 0,
    banner: null
  };
  const area = () => AREAS[CONFIG.adventure.area];
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const rollRange = (r) => (Array.isArray(r) ? randInt(r[0], r[1]) : r);
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pickWeighted(list, key) {
    let total = 0;
    for (const e of list) total += e[key] || 1;
    let r = Math.random() * total;
    for (const e of list) {
      r -= e[key] || 1;
      if (r < 0) return e;
    }
    return list[list.length - 1];
  }
  const gaugeLabel = (id) => GAUGES.find((g) => g.id === id).label;

  // ---- テレビ下のメッセージ（日本語） ----
  const msgEl = document.getElementById('tvmsg');
  let msgText = '';
  function setMessage(text, color) {
    msgText = text;
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.color = color || C.text;
  }
  function banner(text, color, dur) {
    G.banner = { text, color: color || C.yellow, t: 0, dur: dur || 1.6 };
  }
  function setState(s) {
    G.state = s;
    G.stateT = 0;
  }

  // テレビの中で浮かぶ文字（who: 'piyo' / 'enemy' / 'center'）
  const tvFloaters = [];
  function floaterTV(text, color, who) {
    tvFloaters.push({ text, color, t: 0, x: rand(-4, 4), who: who || 'center' });
  }

  // ---- ピヨちゃんの成長 ----
  const maxLv = () => P.hpTable.length;
  function newPiyo() {
    return { lv: 1, hp: P.initialHp, maxHp: P.initialHp, atk: P.initialAtk, atkBonus: 0, exp: 0 };
  }
  function recalcPiyo() {
    const p = G.piyo;
    p.maxHp = P.hpTable[p.lv - 1];
    p.atk = P.atkTable[p.lv - 1] + p.atkBonus;
    p.hp = Math.min(p.hp, p.maxHp);
  }
  const expNeed = () => (G.piyo.lv >= maxLv() ? 0 : P.expTable[G.piyo.lv - 1]);
  function healAmount() {
    return Math.max(P.healMin, Math.round(G.piyo.maxHp * P.healRate));
  }
  function healPiyo(n) {
    const p = G.piyo;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    return p.hp - before;
  }
  function addExp(n) {
    const p = G.piyo;
    p.exp += n;
    const lines = [];
    while (p.lv < maxLv() && p.exp >= expNeed()) {
      p.exp -= expNeed();
      const old = { lv: p.lv, maxHp: p.maxHp, atk: p.atk };
      p.lv++;
      recalcPiyo();
      p.hp = p.maxHp;                     // レベルアップでHP全回復
      lines.push('LV ' + old.lv + '→' + p.lv + '  HP ' + old.maxHp + '→' + p.maxHp + '  ATK ' + old.atk + '→' + p.atk);
      recordPiyoLevel(p.lv);
    }
    if (p.lv >= maxLv()) p.exp = 0;
    return lines;
  }

  // ---- ポケット ----
  function currentRoles() {
    if (SGM()) return sgRoles();
    const ev = G.event;
    if (G.state === 'AREA_CLEAR' || G.state === 'GAME_OVER') return ['ring', 'ring', 'ring', 'ring'];
    if (ev && ev.pockets) return ev.pockets;
    return area().normal;
  }
  // ポケットが変身する演出を始める（一度暗くなって、1つずつ点灯）
  function changePockets(back) {
    G.pocketFx = { t: 0, back: !!back };
    sfx.change(back);
  }
  // そのポケットのアイコンがいま見えているか
  function pocketShown(i) {
    const fx = G.pocketFx;
    if (!fx) return true;
    const pc = CONFIG.pocketChange;
    return fx.t >= pc.dark + i * pc.step;
  }
  function isTargetRole() { return false; }
  // 通常時に「あと1」のポケット
  function isAlmostRole(role) {
    if (G.event || G.state !== 'NORMAL') return false;
    const g = ROLES[role] && ROLES[role].gauge;
    return !!g && G.gauge[g] === CONFIG.gauges[g] - 1;
  }

  // ---- ゲージ ----
  function addGauge(id, n) {
    const max = CONFIG.gauges[id];
    const before = G.gauge[id];
    G.gauge[id] = clamp(before + (n || 1), 0, max);
    if (CONFIG.adventure.instantEvents) G.gauge[id] = max;           // 試遊用：1回で満タン ＝ すぐにイベント
    G.gaugeFx[id] = 1;
    if (G.gauge[id] >= max && before < max && G.pending.indexOf(id) < 0) G.pending.push(id);
  }

  // =====================================================================
  //  ポケットに入ったとき（いまの state で効果が変わる）
  // =====================================================================
  function handlePocket(role) {
    if (SGM()) { sgPocket(role); return; }
    const ev = G.event;
    if (ev && ev.kind === 'battle') { battleInput(ev, role); return; }
    if (ev && ev.kind === 'treasure') { treasureHit(ev, role); return; }
    if (ev && ev.kind === 'explore') { normalHit(role); return; }   // 探索の演出中も通常どおり
    if (ev) return;                                    // 勝ち負けの表示中など
    if (G.state === 'AREA_CLEAR' || G.state === 'GAME_OVER') return;
    normalHit(role);
  }

  // ---- 通常時 ----
  function normalHit(role) {
    const g = ROLES[role] && ROLES[role].gauge;
    if (g) {
      addGauge(g, 1);
      G.react = { kind: g, t: 0, dur: CONFIG.adventure.reactTime };
      G.idle = null;
      const v = G.gauge[g];
      const max = CONFIG.gauges[g];
      let label = gaugeLabel(g);
      if (g === 'explore' && G.bossFound) label = 'BOSS';
      if (CONFIG.adventure.instantEvents) setMessage(label + '！', C.yellow);
      else if (v >= max) setMessage(label + ' MAX！', C.yellow);
      else if (v === max - 1) setMessage(label + 'あと 1！', C.yellow);
      else setMessage(label + ' +1', C.text);
      sfx.good();
      return;
    }
    if (role === 'event') randomEvent();
  }

  // ---- ❓ ランダムイベント ----
  function randomEvent() {
    const e = pickWeighted(RANDOM_EVENTS, 'w');
    G.idle = null;
    G.react = { kind: 'event', t: 0, dur: CONFIG.adventure.reactTime + 0.4 };
    setState('RANDOM_EVENT');
    let text = e.text;
    if (e.healRate) {
      const n = healPiyo(Math.max(P.healMin, Math.round(G.piyo.maxHp * e.healRate)));
      floaterTV('+' + n + 'HP', C.green, 'piyo');
    }
    if (e.gauge) addGauge(e.gauge, 1);
    if (e.medal) {
      const n = rollRange(e.medal);
      addPayout(n);
      text += ' ' + n + '枚';
    }
    if (e.battle && G.pending.indexOf('hunt*') < 0) G.pending.unshift('hunt*');
    setMessage(text, e.gauge || e.medal || e.healRate || e.battle ? C.text : C.dim);
    if (e.battle) sfx.encounter(); else if (e.gauge || e.medal || e.healRate) sfx.good(); else sfx.miss();
  }

  // =====================================================================
  //  イベントの開始
  // =====================================================================
  function startPending(entry) {
    const forced = entry.endsWith('*');
    const type = forced ? entry.slice(0, -1) : entry;
    if (type === 'hunt') startBattle(pickMonster(), false, forced);
    else if (type === 'explore') {
      if (G.bossFound && !G.bossCleared) startBattle(BOSSES[area().boss], true, false);
      else startExplore();
    } else startTreasure();
  }
  function pickMonster() {
    return pickWeighted(area().monsters.map((k) => MONSTERS[k]), 'rate');
  }

  function startBattle(def, boss, forced) {
    if (!def) def = pickMonster();
    G.event = {
      kind: 'battle', boss, def, forced, gauge: boss ? 'explore' : 'hunt',
      hp: def.hp, maxHp: def.hp, queue: [], phase: 'intro', timer: 0,
      piyoFx: 0, enemyFx: 0, piyoHitFx: 0, enemyHitFx: 0, done: false,
      pockets: (boss ? BATTLE_POCKETS.boss : BATTLE_POCKETS.normal).slice()
    };
    G.react = null;
    G.idle = null;
    changePockets(false);
    tv.flash = 1;
    if (boss) {
      setState('BOSS_INTRO');
      setMessage('……地面が揺れている。' + def.name + 'が現れた！', C.pink);
      sfx.roar();
    } else {
      setState('HUNT_INTRO');
      banner(forced ? 'BATTLE!' : 'HUNT!', C.yellow);
      setMessage(def.name + 'が現れた！', C.text);
      sfx.encounter();
    }
  }

  function startExplore() {
    const step = EXPLORE_STEPS[Math.min(G.exploreCount, EXPLORE_STEPS.length - 1)];
    G.event = { kind: 'explore', gauge: 'explore', step, done: false };
    G.exploreCount = Math.min(G.exploreCount + 1, EXPLORE_STEPS.length);
    setState('EXPLORE');
    banner('EXPLORE!', C.cyan);
    setMessage(step.text, C.cyan);
    sfx.event();
    if (step.discover) {
      G.bossFound = true;
      G.event.discover = true;
    }
  }

  function startTreasure() {
    G.event = {
      kind: 'treasure', gauge: 'treasure', done: false, opened: false,
      pockets: TREASURE.shuffle ? shuffled(TREASURE.pockets) : TREASURE.pockets.slice()
    };
    changePockets(false);
    setState('TREASURE');
    banner('TREASURE CHANCE!', C.yellow);
    setMessage('TREASURE CHANCE！何が出るかな？', C.goldLight);
    sfx.fever();
  }

  // ---- イベントの終わり（そのゲージだけ0に戻す） ----
  function endEvent() {
    const ev = G.event;
    if (!ev) return;
    if (!ev.forced) G.gauge[ev.gauge] = 0;
    const hadPockets = !!ev.pockets;
    G.event = null;
    G.cool = CONFIG.adventure.nextEventDelay;
    setState('NORMAL');
    if (hadPockets) changePockets(true);
    if (G.pending.length === 0) hintNext();
  }

  // 次の目標を教える
  function hintNext() {
    if (SGM()) return;                                           // すごろく版では使わない（RPG時代の HP などの表示）
    const p = G.piyo;
    const near = GAUGES.filter((g) => G.gauge[g.id] === CONFIG.gauges[g.id] - 1)
      .map((g) => (g.id === 'explore' && G.bossFound ? 'BOSS' : g.label));
    if (p.hp <= Math.ceil(p.maxHp * 0.3)) setMessage('HPが少ない！💰で薬草を探そう', C.pink);
    else if (near.length) setMessage(near.join('も') + 'もあと 1だ！', C.yellow);
    else if (G.bossFound) setMessage('森の主を見つけた！🗺️で挑むか、⚔️で強くなるか……', C.text);
    else setMessage('冒険を続けよう！', C.text);
  }

  // =====================================================================
  //  戦闘：ポケット入賞1回 ＝ 1ターン
  // =====================================================================
  function battleInput(ev, role) {
    if (ev.done) return;
    if (!BATTLE_EFFECTS[role]) return;
    ev.queue.push(role);                 // 演出の順番に処理する
  }

  function stepBattle(ev) {
    const B = CONFIG.battle;
    ev.piyoFx = Math.max(0, ev.piyoFx - STEP * 3);
    ev.enemyFx = Math.max(0, ev.enemyFx - STEP * 3);
    ev.piyoHitFx = Math.max(0, ev.piyoHitFx - STEP * 3);
    ev.enemyHitFx = Math.max(0, ev.enemyHitFx - STEP * 3);
    ev.timer += STEP;
    if (ev.done) {
      if (ev.timer >= CONFIG.adventure.endTime) finishBattle(ev);
      return;
    }
    if (ev.phase === 'intro') {
      const t = ev.boss ? 3.0 : CONFIG.adventure.introTime;
      if (ev.timer >= t) {
        ev.phase = 'ready';
        ev.timer = 0;
        setState(ev.boss ? 'BOSS_BATTLE' : 'BATTLE');
        if (ev.boss) banner('BOSS BATTLE!', C.pink);
        setMessage(ev.boss ? 'ポケットに入れて戦おう！⭐は ATK×3！' : 'ポケットに入れて戦おう！', C.text);
      }
      return;
    }
    if (ev.phase === 'ready' && ev.queue.length) {
      playerTurn(ev, ev.queue.shift());
      return;
    }
    if (ev.phase === 'player' && ev.timer >= B.turnTime) {
      enemyTurn(ev);
      return;
    }
    if (ev.phase === 'enemy' && ev.timer >= B.enemyTime) {
      ev.phase = 'ready';
      ev.timer = 0;
    }
  }

  function playerTurn(ev, role) {
    const eff = BATTLE_EFFECTS[role];
    const p = G.piyo;
    ev.timer = 0;
    ev.phase = 'player';
    if (eff.type === 'attack') {
      const dmg = p.atk * eff.mul;
      ev.hp = Math.max(0, ev.hp - dmg);
      ev.piyoFx = 1;
      ev.enemyHitFx = 1;
      floaterTV('-' + dmg, eff.mul >= 2 ? C.yellow : C.white, 'enemy');
      sfx.hit(eff.mul >= 2);
      setMessage(eff.mul === 3 ? '会心の一撃！' + dmg + 'ダメージ！' :
        eff.mul === 2 ? '強い攻撃！' + dmg + 'ダメージ！' : 'ピヨちゃんの攻撃！' + dmg + 'ダメージ', C.text);
      if (ev.hp <= 0) winBattle(ev);            // 倒したら反撃はない
    } else {
      const n = healPiyo(healAmount());
      floaterTV('+' + n, C.green, 'piyo');
      setMessage('ピヨちゃんは回復した！ HP +' + n, C.green);
      sfx.heal();
    }
  }

  function enemyTurn(ev) {
    const p = G.piyo;
    ev.timer = 0;
    ev.phase = 'enemy';
    p.hp = Math.max(0, p.hp - ev.def.atk);
    ev.enemyFx = 1;
    ev.piyoHitFx = 1;
    floaterTV('-' + ev.def.atk, C.pink, 'piyo');
    sfx.ouch();
    setMessage(ev.def.name + 'の攻撃！' + ev.def.atk + 'ダメージ', C.pink);
    if (p.hp <= 0) loseBattle(ev);
  }

  function winBattle(ev) {
    ev.done = true;
    ev.win = true;
    ev.timer = 0;
    ev.queue = [];
    G.joy = 2;
    if (ev.boss) {
      setState('BOSS_WIN');
      banner('BOSS DEFEATED!!', C.yellow, 2.4);
      setMessage(ev.def.name + 'を倒した！', C.yellow);
      sfx.fanfare();
      G.bossCleared = true;
      recordBoss();
      return;
    }
    setState('HUNT_WIN');
    recordHuntWin();
    const medal = rollRange(ev.def.reward);
    addPayout(medal);                                 // 所持数ではなく、プッシャーへ払い出す
    const lines = addExp(ev.def.exp);
    banner(lines.length ? 'LEVEL UP!' : 'HUNT CLEAR!', C.yellow, 2);
    setMessage(ev.def.label + ' DEFEATED!  EXP +' + ev.def.exp + '  ' + medal + ' MEDAL！' +
      (lines.length ? '  LEVEL UP! ' + lines[lines.length - 1] : ''), C.goldLight);
    if (lines.length) { G.levelFx = 1.6; sfx.levelUp(); } else sfx.victory();
  }

  function loseBattle(ev) {
    ev.done = true;
    ev.win = false;
    ev.timer = 0;
    ev.queue = [];
    G.piyo.hp = P.loseHp;
    G.sad = 2.6;
    setState(ev.boss ? 'BOSS_LOSE' : 'HUNT_LOSE');
    banner(ev.boss ? 'BOSS FAILED...' : 'HUNT FAILED...', C.dim, 2.2);
    if (ev.boss) {
      // ボスに負けたら、探索は 0 から やり直し（ボスは また かくれてしまう）
      G.exploreCount = 0;
      G.bossFound = false;
      G.gauge.explore = 0;
      G.pending = G.pending.filter((e) => e.replace('*', '') !== 'explore');
    }
    setMessage(ev.boss ? 'ピヨちゃんは逃げ帰った……森の主はまた奥へ隠れた。探索を 0からやり直し！' :
      'ピヨちゃんは負けてしまった……報酬はなし', C.dim);
    sfx.lose();
  }

  function finishBattle(ev) {
    if (ev.boss && ev.win) {
      startAreaClear();
      return;
    }
    endEvent();
  }

  // ---- TREASURE CHANCE：1回入れたら結果が決まる ----
  function treasureHit(ev, role) {
    if (ev.done) return;
    const res = TREASURE.results[role];
    if (!res) return;
    ev.done = true;
    ev.opened = true;
    ev.result = role;
    ev.timer = 0;
    let text = res.text;
    if (res.medal) {
      const n = rollRange(res.medal);
      addPayout(n);
      text += ' ' + n + ' MEDAL！';
    }
    if (res.atk) { G.piyo.atkBonus += res.atk; recalcPiyo(); }
    if (res.fullHeal) G.piyo.hp = G.piyo.maxHp;
    if (role === 'empty') { G.sad = 1.6; sfx.miss(); } else { G.joy = 1.6; sfx.open(); }
    setMessage(text, role === 'empty' ? C.dim : C.goldLight);
  }

  // ---- AREA CLEAR ----
  function startAreaClear() {
    G.event = null;
    setState('AREA_CLEAR');
    G.clear = { queue: BOSSES[area().boss].reward.slice(), next: 1.4, done: false };
    banner('AREA CLEAR!', C.yellow, 2.6);
    setMessage('AREA CLEAR！ BIG WIN 50 MEDAL！', C.yellow);
    changePockets(true);
  }

  function stepAreaClear() {
    const c = G.clear;
    G.joy = 1;
    if (c.queue.length && G.stateT >= c.next) {
      addPayout(c.queue.shift());               // 10枚ずつジャラジャラ
      floaterTV('+10', C.goldLight, 'center');
      sfx.payoutBig();
      c.next = G.stateT + 1.4;
    }
    if (!c.queue.length && !c.done && payoutQueue === 0 && G.stateT > c.next + 1) {
      c.done = true;
      setMessage('森の向こうにはまだ見ぬ世界が広がっている…… TO BE CONTINUED', C.cyan);
      toast('AREA CLEAR！席を立ってゲームセンターへ戻れます');
      writeSave();
    }
  }

  // =====================================================================
  //  メダル0枚
  // =====================================================================
  function physicalBusy() {
    return balls.length > 0 || falling.length > 0 || orbs.length > 0 || payoutQueue > 0;
  }

  function checkMedalZero() {
    if (hand > 0) { outOfMedalShown = false; return; }
    if (G.state === 'AREA_CLEAR' && G.clear && !G.clear.done) return;
    if (physicalBusy() || G.pending.length > 0) return;
    if (time - Math.max(G.lastWinT, lastPayoutT) < CONFIG.game.zeroWait) return;   // まだ押し出されるかも
    onOutOfMedals();          // GAME OVER にはせず、ゲームセンターへ戻れるようにする
  }


  // =====================================================================
  //  毎フレームの進行
  // =====================================================================
  const IDLE_KINDS = ['walk', 'walk', 'look', 'sit', 'map', 'bird', 'search'];

  function stepGame() {
    if (SGM()) { sgStep(); return; }
    G.stateT += STEP;
    if (G.banner) {
      G.banner.t += STEP;
      if (G.banner.t > G.banner.dur) G.banner = null;
    }
    if (G.sad > 0) G.sad -= STEP;
    if (G.joy > 0) G.joy -= STEP;
    if (G.levelFx > 0) G.levelFx -= STEP;
    for (const g of GAUGES) G.gaugeFx[g.id] = Math.max(0, G.gaugeFx[g.id] - STEP * 2);
    tv.flash *= 0.94;
    if (G.pocketFx) {
      G.pocketFx.t += STEP;
      const pc = CONFIG.pocketChange;
      if (G.pocketFx.t >= pc.dark + pc.step * 4 + 0.2) {
        if (G.pocketFx.back) for (let i = 0; i < pocketFlash.length; i++) pocketFlash[i] = 0.7;   // ピカッ（1回だけ）
        G.pocketFx = null;
      }
    }
    for (const f of tvFloaters) f.t += STEP;
    while (tvFloaters.length && tvFloaters[0].t > 1.0) tvFloaters.shift();

    // リアクションと待ち時間アニメ
    if (G.react) {
      G.react.t += STEP;
      if (G.react.t >= G.react.dur) {
        G.react = null;
        if (G.state === 'RANDOM_EVENT') setState('NORMAL');
      }
    } else if (!G.event && G.state === 'NORMAL') {
      if (G.idle) {
        G.idle.t += STEP;
        if (G.idle.kind === 'walk') G.travel += STEP * 0.8;
        if (G.idle.t >= G.idle.dur) { G.idle = null; G.idleWait = rand(CONFIG.adventure.idleEvery[0], CONFIG.adventure.idleEvery[1]); }
      } else {
        G.idleWait -= STEP;
        if (G.idleWait <= 0) {
          const kind = pick(IDLE_KINDS);
          G.idle = { kind, t: 0, dur: kind === 'walk' ? rand(2, 3.5) : rand(1.6, 2.6) };
        }
      }
    }

    if (G.state === 'AREA_CLEAR') { stepAreaClear(); return; }
    if (G.state === 'GAME_OVER') return;
    const ev = G.event;
    if (ev) {
      if (ev.kind === 'battle') stepBattle(ev);
      else {
        ev.timer = (ev.timer || 0) + STEP;
        if (ev.kind === 'explore' && G.stateT >= CONFIG.adventure.exploreTime + (ev.discover ? 1.2 : 0)) endEvent();
        if (ev.kind === 'treasure' && ev.done && ev.timer >= CONFIG.adventure.endTime) endEvent();
      }
      return;
    }
    if (G.state === 'NORMAL' || G.state === 'RANDOM_EVENT') {
      if (G.cool > 0) G.cool -= STEP;
      else if (G.pending.length && G.state === 'NORMAL') startPending(G.pending.shift());
    }
  }

  // 払い出し：テレビの下の払い出し口からジャラジャラ落とす
  function addPayout(n) {
    payoutQueue += n;
  }

  function stepPayout() {
    if (payoutQueue <= 0) { payoutTimer = 0; return; }
    payoutTimer += STEP;
    while (payoutQueue > 0 && payoutTimer >= CONFIG.payout.interval) {
      payoutTimer -= CONFIG.payout.interval;
      payoutQueue--;
      lastActivity = time;
      lastPayoutT = time;
      const x = rand(TV.x + 8, TV.x + TV.w - 8);
      falling.push({
        kind: 'drop', x, y: SLOT_Y, y0: SLOT_Y,
        y1: rand(FIELD.top + R, FIELD.top + R + 10), t: 0, dur: 0.16
      });
      sfx.payout();
    }
  }

  // =====================================================================
  //  移動中のメダル
  // =====================================================================
  const ROUTE_SLIDE = 0.16;   // 盤面の下を左右へ転がる時間

  function stepFalling() {
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.t += STEP;
      if (f.kind === 'route') {
        if (f.t < 0) continue;                       // ポケットの中で待機中
        if (f.t < ROUTE_SLIDE) {                     // 盤面の下を転がる
          const k = f.t / ROUTE_SLIDE;
          f.x = f.x0 + (f.x1 - f.x0) * k;
          f.y = f.y0 + (GUTTER_Y - f.y0) * k;
          continue;
        }
        const k = Math.min(1, (f.t - ROUTE_SLIDE) / (f.dur - ROUTE_SLIDE));
        f.x = f.x1;
        f.y = GUTTER_Y + (f.y1 - GUTTER_Y) * k * k;  // シュートを落ちる
        if (k < 1) continue;
        falling.splice(i, 1);
        landOnPusher(f.x, f.y1);
        lastActivity = time;
        continue;
      }
      const k = Math.min(1, f.t / f.dur);
      f.y = f.y0 + (f.y1 - f.y0) * k * k;
      if (k < 1) continue;
      falling.splice(i, 1);
      if (f.kind === 'drop') landOnPusher(f.x, f.y1);
      else if (f.kind === 'lost') spawnBurst(f.x, FIELD.edge + 10, 5, [C.dim, C.frameLight], 0.6);
    }
  }

  function step() {
    time += STEP;
    stepBoard();
    stepOrbs();
    stepGame();
    stepPayout();
    FIELD.prevFront = FIELD.front;
    FIELD.front = pusherFront(time);
    stepPusherCoins();
    stepField();
    checkEdge();
    stepFalling();
    if (holding && time - lastInsertTime >= CONFIG.insertInterval) insertCoin(guideX);
    if (!gameOver) checkGameOver();
    if (hand > D_().bestMedal || (frameCount++ % 30 === 0)) noteMedals();

    // 演出の更新
    flash *= 0.96;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity === undefined ? 0.06 : p.gravity;
      p.life -= STEP;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i].t += STEP;
      if (floaters[i].t > 0.8) floaters.splice(i, 1);
    }
    sparkleTimer += STEP;
    if (sparkleTimer > 0.9) {
      sparkleTimer = 0;
      const pool = Math.random() < 0.25 && pusherCoins.length ? pusherCoins : coins;
      sparkle = pool.length ? { c: pool[(Math.random() * pool.length) | 0], t: 0 } : null;
    }
    if (sparkle) sparkle.t += STEP;
  }

  // =====================================================================
  //  投入・獲得
  // =====================================================================
  function insertCoin(x) {
    if (scene !== 'machine' || dialogOpen || zoom || hand <= 0) return;
    if (!currentMachine || currentMachine.gameType !== 'piyoAdventure') return;
    D_().played = true;
    D_().stats.piyo.coins++;
    const cx = clamp(x, BOARD.left + BOARD.ballR, BOARD.right - BOARD.ballR);
    guideX = cx;
    hand--;
    stats.inserted++;
    lastInsertTime = time;
    lastActivity = time;
    dropBall(cx, false);
    sfx.insert();
  }

  function onWin(x) {
    G.lastWinT = time;
    hand++;
    won++;
    lastActivity = time;
    flash = Math.min(1, flash + 0.35);
    sfx.win();
    spawnBurst(x, FIELD.edge + 6, 12, [C.white, C.goldLight, C.yellow, C.pink, C.cyan], 1);
    floaters.push({ x, y: FIELD.edge + 4, t: 0 });
  }

  function spawnBurst(x, y, n, colors, power) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-1.4, 1.4) * power,
        vy: rand(-2.6, -0.6) * power,
        life: rand(0.4, 0.9), max: 0.9,
        size: Math.random() < 0.3 ? 2 : 1,
        color: colors[i % colors.length]
      });
    }
  }

  function isBusy() {
    return balls.length > 0 || falling.length > 0 || orbs.length > 0 || payoutQueue > 0 ||
      G.event !== null || G.pending.length > 0;
  }

  function checkGameOver() {
    checkMedalZero();   // 0枚になったら「おたすけメダル」→ 3回目で GAME OVER
  }


  function prefill() {
    coins = [];
    let row = 0;
    // いちばん手前の列は、崖から少しはみ出した状態から始める（あと少しで落ちそうな盤面）
    for (let y = FIELD.edge + R * PH.dropOver * 0.4; y >= FIELD.pushMax + FACE + R + 1; y -= D * 0.9) {
      const off = row % 2 === 0 ? 0 : R;
      for (let x = FIELD.left + R + 1 + off; x <= FIELD.right - R; x += D + 0.5) {
        if (Math.random() < CONFIG.pusher.initialFill) coins.push(newCoin(x + rand(-0.4, 0.4), y + rand(-0.4, 0.4), 0));
      }
      row++;
    }
    const base = coins.slice();
    for (let i = 0; i < CONFIG.pusher.initialStacked; i++) {
      const b = base[(Math.random() * base.length) | 0];
      coins.push(newCoin(b.x + rand(-1, 1), b.y + rand(-1, 1), 1));
    }
  }

  // プッシャーの上にも最初から少しメダルを置く
  function prefillPusher() {
    pusherCoins = [];
    let tries = 0;
    while (pusherCoins.length < CONFIG.pusher.initialOnPusher && tries++ < 300) {
      const x = rand(FIELD.left + R, FIELD.right - R);
      const y = rand(FIELD.top + R, FIELD.front - 3);
      if (pusherCoins.every((c) => (c.x - x) ** 2 + (c.y - y) ** 2 >= D * D)) {
        pusherCoins.push({ x, y, hy: LIFT, level: 0 });
      }
    }
  }

  // ピヨちゃん筐体の「その日の状態」を初期化（メダルの残高はゲームセンター共通なので触らない）
  function resetPiyoDay() {
    won = 0;
    balls = [];
    falling = [];
    particles = [];
    floaters = [];
    orbs = [];
    flash = 0;
    fever = 0;
    payoutQueue = 0;
    payoutTimer = 0;
    gameOver = false;
    holding = false;
    tv.flash = 0;
    FIELD.front = pusherFront(time);
    FIELD.prevFront = FIELD.front;
    prefill();
    prefillPusher();
    lastActivity = time;
    G.gauge = { hunt: 0, explore: 0, treasure: 0 };
    G.pending = [];
    G.event = null;
    G.react = null;
    G.idle = null;
    G.cool = 0;
    G.piyo = newPiyo();
    G.exploreCount = 0;
    G.bossFound = false;
    G.bossCleared = false;
    G.clear = null;
    G.pocketFx = null;
    G.aidUsed = 0;
    G.lastWinT = time;
    G.banner = null;
    G.sad = 0;
    G.joy = 0;
    G.levelFx = 0;
    setState('NORMAL');
    setMessage(area().name + '　⚔️🗺️💰❓を狙って冒険しよう！', C.cyan);
    if (SGM()) sgReset();
  }

  // =====================================================================
  //  描画
  // =====================================================================
  function rect(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(px(x), px(y), px(w), px(h));
  }

  // 筐体のまわりで点滅する電球
  const bulbs = [];
  const bulbsT = [];                                                                            // ヘッダーの下から はじまる外枠の電球
  const HDR_H = 32;                                                                             // フロア画面の、枠の外のヘッダー（DAY・YEN・MEDAL）の高さ
function buildBulbs() {
  bulbsT.length = 0;
  for (let x = 6; x <= W - 6; x += 8) { bulbsT.push([x, HDR_H + 3]); bulbsT.push([x, H - 5]); }
  for (let y = HDR_H + 11; y <= H - 13; y += 8) { bulbsT.push([3, y]); bulbsT.push([W - 5, y]); }
  bulbs.length = 0;
  for (let x = 6; x <= W - 6; x += 8) {
    bulbs.push([x, 3]);
    bulbs.push([x, H - 5]);
  }
  for (let y = 11; y <= H - 13; y += 8) {
    bulbs.push([3, y]);
    bulbs.push([W - 5, y]);
  }
}
buildBulbs();

function drawFrame(top) {
    top = top || 0;                                                                              // top：枠のいちばん上の位置（フロアでは、ヘッダーのぶん下げる）
    rect(0, 0, W, H, C.bg);
    rect(1, top + 1, W - 2, H - top - 2, C.frame);
    rect(8, top + 8, W - 16, H - top - 16, C.black);
    // 電球はゆっくり流れるだけ（チカチカさせない）
    const chase = Math.floor(time * 2);
    (top ? bulbsT : bulbs).forEach(([x, y], i) => {
      const on = (i + chase) % 3 === 0;
      const col = on ? (i % 2 ? '#c85a90' : '#c8a040') : '#4b2f63';
      rect(x, y, 2, 2, col);
    });
  }


  function drawStar(x, y, col) {
    rect(x, y - 2, 1, 5, col);
    rect(x - 2, y, 5, 1, col);
  }

  function drawHud() {
    const dx = W - 180; const hx = Math.round(dx / 2);                    // ワイド：MEDAL / WIN の枠を、広がった幅に合わせる
    drawTextCenter('MEDAL ADVENTURE', W / 2, 10, C.yellow, 1, C.goldDark);
    drawStar(W / 2 - 37, 12, C.pink);
    drawStar(W / 2 + 35, 12, C.cyan);
    rect(12, 18, 74 + hx, 14, '#1a1236');
    rect(94 + hx, 18, 74 + dx - hx, 14, '#1a1236');
    drawText('MEDAL', 15, 23, C.dim, 1);
    drawText(String(hand), 84 + hx - textWidth(String(hand), 2), 20, C.goldLight, 2, C.goldEdge);
    drawText('WIN', 97 + hx, 23, C.dim, 1);
    drawText(String(won), 166 + dx - textWidth(String(won), 2), 20, C.cyan, 2, '#1f4a66');
  }

  function drawRail() {
    const l = BOARD.left - 4;
    const w = BOARD.right - BOARD.left + 8;
    rect(l, 35, w, 12, '#160f30');
    rect(l, 35, w, 1, C.cyan);
    rect(l, 46, w, 1, '#2a6b80');
    if (!gameOver && hand > 0) {
      drawTextCenter('TAP TO DROP', W / 2, 39, '#3f8fa8', 1);
      ctx.globalAlpha = 0.55;
      drawCoinSprite(coinFull, guideX, RAIL_Y - 1);
      ctx.globalAlpha = 1;
    } else if (!gameOver) {
      drawTextCenter('NO MEDAL', W / 2, 39, C.pink, 1);
    }
  }

  // 盤面の背景（ディザ模様と小さな星）を事前に描いておく
  let boardCanvas = null;
  const build_boardCanvas = () => {
    const w = BOARD.right - BOARD.left;
    const h = BOARD.bottom - BOARD.top + 4;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.fillStyle = C.boardA;
    g.fillRect(0, 0, w, h);
    g.fillStyle = C.boardB;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x + y) % 2 === 0 && Math.floor(y / 6) % 3 === 0) g.fillRect(x, y, 1, 1);
      }
    }
    g.fillStyle = '#3a4a8a';
    for (let i = 0; i < 14; i++) {
      const x = 4 + ((i * 37) % (w - 8));
      const y = 4 + ((i * 23) % (h - 30));
      g.fillRect(x, y, 1, 1);
    }
    return c;
  };
  boardCanvas = build_boardCanvas();

  function drawBoard() {
    ctx.drawImage(boardCanvas, BOARD.left, BOARD.top);
    // 盤面下の受け（左右のシュートへ流れる溝）
    rect(BOARD.left, BOARD.bottom, BOARD.right - BOARD.left, 4, '#140f30');
    for (let x = BOARD.left; x < BOARD.right; x += 6) rect(x, BOARD.bottom + 1, 3, 1, '#2a2458');

    // ポケット（いまの役割のアイコンを表示）
    const roles = currentRoles();
    POCKETS.centers.forEach((cx, i) => {
      const w = POCKETS.width;
      const role = roles[i];
      const col = ROLES[role].color;
      const lit = pocketFlash[i] > 0.15;
      const shown = pocketShown(i);               // 変身の途中は、まだ暗い
      rect(cx - w / 2 - 1, POCKETS.y, w + 2, POCKETS.depth, !shown ? '#2a2450' : lit ? C.white : col);
      rect(cx - w / 2 + 1, POCKETS.y + 1, w - 2, POCKETS.depth - 3, lit && shown ? col : '#0a0618');
      rect(cx - w / 2 + 1, POCKETS.y + POCKETS.depth - 2, w - 2, 1, C.black);
      if (shown) ctx.drawImage(roleIcon(role), px(cx - 3), POCKETS.y + 2);
      // 入賞ランプ
      const almost = isAlmostRole(role);                  // 「あと1」のポケットはランプが点灯
      if (almost && shown) {
        rect(cx - 3, POCKETS.y - 6, 7, 3, col);
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(time * 3);
        rect(cx - 4, POCKETS.y - 7, 9, 5, C.white);
        ctx.globalAlpha = 1;
      } else rect(cx - 1, POCKETS.y - 5, 3, 2, lit ? C.white : '#3a2d5a');
      if (pocketFlash[i] > 0.05) {
        ctx.globalAlpha = pocketFlash[i] * 0.5;
        rect(cx - w / 2 - 3, POCKETS.y - 7, w + 6, POCKETS.depth + 8, col);
        ctx.globalAlpha = 1;
      }
    });

    // ピン
    for (const p of pins) {
      const x = px(p.x - 1);
      const y = px(p.y - 1);
      rect(x + 1, y + 1, 2, 2, C.pinDark);
      rect(x, y, 2, 2, p.flash > 0.3 ? C.goldLight : C.pin);
    }

    // 盤面の左右の壁
    for (const x of [BOARD.left - 6, BOARD.right]) {
      rect(x, BOARD.top - 1, 6, BOARD.bottom - BOARD.top + 5, C.wall);
      rect(x + 1, BOARD.top - 1, 1, BOARD.bottom - BOARD.top + 5, C.wallLight);
      rect(x + 5, BOARD.top - 1, 1, BOARD.bottom - BOARD.top + 5, C.wallDark);
    }
  }

  function drawBalls() {
    for (const b of balls) {
      // 転がっているように見えるよう、位置に応じて回転コマを切り替える
      const frame = spinFrames[Math.floor(Math.abs(b.x + b.y) / 3) % spinFrames.length];
      drawCoinSprite(frame, b.x, b.y);
    }
  }

  // ---- 中段：シュートとテレビ ----
  function drawChutesBack() {
    for (const ch of CHUTES) {
      rect(ch.l, BOARD.bottom + 4, ch.r - ch.l, FIELD.top - 6 - (BOARD.bottom + 4), '#100a24');
    }
  }

  function drawChutesFront() {
    for (const ch of CHUTES) {
      const top = BOARD.bottom + 4;
      const h = FIELD.top - 6 - top;
      rect(ch.l, top, 1, h, C.wallLight);
      rect(ch.r - 1, top, 1, h, C.wallDark);
      ctx.globalAlpha = 0.25;
      for (let y = top + 3; y < top + h; y += 9) rect(ch.l + 3, y, 2, 5, C.white);
      ctx.globalAlpha = 1;
    }
  }

  // =====================================================================
  //  ドット絵（キャラクター・敵・アイコン）
  // =====================================================================
  function spriteFromMap(map, colors) {
    const w = Math.max.apply(null, map.map((r) => r.length));
    const c = makeCanvas(w, map.length);
    const g = c.getContext('2d');
    map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = colors[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  // ---- ピヨちゃん ----
  const CHAR_COLORS = { o: '#5a3008', y: '#ffe070', k: '#1a1020', p: '#ff9a30', r: '#ff8fb0', w: '#fff8d8', b: '#5ce8ff' };
  const CHAR_IDLE = spriteFromMap([
    '....ooo....',
    '...oyyyo...',
    '..oyyyyyo..',
    '.oyykyykyo.',
    '.oyyyppyyo.',
    '.oryyyyyro.',
    'oyyyyyyyyyo',
    'oyyyyyyyyyo',
    '.oyyyyyyyo.',
    '..ooooooo..',
    '...p...p...'
  ], CHAR_COLORS);
  const CHAR_THROW = spriteFromMap([
    '....ooo....',
    '...oyyyo...',
    '..oyyyyyo..',
    'yoyykyykyoy',
    'yoyyyppyyoy',
    '.oryyyyyro.',
    '.oyyyyyyyo.',
    'oyyyyyyyyyo',
    '.oyyyyyyyo.',
    '..ooooooo..',
    '...p...p...'
  ], CHAR_COLORS);
  const CHAR_JUMP = spriteFromMap([
    '....ooo....',
    '...oyyyo...',
    '..oyyyyyo..',
    '.oyykyykyo.',
    'yoyyyppyyoy',
    'yoryyyyyroy',
    '.oyyyyyyyo.',
    'oyyyyyyyyyo',
    '.oyyyyyyyo.',
    '..ooooooo..',
    '..p.....p..'
  ], CHAR_COLORS);
  const CHAR_SAD = spriteFromMap([
    '....ooo..b.',
    '...oyyyo.b.',
    '..oyyyyyo..',
    '.oykkyykkyo',
    '.oyyyppyyo.',
    '.oyyyyyyyo.',
    'oyyyyyyyyyo',
    'oyyyyyyyyyo',
    '.oyyyyyyyo.',
    '..ooooooo..',
    '...p...p...'
  ], CHAR_COLORS);

  // ---- 敵・仕掛け ----
  const ENEMY = {};
  ENEMY.slime = spriteFromMap([
    '.....oooo.....',
    '...oogglggoo..',
    '..ogglllggggo.',
    '.ogglggggggggo',
    '.oggkgggggkggo',
    'oggggggggggggo',
    'ogggggmmmggggo',
    'oggggggggggggo',
    '.oooooooooooo.'
  ], { o: '#1a4a20', g: '#5ce870', l: '#b8ffc0', k: '#102010', m: '#1a4a20' });
  ENEMY.mushroom = spriteFromMap([
    '....oooooo....',
    '..oorrwwrrroo.',
    '.orrwwwrrrwwro',
    'orrrwrrrrrwwro',
    'orrrrrrrrrrrro',
    'oooooooooooooo',
    '...osskssksso.',
    '...ossssssso..',
    '...ossmmssso..',
    '....ooooooo...'
  ], { o: '#4a1010', r: '#e83050', w: '#fff8d8', s: '#f0d8b0', k: '#1a1020', m: '#a06040' });
  ENEMY.bat = spriteFromMap([
    'p..............p',
    'pp....o..o....pp',
    'ppp..oppppo..ppp',
    'pppppprpprpppppp',
    '.ppppppppppppppp',
    '..ppp.pwwp.ppp..',
    '........pp......'
  ], { p: '#8a50c8', o: '#5a2a90', r: '#ff4060', w: '#fff8d8' });
  ENEMY.golem = spriteFromMap([
    '....oooooo....',
    '...osssssso...',
    '..osskssksso..',
    '..ossssssssо..'.replace('о', 'o'),
    '.oossmmmmssoo.',
    'osssooooooosso',
    'osssssssssssso',
    'osso.osso.osso',
    '.oo..osso..oo.',
    '.....oooo.....'
  ], { o: '#2a2438', s: '#8a84a0', k: '#ffd040', m: '#4a4458' });
  const armorMap = [
    '.....oooo.....',
    '....obbbbo....',
    '...obbbbbbo...',
    '...obkkkkbo...',
    '...obbbbbbo...',
    '..oobbbbbboo..',
    '.obboyyyyobbo.',
    '.obbobbbbobbo.',
    '..o.obbbbo.o..',
    '....obo.obo...',
    '....oo...oo...'
  ];
  ENEMY.armor = spriteFromMap(armorMap, { o: '#1a1a30', b: '#7a8ab8', k: '#ff4060', y: '#ffd040' });
  ENEMY.captain = spriteFromMap(['......y.y.....', '.....yyyyy....'].concat(armorMap.slice(1)),
    { o: '#1a0a14', b: '#6a2a48', k: '#ffd040', y: '#ffd040' });
  ENEMY.dragon = spriteFromMap([
    '.........oo.............',
    '........orro.......oo...',
    '.......orrrro.....orro..',
    '......orrkrrro...orrrro.',
    '.....orrrrrrrro.orrrrro.',
    '.oo..orryyyrrrrorrrrro..',
    'orro.orrrrwwrrrrrrrro...',
    'orrrorrrrrrrrrrrrrro....',
    'orrrrrrrrryyyyrrrrro....',
    '.orrrrrrryyyyyyrrrro....',
    '..orrrrrryyyyyyrrrro....',
    '...orrrrrryyyyrrrro.....',
    '....orrrrrrrrrrrro......',
    '.....orro....orro.......',
    '.....oo.......oo........'
  ], { o: '#3a0a10', r: '#e83050', y: '#ffb040', k: '#ffff80', w: '#fff8d8' });
  ENEMY.chest = spriteFromMap([
    'oooooooooooo',
    'obbbbbbbbbbo',
    'obybbbbbbybo',
    'oyyyyykyyyyo',
    'obbbbbybbbbo',
    'obybbbbbbybo',
    'oooooooooooo'
  ], { o: '#3a1a08', b: '#a0602a', y: '#ffd040', k: '#1a1020' });
  ENEMY.bigchest = spriteFromMap([
    '..oooooooooooo..',
    '.obbbbbbbbbbbbo.',
    'obbybbbbbbbbybbo',
    'oyyyyyyykyyyyyyo',
    'obbbbbbbybbbbbbo',
    'obbybbbbbbbbybbo',
    'obbybbbbbbbbybbo',
    'oooooooooooooooo'
  ], { o: '#2a0a20', b: '#a03070', y: '#ffd040', k: '#1a1020' });
  ENEMY.door = spriteFromMap([
    '..oooooooo..',
    '.obbbbbbbbo.',
    'obbobbbbobbo',
    'obbobbbbobbo',
    'obbobbbbobbo',
    'obbobbybobbo',
    'obbobbkbobbo',
    'obbobbbbobbo',
    'obbobbbbobbo',
    'oooooooooooo'
  ], { o: '#2a1408', b: '#8a5a2a', y: '#ffd040', k: '#1a1020' });
  ENEMY.gate = spriteFromMap([
    'oooooooooooooo',
    'osssssssssssso',
    'osooooooooooso',
    'osobobobobobso',
    'osobobobobobso',
    'osobobobobobso',
    'osobobobobobso',
    'osobobobobobso',
    'osssssssssssso',
    'oooooooooooooo'
  ], { o: '#1a1428', s: '#8a84a0', b: '#4a4458' });
  ENEMY.flame = spriteFromMap([
    '.....r......',
    '....rr..r...',
    '...rrr.rr...',
    '..rrorrrr.r.',
    '.rrooorrrrr.',
    '.rrooyoorrr.',
    'rrooyyyoorrr',
    'rooyyyyyoorr',
    '.rooyyyyoor.',
    '..rrrrrrrr..'
  ], { r: '#e83050', o: '#ff9a30', y: '#ffe070' });
  ENEMY.stones = null; // 色合わせは色の玉で描く

  // ---- ポケットのアイコン（7×7） ----
  const ICON_COLORS = { w: '#fff8d8', y: '#ffd040', o: '#ff9a30', r: '#e83050', g: '#7dff8a', b: '#5ca8ff', k: '#1a1020', s: '#c8d0f0', d: '#8a80b8' };
  const ICONS = {
    dice: spriteFromMap(['wwwwwww', 'wkwwwkw', 'wwwwwww', 'wwwkwww', 'wwwwwww', 'wkwwwkw', 'wwwwwww'], ICON_COLORS),
    sword: spriteFromMap(['.....ws', '....ws.', '...ws..', 'y.ws...', '.yy....', '.yy....', 'y..y...'], ICON_COLORS),
    burst: spriteFromMap(['o..y..o', '.oyyyo.', '.yyryy.', 'yyrrryy', '.yyryy.', '.oyyyo.', 'o..y..o'], ICON_COLORS),
    skull: spriteFromMap(['.wwwww.', 'wwwwwww', 'wkkwkkw', 'wkkwkkw', 'wwwkwww', '.wwwww.', '.w.w.w.'], ICON_COLORS),
    key: spriteFromMap(['..yyy..', '.y...y.', '.y...y.', '..yyy..', '...y...', '...yy..', '...yyy.'], ICON_COLORS),
    miss: spriteFromMap(['r.....r', '.r...r.', '..r.r..', '...r...', '..r.r..', '.r...r.', 'r.....r'], ICON_COLORS),
    leaf: spriteFromMap(['....gg.', '...ggg.', '..gggg.', '.gggg..', '.ggg...', 'g.g....', 'g......'], ICON_COLORS),
    star: spriteFromMap(['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y'], ICON_COLORS),
    ring: spriteFromMap(['..ddd..', '.d...d.', 'd.....d', 'd.....d', 'd.....d', '.d...d.', '..ddd..'], ICON_COLORS),
    shield: spriteFromMap(['bbbbbbb', 'byyyyyb', 'bybbbyb', 'bybbbyb', '.bybyb.', '..byb..', '...b...'], ICON_COLORS),
    fire: spriteFromMap(['...r...', '..rr.r.', '.rrorr.', 'rrooorr', 'rooyoor', 'royyyor', '.ryyyr.'], ICON_COLORS),
    water: spriteFromMap(['...b...', '...b...', '..bbb..', '.bbwbb.', '.bwbbb.', '.bbbbb.', '..bbb..'], ICON_COLORS)
  };
  // 色の玉は役割ごとに色を変えて作る
  const ORB_MAP = ['..ccc..', '.ccccc.', 'ccwcccc', 'ccccccc', 'ccccccc', '.ccccc.', '..ccc..'];
  for (const name of ['red', 'blue', 'yellow', 'green']) {
    ICONS['orb_' + name] = spriteFromMap(ORB_MAP, { c: ROLES[name].color, w: '#ffffff' });
  }
  function roleIcon(role) {
    const r = ROLES[role];
    if (!r) return ICONS.ring;
    if (r.icon === 'orb') return ICONS['orb_' + role];
    return ICONS[r.icon];
  }

  // =====================================================================
  //  すごろくテレビの描画
  // =====================================================================
  const DICE_PIPS = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]
  };
  function makeDiceSet(body, shade, pip, onePip) {
    const set = {};
    for (let f = 1; f <= 6; f++) {
      const c = makeCanvas(13, 13);
      const g = c.getContext('2d');
      g.fillStyle = '#3a2d5a';
      g.fillRect(1, 0, 11, 13);
      g.fillRect(0, 1, 13, 11);
      g.fillStyle = body;
      g.fillRect(1, 1, 11, 11);
      g.fillStyle = shade;
      g.fillRect(1, 10, 11, 2);
      g.fillRect(10, 1, 2, 11);
      g.fillStyle = f === 1 ? onePip : pip;
      for (const [cx, cy] of DICE_PIPS[f]) g.fillRect(2 + cx * 3, 2 + cy * 3, 2, 2);
      set[f] = c;
    }
    return set;
  }
  const DICE_SETS = {
    normal: makeDiceSet('#fff8d8', '#c8bfe0', '#2a1a40', '#e83050'),
    gold: makeDiceSet('#ffd040', '#b06a10', '#5a3008', '#e83050'),
    super: makeDiceSet('#ff8fd0', '#c04a90', '#fff8d8', '#fff8d8')
  };

  function drawDice(face, x, y, angle) {
    const spr = (DICE_SETS[tv.diceKind] || DICE_SETS.normal)[clamp(face, 1, 6)];
    if (!angle) {
      ctx.drawImage(spr, px(x - 6), px(y - 6));
      return;
    }
    ctx.save();
    ctx.translate(px(x), px(y));
    ctx.rotate(angle);
    ctx.drawImage(spr, -6, -6);
    ctx.restore();
  }

  const SCREEN = { x: TV.x + 5, y: TV.y + 4, w: TV.w - 10, h: TV.h - 13 };
  const PIYO_BASE = { jitter: CONFIG.pins.jitter, centers: CONFIG.pockets.centers.slice(), half: CONFIG.pockets.half, pinsDx: CONFIG.pins.dx, pinsMargin: CONFIG.pins.margin, lostW: CONFIG.pusher.lostWidth, tvW: TV.w };
  // ワイド：盤面・ポケット・ピン・プッシャー・❌ゾーン・テレビを、画面の幅（W）に比例して広げる（メダルの大きさ・物理の数値・縦方向は そのまま）
  //   盤面／プッシャーの幅 136 → 136＋広がったぶん（係数 k）。ポケットの位置と口の幅・ピンの間隔と余白・❌ゾーンの幅は、同じ割合 k で広げます
  function piyoRelayout() {
    const dx = CONFIG.piyoWide && W > 180 ? W - 180 : 0;
    const k = (136 + dx) / 136;
    BOARD.right = 158 + dx; FIELD.right = 158 + dx;
    POCKETS.centers = PIYO_BASE.centers.map((x) => Math.round((22 + (x - 22) * k) * 10) / 10);
    const tn = CONFIG.piyoWideTune;
    POCKETS.half = PIYO_BASE.half * (1 + (k - 1) * tn.pocketHalf); POCKETS.width = POCKETS.half * 2;
    // ピン：メダルとの隙間（壁ぎわ・ピンの間隔）は、メダルの大きさで決まるので、そのまま。広がったぶんは、ピンの列を増やして埋める
    { const span = (136 + dx) - 2 * PIYO_BASE.pinsMargin; const cols = Math.max(1, Math.round(span / PIYO_BASE.pinsDx)); CONFIG.pins.dx = span / cols; CONFIG.pins.margin = PIYO_BASE.pinsMargin; }
    LOST_W = PIYO_BASE.lostW * (1 + (k - 1) * tn.lostW);
    CONFIG.pins.jitter = PIYO_BASE.jitter * (1 + (k - 1) * tn.jitter);       // 盤面が広がったぶん、ピンでの横のばらつきも少し増やす（ばらつきの割合を旧版に合わせる補正）
    CHUTES[1].l = 144 + dx; CHUTES[1].r = 158 + dx;
    TV.w = PIYO_BASE.tvW + dx;
    SCREEN.x = TV.x + 5; SCREEN.w = TV.w - 10;
    buildPins(); floorCanvas = build_floorCanvas(); boardCanvas = build_boardCanvas();
  }
  const MAP_TOP = SCREEN.y + 9;
  const GROUND_Y = SCREEN.y + 60;
  const TILE_W = 18;
  const TILE_H = 11;
  const BAR_Y = SCREEN.y + SCREEN.h - 18;

  // ---- エリアごとの景色 ----
  const THEMES = {
    plains:  { sky: ['#5a8ae0', '#6a9ae8', '#7aaaf0', '#8ab8f0', '#a0c8f8'], hill: '#3a9a5a', hillTop: '#5ac87a', ground: '#4aaa4a', dot: '#3f963f', line: '#7ad87a' },
    forest:  { sky: ['#1f4a3a', '#2a5a44', '#34684e', '#3e7658', '#4a8462'], hill: '#14382a', hillTop: '#1f5038', ground: '#2f7a3a', dot: '#286a32', line: '#4a9a50' },
    cave:    { sky: ['#140c2a', '#1c1238', '#241846', '#2c1e54', '#342462'], hill: '#3a2a5a', hillTop: '#5a4a8a', ground: '#4a3a6a', dot: '#3e305c', line: '#7a6aa8' },
    castle:  { sky: ['#2a2a4a', '#343456', '#3e3e62', '#48486e', '#52527a'], hill: '#5a5a72', hillTop: '#7a7a92', ground: '#6a6a7a', dot: '#5c5c6c', line: '#9a9aaa' },
    volcano: { sky: ['#4a0a1a', '#6a1420', '#8a2026', '#aa3a2a', '#c85a30'], hill: '#3a1a1a', hillTop: '#5a2a22', ground: '#5a2a1a', dot: '#4a2214', line: '#ff7030' }
  };

  function makeScenery(themeName) {
    const th = THEMES[themeName];
    const w = 128;
    const h = GROUND_Y - MAP_TOP;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    th.sky.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(0, Math.floor((i * h) / th.sky.length), w, Math.ceil(h / th.sky.length) + 1);
    });
    const put = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
    if (themeName === 'plains') {
      g.fillStyle = '#e8f0ff';
      for (const [cx, cy] of [[14, 10], [66, 6], [100, 14]]) { g.fillRect(cx, cy, 14, 3); g.fillRect(cx + 3, cy - 2, 7, 2); }
    }
    if (themeName === 'cave' || themeName === 'castle') {
      for (let i = 0; i < 10; i++) put((i * 41) % w, 3 + ((i * 17) % 16), '#c8d0ff');
    }
    // 丘や山の形
    for (let x = 0; x < w; x++) {
      let hy;
      if (themeName === 'volcano') hy = Math.round(h - 8 - Math.max(0, 22 - Math.abs(((x + 20) % 64) - 32)) * 0.9);
      else if (themeName === 'castle') hy = (x % 32 < 24) ? h - 22 - ((x % 8) < 4 && x % 32 < 24 ? 3 : 0) : h - 12;
      else hy = Math.round(h - 10 - 6 * Math.sin((x / w) * Math.PI * 4) - 3 * Math.sin((x / w) * Math.PI * 10));
      g.fillStyle = th.hill;
      g.fillRect(x, hy, 1, h - hy);
      put(x, hy, th.hillTop);
    }
    if (themeName === 'forest') {
      for (let i = 0; i < 6; i++) {               // 木
        const tx = 6 + i * 21;
        for (let k = 0; k < 10; k++) g.fillRect(tx - Math.floor(k / 2), h - 22 + k, 1 + Math.floor(k / 2) * 2, 1);
        g.fillStyle = '#0c2418';
        for (let k = 0; k < 10; k++) g.fillRect(tx - Math.floor(k / 2), h - 22 + k, 1 + Math.floor(k / 2) * 2, 1);
        g.fillStyle = '#4a2a14';
        g.fillRect(tx, h - 12, 1, 3);
      }
    }
    if (themeName === 'cave') {
      for (let i = 0; i < 7; i++) {               // 結晶
        const cx = 8 + i * 18;
        const cy = h - 14 - (i % 3) * 3;
        g.fillStyle = '#5ce8ff';
        g.fillRect(cx, cy - 4, 1, 5);
        g.fillRect(cx - 1, cy - 2, 3, 3);
        put(cx, cy - 4, '#ffffff');
      }
      g.fillStyle = '#2a1a48';                    // つらら
      for (let x = 0; x < w; x += 9) g.fillRect(x, 0, 2, 3 + (x % 5));
    }
    if (themeName === 'castle') {
      g.fillStyle = '#3a3a52';                    // 石垣の目地
      for (let y = h - 20; y < h; y += 4) for (let x = (y % 8 === 0 ? 0 : 4); x < w; x += 8) g.fillRect(x, y, 1, 3);
    }
    if (themeName === 'volcano') {
      g.fillStyle = '#ff9a30';
      for (let i = 0; i < 4; i++) { const x = (i * 64 + 12) % w; g.fillRect(x, 6 + i, 1, 2); }
    }
    return c;
  }
  const SCENERY = {};
  for (const name of Object.keys(THEMES)) SCENERY[name] = makeScenery(name);

  // ---- アイコン（7×7） ----
  ICONS.map = spriteFromMap(['yyyyyyy', 'ywwwwwy', 'ywbwwwy', 'ywwbwry', 'ywwwbwy', 'ywwwwwy', 'yyyyyyy'], ICON_COLORS);
  ICONS.bag = spriteFromMap(['.o...o.', '..ooo..', '.yyyyy.', 'yyyoyyy', 'yyoooyy', 'yyyoyyy', '.yyyyy.'], ICON_COLORS);
  ICONS.question = spriteFromMap(['.wwww..', 'ww..ww.', '....ww.', '...ww..', '..ww...', '.......', '..ww...'], ICON_COLORS);
  ICONS.heart = spriteFromMap(['.rr.rr.', 'rwrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    { r: '#ff5070', w: '#ffd0d8' });
  const GRASS = spriteFromMap(['..g..g..', '.gg.ggg.', 'gggggggg', '.gggggg.'], { g: '#5ac85a' });
  const BIRD = spriteFromMap(['w...w', '.w.w.', '..w..'], { w: '#fff8d8' });

  // ---- 敵・仕掛けのドット絵 ----
  ENEMY.wolf = spriteFromMap([
    '...o.o..........',
    '..ogogo.........',
    '.ogggggoooooo...',
    'oggkgggggggggoo.',
    'ogggggggggggggo.',
    '.owwgggggggggggo',
    '..ooggggggggggo.',
    '...ogo.ogo.ogo..',
    '...ogo.ogo.ogo..',
    '...oo..oo..oo...'
  ], { o: '#2a2a40', g: '#9a9ab8', k: '#ff4060', w: '#fff8d8' });
  ENEMY.treant = spriteFromMap([
    '.....gggggggg.......',
    '...gggllggggggg.....',
    '..gggggggggglggg....',
    '.gggglgggggggggggg..',
    'gggggggggggllggggg..',
    'ggglggggggggggggggg.',
    '.gggggggggggggggg...',
    '...ggoobbbbbbooggg..',
    '.....obbbbbbbbo.....',
    '.....obkkbbkkbo.....',
    '.....obkybbkybo.....',
    '.....obbbbbbbbo.....',
    '.....obmmmmmmbo.....',
    '....oobbbbbbbboo....',
    '...obbbobbbbobbbo...',
    '..obbo.obbbbo.obbo..',
    '..oo...obbbbo...oo..',
    '......obbbbbbo......',
    '.....obbooobbbo.....',
    '....oooo...oooo.....'
  ], { g: '#2f8a3a', l: '#5ac85a', o: '#2a1408', b: '#7a4a24', k: '#1a0a04', y: '#ffd040', m: '#3a1a0a' });
  ENEMY.track = spriteFromMap([
    '.kk......kk.',
    'kkkk....kkkk',
    '.kk......kk.',
    '............',
    '....kk......',
    '...kkkk.....',
    '....kk......'
  ], { k: '#3a2410' });
  ENEMY.brokenTree = spriteFromMap([
    '..........gg....',
    '.........gggg...',
    'oooooooooogggg..',
    'obbbbbbbbbbggg..',
    'obbbbbbbbbbbo...',
    'oooooooooooo....'
  ], { o: '#2a1408', b: '#7a4a24', g: '#2f8a3a' });
  ENEMY.nest = spriteFromMap([
    '..o.o..o..o.o.o...',
    '.oboobooboobbobo..',
    'obbbbwwbbwwbbbbbo.',
    'obbbbwwbbwwbbbbbbo',
    '.obbbbbbbbbbbbbbo.',
    '..oooooooooooooo..'
  ], { o: '#2a1408', b: '#8a5a2a', w: '#f0e8d0' });

  const pulse = (speed) => 0.5 + 0.5 * Math.sin(time * speed);   // ゆっくり明るさが変わる（点滅させない）

  // ---- 背景 ----
  function drawScenery(themeName, travel) {
    const th = THEMES[themeName];
    const sc = SCENERY[themeName];
    const sw = sc.width;
    const off = -((travel * 22 * 0.35) % sw);
    for (let x = SCREEN.x + off; x < SCREEN.x + SCREEN.w; x += sw) ctx.drawImage(sc, px(x), MAP_TOP);
    rect(SCREEN.x, GROUND_Y, SCREEN.w, BAR_Y - GROUND_Y, th.ground);
    const shift = px(-(travel * 22) % 4);
    for (let y = GROUND_Y; y < BAR_Y; y += 2) {
      for (let x = SCREEN.x + ((y / 2) % 2) * 2 + shift; x < SCREEN.x + SCREEN.w; x += 4) rect(x, y, 1, 1, th.dot);
    }
    rect(SCREEN.x, GROUND_Y, SCREEN.w, 1, th.line);
    for (let i = 0; i < 4; i++) {
      const gx = SCREEN.x + ((i * 29 + 10 - travel * 22) % (SCREEN.w + 16) + SCREEN.w + 16) % (SCREEN.w + 16) - 8;
      ctx.drawImage(GRASS, px(gx), GROUND_Y + 8 + (i % 2) * 6);
    }
  }

  function drawPiyo(x, y, mode) {
    let sprite = CHAR_IDLE;
    if (G.sad > 0) sprite = CHAR_SAD;
    else if (mode === 'jump') sprite = CHAR_JUMP;
    else if (mode === 'throw') sprite = CHAR_THROW;
    // レベルアップ：やさしく光る（点滅はさせない）
    if (G.levelFx > 0) {
      ctx.globalAlpha = Math.min(1, G.levelFx) * 0.45;
      rect(x - 8, y - 3, 17, 16, C.goldLight);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(sprite, px(x - 5), px(y));
  }

  function hpColor(hp, max) {
    return hp <= Math.ceil(max * 0.3) ? C.pink : C.green;
  }

  // ---- 3つのゲージ ----
  function drawGauges(x, y) {
    GAUGES.forEach((g, i) => {
      const v = G.gauge[g.id];
      const max = CONFIG.gauges[g.id];
      const yy = y + i * 9;
      const almost = v === max - 1;
      const fx = G.gaugeFx[g.id];
      rect(x, yy, 7 + 3 + max * 6 + 1, 9, 'rgba(10,6,24,0.72)');
      if (fx > 0) {
        ctx.globalAlpha = fx * 0.5;
        rect(x, yy, 7 + 3 + max * 6 + 1, 9, '#5a4a9a');
        ctx.globalAlpha = 1;
      }
      const icon = g.id === 'explore' && G.bossFound && !G.bossCleared ? ICONS.skull : ICONS[g.icon];
      ctx.drawImage(icon, x + 1, yy + 1);
      for (let k = 0; k < max; k++) {
        const on = k < v;
        const bx = x + 10 + k * 6;
        rect(bx, yy + 2, 5, 5, on ? g.color : '#2a2458');
        if (on) rect(bx, yy + 2, 5, 1, C.white);
        if (almost && k === v) {                       // 「あと1」は白い枠でじんわり
          ctx.globalAlpha = 0.4 + 0.5 * pulse(3);
          rect(bx, yy + 2, 5, 1, C.white); rect(bx, yy + 6, 5, 1, C.white);
          rect(bx, yy + 2, 1, 5, C.white); rect(bx + 4, yy + 2, 1, 5, C.white);
          ctx.globalAlpha = 1;
        }
      }
    });
  }

  // ---- ピヨちゃんのステータス ----
  function drawStatus(x, y) {
    const p = G.piyo;
    rect(x, y, 43, 27, 'rgba(10,6,24,0.72)');
    drawText('LV ' + p.lv, x + 2, y + 2, C.white, 1);
    drawText('ATK ' + p.atk, x + 22, y + 2, C.goldLight, 1);
    drawText('HP ' + p.hp + '/' + p.maxHp, x + 2, y + 9, hpColor(p.hp, p.maxHp), 1);
    rect(x + 2, y + 15, 39, 2, '#2a1a40');
    rect(x + 2, y + 15, Math.round((39 * p.hp) / p.maxHp), 2, hpColor(p.hp, p.maxHp));
    const need = expNeed();
    drawText(need ? 'EXP ' + p.exp + '/' + need : 'EXP MAX', x + 2, y + 20, '#a8c8ff', 1);
  }

  // ---- 通常（冒険）画面 ----
  function drawAdventureScreen() {
    const r = G.react;
    const idle = G.idle;
    drawScenery(area().theme, G.travel);
    const baseX = SCREEN.x + SCREEN.w / 2 - 2;
    let y = GROUND_Y - 4;
    let mode = 'idle';
    const k = r ? r.t / r.dur : 0;
    if (r) {
      if (r.kind === 'hunt') { mode = 'throw'; y -= Math.sin(Math.min(1, k * 2) * Math.PI) * 5; }
      else if (r.kind === 'explore') y -= Math.floor(time * 4) % 2;
      else if (r.kind === 'treasure') y += 2;
      else if (r.kind === 'event') y -= Math.abs(Math.sin(k * Math.PI * 2)) * 3;
    } else if (idle) {
      if (idle.kind === 'walk') y -= Math.floor(time * 4) % 2;
      else if (idle.kind === 'sit') y += 2;
      else if (idle.kind === 'search') y += 1;
    }
    if (G.joy > 0) { mode = 'jump'; y -= Math.abs(Math.sin(time * 6)) * 5; }
    drawPiyo(baseX, y, mode);

    if (r && r.kind === 'hunt') ctx.drawImage(ICONS.sword, px(baseX + 6), px(y - 2));
    if ((r && r.kind === 'explore') || (idle && idle.kind === 'map')) ctx.drawImage(ICONS.map, px(baseX + 5), px(y + 3));
    if ((r && r.kind === 'treasure') || (idle && idle.kind === 'search')) {
      ctx.drawImage(GRASS, px(baseX + 6 + Math.sin(time * 14)), px(GROUND_Y + 3));
      if (r) drawStar(px(baseX + 12), px(GROUND_Y + 1), C.yellow);
    }
    if (r && r.kind === 'event') drawTextCenter('?', baseX + 1, y - 9 - Math.abs(Math.sin(time * 6)) * 2, C.pink, 2, '#2a1a40');
    if (idle && idle.kind === 'sit') drawText('Z', px(baseX + 6), px(y - 6 - (idle.t * 3) % 4), C.white, 1);
    if (idle && idle.kind === 'look') drawText('...', px(baseX + 7), px(y - 4), C.white, 1);
    if (idle && idle.kind === 'bird') {
      const bx = SCREEN.x + SCREEN.w - (idle.t / idle.dur) * (SCREEN.w + 10);
      ctx.drawImage(BIRD, px(bx), px(MAP_TOP + 32 + Math.sin(idle.t * 6) * 3));
    }

    if (!CONFIG.adventure.instantEvents) drawGauges(SCREEN.x + 2, MAP_TOP + 1);       // 試遊中（instantEvents）は、ゲージを出さない
    drawStatus(SCREEN.x + SCREEN.w - 45, MAP_TOP + 1);
    if (!G.bossCleared) drawExploreSteps(SCREEN.x + 3, MAP_TOP + 30);
    drawFloaters(baseX, y - 10, baseX, y - 10);
  }

  function drawFloaters(piyoX, piyoY, enemyX, enemyY) {
    for (const f of tvFloaters) {
      const x = f.who === 'piyo' ? piyoX : f.who === 'enemy' ? enemyX : SCREEN.x + SCREEN.w / 2;
      const y0 = f.who === 'piyo' ? piyoY : f.who === 'enemy' ? enemyY : MAP_TOP + 26;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 0.5) * 2);
      drawTextCenter(f.text, x + f.x, y0 - f.t * 14, f.color, f.who === 'center' ? 2 : 1, '#2a1a40');
      ctx.globalAlpha = 1;
    }
  }

  // ---- 戦闘画面 ----
  function drawBattleScreen(ev) {
    const def = ev.def;
    drawScenery(area().theme, G.travel);
    const groundY = GROUND_Y + 11;
    // ボス登場：画面がゆっくり暗くなってから現れる
    const introDark = ev.boss && ev.phase === 'intro' ? Math.min(0.7, ev.timer / 1.2) * (ev.timer < 2.2 ? 1 : Math.max(0, 1 - (ev.timer - 2.2) / 0.8)) : 0;

    const p = G.piyo;
    let piyoX = SCREEN.x + 20 + (ev.piyoFx > 0 ? Math.sin((1 - ev.piyoFx) * Math.PI) * 18 : 0);
    if (ev.piyoHitFx > 0) piyoX -= Math.sin(ev.piyoHitFx * 30) * 2;
    let piyoY = groundY - 11 - (G.joy > 0 ? Math.abs(Math.sin(time * 6)) * 5 : 0);
    drawPiyo(piyoX, piyoY, G.joy > 0 ? 'jump' : ev.piyoFx > 0 ? 'throw' : 'idle');
    if (ev.piyoFx > 0) ctx.drawImage(ICONS.sword, px(piyoX + 6), px(piyoY - 2));

    const spr = ENEMY[def.sprite];
    const cx = SCREEN.x + SCREEN.w - 26;
    const enter = Math.min(1, ev.timer / 0.8 + (ev.phase === 'intro' ? 0 : 1));
    let ex = cx - spr.width / 2 + (1 - enter) * 50 - (ev.enemyFx > 0 ? Math.sin((1 - ev.enemyFx) * Math.PI) * 14 : 0);
    let ey = groundY - spr.height;
    if (ev.enemyHitFx > 0) ex += Math.sin(ev.enemyHitFx * 30) * 2;
    if (ev.done && ev.win) ctx.globalAlpha = Math.max(0, 1 - ev.timer * 0.8);
    if (!(ev.boss && ev.phase === 'intro' && ev.timer < 1.4)) ctx.drawImage(spr, px(ex), px(ey));
    ctx.globalAlpha = 1;

    if (introDark > 0) {
      ctx.globalAlpha = introDark;
      rect(SCREEN.x, MAP_TOP, SCREEN.w, BAR_Y - MAP_TOP, C.black);
      ctx.globalAlpha = 1;
      if (ev.timer > 1.0) {                           // 暗やみに光る目
        rect(cx - 6, MAP_TOP + 30, 3, 2, '#ffd040');
        rect(cx + 2, MAP_TOP + 30, 3, 2, '#ffd040');
      }
    }

    // HP（PIYO VS 敵）
    const bw = 38;
    rect(SCREEN.x + 2, MAP_TOP + 1, 42, 17, 'rgba(10,6,24,0.75)');
    drawText('PIYO', SCREEN.x + 4, MAP_TOP + 3, C.yellow, 1);
    drawText(p.hp + '/' + p.maxHp, SCREEN.x + 42 - textWidth(p.hp + '/' + p.maxHp, 1), MAP_TOP + 3, hpColor(p.hp, p.maxHp), 1);
    rect(SCREEN.x + 4, MAP_TOP + 11, bw, 4, '#2a1a40');
    rect(SCREEN.x + 4, MAP_TOP + 11, Math.round((bw * p.hp) / p.maxHp), 4, hpColor(p.hp, p.maxHp));

    const rx = SCREEN.x + SCREEN.w - 44;
    rect(rx, MAP_TOP + 1, 42, 17, 'rgba(10,6,24,0.75)');
    const lab = def.label.length > 6 ? def.label.split(' ').pop() : def.label;
    drawText(lab, rx + 2, MAP_TOP + 3, C.pink, 1);
    drawText(ev.hp + '/' + ev.maxHp, rx + 40 - textWidth(ev.hp + '/' + ev.maxHp, 1), MAP_TOP + 3, C.white, 1);
    rect(rx + 2, MAP_TOP + 11, bw, 4, '#2a1a40');
    rect(rx + 2, MAP_TOP + 11, Math.round((bw * ev.hp) / ev.maxHp), 4, ev.boss ? '#ff9a30' : C.pink);
    drawTextCenter('VS', SCREEN.x + SCREEN.w / 2 + 0.5, MAP_TOP + 22, C.white, 1, '#2a1a40');

    // 次の行動待ち（入賞がたまっているとき）
    if (ev.queue.length) drawText('x' + ev.queue.length, SCREEN.x + 4, MAP_TOP + 20, C.cyan, 1, '#2a1a40');

    drawFloaters(piyoX, piyoY - 6, cx, ey - 4);
  }

  // ---- 探索画面 ----
  function drawExploreScreen(ev) {
    drawScenery(area().theme, G.travel + G.stateT * 0.3);
    const groundY = GROUND_Y + 11;
    const piyoX = SCREEN.x + 24;
    drawPiyo(piyoX, groundY - 11 - (Math.floor(G.stateT * 4) % 2), 'idle');
    const cx = SCREEN.x + SCREEN.w - 30;
    const sp = ev.step.sprite;
    if (sp === 'roar') {
      // 木がゆれて、遠くから声
      const sh = Math.sin(time * 20) * 1.5;
      drawText('!!', px(cx - 3 + sh), px(MAP_TOP + 24), C.pink, 2, '#2a1a40');
    } else {
      const spr = ENEMY[sp];
      if (spr) ctx.drawImage(spr, px(cx - spr.width / 2), px(groundY - spr.height));
    }
    if (ev.discover && G.stateT > 1.2) {
      ctx.globalAlpha = Math.min(1, (G.stateT - 1.2) / 0.8) * 0.85;
      ctx.drawImage(ENEMY.treant, px(cx - 10), px(MAP_TOP + 6));
      ctx.globalAlpha = 1;
    }
    // ボス発見までの段階
    drawExploreSteps(SCREEN.x + 3, MAP_TOP + 3);
  }

  function drawExploreSteps(x, y) {
    rect(x - 1, y - 1, 45, 9, 'rgba(10,6,24,0.72)');
    drawText('BOSS', x + 1, y + 1, G.bossFound ? C.pink : C.dim, 1);
    for (let i = 0; i < EXPLORE_STEPS.length; i++) {
      rect(x + 19 + i * 6, y + 1, 5, 5, i < G.exploreCount ? (G.bossFound ? C.pink : C.cyan) : '#2a2458');
    }
  }

  // ---- 宝箱画面 ----
  function drawTreasureScreen(ev) {
    drawScenery(area().theme, G.travel);
    const groundY = GROUND_Y + 11;
    const piyoX = SCREEN.x + 24;
    drawPiyo(piyoX, groundY - 11 - (G.joy > 0 ? Math.abs(Math.sin(time * 6)) * 5 : 0), G.joy > 0 ? 'jump' : 'idle');
    const cx = SCREEN.x + SCREEN.w - 30;
    const spr = ENEMY.bigchest;
    const ey = groundY - spr.height;
    ctx.drawImage(spr, px(cx - spr.width / 2), px(ey));
    if (ev.opened) {
      const icon = roleIcon(ev.result);
      const rise = Math.min(1, ev.timer / 0.6) * 10;
      ctx.drawImage(icon, px(cx - 3), px(ey - 4 - rise));
      if (ev.result !== 'empty') for (let i = 0; i < 3; i++) drawStar(px(cx - 8 + i * 8), px(ey - 8 - rise), C.yellow);
    }
  }

  // ---- AREA CLEAR / ENDING ----
  function drawClearScreen() {
    drawScenery('plains', G.travel + G.stateT * 0.5);
    const c = G.clear;
    const midX = SCREEN.x + SCREEN.w / 2;
    drawPiyo(midX, GROUND_Y - 4 - Math.abs(Math.sin(time * 5)) * 6, 'jump');
    for (let i = 0; i < 6; i++) {
      const a = time * 1.2 + (i * Math.PI) / 3;
      drawStar(px(midX + Math.cos(a) * 24), px(MAP_TOP + 34 + Math.sin(a) * 10), [C.yellow, C.pink, C.cyan][i % 3]);
    }
    drawTextCenter('FOREST', midX, MAP_TOP + 4, C.green, 2, '#2a1a40');
    drawTextCenter('CLEAR!', midX, MAP_TOP + 16, C.yellow, 2, '#2a1a40');
    if (c && c.done) drawTextCenter('TO BE CONTINUED', midX, GROUND_Y + 14, C.white, 1, '#2a1a40');
  }

