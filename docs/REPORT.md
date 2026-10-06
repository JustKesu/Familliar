# REPORT — M6 (step 10): level gains on class and character level axes (D328)

## Changed
- `levelGains.ts`: `levelGainsFor(character, target: LevelUpClass, …)`; `level` = total + 1, `classLevel` = target's level + 1
  (new class 1); `LevelGains` + `classLevel`/`className`/`classSource`. `characterAtLevel` changes only the target entry
  (before = without it at class level 1). Class step, expertise, languages/tools/skills, class optional features, featAsi,
  spells read `classLevel`; spell delta sums only the target's `SpellCountEntry`s; hit points on character level.
  Unresolved: no class, character level > 20, class level > 20, class missing from classes.json. Multiclass block removed.
- New class at class level 1 excludes the non-subclass `CLASS_TOOL_CHOICE_GRANTS` (starting proficiencies, D170):
  Bard XPHB (3 instruments), Monk XPHB (1 artisan tool or instrument), Artificer EFA (1 artisan tool). Saves, starting
  equipment and class skills are not level-up steps, so nothing to exclude there. M7 comment placed in `languagesStepGain`.
- `levelUpSteps.levelUpTarget` now holds the D316 block (same text) after the level-20 check, and returns the class;
  `LevelUpButton` / `LevelUpWizardGate` pass it to `loadLevelGainsFor(character, target)`.
- New `featAsi/featAsiCharacterLevels.ts` (+ test): class-level ASI/Epic Boon → character level via `levelOrder`; single
  class without history OK; multiclass without consistent history → unknown with the specified reason. Not wired in.
- `levelRemoval.ts`: `levelRemovalPlan` = unchanged gate + new exported `levelRemovalCore` (class of `levelOrder.at(-1)`,
  else the only class). Character axis: masteries, expertise, optional features, featAsi, hit points. Class axis (that
  class's level): subclass, fighting style, `classFeatureChoices` / `subclassSpellChoices` of that class only, language/
  skill/tool grants. Class to 0 → "Removing the last level of a class is build order step M8."
- `characterLevel.ts`: `raisedClass`, `levelOrderAfterLevelUp`; `wizardState.saveCharacter` appends the raised class.
- `characterStore.buildCharacter`: multiclass + inconsistent `levelOrder` throws `ImportValidationError` ("The level
  history could not be saved: classes are Wizard 1 / Fighter 2, but the history has Wizard 1 / Fighter 3."). Single class
  and import/read unchanged.
- Tests: `levelGains.fixtures.ts` + Warlock and Wizard XPHB (PHB 2024 counts, ASI 4/8 and 4). `levelGains.test.ts` calls
  go through `gainsAt` (stored one level below the asked level, which the old signature passed separately), expectations
  unchanged; the old "multiclass is unresolved" test now checks `levelUpTarget` + a named-class answer. New: Sorcerer 3→4
  ASI and spell delta, Warlock 6→7 no ASI, Warlock 6 + Sorcerer 1, Warlock 6 + Bard 1 (no instruments), Fighter 4 + Wizard
  1 (no Fighter mastery), level 21. `levelRemoval.test.tsx`: core on [Wizard 1, Fighter 2] / [W, F, F], level-0 refusal,
  gate; slot test filters the new fixture Warlock. `characterStore.test.ts`, `characterLevel.test.ts` additions.

## Verified
- typecheck, test (169 files / 3122), validate-data (175/175), e2e 449 passed (4.4 min; multiclassGuard green).

## Decisions taken / questions worked around
- Prompt listed "a stored subclass missing from classes.json" as unresolved; the existing test (`unresolved` null, class and
  spells steps unknown) was kept as is, since expectations were not to change. Your call if it should become unresolved.
- `levelUpTarget` checks level 20 before multiclass so a level-20 multiclass keeps its old text.
- Class-feature language picks at class level 1 (`CLASS_FEATURE_LANGUAGE_GRANTS`) still count for a new class; they are
  class features, not starting proficiencies.
- `fightingStyleFor` falls back to a style with no owner class; in multiclass that may attribute it to the removed class (M8).

## Manual browser check for the user
Nothing new to check by eye: no UI change in this task.
