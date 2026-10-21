# REPORT — TGS2-2: bloky pravidel 2014 z Etherean a Geleton (D366)

HEAD po `git merge --ff-only origin/main`: ff9d81f (podmínka splněna, „Already up to date"). D366 dřív neexistovalo.

## Co se změnilo

- `scripts/extract-data.js`: konstanta `HOMEBREW_RACE_2014_BLOCKS`; v `loadHomebrew()` se z `entries` homebrew ras
  odfiltrují bloky podle jména (Ability Score Increase, Age, Alignment, Size, Speed, Languages, `Creating Your…`).
- `data/species.json` přegenerováno (`npm run extract-data`). Počty beze změny, EXPECTED_COUNTS nesahány.
- Vnořené pojmenované traity v odstraňovaných blocích: žádné (kontrola skriptem, viz níže) — nebylo co hlásit.
- Traity před → po (`node scripts/tgs2-race-blocks.js`, neverzovaný):
  - Etherean: ASI | Age | Alignment | Size | Speed | Darkvision | Misty Sight | Veil Shift | Languages | Creating Your Etherean
    → **Darkvision | Misty Sight | Veil Shift** (+1 nepojmenovaný úvodní odstavec)
  - Geleton: … → **Darkvision | Limited Blindsight | Symbiotic Fortitude | Wakeful** (+1 nepojmenovaný odstavec)
- Velikost Geletonu: wizard ji nabízí stejnou cestou jako XPHB druhy se dvěma velikostmi —
  `loadSpeciesSizeOptions` → `speciesSizeOptions` (pole `size` ze species.json, bez rozlišení zdroje) →
  `SpeciesSizePicker` při ≥ 2 možnostech; `speciesSizeComplete` blokuje Next. Nic nechybělo, kód UI beze změny.
- `e2e/tgs2Extraction.spec.ts`: test a rozšířen (karty bez Age / Alignment / Ability Score Increase, Veil Shift a
  Wakeful viditelné), nové TGS2-2 b (Geleton: rádia Small + Medium, Small → `speciesSize: "S"`, hlavička
  „Geleton · Small"), TGS2-2 c (Etherean: žádné rádio velikosti, hlavička „Etherean · Medium").
- Docs: DATA.md (odstraněné bloky, zbylé traity, `languageProficiencies`), STATUS.md, DECISIONS.md D366 (česky)
  a oprava v D365 „College of the Mercantile" → „College of Mercantile".

## Ověření

- `npm run typecheck` OK; `npm run test` 186 souborů / 3383 testů OK; `npm run validate-data` 177/177 PASS;
  `npm run e2e` 610/610 OK (2.0 min).

## Rozhodnutí a nálezy

- Obě rasy dál nesou `languageProficiencies: [{"common":true,"any":1}]` (tvar 2014). Appka to pole čte jen u featů
  (`proficiencies.ts`), u druhů ne — dnes bez efektu; ponecháno, jak bylo. Otázka pro tebe, jestli ho zahodit.
- Nepojmenovaný úvodní odstavec u obou ras ponechán (zadání mluví jen o pojmenovaných blocích).
- Neverzované `docs/REPORT-*.md`, `CLAUDE-1.md` aj. z git status nejsou součástí commitu (zadání: stage po cestách);
  nebyly to změny verzovaných souborů.
- Subagent: nepoužit.

## Manual browser check for the user

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: wizard krok Species (karta Etherean / Geleton bez bloků 2014; Geleton s výběrem Small/Medium);
hlavička listu postavy pro Etherean / Geleton (velikost za tečkou).
