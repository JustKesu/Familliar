# F-HL - three small fixes after block HL (D421)

Setup: HEAD 6c8152b at start (requirement met). 13 places changed (under the ~15 limit); no STOP triggered.

## Changes
- A: `weaponAttacks.ts` `computeWeaponAttacks` - `proficient = isProficientWithWeapon || pactWeapon` (pactWeapon already computed with D408 gate, so no change elsewhere); `toHitFor` gets `proficiencyNote`, the "proficiency bonus" row carries note "Pact of the Blade" only when the pact is the sole source. Notes line "Not proficient" follows the new flag.
- B: `actionTableFeatureData.ts` - `UNTAGGED_BONUS_ACTION` (Hexblade's Curse, Giant's Might -> /as a bonus action/i on the feature's own string leaves) checked at the start of `classifyActionType`. Real-data unit guard confirms both names have a record whose text contains the sentence (no STOP).
- C: `FightingStylePicker.tsx` wraps `FilterChoiceSpellSubPicker` in `.fighting-style-picker__cantrips` with heading "<style> cantrips" (`.fighting-style-picker__cantrips-heading`); `index.css` rules (border, radius 12px, surface, margin .75rem 0, padding .75rem 1rem, weight 600 heading). `FilterChoiceSpellSubPicker` untouched.
- Docs: D421 in DECISIONS.md, STATUS.md.

## Verified
- typecheck clean; `npm test` 191 files / 3553 tests pass (new: weaponAttacks D421, actionTableFeatureData D421 incl. real data; `featureActionRowData.test.ts` D415 now expects Giant's Might 'bonus').
- lint: exit 1 from the pre-existing `spellsTabData.ts:229` rules-of-hooks error (noted in block HL report); no new findings in changed files.
- e2e full run: 791 passed / 2 failed (8.8 min, over the 3 min guideline). Failure 1: `proficiencyBonusUses.spec.ts` PB-1b a expected Giant's Might in Other - updated to the Bonus Action group (consequence of B), file re-run 8/8 pass. Failure 2: `subclassSpellcastingPrereq.spec.ts` SC-1 a (wizard Next stayed disabled, timeout) - unrelated to this task, file re-run 4/4 pass (flaky). The full suite was not re-run after the PB-1b edit.
- New scenarios: `pactWeapon.spec.ts` F-HL A (Warlock 5 pact Longsword +7, STR switch +6 with breakdown naming Pact of the Blade and no "not proficient"; unmarked Longsword +3 "not proficient with Longsword"), `hexbladeDevilsSight.spec.ts` F-HL B, `fightingStyleClassFeats.spec.ts` a (cantrip checkboxes inside the box with heading).

## Decisions / questions
- Decision: "Not proficient" note and breakdown follow the pact flag; a weapon already proficient through a class keeps the plain "proficiency bonus" row.
- Question noticed: SC-1 a looks flaky under load.
- Untracked investigation scripts from block HL remain in `scripts/` (git clean forbidden for this task).

## Manual browser check for the user
Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Actions tab (pact weapon to-hit and breakdown; Hexblade's Curse and Giant's Might now in the Bonus Action group); wizard / level up / Edit Class step (Blessed / Druidic Warrior cantrips box).
