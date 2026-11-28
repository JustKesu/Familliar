# REPORT — F-MON: opravy z review R-MON a vzhled (D440)

Start z 4490baf (fetch + `merge --ff-only`: Already up to date). STOP podmínky (a)/(b) nenastaly; file:line z review sedělo.

## Body
- **A** `EncounterRun.tsx` `npcInfos`: max = `stats.maxHp ?? null`, fallback na current/1 odstraněn. Řádek: HP „—“ + „Max HP unknown - set HP on the sheet“. `damageNpc`/`healNpc` (`npcCharacter.ts`) berou `max: number | null` a při null nezapíšou nic (oprava ve sdílené funkci, ne v UI).
- **B** `EncounterRules.xpByCr` (`extractEncounterRules` čte 34 řádků); Setup i Run berou CR odtud, `crXpTable` smazán. Odhad CR 27 se předvyplní (Setup kontroluje proti `xpByCr`).
- **C** `NpcList.tsx`: Delete dialog „… Used in N encounter(s). It/They will show it as deleted.“ (počet z `EncounterStore.list()`); střetnutí beze změny.
- **D** `removeEntry(combat, key, groups, npcDown)`: jednající záznam odebrán → `nextTurn` od `index - 1` (kolo +1 při přetečení, refill LA, přeskočí down); CombatScreen po odebrání jednajícího NPC nastaví recharge připomínky.
- **E** `shownUsed(combat, id, key, total)` přesunut do `combat.ts` (min(used, total)); EncounterRun ho volá pro řádek i karty.
- **F** `applyDamage(..., npcIds = [])` maže `saveResults` jen zasažených členů a NPC (NPC s neznámým max se nepočítá jako zasažené).
- **G** `CharacterManager.handleImportFile`: import souboru s NPC → „<jméno> was saved as an NPC - see DM > NPCs.“ (přes `redirectNotice`).
- **H** `encounterXp`/`uncountedNpcs(npcs, crXp, exists)`: smazané NPC i CR mimo tabulku = nezapočtené. `loadNpcOffence`: Thirsting/Devouring Blade násobí jen řádek s `pactWeapon`, ostatní zbraně počet bez invokací.
- **I** `extract-data.js` 4 řazení → `localeCompare(…, "en")`. `npm run extract-data`: `git diff --numstat data` prázdný (status „M“ jen kvůli LF/CRLF v pracovní kopii) → `git restore data`, žádná změna dat. Commitovaná data už byla v en pořadí; zapsáno do DATA.md.
- **L1** `index.css`: `.monster-card .roll-value` v pravidle rámečku listu i v hoveru, vlastní `padding: 0 6px`. 390×844 jsem neviděl (bez prohlížeče).
- **L2** `ConfirmDialog` prop `actionIsPrimary`: akce `btn--accent` s fokusem, safe `btn--accent-outline`; použito jen v Duplicate NPC, ostatních 7 beze změny.
- **L3** `DmPage`: `<RollToast key={tab:encounter…}>` → remount při změně záložky/route.

## Ověřeno
- typecheck OK; unit 202 souborů / 3718 testů OK; validate-data 195/195 OK; celé e2e 883 passed (3,3 min, těsně nad 3 min).
- Nové unit: `npcCombat.test.ts` A (maxHp null nic nezapíše, current zůstane 12), D (konec kola → kolo 4, LA 0; první jednající; down NPC přeskočeno), E, F; `encounters.test.ts` B (34 řádků, CR 27 = 105000 XP), H (smazané + CR „31“ → 2 nezapočtená, 100 XP); `npcCr.test.ts` H (Warlock 5 Greatsword: označený 18 DPR/+5, neoznačený 9/+2).
- Nové e2e: `dmNpcs` „F-MON C“ (text dialogu s 1 střetnutím, uložená střetnutí beze změny), „F-MON G“; `dmRolls` „F-MON L3“ (toast zmizí po Bestiary → NPCs), „F-MON L2“ (třída + fokus).
- A v UI nemá e2e: neúspěch `loadNpcStats` nejde v e2e vyvolat bez zásahu do dat; kryto unit testem `damageNpc/healNpc/npcCurrentHp`.

## Rozhodnutí v kódu
- Text „N NPC without CR not counted“ ponechán i pro smazané NPC a CR mimo tabulku (e2e ho testují 3×; přesnější text = změna řetězce).
- Poznámka o nezapočtených se ukáže až po načtení `encounter-rules` (jinak by bez tabulky blikla u všech NPC).
- Hláška G se ukazuje stylem `.error` jako stávající `redirectNotice`.
- L2 test umístěn do `dmRolls` dle zadání, i když jde o NPC dialog.
- D: recharge připomínka po odebrání se ukáže jen při odebrání jednajícího NPC (jediné odebírání v boji).

## Pro uživatele
- Nález 5 (pořadí commit → NPC), 10 (sdílené `combineSheetSpells`) a known a, f, i zůstávají otevřené.
- Untracked soubory v kořeni a `scripts/*.js` z dřívějších úkolů necommitnuty (zadání: helper skripty vynechat).

## Manual browser check for the user
Žádný — vzhled kontroluje plánovací chat ze screenshotů. Změněné obrazovky: stat block monstra (rámeček hodnot, i 390×844), dialog Duplicate NPC, dialog Delete NPC, řádek boje NPC s neznámým max HP.
