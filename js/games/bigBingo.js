'use strict';
  // =====================================================================
  //  🎱 BIG BINGO（ビッグビンゴ）：メダルフロア
  //   3枚のカード（3×3・中央FREE・1〜20から8数字）から1枚をえらび、メダルをBET。透明ドームから、1〜20のボールが 6球、1球ずつ でてくる。成立したライン数で、メダルを獲得
  //   ロジック（カード・抽選・ライン判定・配当）は 画面と完全に分けてある。結果は START の瞬間に すべて決まり、演出は それを 見せるだけ（フレームレートで 結果が かわらない）
  //   確率の補正なし・BETで確率は かわらない・DAYの補正なし・前回の結果の補正なし
  // =====================================================================
  const BGC = NGC.bingo;
  const BG_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];                // 横3・縦3・ななめ2＝8ライン
  function bgShuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }                     // Fisher-Yates
  function bgSample(n) { const a = []; for (let i = 1; i <= BGC.range; i++) a.push(i); return bgShuffle(a).slice(0, n); }                              // 1〜20から、重複なしで n個
  function bgMakeCard() { const nums = bgSample(8); const c = []; let k = 0; for (let i = 0; i < 9; i++) c.push(i === 4 ? 0 : nums[k++]); return c; }       // 中央（4）＝FREE（0）
  function bgHits(card, drawn) { return card.map((v, i) => i === 4 || drawn.indexOf(v) >= 0); }
  function bgLineCount(card, drawn) { const h = bgHits(card, drawn); return BG_LINES.filter((l) => l.every((i) => h[i])).length; }                      // 成立ライン数（独立した関数）
  function bgReach(card, drawn) {                                                                                       // リーチ：あと1マスで成立する ライン（まだ 出ていない 数字が、待ち）
    const h = bgHits(card, drawn); const out = []; for (const l of BG_LINES) { const miss = l.filter((i) => !h[i]); if (miss.length === 1) out.push({ line: l, num: card[miss[0]], cell: miss[0] }); } return out;
  }
  function bgPay(bet, lines) { const t = BGC.pay; return bet * t[Math.max(0, Math.min(lines, t.length - 1))]; }                                         // 配当＝BET × 倍率（6ライン以上でも、こわれない）
  function bgSim(n, bet) {                                                                                              // 画面なし・SEなしで n回あそんで、分布・平均払い出し・RTPを出す
    const cnt = new Array(9).fill(0); let pay = 0; let any = 0;
    for (let i = 0; i < n; i++) { const card = bgMakeCard(); const d = bgSample(BGC.balls); const l = bgLineCount(card, d); cnt[Math.min(l, 8)]++; pay += bgPay(bet, l); if (l > 0) any++; }
    return { n, bet, dist: cnt.map((v) => v / n), bingoRate: any / n, avgPay: pay / n, rtp: pay / (n * bet) };
  }
  // ---- DEV：ほしい結果になる 6球を、カードから 逆算（カードの8数字のうち どれを出すか を 全部ためす）----
  function bgForceDraw(card, want) {                                                                                   // want = { lines, lastBall, multiReach }
    const cells = [0, 1, 2, 3, 5, 6, 7, 8]; const cand = [];
    for (let mask = 0; mask < 256; mask++) { const s = []; for (let b = 0; b < 8; b++) if (mask & (1 << b)) s.push(card[cells[b]]); if (s.length > BGC.balls) continue; cand.push(s); }
    const others = bgShuffle([...Array(BGC.range).keys()].map((x) => x + 1).filter((x) => card.indexOf(x) < 0));
    const fill = (s) => { const d = s.slice(); let k = 0; while (d.length < BGC.balls) d.push(others[k++]); return d; };
    let pool = cand.filter((s) => { const l = bgLineCount(card, s); if (want.multiReach) return l === 0 && bgReach(card, s).length >= 2; return l === want.lines; });
    if (want.lastBall) pool = pool.filter((s) => s.some((x) => bgLineCount(card, s.filter((y) => y !== x)) < bgLineCount(card, s)));
    if (!pool.length) return null; const s = pool[Math.floor(Math.random() * pool.length)]; let d = fill(s);
    if (want.lastBall) { const x = s.find((x2) => bgLineCount(card, s.filter((y) => y !== x2)) < bgLineCount(card, s)); d = bgShuffle(d.filter((y) => y !== x)); d.push(x); } else d = bgShuffle(d);
    return d;
  }
  // ---- 状態 ----
  const BG = { phase: 'idle', t: 0, clock: 0, bet: 0, cards: [], sel: -1, draw: [], k: -1, sub: 'idle', st: 0, drawn: [], hist: [], spin: 0, balls: [], noMedalT: 0, banner: null, fx: [], bulb: 'idle', paid: false, result: null, lastReach: [], lines: 0, popT: 0, seen: false, sfxT: 0,
    dev: { bet: 0, speed: 1, skip: false, show: false, force: null, draw: null } };
  const BG_BALL_COL = ['#ff5a4a', '#ffd840', '#fff3d0', '#ff9a30', '#ffffff'];
  function bgMakeBalls() { BG.balls = []; for (let n = 1; n <= BGC.range; n++) BG.balls.push({ n, a: (n / BGC.range) * 6.2832, r: 8 + (n * 7) % 24, w: 1 + (n % 5) * 0.35, ph: n * 1.7, rx: ((n * 37) % 60) - 30, ry: 18 + ((n * 23) % 14), gone: false }); }
  function bgReset() { BG.phase = 'idle'; BG.sub = 'idle'; BG.k = -1; BG.sel = -1; BG.cards = []; BG.draw = []; BG.drawn = []; BG.hist = []; BG.banner = null; BG.fx = []; BG.bulb = 'idle'; BG.paid = false; BG.result = null; BG.lastReach = []; BG.lines = 0; BG.spin = 0; bgMakeBalls(); }
  // ---- 流れ ----
  function bgPickBet(bet) {                                                                                             // BET：メダルを消費して、3枚のカードを出す（二重BET防止：phase が idle のときだけ）
    if (BG.phase !== 'idle') return; if (hand < bet) { mgNoMedal(BG); return; }
    BG.phase = 'cards'; BG.bet = bet; mgInsert('bingo', bet); BG.cards = [bgMakeCard(), bgMakeCard(), bgMakeCard()]; BG.sel = -1; BG.t = 0; BG.paid = false; BG.drawn = []; BG.hist = []; BG.lines = 0; BG.lastReach = []; BG.result = null; bgMakeBalls();
    beep(1568, 0, 0.05, 0.06, 'triangle'); beep(2093, 0.05, 0.08, 0.05, 'triangle'); noise(0.04, 0.03); setMessage('3まいから カードを えらぼう！', C.cyan);
  }
  function bgSelect(i) { if (BG.phase !== 'cards') return; BG.sel = i; beep(1175, 0, 0.05, 0.05, 'square'); beep(1568, 0.04, 0.06, 0.04, 'square'); }
  function bgStart() {
    if (BG.phase !== 'cards' || BG.sel < 0) return; BG.phase = 'draw'; BG.t = 0; BG.card = BG.cards[BG.sel].slice();                                                                                                 // えらばなかったカードは きえる
    let d = BG.dev.draw; if (BG.dev.force) { const f = bgForceDraw(BG.card, BG.dev.force); if (f) d = f; BG.dev.force = null; }
    BG.draw = d && d.length === BGC.balls ? d.slice() : bgSample(BGC.balls);                                           // 6球は ここで すべて きまる（演出は これを 見せるだけ）
    BG.k = -1; BG.sub = 'start'; BG.st = 0; BG.drawn = []; BG.hist = []; BG.lines = 0; BG.lastReach = []; BG.bulb = 'draw'; BG.banner = null;
    beep(880, 0, 0.1, 0.06, 'square'); beep(1318, 0.08, 0.14, 0.06, 'square'); setMessage('ガラガラ… ボールが 出てくるよ！', C.cyan);
  }
  function bgNextBall() {
    BG.k++; if (BG.k >= BGC.balls) { bgFinish(); return; }
    const num = BG.draw[BG.k]; const nextDrawn = BG.drawn.concat([num]); const reachNow = bgReach(BG.card, nextDrawn); const last = BG.k === BGC.balls - 1; const reachBefore = bgReach(BG.card, BG.drawn);
    BG.sub = 'spin'; BG.st = 0; BG.curNum = num; BG.long = last || reachBefore.length > 0;                              // 最後の球や リーチ中は、ほんの少し 長くまわす
    BG.spinDur = (BG.long ? BGC.spinLong : BGC.spinNormal); BG.pending = { reachNow, lines: bgLineCount(BG.card, nextDrawn), prevLines: BG.lines, last };
    if (last) { BG.banner = { text: 'LAST BALL', t: 0, dur: 1.0, color: '#ffe070', scale: 3 }; beep(784, 0, 0.12, 0.05, 'triangle'); beep(1047, 0.1, 0.14, 0.05, 'triangle'); }
  }
  function bgSkip() {                                                                                                  // 演出をとばして、けっかだけ見る（6球は START のときに もう きまっている。払い出しは bgFinish が 1回だけ）
    if (BG.phase !== 'draw' || BG.paid) return;
    BG.drawn = BG.draw.slice(); BG.hist = BG.draw.slice(); BG.balls.forEach((b) => { if (BG.draw.indexOf(b.n) >= 0) b.gone = true; }); BG.lines = bgLineCount(BG.card, BG.drawn); BG.lastReach = []; BG.flashLines = bgLinesOf(BG.card, BG.drawn);
    BG.k = BGC.balls - 1; BG.banner = null; BG.popT = 0; beep(1320, 0, 0.05, 0.05, 'square'); bgFinish();
  }
  function bgFinish() {
    if (BG.paid) return; BG.paid = true; const lines = bgLineCount(BG.card, BG.drawn); const pay = bgPay(BG.bet, lines);
    mgSettle('bingo', pay);                                                                                             // 払い出しは 1回だけ（paid フラグ）
    BG.result = { lines, pay, mult: BGC.pay[Math.min(lines, BGC.pay.length - 1)], bet: BG.bet }; BG.phase = 'result'; BG.t = 0; BG.sub = 'result'; BG.bulb = lines >= 5 ? 'big' : lines > 0 ? 'bingo' : 'idle';
    if (pay > 0) { mgCoinRain(BG.fx, Math.min(pay, 40), 1.2 + Math.min(1.5, pay / 60)); const ticks = Math.min(26, 6 + Math.floor(pay / 4)); for (let i = 0; i < ticks; i++) { beep(2200 + (i % 4) * 160, i * 0.05, 0.03, 0.035, 'triangle'); if (i % 2 === 0) noise(0.02, 0.02); } }       // ジャラジャラ…（枚数ぶん 何十秒も またせない）
    if (lines >= 5) [784, 988, 1175, 1568, 1976, 2349, 3136, 2349, 3136].forEach((f, i) => beep(f, i * 0.09, 0.2, 0.07, 'triangle'));
    else if (lines >= 4) [784, 988, 1175, 1568, 1976].forEach((f, i) => beep(f, i * 0.08, 0.16, 0.06, 'triangle'));
    else if (lines >= 1) [988, 1319, 1568].forEach((f, i) => beep(f, i * 0.08, 0.14, 0.06, 'triangle')); else { beep(262, 0, 0.2, 0.05, 'sine'); beep(196, 0.12, 0.3, 0.05, 'sine'); }
    setMessage('', C.dim);                                                                                              // けっかは 画面の中に 出るので、下の ひとことは 出さない（ボタンと 重ならないように）
  }
  function bgUpdate(dt) {
    BG.clock += dt; BG.t += dt; if (BG.noMedalT > 0) BG.noMedalT -= dt; if (BG.banner) { BG.banner.t += dt; if (BG.banner.t > BG.banner.dur) BG.banner = null; } if (BG.popT > 0) BG.popT -= dt; mgFxStep(BG.fx, dt, 340);
    const sp = BG.dev.skip ? 8 : BG.dev.speed; const d = dt * sp;
    const target = BG.phase === 'draw' && BG.sub === 'spin' ? 1 : 0; BG.spin += (target - BG.spin) * Math.min(1, dt * 5);
    if (BG.phase !== 'draw') return;
    BG.st += d;
    if (BG.sub === 'start') { if (BG.st > BGC.startWait) bgNextBall(); }
    else if (BG.sub === 'spin') {
      BG.sfxT -= d; if (BG.sfxT <= 0) { BG.sfxT = 0.07; noise(0.04, 0.02); beep(120 + Math.random() * 120, 0, 0.05, 0.02, 'sawtooth'); }                                     // ガラガラガラ…
      if (BG.st >= BG.spinDur) { BG.sub = 'drop'; BG.st = 0; beep(262, 0, 0.1, 0.07, 'triangle'); beep(196, 0.07, 0.12, 0.06, 'triangle'); }                                            // コロン！
    } else if (BG.sub === 'drop') {
      if (BG.st >= BGC.drop) {
        BG.sub = 'reveal'; BG.st = 0; const num = BG.curNum; BG.drawn.push(num); BG.hist.push(num); const b = BG.balls.find((x) => x.n === num); if (b) b.gone = true;
        const hit = BG.card.indexOf(num) >= 0; const pe = BG.pending; const reachNow = pe.reachNow; const newLines = pe.lines - pe.prevLines; BG.lines = pe.lines; BG.revealDur = BGC.reveal; BG.hitCell = hit ? BG.card.indexOf(num) : -1;
        if (hit) { beep(1760, 0, 0.07, 0.07, 'sine'); beep(2349, 0.05, 0.08, 0.05, 'sine'); }                                                                                                       // ピン！
        if (newLines > 0) { BG.revealDur += 0.8; BG.bulb = 'bingo'; BG.flashLines = bgLinesOf(BG.card, BG.drawn); const txt = pe.last && newLines > 0 ? 'LAST BALL BINGO!' : newLines >= 2 ? 'DOUBLE BINGO!' : 'BINGO!'; BG.banner = { text: txt, t: 0, dur: 1.2, color: '#ffe070', scale: txt.length > 9 ? 2 : 3 }; BG.popT = 1.2; [988, 1319, 1568, 1976].forEach((f, i) => beep(f, 0.12 + i * 0.07, 0.12, 0.06, 'triangle')); }       // BINGO!
        else if (reachNow.length && !pe.last && !(BG.lastReachKey === reachNow.map((r) => r.num).sort().join(','))) { BG.revealDur += 0.5; BG.banner = { text: 'REACH!', t: 0, dur: 1.0, color: '#ff8a4a', scale: 3 }; [1319, 1760, 2093].forEach((f, i) => beep(f, 0.1 + i * 0.06, 0.08, 0.05, 'triangle')); }                                               // ピロリン！
        BG.lastReachKey = reachNow.map((r) => r.num).sort().join(','); BG.lastReach = reachNow;
      }
    } else if (BG.sub === 'reveal') { if (BG.st >= BG.revealDur) { BG.bulb = BG.lines > 0 ? 'bingo' : 'draw'; if (BG.k >= BGC.balls - 1) bgFinish(); else bgNextBall(); } }
  }
  function bgLinesOf(card, drawn) { const h = bgHits(card, drawn); return BG_LINES.filter((l) => l.every((i) => h[i])); }
  // ---- 描画 ----
  const bgCx = () => Math.round(W / 2);
  function bgBulbRing() {                                                                                               // 昔ながらの 丸い電球（あいだを なめらかに かがやかせる。ふつう＝ゆっくり／抽選中＝流れる／BINGO＝やわらかく かがやく／BIG BINGO＝ぜんぶ点灯）
    const mode = BG.bulb; const pts = []; for (let x = 12; x <= W - 12; x += 6) { pts.push([x, 49]); pts.push([x, 352]); } for (let y = 55; y <= 346; y += 6) { pts.push([10, y]); pts.push([W - 11, y]); }
    pts.forEach(([x, y], i) => {
      let a = 0.25; if (mode === 'idle') a = ((i + Math.floor(BG.clock * 1.6)) % 4 === 0) ? 1 : 0.3; else if (mode === 'draw') a = ((i + Math.floor(BG.clock * 7)) % 3 === 0) ? 1 : 0.3; else if (mode === 'bingo') a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(BG.clock * 5 + i * 0.6)); else a = 0.7 + 0.3 * Math.sin(BG.clock * 6 + i * 0.5);
      ctx.globalAlpha = a; rect(x - 1, y - 1, 3, 3, mode === 'big' ? (i % 2 ? '#ff5a4a' : '#ffe070') : '#fff0b0'); ctx.globalAlpha = 1;
    });
  }
  function bgBallSprite(x, y, r, n, col, showNum, numScale) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x + 1, y + 1, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#8a1018'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, 6.2832); ctx.fill();
    if (showNum && n) { ctx.fillStyle = '#fff3d0'; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, 6.2832); ctx.fill(); drawTextCenter(String(n), x + 0.5, y - 2.5 * (numScale || 1), '#8a1018', numScale || 1); }
  }
  function bgDome() {
    const cx = bgCx(); const cy = 92; const R = 40;
    ctx.fillStyle = '#2a0a10'; ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#5a1a20'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
    const rem = BG.balls.filter((b) => !b.gone); const spin = BG.spin; const t = BG.clock;
    rem.forEach((b, i) => {
      const row = Math.floor(i / 6); const rx = cx - 22 + (i % 6) * 9 + (row % 2) * 4; const ry = cy + 26 - row * 9; const a = b.a + t * b.w * 2.4; const ox = cx + Math.cos(a) * (b.r + 6) * 1.0 + Math.sin(t * 7 + b.ph) * 1.5; const oy = cy + Math.sin(a * 1.1 + b.ph) * (b.ry + 6) * 0.9;
      const x = rx * (1 - spin) + clamp(ox, cx - 32, cx + 32) * spin; const y = ry * (1 - spin) + clamp(oy, cy - 32, cy + 32) * spin; bgBallSprite(Math.round(x), Math.round(y), 5, b.n, BG_BALL_COL[b.n % 5], true, 1);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R - 5, 3.6, 4.6); ctx.stroke();                                    // ガラスの つや
    rect(cx - 46, cy + 38, 92, 6, '#ffd840'); rect(cx - 46, cy + 38, 92, 1, '#fff3d0'); rect(cx - 40, cy + 44, 80, 5, '#c8282a'); rect(cx - 7, cy + 49, 14, 10, '#8a1018');                             // 台座・出口
  }
  function bgNextBallView() {
    const cx = bgCx(); const y0 = 141; const yEnd = 166; drawTextCenter('NEXT BALL', cx, 143, '#ffe9a0', 1, '#3a0a10');
    rect(cx - 17, 153, 34, 26, '#3a0a10'); rect(cx - 17, 153, 34, 1, '#ffd840');
    if (BG.phase === 'draw' && BG.sub === 'drop') { const k = clamp(BG.st / BGC.drop, 0, 1); const e = k * k; bgBallSprite(cx, Math.round(138 + e * 28), Math.round(5 + e * 8), 0, '#ff5a4a', false); }
    else if (BG.phase === 'draw' && BG.sub === 'reveal' || (BG.phase === 'result' && BG.hist.length)) { const n = BG.hist[BG.hist.length - 1]; if (n) bgBallSprite(cx, 166, 13, n, '#c8282a', true, 3); }
    else bgBallSprite(cx, 166, 13, 0, '#6a1a20', false);
  }
  function bgHistory() {
    drawText('DRAW', 12, 186, '#ffe9a0', 1, '#3a0a10'); const x0 = 44;
    for (let i = 0; i < BGC.balls; i++) { const x = x0 + i * 24 + 8; const n = BG.hist[i]; const hit = n && BG.card && BG.card.indexOf(n) >= 0; if (n) bgBallSprite(x, 190, 8, n, hit ? '#ffd840' : '#c8c0b0', true, 1); else { ctx.strokeStyle = 'rgba(255,233,160,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, 190, 7, 0, 6.2832); ctx.stroke(); } }
    if (hit_dummy()) { /* noop */ }
  }
  const hit_dummy = () => false;
  function bgCard(card, x, y, cs, hitSet, opt) {                                                                         // 3×3 のカード。数字は、ドット文字を 大きく（1と7・6と8が はっきり 見える）
    opt = opt || {}; rect(x - 3, y - 3, cs * 3 + 6, cs * 3 + 6, opt.sel ? '#ffd840' : '#8a1018'); rect(x - 2, y - 2, cs * 3 + 4, cs * 3 + 4, '#c8282a');
    const reachCells = {}; (opt.reach || []).forEach((r) => r.line.forEach((c) => { if (!hitSet[c]) reachCells[c] = 1; })); const flash = {}; (opt.flash || []).forEach((l) => l.forEach((c) => { flash[c] = 1; }));
    for (let i = 0; i < 9; i++) {
      const cx2 = x + (i % 3) * cs; const cy2 = y + Math.floor(i / 3) * cs; const lit = hitSet[i]; const free = i === 4;
      rect(cx2, cy2, cs - 1, cs - 1, lit ? (flash[i] ? '#fff0a0' : '#ffd840') : '#fff3d0'); rect(cx2, cy2, cs - 1, 1, lit ? '#fffbd0' : '#ffffff'); rect(cx2, cy2 + cs - 2, cs - 1, 1, lit ? '#c89010' : '#d8c8a0');
      if (lit) { ctx.globalAlpha = 0.25 + 0.2 * Math.sin(BG.clock * 4 + i); rect(cx2 - 1, cy2 - 1, cs + 1, cs + 1, '#fff3a0'); ctx.globalAlpha = 1; }
      if (free) drawTextCenter('FREE', cx2 + (cs - 1) / 2 + 0.5, cy2 + Math.floor((cs - 6) / 2), '#8a1018', 1); else { const s = String(card[i]); const sc = cs >= 18 ? 2 : 1; drawTextCenter(s, cx2 + (cs - 1) / 2 + 0.5, cy2 + Math.floor((cs - 1 - 5 * sc) / 2), lit ? '#8a1018' : '#3a0a10', sc); }
      if (reachCells[i]) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(BG.clock * 5 + i); ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 2; ctx.strokeRect(cx2 + 1, cy2 + 1, cs - 3, cs - 3); ctx.globalAlpha = 1; }
    }
  }
  const bgBetRects = () => { const w = Math.floor((W - 24 - 12) / 3); return [1, 3, 5].map((b, i) => ({ bet: b, x: 12 + i * (w + 6), y: 222, w, h: 40 })); };
  const bgCardRects = () => { const cs = 18; const gap = Math.floor((W - 24 - cs * 9) / 2); return [0, 1, 2].map((i) => ({ i, x: 12 + i * (cs * 3 + gap), y: 200, w: cs * 3, h: cs * 3, cs })); };
  const bgStartRect = () => ({ x: 24, y: 270, w: W - 48, h: 34 });
  function bgDraw() {
    mgFrame('#2a0508', '#c8282a', '#ffd840'); const big = BG.bulb === 'big' && BG.phase === 'result'; mgSign('BIG BINGO', '#ffd840', big && Math.floor(BG.clock * 3) % 2 ? '#ffe070' : '#c8282a'); mgHud('BET', BG.phase === 'idle' ? '-' : BG.bet);
    const P = MG_PLAY; rect(P.x, 50, P.w, 304, '#4a0a10'); for (let y = 50; y < 354; y += 2) rect(P.x, y, P.w, 1, mixHex('#5a1018', '#3a0810', (y - 50) / 304)); rect(P.x, 50, P.w, 2, '#ffd840');
    bgDome(); bgBulbRing(); const cx = bgCx(); const ph = BG.phase;
    if (ph === 'idle') {
      bgNextBallView(); drawTextCenter('SELECT BET', cx, 200, '#ffe070', 2, '#3a0a10');
      for (const r of bgBetRects()) { const ok = hand >= r.bet; mgBtn(r, String(r.bet), ok ? 'on' : 'off', 3, 'BET'); if (!ok) { ctx.globalAlpha = 0.5; rect(r.x, r.y, r.w, r.h, '#1a0a10'); ctx.globalAlpha = 1; } }
      if (BG.noMedalT > 0) drawTextCenter('NO MEDAL', cx, 270, '#ff8aa0', 2, '#2a0a10');
      drawTextCenter('1 LINE x2   2 LINES x5', cx, 286, '#ffe9a0', 1, '#3a0a10'); drawTextCenter('3 LINES x10  4 LINES x20', cx, 296, '#ffe9a0', 1, '#3a0a10'); drawTextCenter('5 LINES x50', cx, 306, '#ffe070', 1, '#3a0a10');
    } else if (ph === 'cards') {
      bgNextBallView(); drawTextCenter('SELECT CARD', cx, 190 - 12, '#ffe070', 1, '#3a0a10'); drawText('BET ' + BG.bet, 12, 178, '#ffe9a0', 1, '#3a0a10');
      for (const r of bgCardRects()) { const sel = BG.sel === r.i; const hs = BG.cards[r.i].map((v, i) => i === 4); bgCard(BG.cards[r.i], r.x, r.y, r.cs, hs, { sel }); drawTextCenter('ABC'[r.i], r.x + r.w / 2 + 0.5, r.y + r.h + 6, sel ? '#ffe070' : '#c8b090', 1, '#3a0a10'); if (sel) { ctx.globalAlpha = 0.3 + 0.25 * Math.sin(BG.clock * 4); ctx.strokeStyle = '#ffe070'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); ctx.globalAlpha = 1; } }
      const sr = bgStartRect(); mgBtn(sr, 'START', BG.sel >= 0 ? 'go' : 'off', 3); if (BG.sel < 0) { ctx.globalAlpha = 0.5; rect(sr.x, sr.y, sr.w, sr.h, '#1a0a10'); ctx.globalAlpha = 1; }
    } else {
      bgNextBallView(); bgHistory(); const hs = bgHits(BG.card, BG.drawn); const cs = 22; const x = cx - 33; const y = 206;
      bgCard(BG.card, x, y, cs, hs, { reach: BG.lastReach, flash: BG.flashLines && BG.lines > 0 ? bgLinesOf(BG.card, BG.drawn) : [] });
      const rl = BG.lastReach; if (rl.length && ph === 'draw') { drawText('REACH', 12, 208, '#ff8a2a', 1, '#3a0a10'); const nums = [...new Set(rl.map((r) => r.num))]; nums.slice(0, 3).forEach((n, i) => drawText(String(n), 14, 218 + i * 12, '#ffe9a0', 2, '#3a0a10')); }
      drawText('BALL', cx + 40, 208, '#ffe9a0', 1, '#3a0a10'); drawText(Math.min(BGC.balls, Math.max(0, BG.hist.length)) + '/' + BGC.balls, cx + 40, 217, '#ffffff', 2, '#3a0a10'); drawText('LINE', cx + 40, 236, '#ffe9a0', 1, '#3a0a10'); drawText(String(BG.lines), cx + 40, 245, '#ffd840', 2, '#3a0a10');
      if (ph === 'draw') drawTextCenter('BET ' + BG.bet, cx, 282, '#ffe9a0', 1, '#3a0a10');
    }
    if (ph === 'result' && BG.result) {
      const R = BG.result; rect(P.x + 2, 274, P.w - 4, 74, '#2a0508'); rect(P.x + 2, 274, P.w - 4, 1, '#ffd840'); const names = ['NO BINGO', 'BINGO!', 'DOUBLE BINGO!', 'TRIPLE BINGO!', '4 LINES!', '* BIG BINGO! *']; const nm = names[Math.min(R.lines, 5)];
      drawTextCenter(nm, cx, 277, R.lines >= 5 ? '#ffe070' : R.lines > 0 ? '#ffd840' : '#a8a0b0', R.lines >= 3 ? 2 : 2, '#3a0a10'); if (R.lines > 0) drawTextCenter(R.lines + ' LINES   PAY x' + R.mult, cx, 293, '#ffffff', 1, '#3a0a10'); drawTextCenter('BET ' + R.bet, cx, 302, '#ffe9a0', 1, '#3a0a10');
      drawTextCenter('WIN ' + R.pay + ' MEDALS', cx, 311, R.pay > 0 ? '#ffe070' : '#a8a0b0', 1, '#3a0a10');
    }
    if (BG.banner) { const b = BG.banner; const a = Math.min(1, b.t / 0.1, (b.dur - b.t) / 0.25); ctx.globalAlpha = Math.max(0, a) * 0.85; rect(P.x, 124, P.w, 5 * b.scale + 10, '#2a0508'); ctx.globalAlpha = Math.max(0, a); drawTextCenter(b.text, cx, 129, b.color, b.scale, '#3a0a10'); ctx.globalAlpha = 1; }
    mgFxDraw(BG.fx); if (DEV_MODE && BG.dev.show) bgDevOverlay();
    const d = mgDay('bingo'); mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['BIG BINGO', '#ffd840'], ['BEST +' + d.bestWin, '#ffe070']]);
    bgUi();
  }
  function bgDevOverlay() {
    ctx.globalAlpha = 0.82; rect(12, 52, W - 24, 36, '#000000'); ctx.globalAlpha = 1; const cards = BG.phase === 'cards' ? BG.cards : (BG.card ? [BG.card] : []);
    drawText('DEV DRAW ' + (BG.draw.length ? BG.draw.join(',') : '(START前)'), 14, 54, '#00ff88', 1); cards.slice(0, 3).forEach((c, i) => drawText(c.map((v, k) => (k === 4 ? 'F' : v)).join(' '), 14, 62 + i * 8, '#ffff00', 1));
  }
  const BG_DOM = {};
  function bgBuildDom() {
    if (BG_DOM.skip) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); BG_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); };
    mk('bg-retry', 'もういちど', 'td-go', () => { if (BG.phase === 'result') { bgReset(); BG.phase = 'idle'; beep(880, 0, 0.05, 0.04, 'square'); setMessage('BETを えらんでね', C.cyan); } });
    mk('bg-out', 'フロアにもどる', 'hb-sub', () => { beep(520, 0, 0.05, 0.04, 'square'); standUp(); });
    mk('bg-skip', 'スキップ（けっかを見る）', 'hb-sub', () => { bgSkip(); });
  }
  function bgUi() {
    bgBuildDom(); const res = BG.phase === 'result' && scene === 'machine'; const drw = BG.phase === 'draw' && scene === 'machine';
    BG_DOM.retry.classList.toggle('is-show', res); BG_DOM.skip.classList.toggle('is-show', drw);
    crPlace(BG_DOM.retry, { x: 20, y: 322, w: W - 40, h: 24 }); crPlace(BG_DOM.skip, { x: 28, y: 300, w: W - 56, h: 24 });
  }
  function bgHide() { if (!BG_DOM.skip) return; BG_DOM.retry.classList.remove('is-show'); BG_DOM.out.classList.remove('is-show'); BG_DOM.skip.classList.remove('is-show'); }
  function openBgDev() {
    const again = (f) => () => { f(); setTimeout(openBgDev, 0); }; const pays = [1, 3, 5].map((b) => 'BET ' + b + ': ' + [0, 1, 2, 3, 4, 5].map((l) => bgPay(b, l)).join(' / ')).join('   ');
    showDialog({ title: 'BIG BINGO DEV', wide: true, lines: [{ text: 'phase ' + BG.phase + ' / BET ' + BG.bet + ' / MEDAL ' + hand + ' / 強制 ' + (BG.dev.force ? JSON.stringify(BG.dev.force) : (BG.dev.draw ? '指定 ' + BG.dev.draw.join(',') : 'なし')) + ' / 速度 ×' + BG.dev.speed + (BG.dev.skip ? ' / SKIP' : ''), cls: 'dim' }, { text: '配当（0〜5ライン）  ' + pays, cls: 'dim' }], buttons: [
      { label: 'MEDAL +100', onClick: again(() => { hand += 100; noteMedals(); writeSave(); }) },
      { label: 'BET 1 強制', onClick: again(() => { BG.dev.bet = 1; }) }, { label: 'BET 3 強制', onClick: again(() => { BG.dev.bet = 3; }) }, { label: 'BET 5 強制', onClick: again(() => { BG.dev.bet = 5; }) }, { label: 'BET 強制 なし', onClick: again(() => { BG.dev.bet = 0; }) },
      { label: 'カード再生成（カード選択中）', onClick: again(() => { if (BG.phase === 'cards') { BG.cards = [bgMakeCard(), bgMakeCard(), bgMakeCard()]; BG.sel = -1; } }) }, { label: 'カード・抽選予定6球 表示 ON/OFF', onClick: again(() => { BG.dev.show = !BG.dev.show; }) },
      { label: '任意の6数字を指定…', onClick: () => { setTimeout(() => { const s = window.prompt ? window.prompt('1〜20から6つ（カンマ区切り）', '1,5,9,12,16,20') : null; if (s) { const a = s.split(/[,\s]+/).map(Number).filter((x) => x >= 1 && x <= BGC.range); if (new Set(a).size === BGC.balls) BG.dev.draw = a; else toast('6つの ちがう数字を 入れてね'); } openBgDev(); }, 0); } }, { label: '指定を やめる', onClick: again(() => { BG.dev.draw = null; BG.dev.force = null; }) },
      { label: '0 ライン 強制', onClick: again(() => { BG.dev.force = { lines: 0 }; }) }, { label: '1 ライン 強制', onClick: again(() => { BG.dev.force = { lines: 1 }; }) }, { label: '2 ライン 強制', onClick: again(() => { BG.dev.force = { lines: 2 }; }) }, { label: '3 ライン 強制', onClick: again(() => { BG.dev.force = { lines: 3 }; }) }, { label: '4 ライン 強制', onClick: again(() => { BG.dev.force = { lines: 4 }; }) }, { label: '5 ライン 強制', onClick: again(() => { BG.dev.force = { lines: 5 }; }) },
      { label: '最終球で BINGO 強制', onClick: again(() => { BG.dev.force = { lines: 1, lastBall: true }; }) }, { label: '複数 REACH 強制', onClick: again(() => { BG.dev.force = { multiReach: true }; }) },
      { label: '抽選 ×2 / ×0.5', onClick: again(() => { BG.dev.speed = BG.dev.speed >= 2 ? 0.5 : BG.dev.speed * 2; }) }, { label: '演出 SKIP ON/OFF（DEVのみ）', onClick: again(() => { BG.dev.skip = !BG.dev.skip; }) },
      { label: '100,000回 シミュレーション（BET 1・3・5）', onClick: () => { setTimeout(() => { const rs = [1, 3, 5].map((b) => bgSim(100000, b)); const pc = (v) => (v * 100).toFixed(3) + '%'; showDialog({ title: '100,000回 × 3（ロジックのみ）', wide: true, lines: rs.map((r) => ({ text: 'BET ' + r.bet + '  0:' + pc(r.dist[0]) + ' 1:' + pc(r.dist[1]) + ' 2:' + pc(r.dist[2]) + ' 3:' + pc(r.dist[3]) + ' 4:' + pc(r.dist[4]) + ' 5:' + pc(r.dist[5]) + '  BINGO率 ' + pc(r.bingoRate) + '  平均払い出し ' + r.avgPay.toFixed(3) + '  RTP ' + pc(r.rtp), cls: '' })).concat([{ text: '理論値  0:66.64% 1:28.74% 2:4.06% 3:0.531% 4:0.031% 5:0.005%  BINGO率 33.36%  RTP 83.95%', cls: 'dim' }]), buttons: [{ label: 'OK', primary: true }] }); }, 0); } },
      { label: 'とじる', primary: true } ] });
  }
  mgRegister('bingo', {
    reset() { bgReset(); }, phase: () => (BG.phase === 'idle' || BG.phase === 'result' ? 'idle' : BG.phase),
    enter() { bgBuildDom(); bgReset(); BG.phase = 'idle'; setMessage(hand < 1 ? 'メダルがないよ。席を立って貸出機へ行こう' : 'BETを えらんでね', hand < 1 ? C.pink : C.cyan); if (!P_().bingoSeen) { P_().bingoSeen = true; writeSave(); setTimeout(() => showDialog({ title: '🎱 BIG BINGO', lines: ['3まいから カードを えらぼう！', '6このボールで ビンゴを ねらえ！', 'ラインが多いほど メダル大量GET！'], buttons: [{ label: 'OK', primary: true }] }), 300); } },
    update: bgUpdate, draw: bgDraw, hint: '3まいから カードを えらんで、 ビンゴを ねらおう！',
    pointer(e, p) {
      if (BG.phase === 'idle') { for (const r of bgBetRects()) if (inRect(p, r)) { bgPickBet(BG.dev.bet || r.bet); return; } }
      else if (BG.phase === 'cards') { for (const r of bgCardRects()) if (inRect(p, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 14 })) { bgSelect(r.i); return; } if (inRect(p, bgStartRect())) bgStart(); }
    }
  });
  GAME_TYPES.bingo.canLeave = () => BG.phase === 'idle' || BG.phase === 'result';

