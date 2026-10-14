# REPORT — F-29 (Defense a přirozená zbroj)

HEAD na startu 46135a5 (OK, ff-only už aktuální).

## Změněno (3 místa v kódu, bez schématu)
- `src/calculation/armourClass.ts`: Defense (Fighting Style) +1 se přičítá podle `gear.armour` (nošená lehká/střední/těžká zbroj), ne podle vítězného kandidáta. Odstraněn příznak `Candidate.worn` zavedený v S5 (už nepotřebný). Komentář u pole opraven na D359. Štít sám Defense nespouští (`gear.armour` je jen zbroj).
- Opraveno chování z S5 (v REPORTu S5 jsem ho hlásil jako vedlejší důsledek).

## Testy
- Unit `armourClass.test.ts`: „Defense adds +1 for a worn suit even when natural armour wins (D359)" — Lizardfolk Fighter s Defense, DEX 16: v Leather Armor 17 (oba řádky v rozpisu), bez zbroje 16 bez řádku Defense, se štítem 18. Stávající Defense testy projdou.
- E2E `e2e/speciesNatural.spec.ts` „F-29": AC 17, rozpis obsahuje „Natural Armor (Lizardfolk)" a „Defense (Fighting Style): +1" (seed `fightingStyles` ve schématu 61, currentHp 11 = max).
- Výsledky: typecheck OK; `npm test` 182 souborů / 3341 testů OK; validate-data 175/175; e2e 573 OK za 2,8 min.
- Poznámka: první běh `npm test` měl 2 selhání v `CharacterSheet.test.tsx` (toast po timeoutu; „Pact of the Chain" v Notes) — nesouvisí s AC, v izolaci i v druhém plném běhu prošly (zdá se flaky pod zátěží, běh ~100 s).

## Docs
- DECISIONS.md D359 (výslovně zadáno), STATUS.md (řádek u S5 doplněn; stará zmínka o Defense u Fighting Style už platila).

## Rozhodnutí / otázky
- Žádné nové.

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Changed screens: Armour Class breakdown dialog on the sheet (Defense line next to Natural Armor).
