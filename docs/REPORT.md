# REPORT — S5 survey (ZASTAVENO, nic neimplementováno)

HEAD na startu 644c794 (OK, ff-only). Zastaveno po kroku 1 podle zadaných stop podmínek.

## Průzkum (scripts/investigate-s5-natural.mjs, investigate-s5-texts.mjs; jen konzole)
Armor (2, očekáváno 2):
- Lizardfolk|MPMM Natural Armor: 13 + Dex, štít ano, zakazuje zbroj ne ("když nenosíš zbroj … můžeš použít, pokud zbroj dává méně").
- Tortle|MPMM Natural Armor: pevných 17, Dex se nepřičítá, štít ano, ZAKAZUJE zbroj (light/medium/heavy). Jediný záznam se zákazem → rozhodnutí 2 má použití.

Weapons (9 záznamů, ne ~10; 7 čistých):
- 1d6 + Str, vše jako Unarmed Strike: Aarakocra Talons (slashing), Centaur Hooves (bludgeoning), Lizardfolk Bite (slashing), Minotaur Horns (piercing), Satyr Ram (bludgeoning), Tabaxi Cat's Claws (slashing), Tortle Claws (slashing).
- Nečisté: Lupin|RHW Feral Pounce, Shifter; Longtooth|EFA Shifting (Longtooth).
- Neklasifikované: Lizardfolk Bite, Tortle Natural Armor/Shell Defense (první dvě jsou výše; Shell Defense je jen +4 AC jako akce, mimo rozsah).

## Důvod zastavení: rozhodnutí, která uživatel neučinil
1. Lupin Feral Pounce: nemá vlastní kostku ani řádek; mění typ ŠKODY samotného Unarmed Strike na slashing (+ Shove rider). Možnosti: (a) ignorovat jako rider; (b) přepsat typ na řádku Unarmed Strike na slashing. (b) mění základní útok, což jsi vyloučil jen pro „riders that change the attack itself".
2. Shifter; Longtooth: 1d6 + Str piercing platí jen při zapnutém Shifting (stav, který aplikace nesleduje) a jen „při zásahu". Možnosti: (a) vynechat; (b) řádek vždy, s poznámkou „jen při shiftu"; (c) čekat na sledování Shiftu.
3. Počet 7 čistých vs. ~10: pokud chceš jen 7, stačí rozhodnout 1+2 jako (a) a pokračovat.

## Rozhodnutí / otázky
- Žádné rozhodnutí v kódu. Navržené D357/D358 nepřidány (nic neimplementováno).
- Parsování: prose je pravidelná, ale kvůli 2+7 záznamům doporučuji ruční tabulku (name|source → base/dex/forbids; kostka/typ), ne regex v runtime.
- Změněno: DATA.md (nález), scripts/ (zůstanou jen do git clean).

Manual browser check for the user: none - the planning chat checks the looks from screenshots. List which screens changed: none.
