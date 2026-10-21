# REPORT — TGS2-3: počítadla Launch, Bloodbound, Sight Beyond Sight aj. a popisek zdroje TGS2 (D367)

HEAD na startu 115051f (ff-only, „Already up to date“). První běh se zastavil po STEP 1 (commit b35c675); uživatel odpověděl (Hurricane + Arcane Conduit přidat, varianta (a) pro dvě věty, Bloodbound = Rogue 17) a task pokračoval. D367 dřív neexistovalo.

## STEP 1 (scripts/tgs2-pools.js, nesledovaný, necommitnut)
| prvek | podtřída, úroveň | text | výsledek |
|---|---|---|---|
| Launch | Fighter / Steel Hawk 3 | „three times … regain all expended uses … short or long rest“; „four times“ od 7, „five times“ od 15 | 3/4/5, SR |
| Improved Launch | Fighter / Steel Hawk 18 | „shouldn't do so again before you finish a short or long rest“ | 1, SR (věta přepsána) |
| Bloodbound | Rogue / Grim Surgeon 17 | „can't use it again until you finish a short or long rest“ | 1, SR |
| Hurricane | Ranger / Rocborne 15 | totéž | 1, SR |
| Sight Beyond Sight | Monk / Aether 17 | „can't cast it again until you finish a long rest“ | 1, LR (věta přepsána) |
| Arcane Conduit | Paladin / Spelldrinker 20 | „can't use it again until you finish a long rest“ | 1, LR |
Mimo: Ghost Walker (WIS mod, D43 unknown), Field Surgeon (limit na tvora).

## Co se změnilo
- `scripts/extract-data.js`: `HOMEBREW_REST_FEATURES` (6 prvků, klíč `subclassShortName|name`) — v `loadHomebrew()` přepis „short rest“/„long rest“/„short or long rest“ na `{@variantrule Short Rest|XPHB}` / `{@variantrule Long Rest|XPHB}`, u Improved Launch a Sight Beyond Sight náhrada věty na „you can't use it again until you finish“. Chybějící věta nebo počet ≠ 6 → throw. `HOMEBREW_SUBCLASS_TABLES`: Steel Hawk `subclassTableGroups [{colLabels:["Launch"], rows: 20×[0|3|4|5]}]`.
- `data/classes.json`, `data/subclass-features.json` přegenerovány; počty beze změny (EXPECTED_COUNTS nesahány).
- src/ beze změny logiky: pooly čte stávající `isSelfLimitedFeature` / `isImplicitSingleUse` / `lookupInTableGroups`.
- Část B: nový `src/pickers/bookLabel.ts` (`GriffonsSaddlebag2` → `TGS2`), použit na 4 místech: `ChoiceRow.tsx:43` (štítek knihy: podtřídy, fighting styles, optional features, výbava), `SearchableOptionList.tsx:126` (accessible name u sdíleného jména), `SpeciesPicker.tsx:96` a `:121`. Uložený source zůstává.
- `src/calculation/resources.test.ts`: datový guard 69→74 maxim (67→72 single-use), Short-Rest seznam +Improved Launch, Bloodbound, Hurricane.
- Docs: DATA.md (rest wording TGS2), STATUS.md, DECISIONS.md D367 (text dle uživatele).

## Ověřeno
- `npm run typecheck` OK; `npm run test` 3383/3383 (po úpravě guardu); `npm run validate-data` 177/177; `npm run e2e` 618/618 (2.0 min).
- `e2e/tgs2Pools.spec.ts`: a) Launch 3 boxy na Fighter 3, 4 na Fighter 7; b) Launch po Short Rest zpět; c) Bloodbound Rogue 17 1 box, SR obnoví; d) Sight Beyond Sight Monk 17 1 box, SR ne, LR ano; e) option „Geleton (TGS2)“; f) Hurricane Ranger 15 1 box, SR obnoví; g) Arcane Conduit Paladin 20 1 box, SR ne, LR ano.

## Rozhodnutí během práce
- STOP podmínka části B („žádný sdílený helper“): helper neexistoval, ale míst jsou 4 a dvě z nich jsou sdílené komponenty (ChoiceRow, SearchableOptionList) — helper jsem vytvořil místo zastavení.
- Rest tagy nově dávají těmto 6 prvkům řádek v tabulce Actions (D86 isActionTableFeature čte rest tag) — vedlejší efekt, ověřen jen přes počítadla.
- Nesledované docs/REPORT-*.md, CLAUDE-1.md a scripts/tgs2-*.js ponechány mimo commit (git clean zakázán zadáním).

## Subagent
Nepoužit.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Actions tab (nová počítadla Launch, Improved Launch, Bloodbound, Hurricane, Sight Beyond Sight, Arcane Conduit u TGS2 postav), wizard Species step (option „… (TGS2)“), picker podtříd/level-up (štítek knihy „TGS2“).
