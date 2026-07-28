# Status

Last updated: 2026-07-28

## Build order

1. [done] Markup renderer
2. [done] App skeleton + persistence
3. [in progress] Character creation — 5 pickers + wizard shell done; per-level walkthrough (skills/masteries/style, subclass) remains
4. [not started] Calculation layer
4a. [not started] Feat/ASI slice
5. [not started] Sheet display
6. [not started] Spells
7. [not started] Inventory and equipment
8. [not started] Level up
9. [not started] Play tracking and rests
10. [not started] Multiclass

## What exists

- Data extraction — scripts/extract-data.js + scripts/validate-data.js, 103 checks green (phase 0, complete).
- App skeleton — Vite + React + TypeScript, data served from public/data/.
- Markup renderer — src/markup/, 104 tests.
- Storage layer — src/storage/, localStorage key `familliar:characters`, schema version 2, 25 tests.
- Character creation wizard — src/creation/, steps: class → species → background → languages → ability scores → review.
- Five creation pickers — src/classes/, src/abilities/, src/species/, src/backgrounds/, src/languages/.
- Component tests — jsdom + Testing Library, e.g. src/creation/CharacterWizard.test.tsx.

## Next step

Remaining part of step 3: class skills/weapon masteries/fighting style,
then subclass and its choices, added to the wizard as new steps in
src/creation/wizardState.ts (see D15). Feat/ASI, the third slice, waits
until after step 4, the calculation layer (D16).

## Temporary scaffolding

- src/CharacterManager.tsx — list/rename/delete/export/import UI; replaced by the sheet (step 5).
- src/CharacterInspector.tsx — read-only dump of a stored character; replaced by the sheet (step 5).
- src/MarkupDemo.tsx — renders sample data/ entries through the markup renderer; replaced by creation (step 3) and the sheet (step 5).
