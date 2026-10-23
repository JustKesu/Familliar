# REPORT — B-2: Eldritch Mind a War Caster, výhoda na koncentraci (D373)

HEAD před úkolem: 88d970b.

## Změny
- `src/sheet/concentrationSaveAdvantages.ts` (nový): ruční tabulka (Eldritch Mind XPHB invokace, War Caster XPHB feat),
  `concentrationSaveAdvantageLines(invocations, feats)` → „Advantage on Constitution saves to maintain Concentration (…)";
  invokace bez `source` = XPHB (stejně jako `hasAgonizingBlast`). WHY komentář cituje D373.
- `CharacterSheet.tsx`: seznam invokací z B-1 vytažen do `invocations` (EI výběry + `itemInvocationGrants`), sdílí ho
  `hasAgonizingBlast` i nový řádek — žádný druhý kolektor. Featy z `chosenFeats` (`characterFeats`: ASI, background,
  species, manual, item). Původní `saveAdvantages` přejmenováno na `traitSaveAdvantages`; `saveAdvantages` =
  předměty + druh + koncentrace, definováno u `agonizingBlast` (potřebuje `chosenFeats`). Panel i drawer beze změny JSX.
- Unit test `concentrationSaveAdvantages.test.ts` (2 případy).
- `e2e/concentrationAdvantageB2.spec.ts` a–d (schema 61): a) Warlock 2 + Eldritch Mind → řádek; b) bez něj → žádné
  „maintain Concentration"; c) jen z vlastního předmětu → řádek; d) War Caster na ASI 4
  (`featAsiChoices: [{ level: 4, kind: 'feat', name: 'War Caster', source: 'XPHB', chosenAbility: 'charisma' }]`) → řádek.
- Docs: DECISIONS.md D373, STATUS.md B-2.

## Ověření
- typecheck OK; test 187 souborů / 3395 testů OK; validate-data 177/177 OK; e2e 637 passed za 7.7 min (nad 3 min).

## Pro uživatele
- Nesledované `scripts/investigate-item-weight.js` a `scripts/investigate-multi-dice-spells.js` z dřívějška zůstaly
  (necommitnuty, git clean podle zadání nespuštěn).
- Rozhodnutí během práce: pořadí řádků předměty → druh → Eldritch Mind → War Caster.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: list postavy, karta Saving throws a drawer Saving throws (nový řádek pod hody).
