# RV-1 — "Options removed" row in level-up Review (D390)

Setup: `git fetch`, `git merge --ff-only origin/main` → already up to date, HEAD 08c3903. Branch unchanged (main).

## STEP 1 — where each kind lives

| Kind | WizardData | Baseline (same shape, `baseline: WizardData`) |
|---|---|---|
| Class options EI, MM | `classOptionalFeatureChoices[featureType].choices` | same field on `baseline` |
| Subclass options RN, MV:B | `optionalFeatureChoices: string[]` | same field on `baseline` |
| Fighting Style | `fightingStyle: string \| null` | same field on `baseline` |

Everything was already on `baseline`; no new data path. One touched place in code (ReviewStep), well under the ~10 limit.

## What changed
- `src/creation/review/ReviewStep.tsx`: `optionsRemoved` = `countedNames` of `lostCopies(baseline, data)` for class options (per featureType), subclass options, plus the baseline Fighting Style when it differs from the current one. Row "Options removed" follows "Options added", inside the `levelUp` card, so only in a level up; hidden when empty. No schema or storage change.
- `e2e/levelUpSwap.spec.ts`: `levelUp()` takes an optional `onReview` callback run before Save; scenarios RV-1 a (Warlock swap: added + removed), b (no swap: no row), c (Battle Master Parry + Defense style: one row "Defense, Parry"), d (Replace then Keep: no row).
- `docs/DECISIONS.md` D390; `docs/STATUS.md` B-5 line amended and RV-1 entry added.

## Verified
typecheck clean; vitest 3444/3444; validate-data 177/177; e2e 693/693 (2.5 min).

## Decisions / questions
- Fighting Style removed = baseline style differs from current (no per-copy semantics; one style per class step). In a multiclass level up `baseline.fightingStyle` is the active class's style as seeded — not separately tested.
- No subagent used.

## Manual browser check for the user
None - the planning chat checks the looks from screenshots.

Changed screens: level-up Review, "Level N — What's new" card (new "Options removed" row).
