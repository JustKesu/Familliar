# REPORT — F-23: Remove level bere kouzla Pact of the Tome s volbou (D351)

## Co se změnilo
Inventura: 1 místo v kódu (`levelRemovalCore`, src/levelUp/levelRemoval.ts), bez dělení.
- Větev mazání podle stampu: `spellChoices` volby odebrané podle level stampu se mažou vždy, ne jen při `classRemoved`. Řádky „Pact of the Tome spell: …“ v okně potvrzení stejně jako u kaskády D347. Komentář D332 nahrazen citací D351.
- Vyprázdněné `spellChoices` se vynechá (shodně s `swapOut`/`cascadePrerequisiteLoss` v optionSwap.ts), místo uložení `[]`.
- Familiar Pact of the Chain při odebrání podle stampu už fungoval (D348, `familiarAfterOptionChange` nad výsledkem), beze změny.
- Docs: D351 v DECISIONS.md, řádek F-23 v STATUS.md.

## Ověřeno
- typecheck OK; test 182 souborů / 3301 OK; validate-data 175/175 OK; e2e plná sada 557 passed (6.8 min, nad limitem ~3 min).
- Unit: levelRemoval.test.tsx „D351: Pact of the Tome removed by its stamp takes its spells while the class stays; a kept Tome keeps them“. Testy D347/D348 beze změny zelené.
- E2E: levelUpSwap „F-23 (D351): Remove level that drops Pact of the Tome by its stamp lists and removes its spells“ — seed Warlock 5 (vytvořen na 4, Tome + Mask of Many Faces se stampem 5, Tome cantripy a rituály), okno vypíše volbu i 5 kouzel, po potvrzení zmizí z úložiště i ze záložky Spells.

## Rozhodnuto během práce / otázky
- Ukončení koncentrace (`play.concentratingOn`) na kouzlu odebraném s volbou dál běží jen při odebrání třídy (D332). Tome kouzla odebraná podle stampu tak koncentraci neukončí. Otázka pro Daniela, zda D351 má zahrnout i to.
- Párování `optionName` při mazání podle stampu zůstává přesné (case-sensitive), na rozdíl od `swapOut`/`undoSwap`; app jiné velikosti písmen neukládá.

## Manual browser check for the user
- Warlock s Pact of the Tome zvoleným na nejvyšší úrovni → sheet, tlačítko „Remove level N“: okno potvrzení — řádky „Pact of the Tome spell: …“ pod „EI option: Pact of the Tome“, zalomení a délka seznamu.
