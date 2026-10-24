# RV-1b — "Options added" covers runes, maneuvers and Fighting Style (D391)

HEAD at start: 447f7e8 (`git fetch` + `merge --ff-only`: already up to date).

## Changed
- `src/creation/review/ReviewStep.tsx`: `optionsAdded` now = class options (EI/MM, as before) + `lostCopies(data.optionalFeatureChoices, baseline.optionalFeatureChoices)` (RN, MV:B) + current `fightingStyle` when it differs from baseline. Same `countedNames`, alphabetical. Mirror of `optionsRemoved` (D390). No schema/storage change.
- Consequence (intended): a Fighting Style taken at a level that grants one now appears in "Options added".
- `e2e/levelUpSwap.spec.ts` RV-1 c: also expects "Options added: Archery, Feinting Attack".
- `docs/DECISIONS.md` D391; `docs/STATUS.md` RV-1b line.

## Not done
- The extra scenario (no-swap level up that only gains runes/maneuvers, no "Options removed" row) is NOT added. Per the brief, no existing seed reaches it: every Battle Master / Rune Knight seed in `e2e/` is Fighter 4→5 (`levelUpSwap`, `reviewFixes`, `choiceSources`, `multiclassEdit`), and maneuver/rune counts only rise at Fighter 7. A new Fighter 6→7 seed would be invented, so I stopped there. Decision for you: approve a Fighter 6 Battle Master / Rune Knight seed in a follow-up.

## Verified
- `npm run typecheck`: clean.
- `npm run test`: 188 files, 3444 tests passed.
- `npm run validate-data`: 177/177.
- `npm run e2e`: 693 passed (2.4m), including the extended RV-1 c.

## Decisions / questions
- Decision taken: skipped the new scenario rather than invent a seed (see above).

## Manual browser check for the user
None — the planning chat checks the looks from screenshots; changed screen: level-up Review "What's new" card.
