'use strict';
  // =====================================================================
  //  3階建てのゲームセンター（各階2×2の4枠）／ 閉店・開店の演出
  //   1F：入口階（メダル貸出機・記録ボード・出口）　2F：ふつうのゲームフロア　3F：少し奥まった静かな階
  // =====================================================================
  const FLOORS = CONFIG.floors;
  let floorFade = null;                          // 階を移動するときの、短い暗転 { t, dur, to, done }
  const machineById = (id) => MACHINES.find((m) => m.machineId === id);
  const floorOfMachine = (id) => Math.max(0, FLOORS.findIndex((f) => f.indexOf(id) >= 0));
  const FREE_SLOT = { machineId: 'free', machineName: '？？？', label: '???', isUnlocked: false, gameType: null };      // 空き枠（FLOORS に null を入れたとき用）
  const slotMachine = (floor, idx) => { const id = FLOORS[floor][idx]; return id ? machineById(id) : FREE_SLOT; };
  const slotOfMachine = (m) => Math.max(0, FLOORS[floorOfMachine(m.machineId)].indexOf(m.machineId));
  const FLOOR_LOOK = [
    { wall: '#2a1e44', line: '#34285a', base: '#3a2a5a', tileA: '#3a2c66', tileB: '#2e2250', glow: '#ffe9b0', glowA: 0.12 },     // 1F：少し明るい
    { wall: '#1a1030', line: '#21163c', base: '#2a1d48', tileA: '#2c2150', tileB: '#241a40', glow: '#ff8ef0', glowA: 0.08 },     // 2F：薄暗くて、筐体の光が目立つ
    { wall: '#141a2c', line: '#1a2236', base: '#202a44', tileA: '#222c48', tileB: '#1a2238', glow: '#9fc8ff', glowA: 0.05 }      // 3F：静かで、奥まった感じ
  ];
  const stairUpBox = () => ({ x: W - 30, y: 270, w: 22, h: 24 });                              // ▲：どの階でも、右はし（エレベーターの扉の右）
  const stairDownBox = () => ({ x: W - 30, y: 298, w: 22, h: 24 });                            // ▼：▲の真下
  function stairRects(f) {
    return { up: stairUpBox(), down: stairDownBox() };                                  // 2F〜4F：のぼる（4Fのときは 5F へ）・おりる（2Fのときは 1F へ）
  }
  function drawStairBtn(r, dir, label) {
    rect(r.x, r.y, r.w, r.h, '#4a3a78'); rect(r.x, r.y, r.w, 2, '#8a7ac8'); rect(r.x, r.y + r.h - 2, r.w, 2, '#2a1e48');
    const cx = r.x + 14; const cy = r.y + r.h / 2;
    for (let i = 0; i < 5; i++) rect(cx - i + 0, dir > 0 ? cy - 4 + i * 2 - 0 : cy + 4 - i * 2 - 1, i * 2 + 1, 2, '#ffe9a0');   // ▲ ▼
    drawText(label, r.x + 28, r.y + r.h / 2 - 5, '#ffffff', 2, '#2a1a40');
    ctx.globalAlpha = 0.08 + 0.08 * softPulse(2, 0); rect(r.x, r.y, r.w, r.h, '#ffffff'); ctx.globalAlpha = 1;
  }
  const stairSfx = (dir) => (dir < 0 ? [392, 330, 262] : [262, 330, 392]).forEach((f, i) => beep(f, i * 0.08, 0.06, 0.04, 'square'));      // 階の移動の音：のぼる＝ド・ミ・ソ（上がる）／おりる＝ソ・ミ・ド（下がる）
  function changeFloor(dir) {
    const to = centerFloor + dir;
    if (to < 0 || to >= FLOORS.length) return;
    floorFade = { t: 0, dur: 0.55, to, done: false };
    stairSfx(dir);
  }
  // ---- 全フロア共通：いちばん上に、DAY・YEN・MEDAL。そのすぐ下に、GAME CENTER NEW COSMO の看板（階つき） ----
  const BOTTOM_DY = 20;                                                                     // 下のエリア（メダル機・記録・出口・階段）を、下へ下げる量（ヘッダーが枠の外に出たぶんの空きを、うまく使う）
  const FLOOR_TOP = 262;                                                                    // 床の はじまり（筐体2段の下）
  const fhEl = document.getElementById('floor-header');                                      // 茶色い枠の外（画面の上）に出す、HTMLのヘッダー：DAY・YEN・MEDAL
  let fhLast = '';
  function fhUpdate() {
    if (!fhEl) return;
    const on = (scene === 'center' || scene === 'b1' || scene === 'b2' || scene === 'b3' || scene === 'b4' || scene === 'b5' || scene === 'vending' || scene === 'gacha') && !!save;
    fhEl.classList.toggle('is-show', on);
    if (!on) return;
    const t = P_().day + '|' + P_().money + '|' + hand;
    if (t !== fhLast) { fhLast = t; fhEl.querySelector('.fh-day').textContent = 'DAY ' + P_().day; fhEl.querySelector('.fh-yen').textContent = String(P_().money); fhEl.querySelector('.fh-medal').textContent = String(hand); }
  }
  function drawFloorHeader() { fhUpdate(); }
  // ---- フロアの定義（1F〜5F）。階の名前・看板の表示に使う。中身の場所：1F＝クレーン階（内部ID b1）／2F〜4F＝メダル階（center の 0〜2）／5F＝アミューズメント階（内部ID b2）----
  const FLOOR_DEFS = [
    { floor: 1, id: 'prize', label: 'PRIZE CORNER', short: 'PRIZE', scene: 'b1' }, { floor: 2, id: 'medal1', label: 'MEDAL FLOOR', short: 'MEDAL', scene: 'center', cf: 0 }, { floor: 3, id: 'medal2', label: 'MEDAL FLOOR', short: 'MEDAL', scene: 'center', cf: 1 },
    { floor: 4, id: 'medal3', label: 'MEDAL FLOOR', short: 'MEDAL', scene: 'center', cf: 2 }, { floor: 5, id: 'amusement', label: 'AMUSEMENT FLOOR', short: 'ARCADE', scene: 'b2' }, { floor: 6, id: 'sports', label: 'SPORTS CORNER', short: 'SPORTS', scene: 'b3' }, { floor: 7, id: 'video', label: 'VIDEO CORNER', short: 'VIDEO', scene: 'b4' }, { floor: 8, id: 'ghost', label: 'GHOST CORNER', short: 'GHOST', scene: 'b5' }       // 階をふやすときは、ここに1件足す（scene＝その階の画面。enabled:false で、一時的に閉鎖）
  ];
  const floorNo = () => (scene === 'b1' ? 1 : scene === 'b2' ? 5 : scene === 'b3' ? 6 : scene === 'b4' ? 7 : scene === 'b5' ? 8 : centerFloor + 2);                 // いまいる階の番号（1〜6）
  const medalFloorNo = (id) => floorOfMachine(id) + 2;                                                // メダルゲームが、いま ある階の番号（2〜4）
  function drawFloorSign(n) {                                                               // ネオン看板：GAME CENTER / NEW COSMO ＋ 階の番号 ＋ 階の名前。枠の内側いっぱいに、枠の上のほう（y=12）に
    const d = FLOOR_DEFS[n - 1]; const x0 = 16; const w = W - 32; const tx = x0 + (w - 26) / 2;
    rect(x0, 12, w, 38, '#120a24');
    rect(x0, 12, w, 1, '#c85a90'); rect(x0, 49, w, 1, '#c85a90');
    rect(x0, 12, 1, 38, '#c85a90'); rect(x0 + w - 1, 12, 1, 38, '#c85a90');
    ctx.globalAlpha = 0.25 + 0.1 * softPulse(1.5);
    rect(x0 + 4, 16, w - 8, 30, '#ff5ca8');
    ctx.globalAlpha = 1;
    drawTextCenter('GAME CENTER', tx, 16, '#ffb8dc', 1, '#7a2a5a');
    drawTextCenter('NEW COSMO', tx, 23, '#ffd0ec', 2, '#7a2a5a');
    drawTextCenter(d.label, tx, 38, '#e8d0ff', 1, '#4a1a5a');
    rect(x0 + w - 25, 19, 19, 16, '#5a1a3a');
    drawTextCenter(d.floor + 'F', x0 + w - 15.5, 22, '#ffffff', 2, '#2a0a1a');
  }
  const DOOR = { open: 0, target: 0, last: 0, busy: false };                                                           // 自動ドアの状態（0＝とじている／1＝ぜんぶ開いている）
  function drawAutoDoor(ex) {                                                                                          // 1F の出口：自動ドア（ガラスの2枚が、左右にスライド）
    const now = animT(); const dt = Math.min(0.05, Math.max(0, now - DOOR.last)); DOOR.last = now; DOOR.open += clamp(DOOR.target - DOOR.open, -dt * 1.8, dt * 1.8);
    const o = DOOR.open; const gx = ex.x; const gy = ex.y + 12; const gw = ex.w; const gh = ex.h - 16;
    rect(ex.x - 3, ex.y + 8, ex.w + 6, ex.h - 6, '#2a3350'); rect(ex.x - 3, ex.y + 8, ex.w + 6, 2, '#6a7aa8');                                  // ドアのわく
    rect(ex.x + 2, ex.y, ex.w - 4, 9, '#103a1a'); rect(ex.x + 2, ex.y, ex.w - 4, 1, '#3a8a4a'); drawTextCenter('EXIT', ex.x + ex.w / 2 + 0.5, ex.y + 2, '#7dff8a', 1);                       // 上の「EXIT」
    rect(ex.x + ex.w / 2 - 6, ex.y + 9, 12, 3, '#1a1a2a'); rect(ex.x + ex.w / 2 - 1, ex.y + 10, 2, 1, o > 0.05 ? '#7dff8a' : '#ff5a5a');                                                          // センサー
    for (let y = 0; y < gh; y++) rect(gx, gy + y, gw, 1, mixHex('#bfe4ff', '#e8f6ff', y / gh));                                                                                                 // ドアの むこう（そとの 明るい空気）
    if (o > 0.4) { ctx.globalAlpha = Math.min(0.6, (o - 0.4)); rect(gx + 4, gy + gh - 14, gw - 8, 14, '#fff6c8'); ctx.globalAlpha = 1; }
    ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    const half = gw / 2; const slide = Math.round(o * (half - 3));
    for (const side of [-1, 1]) {                                                                                         // 2まいのガラスの戸
      const px0 = side < 0 ? gx - slide : gx + half + slide; rect(px0, gy, half, gh, '#8ac4ec'); rect(px0, gy, half, 2, '#d8f0ff'); rect(px0, gy + gh - 2, half, 2, '#5a8ab0');
      rect(px0 + (side < 0 ? 0 : half - 2), gy, 2, gh, '#d8f0ff'); rect(px0 + (side < 0 ? half - 3 : 1), gy, 2, gh, '#6a9ac4');
      ctx.globalAlpha = 0.5; rect(px0 + 5, gy + 5, 3, gh - 18, '#ffffff'); rect(px0 + 11, gy + 8, 2, gh - 26, '#ffffff'); ctx.globalAlpha = 1;
      rect(px0 + (side < 0 ? half - 6 : 4), gy + Math.round(gh / 2) - 6, 2, 12, '#e8eef8');                              // とって
    }
    ctx.restore();
    rect(ex.x - 3, ex.y + ex.h - 2, ex.w + 6, 4, '#3a3a52'); rect(ex.x + 4, ex.y + ex.h - 3, ex.w - 8, 1, '#6a6a88');                                                                        // 足もとのマット
  }
  function doorSfx() {                                                                                                  // ピンポーン → ウィーン……
    beep(1319, 0, 0.12, 0.05, 'triangle'); beep(1047, 0.14, 0.18, 0.05, 'triangle'); beep(240, 0.34, 0.8, 0.035, 'sawtooth', 520); beep(1175, 1.12, 0.05, 0.03, 'square');
  }
  function autoDoorThen(fn) {                                                                                           // 帰るとき：自動ドアが、ウィーンと開いてから、1日をおわる
    if (DOOR.busy) return; DOOR.busy = true; DOOR.target = 1; doorSfx();
    setTimeout(() => { DOOR.busy = false; DOOR.target = 0; DOOR.open = 0; fn(); }, 1500);
  }
  function drawRecordExit() {                                                               // 1F（玄関）：RECORD ボードと EXIT（BOTTOM_DY だけ下げた座標の中で描く）
    const rb = RECORD_BOARD;
    rect(rb.x, rb.y, rb.w, rb.h, '#3a2a14');
    rect(rb.x + 2, rb.y + 2, rb.w - 4, rb.h - 4, '#f0e0b0');
    drawTextCenter('RECORD', rb.x + rb.w / 2 + 0.5, rb.y + 5, '#5a3008', 1);
    ctx.drawImage(ICONS.star, px(rb.x + rb.w / 2 - 3), rb.y + 13);
    drawTextCenter('DAY ' + P_().day, rb.x + rb.w / 2 + 0.5, rb.y + 22, '#5a3008', 1);
    drawAutoDoor(EXIT);
  }
  function drawCenterRoom() {
    const f = centerFloor;
    const dx = W - 180; const hx = Math.round(dx / 2);
    const L = FLOOR_LOOK[f];
    rect(8, 8, W - 16, FLOOR_TOP - 12, L.wall);
    for (let x = 12; x < W - 8; x += 12) rect(x, 12, 1, FLOOR_TOP - 16, L.line);
    rect(8, FLOOR_TOP - 4, W - 16, 4, L.base);
    for (let y = FLOOR_TOP; y < H - 10; y += 8) for (let x = 8; x < W - 8; x += 8) rect(x, y, 8, 8, ((x + y) / 8) % 2 ? L.tileB : L.tileA);
    ctx.globalAlpha = L.glowA + 0.04 * softPulse(1.2);
    rect(8, 8, W - 16, 130, L.glow);
    ctx.globalAlpha = 1;
    drawFloorHeader();
    drawFloorSign(f + 2);

    // 筐体（この階の4枠）
    for (let i = 0; i < 4; i++) drawCabinet(slotMachine(f, i), SLOTS[i], i);

    ctx.save(); ctx.translate(0, BOTTOM_DY);                                                  // ここから下：メダル機・記録・出口・階段
    if (f === 0) {
      const mm = MEDAL_MACHINE;                                        // 1F：メダル貸出機・記録ボード・出口
      rect(mm.x, mm.y, mm.w, mm.h, '#2a6a7a');
      rect(mm.x, mm.y, mm.w, 2, '#5ac8d8');
      rect(mm.x + 3, mm.y + 4, mm.w - 6, 10, '#103038');
      drawTextCenter('MEDAL', mm.x + mm.w / 2 + 0.5, mm.y + 7, C.yellow, 1);
      rect(mm.x + 6, mm.y + 18, mm.w - 12, 16, '#0a1a20');
      drawTextCenter('YEN', mm.x + mm.w / 2 + 0.5, mm.y + 20, C.cyan, 1);
      drawTextCenter('MEDAL', mm.x + mm.w / 2 + 0.5, mm.y + 27, C.goldLight, 1);
      rect(mm.x + 8, mm.y + 40, 12, 3, '#0a1a20');
      rect(mm.x + 26, mm.y + 40, 10, 3, '#0a1a20');
      rect(mm.x + 6, mm.y + 58, mm.w - 12, 14, '#103038');
      for (let i = 0; i < 4; i++) drawCoinSprite(coinFull, mm.x + 12 + i * 7, mm.y + 64);
      drawLabelArrow(mm.x + mm.w / 2, mm.y - 8, 'TAP');
      { const pcx = Math.round(W / 2) - 17; rect(pcx, 256, 34, 44, '#2a5a9a'); rect(pcx + 2, 258, 30, 40, '#bfe0ff'); drawCoinSprite(coinFull, pcx + 9, 266); drawCoinSprite(coinFull, pcx + 17, 274); drawTextCenter('MEDAL', pcx + 17, 288, '#1a3a6a', 1); }        // メダルゲームの階：ポスター（中央）
    } else if (f === 1) {
      rect(18, 256, 34, 44, '#c84a7a'); rect(20, 258, 30, 40, '#ffd8e8'); drawStar(35, 272, '#ff5a8a'); drawTextCenter('HOT', 35.5, 286, '#8a2a4a', 1);     // ポスター
      ctx.save(); ctx.translate(Math.round(W / 2) - 146, 0);
    rect(126, 252, 40, 54, '#2a5a9a'); rect(129, 255, 34, 30, '#9fd0ff'); rect(131, 289, 30, 12, '#10203a'); rect(134, 259 + Math.round(softPulse(1.4) * 3), 6, 6, '#ff5a6a'); rect(146, 266, 6, 6, '#ffd84a');   // 自販機
    ctx.restore();
    } else {
      rect(20, 256, 44, 34, '#0a1020'); rect(22, 258, 40, 30, '#2a3a6a'); rect(40, 258, 2, 30, '#0a1020'); rect(22, 272, 40, 2, '#0a1020'); rect(30, 262, 6, 6, '#e8e8c0');   // 小さな窓と月
      rect(8, 252, W - 16, 3, '#3a4a6a'); for (let k = 0; k < 6 + Math.round(dx / 28); k++) rect(14 + k * 28, 250, 4, 8, '#4a5a7a');                                                       // 配管
      { const pcx = Math.round(W / 2) - 17; rect(pcx, 262, 34, 34, '#3a3a52'); rect(pcx + 2, 264, 30, 30, '#6a5a4a'); rect(pcx + 6, 270, 22, 14, '#c8b890'); rect(pcx + 8, 288, 18, 2, '#4a3a2a'); }                    // 古いポスターと壁のよごれ
    }
    drawNav(f + 2);                                                                      // エレベーター＋▲▼（どの階も同じ場所）

    ctx.restore();
  }

  function centerTap(p) {
    if (zoom || floorFade) return;
    for (let i = 0; i < 4; i++) {
      const s = SLOTS[i];
      if (inRect(p, { x: s.x, y: s.y, w: CAB.w, h: CAB.h })) {
        const m = slotMachine(centerFloor, i);
        if (!m.isUnlocked) { toast('まだ準備中みたいだ……'); return; }
        sitDown(m);
        return;
      }
    }
    p = { x: p.x, y: p.y - BOTTOM_DY };                                                    // ここから下は、BOTTOM_DY だけ下がっている
    if (navTap(p, centerFloor + 2)) return;
    if (centerFloor === 0) {                                                               // 2F：メダル貸出機（自販機）
      if (inRect(p, MEDAL_MACHINE)) { openMedalMachine(); return; }
    }
  }

  function drawCenter() {
    drawFrame();
    if (zoom) {
      const t = Math.min(1, zoom.t / ARC.zoomTime);
      const k = zoom.dir === 'in' ? t : 1 - t;
      const s = SLOTS[slotOfMachine(zoom.machine)];
      const cx = s.x + CAB.w / 2;
      const cy = s.y + CAB.h / 2;
      const scale = 1 + k * 2.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      drawCenterRoom();
      ctx.restore();
      ctx.globalAlpha = k * 0.9;
      rect(0, 0, W, H, C.black);
      ctx.globalAlpha = 1;
      return;
    }
    drawCenterRoom();
    if (floorFade) {
      ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, floorFade.t / floorFade.dur));
      rect(0, 0, W, H, C.black);
      ctx.globalAlpha = 1;
    }
  }


  // =====================================================================
  //  B1 PRIZE CORNER（簡易な部屋）：少し暗い地下。クレーン筐体だけが明るい
  // =====================================================================
  const b1Cabs = () => {
    const dx = W - 180; const colW = (W - 24) / 3; const key = ['slime', 'duck', 'ham', 'fish', null, 'piyo'];
    return key.map((k, i) => { const big = k === 'piyo'; const w = big ? 58 : 50; return { key: k, x: Math.round(12 + (i % 3) * colW + (colW - w) / 2), y: i < 3 ? 56 : 158, w, h: big ? 90 : 84 }; });
  };
  const b1Up = () => stairUpBox();
  function enterB1() { moveFade(() => { scene = 'b1'; currentMachine = null; updateSceneUi(); stairSfx(-1); }); }
  function leaveB1() { moveFade(() => { scene = 'center'; centerFloor = 0; updateSceneUi(); stairSfx(1); }); }
  function b1Tap(p) {
    const pb = { x: p.x, y: p.y - BOTTOM_DY };
    for (const c of b1Cabs()) {
      if (!inRect(p, c)) continue;
      if (c.key === null) { enterShelf(); return; }
      CRS.key = c.key; moveFade(() => enterMachine(CR_MACHINES.find((m) => m.crane === c.key))); return;
    }
    if (inRect(pb, RECORD_BOARD)) { openRecords(); return; }
    if (inRect(pb, EXIT)) { askGoHome(); return; }
    if (inRect(pb, GACHA_RECT)) { enterGacha(); return; }
    if (navTap(pb, 1)) return;
  }

  // =====================================================================
  //  PRIZE SHELF（景品棚）：B1の棚をタップ → 棚を大きく見る（縦にスクロール）→ 景品をタップ → 景品を大きく見る
  //   取った景品だけが、棚に飾られる（未取得のシルエットや「○/36」は出さない）。同じ景品は、代表1体だけ。数は、詳細の RECORD で
  // =====================================================================
  const SHF = { scroll: 0, down: null, dragged: false, sel: null, cells: [], contentH: 0, viewTop: 38, viewBot: 318, bt: 0 };
  const SH_ORDER = ['piyo', 'slime', 'duck', 'ham', 'fish'];
  const prizeGroup = (id) => (id.indexOf('piyo_') === 0 ? 'piyo' : id.indexOf('s_') === 0 ? 'slime' : id.indexOf('d_') === 0 ? 'duck' : id.indexOf('f_') === 0 ? 'fish' : 'ham');
  function shelfRows() {                                          // 取った景品だけを、種類ごとの棚に
    const sh = crP().shelf; const rows = []; const per = W >= 190 ? 4 : 3;
    for (const g of SH_ORDER) {
      const ids = Object.keys(CRC.prizes).filter((id) => sh[id] && prizeGroup(id) === g);
      for (let i = 0; i < ids.length; i += (g === 'piyo' ? 3 : per)) rows.push({ g, ids: ids.slice(i, i + (g === 'piyo' ? 3 : per)), h: g === 'piyo' ? 76 : 58 });
    }
    return rows;
  }
  function shelfSprite(id, cx, by, maxW, maxH, bob, useBig) {     // 景品の絵を、縦横比のまま、枠に収めて描く（足元＝by）
    const bg = useBig ? shBig(id) : null; const img = bg || crImg(id); const cr = bg ? { sx: 0, sy: 0, sw: bg.naturalWidth, sh: bg.naturalHeight } : (img ? crCrop(id) : null); if (!img || !cr) return { w: 0, h: 0 };
    const k = Math.min(maxW / cr.sw, maxH / cr.sh); const dw = Math.max(4, Math.round(cr.sw * k)); const dh = Math.max(4, Math.round(cr.sh * k));
    const smooth = cr.sw / dw > 2.5;                                                       // 大きな絵を、小さく描くときだけ、なめらかに（ギザギザを防ぐ）
    if (smooth) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    ctx.drawImage(img, cr.sx, cr.sy, cr.sw, cr.sh, Math.round(cx - dw / 2), Math.round(by - dh - (bob || 0)), dw, dh);
    if (smooth) ctx.imageSmoothingEnabled = false;
    return { w: dw, h: dh };
  }
  const SH_BIG = {};                                              // 景品を大きく見る画面用の、大きな画像（あれば）
  const shBig = (id) => { const f = CRC.prizes[id].big; if (!f) return null; if (!SH_BIG[id]) { const im = new Image(); im.src = f; SH_BIG[id] = im; } const im = SH_BIG[id]; return im.complete && im.naturalWidth ? im : null; };
  const SH_DOM = {};
  function shelfBuildDom() {
    if (SH_DOM.back) return;
    const b = document.createElement('button'); b.className = 'cr-btn sh-back'; b.id = 'sh-back'; b.type = 'button'; b.textContent = '戻る'; screenEl.appendChild(b); SH_DOM.back = b;
    b.addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); if (scene === 'detail') { scene = 'shelf'; SHF.sel = null; } else if (scene === 'shelf') { scene = 'b1'; } updateSceneUi(); });
    const d = document.createElement('div'); d.className = 'prize-info'; d.id = 'prize-info'; screenEl.appendChild(d); SH_DOM.info = d;
  }
  function shelfUi() {                                            // 画面の上に重ねる日本語（もどる・景品の名前・RECORD など）
    shelfBuildDom(); const on = scene === 'shelf' || scene === 'detail'; const rows = scene === 'shelf' ? shelfRows() : [];
    SH_DOM.back.classList.toggle('is-show', on);
    const showInfo = scene === 'detail' || (scene === 'shelf' && !rows.length);
    SH_DOM.info.classList.toggle('is-show', showInfo);
    SH_DOM.info.classList.toggle('is-empty', scene === 'shelf');
    if (!on) return;
    let html = '';
    if (scene === 'detail' && SHF.sel) {
      const T = CRC.prizes[SHF.sel]; const e = crP().shelf[SHF.sel] || { n: 1, first: 1, from: '' };
      const mkey = Object.keys(CRC.machines).find((k) => CRC.machines[k].short === e.from); const mname = mkey ? CRC.machines[mkey].name : e.from;
      html = '<div class="pi-name">' + T.name + '</div><div class="pi-rec">RECORD <b>×' + e.n + '</b></div><div class="pi-line">FIRST GET　DAY ' + e.first + '</div><div class="pi-from">' + mname + '</div>';
    } else if (scene === 'shelf' && !rows.length) html = '<div class="pi-empty">まだ何もないよ。<br>1Fのクレーンで取ってみよう！</div>';
    if (SH_DOM.info.dataset.h !== html) { SH_DOM.info.innerHTML = html; SH_DOM.info.dataset.h = html; }
    crPlace(SH_DOM.back, { x: 36, y: 328, w: W - 72, h: 30 });
    crPlace(SH_DOM.info, scene === 'detail' ? { x: 10, y: 232, w: W - 20, h: 92 } : { x: 18, y: 130, w: W - 36, h: 70 });
    SH_DOM.info.style.fontSize = Math.max(11, 8.4 * ((canvas.getBoundingClientRect().width - 8) / CW)) + 'px';
  }
  function shelfRoom() {                                          // 木の棚の部屋
    rect(8, 8, W - 16, H - 16, '#1c1209');
    for (let x = 8; x < W - 8; x += 18) { rect(x, 8, 1, H - 16, '#241810'); rect(x + 9, 8, 1, H - 16, '#160e07'); }
    ctx.globalAlpha = 0.5; rect(8, 8, W - 16, 24, '#0a0604'); ctx.globalAlpha = 1;
    rect(30, 11, W - 60, 22, '#2a160a'); rect(30, 11, W - 60, 1, '#ffb868'); rect(30, 32, W - 60, 1, '#ffb868'); rect(30, 11, 1, 22, '#ffb868'); rect(W - 31, 11, 1, 22, '#ffb868');
    drawTextCenter('PRIZE SHELF', W / 2, 18, '#ffe9c0', 2, '#6a3a10');
  }
  function drawShelf() {
    shelfRoom(); const rows = shelfRows(); const per = W >= 190 ? 4 : 3; SHF.cells = [];
    let total = 6; for (const r of rows) total += r.h + 6;
    SHF.contentH = total; const viewH = SHF.viewBot - SHF.viewTop; SHF.scroll = clamp(SHF.scroll, 0, Math.max(0, total - viewH));
    ctx.save(); ctx.beginPath(); ctx.rect(12, SHF.viewTop, W - 24, viewH); ctx.clip();
    let y = SHF.viewTop + 6 - SHF.scroll; const cw = (W - 28) / per;
    for (const r of rows) {
      const n = r.g === 'piyo' ? 3 : per; const cellW = (W - 28) / n; const by = y + r.h - 8;
      rect(14, by, W - 28, 6, '#8a5a2c'); rect(14, by, W - 28, 1, '#c8905a'); rect(14, by + 5, W - 28, 1, '#4a2c12'); rect(14, by + 6, W - 28, 3, '#2a180a');       // 棚の板（かげ）
      ctx.globalAlpha = 0.28; rect(14, y, W - 28, by - y, '#000000'); ctx.globalAlpha = 1;
      r.ids.forEach((id, i) => {
        const cx = 14 + cellW * (i + 0.5); const big = r.g === 'piyo';
        ctx.globalAlpha = 0.45; rect(Math.round(cx - cellW * 0.32), by - 2, Math.round(cellW * 0.64), 2, '#000000'); ctx.globalAlpha = 1;                    // 足元のかげ
        const sz = shelfSprite(id, cx, by, cellW - 8, big ? r.h - 14 : r.h - 16, 0);
        SHF.cells.push({ id, x: cx - sz.w / 2 - 3, y: by - sz.h - 3, w: sz.w + 6, h: sz.h + 8 });
      });
      y += r.h + 6;
    }
    ctx.restore();
    ctx.globalAlpha = 0.6; rect(12, SHF.viewTop, W - 24, 5, '#1c1209'); rect(12, SHF.viewBot - 5, W - 24, 5, '#1c1209'); ctx.globalAlpha = 1;
    const max = Math.max(0, total - viewH); if (max > 0) { const bh = Math.max(14, Math.round(viewH * viewH / total)); const by2 = SHF.viewTop + Math.round((viewH - bh) * (SHF.scroll / max)); ctx.globalAlpha = 0.5; rect(W - 14, by2, 2, bh, '#c8905a'); ctx.globalAlpha = 1; }
    shelfUi();
  }
  function drawPrizeDetail() {
    shelfRoom(); const id = SHF.sel; SHF.bt += 1 / 60;
    for (let i = 0; i < 6; i++) {                                                                                              // やわらかい、あかり（ふちがぼけた楕円。ゆっくり明るさが変わるだけ）
      const k = 1 - i * 0.15; const hw = Math.round((W / 2 - 14) * k); const hh = Math.round(86 * k);
      ctx.globalAlpha = 0.045 + 0.012 * Math.sin(SHF.bt * 1.4);
      for (let r = -hh; r <= hh; r++) { const w = Math.round(hw * Math.sqrt(Math.max(0, 1 - (r * r) / (hh * hh)))); if (w > 0) rect(Math.round(W / 2) - w, 126 + r, w * 2, 1, '#ffd9a0'); }
    }
    ctx.globalAlpha = 1;
    rect(34, 214, W - 68, 6, '#8a5a2c'); rect(34, 214, W - 68, 1, '#c8905a'); rect(34, 219, W - 68, 1, '#4a2c12');                                  // 台
    if (id) { const big = id.indexOf('piyo_') === 0; shelfSprite(id, W / 2, 212, W - 70, big ? 168 : 150, Math.round(Math.sin(SHF.bt * 1.6) * 1.2 + 1.2), true); }
    ctx.globalAlpha = 0.4; rect(Math.round(W / 2) - 36, 211, 72, 3, '#000000'); ctx.globalAlpha = 1;
    shelfUi();
  }
  function shelfDown(p) { SHF.down = { x: p.x, y: p.y, scroll: SHF.scroll }; SHF.dragged = false; }
  function shelfMove(p) { if (!SHF.down) return; const dy = p.y - SHF.down.y; if (Math.abs(dy) > 4) SHF.dragged = true; if (SHF.dragged) SHF.scroll = SHF.down.scroll - dy; }
  function shelfUp(p) {
    const d = SHF.down; SHF.down = null; if (!d || SHF.dragged || scene !== 'shelf') return;
    if (p.y < SHF.viewTop || p.y > SHF.viewBot) return;
    const c = SHF.cells.find((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h);
    if (c) { SHF.sel = c.id; SHF.bt = 0; scene = 'detail'; beep(880, 0, 0.05, 0.04, 'square'); beep(1320, 0.05, 0.08, 0.04, 'square'); updateSceneUi(); }
  }
  function enterShelf() { SHF.scroll = 0; scene = 'shelf'; updateSceneUi(); beep(660, 0, 0.05, 0.04, 'square'); }


  // =====================================================================
  //  B2 RHYTHM CORNER：音ゲーの階。いまは HAPPY BEAT の1台。あと3台は、COMING SOON
  // =====================================================================
  const b2Cabs = () => { const cw = 66; const gx = (W - 24 - cw * 2) / 3; const xs = [Math.round(12 + gx), Math.round(12 + gx * 2 + cw)]; return [{ key: 'hb', x: xs[0], y: 56, w: cw, h: 96 }, { key: 'st', x: xs[1], y: 56, w: cw, h: 96 }, { key: 'td', x: xs[0], y: 160, w: cw, h: 96 }, { key: 'kc', x: xs[1], y: 160, w: cw, h: 96 }]; };
  const b2Down = () => stairDownBox();
  function enterB3() { moveFade(() => { scene = 'b3'; currentMachine = null; updateSceneUi(); stairSfx(1); }); }                 // 5F → 6F
  function leaveB3() { moveFade(() => { scene = 'b2'; updateSceneUi(); stairSfx(-1); }); }                                // 6F → 5F
  const b3Cabs = () => { const g = 4; const cw = Math.floor((W - 24 - 2 * g) / 3); const xs = [12, 12 + cw + g, 12 + 2 * (cw + g)]; const out = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) out.push({ key: r === 0 && c === 0 ? 'br' : r === 0 && c === 1 ? 'nb' : r === 0 && c === 2 ? 'pp' : r === 1 && c === 0 ? 'as' : r === 1 && c === 1 ? 'sz' : r === 1 && c === 2 ? 'deco' : 'soon', name: '', x: xs[c], y: 56 + r * 102, w: cw, h: 96 }); return out; };       // 6F：6台ぶんの枠（いまは、BASKET RUSH だけ）
  function drawB3() {
    drawFrame(); drawBasementBg('b3'); drawFloorHeader(); ctx.save(); drawFloorSign(6);
    for (const c of b3Cabs()) { if (c.key === 'br') drawBrCab(c); else if (c.key === 'nb') drawNbCab(c); else if (c.key === 'pp') drawPpCab(c); else if (c.key === 'as') drawAsCab(c); else if (c.key === 'sz') drawSzCab(c); else if (c.key === 'deco') drawTrophyCase(c); else drawSoonCab(c); }
    ctx.save(); ctx.translate(0, BOTTOM_DY); drawNav(6);
    ctx.restore(); ctx.restore();
  }
  function b3Tap(p) {
    const pb = { x: p.x, y: p.y - BOTTOM_DY };
    for (const c of b3Cabs()) { if (!inRect(p, c)) continue; if (c.key === 'br') { moveFade(() => enterMachine(BR_MACHINE)); return; } if (c.key === 'nb') { moveFade(() => enterMachine(NB_MACHINE)); return; } if (c.key === 'pp') { moveFade(() => enterMachine(PP_MACHINE)); return; } if (c.key === 'as') { moveFade(() => enterMachine(AS_MACHINE)); return; } if (c.key === 'sz') { moveFade(() => enterMachine(SZ_MACHINE)); return; } if (c.key === 'deco') { toast('ピカピカの トロフィーだ！ 🏆'); beep(1319, 0, 0.06, 0.04, 'triangle'); beep(1760, 0.06, 0.08, 0.04, 'triangle'); return; } toast('COMING SOON！'); beep(440, 0, 0.08, 0.04, 'triangle'); return; }
    if (navTap(pb, 6)) return;
  }
  // =====================================================================
  //  7F VIDEO CORNER：ビデオゲームの階。6台ぶんの枠（いまは JEWEL CHAIN だけ。ほかは COMING SOON）
  // =====================================================================
  const b4Cabs = () => { const g = 4; const cw = Math.floor((W - 24 - 2 * g) / 3); const xs = [12, 12 + cw + g, 12 + 2 * (cw + g)]; const out = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) out.push({ key: r === 0 && c === 0 ? 'jc' : r === 0 && c === 1 ? 'bc' : r === 0 && c === 2 ? 'sa' : r === 1 && c === 0 ? 'bd' : r === 1 && c === 1 ? 'nk' : 'soon', name: '', x: xs[c], y: 56 + r * 102, w: cw, h: 96 }); return out; };
  function drawB4() {
    drawFrame(); drawBasementBg('b4'); drawFloorHeader(); ctx.save(); drawFloorSign(7);
    for (const c of b4Cabs()) { if (c.key === 'jc') drawJcCab(c); else if (c.key === 'bc') drawBcCab(c); else if (c.key === 'sa') drawSaCab(c); else if (c.key === 'bd') drawBdCab(c); else if (c.key === 'nk') drawNkCab(c); else drawSoonCab(c); }
    ctx.save(); ctx.translate(0, BOTTOM_DY); drawNav(7);
    ctx.restore(); ctx.restore();
  }
  function b4Tap(p) {
    const pb = { x: p.x, y: p.y - BOTTOM_DY };
    for (const c of b4Cabs()) { if (!inRect(p, c)) continue; if (c.key === 'jc') { moveFade(() => enterMachine(JC_MACHINE)); return; } if (c.key === 'bc') { moveFade(() => enterMachine(BC_MACHINE)); return; } if (c.key === 'sa') { moveFade(() => enterMachine(SA_MACHINE)); return; } if (c.key === 'bd') { moveFade(() => enterMachine(BD_MACHINE)); return; } if (c.key === 'nk') { moveFade(() => enterMachine(NK_MACHINE)); return; } toast('COMING SOON！'); beep(440, 0, 0.08, 0.04, 'triangle'); return; }
    if (navTap(pb, 7)) return;
  }
  function drawJcCab(c) {                                                                                                // 7Fの JEWEL CHAIN 筐体：暗い本体に、5色の宝石が 映える
    const t = animT(); ctx.globalAlpha = 0.18; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#a06aff'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1c1240'); rect(c.x, c.y, c.w, 2, '#a06aff'); rect(c.x, c.y, 2, c.h, '#4a3a9a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#0c0824');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#08041a'); drawTextCenter('JEWEL', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('CHAIN', c.x + c.w / 2 + 0.5, c.y + 13, '#ffe070', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#0e0a22'); for (let k = 0; k < 5; k++) rect(gx + 2 + k * Math.floor((gw - 4) / 5), c.y + 22, Math.floor((gw - 4) / 5) - 1, 2, ['#e0283c', '#2c66e8', '#f4c424', '#22b85a', '#a03ee8'][k]);
    const cols = [[1, 2, 3], [4, 4, 2], [5, 1, 3], [2, 5, 1]]; const cs = Math.floor((gw - 4) / 6); const rows = [[1, 2, 3, 4, 5, 1], [2, 3, 3, 4, 5, 1], [2, 5, 1, 1, 4, 2], [3, 5, 5, 3, 4, 4]]; const sx = gx + 2;
    for (let r = 0; r < rows.length; r++) for (let q = 0; q < 6; q++) jcJewel(rows[r][q], sx + q * cs, gy + 46 - 2 - (rows.length - r) * cs, cs);
    const fy = Math.floor(t * 8) % 3; const fall = (t * 14) % 22; jcJewel(1 + Math.floor(t) % 5, sx + 2 * cs, gy + 2 + fall * 0.5, cs);
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#08041a'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawTrophyCase(c) {                                                                                           // 6Fの かざり：トロフィーケース（スポーツコーナーらしい ドット絵）。タップすると ひとこと
    const t = animT(); const x = c.x; const y = c.y; const w = c.w; const h = c.h; ctx.globalAlpha = 0.18; rect(x - 3, y - 3, w + 6, h + 6, '#ffd840'); ctx.globalAlpha = 1;
    rect(x, y, w, h, '#5a3a1c'); rect(x, y, w, 2, '#a8702a'); rect(x, y, 2, h, '#8a5a28'); rect(x + w - 2, y, 2, h, '#3a2410'); rect(x + 3, y + 4, w - 6, 12, '#2a1a0c'); drawTextCenter('TROPHY', x + w / 2 + 0.5, y + 7, '#ffe070', 1);
    rect(x + 4, y + 19, w - 8, h - 26, '#26385a'); rect(x + 4, y + 19, w - 8, 1, '#8ab0e8'); for (let k = 0; k < 3; k++) { ctx.globalAlpha = 0.12; rect(x + 8 + k * 14, y + 20, 3, h - 28, '#ffffff'); ctx.globalAlpha = 1; }
    for (const sy of [y + 44, y + 66, y + h - 8]) { rect(x + 4, sy, w - 8, 2, '#8a5a28'); rect(x + 4, sy + 2, w - 8, 1, '#3a2410'); }
    const cx = x + w / 2; rect(cx - 7, y + 24, 14, 3, '#ffd840'); rect(cx - 6, y + 27, 12, 6, '#ffd840'); rect(cx - 5, y + 33, 10, 3, '#e8b820'); rect(cx - 2, y + 36, 4, 5, '#e8b820'); rect(cx - 6, y + 41, 12, 3, '#b07a08'); rect(cx - 10, y + 27, 3, 6, '#e8b820'); rect(cx + 7, y + 27, 3, 6, '#e8b820'); rect(cx - 5, y + 28, 2, 4, '#fff3a0');
    [['#ffd840', 10], ['#d8dce8', 24], ['#c8782a', 38]].forEach(([col, dx], i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 4 + dx, y + 54, 4, 0, 6.28); ctx.fill(); rect(x + 3 + dx, y + 58, 2, 5, i % 2 ? '#ff5a5a' : '#5a8aff'); });
    rect(x + 8, y + 71, 8, 10, '#f4f4f4'); rect(x + 8, y + 73, 8, 2, '#d02030'); ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.arc(x + 26, y + 78, 4, 0, 6.28); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 38, y + 78, 3.5, 0, 6.28); ctx.fill(); rect(x + 36, y + 76, 4, 1, '#d02030');
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2.4); drawStar(Math.round(cx + 6), y + 25, '#fff8c0'); ctx.globalAlpha = 1;
  }
  function drawTtCab(c) {                                                                                               // 6Fの PING PONG RALLY 筐体（水色・白・ネイビー）：ボールが往復する
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#8ad8f8'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#3a9ad8'); rect(c.x, c.y, c.w, 2, '#e8f8ff'); rect(c.x, c.y, 2, c.h, '#8ad8f8'); rect(c.x + c.w - 2, c.y, 2, c.h, '#1a5aa8');
    rect(c.x + 3, c.y + 4, c.w - 6, 16, '#0a2a5a'); drawTextCenter('PING PONG', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('RALLY', c.x + c.w / 2 + 0.5, c.y + 13, '#8ad8f8', 1);
    rect(c.x + 5, c.y + 24, c.w - 10, 48, '#0a2a5a'); const cx = c.x + c.w / 2; rect(c.x + 9, c.y + 28, c.w - 18, 40, '#143a8a'); rect(c.x + 9, c.y + 48, c.w - 18, 1, '#f4f8ff'); rect(Math.round(cx), c.y + 28, 1, 40, '#f4f8ff'); rect(c.x + 9, c.y + 28, c.w - 18, 1, '#7ad0f0'); rect(c.x + 9, c.y + 67, c.w - 18, 1, '#7ad0f0');
    const f = (t * 0.9) % 2; const k = f < 1 ? f : 2 - f; const by = c.y + 31 + k * 34; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + Math.sin(t * 1.3) * 8, by, 2.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#e04048'; ctx.beginPath(); ctx.arc(cx + Math.sin(t * 1.1) * 8, c.y + 31, 3.2, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(cx - Math.sin(t * 0.9) * 8, c.y + 65, 3.6, 0, 6.28); ctx.fill();
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0a2a5a'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawSzCab(c) {                                                                                               // 6Fの STRIKE ZONE 筐体（ターコイズ・白・赤）：ボールが ころがる
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#7affee'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#14a8a0'); rect(c.x, c.y, c.w, 2, '#c8fff8'); rect(c.x, c.y, 2, c.h, '#4ad8cc'); rect(c.x + c.w - 2, c.y, 2, c.h, '#0c7a76');
    rect(c.x + 3, c.y + 4, c.w - 6, 16, '#0a3a40'); drawTextCenter('STRIKE', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('ZONE', c.x + c.w / 2 + 0.5, c.y + 13, '#ff6a6a', 1);
    rect(c.x + 5, c.y + 24, c.w - 10, 48, '#d8a65a'); rect(c.x + 5, c.y + 24, 5, 48, '#2a2e34'); rect(c.x + c.w - 10, c.y + 24, 5, 48, '#2a2e34'); for (let i = 0; i < 4; i++) rect(c.x + 11 + i * 8, c.y + 24, 1, 48, '#c4914a');
    for (let row = 0; row < 3; row++) for (let j = 0; j <= row; j++) { rect(Math.round(c.x + c.w / 2 + (j - row / 2) * 7) - 1, c.y + 27 + row * 5, 3, 5, '#f4f4f0'); }
    const f = (t * 0.7) % 1; const by = c.y + 68 - f * 36; const bx = c.x + c.w / 2 + Math.sin(f * 3) * 5; ctx.fillStyle = '#0a5a66'; ctx.beginPath(); ctx.arc(bx, by, 4 - f * 1.5, 0, 6.28); ctx.fill(); ctx.fillStyle = '#1aa6b4'; ctx.beginPath(); ctx.arc(bx - 0.5, by - 0.5, 3.2 - f * 1.2, 0, 6.28); ctx.fill();
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0a3a40'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawAsCab(c) {                                                                                               // 6Fの AIR SMASH 筐体（青・赤・白）：パックが、ゆっくり ゆれる
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#6a9aff'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1c3a8a'); rect(c.x, c.y, c.w, 2, '#9ab8ff'); rect(c.x, c.y, 2, c.h, '#4a72d8'); rect(c.x + c.w - 2, c.y, 2, c.h, '#0e1c50');
    rect(c.x + 3, c.y + 4, c.w - 6, 16, '#0e1c50'); drawTextCenter('AIR', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('SMASH', c.x + c.w / 2 + 0.5, c.y + 13, '#ff6a6a', 1);
    rect(c.x + 6, c.y + 24, c.w - 12, 48, '#f4f6fa'); rect(c.x + 6, c.y + 47, c.w - 12, 1, '#c42028'); rect(c.x + c.w / 2 - 7, c.y + 22, 14, 3, '#1a1a24'); rect(c.x + c.w / 2 - 7, c.y + 71, 14, 3, '#1a1a24');
    const mx = Math.sin(t * 1.4) * 8; const mx2 = Math.sin(t * 1.1 + 2) * 8; ctx.fillStyle = '#e8343c'; ctx.beginPath(); ctx.arc(c.x + c.w / 2 + mx, c.y + 33, 5, 0, 6.28); ctx.fill(); ctx.fillStyle = '#2a6aff'; ctx.beginPath(); ctx.arc(c.x + c.w / 2 + mx2, c.y + 64, 5, 0, 6.28); ctx.fill();
    const pyy = 48 + Math.sin(t * 2.2) * 10; ctx.fillStyle = '#14141c'; ctx.beginPath(); ctx.arc(c.x + c.w / 2 + Math.sin(t * 1.7) * 9, c.y + pyy, 2.8, 0, 6.28); ctx.fill();
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0e1c50'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawPpCab(c) {                                                                                               // 6Fの POWER PUNCH 筐体（赤・黒・シルバー）：パッドが、ゆっくり ゆれる
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#ff5a5a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#c42028'); rect(c.x, c.y, c.w, 2, '#ffb0b0'); rect(c.x, c.y, 2, c.h, '#ff6a6a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#7a1018'); rect(c.x + 3, c.y, 1, c.h, '#b8bec8'); rect(c.x + c.w - 4, c.y, 1, c.h, '#b8bec8');
    rect(c.x + 5, c.y + 4, c.w - 10, 16, '#14080a'); drawTextCenter('POWER', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('PUNCH', c.x + c.w / 2 + 0.5, c.y + 13, '#ff6a6a', 1);
    rect(c.x + 5, c.y + 24, c.w - 10, 40, '#1a0a0e'); rect(c.x + 5, c.y + 24, c.w - 10, 1, '#b8bec8'); rect(c.x + c.w / 2 - 1, c.y + 24, 2, 7, '#9aa0aa');
    const sw = Math.sin(t * 1.6) * 0.18; ctx.save(); ctx.translate(c.x + c.w / 2, c.y + 31); ctx.rotate(sw); ctx.fillStyle = '#b8bec8'; ctx.beginPath(); ctx.arc(0, 14, 13, 0, 6.28); ctx.fill(); ctx.fillStyle = '#e83a40'; ctx.beginPath(); ctx.arc(0, 14, 11, 0, 6.28); ctx.fill(); ctx.fillStyle = '#ff8a8a'; ctx.beginPath(); ctx.arc(-3, 10, 3.5, 0, 6.28); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, 13, 4, 1); ctx.fillRect(-0.5, 11.5, 1, 4); ctx.restore();
    rect(c.x + 8, c.y + 68, c.w - 16, 12, '#0a0a10'); for (let i = 0; i < 3; i++) { rect(c.x + 11 + i * 12, c.y + 70, 8, 8, i === 1 && Math.sin(t * 2) > -0.5 ? '#ff2a2a' : '#4a1010'); }
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#14080a'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawNbCab(c) {                                                                                               // 6Fの NICE BATTING 筐体（深い緑・白・赤）：ボールが、奥から手前へ
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#4aa86a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1f4a30'); rect(c.x, c.y, c.w, 2, '#9ad8b0'); rect(c.x, c.y, 2, c.h, '#3a7a50'); rect(c.x + c.w - 2, c.y, 2, c.h, '#123020');
    rect(c.x + 3, c.y + 4, c.w - 6, 18, '#0e2418'); drawTextCenter('NICE', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('BATTING', c.x + c.w / 2 + 0.5, c.y + 14, '#ff6a6a', 1);
    rect(c.x + 4, c.y + 26, c.w - 8, 42, '#10281a'); rect(c.x + 4, c.y + 26, c.w - 8, 1, '#5aa878'); for (let k = 0; k < 6; k++) { rect(c.x + 4 + k * 8, c.y + 27, 1, 40, '#2a5a3a'); }
    for (const [dx, dy, rr, col] of [[0, 32, 4, '#d02030'], [-9, 42, 4, '#f4f4f4'], [9, 42, 4, '#f4f4f4'], [0, 52, 4, '#9ad8a8']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x + c.w / 2 + dx, c.y + dy, rr, 0, 6.28); ctx.fill(); }
    const f = (t * 0.9) % 1; const bx = c.x + c.w / 2 - 6 + f * 8; const by = c.y + 40 + f * 22; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bx, by, 1.5 + f * 2.5, 0, 6.28); ctx.fill();
    rect(c.x + 8, c.y + c.h - 34, 20, 4, '#d02030'); rect(c.x + 8, c.y + c.h - 34, 20, 1, '#ff8a8a'); rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0e2418'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawBrCab(c) {                                                                                               // 6Fの BASKET RUSH 筐体（オレンジ・白・黒）：ボールが、はねる
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#ff8a1a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#e8782a'); rect(c.x, c.y, c.w, 2, '#ffd0a0'); rect(c.x, c.y, 2, c.h, '#ffa860'); rect(c.x + c.w - 2, c.y, 2, c.h, '#b85a10');
    rect(c.x + 3, c.y + 4, c.w - 6, 18, '#1a0a04'); drawTextCenter('BASKET', c.x + c.w / 2 + 0.5, c.y + 6, '#ffffff', 1); drawTextCenter('RUSH', c.x + c.w / 2 + 0.5, c.y + 14, '#ff8a1a', 1);
    rect(c.x + 4, c.y + 26, c.w - 8, 42, '#2a1408'); rect(c.x + 4, c.y + 26, c.w - 8, 1, '#ffb060');
    const gx0 = c.x + c.w / 2; rect(gx0 - 11, c.y + 30, 22, 11, '#f4f4f4'); rect(gx0 - 6, c.y + 33, 12, 6, '#ff7a1a'); rect(gx0 - 9, c.y + 42, 18, 2, '#ff6a1a'); for (let k = 0; k < 4; k++) rect(gx0 - 8 + k * 5, c.y + 44, 1, 7, '#f4f4f4');
    const bb = Math.abs(Math.sin(t * 2.6)); const by = c.y + 62 - Math.round(bb * 14); ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.arc(gx0, by, 4, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx0 - 4, by); ctx.lineTo(gx0 + 4, by); ctx.moveTo(gx0, by - 4); ctx.lineTo(gx0, by + 4); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ff8a1a'; ctx.beginPath(); ctx.arc(c.x + 9 + i * ((c.w - 18) / 3), c.y + 74, 3.5, 0, 6.28); ctx.fill(); }
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#1a0a04'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function enterB2() { moveFade(() => { scene = 'b2'; currentMachine = null; updateSceneUi(); stairSfx(1); }); }
  function leaveB2() { moveFade(() => { scene = 'center'; centerFloor = FLOORS.length - 1; updateSceneUi(); stairSfx(-1); }); }       // 5F → 4F
  function b2Tap(p) {
    const pb = { x: p.x, y: p.y - BOTTOM_DY };
    for (const c of b2Cabs()) {
      if (!inRect(p, c)) continue;
      if (c.key === 'hb') { moveFade(() => enterMachine(HB_MACHINE)); return; }
      if (c.key === 'st') { moveFade(() => enterMachine(ST_MACHINE)); return; }
      if (c.key === 'kc') { moveFade(() => enterMachine(KC_MACHINE)); return; }
      if (c.key === 'td') { moveFade(() => enterMachine(TD_MACHINE)); return; }
      toast((c.name || '') + '　COMING SOON！'); beep(440, 0, 0.08, 0.04, 'triangle'); return;
    }
    if (inRect(pb, VM_DRINK_RECT)) { enterVending('drink_machine'); return; }
    if (inRect(pb, VM_ICE_RECT)) { enterVending('ice_machine'); return; }
    if (navTap(pb, 5)) return;
  }
  function drawTdCab(c) {                                                                   // 5Fの TOP DRIVER 筐体：道路のすじが流れ、車が左右にゆれ、CPU車が近づく。ハンドルも回る
    ctx.globalAlpha = 0.18; rect(c.x - 4, c.y - 4, c.w + 8, c.h + 8, '#ff5a3a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1a1a24'); rect(c.x, c.y, c.w, 2, '#ff5a3a'); rect(c.x, c.y, 2, c.h, '#3a2a30'); rect(c.x + c.w - 2, c.y, 2, c.h, '#3a2a30');
    drawTextCenter('TOP', c.x + c.w / 2 + 0.5, c.y + 4, '#ffd84a', 1); drawTextCenter('DRIVER', c.x + c.w / 2 + 0.5, c.y + 11, '#ff7a4a', 1);
    const sx = c.x + 7; const sy = c.y + 20; const sw = c.w - 14; const sh = 34; rect(sx, sy, sw, sh, '#4aa8ff'); rect(sx, sy + 12, sw, sh - 12, '#3fb04a');
    ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
    const bend = Math.sin(animT() * 0.7) * 6;
    for (let r = 0; r < sh - 12; r++) { const t = r / (sh - 12); const half = 2 + r * 0.55; const ox = Math.round(bend * (1 - t) * (1 - t) * -1); const cx = sx + sw / 2 + ox; rect(Math.round(cx - half), sy + 12 + r, Math.round(half * 2), 1, r % 4 < 2 ? '#707080' : '#646472'); const dash = Math.floor((r * 0.9 + animT() * 18) / 4) % 2 === 0; if (dash && r > 1) rect(Math.round(cx), sy + 12 + r, 1, 1, '#ffffff'); rect(Math.round(cx - half), sy + 12 + r, 1, 1, (Math.floor(r / 3 + animT() * 8) % 2) ? '#ff4a4a' : '#ffffff'); rect(Math.round(cx + half) - 1, sy + 12 + r, 1, 1, (Math.floor(r / 3 + animT() * 8) % 2) ? '#ff4a4a' : '#ffffff'); }
    const pcp = (animT() * 0.45) % 1; const cy2 = sy + 14 + pcp * (sh - 20); const cw2 = 3 + pcp * 6; rect(Math.round(sx + sw * 0.62 - cw2 / 2 + bend * (1 - pcp) * -0.6), Math.round(cy2), Math.round(cw2), Math.max(2, Math.round(cw2 * 0.55)), '#3a8cff');                                                                                // 近づく CPU車
    const px2 = Math.round(sx + sw / 2 + Math.sin(animT() * 1.3) * sw * 0.2); rect(px2 - 4, sy + sh - 8, 9, 5, '#ff3a5a'); rect(px2 - 3, sy + sh - 11, 7, 3, '#c02040'); rect(px2 - 4, sy + sh - 4, 2, 2, '#101018'); rect(px2 + 3, sy + sh - 4, 2, 2, '#101018');                                                                                // 左右にゆれる、自分の車
    ctx.restore(); rect(sx, sy, sw, 1, '#ffffff');
    rect(c.x + 8, c.y + 60, c.w - 16, 22, '#26262e'); ctx.save(); ctx.translate(c.x + c.w / 2, c.y + 71); ctx.rotate(Math.sin(animT() * 1.3) * 0.6); ctx.strokeStyle = '#6a6a88'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.28); ctx.stroke(); ctx.fillStyle = '#ff3a5a'; ctx.fillRect(-1, -9, 3, 4); ctx.restore();
    for (let i = 0; i < 4; i++) rect(c.x + 8 + i * 13, c.y + c.h - 9, 10, 3, i % 2 ? '#ff5a3a' : '#ffd84a');
  }
  function drawKcCab(c) {                                                                   // 5Fの KAWAII CLUB 筐体：ハートが、ふわっと大きくなったり小さくなったり
    ctx.globalAlpha = 0.2; rect(c.x - 4, c.y - 4, c.w + 8, c.h + 8, '#ff9ac0'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#fff4f8'); rect(c.x, c.y, c.w, 2, '#ffb0cc'); rect(c.x, c.y, 2, c.h, '#ffc8dc'); rect(c.x + c.w - 2, c.y, 2, c.h, '#ffc8dc');
    rect(c.x + 4, c.y + 4, c.w - 8, 24, '#ffd0e2'); rect(c.x + 4, c.y + 4, c.w - 8, 1, '#ffffff');
    drawTextCenter('KAWAII', c.x + c.w / 2 + 0.5, c.y + 7, '#ff5a9a', 1); drawTextCenter('CLUB', c.x + c.w / 2 + 0.5, c.y + 14, '#ff5a9a', 2, '#ffffff');
    const pu = 0.5 + 0.5 * Math.sin(animT() * 3.2); kcBitsDraw(ctx, 'heart', c.x + 9, c.y + 9, 5 + 2 * pu); kcBitsDraw(ctx, 'heart', c.x + c.w - 9, c.y + 9, 7 - 2 * pu);
    rect(c.x + 8, c.y + 34, c.w - 16, 30, '#ffe6ef'); rect(c.x + 10, c.y + 36, c.w - 20, 26, '#fff'); ctx.globalAlpha = 0.2 + 0.2 * pu; rect(c.x + 10, c.y + 36, c.w - 20, 26, '#ff9ac0'); ctx.globalAlpha = 1;
    ctx.save(); ctx.beginPath(); ctx.rect(c.x + 10, c.y + 36, c.w - 20, 26); ctx.clip();
    for (let i = 0; i < 3; i++) { const ph = ((animT() * 0.5 + i / 3) % 1); ctx.globalAlpha = Math.sin(Math.PI * ph) * 0.7; kcBitsDraw(ctx, 'heart', c.x + 16 + i * 17 + Math.sin(animT() + i) * 2, c.y + 60 - ph * 24, 5); ctx.globalAlpha = 1; }          // ふわっと のぼる、小さなハート
    kcBitsDraw(ctx, 'heart', c.x + c.w / 2, c.y + 49, 9 + 7 * pu);                                                                                       // 大きくなったり、小さくなったり
    ctx.restore();
    drawTextCenter('PHOTO', c.x + c.w / 2 + 0.5, c.y + 68, '#d0608a', 1); drawTextCenter('YEN 100', c.x + c.w / 2 + 0.5, c.y + 76, '#d0608a', 1);
    for (let i = 0; i < 4; i++) rect(c.x + 8 + i * 13, c.y + c.h - 9, 10, 3, i % 2 ? '#ffc8dc' : '#ffffff');
  }
  function drawStCab(c) {                                                                   // 5Fの SPARK TAP 筐体：光が、パネルをうつりながら、光ったり消えたり
    ctx.globalAlpha = 0.16; rect(c.x - 4, c.y - 4, c.w + 8, c.h + 8, '#3a6aff'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#0a1020'); rect(c.x, c.y, c.w, 2, '#5a8aff'); rect(c.x, c.y, 2, c.h, '#2a3a6a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#2a3a6a');
    drawTextCenter('SPARK TAP', c.x + c.w / 2 + 0.5, c.y + 5, '#9fe8ff', 1, '#10102a');
    const gx = c.x + 8; const gy = c.y + 17; const pw = Math.floor((c.w - 16 - 4) / 3); const ph = Math.floor((c.h - 50) / 3);
    const path = [0, 1, 2, 5, 4, 3, 6, 7, 8]; const rate = 2.6; const step = Math.floor(animT() * rate); const f = (animT() * rate) % 1; const cur = step % 9; const ease = f * f * (3 - 2 * f);
    for (let i = 0; i < 9; i++) {
      const x = gx + (i % 3) * (pw + 2); const y = gy + Math.floor(i / 3) * (ph + 2); rect(x, y, pw, ph, '#0e1a30');
      const k = path.indexOf(i); const age = ((cur - k + 9) % 9) + f;                                          // 光が通ってから、どれだけたったか
      let v = Math.max(0, 1 - age * 0.34); if (k === (cur + 1) % 9) v = Math.max(v, ease * 0.9);              // つぎの光は、ふわっと明るくなる
      const tw = 0.5 + 0.5 * Math.sin(animT() * 0.9 + i * 2.3); const idle = 0.05 + 0.1 * tw * tw;               // ほかのパネルは、ゆっくり、うっすら
      ctx.globalAlpha = Math.min(1, idle + v * 0.9); rect(x, y, pw, ph, v > 0.7 ? '#ffffff' : i % 3 === 0 ? '#7ad8ff' : '#5aa8ff'); ctx.globalAlpha = 1;
    }
    const a = path[cur]; const b2 = path[(cur + 1) % 9]; const ax = gx + (a % 3) * (pw + 2); const ay = gy + Math.floor(a / 3) * (ph + 2); const bx = gx + (b2 % 3) * (pw + 2); const by2 = gy + Math.floor(b2 / 3) * (ph + 2);
    const fx = Math.round(ax + (bx - ax) * ease); const fy = Math.round(ay + (by2 - ay) * ease); rect(fx - 1, fy - 1, pw + 2, 1, '#ffffff'); rect(fx - 1, fy + ph, pw + 2, 1, '#ffffff'); rect(fx - 1, fy - 1, 1, ph + 2, '#ffffff'); rect(fx + pw, fy - 1, 1, ph + 2, '#ffffff');          // うつっていく光の枠
    rect(c.x + 8, c.y + c.h - 18, c.w - 16, 4, '#1a2a50'); for (let i = 0; i < 4; i++) rect(c.x + 10 + i * 11, c.y + c.h - 10, 8, 3, i % 2 ? '#3a6aff' : '#9fe8ff');
  }
  function drawBdCab(c) {                                                                                                // 7Fの BULL DARTS 筐体：黒×赤緑のボード
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#ff4a4a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1a1010'); rect(c.x, c.y, c.w, 2, '#ff4a4a'); rect(c.x, c.y, 2, c.h, '#5a2a2a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#0a0505');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#0a0505'); drawTextCenter('BULL', c.x + c.w / 2 + 0.5, c.y + 6, '#ff5a5a', 1); drawTextCenter('DARTS', c.x + c.w / 2 + 0.5, c.y + 13, '#3ad870', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#0a0505'); const cx = gx + gw / 2; const cy = gy + 23; const R = Math.min(gw / 2 - 1, 21);
    const ring = (r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
    ring(R, '#111'); ring(R - 1, '#e8d8a8'); ring(R * 0.8, '#3ad870'); ring(R * 0.7, '#e8d8a8'); ring(R * 0.45, '#ff4a4a'); ring(R * 0.34, '#e8d8a8'); ring(R * 0.2, '#3ad870'); ring(R * 0.1, '#ff4a4a');
    const k = (t * 0.8) % 1; const dx = cx + 2 + (1 - k) * 14; const dy = cy - 1 + (1 - k) * 18; if (k > 0.05) { rect(dx, dy, 1, 1, '#ffd84a'); rect(dx + 1, dy + 1, 4, 1, '#c0c8d8'); rect(dx + 4, dy + 1, 2, 3, '#ff4a4a'); }
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0a0505'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawNkCab(c) {                                                                                                // 7Fの NINE BREAK 筐体：深い緑のテーブルと 9番ボール
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#3affb0'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#08180f'); rect(c.x, c.y, c.w, 2, '#3affb0'); rect(c.x, c.y, 2, c.h, '#1a5a3a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#020a05');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#020a05'); drawTextCenter('NINE', c.x + c.w / 2 + 0.5, c.y + 6, '#7affc8', 1); drawTextCenter('BREAK', c.x + c.w / 2 + 0.5, c.y + 13, '#ffe070', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#4a2a12'); rect(gx + 2, gy + 2, gw - 4, 42, '#1b8050');
    const ball = (x, y, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }; const bx = gx + gw / 2; ball(bx, gy + 10, '#f2c200'); ball(bx - 3, gy + 15, '#1f48c8'); ball(bx + 3, gy + 15, '#d62a2a'); ball(bx, gy + 20, '#f4f4f4'); ctx.fillStyle = '#f2c200'; ctx.fillRect(bx - 2, gy + 19, 5, 2);
    const k = (t * 0.7) % 1; ball(bx, gy + 38 - k * 10, '#ffffff'); for (const p of [[gx + 2, gy + 2], [gx + gw - 2, gy + 2], [gx + 2, gy + 44], [gx + gw - 2, gy + 44]]) ball(p[0], p[1], '#05080a');
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#020a05'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  // =====================================================================
  //  8F GHOST CORNER：お化けパニック（アーケード版）の階。いまは 1台だけ。ほかは COMING SOON
  // =====================================================================
  const b5Cabs = () => b4Cabs().map((c, i) => Object.assign(c, { key: i === 0 ? 'gp' : i === 1 ? 'rk' : i === 2 ? 'hy' : i === 3 ? 'hh' : 'soon' }));
  function drawB5() {
    drawFrame(); drawBasementBg('b5'); drawFloorHeader(); ctx.save(); drawFloorSign(8);
    for (const c of b5Cabs()) { if (c.key === 'gp') drawGpCab(c); else if (c.key === 'rk') drawRkCab(c); else if (c.key === 'hy') drawHyCab(c); else if (c.key === 'hh') drawHhCab(c); else drawSoonCab(c); }
    ctx.save(); ctx.translate(0, BOTTOM_DY); drawNav(8);
    ctx.restore(); ctx.restore();
  }
  function b5Tap(p) {
    const pb = { x: p.x, y: p.y - BOTTOM_DY };
    for (const c of b5Cabs()) { if (!inRect(p, c)) continue; if (c.key === 'gp') { moveFade(() => enterMachine(GP_MACHINE)); return; } if (c.key === 'rk') { moveFade(() => enterMachine(RK_MACHINE)); return; } if (c.key === 'hy') { moveFade(() => enterMachine(HY_MACHINE)); return; } if (c.key === 'hh') { moveFade(() => enterMachine(MH_MACHINE)); return; } toast('COMING SOON！'); beep(440, 0, 0.08, 0.04, 'triangle'); return; }
    if (navTap(pb, 8)) return;
  }
  function drawGpCab(c) {                                                                                                // 8Fの GHOST PANIC 筐体：夜空に ゴールドゴースト
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#c8a0ff'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1a0c34'); rect(c.x, c.y, c.w, 2, '#c8a0ff'); rect(c.x, c.y, 2, c.h, '#4a2a7a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#0a0418');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#0a0418'); drawTextCenter('GHOST', c.x + c.w / 2 + 0.5, c.y + 6, '#c8a0ff', 1); drawTextCenter('PANIC', c.x + c.w / 2 + 0.5, c.y + 13, '#ffe070', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#0c0420'); for (let i = 0; i < 6; i++) rect(gx + 4 + (i * 17) % (gw - 8), gy + 3 + (i * 11) % 38, 1, 1, '#d8c8ff');
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; const gi = gpImg('gold_ghost'); const wi = ci('ghost_white'); const bob = Math.round(Math.sin(t * 2.4) * 2);
    if (wi) ctx.drawImage(wi, gx + 3, gy + 18 + bob, 20, 21); if (gi) { ctx.drawImage(gi, gx + gw - 28, gy + 6 + bob, 24, 26); } ctx.imageSmoothingEnabled = sm;
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0a0418'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawRkCab(c) {                                                                                                // 8Fの GO! GO! ROCKET 筐体：赤・黄・青のおもちゃっぽい測定機
    const t = animT(); ctx.globalAlpha = 0.25; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#ffd84a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#d8282a'); rect(c.x, c.y, c.w, 2, '#ff8a7a'); rect(c.x, c.y, 2, c.h, '#ff5a4a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#7a0e14');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#1a2a8a'); drawTextCenter('GO! GO!', c.x + c.w / 2 + 0.5, c.y + 6, '#ffe070', 1); drawTextCenter('ROCKET', c.x + c.w / 2 + 0.5, c.y + 13, '#ffffff', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#2a6ad8'); rect(gx, gy + 36, gw, 10, '#3aa04a'); for (let i = 0; i < 5; i++) rect(gx + 4 + (i * 13) % (gw - 8), gy + 3 + (i * 9) % 22, 1, 1, '#ffffff');
    const by = Math.round(Math.sin(t * 5) * 1.5); const rx = Math.round(gx + gw / 2); rkDrawRocket(rx, gy + 22 + by, 0.5, 0.6 + 0.4 * Math.sin(t * 12), 0);
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#1a2a8a'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawHyCab(c) {                                                                                                // 8Fの HYAKKI YAKO 筐体：夜の町に 一つ目小僧と 提灯
    const t = animT(); ctx.globalAlpha = 0.25; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#ff5a4a'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#1a0c1c'); rect(c.x, c.y, c.w, 2, '#ff5a4a'); rect(c.x, c.y, 2, c.h, '#5a2030'); rect(c.x + c.w - 2, c.y, 2, c.h, '#0a040c');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#0a040c'); drawTextCenter('HYAKKI', c.x + c.w / 2 + 0.5, c.y + 6, '#ff7a6a', 1); drawTextCenter('YAKO', c.x + c.w / 2 + 0.5, c.y + 13, '#ffe070', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#14102e'); rect(gx, gy + 36, gw, 10, '#2a1c24'); rect(gx + gw - 12, gy + 3, 7, 6, '#f4ecc8'); rect(gx + 4, gy + 20, 12, 16, '#3a2418'); rect(gx + 6, gy + 24, 8, 8, '#ffd890');
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; const a = hyImg('hitotsume'); const b = hyImg('chochin'); const bob = Math.round(Math.sin(t * 2.4) * 2);
    if (a) ctx.drawImage(a, gx + gw / 2 - 6, gy + 14 + bob, 14, 25); if (b) ctx.drawImage(b, gx + gw - 18, gy + 8 - bob, 12, 17); ctx.imageSmoothingEnabled = sm;
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#0a040c'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawHhCab(c) {                                                                                                // 8Fの MYSTERY HOUSE（旧 HORROR HOUSE）筐体：暗い洋館。ひとつだけ灯る窓と、赤い ハイヒール
    const t = animT(); ctx.globalAlpha = 0.22; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#7a5aff'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#0c0a18'); rect(c.x, c.y, c.w, 2, '#7a5aff'); rect(c.x, c.y, 2, c.h, '#2c2450'); rect(c.x + c.w - 2, c.y, 2, c.h, '#05040c');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#05040c'); drawTextCenter('MYSTERY', c.x + c.w / 2 + 0.5, c.y + 6, '#e8c078', 1); drawTextCenter('HOUSE', c.x + c.w / 2 + 0.5, c.y + 13, '#b8a0ff', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#0a0c1e'); rect(gx + 3, gy + 6, gw - 6, 32, '#14142c'); rect(gx + gw / 2 - 7, gy + 2, 14, 8, '#14142c'); rect(gx, gy + 38, gw, 8, '#06060e');
    rect(gx + 6, gy + 14, 5, 7, '#ffd890'); rect(gx + gw - 11, gy + 14, 5, 7, '#2a2a4a'); rect(gx + gw / 2 - 2, gy + 26, 5, 12, '#05040c'); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 1.3); rect(gx + gw / 2 - 2, gy + 14, 5, 7, '#9ad0ff'); ctx.globalAlpha = 1;
    rect(gx + gw / 2 - 5, gy + 40, 3, 4, '#d01830'); rect(gx + gw / 2 + 2, gy + 40, 3, 4, '#d01830');
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#05040c'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawSaCab(c) {                                                                                                // 7Fの SEA ATTACK 筐体：深い青の海。クラゲ・イカ・カニの ドット
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#30a0ff'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#06183a'); rect(c.x, c.y, c.w, 2, '#30a0ff'); rect(c.x, c.y, 2, c.h, '#1a4a8a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#020a1e');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#010510'); drawTextCenter('SEA', c.x + c.w / 2 + 0.5, c.y + 6, '#7dfcff', 1); drawTextCenter('ATTACK', c.x + c.w / 2 + 0.5, c.y + 13, '#ff9a5a', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#010510'); const ef = Math.floor(t * 2) % 2; const kk = ['jelly', 'squid', 'crab']; const off = Math.sin(t * 1.4) * 3;
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) saSprDraw(SA_SPR[kk[r]][ef], gx + 3 + q * 10 + off + 2, gy + 3 + r * 9, SA_COL[kk[r]]);
    rect(gx + 4, gy + 34, 8, 3, '#ff7a9a'); rect(gx + gw - 12, gy + 34, 8, 3, '#ff7a9a'); rect(gx + gw / 2 - 1, gy + 40, 3, 4, '#e8eef8'); rect(gx + gw / 2 - 3, gy + 42, 7, 3, '#e8eef8');
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#010510'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawBcCab(c) {                                                                                                // 7Fの BLOCK CRASH 筐体：黒×ネオン。ブロックと ボールの かざり（キャラなし）
    const t = animT(); ctx.globalAlpha = 0.2; rect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, '#18d8f0'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#0a0f2a'); rect(c.x, c.y, c.w, 2, '#18d8f0'); rect(c.x, c.y, 2, c.h, '#1a4a8a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#04061a');
    rect(c.x + 3, c.y + 4, c.w - 6, 17, '#02030c'); drawTextCenter('BLOCK', c.x + c.w / 2 + 0.5, c.y + 6, '#18d8f0', 1); drawTextCenter('CRASH', c.x + c.w / 2 + 0.5, c.y + 13, '#f040d0', 1);
    const gx = c.x + 5; const gy = c.y + 24; const gw = c.w - 10; rect(gx, gy, gw, 46, '#02030c'); const cols = ['#18d8f0', '#f040d0', '#ffd820', '#ff8a20']; const bw = Math.floor((gw - 2) / 6);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) rect(gx + 1 + q * bw, gy + 3 + r * 5, bw - 1, 4, cols[r]);
    const bx = gx + gw / 2 + Math.sin(t * 1.7) * (gw * 0.32); const by = gy + 26 + Math.abs(Math.sin(t * 2.3)) * 12; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(gx + gw / 2 + Math.sin(t * 1.2) * 12, by, 1.6, 0, 6.2832); ctx.fill();
    rect(Math.round(bx - 7), gy + 42, 14, 2, '#e8eef8'); rect(Math.round(bx - 7), gy + 42, 2, 2, '#18d8f0'); rect(Math.round(bx + 5), gy + 42, 2, 2, '#18d8f0');
    rect(c.x + 4, c.y + c.h - 16, c.w - 8, 8, '#02030c'); drawTextCenter('PLAY', c.x + c.w / 2 - 6, c.y + c.h - 14, '#ffffff', 1); drawTextCenter('100', c.x + c.w / 2 + 11, c.y + c.h - 14, '#ffd84a', 1);
  }
  function drawSoonCab(c) {
    rect(c.x, c.y, c.w, c.h, '#1a1428'); rect(c.x, c.y, c.w, 2, '#4a3a6a'); rect(c.x, c.y, 2, c.h, '#2a2040'); rect(c.x + c.w - 2, c.y, 2, c.h, '#2a2040');
    rect(c.x + 6, c.y + 14, c.w - 12, c.h - 36, '#0a0812'); rect(c.x + 6, c.y + 14, c.w - 12, 1, '#3a2a5a');
    ctx.globalAlpha = 0.5 + 0.2 * softPulse(1.4, c.x); drawTextCenter('?', c.x + c.w / 2 + 0.5, c.y + 36, '#6a5a8a', 4); ctx.globalAlpha = 1;
    drawTextCenter(c.name || 'COMING', c.x + c.w / 2 + 0.5, c.y + 4, '#a89acc', 1); drawTextCenter('COMING', c.x + c.w / 2 + 0.5, c.y + c.h - 24, '#8a7aaa', 1); drawTextCenter('SOON', c.x + c.w / 2 + 0.5, c.y + c.h - 17, '#8a7aaa', 1);
    for (let i = 0; i < 4; i++) rect(c.x + 8 + i * 13, c.y + c.h - 8, 10, 4, '#2a2040');
  }
  function drawB2() {
    drawFrame(); const dx = W - 180;
    drawBasementBg('b2');
    drawFloorHeader(); ctx.save(); drawFloorSign(5);
    for (const c of b2Cabs()) { if (c.key === 'hb') drawHbCab(c); else if (c.key === 'st') drawStCab(c); else if (c.key === 'kc') drawKcCab(c); else if (c.key === 'td') drawTdCab(c); else drawSoonCab(c); }
    ctx.save(); ctx.translate(0, BOTTOM_DY); drawNav(5);
    drawVendCab(VM_MACHINES[0], VM_DRINK_RECT); drawVendCab(VM_MACHINES[1], VM_ICE_RECT); drawBench(VM_BENCH_RECT); drawTextCenter('REST', 62, 244, '#a8b8e8', 1);        // 休憩コーナー（5F：DRINK・ICE・ベンチ。ただの買い物で、ゲームへの効果は、ない）
    ctx.restore();
    ctx.restore();
  }

  function openShelf() {
    const sh = crP().shelf; const ids = Object.keys(sh);
    const lines = [{ text: 'PRIZE SHELF', cls: 'head' }];
    if (!ids.length) lines.push({ text: 'まだ何もないよ。 1Fのクレーンで取ってみよう！', cls: 'dim' });
    else {
      lines.push({ text: '集めた景品　' + ids.length + '種類', cls: 'gold' });
      ids.forEach((id) => { const T = CRC.prizes[id]; const e = sh[id]; if (T) lines.push({ cols: [T.name + (e.n > 1 ? '　×' + e.n : ''), e.from + ' / DAY ' + e.first] }); });
    }
    showDialog({ title: '景品棚', card: true, wide: true, lines, buttons: [{ label: '閉じる', primary: true }] });
  }
  function drawHbCab(c) {                                                                   // B2の、♪HAPPY BEAT の筐体：パンダが、拍に合わせて踊る
    ctx.globalAlpha = 0.18; rect(c.x - 4, c.y - 4, c.w + 8, c.h + 8, '#ff7ac0'); ctx.globalAlpha = 1;
    rect(c.x, c.y, c.w, c.h, '#2a1450'); rect(c.x, c.y, c.w, 2, '#ff7ac0'); rect(c.x, c.y + 2, c.w, 1, '#62d6ff'); rect(c.x, c.y, 2, c.h, '#ff9ad4'); rect(c.x + c.w - 2, c.y, 2, c.h, '#62d6ff');
    drawTextCenter('HAPPY BEAT', c.x + c.w / 2 + 0.5, c.y + 5, '#ffffff', 1, '#10101c');
    const sx = c.x + 6; const sy = c.y + 15; const sw = c.w - 12; const sh = c.h - 34; rect(sx, sy, sw, sh, '#150a30');
    const beat = animT() * 2.4;                                                                                // 拍（BPM144）に合わせる
    ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
    for (let i = 0; i < 6; i++) { const bh = 8 + Math.round(14 * (0.5 + 0.5 * Math.sin(beat * 3.1 + i * 1.3))); ctx.globalAlpha = 0.45; rect(sx + 3 + i * Math.floor(sw / 6), sy + sh - 14 - bh, Math.floor(sw / 6) - 2, bh, i % 2 ? '#62d6ff' : '#ff7ac0'); ctx.globalAlpha = 1; }          // イコライザー
    for (let i = 0; i < 6; i++) { const on = (Math.floor(beat) + i) % 2 === 0; rect(sx + i * Math.floor(sw / 6), sy + sh - 6, Math.floor(sw / 6), 6, on ? '#ff7ac0' : '#62d6ff'); }                                                                                       // ひかる床
    const idx = [1, 2, 3, 2][Math.floor(beat) % 4]; const hgt = Math.round(sh * 0.48); const bob = Math.round(Math.abs(Math.sin(Math.PI * (beat % 1))) * 3);
    for (const [col, px0, flip] of [['pink', sx + 5, 0], ['blue', sx + sw - 5, 1]]) {
      const im = HB_IMG[col + idx]; if (!im || !im.complete || !im.naturalWidth) continue; const w = Math.round(hgt * im.naturalWidth / im.naturalHeight);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, flip ? px0 - w : px0, sy + sh - 6 - hgt - bob, w, hgt); ctx.restore();
    }
    ctx.restore();
    for (let i = 0; i < 4; i++) rect(c.x + 8 + i * 13, c.y + c.h - 16, 10, 5, i % 2 ? '#62d6ff' : '#ff7ac0');
    rect(c.x + 8, c.y + c.h - 8, c.w - 16, 3, '#10102a');
  }
  function drawBasementBg(kind) {
    const dx = W - 180;
    if (kind === 'b4' || kind === 'b5') {                                                                       // 7F：ビデオゲームコーナー。ネイビーの壁・ネオンの青とピンクの帯・ひし形の絨毯
      rect(8, 8, W - 16, FLOOR_TOP - 12, '#0e1030');
      for (let x = 14; x < W - 8; x += 24) { rect(x, 12, 1, FLOOR_TOP - 16, '#161a44'); }
      rect(8, 60, W - 16, 5, '#2ad0ff'); rect(8, 60, W - 16, 1, '#a8f0ff'); rect(8, 232, W - 16, 5, '#ff4aa8'); rect(8, 232, W - 16, 1, '#ffb0dc');
      rect(8, 8, W - 16, 22, '#080a20'); for (let x = 14; x < W - 24; x += 46) { rect(x, 18, 30, 3, '#c8e8ff'); ctx.globalAlpha = 0.07 + 0.02 * softPulse(1.2, x); rect(x - 4, 21, 38, 100, '#8ab8ff'); ctx.globalAlpha = 1; }
      rect(8, FLOOR_TOP - 4, W - 16, 4, '#3a2a8a');
      for (let y = FLOOR_TOP; y < H - 10; y += 8) for (let x = 8; x < W - 8; x += 16) rect(x + ((y / 8) % 2 ? 8 : 0), y, 16, 8, ((x + y) / 8) % 2 ? '#2a1a5a' : '#221450');
      for (let x = 10; x < W - 12; x += 16) rect(x, 352, 8, 2, '#6a8aff');
      return;
    }
    if (kind === 'b3') {                                                                       // 6F：スポーツコーナー。コートのような木の床・オレンジの帯・白いライン
      rect(8, 8, W - 16, FLOOR_TOP - 12, '#241408');
      for (let x = 14; x < W - 8; x += 24) { rect(x, 12, 1, FLOOR_TOP - 16, '#2e1a0a'); }
      rect(8, 60, W - 16, 5, '#e8782a'); rect(8, 60, W - 16, 1, '#ffb060'); rect(8, 232, W - 16, 5, '#e8782a'); rect(8, 232, W - 16, 1, '#ffb060');
      rect(8, 8, W - 16, 22, '#150c04'); for (let x = 14; x < W - 24; x += 46) { rect(x, 18, 30, 3, '#fff0c8'); ctx.globalAlpha = 0.07 + 0.02 * softPulse(1.2, x); rect(x - 4, 21, 38, 100, '#ffd890'); ctx.globalAlpha = 1; }
      rect(8, FLOOR_TOP - 4, W - 16, 4, '#8a4a14');
      for (let y = FLOOR_TOP; y < H - 10; y += 8) for (let x = 8; x < W - 8; x += 16) rect(x + ((y / 8) % 2 ? 8 : 0), y, 16, 8, ((x + y) / 8) % 2 ? '#c8782a' : '#bc6c20');
      for (let x = 10; x < W - 12; x += 16) rect(x, 352, 8, 2, '#f4f4f4');
      return;
    }
    if (kind === 'b1') {                                                                       // B1：地下の倉庫。コンクリートの壁・配管・蛍光灯
      rect(8, 8, W - 16, FLOOR_TOP - 12, '#121a2e');
      for (let x = 14; x < W - 8; x += 24) { rect(x, 12, 1, FLOOR_TOP - 16, '#1a2540'); rect(x + 12, 12, 1, FLOOR_TOP - 16, '#161f36'); }
      for (const py of [60, 232]) {                                                            // 横の配管（リベットつき）
        rect(8, py, W - 16, 5, '#26324f'); rect(8, py, W - 16, 1, '#3a4a70'); rect(8, py + 4, W - 16, 1, '#161f36');
        for (let x = 18; x < W - 12; x += 22) rect(x, py + 1, 2, 2, '#4a5a80');
      }
      rect(8, 8, W - 16, 22, '#0e1424');                                                       // 天井
      for (let x = 14; x < W - 24; x += 46) { rect(x, 18, 30, 3, '#cfe8ff'); ctx.globalAlpha = 0.07 + 0.02 * softPulse(1.2, x); rect(x - 4, 21, 38, 100, '#9fc8ff'); ctx.globalAlpha = 1; }   // 蛍光灯（ゆっくり）
      rect(8, FLOOR_TOP - 4, W - 16, 4, '#202a44');
      for (let y = FLOOR_TOP; y < H - 10; y += 8) for (let x = 8; x < W - 8; x += 8) rect(x, y, 8, 8, ((x + y) / 8) % 2 ? '#222c46' : '#192138');
      for (let x = 12; x < W - 14; x += 14) rect(x, 352, 8, 2, '#3a4a70');                       // 通路のライン
    } else {                                                                                  // B2：音楽の部屋。ネオンの柱・スピーカー・イコライザー
      rect(8, 8, W - 16, FLOOR_TOP - 12, '#150f32');
      for (let i = 0, x = 22; x < W - 14; i++, x += 30) {                                      // ネオンの縦の帯（ゆっくり明るさがかわるだけ）
        ctx.globalAlpha = 0.24 + 0.08 * Math.sin(animT() * 0.9 + i); rect(x, 12, 3, FLOOR_TOP - 16, i % 2 ? '#62d6ff' : '#ff7ac0'); ctx.globalAlpha = 1;
      }
      for (let i = 0, x = 12; x < W - 24; i++, x += 9) {                                       // イコライザー（壁のシルエット）
        const hh = Math.round(22 + 26 * (0.5 + 0.5 * Math.sin(animT() * 1.1 + i * 0.7)));
        ctx.globalAlpha = 0.26; rect(x, FLOOR_TOP - 4 - hh, 6, hh, i % 2 ? '#62d6ff' : '#ff7ac0'); ctx.globalAlpha = 1;
      }
      for (const sx of [10, W - 28]) { rect(sx, 190, 18, 68, '#0a0818'); rect(sx, 190, 18, 1, '#3a2a6a'); rect(sx + 3, 196, 12, 12, '#1a1236'); rect(sx + 5, 198, 8, 8, '#2a1c52'); rect(sx + 3, 218, 12, 12, '#1a1236'); rect(sx + 5, 220, 8, 8, '#2a1c52'); rect(sx + 3, 238, 12, 12, '#1a1236'); rect(sx + 5, 240, 8, 8, '#2a1c52'); }   // スピーカー
      rect(8, 8, W - 16, 22, '#0a0818');
      for (let x = 20; x < W - 30; x += 40) { ctx.globalAlpha = 0.05 + 0.02 * softPulse(1.1, x); rect(x - 6, 24, 36, 90, '#c8a0ff'); ctx.globalAlpha = 1; }
      rect(8, FLOOR_TOP - 4, W - 16, 2, '#ff7ac0'); rect(8, FLOOR_TOP - 2, W - 16, 2, '#62d6ff');                                  // 床ぎわのネオン
      for (let y = FLOOR_TOP; y < H - 10; y += 8) for (let x = 8; x < W - 8; x += 8) rect(x, y, 8, 8, ((x + y) / 8) % 2 ? '#2a1e58' : '#1e1442');
    }
  }
  function drawB1() {
    drawFrame(); const dx = W - 180;
    drawBasementBg('b1');
    drawFloorHeader(); ctx.save(); drawFloorSign(1);
    for (const c of b1Cabs()) {
      if (c.key === null) {                                                    // 景品棚
        rect(c.x, c.y + 16, c.w, 62, '#2a1e18'); rect(c.x, c.y + 16, c.w, 2, '#6a4a30'); rect(c.x + 2, c.y + 20, c.w - 4, 54, '#120c0a');
        const sh = crP().shelf; const ids = Object.keys(sh).slice(0, 6);
        ids.forEach((id, i) => { const img = crImg(id); if (img) { const w = 14; const h = Math.round(w * img.naturalHeight / img.naturalWidth); ctx.drawImage(img, c.x + 4 + (i % 3) * 15, c.y + 24 + Math.floor(i / 3) * 24 + (14 - Math.min(14, h)), w, Math.min(14, h)); } });
        rect(c.x + 2, c.y + 46, c.w - 4, 1, '#6a4a30'); drawTextCenter('SHELF', c.x + c.w / 2 + 0.5, c.y + 4, '#ffd090', 1);
        continue;
      }
      const M = CRC.machines[c.key]; const st = crP().machines[c.key];
      ctx.globalAlpha = 0.16; rect(c.x - 4, c.y - 4, c.w + 8, c.h + 8, M.color); ctx.globalAlpha = 1;
      rect(c.x, c.y, c.w, c.h, mixHex(M.color, '#10101c', 0.55)); rect(c.x, c.y, c.w, 2, M.color); rect(c.x, c.y, 2, c.h, mixHex(M.color, '#ffffff', 0.2));
      rect(c.x + 4, c.y + 14, c.w - 8, c.h - 36, '#07050f'); rect(c.x + 4, c.y + 14, c.w - 8, 1, '#8a8aa8');
      const ids = (st ? st.prizes.slice(0, 5).map((q) => q.t) : M.lineup.slice(0, 4).map((x) => x[0]));
      ids.forEach((id, i) => { const img = crImg(id); if (!img) return; const big = c.key === 'piyo'; const w = big ? 22 : 12; const h = Math.round(w * img.naturalHeight / img.naturalWidth); ctx.drawImage(img, c.x + 6 + (i % 3) * (big ? 0 : 13) + (big ? 8 : 0), c.y + c.h - 24 - h - Math.floor(i / 3) * (big ? 0 : 10), w, h); });
      drawTextCenter(M.short, c.x + c.w / 2 + 0.5, c.y + 4, '#ffffff', 1, '#10101c');
      rect(c.x + 8, c.y + c.h - 16, 12, 10, '#05030a'); rect(c.x + 8, c.y + c.h - 16, 12, 1, '#ffd040'); rect(c.x + c.w - 22, c.y + c.h - 16, 14, 8, '#2a2a40');
      if (st && st.news && crDay() - st.news < 1) { rect(c.x + c.w - 24, c.y - 6, 26, 9, '#ff5a6a'); drawText('NEW!', c.x + c.w - 22, c.y - 4, '#ffffff', 1); }
    }
    ctx.save(); ctx.translate(0, BOTTOM_DY);
    drawGachaCab(GACHA_RECT);                                                                                           // ガチャガチャ（1Fの左）
    drawRecordExit();
    drawNav(1);
    ctx.restore();
    ctx.restore();
  }

