# Status

Last updated: 2026-07-28 (class step choices — class skills, masteries, fighting style, subclass — and the background's fixed skill proficiencies now persist to storage)

## Build order

1. [done] Markup renderer
2. [done] App skeleton + persistence
3. [in progress] Character creation — 5 pickers + wizard shell + class skill/mastery/fighting style/subclass pickers wired in; subclass's own internal choices (D21) remain
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
- Investigation script — scripts/investigate-subclass-shape.js, confirms subclass linkage, D28 filtering counts, and that every class grants a subclass at level 3.
- App skeleton — Vite + React + TypeScript, data served from public/data/.
- Markup renderer — src/markup/, 104 tests.
- Storage layer — src/storage/, localStorage key `familliar:characters`, schema version 3, 36 tests. A saved character now carries classSkills, masteries, fightingStyle and (via CharacterClass.subclass) subclass, plus the background's two fixed skill proficiencies (CharacterBackground.skillProficiencies) — a version-2 save is rejected, not migrated (see docs/QUESTIONS.md, "Migrace uložených postav").
- Character creation wizard — src/creation/, steps: class → species → background → languages → ability scores → review. The class step now also holds class skill proficiencies, weapon masteries, fighting style and subclass (D13) — all four clear when the class or level changes, and all four are now saved by the review step.
- Five creation pickers — src/classes/, src/abilities/, src/species/, src/backgrounds/, src/languages/.
- Class skill picker, mastery picker, fighting style picker, subclass picker — src/classSkills/, src/masteries/, src/fightingStyle/, src/subclass/, wired into the class step. Class skill picker receives the background's two fixed skills as disabledSkills (D18) once a background is chosen.
- Component tests — jsdom + Testing Library, e.g. src/creation/CharacterWizard.test.tsx.

## Next step

Subclass's own internal choices (out of scope this session, D21), then
feat/ASI. Feat/ASI, the third slice, waits until after step 4, the
calculation layer (D16). Note: the class-specific selections are still
not recorded with the level they were taken at (D22) — see
docs/QUESTIONS.md.

## Temporary scaffolding

- src/CharacterManager.tsx — list/rename/delete/export/import UI; replaced by the sheet (step 5).
- src/CharacterInspector.tsx — read-only dump of a stored character; replaced by the sheet (step 5).
- src/MarkupDemo.tsx — renders sample data/ entries through the markup renderer; replaced by creation (step 3) and the sheet (step 5).
