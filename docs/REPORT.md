# REPORT — SB-1 (zastaveno před editací: nerozhodnutá otázka)

HEAD na startu 6fe94ee (F-HL) — OK. Setup: fetch, merge --ff-only (up to date), npm ci, e2e:install proběhly. Kód nezměněn; commit obsahuje jen tento report.

## STEP 1 — plánovaná místa (~18, pod limitem 25)

| Soubor | Místo | Změna |
|---|---|---|
| src/storage/character.ts | ~212 Character, ~909 typy, ~1155 | `spellbooks?`, `CharacterSpellbook`, `SpellbookOrigin`; CURRENT_SCHEMA_VERSION 71 + komentář |
| src/storage/migrations.ts | ~629 | krok 70→71 |
| src/storage/validate.ts | vedle genieKind ~1409; withRepairedFields ~1505 | validace `spellbooks` (jen Wizard\|XPHB); repair chybějících pick |
| src/storage/characterStore.ts | ~263/414/479 toStoredCharacter; nový setter vedle setSpellChoices ~932 | průchod pole + `setSpellbook` |
| src/sheet/manageSpellsData.ts | nové funkce | řádky knihy, add/remove/copy helpery |
| src/sheet/ManageSpellsPanel.tsx | ClassSpellsManager ~91, `offered` ~155, tlačítko ~78 | sekce „Spellbook (N)“, „Add to spellbook“, „Remove from spellbook“ |
| src/sheet/CharacterSheet.tsx | wiring ~2765 | předání knihy a setteru |
| testy | migrations.test, validate/repair test, manageSpellsData.test | unit |
| e2e | spellbookSB1.spec.ts (nový), levelOrder.spec.ts, stableIds.spec.ts | scénáře a–g, schemaVersion 71 |
| docs | DECISIONS.md D422, STATUS.md, REPORT.md | |

## Otázka pro uživatele (blokuje B a C)

Migrace (migrations.ts) i load-time repair (withRepairedFields) běží **synchronně** při čtení localStorage. Úroveň kouzla je jen ve spells.json, který se načítá **asynchronně** (`loadDataFile`). Úložiště tedy nedokáže odlišit triky od levelovaných pick ve `spellChoices` — „leveled picks → book“ v B a C nejde napsat tak, jak je zadáno.

Možnosti:
1. **Oprava na kartě (doporučuji):** krok 70→71 jen přepíše verzi; doplnění chybějících levelovaných pick do knihy (origin `migrated`) udělá karta po načtení spells.json a uloží přes store. Data nikdy neobsahují triky v knize. Postava, jejíž karta nebyla otevřena, má knihu v úložišti prázdnou (export před otevřením karty ji neponese).
2. **Kniha = uložené ∪ levelované picky (odvozeně):** nic se nezapisuje, Manage Spells dopočítá `migrated` položky z pick při zobrazení. Migrace jen tag, repair zbytečný. Uložená data `migrated` položky nikdy neobsahují; „Remove from spellbook“ na migrated položce pak = odebrání picku.
3. **Kopírovat vše synchronně, triky ignorovat:** migrace i repair zkopírují všechny Wizard picky (i triky) s origin `migrated`; zobrazení a validace triky v knize přeskočí. Odpovídá zadání doslova, ale v datech budou triky, což odporuje pravidlu „cantrips are not in the book“.

Dialog s otázkou byl v session odmítnut, proto STOP podle CLAUDE.md „Undecided questions“. Po rozhodnutí lze SB-1 spustit znovu s touto tabulkou.

## Ověření
Nic nespuštěno (žádná změna kódu).

## Subagent
Nepoužit.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots. Změněné obrazovky: žádné.
