# REPORT — F-32a: Eldritch Blast damage, duplicitní feature podtřídy, default Manage Extras, L1, L2

Druhý běh (po schválení `npm ci` uživatelem): npm ci, e2e:install, typecheck, test, validate-data, e2e → commit, `git push origin HEAD:main`. `9cccc9c` / `claude/keen-ptolemy-pntid6` netknuty.

Setup (první běh): lokální `main` měl navíc `9cccc9c` (jen docs/REPORT.md, „F-32 stopped"), divergentní od `origin/main` → `--ff-only` selhal. Commit je uložen na `origin/claude/keen-ptolemy-pntid6`; lokální `main` srovnán `git reset --hard origin/main` → HEAD `39ecb0e` (OK).

## STEP 1 — inventura (9 míst v kódu)

| item | file:line | změna |
|---|---|---|
| 19 | src/sheet/spellActionRowData.ts:173 | nové `cantripDamage(detail, level)`: bez `scalingLevelDice` → `{@damage}` z entries + jediný typ („1d10 Force") |
| 19 | src/sheet/spellActionRowData.ts:~315 | Actions Damage volá `cantripDamage` |
| 19 | src/sheet/spellsTabData.ts:344 | Spells Effect volá `cantripDamage` |
| 5 | src/sheet/grantedClassFeatures.ts:73,229,253 | `GrantedFeature.olderSubclass` — subclass record s jiným classSource než třída postavy |
| 5 | src/sheet/featuresTabData.ts:145 | Features skryje `olderSubclass` řádek se jménem class feature téže třídy |
| 30 | src/sheet/ManageExtrasPanel.tsx:83 | výchozí kategorie při otevření: Familiar jen s familiarem, jinak Wild Shape, jinak první |
| L1 | src/spells/knownSpells.ts:83 | „the … feat" přes `featDisplayName` (pickerKey dál ze stored name) |
| L1 | src/sheet/ManageFeatsPanel.tsx:149 | `FeatText` „No text found" přes `featDisplayName`; export kvůli testu |
| L2 | src/index.css:3114 | ≤600 px row header: 76 px, 9 px, letter-spacing 0, bez `overflow-wrap: anywhere` |

## Nález dat (19) — zapsáno v DATA.md
47 cantripů, 28 s `damageInflict`, 2 bez `scalingLevelDice`: Eldritch Blast XPHB (`{@damage 1d10}`, force, beamy jen prózou v „Cantrip Upgrade") a Magic Stone XGE (`{@damage 1d6}` + mod prózou). Oba stejný vzor → oprava platí pro oba (Magic Stone ukáže „1d6 Bludgeoning" bez +mod). Počet beamů do Notes nedán (jen próza, ne levně).

## Testy
- unit: spellActionRowData.test.ts `cantripDamage` (+ Actions row), spellsTabData.test.ts EB Effect, featuresTabData.test.ts F-32a (older vs same edition), ManageExtrasPanel.test.tsx výchozí kategorie, knownSpells.test.ts „Magic Initiate (Cleric)", nový ManageFeatsPanel.test.tsx `FeatText`.
- e2e: nový e2e/logicFixesF32a.spec.ts a–d; e2e/manageSpells.spec.ts:151 očekává nově „Magic Initiate (Cleric) feat".
- Výsledek: typecheck OK; test 185 souborů / 3355 OK; validate-data 175/175; e2e 587/587 (6,9 min — nad 3 min).
- První e2e běh: 2 selhání, opravena: (1) logicFixesF32a a hledal `.sheet__spell-row--cast`, cantrip řádek ji nemá (render byl správně „1d10 Force") → selektor `.sheet__spell-row`. (2) textFixesF31 e: BACKGROUND přetékal o 13 px do první buňky — pod `table-layout: fixed` určuje šířku sloupce první řádek (prázdné `thead td`), `width: 76px` na `th[scope=row]` se ignorovalo → stejná šířka i na `.ability-table thead td:first-child` (jen ≤600 px).

## Rozhodnutí v kódu
- „2014 podtřída" = subclass record, jehož `classSource` ≠ classSource třídy postavy (D343 vzor); shoda jména přesná.
- Skrytý Conquest „Channel Divinity" je wrapper; Conquering Presence a Guided Strike zůstávají vlastními řádky (F-17 a).
- Default Manage Extras se volí jednou při otevření, smazání familiara tab nepřepne.

## Rozhodnuto uživatelem
- Magic Stone zůstává „1d6 Bludgeoning" bez spellcasting modu. Patří do plánovaného průzkumu kouzel, jejichž damage přičítá spellcasting modifier.

## Subagent
Nepoužit.

## Ostatní
CLAUDE.md: přidána sekce „## Subagents" (STEP 0). STATUS.md, DATA.md aktualizovány. Investigační skript scripts/investigate-cantrip-no-scaling-dice.js zatím v pracovním stromu (git clean až po pushi).

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Změněné obrazovky: Spells/Actions (Eldritch Blast), Features & Traits (Paladin Conquest), Manage Extras (Druid), wizard Ability scores na 390 px, Manage Spells / Manage Feats texty.
