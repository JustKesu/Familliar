# F-CB1: opravy z review R-CB (D384)

Setup: `git fetch` + `merge --ff-only` = již aktuální, HEAD 21d2665. Bez subagentů.

## Co se změnilo
- `wizardState.ts` `setBackgroundChoice`: při změně `custom.skills` se z `expertiseSkills` odstraní jen skill, který byl odškrtnut (původní custom skills minus nové). Ostatní Expertise zůstávají. Pool (`expertiseSourceSkills`) žije ve wizardu, reducer ho nezná; picker custom nenabízí skill, který už dává třída/druh, takže odškrtnutý skill nemůže být profi z jiného zdroje.
- Trim jména: v sestavení `CharacterBackground` při uložení (`name.trim()`), ne v reduceru (trim při psaní by znemožnil mezeru mezi slovy).
- Max HP klíč: `CharacterWizard.tsx` (`maxHpKey`) a deps `HitPointsPicker.tsx` pro `source === 'custom'` místo jména dávají `''`.
- `e2e/currentHpFollowsMaxH1.spec.ts`: smazán `settle()` (500 ms). H-1 c čeká `expect.poll(storedCurrentHp)`, H-1 d běží bez čekání (předtím už čekal na `20/40`).
- CSS `index.css`: `minmax(min(100%, 240px), 1fr)` + `min-width: 0; overflow-wrap: anywhere` na položkách `.background-picker__custom .class-skill-picker__list` a `.tool-proficiency-picker__list`.
- Docs: STATUS.md, DECISIONS.md D384.

## Ověřeno
- `npm run typecheck` OK; `npm run test` 3439/3439; `npm run validate-data` 177/177.
- `npm run e2e` (679): jediný pád byl můj pokus o `hpPair` v H-1 c (tvar `0/31` na sheetu nesedí); odstraněn. Poté znovu jen `currentHpFollowsMaxH1` + `customBackgroundCB1`: 13/13. Celá sada se po této opravě nespustila znovu (zbytek v prvním běhu prošel).
- Nové scénáře v `customBackgroundCB1.spec.ts`:
  - e: Rogue (Scholar převeden seedem jako v expertiseE1: schema aktuální, jen třída/classSkills/expertise) s Expertise History+Perception; Edit → odškrtnout History, zaškrtnout Arcana → krok Expertise nenabízí History, Perception zůstává, Next disabled; po výběru Arcany enabled; po uložení History není expertise ani proficient, Arcana expertise.
  - f: jméno `"  Temple Scholar  "` se uloží jako `Temple Scholar` (kontrola localStorage + sheet).
- Slabina: H-1 c/d "zůstává beze změny" nelze web-first dokázat zcela; c čeká na pozitivní signál (max 31 v draweru), pak poll na uložené HP 0. Poll prochází hned, takže pozdní zápis by nezachytil.

## Rozhodnutí v kódu
- Smaže se jen odškrtnutý skill (ne celé Expertise) — D384a.
- Trim při uložení, ne při psaní — D384b.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Wizard/Edit → krok Background → Custom background (mřížka skills a nástrojů); krok Expertise v Edit.
