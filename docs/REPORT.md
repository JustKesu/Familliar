# REPORT — NPC-2: STOP před úpravami (podmínka a: AC postavy nejde spočítat mimo list)

Setup: `git fetch` + `merge --ff-only origin/main` = „Already up to date“, HEAD bb02b89. Žádný kód nezměněn, commitnut jen tento report. typecheck/test/validate-data/e2e nespuštěny (beze změny kódu nemají co ověřit).

## Proč STOP

Zadání: zastavit, pokud AC, záchrany, iniciativu nebo max HP uložené postavy nejde spočítat mimo list bez kopírování logiky listu. Stav:

| Hodnota | Mimo list? | Cesta |
|---|---|---|
| Max HP | ano | `loadCharacterMaxHp` (src/hitPoints/hpDefault.ts:43), už sdílené s wizardem |
| Iniciativa | ano | `computeInitiative(character, feats, itemFlatBonuses.initiative, itemAbilityGrants)` — vstupy z `loadFeatEffectEntries`, `loadItemRefs`, `buildItemFlatBonusGrants`/`flatBonusesByTarget`, `buildItemAbilityGrants` |
| Záchrany | ano | `computeSavingThrows` (CharacterSheet.tsx:2508) — vstupy z `loadSavingThrowClassData`, featy, item grants (`buildItemProficiencyGrants` ap.), vše loadery + čisté funkce |
| **AC** | **ne** | `computeArmourClass(…, acFormulaKeys, …)` (CharacterSheet.tsx:2518). `acFormulaKeys = loadAcFormulaKeys(character, knowsMageArmor)` (:2406) a `knowsMageArmor = hasMageArmor(combinedSpells)` (:2375) |

`combinedSpells` se skládá jen uvnitř `CharacterSheet`:
- CharacterSheet.tsx:2083–2132 — inline efekt: class always-prepared + subclass always-prepared (`loadSubclassSource`, `pactSlotsByLevel` ze `spellSlotsClassData`, `genieEntryFor`, d6b volby, D424 Savant filtr), `dedupeAlwaysPreparedSpells`;
- :2134–2248 — `loadFeatGrantedSpells`, `loadOptionalFeatureGrantedSpells` (Armor of Shadows!), `loadRaceSpells`;
- :2333–2375 — D425 Wizard book grants (`activeBookPicks`, `spellDetails`) → `classGrantInfo` → `combineSpellEntries`.

Zkratka `hasMageArmor(character.spellChoices)` by dala jiné AC než list u každé postavy s Mage Armor z invokace/subclassu/featu/rasy (Warlock s Armor of Shadows) — tiché rozejití s listem, proto ji nevolím.

## Otázka pro uživatele

1. **Vytáhnout skládání seznamu kouzel z listu** do sdíleného modulu (např. `src/sheet/combinedSpells.ts`, `loadCombinedSpells(character)` = řádky 2083–2132 + 2333–2375, list ho pak volá taky). Čistý přesun, AC v encounteru = AC na listu. Cena: zásah do CharacterSheet.tsx (efekt se `spellGrantsSettled`, závislost na `spellSlotsClassData`), samostatný krok před NPC-2 nebo jeho součást.
2. **AC bez Mage Armor mimo list** (`knowsMageArmor` = jen `spellChoices`), s poznámkou v D438. Rychlé, ale AC v řádku může být nižší než na listu.
3. **AC v řádku NPC nezobrazovat** („—“, jako neznámé monstrum), plný AC jen na listu přes tlačítko statbloku.

Doporučení: 1 (jediná varianta, kde řádek a list nikdy nenesouhlasí).

## Plánovaný rozsah (krok 1, pro navazující session)

| Soubor | Funkce / místo | Změna |
|---|---|---|
| src/encounters/encounterStore.ts | `ENCOUNTER_SCHEMA_VERSION`, `Encounter`, `isEncounter`, `readRaw`, migrace | schema 3, `npcs: {id, characterId, cr: string|null}[]`, migrace 2→3 `npcs: []` |
| src/encounters/encounterDifficulty.ts | `encounterXp` (+ `crXp` z monster dat) | XP NPC s CR, počet nezapočtených |
| src/encounters/combat.ts | `InitiativeEntry`, `isEntry`, `entryKey`, `initiativeEntries`, `isEntryDown`, `nextTurn`, `rollSaves`, `applyDamage`/`applyHeal` | kind `npc`, HP/podmínky NPC mimo `combat.hp` |
| src/encounters/npcCombat.ts (nový) | načtení AC/záchran/iniciativy/max HP, zápis HP a podmínek do `CharacterStore` | |
| src/dm/EncounterSetup.tsx | `Draft`, `toInput`, `DifficultyBar`, nová `NpcCard`, „Add NPC“ | |
| src/dm/EncounterRun.tsx | `InitiativeStep`, `entryLabel`, `CombatScreen` (list, damage/heal/condition/saves, stat tlačítko), nový `NpcRow`, overlay listu s „← Back to encounter“ | |
| src/styles (CSS encounteru) | řádek NPC, overlay | |
| testy: encounterStore/encounterDifficulty/combat/npcCombat .test.ts; e2e dmCombat, dmTrackedUses, dmRolls (+ další seed) schemaVersion 3; nový e2e/dmNpcCombat.spec.ts | | |
| docs: DECISIONS.md D438, STATUS.md | | |

## Rozhodnutí v kódu

Žádná (nic neimplementováno).

## Subagent

Nepoužit.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots. Změněné obrazovky: žádné.
