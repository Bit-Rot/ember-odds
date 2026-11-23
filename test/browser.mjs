import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {chromium} from 'playwright-core';
import {playthrough} from './pilot.mjs';

const mime = {'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.webp':'image/webp','.png':'image/png'};
const server = createServer(async (request,response) => {
  const path = new URL(request.url,'http://localhost').pathname;
  const file = new URL('..' + (path === '/' ? '/index.html' : path),import.meta.url);
  try {
    const contents = await readFile(file);
    response.writeHead(200,{'content-type':mime[extname(file.pathname)]}).end(contents);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = process.env.EMBER_ODDS_URL ?? 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({executablePath:process.env.CHROME_BIN});
const errors = [];
const assetFailures = [];
const evidence = process.env.EMBER_ODDS_EVIDENCE;

async function open(seed, width, height, hasTouch = false) {
  const page = await browser.newPage({viewport:{width,height},hasTouch});
  page.on('pageerror',error => errors.push(error.message));
  page.on('response',response => {
    if (response.status() >= 400 && response.url().startsWith(base)) {
      assetFailures.push(response.status() + ' ' + response.url());
    }
  });
  await page.goto(base + '?seed=' + seed);
  await page.locator('.draft-grid .card').first().waitFor();
  assert.equal(await page.locator('.draft-grid .card').count(),10);
  return page;
}

function action(page,key,value = '') {
  return page.locator('[data-action="' + key + '"][data-value="' + value + '"]');
}

async function draft(page) {
  assert.equal(await action(page,'confirm-draft').isEnabled(),false);
  for (let i = 0; i < 3; i++) await page.locator('.draft-grid .card').nth(i).click();
  await action(page,'confirm-draft').click();
  assert.equal(await page.locator('.hand .card').count(),6);
}

async function drag(page, from, to, offset = 0) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  assert.ok(start && end);
  await page.mouse.move(start.x + start.width/2, start.y + start.height/2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width/2 + offset, end.y + end.height/2,{steps:8});
  await page.mouse.up();
}

async function visibleHand(page) {
  const layout = await page.evaluate(() => ({
    width:innerWidth, scrollWidth:document.documentElement.scrollWidth, height:innerHeight,
    cards:[...document.querySelectorAll('.hand .card')].map(element => {
      const {top,right,bottom,left} = element.getBoundingClientRect();
      return {top,right,bottom,left};
    }),
  }));
  assert.equal(layout.scrollWidth,layout.width);
  assert.equal(layout.cards.length,6);
  for (const rect of layout.cards) {
    assert.ok(rect.top >= 0 && rect.left >= 0 && rect.right <= layout.width && rect.bottom <= layout.height,
      JSON.stringify({layout,rect}));
  }
}

async function capture(page,file) {
  if (evidence) await page.screenshot({path:evidence + '/' + file + '.png'});
}

try {
  const desktop = await open('ember',1280,720);
  await capture(desktop,'draft-1280');
  await draft(desktop);
  await visibleHand(desktop);
  await capture(desktop,'combat-1280');
  const dice = desktop.locator('.dice-tray .die');
  const bash = desktop.locator('[data-hand="0"]');
  const strike = desktop.locator('[data-hand="2"]');
  await drag(desktop,dice.first(),bash.locator('.socket'));
  assert.equal(await bash.locator('.die').count(),0,'invalid 3 cannot enter Bash');
  await drag(desktop,dice.first(),strike.locator('.socket'),28);
  assert.equal(await strike.locator('.die').count(),1,'forgiving placement accepts near the socket');
  assert.equal(await strike.locator('.card-cast').isEnabled(),true);
  await capture(desktop,'armed-card-1280');
  await drag(desktop,strike.locator('.die'),desktop.locator('.dice-tray'));
  assert.equal(await strike.locator('.die').count(),0,'dragging an assigned die frees it');
  assert.equal(await dice.count(),3);
  await drag(desktop,dice.first(),desktop.locator('.reroll'));
  assert.equal(await desktop.locator('.reroll').isEnabled(),false);
  assert.equal(await dice.count(),3);
  await dice.first().focus();
  await dice.first().press('Enter');
  await action(desktop,'slot','2,0').press('Enter');
  await action(desktop,'play','2').press('Enter');
  assert.equal(await dice.count(),2);
  assert.equal(await desktop.locator('.hand .card').count(),6);
  await action(desktop,'end-turn').click();
  assert.equal(await desktop.locator('.turn-label').innerText(),'Turn 2');
  assert.equal(await dice.count(),3);
  await desktop.getByRole('button',{name:'Deck, 12 cards'}).click();
  assert.equal(await desktop.locator('dialog .card').count(),12);
  await desktop.keyboard.press('Escape');
  assert.equal(await desktop.locator('dialog').isVisible(),false);
  await desktop.close();

  for (const [width,height] of [[390,844],[320,568]]) {
    const phone = await open('ember',width,height,true);
    await capture(phone,'draft-' + width);
    await draft(phone);
    await visibleHand(phone);
    await capture(phone,'combat-' + width);
    await phone.locator('.dice-tray .die').first().tap();
    await action(phone,'slot','2,0').tap();
    assert.equal(await phone.locator('[data-hand="2"] .card-cast').isEnabled(),true);
    await phone.close();
  }

  const complete = await open('pilot-65',1280,720);
  const {game,actions} = playthrough('pilot-65');
  assert.equal(game.phase,'victory');
  let lastPhase = 'draft';
  const phases = new Set([lastPhase]);
  for (const step of actions) {
    const element = step.action === 'die' ? complete.locator('[data-die="' + step.value + '"]') :
      action(complete,step.action,step.value);
    if (step.action === 'die' || step.action === 'slot') await element.press('Enter',{timeout:3000});
    else await element.click({timeout:3000});
    const phase = await complete.locator('#room').getAttribute('data-phase');
    if (phase !== lastPhase) {
      phases.add(phase);
      if (phase === 'battle' && await complete.locator('.unit.queen').count()) await capture(complete,'boss-1280');
      if (phase === 'battle' && await complete.locator('.unit.serpent').count()) await capture(complete,'elite-1280');
    }
    lastPhase = phase;
  }
  for (const phase of ['battle','reward','event','shop','choice','treasure','camp','victory']) assert.ok(phases.has(phase),phase);
  assert.equal(await complete.getByRole('heading',{name:'Act cleared'}).count(),1);
  await capture(complete,'victory-1280');
  await action(complete,'restart').click();
  assert.equal(await complete.locator('.draft-grid .card').count(),10);
  assert.deepEqual(errors,[]);
  assert.deepEqual(assetFailures,[]);
  console.log(JSON.stringify({pointer:'passed',keyboard:'passed',touch:'passed',viewports:[1280,390,320],
    run:'victory',actions:actions.length,remainingHP:game.hp,phases:[...phases]}));
} finally {
  await browser.close();
  server.close();
}
