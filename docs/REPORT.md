# REPORT — TGS2-4a: kouzla podtříd Way of the Aether a Steel Hawk (D370)

HEAD před úkolem: 36f8109 (fast-forward z 69f698b, podmínka splněna).

## Co se změnilo
- `scripts/extract-data.js`: tabulka `HOMEBREW_SUBCLASS_SPELLS` vedle `HOMEBREW_SUBCLASS_TABLES`, tvary přesně podle zadání; v cyklu podtříd `loadHomebrew()` se přiřadí, a pokud podtřída už `additionalSpells` má, extrakce hodí chybu.
- `src/calculation/freeCastResources.ts`: `SHARED_OWNERS['Way of the Aether'] = { etherealness: 'Sight Beyond Sight' }`. Ověřeno předem: `originName` podtřídního grantu je `group.subclassName` (SpellList.tsx:223) = „Way of the Aether“; klíč počítadla „Sight Beyond Sight“ (tgs2Pools.spec.ts:85); `daily {"1"}` → `onceFreePerLongRest`, což větev SHARED_OWNERS obsluhuje.
- `src/spells/alsoCastableWithSlot.ts`: `'Way of the Aether': false`, `'Steel Hawk': false` — vynutil to krycí test (každý dosažitelný zdroj volného seslání musí mít verdikt).
- `data/classes.json` přegenerováno (`npm run extract-data`).
- Souhrn `scripts/tgs2-4a-spells.js` (7 podtříd TGS2): Aether a Steel Hawk mají tvary dle tabulky; Spelldrinker `prepared`, Rocborne `known` beze změny; Mercantile, Grim Surgeon, Infernal `null`.
- Testy: unit v `freeCastResources.test.ts` (Aether 6: Gentle Repose a See Invisibility → `{key: 'Focus Point', cost: 2}`, cantripy bez počítadla; Aether 17: Etherealness → `{key: 'Sight Beyond Sight', cost: 1}`). Nový `e2e/tgs2Spells.spec.ts` a–d.
- Docs: D370 (DECISIONS), DATA.md homebrew sekce, STATUS.md.

## Ověření (jednou, na konci)
- typecheck OK; test 186 souborů / 3387 testů OK (po doplnění alsoCastableWithSlot); validate-data 177/177 OK.
- e2e: celý běh 629 testů — selhaly jen tgs2Spells b a c na mém očekávání popisku („2 FP“, „1/LR“); app ukazuje „2 Focus Point“ a „1/long rest (no slot)“. Opraveno, `npm run e2e -- e2e/tgs2Spells.spec.ts` 4/4 OK. Celý suite jsem znovu nespouštěl (ostatní soubory beze změny vůči běhu).
- e2e c navíc ověřuje, že řádek USE Etherealness na Spells obsahuje skupinu „Sight Beyond Sight uses“ (jeden záznam).

## Seedy
- Schema 61, podtřída jen jménem jako v tgs2Pools/tgs2Resistances (zdroj GriffonsSaddlebag2 se dohledá). Monk: classSkills, toolChoices (Smith's Tools), ASI +2 WIS na 4/8/12/16. Fighter 3: classSkills, 3 masteries, Defense. `spellChoices: []`.

## Subagent
Nepoužit.

## Rozhodnutí v kódu
- Way of the Aether a Steel Hawk: nelze seslat i slotem (`alsoCastableWithSlot` false), stejně jako Warrior of Shadow a Path of the Wild Heart. Viditelné jen u multiclassu se sloty — ke kontrole uživatelem.
- Unit test staví vlastní fixture podtřídy (pravidlo 1), skutečná data pokrývá e2e.

## K rozhodnutí uživatele
- STATUS.md řádek „Open (TGS2-4..5)“ u TGS2-3 nechávám; kouzla podtříd jsou teď hotová jen pro Aether a Steel Hawk.
- Nesledované `docs/REPORT-*.md`, `CLAUDE-1.md` a skripty `scripts/tgs2-*.js` z dřívějška necommituji (zadání: stage jen změněné soubory; `git clean` zakázán). `scripts/tgs2-4a-spells.js` zůstává nesledovaný.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.

Změněné obrazovky: list postavy → záložka Spells (Monk Aether: Mage Hand, Spare the Dying, USE řádky Gentle Repose / See Invisibility / Etherealness; Fighter Steel Hawk: Animal Messenger s popiskem Ritual) a Actions (počítadlo Sight Beyond Sight sdílené s Etherealness).
