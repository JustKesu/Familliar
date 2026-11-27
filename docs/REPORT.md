# REPORT — NPC-2: NPC ve střetnutích se sdílenými HP a stavy (D438)

Start z 7e7c823 (`git log --oneline -1`). Varianta 1 z minulého STOPu: skládání seznamu kouzel přesunuto z listu do sdíleného modulu.

## Krok 1 — soupis změn (19 souborů)

| Soubor | Funkce / místo | Změna |
|---|---|---|
| src/sheet/combinedSpells.ts (nový) | `loadClassAndSubclassSpellInfo`, `wizardBookGrants`, `loadCombinedSpells` | přesun ř. ~2083–2132 a ~2333–2375 z listu beze změny logiky |
| src/sheet/CharacterSheet.tsx | efekt class/subclass grants, `classGrantInfo`, importy | volá modul; chování beze změny |
| src/sheet/HitPoints.tsx | nová `healHitPoints` | zápis healu listu pro NPC (sloupec listu beze změny) |
| src/encounters/encounterStore.ts | `EncounterNpc`, `isNpc`, `isEncounter`, `migrateV2`, `readRaw`, schema 3 | |
| src/encounters/encounterDifficulty.ts | `crXpTable`, `encounterXp(+npcs,crXp)`, `uncountedNpcs` | |
| src/encounters/combat.ts | entry `npc`, `isEntry`, `entryKey`, `initiativeEntries(+npcs)`, `entryMemberIds`, `isEntryDown/nextTurn(+npcDown)`, `damageTaken`, `removeEntry` | |
| src/encounters/npcStats.ts (nový) | `loadNpcStats`, `classLine` | AC/iniciativa/záchrany/max HP výpočty listu |
| src/encounters/npcCharacter.ts (nový) | `damageNpc`, `healNpc`, `npcConditions`, `add/removeNpcCondition` | |
| src/dm/EncounterSetup.tsx | `Draft`, `toInput`, `DifficultyBar` (note), `NpcCard`, `storedNpcs`, `uncountedNote`, Add NPC | |
| src/dm/EncounterRun.tsx | `useNpcs`, `npcInfos`, `EncounterRun` (overlay, removeNpc, writeNpcs), `InitiativeStep`, `SaveBonuses(saves)`, `NpcRow`, `CombatScreen` | |
| src/dm/DmPage.tsx, src/App.tsx | prop `sheet` → CharacterManager se sheet route | |
| src/index.css | NPC karta, note, `.npc-overlay` | |
| testy | encounters.test.ts, npcCombat.test.ts (nový); e2e dmCombat/dmRolls/dmTrackedUses (schema 3 + `npcs: []`), dmNpcCombat.spec.ts (nový) | |
| docs | DECISIONS D438, STATUS, REPORT | |

## Ověření

- typecheck OK; `npm test` 201 souborů / 3702 testů OK (beze změny existujících testů listu); validate-data 191/191.
- `npm run e2e`: 875 passed (2,9 min), včetně upravených dmCombat/dmRolls/dmTrackedUses.
- Unit: migrace 1→3 a 2→3, duplicitní NPC odmítnuto, XP CR 1 = 200 / bez CR nepočítáno, `loadNpcStats` seeded Fighter 3 (AC 12, init +2, STR +4, CON +3, DEX +2, max HP 25 — z reálných data/), iniciativa a save bonus, Next turn přeskočí NPC na 0, damage (temp HP první, stop na 0) / heal (max) / stavy+Exhaustion zapisují postavu.
- e2e `dmNpcCombat.spec.ts`: a+b (setup, CR, note, jen jednou, uložení schema 3), c–h (iniciativa d20 +2, řádek AC 12 / 20/25 / záchrany listu, damage 5 NPC+vlk → 15/25 a 6/11 i v uložené postavě, Prone → `play.conditions`, d20=1 → „STR 5“, list přes celou obrazovku ukáže 15/25 a Prone, heal 4 na listu → po „← Back to encounter“ řádek 19/25, stejné kolo a tah, NPC na 0 přeskočeno), i (smazané NPC v boji i setupu, Remove), j (390×844).

## Rozhodnutí v kódu

- XP podle CR z monsters.json (`crXpTable`, CR 0 = 10 XP, vyšší hodnota). `data/encounter-rules.json` má i `xpByCr` (validate: pokrývá všechny CR) — lze přepnout, výsledek stejný.
- NPC bez `currentHp` začíná na max; první damage/heal ho zapíše.
- Exhaustion přidaná z boje = úroveň 1 (jen je-li 0), odebrání = 0; čip bez úrovně (D434).
- Smazané NPC: do iniciativy nevstupuje, v běžícím boji = „down“ (Next turn ho přeskočí), Remove ho odebere ze setupu i pořadí (`removeEntry`, tah zůstane na stejném tvoru).
- Nenačtené statistiky (chyba dat): AC „—“, bonusy +0, max HP = current HP.
- Záložka listu: overlay `position: fixed` z-index 15 (pod DM roll toastem 20), boj zůstává namountovaný (`hidden`), takže výběr, Amount a karty přežijí. Třída `npc-overlay`, ne `*sheet*`: guard D153 (`sheetLayout.test.ts`) hlídá vlastní scroll jen u kontejnerů listu.
- NPC řádek na mobilu bez ADV (jako monstrum na mobilu).
- Sheet v overlay běží v DmPage, takže hody z listu jdou do DM historie hodů.

## Subagent

Nepoužit.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots. Změněné obrazovky: DM setup střetnutí (sekce NPCs, Add NPC, CR, poznámka u obtížnosti), DM boj (řádek NPC desktop/mobil, smazané NPC), list NPC přes celou obrazovku s „← Back to encounter“.

e2e: celá sada 875 passed (2,9 min).
