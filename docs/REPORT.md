# REPORT — M4: maximum HP multiclass postavy z historie úrovní (D323)

Pozn.: lokální `main` byl na začátku za `origin/main` (chyběly F-8, M2, M3, schéma 57 místo 59). Proveden `git merge --ff-only origin/main` (bez konfliktů, moje změny se s nimi nepřekrývaly), pak práce na schématu 59. `npm ci` / `e2e:install` nespouštěny — lokální stroj, závislosti a Chromium už byly.

## Co se změnilo
- `src/calculation/maxHitPoints.ts`: nové `hitDiePerLevel(character, classData): Calculated<LevelHitDie[]>` ({ level, className, classSource, faces } pro úrovně 1..N). 1 třída = ta pro všechny úrovně; 2+ = `levelOrder` ověřené `isConsistentLevelOrder`; jinak unknown „Cannot tell which class each level came from (no level history). Set a manual maximum.“
- `computeMaxHitPoints` jede přes `hitDiePerLevel`: L1 = max kostky první třídy, další = uložená hodnota / průměr kostky té úrovně, D43 poznámka proti kostce té úrovně. Multiclass řádky: `level 1 (Warlock d8 maximum)`, `level 7 (Sorcerer d6 average)`, `level 8 (Sorcerer roll)`. Single-class text beze změny. Override, CON × level, bonusová tabulka a item bonusy beze změny.
- `src/hitPoints/HitPointsPicker.tsx`: odmítnutí multiclassu pryč; kostka po řádcích, „Use the average…“ po kostkách, buňka Level „Level N · Class“ jen u 2+ tříd (nový volitelný prop `className` v `HitPointLevelRow`). Level-up walk (`levelUpLevel`) nemá řádek Level 1. Unknown mapování = text důvodu místo tabulky. Deps načítání klíčované na všechny třídy, ne jen `classes[0]`.
- Sheet bez ručních změn: multiclass s `levelOrder` má známé max → Long Rest povolen (ověřeno e2e M4 a).
- Docs: D323 (DECISIONS), STATUS (M4 záznam, e2e seznam, krok 10).

## Ověřeno
- `npm run typecheck` OK; `npm test` 167 souborů / 3086 testů OK; `npm run validate-data` 174/174; `npm run e2e` 437 passed za 1.5 min (ne 5).
- Unit `maxHitPoints.test.ts` „more than one class (M4, D323)“: Warlock 6 → Sorcerer 3 (= 63, přesné řádky), interleaved d6 na L2, roll 7 na Sorcerer L8 s D43 poznámkou, bez historie přesný unknown, override vyhrává, Draconic Resilience +3 (jen Sorcerer úrovně). Starý test „waits for build order step 10“ odstraněn.
- Unit `HitPointsPicker.test.tsx`: level-up bez „Level 1“ (upravený 8d5 test), creation s ním (beze změny), „M4: multiclass draft…“ (Level N · Class, d6/d8, average-all 4/5), „M4: … without a level history“ (důvod, žádná tabulka).
- E2E `multiclassHitPoints.spec.ts`: M4 a (max 54 = 8+5×5+3×4+9×1 při CON 13, drawer obsahuje „Warlock d8 maximum“ a „Sorcerer d6 average“, Long Rest enabled), M4 b (bez levelOrder: karta „/ —“, důvod v drawer Hit Points, Long Rest disabled), M4 c (Fighter 1→2: řádek Level 2, žádný Level 1). `wizardW6.spec.ts`: W-6 a nově ověřuje read-only Level 1 při creation Fighter 3; W-6 e (level-up 3→4) teď čeká 0 řádků Level 1.

## Rozhodnutí / odchylky
- Text důvodu se v hlavičce nezobrazuje — karta HP ukazuje jen „— / —“; důvod je v drawer „Hit points details“ (UnresolvedValue), tam ho M4 b ověřuje. Neměnil jsem kartu.
- `hitDiePerLevel` je v maxHitPoints.ts (ne nový soubor); vrací breakdown hit dice poolu (nevyužitý).
- `e2e/multiclassSlots.spec.ts` ponechán s `maxHpOverride: 40` (komentář „not computed yet“ je teď zastaralý; nechal jsem dle zadání).

## Otevřené pro M7
- Brána wizardu `hitDieKey` (CharacterWizard.tsx / wizardState.ts) a průběžné max HP draftu jsou dál jednotřídní; M7 je musí přepnout na třídu, která se právě zvyšuje (a draft `levelOrder` musí nést novou úroveň, aby `hitDiePerLevel` znal její kostku).
- Level-up multiclass postavy je dál blokovaný (M0), takže per-class řádky v level-up walku zatím nejdou proklikat.

## Manual browser check for the user
- https://familliar.vercel.app — import Warlock 6 / Sorcerer 3 s `levelOrder`: sheet → „Hit points details“ drawer: řádky breakdownu s názvy tříd se nezalamují ošklivě.
- Wizard → Hit points krok u multiclass draftu zatím nejde otevřít (M0), takže „Level N · Class“ v buňce Level posoudit nelze; u single-class Fighter level-upu zkontrolovat, že tabulka jen s jedním řádkem (bez Level 1) nevypadá prázdně/rozbitě.
