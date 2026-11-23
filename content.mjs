const attack = 'attack';
const skill = 'skill';
const power = 'power';

const any = '*';
const odd = 'O';
const even = 'E';

function card(name, rarity, type, slots, text, upgraded, icon, upgradedSlots = slots) {
  return {name, rarity, type, slots, text, upgraded, icon, upgradedSlots};
}

export const cards = {
  strike: card('Strike', 'basic', attack, [any], 'Deal 4 damage.', 'Deal 6 damage.', 'blade'),
  defend: card('Defend', 'basic', skill, [any], 'Gain 4 Block.', 'Gain 6 Block.', 'shield'),
  bash: card('Bash', 'basic', attack, ['4+'], 'Deal 6 damage. Apply 2 Vulnerable.', 'Deal 8 damage. Apply 3 Vulnerable.', 'hammer'),
  splitter: card('Splitter', 'common', skill, ['2+'], 'Split the die into two dice totaling its value.', 'Split the die into two dice totaling its value. Gain 1 reroll.', 'split'),
  hammer: card('Hammer Time', 'common', attack, ['6'], 'Deal 12 damage.', 'Deal 18 damage.', 'hammer'),
  sand: card('Pocket Sand', 'common', skill, [any], 'Gain 2 Block. Roll a die.', 'Gain 4 Block. Roll a die.', 'spark'),
  balanced: card('Balanced Strike', 'common', attack, [even], 'Deal 3 damage. Gain 3 Block.', 'Deal 5 damage. Gain 5 Block.', 'shield'),
  lucky: card('Lucky Day', 'common', skill, [any], 'Roll a die.', 'Roll a die. Gain 1 reroll.', 'die'),
  uppercut: card('Uppercut', 'common', attack, [odd], 'Deal 1 damage 3 times.', 'Deal 1 damage 4 times.', 'fist'),
  jab: card('Jab Jab…', 'common', attack, [any], 'Deal 3 damage. Gain 2 Strength this turn.', 'Deal 5 damage. Gain 3 Strength this turn.', 'fist'),
  quick: card('Quick Strike', 'common', attack, ['3-'], 'Deal 5 damage. Gain 1 reroll.', 'Deal 5 damage. Gain 2 rerolls.', 'blade'),
  dash: card('Dash', 'common', skill, ['3-'], 'Gain 5 Block. Gain 1 reroll.', 'Gain 5 Block. Gain 2 rerolls.', 'wind'),
  immolate: card('Immolate', 'common', attack, ['(5)'], 'Lose 1 HP. Deal 5 damage to all enemies.', 'Lose 1 HP. Deal 7 damage to all enemies.', 'flame'),
  increment: card('Increment', 'common', skill, ['4-'], 'Increase the die by 1.', 'Increase the die by 1.', 'die', ['5-']),
  whirlwind: card('Whirlwind', 'uncommon', attack, [any], 'Deal 3 damage to all enemies once per pip.', 'Deal 3 damage to all enemies once per pip, plus one hit.', 'wind'),
  reset: card('Reset', 'uncommon', skill, [even], 'Discard 1 other card. Roll a die.', 'Discard up to 2 other cards. Roll a die.', 'split'),
  rapid: card('Rapid Fire', 'uncommon', attack, [any, any], 'Deal 2 damage 5 times.', 'Deal 3 damage 5 times.', 'spark'),
  boulder: card('Pocket Boulder', 'uncommon', attack, ['(10)'], 'Deal 8 damage. Apply 1 Weak and 1 Vulnerable.', 'Deal 12 damage. Apply 1 Weak and 1 Vulnerable.', 'hammer'),
  angry: card('So Angry', 'rare', power, ['**'], 'Gain 2 Strength at the start of each turn.', 'Gain 3 Strength at the start of each turn.', 'flame'),
  shields: card('Shields Up', 'rare', power, [even, even], 'Block carries over between turns.', 'Block carries over between turns.', 'shield', [even]),
  impervious: card('Impervious', 'rare', skill, ['6'], 'Gain 30 Block. Exhaust.', 'Gain 40 Block. Exhaust.', 'shield'),
  calculus: card('Calculus', 'rare', power, ['(6)'], 'Gain 1 Strength this turn whenever you reroll.', 'Gain 2 Strength this turn whenever you reroll.', 'die'),
};

export const pool = Object.fromEntries(['common', 'uncommon', 'rare'].map(rarity => [
  rarity, Object.keys(cards).filter(key => cards[key].rarity === rarity),
]));

export const relics = {
  chemical: {name:'Chemical X', icon:'flame', text:'Dice in countdown slots count for 2 more.'},
  iron: {name:'Forge Seal', icon:'fist', text:'Start combat with 1 Strength.'},
  leather: {name:'Cinder Wrap', icon:'wind', text:'Start combat with 1 Dexterity.'},
  heart: {name:'Basalt Heart', icon:'heart', text:'Gain 10 maximum HP.'},
  spark: {name:'Ash Bell', icon:'spark', text:'Deal 3 damage to all enemies at the start of every turn.'},
  thorns: {name:'Briar Clasp', icon:'blade', text:'Start combat with 3 Thorns.'},
  cycle: {name:'Winding Key', icon:'split', text:'Gain 1 extra reroll every third turn.'},
  dice: {name:'Kiln Die', icon:'die', text:'Roll 1 extra die every third turn.'},
};

export const route = [
  {kind:'draft', name:'Neow', icon:'spark'},
  {kind:'combat', name:'Sludge', foe:'sludge', icon:'blade'},
  {kind:'combat', name:'Gremlin', foe:'gremlin', icon:'blade'},
  {kind:'event', name:'Event', icon:'question'},
  {kind:'shop', name:'Shop', icon:'die'},
  {kind:'elite', name:'Serpents', foe:'serpent', icon:'fist'},
  {kind:'treasure', name:'Treasure', icon:'relic'},
  {kind:'camp', name:'Campsite', icon:'flame'},
  {kind:'boss', name:'Spider Queen', foe:'queen', icon:'crown'},
];

export const foes = {
  sludge: {name:'Sludge', hp:[18,22], moves:[
    {damage:4, weak:1}, {damage:6}, {damage:3, strength:3},
  ]},
  gremlin: {name:'Gremlin', hp:[22,26], moves:[
    {damage:5}, {damage:1, times:4}, {block:3, strength:1},
  ]},
  serpent: {name:'Serpent', hp:[13,15], moves:[
    {damage:2}, {damage:3}, {damage:1, times:3}, {strength:1},
  ]},
  queen: {name:'Spider Queen', hp:[68,68], moves:[
    {block:6}, {damage:10}, {damage:4, times:2}, {damage:6, block:6}, {strength:1, sap:1},
  ]},
};

export const wares = {
  upgrade: {name:'Smith’s File', text:'Upgrade one card.', icon:'hammer'},
  double: {name:'Twin Coals', text:'Upgrade two random cards.', icon:'flame'},
  upgraded: {name:'Tempered Stock', text:'Choose one upgraded card.', icon:'spark'},
  remove: {name:'Empty Sheath', text:'Remove one card.', icon:'blade'},
  uncommon: {name:'Locked Cabinet', text:'Choose one uncommon card.', icon:'relic'},
  common: {name:'Salvage Tray', text:'Choose two common cards.', icon:'die'},
  transform: {name:'Casting Mold', text:'Transform one card.', icon:'split'},
};

export const events = [
  {name:'The Toll Furnace', text:'An iron furnace still burns. A card lies beyond its mouth.',
    options:[['Reach in','Lose 6 HP. Choose an upgraded uncommon.', 'event-uncommon'], ['Pass by','', 'leave']]},
  {name:'An Ashen Cistern', text:'A basin holds rainwater beneath a blanket of ash.',
    options:[['Drink','Heal 12 HP.', 'heal'], ['Search the drain','Choose a common card.', 'event-common']]},
  {name:'The Hungry Mold', text:'Two halves of a casting mold chatter in the draft.',
    options:[['Feed it','Transform one card.', 'event-transform'], ['Pass by','', 'leave']]},
  {name:'A Hammer in the Wall', text:'A smith’s hammer hangs from a chain bolted into cracked stone.',
    options:[['Use the hammer','Upgrade one card.', 'event-upgrade'], ['Break the chain','Lose 3 HP. Upgrade two random cards.', 'event-double']]},
  {name:'The Thin Bridge', text:'An old bridge sags over the warm dark.',
    options:[['Lighten your pack','Remove one card.', 'event-remove'], ['Take the stairs','Heal 7 HP.', 'small-heal']]},
  {name:'The Silent Broker', text:'A masked broker places three objects on a slab.',
    options:[['Make a trade','Lose 5 HP. Choose a relic.', 'event-relic'], ['Pass by','', 'leave']]},
  {name:'Cinders in the Wall', text:'Three etched cards turn in the heat above a cracked vent.',
    options:[['Take a card','Choose a card.', 'event-reward'], ['Seal the vent','Heal 8 HP.', 'vent-heal']]},
];
