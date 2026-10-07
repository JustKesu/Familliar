# REPORT — M7b (step 10): enter a new class on Level up, prerequisites, multiclass picks (D330, schema 60)

## STEP 1 data check (`scripts/investigate-multiclass-entry.js`, removed after push)
```
Artificer|EFA|primary=int|skills=[{choose:{from:7,count:1}}]|tools=[{tinker's tools:true}]
Bard|XPHB|primary=cha|skills=[{choose:{from:18,count:1}}]|tools=[{anyMusicalInstrument:1}]
Fighter|XPHB|primary=str OR dex   Monk|XPHB|primary=dex+wis   Paladin=str+cha   Ranger=dex+wis|skills from:8
Rogue|XPHB|primary=dex|skills=[{choose:{from:10,count:1}}]|tools=[{thieves' tools:true}]   others: one ability, no picks
```
All 13 offered classes have primaryAbility; only the allowed choice shapes occur → no STOP. Recorded in DATA.md.

## Changed
- Schema 60 `Character.multiclassPicks` (character.ts, migration 59→60 tag only, validate.ts `describeMulticlassPicksError`,
  dropped on read like portrait/speciesCantrip, refused on Import and on write in `buildCharacter`, `toCharacter` carries it).
- New `src/multiclass/`: `multiclassPrerequisites.ts` (primaryAbility OR/AND, reasons, `loadNewClassOptions`),
  `multiclassPicks.ts` (`multiclassPickShape`, readers), `MulticlassPickSlots.tsx` (Languages step selects).
- `LevelUpClassDialog`/`LevelUpButton`: window for every character, "+ New class…" list (lazy-loaded on open), disabled rows
  with the reason as text + `aria-describedby`. `LevelUpWizardGate` re-checks the prerequisite for a typed/reloaded route.
- `levelUpTarget` accepts a class not held; `CharacterManager` routes an entered class (classLevel 1) with the class.
- `levelGainsFor` languages step: "<Class> multiclass skill" / "<Class> multiclass instrument" parts for a new class.
- Wizard: entered class = M7a multiclass path from class level 0; `wizardToolGrants` drops starting tool picks at class level 1
  in a level up; `multiclassPickCount` gates Languages; `saveCharacter` appends the class (`classesAfterLevelUp`), rebuilds
  `levelOrder` for an old single-class save (`levelOrderBeforeLevelUp`), `checkOneClassRaised` accepts +1 existing or one new
  class at 1 appended last; held multiclass picks are protected (`overwrittenHeldPicks`), new ones only for the entered class.
- Readers: `skills.ts` source "<Class> (multiclass)", `classProficiencyGrants` tool picks, wizard proficient skills (Expertise
  pool, feat pickers, Review), other skill pickers' held lists, Manage Feats held skills.
- Side fix: wizard class skills in any level up are labelled with the first class (were labelled with the raised class).
- Schema-bump fix: `characterStore` read-repair (D320) ran only for `schemaVersion === CURRENT`; with 60 a stored schema-59
  character needing repair would have made the whole list unreadable. Now `>= 59` (`REPAIRED_FROM_SCHEMA`), as D320 states.
  Found by `e2e/storageRepair.spec.ts`; `stableIds`/`levelOrder` specs now expect stored schema 60.
- 21 e2e specs: every single-class "Level up to N" click now also clicks the held class in the window.

## Verified
- typecheck OK; test 171 files / 3163 OK; validate-data 175/175; e2e full run 459/462 (5.4 min, over the ~3 min guideline):
  the 3 failures were the schema-bump issue above; after the fix those 3 specs pass (5/5). The full suite was not re-run.
- Unit `src/multiclass/multiclassEntry.test.ts`: primaryAbility Fighter/Monk; prerequisites (STR-or-DEX, DEX-and-WIS, held
  class unmet blocks Wizard/Sorcerer/Cleric, ASI counted, item half-feat ignored); pick shapes and level gains (Bard instrument,
  no starting Bard tools); seed at class level 0; save appends Wizard 1, rebuilt levelOrder, Fighter records byte-identical,
  Rogue pick stored; guards (class level 2, pick for a non-entered class, checkOneClassRaised cases); Languages completion with
  `multiclassPickCount`; sheet skill source, Expertise pool, Thieves' Tools once / Bard Lute / no Wizard armor; validation.
  Migration 59→60 in `migrations.test.ts`. Changed expectations: `levelUp.test.tsx`, `App.test.tsx`, `CharacterManager.test.tsx`
  click "Fighter 4 → 5"; `multiclassLevelUp.test.tsx` levelUpTarget with a class not held now enters it.
- E2E `multiclassEntry.spec.ts` M7b a–g (a window; b+f Wizard without levelOrder: header, level 5, saves STR/CON only, cantrips,
  HP 40 → 47, Proficiencies card unchanged, then window "Fighter 4 → 5" / "Wizard 1 → 2"; c Sorcerer/Monk reasons; d Rogue incl.
  Expertise showing "Stealth (from Rogue (multiclass))", Thieves' Tools — Rogue (multiclass); e Bard skill + instrument; g Fighter
  20 and Fighter 19 / Wizard 1 disabled). `multiclassLevelUp.spec.ts` M7a f now expects the window for a single class.

## Decisions taken / questions worked around
- Reason text for an OR/AND class names every ability: "Needs Strength 13 or Dexterity 13 (Fighter, a class you already
  have). You have Strength 11, Dexterity 11."; several unmet classes are joined in one line, new class first.
- A typed route to a class not held but failing the prerequisite bounces to the sheet (same as other unavailable routes).
- Background origin feat ability bonuses are not counted by the prerequisite (as `abilityScoresBelowLevel`; XPHB origin feats
  give none).
- Held tools for the instrument pick = background tool + stored tool choices (not item/feat tools).

## Manual browser check for the user
- Class window (sheet header → Level up on any character, e.g. a Fighter 4): "+ New class…" button under the held class,
  the opened class list (scrolls inside the dialog), disabled rows and their reason lines (wrapping of the long OR/AND
  reasons, e.g. Monk, and of a held-class reason), focus ring on the first enabled class; dark and light theme, 1366 and 1920.
- Languages ("Proficiencies") step after choosing Rogue or Bard in that list: the "Rogue multiclass skill" / "Bard multiclass
  skill" and "Bard multiclass instrument" selects beside the other picks; both themes, 1366 and 1920.
