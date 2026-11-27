# REPORT — NPC-3: odhad CR pro NPC (D439)

Start z 85f7a52 (`git log --oneline -1`, fetch + ff-only: Already up to date). STOP podmínky (a)/(b) nenastaly: zbraně i cantripy jdou spočítat mimo list skládáním exportovaných volání, tabulka má očekávaný tvar.

## Krok 1 — soupis změn

| Soubor | Funkce / místo | Změna |
|---|---|---|
| scripts/extract-data.js | `extractCrStatistics` (nová), `main` | msbcr.json → data/cr-statistics.json |
| scripts/validate-data.js | `validateMonsters` | guard: 34 řádků, CR = encounter-rules xpByCr v pořadí, čísla |
| data/cr-statistics.json | — | nový výstup |
| src/encounters/npcCr.ts | `estimateCr`, `extractCrStatistics`, `loadCrStatistics`, `loadNpcOffence`, `loadNpcCr`, `crTitle` | nový |
| src/encounters/npcCr.test.ts | — | nový |
| src/calculation/weaponAttacks.ts | `averageOf` | export |
| src/sheet/combinedSpells.ts | `loadCombinedSpellParts` (nová), `loadCombinedSpells` | vrací i spellDetails, subclassInfos, featSpells, raceSpells |
| src/characters/CharacterCard.tsx | prop `badge` | volitelný štítek s title |
| src/dm/NpcList.tsx | `useNpcCrs` (nový), `NpcList` | „≈ CR x“ |
| src/dm/EncounterSetup.tsx | `addNpc` | předvyplnění CR |
| e2e/dmNpcCr.spec.ts | — | nový, a–e |
| e2e/dmNpcCombat.spec.ts | NPC-2 a, c–h | počítá s předvyplněným CR |
| docs/DECISIONS.md, STATUS.md, DATA.md | — | D439, NPC-3, cr-statistics |

## Co se změnilo
- `estimateCr(rows, maxHp, ac, offence)`: řádek = poslední s min ≤ hodnota (pod tabulkou první), posun `trunc(rozdíl/2)` kroků, ořez na 0..33; průměr crNumber obou, nejbližší CR, shoda nahoru.
- `loadNpcOffence`: `computeWeaponAttacks` + `computeAttacksPerAction` se stejnými argumenty jako CharacterSheet (item bonusy, pact, Bracers); cantripy přes `spellActionRows` se stejnými spellcasting entries (třída, feat, species, subclass D371, item spells). Max DPR vyhrává, jeho bonus (útok, u záchranného cantripu DC).
- Karta NPC: `.char-card__badge` (stávající styl `.char-card__sub`, žádné nové CSS). Setup: NPC se přidá s `cr: null`, po načtení odhadu se doplní.

## Ověření
- typecheck OK; npm test 202 souborů / 3711 testů OK; validate-data 195/195 OK; e2e celý běh 878/879 (3.0 min), jediná chyba `dmNpcCombat.spec.ts` c–h čekal po Add NPC prázdné CR (řádek ukazoval „NPC · CR 1/8“ místo třídy). Spec upraven na nové chování (a: předvyplněno 1/8 = 75 XP, pak vymazáno; c–h: počká na 1/8 a vymaže), samostatný běh souboru 4/4 OK. Celý suite po úpravě znovu nespuštěn.
- Unit (`npcCr.test.ts`): tabulka 1/8 = ac 13 hp 7-35 atk 3 dpr 2-3; AC kroky, průměr 1.625 → 2, shoda 0.1875 → 1/4, DC cantrip, necelé DPR, ořez, null. Seed Fighter 5 + Greatsword: DPR 18, +5, HP 39, AC 12 → CR 2 (obrana 1/4, útok 3). Seed Wizard 5 + Fire Bolt: DPR 11, +5, HP 27, AC 12 → CR 1 (1/8, 2).
- e2e `dmNpcCr.spec.ts`: a) karta „≈ CR 1/2“ + title, b) Add NPC předvyplní 1/2, 50 → 150 XP, c) smazání → 50 XP + poznámka, uloženo `cr: null`, d) uložené NPC s prázdným CR zůstane prázdné, e) 390×844 štítek v kartě, žádný prvek se scrollWidth > clientWidth.

## Rozhodnutí v kódu
- Data do samostatného `data/cr-statistics.json` (ne do encounter-rules: jiná kniha).
- Necelé DPR (3.5) padá do nižšího řádku; HP na sdílené hranici (760, 805) do vyššího CR.
- Shoda při zaokrouhlení průměru → vyšší CR.
- Eldritch Blast: průměr × počet paprsků z `beamNote`; u cantripu jen první řádek škody (zásah, ne „secondary creature“); „+ mod“ bez známého modifikátoru = jen kostky.
- Útoky za akci Attack z listu platí pro každou zbraň (Thirsting Blade se tím počítá i mimo pact weapon, jako číslo listu).
- Unarmed Strike je kandidát jako každý zbraňový řádek; Lifedrinker a další kostky mimo průměr se nepočítají.
- Setup předvyplní jen CR, které výběr nabízí (crXpTable z bestiáře nemá 26–29); jinak zůstane prázdné. Odhad nepřepíše CR, které DM mezitím vybral.
- Chyba načtení dat → žádný štítek / žádné předvyplnění.
- Známá mez: když DM nastaví „No CR“ dřív, než odhad dorazí (desítky ms), odhad ho ještě doplní (rozliší se jen vybrané CR, ne prázdné).

## Pro uživatele
- `npm run extract-data` dnes přepíše data/monsters.json (~4200 řádků diff) a legendary-groups.json oproti commitu — nesouvisí s úkolem, vráceno `git checkout`, zapsáno v DATA.md. Příčinu stojí za to prověřit samostatně.
- Subagent nepoužit.
- Nesledované pomocné skripty (scripts/npc3-msbcr.js a starší) necommitnuty.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
Změněné obrazovky: DM → NPCs (karta NPC se štítkem „≈ CR x“), DM → Encounter setup (CR předvyplněné po Add NPC).
