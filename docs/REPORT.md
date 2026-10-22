# REPORT — TGS2-4a2: ZASTAVENO, DC Animal Messenger se po změně dat nevyřeší

HEAD před úkolem: 0617a5a. Commit obsahuje jen tento report; kód, data i e2e jsou vrácené do stavu 0617a5a.

## Co jsem udělal
- `ability: "wis"` doplněno do `"Fighter|Steel Hawk"` v `HOMEBREW_SUBCLASS_SPELLS`, `npm run extract-data`, souhrn potvrdil `[{"innate":{"3":{"ritual":["animal messenger|xphb"]}},"ability":"wis"}]`.
- e2e d rozšířeno o `DC 11 CHA` (WIS 12 → +1, PB +2). Výsledek: selhalo, buňka HIT/DC dál ukazuje
  `unresolved — No spellcasting ability is known for "Animal Messenger" — nothing grants this character a spell attack bonus or save DC.`
- Podle zadání STOP: změnu extraktoru a e2e jsem vrátil, `data/classes.json` obnoven z gitu (`git checkout`). D370 nedoplněno.

## Proč se to nevyřeší
- `src/spells/subclassPreparedSpells.ts` pole `ability` z `additionalSpells` podtřídy vůbec nečte (Grep: žádný výskyt); `AlwaysPreparedSpell` vlastnost nenese.
- `casterFor` (`src/sheet/spellActionRowData.ts:122-129`, D192/D325): grant podtřídy sesílá s vlastností třídy, která podtřídu vlastní, tj. ze `classEntries`. Fighter bez Eldritch Knight žádný záznam sesílání nemá → spadne na „unresolved“.
- U Way of the Aether se problém neprojeví jen proto, že žádné z jejích kouzel nemá útok ani záchranný hod. Stejně by dopadla každá podtřída nesesílající třídy s kouzlem se záchranou.

## Možnosti (rozhodnutí uživatele)
1. Číst `additionalSpells[].ability` podtřídy (subclassPreparedSpells → SheetSpellEntry) a v `casterFor` ho použít, když vlastnící třída nemá sesílání. Mění sheet kód; obecné pro všechny podtřídy, data už tvar mají (Warrior of Shadow `ability: "wis"`).
2. Totéž, ale jen pro podtřídy z ruční tabulky TGS2 (užší, ale zvláštní případ v kódu).
3. Nechat „unresolved“ (stav po TGS2-4a).

## Ověření
- Spuštěno jen `npm run extract-data`, souhrnný skript a `npm run e2e -- e2e/tgs2Spells.spec.ts` (3 OK, d selhalo dle výše). Typecheck/test/validate-data/celé e2e nespuštěny — po vrácení je strom shodný s 0617a5a, kde prošly.

## Subagent
Nepoužit.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.

Změněné obrazovky: žádné.
