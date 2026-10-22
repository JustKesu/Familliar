# REPORT — TGS2-5a: odolnosti z Infernal Warrior a Windswept (D369)

HEAD před úkolem: 9f844b1 (podmínka splněna).

## Co se změnilo
- `src/damageResponses/featureDamageResponses.ts`: dva bezpodmínečné řádky v `FEATURE_DAMAGE_RESPONSES`
  - Infernal Warrior, Barbarian (Path of the Infernal), odolnost vůči ohni.
  - Windswept, Ranger (Rocborne), odolnost vůči chladu.
  - Komentář nad nimi cituje D369.
- Předběžný Grep: žádný z názvů v tabulce ani v `src` nebyl; v `e2e` jediný výskyt je `not.toContainText('Infernal Warrior')` pro Barbarian 3 (tgs2Extraction.spec.ts:105), zůstává platný. Jiný zdroj se stejným názvem nenalezen.
- `src/sheet/damageResponseData.test.ts`: nový blok „TGS2 unconditional resistances (D369)“ (Barbarian 6 oheň / 5 nic, Ranger 7 chlad / 6 nic), přes `featureNamesFor` + `buildFeatureGrants` s fixtures.
- `e2e/tgs2Resistances.spec.ts` (nový): a) Barbarian 6 Fire na kartě Defenses i v detailu s původem, b) Ranger 7 Cold, c) Barbarian 5 bez Fire. Seedy schema 61.
- Docs: DECISIONS.md D369, STATUS.md (položka TGS2-5a + e2e spec).

## Ověření (jednou, na konci)
- typecheck OK; test 186 souborů / 3386 testů OK; validate-data 177/177 OK; e2e 625 testů, exit 0.

## Seedy
- Podskupiny: „Path of the Infernal“ (Barbarian), „Rocborne“ (Ranger), zdroj GriffonsSaddlebag2.
- Úplné volby: classSkills, masteries (Barbarian 2/3, Ranger 2), featAsiChoices úroveň 4, Ranger expertiseSkills + fightingStyles Archery, spellChoices prázdné.
- Pozor: unit test používá syntetické `shortName` podskupin (skutečná data jsem neotevíral); skutečné párování pokrývá e2e.

## Subagent
Nepoužit.

## Rozhodnutí v kódu
- Seed Ranger 7 má `spellChoices: []` (bez vybraných kouzel); sheet to snáší, počet kouzel jsem nevolil.
- Unit test staví vlastní fixtures místo čtení dat (pravidlo 1).

## K rozhodnutí uživatele
- Nic. Arcane Conduit zůstává text, Geleton kyselina čeká na extraktor (mimo rozsah).

Manual browser check for the user: none - the planning chat checks the looks from screenshots.

Změněné obrazovky: list postavy → karta Defenses a detail „Defenses“ (nové řádky Fire/Cold u dotčených podtříd).
