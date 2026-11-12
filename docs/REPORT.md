# F-PB — opravy z review D409–D415

## STEP 1: soubory ke změně (10 míst, pod limitem 15)

| # | Soubor | Bod |
|---|---|---|
| 1 | src/sheet/featureActionRowData.ts | A |
| 2 | src/sheet/featureActionRowData.test.ts | A, E-c |
| 3 | src/calculation/resources.ts | B |
| 4 | src/calculation/resources.test.ts | B |
| 5 | src/sheet/CharacterSheet.tsx | C (+ typ callbacku pro A) |
| 6 | e2e/subclassSpellcastingPrereq.spec.ts | D |
| 7 | e2e/proficiencyBonusUses.spec.ts | E-a, C (e2e) |
| 8 | src/levelUp/levelRemoval.test.tsx | E-b |
| 9 | e2e/levelUpSubclassGains.spec.ts | E-d |
| 10 | docs/DECISIONS.md, STATUS.md, REPORT.md | D416 |

Navíc: e2e/poolGrantorTracker.spec.ts (B e2e — počítadlo Superiority Die je na Actions, ne ve Features; seed tam už existoval).

## Co se změnilo
- A: `poolKeyFromText` vyžaduje jméno featury v `TEXT_POOL_FEATURES` (jen „Psionic Power“). Typ `record` v callbacku `resourceKey` dostal `name`.
- B: skript `investigate-superior-technique.js` potvrdil text „this die is added to any superiority dice you have from another source“ → +1 v `levelScaledMax`, rozpis „Superior Technique“. Styl se hledá podle jména v `fightingStyles` i `optionalFeatureChoices`.
- C: v `CharacterSheet.tsx` je `resourceUses` (z něj se kreslí všechna políčka) ořezané na `resourceMaxima`; `storedResourceUses` a zápis beze změny.
- D: `walkToAsi` čeká na `networkidle` před `count()`.

## Testy
- Unit: resources (3: +1 die s rozpisem, pick jako optional feature, bez Battle Mastera nic), featureActionRowData (D416 Circle of Mortality bez fondu; feat + featura = 1 řádek), levelRemoval (AU-1 s neznámým maximem drží utracené).
- E2E: Giant's Might po Short Rest zůstává použitý; Battle Master 3 + Superior Technique = 5 boxů; utracené 3 při maximu 1 = 1 box použitý, po zvýšení Charisma na 16 zpět 3/3; LS-1 e (EK → Champion → EK, na listu přesně 5 kouzel).
- Cleric + Paladin e2e: bez vhodného seedu, pokryto unit testem.
- typecheck, `npm test` (3521) prošly; plný e2e: 779/780 prošlo, jediný pád byl můj test B na špatné záložce, přesunut do poolGrantorTracker.spec.ts a ten soubor znovu prošel (6/6). Plný běh ~9 min (nad 3 min).
- LS-1 e kontroluje počet kouzel (5), ne jména: druhý průchod nabízí stejná první kouzla, takže zbytky z prvního by se projevily jen jako navíc.

## Rozhodnutí (Decisions taken)
- Superior Technique se rozpoznává podle jména v `fightingStyles` i `optionalFeatureChoices`; aplikace ho dnes nenabízí v pickeru stylů (feats.json FS, 10 položek), takže v praxi může přijít jen z ručně vložených/importovaných dat nebo budoucího pickeru. Ověřit: kde ho má hráč zvolit?
- Ořez v C platí i pro item-spell čítače (stejná mapa).

## Subagent
Nepoužit.

## Manual browser check for the user
Žádný (plánovací chat kontroluje vzhled ze screenshotů). Dotčené obrazovky: Actions a Features (čítače použití), Level up wizard (Spells/Class krok).
