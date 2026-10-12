# REPORT — F-25a: každý zápis postavy se ověří (D353)

HEAD na začátku: fc11ef4 (OK, není starší).

## STEP 1 — inventář (zhuštěně)

| Metoda | Cesta před | Mění | Vstup už očištěn? |
|---|---|---|---|
| create | writeAll | 1 nová | ne (buildCharacter) |
| update | writeAll | 1 podle indexu | ne |
| rename, setFamiliar, setFamiliarHitPoints, setInventory, setText, setPortrait, setCurrency, setLanguages, setToolChoices, setSpellChoices, setWildShapeForms | writeAll | 1 podle indexu | ne (setPortrait má vlastní assertValidPortrait, ostatní nic) |
| writeFeatAsiChoices (setFeatChoiceDetails asi:, setAsiIncreases) | writeAll | 1 podle indexu | částečně (isValidAbilityIncrease) |
| setHitPoints, setResourceUses, setSpentSpellSlots, setSpentHitDice, setConcentration, setHeroicInspiration, writePlay (setConditions, setExhaustion), applyRest, removeManualFeat, writeGrantedFeats (addManualFeat, setFeatChoiceDetails manual/background/species) | writeChanged | 1 | — beze změny |
| setFeatChoiceDetails item: | přes setInventory | 1 | — |
| delete | writeAll | smaže 1, bez validace (zůstává) | — |
| import | writeAll | N nových | vlastní parseStoredCharacters (zůstává) |

UI volající: všechny settery v CharacterManager.tsx jdou přes `withErrorHandling` (try/catch → `setActionError(describeError(error))`), `update` také (řádky 337–346). Průvodce: `CharacterWizard.handleSave` má try/catch → `setSaveError`. Žádný volající nepadá na neošetřenou výjimku → mimo characterStore.ts nebylo třeba měnit nic.
`describeCharacterError` nad charakterem vráceným z list() (už sanitizovaným) nic nezamítá; potvrzeno: celých 3308 unit testů prošlo beze změny.

## Co se změnilo
- characterStore.ts: 13 míst `writeAll(updated)` → `writeChanged(updated, index)` (update, rename, setFamiliar, setFamiliarHitPoints, setInventory, setText, setPortrait, setCurrency, setLanguages, setToolChoices, setSpellChoices, setWildShapeForms, writeFeatAsiChoices); create validuje novou postavu přes writeChanged. `writeAll` se volá jen z writeChanged, delete a import.
- docs/DECISIONS.md: D353 (česky). docs/STATUS.md: řádek F-25a.

## Testy
- Nový blok „every write validates the changed character (D353)“ (characterStore.test.ts, konec souboru), 6 případů přes it.each: setInventory, setText, setLanguages, setSpellChoices, setFamiliar, create. Každý: vyhodí ImportValidationError, surový localStorage řetězec před/po je shodný, list() nevyhodí a vrací obě postavy (pokrývá i „po zamítnutém zápisu list() nepadá“).
- typecheck, test (182 souborů, 3308 testů), validate-data (175/175): OK.
- e2e: 558 passed (6,8 min).

## Chování při chybě, které se změnilo
Settery výše dřív při neplatné hodnotě zapsaly a rozbily list(); nyní vyhodí ImportValidationError „The change could not be saved: …“, který UI zobrazí stávajícím vzorem (actionError / saveError). Texty na úspěšných cestách beze změny.

## Rozhodnutí / otázky
- Rozhodnutí: create validuje přes writeChanged (stejná zpráva „The change could not be saved“), ne vlastní text. Zpráva pro novou postavu tedy říká „change“; změna textu je triviální, pokud ji chceš jinak.
- Čtení tolerující už rozbitou uloženou postavu zůstává F-25b.

## Manual browser check for the user
Nic viditelného — UI nemůže neplatné hodnoty vyrobit, úspěšné cesty se nemění.
