# SM-2 — cleanup

HEAD at start: bbb497f (fetch + ff-only merge: already up to date).

## Changed
- `src/languages/LanguagePicker.tsx`: header comment rewritten (extra-language sources arrive via `exclude`, D172); redundant doc line above `LanguagePicker` removed (props/code say it).
- `src/index.css`: `.sheet__stat-value` deleted. Grep over `src/` and `e2e/` found no use besides its own rule.
- `docs/QUESTIONS.md`: "CAST s oběma pooly slotů" STATUS set to `vyřešeno D326 — …` (same style as other resolved entries); body untouched.

## Verified
- typecheck clean; vitest 188 files / 3444 tests passed; e2e 694 passed (2.6 min).

## Open QUESTIONS entries possibly answered by an existing D-number (not edited, judged from titles/grep, not read in full)
- "Sheet ukazuje mistrovství zbraně i tomu, kdo ho nemá vybrané" → D181 (mastery only on mastered weapons)
- "ASI vzatý dřív v téže session se nezapočítá do prerekvizit" → D253 (prereqs count scores under the card level)
- "Utracené spell sloty (9b3) sdílí klíč jen podle úrovně kouzla" → possibly D326 (pool-keyed CAST); unconfirmed
- "Human Versatile — volný Origin feat se ve wizardu nevybírá" — D157 only defers it; the wizard was rebuilt since (W-series), so likely stale, no single D-number found.

## Decisions / questions
None.

## Manual browser check for the user
None.
