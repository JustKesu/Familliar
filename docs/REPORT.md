# REPORT — M11a: multiclass end-to-end e2e (Warlock/Sorcerer, Cleric/Paladin, Fighter/Rogue)

## Výsledek
- Celá e2e sada: **513 passed, 1 skipped (fixme), 0 failed**, 5,1 min (2 workery). `npm run typecheck` OK, `npm test` 3245 passed.
- Nový `e2e/multiclassEndToEnd.spec.ts`: 3 passed + 1 fixme; samostatný běh 39,5 s (2 workery). `src/` beze změny.
- Testy: `M11a A` (Warlock 1 → W3/S3), `M11a B` (Cleric 1 → C3/P3), `M11a C` (wizard Fighter 1 → F3/R2), `M11a finding 1` (fixme).
  Každý: level upy přes okno Level up / „+ New class…“, kontroly listu, Export → Import (kopie: stejný řádek tříd a max HP),
  Edit přes přepínač tříd (změna jedné volby druhé třídy, reload, volby první třídy beze změny), Remove level (poslední úroveň
  z `levelOrder`, hodnoty listu), pak odebírání do zmizení druhé třídy (řádek tříd, kouzla/pooly/skilly/featury pryč, `levelOrder`).

## Nálezy
| # | Kombinace | Kroky | Očekávané (zdroj) | Skutečné | Posouzení |
|---|---|---|---|---|---|
| 1 | A, B (každý level up na úroveň podtřídy) | seed Warlock 1 → Level up „Warlock 1 → 2“ (Hellish Rebuke, 2 invokace) → Level up „Warlock 2 → 3“ → Fiend Patron → Next | Spells drží picky Warlock 2: Cantrips 2/2, Prepared 3/4 (tabulka Warlock; PHB 2024 level up kouzla neodebírá) | Cantrips 0/2, Prepared 0/4, v Prepared Spells jen always-prepared Fiend kouzla; po Save má třída jen znovu vybraná kouzla | app bug. `setSubclass` (`src/creation/wizardState.ts:1422`) nastaví `spellChoices: []`; v Editu při změně podtřídy záměr (M9b b), v level upu (null → podtřída) ne. Stejně Sorcerer 2→3, Cleric 2→3, Paladin 2→3. Test `M11a finding 1` je `test.fixme`; ověřeno jedním během bez fixme (selhal na „Prepared: 0/4“). Hlavní toky A a B kouzla po výběru podtřídy vyberou znovu (komentář „M11a finding 1“). |

## Očekávané hodnoty a zdroje
Tabulky = `data/classes.json` XPHB přes `scripts/investigate-m11a-tables.js` (necommitnutý). HP: PHB 2024 — úroveň 1 maximum kostky, dál pevný průměr (d6 4, d8 5, d10 6) + CON mod za úroveň; XPHB Dwarf Dwarven Toughness +1 za úroveň (všechny tři postavy jsou Dwarf).
- A saves WIS+CHA: Warlock `proficiency ["wis","cha"]`; PHB multiclass: savy jen z první třídy.
- A sloty: Warlock L3 `Spell Slots 2, Slot Level 2` → Pact 2× 2nd; Sorcerer L3 `1st 4, 2nd 2` (jediná třída se Spellcasting → její tabulka, PHB). Po odebrání L6: Sorcerer L2 `1st 3`, 2nd 0.
- A HP: d8 8 + 5 + 4 + 4 + 5 + 4 = 30, CON 13 +6, Dwarf +6 = **42**; po odebrání L6 **36**; Warlock 2 **17**.
- A počty: invokace L1 1 / L2 3 / L3 3; Warlock cantrips 2, prepared 2/3/4; Sorcerer cantrips 4, prepared 2/4/6; Metamagic 2 na Sorcerer 2 (PHB).
- B saves WIS+CHA: Cleric `proficiency ["wis","cha"]`.
- B sloty: caster level 3 + ceil(3/2) = 5 (PHB 2024 zaokrouhlení nahoru) → řádek 5 plné tabulky (Cleric L5 `4,3,2`); po odebrání L6: 3 + 1 = 4 → `4,3`; Cleric 2: `3`.
- B Channel Divinity: Cleric L3 2, Paladin L3 2 (L2 0) → dva pooly po 2; po odebrání Paladin 3 jen „Channel Divinity“ 2 s utracenou 1.
- B HP: d8 8 + 5 + 6 + 6 + 5 + 6 = 36, +6 CON, +6 Dwarf = **48**; po odebrání L6 **40**; Cleric 2 **17**.
- B zbroj: Paladin `multiclassing.proficienciesGained` armor light/medium/shield, weapons martial; Cleric 2 (Thaumaturge) Martial weapons nemá.
- C saves STR+CON: Fighter `["str","con"]`; Rogue `proficienciesGained` saves nemá.
- C mastery: Fighter tabulka `Weapon Mastery 3` (L1–3); Rogue 2 (PHB Rogue L1, sloupec v tabulce není). Expertise 2 na Rogue 1, multiclass skill 1 + Thieves' Tools (`proficienciesGained`). Sneak Attack R1, Cunning Action R2, Second Wind F1, Action Surge F2 (PHB).
- C HP: d10 10 + 6 + 5 + 5 + 6 = 32, +5 CON, +5 Dwarf = **42**; po odebrání L5 **34**; Fighter 2 **20**.

## Seedy a rozhodnutí
- Seed (schema 60, `levelOrder` 1, `createdAtLevel` 1) jen A Warlock 1 a B Cleric 1 — wizard helpery umí jen Fightera. Obojí Dwarf, Soldier
  (origin feat Savage Attacker bez podvoleb; Acolyte má Magic Initiate s podvolbami), standard array, +2 STR +1 DEX, Common/Dwarvish/Elvish.
  A: CHA 15, skilly arcana/deception, Eldritch Blast, Minor Illusion, Hex, Armor of Agathys, invokace Armor of Shadows (level 1).
  B: STR 12→14, WIS 15, CHA 14, skilly history/insight, Divine Order Thaumaturge (4 cantripy; Protector by dal Martial weapons a zakryl Paladina), 4 cantripy + 4 kouzla.
- C přes skutečný wizard (`createFighter`, Acolyte): DEX 14 stačí, žádný seed ani background navíc.
- Paladin vstup: krok Class vybere Longsword/Warhammer jen pokud seznam mastery existuje — test neověřuje, zda ho app nabídla.
- Počty mastery u C ověřeny v Editu („All 3 / All 2 weapon masteries chosen.“) a v uložených datech, ne na listu.
- Rozhodnutí pro uživatele: oprava nálezu 1 (zachovat `spellChoices` při prvním výběru podtřídy v level upu).

## Manual browser check for the user
- Nic — úloha přidává jen e2e testy, UI se nezměnilo.
