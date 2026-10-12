# REPORT — F-24: Remove level ukončí koncentraci na odebraném kouzle (D352)

## Co se změnilo
Inventura: 1 místo v kódu (`levelRemovalCore`, src/levelUp/levelRemoval.ts), bez dělení.
- Blok D332 pro `play.concentratingOn` už nevyžaduje `classRemoved`. Kandidáti = `droppedSpells` (třída, level stamp, subclass picky) + všechna kouzla z `optionalFeatureChoices[].spellChoices` před odebráním. Důvod druhé množiny: kaskáda D347 (`cascadePrerequisiteLoss`) vrací jen jména kouzel bez zdroje; kouzlo, které zůstalo, vyřadí kontrola „still held“ nad výsledným stavem (stejná kontrola jako u D332, jedna cesta, žádná kopie).
- Řádek v okně potvrzení: „Concentration: <kouzlo>“ (stejný jako u D332).
- Docs: D352 v DECISIONS.md, řádek F-24 v STATUS.md.

## Ověřeno
- typecheck OK; test 182 souborů / 3302 OK; validate-data 175/175 OK; e2e plná sada 558 passed (6.6 min, nad limitem ~3 min).
- Unit: levelRemoval.test.tsx „D352: concentration on a spell removed with its option ends; the same spell held from another source keeps it“ (Tome Find Familiar odebrán stampem 5 → `play` pryč + řádek v dropped; stejné kouzlo i v Warlock `spellChoices` → koncentrace zůstává).
- E2E: levelUpSwap „F-24 (D352): Remove level that drops Pact of the Tome by its stamp ends concentration on a Tome spell“ — seed Warlock 5 (schéma 61, vytvořen na 4, Tome stamp 5), koncentrace na Detect Magic; karta Concentration ho před ukazuje, okno vypíše „Pact of the Tome spell: Detect Magic“ a „Concentration: Detect Magic“, po potvrzení karta kouzlo nemá a `play` je v úložišti pryč.
- Cesta přes kaskádu D347 (ne stamp) nemá vlastní test; sdílí stejný blok kódu, kandidáti pocházejí z množiny před odebráním.

## Rozhodnuto během práce / otázky
- Kandidátní množina pro kaskádu = všechna kouzla voleb před odebráním (viz výše), protože kaskáda nevrací zdroj kouzla; chování ve výsledku odpovídá D352.
- Test F-11 „concentration on a spell a feat also grants still ends with the removed class“ platí beze změny (uložené jsou jen class/subclass/option picky).

## Manual browser check for the user
- Warlock s Pact of the Tome zvoleným na nejvyšší úrovni a soustředěním na jeho kouzlo (např. Detect Magic) → „Remove level N“: v okně potvrzení řádek „Concentration: …“ pod kouzly Tome (zalomení, pořadí); po potvrzení karta Concentration na sheetu to kouzlo neukazuje.
