# F-TGS2 — guardy v loadHomebrew() a dva multiclass testy (D389)

Setup: `git fetch` + `git merge --ff-only origin/main` → už aktuální, HEAD 92af693. Větev main.

## Co se změnilo
`scripts/extract-data.js`, `loadHomebrew()`:
1. `HOMEBREW_WORDING`: `applyWording` nahrazuje všechny výskyty `from` (split/join), počítá je; throw při 0, throw když po smyčce zůstane `from` v `JSON.stringify(node)`. Víc než 1 výskyt se vypíše (`Homebrew wording … replaced N times`).
2. `HOMEBREW_REST_FEATURES`: počítá zásahy regexu i pro záznamy bez `sentence`; throw při 0.
3. `HOMEBREW_SUBCLASS_TABLES`: throw, když podtřída už má `subclassTableGroups`; po smyčce přes soubory throw, když klíč nesedí na žádnou ponechanou podtřídu.
4. `HOMEBREW_SUBCLASS_SPELLS`: totéž (kontrola klíče po smyčce; stávající kolize zůstala).
5. `HOMEBREW_RACE_2014_BLOCKS`: throw, když rasa nepřišla o žádný blok.
Zprávy nesou název tabulky a klíč. Kontrola klíčů je až po smyčce přes `HOMEBREW_FILES`, protože klíč může sedět jen v jednom souboru.

Testy (bez změny kódu sheetu):
- `spellActionRowData.test.ts`: Fighter 18 Psi Warrior + Wizard 1 → Telekinesis jedna řada, DC z podtřídního INT (17), ne z Wizard DC 15.
- `classPools.test.ts`: Paladin Spelldrinker (Absorb Magic, Expeditious Command) + Cleric → `resourceKeyFor` dává `Channel Divinity (Paladin)`, ne Cleric pool.

Docs: DECISIONS D389, DATA.md (řádek guardů), STATUS.md.

## Ověřeno
- `npm run extract-data`: prošlo, žádný nový guard nevystřelil; nevypsal se žádný „replaced N times" → druhý výskyt žádného `from` neexistuje. `git status data public/data` prázdný → data beze změny, žádná featura se nezměnila.
- typecheck OK; test 188 souborů / 3444 testů OK; validate-data 177/177; e2e 689 passed (2.9 min).

## Rozhodnutí / otázky
- Rozhodnuto: kontrola „klíč bez shody" běží po smyčce přes soubory (viz výše), ne uvnitř.
- Test D386 volá `resourceKeyFor` s `className` Paladin (jako výstup splitu `HOMEBREW_SPLIT_OPTIONS`); neprochází celým datovým řetězcem splitu — ten kryje guard extrakce a e2e TGS2-4b.
- Subagent nebyl použit.
- Nepřidané untracked soubory (REPORT-*.md, scripts/*.js, Mistari*.json, dm screen.pdf aj.) nejsou součástí tohoto commitu.

## Manual browser check for the user
none - no UI change.
