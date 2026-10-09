'use strict';
  // =====================================================================
  //  SLIME HUNT（2台目のメダルゲーム）
  //   1メダル投入 → スライムを1匹選ぶ → 連打で戦う → WIN / LOSE
  //   結果は「スライムを選んだ瞬間」に抽選します。連打は戦っている気分の演出です
  // =====================================================================
  const SHC = CONFIG.slimeHunt;
  const SHD = SHC.debug;
  const SLIMES = SHC.slimes;
  const SLIME_BY_ID = {};
  for (const s of SLIMES) SLIME_BY_ID[s.id] = s;
  const NORMAL_SLIMES = SLIMES.filter((s) => s.rarity === 'normal');
  const RARE_SLIMES = SLIMES.filter((s) => s.rarity === 'rare');

  let ARENA = { x: 12, y: 48, w: 156, h: 216 };
  let ORBIT = { cx: 90, cy: 154, rx: 55, ry: 74 };
  let SH_INSERT = { x: 24, y: 268, w: 132, h: 32 };
  let SLIME_MSG_BOX = { x: 14, y: 304, w: 152, h: 28 };
  let BATTLE_POS = { x: 90, y: 150 };

  // URLに ?slimedebug=rainbow,win を付けたときのデバッグ設定
  (function parseSlimeDebug() {
    try {
      const q = new URLSearchParams(location.search).get('slimedebug');
      if (!q) return;
      SHD.enabled = true;
      for (const k of q.split(',')) {
        if (k === 'win' || k === 'lose') SHD.forceResult = k;
        else if (k === 'rare') SHD.rareRate = 1;
        else if (SLIME_BY_ID[k]) SHD.forceNext = k;
      }
    } catch (e) { /* 何もしない */ }
  })();

  const shEase = (t) => 1 - (1 - t) * (1 - t);
  const shLerp = (a, b, t) => a + (b - a) * t;
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mixHex = (a, b, t) => {
    const A = hexRgb(a);
    const B = hexRgb(b);
    return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };

  // ---------------------------------------------------------------------
  //  スライムのドット絵（コードで描きます）
  // ---------------------------------------------------------------------
  const RAINBOW_BANDS = ['#ff4060', '#ff9a30', '#ffe040', '#5ce870', '#40d8ff', '#5080ff', '#b060ff'];
  const SLIME_LOOK = {
    baby:    { w: 14, h: 11, base: '#bfe8ff', light: '#effaff', shade: '#86c0e8', out: '#3a5a88', face: 'cute', deco: 'curl' },
    aqua:    { w: 17, h: 14, base: '#4aa8ff', light: '#a8d8ff', shade: '#2a6ad0', out: '#12306a', face: 'happy', deco: 'drop' },
    leaf:    { w: 18, h: 15, base: '#8ad84a', light: '#d0ff98', shade: '#5aa028', out: '#2a5a10', face: 'normal', deco: 'leaf' },
    fire:    { w: 19, h: 16, base: '#ff7030', light: '#ffb070', shade: '#d04010', out: '#6a1a08', face: 'normal', deco: 'flame' },
    thunder: { w: 20, h: 17, base: '#ffd040', light: '#fff0a0', shade: '#d09810', out: '#6a4a08', face: 'angry', deco: 'bolt' },
    metal:   { w: 21, h: 18, base: '#b8c0d8', light: '#f4f8ff', shade: '#7a84a8', out: '#2a3050', face: 'visor', pattern: 'metal' },
    poison:  { w: 22, h: 19, base: '#a050d0', light: '#d898f0', shade: '#6a2a98', out: '#2a0a48', face: 'scary', deco: 'bubbles' },
    dark:    { w: 23, h: 20, base: '#3a3068', light: '#6a5aa8', shade: '#1e1840', out: '#0a0618', face: 'scaryRed', deco: 'spikes' },
    devil:   { w: 25, h: 22, base: '#d82848', light: '#ff7088', shade: '#901830', out: '#400818', face: 'scary', deco: 'horns' },
    crystal: { w: 22, h: 19, base: '#a8ecff', light: '#f0ffff', shade: '#60b8e8', out: '#2a6a98', face: 'cute', pattern: 'crystal', deco: 'glint' },
    gold:    { w: 24, h: 20, base: '#ffd040', light: '#fff4a0', shade: '#c88a10', out: '#6a3c08', face: 'happy', pattern: 'gold' },
    king:    { w: 34, h: 28, base: '#7a5ae0', light: '#b8a0ff', shade: '#4a30a8', out: '#1a1050', face: 'angry', deco: 'crown' },
    rainbow: { w: 28, h: 24, base: '#ffffff', light: '#ffffff', shade: '#888888', out: '#3a2a6a', face: 'happy', pattern: 'rainbow' }
  };

  const STAMPS = {
    flame: { map: ['...r...', '..rrr..', '.rrorr.', '.rooor.', 'rroyoor', 'rooyyor', '.royyr.', '..rrr..'], col: { r: '#e83020', o: '#ff9a30', y: '#ffe070' }, dy: -6 },
    leaf: { map: ['gg....gg', 'gLg..gLg', '.ggddgg.', '...dd...', '...dd...'], col: { g: '#5ac83a', L: '#b0ff80', d: '#3a7a20' }, dy: -4 },
    drop: { map: ['..o..', '.obo.', '.obo.', 'obbwo', 'obbbo', '.ooo.'], col: { b: '#4aa8ff', w: '#d8f0ff', o: '#12306a' }, dy: -5 },
    curl: { map: ['...o.', '..oLo', '.oL..', '.o...'], col: { o: '#3a5a88', L: '#86c0e8' }, dy: -3 },
    glint: { map: ['..w..', '..w..', 'wwwww', '..w..', '..w..'], col: { w: '#ffffff' }, dx: 'right', dy: -1 },
    bolt: { map: ['..xx.', '.xx..', 'xxxx.', '..xx.', '.xx..', '.x...'], col: { x: '#a86a08' }, dx: 'mid', dy: 3 }
  };

  function buildSlime(spec) {
    const w = spec.w;
    const h = spec.h;
    const PX = 6;
    const PT = 11;
    const PB = 3;
    const cw = w + PX * 2;
    const ch = h + PT + PB;
    const g = [];
    for (let y = 0; y < ch; y++) g.push(new Array(cw).fill(null));
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < cw && y < ch) g[y][x] = c; };
    const bp = (x, y, c) => put(PX + x, PT + y, c);

    // 体のかたち：上は丸く、下は平らな「ぷるん」
    const mask = [];
    for (let y = 0; y < h; y++) {
      const u = (y + 0.5) / h;
      const f = u < 0.7 ? Math.sqrt(Math.max(0, 1 - Math.pow((0.7 - u) / 0.7, 2))) : 1 - Math.pow((u - 0.7) / 0.3, 3) * 0.12;
      const row = [];
      for (let x = 0; x < w; x++) row.push(Math.abs(x + 0.5 - w / 2) < (f * w) / 2);
      mask.push(row);
    }
    const ins = (x, y) => y >= 0 && y < h && x >= 0 && x < w && mask[y][x];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y][x]) continue;
        const edge = !ins(x - 1, y) || !ins(x + 1, y) || !ins(x, y - 1) || !ins(x, y + 1);
        const lx = x / w;
        const ly = y / h;
        let col;
        if (edge) col = spec.out;
        else if (spec.pattern === 'rainbow') {
          col = RAINBOW_BANDS[Math.min(6, Math.floor(lx * 7))];
          if (ly < 0.36 && lx < 0.55) col = mixHex(col, '#ffffff', 0.5);
          else if (ly > 0.74) col = mixHex(col, '#000000', 0.22);
        } else if (spec.pattern === 'gold') {
          col = ly < 0.3 ? '#fff4a0' : ly < 0.6 ? '#ffd040' : ly < 0.8 ? '#e8a820' : '#c88a10';
          if ((x + y) % 9 === 0 && ly < 0.72) col = '#fff8d0';
        } else if (spec.pattern === 'metal') {
          col = ly < 0.3 ? '#f4f8ff' : ly < 0.55 ? '#c8d0e8' : ly < 0.75 ? '#9aa4c8' : '#7a84a8';
          if ((x + y) % 8 === 0 && ly < 0.75) col = '#ffffff';
        } else if (spec.pattern === 'crystal') {
          col = spec.base;
          if (ly < 0.36 && lx < 0.5) col = spec.light;
          if (ly > 0.72) col = '#86d4f4';
          if ((x - y + 40) % 6 === 0) col = '#ffffff';
          else if ((x + y) % 8 === 0) col = spec.shade;
        } else {
          col = spec.base;
          if (ly < 0.38 && lx < 0.55) col = spec.light;
          if (ly > 0.74 || (lx > 0.82 && ly > 0.3)) col = spec.shade;
        }
        bp(x, y, col);
      }
    }
    // つや（白いハイライト）
    const hx = Math.round(w * 0.24);
    const hy = Math.round(h * 0.2);
    bp(hx, hy, '#ffffff'); bp(hx + 1, hy, '#ffffff'); bp(hx, hy + 1, '#ffffff');

    // 顔
    const ey = Math.round(h * 0.44);
    const exL = Math.round(w * 0.28);
    const exR = w - 2 - exL;                 // 右目の左端
    const cL = Math.floor((w - 1) / 2);
    const cR = Math.ceil((w - 1) / 2);
    const my = ey + Math.max(4, Math.round(h * 0.28));
    const K = '#1a1020';
    const WT = '#ffffff';
    const eye = (ex, tall, c) => {
      for (let dy = 0; dy < tall; dy++) { bp(ex, ey + dy, c || K); bp(ex + 1, ey + dy, c || K); }
    };
    const brows = () => {
      bp(exL - 1, ey - 3, K); bp(exL, ey - 2, K); bp(exL + 1, ey - 2, K);
      bp(exR + 2, ey - 3, K); bp(exR + 1, ey - 2, K); bp(exR, ey - 2, K);
    };
    switch (spec.face) {
      case 'cute':
        eye(exL, 3); eye(exR, 3); bp(exL, ey, WT); bp(exR, ey, WT);
        bp(cL, my - 1, K); bp(cR, my - 1, K);
        break;
      case 'happy':
        eye(exL, 2); eye(exR, 2); bp(exL, ey, WT); bp(exR, ey, WT);
        bp(cL - 1, my - 1, K); bp(cL, my, K); bp(cR, my, K); bp(cR + 1, my - 1, K);
        bp(exL - 1, ey + 3, '#ff9ab0'); bp(exR + 2, ey + 3, '#ff9ab0');
        break;
      case 'normal':
        eye(exL, 2); eye(exR, 2); bp(exL, ey, WT); bp(exR, ey, WT);
        bp(cL, my, K); bp(cR, my, K);
        break;
      case 'angry':
        eye(exL, 2); eye(exR, 2); brows();
        bp(cL - 1, my + 1, K); bp(cL, my, K); bp(cR, my, K); bp(cR + 1, my + 1, K);
        break;
      case 'visor':
        for (let x = exL - 1; x <= exR + 2; x++) { bp(x, ey, K); bp(x, ey + 1, K); }
        bp(exL + 1, ey, '#5ce8ff'); bp(exR, ey, '#5ce8ff');
        for (let x = cL - 1; x <= cR + 1; x++) bp(x, my, K);
        break;
      case 'scary':
        eye(exL, 2, WT); eye(exR, 2, WT); bp(exL + 1, ey + 1, '#e02030'); bp(exR, ey + 1, '#e02030'); brows();
        for (let x = cL - 2; x <= cR + 2; x++) bp(x, my, K);
        bp(cL - 1, my + 1, WT); bp(cR + 1, my + 1, WT);
        break;
      case 'scaryRed':
        eye(exL, 2, '#ff3040'); eye(exR, 2, '#ff3040'); bp(exL, ey, '#ffb0b0'); bp(exR, ey, '#ffb0b0'); brows();
        for (let x = cL - 2; x <= cR + 2; x++) bp(x, my, '#0a0618');
        bp(cL - 1, my + 1, WT); bp(cR + 1, my + 1, WT);
        break;
      default:
        break;
    }

    // かざり
    const stamp = (name, ox, oy) => {
      const st = STAMPS[name];
      st.map.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
          const c = st.col[row[xx]];
          if (c) bp(ox + xx, oy + yy, c);
        }
      });
    };
    const centered = (name) => {
      const st = STAMPS[name];
      let ox = Math.round((w - st.map[0].length) / 2);
      if (st.dx === 'right') ox = w - st.map[0].length - 1;
      else if (st.dx === 'mid') ox = Math.round(w * 0.42);
      stamp(name, ox, st.dy);
    };
    if (STAMPS[spec.deco]) centered(spec.deco);
    if (spec.deco === 'bubbles') {
      for (const [bx, byy, s] of [[3, -5, 4], [w - 8, -4, 4], [Math.round(w / 2) - 1, -2, 3]]) {
        for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) bp(bx + xx, byy + yy, '#7dff8a');
        bp(bx, byy, '#d8ffe0');
      }
    }
    if (spec.deco === 'spikes') {
      for (const f of [0.22, 0.5, 0.78]) {
        const sx = Math.round(w * f);
        bp(sx, -3, '#0a0618'); bp(sx - 1, -2, '#0a0618'); bp(sx, -2, '#6a5aa8'); bp(sx + 1, -2, '#0a0618');
        bp(sx - 2, -1, '#0a0618'); bp(sx - 1, -1, '#6a5aa8'); bp(sx, -1, '#6a5aa8'); bp(sx + 1, -1, '#6a5aa8'); bp(sx + 2, -1, '#0a0618');
      }
    }
    if (spec.deco === 'horns') {
      const horn = ['o....', 'ow...', '.ow..', '..ow.', '...oo'];
      horn.forEach((row, yy) => {
        for (let xx = 0; xx < 5; xx++) {
          const c = row[xx] === 'o' ? '#400818' : row[xx] === 'w' ? '#ffe8c0' : null;
          if (c) { bp(2 + xx, -4 + yy, c); bp(w - 3 - xx, -4 + yy, c); }
        }
      });
      for (let yy = 0; yy < 4; yy++) bp(w + 1 - yy, h - 5 - yy, '#901830');     // しっぽ
    }
    if (spec.deco === 'crown') {
      const crown = ['y....y....y', 'yy..yyy..yy', 'yyyyyyyyyyy', 'yryyybyyyry', 'ooooooooooo'];
      const cc = { y: '#ffd040', r: '#e83050', b: '#40a0ff', o: '#8a5a08' };
      const ox = Math.round((w - 11) / 2);
      crown.forEach((row, yy) => { for (let xx = 0; xx < 11; xx++) { const c = cc[row[xx]]; if (c) bp(ox + xx, -4 + yy, c); } });
    }

    const canvasEl = makeCanvas(cw, ch);
    const gx = canvasEl.getContext('2d');
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (g[y][x]) { gx.fillStyle = g[y][x]; gx.fillRect(x, y, 1, 1); }
      }
    }
    return { canvas: canvasEl, w, h, cw, ch, cx: cw / 2, cy: PT + h / 2 };
  }

  // 仮のドット絵（画像がまだ無い・読み込めないときに使う）。画像のスライムと大きさが合うよう2倍にします
  function upscaleSprite(spr, k) {
    const c = makeCanvas(spr.cw * k, spr.ch * k);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(spr.canvas, 0, 0, c.width, c.height);
    return { canvas: c, w: spr.w * k, h: spr.h * k, cw: spr.cw * k, ch: spr.ch * k, cx: spr.cx * k, cy: spr.cy * k, isImage: false };
  }
  const SLIME_SPR = {};
  for (const id of Object.keys(SLIME_LOOK)) SLIME_SPR[id] = upscaleSprite(buildSlime(SLIME_LOOK[id]), 2);

  // ---------------------------------------------------------------------
  //  素材の画像（img/slimes/*.webp）を読み込んで、ゲーム用のスプライトにする
  // ---------------------------------------------------------------------
  // 画像の余白をけずる範囲と、見た目の大きさ（不透明な部分の面積の平方根）を計る。
  // ファイルを直接開いたときなど、ブラウザが画素を読ませてくれない場合は null を返す
  function measureImage(img) {
    try {
      const c = makeCanvas(img.naturalWidth, img.naturalHeight);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, area = 0;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] < 32) continue;
          area++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) return null;
      return { crop: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], mass: Math.sqrt(area) };
    } catch (e) { return null; }
  }

  // 少しずつ半分にして縮める（一気に縮めるとギザギザになるため）
  function resizeSmooth(src, tw, th) {
    let cur = src;
    while (cur.width / 2 >= tw && cur.height / 2 >= th) {
      const c = makeCanvas(Math.floor(cur.width / 2), Math.floor(cur.height / 2));
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, c.width, c.height);
      cur = c;
    }
    const out = makeCanvas(tw, th);
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, tw, th);
    return out;
  }

  function buildImageSprite(def, img) {
    const m = measureImage(img) || {
      crop: def.crop || [0, 0, img.naturalWidth, img.naturalHeight],
      mass: def.mass || Math.sqrt(img.naturalWidth * img.naturalHeight * 0.6)
    };
    const k = (SHC.imageBaseSize * (def.size || 1)) / m.mass;           // どの絵も同じ大きさにそろえてから、倍率をかける
    const tw = Math.max(4, Math.round(m.crop[2] * k));
    const th = Math.max(4, Math.round(m.crop[3] * k));
    const base = makeCanvas(m.crop[2], m.crop[3]);
    base.getContext('2d').drawImage(img, m.crop[0], m.crop[1], m.crop[2], m.crop[3], 0, 0, m.crop[2], m.crop[3]);
    const small = resizeSmooth(base, tw, th);
    return { canvas: small, w: tw, h: th, cw: tw, ch: th, cx: tw / 2, cy: th / 2, isImage: true };
  }

  function loadSlimeImages() {
    for (const id of Object.keys(SHC.images)) {
      const def = SHC.images[id];
      const img = new Image();
      img.onload = () => { SLIME_SPR[id] = buildImageSprite(def, img); };
      img.onerror = () => { /* 画像が無いスライムは、仮のドット絵のまま */ };
      img.src = def.src;
    }
  }
  loadSlimeImages();

  function drawSprite(spr, x, y, scale, alpha) {
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    ctx.drawImage(spr.canvas, px(x - spr.cx * scale), px(y - spr.cy * scale), spr.cw * scale, spr.ch * scale);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  //  効果音
  // ---------------------------------------------------------------------
  const SHS = {
    coin() { beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); },
    select() { beep(880, 0, 0.05, 0.04); beep(1320, 0.05, 0.08, 0.04); },
    power() { beep(330, 0, 0.1, 0.05, 'square', 660); },
    slash(n) { noise(0.05, 0.05); beep(520 + n * 70, 0, 0.06, 0.04, 'square', 900 + n * 90); },
    critical() { beep(220, 0, 0.12, 0.06, 'square', 990); noise(0.12, 0.05); },
    pop() { noise(0.16, 0.06); beep(1250, 0, 0.1, 0.05, 'triangle', 300); },
    coins(k, step) { for (let i = 0; i < k; i++) beep(rand(1800, 2700), i * step, 0.03, 0.03); },
    win(n) {
      [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.07, 0.1, 0.05));
      SHS.coins(Math.min(n, 24), 0.05);
    },
    lunge() { beep(180, 0, 0.18, 0.06, 'square', 90); },
    lose() { beep(330, 0, 0.12, 0.05, 'square', 150); beep(220, 0.14, 0.22, 0.05, 'square', 110); },
    nomedal() { beep(260, 0, 0.12, 0.05, 'square', 180); },
    rare(kind) {
      const notes = kind === 'crystal' ? [1568, 2093, 2637] : kind === 'gold' ? [1047, 1319, 1568, 2093, 2637] : [784, 988, 1175, 1568, 1976];
      notes.forEach((f, i) => beep(f, i * 0.09, 0.14, 0.05, 'triangle'));
      noise(0.25, 0.02);
    },
    rainbow() {
      [523, 659, 784, 988, 1175, 1319, 1568, 1976, 2349, 2637, 3136].forEach((f, i) => beep(f, i * 0.11, 0.18, 0.05, 'triangle'));
      noise(0.5, 0.025);
    },
    big() {
      [784, 784, 784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, i * 0.1, 0.14, 0.05));
      SHS.coins(36, 0.06);
    }
  };

  // ---------------------------------------------------------------------
  //  状態（SH）
  // ---------------------------------------------------------------------
  const SH = {
    slots: [],            // 回っているスライム [{ id, enter }]
    rot: 0, clock: 0,
    phase: 'idle',        // idle（待機）/ select（選ぶ）/ battle（連打）/ result（結果）
    t: 0,
    chosen: -1, outcome: 'lose', applied: false, taps: 0,
    startPos: { x: 90, y: 156 },
    fx: [],               // 火花・星・メダル・文字などの演出
    banner: null,         // 「GOLD SLIME APPEARS!」など
    glow: null,           // レア出現のやさしい光
    shake: 0, red: 0, hit: 0, dim: 0,
    revealed: false, popped: false, lunged: false, shook: false,
    gain: 0, newRecord: null, noMedalT: 0, zeroPrompt: false, powered: false
  };

  const curSlime = () => (SH.chosen >= 0 && SH.slots[SH.chosen] ? SLIME_BY_ID[SH.slots[SH.chosen].id] : null);

  // ---- 補充の抽選 ----
  function rollSlimeId(existingIds, replenish) {
    if (replenish && SHD.enabled && SHD.forceNext && SLIME_BY_ID[SHD.forceNext]) return SHD.forceNext;
    const rareRate = SHD.enabled && SHD.rareRate !== null && SHD.rareRate !== undefined ? SHD.rareRate : SHC.rareSpawnRate;
    if (Math.random() < rareRate) {
      const pool = RARE_SLIMES.filter((s) => existingIds.indexOf(s.id) < 0);   // 同じレアは同時に1匹まで
      if (pool.length) return pickWeighted(pool, 'appearanceWeight').id;
    }
    let id = pickWeighted(NORMAL_SLIMES, 'appearanceWeight').id;
    for (let k = 0; k < 4 && existingIds.indexOf(id) >= 0; k++) id = pickWeighted(NORMAL_SLIMES, 'appearanceWeight').id;
    return id;
  }
  const makeSlot = (id, entering) => ({ id, enter: entering ? 0 : 1 });
  const idsExcept = (i) => SH.slots.filter((s, k) => s && k !== i).map((s) => s.id);

  function newLineup() {
    const ids = [];
    for (let i = 0; i < SHC.visibleCount; i++) ids.push(rollSlimeId(ids, false));
    return ids.map((id) => makeSlot(id, false));
  }

  // ---- 勝ち・負けの抽選（スライムを選んだ瞬間に決まります） ----
  function rollOutcome(slime) {
    if (SHD.enabled && SHD.forceResult) return SHD.forceResult === 'win' ? 'win' : 'lose';
    const total = slime.winRate + slime.loseRate;
    return Math.random() * total < slime.winRate ? 'win' : 'lose';
  }

  // ---- 位置 ----
  function slotXY(i) {
    const s = SH.slots[i];
    const n = SH.slots.length;
    const ang = SH.rot + (i * Math.PI * 2) / n;
    const rf = 1 + (1 - shEase(s ? s.enter : 1)) * 1.4;      // 画面の外（2.4倍）から軌道へ
    let x = ORBIT.cx + Math.sin(ang) * ORBIT.rx * rf;
    const y = ORBIT.cy - Math.cos(ang) * ORBIT.ry * rf;
    if (s && s.enter >= 1 && SLIME_SPR[s.id]) {
      const hw = SLIME_SPR[s.id].w / 2 + 2;
      x = clamp(x, ARENA.x + hw, ARENA.x + ARENA.w - hw);
    }
    return { x, y };
  }
  const inArena = (p) => p.x > ARENA.x + 6 && p.x < ARENA.x + ARENA.w - 6 && p.y > ARENA.y + 6 && p.y < ARENA.y + ARENA.h - 6;

  // タップしたスライム（見た目より少し広めの当たり判定）
  function hitSlime(p) {
    let best = -1;
    let bd = 1e9;
    SH.slots.forEach((s, i) => {
      if (!s) return;
      const pos = slotXY(i);
      if (!inArena(pos)) return;
      const spr = SLIME_SPR[s.id];
      const hw = Math.max(spr.w / 2, 12) + 6;
      const top = pos.y - spr.h / 2 - 8;
      const bottom = pos.y + spr.h / 2 + 15;
      if (Math.abs(p.x - pos.x) <= hw && p.y >= top && p.y <= bottom) {
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d < bd) { bd = d; best = i; }
      }
    });
    return best;
  }

  // ---------------------------------------------------------------------
  //  メダルを入れる → 選ぶ → 戦う
  // ---------------------------------------------------------------------
  function slimeTapInsert() {
    if (hand < SHC.playCost) {
      SH.noMedalT = 1.8;
      setMessage('メダルがありません。席を立って貸出機へ行こう', C.pink);
      SHS.nomedal();
      return;
    }
    hand -= SHC.playCost;                       // ゲームセンター共通のMEDALを使う
    D_().played = true;
    noteMedals();
    SH.phase = 'select';
    SH.t = 0;
    SHS.coin();
    setMessage('好きなスライムをタップ！×の数がもらえるメダル', C.cyan);
    writeSave();
  }

  function beginBattle(i) {
    const slot = SH.slots[i];
    const slime = SLIME_BY_ID[slot.id];
    SH.chosen = i;
    SH.startPos = slotXY(i);
    SH.outcome = rollOutcome(slime);            // 結果はここで決まる
    SH.applied = false;
    SH.phase = 'battle';
    SH.t = 0;
    SH.taps = 0;
    SH.powered = false;
    SH.hit = 0;
    SHS.select();
    setMessage(slime.name + '！連打で戦え！', slime.rarity === 'rare' ? C.yellow : C.text);
    writeSave();
  }

  function battleTap() {
    if (SH.t < SHC.moveTime || SH.taps >= SHC.battleRequiredTaps) return;
    SH.taps++;
    SH.hit = 1;
    SHS.slash(SH.taps);
    const c = BATTLE_POS;
    const ang = rand(-0.9, 0.9) + (Math.random() < 0.5 ? 0 : Math.PI);
    SH.fx.push({ type: 'slash', x: c.x + rand(-8, 8), y: c.y + rand(-8, 8), dx: Math.cos(ang), dy: Math.sin(ang) * 0.6 - 0.4, len: rand(16, 26), t: 0, dur: 0.2 });
    SH.fx.push({ type: 'text', x: c.x + rand(-26, 26), y: c.y - rand(14, 30), t: 0, dur: 0.45, text: 'HIT!', color: '#fff3a0' });
    for (let k = 0; k < 5; k++) {
      SH.fx.push({ type: 'spark', x: c.x, y: c.y, vx: rand(-2, 2), vy: rand(-2.4, 0.2), t: 0, dur: rand(0.25, 0.5), color: ['#fff8d0', '#ffd040', '#ff9a30'][k % 3] });
    }
    if (SH.taps >= SHC.battleRequiredTaps) startResult();
  }

  // ---------------------------------------------------------------------
  //  結果
  // ---------------------------------------------------------------------
  function resultPlan(slime, o) {
    const rare = slime.rarity === 'rare';
    const key = o === 'win' ? (rare ? slime.id : 'normal') : o;
    const dur = SHC.resultEffectDuration[key] || 2.4;
    if (o === 'win') {
      if (slime.id === 'rainbow') return { dur, pop: 1.4, reveal: 2.0, skip: 5.0 };
      if (rare) return { dur, pop: 0.7, reveal: 1.2, skip: 2.4 };
      return { dur, pop: 0.55, reveal: 0.85, skip: 1.5 };
    }
    return { dur, reveal: 0.95, skip: 1.5 };
  }

  function startResult() {
    SH.phase = 'result';
    SH.t = 0;
    SH.revealed = false;
    SH.popped = false;
    SH.lunged = false;
    SH.shook = false;
    SH.gain = 0;
    SH.newRecord = null;
    const slime = curSlime();
    if (SH.outcome === 'win') {
      SHS.critical();
      setMessage('とどめだ！', C.yellow);
      if (slime.id === 'rainbow') SH.glow = { kind: 'rainbow', t: 0, dur: 6 };
      else if (slime.rarity === 'rare') SH.glow = { kind: slime.id, t: 0, dur: 3 };
    } else {
      setMessage('固い……！反撃が来る！', C.pink);
    }
  }

  // 結果をメダル・記録へ反映する（silent は再開したときの静かな反映）
  function slimeApply(silent) {
    if (SH.applied) return;
    SH.applied = true;
    const slime = curSlime();
    if (!slime) return;
    const o = SH.outcome;
    const gain = recBonus('slime', o === 'win' ? slime.payout : 0);
    SH.gain = gain;
    hand += gain;
    const st = D_().stats.slime;
    const rec = P_().records.slime;
    st.plays++; rec.plays++;
    if (o === 'win') { st.wins++; rec.wins++; st.bestWin = Math.max(st.bestWin, gain); rec.bestWin = Math.max(rec.bestWin, gain); }
    else { st.losses++; rec.losses++; }
    if (o === 'win' && slime.rarity === 'rare' && !rec.defeated[slime.id]) {
      rec.defeated[slime.id] = true;
      rec.firstDay[slime.id] = P_().day;
      SH.newRecord = slime.id;
      if (!silent) toast('NEW RECORD! ' + slime.label + ' SLIME DEFEATED!');
    }
    noteMedals();
    writeSave();
  }

  // 結果が表示される瞬間の演出（音・メダルの雨・星）
  function slimeRevealFx() {
    const slime = curSlime();
    const o = SH.outcome;
    const cx = BATTLE_POS.x;
    if (o === 'win') {
      const n = SH.gain;
      const rain = Math.min(n, slime.id === 'rainbow' ? 46 : 30);
      const spread = slime.id === 'rainbow' ? 2.6 : slime.rarity === 'rare' ? 1.6 : 0.9;
      for (let k = 0; k < rain; k++) {
        SH.fx.push({ type: 'coin', x: ARENA.x + 12 + Math.random() * (ARENA.w - 24), y: ARENA.y - 12 - Math.random() * 20, vy: rand(0.4, 1.2), wait: (k / rain) * spread, t: 0, dur: 4 });
      }
      for (let k = 0; k < 14; k++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(0.6, 2.2);
        SH.fx.push({ type: 'star', x: cx, y: BATTLE_POS.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, t: 0, dur: rand(0.7, 1.3), color: ['#fff8d0', '#ffd040', '#ff8ef0', '#9ff8ff'][k % 4] });
      }
      if (slime.id === 'rainbow') SHS.big(); else SHS.win(n);
    } else {
      SHS.lose();
    }
  }

  function slimeResultStep() {
    const slime = curSlime();
    const o = SH.outcome;
    const plan = resultPlan(slime, o);
    const T = SH.t;
    if (o === 'win') {
      if (!SH.popped && T >= plan.pop) {
        SH.popped = true;
        SHS.pop();
        for (let k = 0; k < 16; k++) {
          const a = rand(0, Math.PI * 2);
          const sp = rand(0.8, 2.6);
          SH.fx.push({ type: 'star', x: BATTLE_POS.x, y: BATTLE_POS.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.5, 0.9), color: ['#ffffff', '#fff3a0', '#ffd040'][k % 3] });
        }
      }
    } else {
      if (!SH.lunged && T >= 0.55) { SH.lunged = true; SHS.lunge(); }
      if (!SH.shook && T >= 0.85) { SH.shook = true; SH.shake = 0.4; SH.red = 1; }
    }
    if (!SH.revealed && T >= plan.reveal) {
      SH.revealed = true;
      slimeApply(false);
      slimeRevealFx();
      setMessage(resultCaption(slime, o), o === 'win' ? C.goldLight : C.dim);
    }
    if (T >= plan.dur) slimeFinish();
  }

  function resultCaption(slime, o) {
    if (o === 'win') return 'やったー！' + slime.name + 'を倒した！' + SH.gain + '枚ゲット！';
    return 'やられた……！残念。もう一度！';
  }

  function slimeFinish() {
    if (!SH.applied) slimeApply(true);
    const i = SH.chosen;
    SH.phase = 'idle';
    SH.t = 0;
    SH.chosen = -1;
    SH.revealed = false;
    if (i >= 0) {
      const id = rollSlimeId(idsExcept(i), true);
      SH.slots[i] = makeSlot(id, true);
      announceSpawn(SLIME_BY_ID[id]);
    }
    SH.zeroPrompt = hand < SHC.playCost;
    if (SH.zeroPrompt) setMessage('メダルがなくなった！席を立って貸出機へ行こう', C.pink);
    else if (!(SH.banner && SH.banner.rare)) setMessage('1枚入れて次のスライムへ！', C.text);
    writeSave();
  }

  // レアが入ってきたときの「何か来た！」
  function announceSpawn(slime) {
    if (slime.rarity !== 'rare') return;
    const dur = SHC.rareEffectDuration[slime.id] || 2;
    const lines = slime.id === 'rainbow' ? ['RAINBOW SLIME!!'] : [slime.label + ' SLIME', 'APPEARS!'];
    const color = { crystal: '#9ff8ff', gold: '#ffd040', king: '#d8c0ff', rainbow: 'rainbow' }[slime.id];
    SH.banner = { lines, color, t: 0, dur, rare: true, big: slime.id === 'rainbow' };
    SH.glow = { kind: slime.id, t: 0, dur: dur + 0.6 };
    if (slime.id === 'rainbow') SHS.rainbow(); else SHS.rare(slime.id);
    setMessage(slime.name + 'が現れた！×' + slime.payout, C.yellow);
  }

  // ---------------------------------------------------------------------
  //  毎フレームの更新
  // ---------------------------------------------------------------------
  function slimeUpdate(dt) {
    SH.clock += dt;
    SH.rot += SHC.rotationSpeed * dt;
    SH.t += dt;
    for (const s of SH.slots) {
      if (s && s.enter < 1) s.enter = Math.min(1, s.enter + dt / (SLIME_BY_ID[s.id].id === 'rainbow' ? SHC.enterTime * 1.8 : SHC.enterTime));
    }
    if (SH.noMedalT > 0) SH.noMedalT -= dt;
    if (SH.shake > 0) SH.shake = Math.max(0, SH.shake - dt);
    if (SH.red > 0) SH.red = Math.max(0, SH.red - dt * 1.6);
    if (SH.hit > 0) SH.hit = Math.max(0, SH.hit - dt * 4);
    const wantDim = SH.phase === 'battle' || SH.phase === 'result' ? 0.6 : 0;
    SH.dim += (wantDim - SH.dim) * Math.min(1, dt * 6);
    if (SH.banner) { SH.banner.t += dt; if (SH.banner.t > SH.banner.dur) SH.banner = null; }
    if (SH.glow) { SH.glow.t += dt; if (SH.glow.t > SH.glow.dur) SH.glow = null; }

    for (let i = SH.fx.length - 1; i >= 0; i--) {
      const f = SH.fx[i];
      if (f.type === 'coin' && f.wait > 0) { f.wait -= dt; continue; }
      f.t += dt;
      if (f.type === 'spark' || f.type === 'star') { f.x += f.vx; f.y += f.vy; f.vy += 0.06; }
      if (f.type === 'coin') { f.y += f.vy; f.vy += 0.09; }
      if (f.type === 'text') f.y -= 0.35;
      if (f.t >= f.dur || (f.type === 'coin' && f.y > ARENA.y + ARENA.h + 12)) SH.fx.splice(i, 1);
    }
    if (SH.fx.length > 160) SH.fx.splice(0, SH.fx.length - 160);

    if (SH.phase === 'battle') {
      if (!SH.powered && SH.t >= SHC.moveTime) {
        SH.powered = true;
        SH.fx.push({ type: 'ring', x: BATTLE_POS.x, y: BATTLE_POS.y + 6, t: 0, dur: 0.5, color: '#fff3a0' });
        SHS.power();
      }
      if (SH.t >= SHC.moveTime + SHC.battleDuration) startResult();      // 連打が足りなくても進む
    } else if (SH.phase === 'result') {
      slimeResultStep();
    } else if (SH.phase === 'idle') {
      if (hand > 0) { SH.zeroPrompt = false; outOfMedalShown = false; }
      if (SH.zeroPrompt && SH.t > 1.4 && hand < SHC.playCost) { SH.zeroPrompt = false; onOutOfMedals(); }
    }
  }

  function slimePointer(e, p) {
    ensureAudio();
    if (SH.phase === 'idle') {
      if (inRect(p, SH_INSERT)) slimeTapInsert();
      else if (p.y < SH_INSERT.y) {
        setMessage('まずメダルを 1枚入れよう！したの INSERT をタップ', C.cyan);
        SH.noMedalT = 0;
      }
    } else if (SH.phase === 'select') {
      if (p.y < SH_INSERT.y + 4) {
        const i = hitSlime(p);
        if (i >= 0) beginBattle(i);
      }
    } else if (SH.phase === 'battle') {
      battleTap();
    } else if (SH.phase === 'result') {
      const slime = curSlime();
      if (slime && SH.t >= resultPlan(slime, SH.outcome).skip) slimeFinish();
    }
  }
  function slimeSpace() {
    if (SH.phase === 'idle') slimeTapInsert();
    else if (SH.phase === 'battle') battleTap();
    else if (SH.phase === 'result') slimePointer(null, { x: 0, y: 0 });
  }

  // ---------------------------------------------------------------------
  //  保存・再開・リセット
  // ---------------------------------------------------------------------
  function slimeResetDay() {
    SH.slots = newLineup();
    SH.rot = 0;
    SH.phase = 'idle';
    SH.t = 0;
    SH.chosen = -1;
    SH.applied = false;
    SH.fx = [];
    SH.banner = null;
    SH.glow = null;
    SH.shake = 0; SH.red = 0; SH.hit = 0; SH.dim = 0;
    SH.zeroPrompt = false;
  }

  function slimeSerialize() {
    return {
      slots: SH.slots.map((s) => (s ? s.id : null)),
      rot: SH.rot, phase: SH.phase, chosen: SH.chosen, outcome: SH.outcome, applied: SH.applied
    };
  }

  function slimeRestore(d) {
    slimeResetDay();
    if (!d || !Array.isArray(d.slots) || d.slots.length !== SHC.visibleCount) return;
    const ids = [];
    for (const id of d.slots) ids.push(SLIME_BY_ID[id] ? id : rollSlimeId(ids, false));     // 外したスライムは、別のスライムに
    SH.slots = ids.map((id) => makeSlot(id, false));
    SH.rot = d.rot || 0;
    SH.outcome = d.outcome === 'win' ? 'win' : 'lose';
    SH.applied = !!d.applied;
    SH.chosen = typeof d.chosen === 'number' ? d.chosen : -1;
    if (d.phase === 'select') SH.phase = 'select';
    else if (d.phase === 'battle' && SH.chosen >= 0) {
      SH.phase = 'battle';
      SH.startPos = slotXY(SH.chosen);
      SH.powered = false;
      SH.taps = 0;
    } else if (d.phase === 'result' && SH.chosen >= 0) {
      slimeApply(true);                       // 払い出しは確実に反映して、次のスライムへ
      slimeFinish();
      SH.fx = [];
      SH.banner = null;
      SH.glow = null;
    }
  }

  function slimeCanLeave() {
    return SH.phase === 'idle' || SH.phase === 'select' || SH.phase === 'result';     // 戦闘中は少し待つ（結果が出たあとは、払い出し済みなので すぐ立てる）
  }

  function slimeEnter() {
    if (SH.phase === 'select') setMessage('好きなスライムをタップ！×の数がもらえるメダル', C.cyan);
    else if (SH.phase === 'battle') setMessage('戦いの続き！連打で戦え！', C.text);
    else if (hand < SHC.playCost) setMessage('メダルがないよ。席を立って貸出機へ行こう', C.pink);
    else setMessage('1枚入れて、好きなスライムを倒そう！', C.text);
  }

  // ---------------------------------------------------------------------
  //  描画
  //   光る表現は、点滅ではなく「ゆっくり明るさが変わる」だけにしています
  // ---------------------------------------------------------------------
  let arenaBg = null;
  const buildArenaBg = () => {
    const c = makeCanvas(ARENA.w, ARENA.h);
    const g = c.getContext('2d');
    const bands = ['#0e2a3a', '#12384a', '#164a52', '#1a5a58', '#1e6a5a', '#22745a'];
    bands.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(0, Math.floor((i * ARENA.h) / bands.length), ARENA.w, Math.ceil(ARENA.h / bands.length) + 1);
    });
    g.fillStyle = '#bfe8ff';
    for (let i = 0; i < 16; i++) g.fillRect((i * 37 + 11) % ARENA.w, (i * 23 + 5) % 70, 1, 1);
    g.fillStyle = 'rgba(80, 200, 140, 0.35)';
    for (let y = 60; y < ARENA.h; y++) for (let x = (y % 2) * 2; x < ARENA.w; x += 4) g.fillRect(x, y, 1, 1);
    // 軌道の点線と、中央の魔法陣
    const ring = (rx, ry, cxx, cyy, step, c1, c2) => {
      for (let a = 0; a < 360; a += step) {
        const r = (a * Math.PI) / 180;
        g.fillStyle = (a / step) % 2 ? c1 : c2;
        g.fillRect(Math.round(cxx + Math.sin(r) * rx), Math.round(cyy - Math.cos(r) * ry), 1, 1);
      }
    };
    ring(ORBIT.rx, ORBIT.ry, ORBIT.cx - ARENA.x, ORBIT.cy - ARENA.y, 4, '#58e0b0', '#2a9a78');
    ring(34, 12, BATTLE_POS.x - ARENA.x, BATTLE_POS.y + 22 - ARENA.y, 6, '#7ad8ff', '#3a8ab0');
    return c;
  };
  arenaBg = buildArenaBg();
  // ワイド：アリーナ・軌道・バトルの位置・投入パネル・メッセージ枠を、画面の幅（W）に合わせる（スライムの大きさ・軌道の角速度は そのまま）
  function slimeRelayout() {
    const dx = W - 180; const cxm = 90 + dx / 2;                          // アリーナの中心（丸めない。文字・スライム・演出は、すべてこの中心に揃える）
    ARENA = { x: 12, y: 48, w: 156 + dx, h: 216 };
    ORBIT = { cx: cxm, cy: 154, rx: 55 + Math.round(dx * 0.35), ry: 74 };
    BATTLE_POS = { x: cxm, y: 150 };
    SH_INSERT = { x: 24, y: 268, w: 132 + dx, h: 32 };
    SLIME_MSG_BOX = { x: 14, y: 304, w: 152 + dx, h: 28 };
    if (typeof SH !== 'undefined' && SH && SH.startPos) SH.startPos = { x: cxm, y: 156 };
    arenaBg = buildArenaBg();
  }

  function slimeLabelColor(slime) {
    if (slime.id === 'rainbow') return 'hsl(' + ((SH.clock * 60) % 360) + ', 90%, 70%)';
    if (slime.rarity === 'rare') return '#fff3a0';
    if (slime.payout >= 15) return '#ff9a30';
    if (slime.payout >= 10) return '#ffd040';
    if (slime.payout >= 5) return '#7dd0ff';
    return '#e8f0ff';
  }
  function drawPayoutLabel(n, cx, y, color) {
    const s = String(n);
    const total = 4 + s.length * 8 - 2;
    const x0 = Math.round(cx - total / 2);
    drawText('X', x0, y + 4, color, 1, '#0a1a20');
    drawText(s, x0 + 4, y, color, 2, '#0a1a20');
  }

  function drawShadow(x, y, w) {
    ctx.globalAlpha = 0.35;
    rect(x - w / 2 + 1, y, w - 2, 2, '#000000');
    rect(x - w / 2 + 3, y + 2, w - 6, 1, '#000000');
    ctx.globalAlpha = 1;
  }

  function drawSparkles(x, y, spr, kind) {
    const colors = { crystal: '#ffffff', gold: '#fff3a0', king: '#e8d8ff', rainbow: '#ffffff' };
    for (let k = 0; k < 3; k++) {
      const a = SH.clock * 0.8 + k * 2.1;
      const r = spr.w * 0.62 + (k % 2) * 3;
      ctx.globalAlpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(SH.clock * 2 + k * 2));
      drawStar(px(x + Math.cos(a) * r), px(y - 2 + Math.sin(a) * r * 0.7), colors[kind] || '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  function drawOrbitSlime(i, selectable) {
    const s = SH.slots[i];
    if (!s || i === SH.chosen) return;
    const slime = SLIME_BY_ID[s.id];
    const spr = SLIME_SPR[s.id];
    const pos = slotXY(i);
    const bob = Math.round(Math.sin(SH.clock * 2.2 + i * 1.3) * (s.enter < 1 ? 2 : 1));
    if (selectable && inArena(pos)) {
      // 選べるスライムの足もとに、やさしく明るくなる輪
      ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(SH.clock * 3 + i));
      rect(pos.x - spr.w / 2 - 2, pos.y + spr.h / 2 - 2, spr.w + 4, 1, '#fff3a0');
      rect(pos.x - spr.w / 2, pos.y + spr.h / 2 + 2, spr.w, 1, '#fff3a0');
      ctx.globalAlpha = 1;
    }
    drawShadow(pos.x, pos.y + spr.h / 2 - 1, spr.w);
    drawSprite(spr, pos.x, pos.y + bob, 1);
    drawPayoutLabel(slime.payout, pos.x, pos.y + spr.h / 2 + 3, slimeLabelColor(slime));
    if (slime.rarity === 'rare' && !spr.isImage) drawSparkles(pos.x, pos.y, spr, slime.id);
  }

  // 選んだスライムの位置・大きさ（戦闘中・結果）
  function chosenPose() {
    const slime = curSlime();
    const spr = SLIME_SPR[slime.id];
    const t = SH.t;
    const o = SH.outcome;
    let x = BATTLE_POS.x;
    let y = BATTLE_POS.y;
    let scale = 2;
    let alpha = 1;
    let visible = true;
    if (SH.phase === 'battle') {
      if (t < SHC.moveTime) {
        const k = shEase(t / SHC.moveTime);
        x = shLerp(SH.startPos.x, BATTLE_POS.x, k);
        y = shLerp(SH.startPos.y, BATTLE_POS.y, k);
        scale = 1;
      } else {
        x += Math.round(Math.sin(SH.hit * 30) * 2 * SH.hit);
        y += Math.round(Math.sin(SH.clock * 3));
        if (SH.hit > 0.6) y += 1;
      }
    } else if (SH.phase === 'result') {
      const plan = resultPlan(slime, o);
      if (o === 'win') {
        if (t < plan.pop) { x += Math.round(Math.sin(t * 45) * 2.5 * (t / plan.pop)); }
        else visible = false;                                     // パーン！
      } else {
        if (t < 0.55) { y += Math.round(Math.sin(t * 20)); }
        else if (t < 0.95) {                                                                             // 体当たり
          const k = shEase((t - 0.55) / 0.4);
          const maxScale = Math.max(2, Math.floor((ARENA.w - 8) / spr.w));                               // 画面からはみ出さない大きさまで
          y += k * 26;
          scale = Math.min(2 + k * 0.99, maxScale);
        }
        else { y += 26 - Math.min(1, (t - 0.95) / 0.3) * 26; if (t > plan.dur - 0.6) { const k = (t - (plan.dur - 0.6)) / 0.6; y -= k * 150; x += k * 70; alpha = 1 - k; } }
      }
    }
    return { x, y, scale: Math.round(scale), spr, slime, alpha, visible };
  }

  function drawChosen() {
    const pose = chosenPose();
    if (!pose.visible) return;
    const { spr, slime } = pose;
    drawShadow(pose.x, pose.y + (spr.h / 2) * pose.scale - 1, spr.w * pose.scale * 0.9);
    drawSprite(spr, pose.x, pose.y, pose.scale, pose.alpha);
    if (SH.phase === 'battle' && SH.t >= SHC.moveTime) {
      const below = (spr.h * pose.scale) / 2;
      drawTextCenter(slime.label, pose.x, pose.y + below + 6, '#fff3a0', 1, '#0a1a20');
      drawPayoutLabel(slime.payout, pose.x, pose.y + below + 16, slimeLabelColor(slime));
    }
    if (slime.rarity === 'rare' && !spr.isImage && pose.alpha > 0.5) drawSparkles(pose.x, pose.y, { w: spr.w * 1.6 }, slime.id);
  }

  function drawFx() {
    for (const f of SH.fx) {
      if (f.type === 'coin' && f.wait > 0) continue;
      const k = f.t / f.dur;
      if (f.type === 'spark') {
        ctx.globalAlpha = Math.max(0, 1 - k);
        rect(f.x, f.y, 2, 2, f.color);
        ctx.globalAlpha = 1;
      } else if (f.type === 'star') {
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        drawStar(px(f.x), px(f.y), f.color);
        ctx.globalAlpha = 1;
      } else if (f.type === 'coin') {
        drawCoinSprite(coinFull, f.x, f.y);
      } else if (f.type === 'slash') {
        const n = Math.round(f.len * Math.min(1, k * 3));
        ctx.globalAlpha = Math.max(0, 1 - k);
        for (let i = 0; i < n; i++) rect(f.x - (f.dx * f.len) / 2 + f.dx * i, f.y - (f.dy * f.len) / 2 + f.dy * i, 2, 2, i % 5 === 0 ? '#ffe070' : '#ffffff');
        ctx.globalAlpha = 1;
      } else if (f.type === 'text') {
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        drawTextCenter(f.text, f.x, f.y, f.color, 1, '#2a1a40');
        ctx.globalAlpha = 1;
      } else if (f.type === 'ring') {
        const r = 6 + k * 34;
        ctx.globalAlpha = Math.max(0, 1 - k);
        for (let a = 0; a < 360; a += 12) {
          const rr = (a * Math.PI) / 180;
          rect(Math.round(f.x + Math.sin(rr) * r), Math.round(f.y - Math.cos(rr) * r * 0.45), 1, 1, f.color);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  // やさしい光（出現・大当たり）。急に明るくならず、ふわっと出てふわっと消える
  function drawGlow() {
    const gl = SH.glow;
    if (!gl) return;
    const env = Math.sin(Math.PI * Math.min(1, gl.t / gl.dur));
    if (gl.kind === 'rainbow') {
      ctx.globalAlpha = 0.2 * env;
      RAINBOW_BANDS.forEach((col, i) => rect(ARENA.x, ARENA.y + (i * ARENA.h) / 7, ARENA.w, Math.ceil(ARENA.h / 7), col));
    } else {
      const col = { crystal: '#9ff8ff', gold: '#ffd040', king: '#b090ff' }[gl.kind] || '#ffffff';
      ctx.globalAlpha = 0.14 * env;
      rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, col);
    }
    ctx.globalAlpha = 1;
  }

  function bigText(lines, alphaK) {
    ctx.globalAlpha = alphaK === undefined ? 1 : alphaK;
    for (const l of lines) drawTextCenter(l.text, BATTLE_POS.x, l.y, l.color, l.scale, l.shadow || '#10242a');       // バトルの中心（BATTLE! の文字と同じ）
    ctx.globalAlpha = 1;
  }

  function drawResultTexts() {
    const slime = curSlime();
    const o = SH.outcome;
    const T = SH.t;
    const plan = resultPlan(slime, o);
    const rare = slime.rarity === 'rare';
    const fadeOut = Math.min(1, Math.max(0, (plan.dur - T) / 0.35));
    if (o === 'win' && T < plan.reveal) {
      if (T < plan.pop + 0.15) {
        const lines = [{ text: slime.id === 'rainbow' ? 'CRITICAL!!' : 'CRITICAL!', y: 84, scale: 3, color: '#ffe070' }];
        if (slime.id === 'rainbow') lines.push({ text: 'PERFECT HUNT!', y: 118, scale: 2, color: 'hsl(' + ((SH.clock * 90) % 360) + ', 90%, 72%)' });
        bigText(lines);
      }
      return;
    }
    if (!SH.revealed) {
      if (o === 'lose' && T > 0.2) bigText([{ text: '...', y: 90, scale: 3, color: '#a0a8ff' }]);
      return;
    }
    const sinceReveal = T - plan.reveal;
    const fadeIn = Math.min(1, sinceReveal / 0.2);
    const a = Math.min(fadeIn, fadeOut);
    if (o === 'win') {
      if (slime.id === 'rainbow') {
        const hue = 'hsl(' + ((SH.clock * 90) % 360) + ', 90%, 72%)';
        bigText([
          { text: 'PERFECT HUNT!', y: 62, scale: 2, color: hue },
          { text: 'RAINBOW SLIME', y: 86, scale: 2, color: '#ffffff' },
          { text: 'DEFEATED!', y: 106, scale: 2, color: '#ffffff' },
          { text: SH.gain + ' MEDAL!!', y: 160, scale: 3, color: '#ffe070' }
        ], a);
      } else {
        const lines = [{ text: 'YOU WIN!', y: 74, scale: 3, color: '#ffe070' }];
        if (rare) lines.push({ text: slime.label + ' SLIME', y: 104, scale: 2, color: '#ffffff' }, { text: 'DEFEATED!', y: 122, scale: 2, color: '#ffffff' });
        lines.push({ text: 'GET', y: rare ? 168 : 150, scale: 2, color: '#ffffff' }, { text: SH.gain + ' MEDAL!', y: rare ? 186 : 168, scale: 2, color: '#ffe070' });
        bigText(lines, a);
      }
      if (SH.newRecord) bigText([{ text: 'NEW RECORD!', y: 236, scale: 2, color: '#ff8ef0' }], a);
    } else {
      bigText([{ text: 'YOU LOSE...', y: 74, scale: 3, color: '#a0b0ff' }, { text: '0 MEDAL', y: 168, scale: 2, color: '#c0c8e0' }], a);
    }
  }

  function drawSlimeFrame() {
    rect(0, 0, W, H, '#06141a');
    rect(1, 1, W - 2, H - 2, '#134a44');
    rect(8, 8, W - 16, H - 16, '#04100f');
    const rainbowOn = SH.slots.some((s) => s && s.id === 'rainbow') || (SH.glow && SH.glow.kind === 'rainbow');
    const chase = Math.floor(SH.clock * 2);
    bulbs.forEach(([x, y], i) => {
      let col;
      if (rainbowOn) col = 'hsl(' + ((i * 14 + SH.clock * 50) % 360) + ', 80%, 62%)';       // ゆっくり色が流れる
      else col = (i + chase) % 3 === 0 ? (i % 2 ? '#7dff8a' : '#ffd040') : '#2a5a44';
      rect(x, y, 2, 2, col);
    });
  }

  function drawSlimeHud() {
    const dx = W - 180; const hx = Math.round(dx / 2);
    rect(24, 11, 132 + dx, 22, '#0e2a2a');
    rect(24, 11, 132 + dx, 1, '#58c878'); rect(24, 32, 132 + dx, 1, '#58c878');
    rect(24, 11, 1, 22, '#58c878'); rect(155 + dx, 11, 1, 22, '#58c878');
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(SH.clock * 1.5);
    rect(26, 13, 128 + dx, 18, '#58e0a0');
    ctx.globalAlpha = 1;
    ctx.drawImage(ICONS.sword, 30, 18);
    ctx.drawImage(ICONS.sword, 143 + dx, 18);
    drawTextCenter('SLIME HUNT', 90 + hx, 17, '#e8ffd8', 2, '#1a6a4a');
    const st = D_().stats.slime;
    rect(12, 36, 74 + hx, 11, '#0a1e22');
    rect(94 + hx, 36, 74 + dx - hx, 11, '#0a1e22');
    drawText('MEDAL', 15, 39, C.dim, 1);
    drawText(String(hand), 83 + hx - textWidth(String(hand), 1), 39, C.goldLight, 1);
    drawText('WIN', 97 + hx, 39, C.dim, 1);
    drawText(String(st.wins), 165 + dx - textWidth(String(st.wins), 1), 39, '#7dff8a', 1);
  }

  function drawInsertPanel() {
    const r = SH_INSERT;
    const idle = SH.phase === 'idle';
    rect(r.x, r.y, r.w, r.h, '#0a2020');
    rect(r.x, r.y, r.w, 1, '#58c878'); rect(r.x, r.y + r.h - 1, r.w, 1, '#1a6a4a');
    rect(r.x, r.y, 1, r.h, '#58c878'); rect(r.x + r.w - 1, r.y, 1, r.h, '#1a6a4a');
    if (idle) {
      const noMed = SH.noMedalT > 0;
      const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(SH.clock * 3));
      ctx.globalAlpha = noMed ? 1 : pulse;                    // ゆっくり明るさが変わる（点滅しない）
      if (noMed) {
        drawTextCenter('NO MEDAL!', BATTLE_POS.x, r.y + 9, C.pink, 2, '#2a0a1a');
      } else {
        drawTextCenter('INSERT', BATTLE_POS.x, r.y + 5, '#ffe070', 2, '#4a3008');
        drawTextCenter('1 MEDAL', BATTLE_POS.x, r.y + 22, '#c8ffd8', 1, '#0a2a1a');
      }
      ctx.globalAlpha = 1;
      drawCoinSprite(coinFull, r.x + 14, r.y + 15);
      rect(r.x + r.w - 26, r.y + 14, 16, 3, '#020808');         // メダル投入口
      rect(r.x + r.w - 26, r.y + 13, 16, 1, '#58c878');
    } else if (SH.phase === 'select') {
      ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(SH.clock * 3));
      drawTextCenter('SELECT A SLIME!', BATTLE_POS.x, r.y + 12, '#fff3a0', 1, '#4a3008');
      ctx.globalAlpha = 1;
    } else if (SH.phase === 'battle') {
      drawTextCenter(SH.t < SHC.moveTime ? 'BATTLE!' : 'TAP!!', BATTLE_POS.x, r.y + 6, '#ffe070', 2, '#4a3008');
      const n = SHC.battleRequiredTaps;
      const x0 = BATTLE_POS.x - (n * 8) / 2;
      for (let i = 0; i < n; i++) rect(x0 + i * 8 + 1, r.y + 23, 6, 5, i < SH.taps ? '#ffd040' : '#1a3a3a');
    } else {
      drawTextCenter(SH.outcome === 'win' ? 'WIN!' : 'LOSE', BATTLE_POS.x, r.y + 9, '#c8ffd8', 2, '#0a2a1a');
    }
  }

  function drawSlimeScreen() {
    drawSlimeFrame();
    drawSlimeHud();

    // ---- アリーナ ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.clip();
    if (SH.shake > 0) ctx.translate(Math.round(Math.sin(SH.clock * 60) * 2 * (SH.shake / 0.4)), Math.round(Math.cos(SH.clock * 50) * 1.5 * (SH.shake / 0.4)));
    ctx.drawImage(arenaBg, ARENA.x, ARENA.y);

    const order = SH.slots.map((s, i) => i).sort((a, b) => slotXY(a).y - slotXY(b).y);
    for (const i of order) drawOrbitSlime(i, SH.phase === 'select');
    if (SH.dim > 0.01) {                                       // 選ばれなかったスライムは暗く
      ctx.globalAlpha = SH.dim;
      rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, '#030a0c');
      ctx.globalAlpha = 1;
    }
    drawGlow();
    if ((SH.phase === 'battle' || SH.phase === 'result') && curSlime()) drawChosen();
    drawFx();
    if (SH.red > 0.01) {                                       // やられたときの、赤いやさしい縁
      ctx.globalAlpha = SH.red * 0.22;
      rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, '#ff2040');
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ---- 文字（アリーナの上） ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    ctx.clip();
    if (SH.phase === 'select') {
      ctx.globalAlpha = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(SH.clock * 3));
      drawTextCenter('SELECT A SLIME!', BATTLE_POS.x, ARENA.y + 3, '#fff3a0', 1, '#4a3008');
      ctx.globalAlpha = 1;
    } else if (SH.phase === 'battle' && SH.t >= SHC.moveTime) {
      if (SH.t < SHC.moveTime + 0.9) drawTextCenter('BATTLE!', BATTLE_POS.x, ARENA.y + 8, '#ffe070', 3, '#4a3008');
      else {
        ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(SH.clock * 5));
        drawTextCenter('TAP!!', BATTLE_POS.x, ARENA.y + 8, '#ffffff', 3, '#4a3008');
        ctx.globalAlpha = 1;
      }
    } else if (SH.phase === 'idle' && SH.noMedalT > 0) {
      drawTextCenter('NO MEDAL!', ORBIT.cx, ORBIT.cy - 6, C.pink, 3, '#2a0a1a');
    }
    if (SH.phase === 'result' && curSlime()) drawResultTexts();
    // 出現のバナー
    if (SH.banner) {
      const b = SH.banner;
      const a = Math.min(1, b.t / 0.3, (b.dur - b.t) / 0.5);
      const col = b.color === 'rainbow' ? 'hsl(' + ((SH.clock * 120) % 360) + ', 90%, 72%)' : b.color;
      ctx.globalAlpha = Math.max(0, a) * 0.85;
      const h = b.lines.length * 18 + 8;
      rect(ARENA.x, ARENA.y + 60, ARENA.w, h, '#03100f');
      ctx.globalAlpha = Math.max(0, a);
      b.lines.forEach((ln, i) => drawTextCenter(ln, BATTLE_POS.x, ARENA.y + 66 + i * 18, col, 2, '#10242a'));
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    drawInsertPanel();

    // ---- 下の記録 ----
    const st = D_().stats.slime;
    const dx = W - 180;
    rect(12, 334, 156 + dx, 14, '#0a1e22');
    drawText('TODAY', 16, 338, C.dim, 1);
    drawText('PLAY ' + st.plays, 48 + Math.round(dx * 0.2), 338, '#e8f0ff', 1);
    drawText('WIN ' + st.wins, 92 + Math.round(dx * 0.45), 338, '#7dff8a', 1);
    drawText('LOSE ' + st.losses, 128 + Math.round(dx * 0.75), 338, '#a0b0ff', 1);
  }

