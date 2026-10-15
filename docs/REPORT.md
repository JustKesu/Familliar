# F-31a — textové opravy (6, 15, 8, 21, 3, 1, CSS)

Setup: ff-only merge OK, HEAD byl f29470b. F-31b (20/14, 12, 26/40, e2e b a c) je odložené na samostatný task po schválení rozdělení.

## STEP 1 — tabulka (rozsah F-31a)
| # | Kde | Změna |
|---|-----|-------|
| 6 | `featAsi/featInstances.ts` (`featDisplayName`), `sheet/featuresTabData.ts` (řádek Feats), `sheet/featureActionRowData.ts` (jen kind 'feat'), `sheet/ManageFeatsPanel.tsx` (`FeatRow name`) | „Magic Initiate (Cleric)" |
| 15 | `featAsi/featAsiData.ts:611` | D → Dragonmark, FS:P / FS:R → Fighting Style (Paladin/Ranger) |
| 8 | `optionalFeatures/ReplaceOptionControl.tsx`, `OptionalFeaturePicker.tsx` (mapa Battle Master/Rune Knight → Maneuvers/Runes, text i legend), `fightingStyle/FightingStylePicker.tsx` | množné číslo |
| 1 | `levelUp/RemoveLevelButton.tsx` (`keptSpellsText`) | „Other known…", když `dropped` obsahuje řádek `spell: ` / `spell choice: ` |
| 3 | `calculation/weaponAttacks.ts` `damageText` | bez kostek součet 1+mod, min 0 (i kladný: „4" místo „1 + 3") |
| 21 | `storage/characterStore.ts` (`readableEntryError`) | „Character N in the file could not be imported: <path>." |
| CSS | `index.css` @media 600 px, `.ability-table th[scope='row']` | width 72px, padding-right 6px, overflow-wrap |

## Co se změnilo
- Změněné existující testy: CharacterSheet.test (Magic Initiate název, Unarmed „3"), weaponAttacks.test (3×), sheetReviewFixes.test, characterStore.test (číslování), OptionalFeaturePicker.test (label hledání), CharacterWizard.test (/Maneuvers/); e2e: manageFeats, featuresTab (escape závorek v `row`), featSubChoices, choiceSources, levelUpSwap (legend Maneuvers/Runes).
- Nové: `src/textFixesF31.test.tsx` (6, 15, 8, 1, 3, 21), `e2e/textFixesF31.spec.ts` (a, d, e).

## Ověřeno
typecheck, test (3347), validate-data (175), e2e (581 passed, 2.2 min) — všechno jednou na konci, všechno prošlo.

## Rozhodnutí v kódu
- `featDisplayName` je jen zobrazení; klíče řádků a uložená jména beze změny. `aria-label` „Remove <jméno>" v Manage Feats zůstal se starým jménem.
- Položka 3 aplikována obecně (i „1 + 3" → „4"), protože zadání říká „flat number plus modifier → computed number".
- Legend seznamu Battle Master / Rune Knight je „Maneuvers (Battle Master)" / „Runes (Rune Knight)" i mimo level up.
- e2e e: assert proti pravému okraji textu labelu, ne boxu buňky (buňky tabulky sdílejí hranu vždy).

## Otevřené
- Kategorie featů bez labelu a zobrazená jména s „; " mimo featy nezjištěny (potřeba skript; F-31b).
- Atributy `FeatText name=` v Manage Feats a hláška „already have it from the Magic Initiate; Cleric feat" (Manage Spells) pořád ukazují uložené jméno.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Dotčené obrazovky: Features & Traits (Feats), Actions (Other), Manage Feats (My Feats, chipy kategorií), level-up/wizard krok s Maneuvers/Runes/Fighting Style (Replace one), Remove level dialog, Actions (Unarmed Strike damage), import chyba, wizard Ability scores při 390 px.
