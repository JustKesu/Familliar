# SB-2 — Wizard spellbook v průvodci, level up, Edit a Remove level (D423)

## STEP 1 — místa změn (17, pod limitem 25)

| Soubor | Změna |
|---|---|
| src/creation/wizardSpellbook.ts (nový) | typ položky průvodce, max úroveň kouzla Wizarda, počet dlužných zápisů, greedy přiřazení origin, stav běhu, převod na CharacterSpellbookSpell |
| src/creation/wizardSpellbook.test.ts (nový) | přiřazení origin (proveditelné / neproveditelné), stav |
| src/creation/wizardState.ts | WizardData.spellbook; podmínka spellbookMode; isStepComplete 'spells'; seed z postavy; akce setSpellbook; saveCharacter zapisuje knihu |
| src/creation/CharacterWizard.tsx | stepConditions.spellbookMode; krok Spells předává `spellbook` + důvod blokace |
| src/sheet/ManageSpellsPanel.tsx | prop spellbook: removable, counter, maxSpellLevel; počítadlo „Spellbook: x/N“; pořadí tlačítek |
| src/index.css | pevná šířka Prepare/Unprepare (PickButton) |
| src/levelUp/levelGains.ts | krok spells u Wizarda vždy „adds“ (část „Spellbook spells“) |
| src/levelUp/levelRemoval.ts | odebrání položek origin level k + unprepare, řádky v seznamu ztrát |
| src/levelUp/levelRemovalSpellbook.test.ts (nový) | Remove level a kniha |
| e2e/spellbookSB2.spec.ts (nový) | scénáře a–f |
| docs | DECISIONS.md D423, STATUS.md, REPORT.md |

Navíc (úprava existujících testů, které procházejí Wizardovým krokem Spells): CharacterWizard.spells.test.tsx, e2e spellbookSB1 f, frhof D201 b, scc D199 a, multiclassEndToEnd (`fillSpells` plní nejdřív knihu), multiclassEntry (`fillSpells` totéž).

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD f0175c1 — OK.

## Co se změnilo
- `wizardSpellbook.ts`: `WizardSpellbookEntry` (origin `null` = zapsáno v tomto běhu), `wizardMaxSpellLevel` = min(9, ⌈L/2⌉), `spellbookEntriesOwed`, `assignSpellbookOrigins` (greedy: seřazené úrovně kouzel ↔ sestupné kapacity úrovní Wizarda), `spellbookRunStatus` (důvod blokace), `resolveSpellbookEntries` (create → greedy, levelUp → level k, edit → copied).
- wizardState: `WizardData.spellbook?` (osa postavy, seed z `character.spellbooks`), akce `setSpellbook` (volitelně i spellChoices při odpřipravení), podmínka `spellbookMode` (jen ji předává UI → testy bez ní beze změny), kontrola v `isStepComplete('spells')`; `spellbooksAfterRun`: knihu zapíše, když postava drží Wizard|XPHB a průvodce knihu nesl, jinak `existing.spellbooks`.
- ManageSpellsPanel: prop `spellbook` + `removable`, `counter`, `maxSpellLevel`; `onChange` dostává i přidané kouzlo s úrovní (`added`); „Remove from spellbook“ před Prepare; PickButton má třídu `manage-spells__button--pick` (width 9em).
- levelGains: část „Spellbook spells“ (2, resp. 6 při k = 1) → krok Spells se u Wizarda při level upu ukáže vždy (i Wizard 12).
- levelRemoval: zápisy s origin `level` = k pryč + odpřipravení, řádky „Spellbook: X“ a „Wizard spell: X (no longer prepared)“ v dialogu; koncentrace přes `droppedSpells`.

## Ověření
- typecheck OK; test 193 souborů / 3574 OK; validate-data 177/177 OK.
- lint: jen předchozí error `src/sheet/spellsTabData.ts:229` (rules-of-hooks), nezměněno.
- e2e plná sada: 797 OK, 7 padlo (všechny procházely Wizardovým krokem Spells bez knihy — očekávané); po úpravě testů opakovány celé soubory multiclassEndToEnd, multiclassEntry, scc, frhof, spellbookSB1: 34/34 OK. spellbookSB2 a–f 5/5 OK. Plná sada trvá 14,9 min (přes limit ~3 min).

## Rozhodnutí v kódu
- „Add to spellbook“ zakázané při plném počítadle (create/level up) a nad max úrovní kouzla (spec říkala jen počítadlo).
- Max úroveň kouzla podle tabulky Wizarda (vzorec), ne podle multiclass slotů.
- Tvorba: kniha zůstává při změně třídy/úrovně (nemaže se); uloží se jen pro Wizarda.
- Edit: odebrat lze zápisy z tohoto běhu a non-`level` zápisy (jako karta).
- Wizard odebraný úplně (multiclass, úroveň 1): odejdou zápisy origin 1, copied/migrated zůstanou jako osiřelá kniha (D422).

## Subagent
Nepoužit.

## Otázky pro uživatele
- Délka plné e2e sady (14,9 min) — rozdělit/paralelizovat?
- Lint error ve spellsTabData.ts (předchozí) stále otevřený.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots. Změněné obrazovky: průvodce → krok Spells u Wizarda (tvorba, level up, Edit: sekce Spellbook, počítadlo „Spellbook: x/N“, důvod blokace pod seznamem); karta → Manage Spells (pevná šířka Prepare/Unprepare, „Remove from spellbook“ vlevo od nich); dialog Remove level (řádky Spellbook).
