/* JuggernauT: the game. Sets up Three.js, runs the rules (js/sim.js) at a fixed 60 ticks a second, turns the rules'
   events into bursts, sounds, toasts and the HUD, and handles menus, keys and touch.
   Test hooks live on window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const T = THREE;
  const G = Kit.gfx;
  const A = JUG.art;
  const M = JUG.sim;
  const SFX = JUG.sfx;
  const $ = (id) => document.getElementById(id);
  const DT = 1 / 60;
  const VW = M.VW;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const t = (s) => (Kit.lang ? Kit.lang.t(s) : s);

  // ---------------------------------------------------------------- storage

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const SAVE = 'juggernauT.v1';
  const save = Object.assign({ level: 'easy', mission: 1, lastPlayers: ['teddy'], unlocked: { easy: 1, normal: 1 }, best: { easy: {}, normal: {} } }, store.get(SAVE, {}));
  save.unlocked = Object.assign({ easy: 1, normal: 1 }, save.unlocked);
  save.best = Object.assign({ easy: {}, normal: {} }, save.best);
  const writeSave = () => store.set(SAVE, save);

  // ---------------------------------------------------------------- renderer, scene, camera

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  const FOV = 32;
  const camera = new T.PerspectiveCamera(FOV, 16 / 9, 0.5, 400);
  scene.add(new T.HemisphereLight('#ffffff', '#6b5a3a', 0.95));
  const sun = new T.DirectionalLight('#fff3e0', 1.05);
  sun.position.set(-6, 14, 12);
  scene.add(sun, sun.target);

  A.initTextures();
  const fx = A.makeFx(scene);
  const actors = new T.Group();
  scene.add(actors);

  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (touch) document.body.classList.add('touch');

  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 152 });

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'loading', modeT: 0, time: 0, sim: null, demo: false, acc: 0,
    players: save.lastPlayers && save.lastPlayers.length ? save.lastPlayers : ['teddy'],
    level: save.level === 'normal' ? 'normal' : 'easy', mission: clamp(save.mission | 0, 1, 6),
    world: null, theme: null, frozen: false, keepAwake: false, quiet: false,
    toasts: [], banner: null, shake: 0, sfxAt: {}, celebrate: null, clearAt: 0, goT: 0, goCam: 0, view: { w: 1, h: 1 },
    force: [null, null], // test hook: hold a player's input (game.input)
  };

  // ---------------------------------------------------------------- views of the rules' things

  const V = {
    heroes: [], buddy: null, foes: new Map(), pools: {}, shots: new Map(), items: new Map(), pows: new Map(),
    drops: new Map(), folk: new Map(), birds: new Map(), rides: new Map(), coco: null, boss: null, marks: new Map(),
  };
  const shadowGeo = new T.PlaneGeometry(1, 1);
  function makeShadow(size) {
    const m = new T.Mesh(shadowGeo, new T.MeshBasicMaterial({ map: A.tex.shadow, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(size, size * 0.55, 1);
    m.renderOrder = 1;
    actors.add(m);
    return m;
  }
  function groundAt(S, x, y) {
    let g = 0;
    for (const p of S.plats) if (x > p.x0 && x < p.x1 && p.y <= y + 0.05 && p.y > g) g = p.y;
    return g;
  }
  function placeShadow(sh, S, x, y, on = true) {
    const g = groundAt(S, x, y);
    sh.visible = on;
    sh.position.set(x, g + 0.03, 0.1);
    const k = clamp(1 - (y - g) / 8, 0.35, 1);
    sh.material.opacity = k;
  }
  const turnTo = (cur, face, dt) => lerp(cur, face > 0 ? A.FACE_R : A.FACE_L, 1 - Math.exp(-14 * dt));

  function heroView(i, kind) {
    let hv = V.heroes[i];
    if (hv && hv.kind === kind) return hv;
    if (hv) disposeHero(hv);
    hv = V.heroes[i] = { kind, forms: {}, cur: null, rot: A.FACE_R, ph: 0, shadow: makeShadow(1.3), shield: A.spriteOf(A.tex.ringWhite, 3), stars: null, gun: null };
    hv.shield.material.color.set('#9fe8ff');
    hv.shield.visible = false;
    actors.add(hv.shield);
    return hv;
  }
  function disposeHero(hv) {
    for (const v of Object.values(hv.forms)) actors.remove(v.root);
    actors.remove(hv.shadow);
    actors.remove(hv.shield);
  }
  function formView(hv, form) {
    let v = hv.forms[form];
    if (!v) { v = hv.forms[form] = A.buildHero(hv.kind, form); actors.add(v.root); v.root.visible = false; }
    return v;
  }

  function poolGet(key, make) {
    const list = V.pools[key] || (V.pools[key] = []);
    const v = list.pop() || make();
    v.root.visible = true;
    actors.add(v.root);
    return v;
  }
  function poolPut(key, v) {
    actors.remove(v.root);
    (V.pools[key] || (V.pools[key] = [])).push(v);
  }

  function clearViews() {
    for (const hv of V.heroes) if (hv) disposeHero(hv);
    V.heroes.length = 0;
    if (V.buddy) { actors.remove(V.buddy.v.root); actors.remove(V.buddy.tag); actors.remove(V.buddy.shadow); V.buddy = null; }
    for (const [, fv] of V.foes) { poolPut(fv.key, fv.v); actors.remove(fv.shadow); if (fv.warn) actors.remove(fv.warn); }
    V.foes.clear();
    for (const m of [V.shots, V.items, V.pows, V.drops, V.folk, V.birds, V.rides, V.marks]) {
      for (const [, o] of m) { actors.remove(o.root || o); if (o.shadow) actors.remove(o.shadow); if (o.extra) actors.remove(o.extra); }
      m.clear();
    }
    if (V.coco) { actors.remove(V.coco.v.root); actors.remove(V.coco.shadow); V.coco = null; }
    fx.clear();
  }

  function foeKey(f) { return f.boss ? `boss-${f.boss}` : f.type === 'flyer' ? `flyer-${st.theme}` : f.type === 'crate' ? `crate-${f.carry}` : f.type; }

  function makeFoeView(f) {
    const key = foeKey(f);
    let v;
    if (f.boss) v = A.buildBoss(f.boss);
    else if (f.type === 'crate') v = A.buildCrate(f.carry);
    else v = poolGet(key, () => A.buildFoe(f.type, st.theme));
    if (f.boss || f.type === 'crate') actors.add(v.root);
    const fv = { key, v, ph: Math.random() * 6, shadow: makeShadow(f.boss ? f.w * 1.1 : Math.max(1, f.w * 1.3)), warn: null, rot: A.FACE_L, base: v.b ? v.b.scale.x : 1 };
    const warn = A.spriteOf(A.emoji('❗'), f.boss ? 1.4 : 0.8, { onTop: true });
    warn.visible = false;
    actors.add(warn);
    fv.warn = warn;
    V.foes.set(f.id, fv);
    return fv;
  }

  function dropFoe(id) {
    const fv = V.foes.get(id);
    if (!fv) return;
    if (fv.key.startsWith('boss') || fv.key.startsWith('crate')) actors.remove(fv.v.root);
    else poolPut(fv.key, fv.v);
    actors.remove(fv.shadow);
    actors.remove(fv.warn);
    V.foes.delete(id);
  }

  // keep the views in step with the rules: make the new ones, drop the gone ones
  function sweep(map, live, make, drop) {
    const seen = new Set();
    for (const o of live) {
      seen.add(o.id);
      if (!map.has(o.id)) map.set(o.id, make(o));
    }
    for (const [id, v] of map) if (!seen.has(id)) { drop(v); map.delete(id); }
  }
  const dropRoot = (v) => { actors.remove(v.root || v); if (v.shadow) actors.remove(v.shadow); if (v.extra) actors.remove(v.extra); };

  // ---------------------------------------------------------------- syncing views every frame

  const KP = Kit.people;

  function poseKit(p, ph, mode, dt) { KP.pose(p, ph, mode, 1 - Math.exp(-18 * dt)); }

  function aimArms(p, P, two = true) {
    const elev = Math.atan2(P.ay, Math.abs(P.ax) || 1e-4);
    const a = Math.PI / 2 + elev;
    p.armR.rotation.x = a;
    p.armR.rotation.z = 0;
    if (two) { p.armL.rotation.x = a - 0.1; p.armL.rotation.z = -0.35; }
  }

  function syncHero(S, P, dt) {
    const hv = heroView(P.i, P.kind);
    const F = M.FORMS[P.form];
    const v = formView(hv, P.form);
    if (hv.cur !== v) {
      if (hv.cur) hv.cur.root.visible = false;
      hv.cur = v;
      hv.gun = null;
    }
    const gun = F.gun || P.gun;
    if (hv.gun !== gun) { A.paintGun(v, gun); hv.gun = gun; }
    const party = st.celebrate && st.mode === 'celebrate';
    // celebrating: turn round to face you (the camera side is halfway between facing right and facing left)
    hv.rot = party ? lerp(hv.rot, -Math.PI, 1 - Math.exp(-6 * dt)) : turnTo(hv.rot, P.face, dt);
    v.root.rotation.y = P.form === 'snow' ? Math.PI + (P.face > 0 ? -0.5 : 0.5) : hv.rot;
    hv.ph += dt * (Math.abs(P.vx) * 1.7 + 1.5);
    const Vh = P.veh;
    let x = P.x, y = P.y;
    if (Vh) { const off = { tank: 0.62, llama: 1.0, mech: 1.3 }[Vh.type]; x = Vh.x - 0.1 * Vh.face; y = Vh.y + off; }
    if (v.gun) v.gun.root.visible = !Vh && gun !== 'bleh';
    v.root.position.set(x, y, 0);
    v.root.scale.set(1, 1, 1);
    const blink = P.invulnT > 0 && P.shieldT <= 0 && !P.out && st.mode === 'play' && Math.floor(st.time * 12) % 2 === 0;
    v.root.visible = !blink;
    const p = v.p;
    if (p) {
      let mode = 'stand';
      if (P.out) mode = 'fall';
      else if (P.sigT > 0 && P.sig) mode = P.sig;
      else if (Vh || P.vine) mode = 'stand';
      else if (!P.ground) mode = 'jump';
      else if (Math.abs(P.vx) > 0.6) mode = P.form === 'zombie' || P.form === 'mummy' || P.form === 'chubby' ? 'walk' : 'run';
      if (party) mode = st.celebrate.t > 1.8 && st.celebrate.sig2[P.i] ? st.celebrate.sig2[P.i] : st.celebrate.sig[P.i] || 'wave';
      poseKit(p, hv.ph, mode, dt);
      if (!P.out && !(P.sigT > 0) && !party && P.form !== 'zombie') aimArms(p, P);
      if (party && mode !== 'boxing') v.root.position.y = y + Math.abs(Math.sin(st.time * 6 + P.i)) * 0.35;
      if (P.vine) { p.armR.rotation.x = p.armL.rotation.x = Math.PI; p.armL.rotation.z = p.armR.rotation.z = 0; p.legL.rotation.x = 0.3; p.legR.rotation.x = -0.2; }
      if (Vh && Vh.type === 'llama') { p.legL.rotation.x = p.legR.rotation.x = 1.3; p.legL.rotation.z = -0.4; p.legR.rotation.z = 0.4; }
      if (P.out) { p.rig.rotation.z = lerp(p.rig.rotation.z, -1.45, 1 - Math.exp(-8 * dt)); v.root.position.y = y + 0.1; }
      else p.rig.rotation.z = 0;
      const crouch = P.crouch && !Vh;
      v.root.scale.y = crouch ? 0.68 : 1;
      if (P.form === 'chubby') { const w = 1 + Math.sin(st.time * 9) * 0.03; v.root.scale.x = w; v.root.scale.z = w; }
      if (P.form === 'zombie') v.root.rotation.z = Math.sin(P.wobble || 0) * 0.08;
      else v.root.rotation.z = 0;
      if (v.extra.tail) v.extra.tail.rotation.x = -0.3 + Math.sin(st.time * 6) * 0.25;
      if (v.extra.ends) v.extra.ends.forEach((e, k) => { e.rotation.x = Math.sin(st.time * 7 + k) * 0.4; });
    } else if (v.roll) {
      v.roll.rotation.z -= (P.vx * dt) / 0.72;
      v.body.position.y = P.ground ? Math.abs(Math.sin(st.time * 10)) * 0.05 : 0;
    }
    // dizzy stars when bonked out, the team-up shield
    if (P.out && !hv.stars) {
      hv.stars = fx.add({ map: A.emoji('💫'), x, y: y + 1.2, life: 999, size: 0.9, onTop: true });
    }
    if (hv.stars) {
      if (!P.out) { hv.stars.life = 0; hv.stars = null; }
      else { hv.stars.s.position.set(x, y + 1.0 + Math.sin(st.time * 4) * 0.1, 0.6); hv.stars.rot = st.time * 2; }
    }
    hv.shield.visible = P.shieldT > 0 && !P.out;
    if (hv.shield.visible) { hv.shield.position.set(x, y + 1, 0.4); const s = 2.8 + Math.sin(st.time * 8) * 0.12; hv.shield.scale.set(s, s, 1); }
    placeShadow(hv.shadow, S, Vh ? Vh.x : P.x, Vh ? Vh.y : P.y, !Vh);
  }

  function syncBuddy(S, dt) {
    const B = S.buddy;
    if (!B) {
      if (V.buddy) { actors.remove(V.buddy.v.root); actors.remove(V.buddy.tag); actors.remove(V.buddy.shadow); actors.remove(V.buddy.save); V.buddy = null; }
      return;
    }
    if (!V.buddy || V.buddy.kind !== B.kind) {
      if (V.buddy) { actors.remove(V.buddy.v.root); actors.remove(V.buddy.tag); actors.remove(V.buddy.shadow); actors.remove(V.buddy.save); }
      const v = A.buildHero(B.kind, 'normal');
      A.paintGun(v, B.kind === 'tommy' ? 'star' : 'ball');
      const entry = Kit.roster.get(B.kind);
      v.root.scale.setScalar(entry.buddyScale || 0.8);
      actors.add(v.root);
      const tag = G.nameTag(NAMES[B.kind], entry.tag || '#ffb02e');
      actors.add(tag);
      const save = A.spriteOf(A.emoji('🛡️'), 1, { onTop: true });
      save.visible = false;
      actors.add(save);
      V.buddy = { kind: B.kind, v, tag, shadow: makeShadow(1.1), save, rot: A.FACE_R, ph: 0, sc: entry.buddyScale || 0.8 };
    }
    const bv = V.buddy, v = bv.v, p = v.p;
    bv.rot = turnTo(bv.rot, B.face, dt);
    v.root.rotation.y = B.sigT > 0 && B.sig === 'peace' ? lerp(v.root.rotation.y, -Math.PI, 0.2) : bv.rot;
    v.root.position.set(B.x, B.y, 0);
    bv.ph += dt * (Math.abs(B.vx) * 1.7 + 1.5);
    let mode = 'stand';
    if (B.sigT > 0 && B.sig) mode = B.sig;
    else if (B.phase === 'bye') mode = B.sig || 'wave';
    else if (!B.ground) mode = 'jump';
    else if (Math.abs(B.vx) > 0.6 || B.phase === 'in' || B.phase === 'out') mode = 'run';
    poseKit(p, bv.ph, mode, dt);
    if (mode === 'stand' || mode === 'run' || mode === 'jump') {
      const f = S.nearestFoe(B.x, B.y + 1, 14);
      if (f) aimArms(p, { ax: Math.cos(Math.atan2(f.y + f.h / 2 - B.y - 1.2, Math.abs(f.x - B.x))), ay: Math.sin(Math.atan2(f.y + f.h / 2 - B.y - 1.2, Math.abs(f.x - B.x))) });
    }
    bv.tag.position.set(B.x, B.y + 2.25 * bv.sc + 0.35, 0.3);
    bv.save.visible = B.saveT > 0;
    if (bv.save.visible) { bv.save.position.set(B.x + B.face * 0.6, B.y + 1.3, 0.8); const s = 1 + (0.6 - B.saveT) * 1.2; bv.save.scale.set(s, s, 1); }
    placeShadow(bv.shadow, S, B.x, B.y);
  }

  function syncFoes(S, dt) {
    const live = new Set();
    for (const f of S.foes) {
      if (f.dead) continue;
      live.add(f.id);
      const fv = V.foes.get(f.id) || makeFoeView(f);
      const v = fv.v;
      fv.ph += dt * (Math.abs(f.vx) * 2.2 + 1.5);
      v.root.position.set(f.x, f.y, 0);
      const hit = f.flashT > 0;
      const sc = hit ? 1.08 : 1;
      if (f.boss) syncBoss(S, f, fv, dt);
      else if (v.p) {
        fv.rot = turnTo(fv.rot, f.face, dt);
        v.root.rotation.y = fv.rot;
        const mode = !f.ground ? 'jump' : Math.abs(f.vx) > 0.3 ? 'walk' : 'stand';
        poseKit(v.p, fv.ph, mode, dt);
        if (f.type === 'robot' || f.type === 'raybot') { v.p.armR.rotation.x = Math.PI / 2 + (f.wind > 0 ? -0.3 : 0); }
        v.root.scale.setScalar(sc);
        if (f.chillT > 0) v.root.rotation.z = Math.sin(st.time * 40) * 0.03;
      } else if (v.b) {
        v.b.scale.x = Math.abs(fv.base) * (f.face > 0 ? 1 : -1) * sc;
        v.b.scale.y = Math.abs(fv.base) * sc;
        if (v.legs) v.legs.forEach((l, k) => { l.rotation.z = Math.sin(fv.ph * 3 + k * 1.7) * (Math.abs(f.vx) > 0.3 ? 0.5 : 0.05); });
        if (v.spin) v.spin.rotation.y += dt * 12;
        if (v.key) v.key.rotation.z += dt * 4;
        if (f.type === 'snowpup') v.b.scale.y = (f.ground ? 1 - Math.abs(Math.sin(fv.ph * 2)) * 0.06 : 1.1) * sc;
        if (f.type === 'crab' && v.claws) v.claws.forEach((c, k) => { c.top.rotation.z = Math.abs(Math.sin(st.time * 6 + k)) * 0.4; });
        if (f.type === 'flyer') v.b.position.y = Math.sin(st.time * 3 + fv.ph) * 0.1;
        if (f.wind > 0) v.b.position.x = Math.sin(st.time * 50) * 0.04;
        else v.b.position.x = 0;
      }
      fv.warn.visible = f.wind > 0 || (!!f.boss && f.state === 'wind');
      if (fv.warn.visible) fv.warn.position.set(f.x, f.y + f.h + (f.boss ? 0.9 : 0.5) + Math.sin(st.time * 12) * 0.08, 0.8);
      placeShadow(fv.shadow, S, f.x, f.y, !f.air || f.boss === 'banana' || f.type === 'flyer');
      if (f.type === 'flyer') fv.shadow.scale.set(1.2, 0.5, 1);
    }
    for (const [id] of V.foes) if (!live.has(id)) dropFoe(id);
  }

  function syncBoss(S, f, fv, dt) {
    const v = fv.v, P = v.parts;
    const face = f.face;
    const t2 = st.time;
    const wind = f.state === 'wind';
    const shake = wind ? Math.sin(t2 * 40) * 0.06 : 0;
    v.root.position.x += shake;
    const flash = f.flashT > 0;
    if (P.body) {
      if (f.boss === 'cranky' || f.boss === 'banana' || f.boss === 'freeze') P.body.scale.x = face > 0 ? 1 : -1;
      if (f.boss === 'crab') P.body.scale.set(3.6 * (face > 0 ? 1 : -1), 3.6, 3.6);
      P.body.scale.y = Math.abs(P.body.scale.y) * (flash ? 1.03 : 1) / (P.flashed ? 1.03 : 1);
      P.flashed = flash;
    }
    if (f.boss === 'cranky') {
      P.legs.forEach((l, k) => { l.rotation.z = Math.abs(f.vx) > 0.2 ? Math.sin(fv.ph * 2 + k * Math.PI) * 0.35 : 0; });
      P.key.rotation.z += dt * (wind ? 14 : 3);
      P.arms.forEach((a, k) => { a.rotation.z = wind && f.atk === 'corks' ? 1.6 : wind && f.atk === 'stomp' ? 2.6 : 0.9 + Math.sin(t2 * 2 + k) * 0.1; });
      if (wind && f.atk === 'stomp') P.legs[0].rotation.z = -0.7;
      P.mus.rotation.x = Math.sin(t2 * 5) * 0.1;
    } else if (f.boss === 'crab') {
      P.legs.forEach((l, k) => { l.rotation.z = Math.sin(t2 * 14 + k) * (Math.abs(f.vx) > 0.5 ? 0.5 : 0.08); });
      P.claws.forEach((c, k) => { c.top.rotation.z = wind || f.atk === 'snap' ? Math.abs(Math.sin(t2 * 16 + k)) * 0.7 : Math.abs(Math.sin(t2 * 3 + k)) * 0.3; c.c.rotation.z = wind ? 0.6 : 0; });
      P.eyes.forEach((e, k) => { e.rotation.z = Math.sin(t2 * 4 + k) * 0.2; });
    } else if (f.boss === 'wrappy') {
      P.body.position.y = Math.sin(t2 * 1.6) * 0.15;
      const m = P.mummy.p;
      m.armR.rotation.x = wind ? 2.6 : 1.4 + Math.sin(t2 * 2) * 0.1;
      m.armL.rotation.x = wind ? 2.4 : 1.4 + Math.cos(t2 * 2) * 0.1;
      m.head.rotation.z = Math.sin(t2 * 1.2) * 0.1;
    } else if (f.boss === 'banana') {
      P.props.forEach((pr) => { pr.rotation.y += dt * 20; });
      P.glow.scale.setScalar(wind ? 1.6 + Math.sin(t2 * 30) * 0.4 : 1);
      P.body.rotation.z = Math.sin(t2 * 1.3) * 0.05;
    } else if (f.boss === 'freeze') {
      P.head.rotation.z = Math.sin(t2 * 2) * 0.08;
      P.arm.rotation.z = wind ? -1 : Math.sin(t2 * 2) * 0.2;
    } else if (f.boss === 'zorg') {
      const z = P.z.p;
      poseKit(z, fv.ph, Math.abs(f.vx) > 0.2 ? 'walk' : 'stand', dt);
      if (wind) { z.armR.rotation.x = 2.8; z.armL.rotation.x = 2.6; }
      z.head.rotation.x = wind ? -0.3 : 0.15 + Math.sin(t2 * 3) * 0.08;
    }
    // where the crab boss is going to land
    if (f.boss === 'crab' && f.state === 'act' && f.atk === 'leap' && !f.ground) {
      let mk = V.marks.get('leap');
      if (!mk) { mk = makeShadow(4.5); mk.material.color.set('#ff4b5c'); V.marks.set('leap', mk); }
      mk.visible = true;
      mk.position.set(f.landX, 0.05, 0.2);
    } else { const mk = V.marks.get('leap'); if (mk) mk.visible = false; }
  }

  function syncShots(S, dt) {
    const live = S.shots.concat(S.fshots);
    sweep(V.shots, live, (b) => { const s = A.shotView(b); actors.add(s); return s; }, dropRoot);
    for (const b of live) {
      const s = V.shots.get(b.id);
      if (!s) continue;
      s.position.set(b.x, b.y, 0.4);
      if (s.isSprite) {
        if (b.kind === 'ball' || b.kind === 'shell' || b.kind === 'dunk' || b.kind === 'pie' || b.kind === 'banana' || b.kind === 'cork' || b.kind === 'balloon') s.material.rotation += dt * (b.vx > 0 ? -10 : 10);
        if (b.kind === 'star') s.material.rotation = Math.sin(st.time * 10) * 0.3;
        if (b.kind === 'bleh' || b.kind === 'punch' || b.kind === 'fist') s.scale.x = Math.abs(s.scale.x) * (b.vx < 0 ? -1 : 1);
        if (b.kind === 'peacewave') { s.material.rotation = st.time * 4; }
        if (b.kind === 'bleh') { const k = 1 + Math.sin(st.time * 18) * 0.06; s.scale.y = b.r * 2.5 * k; }
        if (b.kind === 'wave') { s.position.y = 0.55; s.scale.x = 1.6 * (b.vx < 0 ? -1 : 1) * 1.4; }
        if (b.kind === 'dust') s.material.rotation = Math.sin(st.time * 3 + b.id) * 0.3;
      } else {
        const u = s.userData;
        if (u.spin) u.spin.rotation.z -= (b.vx * dt) / b.r;
        if (u.beam) {
          const on = b.t >= b.warn;
          u.beam.warn.visible = !on;
          u.beam.on.visible = on;
          s.position.y = 0;
          if (!on) u.beam.warn.material.opacity = 0.55 + 0.45 * Math.sin(st.time * 18);
        }
        if (u.ice) {
          if (b.t < b.warn) {
            s.position.y = 11 + Math.sin(st.time * 30) * 0.05;
            let mk = V.marks.get(b.id);
            if (!mk) { mk = makeShadow(1.4); mk.material.color.set('#2a6fa8'); V.marks.set(b.id, mk); }
            mk.position.set(b.x, 0.05, 0.2);
            mk.scale.setScalar(1.2 + (b.t / b.warn) * 0.6);
            mk.scale.y *= 0.55;
          }
        }
      }
    }
    for (const [id, mk] of V.marks) if (typeof id === 'number' && !S.fshots.some((b) => b.id === id && b.t < b.warn)) { actors.remove(mk); V.marks.delete(id); }
  }

  function syncItems(S) {
    sweep(V.items, S.items, (it) => { const g = A.itemView(it); actors.add(g); return g; }, dropRoot);
    for (const it of S.items) {
      const g = V.items.get(it.id);
      if (!g) continue;
      g.position.set(it.x, it.y + (it.ground ? Math.sin(st.time * 4 + it.id) * 0.08 : 0), 0.3);
      const s = g.userData.s;
      if (it.type === 'coin') s.scale.x = 0.7 * Math.abs(Math.cos(st.time * 4 + it.id));
      g.visible = !(it.life - it.t < 2 && !it.gift && Math.floor(st.time * 10) % 2 === 0);
    }
  }

  function syncCast(S, dt) {
    // Fuzzbeards
    sweep(V.pows, S.pows, (pw) => {
      const v = A.buildFuzzbeard(((pw.id * 0.37) % 1));
      actors.add(v.root);
      v.help = A.spriteOf(A.textTexture(t('HELP!'), '#ffd400'), 0.55, { sx: 2.6, onTop: true });
      v.root.add(v.help);
      v.help.position.set(0, 2.6, 0);
      v.shadow = makeShadow(1.1);
      v.ph = Math.random() * 6;
      v.rot = A.FACE_L;
      return v;
    }, (v) => { actors.remove(v.root); actors.remove(v.shadow); });
    for (const pw of S.pows) {
      const v = V.pows.get(pw.id);
      if (!v) continue;
      const p = v.p;
      v.ph += dt * 6;
      v.root.position.set(pw.x, pw.y, -0.2);
      const tied = pw.state === 'tied';
      v.ribbon.visible = tied;
      v.post.visible = tied || pw.state === 'free';
      v.help.visible = tied && Math.floor(st.time * 2) % 2 === 0;
      if (pw.state === 'free') { v.post.rotation.z = Math.min(1.4, pw.t * 3); v.post.position.x = 0.3; }
      if (tied) {
        v.p.root.rotation.y = Math.PI + Math.sin(st.time * 5) * 0.15;
        poseKit(p, v.ph, 'stand', dt);
        p.armL.rotation.x = p.armR.rotation.x = -0.3;
        p.root.position.y = 0;
      } else {
        v.rot = turnTo(v.rot, pw.face, dt);
        v.p.root.rotation.y = v.rot;
        if (pw.state === 'free') { poseKit(p, v.ph, 'jump', dt); p.root.position.y = Math.sin(Math.min(1, pw.t / 0.8) * Math.PI) * 1.2; }
        else if (pw.state === 'salute') {
          poseKit(p, v.ph, 'stand', dt);
          p.root.position.y = 0;
          v.p.root.rotation.y = lerp(v.p.root.rotation.y, -Math.PI + 0.3, 0.3);
          p.armR.rotation.x = 2.7; p.armR.rotation.z = 0.9; // the salute
        } else { poseKit(p, v.ph, 'run', dt); p.root.position.y = 0; }
      }
      placeShadow(v.shadow, S, pw.x, pw.y);
    }
    // Bruno's balloon drops
    sweep(V.drops, S.drops, () => { const v = A.buildBruno(); actors.add(v.root); return v; }, dropRoot);
    for (const d of S.drops) {
      const v = V.drops.get(d.id);
      if (!v) continue;
      v.root.position.set(d.x, d.y - 1.5, -0.6);
      v.crate.visible = d.state === 'down';
      v.root.rotation.z = Math.sin(st.time * 1.5 + d.id) * 0.08;
      poseKit(v.p, st.time * 3, d.state === 'down' ? 'grab' : 'wave', dt);
    }
    // Coco
    const C = S.coco;
    if (C && !V.coco) { const v = A.buildCoco(); actors.add(v.root); V.coco = { v, shadow: makeShadow(0.8), rot: A.FACE_R, ph: 0 }; }
    if (!C && V.coco) { actors.remove(V.coco.v.root); actors.remove(V.coco.shadow); V.coco = null; }
    if (C && V.coco) {
      const cv = V.coco, p = cv.v.p;
      cv.rot = turnTo(cv.rot, C.face, dt);
      cv.v.root.rotation.y = C.state === 'bye' && C.t < 1 ? -Math.PI : cv.rot;
      cv.v.root.position.set(C.x, C.y, 0.3);
      cv.ph += dt * (Math.abs(C.vx) * 3 + 2);
      poseKit(p, cv.ph, C.state === 'bye' ? 'wave' : !C.ground ? 'jump' : Math.abs(C.vx) > 0.6 ? 'run' : 'stand', dt);
      if (C.state !== 'bye') p.armR.rotation.x = Math.PI / 2;
      placeShadow(cv.shadow, S, C.x, C.y);
    }
    // villagers, farmers and camels
    sweep(V.folk, S.folk, (fk) => { const v = A.buildFolk(fk.kind, fk.seed); actors.add(v.root); v.ph = fk.seed * 9; return v; }, dropRoot);
    for (const fk of S.folk) {
      const v = V.folk.get(fk.id);
      if (!v) continue;
      v.root.position.set(fk.x, 0, fk.z);
      if (v.camel) { v.camel.rotation.y = -0.4; v.camel.position.y = Math.sin(st.time * 2 + fk.seed * 9) * 0.03; continue; }
      const cheer = fk.cheerT > 0;
      v.p.root.rotation.y = Math.PI + Math.sin(st.time * 0.7 + fk.seed * 6) * 0.3;
      v.ph += dt * 5;
      poseKit(v.p, v.ph, cheer ? (fk.seed > 0.5 ? 'peace' : 'wave') : 'stand', dt);
      v.p.root.position.y = cheer ? Math.abs(Math.sin(st.time * 8 + fk.seed * 5)) * 0.4 : 0;
    }
    // birds
    sweep(V.birds, S.birds, (b) => makeBird(b), dropRoot);
    for (const b of S.birds) {
      const v = V.birds.get(b.id);
      if (!v) continue;
      v.root.position.set(b.x, b.y + 0.05, -1 + b.seed);
      const fly = b.state === 'fly';
      const flap = fly ? Math.sin(st.time * 30 + b.seed * 9) * 0.9 : 0;
      v.wings.forEach((w, k) => { w.rotation.x = (k ? 1 : -1) * (0.2 + flap); });
      v.root.rotation.z = fly ? -0.2 : 0;
      v.head.rotation.z = fly ? 0 : Math.max(0, Math.sin(st.time * 3 + b.seed * 9)) * 0.8;
    }
    // rides
    sweep(V.rides, S.rides, (r) => { const v = A.buildRide(r.type, r.type === 'tank' ? '#3f86e8' : undefined); actors.add(v.root); v.shadow = makeShadow(r.type === 'tank' ? 3 : 2.4); v.ph = 0; return v; }, (v) => { actors.remove(v.root); actors.remove(v.shadow); });
    for (const r of S.rides) {
      const v = V.rides.get(r.id);
      if (!v) continue;
      v.root.position.set(r.x, r.y, 0);
      const pr = v.parts;
      pr.body.scale.x = r.face > 0 ? 1 : -1;
      v.ph += dt * Math.abs(r.vx) * 2;
      if (r.type === 'tank') {
        pr.wheels.forEach((w) => { w.rotation.y -= r.vx * dt * 3 * (r.face > 0 ? 1 : -1); });
        const local = r.face > 0 ? r.aimA : Math.PI - r.aimA;
        pr.gun.rotation.z = local;
        pr.body.scale.y = r.squat ? 0.75 : 1;
        pr.hatch.visible = !r.rider;
      } else if (r.type === 'llama') {
        pr.legs.forEach((l, k) => { l.rotation.z = Math.abs(r.vx) > 0.3 ? Math.sin(v.ph * 2 + k * 1.6) * 0.6 : 0; });
        pr.neck.rotation.z = Math.sin(st.time * 2) * 0.08 + (r.ground ? 0 : 0.3);
        pr.gun.rotation.z = r.rider && r.rider.ay > 0.5 ? (r.rider.ax ? 0.78 : 1.57) : 0;
      } else {
        pr.legs.forEach((l) => { l.scale.y = r.ground ? 1 : 1.25; });
        pr.cab.position.y = 2 + (r.ground ? Math.abs(Math.sin(v.ph * 2)) * 0.12 : 0.2);
        const rd = r.rider;
        const ang = rd ? Math.atan2(rd.ay, Math.abs(rd.ax) || 1e-4) : 0;
        pr.arm.rotation.z = ang;
      }
      // about to break: smoke and a red blink
      if (r.hp <= 1 && r.state !== 'bomb' && Math.random() < dt * 8) fx.add({ map: A.tex.dot, x: r.x + (Math.random() - 0.5), y: r.y + 2, vx: Math.random() - 0.5, vy: 2, life: 0.9, size: 0.6, grow: 1.4, color: '#777788', fade: 0.7 });
      v.root.visible = !(r.invulnT > 0 && Math.floor(st.time * 12) % 2 === 0) || r.state === 'bomb';
      if (r.state === 'bomb') { v.root.rotation.z = Math.sin(st.time * 30) * 0.06; }
      placeShadow(v.shadow, S, r.x, r.y);
    }
    // the swinging vine follows the monkey
    if (st.world && st.world.vines.length) {
      for (const vn of st.world.vines) {
        const P = S.players.find((Q) => Q.vine && Q.vine.v.x === vn.x);
        const target = P ? -P.vine.ang : Math.sin(st.time * 1.2 + vn.x) * 0.06;
        vn.pivot.rotation.z = lerp(vn.pivot.rotation.z, target, P ? 1 : 0.1);
      }
    }
  }

  function makeBird(b) {
    const root = new T.Group();
    const col = { beach: '#ffffff', desert: '#a8763a', snow: '#4a6a8a', farm: '#2a2a36' }[st.theme] || '#8a8a9a';
    const body = A.ball(0.22, A.mat(col), 0, 0.2, 0, root);
    body.scale.set(1.4, 1, 1);
    const head = A.group(root, 0.26, 0.32, 0);
    A.ball(0.13, A.mat(col), 0, 0, 0, head);
    A.cone(0.05, 0.14, A.mat('#ffb02e'), 0.15, -0.02, 0, head, 6).rotation.z = -Math.PI / 2;
    A.ball(0.03, A.mat('#14121f'), 0.08, 0.05, 0.1, head);
    const wings = [];
    for (const z of [0.15, -0.15]) { const w = A.group(root, 0, 0.28, z); A.box(0.3, 0.04, 0.32, A.mat(col), 0, 0, z > 0 ? 0.14 : -0.14, w); wings.push(w); }
    actors.add(root);
    return { root, wings, head };
  }

  function syncViews(dt) {
    const S = st.sim;
    if (!S) return;
    for (const P of S.players) syncHero(S, P, dt);
    syncBuddy(S, dt);
    syncFoes(S, dt);
    syncShots(S, dt);
    syncItems(S);
    syncCast(S, dt);
  }

  // ---------------------------------------------------------------- events: bursts, sounds, toasts

  function play(name, ...args) {
    if (st.demo || st.quiet) return;
    const gap = { shot: 0.07, foeShot: 0.08, fizz: 0.05, hit: 0.06, pop: 0.04, cheer: 0.8, birds: 0.6, tink: 0.1, take: 0.04 }[name] || 0;
    if (gap) { if (st.time - (st.sfxAt[name] || -9) < gap) return; st.sfxAt[name] = st.time; }
    if (SFX[name]) SFX[name](...args);
  }

  const POPWORDS = ['BONK!', 'POP!', 'BOING!', 'BONK!', 'POW!'];
  const FORM_TOAST = {
    zombie: (n) => `BLEH! ZOMBIE ${n}!`, mummy: (n) => `WRAPPED UP! MUMMY ${n}!`, monkey: (n) => `OOH OOH! MONKEY ${n}!`,
    chubby: (n) => `TOO MANY TREATS! CHUBBY ${n}!`, snow: (n) => `BRRR! SNOWMAN ${n}!`,
  };
  const FORM_HINT = { zombie: 'Find a 🧪 potion!', mummy: 'Find a 🧪 potion!', monkey: 'Swing on the vines!', chubby: 'Big shots! Run it off!', snow: 'Wiggle to thaw out!' };
  const TREAT_NAME = { icecream: 'ICE CREAM', water: 'WATER', juice: 'JUICE', cookie: 'COOKIE', watermelon: 'WATERMELON', banana: 'BANANA' };
  const RIDE_NAME = { tank: 'TT TANK', llama: 'LOLLY THE LLAMA', mech: 'BOING BOT' };

  function onEvent(e, S) {
    const P = typeof e.i === 'number' ? S.players[e.i] : null;
    const who = P ? NAMES[P.kind] : '';
    switch (e.type) {
      case 'shot': play('shot', e.gun); break;
      case 'bleh': play('bleh'); fx.word(e.x + e.face * 1.4, e.y + 0.8, 'BLEH!', '#8be04a', 1.6); break;
      case 'pop': {
        if (e.boss) break;
        const word = e.foe === 'crate' ? 'CRACK!' : POPWORDS[e.id % POPWORDS.length];
        fx.word(e.x, e.y + 0.4, word, e.foe === 'crate' ? '#ffb02e' : '#ffd400', e.big ? 1.8 : 1.5);
        fx.stars(e.x, e.y, 6);
        fx.puff(e.x, e.y, 5, '#ffffff', 2);
        if (e.score && !st.demo) fx.points(e.x, e.y + 1.4, e.score);
        play('pop', e.big);
        break;
      }
      case 'bossHit': play('hit'); break;
      case 'tink': play('tink'); break;
      case 'foeShot': play('foeShot', e.kind); break;
      case 'fizz': fx.puff(e.x, e.y, 3, e.kind === 'goo' ? '#8be04a' : e.kind === 'ice' ? '#bdf0ff' : '#ffffff', 1.2); play('fizz'); break;
      case 'boom': {
        const k = e.kind;
        if (k === 'balloon' || k === 'foam') { fx.word(e.x, e.y + 1, 'SPLASH!', '#7fd4ff', 1.8); fx.splash(e.x, e.y + 0.3, k === 'foam' ? '#ffffff' : '#7fd4ff', 16); play('splash'); }
        else if (k === 'pound') { fx.ring(e.x, 0.5, null, 1, 0.5, 12); }
        else if (k === 'teamup' || k === 'rideBoom') { /* their own events */ }
        else { fx.word(e.x, e.y + 1, 'BOOM!', '#ff8a1f', 1.9); fx.puff(e.x, e.y, 10, '#ffe08a', 4); play('boom'); }
        st.shake = Math.max(st.shake, 0.25);
        break;
      }
      case 'splat': fx.splash(e.x, 0.3, '#ffe23d', 10); play('splash'); break;
      case 'hurt': {
        fx.word(P.x, P.y + 2.2, 'BONK!', '#ff7f8a', 1.4);
        fx.stars(P.x, P.y + 1.6, 6, 3);
        bumpCard(e.i, 'hurt');
        play('bonk');
        st.shake = Math.max(st.shake, 0.3);
        flash('rgba(255,80,100,0.35)', 0.25);
        break;
      }
      case 'out':
        toast(S.two ? `${who} IS BONKED OUT!` : 'BONKED!', 'oops', 2.2, e.x, e.y + 3);
        if (S.two && !S.players.every((Q) => Q.out)) setTimeout(() => { if (st.sim === S && P.out) toast(`HIGH FIVE TO BRING ${who} BACK!`, '', 2.4); }, 900);
        play('sad');
        break;
      case 'revive': toast(`${who} IS BACK!`, 'good', 1.8, e.x, e.y + 2.5); fx.puff(e.x, e.y + 1, 8, '#ffffff', 2.5); play('cure'); break;
      case 'form': {
        toast(FORM_TOAST[e.form](who), 'form', 2.4, e.x, e.y + 3);
        setTimeout(() => { if (st.sim === S && P.form === e.form) toast(FORM_HINT[e.form], '', 2.2, P.x, P.y + 3.6); }, 1300);
        fx.puff(e.x, e.y + 1, 14, { zombie: '#8be04a', mummy: '#efe0b8', monkey: '#c98a4b', chubby: '#ff7fbf', snow: '#ffffff' }[e.form], 3);
        play('form', e.form);
        break;
      }
      case 'cure': toast(e.why === 'time' || e.why === 'pop' ? `${who} IS BACK TO NORMAL!` : 'BACK TO ME!', 'good', 2, e.x, e.y + 3); fx.stars(e.x, e.y + 1, 10, 4); fx.confetti(e.x, e.y + 1.5, 16); play('cure'); break;
      case 'take': {
        play('take', e.item);
        if (e.item === 'coin' || e.item === 'star') break;
        if (e.item === 'treat' && e.gift) toast(`${A.TREAT_EMOJI[e.treat]} ${TREAT_NAME[e.treat]} FROM ${NAMES[e.gift]}!`, 'good', 2.2, e.x, e.y + 2.6);
        else if (e.item === 'treat') { if (P && P.treatT.length >= 5 && P.form === 'normal') toast(`${P.treatT.length} TREATS! CAREFUL...`, '', 1.4, e.x, e.y + 2.4); }
        else if (M.PICKUP_GUNS.includes(e.item)) toast(`${A.GUN_EMOJI[e.item]} ${M.GUNS[e.item].name}!`, 'good', 2, e.x, e.y + 2.6);
        else if (e.item === 'heart') toast('+1 ❤️', 'good', 1.5, e.x, e.y + 2.6);
        else if (e.item === 'balloons') toast('+10 🎈 WATER BALLOONS!', 'good', 1.8, e.x, e.y + 2.6);
        else if (e.item === 'potion') { if (e.gift) toast(`🧪 POTION FROM ${NAMES[e.gift]}!`, 'good', 2, e.x, e.y + 2.8); }
        else if (e.item === 'coco') toast('🐵 COCO THE MONKEY HELPS!', 'good', 2.4, e.x, e.y + 2.8);
        bumpCard(e.i, 'good');
        break;
      }
      case 'tickle': fx.word(e.x, e.y + 2.2, 'HEE HEE!', '#7fdcbd', 1.2); play('boing'); break;
      case 'gunOut': toast(`BACK TO ${P.kind === 'tommy' ? '✌️' : '🏀'}`, '', 1.4, P.x, P.y + 2.6); break;
      case 'nope': play('nope'); if (e.what === 'teamup') nudge($('budBtn')); if (e.what === 'balloons') { nudge($('bomb' + (S.two ? e.i : 0))); toast('NO BALLOONS LEFT', 'oops', 1.2, P.x, P.y + 2.6); } break;
      case 'throw': play('throwIt'); break;
      case 'board': toast(`${RIDE_NAME[e.ride]}!`, 'good', 1.8, e.x, 4.5); play('board'); break;
      case 'exit': play('boing'); break;
      case 'bail': toast('BAIL OUT!', 'good', 1.6, e.x, 4.5); play('vroom'); break;
      case 'bailWarn': toast(touch ? 'BAIL OUT! ⬇️ + ⬆️' : 'BAIL OUT! S + JUMP', 'oops', 2.4, P ? P.x : 0, 5); play('warn'); break;
      case 'rideHit': play('stumble'); fx.stars(e.x, e.y + 2, 4, 3); if (Kit.sound.bump) Kit.sound.bump(); break;
      case 'ridePop': fx.word(e.x, e.y + 2, 'KA-POOF!', '#ff7fbf', 2); fx.confetti(e.x, e.y + 1.5, 30); fx.puff(e.x, e.y + 1, 12, '#ffffff', 3); play('boom'); st.shake = 0.4; break;
      case 'rideBoom': fx.word(e.x, e.y + 2, 'MEGA BONK!', '#ffd400', 2.4); fx.confetti(e.x, e.y + 1.5, 40); fx.puff(e.x, e.y + 1, 14, '#ffe08a', 5); play('rideBoom'); st.shake = 0.6; break;
      case 'cannon': fx.puff(e.x + 1.5, e.y + 1.6, 4, '#ffffff', 1.5); play('boom'); break;
      case 'pound': fx.word(e.x, 1.4, 'BOING!', '#7fdcbd', 1.8); play('stomp'); st.shake = 0.4; break;
      case 'poundUp': play('boing'); break;
      case 'jump': if (!st.demo && Kit.sound.jump && Math.random() < 0.6) Kit.sound.jump(); break;
      case 'vine': play('boing'); break;
      case 'freed': fx.word(e.x, e.y + 2.4, 'FREE!', '#7dff5a', 1.4); fx.confetti(e.x, e.y + 1.5, 14); play('freed'); break;
      case 'salute': { const pw = S.pows.find((p2) => p2.id === e.id); if (pw) toast(`THANK YOU! ${carryLabel(pw.carry)}`, 'good', 1.8, pw.x, pw.y + 3); play('salute'); break; }
      case 'drop': toast(e.carry === 'potion' ? "BRUNO BRINGS A 🧪 POTION!" : "BRUNO'S BALLOON DROP!", 'good', 2, (S.camL + VW / 2), 8); break;
      case 'coco': play('take', 'coco'); break;
      case 'cocoBye': toast('BYE, COCO!', '', 1.5, e.x, 3); break;
      case 'buddyCall': {
        play('buddy');
        if (!e.again) toast(`HERE COMES ${NAMES[e.kind]}!`, 'good', 1.6);
        else toast(`${NAMES[e.kind]} STAYS LONGER!`, 'good', 1.4);
        break;
      }
      case 'hello': if (e.sig === 'peace') play('peace'); break;
      case 'peaceWave': fx.ring(e.x, e.y + 1.2, A.tex.rainbow, 1.2, 0.7, 9); for (let k = 0; k < 6; k++) fx.emoji(e.x + e.dir * k * 0.8, e.y + 2 + Math.sin(k) * 0.5, '✌️', { vx: e.dir * 6, vy: 1, life: 1, size: 0.7, fade: 0.5 }); break;
      case 'punch': fx.word(e.x + e.dir * 1.6, e.y + 1.4, e.n === 1 ? 'JAB!' : 'POW!', '#ffb02e', 1.3); play('punch'); break;
      case 'jumpshot': play('throwIt'); break;
      case 'saved': toast(`${NAMES[e.kind]} SAVED YOU!`, 'save', 1.8, e.x, e.y + 3.4); fx.ring(e.x, e.y + 1, null, 1, 0.5, 8); play('saved'); break;
      case 'bye': toast(`BYE, ${NAMES[e.kind]}! (T TO CALL AGAIN)`, '', 1.8); break;
      case 'teamup': banner('HIGH FIVE!', 1.2, 'go'); fx.ring(e.x, 1.5, A.tex.rainbow, 2, 0.8, 18); fx.confetti(e.x, 2, 40); fx.emoji(e.x, 3.2, '🙌', { life: 1.2, size: 1.6, vy: 1 }); play('teamup'); st.shake = 0.3; break;
      case 'go': st.goT = 3; st.goCam = S.camL; if (!st.demo) { banner('GO! ➜', 1, 'go'); play('go'); } break;
      case 'bossWarn': if (!st.demo) { banner(`WARNING!<small>${t(e.name)}</small>`, 2.2, 'warn'); play('bossWarn'); } break;
      case 'bossWind': play('bossWind'); break;
      case 'stomp': play('stomp'); st.shake = Math.max(st.shake, 0.35); fx.puff(e.x, 0.3, 8, '#ffe08a', 4); break;
      case 'snap': play('punch'); break;
      case 'leap': play('boing'); break;
      case 'bossDown': {
        fx.word(e.x, e.y + 1, 'KER-BONK!', '#ffd400', 3.2);
        fx.confetti(e.x, e.y + 2, 60);
        fx.stars(e.x, e.y, 16, 7);
        fx.puff(e.x, e.y, 16, '#ffffff', 5);
        if (!st.demo) { banner(`${t(e.name)}<small>${t('BONKED!')}</small>`, 2.4); play('bossDown'); }
        st.shake = 0.8;
        break;
      }
      case 'clear': if (!st.demo) startCelebrate(); break;
      case 'over': if (!st.demo) setTimeout(() => { if (st.sim === S && st.mode === 'play') showOver(); }, 400); break;
      case 'cheer': play('cheer'); break;
      case 'birds': play('birds'); break;
      default: break;
    }
  }

  function carryLabel(c) {
    if (M.PICKUP_GUNS.includes(c)) return A.GUN_EMOJI[c];
    return { balloons: '🎈', potion: '🧪', heart: '❤️', treat: '🍪', coco: '🐵' }[c] || '🎁';
  }

  // ---------------------------------------------------------------- toasts, banners, flashes

  const toastsEl = $('toasts');
  function toScreen(x, y) {
    const v = new T.Vector3(x, y, 0).project(camera);
    return { x: (v.x * 0.5 + 0.5) * st.view.w, y: (-v.y * 0.5 + 0.5) * st.view.h };
  }
  function toast(text, cls = '', dur = 1.8, x, y) {
    if (st.demo || st.quiet) return;
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    toastsEl.appendChild(el);
    const S = st.sim;
    const wx = x !== undefined ? x : S ? S.camL + VW / 2 : 0, wy = y !== undefined ? y : 6.5;
    // stack: nudge up if another toast is near
    let lift = 0;
    for (const o of st.toasts) if (Math.abs(o.wx - wx) < 5 && Math.abs(o.wy + o.lift - wy - lift) < 0.9 && st.time - o.t0 < o.dur) lift += 0.9;
    st.toasts.push({ el, t0: st.time, dur, wx, wy, lift });
    if (st.toasts.length > 7) { const o = st.toasts.shift(); o.el.remove(); }
  }
  function updateToasts() {
    for (let i = st.toasts.length - 1; i >= 0; i--) {
      const o = st.toasts[i];
      const k = (st.time - o.t0) / o.dur;
      if (k >= 1) { o.el.remove(); st.toasts.splice(i, 1); continue; }
      const p = toScreen(o.wx, o.wy + o.lift + k * 0.8);
      const w = o.el.offsetWidth || 100;
      const x = clamp(p.x, w / 2 + 8, st.view.w - w / 2 - 8), y = clamp(p.y, 90, st.view.h - 40);
      const pop = k < 0.1 ? 0.6 + k * 4 : 1;
      o.el.style.left = `${x}px`;
      o.el.style.top = `${y}px`;
      o.el.style.transform = `scale(${pop})`;
      o.el.style.opacity = String(k > 0.75 ? (1 - k) / 0.25 : 1);
    }
  }
  function clearToasts() { for (const o of st.toasts) o.el.remove(); st.toasts.length = 0; }

  const bannerEl = $('banner');
  function banner(html, dur = 1.6, cls = '') {
    if (st.quiet) return;
    bannerEl.className = 'banner ' + cls;
    bannerEl.innerHTML = html;
    st.banner = { t0: st.time, dur };
  }
  function updateBanner() {
    const b = st.banner;
    if (!b) { bannerEl.classList.add('hidden'); return; }
    const k = (st.time - b.t0) / b.dur;
    if (k >= 1) { st.banner = null; bannerEl.classList.add('hidden'); return; }
    bannerEl.classList.remove('hidden');
    const s = k < 0.12 ? 0.5 + (k / 0.12) * 0.6 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1;
    bannerEl.style.transform = `scale(${s})`;
    bannerEl.style.opacity = String(k > 0.8 ? (1 - k) / 0.2 : 1);
  }

  const flashEl = $('flash');
  let flashT = 0, flashDur = 1;
  function flash(color, dur) { if (st.demo) return; flashEl.style.background = color; flashT = dur; flashDur = dur; }
  function nudge(el) { if (!el) return; el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); }
  const cardBump = [{ t: -9, how: '' }, { t: -9, how: '' }];
  function bumpCard(i, how) { cardBump[i] = { t: st.time, how }; }

  // ---------------------------------------------------------------- HUD

  const hudCache = new Map();
  function setText(el, key, text) { if (hudCache.get(key) !== text) { hudCache.set(key, text); el.textContent = text; } }
  function setHtml(el, key, html) { if (hudCache.get(key) !== html) { hudCache.set(key, html); el.innerHTML = html; } }
  const GUN_ICON = { ball: '🏀', star: '✌️', water: '💦', bubble: '🫧', foam: '☁️', snow: '❄️', bleh: '🤢', mini: '🍌' };
  const FORM_NAME = { zombie: 'ZOMBIE', mummy: 'MUMMY', monkey: 'MONKEY', chubby: 'CHUBBY', snow: 'SNOWMAN' };

  function setupHud() {
    const S = st.sim;
    hudCache.clear();
    S.players.forEach((P, i) => {
      const c = $('card' + i);
      c.querySelector('img').src = faces[P.kind];
      c.querySelector('.n').textContent = NAMES[P.kind];
      c.classList.toggle('tm', P.kind === 'tommy');
    });
    $('card1').classList.toggle('hidden', !S.two);
    const bud = $('budBtn');
    const imgs = bud.querySelectorAll('img');
    if (S.two) {
      bud.classList.add('two');
      imgs[0].src = faces.teddy; imgs[1].src = faces.tommy; imgs[1].classList.remove('hidden');
      bud.querySelector('small').textContent = 'HIGH FIVE';
      bud.querySelector('kbd').textContent = 'T';
    } else {
      bud.classList.remove('two');
      const who = Kit.roster.buddyFor(S.players[0].kind);
      imgs[0].src = faces[who]; imgs[1].classList.add('hidden');
      bud.querySelector('small').textContent = `CALL ${NAMES[who]}`;
      bud.querySelector('kbd').textContent = 'T';
      $('budBar').querySelector('img').src = faces[who];
    }
    $('missionNo').textContent = `MISSION ${st.mission}`;
    $('missionName').textContent = JUG.MISSIONS[st.mission - 1].name;
    for (const i of [0, 1]) $('jump' + i).classList.toggle('tm', S.players[i] ? S.players[i].kind === 'tommy' : i === 1);
    layout();
  }

  function updateHud() {
    const S = st.sim;
    if (!S || st.mode === 'title' || st.mode === 'loading') return;
    S.players.forEach((P, i) => {
      const c = $('card' + i);
      const L = S.L;
      const slots = Math.max(P.hearts, L.hearts);
      let h = '';
      for (let k = 0; k < slots; k++) h += k < P.hearts ? '<i>❤️</i>' : '<i class="gone">❤️</i>';
      setHtml(c.querySelector('.hearts'), 'h' + i, h);
      const F = M.FORMS[P.form];
      const g = P.veh ? null : F.gun || P.gun;
      let gun;
      if (P.veh) gun = `<span class="e">${P.veh.type === 'tank' ? '🛞' : P.veh.type === 'llama' ? '🦙' : '🤖'}</span><span class="t"><span>${RIDE_NAME[P.veh.type]}</span> ${'▮'.repeat(Math.max(0, P.veh.hp))}</span>${P.veh.type === 'tank' ? `<span class="t">🏀×${P.veh.shells}</span>` : ''}`;
      else gun = `<span class="e">${GUN_ICON[g] || '🏀'}</span><span class="t"><span>${M.GUNS[g].name}</span>${M.GUNS[g].ammo && g === P.gun ? ' ' + P.ammo : ''}</span><span class="t">🎈×${P.balloons}</span>`;
      setHtml(c.querySelector('.gun'), 'g' + i, gun);
      setText(c.querySelector('.score'), 's' + i, String(P.score));
      const fm = c.querySelector('.form');
      fm.classList.toggle('hidden', P.form === 'normal');
      if (P.form !== 'normal') setText(fm, 'f' + i, FORM_NAME[P.form]);
      c.classList.toggle('out', P.out);
      const b = cardBump[i];
      c.classList.toggle('bump', st.time - b.t < 0.35 && b.how === 'good');
      c.classList.toggle('hurt', st.time - b.t < 0.35 && b.how === 'hurt');
      const em = $('bomb' + i) && $('bomb' + i).querySelector('em');
      if (em) setText(em, 'b' + i, String(P.veh && P.veh.type === 'tank' ? P.veh.shells : P.balloons));
    });
    const bud = $('budBtn');
    if (S.two) {
      const k = S.teamCD > 0 ? 1 - S.teamCD / S.L.teamCD : 1;
      bud.style.setProperty('--fill', k.toFixed(3));
      bud.classList.toggle('rest', S.teamCD > 0);
      bud.classList.toggle('on', S.teamCD <= 0);
      $('budBar').classList.add('hidden');
    } else {
      const B = S.buddy;
      const here = B && B.phase !== 'out';
      bud.classList.toggle('on', !!here);
      bud.classList.remove('rest');
      bud.style.setProperty('--fill', here ? (B.phase === 'here' || B.phase === 'in' ? clamp(B.left / S.L.buddyStay, 0, 1) : 0).toFixed(3) : '1');
      $('budBar').classList.toggle('hidden', !here);
      if (here) { const y = Math.round($('card0').getBoundingClientRect().bottom + 6); if (hudCache.get('bby') !== y) { hudCache.set('bby', y); $('budBar').style.top = `${y}px`; } }
      if (here) $('budBar').querySelector('i').style.setProperty('--fill', clamp(B.left / S.L.buddyStay, 0, 1).toFixed(3));
    }
    const boss = S.boss && !S.boss.dead && S.boss.state !== 'enter' ? S.boss : null;
    $('bossBar').classList.toggle('hidden', !boss);
    if (boss) {
      setText($('bossName'), 'bn', t(boss.name));
      $('bossBar').querySelector('i').style.setProperty('--fill', clamp(boss.hp / boss.maxHp, 0, 1).toFixed(3));
    }
    if (st.goT > 0 && S.camL > st.goCam + 4) st.goT = 0;
    $('goBox').classList.toggle('hidden', !(st.goT > 0 && !S.lock));
  }

  // ---------------------------------------------------------------- layout

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    st.view = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const S = st.sim;
    const two = S ? S.two : st.players.length === 2;
    const playing = st.mode !== 'title' && st.mode !== 'loading';
    const short = h <= 520;
    const place = (el, x, y) => { el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; };
    const bud = $('budBtn');
    const budS = short ? 80 : 100;
    const m = 14;
    $('touch').classList.toggle('on', touch && playing);
    const padS = short ? 120 : 150, jS = short ? 72 : 86, bS = short ? 56 : 66;
    const by = h - m - padS;
    // the ? and language buttons sit in the middle of the left edge: keep the pad clear of them on short screens
    const px0 = by < h / 2 + 70 ? 60 : m + 4;
    place($('pad0'), px0, by);
    $('pad1').classList.toggle('hidden', !two);
    $('jump1').classList.toggle('hidden', !two);
    $('bomb1').classList.toggle('hidden', !two);
    // the companion button: his face at the bottom right (above the jump button on a touch screen); in 2 players
    // it's the high five, up in the middle where both can reach it
    const topY = $('top').getBoundingClientRect().bottom + 10;
    if (!two) {
      place($('jump0'), w - m - jS - 6, h - m - jS - 6);
      place($('bomb0'), w - m - jS - bS - 22, h - m - bS - 4);
      if (touch) place(bud, w - m - budS - 2, h - m - jS - budS - 34);
      else place(bud, w - m - budS - 6, h - m - budS - 14);
    } else {
      place($('pad1'), w - m - padS - 4, by);
      place($('jump0'), px0 + padS + 22, h - m - jS - 6);
      place($('bomb0'), px0 + padS + 22 + jS * 0.1, h - m - jS - bS - 22);
      place($('jump1'), w - m - padS - 26 - jS, h - m - jS - 6);
      place($('bomb1'), w - m - padS - 26 - jS * 0.9, h - m - jS - bS - 22);
      place(bud, (w - budS) / 2, Math.max(topY, 60));
    }
    place($('budBar'), Math.max(10, m - 4), $('card0').getBoundingClientRect().bottom + 6 || (short ? 64 : 92));
  }

  // ---------------------------------------------------------------- camera

  function updateCamera(dt) {
    const S = st.sim;
    const { w, h } = st.view;
    const aspect = w / h;
    let Hv = Math.max(11.6, 22.6 / aspect);
    // on a touch screen the pads and buttons take the bottom of the screen: lift the ground above them
    let lift = 0;
    if (touch && st.mode !== 'title') {
      const ctl = h <= 520 ? 140 : 170;
      lift = Math.min(2.6, (ctl / h) * Hv * 0.75);
      Hv += lift;
    }
    const D = Hv / (2 * Math.tan((FOV * Math.PI) / 360));
    const cx = (S ? S.camL : 0) + VW / 2, cy = Hv / 2 - 1.3 - lift;
    let sx = 0, sy = 0;
    if (st.shake > 0) { st.shake = Math.max(0, st.shake - dt * 1.6); sx = (Math.random() - 0.5) * st.shake * 0.6; sy = (Math.random() - 0.5) * st.shake * 0.6; }
    camera.position.set(cx + sx, cy + 1.1 + sy, D);
    camera.lookAt(cx + sx, cy + sy, 0);
    sun.position.set(cx - 6, 14, 12);
    sun.target.position.set(cx, 0, 0);
  }

  // ---------------------------------------------------------------- input

  const held = new Set();
  const press = [{ special: false }, { special: false }];
  const pads = [{ id: null, dx: 0, dy: 0 }, { id: null, dx: 0, dy: 0 }];
  const tJump = [false, false], tBomb = [false, false];
  const K1 = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], fire: ['KeyF'], jump: ['KeyG', 'Space'], bomb: ['KeyH'] };
  const K2 = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], fire: ['KeyJ', 'Numpad1'], jump: ['KeyK', 'Numpad2'], bomb: ['KeyL', 'Numpad3'] };
  const GAME_KEYS = new Set([].concat(...Object.values(K1), ...Object.values(K2)));
  const anyHeld = (list) => list.some((c) => held.has(c));

  function shootableOnScreen(S) {
    return S.foes.some((f) => !f.dead && S.onScreen(f.x, -0.5)) || S.pows.some((p) => p.state === 'tied' && S.onScreen(p.x));
  }

  function readInput() {
    const S = st.sim;
    if (!S || st.demo) return;
    const one = !S.two;
    for (let i = 0; i < S.players.length; i++) {
      if (S.auto[i]) continue;
      const inp = S.input[i];
      if (st.force[i]) { Object.assign(inp, st.force[i]); continue; }
      const maps = one ? [K1, K2] : [i === 0 ? K1 : K2];
      let dx = 0, dy = 0, fire = false, jump = false, bomb = false;
      for (const k of maps) {
        if (anyHeld(k.left)) dx -= 1;
        if (anyHeld(k.right)) dx += 1;
        if (anyHeld(k.up)) dy += 1;
        if (anyHeld(k.down)) dy -= 1;
        if (anyHeld(k.fire)) fire = true;
        if (anyHeld(k.jump)) jump = true;
        if (anyHeld(k.bomb)) bomb = true;
      }
      const pad = pads[one ? 0 : i];
      if (pad.id !== null) { dx = pad.dx; dy = pad.dy; }
      const ti = one ? 0 : i;
      if (tJump[ti] || (one && tJump[1])) jump = true;
      if (tBomb[ti]) bomb = true;
      if (touch && (pad.id !== null || tJump[ti]) && shootableOnScreen(S)) fire = true;
      if (touch && shootableOnScreen(S) && !held.size) fire = true;
      inp.dx = clamp(dx, -1, 1);
      inp.dy = clamp(dy, -1, 1);
      inp.fire = fire;
      inp.jump = jump;
      inp.special = bomb || press[i].special;
      press[i].special = false;
    }
  }
  function clearInput() {
    held.clear();
    for (const p of pads) { p.id = null; p.dx = p.dy = 0; padKnob(pads.indexOf(p), 0, 0); }
    tJump[0] = tJump[1] = tBomb[0] = tBomb[1] = false;
  }

  const firstGesture = () => { Kit.sound.init(); if (st.mode === 'title') Kit.sound.music('title'); };

  window.addEventListener('keydown', (e) => {
    firstGesture();
    const c = e.code;
    if (c === 'KeyM') { toggleMute(); return; }
    if (st.mode === 'play' || st.mode === 'celebrate') {
      if (GAME_KEYS.has(c)) { e.preventDefault(); held.add(c); return; }
      if (c === 'KeyT' && !e.repeat) { e.preventDefault(); callBuddy(0); return; }
      if ((c === 'Enter' || c === 'NumpadEnter') && !e.repeat) { e.preventDefault(); callBuddy(1); return; }
      if (c === 'KeyP' || c === 'Escape') { pause(); return; }
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space' || c === 'Enter') { e.preventDefault(); resume(); }
      else if (c === 'KeyR') restartMission();
      else if (c === 'KeyQ') toMenu();
      return;
    }
    if (st.mode === 'title') {
      if (c === 'Digit1' || c === 'Numpad1') startGame(['teddy']);
      else if (c === 'Digit2' || c === 'Numpad2') startGame(['tommy']);
      else if (c === 'Digit3' || c === 'Numpad3') startGame(['teddy', 'tommy']);
      else if (c === 'KeyE') setLevel(st.level === 'easy' ? 'normal' : 'easy');
      else if (c === 'ArrowLeft' || c === 'KeyA' || c === 'Comma') pickMission(-1);
      else if (c === 'ArrowRight' || c === 'KeyD' || c === 'Period') pickMission(1);
      else if (c === 'Enter' || c === 'Space') { e.preventDefault(); startGame(save.lastPlayers || ['teddy']); }
      return;
    }
    if (st.mode === 'tally') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); nextMission(); }
      else if (c === 'Escape') toMenu();
      return;
    }
    if (st.mode === 'over') {
      if ((c === 'Enter' || c === 'Space') && st.modeT > 0.6) { e.preventDefault(); retry(); }
      else if (c === 'Escape') toMenu();
      return;
    }
    if (st.mode === 'win') {
      if ((c === 'Enter' || c === 'Space' || c === 'Escape') && st.modeT > 0.8) { e.preventDefault(); toMenu(); }
    }
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', clearInput);

  // touch pads: drag the knob; it reads as 8 directions
  const capture = (el, id) => { try { el.setPointerCapture(id); } catch (e) { /* not an active pointer */ } };
  function padKnob(i, x, y) { const k = $('pad' + i) && $('pad' + i).querySelector('i'); if (k) k.style.transform = `translate(${x}px, ${y}px)`; }
  function bindPad(i) {
    const el = $('pad' + i);
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let x = e.clientX - cx, y = e.clientY - cy;
      const max = r.width * 0.36;
      const n = Math.hypot(x, y);
      if (n > max) { x = (x / n) * max; y = (y / n) * max; }
      padKnob(i, x, y);
      const nx = x / max, ny = y / max;
      pads[i].dx = Math.abs(nx) > 0.35 ? Math.sign(nx) : 0;
      pads[i].dy = ny < -0.45 ? 1 : ny > 0.5 ? -1 : 0;
    };
    el.addEventListener('pointerdown', (e) => { firstGesture(); e.preventDefault(); capture(el, e.pointerId); pads[i].id = e.pointerId; move(e); });
    el.addEventListener('pointermove', (e) => { if (pads[i].id === e.pointerId) move(e); });
    const end = (e) => { if (pads[i].id === e.pointerId) { pads[i].id = null; pads[i].dx = pads[i].dy = 0; padKnob(i, 0, 0); } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  bindPad(0);
  bindPad(1);
  function bindHold(el, arr, i) {
    el.addEventListener('pointerdown', (e) => { firstGesture(); e.preventDefault(); e.stopPropagation(); capture(el, e.pointerId); arr[i] = true; el.classList.add('down'); });
    const up = () => { arr[i] = false; el.classList.remove('down'); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  bindHold($('jump0'), tJump, 0);
  bindHold($('jump1'), tJump, 1);
  bindHold($('bomb0'), tBomb, 0);
  bindHold($('bomb1'), tBomb, 1);
  $('budBtn').addEventListener('pointerdown', (e) => {
    firstGesture();
    e.preventDefault();
    e.stopPropagation();
    const el = $('budBtn');
    el.classList.add('down');
    setTimeout(() => el.classList.remove('down'), 120);
    callBuddy(0);
  });

  function callBuddy(i) {
    const S = st.sim;
    if (st.mode !== 'play' || !S || st.demo) return;
    if (S.two) S.teamUp(i);
    else S.callBuddy();
  }

  function toggleMute() {
    Kit.sound.init();
    const m = Kit.sound.toggleMute();
    document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; });
  }
  document.querySelectorAll('.muteBtn').forEach((b) => {
    b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    b.addEventListener('click', toggleMute);
  });
  $('pauseBtn').addEventListener('click', () => (st.mode === 'pause' ? resume() : pause()));

  // ---------------------------------------------------------------- modes and screens

  const SCREENS = ['title', 'pause', 'tally', 'over', 'win'];
  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
  function setMode(m) {
    st.mode = m;
    st.modeT = 0;
    $('hud').classList.toggle('hidden', m === 'title' || m === 'loading');
    layout();
  }

  function setWorld(mission) {
    const theme = JUG.MISSIONS[mission - 1].theme;
    if (st.world && st.worldMission === mission) return;
    if (st.world) st.world.dispose();
    st.world = A.makeWorld(scene, JUG.MISSIONS[mission - 1], theme);
    st.worldMission = mission;
    if (st.theme !== theme) {
      // the flyers are dressed for their place: drop the old pools
      for (const k of Object.keys(V.pools)) if (k.startsWith('flyer')) delete V.pools[k];
    }
    st.theme = theme;
  }

  function makeSim(mission, o = {}) {
    return new M.Sim({
      mission, level: o.level || st.level, players: o.players || st.players, auto: o.auto, startX: o.startX || 0,
      seed: (Date.now() & 0xffff) + 1, buddyFor: (id) => Kit.roster.buddyFor(id),
    });
  }

  function loadMission(mission, startX = 0) {
    st.force = [null, null];
    clearViews();
    clearInput();
    clearToasts();
    st.mission = mission;
    st.sim = makeSim(mission, { startX });
    st.demo = false;
    st.acc = 0;
    st.celebrate = null;
    st.goT = 0;
    setWorld(mission);
    setupHud();
    show(null);
    setMode('play');
    const Md = JUG.MISSIONS[mission - 1];
    banner(`${t('MISSION')} ${mission}<small>${t(Md.name)} · ${t(Md.tag)}</small>`, 2.6);
    SFX.jingle();
    Kit.sound.music('play');
    if (startX > 0) toast('BACK AT THE LAST FIGHT!', 'good', 2);
  }

  function startGame(players, o = {}) {
    firstGesture();
    SFX.click();
    st.players = players;
    save.lastPlayers = players;
    save.level = st.level;
    save.mission = o.mission || st.mission;
    writeSave();
    loadMission(o.mission || st.mission, 0);
  }

  function pause() {
    if (st.mode !== 'play') return;
    setMode('pause');
    show('pause');
    clearInput();
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    show(null);
    setMode('play');
    Kit.sound.music('play');
  }
  function restartMission() { loadMission(st.mission, 0); }

  function toMenu() {
    clearToasts();
    st.banner = null;
    startDemo();
    show('title');
    setMode('title');
    refreshTitle();
    Kit.sound.music('title');
  }

  // the title screen: both brothers play the picked mission by themselves behind the menu
  function startDemo() {
    clearViews();
    clearInput();
    const mission = Math.min(st.mission, unlockedFor(st.level));
    st.sim = makeSim(mission, { players: ['teddy', 'tommy'], auto: true, level: 'easy' });
    st.sim.immortal = true;
    st.demo = true;
    st.acc = 0;
    st.celebrate = null;
    setWorld(mission);
  }

  function startCelebrate() {
    const S = st.sim;
    setMode('celebrate');
    // each brother's signature moves: Teddy's jab and straight then his jump shot, Tommy's ✌️ Y pose
    const sigs = S.players.map((P) => Kit.roster.get(P.kind).signature || ['wave']);
    st.celebrate = { t: 0, sig: sigs.map((l) => l[0]), sig2: sigs.map((l) => l[l.length - 1]) };
    banner(`${t('MISSION')} ${st.mission}<small>${t('CLEAR!')}</small>`, 2.6);
    play('clear');
    for (const P of S.players) fx.confetti(P.x, P.y + 2.5, 30);
    Kit.sound.music('title');
  }

  function unlockedFor(level) { return clamp(save.unlocked[level] || 1, 1, 6); }

  function markCleared() {
    const S = st.sim;
    const lv = st.level;
    save.unlocked[lv] = Math.max(unlockedFor(lv), Math.min(6, st.mission + 1));
    if (lv === 'normal') save.unlocked.easy = Math.max(unlockedFor('easy'), save.unlocked.normal);
    const b = save.best[lv];
    b[st.mission] = Math.max(b[st.mission] || 0, S.score());
    if (st.mission < 6) save.mission = st.mission + 1;
    writeSave();
  }

  function showTally() {
    const S = st.sim;
    markCleared();
    setMode('tally');
    show('tally');
    $('tallyTitle').textContent = `MISSION ${st.mission} CLEAR!`;
    const rows = [
      ['🫡 Fuzzbeards freed', S.stats.rescues],
      ['💥 baddies bonked', S.stats.pops],
      ['🪙 coins', S.stats.coins],
      ['🍪 treats', S.stats.treats],
    ];
    if (!S.two) rows.push([`🛡️ ${NAMES[Kit.roster.buddyFor(S.players[0].kind)]} saved you`, S.stats.saves]);
    else rows.push(['🙌 high fives', S.stats.teamups]);
    rows.push(['⏱️ time', `${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, '0')}`]);
    rows.push(['⭐ SCORE', S.score()]);
    $('tallyGrid').innerHTML = rows.map(([a, b], k) => `<span${k === rows.length - 1 ? ' class="tot"' : ''}>${a}</span><span class="n">${b}</span>`).join('');
    $('tallySub').textContent = st.mission < 6 ? `Next: ${JUG.MISSIONS[st.mission].name}!` : 'That was the last mission!';
    $('nextBtn').textContent = st.mission < 6 ? 'NEXT MISSION ▶' : 'THE END ▶';
  }

  function nextMission() {
    if (st.mission >= 6) { showWin(); return; }
    loadMission(st.mission + 1, 0);
  }

  function showWin() {
    setMode('win');
    show('win');
    $('winSub').textContent = st.players.length === 2 ? 'Teddy and Tommy bonked the whole toy army!' : `${NAMES[st.players[0]]} bonked the whole toy army!`;
    fx.confetti(st.sim ? st.sim.camL + VW / 2 : 0, 8, 80);
    play('clear');
  }

  function showOver() {
    setMode('over');
    show('over');
    $('overSub').textContent = st.sim.checkpoint > 0 ? 'Try again from the last fight!' : 'Try again!';
    Kit.sound.music('over');
  }

  function retry() {
    const cp = st.sim ? st.sim.checkpoint : 0;
    loadMission(st.mission, cp);
  }

  // title screen
  function refreshTitle() {
    const logo = $('logoMain');
    const name = JUG.TITLE;
    logo.innerHTML = `<span class="a">${name[0]}</span>${name.slice(1, -1)}<span class="b">${name.slice(-1)}</span>`;
    document.title = `${name} · Teddy & Tommy`;
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === st.level)));
    const max = unlockedFor(st.level);
    if (st.mission > max) st.mission = max;
    const Md = JUG.MISSIONS[st.mission - 1];
    const best = save.best[st.level][st.mission];
    $('missionLabel').innerHTML = `${t('MISSION')} ${st.mission}<small><span>${t(Md.name)}</span>${best ? ' · ⭐ ' + best : ''}</small>`;
    document.querySelector('[data-m="-1"]').disabled = st.mission <= 1;
    document.querySelector('[data-m="1"]').disabled = st.mission >= max;
  }
  function setLevel(l) {
    st.level = l;
    save.level = l;
    writeSave();
    SFX.click();
    refreshTitle();
  }
  function pickMission(d) {
    const max = unlockedFor(st.level);
    const n = clamp(st.mission + d, 1, max);
    if (n === st.mission) { if (d > 0 && st.mission >= max) toast('FINISH THIS MISSION FIRST!', 'oops', 1.2); return; }
    st.mission = n;
    save.mission = n;
    writeSave();
    SFX.click();
    refreshTitle();
    startDemo();
  }
  function setupTitle() {
    document.querySelectorAll('[data-face]').forEach((img) => { img.src = faces[img.dataset.face]; });
    document.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.play;
      startGame(p === 'both' ? ['teddy', 'tommy'] : [p]);
    }));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
    document.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => pickMission(Number(b.dataset.m))));
    $('resumeBtn').addEventListener('click', resume);
    $('restartBtn').addEventListener('click', restartMission);
    $('quitBtn').addEventListener('click', toMenu);
    $('nextBtn').addEventListener('click', nextMission);
    $('tallyMenuBtn').addEventListener('click', toMenu);
    $('retryBtn').addEventListener('click', retry);
    $('overMenuBtn').addEventListener('click', toMenu);
    $('winMenuBtn').addEventListener('click', toMenu);
    if (Kit.lang && Kit.lang.onChange) Kit.lang.onChange(() => { refreshTitle(); for (const k of Object.keys(A.tex)) if (k.startsWith('badge')) delete A.tex[k]; });
  }

  // ---------------------------------------------------------------- main loop

  function simRuns() {
    const m = st.mode;
    return m === 'play' || m === 'celebrate' || (m === 'title' && st.demo) || (m === 'over' && st.modeT < 3);
  }

  function tick(dt) {
    st.time += dt;
    st.modeT += dt;
    if (st.goT > 0) st.goT -= dt;
    const S = st.sim;
    if (S && simRuns()) {
      st.acc += dt;
      let n = 0;
      while (st.acc >= DT - 1e-9 && n++ < 8) {
        readInput();
        S.step(DT);
        st.acc -= DT;
        for (const e of S.events) onEvent(e, S);
        S.events.length = 0;
      }
      if (st.acc > DT) st.acc = 0;
    }
    if (st.celebrate && st.mode === 'celebrate' && S) {
      // everybody to the middle of the screen for the party (a bonked-out brother gets up too)
      S.players.forEach((P, i) => {
        if (P.out) S.revive(P);
        const tx = S.camL + VW / 2 - (S.players.length - 1) * 1.4 + i * 2.8;
        P.x += (tx - P.x) * Math.min(1, dt * 2.5);
        P.vx = 0;
      });
    }
    if (st.celebrate) {
      st.celebrate.t += dt;
      if (st.mode === 'celebrate' && st.celebrate.t > 3.6) showTally();
    }
    if (st.demo && S && (S.cleared || S.over || S.t > 75)) startDemo();
    if (st.world) st.world.tick(S ? S.camL + VW / 2 : 0, st.time, dt);
    syncViews(dt);
    fx.update(dt);
    updateCamera(dt);
    updateHud();
    updateToasts();
    updateBanner();
    if (flashT > 0) { flashT -= dt; flashEl.style.opacity = String(Math.max(0, flashT / flashDur)); }
  }

  function render() { renderer.render(scene, camera); }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!st.keepAwake) { pause(); Kit.sound.suspend(); } }
    else Kit.sound.resume();
  });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));

  // ---------------------------------------------------------------- start

  setupTitle();
  $('loading').remove();
  startDemo();
  setMode('title');
  show('title');
  refreshTitle();
  layout();
  tick(DT);
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` and draw (the Browser pane throttles animation while hidden)
    step(seconds = 1 / 60) {
      let n = Math.max(1, Math.round(seconds / DT));
      while (n-- > 0) tick(DT);
      render();
      return game.state();
    },
    // start a game: { players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], mission, level, startX }
    start(o = {}) {
      if (o.level) st.level = o.level;
      st.players = o.players || ['teddy'];
      loadMission(o.mission || 1, o.startX || 0);
      return game.state();
    },
    state() {
      const S = st.sim;
      return {
        mode: st.mode, mission: st.mission, demo: st.demo, level: st.level, phase: S ? S.phase : null, t: S ? +S.t.toFixed(1) : 0,
        camL: S ? +S.camL.toFixed(1) : 0, lock: S ? !!S.lock : false,
        players: S ? S.players.map((P) => ({ kind: P.kind, x: +P.x.toFixed(2), y: +P.y.toFixed(2), hearts: P.hearts, form: P.form, gun: P.gun, ammo: P.ammo, balloons: P.balloons, ride: P.veh ? P.veh.type : null, score: P.score, out: P.out })) : null,
        buddy: S && S.buddy ? { kind: S.buddy.kind, phase: S.buddy.phase, left: +S.buddy.left.toFixed(1) } : null,
        foes: S ? S.foes.length : 0, shots: S ? S.shots.length + S.fshots.length : 0, items: S ? S.items.length : 0,
        boss: S && S.boss ? { name: S.boss.name, hp: Math.round(S.boss.hp), maxHp: S.boss.maxHp, state: S.boss.state } : null,
        stats: S ? S.stats : null,
      };
    },
    sim: () => st.sim,
    buddy() { callBuddy(0); return game.state().buddy; },
    teamup(i = 0) { return st.sim && st.sim.teamUp(i); },
    give(type, i = 0) { return st.sim && st.sim.give(type, i); },
    warp(x) { if (st.sim) st.sim.warp(x); return game.state(); },
    // jump straight to this mission's boss
    boss() { const S = st.sim; if (!S) return null; S.warp(S.M.len - VW / 2); S.evI = S.beats.length; S.lock = null; return game.state(); },
    clear() { if (st.sim) st.sim.winNow(); },
    // hold a player's input until game.input(i, null): game.input(0, { dx: 1, fire: true })
    input(i, o) { st.force[i] = o ? Object.assign({ dx: 0, dy: 0, jump: false, fire: false, special: false }, st.force[i] || {}, o) : null; },
    autopilot(on = true) { if (st.sim) st.sim.auto = st.sim.auto.map(() => on); },
    keepAwake(on = true) { st.keepAwake = on; },
    quiet(on = true) { st.quiet = on; if (on) { clearToasts(); st.banner = null; } },
    freeze(on = true) { st.frozen = on; },
    menu: toMenu,
    pause, resume,
    over: () => { if (st.sim) { for (const P of st.sim.players) { P.hearts = 1; P.invulnT = 0; st.sim.hurt(P, {}); } } },
    check: () => ({ missions: JUG.check.missions(), rules: JUG.check.rules(), sabotage: JUG.check.sabotage() }),
    soak: (o) => JUG.check.soak(o),
    scene, camera, toast, banner, layout, st, save, unlockAll() { save.unlocked = { easy: 6, normal: 6 }; writeSave(); refreshTitle(); },
  };
})();
