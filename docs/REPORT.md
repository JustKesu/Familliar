# REPORT — B-3: Innate Sorcery uses tracker (D374)

HEAD před úkolem: d2eb7b1 (fetch + ff-only: already up to date).

## Změny
- `src/calculation/resources.ts`: `LEVEL_SCALED_USES` + `'Innate Sorcery': { className: 'Sorcerer', steps: [[1, 2]] }`,
  komentář cituje D374. Recovery bez zásahu: věta „regain all expended uses … Long Rest" → `shortRestRecovery` null,
  `singleUseRechargesOnShortRest` nematchuje (žádné „can't … again until") → shortRest null. STOP podmínka nenastala.
- Unit test `resources.test.ts`: Sorcerer 1/3/20 → max 2 s breakdownem, shortRest null; Warlock 6 / Sorcerer 3 → 2.
- `e2e/innateSorcery.spec.ts` (schema 61): a) Sorcerer 1 → skupina „Innate Sorcery uses", 2 boxy; b) spend → Short Rest
  1 used → Long Rest 0; c) Warlock 6 / Sorcerer 3 → 2 boxy.
- Docs: DECISIONS.md D374, STATUS.md B-3, DATA.md (nález inventury níže).

## Další kandidáti
Skript `scripts/investigate-b3-prose-counts.mjs` (necommitnut) reimplementuje self-limited test, implicit single use,
LEVEL_SCALED_USES a match na sloupce tabulek; kontrola: Innate Sorcery XPHB jím projde. Zbylé features s unknown max
a „twice|thrice|N times" v textu: 3, všechny jsou násobitele, ne počty použití:
- Spell-Storing Item [Artificer] EFA: „twice your Intelligence modifier"
- Soul of Artifice [Artificer] EFA: „20 times the number of magic items"
- Perfected Armor [Artificer / Armorer] EFA: „twice your Speed"
Žádný další kandidát pro LEVEL_SCALED_USES.

## Ověření
- typecheck OK; test 187 souborů / 3399 testů OK; validate-data 177/177 OK; e2e 640 passed za 7.8 min (nad 3 min).

## Pro uživatele
- Nesledovaný `scripts/investigate-b3-prose-counts.mjs` zůstává (git clean podle zadání nespuštěn).
- Push: větev session byla `claude/dazzling-mayer-esxluu`; commit pushnut na `origin/main` podle zadání.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: list postavy, záložka Actions (řádek Innate Sorcery s 2 boxy).
