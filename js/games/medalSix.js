'use strict';
  // =====================================================================
  //  新しい6台の共通部品
  //   STAR FLIGHT / FISH CATCH / GHOST PANIC / PIRATE TREASURE / STOP! TRAIN / BALLOON SHOOT
  //   どの台も、1プレイ1メダル。払い出しは、共通のMEDALへ加算します
  // =====================================================================
  const NGC = CONFIG.newGames;
  let MG_MSG = { x: 14, y: 332, w: 152, h: 25 };
  let MG_PLAY = { x: 12, y: 50, w: 156, h: 200 };
  let MG_INSERT = { x: 24, y: 258, w: 132, h: 56 };
  function mgRelayout() {                                      // 画面の論理幅（W）に合わせて、共通の枠を作り直す（ワイドな台のときだけ広い）
    const dx = W - 180; const hx = Math.round(dx / 2);
    MG_MSG = { x: 14, y: 332, w: 152 + dx, h: 25 };
    MG_PLAY = { x: 12, y: 50, w: 156 + dx, h: 200 };
    MG_INSERT = { x: 24, y: 258, w: 132 + dx, h: 56 };
    FC_SEL = [{ x: 12, y: 250, w: 74 + hx, h: 34 }, { x: 94 + hx, y: 250, w: 74 + dx - hx, h: 34 }];
    FC_CATCH = { x: 24, y: 288, w: 132 + dx, h: 40 };
    TR_BTN = { x: 24, y: 258, w: 132 + dx, h: 56 };
    CS_C = { x: 90 + hx, y: 128, r: 54, ring: 72 };
    CS_BET_BTN = (i) => ({ x: 14 + i * (52 + Math.round(dx / 3)), y: 244, w: 46 + Math.round(dx / 3) - 0, h: 22 });
    CS_START = { x: 38, y: 272, w: 104 + dx, h: 34 };
    CS_TAKE = { x: 14, y: 244, w: 74 + hx, h: 62 };
    CS_CHAL = { x: 92 + hx, y: 244, w: 74 + dx - hx, h: 62 };
    if (typeof slimeRelayout === 'function') slimeRelayout();
    if (typeof hamRelayout === 'function') hamRelayout();
    if (typeof centerRelayout === 'function') centerRelayout();
    if (typeof piyoRelayout === 'function') piyoRelayout();
    SL_SPIN = { x: 24, y: 252, w: 132 + dx, h: 34 };
    SL_MSG_BOX = { x: 14, y: 332, w: 152 + dx, h: 25 };
    { const gap = 4 + Math.round(dx * 0.33); const x0 = 18 + Math.round((146 + dx - (138 + 2 * gap)) / 2); slReelX = (i) => x0 + i * (46 + gap); }       // リールの大きさは そのまま。リールの間隔と窓を広げる
    PT_CH = [0, 1, 2].map((i) => ({ x: 11 + i * (52 + hx), y: 122, w: 50, h: 54 }));       // 3つの宝箱を、広い画面に余裕をもって（宝箱の大きさは そのまま）
    SF_UP = { x: 12, y: 262, w: 74 + hx, h: 46 };
    SF_DOWN = { x: 94 + hx, y: 262, w: 74 + dx - hx, h: 46 };
    SF_GO = { x: 24, y: 250, w: 132 + dx, h: 38 };
    SF_SIZE = { x: 24, y: 292, w: 132 + dx, h: 32 };
    BL_FIRE = { x: 24, y: 262, w: 132 + dx, h: 50 };
    BL_YES = { x: 12, y: 258, w: 74 + hx, h: 56 };
    BL_NO = { x: 94 + hx, y: 258, w: 74 + dx - hx, h: 56 };
  }
  // ---- 新しいドット素材（assets/cosmo） ----
  const CI = {};
  ['fish_small', 'fish_normal', 'fish_gold', 'fish_puffer', 'fish_octo', 'fish_golden', 'ghost_white', 'ghost_purple', 'ghost_green', 'pumpkin',
    'gem_stone', 'gem_coin', 'gem_sapphire', 'gem_emerald', 'gem_ruby', 'gem_diamond', 'balloon_red', 'balloon_silver', 'balloon_star', 'train']
    .concat(['brown', 'red', 'gold', 'blue', 'silver', 'black'].reduce((a, c) => a.concat(['chest_' + c + '_close', 'chest_' + c + '_open']), []))
    .forEach((n) => { const im = new Image(); im.src = 'assets/cosmo/' + n + '.webp'; CI[n] = im; });
  const ci = (n) => { const im = CI[n]; return im && im.complete && im.naturalWidth ? im : null; };
  const MG_COST = {};
  const MG_DEF = {
    star: { plays: 0, wins: 0, bestWin: 0, bestStar: 0 },
    fish: { plays: 0, wins: 0, bestWin: 0, catches: 0, golden: 0 },
    ghost: { plays: 0, wins: 0, bestWin: 0, bestGhost: 0 },
    pirate: { plays: 0, wins: 0, bestWin: 0, bestValue: 0, diamond: 0 },
    train: { plays: 0, wins: 0, bestWin: 0, perfect: 0 },
    balloon: { plays: 0, wins: 0, bestWin: 0, bestScore: 0, gold: 0 },
    cosmo: { plays: 0, wins: 0, bestWin: 0, jackpots: 0 },
    bingo: { plays: 0, wins: 0, bestWin: 0 }
  };
  function mgDefaults(rec) {                                   // 今日の記録／永続記録の初期値（永続記録には、投入・払い出しの合計も）
    const o = {};
    for (const k of Object.keys(MG_DEF)) o[k] = Object.assign({}, MG_DEF[k], rec ? { bet: 0, paid: 0 } : {});
    return o;
  }
  const mgDay = (g) => D_().stats.mg[g];
  const mgRec = (g) => P_().records.mg[g];
  const MG_MEM = {};                                           // 実行中の統計（デバッグ表示用：PLAY / BET / PAYOUT / RTP）
  const mgPayBand = (bands, v) => { for (const b of bands) if (v >= b[0]) return b[1]; return 0; };

  // ---- 画面の共通部品 ----
  function mgFrame(c1, c2, c3) {
    rect(0, 0, W, H, c1);
    rect(1, 1, W - 2, H - 2, c2);
    rect(8, 8, W - 16, H - 16, '#05030a');
    const chase = Math.floor(centerT * 2);
    bulbs.forEach(([x, y], i) => rect(x, y, 2, 2, (i + chase) % 3 === 0 ? (i % 2 ? c3 : '#fff3c0') : '#3a3a48'));
  }
  function mgSign(title, edge, shadow) {
    const dx = W - 180;
    rect(24, 11, 132 + dx, 22, '#10081a');
    rect(24, 11, 132 + dx, 1, edge); rect(24, 32, 132 + dx, 1, edge);
    rect(24, 11, 1, 22, edge); rect(155 + dx, 11, 1, 22, edge);
    drawTextCenter(title, 90 + Math.round(dx / 2), 17, '#fff0c0', 2, shadow);
  }
  function mgHud(label, value) {
    const dx = W - 180; const hx = Math.round(dx / 2);
    rect(12, 36, 74 + hx, 11, '#0a0610'); rect(94 + hx, 36, 74 + dx - hx, 11, '#0a0610');
    drawText('MEDAL', 15, 39, C.dim, 1);
    drawText(String(hand), 83 + hx - textWidth(String(hand), 1), 39, C.goldLight, 1);
    drawText(label, 97 + hx, 39, C.dim, 1);
    drawText(String(value), 165 + dx - textWidth(String(value), 1), 39, '#9fe8ff', 1);
  }
  const MG_PAL = {
    on: ['#ffd93a', '#fff3b0', '#b07a08', '#3a2a00'], off: ['#2a2030', '#3a3040', '#18101e', '#6a5a70'],
    hot: ['#ff5a6a', '#ff9aa8', '#a01428', '#ffffff'], go: ['#5ae08a', '#b0ffc8', '#1a8a48', '#052a14']
  };
  function mgBtn(r, label, mode, scale, sub) {
    const pal = MG_PAL[mode] || MG_PAL.on;
    rect(r.x, r.y, r.w, r.h, pal[0]);
    rect(r.x, r.y, r.w, 2, pal[1]);
    rect(r.x, r.y + r.h - 3, r.w, 3, pal[2]);
    const hh = 5 * scale + (sub ? 10 : 0);
    drawTextCenter(label, r.x + r.w / 2 + 0.5, r.y + (r.h - hh) / 2, pal[3], scale);
    if (sub) drawTextCenter(sub, r.x + r.w / 2 + 0.5, r.y + (r.h - hh) / 2 + 5 * scale + 5, pal[3], 1);
  }
  function mgInsertBtn(noMedalT, cost) {
    const noMed = noMedalT > 0;
    mgBtn(MG_INSERT, noMed ? 'NO MEDAL' : 'INSERT', noMed ? 'hot' : 'on', noMed ? 2 : 3, noMed ? '' : cost + ' MEDAL');
    if (!noMed) { ctx.globalAlpha = 0.06 + 0.07 * (0.5 + 0.5 * Math.sin(centerT * 3)); rect(MG_INSERT.x, MG_INSERT.y, MG_INSERT.w, MG_INSERT.h, '#ffffff'); ctx.globalAlpha = 1; }
  }
  function mgBannerDraw(b, y0) {
    if (!b) return;
    const a = Math.min(1, b.t / 0.12, (b.dur - b.t) / 0.25);
    const hs = b.lines.map((l) => 5 * l.scale);
    const total = hs.reduce((x, y) => x + y, 0) + (b.lines.length - 1) * 4;
    ctx.globalAlpha = Math.max(0, a) * 0.8;
    rect(MG_PLAY.x, y0 - 5, MG_PLAY.w, total + 10, '#05030a');
    ctx.globalAlpha = Math.max(0, a);
    let yy = y0;
    b.lines.forEach((l, k) => { drawTextCenter(l.text, 90 + Math.round((W - 180) / 2), yy, l.color, l.scale, '#10081a'); yy += hs[k] + 4; });
    ctx.globalAlpha = 1;
  }
  function mgStrip(parts) {
    const dx = W - 180;
    rect(12, 360, 156 + dx, 12, '#0a0610');
    let x = 16;
    const gap = 7 + Math.round(dx / Math.max(1, parts.length) * 0.6);          // 広がったぶん、項目の間をあける
    for (const p of parts) { drawText(p[0], x, 363, p[1], 1); x += textWidth(p[0], 1) + gap; }
  }
  function mgScan(y0, h) {                                     // CRTのような、うすい走査線
    ctx.globalAlpha = 0.1;
    for (let y = y0; y < y0 + h; y += 3) rect(MG_PLAY.x, y, MG_PLAY.w, 1, '#000000');
    ctx.globalAlpha = 1;
  }
  function mgFxStep(fx, dt, yMax) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      if (f.wait > 0) { f.wait -= dt; continue; }
      f.t += dt;
      if (f.type === 'coin') { f.y += f.vy; f.vy += 0.09; }
      else { f.x += f.vx || 0; f.y += f.vy || 0; if (f.type === 'star') f.vy += 0.05; }
      if (f.t >= f.dur || f.y > yMax) fx.splice(i, 1);
    }
    if (fx.length > 160) fx.splice(0, fx.length - 160);
  }
  function mgFxDraw(fx) {
    for (const f of fx) {
      if (f.wait > 0) continue;
      const k = f.t / f.dur;
      if (f.type === 'coin') drawCoinSprite(coinFull, f.x, f.y);
      else if (f.type === 'star') { ctx.globalAlpha = Math.max(0, 1 - k * k); drawStar(px(f.x), px(f.y), f.color); ctx.globalAlpha = 1; }
      else if (f.type === 'dot') { ctx.globalAlpha = Math.max(0, 1 - k); rect(f.x, f.y, f.s || 2, f.s || 2, f.color); ctx.globalAlpha = 1; }
      else if (f.type === 'text') { ctx.globalAlpha = Math.max(0, 1 - k * k); drawTextCenter(f.text, f.x, f.y - k * 10, f.color, 1, '#10081a'); ctx.globalAlpha = 1; }
    }
  }
  function mgCoinRain(fx, n, spread) {
    for (let k = 0; k < n; k++) fx.push({ type: 'coin', x: MG_PLAY.x + 10 + Math.random() * (MG_PLAY.w - 20), y: MG_PLAY.y - 12 - Math.random() * 20, vy: rand(0.5, 1.3), wait: (k / Math.max(1, n)) * spread, t: 0, dur: 4 });
  }
  function mgStatsOverlay(g) {                                  // デバッグ：TOTAL PLAY / BET / PAYOUT / RTP
    const dbg = NGC[g].debug;
    if (!dbg.enabled || !dbg.showStats) return;
    const m = MG_MEM[g] || { plays: 0, bet: 0, pay: 0 };
    ctx.globalAlpha = 0.75; rect(MG_PLAY.x, MG_PLAY.y + 14, 70, 28, '#000000'); ctx.globalAlpha = 1;
    drawText('PLAY ' + m.plays + ' BET ' + m.bet, MG_PLAY.x + 3, MG_PLAY.y + 17, '#9fe8ff', 1);
    drawText('PAY ' + m.pay + ' RTP ' + (m.bet ? (m.pay / m.bet).toFixed(2) : '-'), MG_PLAY.x + 3, MG_PLAY.y + 27, '#ffe070', 1);
  }
  function mgNoMedal(S, g) {
    S.noMedalT = 1.8;
    setMessage('メダルがありません。席を立って貸出機へ行こう', C.pink);
    beep(260, 0, 0.12, 0.05, 'square', 180);
  }
  // 5体の共通：カウントダウン（READY... → 3 → 2 → 1 → GO!!）
  function mgCountdown(S) {
    const t = S.cd;
    const step = t < 0.6 ? 'READY...' : t < 1.1 ? '3' : t < 1.6 ? '2' : t < 2.1 ? '1' : null;
    const key = step === null ? 'go' : step;
    if (S.cdKey !== key) {
      S.cdKey = key;
      if (step) { S.banner = { lines: [{ text: step, scale: step === 'READY...' ? 3 : 5, color: step === 'READY...' ? '#ffffff' : '#ffe070' }], t: 0, dur: step === 'READY...' ? 0.6 : 0.5 }; if (step !== 'READY...') beep(660, 0, 0.12, 0.05); }
    }
    return step === null;
  }
  function mgRegister(gameType, def) {
    GAME_TYPES[gameType] = {
      resetDaily() { def.reset(); }, saveDaily() { return {}; }, loadDaily() { def.reset(); },
      canLeave() { const ph = def.phase(); return ph === 'idle' || ph === 'result'; }, enter() { def.enter(); },       // 結果の表示中でも、払い出しは済んでいるので、すぐ席を立てる
      update(dt) { def.update(dt); }, draw() { def.draw(); },
      pointer(e, p) { def.pointer(e, p); }, pointerUp(e) { if (def.pointerUp) def.pointerUp(e); },
      space() { if (def.space) def.space(); }, key(k) { return def.key ? def.key(k) : false; },
      msgBox() { return MG_MSG; }, hint: def.hint
    };
  }
  function mgShape(S, inside, color) {                          // 18x18 のドット絵（ふちどりつき）を作る
    const g = [];
    for (let y = 0; y < S; y++) { g.push([]); for (let x = 0; x < S; x++) g[y].push(!!inside(x + 0.5, y + 0.5)); }
    const c = makeCanvas(S, S);
    const gx = c.getContext('2d');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!g[y][x]) continue;
      const edge = !(g[y][x - 1] && g[y][x + 1] && (g[y - 1] || [])[x] && (g[y + 1] || [])[x]);
      gx.fillStyle = edge ? '#2a1020' : color(x + 0.5, y + 0.5);
      gx.fillRect(x, y, 1, 1);
    }
    return c;
  }

  // =====================================================================
  //  🚀 STAR FLIGHT：上下に飛んで⭐を集める。星の配置そのものに分岐があり、全部は取れません
  // =====================================================================
  const SFC = NGC.star;
  const SF_PAT = [
    { w: 100, s: [[10, .5], [30, .5], [50, .5], [70, .5], [90, .5]] },                                       // LINE
    { w: 110, s: [[20, .2], [40, .2], [60, .2], [80, .2], [20, .8], [40, .8], [60, .8], [80, .8]] },         // FORK（上ルート／下ルート）
    { w: 120, s: [[10, .5], [30, .25], [50, .5], [70, .75], [90, .5], [110, .25]] },                         // WAVE
    { w: 100, s: [[10, .15], [30, .32], [50, .5], [70, .68], [90, .85]] },                                   // DOWN
    { w: 100, s: [[10, .85], [30, .68], [50, .5], [70, .32], [90, .15]] },                                   // UP
    { w: 90, s: [[25, .15], [25, .85], [50, .5], [75, .15], [75, .85]] },                                    // PAIR（上下に同時）
    { w: 120, s: [[10, .2], [30, .35], [50, .5], [70, .65], [90, .8], [110, .65]] },                         // S
    { w: 80, s: [[20, .45], [20, .55], [40, .5], [60, .45], [60, .55]] },                                    // CLUSTER
    { w: 110, s: [[10, .5], [30, .5], [50, .5], [70, .22], [90, .22], [70, .78], [90, .78]] },               // 終盤二択
    { w: 120, s: [[15, .3], [35, .7], [55, .3], [75, .7], [95, .3], [115, .7]] }                             // 狭い連続ルート
  ];
  const SF_Y0 = 62;
  const SF_Y1 = 238;
  const SF_SHIP_X = 40;
  let SF_UP = { x: 12, y: 262, w: 74, h: 46 };
  let SF_GO = { x: 24, y: 250, w: 132, h: 38 };
  let SF_SIZE = { x: 24, y: 292, w: 132, h: 32 };
  let SF_DOWN = { x: 94, y: 262, w: 74, h: 46 };
  const sfShipX = () => SF_SHIP_X + Math.round((W - 180) * 0.5);      // ワイド：船の位置を右へ（星が見えてから届くまでの距離は、ほぼ同じ。コースの長さ・速さは そのまま）
  const SF_STAR = resizeSmooth(SL_SPR[3].mini, 12, 12);
  const SF = { phase: 'idle', t: 0, stars: [], len: 0, scroll: 0, y: 150, vy: 0, holds: {}, got: 0, max: 1, combo: 0, fx: [], banner: null, noMedalT: 0, cd: 0, cdKey: '', bg: [], up: false, down: false, big: false, capR: 9 };
  for (let i = 0; i < 40; i++) SF.bg.push({ x: Math.random() * 156, y: 50 + Math.random() * 200, z: 0.3 + Math.random() * 0.9 });

  function sfMax(stars, capR) {                                 // 理論上とれる最大数（上下の速さの限界から計算）
    capR = capR || SFC.captureR;
    const best = stars.map(() => 1);
    for (let i = 0; i < stars.length; i++) for (let j = 0; j < i; j++) {
      const dx = stars[i].x - stars[j].x;
      const dy = Math.abs(stars[i].y - stars[j].y);
      if (dy <= (SFC.shipMaxSpeed * dx) / SFC.scrollSpeed + 2 * capR) best[i] = Math.max(best[i], best[j] + 1);
    }
    return Math.max(1, ...best);
  }
  function sfCourse() {
    const list = [];
    let x = 90;
    let prev = -1;
    for (let k = 0; k < SFC.patternsPerCourse; k++) {
      let i;
      do { i = randInt(0, SF_PAT.length - 1); } while (i === prev);
      prev = i;
      for (const [dx, yn] of SF_PAT[i].s) list.push({ x: x + dx, y: SF_Y0 + yn * (SF_Y1 - SF_Y0), got: false });
      x += SF_PAT[i].w + 14;
    }
    list.sort((a, b) => a.x - b.x);
    SF.len = x + 40;
    return list;
  }
  function sfInsert() {
    if (SF.phase !== 'idle') return;
    const cost = SFC.betCost + (SF.big ? SFC.sizeUp.cost : 0);
    if (hand < cost) { if (SF.big && hand >= SFC.betCost) SF.big = false; else { mgNoMedal(SF); return; } }
    const cost2 = SFC.betCost + (SF.big ? SFC.sizeUp.cost : 0);
    mgInsert('star', cost2);
    SF.capR = SFC.captureR * (SF.big ? SFC.sizeUp.captureMul : 1);
    SF.stars = sfCourse();
    SF.max = sfMax(SF.stars, SF.capR);
    SF.scroll = 0; SF.got = 0; SF.combo = 0; SF.y = 150; SF.vy = 0; SF.holds = {};
    SF.phase = 'ready'; SF.cd = 0; SF.cdKey = ''; SF.fx = []; SF.banner = null;
    setMessage('上下に飛んで⭐を集めよう！選べるルートは限られているよ', C.cyan);
  }
  function sfFinish() {
    const got = SFC.debug.enabled && SFC.debug.forceStars !== null ? SFC.debug.forceStars : SF.got;
    const ratio = Math.min(1, got / SF.max);
    const pay = mgPayBand(SF.big ? SFC.sizeUp.payBands : SFC.payBands, ratio + 1e-9);
    SF.phase = 'result'; SF.t = 0; SF.holds = {};
    mgSettle('star', pay, (o) => { o.bestStar = Math.max(o.bestStar, got); });
    if (pay > 0) { mgCoinRain(SF.fx, Math.min(pay * 3, 36), 1.2); beep(1047, 0, 0.1, 0.05); beep(1568, 0.08, 0.12, 0.05); }
    SF.banner = { lines: [{ text: 'FINISH!', scale: 3, color: '#ffe070' }, { text: 'STAR ' + got, scale: 2, color: '#9fe8ff' }, { text: pay > 0 ? 'WIN +' + pay + ' MEDALS' : 'NO WIN', scale: 2, color: pay > 0 ? '#7dff8a' : '#a0b0ff' }], t: 0, dur: 2.7 };
    setMessage('ゴール！ ⭐ ' + got + '/' + SF.max + ' → ' + (pay > 0 ? pay + '枚ゲット！' : '残念……次こそ！'), pay > 0 ? C.goldLight : C.dim);
  }
  function sfUpdate(dt) {
    if (SF.noMedalT > 0) SF.noMedalT -= dt;
    if (SF.banner) { SF.banner.t += dt; if (SF.banner.t > SF.banner.dur) SF.banner = null; }
    mgFxStep(SF.fx, dt, 260);
    SF.t += dt;
    if (SF.phase === 'ready') {
      SF.cd += dt;
      if (mgCountdown(SF)) { SF.phase = 'play'; SF.t = 0; SF.banner = { lines: [{ text: 'GO!!', scale: 5, color: '#7dff8a' }], t: 0, dur: 0.7 }; beep(1318, 0, 0.3, 0.06, 'square'); }
    } else if (SF.phase === 'play') {
      SF.scroll += SFC.scrollSpeed * dt;
      const dir = (SF.down ? 1 : 0) - (SF.up ? 1 : 0);
      const holds = Object.values(SF.holds);
      const d2 = holds.length ? (holds.indexOf(1) >= 0 ? 1 : 0) - (holds.indexOf(-1) >= 0 ? 1 : 0) : 0;
      const d = d2 || dir;
      if (d) SF.vy = Math.max(-SFC.shipMaxSpeed, Math.min(SFC.shipMaxSpeed, SF.vy + d * SFC.shipAccel * dt));
      else SF.vy *= Math.max(0, 1 - 7 * dt);                    // はなすと、すこし慣性で流れて止まる
      SF.y = Math.max(SF_Y0 - 4, Math.min(SF_Y1 + 4, SF.y + SF.vy * dt));
      for (const s of SF.stars) {
        if (s.got || Math.abs(s.x - SF.scroll - sfShipX()) > 7 || Math.abs(s.y - SF.y) > SF.capR) continue;
        s.got = true; SF.got++; SF.combo++;
        SF.fx.push({ type: 'star', x: sfShipX() + 4, y: s.y, vx: rand(-0.4, 0.4), vy: rand(-0.8, 0.2), t: 0, dur: 0.5, color: '#fff3a0' });
        beep(880 + Math.min(SF.combo, 10) * 70, 0, 0.05, 0.04, 'square');
      }
      if (SF.scroll >= SF.len) sfFinish();
    } else if (SF.phase === 'result' && SF.t >= 3.1) { SF.phase = 'idle'; SF.banner = null; }
  }
  function sfDraw() {
    mgFrame('#04061a', '#1a2a7a', '#9fe8ff');
    mgSign('STAR FLIGHT', '#9fe8ff', '#1a2a7a');
    mgHud('STAR', SF.phase === 'idle' ? '-' : SF.got + '/' + SF.max);
    const P = MG_PLAY;
    rect(P.x, P.y, P.w, P.h, '#070a24');
    ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    for (const s of SF.bg) { const x = P.x + (((s.x * (P.w / 156) - SF.scroll * s.z * 0.5 - (SF.phase === 'idle' ? centerT * 6 * s.z : 0)) % P.w) + P.w) % P.w; rect(x, s.y, s.z > 0.8 ? 2 : 1, s.z > 0.8 ? 2 : 1, s.z > 0.8 ? '#ffffff' : '#7a8ac8'); }
    const px0 = P.x + 130 - ((SF.scroll * 0.25) % 300);                           // とおくの惑星
    rect(px0, 100, 28, 28, '#c85a3a'); rect(px0 + 3, 100, 22, 28, '#e87a4a'); rect(px0 + 5, 106, 8, 3, '#a8442c'); rect(px0 + 4, 122, 14, 3, '#a8442c'); rect(px0 - 6, 112, 40, 3, '#ffd0a0');
    for (const s of SF.stars) {
      const x = s.x - SF.scroll + P.x;
      if (s.got || x < P.x - 8 || x > P.x + P.w + 8) continue;
      ctx.drawImage(SF_STAR, px(x - 6), px(s.y - 6));
    }
    if (SF.phase !== 'idle') {                                  // 宇宙船
      const y = SF.y; const x = P.x + sfShipX() - 8;
      ctx.save();
      if (SF.big) { const k = SFC.sizeUp.shipScale; ctx.translate(x + 8, y); ctx.scale(k, k); ctx.translate(-(x + 8), -y); }
      const fl = 3 + Math.round(Math.sin(centerT * 30) * 1.5);
      rect(x - fl, y - 1, fl, 3, '#ff9a30'); rect(x - fl + 1, y, fl - 1, 1, '#fff3a0');
      rect(x, y - 4, 14, 8, '#d8e0f0'); rect(x + 14, y - 3, 4, 6, '#9fb0d0'); rect(x + 18, y - 1, 2, 2, '#ff5060');
      rect(x + 4, y - 7, 6, 3, '#5ca8ff'); rect(x + 4, y + 4, 6, 3, '#5ca8ff'); rect(x + 7, y - 3, 4, 3, '#7ad0ff');
      ctx.restore();
    }
    mgFxDraw(SF.fx);
    ctx.restore();
    mgScan(P.y, P.h);
    mgBannerDraw(SF.banner, P.y + 64);
    mgStatsOverlay('star');
    if (SF.phase === 'idle') {
      const total = SFC.betCost + (SF.big ? SFC.sizeUp.cost : 0);
      mgBtn(SF_GO, SF.noMedalT > 0 ? 'NO MEDAL' : 'INSERT', SF.noMedalT > 0 ? 'hot' : 'on', 2, SF.noMedalT > 0 ? '' : total + ' MEDAL');
      mgBtn(SF_SIZE, 'BIG SHIP  +' + SFC.sizeUp.cost + ' MEDAL', 'go', 1, SF.big ? 'ON  -  TOTAL ' + (SFC.betCost + SFC.sizeUp.cost) + ' MEDAL' : 'TAP TO SELECT');
      ctx.globalAlpha = 0.1 + 0.08 * Math.sin(centerT * 3); rect(SF_SIZE.x, SF_SIZE.y, SF_SIZE.w, SF_SIZE.h, '#ffffff'); ctx.globalAlpha = 1;
      if (SF.big) {                                                 // 選択中：白い枠が光って、チェックがつく
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(centerT * 5);
        rect(SF_SIZE.x - 2, SF_SIZE.y - 2, SF_SIZE.w + 4, 2, '#ffffff'); rect(SF_SIZE.x - 2, SF_SIZE.y + SF_SIZE.h, SF_SIZE.w + 4, 2, '#ffffff');
        rect(SF_SIZE.x - 2, SF_SIZE.y, 2, SF_SIZE.h, '#ffffff'); rect(SF_SIZE.x + SF_SIZE.w, SF_SIZE.y, 2, SF_SIZE.h, '#ffffff');
        ctx.globalAlpha = 1;
        for (const [cx, cy] of [[0, 2], [1, 3], [2, 2], [3, 1], [4, 0]]) rect(SF_SIZE.x + 6 + cx * 3, SF_SIZE.y + 9 + cy * 3, 3, 3, '#052a14');
      }
    } else {
      const holds = Object.values(SF.holds);
      mgBtn(SF_UP, 'UP', holds.indexOf(-1) >= 0 ? 'go' : SF.phase === 'play' || SF.phase === 'ready' ? 'on' : 'off', 3);
      mgBtn(SF_DOWN, 'DOWN', holds.indexOf(1) >= 0 ? 'go' : SF.phase === 'play' || SF.phase === 'ready' ? 'on' : 'off', 3);
    }
    const d = mgDay('star');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['BEST STAR ' + d.bestStar, '#9fe8ff'], ['BEST +' + d.bestWin, '#ffe070']]);
  }
  mgRegister('starFlight', {
    reset() { SF.phase = 'idle'; SF.banner = null; SF.fx = []; SF.holds = {}; }, phase: () => SF.phase,
    enter() { setMessage(hand < SFC.betCost ? 'メダルがないよ。席を立って貸出機へ行こう' : 'INSERTを押して、⭐を集めに行こう！', hand < SFC.betCost ? C.pink : C.cyan); },
    update: sfUpdate, draw: sfDraw, hint: 'UP／DOWN で⭐を取ろう！',
    pointer(e, p) {
      if (SF.phase === 'idle') { if (inRect(p, SF_GO)) sfInsert(); else if (inRect(p, SF_SIZE)) { SF.big = !SF.big; setMessage(SF.big ? 'SHIP SIZE UP！船が大きくなって⭐を取りやすい（合計' + (SFC.betCost + SFC.sizeUp.cost) + '枚）' : '普通の船で行こう（1枚）', C.cyan); beep(SF.big ? 880 : 440, 0, 0.08, 0.05, 'square'); } return; }
      if (SF.phase === 'play' || SF.phase === 'ready') { if (inRect(p, SF_UP)) SF.holds[e ? e.pointerId : 0] = -1; else if (inRect(p, SF_DOWN)) SF.holds[e ? e.pointerId : 0] = 1; }
    },
    pointerUp(e) { delete SF.holds[e ? e.pointerId : 0]; },
    space() { if (SF.phase === 'idle') sfInsert(); },
    key(k) { const l = String(k).toLowerCase(); if (l === 'w' || l === 'arrowup') { SF.vy = Math.max(-SFC.shipMaxSpeed, SF.vy - 60); return true; } if (l === 's' || l === 'arrowdown') { SF.vy = Math.min(SFC.shipMaxSpeed, SF.vy + 60); return true; } return false; }
  });

  // =====================================================================
  //  🐟 FISH CATCH：水槽の魚を見てから、網を選ぶ（NORMAL NET 1枚 ／ BIG NET 3枚）
  //   押してから0.5秒後に網が着きます。魚は、押されたことを知りません。BIG NETは、捕まえやすいだけで、配当は同じです
  // =====================================================================
  const FCC = NGC.fish;
  const FC_LANES = [118, 146, 168, 186];
  const fcDx = () => W - 180;                                    // 水槽の広がったぶん
  const fcNet = (kind) => { const n = FCC.nets[kind]; const hx = Math.round(fcDx() / 2); return { x0: n.x0 + hx, x1: n.x1 + hx, cost: n.cost }; };      // 網は、広い水槽の中央（大きさは そのまま）
  let FC_SEL = [{ x: 12, y: 250, w: 74, h: 34 }, { x: 94, y: 250, w: 74, h: 34 }];       // 網を選ぶ（まだ落とさない）
  let FC_CATCH = { x: 24, y: 288, w: 132, h: 40 };                                       // CATCH!（ここで網を落とす。メダルも、ここで払う）
  const FC = { log: [], sel: 'normal', phase: 'idle', t: 0, fish: [], net: { state: 'up', t: 0, caught: null, kind: 'normal' }, fx: [], banner: null, noMedalT: 0, lastWin: 0, bub: [] };
  for (let i = 0; i < 14; i++) FC.bub.push({ x: 20 + Math.random() * 130, y: 60 + Math.random() * 130, s: 0.6 + Math.random() });
  const fcBubX = () => 20 + Math.random() * (130 + fcDx());

  function fcSpawn() {
    FC.fish = [];
    const types = FCC.debug.enabled && FCC.debug.forceFish ? FCC.types.filter((t) => t.id === FCC.debug.forceFish) : FCC.types;
    for (let i = 0; i < FCC.fishCount; i++) {
      const ty = pickWeighted(types.length ? types : FCC.types, 'weight');
      FC.fish.push({ ty, x: rand(30, 150 + fcDx()), baseY: FC_LANES[randInt(0, FC_LANES.length - 1)], y: 0, dir: Math.random() < 0.5 ? 1 : -1, v: ty.speed * rand(0.9, 1.1), ph: rand(0, 6.28), nextTurn: rand(1.2, 3), age: 0, spd: 1, spdT: 1, mode: 'normal', modeT: 0, nextAct: rand(3, 9) });
    }
    FC.fish.forEach((f) => { f.y = f.baseY; f.targetY = f.baseY; f.retarget = rand(1, 3); });
    const lowers = FC_LANES.filter((y) => y >= FCC.netY0 + 4);                 // 最初から、1匹は網の届く高さにいる
    const first = FC.fish[randInt(0, FC.fish.length - 1)]; first.baseY = first.targetY = first.y = lowers[randInt(0, lowers.length - 1)];
    FC.noReach = 0;
  }
  const fcReachable = (f) => f.y >= FCC.netY0 - 2 && f.y <= 196;
  // 網の捕獲範囲の手前（網が届く高さで、網の左右＋余白の中）。ここでは、急な方向転換・停止・速度変化を起こさない
  const fcDanger = (f) => { const n = fcNet('big'); return f.y >= FCC.netY0 - 14 && f.x > n.x0 - FCC.behave.margin && f.x < n.x1 + FCC.behave.margin; };
  function fcActRoll(f) {                                                  // 低確率で、泳ぎ方を変える
    const c = FCC.behave.chance; let r = Math.random() * (c.slow + c.fast + c.turn + c.pause);
    if ((r -= c.slow) < 0) { f.mode = 'slow'; f.spdT = FCC.behave.slow; f.modeT = rand(1.5, 2.5); }
    else if ((r -= c.fast) < 0) { f.mode = 'fast'; f.spdT = FCC.behave.fast; f.modeT = rand(1, 2); }
    else if ((r -= c.turn) < 0) { f.dir *= -1; }
    else { f.mode = 'pause'; f.spdT = 0; f.modeT = rand(0.5, 0.9); }
    FC.log.push({ kind: f.mode, turned: r < 0 && f.mode === 'normal', danger: fcDanger(f), phase: FC.phase });
    if (FC.log.length > 400) FC.log.shift();
  }
  function fcMove(f, dt) {                                      // 魚の動き：最初から決まっていて、網には反応しません
    f.age += dt;
    const D = FCC.dive;                                          // ゆっくり上下する（瞬間移動はしない）
    f.retarget -= dt;
    if (f.retarget <= 0) {
      const lows = FC_LANES.filter((y) => y >= FCC.netY0 + 4); const ups = FC_LANES.filter((y) => y < FCC.netY0 - 4);
      f.targetY = Math.random() < D.lowerChance ? lows[randInt(0, lows.length - 1)] : ups[randInt(0, ups.length - 1)];
      f.retarget = rand(D.retarget[0], D.retarget[1]);
    }
    f.baseY += clamp(f.targetY - f.baseY, -D.speed * dt, D.speed * dt);
    if (f.ty.pattern === 'straight' || f.ty.pattern === 'turn') f.y = f.baseY;
    const B = FCC.behave;                                                    // 泳ぎ方の変化（速さはなめらかに変わる）
    f.spd += clamp(f.spdT - f.spd, -B.accel * dt, B.accel * dt);
    const free = FC.phase !== 'play' && !fcDanger(f);
    if (f.modeT > 0) { f.modeT -= dt; if (f.modeT <= 0) { f.spdT = 1; f.mode = 'normal'; } }
    f.nextAct -= dt;
    if (f.nextAct <= 0) { if (free && f.mode === 'normal') { fcActRoll(f); f.nextAct = rand(B.every[0], B.every[1]); } else f.nextAct = 0.5; }
    f.x += f.dir * f.v * f.spd * dt;
    if (f.x < 24) { f.x = 24; f.dir = 1; } else if (f.x > 156 + fcDx()) { f.x = 156 + fcDx(); f.dir = -1; }
    if (f.ty.pattern === 'turn') { f.nextTurn -= dt; if (f.nextTurn <= 0) { if (free) { f.dir *= -1; f.nextTurn = rand(1.2, 3); } else f.nextTurn = 0.4; } }
    if (f.ty.pattern === 'octo') f.y = f.baseY + Math.sin(f.age * 1.6 + f.ph) * 9;
    if (f.ty.pattern === 'weave') f.y = f.baseY + Math.sin(f.age * 2.2 + f.ph) * 14;
  }
  const fcNetRect = () => { const n = fcNet(FC.net.kind); return { x0: n.x0, x1: n.x1, y0: FCC.netY0, y1: 194 }; };
  function fcCatch(kind) {                                       // 網を選んで、その場で下ろす（メダルは、ここで払います）
    if (FC.phase !== 'idle') return;
    const n = FCC.nets[kind];
    if (!n) return;
    if (hand < n.cost) { mgNoMedal(FC); return; }
    mgInsert('fish', n.cost);
    FC.net = { state: 'drop', t: 0, caught: null, kind };
    FC.phase = 'play'; FC.t = 0; FC.lastWin = 0; FC.banner = null;
    beep(500, 0, 0.1, 0.05, 'triangle', 200); noise(0.12, 0.04);        // ジャポン！
    setMessage(kind === 'big' ? 'BIG NET！網が降りていく……！' : '網が降りていく……！', C.yellow);
  }
  function fcNetBottom() {
    const n = FC.net;
    if (n.state === 'drop') { const k = Math.min(1, n.t / FCC.netDelay); return 56 + (194 - 56) * (k * k); }
    if (n.state === 'lift') { const k = Math.min(1, n.t / 0.7); return 194 - (194 - 56) * k; }
    return n.state === 'down' ? 194 : 20;
  }
  // 魚の当たり判定（体の部分）が、網に重なっている割合
  function fcOverlap(f, r) {
    const img = ci('fish_' + f.ty.id); const H = FCC.hit;
    const w = (img ? img.naturalWidth : f.ty.w) * H.w; const h = (img ? img.naturalHeight : f.ty.h) * H.h;
    const ix = Math.max(0, Math.min(f.x + w / 2, r.x1) - Math.max(f.x - w / 2, r.x0));
    const iy = Math.max(0, Math.min(f.y + h / 2, r.y1) - Math.max(f.y - h / 2, r.y0));
    return (ix * iy) / (w * h);
  }
  function fcResolve() {                                        // 網が最下点に着いた瞬間に、4匹すべてを個別に判定
    const r = fcNetRect();
    const got = FC.fish.filter((f) => fcOverlap(f, r) >= FCC.hit.need);
    FC.net.state = 'lift'; FC.net.t = 0; FC.net.caught = got;
    const pay = got.reduce((a, f) => a + f.ty.pay, 0);
    FC.lastWin = pay;
    mgSettle('fish', pay, (o) => { o.catches += got.length; o.golden += got.filter((f) => f.ty.id === 'golden').length; });
    if (got.length) {
      mgCoinRain(FC.fx, Math.min(pay * 3, 30), 1.0);
      [1047, 1319, 1568].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05));
      if (got.length >= 3) [1760, 2093, 2637].forEach((f, i) => beep(f, 0.25 + i * 0.07, 0.12, 0.05));         // 3匹以上：少しだけ特別
      const multi = got.length >= 2;
      FC.banner = { lines: multi
        ? [{ text: got.length + ' FISH GET!', scale: 3, color: got.length >= 3 ? '#ff8ef0' : '#ffe070' }, { text: got.map((f) => f.ty.name).join(' + '), scale: 1, color: '#ffffff' }, { text: 'WIN +' + pay, scale: 2, color: '#7dff8a' }]
        : [{ text: 'CATCH!!', scale: 3, color: '#ffe070' }, { text: got[0].ty.name, scale: 1, color: '#ffffff' }, { text: 'WIN ' + pay, scale: 2, color: '#7dff8a' }], t: 0, dur: multi ? 2.4 : 2.2 };
      setMessage((multi ? got.length + '匹一度に！' : '') + got.map((f) => f.ty.name).join('・') + 'を捕まえた！ +' + pay + '枚', C.goldLight);
    } else {
      beep(260, 0, 0.1, 0.04, 'square', 160);
      FC.banner = { lines: [{ text: 'MISS...', scale: 3, color: '#a0b0ff' }], t: 0, dur: 1.2 };
      setMessage('網は空っぽ……もう一回！', C.dim);
    }
    FC.phase = 'result'; FC.t = 0;
  }
  function fcUpdate(dt) {
    if (FC.noMedalT > 0) FC.noMedalT -= dt;
    if (FC.banner) { FC.banner.t += dt; if (FC.banner.t > FC.banner.dur) FC.banner = null; }
    mgFxStep(FC.fx, dt, 260);
    FC.t += dt;
    for (const b of FC.bub) { b.y -= 14 * b.s * dt; if (b.y < 52) { b.y = 192; b.x = fcBubX(); } }
    for (const f of FC.fish) fcMove(f, dt);
    if (FC.phase === 'idle' && FC.fish.length) {                 // 「いま3匹とも届かない」が続いたら、1匹を下へ向かわせる
      if (FC.fish.some((f) => fcReachable(f) || f.targetY >= FCC.netY0 + 4 && f.targetY - f.baseY < 12)) FC.noReach = 0;
      else {
        FC.noReach = (FC.noReach || 0) + dt;
        if (FC.noReach > FCC.dive.maxUpperTime) {
          const lows = FC_LANES.filter((y) => y >= FCC.netY0 + 4);
          const f = FC.fish.reduce((a, b) => (b.baseY > a.baseY ? b : a));      // いちばん下にいる魚
          f.targetY = lows[randInt(0, lows.length - 1)]; f.retarget = rand(FCC.dive.retarget[0], FCC.dive.retarget[1]); FC.noReach = 0;
        }
      }
    }
    if (FC.phase === 'play') {
      FC.net.t += dt;
      if (FC.net.state === 'drop' && FC.net.t >= FCC.netDelay) { FC.net.state = 'down'; fcResolve(); }
    } else if (FC.phase === 'result') {
      FC.net.t += dt;
      if (FC.t >= 2.6) { FC.phase = 'idle'; FC.banner = null; FC.net = { state: 'up', t: 0, caught: null, kind: 'normal' }; fcSpawn(); setMessage('魚を見て、 CATCH! で落とそう！', C.cyan); }
    }
  }
  function fcFishDraw(f) {
    const img = ci('fish_' + f.ty.id);
    if (!img) return;
    ctx.save();
    ctx.translate(Math.round(f.x), Math.round(f.y));
    if (f.dir > 0) ctx.scale(-1, 1);                              // 素材は、左向き
    ctx.drawImage(img, -Math.round(img.naturalWidth / 2), -Math.round(img.naturalHeight / 2));
    ctx.restore();
  }
  function fcDraw() {
    mgFrame('#04141c', '#1a5a7a', '#7ad0ff');
    mgSign('FISH CATCH', '#7ad0ff', '#1a5a7a');
    mgHud('FISH', FCC.fishCount);
    const P = MG_PLAY;
    ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    rect(P.x, P.y, P.w, P.h, '#124a7a');
    for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.07 * (6 - i); rect(P.x, P.y + i * 32, P.w, 32, '#000a20'); }
    ctx.globalAlpha = 0.1; for (let k = 0; k < 4; k++) rect(P.x + 20 + k * (40 + fcDx() / 4) + Math.sin(centerT + k) * 4, P.y, 14, 150, '#bfe8ff'); ctx.globalAlpha = 1;
    rect(P.x, 196, P.w, 54, '#c8a868'); for (let k = 0; k < 14 + Math.ceil(fcDx() / 12); k++) rect(P.x + k * 12 + (k % 3) * 2, 200 + (k % 4) * 3, 3, 2, '#a88848');
    for (let k = 0; k < 5 + Math.round(fcDx() / 36); k++) { const bx = P.x + 14 + k * 36; rect(bx, 176, 2, 22, '#2a8a4a'); rect(bx + Math.round(Math.sin(centerT * 1.5 + k) * 2), 168, 2, 10, '#3aaa5a'); }
    for (const b of FC.bub) rect(P.x + b.x - 12, b.y, b.s > 1 ? 2 : 1, b.s > 1 ? 2 : 1, '#bfe8ff');
    for (const f of FC.fish) if (!(FC.net.state === 'lift' && FC.net.caught && FC.net.caught.indexOf(f) >= 0)) fcFishDraw(f);
    const r = fcNetRect();
    const nb = fcNetBottom();
    if (FC.phase !== 'idle' && FC.net.state !== 'up') {
      const nx = r.x0; const nw = r.x1 - r.x0; const nh = r.y1 - r.y0;
      rect(nx + nw / 2 - 1, P.y, 2, Math.max(0, nb - nh - P.y), '#e8e0c0');
      rect(nx - 1, nb - nh, nw + 2, 2, '#e8e0c0'); rect(nx - 1, nb - 2, nw + 2, 2, '#e8e0c0'); rect(nx - 1, nb - nh, 2, nh, '#e8e0c0'); rect(nx + nw - 1, nb - nh, 2, nh, '#e8e0c0');
      ctx.globalAlpha = 0.35; for (let gx = nx + 6; gx < nx + nw; gx += 6) rect(gx, nb - nh, 1, nh, '#ffffff'); for (let gy = nb - nh + 8; gy < nb; gy += 8) rect(nx, gy, nw, 1, '#ffffff'); ctx.globalAlpha = 1;
      if (FC.net.caught && FC.net.state === 'lift') FC.net.caught.forEach((cf, k, arr) => fcFishDraw({ ty: cf.ty, x: nx + nw * (k + 0.5) / arr.length, y: nb - nh / 2 + (k % 2 ? 4 : -2), dir: cf.dir }));       // 捕まえた魚が、網の中に
    }
    mgFxDraw(FC.fx);
    ctx.restore();
    if (FC.phase === 'idle') {                                    // 選んでいる網が降りる場所の目印
      const sn = fcNet(FC.sel);
      ctx.globalAlpha = 0.2 + 0.1 * Math.sin(centerT * 3);
      rect(sn.x0, FCC.netY0, sn.x1 - sn.x0, 194 - FCC.netY0, FC.sel === 'big' ? '#7dff8a' : '#ffffff');
      ctx.globalAlpha = 1;
    }
    mgBannerDraw(FC.banner, P.y + 46);
    mgStatsOverlay('fish');
    const ok = FC.phase === 'idle';
    const noMed = FC.noMedalT > 0;
    ['normal', 'big'].forEach((k, i) => {                          // 網の選択：選んでいる網は、明るく・枠つき・チェックつき
      const on = FC.sel === k;
      const r = FC_SEL[i];
      mgBtn(r, k === 'normal' ? 'NORMAL' : 'BIG NET', on ? 'go' : 'off', 2, (k === 'normal' ? 'NET  ' : '') + FCC.nets[k].cost + ' MEDAL');
      if (on) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(centerT * 5);
        rect(r.x - 2, r.y - 2, r.w + 4, 2, '#ffffff'); rect(r.x - 2, r.y + r.h, r.w + 4, 2, '#ffffff'); rect(r.x - 2, r.y, 2, r.h, '#ffffff'); rect(r.x + r.w, r.y, 2, r.h, '#ffffff');
        ctx.globalAlpha = 1;
        for (const [cx, cy] of [[0, 2], [1, 3], [2, 2], [3, 1], [4, 0]]) rect(r.x + 5 + cx * 2, r.y + 4 + cy * 2, 2, 2, '#052a14');       // ✓
      }
    });
    const cost = FCC.nets[FC.sel].cost;
    mgBtn(FC_CATCH, noMed ? 'NO MEDAL' : 'CATCH!', ok ? (noMed ? 'hot' : 'on') : 'off', 3, noMed ? '' : cost + ' MEDAL');
    const d = mgDay('fish');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['CATCH ' + d.catches, '#7dff8a'], ['BEST +' + d.bestWin, '#ffe070'], ['GOLD ' + d.golden, '#fff08a']]);
  }
  mgRegister('fishCatch', {
    reset() { FC.phase = 'idle'; FC.banner = null; FC.fx = []; FC.net = { state: 'up', t: 0, caught: null, kind: 'normal' }; fcSpawn(); }, phase: () => FC.phase,
    enter() { if (!FC.fish.length) fcSpawn(); setMessage(hand < 1 ? 'メダルがないよ。席を立って貸出機へ行こう' : '網を選んで、魚を見て、 CATCH! で落とそう！', hand < 1 ? C.pink : C.cyan); },
    update: fcUpdate, draw: fcDraw, hint: '網を選んで CATCH!',
    pointer(e, p) {
      if (FC.phase !== 'idle') return;
      if (inRect(p, FC_SEL[0]) || inRect(p, FC_SEL[1])) {                // 網を選ぶだけ。ここでは、まだ落とさない
        FC.sel = inRect(p, FC_SEL[1]) ? 'big' : 'normal';
        beep(FC.sel === 'big' ? 880 : 660, 0, 0.06, 0.05, 'square');
        setMessage((FC.sel === 'big' ? 'BIG NET（3枚）' : 'NORMAL NET（1枚）') + 'を選んだよ。魚を見て、 CATCH! で落とそう', C.cyan);
      } else if (inRect(p, FC_CATCH)) fcCatch(FC.sel);
    },
    space() { fcCatch(FC.sel); }
  });

  // =====================================================================
  //  👻 GHOST PANIC：10秒間、出てくるゴーストをタップ。だんだん忙しくなる
  // =====================================================================
  const GHC = NGC.ghost;
  const GH_HOLE = (i) => ({ x: 12 + 6 + (i % 3) * (52 + Math.round((W - 180) / 2)), y: 58 + Math.floor(i / 3) * 63 + 4, w: 40, h: 44 });       // ワイド：窓の間隔を広げる（窓・お化けの大きさは そのまま）
  const GH = { phase: 'idle', t: 0, cd: 0, cdKey: '', ghosts: [], plan: [], pi: 0, score: 0, pen: 0, total: 0, cool: 0, fx: [], banner: null, noMedalT: 0, miss: 0 };

  function ghPlan() {                                            // 10秒ぶんの出現を、あらかじめ決めておく
    const plan = [];
    const freeAt = new Array(9).fill(0);
    let t = 0.5;
    const phaseOf = (k) => GHC.phases.find((ph) => k < ph.until) || GHC.phases[GHC.phases.length - 1];
    while (t < GHC.duration - 0.5) {                           // 残り0.5秒以下では、新しいゴースト・ダミーを出さない
      const k = t / GHC.duration;
      const ph = phaseOf(k);
      const pk = GHC.pumpkinRate[0] + (GHC.pumpkinRate[1] - GHC.pumpkinRate[0]) * k;
      const free = [];
      for (let i = 0; i < 9; i++) if (freeAt[i] <= t) free.push(i);
      const group = [];                                        // 同時に出すもの（後半は、ゴースト＋カボチャのペアも）
      const n = free.length >= 2 && Math.random() < ph.multi ? 2 : 1;
      for (let g = 0; g < n && free.length; g++) {
        const hole = free.splice(randInt(0, free.length - 1), 1)[0];
        group.push({ hole, kind: Math.random() < pk ? 'pumpkin' : 'ghost' });
      }
      if (n === 2 && ph.pairPumpkin && Math.random() < ph.pairPumpkin) { group[0].kind = 'ghost'; group[1].kind = 'pumpkin'; }
      if (group.length && group.every((e) => e.kind === 'pumpkin') && Math.random() < 0.7) group[0].kind = 'ghost';          // カボチャだけの場面は、少なめに
      for (const e of group) {
        const dwell = Math.max(GHC.minDwell, (GHC.dwellStart + (GHC.dwellEnd - GHC.dwellStart) * k) * ph.dwellMul * rand(0.92, 1.08));
        plan.push({ t, hole: e.hole, dwell, kind: e.kind, variant: randInt(0, 2) });
        freeAt[e.hole] = t + 0.18 + dwell + 0.3;
      }
      t += (GHC.spawnStart + (GHC.spawnEnd - GHC.spawnStart) * k) * rand(ph.jitter[0], ph.jitter[1]);
      if (t > GHC.duration - GHC.lullFrom && Math.random() < GHC.lullChance) t += rand(GHC.lullGap[0], GHC.lullGap[1]);       // 残り6〜7秒から、ときどき一拍おく
    }
    return plan;
  }
  function ghInsert() {
    if (GH.phase !== 'idle') return;
    if (hand < GHC.betCost) { mgNoMedal(GH); return; }
    mgInsert('ghost');
    GH.plan = ghPlan(); GH.total = GH.plan.filter((e) => e.kind === 'ghost').length; GH.pen = 0; GH.pi = 0; GH.ghosts = []; GH.score = 0; GH.cool = 0; GH.t = 0; GH.cd = 0; GH.cdKey = ''; GH.fx = []; GH.banner = null; GH.miss = 0;
    GH.phase = 'ready';
    setMessage('出てくるゴーストをタップ！🎃カボチャは叩かないで！', C.cyan);
  }
  function ghFinish() {
    const net = Math.max(0, GH.score - GH.pen);
    const got = GHC.debug.enabled && GHC.debug.forceGhosts !== null ? GHC.debug.forceGhosts : net;
    const pay = mgPayBand(GHC.payFrac, Math.min(1, got / Math.max(1, GH.total)) + 1e-9);
    GH.phase = 'result'; GH.t = 0;
    mgSettle('ghost', pay, (o) => { o.bestGhost = Math.max(o.bestGhost, got); });
    const rank = pay >= 5 ? 'PERFECT!' : pay >= 3 ? 'GREAT!' : pay >= 2 ? 'GOOD!' : pay >= 1 ? 'OK' : 'LOW';
    if (pay > 0) { mgCoinRain(GH.fx, Math.min(pay * 4, 30), 1.0); [1047, 1319, 1568].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); }
    GH.banner = { lines: [{ text: 'TIME UP!', scale: 3, color: '#ffe070' }, { text: 'GHOST X ' + got, scale: 2, color: '#ffffff' }, { text: rank + (pay > 0 ? '  WIN ' + pay : ''), scale: 2, color: pay > 0 ? '#7dff8a' : '#a0b0ff' }], t: 0, dur: 2.7 };
    setMessage('ゴーストを' + got + 'たい退治！' + (pay > 0 ? pay + '枚ゲット！' : '残念……次こそ！'), pay > 0 ? C.goldLight : C.dim);
  }
  function ghTap(p) {
    if (GH.cool > 0) return;
    for (const g of GH.ghosts) {
      const a = g.age;
      if (g.dead || a < 0.04 || a > 0.18 + g.dwell + 0.14) continue;
      const h = GH_HOLE(g.hole);
      if (inRect(p, { x: h.x - 4, y: h.y - 4, w: h.w + 8, h: h.h + 8 })) {
        g.dead = true;
        if (g.kind === 'pumpkin') {                                // カボチャは、叩くと減点
          GH.pen++; GH.cool = 0.15;
          GH.fx.push({ type: 'text', x: h.x + h.w / 2, y: h.y + 6, t: 0, dur: 0.6, text: '-1', color: '#ff8aa0' });
          beep(200, 0, 0.12, 0.05, 'square', 120);
          return;
        }
        GH.score++;
        for (let k = 0; k < 7; k++) GH.fx.push({ type: 'dot', x: h.x + h.w / 2, y: h.y + h.h / 2, vx: rand(-1.6, 1.6), vy: rand(-1.8, 0.8), t: 0, dur: rand(0.3, 0.55), color: ['#ffffff', '#d8c0ff', '#9fe8ff'][k % 3], s: 2 });
        GH.fx.push({ type: 'text', x: h.x + h.w / 2, y: h.y + 6, t: 0, dur: 0.5, text: 'POOF!', color: '#ffffff' });
        beep(988, 0, 0.05, 0.05, 'triangle', 1480); noise(0.05, 0.03);
        return;
      }
    }
    GH.cool = GHC.missCooldown;                                  // 空振り：ごく短いクールダウン
    GH.fx.push({ type: 'text', x: p.x, y: p.y, t: 0, dur: 0.45, text: 'MISS!', color: '#ff8aa0' });
    beep(220, 0, 0.06, 0.04, 'square');
  }
  function ghUpdate(dt) {
    if (GH.noMedalT > 0) GH.noMedalT -= dt;
    if (GH.banner) { GH.banner.t += dt; if (GH.banner.t > GH.banner.dur) GH.banner = null; }
    if (GH.cool > 0) GH.cool -= dt;
    mgFxStep(GH.fx, dt, 262);
    if (GH.phase === 'ready') {
      GH.cd += dt;
      if (mgCountdown(GH)) { GH.phase = 'play'; GH.t = 0; GH.banner = { lines: [{ text: 'GO!!', scale: 5, color: '#7dff8a' }], t: 0, dur: 0.6 }; beep(1318, 0, 0.3, 0.06, 'square'); }
    } else if (GH.phase === 'play') {
      GH.t += dt;
      while (GH.pi < GH.plan.length && GH.plan[GH.pi].t <= GH.t) {
        if (GH.plan[GH.pi].t > GHC.duration - 0.5) { GH.pi++; continue; }
        const e = GH.plan[GH.pi++];
        GH.ghosts.push({ hole: e.hole, dwell: e.dwell, variant: e.variant, kind: e.kind, age: 0, dead: false });
        beep(300 + e.hole * 18, 0, 0.05, 0.02, 'triangle', 200);
      }
      for (const g of GH.ghosts) g.age += dt;
      GH.ghosts = GH.ghosts.filter((g) => !g.dead && g.age < 0.18 + g.dwell + 0.2);
      if (GH.t >= GHC.duration) { GH.ghosts = []; ghFinish(); }
    } else if (GH.phase === 'result') {
      GH.t += dt;
      if (GH.t >= 3.1) { GH.phase = 'idle'; GH.banner = null; }
    }
  }
  function ghGhost(h, g) {                                       // 穴から、ひょっこり（新素材）
    const a = g.age;
    const rise = a < 0.18 ? a / 0.18 : a > 0.18 + g.dwell ? Math.max(0, 1 - (a - 0.18 - g.dwell) / 0.2) : 1;
    const img = ci(g.kind === 'pumpkin' ? 'pumpkin' : ['ghost_white', 'ghost_purple', 'ghost_green'][g.variant]);
    if (!img) return;
    const top = h.y + h.h - 3 - rise * (img.naturalHeight - 2);
    ctx.drawImage(img, Math.round(h.x + h.w / 2 - img.naturalWidth / 2), Math.round(top));
  }
  function ghDraw() {
    mgFrame('#0a0414', '#4a2a7a', '#c8a0ff');
    mgSign('GHOST PANIC', '#c8a0ff', '#4a2a7a');
    mgHud('GHOST', GH.phase === 'idle' ? '-' : Math.max(0, GH.score - GH.pen));
    const P = MG_PLAY;
    rect(P.x, P.y, P.w, P.h, '#140a2a');
    { const mx = P.x + 120 + (W - 180); rect(mx, P.y + 4, 18, 18, '#e8e8c0'); rect(mx + 4, P.y + 4, 14, 18, '#14102a'); rect(mx, P.y + 4, 14, 18, '#e8e8c0'); }   // 月
    for (let k = 0; k < 14; k++) rect(P.x + 6 + (k * 37) % 148, P.y + 3 + (k * 13) % 30, 1, 1, '#a0a0d8');
    rect(P.x + 6, P.y + 20, 144, 178, '#2a1a4a'); rect(P.x + 6, P.y + 20, 144, 3, '#4a3a7a');                    // 屋敷
    for (let r = 0; r < 12; r++) rect(P.x + 6 + Math.round((W - 180) / 2) + r * 6, P.y + 12 - Math.abs(6 - r) * 1.3 + 8, 6, 4, '#3a2a5a');
    for (let i = 0; i < 9; i++) {
      const h = GH_HOLE(i);
      rect(h.x - 3, h.y - 3, h.w + 6, h.h + 6, '#6a4a2a'); rect(h.x, h.y, h.w, h.h, '#060210');
      ctx.save(); ctx.beginPath(); ctx.rect(h.x, h.y, h.w, h.h); ctx.clip();
      for (const g of GH.ghosts) if (g.hole === i) ghGhost(h, g);
      ctx.restore();
      rect(h.x - 3, h.y + h.h + 1, h.w + 6, 2, '#4a3a2a');
    }
    mgFxDraw(GH.fx);
    mgScan(P.y, P.h);
    if (GH.phase === 'play') {                                    // 残り時間
      const k = Math.max(0, 1 - GH.t / GHC.duration);
      rect(P.x, P.y + P.h - 5, P.w, 5, '#10081a'); rect(P.x + 1, P.y + P.h - 4, (P.w - 2) * k, 3, k < 0.3 ? '#ff5a6a' : '#7dff8a');
    }
    mgBannerDraw(GH.banner, P.y + 70);
    mgStatsOverlay('ghost');
    if (GH.phase === 'idle') mgInsertBtn(GH.noMedalT, GHC.betCost);
    else if (GH.phase === 'play') { drawTextCenter('TAP THE GHOSTS!', 90 + Math.round((W - 180) / 2), 270, '#c8a0ff', 2, '#2a1a4a'); drawTextCenter(GH.cool > 0 ? 'WAIT...' : '', 90, 292, '#ff8aa0', 1); }
    const d = mgDay('ghost');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['BEST GHOST ' + d.bestGhost, '#c8a0ff'], ['BEST +' + d.bestWin, '#ffe070']]);
  }
  mgRegister('ghostPanic', {
    reset() { GH.phase = 'idle'; GH.banner = null; GH.fx = []; GH.ghosts = []; }, phase: () => GH.phase,
    enter() { setMessage(hand < GHC.betCost ? 'メダルがないよ。席を立って貸出機へ行こう' : 'INSERTを押して、ゴーストを退治しよう！', hand < GHC.betCost ? C.pink : C.cyan); },
    update: ghUpdate, draw: ghDraw, hint: 'ゴーストをタップ！',
    pointer(e, p) { if (GH.phase === 'idle') { if (inRect(p, MG_INSERT)) ghInsert(); } else if (GH.phase === 'play') ghTap(p); },
    space() { if (GH.phase === 'idle') ghInsert(); }
  });

  // =====================================================================
  //  🏴‍☠️ PIRATE TREASURE：3ラウンド × 3つの宝箱。箱の見た目と中身は無関係（中身は、ラウンドの最初に確定）
  //   選んだ箱を ﾊﾟｶｯ と開けて、少し間を置いて、選ばなかった2箱も開きます（答え合わせ）
  // =====================================================================
  const PTC = NGC.pirate;
  const PT_COLORS = ['brown', 'red', 'gold', 'blue', 'silver', 'black'];
  const PT_GEMS = ['gem_stone', 'gem_coin', 'gem_sapphire', 'gem_emerald', 'gem_ruby', 'gem_diamond'];
  let PT_CH = [0, 1, 2].map((i) => ({ x: 11 + i * 52, y: 122, w: 50, h: 54 }));
  const PT = { phase: 'idle', t: 0, round: 0, chests: [], pick: -1, got: [], total: 0, fx: [], banner: null, noMedalT: 0 };

  function ptRoll() {
    return [0, 1, 2].map(() => {
      let r = Math.random(); let idx = 0;
      for (; idx < PTC.probs.length - 1; idx++) { r -= PTC.probs[idx]; if (r < 0) break; }
      return idx;
    });
  }
  function ptStartRound() {
    const skins = shuffled(PT_COLORS.map((_, i) => i)).slice(0, 3);             // 6種類の中から3種類
    const items = ptRoll();
    PT.chests = skins.map((s, i) => ({ skin: s, item: items[i], open: false, shown: false }));     // 3つの中身は、ここで確定
    PT.pick = -1; PT.phase = 'choose'; PT.t = 0;
    setMessage('ROUND ' + (PT.round + 1) + '！どの宝箱を開ける？（見た目と中身は関係ないよ）', C.cyan);
  }
  function ptInsert() {
    if (PT.phase !== 'idle') return;
    if (hand < PTC.betCost) { mgNoMedal(PT); return; }
    mgInsert('pirate');
    PT.round = 0; PT.got = []; PT.total = 0; PT.fx = []; PT.banner = null;
    ptStartRound();
  }
  function ptChoose(i) {
    if (PT.phase !== 'choose') return;
    const c = PT.chests[i];
    const dbg = PTC.debug;
    if (dbg.enabled && dbg.forceItems && dbg.forceItems[PT.round]) { const f = PTC.items.indexOf(dbg.forceItems[PT.round]); if (f >= 0) c.item = f; }
    PT.pick = i; PT.phase = 'reveal'; PT.t = 0;
    beep(300, 0, 0.1, 0.05, 'square', 200); noise(0.15, 0.04);                           // ガチャ！
  }
  function ptFinishRound() {
    const c = PT.chests[PT.pick];
    PT.got.push(c.item); PT.total += PTC.values[c.item];
    PT.round++;
    if (PT.round >= 3) ptResult(); else ptStartRound();
  }
  function ptResult() {
    const pay = mgPayBand(PTC.payBands, PT.total);
    PT.phase = 'result'; PT.t = 0;
    mgSettle('pirate', pay, (o) => { o.bestValue = Math.max(o.bestValue, PT.total); o.diamond += PT.got.filter((g) => g === 5).length; });
    if (pay > 0) { mgCoinRain(PT.fx, Math.min(pay * 3, 40), 1.4); [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); }
    PT.special = PT.got.length === 3 && PT.got.every((g) => g === 5);         // DIAMOND ×3（VALUE 24）
    PT.glowT = 0;
    if (PT.special) {
      [1047, 1319, 1568, 2093, 2637, 3136, 3136].forEach((f, i) => beep(f, i * 0.09, 0.16, 0.05, 'triangle'));
      mgCoinRain(PT.fx, 44, 2.4);
      for (let i = 0; i < 3; i++) ptSparkle(i, 16);
      PT.banner = { lines: [{ text: 'PERFECT TREASURE!', scale: 2, color: '#9ff8ff' }, { text: 'DIAMOND x3  VALUE ' + PT.total, scale: 1, color: '#ffffff' }, { text: 'WIN +' + pay + ' MEDALS', scale: 2, color: '#ffe070' }], t: 0, dur: 4.8 };
    } else
    PT.banner = { lines: [{ text: 'TOTAL VALUE ' + PT.total, scale: 2, color: '#ffffff' }, { text: pay >= 5 ? 'BIG WIN!' : pay > 0 ? 'WIN!' : 'NO WIN', scale: 3, color: pay > 0 ? '#ffe070' : '#a0b0ff' }, { text: pay > 0 ? '+' + pay + ' MEDALS' : '', scale: 2, color: '#7dff8a' }], t: 0, dur: 3.2 };
    setMessage('VALUE 合計' + PT.total + '！ ' + (pay > 0 ? pay + '枚ゲット！' : '残念……次こそ！'), pay > 0 ? C.goldLight : C.dim);
  }
  function ptSparkle(i, n) {
    for (let k = 0; k < n; k++) PT.fx.push({ type: 'star', x: PT_CH[i].x + 25, y: 120, vx: rand(-1.6, 1.6), vy: rand(-2, -0.4), t: 0, dur: rand(0.6, 1.1), color: ['#fff8d0', '#ffd040', '#9ff8ff', '#ff8ef0'][k % 4] });
  }
  function ptUpdate(dt) {
    if (PT.noMedalT > 0) PT.noMedalT -= dt;
    if (PT.banner) { PT.banner.t += dt; if (PT.banner.t > PT.banner.dur) PT.banner = null; }
    mgFxStep(PT.fx, dt, 262);
    PT.t += dt;
    if (PT.phase === 'reveal') {
      const c = PT.chests[PT.pick];
      if (PT.t > 0.1 && !c.open) { c.open = true; beep(440, 0, 0.08, 0.05, 'square', 880); }                    // ﾊﾟｶｯ
      if (PT.t > 0.6 && !c.shown) {
        c.shown = true;
        const it = c.item;
        const fanfare = it >= 5 ? [1047, 1319, 1568, 2093, 2637] : it >= 4 ? [1047, 1319, 1568, 2093] : it >= 2 ? [1047, 1319, 1568] : it === 1 ? [880, 1175] : [220];
        fanfare.forEach((f, i) => beep(f, i * 0.07, 0.12, 0.05, it === 0 ? 'square' : 'triangle'));
        if (it >= 2) ptSparkle(PT.pick, it >= 5 ? 14 : 8);
        setMessage(PTC.items[it] + (it === 0 ? '……石ころ。' : it >= 4 ? '！！すごい！' : '！'), it >= 4 ? C.yellow : C.text);
      }
      if (PT.t > 1.7 && !PT.others) {                                                                          // 選ばなかった2箱も、ﾊﾟｶｯ
        PT.others = true;
        let better = null;
        PT.chests.forEach((o, i) => {
          if (i === PT.pick) return;
          o.open = true; o.shown = true;
          if (PTC.values[o.item] > PTC.values[c.item] && (!better || PTC.values[o.item] > PTC.values[better.item])) better = o;
          if (o.item >= 4) ptSparkle(i, 6);
        });
        beep(392, 0, 0.08, 0.05, 'square', 784); beep(523, 0.09, 0.08, 0.05, 'square', 1046);
        setMessage(better ? 'あっちには' + PTC.items[better.item] + 'が……！！' : '一番いい箱を選んだ！', better ? C.pink : C.goldLight);
      }
      if (PT.t >= 3.4) { PT.others = false; ptFinishRound(); }
    } else if (PT.phase === 'result') {
      PT.glowT += dt;
      if (PT.t >= (PT.special ? 5.4 : 3.6)) { PT.phase = 'idle'; PT.banner = null; PT.got = []; PT.total = 0; PT.special = false; PT.round = 0; }       // 前回のリザルトは、ここで消す
    }
  }
  function ptChestDraw(c, x, y, dim) {
    const img = ci('chest_' + PT_COLORS[c.skin] + (c.open ? '_open' : '_close'));
    if (!img) return;
    ctx.globalAlpha = dim ? 0.55 : 1;
    ctx.drawImage(img, x, y + 54 - img.naturalHeight);
    ctx.globalAlpha = 1;
  }
  function ptGemDraw(item, cx, y, a) {
    const g = ci(PT_GEMS[item]);
    if (!g) return;
    ctx.globalAlpha = a === undefined ? 1 : a;
    ctx.drawImage(g, Math.round(cx - g.naturalWidth / 2), Math.round(y));
    ctx.globalAlpha = 1;
  }
  function ptDraw() {
    mgFrame('#140a04', '#7a4a18', '#ffd040');
    mgSign('PIRATE TREASURE', '#ffd040', '#7a4a18');
    mgHud('ROUND', PT.phase === 'idle' ? '-' : Math.min(PT.round + 1, 3) + '/3');
    const P = MG_PLAY;
    const rd = Math.min(PT.round, 2);
    const sky = ['#58b0e8', '#2a2430', '#3a2810'][rd];
    rect(P.x, P.y, P.w, P.h, sky);
    if (rd === 0) { rect(P.x, P.y + 80, P.w, 20, '#3a88c8'); rect(P.x, P.y + 100, P.w, 100, '#e8d090'); for (let k = 0; k < 7 + Math.ceil((W - 180) / 22); k++) rect(P.x + 8 + k * 22, P.y + 82 + (k % 2) * 6, 10, 1, '#bfe8ff'); rect(P.x + 120, P.y + 14, 14, 14, '#fff3a0'); }
    else if (rd === 1) { for (let k = 0; k < 8 + Math.ceil((W - 180) / 20); k++) { rect(P.x + k * 20, P.y, 12, 30 + (k * 17) % 30, '#4a3a4a'); rect(P.x + k * 20 + 2, P.y + 90 + (k % 3) * 8, 14, 60, '#3a2a3a'); } rect(P.x, P.y + 150, P.w, 50, '#2a2028'); ctx.globalAlpha = 0.25; rect(P.x + 60, P.y + 20, 40, 130, '#9fd0ff'); ctx.globalAlpha = 1; }
    else { rect(P.x, P.y, P.w, 30, '#6a4a20'); for (let k = 0; k < 6 + Math.ceil((W - 180) / 26); k++) { rect(P.x + 8 + k * 26, P.y + 40 + (k % 2) * 4, 8, 8, '#ffd040'); rect(P.x + 14 + k * 24, P.y + 60 + (k % 3) * 6, 6, 6, '#ff5060'); } rect(P.x, P.y + 140, P.w, 60, '#4a3010'); for (let k = 0; k < 12; k++) rect(P.x + 4 + k * 13, P.y + 146 + (k % 3) * 6, 5, 3, '#ffd040'); }
    if (PT.phase === 'choose' || PT.phase === 'reveal') {
      PT.chests.forEach((c, i) => {
        const ch = PT_CH[i];
        const bob = PT.phase === 'choose' ? Math.round(Math.sin(centerT * 3 + i * 1.7) * 1.5) : 0;
        ptChestDraw(c, ch.x, ch.y + bob, PT.phase === 'reveal' && PT.pick !== i && !c.open);
      });
      if (PT.phase === 'reveal') {
        PT.chests.forEach((c, i) => {
          if (!c.shown) return;
          const k = i === PT.pick ? Math.min(1, (PT.t - 0.6) / 0.35) : Math.min(1, (PT.t - 1.7) / 0.35);
          ptGemDraw(c.item, PT_CH[i].x + 25, PT_CH[i].y - 24 - k * 6, i === PT.pick ? 1 : 0.9);
        });
        const c = PT.chests[PT.pick];
        if (c.shown) drawTextCenter(PTC.items[c.item], 90 + Math.round((W - 180) / 2), 182, '#fff0c0', 2, '#2a1008');
      }
      if (PT.phase === 'choose') { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(centerT * 4); drawTextCenter('PICK A CHEST!', 90 + Math.round((W - 180) / 2), 100, '#ffffff', 2, '#2a1008'); ctx.globalAlpha = 1; }
    }
    rect(P.x + 4, 198, P.w - 8, 46, 'rgba(10,6,4,0.75)');
    drawText('YOUR TREASURE', 18, 202, C.dim, 1);
    for (let i = 0; i < 3; i++) {
      rect(18 + i * 40, 212, 32, 28, '#1a1008');
      if (PT.got[i] !== undefined) ptGemDraw(PT.got[i], 34 + i * 40, 216);
    }
    drawText('TOTAL', 138, 214, C.dim, 1); drawText(String(PT.total), 150, 226, '#ffe070', 2, '#4a3008');
    mgFxDraw(PT.fx);
    if (PT.special && PT.phase === 'result') {                     // 神引き：ゆっくり金色に光る（点滅はしない）
      ctx.globalAlpha = 0.28 * Math.sin(Math.PI * Math.min(1, PT.glowT / 4.5)); rect(8, 8, W - 16, H - 16, '#ffe9a0'); ctx.globalAlpha = 1;
    }
    mgBannerDraw(PT.banner, P.y + 40);
    mgStatsOverlay('pirate');
    if (PT.phase === 'idle') mgInsertBtn(PT.noMedalT, PTC.betCost);
    else drawTextCenter(PT.phase === 'result' ? 'THE END' : 'ROUND ' + Math.min(PT.round + 1, 3), 90 + Math.round((W - 180) / 2), 276, '#ffd090', 2, '#4a2808');
    const d = mgDay('pirate');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['BEST VALUE ' + d.bestValue, '#ffe070'], ['BEST +' + d.bestWin, '#7dff8a'], ['DIA ' + d.diamond, '#9fe8ff']]);
  }
  mgRegister('pirateTreasure', {
    reset() { PT.phase = 'idle'; PT.banner = null; PT.fx = []; PT.got = []; PT.total = 0; PT.round = 0; PT.others = false; PT.special = false; }, phase: () => PT.phase,
    enter() { setMessage(hand < PTC.betCost ? 'メダルがないよ。席を立って貸出機へ行こう' : 'INSERTを押して、宝探しに行こう！', hand < PTC.betCost ? C.pink : C.cyan); },
    update: ptUpdate, draw: ptDraw, hint: '宝箱を選ぼう！',
    pointer(e, p) {
      if (PT.phase === 'idle') { if (inRect(p, MG_INSERT)) ptInsert(); return; }
      if (PT.phase === 'choose') for (let i = 0; i < 3; i++) if (inRect(p, { x: PT_CH[i].x - 3, y: PT_CH[i].y - 8, w: 56, h: 66 })) { ptChoose(i); return; }
    },
    space() { if (PT.phase === 'idle') ptInsert(); }
  });

  // =====================================================================
  //  🚂 STOP! TRAIN：BRAKE!は一度だけ。押してから、じわじわ減速して、どこで止まるかを見る
  //   速さ（SPEED）と車両数（CARS）が毎回かわります。画面に出ているので、「今日は速いから、早めに」と考えられます
  // =====================================================================
  const TRC = NGC.train;
  const TR_Y = 181;                                              // 汽車の位置（車輪の最下部が、レールの上面（y=190）につながる高さ）
  const TR_FRONT0 = 50;
  const trFront = () => TR_FRONT0 + Math.round((W - 180) * 0.5);       // ワイド：列車の位置を右へ寄せて、線路を長く見せる（速さ・停止距離・タイミングは そのまま）                                           // 列車の先頭の、画面での位置（右側に、停止マークが見える）
  let TR_BTN = { x: 24, y: 258, w: 132, h: 56 };
  const TR = { runIn: 1.6, phase: 'idle', t: 0, speedName: 'NORMAL', cars: 3, v0: 110, aMax: 60, X: 600, pos: 0, v: 110, brake: false, bt: 0, p0: 0, result: null, smoke: [], banner: null, noMedalT: 0, clack: 0 };
  const trDecel = (cars) => TRC.baseDecel / (1 + TRC.carFactor * (cars - 2));
  function trStopDistance(v0, cars) {                             // 押してから止まるまでの距離（デバッグ・調整用）
    const aMax = trDecel(cars); let v = v0; let d = 0; let t = 0; const dt = 0.002;
    while (v > 0) { t += dt; v -= aMax * Math.min(1, t / TRC.rampTime) * dt; d += Math.max(0, v) * dt; }
    return d;
  }
  function trInsert() {
    if (TR.phase !== 'idle') return;
    if (hand < TRC.betCost) { mgNoMedal(TR); return; }
    mgInsert('train');
    const names = Object.keys(TRC.speeds);
    const dbg = TRC.debug;
    TR.speedName = dbg.enabled && dbg.forceSpeed && TRC.speeds[dbg.forceSpeed] ? dbg.forceSpeed : names[randInt(0, names.length - 1)];
    TR.cars = dbg.enabled && dbg.forceCars ? dbg.forceCars : TRC.carsList[randInt(0, TRC.carsList.length - 1)];
    TR.v0 = TRC.speeds[TR.speedName]; TR.v = TR.v0; TR.aMax = trDecel(TR.cars);
    TR.X = TR.v0 * (TRC.approachBySpeed[TR.speedName] || TRC.approach) + rand(-12, 12);
    TR.runIn = TRC.runInBySpeed[TR.speedName] || TRC.runIn;                  // 停止マークの位置
    TR.pos = 0; TR.brake = false; TR.bt = 0; TR.result = null; TR.smoke = []; TR.banner = null; TR.phase = 'run'; TR.t = 0;
    setMessage(TR.cars + '両編成。まずスピードを見てから、ちょうどいい所で BRAKE!', C.cyan);
  }
  function trBrake() {
    if (TR.phase !== 'run' || TR.brake) return;
    if (TR.t < TR.runIn) return;                                  // 助走のあいだは、まだ押せない
    TR.brake = true; TR.bt = 0; TR.p0 = TR.pos;
    noise(0.9, 0.05); beep(260, 0, 0.8, 0.03, 'sawtooth', 140);       // ｼｭｰｰｰｯ
    setMessage('ブレーキ！じわじわ……', C.yellow);
  }
  function trStop() {
    const e = TR.pos - TR.X;                                      // マイナス＝手前、プラス＝行き過ぎ
    const zs = TR.v0 / TRC.zoneRefSpeed;
    const z = { perfect: TRC.zones.perfect * zs, good: TRC.zones.good * zs, ok: TRC.zones.ok * zs }; const ae = Math.abs(e);
    let pay = 0; let label = e < 0 ? 'TOO EARLY!' : 'OVERRUN!'; let col = '#a0b0ff';
    if (ae <= z.perfect) { pay = TRC.pays.perfect; label = 'PERFECT STOP!!'; col = '#ffe070'; }
    else if (ae <= z.good) { pay = TRC.pays.good; label = 'GOOD STOP!'; col = '#7dff8a'; }
    else if (ae <= z.ok) { pay = TRC.pays.ok; label = 'STOP!'; col = '#9fe8ff'; }
    TR.result = { e, pay, label };
    TR.phase = 'result'; TR.t = 0;
    mgSettle('train', pay, (o) => { if (pay === TRC.pays.perfect && ae <= z.perfect) o.perfect++; });
    noise(0.12, 0.05); beep(180, 0, 0.12, 0.05, 'square', 110);   // ﾌﾟｼｭｰ
    if (pay > 0) [1047, 1319, 1568].forEach((f, i) => beep(f, 0.15 + i * 0.07, 0.1, 0.05));
    TR.banner = { lines: [{ text: label, scale: label.length > 11 ? 2 : 3, color: col }, { text: 'GAP ' + (e > 0 ? '+' : '') + Math.round(e), scale: 1, color: '#ffffff' }, { text: pay > 0 ? 'WIN +' + pay : 'NO WIN', scale: 2, color: pay > 0 ? '#7dff8a' : '#a0b0ff' }], t: 0, dur: 2.7 };
    setMessage(label + ' ' + (pay > 0 ? pay + '枚ゲット！' : '残念……次こそ！'), pay > 0 ? C.goldLight : C.dim);
  }
  function trUpdate(dt) {
    if (TR.noMedalT > 0) TR.noMedalT -= dt;
    if (TR.banner) { TR.banner.t += dt; if (TR.banner.t > TR.banner.dur) TR.banner = null; }
    TR.t += dt;
    for (let i = TR.smoke.length - 1; i >= 0; i--) { const s = TR.smoke[i]; s.t += dt; s.y -= 8 * dt; s.x -= (6 + TR.v * 0.5) * dt; if (s.t > s.dur) TR.smoke.splice(i, 1); }
    if (TR.phase === 'run') {
      if (TR.brake) {
        TR.bt += dt;
        TR.v -= TR.aMax * Math.min(1, TR.bt / TRC.rampTime) * dt;      // 徐々にブレーキがきいて、減速
        if (TR.v <= 0) { TR.v = 0; TR.pos += 0; trStop(); return; }
      }
      TR.pos += TR.v * dt;
      TR.clack += TR.v * dt;
      if (TR.clack > 26) { TR.clack = 0; noise(0.03, 0.025); beep(150 + Math.random() * 30, 0, 0.03, 0.02, 'square'); }  // ガタンゴトン
      if (Math.random() < dt * (2 + TR.v / 10)) TR.smoke.push({ x: trFront() - 17, y: TR_Y - 20, t: 0, dur: 1.2 });
      if (!TR.brake && TR.pos > TR.X + 90) { TR.v = 0; trStop(); }    // ブレーキを押さずに通過
    } else if (TR.phase === 'result' && TR.t >= 3.1) { TR.phase = 'idle'; TR.banner = null; }
  }
  function trDraw() {
    mgFrame('#06141c', '#2a6a5a', '#9fffd0');
    mgSign('STOP! TRAIN', '#9fffd0', '#2a6a5a');
    mgHud('CARS', TR.phase === 'idle' ? '-' : TR.cars);
    const P = MG_PLAY;
    ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    const cam = TR.pos;
    rect(P.x, P.y, P.w, P.h, '#7ac8f0'); rect(P.x, P.y, P.w, 40, '#4a98d8'); rect(P.x, P.y + 40, P.w, 40, '#6ab8e8');
    for (let k = 0; k < 4 + Math.round((W - 180) / 70); k++) { const cx = P.x + ((k * 70 - cam * 0.1) % (260 + (W - 180)) + (260 + (W - 180))) % (260 + (W - 180)) - 40; rect(cx, 66, 26, 5, '#ffffff'); rect(cx + 6, 62, 16, 5, '#ffffff'); }
    for (let k = 0; k < 6 + Math.round((W - 180) / 60); k++) { const mx = P.x + ((k * 60 - cam * 0.25) % (360 + (W - 180)) + (360 + (W - 180))) % (360 + (W - 180)) - 50; for (let r = 0; r < 28; r++) rect(mx + r, 150 - Math.max(0, 28 - Math.abs(14 - r) * 2), 1, Math.max(0, 28 - Math.abs(14 - r) * 2), '#4a7a6a'); }
    rect(P.x, 150, P.w, 24, '#5aa860'); rect(P.x, 174, P.w, 76, '#4a8a50');
    rect(P.x, 188, P.w, 6, '#7a6a50');
    // 駅のホーム と 停止マーク
    const sx = (wx) => trFront() + (wx - cam);
    const px0 = sx(TR.X - 70); const px1 = sx(TR.X + 70);
    if (px1 > P.x && px0 < P.x + P.w) {
      rect(px0, 170, px1 - px0, 18, '#b8b0a0'); rect(px0, 170, px1 - px0, 3, '#e8e0d0');
      rect(sx(TR.X - 52), 126, 104, 36, '#8a4a3a'); rect(sx(TR.X - 58), 120, 116, 8, '#3a2a5a'); rect(sx(TR.X - 44), 134, 14, 14, '#ffe9a0'); rect(sx(TR.X + 30), 134, 14, 14, '#ffe9a0'); rect(sx(TR.X - 8), 138, 16, 24, '#4a2a20');
      for (let k = -60; k <= 60; k += 10) rect(sx(TR.X + k), 184, 1, k % 20 === 0 ? 4 : 2, '#6a5a4a');       // 目もり
      rect(sx(TR.X) - 1, 150, 3, 38, '#ff3040'); rect(sx(TR.X) - 6, 146, 14, 6, '#ff3040'); drawTextCenter('STOP', sx(TR.X) + 1, 147, '#ffffff', 1);
    }
    for (let k = Math.floor((cam - trFront()) / 90) - 1; k <= Math.floor((cam + 200 + (W - 180)) / 90); k++) { const x = trFront() + k * 90 - cam; rect(x, 148, 2, 42, '#5a4a3a'); rect(x - 5, 151, 12, 2, '#5a4a3a'); }       // 線路脇の電柱（速さが、流れ方で分かる）
    rect(P.x, 190, P.w, 3, '#d0d0e0');                                // レール
    { const nT = 14 + Math.ceil((W - 180) / 13); for (let k = 0; k < nT; k++) rect(P.x + ((k * 13 - cam) % (nT * 13) + nT * 13) % (nT * 13) - 8, 193, 8, 4, '#6a4a2a'); }
    // 列車（先頭が右、うしろへ車両）
    const trainY = TR_Y;
    const bump = TR.phase === 'run' && TR.v > 0 ? Math.round(Math.sin(TR.t * 22) * 0.6) : 0;
    const loco = ci('train');                                           // 新しい蒸気機関車（煙・連結ロッドなし）
    if (loco) ctx.drawImage(loco, trFront() - loco.naturalWidth + 2, trainY + 11 + bump - loco.naturalHeight);
    const carBase = loco ? loco.naturalWidth - 2 : 36;
    const wheelAng = TR.pos * 0.22;
    for (let c = 0; c < TR.cars; c++) {
      const cx = trFront() - carBase - (c + 1) * 26;
      rect(cx, trainY - 14 + bump, 24, 19, c % 2 ? '#3a78c8' : '#e8c83a'); rect(cx, trainY - 14 + bump, 24, 2, '#ffffff');
      rect(cx + 3, trainY - 10 + bump, 5, 5, '#bfe8ff'); rect(cx + 10, trainY - 10 + bump, 5, 5, '#bfe8ff'); rect(cx + 17, trainY - 10 + bump, 5, 5, '#bfe8ff');
      rect(cx + 2, trainY + 5 + bump, 6, 6, '#2a2a34'); rect(cx + 16, trainY + 5 + bump, 6, 6, '#2a2a34');
      for (const wx of [5, 19]) rect(cx + wx + Math.round(Math.cos(wheelAng) * 2), trainY + 8 + bump + Math.round(Math.sin(wheelAng) * 2), 1, 1, '#c8c8d8');   // 車輪の回転
    }
    for (const s of TR.smoke) { ctx.globalAlpha = Math.max(0, 0.7 - s.t / s.dur); rect(s.x, s.y, 5 + s.t * 5, 5 + s.t * 5, '#f0f0f8'); ctx.globalAlpha = 1; }
    if (TR.phase === 'run' && !TR.brake) {                           // 条件の表示
      ctx.globalAlpha = 0.8; rect(P.x + 3, P.y + 3, 40, 11, '#05030a'); ctx.globalAlpha = 1;
      drawText('CARS ' + TR.cars, P.x + 6, P.y + 6, '#9fe8ff', 1);
    }
    ctx.restore();
    mgScan(P.y, P.h);
    mgBannerDraw(TR.banner, P.y + 40);
    mgStatsOverlay('train');
    if (TR.phase === 'idle') mgInsertBtn(TR.noMedalT, TRC.betCost);
    else mgBtn(TR_BTN, TR.phase === 'run' && !TR.brake && TR.t < TR.runIn ? 'WATCH...' : 'BRAKE!', TR.phase === 'run' && !TR.brake && TR.t >= TR.runIn ? 'hot' : 'off', 3);
    const d = mgDay('train');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['PERFECT ' + d.perfect, '#ffe070'], ['BEST +' + d.bestWin, '#7dff8a']]);
  }
  mgRegister('stopTrain', {
    reset() { TR.phase = 'idle'; TR.banner = null; TR.smoke = []; }, phase: () => TR.phase,
    enter() { setMessage(hand < TRC.betCost ? 'メダルがないよ。席を立って貸出機へ行こう' : 'INSERTを押して、列車をちょうどよく止めよう！', hand < TRC.betCost ? C.pink : C.cyan); },
    update: trUpdate, draw: trDraw, hint: '一度だけ BRAKE!',
    pointer(e, p) { if (TR.phase === 'idle') { if (inRect(p, MG_INSERT)) trInsert(); } else if (TR.phase === 'run' && inRect(p, TR_BTN)) trBrake(); },
    space() { if (TR.phase === 'idle') trInsert(); else trBrake(); }
  });

  // =====================================================================
  //  🎈 BALLOON SHOOT：照準は自動で動く。FIRE!のタイミングだけ決める（1メダルで3発）
  //   風船は、FIREを知りません。重なった風船は、1発で複数割れます
  // =====================================================================
  const BLC = NGC.balloon;
  let BL_FIRE = { x: 24, y: 262, w: 132, h: 50 };
  let BL_YES = { x: 12, y: 258, w: 74, h: 56 };
  let BL_NO = { x: 94, y: 258, w: 74, h: 56 };
  // ワイド：射的場が広がっても、風船の密度・照準の往復の時間は、そのまま（風船の数と、照準の振れ幅を、横幅に比例させる）
  const blSx = () => (156 + (W - 180)) / 156;
  const blCount = () => Math.round(BLC.balloonCount * blSx());
  const blCx = () => 90 + Math.round((W - 180) / 2);
  const BL = { extraUsed: false, offerT: 0, phase: 'idle', t: 0, balloons: [], shots: 0, score: 0, bullets: [], pat: 0, ph: 0, cx: 90, cy: 150, fx: [], banner: null, noMedalT: 0, hits: [], gold: 0 };

  function blSpawn(b, initial) {
    const ty = pickWeighted(BLC.types, 'weight');
    b.ty = ty; b.r = ty.r; b.x = rand(24, 156 + (W - 180)); b.y = initial ? rand(60, 240) : 256 + rand(0, 40);
    b.vy = -ty.speed * rand(0.85, 1.15); b.sw = rand(3, 8); b.sp = rand(0.6, 1.4); b.ph = rand(0, 6.28); b.bx = b.x; b.alive = true;
  }
  function blCross(t) {                                           // 照準：自動で動く（左右・上下・円・8の字など）
    const w = 1.5 * BLC.crossSpeed;
    const ph = BL.ph; const c = blCx(); const k = blSx();
    if (BL.pat === 0) return { x: c + 66 * k * Math.sin(w * t + ph), y: 150 + 20 * Math.sin(w * 0.37 * t) };
    if (BL.pat === 1) return { x: c + 20 * k * Math.sin(w * 0.37 * t), y: 150 + 78 * Math.sin(w * t + ph) };
    if (BL.pat === 2) return { x: c + 58 * k * Math.cos(w * t + ph), y: 150 + 72 * Math.sin(w * t + ph) };
    return { x: c + 62 * k * Math.sin(1.3 * w * t + ph), y: 150 + 70 * Math.sin(w * t) };
  }
  function blInsert() {
    if (BL.phase !== 'idle') return;
    if (hand < BLC.betCost) { mgNoMedal(BL); return; }
    mgInsert('balloon');
    BL.balloons = []; for (let i = 0; i < blCount(); i++) { const b = {}; blSpawn(b, true); BL.balloons.push(b); }
    BL.extraUsed = false; BL.shots = BLC.shots; BL.score = 0; BL.bullets = []; BL.fx = []; BL.banner = null; BL.t = 0; BL.gold = 0;
    BL.pat = randInt(0, 3); BL.ph = rand(0, 6.28); BL.phase = 'play';
    setMessage('照準は自動で動くよ。狙いが重なる瞬間に FIRE!', C.cyan);
  }
  function blFire() {
    if (BL.phase !== 'play' || BL.shots <= 0) return;
    BL.shots--;
    const c = blCross(BL.t);
    BL.bullets.push({ x: blCx(), y: 252, tx: c.x, ty: c.y, t: 0, dur: 0.14 });
    beep(700, 0, 0.06, 0.05, 'square', 300);
  }
  function blPop(b) {
    b.alive = false; BL.score += b.ty.pts; if (b.ty.id === 'star') BL.gold++;
    for (let k = 0; k < 8; k++) BL.fx.push({ type: 'dot', x: b.x, y: b.y, vx: rand(-1.8, 1.8), vy: rand(-1.8, 1.2), t: 0, dur: rand(0.3, 0.5), color: b.ty.color, s: 2 });
    BL.fx.push({ type: 'text', x: b.x, y: b.y - 6, t: 0, dur: 0.6, text: '+' + b.ty.pts, color: '#ffffff' });
    beep(520 + b.ty.pts * 140, 0, 0.07, 0.05, 'triangle'); noise(0.06, 0.04);
  }
  function blMore() {                                           // 追加購入：+1メダル → +2発
    if (BL.phase !== 'offer' || hand < BLC.extra.cost) return;
    mgInsert('balloon', BLC.extra.cost, true);
    BL.extraUsed = true;
    BL.shots = Math.min(BLC.extra.shots, BLC.extra.maxShots - BLC.shots);
    BL.phase = 'play';
    beep(880, 0, 0.08, 0.05, 'square'); beep(1175, 0.08, 0.1, 0.05, 'square');
    setMessage('+2発！狙って FIRE!', C.cyan);
  }
  function blFinish() {
    const sc = BLC.debug.enabled && BLC.debug.forceScore !== null ? BLC.debug.forceScore : BL.score;
    const pay = mgPayBand(BLC.payBands, sc);
    BL.phase = 'result'; BL.t = 0;
    mgSettle('balloon', pay, (o) => { o.bestScore = Math.max(o.bestScore, sc); o.gold += BL.gold; });
    const rank = pay >= 5 ? 'PERFECT!' : pay >= 3 ? 'GREAT!' : pay >= 2 ? 'GOOD!' : pay >= 1 ? 'OK' : 'LOW';
    if (pay > 0) { mgCoinRain(BL.fx, Math.min(pay * 4, 30), 1.0); [1047, 1319, 1568].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); }
    BL.banner = { lines: [{ text: 'SCORE ' + sc, scale: 3, color: '#ffffff' }, { text: rank + (pay > 0 ? '  WIN ' + pay : ''), scale: 2, color: pay > 0 ? '#ffe070' : '#a0b0ff' }], t: 0, dur: 2.7 };
    setMessage('スコア ' + sc + '！ ' + (pay > 0 ? pay + '枚ゲット！' : '残念……次こそ！'), pay > 0 ? C.goldLight : C.dim);
  }
  function blUpdate(dt) {
    if (BL.noMedalT > 0) BL.noMedalT -= dt;
    if (BL.banner) { BL.banner.t += dt; if (BL.banner.t > BL.banner.dur) BL.banner = null; }
    mgFxStep(BL.fx, dt, 262);
    BL.t += dt;
    for (const b of BL.balloons) {
      if (!b.alive) { if (BL.phase === 'play' || BL.phase === 'idle') blSpawn(b, false); continue; }
      b.y += b.vy * dt; b.x = b.bx + Math.sin(BL.t * b.sp + b.ph) * b.sw;
      if (b.y < MG_PLAY.y - 12) blSpawn(b, false);
    }
    if (BL.phase === 'play') {
      for (let i = BL.bullets.length - 1; i >= 0; i--) {
        const bu = BL.bullets[i]; bu.t += dt;
        if (bu.t >= bu.dur) {                                      // 着弾：重なった風船は、まとめて割れる
          BL.bullets.splice(i, 1);
          for (const b of BL.balloons) if (b.alive && Math.hypot(b.x - bu.tx, b.y - bu.ty) <= b.r + BLC.blast * 0.5) blPop(b);
          BL.fx.push({ type: 'dot', x: bu.tx, y: bu.ty, vx: 0, vy: 0, t: 0, dur: 0.15, color: '#ffffff', s: 5 });
        }
      }
      if (BL.shots <= 0 && BL.bullets.length === 0) {
        if (!BL.extraUsed && hand >= BLC.extra.cost) {                       // 3発撃ち終わり：MORE SHOTS?
          BL.phase = 'offer'; BL.offerT = 0;
          const nxt = BLC.payBands.slice().reverse().find((b) => b[0] > BL.score);
          setMessage(nxt ? 'あと' + (nxt[0] - BL.score) + 'てんで' + nxt[1] + '枚ライン！あと2発だけ撃つ？' : 'あと2発だけ撃つ？ (+1枚)', C.yellow);
        } else blFinish();
      }
    } else if (BL.phase === 'offer') {
      BL.offerT += dt;
      if (BL.offerT >= BLC.extra.offerTime) blFinish();
    } else if (BL.phase === 'result' && BL.t >= 3.1) { BL.phase = 'idle'; BL.banner = null; }
  }
  function blDraw() {
    mgFrame('#14041a', '#c83a7a', '#ffd84a');
    mgSign('BALLOON SHOOT', '#ffd84a', '#c83a7a');
    mgHud('SHOT', BL.phase === 'play' ? BL.shots : '-');
    const P = MG_PLAY;
    ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    rect(P.x, P.y, P.w, P.h, '#7ad0f8'); rect(P.x, P.y, P.w, 60, '#4aa8e8');
    for (let k = 0; k < 5; k++) { const cx = P.x + ((k * 52 + centerT * 4) % (220 + (W - 180))) - 30; rect(cx, 80 + (k % 3) * 40, 26, 6, '#ffffff'); rect(cx + 6, 76 + (k % 3) * 40, 16, 5, '#ffffff'); }
    rect(P.x, 236, P.w, 14, '#c88a4a');
    for (let k = 0; k < 13 + Math.ceil((W - 180) / 12); k++) { rect(P.x + k * 12, 232, 6, 6, k % 2 ? '#ff5a6a' : '#ffffff'); }       // 縁日の電飾
    for (const b of BL.balloons) {
      if (!b.alive) continue;
      const x = Math.round(b.x); const y = Math.round(b.y); const r = b.r;
      const img = ci('balloon_' + b.ty.id);
      if (img) ctx.drawImage(img, x - Math.round(img.naturalWidth / 2), y - 11);
      else for (let yy = -r; yy <= r; yy++) { const w = Math.round(Math.sqrt(r * r - yy * yy)); rect(x - w, y + yy, w * 2 + 1, 1, b.ty.color); }
      if (b.ty.id === 'star') { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(centerT * 5 + b.ph); drawStar(x + 5, y - 11, '#ffffff'); ctx.globalAlpha = 1; }
    }
    if (BL.phase === 'play') {                                    // 照準
      const c = blCross(BL.t);
      const x = Math.round(c.x); const y = Math.round(c.y);
      ctx.globalAlpha = 0.95;
      rect(x - 9, y, 6, 1, '#ff2a4a'); rect(x + 4, y, 6, 1, '#ff2a4a'); rect(x, y - 9, 1, 6, '#ff2a4a'); rect(x, y + 4, 1, 6, '#ff2a4a');
      for (let a = 0; a < 16; a++) { const an = (a / 16) * 6.283; rect(x + Math.cos(an) * 6, y + Math.sin(an) * 6, 1, 1, '#ff2a4a'); }
      ctx.globalAlpha = 1;
    }
    for (const bu of BL.bullets) { const k = bu.t / bu.dur; rect(bu.x + (bu.tx - bu.x) * k - 1, bu.y + (bu.ty - bu.y) * k - 1, 3, 3, '#ffffff'); }
    mgFxDraw(BL.fx);
    ctx.restore();
    mgBannerDraw(BL.banner, P.y + 60);
    mgStatsOverlay('balloon');
    if (BL.phase === 'idle') mgInsertBtn(BL.noMedalT, BLC.betCost);
    else if (BL.phase === 'offer') {
      ctx.globalAlpha = 0.85; rect(P.x, P.y + 56, P.w, 84, '#05030a'); ctx.globalAlpha = 1;
      drawTextCenter('SHOTS 0', blCx(), P.y + 62, '#ffffff', 2, '#2a0a1a');
      drawTextCenter('MORE SHOTS?', blCx(), P.y + 80, '#ffe070', 2, '#4a0a2a');
      drawTextCenter('+' + BLC.extra.shots + ' SHOTS / ' + BLC.extra.cost + ' MEDAL', blCx(), P.y + 100, '#9fe8ff', 1);
      drawTextCenter('SCORE ' + BL.score, blCx(), P.y + 116, '#ffffff', 1);
      mgBtn(BL_YES, 'MORE', 'go', 3, '+' + BLC.extra.shots + ' SHOTS');
      mgBtn(BL_NO, 'DONE', 'off', 3);
    } else mgBtn(BL_FIRE, 'FIRE!', BL.phase === 'play' && BL.shots > 0 ? 'hot' : 'off', 3);
    if (BL.phase === 'play') drawText('SCORE ' + BL.score, 18, 322, '#ffe070', 1);
    const d = mgDay('balloon');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['BEST SCORE ' + d.bestScore, '#ffe070'], ['BEST +' + d.bestWin, '#7dff8a'], ['GOLD ' + d.gold, '#fff08a']]);
  }
  mgRegister('balloonShoot', {
    reset() { BL.phase = 'idle'; BL.banner = null; BL.fx = []; BL.bullets = []; }, phase: () => BL.phase,
    enter() {
      if (!BL.balloons.length) for (let i = 0; i < blCount(); i++) { const b = {}; blSpawn(b, true); BL.balloons.push(b); }
      setMessage(hand < BLC.betCost ? 'メダルがないよ。席を立って貸出機へ行こう' : 'INSERTを押して、風船を撃とう！', hand < BLC.betCost ? C.pink : C.cyan);
    },
    update: blUpdate, draw: blDraw, hint: '狙いが重なる瞬間に FIRE!',
    pointer(e, p) {
      if (BL.phase === 'idle') { if (inRect(p, MG_INSERT)) blInsert(); }
      else if (BL.phase === 'play' && inRect(p, BL_FIRE)) blFire();
      else if (BL.phase === 'offer') { if (inRect(p, BL_YES)) blMore(); else if (inRect(p, BL_NO)) blFinish(); }
    },
    space() { if (BL.phase === 'idle') blInsert(); else blFire(); }
  });

