# Ember Odds

A one-act dice deckbuilding roguelike. [Play on GitHub Pages](https://bit-rot.github.io/ember-odds/).

## Run locally

Serve this directory with any static HTTP server. For example, use
`python -m http.server 8080` and open `http://localhost:8080`. Add
`?seed=ember` to the URL for a repeatable run.

## Prototype defaults

- The starting deck has four Strikes, four Defends, and one Bash. The Ember Knight begins at 48 HP and Spider Queen has 68 HP.
- The fixed route visits Neow, Sludge, Gremlin, an event, the shop, four Serpents, treasure, the campsite, and Spider Queen. Three combat victories offer one optional card each. The boss ends the run.
- Standard common, uncommon, and rare base odds are 60/37/3 for regular combat, 50/40/10 for elite combat, and 54/37/9 for the mixed shop offer. Combat rarity starts at a −5 percentage-point rare offset, gains a point per nonrare card generated, and resets upon generating a rare. The shop reads the offset. Tier-specific shop wares use their listed rareness.
- Countdown dice can be retrieved during the turn. Ending the turn banks their pips on that card. The final die may overshoot the target. Splitter uses two positive dice whose faces sum to the original face.
- Defend upgrades to 6 Block. So Angry and Calculus gain one more Strength per trigger when upgraded. The shop offers five wares, with up to two selections. The campsite restores 30% of maximum HP.
- Events and artwork are original. Event options draw from the prototype’s card and relic pool.

## Validate

Run `node --test test/game.test.mjs` for the rules and scripted route.
The browser check in `test/browser.mjs` uses Node 18 or newer, `playwright-core@1.56.1`,
and a local Chromium installation referenced by `CHROME_BIN`. It starts its own
server for local testing. Set `EMBER_ODDS_URL` to check a deployed copy or
`EMBER_ODDS_EVIDENCE` to write screenshots to an existing directory.

## References

- [Mega Crit’s Blitz announcement](https://steamcommunity.com/games/2868840/announcements/detail/708914333639245838)
- [Spire Codex card rarity reference](https://spire-codex.com/mechanics/card-rarity)
- [Terry Cavanagh’s Jester design diary](https://distractionware.com/blog/2019/02/design-diary-the-jester/)
- [Dicey Dungeons equipment reference](https://wiki.diceydungeons.com/doku.php?id=equipment)
