import {Game, accepts, countdownTarget, enemyIntent, seededRandom, slotRules} from '../game.mjs';

const priorities = {
  whirlwind:22,jab:17,uppercut:14,hammer:12,balanced:12,quick:11,sand:10,
  splitter:7,dash:6,increment:5,lucky:5,rapid:5,boulder:4,immolate:4,
  angry:17,calculus:8,shields:8,impervious:8,reset:2,
};

function preferred(keys) {
  return [...keys].sort((a,b) => priorities[b] - priorities[a])[0];
}

function plansFor(game, card, index) {
  if (!card) return [];
  const {battle} = game;
  const dice = battle.dice;
  const rules = slotRules(card);
  const goal = countdownTarget(card);
  if (goal) {
    const left = game.remaining(card);
    const chosen = [...dice].sort((a,b) => b.value - a.value);
    let remaining = left;
    const slots = [];
    for (const die of chosen) {
      if (remaining <= 0) break;
      slots.push([die,0]);
      remaining -= game.chargeOf(die);
    }
    return slots.length || left === 0 ? [{index,card,slots,partial:remaining > 0}] : [];
  }
  const result = [];
  function search(slot, assigned) {
    if (slot === rules.length) { result.push({index,card,slots:assigned}); return; }
    for (const die of dice) {
      if (assigned.some(([used]) => used === die) || !accepts(rules[slot],die.value)) continue;
      if (rules[slot] === '**' && assigned.length && assigned[0][0].value !== die.value) continue;
      search(slot + 1,[...assigned,[die,slot]]);
    }
  }
  search(0,[]);
  return result;
}

function rate(game, plan) {
  const {battle} = game;
  const {card,slots,partial} = plan;
  const face = slots[0]?.[0].value ?? 0;
  const up = Number(card.up);
  const enemies = battle.enemies.filter(foe => foe.hp > 0);
  const target = enemies.find(foe => foe.id === battle.target);
  const incoming = enemies.reduce((sum,foe) => {
    const move = enemyIntent(foe);
    return sum + (move.damage ?? 0) * (move.times ?? 1);
  },0);
  const strength = battle.strength + battle.tempStrength;
  const hit = (base,times = 1,all = false) => (all ? enemies : [target]).reduce((sum,foe) => {
    const damage = Math.max(0,Math.floor((base + strength) * (battle.weak ? .75 : 1) *
      (foe.vulnerable ? 1.5 : 1))) * times;
    const net = Math.max(0,damage - foe.block);
    return sum + Math.min(net,foe.hp) + (net >= foe.hp ? 8 : 0);
  },0);
  const shield = amount => Math.min(Math.max(0,amount + battle.dexterity),Math.max(0,incoming - battle.block)) * .78;
  if (partial) return 0.85;
  const values = {
    strike:() => hit(4+2*up), defend:() => shield(4+2*up), bash:() => hit(6+2*up)+2,
    splitter:() => 5.5+face/4, hammer:() => hit(12+6*up), sand:() => 4.8+shield(2+2*up),
    balanced:() => hit(3+2*up)+shield(3+2*up), lucky:() => 4.1, uppercut:() => hit(1,3+up),
    jab:() => hit(3+2*up)+Math.min(7,2.6*(battle.dice.length-1)), quick:() => hit(5)+1,
    dash:() => shield(5)+.8, immolate:() => hit(5+2*up,1,true)-1.5, increment:() => 1.7+(face>=4 ? 1 : 0),
    whirlwind:() => hit(3,face+up,true), reset:() => 4.1, rapid:() => hit(2+up,5),
    boulder:() => hit(8+4*up)+2, angry:() => 9, shields:() => 2.5,
    impervious:() => shield(30+10*up), calculus:() => 5,
  };
  return values[card.key]() / Math.max(1,slots.length) - face*.024;
}

export function playthrough(seed) {
  const game = new Game(seededRandom(seed));
  const actions = [];
  function click(action,value = '') { actions.push({action,value:String(value)}); }
  for (const key of [...game.draft].sort((a,b) => priorities[b] - priorities[a]).slice(0,3)) {
    game.selectDraft(key);
    click('draft',key);
  }
  game.confirmDraft();
  click('confirm-draft');
  for (let step = 0; step < 1200; step++) {
    if (game.phase === 'victory' || game.phase === 'defeat') return {game,actions};
    if (game.phase === 'battle') {
      const {battle} = game;
      if (battle.pending) {
        const chosen = battle.pending.candidates.find(i => battle.hand[i]?.key === 'defend') ?? battle.pending.candidates[0];
        game.toggleDiscard(chosen);
        click('discard',chosen);
        game.confirmDiscard();
        click('confirm-discard');
        continue;
      }
      const bestTarget = battle.enemies.filter(foe => foe.hp > 0).sort((a,b) =>
        a.hp + a.block - a.vulnerable * 2 - (enemyIntent(a).damage ?? 0) -
        b.hp - b.block + b.vulnerable * 2 + (enemyIntent(b).damage ?? 0))[0];
      if (bestTarget.id !== battle.target) {
        game.targetEnemy(bestTarget.id);
        click('target',bestTarget.id);
      }
      const ranked = battle.hand.flatMap((card,index) => plansFor(game,card,index))
        .map(plan => ({plan,score:rate(game,plan)})).sort((a,b) => b.score - a.score);
      const best = ranked[0];
      if ((!best || best.score < 1.8) && battle.dice.length && battle.rerolls) {
        const id = battle.dice[0].id;
        game.reroll(id);
        click('die',id);
        click('reroll');
        continue;
      }
      if (best?.score > 0.45) {
        const {slots,index,partial} = best.plan;
        for (const [die,slot] of slots) {
          if (!game.placeDie(die.id,index,slot)) throw new Error('Pilot attempted an invalid placement');
          click('die',die.id);
          click('slot',index + ',' + slot);
        }
        if (!partial) {
          if (!game.play(index)) throw new Error('Pilot attempted an invalid cast');
          click('play',index);
        }
        continue;
      }
      game.endTurn();
      click('end-turn');
    } else if (game.phase === 'reward') {
      const key = preferred(game.rewardCards);
      game.takeReward(key);
      click('reward',key);
    } else if (game.phase === 'event') {
      const key = game.event.options[0][2];
      game.takeEvent(key);
      click('event',key);
    } else if (game.phase === 'shop') {
      const available = ['upgraded','uncommon','remove','upgrade','common','double','transform']
        .find(key => game.shop.options.includes(key) && game.canShop(key));
      if (available) {
        game.takeWare(available);
        click('shop',available);
      } else {
        game.leaveShop();
        click('leave-shop');
      }
    } else if (game.phase === 'choice') {
      const {mode,options} = game.choice;
      const target = mode === 'new' ? preferred(options) : mode === 'relic' ? options[0] :
        (options.find(card => card.key === (mode === 'upgrade' ? 'strike' : 'defend')) || options[0]).id;
      game.choose(target);
      click(typeof target === 'number' ? 'choose-id' : 'choose-key',target);
    } else if (game.phase === 'treasure') {
      game.takeTreasure();
      click('treasure');
    } else if (game.phase === 'camp') {
      game.camp(true);
      click('camp','rest');
    }
  }
  throw new Error('Pilot did not finish the act');
}
