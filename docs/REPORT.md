# B-1: Agonizing Blast na Eldritch Blast a počet paprsků (D372)

Setup: fetch, ff-only merge (už aktuální), npm ci, e2e:install; HEAD edfe462 (OK).

## Místa změn (STEP 1, 12 míst)
| Soubor | Změna |
|---|---|
| spellActionRowData.ts | `cantripDamage` param `agonizingBlast`; nové `hasAgonizingBlast`, `beamNote`, `isEldritchBlast`; `SpellActionData.notes?`; `spellActionData`/`spellActionRows` param |
| itemSpellRows.ts | `itemSpellActionRows` param (EB z předmětu taky) |
| spellsTabData.ts | `spellEffect` param; `spellNotes` param `characterLevel`, beam note první |
| CharacterSheet.tsx | `agonizingBlast` z `optionalFeatureChoices` EI + `itemInvocationGrants(inventory)`; props SpellsSection → SpellTabRow; `spellActionRow` notes |

Modifikátor = modifikátor casteru řádku (`resolved.abilityModifier`), u Warlockova EB tedy CHA Warlocka. Neznámý → „1d10 + mod". Breakdown „Eldritch Blast breakdown" nemá sekci poškození (jen Spell attack) → beze změny.

## Ověřeno
- typecheck OK; test 186 souborů / 3393 testů OK (nové: describe „Agonizing Blast and beams (D372)" ve spellActionRowData.test.ts); validate-data 177/177.
- e2e 633/633 OK, ale celá sada trvá 8,0 min (> 3 min).
- Nové `e2e/agonizingBlastB1.spec.ts`: a) Warlock 5 + AB, CHA 16 → „1d10 + 3" Actions i Spells, Notes „2 beams"; b) bez AB (Repelling Blast) → bez „+", „2 beams"; c) Warlock 1 → žádné „beams"; d) AB jen z vlastního předmětu (`custom.invocations`) → „1d10 + 3".
- F-32a beze změny a zelené (`toContainText('1d10')` sedí i na „1d10 + 3"/notes).

## Rozhodnutí přijatá při práci
- Pick bez `source` (starší uložení) se počítá jako XPHB Agonizing Blast podle jména; PHB zdroj ne.
- Shoda jen pro Eldritch Blast XPHB (beam count i AB) — podle zadání a DATA.md.
- Modifikátor bere caster řádku, ne natvrdo Warlocka (u ne-Warlocka s AB z předmětu a EB z featu to bude modifikátor featu). Pokud má být vždy Warlockův, je to otázka pro plánování.
- Beam note na Spells je první část Notes („2 beams · V, S · Instantaneous").

## Poznámky
- V `scripts/` leží dva netrackované soubory, které tento task nevytvořil (investigate-item-weight.js, investigate-multi-dice-spells.js); necommitnuty, git clean nespuštěn (zakázáno zadáním).
- Jednou jsem omylem četl konec DECISIONS.md přes `tail` (shell) místo Read.
- DATA.md beze změny — počet paprsků už je zapsán (Eldritch Blast XPHB, řádek „Cantrip Upgrade").

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: list postavy → záložka Actions (řádek Eldritch Blast: Damage, Notes); záložka Spells (řádek Eldritch Blast: Effect, Notes).
