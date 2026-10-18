/* JuggernauT: the mission check, the rules, the soak and the sabotage cases. Runs in the browser console
   (game.check(), game.soak()) and in Node (node tools/check.js). No Three.js in here.

   - missions(): every beat uses a known baddie, pick-up, ride and folk; every mission has a boss, a ride, friends to
     free, fights, and a potion wherever something can turn you into a zombie or a mummy.
   - rules(): one small scene per rule (each transformation and its way back, the rides, the cast, the companion,
     team-up, Easy vs Normal), each with a yes/no answer.
   - soak(): the autopilot plays missions headlessly, each from a fresh start (full hearts, own blaster, no ride). A
     mission counts as finished only if its boss goes down without losing every heart.
   - sabotage(): broken setups that must fail, to prove the checks can fail at all. */
(function () {
  'use strict';
  const JUG = (window.JUG = window.JUG || {});
  const DT = 1 / 60;
  const THEMES = ['town', 'beach', 'desert', 'jungle', 'snow', 'farm'];
  const CARRY = ['water', 'bubble', 'foam', 'snow', 'balloons', 'potion', 'heart', 'treat', 'coco'];
  const FOLK = ['villager', 'farmer', 'camel'];

  function missions(list = JUG.MISSIONS) {
    const M = JUG.sim;
    const out = [];
    if (list.length !== 6) out.push({ mission: 0, name: 'ALL', probs: [`expected 6 missions, found ${list.length}`] });
    list.forEach((m, k) => {
      const probs = [];
      if (!m.name) probs.push('no name');
      if (!THEMES.includes(m.theme)) probs.push(`unknown theme "${m.theme}"`);
      if (!M.BOSSES[m.boss]) probs.push(`unknown boss "${m.boss}"`);
      if (!(m.len >= 150 && m.len <= 400)) probs.push(`length ${m.len} (want 150 to 400)`);
      const n = { foe: 0, lock: 0, pow: 0, ride: 0, potion: 0, folk: 0 };
      let last = -1, turners = 0;
      for (const b of m.beats || []) {
        const [x, kind, a, cnt, o] = b;
        const at = `beat at ${x}`;
        if (typeof x !== 'number' || x < 0 || x >= m.len) probs.push(`${at}: outside the mission`);
        if (x < last) probs.push(`${at}: out of order`);
        last = x;
        if (kind in n) n[kind]++;
        if (kind === 'foe') {
          if (!M.FOES[a] || a === 'crate') probs.push(`${at}: unknown baddie "${a}"`);
          else if (M.FOES[a].bite || ['mummy'].includes(a)) turners++;
          if (!(cnt >= 1 && cnt <= 6)) probs.push(`${at}: count ${cnt} (want 1 to 6)`);
          if (o && o.side && !['R', 'L', 'air'].includes(o.side)) probs.push(`${at}: side "${o.side}"`);
        } else if (kind === 'lock') {
          if (!Array.isArray(a) || !a.length) probs.push(`${at}: a fight with no waves`);
          for (const w of a || []) {
            if (!M.FOES[w[1]] || w[1] === 'crate') probs.push(`${at}: unknown baddie "${w[1]}"`);
            else if (M.FOES[w[1]].bite || w[1] === 'mummy') turners++;
            if (!(w[2] >= 1 && w[2] <= 5)) probs.push(`${at}: wave count ${w[2]}`);
            if (w[3] && !['R', 'L', 'air'].includes(w[3])) probs.push(`${at}: wave side "${w[3]}"`);
          }
        } else if (kind === 'pow' || kind === 'crate' || kind === 'drop') {
          if (!CARRY.includes(a)) probs.push(`${at}: unknown present "${a}"`);
          if (a === 'potion') n.potion++;
          if (cnt !== undefined && !(m.plats || []).some((p) => x > p[0] && x < p[1] && Math.abs(p[2] - cnt) < 0.01)) probs.push(`${at}: up at y ${cnt} with no ledge under it`);
        } else if (kind === 'ride') {
          if (!M.RIDES[a]) probs.push(`${at}: unknown ride "${a}"`);
        } else if (kind === 'folk') {
          if (!FOLK.includes(a)) probs.push(`${at}: unknown folk "${a}"`);
        } else if (kind !== 'birds') probs.push(`${at}: unknown beat "${kind}"`);
      }
      for (const p of m.plats || []) {
        if (!(p[0] < p[1] && p[1] - p[0] >= 4)) probs.push(`ledge ${p}: too short`);
        if (!(p[2] >= 2 && p[2] <= 6)) probs.push(`ledge ${p}: height ${p[2]} (jumps reach about 2.9 at a time)`);
      }
      if (n.lock < 2) probs.push(`only ${n.lock} fights`);
      if (n.pow < 3) probs.push(`only ${n.pow} friends to free`);
      if (!n.ride) probs.push('no ride');
      if (n.foe < 8) probs.push(`only ${n.foe} groups of baddies`);
      if (turners && n.potion < 2) probs.push('baddies that turn you into things, but fewer than 2 potions');
      out.push({ mission: k + 1, name: m.name, probs, beats: (m.beats || []).length, len: m.len });
    });
    return out;
  }

  // Plays one mission to the end. o: { mission, level, players, seed, auto, immortal, noGuns, bossHpK, buddyEvery,
  // maxT, missionData, tweak, clumsy }
  function run(o) {
    const M = JUG.sim;
    const S = new M.Sim({
      mission: o.mission, missionData: o.missionData, level: o.level, players: o.players || ['teddy'], seed: o.seed || 1,
      auto: o.auto !== false, immortal: o.immortal, noGuns: o.noGuns, bossHpK: o.bossHpK,
    });
    if (o.clumsy) S.clumsy = true;
    if (o.letForms) S.letForms = true;
    if (o.tweak) o.tweak(S);
    const maxT = o.maxT || 420;
    let nextCall = o.buddyEvery ? 3 : Infinity;
    let minHearts = 99, stuck = false, maxIdle = 0;
    while (!S.cleared && !S.over && S.t < maxT) {
      if (S.t >= nextCall) { S.callBuddy(); nextCall += o.buddyEvery; }
      S.step(DT);
      for (const P of S.players) if (!P.out) minHearts = Math.min(minHearts, P.hearts);
      if (S.phase === 'play') maxIdle = Math.max(maxIdle, S.stats.idleT);
      if (S.phase === 'play' && S.stats.idleT > (o.stuckAfter || 75)) { stuck = true; break; }
      S.events.length = 0;
    }
    return {
      mission: S.missionNo, name: S.M.name, level: S.level, cleared: S.cleared, died: S.over, time: Math.round(S.t),
      hits: S.stats.hits, minHearts, pops: S.stats.pops, specials: S.stats.specials, stuck, maxIdle: Math.round(maxIdle),
      bossTime: Math.round(S.stats.bossTime), rescues: S.stats.rescues, rides: S.stats.rides, forms: Object.assign({}, S.stats.forms),
      cures: S.stats.cures, saves: S.stats.saves, calls: S.stats.calls, potionDrops: S.stats.potionDrops, bails: S.stats.bails,
      ridePops: S.stats.ridePops, teamups: S.stats.teamups, revives: S.stats.revives, score: S.score(), phase: S.phase,
      bossHp: S.boss ? Math.max(0, Math.round(S.boss.hp)) : null,
    };
  }

  function soak(o = {}) {
    const list = o.missions || JUG.MISSIONS.map((_, k) => k + 1);
    return list.map((mission) => run(Object.assign({}, o, { mission })));
  }

  // ------------------------------------------------------------------ rules: one small scene each

  function fresh(o = {}) {
    const M = JUG.sim;
    const S = new M.Sim(Object.assign({ mission: 1, level: 'normal', players: ['teddy'], seed: 7, auto: false }, o));
    return S;
  }
  function steps(S, sec, each) {
    const n = Math.round(sec / DT);
    for (let k = 0; k < n; k++) { if (each) each(S, k); S.step(DT); }
  }
  function evs(S, type) { return S.events.filter((e) => e.type === type); }
  // keep a scene calm: no beats, no baddies except the ones the test adds
  function calm(S) { S.evI = S.beats.length; S.camL = 20; S.camR = 20 + JUG.sim.VW; for (const P of S.players) { P.x = 24 - P.i * 1.5; P.y = 0; P.invulnT = 0; } S.lastCamL = S.camL; S.lock = { x: S.camR, waves: [], i: 0, t: 0, test: true }; }
  function hitWith(S, kind, P) { return S.foeShot(kind, P.x + 3, P.y + 1, P, null, { tx: P.x, ty: P.y + 0.9 }); }

  function rules() {
    const M = JUG.sim;
    const out = [];
    const rule = (name, fn) => {
      try {
        const r = fn();
        out.push({ name, ok: r === true || (r && r.ok), info: r && r.info });
      } catch (e) { out.push({ name, ok: false, info: 'threw ' + e.message }); }
    };

    rule('a zombie bite turns you into a zombie, without losing a heart', () => {
      const S = fresh({ mission: 2 }); calm(S);
      const P = S.players[0], h = P.hearts;
      S.spawnFoe('zombie', P.x + 0.4, 0);
      steps(S, 0.3);
      return { ok: P.form === 'zombie' && P.hearts === h, info: `${P.form}, ${P.hearts}/${h} hearts` };
    });
    rule('a zombie walks slowly and wobbles, and its BLEH! crosses the screen through every baddie', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('zombie');
      const foes = [3, 7, 11, 15, 19].map((d) => S.spawnFoe('robot', P.x + d, 0));
      for (const f of foes) f.fireT = 99;
      S.input[0].fire = true;
      steps(S, 0.05);
      S.input[0].fire = false;
      const x0 = P.x;
      S.input[0].dx = 1;
      steps(S, 1.6);
      const walked = P.x - x0;
      const popped = foes.filter((f) => f.dead).length;
      return { ok: popped === 5 && walked < 6.2 * 1.6 * 0.6, info: `${popped}/5 popped by one blast, walked ${walked.toFixed(1)} in 1.6 s` };
    });
    rule('a cure potion turns you back', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('zombie');
      S.spawnItem('potion', P.x, P.y + 0.5, { vy: 0 });
      steps(S, 0.6);
      return { ok: P.form === 'normal' && evs(S, 'cure').length === 1, info: P.form };
    });
    rule('mummy dust wraps you up: slower and shorter jumps; a potion cures it', () => {
      const S = fresh({ mission: 3 }); calm(S);
      const P = S.players[0];
      hitWith(S, 'dust', P);
      steps(S, 1.5);
      const form = P.form;
      S.input[0].jump = true;
      let top = 0;
      steps(S, 0.8, () => { top = Math.max(top, P.y); });
      S.input[0].jump = false;
      steps(S, 0.6);
      const slow = M.FORMS.mummy.speed < M.FORMS.normal.speed;
      S.give('potion');
      return { ok: form === 'mummy' && top < 1.8 && slow && P.form === 'normal', info: `${form}, jump ${top.toFixed(2)}` };
    });
    rule('a banana ray turns you into a quick monkey with a small blaster; it wears off by itself', () => {
      const S = fresh({ mission: 4 }); calm(S);
      const P = S.players[0];
      hitWith(S, 'ray', P);
      steps(S, 1);
      const form = P.form;
      S.input[0].fire = true;
      steps(S, 0.1);
      const shot = S.shots.find((b) => b.owner === 0);
      S.input[0].fire = false;
      steps(S, M.FORMS.monkey.dur + 0.5);
      return { ok: form === 'monkey' && shot && shot.kind === 'mini' && P.form === 'normal' && M.FORMS.monkey.speed > M.FORMS.normal.speed, info: `${form} → ${P.form}` };
    });
    rule('mummy dust on a mummy (and goo on a zombie) just tickles: no heart lost', () => {
      const S = fresh({ mission: 3 }); calm(S);
      const P = S.players[0];
      S.give('mummy');
      const h = P.hearts;
      hitWith(S, 'dust', P);
      steps(S, 1.5);
      P.invulnT = 0;
      S.give('zombie');
      hitWith(S, 'goo', P);
      steps(S, 1.5);
      return { ok: P.hearts === h && evs(S, 'tickle').length === 2, info: `${P.hearts}/${h} hearts, ${evs(S, 'tickle').length} tickles` };
    });
    rule('a monkey swings on vines and lets go with jump', () => {
      const S = fresh({ mission: 4 });
      S.warp(70);
      S.evI = S.beats.length;
      S.lock = { x: S.camR, waves: [], i: 0, t: 0 };
      const P = S.players[0];
      S.give('monkey');
      P.x = 72; P.y = 0; P.invulnT = 99;
      S.input[0].jump = true;
      let grabbed = false;
      steps(S, 0.6, () => { if (P.vine) grabbed = true; });
      S.input[0].jump = false;
      steps(S, 0.1);
      S.input[0].jump = true;
      steps(S, 0.05);
      S.input[0].jump = false;
      return { ok: grabbed && !P.vine && S.stats.swings > 0, info: `grabbed ${grabbed}` };
    });
    rule('eating too many treats makes you chubby: slower, bigger shots, and it burns off', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      for (let k = 0; k < 8; k++) S.spawnItem('treat', P.x, P.y + 0.5, { vy: 0 });
      steps(S, 0.6);
      const form = P.form;
      S.input[0].fire = true;
      steps(S, 0.05);
      S.input[0].fire = false;
      const shot = S.shots.find((b) => b.owner === 0);
      steps(S, M.FORMS.chubby.dur + 0.5);
      return { ok: form === 'chubby' && shot && shot.r > M.GUNS.ball.r * 1.5 && P.form === 'normal', info: `${form}, shot r ${shot && shot.r.toFixed(2)}` };
    });
    rule('ice turns you into a snowman who can only roll; you thaw out, faster if you wiggle', () => {
      const thaw = (wiggle) => {
        const S = fresh({ mission: 5 }); calm(S);
        const P = S.players[0];
        hitWith(S, 'ice', P);
        let t0 = null, shots = 0;
        steps(S, 9, (S2, k) => {
          if (P.form === 'snow' && t0 === null) t0 = S2.t;
          S2.input[0].fire = P.form === 'snow' && (wiggle ? k % 6 < 3 : true);
          if (P.form === 'snow') shots += S2.shots.length;
        });
        return { form: S.stats.forms.snow, t: S.events.length >= 0 ? (S.stats.cures ? 1 : 0) : 0, shots, S, t0, P };
      };
      const a = thaw(false), b = thaw(true);
      const end = (r) => { const e = r.S.events.find((x) => x.type === 'cure'); return e ? e.t - r.t0 : 99; };
      const ta = end(a), tb = end(b);
      return { ok: a.form === 1 && a.shots === 0 && ta < 7 && tb < ta - 1, info: `thaw ${ta.toFixed(1)} s, wiggling ${tb.toFixed(1)} s` };
    });
    rule('a rolling snowman bonks baddies', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('snow');
      const f = S.spawnFoe('crab', P.x + 2.5, 0);
      f.hp = 1;
      P.invulnT = 99;
      S.input[0].dx = 1;
      steps(S, 1);
      return { ok: f.dead, info: f.dead ? 'BONK' : 'missed' };
    });
    rule('hop into the TT TANK by walking into it; its gun aims 8 ways and the cannon goes BOOM; S + jump hops out', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      const V = S.addRide('tank', P.x + 2);
      S.input[0].dx = 1;
      steps(S, 0.6);
      const boarded = P.veh === V;
      S.input[0].dx = 0;
      S.input[0].dy = 1;
      S.input[0].fire = true;
      steps(S, 0.5);
      const up = S.shots.some((b) => b.kind === 'vulcan' && b.vy > 15);
      S.input[0].dy = 0;
      S.input[0].fire = false;
      S.input[0].special = true;
      steps(S, 0.05);
      S.input[0].special = false;
      const shell = S.shots.some((b) => b.kind === 'shell');
      steps(S, 0.3);
      S.input[0].dy = -1;
      S.input[0].jump = true;
      steps(S, 0.05);
      S.input[0].jump = false;
      S.input[0].dy = 0;
      steps(S, 0.5);
      return { ok: boarded && up && shell && !P.veh && V.state === 'parked', info: `boarded ${boarded}, up ${up}, shell ${shell}` };
    });
    rule('the ride takes the hits (no hearts lost); BAIL OUT! warns; bailing sends it rolling into the baddies', () => {
      const S = fresh(); calm(S);
      const P = S.players[0], h = P.hearts;
      const V = S.addRide('tank', P.x);
      steps(S, 0.1);
      let k = 0;
      while (V.hp > 1 && k++ < 20) { V.invulnT = 0; S.hurt(P, {}); }
      const warned = evs(S, 'bailWarn').length === 1;
      const f = S.spawnFoe('robot', P.x + 6, 0);
      f.fireT = 99;
      S.input[0].dy = -1; S.input[0].jump = true;
      steps(S, 0.05);
      S.input[0].dy = 0; S.input[0].jump = false;
      steps(S, 1.5);
      return { ok: P.hearts === h && warned && S.stats.bails === 1 && f.dead, info: `${P.hearts}/${h} hearts, warned ${warned}, foe ${f.dead ? 'popped' : 'fine'}` };
    });
    rule('a ride that breaks pops you out safe, without losing a heart', () => {
      const S = fresh(); calm(S);
      const P = S.players[0], h = P.hearts;
      const V = S.addRide('llama', P.x);
      steps(S, 0.1);
      const was = P.veh === V;
      for (let k = 0; k < 20 && P.veh; k++) { V.invulnT = 0; S.hurt(P, {}); }
      return { ok: was && !P.veh && P.hearts === h && P.invulnT > 1 && S.stats.ridePops === 1, info: `${P.hearts}/${h}` };
    });
    rule('the BOING BOT ground pound bonks everything around it', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.addRide('mech', P.x);
      steps(S, 0.1);
      const fs = [S.spawnFoe('windup', P.x + 2.2, 0), S.spawnFoe('windup', P.x - 2.2, 0)];
      for (const f of fs) { f.hp = 4; f.fireT = 99; }
      S.input[0].special = true;
      steps(S, 0.05);
      S.input[0].special = false;
      steps(S, 1.4);
      return { ok: fs.every((f) => f.dead) && evs(S, 'pound').length === 1, info: `${fs.filter((f) => f.dead).length}/2` };
    });
    rule('free a tied-up Fuzzbeard: he salutes and gives you his present', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.pows.push({ id: 999, x: P.x + 6, y: 0, state: 'tied', t: 0, carry: 'water', face: -1, target: 0 });
      S.input[0].fire = true;
      steps(S, 0.6);
      S.input[0].fire = false;
      steps(S, 4);
      return { ok: S.stats.rescues === 1 && evs(S, 'salute').length === 1 && P.gun === 'water', info: `rescues ${S.stats.rescues}, gun ${P.gun}` };
    });
    rule("Bruno's balloon drop brings a crate of balloons", () => {
      const S = fresh(); calm(S);
      const P = S.players[0], b0 = P.balloons;
      S.addDrop(P.x, 'balloons');
      steps(S, 5);
      return { ok: P.balloons === b0 + 10 && evs(S, 'dropped').length === 1, info: `${b0} → ${P.balloons}` };
    });
    rule('Coco the monkey fights alongside you with a water blaster for a while', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('coco');
      const fs = [S.spawnFoe('windup', P.x + 7, 0), S.spawnFoe('windup', P.x + 9, 0)];
      for (const f of fs) f.fireT = 99;
      P.invulnT = 99;
      steps(S, 4);
      const pops = S.stats.cocoPops;
      steps(S, S.L.coco + 3);
      return { ok: pops >= 1 && !S.coco, info: `${pops} popped by Coco` };
    });
    rule('1 player: call your brother any time; he runs in, says hello with his move and tosses you a treat', () => {
      const S = fresh({ players: ['teddy'] }); calm(S);
      const P = S.players[0];
      P.hearts = 2;
      S.callBuddy();
      steps(S, 3.5);
      const hello = evs(S, 'hello')[0];
      const took = evs(S, 'take').find((e) => e.gift === 'tommy');
      return { ok: S.buddy && S.buddy.kind === 'tommy' && hello && hello.sig === 'peace' && took && P.hearts === 3, info: `hello ${hello && hello.sig}, treat ${took && took.treat}, hearts ${P.hearts}` };
    });
    rule("Tommy's ✌️ peace wave bonks the baddies in front of him", () => {
      const S = fresh({ players: ['teddy'] }); calm(S);
      const P = S.players[0];
      const f = S.spawnFoe('robot', P.x + 5, 0);
      f.fireT = 99;
      P.invulnT = 99;
      S.callBuddy();
      steps(S, 2.5);
      return { ok: evs(S, 'peaceWave').length === 1 && f.hp < f.maxHp, info: `robot hp ${f.hp}` };
    });
    rule("Teddy (Tommy's companion) says hello with his jab and straight, then his jump shot next time", () => {
      const S = fresh({ players: ['tommy'] }); calm(S);
      const P = S.players[0];
      P.invulnT = 99;
      S.callBuddy();
      steps(S, 2.5);
      S.callBuddy();
      steps(S, 2);
      const h = evs(S, 'hello').map((e) => e.sig);
      return { ok: S.buddy.kind === 'teddy' && h[0] === 'boxing' && h[1] === 'jumpshot' && evs(S, 'punch').length >= 2, info: h.join(', ') };
    });
    rule('while he is there he blocks hits: TOMMY SAVED YOU!', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.callBuddy();
      steps(S, 2);
      const h = P.hearts;
      P.invulnT = 0;
      hitWith(S, 'cork', P);
      steps(S, 1);
      P.invulnT = 0;
      S.spawnFoe('zombie', P.x + 0.3, 0);
      steps(S, 0.3);
      return { ok: P.hearts === h && S.stats.saves >= 2 && P.form === 'normal', info: `saves ${S.stats.saves}, hearts ${P.hearts}/${h}, ${P.form}` };
    });
    rule('he brings a cure potion when you have been turned into something', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('mummy');
      S.callBuddy();
      steps(S, 3.5);
      return { ok: P.form === 'normal' && evs(S, 'treatToss')[0].item === 'potion', info: P.form };
    });
    rule('call him as often as you like: 30 calls in a row, each one keeps him longer', () => {
      const S = fresh(); calm(S);
      let calls = 0, gone = false;
      for (let k = 0; k < 30; k++) {
        if (S.callBuddy()) calls++;
        steps(S, 4);
        if (!S.buddy) gone = true;
      }
      return { ok: calls === 30 && !gone && S.stats.calls === 30, info: `${calls} calls, left ${gone ? 'early' : 'never'}` };
    });
    rule('a zombie who cannot find a potion gets one from Bruno', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('zombie');
      steps(S, S.L.potionAfter + 5);
      return { ok: S.stats.potionDrops >= 1 && P.form === 'normal', info: `${S.stats.potionDrops} drops, ${P.form}` };
    });
    rule('a fight stops the screen until every baddie is bonked, then GO!', () => {
      const S = fresh({ level: 'easy' });
      const P = S.players[0];
      P.invulnT = 1e9;
      const lock = S.beats.find((b) => b[1] === 'lock');
      S.warp(lock[0] - 15);
      let held = true, sawLock = false;
      S.auto[0] = true;
      steps(S, 60, (S2) => {
        if (S2.lock && !S2.lock.boss) { sawLock = true; if (S2.camR > S2.lock.x + 0.01) held = false; }
      });
      return { ok: sawLock && held && evs(S, 'go').length >= 1, info: `held ${held}` };
    });
    rule('2 players: a high five revives a bonked-out brother, then needs a rest', () => {
      const S = fresh({ players: ['teddy', 'tommy'] }); calm(S);
      const [A, B] = S.players;
      B.hearts = 1;
      B.invulnT = 0;
      S.hurt(B, {});
      const out = B.out;
      const ok1 = S.teamUp(0);
      const ok2 = S.teamUp(1);
      return { ok: out && ok1 && !ok2 && !B.out && A.shieldT > 0 && B.shieldT > 0, info: `out ${out}, first ${ok1}, second ${ok2}` };
    });
    rule('2 players: a bonked-out brother also comes back by himself', () => {
      const S = fresh({ players: ['teddy', 'tommy'], level: 'easy' }); calm(S);
      const B = S.players[1];
      B.hearts = 1; B.invulnT = 0;
      S.hurt(B, {});
      steps(S, S.L.revive + 0.5);
      return { ok: !B.out && B.hearts >= 3 && !S.over, info: `out ${B.out}` };
    });
    rule('the water blaster runs out and your own blaster comes back', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      S.give('water');
      S.input[0].fire = true;
      steps(S, 20);
      return { ok: P.gun === 'ball' && evs(S, 'gunOut').length === 1, info: P.gun };
    });
    rule('your shots pop pies and corks in the air', () => {
      const S = fresh(); calm(S);
      const P = S.players[0];
      P.invulnT = 99;
      const s = S.foeShot('cork', P.x + 8, P.y + 1.25, P, null, { tx: P.x, ty: P.y + 1.25 });
      S.input[0].fire = true;
      steps(S, 0.8);
      return { ok: s.dead && evs(S, 'fizz').length >= 1, info: s.dead ? 'popped' : 'missed' };
    });
    rule('🐣 Easy is gentler than 🔥 Normal: more hearts, slower and bigger throws, fewer baddies, weaker bosses', () => {
      const E = M.LEVELS.easy, N = M.LEVELS.normal;
      return E.hearts > N.hearts && E.shotSpeed < N.shotSpeed && E.shotSize > N.shotSize && E.count < N.count && E.bossHp < N.bossHp && E.fireK < N.fireK && E.invuln > N.invuln;
    });
    rule('every boss goes down and the mission is cleared', () => {
      const bad = [];
      for (let m = 1; m <= 6; m++) {
        const S = fresh({ mission: m });
        S.winNow();
        steps(S, 3);
        if (!S.cleared) bad.push(m);
      }
      return { ok: !bad.length, info: bad.length ? `not cleared: ${bad}` : 'all 6' };
    });
    rule('TRY AGAIN starts at the last fight, not at the very start', () => {
      const S = fresh({ level: 'easy' });
      const lock = S.beats.find((b) => b[1] === 'lock');
      S.warp(lock[0] - 12);
      S.players[0].invulnT = 1e9;
      steps(S, 6, (S2) => { S2.input[0].dx = 1; });
      const cp = S.checkpoint;
      const S2 = fresh({ level: 'easy', startX: cp });
      steps(S2, 0.2);
      return { ok: cp > 0 && S2.lock && Math.abs(S2.camL - cp) < 0.5, info: `checkpoint ${cp}` };
    });
    return out;
  }

  // ------------------------------------------------------------------ sabotage: broken setups the checks must catch

  function sabotage() {
    const M = JUG.sim;
    const out = [];
    const caught = (name, fn) => {
      let r;
      try { r = fn(); } catch (e) { r = { caught: true, probs: ['threw ' + e.message] }; }
      out.push({ name, caught: !!r.caught, probs: r.probs || [] });
    };
    caught('a player who never moves or shoots does not finish', () => {
      const r = run({ mission: 1, level: 'easy', auto: false, maxT: 200 });
      return { caught: !r.cleared, probs: [`cleared ${r.cleared}, at ${r.time} s`] };
    });
    caught('with no blasters, the soak says "not finished"', () => {
      const r = run({ mission: 1, level: 'easy', noGuns: true, maxT: 300 });
      return { caught: !r.cleared, probs: [`cleared ${r.cleared}${r.stuck ? ', stuck' : ''}`] };
    });
    caught('a boss that can hardly be bonked is not cleared in time', () => {
      const r = run({ mission: 1, level: 'easy', bossHpK: 1000, maxT: 300 });
      return { caught: !r.cleared, probs: [`boss hp left ${r.bossHp}`] };
    });
    caught('a brother who only walks right and fires, never dodging, gets bonked out on Normal (hits really cost hearts)', () => {
      const r = run({ mission: 1, level: 'normal', auto: false, maxT: 300, stuckAfter: 290, tweak: (S) => { S.input[0].fire = true; S.input[0].dx = 1; } });
      return { caught: r.died, probs: [`died ${r.died}, hits ${r.hits}`] };
    });
    caught('a fight that never opens is reported as stuck', () => {
      const r = run({ mission: 1, level: 'easy', maxT: 300, tweak: (S) => { S.updateLock = function () {}; } });
      return { caught: r.stuck || !r.cleared, probs: [`stuck ${r.stuck}, idle ${r.maxIdle} s`] };
    });
    caught('a mission without a boss fails the mission check', () => {
      const bad = JSON.parse(JSON.stringify(JUG.MISSIONS));
      bad[2].boss = 'nobody';
      const res = missions(bad);
      return { caught: res[2].probs.length > 0, probs: res[2].probs };
    });
    caught('zombies with no potions anywhere fail the mission check', () => {
      const bad = JSON.parse(JSON.stringify(JUG.MISSIONS));
      bad[1].beats = bad[1].beats.filter((b) => b[2] !== 'potion');
      const res = missions(bad);
      return { caught: res[1].probs.some((p) => p.includes('potion')), probs: res[1].probs };
    });
    caught('a companion who does not guard fails the "saved you" rule', () => {
      const Sim = M.Sim;
      const keep = Sim.prototype.hurt;
      const S = new Sim({ mission: 1, level: 'normal', players: ['teddy'], seed: 3 });
      S.noGuard = true;
      calm(S);
      const P = S.players[0];
      S.callBuddy();
      steps(S, 2);
      const h = P.hearts;
      P.invulnT = 0;
      hitWith(S, 'cork', P);
      steps(S, 1);
      void keep;
      return { caught: P.hearts < h, probs: [`hearts ${P.hearts}/${h}`] };
    });
    return out;
  }

  JUG.check = { missions, run, soak, rules, sabotage };
})();
