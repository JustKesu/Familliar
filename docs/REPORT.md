# Report — B-5: volby class options v Review průvodce (D378)

HEAD před úkolem: fetch + `merge --ff-only origin/main` → „Already up to date“, 197adf3. Větev nezměněna.

## Změny (6 souborů)
- `src/creation/review/ReviewStep.tsx`: karta „Class options“ mezi Spells a Feats, řádek na featureType s volbami
  (popisek z nového propu `classOptionLabels`, fallback „Class options“; jména přes `compareText`), nadpis přes
  `CardHeading` na krok `classOptionalFeatures` (D298). Bez voleb karta chybí. What's new: řádek „Options added“
  (volby podle featureType|name, které nejsou v `baseline`), počítáno jako `spellsAdded`.
- `src/creation/CharacterWizard.tsx`: předává `classOptionLabels` z `classOptionalFeatureGroups` (stejná jména jako `stepLabel`).
- `e2e/reviewClassOptions.spec.ts` (nový): a) nový Warlock 2 průvodcem → karta s 3 invokacemi, odkaz nadpisu vede na
  krok; b) seed schema 62 Warlock 4 → 5 → „Options added: Mask of Many Faces, Pact of the Blade“; c) Fighter 1 → karta chybí.
- `docs/DECISIONS.md` D378, `docs/STATUS.md` B-5.

## Ověřeno
- `npm run typecheck` OK, `npm run test` 187 souborů / 3413 testů OK, `npm run validate-data` 177/177 OK.
- `npm run e2e`: 651/651 OK, 3,3 min (mírně nad ~3 min).
- Nový spec napoprvé spadl na mé chybě (Acolyte nemá +1 Constitution), po opravě 3/3. Unit guard F-18 odhalil
  `localeCompare`, nahrazeno `compareText`.

## K rozhodnutí / poznámky
- Zadání uvádí „dvě invokace“ u Warlocka 2; data (EI progrese) dávají na úrovni 2 tři — test vybírá tři.
- „Options replaced“ vynecháno: WizardData má vyměněnou starou volbu (baseline − data, D110), ale ne vazbu,
  která nová ji nahradila (při 4 → 5 přibudou dvě, nelze říct která). Kdyby se mělo ukazovat, potřebuje to
  rozhodnutí: buď jen „Replaced: Agonizing Blast“ bez nové, nebo ukládat párování ve swap stavu kroku.
- Subclass volby (manévry, runy) a fighting styles do karty nepatří — jsou mimo `classOptionalFeatureChoices`; neřešeno.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Review průvodce (nová karta Class options; v level upu řádek Options added ve What's new).
