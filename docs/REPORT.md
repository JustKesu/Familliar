# F-WM — Spell Mastery at will u prepared picku, layout řádku Spellbook

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD 35da381 — OK.

## Co se změnilo
- A) Příčina: `combineSpellEntries` sloučil pick a Mastery grant správně do jednoho záznamu (chosen + classOrigins Wizard + usage atWill). Ztrácelo se až v `spellsTabActionSections` (src/sheet/spellsTabData.ts): label řádek vznikal jen při `!cast && counterKeys.size === 0`; atWill nemá counter, takže vedle CAST zmizel. Signature fungovala, protože má counter → USE řádek. Oprava: pokud záznam má CAST nebo USE a mezi usages je `atWill`, přidá se label řádek „At will“ v úrovni kouzla. Pravidlo podle druhu usage, ne podle jména.
- Actions: tabulka útoků (`spellActionRows`) má jeden řádek na záznam a usage nezobrazuje; nic se neměnilo. Magic Missile ani Shatter v ní nejsou relevantní rozdílem (CAST/AT WILL řádky jsou jen sekce Spells).
- B) `ManagedSpellRow` dostal `wrapAction`; řádek Spellbook ho zapne jen když má toggle Mastery/Signature A Remove (tj. tři tlačítka). Pak `.manage-spells__line--wrap`: flex-wrap, name-cell `flex: 1 1 10em; min-width: 10em`, tlačítka ve `span.manage-spells__actions` (`flex: 0 0 auto; margin-left: auto; max-width: 100%`, uvnitř flex-wrap vpravo), šipka `order: 1`, skupina `order: 2` → šipka zůstává na prvním řádku, tlačítka pod jménem vpravo. Řádky s 1–2 tlačítky mají beze změny původní třídu a DOM.

## Ověření
- typecheck OK; test 194 souborů / 3597 OK (nový unit: pick + Mastery grant → `CAST` + `LABEL At will`).
- lint: jen předchozí error `src/sheet/spellsTabData.ts:229` (`useLabel`), nezměněno.
- validate-data 177/177 OK.
- e2e spellMasteryWM1b 7/7 OK (nové f, g). Plná sada 815/815 OK (9,0 min, nad limitem ~3 min).
- g) nebyl ověřen proti stavu před opravou (test nebyl spuštěn na starém CSS).

## Rozhodnutí v kódu
- Zalamovací layout jen pro řádky se třemi tlačítky (ne pro všechny řádky Spellbook), aby 1–2tlačítkové řádky zůstaly pixelově stejné — ve 440px draweru by min-width 10em zalomila i řádky Remove + Prepare.
- Řádek „At will“ se přidá i vedle USE řádku (pick bez slotů s counted grantem + atWill) — v datech se zatím nevyskytuje.

## Subagent
Nepoužit.

## Otázky pro uživatele
- Žádné nové. Délka plné e2e sady a lint error ve spellsTabData.ts trvají.

## Manual browser check for the user
Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: karta → Spells tab u Wizarda 18+ (Mastery kouzlo, které je i prepared pick: CAST + AT WILL řádek); karta → Manage Spells → Spellbook u Wizarda 18+ (řádky s Mastery/Signature + Remove + Prepare: tlačítka pod jménem vpravo, šipka na prvním řádku).
