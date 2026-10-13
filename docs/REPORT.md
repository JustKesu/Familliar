# F-26 — opravy z review F-25a/F-25b (D355)

HEAD na začátku 323f389 (OK). Commit a push proběhly, pokud zde není poznámka o odmítnutí.

## Změny
- `UnreadableCharacterCard.tsx`: karta Damaged ukazuje „This character could not be read. Export it to keep a copy.“; technická zpráva v `title` téže věty a ve skrytém `<span hidden>` přes `aria-describedby` (`useId`). Karta newer beze změny.
- `characterStore.ts`: `UnreadableCharacter.id` = uložené `id`, pokud je neprázdný string, jinak `null` (`storedId`).
- `CharacterManager.tsx`: route guard (sheet/edit/level-up) při id patřícím nečitelné položce nastaví `redirectNotice` „<name ?? 'This character'> could not be opened - see its card below.“; seznam ho zobrazí v existujícím `p.error` řádku jako `actionError ?? redirectNotice`. Mazání při New/Open. Neznámé id dál potichu.
- DECISIONS D355 (CZ), STATUS F-26.

## Testy
Unit (`characterStore.test.ts`, blok F-25b):
- klasifikace `null`, pole, chybějící / stringový (`"61"`) / necelý (`60.5`) `schemaVersion` → damaged, `list()` nehází;
- migrace, která hodí (`vi.doMock('./migrations')` + dynamický import, po testu `doUnmock`/`resetModules`) → damaged se zprávou výjimky;
- schéma 1 a 2: `message` === zpráva `UnknownSchemaVersionError(n)` (náhrada ztracené kontroly);
- `expectUnreadable` zpřísněn: přesný počet + druhy v `listUnreadable()` (default 1) a žádné id nečitelné položky v `list()`; všech ~60 volání prošlo bez úprav;
- přežití nečitelných přes `rename`, `update`, `setHitPoints`, `setFamiliar` (bajtově);
- `deleteUnreadable` po změně storage v „druhém tabu“: předřazená jiná damaged položka → smaže se totožná; už odstraněná → `CharacterNotFoundError`, storage beze změny;
- import souboru s chybou v záznamech [1] a [2] → `That file could not be imported: …[1]…`, [2] se nehlásí (hlásí se první vadný záznam), storage beze změny;
- `id` nečitelné položky (`'bad'`, `'future'`; `null` pro ne-objekt a prázdné id).

e2e `unreadableCharacters.spec.ts`: f (věta + `title` + accessible description obsahují technickou zprávu), g (sheet → přepis položky přes `page.evaluate` → reload → seznam, hláška „Good One could not be opened - see its card below.“, karta Damaged), h (položka odstraněna „druhým tabem“ → Delete → `p.error` „No character with id…“, karta zůstane) — h šlo vyvolat v e2e, render test nebyl potřeba.

## Ověření
typecheck OK; test 182 souborů / 3328 testů OK; validate-data 175/175 OK; e2e 566 passed (6.9 min, nad limitem ~3 min z CLAUDE.md).

## Rozhodnutí během práce
- Hláška přesměrování jde do existujícího řádku `p.error` (stejný styl jako actionError), ne do nového prvku; přednost má skutečná `actionError`.
- `UnreadableCharacter` dostal pole `id` (potřebné pro shodu route guardu); prázdné id = `null`.
- DATA.md nezměněn: výhrady round-tripu JSON se týkají localStorage, ne dat 5etools; zapsány jen do D355 dle zadání.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots. Změněné obrazovky: seznam postav (text na kartě Damaged; řádek hlášky nad kartami po přesměrování z nečitelné postavy).
