# REPORT — M9: Edit Character pro multiclass — STOP po inventuře (krok 1)

Stav: nic neimplementováno, kód beze změny. Inventura má 31 míst se skutečnou změnou (> ~25) → podle zadání STOP a návrh rozdělení M9a/M9b. Typecheck/test/e2e se nespouštěly (jen tento soubor).

## Inventura: místa, která v Editu předpokládají jednu třídu

| # | Místo | Dnes | Plánovaná změna |
|---|---|---|---|
| 1 | `CharacterSheet.tsx:2855` tlačítko Edit | multiclass vždy vypnuto „…cannot be edited yet“ | vypnuto jen bez konzistentního `levelOrder`, důvod „Cannot tell which class each level came from (no level history).“ |
| 2 | `CharacterManager.tsx:353` route edit | multiclass → BounceToSheet | bounce jen bez konzistentního `levelOrder` |
| 3 | `saveCharacter` `wizardState.ts:1261` | throw pro multiclass | povolit při konzistentním `levelOrder`, jinak throw dál |
| 4 | `saveCharacter:1266` kontrola úrovně | `classChoice.level` = celková úroveň | v multiclass Editu porovnat úroveň aktivní třídy s její uloženou |
| 5 | `saveCharacter:1272` `activeClass` | jen level up | i multiclass Edit; per-class záznamy všech tříd ze stashe (níže), ne z `existing` |
| 6 | `saveCharacter:1303` `classes` | `classesAfterLevelUp` / `[ownClass]` | `existing.classes` s podtřídou každé třídy ze stashe; nový assert „žádná třída nezvednuta“ (identita, pořadí, úrovně) |
| 7 | `saveCharacter:1346–1451` stavba per-class záznamů | jen z `data` jedné třídy | vytáhnout do funkce, volat pro každou třídu (aktivní z `data`, ostatní ze stashe) |
| 8 | `saveCharacter:1513` `levelOrder` | Edit přestaví z `classes` (jednotřídní) | multiclass Edit: `existing.levelOrder` beze změny |
| 9 | `saveCharacter:1433–1436` masteries/expertise úrovně | `keepRecordedLevels` | beze změny (osa postavy), jen ověřit |
| 10 | `WizardData` | jedna třída | nové pole stash per-class dat ostatních tříd (subclass, fightingStyle, optional/class optional features, spells, subclassSpells, classFeatureChoices, wildShapeForms, activeClassFeatureTypes) |
| 11 | reducer: nová akce přepnutí třídy | — | uloží per-class pole aktivní třídy do stashe, načte cílovou; globální pole nechá |
| 12 | reducer `setSubclass:1150` | maže VŠECHNY `subclassSkills` a jazyky podtříd | mazat jen granty podtřídy aktivní třídy |
| 13 | `wizardDataFromCharacter` | seed jedné (aktivní) třídy | seed aktivní (první v `classes`) + stash ostatních |
| 14 | seed effect `CharacterWizard.tsx:314` | `loadSubclassesFor` + optional groups jen jedné třídy | načíst pro každou drženou třídu |
| 15 | `multiclassLevelUp`/`activeClassScope` `:212` | jen level up | obecný „multiclass scope“ i pro Edit |
| 16 | `draftClasses`/`multiclassDraft` `:219` | Edit = `[ownDraftClass]` | všechny třídy, podtřídy ze stashe, uložený `levelOrder` |
| 17 | `draftCharacterLevel` `:224` | `classChoice.level` | součet úrovní |
| 18 | `featureLanguageGrants`, `wizardToolGrants`, `wizardSubclassSkillGrants`, `heldSubclassGrants` `:225–228` | `[wizardClassChoice]` | `draftClasses` |
| 19 | krok Class: `ClassPicker` `:1670` | třídu i úroveň lze měnit | multiclass: přepínač tříd (nová komponenta), třída/úroveň zamčené |
| 20 | `WeaponMasteryPicker` `:1700` počet | pool jedné třídy | součet všech tříd (jako `countOffset` M7a, ale bez přírůstku) |
| 21 | `ExpertisePicker` `:1859–1871` počet + `restrictedTo` | jedna třída | součet všech tříd, restrikce sjednoceně |
| 22 | `classSkillsSource` `:1054` | Edit = `classChoice` | `firstClass` (D321) |
| 23 | `featAsiEligibleLevelCount` `:1200` + loader `:1004` | granty jedné třídy | granty všech tříd přes `featAsiCharacterLevels` |
| 24 | krok featAsi `:2056` `level` | `classChoice.level` | celková úroveň |
| 25 | krok Hit points `:2078`, `hitDieKey :1286` | jedna kostka | `hitDiePerLevel` z `levelOrder` (D323), `multiclassHitDiceKey` i pro Edit |
| 26 | průběžné max HP `:1155` | `draftClasses` jen level up | i Edit |
| 27 | krok Spells `:1989` + `heldPrepared :897` | jedna třída; ostatní jen v level upu | aktivní třída; „Already prepared by“ i v Editu (others = ostatní třídy) |
| 28 | completeness `isReadyToSave` | jen data aktivní třídy | kontrola i stashovaných tříd (otázka 1) |
| 29 | krok Abilities | — | tlumená poznámka přes `unmetMulticlassPrerequisite` pro každou drženou třídu |
| 30 | krok Languages `MulticlassPickSlots :1932` | jen při vstupu do třídy | otázka 2 |
| 31 | Review `:2117–2131` | `classLine`/kostky jen level up | i multiclass Edit |
| 32 | Cancel baseline `:234` | jen `data` | porovnávat i stash |
| 33 | effects per třída (`:696, 723, 751, 849, 877, 981`) | klíč `classChoice` | beze změny — přepnutí mění `classChoice`, načtou se znovu |
| 34 | wildShape `:1468`, damaging cantrips `:1403` | aktivní třída | beze změny |

Skutečná změna: 1–8, 10–32 (31 míst). Beze změny: 9, 33, 34.

## Návrh rozdělení

- **M9a — jádro uložení, Edit dál zamčený.** Místa 3–8, 10–13, 28 (+ unit testy save každého per-class záznamu, assert „žádná třída nezvednuta“). Brány 1, 2 zůstávají → UI se nemění, Edit je bezpečný. Lze ověřit jen unit testy (`saveCharacter` + reducer).
- **M9b — UI a odemčení.** Místa 1, 2, 14–27, 29–32, D333, odstranění textů „cannot be edited yet“, e2e a)–e). Odemčení až tady, kdy všechny kroky na ose postavy (masteries, expertise, ASI/feat, HP) počítají se všemi třídami — dřív by Edit multiclassu mohl zahodit featAsiChoices/expertise.

## Otázky pro uživatele

1. **Neúplná ne-aktivní třída při uložení.** Uživatel změní podtřídu Clerica, nevybere nová kouzla, přepne na Wizarda a dá Save. (a) Save vypnutý, Review vypíše, která třída má nedokončené volby — **doporučuji**; (b) přepnutí blokovat, dokud aktivní třída není kompletní (jednodušší, ale svazuje); (c) uložit neúplné (proti dnešnímu „nic se neuloží neúplné“).
2. **`multiclassPicks` „jako dnes“.** Dnes se upravují jen při vstupu do třídy v Level upu; Edit jednotřídní postavy je nemá. (a) V Editu ukázat sloty pro každou ne-první třídu s volbou a dovolit změnu — **doporučuji**; (b) v Editu jen přenést beze změny.

## Rozhodnutí přijatá během práce

Žádná. DECISIONS.md, STATUS.md beze změny (nic neexistuje nového).

## Manual browser check for the user

Nic — žádná změna UI.
