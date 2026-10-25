# REPORT — BF-1: Boon of Fortitude max HP (D404)

Setup: `git fetch origin` + `git merge --ff-only origin/main` → already up to date, HEAD fee4d51.

## Changed
- `src/calculation/maxHitPoints.ts`: `'Boon of Fortitude': { flat: 40, perLevel: 0, axis: characterLevel }` added to
  `HIT_POINT_BONUS_RULES`; table comment now says four features and no longer points to QUESTIONS.md; "three names" wording in
  the `computeMaxHitPoints` doc comment dropped. No code path change was needed: the loop already builds the label from
  `flat > 0` / `perLevel > 0` parts, so the breakdown line is `Boon of Fortitude (+40): +40`.
- `src/sheet/CharacterSheet.tsx`: one comment ("three names" → "names") above the unchanged call.
- Source path check: all three callers (`CharacterSheet.tsx`, `hpDefault.ts`, `HitPointsPicker.tsx`) pass granted features +
  `characterFeats()` names + species traits; `characterFeats` → `featInstances` includes `featAsiChoices` kind `feat`, so a
  level-19 ASI-slot feat reaches `bonusFeatureNames` like Tough does. Manual (Manage Feats) feats too.
- Current HP follow (D381) untouched; covered by e2e c.
- Docs: D404 (Czech) in DECISIONS.md; QUESTIONS.md entries "Magic Initiate parent entry" and "Boon of Fortitude" removed;
  STATUS.md: BF-1 line + the 8a table description.

## Tests
- Unit `maxHitPoints.test.ts`: table-keys test now expects four names; new test: +40 at levels 5, 19, 20 (no growth), source
  `Boon of Fortitude (+40)`.
- e2e `e2e/boonOfFortitude.spec.ts` (Fighter 19, CON 13, seeded schema 63 via localStorage; boon's +1 put on STR so CON is
  unchanged): a) boon as level-19 `featAsiChoices` feat → 177/177 and dialog line `Boon of Fortitude (+40): +40`;
  b) without it → 137/137, no boon line; c) 130/137, boon added in Manage Feats → 170/177 (D381 follow).
- typecheck clean; test 190 files / 3472 passed; validate-data 177/177; e2e 732 passed (2.6 min).

## Decisions / notes
- None taken in code beyond the prompt.
- `validate-data`'s "hit point bonus table guard (D93/D95)" still checks its own list of 3 names; it was not extended to
  Boon of Fortitude (not asked). Planning chat may want the guard to cover the fourth row.
- No subagent used.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Hit points details dialog (new "Boon of Fortitude (+40)" line when the boon is taken); sheet HP value.
