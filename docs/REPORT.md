# LH-2 — pole pro množství u poolů nad 10 (D427)

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD 815a41c — OK.

## STEP 1 — místa změn

| # | Soubor | Místo |
|---|---|---|
| 1 | src/sheet/CharacterSheet.tsx | `UseBoxes`: stav `amountText`, větev max > 10 = [−] [input] [+] spent / max; `onChange` typ `number` |
| 2 | src/sheet/CharacterSheet.tsx | `FeatureUses` a 4× props `onSpendResource` (`delta: number`) |
| 3 | src/sheet/CharacterSheet.tsx | 4 volání slotů (Spells tab ordinary/pact, Manage Spells ordinary/pact): `delta > 0 ? 1 : -1` |
| 4 | src/index.css | `.sheet__use-counter .sheet__use-amount` + skrytí spinnerů |
| 5 | src/sheet/CharacterSheet.test.tsx | nový test `LH-2 (D427)` vedle R5c |
| 6 | e2e/poolAmountLH2.spec.ts | nový, a–g |
| 7 | docs/DECISIONS.md (D427), docs/STATUS.md, docs/REPORT.md | |

## Co se změnilo

- Input `type="number"`, `min=1`, `max=pool max`, `step=1`, aria-label `<name> amount`, `disabled` bez `onChange`. Množství: neprázdné, celé a ≥ 1, jinak 1. „+“ volá `onChange(amount)`, „−“ `onChange(-amount)`; ořez dělá stávající `spendResource`. Aria-labely a disabled pravidla tlačítek beze změny. Pořadí: −, pole, +, „spent / max“, recharge.
- CSS: šířka 3.5em, `border-radius: 6px` (z globálního `button`), výška přes `align-self: stretch` v inline-flex counteru (= výška tlačítek), text na střed, spinnery skryté (`-webkit-*-spin-button`, `appearance: textfield`). `white-space: nowrap` na counteru zůstává.
- Sorcery Points XPHB z dat (skript): úroveň = počet od 2, Sorcerer 12 → 12. Scénář g používá Sorcerer 12.

## Ověření

- typecheck OK; test 194 souborů / 3607 testů OK.
- lint: 1 error `src/sheet/spellsTabData.ts:229` rules-of-hooks (pre-existing, soubor nedotčen), jinak warningy.
- e2e: nový soubor 7/7. Celé e2e 827 passed, 1 failed (8,3 min): `subclassSpellcastingPrereq.spec.ts:103` SC-1 a (timeout 60 s na zakázaném Next v průvodci) — stejné selhání jako v minulém reportu; samostatně 4/4 passed. Stávající layOnHands, poolGrantorTracker, proficiencyBonusUses prošly beze změny.
- validate-data nespuštěno (data nedotčena).
- Scénáře: a) `LH-2 a`, b) `LH-2 b`, c) `LH-2 c`, d) `LH-2 d`, e) `LH-2 e`, f) `LH-2 f`, g) `LH-2 g`.

## Rozhodnutí v kódu

- Hodnota > max se do pole nepřepisuje; při utracení ji ořízne `spendResource`.
- Pořadí v řádku podle zadání: [−] [pole] [+] spent / max (dříve bylo „spent / max“ mezi tlačítky).
- Stav pole je per instance `UseBoxes`: Actions a Features & Traits mají každý své pole.
- Investigační skript `scripts/investigate-lh2-sorcery-points.js` necommitnut; `git clean` se podle zadání nespouští, zůstává netrackovaný v pracovním stromu.

## Subagent

Nepoužit.

## Otázky pro uživatele

- SC-1 a (`subclassSpellcastingPrereq.spec.ts:103`) padá v plném běhu opakovaně na timeout; možná zvýšit timeout nebo počkat na povolení Next.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Actions tab (řádky poolů nad 10: Lay on Hands, Font of Magic / Sorcery Points, Focus Points…), Features & Traits tab (tytéž countery).
