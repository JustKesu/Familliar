# REPORT — MON-3: uložená střetnutí, obrazovka přípravy, opravy bestiáře

## Co se změnilo
- `src/encounters/encounterStore.ts` (nový): klíč `familliar:encounters`, `{schemaVersion: 1, encounters}`; validace po
  záznamech, vadné se přeskočí a při zápisu zachovají; nečitelný klíč → `read().error`, zápisy hází `EncounterStorageError`,
  `clearAll()`. `familliar:characters` nedotčen.
- `src/encounters/encounterDifficulty.ts` (načtení `encounter-rules.json`, prahy × party, štítek, součet `xp`),
  `encounterEdit.ts` (počet, výchozí jména, přidat-nebo-zvýšit).
- `src/navigation/route.ts`: `DmRoute` s `encounter?: 'new' | {id}`; `#/dm/encounter/new`, `#/dm/encounter/<id>`.
- `src/dm/DmPage.tsx` (bere celou route), `EncounterList.tsx`, `EncounterSetup.tsx` (nové), `src/App.tsx` (prop).
- `src/dm/Bestiary.tsx`: `useLoaded`, `BestiaryBrowser` s `onPick` (řádek + „+ Add“, bez karty), „1 monster“.
- `src/monsters/MonsterStatBlock.tsx`: jméno bloku v jednom `<p>` s prvním odstavcem; CSS 6px mezi bloky (jen `.monster-card`).
- `src/index.css`: styly střetnutí, mobilní mřížka filtrů 2 sloupce. `BeastStatBlock` (Wild Shape, familiár) beze změny.
- Změněné obrazovky: DM › Encounters (seznam), nová obrazovka přípravy, Bestiary (počet, karta monstra, mobilní filtry).
- Docs: D433, STATUS.md, DATA.md (průzkum bloků a XP čísel).

## Ověření
- typecheck OK; `npm test` 197 souborů / 3645 testů OK (nové `src/encounters/encounters.test.ts`, rozšířený
  `route.test.ts`); validate-data 191/191; lint jen varování stejného typu jako existující.
- e2e celé: 856 passed, 9,4 min (nad limitem ~3 min). `e2e/dmEncounters.spec.ts`: a–c vytvoření Wolves (Wolf ×6 + Dire
  Wolf „Alpha“, 4 hráči úr. 2 → 500 XP, Low, prahy 400/600/800), reload, úprava na ×5 (450 XP), potvrzení Back, smazání;
  d poškozený klíč + vadný záznam + „Unknown monster“; e „Amphibious.“ v jednom odstavci, mezera ≤ 8px, „1 monster“;
  f 390×844 bez přetečení (dokument i vnitřní prvky v `main`), filtry CR vedle sebe, krokovací tlačítka ≥ 44px.
  `e2e/dmBestiary.spec.ts` upraven na „No encounters yet.“.
- Čísla ověřena skriptem nad daty: Wolf 50 XP, Dire Wolf 200 XP, úroveň 2 = 100/150/200 na postavu.

## Rozhodnutí v kódu
- Štítek obtížnosti podle dosaženého prahu (500 při 400/600/800 = Low); rozpočet jako strop by dal „Moderate“ — potvrdit.
- Party se uloží jen při vyplněném počtu i úrovni (1–20), jinak null.
- Nečitelný klíč: zápisy odmítnuty, únik jen tlačítkem „Clear encounter data“ (ConfirmDialog); novější schéma totéž.
- Save uloží a vrátí na seznam; prázdné jméno → „Untitled encounter“.
- Checkbox „One initiative roll“ se zobrazí jen při počtu > 1; přechod 1 → víc ho zapne, návrat na 1 vypne.
- Přečíslování při změně počtu jen u jmen, která jsou stále výchozí; max. 99 v skupině.
- Hráči: prázdné a duplicitní jméno se nepřidá; Enter v poli přidá.
- Picker v přípravě neotevírá stat block; řádek je div s tlačítkem „+ Add“ (`aria-label "Add <jméno>"`).
- Lišta obtížnosti: stupnice do 125 % High, značky prahů; bez party se ukáže jen „N XP“.
- Monstrum se páruje podle name+source; neznámé = 0 XP, zůstává upravitelné.

## Subagent use
Žádný.

## Pro uživatele
- Neověřené historické skripty v `scripts/` (investigate-lh2…, investigate-mon2-shapes*, probe-mon1.js) nejsou součástí
  commitu a neodstranil jsem je (git clean zakázán zadáním); `scripts/probe-mon3.js` je můj vyšetřovací skript, také
  necommitnutý.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
