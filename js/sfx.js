/* JuggernauT: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const JUG = (window.JUG = window.JUG || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  const notes = (list, o = {}) => list.forEach(([f, at, dur]) => tone(Object.assign({ type: 'square', f, at, dur: dur || 0.1, vol: 0.06, lp: 3200 }, o)));

  JUG.sfx = {
    // the mission-start jingle: a marching-band toot of our own (G major)
    jingle() {
      notes([[392, 0], [392, 0.12], [494, 0.24], [587, 0.36, 0.18], [494, 0.58], [587, 0.7], [784, 0.84, 0.36]]);
      [[98, 0], [147, 0.36], [196, 0.84]].forEach(([f, at]) => tone({ type: 'triangle', f, at, dur: 0.3, vol: 0.22 }));
      hiss({ filter: 'highpass', f: 6000, dur: 0.06, vol: 0.12, at: 0.84 });
    },
    shot(gun) {
      if (gun === 'ball') tone({ type: 'triangle', f: 220, to: 380, dur: 0.07, vol: 0.07 });
      else if (gun === 'star') tone({ type: 'triangle', f: 1300, to: 1800, dur: 0.06, vol: 0.04 });
      else if (gun === 'water' || gun === 'vulcan' || gun === 'saddle') hiss({ filter: 'bandpass', f: 2400, q: 2, dur: 0.06, vol: 0.06 });
      else if (gun === 'bubble') tone({ type: 'sine', f: 600, to: 1200, dur: 0.08, vol: 0.06 });
      else if (gun === 'foam') { hiss({ filter: 'lowpass', f: 1600, to: 400, dur: 0.25, vol: 0.14 }); tone({ type: 'sine', f: 180, to: 90, dur: 0.2, vol: 0.12 }); }
      else if (gun === 'snow') hiss({ filter: 'lowpass', f: 900, dur: 0.12, vol: 0.12 });
      else if (gun === 'fist') tone({ type: 'square', f: 160, to: 90, dur: 0.1, vol: 0.08, lp: 1200 });
      else tone({ type: 'square', f: 900, to: 1300, dur: 0.04, vol: 0.03, lp: 3000 });
    },
    // the zombie's giant goo blast
    bleh() {
      tone({ type: 'sawtooth', f: 160, to: 70, dur: 0.6, vol: 0.12, lp: 900 });
      hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.6, vol: 0.2 });
      tone({ type: 'sine', f: 90, to: 60, dur: 0.5, vol: 0.2, at: 0.05 });
    },
    // a baddie goes BONK into treats, coins and stars
    pop(big) {
      tone({ type: 'square', f: big ? 220 : 440, to: big ? 90 : 160, dur: 0.12, vol: 0.07, lp: 2200 });
      hiss({ filter: 'lowpass', f: 2600, to: 400, dur: big ? 0.4 : 0.2, vol: big ? 0.22 : 0.12 });
      [1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.06 + i * 0.04, dur: 0.09, vol: 0.05 }));
    },
    tink() { tone({ type: 'triangle', f: 2200, to: 1800, dur: 0.05, vol: 0.05 }); },
    hit() { tone({ type: 'triangle', f: 330, to: 200, dur: 0.05, vol: 0.06 }); },
    foeShot(kind) {
      if (kind === 'goo' || kind === 'dust') tone({ type: 'sine', f: 300, to: 140, dur: 0.14, vol: 0.06 });
      else if (kind === 'ice') tone({ type: 'sine', f: 1600, to: 900, dur: 0.1, vol: 0.05 });
      else if (kind === 'cork') { tone({ type: 'square', f: 700, to: 300, dur: 0.05, vol: 0.05, lp: 2000 }); hiss({ filter: 'highpass', f: 3000, dur: 0.03, vol: 0.06 }); }
      else if (kind === 'ray') tone({ type: 'sine', f: 400, to: 1200, dur: 0.2, vol: 0.05 });
      else tone({ type: 'square', f: 900, to: 400, dur: 0.08, vol: 0.025, lp: 2400 });
    },
    fizz() { hiss({ filter: 'bandpass', f: 3000, q: 1.5, dur: 0.08, vol: 0.05 }); },
    boom() {
      tone({ f: 120, to: 40, dur: 0.5, vol: 0.4 });
      hiss({ filter: 'lowpass', f: 2500, to: 150, dur: 0.6, vol: 0.35 });
    },
    splash() { hiss({ filter: 'bandpass', f: 1800, to: 600, q: 0.8, dur: 0.45, vol: 0.3 }); tone({ type: 'sine', f: 500, to: 180, dur: 0.2, vol: 0.1 }); },
    // you get bonked: a cartoon boing and a slide down
    bonk() {
      tone({ f: 260, to: 90, dur: 0.14, vol: 0.32 });
      tone({ type: 'square', f: 660, to: 220, at: 0.06, dur: 0.4, vol: 0.06, lp: 1800 });
      hiss({ filter: 'lowpass', f: 2000, to: 300, dur: 0.35, vol: 0.18 });
    },
    boing() { tone({ type: 'sine', f: 300, to: 700, dur: 0.18, vol: 0.14 }); },
    take(kind) {
      if (kind === 'coin') S.coin(1);
      else if (kind === 'heart') [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.1, vol: 0.06, lp: 3500 }));
      else if (kind === 'treat') [880, 1175].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.08, vol: 0.08 }));
      else S.powerup();
    },
    // the transformations, each with its own silly sound
    form(f) {
      if (f === 'zombie') { tone({ type: 'sawtooth', f: 110, to: 80, dur: 0.8, vol: 0.1, lp: 700 }); tone({ type: 'sawtooth', f: 160, to: 100, at: 0.15, dur: 0.6, vol: 0.06, lp: 900 }); }
      else if (f === 'mummy') { hiss({ filter: 'bandpass', f: 900, q: 3, dur: 0.6, vol: 0.18 }); tone({ type: 'triangle', f: 300, to: 200, dur: 0.5, vol: 0.08 }); }
      else if (f === 'monkey') notes([[880, 0, 0.08], [1175, 0.1, 0.08], [880, 0.2, 0.08], [1175, 0.3, 0.08]], { type: 'triangle', vol: 0.1 });
      else if (f === 'chubby') { tone({ type: 'sine', f: 200, to: 400, dur: 0.3, vol: 0.18 }); tone({ type: 'sine', f: 300, to: 120, at: 0.3, dur: 0.25, vol: 0.18 }); }
      else if (f === 'snow') { for (let i = 0; i < 6; i++) tone({ type: 'sine', f: 2400 - i * 200, at: i * 0.05, dur: 0.08, vol: 0.05 }); hiss({ filter: 'highpass', f: 4000, dur: 0.5, vol: 0.08 }); }
    },
    cure() { notes([[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24, 0.2]], { type: 'triangle', vol: 0.12 }); hiss({ filter: 'highpass', f: 5000, dur: 0.4, vol: 0.06 }); },
    board() { tone({ type: 'square', f: 220, to: 440, dur: 0.12, vol: 0.06, lp: 1500 }); tone({ type: 'square', f: 440, to: 660, at: 0.12, dur: 0.12, vol: 0.06, lp: 1500 }); },
    vroom() { tone({ type: 'sawtooth', f: 70, to: 140, dur: 0.5, vol: 0.08, lp: 600 }); },
    warn() { for (let i = 0; i < 3; i++) tone({ type: 'square', f: 880, at: i * 0.2, dur: 0.1, vol: 0.06, lp: 2400 }); },
    rideBoom() { this.boom(); notes([[392, 0.2], [523, 0.3], [659, 0.4]], { type: 'triangle', vol: 0.08 }); },
    freed() { notes([[659, 0], [784, 0.1], [988, 0.2], [1319, 0.3, 0.2]], { type: 'triangle', vol: 0.1 }); },
    salute() { notes([[784, 0], [1047, 0.15, 0.25]], { type: 'square', vol: 0.05 }); },
    buddy() { notes([[523, 0], [784, 0.08], [1047, 0.16, 0.18]], { type: 'square', vol: 0.06 }); },
    saved() { hiss({ f: 1200, to: 5000, dur: 0.35, vol: 0.12, q: 3 }); tone({ type: 'sine', f: 600, to: 1400, dur: 0.3, vol: 0.1 }); },
    peace() { for (let i = 0; i < 5; i++) tone({ type: 'triangle', f: 784 + i * 196, at: i * 0.05, dur: 0.1, vol: 0.06 }); },
    punch() { S.punch ? S.punch() : tone({ f: 180, to: 60, dur: 0.12, vol: 0.3 }); },
    teamup() { S.clap ? S.clap() : null; notes([[523, 0], [659, 0.06], [784, 0.12], [1047, 0.18], [1319, 0.24, 0.3]], { vol: 0.08 }); hiss({ filter: 'highpass', f: 4000, dur: 0.12, vol: 0.2 }); },
    nope() { tone({ type: 'square', f: 200, to: 150, dur: 0.12, vol: 0.05, lp: 1000 }); },
    throwIt() { hiss({ filter: 'bandpass', f: 1200, to: 2400, q: 1, dur: 0.15, vol: 0.1 }); },
    stomp() { tone({ f: 80, to: 40, dur: 0.35, vol: 0.4 }); hiss({ filter: 'lowpass', f: 900, to: 100, dur: 0.4, vol: 0.25 }); },
    bossWarn() { for (let i = 0; i < 4; i++) { tone({ type: 'square', f: 440, at: i * 0.35, dur: 0.15, vol: 0.07, lp: 1800 }); tone({ type: 'square', f: 330, at: i * 0.35 + 0.17, dur: 0.15, vol: 0.07, lp: 1800 }); } },
    bossWind() { tone({ type: 'sine', f: 200, to: 500, dur: 0.4, vol: 0.06 }); },
    bossDown() {
      hiss({ filter: 'lowpass', f: 3200, to: 120, dur: 1.2, vol: 0.45 });
      tone({ f: 140, to: 40, dur: 0.9, vol: 0.4 });
      for (let i = 0; i < 8; i++) tone({ type: 'triangle', f: 700 + i * 160, at: 0.3 + i * 0.07, dur: 0.12, vol: 0.07 });
    },
    clear() {
      notes([[523, 0], [523, 0.12], [523, 0.24], [659, 0.36, 0.3], [587, 0.7], [659, 0.82], [784, 0.94, 0.5]], { vol: 0.07 });
      [[131, 0], [196, 0.36], [262, 0.94]].forEach(([f, at]) => tone({ type: 'triangle', f, at, dur: 0.3, vol: 0.2 }));
    },
    sad() { notes([[392, 0, 0.2], [370, 0.22, 0.2], [349, 0.44, 0.2], [330, 0.66, 0.5]], { type: 'triangle', vol: 0.12 }); },
    go() { notes([[784, 0, 0.08], [988, 0.1, 0.16]], { vol: 0.06 }); },
    cheer() { hiss({ filter: 'bandpass', f: 1500, q: 0.6, dur: 0.6, vol: 0.06 }); },
    birds() { for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 2200 + Math.random() * 600, to: 2800, at: i * 0.07, dur: 0.05, vol: 0.03 }); },
    click() { S.click && S.click(); },
  };
})();
