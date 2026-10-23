# Report — B-4a: Manage Feats, otevřené volby a editor filter-choice / Strixhaven (D375)

Setup: fetch + ff-only už aktuální, HEAD afde93a. Větev nepřepnuta.

## Co se změnilo
- `ManageFeatsPanel.tsx`: `FeatRow` dostal `defaultOpen`; řádek s `row.pending` se otevře (useEffect, protože pending přichází až po načtení dat featů). Řádek bez nevybraných voleb zůstává sbalený.
- `ManageFeatsPanel.tsx`: `editable` už nevylučuje Strixhaven Initiate a 8 filter-choice featů; vykresluje `NamedBlockSubPicker` + `FilterChoiceSpellSubPicker` (stejné podmínky a handlery jako `FeatAsiPicker.tsx:207-233`). Zápis přes stávající `setFeatChoiceDetails` (`characterStore.ts:1012`, `:1027`, background/species větve), bez změny schématu (zůstává 61).
- `FeatAsiPicker.tsx`: oba pickery exportovány; `grantLevel` smí být i string (jen název radio skupiny).
- `featuresTabData.ts`: nová `featEditableInManageFeats` (jediné pravidlo pro panel i Features tab): false jen pro filter-choice/Strixhaven na ASI úrovni. Pending text na Features tabu tak míří na Manage Feats pro manual/item/background/species a mizí po výběru. `CharacterSheet.tsx:1364` jen komentář.
- Staré e2e `customItemFeats.spec.ts`, `speciesFeat.spec.ts`, `wizardF5.spec.ts` klikaly na toggle řádku, který se teď otevírá sám (klik by ho zavřel) — klik odstraněn. `manageFeats.spec.ts` R13b c přepsán na kontrolu `aria-expanded=true`.
- Docs: D375 v DECISIONS.md, STATUS.md; DATA.md beze změny.

## Ověření
- typecheck OK; vitest 3400/3400 (nový unit test `featEditableInManageFeats`); validate-data 177/177; e2e 643/643, trvalo 7,5 min (nad 3 min).
- Nové e2e (`manageFeats.spec.ts`, seed schema 61): B-4a a (Skilled: tři selecty viditelné hned po Add, po zavření a znovuotevření sbalený, Features tab „Skills: Arcana, History, Nature“), b (ruční Fey-Touched: ability + spell v panelu, pending zmizí), c (ruční Strixhaven Initiate: college, cantrip pair, ability, spell; Features tab „Choice: Quandrix 2“).
- Neověřeno testem: pending text „make them in Manage Feats“ pro filter-choice feat zvlášť (pokryto jen sdílenou funkcí + zmizením pending); item/background/species varianta filter-choice pickeru (stejný kód, žádný scénář).

## K rozhodnutí
- Nic nezablokováno. Poznámka: nesledované skripty `scripts/investigate-feat-granting-options.js` a `scripts/investigate-b3-prose-counts.mjs` zůstávají (git clean nebyl pokynem povolen); zjištění z P-B4 o `featProgression` stále není v DATA.md.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Manage Feats (My Feats: řádky s nevybranými volbami rozbalené; nové pickery college/cantrips u Strixhaven Initiate a spell checkboxy u filter-choice featů), Features & Traits (pending řádek u těchto featů).
