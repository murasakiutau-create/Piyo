'use strict';
  // =====================================================================
  //  🥤🍦 休憩コーナー（DRINK 自販機・ICE CREAM 自販機）：1F
  //   「意味のない買い物」ができるだけの設備。買うと、演出と一言が出て、お金が減る。それだけ（ゲームへの効果は、一切なし。それが完成形）
  //   所持品・コレクション・RECORD・実績・バフ・DAYの進行・保存は、ありません（お金の増減が、既存の保存に反映されるだけ）
  //   商品は、データ（VM_MACHINES）。自販機のしくみは、1つ。商品を足すときは、データを1件足すだけ
  // =====================================================================
  const VM_MACHINES = [
    { id: 'drink_machine', title: 'DRINK', sfx: 'drink', look: 'drink', theme: { body: '#2a6ac8', body2: '#1a4a98', trim: '#ffd84a', bg: '#0c1a38', cell: '#12264a' }, products: [
      { id: 'cola', name: 'コーラ', dot: 'COLA', price: 100, type: 'drink', flavorText: ['シュワッ！', 'やっぱりこれ。'], art: { kind: 'can', c1: '#d8302a', c2: '#ffffff' } },
      { id: 'melon_soda', name: 'メロンソーダ', dot: 'MELON SODA', price: 100, type: 'drink', flavorText: ['あまくてシュワシュワ。', 'ゲーセンで飲むと、なんかおいしい。'], art: { kind: 'can', c1: '#3ac86a', c2: '#e8ffe8' } },
      { id: 'orange', name: 'オレンジ', dot: 'ORANGE', price: 100, type: 'drink', flavorText: ['すっきり。', 'ちょっと元気な味。'], art: { kind: 'can', c1: '#ff9a2a', c2: '#fff0c0' } },
      { id: 'tea', name: 'お茶', dot: 'TEA', price: 100, type: 'drink', flavorText: ['ほっ。', '落ち着く。'], art: { kind: 'bottle', c1: '#4a9a4a', c2: '#e8f0d0' } },
      { id: 'coffee', name: 'コーヒー', dot: 'COFFEE', price: 100, type: 'drink', flavorText: ['にがい。', 'でもなんか落ち着く。'], art: { kind: 'can', c1: '#6a4228', c2: '#e8d0a8' } },
      { id: 'milk_tea', name: 'ミルクティー', dot: 'MILK TEA', price: 100, type: 'drink', flavorText: ['あまい。', 'ちょっと休憩。'], art: { kind: 'bottle', c1: '#d8b08a', c2: '#ffffff' } }
    ] },
    { id: 'ice_machine', title: 'ICE CREAM', sfx: 'ice', look: 'ice', theme: { body: '#f2f2fa', body2: '#cdd6ec', trim: '#ff8ab8', bg: '#241a38', cell: '#34284e' }, products: [
      { id: 'vanilla_monaka', name: 'バニラモナカ', dot: 'VANILLA', price: 100, type: 'ice', flavorText: ['パリッ。', 'ひんやり。'], art: { kind: 'monaka', c1: '#fff4d8', c2: '#e8c890' } },
      { id: 'choco_bar', name: 'チョコバー', dot: 'CHOCO BAR', price: 100, type: 'ice', flavorText: ['パキッ。', 'チョコがうまい。'], art: { kind: 'bar', c1: '#6a3a22', c2: '#8a5a3a' } },
      { id: 'soda_bar', name: 'ソーダバー', dot: 'SODA BAR', price: 100, type: 'ice', flavorText: ['つめたっ！', 'さっぱり。'], art: { kind: 'bar', c1: '#5ac8ff', c2: '#bfeaff' } },
      { id: 'strawberry', name: 'いちごアイス', dot: 'STRAWBERRY', price: 100, type: 'ice', flavorText: ['あまい。', 'いちご味。'], art: { kind: 'cup', c1: '#ff8aa8', c2: '#ffd0dc' } },
      { id: 'cookie_sand', name: 'クッキーサンド', dot: 'COOKIE SAND', price: 100, type: 'ice', flavorText: ['サクッ。', 'ちょっとぜいたく。'], art: { kind: 'sandwich', c1: '#6a4a2a', c2: '#fff4e8' } },
      { id: 'choco_mint', name: 'チョコミント', dot: 'CHOCO MINT', price: 100, type: 'ice', flavorText: ['スースーする。', 'これはこれで好き。'], art: { kind: 'bar', c1: '#8affd0', c2: '#6a3a22' } }
    ] }
  ];
  const VM = { id: null, machine: null, phase: 'list', prod: null, t: 0, busy: false, last: 0, clunked: false, credit: 0, coinT: 9, dev: { skip: false } };                                     // credit＝コイン投入口に入れた金額（自販機の中）
  const VM_DRINK_RECT = { x: 8, y: 252, w: 34, h: 58 };                                                                // 1F の下のエリア（左はし）の、2台の場所
  const VM_ICE_RECT = { x: 44, y: 252, w: 34, h: 58 };
  const VM_BENCH_RECT = { x: 82, y: 280, w: 42, h: 30 };                                                                 // となりの ベンチ（かざりだけ。すわる機能などは、ない）
  const vmMachine = (id) => VM_MACHINES.find((m) => m.id === id);
  // ---- ドット絵の商品（缶・ペットボトル・カップ・アイスバー・モナカ・サンド）----
  function vmArt(art, cx, cy, size) {
    const u = size / 16; const R = (x, y, w, h, c) => rect(Math.round(cx - size / 2 + x * u), Math.round(cy - size / 2 + y * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)), c);
    const k = art.kind; const c1 = art.c1; const c2 = art.c2;
    if (k === 'can') { R(4, 1, 8, 14, c1); R(4, 1, 8, 1.4, '#dcdce6'); R(4, 13.6, 8, 1.4, '#9a9aae'); R(4, 6, 8, 4, c2); R(5, 7, 6, 2, c1); R(5, 2.5, 1.4, 10, mixHex(c1, '#ffffff', 0.5)); R(11, 2.5, 1, 10, mixHex(c1, '#000000', 0.3)); }
    else if (k === 'bottle') { R(6.5, 0.5, 3, 2, '#e8e8f0'); R(6, 2.5, 4, 2, mixHex(c1, '#ffffff', 0.4)); R(4, 4.5, 8, 10.5, c1); R(4, 7.5, 8, 4.5, c2); R(5, 8.5, 6, 2.5, c1); R(5, 5.5, 1.4, 8, mixHex(c1, '#ffffff', 0.5)); R(4, 14, 8, 1, mixHex(c1, '#000000', 0.3)); }
    else if (k === 'cup') { R(4, 1.5, 8, 6, c1); R(5, 0.5, 6, 2, c2); R(3, 6, 10, 1.4, '#ffffff'); R(4, 7.4, 8, 7.6, '#f4ecd8'); R(4, 9, 8, 1.2, c1); R(4, 12, 8, 1.2, c1); R(5, 2, 1.4, 3, mixHex(c1, '#ffffff', 0.55)); }
    else if (k === 'bar') { R(7, 10, 2, 5.5, '#e8c890'); R(4, 0.5, 8, 10.5, c1); R(4, 0.5, 8, 1.4, mixHex(c1, '#ffffff', 0.4)); R(4, 4, 8, 3, c2); R(10.4, 1.5, 1.2, 8, mixHex(c1, '#000000', 0.25)); R(5, 2, 1.2, 7, mixHex(c1, '#ffffff', 0.5)); }
    else if (k === 'monaka') { R(1.5, 3.5, 13, 9, c2); R(2.4, 4.4, 11.2, 7.2, mixHex(c2, '#ffffff', 0.35)); R(2.4, 6.5, 11.2, 3, c1); R(4, 5, 1, 1, c2); R(8, 5, 1, 1, c2); R(11, 5, 1, 1, c2); R(4, 10.2, 1, 1, c2); R(10, 10.2, 1, 1, c2); }
    else { R(2.5, 2.5, 11, 3.2, c1); R(2.5, 10.3, 11, 3.2, c1); R(2.5, 5.7, 11, 4.6, c2); R(4, 3.4, 1.1, 1.1, '#2a1a0a'); R(8, 3.4, 1.1, 1.1, '#2a1a0a'); R(11, 3.4, 1.1, 1.1, '#2a1a0a'); R(5.5, 11.2, 1.1, 1.1, '#2a1a0a'); R(9.5, 11.2, 1.1, 1.1, '#2a1a0a'); }
  }
  // ---- 1Fの 自販機（小さく、フロアのはしに。DRINK と ICE は、色も形も、ちがう）----
  function drawBench(r) {                                                                                               // オレンジの ベンチ（かざり）
    ctx.globalAlpha = 0.3; rect(r.x + 2, r.y + r.h - 2, r.w, 3, '#000000'); ctx.globalAlpha = 1;
    rect(r.x + 4, r.y + 14, 3, r.h - 16, '#4a3226'); rect(r.x + r.w - 7, r.y + 14, 3, r.h - 16, '#4a3226'); rect(r.x + 4, r.y + r.h - 5, 5, 3, '#2a1c14'); rect(r.x + r.w - 9, r.y + r.h - 5, 5, 3, '#2a1c14');    // あし
    rect(r.x, r.y + 12, r.w, 8, '#f08a2c'); rect(r.x, r.y + 12, r.w, 2, '#ffc070'); rect(r.x, r.y + 19, r.w, 1, '#a85a14');                                                                                // 座面
    rect(r.x + 1, r.y, r.w - 2, 9, '#e8782a'); rect(r.x + 1, r.y, r.w - 2, 2, '#ffb060'); for (let k = 1; k < 4; k++) rect(r.x + 1 + k * Math.floor((r.w - 2) / 4), r.y + 2, 1, 7, '#b85e18');                         // せもたれ
    rect(r.x + 1, r.y + 9, 3, 4, '#4a3226'); rect(r.x + r.w - 4, r.y + 9, 3, 4, '#4a3226');
  }
  function drawVendCab(m, r) {
    const th = m.theme; const t = animT(); const isIce = m.sfx === 'ice';
    ctx.globalAlpha = 0.16; rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, th.trim); ctx.globalAlpha = 1;
    rect(r.x, r.y, r.w, r.h, th.body); rect(r.x, r.y, r.w, 2, th.trim); rect(r.x, r.y, 2, r.h, mixHex(th.body, '#ffffff', 0.25)); rect(r.x + r.w - 2, r.y, 2, r.h, th.body2);
    rect(r.x + 2, r.y + 3, r.w - 4, 7, th.body2); drawTextCenter(isIce ? 'ICE' : 'DRINK', r.x + r.w / 2 + 0.5, r.y + 4, isIce ? '#d0508a' : '#ffffff', 1);
    const wy = r.y + 12; const wh = 22; rect(r.x + 3, wy, r.w - 11, wh, '#0a0a18'); rect(r.x + 3, wy, r.w - 11, 1, '#8a8aa8');
    const stp = (r.w - 11) / 3; m.products.forEach((p, i) => vmArt(p.art, Math.round(r.x + 3 + stp / 2 + (i % 3) * stp), wy + 6 + Math.floor(i / 3) * 10, 9));
    for (let i = 0; i < 3; i++) rect(r.x + r.w - 7, wy + 2 + i * 6, 4, 4, ((Math.floor(t * 0.7) + i) % 3 === 0) ? th.trim : '#34344a');                // ボタンのランプ（ゆっくり）
    rect(r.x + 3, wy + wh + 3, r.w - 6, 6, '#16162a'); rect(r.x + 5, wy + wh + 4, r.w - 10, 1, th.trim);                                              // 料金の表示
    rect(r.x + 4, r.y + r.h - 12, r.w - 8, 9, '#06060e'); rect(r.x + 4, r.y + r.h - 12, r.w - 8, 1, '#5a5a78'); ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 1.6); rect(r.x + 6, r.y + r.h - 9, r.w - 12, 4, th.trim); ctx.globalAlpha = 1;   // 取り出し口
  }
  // ---- 画面（商品えらび → 購入演出 → 結果）----
  const VM_DOM = {};
  function vmBuildDom() {
    if (VM_DOM.back) return;
    for (let i = 0; i < 6; i++) { const b = document.createElement('button'); b.className = 'vm-item'; b.type = 'button'; b.innerHTML = '<span class="vm-name"></span><span class="vm-price"></span>'; screenEl.appendChild(b); VM_DOM['i' + i] = b; b.addEventListener('click', () => { ensureAudio(); vmTapProduct(i); }); }
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); VM_DOM[id.slice(3)] = b; return b; };
    mk('vm-back', 'もどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); vmLeave(); });
    mk('vm-again', 'もう1つ買う', 'hb-go').addEventListener('click', () => { ensureAudio(); beep(880, 0, 0.05, 0.04, 'square'); VM.phase = 'list'; VM.busy = false; });
    mk('vm-out', '1Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); vmLeave(); });
    const say = document.createElement('div'); say.className = 'prize-info st-say vm-say'; screenEl.appendChild(say); VM_DOM.say = say;
    const cn = document.createElement('button'); cn.className = 'vm-item vm-take'; cn.type = 'button'; cn.setAttribute('aria-label', 'コイン投入口'); screenEl.appendChild(cn); VM_DOM.coin = cn; cn.addEventListener('click', () => { ensureAudio(); vmCoin(); });
    const tk = document.createElement('button'); tk.className = 'vm-item vm-take'; tk.type = 'button'; tk.setAttribute('aria-label', '取り出し口'); screenEl.appendChild(tk); VM_DOM.take = tk; tk.addEventListener('click', () => { ensureAudio(); vmTake(); });
  }
  const vmCell = (i) => { const x0 = 18; const cw = (W - 36) / 3; return { x: Math.round(x0 + (i % 3) * cw), y: 40 + Math.floor(i / 3) * 76, w: Math.round(cw) - 1, h: 73 }; };      // 自販機の窓の中：3列×2段。マスの全体が、タッチできる（見た目の丸ボタンより、ずっと広い）
  const vmLand = (m) => (m.look === 'ice' ? { x: Math.round(W / 2), y: 306 } : { x: Math.round(W / 2), y: 318 });                 // 取り出し口で、商品が止まる場所
  function enterVending(id) { moveFade(() => { VM.id = id; VM.machine = vmMachine(id); VM.phase = 'list'; VM.busy = false; VM.prod = null; VM.credit = 0; VM.coinT = 9; scene = 'vending'; updateSceneUi(); beep(660, 0, 0.05, 0.04, 'square'); beep(880, 0.05, 0.06, 0.04, 'square'); }); }
  function vmLeave() {                                                                                                  // 5Fにもどる。コインが のこっていたら、おつりとして かえってくる
    if (VM.busy && (VM.phase === 'dispense' || VM.phase === 'take' || VM.phase === 'taking')) return;
    if (VM.credit > 0) { const back = VM.credit; VM.credit = 0; P_().money += back; writeSave(); toast('おつり ¥' + back + ' が かえってきた'); beep(1319, 0, 0.05, 0.05, 'triangle'); beep(1568, 0.07, 0.06, 0.05, 'triangle'); }
    moveFade(() => { scene = 'b2'; VM.busy = false; updateSceneUi(); });
  }
  const VM_COIN = 100;                                                                                                  // コイン1枚の金額
  function vmCoin() {                                                                                                  // コイン投入口をタップ：¥100を、ここで消費して、自販機に入れる（なん枚でも）
    if (VM.phase !== 'list' || VM.busy || scene !== 'vending') return;
    if (P_().money < VM_COIN) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    P_().money -= VM_COIN; VM.credit += VM_COIN; writeSave(); VM.coinT = 0; beep(1976, 0, 0.04, 0.05, 'square'); beep(2637, 0.06, 0.07, 0.05, 'square'); beep(1568, 0.16, 0.05, 0.03, 'triangle');       // チャリン
  }
  function vmTapProduct(i) {                                                                                           // 商品のマスをタップ：コインが たりていれば、そのまま購入
    if (VM.phase !== 'list' || VM.busy || scene !== 'vending') return; const p = VM.machine.products[i]; if (!p) return;
    if (VM.credit < p.price) { VM.coinHint = 1.2; toast(VM.credit <= 0 ? 'コインを いれてね！' : 'あと ¥' + (p.price - VM.credit) + ' いれてね！'); beep(330, 0, 0.08, 0.04, 'square'); return; }
    VM.press = { i, t: 0 }; beep(1568, 0, 0.04, 0.04, 'square'); vmBuy(p);                                              // ボタンが、ピッと光って、沈む
  }
  function vmBuy(p) {                                                                                                  // 購入：コインの中から、値段ぶんが 使われる（連打しても、1回だけ）
    if (VM.busy || VM.phase !== 'list' || VM.credit < p.price) return;
    VM.busy = true; VM.credit -= p.price; VM.prod = p; VM.phase = 'dispense'; VM.t = 0; VM.last = performance.now(); VM.clunked = false; VM.pinged = false; VM.landed = false; VM.whir = -1; VM.press = { i: VM.machine.products.indexOf(p), t: 0 };
    if (VM.dev.skip) { VM.phase = 'done'; VM.t = 9; beep(110, 0, 0.12, 0.08, 'square'); }
  }
  function vmTake() {                                                                                                  // 取り出し口の商品を、とる（タップ）
    if (VM.phase !== 'take') return; VM.phase = 'taking'; VM.tk = 0; beep(1047, 0, 0.05, 0.05, 'triangle'); beep(1568, 0.05, 0.08, 0.05, 'triangle');
  }
  const vmTimes = (m) => (m.sfx === 'ice' ? { clunk: 1.4, fall: 0.55, end: 2.6 } : { clunk: 0.45, fall: 0.55, end: 1.8 });             // 購入演出の時間（DRINK：ピッ→ガコン！／ICE：ピッ→ウィーン……→ゴトン！）
  function vmDispenseSfx(t) {
    const m = VM.machine; const ice = m.sfx === 'ice'; const T = vmTimes(m);
    if (!VM.pinged) { VM.pinged = true; beep(1760, 0, 0.06, 0.05, 'square'); }
    if (ice && t > 0.3 && t < 1.3) { const n = Math.floor((t - 0.3) * 12); if (n !== VM.whir) { VM.whir = n; beep(180 + n * 22, 0, 0.1, 0.03, 'sawtooth'); } }
    if (!VM.clunked && t >= T.clunk) { VM.clunked = true; beep(ice ? 90 : 120, 0, 0.14, 0.09, 'square'); noise(0.1, 0.06); beep(ice ? 70 : 95, 0.08, 0.1, 0.07, 'square'); }
    if (!VM.landed && t >= T.clunk + T.fall) { VM.landed = true; beep(1175, 0, 0.05, 0.04, 'triangle'); beep(1568, 0.06, 0.08, 0.04, 'triangle'); }
  }
  // ---- 自販機の正面（画面いっぱい）：看板・商品見本・丸ボタン・コイン部分・取り出し口 ----
  const vmCircle = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill(); };
  function vmButton(cx, cy, on, ice) {                                                                                  // 商品見本の下の、丸い購入ボタン
    vmCircle(cx, cy + 1, 6.5, ice ? '#8a90a8' : '#0a1a50'); vmCircle(cx, cy, 6, ice ? '#e8ecf6' : '#d8e4ff'); vmCircle(cx, on ? cy + 1 : cy, on ? 4.4 : 4, on ? '#ffd84a' : (ice ? '#9aa4c0' : '#5a7ad8'));
    if (on) { ctx.globalAlpha = 0.45; vmCircle(cx, cy, 9, '#ffd84a'); ctx.globalAlpha = 1; }
  }
  function vmFrontCommon(m, ice) {
    const x0 = 8; const x1 = W - 8; const th = m.theme;
    const body = ice ? '#f2f4fa' : '#1b46b8'; const edgeL = ice ? '#ffffff' : '#3a6ae0'; const edgeR = ice ? '#c4cce0' : '#0f2f80';
    rect(x0, 8, x1 - x0, 340, body); rect(x0, 8, 3, 340, edgeL); rect(x1 - 3, 8, 3, 340, edgeR); rect(x0, 8, x1 - x0, 2, edgeL);                           // 筐体（左右の外枠）
    if (ice) { rect(x0 + 3, 8, 2, 340, '#ff8a9a'); rect(x1 - 5, 8, 2, 340, '#ff8a9a'); }
    rect(14, 12, W - 28, 22, ice ? '#ffffff' : '#f4f8ff'); rect(14, 12, W - 28, 1, ice ? '#e0e4f0' : '#9ab8ff'); rect(14, 33, W - 28, 1, ice ? '#e0e4f0' : '#9ab8ff');       // 上の看板
    drawTextCenter(m.title, W / 2, 16, ice ? '#e8303a' : '#1b46b8', 2, ice ? '#ffd0d8' : '#c8d8ff');
    for (const sx of [22, W - 22]) kcBitsDraw(ctx, ice ? 'heart' : 'sparkle', sx, 23, 8);
    rect(16, 38, W - 32, 154, ice ? '#ffffff' : '#eaf6ff');                                                                                             // 商品を見せる窓（光っている）
    rect(16, 38, W - 32, 2, ice ? '#e4e8f4' : '#b8d8f0'); rect(16, 190, W - 32, 2, ice ? '#d0d6e8' : '#9ab8d8');
    if (!ice) { ctx.globalAlpha = 0.18; rect(16, 40, W - 32, 30, '#ffffff'); ctx.globalAlpha = 1; }
  }
  function vmFrontCells(m, ice) {
    m.products.forEach((p, i) => {
      const c = vmCell(i); const cx = c.x + c.w / 2; const sel = VM.press && VM.press.i === i && (VM.phase === 'dispense' || VM.press.t < 0.4 || VM.phase === 'list');
      if (ice) { const card = mixHex(p.art.c1, '#ffffff', 0.78); rect(c.x + 1, c.y + 1, c.w - 2, c.h - 2, card); rect(c.x + 1, c.y + 1, c.w - 2, 3, mixHex(p.art.c1, '#ffffff', 0.35)); rect(c.x + 1, c.y + c.h - 1, c.w - 2, 1, '#d8dcea'); }
      else { rect(c.x + 2, c.y + c.h - 2, c.w - 4, 2, '#c8d8e8'); if (i < 3) rect(c.x, c.y + c.h, c.w, 2, '#a8c0d8'); }
      vmArt(p.art, cx, c.y + 22, 34);
      drawTextCenter(p.dot, cx + 0.5, c.y + 41, ice ? '#3a2a44' : '#12306a', 1); drawTextCenter(p.price + 'YEN', cx + 0.5, c.y + 49, '#d02030', 1);       // 名前と値段（ドット文字）
      vmButton(cx, c.y + c.h - 9, !!sel, ice);
      if (VM.credit < p.price && VM.phase === 'list') { ctx.globalAlpha = 0.45; rect(c.x + 1, c.y + 1, c.w - 2, c.h - 2, ice ? '#ffffff' : '#c8dcf0'); ctx.globalAlpha = 1; }
      if (sel) { rect(c.x + 1, c.y + 1, c.w - 2, 1, '#ffd84a'); rect(c.x + 1, c.y + c.h - 2, c.w - 2, 1, '#ffd84a'); rect(c.x + 1, c.y + 1, 1, c.h - 2, '#ffd84a'); rect(c.x + c.w - 2, c.y + 1, 1, c.h - 2, '#ffd84a'); }
    });
  }
  function vmFrontLower(m, ice, glow) {
    const th = m.theme;
    // 中ほど：広告（左）とコイン部分（右）
    const px = 16; const pw = W - 100; rect(px, 196, pw, 62, ice ? '#7ac8ff' : '#ffffff');
    if (ice) { rect(px, 196, pw, 28, '#9ad8ff'); rect(px, 224, pw, 34, '#4cb85a'); rect(px, 224, pw, 3, '#7ee08a'); for (let k = 0; k < 6; k++) vmArt(m.products[k].art, px + 12 + k * ((pw - 24) / 5), 226, 14); drawTextCenter('NEW COSMO ICE', px + pw / 2, 200, '#ffffff', 1, '#3a8ab8'); }
    else { for (let y = 0; y < 38; y++) rect(px + 1, 197 + y, pw - 2, 1, mixHex('#6ab8ff', '#dff0ff', y / 38)); rect(px + 1, 235, pw - 2, 22, '#4cb85a'); rect(px + 8, 222, 22, 13, '#7a9ac8'); rect(px + 20, 216, 28, 19, '#9ab0d8'); rect(px + pw - 36, 224, 26, 11, '#8aa8d0'); drawTextCenter('NEW COSMO', px + pw / 2, 202, '#1b46b8', 1, '#ffffff'); drawTextCenter('WATER', px + pw / 2, 244, '#ffffff', 1, '#2a6a3a'); }
    const cx0 = W - 80; rect(cx0, 196, 64, 62, ice ? '#dfe4f2' : '#173a98'); rect(cx0, 196, 64, 1, ice ? '#ffffff' : '#3a6ae0');
    rect(cx0 + 4, 200, 56, 14, '#0a0a14'); if (VM.credit > 0) drawText('YEN ' + VM.credit, cx0 + 7, 204, '#ff5a3a', 1); else if (Math.floor(animT() * 1.6) % 2 === 0) drawText('INSERT COIN', cx0 + 7, 204, '#ff5a3a', 1);       // 入れたコイン（なければ INSERT COIN）
    const hint = VM.credit <= 0 && VM.phase === 'list'; if (hint || VM.coinHint > 0) { ctx.globalAlpha = 0.45 + 0.35 * Math.sin(animT() * 6); rect(cx0 + 3, 218, 26, 20, '#ffd84a'); ctx.globalAlpha = 1; }
    rect(cx0 + 6, 220, 22, 16, '#0a0a14'); rect(cx0 + 10, 227, 14, 2, ice ? '#c8d0e8' : '#8aa8e8'); drawText('COIN', cx0 + 6, 238, ice ? '#6a7090' : '#cfe0ff', 1);       // コイン投入口
    if (VM.coinT < 0.3) { const f = VM.coinT / 0.3; vmCircle(cx0 + 17, Math.round(204 + f * 24), 4, '#ffd84a'); vmCircle(cx0 + 17, Math.round(204 + f * 24), 2, '#fff3a0'); }       // コインが、投入口へ
    vmCircle(cx0 + 44, 232, 8, ice ? '#a8aec8' : '#0a1a50'); vmCircle(cx0 + 44, 232, 6.5, '#ffd84a'); rect(cx0 + 42, 224, 4, 8, ice ? '#a8aec8' : '#0a1a50');                // レバー
    rect(cx0 + 36, 245, 22, 9, '#f0b020'); rect(cx0 + 38, 247, 18, 4, '#7a5a10');                                                                         // おつり口
    // 下：取り出し口
    if (ice) {
      rect(20, 266, W - 40, 72, '#e4e8f4'); vmCircle(W / 2, 304, 33, '#8a90a8'); vmCircle(W / 2, 304, 30, '#2a2e3c'); vmCircle(W / 2, 304, 26, '#07080f');
      if (glow > 0) { ctx.globalAlpha = 0.5 * glow; vmCircle(W / 2, 304, 26, '#bfe8ff'); ctx.globalAlpha = 1; }
      drawTextCenter('TAKE OUT', W / 2, 266, '#8a90a8', 1);
    } else {
      rect(20, 266, W - 40, 72, '#0a1c58'); rect(20, 266, W - 40, 2, '#8aa0d8'); rect(22, 268, W - 44, 68, '#14307c');
      rect(26, 270 + Math.round(glow * 3), W - 52, 12, '#3a5ab8'); rect(26, 270 + Math.round(glow * 3), W - 52, 1, '#8aa8f0'); drawTextCenter('TAKE OUT', W / 2, 273 + Math.round(glow * 3), '#ffffff', 1, '#0a1c58');
      rect(26, 286, W - 52, 46, '#05060e'); if (glow > 0) { ctx.globalAlpha = 0.35 * glow; rect(26, 286, W - 52, 46, '#9ab8ff'); ctx.globalAlpha = 1; }
    }
    for (let x = 28; x < W - 28; x += 4) rect(x, 340, 2, 6, ice ? '#c4cce0' : '#0f2f80');                                                                           // 下の通気口
  }
  function vmDrawResult() {                                                                                            // 商品をとったあとの画面：商品・名前・値段・一言（大きな画面）
    const m = VM.machine; const th = m.theme; const p = VM.prod; const ice = m.look === 'ice';
    drawFrame(); rect(8, 8, W - 16, H - 16, th.bg); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex(th.bg, '#000000', (y - 8) / (H - 16) * 0.35));
    rect(12, 12, W - 24, 24, th.body); rect(12, 12, W - 24, 2, th.trim); drawTextCenter(m.title, W / 2, 18, ice ? '#d0508a' : '#ffffff', 2, th.body2);
    rect(W / 2 - 52, 56, 104, 104, th.cell); rect(W / 2 - 52, 56, 104, 2, th.trim); rect(W / 2 - 52, 158, 104, 2, th.trim); vmArt(p.art, W / 2, 108, 80);
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(animT() * 3); for (let i = 0; i < 5; i++) kcBitsDraw(ctx, 'sparkle', W / 2 + Math.cos(animT() * 0.8 + i * 1.26) * 62, 108 + Math.sin(animT() * 0.8 + i * 1.26) * 52, 5); ctx.globalAlpha = 1;
  }
  function drawVending() {
    const m = VM.machine; if (!m) return; const ice = m.look === 'ice'; const now = performance.now(); const dt = Math.min(0.05, (now - VM.last) / 1000); VM.last = now;
    VM.coinT += dt; if (VM.coinHint > 0) VM.coinHint -= dt;
    if (VM.press) { VM.press.t += dt; if (VM.phase === 'list' && VM.press.t > 1.2 && !dialogIsOpen()) VM.press = null; }
    const T = vmTimes(m); let glow = 0; const land = vmLand(m);
    if (VM.phase === 'dispense') { VM.t += dt; vmDispenseSfx(VM.t); if (VM.t >= T.clunk + T.fall) glow = 1; if (VM.t >= T.end) { VM.phase = 'take'; VM.takeT = 0; } }
    else if (VM.phase === 'take') { VM.takeT += dt; glow = 0.7 + 0.3 * Math.sin(animT() * 5); if (VM.takeT > 3.2) vmTake(); }                  // 商品が、取り出し口に出ている。タップで取る（3秒たったら、自動で取る）
    else if (VM.phase === 'taking') { VM.tk += dt; glow = clamp(1 - VM.tk / 0.5, 0, 1); if (VM.tk >= 0.5) VM.phase = 'done'; }
    if (VM.phase === 'done') { vmDrawResult(); vmUi(); return; }
    drawFrame(); rect(8, 8, W - 16, H - 16, '#0a0a18');
    vmFrontCommon(m, ice); vmFrontCells(m, ice); vmFrontLower(m, ice, glow);
    const sel = m.products.indexOf(VM.prod);
    if (VM.phase === 'dispense' && sel >= 0 && VM.t >= T.clunk) {                                                       // 商品は、取り出し口の中だけに あらわれて、そこで、ころんと落ちる（ほかでは、見えない）
      const f = clamp((VM.t - T.clunk) / T.fall, 0, 1); const oy = Math.round(land.y - 26 + (26) * f * f + (f >= 1 ? 0 : 0)); const bounce = f >= 1 ? 0 : 0;
      ctx.save(); ctx.beginPath(); if (ice) ctx.arc(W / 2, 304, 26, 0, 6.2832); else ctx.rect(26, 286, W - 52, 46); ctx.clip(); vmArt(VM.prod.art, land.x, oy + bounce, 26); ctx.restore();
    } else if (VM.phase === 'take' && VM.prod) {
      vmArt(VM.prod.art, land.x, land.y, 26);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(animT() * 6); drawTextCenter('TAP TO TAKE', W / 2, ice ? 262 : 252, '#ffd84a', 1, '#000000'); ctx.globalAlpha = 1;
    } else if (VM.phase === 'taking' && VM.prod) {                                                                      // 取り出し口から、商品が、すっと消える
      const f = clamp(VM.tk / 0.5, 0, 1); ctx.globalAlpha = 1 - f; vmArt(VM.prod.art, land.x, Math.round(land.y - f * 14), 26); ctx.globalAlpha = 1;
      ctx.globalAlpha = (1 - f) * 0.8; for (let i = 0; i < 4; i++) kcBitsDraw(ctx, 'sparkle', land.x + (i - 1.5) * 12, land.y - 10 - f * 14 - (i % 2) * 6, 5); ctx.globalAlpha = 1;
    }
    vmUi();
  }
  const dialogIsOpen = () => { const d = document.getElementById('dialog'); return !!(d && !d.classList.contains('hidden') && d.offsetParent !== null); };
  function vmUi() {
    vmBuildDom(); const m = VM.machine; const ph = VM.phase; const ice = m.look === 'ice'; const show = (k, on) => VM_DOM[k].classList.toggle('is-show', !!on);
    m.products.forEach((p, i) => { const b = VM_DOM['i' + i]; b.classList.toggle('is-show', ph === 'list'); crPlace(b, vmCell(i)); });                      // 商品の名前・値段は、自販機の絵の中（ドットフォント）。ボタンは、タッチの領域だけ
    show('coin', ph === 'list'); crPlace(VM_DOM.coin, { x: W - 80 + 2, y: 214, w: 32, h: 28 });                                  // コイン投入口（広めに、タッチできる）
    show('take', ph === 'take'); crPlace(VM_DOM.take, ice ? { x: Math.round(W / 2) - 38, y: 266, w: 76, h: 76 } : { x: 20, y: 266, w: W - 40, h: 74 });
    show('back', ph === 'list'); show('again', ph === 'done'); show('out', ph === 'done');
    crPlace(VM_DOM.back, { x: 12, y: 354, w: 56, h: 18 }); VM_DOM.back.style.fontSize = Math.max(9, parseFloat(VM_DOM.back.style.fontSize) * 0.8) + 'px';       // 「もどる」は、小さく（自販機より、目立たせない）
    crPlace(VM_DOM.again, { x: 20, y: 292, w: W - 40, h: 32 }); crPlace(VM_DOM.out, { x: 20, y: 332, w: W - 40, h: 28 });
    const say = VM_DOM.say; say.classList.toggle('is-show', ph === 'done');
    if (ph === 'done') { const h = '<div class="vm-got">' + VM.prod.name + '　¥' + VM.prod.price + '</div>' + VM.prod.flavorText.map((l) => '<div class="vm-line">' + l + '</div>').join(''); if (say.dataset.k !== VM.prod.id + '|' + VM.prod.price) { say.dataset.k = VM.prod.id + '|' + VM.prod.price; say.innerHTML = h; } crPlace(say, { x: 10, y: 166, w: W - 20, h: 110 }); }
    else say.dataset.k = '';
  }
  function vmHide() { if (!VM_DOM.back) return; Object.keys(VM_DOM).forEach((k) => VM_DOM[k].classList.remove('is-show')); }
  function openVmDev() {                                                                                              // DEV：お金・全商品の購入テスト・お金不足・SE・演出スキップ・価格
    const again = (f) => () => { f(); setTimeout(openVmDev, 0); };
    const prices = VM_MACHINES.map((m) => m.title + '：' + m.products.map((p) => '¥' + p.price).join(' ')).join(' / ');
    showDialog({ title: 'VENDING DEV', wide: true, lines: [{ text: prices, cls: 'dim' }, { text: 'MONEY ¥' + P_().money + ' / 演出スキップ ' + (VM.dev.skip ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '全商品 購入テスト', onClick: () => { const before = P_().money; let sum = 0; VM_MACHINES.forEach((m) => m.products.forEach((p) => { if (P_().money >= p.price) { P_().money -= p.price; sum += p.price; } })); writeSave(); toast('全12商品 ¥' + sum + ' ぶん（¥' + before + ' → ¥' + P_().money + '）'); } },
      { label: 'MONEY不足テスト（¥50にする）', onClick: () => { P_().money = 50; writeSave(); toast('MONEY ¥50'); } },
      { label: 'DRINK SE テスト', onClick: () => { beep(1760, 0, 0.06, 0.05, 'square'); beep(120, 0.7, 0.14, 0.09, 'square'); noise(0.1, 0.06); } },
      { label: 'ICE SE テスト', onClick: () => { beep(1760, 0, 0.06, 0.05, 'square'); for (let i = 0; i < 12; i++) beep(180 + i * 22, 0.5 + i * 0.08, 0.1, 0.03, 'sawtooth'); beep(90, 1.55, 0.14, 0.09, 'square'); noise(0.1, 0.06); } },
      { label: '購入演出スキップ ON/OFF', onClick: again(() => { VM.dev.skip = !VM.dev.skip; }) },
      { label: 'とじる', primary: true } ] });
  }

  // =====================================================================
  //  🎟️ STICKER GACHA（ガチャガチャ）と シール帳
  //   1回¥100（MONEY）。NEW COSMOのゲームの図柄が、33種類（全部 同じ確率）。ダブりあり。集めたシールは、RECORD → シール帳（ページをめくる本）で見られる
  //   何の効果もない、ただの収集。レアリティ・天井・10連・交換・報酬は、なし。シールの定義は、データ（STK）。ふやすときは、1件足すだけ
  // =====================================================================
  const STK_CATS = [{ id: 'happy_beat', label: 'HAPPY BEAT', color: '#ff7ac0' }, { id: 'train', label: 'STOP! TRAIN', color: '#ffb04a' }, { id: 'balloon', label: 'BALLOON SHOOT', color: '#ff6a6a', tab: false }, { id: 'slot', label: 'LUCKY SLOT', color: '#ffd84a', tab: false }, { id: 'treasure', label: 'TREASURE', color: '#3ac86a' }, { id: 'driver', label: 'TOP DRIVER', color: '#5a8aff' }];
  const STK_SRC = { happy_beat: 'HAPPY BEAT', train: 'STOP! TRAIN', balloon: 'BALLOON SHOOT', slot: 'LUCKY SLOT', treasure: 'PIRATE TREASURE', driver: 'TOP DRIVER' };
  const STK_IMG = {};
  const stkImg = (src) => { if (!STK_IMG[src]) { const im = new Image(); im.src = src; STK_IMG[src] = im; } return STK_IMG[src]; };
  const mkStk = (id, category, name, art, bg) => ({ id, category, name, art, bg, weight: 1 });
  const STK = [
    mkStk('happy_pink_01', 'happy_beat', 'ピンクパンダ①', { img: 'assets/happybeat/pinkpanda1.webp' }, '#ffd8ec'), mkStk('happy_pink_02', 'happy_beat', 'ピンクパンダ②', { img: 'assets/happybeat/pinkpanda2.webp' }, '#ffd8ec'), mkStk('happy_pink_03', 'happy_beat', 'ピンクパンダ③', { img: 'assets/happybeat/pinkpanda3.webp' }, '#ffd8ec'),
    mkStk('happy_blue_01', 'happy_beat', 'ブルーパンダ①', { img: 'assets/happybeat/bluepanda1.webp' }, '#d4ecff'), mkStk('happy_blue_02', 'happy_beat', 'ブルーパンダ②', { img: 'assets/happybeat/bluepanda2.webp' }, '#d4ecff'), mkStk('happy_blue_03', 'happy_beat', 'ブルーパンダ③', { img: 'assets/happybeat/bluepanda3.webp' }, '#d4ecff'),
    mkStk('happy_duo', 'happy_beat', 'ピンク＆ブルーパンダ', { imgs: ['assets/happybeat/pinkpanda2.webp', 'assets/happybeat/bluepanda2.webp'] }, '#e8dcff'),
    mkStk('train_loco', 'train', '汽車', { img: 'assets/cosmo/train.webp' }, '#fff0c8'),
    mkStk('balloon_red', 'balloon', '赤風船', { img: 'assets/cosmo/balloon_red.webp' }, '#ffe0e0'), mkStk('balloon_silver', 'balloon', '銀風船', { img: 'assets/cosmo/balloon_silver.webp' }, '#e4eaf4'), mkStk('balloon_star', 'balloon', 'スター風船', { img: 'assets/cosmo/balloon_star.webp' }, '#fff4c0'),
    mkStk('slot_cherry', 'slot', 'チェリー', { slot: 0 }, '#ffe4e4'), mkStk('slot_bell', 'slot', 'ベル', { slot: 2 }, '#fff4cc'), mkStk('slot_seven', 'slot', '7', { slot: 5 }, '#ffdcdc'),
    ...[['red', '赤い'], ['brown', '茶色い'], ['gold', '金の'], ['silver', '銀の'], ['blue', '青い'], ['black', '黒い']].map(([k, n]) => mkStk('chest_' + k + '_closed', 'treasure', n + '宝箱・CLOSED', { img: 'assets/cosmo/chest_' + k + '_close.webp' }, '#d8f4ea')),
    ...[['red', '赤い'], ['brown', '茶色い'], ['gold', '金の'], ['silver', '銀の'], ['blue', '青い'], ['black', '黒い']].map(([k, n]) => mkStk('chest_' + k + '_open', 'treasure', n + '宝箱・OPEN', { img: 'assets/cosmo/chest_' + k + '_open.webp' }, '#e4f8d8')),
    ...[['diamond', 'ダイヤ'], ['ruby', 'ルビー'], ['sapphire', 'サファイア'], ['emerald', 'エメラルド'], ['coin', 'コイン'], ['stone', '石']].map(([k, n]) => mkStk('gem_' + k, 'treasure', n, { img: 'assets/cosmo/gem_' + k + '.webp' }, '#ece4ff')),
    mkStk('driver_car', 'driver', '車', { car: true }, '#dce8ff')
  ];
  STK.forEach((st) => { if (st.art.img) stkImg(st.art.img); (st.art.imgs || []).forEach(stkImg); });
  const stkById = (id) => STK.find((x) => x.id === id);
  const stkTotal = () => STK.length;
  const stkOwned = () => STK.filter((x) => (P_().stickers[x.id] || {}).count > 0).length;
  let STK_CAR = null;
  function stkCar() {                                                                                                  // TOP DRIVER の車（ゲームの車と同じ形）を、小さな絵にする
    if (STK_CAR) return STK_CAR; const c = document.createElement('canvas'); c.width = 30; c.height = 16; const g = c.getContext('2d'); const col = '#ff3a5a'; const R = (x, y, w, h, cc) => { g.fillStyle = cc; g.fillRect(x, y, w, h); };
    R(0, 11, 5, 5, '#16161e'); R(25, 11, 5, 5, '#16161e'); R(1, 5, 28, 8, col); R(1, 5, 28, 2, mixHex(col, '#ffffff', 0.35)); R(0, 12, 30, 2, mixHex(col, '#000000', 0.45)); R(6, 0, 18, 7, mixHex(col, '#000000', 0.15)); R(8, 1, 14, 5, '#243a5a'); R(8, 1, 14, 1, '#4a6a9a');
    R(2, 8, 5, 3, '#ff3a3a'); R(23, 8, 5, 3, '#ff3a3a'); R(12, 10, 6, 3, '#f0f0f0'); STK_CAR = c; return c;
  }
  function stkArt(a, cx, cy, box) {                                                                                    // シールの絵：ドット絵のまま（ぼかさない）
    ctx.save(); ctx.imageSmoothingEnabled = false; const fit = (w, h, mx) => { const k = Math.min(mx / w, mx / h); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; };
    if (a.slot !== undefined) { const c = SL_SPR[a.slot].big; const [w, h] = fit(36, 36, box * 0.78); ctx.drawImage(c, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h); }
    else if (a.car) { const c = stkCar(); const [w, h] = fit(30, 16, box * 0.84); ctx.drawImage(c, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h); }
    else if (a.imgs) { const ims = a.imgs.map(stkImg); if (ims.every((im) => im.complete && im.naturalWidth)) { const mh = box * 0.74; const sc = mh / ims[0].naturalHeight; const w = Math.round(ims[0].naturalWidth * sc); const h = Math.round(ims[0].naturalHeight * sc); ctx.drawImage(ims[0], Math.round(cx - w + w * 0.18), Math.round(cy - h / 2), w, h); ctx.drawImage(ims[1], Math.round(cx - w * 0.18), Math.round(cy - h / 2), w, h); } }
    else { const im = stkImg(a.img); if (im.complete && im.naturalWidth) { const [w, h] = fit(im.naturalWidth, im.naturalHeight, box * 0.78); ctx.drawImage(im, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h); } }
    ctx.restore();
  }
  function stkDraw(st, cx, cy, size, count) {                                                                          // シール1枚：白いふち＋うすい色の台紙＋絵
    const s = Math.round(size); const x = Math.round(cx - s / 2); const y = Math.round(cy - s / 2); const e = s >= 70 ? 3 : 2;
    ctx.globalAlpha = 0.3; rect(x + 1, y + 2, s, s, '#000000'); ctx.globalAlpha = 1;
    rect(x + 1, y, s - 2, s, '#ffffff'); rect(x, y + 1, s, s - 2, '#ffffff');
    rect(x + e + 1, y + e, s - 2 * e - 2, s - 2 * e, st.bg); rect(x + e, y + e + 1, s - 2 * e, s - 2 * e - 2, st.bg);
    ctx.globalAlpha = 0.35; rect(x + e + 1, y + e + 1, Math.round(s * 0.3), 2, '#ffffff'); rect(x + e + 1, y + e + 1, 2, Math.round(s * 0.3), '#ffffff'); ctx.globalAlpha = 1;
    stkArt(st.art, x + s / 2, y + s / 2, s - 2 * e);
    if (count > 1) { const t = 'x' + count; const w = t.length * 4 + 3; rect(x + s - w - 1, y + s - 9, w + 1, 9, '#d02030'); rect(x + s - w, y + s - 8, w - 1, 7, '#ff4a5a'); drawText(t, x + s - w + 1, y + s - 7, '#ffffff', 1); }
  }
  function stkEmpty(cx, cy, size) {                                                                                    // まだ もっていない枠：うすい枠と「？」（絵は見せない）
    const s = Math.round(size); const x = Math.round(cx - s / 2); const y = Math.round(cy - s / 2);
    rect(x + 1, y, s - 2, s, '#efe6d2'); rect(x, y + 1, s, s - 2, '#efe6d2'); for (let k = 0; k < s; k += 4) { rect(x + k, y, 2, 1, '#cbb996'); rect(x + k, y + s - 1, 2, 1, '#cbb996'); rect(x, y + k, 1, 2, '#cbb996'); rect(x + s - 1, y + k, 1, 2, '#cbb996'); }
    drawTextCenter('?', cx + 0.5, cy - 3, '#cbb996', 2);
  }
  // ---- ガチャの 抽選・保存 ----
  const GC_PRICE = 100;
  const GC_COLORS = ['#ff4a4a', '#4a8cff', '#ffd84a', '#4acb6a', '#a56aff', '#ff7ab8'];
  const GCH = { phase: 'ready', t: 0, st: null, isNew: false, count: 0, color: '#ff4a4a', busy: false, last: 0, clunked: false, complete: false, tick: -1, dev: { skip: false }, force: null };
  function gcPick() { const total = STK.reduce((a, x) => a + x.weight, 0); let r = Math.random() * total; for (const x of STK) { if (r < x.weight) return x; r -= x.weight; } return STK[STK.length - 1]; }
  function gcGrant(st) {                                                                                               // シールを1枚ふやす（所持数・はじめて入手したDAY）。お金と同じ処理の中で、保存する
    const rec = P_().stickers[st.id] || (P_().stickers[st.id] = { count: 0, firstGetDay: P_().day }); const isNew = rec.count === 0; if (isNew) rec.firstGetDay = P_().day; rec.count++;
    const done = stkOwned() >= stkTotal() && !P_().stickerMeta.completed; if (done) P_().stickerMeta.completed = true; return { isNew, count: rec.count, complete: done };
  }
  function gcCoin() {                                                                                                  // コイン投入口をタップ：¥100を消費して、中身を決めて、すぐ保存（そのあとの演出は、結果を見せるだけ）
    if (GCH.busy || (GCH.phase !== 'ready' && GCH.phase !== 'result')) return;
    if (P_().money < GC_PRICE) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    GCH.busy = true; P_().money -= GC_PRICE; const st = (GCH.force && stkById(GCH.force)) || gcPick(); GCH.force = null; const r = gcGrant(st); writeSave();
    GCH.st = st; GCH.isNew = r.isNew; GCH.count = r.count; GCH.complete = r.complete; GCH.color = GC_COLORS[Math.floor(Math.random() * GC_COLORS.length)]; GCH.phase = 'coin'; GCH.t = 0; GCH.rot = 0; GCH.clunked = false; GCH.tick = -1; GCH.last = performance.now();
    beep(1976, 0, 0.04, 0.05, 'square'); beep(2637, 0.06, 0.07, 0.05, 'square'); beep(1568, 0.16, 0.05, 0.03, 'triangle');    // チャリン
    if (GCH.dev.skip) { GCH.phase = 'result'; GCH.t = 0; GCH.busy = false; }
  }
  const gcSpin = gcCoin;
  function gcTurn() {                                                                                                  // ハンドルをタップ：1回めで半周、2回めでもう半周（そのあと、カプセルが出る）
    if (GCH.phase === 'coin') { GCH.phase = 'turn1'; GCH.t = 0; GCH.tick = -1; beep(240, 0, 0.09, 0.06, 'square'); }
    else if (GCH.phase === 'half') { GCH.phase = 'turn2'; GCH.t = 0; GCH.tick = -1; beep(300, 0, 0.09, 0.06, 'square'); }
  }
  function gcOpen() { if (GCH.phase !== 'drop') return; GCH.phase = 'open'; GCH.t = 0; beep(784, 0, 0.05, 0.06, 'square'); beep(1568, 0.05, 0.08, 0.06, 'triangle'); noise(0.05, 0.04); }
  // ---- 画面：ガチャ筐体の正面 ----
  const GC_DOM = {};
  function gcBuildDom() {
    if (GC_DOM.coin) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); GC_DOM[id.slice(3)] = b; return b; };
    const mkTouch = (key, label, fn) => { const b = document.createElement('button'); b.className = 'vm-item vm-take'; b.type = 'button'; b.setAttribute('aria-label', label); screenEl.appendChild(b); GC_DOM[key] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); };
    mkTouch('coin', 'コイン投入口', () => gcCoin()); mkTouch('knob', 'ハンドル', () => gcTurn());
    mk('gc-back', 'もどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); gcLeave(); });
    mk('gc-again', 'もう1回　¥' + GC_PRICE, 'td-go').addEventListener('click', () => { ensureAudio(); gcCoin(); });
    mk('gc-book', 'シール帳を見る', 'hb-sub').addEventListener('click', () => { ensureAudio(); if (GCH.busy) return; openStickerBook(); });
    mk('gc-out', 'もどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); gcLeave(); });
    const pop = document.createElement('div'); pop.className = 'prize-info st-say gc-pop'; screenEl.appendChild(pop); GC_DOM.pop = pop;
    const say = document.createElement('div'); say.className = 'prize-info st-say gc-say'; screenEl.appendChild(say); GC_DOM.say = say;
    const tk = document.createElement('button'); tk.className = 'vm-item vm-take'; tk.type = 'button'; tk.setAttribute('aria-label', 'カプセル'); screenEl.appendChild(tk); GC_DOM.take = tk; tk.addEventListener('click', () => { ensureAudio(); gcOpen(); });
  }
  function enterGacha() { moveFade(() => { GCH.phase = 'ready'; GCH.busy = false; GCH.st = null; scene = 'gacha'; updateSceneUi(); beep(660, 0, 0.05, 0.04, 'square'); beep(880, 0.05, 0.06, 0.04, 'square'); }); }
  function gcLeave() { if (GCH.busy) return; moveFade(() => { scene = 'b1'; updateSceneUi(); }); }
  const GC_TAKE = () => ({ x: 44, y: 286, w: W - 88, h: 30 });                                                          // 取り出し口
  function gcCapsule(cx, cy, r, col, open, ang) {                                                                      // カプセル（上＝色・下＝すき通った白）。ang＝かたむき
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang || 0);
    const half = (top, c2, dy) => { ctx.save(); ctx.beginPath(); ctx.rect(-r - 1, top ? -r - 1 + dy : dy, r * 2 + 2, r + 1); ctx.clip(); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, dy, r, 0, 6.2832); ctx.fill(); ctx.restore(); };
    half(true, col, -open); half(false, mixHex(col, '#ffffff', 0.6), open);                                          // 上＝こい色／下＝おなじ色の うすい色
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-r, -0.5, r * 2, 1); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(40,10,10,0.55)'; ctx.beginPath(); ctx.arc(0, open ? -open : 0, r, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, open ? open : 0, r, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-r * 0.62, -r * 0.62 - open, Math.max(2, r * 0.3), Math.max(2, r * 0.3)); ctx.restore();
  }
  function gcMachine(spinK) {                                                                                          // ガチャ筐体の正面（赤い筐体・ガラスのドーム・カプセルがぎっしり・ハンドル・取り出し口）
    const x0 = 14; const x1 = W - 14; const ph = GCH.phase; const bl = Math.floor(animT() * 1.6) % 2 === 0;
    rect(x0, 10, x1 - x0, 308, '#c8302e'); rect(x0, 10, 3, 308, '#f06a5a'); rect(x1 - 3, 10, 3, 308, '#8a1a1a'); rect(x0, 10, x1 - x0, 2, '#f06a5a');
    rect(20, 14, W - 40, 34, '#fff0d0'); rect(20, 14, W - 40, 2, '#ffd89a'); rect(20, 46, W - 40, 2, '#d0a860'); drawTextCenter('STICKER', W / 2, 17, '#d02030', 2, '#ffd0c0'); drawTextCenter('GACHA', W / 2, 30, '#d02030', 2, '#ffd0c0');
    rect(22, 52, W - 44, 118, '#2a1a1a'); for (let y = 0; y < 114; y++) rect(24, 54 + y, W - 48, 1, mixHex('#e8f4ff', '#bcd8f0', y / 114));                                                       // ガラスのドーム
    ctx.save(); ctx.beginPath(); ctx.rect(24, 54, W - 48, 114); ctx.clip();
    let seed = 23; const rn = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const per = Math.floor((W - 48) / 20); let idx = 0;                                                                                                                                              // 大きなカプセルが、下から つもっている
    for (let row = 0; row < 8; row++) for (let i = 0; i < per + 1; i++) {
      const fill = row < 5 ? 1 : row === 5 ? 0.7 : 0.35; if (rn() > fill) continue; const bx = 24 + 10 + i * 20 + (row % 2 ? 10 : 0) + (rn() - 0.5) * 4; const by = 160 - row * 14 + (rn() - 0.5) * 3; const ang = (rn() - 0.5) * 2.2; idx++;
      const k = spinK > 0 ? spinK : 0; const jx = k ? Math.sin(GCH.t * 30 + idx * 1.7) * 1.8 * k : 0; const jy = k ? Math.cos(GCH.t * 26 + idx) * 1.6 * k : 0; const ja = k ? Math.sin(GCH.t * 18 + idx) * 0.25 * k : 0;
      gcCapsule(Math.round(bx + jx), Math.round(by + jy), 11, GC_COLORS[Math.floor(rn() * GC_COLORS.length)], 0, ang + ja);
    }
    ctx.restore(); ctx.globalAlpha = 0.35; rect(28, 58, 6, 70, '#ffffff'); rect(36, 58, 2, 40, '#ffffff'); ctx.globalAlpha = 1; rect(22, 168, W - 44, 3, '#8a1a1a');
    rect(26, 174, W - 52, 38, '#fff6e0'); rect(26, 174, W - 52, 2, '#ffd89a'); rect(26, 210, W - 52, 2, '#d0a860');                                                                                // POP（文字は、HTML）
    rect(22, 216, W - 44, 64, '#a82424'); rect(22, 216, W - 44, 2, '#e05a4a');
    if (ph === 'ready') { ctx.globalAlpha = 0.4 + 0.3 * Math.sin(animT() * 6); rect(28, 222, 50, 46, '#ffd84a'); ctx.globalAlpha = 1; }                                                          // コイン投入口が、光る
    rect(30, 224, 44, 16, '#0a0a14'); if (ph === 'ready') { if (bl) drawText('INSERT COIN', 31, 229, '#ff5a3a', 1); } else drawText('YEN ' + GC_PRICE, 34, 229, '#ff5a3a', 1);
    rect(34, 244, 36, 20, '#0a0a14'); rect(40, 252, 24, 2, '#c8d0e8'); drawText('COIN', 38, 268, '#ffd8d0', 1);                                                                                  // コイン投入口
    const kx = W - 56; const ky = 248; if (ph === 'coin' || ph === 'half') { ctx.globalAlpha = 0.4 + 0.3 * Math.sin(animT() * 6); vmCircle(kx, ky, 29, '#ffd84a'); ctx.globalAlpha = 1; }
    vmCircle(kx, ky, 25, '#5a1010'); vmCircle(kx, ky, 22, '#e8e8f0'); vmCircle(kx, ky, 19, '#c8c8d8');                                                                                           // ハンドル
    ctx.save(); ctx.translate(kx, ky); ctx.rotate(GCH.rot || 0); ctx.fillStyle = '#5a1010'; ctx.fillRect(-18, -4, 36, 8); ctx.fillStyle = '#ff4a4a'; ctx.fillRect(-18, -3, 36, 6); ctx.fillStyle = '#ffb0a0'; ctx.fillRect(-18, -3, 36, 2); vmCircle(0, 0, 6, '#8a8aa0'); ctx.restore();
    if (ph === 'coin' && bl) drawTextCenter('TAP!', kx + 0.5, ky - 40, '#ffd84a', 1, '#000000'); if (ph === 'half' && bl) drawTextCenter('TAP AGAIN!', kx + 0.5, ky - 40, '#ffd84a', 1, '#000000');
    rect(38, 282, W - 76, 38, '#2a0a0a'); rect(38, 282, W - 76, 2, '#6a2a2a'); rect(42, 288, W - 84, 30, '#07040a'); rect(42, 288, W - 84, 5, '#4a1a1a'); drawTextCenter('TAKE', W / 2, 284, '#ffd8d0', 1);                // 取り出し口
    for (let k = 20; k < W - 20; k += 4) rect(k, 314, 2, 4, '#8a1a1a');
  }
  function gcResultScreen(t) {
    const st = GCH.st; drawFrame(); rect(8, 8, W - 16, H - 16, '#241236'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#241236', '#0a0618', (y - 8) / (H - 16)));
    const cyc = animT(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(cyc * 3); for (let i = 0; i < 8; i++) kcBitsDraw(ctx, 'sparkle', W / 2 + Math.cos(cyc * 0.7 + i * 0.785) * 74, 112 + Math.sin(cyc * 0.7 + i * 0.785) * 62, 6); ctx.globalAlpha = 1;
    const pop = clamp(t / 0.35, 0, 1); const sz = Math.round(110 * (0.5 + 0.5 * (1 - Math.pow(1 - pop, 3)))); stkDraw(st, W / 2, 112, sz, 0);
    if (GCH.isNew && Math.floor(animT() * 2.4) % 2 === 0) { rect(W / 2 - 22, 40, 44, 14, '#ff3a5a'); rect(W / 2 - 22, 40, 44, 1, '#ff9aaa'); drawTextCenter('NEW!', W / 2 + 0.5, 44, '#ffffff', 1); }
    drawTextCenter('x' + GCH.count, W / 2, 178, '#ffd84a', 2, '#5a3a10'); drawTextCenter(STK_SRC[st.category], W / 2, 198, '#9ab8ff', 1);
    if (GCH.complete) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(cyc * 6); drawTextCenter('COMPLETE!', W / 2, 214, '#7dff8a', 2, '#0a3a1a'); ctx.globalAlpha = 1; }
  }
  function drawGacha() {
    const now = performance.now(); const dt = Math.min(0.05, (now - GCH.last) / 1000); GCH.last = now; GCH.rot = GCH.rot || 0; const ph = GCH.phase; GCH.t += dt; let jig = 0;
    if (ph === 'turn1' || ph === 'turn2') {
      const k = clamp(GCH.t / 0.55, 0, 1); const e = k * k * (3 - 2 * k); GCH.rot = (ph === 'turn1' ? 0 : Math.PI) + e * Math.PI; jig = 1; const n = Math.floor(GCH.t * 14); if (n !== GCH.tick) { GCH.tick = n; beep(250 + (n % 2) * 80, 0, 0.05, 0.05, 'square'); if (n % 3 === 0) beep(1200 + (n % 4) * 90, 0.02, 0.03, 0.02, 'triangle'); }       // ガチャ… ガチャガチャ… コロコロ
      if (k >= 1) { if (ph === 'turn1') { GCH.phase = 'half'; GCH.t = 0; } else { GCH.phase = 'fall'; GCH.t = 0; GCH.rot = 0; } }
    } else if (ph === 'fall') {
      if (!GCH.clunked && GCH.t >= 0.25) { GCH.clunked = true; beep(120, 0, 0.14, 0.09, 'square'); noise(0.1, 0.06); beep(90, 0.08, 0.1, 0.07, 'square'); }
      if (GCH.t >= 0.75) { GCH.phase = 'drop'; GCH.t = 0; GCH.busy = false; }
    } else if (ph === 'drop') { if (GCH.t > 4) gcOpen(); }
    else if (ph === 'open') { if (GCH.t >= 0.55) { GCH.phase = 'result'; GCH.t = 0; beep(GCH.isNew ? 1319 : 988, 0, 0.08, 0.06, 'triangle'); beep(GCH.isNew ? 1760 : 1175, 0.08, 0.12, 0.06, 'triangle'); if (GCH.complete) [1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, 0.3 + i * 0.08, 0.14, 0.06, 'triangle')); } }
    if (GCH.phase === 'result') { gcResultScreen(GCH.t); gcUi(); return; }
    drawFrame(); rect(8, 8, W - 16, H - 16, '#14080c'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#1a0a10', '#0a0408', (y - 8) / (H - 16)));
    gcMachine(jig); const tc = GCH.color; const CR = 12;
    if (GCH.phase === 'fall' && GCH.t >= 0.25) { const f = clamp((GCH.t - 0.25) / 0.45, 0, 1); ctx.save(); ctx.beginPath(); ctx.rect(42, 288, W - 84, 30); ctx.clip(); gcCapsule(Math.round(W / 2), Math.round(278 + 26 * f * f), CR, tc, 0, f * 1.2); ctx.restore(); }
    else if (GCH.phase === 'drop') { ctx.save(); ctx.beginPath(); ctx.rect(42, 288, W - 84, 30); ctx.clip(); gcCapsule(Math.round(W / 2), 304, CR, tc, 0, 0.3); ctx.restore(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(animT() * 6); drawTextCenter('TAP TO OPEN', W / 2, 322, '#ffd84a', 1, '#000000'); ctx.globalAlpha = 1; }
    else if (GCH.phase === 'open') { const f = clamp(GCH.t / 0.55, 0, 1); ctx.save(); ctx.beginPath(); ctx.rect(42, 270, W - 84, 48); ctx.clip(); gcCapsule(Math.round(W / 2), 304 - Math.round(f * 8), CR, tc, Math.round(f * 14), 0.3); ctx.globalAlpha = 1 - f; for (let i = 0; i < 4; i++) kcBitsDraw(ctx, 'sparkle', W / 2 + (i - 1.5) * 14, 290 - f * 10, 6); ctx.restore(); ctx.globalAlpha = 1; }
    gcUi();
  }
  function gcUi() {
    gcBuildDom(); const ph = GCH.phase; const show = (k, on) => GC_DOM[k].classList.toggle('is-show', !!on); const ready = ph === 'ready';
    show('coin', ready); show('knob', ph === 'coin' || ph === 'half'); show('back', ready); show('again', ph === 'result'); show('book', ph === 'result'); show('out', ph === 'result'); show('take', ph === 'drop'); show('pop', ph !== 'result' && ph !== 'open'); show('say', ph === 'result');
    crPlace(GC_DOM.coin, { x: 28, y: 222, w: 52, h: 50 }); crPlace(GC_DOM.knob, { x: W - 56 - 29, y: 248 - 29, w: 58, h: 58 });
    crPlace(GC_DOM.back, { x: Math.round(W / 2) - 30, y: 340, w: 60, h: 20 }); GC_DOM.back.style.fontSize = Math.max(9, parseFloat(GC_DOM.back.style.fontSize) * 0.8) + 'px';
    crPlace(GC_DOM.again, { x: 20, y: 262, w: W - 40, h: 30 }); crPlace(GC_DOM.book, { x: 20, y: 298, w: W - 40, h: 26 }); crPlace(GC_DOM.out, { x: 20, y: 330, w: W - 40, h: 26 });
    crPlace(GC_DOM.take, { x: 40, y: 284, w: W - 80, h: 36 });
    crPlace(GC_DOM.pop, { x: 26, y: 174, w: W - 52, h: 38 }); if (!GC_DOM.pop.dataset.k) { GC_DOM.pop.dataset.k = 1; GC_DOM.pop.innerHTML = '<div class="gc-pop1">NEW COSMO STICKER</div><div class="gc-pop2">ぜん' + stkTotal() + 'しゅ　1かい ¥' + GC_PRICE + '</div>'; }
    const say = GC_DOM.say; if (ph === 'result' && GCH.st) { const k = GCH.st.id + '|' + GCH.count; if (say.dataset.k !== k) { say.dataset.k = k; say.innerHTML = '<div class="vm-got">' + GCH.st.name + '</div><div class="vm-line">もっている ×' + GCH.count + '</div>'; } crPlace(say, { x: 10, y: 218, w: W - 20, h: 36 }); } else say.dataset.k = '';
  }
  function gcHide() { if (!GC_DOM.coin) return; Object.keys(GC_DOM).forEach((k) => GC_DOM[k].classList.remove('is-show')); }
  // ---- 1Fの ガチャガチャ（ゲーセンの すみに むかしから あるような、小さな赤い機械）----
  const GACHA_RECT = { x: 8, y: 250, w: 42, h: 66 };
  function drawGachaCab(r) {
    const t = animT(); ctx.globalAlpha = 0.16; rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, '#ff6a5a'); ctx.globalAlpha = 1;
    rect(r.x, r.y, r.w, r.h, '#c8302e'); rect(r.x, r.y, 2, r.h, '#f06a5a'); rect(r.x + r.w - 2, r.y, 2, r.h, '#8a1a1a'); rect(r.x, r.y, r.w, 2, '#f06a5a');
    rect(r.x + 3, r.y + 3, r.w - 6, 11, '#fff0d0'); drawTextCenter('GACHA', r.x + r.w / 2 + 0.5, r.y + 6, '#d02030', 1);
    rect(r.x + 3, r.y + 16, r.w - 6, 26, '#cfe6f8'); rect(r.x + 3, r.y + 16, r.w - 6, 1, '#ffffff');
    ctx.save(); ctx.beginPath(); ctx.rect(r.x + 3, r.y + 16, r.w - 6, 26); ctx.clip(); for (let i = 0; i < 14; i++) { const bx = r.x + 8 + (i % 4) * 9 + (Math.floor(i / 4) % 2) * 4; const by = r.y + 37 - Math.floor(i / 4) * 8 + Math.round(Math.sin(t * 1.5 + i) * 0.6); gcCapsule(bx, by, 5, GC_COLORS[i % GC_COLORS.length], 0, (i * 0.9) % 2 - 1); } ctx.restore();
    rect(r.x + 3, r.y + 44, 14, 8, '#0a0a14'); drawText('100', r.x + 5, r.y + 46, '#ff5a3a', 1); vmCircle(r.x + r.w - 12, r.y + 48, 8, '#e8e8f0'); vmCircle(r.x + r.w - 12, r.y + 48, 5, '#ff4a4a');
    rect(r.x + 6, r.y + r.h - 12, r.w - 12, 8, '#07040a'); rect(r.x + 6, r.y + r.h - 12, r.w - 12, 1, '#6a2a2a');
  }
  // ---- シール帳：ページをめくる本 ----
  const BK = { page: 0, flip: null, queue: [], detail: null, slots: [], down: null, last: 0, pages: null };
  function bkPages() {                                                                                                 // ページを作る：ゲームごとに、見出しと、3列のシールの並び
    const cell = bkCell(); const rowH = cell + 5; const headH = 13; const budget = 266; const pages = []; let cur = { items: [], used: 0 };
    STK_CATS.forEach((cat) => {
      const ids = STK.filter((x) => x.category === cat.id).map((x) => x.id); let first = true;
      for (let i = 0; i < ids.length; i += 3) {
        const need = rowH + (first ? headH : 0); if (cur.used + need > budget && cur.items.length) { pages.push(cur); cur = { items: [], used: 0 }; first = true; }
        if (first) { cur.items.push({ head: cat, y: cur.used }); cur.used += headH; first = false; }
        cur.items.push({ row: ids.slice(i, i + 3), y: cur.used, cat }); cur.used += rowH;
      }
    });
    if (cur.items.length) pages.push(cur); return pages;
  }
  const bkCell = () => Math.floor((W - 44 - 16 - 10) / 3);
  const bkPageIdx = () => { if (!BK.pages || BK.pagesW !== W) { BK.pages = bkPages(); BK.pagesW = W; } return BK.pages; };
  function bkGoto(target) {                                                                                            // 指定のページへ：何枚もあるときは、パラパラと 続けてめくる
    const pages = bkPageIdx(); target = clamp(target, 0, pages.length - 1); let cur = BK.flip ? BK.flip.to : BK.page; if (BK.queue.length) cur = BK.queue[BK.queue.length - 1];
    while (cur !== target) { cur += target > cur ? 1 : -1; BK.queue.push(cur); }
  }
  function bkPageDraw(pi, ox, scaleX, shade, interactive) {                                                            // 1ページぶんを描く（めくっているときは、背骨（左）を中心に、よこにちぢめる）
    const pages = bkPageIdx(); const pg = pages[pi]; const px = 22; const py = 34; const pw = W - 44; const ph = 290; ctx.save(); ctx.translate(px + ox, 0); ctx.scale(scaleX, 1); ctx.translate(-px, 0);
    rect(px, py, pw, ph, '#fff8e6'); rect(px, py, pw, 2, '#ffffff'); rect(px, py + ph - 2, pw, 2, '#e0d0a8'); rect(px + pw - 2, py, 2, ph, '#e8dcb8');
    for (let y = py + 12; y < py + ph - 8; y += 6) { ctx.globalAlpha = 0.18; rect(px + 4, y, pw - 8, 1, '#c8b890'); ctx.globalAlpha = 1; }
    rect(px, py, 5, ph, '#f0e4c0'); for (let k = 0; k < 5; k++) { const ry = py + 24 + k * 56; rect(px + 1, ry, 3, 3, '#a89870'); }
    const cell = bkCell(); const x0 = px + 12 + Math.round((pw - 12 - 8 - (cell * 3 + 10)) / 2);
    if (interactive) BK.slots = [];
    pg.items.forEach((it) => {
      const y = py + 18 + it.y;
      if (it.head) { rect(x0, y + 1, pw - 26, 9, it.head.color); rect(x0, y + 1, pw - 26, 1, '#ffffff'); drawText(it.head.label, x0 + 3, y + 3, '#ffffff', 1); }
      else it.row.forEach((id, i) => { const st = stkById(id); const cx = x0 + cell / 2 + i * (cell + 5); const cy = y + cell / 2 + 1; const rec = P_().stickers[id]; if (rec && rec.count > 0) { stkDraw(st, cx, cy, cell, rec.count); if (interactive) BK.slots.push({ id, x: cx - cell / 2, y: cy - cell / 2, w: cell, h: cell }); } else stkEmpty(cx, cy, cell); });
    });
    if (shade > 0) { ctx.globalAlpha = shade; rect(px, py, pw, ph, '#000000'); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function drawSBook() {
    const now = performance.now(); const dt = Math.min(0.05, (now - BK.last) / 1000); BK.last = now; const pages = bkPageIdx();
    drawFrame(); rect(8, 8, W - 16, H - 16, '#3a2418'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#3a2418', '#241408', (y - 8) / (H - 16)));
    rect(14, 30, W - 28, 298, '#7a2a30'); rect(14, 30, 4, 298, '#a84048'); rect(W - 18, 30, 4, 298, '#5a1a20');                                                                                       // 本の表紙（ページのうしろ）
    drawTextCenter('STICKER  ' + stkOwned() + ' / ' + stkTotal(), W / 2, 14, '#ffe9a0', 2, '#5a3a10'); if (P_().stickerMeta.completed) drawTextCenter('COMPLETE', W - 36, 20, '#7dff8a', 1);
    if (!BK.flip && BK.queue.length) { const to = BK.queue.shift(); BK.flip = { from: BK.page, to, t: 0, dur: BK.queue.length > 0 ? 0.16 : 0.42, dir: to > BK.page ? 1 : -1 }; beep(520 + Math.abs(to) * 40, 0, 0.05, 0.03, 'triangle'); noise(0.04, 0.025); }
    if (BK.flip) {
      const f = BK.flip; f.t += dt; const k = clamp(f.t / f.dur, 0, 1); const e = k * k * (3 - 2 * k);
      if (f.dir > 0) { bkPageDraw(f.to, 0, 1, 0, false); const sx = Math.max(0.02, 1 - e); bkPageDraw(f.from, 0, sx, 0.18 * e, false); const edge = 22 + Math.round((W - 44) * sx); ctx.globalAlpha = 0.25 * (1 - e); rect(edge, 34, 14, 290, '#000000'); ctx.globalAlpha = 1; }
      else { bkPageDraw(f.from, 0, 1, 0, false); const sx = Math.max(0.02, e); bkPageDraw(f.to, 0, sx, 0.18 * (1 - e), false); const edge = 22 + Math.round((W - 44) * sx); ctx.globalAlpha = 0.25 * e; rect(edge, 34, 14, 290, '#000000'); ctx.globalAlpha = 1; }
      if (k >= 1) { BK.page = f.to; BK.flip = null; }
    } else bkPageDraw(BK.page, 0, 1, 0, true);
    STK_CATS.filter((c) => c.tab !== false).forEach((cat, i) => { const pi = pages.findIndex((p) => p.items.some((it) => it.head && it.head.id === cat.id)); const ty = 44 + i * 30; const here = pi === BK.page; rect(W - 16 + (here ? 0 : 0), ty, 8, 24, cat.color); rect(W - 16, ty, 8, 1, '#ffffff'); if (here) rect(W - 18, ty, 2, 24, '#ffffff'); });                // 見出しの、しおり（タップでパラパラ）
    drawTextCenter((BK.flip ? BK.flip.to : BK.page) + 1 + ' / ' + pages.length, W / 2, 332, '#ffe9a0', 1);
    if (BK.detail) {
      const st = stkById(BK.detail); const rec = P_().stickers[BK.detail] || { count: 0, firstGetDay: 0 }; ctx.globalAlpha = 0.78; rect(8, 8, W - 16, H - 16, '#0a0610'); ctx.globalAlpha = 1;
      rect(W / 2 - 74, 50, 148, 232, '#fff8e6'); rect(W / 2 - 74, 50, 148, 2, '#ffffff'); rect(W / 2 - 74, 280, 148, 2, '#e0d0a8'); stkDraw(st, W / 2, 116, 100, 0);
      drawTextCenter(STK_SRC[st.category], W / 2, 176, '#7a5a30', 1); drawTextCenter('FIRST GET  DAY ' + rec.firstGetDay, W / 2, 232, '#7a5a30', 1);
    }
    bkUi();
  }
  const BK_DOM = {};
  function bkBuildDom() {
    if (BK_DOM.back) return;
    const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); BK_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    mk('bk-back', 'もどる', 'hb-sub', () => { beep(520, 0, 0.05, 0.04, 'square'); BK.queue = []; BK.flip = null; moveFade(() => { scene = 'b1'; updateSceneUi(); }); });
    mk('bk-prev', '◀', 'hb-arrow', () => { if (!BK.detail) bkGoto((BK.flip ? BK.flip.to : BK.page) - 1); }); mk('bk-next', '▶', 'hb-arrow', () => { if (!BK.detail) bkGoto((BK.flip ? BK.flip.to : BK.page) + 1); });
    mk('bk-close', 'とじる', 'hb-sub', () => { BK.detail = null; beep(520, 0, 0.04, 0.04, 'square'); });
    const say = document.createElement('div'); say.className = 'prize-info st-say bk-say'; screenEl.appendChild(say); BK_DOM.say = say;
  }
  function bkUi() {
    bkBuildDom(); const on = scene === 'sbook'; const det = !!BK.detail; const show = (k, v) => BK_DOM[k].classList.toggle('is-show', !!v);
    show('back', on && !det); show('prev', on && !det); show('next', on && !det); show('close', on && det); show('say', on && det);
    crPlace(BK_DOM.back, { x: Math.round(W / 2) - 30, y: 350, w: 60, h: 20 }); BK_DOM.back.style.fontSize = Math.max(9, parseFloat(BK_DOM.back.style.fontSize) * 0.8) + 'px'; crPlace(BK_DOM.prev, { x: 14, y: 340, w: 34, h: 30 }); crPlace(BK_DOM.next, { x: W - 48, y: 340, w: 34, h: 30 });
    crPlace(BK_DOM.close, { x: Math.round(W / 2) - 36, y: 290, w: 72, h: 26 });
    if (det) { const st = stkById(BK.detail); const rec = P_().stickers[BK.detail] || { count: 0 }; const k = BK.detail + '|' + rec.count; if (BK_DOM.say.dataset.k !== k) { BK_DOM.say.dataset.k = k; BK_DOM.say.innerHTML = '<div class="vm-got bk-name">' + st.name + '</div><div class="bk-line">もっている ×' + rec.count + '</div>'; } crPlace(BK_DOM.say, { x: 28, y: 190, w: W - 56, h: 40 }); } else BK_DOM.say.dataset.k = '';
  }
  function bkHide() { if (!BK_DOM.back) return; Object.keys(BK_DOM).forEach((k) => BK_DOM[k].classList.remove('is-show')); }
  function openStickerBook() { if (GCH.busy) return; closeDialog(); BK.page = 0; BK.flip = null; BK.queue = []; BK.detail = null; BK.pages = null; scene = 'sbook'; updateSceneUi(); beep(660, 0, 0.05, 0.04, 'triangle'); }
  const bkDown = (p) => { BK.down = { x: p.x, y: p.y }; };
  function bkUp(p) {                                                                                                   // よこに はらう＝ページをめくる／ちょん＝シール・しおりを タップ
    const d = BK.down; BK.down = null; if (!d || scene !== 'sbook') return; if (BK.detail) { return; }
    const dx = p.x - d.x; const dy = p.y - d.y; const cur = BK.flip ? BK.flip.to : BK.page;
    if (Math.abs(dx) > 28 && Math.abs(dy) < 50) { bkGoto(cur + (dx < 0 ? 1 : -1)); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const pages = bkPageIdx(); const tabs = STK_CATS.filter((c) => c.tab !== false); for (let i = 0; i < tabs.length; i++) { const ty = 44 + i * 30; if (p.x >= W - 18 && p.x <= W - 6 && p.y >= ty && p.y <= ty + 24) { const pi = pages.findIndex((q) => q.items.some((it) => it.head && it.head.id === tabs[i].id)); bkGoto(pi); return; } }
      if (!BK.flip) { const s = BK.slots.find((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h); if (s) { BK.detail = s.id; beep(880, 0, 0.05, 0.04, 'triangle'); } }
    }
  }
  // ---- DEV ----
  function openGcDev() {
    const again = (f) => () => { f(); setTimeout(openGcDev, 0); }; const P = P_(); const cur = BK.devSel || 0;
    const st = STK[cur % STK.length];
    showDialog({ title: 'STICKER DEV', wide: true, lines: [{ text: 'STICKER ' + stkOwned() + ' / ' + stkTotal() + ' / MONEY ¥' + P.money + ' / 選択: ' + st.id + ' ×' + ((P.stickers[st.id] || {}).count || 0) + ' FIRST GET DAY ' + ((P.stickers[st.id] || {}).firstGetDay || '-'), cls: 'dim' }, { text: '演出スキップ ' + (GCH.dev.skip ? 'ON' : 'OFF') + ' / 次のガチャ強制: ' + (GCH.force || 'なし'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P.money += 1000; writeSave(); }) },
      { label: '選択を つぎへ', onClick: again(() => { BK.devSel = (cur + 1) % STK.length; }) }, { label: '選択を まえへ', onClick: again(() => { BK.devSel = (cur + STK.length - 1) % STK.length; }) },
      { label: '選択を、次のガチャで強制排出', onClick: again(() => { GCH.force = st.id; }) },
      { label: '選択の count +1', onClick: again(() => { gcGrant(st); writeSave(); }) }, { label: '選択の count 0（けす）', onClick: again(() => { delete P.stickers[st.id]; writeSave(); }) },
      { label: 'ランダム1回（¥なし）', onClick: again(() => { const x = gcPick(); gcGrant(x); writeSave(); toast(x.name + ' を ゲット'); }) },
      { label: '全シール 取得', onClick: again(() => { STK.forEach((x) => { if (!(P.stickers[x.id] || {}).count) { P.stickers[x.id] = { count: 1, firstGetDay: P.day }; } }); writeSave(); }) },
      { label: '未所持を 1枚だけ のこす', onClick: again(() => { STK.forEach((x, i) => { if (i === STK.length - 1) delete P.stickers[x.id]; else if (!(P.stickers[x.id] || {}).count) P.stickers[x.id] = { count: 1, firstGetDay: P.day }; }); P.stickerMeta.completed = false; writeSave(); }) },
      { label: '33/33 COMPLETE テスト（最後の1枚を強制）', onClick: () => { STK.forEach((x, i) => { if (i === STK.length - 1) delete P.stickers[x.id]; else if (!(P.stickers[x.id] || {}).count) P.stickers[x.id] = { count: 1, firstGetDay: P.day }; }); P.stickerMeta.completed = false; GCH.force = STK[STK.length - 1].id; writeSave(); toast('ガチャを まわしてね（最後の1枚）'); } },
      { label: 'シール帳 全消去', onClick: () => { showDialog({ title: '全消去？', lines: [{ text: 'シール帳を、すべて消します', cls: '' }], buttons: [{ label: '消す', onClick: () => { P.stickers = {}; P.stickerMeta.completed = false; writeSave(); setTimeout(openGcDev, 0); } }, { label: 'やめる', primary: true }] }); } },
      { label: '排出率テスト（33000回）', onClick: () => { const cnt = {}; for (let i = 0; i < 33000; i++) { const x = gcPick(); cnt[x.id] = (cnt[x.id] || 0) + 1; } const v = Object.values(cnt); showDialog({ title: '排出率', lines: [{ text: '33000回：最少 ' + Math.min(...v) + ' / 最多 ' + Math.max(...v) + ' / 期待値 ' + Math.round(33000 / STK.length), cls: '' }, { text: '全 ' + STK.length + ' 種類が出た：' + (Object.keys(cnt).length === STK.length), cls: 'dim' }], buttons: [{ label: 'OK', primary: true }] }); } },
      { label: 'ガチャ演出スキップ ON/OFF', onClick: again(() => { GCH.dev.skip = !GCH.dev.skip; }) },
      { label: 'とじる', primary: true } ] });
  }

