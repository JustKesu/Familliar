# SB-1 — Wizard spellbook: úložiště, doplnění na kartě, Manage Spells (D422, schema 71)

Setup: `git merge --ff-only origin/main` odmítnut („unrelated histories“ — lokální větev `claude/keen-ptolemy-pntid6` měla mělkou starou historii). Vyřešeno `git reset --hard origin/main` (pracovní strom čistý, plánovací commit f9c422c zůstává na origin/claude/keen-ptolemy-pntid6). HEAD na startu 6fe94ee — OK. npm ci, e2e:install proběhly.

## STEP 1 — aktualizovaná tabulka (19 míst, pod limitem 25)

| Soubor | Změna |
|---|---|
| src/storage/character.ts | `spellbooks?`, `CharacterSpellbook`, `CharacterSpellbookSpell`, `SpellbookOrigin`; CURRENT_SCHEMA_VERSION 71 |
| src/storage/migrations.ts | krok 70→71, jen tag |
| src/storage/validate.ts | `describeSpellbooksError` (jen Wizard\|XPHB, origin level 1–20 / copied / migrated), volání v describeCharacterError, `toCharacterSpellbooks` v toCharacter |
| src/storage/characterStore.ts | `CharacterCreateInput.spellbooks`, buildCharacter, nový `setSpellbooks(id, books, spellChoices?)` (jeden zápis) |
| src/creation/wizardState.ts | saveCharacter: `spellbooks: existing?.spellbooks` (Edit/level up knihu nesmažou; jediný řádek, krok Spells netknut) |
| src/CharacterManager.tsx | `handleEditSpellbooks` + prop `onEditSpellbooks` |
| src/sheet/manageSpellsData.ts | `hasSpellbook`, `spellbookSpellsOf`, `withSpellbookSpells`, `spellbookFill` |
| src/sheet/ManageSpellsPanel.tsx | volitelný prop `spellbook`; sekce „Spellbook (N)“, „Add to spellbook“, „Remove from spellbook“ |
| src/sheet/CharacterSheet.tsx | prop `onEditSpellbooks`, efekt doplnění (ref proti opakování), wiring `spellbook` u ClassSpellsManager |
| testy | migrations.test (70→71 + schema čísla), characterStore.test (spellbooks), manageSpellsData.test (spellbookFill) |
| e2e | spellbookSB1.spec.ts (nový, a–g), levelOrder.spec.ts, stableIds.spec.ts (71) |
| docs | DECISIONS.md D422, STATUS.md, REPORT.md |

## Co se změnilo
- Remove level jde přes `characterUpdateInput` (spread Character), takže knihu přenáší automaticky díky novému poli v CharacterCreateInput.
- Fill: `spellbookFill` vrací null, když nic nechybí → zápis jen při změně; navíc `useRef` s posledním zkoušeným objektem postavy, aby odmítnutý zápis neběžel v každém renderu.
- Kreační průvodce používá ClassSpellsManager bez propu `spellbook` → beze změny (Prepare přímo). Knihu postavě z průvodce doplní karta (e2e f).

## Ověření
- typecheck OK; test 191 souborů / 3563 testů OK; validate-data 177/177 OK.
- lint: 1 error `src/sheet/spellsTabData.ts:229` (rules-of-hooks, `useLabel`) — soubor tímto úkolem nezměněn, chyba je předchozí; ostatní jen warningy.
- e2e: 799 testů, 798 OK v plném běhu (8,6 min — přes limit ~3 min); `subclassSpellcastingPrereq.spec.ts` SC-1 a timeout (Next zakázaný v kroku průvodce Fighter EK, mimo dosah změn), po samostatném opakování 4/4 OK. spellbookSB1 a–g OK.

## Rozhodnutí v kódu
- Validace knihu nespojuje s držením třídy Wizard (stačí className/classSource) — Edit, který Wizarda změní na jinou třídu, tak uložení neodmítne; kniha zůstane ležet.
- Pick s neznámou úrovní (není ve spells.json) se do knihy nepřidá.
- „Add to spellbook“ není blokovaný poznámkou „already known“ ani plným počítadlem; Prepare v sekci Spellbook ano (stejně jako dnes).
- Sekce Spellbook řadí podle úrovně a jména; origin `level` tlačítko Remove nemá.

## Subagent
Nepoužit.

## Otázky pro uživatele
- Kniha osiřelá po změně třídy v Edit (viz výše) — mazat ji, nebo nechat pro případ návratu? Zatím zůstává.
- Lint error ve spellsTabData.ts je předchozí; opravit v samostatném úkolu?

## Manual browser check for the user
none - the planning chat checks the looks from screenshots. Změněné obrazovky: karta → Spells → Manage Spells u Wizarda (nová sekce „Spellbook (N)“, tlačítka „Add to spellbook“ a „Remove from spellbook“).
