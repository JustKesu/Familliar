# REPORT — F-22: opravy z review F-17 až F-21 (D347–D350)

## Co se změnilo
Inventura: 9 souborů src, ~14 míst (pod limitem, bez dělení na F-22a/b).
1. **Remove level kaskáda (D347).** `levelRemovalCore` po mazání podle stampu volá `cascadePrerequisiteLoss` (optionSwap.ts) nad skupinami snižované třídy (`classOptionalFeatureGroupsFor` na staré úrovni): odebere volby, které před odebráním prerekvizity splňovaly a po něm (nižší úroveň třídy, zbylé volby, případně podtřída/třída pryč) ne; opakuje do ustálení. Řádek „`EI option: X (prerequisite no longer met)`“ + jejich Tome kouzla. Kontext nese jen `classLevels`; kouzlové prerekvizity se díky porovnání před/po neprojeví (volba neplatná už předtím zůstává).
2. **Pact of the Chain (D348).** `familiarAfterOptionChange`: když Chain zmizí z voleb (save v `saveCharacter`, Remove level), smaže se `familiar` v jakékoli formě, pokud Chain nedává custom item. Keep vrací Chain → familiar zůstává. Remove level vypíše „Familiar: <jméno>“.
3. **Multiclass Edit Kensei (D349).** `wizardKenseiSlots(data, level, heldClasses)` — krok Proficiencies ukáže a vyžaduje sloty neaktivního Monka; `unfinishedHeldClasses(…, kenseiRangedWeapons)` přidá „choose N more Kensei weapons“.
4. **D350** jen záznam, bez kódu.
5. **Kensei po druzích.** `pairKenseiPicks` (párování slot→pick podle druhu, sdílí picker i kontrola); `kenseiSlotsFilled(slots, picks, isRanged | null)` — null (items.json se načítá) = neúplné. Wizard načte ranged jména (`kenseiRangedWeapons` v podmínkách). Picker při změně zahodí picky zobrazených úrovní, které se nespárovaly. `heldKenseiWeapons` ořezává na počet slotů úrovně (v pořadí uložení).
6. **Styl Fightera.** `swappableFightingStyle` (jen styl s className Fighter); `HeldPicks.swappableFightingStyle` řídí picker, `overwrittenHeldPicks` i `withClassStepSwap`.
7. **`undoSwap`** porovnává `optionName` bez ohledu na velikost písmen jako `swapOut`.
8. **Fokus** po změně kroku bez `preventScroll`; pravidla F-21 beze změny.

## Ověřeno
- typecheck OK; test 182 souborů / 3300 OK; validate-data 175/175 OK; e2e plná sada — viz poslední řádek.
- Unit: levelRemoval.test.tsx „D347/D348 …“ (obě pořadí kliknutí, Eldritch Smite po Pact of the Blade, neplatná už předtím, familiar); optionSwap.test.ts „F-22 item 7“, „D348 …“, „F-22 item 6“; kensei.test.ts „F-22 item 3“ ×2; heldClassPicks.test.ts „D349 …“ ×2; levelUp.test.tsx (untagged styl).
- E2E: levelUpSwap „F-22 1a“, „1b“, „2a“, „2b“, „2c“, „6“, „7“; kenseiSamurai „F-22 2 (D349)“, „F-22 3“; wizardFocus „F-22 8“.
- Plná e2e sada: 556 passed (6.6 min, nad limitem ~3 min).

## Rozhodnuto během práce / otázky
- D348: zvolena varianta „familiar smazat vždy“ (úložiště nezná, zda Find Familiar má jiný zdroj; „žádný familiar“ je vždy platný). Zapsáno v D348.
- D349: Kensei neaktivního Monka blokuje už krok Proficiencies (jako nástroje/subclass skills přes heldClasses), takže Review s řádkem „Monk has unfinished choices: … Kensei weapons“ je v praxi nedosažitelné (step bar nepustí za neúplný krok). Řádek je naprogramován dle zadání; potvrdit, zda stačí blokace kroku.
- Kouzla Pact of the Tome odebraného podle stampu (ne kaskádou) dál zůstávají, pokud třída nezmizí (D332 komentář); kaskádou odebraná volba je bere s sebou (D347). Nesoulad — otázka pro Daniela, zda sjednotit.
- Nález 6: save level upu dál označí převzatý neoznačený styl jako Fighterův (D318/D334), takže při DALŠÍM level upu už výměnu nabídne. Bod 7 e2e: `optionName` jiné velikosti písmen app neuloží, proto jen unit test; e2e testuje Keep u Tome normálně.
- Seed „F-22 3“ (dvě melee na Monk 3) vzniká jen importem ručně upraveného souboru (validátor ho přijme).

## Manual browser check for the user
- Postava Warlock 5 po výměně za Thirsting Blade → sheet, tlačítko „Remove level 5“: okno potvrzení — řádek „EI option: Thirsting Blade (prerequisite no longer met)“ se zalomí/vejde stejně jako ostatní řádky.
- Multiclass Monk (Kensei) / Fighter → Edit → aktivní Fighter → krok Proficiencies: Kensei selecty Monka (Monk 3 ranged, Monk 6) vedle Fighterových voleb — rozložení a popisky. (Review řádek pro Kensei viz výše, v praxi nedosažitelný.)
- Nový charakter na úzkém okně: Next z dolní části kroku Species → nadpis Background viditelný nahoře, posun nepůsobí trhaně.
