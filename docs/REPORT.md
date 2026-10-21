# REPORT — F-40: Wild Shape Transform s dočasnými HP (D364)

HEAD před úlohou: 7e8a370 (podmínka splněna).

## STEP 1 — místa změn
| Soubor:řádek | Změna |
|---|---|
| src/sheet/CharacterSheet.tsx:2502 `spendResource` | dnešní cesta utrácení (UseBoxes :572 → `onSpendResource` :3270); znovu použita, beze změny |
| src/sheet/CharacterSheet.tsx:33, 51–52 | importy |
| src/sheet/CharacterSheet.tsx:2582–2596 | `wildShapeTransform` (spendResource + grantTemporaryHitPoints → onEditHitPoints) |
| src/sheet/CharacterSheet.tsx:3293 | prop do ExtrasTab |
| src/sheet/ExtrasTab.tsx:17, 31, 48–49, 117–129 | doc, prop, tlačítko v HP buňce řádku Wild Shape |
| src/beasts/wildShapeTransform.ts (nový) + .test.ts | výpočet temp HP |
| e2e/wildShapeTransform.spec.ts (nový) | scénáře a–d |
| docs/DECISIONS.md, STATUS.md, REPORT.md | D364, Extras, report |

## Změny
- `wildShapeTemporaryHitPoints(classes, grantedFeatures)`: null bez feature id `cf|wild shape|druid|xphb|2|xphb`; jinak součet úrovní Druida, ×3 když drží subclass feature `scf|circle forms|druid|xphb|*|xphb|…` (PHB 2014 Circle Forms se nepočítá).
- Transform: `spendResource(resourceKey('Wild Shape','Druid'), 1)` + `onEditHitPoints` s `grantTemporaryHitPoints`; currentHp, maxHpOverride a deathSaves beze změny. Dva zápisy, oba čtou čerstvé úložiště (stejně jako hit dice). `canSpend` = `canSpendResource(max, spent, 1)`.
- Tlačítko jen když existuje XPHB Wild Shape a oba zápisové callbacky; třída `btn--accent-outline sheet__spell-cast` (žádné CSS změny).

## Ověření
- typecheck OK; `npm test` 186 souborů / 3383 testů OK (nové: 6 v wildShapeTransform.test.ts — úroveň, Moon ×3, Druid 2/Fighter 5 = 2, PHB 2014 null, PHB Circle Forms ignorován, vyšší temp zůstává); validate-data 175/175 OK.
- `npm run e2e` 605/605 OK za 7,9 min (nad 3 min). Nové F-40 a (Druid 4: temp 4, `resourceUses {Wild Shape:1}`, 1 z 2 boxů), b (Moon 3: temp 9), c (2/2 utraceno: disabled), d (temp 10 zůstává, použití utraceno).

## Decisions taken
- Umístění tlačítka: v buňce Hit points vedle „Uses your HP" (vizuální, neviditelné v datech).
- Moon se pozná podle held feature Circle Forms (XPHB), ne podle jména subclassu.
- Nevyřešeno/otevřené: Transform nemění řádek ani neukládá aktuální formu; nic dalšího (návrat z formy apod.) se neimplementovalo.

## Ostatní
- Subagent nepoužit.
- `scripts/investigate-multi-dice-spells.js` byl nesledovaný už před úlohou; nechán být, necommitnut (git clean zakázán zadáním).

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.

Změněné obrazovky: záložka Extras — řádky Wild Shape (tlačítko Transform v buňce Hit points); karta Hit Points (Temp) po kliknutí.
