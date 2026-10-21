# REPORT — TGS2-1: extrakce Griffon's Saddlebag 2 (D365)

HEAD po `git merge --ff-only origin/main`: e49066d (podmínka splněna). homebrew/griffons-saddlebag-2.json existuje, D365 dřív neexistovalo.

## Co se změnilo
- scripts/extract-data.js: `GriffonsSaddlebag2` v ALLOWED_SOURCES; `HOMEBREW_FILES`, `HOMEBREW_KEEP` a `loadHomebrew()` (whitelist, classSource podtřídy PHB→XPHB, `ability` pryč, Geleton size V→["S","M"], tagy spell/condition/item PHB|bez zdroje→XPHB, `additionalSpells` "x|PHB"→XPHB). Homebrew se přidá do `raw` v extractClasses a do rawSpecies v extractSpecies; filtr druhů má klauzuli pro source GriffonsSaddlebag2 (rasy nemají `edition`). Chybějící jméno z whitelistu = throw.
- scripts/validate-data.js, src/subclass/subclassData.ts: allowlist + GriffonsSaddlebag2. EXPECTED_COUNTS: species +2, classes +7, subclass-features 734→780 (komentáře D365).
- data/: classes.json +7 podtříd, subclass-features.json +46 záznamů, species.json +2. Jiné soubory v data/ beze změny (diff jen přidání).
- CLAUDE.md pravidlo 1: + `homebrew/`. DATA.md nová sekce „Homebrew: The Griffon's Saddlebag, Book 2“, STATUS.md, DECISIONS.md D365 (text podle zadání).
- scripts/investigate-tgs2.js: cesta na homebrew/, nový režim `names`.

## Počty
| kategorie | přidáno |
|---|---|
| podtřídy | 7 |
| prvky podtříd | 46 (0 dangling) |
| druhy | 2 |
| tagy → XPHB | 38 (0 bez XPHB cíle) |
| additionalSpells → XPHB | 15/15 |

Join: všech 7 podtříd se spojilo, žádná kolize jmen (validace: no duplicate, 750 referencí resolve). Syrový markup: žádný nový nález; `{@action grapple}` a `{@action Use an Object}` zůstaly dle zadání (nemají XPHB cíl).

## Ověření
- validate-data 177/177 PASS; typecheck OK; test 186 souborů / 3383 testů PASS; e2e 608 PASS (2.0 min).
- e2e/tgs2Extraction.spec.ts: a) krok Species má Etherean|GriffonsSaddlebag2 a Geleton|GriffonsSaddlebag2; b) seed Barbarian 3 Path of the Infernal (schema 61) — Features & Traits ukazují Hellborn a Hellfire Claw, ne Infernal Warrior; c) level up Fighter 2→3 nabízí Steel Hawk.

## Rozhodnutí / nálezy
- Jméno v souboru je „College of Mercantile“, ne „College of the Mercantile“ jako v D365 → whitelist používá jméno ze souboru (zadání: „exact names as found in the file“). Text D365 nechán podle zadání; případnou opravu textu rozhodne uživatel.
- XPHB cíle tagů se hledají ve zdrojových 5etools souborech (spells-xphb, conditionsdiseases, items + items-base), ne v data/ — extrakce položek a stavů běží až po třídách; XPHB záznamy jsou v data/ všechny.
- Odchylka od nebezpečí z průzkumu: e2e reviewFixesM10 (počítá řádky „Channel Divinity“) prošel.

## Subagent
Nepoužit.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: wizard krok Species (2 nové druhy), výběr podtřídy ve wizardu a level-upu (Barbarian, Bard, Fighter, Monk, Paladin, Ranger, Rogue), záložka Features & Traits u těchto podtříd.
