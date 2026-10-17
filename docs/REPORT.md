# F-34: opravy z review F-31 až F-33 (D362)

Setup: `git fetch`, `git merge --ff-only origin/main` → už aktuální, HEAD `072f24f`. Subagent nepoužit.

## Co se změnilo (STEP 1: 14 míst, pod limitem 15)

| Oprava | Místo | Změna |
|---|---|---|
| 1 | `ManageFeatsPanel.tsx:299` | aria-label `Remove ${featDisplayName(name)}` |
| 2 | `e2e/conditions.spec.ts` R12 d | seed Human XPHB, Speed 30 ft → s Exhaustion 2 `20 ft`; test přejmenován |
| 3 | `spellcasting.ts` | `abilityModifier?: number` v `SpellcastingEntry`, `FeatSpellcastingEntry`, `SpeciesSpellcastingEntry`; `computeAbilitySpellcasting` ho vrací |
| 3 | `spellActionRowData.ts` `toCaster` | čte pole, ne text breakdownu |
| 4 | `characterStore.ts` `readableEntryError` | druhý parametr `verb`; načtení z úložiště: „Character N in storage could not be read", import beze změny |
| 5 | `featuresTabData.ts` | `isRefWrapper`; `olderSubclass` skrývá jen wrapper |
| 6 | `spellActionRowData.ts` `cantripDamageAtLevel` | řádek s doslovnou hodnotou `'0'` se vynechá (Actions i Spells) |
| 7 | `speciesData.ts` | `speciesDisplayName` + nová `formatSpeciesName(name, source?)` |
| 7 | `CharacterSheet.tsx` (hlavička), `characterSummary.ts` (karta), `CharacterWizard.tsx` (Review fallback) | volají `formatSpeciesName` |
| 7 | `docs/DECISIONS.md` D362, `docs/STATUS.md` | zápis |

Picker druhů používá `displayName` ze `speciesDisplayName`, tedy se změnil automaticky.

## Ověřeno

- `npm run typecheck` OK; `npm test` 185 souborů / 3373 testů OK; `npm run validate-data` 175/175; `npm run e2e` 597 passed (1,9 min).
- Unit: `toCaster` čte pole i při prázdném breakdownu (spellActionRowData.test), 7 `toEqual` v spellcasting.test doplněno o `abilityModifier`; `readableEntryError(…, 'read')` + `formatSpeciesName` (textFixesF31.test); `featuresTabGroups` wrapper skrytý / vlastní text zůstane (featuresTabData.test); Green-Flame Blade na L1 bez „0 fire damage" (spellActionRowData.test); speciesData.test aktualizován na nový formát.
- E2E: `e2e/reviewF34.spec.ts` a (Remove Magic Initiate (Cleric)), c (GFB L1), d (Air Genasi v hlavičce i na kartě, uložené jméno `Air`); b = `conditions.spec.ts` R12 d.

## Rozhodnutí v kódu

- Genasi: uložené jméno je jen „Air" (+ MPMM), takže „Genasi (Air)" nejde odvodit ze stringu. `formatSpeciesName` má pevnou čtveřici Air/Earth/Fire/Water pro zdroj MPMM (bez async načtení species.json u každé karty). Zjištěno `scripts/investigate-f34-genasi.mjs`: Genasi MPMM + 4 podpodoby s `raceName`; 24 jmen se „; ".
- `isRefWrapper` povoluje vedle `refSubclassFeature` i prosté řetězce (úvodní věta wrapperu); jakýkoli jiný objekt (vlastní `entries`) feature ponechá viditelnou. Doslovné „jen refy" jsem nezvolil, protože reálný text Conquest wrapperu neznám (data se nesmí číst).
- `abilityModifier` je volitelné pole, aby ručně skládané fixtury nepadaly; chybějící → `null` jako dřív.
- Řádek GFB se skrývá jen při doslovné hodnotě `'0'`; sekundární řádek se skrývá nikdy.
- Review fallback větev (`speciesSelection` bez shody) používá `formatSpeciesName`; větev s výběrem dál ukazuje „Genasi (Air) — Air"-styl `displayName — optionName` beze změny.

## K rozhodnutí uživatele

- Guard 16 kouzel (review nález 1 / otázka C) nebyl v zadání; neřešeno.
- `scripts/investigate-f34-genasi.mjs` zůstává neuklizený a necommitnutý (zadání zakazuje `git clean`).

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.

Změněné obrazovky: hlavička listu (jméno druhu), karta postavy na startovní obrazovce (podřádek), wizard Review (řádek identity), Manage Feats (tlačítko Remove), záložky Spells a Actions (Green-Flame Blade), karta Speed s Exhaustion, záložka Features (Conquest/Paladin).
