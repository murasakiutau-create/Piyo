'use strict';
  // =====================================================================
  //  🛗 全館ナビゲーション：エレベーター ＋ ▲▼
  //   ▲▼＝となりの階へ、すぐ移動（みじかい暗転だけ）／ELEVATOR＝すきな階へ、ドアが閉まって・階数表示が変わって・チーン♪・ドアが開く演出つき（SKIPできる）
   //  フロアの一覧は FLOOR_DEFS（1か所）。ふやすときは、ここに1件足すだけで、操作盤のボタン・▲▼・最上階の判定に、反映される
  //  無料・DAYは進まない・保存データは、変えない
  // =====================================================================
  const floorDef = (n) => FLOOR_DEFS.find((d) => d.floor === n && d.enabled !== false) || null;
  const floorsEnabled = () => FLOOR_DEFS.filter((d) => d.enabled !== false);
  const floorMax = () => Math.max(...floorsEnabled().map((d) => d.floor));
  const floorMin = () => Math.min(...floorsEnabled().map((d) => d.floor));
  function applyFloor(def) {                                                                                             // 階の画面へ、切りかえる（暗転や、エレベーターのドアの裏で、呼ばれる）
    currentMachine = null; if (def.scene === 'center') { scene = 'center'; centerFloor = def.cf; D_().floor = centerFloor; writeSave(); } else scene = def.scene; updateSceneUi();
  }
  function floorGo(target) {                                                                                             // ▲▼：となりの階へ、すぐ
    const def = floorDef(target); const cur = floorNo(); if (!def || target === cur || moveBusy || floorFade || ELV.busy) return false; const dir = target > cur ? 1 : -1;
    moveFade(() => { applyFloor(def); stairSfx(dir); }); return true;
  }
  const ELEV_DOOR = () => ({ x: W - 70, y: 256, w: 30, h: 66 });                                                         // ▲▼との間に、すき間（10px）
  const navUp = () => stairUpBox(); const navDown = () => stairDownBox();
  function drawNav(n) {                                                                                                  // どの階でも、同じ場所：エレベーターの扉・▲・▼（BOTTOM_DY だけ下がった座標の中で描く）
    if (ELV.snapping) return;                                                                                            // エレベーターの中から見える景色には、エレベーターを描かない
    const d = ELEV_DOOR(); const t = animT();
    rect(d.x - 2, d.y - 2, d.w + 4, d.h + 4, '#2a2e38'); rect(d.x - 2, d.y - 2, d.w + 4, 2, '#8a92a4'); rect(d.x, d.y, d.w, 11, '#0a0c10'); drawTextCenter(n + 'F', d.x + d.w / 2 + 0.5, d.y + 3, '#ffb040', 1);                      // 階数表示
    const half = Math.floor((d.w - 2) / 2); for (let k = 0; k < 2; k++) { const px = d.x + 1 + k * (half + 0); rect(px, d.y + 12, half, d.h - 12, '#aab2c0'); rect(px, d.y + 12, 2, d.h - 12, '#e8ecf4'); rect(px + half - 3, d.y + 12, 3, d.h - 12, '#7a8294'); for (let y = d.y + 18; y < d.y + d.h - 6; y += 10) rect(px + 2, y, half - 5, 1, '#8a92a4'); }
    rect(d.x + Math.floor(d.w / 2) - 1, d.y + 12, 2, d.h - 12, '#3a3e48'); rect(d.x - 2, d.y + d.h, d.w + 4, 3, '#4a4e5a');
    ctx.globalAlpha = 0.16 + 0.1 * softPulse(1.2, 0); rect(d.x, d.y + 12, d.w, d.h - 12, '#fff3c0'); ctx.globalAlpha = 1;
    for (const [r, dir] of [[navUp(), 1], [navDown(), -1]]) {
      if (!floorDef(n + dir)) continue; rect(r.x, r.y, r.w, r.h, '#4a3a78'); rect(r.x, r.y, r.w, 2, '#8a7ac8'); rect(r.x, r.y + r.h - 2, r.w, 2, '#2a1e48'); rect(r.x, r.y, 2, r.h, '#6a5aa0');
      const cx = r.x + Math.floor(r.w / 2); const cy = r.y + Math.floor(r.h / 2); for (let i = 0; i < 6; i++) rect(cx - i, dir > 0 ? cy - 4 + i * 2 : cy + 4 - i * 2 - 1, i * 2 + 1, 2, '#ffe9a0');                    // ▲ ▼
    }
    const ra = D_().rec && D_().rec.active; if (ra) { const rf = floorOfMachine(ra) + 2; const tgt = rf > n ? navUp() : rf < n ? navDown() : null; if (tgt && floorDef(rf > n ? n + 1 : n - 1)) { rect(tgt.x + tgt.w - 8, tgt.y - 4, 12, 12, '#fff3a0'); rect(tgt.x + tgt.w - 8, tgt.y - 4, 12, 1, '#6a5a20'); drawTextCenter('!', tgt.x + tgt.w - 1.5, tgt.y - 1, '#c02030', 1); } }   // おすすめが、べつの階にあるとき：! をつける
  }
  function navTap(pb, n) {                                                                                               // 扉＝エレベーターへ／▲▼＝となりの階へ
    const d = ELEV_DOOR(); if (inRect(pb, { x: d.x - 3, y: d.y - 3, w: d.w + 6, h: d.h + 8 })) { openElevator(n); return true; }
    if (floorDef(n + 1) && inRect(pb, navUp())) { floorGo(n + 1); return true; } if (floorDef(n - 1) && inRect(pb, navDown())) { floorGo(n - 1); return true; } return false;
  }
  // ---- エレベーターの中 ----
  const ELV = { busy: false, active: false, phase: 'idle', from: 1, to: 1, shown: 1, sel: 0, door: 1, t: 0, last: 0, snapCur: null, snapTo: null, snapping: false, stepAt: 0, total: 1, hum: 0, doorTick: 0, waitLeft: 0, waitMax: 2.0, dev: { openOnly: false } };
  const ELV_DOM = {};
  function elevMakeSnap(def) {                                                                                           // ある階の景色を、1枚の絵にとる（ドアの向こうに、見せる）。いま乗っているエレベーターは、描かない
    const sv = { scene, centerFloor }; const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height; ELV.snapping = true;
    try { if (def.scene === 'center') { scene = 'center'; centerFloor = def.cf; } else scene = def.scene; if (def.scene === 'b1') drawB1(); else if (def.scene === 'b2') drawB2(); else if (def.scene === 'b3') drawB3(); else if (def.scene === 'b4') drawB4(); else if (def.scene === 'b5') drawB5(); else drawCenter(); c.getContext('2d').drawImage(canvas, 0, 0); } catch (er) { /* 絵がとれなくても、動く */ }
    ELV.snapping = false; scene = sv.scene; centerFloor = sv.centerFloor; return c;
  }
  function openElevator(n) {
    if (ELV.busy || moveBusy) return; const def = floorDef(n); if (!def) return; ELV.snapCur = elevMakeSnap(def);
    moveFade(() => { ELV.active = true; ELV.busy = false; ELV.phase = 'idle'; ELV.from = n; ELV.to = n; ELV.shown = n; ELV.sel = 0; ELV.door = 1; ELV.t = 0; ELV.last = performance.now(); ELV.snapTo = null; scene = 'elev'; updateSceneUi(); beep(880, 0, 0.08, 0.05, 'triangle'); beep(1175, 0.08, 0.1, 0.05, 'triangle'); });          // ポーン
  }
  function elevLeaveToFloor(n) { ELV.active = false; ELV.busy = false; ELV.phase = 'idle'; ELV.sel = 0; ELV.snapCur = null; ELV.snapTo = null; const def = floorDef(n) || floorDef(1); applyFloor(def); }
  function elevBack() { if (!ELV.active || ELV.phase !== 'idle' || ELV.busy) return; beep(520, 0, 0.05, 0.04, 'square'); moveFade(() => { elevLeaveToFloor(ELV.from); }); }
  function elevPick(n) {                                                                                                 // 行き先の丸ボタンを おす：ランプがつく（カチッ→ピッ）。ほかのボタンは、ロック。少し待ってから、ドアが閉まる
    if (!ELV.active || ELV.phase !== 'idle' || ELV.busy) return; if (n === ELV.from) { beep(330, 0, 0.06, 0.04, 'square'); return; } const def = floorDef(n); if (!def) return;
    ELV.busy = true; ELV.sel = n; ELV.to = n; ELV.phase = 'wait'; ELV.waitLeft = ELV.waitMax; ELV.t = 0; ELV.hum = 0; ELV.doorTick = 0; beep(240, 0, 0.03, 0.05, 'square'); beep(1760, 0.03, 0.06, 0.06, 'square');
  }
  function elevClose() {                                                                                                 // 「閉」：行き先を選んだあと、ドアが閉まるまでの 待ち時間だけを、みじかくする（移動は、はやくならない）。さいしょの1回だけ有効
    if (!ELV.active || ELV.phase !== 'wait') return; ELV.phase = 'closing'; ELV.t = 0; ELV.waitLeft = 0; ELV.doorTick = 0; beep(1568, 0, 0.05, 0.05, 'square');
  }
  function elevOpen() {                                                                                                  // 「開」：待ち時間を のばす／とじかけのドアなら、ひらきなおす（移動中は、無効）
    if (!ELV.active) return; if (ELV.phase === 'wait') { ELV.waitLeft = Math.min(4, ELV.waitLeft + 1.2); beep(1319, 0, 0.05, 0.04, 'square'); }
    else if (ELV.phase === 'closing' && ELV.door > 0.12) { ELV.phase = 'reopen'; ELV.t = 0; ELV.reFrom = ELV.door; beep(1319, 0, 0.05, 0.04, 'square'); }
  }
  function elevSkip() {                                                                                                  // SKIP：エレベーターの演出ぜんぶを飛ばして、すぐ目的の階へ（時計もSEも、止まる）
    if (!ELV.active || ELV.phase === 'idle' || ELV.phase === 'skipped' || ELV.phase === 'done') return; const to = ELV.to; ELV.phase = 'skipped'; beep(1175, 0, 0.05, 0.04, 'square'); elevLeaveToFloor(to);
  }
  // ---- 操作盤（右上）：細長い金属パネル・丸い階数ボタン・下に「開」「閉」----
  function elevPanel() {                                                                                                // 1列で、1が いちばん下・上へ 2、3、…（本物と同じ。8階をこえたら、2列にする）
    const defs = floorsEnabled().slice().sort((a, b) => a.floor - b.floor); const n = defs.length; const cols = n > 8 ? 2 : 1; const rows = Math.ceil(n / cols); const w = cols === 2 ? 46 : 40; const px = W - 8 - w - 4; const py = 40; const rh = 24; const ph = 8 + rows * rh + 6 + 24; const btns = [];
    defs.forEach((d, i) => { const r = Math.floor(i / cols); const c = i % cols; const cx = cols === 2 ? px + 13 + c * 22 : px + Math.floor(w / 2); const cy = py + 8 + (rows - 1 - r) * rh + 12; btns.push({ floor: d.floor, cx, cy, x: cx - 11, y: cy - 11, w: 22, h: 22 }); });
    const by = py + ph - 22; const iw = cols === 2 ? 18 : 17; return { x: px, y: py, w, h: ph, rows, cols, btns, open: { x: px + 2, y: by - 3, w: iw + 2, h: 20 }, close: { x: px + w - iw - 4, y: by - 3, w: iw + 2, h: 20 }, openIcon: { x: px + 3, y: by, w: iw, h: 14 }, closeIcon: { x: px + w - iw - 3, y: by, w: iw, h: 14 } };
  }
  const elevCells = () => elevPanel().btns;                                                                              // テスト・DEV用：階数ボタンの場所
  function elevTap(p) {
    if (!ELV.active) return; const pn = elevPanel(); if (inRect(p, pn.open)) { elevOpen(); return; } if (inRect(p, pn.close)) { elevClose(); return; }
    if (ELV.phase !== 'idle' || ELV.busy) return; for (const b of pn.btns) if (inRect(p, b)) { elevPick(b.floor); return; }
  }
  function elevDoorSfx(dt) { ELV.doorTick -= dt; if (ELV.doorTick <= 0) { ELV.doorTick = 0.07; noise(0.025, 0.03); beep(150 + Math.random() * 30, 0, 0.05, 0.03, 'sawtooth'); } }                           // ガララ…
  function elevUpdate(dt) {
    const ph = ELV.phase; ELV.t += dt;
    if (ph === 'wait') { ELV.waitLeft -= dt; if (ELV.waitLeft <= 0) { ELV.phase = 'closing'; ELV.t = 0; ELV.doorTick = 0; } }
    else if (ph === 'reopen') { ELV.door = clamp(ELV.reFrom + (1 - ELV.reFrom) * (ELV.t / 0.3), 0, 1); elevDoorSfx(dt); if (ELV.t >= 0.3) { ELV.door = 1; ELV.phase = 'wait'; ELV.waitLeft = 1.5; } }
    else if (ph === 'closing') { ELV.door = clamp(ELV.door - dt / 0.7, 0, 1); elevDoorSfx(dt); if (ELV.door <= 0) { ELV.snapTo = elevMakeSnap(floorDef(ELV.to)); ELV.phase = 'moving'; ELV.t = 0; ELV.dir = ELV.to > ELV.from ? 1 : -1; ELV.diff = Math.abs(ELV.to - ELV.from); ELV.total = Math.min(3, 0.5 + 0.35 * ELV.diff); ELV.shown = ELV.from; } }   // とじた裏で、行き先の景色をつくる
    else if (ph === 'moving') {
      ELV.hum -= dt; if (ELV.hum <= 0) { ELV.hum = 0.28; beep(95, 0, 0.14, 0.025, 'sawtooth'); }
      const steps = Math.min(ELV.diff, Math.floor((ELV.t / ELV.total) * ELV.diff + 0.0001)); const shown = ELV.from + ELV.dir * steps; if (shown !== ELV.shown) { ELV.shown = shown; beep(1500, 0, 0.03, 0.03, 'square'); }
      if (ELV.t >= ELV.total) { ELV.shown = ELV.to; ELV.phase = 'arrive'; ELV.t = 0; beep(1319, 0, 0.45, 0.07, 'sine'); beep(1047, 0.28, 0.5, 0.06, 'sine'); }                                                      // チーン♪（ランプは、消える）
    } else if (ph === 'arrive') { if (ELV.t >= 0.55) { ELV.phase = 'opening'; ELV.t = 0; ELV.doorTick = 0; } }
    else if (ph === 'opening') { ELV.door = clamp(ELV.t / 0.7, 0, 1); elevDoorSfx(dt); if (ELV.door >= 1) { ELV.phase = 'done'; elevLeaveToFloor(ELV.to); } }                                                      // 開ききったら、そのまま その階へ
  }
  function elevDoorPanels(ox, oy, ow, oh, open, view) {
    rect(ox, oy, ow, oh, '#0a0c10'); if (view) { const k = Math.max(ow / view.width, oh / view.height); const sw = ow / k; const sh = oh / k; ctx.drawImage(view, (view.width - sw) / 2, Math.max(0, view.height * 0.2), sw, sh, ox, oy, ow, oh); }
    const half = ow / 2; const slide = Math.round(open * (half - 1)); ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, ow, oh); ctx.clip();
    for (const side of [-1, 1]) { const px0 = side < 0 ? ox - slide : ox + half + slide; rect(px0, oy, half, oh, '#a8b0be'); for (let y = oy + 6; y < oy + oh; y += 14) rect(px0 + 2, y, half - 4, 1, '#8a92a4'); rect(px0, oy, 3, oh, '#e8ecf4'); rect(px0 + half - 4, oy, 4, oh, '#6a7284'); rect(px0 + (side < 0 ? half - 6 : 2), oy + Math.round(oh / 2) - 8, 3, 16, '#4a4e5a'); }
    ctx.restore(); rect(ox + Math.floor(ow / 2) - 1, oy, 2, oh, '#2a2e38');
  }
  function elevIcon(r, open) {                                                                                           // 「開」◀│▶／「閉」▶│◀ のマーク
    rect(r.x, r.y, r.w, r.h, '#4a505c'); rect(r.x, r.y, r.w, 1, '#c8ced8'); rect(r.x, r.y + r.h - 1, r.w, 1, '#2a2e36'); const cx = r.x + Math.floor(r.w / 2); const cy = r.y + Math.floor(r.h / 2); rect(cx - 1, cy - 4, 2, 8, '#e8ecf4');
    for (let i = 0; i < 4; i++) { const h = 7 - i * 2; if (open) { rect(cx - 2 - i, cy - Math.floor(h / 2), 1, h, '#e8ecf4'); rect(cx + 2 + i, cy - Math.floor(h / 2), 1, h, '#e8ecf4'); } else { rect(cx - 6 + i, cy - Math.floor(h / 2), 1, h, '#e8ecf4'); rect(cx + 6 - i, cy - Math.floor(h / 2), 1, h, '#e8ecf4'); } }
  }
  function elevPanelDraw() {
    const pn = elevPanel(); rect(pn.x - 3, pn.y - 3, pn.w + 6, pn.h + 6, '#9aa2b0'); rect(pn.x - 3, pn.y - 3, pn.w + 6, 2, '#e8ecf4'); rect(pn.x - 3, pn.y + pn.h + 1, pn.w + 6, 2, '#5a6272'); rect(pn.x - 3, pn.y - 3, 2, pn.h + 6, '#c8ced8'); rect(pn.x, pn.y, pn.w, pn.h, '#2a2e36');
    for (let r = 0; r <= pn.rows; r++) rect(pn.x, pn.y + 6 + r * 24, pn.w, 1, '#3a404c');                                                                                              // 板の、区切りの線
    const lit = (b) => ELV.sel === b.floor && ELV.sel > 0 && ['wait', 'reopen', 'closing', 'moving'].includes(ELV.phase);                                                                                             // 目的階に着いたら、消える
    for (const b of pn.btns) {
      const on = lit(b); if (on) { ctx.globalAlpha = 0.35 + 0.1 * Math.sin(animT() * 5); ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(b.cx, b.cy, 12, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.fillStyle = on ? '#b07010' : '#6a7080'; ctx.beginPath(); ctx.arc(b.cx, b.cy, 9, 0, 6.2832); ctx.fill(); ctx.fillStyle = on ? '#ffd878' : '#d8dce6'; ctx.beginPath(); ctx.arc(b.cx, b.cy, 8, 0, 6.2832); ctx.fill(); ctx.fillStyle = on ? '#fff0c0' : '#f4f6fa'; ctx.beginPath(); ctx.arc(b.cx, b.cy - 1, 6, 0, 6.2832); ctx.fill();
      const tx = b.floor >= 10 ? b.cx - 4 : b.cx - 2; drawText(String(b.floor), tx, b.cy - 3, on ? '#7a4a08' : '#2a2e36', 1);
    }
    elevIcon(pn.openIcon, true); elevIcon(pn.closeIcon, false);
  }
  function drawElev() {
    const now = performance.now(); const dt = Math.min(0.05, (now - ELV.last) / 1000); ELV.last = now; if (ELV.active && ELV.phase !== 'idle' && ELV.phase !== 'done' && ELV.phase !== 'skipped') elevUpdate(dt);
    drawFrame(); rect(8, 8, W - 16, H - 16, '#2a2e36'); for (let x = 12; x < W - 8; x += 14) { ctx.globalAlpha = 0.25; rect(x, 8, 1, H - 16, '#3a404c'); ctx.globalAlpha = 1; } rect(8, 8, W - 16, 4, '#8a92a4'); rect(8, H - 44, W - 16, 36, '#1a1c22'); rect(8, H - 44, W - 16, 2, '#6a7284');
    const ow = 100; const oh = 236; const ox = Math.round(14 + (W - 78 - ow) / 2); const oy = 56; rect(ox - 8, oy - 8, ow + 16, oh + 16, '#4a4e5a'); rect(ox - 8, oy - 8, ow + 16, 3, '#aab2c0'); rect(ox - 6, oy - 6, ow + 12, oh + 12, '#1a1c22');
    const view = (ELV.phase === 'idle' || ELV.phase === 'wait' || ELV.phase === 'reopen' || ELV.phase === 'closing') ? ELV.snapCur : ELV.snapTo; elevDoorPanels(ox, oy, ow, oh, ELV.door, view);
    const ix = ox + ow / 2; rect(Math.round(ix) - 36, 16, 72, 24, '#0a0c10'); rect(Math.round(ix) - 36, 16, 72, 2, '#8a92a4'); drawTextCenter(ELV.shown + 'F', ix, 21, '#ffb040', 2);
    if (ELV.phase === 'moving') { const dir = ELV.dir || 1; const ax = Math.round(ix) + 26; for (let i = 0; i < 4; i++) rect(ax - i, dir > 0 ? 24 - i : 20 + i, i * 2 + 1, 1, '#ffb040'); }
    elevPanelDraw(); elevUi();
  }
  function elevBuildDom() {
    if (ELV_DOM.back) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); ELV_DOM[id.slice(5)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); };
    mk('elev-back', 'もどる', 'hb-sub', elevBack); mk('elev-skip', 'SKIP', 'hb-go', elevSkip);
  }
  function elevUi() {
    elevBuildDom(); const on = scene === 'elev' && ELV.active; const idle = ELV.phase === 'idle'; const moving = on && !idle && ELV.phase !== 'done' && ELV.phase !== 'skipped';
    ELV_DOM.back.classList.toggle('is-show', on && idle); ELV_DOM.skip.classList.toggle('is-show', moving);
    crPlace(ELV_DOM.back, { x: 14, y: 352, w: 66, h: 20 }); crPlace(ELV_DOM.skip, { x: W - 54, y: 12, w: 46, h: 20 });                                    // SKIP：右上（操作盤より、上）。操作盤の一部には、見えない
    ELV_DOM.back.style.fontSize = Math.max(9, parseFloat(ELV_DOM.back.style.fontSize) * 0.85) + 'px'; ELV_DOM.skip.style.fontSize = Math.max(9, parseFloat(ELV_DOM.skip.style.fontSize) * 0.85) + 'px';
  }
  function elevHide() { if (!ELV_DOM.back) return; Object.keys(ELV_DOM).forEach((k) => ELV_DOM[k].classList.remove('is-show')); }
  function openElevDev() {
    const again = (f) => () => { f(); setTimeout(openElevDev, 0); }; const top = floorMax(); const cur = floorNo();
    showDialog({ title: 'ELEVATOR DEV', wide: true, lines: [{ text: 'いま ' + cur + 'F / 最上階 ' + top + 'F / 移動ロック: move=' + (moveBusy ? 'ON' : 'off') + ' elev=' + (ELV.busy ? 'ON' : 'off') + ' phase=' + ELV.phase, cls: 'dim' }, { text: 'フロア: ' + floorsEnabled().map((d) => d.floor + 'F ' + d.short + '(' + d.scene + (d.scene === 'center' ? ':' + d.cf : '') + ')').join(' / '), cls: 'dim' }], buttons: [
      ...floorsEnabled().map((d) => ({ label: d.floor + 'F へ 瞬間移動', onClick: () => { applyFloor(d); } })),
      { label: 'エレベーター内部を ひらく', onClick: () => { setTimeout(() => openElevator(cur), 0); } },
      { label: '1F → 最上階（エレベーター）', onClick: () => { applyFloor(floorDef(1)); setTimeout(() => { openElevator(1); setTimeout(() => elevPick(top), 700); }, 50); } }, { label: '最上階 → 1F（エレベーター）', onClick: () => { applyFloor(floorDef(top)); setTimeout(() => { openElevator(top); setTimeout(() => elevPick(1), 700); }, 50); } },
      { label: '▲ テスト', onClick: () => { floorGo(cur + 1); } }, { label: '▼ テスト', onClick: () => { floorGo(cur - 1); } }, { label: 'SKIP テスト（エレベーターを動かして、すぐ SKIP）', onClick: () => { const t = cur === top ? 1 : top; setTimeout(() => { openElevator(cur); setTimeout(() => { elevPick(t); setTimeout(elevSkip, 600); }, 700); }, 50); } },
      { label: 'ドア OPEN（エレベーター内）', onClick: again(() => { ELV.door = 1; }) }, { label: 'ドア CLOSE（エレベーター内）', onClick: again(() => { ELV.door = 0; }) }, { label: 'とじる', primary: true } ] });
  }



  // ---------------------------------------------------------------------
  //  画面の移動のまとめ：moveFade（短い暗転つきの移動）／ 筐体に座る・席を立つ（sitDown・enterMachine・standUp）
  //  階の移動は、このファイルの上（エレベーター・▲▼）と floors/ の各階
  // ---------------------------------------------------------------------
  let moveBusy = false;
  function moveFade(fn) {                                                                       // どこかへ移動するとき：一瞬 暗転 → 切りかえ → 明転（階の移動・筐体に入る／出る）
    if (moveBusy) return; moveBusy = true;
    let el = document.getElementById('move-fade'); if (!el) { el = document.createElement('div'); el.id = 'move-fade'; screenEl.appendChild(el); }
    void el.offsetWidth; el.classList.add('is-on');
    setTimeout(() => { fn(); setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => { moveBusy = false; }, 290); }, 50); }, 290);
  }

  // =====================================================================
  //  筐体に座る・席を立つ
  // =====================================================================
  function sitDown(m) {
    if (!m.isUnlocked) { toast('新台入荷をお楽しみに！'); return; }
    centerFloor = floorOfMachine(m.machineId);
    zoom = { t: 0, dir: 'in', machine: m };
    sfx.tv();
  }

  function enterMachine(m) {
    currentMachine = m;
    centerFloor = floorOfMachine(m.machineId);
    if (save) D_().floor = centerFloor;
    scene = 'machine';
    outOfMedalShown = false;
    updateSceneUi();
    GAME_TYPES[m.gameType].enter();
    if (D_().rec && D_().rec.active === m.machineId) setMessage('📌店長のおすすめ！この台は次の1回だけボーナス！', C.yellow);
    writeSave();
  }

  function askStand() {
    if (scene !== 'machine' || dialogOpen) return;
    const gt = GAME_TYPES[currentMachine.gameType];
    if (gt && gt.beforeLeave && gt.beforeLeave()) return;                                                // 試合のとちゅうで席を立つ（AIR SMASH）：確認して、いまの点数で おわる
    if (gt && !gt.canLeave(false)) { toast('今は席を立てないよ。少し待ってね'); return; }
    standUp();                                                // 確認なし。同じDAYの状態は、standUp の中で保存します
  }

  function standUp() {
    const m = currentMachine;
    if (!m) return;
    const gt = GAME_TYPES[m.gameType];
    if (gt && gt.beforeLeave && gt.beforeLeave()) return;
    if (gt && !gt.canLeave(true)) { toast('今は席を立てないよ。少し待ってね'); return; }
    if (m.crane || m.hb || m.st || m.kc || m.td || m.br || m.nb || m.pp || m.as || m.sz || m.tt || m.jc || m.bc || m.sa || m.bd || m.nk || m.gp || m.rk || m.hy || m.hh || m.mh) { writeSave(); moveFade(() => { currentMachine = null; scene = (m.gp || m.rk || m.hy || m.hh || m.mh) ? 'b5' : (m.jc || m.bc || m.sa || m.bd || m.nk) ? 'b4' : (m.br || m.nb || m.pp || m.as || m.sz || m.tt) ? 'b3' : (m.hb || m.st || m.kc || m.td) ? 'b2' : 'b1'; updateSceneUi(); }); return; }       // クレーンから席を立つと、B1へ
    writeSave();                              // 同じ DAY の続きを保存
    currentMachine = null;
    scene = 'center';
    zoom = { t: 0, dir: 'out', machine: m };
    updateSceneUi();
    writeSave();
    if (noMoneyNoMedal()) setTimeout(() => showTired(), 900);
  }

  function showTired() {
    if (dialogOpen) return;
    showDialog({
      title: 'おしまい',
      lines: [{ text: '今日はたっぷり遊んだ！', cls: 'big' }, 'お金もメダルもなくなったよ。また明日！'],
      buttons: [{ label: '閉店', primary: true, onClick: () => startClosing(true) }]
    });
  }

  // メダルが0枚になったとき（筐体の中）：GAME OVER にはせず、ゲームセンターへ
  function onOutOfMedals() {
    if (outOfMedalShown || dialogOpen) return;
    outOfMedalShown = true;
    const money = P_().money;
    const lines = [{ text: 'メダルがなくなりました！', cls: 'big' }, '💴残り' + yen(money)];
    if (money < minExchange()) lines.push('お金もないみたい。');
    showDialog({
      title: 'MEDAL 0',
      lines,
      buttons: [
        { label: 'ゲームセンターへ戻る', primary: true, onClick: standUp },
        { label: 'このまま見ている' }
      ]
    });
  }

  function updateSceneUi() {
    const inMachine = scene === 'machine';
    standBtn.hidden = !inMachine;
    if (helpBtn) helpBtn.hidden = !inMachine;
    if (msgEl) msgEl.style.display = inMachine ? '' : 'none';
    hintEl.textContent = inMachine && currentMachine ? GAME_TYPES[currentMachine.gameType].hint : scene === 'seq' ? 'ゆっくり見てね' : '触って選ぼう';
    if (typeof crHideButtons === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'craneGame')) crHideButtons();
    if (typeof hbHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'happyBeat')) hbHide();
    if (typeof kcHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'kawaiiClub')) kcHide();
    if (typeof tdHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'topDriver')) tdHide();
    if (typeof brHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'basketRush')) brHide();
    if (typeof nbHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'niceBatting')) nbHide();
    if (typeof ppHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'powerPunch')) ppHide();
    if (typeof asHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'airSmash')) asHide();
    if (typeof szHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'strikeZone')) szHide();
    if (typeof ttHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'pingPong')) ttHide();
    if (typeof jcHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'jewelChain')) jcHide();
    if (typeof bcHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'blockCrash')) bcHide();
    if (typeof bdHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'bullDarts')) bdHide();
    if (typeof gpHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'ghostRush')) gpHide();
    if (typeof mhHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'mystery')) mhHide();
    if (typeof hhHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'horror')) hhHide();
    if (typeof hyHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'hyakki')) hyHide();
    if (typeof rkHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'goRocket')) rkHide();
    if (typeof nkHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'nineBreak')) nkHide();
    if (typeof saHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'seaAttack')) saHide();
    if (typeof bgHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'bingo')) bgHide();
    if (typeof vmHide === 'function' && scene !== 'vending') vmHide();
    if (typeof gcHide === 'function' && scene !== 'gacha') gcHide();
    if (typeof elevHide === 'function' && scene !== 'elev') elevHide();
    if (typeof bkHide === 'function' && scene !== 'sbook') bkHide();
    if (typeof KA_DOM !== 'undefined' && KA_DOM.back && scene !== 'album' && scene !== 'photoView') { KA_DOM.back.classList.remove('is-show'); KA_DOM.del.classList.remove('is-show'); }
    if (typeof stHide === 'function' && !(inMachine && currentMachine && currentMachine.gameType === 'sparkTap')) { stHide(); if (typeof stSayDom !== 'undefined' && stSayDom) stSayDom.classList.remove('is-show'); }
    if (typeof SH_DOM !== 'undefined' && SH_DOM.back && scene !== 'shelf' && scene !== 'detail') { SH_DOM.back.classList.remove('is-show'); SH_DOM.info.classList.remove('is-show'); }
    retryBtn.classList.remove('is-show');
    layoutMessage();
    if (!(inMachine && currentMachine && currentMachine.gameType === 'hamPanic')) hmHideButtons();
  }
