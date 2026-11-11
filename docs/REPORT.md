# REPORT — SC-1: podtřída s kouzlením splňuje předpoklad „spellcasting“ (D413)

Setup: `git fetch`, `git merge --ff-only origin/main` (already up to date), `npm ci`, `npm run e2e:install`; HEAD eb1ca8f.

## STEP 1 — místa, kde se počítá / předává hasSpellcasting (5, bez rozdělení)

| Místo | Role | Jak dostane podtřídu (po změně) |
|---|---|---|
| `src/featAsi/featAsiData.ts` `classPrereqInfoFor` / `loadClassPrereqInfo` | počítá | nový parametr `subclass` (default null) |
| `src/featAsi/featAsiLevels.ts` `loadFeatAsiStepData` (single class: tvorba, level up, Edit) | předává | nový poslední parametr `subclass`, přes `useFeatAsiStepData` |
| `src/featAsi/featAsiLevels.ts` `loadMulticlassFeatAsiStepData` (multiclass level up / Edit) | předává | `entry.subclass` každé třídy z draftu |
| `src/sheet/ManageFeatsPanel.tsx` `loadPanelData` | předává | `c.subclass` každé třídy postavy |
| `src/creation/CharacterWizard.tsx` volání `useFeatAsiStepData` | zdroj | `wizardClassChoice?.subclass` (podtřída zvolená na kroku Class téže session) |

Hodnotu čte `evaluateFeatPrerequisites` (featAsiData.ts, `spellcasting2020`) beze změny.

## Co se změnilo
- `subclassHasSpellcasting`: záznam `entryType: 'subclass'` se jménem, `className`, `classSource`, s `spellcastingAbility` A `casterProgression`.
- Unit testy `featAsiData.test.ts` „classPrereqInfoFor — D413“ (EK ano; bez podtřídy / Champion ne; Ancestral Guardian ne; Wizard ano).
- e2e `e2e/subclassSpellcastingPrereq.spec.ts`: a) tvorba Fighter 4 EK – War Caster bez „needs“, lze vybrat; b) seed Rogue 3 AT → 4 – lze vybrat; c) seed Rogue 3 Thief → 4 – „War Caster · XPHB (needs a spellcasting class)“, disabled; d) seed Fighter 5 Champion / Rogue 3 AT – Manage Feats › Add Feats má „Add War Caster“.
- Docs: D413 (DECISIONS.md), STATUS.md (SC-1), DATA.md (3 podtřídy se `spellcastingAbility`).

## Ověření
- `npm run typecheck` OK; `npm test` 190 souborů / 3508 testů OK; `npm run validate-data` 177/177 OK.
- `npm run e2e` 770 passed za 7,9 min (nad limitem ~3 min; běh 2 workery).
- e2e a, b, d nebyly spuštěny proti kódu před opravou (selhání před opravou neověřeno, plyne z kódu).

## Subagent
Nepoužit.

## Decisions taken
- Kritérium „podtřída má `spellcastingAbility`“ ze zadání by pustilo Path of the Ancestral Guardian (barbar bez featury Spellcasting, má `spellcastingAbility: "wis"`). Přidána podmínka `casterProgression` podle D46 a pravidla ze zadání (featura Spellcasting / Pact Magic). Pokud má Ancestral Guardian předpoklad splnit, je to jednořádková změna.
- Podtřída se páruje podle jména + `className` + `classSource` (postava ukládá jen jméno podtřídy), stejně jako `sheetData.ts`.
- „Na úrovni třídy“: držená podtřída se počítá vždy; EK/AT se volí až na úrovni 3, kdy Spellcasting dostávají.
- e2e: `toBeDisabled` na `<option>` v Playwrightu nefunguje, kontroluje se atribut `disabled`.

## Manual browser check for the user
None - the planning chat checks the looks from screenshots. Změněné obrazovky: krok ASI / Feat ve wizardu (dropdown featu u EK/AT) a Manage Feats › Add Feats / Unavailable.
