'use strict';
  // =====================================================================
  //  🌟 SUPER COSMO：12台目。大量のメダルを一度にBETして、大きな払い出しを狙う、ハイリスク・ハイリターンの大型機
  //   BET(5/10/20) → 第1抽選 → NEXTなら TAKE か CHALLENGE → BIG CHANCE → JACKPOT CHANCEなら TAKE か JACKPOT CHALLENGE → 最終抽選
  //   結果は先に内部で抽選して、ランプがその目に止まるように見せます（BET額で確率は変わりません）
  // =====================================================================
  const CSC = NGC.cosmo;
  let CS_C = { x: 90, y: 128, r: 54, ring: 72 };                // 円盤の中心／くじの半径／金属わくの半径（画面の主役）
  let CS_BET_BTN = (i) => ({ x: 14 + i * 52, y: 244, w: 46, h: 22 });
  let CS_START = { x: 38, y: 272, w: 104, h: 34 };
  let CS_TAKE = { x: 14, y: 244, w: 74, h: 62 };
  let CS_CHAL = { x: 92, y: 244, w: 74, h: 62 };
  const CS_WEDGES = {                                            // 盤面の見た目（8分割）。結果は内部抽選で決まり、ランプがその目に止まります
    1: ['lose', 'next', 'lose', 'ret', 'next', 'lose', 'next', 'next'],
    2: ['lose', 'x15', 'x1', 'jpc', 'x2', 'lose', 'x1', 'jpc'],
    3: ['lose', 'x2', 'jp', 'ret', 'x2', 'lose', 'jp', 'x2']
  };
  const CS_LABEL = { lose: 'LOSE', ret: 'RETURN', next: 'NEXT', x1: 'X1', x15: 'X1.5', x2: 'X2', jpc: 'CHANCE', jp: 'JACKPOT' };
  // LOSE＝暗い赤／NEXT＝金〜黄土／RETURN＝銀・白／X1＝橙／X1.5・X2＝黄金／CHANCE＝赤＋金文字／JACKPOT＝白金
  const CS_COLOR = { lose: '#6a0e18', ret: '#c8ced8', next: '#b8801a', x1: '#d4641e', x15: '#e8b82a', x2: '#ffd84a', jpc: '#e01a30', jp: '#fff4c0' };
  const CS_TEXT = { lose: ['#ffffff', '#1a0004'], ret: ['#14141c', '#ffffff'], next: ['#1a0e00', '#ffe9a0'], x1: ['#1a0600', '#ffd0a0'], x15: ['#2a1400', '#fff6c0'], x2: ['#2a1400', '#ffffff'], jpc: ['#ffe070', '#3a0008'], jp: ['#a00014', '#ffffff'] };       // [文字色, ふち色]
  const CS_STAGE_NAME = { 1: 'FIRST DRAW', 2: 'BIG CHANCE', 3: 'JACKPOT CHANCE' };
  const CS_STARS = (() => { const a = []; let v = 7; for (let i = 0; i < 54; i++) { v = (v * 73 + 41) % 997; const w = (v * 31 + i * 17) % 997; a.push([12 + (v % 156), 57 + (w % 144), i % 7 === 0 ? 2 : 1, i * 0.9]); } return a; })();
  const CS = { maxT: 0, phase: 'idle', t: 0, sel: CSC.bets[0], bet: 0, stage: 1, take: 0, pend: null, wedge: 0, from: 0, total: 8, T: 3, lamp: 0, tickAt: -1, banner: null, fx: [], noMedalT: 0, force: 0, glowT: 0, jackpot: false, shown: 0 };

  const csAmt = (mul) => Math[CSC.rounding || 'floor'](CS.bet * mul);
  function csPickWeighted(list) {
    let r = Math.random() * list.reduce((a, o) => a + o.w, 0);
    for (const o of list) { r -= o.w; if (r < 0) return o.id; }
    return list[list.length - 1].id;
  }
  function csRoll(stage) {                                       // 第N抽選の結果（BET額に関係なく、同じ確率）
    const dbg = CSC.debug;
    if (dbg.enabled && dbg.force && dbg.force[CS.force] !== undefined) return dbg.force[CS.force++];
    if (stage === 1) return csPickWeighted([{ id: 'lose', w: CSC.stage1.lose }, { id: 'ret', w: CSC.stage1.ret }, { id: 'next', w: CSC.stage1.next }]);
    return csPickWeighted(stage === 2 ? CSC.stage2 : CSC.final);
  }
  // 理論上の期待払い出し率（BET額に関係なく同じ。端数の切り捨ては含みません）
  function csTheory() {
    const sum = (a) => a.reduce((x, o) => x + o.w, 0);
    const s1 = CSC.stage1; const s1s = s1.lose + s1.ret + s1.next;
    const fin = CSC.final.reduce((a, o) => a + (o.w / sum(CSC.final)) * o.mul, 0);
    const calc = (mode) => {
      const pick = (take, ch) => (mode === 'take' ? take : mode === 'challenge' ? ch : Math.max(take, ch));
      const v3 = pick(CSC.take2, fin);
      const v2 = CSC.stage2.reduce((a, o) => a + (o.w / sum(CSC.stage2)) * (o.id === 'jpc' ? v3 : o.mul), 0);
      return (s1.ret / s1s) + (s1.next / s1s) * pick(CSC.take1, v2);
    };
    return { alwaysTake: +calc('take').toFixed(3), alwaysChallenge: +calc('challenge').toFixed(3), optimal: +calc('opt').toFixed(3), jackpotPerPlay: +((s1.next / s1s) * (CSC.stage2.find((o) => o.id === 'jpc').w / sum(CSC.stage2)) * (CSC.final.find((o) => o.id === 'jp').w / sum(CSC.final))).toFixed(4) };
  }
  function csSpin() {                                            // ランプが回り始める（結果は、ここで決める）
    const outcome = csRoll(CS.stage);
    const ids = CS_WEDGES[CS.stage]; const cands = [];
    ids.forEach((id, i) => { if (id === outcome) cands.push(i); });
    const wedge = cands.length ? cands[randInt(0, cands.length - 1)] : randInt(0, 7);
    CS.pend = { stage: CS.stage, outcome };
    CS.wedge = wedge; CS.from = Math.floor(CS.lamp) % 8;
    CS.total = 8 * (CS.stage === 3 ? 4 : 3) + ((wedge - CS.from + 8) % 8);
    CS.T = CS.stage === 3 ? 4.6 : 3.1;
    CS.phase = 'spin'; CS.t = 0; CS.tickAt = -1; CS.banner = null;
    setMessage(CS.stage === 3 ? 'JACKPOT CHANCE！どこに止まる……！？' : CS.stage === 2 ? 'BIG CHANCE！どこに止まる！？' : 'ランプが回る……どこに止まる！？', CS.stage === 3 ? C.yellow : C.cyan);
    beep(500, 0, 0.1, 0.04, 'square', 900);
    if (CS.stage >= 2) { beep(CS.stage === 3 ? 1568 : 1175, 0.05, 0.25, 0.05, 'triangle'); noise(0.12, 0.03); }       // 看板ランプが点く ガシャン
    writeSave();
  }
  function csStart() {
    if (CS.phase !== 'idle') return;
    if (hand < CS.sel) { CS.noMedalT = 1.8; setMessage('メダルが足りません。 BETを減らしてね', C.pink); beep(260, 0, 0.12, 0.05, 'square', 180); return; }
    CS.bet = CS.sel; CS.stage = 1; CS.jackpot = false;
    mgInsert('cosmo', CS.bet);
    csSpin();
  }
  function csFinish(pay, label) {                                // 払い出しを受け取って終了（0 ＝ LOSE）
    CS.phase = 'result'; CS.t = 0; CS.glowT = 0; CS.lastPay = pay;
    CS.jackpot = label === 'JACKPOT';
    mgSettle('cosmo', pay, (o) => { if (CS.jackpot) o.jackpots++; });
    if (CS.jackpot) {
      for (let k = 0; k < 6; k++) beep(k % 2 ? 880 : 660, k * 0.16, 0.15, 0.045, 'square', k % 2 ? 660 : 880);                              // ピー↑ポー↓（サイレン）
      [523, 659, 784, 1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => beep(f, 1.0 + i * 0.09, 0.2, 0.05, 'triangle'));                 // 上昇アルペジオ
      for (let k = 0; k < 14; k++) beep(rand(1800, 3000), 1.9 + k * 0.1, 0.04, 0.03);                                                         // コインのジャラジャラ
      mgCoinRain(CS.fx, 44, 2.6);
      CS.banner = { lines: [{ text: 'JACKPOT!!', scale: 4, color: '#ffe070' }, { text: 'WIN ' + pay, scale: 4, color: '#ffffff' }], t: 0, dur: 4.6 };
    } else if (pay > CS.bet) {
      [1047, 1319, 1568].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05)); mgCoinRain(CS.fx, Math.min(pay, 24), 1.0);
      CS.banner = { lines: [{ text: 'WIN ' + pay, scale: 4, color: '#ffe070' }, { text: '+' + (pay - CS.bet) + ' MEDALS', scale: 2, color: '#7dff8a' }], t: 0, dur: 2.6 };
    } else if (pay === CS.bet) {
      beep(660, 0, 0.1, 0.04);
      CS.banner = { lines: [{ text: 'RETURN', scale: 3, color: '#c8c8d8' }, { text: pay + ' MEDALS BACK', scale: 1, color: '#ffffff' }], t: 0, dur: 2.2 };
    } else {
      beep(200, 0, 0.3, 0.05, 'sawtooth', 90);
      CS.banner = { lines: [{ text: 'LOSE', scale: 4, color: '#ff6a7a' }, { text: '-' + CS.bet + ' MEDALS', scale: 1, color: '#ffffff' }], t: 0, dur: 2.2 };
    }
    setMessage(CS.jackpot ? 'JACKPOT！！ ' + pay + '枚ゲット！！' : pay > CS.bet ? pay + '枚ゲット！' : pay === CS.bet ? 'RETURN……±0 でした' : '残念…… LOSE', CS.jackpot ? C.goldLight : pay > 0 ? C.text : C.dim);
  }
  function csResolve() {                                         // ランプが止まったあとの処理
    const { stage, outcome } = CS.pend;
    CS.pend = null;
    if (stage === 1) {
      if (outcome === 'lose') return csFinish(0, 'LOSE');
      if (outcome === 'ret') return csFinish(CS.bet, 'RETURN');
      CS.take = csAmt(CSC.take1); CS.phase = 'decide';
      setMessage('NEXT！ TAKE ' + CS.take + 'で勝ち逃げ？それとも CHALLENGE！？', C.yellow); beep(880, 0, 0.1, 0.05); beep(1175, 0.1, 0.1, 0.05);
      writeSave(); return undefined;
    }
    if (stage === 2) {
      if (outcome === 'lose') return csFinish(0, 'LOSE');
      if (outcome === 'jpc') {
        CS.take = csAmt(CSC.take2); CS.phase = 'decide';
        setMessage('JACKPOT CHANCE！ TAKE ' + CS.take + 'か、 JACKPOT CHALLENGE！？', C.pink); [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle'));
        writeSave(); return undefined;
      }
      return csFinish(csAmt(outcome === 'x15' ? 1.5 : outcome === 'x2' ? 2 : 1), 'WIN');
    }
    if (outcome === 'lose') return csFinish(0, 'LOSE');
    if (outcome === 'ret') return csFinish(CS.bet, 'RETURN');
    if (outcome === 'jp') return csFinish(csAmt(CSC.final.find((o) => o.id === 'jp').mul), 'JACKPOT');
    return csFinish(csAmt(CSC.final.find((o) => o.id === outcome).mul), 'WIN');
  }
  function csTake() { if (CS.phase === 'decide') csFinish(CS.take, 'WIN'); }
  function csChallenge() { if (CS.phase === 'decide') { CS.stage++; csSpin(); } }

  function csUpdate(dt) {
    if (CS.noMedalT > 0) CS.noMedalT -= dt;
    if (CS.banner) { CS.banner.t += dt; if (CS.banner.t > CS.banner.dur) CS.banner = null; }
    mgFxStep(CS.fx, dt, 262);
    CS.t += dt; CS.glowT += dt;
    const maxOn = (CS.phase === 'idle' ? CS.sel : CS.bet) === 20;                  // MAX BET：外周ランプが一周点灯
    if (maxOn) CS.maxT += dt; else CS.maxT = 0;
    if (CS.phase === 'spin') {
      const u = Math.min(1, CS.t / CS.T);
      const e = CS.stage === 3 ? 1 - Math.pow(1 - u, 4) : 1 - Math.pow(1 - u, 3);        // だんだん ゆっくり。JACKPOT CHANCE は、最後に溜める
      CS.lamp = CS.from + CS.total * e;
      const step = Math.floor(CS.lamp);
      if (step !== CS.tickAt) { CS.tickAt = step; noise(0.015, 0.02); beep(1400 + (step % 8) * 60, 0, 0.02, 0.025, 'square'); }     // ｶﾗｶﾗ…
      if (u >= 1) { CS.lamp = CS.from + CS.total; CS.phase = 'stop'; CS.t = 0; noise(0.08, 0.05); beep(150, 0, 0.08, 0.07, 'square', 70); }
    } else if (CS.phase === 'stop') {
      if (CS.t >= (CS.stage === 3 ? 0.9 : 0.55)) csResolve();
    } else if (CS.phase === 'result') {
      if (CS.t >= (CS.jackpot ? 5.6 : 3.0)) { CS.phase = 'idle'; CS.banner = null; CS.bet = 0; CS.stage = 1; }
    }
  }
  const csJackNow = () => CS.jackpot && CS.phase === 'result';
  function csBulb(x, y, a, col) {
    ctx.globalAlpha = Math.max(0.1, Math.min(1, a));
    rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, col);
    if (a > 0.7) { ctx.globalAlpha = (a - 0.7) * 0.6; rect(Math.round(x) - 2, Math.round(y) - 2, 5, 5, col); }
    ctx.globalAlpha = 1;
  }
  function csLamp(x, y, w, h, text, scale, lit, col, dark, off) {      // 常設の大型ランプ看板。消灯でも文字が読める／点灯で赤・金・豆電球が大きく光る
    rect(x, y, w, h, off[0]); rect(x, y, w, 1, '#c8ced8'); rect(x, y + h - 1, w, 1, '#4a5268'); rect(x, y, 1, h, '#9aa3b8'); rect(x + w - 1, y, 1, h, '#4a5268');
    rect(x + 2, y + 2, 1, 1, '#c8a030'); rect(x + w - 3, y + 2, 1, 1, '#c8a030'); rect(x + 2, y + h - 3, 1, 1, '#c8a030'); rect(x + w - 3, y + h - 3, 1, 1, '#c8a030');
    const ty = y + (h - 5 * scale) / 2;
    if (lit) {
      const k = csJackNow() ? 0.65 + 0.35 * Math.sin(centerT * 8) : 0.85 + 0.15 * Math.sin(centerT * 3);
      ctx.globalAlpha = 0.75 * k; rect(x + 2, y + 2, w - 4, h - 4, col); ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.3 * k; rect(x - 2, y - 2, w + 4, 2, col); rect(x - 2, y + h, w + 4, 2, col); ctx.globalAlpha = 1;
      drawTextCenter(text, x + w / 2 + 0.5, ty, '#ffffff', scale, dark);
      for (const bx of [6, 12]) { csBulb(x + bx, y + h / 2, 0.7 + 0.3 * k, '#fff3a0'); csBulb(x + w - bx, y + h / 2, 0.7 + 0.3 * k, '#fff3a0'); }
    } else {
      drawTextCenter(text, x + w / 2 + 0.5, ty, off[1], scale);
      for (const bx of [6, 12]) { csBulb(x + bx, y + h / 2, 0.22, off[1]); csBulb(x + w - bx, y + h / 2, 0.22, off[1]); }
    }
  }
  function csDisc() {
    const { x, y, r, ring } = CS_C;
    const jack = csJackNow();
    const ids = CS_WEDGES[CS.stage]; const lampIdx = Math.floor(CS.lamp) % 8;
    const lit = CS.phase === 'spin' || CS.phase === 'stop' || CS.phase === 'decide' || CS.phase === 'result';
    const tint = CS.stage === 3 && CS.phase !== 'idle' ? ['#7a5a10', '#fff0a0'] : CS.stage === 2 && CS.phase !== 'idle' ? ['#7a1018', '#ff7a5a'] : ['#5a0a12', '#ffd040'];
    // 筐体の窓：安っぽい星空
    rect(12, 56, 156 + (W - 180), 148, '#070203');
    for (const [sx, sy, sz, ph] of CS_STARS) { ctx.globalAlpha = 0.45 + 0.4 * Math.sin(centerT * 1.2 + ph); rect(Math.round((sx * (156 + (W - 180))) / 156), sy, sz, sz, sz > 1 ? '#fff3b0' : '#c8903a'); }
    ctx.globalAlpha = 1;
    rect(20, 66, 9, 9, '#7a1a1a'); rect(22, 64, 5, 13, '#7a1a1a'); rect(17, 70, 19, 2, '#e0a040');                                   // 小さな惑星と輪
    rect(148 + (W - 180), 188, 7, 7, '#a02a1a'); rect(146 + (W - 180), 190, 11, 2, '#f0b050');
    // 金属のわく（光が当たったような濃淡）
    ctx.beginPath(); ctx.arc(x, y, ring, 0, Math.PI * 2); ctx.fillStyle = '#4a5268'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, ring - 2, 0, Math.PI * 2); ctx.fillStyle = '#9aa3b8'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, ring - 5, 0, Math.PI * 2); ctx.fillStyle = '#2a3048'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#e8eefc'; ctx.beginPath(); ctx.arc(x, y, ring - 1, 3.5, 4.7); ctx.stroke();                 // ハイライト
    ctx.strokeStyle = '#1a1e30'; ctx.beginPath(); ctx.arc(x, y, ring - 1, 0.4, 1.6); ctx.stroke();                                    // 影
    ctx.lineWidth = 2; ctx.strokeStyle = jack ? '#fff3a0' : '#c8a030'; ctx.beginPath(); ctx.arc(x, y, ring - 9, 0, Math.PI * 2); ctx.stroke();      // 金色の縁
    ctx.beginPath(); ctx.arc(x, y, ring - 11, 0, Math.PI * 2); ctx.fillStyle = '#0a0204'; ctx.fill();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; rect(Math.round(x + Math.cos(a) * (ring - 3.5)) - 1, Math.round(y + Math.sin(a) * (ring - 3.5)) - 1, 2, 2, '#e8eefc'); }   // ビス
    // 豆電球（外周32個）
    const N = 32; const maxOn = (CS.phase === 'idle' ? CS.sel : CS.bet) === 20;
    const sweep = Math.min(N, Math.floor((CS.maxT / 1.3) * N));
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const bx = x + Math.cos(a) * (ring - 15); const by = y + Math.sin(a) * (ring - 15);
      let b = 0.4 + 0.4 * Math.sin(centerT * (CS.phase === 'spin' ? 5 : 2) - i * 0.55);
      let col = tint[1];
      if (jack) { b = 0.55 + 0.45 * Math.sin(centerT * 8 + (i % 2) * Math.PI); col = i % 2 ? '#fff3a0' : '#ffffff'; }
      else if (maxOn) { if (i < sweep) { b = 1; col = '#ffd040'; if (i === sweep - 1) col = '#ffffff'; } else b = 0.18; if (sweep >= N) { b = 0.85 + 0.15 * Math.sin(centerT * 4 + i * 0.3); col = '#ffd040'; } }
      csBulb(bx, by, b, col);
    }
    // くじ（円盤）
    for (let i = 0; i < 8; i++) {
      const a0 = -Math.PI / 2 - Math.PI / 8 + (i * Math.PI) / 4; const a1 = a0 + Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a0, a1); ctx.closePath();
      ctx.fillStyle = CS_COLOR[ids[i]]; ctx.fill();
      if (i % 2) { ctx.globalAlpha = 0.1; ctx.fillStyle = '#000000'; ctx.fill(); ctx.globalAlpha = 1; }
      if (lit && i === lampIdx) { ctx.globalAlpha = 0.42 + 0.18 * Math.sin(centerT * 6); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 1; ctx.stroke();
      const am = (a0 + a1) / 2; const tx = CS_TEXT[ids[i]];
      drawTextCenter(CS_LABEL[ids[i]], Math.round(x + Math.cos(am) * r * 0.68) + 0.5, Math.round(y + Math.sin(am) * r * 0.68) - 2, tx[0], 1, tx[1]);
    }
    // 中央のハブ（金属のボス）
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fillStyle = '#c8a030'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fillStyle = '#1a0408'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = tint[1]; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
    drawTextCenter('SUPER', x + 0.5, y - 6, '#ffd040', 1); drawTextCenter('COSMO', x + 0.5, y + 1, '#ffffff', 1);
  }
  function csSideRails() {                                         // 筐体の左右の豆電球の柱
    const on = CS.phase !== 'idle';
    for (let k = 0; k < 14; k++) {
      const yy = 60 + k * 10.5;
      let b = 0.3 + 0.4 * Math.sin(centerT * 2.2 - k * 0.6) + (on ? 0.15 : 0);
      let col = CS.stage === 3 && on ? '#fff3a0' : '#ffd040';
      if (csJackNow()) { b = 0.55 + 0.45 * Math.sin(centerT * 8 + k * 0.8); col = '#ffffff'; }
      else if ((CS.phase === 'idle' ? CS.sel : CS.bet) === 20 && CS.maxT > 0) { b = Math.min(1, 0.25 + CS.maxT / 1.3 * 0.9); col = '#ffd040'; }
      csBulb(10, yy, b, col); csBulb(170 + (W - 180), yy, b, col);
    }
  }
  function csPanelBtn(r, label, scale, sub, mode) {                 // 円盤より目立たない、金属の操作パネルのボタン
    const pal = { gold: ['#b8861c', '#f0d070', '#5a3a08', '#fff8d8'], steel: ['#5a5a68', '#b0b4c2', '#22222c', '#ffffff'], sel: ['#e8b82a', '#fff4b0', '#7a4a08', '#2a1000'], off: ['#2a1418', '#3e2a2e', '#180a0c', '#7a5a5a'], hot: ['#a01826', '#e06070', '#4a0610', '#ffe0e0'] }[mode || 'steel'];
    rect(r.x, r.y, r.w, r.h, pal[0]); rect(r.x, r.y, r.w, 1, pal[1]); rect(r.x, r.y + r.h - 2, r.w, 2, pal[2]); rect(r.x, r.y, 1, r.h, pal[1]); rect(r.x + r.w - 1, r.y, 1, r.h, pal[2]);
    const hh = 5 * scale + (sub ? 8 : 0);
    drawTextCenter(label, r.x + r.w / 2 + 0.5, r.y + (r.h - hh) / 2, pal[3], scale);
    if (sub) drawTextCenter(sub, r.x + r.w / 2 + 0.5, r.y + (r.h - hh) / 2 + 5 * scale + 3, pal[3], 1);
  }
  function csDraw() {
    const dx = W - 180; const hx = Math.round(dx / 2);
    mgFrame('#0a0204', '#8a93a8', '#ffd040');
    const jack = csJackNow();
    const bet20 = (CS.phase === 'idle' ? CS.sel : CS.bet) === 20;
    // 看板（金属のプレートに金のふち）
    rect(18, 8, 144 + dx, 22, '#2a0c10'); rect(18, 8, 144 + dx, 1, '#e8eefc'); rect(18, 29, 144 + dx, 1, '#2a3048'); rect(18, 8, 1, 22, '#aab2c6'); rect(161 + dx, 8, 1, 22, '#2a3048');
    rect(21, 11, 138 + dx, 16, '#12040a'); rect(21, 11, 138 + dx, 1, '#c8a030'); rect(21, 26, 138 + dx, 1, '#c8a030');
    for (let i = 0; i < 17 + Math.round(dx / 8.1); i++) csBulb(24 + i * 8.1, 9.5, 0.5 + 0.4 * Math.sin(centerT * 2.5 - i * 0.5), '#ffd040');
    ctx.globalAlpha = 0.2 + 0.1 * Math.sin(centerT * 1.5); rect(23, 13, 134 + dx, 12, '#ffd040'); ctx.globalAlpha = 1;
    drawTextCenter('SUPER COSMO', 90 + hx, 15, '#fff0b0', 2, '#7a4a08');
    // MAX BET の看板（BET20のとき点灯）
    const mx = bet20; const mk = mx ? 0.8 + 0.2 * Math.sin(centerT * 4) : 0;
    rect(40 + hx, 32, 100, 9, '#1a0608'); rect(40 + hx, 32, 100, 1, '#8a93a8'); rect(40 + hx, 40, 100, 1, '#3a4258');
    if (mx) { ctx.globalAlpha = 0.8 * mk; rect(41 + hx, 33, 98, 7, '#e01a2c'); ctx.globalAlpha = 1; drawTextCenter('MAX BET 20 MEDAL', 90 + hx, 34, '#ffffff', 1, '#4a0008'); }
    else drawTextCenter('MAX BET 20 MEDAL', 90 + hx, 34, '#8a5a3a', 1);
    // 上：BIG CHANCE ／ 下：JACKPOT ×3（常設・通常は消灯、該当ステージで点灯）
    const act = CS.phase !== 'idle';
    csLamp(26 + hx, 43, 128, 13, 'BIG CHANCE', 2, act && CS.stage >= 2, '#e01a2c', '#5a0008', ['#220608', '#9a4a42']);
    csLamp(26 + hx, 205, 128, 13, 'JACKPOT X3', 2, act && CS.stage >= 3, '#f0a818', '#6a2a00', ['#1e1204', '#a88438']);
    csSideRails();
    csDisc();
    mgFxDraw(CS.fx);
    if (jack) { ctx.globalAlpha = 0.2 * Math.sin(Math.PI * Math.min(1, CS.glowT / 5)); rect(8, 8, W - 16, H - 16, '#ffe9a0'); ctx.globalAlpha = 1; }
    if (CS.banner && CS.phase === 'result') {                       // 結果は、円盤の中央に
      const b = CS.banner; const a = Math.min(1, b.t / 0.12, (b.dur - b.t) / 0.25);
      const hs = b.lines.map((l) => 5 * l.scale); const total = hs.reduce((x, y2) => x + y2, 0) + (b.lines.length - 1) * 4; const y0 = CS_C.y - total / 2;
      ctx.globalAlpha = Math.max(0, a) * 0.85; rect(16, y0 - 5, 148 + dx, total + 10, '#05030a'); rect(16, y0 - 5, 148 + dx, 1, '#ffd040'); rect(16, y0 + total + 4, 148 + dx, 1, '#ffd040');
      ctx.globalAlpha = Math.max(0, a); let yy = y0; b.lines.forEach((l, k) => { drawTextCenter(l.text, 90 + Math.round((W - 180) / 2), yy, l.color, l.scale, '#10081a'); yy += hs[k] + 4; }); ctx.globalAlpha = 1;
    }
    mgStatsOverlay('cosmo');
    // 操作パネル（円盤の下）：MEDAL / BET / WIN の小さな表示 ＋ ボタン
    rect(10, 221, 160 + dx, 106, '#1e0a0e'); rect(10, 221, 160 + dx, 1, '#8a93a8'); rect(10, 326, 160 + dx, 1, '#3a4258');
    const winv = CS.phase === 'decide' ? CS.take : CS.phase === 'result' ? CS.lastPay || 0 : 0;
    [['MEDAL', hand, '#ffd040', 14], ['BET', CS.bet || CS.sel, '#ff8a5a', 66 + hx], [CS.phase === 'decide' ? 'TAKE' : 'WIN', winv, '#fff0a0', 118 + dx]].forEach(([lb, v, col, bx]) => {
      rect(bx, 224, 48, 15, '#080204'); rect(bx, 224, 48, 1, '#6a5a4a'); drawText(lb, bx + 3, 226, '#c8a060', 1);
      drawText(String(v), bx + 45 - textWidth(String(v), 1), 233, col, 1);
    });
    if (CS.phase === 'idle') {
      CSC.bets.forEach((bv, i) => {
        const r = CS_BET_BTN(i); const afford = hand >= bv; const on = CS.sel === bv;
        csPanelBtn(r, String(bv), 2, '', !afford ? 'off' : on ? 'sel' : 'steel');
      });
      const ok = hand >= CS.sel;
      csPanelBtn(CS_START, CS.noMedalT > 0 || !ok ? 'NO MEDAL' : 'START', CS.noMedalT > 0 || !ok ? 1 : 2, ok && CS.noMedalT <= 0 ? 'BET ' + CS.sel : '', CS.noMedalT > 0 || !ok ? 'hot' : 'gold');
    } else if (CS.phase === 'decide') {
      csPanelBtn(CS_TAKE, 'TAKE', 2, String(CS.take) + ' MEDAL', 'steel');
      csPanelBtn(CS_CHAL, CS.stage === 2 ? 'JACKPOT' : 'CHALLENGE', CS.stage === 2 ? 1 : 1, CS.stage === 2 ? 'CHALLENGE!' : 'BIG CHANCE', 'gold');
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(centerT * 4); drawTextCenter('LOSE = 0 !', 90 + hx, 312, '#ff6a5a', 1); ctx.globalAlpha = 1;
    } else csPanelBtn(CS_START, 'WAIT...', 1, '', 'off');
    const d = mgDay('cosmo');
    mgStrip([['PLAY ' + d.plays, '#e8f0ff'], ['JACKPOT ' + d.jackpots, '#ff8ef0'], ['BEST +' + d.bestWin, '#ffe070']]);
  }
  mgRegister('superCosmo', {
    reset() { CS.phase = 'idle'; CS.banner = null; CS.fx = []; CS.pend = null; CS.bet = 0; CS.stage = 1; CS.jackpot = false; }, phase: () => CS.phase,
    enter() { if (!CSC.bets.includes(CS.sel) || hand < CS.sel) CS.sel = [...CSC.bets].reverse().find((b) => hand >= b) || CSC.bets[0]; setMessage(hand < CSC.bets[0] ? 'メダルが足りないよ。席を立って貸出機へ行こう' : 'BETを選んで START！ここぞというときの大型機', hand < CSC.bets[0] ? C.pink : C.cyan); },
    update: csUpdate, draw: csDraw, hint: 'BETを選んで START！',
    pointer(e, p) {
      if (CS.phase === 'idle') {
        CSC.bets.forEach((b, i) => { if (inRect(p, CS_BET_BTN(i)) && hand >= b) { CS.sel = b; beep(600 + i * 200, 0, 0.06, 0.05, 'square'); if (b === 20) setMessage('MAX BET 20！勝負だ！', C.yellow); } });
        if (inRect(p, CS_START)) csStart();
      } else if (CS.phase === 'decide') { if (inRect(p, CS_TAKE)) csTake(); else if (inRect(p, CS_CHAL)) csChallenge(); }
    },
    space() { if (CS.phase === 'idle') csStart(); }
  });
  GAME_TYPES.superCosmo.saveDaily = () => (CS.phase === 'idle' || CS.phase === 'result' ? {} : { phase: CS.phase, bet: CS.bet, stage: CS.stage, take: CS.take, pend: CS.pend, sel: CS.sel });
  GAME_TYPES.superCosmo.loadDaily = (d) => {                     // 閉じたときの途中経過を復元（BETしたメダルを無駄にしない）
    CS.phase = 'idle'; CS.banner = null; CS.fx = []; CS.pend = null; CS.jackpot = false;
    if (d && d.bet) {
      CS.bet = d.bet; CS.stage = d.stage || 1; CS.take = d.take || 0; CS.sel = d.sel || CS.sel;
      if (d.phase === 'decide') CS.phase = 'decide';
      else if (d.pend) { CS.pend = d.pend; csResolve(); }
    }
  };


  function mgRecLines() {
    const r = P_().records.mg;
    return [
      { text: '🚀 STAR　PLAY ' + r.star.plays + '　WIN ' + r.star.wins + '　最高STAR ' + r.star.bestStar + '　BEST +' + r.star.bestWin, cls: r.star.bestWin >= 5 ? 'gold' : '' },
      { text: '🐟 FISH　PLAY ' + r.fish.plays + '　CATCH ' + r.fish.catches + '　GOLDEN ' + r.fish.golden + '　BEST +' + r.fish.bestWin, cls: r.fish.golden > 0 ? 'gold' : '' },
      { text: '👻 GHOST　PLAY ' + r.ghost.plays + '　最高 ' + r.ghost.bestGhost + 'たい　BEST +' + r.ghost.bestWin, cls: r.ghost.bestWin >= 5 ? 'gold' : '' },
      { text: '🏴‍☠️ TREASURE　PLAY ' + r.pirate.plays + '　最高VALUE ' + r.pirate.bestValue + '　💎 ' + r.pirate.diamond + '　BEST +' + r.pirate.bestWin, cls: r.pirate.bestWin >= 10 ? 'gold' : '' },
      { text: '🚂 TRAIN　PLAY ' + r.train.plays + '　PERFECT ' + r.train.perfect + '　BEST +' + r.train.bestWin, cls: r.train.perfect > 0 ? 'gold' : '' },
      { text: '🌟 COSMO　PLAY ' + r.cosmo.plays + '　JACKPOT ' + r.cosmo.jackpots + '　最高WIN ' + r.cosmo.bestWin + '　累計BET ' + r.cosmo.bet + '　累計WIN ' + r.cosmo.paid, cls: r.cosmo.jackpots > 0 ? 'gold' : '' },
      { text: '🎈 BALLOON　PLAY ' + r.balloon.plays + '　最高SCORE ' + r.balloon.bestScore + '　GOLD ' + r.balloon.gold + '　BEST +' + r.balloon.bestWin, cls: r.balloon.bestWin >= 5 ? 'gold' : '' }
    ];
  }

