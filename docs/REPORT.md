# REPORT — P-TGS2: průzkum homebrew „The Griffon's Saddlebag, Book 2“

HEAD 8ba8139 (ověřeno). Jen průzkum; změněny jen docs/REPORT.md a scripts/investigate-tgs2.js (režimy `overview|fields|clashes|tags|mechanics|text|racetext|items`). Soubor stažen do data-source/homebrew/griffons-saddlebag-2.json (git-ignored). Testy/e2e nespuštěny (nic se neměnilo).

## 1. extract-data.js
- Zdroj je pevně `SOURCE_DATA_DIR` (5etools-src-main/…/data); `main()` skončí `process.exit(1)`, když složka chybí → v cloudu extraktor nejde spustit vůbec, implementace musí běžet lokálně.
- Filtry: podtřídy `ALLOWED_CLASS_SOURCES.includes(classSource) && ALLOWED_SOURCES.includes(source)` (:2084); prvky podle reference z kept podtříd (:2123); druhy `edition === "one" && ALLOWED_SOURCES` nebo MPMM (:1449); `ability` mazán jen u MPMM (:1472), jinak warning.
- Co homebrew shodí: (a) `source` GriffonsSaddlebag2 není v ALLOWED_SOURCES; (b) všech 12 podtříd má `classSource` "PHB" → vypadnou; (c) rasy nemají `edition` (ani `_meta.sources` ji nemá) → vypadnou; (d) `ability` na rasách → warning; (e) totéž allowlist v `src/subclass/subclassData.ts:45-46` (podagent) a ve validate-data.js:42 + chybějící EXPECTED_COUNTS → validate selže.
- Homebrew nemá `_copy`, `_versions`, `consumes`, `subclassTableGroups`. Id prvků: ref `Name|Bard|PHB|Mercantile|GriffonsSaddlebag2|3` i záznam s `classSource` PHB dávají shodné `scf|…|phb|…` → reference se spojí.
- Nejmenší vstup: konstanta `HOMEBREW_FILES` (cesta k JSON) + normalizační funkce; v `extractClasses` přidat `subclass`/`subclassFeature` do `raw` před `prepareEntries`, v `extractSpecies` přidat `race`. Normalizace: whitelist 7 podtříd + 2 ras, `classSource` podtřídy PHB→XPHB (záznamy prvků nechat PHB, viz 4), smazat `ability`, přepsat tagy (bod 3).

## 2. Nepodporovaná pole, kolize
- Podtřídy: klíče jen `name,shortName,source,className,classSource,page,subclassFeatures,fluff` (+`additionalSpells`,`subclassSpells` u Spelldrinker/Rocborne). 46 prvků, klíče `name…level,header,entries`, bez `consumes`.
- Rasy: Etherean `size ["M"]`, Geleton `size ["V"]` (text: „Medium or Small“) — v data/ jsou jen M,S; `SIZE_NAMES` zná T/S/M/L, `V` by se vypsalo syrově. `speed` 30 a `darkvision` 30 app čte. `languageProficiencies {common, any:1}` app u druhů nečte. V `entries` zůstávají 2014 bloky „Ability Score Increase“, „Age“, „Alignment“, „Size“, „Speed“, „Languages“, „Creating Your …“.
- Kolize jmen: žádná pro 7 podtříd ani 2 rasy. Jména prvků „Channel Divinity“ a „Oath Spells“ (Spelldrinker) už v subclass-features.json pro Paladina existují (stejný vzor jako XGE oaths; e2e reviewFixesM10 počítá řádky „Channel Divinity“ — riziko).

## 3. Tagy (vybrané záznamy)
| tag | jméno | zdroj | XPHB v data/ |
|---|---|---|---|
| spell | detect thoughts, hellish rebuke, nystul's magic aura, otiluke's resilient sphere | PHB | ano |
| spell | animal messenger, bane, detect magic, dimension door, dispel magic, dominate beast, dominate person, etherealness, feather fall, gentle repose, gust of wind, hold person, ice storm, legend lore, lightning bolt, mage hand, scrying, see invisibility, slow, spare the dying | — | ano |
| condition | blinded, deafened | PHB | ano |
| condition | exhaustion, grappled, invisible, prone, unconscious | — | ano |
| item | healer's kit | PHB | ano |
| action | Attack, Dash, Disengage | — | ano |
| action | **grapple** (Infernal), **Use an Object** (Mercantile) | — | **MISS** |
| skill/sense/language | 7 skill, blindsight, truesight, Abyssal, Infernal | — | n/a (bez lookupu) |
`additionalSpells` (Spelldrinker prepared, Rocborne known) nesou `"x|PHB"` — všech 15 má XPHB protějšek. Formátovací: dice 8, damage 2, chance 1, filter 1.

## 4. Co by list spočítal
- Resource pool vzniká jen přes `consumes` nebo `isSelfLimitedFeature` (resources.ts:114), který vyžaduje tag `{@variantrule Short|Long Rest}` (REST_TAG, actionTableFeatureData.ts:22). Homebrew píše „short or long rest“ bez tagu → **žádný prvek se nestane poolem**. Max jen z `subclassTableGroups` (homebrew žádné), LEVEL_SCALED_USES, nebo implied single use; počet „= modifikátor“ je dle D43 unknown.
- Kandidáti na pool: Launch (3/4/5 na 3/7/15, SR) — vyžaduje tabulku; Improved Launch, Bloodbound (1/SR), Sight Beyond Sight (1/LR) — implied single use po doplnění tagu; Money Talks (CHA), Whispers of Knowledge (WIS), Ghost Walker (WIS) — unknown (D43). Medic, Field Surgeon jsou per-tvor limity, ne pool.
- Kouzla: Spelldrinker/Rocborne `additionalSpells` → collectFixedGrants (subclassPreparedSpells.ts) po přesměrování na XPHB. Prose only: mage hand (Aether), animal messenger ritual (Steel Hawk), detect thoughts za 2 Hit Dice (Infernal), gentle repose/see invisibility/spare the dying za 2 ki (Aether), etherealness 1/LR, hellish rebuke (reakce), dominate beast/person (Bloodbound).
- Damage ridery: app z podtříd žádné nepočítá (weaponAttacks.ts) → Hellfire Claw 1d6–1d12, Magic Coin 1d12–3d12, Spirit Strike d4, Guiding Wind 1d4/1d8, Nimble Lancer, Transfusion vše prose. Odolnosti (Infernal fire, Rocborne cold, Geleton acid) jen přes ruční tabulku featureDamageResponses.ts.
- 2014 pojmy: ki (Spectral Guide, Ghost Walker; `consumes.amount` app nečte, Focus pool Mnicha existuje z tabulky třídy, cena jen prose); Infernal Warrior „Attack action to grapple“ (2024 grapple = Unarmed Strike se save, tag `{@action grapple}` bez XPHB cíle); „Hit Dice“ (Planar Conspirator); Channel Divinity Spelldrinker bez `consumes`.
- Join (D343): `buildFeatureReachTest` páruje prvky podtřídy bez classSource (className+subclassShortName+subclassSource) → záznamy s classSource PHB se dosáhnou stejně jako XGE/TCE. Podmínka: podtřída v classes.json musí mít `classSource` XPHB, protože `resolveSubclassShortName` (armourClassData.ts:95) i filtr extraktoru classSource porovnávají.

## 5. Položky
519 `item` (258 bez typu/wondrous; typy 2014 kódy `P,R,S,M,HA,LA,RD|DMG,RG|DMG,WD|DMG,SC|DMG,VEH,GV…`), 31 `magicvariant` (requires Arrow/Longbow…), 0 baseitem; dalších 97 monster, 60 table. Extraktor `magicvariant` nerozbaluje (QUESTIONS.md, fáze 2), legendy typů z DMG/PHB 2014 nejsou v allowlistu. Kolize jmen žádné. **Doporučení: skip** (mimo rozhodnutí uživatele, velký objem, nesedí na pipeline).

## 6. Návrh rozdělení
1. TGS2-1 extrakce (lokálně): HOMEBREW_FILES, normalizace (whitelist, classSource→XPHB, ability pryč, tag/additionalSpells redirect PHB/bez zdroje→XPHB), ALLOWED_SOURCES ×3 (extract, validate, subclassData.ts), EXPECTED_COUNTS (classes +7, species +2), DATA.md. ~15 míst.
2. TGS2-2 rasy: Geleton size, odstranění 2014 bloků z `entries`, e2e výběru druhu. ~8 míst.
3. TGS2-3 pooly: rest tagy v normalizaci + `subclassTableGroups` pro Launch; e2e na Launch/Bloodbound. ~10 míst.
4. TGS2-4 kouzla z prvků do `additionalSpells` (mage hand, etherealness 1/LR, …) a Channel Divinity `consumes`. ~10 míst.
5. TGS2-5 (volitelně) odolnosti do featureDamageResponses, 2014 pojmy v textu.

## Decisions taken
- Pro shody tagů jsem bral jméno case-insensitive + source XPHB v data/; nesourcovaný tag = PHB (konvence 5etools).
- Velikost/jazyky ras, akce grapple apod. jsem neřešil, jen hlásím.

## Open questions for the user
1. Geleton `size "V"`: uložit jako `["S","M"]` (výběr jako 2024 druhy), nebo jen `["M"]`?
2. 2014 bloky v `entries` ras (ASI, Age, Alignment, Size, Speed, Languages, Creating…): vyřadit, nebo nechat jako text?
3. `{@action grapple}` a `{@action Use an Object}` bez XPHB cíle: přepsat na `{@action Utilize|XPHB}` / Unarmed Strike, nebo nechat plain text? A má Infernal Warrior zůstat 2014 znění „grapple check“?
4. Ki / Hit Dice / Channel Divinity: jen prose, nebo přepsat ki→Focus Points a přidat `consumes`?
5. Homebrew JSON je v git-ignored data-source/: má se zkopírovat do repa (např. `data-source-homebrew/`), aby extrakce byla reprodukovatelná?
6. Pooly s počtem = modifikátor (Money Talks, Whispers, Ghost Walker): nechat unknown dle D43?

## Subagent
1× Explore: jak list odvozuje pooly, consumes, kouzla, ridery, ki a allowlist v src/ (zdroj bodu 4 a allowlistu v subclassData.ts).

Manual browser check for the user: none - investigation only, no screens changed.
