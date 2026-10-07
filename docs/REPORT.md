# REPORT — M9a: jádro uložení Editu multiclass postavy (Edit dál zamčený)

Brány 1 a 2 zavřené → UI beze změny, Edit multiclassu nedosažitelný. Bez změny schématu (60). DECISIONS.md beze změny (D333 až s M9b).

## Inventura (stav po M9a)

| # | Místo | Stav |
|---|---|---|
| 1, 2 | brány Edit (sheet tlačítko, route) | M9b |
| 3 | `saveCharacter` throw pro multiclass | **M9a** — povoleno při konzistentním `levelOrder`, jinak „Cannot tell which class each level came from (no level history).“ |
| 4 | kontrola úrovně | **M9a** — v multiclass Editu per třída (`checkNoClassRaised`) místo celkové úrovně |
| 5 | `activeClass` | **M9a** — multiclass Edit má vlastní větev (`heldClassFields`: aktivní z `data`, ostatní ze stashe, musí to být přesně `existing.classes`) |
| 6 | `classes` | **M9a** — z `existing.classes` pořadí, podtřída každé třídy z jejích polí; assert identita/pořadí/úrovně |
| 7 | stavba per-class záznamů | **M9a** — `classRecordsFor`, volá ji i tvorba, jednotřídní Edit a level up |
| 8 | `levelOrder` | **M9a** — multiclass Edit zapisuje `existing.levelOrder` beze změny |
| 9 | masteries/expertise úrovně | beze změny (osa postavy) |
| 10 | `WizardData` stash | **M9a** — `otherClasses?: ClassStash[]` (`ClassFields`) |
| 11 | akce přepnutí třídy | **M9a** — `switchClass` |
| 12 | `setSubclass` | **M9a** — drží subclass skills/jazyky ostatních držených tříd |
| 13 | `wizardDataFromCharacter` | **M9a** — multiclass bez `activeClass`: aktivní `classes[0]` + stash; `WizardSeedLookups.heldClasses` (subclasses + featureTypes per třída) |
| 14–27, 29–32 | seed effect, scope, draft, kroky Class/Masteries/Expertise/featAsi/HP/Spells/Abilities/Languages/Review, Cancel baseline | M9b |
| 28 | completeness | **M9a** — `unfinishedHeldClasses(data, conditionsFor)` → `{className, classSource, missing: ["choose 2 more spells", …]}`; podmínka `heldClassesComplete` blokuje `isReadyToSave` (a tedy save). Výpis v Review = M9b |
| 33, 34 | effects per třída, wildShape/cantrips | beze změny |

`multiclassPicks` (odpověď 2): multiclass Edit je zapisuje vždy (změněné i nezměněné); odmítne pick třídy, která není držená, nebo první třídy (`firstClass`). Sloty v UI = M9b.

## Ověřeno

- `npm run typecheck` OK, `npm run test` 3195/3195, `npm run validate-data` 175/175, `npm run e2e` 477/477 (5,4 min — nad limitem ~3 min).
- Nové unit testy `wizardState.test.ts` „multiclass Edit (M9a)“ (Fighter 3 BM / Druid 2 / Warlock 2 / Wizard 3 Bladesinger): seed aktivní + stash; nedotčený save = všechny per-class záznamy, `classes`, `levelOrder`, `multiclassPicks` beze změny; přepínání tříd drží stash a save píše každou třídu z jejích polí; `switchClass` na nedrženou třídu = no-op; `setSubclass` maže jen granty aktivní třídy; změna podtřídy se uloží jen u své třídy; assert (úroveň stashe, úroveň aktivní, chybějící/cizí třída, bez/nekonzistentní `levelOrder`); `multiclassPicks` změna + odmítnutí na první třídě; `unfinishedHeldClasses` hlásí neúplnou stashovanou třídu a save je blokovaný. Původní test D316 přepsán na novou chybovou hlášku.
- Jednotřídní Edit a level up: všechny dosavadní unit i e2e testy prošly beze změny.
- Prostředí: e2e potřebovalo Chromium headless shell 1243; v sandboxu vytvořena kopie z 1194 v `/opt/pw-browsers` (mimo repo).

## Rozhodnutí přijatá během práce (k potvrzení v D333)

- Fighting style bez třídy (D318, jen pre-58 multiclass) se při seedu nepřiřadí žádné třídě a save ho přenese beze změny.
- Optional-feature záznam, který si žádná držená třída ani podtřída nenárokuje (chybějící lookup), jede s `classes[0]` — stejně jako v jednotřídním Editu, takže se neztratí.
- Texty `missing` v `unfinishedHeldClasses` jsou anglické krátké fráze („choose N more cantrips/spells“, „remove N …“, „choose a subclass“, „requirements still loading“); finální formát řádku v Review rozhodne M9b.

## Manual browser check for the user

Nic — žádná změna UI.
