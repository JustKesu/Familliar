# REPORT — MON-2: DM oblast, bestiář a stat block monstra

## Co se změnilo
- Nové: `src/monsters/monsterData.ts` (loader monsters.json + legendary-groups.json přes `loadDataFile`, typy, `monsterProficiencyBonus`, `monsterInitiative`, `monsterSave`, `monsterTypes`, `findLegendaryGroup`), `bestiaryFilter.ts`, `monsterFormat.ts`, `MonsterStatBlock.tsx`, `src/dm/DmPage.tsx`, `src/dm/Bestiary.tsx`.
- `route.ts`: `{ view: 'dm', tab: 'encounters' | 'bestiary' }` ↔ `#/dm`, `#/dm/bestiary`. `App.tsx` vykreslí `DmPage` místo CharacterManager. `AppHeader.tsx`: tlačítko „DM“ (`tabs__button tabs__theme`) → `#/dm/bestiary`.
- `BeastStatBlock.tsx`: jen `export` u `SIZE_LABELS`, `ABILITY_COLUMNS`, `formatModifier`, `titleCase`, `formatSize` (chování beze změny; +5 lint warningů only-export-components).
- `index.css`: sekce „DM area (MON-2, D432)“. `CharacterManager.test.tsx`: harness vylučuje route `dm` (typová nutnost).
- Docs: D432 (DECISIONS), STATUS, DATA.md „Monster stat-block field shapes (MON-2 survey)“. MARKUP-INVENTORY beze změny (žádné nové tagy; recharge/atk/hom/actSave* renderer už zná).

## Ověření
- `npm run typecheck` OK, `npm test` 3630/3630, `npm run lint` 0 chyb, `npm run validate-data` 191/191.
- `npm run e2e` 852/852 (10.5 min — nad limitem ~3 min). První běh: 3 mobilní testy listu (mobileRowsM2 a, mobileSheetM1 a, g) — scrollWidth 398 > 390 kvůli DM tlačítku v hlavičce listu; opraveno skrytím (viz níže), druhý běh zelený.
- Nové testy: `src/monsters/monsterData.test.ts` (loader, PB/initiative/save — Adult Green Dragon +11, Lich +17 a save INT +12, filtry, formáty), `src/dm/Bestiary.test.tsx` (chybová karta při 404 a ne-poli), `route.test.ts` (+2 round-trip, +3 neplatné).
- `e2e/dmBestiary.spec.ts`: a–d (DM tlačítko, „wolf“ → Wolf + Dire Wolf, karta Wolf AC 12 / HP 11 / Bite, CR filtr 5–10 = 175), e (Adult Green Dragon: Legendary Resistance, Legendary Action Uses 3 (4 in Lair), Lair/Regional Effects, Initiative +11, zvýrazněné save +6/+7), f (390×844: karta místo seznamu, zpět, bez přetečení).

## Rozhodnutí v kódu
- Soubory: `src/monsters/*` (data, filtr, formát, karta), `src/dm/*` (stránka, bestiář). Vybrané monstrum jen ve stavu komponenty, ne v URL.
- Hledání: podřetězec v názvu. CR od/do: selecty hodnot přítomných v datech, včetně hranic. Type: základní typ; Empyrean (`choose`) spadá pod celestial i fiend. Environment: hodnoty dat jak jsou („planar, abyss“ = jedna položka); monstra bez environment jen při „All“. Book: kód → celý název knihy.
- Řazení `compareText` (F-18 guard), sekundárně podle zdroje.
- Prázdné stavy: „No monsters match these filters.“, „Select a monster to see its stat block.“, „Loading bestiary…“; chyba = `role="alert"` karta s textem chyby.
- Stat block: CR řádek „15 (XP 13,000, or 15,000 in lair; PB +5)“ (PB přidán navíc). `initiative.advantageMode` → „+X (advantage)“. Zarovnání z kódů (L/N/C/G/E/U/A). Rychlost: `{number, condition}` → „30 ft. (hover)“, `canHover` se nezobrazuje, `alternate` jako další položky.
- Kouzlení: header + neskryté seznamy („At will:“, „N/day (each):“, „N/long rest:“, `{@recharge N}:`, „Costs N:“), připojeno na konec sekce dle `displayAs`. Legendary sekce se ukáže jen s legendary akcemi.
- Damage/condition seznamy: řetězce s velkými písmeny, `{special}` text, podmíněné skupiny „Charmed (with Mind Blank)“, vše přes Markup. Názvy bloků přes Markup (rendruje `{@recharge 5}`).
- Mobil: skóre vlastností 3×2, řádek seznamu `1fr 40px 96px`. Tlačítko DM skryto na telefonu při otevřeném listu postavy (`#root:has(.sheet-view)`), aby se list nezměnil; na seznamu postav je.

## K rozhodnutí uživatele
- Na telefonu z listu postavy není přímý vstup do DM (jen přes FAMILLIAR → DM). Jinak by bylo třeba upravit hlavičku listu (zalamování/menší tlačítka).
- Data: jen Murgaxor (SCC) má `lairActions`; XMM skupiny nesou jen Regional Effects, takže sekce Lair u XMM draků ukazuje jen ty.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.

Nové obrazovky: `#/dm` (Encounters, jeden řádek), `#/dm/bestiary` desktop (filtry + seznam vlevo, karta vpravo), `#/dm/bestiary` telefon (seznam; po kliknutí karta s „← Back to list“), tlačítko DM v hlavičce.

## Subagent use
Žádný.

Untracked helper skripty ponechány mimo commit: `scripts/investigate-mon2-shapes{,2,3}.js`, `scripts/probe-mon1.js`, `scripts/investigate-lh2-sorcery-points.js`.
