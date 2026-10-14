# REPORT — F-28

HEAD na startu 0126802 (OK). Commit/push: viz konec (pokud selhal, je to zde nahoře níže doplněno).

## Část A — anglické popisky záložky Notes (D356)
- `src/sheet/CharacterSheet.tsx` `TEXT_SECTIONS`: Appearance / Backstory / Notes (jen label; pole a data beze změny, bez schématu).
- Testy: `CharacterSheet.test.tsx` (describe + 2 `it` názvy/očekávání, summary selektory, ~17 `getByRole('textbox')`), `CharacterManager.test.tsx` (5 míst), `e2e/restsAndUi.spec.ts` (2×2 řádky), `e2e/levelOrder.spec.ts` (2 řádky). Komentáře: `src/index.css`, `src/storage/character.ts`.
- Docs: SPEC.md 194–196 (výslovně zadáno), DECISIONS.md nový D356, STATUS.md (popis současného stavu u záložek; historické slice poznámky nechány), DATA.md (nález z části B).
- Počet reálných míst v kódu/testech cca 35 řádků, ale 1 mechanická záměna labelu; limit „~15 míst s reálnou změnou“ jsem vyložil jako netriviální změny (jen kolize selektorů, viz níže).
- Kolize selektorů: `getByRole('textbox', { name: 'Notes' })` je substring/case-insensitive → v unit testech `name: /^Notes$/` (testing-library role query nemá `exact`; první pokus s `exact: true` typecheck odmítl). V e2e `getByText('Notes', { exact: true })` kolidoval se záložkou Notes → `page.locator('summary', { hasText: /^Notes$/ })` + `getByRole('textbox', { name: 'Notes', exact: true })`. Summary selektory v unit testech (`selector: 'summary'`) jsou už unikátní.
- Grep Vzhled/Příběh/Poznámky v src/ a e2e/: nic nezbylo. Zbývá jen historický text v docs (STATUS, DECISIONS D123) — záměrně.

## Část B — STOP, reálná cesta neexistuje
- Hledáno (`scripts/f28-choose-options.mjs` nad data/optional-features.json, 120 položek): volby s uloženými spell picks mají `additionalSpells` s `choose`. Jsou 3: Pact of the Tome XPHB (EI), Blessed Warrior TCE (FS:P), Druidic Warrior TCE (FS:R). Všechny `prerequisite` = null.
- `cascadePrerequisiteLoss` (optionSwap.ts:138) odebírá jen picky z `invalidChosen`, tj. s nesplněným prerequisite. Volba bez prerequisite nemůže padnout kaskádou, jen vlastním level stampem (D351; ten pokrývá už existující test D352 v levelRemoval.test.tsx:906). Literální granty invokací (Armor of Shadows apod.) se neukládají jako spellChoices, takže koncentrace přes ně ani kandidáti v levelRemoval.ts:291–294 neplatí.
- Poznámka: fixture v levelRemoval.test.tsx pro Tome má prerequisite `{level: warlock(1)}`, který reálná data nemají; netýká se tohoto tasku. Test nepřidán, kód nezměněn. Nález zapsán do DATA.md.

## Ověření
- typecheck OK (po opravě `exact`), npm test 182 souborů / 3328 testů OK, validate-data 175/175, e2e 566 passed (7.2 min).

## Rozhodnutí / otázky
- Rozhodnutí: výklad limitu „15 míst“ (výše).
- Pro tebe: pokud chceš test D352 přesto pro cestu „kaskáda“, musel by vzniknout seed, který data nevyrobí (zakázáno zadáním).

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Changed screens: sheet → Notes tab (three section headers now Appearance / Backstory / Notes).
