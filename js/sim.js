/* JuggernauT: the rules. Players, blasters, baddies, rides, the cast, transformations, bosses, the companion and the
   camera, stepped at a fixed 60 ticks a second. No Three.js in here: the game draws what this says, and Node runs it
   headlessly for the soak (tools/check.js). Everything random comes from a seeded generator, so a run can be replayed.

   The world is side-on: x to the right, y up, the ground at y = 0. The screen shows VW = 22 units across. Bodies
   stand on their feet: (x, y) is the bottom middle. Things the game should show or play come out as S.events. */
(function () {
  'use strict';
  const JUG = (window.JUG = window.JUG || {});
  const VW = 22, VH = 12, GRAV = 34;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sgn = (v) => (v < 0 ? -1 : 1);

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 🐣 EASY is the default, for Tommy (5). 🔥 NORMAL is for Teddy (8).
  const LEVELS = {
    easy: {
      hearts: 6, maxHearts: 8, foeSpeed: 0.7, fireK: 0.5, shotSpeed: 0.62, shotSize: 1.5, count: 0.7, bossHp: 0.6,
      invuln: 3, balloons: 15, ammo: 1.5, rideHp: 6, revive: 6, teamCD: 12, buddyStay: 14, form: 0.7, warn: 1.5,
      hurt: 0.8, potionAfter: 6, bossRest: 1.5, coco: 30,
    },
    normal: {
      hearts: 4, maxHearts: 6, foeSpeed: 1, fireK: 1, shotSpeed: 1, shotSize: 1, count: 1, bossHp: 1,
      invuln: 2, balloons: 10, ammo: 1, rideHp: 4, revive: 10, teamCD: 20, buddyStay: 12, form: 1, warn: 1,
      hurt: 1, potionAfter: 7, bossRest: 1, coco: 25,
    },
  };

  // Blasters. ball and star are the brothers' own; the rest come from friends and crates and run out.
  const GUNS = {
    ball: { name: 'BASKETBALLS', rate: 0.17, speed: 16, r: 0.3, dmg: 1 },
    star: { name: 'PEACE STARS', rate: 0.17, speed: 18, r: 0.28, dmg: 1 },
    water: { name: 'WATER BLASTER', rate: 0.075, speed: 22, r: 0.22, dmg: 0.75, ammo: 200 },
    bubble: { name: 'BUBBLE GUN', rate: 0.22, speed: 12, r: 0.36, dmg: 1, ammo: 60, spread: 3 },
    foam: { name: 'MEGA FOAM CANNON', rate: 0.5, speed: 11, r: 0.55, dmg: 4, ammo: 30, splash: 1.8, homing: 3 },
    snow: { name: 'SNOWBALL LAUNCHER', rate: 0.38, speed: 17, r: 0.3, dmg: 1.3, ammo: 30, pellets: 5, life: 0.4, chill: 0.6 },
    bleh: { name: 'BLEH!', rate: 1.2, speed: 15, r: 1.3, dmg: 6, pierce: true, life: 1.8 }, // the zombie's goo blast
    mini: { name: 'MINI BLASTER', rate: 0.14, speed: 18, r: 0.18, dmg: 0.6 }, // the monkey's little one
  };
  const PICKUP_GUNS = ['water', 'bubble', 'foam', 'snow'];

  // The transformations. dur 0 = until a potion (a friend always brings one before long).
  const FORMS = {
    normal: { speed: 6.2, jump: 14 },
    zombie: { speed: 2.6, jump: 15, gun: 'bleh', dur: 0, wobble: true },
    mummy: { speed: 3, jump: 10.5, slowFire: 1.8, dur: 0 },
    monkey: { speed: 7.6, jump: 15.5, gun: 'mini', dur: 18, vines: true },
    chubby: { speed: 3.8, jump: 10.5, big: 1.8, dur: 14 },
    snow: { speed: 4.4, jump: 7.5, noFire: true, dur: 6, roll: true },
  };
  const TREATS = ['icecream', 'water', 'juice', 'cookie', 'watermelon', 'banana'];
  const POP_TREATS = ['icecream', 'cookie', 'donut', 'candy', 'watermelon', 'banana'];

  // The baddies. ai: walk (keeps its distance and shoots), shamble (zombies: walk up and bite), scuttle (crabs),
  // fly (drops things from above), hop (snow pups), none (crates).
  const FOES = {
    windup: { name: 'WIND-UP GUY', hp: 2, w: 0.9, h: 1.7, speed: 1.8, ai: 'walk', shot: 'cork', every: 2.6, range: [5, 9], score: 100 },
    tosser: { name: 'PIE DRUMMER', hp: 2, w: 0.9, h: 1.7, speed: 1.4, ai: 'walk', shot: 'pie', every: 3, range: [6, 11], score: 150 },
    robot: { name: 'BLOOP BOT', hp: 3, w: 1, h: 2, speed: 1.5, ai: 'walk', shot: 'bloop', every: 2.4, range: [6, 10], score: 200 },
    flyer: { name: 'PROPELLER GRUMP', hp: 3, w: 1.4, h: 1, speed: 2.4, ai: 'fly', shot: 'drop', every: 2.2, score: 200, air: true },
    zombie: { name: 'ZOMBIE', hp: 3, w: 0.9, h: 1.9, speed: 1.1, ai: 'shamble', bite: 'zombie', score: 150 },
    zfarmer: { name: 'ZOMBIE FARMER', hp: 4, w: 0.9, h: 1.9, speed: 1.3, ai: 'shamble', bite: 'zombie', score: 200 },
    crab: { name: 'GRUMPY CRAB', hp: 2, w: 1.2, h: 0.8, speed: 3.6, ai: 'scuttle', score: 100 },
    mummy: { name: 'MUMMY', hp: 4, w: 0.9, h: 1.9, speed: 1, ai: 'walk', shot: 'dust', every: 2.6, range: [2.5, 5], score: 200 },
    raybot: { name: 'BANANA-RAY BOT', hp: 3, w: 1, h: 1.9, speed: 1.4, ai: 'walk', shot: 'ray', every: 2.8, range: [5, 9], score: 200 },
    snowpup: { name: 'GRUMPY SNOW PUP', hp: 2, w: 1, h: 1.1, speed: 2.4, ai: 'hop', shot: 'ice', every: 2.8, range: [4, 9], score: 150 },
    crate: { name: 'CRATE', hp: 2, w: 1.2, h: 1.2, ai: 'none', harmless: true, score: 50 },
  };

  // What the baddies throw. All of it is big, round and slow (slower and bigger still on Easy).
  // form: what it turns you into. shootable: your shots can pop it.
  const SHOTS = {
    cork: { r: 0.3, speed: 6.5, shootable: true },
    pie: { r: 0.36, lob: true, shootable: true },
    bloop: { r: 0.34, speed: 5.5, shootable: true },
    drop: { r: 0.3, fall: true, shootable: true },
    dust: { r: 0.75, speed: 3, life: 1.6, form: 'mummy', shootable: true, hp: 2 },
    ray: { r: 0.3, speed: 7.5, form: 'monkey' },
    ice: { r: 0.34, lob: true, form: 'snow', shootable: true },
    goo: { r: 0.4, lob: true, form: 'zombie', shootable: true },
    wave: { r: 0.5, ground: true, speed: 7 },
    roll: { r: 0.9, ground: true, speed: 5.5 },
    bubble: { r: 0.45, speed: 3, float: true, shootable: true },
    banana: { r: 0.4, lob: true, splash: 1.2, shootable: true },
    beam: { beam: true, form: 'monkey' },
    icicle: { r: 0.4, icicle: true },
  };

  const RIDES = {
    tank: { name: 'TT TANK', w: 2.6, h: 2, speed: 5, jump: 12, seat: 1.2, gun: 'vulcan', rate: 0.08, dmg: 0.75, shells: 10 },
    llama: { name: 'LOLLY THE LLAMA', w: 2.2, h: 2.2, speed: 7, jump: 15, seat: 1.5, gun: 'saddle', rate: 0.1, dmg: 0.8 },
    mech: { name: 'BOING BOT', w: 2.2, h: 3, speed: 4.5, jump: 17, seat: 2.1, gun: 'fist', rate: 0.3, dmg: 2.5, hpBonus: 1 },
  };

  // The bosses, one per mission. They take turns: rest, wind up (so you can see what's coming), then do it.
  const BOSSES = {
    cranky: { name: 'KING CRANKY', hp: 150, w: 3.2, h: 5, speed: 1.6, attacks: ['corks', 'stomp', 'corks', 'minions'], minion: 'windup' },
    crab: { name: 'CAPTAIN CRABCAKE', hp: 170, w: 4.6, h: 3, speed: 3, attacks: ['bubbles', 'snap', 'leap', 'bubbles', 'minions'], minion: 'crab' },
    wrappy: { name: 'KING WRAPPY', hp: 180, w: 2.8, h: 4.6, fly: 2.6, speed: 1.4, attacks: ['dust', 'whip', 'dust', 'minions'], minion: 'mummy' },
    banana: { name: 'BIG BANANA BOT', hp: 190, w: 5, h: 2.4, fly: 8.2, speed: 2.4, attacks: ['ray', 'bananas', 'ray', 'minions'], minion: 'raybot' },
    freeze: { name: 'FREEZE-POP KING', hp: 210, w: 3.6, h: 5, speed: 1.4, attacks: ['ice', 'roll', 'icicles', 'minions'], minion: 'snowpup' },
    zorg: { name: 'ZOMBIE ZORG', hp: 260, w: 4, h: 6.2, speed: 1.2, attacks: ['goo', 'stomp', 'minions', 'goo', 'dust', 'ice'], minion: 'zombie' },
  };

  const HELLO = { teddy: ['boxing', 'jumpshot'], tommy: ['peace'] };

  class Sim {
    // o: { mission (1-6), missionData, level, players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], seed, auto,
    //      immortal, noGuns, bossHpK, startX, buddyFor(id) }
    constructor(o = {}) {
      this.missionNo = o.mission || 1;
      this.M = o.missionData || JUG.MISSIONS[this.missionNo - 1];
      this.level = o.level === 'normal' ? 'normal' : 'easy';
      this.L = LEVELS[this.level];
      this.rand = rng(o.seed || 1);
      this.two = (o.players || ['teddy']).length === 2;
      this.immortal = !!o.immortal;
      this.noGuns = !!o.noGuns;
      this.bossHpK = o.bossHpK || 1;
      this.buddyFor = o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy'));
      this.t = 0;
      this.nextId = 1;
      this.events = [];
      this.foes = [];
      this.shots = []; // the brothers' (and their helpers')
      this.fshots = []; // the baddies'
      this.items = [];
      this.pows = [];
      this.rides = [];
      this.drops = [];
      this.folk = [];
      this.birds = [];
      this.later = [];
      this.buddy = null;
      this.coco = null;
      this.lock = null;
      this.boss = null;
      this.phase = 'play';
      this.cleared = false;
      this.over = false;
      this.overT = 0;
      this.clearT = 0;
      this.teamCD = 0;
      this.startX = o.startX || 0;
      this.camL = Math.max(0, this.startX);
      this.camR = this.camL + VW;
      this.checkpoint = this.startX;
      this.beats = this.M.beats.slice().sort((a, b) => a[0] - b[0]);
      this.evI = 0;
      while (this.evI < this.beats.length && this.beats[this.evI][0] < this.camR - 2 && this.startX > 0) this.evI++;
      this.plats = (this.M.plats || []).map(([x0, x1, y]) => ({ x0, x1, y }));
      this.vines = (this.M.vines || []).map(([x, top, len], k) => ({ id: k, x, top, len }));
      this.stats = {
        hits: 0, pops: 0, saves: 0, treats: 0, calls: 0, buddyPops: 0, rescues: 0, rides: 0, bails: 0, ridePops: 0,
        forms: { zombie: 0, mummy: 0, monkey: 0, chubby: 0, snow: 0 }, cures: 0, coins: 0, specials: 0, teamups: 0,
        bossTime: 0, potionDrops: 0, cocoPops: 0, idleT: 0, maxIdle: 0, swings: 0, revives: 0, guards: 0,
      };
      this.players = (o.players || ['teddy']).map((kind, i) => this.makePlayer(kind, i));
      this.input = this.players.map(() => ({ dx: 0, dy: 0, jump: false, fire: false, special: false }));
      const auto = o.auto;
      this.auto = this.players.map((_, i) => (Array.isArray(auto) ? !!auto[i] : !!auto));
      this.lastCamL = this.camL;
    }

    makePlayer(kind, i) {
      const L = this.L;
      const base = kind === 'tommy' ? 'star' : 'ball';
      return {
        i, kind, base, gun: base, ammo: 0, x: this.camL + 3.2 - i * 1.5, y: 0, vx: 0, vy: 0, face: 1, ax: 1, ay: 0,
        ground: true, plat: null, crouch: false, hearts: L.hearts, maxHearts: L.maxHearts, invulnT: 1, shieldT: 0,
        form: 'normal', formT: 0, formAge: 0, potionAskT: 0, balloons: L.balloons, fireCD: 0, out: false, outT: 0,
        score: 0, veh: null, exitT: 0, vine: null, treatT: [], dropT: 0, jumpCut: true, hurtT: 9, sig: null, sigT: 0,
        prevJump: false, prevSpecial: false, prevFire: false, coins: 0, rescues: 0, shotN: 0, wobble: 0,
      };
    }

    id() { return this.nextId++; }
    emit(type, o) { this.events.push(Object.assign({ type, t: this.t }, o)); }
    active() { return this.players.filter((P) => !P.out); }
    nearestPlayer(x, y = 1) {
      let best = null, bd = 1e9;
      for (const P of this.players) {
        if (P.out) continue;
        const d = Math.abs(P.x - x) + Math.abs(P.y - y) * 0.3;
        if (d < bd) { bd = d; best = P; }
      }
      return best;
    }
    onScreen(x, m = 0.3) { return x > this.camL + m && x < this.camR - m; }
    score() { return this.players.reduce((s, P) => s + P.score, 0); }

    // ------------------------------------------------------------------ bodies and the ground

    // Move a body (anything with x, y, vx, vy, ground) and land it on the ground or a one-way ledge.
    moveBody(o, dt, g = GRAV) {
      const prevY = o.y;
      o.vy -= g * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.ground = false;
      if (o.vy <= 0) {
        if (o.y <= 0) { o.y = 0; o.vy = 0; o.ground = true; o.plat = null; return; }
        if (!(o.dropT > 0)) {
          for (const p of this.plats) {
            if (o.x > p.x0 && o.x < p.x1 && prevY >= p.y - 0.001 && o.y <= p.y) {
              o.y = p.y; o.vy = 0; o.ground = true; o.plat = p;
              return;
            }
          }
        }
      }
      o.plat = null;
    }

    platAt(x, y) {
      for (const p of this.plats) if (x > p.x0 && x < p.x1 && Math.abs(y - p.y) < 0.05) return p;
      return null;
    }

    // ------------------------------------------------------------------ the main step

    step(dt) {
      this.t += dt;
      const L = this.L;
      if (this.teamCD > 0) this.teamCD -= dt;
      if (JUG.brain) for (let i = 0; i < this.players.length; i++) if (this.auto[i]) JUG.brain.drive(this, i);
      for (let i = 0; i < this.players.length; i++) this.updatePlayer(this.players[i], this.input[i], dt);
      this.updateRides(dt);
      this.updateCamera(dt);
      this.updateLater();
      this.updateLock(dt);
      for (const f of this.foes) if (!f.dead) (f.boss ? this.bossThink(f, dt) : this.foeThink(f, dt));
      this.updateShots(dt);
      this.updateFoeShots(dt);
      this.contact();
      this.updateItems(dt);
      this.updatePows(dt);
      this.updateDrops(dt);
      this.updateBuddy(dt);
      this.updateCoco(dt);
      this.updateScenery(dt);
      this.safetyPotion();
      this.foes = this.foes.filter((f) => !f.dead && f.x < this.camR + 40 && (f.x > this.camL - 1.5 || (f.x > this.camL - 3.5 && f.t < 3 && !f.home)));
      // the end
      if (this.boss && this.boss.dead && !this.cleared) {
        this.clearT += dt;
        if (this.clearT > 2.6) { this.cleared = true; this.phase = 'cleared'; this.emit('clear'); }
      }
      if (!this.over && !this.cleared) {
        const out = this.players.every((P) => P.out);
        if (out) {
          this.overT += dt;
          if (this.overT > 1.6) { this.over = true; this.phase = 'over'; this.emit('over'); }
        }
      }
      if (this.phase === 'boss' && this.boss && !this.boss.dead) this.stats.bossTime += dt;
      // "stuck" watch: how long since the screen moved or a baddie popped
      if (this.camL > this.lastCamL + 0.01) { this.lastCamL = this.camL; this.stats.idleT = 0; }
      else this.stats.idleT += dt;
      this.stats.maxIdle = Math.max(this.stats.maxIdle, this.stats.idleT);
      void L;
    }

    // ------------------------------------------------------------------ the brothers

    updatePlayer(P, inp, dt) {
      const L = this.L;
      P.invulnT -= dt; P.shieldT -= dt; P.exitT -= dt; P.fireCD -= dt; P.dropT -= dt; P.sigT -= dt; P.hurtT += dt;
      P.potionAskT -= dt;
      const jumpPress = inp.jump && !P.prevJump, specPress = inp.special && !P.prevSpecial, firePress = inp.fire && !P.prevFire;
      P.prevJump = inp.jump; P.prevSpecial = inp.special; P.prevFire = inp.fire;
      if (P.out) {
        P.outT += dt;
        // 2 players: a bonked-out brother comes back by himself after a little rest
        if (this.two && !this.over && P.outT > L.revive && this.players.some((Q) => !Q.out)) this.revive(P);
        return;
      }
      if (P.form !== 'normal') {
        P.formAge += dt;
        if (P.formT > 0) {
          P.formT -= dt;
          if (P.form === 'snow' && (jumpPress || firePress)) P.formT -= 0.25; // wiggle out faster
          if (P.form === 'chubby') P.formT -= Math.abs(P.vx) * dt * 0.05; // running burns it off
          if (P.formT <= 0) this.cure(P, 'time');
        }
      }
      const F = FORMS[P.form];
      if (P.veh) { this.driveRide(P.veh, P, inp, jumpPress, specPress, dt); return; }
      if (P.vine) { this.swing(P, inp, jumpPress, dt); this.aimAndFire(P, inp, specPress); return; }

      // climb aboard a ride by walking (or jumping) into it
      if (P.exitT <= 0 && P.form !== 'snow') {
        for (const V of this.rides) {
          if (V.state !== 'parked' || V.rider) continue;
          const R = RIDES[V.type];
          if (Math.abs(P.x - V.x) < R.w / 2 && P.y < V.y + R.h && P.y + 1.8 > V.y) { this.board(P, V); return; }
        }
      }

      const dx = Math.abs(inp.dx) > 0.3 ? sgn(inp.dx) : 0, dy = inp.dy;
      P.crouch = P.ground && dy < -0.5 && !F.roll;
      let speed = F.speed * (P.crouch ? 0.4 : 1);
      if (F.wobble) { P.wobble += dt * 6; speed *= 0.75 + 0.35 * Math.sin(P.wobble); }
      P.vx += (dx * speed - P.vx) * Math.min(1, dt * (P.ground ? 16 : 8));
      if (dx) P.face = dx;
      if (jumpPress && P.ground) {
        if (dy < -0.5 && P.plat) { P.dropT = 0.3; P.ground = false; P.y -= 0.05; }
        else { P.vy = F.jump; P.ground = false; P.jumpCut = false; this.emit('jump', { i: P.i, form: P.form }); }
      }
      if (!inp.jump && P.vy > 0 && !P.jumpCut) { P.vy *= 0.5; P.jumpCut = true; }
      const wasGround = P.ground;
      this.moveBody(P, dt);
      if (P.ground && !wasGround) this.emit('land', { i: P.i });
      P.x = clamp(P.x, this.camL + 0.6, this.camR - 0.6);
      // a monkey grabs vines
      if (F.vines && !P.ground && P.vy < 4) {
        for (const v of this.vines) {
          const hy = P.y + 1.5;
          if (Math.abs(P.x - v.x) < 0.7 && hy < v.top - 0.6 && hy > v.top - v.len) {
            const l = v.top - hy;
            P.vine = { v, l, ang: clamp(Math.atan2(P.x - v.x, l), -0.6, 0.6), w: clamp(P.vx / l, -2, 2) };
            this.stats.swings++;
            this.emit('vine', { i: P.i });
            break;
          }
        }
      }
      // a snowman rolls over baddies: BONK
      if (F.roll && Math.abs(P.vx) > 1) {
        for (const f of this.foes) {
          if (f.dead || f.boss || (f.rollT || 0) > this.t) continue;
          if (Math.abs(f.x - P.x) < f.w / 2 + 0.6 && P.y < f.y + f.h && P.y + 1.2 > f.y) {
            f.rollT = this.t + 0.4;
            this.damage(f, 2, { owner: P.i, kind: 'roll' });
          }
        }
      }
      this.aimAndFire(P, inp, specPress);
    }

    aimAndFire(P, inp, specPress) {
      const F = FORMS[P.form];
      const dx = Math.abs(inp.dx) > 0.3 ? sgn(inp.dx) : 0, dy = inp.dy;
      let ax = P.face, ay = 0;
      if (dy > 0.5) { ay = 1; ax = dx; }
      else if (dy < -0.5 && !P.ground) { ay = -1; ax = dx; }
      const n = Math.hypot(ax, ay) || 1;
      P.ax = ax / n; P.ay = ay / n;
      if (inp.fire && P.fireCD <= 0 && !F.noFire && !this.noGuns) this.fire(P);
      if (specPress) this.throwBalloon(P);
    }

    muzzle(P) {
      const hy = P.vine ? P.y + 1.2 : P.y + (P.crouch ? 0.8 : 1.25);
      return [P.x + P.ax * 0.55, hy + P.ay * 0.45];
    }

    fire(P) {
      const F = FORMS[P.form];
      const gun = F.gun || P.gun;
      const g = GUNS[gun];
      P.fireCD = g.rate * (F.slowFire || 1);
      P.shotN++;
      const big = F.big || 1;
      const [mx, my] = this.muzzle(P);
      const base = { team: 'p', owner: P.i, kind: gun, r: g.r * big, dmg: g.dmg * (big > 1 ? 1.6 : 1), life: g.life || 1.6 };
      if (gun === 'bleh') {
        // the zombie's huge green goo blast: straight ahead, through everything, across the whole screen
        this.addShot(Object.assign(base, { x: P.x + P.face * 0.8, y: P.y + 1.1, vx: P.face * g.speed, vy: 0, pierce: new Set(), life: g.life }));
        this.emit('bleh', { i: P.i, x: P.x, y: P.y + 1.1, face: P.face });
        return;
      }
      const ang = Math.atan2(P.ay, P.ax);
      if (g.spread) {
        for (const a of [-0.2, 0, 0.2]) this.addShot(Object.assign({}, base, { x: mx, y: my, vx: Math.cos(ang + a) * g.speed, vy: Math.sin(ang + a) * g.speed }));
      } else if (g.pellets) {
        for (let k = 0; k < g.pellets; k++) {
          const a = ang + (k - (g.pellets - 1) / 2) * 0.13;
          this.addShot(Object.assign({}, base, { x: mx, y: my, vx: Math.cos(a) * g.speed * (0.9 + this.rand() * 0.2), vy: Math.sin(a) * g.speed, chill: g.chill }));
        }
      } else {
        this.addShot(Object.assign(base, { x: mx, y: my, vx: P.ax * g.speed, vy: P.ay * g.speed, splash: g.splash, homing: g.homing }));
      }
      if (g.ammo) {
        P.ammo--;
        if (P.ammo <= 0) { P.gun = P.base; P.ammo = 0; this.emit('gunOut', { i: P.i }); }
      }
      if (P.shotN % 3 === 1) this.emit('shot', { i: P.i, gun, x: mx, y: my });
    }

    // the special: a water balloon lobbed ahead that goes SPLASH
    throwBalloon(P, from) {
      if (P.balloons <= 0 || this.noGuns) { this.emit('nope', { i: P.i, what: 'balloons' }); return false; }
      P.balloons--;
      this.stats.specials++;
      const up = P.ay > 0.5;
      const x = from ? from.x : P.x, y = from ? from.y : P.y + 1.5;
      this.addShot({ team: 'p', owner: P.i, kind: 'balloon', x, y, vx: P.face * (up ? 4.5 : 7.5) + P.vx * 0.3, vy: up ? 13 : 8.5, g: 22, r: 0.35, dmg: 5, splash: 2.4, boom: true, life: 4 });
      this.emit('throw', { i: P.i });
      return true;
    }

    addShot(b) {
      b.id = this.id();
      b.t = 0;
      this.shots.push(b);
      return b;
    }

    swing(P, inp, jumpPress, dt) {
      const V = P.vine, l = V.l;
      const dx = Math.abs(inp.dx) > 0.3 ? sgn(inp.dx) : 0;
      if (dx) P.face = dx;
      V.w += (-(GRAV * 0.5) / l * Math.sin(V.ang) + dx * 2.2) * dt;
      V.w *= 1 - dt * 0.3;
      V.ang = clamp(V.ang + V.w * dt, -1.25, 1.25);
      P.x = V.v.x + Math.sin(V.ang) * l;
      P.y = V.v.top - Math.cos(V.ang) * l - 1.5;
      P.ground = false;
      const go = jumpPress || P.form !== 'monkey' || P.x < this.camL + 0.6 || P.x > this.camR - 0.6;
      if (go) {
        P.vx = clamp(Math.cos(V.ang) * l * V.w, -12, 12);
        P.vy = Math.sin(V.ang) * l * V.w * 0.3 + (jumpPress ? 10 : 0);
        P.jumpCut = true;
        P.vine = null;
        P.x = clamp(P.x, this.camL + 0.6, this.camR - 0.6);
        this.emit('jump', { i: P.i, form: P.form });
      }
    }

    // A hit. o: { form } for the things that turn you into something, { kind } for the toast.
    hurt(P, o = {}) {
      if (P.out || P.invulnT > 0 || P.shieldT > 0) return false;
      const B = this.buddy;
      if (B && B.phase !== 'out' && !this.noGuard) {
        // the companion jumps in the way: TOMMY SAVED YOU!
        P.invulnT = 1;
        this.stats.saves++;
        B.saveT = 0.6;
        this.emit('saved', { i: P.i, kind: B.kind, x: P.x, y: P.y });
        return true;
      }
      if (P.veh) return this.hurtRide(P.veh, o);
      if (o.form && P.form !== o.form && !this.immortal) {
        this.transform(P, o.form);
        P.invulnT = 1.2;
        return true;
      }
      // mummy dust on a mummy (or goo on a zombie, a banana ray on a monkey) just tickles
      if (o.form && P.form === o.form) { P.invulnT = 0.5; this.emit('tickle', { i: P.i, x: P.x, y: P.y }); return true; }
      P.invulnT = this.L.invuln;
      P.hurtT = 0;
      this.stats.hits++;
      if (!this.immortal) P.hearts--;
      P.vx = -P.face * 4;
      P.vy = Math.max(P.vy, 6);
      if (P.vine) P.vine = null;
      this.emit('hurt', { i: P.i, x: P.x, y: P.y, hearts: P.hearts });
      if (P.form === 'snow') this.cure(P, 'pop');
      if (P.hearts <= 0) {
        P.out = true;
        P.outT = 0;
        P.vx = 0;
        P.form = 'normal';
        this.emit('out', { i: P.i, x: P.x, y: P.y });
      }
      return true;
    }

    transform(P, form) {
      const F = FORMS[form];
      P.form = form;
      P.formT = F.dur ? F.dur * (form === 'snow' || form === 'chubby' ? this.L.form : 1) : 0;
      P.formAge = 0;
      P.vine = null;
      P.treatT.length = 0;
      this.stats.forms[form]++;
      this.emit('form', { i: P.i, form, x: P.x, y: P.y });
    }

    cure(P, why) {
      if (P.form === 'normal') return false;
      const was = P.form;
      P.form = 'normal';
      P.formT = 0;
      P.vine = null;
      this.stats.cures++;
      this.emit('cure', { i: P.i, form: was, why, x: P.x, y: P.y });
      return true;
    }

    revive(P, near) {
      const Q = near || this.players.find((Q2) => Q2 !== P && !Q2.out) || P;
      P.out = false;
      P.hearts = Math.max(P.hearts, 3);
      P.x = clamp(Q.x - Q.face * 1.2, this.camL + 0.6, this.camR - 0.6);
      P.y = Q.y + 2;
      P.vy = 4;
      P.invulnT = 2.5;
      P.form = 'normal';
      this.stats.revives++;
      this.emit('revive', { i: P.i, x: P.x, y: P.y });
    }

    // ------------------------------------------------------------------ rides

    addRide(type, x) {
      const R = RIDES[type];
      const hp = this.L.rideHp + (R.hpBonus || 0);
      const V = { id: this.id(), type, x, y: 0, vx: 0, vy: 0, hp, maxHp: hp, rider: null, face: 1, aimA: 0, fireCD: 0, shells: R.shells || 0, ground: true, invulnT: 0, state: 'parked', t: 0, warned: false, pound: false, plat: null, squat: false };
      this.rides.push(V);
      return V;
    }

    board(P, V) {
      P.veh = V;
      V.rider = P;
      V.state = 'ridden';
      V.face = P.face;
      V.aimA = P.face > 0 ? 0 : Math.PI;
      P.vine = null;
      this.stats.rides++;
      this.emit('board', { i: P.i, ride: V.type, x: V.x });
    }

    leaveRide(P, bail) {
      const V = P.veh;
      if (!V) return;
      P.veh = null;
      V.rider = null;
      P.vy = 12;
      P.vx = -V.face * 2;
      P.y = V.y + RIDES[V.type].seat;
      P.ground = false;
      P.jumpCut = true;
      P.exitT = 1;
      P.invulnT = Math.max(P.invulnT, 0.8);
      if (bail) {
        // it's about to break: send it rolling into the baddies as one big bonk
        V.state = 'bomb';
        V.vx = V.face * 10;
        V.t = 0;
        this.stats.bails++;
        this.emit('bail', { i: P.i, ride: V.type, x: V.x });
      } else {
        V.state = 'parked';
        V.vx = 0;
        this.emit('exit', { i: P.i, ride: V.type, x: V.x });
      }
    }

    hurtRide(V, o) {
      if (V.invulnT > 0) return true;
      V.hp--;
      V.invulnT = this.L === LEVELS.easy ? 1.4 : 1;
      this.emit('rideHit', { ride: V.type, x: V.x, y: V.y, hp: V.hp });
      if (V.hp === 1 && !V.warned) { V.warned = true; this.emit('bailWarn', { i: V.rider ? V.rider.i : 0, ride: V.type }); }
      if (V.hp <= 0) {
        const P = V.rider;
        V.state = 'gone';
        V.rider = null;
        this.stats.ridePops++;
        this.emit('ridePop', { ride: V.type, x: V.x, y: V.y });
        if (P) {
          P.veh = null;
          P.vy = 13;
          P.y = V.y + RIDES[V.type].seat;
          P.ground = false;
          P.jumpCut = true;
          P.exitT = 1.2;
          P.invulnT = 2.5;
        }
      }
      void o;
      return true;
    }

    driveRide(V, P, inp, jumpPress, specPress, dt) {
      const R = RIDES[V.type];
      const dx = Math.abs(inp.dx) > 0.3 ? sgn(inp.dx) : 0, dy = inp.dy;
      if (jumpPress && dy < -0.5) { this.leaveRide(P, V.hp <= 1); return; }
      V.squat = V.type === 'tank' && V.ground && dy < -0.5;
      V.vx += (dx * R.speed * (V.squat ? 0.5 : 1) - V.vx) * Math.min(1, dt * 10);
      if (dx) V.face = dx;
      if (jumpPress && V.ground) { V.vy = R.jump; this.emit('jump', { i: P.i, ride: V.type }); }
      const wasGround = V.ground;
      this.moveBody(V, dt, V.pound ? GRAV * 1.6 : GRAV);
      V.x = clamp(V.x, this.camL + R.w / 2, this.camR - R.w / 2);
      if (V.ground && !wasGround) {
        this.emit('land', { i: P.i, ride: V.type });
        if (V.pound) {
          V.pound = false;
          this.explode(V.x, 0.6, 3.4, 5, { owner: P.i, kind: 'pound' });
          this.emit('pound', { x: V.x, y: V.y });
        }
      }
      P.x = V.x; P.y = V.y + R.seat; P.vx = V.vx; P.vy = V.vy; P.ground = V.ground; P.face = V.face;
      // aim like on foot
      let ax = V.face, ay = 0;
      if (dy > 0.5) { ay = 1; ax = dx; }
      else if (dy < -0.5 && !V.ground) { ay = -1; ax = dx; }
      const n = Math.hypot(ax, ay) || 1;
      P.ax = ax / n; P.ay = ay / n;
      const want = Math.atan2(P.ay, P.ax);
      let da = want - V.aimA;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      V.aimA += clamp(da, -12 * dt, 12 * dt);
      V.fireCD -= dt;
      if (inp.fire && V.fireCD <= 0 && !this.noGuns) {
        V.fireCD = R.rate;
        P.shotN++;
        if (R.gun === 'vulcan') {
          const a = V.aimA + (this.rand() - 0.5) * 0.08;
          this.addShot({ team: 'p', owner: P.i, kind: 'vulcan', x: V.x + Math.cos(a) * 1.3, y: V.y + 1.15 + Math.sin(a) * 1.2, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22, r: 0.25, dmg: R.dmg, life: 1.4 });
        } else if (R.gun === 'saddle') {
          const a = P.ay > 0.5 ? (P.ax ? Math.atan2(1, P.ax) : Math.PI / 2) : V.face > 0 ? 0 : Math.PI;
          this.addShot({ team: 'p', owner: P.i, kind: 'vulcan', x: V.x + V.face * 1.1, y: V.y + 1.2, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, r: 0.26, dmg: R.dmg, life: 1.4 });
        } else {
          this.addShot({ team: 'p', owner: P.i, kind: 'fist', x: V.x + P.ax * 1.3, y: V.y + 1.25 + P.ay * 1, vx: P.ax * 16, vy: P.ay * 16, r: 0.5, dmg: R.dmg, life: 1.2 });
        }
        if (P.shotN % 3 === 1) this.emit('shot', { i: P.i, gun: R.gun, x: V.x, y: V.y + 1.5 });
      }
      if (specPress) {
        if (V.type === 'tank') {
          if (V.shells > 0) {
            V.shells--;
            this.stats.specials++;
            const a = V.aimA;
            this.addShot({ team: 'p', owner: P.i, kind: 'shell', x: V.x + Math.cos(a) * 1.5, y: V.y + 1.5 + Math.sin(a) * 1.5, vx: Math.cos(a) * 15, vy: Math.sin(a) * 15 + 2, g: 8, r: 0.4, dmg: 7, splash: 2.5, boom: true, life: 3 });
            this.emit('cannon', { i: P.i, x: V.x, y: V.y });
          } else this.emit('nope', { i: P.i, what: 'shells' });
        } else if (V.type === 'mech') {
          if (!V.pound) { V.pound = true; V.vy = V.ground ? 9 : -20; this.stats.specials++; this.emit('poundUp', { i: P.i }); }
        } else this.throwBalloon(P, { x: V.x, y: V.y + 2.2 });
      }
      V.invulnT -= dt;
    }

    updateRides(dt) {
      for (const V of this.rides) {
        if (V.state === 'parked') {
          this.moveBody(V, dt);
          V.vx *= 0.9;
        } else if (V.state === 'bomb') {
          V.t += dt;
          this.moveBody(V, dt);
          let boom = V.t > 1.4 || V.x > this.camR - 1 || V.x < this.camL + 1;
          for (const f of this.foes) if (!f.dead && !f.harmless && Math.abs(f.x - V.x) < f.w / 2 + 1.2 && f.y < V.y + 2) boom = true;
          if (boom) {
            V.state = 'gone';
            this.explode(V.x, V.y + 1, 3.6, 12, { owner: 0, kind: 'rideBoom' });
            this.emit('rideBoom', { ride: V.type, x: V.x, y: V.y });
          }
        }
      }
      this.rides = this.rides.filter((V) => V.state !== 'gone' && (V.rider || V.x > this.camL - 8));
    }

    // ------------------------------------------------------------------ the camera and the mission's beats

    updateCamera(dt) {
      const act = this.active();
      if (!act.length) return;
      let lead = -1e9, trail = 1e9;
      for (const P of act) { lead = Math.max(lead, P.x); trail = Math.min(trail, P.x); }
      const maxL = this.lock ? this.lock.x - VW : this.M.len - VW;
      let target = lead - VW * 0.42;
      if (act.length > 1) target = Math.min(target, trail - 0.8); // never push the slower brother off the left edge
      target = Math.min(target, maxL);
      if (target > this.camL) this.camL = Math.min(target, this.camL + 14 * dt);
      this.camR = this.camL + VW;
      const LOOK = { foe: 1.5, lock: 0, boss: 0 };
      while (this.evI < this.beats.length) {
        const b = this.beats[this.evI];
        const la = LOOK[b[1]] === undefined ? 4 : LOOK[b[1]];
        if (this.camR + la < b[0]) break;
        if (this.lock && b[1] === 'lock') break;
        this.evI++;
        this.beat(b);
      }
      if (!this.lock && this.phase === 'play' && this.camR >= this.M.len - 0.01 && this.evI >= this.beats.length) this.startBoss();
    }

    beat(b) {
      const [x, kind, a, n, o] = b;
      const L = this.L;
      if (kind === 'foe') {
        const opt = o || {};
        const count = Math.max(1, Math.round(n * L.count));
        for (let k = 0; k < count; k++) this.later.push({ at: this.t + k * (opt.gap || 1), type: a, side: opt.side || 'R', plat: opt.plat, y: opt.y, nearX: x });
      } else if (kind === 'lock') {
        this.lock = { x, waves: a, i: 0, t: 0 };
        this.camL = Math.min(this.camL, x - VW);
        this.camR = this.camL + VW;
        this.checkpoint = this.camL;
        this.emit('lock', { x });
      } else if (kind === 'pow') {
        this.pows.push({ id: this.id(), x, y: typeof n === 'number' ? n : 0, state: 'tied', t: 0, carry: a, face: -1, target: 0 });
      } else if (kind === 'crate') {
        const f = this.spawnFoe('crate', x, typeof n === 'number' ? n : 0);
        f.carry = a;
      } else if (kind === 'drop') {
        this.addDrop(x, a);
      } else if (kind === 'ride') {
        this.addRide(a, x);
      } else if (kind === 'folk') {
        for (let k = 0; k < (n || 1); k++) this.folk.push({ id: this.id(), kind: a, x: x + k * 1.6, z: -2.2 - (k % 2) * 0.8, cheerT: 0, cheered: false, seed: this.rand() });
      } else if (kind === 'birds') {
        for (let k = 0; k < (a || 4); k++) this.birds.push({ id: this.id(), x: x + this.rand() * 4, y: this.rand() < 0.4 ? 3.2 : 0, state: 'sit', t: 0, vx: 0, vy: 0, seed: this.rand() });
      }
    }

    updateLater() {
      for (let k = this.later.length - 1; k >= 0; k--) {
        const s = this.later[k];
        if (this.t < s.at) continue;
        this.later.splice(k, 1);
        this.spawnFrom(s);
      }
    }

    // a baddie arrives: from the right edge, the left edge, the sky, or dropping onto a ledge
    spawnFrom(s) {
      const def = FOES[s.type];
      if (def.air || s.side === 'air') return this.spawnFoe(s.type, this.camR + 1.5, s.y || 7 + this.rand() * 2);
      if (s.plat) {
        let best = null, bd = 1e9;
        for (const p of this.plats) {
          const d = Math.abs((p.x0 + p.x1) / 2 - s.nearX);
          if (d < bd) { bd = d; best = p; }
        }
        if (best) {
          const fx = clamp(this.camR - 2.5, best.x0 + 0.8, best.x1 - 0.8);
          const f = this.spawnFoe(s.type, fx, VH + 1);
          f.vy = -2;
          f.home = best;
          return f;
        }
      }
      if (s.side === 'L') return this.spawnFoe(s.type, this.camL - 1.4, 0);
      return this.spawnFoe(s.type, this.camR + 1.4, 0);
    }

    spawnFoe(type, x, y, extra) {
      const d = FOES[type] || FOES.crate;
      const f = {
        id: this.id(), type, x, y, vx: 0, vy: 0, face: -1, hp: d.hp, maxHp: d.hp, w: d.w, h: d.h, t: 0, dead: false,
        fireT: 1 + this.rand() * 1.5, wind: 0, flashT: 0, chillT: 0, ground: y <= 0, harmless: !!d.harmless, air: !!d.air,
        home: null, hopT: this.rand(), seed: this.rand(), turnT: 0, dropT: 0,
      };
      if (extra) Object.assign(f, extra);
      this.foes.push(f);
      this.emit('spawn', { id: f.id, foe: type, boss: f.boss, x, y });
      return f;
    }

    updateLock(dt) {
      const k = this.lock;
      if (!k || k.boss || k.test) return;
      k.t += dt;
      while (k.i < k.waves.length && k.t >= k.waves[k.i][0]) {
        const [, type, n, side] = k.waves[k.i++];
        const count = Math.max(1, Math.round(n * this.L.count));
        for (let j = 0; j < count; j++) this.later.push({ at: this.t + j * 0.7, type, side: side || (FOES[type].air ? 'air' : 'R'), lock: true, nearX: k.x });
      }
      if (k.i < k.waves.length || this.later.some((s) => s.lock)) return;
      if (this.foes.some((f) => !f.dead && !f.harmless)) return;
      this.lock = null;
      this.emit('go', {});
    }

    startBoss() {
      const key = this.M.boss;
      const D = BOSSES[key];
      this.phase = 'boss';
      this.lock = { x: this.M.len, boss: true };
      this.checkpoint = this.M.len - VW;
      const hp = Math.round(D.hp * this.L.bossHp * this.bossHpK);
      const f = this.spawnFoe('boss', this.camR + 4, D.fly ? VH + 2 : 0, {
        boss: key, name: D.name, hp, maxHp: hp, w: D.w, h: D.h, harmless: false, carry: null,
        state: 'enter', st: 0, atkI: 0, atk: null, fly: D.fly || 0, air: !!D.fly,
      });
      this.boss = f;
      this.emit('bossWarn', { boss: key, name: D.name });
    }

    // ------------------------------------------------------------------ the baddies

    foeThink(f, dt) {
      const d = FOES[f.type];
      const L = this.L;
      f.t += dt;
      f.flashT -= dt;
      if (d.ai === 'none') { this.moveBody(f, dt); return; }
      const P = this.nearestPlayer(f.x, f.y);
      const chill = f.chillT > 0 ? 0.35 : 1;
      f.chillT -= dt;
      const sp = d.speed * L.foeSpeed * chill;
      const on = this.onScreen(f.x, 0.5);
      if (!P) { f.vx = 0; if (!d.air) this.moveBody(f, dt); return; }
      const dx = P.x - f.x, dist = Math.abs(dx);
      if (d.ai === 'fly') {
        if (f.x > this.camR - 1) f.vx = -sp * 1.4;
        else {
          const tx = clamp(P.x + Math.sin(f.t * 0.7 + f.seed * 6) * 3.5, this.camL + 1.5, this.camR - 1.5);
          f.vx += (clamp(tx - f.x, -sp, sp) - f.vx) * Math.min(1, dt * 2);
        }
        f.x += f.vx * dt;
        const ty = 7.2 + Math.sin(f.t * 1.3 + f.seed * 5) * 0.8;
        if (f.y > ty) f.y = Math.max(ty, f.y - 4 * dt);
        else f.y += (ty - f.y) * Math.min(1, dt * 2);
        f.face = f.vx < 0 ? -1 : 1;
        this.foeFire(f, P, dt, on && dist < 3.5);
        return;
      }
      f.face = sgn(dx);
      let want = 0;
      if (f.wind > 0) want = 0;
      else if (d.ai === 'shamble') want = sgn(dx) * sp * (0.75 + 0.35 * Math.sin(f.t * 4 + f.seed * 6));
      else if (d.ai === 'scuttle') {
        if (f.turnT > 0) { f.turnT -= dt; want = 0; }
        else {
          if (!f.dir) f.dir = sgn(dx);
          if (f.dir !== sgn(dx) && dist > 2.5) { f.dir = sgn(dx); f.turnT = 0.5; }
          want = f.dir * sp;
          f.face = f.dir;
        }
      } else if (d.ai === 'hop') {
        if (f.ground) {
          f.hopT -= dt;
          f.vx *= 0.8;
          if (f.hopT <= 0 && f.wind <= 0) {
            f.hopT = 1 + this.rand() * 0.5;
            const away = dist < d.range[0] && f.x > this.camL + 2 && f.x < this.camR - 2, far = dist > d.range[1] || !on;
            if (far || away) { f.vy = 7; f.vx = (away ? -1 : 1) * sgn(dx) * sp * 1.4; f.ground = false; }
          }
        }
        want = null;
      } else {
        // walk: keep a comfy distance and throw things
        const [near, far] = d.range;
        if (!on) want = sgn(this.camL + VW / 2 - f.x) * sp;
        else if (dist > far) want = sgn(dx) * sp;
        else if (dist < near && f.x > this.camL + 1.5 && f.x < this.camR - 1.5) want = -sgn(dx) * sp * 0.7;
        else want = Math.sin(f.t * 0.9 + f.seed * 6) * sp * 0.25;
      }
      if (f.home && !f.ground) { want = 0; f.vx = 0; }
      if (want !== null) f.vx += (want - f.vx) * Math.min(1, dt * 6);
      this.moveBody(f, dt);
      if (f.home) {
        if (f.ground && f.plat !== f.home && f.y > 0.5) f.home = f.plat || f.home;
        if (f.ground && f.plat === f.home) f.x = clamp(f.x, f.home.x0 + 0.5, f.home.x1 - 0.5);
      }
      if (d.shot) this.foeFire(f, P, dt, on && dist < d.range[1] + 4 && dist > 1.4);
    }

    foeFire(f, P, dt, can) {
      const d = FOES[f.type];
      const L = this.L;
      if (f.wind > 0) {
        f.wind -= dt;
        if (f.wind <= 0) this.foeShot(d.shot, f.x + f.face * 0.5, f.y + (d.air ? 0 : f.h * 0.6), P, f);
        return;
      }
      f.fireT -= dt;
      if (f.fireT > 0 || !can) return;
      f.fireT = (d.every / L.fireK) * (0.85 + this.rand() * 0.4);
      f.wind = 0.45 * L.warn;
      this.emit('wind', { id: f.id });
    }

    // a baddie's throw at the player P (or at the point tx, ty)
    foeShot(kind, x, y, P, f, o = {}) {
      const S = SHOTS[kind];
      const L = this.L;
      const k = L.shotSpeed;
      const tx = o.tx !== undefined ? o.tx : P ? P.x : x - 5;
      const ty = o.ty !== undefined ? o.ty : P ? P.y + 0.9 : 1;
      const b = { id: this.id(), kind, x, y, vx: 0, vy: 0, g: 0, r: S.r || 0.4, vr: (S.r || 0.4) * L.shotSize, t: 0, life: (S.life || 8) / (S.life ? k : 1), form: S.form, hp: S.hp || 1, from: f ? f.id : 0 };
      if (S.lob) {
        const dx = tx - x;
        const g = 16 * k * k;
        const tf = clamp(Math.abs(dx) / 7, 0.6, 1.4) / k;
        b.g = g;
        b.vx = dx / tf;
        b.vy = (ty - 0.5 - y + 0.5 * g * tf * tf) / tf;
        if (S.splash) b.splash = S.splash;
      } else if (S.fall) {
        b.vx = (f ? f.vx * 0.3 : 0); b.vy = -1; b.g = 12 * k * k;
      } else if (S.ground) {
        b.y = b.r;
        b.vx = (o.dir || sgn(tx - x)) * S.speed * k;
      } else if (S.beam) {
        b.x = tx; b.y = 0; b.warn = 1 * L.warn; b.on = 0.55; b.r = 0.7; b.vr = 0.7; b.life = b.warn + b.on;
      } else if (S.icicle) {
        b.x = tx; b.y = VH + 0.6; b.warn = 0.9 * L.warn; b.life = 9;
      } else {
        let vx = tx - x, vy = ty - y;
        if (kind === 'dust') vy *= 0.25;
        const n = Math.hypot(vx, vy) || 1;
        const sp = (o.speed || S.speed) * k;
        b.vx = (vx / n) * sp;
        b.vy = (vy / n) * sp;
        if (S.float) { b.float = true; b.baseY = y; b.vy = 0; }
      }
      this.fshots.push(b);
      this.emit('foeShot', { kind, x, y });
      return b;
    }

    damage(f, dmg, src = {}) {
      if (f.dead) return;
      if (f.boss && f.state === 'enter') { this.emit('tink', { x: f.x, y: f.y + f.h / 2 }); return; }
      f.hp -= dmg;
      f.flashT = 0.07;
      if (src.chill) f.chillT = src.chill;
      if (f.boss) this.emit('bossHit', { hp: f.hp });
      if (f.hp <= 0) this.kill(f, src);
    }

    kill(f, src) {
      f.dead = true;
      const owner = this.players[src.owner] || this.players[0];
      const def = FOES[f.type];
      const pts = f.boss ? 5000 : def ? def.score : 100;
      if (typeof src.owner === 'number' && owner) owner.score += pts;
      this.stats.pops++;
      if (src.owner === 'buddy') this.stats.buddyPops++;
      if (src.owner === 'coco') this.stats.cocoPops++;
      this.emit('pop', { id: f.id, foe: f.type, boss: f.boss, x: f.x, y: f.y + f.h / 2, big: !!f.boss || f.type === 'crate', score: pts, by: src.owner });
      if (f.type === 'crate') { this.spawnItem(f.carry || 'coin', f.x, f.y + 0.6, { vy: 7 }); return; }
      if (f.boss) { this.bossDown(f); return; }
      const r = this.rand();
      this.spawnItem(r < 0.45 ? 'coin' : r < 0.8 ? 'treat' : 'star', f.x, f.y + f.h / 2, { vy: 6, vx: (this.rand() - 0.5) * 2 });
    }

    explode(x, y, r, dmg, src) {
      this.emit('boom', { x, y, r, kind: src.kind });
      for (const f of this.foes) {
        if (f.dead) continue;
        const cx = clamp(x, f.x - f.w / 2, f.x + f.w / 2), cy = clamp(y, f.y, f.y + f.h);
        if (Math.hypot(cx - x, cy - y) < r) this.damage(f, dmg, src);
      }
      for (const pw of this.pows) if (pw.state === 'tied' && Math.abs(pw.x - x) < r && Math.abs(pw.y + 0.8 - y) < r) this.freePow(pw, src.owner);
      for (const b of this.fshots) if (SHOTS[b.kind].shootable && Math.hypot(b.x - x, b.y - y) < r) { b.dead = true; this.emit('fizz', { x: b.x, y: b.y, kind: b.kind }); }
    }

    contact() {
      for (const P of this.players) {
        if (P.out || P.invulnT > 0 || P.shieldT > 0) continue;
        const hb = this.hurtbox(P);
        for (const f of this.foes) {
          if (f.dead || f.harmless || (f.boss && f.state === 'enter')) continue;
          if (hb.x1 < f.x - f.w * 0.4 || hb.x0 > f.x + f.w * 0.4 || hb.y1 < f.y + 0.1 || hb.y0 > f.y + f.h * 0.9) continue;
          const d = FOES[f.type];
          this.hurt(P, d && d.bite ? { form: d.bite, kind: 'bite' } : { kind: 'bump' });
          if (P.veh) f.vx = sgn(f.x - P.x) * 6;
          break;
        }
      }
    }

    hurtbox(P) {
      if (P.veh) {
        const V = P.veh, R = RIDES[V.type];
        const h = V.squat ? R.h * 0.65 : R.h + 0.8;
        return { x0: V.x - R.w / 2, x1: V.x + R.w / 2, y0: V.y, y1: V.y + h };
      }
      const k = this.L.hurt;
      const F = FORMS[P.form];
      const w = 0.38 * k * (P.form === 'chubby' ? 1.3 : 1);
      const h = (F.roll ? 1.3 : P.crouch ? 1.15 : 1.8) * (0.85 + 0.15 * k);
      return { x0: P.x - w, x1: P.x + w, y0: P.y + 0.05, y1: P.y + h };
    }

    // ------------------------------------------------------------------ shots

    updateShots(dt) {
      for (const b of this.shots) {
        b.t += dt;
        if (b.g) b.vy -= b.g * dt;
        if (b.homing) {
          const f = this.nearestFoe(b.x, b.y, 9, b.vx > 0 ? 1 : -1);
          if (f) {
            const a = Math.atan2(f.y + f.h / 2 - b.y, f.x - b.x), sp = Math.hypot(b.vx, b.vy);
            const cur = Math.atan2(b.vy, b.vx);
            let da = a - cur;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            const na = cur + clamp(da, -b.homing * dt, b.homing * dt);
            b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.t > b.life || b.x < this.camL - 2 || b.x > this.camR + 2 || b.y > VH + 4) { b.dead = true; continue; }
        if (b.y < (b.boom ? 0.2 : -0.3)) {
          if (b.boom || b.splash) this.explode(b.x, 0.3, b.splash || 2, b.dmg, b);
          b.dead = true;
          continue;
        }
        for (const f of this.foes) {
          if (f.dead) continue;
          if (b.pierce && b.pierce.has(f.id)) continue;
          const cx = clamp(b.x, f.x - f.w / 2, f.x + f.w / 2), cy = clamp(b.y, f.y, f.y + (f.air ? f.h : Math.max(f.h, 1.35)));
          if ((cx - b.x) ** 2 + (cy - b.y) ** 2 > b.r * b.r) continue;
          if (b.boom || b.splash) { this.explode(b.x, b.y, b.splash || 2, b.dmg, b); b.dead = true; break; }
          this.damage(f, b.dmg, b);
          if (b.pierce) b.pierce.add(f.id);
          else { b.dead = true; break; }
        }
        if (b.dead) continue;
        for (const pw of this.pows) {
          if (pw.state !== 'tied') continue;
          if (Math.abs(pw.x - b.x) < 0.5 + b.r && b.y > pw.y && b.y < pw.y + 1.7) { this.freePow(pw, b.owner); if (!b.pierce) b.dead = true; break; }
        }
        if (b.dead) continue;
        // your shots can pop the baddies' pies, corks and goo
        for (const s of this.fshots) {
          if (s.dead || !SHOTS[s.kind].shootable) continue;
          const rr = b.r + s.r;
          if ((s.x - b.x) ** 2 + (s.y - b.y) ** 2 > rr * rr) continue;
          if (--s.hp <= 0) { s.dead = true; this.emit('fizz', { x: s.x, y: s.y, kind: s.kind }); }
          if (!b.pierce) { b.dead = true; break; }
        }
      }
      this.shots = this.shots.filter((b) => !b.dead);
    }

    nearestFoe(x, y, range, dir) {
      let best = null, bd = range;
      for (const f of this.foes) {
        if (f.dead || (f.harmless && f.type !== 'crate') || !this.onScreen(f.x, -0.5)) continue;
        if (dir && sgn(f.x - x) !== dir && Math.abs(f.x - x) > 1) continue;
        const d = Math.hypot(f.x - x, f.y + f.h / 2 - y);
        if (d < bd) { bd = d; best = f; }
      }
      return best;
    }

    updateFoeShots(dt) {
      for (const b of this.fshots) {
        b.t += dt;
        if (b.warn !== undefined && b.t < b.warn) continue;
        if (b.kind === 'beam') {
          if (b.t > b.life) { b.dead = true; continue; }
          for (const P of this.players) {
            if (P.out) continue;
            const hb = this.hurtbox(P);
            if (hb.x1 > b.x - 0.7 && hb.x0 < b.x + 0.7) this.hurt(P, { form: 'monkey', kind: 'beam' });
          }
          continue;
        }
        if (b.kind === 'icicle' && !b.falling) { b.falling = true; b.vy = -13 * Math.sqrt(this.L.shotSpeed); }
        if (b.g) b.vy -= b.g * dt;
        b.x += b.vx * dt;
        if (b.float) { b.y = b.baseY + Math.sin(b.t * 3) * 0.9; b.baseY += 0.15 * dt; }
        else b.y += b.vy * dt;
        if (b.t > b.life || b.x < this.camL - 3 || b.x > this.camR + 3 || b.y > VH + 6) { b.dead = true; continue; }
        if (b.y < -0.2 && !SHOTS[b.kind].ground) {
          b.dead = true;
          if (b.splash) {
            this.emit('splat', { x: b.x, kind: b.kind });
            for (const P of this.players) if (!P.out && Math.abs(P.x - b.x) < b.splash && P.y < 1) this.hurt(P, { kind: 'splat' });
          } else this.emit('fizz', { x: b.x, y: 0.2, kind: b.kind });
          continue;
        }
        for (const P of this.players) {
          if (P.out) continue;
          const hb = this.hurtbox(P);
          const cx = clamp(b.x, hb.x0, hb.x1), cy = clamp(b.y, hb.y0, hb.y1);
          if ((cx - b.x) ** 2 + (cy - b.y) ** 2 > b.r * b.r) continue;
          const did = this.hurt(P, { form: b.form, kind: b.kind });
          if (did && !SHOTS[b.kind].ground) { b.dead = true; this.emit('fizz', { x: b.x, y: b.y, kind: b.kind }); }
          break;
        }
      }
      this.fshots = this.fshots.filter((b) => !b.dead);
    }

    // ------------------------------------------------------------------ items

    spawnItem(type, x, y, o = {}) {
      const it = { id: this.id(), type, x: clamp(x, this.camL + 0.5, this.camR - 0.5), y: Math.max(0.2, y), vx: o.vx || 0, vy: o.vy === undefined ? 6 : o.vy, t: 0, life: o.life || 12, ground: false, plat: null, gift: o.gift || null };
      if (type === 'treat') it.treat = o.treat || POP_TREATS[Math.floor(this.rand() * POP_TREATS.length)];
      this.items.push(it);
      this.emit('item', { id: it.id, item: type, x, y });
      return it;
    }

    updateItems(dt) {
      for (const it of this.items) {
        it.t += dt;
        if (!it.ground) { this.moveBody(it, dt, 20); it.vx *= 1 - dt; }
        if (it.ground) it.vx = 0;
        if (it.gift) it.x = clamp(it.x, this.camL + 0.4, this.camR - 0.4);
        else if (it.x < this.camL - 1) { it.dead = true; continue; }
        if (it.t > it.life && !it.gift) { it.dead = true; continue; }
        if (it.t < 0.25) continue;
        for (const P of this.players) {
          if (P.out) continue;
          const reach = P.veh ? 1.9 : 1.1;
          const py = P.veh ? P.veh.y + 1 : P.y + 0.9;
          if (Math.abs(it.x - P.x) < reach && Math.abs(it.y + 0.3 - py) < reach + 0.4) { this.take(P, it); break; }
        }
      }
      this.items = this.items.filter((it) => !it.dead);
    }

    take(P, it) {
      it.dead = true;
      const L = this.L;
      const t = it.type;
      if (t === 'coin') { P.score += 10; P.coins++; this.stats.coins++; }
      else if (t === 'star') P.score += 100;
      else if (t === 'treat') {
        P.score += 50;
        this.stats.treats++;
        if (it.gift) { if (P.hearts < P.maxHearts) P.hearts++; }
        else if (P.form === 'normal' && !P.veh) {
          // eat too many treats too fast and you go round
          P.treatT.push(this.t);
          P.treatT = P.treatT.filter((x) => this.t - x < 12);
          if (P.treatT.length >= 8) this.transform(P, 'chubby');
        }
      } else if (PICKUP_GUNS.includes(t)) {
        const add = Math.round(GUNS[t].ammo * L.ammo);
        P.ammo = P.gun === t ? P.ammo + add : add;
        P.gun = t;
      } else if (t === 'balloons') {
        P.balloons = Math.min(99, P.balloons + 10);
        if (P.veh && P.veh.type === 'tank') P.veh.shells += 5;
      } else if (t === 'heart') P.hearts = Math.min(P.maxHearts, P.hearts + 1);
      else if (t === 'potion') { if (!this.cure(P, 'potion')) P.score += 200; }
      else if (t === 'coco') this.startCoco(P);
      this.emit('take', { i: P.i, item: t, treat: it.treat, gift: it.gift, x: it.x, y: it.y });
    }

    // a test helper: give a player something as if they'd picked it up
    give(type, i = 0) {
      const P = this.players[i];
      if (!P) return false;
      if (FORMS[type] && type !== 'normal') { this.transform(P, type); return true; }
      if (type === 'normal') return this.cure(P, 'potion');
      this.take(P, { type, x: P.x, y: P.y, treat: type === 'treat' ? 'cookie' : undefined });
      return true;
    }

    // ------------------------------------------------------------------ the cast: Fuzzbeards, Bruno's balloon drop, Coco

    freePow(pw, owner) {
      pw.state = 'free';
      pw.t = 0;
      pw.target = typeof owner === 'number' ? owner : 0;
      this.stats.rescues++;
      const P = this.players[pw.target] || this.players[0];
      if (P) { P.score += 500; P.rescues++; }
      this.emit('freed', { id: pw.id, x: pw.x, y: pw.y, carry: pw.carry });
    }

    updatePows(dt) {
      for (const pw of this.pows) {
        pw.t += dt;
        if (pw.state === 'tied') {
          for (const P of this.players) {
            if (P.out) continue;
            if (Math.abs(P.x - pw.x) < 0.9 && Math.abs(P.y - pw.y) < 1.5) { this.freePow(pw, P.i); break; }
          }
          if (pw.x < this.camL - 3) pw.dead = true;
        } else if (pw.state === 'free') {
          if (pw.t > 0.8) { pw.state = 'give'; pw.t = 0; }
        } else if (pw.state === 'give') {
          const P = this.players[pw.target] && !this.players[pw.target].out ? this.players[pw.target] : this.nearestPlayer(pw.x);
          const dx = P ? P.x - pw.x : 0;
          pw.face = sgn(dx);
          if (Math.abs(dx) > 1.2 && pw.t < 2.5) pw.x += sgn(dx) * 4 * dt;
          else {
            this.spawnItem(pw.carry, pw.x + pw.face * 0.4, pw.y + 1.2, { vy: 5, vx: pw.face * 0.5 });
            pw.state = 'salute';
            pw.t = 0;
            this.emit('salute', { id: pw.id });
          }
        } else if (pw.state === 'salute') {
          if (pw.t > 0.9) { pw.state = 'run'; pw.t = 0; }
        } else if (pw.state === 'run') {
          pw.face = -1;
          pw.x -= 7 * dt;
          if (pw.y > 0) { pw.y = Math.max(0, pw.y - 9 * dt); }
          if (pw.x < this.camL - 2) pw.dead = true;
        }
      }
      this.pows = this.pows.filter((p) => !p.dead);
    }

    addDrop(x, carry, o = {}) {
      const d = { id: this.id(), x: clamp(x, this.camL + 2, this.camR - 2), y: VH + 1.5, state: 'down', t: 0, carry, potion: !!o.potion };
      this.drops.push(d);
      this.emit('drop', { id: d.id, carry });
      return d;
    }

    updateDrops(dt) {
      for (const d of this.drops) {
        d.t += dt;
        if (d.state === 'down') {
          d.y -= 3.2 * dt;
          if (d.y <= 6.5) {
            d.state = 'up';
            d.t = 0;
            this.spawnItem(d.carry, d.x, d.y - 0.4, { vy: 0 });
            this.emit('dropped', { id: d.id, carry: d.carry });
          }
        } else {
          d.y += 2.5 * dt;
          d.x += 1.2 * dt;
          if (d.y > VH + 3) d.dead = true;
        }
      }
      this.drops = this.drops.filter((d) => !d.dead);
    }

    // a zombie or a mummy that can't find a potion gets one from Bruno before long
    safetyPotion() {
      for (const P of this.players) {
        if (P.out || (P.form !== 'zombie' && P.form !== 'mummy') || P.formAge < this.L.potionAfter || P.potionAskT > 0) continue;
        if (this.items.some((it) => it.type === 'potion') || this.drops.some((d) => d.carry === 'potion')) continue;
        if (this.pows.some((pw) => pw.carry === 'potion' && pw.state !== 'tied' && pw.state !== 'run')) continue;
        P.potionAskT = 8;
        this.stats.potionDrops++;
        this.addDrop(P.x, 'potion', { potion: true });
      }
    }

    startCoco(P) {
      if (this.coco) { this.coco.left = this.L.coco; this.coco.owner = P.i; return; }
      this.coco = { x: clamp(P.x - 1.2, this.camL + 0.5, this.camR - 0.5), y: P.y + 1, vx: 0, vy: 4, ground: false, plat: null, face: 1, left: this.L.coco, fireCD: 0.5, owner: P.i, state: 'here', t: 0, shotN: 0 };
      this.emit('coco', { x: this.coco.x });
    }

    updateCoco(dt) {
      const C = this.coco;
      if (!C) return;
      C.t += dt;
      const P = this.players[C.owner] && !this.players[C.owner].out ? this.players[C.owner] : this.active()[0];
      if (C.state === 'here') {
        C.left -= dt;
        if (C.left <= 0 || !P) { C.state = 'bye'; C.t = 0; this.emit('cocoBye', { x: C.x }); }
      }
      if (C.state === 'bye') {
        if (C.t > 1) { C.x -= 8 * dt; if (C.x < this.camL - 2) this.coco = null; }
        return;
      }
      const tx = P.x + P.face * 1.4;
      C.vx += (clamp((tx - C.x) * 3, -8, 8) - C.vx) * Math.min(1, dt * 8);
      if (C.ground && (P.y > C.y + 1.2 || this.rand() < dt * 0.6)) { C.vy = 11; C.ground = false; }
      this.moveBody(C, dt);
      C.x = clamp(C.x, this.camL + 0.4, this.camR - 0.4);
      C.fireCD -= dt;
      const f = this.nearestFoe(C.x, C.y + 0.6, 13);
      if (f) {
        C.face = sgn(f.x - C.x);
        if (C.fireCD <= 0) {
          C.fireCD = 0.18;
          const a = Math.atan2(f.y + f.h / 2 - (C.y + 0.6), f.x - C.x);
          this.addShot({ team: 'p', owner: 'coco', kind: 'water', x: C.x + Math.cos(a) * 0.4, y: C.y + 0.6, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, r: 0.2, dmg: 0.55, life: 1 });
        }
      } else if (Math.abs(C.vx) > 0.5) C.face = sgn(C.vx);
    }

    // ------------------------------------------------------------------ companion mode (1 player) and team-up (2 players)

    callBuddy() {
      if (this.two) return this.teamUp(0);
      const P = this.players[0];
      if (!P || P.out || this.over || this.cleared) return false;
      this.stats.calls++;
      const L = this.L;
      const kind = this.buddyFor(P.kind);
      let B = this.buddy;
      if (!B || B.phase === 'out') {
        B = this.buddy = {
          kind, x: this.camL - 1.2, y: 0, vx: 0, vy: 0, ground: true, plat: null, face: 1, phase: 'in', t: 0,
          left: L.buddyStay, fireCD: 0.4, n: 0, saveT: 0, sig: null, sigT: 0, punches: 0, shotN: 0,
        };
        this.emit('buddyCall', { kind, again: false });
      } else {
        // called again while he's here: a new hello, a new treat and the full visit again
        B.left = L.buddyStay;
        B.n++;
        if (B.phase === 'bye') B.phase = 'here';
        if (B.phase === 'here') this.buddyHello(B, P);
        this.emit('buddyCall', { kind, again: true });
      }
      return true;
    }

    buddyHello(B, P) {
      const list = HELLO[B.kind] || ['wave'];
      B.sig = list[B.n % list.length];
      B.sigT = 1.3;
      B.punches = 0;
      B.phase = 'here';
      B.helloDone = false;
      this.emit('hello', { kind: B.kind, sig: B.sig, x: B.x, y: B.y });
      // a treat for you, or a cure potion if you've been turned into something
      const potion = P.form !== 'normal';
      const item = potion ? 'potion' : 'treat';
      const treat = potion ? null : TREATS[(this.stats.calls + B.n) % TREATS.length];
      const it = this.spawnItem(item, B.x, B.y + 1.6, { vy: 6, vx: clamp((P.x - B.x) * 1.4, -9, 9), gift: B.kind, treat });
      this.emit('treatToss', { kind: B.kind, item, treat, id: it.id });
    }

    updateBuddy(dt) {
      const B = this.buddy;
      if (!B) return;
      const P = this.players[0];
      B.t += dt;
      B.saveT -= dt;
      B.sigT -= dt;
      if (!P || P.out) { if (B.phase !== 'out') { B.phase = 'out'; B.t = 0; } }
      if (B.phase === 'in') {
        const tx = P.x - P.face * 1.6;
        B.face = sgn(tx - B.x);
        B.x += clamp(tx - B.x, -16 * dt, 16 * dt);
        if (P.y > B.y + 1.5 && B.ground) { B.vy = 14; }
        this.moveBody(B, dt);
        if (Math.abs(tx - B.x) < 0.6 || B.t > 1.2) { B.x = clamp(B.x, this.camL + 0.5, this.camR - 0.5); this.buddyHello(B, P); }
        return;
      }
      if (B.phase === 'out') {
        B.face = -1;
        B.x -= 12 * dt;
        this.moveBody(B, dt);
        if (B.x < this.camL - 2) this.buddy = null;
        return;
      }
      if (B.phase === 'bye') {
        if (B.t > 1.1) { B.phase = 'out'; B.t = 0; }
        this.moveBody(B, dt);
        return;
      }
      // here: stick close, jump with you, and bonk baddies
      B.left -= dt;
      if (B.left <= 0) { B.phase = 'bye'; B.t = 0; B.sig = (HELLO[B.kind] || ['wave']).slice(-1)[0]; B.sigT = 1.1; this.emit('bye', { kind: B.kind }); return; }
      const px = P.veh ? P.veh.x - P.veh.face * 2.2 : P.x - P.face * 1.6;
      const tx = clamp(px, this.camL + 0.6, this.camR - 0.6);
      if (B.sigT <= 0 || B.sig === 'peace') B.vx += (clamp((tx - B.x) * 4, -9, 9) - B.vx) * Math.min(1, dt * 10);
      else B.vx *= 0.8;
      if (B.ground && (P.y > B.y + 1.5 || (P.vy > 6 && !P.veh))) { B.vy = 14; B.ground = false; }
      this.moveBody(B, dt);
      B.x = clamp(B.x, this.camL + 0.5, this.camR - 0.5);
      const f = this.nearestFoe(B.x, B.y + 1, 14);
      if (B.sigT > 0) {
        // his signature move does something too
        const k = 1.3 - B.sigT;
        if (B.sig === 'peace' && !B.helloDone && k > 0.35) {
          B.helloDone = true;
          const dir = f ? sgn(f.x - B.x) : P.face;
          this.addShot({ team: 'p', owner: 'buddy', kind: 'peacewave', x: B.x + dir * 0.6, y: B.y + 1.2, vx: dir * 9, vy: 0, r: 1.3, dmg: 3, pierce: new Set(), life: 1.8 });
          this.emit('peaceWave', { x: B.x, y: B.y, dir });
        } else if (B.sig === 'boxing' && B.punches < 2 && k > 0.3 + B.punches * 0.4) {
          B.punches++;
          const dir = f ? sgn(f.x - B.x) : P.face;
          B.face = dir;
          this.addShot({ team: 'p', owner: 'buddy', kind: 'punch', x: B.x + dir * 0.7, y: B.y + 1.3, vx: dir * 15, vy: 0, r: 0.8, dmg: 3, pierce: new Set(), life: 0.3 });
          this.emit('punch', { x: B.x, y: B.y, n: B.punches, dir });
        } else if (B.sig === 'jumpshot' && !B.helloDone && k > 0.35) {
          B.helloDone = true;
          if (B.ground) B.vy = 9;
          const tx2 = f ? f.x : B.x + P.face * 7, ty2 = f ? f.y + f.h / 2 : 1;
          const tf = 0.9, g = 18;
          this.addShot({ team: 'p', owner: 'buddy', kind: 'dunk', x: B.x, y: B.y + 2.4, vx: (tx2 - B.x) / tf, vy: (ty2 - B.y - 2.4 + 0.5 * g * tf * tf) / tf, g, r: 0.5, dmg: 5, splash: 2.2, boom: true, life: 3 });
          this.emit('jumpshot', { x: B.x, y: B.y });
        }
        if (f && B.sig !== 'peace') B.face = sgn(f.x - B.x);
        return;
      }
      B.fireCD -= dt;
      if (f) {
        B.face = sgn(f.x - B.x);
        if (B.fireCD <= 0) {
          B.fireCD = 0.22;
          B.shotN++;
          const a = Math.atan2(f.y + f.h / 2 - (B.y + 1.2), f.x - B.x);
          const kind = B.kind === 'tommy' ? 'star' : 'ball';
          this.addShot({ team: 'p', owner: 'buddy', kind, x: B.x + Math.cos(a) * 0.5, y: B.y + 1.2, vx: Math.cos(a) * 17, vy: Math.sin(a) * 17, r: 0.26, dmg: 1, life: 1.4 });
        }
      } else if (Math.abs(B.vx) > 0.5) B.face = sgn(B.vx);
    }

    // 2 players: a high five. Both brothers shine, everything near goes BONK, and a bonked-out brother jumps back in.
    teamUp(i) {
      if (!this.two || this.over || this.cleared) return false;
      if (this.teamCD > 0) { this.emit('nope', { i, what: 'teamup' }); return false; }
      if (this.players.every((P) => P.out)) return false;
      this.teamCD = this.L.teamCD;
      this.stats.teamups++;
      const caller = this.players[i] && !this.players[i].out ? this.players[i] : this.active()[0];
      for (const P of this.players) {
        if (P.out) this.revive(P, caller);
        P.shieldT = 3;
        P.sig = (HELLO[P.kind] || ['wave'])[this.stats.teamups % (HELLO[P.kind] || ['wave']).length];
        P.sigT = 1.2;
      }
      for (const f of this.foes) {
        if (f.dead) continue;
        const near = this.players.some((P) => Math.abs(f.x - P.x) < 8 && Math.abs(f.y - P.y) < 7);
        if (near) this.damage(f, f.boss ? 8 : 6, { owner: i, kind: 'teamup' });
      }
      for (const b of this.fshots) {
        if (this.players.some((P) => Math.hypot(b.x - P.x, b.y - P.y - 1) < 7)) { b.dead = true; this.emit('fizz', { x: b.x, y: b.y, kind: b.kind }); }
      }
      const mx = this.players.reduce((s, P) => s + P.x, 0) / this.players.length;
      this.emit('teamup', { i, x: mx, y: 1 });
      return true;
    }

    // ------------------------------------------------------------------ scenery that reacts: cheering folk, birds

    updateScenery(dt) {
      for (const p of this.folk) {
        p.cheerT -= dt;
        const near = this.players.some((P) => !P.out && Math.abs(P.x - p.x) < 5);
        if (near && !p.cheered) { p.cheered = true; p.cheerT = 2.5; this.emit('cheer', { id: p.id, kind: p.kind, x: p.x }); }
      }
      this.folk = this.folk.filter((p) => p.x > this.camL - 8);
      for (const b of this.birds) {
        b.t += dt;
        if (b.state === 'sit') {
          if (this.players.some((P) => !P.out && Math.abs(P.x - b.x) < 4.5) || this.shots.some((s) => Math.abs(s.x - b.x) < 2 && Math.abs(s.y - b.y) < 2)) {
            b.state = 'fly'; b.t = 0; b.vx = 3 + b.seed * 3; b.vy = 4 + b.seed * 2;
            this.emit('birds', { x: b.x });
          }
        } else {
          b.x += b.vx * dt; b.y += b.vy * dt; b.vy += dt * 1.5;
          if (b.y > VH + 3) b.dead = true;
        }
      }
      this.birds = this.birds.filter((b) => !b.dead && b.x > this.camL - 8);
    }

    // ------------------------------------------------------------------ bosses

    bossThink(f, dt) {
      const D = BOSSES[f.boss];
      const L = this.L;
      f.t += dt;
      f.st += dt;
      f.flashT -= dt;
      const P = this.nearestPlayer(f.x, f.y);
      if (f.state === 'down') return;
      const left = this.camL + 3 + f.w / 2, right = this.camR - 1 - f.w / 2;
      if (f.state === 'enter') {
        if (f.fly) {
          f.x += (this.camR - 5 - f.x) * Math.min(1, dt * 2);
          f.y += (f.fly - f.y) * Math.min(1, dt * 1.6);
          if (f.st > 2) { f.state = 'idle'; f.st = 0; this.emit('bossGo', { boss: f.boss }); }
        } else {
          f.vx = -3;
          this.moveBody(f, dt);
          if (f.x <= this.camR - 2 - f.w / 2) { f.state = 'idle'; f.st = 0; this.emit('bossGo', { boss: f.boss }); }
        }
        return;
      }
      if (!P) { if (!f.fly) this.moveBody(f, dt); return; }
      const sp = D.speed * L.foeSpeed;
      const rest = 1.6 * L.bossRest;
      if (f.state === 'idle') {
        // stroll around the right side, or hover over the arena
        let tx;
        if (f.boss === 'banana') tx = clamp(P.x + Math.sin(f.t * 0.6) * 4, this.camL + 4, this.camR - 4);
        else tx = clamp(this.camR - 6 + Math.sin(f.t * 0.5) * 3.5, left, right);
        f.vx += (clamp(tx - f.x, -sp, sp) - f.vx) * Math.min(1, dt * 3);
        f.face = sgn(P.x - f.x);
        if (f.fly) { f.x += f.vx * dt; f.y = f.fly + Math.sin(f.t * 1.4) * 0.4; } else this.moveBody(f, dt);
        f.x = clamp(f.x, left, right);
        if (f.st > rest) {
          let atk = D.attacks[f.atkI++ % D.attacks.length];
          if (atk === 'minions' && this.foes.filter((g) => !g.dead && !g.boss && !g.harmless).length >= 3) atk = D.attacks[f.atkI++ % D.attacks.length];
          if (f.boss === 'zorg' && (atk === 'dust' || atk === 'ice') && f.hp > f.maxHp / 2) atk = 'goo';
          f.atk = atk;
          f.state = 'wind';
          f.st = 0;
          f.sub = 0;
          f.aimX = P.x;
          this.emit('bossWind', { boss: f.boss, atk });
        }
        return;
      }
      const warn = 0.8 * L.warn;
      if (f.state === 'wind') {
        if (!f.fly) { f.vx *= 0.85; this.moveBody(f, dt); }
        if (f.atk === 'snap' || f.atk === 'leap') f.aimX = P.x;
        if (f.st > warn) { f.state = 'act'; f.st = 0; this.bossAct(f, P, true); }
        return;
      }
      if (f.state === 'act') {
        const done = this.bossAct(f, P, false, dt);
        if (done) { f.state = 'idle'; f.st = 0; }
      }
    }

    // One boss attack. Returns true when it's done. `first` is the first tick of the attack.
    bossAct(f, P, first, dt = 0) {
      const L = this.L;
      const easy = this.level === 'easy';
      const mx = f.x + f.face * f.w * 0.4, my = f.y + f.h * 0.6;
      const groundMove = () => { if (!f.fly) this.moveBody(f, dt); };
      switch (f.atk) {
        case 'corks': {
          if (first) {
            const n = easy ? 2 : 3;
            for (let k = 0; k < n; k++) {
              const s = this.foeShot('cork', mx, my, P, f);
              const a = Math.atan2(s.vy, s.vx) + (k - (n - 1) / 2) * 0.22;
              const sp = Math.hypot(s.vx, s.vy);
              s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
            }
          }
          groundMove();
          return f.st > 0.4;
        }
        case 'stomp': {
          if (first) {
            this.emit('stomp', { x: f.x });
            this.foeShot('wave', f.x - f.w / 2, 0.5, P, f, { dir: -1 });
            if (!easy) this.foeShot('wave', f.x + f.w / 2, 0.5, P, f, { dir: 1 });
          }
          groundMove();
          return f.st > 0.6;
        }
        case 'minions': {
          if (first) {
            const D = BOSSES[f.boss];
            const n = easy ? 1 : 2;
            for (let k = 0; k < n; k++) this.later.push({ at: this.t + k * 0.8, type: D.minion, side: k % 2 ? 'L' : 'R', nearX: f.x });
            this.emit('bossCall', { boss: f.boss });
          }
          groundMove();
          return f.st > 0.8;
        }
        case 'bubbles': {
          const n = easy ? 3 : 5;
          if (f.sub < n && f.st > f.sub * 0.35) {
            f.sub++;
            this.foeShot('bubble', mx, 1 + this.rand() * 2.5, P, f);
          }
          groundMove();
          return f.sub >= n && f.st > n * 0.35 + 0.3;
        }
        case 'snap': {
          // a quick lunge with the big claws, then back
          if (first) { f.lungeTo = clamp(f.x + sgn(f.aimX - f.x) * 3.5, this.camL + 1 + f.w / 2, this.camR - 1 - f.w / 2); this.emit('snap', { boss: f.boss }); }
          const back = f.st > 0.7;
          const tx = back ? this.camR - 5 : f.lungeTo;
          f.vx = clamp((tx - f.x) * 6, -10 * L.foeSpeed, 10 * L.foeSpeed);
          this.moveBody(f, dt);
          return f.st > 1.6;
        }
        case 'leap': {
          if (first) {
            const tx = clamp(f.aimX, this.camL + 2 + f.w / 2, this.camR - 1 - f.w / 2);
            const tf = 1.1 / Math.sqrt(L.foeSpeed);
            f.vx = (tx - f.x) / tf;
            f.vy = 0.5 * GRAV * tf;
            f.landX = tx;
            f.ground = false;
            this.emit('leap', { boss: f.boss, x: tx });
          }
          const was = f.ground;
          this.moveBody(f, dt);
          if (f.ground && !was && f.st > 0.1) {
            f.vx = 0;
            this.emit('stomp', { x: f.x });
            this.foeShot('wave', f.x - f.w / 2, 0.5, P, f, { dir: -1 });
            if (!easy) this.foeShot('wave', f.x + f.w / 2, 0.5, P, f, { dir: 1 });
          }
          if (f.ground && f.st > 0.3) {
            // walk back to the right
            f.vx = clamp((this.camR - 5 - f.x) * 3, -4, 4);
            return f.st > 2.6 || Math.abs(this.camR - 5 - f.x) < 0.5;
          }
          return false;
        }
        case 'dust': {
          const n = easy ? 2 : 3;
          if (first) for (let k = 0; k < n; k++) {
            const s = this.foeShot('dust', mx, f.y + 0.8 + k * 1.1, P, f, { ty: f.y + 0.8 + k * 1.1, speed: 2.5 });
            s.life = 4 / L.shotSpeed;
          }
          groundMove();
          return f.st > 0.6;
        }
        case 'whip': {
          if (first) this.foeShot('wave', f.x - f.w / 2, 0.5, P, f, { dir: -1 });
          groundMove();
          return f.st > 0.6;
        }
        case 'ray': {
          if (first) {
            this.foeShot('beam', f.x, 0, P, f, { tx: P.x });
            if (!easy) this.later.push({ at: this.t + 0.5, beam: true, tx: P.x + (P.x > this.camL + 6 ? -3 : 3) });
          }
          return f.st > 1.2 * L.warn;
        }
        case 'bananas': {
          const n = easy ? 2 : 3;
          if (first) for (let k = 0; k < n; k++) this.foeShot('banana', f.x + (k - 1) * 1.2, f.y, P, f, { tx: P.x + (k - (n - 1) / 2) * 2.2, ty: 0.5 });
          if (f.fly) f.x += f.vx * dt;
          return f.st > 0.8;
        }
        case 'ice': {
          const n = easy ? 2 : 3;
          if (first) for (let k = 0; k < n; k++) this.foeShot('ice', mx, my, P, f, { tx: P.x + (k - (n - 1) / 2) * 1.6, ty: P.y + 0.6 });
          groundMove();
          return f.st > 0.6;
        }
        case 'roll': {
          if (first) this.foeShot('roll', f.x - f.w / 2 - 0.5, 0.9, P, f, { dir: -1 });
          groundMove();
          return f.st > 0.8;
        }
        case 'icicles': {
          const n = easy ? 3 : 4;
          if (first) {
            const xs = [P.x];
            for (let k = 1; k < n; k++) xs.push(this.camL + 2 + ((k * 5.3 + this.rand() * 2) % (VW - 6)));
            for (const x of xs) this.foeShot('icicle', x, VH, P, f, { tx: clamp(x, this.camL + 1, this.camR - 1) });
          }
          groundMove();
          return f.st > 1.4;
        }
        case 'goo': {
          const n = easy ? 2 : 3;
          if (first) for (let k = 0; k < n; k++) this.foeShot('goo', mx, my, P, f, { tx: P.x + (k - (n - 1) / 2) * 1.8, ty: P.y + 0.6 });
          groundMove();
          return f.st > 0.6;
        }
      }
      return true;
    }

    bossDown(f) {
      f.dead = true;
      f.state = 'down';
      this.phase = 'boss';
      this.emit('bossDown', { boss: f.boss, name: f.name, x: f.x, y: f.y + f.h / 2 });
      for (const g of this.foes) if (!g.dead && g !== f) { g.dead = true; this.emit('pop', { id: g.id, foe: g.type, x: g.x, y: g.y + g.h / 2, score: 0 }); }
      for (const b of this.fshots) b.dead = true;
      this.fshots.length = 0;
      this.later.length = 0;
      for (let k = 0; k < 14; k++) this.spawnItem(k % 3 === 0 ? 'star' : k % 3 === 1 ? 'coin' : 'treat', f.x + (this.rand() - 0.5) * 3, f.y + f.h / 2, { vy: 7 + this.rand() * 5, vx: (this.rand() - 0.5) * 8 });
    }

    // test helpers
    winNow() { if (!this.boss) { this.camL = this.M.len - VW; this.camR = this.M.len; this.evI = this.beats.length; this.lock = null; this.startBoss(); } this.boss.state = 'idle'; this.damage(this.boss, 1e6, { owner: 0 }); }
    warp(x) {
      this.camL = clamp(x - VW / 2, 0, this.M.len - VW);
      this.camR = this.camL + VW;
      this.lock = null;
      this.later.length = 0;
      for (const f of this.foes) f.dead = true;
      this.evI = 0;
      while (this.evI < this.beats.length && this.beats[this.evI][0] < this.camR) this.evI++;
      for (const P of this.players) { P.x = this.camL + 4 - P.i * 1.5; P.y = 0; P.vy = 0; if (P.veh) { P.veh.x = P.x; P.veh.y = 0; } }
      this.lastCamL = this.camL;
    }
  }

  // the boss's second ray (Normal) waits in `later` as { beam: true, tx }
  const spawnFrom = Sim.prototype.spawnFrom;
  Sim.prototype.spawnFrom = function (s) {
    if (s.beam) return this.foeShot('beam', s.tx, 0, null, null, { tx: clamp(s.tx, this.camL + 1, this.camR - 1) });
    return spawnFrom.call(this, s);
  };

  JUG.sim = { Sim, VW, VH, GRAV, LEVELS, GUNS, FORMS, FOES, SHOTS, RIDES, BOSSES, TREATS, POP_TREATS, PICKUP_GUNS, HELLO, rng };
})();
