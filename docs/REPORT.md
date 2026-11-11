LS-1 hotovo (D411). HEAD na startu b0733fa.

## STEP 1: kdo čte zisky level upu (LevelGains)
| Místo | Co čte | Musí sledovat zvolenou podtřídu? |
|---|---|---|
| CharacterWizard.tsx:224 `levelUpStepConditions` | `steps[*].status/swappable/owingSubclasses` → procházené kroky | ano |
| CharacterWizard.tsx:225 `unknownLevelUpSteps` | `steps[*].reason` → poznámka „check it by hand“ (ř. 1901) | ano |
| CharacterWizard.tsx:395 seed `levelUpStepConditions(levelUp)` | počáteční kroky při seedu | ne (podtřída ještě nezvolena; ř. 224 je přepisuje každý render přes ř. 1765) |
| CharacterWizard.tsx:228–256, 711–749, 1024, 1357, 1382, 1400, 1781–1800, 1818–1915, 2236, 2428, 2481 | `level`, `classLevel`, `className`, `classSource` | ne (nezávisí na podtřídě) |
| CharacterWizard.tsx:2461 → ReviewStep `levelUp` | `newFeatures` (ReviewStep.tsx:198, 296–299), `level` (247, 294) | ano (newFeatures) |
| LevelUpButton.tsx / LevelUpClassDialog.tsx | volba třídy před wizardem | ne (podtřída se volí až v kroku Class) |
| LevelUpWizardGate.tsx:48 | spočte základní zisky, `unresolved` | ne |
| Počty ve Spells kroku | `computeSpellCounts(draftCharacterForSpells)` (ř. 1517), ne LevelGains | už sleduje draft s podtřídou |

Míst, která musí sledovat podtřídu: 3. Navržený mechanismus potvrzen bez přestavby wizardu.

## Co se změnilo
- src/levelUp/levelGains.ts: `levelGainsFor(..., chosenSubclass = null)` a `loadLevelGainsFor(..., chosenSubclass)`; s podtřídou počítá z kopie postavy, kde cílová třída (i nově vstupovaná) tu podtřídu nese.
- src/creation/CharacterWizard.tsx: `newSubclass` = podtřída z kroku Class, pokud ji uložená cílová třída nemá; efekt přepočte zisky; `gains` nahrazuje `levelUp` v ř. 224/225 a v `ReviewStep levelUp`. Do konce přepočtu je `classPickRequirements` v `stepConditions` null → Next na kroku Class čeká. Selhání přepočtu → zisky bez podtřídy (D43).
- Unit test: levelGains.test.ts D411 (Cleric 2→3 s Life Domain: Disciple of Life + Life Domain).
- docs: D411, STATUS.md.

## Testy
- `npm run typecheck` čistý. `npm test`: 190 souborů, 3500 testů prošlo.
- e2e/levelUpSubclassGains.spec.ts a–d prošly (a EK: Spells 0/2 + 0/3, War Bond, kouzla na listu; b Fighter 5 / Rogue 2 → Arcane Trickster: Rogue Spells, Mage Hand Legerdemain; c Valor: Combat Inspiration, Martial Training; d EK → Champion: krok Spells zmizí, Improved Critical, bez War Bond).
- Plné `npm run e2e`: 761 prošlo, 7,5 min (nad 3 min limitem, hlásím).

## Subagent
Nepoužit.

## Decisions taken
- Next na kroku Class je zablokovaný, dokud přepočet zisků neskončí (jinak by rychlé kliknutí přeskočilo Spells).
- Přepočet běží i pro podtřídu zvolenou později, než je úroveň podtřídy (uložená třída bez podtřídy): rozdíl úrovní pak počítá podtřídu na obou stranách, takže starší featury podtřídy ve „What's new“ nejsou.

## Otevřené / mimo rozsah
- Podtitul Review („Bard 3“) podtřídu neukazuje ani při tvorbě postavy; nezměněno — rozhodnutí pro plánovací chat.
- Netrackovaný `scripts/investigate-bm-table.js` z minulé session: necommitnut, `git clean` nespuštěn (zakázáno zadáním).

## Manual browser check for the user
None - the planning chat checks the looks from screenshots. Změněné obrazovky: level up wizard — krok Class (Next čeká na přepočet), krok Spells v level upu na úroveň podtřídy, Review „What's new“.
