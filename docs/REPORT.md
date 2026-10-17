# REPORT — F-33: modifier sesílací vlastnosti v damage a léčení kouzel (D361)

Setup: fetch, `merge --ff-only origin/main` → HEAD 3835f67 (požadovaný). Investigace z 3835f67:docs/REPORT.md přečtena.

## Krok 1 — místa změny (13, bez dělení)
spellActionRowData.ts: `SpellCaster` (+`abilityModifier`), `toCaster`, `cantripDamageAtLevel`, `cantripDamage`, `leveledSpellDice`, `spellActionData`, nové `diceTags`/`withSpellcastingModifier`/`casterAbilityModifier`; itemSpellRows.ts `fixedCaster`; spellsTabData.ts `spellEffect`; CharacterSheet.tsx:922 (volání spellEffect) a `SpellDamageLine`. Bonus Action skupina (CharacterSheet.tsx:862) kostky neukazuje (jen text kouzla) → beze změny; Healing Word dostane modifier ve Spells Effect.

## Co se změnilo
- `diceTags(entries)`: každý `{@damage}`/`{@dice}` tag + příznak, zda zbytek téhož řetězce (markup stripnutý) začíná `(+|plus) your spellcasting ability modifier`. `leveledSpellDice` přičte modifier po `{@scale…}` (upcast zvedá jen kostky), `cantripDamage` před typ škody („1d6 + 3 Bludgeoning").
- `withSpellcastingModifier`: „1d8 + 3", „1d8 − 1" (U+2212 jako RollButton), 0 → „1d8", null → „1d8 + mod".
- `toCaster` bere modifier z řádku breakdownu `<ability> modifier` (computeAbilitySpellcasting); bez něj null. `fixedCaster` null (pravidlo b), `{reason}` caster → null.
- Green-Flame Blade: `{{spellcasting_mod}}` v `scalingLevelDice` nahrazeno („1d8 + 3", pod úr. 5 „3").
- `SpellDamageLine`: regex bere `+`/`−` a `mod`; „+ mod" hází jen kostkami, „− 1" se odečte.

## Ověřeno
- typecheck OK; `npm test` 185 souborů / 3373 testů OK (jeden existující test v customItemGrants.test.ts doplněn o `abilityModifier: null`).
- Guard nad data/spells.json (spellActionRowData.test.ts): `diceTags` chytí přesně 16 kouzel ze zadání a shoduje se se stripnutým frázovým scanem „XdY +/plus your spellcasting ability modifier". Pravidla b/c v unit testech (spellActionRowData.test.ts, spellsTabData.test.ts).
- validate-data 175/175 OK.
- e2e: plný běh 593/594, padl jen nový F-33 c na chybném lokátoru (cantrip řádek není `--cast`; snapshot ukázal „1d8 + 3" správně); po opravě spellModifierF33 + spellDice 15/15 OK. Plný suite trvá ~2,2 min.
- Nový `e2e/spellModifierF33.spec.ts` a–d (Spiritual Weapon 1d8 + 3 / 2d8 + 3 na 3. úr. / Actions 1d8 + 3; Cure Wounds 2d8 + 3 a toast „+ 3 ="; Green-Flame Blade TCE 1d8 + 3 bez „{{"; WIS 10 → „2d8" bez „+ 0"). `spellDice.spec.ts` R8a c upraven na „2d8 + 3" (WIS 16).

## Rozhodnutí v kódu
- Modifier se odvozuje z breakdownu místo nového pole v `SpellcastingEntry`/`FeatSpellcastingEntry`/`SpeciesSpellcastingEntry` — menší zásah, jediný producent je computeAbilitySpellcasting.
- Samotný placeholder Green-Flame Blade pod úr. 5 ukazuje číslo („3 fire damage to secondary creature"), při neznámém modifieru „mod"; při 0 „0".
- Alustriel's Mooncloak a Holy Star of Mystra parser chytí, ale kostky dál nezobrazují (`{@dice}` bez `{@scaledice}`, D206) — beze změny.

## Pro uživatele
- Necommitnuté untracked soubory z dřívějška (docs/REPORT-*.md kromě REPORT.md, CLAUDE-1.md, scripts/investigate-*) jsem nechal stranou: jsou untracked napříč předchozími tasky a zadání velí stage po cestách. Pokud mají jít do gitu, je to samostatný krok. `git clean -fd scripts` jsem nespouštěl — žádný skript jsem nepsal a smazal by ty cizí.
- Subagent nepoužit.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Spells tab (sloupec Effect u 16 kouzel, Green-Flame Blade), Actions tab (sloupec Damage u Spiritual Weapon, Flame Blade, Mordenkainen's Sword, Bigby's Hand, Backlash, Magic Stone, Green-Flame Blade).
