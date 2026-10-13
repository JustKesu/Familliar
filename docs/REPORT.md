# F-25b — nečitelné uložené postavy (D354)

HEAD na začátku aa33948 (OK). Branch/commit/push: viz konec; pokud tu není poznámka o odmítnutí, proběhly.

## STEP 1 — inventura (zkráceně)
| Místo | Změna |
|---|---|
| `characterStore.ts` `list()` | čte po položkách; vadné vynechá |
| `characterStore.ts` `writeAll` | jediný zápisový trychtýř (~30 setterů, create, import, delete) → připojí surové nečitelné položky; settery beze změny |
| `characterStore.ts` nové | `listUnreadable`, `exportUnreadable`, `deleteUnreadable`, `readStoredEntry` (vytaženo z `parseStoredCharacters`) |
| `CharacterManager.tsx` | stav `unreadable`, 2 handlery, export sdílí `exportFile` |
| `CharacterList.tsx` | props, karty, potvrzení smazání |
| nový `UnreadableCharacterCard.tsx`, `index.css` (jen existující tokeny `--damage`, `--text-*`) | karta |
Reálných změn v kódu ~8 míst, formát úložiště beze změny → STOP nenastal. `import()` nezměněn (přísný, `UnknownSchemaVersionError` zůstává).

## Návrh a identita
- `list()` vrací jen čitelné; `listUnreadable()` → `{key, kind: 'damaged'|'newer', name|null, message}`.
- `key` = FNV-1a hash surové položky + délka + `#n` (pořadí mezi identickými); stabilní přes reload, nezávislá na indexu.
- `newer` = číselná `schemaVersion` > CURRENT (61). Starší nepodporovaná verze (1, 2, 3…) = `damaged` (Delete povoleno).
- Zápis: nečitelné položky se při každém `writeAll` znovu načtou z úložiště a připojí na konec pole (pozice se mění, obsah ne). `deleteUnreadable` filtruje surové pole podle indexu, platné položky nepřepisuje; `newer` odmítne (`CharacterNotFoundError`).
- Surový JSON se před zápisem parsuje/stringifikuje (stejný text pro běžně generovaná data; ne zaručeno pro neobvyklé formátování čísel/mezer).

## Testy
- Unit: nový describe „unreadable saved characters (F-25b, D354)“ (8 testů: 2 platné + damaged + newer; setText/create/delete/import zachovají obě položky; odmítnutý import; delete jen damaged, newer nelze; identické položky; export raw; stabilní klíče).
- Existující testy: ~45 asercí `list()).toThrow(CorruptDataError/UnknownSchemaVersionError)` na jedné vadné položce přepsáno na helper `expectUnreadable(store, kind)` (vadná položka už z `list()` nevyhazuje). Zůstaly beze změny: špatný JSON a ne-pole (stále vyhazují).
- e2e `e2e/unreadableCharacters.spec.ts` a–e (karty+štítky, otevření platné/klik na nečitelnou nic, Export raw, Delete s potvrzením + newer bez Delete, Long Rest + reload zachová obě).
- typecheck OK, `npm run test` 3316/3316, validate-data OK (175/175), `npm run e2e` 563/563 za 7.0 min.

## Rozhodnutí v práci
- D354 přidáno do DECISIONS.md (zadáno). STATUS.md doplněn.
- Tlačítka mají `aria-label` „Export <název>“ / „Delete <název>“ (viditelný text Export/Delete), kvůli rozlišení více karet.
- Starší nepodporovaná verze = damaged (zadání mluví jen o „newer“) — potvrdit.
- Chování `list()` pro vadnou položku se změnilo oproti D353 poznámce („čtení, které toleruje…“ = právě tento task); jiné dokumenty nejsou zastaralé.

## Manual browser check for the user
Na https://familliar.vercel.app, klíč v localStorage: `familliar:characters`. F12 → Console, vložit:
```js
const k='familliar:characters';const a=JSON.parse(localStorage.getItem(k)||'[]');a.push({schemaVersion:61,id:'demo-bad',name:'Demo damaged',classes:'nope'},{schemaVersion:999,id:'demo-new',name:'Demo newer'});localStorage.setItem(k,JSON.stringify(a));location.reload()
```
Zkontrolovat okem: štítek „Damaged“ / „Saved by a newer version“, zalamování delšího textu chyby u Damaged, výška/šířka karty proti normální, tlačítka Export (+ Delete jen u damaged), 1366 a 1920 px, tmavý i světlý režim, šířka telefonu. Chování (klik nic nedělá, export, delete, zachování po zápisu) pokrývají e2e a–e.
Úklid: smazat Damaged kartou (Delete + potvrdit); newer karta Delete nemá → v Console:
```js
const k='familliar:characters';localStorage.setItem(k,JSON.stringify(JSON.parse(localStorage.getItem(k)).filter(e=>e.id!=='demo-new')));location.reload()
```
