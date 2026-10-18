/* 中文 for JuggernauT: every word on the page, the toasts and banners, the mission and boss names, the ? panel
   (Kit.lang, from kit/lang.js). The comic bursts (BONK!), the HELP! signs and the blaster labels are drawn on
   canvases, so js/art.js asks Kit.lang.t() for them; their words are here too.
   Staying in English on purpose: the kids' names (TEDDY, TOMMY), the game's name (JuggernauT, Alan's pick), Bruno
   (the kit's bear), the TT on the tank, and the 1P / 2P labels. */
(function () {
  const L = Kit.lang;
  L.keep([
    'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY + TOMMY', 'TEDDY & TOMMY', 'TEDDY 1P', 'TOMMY 2P', 'Teddy (1P)', 'Tommy (2P)',
    'JuggernauT', 'TT', 'Claude Code', 'Esc', 'Enter', 'T', 'BRUNO',
  ]);

  const MISSION = {
    'TOY TOWN': '玩具小镇', 'SUNNY BEACH': '阳光海滩', 'PYRAMID SANDS': '金字塔沙漠', 'JUNGLE RUMBLE': '丛林大乱斗',
    'SNOWY PEAKS': '雪山之巅', 'SPOOKY FARM': '怪怪农场',
  };
  const BOSS = {
    'KING CRANKY': '发条大王', 'CAPTAIN CRABCAKE': '螃蟹船长', 'KING WRAPPY': '绷带大王', 'BIG BANANA BOT': '大香蕉机器人',
    'FREEZE-POP KING': '冰棒大王', 'ZOMBIE ZORG': '僵尸佐格',
  };
  const GUN = {
    BASKETBALLS: '篮球', 'PEACE STARS': '比耶星星', 'WATER BLASTER': '水枪', 'BUBBLE GUN': '泡泡枪',
    'MEGA FOAM CANNON': '超级泡沫炮', 'SNOWBALL LAUNCHER': '雪球发射器', 'BLEH!': '噗噜！', 'MINI BLASTER': '迷你小枪',
  };
  const RIDE = { 'TT TANK': 'TT 坦克', 'LOLLY THE LLAMA': '羊驼洛莉', 'BOING BOT': '弹弹机器人' };
  const FORM = { ZOMBIE: '僵尸', MUMMY: '木乃伊', MONKEY: '猴子', CHUBBY: '胖嘟嘟', SNOWMAN: '雪人' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const NAME = '(TEDDY|TOMMY)';
  L.add(Object.assign({}, MISSION, BOSS, GUN, RIDE, FORM));

  L.add({
    // the missions' one-liners
    'The wind-up army marches in!': '发条玩具军团来啦！',
    'Grumpy crabs and sleepy zombies!': '暴躁螃蟹和瞌睡僵尸！',
    'Look out for the mummy dust!': '小心木乃伊的灰尘！',
    'Banana rays turn you into a monkey!': '香蕉射线会把你变成小猴子！',
    'Brrr! Icy snowballs freeze you!': '好冷！冰雪球会把你冻住！',
    'Zombie farmers and the Zombie King!': '僵尸农夫和僵尸大王！',

    // the comic bursts and signs drawn in 3D
    'BONK!': '咚！', 'POP!': '啵！', 'BOING!': '嘣！', 'POW!': '砰！', 'CRACK!': '咔嚓！', 'SPLASH!': '哗啦！',
    'BOOM!': '轰！', 'KA-POOF!': '噗——！', 'MEGA BONK!': '超级咚！', 'FREE!': '自由啦！', 'JAB!': '刺拳！',
    'KER-BONK!': '咕咚！', 'HELP!': '救命！', TOYS: '玩具', 'HEE HEE!': '嘻嘻！',

    // title screen
    'Run, jump and bonk the silly toy army!': '跑呀跳呀，打倒搞笑的玩具军团！',
    '1 player · key 1': '单人 · 按 1', '1 player · key 2': '单人 · 按 2', '2 players together · key 3': '双人一起玩 · 按 3',
    '🐣 EASY': '🐣 简单', 'more hearts, slow throws': '爱心多，飞弹慢', '🔥 NORMAL': '🔥 普通', 'for big kids': '给大孩子玩',
    Difficulty: '难度', 'Previous mission': '上一关', 'Next mission': '下一关', MISSION: '任务',
    'run · aim up / duck': '跑 · 向上瞄准 / 蹲下', 'fire (hold) · jump': '发射（按住）· 跳', 'water balloon 🎈': '水气球 🎈',
    'hop out of a ride': '跳下坐骑', '+ jump': '+ 跳',
    "The pad runs and aims, and your blaster fires by itself. ⬆️ jumps, 🎈 throws a water balloon, and your brother's face calls him in. Two players on an iPad: each one has a pad and buttons on their own side.":
      '摇杆跑步和瞄准，枪会自己发射。⬆️ 跳，🎈 扔水气球，点兄弟的头像叫他来帮忙。两个人用 iPad 玩：每人在自己那边都有摇杆和按钮。',
    'LOADING…': '加载中…',

    // HUD
    'HIGH FIVE': '击掌', 'GO! ➜': '冲啊！➜', JUMP: '跳', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'he blocks hits': '他会帮你挡住攻击',

    // banners
    'WARNING!': '注意！', 'BONKED!': '被打晕啦！', 'HIGH FIVE!': '击掌！', 'CLEAR!': '过关！',

    // toasts
    'Find a 🧪 potion!': '快找 🧪 药水！', 'Swing on the vines!': '抓住藤蔓荡起来！',
    'Big shots! Run it off!': '子弹变大啦！跑跑步就瘦回来！', 'Wiggle to thaw out!': '扭一扭就化开啦！',
    'BACK TO ME!': '变回我自己啦！', '+10 🎈 WATER BALLOONS!': '+10 🎈 水气球！', '🐵 COCO THE MONKEY HELPS!': '🐵 小猴可可来帮忙！',
    'BACK TO 🏀': '换回 🏀', 'BACK TO ✌️': '换回 ✌️', 'NO BALLOONS LEFT': '水气球用完啦',
    'TT TANK!': 'TT 坦克！', 'LOLLY THE LLAMA!': '羊驼洛莉！', 'BOING BOT!': '弹弹机器人！',
    'BAIL OUT!': '快跳出来！', 'BAIL OUT! ⬇️ + ⬆️': '快跳出来！⬇️ + ⬆️', 'BAIL OUT! S + JUMP': '快跳出来！S + 跳',
    'BRUNO BRINGS A 🧪 POTION!': '小熊 Bruno 送来 🧪 药水！', "BRUNO'S BALLOON DROP!": '小熊 Bruno 的气球空投！',
    'BYE, COCO!': '再见，可可！', 'FINISH THIS MISSION FIRST!': '先完成这一关！', 'BACK AT THE LAST FIGHT!': '从上一场战斗重新开始！',

    // pause, tally, over, win
    '↻ RESTART MISSION': '↻ 重新开始这一关', 'P · Esc to resume · R restart · Q menu · M sound': 'P · Esc 继续 · R 重来 · Q 菜单 · M 声音',
    '🫡 Fuzzbeards freed': '🫡 救出的大胡子朋友', '💥 baddies bonked': '💥 打倒的坏蛋', '🪙 coins': '🪙 金币', '🍪 treats': '🍪 零食',
    '🙌 high fives': '🙌 击掌', '⏱️ time': '⏱️ 时间', '⭐ SCORE': '⭐ 得分', 'That was the last mission!': '这是最后一关啦！',
    'NEXT MISSION ▶': '下一关 ▶', 'THE END ▶': '大结局 ▶', 'Enter · Space next · Esc menu': 'Enter · 空格 下一关 · Esc 菜单',
    'Try again from the last fight!': '从上一场战斗再试一次！', 'Try again!': '再试一次！', '↻ TRY AGAIN': '↻ 再试一次',
    'Enter try again · Esc menu': 'Enter 再试一次 · Esc 菜单', 'YOU DID IT!': '成功啦！',
    'Teddy and Tommy bonked the whole toy army!': 'Teddy 和 Tommy 打倒了整个玩具军团！', 'Enter · Esc menu': 'Enter · Esc 菜单',

    // the ? panel
    'aim up · duck (aim down in the air)': '向上瞄准 · 蹲下（在空中向下瞄准）', 'fire (hold it)': '发射（按住）',
    'water balloon 🎈 (in the tank: cannon)': '水气球 🎈（坐坦克时：大炮）',
    'hop out of a ride (bail out when it smokes)': '跳下坐骑（冒烟时快跳出来）',
    'title: Teddy · Tommy · both · easy': '标题页：Teddy · Tommy · 一起 · 简单',
    'Playing alone, both sets of keys work, and T or Enter calls your brother as often as you like.': '一个人玩时两套按键都能用，按 T 或回车随时叫兄弟来帮忙，想叫几次就叫几次。',
    "The pad runs and aims (your blaster fires by itself). ⬆️ jumps, 🎈 throws a water balloon, and your brother's face calls him in. Two players: each has a pad and buttons on their own side.":
      '摇杆跑步和瞄准（枪会自己发射）。⬆️ 跳，🎈 扔水气球，点兄弟的头像叫他来帮忙。两个人玩：每人在自己那边都有摇杆和按钮。',
  });

  // text with names and numbers in it
  L.rule(/^MISSION (\d+)$/, '任务 $1');
  L.rule(/^MISSION (\d+) CLEAR!$/, '任务 $1 过关！');
  L.rule(new RegExp(`^CALL ${NAME}$`), '叫 $1');
  L.rule(new RegExp(`^${NAME} IS BONKED OUT!$`), '$1 被打晕啦！');
  L.rule(new RegExp(`^HIGH FIVE TO BRING ${NAME} BACK!$`), '击掌就能把 $1 叫回来！');
  L.rule(new RegExp(`^${NAME} IS BACK!$`), '$1 回来啦！');
  L.rule(new RegExp(`^${NAME} IS BACK TO NORMAL!$`), '$1 变回来啦！');
  L.rule(new RegExp(`^BLEH! ZOMBIE ${NAME}!$`), '噗噜！僵尸 $1！');
  L.rule(new RegExp(`^WRAPPED UP! MUMMY ${NAME}!$`), '包成粽子啦！木乃伊 $1！');
  L.rule(new RegExp(`^OOH OOH! MONKEY ${NAME}!$`), '呜呜啊啊！猴子 $1！');
  L.rule(new RegExp(`^TOO MANY TREATS! CHUBBY ${NAME}!$`), '零食吃太多！胖嘟嘟 $1！');
  L.rule(new RegExp(`^BRRR! SNOWMAN ${NAME}!$`), '好冷！雪人 $1！');
  L.rule(new RegExp(`^(\\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM ${NAME}!$`), (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(new RegExp(`^🧪 POTION FROM ${NAME}!$`), '🧪 $1 送来的药水！');
  L.rule(/^(\d+) TREATS! CAREFUL\.\.\.$/, '吃了 $1 个零食！小心……');
  L.rule(/^(\S+) (WATER BLASTER|BUBBLE GUN|MEGA FOAM CANNON|SNOWBALL LAUNCHER)!$/, (m, e, g) => `${e} ${GUN[g]}！`);
  L.rule(/^THANK YOU! (.+)$/, '谢谢你！$1');
  L.rule(new RegExp(`^HERE COMES ${NAME}!$`), '$1 来啦！');
  L.rule(new RegExp(`^${NAME} STAYS LONGER!$`), '$1 多待一会儿！');
  L.rule(new RegExp(`^${NAME} SAVED YOU!$`), '$1 救了你！');
  L.rule(new RegExp(`^BYE, ${NAME}! \\(T TO CALL AGAIN\\)$`), '再见，$1！（按 T 再叫他）');
  L.rule(new RegExp(`^🛡️ ${NAME} saved you$`), '🛡️ $1 救了你');
  L.rule(/^Next: (.+)!$/, (m, n) => `下一站：${MISSION[n] || n}！`);
  L.rule(new RegExp(`^${NAME} bonked the whole toy army!$`), '$1 打倒了整个玩具军团！');
})();
