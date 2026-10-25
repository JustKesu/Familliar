# REPORT — A-1: řádky Ability Score Improvement v sekci Feats (D397)

Setup: `git fetch`, `git merge --ff-only` → už aktuální, HEAD fc8778f. Bez změny větve.

## Co se změnilo
- `src/sheet/featuresTabData.ts`: nový vstup `asiChoices` / `asiText`; `featRowsWithAsi` skládá řádky Feats (ASI řádky + feat řádky, stabilní řazení podle úrovně; background/species první, manuální/item featy za level featy). `levelFeatChip` přesunut sem (cyklický import by jinak vznikl), `ManageFeatsPanel.tsx` ho re-exportuje. Nová `asiIncreasesLabel` („STR +1, CON +1“).
- `src/sheet/CharacterSheet.tsx`: předává `asiChoices` (jen `kind: 'asi'`) a text feat „Ability Score Improvement“ XPHB z `featTextEntries`.
- Úložiště, schéma, `asiIncreasesSummary` v Manage Feats beze změny.
- Řádek se rozbaluje jako ostatní (text feat, jinak prázdný text bez „No text found“); navýšení je vždy vidět pod řádkem. Řádek tvaru řádků vyhovoval, žádný STOP.
- `docs/DECISIONS.md` D397, `docs/STATUS.md`.

## Ověřeno
- `npm run typecheck`, `npm run test`, `npm run validate-data`, `npm run e2e`: viz závěr níže.
- Unit: 2 nové testy v `CharacterSheet.test.tsx` (ASI řádek: název, „From level 4“, „STR +1, CON +1“, text po kliknutí, žádné „No feats chosen yet.“; level feat → žádný ASI řádek).
- e2e `e2e/asiFeatRow.spec.ts` (3 scénáře, prošly): a) Barbarian 4 + Tough ukazuje řádek s „From level 4“ a „STR +2“; b) filtr Feats řádek drží; c) Fighter 4 s featem Alert na úrovni 4 žádný ASI řádek nemá.

## A-1b (dodatek)
ASI řádek v sekci Feats teď používá `featSource` jako level featy („From Barbarian 4“, multiclass třída a její úroveň). `featRowsWithAsi` už `levelFeatChip` nevolá; ten dál používá Manage Feats („From level 4“). Testy upraveny (unit „From Fighter 4“, e2e „From Barbarian 4“). Ověřeno: typecheck, test, `e2e/asiFeatRow.spec.ts`; celé e2e a validate-data po A-1b neběžely. D397 v DECISIONS.md zmiňuje `levelFeatChip` a „From level 4“, je tedy zastaralé; neměnil jsem ho.

## Rozhodnutí během práce
(Níže popsaná nekonzistence štítků je A-1b vyřešena.)
- Zkratky „STR +2“ jsou nová funkce `asiIncreasesLabel`; Manage Feats dál píše „Strength +2“ (`asiIncreasesSummary`), aby se nerozbily jeho texty.
- Štítek: „From level 4“ i u jedné třídy (podle zadání), zatímco level featy v téže sekci mají „From Fighter 4“ (`featSource`). Nekonzistence v sekci, na tvé rozhodnutí.

## Otázky
- Sjednotit štítky level featů a ASI v sekci Feats (buď „From level N“, nebo „From <Třída> N“)?

## Subagenti
Nepoužiti.

## Git
`docs/QUESTIONS.md` měl neuložené změny, které jsem neudělal; přidán do commitu beze změny.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Features & Traits tab → section Feats (nový řádek Ability Score Improvement, filtr Feats).
