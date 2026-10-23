# I-1: opakovatelné invokace, jen počet (D382)

Setup: fetch + `merge --ff-only` = již aktuální, HEAD d9b2036.

## STEP 1 — místa s předpokladem „jedna invokace na jméno“ (16, pod limitem 25)
| Místo | Co se rozbije s duplicitou | Řešení |
|---|---|---|
| ClassOptionalFeaturePicker `toggle` ~137 | jen přidat/odebrat podle jména | + `changeCopies` (Take again / Remove one) |
| Picker label + counter (SearchableOptionList `chosen` = vybrané řádky) | 2 kopie = 1 řádek → „2/3“ | `label` „(xN)“, `chosenCount` = `group.chosen.length` |
| optionSwap `swappedOut` :52 | podle jmen nevidí ztrátu kopie | multiset (`copiesOf`, `findLast`) |
| `swapBlockedBy` :63, `swapOut` :74 | maže všechny kopie | `withoutOneCopy` |
| `undoSwap` :94-101 | druhá kopie = „držená“ | párování po kopiích |
| `inheritSwapStamp` :185 | dtto | `lostCopies` + párování |
| ReplaceOptionControl :89 | duplicitní klíče/tlačítka | jedno tlačítko na jméno |
| heldPicks :106-110 | ztráta 1 ze 2 kopií neviditelná | `lostCopies` |
| wizardState stamp :1943 | nová kopie držené se neorazítkuje | párování po kopiích |
| ReviewStep :222-225 (card, Options added) | Set → kopie se ztratí | `countedNames`, `lostCopies` |
| `chosenOptionalFeatureOptions` | 2 řádky na sheetu/akcích | sloučeno, pole `copies` |
| featuresTabData `optionItem`, unlinked řádek | bez počtu | `withCopies` |
| validate `describeOptionalFeatureChoicesError` | duplicitu nekontroloval | EI duplicita mimo 4 = chyba |
| OK beze změny: `evaluate…` (count−chosen), `invocationFeatSlots` (k kopií), levelRemoval `withoutLevel` (po razítku), Agonizing `.some`, cascade (neplatná = všechny kopie) | | |

## Změny
- Seznam + `isRepeatableOption` v `storage/character.ts` (validate nesmí tahat UI moduly); helpery v `optionSwap.ts`.
- Kopie = další `{name, level}` v EI `choices`; schéma beze změny (63).
- D382 zapsán do DECISIONS.md (dle zadání), STATUS.md doplněn.

## Ověření
- typecheck OK; test 188 souborů / 3434 OK; validate-data 177/177 OK.
- Unit: optionSwap.test (swap/Keep jedné kopie, razítko, `lostCopies`/`countedNames`, validate 4 vs Eldritch Mind), levelRemoval.test (odebrání úrovně 5 vezme jen 2. Lessons, 2. feat spí dle D376).
- e2e celé: 668/670, padly jen 2 nové scénáře (seed bez background bonusů → Edit Character měl zamčené kroky); přepsány na level up, `e2e/repeatableInvocationsI1.spec.ts` pak 4/4 OK (samostatný běh). Celou sadu jsem po opravě znovu nespouštěl.
  - a) Warlock 4→5 Take again Lessons, Review „(x2)“ + Options added, uloženo 2× (razítka 2 a 5), Manage Feats Alert + Tough z Lessons, Features „(x2)“.
  - b) Agonizing ×2 → Eldritch Blast „1d10 + 3“, Features „Agonizing Blast (x2)“.
  - c) Eldritch Mind bez „Take again“; Agonizing Take again → 4/5 „(x2)“, Remove one → 3/5.
  - d) Warlock 1→2 Lessons dvakrát v jednom průchodu, Review „Lessons of the First Ones (x2)“, obě razítka 2.

## Rozhodnutí v kódu / otázky
- Odškrtnutí řádku odebere všechny nedržené kopie; po jedné jde „Remove one“.
- „Take again“ zakázáno, dokud je kopie toho jména vyměněná (vrací se přes „Keep“, aby se zachovalo razítko).
- Výměna/odebrání bere poslední kopii; Keep vrací poslední drženou (razítko vyšší úrovně).
- „(xN)“ počítá jen kopie z třídy; kopie z předmětu zůstávají pod „From items“ (do slotů Lessons se ale počítají, D382 f).
- validate kontroluje duplicity jen u EI; ostatní featureType beze změny.

Subagent: nepoužit.

## Manual browser check for the user
Žádná — vzhled kontroluje plánovací chat ze screenshotů. Změněné obrazovky: level up / Edit krok Eldritch Invocations (tlačítka Take again / Remove one, štítek „(xN)“), Review karta Class options a What's new, Features & Traits (řádek invokace „(xN)“).
