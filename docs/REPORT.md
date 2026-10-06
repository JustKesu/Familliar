# Report — M1b: fighting style per class and option sources, schema 58

## What changed
- Schema 58 (D318). `Character.fightingStyle` → `fightingStyles?: CharacterFightingStyle[]` ({className?, classSource?, name, source?}); `CharacterOptionalFeatureChoice.choices` → `CharacterOptionalFeaturePick[]` (own type, optional `source`); `LeveledChoice` untouched. `fightingStyleFor(styles, owner)` in character.ts.
- Migration 57→58 (migrations.ts): null/absent → absent; 1 class → assigned entry; ≥2 or 0 classes → one unassigned entry; picks untouched; a malformed old value moves to `fightingStyles` so validation rejects it (fatal on list(), same mechanism as before).
- Shared rule `matchesPick`/`findPicked` (new storage/choiceMatch.ts). Readers switched: optionalFeatureData (evaluateClassOptionalFeatureGroups, chosenClassOptionalFeatures, chosenOptionalFeatureOptions — now takes the style list), optionalFeatureSpells, grantedSenses, beastData (`hasPactOfTheChain` vs {Pact of the Chain, XPHB}), calculation/fightingStyles, ManageFeatsPanel (one row per style, chip = its class), CharacterSheet (option origin, item invocation picks carry source), levelRemoval (drops the class's own entry), heldPicks, wizardDataFromCharacter.
- Validation: `describeFightingStylesError` (array; name; source/className/classSource non-empty when present; both class fields or neither; ≤1 entry per class and ≤1 unassigned); pick `source` checked. Unknown extra keys are dropped on read by `toCharacter…`, as every other nested field (no validator in validate.ts rejects extra keys; "rejected as for other fields" implemented as that). `buildCharacter` refuses a write the validator would reject.
- Writes: `saveCharacter` gains trailing `pickSources?: PickSourceLookup` (new optionalFeatures/pickSources.ts, loaded once in CharacterWizard). Every save writes className/classSource; a pick or style without a source gets the source of the row its name resolves to today (first same-named row); a stored source is kept. Applies to create, Edit, level up. Manage Feats only reads the style (no write path). Pickers still hold names (WizardData unchanged).
- Extra files beyond the 16 listed: new choiceMatch.ts, pickSources.ts; comment-only FightingStylePicker.tsx, OptionalFeaturePicker.tsx. levelGains.ts and featAsiData.ts match the grep only via `grantsFightingStyleAt`/`optionalFeatureChoicesFor` — no change needed. ClassOptionalFeaturePicker.tsx unchanged (source added at save).
- Docs: D318 (DECISIONS), STATUS M1b, DATA.md "Option names across books — none twice today" (survey: 10 FS feats, 11 featureTypes, 0 same-name multi-source; Pact of the Chain = 1 row XPHB).

## Verified
- typecheck pass; `npm test` 166 files / 3036 tests pass; validate-data 174/174; full e2e 426 passed (4.7 min).
- New unit: migrations.test (57→58: none/null, one class, two classes, no class, picks untouched, malformed, last step); characterStore.test (realistic schema-57 Fighter 5 and Battle Master 3 load identically except the new field, 2-class save/reload, export→import, schema-57 import, 6 malformed shapes fatal, bad pick source fatal, extra keys dropped, write refuses duplicate class); choiceMatch.test (with/without source, missing source, fixture PHB/XPHB pair distinct after save+reload, hasFightingStyle, lookup); wizardState.test (new save writes class+source, edit keeps stored source and backfills, no lookup → class only).
- New e2e `choiceSources.spec.ts`: M1b a (schema-57 Fighter: Longbow +7 / Archery breakdown and Fighting Style row as before; level up → `fightingStyles` = [{Fighter, XPHB, Archery, XPHB}]), M1b b (schema-57 Battle Master 6: maneuvers under Combat Superiority as before; level up to 7 picks 2 maneuvers stored with level 7 + source XPHB).

## Existing tests changed (renamed field / schema number / exact stored object)
- sheetReviewFixes.test (4 inputs), levelRemoval.test (2 inputs + style-removal expectations), levelUp.test, levelUpClassStep.test, CharacterSheet.test (3 inputs), characterStore.test (2 tests + schema-56 load expectation), wizardState.test (storedCharacter fixture, `as Character` fixture, 4 expected store inputs), CharacterWizard.test (expected store input): `fightingStyle` → `fightingStyles`.
- migrations.test M1a test: expected schemaVersion 57 → 58, `CURRENT_SCHEMA_VERSION` assertion moved to the new block.
- e2e levelOrder.spec: schemaVersion 57 → 58; wizardF1.spec a/b: read `fightingStyles`; expertiseE1.spec: setup deletes `fightingStyles` (was a no-op after rename).

## Decisions taken / noticed
- Backfilling a sourceless held pick at save with the first same-named row's source (needed for the required e2e expectation; equals what the sheet reads). Recorded in D318.
- Real flow: a level up now adds sources to held picks, so level up + Remove level is no longer byte-identical in the browser (levelRemoval.test passes no lookup and still is).
- Pickers stay name-keyed: a hypothetical stored second-row source would display the first row as chosen in the wizard; no such pair exists in data.
- Investigation script `scripts/investigate-same-name-options.js` left untracked (not committed); `git clean` not run per this session's rules.

## Manual browser check for the user
Nothing to check: no visible change.
