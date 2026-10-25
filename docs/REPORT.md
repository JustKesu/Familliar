# REPORT — PSI-1: oddělené pooly Psionic Energy Die a maximum Soulknife (D398)

Setup: `git fetch`, `git merge --ff-only origin/main` → už aktuální, HEAD 5ae454f. Bez změny větve.

## Co se změnilo
- `src/calculation/resources.ts` `lookupInTableGroups`: jeden pojmenovaný alias, pool `Psionic Energy Die` bere i sloupec `Soulknife Energy Die Number` (komentář odkazuje na DATA.md/D398). Sloupec `… Size` se dál nečte. Žádný jiný zdrojový soubor se nedotkl; D336 dělení, utrácení, rest a legacy klíče zůstaly beze změny.
- Výsledek: a) Rogue 3 Soulknife sám: pool „Psionic Energy Die“ max 4 (dřív „not in the data“), Short Rest vrací jednu kostku, Long Rest všechny. b) Fighter 3 Psi Warrior + Rogue 3 Soulknife: „Psionic Energy Die (Fighter)“ a „(Rogue)“, 4 + 4; Protective Field utrácí Fighter, Psi-Bolstered Knack Rogue. c) Psi Warrior sám beze změny.
- Testy: `resources.test.ts` (Soulknife fixture, alias, ne-Size sloupec, max 4 na L3 a 6 na L5), `classPools.test.ts` (split 4+4 s `shortRest` „one“, klíče spenderů, jednotřídní Soulknife i Psi Warrior bez `pool`), `e2e/psionicPools.spec.ts` a, b, b2, c (schema 66 seed s `currentHp`; spend, Short Rest, Long Rest).
- Docs: D398 (nahrazuje D337 bod 5), D399 (štítek ASI řádku „From <třída> N“, A-1b db37335, upravuje D397), QUESTIONS.md STATUS vyřešeno D398, DATA.md řádek o aliasu, STATUS.md.

## Ověřeno (jednou na konci)
- `npm run typecheck` čistý. `npm run test`: 3458/3458 (první běh 1 chyba v mém novém testu — breakdown nese jméno podtřídy „Soulknife level 5“, ne třídy; opraveno v testu, druhý běh zelený). `npm run validate-data`: 177/177. `npm run e2e`: 719/719, 2,3 min.
- Před finálním během jednou spuštěn samotný `e2e/psionicPools.spec.ts`: 4/4.

## Rozhodnutí a otázky
- Rozhodnutí v běhu: žádné nad rámec zadání. Poznámka: DECISIONS.md D337 bod 5 nechán beze změny, D398 ho nahrazuje novým záznamem.
- Otázka k povšimnutí: jména pooly u rozdělení nesou třídu, ne podtřídu („(Rogue)“, ne „(Soulknife)“); to je D336 a zadání, nezměněno.

## Subagent use
Žádný subagent nepoužit.

`scripts/p-psi.js` z minulé investigace zůstává nesledovaný; `git clean -fd scripts` nespuštěn (zadání zakazuje).

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: záložka Actions (počítadla „Psionic Energy Die“ / „(Fighter)“ / „(Rogue)“) a okno Short Rest u Psi Warrior / Soulknife postav.
