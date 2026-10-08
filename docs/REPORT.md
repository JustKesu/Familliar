# M10a — Expertise a Weapon Mastery po třídách v multiclass Editu (D335)

## Krok 1: inventura míst (19 míst, bez dělení a/b)
| Soubor | Funkce / místo | Změna |
|---|---|---|
| `src/creation/heldClassPicks.ts` (nový) | `assignHeldPicks`, `grantSlots`, `heldPickOwners`, `ownedPicks`, `withOwnedPicks` | přiřazení voleb třídám, sloty grantů, výměna voleb jedné třídy |
| `wizardState.ts` | `WizardData.pickOwners` | nové pole: owners, seed owners, sloty po třídách |
| `wizardState.ts` | `activeClassPicks` (nová) | volby aktivní třídy, mimo multiclass Edit celý seznam |
| `wizardState.ts` | `HeldClassLookup` | `expertiseGrant`, `masteryGrant` (počty po úrovních třídy) |
| `wizardState.ts` | `wizardDataFromCharacter` (multiclass větev) | seeduje `pickOwners` |
| `wizardState.ts` | `classPicksComplete` | počet masteries aktivní třídy |
| `wizardState.ts` | `isStepComplete('expertise')` | počet expertise aktivní třídy |
| `wizardState.ts` | `HeldClassConditions`, `unfinishedHeldClasses`, `missingHeldPicks` (nová) | Expertise/Mastery neaktivní třídy |
| `wizardState.ts` | `WizardAction` + reducer | `setActiveClassPicks` |
| `wizardState.ts` | `saveCharacter`, `keepHeldClassLevels` (nová) | razítka po třídách |
| `CharacterWizard.tsx` | seed effect | načte granty každé třídy po úrovních |
| `CharacterWizard.tsx` | `editMastery`/`editExpertise`, `sharedMasteryCount`, `sharedExpertise` | odstraněno, nahrazeno `activeHeldCounts`, `own*`/`other*` |
| `CharacterWizard.tsx` | `expertisePoolOf` volání (`classExpertisePool`) | restrikce aktivní třídy, bez voleb jiných tříd |
| `CharacterWizard.tsx` | `expertiseRequiredCount`, `expertiseSkillsAvailable` | jen aktivní třída |
| `CharacterWizard.tsx` | `classPickRequirements.masteryCount` | multiclass Edit bere počet aktivní třídy (`classPickShape`) |
| `CharacterWizard.tsx` | `unfinishedClasses` (`heldPickConditions`) | počty a stale expertise neaktivních tříd |
| `CharacterWizard.tsx` | MasteryPicker JSX (krok Class) | picker aktivní třídy, `excluded` |
| `CharacterWizard.tsx` | ExpertisePicker JSX (krok Expertise) | picker aktivní třídy, nadpis „Expertise skills — <Class>“ |
| `src/masteries/MasteryPicker.tsx` | prop `excluded` | skryje zbraně jiných tříd |

Pravidlo přiřazení (použito tak, jak bylo navrženo): volba s úrovní L patří `levelOrder[L-1]`, pokud ta třída volbu dává. Jinak první
držená třída v pořadí `levelOrder`, která volbu dává, jméno povoluje a má místo; jinak první dávající třída; žádná nedává → volba
nepatří nikomu a projde save beze změny. Masteries: jména neomezuje žádná třída (pool multiclass postavy je společný, D329).

## Co se změnilo
- Pickery viz tabulka. Krok Expertise je vidět, jen když ho aktivní třída dává (Fighter aktivní → skrytý; e2e F-11 c proto nejdřív přepne na Rogue).
- Save: párování D334 uvnitř jedné třídy (seed owners); nová volba bez párování dostane úroveň postavy prvního volného slotu grantu třídy.
- Neaktivní třída: „choose N more Expertise skill(s)“, „remove N …“, „choose N more weapon masteries“, „replace N Expertise skill(s) it no longer allows“.
- Selhání načtení grantu při seedu: třída nevlastní žádnou volbu (Edit se neblokuje).

## Ověření
- `npm run typecheck` OK, `npm test` 175 souborů / 3223 testů OK (nový `heldClassPicks.test.ts`, 10 testů), `npm run validate-data` 175/175 OK.
- `npm run e2e` 496 passed za 5,8 min (nad 3 min — prostředí). Nové M10a a–f v `e2e/multiclassEdit.spec.ts`, F-11 c upraven.

## Rozhodnutí během práce
- Vlastnictví volby drží `WizardData.pickOwners`; `expertiseSkills`/`masteries` zůstaly celé seznamy (sheet, review, featy beze změny).
- Slot pro nespárovanou novou volbu = nejnižší úroveň grantu třídy, kterou nedrží jiná volba téže třídy (zadání „úroveň, na které třída X grant získala“).
- Pořadí v uloženém seznamu: změněná třída má nové volby na konci (e2e c: stealth, athletics, investigation).
- D333 obsahuje zastaralou větu o masteries/expertise na ose postavy; D335 ji výslovně nahrazuje, D333 jsem neupravoval.

## Manual browser check for the user
Na https://familliar.vercel.app, šířky 1366 a 1920, tmavý i světlý motiv, multiclass postava (např. Wizard 3 / Rogue 1, Fighter 4 / Rogue 1), Edit:
- Krok Expertise po přepnutí na Wizard v kroku Class: nadpis „Expertise skills — Wizard“ se nezalamuje divně, seznam má jen Scholar dovednosti.
- Totéž po přepnutí na Rogue: „Expertise skills — Rogue“, dva zaškrtnuté řádky, text počtu.
- Krok Class, Fighter aktivní a pak Rogue aktivní: seznam Weapon masteries a jeho počítadlo („4 / 4 · FULL“, „2 / 2 · FULL“) vypadá stejně jako v jednotřídním Editu.
- Krok Review se zablokovaným Rogue (odebraná Expertise): řádek „Rogue has unfinished choices: …“ se čte a zalamuje dobře.
