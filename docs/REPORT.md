# REPORT — F-RB (opravy z review R-RB, nálezy 1–3)

Setup: `git fetch`, `git merge --ff-only origin/main` → „Already up to date“, HEAD `0d0f07a`. Větev main.

## Co se změnilo
- **Nález 1** — `otherFeatureLanguageNames` (src/languages/classFeatureLanguages.ts): jazyky z grantů s jiným `grantedBy`. Použito v `FeatureLanguageSlots.tsx` (počet slotů) a `wizardState.ts` `isStepComplete` case `languages`. D392 drží: existující Hellborn pick dál drží slot (`max(…, picks.length)`).
- **Nález 2** — `MasteryPicker.tsx`: hodnota v `value` mimo pool se vykreslí jako vybraná („no longer eligible“), jde odškrtnout, key `stale|<name>`. Nikdy se nezahazuje automaticky. D396 v DECISIONS.md.
- **Nález 3** — `setSubclass` (wizardState.ts): `ownSources` doplněno o `grantedBy` jazykových grantů s `subclass` dané třídy (Hellborn, Mastermind, Banneret). Primal Knowledge (bez podtřídy) zůstává.
- Místa změny: 6 zdrojových (3 soubory + helper + MasteryPicker + import), DECISIONS, STATUS.

## Ověření (jednou na konci)
- typecheck OK; test 3452/3452 (nový unit test `otherFeatureLanguageNames` v classFeatureLanguages.test.ts); validate-data 177/177; e2e 712/712 (2,4 min).
- `e2e/rbFixes.spec.ts` (schema 66, seed s `currentHp`): a) Barbarian 3 Infernal / Rogue 3 Mastermind, Infernal (Thieves' Cant) + Abyssal (Mastermind) → žádný Hellborn slot, Next povolen; b) Barbarian 2 s Longbow → „no longer eligible“, odškrtnout, Handaxe, uložit; c) Infernal → Berserker → Infernal: Hellborn prázdný, Primal Knowledge Survival zůstává; d) Remove level 3→2: Primal Knowledge zmizí z listu.

## Rozhodnutí a odchylky
- Scénář b) kontroluje uložená data (`masteries` = Greataxe, Handaxe), ne text listu: list jmenovité mastery nezobrazuje. Longbow v ostatních místech listu není.
- Scénář a): v zadání je Infernal jako creation jazyk; Infernal je Rare a creation picky jsou Standard, takový stav aplikace nevyrobí. Seed proto drží Infernal z Thieves' Cant. Dřívější selhání Next byl chybný seed (duplicitní Survival, expertise bez nároku), ne oprava.
- Zapsáno D396 (uživatelovo rozhodnutí z R-RB).

## Otázky pro uživatele
- Nález 4 a 5 z R-RB (nová duplicita dovedností po návratu v Edit; D395 jen XPHB) zůstávají neřešené.

## Subagent
Nepoužit.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Edit → Class and level (seznam Weapon masteries: řádek „no longer eligible“), Edit → Proficiencies (Languages: Hellborn slot).
