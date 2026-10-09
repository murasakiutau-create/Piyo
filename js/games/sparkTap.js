'use strict';
  // =====================================================================
  //  ✨ SPARK TAP（パネル音楽ゲーム）
  //   3×3＝9枚の、固定のパネルが、ピアノに合わせて光る。光った場所を、音楽に合わせて直接たたく
  //   SPARK（白い光・タップ）／CHARGE（長い光・押しつづける）／CHAIN（色の順に・連続タップ。各色に、それぞれ判定の時刻がある）
  //   時間の基準は「実際の音源の再生位置」。光の見た目（予告の長さ・アニメ）と、判定の時刻は、別に管理しています
  // =====================================================================
  const STC = CONFIG.sparkTap;
  const stSongs = () => (window.ST_DATA && window.ST_DATA.songs) || [];
  const ST_JACKETS = {};
  const stJacket = (song) => { if (!ST_JACKETS[song.songId]) { const im = new Image(); im.src = song.jacket; ST_JACKETS[song.songId] = im; } const im = ST_JACKETS[song.songId]; return im.complete && im.naturalWidth ? im : null; };
  const ST_MACHINE = { machineId: 'st_sparktap', machineName: 'SPARK TAP', label: 'SPARK TAP', isUnlocked: true, gameType: 'sparkTap', st: true };
  const ST_DIFFS = [['easy', 'EASY', '#7dff8a'], ['normal', 'NORMAL', '#ffe070'], ['hard', 'HARD', '#ff6a8a']];
  const ST = {
    phase: 'select', songIdx: 0, diff: 'normal', song: null, notes: [], touches: new Map(), parts: [], ripples: [], flash: new Array(9).fill(0), jd: null, offs: [], mode: 'song',
    score: 0, total: 1, earned: 0, combo: 0, maxCombo: 0, cnt: { perfect: 0, good: 0, miss: 0 }, paused: false, t: 0, clock: 0, startAt: 0, preroll: 2.0, result: null, newBest: false,
    audio: null, audioOn: false, useCtx: false, ctxStart: 0, src: null, lastA: 0, lastAperf: 0, t0: 0, vtime: null, audioStarted: false, tut: null, after: 'play', dev: { auto: false, timing: false, touch: false }, lastTouch: null, sweep: 0
  };
  const stOff = (song) => (song.musicOffset || 0) + STC.globalOffset;
  function stNow() {
    if (ST.vtime !== null) return ST.vtime;
    if (ST.mode === 'tutorial') return (hbNowPerf() - ST.t0);                                   // 練習：音楽なし。タイマーが、時計
    if (ST.useCtx && actx) return actx.currentTime - ST.ctxStart;                                // Web Audio：音の時計そのもの
    const np = hbNowPerf();
    if (ST.audioOn && ST.audio) { const a = ST.audio.currentTime; if (a !== ST.lastA) { ST.lastA = a; ST.lastAperf = np; } return ST.lastA + (np - ST.lastAperf); }
    return ST.startAt + (np - ST.t0) - ST.preroll;
  }
  function stUnlockAudio() {
    try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) { /* ok */ }
    try { const s = ST.song || stSongs()[ST.songIdx]; if (!s) return; if (!ST.audio || ST.audio.dataset.src !== s.audio) { ST.audio = new Audio(s.audio); ST.audio.dataset.src = s.audio; ST.audio.preload = 'auto'; } ST.audio.muted = true; const pr = ST.audio.play(); if (pr && pr.then) pr.then(() => { ST.audio.pause(); ST.audio.muted = false; ST.audio.currentTime = 0; }).catch(() => { ST.audio.muted = false; }); } catch (e) { /* ok */ }
  }
  function stStartAudio() {
    const s = ST.song; if (!s) return;
    if (actx && s._buf) {
      try { const cur = Math.max(0, stNow()); const src = actx.createBufferSource(); src.buffer = s._buf; const g = actx.createGain(); g.gain.value = muted ? 0 : STC.musicVolume; src.connect(g); g.connect(actx.destination); const when = actx.currentTime + 0.03; const offset = cur + 0.03; src.start(when, offset); ST.ctxStart = when - offset; ST.src = src; ST.useCtx = true; ST.audioOn = true; return; } catch (e) { /* 次へ */ }
    }
    try {
      if (!ST.audio || ST.audio.dataset.src !== s.audio) { ST.audio = new Audio(s.audio); ST.audio.dataset.src = s.audio; ST.audio.preload = 'auto'; }
      ST.audio.muted = muted; ST.audio.currentTime = ST.startAt || 0; ST.audio.volume = STC.musicVolume; ST.audioOn = false;
      const pr = ST.audio.play(); ST.audio.onplaying = () => { ST.audioOn = true; ST.lastA = ST.audio.currentTime; ST.lastAperf = hbNowPerf(); }; if (pr && pr.catch) pr.catch(() => { ST.audioOn = false; });
    } catch (e) { ST.audioOn = false; }
  }
  function stStopAudio() { try { if (ST.src) { ST.src.stop(); ST.src.disconnect(); } } catch (e) { /* ok */ } ST.src = null; ST.useCtx = false; try { if (ST.audio) { ST.audio.pause(); ST.audio.onplaying = null; } } catch (e) { /* ok */ } ST.audioOn = false; }
  // ---- 譜面 → 判定の単位（SPARK 1つ／CHARGE 1つ／CHAIN の各色 1つ） ----
  function stFlatten(chart, from) {
    const out = []; let id = 0;
    for (const n of chart) {
      if (n.type === 'chain') { id++; const t0 = n.notes[0].t; if (t0 < from - 0.3) continue; n.notes.forEach((c) => out.push({ type: 'chain', t: c.t, panel: c.panel, order: c.order, cid: id, ct0: t0, clen: n.notes.length, state: 'wait', final: '' })); }
      else if (n.t >= from - 0.3) out.push({ type: n.type, t: n.t, end: n.end || n.t, panel: n.panel, state: 'wait', pid: null, nextTick: n.t + STC.chargeTick, tickMiss: 0, tickN: 0, final: '' });
    }
    return out;
  }
  function stTotal(notes) { let tot = 0; for (const n of notes) { tot += 1; if (n.type === 'charge') { let k = 0; while (n.t + (k + 1) * STC.chargeTick < n.end - 0.02 && k < STC.chargeMaxTicks) k++; tot += k * STC.chargeTickUnit + STC.chargeTailUnit; } } return Math.max(1, tot); }
  function stPrepare() {
    const song = stSongs()[ST.songIdx]; ST.song = song; const ch = song.charts[ST.diff]; ST.notes = stFlatten(ch.notes, ST.startAt); ST.total = stTotal(ST.notes);
  }
  // ---- パネルの位置 ----
  function stGrid() { const m = 12; const gap = 4; const cw = (W - 2 * m - 2 * gap) / 3; const ch = Math.min(Math.round(cw * 1.55), 92); return { x0: m, y0: 56, cw, ch, gap }; }
  function stRect(i) { const g = stGrid(); const c = i % 3; const r = Math.floor(i / 3); return { x: Math.round(g.x0 + c * (g.cw + g.gap)), y: g.y0 + r * (g.ch + g.gap), w: Math.round(g.cw), h: g.ch }; }
  function stPanelAt(p) {                                                                       // タッチの位置 → パネル（すきまも、近いパネルへ。パネルより、すこし広く受けつける）
    const g = stGrid(); const c = Math.floor((p.x - g.x0 + g.gap / 2) / (g.cw + g.gap)); const r = Math.floor((p.y - g.y0 + g.gap / 2) / (g.ch + g.gap));
    if (p.y < g.y0 - 10 || p.y > g.y0 + 3 * g.ch + 2 * g.gap + 14 || p.x < g.x0 - 8 || p.x > W - g.x0 + 8) return -1;
    return clamp(r, 0, 2) * 3 + clamp(c, 0, 2);
  }
  // ---- 判定・スコア ----
  const stAdd = (u, k) => { ST.earned += u * k; ST.score = Math.round(1000000 * ST.earned / ST.total); };
  const stCombo = (ok) => { if (ok) { ST.combo++; if (ST.combo > ST.maxCombo) ST.maxCombo = ST.combo; } else ST.combo = 0; };
  function stBurst(panel, color, n) { const r = stRect(panel); for (let i = 0; i < n && ST.parts.length < 110; i++) { const a = Math.random() * 6.283; const v = 14 + Math.random() * 30; ST.parts.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.35 + Math.random() * 0.3, color }); } }
  function stJudge(n, dt) {
    const kind = Math.abs(dt) <= STC.perfect ? 'perfect' : 'good'; ST.cnt[kind]++; stAdd(1, kind === 'perfect' ? 1 : STC.goodRate); stCombo(true); ST.jd = { kind, t: 0 }; ST.offs.push(Math.round(dt * 1000)); if (ST.offs.length > 12) ST.offs.shift();
    const col = n.type === 'chain' ? STC.colors[(n.order - 1) % 6] : kind === 'perfect' ? '#ffffff' : '#9fe8ff'; ST.flash[n.panel] = 0.28; ST.ripples.push({ panel: n.panel, t: 0, color: col }); stBurst(n.panel, col, kind === 'perfect' ? 8 : 4);
    if (n.type === 'chain') beep(880 + n.order * 130, 0, 0.05, STC.seVol * 1.3, 'triangle'); else if (n.type === 'charge') beep(660, 0, 0.08, STC.seVol * 1.4, 'triangle'); else beep(kind === 'perfect' ? 1568 : 1175, 0, 0.06, STC.seVol, 'triangle');
    return kind;
  }
  function stMiss(n) { n.state = 'missed'; n.final = 'miss'; ST.cnt.miss++; stCombo(false); ST.jd = { kind: 'miss', t: 0 }; beep(150, 0, 0.08, STC.seVol * 1.2, 'sawtooth', 90); }
  function stPress(panel, id) {
    const now = stNow(); const off = stOff(ST.song); let best = null; let bs = 9;
    ST.flash[panel] = Math.max(ST.flash[panel], 0.2);                                                // 指がふれたパネルは、はっきり光る（空打ちでも、どこをさわったか分かる）
    for (const n of ST.notes) { if (n.state !== 'wait' || n.panel !== panel) continue; const dt = now - (n.t + off); if (Math.abs(dt) > STC.good) continue; if (Math.abs(dt) < bs) { bs = Math.abs(dt); best = n; } }
    if (!best) return null;
    const dt = now - (best.t + off); const kind = stJudge(best, dt);
    if (best.type === 'charge') { best.state = 'active'; best.pid = id; best.headJ = kind; } else { best.state = 'done'; best.final = kind; }
    return best;
  }
  function stRelease(n, now) {
    if (n.state !== 'active') return; const off = stOff(ST.song); const remain = (n.end + off) - now;
    if (remain <= STC.tailEarly) stChargeEnd(n); else { n.state = 'missed'; n.final = 'miss'; ST.cnt.miss++; stCombo(false); ST.jd = { kind: 'miss', t: 0 }; n.pid = null; beep(150, 0, 0.08, STC.seVol * 1.2, 'sawtooth', 90); }
  }
  function stChargeEnd(n) { n.state = 'done'; n.final = n.headJ || 'perfect'; stAdd(STC.chargeTailUnit, 1); stCombo(true); n.pid = null; ST.flash[n.panel] = 0.3; ST.ripples.push({ panel: n.panel, t: 0, color: '#9fe8ff' }); stBurst(n.panel, '#9fe8ff', 8); beep(1318, 0, 0.07, STC.seVol * 1.2, 'triangle'); }
  function stUpdateNotes(dt) {
    const now = stNow(); const off = stOff(ST.song);
    for (const n of ST.notes) {
      const tt = n.t + off;
      if (ST.dev.auto && ST.mode !== 'tutorial' ? true : false) { if (n.state === 'wait' && now >= tt) { stJudge(n, 0); if (n.type === 'charge') { n.state = 'active'; n.pid = 'auto'; n.headJ = 'perfect'; } else { n.state = 'done'; n.final = 'perfect'; } } }
      else if (n.state === 'wait' && now > tt + STC.good) stMiss(n);
      if (n.type === 'charge' && n.state === 'active') {
        const held = n.pid === 'auto' || ST.touches.has(n.pid);
        while (n.nextTick <= now - off && n.nextTick < n.end - 0.02 && n.state === 'active') { if (held) { if (n.tickN < STC.chargeMaxTicks) stAdd(STC.chargeTickUnit, 1); n.tickN++; if (n.tickN % 3 === 0) beep(1047, 0, 0.02, STC.seVol * 0.6); } n.nextTick += STC.chargeTick; }
        if (n.state === 'active' && now - off >= n.end + 0.03) stChargeEnd(n);
      }
    }
    for (let i = 0; i < 9; i++) ST.flash[i] = Math.max(0, ST.flash[i] - dt);
    if (ST.jd) { ST.jd.t += dt; if (ST.jd.t > 0.5) ST.jd = null; }
    for (let i = ST.ripples.length - 1; i >= 0; i--) { ST.ripples[i].t += dt; if (ST.ripples[i].t > 0.45) ST.ripples.splice(i, 1); }
    for (let i = ST.parts.length - 1; i >= 0; i--) { const p = ST.parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; if (p.life > p.max) ST.parts.splice(i, 1); }
  }
  // ---- 練習（チュートリアル） ----
  const ST_TUT = [
    { say: '白く光ったパネルを、タイミングよくタップ！', need: 1, notes: [{ type: 'spark', t: 1.8, panel: 4 }, { type: 'spark', t: 2.9, panel: 2 }, { type: 'spark', t: 4.0, panel: 6 }] },
    { say: '長く光ったら、押しつづけて、最後に離そう！', need: 1, notes: [{ type: 'charge', t: 1.8, panel: 4, end: 3.5 }] },
    { say: 'CHAIN！ 色の順番に、音楽に合わせてタップ！', need: 2, notes: [{ type: 'chain', notes: [{ t: 2.4, panel: 0, order: 1 }, { t: 3.0, panel: 1, order: 2 }, { t: 3.6, panel: 4, order: 3 }] }, { type: 'chain', notes: [{ t: 6.0, panel: 0, order: 1 }, { t: 6.5, panel: 2, order: 2 }, { t: 7.0, panel: 4, order: 3 }, { t: 7.5, panel: 8, order: 4 }] }] }
  ];
  function stTutStart(after) {
    ST.mode = 'tutorial'; ST.after = after; ST.song = stSongs()[ST.songIdx]; ST.tut = { step: 0, tries: 0, hit: 0 }; ST.vtime = null; stStopAudio(); stTutLoad(); ST.phase = 'tutorial'; ST.paused = false; ST.touches.clear();
  }
  function stTutLoad() {
    const s = ST_TUT[ST.tut.step]; ST.notes = stFlatten(s.notes, 0); ST.total = stTotal(ST.notes); ST.t0 = hbNowPerf(); ST.tut.hit = 0; ST.tut.endT = Math.max(...ST.notes.map((n) => (n.end || n.t))) + 1.0; ST.tut.done = false; ST.cnt = { perfect: 0, good: 0, miss: 0 };
  }
  function stTutEnd() {                                                                          // 練習をおわる（SKIP でも、最後まででも）：次回から、自動では出さない
    P_().sparkTap.tutorialSeen = true; writeSave(); ST.mode = 'song'; ST.tut = null; ST.touches.clear();
    if (ST.after === 'play') { stGoReady(); } else { ST.phase = 'select'; }
  }
  function stTutUpdate(dt) {
    const T = ST.tut; stUpdateNotes(dt); const now = stNow();
    if (!T.done && now >= T.endT) {
      T.done = true; const ok = ST.cnt.perfect + ST.cnt.good >= ST_TUT[T.step].need || T.tries >= 2;
      T.msg = ok ? 'OK！' : 'もういちど！'; T.msgT = 0;
      setTimeout(() => { if (ST.phase !== 'tutorial' || !ST.tut) return; if (ok) { ST.tut.step++; ST.tut.tries = 0; if (ST.tut.step >= ST_TUT.length) { stTutEnd(); return; } } else ST.tut.tries++; stTutLoad(); }, 900);
    }
    if (T.msg) T.msgT += dt;
  }
  // ---- フェーズ ----
  function stCharge() {
    if (P_().money < STC.price) { toast('お金が足りないよ（¥' + STC.price + ' 要るよ）'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return false; }
    chargeYen(STC.price); P_().sparkTap.playCount++; writeSave(); return true;
  }
  function stBegin() {                                                                          // 「遊ぶ」：¥100 をはらう → 初回なら、練習するか聞く
    if (!stCharge()) return; stUnlockAudio(); hbLoadBuf(stSongs()[ST.songIdx]); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05);
    ST.phase = 'ask'; ST.song = stSongs()[ST.songIdx];
    if (P_().sparkTap.tutorialSeen) { stGoReady(); return; }
    showDialog({ title: '遊び方を練習する？', lines: [{ text: '練習は、今の ¥100 に入っているよ。 記録には 関係しないよ。', cls: 'dim' }], buttons: [
      { label: 'れんしゅうする', primary: true, onClick: () => stTutStart('play') },
      { label: 'スキップしてはじめる', onClick: () => { P_().sparkTap.tutorialSeen = true; writeSave(); stGoReady(); } } ] });
  }
  function stGoReady() {
    stPrepare(); ST.score = 0; ST.earned = 0; ST.combo = 0; ST.maxCombo = 0; ST.cnt = { perfect: 0, good: 0, miss: 0 }; ST.parts = []; ST.ripples = []; ST.jd = null; ST.touches.clear(); ST.offs = []; ST.mode = 'song'; ST.vtime = ST.vtime;
    ST.phase = 'ready'; ST.t = 0; ST.newBest = false; ST.result = null; stStopAudio();
  }
  const stRank = (sc) => { const r = STC.rank; return sc >= r.S ? 'S' : sc >= r.A ? 'A' : sc >= r.B ? 'B' : sc >= r.C ? 'C' : 'D'; };
  function stFinish() {
    const fc = ST.cnt.miss === 0; const ap = fc && ST.cnt.good === 0; const rank = stRank(ST.score);
    ST.result = { score: ST.score, rank, fc, ap, maxCombo: ST.maxCombo, cnt: { ...ST.cnt } };
    const rec = P_().sparkTap.rec[ST.song.songId] || (P_().sparkTap.rec[ST.song.songId] = {}); const r = rec[ST.diff] || (rec[ST.diff] = { bestScore: 0, bestRank: '-', maxCombo: 0, fullCombo: false, allPerfect: false, plays: 0 });
    if (!ST.dev.auto) { r.plays++; if (ST.score > r.bestScore) { r.bestScore = ST.score; r.bestRank = rank; ST.newBest = true; } if (ST.maxCombo > r.maxCombo) r.maxCombo = ST.maxCombo; if (fc) r.fullCombo = true; if (ap) r.allPerfect = true; writeSave(); }
    ST.phase = 'result'; ST.t = 0; ST.sweep = 0; stStopAudio(); [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle')); if (ap) [1047, 1319, 1568, 2093, 2637].forEach((f, i) => beep(f, 0.5 + i * 0.07, 0.16, 0.05, 'triangle')); else if (fc) [1047, 1319, 1568].forEach((f, i) => beep(f, 0.5 + i * 0.08, 0.14, 0.05));
  }
  function stUpdate(dt) {
    ST.clock += dt; if (ST.paused) return;
    const ph = ST.phase;
    if (ph === 'ready') { ST.t += dt; if (ST.t > 1.5) { ST.phase = 'count'; ST.t = 0; } }
    else if (ph === 'count') { const was = Math.floor(ST.t / 0.6); ST.t += dt; const k = Math.floor(ST.t / 0.6); if (k !== was && k < 3) beep(880 + (k === 2 ? 440 : 0), 0, 0.08, 0.05); if (ST.t >= 1.8) { ST.phase = 'play'; ST.t = 0; ST.t0 = hbNowPerf(); if (ST.vtime !== null) ST.vtime = ST.startAt - ST.preroll; ST.audioStarted = false; ST.audioOn = false; ST.lastA = 0; } }
    else if (ph === 'play') {
      if (!ST.audioStarted && stNow() >= ST.startAt) { ST.audioStarted = true; if (ST.vtime === null) stStartAudio(); }
      if (ST.vtime !== null) ST.vtime += dt;
      ST.t += dt; stUpdateNotes(dt); const now = stNow(); const off = stOff(ST.song);
      const last = ST.notes.length ? Math.max(...ST.notes.map((n) => (n.end || n.t) + off)) : 0;
      if (now >= Math.max(ST.song.duration - 0.2, last + 0.4) && ST.notes.every((n) => n.state === 'done' || n.state === 'missed')) { ST.phase = 'finish'; ST.t = 0; }
    } else if (ph === 'finish') { ST.t += dt; if (ST.t > 1.7) stFinish(); }
    else if (ph === 'result') { ST.t += dt; ST.sweep += dt; for (let i = ST.parts.length - 1; i >= 0; i--) { const p = ST.parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life > p.max) ST.parts.splice(i, 1); } }
    else if (ph === 'tutorial') stTutUpdate(dt);
  }
  // ---- 入力（2点まで、同時に） ----
  function stPointer(e, p) {
    if (ST.phase !== 'play' && ST.phase !== 'tutorial') return; if (ST.paused) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    const panel = stPanelAt(p); ST.lastTouch = { x: p.x, y: p.y, t: 0 }; if (panel < 0) return;
    const t = { id: e.pointerId, panel, note: null }; ST.touches.set(e.pointerId, t); const n = stPress(panel, e.pointerId); if (n && n.type === 'charge') t.note = n;
  }
  function stPointerUp(e) { const t = ST.touches.get(e.pointerId); if (!t) return; ST.touches.delete(e.pointerId); if (t.note && t.note.pid === e.pointerId) stRelease(t.note, stNow()); }
  // ---- DOM ----
  const ST_DOM = {};
  function stBuildDom() {
    if (ST_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + (cls || ''); b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); ST_DOM[id.slice(3)] = b; return b; };
    ST_DIFFS.forEach(([k, label]) => { mk('st-' + k, label, 'hb-diff hb-' + k).addEventListener('click', () => { ensureAudio(); ST.diff = k; beep(660, 0, 0.04, 0.04, 'square'); }); });
    mk('st-start', '¥100 で遊ぶ', 'hb-go').addEventListener('click', () => { ensureAudio(); stBegin(); });
    mk('st-how', 'あそびかた', 'hb-sub st-small').addEventListener('click', () => { ensureAudio(); stTutStart('select'); });
    mk('st-retry', 'もう一度（¥100）', 'hb-go').addEventListener('click', () => { ensureAudio(); stBegin(); });
    mk('st-menu', '選曲へ', 'hb-sub').addEventListener('click', () => { ensureAudio(); ST.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); });
    mk('st-quit', 'やめる', 'hb-quit').addEventListener('click', () => { ensureAudio(); stAskQuit(); });
    mk('st-skip', 'SKIP', 'hb-quit st-small').addEventListener('click', () => { ensureAudio(); stTutEnd(); });
    mk('st-prev', '◀', 'hb-arrow').addEventListener('click', () => { ST.songIdx = (ST.songIdx + stSongs().length - 1) % stSongs().length; });
    mk('st-next', '▶', 'hb-arrow').addEventListener('click', () => { ST.songIdx = (ST.songIdx + 1) % stSongs().length; });
  }
  function stPause() { if (ST.phase !== 'play' || ST.paused) return false; ST.paused = true; ST.pauseAt = hbNowPerf(); ST.touches.clear(); if (ST.useCtx && actx) { try { actx.suspend(); } catch (e) { /* ok */ } } else { try { if (ST.audio) ST.audio.pause(); } catch (e) { /* ok */ } ST.pauseOn = ST.audioOn; ST.audioOn = false; } return true; }
  function stResume() { if (!ST.paused) return; ST.t0 += hbNowPerf() - ST.pauseAt; ST.paused = false; if (ST.useCtx && actx) { try { actx.resume(); } catch (e) { /* ok */ } } else if (ST.pauseOn && ST.audio) { try { ST.audio.play(); } catch (e) { /* ok */ } } }
  function stAskQuit() {
    if (!stPause()) return;
    showDialog({ title: 'やめますか？', lines: [{ text: 'プレイをやめると、 ¥' + STC.price + ' は戻らないよ。', cls: 'dim' }], buttons: [
      { label: '続ける', primary: true, onClick: () => stResume() },
      { label: 'やめる', onClick: () => { ST.paused = false; stStopAudio(); try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) { /* ok */ } ST.phase = 'select'; } } ] });
  }
  function stUi() {
    stBuildDom(); const ph = ST.phase; const sel = ph === 'select'; const multi = stSongs().length > 1; const show = (k, on) => ST_DOM[k].classList.toggle('is-show', !!on);
    ST_DIFFS.forEach(([k]) => { show(k, sel); ST_DOM[k].classList.toggle('is-on', sel && ST.diff === k); });
    show('start', sel); show('how', sel); show('retry', ph === 'result'); show('menu', ph === 'result'); show('quit', ph === 'play' && !ST.paused); show('skip', ph === 'tutorial'); show('prev', sel && multi); show('next', sel && multi);
    const bw = Math.floor((W - 24 - 8) / 3);
    ST_DIFFS.forEach(([k], i) => crPlace(ST_DOM[k], { x: 12 + i * (bw + 4), y: 226, w: bw, h: 28 }));
    crPlace(ST_DOM.start, { x: 24, y: 300, w: W - 48, h: 36 }); crPlace(ST_DOM.how, { x: Math.round(W / 2) - 36, y: 262, w: 72, h: 20 });
    crPlace(ST_DOM.retry, { x: 20, y: 300, w: W - 40, h: 34 }); crPlace(ST_DOM.menu, { x: 20, y: 340, w: W - 40, h: 26 });
    crPlace(ST_DOM.quit, { x: W - 52, y: 10, w: 40, h: 20 }); crPlace(ST_DOM.skip, { x: W - 52, y: 10, w: 40, h: 20 }); crPlace(ST_DOM.prev, { x: 12, y: 80, w: 26, h: 40 }); crPlace(ST_DOM.next, { x: W - 38, y: 80, w: 26, h: 40 });
  }
  function stHide() { if (!ST_DOM.start) return; Object.keys(ST_DOM).forEach((k) => ST_DOM[k].classList.remove('is-show')); }
  // ---- 描画 ----
  const pad7s = (n) => String(Math.max(0, Math.floor(n))).padStart(7, '0');
  const stColor = (order) => STC.colors[(order - 1) % STC.colors.length];
  function stBg() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#04060e');
    for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#060a18', '#03040a', (y - 8) / (H - 16)));
    for (let i = 0; i < 26; i++) { const x = 12 + (i * 53) % (W - 24); const y = 10 + (i * 97) % (H - 20); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(ST.clock * 0.8 + i); rect(x, y, 1, 1, '#6a8aff'); ctx.globalAlpha = 1; }       // 星（ゆっくり）
  }
  function stDrawPanel(i, now, off) {
    const r = stRect(i); const base = ST.flash[i] > 0 ? mixHex('#0c1426', '#ffffff', Math.min(1, ST.flash[i] * 3)) : '#0a1222';
    rect(r.x, r.y, r.w, r.h, '#162744'); rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, base);                                 // 暗い地＋はっきりした境目
    rect(r.x + 1, r.y + 1, r.w - 2, 1, '#22385e'); rect(r.x + 1, r.y + r.h - 2, r.w - 2, 1, '#06101e');
    for (const n of ST.notes) {
      if (n.panel !== i) continue; const tt = n.t + off;
      if (n.type === 'spark') {
        if (n.state !== 'wait') continue; const p = (now - (tt - STC.preview)) / STC.preview; if (p < 0 || p > 1.25) continue; stHintRing(r, clamp(p, 0, 1), '#ffffff', 0.9);
      } else if (n.type === 'charge') {
        if (n.state === 'done' || n.state === 'missed') continue; const te = n.end + off; const act = n.state === 'active';
        if (now < tt - STC.preview || now > te + 0.2) continue; const p = clamp((now - (tt - STC.preview)) / STC.preview, 0, 1);
        if (!act) { stHintRing(r, p, '#7ae8ff', 0.8); ctx.globalAlpha = 0.35 * p; rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, '#2a9fd8'); ctx.globalAlpha = 1; rect(r.x + 4, r.y + 4, 3, Math.round((r.h - 8) * clamp((te - tt) / 2.2, 0.2, 1)), '#7ae8ff'); }
        else {                                                                                                         // 押している間：光が溜まる・外周がまわる・粒がよる
          const k = clamp((now - tt) / Math.max(0.1, te - tt), 0, 1); ctx.globalAlpha = 0.45 + 0.4 * k; rect(r.x + 2, r.y + 2 + Math.round((r.h - 4) * (1 - k)), r.w - 4, Math.round((r.h - 4) * k), '#7ae8ff'); ctx.globalAlpha = 1;
          for (let q = 0; q < 8; q++) { const a = ST.clock * 3 + q * 0.785; rect(Math.round(r.x + r.w / 2 + Math.cos(a) * (r.w / 2 - 3)), Math.round(r.y + r.h / 2 + Math.sin(a) * (r.h / 2 - 3)), 2, 2, '#ffffff'); }
        }
      } else {
        if (n.state === 'done' || n.state === 'missed') continue; const vis0 = n.ct0 + off - STC.chainPreview; if (now < vis0 || now > tt + STC.good + 0.25) continue;
        // いま たたくべき色：前の色の「時刻」がすぎるまでは、前の色のまま（たたくのが早くても、遅くても、切りかわるのは、前の色の時刻）
        const cur = !ST.notes.some((m) => m.type === 'chain' && m.cid === n.cid && m.order < n.order && (m.t + off + 0.05) > now);
        const col = stColor(n.order); ctx.globalAlpha = cur ? 0.55 : 0.18; rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, col); ctx.globalAlpha = 1;
        if (cur) { const pu = 0.7 + 0.3 * Math.sin(ST.clock * 5); ctx.globalAlpha = pu; rect(r.x, r.y, r.w, 2, col); rect(r.x, r.y + r.h - 2, r.w, 2, col); rect(r.x, r.y, 2, r.h, col); rect(r.x + r.w - 2, r.y, 2, r.h, col); ctx.globalAlpha = 1; }
        const ringP = (now - (tt - STC.chainRing)) / STC.chainRing;                                                                // この色の、たたく時刻に向かって、色つきの光が集まる（どの色も、自分の時刻が、見える）
        if (ringP > 0) stHintRing(r, clamp(ringP, 0, 1), col, cur ? 1 : 0.6);
        drawTextCenter(String(n.order), r.x + r.w / 2 + 0.5, r.y + 6, cur ? '#ffffff' : '#d8e0f0', cur ? 3 : 2, '#10162a');                         // 色＋数字
      }
    }
    for (const rp of ST.ripples) if (rp.panel === i) { const k = rp.t / 0.45; const gx = Math.round((r.w / 2) * k * 0.7); const gy = Math.round((r.h / 2) * k * 0.7); ctx.globalAlpha = 1 - k; rect(r.x + gx, r.y + gy, r.w - gx * 2, 1, rp.color); rect(r.x + gx, r.y + r.h - gy - 1, r.w - gx * 2, 1, rp.color); rect(r.x + gx, r.y + gy, 1, r.h - gy * 2, rp.color); rect(r.x + r.w - gx - 1, r.y + gy, 1, r.h - gy * 2, rp.color); ctx.globalAlpha = 1; }
  }
  function stHintRing(r, p, color, a) {                                                         // 予告：光が外から中心へ集まり、だんだん明るくなる
    const inset = Math.round((1 - p) * Math.min(r.w, r.h) * 0.42); ctx.globalAlpha = (0.2 + 0.7 * p) * a;
    rect(r.x + inset, r.y + inset, r.w - inset * 2, 1, color); rect(r.x + inset, r.y + r.h - inset - 1, r.w - inset * 2, 1, color); rect(r.x + inset, r.y + inset, 1, r.h - inset * 2, color); rect(r.x + r.w - inset - 1, r.y + inset, 1, r.h - inset * 2, color);
    ctx.globalAlpha = (0.05 + 0.4 * p * p) * a; rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, color); ctx.globalAlpha = 1;
    if (p > 0.82) { ctx.globalAlpha = 0.9; rect(r.x + 1, r.y + 1, r.w - 2, 2, color); rect(r.x + 1, r.y + r.h - 3, r.w - 2, 2, color); ctx.globalAlpha = 1; }
  }
  function stHud() {
    if (ST.mode !== 'tutorial') { drawText('SCORE', 14, 14, '#7a8ac8', 1); drawText(pad7s(ST.score), 14, 22, '#ffffff', 2, '#1a2a6a'); }
    if (ST.combo >= 2) { const cs = String(ST.combo); const rx = W - 62; drawText('COMBO', rx - textWidth('COMBO', 1), 14, '#7a8ac8', 1); drawText(cs, rx - textWidth(cs, 2), 22, '#ffe9a0', 2, '#6a3a1a'); }
    if (ST.jd) { const j = ST.jd; const col = j.kind === 'perfect' ? '#ffe070' : j.kind === 'good' ? '#7ad8ff' : '#ff6a8a'; ctx.globalAlpha = Math.max(0, 1 - j.t / 0.5); drawTextCenter(j.kind === 'perfect' ? 'PERFECT!' : j.kind === 'good' ? 'GOOD' : 'MISS', W / 2, 40, col, 1, '#0a0a20'); ctx.globalAlpha = 1; }
  }
  function stDrawPlay() {
    const now = stNow(); const off = stOff(ST.song || stSongs()[0]); stBg(); stHud();
    for (let i = 0; i < 9; i++) stDrawPanel(i, now, off);
    for (const p of ST.parts) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); rect(Math.round(p.x), Math.round(p.y), 2, 2, p.color); } ctx.globalAlpha = 1;
    if (ST.dev.timing) { ST.offs.forEach((o, k) => drawText((o >= 0 ? '+' : '') + o, 14 + k * 12, 342, Math.abs(o) <= STC.perfect * 1000 ? '#7dff8a' : '#ffe070', 1)); drawText('T ' + now.toFixed(2), 14, 352, '#7a8ac8', 1); if (ST.dev.auto) drawText('AUTO', W - 40, 352, '#ff6a8a', 1); }
    if (ST.dev.touch && ST.lastTouch) { ctx.globalAlpha = 0.6; rect(Math.round(ST.lastTouch.x) - 3, Math.round(ST.lastTouch.y) - 3, 7, 7, '#ff6a8a'); ctx.globalAlpha = 1; }
  }
  function stDrawTutorial() {
    stDrawPlay(); const T = ST.tut; if (!T) return; drawTextCenter('STEP ' + (T.step + 1) + ' / ' + ST_TUT.length, W / 2, 337, '#7ad8ff', 1);
    const say = ST_TUT[T.step].say; stSayEl().textContent = (T.msg && T.msgT < 0.9 ? T.msg + '　' : '') + say;
  }
  let stSayDom = null;
  function stSayEl() { if (!stSayDom) { stSayDom = document.createElement('div'); stSayDom.className = 'prize-info st-say'; screenEl.appendChild(stSayDom); } return stSayDom; }
  function stDrawSelect() {
    const s = stSongs()[ST.songIdx]; stBg(); drawTextCenter('SPARK TAP', W / 2, 14, '#9fe8ff', 2, '#1a3a8a');
    const j = s ? stJacket(s) : null; const sz = 128; const jx = Math.round(W / 2 - sz / 2); const jy = 34;
    ctx.globalAlpha = 0.5; rect(jx - 3, jy - 3, sz + 6, sz + 6, '#3a6aff'); ctx.globalAlpha = 1; rect(jx - 1, jy - 1, sz + 2, sz + 2, '#ffffff');
    if (j) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(j, jx, jy, sz, sz); ctx.restore(); }
    drawTextCenter(s ? s.title : '', W / 2, 172, '#ffffff', 1, '#1a2a6a'); drawTextCenter(s ? 'BPM ' + Math.round(s.bpm) : '', W / 2, 184, '#7a8ac8', 1);
    const r = s && P_().sparkTap.rec[s.songId] && P_().sparkTap.rec[s.songId][ST.diff];
    drawTextCenter('BEST ' + (r && r.bestScore ? pad7s(r.bestScore) + '  ' + r.bestRank : '-------  -'), W / 2, 202, '#ffe9a0', 1);
    if (r && (r.fullCombo || r.allPerfect)) drawTextCenter(r.allPerfect ? 'ALL PERFECT' : 'FULL COMBO', W / 2, 212, '#7dff8a', 1);
    drawTextCenter('YEN ' + P_().money + '   1 PLAY  YEN ' + STC.price, W / 2, 286, '#ffe070', 1);
  }
  function stDrawReadyCount() {
    const s = ST.song; const j = stJacket(s); stBg(); const sz = 120; if (j) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(j, Math.round(W / 2 - sz / 2), 50, sz, sz); ctx.restore(); }
    drawTextCenter(s.title, W / 2, 180, '#ffffff', 1, '#1a2a6a'); const dl = ST_DIFFS.find((d) => d[0] === ST.diff); drawTextCenter(dl[1], W / 2, 196, dl[2], 2, '#0a0a20');
    if (ST.phase === 'ready') drawTextCenter('READY?', W / 2, 250, '#9fe8ff', 4, '#1a3a8a'); else { const k = Math.min(2, Math.floor(ST.t / 0.6)); drawTextCenter(String(3 - k), W / 2, 240, '#ffffff', 8, '#3a6aff'); }
  }
  function stDrawResult() {
    const R = ST.result; const s = ST.song; const t = ST.sweep; stBg();
    if (R.ap) {                                                                                    // ALL PERFECT：9枚のパネルに、光が走る
      for (let i = 0; i < 9; i++) { const rr = stRect(i); const delay = (i % 3 + Math.floor(i / 3)) * 0.12; const k = clamp((t - delay) / 0.4, 0, 1); const col = STC.colors[i % 6]; const wave = 0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.7); ctx.globalAlpha = k * (0.14 + 0.1 * wave); rect(rr.x, rr.y + 64, rr.w, rr.h - 64, col); ctx.globalAlpha = 1; }
    }
    drawTextCenter('RESULT', W / 2, 12, '#ffffff', 2, '#1a3a8a'); const dl = ST_DIFFS.find((d) => d[0] === ST.diff); drawTextCenter(s.title + '  ' + dl[1], W / 2, 30, dl[2], 1);
    const j = stJacket(s); if (j) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(j, 16, 46, 64, 64); ctx.restore(); }
    const rc = { S: '#ffe070', A: '#ff9ad4', B: '#7ad8ff', C: '#9fe8b0', D: '#b8b8d0' }[R.rank]; drawTextCenter(R.rank, W - 56, 50, rc, 8, '#10163a'); drawText('RANK', W - 71, 42, '#7a8ac8', 1);
    drawTextCenter(pad7s(R.score), W / 2, 124, '#ffffff', 3, '#1a2a6a'); drawText('SCORE', Math.round(W / 2 - 10), 116, '#7a8ac8', 1);
    [['PERFECT', R.cnt.perfect, '#ffe070'], ['GOOD', R.cnt.good, '#7ad8ff'], ['MISS', R.cnt.miss, '#ff6a8a'], ['MAX COMBO', R.maxCombo, '#ffe9a0']].forEach(([lb, v, c], i) => { const y = 154 + i * 15; drawText(lb, 30, y, '#a8b8e8', 1); const vs = String(v); drawText(vs, W - 30 - textWidth(vs, 1), y, c, 1); });
    if (R.ap) { for (let q = 0; q < 6; q++) { const col = STC.colors[q]; ctx.globalAlpha = 0.9; drawTextCenter(q === 2 ? 'ALL PERFECT' : '', W / 2, 222, col, 2, '#0a0a20'); ctx.globalAlpha = 1; } drawTextCenter('ALL PERFECT', W / 2, 222, STC.colors[Math.floor(t * 3) % 6], 2, '#0a0a20'); drawTextCenter('SPARK COMPLETE!', W / 2, 242, '#ffffff', 1, '#1a3a8a'); }
    else if (R.fc) drawTextCenter('FULL COMBO!', W / 2, 226, '#7dff8a', 2, '#0a3a1a');
    if (ST.newBest && !ST.dev.auto) drawTextCenter('NEW BEST!', W / 2, 262, '#ffe070', 1, '#3a2a10'); if (ST.dev.auto) drawTextCenter('AUTOPLAY  NO RECORD', W / 2, 262, '#ff6a8a', 1);
    if ((R.ap || R.fc) && ST.parts.length < 50 && Math.floor(t * 10) !== Math.floor((t - 1 / 60) * 10)) stBurst(Math.floor(Math.random() * 9), STC.colors[Math.floor(Math.random() * 6)], 3);
    for (const p of ST.parts) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); rect(Math.round(p.x), Math.round(p.y), 2, 2, p.color); } ctx.globalAlpha = 1;
  }
  function stDraw() {
    if (!stSongs().length) { stBg(); drawTextCenter('NO SONG', W / 2, 160, '#ff6a8a', 2); return; }
    ST.song = ST.song || stSongs()[ST.songIdx]; const ph = ST.phase;
    if (ph !== ST.lastPh) { ST.lastPh = ph; if (ph === 'select') setMessage('曲と難しさを選んで、遊ぼう！', C.cyan); else setMessage(''); }
    if (ph === 'select' || ph === 'ask') { ST.song = stSongs()[ST.songIdx]; stDrawSelect(); } else if (ph === 'ready' || ph === 'count') stDrawReadyCount();
    else if (ph === 'play' || ph === 'finish') { stDrawPlay(); if (ph === 'finish') { ctx.globalAlpha = Math.min(0.6, ST.t * 1.5); rect(8, 8, W - 16, H - 16, '#04060e'); ctx.globalAlpha = 1; drawTextCenter('FINISH!', W / 2, 150, '#9fe8ff', 4, '#1a3a8a'); } }
    else if (ph === 'tutorial') stDrawTutorial(); else stDrawResult();
    if (stSayDom) { stSayDom.classList.toggle('is-show', ph === 'tutorial'); if (ph === 'tutorial') crPlace(stSayDom, { x: 12, y: 346, w: W - 24, h: 28 }); }
    stUi();
  }
  function openStDev() {
    const song = stSongs()[ST.songIdx]; const lines = () => [{ text: 'autoplay ' + (ST.dev.auto ? 'ON（記録しない）' : 'OFF') + ' / 判定ずれ ' + (ST.dev.timing ? 'ON' : 'OFF') + ' / タッチ位置 ' + (ST.dev.touch ? 'ON' : 'OFF'), cls: 'dim' }, { text: 'PERFECT ±' + Math.round(STC.perfect * 1000) + 'ms / GOOD ±' + Math.round(STC.good * 1000) + 'ms / 予告 ' + Math.round(STC.preview * 1000) + 'ms', cls: 'dim' }, { text: 'musicOffset ' + Math.round((song.musicOffset || 0) * 1000) + 'ms / 全体offset ' + Math.round(STC.globalOffset * 1000) + 'ms / 開始 ' + ST.startAt + 's / 難易度 ' + ST.diff, cls: 'dim' }];
    const again = (f) => () => { f(); setTimeout(openStDev, 0); };
    showDialog({ title: 'SPARK TAP DEV', wide: true, lines: lines(), buttons: [
      { label: 'AUTOPLAY ON/OFF', onClick: again(() => { ST.dev.auto = !ST.dev.auto; }) }, { label: '判定ずれを表示 ON/OFF', onClick: again(() => { ST.dev.timing = !ST.dev.timing; }) }, { label: 'タッチ位置を表示 ON/OFF', onClick: again(() => { ST.dev.touch = !ST.dev.touch; }) },
      { label: 'PERFECT幅 +5ms', onClick: again(() => { STC.perfect = Math.min(STC.good - 0.01, STC.perfect + 0.005); }) }, { label: 'PERFECT幅 -5ms', onClick: again(() => { STC.perfect = Math.max(0.02, STC.perfect - 0.005); }) },
      { label: 'GOOD幅 +10ms', onClick: again(() => { STC.good += 0.01; }) }, { label: 'GOOD幅 -10ms', onClick: again(() => { STC.good = Math.max(STC.perfect + 0.01, STC.good - 0.01); }) },
      { label: '予告 +100ms', onClick: again(() => { STC.preview = Math.min(1.5, STC.preview + 0.1); }) }, { label: '予告 -100ms', onClick: again(() => { STC.preview = Math.max(0.3, STC.preview - 0.1); }) },
      { label: 'musicOffset +10ms', onClick: again(() => { song.musicOffset = (song.musicOffset || 0) + 0.01; }) }, { label: 'musicOffset -10ms', onClick: again(() => { song.musicOffset = (song.musicOffset || 0) - 0.01; }) },
      { label: '全体offset +10ms', onClick: again(() => { STC.globalOffset += 0.01; }) }, { label: '全体offset -10ms', onClick: again(() => { STC.globalOffset -= 0.01; }) },
      { label: '曲の 10秒から（+10s）', onClick: again(() => { ST.startAt = (ST.startAt + 10) % Math.max(10, Math.floor(song.duration - 8)); }) }, { label: '曲の 先頭から', onClick: again(() => { ST.startAt = 0; }) },
      { label: '譜面を 再読み込み', onClick: () => { const sc = document.createElement('script'); sc.src = 'assets/sparktap/sparktap_data.js?v=' + Date.now(); sc.onload = () => { toast('譜面を 読みこみました'); setTimeout(openStDev, 0); }; document.head.appendChild(sc); } },
      { label: 'SPARK TAP DEV…', onClick: () => { setTimeout(openStDev, 0); } },
      { label: 'KAWAII CLUB DEV…', onClick: () => { setTimeout(openKcDev, 0); } },
      { label: 'TOP DRIVER DEV…', onClick: () => { setTimeout(openTdDev, 0); } },
      { label: 'VENDING DEV…', onClick: () => { setTimeout(openVmDev, 0); } },
      { label: 'STICKER DEV…', onClick: () => { setTimeout(openGcDev, 0); } },
      { label: 'BASKET RUSH DEV…', onClick: () => { setTimeout(openBrDev, 0); } },
      { label: 'NICE BATTING DEV…', onClick: () => { setTimeout(openNbDev, 0); } },
      { label: 'POWER PUNCH DEV…', onClick: () => { setTimeout(openPpDev, 0); } },
      { label: 'AIR SMASH DEV…', onClick: () => { setTimeout(openAsDev, 0); } },
      { label: 'ELEVATOR DEV…', onClick: () => { setTimeout(openElevDev, 0); } },
      { label: 'STRIKE ZONE DEV…', onClick: () => { setTimeout(openSzDev, 0); } },
      { label: 'PING PONG RALLY DEV…', onClick: () => { setTimeout(openTtDev, 0); } },
      { label: 'BIG BINGO DEV…', onClick: () => { setTimeout(openBgDev, 0); } },
      { label: 'JEWEL CHAIN DEV…', onClick: () => { setTimeout(openJcDev, 0); } },
      { label: 'BLOCK CRASH DEV…', onClick: () => { setTimeout(openBcDev, 0); } },
      { label: 'GHOST PANIC DEV…', onClick: () => { setTimeout(openGpDev, 0); } },
      { label: 'MYSTERY HOUSE DEV…', onClick: () => { setTimeout(openMhDev, 0); } },
      { label: 'HORROR HOUSE(旧) DEV…', onClick: () => { setTimeout(openHhDev, 0); } },
      { label: 'HYAKKI YAKO DEV…', onClick: () => { setTimeout(openHyDev, 0); } },
      { label: 'GO! GO! ROCKET DEV…', onClick: () => { setTimeout(openRkDev, 0); } },
      { label: 'NINE BREAK DEV…', onClick: () => { setTimeout(openNkDev, 0); } },
      { label: 'BULL DARTS DEV…', onClick: () => { setTimeout(openBdDev, 0); } },
      { label: 'SEA ATTACK DEV…', onClick: () => { setTimeout(openSaDev, 0); } },
      { label: 'とじる', primary: true } ] });
  }
  mgRegister('sparkTap', {
    reset() { ST.phase = 'select'; ST.paused = false; ST.mode = 'song'; stStopAudio(); }, phase: () => ST.phase,
    enter() { stBuildDom(); ST.phase = 'select'; ST.paused = false; ST.mode = 'song'; ST.song = stSongs()[ST.songIdx] || null; hbLoadBuf(ST.song); setMessage('曲と難しさを選んで、遊ぼう！', C.cyan); },
    update: stUpdate, draw: stDraw, hint: '光ったパネルを、音楽に合わせてタップ！',
    pointer: stPointer, pointerUp: stPointerUp
  });
  GAME_TYPES.sparkTap.canLeave = () => ST.phase === 'select' || ST.phase === 'result';
  GAME_TYPES.sparkTap.msgBox = () => ({ x: 14, y: 348, w: 152 + (W - 180), h: 20 });

