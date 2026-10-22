# REPORT — F-41: cena a váha předmětu v detailu na záložce Inventory (D368)

Setup: HEAD 199cc73 (= origin/main), `npm ci`, `npm run e2e:install` bez chyb.

## Co se změnilo
- `src/inventory/inventoryData.ts`: `ItemRef.weight` (items.json `weight`, libry), čteno v `extractItemRefs` stejně jako `value`. Custom item weight nemá (definice pole nemá).
- `src/inventory/currency.ts`: `formatCopperPrice(copper)` — nenulové části gp/sp/cp ("1 gp 5 sp", "5 cp"); 0 → prázdný řetězec. Unit test v `currency.test.ts`.
- `src/sheet/InventoryTab.tsx`: `costWeightLine(ref)` → "Cost: 10 gp · Weight: 4 lb." v `<p class="inventory-tab__cost-weight">` nad `<Entries>` uvnitř `.inventory-tab__description`. ▸ se ukáže, když má předmět `entries` NEBO cenu NEBO váhu; accessible name zůstává "<label> description". Bez násobení množstvím. Bez nového CSS (odstavec dědí styl popisu).
- `e2e/itemCostWeight.spec.ts` (schema 61): F-41 a Battleaxe ×3 bez popisu → "Cost: 10 gp · Weight: 4 lb."; b Rope → řádek "Cost: 1 gp · Weight: 5 lb." jako první dítě detailu, popis pod ním; c +1 Wand of the War Mage → "Weight: 1 lb.", žádné "Cost:"; d custom valueCopper 150 → "Cost: 1 gp 5 sp".
- Docs: DECISIONS.md D368 (text ze zadání), DATA.md nová sekce "Item cost and weight (F-41)", STATUS.md (F-41 položka + e2e spec).

## Čísla (scripts/investigate-item-weight.js, items.json 947)
- `value` 382, `weight` 447, oboje 209; weight vždy číslo, nikdy 0, 60 zlomkových.
- Nejmenší: Needle|XPHB 0.02, Arrow|XPHB 0.05, Bolt|XPHB 0.075. Největší: Apparatus of Kwalish|XDMG 500, Carriage|XPHB 600, Covered Wagon|FRHoF 1300.
- 63 obyčejných XPHB předmětů má cenu+váhu bez `entries` (Battleaxe, Blowgun, Breastplate) — ty se teď dají rozkliknout. Rope|XPHB má `entries`.
- Komentář u `ItemRef.value` ("364 of the 900 items") je zastaralý (dnes 382/947); nechán beze změny (kód pod ním se neměnil).

## Ověření
- `npm run typecheck` OK; `npm run validate-data` 177/177.
- `npm run test`: 1. běh 3 timeouty/asserce v CharacterWizard.test.tsx (D251, F-1) a CharacterSheet.test.tsx (ability breakdown) — nesouvisí se změnou; obě soubory samostatně 428/428, 2. celý běh 3384/3384.
- `npm run e2e` 622/622, trvá 7.9 min (nad 3 min limitu z CLAUDE.md).

## Rozhodnutí / otázky
- Cena 0 cp (jen custom `valueCopper: 0`) se ukáže jako žádná Cost část (nenulové části = žádné). Pokud má být "0 cp", je to jednořádková změna.
- Subagent nepoužit.

## Manual browser check for the user
Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screen: Inventory tab → rozbalený detail předmětu (řádek Cost/Weight nad popisem; ▸ u předmětů bez popisu s cenou/váhou).
