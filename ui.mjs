import {cards, relics, route, wares} from './content.mjs';
import {Game, countdownTarget, enemyIntent, seededRandom, slotRules} from './game.mjs';
import {icon} from './icons.mjs';

const seed = new URLSearchParams(location.search).get('seed');
const newGame = () => new Game(seed ? seededRandom(seed) : Math.random);
let game = newGame();
let selectedDie = null;
let drag = null;
let suppressClick = false;

const hud = document.querySelector('#hud');
const trail = document.querySelector('#trail');
const room = document.querySelector('#room');
const inspect = document.querySelector('#inspect');
const say = message => { document.querySelector('#announcer').textContent = message; };
const disabled = condition => condition ? ' disabled' : '';

function button(label, action, value = '', classes = 'button', locked = false, glyph = '', accessible = '') {
  return '<button type="button" class="' + classes + '" data-action="' + action +
    '" data-value="' + value + '"' + disabled(locked) + (accessible ? ' aria-label="' + accessible + '"' : '') +
    '>' + (glyph ? icon(glyph) : '') + label + '</button>';
}

function renderHud() {
  hud.innerHTML = '<div class="identity"><span class="brand-mark">' + icon('flame') +
    '</span><span>Ember Odds</span></div><div class="hud-stats">' +
    '<span class="health" title="Health">' + icon('heart') + '<b>' + game.hp + '</b><span> / ' + game.maxHp +
    '</span></span>' + button('<span class="hud-label">Deck</span><b>' + game.deck.length + '</b>', 'inspect','deck','hud-button',false,'deck','Deck, ' + game.deck.length + ' cards') +
    button('<span class="hud-label">Relics</span><b>' + game.relics.length + '</b>', 'inspect','relic','hud-button',false,'relic','Relics, ' + game.relics.length) + '</div>';
  trail.innerHTML = '<span class="act-label">Act I</span>' + route.map((step, i) => {
    const state = i < game.room ? 'past' : i === game.room ? 'current' : 'future';
    return '<span class="trail-step ' + state + '" title="' + step.name + '"' +
      (state === 'current' ? ' aria-current="step"' : '') + '>' + icon(step.icon) +
      '<span class="trail-name">' + step.name + '</span></span>';
  }).join('');
}

const pips = {1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9]};

function dieFace(die, slotted = false) {
  const face = pips[die.value].map(pip => '<i style="grid-area:' + Math.ceil(pip / 3) +
    ' / ' + ((pip - 1) % 3 + 1) + '"></i>').join('');
  return '<button type="button" class="die' + (slotted ? ' slotted' : '') +
    (die.id === selectedDie ? ' selected' : '') + '" data-die="' + die.id + '" aria-label="Die ' + die.value +
    (slotted ? ', in a slot' : '') + '" aria-pressed="' + (die.id === selectedDie) + '">' + face + '</button>';
}

function slotDisplay(rule) {
  if (rule === '*') return '✧';
  if (rule === '**' || rule === '***') return '≋';
  if (rule === '3-' || rule === '4-' || rule === '5-') return '≤' + rule[0];
  if (rule.endsWith('+')) return '≥' + rule[0];
  return rule;
}

function slotLabel(rule) {
  if (rule === '*') return 'Any die';
  if (rule === '**' || rule === '***') return 'Matching die';
  if (rule === 'E') return 'Even die';
  if (rule === 'O') return 'Odd die';
  if (rule.endsWith('+')) return rule[0] + ' or higher';
  if (rule.endsWith('-')) return rule[0] + ' or lower';
  if (rule.startsWith('(')) return 'Countdown ' + rule.slice(1, -1);
  return 'Die ' + rule;
}

function cardContents(instance) {
  const spec = cards[instance.key];
  return '<div class="card-name">' + spec.name + (instance.up ? '<sup>+</sup>' : '') + '</div>' +
    '<div class="card-art">' + icon(spec.icon) + '</div>' +
    '<div class="card-text">' + (instance.up ? spec.upgraded : spec.text) + '</div>';
}

function cardClasses(instance) {
  const spec = cards[instance.key];
  return 'card ' + spec.rarity + ' ' + spec.type + (instance.up ? ' upgraded' : '');
}

function cardOption(instance, action, value, active = false, locked = false) {
  return '<button type="button" class="' + cardClasses(instance) + ' card-option' +
    (active ? ' picked' : '') + '" data-action="' + action + '" data-value="' + value + '"' +
    disabled(locked) + (action === 'draft' ? ' aria-pressed="' + active + '"' : '') + '>' + cardContents(instance) +
    '<span class="preview-slots">' + slotRules(instance).map(rule => '<span title="' + slotLabel(rule) + '">' +
      slotDisplay(rule) + '</span>').join('') + (active ? icon('check','picked-mark') : '') + '</span></button>';
}

function combatCard(hand, index) {
  if (!hand) return '<div class="empty-card" aria-label="Empty card slot"></div>';
  const ready = game.ready(hand);
  const countdown = countdownTarget(hand);
  const pending = game.battle.pending;
  const discardable = pending?.candidates.includes(index);
  const picked = pending?.selected.has(index);
  const sockets = slotRules(hand).map((rule, i) => {
    const dice = hand.sockets[i];
    const available = selectedDie !== null && game.canPlace(selectedDie,index,i);
    const label = countdown ? game.remaining(hand) : slotDisplay(rule);
    return '<div class="socket' + (countdown ? ' countdown' : '') + (available ? ' available' : '') +
      '" data-drop="card" data-index="' + index + '" data-socket="' + i + '">' +
      '<button type="button" class="slot-button" data-action="slot" data-value="' + index + ',' + i +
      '" title="' + slotLabel(rule) + '" aria-label="' + slotLabel(rule) +
      (countdown ? ', ' + label + ' remaining' : '') + '">' +
      (countdown ? '<span>' + label + '</span>' : label) + '</button>' +
      (dice.length ? '<span class="socket-dice">' + dice.map(die => dieFace(die, true)).join('') + '</span>' : '') + '</div>';
  }).join('');
  return '<article class="' + cardClasses(hand) + (ready ? ' ready' : '') + (picked ? ' picked' : '') +
    '" data-hand="' + index + '"><button class="card-cast" data-action="' + (pending ? 'discard' : 'play') +
    '" data-value="' + index + '"' + disabled(pending ? !discardable : !ready) +
    (pending ? ' aria-pressed="' + !!picked + '"' : '') + ' aria-label="' +
    (pending ? 'Discard ' : ready ? 'Cast ' : '') + cards[hand.key].name + '">' +
    cardContents(hand) + (ready && !pending ? '<span class="cast-indicator">Cast</span>' : '') + '</button><div class="combat-slots">' + sockets +
    '</div></article>';
}

function stat(label, value, glyph, color = '') {
  return '<span class="stat ' + color + '" title="' + label + '" aria-label="' + label + ' ' + value +
    '">' + icon(glyph) + '<b>' + value + '</b></span>';
}

function intents(enemy) {
  const move = enemyIntent(enemy);
  const attack = move.damage !== undefined ?
    stat('Attack', move.damage + (move.times ? ' × ' + move.times : ''), 'blade','harm') : '';
  return attack + (move.block ? stat('Block',move.block,'shield','ward') : '') +
    (move.strength ? stat('Gain Strength',move.strength,'fist','buff') : '') +
    (move.weak ? stat('Apply Weak',move.weak,'wind','hex') : '') +
    (move.sap ? stat('Sap Strength and Dexterity',move.sap,'sap','hex') : '');
}

function healthBar(hp, max, label) {
  return '<div class="unit-health" role="meter" aria-label="' + label +
    ' health" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + hp +
    '"><div class="health-fill" style="width:' + Math.round(100 * hp / max) + '%"></div>' +
    '<span>' + hp + ' / ' + max + '</span></div>';
}

function enemyUnit(enemy, animate) {
  const battle = game.battle;
  const dead = enemy.hp <= 0;
  const targeted = battle.target === enemy.id;
  return '<button class="unit enemy ' + enemy.key + (targeted ? ' targeted' : '') + (dead ? ' fallen' : '') +
    (animate && battle.hit.includes(enemy.id) ? ' hit' : '') + '" data-action="target" data-value="' + enemy.id +
    '" aria-label="Target ' + (battle.enemies.length > 1 ? 'Serpent ' + (enemy.id + 1) : route[game.room].name) +
    '" aria-pressed="' + targeted + '"' + disabled(dead) + '><span class="intent">' + (dead ? '' : intents(enemy)) + '</span>' +
    '<span class="sprite"><img alt="" src="./assets/' + enemy.key + '.webp" draggable="false"></span>' +
    '<span class="unit-name">' + (enemy.key === 'serpent' ? 'Serpent ' + (enemy.id + 1) : route[game.room].name) + '</span>' +
    healthBar(enemy.hp,enemy.maxHp,'Enemy') + '<span class="unit-stats">' +
    (enemy.block ? stat('Block',enemy.block,'shield','ward') : '') +
    (enemy.strength ? stat('Strength',enemy.strength,'fist','buff') : '') +
    (enemy.weak ? stat('Weak',enemy.weak,'wind','hex') : '') +
    (enemy.vulnerable ? stat('Vulnerable',enemy.vulnerable,'sap','hex') : '') + '</span></button>';
}

function playerUnit(animate) {
  const battle = game.battle;
  return '<div class="unit player' + (animate && battle.lost ? ' hit' : '') +
    '"><span class="intent"></span><span class="sprite"><img alt="Ember Knight" src="./assets/knight.webp" draggable="false"></span>' +
    '<span class="unit-name">Ember Knight</span>' + healthBar(game.hp,game.maxHp,'Player') +
    '<span class="unit-stats">' + (battle.block ? stat('Block',battle.block,'shield','ward') : '') +
    (battle.strength + battle.tempStrength ? stat('Strength',battle.strength + battle.tempStrength,'fist','buff') : '') +
    (battle.dexterity ? stat('Dexterity',battle.dexterity,'wind','buff') : '') +
    (battle.weak ? stat('Weak',battle.weak,'wind','hex') : '') +
    (battle.thorns ? stat('Thorns',battle.thorns,'blade','buff') : '') +
    (battle.powers.angry ? stat('So Angry',battle.powers.angry,'flame','buff') : '') +
    (battle.powers.shields ? stat('Shields Up','', 'shield','buff') : '') +
    (battle.powers.calculus ? stat('Calculus',battle.powers.calculus,'die','buff') : '') + '</span></div>';
}

function combatView(animate) {
  const battle = game.battle;
  const pending = battle.pending;
  const reroll = '<button class="reroll' + (selectedDie !== null && battle.rerolls ? ' available' : '') +
    '" data-action="reroll" data-value="" data-drop="reroll" title="Reroll" aria-label="Reroll, ' + battle.rerolls +
    ' remaining"' + disabled(!battle.rerolls || !!pending) + '>' + icon('reroll') + '<b>' + battle.rerolls + '</b></button>';
  const dice = '<div class="dice-tray" data-drop="pool" aria-label="Dice pool">' +
    (battle.dice.length ? battle.dice.map(die => dieFace(die)).join('') : '<span class="dice-empty">• • •</span>') + '</div>';
  return '<section class="combat"><div class="arena' + (battle.enemies.length > 1 ? ' elite' : '') + '">' +
    '<div class="turn-label" tabindex="-1">Turn ' + battle.turn + '</div><div class="units">' + playerUnit(animate) +
    '<div class="enemies">' + battle.enemies.map(enemy => enemyUnit(enemy, animate)).join('') + '</div></div>' +
    '</div><div class="table"><div class="table-top"><div class="piles">' +
    stat('Draw pile',battle.draw.length,'deck') + stat('Discard pile',battle.discard.length,'discard') +
    (battle.exhaust.length ? stat('Exhaust and powers',battle.exhaust.length,'flame') : '') + '</div>' +
    '<div class="roll-zone">' + dice + reroll + '</div><div class="combat-actions">' +
    (pending ? button(pending.min ? 'Discard' : 'Discard ' + pending.selected.size, 'confirm-discard','','button primary',pending.selected.size < pending.min) :
      button('End turn','end-turn','','button primary')) + '</div></div>' +
    (pending ? '<div class="pending-note">' + (pending.min ? 'Choose a card to discard' : 'Choose up to two cards to discard') + '</div>' : '') +
    '<div class="hand" aria-label="Hand">' + battle.hand.map(combatCard).join('') + '</div></div></section>';
}

function screen(title, body, footer = '', className = '', description = '', glyph = '') {
  return '<section class="scene ' + className + '"><div class="scene-panel"><div class="scene-heading">' +
    (glyph ? '<div class="scene-glyph">' + icon(glyph) + '</div>' : '') + '<h1 tabindex="-1">' + title + '</h1>' +
    (description ? '<p>' + description + '</p>' : '') + '</div>' + body +
    (footer ? '<div class="scene-footer">' + footer + '</div>' : '') + '</div></section>';
}

function cardGrid(items, style = '') {
  return '<div class="card-grid ' + style + '">' + items.join('') + '</div>';
}

function offer(name, details, glyph, action, value, locked = false, used = false) {
  return '<button class="offer' + (used ? ' spent' : '') + '" data-action="' + action + '" data-value="' + value +
    '"' + disabled(locked) + '>' + icon(used ? 'check' : glyph) + '<span><strong>' + name +
    '</strong>' + (details ? '<small>' + details + '</small>' : '') + '</span></button>';
}

function offerList(items) { return '<div class="offer-list">' + items.join('') + '</div>'; }

function rewardCards(keys, action, up = false) {
  return cardGrid(keys.map(key => cardOption({key,up},action,key)));
}

function roomView(animate) {
  switch (game.phase) {
    case 'draft':
      return '<section class="draft scene"><div class="draft-aside"><img class="idol" src="./assets/idol.webp" alt="">' +
        '<h1 tabindex="-1">Neow</h1><p>Choose 3 cards</p><div class="draft-progress">' +
        [0,1,2].map(i => '<i class="' + (i < game.selected.size ? 'lit' : '') + '"></i>').join('') +
        '<span>' + game.selected.size + ' / 3</span></div></div><div class="draft-main">' +
        cardGrid(game.draft.map(key => cardOption({key},'draft',key,game.selected.has(key),
          game.selected.size === 3 && !game.selected.has(key))), 'draft-grid') +
        '<div class="scene-footer">' + button('Enter the forge','confirm-draft','','button primary',game.selected.size !== 3,'door') + '</div></div></section>';
    case 'battle': return combatView(animate);
    case 'reward':
      return screen('Spoils',rewardCards(game.rewardCards,'reward'),button('Skip','reward'),'','Choose one card','relic');
    case 'event':
      return screen(game.event.name,offerList(game.event.options.map(([name, details, action]) =>
        offer(name,details,'spark','event',action,!game.canEvent(action)))),'','',game.event.text,'question');
    case 'shop':
      return screen('Shop',offerList(game.shop.options.map(key =>
        offer(wares[key].name,wares[key].text,wares[key].icon,'shop',key,!game.canShop(key),game.shop.used.includes(key)))),
      button(game.shop.left ? 'Leave shop' : 'Continue','leave-shop','','button primary'),'',
      game.shop.left === 1 ? '1 choice left' : game.shop.left + ' choices left','die');
    case 'choice': {
      const {mode, options, up, cost, second} = game.choice;
      const titles = {new:'Choose a card', upgrade:'Upgrade a card', remove:'Remove a card', transform:'Transform a card', relic:'Choose a relic'};
      const choices = mode === 'new' ? rewardCards(options,'choose-key',up) : mode === 'relic' ?
        offerList(options.map(key => offer(relics[key].name,relics[key].text,relics[key].icon,'choose-key',key))) :
        cardGrid(options.map(card => cardOption(mode === 'upgrade' ? {...card,up:true} : card,'choose-id',card.id)), 'deck-grid');
      return screen(titles[mode],choices,second ? '' : button('Back','cancel-choice'),'',
        cost ? 'Costs ' + cost + ' HP' : second ? 'Second common card' : '', 'deck');
    }
    case 'treasure':
      return screen('Treasure', '<div class="treasure-list">' + game.treasure.map(key =>
        '<div class="relic-tile">' + icon(relics[key].icon) + '<strong>' + relics[key].name +
        '</strong><span>' + relics[key].text + '</span></div>').join('') + '</div>',
      button('Take relics','treasure','','button primary'),'','','relic');
    case 'camp':
      return screen('Campsite',offerList([
        offer('Rest','Heal ' + game.restAmount() + ' HP.','flame','camp','rest'),
        offer('Upgrade','Upgrade one card.','hammer','camp','upgrade',game.deck.every(card => card.up)),
      ]),'','','','flame');
    case 'victory':
    case 'defeat': {
      const win = game.phase === 'victory';
      return screen(win ? 'Act cleared' : 'Run ended','',button('New run','restart','','button primary'),'ending',
        win ? 'Spider Queen defeated' : route[game.room].name + ' defeated you',win ? 'crown' : 'flame');
    }
    default: return '';
  }
}

function render({animate = false, focus = null} = {}) {
  const previous = room.dataset.phase;
  renderHud();
  room.dataset.phase = game.phase;
  room.innerHTML = roomView(animate);
  if (previous && previous !== game.phase) {
    window.scrollTo(0,0);
    room.querySelector(game.phase === 'battle' ? '.turn-label' : 'h1')?.focus({preventScroll:true});
  } else if (focus) {
    room.querySelector(focus)?.focus({preventScroll:true});
  }
}

function inspectRun(kind) {
  const deck = kind === 'deck';
  inspect.innerHTML = '<div class="dialog-heading"><h2>' + (deck ? 'Deck' : 'Relics') + '</h2>' +
    button('', 'close-inspect','','icon-button',false,'close','Close') + '</div>' +
    (deck ? cardGrid(game.deck.map(card => '<div class="' + cardClasses(card) + '">' + cardContents(card) +
      '<span class="preview-slots">' + slotRules(card).map(rule => '<span>' + slotDisplay(rule) +
      '</span>').join('') + '</span></div>'),'deck-grid') : game.relics.length ?
      '<div class="treasure-list">' + game.relics.map(key => '<div class="relic-tile">' + icon(relics[key].icon) +
        '<strong>' + relics[key].name + '</strong><span>' + relics[key].text + '</span></div>').join('') + '</div>' :
      '<p class="inspect-empty">No relics yet.</p>');
  inspect.showModal();
}

function selectDie(id) {
  selectedDie = selectedDie === id ? null : id;
  render({focus:'[data-die="' + id + '"]'});
}

function handleAction(action, value) {
  switch (action) {
    case 'draft': return game.selectDraft(value);
    case 'confirm-draft': return game.confirmDraft();
    case 'target': return game.targetEnemy(Number(value));
    case 'play': return game.play(Number(value));
    case 'end-turn': return game.endTurn();
    case 'discard': return game.toggleDiscard(Number(value));
    case 'confirm-discard': return game.confirmDiscard();
    case 'reward': return game.takeReward(value || null);
    case 'event': return game.takeEvent(value);
    case 'shop': return game.takeWare(value);
    case 'leave-shop': return game.leaveShop();
    case 'choose-id': return game.choose(Number(value));
    case 'choose-key': return game.choose(value);
    case 'cancel-choice': return game.cancelChoice();
    case 'treasure': return game.takeTreasure();
    case 'camp': return game.camp(value === 'rest');
    case 'restart': game = newGame(); return true;
    default: return false;
  }
}

function settleDie(target, id, point = null) {
  const {index, socket} = target.dataset;
  let placed = false;
  const source = game.findDie(id);
  if (!source) return false;
  if (target.dataset.drop === 'card') placed = game.placeDie(id,Number(index),Number(socket));
  if (target.dataset.drop === 'pool') placed = game.returnDie(id);
  if (target.dataset.drop === 'reroll') placed = game.reroll(id);
  if (!placed) {
    if (target.dataset.drop === 'card') say('That die does not fit.');
    return false;
  }
  const die = placed === true ? source.die : placed;
  selectedDie = null;
  render({focus:point ? null : '[data-die="' + die.id + '"]'});
  const element = room.querySelector('[data-die="' + die.id + '"]');
  if (point && element && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const rect = element.getBoundingClientRect();
    const dx = point.x - rect.left - rect.width / 2;
    const dy = point.y - rect.top - rect.height / 2;
    element.animate([{transform:'translate(' + dx + 'px,' + dy + 'px) scale(1.12)', zIndex:5},
      {transform:'translate(0,0) scale(1)',zIndex:5}],{duration:145,easing:'cubic-bezier(.45,0,.25,1)'});
  }
  const hand = game.battle?.hand[index];
  if (hand && game.ready(hand)) say(cards[hand.key].name + ' is ready.');
  return true;
}

document.addEventListener('click', event => {
  if (suppressClick) return;
  const die = event.target.closest('[data-die]');
  if (die && game.phase === 'battle' && !game.battle.pending) {
    const id = Number(die.dataset.die);
    if (die.classList.contains('slotted') && selectedDie === id) {
      settleDie(room.querySelector('[data-drop="pool"]'),id);
    } else selectDie(id);
    return;
  }
  const element = event.target.closest('[data-action]');
  if (!element || element.disabled) return;
  const {action, value} = element.dataset;
  if (action === 'inspect') { inspectRun(value); return; }
  if (action === 'close-inspect') { inspect.close(); return; }
  if (action === 'slot' && selectedDie !== null) {
    settleDie(element.closest('[data-drop]'),selectedDie);
    return;
  }
  if (action === 'reroll' && selectedDie !== null) {
    settleDie(element,selectedDie);
    return;
  }
  if (handleAction(action,value)) {
    selectedDie = null;
    const animate = action === 'play' || action === 'end-turn';
    const safeAction = CSS.escape(action);
    const safeValue = CSS.escape(value ?? '');
    render({animate,focus:'[data-action="' + safeAction + '"][data-value="' + safeValue + '"]'});
    if (animate && game.battle?.line) say(game.battle.line);
  }
});

inspect.addEventListener('click',event => { if (event.target === inspect) inspect.close(); });

function dropAt(x, y, id) {
  const under = document.elementFromPoint(x,y);
  const exact = under?.closest('[data-drop]');
  if (exact) return exact;
  const hand = under?.closest('[data-hand]');
  let closest = null;
  let distance = Infinity;
  for (const element of room.querySelectorAll('[data-drop="card"]')) {
    const rect = element.getBoundingClientRect();
    const dx = Math.max(rect.left - x, x - rect.right, 0);
    const dy = Math.max(rect.top - y, y - rect.bottom, 0);
    if (Math.hypot(dx,dy) > 22 && element.closest('[data-hand]') !== hand) continue;
    const center = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
    if (center < distance && game.canPlace(id,Number(element.dataset.index),Number(element.dataset.socket))) {
      closest = element;
      distance = center;
    }
  }
  return closest;
}

function markTargets(id, active) {
  for (const element of room.querySelectorAll('[data-drop]')) {
    const {drop,index,socket} = element.dataset;
    const valid = drop === 'card' ? game.canPlace(id,Number(index),Number(socket)) :
      drop === 'reroll' ? game.battle.rerolls > 0 : false;
    element.classList.toggle('drag-target',active && valid);
  }
}

room.addEventListener('pointerdown', event => {
  const element = event.target.closest('[data-die]');
  if (!element || !event.isPrimary || event.button !== 0 || game.battle.pending) return;
  drag = {pointer:event.pointerId, id:Number(element.dataset.die), element, x:event.clientX, y:event.clientY};
  element.setPointerCapture(event.pointerId);
});

room.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  if (!drag.ghost && Math.hypot(event.clientX - drag.x,event.clientY - drag.y) > 5) {
    drag.ghost = drag.element.cloneNode(true);
    drag.ghost.removeAttribute('data-die');
    drag.ghost.className = 'die die-ghost';
    drag.ghost.tabIndex = -1;
    drag.ghost.setAttribute('aria-hidden','true');
    document.body.append(drag.ghost);
    drag.element.classList.add('dragging');
    markTargets(drag.id,true);
  }
  if (!drag.ghost) return;
  drag.ghost.style.left = event.clientX + 'px';
  drag.ghost.style.top = event.clientY + 'px';
  drag.hover?.classList.remove('drop-hover');
  drag.hover = dropAt(event.clientX,event.clientY,drag.id);
  if (drag.hover?.classList.contains('drag-target') || drag.hover?.dataset.drop === 'pool') drag.hover.classList.add('drop-hover');
});

function stopDrag(event, drop) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const {element,id,ghost,hover} = drag;
  drag = null;
  if (!ghost) return;
  ghost.remove();
  element.classList.remove('dragging');
  hover?.classList.remove('drop-hover');
  markTargets(id,false);
  suppressClick = true;
  setTimeout(() => { suppressClick = false; },0);
  if (!drop) return;
  const target = dropAt(event.clientX,event.clientY,id);
  if (target) settleDie(target,id,{x:event.clientX,y:event.clientY});
  else if (element.classList.contains('slotted')) {
    settleDie(room.querySelector('[data-drop="pool"]'),id,{x:event.clientX,y:event.clientY});
  }
}
room.addEventListener('pointerup', event => stopDrag(event,true));
room.addEventListener('pointercancel', event => stopDrag(event,false));
room.addEventListener('lostpointercapture', event => stopDrag(event,false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !inspect.open && selectedDie !== null) {
    selectedDie = null;
    render();
  }
});

render();
