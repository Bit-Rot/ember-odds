import {cards, events, foes, pool, relics, route, wares} from './content.mjs';

const STARTERS = ['strike','strike','strike','strike','defend','defend','defend','defend','bash'];
const TABLES = {normal:[3,37], elite:[10,40], shop:[9,37], event:[3,34]};
const d6 = rng => Math.floor(rng() * 6) + 1;
const scaled = (base, strength, weak, vulnerable = 0) =>
  Math.floor(Math.max(0, base + strength) * (weak ? 0.75 : 1) * (vulnerable ? 1.5 : 1));

export function seededRandom(seed) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.codePointAt(0), 16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; --i) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function slotRules(instance) {
  const spec = cards[instance.key];
  return (instance.up ? spec.upgradedSlots : spec.slots).flatMap(rule =>
    rule === '**' || rule === '***' ? Array(rule.length).fill(rule) : [rule]);
}

export function accepts(rule, value) {
  if (rule === '*' || rule.startsWith('*') || rule.startsWith('(')) return true;
  if (rule === 'O') return value % 2 === 1;
  if (rule === 'E') return value % 2 === 0;
  if (rule.endsWith('+')) return value >= Number(rule.slice(0, -1));
  if (rule.endsWith('-')) return value <= Number(rule.slice(0, -1));
  return value === Number(rule);
}

export function countdownTarget(instance) {
  const rule = slotRules(instance)[0];
  return rule.startsWith('(') ? Number(rule.slice(1, -1)) : 0;
}

export function enemyIntent(enemy) {
  const move = foes[enemy.key].moves[enemy.next];
  return {
    ...move,
    damage: move.damage === undefined ? undefined : scaled(move.damage, enemy.strength, enemy.weak),
  };
}

export class Game {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.id = 0;
    this.room = 0;
    this.maxHp = 48;
    this.hp = this.maxHp;
    this.rareOffset = -5;
    this.deck = STARTERS.map(key => this.makeCard(key));
    this.relics = [];
    this.draft = [...this.sample(pool.common, 7), ...this.sample(pool.uncommon, 3)];
    this.selected = new Set();
    this.phase = 'draft';
  }

  makeCard(key, up = false) { return {id: ++this.id, key, up}; }
  sample(items, count) { return shuffled(items, this.rng).slice(0, count); }
  has(relic) { return this.relics.includes(relic); }

  reward(source, forced = null) {
    const options = [];
    for (let i = 0; i < 3; i++) {
      let rarity = forced;
      if (!rarity) {
        const [rare, uncommon] = TABLES[source];
        const offset = source === 'event' ? 0 : this.rareOffset;
        const roll = this.rng() * 100;
        rarity = roll < rare + offset ? 'rare' : roll < rare + offset + uncommon ? 'uncommon' : 'common';
        if (source === 'normal' || source === 'elite') {
          this.rareOffset = rarity === 'rare' ? -5 : Math.min(40, this.rareOffset + 1);
        }
      }
      const remaining = pool[rarity].filter(key => !options.includes(key));
      options.push(this.sample(remaining, 1)[0]);
    }
    return options;
  }

  selectDraft(key) {
    if (this.phase !== 'draft' || !this.draft.includes(key)) return false;
    if (this.selected.delete(key)) return true;
    if (this.selected.size >= 3) return false;
    this.selected.add(key);
    return true;
  }

  confirmDraft() {
    if (this.phase !== 'draft' || this.selected.size !== 3) return false;
    this.deck.push(...[...this.selected].map(key => this.makeCard(key)));
    this.advance();
    return true;
  }

  advance() {
    this.room++;
    this.choice = null;
    this.battle = null;
    this.phase = route[this.room].kind;
    if (route[this.room].foe) return this.startBattle();
    if (this.phase === 'event') {
      this.event = this.sample(events.filter(event => this.eventAvailable(event)), 1)[0];
      this.eventOffers = new Map();
    }
    if (this.phase === 'shop') this.shop = {options:this.sample(Object.keys(wares), 5), used:[], left:2, offers:new Map()};
    if (this.phase === 'treasure') this.treasure = this.sample(Object.keys(relics).filter(key => !this.has(key)), 2);
  }

  startBattle() {
    const {foe, kind} = route[this.room];
    const spec = foes[foe];
    const enemies = Array.from({length: kind === 'elite' ? 4 : 1}, (_, i) => {
      const hp = spec.hp[0] + Math.floor(this.rng() * (spec.hp[1] - spec.hp[0] + 1));
      return {id:i, key:foe, hp, maxHp:hp, next:i, block:0, strength:0, weak:0, vulnerable:0};
    });
    this.phase = 'battle';
    this.battle = {
      enemies, target:0, turn:0, draw:shuffled(this.deck, this.rng), discard:[], exhaust:[],
      hand:Array(6).fill(null), dice:[], rerolls:0, block:0, weak:0, tempStrength:0,
      strength:Number(this.has('iron')), dexterity:Number(this.has('leather')), thorns:this.has('thorns') ? 3 : 0,
      powers:{angry:0, calculus:0, shields:false}, pending:null, line:'', hit:[], lost:0,
    };
    for (let i = 0; i < 6; i++) this.fill(i);
    this.startTurn();
  }

  fill(index) {
    const battle = this.battle;
    if (!battle.draw.length && battle.discard.length) {
      battle.draw = shuffled(battle.discard, this.rng);
      battle.discard = [];
    }
    const instance = battle.draw.pop();
    battle.hand[index] = instance ? {
      ...instance, charge:0, sockets:slotRules(instance).map(() => []),
    } : null;
  }

  addDie(value = d6(this.rng)) {
    const die = {id:++this.id, value};
    this.battle.dice.push(die);
    return die;
  }

  startTurn() {
    const battle = this.battle;
    battle.turn++;
    if (!battle.powers.shields) battle.block = 0;
    battle.strength += battle.powers.angry;
    battle.tempStrength = 0;
    const third = battle.turn % 3 === 0;
    battle.rerolls = 1 + Number(third && this.has('cycle'));
    battle.dice = [];
    for (let i = 0; i < 3 + Number(third && this.has('dice')); i++) this.addDie();
    if (this.has('spark')) {
      for (const enemy of battle.enemies) this.damageEnemy(enemy, 3);
      this.clearBattleIfDone();
    }
  }

  targetEnemy(id) {
    if (this.phase !== 'battle' || !this.battle.enemies.find(e => e.id === id && e.hp > 0)) return false;
    this.battle.target = id;
    return true;
  }

  findDie(id) {
    const loose = this.battle.dice.find(die => die.id === id);
    if (loose) return {die:loose};
    for (const hand of this.battle.hand) {
      if (!hand) continue;
      for (const socket of hand.sockets) {
        const die = socket.find(entry => entry.id === id);
        if (die) return {die, socket};
      }
    }
    return null;
  }

  chargeOf(die) { return die.value + (this.has('chemical') ? 2 : 0); }

  remaining(hand) {
    return Math.max(0, countdownTarget(hand) - hand.charge -
      hand.sockets[0].reduce((sum, die) => sum + this.chargeOf(die), 0));
  }

  canPlace(id, index, socketIndex) {
    if (this.phase !== 'battle' || this.battle.pending) return false;
    const hand = this.battle.hand[index];
    const source = this.findDie(id);
    if (!hand || !source || !hand.sockets[socketIndex]) return false;
    const destination = hand.sockets[socketIndex];
    if (source.socket === destination) return true;
    if (countdownTarget(hand)) return this.remaining(hand) > 0;
    if (destination.length) return false;
    const rule = slotRules(hand)[socketIndex];
    if (rule === '**' || rule === '***') {
      return hand.sockets.flat().every(die => die.id === id || die.value === source.die.value);
    }
    return accepts(rule, source.die.value);
  }

  detach(source) {
    const list = source.socket ?? this.battle.dice;
    list.splice(list.indexOf(source.die), 1);
  }

  placeDie(id, index, socketIndex) {
    if (!this.canPlace(id, index, socketIndex)) return false;
    const source = this.findDie(id);
    const destination = this.battle.hand[index].sockets[socketIndex];
    if (source.socket === destination) return true;
    this.detach(source);
    destination.push(source.die);
    return true;
  }

  returnDie(id) {
    if (this.phase !== 'battle' || this.battle.pending) return false;
    const source = this.findDie(id);
    if (!source?.socket) return false;
    this.detach(source);
    this.battle.dice.push(source.die);
    return true;
  }

  reroll(id) {
    const battle = this.battle;
    if (this.phase !== 'battle' || battle.pending || battle.rerolls <= 0) return false;
    const source = this.findDie(id);
    if (!source) return false;
    this.detach(source);
    battle.rerolls--;
    battle.tempStrength += battle.powers.calculus;
    return this.addDie();
  }

  ready(hand) {
    if (!hand) return false;
    return countdownTarget(hand) ? this.remaining(hand) === 0 : hand.sockets.every(socket => socket.length > 0);
  }

  damageEnemy(enemy, damage) {
    if (!enemy || enemy.hp <= 0) return;
    const block = Math.min(enemy.block, damage);
    enemy.block -= block;
    enemy.hp = Math.max(0, enemy.hp - (damage - block));
    if (!this.battle.hit.includes(enemy.id)) this.battle.hit.push(enemy.id);
  }

  hit(base, times = 1, all = false) {
    const battle = this.battle;
    for (const enemy of battle.enemies) {
      if (!all && enemy.id !== battle.target) continue;
      const damage = scaled(base, battle.strength + battle.tempStrength, battle.weak, enemy.vulnerable);
      for (let i = 0; i < times && enemy.hp > 0; i++) this.damageEnemy(enemy, damage);
    }
  }

  block(base) { this.battle.block += Math.max(0, base + this.battle.dexterity); }

  play(index) {
    if (this.phase !== 'battle' || this.battle.pending) return false;
    const battle = this.battle;
    const hand = battle.hand[index];
    if (!this.ready(hand)) return false;
    const target = battle.enemies.find(enemy => enemy.id === battle.target && enemy.hp > 0);
    const value = hand.sockets[0][0]?.value;
    const up = Number(hand.up);
    battle.hit = [];
    battle.lost = 0;
    battle.line = cards[hand.key].name;
    const recycled = [];
    if (cards[hand.key].type === 'power' || hand.key === 'impervious') battle.exhaust.push(hand);
    else recycled.push(this.deck.find(card => card.id === hand.id));
    this.fill(index);
    battle.discard.push(...recycled);
    if (!battle.hand[index]) this.fill(index);

    switch (hand.key) {
      case 'strike': this.hit(4 + 2 * up); break;
      case 'defend': this.block(4 + 2 * up); break;
      case 'bash': this.hit(6 + 2 * up); target.vulnerable += 2 + up; break;
      case 'splitter':
        this.addDie(Math.floor(value / 2));
        this.addDie(Math.ceil(value / 2));
        battle.rerolls += up;
        break;
      case 'hammer': this.hit(12 + 6 * up); break;
      case 'sand': this.block(2 + 2 * up); this.addDie(); break;
      case 'balanced': this.hit(3 + 2 * up); this.block(3 + 2 * up); break;
      case 'lucky': this.addDie(); battle.rerolls += up; break;
      case 'uppercut': this.hit(1, 3 + up); break;
      case 'jab': this.hit(3 + 2 * up); battle.tempStrength += 2 + up; break;
      case 'quick': this.hit(5); battle.rerolls += 1 + up; break;
      case 'dash': this.block(5); battle.rerolls += 1 + up; break;
      case 'immolate': this.hp--; battle.lost = 1; this.hit(5 + 2 * up, 1, true); break;
      case 'increment': this.addDie(value + 1); break;
      case 'whirlwind': this.hit(3, value + up, true); break;
      case 'reset': {
        const candidates = battle.hand.map((card, i) => card && i !== index ? i : -1).filter(i => i >= 0);
        if (candidates.length) battle.pending = {candidates, selected:new Set(), min:up ? 0 : 1, max:1 + up};
        else this.addDie();
        break;
      }
      case 'rapid': this.hit(2 + up, 5); break;
      case 'boulder': this.hit(8 + 4 * up); target.weak++; target.vulnerable++; break;
      case 'angry': battle.powers.angry += 2 + up; break;
      case 'shields': battle.powers.shields = true; break;
      case 'impervious': this.block(30 + 10 * up); break;
      case 'calculus': battle.powers.calculus += 1 + up; break;
    }
    this.clearBattleIfDone();
    return true;
  }

  toggleDiscard(index) {
    const discard = this.battle?.pending;
    if (!discard?.candidates.includes(index)) return false;
    if (discard.selected.delete(index)) return true;
    if (discard.selected.size >= discard.max) {
      if (discard.max !== 1) return false;
      discard.selected.clear();
    }
    discard.selected.add(index);
    return true;
  }

  confirmDiscard() {
    const battle = this.battle;
    const pending = battle?.pending;
    if (!pending || pending.selected.size < pending.min) return false;
    const discarded = [];
    for (const index of pending.selected) {
      const hand = battle.hand[index];
      battle.dice.push(...hand.sockets.flat());
      discarded.push(this.deck.find(card => card.id === hand.id));
      this.fill(index);
    }
    battle.discard.push(...discarded);
    for (const index of pending.selected) if (!battle.hand[index]) this.fill(index);
    battle.pending = null;
    this.addDie();
    return true;
  }

  endTurn() {
    const battle = this.battle;
    if (this.phase !== 'battle' || battle.pending) return false;
    battle.hit = [];
    battle.lost = 0;
    for (const hand of battle.hand) {
      if (!hand) continue;
      if (countdownTarget(hand)) hand.charge = countdownTarget(hand) - this.remaining(hand);
      hand.sockets.forEach(socket => { socket.length = 0; });
    }
    battle.weak = Math.max(0, battle.weak - 1);
    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0 || this.hp <= 0) continue;
      const move = enemyIntent(enemy);
      enemy.block = 0;
      if (move.damage !== undefined) {
        for (let i = 0; i < (move.times ?? 1) && this.hp > 0 && enemy.hp > 0; i++) {
          const blocked = Math.min(battle.block, move.damage);
          battle.block -= blocked;
          this.hp -= move.damage - blocked;
          battle.lost += move.damage - blocked;
          if (battle.thorns) this.damageEnemy(enemy, battle.thorns);
        }
      }
      if (enemy.hp > 0) {
        battle.weak += move.weak ?? 0;
        enemy.block += move.block ?? 0;
        enemy.strength += move.strength ?? 0;
        battle.strength -= move.sap ?? 0;
        battle.dexterity -= move.sap ?? 0;
      }
      enemy.weak = Math.max(0, enemy.weak - 1);
      enemy.vulnerable = Math.max(0, enemy.vulnerable - 1);
      enemy.next = (enemy.next + 1) % foes[enemy.key].moves.length;
    }
    battle.line = battle.lost > 0 ? 'Lost ' + battle.lost + ' HP' : 'Turn complete';
    if (!this.clearBattleIfDone()) this.startTurn();
    return true;
  }

  clearBattleIfDone() {
    const battle = this.battle;
    if (this.hp <= 0) {
      this.hp = 0;
      this.phase = 'defeat';
      return true;
    }
    const living = battle.enemies.filter(enemy => enemy.hp > 0);
    if (living.length) {
      if (!living.some(enemy => enemy.id === battle.target)) battle.target = living[0].id;
      return false;
    }
    if (route[this.room].kind === 'boss') this.phase = 'victory';
    else {
      this.phase = 'reward';
      this.rewardCards = this.reward(route[this.room].kind === 'elite' ? 'elite' : 'normal');
    }
    return true;
  }

  takeReward(key = null) {
    if (this.phase !== 'reward' || (key && !this.rewardCards.includes(key))) return false;
    if (key) this.deck.push(this.makeCard(key));
    this.advance();
    return true;
  }

  eventAvailable(event) {
    return event.options.every(([, , action]) => this.canEvent(action));
  }

  canEvent(action) {
    const threshold = {'event-uncommon':6, 'event-double':3, 'event-relic':5}[action];
    if (threshold && this.hp <= threshold) return false;
    if (action === 'event-upgrade' || action === 'event-double') return this.deck.some(card => !card.up);
    if (action === 'event-remove') return this.deck.length > 6;
    return true;
  }

  takeEvent(action) {
    if (this.phase !== 'event' || !this.canEvent(action) || !this.event.options.some(option => option[2] === action)) return false;
    const heal = {heal:12, 'small-heal':7, 'vent-heal':8}[action];
    if (heal) this.heal(heal);
    switch (action) {
      case 'event-uncommon': this.openChoice('event','new','uncommon',true,6); return true;
      case 'event-common': this.openChoice('event','new','common'); return true;
      case 'event-reward': this.openChoice('event','new'); return true;
      case 'event-transform': this.openChoice('event','transform'); return true;
      case 'event-upgrade': this.openChoice('event','upgrade'); return true;
      case 'event-remove': this.openChoice('event','remove'); return true;
      case 'event-relic': this.openChoice('event','relic',null,false,5); return true;
      case 'event-double': this.hp -= 3; this.randomUpgrades(2); break;
    }
    this.advance();
    return true;
  }

  openChoice(origin, mode, rarity = null, up = false, cost = 0, ware = null) {
    let options;
    if (mode === 'new' || mode === 'relic') {
      const cacheKey = mode + ':' + rarity;
      const cache = origin === 'event' ? this.eventOffers : null;
      options = cache?.get(cacheKey);
      if (!options) {
        options = mode === 'new' ? this.reward(origin, rarity) :
          this.sample(Object.keys(relics).filter(key => !this.has(key)), 3);
        cache?.set(cacheKey, options);
      }
    } else options = this.deck.filter(card => mode !== 'upgrade' || !card.up);
    this.choice = {origin, mode, options, up, cost, ware};
    this.phase = 'choice';
  }

  choose(value) {
    const choice = this.choice;
    if (this.phase !== 'choice' || !choice) return false;
    const {mode, options, origin, up, cost, ware} = choice;
    if (mode === 'new' || mode === 'relic') {
      if (!options.includes(value)) return false;
      if (mode === 'new') this.deck.push(this.makeCard(value, up));
      else this.addRelic(value);
    } else {
      const chosen = options.find(card => card.id === value);
      if (!chosen) return false;
      const index = this.deck.indexOf(chosen);
      if (mode === 'upgrade') chosen.up = true;
      if (mode === 'remove') this.deck.splice(index, 1);
      if (mode === 'transform') {
        const different = Object.values(pool).flat().filter(key => key !== chosen.key);
        this.deck[index] = this.makeCard(this.sample(different, 1)[0]);
      }
    }
    this.hp -= cost;
    if (ware === 'common' && !choice.second) {
      this.openChoice('shop', 'new', 'common', false, 0, ware);
      this.choice.second = true;
      return true;
    }
    if (origin === 'shop') this.finishWare(ware);
    else this.advance();
    return true;
  }

  cancelChoice() {
    if (this.phase !== 'choice' || this.choice.second) return false;
    this.phase = this.choice.origin;
    this.choice = null;
    return true;
  }

  canShop(key) {
    if (this.shop.left <= 0 || this.shop.used.includes(key)) return false;
    if (key === 'remove') return this.deck.length > 6;
    if (key === 'upgrade' || key === 'double') return this.deck.some(card => !card.up);
    return true;
  }

  takeWare(key) {
    if (this.phase !== 'shop' || !this.shop.options.includes(key) || !this.canShop(key)) return false;
    if (key === 'double') {
      this.randomUpgrades(2);
      this.finishWare(key);
      return true;
    }
    switch (key) {
      case 'upgrade': case 'remove': case 'transform':
        this.openChoice('shop',key,null,false,0,key);
        break;
      case 'upgraded': case 'uncommon': case 'common': {
        const rarity = key === 'upgraded' ? null : key;
        const cached = this.shop.offers.get(key);
        if (cached) {
          this.choice = cached;
          this.phase = 'choice';
        } else {
          this.openChoice('shop','new',rarity,key === 'upgraded',0,key);
          this.shop.offers.set(key,this.choice);
        }
        break;
      }
    }
    return true;
  }

  finishWare(key) {
    this.shop.used.push(key);
    this.shop.left--;
    this.phase = 'shop';
    this.choice = null;
  }

  leaveShop() {
    if (this.phase !== 'shop') return false;
    this.advance();
    return true;
  }

  randomUpgrades(count) {
    for (const card of this.sample(this.deck.filter(card => !card.up), count)) card.up = true;
  }

  addRelic(key) {
    if (this.has(key)) return;
    this.relics.push(key);
    if (key === 'heart') {
      this.maxHp += 10;
      this.hp += 10;
    }
  }

  takeTreasure() {
    if (this.phase !== 'treasure') return false;
    for (const key of this.treasure) this.addRelic(key);
    this.advance();
    return true;
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  restAmount() { return Math.floor(this.maxHp * 0.3); }

  camp(rest) {
    if (this.phase !== 'camp') return false;
    if (rest) {
      this.heal(this.restAmount());
      this.advance();
    } else {
      if (!this.deck.some(card => !card.up)) return false;
      this.openChoice('camp','upgrade');
    }
    return true;
  }
}
