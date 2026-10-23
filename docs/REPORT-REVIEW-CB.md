# R-CB: code review C-1, H-1, I-1, CB-1, CB-2

Setup: fetch + `merge --ff-only` = již aktuální, HEAD 4d6d1b9. Jen review, žádný kód neměněn, npm nespuštěno.

## Nálezy

1. **střední** — `src/creation/wizardState.ts:1441` (+ gate `:980`). U custom backgroundu je `sameBackground` true i při změně jeho skills, takže `expertiseSkills` se nemažou; gate Expertise kontroluje jen počet. Rogue/Bard v Edit odškrtne History (s Expertise) a vybere Arcana → uloží se Expertise na skill bez proficiency, sheet ukáže dvojnásobný bonus na neprofesním skillu. Oprava: při změně `custom.skills` vyfiltrovat `expertiseSkills` na skills, které stále jsou v poolu (nebo je smazat jako u změny identity).
2. **drobné** — `src/creation/CharacterWizard.tsx:1432` a `src/hitPoints/HitPointsPicker.tsx:91`. Jméno custom backgroundu je v klíči max HP / deps, takže každé napsané písmeno spustí `loadCharacterMaxHp` (a HP picker reload). Bez chyby pro uživatele, jen zbytečná práce. Oprava: pro `source === 'custom'` dát do klíče jen source (stejně jako `equipmentBackgroundName` na `:645`).
3. **drobné** — `src/storage/validate.ts:462`. Duplicitní neopakovatelná invokace (EI) teď odmítne celý záznam → import selže / uložená postava se stane „unreadable“. Picker duplikáty dřív nevyráběl, takže reálně jen ručně editovaný export. Oprava: buď nechat (strict), nebo duplikát při čtení zahodit místo odmítnutí; v obou případech unit test se starší verzí.
4. **drobné** — `src/storage/character.ts:507` `isRepeatableOption` nekontroluje source. Pokud data nabídnou PHB'14 Agonizing Blast/Eldritch Spear/Repelling Blast, jde vzít 2× (pravidla 2014 to neumožňují). Oprava: porovnat i `source === 'XPHB'` (picker i validate).
5. **drobné** — `src/CharacterManager.tsx:153`. `withMaxHpFollow` obaluje každý `setInventory` (množství, poznámka, přesun) → 2× `loadCharacterMaxHp` na každé kliknutí v inventáři. Funkčně správné (delta 0 = žádný zápis). Oprava jen pokud to bude znát: spouštět follow jen při změně attuned/equipped/bonusů.
6. **drobné (testy)** — chybí: (a) unit test `withMaxHpFollow` (pořadí dvou rychlých zápisů, chyba v `action`) — kryje ho jen e2e s pevným 500 ms; (b) round-trip export→import custom backgroundu a `chainMasterForm/Damage` přes wireFormat (validate je testované, `toCharacterBackground`/`toCharacterFamiliar` v round-tripu ne); (c) I-1: swap jedné kopie opakované invokace v level upu a pak odebrání toho levelu.

Ověřeno bez nálezu: H-1 — temp HP i death saves se při follow zachovají (`CharacterManager.tsx:120`); `maxHpOverride` dává deltu 0, protože `computeMaxHitPoints` vrací override (`maxHitPoints.ts:117`); 0 HP zůstává 0 na sheetu i v Edit; odebrání levelu multiclassu dál přes `currentHpAfterMaxHpChange` (beze změny). C-1 — Chain Master volby přežijí HP edit, Long Rest, změnu formy i Edit/level up (`familiarAfterOptionChange` předává familiar celý). CB — všechny čtenáře backgroundu (featInstances, featEffects, proficiencies, skills, ManageFeats, featSpells, levelRemoval, sheet) buď jdou přes `originFeatOverride ?? derived`, nebo čtou jen uložená pole; žádný `backgrounds.find` mimo resolver kromě `BackgroundPicker.tsx:361` (výběr knižního, správně). Migrace 62→63 a 63→64 jen tag, testované; validate vynucuje `abilityChoices` + override u custom a zakazuje `abilityChoices` u knižního. Změna trojice abilit maže rozdělení bonusu.

## Verdikty ke známým bodům
1. Chain Master volby přežijí změnu formy — **keep**.
2. Level up z 0 HP přičte zisk — **keep** (rozhodnutí uživatele).
3. Async HP zápis, e2e čeká 500 ms — **keep** kód; v e2e nahradit pevné čekání `expect.poll`/`toHaveText` (flaky na pomalém CI).
4. „(xN)“ jen kopie třídy, itemy pod „From items“ — **keep**.
5. „Take again“ zakázané při swapnuté kopii — **keep** (návrat přes Keep obnoví stamp).
6. I-1 bez plného e2e po opravě 2 testů — **keep**: CB-1 a CB-2 poté pustily plné e2e 674/674 a 677/677.
7. Jméno custom backgroundu bez trim — **fix**: `trim()` při save (`saveCharacter`), gate už trimuje.
8. Grid ToolProficiencyPickeru i u knižních — **keep** (jediné použití, jednotný vzhled).
9. FRHoF nástroje v knižních volbách — **keep**, ale je to otázka pro uživatele (QUESTIONS), ne bug; FRHoF je 2024 kniha.

## Doporučené F-tasky
- **F-CB1 (Sonnet)**: nález 1 (expertise po změně custom skills + e2e scénář Rogue v Edit), bod 7 (trim), nález 2 (klíč max HP pro custom), bod 3 (e2e `expect.poll` místo 500 ms).
- **F-CB2 (Sonnet)**: nález 4 (source u repeatable), nález 3 (rozhodnout strict vs. zahodit duplikát + test), nález 6 testy (b) a (c). Nález 5 jen pokud uživatel zaznamená zpomalení.
