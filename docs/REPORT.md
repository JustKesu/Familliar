# M-3 — mobile wizard step row and bottom buttons, drawer fixes (D430)

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD 3c692bc — OK.

## STEP 1 — wizard buttons and where they land at ≤ 760 px

| Button | Shown in | Flows | Mobile |
|---|---|---|---|
| Step buttons 1..n | sticky bar, nav "Wizard steps" | all | dropdown panel under the compact row "i / n · Label" |
| Cancel | sticky bar, group "Quick navigation" | all | dropdown panel |
| Cancel | group "Step navigation" | all | hidden (CSS), stays in DOM |
| Back | both groups | all | bar copy not rendered; "Step navigation" copy = fixed bottom bar |
| Next | both groups | all steps but Review | same as Back |
| Create character | both groups | new, Review | same as Back |
| Save changes | both groups | Edit, Review | same as Back |
| Save level N | both groups | Level up, Review | same as Back |
| note (grant load error) | both groups | Review | bottom bar, line above the buttons |
| Cancel (seed error, no bar) | `.wizard > .wizard__nav` | Edit/Level up | unchanged, in flow |

Every button has a place.

## Changed

- `src/creation/WizardShell.tsx`: new `WizardMobileStepBar` — toggle row "i / n · Label" + ▾/▴ (aria-expanded), accent
  progress bar, panel `#wizard-step-panel` holding the unchanged `WizardStepList` ("Wizard steps", aria-current) and Cancel.
  Panel stays in the DOM, closed by class `--closed` (display none) so `[aria-current="step"]` keeps working; closes on
  step tap, Cancel, pointerdown outside, Escape.
- `CharacterWizard.tsx`: `useMobileLayout()`; on mobile the bar renders `WizardMobileStepBar` instead of the step list +
  "Quick navigation" group (not rendered → only one Next in the DOM). Step items/goTo factored to `stepItems`/`goToStep`.
- `index.css` (inside `@media (max-width: 760px)` only): "Step navigation" group fixed at the bottom, its Cancel hidden,
  Back/primary `flex: 1 1 0`, min-height 44px, note on its own line; `.wizard` padding-bottom 96px; panel absolute under
  the sticky bar, max-height `100vh - 140px`, scrolls.
- B: `.extras-tab__head` was hidden in M-2 but `.extras-tab__row { display: flex }` came later at equal specificity and
  won; now `.extras-tab__table > .extras-tab__head { display: none }`.
- C: `.drawer__close` 44×44 grid-centred, negative margins keep the header height; glyph size unchanged.
- D: `.drawer input[type='search']` width 100%, min-width 0 (the Manage panels already had `manage-spells__search`
  width 100%; the rule covers any drawer search).
- Docs: D430 added, STATUS.md M-3 entry.

## Verified

- `e2e/mobileWizardM3.spec.ts` a–g, 8 tests, pass (a compact row + fixed Next, the only Next in the DOM; b dropdown,
  Cancel → confirm dialog, locked Background, jump back, outside tap; c new Fighter saved; d Level up 1→2 saved;
  e every step of a level-4 Fighter: scrollWidth ≤ 390, no visible button past 390; f Extras head hidden/visible,
  Manage Spells close ≥ 44×44, search width = parent content width; g 1366: step list + Quick navigation Cancel/Back/Next).
- typecheck, test (194 files / 3607), validate-data (177/177) pass.
- Full e2e: 848 passed, 1 failed (8.6 min, over the 3-minute guideline) — only the known flaky SC-1 a
  (`subclassSpellcastingPrereq.spec.ts:103`, timeout); the spec alone passes 4/4.

## Decisions / questions

- Outside-tap closing is on pointerdown; Escape also closes (not asked for, invisible otherwise).
- Pre-existing untracked `scripts/investigate-lh2-sorcery-points.js` left alone, not committed (task forbids git clean).
- No subagent used.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens (≤ 760 px): wizard (new / Edit / Level up) top bar, open step dropdown, bottom Back/Next bar; Extras tab
(no header row); every drawer header (close button); Manage Spells / Inventory / Feats / Extras search fields.
