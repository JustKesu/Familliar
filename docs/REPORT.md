# REPORT F-36b

| Item | File | Change |
|---|---|---|
| 1 | CharacterSheet.tsx:983, index.css `.sheet__spell-counter--text` | Cause: `.sheet__spell-counter` is `display:flex`, so the label text and the nowrap span became separate blocks (innerText "Favored Enemy\n2 / 2"). The text-only counter now has `display:block`; the UseBoxes counter keeps the flex. "N / M" still unbreakable via `.sheet__nowrap`. |
| 1 | CharacterSheet.tsx:595 (UseBoxes) | Checked: parent `.sheet__use-counter` is inline-flex with `gap: 6px`, the span is its own item between buttons, no text-space dependence. No change. |
| 1 | e2e/classFreeCasts.spec.ts:49 | A-S2 a asserts the `.sheet__spell-counter` innerText equals exactly "Favored Enemy 2 / 2". It failed on the first attempt (found the line break above), passes now. |
| 2 | index.css `.sheet__spell-slots-button` | The button is inside the wrapping flex row `.sheet__spell-header`; now `flex: 0 0 100%` + `max-width: max-content`, so it takes its own line at natural width, left-aligned. Replaces the earlier display/justify-self attempt. |

Verified: typecheck, test (3373 passed), e2e (598 passed, 2.0m). Item 2 is CSS only; no scenario asserts its position, and it was not seen in a browser.

Decisions: none needed.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots.

Changed screens: sheet Spells tab (header row at 1366, Hunter's Mark USE row).
