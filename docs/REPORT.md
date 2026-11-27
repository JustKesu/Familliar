# REPORT — MON-6: hody ze stat blocku monstra (útok, zranění, záchrany, ověření, dovednosti)

Setup: `git fetch` + `merge --ff-only` = „Already up to date“, HEAD bae8f4d.

## Co se změnilo
- `src/dice/roll.ts`: `parseDamageDice` — NdN, dN, NdN ± N (mezery volitelné). Ostatní (× násobek, víc skupin) = null.
- `src/dice/RollUi.tsx`: `RollReportContext` (handler hodů), nastavuje ho jen DmPage.
- `src/markup/Markup.tsx`: `MarkupRollContext` `{prefix, onRoll}`; jen když je nastaven, `{@hit}` → `RollButton`,
  `{@damage}`/`{@dice}` → `DamageRollButton` (třída `roll-value`, text = hodnota). Bez kontextu výstup beze změny.
- `src/monsters/MonsterStatBlock.tsx`: prop `rollName`; s `RollReportContext` obalí každý blok `MarkupRollContext`
  (prefix „<tvor> · <jméno bloku bez tagů>“), sekci Lair prefixem „<tvor> · Lair“; modifikátor vlastnosti, „save +N“ a
  bonus každé dovednosti jsou `RollButton`. Bez kontextu (mimo DM) render jako dřív.
- `src/dm/DmPage.tsx`: historie (paměť, nejnovější první, sdílená Bestiářem a střetnutími), `RollToast`, `RollModeContext`;
  v řádku záložek vpravo `RollModeSwitch` + „Rolls“ (Drawer „Roll history“). Taby v `.dm__tablist` (role tablist zachována).
- `EncounterRun.tsx`: `rollName={info.member.name}` → „Wolf 3 · Bite to hit“, „Alpha · …“.
- CSS: `.dm__tabs` flex-wrap + `.dm__rolls`; ≤ 760 px `.dm .roll-toast` nahoře (top 12 px, z-index 22).
- Docs: D436, STATUS (MON-6), DATA.md (průzkum tvarů roll tagů).

## Ověřeno
- Data (`scripts/mon6-dice.js`, nekomitováno): hit 862; damage „NdN + N“ 857, „NdN“ 691, „NdN - N“ 4; dice „NdN“ 97,
  „dN“ 5, „NdN + N“ 3, „NdN × N“ 1; žádné argumenty s `|`. Dovednosti „+N“ 999, „+N (+N while in snake form)“ 3.
- Nerozparsované, zůstávají textem: `{@dice 1d4 × 10}` (1×). Dovednost se závorkou hází prvním číslem.
- Unit: `roll.test.ts` (tvary výše + odmítnuté), `Markup.test.tsx` (bez kontextu žádné tlačítko, s kontextem 2 tlačítka, × text).
- e2e `e2e/dmRolls.spec.ts`: a) Wolf Bite to hit, 1 kostka; b) damage 1 kostka, „+ 2 =“; c) DEX save, STR check,
  Stealth; d) historie nejnovější první; e) Advantage → damage nemění režim, to hit 2 kostky, zpět Normal; f) „Wolf 3 ·
  Bite to hit“ v boji; g) 390×844: toast ve viewportu, po Back nad spodní lištou, switch a Rolls dostupné; h) popis
  Fireballu na listu má `{@damage}` jako text bez tlačítka.
- typecheck OK, test 199 souborů / 3682 testů OK, validate-data 191/191, e2e 864/864 za 3,8 min (nad 3 min).
  Po přechodu na sdílený `plainName` znovu typecheck, test a `dmRolls.spec.ts` (4/4).

## Rozhodnutí v kódu
- `{@dice}` v pojmenovaném bloku má popisek „<tvor> · <blok>“ (bez „damage“); `{@damage}` v Lair „<tvor> · Lair damage“.
- Ověření vlastnosti: tlačítkem je modifikátor v závorce, závorky zůstávají text. U dovednosti je tlačítkem jen bonus.
- Jméno bloku do popisku přes existující `plainName` z `trackedUses.ts` („Fire Breath {@recharge 5}“ → „Fire Breath“).
- Řádky Skills/Senses/AC a iniciativa mimo bloky hody nedělají (iniciativa záměrně).
- Mobil: switch a Rolls zůstávají v řádku záložek DM, který je vidět i v boji a nad kartou přes celou obrazovku.
- Toast na mobilu v DM nahoře místo nad lištou — lišta i panel save mají proměnnou výšku.

## Subagent
Nepoužit.

## Manual browser check for the user
None - the planning chat checks the looks from screenshots.
Změněné obrazovky: DM řádek záložek (switch + Rolls, desktop i mobil), Bestiář — karta monstra (hodnoty jako tlačítka),
karta v boji (desktop i mobil), toast v DM na mobilu nahoře, drawer Roll history v DM.
