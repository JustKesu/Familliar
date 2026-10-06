# REPORT — M3: společné sloty kouzel multiclass sesilatele (D322)

## Co se změnilo
- `src/calculation/spellSlots.ts`: nová `characterSpellSlotMaxima(character, classData): Calculated<{ ordinary, pact, casterLevel, ordinaryBreakdown }>`. Spellcasting třída = záznam s nenulovým ordinary řádkem (EK/AT řádky 1–2 jsou nuly, takže se počítají od 3 bez jmen). 2+ takové třídy → caster level (full ×1, artificer ⌈/2⌉, 1/3 ⌊/3⌋, jiné ⌊/2⌋) a řádek Wizard XPHB; jinak `spellSlotMaxima` beze změny. Pact beze změny. `computeSpellSlots` a `spellSlotMaxima` nezměněny (jen komentáře).
- Čtenáři přepojeni: `CharacterSheet.tsx` (`slotMaxima` → sekce Spells tabu, boxy, upcast řádky, CAST, Manage Spells summary + boxy; drawer Spell Slots ukazuje při kombinaci jednu sekci „Multiclass Spellcaster (caster level N)“ s rozpadem po třídách místo tabulek jednotlivých tříd), `levelRemoval.ts` (clamp spent slotů).
- Long Rest (`afterLongRest`) maže `spentSpellSlots` celé, maxima nečte → beze změny.
- `CharacterWizard.tsx` volá `computeSpellSlots` jen pro jednu třídu (tvorba), nesahal jsem.

## STEP 1 nálezy
- casterProgression: "full" (Bard, Cleric, Druid, Sorcerer, Wizard), "artificer" (Artificer EFA, Paladin, Ranger), "pact" (Warlock), "1/3" jen na podtřídách EK/AT (`casterProgression`, `subclassTableGroups[].rowsSpellProgression`). Žádná jiná hodnota → STOP podmínka nenastala.
- Wizard XPHB: 20 řádků × 9 čísel; ř.1 `2 0…`, ř.5 `4 3 2 0…`, ř.20 `4 3 3 3 3 2 2 1 1`.
- Inventura: všichni čtenáři maxim šli přes `spellSlotMaxima` (sheet, levelRemoval); `spellLevelFilter.ts`/`ManageSpellsPanel` čtou per-class `ordinarySlots` pro limity úrovní kouzel = M5, nechány.

## Ověřeno
- `npm run typecheck` OK, `npm test` 3079/3079, `npm run validate-data` 174/174, `npm run e2e` 434/434 (4.8 min — nad limitem ~3 min).
- Unit `spellSlots.test.ts` › characterSpellSlotMaxima: W3/C3 = 4/3/3; Pal5/Fig1 = 4/2; Wiz1/Pal1 = CL2 → 3; EK3/Wiz1 = CL2; Fig2/Wiz1 = 2; Wlk6/Sor3 = 4/2 + pact 2; Rgr3/Dru2 = CL4; single class = `spellSlotMaxima`.
- E2E `multiclassSlots.spec.ts`: M3 a (W3/C3: sekce 1st/2nd/3rd se 4/3/3 boxy, žádná 4th; utracený 3rd slot se vrátí po Long Rest), M3 b (Wlk6/Sor3: 1st 4, 2nd 2, pact 3rd 2 boxy bez ordinary skupiny).
- Žádný existující test neměnil očekávání (žádný netestoval staré multiclass maximum).

## Rozhodnuto / obejito při práci
- „Má Spellcasting“ určeno daty (nenulový řádek vlastní tabulky), ne jmény.
- Chybí-li Wizard XPHB řádek, funkce vrací `unknown`; sheet pak ukáže nulová ordinary maxima (s reálnými daty nenastane).
- E2E M3 a seeduje `maxHpOverride: 40`: max HP pro multiclass s různými kostkami je `unknown` („build order step 10“) a Long Rest je pak zablokovaný. To je otevřená mezera kroku 10 mimo tento task.
- Nechané pro M5: `spellLimitReason` (u multiclass stále „Cannot tell…“), `highestCastableLevel`/`unavailableAboveLevel`, `filterSpellsByLevel` per class, Hit/DC, volba poolu u CAST, upcast do pact.

## Manual browser check for the user
- Spells tab u multiclass sesilatele (např. Wizard 3 / Cleric 3): nově se objeví sekce „3rd Level“ se 3 boxy a „2nd Level“ má 3 boxy — zkontrolovat zalomení/rozložení hlaviček sekcí.
- Drawer Spell Slots (tlačítko „Spell Slots“ ve Spells tabu) u téže postavy: nová sekce „Multiclass Spellcaster (caster level 6)“ — vzhled řádku „1st 4 · 2nd 3 · 3rd 3“ a rozpadu.
