# REPORT F-36

Setup: `git fetch` + `git merge --ff-only origin/main` → already up to date, HEAD b0121f4. No claude/MOCKUP-TYRKYS.md in repo; styles matched to neighbours.

| Item | Where | Change |
|---|---|---|
| a | index.css `.species-picker__field` (new) | label as flex column, 4px gap above the select |
| b | ElegantCourtierChoice.tsx:7, index.css `.feat-sub-choices--sentence > legend` | modifier class; legend no uppercase/tracking, 14px (other feat-sub-choices legends untouched) |
| c | index.css `.wizard__bar` gap 24→16, `.wizard__steps` gap 22→10, `.wizard__step` 13px→12px, tracking .04→.02em | all 9 steps should fit at 1366; wrapping kept for narrow |
| d | index.css `.sheet__spell-slots-button` | restores the bordered `button` look (overrides bare per-action-label style), block + start-aligned |
| e | index.css `.char-card__name` | `overflow-wrap: anywhere` → `break-word` (anywhere lowers min-content, which caused mid-word breaks); long single words still break |
| f | CharacterSheet.tsx:595, :984, index.css `.sheet__nowrap` | "N / M" wrapped in nowrap span; text unchanged |
| g | index.css `.background-picker__grants` (card), `.feat-asi-picker__level > label` (flex, 8px gap, stacked 6px), `.feat-asi-picker__note` (tight, under its radio) | no markup change |
| h | index.css `.wizard__content .class-feature-choice-picker__group` | card frame like other choice lists |
| i | index.css `.wizard__content h3 + .class-skill-picker > :first-child` | removes stacked default top margin under the heading |

Not verified by eye (CSS only, no browser per CLAUDE.md): item c width fit at 1366 and the g/h/i spacing are estimates from the CSS, not measured.

Verified: typecheck, test (3373 passed), validate-data (175/175), e2e (598 passed, 2.8m). No test needed changing.

Decisions: none needed. Docs files left alone except STATUS.md (one line).

## Manual browser check for the user

none - the planning chat checks the looks from screenshots.

Changed screens: Wizard Species, Background, Class (Druid; multiclass edit), step bar in Edit Character at 1366; sheet Actions and Spells tabs; Character list; Elegant Courtier choice (Samurai).
