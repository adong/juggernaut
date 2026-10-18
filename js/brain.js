/* JuggernauT: the autopilot. It plays a brother for the title-screen demo, for game.autopilot() and for the headless
   soak (tools/check.js). No Three.js in here.

   Every third tick it tries seven moves (stand, walk left or right, jump straight or either way, duck) and plays each
   one 0.85 s ahead against every baddie throw and baddie body nearby, the way they really move (straight lines, lobs,
   ground waves, rays and icicles after their warning). Each move gets a danger score, plus a small cost for not going
   where it wants to: right while the screen scrolls, a comfy distance from baddies in a fight, toward pick-ups and
   rides. It takes the cheapest move, then aims at the nearest baddie with the closest of the eight directions. */
(function () {
  'use strict';
  const JUG = (window.JUG = window.JUG || {});

  const ACTS = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [1, 1, 0], [-1, 1, 0], [0, 0, 1]]; // [dx, jump, duck]
  const TS = [0.05, 0.1, 0.15, 0.2, 0.27, 0.35, 0.45, 0.55, 0.7, 0.85];
  const WANT_ITEMS = { water: 1, bubble: 1, foam: 1, snow: 1, balloons: 1, heart: 1, potion: 1, coco: 1, star: 0.3, treat: 0.2, coin: 0.2 };
  const sgn = (v) => (v < 0 ? -1 : 1);

  function groundUnder(S, x, y) {
    let g = 0;
    for (const p of S.plats) if (x > p.x0 && x < p.x1 && p.y <= y + 0.01 && p.y > g) g = p.y;
    return g;
  }

  function drive(S, i) {
    const M = JUG.sim;
    const P = S.players[i], inp = S.input[i];
    const memo = P.bot || (P.bot = { n: 0, dx: 0, jump: 0, duck: 0, aimDy: 0, jumpT: 0, gap: 0, specT: 0, turn: 0 });
    if (P.out || S.cleared || S.over) { inp.dx = inp.dy = 0; inp.jump = inp.fire = inp.special = false; return; }
    const DT = 1 / 60;
    memo.n++;
    memo.jumpT -= DT;
    memo.specT -= DT;
    inp.special = false;
    const think = S.clumsy ? 10 : 3;
    if (memo.n % think !== 1) { apply(S, P, inp, memo, false); return; }

    const V = P.veh;
    const F = M.FORMS[P.form];
    const R = V ? M.RIDES[V.type] : null;
    const speed = V ? R.speed : F.speed;
    const jumpV = V ? R.jump : F.jump;
    const bx = V ? V.x : P.x, by = V ? V.y : P.y, bvy = V ? V.vy : P.vy, onGround = V ? V.ground : P.ground;
    const hb = S.hurtbox(P);
    const ox0 = hb.x0 - bx, ox1 = hb.x1 - bx, oy0 = hb.y0 - by, oy1 = hb.y1 - by;
    const duckH = V ? (V.type === 'tank' ? M.RIDES.tank.h * 0.65 : oy1) : 1.15 * (0.85 + 0.15 * S.L.hurt);
    const safe = P.invulnT > 0.45 || P.shieldT > 0.45;
    const minX = S.camL + 0.7 + (V ? R.w / 2 : 0), maxX = S.camR - 0.7 - (V ? R.w / 2 : 0);

    // ---- what could hit us
    const threats = [];
    // S.letForms (the soak's "transform" variant) walks into whatever turns you into something, to prove a zombie,
    // a mummy, a monkey or a snowman can still finish
    const letForms = S.letForms && P.form === 'normal';
    if (!safe) {
      for (const b of S.fshots) if (Math.abs(b.x - bx) < 11 && !(letForms && b.form)) threats.push(b);
    }
    const bodies = [];
    if (!safe) for (const f of S.foes) if (!f.dead && !f.harmless && Math.abs(f.x - bx) < 8 && !(f.boss && f.state === 'enter') && !(letForms && M.FOES[f.type] && M.FOES[f.type].bite)) bodies.push(f);

    // ---- where we'd like to be
    let target = null, td = 1e9;
    const real = S.foes.some((f) => !f.dead && !f.harmless && S.onScreen(f.x, -0.3));
    for (const f of S.foes) {
      if (f.dead || !S.onScreen(f.x, -0.3)) continue;
      if (f.harmless && (f.type !== 'crate' || real)) continue;
      const d = Math.hypot(f.x - bx, f.y + f.h / 2 - (by + 1.2)) * (f.boss ? 0.7 : f.type === 'crate' ? 2.5 : 1);
      if (d < td) { td = d; target = f; }
    }
    let want = 1, why = 'scroll';
    const fight = !!S.lock || S.phase === 'boss';
    let near = null, nd = 1e9;
    for (const f of S.foes) {
      if (f.dead || f.harmless || f.air || Math.abs(f.y - by) > 2.5) continue;
      const d = Math.abs(f.x - bx) - f.w / 2;
      if (d < nd) { nd = d; near = f; }
    }
    if (near) {
      const dir = sgn(near.x - bx);
      const melee = near.boss || M.FOES[near.type] && (M.FOES[near.type].ai === 'shamble' || M.FOES[near.type].ai === 'scuttle');
      const dmin = near.boss ? 5.5 : melee ? 3.5 : 2.5, dmax = near.boss ? 10 : 8;
      if (nd < dmin) { want = -dir; why = 'back'; }
      else if (nd > dmax) want = fight ? dir : 1;
      else want = 0;
      if (want === -dir && ((want < 0 && bx < minX + 0.8) || (want > 0 && bx > maxX - 0.8))) want = 0;
    } else if (fight) want = target ? 0 : 1;
    if (!fight && !near && target && Math.abs(target.x - bx) < 6 && target.type !== 'crate') want = 0;
    // pick-ups and rides when nothing's close
    if (!near || nd > 4) {
      let best = null, bv = 0;
      for (const it of S.items) {
        let v = WANT_ITEMS[it.type] || 0;
        if (it.type === 'potion') v = P.form !== 'normal' ? 3 : 0.1;
        if (it.type === 'heart' && P.hearts >= P.maxHearts) v = 0.1;
        if (it.gift) v = 2;
        if (it.y > 2.5 || !v) continue;
        const d = Math.abs(it.x - bx);
        if (d > 9) continue;
        const score = v / (1 + d * 0.3);
        if (score > bv) { bv = score; best = it; }
      }
      if (best && bv > 0.12) { want = Math.abs(best.x - bx) > 0.4 ? sgn(best.x - bx) : 0; why = 'item'; }
      if (!V && P.form !== 'snow' && P.exitT <= 0) {
        for (const r of S.rides) if (r.state === 'parked' && !r.rider && S.onScreen(r.x, 0.5) && Math.abs(r.x - bx) < 14) { want = sgn(r.x - bx); why = 'ride'; }
      }
    }
    if (S.clumsy && memo.n % 50 < 8) want = 0; // a small kid stops to look around now and then

    // ---- score each move
    let bestA = ACTS[0], bestC = 1e9;
    for (const a of ACTS) {
      const [dx, jump, duck] = a;
      if (duck && (!onGround || (V && V.type !== 'tank'))) continue;
      if (jump && !onGround) continue;
      const sp = duck ? speed * 0.4 : speed;
      let vy0 = jump ? jumpV : onGround ? 0 : bvy;
      const g0 = onGround ? by : groundUnder(S, bx, by);
      let danger = 0;
      const h1 = duck ? duckH : oy1;
      const hitS = new Set();
      for (const t of TS) {
        const x = Math.max(minX, Math.min(maxX, bx + dx * sp * t));
        let y = by + vy0 * t - 17 * t * t;
        if (y < g0) y = g0;
        const X0 = x + ox0 - 0.12, X1 = x + ox1 + 0.12, Y0 = y + oy0 - 0.05, Y1 = y + h1 + 0.1;
        const w = 1.6 - t;
        for (const b of threats) {
          if (hitS.has(b)) continue;
          let sx, sy, r = b.r;
          const bt = b.t + t;
          if (b.kind === 'beam') {
            if (bt < b.warn - 0.15 || bt > b.warn + b.on) continue;
            if (X1 > b.x - 0.8 && X0 < b.x + 0.8) { danger += w * 2; hitS.add(b); }
            continue;
          }
          if (b.kind === 'icicle') {
            if (bt < b.warn) { sx = b.x; sy = b.y; }
            else { sx = b.x; sy = b.y - 13 * Math.sqrt(S.L.shotSpeed) * (bt - Math.max(b.t, b.warn)); }
          } else if (b.float) { sx = b.x + b.vx * t; sy = b.baseY + Math.sin(bt * 3) * 0.9; }
          else { sx = b.x + b.vx * t; sy = b.y + b.vy * t - 0.5 * b.g * t * t; }
          if (sy < -0.3) continue;
          const cx = Math.max(X0, Math.min(X1, sx)), cy = Math.max(Y0, Math.min(Y1, sy));
          if ((cx - sx) ** 2 + (cy - sy) ** 2 < (r + 0.08) ** 2) { danger += w * (b.form ? 1.3 : 1); hitS.add(b); }
        }
        for (const f of bodies) {
          if (hitS.has(f)) continue;
          let fx = f.x + f.vx * t, fy = f.y;
          if (f.boss && f.state === 'act' && f.atk === 'leap' && !f.ground) { fx = f.x + f.vx * t; fy = Math.max(0, f.y + f.vy * t - 17 * t * t); }
          if (f.boss && f.state === 'wind' && f.atk === 'snap') fx = f.x + sgn(f.aimX - f.x) * Math.min(3.5, t * 8);
          if (X1 < fx - f.w * 0.45 || X0 > fx + f.w * 0.45 || Y1 < fy + 0.1 || Y0 > fy + f.h * 0.92) continue;
          danger += w * 1.2;
          hitS.add(f);
        }
      }
      // splats land next to you
      for (const b of threats) {
        if (!b.splash) continue;
        const tl = landTime(b);
        if (tl === null || tl > 0.9) continue;
        const lx = b.x + b.vx * tl;
        const x = bx + dx * sp * tl;
        const yy = by + vy0 * tl - 17 * tl * tl;
        if (Math.abs(x - lx) < b.splash + 0.5 && yy < 1.2) danger += 1.2;
      }
      let cost = danger * 3;
      cost += Math.abs(want - dx) * (why === 'back' ? 0.5 : 0.25);
      if (jump) cost += why === 'ride' ? 0.02 : 0.06;
      if (duck) cost += 0.05;
      if ((dx < 0 && bx - 0.5 < minX) || (dx > 0 && bx + 0.5 > maxX)) cost += 0.3; // walking into the screen edge
      cost += aimCost(S, P, target, dx || P.face, !onGround || jump, bx, by + (jump ? 1.2 : 0), dx) * 0.6;
      if (cost < bestC) { bestC = cost; bestA = a; }
    }
    memo.dx = bestA[0];
    memo.duck = bestA[2];
    if (bestA[1]) memo.wantJump = true;
    // aim: pick up / down for the target
    memo.aimDy = 0;
    if (target) {
      const face = memo.dx || (sgn(target.x - bx));
      const ty = target.y + target.h / 2, my = by + (V ? 1.2 : 1.25);
      const ang = Math.atan2(ty - my, target.x - bx);
      let bd = 1e9;
      for (const [dy, a] of aims(face, memo.dx, !onGround)) {
        let d = Math.abs(ang - a);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (rayHits(target, bx, my, a)) d -= 10;
        if (d < bd) { bd = d; memo.aimDy = dy; }
      }
      // turn round to face a baddie behind us
      memo.turn = !memo.dx && sgn(target.x - bx) !== P.face && Math.abs(target.x - bx) > 0.6 ? sgn(target.x - bx) : 0;
    } else memo.turn = 0;
    memo.fire = !!target || S.foes.some((f) => !f.dead && S.onScreen(f.x));
    // specials
    if (memo.specT <= 0 && target) {
      const d = Math.abs(target.x - bx), front = sgn(target.x - bx) === (memo.dx || P.face);
      const crowd = S.foes.filter((f) => !f.dead && !f.harmless && Math.abs(f.x - bx) < 8).length;
      if (V && V.type === 'tank') { if (V.shells > 0 && front && d < 12 && (target.boss || crowd >= 2)) { inp.special = true; memo.specT = 1.2; } }
      else if (V && V.type === 'mech') { if (d < 3.4 && !target.air) { inp.special = true; memo.specT = 1.4; } }
      else if (P.balloons > 0 && front && d > 3 && d < 9 && !target.air && (target.boss || crowd >= 3)) { inp.special = true; memo.specT = S.level === 'easy' ? 1.6 : 2.2; }
    }
    // a ride about to break goes rolling into the baddies
    memo.bail = !!(V && V.hp <= 1 && target && sgn(target.x - bx) === V.face && Math.abs(target.x - bx) < 10);
    apply(S, P, inp, memo, true);
  }

  function landTime(b) {
    if (!b.g) return null;
    // y + vy t - g/2 t^2 = 0
    const a = -0.5 * b.g, B = b.vy, c = b.y;
    const disc = B * B - 4 * a * c;
    if (disc < 0) return null;
    const t = (-B - Math.sqrt(disc)) / (2 * a);
    return t > 0 ? t : null;
  }

  // does a shot from (mx, my) going at angle a pass through baddie f? (walks along the line in half-unit steps)
  function rayHits(f, mx, my, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const x0 = f.x - f.w / 2 - 0.3, x1 = f.x + f.w / 2 + 0.3, y0 = f.y - 0.3, y1 = f.y + (f.air ? f.h : Math.max(f.h, 1.35)) + 0.3;
    for (let d = 0; d < 17; d += 0.5) {
      const x = mx + c * d, y = my + s * d;
      if (x > x0 && x < x1 && y > y0 && y < y1) return true;
      if (y < -0.5) return false;
    }
    return false;
  }

  // the aims a move allows: [dy input, angle]
  function aims(face, dx, air) {
    const o = [[0, face > 0 ? 0 : Math.PI], [1, dx ? Math.atan2(1, face) : Math.PI / 2]];
    if (air) o.push([-1, dx ? Math.atan2(-1, face) : -Math.PI / 2]);
    return o;
  }

  // 0 if this move can aim right at the baddie, more the further off it is
  function aimCost(S, P, f, face, air, bx, by, dx) {
    if (!f) return 0;
    const my = by + (P.veh ? 1.2 : 1.25);
    const ang = Math.atan2(f.y + f.h / 2 - my, f.x - bx);
    let bd = 9;
    for (const [, a] of aims(face, dx, air)) {
      if (rayHits(f, bx, my, a)) return 0;
      let d = Math.abs(ang - a);
      if (d > Math.PI) d = Math.PI * 2 - d;
      bd = Math.min(bd, d);
    }
    return Math.min(1, 0.2 + bd);
  }

  function apply(S, P, inp, memo, fresh) {
    inp.dx = memo.dx;
    if (fresh && memo.turn) inp.dx = memo.turn;
    inp.dy = memo.duck ? -1 : memo.aimDy;
    const onGround = P.veh ? P.veh.ground : P.ground;
    // jumping needs a fresh press: let go for a tick, then hold it for a high jump
    if (memo.wantJump && onGround && memo.jumpT <= 0) {
      if (inp.jump) inp.jump = false;
      else { inp.jump = true; memo.jumpT = 0.32; memo.wantJump = false; }
    } else if (memo.jumpT > 0) inp.jump = true;
    else { inp.jump = false; if (!onGround) memo.wantJump = false; }
    if (memo.bail && fresh) {
      if (inp.jump) inp.jump = false;
      else { inp.dy = -1; inp.jump = true; memo.jumpT = 0; memo.bail = false; }
    }
    // a snowman wiggles to thaw faster
    if (P.form === 'snow') inp.fire = memo.n % 2 === 0;
    else inp.fire = memo.fire && !(S.clumsy && memo.n % 90 < 20);
  }

  JUG.brain = { drive };
})();
