# SB-3 — Savant kouzla Wizarda ve spellbooku (D424)

## STEP 1 — místa změn (14, pod limitem ~20)

| # | Soubor | Změna |
|---|---|---|
| 1 | src/spells/subclassSpellChoiceData.ts | `isSavantSubclass` (Abjurer/Diviner/Evoker/Illusionist XPHB) |
| 2 | src/sheet/manageSpellsData.ts | `savantSpellsOf`, `savantLossUnprepares`; `spellbookFill` bere Savant jako už v knize |
| 3 | src/sheet/ManageSpellsPanel.tsx | `spellbook.savant`: řádky v Spellbook se štítkem „Savant“, bez Remove; nepočítají se do knihy pro „Add to spellbook“ |
| 4 | src/sheet/CharacterSheet.tsx ~2053 | Savant volby mimo subclass alwaysPrepared (Spells tab, Actions) |
| 5 | src/sheet/CharacterSheet.tsx ~2781 | Manage Spells: Savant mimo `subclassChoicePicks` a alreadyKnown, předání `savant` |
| 6 | src/sheet/CharacterSheet.tsx ~1971 | volání `spellbookFill` se `subclassSpellChoices` |
| 7 | src/sheet/CharacterSheet.tsx ~3691 | prop `spellbook.savant` |
| 8 | src/creation/CharacterWizard.tsx ~2400 | holdings/alreadyKnown bez Savant, `spellbook.savant` |
| 9 | src/creation/wizardState.ts `setSubclassSpellChoices` | odebraná Savant volba odpřipraví kouzlo (není-li v knize) |
| 10 | src/creation/wizardState.ts `setSubclass` | totéž při změně podtřídy |
| 11 | src/levelUp/levelRemoval.ts | ztracená Savant volba odpřipraví kouzlo + řádek v dialogu |
| 12 | unit testy | manageSpellsData.test.ts, levelRemovalSpellbook.test.ts, wizardState.test.ts |
| 13 | e2e/spellbookSB3.spec.ts (nový) | scénáře a–f |
| 14 | docs | DECISIONS.md D424, STATUS.md, REPORT.md |

Navíc: CharacterSheet.test.tsx — test „Evoker pick always prepared (d6b)“ přepsán na D424 (pick není na kartě, `loadSubclassChosenSpells` se nevolá).

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD ee62d65 — OK.

## Co se změnilo
- `isSavantSubclass` (4 Wizard XPHB podtřídy). `savantSpellsOf` odvozuje Savant kouzla z `subclassSpellChoices`; `savantLossUnprepares` vrací klíče ztracených Savant kouzel, která nedrží uložená kniha ani jiný Savant pick.
- Karta: Savant volby vyřazeny z merge do subclass alwaysPrepared (Spells tab, Actions) i z `subclassChoicePicks`/alreadyKnown v Manage Spells; `spellbook.savant` předán panelu; `spellbookFill` dostává `subclassSpellChoices` → Savant nikdy `migrated`.
- ManageSpellsPanel: Savant řádky v sekci Spellbook (štítek „Savant“, bez Remove), patří do `bookKeys` (žádné „Add to spellbook“ pro ně). Počítadlo „Spellbook: x/N“ počítá jen zápisy běhu → Savant mimo.
- Průvodce: při Savant podtřídě holdings bez subclassChoicePicks, alreadyKnown pro třídní panel bez položek Savant pickeru, `spellbook.savant`. Reducer `setSubclassSpellChoices` a `setSubclass` (větev bez `hadSubclass`) odpřipraví ztracené Savant kouzlo, není-li v `WizardData.spellbook`.
- Remove level: ztracený Savant pick → řádek „Wizard spell: X (no longer prepared)“ vedle „Evoker spell choice: X“.

## Ověření
- typecheck OK; test 193 souborů / 3583 OK; validate-data 177/177 OK.
- lint: jen předchozí error `src/sheet/spellsTabData.ts:229`, nezměněno.
- e2e plná sada 808/808 OK (8,9 min, nad limitem ~3 min). spellbookSB3: a+b+e (jeden test), c, d, f — 4/4 OK.
- Unit: manageSpellsData.test (fill se Savant, savantSpellsOf, savantLossUnprepares), levelRemovalSpellbook.test (E), wizardState.test (E: Edit pickeru, změna podtřídy, Lore beze změny). B pokryto e2e a + savantSpellsOf (panel nemá unit testy).

## Rozhodnutí v kódu
- Savant kouzlo zároveň uložené v knize (např. dříve `copied`) se ukáže jednou se štítkem Savant a bez Remove.
- Kouzlo připravené jen přes Savant zůstává připravené, když ho drží uložená kniha nebo jiný Savant pick.
- Savant picker dál ukazuje u kouzla připraveného třídou poznámku „already have it from the Spells step“ (vlastní volba zůstává volitelná) — kosmetické, neřešeno.

## Subagent
Nepoužit.

## Otázky pro uživatele
- Délka plné e2e sady (8,9 min).
- Lint error ve spellsTabData.ts (předchozí) stále otevřený.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots. Změněné obrazovky: karta → Manage Spells u Wizarda Abjurer/Diviner/Evoker/Illusionist (sekce Spellbook se štítkem „Savant“ vedle Prepare); karta → Spells tab (Savant kouzla jen když připravená); průvodce krok Spells u těchto podtříd; dialog Remove level (řádek „Wizard spell: X (no longer prepared)“).
