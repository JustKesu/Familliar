# REPORT — S5 (přirozená zbroj a zbraně druhů)

HEAD na startu 644c794 (OK). Průzkum v předchozím běhu (commit 2d2e630) zastavil na 2 záznamech; Daniel rozhodl: Lupin = slashing na prostém Unarmed Strike, Longtooth = řádek s poznámkou „only while shifted".

## Průzkum (viz DATA.md)
Armor 2: Lizardfolk|MPMM 13+Dex, štít ano; Tortle|MPMM 17 bez Dex, štít ano, zakazuje zbroj (jediný). Zbraně 9: 7 čistých 1d6+Str (Aarakocra Talons, Centaur Hooves, Lizardfolk Bite, Minotaur Horns, Satyr Ram, Tabaxi Cat's Claws, Tortle Claws) + Lupin Feral Pounce + Shifter; Longtooth.

## Změněno (bez schématu, ~6 míst)
- `src/calculation/speciesNatural.ts` (nový): ručně psané tabulky name|source → zbroj / zbraň / typ škody Unarmed Strike. Důvod ruční tabulky: data jsou jen próza, 9 záznamů; parser by byl křehčí než tabulka.
- `armourClass.ts`: kandidát „Natural Armor (…)" vedle zbroje a vzorců; varovný řádek „<zbroj> worn" při zakázané zbroji; Defense (Fighting Style) se nově přičítá jen když vyhrává nošená zbroj (dříve při jakékoli nošené zbroji; změna chování jen pro případ, kdy přirozená zbroj vyhraje nad nošenou).
- `weaponAttacks.ts`: `unarmedStrike` zobecněn (jméno, kostka, typ); řádek `natural-weapon-<jméno>`; Monk bere větší z kostek a Dex.
- Ručně mapováno: všech 2 + 8 řádků + Lupin. Riders vynechány: Lupin Shove po zásahu, Shifter bonusová akce/stav Shifting (jen poznámka).
- Varování zbroje: Tortle je jediný zakazující záznam.

## Testy
- Unit: `armourClass.test.ts` „species natural armour (D357)" (6), `weaponAttacks.test.ts` „species natural weapons (D358)" (6).
- E2E `e2e/speciesNatural.spec.ts`: S5 a (Tortle 17), b (Lizardfolk 16, po nasazení Leather Armor stále 16, oba v rozpisu), c (Tortle + štít 19), d (varování), e (Aarakocra Talons +4, 1d6 + 2 slashing), f (Monk 5 Centaur Hooves +6, 1d8 + 3).
- Výsledky: typecheck OK, `npm test` 182 souborů / 3340 testů OK, validate-data 175/175, e2e 572 OK za 1,9 min.

## Rozhodnutí / otázky
- Rozhodnuto v kódu: Defense se přičítá jen při vítězné nošené zbroji (viz výše) — vedlejší důsledek D357; dej vědět, jestli to chceš jinak.
- Docs: D357, D358 (výslovně zadáno), DATA.md (nález z průzkumu), STATUS.md.

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Changed screens: sheet header Armour Class + its breakdown dialog; Actions tab (extra row for natural weapons).
