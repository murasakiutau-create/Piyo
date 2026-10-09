'use strict';
  // =====================================================================
  //  音（WebAudio で 作る SE。BGM はなし）
  //    ensureAudio …… 最初のタップで 音を 有効化 ／ beep・noise …… 全ゲーム共通の 音の出口 ／ muted …… 音ON/OFF
  // =====================================================================

  // ================= 効果音（ピコピコ音を WebAudio で生成） =================
  let actx = null;
  let muted = false;
  let noiseBuf = null;
  let lastWinSfx = -1;
  let lastLandSfx = -1;

  function ensureAudio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.2, actx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (actx.state === 'suspended') actx.resume();
  }

  function beep(freq, delay, dur, vol, type, freqEnd) {
    if (!actx || muted) return;
    const t0 = actx.currentTime + delay;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g);
    g.connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol) {
    if (!actx || muted || !noiseBuf) return;
    const t0 = actx.currentTime;
    const src = actx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = actx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3000;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(actx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

