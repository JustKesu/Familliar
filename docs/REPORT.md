# REPORT — MON-5: sledovaná použití, připomínka recharge, dvě karty, mobilní úpravy boje

Setup: `git fetch` + `merge --ff-only` = „Already up to date“, HEAD a103751.

## Co se změnilo
- A: nový `src/encounters/trackedUses.ts` (`trackedUses(monster, inLair)`, `hasLairUses`, `plainName`). `combat.ts`:
  volitelné `uses`/`lair` (validace jen když jsou), `usedCount`, `setUsed`, `toggleUseBox`, `toggleLair`, `rollRecharge`,
  `rollD6`; `nextTurn` doplní legendární akce členům položky na tahu. Schema zůstává 2, starý boj se načte (nic použito).
- `EncounterRun.tsx`: karta patří členovi (`stats: memberId[]`), sekce „Tracked uses“ nahoře, počty v řádku
  (`.combat__use-counts`), pruh připomínek recharge po Next turn (ROLL d6, výsledek, ×).
- B: `.combat__cards` až dvě karty vedle sebe (nejnovější první, každá Close). Mobil dál jedna přes celou obrazovku.
- C1: spodní lišta = dva řádky (`.combat__bottom-row`); Amount bez labelu, `aria-label`, 70 px border-box; DAMAGE/HEAL flex 1, 44 px.
- C2: příčina prázdného místa — mřížka 5 sloupců, ale bez save štítku jen 4 děti, tlačítko spadlo do `auto` a 44px sloupec
  zůstal prázdný. Mobilní řádek je teď flex, jméno flex 1.
- C3: podtitul „Dire Wolf · CR 1“, zkrácené záchrany na vlastním řádku.
- Docs: D435, STATUS, DATA.md (průzkum tvarů „/Day“, Domain, Adult Green Dragon, restLong u ježibab).

## Ověřeno
- typecheck OK, lint 0 chyb (jen staré varování), unit 199 souborů / 3670 testů OK, validate-data 191/191.
- `src/encounters/trackedUses.test.ts` nad skutečnými daty: Adult Green Dragon (LR 3/4 v doupěti, Poison Breath recharge 5,
  LA 3/4, Geas 1/Day shared), Aboleth (Dominate Mind 2/Day), Animal Lord (bez přepínače), Barlgura (2e/1e řádek na kouzlo),
  Green Hag (restLong, at-will ne), Ankheg (holé `{@recharge}` = 6); doplnění LA na tahu, reset nového boje, recharge
  hod 4/5, starý boj bez polí.
- `e2e/dmTrackedUses.spec.ts`: a) políčka + reload, b) In lair → 4, c) USE dechu, kolo dokola, připomínka, házet do READY,
  d) LA se doplní na tahu draka, e) dvě karty vedle sebe, f) 390×844 lišta, řádky, „Dire Wolf · CR 1“, bez přetečení.
- Celé e2e: 860 passed (3.1 min, těsně nad hranicí ~3 min).

## Rozhodnutí v kódu
- „or M/Day in Domain“ (17 monster) = stejný přepínač „In lair“; přepínač i u monstra jen s `legendaryActionsLair`.
- Klíč „N“ u `daily`/`restLong` = jeden společný řádek „N/Day shared“ se seznamem kouzel; „Ne“ = řádek na kouzlo.
- Seznam `recharge` u kouzlení (12 bloků) se nesleduje — zadání ho nezmiňuje.
- Klik na vyplněné políčko vyprázdní je i všechna další; na prázdné vyplní až po něj.
- SPENT je tlačítko, které ručně vrátí READY („flip“); pruh připomínky má také ROLL d6 a ×; pruh se neukládá (reload ho smaže).
- Počty v řádku jen pro trait/akce/legendární/recharge, ne pro kouzla (řádek by byl dlouhý); recharge jen když je „spent“.
- Zkratka = počáteční písmena slov (LR, LA, PB), jednoslovný název prvních 6 znaků.
- Mobilní SAVE tlačítko si nechává text „Save: none / Save: DEX DC 13“ (ukazuje zvolenou záchranu).
- Karta stat blocku je teď po členech (ne po skupině), protože použití jsou per člen; aria-label „Stat block <jméno>“.

## Otázky
- Žádná nová.

## Změněné obrazovky
- Boj (desktop): řádek s počty použití, pruh připomínek recharge, sekce Tracked uses v kartě, dvě karty vedle sebe.
- Boj (mobil): spodní lišta ve dvou řádcích, řádky přes celou šířku, podtitul s CR, karta se sekcí Tracked uses.

## Subagent use
- Žádný subagent nebyl použit.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
