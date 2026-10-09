'use strict';
  // =====================================================================
  //  ♪ HAPPY BEAT（音楽ゲーム）
  //   4レーンのノーツを、音楽に合わせて直接タップ。TAP / HOLD / SLIDE HOLD（1本の指で、帯をなぞる）
  //   時間の基準は「実際の音源の再生位置」。ノーツの流れる速さ(approach)と、判定の時刻は、別に管理しています
  //   曲・譜面は assets/happybeat/happybeat_data.js（HB_DATA）。難易度ごとに、完全に分かれています
  // =====================================================================
  const HBC = CONFIG.happyBeat;
  const HB_IMG = {};
  ['pink', 'blue'].forEach((c) => [1, 2, 3].forEach((i) => { const im = new Image(); im.src = 'assets/happybeat/' + c + 'panda' + i + '.webp'; HB_IMG[c + i] = im; }));
  const HB_JACKETS = {};
  const hbJacket = (song) => { if (!HB_JACKETS[song.songId]) { const im = new Image(); im.src = song.jacket; HB_JACKETS[song.songId] = im; } const im = HB_JACKETS[song.songId]; return im.complete && im.naturalWidth ? im : null; };
  const hbSongs = () => (window.HB_DATA && window.HB_DATA.songs) || [];
  const HB_MACHINE = { machineId: 'hb_happybeat', machineName: 'HAPPY BEAT', label: 'HAPPY BEAT', isUnlocked: true, gameType: 'happyBeat', hb: true };
  const HB_DIFFS = [['easy', 'EASY', '#7dff8a'], ['normal', 'NORMAL', '#ffe070'], ['hard', 'HARD', '#ff6a8a']];
  const HB = {
    phase: 'select', songIdx: 0, diff: 'normal', t: 0, song: null, notes: [], touches: new Map(), parts: [], flash: [0, 0, 0, 0], jd: null, miss: 0,
    score: 0, total: 1, earned: 0, combo: 0, maxCombo: 0, cnt: { perfect: 0, good: 0, miss: 0 }, broke: 0, paused: false,
    audio: null, audioOn: false, t0: 0, lastA: 0, lastAperf: 0, vtime: null, preroll: 2.0, startAt: 0, result: null, newBest: false, offs: [], clock: 0, shake: 0, count: 0, dev: { auto: false, timing: false }
  };
  const hbNowPerf = () => performance.now() / 1000;
  const hbOffset = (song) => (song.musicOffset || 0) + HBC.globalOffset;                  // 曲ごとのオフセット＋全体の判定オフセット（秒）
  // ---- 時間：音源の再生位置を基準にする（音源が動き出すまでは、準備のタイマー） ----
  function hbNow() {
    if (HB.vtime !== null) return HB.vtime;                                              // DEV/テスト用の、仮の時計
    if (HB.useCtx && actx) return actx.currentTime - HB.ctxStart;                        // Web Audio：音の時計そのもの（描画が重くなっても、ずれない）
    const np = hbNowPerf();
    if (HB.audioOn && HB.audio) {
      const a = HB.audio.currentTime;
      if (a !== HB.lastA) { HB.lastA = a; HB.lastAperf = np; }
      return HB.lastA + (np - HB.lastAperf);                                             // 再生位置は、細かく進まないので、そのあいだは、経過時間でなめらかに
    }
    return HB.startAt + (np - HB.t0) - HB.preroll;
  }
  function hbLoadBuf(song) {                                                               // 曲を、あらかじめ読みこんで、デコードしておく（選曲画面にいる間に）
    if (!song || song._buf || song._loading || !actx) return; song._loading = true;
    fetch(song.audio).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => { const p = actx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); })).then((buf) => { song._buf = buf; }).catch(() => { song._loadFail = true; }).then(() => { song._loading = false; });
  }
  function hbUnlockAudio() {                                                               // 「あそぶ」を押した（画面にさわった）瞬間に、音の再生を、許可してもらう
    try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) { /* ok */ }
    try {
      const s = HB.song || hbSongs()[HB.songIdx]; if (!s) return;
      if (!HB.audio || HB.audio.dataset.src !== s.audio) { HB.audio = new Audio(s.audio); HB.audio.dataset.src = s.audio; HB.audio.preload = 'auto'; }
      HB.audio.muted = true; const pr = HB.audio.play();                                       // 予備：<audio> も、この瞬間に、ためしに再生して許可をもらう（すぐ止める）
      if (pr && pr.then) pr.then(() => { HB.audio.pause(); HB.audio.muted = false; HB.audio.currentTime = 0; }).catch(() => { HB.audio.muted = false; });
    } catch (e) { /* ok */ }
  }
  function hbStartAudio() {
    const s = HB.song; if (!s) return;
    if (actx && s._buf) {                                                                  // 第1候補：Web Audio（時計も、音の時計 actx.currentTime を使うので、ずれない）
      try {
        const cur = Math.max(0, hbNow()); const src = actx.createBufferSource(); src.buffer = s._buf; const g = actx.createGain(); g.gain.value = muted ? 0 : HBC.musicVolume; src.connect(g); g.connect(actx.destination);
        const when = actx.currentTime + 0.03; const offset = cur + 0.03; src.start(when, offset); HB.ctxStart = when - offset; HB.src = src; HB.gain = g; HB.useCtx = true; HB.audioOn = true; return;
      } catch (e) { /* 次の方法へ */ }
    }
    try {                                                                                  // 第2候補：<audio>（Web Audio が使えないとき）
      if (!HB.audio || HB.audio.dataset.src !== s.audio) { HB.audio = new Audio(s.audio); HB.audio.dataset.src = s.audio; HB.audio.preload = 'auto'; }
      HB.audio.muted = muted; HB.audio.currentTime = HB.startAt || 0; HB.audio.volume = HBC.musicVolume; HB.audioOn = false;
      const pr = HB.audio.play(); const on = () => { HB.audioOn = true; HB.lastA = HB.audio.currentTime; HB.lastAperf = hbNowPerf(); };
      HB.audio.onplaying = on; if (pr && pr.catch) pr.catch(() => { HB.audioOn = false; });
    } catch (e) { HB.audioOn = false; }
  }
  function hbStopAudio() {
    try { if (HB.src) { HB.src.stop(); HB.src.disconnect(); } } catch (e) { /* ok */ } HB.src = null; HB.useCtx = false;
    try { if (HB.audio) { HB.audio.pause(); HB.audio.onplaying = null; } } catch (e) { /* ok */ } HB.audioOn = false;
  }
  // ---- 譜面の用意 ----
  function hbPrepare() {
    const song = hbSongs()[HB.songIdx]; HB.song = song; const ch = song.charts[HB.diff];
    HB.notes = ch.notes.filter((n) => n.t >= HB.startAt - 0.3).map((n) => {
      const o = { src: n, type: n.type, t: n.t, lane: n.lane, end: n.end || n.t, path: n.path || null, state: 'wait', pid: null, nextTick: 0, tickMiss: 0, tickN: 0, headJ: '', checks: 0 };
      if (o.type !== 'tap') { o.nextTick = o.t + HBC.tickEvery; o.ticks = Math.max(1, Math.floor((o.end - o.t - 0.05) / HBC.tickEvery)); if (o.path) o.cp = o.path.slice(1).map((p) => ({ t: p[1], done: false })); }
      return o;
    });
    let total = 0; for (const n of HB.notes) { total += 1; if (n.type !== 'tap') total += Math.min(n.ticks, HBC.maxTickUnits) * HBC.tickUnit + (n.cp ? n.cp.length * HBC.checkUnit : 0) + HBC.tailUnit; }
    HB.total = Math.max(1, total);
  }
  function hbReqLane(n, t) {                                                              // 時刻 t に、指がいるべきレーン（小数）。次のレーンへは、直前の 0.2秒で、なめらかに
    if (!n.path) return n.lane; const P = n.path; if (t <= P[0][1]) return P[0][0];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i]; const b = P[i + 1];
      if (t < b[1]) { const g0 = b[1] - HBC.glide; if (t <= g0 || a[0] === b[0]) return a[0]; const k = (t - g0) / HBC.glide; return a[0] + (b[0] - a[0]) * (0.5 - 0.5 * Math.cos(Math.PI * k)); }
    }
    return P[P.length - 1][0];
  }
  // ---- 画面の寸法 ----
  function hbL() { const m = 14; const lw = (W - 2 * m) / 4; return { x0: m, lw, top: 84, judge: 316, bottom: 362 }; }
  const hbLX = (L, i) => L.x0 + L.lw * (i + 0.5);
  const hbFx = (L, x) => (x - L.x0) / L.lw - 0.5;                                          // 画面の x → レーン番号（小数。レーン i の中心が i）
  // ---- 判定・スコア ----
  function hbAdd(units, k) { HB.earned += units * k; HB.score = Math.round(1000000 * HB.earned / HB.total); }
  function hbCombo(ok) { if (ok) { HB.combo++; if (HB.combo > HB.maxCombo) HB.maxCombo = HB.combo; } else { HB.combo = 0; } }
  function hbShow(kind, x, dtMs) { HB.jd = { kind, t: 0, x }; if (dtMs !== undefined) { HB.offs.push(dtMs); if (HB.offs.length > 14) HB.offs.shift(); } }
  function hbBurst(x, y, color, n) { for (let i = 0; i < n && HB.parts.length < 90; i++) { const a = Math.random() * 6.283; const v = 12 + Math.random() * 26; HB.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, life: 0, max: 0.4 + Math.random() * 0.3, color }); } }
  function hbFinal(n, kind) {                                                             // 1ノーツにつき、最終の判定を、1つだけ数える
    if (n.final) return; n.final = kind; HB.cnt[kind]++;
    if (kind === 'miss') { HB.miss = 0.45; HB.broke++; }
  }
  function hbHeadHit(n, dt, lx) {
    const kind = Math.abs(dt) <= HBC.perfect ? 'perfect' : 'good'; n.headJ = kind;
    hbAdd(1, kind === 'perfect' ? 1 : HBC.goodRate); hbCombo(true); hbShow(kind, lx, Math.round(dt * 1000));
    const L = hbL(); hbBurst(lx, L.judge, kind === 'perfect' ? '#ffe070' : '#7ad8ff', kind === 'perfect' ? 8 : 4);
    if (n.type === 'tap') { n.state = 'done'; hbFinal(n, kind); beep(kind === 'perfect' ? 1760 : 1320, 0, 0.035, HBC.seVol); }
    else { n.state = 'active'; beep(988, 0, 0.06, HBC.seVol * 1.2, 'triangle'); }
  }
  function hbMissHead(n) { n.state = 'missed'; hbFinal(n, 'miss'); hbCombo(false); hbShow('miss', hbLX(hbL(), n.lane)); beep(150, 0, 0.09, HBC.seVol * 1.3, 'sawtooth', 90); }
  function hbBreak(n) { if (n.state === 'done' || n.state === 'missed') return; n.state = 'missed'; hbFinal(n, 'miss'); hbCombo(false); hbShow('miss', hbLX(hbL(), n.lane)); n.pid = null; beep(150, 0, 0.09, HBC.seVol * 1.3, 'sawtooth', 90); }
  function hbTailOk(n) {
    if (n.state !== 'active') return; n.state = 'done'; hbAdd(HBC.tailUnit, 1); hbCombo(true); hbFinal(n, n.headJ || 'perfect'); n.pid = null;
    const L = hbL(); const l = n.path ? n.path[n.path.length - 1][0] : n.lane; hbBurst(hbLX(L, l), L.judge, '#ffffff', 6); beep(1568, 0, 0.05, HBC.seVol);
  }
  function hbTouchLane(L, fx) { return Math.round(clamp(fx, 0, 3)); }
  function hbPress(t) {                                                                    // 指が、レーンにふれた：いちばん近い時刻の、先頭のノーツを探す
    const now = hbNow(); const L = hbL(); const off = hbOffset(HB.song); let best = null; let bs = 9;
    HB.flash[hbTouchLane(L, t.fx)] = 0.18;
    let att = null; let ad = 9;                                                            // いま はなれている スライドを、もう一度なぞり直せるか
    for (const n of HB.notes) {
      if (n.type !== 'slide' || n.state !== 'active' || !n.lifted) continue; const d = Math.abs(t.fx - hbReqLane(n, now - off));
      if (d <= HBC.pathTol + 0.45 && d < ad) { ad = d; att = n; }
    }
    for (const n of HB.notes) {
      if (n.state !== 'wait') continue; const dt = now - (n.t + off); if (Math.abs(dt) > HBC.good) continue;
      const lane = n.type === 'slide' ? n.path[0][0] : n.lane; const dl = Math.abs(t.fx - lane); if (dl > HBC.touchLane) continue;
      const sc = Math.abs(dt) + dl * 0.05; if (sc < bs) { bs = sc; best = n; }
    }
    if (att && (!best || ad <= Math.abs(t.fx - (best.type === 'slide' ? best.path[0][0] : best.lane)))) { att.pid = t.id; att.lifted = false; att.tickMiss = 0; t.note = att; hbBurst(hbLX(L, hbReqLane(att, now - off)), L.judge, '#bfffe8', 3); beep(1175, 0, 0.03, HBC.seVol); return; }
    if (best) { const dt = now - (best.t + off); best.pid = t.id; t.note = best; hbHeadHit(best, dt, hbLX(L, best.type === 'slide' ? best.path[0][0] : best.lane)); }
  }
  function hbRelease(n, now) {                                                             // 指をはなした：終端に近ければ成功。スライドは、一瞬はなしても OK（もう一度ふれれば、つづき）。ホールドは、とちゅうなら とぎれる
    if (n.state !== 'active') return; const off = hbOffset(HB.song); const remain = (n.end + off) - now;
    if (remain <= HBC.tailEarly) hbTailOk(n);
    else if (n.type === 'slide') { n.pid = null; n.lifted = true; n.liftAt = now; }
    else hbBreak(n);
  }
  function hbFingerOnPath(n, now, fx) {
    const req = hbReqLane(n, now - hbOffset(HB.song)); return Math.abs(fx - req) <= HBC.pathTol;
  }
  function hbUpdatePlay(dt) {
    const now = hbNow(); const L = hbL(); const off = hbOffset(HB.song);
    for (const n of HB.notes) {
      const tt = n.t + off;
      if (HB.dev.auto) {
        if (n.state === 'wait' && now >= tt) { hbHeadHit(n, 0, hbLX(L, n.type === 'slide' ? n.path[0][0] : n.lane)); n.pid = 'auto'; }
      } else if (n.state === 'wait' && now > tt + HBC.good) hbMissHead(n);
      if (n.state === 'active') {
        let fx = null;
        if (n.pid === 'auto') fx = hbReqLane(n, now - off); else { const t = HB.touches.get(n.pid); if (t) fx = t.fx; }
        while (n.nextTick <= now - off && n.nextTick < n.end - 0.02 && n.state === 'active') {
          if (n.lifted) { if ((n.nextTick + off) - n.liftAt > HBC.liftGrace) { hbBreak(n); break; } n.nextTick += HBC.tickEvery; continue; }       // はなれている間：点はもらえないが、とぎれもしない（liftGrace まで）
          const ok = fx !== null && (n.path ? hbFingerOnPath(n, n.nextTick + off, fx) : Math.abs(fx - n.lane) <= HBC.holdTol);
          if (ok) { n.tickMiss = 0; if (n.tickN < HBC.maxTickUnits) hbAdd(HBC.tickUnit, 1); n.tickN++; if (n.path && HB.parts.length < 80) hbBurst(hbLX(L, hbReqLane(n, n.nextTick)), L.judge, '#bfffe8', 2); if (n.tickN % 3 === 0) beep(1175 + (n.path ? 200 : 0), 0, 0.025, HBC.seVol * 0.6); }
          else { n.tickMiss++; if (n.tickMiss > HBC.tickGrace) { hbBreak(n); break; } }
          n.nextTick += HBC.tickEvery;
        }
        if (n.state === 'active' && n.lifted && now - n.liftAt > HBC.liftGrace) hbBreak(n);
        if (n.state === 'active' && n.cp) for (const c of n.cp) if (!c.done && now - off >= c.t - 0.03) {                      // レーンを移った地点（チェックポイント）：到着の直前に、「そのときいるべき位置」の近くか、を見る
          c.done = true; if (n.lifted) continue; const ok = fx !== null && hbFingerOnPath(n, now, fx);
          if (ok) { hbAdd(HBC.checkUnit, 1); hbCombo(true); hbBurst(hbLX(L, hbReqLane(n, c.t)), L.judge, '#ffffff', 5); beep(1397, 0, 0.04, HBC.seVol); } else { hbBreak(n); break; }
        }
        if (n.state === 'active' && now - off >= n.end + 0.03) hbTailOk(n);
      }
    }
    for (let i = HB.flash.length - 1; i >= 0; i--) HB.flash[i] = Math.max(0, HB.flash[i] - dt);
    if (HB.jd) { HB.jd.t += dt; if (HB.jd.t > 0.5) HB.jd = null; }
    HB.miss = Math.max(0, HB.miss - dt); HB.shake = Math.max(0, HB.shake - dt);
    for (let i = HB.parts.length - 1; i >= 0; i--) { const p = HB.parts[i]; p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; if (p.life > p.max) HB.parts.splice(i, 1); }
    const last = HB.notes.length ? Math.max(...HB.notes.map((n) => n.end + off)) : 0;
    if (now >= Math.max(HB.song.duration - 0.2, last + 0.4) && HB.notes.every((n) => n.state === 'done' || n.state === 'missed')) { HB.phase = 'finish'; HB.t = 0; }
  }
  // ---- フェーズ ----
  function hbCharge() {
    if (P_().money < HBC.price) { toast('お金が足りないよ（¥' + HBC.price + '要るよ）'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return false; }
    chargeYen(HBC.price); const hb = P_().happyBeat; hb.playCount++; writeSave(); return true;
  }
  function hbBegin() {                                                                      // 「あそぶ」で ¥100 をはらって、準備へ
    if (!hbCharge()) return; hbUnlockAudio(); hbLoadBuf(hbSongs()[HB.songIdx]);
    hbPrepare(); HB.score = 0; HB.earned = 0; HB.combo = 0; HB.maxCombo = 0; HB.cnt = { perfect: 0, good: 0, miss: 0 }; HB.broke = 0; HB.parts = []; HB.jd = null; HB.touches.clear(); HB.offs = [];
    HB.phase = 'ready'; HB.t = 0; HB.newBest = false; HB.result = null; hbStopAudio(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05);
  }
  function hbRank(score) { const r = HBC.rank; return score >= r.S ? 'S' : score >= r.A ? 'A' : score >= r.B ? 'B' : score >= r.C ? 'C' : 'D'; }
  function hbFinishPlay() {
    const total = HB.cnt.perfect + HB.cnt.good + HB.cnt.miss; const fc = HB.cnt.miss === 0; const ap = fc && HB.cnt.good === 0;
    const rank = hbRank(HB.score); HB.result = { score: HB.score, rank, fc, ap, maxCombo: HB.maxCombo, cnt: { ...HB.cnt }, total };
    const rec = P_().happyBeat.rec[HB.song.songId] || (P_().happyBeat.rec[HB.song.songId] = {}); const r = rec[HB.diff] || (rec[HB.diff] = { bestScore: 0, bestRank: '-', maxCombo: 0, fullCombo: false, allPerfect: false, plays: 0 });
    if (!HB.dev.auto) {                                                                    // AUTOPLAY の結果は、保存しない
      r.plays++; if (HB.score > r.bestScore) { r.bestScore = HB.score; r.bestRank = rank; HB.newBest = true; } if (HB.maxCombo > r.maxCombo) r.maxCombo = HB.maxCombo; if (fc) r.fullCombo = true; if (ap) r.allPerfect = true; writeSave();
    }
    HB.phase = 'result'; HB.t = 0; hbStopAudio();
    [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.09, 0.12, 0.05, 'triangle')); if (fc) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.5 + i * 0.08, 0.14, 0.05));
  }
  function hbUpdate(dt) {
    HB.clock += dt; if (HB.speedUi) { hbUpdateDemo(dt); return; } if (HB.paused) return;
    if (HB.phase === 'ready') { HB.t += dt; if (HB.t > 1.5) { HB.phase = 'count'; HB.t = 0; } }
    else if (HB.phase === 'count') {
      const was = Math.floor(HB.t / 0.6); HB.t += dt; const k = Math.floor(HB.t / 0.6); if (k !== was && k < 3) beep(880 + (k === 2 ? 440 : 0), 0, 0.08, 0.05);
      if (HB.t >= 1.8) { HB.phase = 'play'; HB.t = 0; HB.t0 = hbNowPerf(); if (HB.vtime !== null) HB.vtime = HB.startAt - HB.preroll; hbPrepareStartAudio(); }
    } else if (HB.phase === 'play') {
      if (!HB.audioStarted && hbNow() >= HB.startAt) { HB.audioStarted = true; if (HB.vtime === null) hbStartAudio(); }
      if (HB.vtime !== null) HB.vtime += dt;
      HB.t += dt; hbUpdatePlay(dt);
    } else if (HB.phase === 'finish') { HB.t += dt; if (HB.t > 1.7) hbFinishPlay(); }
    else if (HB.phase === 'result') HB.t += dt;
  }
  function hbPrepareStartAudio() { HB.audioStarted = false; HB.audioOn = false; HB.lastA = 0; }
  // ---- 入力 ----
  function hbPointer(e, p) {
    if (HB.phase !== 'play' || HB.paused) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
    const L = hbL(); if (p.y < L.top - 12 || p.y > H - 6) return;
    const t = { id: e.pointerId, fx: hbFx(L, p.x), note: null }; HB.touches.set(e.pointerId, t); hbPress(t);
  }
  function hbPointerMove(e, p) { const t = HB.touches.get(e.pointerId); if (t) t.fx = hbFx(hbL(), p.x); }
  function hbPointerUp(e) { const t = HB.touches.get(e.pointerId); if (!t) return; HB.touches.delete(e.pointerId); if (t.note && t.note.pid === e.pointerId) hbRelease(t.note, hbNow()); }
  // ---- 画面（DOMのボタン） ----
  const HB_DOM = {};
  function hbBuildDom() {
    if (HB_DOM.start) return;
    const mk = (id, text, cls) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + (cls || ''); b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); HB_DOM[id.slice(3)] = b; return b; };
    HB_DIFFS.forEach(([k, label]) => { mk('hb-' + k, label, 'hb-diff hb-' + k).addEventListener('click', () => { ensureAudio(); HB.diff = k; beep(660, 0, 0.04, 0.04, 'square'); }); });
    mk('hb-start', '¥100 で遊ぶ', 'hb-go').addEventListener('click', () => { ensureAudio(); hbBegin(); });
    mk('hb-retry', 'もう一度（¥100）', 'hb-go').addEventListener('click', () => { ensureAudio(); hbBegin(); });
    mk('hb-menu', '選曲へ', 'hb-sub').addEventListener('click', () => { ensureAudio(); HB.phase = 'select'; beep(520, 0, 0.05, 0.04, 'square'); });
    mk('hb-quit', 'やめる', 'hb-quit').addEventListener('click', () => { ensureAudio(); hbAskQuit(); });
    mk('hb-set', '設定', 'hb-quit').addEventListener('click', () => { ensureAudio(); hbOpenSettings(); });
    mk('hb-spdopen', '', 'hb-sub').addEventListener('click', () => { ensureAudio(); hbOpenSettings(); });
    mk('hb-spdm', '遅く－', 'hb-arrow').addEventListener('click', () => { ensureAudio(); hbSetSpeed(-1); });
    mk('hb-spdp', '速く＋', 'hb-arrow').addEventListener('click', () => { ensureAudio(); hbSetSpeed(1); });
    mk('hb-spdok', '終わり', 'hb-go').addEventListener('click', () => { ensureAudio(); beep(520, 0, 0.05, 0.04, 'square'); hbCloseSettings(); });
    mk('hb-prev', '◀', 'hb-arrow').addEventListener('click', () => { HB.songIdx = (HB.songIdx + hbSongs().length - 1) % hbSongs().length; });
    mk('hb-next', '▶', 'hb-arrow').addEventListener('click', () => { HB.songIdx = (HB.songIdx + 1) % hbSongs().length; });
  }

  function openHbDev() {                                                                   // HAPPY BEAT の調整（判定の幅・オフセット・速さ・autoplay など）
    const song = hbSongs()[HB.songIdx]; const st = () => [{ text: 'autoplay ' + (HB.dev.auto ? 'ON（記録しない）' : 'OFF') + ' / 判定ずれ' + (HB.dev.timing ? 'ON' : 'OFF'), cls: 'dim' }, { text: 'PERFECT ±' + Math.round(HBC.perfect * 1000) + 'ms / GOOD ±' + Math.round(HBC.good * 1000) + 'ms / 速さ' + hbSpeedLevel() + '（' + HBC.approach.toFixed(2) + 's）', cls: 'dim' }, { text: 'musicOffset ' + Math.round((song.musicOffset || 0) * 1000) + 'ms / 全体offset ' + Math.round(HBC.globalOffset * 1000) + 'ms / 開始 ' + HB.startAt + 's', cls: 'dim' }];
    const again = (f) => () => { f(); setTimeout(openHbDev, 0); };
    showDialog({ title: 'HAPPY BEAT DEV', wide: true, lines: st(), buttons: [
      { label: 'AUTOPLAY ON/OFF', onClick: again(() => { HB.dev.auto = !HB.dev.auto; }) },
      { label: '判定ずれを表示 ON/OFF', onClick: again(() => { HB.dev.timing = !HB.dev.timing; }) },
      { label: 'PERFECT幅 ±5ms', onClick: again(() => { HBC.perfect = Math.min(HBC.good - 0.01, HBC.perfect + 0.005); }) }, { label: 'PERFECT幅 -5ms', onClick: again(() => { HBC.perfect = Math.max(0.02, HBC.perfect - 0.005); }) },
      { label: 'GOOD幅 +10ms', onClick: again(() => { HBC.good += 0.01; }) }, { label: 'GOOD幅 -10ms', onClick: again(() => { HBC.good = Math.max(HBC.perfect + 0.01, HBC.good - 0.01); }) },
      { label: 'ノーツ速度 +1', onClick: again(() => { hbSetSpeed(1); }) }, { label: 'ノーツ速度 -1', onClick: again(() => { hbSetSpeed(-1); }) },
      { label: 'musicOffset +10ms', onClick: again(() => { song.musicOffset = (song.musicOffset || 0) + 0.01; }) }, { label: 'musicOffset -10ms', onClick: again(() => { song.musicOffset = (song.musicOffset || 0) - 0.01; }) },
      { label: '全体offset +10ms', onClick: again(() => { HBC.globalOffset += 0.01; }) }, { label: '全体offset -10ms', onClick: again(() => { HBC.globalOffset -= 0.01; }) },
      { label: '曲の 10秒から（+10s）', onClick: again(() => { HB.startAt = (HB.startAt + 10) % Math.max(10, Math.floor(song.duration - 8)); }) }, { label: '曲の先頭から', onClick: again(() => { HB.startAt = 0; }) },
      { label: '譜面を再読み込み', onClick: () => { const sc = document.createElement('script'); sc.src = 'assets/happybeat/happybeat_data.js?v=' + Date.now(); sc.onload = () => { toast('譜面を読みこみました'); setTimeout(openHbDev, 0); }; document.head.appendChild(sc); } },
      { label: '閉じる', primary: true } ] });
  }
  function hbPause() {                                                                      // いったん止める（曲も、譜面の時計も）
    if (HB.phase !== 'play' || HB.paused) return false;
    HB.paused = true; HB.pauseAt = hbNowPerf(); HB.touches.clear();
    if (HB.useCtx && actx) { try { actx.suspend(); } catch (e) { /* ok */ } }              // Web Audio：全体を止めると、音の時計も止まる
    else { try { if (HB.audio) HB.audio.pause(); } catch (e) { /* ok */ } HB.pauseAudioOn = HB.audioOn; HB.audioOn = false; }
    return true;
  }
  function hbResume() {
    if (!HB.paused) return; HB.t0 += hbNowPerf() - HB.pauseAt; HB.paused = false;
    if (HB.useCtx && actx) { try { actx.resume(); } catch (e) { /* ok */ } }
    else if (HB.pauseAudioOn && HB.audio) { try { HB.audio.play(); } catch (e) { /* ok */ } }
  }
  function hbAskQuit() {                                                                    // とちゅうで やめる：確認（¥100は もどりません）
    if (!hbPause()) return;
    showDialog({ title: 'やめますか？', lines: [{ text: 'プレイをやめると、¥' + HBC.price + 'は戻らないよ。', cls: 'dim' }], buttons: [
      { label: '続ける', primary: true, onClick: () => hbResume() },
      { label: 'やめる', onClick: () => { HB.paused = false; hbStopAudio(); try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) { /* ok */ } HB.phase = 'select'; } } ] });
  }
  // ---- ノーツ速度（1〜10。プレイ中のせっていでも、選曲画面でも、変えられる。保存される） ----
  function hbApplySpeed() { const lv = clamp(P_().happyBeat.speed || HBC.speedDefault, 1, HBC.speeds.length); HBC.approach = HBC.speeds[lv - 1]; }
  function hbSpeedLevel() { return clamp(P_().happyBeat.speed || HBC.speedDefault, 1, HBC.speeds.length); }
  function hbSetSpeed(d) { P_().happyBeat.speed = clamp(hbSpeedLevel() + d, 1, HBC.speeds.length); hbApplySpeed(); beep(660 + d * 80, 0, 0.04, 0.04, 'square'); writeSave(); }
  // ---- ノーツ速度の調整画面：実際に降ってくるノーツ（TAP・HOLD・SLIDE）を、見ながら、速さを変えられる ----
  const HB_DEMO_LEN = 7.2;
  const HB_DEMO = [{ type: 'tap', t: 0.8, lane: 0 }, { type: 'tap', t: 1.3, lane: 1 }, { type: 'tap', t: 1.8, lane: 2 }, { type: 'tap', t: 2.3, lane: 3 }, { type: 'hold', t: 2.9, lane: 1, end: 3.8 },
    { type: 'slide', t: 4.3, lane: 1, end: 5.6, path: [[1, 4.3], [2, 4.85], [3, 5.2]] }, { type: 'tap', t: 6.1, lane: 0 }, { type: 'tap', t: 6.1, lane: 3 }, { type: 'tap', t: 6.6, lane: 2 }];
  function hbOpenSettings() {                                                               // 「せってい」（プレイ画面・選曲画面）：速さの調整画面を ひらく。プレイ中は、止めてから
    if (HB.speedUi) return; if (HB.phase === 'play') { if (!hbPause()) return; HB.speedFrom = 'play'; } else HB.speedFrom = 'select';
    HB.speedUi = true; HB.demoT = 0; HB.demoLast = 0; HB.parts = []; HB.jd = null; HB.song = HB.song || hbSongs()[HB.songIdx];
  }
  function hbCloseSettings() { if (!HB.speedUi) return; HB.speedUi = false; HB.parts = []; HB.jd = null; if (HB.speedFrom === 'play') hbResume(); }
  function hbUpdateDemo(dt) {
    const off = hbOffset(HB.song); const prev = HB.demoT; HB.demoT += dt; const L = hbL(); const k0 = Math.floor(HB.demoT / HB_DEMO_LEN);
    for (const n of HB_DEMO) for (let k = k0 - 1; k <= k0; k++) { const th = n.t + k * HB_DEMO_LEN + off; if (th > prev && th <= HB.demoT) { const lane = n.type === 'slide' ? n.path[0][0] : n.lane; HB.flash[lane] = 0.18; HB.jd = { kind: 'perfect', t: 0 }; hbBurst(hbLX(L, lane), L.judge, '#ffe070', 5); beep(1760, 0, 0.03, HBC.seVol * 0.8); } }
    for (let i = HB.flash.length - 1; i >= 0; i--) HB.flash[i] = Math.max(0, HB.flash[i] - dt);
    if (HB.jd) { HB.jd.t += dt; if (HB.jd.t > 0.5) HB.jd = null; }
    for (let i = HB.parts.length - 1; i >= 0; i--) { const q = HB.parts[i]; q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 60 * dt; if (q.life > q.max) HB.parts.splice(i, 1); }
  }
  function hbDrawSpeedDemo() {
    const L = hbL(); const now = HB.demoT; HB.song = HB.song || hbSongs()[HB.songIdx]; hbDrawBg(L, now);
    ctx.save(); ctx.beginPath(); ctx.rect(Math.round(L.x0) - 1, L.top - 14, Math.round(L.lw * 4) + 2, L.judge - L.top + 40); ctx.clip();
    const k0 = Math.floor(now / HB_DEMO_LEN);
    for (let k = k0 - 1; k <= k0 + 1; k++) for (const n of HB_DEMO) {
      const o = { type: n.type, lane: n.lane, t: n.t + k * HB_DEMO_LEN, end: (n.end || n.t) + k * HB_DEMO_LEN, state: 'wait', path: n.path ? n.path.map((q) => [q[0], q[1] + k * HB_DEMO_LEN]) : null };
      hbDrawNote(L, o, now);
    }
    ctx.restore();
    for (const q of HB.parts) { ctx.globalAlpha = Math.max(0, 1 - q.life / q.max); rect(Math.round(q.x), Math.round(q.y), 2, 2, q.color); } ctx.globalAlpha = 1;
    if (HB.jd) { ctx.globalAlpha = Math.max(0, 1 - HB.jd.t / 0.5); drawTextCenter('PERFECT!', W / 2, L.judge - 30 - Math.round(HB.jd.t * 14), '#ffe070', 2, '#1a0a30'); ctx.globalAlpha = 1; }
    ctx.globalAlpha = 0.82; rect(14, 28, W - 28, 44, '#0a0618'); ctx.globalAlpha = 1;
    drawTextCenter('NOTE SPEED', W / 2, 32, '#9a8ad8', 1); drawTextCenter(String(hbSpeedLevel()), W / 2, 42, '#ffffff', 3, '#ff7ac0');
    for (let i = 0; i < HBC.speeds.length; i++) rect(Math.round(W / 2 - 25 + i * 5), 64, 4, 4, i < hbSpeedLevel() ? '#ff7ac0' : '#3a2a60');
  }
  function hbUi() {
    hbBuildDom(); const L = hbL(); const dx = W - 180; const ph = HB.phase; const su = HB.speedUi; const sel = ph === 'select' && !su; const multi = hbSongs().length > 1;
    const show = (k, on) => HB_DOM[k].classList.toggle('is-show', !!on);
    HB_DIFFS.forEach(([k]) => { show(k, sel); HB_DOM[k].classList.toggle('is-on', sel && HB.diff === k); });
    show('start', sel); show('spdopen', sel); show('retry', ph === 'result' && !su); show('menu', ph === 'result' && !su); show('quit', ph === 'play' && !HB.paused && !su); show('set', ph === 'play' && !HB.paused && !su);
    show('spdm', su); show('spdp', su); show('spdok', su); show('prev', sel && multi); show('next', sel && multi);
    HB_DOM.spdopen.textContent = 'ノーツ速度 ' + hbSpeedLevel() + '　（試す・変える）';
    const bw = Math.floor((W - 24 - 8) / 3);
    HB_DIFFS.forEach(([k], i) => crPlace(HB_DOM[k], { x: 12 + i * (bw + 4), y: 232, w: bw, h: 28 }));
    crPlace(HB_DOM.start, { x: 24, y: 304, w: W - 48, h: 38 }); crPlace(HB_DOM.spdopen, { x: 30, y: 266, w: W - 60, h: 24 });
    const sw = Math.floor((W - 28 - 8) / 3); crPlace(HB_DOM.spdm, { x: 14, y: 350, w: sw, h: 26 }); crPlace(HB_DOM.spdp, { x: 14 + sw + 4, y: 350, w: sw, h: 26 }); crPlace(HB_DOM.spdok, { x: 14 + (sw + 4) * 2, y: 350, w: sw, h: 26 });
    crPlace(HB_DOM.retry, { x: 20, y: 300, w: W - 40, h: 34 }); crPlace(HB_DOM.menu, { x: 20, y: 340, w: W - 40, h: 26 });
    crPlace(HB_DOM.quit, { x: W - 52, y: 8, w: 40, h: 20 }); crPlace(HB_DOM.set, { x: W - 100, y: 8, w: 46, h: 20 }); crPlace(HB_DOM.prev, { x: 12, y: 96, w: 26, h: 40 }); crPlace(HB_DOM.next, { x: W - 38, y: 96, w: 26, h: 40 });
  }
  function hbHide() { if (!HB_DOM.start) return; Object.keys(HB_DOM).forEach((k) => HB_DOM[k].classList.remove('is-show')); }
  // ---- 描画 ----
  const pad7 = (n) => String(Math.max(0, Math.floor(n))).padStart(7, '0');
  function hbPanda(color, x, y, h, now, jump) {
    const B = 60 / HB.song.bpm; const beat = Math.max(0, (now - (HB.song.firstBeat || 0)) / B); const seq = [1, 2, 3, 2]; const idx = seq[Math.floor(beat) % 4];
    const im = HB_IMG[color + idx]; if (!im || !im.complete || !im.naturalWidth) return;
    const w = Math.round(h * im.naturalWidth / im.naturalHeight); const bob = -Math.round(Math.abs(Math.sin(Math.PI * (beat % 1))) * 3) - (jump ? Math.round(Math.abs(Math.sin(HB.clock * 7)) * 16) : 0) + (HB.miss > 0.25 ? 2 : 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, Math.round(x), Math.round(y + bob), w, h); ctx.restore();
    if (HB.miss > 0.2 && !jump) drawTextCenter('!', x + w / 2, y - 8, '#ffe070', 2, '#3a2a60');
    if (HB.combo >= 20 && !jump && Math.floor(HB.clock * 5) % 3 === 0) { const sx = x + w * 0.5 + Math.sin(HB.clock * 4 + x) * w * 0.55; const sy = y - 4 - ((HB.clock * 20) % 14); ctx.globalAlpha = 0.8; if (color === 'pink') { rect(sx, sy, 2, 1, '#ff7ac0'); rect(sx + 3, sy, 2, 1, '#ff7ac0'); rect(sx - 1, sy + 1, 7, 2, '#ff7ac0'); rect(sx, sy + 3, 5, 1, '#ff7ac0'); rect(sx + 1, sy + 4, 3, 1, '#ff7ac0'); } else { rect(sx + 2, sy - 1, 1, 5, '#7ad8ff'); rect(sx, sy + 1, 5, 1, '#7ad8ff'); } ctx.globalAlpha = 1; }
  }
  function hbDrawBg(L, now) {
    mgFrame('#07040f', '#7a3a8a', '#58c8ff');
    for (let y = 8; y < H - 8; y++) rect(8, y, W - 16, 1, mixHex('#120a26', '#0a0618', (y - 8) / (H - 16)));
    for (let i = 0; i < 4; i++) { rect(Math.round(L.x0 + i * L.lw), L.top, Math.round(L.lw), L.judge - L.top, i % 2 ? '#150e30' : '#110a28'); }
    const beat = (now - (HB.song.firstBeat || 0)) / (60 / HB.song.bpm); const pulse = 0.5 + 0.5 * Math.cos(2 * Math.PI * (beat % 1));
    ctx.globalAlpha = 0.05 + 0.05 * pulse; rect(Math.round(L.x0), L.top, Math.round(L.lw * 4), L.judge - L.top, '#8a5aff'); ctx.globalAlpha = 1;
    for (let i = 0; i <= 4; i++) rect(Math.round(L.x0 + i * L.lw), L.top, 1, L.judge - L.top + 30, '#3a2a6a');
    for (let i = 0; i < 4; i++) {                                                                       // 判定ライン・下のパッド
      if (HB.flash[i] > 0) { ctx.globalAlpha = HB.flash[i] * 2.2; rect(Math.round(L.x0 + i * L.lw) + 1, L.top + 40, Math.round(L.lw) - 1, L.judge - L.top - 40, i % 2 ? '#62d6ff' : '#ff7ac0'); ctx.globalAlpha = 1; }
      rect(Math.round(L.x0 + i * L.lw) + 2, L.judge + 4, Math.round(L.lw) - 3, 26, HB.flash[i] > 0 ? (i % 2 ? '#62d6ff' : '#ff7ac0') : '#2a1a54'); rect(Math.round(L.x0 + i * L.lw) + 2, L.judge + 4, Math.round(L.lw) - 3, 2, i % 2 ? '#8ae4ff' : '#ff9ad4');
      drawTextCenter(String(i + 1), L.x0 + L.lw * (i + 0.5) + 0.5, L.judge + 14, '#ffffff', 2);
    }
    for (let x = 0; x < L.lw * 4; x++) { rect(Math.round(L.x0 + x), L.judge - 1, 1, 3, mixHex('#ff7ac0', '#62d6ff', x / (L.lw * 4))); }
  }
  function hbDrawNote(L, n, now) {
    const off = hbOffset(HB.song); const A = HBC.approach; const yOf = (t) => L.judge - ((t + off) - now) / A * (L.judge - L.top);
    const yh = yOf(n.t); if (n.state === 'missed' && n.type === 'tap') return; if (n.type === 'tap' && n.state === 'done') return;
    const lw = L.lw; const col = (l) => (l % 2 ? '#62d6ff' : '#ff7ac0');
    if (n.type === 'tap') { if (yh < L.top - 12 || yh > L.judge + 22) return; const x = Math.round(hbLX(L, n.lane) - lw / 2 + 3); const w = Math.round(lw - 6); rect(x, Math.round(yh) - 4, w, 9, '#ffffff'); rect(x + 1, Math.round(yh) - 3, w - 2, 7, col(n.lane)); rect(x + 2, Math.round(yh) - 3, w - 4, 2, '#ffffff'); return; }
    const yt = yOf(n.end); const dead = n.state === 'missed'; const act = n.state === 'active'; const top = Math.max(L.top - 10, yt); const bot = Math.min(L.judge + 2, yh);
    if (n.state === 'done' || (yt > L.judge + 6)) return; if (yh < L.top - 14 && yt < L.top - 14) return;
    const alpha = dead ? 0.25 : 1; ctx.globalAlpha = alpha;
    if (n.type === 'hold') {
      const cx = hbLX(L, n.lane); const w = Math.round(lw - 14); const x = Math.round(cx - w / 2);
      const c1 = act ? mixHex('#ffe070', '#ffffff', 0.5 + 0.5 * Math.sin(HB.clock * 8)) : '#ffc23a'; rect(x, Math.round(top), w, Math.max(1, Math.round(bot - top)), '#8a5a10'); rect(x + 2, Math.round(top), w - 4, Math.max(1, Math.round(bot - top)), c1); rect(x + 4, Math.round(top), 2, Math.max(1, Math.round(bot - top)), '#fff3b0');
      if (!dead && !act) { rect(x - 1, Math.round(yh) - 4, w + 2, 9, '#ffffff'); rect(x, Math.round(yh) - 3, w, 7, '#ffd24a'); }
      if (act) { ctx.globalAlpha = 0.5; rect(Math.round(cx - lw / 2), L.judge - 6, Math.round(lw), 8, '#ffe070'); ctx.globalAlpha = 1; }
    } else {                                                                                             // SLIDE HOLD：レーンの間を、なめらかにつなぐ、太い帯
      const bw = Math.round(lw * 0.62);
      for (let y = Math.floor(top); y <= Math.ceil(bot); y++) {
        const tt = now + (L.judge - y) / (L.judge - L.top) * A - off; if (tt < n.t - 0.02 || tt > n.end + 0.02) continue; const cx = hbLX(L, hbReqLane(n, tt));
        const c = act ? mixHex('#7dffcf', '#ffffff', 0.4 + 0.4 * Math.sin(HB.clock * 8 + y * 0.05)) : '#5af0b8'; rect(Math.round(cx - bw / 2), y, bw, 1, '#1a6a58'); rect(Math.round(cx - bw / 2) + 2, y, bw - 4, 1, c);
      }
      if (!dead && !act) { const x = Math.round(hbLX(L, n.path[0][0]) - lw / 2 + 3); rect(x, Math.round(yh) - 4, Math.round(lw - 6), 9, '#ffffff'); rect(x + 1, Math.round(yh) - 3, Math.round(lw - 8), 7, '#5af0b8'); rect(x + 2, Math.round(yh) - 3, Math.round(lw - 10), 2, '#ffffff'); }
      if (act) { const l = hbReqLane(n, now - off); ctx.globalAlpha = 0.55; rect(Math.round(hbLX(L, l) - lw / 2), L.judge - 6, Math.round(lw), 8, '#7dffcf'); ctx.globalAlpha = 1; }
    }
    ctx.globalAlpha = 1;
  }
  function hbDrawPlay() {
    const L = hbL(); const now = hbNow(); const dx = W - 180;
    hbDrawBg(L, now);
    ctx.save(); ctx.beginPath(); ctx.rect(Math.round(L.x0) - 1, L.top - 14, Math.round(L.lw * 4) + 2, L.judge - L.top + 40); ctx.clip();
    for (const n of HB.notes) hbDrawNote(L, n, now);
    ctx.restore();
    for (const p of HB.parts) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); rect(Math.round(p.x), Math.round(p.y), 2, 2, p.color); } ctx.globalAlpha = 1;
    drawTextCenter(pad7(HB.score), W / 2, 36, '#ffffff', 2, '#4a2a8a'); drawText('SCORE', Math.round(W / 2 - 14), 29, '#9a8ad8', 1);
    hbPanda('pink', 14, 28, 44, now, false); hbPanda('blue', W - 14 - 34, 28, 44, now, false);
    if (HB.combo >= 2) { ctx.globalAlpha = 0.85; drawTextCenter(String(HB.combo), W / 2, 108, '#ffe9a0', 4, '#6a3a8a'); drawTextCenter('COMBO', W / 2, 98, '#ff9ad4', 1); ctx.globalAlpha = 1; }
    if (HB.jd) { const j = HB.jd; const col = j.kind === 'perfect' ? '#ffe070' : j.kind === 'good' ? '#7ad8ff' : '#ff6a8a'; const tx = j.kind === 'perfect' ? 'PERFECT!' : j.kind === 'good' ? 'GOOD' : 'MISS'; ctx.globalAlpha = Math.max(0, 1 - j.t / 0.5); drawTextCenter(tx, W / 2, L.judge - 30 - Math.round(j.t * 14), col, 2, '#1a0a30'); ctx.globalAlpha = 1; }
    if (HB.dev.timing) { HB.offs.forEach((o, i) => { drawText((o >= 0 ? '+' : '') + o, 14 + i * 12, 68, Math.abs(o) <= HBC.perfect * 1000 ? '#7dff8a' : '#ffe070', 1); }); drawText('T ' + now.toFixed(2) + (HB.audioOn && HB.audio ? '  dA ' + Math.round((now - HB.audio.currentTime) * 1000) + 'ms' : ''), 14, 76, '#9a8ad8', 1); if (HB.dev.auto) drawText('AUTO', W - 40, 76, '#ff6a8a', 1); }
    if (now < 0.0 && HB.audio === null) { /* 準備中 */ }
  }
  function hbDrawSelect() {
    const s = hbSongs()[HB.songIdx]; const dx = W - 180; const L = hbL();
    mgFrame('#07040f', '#7a3a8a', '#58c8ff'); mgSign('HAPPY BEAT', '#ff7ac0', '#6a1a5a');
    for (let y = 40; y < H - 40; y++) rect(12, y, W - 24, 1, mixHex('#1a0e38', '#0a0618', (y - 40) / (H - 80)));
    const j = s ? hbJacket(s) : null; const sz = 128; const jx = Math.round(W / 2 - sz / 2); const jy = 40;
    ctx.globalAlpha = 0.5; rect(jx - 4, jy - 4, sz + 8, sz + 8, '#ff7ac0'); rect(jx - 2, jy - 2, sz + 4, sz + 4, '#62d6ff'); ctx.globalAlpha = 1; rect(jx - 1, jy - 1, sz + 2, sz + 2, '#ffffff');
    if (j) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(j, jx, jy, sz, sz); ctx.restore(); }
    drawTextCenter('HAPPY BEAT', W / 2, 178, '#ffffff', 2, '#6a1a5a'); drawTextCenter(s ? 'BPM ' + Math.round(s.bpm) : '', W / 2, 196, '#9a8ad8', 1);
    hbPanda('pink', 14, 98, 56, HB.clock, false); hbPanda('blue', W - 14 - 43, 98, 56, HB.clock, false);
    const r = s && P_().happyBeat.rec[s.songId] && P_().happyBeat.rec[s.songId][HB.diff];
    drawTextCenter('BEST ' + (r && r.bestScore ? pad7(r.bestScore) + '  ' + r.bestRank : '-------  -'), W / 2, 212, '#ffe9a0', 1);
    if (r && (r.fullCombo || r.allPerfect)) drawTextCenter(r.allPerfect ? 'ALL PERFECT' : 'FULL COMBO', W / 2, 222, '#7dff8a', 1);
    drawTextCenter('YEN ' + P_().money + '   1 PLAY  YEN ' + HBC.price, W / 2, 294, '#ffe070', 1);
  }
  function hbDrawReadyCount() {
    const s = HB.song; const j = hbJacket(s); mgFrame('#07040f', '#7a3a8a', '#58c8ff');
    for (let y = 8; y < H - 8; y++) rect(8, y, W - 16, 1, mixHex('#1a0e38', '#0a0618', (y - 8) / (H - 16)));
    const sz = 120; const jx = Math.round(W / 2 - sz / 2); if (j) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(j, jx, 50, sz, sz); ctx.restore(); }
    drawTextCenter('HAPPY BEAT', W / 2, 180, '#ffffff', 2, '#6a1a5a'); const dl = HB_DIFFS.find((d) => d[0] === HB.diff); drawTextCenter(dl[1], W / 2, 198, dl[2], 2, '#1a0a30');
    hbPanda('pink', 14, 96, 56, HB.clock, false); hbPanda('blue', W - 14 - 43, 96, 56, HB.clock, false);
    if (HB.phase === 'ready') drawTextCenter('READY?', W / 2, 250, '#ffe070', 4, '#6a3a8a');
    else { const k = Math.min(2, Math.floor(HB.t / 0.6)); drawTextCenter(String(3 - k), W / 2, 240, '#ffffff', 8, '#ff7ac0'); }
  }
  function hbDrawResult() {
    const R = HB.result; const s = HB.song; const t = HB.t; mgFrame('#07040f', '#7a3a8a', '#58c8ff');
    for (let y = 8; y < H - 8; y++) rect(8, y, W - 16, 1, mixHex('#1a0e38', '#0a0618', (y - 8) / (H - 16)));
    drawTextCenter('RESULT', W / 2, 14, '#ffffff', 2, '#6a1a5a'); const dl = HB_DIFFS.find((d) => d[0] === HB.diff); drawTextCenter('HAPPY BEAT  ' + dl[1], W / 2, 32, dl[2], 1);
    const j = hbJacket(s); if (j) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(j, 16, 48, 64, 64); ctx.restore(); }
    const rc = { S: '#ffe070', A: '#ff9ad4', B: '#7ad8ff', C: '#9fe8b0', D: '#b8b8d0' }[R.rank]; drawTextCenter(R.rank, W - 56, 50, rc, 8, '#2a1a50'); drawText('RANK', W - 71, 42, '#9a8ad8', 1);
    drawTextCenter(pad7(R.score), W / 2, 124, '#ffffff', 3, '#4a2a8a'); drawText('SCORE', Math.round(W / 2 - 10), 116, '#9a8ad8', 1);
    const rows = [['PERFECT', R.cnt.perfect, '#ffe070'], ['GOOD', R.cnt.good, '#7ad8ff'], ['MISS', R.cnt.miss, '#ff6a8a'], ['MAX COMBO', R.maxCombo, '#ffe9a0']];
    rows.forEach(([lb, v, c], i) => { const y = 154 + i * 15; drawText(lb, 30, y, '#c8b8f0', 1); const vs = String(v); drawText(vs, W - 30 - textWidth(vs, 1), y, c, 1); });
    if (R.ap) drawTextCenter('ALL PERFECT!!', W / 2, 224, '#7dff8a', 2, '#0a3a1a'); else if (R.fc) drawTextCenter('FULL COMBO!', W / 2, 224, '#7dff8a', 2, '#0a3a1a');
    if (HB.newBest && !HB.dev.auto) drawTextCenter('NEW BEST!', W / 2, 246, '#ffe070', 1, '#3a2a10'); if (HB.dev.auto) drawTextCenter('AUTOPLAY  NO RECORD', W / 2, 246, '#ff6a8a', 1);
    hbPanda('pink', 18, 252, 40, HB.clock, R.fc); hbPanda('blue', W - 18 - 31, 252, 40, HB.clock, R.fc);
    if (R.fc) { if (Math.floor(t * 12) !== Math.floor((t - 1 / 60) * 12) && HB.parts.length < 60) { hbBurst(W / 2 + (Math.random() - 0.5) * 120, 240, ['#ff7ac0', '#7ad8ff', '#ffe070'][Math.floor(Math.random() * 3)], 4); } for (const p of HB.parts) { p.life += 1 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.vy += 1; ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); rect(Math.round(p.x), Math.round(p.y), 2, 2, p.color); } ctx.globalAlpha = 1; HB.parts = HB.parts.filter((p) => p.life < p.max); }
  }
  function hbDraw() {
    if (!hbSongs().length) { mgFrame('#07040f', '#7a3a8a', '#58c8ff'); drawTextCenter('NO SONG', W / 2, 160, '#ff6a8a', 2); return; }
    HB.song = HB.song || hbSongs()[HB.songIdx];
    if (HB.speedUi) { hbDrawSpeedDemo(); hbUi(); return; }
    const ph = HB.phase;
    if (ph === 'select') { HB.song = hbSongs()[HB.songIdx]; hbDrawSelect(); } else if (ph === 'ready' || ph === 'count') hbDrawReadyCount(); else if (ph === 'play' || ph === 'finish') { hbDrawPlay(); if (ph === 'finish') { ctx.globalAlpha = Math.min(0.6, HB.t * 1.5); rect(8, 8, W - 16, H - 16, '#05030a'); ctx.globalAlpha = 1; drawTextCenter('FINISH!', W / 2, 150, '#ffe070', 4, '#6a3a8a'); } } else hbDrawResult();
    hbUi();
  }
  mgRegister('happyBeat', {
    reset() { HB.phase = 'select'; HB.paused = false; hbStopAudio(); }, phase: () => HB.phase,
    enter() { hbBuildDom(); HB.phase = 'select'; HB.paused = false; HB.song = hbSongs()[HB.songIdx] || null; hbApplySpeed(); hbLoadBuf(HB.song); setMessage('難しさを選んで、遊ぼう！', C.cyan); },
    update: hbUpdate, draw: hbDraw, hint: 'レーンをタップ！長い帯は押したままなぞろう',
    pointer: hbPointer, pointerUp: hbPointerUp
  });
  GAME_TYPES.happyBeat.pointerMove = hbPointerMove;
  GAME_TYPES.happyBeat.canLeave = () => HB.phase === 'select' || HB.phase === 'result';
  GAME_TYPES.happyBeat.msgBox = () => ({ x: 14, y: 348, w: 152 + (W - 180), h: 20 });

