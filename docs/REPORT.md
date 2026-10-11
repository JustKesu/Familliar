# REPORT – F-17: prvky starších podtříd na třídách 2024 (D343)

HEAD při startu: c1b507a (fetch + ff-merge „Already up to date“).

## Změna
- `src/sheet/featureReach.ts`: záznam podtřídy (má `subclassShortName`) se páruje přes `className` + úroveň + `subclassShortName`/`subclassSource` bez `classSource`; záznam třídy zůstává přísně na `classSource`. Opraveno jedním místem pro `grantedClassFeaturesFrom` (Features & Traits, Actions, pooly) i `featureNamesFor`.
- e2e/reviewFixesM10.spec.ts: jen zastaralý komentář u F-12 c (tvrdil, že Conquest nemá Guided Strike); aserce beze změny.

## Data (scripts/check-f17-duplicates.js, smazán po pushi)
- 41 dotčených podtříd, 265 záznamů nově dosažitelných (souhlasí s investigací), z toho 16 pool spenderů (Channel Divinity, Wild Shape, Ki→Focus Point, Sorcery Point).
- Duplicity: 0 dvojic stejného jména+úrovně pod oběma classSource v jedné podtřídě → krok 1 prošel.
- Postavy tříd mimo XPHB (PHB 2014): 0 záznamů navíc → chování beze změny.
- Očekávané hodnoty e2e: Paladin XPHB L3 Channel Divinity 2, Druid XPHB L3 Wild Shape 2 (classes.json). Circle of Wildfire je částečná podtřída (seed „Circle of Wildfire“ XPHB, ostatní PHB).

## Testy
- Unit `src/sheet/featureReach.test.ts`: PHB záznam podtřídy na XPHB postavě dosažen; PHB záznam třídy ne (XPHB ano); jiná podtřída ne; nad úrovní ne.
- e2e `e2e/olderSubclassFeatures.spec.ts`:
  - F-17 a: Paladin 3 Oath of Conquest – Conquering Presence a Guided Strike v Paladin Features právě jednou, Aura of Conquest (L7) ne; řádek Guided Strike v Actions, Use sníží Channel Divinity (2 boxy) o 1.
  - F-17 b: Druid 3 Circle of Wildfire – řádek Summon Wildfire Spirit, Use utratí Wild Shape (2 boxy); Enhanced Bond (L6) není ve Features.
- Žádná existující aserce nebyla upravena ani označena fixme.
- typecheck OK, test 3266/3266, validate-data 175/175, e2e 527/527 (2,5 min).

## Rozhodnutí / poznámky
- D343 doplněno do DECISIONS.md (zadáno v promptu); STATUS.md a sekce DATA.md („fixed in F-17“) aktualizovány.
- Nesledované soubory z dřívějška (docs/REPORT-REVIEW-*.md, docs/REPORT-MULTICLASS.md, docs/REPORT-SPECIES.md, CLAUDE-1.md, „Claude outputs/“) necommitnuty, jako v předchozích taskech; rozhodněte, zda je verzovat nebo smazat.
- Investigační skript z c1b507a (`scripts/investigate-hidden-nested-subclass-features.js`) byl nesledovaný, `git clean -fd scripts` ho po pushi odstraní spolu s novým skriptem.

## Manual browser check for the user
Na https://familliar.vercel.app:
- Paladin 3 (XPHB), Oath of Conquest, záložka Features & Traits: skupina Paladin Features – zalomení dlouhých řádků (Tenets of Conquest, Conquering Presence, Guided Strike) a štítků původu „Conquest, Paladin 3“.
- Stejná postava, záložka Actions: řádek Guided Strike s boxy Channel Divinity – zarovnání a šířka na mobilu.
- Druid 3 (XPHB), Circle of Wildfire, záložka Actions: řádek Summon Wildfire Spirit s boxy Wild Shape – zalomení dlouhého jména.
