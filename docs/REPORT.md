# REPORT — PB-1: počítadla pro featury počítané Proficiency Bonusem (D414)

Setup: `git fetch`, `git merge --ff-only origin/main` (already up to date), `npm ci`, `npm run e2e:install`; HEAD d1a96cd.

## STEP 1 — tabulka (`scripts/investigate-pb-uses.mjs`, nezachován)

Shoda „times equal to … Proficiency“ (bez markupu): 0 class features, 13 subclass features, 12 feats, 3 optional features = 28. Všech 28 je „a number of times equal to your Proficiency Bonus“; žádný STOP (dvojnásobek, jiný počet, pool). Recharge u všech: Long Rest, Short Rest nic.

| Featura | Původ | Zdroj | Značka odpočinku |
|---|---|---|---|
| Infectious Fury, Call the Hunt | Barbarian / Beast | TCE | žádná |
| Bolstering Magic, Magic Awareness | Barbarian / Wild Magic | TCE | žádná |
| Steps of Night | Cleric / Twilight | TCE | žádná |
| Emboldening Bond | Cleric / Peace | TCE | žádná |
| Cauterizing Flames | Druid / Wildfire | TCE | žádná |
| Runic Shield, Giant's Might | Fighter / Rune Knight | TCE | žádná |
| Writhing Tide, Swarming Dispersal | Ranger / Swarmkeeper | TCE | žádná |
| Elemental Gift | Warlock / Genie | TCE | žádná |
| Tentacle of the Deeps | Warlock / Fathomless | TCE | žádná |
| Bond / Pact / Protection of the Talisman | optional feature | TCE | žádná („restored when you finish a long rest“) |
| Fairy Trickster, Mythal Touched | feat | FRHoF | Long Rest |
| Gathered Whispers, Living Shadow, Sharp Eye, Symbiotic Being | feat | RHW | Long Rest |
| Mist Walker | feat | RHW | Long+Short (Short = záchrana v mlze, ne obnova) |
| Greater Mark of Handling / Healing / Warding, Mark of Sentinel | feat | EFA | Long Rest |
| Greater Aberrant Mark | feat | EFA | Short+Long (Short = Aberrant Fortitude, ne obnova) |

## Co se změnilo
- `src/calculation/resources.ts`: `PROFICIENCY_BONUS_USES` (28 jmen), strážní regex `number of times equal to your Proficiency(?: Bonus)?` (XPHB značka se ořízne na „Proficiency“), `proficiencyBonusMax` v řetězu `computeResourceMax` za `abilityModifierMax`; rozpis „Proficiency Bonus +3“ z `computeProficiencyBonus` (celková úroveň). `isSelfLimitedFeature` bere řádek tabulky i bez značky odpočinku — jinak by 16 TCE řádků vůbec nebylo zdrojem.
- Žádný z 28 neměl počítadlo jinak (feats měly zdroj s neznámým maximem, TCE žádný). Gathered Whispers a Mark of Sentinel mají navíc `additionalSpells daily."1"` — samostatné počítadlo kouzla zdarma (1×/LR), beze změny.
- `resources.test.ts`: nový blok D414 (TCE i tagovaný feat, multiclass, cizí jméno, jiné znění); datový test 80 → 108 známých maxim + všech 28 = 6 u Fightera 20, bez Short Rest.
- `e2e/proficiencyBonusUses.spec.ts` a–d (feat d = Fairy Trickster|FRHoF u Fightera 5, ASI na 4, `chosenAbility: charisma`).
- Docs: D414 (DECISIONS), STATUS, DATA (sekce D412).

## Ověření
- typecheck OK; unit 3513/3513; validate-data 177/177.
- `npm run e2e`: 773 passed, 1 failed (7.7 min, nad limitem ~3 min). Selhal `subclassSpellcastingPrereq.spec.ts` SC-1 a (timeout 60 s, Next ve wizardu disabled ve `walkToAsi`); soubor samostatně znovu 4/4 passed — nestabilní pod zátěží, nesouvisí s PB-1 (resources.ts wizard nečte). `e2e/proficiencyBonusUses.spec.ts` 4/4.

## Subagent
Nepoužit.

## Rozhodnutí přijatá během práce
- TCE featury bez značky odpočinku se stávají zdrojem díky řádku tabulky (nutné pro cíl úkolu).
- Testy a–c čtou boxy v záložce Features: TCE featury bez značky akce/odpočinku nejsou v záložce Actions (D86, `isActionTableFeature` chce `consumes` nebo značku odpočinku). Feat (d) je v obou.

## Otázka pro uživatele
- Mají se 16 TCE řádků (Giant's Might apod.) ukazovat i v záložce Actions (skupina „other“, jako species traits s počítadlem podle D186)? Dnes jen Features. Ano = rozšířit kvalifikaci v `featureActionRowData.ts` o featury s počítadlem D414; ne = stav zůstává.

## Manual browser check for the user
None - the planning chat checks the looks from screenshots. Změněné obrazovky: list postavy, záložka Features (Rune Knight a ostatní TCE podtřídy z tabulky, Talismany), záložky Actions a Features (12 featů z tabulky).
