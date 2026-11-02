SP-1 follow-up ZASTAVENO: scénář c (Battle Master 3, 4 boxy na Combat Superiority) nelze splnit tabulkou D410. Nic necommitnuto ani nepushnuto. HEAD 39adf0b (ověřeno).

## Co je hotové v pracovním stromu (necommitnuto)
- src/sheet/featureActionRowData.ts: `POOL_GRANTING_FEATURES` (Font of Magic -> Sorcery Point, Monk's Focus -> Focus Point, Combat Superiority -> Superiority Die); `add()` ji použije jen pro `kind === 'feature'` bez `consumes`, pak jde klíč dál přes `resourceKey` (D336/D409). `resourceCandidateName` beze změny, protože ho sdílí Features tab (featuresTabData) a ten se měnit neměl.
- src/sheet/featureActionRowData.test.ts: blok "D410" (Font of Magic -> Sorcery Point; Sorcerous Restoration, Elder Champion, Extra Attack beze změny). Nespuštěno (npm test zatím neběželo).
- e2e/poolGrantorTracker.spec.ts: a, b, d PROJDOU (Font of Magic 5 boxů; Monk's Focus 5 boxů a utracení se projeví i na Flurry of Blows; Long Rest vrátí boxy). c SELŽE.

## Proč c selhává
Řádek Combat Superiority existuje, ale bez boxů. Battle Master v XPHB nemá `subclassTableGroups` (ověřeno skriptem: pole je prázdné), takže pool Superiority Die nemá spočitatelné maximum. Stejně nemají boxy ani řádky manévrů Riposte a Parry ani se třemi vybranými manévry (error-context.md). Je to stávající stav, ne důsledek D410: počet kostek (4 na úrovni 3) je jen v próze featury Combat Superiority.

## K rozhodnutí
Odkud brát maximum Superiority Die?
1. Zapsat počet do ruční tabulky podle úrovně Battle Master (4 / 5 od 7. / 6 od 15.) vedle POOL_GRANTING_FEATURES. Zasáhne resources.ts, tj. i řádky manévrů (dostanou boxy také) a Resources panel.
2. Parsovat próze "four Superiority Dice" (D21 parsování prózy omezuje).
3. Scénář c vypustit; D410 pak pro Battle Mastera nic neudělá, jen pro Font of Magic a Monk's Focus.
Odhad kódu u varianty 1: 1 místo v resources.ts + testy; pod limitem 10.

Neuklizené (untracked): scripts/investigate-pool-grantors.js zmizel dříve, nově scripts/investigate-bm-table.js.

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Změněná obrazovka: Actions tab (zatím nic k hodnocení).
