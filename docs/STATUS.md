# Status

Last updated: 2026-07-28 (class skill picker, mastery picker and fighting style picker wired into the wizard's class step)

## Build order

1. [done] Markup renderer
2. [done] App skeleton + persistence
3. [in progress] Character creation — 5 pickers + wizard shell + class skill/mastery/fighting style pickers wired in; subclass remains
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
- Investigation script — scripts/investigate-slice1.js, confirms weapon mastery and fighting style data shape ahead of the remaining step-3 walkthrough work.
- Investigation script — scripts/investigate-class-skills.js, confirms all 13 classes' skill-choice shape in classes.json.
- App skeleton — Vite + React + TypeScript, data served from public/data/.
- Markup renderer — src/markup/, 104 tests.
- Storage layer — src/storage/, localStorage key `familliar:characters`, schema version 2, 25 tests.
- Character creation wizard — src/creation/, steps: class → species → background → languages → ability scores → review. The class step now also holds class skill proficiencies, weapon masteries and fighting style (D13) — all three clear when the class or level changes.
- Five creation pickers — src/classes/, src/abilities/, src/species/, src/backgrounds/, src/languages/.
- Class skill picker, mastery picker, fighting style picker — src/classSkills/, src/masteries/, src/fightingStyle/, wired into the class step. Class skill picker receives the background's two fixed skills as disabledSkills (D18) once a background is chosen.
- Component tests — jsdom + Testing Library, e.g. src/creation/CharacterWizard.test.tsx.

## Next step

Subclass and its choices, then feat/ASI. Feat/ASI, the third slice, waits
until after step 4, the calculation layer (D16). Note: the three
class-specific selections wired in this session are not yet recorded with
the level they were taken at (D22) — see docs/REPORT.md.

## Temporary scaffolding

- src/CharacterManager.tsx — list/rename/delete/export/import UI; replaced by the sheet (step 5).
- src/CharacterInspector.tsx — read-only dump of a stored character; replaced by the sheet (step 5).
- src/MarkupDemo.tsx — renders sample data/ entries through the markup renderer; replaced by creation (step 3) and the sheet (step 5).
