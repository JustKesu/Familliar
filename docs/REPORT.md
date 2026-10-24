# REPORT — TGS2-4d: Geleton kyselina, Psi Warrior INT, značky akce Magic (D388)

Setup: `git fetch`, `merge --ff-only` = už aktuální, HEAD 240651c. Větev main.

## Co se změnilo
- `scripts/extract-data.js`:
  - A) `HOMEBREW_RACE_RESIST = { Geleton: ["acid"] }` v `loadHomebrew()`; tvar jako oficiální druhy (prosté řetězce,
    33 druhů má `resist`, např. Aasimar MPMM `["necrotic","radiant"]`). Spadne, když Geleton už `resist` má nebo když
    se nepřidá.
  - B) `OFFICIAL_SUBCLASS_SPELL_ABILITY = { "Fighter|Psi Warrior|XPHB": "int" }` — samostatná tabulka pro opravy
    oficiálních dat, uplatněná v `extractClasses()` po `removeSuperseded`. Spadne, když podtřída chybí, nemá
    `additionalSpells` nebo už má `ability`. Výsledek: `{"innate":{"18":{"daily":{"1":["telekinesis|xphb"]}}},"ability":"int"}`.
  - C) `HOMEBREW_WORDING`: Magic Coin (1), Money Talks (2), Etherean Veil Shift (1) → `{@action Magic|XPHB}`; všechny
    věty nalezeny přesně. 28 dvojic.
- Data přegenerována: `data/classes.json`, `data/species.json`, `data/subclass-features.json`.
- Kód sheetu beze změny — všechny tři opravy se projevily jen změnou dat.
- Docs: DATA.md (Geleton resist, oficiální patch Psi Warrior, 28 dvojic), STATUS.md (položka TGS2-4d, odstraněno
  "Open" u TGS2-3), DECISIONS.md D388.

## Ověření
- `npm run typecheck` OK; `npm test` 188 souborů / 3442 testů OK; `npm run validate-data` 177/177 OK.
- `npm run e2e` 689 passed (2.4 min). Nový `e2e/tgs2Fixes4d.spec.ts`:
  a) Geleton: Defenses "Resistant: Acid"; b) Fighter 18 Psi Warrior: Telekinesis DC 13 (INT 8 −1 + PB 6 + 8),
  bez "unresolved"; c) Bard 3 Mercantile: Magic Coin ve skupině Action; d) Etherean: Veil Shift ve skupině Action.
  tgs2Wording, tgs2Resistances, tgs2Spells prošly.

## Rozhodnutí přijatá při práci (Decisions taken)
- Úroveň Psi Warrior v e2e je 18, ne 10: Telekinesis (Telekinetic Master) je v datech až na úrovni 18.
- Patch aplikován jen na Psi Warrior|XPHB; verze TCE pro PHB Fightera má stejnou mezeru, ale neextrahuje se.
- Test Magic Coin na Bard 3 (úroveň Magic Coin dle dat); Money Talks (6) ověřen jen v datech (2 značky), ne v e2e.

## Subagent
- Nepoužit.

## Otevřené / pro rozhodnutí
- Nic nového.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Defenses karta (Geleton), Spells tab (Psi Warrior 18, Telekinesis), Actions tab skupina Action
(Mercantile Magic Coin / Money Talks, Etherean Veil Shift).
