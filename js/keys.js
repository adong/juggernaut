/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: JUG.TITLE, // the name lives in js/title.js
  cols: ['Teddy (1P)', 'Tommy (2P)'],
  keys: [
    ['run', 'A D', '← →'],
    ['aim up · duck (aim down in the air)', 'W · S', '↑ · ↓'],
    ['fire (hold it)', 'F', 'J'],
    ['jump', 'G or Space', 'K'],
    ['water balloon 🎈 (in the tank: cannon)', 'H', 'L'],
    ['hop out of a ride (bail out when it smokes)', 'S + jump', '↓ + jump'],
    ['call your brother · high five', 'T', 'Enter'],
    ['pause · sound', 'P or Esc · M', ''],
    ['title: Teddy · Tommy · both · easy', '1 2 3 E', ''],
  ],
  note: 'Playing alone, both sets of keys work, and T or Enter calls your brother as often as you like.',
  touch: 'The pad runs and aims (your blaster fires by itself). ⬆️ jumps, 🎈 throws a water balloon, and your brother\'s face calls him in. Two players: each has a pad and buttons on their own side.',
});
