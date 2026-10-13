# Review F-25a + F-25b (fc11ef4..2b24996)

HEAD při review: `2b24996`. Pouze čtení kódu; nic nespuštěno (žádný npm skript).

## Verdikty a–l

| Bod | Verdikt | Poznámka |
|---|---|---|
| a | OK | Všechny zápisy jdou přes `writeAll` (setters přes `writeChanged`, `delete`, `import`) nebo `writePayload` (jen `deleteUnreadable`, z čerstvého čtení). `characters` i `kept` se čtou ze storage ve stejném synchronním volání → nic zastaralého v rámci tabu. |
| b | needs test | Round-trip `JSON.parse`/`stringify` mění jen okraje: `1e400`→`Infinity`→`null`, celá čísla > 2^53 ztratí přesnost, `-0`→`0`, duplicitní klíče → zůstane poslední. `__proto__` přežije (JSON.parse ho vytvoří jako vlastní vlastnost). Aplikace sama takové hodnoty nezapíše; týká se jen ručně upravených dat. |
| c | OK | Po smazání jednoho ze dvou identických se zbylý stane `#0`; protože jsou totožné, je jedno který. Kolize FNV-1a (32 bit + stejná délka) rozliší `#n` podle pořadí; škodlivá jen ve dvou tabech (viz d), prakticky zanedbatelné. |
| d | OK / low | `deleteUnreadable` hledá klíč i index ve stejném čerstvém čtení → nikdy nesmaže jiný index než nalezený. Zastaralý klíč z druhého tabu buď sedí na obsahově totožný záznam, nebo hodí `CharacterNotFoundError`. Settery i `delete` hledají podle id v čerstvém `list()`. Přepis celým zastaralým objektem (`update`) je starší problém, ne F-25. |
| e | OK, needs test | Vše kromě `entryHash`/`storedName`/`toCharacter` je v `try` (`readEntryOrDescribe`, `characterStore.ts:190`); ty tři nehází. Chybějící/nečíselný `schemaVersion` → `describeStoredCharacterError` → damaged; `null`/pole/číslo → „not an object“ → damaged; necelé nebo staré číslo → `UnknownSchemaVersionError` → chyceno → damaged. Testován jen záznam `42`. |
| f | OK | Pořadí kroků na záznam identické se starou cestou (migrace → drop/levelOrder → repair od 59 podle původního `schemaVersion` → validace). Stará cesta neměla žádnou kontrolu napříč záznamy, takže platná postava se načte stejně. Migrace kopírují, nemutují raw (ověřeno namátkou `migrations.ts:591-604`). |
| g | OK | `create` indexuje `[...list(), new]`, `writeAll` píše čitelné první a nečitelné za ně; index sedí. |
| h | OK / low | Import striktní, `UnknownSchemaVersionError` propouští, nečitelné zachová. Změna: chyby se nyní hlásí po záznamech (store+import chyba záznamu 0 před store chybou záznamu 1); dřív se nejdřív store-validovaly všechny. U vícezáznamového souboru může přijít jiná zpráva. |
| i | OK | Oba `JSON.stringify([..], null, 2)`, jméno `<name>.json` / `character.json`, sanitizace sdílená. „Raw“ je obsahově shodný, ne bajtově (formátování, výhrady z b). e2e c to ověřuje. |
| j | problem (low) | Ztráta: testy schématu 1, 2 a v3 (`characterStore.test.ts:105,131,153,730`) dřív rozlišovaly `UnknownSchemaVersionError` od `CorruptDataError`; teď jen `damaged` bez kontroly zprávy. `expectUnreadable` používá `toContain` → neověří, že záznam chybí v `list()`, ani že je jen jeden. Žádný přepsaný test předtím nekontroloval text zprávy. |
| k | OK | V `src/` klíč čte/píše jen `characterStore.ts:83`; `levelRemoval.test.tsx:26` je mock. e2e helpery jen seedují/čtou. |
| l | OK / low | `withErrorHandling` volá `refresh` (načte obojí); při chybě `deleteUnreadable` se ukáže `actionError`, karta zůstane do dalšího refreshe. Confirm dialog ok. Route guard (`CharacterManager.tsx:87-91`): otevřená postava, která po reloadu zčitelnosti vypadne, tiše přesměruje na seznam bez vysvětlení. |

## Další nálezy

- **medium** — `UnreadableCharacterCard.tsx:26`: uživateli se zobrazuje surová technická zpráva (`Entry [3].classes is missing or not an array is malformed.`). Funkčně ok, ale srozumitelnost je rozhodnutí uživatele.
- **low** — `characterStore.ts:562-566`: každý zápis teď parsuje a validuje celý seznam dvakrát (`list()` + `readAll()` ve `writeAll`); u častých zápisů (HP) zdvojená práce. Bez dopadu na data.
- **low** — `characterStore.ts:562-566`: každý zápis přesune nečitelné záznamy na konec pole. Neztrácí se nic; jen pořadí ve storage ≠ původní.
- **low** — `schemaVersion: 1e400` se přečte jako `Infinity` → „newer“ (nesmazatelné); po prvním zápisu se z něj stane `null` → „damaged“. Okrajové, jen ruční data.

## Otázky pro uživatele

1. Zobrazovat na kartě „Damaged“ technickou zprávu? Doporučení: krátký lidský text + technická zpráva jen v exportu/tooltipu.
2. Má route guard při ztrátě čitelnosti otevřené postavy ukázat hlášku („Postava je poškozená, najdeš ji v seznamu“)? Doporučení: ano, jedna věta na seznamu.
3. Má `exportUnreadable` vracet bajtově přesný původní text (vyžaduje uložit podřetězec, ne parsovaný objekt)? Doporučení: ne, obsahová shoda stačí; jen zapsat do DATA.md/DECISIONS výhrady z bodu b.

## Chybějící testy

- Klasifikace: `null`, pole, chybějící `schemaVersion`, `schemaVersion: "61"`, `60.5`, migrace, která hodí → vždy damaged, `list()` nehází.
- Starší nepodporované schéma: assert, že `message` zmiňuje verzi schématu (náhrada za ztracený `UnknownSchemaVersionError`).
- `expectUnreadable` zpřísnit: `list()` záznam neobsahuje a `listUnreadable()` má přesně 1 položku.
- Zachování nečitelných přes `rename`, `update`, `setHitPoints`, `setFamiliar` (testováno jen setText/create/delete/import).
- `deleteUnreadable` po změně storage mezi listováním a smazáním (simulace druhého tabu) → NotFound nebo totožný záznam.
- Import vícezáznamového souboru s chybami ve dvou záznamech → očekávaná zpráva.
- e2e: route guard, když se otevřená postava stane nečitelnou; `actionError` při neúspěšném smazání.
