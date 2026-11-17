// WebAudio synth: engine hum, siren, blips, jingles, shots. No audio files, no network.
export class AudioSys {
  constructor() {
    this.ctx = null; this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenTimer = 0; this.sirenHigh = false;
    this.enabled = true;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      // engine: sawtooth through a lowpass, pitch follows speed
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      // siren: square wave, two-tone
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      return true;
    } catch (e) { return false; }
  }
  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(driving ? 0.045 + speedRatio * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 165, t, 0.08);
  }
  update(dt, wanted) {
    if (!this.ctx) return;
    this.sirenTimer -= dt;
    if (wanted > 0) {
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.45;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 660, this.ctx.currentTime, 0.05);
      }
      this.sirenGain.gain.setTargetAtTime(0.022, this.ctx.currentTime, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }
  tone(freq, dur, type = 'sine', vol = 0.08, when = 0) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  blip() { this.tone(660, 0.09, 'sine', 0.07); }
  punch() { this.tone(140, 0.08, 'square', 0.08); this.tone(90, 0.1, 'triangle', 0.07); }
  shot() { this.tone(1100, 0.06, 'square', 0.09); this.tone(220, 0.12, 'sawtooth', 0.08); }
  pickup() { this.tone(520, 0.08, 'sine', 0.08); this.tone(780, 0.12, 'sine', 0.08, 0.08); }
  hurt() { this.tone(180, 0.18, 'sawtooth', 0.08); }
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, i * 0.11));
  }
  fail() { this.tone(330, 0.2, 'sawtooth', 0.07); this.tone(220, 0.3, 'sawtooth', 0.07, 0.18); }
}
