# REPORT — PB-1b: featury počítané tabulkou mají řádek v Actions, Review ukazuje podtřídu (D415)

Setup: `git fetch`, `git merge --ff-only origin/main` (already up to date), `npm ci`, `npm run e2e:install`; HEAD 3df8f8c.
Pracovní strom obsahoval 4 nesledované skripty v `scripts/` z minulých sezení (investigate-ability-mod-uses.js, -bm-table.js, -pb-feats.mjs, -pb-uses.mjs); nestagovány, `git clean` dle zadání nespuštěn.

## STEP 1 — nové řádky v Actions (`scripts/investigate-pb1b-table-rows.mjs`, nestagován)

Záznamy, které tabulka počítá a které dosud neprošly D86 ani D182. Všech 69 jmen tabulek má aspoň jeden záznam. Feats z PB tabulky mají značku odpočinku → v Actions už byly. Žádné jméno nepadá do Actions dvakrát ani do jiné skupiny.

| Jméno | Zdroj | Vlastník | Tabulka | Skupina |
|---|---|---|---|---|
| Infectious Fury, Call the Hunt | TCE | Barbarian/Beast | PB | Other |
| Bolstering Magic, Magic Awareness | TCE | Barbarian/Wild Magic | PB | Other |
| Steps of Night | TCE | Cleric/Twilight | PB | Other |
| Emboldening Bond | TCE | Cleric/Peace | PB | Other |
| Cauterizing Flames | TCE | Druid/Wildfire | PB | Other |
| Giant's Might, Runic Shield | TCE | Fighter/Rune Knight | PB | Other |
| Writhing Tide, Swarming Dispersal | TCE | Ranger/Swarmkeeper | PB | Other |
| Elemental Gift | TCE | Warlock/Genie | PB | Other |
| Tentacle of the Deeps | TCE | Warlock/Fathomless | PB | Other |
| Bond / Pact / Protection of the Talisman | TCE | optional features | PB | Other |
| Infectious Inspiration | TCE | Bard/Eloquence | AB (CHA) | Other |
| Embodiment of the Law | TCE | Cleric/Order | AB (WIS) | Other |
| Fungal Infestation | TCE | Druid/Spores | AB (WIS) | Other |
| Hidden Paths | XGE | Druid/Dreams | AB (WIS) | Other |
| Warding Maneuver, Unwavering Mark | XGE | Fighter/Cavalier | AB (CON / STR) | Other |
| Unerring Eye | XGE | Rogue/Inquisitive | AB (WIS) | Other |
| Hunter's Sense | XGE | Ranger/Monster Slayer | AB (WIS) | Other |
| Whispers of Knowledge | GriffonsSaddlebag2 | Ranger/Rocborne | AB (WIS) | Other |

Zjištění: 9 AB featur výše nemělo dosud počítadlo vůbec — `isSelfLimitedFeature` bez značky odpočinku propouštěl jen PB řádky (D414), takže premisa zadání („D412 dává počítadla featurám bez značky") platila jen pro PB. Zapsáno do DATA.md.

## Co se změnilo

- `resources.ts`: export `isTableCounted(name, text)` = `isProficiencyBonusCounted || isAbilityModifierCounted` (regexy beze změny, jen vytažené do `isAbilityModifierCounted`). Použito v `isSelfLimitedFeature` (místo samotného PB) → 9 AB featur výše je nyní zdroj s počítadlem i v Features.
- `featureActionRowData.ts` `featureActionRows`: feature/feat/option kvalifikuje i přes `isTableCounted(name, plainText(entries))`, na stejném řádku jako `speciesTraitUses` u rysů druhu.
- B: `CharacterWizard.tsx` classLine (multiclass level up/Edit) a fallback v `ReviewStep.tsx` připojují ` (Subclass)`. `characterSummary.ts` beze změny.
- `e2e/multiclassEdit.spec.ts` M9b a: očekávaný řádek Review upraven na „Warlock 6 (Fiend Patron) / Sorcerer 3 (Wild Magic Sorcery)".
- Docs: D415 (DECISIONS), STATUS (PB-1b; věta PB-1 o Features-only odstraněna), DATA.md (PB-1b odstavec).

## Ověřeno

- `npm run typecheck` OK; `npm test` 190 souborů / 3515 testů OK; `npm run validate-data` 177/177 OK.
- `npm run e2e` 776/776 OK, 8,1 min (nad limitem ~3 min z CLAUDE.md, beze změny oproti dřívějšku).
- Unit: `featureActionRowData.test.ts` „D415: adds an untagged feature, feat or option…" (PB feature, AB feature, PB feat, PB option; stejné jméno bez věty nedostane řádek); `resources.test.ts` „D415: an untagged XGE row is a resource too".
- e2e: `proficiencyBonusUses.spec.ts` PB-1b a (Rune Knight 5: Giant's Might v Actions › Other, 3 boxy, použití jednoho → Features 1 použitý / 2 volné), PB-1b b (Cavalier 3, STR 15: Unwavering Mark v Actions › Other, 2 boxy); `levelUpSubclassGains.spec.ts` LS-1 b (Review obsahuje „Fighter 5 / Rogue 3 (Arcane Trickster)").

## Rozhodnutí přijatá během práce

- `isTableCounted` použit i v `isSelfLimitedFeature`, jinak by e2e b) (AB featura s boxy v Actions) nešlo splnit: žádná AB featura mimo Actions neměla zdroj. Mění chování: 9 featur nově má počítadlo i v záložce Features. Zapsáno do D415 (2) — pokud nechtěné, vrátit jen tento řádek v `isSelfLimitedFeature`.
- Fallback v ReviewStep se používá i při tvorbě jedné třídy, takže podtřída se nově ukazuje i na Review tvorby (zadání jmenovalo level up a Edit, ale i tento fallback). Zapsáno do D415 (3).

## Subagent

Nepoužit.

## Manual browser check for the user

Žádná — vzhled kontroluje plánovací chat ze screenshotů. Změněné obrazovky: list postavy › Actions (nové řádky ve skupině Other, např. Rune Knight, Cavalier), list › Features (nová počítadla u 9 AB featur), wizard › Review (řádek tříd s podtřídou při level up, Edit i tvorbě).
