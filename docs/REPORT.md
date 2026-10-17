# REPORT F-35

Setup: `git fetch` + `git merge --ff-only origin/main` → už aktuální, HEAD 6653e6f.

## Co se změnilo
- `src/sheet/CharacterSheet.tsx:2837-2839` – `.sheet__size` místo „ (…)" vykresluje „ · Medium"; `UnresolvedValue` pro neznámou velikost zůstal.
- `src/sheet/spellActionRowData.ts` (konec `cantripDamageAtLevel`) – řádky obsahující „secondary creature" se řadí za ostatní; hodnoty beze změny.
- `src/sheet/spellActionRowData.test.ts` – přidán případ s obráceným pořadím záznamů.
- `e2e/reviewF34.spec.ts` – F-34 d kontroluje „Genasi (Air) · Medium" a žádné „) (" / „)("; nový F-35 b (Wizard 5, INT 16: on-hit řádek před secondary creature).
- `docs/STATUS.md` – záznam F-35.
- Existující testy hlásící „(Medium)" neexistovaly (testy `.sheet__size` hledají jen `toContain`), tj. žádná jiná úprava nebyla třeba. Změněná místa: 3 zdrojová + 3 testovací.

## Ověřeno
typecheck OK; `npm test` 3373/3373; validate-data 175/175; e2e 598/598 (2.9 min).

## Rozhodnutí v kódu
- Pořadí řeší úzké pravidlo „secondary creature" naposled v `cantripDamageAtLevel` (stabilní, jen tento popisek, nemění hodnoty). Pořadí v datech jsem neotevíral (CLAUDE.md zakazuje); bez pravidla specifického pro tento popisek to opravit nešlo, protože pořadí plyne z `scalingLevelDice`.

## Subagenti
Nepoužity.

## Cleanup
`git clean -fd scripts` byl agentovi dvakrát odmítnut (permission), spustil ho uživatel ručně po pushi. Odstraněno (untracked): investigate-f20-swap.js, investigate-f20a-seeds.js, investigate-f34-genasi.mjs, investigate-s5-natural.mjs, investigate-s5-texts.mjs.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
Změněné obrazovky: hlavička listu (řádek species/size/class), Spells tab (sloupec Effect, Green-Flame Blade), Actions tab (Green-Flame Blade).
