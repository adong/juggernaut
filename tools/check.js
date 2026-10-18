#!/usr/bin/env node
/* Runs the mission check in Node (no browser, no npm):
     node tools/check.js                      mission data, the rules, and the sabotage cases (--verbose lists every rule)
     node tools/check.js --soak [--seeds=N] [--easy | --normal] [--1p | --2p | --both] [--buddy] [--clumsy] [--transform] [--mission=N]
   --transform lets the autopilot get turned into a zombie, mummy, monkey or snowman (it still has to finish);
   --clumsy thinks slowly and dawdles (a feel for difficulty, not pass/fail); --buddy calls the companion every 15 s.
   Without --easy/--normal the soak plays both. Without --1p/--2p it plays 1 player (Teddy and Tommy in turn).
   Loads the game's rules (title, missions, sim, brain, check) into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON, Set, Map };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/missions.js', 'js/sim.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const JUG = ctx.JUG;
const args = process.argv.slice(2);
const has = (a) => args.includes(a);
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
let bad = 0;

const ms = JUG.check.missions();
for (const m of ms) {
  if (m.probs.length) bad++;
  console.log(`${m.probs.length ? 'FAIL' : 'ok  '} mission ${m.mission} ${String(m.name).padEnd(14)} ${String(m.beats).padStart(3)} beats, ${m.len} long${m.probs.length ? ': ' + m.probs.join('; ') : ''}`);
}
console.log(`mission check: ${ms.length} missions, ${ms.filter((m) => m.probs.length).length} with problems`);

if (!has('--no-rules')) {
  const rules = JUG.check.rules();
  console.log(`rules: ${rules.filter((r) => r.ok).length} of ${rules.length} ok`);
  for (const r of rules) if (!r.ok || has('--verbose')) console.log(`  ${r.ok ? 'ok' : 'FAIL'}: ${r.name}${r.info ? ' (' + r.info + ')' : ''}`);
  if (rules.some((r) => !r.ok)) bad++;
}

if (!has('--no-sabotage') && !has('--soak')) {
  const t0 = Date.now();
  const sab = JUG.check.sabotage();
  console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken setups caught (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.probs.length ? ' (' + s.probs.join('; ') + ')' : ''}`);
  if (sab.some((s) => !s.caught)) bad++;
}

if (has('--soak')) {
  const levels = has('--easy') ? ['easy'] : has('--normal') ? ['normal'] : ['easy', 'normal'];
  const groups = has('--2p') ? [['teddy', 'tommy']] : has('--both') ? [['teddy'], ['tommy'], ['teddy', 'tommy']] : [['teddy'], ['tommy']];
  const seeds = Number(opt('seeds')) || 2;
  const only = opt('mission') ? [Number(opt('mission'))] : undefined;
  const buddyEvery = has('--buddy') ? 15 : 0;
  const clumsy = has('--clumsy'); // a slow, sloppy player: not a pass/fail test, a feel for how hard each mission is
  const letForms = has('--transform'); // walks into zombie bites, mummy dust, banana rays and ice: must still finish
  for (const level of levels) {
    for (const players of groups) {
      const t0 = Date.now();
      let runs = 0, unfinished = 0, stuck = 0, hits = 0, worst = 99;
      const per = {};
      for (let seed = 1; seed <= seeds; seed++) {
        const res = JUG.check.soak({ level, players, clumsy, letForms, missions: only, seed: seed * 101 + players.length * 7 + (players[0] === 'tommy' ? 3 : 0), buddyEvery: players.length === 1 ? buddyEvery : 0 });
        for (const r of res) {
          runs++;
          const ok = r.cleared && !r.died;
          if (!ok) unfinished++;
          if (r.stuck) stuck++;
          hits += r.hits;
          worst = Math.min(worst, r.minHearts);
          const p = per[r.mission] || (per[r.mission] = { name: r.name, ok: 0, n: 0, hits: 0, time: 0, boss: 0, minHearts: 99, forms: {}, rescues: 0, rides: 0, cures: 0, saves: 0 });
          p.n++; if (ok) p.ok++; p.hits += r.hits; p.time += r.time; p.boss += r.bossTime; p.minHearts = Math.min(p.minHearts, r.minHearts);
          p.rescues += r.rescues; p.rides += r.rides; p.cures += r.cures; p.saves += r.saves;
          for (const [k, v] of Object.entries(r.forms)) p.forms[k] = (p.forms[k] || 0) + v;
          if (!ok || r.stuck) console.log(`  ${level} ${players.join('+')} seed ${seed} mission ${r.mission} ${r.name}: ${r.cleared ? 'cleared' : 'NOT CLEARED'}${r.died ? ' (lost every heart)' : ''}${r.stuck ? ' STUCK ' + r.maxIdle + ' s' : ''} at ${r.time} s (${r.phase}, boss hp ${r.bossHp}), hits ${r.hits}`);
        }
      }
      console.log(`soak ${level} ${players.join('+')}: ${runs} runs, ${unfinished} not finished, ${stuck} stuck, ${hits} hits in all, fewest hearts left ${worst} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      for (const [k, p] of Object.entries(per)) {
        const forms = Object.entries(p.forms).filter(([, v]) => v).map(([f, v]) => `${f} ${(v / p.n).toFixed(1)}`).join(' ');
        console.log(`    mission ${k} ${p.name.padEnd(14)} finished ${p.ok}/${p.n}  ${Math.round(p.time / p.n)} s  boss ${Math.round(p.boss / p.n)} s  hits ${(p.hits / p.n).toFixed(1)}  fewest hearts ${p.minHearts}  rescues ${(p.rescues / p.n).toFixed(1)}  rides ${(p.rides / p.n).toFixed(1)}  cures ${(p.cures / p.n).toFixed(1)}${p.saves ? '  saves ' + (p.saves / p.n).toFixed(1) : ''}${forms ? '  forms: ' + forms : ''}`);
      }
      if ((unfinished && !clumsy) || stuck) bad++;
    }
  }
}
process.exitCode = bad ? 1 : 0;
