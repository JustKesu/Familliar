# REPORT F-38: stabilizace dvou flaky unit testů v CharacterSheet.test.tsx

Setup: HEAD = 8c4ade2 (ff-only bez změny). Změněn jen `src/sheet/CharacterSheet.test.tsx`, žádný jiný soubor v `src/`.

## Reprodukce (STEP 1)
3× plný `npm test` před změnou: 185/185 souborů, 3373/3373 testů pass (110,5 s / 107,5 s / 106,6 s). **Nereprodukováno.** F-29 REPORT zaznamenal jen „2 selhání (toast po timeoutu; Pact of the Chain)“ bez assertion/chybové hlášky, takže přesná chyba není známa.

## a) „hides itself after the timeout“ (l. 671)
Příčina — **odvozeno z kódu, nereprodukováno**:
- `renderKnown()` čeká jen na nadpis `Aria`; roll tlačítko existuje až po vyřešení modifikátoru (viz test „offers no roll where the modifier is unresolved“), tj. až po dalších loadech. `getByRole` se volal až po přepnutí na fake timers.
- `vi.useFakeTimers()` bez parametrů fakuje i `setImmediate`, `setInterval`, `Date`, `performance` — tedy i to, na čem běží dobíhající loady a React scheduler pro updaty mimo `act`. Pod zátěží loady doběhnou až po přepnutí a jejich práce visí na fake hodinách / vyřeší se uprostřed advance.
- `RollToast` (`src/dice/RollUi.tsx`) je mimo podmíněné větve sheetu, nepřemontovává se; timer `ROLL_TOAST_MS = 6000` vzniká v `useEffect` po kliku. Tato část je deterministická.

Fix: po `renderKnown()` `await screen.findByRole('button', { name: 'Roll Athletics check' })`, pak `await act(() => new Promise(r => setTimeout(r, 0)))` (doběhnutí čekajících loadů na reálných timerech), teprve pak `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` — fakuje se jen to, co používá toast. Kontrola 5900 ms viditelný / 6100 ms pryč beze změny, `useRealTimers()` v `finally` zůstává, 30 s timeout testu zůstává.

## b) „shows "Pact of the Chain" in the Notes of a familiar taken from the invocation“ (nyní l. 7870)
Příčina — **odvozeno z kódu, nereprodukováno**: `waitFor` na extras řádky s výchozím 1 s timeoutem hned po renderu celého sheetu; řádky čekají na několik loadů po nadpisu, při zátěži plné sady může 1 s nestačit.
Fix: `waitFor(..., { timeout: 5000 })`, test timeout 30000, jednořádkový komentář. Assertions beze změny.

## Ověření (STEP 3)
- `npm run typecheck`: pass.
- `npm test` 3× po sobě: vše 185/185, 3373/3373 pass (102,2 s / 104,8 s / 104,9 s).
- `npm run e2e`: 600/600 pass, **7,0 min** (nad limitem ~3 min z CLAUDE.md; netýká se této změny).

## Stejný vzor jinde (neměněno)
`await waitFor(...)` s výchozím timeoutem hned po `findByRole('heading', ...)` plného renderu sheetu — 30 dalších míst (řádek `waitFor` v aktuálním souboru):
1495, 1630, 1800, 1957, 2446, 2622, 2928, 3032, 3169, 3541, 4356, 4814, 5784, 5909, 6371, 6523, 6558, 7748, 7773, 7804, 7819, 7985, 8061, 8130, 8213, 8241, 8254, 8469, 8484, 8548.
(7748/7804/7819/7985 čekají na extras řádky stejně jako test b.) Celkem je v souboru 134 `await waitFor(`; ostatní jsem nekontroloval.

## Rozhodnutí / otázky
- Rozhodnutí: zúžení `toFake` na `setTimeout`/`clearTimeout` místo navrhovaného `shouldAdvanceTime` — `shouldAdvanceTime` posouvá fake hodiny reálným časem, takže pod zátěží by mezi klikem a advance mohl uplynout reálný čas a rozbít hranici 5900/6100 ms.
- Otázka pro uživatele: plošně zvýšit výchozí `asyncUtilTimeout` (RTL `configure`) místo lokálních timeoutů? Dotklo by se všech 30 míst výše.

## Subagent
Nepoužit.

Pozn.: v pracovním stromu je nesledovaný `scripts/investigate-multi-dice-spells.js` z dřívější session; necommitován, `git clean` nespuštěn (dle zadání).

Manual browser check for the user: none - test-only change, no screens changed.
