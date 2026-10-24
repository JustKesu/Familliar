# REPORT — RB-2: volby Lore a Fey Wanderer, pool masteries, výhody na záchranné hody z povolání

Setup: `git fetch` + `git merge --ff-only origin/main` → „Already up to date“, HEAD `893c437`.

## STEP 1 — Část A (D393), skript `scripts/rb2-survey.js`

| Rys | Znění | Výsledek |
|---|---|---|
| College of Lore — Bonus Proficiencies (XPHB 3) | „three skills of your choice“ | řádek `count: 3`, `from: ALL_SKILLS`, `grantedBy: 'collegeOfLore'` |
| Fey Wanderer — Otherworldly Glamour (XPHB 3) | „one of … Deception, Performance, or Persuasion“ | řádek, `grantedBy: 'feyWanderer'` |
| Rocborne — Whispers of Knowledge (TGS2, classSource PHB) | „one skill **or tool** of your choice that you don't already have“, ztratí se při dalším použití / odpočinku, použití = WIS mod | **STOP** — neodpovídá žádnému vzoru (dovednost NEBO nástroj, dočasné, opakované). Nepřidáno. |

Soubory: src/classSkills/subclassSkillGrants.ts:2, :53–56; src/storage/character.ts:88–89, :1148 (schéma 66); src/storage/validate.ts:252–253;
src/storage/migrations.ts:605–610 (65→66, jen značí); src/storage/migrations.test.ts:818, :832, nový krok 65→66; e2e/levelOrder.spec.ts:41, e2e/stableIds.spec.ts:90.

## STEP 1 — Část B (D394)

| Třída | Znění Weapon Mastery | Omezení |
|---|---|---|
| Barbarian XPHB | „Simple or Martial Melee weapons“ | jen `type` M (nově) |
| Fighter XPHB | „Simple or Martial weapons“ | žádné |
| Paladin / Ranger / Rogue XPHB | „weapons … with which you have proficiency“ | jen proficiency (už bylo) |

Původ: Staff = items.json XPHB, `type: SCF`, scfType arcane, `staff: true`, simple, Topple; Wooden Staff = `SCF`, druid, simple, Topple —
oba fokusy duplikující Quarterstaff → odebrány (jediné SCF s mastery). Psychic Blade = XPHB item Soulknife (`type: M`, range 60/120, mastery
jako objekt s poznámkou „doesn't count against the number“) → odebrán vždy (poznámka sama říká, že se nevybírá). Soubor: src/masteries/masteryData.ts:144–148, :200–211; test masteryData.test.ts.

## STEP 1 — Část C (D395), 7 rysů (< 15)

| Rys | Třída / podtřída, úroveň | Řádek |
|---|---|---|
| Rage | Barbarian 1 | Advantage on Strength saves while raging |
| Danger Sense | Barbarian 2 | Advantage on Dexterity saves unless Incapacitated |
| Survivor | Champion 18 | Advantage on Death Saving Throws |
| Holy Nimbus | Oath of Devotion 20 | Advantage on saves forced by a Fiend or an Undead while Holy Nimbus is active |
| Beguiling Twist | Fey Wanderer 7 | Advantage on saves to avoid or end Charmed or Frightened |
| Psychic Defenses | Aberrant Sorcery 6 | totéž |
| Spell Resistance | Abjurer 14 | Advantage on saves against spells |

Vynecháno: Zealous Presence, Fortifying Soul (výhoda pro jiné tvory). Soubory: nový src/sheet/classSaveAdvantages.ts (+ .test.ts), src/sheet/CharacterSheet.tsx:97, :2370.
Celkem ~22 míst.

## Ověření

typecheck OK; test 3451/3451; validate-data 177/177; e2e 708 passed (3.5 min, nad limitem ~3 min). `e2e/rb2.spec.ts`: a) Bard 3 Lore (seed + Edit: Next čeká na 3 picky, Arcana/Nature/Medicine ● na sheetu, Edit drží hodnoty);
b) Ranger 3 Fey Wanderer (jen 3 dovednosti, uloženo `feyWanderer`); Rocborne vynechán (část A STOP); c) Barbarian: Longsword ano, Longbow/Pistol/Psychic Blade/Staff/Wooden Staff ne; Fighter Longbow ano;
d) Barbarian 2 Danger Sense pod Saving Throws i v draweru, Barbarian 1 ne; e) Rage s podmínkou „while raging“.

## Rozhodnutí během práce

- Scénář a) jde přes Edit uloženého Barda 3, ne přes nového: tvorba Barda 3 v průvodci by vyžadovala kouzla a expertízy; krok Proficiencies je tentýž.
- Psychic Blade odebrán i Soulknifovi (jeho mastery se do počtu nepočítá, tak ho nevybírá nikdo).
- Barbarian v multiclassu: omezení podle třídy, jejíž mastery se vybírá (`className` parametr).
- Rage řádek se ukazuje trvale s podmínkou (stav „raging“ appka nesleduje), jako Shell Defense.
- Otázka pro uživatele: Rocborne Whispers of Knowledge — jen poznámka na sheetu, nebo nic? Nyní nic.

Subagent nepoužit.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots. Změněné obrazovky: Edit/průvodce krok Proficiencies (selecty „College of Lore skill 1–3“, „Fey Wanderer skill“), krok Class and level (seznam Weapon masteries u Barbariana), sheet karta Saving Throws a její drawer (řádky Rage / Danger Sense apod.).
