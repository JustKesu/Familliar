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

## Nález 6c — ZASTAVENO, nic nenapsáno
Požadovaný výsledek („po odebrání levelu zase dvě kopie“) žádná reálná cesta v aplikaci nedává. D345 bod 5:
„Remove level výměnu nevrací“ — náhrada přebírá level stamp vyměněné kopie (`inheritSwapStamp`), `levelRemoval`
maže jen podle stampu (`withoutLevel`). Po swapu Agonizing Blast → X na levelu N a odebrání levelu N zůstane
1× Agonizing Blast + X. Test s výsledkem „dvě kopie“ by vymýšlel chování proti D345.
Možnosti pro uživatele: (a) test současného chování podle D345.5 (1 kopie + náhrada, nic dalšího neztraceno);
(b) nové rozhodnutí, že Remove level swap vrací — změna kódu i D345; (c) nechat bez testu.

## Ověření
- typecheck OK; test 188 souborů / 3441 testů OK; validate-data 177/177 OK; e2e 679/679 OK (3,7 min, nad 3 min).

## Rozhodnutí v kódu
- Duplicita se porovnává přesným jménem (jako dosavadní validátor), ne case-insensitive.
- Zahozená kopie se do `dropped`/upozornění nehlásí — čtení je tiché, stejně jako ostatní opravy při čtení.

## Manual browser check for the user
Žádná — beze změny UI.
