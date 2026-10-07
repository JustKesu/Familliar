# REPORT — M8: Remove level pro multiclass z historie úrovní

Stav: typecheck, `npm run test` (173 souborů, 3186 testů), validate-data (175/175), `npm run e2e` (477 testů, 5,0 min) zelené. Bez změny schématu (60). D332 zapsáno do DECISIONS.md (na žádost zadání).

## Inventura: záznamy patřící třídě (a) třída ztratí ne-poslední úroveň, (b) třída klesne na 0

| Záznam | Vlastník | (a) | (b) | Test |
|---|---|---|---|---|
| `classes` | className+classSource | level −1, podtřída pryč na své úrovni | položka odstraněna | unit D332 a, e2e a,b |
| `levelOrder` | historie | `slice(0,-1)` | `slice(0,-1)`, zůstává i u 1 třídy | unit, e2e a,e |
| `spellChoices` | třída | beze změny | položka třídy pryč | unit b, e2e c |
| `subclassSpellChoices` | třída + grantedAtLevel | picky té úrovně třídy | celá položka pryč | unit b |
| `classFeatureChoices` | třída + grantedAtLevel | ta úroveň třídy | všechny té třídy | unit a |
| `optionalFeatureChoices.choices` (EI, MV, MM…) | úroveň postavy | `level` = úroveň postavy | totéž (třída na 1 má volby jen z této úrovně) | unit b |
| `optionalFeatureChoices.spellChoices` (Tome) | volba | beze změny | pryč s odebranou volbou | unit b |
| `fightingStyles` | třída | grant úroveň (D318) | položka třídy pryč | unit b |
| `multiclassPicks` | třída | beze změny | položky třídy pryč | unit a, e2e a |
| `wildShapeForms` | třída | beze změny | položka třídy pryč | unit b |
| `toolChoices` / `subclassSkills` / `languages` z rysů | grant úroveň třídy | ta úroveň | totéž (Thieves' Cant 1) | unit a |
| `classSkills` | první třída | beze změny | nedotčeno (první třída nikdy neklesne na 0) | — |
| `expertiseSkills`, `masteries` | úroveň postavy | ta úroveň | ta úroveň | unit a |
| `featAsiChoices` | úroveň postavy | ta úroveň | ta úroveň | stávající |
| `grantedFeats` | background/species/manual | — | — | — |
| `hitPointLevels` | úroveň postavy | ta úroveň | ta úroveň | unit a, e2e b |
| `play.resourceUses` | jméno zdroje | ořez na nové maximum | + smazání zdroje, který zmizel | unit resource D332 |
| `play.spentSpellSlots` | pool | ořez na nová maxima | totéž | e2e b |
| `play.spentHitDice` | `Class\|Source` | ořez | klíč třídy pryč | unit a |
| `play.concentratingOn` | kouzlo | beze změny | null, když kouzlo odešlo s třídou a jiná uložená volba ho nedrží | unit b+c, e2e c |
| `currentHp` | — | D107: klesne o pokles max HP | totéž | stávající |
| `familiar`, `inventory` | bez vlastníka | — | — | — |

## Změny
- `levelRemoval.ts`: brána pustí multiclass s konzistentním `levelOrder`, bez něj `NO_LEVEL_HISTORY_REASON`; `levelRemovalCore` už neodmítá úroveň 1 třídy, odebere třídu a záznamy dle tabulky; `LevelRemovalPlan.removedClass`. Texty „build order step M8/10“ odstraněny.
- `RemoveLevelButton.tsx`: řádek „<Class> will be removed from this character.“ nahoře (`.confirm-dialog__warning`, tučně v index.css); u odebrané třídy „Known and prepared spells of the other classes are kept.“.
- Oprava chyby: potvrzení zavře dialog před uložením. Dřív zůstal otevřený se starým plánem, kdykoli šla odebrat další úroveň (i jednotřídní Fighter 5 vytvořený na 1; dosavadní e2e končily na úrovni, kde už odebrat nešlo).
- `validate.ts` (nález 4): čtení zahodí jen položky `multiclassPicks` nedržené třídy; jiná vada dál zahodí celý seznam.

## Testy
- Unit `levelRemoval.test.tsx`: blok „removing the last level of a class (D332)“ (5 testů), zdroj zmizelé třídy, dialog s řádkem, důvod bez historie; `multiclassEntry.test.ts` nález 4.
- E2E `multiclassLevelRemoval.spec.ts` M8 a–f; `multiclassLevelUp.spec.ts` M7a g upraven (Remove level teď povolen).

## Rozhodnutí přijatá během práce
- Spotřeba zdroje, který po odebrání třídy zmizí, se smaže (jinak by zůstal neviditelný počet); jen při odebrání třídy, jednotřídní chování beze změny.
- Kouzla Pact of the Tome se mažou jen s odebranou třídou; u ne-poslední úrovně zůstávají jako dřív.
- Koncentrace se maže jen podle uložených voleb kouzel; kouzlo, které postava drží jen odvozeně (feat, druh, podtřída jiné třídy), koncentraci nezachrání.
- Nepřiřazený styl boje (bez className, pre-58) se řídí dosavadním pravidlem úrovně grantu.

## Manual browser check for the user
- Sheet → Remove level u multiclass postavy, jejíž poslední úroveň je jediná úroveň třídy: vzhled tučného řádku „<Class> will be removed from this character.“ nad seznamem a zalamování dlouhého seznamu na mobilu.
