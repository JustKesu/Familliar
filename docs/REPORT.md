# F-HLSB — opravy z review R-HLSB, upozornění na Savant kouzla (D426)

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD bbcc240 — OK.

## STEP 1 — místa změn (14, bez rozdělení)

| # | Soubor | Místo | Bod |
|---|---|---|---|
| 1 | src/creation/wizardState.ts | `spellbooksAfterRun` (nově export) + volání v `saveCharacter` | A |
| 2 | src/levelUp/levelRemoval.ts | filtr `spellChoices` podle `lostBookKeys` | B |
| 3 | src/levelUp/levelRemoval.ts | `savantSpellsOf` u `savantLossUnprepares` a `prunedBookPicks` | C |
| 4 | src/sheet/manageSpellsData.ts | `spellbookFill` (nový volitelný parametr `classes`) | C |
| 5 | src/sheet/CharacterSheet.tsx | volání `spellbookFill` v efektu | C |
| 6 | src/levelUp/levelRemoval.ts | odebrání stylu boje → `Fighting style cantrip: <jméno>` | D |
| 7 | src/storage/validate.ts | `describeSpellbooksError` | E |
| 8 | src/spells/wizardBookPicks.ts | `prunedBookPicks` | F |
| 9 | src/storage/settingsStore.ts | `dismissedSavantNotices`, `dismissSavantNotice` | G |
| 10 | src/sheet/manageSpellsData.ts | nová `unpreparedSavantSpells` | G |
| 11 | src/sheet/CharacterSheet.tsx | upozornění v `notices` Spells tabu + stav | G |
| 12 | testy (unit) | wizardState, levelRemovalSpellbook, manageSpellsData, characterStore, wizardBookPicks, settingsStore; upraveny ThemeToggle, CharacterSheet (D424 test) | A–G |
| 13 | e2e/reviewFixesHLSB.spec.ts | nový | a–f |
| 14 | docs/DECISIONS.md (D426), docs/STATUS.md, docs/REPORT.md | | |

## Co se změnilo

- A: `spellbooksAfterRun(existing, data, classes, levelUpTo, subclassSpellChoices)`. Level up jiné třídy než Wizard → `existing?.spellbooks` beze změny. Jinak Savant = `savantSpellsOf(perClass.subclassSpellChoices, Wizard, XPHB, wizard.subclass)`, tj. uložené záznamy po sloučení s picky běhu.
- B: lost `level`-k zápis, jehož kouzlo drží zbývající Savant pick (podtřída po odebrání), zůstane v `spellChoices`; „Spellbook: X“ v dialogu zůstává (uložený zápis odchází).
- C: `savantSpellsOf` se v Remove level volá s podtřídou po odebrání, ve `spellbookFill` s podtřídou z `character.classes`.
- D: dialog Remove level jmenuje `Fighting style cantrip: <jméno>` u obou cest (úroveň stylu i odebrání třídy).
- E: validátor odmítne druhou položku `spellbooks` pro stejnou třídu („spellbooks has more than one entry for Wizard“) a kouzlo dvakrát v jedné knize (klíč jako `spellIdentityKey`: jméno lowercase, zdroj uppercase).
- F: `prunedBookPicks` má příznak změny per kniha.
- G (D426): rámeček nad seznamem kouzel, třída `sheet__inventory-notice` (stávající upozornění Inventory tabu, `InventoryTab.tsx:128`), `role="status"`, `aria-label="Savant spells notice"`. Tlačítko „Manage Spells“ (aria-label „Manage Spells for Savant spells“, jen když lze spravovat kouzla) otevře drawer, „Dismiss“ uloží id postavy do `familliar:settings.dismissedSavantNotices`. Nepřipravené = Savant kouzlo aktuální podtřídy, které není pick Wizarda ani Mastery/Signature/class grant.

## Ověření

- typecheck OK; test 194 souborů / 3606 testů OK; validate-data 177/177 OK.
- lint: 1 error `src/sheet/spellsTabData.ts:229` rules-of-hooks (pre-existing, známý bod h), jinak warningy; výstup byl zkrácený, v mých souborech jsem žádný nález neviděl.
- e2e: nový soubor 6/6. Celé e2e 820 passed, 1 failed (7,8 min): `subclassSpellcastingPrereq.spec.ts:103` SC-1 a (Eldritch Knight, timeout 60 s na zakázaném Next). S touto změnou nesouvisí; samostatný běh souboru 4/4 passed → timeout pod zátěží paralelního běhu.
- Scénáře: a) `F-HLSB a` (Wizard 18 Evoker / Fighter 1 → Fighter 2, Mastery na Magic Missile zůstane), b) `F-HLSB b`, c) `F-HLSB c`, d) `F-HLSB d`, e) `F-HLSB e`, f) `F-HLSB f`.

## Rozhodnutí v kódu

- A: místo vrácení `existing` při Editu s aktivní jinou třídou se bere Savant z uložených záznamů. Doslovné „vrátit beze změny“ by u multiclass Editu zahodilo úpravy knihy udělané před přepnutím třídy (`WizardData.spellbook` drží knihu přes přepnutí, D423). Beze změny se vrací jen u level upu jiné třídy.
- c) e2e: import souboru se dvěma knihami se odmítne chybou (import nevytváří kartu); karta Damaged se ukáže u takového záznamu v úložišti. Scénář testuje obojí.
- `spellbooksAfterRun` je exportovaná kvůli unit testu.
- Tlačítko v upozornění má vlastní aria-label, aby se nekřížilo s `getByRole('button', { name: 'Manage Spells', exact: true })` v 11 e2e souborech.

## Subagent

Nepoužit.

## Otázky pro uživatele

Žádné nové.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Spells tab Wizarda Savant (nový rámeček s upozorněním), dialog Remove level (řádky „Fighting style cantrip“).
