'use strict';
  // =====================================================================
  //  DUCK RACE（3台目のメダルゲーム）
  //   レース生成 → オッズ表示 → BET → 着順を先に決定 → その着順になるようにアニメーション → 払い戻し
  //   見た目の動きで勝ち負けは決まりません。オッズと当たりやすさは、同じ勝率から計算しています
  // =====================================================================
  const DKC = CONFIG.duckRace;
  const DKD = DKC.debug;
  const DUCKS = DKC.ducks.slice(0, DKC.duckCount);
  const BET_TYPES = [
    { id: 'win', label: 'WIN', jp: '単勝', need: 1 },
    { id: 'exacta', label: 'EXACTA', jp: '1・2着', need: 2 },
    { id: 'tri', label: 'TRIFECTA', jp: '3連単', need: 3 }
  ];
  // ---- 縦型レース：下がスタート、上がゴール。カメラは固定で、コース全体を1画面に ----
  let DK_COURSE = { x: 12, y: 50, w: 156, h: 182 };      // 縦長のレース場
  const DK_WALL = 5;                                         // 左右のふち（お風呂のタイル）
  const DK_Y_START = 200;      // スタートのときの、アヒルの中心の高さ（下）
  const DK_Y_GOAL = 74;        // ゴールしたときの、アヒルの中心の高さ（上）
  const DK_FIN_Y = 66;         // ゴールライン
  const DK_START_Y = 213;      // スタートライン
  const DK_GATE_Y = 187;       // スタートのゲート（アヒルの前）
  const DK_HALF = 11.5;        // アヒルの半分の幅
  let DK_LANE_X = (i) => 29.5 + i * 24.2;                 // 6羽が横一列に並ぶ、スタート位置
  let DK_MSG_BOX = { x: 14, y: 332, w: 152, h: 25 };
  // 下半分：賭け方・アヒル・えらんだアヒル・オッズ・BET
  let dkTabRect = (i) => [{ x: 12, y: 235, w: 34, h: 12 }, { x: 48, y: 235, w: 42, h: 12 }, { x: 92, y: 235, w: 46, h: 12 }][i];
  let DK_CLEAR = { x: 142, y: 235, w: 26, h: 12 };
  let dkBtnRect = (i) => ({ x: 12 + i * 26, y: 249, w: 24, h: 30 });
  let DK_ODDS = { x: 12, y: 301, w: 66, h: 28 };
  let DK_STAKE_UP = { x: 80, y: 301, w: 18, h: 13 };
  let DK_STAKE_DN = { x: 80, y: 316, w: 18, h: 13 };
  let DK_BET = { x: 120, y: 301, w: 48, h: 28 };
  // ワイド配置：画面の論理幅（W）に合わせて、横方向の配置・間隔を作り直す（アヒルや文字の大きさは、そのまま。レースの計算には関係しません）
  function dkRelayout() {
    const dx = W - 180;
    if (dx <= 0) {                                               // いつもの配置（元の値）
      DK_COURSE = { x: 12, y: 50, w: 156, h: 182 };
      DK_LANE_X = (i) => 29.5 + i * 24.2;
      DK_MSG_BOX = { x: 14, y: 332, w: 152, h: 25 };
      dkTabRect = (i) => [{ x: 12, y: 235, w: 34, h: 12 }, { x: 48, y: 235, w: 42, h: 12 }, { x: 92, y: 235, w: 46, h: 12 }][i];
      DK_CLEAR = { x: 142, y: 235, w: 26, h: 12 };
      dkBtnRect = (i) => ({ x: 12 + i * 26, y: 249, w: 24, h: 30 });
      DK_ODDS = { x: 12, y: 301, w: 66, h: 28 };
      DK_STAKE_UP = { x: 80, y: 301, w: 18, h: 13 };
      DK_STAKE_DN = { x: 80, y: 316, w: 18, h: 13 };
      DK_BET = { x: 120, y: 301, w: 48, h: 28 };
      return;
    }
    const od = Math.round(dx * 0.5);
    DK_COURSE = { x: 12, y: 50, w: 156 + dx, h: 182 };
    DK_LANE_X = (i) => 17 + ((146 + dx) * (i + 0.5)) / 6;         // 6羽を、広いコースに均等に
    DK_MSG_BOX = { x: 14, y: 332, w: 152 + dx, h: 25 };
    const wt = Math.floor((156 + dx - 26 - 8) / 3);               // 賭け方のタブ3つ（間に4ドット）＋ CLEAR
    dkTabRect = (i) => ({ x: 12 + i * (wt + 4), y: 235, w: wt, h: 12 });
    DK_CLEAR = { x: 12 + 156 + dx - 26, y: 235, w: 26, h: 12 };
    const pitch = (158 + dx) / 6;                                 // アヒルのボタン6つ
    dkBtnRect = (i) => ({ x: Math.round(12 + i * pitch), y: 249, w: Math.round(pitch) - 2, h: 30 });
    DK_ODDS = { x: 12, y: 301, w: 66 + od, h: 28 };
    DK_STAKE_UP = { x: 80 + od, y: 301, w: 18, h: 13 };
    DK_STAKE_DN = { x: 80 + od, y: 316, w: 18, h: 13 };
    DK_BET = { x: 120 + dx, y: 301, w: 48, h: 28 };
  }

  // URLに ?duckdebug=kuromame,photo,highodds を付けたときのデバッグ設定
  (function parseDuckDebug() {
    try {
      const q = new URLSearchParams(location.search).get('duckdebug');
      if (!q) return;
      DKD.enabled = true;
      for (const k of q.split(',')) {
        if (k === 'photo') DKD.forcePhotoFinish = true;
        else if (k === 'highodds') DKD.forceHighOdds = true;
        else if (DUCKS.some((d) => d.id === k)) DKD.forceWinner = k;
      }
    } catch (e) { /* 何もしない */ }
  })();

  const DK = {
    stake: 1,
    phase: 'bet',            // bet（BET）/ ready（スタート前）/ race（レース中）/ result（結果）
    t: 0, clock: 0, raceClock: 0,
    p: [],                   // 今回のレースの勝率
    sel: { type: 'win', picks: [] },
    ticket: null, order: [], plan: null,
    applied: false, hit: false, gain: 0, revealed: false, newRecord: false,
    finished: [], commIdx: 0, pfShown: false, goShown: false, lastTick: -1,
    fx: [], banner: null, glow: null, noMedalT: 0,
    face: [1, 1, 1, -1, -1, -1]      // アヒルの向き（1＝右向き、-1＝左向き）
  };
  const curBetType = () => BET_TYPES.find((t) => t.id === DK.sel.type);
  const dkIndexOf = (x) => (typeof x === 'number' ? x - 1 : DUCKS.findIndex((d) => d.id === x));

  function randn() {
    let u = 0;
    while (u === 0) u = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  }

  // ---- レースの生成：毎回、本命・対抗・穴が自然に出るように勝率を作る ----
  function dkNewRace() {
    const s = DUCKS.map(() => Math.exp(DKC.strengthSpread * randn()));
    let sum = s.reduce((a, b) => a + b, 0);
    let p = s.map((v) => Math.max(v / sum, DKC.minWinRate));
    sum = p.reduce((a, b) => a + b, 0);
    DK.p = p.map((v) => v / sum);
    DK.sel.picks = [];
  }

  // ---- 確率とオッズ（同じ勝率から計算するので、表示オッズと当たりやすさが対応します） ----
  function dkProb(type, picks) {
    const p = DK.p;
    const [a, b, c] = picks;
    if (type === 'win') return p[a];
    if (type === 'exacta') return (p[a] * p[b]) / (1 - p[a]);
    return (((p[a] * p[b]) / (1 - p[a])) * p[c]) / (1 - p[a] - p[b]);
  }
  function dkOdds(prob) {
    let o = (1 - DKC.houseEdge) / prob;
    o = Math.min(o, DKC.maxOdds);
    o = o >= 100 ? Math.round(o) : Math.floor(o * 10) / 10;       // 小数1桁（切り捨て）
    return Math.max(1.1, o);
  }
  const dkPayoutOf = (odds, bet) => Math.round(odds * bet);       // 払い出しは整数（四捨五入）
  const fmtOdds = (o) => (o >= 100 ? String(Math.round(o)) : o.toFixed(1));

  // ---- 着順の決定（勝率に比例して、1着 → 2着 → 3着… と順番に抽選） ----
  function dkSampleOrder() {
    const pool = DUCKS.map((_, i) => i);
    const order = [];
    while (pool.length) {
      const tot = pool.reduce((a, i) => a + DK.p[i], 0);
      let r = Math.random() * tot;
      let k = 0;
      for (; k < pool.length; k++) { r -= DK.p[pool[k]]; if (r < 0) break; }
      order.push(pool.splice(Math.min(k, pool.length - 1), 1)[0]);
    }
    return order;
  }
  function dkPickOrder() {
    let order = dkSampleOrder();
    if (DKD.enabled) {
      if (DKD.forceHighOdds) {
        let best = order;
        let bp = Infinity;
        for (let k = 0; k < 400; k++) {
          const o = dkSampleOrder();
          const pr = dkProb('tri', o.slice(0, 3));
          if (pr < bp) { bp = pr; best = o; }
        }
        order = best;
      }
      if (Array.isArray(DKD.forceOrder) && DKD.forceOrder.length) {
        const forced = DKD.forceOrder.map(dkIndexOf).filter((i) => i >= 0 && i < DUCKS.length);
        order = forced.concat(order.filter((i) => forced.indexOf(i) < 0));
      } else if (DKD.forceWinner !== null && DKD.forceWinner !== undefined && dkIndexOf(DKD.forceWinner) >= 0) {
        const w = dkIndexOf(DKD.forceWinner);
        order = [w].concat(order.filter((i) => i !== w));
      }
    }
    return order;
  }

  // ---- レース展開の組み立て：決まった着順になるように、アヒルごとの動きを作る ----
  function pchip(xs, ys) {                      // 逆戻りしないなめらかな補間
    const n = xs.length;
    const h = [];
    const d = [];
    const m = new Array(n);
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0];
      for (let i = 0; i < n - 1; i++) {
        if (x <= xs[i + 1]) {
          const t = (x - xs[i]) / h[i];
          const t2 = t * t;
          const t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
        }
      }
      return ys[n - 1];
    };
  }

  function dkPlan(order) {
    const n = DUCKS.length;
    const D = DKC.raceDuration;
    const winner = order[0];
    const wl = Object.keys(DKC.patternWeights).map((k) => ({ k, w: DKC.patternWeights[k] }));
    if (DK.p[winner] < 0.12) {                     // 穴のアヒルが勝つときは、逆転の展開を多めに
      for (const e of wl) {
        if (e.k === 'comeback' || e.k === 'lastspurt') e.w *= 2.2;
        else if (e.k === 'wire' || e.k === 'blowout') e.w *= 0.35;
      }
    }
    const pat = pickWeighted(wl, 'w').k;
    const pf = (DKD.enabled && DKD.forcePhotoFinish) || Math.random() < DKC.photoFinishRate;
    let g = [];
    for (let k = 0; k < n - 1; k++) g.push(rand(0.3, 0.75));
    if (pat === 'blowout') g[0] = rand(1.2, 1.9);
    if (pat === 'close') g = g.map(() => rand(0.1, 0.25));
    if (pf) g[0] = rand(0.03, 0.07);
    const tFin = new Array(n);
    tFin[order[0]] = D;
    for (let k = 1; k < n; k++) tFin[order[k]] = tFin[order[k - 1]] + g[k - 1];

    const finalRank = new Array(n);
    order.forEach((d, r) => { finalRank[d] = r; });
    const story = {
      wire: [randInt(0, 1), 0, 0],
      comeback: [randInt(3, n - 1), randInt(1, 3), 0],
      lastspurt: [randInt(2, 4), randInt(2, 4), randInt(1, 2)],
      close: [randInt(0, 2), randInt(0, 2), randInt(0, 1)],
      blowout: [0, 0, 0]
    }[pat];
    const CP = [0.2, 0.45, 0.7];
    const noise = [1.5, 1.0, 0.55];
    const delta = [0.95, 0.85, 0.6].map((v) => v * (pat === 'close' ? 0.5 : 1));      // 順位ごとの差：序盤・中盤は大きく離れて、ゴール前で詰まる
    const cpRank = [];
    for (let k = 0; k < 3; k++) {
      const sc = DUCKS.map((_, d) => ({ d, s: finalRank[d] + noise[k] * randn() }));
      sc.sort((a, b) => a.s - b.s);
      let perm = sc.map((o) => o.d).filter((d) => d !== winner);
      perm.splice(Math.min(story[k], perm.length), 0, winner);
      const rk = new Array(n);
      perm.forEach((d, r) => { rk[d] = r; });
      cpRank.push(rk);
    }
    const knots = [];
    for (let d = 0; d < n; d++) {
      const xs = [0, 1.1];
      const ys = [0, rand(0.03, 0.08)];                   // スタート直後は、順位に関係なく勢いよく
      for (let k = 0; k < 3; k++) { xs.push(D * CP[k] + cpRank[k][d] * delta[k] + rand(-0.05, 0.05)); ys.push(CP[k]); }
      xs.push(tFin[d]); ys.push(1);
      const vmax = DKC.maxSpeed;                  // 急加速にも上限をつける（順位が大きく入れかわる区間が、速すぎないように）
      for (let i = xs.length - 2; i >= 1; i--) xs[i] = Math.min(xs[i], xs[i + 1] - (ys[i + 1] - ys[i]) / vmax);   // ゴール時刻は動かさない
      for (let i = 1; i < xs.length - 1; i++) xs[i] = Math.max(xs[i], xs[i - 1] + (ys[i] - ys[i - 1]) / vmax);
      for (let i = xs.length - 2; i >= 2; i--) if (xs[i] > xs[i + 1] - 0.35) xs[i] = xs[i + 1] - 0.35;
      for (let i = 2; i < xs.length - 1; i++) if (xs[i] < xs[i - 1] + 0.2) xs[i] = xs[i - 1] + 0.2;
      knots.push({ xs, ys });
    }
    const spins = [];
    for (let k = randInt(1, 2); k > 0; k--) spins.push({ d: randInt(0, n - 1), t: D * rand(0.3, 0.75) });
    return { pat, pf, D, tFin, knots, spins, wander: dkWander(), comm: [] };
  }

  // 走りながら左右にフラフラする動き（アヒルごとに違う）。進み具合に合わせて揺れます
  function dkWander() {
    const A = DKC.wanderAmp;
    return DUCKS.map(() => ({
      a1: A * rand(0.35, 0.65), f1: rand(1.2, 2.6), p1: rand(0, 6.28),
      a2: A * rand(0.1, 0.3), f2: rand(3, 5.5), p2: rand(0, 6.28)
    }));
  }
  function dkPrepFns(plan) {                    // 保存できない関数は、読み込むたびに作り直す
    if (!plan.wander) plan.wander = dkWander();
    plan.fns = plan.knots.map((k) => pchip(k.xs, k.ys));
    plan.comm = dkComm(plan);
  }
  function dkProg(plan, d, t) {                 // アヒル d の、時刻 t での進み具合（1.0 がゴール）
    if (t <= plan.tFin[d]) return plan.fns[d](t);
    return 1 + 0.07 * (1 - Math.exp(-(t - plan.tFin[d]) * 3));
  }

  // 全員の位置（x, y）。カメラは固定。縦に走り、横は少しフラフラして、近づいたら避け合う
  function dkAllPos(plan, t) {
    const n = DUCKS.length;
    const pos = [];
    for (let d = 0; d < n; d++) {
      const s = dkProg(plan, d, t);
      const sc = Math.min(s, 1.07);
      const w = plan.wander[d];
      const env = Math.min(1, sc / 0.1);                                // スタート直後は、きれいに横一列
      const off = env * (w.a1 * Math.sin(6.2832 * w.f1 * sc + w.p1) + w.a2 * Math.sin(6.2832 * w.f2 * sc + w.p2));
      pos.push({ x: DK_LANE_X(d) + off, y: DK_Y_START - s * (DK_Y_START - DK_Y_GOAL), s });
    }
    // となりのアヒルと近づきすぎたら、横へスッとよける（縦に離れていれば、よけない）
    const near = 19;
    const minDx = DK_HALF * 2 - 1.5;
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = pos[i];
        const b = pos[i + 1];
        const dy = Math.abs(a.y - b.y);
        if (dy >= near) continue;
        const need = minDx * (1 - dy / near) - (b.x - a.x);
        if (need > 0) { a.x -= need / 2; b.x += need / 2; }
      }
    }
    const lo = DK_COURSE.x + DK_WALL + DK_HALF;
    const hi = DK_COURSE.x + DK_COURSE.w - DK_WALL - DK_HALF;
    for (const p of pos) p.x = Math.min(hi, Math.max(lo, p.x));
    return pos;
  }

  // 実況テキスト：序盤と中盤に1回ずつ、ゴール前は畳みかけるように（1レース5回ほど）。実際の位置から作るので、見ている展開と合います
  function dkComm(plan) {
    const D = plan.D;
    const first = Math.min(...plan.tFin);
    const rank = (t) => DUCKS.map((_, d) => ({ d, s: dkProg(plan, d, t) })).sort((a, b) => b.s - a.s).map((o) => o.d);
    const prog = (d, t) => dkProg(plan, d, t);
    const nm = (d) => DUCKS[d].name;
    const gainOf = (t0, t1, skip) => {                // 順位をいちばん上げたアヒル
      const a = rank(t0);
      const b = rank(t1);
      let best = null;
      for (let d = 0; d < DUCKS.length; d++) {
        if (skip.indexOf(d) >= 0) continue;
        const gain = a.indexOf(d) - b.indexOf(d);
        if (!best || gain > best.gain) best = { d, gain };
      }
      return best;
    };
    const out = [];
    const push = (t, text) => { if (!out.length || t > out[out.length - 1].t + 0.5) out.push({ t, text }); };
    push(D * 0.12, nm(rank(D * 0.12)[0]) + '先頭！');
    const m1 = gainOf(D * 0.28, D * 0.45, []);
    if (m1.gain >= 2) push(D * 0.45, nm(m1.d) + 'が追い上げる！');
    else {
      const r = rank(D * 0.45);
      let bi = 0;
      let bd = 9;
      for (let i = 0; i < r.length - 1; i++) {
        const df = prog(r[i], D * 0.45) - prog(r[i + 1], D * 0.45);
        if (df < bd) { bd = df; bi = i; }
      }
      push(D * 0.45, nm(r[bi]) + 'と' + nm(r[bi + 1]) + 'が並んだ！');
    }
    // ゴール前：先頭 → 外から → 〇〇も来た → 並んだ！
    const lead = rank(first - 2.6)[0];
    push(first - 2.6, nm(lead) + 'が先頭！');
    const m2 = gainOf(first - 3.6, first - 1.7, [lead]);
    const outer = m2.gain >= 1 ? m2.d : rank(first - 1.7).filter((d) => d !== lead)[0];
    push(first - 1.7, m2.gain >= 1 ? '外から' + nm(outer) + '！' : nm(outer) + 'が迫る！');
    const r3 = rank(first - 0.9).filter((d) => d !== lead && d !== outer)[0];
    push(first - 0.9, nm(r3) + 'も来た！');
    const rr = rank(first - 0.35);
    if (prog(rr[0], first - 0.35) - prog(rr[2], first - 0.35) < 0.07) push(first - 0.35, '3羽並んだーー！！');
    else if (prog(rr[0], first - 0.35) - prog(rr[1], first - 0.35) < 0.035) push(first - 0.35, '2羽並んだーー！！');
    return out;
  }

  // ---------------------------------------------------------------------
  //  効果音
  // ---------------------------------------------------------------------
  const DKS = {
    pick() { beep(880, 0, 0.04, 0.04); beep(1320, 0.04, 0.06, 0.04); },
    cancel() { beep(520, 0, 0.06, 0.04); },
    bet() { beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); },
    count() { beep(660, 0, 0.12, 0.05); },
    go() { beep(1318, 0, 0.35, 0.06, 'square'); beep(1760, 0.1, 0.3, 0.04, 'square'); },
    splash() { noise(0.05, 0.015); },
    arrive(rank) { beep(784 + (5 - Math.min(rank, 5)) * 120, 0, 0.1, 0.04); },
    photo() { beep(990, 0, 0.12, 0.05); beep(1320, 0.14, 0.2, 0.05); },
    coins(k, step) { for (let i = 0; i < k; i++) beep(rand(1800, 2700), i * step, 0.03, 0.03); },
    win(n) { [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); DKS.coins(Math.min(n, 24), 0.05); },
    jackpot() { [784, 784, 784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.1, 0.14, 0.05)); DKS.coins(36, 0.06); },
    lose() { beep(330, 0, 0.12, 0.05, 'square', 150); beep(220, 0.14, 0.22, 0.05, 'square', 110); },
    nomedal() { beep(260, 0, 0.12, 0.05, 'square', 180); }
  };

  // ---------------------------------------------------------------------
  //  BETの操作
  // ---------------------------------------------------------------------
  function dkSelMessage() {
    const bt = curBetType();
    const pk = DK.sel.picks;
    const nm = (i) => DUCKS[i].name;
    if (pk.length < bt.need) {
      const ord = ['1着', '2着', '3着'][pk.length];
      return pk.length === 0
        ? 'レース ' + (D_().stats.duck.races + 1) + '　' + bt.jp + '：' + ord + 'のアヒルを選ぼう！'
        : pk.map((i, k) => ['1着', '2着', '3着'][k] + ' ' + nm(i)).join('、') + '。次は' + ord + 'を選ぼう';
    }
    const odds = dkOdds(dkProb(bt.id, pk));
    return pk.map((i) => nm(i)).join(' → ') + '！ ×' + fmtOdds(odds) + '。 BETを押してスタート！';
  }

  function dkSetType(id) {
    if (DK.sel.type === id) return;
    DK.sel.type = id;
    DK.sel.picks = [];
    DKS.pick();
    setMessage(dkSelMessage(), C.cyan);
  }
  function dkTogglePick(i) {
    const need = curBetType().need;
    const pk = DK.sel.picks;
    const at = pk.indexOf(i);
    if (at >= 0) { pk.splice(at, 1); DKS.cancel(); }
    else if (pk.length < need) { pk.push(i); DKS.pick(); }
    else { pk[need - 1] = i; DKS.pick(); }          // いっぱいのときは、最後の1つを入れかえる
    setMessage(dkSelMessage(), pk.length >= need ? C.yellow : C.cyan);
  }
  function dkClear() {
    if (!DK.sel.picks.length) return;
    DK.sel.picks = [];
    DKS.cancel();
    setMessage(dkSelMessage(), C.cyan);
  }

  function dkBet() {
    const bt = curBetType();
    if (DK.sel.picks.length < bt.need) { setMessage(dkSelMessage(), C.cyan); return; }
    const stake = Math.max(1, Math.min(DK.stake || 1, DKC.maxBet));
    if (hand < stake) {
      DK.noMedalT = 1.8;
      setMessage('メダルがありません。席を立って貸出機へ行こう', C.pink);
      DKS.nomedal();
      return;
    }
    hand -= stake;
    D_().played = true;
    noteMedals();
    const prob = dkProb(bt.id, DK.sel.picks);
    const odds = dkOdds(prob);
    DK.ticket = { type: bt.id, picks: DK.sel.picks.slice(), bet: stake, prob, odds, payout: dkPayoutOf(odds, stake) };
    DK.order = dkPickOrder();                    // 着順は、BETが確定した瞬間に決まる
    DK.plan = dkPlan(DK.order);
    dkPrepFns(DK.plan);
    dkStartReady();
    DKS.bet();
    writeSave();
  }

  function dkStartReady() {
    DK.phase = 'ready';
    DK.t = 0;
    DK.raceClock = 0;
    DK.finished = DUCKS.map(() => false);
    DK.commIdx = 0;
    DK.pfShown = false;
    DK.goShown = false;
    DK.lastTick = -1;
    DK.applied = false;
    DK.revealed = false;
    DK.fx = [];
    DK.banner = { lines: [{ text: 'BET ACCEPTED', scale: 2, color: '#ffe070' }], t: 0, dur: 0.9 };
    const tk = DK.ticket;
    setMessage('BET 受付！' + tk.picks.map((i) => DUCKS[i].name).join(' → ') + 'で×' + fmtOdds(tk.odds), C.yellow);
  }

  // ---------------------------------------------------------------------
  //  進行
  // ---------------------------------------------------------------------
  function dkStartResult() {
    DK.phase = 'result';
    DK.t = 0;
    DK.revealed = false;
    DK.banner = null;
    setMessage('ゴール！結果発表！', C.text);
  }

  function dkApply(silent) {
    if (DK.applied) return;
    DK.applied = true;
    const tk = DK.ticket;
    const o = DK.order;
    const hit = tk.picks.every((d, i) => o[i] === d);
    const gain = recBonus('duck', hit ? tk.payout : 0);
    DK.hit = hit;
    DK.gain = gain;
    hand += gain;
    const st = D_().stats.duck;
    const rec = P_().records.duck;
    st.races++; rec.plays++;
    if (hit) {
      st.wins++; rec.wins++;
      st.bestPayout = Math.max(st.bestPayout, gain);
      st.bestOdds = Math.max(st.bestOdds, tk.odds);
      const oldBest = rec.bestOdds;
      rec.bestPayout = Math.max(rec.bestPayout, gain);
      rec.bestOdds = Math.max(rec.bestOdds, tk.odds);
      if (tk.type === 'tri') rec.trifectaWins++;
      DK.newRecord = tk.odds > oldBest && oldBest > 0;
      if (DK.newRecord && !silent) toast('NEW RECORD! 最高的中オッズ ×' + fmtOdds(tk.odds));
    }
    noteMedals();
    writeSave();
  }

  function dkRevealFx() {
    const tk = DK.ticket;
    if (DK.hit) {
      const jackpot = tk.odds >= DKC.jackpotOdds;
      const n = Math.min(DK.gain, jackpot ? 44 : 30);
      const spread = jackpot ? 2.6 : DK.gain >= 10 ? 1.4 : 0.8;
      for (let k = 0; k < n; k++) {
        DK.fx.push({ type: 'coin', x: DK_COURSE.x + 10 + Math.random() * (DK_COURSE.w - 20), y: DK_COURSE.y - 12 - Math.random() * 18, vy: rand(0.4, 1.2), wait: (k / n) * spread, t: 0, dur: 4 });
      }
      for (let k = 0; k < 14; k++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(0.6, 2.2);
        DK.fx.push({ type: 'star', x: 90 + Math.round((W - 180) / 2), y: DK_COURSE.y + 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, t: 0, dur: rand(0.7, 1.3), color: ['#fff8d0', '#ffd040', '#ff8ef0', '#9ff8ff'][k % 4] });
      }
      if (jackpot) { DKS.jackpot(); DK.glow = { t: 0, dur: 5 }; } else DKS.win(DK.gain);
      setMessage('的中！×' + fmtOdds(tk.odds) + 'で' + DK.gain + '枚ゲット！', C.goldLight);
    } else {
      DKS.lose();
      setMessage('残念……外れ。次こそ！', C.dim);
    }
  }

  function dkNextRace() {
    DK.ticket = null;
    DK.order = [];
    DK.plan = null;
    DK.applied = false;
    DK.revealed = false;
    DK.hit = false;
    DK.gain = 0;
    DK.newRecord = false;
    DK.fx = DK.fx.filter((f) => f.type === 'coin');
    DK.face = [1, 1, 1, -1, -1, -1];
    DK.banner = null;
    DK.phase = 'bet';
    DK.t = 0;
    dkNewRace();
    setMessage(dkSelMessage(), C.cyan);
    writeSave();
  }

  function dkUpdate(dt) {
    DK.clock += dt;
    DK.t += dt;
    if (DK.noMedalT > 0) DK.noMedalT -= dt;
    if (DK.banner) { DK.banner.t += dt; if (DK.banner.t > DK.banner.dur) DK.banner = null; }
    if (DK.glow) { DK.glow.t += dt; if (DK.glow.t > DK.glow.dur) DK.glow = null; }
    for (let i = DK.fx.length - 1; i >= 0; i--) {
      const f = DK.fx[i];
      if (f.type === 'coin' && f.wait > 0) { f.wait -= dt; continue; }
      f.t += dt;
      if (f.type === 'splash' || f.type === 'star') { f.x += f.vx; f.y += f.vy; f.vy += f.type === 'star' ? 0.06 : 0.1; }
      if (f.type === 'coin') { f.y += f.vy; f.vy += 0.09; }
      if (f.t >= f.dur || (f.type === 'coin' && f.y > DK_COURSE.y + DK_COURSE.h + 12)) DK.fx.splice(i, 1);
    }
    if (DK.fx.length > 200) DK.fx.splice(0, DK.fx.length - 200);

    const cd = DKC.countdown;
    const readyEnd = cd.accepted + cd.ready + cd.step * 3;
    if (DK.phase === 'ready') {
      const tt = DK.t;
      if (tt >= cd.accepted && tt < cd.accepted + 0.05 && DK.lastTick < 0) { DK.lastTick = 0; DK.banner = { lines: [{ text: 'READY...', scale: 3, color: '#ffffff' }], t: 0, dur: cd.ready }; }
      for (let n = 3; n >= 1; n--) {
        const start = cd.accepted + cd.ready + (3 - n) * cd.step;
        if (tt >= start && DK.lastTick < 4 - n) {
          DK.lastTick = 4 - n;
          DK.banner = { lines: [{ text: String(n), scale: 5, color: '#ffe070' }], t: 0, dur: cd.step };
          DKS.count();
        }
      }
      if (tt >= readyEnd) {
        DK.phase = 'race';
        DK.t = 0;
        DK.raceClock = 0;
        DK.banner = { lines: [{ text: 'GO!!', scale: 5, color: '#7dff8a' }], t: 0, dur: 0.9 };
        DKS.go();
        setMessage('スタート！ゲートが開いた！', C.yellow);
      }
    } else if (DK.phase === 'race') {
      const plan = DK.plan;
      const order = DK.order;
      const first = plan.tFin[order[0]];
      const second = plan.tFin[order[1]];
      let ts = 1;
      const fs = DKC.finalStretch;
      if (DK.raceClock > first - fs.before && DK.raceClock < first + fs.after) ts = fs.slow;     // ゴール前は少し溜める
      if (plan.pf) {                              // 写真判定：ゴール前だけ、ゆっくり
        if (DK.raceClock > first - 0.9 && DK.raceClock < second + 0.35) ts = 0.3;
        if (!DK.pfShown && DK.raceClock >= first - 0.9) {
          DK.pfShown = true;
          DK.banner = { lines: [{ text: 'PHOTO FINISH!', scale: 2, color: '#ffffff' }], t: 0, dur: 1.8 };
          DKS.photo();
          setMessage('接戦！写真判定！', C.yellow);
        }
      }
      DK.raceClock += dt * ts;
      const rc = DK.raceClock;
      while (DK.commIdx < plan.comm.length && rc >= plan.comm[DK.commIdx].t) {
        if (!(plan.pf && plan.comm[DK.commIdx].t > first - 1.0)) setMessage(plan.comm[DK.commIdx].text, C.yellow);
        DK.commIdx++;
      }
      let last = 0;
      const posNow = dkAllPos(plan, rc);
      for (let d = 0; d < DUCKS.length; d++) {
        last = Math.max(last, plan.tFin[d]);
        if (!DK.finished[d] && rc >= plan.tFin[d]) {
          DK.finished[d] = true;
          const rank = order.indexOf(d);
          DKS.arrive(rank);
          if (rank === 0) {
            DK.banner = { lines: [{ text: 'FINISH!', scale: 3, color: '#ffe070' }], t: 0, dur: 1.2 };
            setMessage(DUCKS[d].name + ' ゴール！', C.yellow);
          }
        }
        // 速いときは、水しぶき
        const v = (dkProg(plan, d, rc + 0.06) - dkProg(plan, d, rc)) / 0.06;
        if (rc < plan.tFin[d] && v > 0.085 && Math.random() < 0.35) {      // 速いときは、うしろ（下）へ水しぶき
          DK.fx.push({ type: 'splash', x: posNow[d].x + rand(-6, 6), y: posNow[d].y + 9, vx: rand(-0.6, 0.6), vy: rand(0.4, 1.3), t: 0, dur: rand(0.3, 0.5) });
        }
      }
      if (rc >= last + 1.1) dkStartResult();
    } else if (DK.phase === 'result') {
      const tk = DK.ticket;
      if (!DK.revealed && DK.t >= 0.5) {
        DK.revealed = true;
        dkApply(false);
        dkRevealFx();
        if (DK.hit && tk.odds >= DKC.jackpotOdds) {
          DK.banner = { lines: [{ text: 'JACKPOT!!', scale: 3, color: '#ffe070' }, { text: tk.type === 'tri' ? 'TRIFECTA!!' : tk.type === 'exacta' ? 'EXACTA!!' : 'WIN!!', scale: 2, color: '#ffffff' }, { text: 'X' + fmtOdds(tk.odds), scale: 3, color: '#ff8ef0' }, { text: '+' + DK.gain + ' MEDALS', scale: 2, color: '#ffe070' }], t: 0, dur: DKC.jackpotTime - 0.8, big: true };
        } else if (DK.hit) {
          DK.banner = { lines: [{ text: 'WIN!!', scale: 4, color: '#ffe070' }, { text: 'ODDS X' + fmtOdds(tk.odds), scale: 1, color: '#ffffff' }, { text: '+' + DK.gain + ' MEDALS', scale: 2, color: '#7dff8a' }], t: 0, dur: DKC.resultTime - 0.6 };
        } else {
          DK.banner = { lines: [{ text: 'LOSE...', scale: 3, color: '#a0b0ff' }], t: 0, dur: DKC.resultTime - 0.6 };
        }
      }
      const total = DK.hit && tk.odds >= DKC.jackpotOdds ? DKC.jackpotTime : DKC.resultTime;
      if (DK.t >= total) dkNextRace();
    }
  }

  function dkPointer(e, p) {
    ensureAudio();
    if (DK.phase === 'bet') {
      for (let i = 0; i < BET_TYPES.length; i++) if (inRect(p, dkTabRect(i))) { dkSetType(BET_TYPES[i].id); return; }
      for (let i = 0; i < DUCKS.length; i++) if (inRect(p, dkBtnRect(i))) { dkTogglePick(i); return; }
      if (inRect(p, DK_CLEAR)) { dkClear(); return; }
      if (inRect(p, DK_STAKE_UP)) { DK.stake = Math.min(DKC.maxBet, hand > 0 ? Math.min(hand, DK.stake + 1) : DK.stake); beep(700, 0, 0.04, 0.04, 'square'); setMessage('BET ' + DK.stake + '枚（最大' + DKC.maxBet + '枚）', C.cyan); return; }
      if (inRect(p, DK_STAKE_DN)) { DK.stake = Math.max(1, DK.stake - 1); beep(500, 0, 0.04, 0.04, 'square'); setMessage('BET ' + DK.stake + '枚（最大' + DKC.maxBet + '枚）', C.cyan); return; }
      if (inRect(p, DK_BET)) { dkBet(); return; }
    } else if (DK.phase === 'result') {
      const tk = DK.ticket;
      const jackpot = DK.hit && tk && tk.odds >= DKC.jackpotOdds;
      if (DK.revealed && DK.t >= (jackpot ? 3.5 : 1.4)) dkNextRace();       // タップで次のレースへ
    }
  }
  function dkSpace() {
    if (DK.phase === 'bet') dkBet();
    else dkPointer(null, { x: 0, y: 0 });
  }

  // ---------------------------------------------------------------------
  //  保存・再開・リセット
  // ---------------------------------------------------------------------
  function dkResetDay() {
    DK.sel = { type: 'win', picks: [] };
    DK.ticket = null; DK.order = []; DK.plan = null;
    DK.applied = false; DK.revealed = false; DK.hit = false; DK.gain = 0;
    DK.fx = []; DK.banner = null; DK.glow = null;
    DK.phase = 'bet'; DK.t = 0;
    dkNewRace();
  }
  function dkSerialize() {
    const live = DK.ticket && DK.plan;
    return {
      p: DK.p, type: DK.sel.type,
      ticket: live ? DK.ticket : null, order: live ? DK.order : null,
      plan: live ? { pat: DK.plan.pat, pf: DK.plan.pf, D: DK.plan.D, tFin: DK.plan.tFin, knots: DK.plan.knots, spins: DK.plan.spins, wander: DK.plan.wander } : null,
      applied: DK.applied
    };
  }
  function dkRestore(d) {
    dkResetDay();
    if (!d || !Array.isArray(d.p) || d.p.length !== DUCKS.length) return;
    DK.p = d.p;
    DK.sel.type = BET_TYPES.some((t) => t.id === d.type) ? d.type : 'win';
    if (d.ticket && d.order && d.plan) {
      DK.ticket = d.ticket;
      DK.order = d.order;
      DK.plan = d.plan;
      dkPrepFns(DK.plan);
      DK.applied = !!d.applied;
      if (DK.applied) dkNextRace();               // もう払い出し済み：次のレースへ
      else dkStartReady();                        // BET済み：同じ着順で、最初から見なおす（メダルは減らない）
    }
  }
  function dkCanLeave() { return DK.phase === 'bet' || (DK.phase === 'result' && DK.applied); }       // 払い出しが済んだあとなら、結果の表示中でも立てる
  function dkEnter() {
    if (DK.phase === 'bet') {
      if (hand < DKC.betCost) setMessage('メダルがないよ。席を立って貸出機へ行こう', C.pink);
      else setMessage(dkSelMessage(), C.cyan);
    }
  }

  // ---------------------------------------------------------------------
  //  アヒルの絵（assets/duck-race/*.webp）。画像が無いときは、仮のアヒルで動きます
  //  絵は左向きなので、右向きも作って、動く向きに合わせて使い分けます
  // ---------------------------------------------------------------------
  const DK_RUN_W = 23;
  const DK_MINI_W = 14;
  function dkFlip(c) {
    const o = makeCanvas(c.width, c.height);
    const g = o.getContext('2d');
    g.translate(c.width, 0);
    g.scale(-1, 1);
    g.drawImage(c, 0, 0);
    return o;
  }
  function dkSpriteFrom(base, w) {
    const h = Math.max(4, Math.round((w * base.height) / base.width));
    return resizeSmooth(base, w, h);
  }
  function makeSprite(right, left) {
    const mini = resizeSmooth(right, DK_MINI_W, Math.max(4, Math.round((DK_MINI_W * right.height) / right.width)));
    return { run: right, runL: left, mini, w: right.width, h: right.height, mw: mini.width, mh: mini.height };
  }
  function dkPlaceholder(def) {                   // 仮のアヒル（右向き）
    const c = makeCanvas(22, 20);
    const g = c.getContext('2d');
    const dark = '#2a1a2a';
    g.fillStyle = dark; g.fillRect(2, 9, 17, 10); g.fillRect(12, 1, 9, 11);
    g.fillStyle = def.color; g.fillRect(3, 10, 15, 8); g.fillRect(13, 2, 7, 9); g.fillRect(1, 8, 4, 3);
    g.fillStyle = '#ff8a20'; g.fillRect(20, 6, 2, 3);
    g.fillStyle = dark; g.fillRect(17, 5, 1, 2);
    return makeSprite(c, dkFlip(c));
  }
  const DK_SPR = {};
  for (const d of DUCKS) DK_SPR[d.id] = dkPlaceholder(d);
  (function loadDuckImages() {
    for (const d of DUCKS) {
      const img = new Image();
      img.onload = () => {
        const base = makeCanvas(img.naturalWidth, img.naturalHeight);
        base.getContext('2d').drawImage(img, 0, 0);
        const left = dkSpriteFrom(base, DK_RUN_W);
        DK_SPR[d.id] = makeSprite(dkFlip(left), left);
      };
      img.onerror = () => { /* 画像が無いときは、仮のアヒルのまま */ };
      img.src = d.image;
    }
  })();

  // ---------------------------------------------------------------------
  //  動き（見た目だけ。勝ち負けには関係しません）
  // ---------------------------------------------------------------------
  function dkDuckPoses() {
    const plan = DK.plan;
    const T = DK.clock;
    const rc = DK.raceClock;
    const live = plan && (DK.phase === 'race' || DK.phase === 'result');
    const pos = live ? dkAllPos(plan, rc) : DUCKS.map((_, i) => ({ x: DK_LANE_X(i), y: DK_Y_START, s: 0 }));
    const nxt = live ? dkAllPos(plan, rc + 0.1) : null;
    return DUCKS.map((d, i) => {
      let y = pos[i].y;
      if (DK.phase === 'ready') y += (1 - shEase(Math.min(1, DK.t / 0.8))) * 16;        // 下から、スタートラインへ
      const racing = DK.phase === 'race' && plan && rc < plan.tFin[i];
      const amp = racing ? 1.4 : 0.8;
      const vx = nxt ? (nxt[i].x - pos[i].x) / 0.1 : 0;
      if (vx > 1.2) DK.face[i] = 1;
      else if (vx < -1.2) DK.face[i] = -1;                                              // 横へ動いたほうを向く
      let dx = 0;
      let dy = 0;
      let ang = Math.sin(T * 2 + i) * 0.04 + Math.max(-0.16, Math.min(0.16, vx * 0.01));
      switch (d.style) {
        case 'penguin': dx = Math.sin(T * 3.2 + i) * 1.8 * amp; dy = Math.sin(T * 4.4 + i) * 0.8 * amp; break;        // 前後に激しく
        case 'ribbon': dy = -Math.abs(Math.sin(T * 5 + i)) * 1.6 * amp; break;                                         // ぴょこぴょこ
        case 'konbu': dy = Math.sin(T * 1.6 + i) * 1.8; ang *= 0.5; break;                                            // のんびり
        case 'violet': dy = Math.sin(T * 2.2 + i) * 0.4; ang *= 0.3; break;                                           // 姿勢が良い
        case 'kuromame': dx = Math.sin(T * 17 + i) * 0.5; dy = Math.sin(T * 13 + i) * 0.5; break;                     // 小刻み
        default: dy = Math.sin(T * 2.8 + i) * 1.0 * amp;
      }
      if (DK.phase === 'race' && plan) {
        for (const sp of plan.spins) {                                                  // ときどき、クルッと傾く
          const ph = (rc - sp.t) / 0.5;
          if (sp.d === i && ph > 0 && ph < 1) { ang += Math.sin(ph * Math.PI) * -0.55; dy -= Math.sin(ph * Math.PI) * 2; }
        }
      }
      if (plan && (DK.phase === 'race' || DK.phase === 'result') && rc >= plan.tFin[i]) {   // ゴールしたら、ぴょん
        const since = rc - plan.tFin[i];
        const big = DK.order[0] === i ? 6 : 3;
        if (since < 0.7) dy -= Math.abs(Math.sin(since * 9)) * big * (1 - since / 0.7);
      }
      return { x: pos[i].x + dx, y: y + dy, ang, face: DK.face[i], s: pos[i].s };
    });
  }

  // ---------------------------------------------------------------------
  //  描画
  // ---------------------------------------------------------------------
  function drawDuckFrame() {
    rect(0, 0, W, H, '#061826');
    rect(1, 1, W - 2, H - 2, '#17507a');
    rect(8, 8, W - 16, H - 16, '#04101a');
    const chase = Math.floor(DK.clock * 2);
    bulbs.forEach(([x, y], i) => rect(x, y, 2, 2, (i + chase) % 3 === 0 ? (i % 2 ? '#ffe070' : '#9fe8ff') : '#2a5a78'));
  }

  function drawDuckHud() {
  const dx = W - 180; const hx = Math.round(dx / 2);
  rect(24, 11, 132 + dx, 22, '#0a2438');
  rect(24, 11, 132 + dx, 1, '#ffd93a'); rect(24, 32, 132 + dx, 1, '#ffd93a');
  rect(24, 11, 1, 22, '#ffd93a'); rect(155 + dx, 11, 1, 22, '#ffd93a');
  ctx.globalAlpha = 0.12 + 0.06 * Math.sin(DK.clock * 1.5);
  rect(26, 13, 128 + dx, 18, '#5ac8ff');
  ctx.globalAlpha = 1;
  ctx.drawImage(DK_SPR.takuan.mini, 28, 17);
  ctx.drawImage(DK_SPR.torimomo.mini, 139 + dx, 17);
  drawTextCenter('DUCK RACE', 90 + hx, 17, '#fff3b0', 2, '#7a5a08');
  rect(12, 36, 74 + hx, 11, '#0a2030');
  rect(94 + hx, 36, 74 + dx - hx, 11, '#0a2030');
  drawText('MEDAL', 15, 39, C.dim, 1);
  drawText(String(hand), 83 + hx - textWidth(String(hand), 1), 39, C.goldLight, 1);
  drawText('RACE', 97 + hx, 39, C.dim, 1);
  const n = String(D_().stats.duck.races + 1);
  drawText(n, 165 + dx - textWidth(n, 1), 39, '#9fe8ff', 1);
}

// ---- 縦長のレース場（下がスタート、上がゴール） ----
  function drawDuckCourse() {
    const c = DK_COURSE;
    const T = DK.clock;
    const ticket = DK.ticket;
    const picks = ticket ? ticket.picks : DK.sel.picks;
    const inL = c.x + DK_WALL;
    const inR = c.x + c.w - DK_WALL;
    rect(c.x - 1, c.y - 1, c.w + 2, c.h + 2, '#0a2a44');
    rect(c.x, c.y, c.w, c.h, '#1e5f9c');
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x, c.y, c.w, c.h);
    ctx.clip();
    // 水面：ゴールのほうへ、ゆっくり流れる
    const span = c.h + 13;
    for (let k = 0; k < 16; k++) {
      const yy = c.y + c.h - ((k * 13 + T * 16) % span) + 6;
      for (let m = 0; m < 3; m++) {
        const xx = inL + ((k * 37 + m * 59) % (inR - inL - 8));
        rect(xx, yy, 6, 1, '#6ab4ea');
        rect(xx + 2, yy + 1, 3, 1, '#4a98d8');
      }
    }
    // 左右のふち（お風呂のタイル）
    for (let y = c.y; y < c.y + c.h; y += 5) {
      const alt = ((y - c.y) / 5) % 2;
      rect(c.x, y, DK_WALL, 5, alt ? '#d6ecfa' : '#b4d8f0');
      rect(c.x + c.w - DK_WALL, y, DK_WALL, 5, alt ? '#b4d8f0' : '#d6ecfa');
      rect(c.x, y + 4, DK_WALL, 1, '#7aaed0');
      rect(c.x + c.w - DK_WALL, y + 4, DK_WALL, 1, '#7aaed0');
    }
    rect(inL - 1, c.y, 1, c.h, '#0e3a64'); rect(inR, c.y, 1, c.h, '#0e3a64');
    for (const f of [0.25, 0.5, 0.75]) {                                   // 距離の目印
      const ty = DK_Y_START - f * (DK_Y_START - DK_Y_GOAL);
      rect(inL, ty, 5, 1, '#bfe8ff'); rect(inR - 5, ty, 5, 1, '#bfe8ff');
    }
    // ゴールライン（白黒のチェッカー）と GOAL の旗
    for (let x = inL; x < inR; x += 2) for (let r = 0; r < 2; r++) rect(x, DK_FIN_Y + r * 2, 2, 2, ((x - inL) / 2 + r) % 2 ? '#10202c' : '#f4f8ff');
    rect(76 + Math.round((W - 180) / 2), c.y + 2, 28, 9, '#10202c');
    rect(77 + Math.round((W - 180) / 2), c.y + 3, 26, 7, '#ffd93a');
    drawTextCenter('GOAL', 90.5 + Math.round((W - 180) / 2), c.y + 4, '#3a2a00', 1);
    // スタートライン と ゼッケン
    for (let x = inL; x < inR; x += 6) rect(x, DK_START_Y, 3, 1, '#e8f4ff');
    DUCKS.forEach((d, i) => {
      const bx = DK_LANE_X(i);
      rect(bx - 6, DK_START_Y + 4, 12, 10, d.color);
      rect(bx - 6, DK_START_Y + 4, 12, 1, '#ffffff');
      drawTextCenter(String(d.no), bx + 0.5, DK_START_Y + 7, '#10202c', 1);
    });
    // スタートのゲート（GOで左右にひらく）
    const racing = DK.phase === 'race' || DK.phase === 'result';
    const open = racing ? Math.min(1, DK.raceClock / 0.5) : 0;
    const half = (inR - inL) / 2;
    const mid = (inL + inR) / 2;
    if (open < 1) {
      rect(inL, DK_GATE_Y, half * (1 - open), 2, '#e8eef4');
      rect(mid + half * open, DK_GATE_Y, half * (1 - open), 2, '#e8eef4');
    }

    // アヒル（上のほうから順に描く）
    const poses = dkDuckPoses();
    const order = DUCKS.map((_, i) => i).sort((a, b) => poses[a].y - poses[b].y);
    for (const i of order) {
      const d = DUCKS[i];
      const ps = poses[i];
      const spr = DK_SPR[d.id];
      const mine = picks.indexOf(i);
      const w = 12 + 4 * Math.sin(T * 3 + i);
      ctx.globalAlpha = 0.35;                                               // 波紋
      rect(ps.x - w / 2, ps.y + 9, w, 1, '#bfe8ff');
      rect(ps.x - w / 2 + 2, ps.y + 10, w - 4, 1, '#8ad0ff');
      ctx.globalAlpha = 1;
      if (mine >= 0) {                                                      // 応援しているアヒルの足もとは、ほんのり金色に
        ctx.globalAlpha = 0.2 + 0.1 * Math.sin(T * 2.4 + i);
        rect(ps.x - 12, ps.y + 8, 24, 1, '#ffe070'); rect(ps.x - 10, ps.y + 9, 20, 1, '#ffe070'); rect(ps.x - 8, ps.y + 10, 16, 1, '#ffe070');
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(px(ps.x), px(ps.y));
      if (ps.ang) ctx.rotate(ps.ang);
      const img = ps.face > 0 ? spr.run : spr.runL;
      ctx.drawImage(img, -Math.round(spr.w / 2), -Math.round(spr.h / 2));
      ctx.restore();
      rect(ps.x - 3.5, ps.y + 9, 7, 7, d.color);                            // ゼッケン
      drawTextCenter(String(d.no), ps.x + 0.5, ps.y + 10.5, '#10202c', 1);
      if (mine >= 0) {                                                      // 応援中の印（1着・2着・3着の予想）
        rect(ps.x + 7, ps.y - 15, 8, 8, '#ffd040');
        drawTextCenter(String(mine + 1), ps.x + 11.5, ps.y - 13.5, '#3a2a00', 1);
      }
    }
    // 水しぶき・メダル・星
    for (const f of DK.fx) {
      if (f.type === 'coin' && f.wait > 0) continue;
      const k = f.t / f.dur;
      if (f.type === 'splash') { ctx.globalAlpha = Math.max(0, 1 - k); rect(f.x, f.y, 2, 2, '#e8f8ff'); ctx.globalAlpha = 1; }
      else if (f.type === 'star') { ctx.globalAlpha = Math.max(0, 1 - k * k); drawStar(px(f.x), px(f.y), f.color); ctx.globalAlpha = 1; }
      else if (f.type === 'coin') drawCoinSprite(coinFull, f.x, f.y);
    }
    if (DK.glow) {                                                          // JACKPOT のやさしい光
      const env = Math.sin(Math.PI * Math.min(1, DK.glow.t / DK.glow.dur));
      ctx.globalAlpha = 0.16 * env;
      rect(c.x, c.y, c.w, c.h, '#ffd040');
      ctx.globalAlpha = 1;
    }
    // 大きな文字
    const b = DK.banner;
    if (b) {
      const a = Math.min(1, b.t / 0.15, (b.dur - b.t) / 0.3);
      const heights = b.lines.map((l) => 5 * l.scale);
      const total = heights.reduce((x, y) => x + y, 0) + (b.lines.length - 1) * 4;
      const y0 = c.y + c.h / 2 - total / 2;
      ctx.globalAlpha = Math.max(0, a) * 0.8;
      rect(c.x, y0 - 5, c.w, total + 10, '#03101a');
      ctx.globalAlpha = Math.max(0, a);
      let yy = y0;
      b.lines.forEach((l, k) => { drawTextCenter(l.text, 90 + Math.round((W - 180) / 2), yy, l.color, l.scale, '#10242a'); yy += heights[k] + 4; });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- 下半分：BETの画面 ----
  const dkMixBg = (d) => mixHex(d.color, '#06141f', 0.72);
  const dkRankName = ['1ST', '2ND', '3RD'];

  function drawDuckBetPanel() {
    const bt = curBetType();
    const pk = DK.sel.picks;
    // 賭け方（WIN / EXACTA / TRIFECTA）と CLEAR
    BET_TYPES.forEach((t, i) => {
      const r = dkTabRect(i);
      const on = t.id === DK.sel.type;
      rect(r.x, r.y, r.w, r.h, on ? '#ffd93a' : '#0e2a44');
      rect(r.x, r.y, r.w, 1, on ? '#fff3b0' : '#2a5a84');
      drawTextCenter(t.label, r.x + r.w / 2 + 0.5, r.y + 3.5, on ? '#3a2a00' : '#8ac0e8', 1);
    });
    const cr = DK_CLEAR;
    rect(cr.x, cr.y, cr.w, cr.h, pk.length ? '#0e2a44' : '#08161f');
    drawTextCenter('CLEAR', cr.x + cr.w / 2 + 0.5, cr.y + 3.5, pk.length ? '#9fd0f0' : '#2a4a5a', 1);
    // アヒルのボタン（単勝オッズつき）
    DUCKS.forEach((d, i) => {
      const r = dkBtnRect(i);
      const at = pk.indexOf(i);
      const on = at >= 0;
      rect(r.x, r.y, r.w, r.h, on ? mixHex(d.color, '#06141f', 0.45) : dkMixBg(d));
      rect(r.x, r.y, r.w, 1, d.color);
      if (on) { rect(r.x, r.y + r.h - 1, r.w, 1, '#ffd040'); rect(r.x, r.y, 1, r.h, '#ffd040'); rect(r.x + r.w - 1, r.y, 1, r.h, '#ffd040'); }
      const spr = DK_SPR[d.id];
      ctx.drawImage(spr.mini, r.x + Math.round((r.w - spr.mw) / 2), r.y + 2);
      drawTextCenter(String(d.no), r.x + r.w / 2 + 0.5, r.y + 16, '#ffffff', 1, '#06141f');
      drawTextCenter('X' + fmtOdds(dkOdds(DK.p[i])), r.x + r.w / 2 + 0.5, r.y + 23, on ? '#ffe070' : '#9fd0f0', 1);
      if (on) {
        rect(r.x + 1, r.y + 1, 8, 8, '#ffd040');
        drawTextCenter(String(at + 1), r.x + 5.5, r.y + 2.5, '#3a2a00', 1);
      }
    });
    // えらんだアヒル
    for (let k = 0; k < 3; k++) {
      const pw = (158 + (W - 180)) / 3; const x = Math.round(12 + k * pw);
      const used = k < bt.need;
      rect(x, 281, Math.round(pw) - 2, 18, used ? '#0e2a44' : '#08161f');
      if (!used) continue;
      rect(x, 281, Math.round(pw) - 2, 1, '#2a5a84');
      if (pk[k] !== undefined) {
        const d = DUCKS[pk[k]];
        const spr = DK_SPR[d.id];
        ctx.drawImage(spr.mini, x + 2, 281 + Math.round((18 - spr.mh) / 2));
        drawText(d.label, x + 19, 284, d.color, 1);
        drawText(dkRankName[k], x + 19, 291, '#ffe070', 1);
      } else {
        drawText(dkRankName[k], x + 4, 287, '#ffe070', 1);
        drawText('---', x + 24, 287, '#3a6a8a', 1);
      }
    }
    // オッズ
    const o = DK_ODDS;
    rect(o.x, o.y, o.w, o.h, '#0a2034');
    rect(o.x, o.y, o.w, 1, '#2a5a84');
    const need = bt.need;
    if (pk.length >= need) {
      const odds = dkOdds(dkProb(bt.id, pk));
      drawText('ODDS', o.x + 4, o.y + 4, C.dim, 1);
      drawText('PAY ' + dkPayoutOf(odds, DK.stake), o.x + 30, o.y + 4, '#7dff8a', 1);
      drawText('X' + fmtOdds(odds), o.x + 4, o.y + 14, '#ffe070', 2, '#4a3008');
    } else {
      ctx.globalAlpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(DK.clock * 3));
      drawTextCenter('SELECT ' + dkRankName[pk.length], o.x + o.w / 2, o.y + 11, '#9fe8ff', 1);
      ctx.globalAlpha = 1;
    }
    // BET
    const br = DK_BET;
    const ready = pk.length >= need;
    const noMed = DK.noMedalT > 0;
    rect(br.x, br.y, br.w, br.h, noMed ? '#4a1030' : ready ? '#ffd93a' : '#1a3a52');
    rect(br.x, br.y, br.w, 2, noMed ? '#ff5090' : ready ? '#fff3b0' : '#2a5a84');
    rect(br.x, br.y + br.h - 2, br.w, 2, noMed ? '#8a2050' : ready ? '#b07a08' : '#10283a');
    if (ready && !noMed) { ctx.globalAlpha = 0.12 + 0.08 * Math.sin(DK.clock * 3); rect(br.x, br.y, br.w, br.h, '#ffffff'); ctx.globalAlpha = 1; }
    if (noMed) drawTextCenter('NO MEDAL', br.x + br.w / 2, br.y + 10, C.pink, 1);
    else {
      drawTextCenter('BET', br.x + br.w / 2 + 0.5, br.y + 5, ready ? '#3a2a00' : '#5a8aa8', 2);
      drawTextCenter(DK.stake + ' MEDAL', br.x + br.w / 2 + 0.5, br.y + 18, ready ? '#3a2a00' : '#5a8aa8', 1);
    }
    // BET枚数（1〜5）
    for (const [r, t] of [[DK_STAKE_UP, '+'], [DK_STAKE_DN, '-']]) { rect(r.x, r.y, r.w, r.h, '#1a4a6a'); rect(r.x, r.y, r.w, 1, '#3a7aa4'); drawTextCenter(t, r.x + r.w / 2 + 0.5, r.y + 4, '#ffffff', 1); }
    drawTextCenter(String(DK.stake), DK_STAKE_UP.x + 29, 304, '#ffe070', 2, '#4a3008');
    drawText('MAX' + DKC.maxBet, DK_STAKE_UP.x + 20, 319, C.dim, 1);
  }

  // ---- 下半分：レース中・結果のときは、チケットと「いまの順位」 ----
  function dkLiveOrder() {
    if (DK.phase === 'result' && DK.order.length) return DK.order.slice();
    if (DK.phase === 'race' && DK.plan) return DUCKS.map((_, d) => d).sort((a, b) => dkProg(DK.plan, b, DK.raceClock) - dkProg(DK.plan, a, DK.raceClock));
    return DUCKS.map((_, d) => d);
  }
  function drawDuckLivePanel() {
  const tk = DK.ticket;
  const dx = W - 180; const q = Math.round(dx / 4); const hx = Math.round(dx / 2);
  rect(12, 235, 156 + dx, 32, '#0e2a44');
  rect(12, 235, 156 + dx, 1, '#ffd93a');
  drawText('TICKET', 16, 238, '#ffe070', 1);
  const bt = BET_TYPES.find((t) => t.id === tk.type);
  drawText(bt.label, 16, 246, '#9fe8ff', 1);
  drawText('X' + fmtOdds(tk.odds), 16, 254, '#ffe070', 1);
  drawText(DK.phase === 'result' ? 'FINAL' : 'LIVE', 16, 261, '#7dff8a', 1);
  tk.picks.forEach((di, k) => {
    const d = DUCKS[di];
    const x = 62 + q + k * (35 + Math.round(dx / 6));
    const spr = DK_SPR[d.id];
    rect(x - 1, 237, 33, 28, mixHex(d.color, '#06141f', 0.65));
    drawText(dkRankName[k], x + 1, 239, '#ffe070', 1);
    ctx.drawImage(spr.mini, x + 8, 247);
    drawTextCenter(String(d.no), x + 15.5, 260, '#ffffff', 1);
  });
  const order = dkLiveOrder();
  order.forEach((di, r) => {
    const d = DUCKS[di];
    const col = r < 3 ? 0 : 1;
    const x = col ? 91 + hx : 12;
    const y = 270 + (r % 3) * 14;
    const mine = tk.picks.indexOf(di);
    rect(x, y, 77 + hx, 13, mine >= 0 ? mixHex(d.color, '#06141f', 0.5) : '#0a2034');
    if (mine >= 0) rect(x, y, 2, 13, '#ffd040');
    drawText(String(r + 1), x + 4, y + 4, r === 0 ? '#ffe070' : '#8ac0e8', 1);
    const spr = DK_SPR[d.id];
    ctx.drawImage(spr.mini, x + 10, y + 6 - Math.round(spr.mh / 2));
    drawText(d.label, x + 26, y + 4, d.color, 1);
    if (mine >= 0) drawText('<' + dkRankName[mine], x + 59 + hx, y + 4, '#ffe070', 1);
    else if (DK.phase === 'race' && DK.plan && DK.finished[di]) rect(x + 71 + hx, y + 4, 3, 5, '#7dff8a');
  });
}

function drawDuckScreen() {
  drawDuckFrame();
  drawDuckHud();
  drawDuckCourse();
  if (DK.phase === 'bet') drawDuckBetPanel();
  else if (DK.ticket) drawDuckLivePanel();
  const st = D_().stats.duck;
  const dx = W - 180;
  rect(12, 360, 156 + dx, 12, '#0a2030');
  drawText('TODAY', 16, 363, C.dim, 1);
  drawText('RACE ' + st.races, 46 + Math.round(dx * 0.2), 363, '#e8f0ff', 1);
  drawText('WIN ' + st.wins, 86 + Math.round(dx * 0.45), 363, '#7dff8a', 1);
  drawText('BEST +' + st.bestPayout, 118 + Math.round(dx * 0.75), 363, '#ffe070', 1);
}

