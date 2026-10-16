# REPORT — Investigation: kouzla, která k damage/healing přičítají spellcasting modifier

Setup: fetch, `merge --ff-only` (already up to date), `npm ci`; HEAD f2e8afe. Typecheck/test/e2e se dle zadání nespouštěly. Kód beze změny.
Skript: `scripts/investigate-spell-ability-modifier.js` (smazán `git clean` po pushi). Nálezy 1–4 zapsány do DATA.md.

## 1. Počty a formulace (512 kouzel, markup stripnutý, po větách)
- 26 kouzel (XPHB 14, ostatní 12) má „your spellcasting ability modifier" ve větě o damage/HP/léčení (13 damage, 13 healing).
- „plus your spellcasting ability modifier" 17 (XPHB 11): Alustriel's Mooncloak, Backlash, Conjure Constructs. „+ your spellcasting ability modifier" 3 (vše ne-XPHB): Green-Flame Blade TCE, Healing Spirit XGE, Magic Stone XGE. Pojmenovaná schopnost 0, „spellcasting modifier" bez „ability" 0.
- Přesně tvar „XdY +/plus mod": 16 (XPHB 10: Bigby's Hand, Conjure Celestial, Conjure Fey, Cure Wounds, Flame Blade, Healing Word, Mass Cure Wounds, Mass Healing Word, Mordenkainen's Sword, Spiritual Weapon; ostatní 6: Alustriel's Mooncloak, Backlash, Conjure Constructs, Holy Star of Mystra, Green-Flame Blade, Magic Stone).
- Zbylých 10 bez tvaru kostky+mod: počet (Healing Spirit, Sorcerous Burst), Hit Die + mod (Arcane Vigor, Wither and Bloom), temp HP = mod (Heroism), útok tvora/zbraně (Danse Macabre, Otherworldly Guise, Alter Self), Temple of the Gods, Simbul's Synostodweomer. Navíc Shillelagh/True Strike XPHB: „your spellcasting ability" bez „modifier" (zbraňový útok).

## 2. Pozice
Uvnitř tagu 0; hned za `{@damage}`/`{@dice}` 16 (= všech 16 výše); jen próza 10. Žádné strukturované pole. Výjimka: Green-Flame Blade TCE `scalingLevelDice` = `["1d8 + {{spellcasting_mod}}","1d8"]` (sekundární vstup pod úr. 5 = `{{spellcasting_mod}}`) — jediný `{{…}}` placeholder ve spells.json.

## 3. entriesHigherLevel
17 z 26 ho má, 0 opakuje modifier → `{@scale…}` zvedá jen kostky, modifier se přičítá jednou na každé úrovni slotu.

## 4. Jiné přičítané členy
Proficiency 0, „your level" 0, spell/slot level 0; ploché „XdY + N" 5, vše XPHB (Disintegrate, False Life, Finger of Death, Magic Missile, Regenerate) — už dnes zobrazeno (tag je obsahuje).

## 5. Co aplikace ukazuje dnes (kódová cesta)
- `leveledSpellDice`/`cantripDamage` (src/sheet/spellActionRowData.ts:178, :214) berou jen tělo tagu → modifier chybí všude: Spiritual Weapon „1d8" (Actions řádek A), Flame Blade „3d6", Mordenkainen's Sword „4d12", Bigby's Hand „5d8, 4d6", Backlash „4d6" (S), Magic Stone „1d6 Bludgeoning".
- Healing (Cure Wounds „2d8", Healing Word „2d4", Mass Cure/Healing Word): bez attack/save → ne v Actions tabulce; Spells Effect `spellEffect` (src/sheet/spellsTabData.ts:342) „2d8" + „Healing"; Healing Word / Mass Healing Word v Bonus Action skupině (D182, CharacterSheet.tsx:1040).
- Alustriel's Mooncloak, Holy Star of Mystra (A řádek): žádné kostky (dice nejsou `{@damage}` a kouzlo nemá `{@scaledice}`).
- Bug: Green-Flame Blade ukazuje doslova „{{spellcasting_mod}} fire damage to secondary creature" (úr. 1–4) a „1d8 + {{spellcasting_mod}} …" (5+); regex `SpellDamageLine` (CharacterSheet.tsx:507) nesedí → bez tlačítka hodu.
- `SpellDamageLine` už parsuje „XdY + N" a hází s modifikátorem → řetězec „1d8 + 3" by se hodil bez změny UI.

## 6. Odkud se bere schopnost
Vše přes `computeAbilitySpellcasting` (src/calculation/spellcasting.ts:186); modifier je jen v breakdownu (`"<ability> modifier"`), `SpellcastingEntry`/`SpellCaster` ho jako pole nemá. Feat: `featGrantedSpells[].ability` z src/spells/featSpells.ts (fixní nebo `chosenAbility`, D57) → `computeFeatSpellcasting`. Species: src/spells/raceSpells.ts:197 (`speciesSpellcastingAbility`) → `computeSpeciesSpellcasting`. Pact of the Tome / invokace: `optionalFeatureOrigins`/`itemInvocationOrigins` → třída (Warlock) v `casterFor` (spellActionRowData.ts:86). Vlastní předmět: src/sheet/itemSpellRows.ts:70 — `own` → `computeAbilitySpellcasting` (CharacterSheet.tsx:2430), `fixed` → jen DC/útok bez schopnosti (modifier neznámý).

## 7. Doporučení
- Detekce: v raw `entries` tag `{@damage|@dice X}` bezprostředně následovaný `\s*(\+|plus)\s*your spellcasting ability modifier` → řádek „X + mod". Pokrývá přesně 16 kouzel. Green-Flame Blade: nahradit `{{spellcasting_mod}}` hodnotou v `cantripDamageAtLevel`.
- Kde (≈6 míst): `toCaster`/`SpellCaster` + pole `abilityModifier`; `leveledSpellDice` a `cantripDamage(AtLevel)` volitelný parametr mod; `spellActionData`; `spellEffect` + jeho volání CharacterSheet.tsx:922 (potřebuje caster); Bonus Action skupina CharacterSheet.tsx:1040; `fixedCaster` v itemSpellRows.ts.
- Zobrazení „1d8 + 3", záporný „1d8 − 1"; `{@scale…}` dál jen na kostky.
- Otázky pro uživatele: (a) čtení prózy vedle tagu jde proti D206 („tags, not the prose around them") a D21 — povolit novým rozhodnutím? (b) neznámý caster (unresolved, fixed item): „1d8 + mod" textem, nebo jen „1d8"? (c) mod 0: „1d8" nebo „1d8 + 0"? (d) zbylých 10 netypických kouzel a Shillelagh/True Strike mimo rozsah? (e) Healing Spirit/Arcane Vigor bez kostek v tagu — ignorovat?

## Rozhodnutí / subagent
Žádné rozhodnutí v kódu. Subagent nepoužit.

Manual browser check for the user: none.
