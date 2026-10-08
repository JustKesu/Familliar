# F-11 — opravy z review M8–M9b (D334)

## Co se změnilo
1. Tool picky podtříd: nová `toolGrantsForHeldClasses` (`classToolChoices.ts`) = `classToolGrantsFor([první])` + `subclassToolGrantsForAll(ostatní)`.
   Používá ji `saveCharacter` (všechny cesty) i `wizardToolGrants` (multiclass Edit). Level up Fightera na 3 jako 2. třídy kroku Languages
   nabídne pick a save ho drží (to už wizard uměl, ztrácel ho save).
2. Netagovaný styl: `WizardSeedLookups.heldClasses[].fightingStyleLevel` (CharacterWizard ho načítá `loadFightingStyleGrantLevel`).
   Seed dá styl první držené třídě bez vlastního tagovaného stylu, jejíž úroveň ≥ úrovni rysu; save ho zapíše s tagem a netagovaný
   záznam nahradí (zdroj stylu se přenese). Nikdo nevyhovuje → beze změny.
3. Razítka: `keepRecordedLevels` bez `levelUpTo` páruje odebrané picky s přidanými v pořadí a přidaný dědí `level`. Platí pro
   masteries, expertise i optional features podtřídy, single-class Edit také.
4. `featureTypeOwner` v seedu: typ uvedený dvěma třídami patří první.
5. `classRecordsFor`: `subclassSource` se bere z uloženého záznamu stejné třídy a stejnojmenné podtřídy, jinak z lookupu.
6. Beze změny kódu, jen testy: sdílený pool (Channel Divinity Cleric+Paladin) se po odebrání Paladina ořízne na max Clerica (3 → 2),
   nesmaže se; koncentrace na kouzlo, které drží i feat (Magic Initiate), s odebranou třídou končí (verdikt f, současné chování).
Verdikt b) (volnější Expertise v multiclass Editu) nedotčen → M10.

## Ověřeno
- `npm run typecheck`, `npm run test` (174 souborů, 3213 testů), `npm run validate-data` (175/175) prošly.
- `npm run e2e`: 490 passed, 5,6 min (nad hranicí 3 min z CLAUDE.md, jak bylo předem známo).
- Unit: `multiclassEdit.test.ts` blok "F-11" (po jednom bloku na nálezy 1–5; nález 1 = untouched Edit, level up jiné třídy, level up
  non-first Fightera na 3; nález 3 včetně řetězce Edit → `levelRemovalCore`), `levelRemoval.test.tsx` (nález 6, koncentrace f),
  `wizardState.test.ts` (untouched Edit teď přesně porovnává toolChoices, languages, expertise, featAsi, grantedFeats, HP, optional
  features; ty se řadí podle featureType, protože save je píše po třídách).
- E2E `multiclassEdit.spec.ts` F-11 a–d (a: Smith's Tools po Edit/Save; b: jeden tagovaný styl v localStorage; c: swap expertise →
  Remove level odebere Athletics; d: level up Sorcerera 3→4 vs. Edit výsledku).

## Rozhodnuto při práci
- Netagovaný styl dostane jen třída, která nemá vlastní tagovaný (jinak by `fightingStyleFor` vrátil její vlastní).
- Dědění razítka jsem nechal ve sdíleném `keepRecordedLevels`, takže se týká i optional features podtřídy v Editu (zadání jmenovalo
  masteries a expertise).
- Zadání končilo uprostřed bodu testů ("Unit (wizardState.test."); testy jsem odvodil z popisů nálezů a ze zbytku zadání.
- E2E d: ASI krok level upu ukazuje karty Level 4 i Level 10 (ne jen novou úroveň), na rozdíl od Hit points (jen Level 10); Edit
  výsledku ukazuje stejné karty a 10 řádků HP. "Stejné počty" jsem proto ověřil na kartách a na řádku Level 10 (Average (4)).

## Poznámky / otázky pro uživatele
- D333 větu o netagovaném stylu ("žádné třídě") jsem nepřepsal (SPEC/DECISIONS jsou tvoje); D334 ji zpřesňuje. Zvaž úpravu D333.
- Konkurence stylu: přiřazení neřeší více netagovaných stylů (bere první).

## Manual browser check for the user
Nic vizuálního se nezměnilo (žádné CSS ani nové prvky); chování pokrývají scénáře F-11 a–d. Nic k ručnímu ověření.
