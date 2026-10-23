# C-1: Investment of the Chain Master na familiaru (D380)

Setup: fetch + `merge --ff-only` = již aktuální, HEAD 8211028.

## Průzkum dat (scripts/c1-chain-master-markup.js, zapsáno do DATA.md)
- 32 forem familiara: B/P/S (5/22/6) jen v `{@atkr}` akcích, vždy „<Typ> damage“ s velkým písmenem; žádné v trait/bonus/reaction ani v riderech.
- Save DC jen jako `{@actSave x} {@dc N}` (3: Pseudodragon con 12, Sprite cha 10, Quasit wis 10). Jediný další `{@dc}` je CHECK (Raven Mimicry, Insight) → nahrazuje se jen DC hned za `{@actSave}`.
- Přepis je spolehlivý; pro e2e vybrán Pseudodragon XMM (Piercing bite + DC 12 sting).

## Co se změnilo
- Schéma 62 → 63: `CharacterFamiliar.chainMasterForm` ('aerial'|'aquatic'), `.chainMasterDamage` ('necrotic'|'radiant'); migrace jen tag, validace hodnot v validate.ts.
- `characterStore.setFamiliarChainMaster(id, { form?, damage? })` (null = smazat); `setFamiliar`, `setFamiliarHitPoints` a reset po Long Rest obě pole drží.
- Nový `src/sheet/chainMaster.ts`: `holdsChainMaster` (přes `heldInvocations`, tj. volby + custom předmět), `chainMasterSaveDc` (Warlock → nejvyšší zdroj → null), `applyChainMaster` (kopie Beast: fly/swim 40, pokud už není ≥ 40; B/P/S → zvolený typ; save DC → DC postavy).
- Pořadí kopií: nejdřív Chain Master (slova a rychlost z dat), pak `applyFamiliarBonuses` (čísla AC/hit/damage/walk). Nezávislé, item bonusy platí dál.
- `extraRows({ chainMaster })`; `ExtrasTab` prop `chainMaster` (jen při držené invokaci) → karta pod řádkem familiara: skupina „Familiar form“ (Aerial/Aquatic), výzva při nevybrané formě, skupina „Familiar damage type“ (Original/Necrotic/Radiant), řádky Quick Attack a Resistance. CharacterSheet → `onEditFamiliarChainMaster` z CharacterManager.
- Docs: D380, DATA.md, STATUS.md. e2e `levelOrder.spec.ts`, `stableIds.spec.ts` na 63.

## Ověření
- typecheck OK; test 3424/3424 (nové: chainMaster.test.ts, store test, migrace 62→63); validate-data 177/177; e2e 662/662 (2.4 min).
- `e2e/chainMasterC1.spec.ts`: 1 Aquatic → swim 40 ft + reload; 2 Radiant v útoku + reload, Original vrátí Piercing; 3 DC familiara = Warlock DC 14 (data 12); 4a invokace jen z předmětu → přepínače + Quick Attack; 4b bez invokace a s uloženými hodnotami → nic, rychlost/typ/DC z dat (hodnoty spí); 5 předmět familiarArmourClass +1 zvedne AC i s aktivní invokací (a Radiant zůstane).

## Rozhodnutí v kódu
- Volby Chain Master zůstanou familiarovi i při výměně formy (setFamiliar) a po Long Rest; mění se jen HP (D213). Pokud má nová forma začít bez volby, je to změna jednoho řádku.
- Jen DC hned za `{@actSave}` je „save DC“; Raven Mimicry (check) zůstává 10.
- Rychlost s objektem (poznámka hover) se přepíše na `amount: 40` a poznámka zůstane.
- Texty Quick Attack/Resistance jsou parafráze, ne citace.
- Podagent nebyl použit.

## Změněné obrazovky
- Extras tab: řádek familiara má pod sebou kartu Investment of the Chain Master (dvě skupiny pilulek, výzva, dva textové řádky).
- Stat block familiara (drawer z Extras): speed, typ zranění v útocích, save DC.

## Manual browser check for the user
Žádný — vzhled ověří planning chat ze screenshotů.
