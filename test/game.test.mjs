import test from 'node:test';
import assert from 'node:assert/strict';
import {accepts, enemyIntent, Game, seededRandom} from '../game.mjs';
import {cards, route} from '../content.mjs';

function run(seed = 'test') { return new Game(seededRandom(seed)); }

function draft(game) {
  for (const key of game.draft.slice(0, 3)) game.selectDraft(key);
  assert.equal(game.confirmDraft(),true);
}

function equip(game, key, up = false, index = 0) {
  const original = game.makeCard(key,up);
  game.deck.push(original);
  game.battle.draw.push(original);
  game.fill(index);
  return game.battle.hand[index];
}

function dice(game, ...values) {
  game.battle.dice = [];
  return values.map(value => game.addDie(value));
}

function victory(game) {
  const battle = game.battle;
  for (const foe of battle.enemies) { foe.hp = 1; foe.block = 0; }
  equip(game,'whirlwind');
  const [die] = dice(game,6);
  assert.equal(game.placeDie(die.id,0,0),true);
  assert.equal(game.play(0),true);
}

test('draft has ten distinct cards and deals six slots only after three selections', () => {
  const game = run();
  assert.equal(new Set(game.draft).size,10);
  assert.equal(game.draft.filter(key => cards[key].rarity === 'common').length,7);
  assert.equal(game.draft.filter(key => cards[key].rarity === 'uncommon').length,3);
  assert.equal(game.confirmDraft(),false);
  draft(game);
  assert.equal(game.deck.length,12);
  assert.equal(game.battle.hand.filter(Boolean).length,6);
  assert.equal(game.battle.dice.length,3);
  assert.equal(game.battle.rerolls,1);
});

test('face validation, removable matching dice, and replacement without end-turn discard', () => {
  for (const [rule, yes, no] of [['O',3,2],['E',4,3],['4+',4,3],['3-',3,4],['6',6,5]]) {
    assert.equal(accepts(rule,yes),true);
    assert.equal(accepts(rule,no),false);
  }
  const game = run();
  draft(game);
  const angry = equip(game,'angry',true);
  const [first, second, mismatch] = dice(game,2,2,3);
  assert.equal(game.placeDie(first.id,0,0),true);
  assert.equal(game.placeDie(mismatch.id,0,1),false);
  assert.equal(game.ready(angry),false);
  assert.equal(game.placeDie(second.id,0,1),true);
  assert.equal(game.returnDie(first.id),true);
  assert.equal(game.ready(angry),false);
  assert.equal(game.placeDie(first.id,0,0),true);
  assert.equal(game.play(0),true);
  assert.notEqual(game.battle.hand[0].id,angry.id);
  assert.equal(game.battle.dice.length,1);
  assert.equal(game.battle.exhaust[0].id,angry.id);
  const after = game.battle.hand.map(card => card.id);
  game.endTurn();
  assert.deepEqual(game.battle.hand.map(card => card.id),after);
  assert.equal(game.battle.strength,3);
  assert.equal(game.battle.weak,1);
});

test('countdown banks across turns, allows detaching and accounts for Chemical X', () => {
  const game = run();
  game.addRelic('chemical');
  draft(game);
  const boulder = equip(game,'boulder');
  const [die] = dice(game,4);
  game.placeDie(die.id,0,0);
  assert.equal(game.remaining(boulder),4);
  game.returnDie(die.id);
  assert.equal(game.remaining(boulder),10);
  game.placeDie(die.id,0,0);
  game.endTurn();
  assert.equal(boulder.charge,6);
  assert.equal(boulder.sockets[0].length,0);
  const [overflow] = dice(game,5);
  game.placeDie(overflow.id,0,0);
  assert.equal(game.ready(boulder),true);
  game.play(0);
  assert.equal(game.battle.dice.length,0);
  assert.equal(game.battle.enemies[0].weak,1);
  assert.equal(game.battle.enemies[0].vulnerable,1);
});

test('split preserves positive pip totals and reroll of a slotted die spends its use', () => {
  const game = run();
  draft(game);
  equip(game,'splitter',true);
  equip(game,'defend',false,1);
  const [one, five] = dice(game,1,5);
  assert.equal(game.placeDie(one.id,0,0),false);
  assert.equal(game.placeDie(five.id,0,0),true);
  game.play(0);
  assert.deepEqual(game.battle.dice.map(die => die.value),[1,2,3]);
  assert.equal(game.battle.rerolls,2);
  game.placeDie(one.id,1,0);
  game.battle.powers.calculus = 1;
  assert.ok(game.reroll(one.id));
  assert.equal(game.battle.rerolls,1);
  assert.equal(game.battle.tempStrength,1);
  assert.equal(game.battle.hand[1].sockets[0].length,0);
});

test('Reset holds turn resolution until the selected card discards and returns its dice', () => {
  const game = run();
  draft(game);
  equip(game,'reset');
  const victim = equip(game,'defend',false,1);
  const [cost, returned] = dice(game,2,3);
  game.placeDie(cost.id,0,0);
  game.placeDie(returned.id,1,0);
  game.play(0);
  assert.equal(game.endTurn(),false);
  assert.equal(game.confirmDiscard(),false);
  assert.equal(game.toggleDiscard(1),true);
  assert.equal(game.confirmDiscard(),true);
  assert.equal(game.battle.pending,null);
  assert.ok(game.battle.dice.includes(returned));
  assert.notEqual(game.battle.hand[1].id,victim.id);
});

test('shop refunds cancelled selection, freezes its offer and consumes one pick for two commons', () => {
  const game = run();
  game.room = 3;
  game.advance();
  game.shop.options = ['upgraded','common','upgrade'];
  game.takeWare('upgraded');
  const offer = game.choice.options;
  game.cancelChoice();
  assert.equal(game.shop.left,2);
  game.takeWare('upgraded');
  assert.equal(game.choice.options,offer);
  game.choose(offer[0]);
  assert.equal(game.deck.at(-1).up,true);
  assert.equal(game.shop.left,1);
  game.takeWare('common');
  game.choose(game.choice.options[0]);
  assert.equal(game.cancelChoice(),false);
  assert.equal(game.shop.left,1);
  game.choose(game.choice.options[0]);
  assert.equal(game.shop.left,0);
  assert.equal(game.takeWare('upgrade'),false);
});

test('standard combat rarity offsets change on generated offers, not on shop or event rolls', () => {
  const game = run();
  game.rng = () => 0;
  const first = game.reward('normal');
  assert.deepEqual(first.map(key => cards[key].rarity),['uncommon','uncommon','uncommon']);
  assert.equal(game.rareOffset,-2);
  game.reward('shop');
  game.reward('event');
  assert.equal(game.rareOffset,-2);
  const next = game.reward('normal');
  assert.equal(cards[next[0]].rarity,'rare');
  assert.equal(game.rareOffset,-3);
});

test('fixed act progresses through all nine rooms and honors scripted enemy moves', () => {
  const game = run('full-act');
  assert.equal(route.length,9);
  draft(game);
  assert.equal(game.battle.enemies[0].key,'sludge');
  assert.deepEqual(enemyIntent(game.battle.enemies[0]),{damage:4,weak:1});
  victory(game);
  game.takeReward(game.rewardCards[0]);
  assert.equal(game.battle.enemies[0].key,'gremlin');
  game.endTurn();
  assert.equal(enemyIntent(game.battle.enemies[0]).times,4);
  victory(game);
  game.takeReward();
  assert.equal(game.phase,'event');
  game.takeEvent(game.event.options[0][2]);
  if (game.phase === 'choice') game.choose(game.choice.options[0].id ?? game.choice.options[0]);
  assert.equal(game.phase,'shop');
  game.leaveShop();
  assert.deepEqual(game.battle.enemies.map(foe => foe.next),[0,1,2,3]);
  victory(game);
  game.takeReward();
  assert.equal(game.phase,'treasure');
  assert.equal(new Set(game.treasure).size,2);
  game.takeTreasure();
  assert.ok(game.relics.length >= 2);
  assert.equal(game.phase,'camp');
  game.camp(true);
  assert.equal(game.battle.enemies[0].maxHp,68);
  assert.equal(enemyIntent(game.battle.enemies[0]).block,6);
  victory(game);
  assert.equal(game.phase,'victory');
});

test('Spider Queen cycles Sap and can win the run', () => {
  const game = run();
  game.room = 7;
  game.advance();
  const queen = game.battle.enemies[0];
  for (let i = 0; i < 4; i++) game.endTurn();
  assert.equal(enemyIntent(queen).sap,1);
  game.endTurn();
  assert.equal(queen.strength,1);
  assert.equal(game.battle.strength,-1);
  assert.equal(game.battle.dexterity,-1);
  game.hp = 1;
  queen.next = 1;
  game.endTurn();
  assert.equal(game.phase,'defeat');
  assert.equal(game.hp,0);
});
