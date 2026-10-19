# REPORT F-36c

| Item | File | Change |
|---|---|---|
| 1 | CharacterSheet.tsx:3135 | Spell Slots button wrapped in `<div className="sheet__spell-slots-row">` inside `.sheet__spell-header`. |
| 1 | index.css | New `.sheet__spell-slots-row { flex: 0 0 100% }`. Removed `flex`, `max-width`, `align-self` from `.sheet__spell-slots-button`; border, background, padding, margin, hover unchanged. Cause of F-36b failure: `max-width: max-content` clamped the 100% basis, so the button fit beside the cards. |

Verified: typecheck, test (3373 passed), e2e (598 passed, 6.7m - over the 3 minute guideline). No test asserts the button's parent or position (grep of `src/` and `e2e/`; e2e only clicks it by role/name); none changed. Layout not seen in a browser.

Decisions: none needed.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots.

Changed screens: sheet Spells tab (header row at 1366).
