# REPORT — F-CB2: opravy a testy z review R-CB (D385)

Setup: `git fetch` + `git merge --ff-only origin/main` → „Already up to date“, HEAD 291df35.

## Změny
- Nález 4: skript `scripts/fcb2-repeatable-sources.js` — data/ i public/data/ `optional-features.json` (120 záznamů)
  mají čtyři opakovatelné invokace jen jako XPHB `EI`. Kód beze změny; zjištění zapsáno do DATA.md
  („Option names across books“).
- Nález 3 (D385): `describeOptionalFeatureChoicesError` už duplicitní neopakovatelnou EI neodmítá;
  `toCharacterOptionalFeatureChoices` (validate.ts) nechá první kopii a další zahodí. Opakovatelné kopie zůstávají.
  Platí pro uložení i import (obojí jde přes `toCharacter`).
- Testy (characterStore.test.ts): D385 čtení (Eldritch Mind 2× → 1×, Agonizing Blast 2× → 2×, nic „unreadable“);
  export → import custom backgroundu (`source 'custom'`, `abilityChoices`, `originFeatOverride`) a familiara
  s `chainMasterForm`/`chainMasterDamage` — celý záznam kromě id shodný.
- optionSwap.test.ts: test validátoru přepsán — opakovaná Eldritch Mind teď projde validací (D385).
- DECISIONS.md D385, DATA.md, STATUS.md (I-1 řádek + F-CB2).

## Nález 6c — test podle D345 bodu 5 (volba uživatele)
Původně zadaný výsledek („zase dvě kopie“) odporuje D345.5 (Remove level výměnu nevrací; náhrada přebírá stamp
vyměněné kopie). Uživatel zvolil test současného chování. levelRemoval.test.tsx „D345.5 + D382“: Warlock 4
[Agonizing Blast, Agonizing Blast(2), Armor of Shadows(2)] → level 5 přes `swapOut` + `inheritSwapStamp`
(Agonizing Blast → Misty Visions, ta dědí stamp 2) + Pact of the Blade(5), Eldritch Smite(5) → Remove level 5.
Výsledek: 1× Agonizing Blast + Misty Visions(2) + Armor of Shadows(2), jinak shodný s Warlockem 4
(`toMatchObject`; removal navíc zapisuje prázdná pole), odebrány jen dvě volby s levelem 5, žádná kaskáda.

## Ověření
- typecheck OK; test 188 souborů / 3442 testů OK; validate-data 177/177 OK; e2e 679/679 OK (3,8 min, nad 3 min).
- Commit 86f11d6 (nálezy 3, 4, 6b) + druhý commit s testem 6c.

## Rozhodnutí v kódu
- Duplicita se porovnává přesným jménem (jako dosavadní validátor), ne case-insensitive.
- Zahozená kopie se do `dropped`/upozornění nehlásí — čtení je tiché, stejně jako ostatní opravy při čtení.

## Manual browser check for the user
Žádná — beze změny UI.
