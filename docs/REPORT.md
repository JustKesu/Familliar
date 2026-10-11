# F-18: řazení nezávislé na locale

**Repo:** `git fetch` + `merge --ff-only` OK, HEAD byl 5cdd5d8.

## Co se změnilo
- Nový `src/text/compareText.ts`: `compareText(a, b)` nad modulovým `new Intl.Collator('en')`.
- Nahrazeno `.localeCompare(` na **44 řádcích** ve **33 souborech** (z toho 2 testovací: `wizardState.test.ts`, `featSpells.test.ts`). Řetězce `||` zachovány beze změny. `.sort((a, b) => a.localeCompare(b))` zkráceno na `.sort(compareText)`.
- Přeskočená místa: žádná. Všechna volání byla prosté porovnání stringů. Dvě zmínky ve komentářích (`sheet/Conditions.tsx`, `sheet/CustomItemGrantList.tsx`) popisují záměrné code-unit řazení, zůstaly beze změny a stráž je nechytá (hledá `.localeCompare(`).

## Volba collatoru
Žádné volání nepředávalo `locale` ani options, takže `Intl.Collator('en')` bez options (ne `sensitivity: 'base'`, ne `numeric`). Pořadí se mění jen tam, kde záleželo na locale systému (Ch/H a podobně); na anglickém systému je výsledek stejný jako dřív. Žádný D-záznam, DECISIONS.md nedotčen.

## Ověřeno
- `npm run typecheck`, `npm run test` (180 souborů, 3268 testů), `npm run validate-data` (175/175), `npm run e2e` (528 passed, 2.4 min): vše prošlo.
- Unit `src/text/compareText.test.ts`: Chill Touch, Hex, Hunter's Mark; navíc ověřeno, že `Intl.Collator('cs')` dává jiné pořadí, takže helper na locale procesu nezávisí. Stráž: test prochází `src/` (mimo helper a jeho test) a při nálezu `.localeCompare(` vypíše soubor a odkáže na `compareText`.
- e2e `e2e/sortOrder.spec.ts` (`locale: 'cs-CZ'`, schema 60): Bard 3 v Manage Spells > Add Spells, „Charm Person" je před „Healing Word". Pozn.: původní návrh Chill Touch/Hex nešel, Hex je 1. úroveň Warlocka a Chill Touch cantrip, nejsou v jednom seznamu vedle sebe.

## K rozhodnutí
Nic.

## Manual browser check for the user
Nic vizuálního se nezměnilo, jen pořadí položek v seznamech. Volitelně na https://familliar.vercel.app: Manage Spells u Barda, Add Spells, „Charm Person" před „Healing Word" (jistotu dává e2e scénář).
