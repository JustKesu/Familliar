# REPORT — F-10: opravy z review M5–M7

Stav: typecheck, `npm run test` (173 souborů, 3179 testů), validate-data (175/175), `npm run e2e` (471 testů, 5,1 min) zelené. Commit a push viz konec chatu. Bez změny schématu (60). Nález 4 se nedotkl (M8).

## Nálezy

| # | Co se změnilo | Test |
|---|---|---|
| 1 | `subclassToolGrantsForAll` (classToolChoices.ts): smyčka subclass nástrojů v `computeProficiencies` a sloty na kartě Proficiencies běží přes každou třídu se subclassem; startovní blok zůstal jen u první třídy. Manage Feats held tools to dostanou ze seznamu nástrojů (zdroj `Battle Master` ≠ subclass první třídy). | unit `proficiencies.test.ts` (Wizard 5 / Fighter 3 BM, uložený i chybějící nástroj); e2e `reviewFixes` a, a2 |
| 2 | `combineSpellEntries` dělí řádek podle držící třídy (`holderOf`/`sameHolder`, `rowKey …\|grant`); dva subclass vlastníci různých tříd = dva řádky, každý s DC své třídy. `casterFor` fallback bez „build order step 10“. | unit `classSpellLimits.test.ts` (D331 dva vlastníci); e2e b |
| 3 | Pick třídy A + vždy připravená kopie třídy B (subclass i class record) = dva řádky; kopie B není `chosen`, takže se nepočítá do limitu A. Poznámka „Already prepared by <Class>“ v `ClassSpellsManager` (prop `preparedByOther`, `heldPreparedSpells.ts`), sheet i wizard (wizard načítá držené třídy přes `loadHeldClassPrepared`). | unit `classSpellLimits.test.ts` (Wizard+Cleric, Druid, stejná třída = 1 řádek), `heldPreparedSpells.test.ts`; e2e c, d |
| 5 | `LevelUpButton`: `Promise.allSettled`, selhaná/nevyřešená třída = vypnutý řádek s důvodem v `title` (`ClassFailure`), „+ New class…“ dostupné, tlačítko vždy „Level up to <úroveň+1>“. | unit `levelUp.test.tsx` (jedna třída rejectuje; všechny rejectují) |
| 6 | `toolsFromFeats` + `MulticlassPickSlots.heldTools` ve wizardu obsahuje nástroje z featů (`computeProficiencies` nad `draftFeatInstances`). | unit `proficiencies.test.ts` (Musician, Chef) |
| 7 | `optionOwners.ts`: majitel volby = `className` uloženého stylu, jinak třída/subclass, jejíž progression nabízí featureType. Použito pro origin na Actions a pro skupinu nepřipojené volby na Features (`optionClassName`). `featSource` čte „From <Class> n“ z `levelOrder`. | unit `optionOwners.test.ts`, `featuresTabData.test.ts`; e2e e, e2e |
| 8 | Mezery: třída bez subclass nástroje (a), dva vlastníci a pick+grant (b, c), maneuvers + invocations (g), CAST na `unavailable` (f). Vstup do martial třídy s držený masteries (`CharacterWizard.tsx:648, :681`) a LevelUpButton s failem pokryto jen unit testem pro LevelUpButton; masteries při vstupu nepokryty novým testem. | e2e f, g |

## Rozhodnutí
- D331 zapsáno do DECISIONS.md (uživatel o editaci požádal).
- Notice „Already prepared by“ se zobrazuje i u již vybraného řádku, pokud ji jiná třída má vždy připravenou.
- Řádek původně seedu (e) s Fiend Patronem by měl Fireball dvakrát (pick Sorcerer + Fiend Patron 5); e2e f proto používá postavu bez patrona.
- Majitel nepřipojené volby u více tříd: když nejde určit, zůstává první skupina a bez štítku (jako dřív).

## Pozor / k rozhodnutí
- Vstup do martial třídy s držený masteries (část nálezu 8) nemá nový test; neměnil se kód té cesty.
- SPEC/QUESTIONS nedotčeny. STATUS.md aktualizován (včetně řádku kroku 10).

## Manual browser check for the user
Na https://familliar.vercel.app (chování pokrývají scénáře výše, tohle je jen vzhled):
- Karta Spells, sekce „1st Level“, postava Cleric 3 Light / Warlock 3 Fiend: dva řádky Burning Hands pod sebou, čitelně rozlišené podtitulkem (Light Domain / Fiend Patron) a DC.
- Karta Spells u Wizard 3 / Cleric 3 s výběrem Burning Hands: dva řádky, štítky „Wizard“ a „Light Domain“.
- Manage Spells → sekce Wizard → Add Spells: poznámka „Already prepared by Cleric“ vedle názvu kouzla se nelepí na označení Concentration/Ritual a nezalamuje nepříjemně.
- Wizard, krok Spells při level upu druhé třídy: stejná poznámka u řádku, vzhled jako v Manage Spells.
- Karta Features & Traits u multiclass postavy: štítek třídy/subclassu u zvolených invocations, maneuvers a stylů a „From <Class> n“ u featu z ASI; zalamování dlouhých štítků.
- Level up okno (tlačítko Level up) při selhání načtení třídy: vypnutý řádek třídy vypadá čitelně vypnutý, důvod je jen v tooltipu (title) — nelze ověřit automaticky bez simulace sítě v prohlížeči, kontroluje se jen unit test.
