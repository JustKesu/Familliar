# WM-1b — Wizard Spell Mastery a Signature Spells v Manage Spells (D425, schema 72)

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD ae1d942 — OK.

## STEP 1 — místa změn (17, pod limitem ~25)

| # | Soubor | Změna |
|---|---|---|
| 1 | src/storage/character.ts | `CharacterSpellbook.mastery?`, `signature?`; CURRENT_SCHEMA_VERSION 72 |
| 2 | src/storage/migrations.ts | 71 → 72 jen tag |
| 3 | src/storage/validate.ts `describeSpellbooksError` | validace mastery/signature (pole, max 2, name+source) |
| 4 | src/storage/validate.ts `toCharacterSpellbooks` | přenos polí |
| 5 | src/spells/wizardBookPicks.ts (nový) | úrovně 18/20, způsobilost, limity, aktivní picky, prořezání, poznámka „Choose in Manage Spells“ |
| 6 | src/sheet/manageSpellsData.ts `withSpellbookSpells` | zachová mastery/signature záznamu |
| 7 | src/sheet/ManageSpellsPanel.tsx | toggly „Mastery“/„Signature“ (aria-pressed), řádek stavu nad seznamem |
| 8 | src/sheet/CharacterSheet.tsx ~2292 | aktivní picky jako class grant Wizarda (`classGrantInfo`) → Spells tab, Actions, use box |
| 9 | src/sheet/CharacterSheet.tsx ~2830 | totéž v holdings Manage Spells (always prepared, mimo limit) |
| 10 | src/sheet/CharacterSheet.tsx ~3730 | props panelu; Remove from spellbook prořeže picky |
| 11 | src/creation/wizardState.ts `spellbooksAfterRun` | Edit: prořezání picků (kniha + Savant, úroveň) |
| 12 | src/levelUp/levelRemoval.ts | prořezání při Remove level + řádky „Spell Mastery: X“ / „Signature Spells: X“ |
| 13 | src/creation/review/ReviewStep.tsx (+ index.css `.review__feature-note`) | poznámka u Spell Mastery / Signature Spells |
| 14 | unit testy | wizardBookPicks.test.ts (nový), levelRemovalSpellbook.test.ts, migrations.test.ts, characterStore.test.ts, ReviewStep.test.tsx |
| 15 | e2e/levelOrder.spec.ts, e2e/stableIds.spec.ts, e2e/spellbookSB1.spec.ts | schemaVersion 72 (SB1 má také pevné 71 — navíc proti zadání) |
| 16 | e2e/spellMasteryWM1b.spec.ts (nový) | scénáře a–e |
| 17 | docs | DECISIONS.md D425, STATUS.md, REPORT.md |

## Co se změnilo
- Uložení na záznamu knihy (`spellbooks[].mastery`, `.signature`). `withSpellbookSpells` je přenáší; zastaralé maže `prunedBookPicks` (kniha = uložené + Savant, úroveň Wizarda) na třech místech: Remove from spellbook (karta), Edit (`spellbooksAfterRun`), Remove level (s řádky do dialogu).
- Karta navíc počítá jen `activeBookPicks` (v knize a úroveň ≥ 18/20), takže ani neprořezaný zbytek se nezobrazí.
- Zobrazení: picky se přidávají k class always-prepared grantům Wizarda (stejná cesta jako D192/D193): Mastery `usage: atWill`, Signature `onceFreePerShortOrLongRest` → existující free-cast counter `spell:class:Wizard:<spell>|XPHB`, `shortRest: 'all'`, Long Rest reset. V Manage Spells jsou to „Always prepared“ řádky; pick, který je zároveň grant, je `alsoGranted` a nepočítá se do „Prepared“.
- Způsobilost Mastery: úroveň 1 nebo 2 a `time` obsahuje `{number: 1, unit: 'action'}`; Signature: úroveň 3 (casting time se nehlídá, PHB ho nevyžaduje).
- Review level upu: `NewFeatureRow` dostal `note`; u Wizard|XPHB „Spell Mastery“ / „Signature Spells“ text „Choose in Manage Spells“.

## Ověření
- typecheck OK; test 194 souborů / 3595 OK; validate-data 177/177 OK.
- lint: jen předchozí error `src/sheet/spellsTabData.ts:229`, nezměněno.
- e2e spellMasteryWM1b a–e 5/5 OK. Plná sada 813/813 OK (8,8 min, nad limitem ~3 min).
- Unit: způsobilost (action/reaction/bonus, úrovně 17/18/19/20), limity (1 na úroveň, 2 Signature), stavové řádky, aktivní picky, Remove from spellbook, Savant drží pick, Remove level 18→17 a 20→19, validace a migrace, poznámka v Review (render test; e2e level upu 17→18 nepřidán — tah přes Spells step s 2 zápisy do knihy a plným Prepared je drahý).

## Rozhodnutí v kódu
- Štítek Signature na Spells tabu je stávající text vzoru free cast („1/short or long rest (no slot)“, krátce „1/SR“), ne doslova „1 free cast“ — zadání chtělo držet existující vzor.
- Provenance řádku: „always prepared (Wizard) — at will“ (stávající formát class grantu).
- Toggle u Savant kouzla funguje jen když existuje uložený záznam knihy (kniha jen ze Savant kouzel u Wizarda 18 nevzniká).
- Edit přes průvodce picky nemění, jen prořeže zastaralé.

## Subagent
Nepoužit.

## Otázky pro uživatele
- Má Signature na kartě nést text „1 free cast“ místo stávajícího „1/short or long rest (no slot)“? Znamenalo by to nový `SpellUsage` nebo výjimku ve formátování.
- Délka plné e2e sady (dříve 8,9 min) a lint error ve spellsTabData.ts trvají.

## Manual browser check for the user
Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: karta → Manage Spells u Wizarda 18+ (sekce Spellbook: řádek „Spell Mastery: x/2 chosen“ / „Signature Spells: x/2 chosen“, tlačítka Mastery/Signature vedle Remove a Prepare; Prepared Spells s novými „Always prepared“ řádky); karta → Spells tab (at will / 1/SR řádky s use boxem); Actions tab; dialog Remove level (řádky „Spell Mastery: X“); level up Review „What's new“ (poznámka „Choose in Manage Spells“).
