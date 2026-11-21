// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, punches, pickups and a little bassline loop.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let musicTimer = 0;
  let musicStep = 0;
  const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  function noise(dur, vol, low) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low || 1800;
    const gain = c.createGain();
    gain.gain.value = vol || 0.25;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.3, 3000); tone(180, 0.1, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.2, 900); },
    hit() { tone(120, 0.15, 'sawtooth', 0.18, 70); },
    pickup() { tone(660, 0.09, 'sine', 0.14); setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70); },
    coin() { tone(880, 0.08, 'sine', 0.12); setTimeout(() => tone(1320, 0.14, 'sine', 0.12), 60); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 110)); },
    fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.12), i * 140)); },
    horn() { tone(370, 0.18, 'square', 0.08); },
    engine(speed01) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 110;
      engineGain.gain.value = 0.02 + speed01 * 0.035;
    },
    engineOff() { if (engineGain) engineGain.gain.value = 0; },
    update(dt, wanted, driving) {
      if (!ctx || muted) return;
      sirenTimer -= dt;
      if (wanted > 0 && sirenTimer <= 0) {
        sirenTimer = 0.9;
        tone(700, 0.42, 'sine', 0.05, 950);
        setTimeout(() => tone(950, 0.42, 'sine', 0.05, 700), 450);
      }
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = 0.32;
        const f = BASS[musicStep % BASS.length];
        musicStep += 1;
        tone(f, 0.28, 'triangle', driving ? 0.05 : 0.035);
      }
    },
  };
}
