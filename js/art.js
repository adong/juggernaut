/* JuggernauT: everything you see, built from boxes, balls and canvas paintings (no image or model files).
   The brothers and most people are the kit characters (Kit.people); their transformations are the same characters
   re-dressed (green zombie skin, bandages, monkey ears and tail, a round tummy, a snowman body under their own head).
   The world is side-on: x to the right, y up, the play plane at z = 0, the camera on +z looking back. */
(function () {
  'use strict';
  const JUG = (window.JUG = window.JUG || {});
  const T = THREE, G = Kit.gfx;
  const INK = '#14121f';
  const R = (a, b) => a + Math.random() * (b - a);

  // ---------------------------------------------------------------- materials and geometry caches

  const matCache = {};
  // a texture in the options is keyed by its id (stringifying it would paint the whole canvas into the key)
  const optKey = (o) => (o ? JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)) : '');
  function mat(color, o) {
    const key = color + optKey(o);
    return matCache[key] || (matCache[key] = G.std(color, Object.assign({ roughness: 0.7 }, o || {})));
  }
  const basic = (color, o) => { const key = 'B' + color + optKey(o); return matCache[key] || (matCache[key] = new T.MeshBasicMaterial(Object.assign({ color }, o || {}))); };
  const geoCache = {};
  const cached = (key, make) => geoCache[key] || (geoCache[key] = make());
  const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d));
  const sphGeo = (r, a = 16, b = 12) => cached(`s${r},${a},${b}`, () => new T.SphereGeometry(r, a, b));
  const cylGeo = (r1, r2, h, n = 14) => cached(`c${r1},${r2},${h},${n}`, () => new T.CylinderGeometry(r1, r2, h, n));
  const coneGeo = (r, h, n = 12) => cached(`k${r},${h},${n}`, () => new T.ConeGeometry(r, h, n));
  const torGeo = (r, t, n = 8, m = 20, arc = Math.PI * 2) => cached(`t${r},${t},${n},${m},${arc}`, () => new T.TorusGeometry(r, t, n, m, arc));
  function add(geo, m, x, y, z, parent) {
    const o = new T.Mesh(geo, m);
    o.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(o);
    return o;
  }
  const box = (w, h, d, m, x, y, z, parent) => add(boxGeo(w, h, d), m, x, y, z, parent);
  const ball = (r, m, x, y, z, parent) => add(sphGeo(r), m, x, y, z, parent);
  const cyl = (r1, r2, h, m, x, y, z, parent, n) => add(cylGeo(r1, r2, h, n), m, x, y, z, parent);
  const cone = (r, h, m, x, y, z, parent, n) => add(coneGeo(r, h, n), m, x, y, z, parent);
  const group = (parent, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; };

  // ---------------------------------------------------------------- canvas textures

  const tex = {};
  const burstCache = {};
  // a comic word burst: BONK!, POP!, SPLASH!... (canvas text goes through Kit.lang.t for 中文)
  function burstTexture(en, fill = '#ffd400') {
    const word = Kit.lang ? Kit.lang.t(en) : en;
    const key = word + fill;
    if (burstCache[key]) return burstCache[key];
    const [c, g] = G.makeCanvas(256, 256);
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 80 : 122, a = (i * Math.PI) / 12 + 0.1;
      g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.8);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    let px = word.length > 6 ? 38 : word.length > 5 ? 46 : 58;
    g.font = `${px}px ${G.FONT}`;
    const wide = g.measureText(word).width;
    if (wide > 200) { px = Math.floor((px * 200) / wide); g.font = `${px}px ${G.FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.strokeText(word, 128, 132);
    g.fillStyle = '#ffffff';
    g.fillText(word, 128, 132);
    return (burstCache[key] = G.toTexture(c));
  }

  const textCache = {};
  function textTexture(text, color = '#ffffff', w = 256) {
    const key = text + color + w;
    if (textCache[key]) return textCache[key];
    const [c, g] = G.makeCanvas(w, 96);
    let px = 56;
    g.font = `${px}px ${G.FONT}`;
    const wide = g.measureText(text).width;
    if (wide > w - 24) { px = Math.floor((px * (w - 24)) / wide); g.font = `${px}px ${G.FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = INK;
    g.strokeText(text, w / 2, 52);
    g.fillStyle = color;
    g.fillText(text, w / 2, 52);
    return (textCache[key] = G.toTexture(c));
  }

  // a round, outlined ball for the baddies' throws: it shows on every ground and sky
  function orbTexture(fill, ring = INK, shine = true) {
    const [c, g] = G.makeCanvas(128, 128);
    g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill();
    g.lineWidth = 10; g.strokeStyle = ring; g.stroke();
    if (shine) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(46, 42, 16, 10, -0.6, 0, Math.PI * 2); g.fill(); }
    return G.toTexture(c);
  }

  function corkTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.translate(64, 64); g.rotate(-0.4);
    g.fillStyle = '#c98a4b'; g.strokeStyle = INK; g.lineWidth = 9;
    g.beginPath(); g.moveTo(-40, -30); g.lineTo(40, -22); g.lineTo(40, 22); g.lineTo(-40, 30); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8a5a2b';
    for (const [x, y] of [[-20, -8], [4, 10], [22, -6], [-6, -14]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
    return G.toTexture(c);
  }

  function dustTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#efe0b8'; g.strokeStyle = '#7a6a48'; g.lineWidth = 6;
    for (const [x, y, r] of [[44, 70, 30], [80, 66, 32], [62, 44, 30], [64, 82, 26]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#efe0b8';
    for (const [x, y, r] of [[44, 70, 24], [80, 66, 26], [62, 44, 24], [64, 82, 20]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#d9c79a'; g.lineWidth = 5;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(28, 50 + k * 10); g.quadraticCurveTo(64, 40 + k * 12, 100, 54 + k * 10); g.stroke(); }
    g.fillStyle = '#fff7a8';
    for (const [x, y] of [[30, 30], [100, 36], [96, 100], [24, 96]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    return G.toTexture(c);
  }

  function gooTexture(word) {
    const [c, g] = G.makeCanvas(256, 160);
    g.fillStyle = '#8be04a'; g.strokeStyle = '#2f6b17'; g.lineWidth = 9;
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2, r = 1 + Math.sin(i * 2.3) * 0.08;
      g.lineTo(128 + Math.cos(a) * 112 * r, 80 + Math.sin(a) * 66 * r);
    }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(80, 50, 30, 12, -0.3, 0, Math.PI * 2); g.fill();
    if (word) {
      const w = Kit.lang ? Kit.lang.t(word) : word;
      g.font = `52px ${G.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 9; g.strokeStyle = '#1d4a0c'; g.strokeText(w, 128, 84); g.fillStyle = '#ffffff'; g.fillText(w, 128, 84);
    }
    return G.toTexture(c);
  }

  function bubbleTexture(face) {
    const [c, g] = G.makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 20, 64, 64, 58);
    gr.addColorStop(0, 'rgba(180,240,255,0.15)'); gr.addColorStop(0.8, 'rgba(140,220,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = face ? INK : '#3d8fd0'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(44, 40, 14, 8, -0.6, 0, Math.PI * 2); g.fill();
    if (face) { // a grumpy bubble
      g.fillStyle = INK;
      g.beginPath(); g.arc(50, 64, 6, 0, Math.PI * 2); g.arc(78, 64, 6, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.beginPath(); g.moveTo(40, 50); g.lineTo(58, 56); g.moveTo(88, 50); g.lineTo(70, 56); g.stroke();
      g.beginPath(); g.arc(64, 92, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    return G.toTexture(c);
  }

  function waveTexture(fill = '#ffe08a') {
    const [c, g] = G.makeCanvas(256, 128);
    g.fillStyle = fill; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.moveTo(8, 124);
    for (let i = 0; i <= 8; i++) g.lineTo(8 + i * 30, 124 - (i % 2 ? 100 : 60) * Math.sin((i / 8) * Math.PI) - 8);
    g.lineTo(248, 124); g.closePath(); g.fill(); g.stroke();
    return G.toTexture(c);
  }

  function beamTexture(warn) {
    const [c, g] = G.makeCanvas(64, 256);
    if (warn) {
      g.strokeStyle = 'rgba(255,212,0,0.95)'; g.lineWidth = 6; g.setLineDash([18, 14]);
      g.strokeRect(6, 4, 52, 248);
      g.fillStyle = 'rgba(255,240,120,0.18)'; g.fillRect(6, 4, 52, 248);
    } else {
      const gr = g.createLinearGradient(0, 0, 64, 0);
      gr.addColorStop(0, 'rgba(255,220,40,0)'); gr.addColorStop(0.25, 'rgba(255,230,60,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,220,1)');
      gr.addColorStop(0.75, 'rgba(255,230,60,0.85)'); gr.addColorStop(1, 'rgba(255,220,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let y = 10; y < 256; y += 40) { g.beginPath(); g.arc(32, y, 6, 0, Math.PI * 2); g.fill(); }
    }
    return G.toTexture(c);
  }

  function coinTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fillStyle = '#ffcc1a'; g.fill();
    g.lineWidth = 9; g.strokeStyle = '#b07800'; g.stroke();
    g.beginPath(); g.arc(64, 64, 38, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = '#ffe680'; g.stroke();
    g.font = `52px ${G.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#b07800'; g.fillText('T', 64, 68);
    return G.toTexture(c);
  }

  function badgeTexture(emoji, ring) {
    const [c, g] = G.makeCanvas(128, 128);
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fillStyle = '#ffffff'; g.fill();
    g.lineWidth = 9; g.strokeStyle = ring; g.stroke();
    g.font = `66px ${G.EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 64, 70);
    return G.toTexture(c);
  }

  const crateCache = {};
  function crateTexture(icon) {
    if (crateCache[icon || '']) return crateCache[icon || ''];
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#c98a4b'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#a86b33';
    for (let y = 0; y < 128; y += 32) g.fillRect(0, y + 28, 128, 4);
    g.strokeStyle = '#7a4a1e'; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118);
    g.beginPath(); g.moveTo(10, 10); g.lineTo(118, 118); g.stroke();
    if (icon) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 32, 0, Math.PI * 2); g.fill();
      g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
      g.font = `40px ${G.EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 64, 68);
    }
    return (crateCache[icon || ''] = G.toTexture(c));
  }

  // bandages: cream strips wound round and round, with soft shadows between
  function bandageTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#efe6cc'; g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 9; k++) {
      const y = k * 15 + (k % 2) * 3;
      g.fillStyle = k % 2 ? '#e2d6b4' : '#f7f0dc';
      g.save(); g.translate(64, y); g.rotate(k % 3 === 0 ? 0.08 : -0.06); g.fillRect(-80, 0, 160, 12); g.restore();
      g.strokeStyle = 'rgba(120,100,60,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, y + 13); g.lineTo(128, y + 11); g.stroke();
    }
    return G.toTexture(c);
  }

  function shadowTexture() {
    return G.radialTexture(64, [[0, 'rgba(0,0,0,0.42)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  }

  function ringTexture(colors) {
    const [c, g] = G.makeCanvas(256, 256);
    colors.forEach((col, i) => { g.beginPath(); g.arc(128, 128, 118 - i * 9, 0, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = col; g.stroke(); });
    return G.toTexture(c);
  }

  function initTextures() {
    tex.dot = G.dotTexture();
    tex.glow = G.glowTexture();
    tex.shadow = shadowTexture();
    tex.coin = coinTexture();
    tex.cork = corkTexture();
    tex.dust = dustTexture();
    tex.goo = gooTexture(null);
    tex.bleh = gooTexture('BLEH!');
    tex.bubble = bubbleTexture(false);
    tex.grumpyBubble = bubbleTexture(true);
    tex.wave = waveTexture('#ffe08a');
    tex.bandWave = waveTexture('#f2ead2');
    tex.beam = beamTexture(false);
    tex.beamWarn = beamTexture(true);
    tex.bandage = bandageTexture();
    tex.bloop = orbTexture('#b45cff');
    tex.ray = orbTexture('#ffe23d');
    tex.ice = orbTexture('#bdf0ff', '#2a6fa8');
    tex.drop = orbTexture('#4fb8ff', '#1d4f8f');
    tex.water = orbTexture('#7fd4ff', '#2d7fc4');
    tex.foam = orbTexture('#ffffff', '#7ab8e8');
    tex.snowball = orbTexture('#ffffff', '#8fb8d8');
    tex.mini = orbTexture('#ffd400', '#a06a00');
    tex.vulcan = bubbleTexture(false);
    tex.rainbow = ringTexture(['#ff4b5c', '#ffb02e', '#ffe23d', '#6fe05a', '#3fb3ff', '#9d6bff']);
    tex.ringWhite = ringTexture(['#ffffff', 'rgba(255,255,255,0.5)']);
    tex.crate = crateTexture(null);
  }

  // a flat picture that always faces the camera
  function spriteOf(map, size, o = {}) {
    const s = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    s.scale.set(size * (o.sx || 1), size, 1);
    if (o.onTop) { s.material.depthTest = false; s.renderOrder = 9; }
    return s;
  }
  const emoji = (e) => tex['e' + e] || (tex['e' + e] = G.emojiTexture(e));

  // ---------------------------------------------------------------- the brothers and their transformations

  const FACE_R = -(Math.PI / 2 + 0.45), FACE_L = FACE_R - (Math.PI - 0.9); // three-quarter view; turning goes past the camera side

  // Re-dress a kit character: swap every material that passes `keep` for `m` (bandages, snow, fur...)
  function redress(root, m, keep) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((x) => (keep(x) ? x : m));
      o.material = Array.isArray(o.material) ? next : next[0];
    });
  }
  const CREAM = '#efe6cc';
  const creamC = new T.Color(CREAM);
  const isCream = (m) => m.color && Math.abs(m.color.r - creamC.r) + Math.abs(m.color.g - creamC.g) + Math.abs(m.color.b - creamC.b) < 0.02;
  // a monkey face: big round ears out to the sides (the bear's little top ears go away) and a pale face patch
  function monkeyEars(head) {
    for (const o of head.children.slice()) if (o.isMesh && Math.abs(o.position.y - 0.29) < 0.02) o.visible = false;
    const fur = mat('#8a5a33'), pink = mat('#f2b49a');
    for (const s of [-1, 1]) {
      const e = cyl(0.17, 0.17, 0.07, fur, s * 0.33, 0.04, 0.02, head, 14);
      e.rotation.z = Math.PI / 2;
      const inner = cyl(0.11, 0.11, 0.02, pink, s * 0.37, 0.04, 0.02, head, 12);
      inner.rotation.z = Math.PI / 2;
    }
    box(0.38, 0.22, 0.02, mat('#e8c39e'), 0, 0.08, -0.242, head);
  }
  const lum = (m) => { if (!m.color) return 1; const c = m.color; return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };
  const isFace = (m) => lum(m) < 0.08 || (m.color && m.color.r > 0.25 && m.color.g < 0.15); // eyes, brows, the mouth

  function tail(parent, color, s = 1) {
    const t = group(parent, 0, 0.1 * s, 0.22 * s);
    const m = mat(color);
    let prev = t;
    for (let k = 0; k < 5; k++) {
      const seg = group(prev, 0, 0, k ? 0.16 * s : 0);
      seg.rotation.x = -0.45;
      box(0.08 * s, 0.08 * s, 0.18 * s, m, 0, 0, 0.08 * s, seg);
      prev = seg;
    }
    return t;
  }

  function strawHat(head, s = 1) {
    const m = mat('#e8c25a');
    cyl(0.5 * s, 0.5 * s, 0.05 * s, m, 0, 0.3 * s, 0, head, 18);
    cyl(0.27 * s, 0.3 * s, 0.22 * s, m, 0, 0.42 * s, 0, head, 14);
    cyl(0.305 * s, 0.305 * s, 0.06 * s, mat('#d9473a'), 0, 0.36 * s, 0, head, 14);
  }

  function crown(parent, s, y, color = '#ffd400') {
    const g = group(parent, 0, y, 0);
    const m = mat(color, { metalness: 0.4, roughness: 0.35, emissive: color, emissiveIntensity: 0.2 });
    cyl(0.32 * s, 0.32 * s, 0.16 * s, m, 0, 0, 0, g, 12);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      cone(0.08 * s, 0.22 * s, m, Math.cos(a) * 0.28 * s, 0.18 * s, Math.sin(a) * 0.28 * s, g, 6);
    }
    ball(0.06 * s, mat('#ff3d7f'), 0, 0.02 * s, 0.33 * s, g);
    return g;
  }

  // A brother in one form. Returns { root, p (kit parts or null), gun, kind, form, extra }
  function buildHero(kind, form) {
    const entry = Kit.roster.get(kind);
    const look = Object.assign({}, entry.look);
    const v = { kind, form, root: new T.Group(), body: null, p: null, gun: null, roll: null, extra: {} };
    if (form === 'zombie') {
      Object.assign(look, { zombie: true, skin: '#9fd47a', peace: false });
    } else if (form === 'mummy') {
      // everything cream, then wound in bandages; his eyes, smile and hair poke out so you can still tell who it is
      Object.assign(look, { skin: CREAM, top: CREAM, bottom: CREAM, shoes: CREAM, print: null, shorts: false, peace: false });
    } else if (form === 'monkey') {
      Object.assign(look, { head: 'bear', skin: '#8a5a33', muzzle: '#e8c39e', shorts: true, peace: false });
    } else if (form === 'chubby') {
      Object.assign(look, { belly: true });
    }
    if (form === 'snow') {
      // the snowman: two big snowballs, his own head on top, a scarf in his shirt colour, twig arms
      const p = Kit.people.build(look);
      const snow = mat('#f8fbff', { roughness: 0.9 });
      const body = group(v.root);
      const bottom = ball(0.72, snow, 0, 0.72, 0, body);
      bottom.scale.set(1, 0.95, 1);
      for (const [x, y, z] of [[0.2, 0.3, 0.6], [-0.3, 0.9, 0.55], [0.4, 1.0, 0.45], [-0.1, 0.5, -0.6]]) ball(0.07, mat('#d8e6f2'), x, y, z, bottom);
      ball(0.52, snow, 0, 1.6, 0, body);
      for (const y of [1.45, 1.7]) ball(0.06, mat('#2a2633'), 0, y, -0.5, body).position.z = 0.5;
      const head = p.head;
      head.parent.remove(head);
      head.position.set(0, 2.25, 0);
      head.rotation.set(0, 0, 0);
      head.scale.setScalar(0.95);
      body.add(head);
      cone(0.06, 0.32, mat('#ff8a1f'), 0, 2.2, -0.36, body, 8).rotation.x = -Math.PI / 2;
      const scarf = mat(look.top);
      cyl(0.46, 0.5, 0.16, scarf, 0, 1.98, 0, body, 14);
      box(0.16, 0.42, 0.06, scarf, 0.22, 1.76, -0.44, body);
      const twig = mat('#6b4423');
      for (const sx of [-1, 1]) { const a = box(0.06, 0.06, 0.7, twig, sx * 0.55, 1.6, 0, body); a.rotation.y = Math.PI / 2; a.rotation.z = sx * 0.5; }
      v.body = body;
      v.roll = bottom;
      v.root.rotation.y = FACE_R;
      return v;
    }
    const p = Kit.people.build(look);
    v.p = p;
    v.root.add(p.root);
    v.body = p.root;
    if (form === 'mummy') {
      const band = mat('#ffffff', { map: tex.bandage, roughness: 0.9 });
      redress(p.root, band, (m) => !isCream(m));
      // two loose bandage ends that flap
      v.extra.ends = [box(0.08, 0.36, 0.03, band, 0.18, -0.2, 0.2, p.hips), box(0.08, 0.3, 0.03, band, -0.14, 0.62, -0.26, p.head)];
    }
    if (form === 'monkey') { v.extra.tail = tail(p.hips, '#8a5a33'); monkeyEars(p.head); }
    if (form === 'chubby') {
      // round as a ball: a big tummy, puffy cheeks
      p.root.scale.set(1.32, 0.96, 1.4);
      ball(0.5, mat(look.top), 0, 0.3, -0.12, p.hips).scale.set(1.05, 0.95, 1);
      for (const sx of [-1, 1]) ball(0.11, mat(look.skin), sx * 0.2, -0.08, -0.2, p.head);
    }
    // the toy blaster in both hands (re-coloured for each pick-up)
    const gun = group(p.armR, 0, -0.68, -0.06);
    const body2 = box(0.18, 0.22, 0.5, mat('#ffb02e'), 0, 0, -0.2, gun);
    const barrel = cyl(0.07, 0.09, 0.32, mat('#ffffff'), 0, 0.02, -0.52, gun, 10);
    barrel.rotation.x = Math.PI / 2;
    const tank = box(0.12, 0.16, 0.2, mat('#3fb3ff'), 0, 0.17, -0.12, gun);
    const tip = ball(0.09, mat('#ff3d7f'), 0, 0.02, -0.7, gun);
    v.gun = { root: gun, body: body2, barrel, tank, tip };
    v.root.rotation.y = FACE_R;
    return v;
  }

  const GUN_LOOK = {
    ball: ['#ff8a1f', '#ffffff', '#ffb02e', '#ff6a00', 1],
    star: ['#7fdcbd', '#ffffff', '#ffd400', '#ffd400', 1],
    water: ['#3f86e8', '#9fdcff', '#18d4ff', '#18d4ff', 1.1],
    bubble: ['#ff7fbf', '#ffffff', '#c8f4ff', '#ff3d7f', 1.05],
    foam: ['#ffffff', '#7ab8e8', '#ffd400', '#7ab8e8', 1.45],
    snow: ['#bfe6ff', '#ffffff', '#ffffff', '#2a6fa8', 1.2],
    bleh: ['#6fbf3a', '#9fd47a', '#2f6b17', '#8be04a', 1],
    mini: ['#ffd400', '#8a5a33', '#ffd400', '#ff8a1f', 0.7],
  };
  function paintGun(v, gun) {
    if (!v.gun) return;
    const L = GUN_LOOK[gun] || GUN_LOOK.ball;
    v.gun.body.material = mat(L[0]);
    v.gun.barrel.material = mat(L[1]);
    v.gun.tank.material = mat(L[2]);
    v.gun.tip.material = mat(L[3]);
    v.gun.root.scale.setScalar(L[4]);
    v.gun.root.visible = gun !== 'bleh';
  }

  // ---------------------------------------------------------------- the cast

  function buildPerson(look, o = {}) {
    const p = Kit.people.build(look);
    const root = new T.Group();
    root.add(p.root);
    if (o.scale) p.root.scale.setScalar(o.scale);
    return { root, p };
  }

  function buildFuzzbeard(seed = 0) {
    const tops = ['#e5a04a', '#6fae4a', '#4a86cf', '#c45b9a'];
    const v = buildPerson({ head: 'human', skin: '#efc29c', hair: 'short', hairColor: '#cfcfd4', mustache: true, brows: true, shirt: 'tee', top: tops[Math.floor(seed * 4) % 4], bottom: '#6b4a2b', shoes: '#3a2a1c' });
    const beard = mat('#e9e9ee', { roughness: 1 });
    box(0.42, 0.3, 0.14, beard, 0, -0.22, -0.2, v.p.head);
    box(0.28, 0.2, 0.12, beard, 0, -0.42, -0.2, v.p.head);
    // the gift ribbon he's tied up with, and the post
    const rib = mat('#ff3d7f');
    v.ribbon = group(v.root);
    for (const y of [0.85, 1.15]) box(0.82, 0.1, 0.56, rib, 0, y, 0, v.ribbon);
    const bow = group(v.ribbon, 0, 1.0, -0.32);
    for (const s of [-1, 1]) { const b = box(0.2, 0.14, 0.06, rib, s * 0.12, 0, 0, bow); b.rotation.z = s * 0.4; }
    v.post = cyl(0.12, 0.12, 2.2, mat('#a86b33'), 0, 1.1, 0.4, v.root, 8);
    return v;
  }

  // Bruno the bear (from the kit) floating down under a bunch of balloons, holding a crate
  function buildBruno() {
    const v = buildPerson(Kit.roster.get('bruno').look, { scale: 0.9 });
    v.root.rotation.y = Math.PI * 0.85;
    const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#7fdcbd', '#ff8a1f'];
    const bunch = group(v.root, 0, 2.6, 0);
    cols.forEach((c, k) => {
      const a = (k / cols.length) * Math.PI * 2;
      const b = ball(0.42, mat(c, { roughness: 0.35 }), Math.cos(a) * 0.45, 1.3 + Math.sin(a * 2) * 0.25, Math.sin(a) * 0.45, bunch);
      b.scale.set(1, 1.15, 1);
      const str = box(0.015, 1.3, 0.015, basic('#ffffff'), Math.cos(a) * 0.22, 0.5, Math.sin(a) * 0.22, bunch);
      str.rotation.z = -Math.cos(a) * 0.3;
    });
    v.crate = box(0.8, 0.8, 0.8, mat('#ffffff', { map: tex.crate }), 0, 0.2, -0.6, v.root);
    return v;
  }

  // Coco the monkey: a small kit character with a bear head re-coloured, a tail and a water blaster
  function buildCoco() {
    const v = buildPerson({ head: 'bear', skin: '#7a4a24', muzzle: '#f0c9a0', shirt: 'tee', top: '#ff3d7f', print: 'star', bottom: '#3f86e8', shorts: true, shoes: '#ffd400' }, { scale: 0.55 });
    tail(v.p.hips, '#7a4a24');
    const gun = group(v.p.armR, 0, -0.68, -0.06);
    box(0.16, 0.2, 0.44, mat('#3f86e8'), 0, 0, -0.2, gun);
    box(0.12, 0.18, 0.18, mat('#18d4ff'), 0, 0.16, -0.12, gun);
    v.p.armR.rotation.x = Math.PI / 2;
    return v;
  }

  const FOLK_LOOKS = [
    { head: 'human', skin: '#f2c49c', hair: 'ponytail', hairColor: '#7a4a24', brows: true, smile: true, shirt: 'tee', top: '#ff7fbf', bottom: '#3f5fa8', shoes: '#ffffff' },
    { head: 'human', skin: '#b27a52', hair: 'short', hairColor: '#1a120c', brows: true, smile: true, shirt: 'hoodie', top: '#ffd400', bottom: '#2d5fb8', shoes: '#ff3d7f' },
    { head: 'human', skin: '#efc29c', hair: 'short', hairColor: '#cfcfd4', mustache: true, shirt: 'jacket', top: '#6fae4a', bottom: '#5a4a3a', shoes: '#2a2a30' },
    { head: 'human', skin: '#8d5a36', hair: 'ponytail', hairColor: '#1a120c', brows: true, smile: true, shirt: 'tee', top: '#18d4ff', bottom: '#e6dfd0', shoes: '#ff8a1f' },
  ];
  function buildFolk(kind, seed) {
    if (kind === 'camel') return buildCamel();
    if (kind === 'farmer') {
      const v = buildPerson({ head: 'human', skin: '#efc29c', hair: 'short', hairColor: '#7a4a24', brows: true, smile: true, shirt: 'tee', top: '#d9473a', print: 'bricks', bottom: '#3f5fa8', shoes: '#5b4636' });
      strawHat(v.p.head);
      return v;
    }
    const v = buildPerson(FOLK_LOOKS[Math.floor(seed * FOLK_LOOKS.length) % FOLK_LOOKS.length]);
    if (seed > 0.6) strawHat(v.p.head);
    return v;
  }

  function buildCamel() {
    const root = new T.Group();
    const fur = mat('#d9a35f'), dark = mat('#7a5a2e');
    const b = group(root);
    box(1.8, 0.8, 0.7, fur, 0, 1.6, 0, b);
    ball(0.5, fur, -0.35, 2.05, 0, b).scale.set(1, 0.8, 0.9);
    ball(0.45, fur, 0.4, 2.0, 0, b).scale.set(1, 0.8, 0.9);
    const neck = box(0.3, 1.1, 0.3, fur, 1.0, 2.1, 0, b);
    neck.rotation.z = -0.35;
    box(0.6, 0.32, 0.32, fur, 1.35, 2.62, 0, b);
    box(0.08, 0.08, 0.04, mat('#1b1a22'), 1.45, 2.72, 0.17, b);
    box(0.1, 0.1, 0.1, dark, 1.15, 2.82, 0.1, b);
    for (const [x, z] of [[-0.7, 0.22], [-0.7, -0.22], [0.7, 0.22], [0.7, -0.22]]) box(0.18, 1.3, 0.18, fur, x, 0.65, z, b);
    return { root, camel: b };
  }

  // ---------------------------------------------------------------- rides

  function buildRide(type, color = '#3f86e8') {
    const root = new T.Group();
    const v = { root, type, parts: {} };
    if (type === 'tank') {
      // the TT TANK: a chubby toy tank with googly headlights, a bubble turret and a big TT on the side
      const body = group(root);
      const blue = mat(color), trim = mat('#ffd400'), dark = mat('#2a2a36'), white = mat('#ffffff');
      box(2.4, 0.8, 1.4, blue, 0, 0.75, 0, body);
      box(2.6, 0.12, 1.5, trim, 0, 1.2, 0, body);
      box(2.5, 0.5, 1.5, dark, 0, 0.3, 0, body);
      v.parts.wheels = [];
      for (let k = 0; k < 4; k++) {
        const w = cyl(0.26, 0.26, 1.56, mat('#4a4a58'), -0.9 + k * 0.6, 0.3, 0, body, 12);
        w.rotation.x = Math.PI / 2;
        box(0.1, 0.1, 1.58, mat('#ffd400'), 0, 0, 0, w).position.set(0, 0, 0);
        v.parts.wheels.push(w);
      }
      const tt = mat('#ffffff', { map: textTexture('TT', '#ffd400') });
      const sign = new T.Mesh(new T.PlaneGeometry(1.1, 0.42), tt);
      sign.position.set(-0.2, 0.78, 0.71);
      body.add(sign);
      for (const z of [0.45, -0.45]) { ball(0.17, white, 1.22, 0.85, z, body); ball(0.08, dark, 1.34, 0.86, z, body); }
      const turret = group(body, -0.1, 1.3, 0);
      ball(0.62, blue, 0, 0.1, 0, turret).scale.set(1, 0.7, 0.9);
      const hatch = cyl(0.36, 0.38, 0.16, trim, 0, 0.5, 0, turret, 14);
      v.parts.hatch = hatch;
      const gun = group(turret, 0, 0.1, 0);
      const barrel = cyl(0.14, 0.16, 1.3, mat('#ff3d7f'), 0.75, 0, 0, gun, 12);
      barrel.rotation.z = Math.PI / 2;
      ball(0.2, mat('#ffffff', { roughness: 0.3 }), 1.42, 0, 0, gun);
      v.parts.gun = gun;
      v.parts.body = body;
      v.seat = 1.2;
    } else if (type === 'llama') {
      // LOLLY THE LLAMA: fluffy, long-necked, with a bubble blaster on her saddle
      const body = group(root);
      const wool = mat('#fbf3e6', { roughness: 1 }), face = mat('#f2e2c8'), dark = mat('#1b1a22');
      box(1.6, 0.8, 0.8, wool, 0, 1.4, 0, body);
      ball(0.45, wool, -0.85, 1.45, 0, body);
      const neck = group(body, 0.65, 1.6, 0);
      box(0.4, 1.3, 0.4, wool, 0, 0.6, 0, neck);
      const head = group(neck, 0.1, 1.35, 0);
      box(0.5, 0.42, 0.42, face, 0.12, 0, 0, head);
      box(0.32, 0.26, 0.32, face, 0.42, -0.08, 0, head);
      for (const z of [0.16, -0.16]) { box(0.08, 0.28, 0.08, wool, -0.05, 0.34, z, head); box(0.07, 0.09, 0.03, dark, 0.28, 0.06, z + (z > 0 ? 0.06 : -0.06), head); }
      box(0.12, 0.04, 0.03, mat('#8a3b2e'), 0.55, -0.16, 0.13, head);
      const saddle = mat('#ff3d7f');
      box(0.9, 0.18, 0.86, saddle, -0.05, 1.86, 0, body);
      box(0.9, 0.5, 0.06, mat('#ffd400'), -0.05, 1.55, 0.44, body);
      const gun = group(body, 0.3, 1.25, 0.5);
      cyl(0.12, 0.14, 0.8, mat('#3fb3ff'), 0.3, 0, 0, gun, 10).rotation.z = Math.PI / 2;
      ball(0.16, mat('#ffffff'), 0.72, 0, 0, gun);
      v.parts.gun = gun;
      v.parts.legs = [];
      for (const [x, z] of [[-0.55, 0.25], [-0.55, -0.25], [0.55, 0.25], [0.55, -0.25]]) {
        const leg = group(body, x, 1.05, z);
        box(0.18, 1.05, 0.18, wool, 0, -0.5, 0, leg);
        box(0.2, 0.12, 0.22, dark, 0.02, -1.0, 0, leg);
        v.parts.legs.push(leg);
      }
      v.parts.neck = neck;
      v.parts.body = body;
      v.seat = 1.5;
    } else {
      // BOING BOT: a bouncy mech on spring legs with foam boxing-glove fists
      const body = group(root);
      const red = mat('#ff4b5c'), white = mat('#ffffff'), dark = mat('#2a2a36'), glass = mat('#9fdcff', { transparent: true, opacity: 0.45, roughness: 0.1 });
      const cab = group(body, 0, 2.0, 0);
      box(1.5, 1.1, 1.2, red, 0, 0, 0, cab);
      box(1.56, 0.16, 1.26, mat('#ffd400'), 0, -0.5, 0, cab);
      const dome = ball(0.62, glass, 0, 0.6, 0, cab);
      dome.scale.set(1, 0.8, 1);
      for (const z of [0.4, -0.4]) { ball(0.15, white, 0.78, 0.12, z, cab); ball(0.07, dark, 0.88, 0.12, z, cab); }
      v.parts.legs = [];
      for (const z of [0.42, -0.42]) {
        const leg = group(body, 0, 1.45, z);
        for (let k = 0; k < 5; k++) { const ring = add(torGeo(0.2, 0.05, 6, 14), mat('#c0c4cc', { metalness: 0.6, roughness: 0.3 }), 0, -0.22 - k * 0.2, 0, leg); ring.rotation.x = Math.PI / 2; }
        box(0.6, 0.18, 0.4, dark, 0.05, -1.36, 0, leg);
        v.parts.legs.push(leg);
      }
      const arm = group(cab, 0.5, -0.1, 0.72);
      box(0.6, 0.2, 0.2, mat('#c0c4cc'), 0.3, 0, 0, arm);
      ball(0.32, mat('#ffffff', { roughness: 0.6 }), 0.75, 0, 0, arm);
      v.parts.arm = arm;
      v.parts.cab = cab;
      v.parts.body = body;
      v.seat = 2.1;
    }
    return v;
  }

  // ---------------------------------------------------------------- the baddies

  const THEME_TINT = { town: '#ff8a1f', beach: '#ff6b6b', desert: '#d9a35f', jungle: '#6fae4a', snow: '#7ab8e8', farm: '#9d6bff' };

  function googly(parent, x, y, z, r = 0.12) {
    ball(r, mat('#ffffff'), x, y, z, parent);
    ball(r * 0.5, mat('#14121f'), x + r * 0.5, y - r * 0.15, z + r * 0.3, parent);
  }

  function windKey(parent, x, y, z, s = 1) {
    const g = group(parent, x, y, z);
    const m = mat('#ffd400', { metalness: 0.5, roughness: 0.35 });
    cyl(0.05 * s, 0.05 * s, 0.4 * s, m, 0, 0, 0, g, 8).rotation.x = Math.PI / 2;
    const k = group(g, 0, 0, -0.25 * s);
    for (const sy of [-1, 1]) { const b = ball(0.16 * s, m, 0, sy * 0.16 * s, 0, k); b.scale.set(0.35, 1, 1); }
    return k;
  }

  // the toy army's wind-up guy (and the pie drummer): a tin toy with googly eyes and a big wind-up key
  function buildWindup(drummer) {
    const root = new T.Group();
    const b = group(root);
    const coat = mat(drummer ? '#3f86e8' : '#e8453c'), trim = mat('#ffd400', { metalness: 0.3 }), dark = mat('#2a2a36'), skin = mat('#f2c49c');
    const legs = [];
    for (const z of [0.16, -0.16]) { const l = group(b, 0, 0.62, z); box(0.22, 0.6, 0.22, dark, 0, -0.3, 0, l); box(0.28, 0.12, 0.34, mat('#14121f'), 0.04, -0.6, 0, l); legs.push(l); }
    box(0.66, 0.68, 0.5, coat, 0, 0.95, 0, b);
    for (const y of [0.8, 1.0, 1.2]) ball(0.05, trim, 0.34, y, 0, b);
    box(0.7, 0.1, 0.54, mat('#ffffff'), 0, 0.68, 0, b);
    const head = group(b, 0, 1.5, 0);
    box(0.5, 0.42, 0.44, skin, 0, 0, 0, head);
    googly(head, 0.24, 0.06, 0.1, 0.1); googly(head, 0.24, 0.06, -0.1, 0.1);
    box(0.04, 0.06, 0.22, mat('#c0392b'), 0.26, -0.12, 0, head);
    ball(0.07, mat('#ff8a7a'), 0.27, -0.02, 0, head);
    // a striped party hat with a pom-pom, a bit wonky
    const hat = group(head, 0, 0.22, 0);
    hat.rotation.z = -0.25;
    const stripes = [drummer ? '#ffd400' : '#7fdcbd', '#ffffff', drummer ? '#ff3d7f' : '#ffd400'];
    stripes.forEach((c, k) => { cyl(0.26 - k * 0.08, 0.26 - k * 0.08 + 0.02, 0.18, mat(c), 0, 0.09 + k * 0.17, 0, hat, 12); });
    ball(0.1, mat('#ff3d7f'), 0, 0.58, 0, hat);
    const key = windKey(b, -0.28, 1.0, 0, 1);
    key.parent.rotation.y = Math.PI / 2;
    const arms = [];
    for (const z of [0.32, -0.32]) { const a = group(b, 0, 1.2, z); box(0.16, 0.5, 0.16, coat, 0, -0.24, 0, a); ball(0.09, mat('#ffffff'), 0, -0.52, 0, a); arms.push(a); }
    if (drummer) {
      const drum = cyl(0.28, 0.28, 0.3, mat('#ffffff'), 0.38, 0.85, 0, b, 14);
      drum.rotation.z = Math.PI / 2;
      cyl(0.29, 0.29, 0.06, mat('#e8453c'), 0.38, 0.85, 0, b, 14).rotation.z = Math.PI / 2;
    } else {
      const tube = cyl(0.07, 0.09, 0.5, mat('#ffd400'), 0.18, -0.5, 0, arms[0], 8);
      tube.rotation.z = Math.PI / 2;
    }
    return { root, b, legs, arms, head, key, spin: key };
  }

  function buildKitFoe(look, extra) {
    const v = buildPerson(look);
    v.root.rotation.y = FACE_L;
    if (extra) extra(v);
    return v;
  }

  function buildRobot(ray) {
    return buildKitFoe({ head: 'robot', skin: ray ? '#f2e6a0' : '#cfd8e6', eyes: ray ? '#ffd400' : '#ff5ef2', shirt: 'jacket', top: ray ? '#ffd400' : '#5a6fd8', print: 'panel', bottom: '#5a5f6b', shoes: '#2a2a30' }, (v) => {
      const gun = group(v.p.armR, 0, -0.66, -0.06);
      if (ray) {
        // a banana-shaped dish on its blaster
        const dish = add(torGeo(0.18, 0.06, 6, 12, Math.PI), mat('#ffe23d'), 0, 0, -0.32, gun);
        dish.rotation.y = Math.PI / 2;
        cyl(0.06, 0.08, 0.4, mat('#8a6a2a'), 0, 0, -0.18, gun, 8).rotation.x = Math.PI / 2;
      } else {
        cyl(0.12, 0.14, 0.42, mat('#b45cff'), 0, 0, -0.22, gun, 10).rotation.x = Math.PI / 2;
        ball(0.15, basic('#e4b8ff'), 0, 0, -0.46, gun);
      }
      v.p.armR.rotation.x = Math.PI / 2;
    });
  }

  function buildZombie(farmer) {
    const look = Object.assign({}, Kit.roster.get('zombie').look);
    if (farmer) Object.assign(look, { top: '#c45b3a', print: 'torn', bottom: '#3f5fa8', shorts: false });
    return buildKitFoe(look, (v) => { if (farmer) strawHat(v.p.head); });
  }

  function buildMummy() {
    const v = buildKitFoe({ head: 'human', skin: CREAM, hair: 'short', hairColor: CREAM, shirt: 'tee', top: CREAM, bottom: CREAM, shoes: CREAM, brows: true });
    v.p.zombie = true; // arms out in front, the classic mummy walk
    redress(v.p.root, mat('#ffffff', { map: tex.bandage, roughness: 0.9 }), (m) => !isCream(m));
    return v;
  }

  function buildCrab(scale = 1, hat = false) {
    const root = new T.Group();
    const b = group(root);
    b.scale.setScalar(scale);
    const red = mat('#ff5a4a'), dark = mat('#14121f'), white = mat('#ffffff');
    const shell = ball(0.6, red, 0, 0.5, 0, b);
    shell.scale.set(1.1, 0.6, 0.85);
    const eyes = [];
    for (const z of [0.18, -0.18]) {
      const st = group(b, 0.28, 0.75, z);
      box(0.06, 0.3, 0.06, red, 0, 0.12, 0, st);
      ball(0.12, white, 0, 0.32, 0, st); ball(0.06, dark, 0.07, 0.32, z > 0 ? 0.04 : -0.04, st);
      // grumpy brows
      const br = box(0.18, 0.04, 0.05, dark, 0.02, 0.46, 0, st); br.rotation.x = z > 0 ? 0.4 : -0.4;
      eyes.push(st);
    }
    const claws = [];
    for (const z of [0.55, -0.55]) {
      const c = group(b, 0.5, 0.45, z);
      box(0.4, 0.14, 0.14, red, 0.15, 0, 0, c);
      const top = box(0.36, 0.14, 0.24, red, 0.48, 0.1, 0, c);
      const bot = box(0.3, 0.1, 0.22, red, 0.46, -0.08, 0, c);
      claws.push({ c, top, bot });
    }
    const legs = [];
    for (let k = 0; k < 3; k++) for (const z of [0.4, -0.4]) { const l = box(0.08, 0.38, 0.08, red, -0.3 + k * 0.25, 0.18, z, b); l.rotation.x = z > 0 ? 0.6 : -0.6; legs.push(l); }
    if (hat) {
      // a captain's hat
      const h = group(b, 0, 0.88, 0);
      cyl(0.36, 0.36, 0.12, white, 0, 0.06, 0, h, 16);
      box(0.9, 0.1, 0.8, white, 0, 0, 0, h);
      box(0.92, 0.12, 0.82, mat('#1f3a7a'), 0, 0.08, 0, h).scale.set(1, 0.4, 1);
      box(0.3, 0.04, 0.5, dark, 0.4, -0.04, 0, h);
      ball(0.08, mat('#ffd400'), 0.37, 0.12, 0, h);
    }
    return { root, b, eyes, claws, legs };
  }

  function buildFlyer(theme) {
    const root = new T.Group();
    const b = group(root);
    const col = THEME_TINT[theme] || '#ff8a1f';
    const body = ball(0.55, mat(col), 0, 0.5, 0, b);
    body.scale.set(1.1, 0.9, 0.9);
    googly(b, 0.42, 0.62, 0.2, 0.14); googly(b, 0.42, 0.62, -0.2, 0.14);
    for (const z of [0.2, -0.2]) { const br = box(0.24, 0.05, 0.06, mat('#14121f'), 0.5, 0.82, z, b); br.rotation.x = z > 0 ? 0.4 : -0.4; }
    box(0.04, 0.05, 0.3, mat('#14121f'), 0.6, 0.3, 0, b);
    cyl(0.04, 0.04, 0.3, mat('#2a2a36'), 0, 1.05, 0, b, 6);
    const prop = group(b, 0, 1.2, 0);
    for (let k = 0; k < 3; k++) { const bl = box(0.9, 0.04, 0.18, mat('#ffd400'), 0, 0, 0, prop); bl.rotation.y = (k * Math.PI * 2) / 3; }
    // a bucket of water underneath
    cyl(0.22, 0.16, 0.26, mat('#3fb3ff'), 0, -0.12, 0, b, 10);
    return { root, b, prop, spin: prop };
  }

  function buildSnowpup() {
    const root = new T.Group();
    const b = group(root);
    const fur = mat('#f8fbff', { roughness: 1 }), dark = mat('#14121f');
    ball(0.5, fur, 0, 0.5, 0, b).scale.set(1.15, 0.9, 0.9);
    const head = group(b, 0.45, 0.85, 0);
    ball(0.36, fur, 0, 0, 0, head);
    box(0.24, 0.16, 0.2, fur, 0.3, -0.06, 0, head);
    ball(0.06, dark, 0.43, -0.02, 0, head);
    for (const z of [0.13, -0.13]) { ball(0.05, dark, 0.27, 0.08, z, head); const br = box(0.14, 0.035, 0.04, dark, 0.27, 0.17, z, head); br.rotation.x = z > 0 ? 0.5 : -0.5; }
    for (const z of [0.2, -0.2]) { const e = box(0.12, 0.2, 0.06, fur, -0.12, 0.32, z, head); e.rotation.x = z > 0 ? 0.3 : -0.3; }
    cyl(0.3, 0.34, 0.12, mat('#3f86e8'), 0.32, 0.55, 0, b, 12).rotation.z = 0.6;
    const legs = [];
    for (const [x, z] of [[-0.3, 0.2], [-0.3, -0.2], [0.3, 0.2], [0.3, -0.2]]) legs.push(box(0.14, 0.24, 0.14, fur, x, 0.1, z, b));
    ball(0.12, fur, -0.55, 0.65, 0, b);
    return { root, b, legs, head };
  }

  function buildCrate(carry) {
    const icon = { water: '💦', bubble: '🫧', foam: '☁️', snow: '❄️', balloons: '🎈', potion: '🧪', heart: '❤️', treat: '🍪', coco: '🐵' }[carry];
    const root = new T.Group();
    const m = mat('#ffffff', { map: crateTexture(icon || '❓') });
    const b = box(1.2, 1.2, 1.2, m, 0, 0.6, 0, root);
    return { root, b };
  }

  function buildFoe(type, theme) {
    switch (type) {
      case 'windup': return buildWindup(false);
      case 'tosser': return buildWindup(true);
      case 'robot': return buildRobot(false);
      case 'raybot': return buildRobot(true);
      case 'flyer': return buildFlyer(theme);
      case 'zombie': return buildZombie(false);
      case 'zfarmer': return buildZombie(true);
      case 'crab': return buildCrab();
      case 'mummy': return buildMummy();
      case 'snowpup': return buildSnowpup();
      default: return buildCrate();
    }
  }

  // ---------------------------------------------------------------- bosses

  function buildBoss(kind) {
    const root = new T.Group();
    const v = { root, kind, parts: {} };
    const dark = mat('#14121f'), white = mat('#ffffff');
    if (kind === 'cranky') {
      // KING CRANKY: a giant tin wind-up king with a crown, a twirly mustache and two cork poppers
      const b = group(root);
      const tin = mat('#e8453c', { metalness: 0.35, roughness: 0.4 }), gold = mat('#ffd400', { metalness: 0.5, roughness: 0.3 });
      v.parts.legs = [];
      for (const z of [0.6, -0.6]) { const l = group(b, 0, 1.6, z); box(0.6, 1.6, 0.6, mat('#2a2a36'), 0, -0.8, 0, l); box(0.8, 0.3, 0.9, dark, 0.1, -1.55, 0, l); v.parts.legs.push(l); }
      box(2.6, 2.2, 2.0, tin, 0, 2.6, 0, b);
      box(2.7, 0.24, 2.1, gold, 0, 1.6, 0, b);
      for (const y of [2.2, 2.7, 3.2]) ball(0.14, gold, 1.32, y, 0, b);
      const head = group(b, 0, 4.25, 0);
      box(1.6, 1.2, 1.4, mat('#f2c49c'), 0, 0, 0, head);
      googly(head, 0.8, 0.2, 0.32, 0.26); googly(head, 0.8, 0.2, -0.32, 0.26);
      const mus = box(0.12, 0.2, 1.1, mat('#5a3a1e'), 0.82, -0.25, 0, head);
      for (const z of [0.6, -0.6]) { const c = ball(0.16, mat('#5a3a1e'), 0.82, -0.12, z, head); c.scale.set(0.6, 1, 1); }
      v.parts.mus = mus;
      crown(head, 2.4, 0.75);
      v.parts.key = windKey(b, -1.1, 2.7, 0, 2.6);
      v.parts.key.parent.rotation.y = Math.PI / 2;
      v.parts.arms = [];
      for (const z of [1.2, -1.2]) {
        const a = group(b, 0.2, 3.4, z);
        box(0.4, 1.4, 0.4, tin, 0, -0.6, 0, a);
        const pop = cyl(0.25, 0.3, 1.0, gold, 0.4, -1.3, 0, a, 12);
        pop.rotation.z = Math.PI / 2;
        a.rotation.z = 0.9;
        v.parts.arms.push(a);
      }
      v.parts.body = b;
    } else if (kind === 'crab') {
      const c = buildCrab(3.6, true);
      root.add(c.root);
      Object.assign(v.parts, c);
      v.parts.body = c.b;
    } else if (kind === 'wrappy') {
      // KING WRAPPY: a big, sleepy mummy on a floating golden throne with a striped headdress
      const b = group(root);
      const throne = group(b, 0, 0, 0);
      const gold = mat('#ffd400', { metalness: 0.5, roughness: 0.35 }), blue = mat('#2d5fb8');
      box(2.6, 0.5, 2, gold, 0, 0.25, 0, throne);
      box(0.5, 2.6, 2, gold, 1.1, 1.6, 0, throne);
      for (const z of [0.9, -0.9]) box(1.8, 0.4, 0.3, gold, 0, 0.8, z, throne);
      const m = buildPerson({ head: 'human', skin: CREAM, hair: 'short', hairColor: CREAM, shirt: 'tee', top: CREAM, bottom: CREAM, shoes: CREAM, brows: true, smile: true });
      redress(m.p.root, mat('#ffffff', { map: tex.bandage, roughness: 0.9 }), (m2) => !isCream(m2));
      m.p.root.scale.setScalar(1.9);
      m.p.root.position.set(0, 0.5, 0);
      m.root.rotation.y = FACE_L + 0.2;
      b.add(m.root);
      Kit.people.pose(m.p, 0, 'grab', 1);
      m.p.legL.rotation.x = m.p.legR.rotation.x = 1.4;
      // the striped headdress
      const hd = group(m.p.head, 0, 0.05, 0.05);
      for (let k = 0; k < 6; k++) box(0.6, 0.08, 0.62, k % 2 ? blue : gold, 0, 0.3 - k * 0.1, 0.02, hd);
      for (const x of [-0.32, 0.32]) for (let k = 0; k < 4; k++) box(0.08, 0.1, 0.5, k % 2 ? blue : gold, x, 0.1 - k * 0.11, 0.05, hd);
      v.parts.mummy = m;
      v.parts.body = b;
    } else if (kind === 'banana') {
      // BIG BANANA BOT: a banana-yellow blimp robot with a face screen and a ray dish underneath
      const b = group(root);
      const yel = mat('#ffe23d', { roughness: 0.45 }), brown = mat('#7a5a2e');
      const hull = ball(1.3, yel, 0, 1.3, 0, b);
      hull.scale.set(2, 0.95, 1);
      const tipL = cone(0.3, 0.6, brown, -2.75, 1.4, 0, b, 8); tipL.rotation.z = Math.PI / 2;
      const scr = box(1.4, 0.8, 0.1, mat('#2a2a36'), 0.9, 1.4, 1.22, b);
      const eye = basic('#5ef2ff');
      for (const x of [0.6, 1.2]) box(0.22, 0.28, 0.05, eye, x, 1.48, 1.28, b);
      box(0.6, 0.06, 0.05, eye, 0.9, 1.15, 1.28, b);
      void scr;
      const dish = group(b, 0, 0.25, 0);
      cyl(0.08, 0.08, 0.5, mat('#c0c4cc'), 0, 0, 0, dish, 8);
      const d = cone(0.6, 0.4, mat('#c0c4cc', { metalness: 0.5 }), 0, -0.4, 0, dish, 16);
      d.rotation.x = Math.PI;
      v.parts.glow = ball(0.18, basic('#ffe23d'), 0, -0.55, 0, dish);
      v.parts.props = [];
      for (const x of [-1.6, 1.6]) {
        const pr = group(b, x, 2.45, 0);
        cyl(0.05, 0.05, 0.3, mat('#2a2a36'), 0, -0.1, 0, pr, 6);
        const bl = group(pr, 0, 0.08, 0);
        for (let k = 0; k < 2; k++) { const bb = box(1.2, 0.05, 0.2, mat('#ff3d7f'), 0, 0, 0, bl); bb.rotation.y = k * Math.PI / 2; }
        v.parts.props.push(bl);
      }
      v.parts.body = b;
    } else if (kind === 'freeze') {
      // FREEZE-POP KING: a giant snowman on an ice sled with a crown of ice pops
      const b = group(root);
      const snow = mat('#f8fbff', { roughness: 0.9 });
      const sled = group(b);
      box(3.4, 0.25, 2, mat('#5ec8ff', { roughness: 0.2 }), 0, 0.35, 0, sled);
      for (const z of [0.8, -0.8]) { box(3.6, 0.1, 0.12, mat('#c0c4cc', { metalness: 0.6 }), 0, 0.08, z, sled); const tip = add(torGeo(0.25, 0.06, 6, 10, Math.PI), mat('#c0c4cc', { metalness: 0.6 }), 1.8, 0.33, z, sled); tip.rotation.z = -Math.PI / 2; }
      ball(1.3, snow, 0, 1.7, 0, b);
      ball(0.95, snow, 0, 3.3, 0, b);
      const head = group(b, 0, 4.55, 0);
      ball(0.72, snow, 0, 0, 0, head);
      for (const z of [0.25, -0.25]) { ball(0.1, dark, 0.62, 0.12, z, head); const br = box(0.06, 0.06, 0.3, mat('#5ec8ff'), 0.64, 0.3, z, head); br.rotation.x = z > 0 ? -0.4 : 0.4; }
      const nose = cone(0.12, 0.6, mat('#ff8a1f'), 0.9, -0.05, 0, head, 8);
      nose.rotation.z = -Math.PI / 2;
      for (let k = 0; k < 5; k++) ball(0.06, dark, 0.62, -0.3 + Math.sin((k / 4) * Math.PI) * -0.1, -0.24 + k * 0.12, head);
      const pops = group(head, 0, 0.62, 0);
      const cols = ['#ff4b5c', '#ffb02e', '#6fe05a', '#3fb3ff', '#ff7fbf'];
      cols.forEach((col, k) => { const a = (k / 5) * Math.PI * 2; const pp = box(0.22, 0.5, 0.12, mat(col, { roughness: 0.3 }), Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4, pops); pp.rotation.y = -a; box(0.04, 0.2, 0.04, mat('#f2d9a0'), 0, -0.32, 0, pp); });
      cyl(0.5, 0.5, 0.14, mat('#ffd400', { metalness: 0.5 }), 0, -0.05, 0, pops, 12);
      for (const y of [2.9, 3.3, 3.7]) ball(0.12, mat('#3fb3ff'), 0.92, y, 0, b);
      cyl(0.8, 0.9, 0.3, mat('#3f86e8'), 0, 3.95, 0, b, 16);
      const arm = group(b, 0.3, 3.4, 0.9);
      box(0.1, 0.1, 1.4, mat('#6b4423'), 0, 0, 0.5, arm).rotation.y = 0.4;
      v.parts.arm = arm;
      v.parts.head = head;
      v.parts.body = b;
    } else {
      // ZOMBIE ZORG: a giant cartoon zombie in a crown and cape, on top of a little toy castle
      const b = group(root);
      const castle = group(b);
      const stone = mat('#9d8fb8'), roof = mat('#ff3d7f');
      box(3.6, 1.6, 2.2, stone, 0, 0.8, 0, castle);
      for (let k = 0; k < 5; k++) box(0.5, 0.4, 2.2, stone, -1.5 + k * 0.75, 1.8, 0, castle);
      box(0.9, 1.0, 0.1, mat('#5a3a1e'), 1.0, 0.5, 1.12, castle);
      for (const x of [-1.6, 1.6]) { cyl(0.45, 0.45, 2.4, stone, x, 1.2, 0, castle, 10); cone(0.55, 0.8, roof, x, 2.8, 0, castle, 10); }
      const z = buildPerson(Object.assign({}, Kit.roster.get('zombie').look, { top: '#6d5a8c' }));
      z.p.root.scale.setScalar(2.1);
      z.p.root.position.set(0, 1.9, 0);
      z.root.rotation.y = FACE_L + 0.25;
      b.add(z.root);
      crown(z.p.head, 1, 0.42);
      const cape = box(0.9, 1.3, 0.06, mat('#c0392b'), 0, 0.15, 0.24, z.p.hips);
      cape.rotation.x = 0.15;
      v.parts.z = z;
      v.parts.body = b;
    }
    return v;
  }

  // ---------------------------------------------------------------- shots, items

  function shotView(b) {
    const k = b.kind;
    let s;
    const emo = { ball: '🏀', star: '✌️', balloon: '🎈', dunk: '🏀', pie: '🥧', banana: '🍌', punch: '👊', fist: '👊' }[k];
    if (emo) s = spriteOf(emoji(emo), b.r * 2.6);
    else if (k === 'water') s = spriteOf(tex.water, b.r * 2.4);
    else if (k === 'bubble' && b.team === 'p') s = spriteOf(tex.bubble, b.r * 2.6);
    else if (k === 'bubble') s = spriteOf(tex.grumpyBubble, (b.vr || b.r) * 2.4);
    else if (k === 'vulcan') s = spriteOf(tex.vulcan, b.r * 2.6);
    else if (k === 'foam') s = spriteOf(tex.foam, b.r * 2.6);
    else if (k === 'snow') s = spriteOf(tex.snowball, b.r * 2.4);
    else if (k === 'mini') s = spriteOf(tex.mini, b.r * 2.6);
    else if (k === 'bleh') s = spriteOf(tex.bleh, b.r * 2.5, { sx: 1.5 });
    else if (k === 'shell') s = spriteOf(emoji('🏀'), b.r * 3);
    else if (k === 'peacewave') s = spriteOf(tex.rainbow, b.r * 2.4);
    else if (k === 'cork') s = spriteOf(tex.cork, b.vr * 2.6);
    else if (k === 'bloop') s = spriteOf(tex.bloop, b.vr * 2.6);
    else if (k === 'drop') s = spriteOf(tex.drop, b.vr * 2.6);
    else if (k === 'dust') s = spriteOf(tex.dust, b.vr * 2.4);
    else if (k === 'ray') s = spriteOf(tex.ray, b.vr * 2.8);
    else if (k === 'ice') s = spriteOf(tex.ice, b.vr * 2.6);
    else if (k === 'goo') s = spriteOf(tex.goo, b.vr * 2.6, { sx: 1.4 });
    else if (k === 'wave') s = spriteOf(tex.wave, 1.4, { sx: 1.6 });
    else if (k === 'roll') {
      const g = new T.Group();
      const sb = ball(b.r, mat('#f8fbff', { roughness: 0.9 }), 0, 0, 0, g);
      for (const [x, y, z] of [[0.3, 0.4, 0.7], [-0.5, -0.2, 0.6], [0.1, -0.6, 0.6]]) ball(0.12, mat('#c8dcee'), x * b.r, y * b.r, z * b.r, sb);
      g.userData.spin = sb;
      return g;
    } else if (k === 'icicle') {
      const g = new T.Group();
      const c = cone(0.3, 1.2, mat('#bdf0ff', { roughness: 0.15, emissive: '#5ec8ff', emissiveIntensity: 0.3 }), 0, 0, 0, g, 8);
      c.rotation.x = Math.PI;
      g.userData.ice = c;
      return g;
    } else if (k === 'beam') {
      const g = new T.Group();
      const warn = spriteOf(tex.beamWarn, 12, { sx: 0.14 });
      warn.position.y = 6;
      g.add(warn);
      const on = spriteOf(tex.beam, 12, { sx: 0.16 });
      on.position.y = 6;
      on.material.blending = T.AdditiveBlending;
      g.add(on);
      g.userData.beam = { warn, on };
      return g;
    } else s = spriteOf(tex.dot, b.r * 2);
    return s;
  }

  const ITEM_EMOJI = { coin: null, star: '⭐', balloons: '🎈', heart: '❤️', potion: '🧪', coco: '🐵' };
  const TREAT_EMOJI = { icecream: '🍦', water: '💧', juice: '🧃', cookie: '🍪', watermelon: '🍉', banana: '🍌', donut: '🍩', candy: '🍬' };
  const GUN_EMOJI = { water: '💦', bubble: '🫧', foam: '☁️', snow: '❄️' };
  function itemView(it) {
    const g = new T.Group();
    let s;
    if (it.type === 'coin') s = spriteOf(tex.coin, 0.7);
    else if (it.type === 'treat') s = spriteOf(emoji(TREAT_EMOJI[it.treat] || '🍪'), it.gift ? 1.1 : 0.85);
    else if (GUN_EMOJI[it.type]) {
      s = spriteOf(tex['badge' + it.type] || (tex['badge' + it.type] = badgeTexture(GUN_EMOJI[it.type], '#3f86e8')), 1.2);
      const label = spriteOf(textTexture(Kit.lang ? Kit.lang.t(JUG.sim.GUNS[it.type].name) : JUG.sim.GUNS[it.type].name, '#ffd400', 512), 0.5, { sx: 5.3 });
      label.position.y = 1.0;
      g.add(label);
      g.userData.label = label;
    } else s = spriteOf(emoji(ITEM_EMOJI[it.type] || '⭐'), it.type === 'potion' || it.type === 'coco' ? 1.2 : 0.9);
    s.position.y = 0.45;
    g.add(s);
    const glow = spriteOf(tex.glow, 1.6);
    glow.position.y = 0.45;
    glow.material.opacity = it.type === 'coin' ? 0.25 : 0.55;
    glow.material.color.set(it.type === 'potion' ? '#9dff6a' : '#fff3a0');
    glow.renderOrder = -1;
    g.add(glow);
    g.userData.s = s;
    return g;
  }

  // ---------------------------------------------------------------- the world: sky, far hills, ground, props, ledges, vines

  const THEMES = {
    town: { sky: ['#5fb4f0', '#bfe6ff'], far: '#9fcfe8', far2: '#7fb8d8', top: '#6cc24a', top2: '#4fa83a', dirt: '#b5793f', dirt2: '#8a5a2b', fog: '#bfe6ff' },
    beach: { sky: ['#4fc3f7', '#fff3c4'], far: '#38b6e8', far2: '#1f8fc8', top: '#f5d98b', top2: '#e8c46a', dirt: '#e0b860', dirt2: '#c99a45', fog: '#fff3c4' },
    desert: { sky: ['#ffb24f', '#ffe9b8'], far: '#f2c27a', far2: '#e0a85a', top: '#ecc06a', top2: '#d9a34f', dirt: '#c98a45', dirt2: '#a86b33', fog: '#ffe9b8' },
    jungle: { sky: ['#5fc49a', '#e8ffd0'], far: '#3f9a5a', far2: '#2d7a45', top: '#5aa83a', top2: '#3f8a2a', dirt: '#7a5a2e', dirt2: '#5a3a1e', fog: '#d8f5c0' },
    snow: { sky: ['#6fbcf5', '#e0f2ff'], far: '#b8d8f2', far2: '#8fb8de', top: '#dfeaf7', top2: '#c4d8ee', dirt: '#93b4d8', dirt2: '#6f90bc', fog: '#e0f2ff' },
    farm: { sky: ['#6b4fa8', '#ffb07a'], far: '#5a4a8a', far2: '#463a72', top: '#6f9a3a', top2: '#557a2a', dirt: '#7a5a3a', dirt2: '#5a3f28', fog: '#c8a0c0' },
  };

  function skyTexture(th) {
    const [c, g] = G.makeCanvas(16, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    return G.toTexture(c);
  }

  // the far strip: hills, dunes, mountains or rooftops, painted once and tiled
  function farTexture(theme, th, layer) {
    const [c, g] = G.makeCanvas(1024, 256);
    const col = layer ? th.far2 : th.far;
    g.fillStyle = col;
    const base = 256;
    const rnd = JUG.sim.rng(theme.length * 31 + layer * 7);
    if (theme === 'town' && layer) {
      // rooftops
      let x = 0;
      while (x < 1024) {
        const w = 60 + rnd() * 70, h = 70 + rnd() * 90;
        g.fillRect(x, base - h, w, h);
        g.beginPath(); g.moveTo(x - 6, base - h); g.lineTo(x + w / 2, base - h - 34); g.lineTo(x + w + 6, base - h); g.fill();
        g.fillStyle = 'rgba(255,255,220,0.5)';
        for (let wy = base - h + 16; wy < base - 16; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 22) g.fillRect(wx, wy, 10, 12);
        g.fillStyle = col;
        x += w + 8;
      }
    } else if (theme === 'beach' && !layer) {
      g.fillRect(0, 150, 1024, 106); // the sea
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let k = 0; k < 30; k++) { const x = rnd() * 1024, y = 160 + rnd() * 80; g.fillRect(x, y, 30 + rnd() * 40, 4); }
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(700, 150); g.lineTo(740, 80); g.lineTo(745, 150); g.fill(); // a little sailboat
      g.fillStyle = '#ff3d7f'; g.fillRect(690, 150, 70, 10);
    } else if (theme === 'desert' && layer) {
      for (let k = 0; k < 4; k++) {
        const x = 80 + k * 260 + rnd() * 60, h = 90 + rnd() * 70;
        g.beginPath(); g.moveTo(x - h, base); g.lineTo(x, base - h); g.lineTo(x + h, base); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.1)'; g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + h, base); g.lineTo(x + h * 0.3, base); g.fill(); g.fillStyle = col;
      }
    } else if (theme === 'jungle') {
      for (let k = 0; k < 30; k++) { const x = (k / 30) * 1024 + rnd() * 20, r = 40 + rnd() * 50; g.beginPath(); g.arc(x, base - (layer ? 60 : 110) - rnd() * 40, r, 0, Math.PI * 2); g.fill(); }
      g.fillRect(0, base - (layer ? 70 : 120), 1024, 140);
    } else if (theme === 'snow' && !layer) {
      for (let k = 0; k < 5; k++) {
        const x = k * 220 + rnd() * 80, h = 140 + rnd() * 80;
        g.fillStyle = col; g.beginPath(); g.moveTo(x - h * 1.1, base); g.lineTo(x, base - h); g.lineTo(x + h * 1.1, base); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x - h * 0.3, base - h * 0.72); g.lineTo(x, base - h); g.lineTo(x + h * 0.3, base - h * 0.72); g.lineTo(x + 10, base - h * 0.78); g.lineTo(x - 12, base - h * 0.7); g.fill();
      }
    } else if (theme === 'farm' && !layer) {
      g.fillStyle = 'rgba(255,248,220,0.95)'; g.beginPath(); g.arc(760, 70, 44, 0, Math.PI * 2); g.fill(); // a big friendly moon
      g.fillStyle = col;
      g.beginPath(); g.moveTo(0, base);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, base - 80 - Math.sin(x / 120) * 30 - Math.sin(x / 47) * 10);
      g.lineTo(1024, base); g.fill();
    } else {
      g.beginPath(); g.moveTo(0, base);
      const amp = layer ? 40 : 70, mid = layer ? 70 : 120;
      for (let x = 0; x <= 1024; x += 16) g.lineTo(x, base - mid - Math.sin((x / 1024) * Math.PI * 4 + layer) * amp * 0.5 - Math.sin((x / 1024) * Math.PI * 10) * amp * 0.2);
      g.lineTo(1024, base); g.fill();
    }
    const t = G.toTexture(c);
    t.wrapS = T.RepeatWrapping;
    return t;
  }

  function groundTexture(th, theme) {
    const [c, g] = G.makeCanvas(512, 128);
    g.fillStyle = th.top; g.fillRect(0, 0, 512, 128);
    const rnd = JUG.sim.rng(theme.length * 13);
    g.fillStyle = th.top2;
    for (let k = 0; k < 140; k++) { const x = rnd() * 512, y = rnd() * 128; g.beginPath(); g.ellipse(x, y, 6 + rnd() * 10, 3 + rnd() * 4, 0, 0, Math.PI * 2); g.fill(); }
    if (theme === 'town' || theme === 'jungle' || theme === 'farm') {
      for (let k = 0; k < 40; k++) { const x = rnd() * 512, y = rnd() * 128; g.fillStyle = ['#ffffff', '#ffd400', '#ff7fbf'][k % 3]; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    }
    if (theme === 'beach') for (let k = 0; k < 14; k++) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(rnd() * 512, rnd() * 128, 3, 0, Math.PI * 2); g.fill(); }
    const t = G.toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  function dirtTexture(th) {
    const [c, g] = G.makeCanvas(256, 128);
    g.fillStyle = th.dirt; g.fillRect(0, 0, 256, 128);
    g.fillStyle = th.top; g.fillRect(0, 0, 256, 16);
    g.beginPath(); g.moveTo(0, 16);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 16 + (x / 16) % 2 * 8);
    g.lineTo(256, 0); g.lineTo(0, 0); g.fill();
    g.fillStyle = th.dirt2;
    for (let k = 0; k < 24; k++) { g.beginPath(); g.ellipse((k * 53) % 256, 40 + ((k * 37) % 80), 10, 6, 0, 0, Math.PI * 2); g.fill(); }
    const t = G.toTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  // props behind the action, one set per place
  const PROPS = {
    town: ['house', 'tree', 'house', 'lamp', 'tree', 'shop', 'fence'],
    beach: ['palm', 'umbrella', 'hut', 'palm', 'castle', 'tower'],
    desert: ['cactus', 'pyramid', 'rock', 'cactus', 'tent', 'palm'],
    jungle: ['bigtree', 'bush', 'fern', 'bigtree', 'rock', 'totem'],
    snow: ['pine', 'pine', 'igloo', 'snowfriend', 'rock', 'pine'],
    farm: ['barn', 'hay', 'pumpkin', 'fence', 'windmill', 'scarecrow', 'pumpkin'],
  };

  function prop(kind, rnd, th) {
    const g = new T.Group();
    const leaf = (c) => mat(c, { roughness: 0.85 });
    switch (kind) {
      case 'house': {
        const cols = ['#ff7fbf', '#ffd400', '#7fdcbd', '#9fd0ff', '#ffb07a'];
        const c = cols[Math.floor(rnd() * cols.length)];
        const w = 3 + rnd() * 1.5, h = 2.6 + rnd() * 1.4;
        box(w, h, 2.4, mat(c), 0, h / 2, 0, g);
        const roof = add(cached('roof', () => { const s = new T.Shape(); s.moveTo(-0.6, 0); s.lineTo(0, 0.55); s.lineTo(0.6, 0); s.lineTo(-0.6, 0); return new T.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); }), mat('#d9473a'), 0, h, -1.3, g);
        roof.scale.set(w * 0.95, 1.8, 2.6);
        for (const x of [-w / 4, w / 4]) { box(0.6, 0.6, 0.05, mat('#bfe6ff'), x, h * 0.65, 1.21, g); box(0.7, 0.08, 0.06, mat('#ffffff'), x, h * 0.65 - 0.34, 1.22, g); }
        box(0.7, 1.2, 0.05, mat('#7a4a24'), 0, 0.6, 1.21, g);
        break;
      }
      case 'shop': {
        box(4, 3, 2.4, mat('#ffffff'), 0, 1.5, 0, g);
        for (let k = 0; k < 6; k++) box(0.68, 0.3, 0.7, mat(k % 2 ? '#ff3d7f' : '#ffffff'), -1.7 + k * 0.68, 2.6, 1.4, g).rotation.x = 0.4;
        const s = new T.Mesh(new T.PlaneGeometry(2.6, 0.6), mat('#ffffff', { map: textTexture(Kit.lang ? Kit.lang.t('TOYS') : 'TOYS', '#ffd400') }));
        s.position.set(0, 3.3, 1.22); g.add(s);
        break;
      }
      case 'tree': cyl(0.2, 0.25, 1.6, mat('#7a4a24'), 0, 0.8, 0, g, 8); ball(1.2, leaf('#4fa83a'), 0, 2.4, 0, g); ball(0.8, leaf('#6cc24a'), 0.6, 2.9, 0.3, g); break;
      case 'lamp': cyl(0.08, 0.1, 3, mat('#2a2a36'), 0, 1.5, 0, g, 8); ball(0.28, basic('#fff3a0'), 0, 3.1, 0, g); break;
      case 'fence': for (let k = 0; k < 5; k++) box(0.15, 1, 0.1, mat('#ffffff'), -1.6 + k * 0.8, 0.5, 0, g); box(3.6, 0.12, 0.08, mat('#ffffff'), 0, 0.7, 0.06, g); break;
      case 'palm': {
        const trunk = group(g);
        for (let k = 0; k < 6; k++) { const s = cyl(0.18, 0.22, 0.7, mat('#a8763a'), k * 0.08, 0.35 + k * 0.65, 0, trunk, 8); s.rotation.z = -0.05 * k; }
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const l = box(1.8, 0.08, 0.5, leaf('#3fae4a'), Math.cos(a) * 0.8 + 0.5, 4.1, Math.sin(a) * 0.8, g); l.rotation.y = -a; l.rotation.z = -0.4; }
        ball(0.18, mat('#7a4a24'), 0.5, 3.9, 0.2, g); ball(0.18, mat('#7a4a24'), 0.3, 3.9, -0.2, g);
        break;
      }
      case 'umbrella': cyl(0.05, 0.05, 2.2, mat('#ffffff'), 0, 1.1, 0, g, 6); cone(1.4, 0.6, mat(rnd() < 0.5 ? '#ff3d7f' : '#ffd400'), 0, 2.4, 0, g, 8); box(1.6, 0.1, 0.8, mat('#18d4ff'), 0.8, 0.05, 0.8, g); break;
      case 'hut': box(2.6, 2, 2, mat('#e8c46a'), 0, 1, 0, g); cone(2.2, 1.4, mat('#c99a45'), 0, 2.7, 0, g, 4).rotation.y = Math.PI / 4; break;
      case 'castle': for (const [x, h] of [[-0.6, 0.8], [0, 1.2], [0.6, 0.8]]) { box(0.55, h, 0.55, mat(th.top2), x, h / 2, 0, g); } box(0.04, 0.5, 0.04, mat('#ffffff'), 0, 1.45, 0, g); box(0.3, 0.2, 0.02, mat('#ff3d7f'), 0.15, 1.6, 0, g); break;
      case 'tower': for (const x of [-0.6, 0.6]) box(0.12, 2.6, 0.12, mat('#ffffff'), x, 1.3, 0, g); box(1.6, 1, 1.4, mat('#ff4b5c'), 0, 3, 0, g); box(1.8, 0.1, 1.6, mat('#ffffff'), 0, 3.55, 0, g); break;
      case 'cactus': { const c = leaf('#4f9a3a'); cyl(0.3, 0.32, 2.4, c, 0, 1.2, 0, g, 10); for (const s of [-1, 1]) { const a = group(g, s * 0.3, 1.2 + s * 0.2, 0); cyl(0.18, 0.18, 0.5, c, s * 0.25, 0, 0, a, 8).rotation.z = Math.PI / 2; cyl(0.18, 0.18, 0.7, c, s * 0.5, 0.35, 0, a, 8); } ball(0.12, mat('#ff7fbf'), 0, 2.45, 0, g); break; }
      case 'pyramid': { const p = cone(2.4, 2.6, mat('#e0b060'), 0, 1.3, 0, g, 4); p.rotation.y = Math.PI / 4; break; }
      case 'rock': ball(0.9, mat(th.dirt2, { roughness: 1 }), 0, 0.4, 0, g).scale.set(1.3, 0.7, 1); break;
      case 'tent': cone(1.4, 1.8, mat('#ff8a1f'), 0, 0.9, 0, g, 4).rotation.y = Math.PI / 4; box(0.04, 0.5, 0.04, mat('#2a2a36'), 0, 2, 0, g); break;
      case 'bigtree': {
        cyl(0.5, 0.7, 6, mat('#6b4423'), 0, 3, 0, g, 10);
        for (const [x, y, r] of [[0, 6.2, 2], [-1.4, 5.6, 1.4], [1.4, 5.8, 1.5]]) ball(r, leaf('#2f8a3a'), x, y, 0, g);
        for (let k = 0; k < 3; k++) cyl(0.04, 0.04, 2.5, leaf('#4fae3a'), -1 + k, 4.4, 0.6, g, 5);
        break;
      }
      case 'bush': ball(0.9, leaf('#3f9a3a'), 0, 0.5, 0, g).scale.set(1.4, 0.8, 1); ball(0.6, leaf('#5aba4a'), 0.7, 0.6, 0.2, g); break;
      case 'fern': for (let k = 0; k < 5; k++) { const l = box(0.2, 1.4, 0.05, leaf('#4fae3a'), 0, 0.6, 0, g); l.rotation.z = -0.8 + k * 0.4; l.position.x = Math.sin(-0.8 + k * 0.4) * 0.6; } break;
      case 'totem': for (let k = 0; k < 3; k++) { box(0.9, 0.9, 0.9, mat(['#ff8a1f', '#3fb3ff', '#ff3d7f'][k]), 0, 0.45 + k * 0.9, 0, g); googly(g, 0, 0.55 + k * 0.9, 0.46, 0.12); } break;
      case 'pine': { const c = leaf('#2f7a4a'), s = mat('#ffffff', { roughness: 0.9 }); cyl(0.18, 0.22, 1, mat('#6b4423'), 0, 0.5, 0, g, 8); for (let k = 0; k < 3; k++) { cone(1.3 - k * 0.3, 1.4, c, 0, 1.4 + k * 0.9, 0, g, 9); cone(0.8 - k * 0.2, 0.5, s, 0, 1.9 + k * 0.9, 0, g, 9); } break; }
      case 'igloo': { const s = ball(1.4, mat('#f6faff', { roughness: 0.9 }), 0, 0, 0, g); s.scale.set(1, 0.85, 1); box(0.8, 0.8, 0.6, mat('#2a3a5a'), 0.6, 0.35, 1.0, g); break; }
      case 'snowfriend': { const s = mat('#ffffff', { roughness: 0.9 }); ball(0.7, s, 0, 0.6, 0, g); ball(0.5, s, 0, 1.5, 0, g); ball(0.38, s, 0, 2.2, 0, g); cone(0.06, 0.3, mat('#ff8a1f'), 0, 2.2, 0.45, g, 6).rotation.x = Math.PI / 2; cyl(0.4, 0.42, 0.12, mat('#ff3d7f'), 0, 1.9, 0, g, 12); break; }
      case 'barn': {
        box(4, 3, 3, mat('#d9473a'), 0, 1.5, 0, g);
        const roof = cone(3.1, 1.5, mat('#5a3a2e'), 0, 3.75, 0, g, 4); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.75);
        box(1.6, 1.8, 0.05, mat('#ffffff'), 0, 0.9, 1.51, g);
        box(0.08, 1.8, 0.06, mat('#d9473a'), 0, 0.9, 1.53, g).rotation.z = 0.7;
        break;
      }
      case 'hay': cyl(0.7, 0.7, 1.2, mat('#e8c25a'), 0, 0.7, 0, g, 14).rotation.x = Math.PI / 2; break;
      case 'pumpkin': { const p = ball(0.5, mat('#ff8a1f'), 0, 0.42, 0, g); p.scale.set(1.2, 0.85, 1.2); box(0.08, 0.2, 0.08, mat('#4f7a2a'), 0, 0.88, 0, g); box(0.1, 0.12, 0.03, basic('#ffe066'), -0.16, 0.48, 0.58, g); box(0.1, 0.12, 0.03, basic('#ffe066'), 0.16, 0.48, 0.58, g); box(0.3, 0.06, 0.03, basic('#ffe066'), 0, 0.3, 0.6, g); break; }
      case 'windmill': {
        box(1.2, 4, 1.2, mat('#ffffff'), 0, 2, 0, g);
        cone(1, 1, mat('#5a3a2e'), 0, 4.5, 0, g, 4).rotation.y = Math.PI / 4;
        const bl = group(g, 0, 3.6, 0.7);
        for (let k = 0; k < 4; k++) { const b = box(0.3, 2.2, 0.05, mat('#e8c25a'), 0, 1.1, 0, group(bl)); b.parent.rotation.z = (k * Math.PI) / 2; }
        g.userData.spin = bl;
        break;
      }
      case 'scarecrow': {
        // a silly scarecrow with a big grin, waving at the crows
        cyl(0.06, 0.06, 2.4, mat('#7a4a24'), 0, 1.2, 0, g, 6);
        box(1.6, 0.08, 0.08, mat('#7a4a24'), 0, 1.7, 0, g);
        box(0.6, 0.8, 0.3, mat('#4a86cf'), 0, 1.5, 0, g);
        ball(0.3, mat('#e8c25a'), 0, 2.2, 0, g);
        strawHat(group(g, 0, 2.2, 0), 1.1);
        box(0.25, 0.05, 0.02, mat('#14121f'), 0, 2.1, 0.3, g);
        break;
      }
    }
    return g;
  }

  // Builds one mission's place. Returns { tick(camX, camY, t), plats[], vines[] }.
  function makeWorld(scene, M, theme) {
    const th = THEMES[theme] || THEMES.town;
    const root = new T.Group();
    scene.add(root);
    scene.background = skyTexture(th);
    scene.fog = new T.Fog(th.fog, 60, 140);
    const far = [];
    for (let layer = 0; layer < 2; layer++) {
      const t = farTexture(theme, th, layer);
      const w = 300, h = layer ? 20 : 36;
      const m = new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false });
      t.repeat.set(w / (layer ? 60 : 90), 1);
      const pl = new T.Mesh(new T.PlaneGeometry(w, h), m);
      pl.position.set(0, h / 2 - 2.5, layer ? -30 : -55);
      pl.renderOrder = -10 + layer;
      root.add(pl);
      far.push({ pl, t, k: layer ? 0.55 : 0.8, w, rep: layer ? 60 : 90 });
    }
    // clouds (snowflakes on the snowy peaks, fireflies on the farm)
    const clouds = [];
    for (let k = 0; k < 14; k++) {
      const s = spriteOf(theme === 'farm' ? tex.glow : tex.dot, theme === 'farm' ? 0.6 : R(3, 6), { sx: theme === 'farm' ? 1 : 1.8 });
      s.material.opacity = theme === 'farm' ? 0.9 : 0.85;
      if (theme === 'farm') s.material.color.set('#fff3a0');
      s.position.set(R(-10, M.len + 20), theme === 'farm' ? R(2, 8) : R(9, 15), theme === 'farm' ? R(-4, 1) : R(-25, -15));
      root.add(s);
      clouds.push(s);
    }
    // the ground: a long strip with a painted top and a dirt front
    const len = M.len + 60;
    const topTex = groundTexture(th, theme);
    topTex.repeat.set(len / 8, 3);
    const frontTex = dirtTexture(th);
    frontTex.repeat.set(len / 6, 3);
    const top = mat('#ffffff', { map: topTex, roughness: 1 }), front = mat('#ffffff', { map: frontTex, roughness: 1 }), side = mat(th.dirt);
    const ground = new T.Mesh(new T.BoxGeometry(len, 10, 22), [side, side, top, side, front, side]);
    ground.position.set(M.len / 2, -5, -5);
    root.add(ground);
    // props in two rows behind
    const rnd = JUG.sim.rng(M.len + theme.length * 101);
    const list = PROPS[theme] || PROPS.town;
    const spinners = [];
    for (let x = -6; x < M.len + 20; x += 5 + rnd() * 6) {
      const kind = list[Math.floor(rnd() * list.length)];
      const p = prop(kind, rnd, th);
      const zz = -6 - rnd() * 6;
      p.position.set(x, 0, zz);
      p.rotation.y = (rnd() - 0.5) * 0.5;
      const s = 0.9 + rnd() * 0.4;
      p.scale.setScalar(s);
      root.add(p);
      if (p.userData.spin) spinners.push(p.userData.spin);
    }
    // little things in front of the action (flowers, shells, pebbles) for depth
    for (let x = -4; x < M.len + 10; x += 3 + rnd() * 5) {
      const c = theme === 'snow' ? '#ffffff' : theme === 'desert' ? '#c98a45' : theme === 'beach' ? '#ff7fbf' : ['#ffd400', '#ff7fbf', '#ffffff'][Math.floor(rnd() * 3)];
      ball(0.12 + rnd() * 0.1, mat(c), x, 0.05, 1.5 + rnd() * 1.5, root);
    }
    // ledges: wooden planks on posts (ice blocks on the snowy peaks)
    const plankM = theme === 'snow' ? mat('#bfe6ff', { roughness: 0.25 }) : mat('#c98a4b');
    const trimM = theme === 'snow' ? mat('#ffffff') : mat('#8a5a2b');
    for (const [x0, x1, y] of M.plats || []) {
      const w = x1 - x0;
      box(w, 0.4, 2.2, plankM, (x0 + x1) / 2, y - 0.2, 0, root);
      box(w + 0.1, 0.1, 2.3, trimM, (x0 + x1) / 2, y - 0.02, 0, root);
      for (const px of [x0 + 0.4, x1 - 0.4]) box(0.25, y - 0.4, 0.25, trimM, px, (y - 0.4) / 2, -0.6, root);
    }
    // vines for the monkey
    const vines = [];
    for (const [x, topY, l] of M.vines || []) {
      box(3, 0.4, 0.6, mat('#6b4423'), x, topY + 0.2, -0.4, root);
      ball(1, mat('#2f8a3a', { roughness: 0.9 }), x, topY + 0.8, -0.6, root).scale.set(1.8, 0.7, 1);
      const pivot = group(root, x, topY, 0);
      const vine = cyl(0.07, 0.07, l, mat('#4fae3a'), 0, -l / 2, 0, pivot, 6);
      for (let k = 1; k < 5; k++) { const lf = box(0.25, 0.08, 0.12, mat('#6cc24a'), 0.1, -l * (k / 5), 0, pivot); lf.rotation.z = k % 2 ? 0.5 : -0.5; }
      vines.push({ pivot, x, top: topY, len: l, vine });
    }
    return {
      root, vines,
      tick(camX, t, dt) {
        for (const f of far) {
          f.pl.position.x = camX;
          f.t.offset.x = (camX * f.k) / f.rep;
        }
        for (const s of spinners) s.rotation.z += dt * 1.5;
        if (theme === 'farm') clouds.forEach((s, k) => { s.material.opacity = 0.5 + 0.5 * Math.sin(t * 2 + k); });
      },
      dispose() {
        scene.remove(root);
        // the painted sky, hills and ground are this place's own (the shared materials stay cached)
        for (const tx of [scene.background, topTex, frontTex, ...far.map((f) => f.t)]) if (tx && tx.dispose) tx.dispose();
        for (const f of far) { f.pl.geometry.dispose(); f.pl.material.dispose(); }
        ground.geometry.dispose();
        top.dispose(); front.dispose();
      },
    };
  }

  // ---------------------------------------------------------------- effects: bursts, puffs, stars, confetti, points

  function makeFx(scene) {
    const pool = [];
    const live = [];
    function get(map) {
      let s = pool.pop();
      if (!s) { s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false })); }
      s.material.map = map;
      s.material.color.set('#ffffff');
      s.material.opacity = 1;
      s.material.rotation = 0;
      s.material.blending = T.NormalBlending;
      s.material.depthTest = true;
      s.material.needsUpdate = true;
      s.renderOrder = 5;
      s.visible = true;
      scene.add(s);
      return s;
    }
    // o: { map, x, y, z, vx, vy, life, size, grow, spin, g, drag, color, additive, fade, onTop, pop, sx }
    function add(o) {
      const s = get(o.map);
      if (o.color) s.material.color.set(o.color);
      if (o.additive) s.material.blending = T.AdditiveBlending;
      if (o.onTop) { s.material.depthTest = false; s.renderOrder = 9; }
      s.position.set(o.x, o.y, o.z || 0.5);
      const p = Object.assign({ s, vx: 0, vy: 0, life: 1, age: 0, size: 0.5, grow: 0, spin: 0, g: 0, drag: 0, fade: 0.4, rot: 0 }, o);
      s.scale.set(p.size * (p.sx || 1), p.size, 1);
      live.push(p);
      return p;
    }
    function update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.age += dt;
        if (p.age >= p.life) { p.s.visible = false; scene.remove(p.s); pool.push(p.s); live.splice(i, 1); continue; }
        p.vy -= p.g * dt;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= p.g ? 1 : d;
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        const k = p.age / p.life;
        let sc = p.size + p.grow * p.age;
        if (p.pop) sc *= k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : k < 0.25 ? 1.15 - ((k - 0.15) / 0.1) * 0.15 : 1;
        p.s.scale.set(sc * (p.sx || 1), sc, 1);
        p.rot += p.spin * dt;
        p.s.material.rotation = p.rot;
        p.s.material.opacity = (k > 1 - p.fade ? (1 - k) / p.fade : 1) * (p.alpha || 1);
      }
    }
    function clear() {
      for (const p of live) { p.s.visible = false; scene.remove(p.s); pool.push(p.s); }
      live.length = 0;
    }
    const api = {
      add, update, clear,
      puff(x, y, n = 6, color = '#ffffff', spread = 2) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          add({ map: tex.dot, x, y, vx: Math.cos(a) * R(0.5, spread), vy: Math.sin(a) * R(0.5, spread) + 0.5, life: R(0.4, 0.8), size: R(0.5, 0.9), grow: 1.2, drag: 3, color, fade: 0.7 });
        }
      },
      stars(x, y, n = 8, speed = 4) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
          add({ map: emoji('⭐'), x, y, vx: Math.cos(a) * R(1.5, speed), vy: Math.sin(a) * R(1.5, speed) + 2, g: 9, life: R(0.6, 1.0), size: R(0.3, 0.5), spin: R(-6, 6), fade: 0.4 });
        }
      },
      confetti(x, y, n = 30) {
        const cols = ['#ff3d7f', '#ffd400', '#18d4ff', '#7fdcbd', '#ff8a1f', '#9d6bff'];
        for (let i = 0; i < n; i++) add({ map: tex.dot, x: x + R(-1, 1), y, vx: R(-5, 5), vy: R(5, 12), g: 14, life: R(1, 1.8), size: R(0.18, 0.3), sx: 0.5, spin: R(-10, 10), color: cols[i % cols.length], fade: 0.3 });
      },
      word(x, y, text, fill, size = 1.7) {
        add({ map: burstTexture(text, fill), x, y, vy: 0.6, life: 0.85, size, pop: true, fade: 0.35, onTop: true, rot: R(-0.25, 0.25) });
      },
      points(x, y, n) {
        add({ map: textTexture(String(n), '#ffd400'), x, y, vy: 1.6, life: 0.9, size: 0.6, sx: 2.6, onTop: true, fade: 0.4 });
      },
      emoji(x, y, e, o = {}) { return add(Object.assign({ map: emoji(e), x, y, life: 1, size: 0.8, onTop: true }, o)); },
      splash(x, y, color = '#7fd4ff', n = 12) {
        for (let i = 0; i < n; i++) add({ map: tex.dot, x, y, vx: R(-4, 4), vy: R(3, 8), g: 18, life: R(0.4, 0.8), size: R(0.2, 0.4), color, fade: 0.5 });
      },
      ring(x, y, map, size = 1, life = 0.6, grow = 10) { add({ map: map || tex.ringWhite, x, y, life, size, grow, fade: 0.6, onTop: true }); },
    };
    return api;
  }

  JUG.art = {
    tex, mat, basic, box, ball, cyl, cone, group, spriteOf, emoji, burstTexture, textTexture, initTextures,
    buildHero, paintGun, buildFuzzbeard, buildBruno, buildCoco, buildFolk, buildRide, buildFoe, buildBoss, buildCrate,
    shotView, itemView, makeWorld, makeFx, FACE_R, FACE_L, THEMES, TREAT_EMOJI, GUN_EMOJI, ITEM_EMOJI,
  };
})();
