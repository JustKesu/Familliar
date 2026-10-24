# REPORT — TGS2-4b: Channel Divinity u Spelldrinkera jako dva řádky poolu (D386)

Setup: `git fetch` + `git merge --ff-only origin/main` → „Already up to date“, HEAD `edf8a3c`.

## Co se změnilo
- `scripts/extract-data.js`: nová tabulka `HOMEBREW_SPLIT_OPTIONS` (`"Spelldrinker|Channel Divinity"` →
  Absorb Magic, Expeditious Command, consumes „Channel Divinity“). V `loadHomebrew()` se blok `entries`
  každé volby stane samostatným záznamem subclassFeature (pole rodiče + `consumes: {"name":"Channel Divinity"}`,
  vlastní `entries`) a v rodiči ho nahradí `refSubclassFeature` v 7dílném homebrew tvaru
  `Absorb Magic|Paladin|PHB|Spelldrinker|GriffonsSaddlebag2|3|GriffonsSaddlebag2`. Rodič si nechá úvodní větu.
  Guard: chybějící blok volby → throw; počet rozdělených ≠ součet tabulky → throw (stejně jako rest guard).
  Log: `options split: 2`; homebrew features 46 → 48.
- Tvar zkopírován z Oath of Conquest|XGE (summary skript): Channel Divinity `header:1`, entries = str + 2× ref;
  volby `header:1`, `consumes:{name:"Channel Divinity"}`. Homebrew má všude `header:2`, kopie bere header rodiče.
- `data/subclass-features.json` přegenerován; `scripts/validate-data.js` očekávaný počet subclass-features 780 → 782.
- Kód sheetu beze změny — pool path (`consumedResourceName`, `resourceKeyFor`) fungoval s pouhou změnou dat.
- `e2e/tgs2ChannelDivinity.spec.ts` (nový, seed schema 64).
- Docs: DATA.md (odstavec Channel Divinity options), STATUS.md (TGS2-4b, spec, odebráno z „Open“), DECISIONS.md D386.

## Ověřeno
- typecheck OK; `npm test` 188 souborů / 3442 testů OK; validate-data 177/177; dangling refs 0.
- `npm run e2e` 681/681 OK, **3,7 min** (nad 3 min limitem z CLAUDE.md).
- TGS2-4b a–c: Paladin 3 Spelldrinker, Actions — řádky Absorb Magic a Expeditious Command, každý se 2 boxy
  „Use Channel Divinity“; use na Absorb Magic → 1 použitý box na obou řádcích; po druhém use nemá žádný řádek box „Use“.
- TGS2-4b d: Features — jeden řádek Channel Divinity, řádky Absorb Magic a Expeditious Command po jednom, text každé volby 1×.
- `e2e/reviewFixesM10.spec.ts` (F-12 c: dva řádky „Channel Divinity“) prochází.

## Rozhodnutí přijatá při práci
- „Use button“ / „disabled“ v zadání: řádek featury na Actions nemá samostatné tlačítko Use, jen boxy UseBoxes
  (`aria-label` „Use Channel Divinity“). Prázdný pool = žádný box „Use“, zbylé jsou „Undo a use of…“ (stále klikací
  pro vrácení). Test c ověřuje tohle; kód sheetu jsem neměnil (zákaz v zadání).
- Test d: volby se ve Features zobrazují jako vlastní řádky vedle jednoho řádku Channel Divinity (stejně jako
  Conquest|XGE v F-17 a), ne jako text uvnitř Channel Divinity. Test kontroluje text každé volby přesně 1×.
  Zda je vidět úvodní věta subclass Channel Divinity, test nekontroluje.
- DATA.md věta „all 46 of their subclassFeature records“ (TGS2-1) ponechána; nový odstavec uvádí 46 → 48.

## Subagent
Nepoužit.

## Pozn.
- Investigační skript `scripts/tgs2-4b-cd-shape.js` necommitován; `git clean` podle zadání nespuštěn
  (ve `scripts/` zůstávají i starší nesledované skripty).

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Sheet → Actions (Paladin Spelldrinker 3+: dva nové řádky Absorb Magic, Expeditious Command);
Sheet → Features & Traits (dva nové řádky voleb, Channel Divinity bez vnořeného textu voleb).
