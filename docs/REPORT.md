# REPORT — TGS2-4a2: sesílací vlastnost podtřídy u nesesílající třídy, Steel Hawk Wisdom (D371)

HEAD před úkolem: 541b7c6 (stop report předchozího pokusu).

## Co se změnilo
- `scripts/extract-data.js`: `ability: "wis"` u `"Fighter|Steel Hawk"`; `data/classes.json` přegenerováno. Souhrn: `[{"innate":{"3":{"ritual":["animal messenger|xphb"]}},"ability":"wis"}]`, ostatní TGS2 podtřídy beze změny.
- `src/spells/subclassPreparedSpells.ts`: `extractSubclassSpellcastingAbility` / `loadSubclassSpellcastingAbility` — první platný kód vlastnosti z `additionalSpells` podtřídy, jinak null.
- `src/sheet/CharacterSheet.tsx`: `subclassSpellInfo` nese `ability`; nový `subclassSpellcastingEntries` (přes `computeAbilitySpellcasting`) jen pro třídu bez vlastního záznamu v `spellcastingEntries`; předává se do `spellActionRows` a `spellsTabRowCaster`.
- `src/sheet/spellActionRowData.ts`: `casterFor` má volitelný poslední parametr `subclassEntries`; ve větvi vlastníka podtřídy se použije, jen když žádná třída vlastníka nemá vlastní záznam. `spellActionRows` ho předává; `spellsTabData.ts` `spellsTabRowCaster` taky.
- Testy: unit `casterFor — subclass ability (D371)` ve `spellActionRowData.test.ts` (Fighter 3 Steel Hawk WIS → DC 11; bez záznamu dál „No spellcasting ability is known“; Wizard 3 / Fighter 3 Steel Hawk: výběr Wizarda INT DC 15, Animal Messenger WIS DC 11; třída se sesíláním má přednost před vlastností podtřídy). e2e `tgs2Spells.spec.ts` d: `DC 11 CHA`, žádné „unresolved“.
- Docs: D371, DATA.md (Steel Hawk ability), STATUS.md.

## Ověření
- typecheck OK; test 186 souborů / 3390 testů OK; validate-data 177/177 OK; e2e celý suite exit 0 (spec tgs2Spells 4/4).

## Rozhodnutí v kódu
- Podtřídní záznamy nejdou do `spellcastingEntries`, ale do samostatného seznamu jen pro `casterFor` — karta sesílání, `isCaster` a záložní větve podle počtu tříd (`classEntries.length === 1`) se nemění. Fighter Steel Hawk tak nezíská kartu sesílání.
- Vlastnost se čte z prvního záznamu `additionalSpells`, který ji uvádí (všechny dnešní podtřídy ji mají nanejvýš v jednom tvaru).
- Monk (Warrior of Shadow, Way of the Aether) teď také dostává WIS čísla pro řádky svých kouzel; viditelné jen u kouzla s útokem nebo záchranou (neověřoval jsem, zda nějaké takové mají).

## Subagent
Nepoužit.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.

Změněné obrazovky: list postavy → záložka Spells a Actions (Fighter Steel Hawk: Animal Messenger ukazuje DC místo „unresolved“).
