// ═══════════════════════════════════════════════════════════
//  SyncU — Sound Engine (Web Audio API, zero dependencies)
//  js/sounds.js
// ═══════════════════════════════════════════════════════════

const SyncUSound = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function makeGain(ac, val) {
    const g = ac.createGain();
    g.gain.setValueAtTime(val, ac.currentTime);
    return g;
  }

  // ── LIBRE: lightning bolt / power-up ─────────────────────
  function playLibre() {
    const ac = getCtx();
    const now = ac.currentTime;

    // Rising sawtooth chords (staggered)
    [0, 0.06, 0.12].forEach((offset, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      const freqs = [260, 390, 520];
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqs[i] * 0.5, now + offset);
      osc.frequency.exponentialRampToValueAtTime(freqs[i] * 2.2, now + offset + 0.12);
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    });

    // Metallic crack noise burst
    const bufLen = ac.sampleRate * 0.08;
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 4000; bp.Q.value = 0.8;
    const noiseGain = makeGain(ac, 0);
    noise.connect(bp); bp.connect(noiseGain); noiseGain.connect(ac.destination);
    noiseGain.gain.setValueAtTime(0, now + 0.08);
    noiseGain.gain.linearRampToValueAtTime(0.35, now + 0.10);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noise.start(now + 0.08); noise.stop(now + 0.25);

    // Bright chime on top
    const chime = ac.createOscillator();
    const chimeGain = makeGain(ac, 0);
    chime.connect(chimeGain); chimeGain.connect(ac.destination);
    chime.type = 'sine';
    chime.frequency.setValueAtTime(1200, now + 0.14);
    chime.frequency.exponentialRampToValueAtTime(1800, now + 0.28);
    chimeGain.gain.setValueAtTime(0, now + 0.14);
    chimeGain.gain.linearRampToValueAtTime(0.22, now + 0.16);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
    chime.start(now + 0.14); chime.stop(now + 0.42);
  }

  // ── OCUPADO: engine / motor powering down ────────────────
  function playOcupado() {
    const ac = getCtx();
    const now = ac.currentTime;

    // Falling engine drone
    const drone = ac.createOscillator();
    const droneGain = makeGain(ac, 0);
    drone.connect(droneGain); droneGain.connect(ac.destination);
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(220, now);
    drone.frequency.exponentialRampToValueAtTime(28, now + 0.75);
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    droneGain.gain.setValueAtTime(0.25, now + 0.15);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    drone.start(now); drone.stop(now + 0.78);

    // Low-pass rumble noise
    const bufLen2 = ac.sampleRate * 0.6;
    const buf2 = ac.createBuffer(1, bufLen2, ac.sampleRate);
    const d2 = buf2.getChannelData(0);
    for (let i = 0; i < bufLen2; i++) d2[i] = (Math.random() * 2 - 1);
    const rumble = ac.createBufferSource();
    rumble.buffer = buf2;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, now);
    lp.frequency.exponentialRampToValueAtTime(60, now + 0.6);
    const rumbleGain = makeGain(ac, 0);
    rumble.connect(lp); lp.connect(rumbleGain); rumbleGain.connect(ac.destination);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.14, now + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    rumble.start(now); rumble.stop(now + 0.7);

    // Two descending beeps (machine-off signal)
    [0.05, 0.22].forEach((offset, i) => {
      const beep = ac.createOscillator();
      const beepGain = makeGain(ac, 0);
      beep.connect(beepGain); beepGain.connect(ac.destination);
      beep.type = 'square';
      beep.frequency.value = i === 0 ? 480 : 320;
      beepGain.gain.setValueAtTime(0, now + offset);
      beepGain.gain.linearRampToValueAtTime(0.12, now + offset + 0.01);
      beepGain.gain.setValueAtTime(0.12, now + offset + 0.07);
      beepGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      beep.start(now + offset); beep.stop(now + offset + 0.16);
    });
  }

  return { playLibre, playOcupado };
})();

window.SyncUSound = SyncUSound;
