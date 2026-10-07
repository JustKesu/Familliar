# Review — M5 to M7 multiclass spells, level up and new class, `888f576..7fedca6`

Scope: `86d0e59` (M5a, D325), `2cad8c9` + `ac39cf4` (M5b, D326/D327), `06db67d` (M6, D328), `1e6bc6a` (M7a, D329),
`33281fc` + `7fedca6` (M7b, D330); `git log 888f576..HEAD` ends at `7fedca6`, nothing beyond it. Read as diffs:
SpellList.tsx `combineSpellEntries`/`spellEntryKey`, classSpellLimits.ts, spellActionRowData.ts `casterFor`,
spellsTabData.ts pools, the CharacterSheet spell/CAST hunks, levelGains.ts, levelRemoval.ts `levelRemovalCore`,
levelUpSteps.ts, featAsiCharacterLevels.ts, featAsiLevels.ts multiclass loader, characterLevel.ts, LevelUpButton,
LevelUpWizardGate, route.ts, heldPicks.ts, multiclassLevelUp.ts, multiclassPrerequisites.ts, multiclassPicks.ts,
classProficiencies.ts, skills.ts, mastery/expertise pickers, storage (character.ts, characterStore.ts,
migrations.ts 59→60, validate.ts). Read by offset: wizardState.ts `wizardDataFromCharacter`, `saveCharacter`, the
languages/class step gates, `wizardToolGrants`; CharacterWizard.tsx seed, drafts, previous-count offsets,
`classPickRequirements`; proficiencies.ts tool section; migrations 57/58. Grepped: `classes[0]`, `classes.length === 1`,
`firstClass(`, Breath Weapon, e2e and unit test names. Nothing ran except git. Rules checked against the 2024 PHB
multiclassing text: prerequisites 13 in the new and every held class's primary ability, spells known/prepared per class
as if single-classed, any slot (ordinary or pact) may cast any class's spell, a later class gets only
`proficienciesGained` (no saves, no starting equipment), HP of the class taking the level, ASI by class level,
Breath Weapon by character level. No rule error found in the main paths; one reachable display bug.

## Findings

1. **Bug (reachable now).** `src/calculation/proficiencies.ts:290`, `src/sheet/ManageFeatsPanel.tsx:81`. A subclass
   tool pick is read only for `firstClass(character)`. The wizard side is correct (`wizardToolGrants`,
   `wizardState.ts:365-377`, reads the raised class at its class level; `saveCharacter` keeps picks over
   `classToolGrantsFor(classes)`). Example: Wizard 5 / Fighter 2 (levelOrder starts Wizard) raises Fighter to 3 and
   takes Battle Master. The Languages step asks for the Student of War artisan's tool, the save stores it in
   `toolChoices`, but the Proficiencies card shows neither the tool nor a pending line. Manage Feats' "held tools" also
   miss it, so a feat could offer the same tool again. The data is not lost.
   Fix: run the subclass-grant loop over `character.classes` (each class with its own subclass), and keep the
   starting-tool block on the first class only. Test: e2e Wizard → Fighter 3 Battle Master, then check the tool on
   Proficiencies; plus a unit test of `computeProficiencies` with a second-class Battle Master.

2. **Wrong number (reachable now, known point a).** `src/sheet/SpellList.tsx:164-193`,
   `src/sheet/spellActionRowData.ts:108-114`. A spell chosen by class A and always prepared by class B's subclass is
   one row. It casts with A's numbers and counts against A's limit. Example: Wizard 3 / Cleric 3 (Light Domain), with
   the Wizard picking Burning Hands. The row shows the INT DC, although the Cleric copy is prepared anyway and
   would use WIS. The player cannot get the WIS row, and the Wizard pick takes up a slot of the Wizard's count.
   Fix: give the subclass grant its own row (`rowKey` with the subclass owner), as two choosers already get. Test:
   a classSpellLimits unit test, chosen by Wizard plus Light Domain grant, expecting two rows with INT and WIS DCs.
   See question 1.

3. **Latent (M8).** `src/storage/validate.ts:254-268`, `:1457-1463`; `src/storage/characterStore.ts:364`. A
   `multiclassPicks` entry naming a class the character no longer has blocks the whole write, and read repair then
   drops the WHOLE list, not only that pick. This is unreachable today, because `levelRemovalCore`
   (`levelRemoval.ts:107`) refuses to remove a class's last level. M8 must filter the removed class's picks. Read
   repair should then drop only the stale entries. Validation also accepts a pick tagged with the first class, which
   never gets multiclass picks, and duplicate picks (import only). Test: a unit test removing Rogue 1 from
   Fighter 4 / Rogue 1, expecting the Rogue skill pick gone and the Fighter records kept.

4. **Latent.** `src/levelUp/LevelUpButton.tsx:49-60`. All held classes' gains load in one `Promise.all`. One
   rejected load, or every held class unresolved (for example a held class missing from classes.json), turns the
   whole button unavailable, so "+ New class…" cannot be reached either. Fix: use `allSettled`, and show the dialog
   whenever any option or a new class remains. Test: a LevelUpButton unit test with one `loadGains` rejecting.

5. **Wrong choice offered (reachable now, known point f).** `src/creation/wizardState.ts:369-372` (and the
   MulticlassPickSlots pool, which uses the same held list). The Bard multiclass instrument excludes only the
   background tool and stored `toolChoices`. Feat tools are not excluded. Example: an Entertainer Fighter, with
   Musician as the origin feat (three instruments), enters Bard and is offered those same three instruments. A
   duplicate pick is a wasted proficiency. Fix: add `featInstances` tool grants to `heldElsewhere` for the multiclass
   slot. Test: a unit test of the pick pool with Musician.

6. **Cosmetic / not traced.** `src/sheet/CharacterSheet.tsx:2423` (`singleClass` null for 2+ classes) affects the
   class-or-subclass origin label of chosen options under multiclass. `src/sheet/featuresTabData.ts:108` returns no
   "From <class> n" label for 2+ classes. Both paths can be reached now and give no wrong number. The visible effect
   was not traced.

7. **Test gap.** The specs cover the happy path of each slice, with seeds the app can now produce (schema 59/60, a
   consistent levelOrder, per-class `spellChoices`). Missing:
   - a non-first class with a subclass grant on the sheet (finding 1);
   - the chosen + subclass overlap (finding 2);
   - a multiclass level up where the raised class has a subclass with optional features, which exercises the
     `activeFeatureTypes` / `otherOptionalFeatureChoices` partition by featureType (Battle Master maneuvers next to
     Warlock invocations);
   - CAST disabled on an `unavailable` row;
   - entering a martial class while already holding masteries (offset path `CharacterWizard.tsx:648, :681`; read:
     level 0 → `null` → 0, so the count is correct, but no test pins it).
   `levelRemoval.test.tsx` gained 64 lines; its `levelRemovalCore` multiclass cases were not read in detail.

## Checked, no finding

- `classSpellLimits`: each class is capped and counted from its own table, against only the picks it made.
  `chosenSpellCap` falls back to the D106 single-class reading. `casterFor`: a pick uses its chooser, and a
  class/subclass grant uses its owner.
- `castSpell` spends only the pool its button names. Upcast rows reach the pact section. The D327 pact row appears
  only when the spell has no slot of its own level and no higher-level text.
- `levelGainsFor`: character level vs class level is correct on every step. HP uses the character level, with the
  maximum only at level 1. A new class gets only subclass tool grants (`grant.subclass`). Spell counts use only the
  target class. `featAsiCharacterLevels` maps class-level grants onto levelOrder.
- `levelRemovalCore`: character-level stamps (masteries, expertise, optional features, feat/ASI, HP) match the
  writers (`levelUpTo` in `saveCharacter`). Class-level ones are filtered by `ofClass`.
- `saveCharacter`: `checkOneClassRaised`, `otherClassRecords`, `overwrittenHeldPicks` (with active-class scoping and
  multiclass picks), and the new class appended last. `levelOrderBeforeLevelUp` rebuilds history only when entering
  from a single class. The write error for an inconsistent multiclass levelOrder (`characterStore.ts:366`) is in
  place. No other class's record can change, as far as I read.
- Migration 59→60 only tags the version. The validator, `toCharacter`, writer and readers (skills.ts,
  classProficiencies.ts, Expertise pool via `multiclassSkillSources`, Review `classLine`) are consistent. Read repair
  for schema ≥ 59 is fine: older saves are migrated first and stay excluded.

## Known points

- a) Bug-level design gap: finding 2. The disabled CAST on an unavailable row also applies to single-class
  characters: acceptable, since an over-cap pick cannot legally be cast.
- b) Acceptable. Removal works by character-level stamps, not by class. It is a gap only for M9 Edit, which would
  have to re-attribute picks.
- c) Latent. The claim holds for data the app produces: migration 58 sets the owner for single-class saves, an old
  multiclass save has no levelOrder, and `levelUpClassOptions` blocks it. New saves always write `className`. Only a
  hand-made import (classless style plus a consistent multiclass levelOrder) reaches the fallback.
- d) Acceptable. Class/Spells steps are unknown; languages/tools/skills read static grant tables by subclass name.
  The other steps are correct.
- e) Acceptable. XPHB origin feats grant no ability scores.
- f) Wrong choice offered: finding 5.
- g) Acceptable (cosmetic). One sentence per class, joined, new class first.
- h) Confirmed. `LevelUpWizardGate.tsx:44-53` checks `loadUnmetMulticlassPrerequisite` and calls `onUnavailable`.
- i) Wizard side works for any class (class-level filter). Sheet side does not show the subclass tool of a
  non-first class: finding 1. Subclass skills on the sheet (`subclassSkillSourceNames`) and the Unfettered Mind note
  were not verified.
- j) Correct. `CharacterSheet.tsx:3254` passes `totalCharacterLevel`. The PHB 2024 Breath Weapon scales with
  character level (5/11/17).

## Not reviewed

- MulticlassPickSlots.tsx and LevelUpClassDialog.tsx UI details.
- index.css.
- The bodies of e2e specs, beyond names and seeds.
- The bodies of `levelGains.test.ts` and `levelRemoval.test.tsx`.
- How the class-feature and subclass-spell pickers stamp `grantedAtLevel` in a multiclass walk. This was assumed to
  be the class level, as `levelRemovalCore` expects.
- Subclass skill readers on the sheet.

## Questions for the user

1. Spell chosen by one class and always prepared by another class's subclass (finding 2): should it be two rows, or
   one row with the chooser's numbers? Recommendation: two rows, consistent with D325's two-chooser rule. RAW lets
   the player cast it as either class, and the pick then frees a slot of the chooser's count once the player
   notices.
