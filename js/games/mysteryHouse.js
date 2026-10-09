'use strict';
  // =====================================================================
  //  🗝 MYSTERY HOUSE：8F（旧 HORROR HOUSE を改装中）。一人称の探索。背景画像の上に、家具の透過PNGを重ねて表示する
  //   今回できるのは「寝室 → クローゼットをタップ → 扉が開いたアップ → 戻る」まで。部屋・壁・家具・アップは CONFIG.mystery のデータで増やす
  //   画像：assets/mystery/<部屋>/ に置く（1064x1478。サイズは変えず、画面には縦横比を保って はめこむ）。無い画像は仮表示になる
  //   旧ホラーハウスの js/games/horrorHouse.js は消さずに残してある（DEV から呼べる）。タイマーは update時計だけ（setTimeout不使用）
  // =====================================================================
  const MHC = CONFIG.mystery;
  const MH_MACHINE = { machineId: 'mh_mystery', machineName: 'MYSTERY HOUSE', label: 'MYSTERY HOUSE', isUnlocked: true, gameType: 'mystery', mh: true };
  const MH = { phase: 'intro', clock: 0, room: 'bedroom', wall: 'west', zoom: null, fade: null, paying: false, tapFx: null, mode: MHC.viewMode, pano: { yaw: 0, pitch: 0, drag: null }, zs: {}, dev: { mark: true, boxes: false, noImg: false } };
  const MH_IMG = {};
  // ---- 画像（無い・読めない時は null を返す → 仮表示）----
  function mhImg(room, file) {
    if (!file || MH.dev.noImg) return null; const key = room + '/' + file; let im = MH_IMG[key];
    if (!im) { im = new Image(); im.onerror = () => { im.bad = true; }; im.src = MHC.rooms[room].dir + file; MH_IMG[key] = im; }
    return im.complete && im.naturalWidth && !im.bad ? im : null;
  }
  function mhPreload(room) { const R = MHC.rooms[room]; Object.keys(R.walls).forEach((w) => { const W_ = R.walls[w]; mhImg(room, W_.bg); W_.layers.forEach((l) => mhImg(room, l.file)); }); Object.keys(R.zooms).forEach((z) => { mhImg(room, R.zooms[z].file); if (R.zooms[z].states) Object.keys(R.zooms[z].states).forEach((k) => mhImg(room, R.zooms[z].states[k])); }); }
  const mhRoom = () => MHC.rooms[MH.room]; const mhWall = () => mhRoom().walls[MH.wall];
  // ---- 画面の はめこみ（縦横比を保つ）----
  const mhArea = () => ({ x: 8, y: 26, w: W - 16, h: 272 });
  function mhFit(nw, nh, raw) { const a = MH.mode === 'panorama' ? mhPanoArea() : mhArea(); if (raw) return { ax: a.x, ay: a.y, aw: a.w, ah: a.h }; const s = Math.min(a.w / nw, a.h / nh); const dw = nw * s; const dh = nh * s; return { s, ox: a.x + (a.w - dw) / 2, oy: a.y + (a.h - dh) / 2, dw, dh }; }
  const mhScene = () => { const sz = mhRoom().size; return mhFit(sz[0], sz[1]); };

  // =====================================================================
  //  360°パノラマ（試作）：Equirect画像を 画面ごとに「見ている方向の視点」へ投影し直して表示する（家具や壁が伸びない）
  //   スワイプで見回す（指を離すと そこで止まる／勝手には回らない）。タップ判定・差分・怪異はまだ無し
  // =====================================================================
  const MHP = { room: '', loaded: false, test: false, w: 0, h: 0, data: null, src: null, tainted: false, buf: null, bctx: null, bw: 0, bh: 0, ray: null, rayKey: '', dirty: true, last: '', img: null, imgState: '' };
  const mhPanoCfg = () => mhRoom().panorama; const mhPanoArea = () => ({ x: 4, y: 22, w: W - 8, h: 304 });
  function mhPanoTest(w, h) {           // 画像が無い時の確認用：方位の目盛りと水平線つき（直線がまっすぐ見えれば投影は正しい）
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1830'); gr.addColorStop(0.5, '#6a6a7a'); gr.addColorStop(0.5, '#3a2a22'); gr.addColorStop(1, '#14100e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { const x = i * w / 24; g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(x, h * 0.2, w / 24, h * 0.3); g.strokeStyle = i % 6 === 0 ? '#ffe9a0' : 'rgba(255,255,255,0.45)'; g.lineWidth = i % 6 === 0 ? 4 : 2; g.beginPath(); g.moveTo(x, h * 0.04); g.lineTo(x, h * 0.96); g.stroke(); g.fillStyle = '#ffffff'; g.font = 'bold ' + Math.round(h * 0.035) + 'px sans-serif'; g.fillText(String(mhNorm(i * 15 - 180)), x + 6, h * 0.42); }
    for (const d of [-60, -30, 0, 30, 60]) { const y = h * (0.5 - d / 180); g.strokeStyle = d === 0 ? '#ff7a6a' : 'rgba(255,255,255,0.5)'; g.lineWidth = d === 0 ? 4 : 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.fillStyle = '#ffffff'; g.fillText(d + 'deg', w * 0.5 + 8, y - 6); }
    g.fillStyle = '#ffe9a0'; g.font = 'bold ' + Math.round(h * 0.06) + 'px sans-serif'; g.fillText('TEST PANORAMA  (no panorama.jpg)', w * 0.5 - w * 0.2, h * 0.3); for (let i = 0; i < 60; i++) { g.fillStyle = (i % 2) ? '#2a2020' : '#4a3a30'; g.fillRect((i % 12) * w / 12, h * 0.55 + Math.floor(i / 12) * h * 0.09, w / 12 - 3, h * 0.09 - 3); }
    return c;
  }
  function mhPanoUse(canvasOrImg, test, swWant) {                 // 元画像は変えず、サンプリング用に（大きすぎる時だけ）縮めたコピーを読む
    const cfg = mhPanoCfg(); const nw = canvasOrImg.naturalWidth || canvasOrImg.width; const nh = canvasOrImg.naturalHeight || canvasOrImg.height; MHP.orig = canvasOrImg; const sw = Math.min(nw, swWant || cfg.maxSrcW || 4096); const sh = Math.max(1, Math.round(nh * sw / nw));
    const c = document.createElement('canvas'); c.width = sw; c.height = sh; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(canvasOrImg, 0, 0, sw, sh);
    MHP.src = c; MHP.w = sw; MHP.h = sh; MHP.test = !!test; MHP.tainted = false; MHP.data = null;
    try { MHP.data = g.getImageData(0, 0, sw, sh).data; } catch (e) { MHP.tainted = true; }      // file:// で開いた時は 画素を読めない → 簡易表示に切り替え
    MHP.loaded = true; MHP.dirty = true; mhPanoLayersBuild();
  }
  function mhPanoLayersBuild() {   // 家具レイヤー（背景と同じ360°座標・同じ解像度に揃えて読み込む。元画像は変えない）
    MHP.layers = []; if (MHP.test) return; const cfg = mhPanoCfg();
    for (const L of (cfg.layers || [])) { const im = MHP.limg && MHP.limg[L.id]; if (!im) continue; const c = document.createElement('canvas'); c.width = MHP.w; c.height = MHP.h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, MHP.w, MHP.h); let d = null; if (!MHP.tainted) { try { d = g.getImageData(0, 0, MHP.w, MHP.h).data; } catch (e) { d = null; } } MHP.layers.push({ id: L.id, src: c, data: d }); }
    MHP.dirty = true;
  }
  const mhLayerOn = (id) => !MH.dev.hide || !MH.dev.hide[id];
  const mhPx = () => { const c = mhPanoCfg().pixel; const L = c.levels[Math.max(0, Math.min(c.levels.length - 1, c.level))]; return { k: L.k, name: L.name, scan: c.scan }; };   // k=ドット1個あたりの論理px（0=なめらか）
  function mhPanoLoad() {
    const cfg = mhPanoCfg(); const key = MH.room + '/' + cfg.file + (MH.dev.noImg ? '#x' : ''); if (MHP.last === key) return; MHP.last = key; MHP.loaded = false;
    if (MH.dev.noImg) { mhPanoUse(mhPanoTest(2048, 1024), true); return; }
    MHP.limg = {}; MHP.layers = []; for (const L of (cfg.layers || [])) { const li = new Image(); li.onload = () => { if (MHP.last === key) { MHP.limg[L.id] = li; if (MHP.loaded) mhPanoLayersBuild(); } }; li.src = mhRoom().dir + L.file; }
    const im = new Image(); MHP.img = im; im.onload = () => { if (MHP.img === im) mhPanoUse(im, false); }; im.onerror = () => { if (MHP.img === im) mhPanoUse(mhPanoTest(2048, 1024), true); }; im.src = mhRoom().dir + cfg.file;
  }
  function mhPanoReset() { const c = mhPanoCfg(); MH.pano.yaw = c.yaw0 || 0; MH.pano.pitch = c.pitch0 || 0; MH.pano.drag = null; MHP.dirty = true; }
  const mhNorm = (d) => ((d % 360) + 540) % 360 - 180;
  function mhPanoRender() {
    const cfg = mhPanoCfg(); const a = mhPanoArea(); const px = mhPx(); const bw = Math.max(8, px.k ? Math.round(a.w / px.k) : Math.round(a.w * cfg.quality)); const bh = Math.max(8, px.k ? Math.round(a.h / px.k) : Math.round(a.h * cfg.quality));
    if (!MHP.buf || MHP.bw !== bw || MHP.bh !== bh) { MHP.buf = document.createElement('canvas'); MHP.buf.width = bw; MHP.buf.height = bh; MHP.bctx = MHP.buf.getContext('2d'); MHP.bw = bw; MHP.bh = bh; MHP.dirty = true; MHP.rayKey = ''; }
    const st = MH.pano; const sig = st.yaw.toFixed(2) + '/' + st.pitch.toFixed(2) + '/' + cfg.fov + '/' + bw + '/' + bh; if (!MHP.dirty && MHP.sig === sig) return; MHP.sig = sig; MHP.dirty = false; if (!MHP.loaded) return;
    const g = MHP.bctx; const rad = Math.PI / 180;
    if (px.k && MHP.orig && !MHP.tainted) { const hf = 2 * Math.atan(Math.tan(cfg.fov * rad / 2) * bw / bh) / rad; const want = Math.min(cfg.maxSrcW || 4096, Math.max(512, Math.ceil(bw * 360 / hf * 2 / 256) * 256)); if (MHP.w !== want && !MHP.test) mhPanoUse(MHP.orig, false, want); }   // ドットの時は元絵を少し縮めた版から読む（ちらつき・ざらつきを防ぐ）
    else if (!px.k && MHP.orig && !MHP.test && MHP.w !== Math.min(MHP.orig.naturalWidth || MHP.orig.width, cfg.maxSrcW || 4096)) mhPanoUse(MHP.orig, false);
    if (MHP.tainted) { mhPanoFallback(g, bw, bh, cfg, st); mhPanoMarks(g, bw, bh, cfg, st); return; }
    const rk = bw + 'x' + bh + '@' + cfg.fov; if (MHP.rayKey !== rk) { const f = (bh / 2) / Math.tan(cfg.fov * rad / 2); const n = bw * bh; const rx = new Float32Array(n); const ry = new Float32Array(n); const rz = new Float32Array(n); let i = 0; for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++, i++) { const px = x + 0.5 - bw / 2; const py = -(y + 0.5 - bh / 2); const l = Math.hypot(px, py, f); rx[i] = px / l; ry[i] = py / l; rz[i] = f / l; } MHP.ray = { rx, ry, rz }; MHP.rayKey = rk; }
    const LY = (MHP.layers || []).filter((l) => l.data && mhLayerOn(l.id)); const R = MHP.ray; const out = g.createImageData(bw, bh); const o = out.data; const sd = MHP.data; const sw = MHP.w; const sh = MHP.h; const cp = Math.cos(st.pitch * rad); const sp = Math.sin(st.pitch * rad); const cy = Math.cos(st.yaw * rad); const sy = Math.sin(st.yaw * rad); const n = bw * bh; const T = 1 / (2 * Math.PI);
    for (let i = 0; i < n; i++) {
      const x0 = R.rx[i]; const y0 = R.ry[i]; const z0 = R.rz[i];
      const y1 = y0 * cp + z0 * sp; const z1 = -y0 * sp + z0 * cp; const x2 = x0 * cy + z1 * sy; const z2 = -x0 * sy + z1 * cy;
      let u = (Math.atan2(x2, z2) * T + 0.5) * sw - 0.5; let v = (0.5 - Math.asin(y1 < -1 ? -1 : y1 > 1 ? 1 : y1) / Math.PI) * sh - 0.5;
      if (v < 0) v = 0; else if (v > sh - 1) v = sh - 1; let ux = Math.floor(u); const fx = u - ux; const vy = Math.floor(v); const fy = v - vy; ux = ((ux % sw) + sw) % sw; const ux1 = (ux + 1) % sw; const vy1 = vy + 1 < sh ? vy + 1 : vy;
      const a0 = (vy * sw + ux) * 4; const a1 = (vy * sw + ux1) * 4; const b0 = (vy1 * sw + ux) * 4; const b1 = (vy1 * sw + ux1) * 4; const w00 = (1 - fx) * (1 - fy); const w10 = fx * (1 - fy); const w01 = (1 - fx) * fy; const w11 = fx * fy; const k = i * 4;
      o[k] = sd[a0] * w00 + sd[a1] * w10 + sd[b0] * w01 + sd[b1] * w11; o[k + 1] = sd[a0 + 1] * w00 + sd[a1 + 1] * w10 + sd[b0 + 1] * w01 + sd[b1 + 1] * w11; o[k + 2] = sd[a0 + 2] * w00 + sd[a1 + 2] * w10 + sd[b0 + 2] * w01 + sd[b1 + 2] * w11; o[k + 3] = 255;
      for (let q = 0; q < LY.length; q++) { const ld = LY[q].data; const A0 = ld[a0 + 3]; const A1 = ld[a1 + 3]; const B0 = ld[b0 + 3]; const B1 = ld[b1 + 3]; if (!(A0 | A1 | B0 | B1)) continue;   // 透過ぶんは何もしない
        const p0 = w00 * A0; const p1 = w10 * A1; const p2 = w01 * B0; const p3 = w11 * B1; const aa = (p0 + p1 + p2 + p3) / 255; if (aa <= 0) continue;
        const r = (ld[a0] * p0 + ld[a1] * p1 + ld[b0] * p2 + ld[b1] * p3) / 255; const gg = (ld[a0 + 1] * p0 + ld[a1 + 1] * p1 + ld[b0 + 1] * p2 + ld[b1 + 1] * p3) / 255; const bb = (ld[a0 + 2] * p0 + ld[a1 + 2] * p1 + ld[b0 + 2] * p2 + ld[b1 + 2] * p3) / 255; const ia = 1 - aa;   // 乗算済みアルファで合成
        o[k] = r + o[k] * ia; o[k + 1] = gg + o[k + 1] * ia; o[k + 2] = bb + o[k + 2] * ia; }
    }
    g.putImageData(out, 0, 0); mhPanoMarks(g, bw, bh, cfg, st);
  }
  // 球面上に固定した印：パノラマと同じ回転（逆変換）で画面位置を求める。見回しても窓からずれない
  function mhPanoMarks(g, bw, bh, cfg, st) {
    if (!MH.dev.mark || !cfg.marks) return; const rad = Math.PI / 180; const f = (bh / 2) / Math.tan(cfg.fov * rad / 2); const cp = Math.cos(st.pitch * rad); const sp = Math.sin(st.pitch * rad); const cy = Math.cos(st.yaw * rad); const sy = Math.sin(st.yaw * rad);
    for (const m of cfg.marks) {
      const lo = m.lon * rad; const la = m.lat * rad; const x2 = Math.cos(la) * Math.sin(lo); const y1 = Math.sin(la); const z2 = Math.cos(la) * Math.cos(lo);      // 球面上の方向
      const x0 = x2 * cy - z2 * sy; const z1 = x2 * sy + z2 * cy; const y0 = y1 * cp - z1 * sp; const z0 = y1 * sp + z1 * cp; if (z0 <= 0.05) continue;   // 背中側は描かない
      const X = bw / 2 + f * x0 / z0; const Y = bh / 2 - f * y0 / z0; const r = Math.max(1.5, f * Math.tan(m.r * rad) / z0); const lw = Math.max(1, r * 0.22);
      g.save(); g.lineCap = 'butt'; g.beginPath(); g.arc(X, Y, r + lw * 0.5, 0, 6.2832); g.strokeStyle = 'rgba(30,14,10,0.85)'; g.lineWidth = lw + 2; g.stroke(); g.beginPath(); g.arc(X, Y, r, 0, 6.2832); g.strokeStyle = m.color || '#fff2b0'; g.lineWidth = lw; g.stroke(); g.restore();
    }
  }
  function mhPanoFallback(g, bw, bh, cfg, st) {          // 画素が読めない時（file://）の簡易表示：列ごとの円筒投影。上下の傾きは近似
    const rad = Math.PI / 180; const f = (bh / 2) / Math.tan(cfg.fov * rad / 2); g.fillStyle = '#05040a'; g.fillRect(0, 0, bw, bh); const sw = MHP.w; const sh = MHP.h; const pyPix = Math.tan(st.pitch * rad) * f;
    for (let x = 0; x < bw; x++) { const al = Math.atan((x + 0.5 - bw / 2) / f); const lon = st.yaw * rad + al; const sx = (((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1 * sw; const sc = f / Math.cos(al) / (sh / Math.PI); const hh = bh / sc; const cyy = sh * (0.5 - st.pitch / 180); g.drawImage(MHP.src, sx, cyy - hh / 2, 1, hh, x, 0, 1, bh); for (const l of (MHP.layers || [])) if (mhLayerOn(l.id)) g.drawImage(l.src, sx, cyy - hh / 2, 1, hh, x, 0, 1, bh); }
  }
  function mhPointerMove(e, p) {
    const d = MH.pano.drag; if (!d || MH.phase !== 'play' || MH.mode !== 'panorama' || e.pointerId !== d.id) return; const cfg = mhPanoCfg(); const a = mhPanoArea(); const rad = Math.PI / 180;
    const vf = cfg.fov; const hf = 2 * Math.atan(Math.tan(vf * rad / 2) * a.w / a.h) / rad; const dx = p.x - d.x; const dy = p.y - d.y; d.x = p.x; d.y = p.y; d.moved = (d.moved || 0) + Math.hypot(dx, dy);
    MH.pano.yaw = mhNorm(MH.pano.yaw - dx * (hf / a.w) * cfg.sens); MH.pano.pitch = Math.max(cfg.pitchMin, Math.min(cfg.pitchMax, MH.pano.pitch + dy * (vf / a.h) * cfg.sens * cfg.pitchSens)); MHP.dirty = true;
  }
  function mhLayerToggle(id) { MH.dev.hide = MH.dev.hide || {}; MH.dev.hide[id] = !MH.dev.hide[id]; MHP.dirty = true; }
  function mhMarkToggle() { MH.dev.mark = !MH.dev.mark; MHP.dirty = true; }
  function mhPixelStep(d) { const c = mhPanoCfg().pixel; c.level = (c.level + d + c.levels.length) % c.levels.length; MHP.dirty = true; }
  function mhScanStep(d) { const c = mhPanoCfg().pixel; c.scan = Math.max(0, Math.min(0.8, Math.round((c.scan + d * 0.1) * 10) / 10)); MHP.dirty = true; }
  function mhSetMode(m) { MH.mode = m; MH.zoom = null; MH.fade = null; MH.pano.drag = null; if (m === 'panorama') mhPanoLoad(); MHP.dirty = true; }
  function mhDrawPano() {
    mhPanoLoad(); const a = mhPanoArea(); rect(a.x - 1, a.y - 1, a.w + 2, a.h + 2, '#241c34'); rect(a.x, a.y, a.w, a.h, '#05040a'); mhPanoRender();
    if (MHP.loaded && MHP.buf) {
      const px = mhPx(); const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = !px.k; if (!px.k) ctx.imageSmoothingQuality = 'high'; ctx.drawImage(MHP.buf, a.x, a.y, a.w, a.h); ctx.imageSmoothingEnabled = sm;   // ドット時はニアレストネイバー拡大（境界をぼかさない）
      if (px.scan > 0) { const step = px.k || 2; const ga = ctx.globalAlpha; ctx.globalAlpha = Math.min(0.9, px.scan); ctx.fillStyle = '#000000'; const lh = Math.max(1, Math.round(step / 3)); for (let y = a.y + step - lh; y < a.y + a.h; y += step) ctx.fillRect(a.x, y, a.w, Math.min(lh, a.y + a.h - y)); ctx.globalAlpha = ga; }   // 走査線：ドット行ごとに細い暗線
    } else drawTextCenter('LOADING', W / 2, a.y + a.h / 2, '#8a7a9a', 1);
    if (typeof DEV_MODE !== 'undefined' && DEV_MODE) { const t = 'YAW ' + Math.round(MH.pano.yaw) + ' PITCH ' + Math.round(MH.pano.pitch) + ' FOV ' + mhPanoCfg().fov + ' PX ' + mhPx().name + ' SCAN ' + Math.round(mhPx().scan * 100) + (MHP.test ? ' TEST' : '') + (MHP.tainted ? ' SIMPLE' : ''); drawText(t, a.x + 3, a.y + a.h - 8, '#ffe9a0', 1, '#000000'); }
  }
  // ---- 開始 ----
  function mhEnterRoom(room, wall) { MH.room = room; MH.wall = wall || mhRoom().start; MH.zoom = null; MH.fade = null; MH.tapFx = null; mhPreload(room); }
  function mhInsert() {
    if (MH.paying || MH.phase === 'play') return; if (P_().money < MHC.playCost) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    MH.paying = true; chargeYen(MHC.playCost); writeSave(); beep(220, 0, 0.2, 0.05, 'sine', 160); mhStart('bedroom'); MH.paying = false;
  }
  function mhStart(room, wall) { MH.phase = 'play'; mhEnterRoom(room || 'bedroom', wall); mhPanoReset(); if (MH.mode === 'panorama') mhPanoLoad(); }       // 料金なし（DEV用）はこちらを直接呼ぶ
  // ---- 操作 ----
  function mhPointer(e, p) {
    if (MH.phase === 'play' && MH.mode === 'panorama') { if (MH.zoom) { mhZoomTap(p); return; } if (MH.fade) return; const a = mhPanoArea(); if (p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) { MH.pano.drag = { id: e.pointerId, x: p.x, y: p.y, moved: 0 }; try { if (e.target && e.target.setPointerCapture && e.pointerId !== undefined) e.target.setPointerCapture(e.pointerId); } catch (er) { /* 取れなくても動く */ } } return; }
    if (MH.phase !== 'play' || MH.fade || MH.zoom) return; const sc = mhScene(); const ix = (p.x - sc.ox) / sc.s; const iy = (p.y - sc.oy) / sc.s; const hits = mhWall().hits;
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; const r = h.rect; if (ix >= r[0] && ix <= r[0] + r[2] && iy >= r[1] && iy <= r[1] + r[3]) { MH.tapFx = { x: p.x, y: p.y, t: 0 }; mhAction(h.action); return; } }
    MH.tapFx = { x: p.x, y: p.y, t: 0, miss: true }; beep(260, 0, 0.04, 0.02, 'sine');
  }
  // ---- パノラマ内のタップ（ベッドの透過レイヤーの「見えている部分」＝透明でない画素を当たりにする。回転に自動で追従） ----
  function mhPanoTap(x, y) {
    const cfg = mhPanoCfg(); const a = mhPanoArea(); const rad = Math.PI / 180; const st = MH.pano; const f = (a.h / 2) / Math.tan(cfg.fov * rad / 2);
    const px = x - (a.x + a.w / 2); const py = -(y - (a.y + a.h / 2)); const l = Math.hypot(px, py, f); const x0 = px / l; const y0 = py / l; const z0 = f / l;
    const cp = Math.cos(st.pitch * rad); const sp = Math.sin(st.pitch * rad); const cy = Math.cos(st.yaw * rad); const sy = Math.sin(st.yaw * rad);
    const y1 = y0 * cp + z0 * sp; const z1 = -y0 * sp + z0 * cp; const x2 = x0 * cy + z1 * sy; const z2 = -x0 * sy + z1 * cy;      // 描画と同じ回転
    const lon = Math.atan2(x2, z2) / rad; const lat = Math.asin(Math.max(-1, Math.min(1, y1))) / rad; if (MH.dev.boxes) MH.tapFx = { x, y, t: 0 };
    for (const L of (cfg.layers || []).slice().reverse()) {
      if (!L.tap || !mhLayerOn(L.id)) continue; const ly = (MHP.layers || []).find((q) => q.id === L.id); let hit = false;
      if (ly && ly.data) { const u = (((lon / 360 + 0.5) % 1) + 1) % 1; const v = 0.5 - lat / 180; const ix = Math.min(MHP.w - 1, Math.floor(u * MHP.w)); const iy = Math.max(0, Math.min(MHP.h - 1, Math.floor(v * MHP.h))); hit = ly.data[(iy * MHP.w + ix) * 4 + 3] >= 60; }
      else if (L.tapBox) { const b = L.tapBox; hit = lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]; }      // 画素が読めない時（file://）の予備：緯度経度の箱
      if (hit) { mhAction(L.tap); return; }
    }
    for (const T of (cfg.taps || [])) { const u = (((lon / 360 + 0.5) % 1) + 1) % 1 * (cfg.tapW || 2000); const v = (0.5 - lat / 180) * (cfg.tapH || 1000); if (mhInPoly([u, v], T.poly)) { mhAction(T.action); return; } }   // 画像に家具が焼き込まれている時：パノラマ画像上の多角形（座標は 2000×1000 基準）
    beep(260, 0, 0.04, 0.02, 'sine');
  }
  // ---- 共通演出：短い暗転 → 状態を切り替え → 操作テキスト（どの家具でも mhChange(切り替え処理, 'テキスト') で使える）----
  function mhChange(apply, say) {      /* 暗転時間は家具ごとに zooms.◯◯.dipTime で上書きできる */
    if (MH.dip || MH.fade) return false; const Zc = MH.zoom && mhRoom().zooms[MH.zoom]; const dt0 = Zc && Zc.dipTime !== undefined ? Zc.dipTime : mhFx().dipTime; if (dt0 <= 0) { apply(); if (say) mhSay(say); noise(0.06, 0.02); beep(180, 0, 0.08, 0.035, 'triangle', 120); return true; }      // 暗転なし（dipTime: 0）：すぐ切り替えてテキストだけ出す
    MH.dip = { t: 0, dur: Math.max(0.02, dt0), apply, say, done: false }; noise(0.1, 0.03); beep(180, 0, 0.1, 0.04, 'triangle', 120); return true; }
  const mhFx = () => MHC.fx;
  function mhSay(str) { MH.say = str ? { str, t: 0 } : null; }
  function mhFxUpdate(dt) {
    const D = MH.dip; if (D) { D.t += dt; if (!D.done && D.t >= D.dur / 2) { D.done = true; D.apply(); if (D.say) mhSay(D.say); } if (D.t >= D.dur) MH.dip = null; }
    if (MH.say) { MH.say.t += dt; if (MH.say.t >= mhFx().textTime) MH.say = null; }
  }
  function mhFxReset() { MH.dip = null; MH.say = null; }
  function mhToggleTap(Z) { const T = Z.toggle; if (!T || MH.fade || MH.dip) return; const fl = mhZFlags(); if (!fl[T.flag]) return; mhChange(() => { fl[T.flag] = false; }, T.say); }     // 「閉める」ボタン
  // ---- アップ画面のタップ（画像の表示倍率・位置に追従。多角形で判定） ----
  // アップ画面の状態（通常 / 枕 / 掛け布団）。最後に操作した方だけを表示する。
  const mhZFlags = (id) => (MH.zs[id || MH.zoom] = MH.zs[id || MH.zoom] || {});      // 枕・掛け布団はそれぞれ独立したフラグ
  const mhZState = (id) => { const Z = mhRoom().zooms[id || MH.zoom]; const f = mhZFlags(id); const on = (Z.flags || []).filter((k) => f[k]); return on.length ? on.join('+') : 'normal'; };      // 立っているフラグの組み合わせ → どの画像か（例：pillow+blanket）
  function mhZoomFit(Z, im) { if (!Z.cover) return mhFit(im.naturalWidth, im.naturalHeight); const a = mhFit(1, 1, true); const s = Math.max(a.aw / im.naturalWidth, a.ah / im.naturalHeight); const dw = im.naturalWidth * s; const dh = im.naturalHeight * s; return { s, ox: a.ax + (a.aw - dw) / 2, oy: a.ay + (a.ah - dh) * (Z.anchorY === undefined ? 0.5 : Z.anchorY), dw, dh }; }   // 画面いっぱいに（見回しと同じ比率）。はみ出す分は上から切る
  function mhZoomFile(Z) { return Z.states ? (Z.states[mhZState()] || Z.file) : Z.file; }
  function mhZoomReset(id) { const Z = id && mhRoom().zooms[id]; if (Z && !Z.keepState) delete MH.zs[id]; }      // アップを閉じた時の状態リセット（保持に戻すなら config の keepState: true にするだけ）
  function mhInPoly(pt, poly) { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]; const b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
  function mhZoomTap(p) {
    if (MH.fade || MH.dip) return; const Z = mhRoom().zooms[MH.zoom]; const im = mhImg(MH.room, mhZoomFile(Z)); if (!im || !Z.hits) return; const sc = mhZoomFit(Z, im); const pt = [(p.x - sc.ox) / sc.s, (p.y - sc.oy) / sc.s];
    const cur = mhZState(); const fl = mhZFlags(); for (const h of Z.hits) { if (fl[h.flag]) continue; const poly = h.polys && h.polys[cur]; if (!poly) continue; if (mhInPoly(pt, poly)) { const fg = h.flag; mhChange(() => { fl[fg] = true; }, h.say); return; } }
  }
  function mhAction(a) { if (a && a.zoom) mhZoomTo(a.zoom); }
  function mhZoomTo(id) { if (MH.fade || MH.dip) return; MH.fade = { t: 0, dur: MHC.fadeTime * 2, to: id }; noise(0.22, 0.04); beep(110, 0, 0.45, 0.04, 'sawtooth', 80); }
  function mhBack() { if (MH.fade || MH.dip || !MH.zoom) return; MH.fade = { t: 0, dur: MHC.fadeTime * 2, to: null }; noise(0.12, 0.03); beep(90, 0.05, 0.2, 0.04, 'sine', 60); }
  function mhTurn(d) { if (MH.phase !== 'play' || MH.zoom || MH.fade) return; const o = mhRoom().wallOrder; MH.wall = o[(o.indexOf(MH.wall) + d + o.length) % o.length]; MH.tapFx = null; }      // DEV：壁を回す
  // ---- 更新 ----
  function mhUpdate(dt) {
    dt = Math.min(dt, 0.05); MH.clock += dt; if (MH.phase !== 'play') return;
    const F = MH.fade; if (F) { const half = F.dur / 2; const was = F.t; F.t += dt; if (was < half && F.t >= half) { const old = MH.zoom; MH.zoom = F.to; if (!F.to) { mhZoomReset(old); mhFxReset(); } } if (F.t >= F.dur) MH.fade = null; }
    mhFxUpdate(dt);
    if (MH.tapFx) { MH.tapFx.t += dt; if (MH.tapFx.t > 0.5) MH.tapFx = null; }
  }
  // ---- 描画 ----
  function mhPlaceholder(r, col, label) { ctx.globalAlpha = 0.5; rect(r.x, r.y, r.w, r.h, col); ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); if (r.w > 26 && r.h > 8) drawTextCenter(label, r.x + r.w / 2, r.y + r.h / 2 - 2, '#ffffff', 1); }
  function mhDrawImg(im, sc, x, y) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, sc.ox + x * sc.s, sc.oy + y * sc.s, im.naturalWidth * sc.s, im.naturalHeight * sc.s); ctx.imageSmoothingEnabled = sm; }
  function mhDrawWall() {
    const R = mhRoom(); const Wl = mhWall(); const sc = mhScene(); const bg = mhImg(MH.room, Wl.bg);
    if (bg) mhDrawImg(bg, sc, 0, 0); else { rect(sc.ox, sc.oy, sc.dw, sc.dh, '#1a1620'); rect(sc.ox, sc.oy + sc.dh * 0.62, sc.dw, sc.dh * 0.38, '#2a1c18'); drawTextCenter('NO IMAGE', sc.ox + sc.dw / 2, sc.oy + 6, '#8a7a9a', 1); drawTextCenter(R.name + ' ' + Wl.label, sc.ox + sc.dw / 2, sc.oy + 16, '#8a7a9a', 1); }
    for (const l of Wl.layers.slice().sort((a, b) => a.z - b.z)) {
      const im = mhImg(MH.room, l.file); if (im) mhDrawImg(im, sc, l.x || 0, l.y || 0);
      else if (l.ph) mhPlaceholder({ x: sc.ox + (l.ph[0] + (l.x || 0)) * sc.s, y: sc.oy + (l.ph[1] + (l.y || 0)) * sc.s, w: l.ph[2] * sc.s, h: l.ph[3] * sc.s }, l.ph[4], l.ph[5]);
    }
    if (MH.dev.boxes) for (const h of Wl.hits) { const r = h.rect; ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.strokeRect(sc.ox + r[0] * sc.s + 0.5, sc.oy + r[1] * sc.s + 0.5, r[2] * sc.s, r[3] * sc.s); drawText(h.id, sc.ox + r[0] * sc.s + 2, sc.oy + r[1] * sc.s + 2, '#00ff88', 1); }
  }
  function mhDrawZoom() {
    const R = mhRoom(); const Z = R.zooms[MH.zoom]; const im = mhImg(MH.room, mhZoomFile(Z));
    if (im) { const sc = mhZoomFit(Z, im); mhDrawImg(im, sc, 0, 0); if (MH.dev.boxes && Z.hits) for (const h of Z.hits) { const poly = h.polys && h.polys[mhZState()]; if (!poly || mhZFlags()[h.flag]) continue; ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1; ctx.beginPath(); poly.forEach((q, i) => { const X = sc.ox + q[0] * sc.s; const Y = sc.oy + q[1] * sc.s; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); ctx.stroke(); } } else { const sc = mhScene(); rect(sc.ox, sc.oy, sc.dw, sc.dh, '#2a1a10'); rect(sc.ox + sc.dw * 0.1, sc.oy + sc.dh * 0.1, sc.dw * 0.8, sc.dh * 0.8, '#0e0806'); rect(sc.ox, sc.oy + sc.dh * 0.1, sc.dw * 0.1, sc.dh * 0.8, '#4a2e1a'); rect(sc.ox + sc.dw * 0.9, sc.oy + sc.dh * 0.1, sc.dw * 0.1, sc.dh * 0.8, '#4a2e1a'); drawTextCenter('NO IMAGE', sc.ox + sc.dw / 2, sc.oy + sc.dh / 2 - 8, '#8a7a9a', 1); drawTextCenter(Z.ph || Z.label, sc.ox + sc.dw / 2, sc.oy + sc.dh / 2 + 4, '#8a7a9a', 1); }
  }
  function mhDrawPlay() {
    rect(0, 0, W, H, '#05040a'); const R = mhRoom();
    if (MH.mode === 'panorama') { drawText('MYSTERY HOUSE', 8, 8, '#6a5a9a', 1); const tg = R.name + (MH.zoom ? ' / ' + R.zooms[MH.zoom].label : ' / 360'); drawText(tg, W - 8 - textWidth(tg, 1), 8, '#8a6a6a', 1);
      if (MH.zoom) { const a = mhPanoArea(); rect(a.x - 1, a.y - 1, a.w + 2, a.h + 2, '#241c34'); rect(a.x, a.y, a.w, a.h, '#05040a'); ctx.save(); ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); ctx.clip(); mhDrawZoom(); ctx.restore(); } else mhDrawPano();
      const F = MH.fade; if (F) { const a = mhPanoArea(); const u = F.t / F.dur; ctx.globalAlpha = u < 0.5 ? u * 2 : 2 - u * 2; rect(a.x, a.y, a.w, a.h, '#020206'); ctx.globalAlpha = 1; }
      const D = MH.dip; if (D) { const a = mhPanoArea(); const u = D.t / D.dur; ctx.globalAlpha = Math.min(1, (u < 0.5 ? u * 2 : 2 - u * 2) * mhFx().dipAlpha); rect(a.x, a.y, a.w, a.h, '#020206'); ctx.globalAlpha = 1; } return; }
    const a = mhArea(); drawText('MYSTERY HOUSE', 10, 12, '#6a5a9a', 1); const tag = R.name + (MH.zoom ? ' / ' + R.zooms[MH.zoom].label : ' / ' + mhWall().label); drawText(tag, W - 10 - textWidth(tag, 1), 12, '#8a6a6a', 1); rect(a.x - 1, a.y - 1, a.w + 2, a.h + 2, '#241c34');
    ctx.save(); ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); ctx.clip(); if (MH.zoom) mhDrawZoom(); else mhDrawWall();
    const F = MH.fade; if (F) { const u = F.t / F.dur; ctx.globalAlpha = u < 0.5 ? u * 2 : 2 - u * 2; rect(a.x, a.y, a.w, a.h, '#020206'); ctx.globalAlpha = 1; }
    const T = MH.tapFx; if (T) { const u = T.t / 0.5; ctx.globalAlpha = 1 - u; ctx.strokeStyle = T.miss ? '#8a8aaa' : '#ffe9a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(T.x, T.y, 3 + u * 9, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function mhDrawIntro() {
    rect(0, 0, W, H, '#05060c'); for (let y = 0; y < 250; y += 4) rect(0, y, W, 4, mhMix('#0a1030', '#1c2a58', y / 250)); rect(W * 0.74 - 10, 40, 20, 20, '#dfe8ff'); for (let i = 0; i < 22; i++) rect((i * 53) % W, 6 + (i * 29) % 120, 1, 1, '#8a9acc');
    const gy = 214; rect(0, gy, W, 60, '#0a0e18'); const bx = W * 0.14; const bw = W * 0.72; rect(bx, gy - 90, bw, 90, '#0c0e1c'); ctx.fillStyle = '#080a14'; ctx.beginPath(); ctx.moveTo(bx - 8, gy - 90); ctx.lineTo(W / 2, gy - 136); ctx.lineTo(bx + bw + 8, gy - 90); ctx.fill();
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rect(bx + 10 + c * (bw - 20) / 4 + 2, gy - 80 + r * 40, 14, 22, (r === 1 && c === 2) ? '#e8c078' : '#14182c'); rect(W / 2 - 7, gy - 26, 14, 26, '#06060c');
    drawTextCenter('MYSTERY', W / 2, 22, '#e8c078', 4, '#3a1c08'); drawTextCenter('HOUSE', W / 2, 52, '#b8a8ff', 4, '#1a1038'); rect(0, 274, W, H - 274, '#05040a'); rect(0, 274, W, 1, '#2a2244');
    drawTextCenter('YEN ' + P_().money, W / 2, 284, '#a8b8ff', 1); drawTextCenter('1 PLAY  YEN ' + MHC.playCost, W / 2, 297, '#a8b8ff', 1);
  }
  const mhMix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a); const y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  // ---- DOM ----
  const MH_DOM = {};
  function mhBuildDom() {
    if (MH_DOM.play) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); b.addEventListener('click', () => { ensureAudio(); fn(b); }); return b; };
    MH_DOM.play = mk('mh-play', 'PLAY　¥' + MHC.playCost, 'hb-go', mhInsert); MH_DOM.back = mk('mh-back', 'もどる', 'hb-go', mhBack); MH_DOM.free = mk('mh-free', 'DEV：寝室へ（料金なし）', '', () => mhStart('bedroom'));
    MH_DOM.boxes = mk('mh-boxes', '', '', () => { MH.dev.boxes = !MH.dev.boxes; }); MH_DOM.mode = mk('mh-mode', '', '', () => { mhSetMode(MH.mode === 'panorama' ? 'walls' : 'panorama'); }); MH_DOM.prev = mk('mh-prev', '◀', '', () => mhTurn(-1)); MH_DOM.next = mk('mh-next', '▶', '', () => mhTurn(1)); MH_DOM.res = mk('mh-res', '', '', () => mhPixelStep(1)); MH_DOM.scm = mk('mh-scm', '線−', '', () => mhScanStep(-1)); MH_DOM.scp = mk('mh-scp', '線＋', '', () => mhScanStep(1)); MH_DOM.mark = mk('mh-mark', '', '', () => mhMarkToggle()); MH_DOM.bed = mk('mh-bed', '', '', () => mhLayerToggle('bed')); MH_DOM.tog = mk('mh-tog', '閉める', 'hb-go', () => { const Z = MH.zoom && mhRoom().zooms[MH.zoom]; if (Z) mhToggleTap(Z); });
    const sy = document.createElement('div'); sy.className = 'nk-say mh-say'; sy.id = 'mh-say'; screenEl.appendChild(sy); MH_DOM.say = sy;
    const d = document.createElement('div'); d.className = 'nk-say'; d.id = 'mh-help'; d.innerHTML = 'いま かいちく ちゅう。<br>しんしつの クローゼットを タップして みよう。<br><span class="nk-dim">かぐを じかに タップ。「もどる」で もとの へやへ</span>'; screenEl.appendChild(d); MH_DOM.help = d;
  }
  function mhUi() {
    mhBuildDom(); const ph = MH.phase; const show = (el, on) => el.classList.toggle('is-show', !!on); const play = ph === 'play'; const dev = typeof DEV_MODE !== 'undefined' && DEV_MODE;
    show(MH_DOM.play, ph === 'intro'); show(MH_DOM.help, ph === 'intro'); show(MH_DOM.free, ph === 'intro' && dev);  const pm = MH.mode === 'panorama'; show(MH_DOM.boxes, play && dev && !pm); show(MH_DOM.mode, play && dev && !MH.zoom); show(MH_DOM.res, play && dev && pm && !MH.zoom); show(MH_DOM.mark, play && dev && pm && !MH.zoom); show(MH_DOM.bed, play && dev && pm && !MH.zoom && !!(mhPanoCfg().layers || []).length); show(MH_DOM.scm, play && dev && pm && !MH.zoom); show(MH_DOM.scp, play && dev && pm && !MH.zoom); show(MH_DOM.prev, play && dev && !MH.zoom && !pm); show(MH_DOM.next, play && dev && !MH.zoom && !pm); show(MH_DOM.back, play && !!MH.zoom && !MH.fade && !MH.dip); { const Zt = MH.zoom && mhRoom().zooms[MH.zoom]; show(MH_DOM.tog, play && !!(Zt && Zt.toggle) && !MH.fade && !MH.dip && !!mhZFlags()[Zt.toggle.flag]); if (Zt && Zt.toggle) MH_DOM.tog.textContent = Zt.toggle.label; const st = MH.say && MH.zoom ? MH.say.str : ''; show(MH_DOM.say, !!st); if (MH_DOM.say.textContent !== st) MH_DOM.say.textContent = st; }
    const bt = '判定 ' + (MH.dev.boxes ? 'ON' : 'OFF'); if (MH_DOM.boxes.textContent !== bt) MH_DOM.boxes.textContent = bt;
    crPlace(MH_DOM.play, { x: 24, y: 322, w: W - 48, h: 34 }); crPlace(MH_DOM.free, { x: 24, y: 360, w: W - 48, h: 18 }); crPlace(MH_DOM.help, { x: 10, y: 150, w: W - 20, h: 72 }); crPlace(MH_DOM.say, { x: 4, y: 298, w: W - 8, h: 28 }); crPlace(MH_DOM.tog, { x: W / 2 - 48, y: 266, w: 96, h: 24 }); crPlace(MH_DOM.back, { x: 24, y: pm ? 334 : 322, w: W - 48, h: 38 });
    const ry = pm ? 332 : 304; const mt = MH.mode === 'panorama' ? '360 → 3方向' : '3方向 → 360'; if (MH_DOM.mode.textContent !== mt) MH_DOM.mode.textContent = mt; const ry2 = ry + 20; const bdt = 'ベッド ' + (mhLayerOn('bed') ? 'ON' : 'OFF'); if (MH_DOM.bed.textContent !== bdt) MH_DOM.bed.textContent = bdt; crPlace(MH_DOM.bed, { x: 94, y: ry + 40, w: 70, h: 16 }); const mkt = '窓の ○ ' + (MH.dev.mark ? 'ON' : 'OFF'); if (MH_DOM.mark.textContent !== mkt) MH_DOM.mark.textContent = mkt; crPlace(MH_DOM.mark, { x: 8, y: ry + 40, w: 80, h: 16 }); const rt = 'ドット：' + mhPx().name; if (MH_DOM.res.textContent !== rt) MH_DOM.res.textContent = rt; crPlace(MH_DOM.res, { x: 8, y: ry2, w: 104, h: 16 }); crPlace(MH_DOM.scm, { x: W - 70, y: ry2, w: 30, h: 16 }); crPlace(MH_DOM.scp, { x: W - 36, y: ry2, w: 28, h: 16 }); crPlace(MH_DOM.boxes, { x: 8, y: ry, w: 50, h: 16 }); crPlace(MH_DOM.mode, { x: pm ? 8 : 62, y: ry, w: 74, h: 16 }); crPlace(MH_DOM.prev, { x: W - 70, y: ry, w: 30, h: 16 }); crPlace(MH_DOM.next, { x: W - 36, y: ry, w: 28, h: 16 });
    MH_DOM.say.style.fontSize = Math.max(11, parseFloat(MH_DOM.say.style.fontSize) * 0.8) + 'px'; MH_DOM.tog.style.fontSize = Math.max(10, parseFloat(MH_DOM.tog.style.fontSize) * 0.8) + 'px';
    for (const el of [MH_DOM.play, MH_DOM.back, MH_DOM.free]) el.style.fontSize = Math.max(10, parseFloat(el.style.fontSize) * (el === MH_DOM.free ? 0.7 : 0.95)) + 'px'; for (const el of [MH_DOM.boxes, MH_DOM.mode, MH_DOM.prev, MH_DOM.next, MH_DOM.res, MH_DOM.scm, MH_DOM.scp, MH_DOM.mark, MH_DOM.bed]) el.style.fontSize = Math.max(9, parseFloat(el.style.fontSize) * 0.75) + 'px'; MH_DOM.help.style.fontSize = Math.max(10, parseFloat(MH_DOM.help.style.fontSize) * 0.9) + 'px';
  }
  function mhHide() { if (!MH_DOM.play) return; Object.keys(MH_DOM).forEach((k) => MH_DOM[k].classList.remove('is-show')); }
  function mhDraw() { if (MH.phase === 'intro') mhDrawIntro(); else mhDrawPlay(); mhUi(); }
  // ---- DEV ----
  function openMhDev() {
    const again = (f) => () => { f(); setTimeout(openMhDev, 0); }; const R = mhRoom();
    showDialog({ title: 'MYSTERY HOUSE DEV', wide: true, lines: [{ text: 'PHASE ' + MH.phase + ' / ' + MH.room + ' / ' + MH.wall + ' / ZOOM ' + (MH.zoom || '-') + ' / MODE ' + MH.mode + ' / FOV ' + mhPanoCfg().fov + ' / YAW0 ' + (mhPanoCfg().yaw0 || 0) + ' / 判定 ' + (MH.dev.boxes ? 'ON' : 'OFF') + ' / 画像 ' + (MH.dev.noImg ? '仮表示' : '通常'), cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) }, { label: '寝室へ（西・料金なし）', onClick: () => { mhStart('bedroom', 'west'); } },
      ...R.wallOrder.map((w) => ({ label: '寝室：' + R.walls[w].label + ' の壁', onClick: () => { mhStart('bedroom', w); } })), { label: 'クローゼットのアップ', onClick: () => { mhStart('bedroom', 'west'); MH.zoom = 'closetOpen'; } },
      { label: '360 ⇔ 3方向 切りかえ', onClick: again(() => { mhSetMode(MH.mode === 'panorama' ? 'walls' : 'panorama'); }) }, { label: 'ベッド表示 ON/OFF', onClick: again(() => mhLayerToggle('bed')) }, { label: '窓の ○ 表示 ON/OFF', onClick: again(mhMarkToggle) }, { label: 'ドット解像度 切りかえ', onClick: again(() => mhPixelStep(1)) }, { label: '走査線 −', onClick: again(() => mhScanStep(-1)) }, { label: '走査線 ＋', onClick: again(() => mhScanStep(1)) }, { label: 'FOV −5', onClick: again(() => { mhPanoCfg().fov = Math.max(30, mhPanoCfg().fov - 5); MHP.dirty = true; }) }, { label: 'FOV +5', onClick: again(() => { mhPanoCfg().fov = Math.min(120, mhPanoCfg().fov + 5); MHP.dirty = true; }) },
      { label: '最初の向き −45°', onClick: again(() => { mhPanoCfg().yaw0 = mhNorm((mhPanoCfg().yaw0 || 0) - 45); mhPanoReset(); }) }, { label: '最初の向き +45°', onClick: again(() => { mhPanoCfg().yaw0 = mhNorm((mhPanoCfg().yaw0 || 0) + 45); mhPanoReset(); }) },
      { label: '判定を表示 ON/OFF', onClick: again(() => { MH.dev.boxes = !MH.dev.boxes; }) }, { label: '画像なし（仮表示）ON/OFF', onClick: again(() => { MH.dev.noImg = !MH.dev.noImg; }) },
      { label: '旧 HORROR HOUSE を開く', onClick: () => { moveFade(() => enterMachine(HH_MACHINE)); } }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('mystery', {
    reset() { MH.phase = 'intro'; }, phase: () => (MH.phase === 'play' ? 'play' : 'idle'),
    enter() { mhBuildDom(); MH.pano.drag = null; MH.phase = 'intro'; MH.paying = false; MH.zoom = null; MH.fade = null; mhPreload('bedroom'); setMessage('', C.cyan); },
    update: mhUpdate, draw: mhDraw, hint: 'かぐを タップして しらべよう',
    pointer: mhPointer, pointerUp() { const d = MH.pano.drag; MH.pano.drag = null; if (d && (d.moved || 0) < 5 && MH.phase === 'play' && MH.mode === 'panorama' && !MH.zoom && !MH.fade) mhPanoTap(d.x, d.y); }
  });
  GAME_TYPES.mystery.canLeave = () => true;
  GAME_TYPES.mystery.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });
