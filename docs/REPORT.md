# REPORT — MON-4: vedení střetnutí (iniciativa, tahy, HP, záchrany, stavy)

## Co se změnilo
- A: `difficultyLabel` jako strop (≤ Low = Low … > High = Above High, „Below Low“ zrušen); 500 XP vs 400/600/800 = Moderate.
- B: `encounterStore.ts` schemaVersion 2, v1 migrace na `combat: null`, `setCombat()`, uložení přípravy boj zachová;
  vadný `combat` = záznam přeskočen (D43). `src/encounters/combat.ts` (nový): typy `Combat`/`InitiativeEntry`/`SaveResult`,
  `initiativeEntries`, `sortInitiative`, `startCombat`, `nextTurn`, `rollSaves`, `flipSave`, `applyDamage`, `applyHeal`,
  podmínky, ADV, `isCombat`.
- C: route `#/dm/encounter/<id>/run` (`DmRoute.encounter.run`), „Start“ v přípravě (uloží, pak run), „Run“ / „Resume · Round N“
  v seznamu. Krok iniciativy v `src/dm/EncounterRun.tsx`.
- D/E: obrazovka boje v `EncounterRun.tsx` (desktop i ≤ 760 px), styly v `src/index.css`, token `--warning` v `theme.css`.
- Změněné obrazovky: DM › Encounters (tlačítko Run), příprava (Start), nová obrazovka iniciativy, nová obrazovka boje.
- Docs: D434, STATUS.md. DATA.md beze změny (čísla Wolf/Dire Wolf jen ověřena, nic nového o datech).

## Ověření
- Data skriptem: Wolf 11 HP, AC 12, DEX 15, záchrany +2/+2/+1/−4/+1/−2, init +2, CR 1/4; Dire Wolf 22 HP, AC 14, init +2, CR 1.
- typecheck OK; `npm test` 198 souborů / 3659 testů OK (nový `combat.test.ts`: pořadí a shody, skip + round wrap,
  záchrany s ADV, damage half/none/bez záchrany, zaokrouhlení dolů, heal; `encounters.test.ts`: migrace v1, setCombat,
  štítky; `route.test.ts`: run route). lint: jen stávající varování. validate-data 191/191.
- `e2e/dmCombat.spec.ts` a–f (desktop): Start, pořadí Ana/Wolf group/Alpha/Bor při shodě 15, 500 XP · Moderate, stat block,
  DEX DC 13 + flip + 14 dmg (4/11 nebo 0/11 podle štítků), Prone přidán/odebrán, všichni vlci down a přeskočeni, kolo 2,
  reload = stejný stav, End encounter (combat null, střetnutí zůstane); g 390×844: spodní lišta, panel záchrany, damage,
  stav, Next turn, stat block přes celou obrazovku, bez přetečení. `dmEncounters.spec.ts` přepnut na Moderate.
- Celé e2e: 858 passed, 9,7 min (nad limitem ~3 min). První běh zastaven časovým limitem nástroje (bez chyb), druhý celý.

## Rozhodnutí v kódu
- Shoda iniciativy: hráč před monstrem bez ohledu na bonus; mezi monstry vyšší bonus; jinak pořadí ze seznamu.
- Prázdná iniciativa monstra v kroku = ponechá hozenou hodnotu.
- Neznámé monstrum (není v bestiáři): max HP 1, záchrany a iniciativa +0, stat block tlačítko vypnuté.
- Výběr, Amount, Save, DC, On success a otevřený stat block jsou jen v UI, neukládají se; výběr zůstává po Damage.
- Bez zvolené záchrany (Save = None) Damage plně všem; se zvolenou záchranou člen bez výsledku také plně.
- Roll saves přeskočí členy na 0 HP; Damage/Heal působí na všechny vybrané (i down — Heal je zvedne).
- Exhaustion v menu stavů jako prostý štítek bez úrovně.
- Hlavička skupiny „Wolf x6“ bez množného čísla (jako souhrn v seznamu).
- Člen přidaný v přípravě po startu není v pořadí; odebraný člen zmizí; nový člen má max HP.
- „+ Condition“ je `<select>`; End encounter vrací na seznam.
- Mobil: zaškrtávátko v řádku (výběr), ADV toggle jen na desktopu, End encounter pod seznamem, Clear selection v panelu
  záchrany; zkrácené záchrany „S+2 D+2 C+1 I-4 W+1 Ch-2“ v podtitulku skupiny/řádku.
- Seznam ukazuje „Resume · Round N“, když boj běží.

## Subagent use
Žádný.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
