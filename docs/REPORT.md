SP-1 hotovo (D410). Commit a push viz níže.

## Co se změnilo
- src/sheet/featureActionRowData.ts: `POOL_GRANTING_FEATURES` (Font of Magic → Sorcery Point, Monk's Focus → Focus Point, Combat Superiority → Superiority Die). V `add()` platí jen pro `kind === 'feature'` bez `consumes`; dál přes `resourceKey` (D336/D409). `resourceCandidateName` beze změny, Features tab (sdílí ho) se nemění.
- src/calculation/resources.ts: `LEVEL_SCALED_USES` dostal volitelné `subclass`; nový záznam `Superiority Die` (Fighter, Battle Master XPHB: 4 od 3, 5 od 7, 6 od 15). `levelScaledMax` u záznamu s podtřídou vyžaduje podtřídu a classSource XPHB. `tableGrantedPools` přidá takový fond i bez vybraného manévru. Rest: beze změny, bere se z textu featur (e2e e potvrzuje Short Rest). Velikost kostky se nepřidávala.
- Zamítnuto pravidlo podle textu (Elder Champion, Flurry of Healing and Harm fond jen zmiňují). Prózou utrácející featury (Wild Companion, Heightened Focus, Land's Aid, Nature's Sanctuary, Wrath of the Sea, Revelation in Flesh) zůstávají bez počítadla; Psionic Power (D409) beze změny.
- Změněných míst v kódu: 4 (2 soubory), pod limitem 10.

## Testy
- Unit: featureActionRowData.test.ts (Font of Magic → Sorcery Point; Sorcerous Restoration, Elder Champion, Extra Attack beze změny), resources.test.ts (BM 3/7/15 → 4/5/6; Champion, Fighter bez podtřídy, BM 2 → bez fondu). `npm test`: 190 souborů, 3499 testů prošlo.
- e2e/poolGrantorTracker.spec.ts a–e prošly (a Font of Magic 5 boxů; b Monk's Focus 5 boxů + sdílení s Flurry of Blows; c BM 3 → 4 boxy bez manévrů; d Long Rest; e výdaj na Riposte označí i Combat Superiority a Short Rest vrací).
- `npm run typecheck` čistý. Plné `npm run e2e`: 757 testů prošlo, 6,9 min (pod 3 min limit NE: přes limit, hlásím).

## Další zdroje Superiority Die (mimo rozsah)
Superior Technique (TCE, invokace): bez `consumes`, text jmenuje fond; vlastní tracker nemá, fond dostane jen Battle Master. Martial Adept: ve feats.json pod tímto názvem nenalezen. Starší knihy Battle Master (classSource jiný než XPHB): pool bez maxima jako dosud.

## Decisions taken
- Tabulka v `LEVEL_SCALED_USES` místo samostatné konstanty (stejný vzor, D120/D374).
- `subclass` se porovnává s uloženým názvem podtřídy i classSource XPHB.
- D410 zapsán do DECISIONS.md (rozhodnutí plánovacího chatu); STATUS.md doplněn.

## Neuklizeno
Untracked: scripts/investigate-bm-table.js (git clean zakázán).

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Změněná obrazovka: záložka Actions.
