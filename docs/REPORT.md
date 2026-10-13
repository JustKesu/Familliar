# REPORT – F-27: flaky unit testy

Změny pouze v testech, kód v `src/` mimo testy nedotčen. HEAD před úkolem: bef3d75.

## Příčiny
a) `dataCoverage.test.tsx` "renders every entry structure…": jeden test renderuje všechny entries z `data/` (JSON.parse všech souborů + >1000 renderToStaticMarkup). Samostatně 1,06–1,18 s (soubor 1,45–1,8 s), tj. flake se v izolaci nereprodukoval. Při plné sadě (paralelní workery, `tests 171 s` součet) se protahuje přes výchozí 5 s timeout. Žádný `testTimeout` v repu není. Příčina = timeout, ne logika.
b) `CharacterSheet.test.tsx:671` "hides itself after the timeout": `vi.useFakeTimers()` se zapíná až po `await renderKnown()`. Toastový `setTimeout` se registruje až při `fireEvent.click` (uvnitř `act`), tedy už pod fake timers – pořadí je deterministické a 5900/6100 ms logika je správná. Izolovaně test běží 0,38–0,57 s. Zbývá jediný nedeterministický kus: reálný render celého sheetu + `findByRole` (reálné timery) se počítají do 5s timeoutu testu; při zatížení plné sady (soubor sám trvá ~93 s) to timeout přesáhne. Příčina je v testu (timeout, ne časování fake timerů). Flake jsem NEREPRODUKOVAL (ani 1× v plném souboru ani v plné sadě), závěr je odvozen z kódu, ne z pozorovaného selhání.

## Oprava (2 místa, 2 soubory)
- `src/markup/dataCoverage.test.tsx`: 3. argument `it()` = 30000 + jednořádkový komentář.
- `src/sheet/CharacterSheet.test.tsx` (test na ř. 671): totéž. Význam testu beze změny (viditelný při 5900 ms, pryč po 6100 ms), fake timers dál po renderu, `finally` vrací real timers. Fake timers před renderem jsem nezvolil: `findByRole`/`waitFor` v RTL s vitest fake timers visí.

## Ověření
- dataCoverage 5× po sobě: vše pass, 1,45–1,61 s.
- Toast test (`-t "hides itself after the timeout"`) 5× po sobě: vše pass, 4,38–5,75 s (z toho tests 377–567 ms; zbytek transform/import).
- typecheck: OK. `npm test`: 182 souborů / 3328 testů pass, 99 s. validate-data: 175/175. e2e: 566 pass, 6,7 min.

## K rozhodnutí
- Fix je ochranný (timeout), ne důkaz odstranění flake; pokud se toast test objeví znovu, příčina je jinde (pak fake timers před renderem + `act`/`waitFor` bez RTL async utilit).
- STATUS.md flaky testy nezmiňuje, nezměněn. Žádné nezodpovězené otázky.

Manual browser check for the user: none - test-only change, no screens changed.
