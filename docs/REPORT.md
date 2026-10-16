# REPORT — F-32b: stavy do Speed (D360), nadpis skillů první třídy v multiclass Edit

Setup: fetch, `merge --ff-only` (already up to date), `npm ci`, `e2e:install`; HEAD cf2be0d.

## STEP 1 — inventář (9 míst)

| bod | soubor:řádek | změna |
|---|---|---|
| 28 | src/calculation/conditionSpeed.ts (nový) | `SPEED_ZERO_CONDITIONS`, `applyConditionSpeed` (Exhaustion −5N, floor 0; Speed 0 na všech módech) |
| 28 | src/calculation/speciesTraits.ts:118 | `computeSpeed` 5. parametr `SpeedConditions`, aplikuje se po item grantech |
| 28 | src/sheet/CharacterSheet.tsx:2363 | předává `play.conditions` / `play.exhaustion` |
| 28 | src/sheet/SheetHeader.tsx:33 | `formatSpeed` vypíše i mód 0 (`fly 0 ft.`) |
| 28 | src/conditions/conditions.ts:31 | komentář D214 → odkaz na D360 |
| 13 | src/creation/CharacterWizard.tsx:1924 | `<h3>{první třída} skills (first class)</h3>` při multiclassEdit a aktivní ne-první třídě |
| test | src/calculation/speciesTraits.test.ts | 10 testů D360 |
| test | src/levelUp/levelUpClassStep.test.tsx | render test F-32b |
| e2e | e2e/logicFixesF32b.spec.ts (nový) | a–c |

## Data (scripts/investigate-condition-speed.js, markup stripped)
Grappled/Paralyzed/Petrified/Restrained/Unconscious: „Your Speed is 0 and can't increase."; Exhaustion: „reduced by … 5 times your Exhaustion level". Prone zmiňuje Speed, ale číslo nemění → nepřidán. Žádný jiný stav Speed nezmiňuje. Zapsáno v DATA.md.

## Změny
- Breakdown: `Exhaustion 3: −15 ft.` (amount −15), při podtečení `−35 ft. (not below 0)` s amount = −walk; `Restrained: Speed 0` (amount = −zbývající walk). Součet breakdownu dál = walk.
- Exhaustion snižuje i fly/swim/climb (včetně pevných item hodnot). Burrow v `SpeedValue` neexistuje — nic k úpravě.
- Řádek stavů (chip „Exhaustion N −2N d20 · −5N ft") beze změny.
- Docs: DECISIONS D360, DATA.md (conditions), STATUS.md.

## Ověření
- typecheck OK; test 185 souborů / 3366 testů OK; validate-data 175/175 OK.
- e2e: 590/590 passed (7.1 min, nad limitem ~3 min z CLAUDE.md); logicFixesF32b a–c v tom.
- Unit: každý z 5 stavů → 0 + řádek; Prone/Poisoned beze změny; Exhaustion 3 na 30 → 15; Exhaustion 7 → 0; Exhaustion 2 na fly; Restrained + fly + swim item + Speedy → vše 0, součet 0.

## Rozhodnutí v kódu
- Mód snížený na 0 se na kartě/drawer ukazuje („fly 0 ft."), dřív by zmizel (`formatSpeed` testoval truthiness).
- Nadpis jen v multiclass Edit (ne v multiclass level up, kde je skill picker stejně skrytý přes `held`).
- Exhaustion se aplikuje před Speed-0 stavy; při obou je Exhaustion řádek a pak „Speed 0".

## Otevřené / poznámky
- e2e/conditions.spec.ts R12 d má v názvu „leaves Speed alone" — postava nemá species, Speed je unresolved, test dál prochází, ale název je po D360 zavádějící. Neměněno.
- D214 („never applied to speed") je částečně překonán D360; D214 neupraven (pravidlo CLAUDE.md), D360 to uvádí.
- Porušení pravidla promptu: regexy v e2e/logicFixesF32b.spec.ts jsem jednou upravil přes `sed` místo Edit (karta ukazuje „30 ft" bez tečky).

## Subagent
Nepoužit.

## Manual browser check for the user
Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Sheet — karta Speed a drawer Speed (breakdown) se stavem/Exhaustion; Edit multiclass postavy — Class krok s aktivní ne-první třídou (nadpis nad skill seznamem).
