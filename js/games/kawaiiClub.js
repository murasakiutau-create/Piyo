'use strict';
  // =====================================================================
  //  📸 KAWAII CLUB（プリントシール機）
  //   アバターを選ぶ → 背景を選ぶ → 1枚撮影（¥100）→ スタンプと手書きでデコる → チェキ風の写真にして RECORD へ保存
  //   写真は「アバターID・背景ID・スタンプ・ペンの線・DAY」の、再現できる編集データとして保存（画像そのものは、保存しない）。座標は、写真の中の 0〜1（線は、×1000の整数）
  // =====================================================================
  const KCC = CONFIG.kawaiiClub;
  const KC_MACHINE = { machineId: 'kc_kawaiiclub', machineName: 'KAWAII CLUB', label: 'KAWAII CLUB', isUnlocked: true, gameType: 'kawaiiClub', kc: true };
  const KC_AVATARS = Array.from({ length: 8 }, (_, i) => ({ id: 'avatar0' + (i + 1), file: 'assets/kawaii/avatar0' + (i + 1) + '.webp', poses: ['normal'] }));       // いまは、1アバター1ポーズ。あとで、poses を増やせる形
  const KC_IMG = {};
  KC_AVATARS.forEach((a) => { const im = new Image(); im.src = a.file; KC_IMG[a.id] = im; });
  const kcImgOk = (im) => !!im && im.complete && im.naturalWidth > 0;
  const KC_SIL = {};                                                                              // 暗い背景のとき、アバターに、ごく軽い白いふち（シルエット）
  function kcSilhouette(id) {
    if (KC_SIL[id]) return KC_SIL[id]; const im = KC_IMG[id]; if (!kcImgOk(im)) return null;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); KC_SIL[id] = c; return c;
  }
  // ---- スタンプ（データで足せる）：prize＝景品の絵（CRC.prizes）／panda＝HAPPY BEAT のパンダ／bits＝ドット絵の記号／sign＝NEW COSMO の看板 ----
  const KC_BITS = {
    heart: { c: '#ff5a9a', r: ['..XX..XX..', '.XXXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'] },
    star: { c: '#ffd84a', r: ['....XX....', '....XX....', '...XXXX...', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '.XXX..XXX.', '.XX....XX.'] },
    sparkle: { c: '#fff6a8', r: ['....XX....', '....XX....', '....XX....', 'XXXXXXXXXX', 'XXXXXXXXXX', '....XX....', '....XX....', '....XX....'] },
    note: { c: '#5ab8ff', r: ['...XXXXXX.', '...XXXXXX.', '...XX..XX.', '...XX..XX.', '...XX..XX.', '.XXXX.XXXX', 'XXXXX.XXXX', '.XX....XX.'] },
    exclam: { c: '#ff6a8a', r: ['...XX...', '...XX...', '...XX...', '...XX...', '...XX...', '........', '...XX...', '...XX...'] },
    question: { c: '#9a8aff', r: ['..XXXX..', '.XXXXXX.', 'XX....XX', '.....XX.', '....XX..', '...XX...', '........', '...XX...'] }
  };
  const KC_STAMPS = [
    { id: 'newcosmo', kind: 'sign' }, { id: 'heart', kind: 'bits' }, { id: 'star', kind: 'bits' }, { id: 'sparkle', kind: 'bits' }, { id: 'note', kind: 'bits' }, { id: 'exclam', kind: 'bits' }, { id: 'question', kind: 'bits' },
    { id: 'piyo', kind: 'prize', src: 'piyo_normal' }, { id: 'piyoRibbon', kind: 'prize', src: 'piyo_ribbon' }, { id: 'piyoCrown', kind: 'prize', src: 'piyo_crown' },
    { id: 'pinkPanda', kind: 'panda', src: 'pink1' }, { id: 'bluePanda', kind: 'panda', src: 'blue1' },
    { id: 'slimeBaby', kind: 'prize', src: 's_baby' }, { id: 'slimeAqua', kind: 'prize', src: 's_aqua' }, { id: 'slimeLeaf', kind: 'prize', src: 's_leaf' }, { id: 'slimeFire', kind: 'prize', src: 's_fire' }, { id: 'slimeGold', kind: 'prize', src: 's_gold' }, { id: 'slimeRainbow', kind: 'prize', src: 's_rainbow' },
    { id: 'duck1', kind: 'prize', src: 'd_takuan' }, { id: 'duck2', kind: 'prize', src: 'd_penguin' }, { id: 'duck3', kind: 'prize', src: 'd_torimomo' },
    { id: 'ham1', kind: 'prize', src: 'h_cha' }, { id: 'ham2', kind: 'prize', src: 'h_gray' }, { id: 'ham3', kind: 'prize', src: 'h_shiro' },
    { id: 'ghost1', kind: 'prize', src: 'g_white' }, { id: 'ghost2', kind: 'prize', src: 'g_purple' }, { id: 'pumpkin', kind: 'prize', src: 'p_pumpkin' },
    { id: 'fish1', kind: 'prize', src: 'f_small' }, { id: 'fish2', kind: 'prize', src: 'f_gold' }, { id: 'fish3', kind: 'prize', src: 'f_octo' }
  ];
  const KC_STAMP_BY = {}; KC_STAMPS.forEach((st) => { KC_STAMP_BY[st.id] = st; });
  // ---- ドット文字（ゲームのドットフォント）を、好きな絵（オフスクリーン）へ描く ----
  function kcText(g, str, x, y, color, scale) {
    g.fillStyle = color; let cx = x; const sc = Math.max(1, Math.round(scale || 1));
    for (const ch of String(str)) { const gl = GLYPHS[ch] || GLYPHS[' ']; for (let i = 0; i < 15; i++) if (gl[i] === '1') g.fillRect(Math.round(cx + (i % 3) * sc), Math.round(y + Math.floor(i / 3) * sc), sc, sc); cx += 4 * sc; }
    return cx - x - sc;
  }
  let kcSignCv = null;
  function kcSign() {
    if (kcSignCv) return kcSignCv; const c = document.createElement('canvas'); c.width = 84; c.height = 24; const g = c.getContext('2d');
    g.fillStyle = '#120a24'; g.fillRect(0, 0, 84, 24); g.fillStyle = '#c85a90'; g.fillRect(0, 0, 84, 1); g.fillRect(0, 23, 84, 1); g.fillRect(0, 0, 1, 24); g.fillRect(83, 0, 1, 24); g.globalAlpha = 0.3; g.fillStyle = '#ff5ca8'; g.fillRect(2, 2, 80, 20); g.globalAlpha = 1;
    kcText(g, 'GAME CENTER', 20, 4, '#ffb8dc', 1); kcText(g, 'NEW COSMO', 6, 11, '#ffd0ec', 2); kcSignCv = c; return c;
  }
  function kcBitsDraw(g, key, cx, cy, size) {
    const b = KC_BITS[key]; const rows = b.r; const cw = rows[0].length; const ch = rows.length; const s = size / Math.max(cw, ch); g.fillStyle = b.c;
    for (let r = 0; r < ch; r++) for (let q = 0; q < cw; q++) if (rows[r][q] === 'X') g.fillRect(cx - (cw * s) / 2 + q * s, cy - (ch * s) / 2 + r * s, s + 0.4, s + 0.4);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(cx - (cw * s) / 2 + s, cy - (ch * s) / 2 + s, s, s);
  }
  function kcStampDraw(g, stId, cx, cy, size, rotDeg) {                                           // スタンプを、中心 (cx,cy)・大きさ size（長いほうの辺）・回転 rotDeg で描く
    const st = KC_STAMP_BY[stId]; if (!st) return true; let ok = true;
    g.save(); g.translate(cx, cy); g.rotate((rotDeg || 0) * Math.PI / 180); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (st.kind === 'bits') kcBitsDraw(g, st.id, 0, 0, size);
    else if (st.kind === 'sign') { const c = kcSign(); const w = size * 1.5; g.imageSmoothingEnabled = false; g.drawImage(c, -w / 2, -w * 24 / 84 / 2, w, w * 24 / 84); }
    else if (st.kind === 'panda') { const im = HB_IMG[st.src]; if (kcImgOk(im)) { const k = size / Math.max(im.naturalWidth, im.naturalHeight); g.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); } else ok = false; }
    else { const im = crImg(st.src); const cr = im ? crCrop(st.src) : null; if (im && cr) { const k = size / Math.max(cr.sw, cr.sh); g.drawImage(im, cr.sx, cr.sy, cr.sw, cr.sh, -cr.sw * k / 2, -cr.sh * k / 2, cr.sw * k, cr.sh * k); } else ok = false; }
    g.restore(); return ok;
  }
  const kcBg = (id) => KCC.backgrounds.find((b) => b.id === id) || KCC.backgrounds[0];
  function kcDrawStrokes(g, strokes, x, y, w, h) {                                                // 手書き：なめらかな、丸い線（写真の四角の中だけに描く）
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (const st of strokes) {
      const p = st.p; if (!p || p.length < 2) continue; g.strokeStyle = st.c; g.fillStyle = st.c; g.lineWidth = Math.max(1, st.w * w); g.lineCap = 'round'; g.lineJoin = 'round';
      if (p.length < 4) { g.beginPath(); g.arc(x + p[0] / 1000 * w, y + p[1] / 1000 * h, g.lineWidth / 2, 0, 6.283); g.fill(); continue; }
      g.beginPath(); g.moveTo(x + p[0] / 1000 * w, y + p[1] / 1000 * h);
      for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2; const my = (p[i + 1] + p[i + 3]) / 2; g.quadraticCurveTo(x + p[i] / 1000 * w, y + p[i + 1] / 1000 * h, x + mx / 1000 * w, y + my / 1000 * h); }
      g.lineTo(x + p[p.length - 2] / 1000 * w, y + p[p.length - 1] / 1000 * h); g.stroke();
    }
    g.restore();
  }
  // ---- 写真（背景＋アバター＋スタンプ＋手書き）を、ある四角の中に描く。プレビューも、RECORDも、同じ関数 ----
  function kcDrawPhotoArea(g, ph, x, y, w, h) {
    let ok = true; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const bg = kcBg(ph.backgroundId); g.fillStyle = bg.color; g.fillRect(x, y, w, h);
    const im = KC_IMG[ph.avatarId];                                                              // アバター：写真として、いちばんかわいく見える固定位置（下そろえ・中央）
    if (kcImgOk(im)) {
      let ah = h * 0.9; let aw = ah * im.naturalWidth / im.naturalHeight; if (aw > w * 0.9) { aw = w * 0.9; ah = aw * im.naturalHeight / im.naturalWidth; }
      const ax = x + (w - aw) / 2; const ay = y + h - ah; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const lum = (parseInt(bg.color.slice(1, 3), 16) * 0.3 + parseInt(bg.color.slice(3, 5), 16) * 0.59 + parseInt(bg.color.slice(5, 7), 16) * 0.11) / 255;
      if (lum < 0.3) { const sil = kcSilhouette(ph.avatarId); if (sil) { g.globalAlpha = 0.4; const d = Math.max(1, Math.round(w / 150)); for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d]]) g.drawImage(sil, ax + ox, ay + oy, aw, ah); g.globalAlpha = 1; } }
      g.drawImage(im, ax, ay, aw, ah);
    } else ok = false;
    for (const s of ph.stamps) if (!kcStampDraw(g, s.s, x + s.x * w, y + s.y * h, KCC.stampBase * w * s.k, s.r)) ok = false;
    kcDrawStrokes(g, ph.strokes, x, y, w, h);
    g.restore(); return ok;
  }
  const KC_CHEKI = { side: 0.06, top: 0.06, bottom: 0.25 };                                       // チェキの白いふち：下だけ広い
  const kcPhotoDims = (w) => { const pw = w * (1 - 2 * KC_CHEKI.side); const phh = pw * KCC.photoAspect; return { pw, ph: phh, total: w * KC_CHEKI.top + phh + w * KC_CHEKI.bottom }; };
  function kcDrawCheki(g, ph, x, y, w) {                                                          // チェキ風：白いふち＋写真＋「GAME CENTER NEW COSMO」「DAY ○」の自動印字
    const d = kcPhotoDims(w); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(Math.round(x + 2), Math.round(y + 2), Math.round(w), Math.round(d.total)); g.fillStyle = '#fffdf6'; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(d.total));
    const px0 = x + w * KC_CHEKI.side; const py0 = y + w * KC_CHEKI.top; const ok = kcDrawPhotoArea(g, ph, px0, py0, d.pw, d.ph);
    const sc = w >= 150 ? 2 : 1; const ty = py0 + d.ph + w * 0.05;
    kcText(g, 'GAME CENTER', px0, ty, '#8a6a7a', 1); kcText(g, 'NEW COSMO', px0, ty + 7 * (sc === 2 ? 1 : 1), '#d0608a', sc);
    const ds = 'DAY ' + ph.day; const dw = ds.length * 4 * sc; kcText(g, ds, px0 + d.pw - dw, ty + (sc === 2 ? 20 : 15), '#6a5a8a', sc);
    return ok;
  }
  // ---- 状態 ----
  const KC = {
    phase: 'coin', paid: false, avatarIdx: 0, bgIdx: 0, ph: null, mode: 'stamp', sel: -1, penColor: 4, penW: 1, history: [], page: 0, drag: null, cur: null, t: 0, clock: 0, flashT: 0, banner: 0, lastPhoto: null,
    album: { scroll: 0, items: [], down: null, dragged: false, view: null, cache: {} }, dev: { coords: false }, sheet: false, last: null, lastStamp: -1
  };
  const kcPhotos = () => P_().photos;
  function kcNew() { return { id: 'photo_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), day: P_().day, avatarId: KC_AVATARS[KC.avatarIdx].id, backgroundId: KCC.backgrounds[KC.bgIdx].id, stamps: [], strokes: [], createdAt: Date.now() }; }
  const kcFrame = () => { const h = KC.phase === 'deco' ? 0 : 0; return h; };
  function kcPhotoRect() {                                                                        // デコ画面の、写真の位置（できるだけ大きく）
    const w = Math.min(W - 24, Math.floor((H - 40 - 124) / KCC.photoAspect)); const h = Math.round(w * KCC.photoAspect); return { x: Math.round((W - w) / 2), y: 36, w, h };
  }
  function kcSnap() { KC.history.push(JSON.stringify({ s: KC.ph.stamps, k: KC.ph.strokes })); if (KC.history.length > 60) KC.history.shift(); }
  function kcUndo() { if (!KC.history.length) return; const o = JSON.parse(KC.history.pop()); KC.ph.stamps = o.s; KC.ph.strokes = o.k; KC.sel = -1; beep(440, 0, 0.05, 0.04, 'triangle'); }
  function kcAddStamp(id) {
    if (KC.ph.stamps.length >= KCC.stampMax) { toast('スタンプがいっぱいだよ'); return; } kcSnap();
    const jitter = (KC.ph.stamps.length % 5) * 0.03; KC.ph.stamps.push({ s: id, x: 0.5 + jitter - 0.06, y: 0.38 + jitter, k: 1, r: 0 }); KC.sel = KC.ph.stamps.length - 1; beep(1175, 0, 0.05, 0.04, 'triangle'); beep(1568, 0.05, 0.05, 0.04, 'triangle');
  }
  function kcPack() {                                                                             // 保存用に、数を丸める（座標は、小数3桁。線は、×1000の整数）
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return { id: KC.ph.id, day: KC.ph.day, avatarId: KC.ph.avatarId, backgroundId: KC.ph.backgroundId, createdAt: KC.ph.createdAt, stamps: KC.ph.stamps.map((s) => ({ s: s.s, x: r3(s.x), y: r3(s.y), k: r3(s.k), r: Math.round(s.r) })), strokes: KC.ph.strokes.map((st) => ({ c: st.c, w: st.w, p: st.p.slice() })) };
  }
  function kcSimplify(p) {                                                                        // 点を、まびく（近すぎる点を、のぞく）
    const out = [p[0], p[1]]; let lx = p[0]; let ly = p[1];
    for (let i = 2; i < p.length - 2; i += 2) { if (Math.hypot(p[i] - lx, p[i + 1] - ly) >= KCC.minDist * 1000) { out.push(p[i], p[i + 1]); lx = p[i]; ly = p[i + 1]; } }
    out.push(p[p.length - 2], p[p.length - 1]); return out.length > 600 ? out.filter((_, i) => i < 2 || i >= out.length - 2 || Math.floor(i / 2) % 2 === 0) : out;
  }
  function kcSavePhoto(ph) { P_().photos.push(ph); writeSave(); }
  // ---- 流れ ----
  function kcCharge() {
    if (P_().money < KCC.price) { toast('お金が足りないよ（¥' + KCC.price + ' 要るよ）'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return false; }
    chargeYen(KCC.price); writeSave(); return true;
  }
  function kcInsert() {                                                                           // コインを入れる（¥100・MONEYのみ）。連打しても1回だけ
    if (KC.phase !== 'coin' || KC.paid) return; if (!kcCharge()) return;
    KC.paid = true; KC.phase = 'avatar'; KC.t = 0; beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); setMessage('', C.cyan);
  }
  function kcShoot() {                                                                            // 撮影へ（お金は、コインを入れたときに もう はらってある）
    if (!KC.paid) { KC.phase = 'coin'; return; }
    KC.paid = false; KC.ph = kcNew(); KC.history = []; KC.sel = -1; KC.mode = 'stamp'; KC.page = 0; KC.phase = 'ready'; KC.t = 0; beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05);
  }
  function kcFinishDeco() {
    showDialog({ title: 'できあがり？', lines: [{ text: 'この写真で、 完成にしますか？', cls: '' }], buttons: [
      { label: '完成！', primary: true, onClick: () => { const packed = kcPack(); kcSavePhoto(packed); KC.lastPhoto = packed; KC.phase = 'saved'; KC.t = 0; [784, 988, 1175, 1568, 1976].forEach((f, i) => beep(f, i * 0.08, 0.1, 0.05, 'triangle')); setTimeout(() => beep(1568, 0, 0.06, 0.04), 700); } },
      { label: 'まだデコる' } ] });
  }
  function kcAskReset() {
    showDialog({ title: 'ぜんぶ消す？', lines: [{ text: 'デコレーションを、 全部消しますか？', cls: '' }, { text: '（背景とアバターは、そのままだよ）', cls: 'dim' }], buttons: [
      { label: '消す', primary: true, onClick: () => { kcSnap(); KC.ph.stamps = []; KC.ph.strokes = []; KC.sel = -1; beep(330, 0, 0.1, 0.04, 'triangle'); } }, { label: 'やめる' } ] });
  }
  function kcUpdate(dt) {
    KC.clock += dt; const ph = KC.phase;
    if (ph === 'ready') { KC.t += dt; if (KC.t > 1.1) { KC.phase = 'count'; KC.t = 0; } }
    else if (ph === 'count') { const was = Math.floor(KC.t / 0.7); KC.t += dt; const k = Math.floor(KC.t / 0.7); if (k !== was && k < 3) beep(880 + k * 110, 0, 0.08, 0.05, 'square'); if (KC.t >= 2.1) { KC.phase = 'flash'; KC.t = 0; beep(2093, 0, 0.05, 0.06, 'square'); beep(1568, 0.04, 0.08, 0.06, 'square'); noise(0.12, 0.05); } }
    else if (ph === 'flash') { KC.t += dt; if (KC.t > 0.9) { KC.phase = 'deco'; KC.t = 0; KC.banner = 1.4; beep(1319, 0, 0.08, 0.05, 'triangle'); beep(1760, 0.08, 0.12, 0.05, 'triangle'); } }
    else if (ph === 'deco') { KC.banner = Math.max(0, KC.banner - dt); }
    else if (ph === 'saved') KC.t += dt;
  }
  // ---- 入力 ----
  const kcIn = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function kcToolRects() {                                                                        // デコ画面の、ボタン類の位置
    const pr = kcPhotoRect(); const y0 = pr.y + pr.h + 6; const gw = W - 24; const bw = Math.floor((gw - 4 * 3) / 5); const names = ['STAMP', 'PEN', 'UNDO', 'RESET', 'FINISH'];
    const row = names.map((n, i) => ({ k: n, x: 12 + i * (bw + 3), y: y0, w: bw, h: 16 }));
    const out = { row }; const y1 = y0 + 20;
    if (KC.mode === 'stamp') {
      out.sel = []; if (KC.sel >= 0) { const labs = ['TURN-', 'TURN+', 'DEL']; const sw = Math.floor((gw - 2 * 3) / 3); labs.forEach((k, i) => out.sel.push({ k, x: 12 + i * (sw + 3), y: y1, w: sw, h: 14 })); }
      const per = 10; const cols = 5; const ax = 18; const px0 = 12 + ax; const pw = gw - ax * 2; const cw = Math.floor((pw - (cols - 1) * 3) / cols); const py = y1 + 18; out.pal = []; const maxPage = Math.ceil(KC_STAMPS.length / per) - 1; KC.page = clamp(KC.page, 0, maxPage); out.maxPage = maxPage; out.per = per;
      for (let i = 0; i < per; i++) { const si = KC.page * per + i; if (si >= KC_STAMPS.length) break; out.pal.push({ id: KC_STAMPS[si].id, x: px0 + (i % cols) * (cw + 3), y: py + Math.floor(i / cols) * 22, w: cw, h: 20 }); }
      out.prev = { x: 12, y: py, w: ax - 2, h: 42 }; out.next = { x: W - 12 - (ax - 2), y: py, w: ax - 2, h: 42 };
    } else {
      out.colors = KCC.penColors.map((c, i) => ({ i, c, x: 12 + i * Math.floor(gw / 8), y: y1 + 4, w: Math.floor(gw / 8) - 3, h: 18 }));
      out.widths = [0, 1, 2].map((i) => ({ i, x: 12 + i * 52, y: y1 + 30, w: 48, h: 20 }));
    }
    return out;
  }
  function kcStampAt(p) {
    const pr = kcPhotoRect(); for (let i = KC.ph.stamps.length - 1; i >= 0; i--) { const s = KC.ph.stamps[i]; const r = KCC.stampBase * pr.w * s.k * 0.62 + 4; if (Math.hypot(p.x - (pr.x + s.x * pr.w), p.y - (pr.y + s.y * pr.h)) <= r) return i; } return -1;
  }
  function kcPointer(e, p) {
    if (KC.sheet) { KC.sheet = false; return; }
    if (KC.phase === 'avatar') { const g = kcAvGrid(); for (let i = 0; i < 8; i++) if (kcIn(p, g[i])) { KC.avatarIdx = i; beep(988, 0, 0.05, 0.04, 'triangle'); } return; }
    if (KC.phase === 'bg') { const g = kcBgGrid(); for (let i = 0; i < 8; i++) if (kcIn(p, g[i])) { KC.bgIdx = i; beep(784, 0, 0.05, 0.04, 'triangle'); } return; }
    if (KC.phase !== 'deco' || KC.banner > 0.9) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    const pr = kcPhotoRect(); const T = kcToolRects(); KC.last = { x: p.x, y: p.y };
    if (KC.mode === 'stamp' && KC.sel >= 0 && KC.ph.stamps[KC.sel]) {                              // 選んでいるスタンプの、四角の右上の「つまみ」：ドラッグで、大きさを変える
      const s0 = KC.ph.stamps[KC.sel]; const hr = KCC.stampBase * pr.w * s0.k * 0.62; const hx = pr.x + s0.x * pr.w + hr; const hy = pr.y + s0.y * pr.h - hr;
      if (Math.hypot(p.x - hx, p.y - hy) <= 11) { kcSnap(); KC.drag = { type: 'resize', id: e.pointerId }; beep(880, 0, 0.03, 0.03, 'triangle'); return; }
    }
    for (const b of T.row) if (kcIn(p, b)) {
      beep(660, 0, 0.04, 0.04, 'square');
      if (b.k === 'STAMP') KC.mode = 'stamp'; else if (b.k === 'PEN') { KC.mode = 'pen'; KC.sel = -1; } else if (b.k === 'UNDO') kcUndo(); else if (b.k === 'RESET') kcAskReset(); else if (b.k === 'FINISH') kcFinishDeco(); return;
    }
    if (kcIn(p, { x: pr.x - 6, y: pr.y - 6, w: pr.w + 12, h: pr.h + 12 })) {                    // 写真の上
      if (KC.mode === 'pen') {
        const nx = clamp(Math.round((p.x - pr.x) / pr.w * 1000), -50, 1050); const ny = clamp(Math.round((p.y - pr.y) / pr.h * 1000), -50, 1050);
        if (KC.ph.strokes.length >= KCC.strokeMax) { toast('線がいっぱいだよ'); return; } KC.cur = { id: e.pointerId, c: KCC.penColors[KC.penColor], w: KCC.penWidths[KC.penW], p: [nx, ny] };
      } else { const i = kcStampAt(p); if (i >= 0) { KC.sel = i; const s = KC.ph.stamps[i]; KC.drag = { type: 'move', id: e.pointerId, dx: p.x - (pr.x + s.x * pr.w), dy: p.y - (pr.y + s.y * pr.h), moved: false, snapped: false }; } else KC.sel = -1; }
      return;
    }
    if (KC.mode === 'stamp') {
      for (const b of T.sel) if (kcIn(p, b) && KC.sel >= 0) {
        const s = KC.ph.stamps[KC.sel]; kcSnap(); beep(880, 0, 0.04, 0.04, 'square');
        if (b.k === 'TURN-') s.r -= 15; else if (b.k === 'TURN+') s.r += 15; else if (b.k === 'DEL') { KC.ph.stamps.splice(KC.sel, 1); KC.sel = -1; } return;
      }
      for (const b of T.pal) if (kcIn(p, b)) { kcAddStamp(b.id); return; }
      if (kcIn(p, T.prev)) { KC.page = KC.page <= 0 ? T.maxPage : KC.page - 1; beep(520, 0, 0.04, 0.04, 'square'); } else if (kcIn(p, T.next)) { KC.page = KC.page >= T.maxPage ? 0 : KC.page + 1; beep(620, 0, 0.04, 0.04, 'square'); }
    } else {
      for (const b of T.colors) if (kcIn(p, b)) { KC.penColor = b.i; beep(1047 + b.i * 60, 0, 0.04, 0.04, 'triangle'); return; }
      for (const b of T.widths) if (kcIn(p, b)) { KC.penW = b.i; beep(700 + b.i * 120, 0, 0.04, 0.04, 'triangle'); return; }
    }
  }
  function kcPointerMove(e, p) {
    if (KC.phase !== 'deco') return; const pr = kcPhotoRect(); KC.last = { x: p.x, y: p.y };
    if (KC.cur && KC.cur.id === e.pointerId) { const nx = clamp(Math.round((p.x - pr.x) / pr.w * 1000), -50, 1050); const ny = clamp(Math.round((p.y - pr.y) / pr.h * 1000), -50, 1050); const q = KC.cur.p; if (Math.hypot(nx - q[q.length - 2], ny - q[q.length - 1]) >= 4) q.push(nx, ny); }
    else if (KC.drag && KC.drag.type === 'resize' && KC.drag.id === e.pointerId && KC.sel >= 0) {
      const s = KC.ph.stamps[KC.sel]; const d = Math.hypot(p.x - (pr.x + s.x * pr.w), p.y - (pr.y + s.y * pr.h)); s.k = clamp(d / (Math.SQRT2 * KCC.stampBase * pr.w * 0.62), 0.3, 3.2);        // 中心から つまみまでの きょりで、大きさが決まる
    }
    else if (KC.drag && KC.drag.id === e.pointerId && KC.sel >= 0) {
      const s = KC.ph.stamps[KC.sel]; if (!KC.drag.snapped) { kcSnap(); KC.drag.snapped = true; }
      s.x = clamp((p.x - KC.drag.dx - pr.x) / pr.w, 0.04, 0.96); s.y = clamp((p.y - KC.drag.dy - pr.y) / pr.h, 0.04, 0.96); KC.drag.moved = true;      // 写真の外へ、出てしまわない
    }
  }
  function kcPointerUp(e) {
    if (KC.cur && KC.cur.id === e.pointerId) { const st = KC.cur; KC.cur = null; if (st.p.length >= 2) { kcSnap(); st.p = kcSimplify(st.p); KC.ph.strokes.push(st); beep(1200, 0, 0.02, 0.025, 'triangle'); } }
    if (KC.drag && KC.drag.id === e.pointerId) { if (KC.drag.moved) beep(1047, 0, 0.03, 0.03, 'triangle'); KC.drag = null; }
  }
  // ---- 画面（DOM） ----
  const KC_DOM = {};
  function kcBuildDom() {
    if (KC_DOM.next) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + (cls || ''); b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); KC_DOM[id.slice(3)] = b; return b; };
    mk('kc-next', '背景を選ぶ ▶', 'hb-go').addEventListener('click', () => { ensureAudio(); KC.phase = 'bg'; beep(880, 0, 0.05, 0.04, 'square'); });
    mk('kc-back', '◀ もどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); KC.phase = 'avatar'; beep(520, 0, 0.05, 0.04, 'square'); });
    mk('kc-coin', '¥' + KCC.price + ' いれる', 'hb-go').addEventListener('click', () => { ensureAudio(); kcInsert(); });
    mk('kc-go', '撮影へ', 'hb-go').addEventListener('click', () => { ensureAudio(); beep(880, 0, 0.05, 0.04, 'square'); kcShoot(); });
    mk('kc-again', 'もう1枚撮る ¥' + KCC.price, 'hb-go').addEventListener('click', () => { ensureAudio(); KC.phase = 'coin'; KC.ph = null; beep(880, 0, 0.05, 0.04, 'square'); });
    mk('kc-out', '5Fにもどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); KC.phase = 'avatar'; standUp(); });
  }
  const kcAvGrid = () => { const cw = Math.floor((W - 24 - 6) / 2); const chh = 64; return Array.from({ length: 8 }, (_, i) => ({ x: 12 + (i % 2) * (cw + 6), y: 40 + Math.floor(i / 2) * (chh + 6), w: cw, h: chh })); };
  const kcBgGrid = () => { const cw = Math.floor((W - 24 - 3 * 5) / 4); return Array.from({ length: 8 }, (_, i) => ({ x: 12 + (i % 4) * (cw + 5), y: 268 + Math.floor(i / 4) * 30, w: cw, h: 25 })); };
  let kcSayDom = null;
  function kcSayUi(ph) {                                                                         // 画面の下の、日本語の説明（HTML）
    if (!kcSayDom) { kcSayDom = document.createElement('div'); kcSayDom.className = 'prize-info st-say kc-say'; screenEl.appendChild(kcSayDom); }
    let txt = ''; let box = { x: 12, y: 318, w: W - 24, h: 20 };
    if (KC.sheet) txt = '';
    else if (ph === 'coin') { txt = P_().money < KCC.price ? 'お金が足りないよ（¥' + KCC.price + ' 要るよ）' : 'コインを入れて、 記念写真を撮ろう！'; box = { x: 12, y: 266, w: W - 24, h: 20 }; }
    else if (ph === 'avatar') txt = '好きな子を、 1人えらんでね';
    else if (ph === 'bg') txt = KCC.backgrounds[KC.bgIdx].label + '　（背景の色をえらんでね）';
    else if (ph === 'saved') { const d = kcPhotoDims(Math.min(W - 60, 140)); txt = 'RECORDに保存しました！ ♡'; box = { x: 12, y: 24 + Math.ceil(d.total) + 6, w: W - 24, h: 20 }; }
    kcSayDom.classList.toggle('is-show', !!txt); if (txt) { if (kcSayDom.textContent !== txt) kcSayDom.textContent = txt; crPlace(kcSayDom, box); }
  }
  function kcUi() {
    kcBuildDom(); kcSayUi(KC.phase); const ph = KC.phase; const show = (k, on) => KC_DOM[k].classList.toggle('is-show', !!on);
    show('coin', ph === 'coin'); show('next', ph === 'avatar'); show('back', ph === 'bg'); show('go', ph === 'bg'); show('again', ph === 'saved'); show('out', ph === 'saved');
    crPlace(KC_DOM.coin, { x: 24, y: 296, w: W - 48, h: 38 }); crPlace(KC_DOM.next, { x: 24, y: 342, w: W - 48, h: 30 }); const bw = Math.floor((W - 28 - 6) / 2);
    crPlace(KC_DOM.back, { x: 12, y: 336, w: 70, h: 28 }); crPlace(KC_DOM.go, { x: 88, y: 336, w: W - 100, h: 28 });
    crPlace(KC_DOM.again, { x: 20, y: 316, w: W - 40, h: 28 }); crPlace(KC_DOM.out, { x: 20, y: 348, w: W - 40, h: 24 });
  }
  function kcHide() { if (!KC_DOM.next) return; Object.keys(KC_DOM).forEach((k) => KC_DOM[k].classList.remove('is-show')); if (kcSayDom) kcSayDom.classList.remove('is-show'); }
  // ---- 描画 ----
  function kcBackdrop() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#fff4f8');
    for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#fff7fa', '#ffe6ef', (y - 8) / (H - 16)));
    for (let i = 0; i < 18; i++) { const x = 14 + (i * 47) % (W - 28); const y = 12 + (i * 83) % (H - 24); ctx.globalAlpha = 0.28 + 0.12 * Math.sin(KC.clock * 0.7 + i); kcBitsDraw(ctx, 'heart', x, y, 5); ctx.globalAlpha = 1; }
  }
  const kcHint = () => {};                                                                       // 日本語の説明は、HTML（kcSayEl）で出す
  function kcDrawCoin() {                                                                          // 最初の画面：コインを入れる（かわいい雰囲気はそのまま）
    kcBackdrop(); drawTextCenter('KAWAII CLUB', W / 2, 14, '#ff6aa8', 2, '#fff'); drawTextCenter('PHOTO BOOTH', W / 2, 30, '#a08098', 1);
    const n = 4; const cw = Math.floor((W - 24 - (n - 1) * 5) / n); const chh = 84; const y0 = 56;
    for (let i = 0; i < n; i++) {
      const c = { x: 12 + i * (cw + 5), y: y0 + (i % 2) * 4, w: cw, h: chh }; rect(c.x, c.y, c.w, c.h, '#f0d0dc'); rect(c.x + 2, c.y + 2, c.w - 4, c.h - 4, '#fffafc');
      const im = KC_IMG[KC_AVATARS[i].id]; if (kcImgOk(im)) { const dh = c.h - 6; const k = dh / (im.naturalHeight * 0.62); const dw = im.naturalWidth * k; ctx.save(); ctx.beginPath(); ctx.rect(c.x + 2, c.y + 2, c.w - 4, c.h - 4); ctx.clip(); ctx.drawImage(im, c.x + (c.w - dw) / 2, c.y + 3, dw, im.naturalHeight * k); ctx.restore(); }
    }
    const bob = Math.sin(KC.clock * 2) * 2; const cx = Math.round(W / 2); rect(cx - 30, 176, 60, 46, '#ff9ac0'); rect(cx - 28, 178, 56, 42, '#ffe8f2'); rect(cx - 12, 194, 24, 4, '#a0506e');
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(cx, 184 + bob, 6, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#e0a020'; ctx.beginPath(); ctx.arc(cx, 184 + bob, 4, 0, 6.2832); ctx.fill(); kcBitsDraw(ctx, 'heart', cx, 210, 8);
    drawTextCenter('YEN ' + P_().money, W / 2, 238, '#a0506e', 1); drawTextCenter('1 SHOT  YEN ' + KCC.price, W / 2, 249, '#ff6aa8', 1);
  }
  function kcDrawAvatarSelect() {
    kcBackdrop(); drawTextCenter('KAWAII CLUB', W / 2, 14, '#ff6aa8', 2, '#fff'); drawTextCenter('PICK YOUR AVATAR', W / 2, 30, '#a08098', 1);
    const g = kcAvGrid();
    for (let i = 0; i < 8; i++) {
      const c = g[i]; const sel = i === KC.avatarIdx; const pulse = 0.5 + 0.5 * Math.sin(KC.clock * 3);
      rect(c.x, c.y, c.w, c.h, sel ? '#ff9ac0' : '#f0d0dc'); rect(c.x + 2, c.y + 2, c.w - 4, c.h - 4, sel ? '#ffe8f2' : '#fffafc');
      const im = KC_IMG[KC_AVATARS[i].id]; if (kcImgOk(im)) { const sc = sel ? 1.1 : 1; const dh = c.h - 6; const k = dh / (im.naturalHeight * 0.62); const dw = im.naturalWidth * k * sc; ctx.save(); ctx.beginPath(); ctx.rect(c.x + 2, c.y + 2, c.w - 4, c.h - 4); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight * 0.64, c.x + (c.w - dw) / 2, c.y + 3, dw, dh * sc); ctx.restore(); }
      if (sel) { ctx.globalAlpha = 0.5 + 0.4 * pulse; rect(c.x, c.y, c.w, 2, '#ff5a9a'); rect(c.x, c.y + c.h - 2, c.w, 2, '#ff5a9a'); rect(c.x, c.y, 2, c.h, '#ff5a9a'); rect(c.x + c.w - 2, c.y, 2, c.h, '#ff5a9a'); ctx.globalAlpha = 1; kcBitsDraw(ctx, 'heart', c.x + c.w - 9, c.y + 9, 10); }
    }
    kcHint('好きな子を、 1人えらんでね', 322);
  }
  function kcDrawBgSelect() {
    kcBackdrop(); drawTextCenter('KAWAII CLUB', W / 2, 14, '#ff6aa8', 2, '#fff'); drawTextCenter('PICK A COLOR', W / 2, 30, '#a08098', 1);
    const w = Math.min(W - 60, 130); const pw = { id: 'x', avatarId: KC_AVATARS[KC.avatarIdx].id, backgroundId: KCC.backgrounds[KC.bgIdx].id, stamps: [], strokes: [], day: P_().day }; const x = Math.round((W - w) / 2); const h = Math.round(w * KCC.photoAspect);
    rect(x - 4, 42, w + 8, h + 8, '#ffffff'); kcDrawPhotoArea(ctx, pw, x, 46, w, h);
    const g = kcBgGrid(); for (let i = 0; i < 8; i++) { const c = g[i]; const sel = i === KC.bgIdx; rect(c.x - 2, c.y - 2, c.w + 4, c.h + 4, sel ? '#ff5a9a' : '#e8c8d4'); rect(c.x, c.y, c.w, c.h, KCC.backgrounds[i].color); }
    kcHint(KCC.backgrounds[KC.bgIdx].label, 322);
  }
  function kcDrawShoot() {
    kcBackdrop(); const ph = KC.ph; const w = Math.min(W - 40, 150); const h = Math.round(w * KCC.photoAspect); const x = Math.round((W - w) / 2); const y = 44;
    rect(x - 4, y - 4, w + 8, h + 8, '#ffffff'); kcDrawPhotoArea(ctx, ph, x, y, w, h);
    if (KC.phase === 'ready') drawTextCenter('READY?', W / 2, y + h + 22, '#ff6aa8', 4, '#fff');
    else if (KC.phase === 'count') { const k = Math.min(2, Math.floor(KC.t / 0.7)); drawTextCenter(String(3 - k), W / 2, y + h + 14, '#ff6aa8', 8, '#fff'); }
    else if (KC.phase === 'flash') { const a = Math.max(0, 1 - KC.t / 0.8); ctx.globalAlpha = Math.min(1, a * 1.3); rect(8, 8, W - 16, H - 16, '#ffffff'); ctx.globalAlpha = 1; if (KC.t < 0.6) drawTextCenter('FLASH!', W / 2, 170, '#ff6aa8', 4, '#fff'); }
  }
  function kcDrawDeco() {
    kcBackdrop(); const pr = kcPhotoRect(); rect(pr.x - 3, pr.y - 3, pr.w + 6, pr.h + 6, '#ffffff'); kcDrawPhotoArea(ctx, KC.ph, pr.x, pr.y, pr.w, pr.h);
    if (KC.cur && KC.cur.p.length >= 2) kcDrawStrokes(ctx, [KC.cur], pr.x, pr.y, pr.w, pr.h);          // 描いている最中の線（アバターやスタンプは、そのまま見える）
    if (KC.sel >= 0 && KC.ph.stamps[KC.sel]) { const s = KC.ph.stamps[KC.sel]; const r = KCC.stampBase * pr.w * s.k * 0.62; const cx = pr.x + s.x * pr.w; const cy = pr.y + s.y * pr.h; ctx.globalAlpha = 0.95; rect(Math.round(cx - r), Math.round(cy - r), Math.round(r * 2) + 1, 1, '#ff5a9a'); rect(Math.round(cx - r), Math.round(cy + r), Math.round(r * 2) + 1, 1, '#ff5a9a'); rect(Math.round(cx - r), Math.round(cy - r), 1, Math.round(r * 2), '#ff5a9a'); rect(Math.round(cx + r), Math.round(cy - r), 1, Math.round(r * 2), '#ff5a9a'); ctx.globalAlpha = 1;
      rect(Math.round(cx + r) - 4, Math.round(cy - r) - 4, 9, 9, '#ffffff'); rect(Math.round(cx + r) - 3, Math.round(cy - r) - 3, 7, 7, '#ff5a9a'); rect(Math.round(cx + r) - 1, Math.round(cy - r) - 1, 3, 3, '#ffffff'); }       // 右上の「つまみ」（ドラッグで、大きさ）
    const T = kcToolRects(); const lab = { STAMP: 'STAMP', PEN: 'PEN', UNDO: 'UNDO', RESET: 'RESET', FINISH: 'FINISH' };
    for (const b of T.row) { const on = (b.k === 'STAMP' && KC.mode === 'stamp') || (b.k === 'PEN' && KC.mode === 'pen'); const fin = b.k === 'FINISH'; rect(b.x, b.y, b.w, b.h, on ? '#ff5a9a' : fin ? '#7ad8b0' : '#e8c8d4'); rect(b.x, b.y, b.w, 1, '#ffffff'); drawTextCenter(lab[b.k], b.x + b.w / 2 + 0.5, b.y + 6, on ? '#ffffff' : '#7a4a62', 1); }
    if (KC.mode === 'stamp') {
      for (const b of T.sel) { rect(b.x, b.y, b.w, b.h, b.k === 'DEL' ? '#ffb0b0' : '#d8e8ff'); drawTextCenter(b.k === 'DEL' ? 'DELETE' : b.k === 'TURN-' ? 'TURN L' : 'TURN R', b.x + b.w / 2 + 0.5, b.y + 4, '#4a4a6a', 1); }
      for (const b of T.pal) { rect(b.x, b.y, b.w, b.h, '#ffffff'); rect(b.x, b.y, b.w, 1, '#f0d0dc'); rect(b.x, b.y + b.h - 1, b.w, 1, '#f0d0dc'); kcStampDraw(ctx, b.id, b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) - 6, 0); }
      for (const [b, dir] of [[T.prev, -1], [T.next, 1]]) {                                          // ◀ ▶：はっきり見える、ピンクの矢印ボタン
        rect(b.x, b.y, b.w, b.h, '#ffd0e2'); rect(b.x, b.y, b.w, 1, '#ffffff'); const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
        for (let i = 0; i < 5; i++) rect(Math.round(cx + (dir < 0 ? -2 + i : 2 - i) - 0.5), cy - i - 0, 1, i * 2 + 1, '#ff5a9a');
      }
      for (let i = 0; i <= T.maxPage; i++) rect(Math.round(W / 2 - (T.maxPage + 1) * 5 + i * 10 + 2), T.prev.y + 45, 6, 4, i === KC.page ? '#ff5a9a' : '#f0c0d0');                              // いま何ページ目か（点）
    } else {
      for (const b of T.colors) { rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, KC.penColor === b.i ? '#ff5a9a' : '#e8c8d4'); rect(b.x, b.y, b.w, b.h, b.c); }
      for (const b of T.widths) { const on = KC.penW === b.i; rect(b.x, b.y, b.w, b.h, on ? '#ffd0e0' : '#fff'); rect(b.x, b.y, b.w, 1, on ? '#ff5a9a' : '#e8c8d4'); const t = [2, 4, 7][b.i]; rect(b.x + 8, b.y + b.h / 2 - t / 2, b.w - 16, t, KCC.penColors[KC.penColor]); }
    }
    if (KC.banner > 0) { ctx.globalAlpha = Math.min(1, KC.banner * 1.5); drawTextCenter('DECO TIME!', W / 2, pr.y + pr.h / 2 - 8, '#ff6aa8', 3, '#ffffff'); ctx.globalAlpha = 1; }
    if (KC.dev.coords && KC.last) { drawText(Math.round(KC.last.x) + ',' + Math.round(KC.last.y), 14, 374, '#a08098', 1); }
  }
  function kcDrawSaved() {
    kcBackdrop(); const w = Math.min(W - 60, 140); const d = kcPhotoDims(w); const x = Math.round((W - w) / 2); const y = 24;
    kcDrawCheki(ctx, KC.lastPhoto, x, y, w);
    kcBitsDraw(ctx, 'heart', 22, y + d.total + 16, 8); kcBitsDraw(ctx, 'heart', W - 22, y + d.total + 16, 8);
    drawTextCenter('YEN ' + P_().money, W / 2, y + d.total + 34, '#a08098', 1);
  }
  function kcDrawSheet() {                                                                        // DEV：全アバター・全背景・全スタンプの確認
    kcBackdrop(); drawTextCenter('ALL (TAP TO CLOSE)', W / 2, 10, '#d0608a', 1);
    for (let i = 0; i < 8; i++) { const w = Math.floor((W - 30) / 4); const x = 10 + (i % 4) * (w + 3); const y = 22 + Math.floor(i / 4) * Math.round(w * KCC.photoAspect + 4); kcDrawPhotoArea(ctx, { avatarId: KC_AVATARS[i].id, backgroundId: KCC.backgrounds[i].id, stamps: [], strokes: [], day: 0 }, x, y, w, Math.round(w * KCC.photoAspect)); }
    KC_STAMPS.forEach((st, i) => kcStampDraw(ctx, st.id, 22 + (i % 7) * 26, 170 + Math.floor(i / 7) * 26, 20, 0));
  }
  function kcDraw() {
    const ph = KC.phase; if (KC.sheet) kcDrawSheet(); else if (ph === 'coin') kcDrawCoin(); else if (ph === 'avatar') kcDrawAvatarSelect(); else if (ph === 'bg') kcDrawBgSelect(); else if (ph === 'ready' || ph === 'count' || ph === 'flash') kcDrawShoot(); else if (ph === 'deco') kcDrawDeco(); else kcDrawSaved();
    kcUi();
  }
  // ---- RECORD の PHOTO（アルバム）：2列のチェキ・縦スクロール・タップで大きく ----
  const KA_DOM = {};
  function kaBuildDom() {
    if (KA_DOM.back) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); KA_DOM[id.slice(3)] = b; return b; };
    mk('ka-back', 'もどる', 'hb-sub').addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); if (scene === 'photoView') { scene = 'album'; KC.album.view = null; } else scene = 'b1'; updateSceneUi(); });
    mk('ka-del', 'この写真を消す', 'hb-quit').addEventListener('click', () => { ensureAudio(); const id = KC.album.view; if (!id) return; showDialog({ title: '写真を消す？', lines: [{ text: 'この写真を、 削除しますか？', cls: '' }, { text: '（もとには、 戻せないよ）', cls: 'dim' }], buttons: [{ label: '削除する', onClick: () => { P_().photos = P_().photos.filter((p) => p.id !== id); delete KC.album.cache[id]; KC.album.view = null; scene = 'album'; writeSave(); updateSceneUi(); } }, { label: 'やめる', primary: true }] }); });
  }
  function kaUi() {
    kaBuildDom(); const on = scene === 'album' || scene === 'photoView'; KA_DOM.back.classList.toggle('is-show', on); KA_DOM.del.classList.toggle('is-show', scene === 'photoView');
    if (!on) return; crPlace(KA_DOM.back, { x: 12, y: 346, w: scene === 'photoView' ? 70 : W - 24, h: 26 }); crPlace(KA_DOM.del, { x: 90, y: 346, w: W - 102, h: 26 });
  }
  function kaThumb(ph, w) {                                                                       // チェキを、いちど絵にして、使いまわす（読みこみが すんでいないあいだは、ためない）
    const key = ph.id + '@' + w; let c = KC.album.cache[key]; if (c) return c;
    const d = kcPhotoDims(w); const cv = document.createElement('canvas'); cv.width = Math.ceil(w + 4); cv.height = Math.ceil(d.total + 4); const g = cv.getContext('2d'); const ok = kcDrawCheki(g, ph, 0, 0, w);
    if (ok) KC.album.cache[key] = cv; return cv;
  }
  const kaLayout = () => { const cw = Math.floor((W - 36) / 2); const d = kcPhotoDims(cw); const rows = Math.ceil(P_().photos.length / 2); return { cw, ch: Math.ceil(d.total) + 6, rows, view: { top: 34, bot: 340 } }; };
  function drawAlbum() {
    kcBackdrop(); drawTextCenter('PHOTO', W / 2, 12, '#ff6aa8', 2, '#fff'); const L = kaLayout(); const photos = P_().photos; const vh = L.view.bot - L.view.top; const total = L.rows * L.ch + 6; KC.album.scroll = clamp(KC.album.scroll, 0, Math.max(0, total - vh)); KC.album.items = [];
    ctx.save(); ctx.beginPath(); ctx.rect(10, L.view.top, W - 20, vh); ctx.clip();
    if (!photos.length) { ctx.restore(); drawTextCenter('NO PHOTO YET', W / 2, 150, '#a08098', 1); kaUi(); return; }
    const list = photos.slice().reverse();                                                       // 新しい順
    list.forEach((ph, i) => { const x = 14 + (i % 2) * (L.cw + 8); const y = L.view.top + 4 + Math.floor(i / 2) * L.ch - KC.album.scroll; if (y > L.view.bot || y + L.ch < L.view.top) return; const cv = kaThumb(ph, L.cw); ctx.drawImage(cv, x, y); KC.album.items.push({ id: ph.id, x, y, w: L.cw, h: L.ch }); });
    ctx.restore(); kaUi();
  }
  function drawPhotoView() {
    kcBackdrop(); const ph = P_().photos.find((p) => p.id === KC.album.view); if (!ph) { scene = 'album'; return; } const w = Math.min(W - 40, 180); const d = kcPhotoDims(w); const x = Math.round((W - w) / 2);
    kcDrawCheki(ctx, ph, x, 16, w); drawTextCenter('DAY ' + ph.day, W / 2, 16 + d.total + 10, '#d0608a', 2, '#fff'); kaUi();
  }
  const kaDown = (p) => { KC.album.down = { x: p.x, y: p.y, s: KC.album.scroll }; KC.album.dragged = false; };
  const kaMove = (p) => { const d = KC.album.down; if (!d) return; const dy = p.y - d.y; if (Math.abs(dy) > 4) KC.album.dragged = true; if (KC.album.dragged) KC.album.scroll = d.s - dy; };
  function kaUp(p) { const d = KC.album.down; KC.album.down = null; if (!d || KC.album.dragged || scene !== 'album') return; const c = KC.album.items.find((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h); if (c) { KC.album.view = c.id; scene = 'photoView'; beep(880, 0, 0.05, 0.04, 'triangle'); updateSceneUi(); } }
  function openAlbum() { closeDialog(); KC.album.scroll = 0; KC.album.view = null; scene = 'album'; updateSceneUi(); beep(660, 0, 0.05, 0.04, 'triangle'); }
  // ---- DEV ----
  function kcTestPhoto(i) {
    const rnd = (n) => Math.floor(Math.random() * n); const strokes = [];
    for (let s = 0; s < 14; s++) { let x = 100 + rnd(800); let y = 100 + rnd(800); let a = Math.random() * 6.28; const p = [x, y]; for (let k = 0; k < 90; k++) { a += (Math.random() - 0.5) * 0.7; x = clamp(x + Math.cos(a) * 14, 0, 1000); y = clamp(y + Math.sin(a) * 14, 0, 1000); p.push(Math.round(x), Math.round(y)); } strokes.push({ c: KCC.penColors[rnd(8)], w: KCC.penWidths[rnd(3)], p: kcSimplify(p) }); }
    const stamps = []; for (let s = 0; s < 8; s++) stamps.push({ s: KC_STAMPS[rnd(KC_STAMPS.length)].id, x: Math.round(Math.random() * 900 + 50) / 1000, y: Math.round(Math.random() * 800 + 100) / 1000, k: 1, r: rnd(60) - 30 });
    return { id: 'photo_test' + i + '_' + Date.now().toString(36), day: P_().day, avatarId: KC_AVATARS[rnd(8)].id, backgroundId: KCC.backgrounds[rnd(8)].id, stamps, strokes, createdAt: Date.now() };
  }
  function kcStorageInfo() { const t0 = performance.now(); const all = JSON.stringify(save); const t1 = performance.now(); JSON.parse(all); const t2 = performance.now(); const ph = JSON.stringify(P_().photos); return { n: P_().photos.length, photosKB: Math.round(ph.length / 102.4) / 10, totalKB: Math.round(all.length / 102.4) / 10, per: P_().photos.length ? Math.round(ph.length / P_().photos.length) : 0, saveMs: Math.round((t1 - t0) * 10) / 10, loadMs: Math.round((t2 - t1) * 10) / 10 }; }
  function openKcDev() {
    const info = kcStorageInfo(); const again = (f) => () => { f(); setTimeout(openKcDev, 0); };
    showDialog({ title: 'KAWAII CLUB DEV', wide: true, lines: [{ text: 'PHOTO ' + info.n + '枚 / ' + info.photosKB + 'KB（1枚 約' + info.per + ' bytes）', cls: 'dim' }, { text: 'セーブ全体 ' + info.totalKB + 'KB / 保存 ' + info.saveMs + 'ms / 読込 ' + info.loadMs + 'ms', cls: 'dim' }, { text: 'DAY ' + P_().day + ' / MONEY ¥' + P_().money + ' / ペン座標 ' + (KC.dev.coords ? 'ON' : 'OFF'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: '写真を即生成（1枚）', onClick: again(() => { kcSavePhoto(kcTestPhoto(P_().photos.length)); }) },
      { label: 'テスト写真 +10', onClick: again(() => { for (let i = 0; i < 10; i++) P_().photos.push(kcTestPhoto(i)); writeSave(); }) },
      { label: 'テスト写真 +50', onClick: again(() => { for (let i = 0; i < 50; i++) P_().photos.push(kcTestPhoto(i)); writeSave(); }) },
      { label: 'PHOTO 全削除', onClick: () => { showDialog({ title: '全削除？', lines: [{ text: 'PHOTOを、 すべて削除します', cls: '' }], buttons: [{ label: '削除', onClick: () => { P_().photos = []; KC.album.cache = {}; writeSave(); setTimeout(openKcDev, 0); } }, { label: 'やめる', primary: true }] }); } },
      { label: 'DAY +1', onClick: again(() => { P_().day++; writeSave(); }) }, { label: 'DAY -1', onClick: again(() => { P_().day = Math.max(1, P_().day - 1); writeSave(); }) },
      { label: 'ペン座標 表示 ON/OFF', onClick: again(() => { KC.dev.coords = !KC.dev.coords; }) },
      { label: '全アバター・背景・スタンプ確認', onClick: () => { if (scene === 'machine' && currentMachine && currentMachine.gameType === 'kawaiiClub') KC.sheet = true; else toast('KAWAII CLUB の中で、 押してね'); } },
      { label: 'とじる', primary: true } ] });
  }
  mgRegister('kawaiiClub', {
    reset() { KC.phase = KC.paid ? 'avatar' : 'coin'; KC.cur = null; KC.drag = null; KC.sheet = false; }, phase: () => KC.phase,
    enter() { kcBuildDom(); KC.phase = KC.paid ? 'avatar' : 'coin'; KC.sheet = false; setMessage('', C.cyan); },
    update: kcUpdate, draw: kcDraw, hint: '好きなアバターと背景で、 記念写真を撮ろう！',
    pointer: kcPointer, pointerUp: kcPointerUp
  });
  GAME_TYPES.kawaiiClub.pointerMove = kcPointerMove;
  GAME_TYPES.kawaiiClub.canLeave = () => KC.phase === 'coin' || KC.phase === 'avatar' || KC.phase === 'bg' || KC.phase === 'saved';
  GAME_TYPES.kawaiiClub.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

