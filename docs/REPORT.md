# REPORT — M7a (step 10): level up an existing class of a multiclass character (D329)

## STEP 1 inventory
| Place | Did | M7a |
|---|---|---|
| levelUpSteps `levelUpTarget` | blocked 2+ classes, else `classes[0]` | `levelUpClassOptions` + `levelUpTarget(c, chosen?)`; no-history reason; class < 20 |
| LevelUpButton / LevelUpWizardGate | one target from `classes[0]` | gains per class, `LevelUpClassDialog`; gate takes route class |
| route.ts / CharacterManager | `/level-up` only | `/level-up/<class>/<source>` for 2+ classes |
| heldPicks `heldPicksFrom`/`overwrittenHeldPicks` | `classes[0]`, all classFeatureChoices / non-subclass optional features | active class + its featureTypes |
| wizardState `wizardDataFromCharacter` | `classes[0]`, every class's spells/choices/forms | `lookups.activeClass`: per-class fields of that class only |
| wizardState `saveCharacter` guard, `classes`, keepHeld*, style ~1307, spell/feature/subclass-spell/forms/optional records | single class rebuilt | raise one class (`checkOneClassRaised`), others' records passed through, keepHeld* over all classes |
| wizardState `wizardToolGrants`/`wizardSubclassSkillGrants`, featAsi completeness | grant level = `levelUpTargetLevel` (character) | grant level = class level; filter-choice counts at character level |
| CharacterWizard seed ~298, header ~1528 | `classes[0]`, level = character level | active class, `classChoice.level` = class level |
| CharacterWizard draft max HP ~1160, HP step `hitDieKey` | single-class draft | all classes + new `levelOrder`; die/gate = active class (unchanged code) |
| CharacterWizard `loadFeatAsiGrants` ~926 / `useFeatAsiStepData` | class levels read as character levels | multiclass: `featAsiCharacterLevels` over the draft |
| featAsiLevels `loadClassPrereqInfo` | one class's starting armor/weapons | multiclass: `prerequisiteClassProficiencies` (moved to classProficiencies.ts), any-class spellcasting/style |
| masteryData ~194 | one class's starting weapons | multiclass: `classProficiencyGrants` |
| expertisePool / Expertise + Mastery counts | count = active class's | held + (new − old class count); held Expertise exempt from Scholar |
| ReviewStep | "Class N", `Nd faces` | "Warlock 6 / Sorcerer 4", every class's dice; What's new / ASI row already on character level |
No STOP: every rule came from the prompt or D316–D328.

## Changed
- New: `levelUp/LevelUpClassDialog.tsx`, `levelUp/multiclassLevelUp.ts`, CSS `.level-up-class*`.
- `WizardData.activeClassFeatureTypes` (set only in a multiclass level up) tells the raised class's optional-feature entries from the others'.
- `MasteryPicker` (`multiclass`, `countOffset`), `ExpertisePicker` (`countOffset`, `restrictionExempt`) — props unused outside multiclass level up.
- Creation, Edit and single-class level up take the old code paths (no multiclass branch entered).

## Verified
- typecheck OK; test 170 files / 3141 OK; validate-data 175/175; e2e 456/456 (5.2 min — over the ~3 min guideline).
- Unit `levelUp/multiclassLevelUp.test.tsx`: seed per active class; Sorcerer 3→4 in W6/S3 keeps Warlock spellChoices,
  fightingStyles, EI optional features, classFeatureChoices byte-identical, Sorcerer 4, levelOrder +Sorcerer; class +2 throws;
  `checkOneClassRaised` (two classes, +2, reorder, other subclass); `levelUpTarget`; dialog (labels, focus, Cancel, choice);
  Wizard 3/Fighter 1 → Wizard 4: medium armor, Heavily Armored eligible, ASI card at character level 5; single Wizard 4 unchanged;
  Rogue 3/Fighter 1 mastery pool gets Greataxe. `route.test.ts` class route round trip + invalid shapes.
- Changed expectations (old multiclass block text): `levelUp.test.tsx` "offers no usable button for a multiclass character" now
  expects the no-history reason; `levelGains.test.ts` D316/D328 case now calls `levelUpTarget(c, Rogue)` → no-history reason.
- E2E `multiclassLevelUp.spec.ts` M7a a–g (window/Cancel/focus, Sorcerer walk to sheet incl. STR 10 and HP 54→59, Warlock walk +
  Devil's Sight, F5, no-history reason, single Fighter without window, Edit/Remove disabled). `multiclassGuard.spec.ts` unchanged
  and green (its migrated schema-56 import has no levelOrder, so Level up is still disabled).

## Decisions taken / questions worked around
- Masteries/Expertise across classes are one list each (no class tag): required = held + this class's increase. A character with
  two mastery classes therefore works, but nothing records which class a held mastery came from.
- A fighting style stored without a class (pre-58 multiclass) is attributed to the raised class if `fightingStyleFor` falls back to
  it; such characters have no levelOrder, so they cannot reach this path today.
- `LevelUpButton` loads gains for every class; a class whose gains are unresolved is disabled in the window with its reason as tooltip.
- Classes' own non-class-axis creation picks (classSkills, toolChoices, featureLanguages, subclassSkills) stay whole in WizardData;
  slot pickers replace only their own `grantedBy`, save keeps them via grants of all classes.

## Manual browser check for the user
- Class window (sheet header → Level up on a multiclass character with history, e.g. Warlock 6 / Sorcerer 3): look, button width
  and alignment, focus ring on the first class button and on Cancel, dark and light theme, 1366 and 1920 wide.
- Review step of a multiclass level up: identity line "Warlock 6 / Sorcerer 4" and Hit dice "6d8 + 4d6" wrapping.
