# F-19: Kensei weapons picker a Samurai Elegant Courtier (D344)

**Repo:** `git fetch` + `merge --ff-only` OK (už aktuální), HEAD 9c39bae.

## Inventura (17 souborů, ~24 míst — pod hranicí pro split)
| Oblast | Soubor / funkce |
|---|---|
| Úložiště, schéma 61 | `storage/character.ts` (`kenseiWeapons`, `elegantCourtierSave`, typy, `CURRENT_SCHEMA_VERSION`) |
| Migrace 60→61 (jen tag) | `storage/migrations.ts` |
| Validace / čtení | `storage/validate.ts` (`describeKenseiWeaponsError`, `describeCharacterError`, `toCharacter`) |
| Zápis (create/update/Import) | `storage/characterStore.ts` `buildCharacter` + vstupní typ; Export/Import jdou přes ně, jinak beze změny |
| Pravidla | nový `kensei/kensei.ts` (sloty, nabídka z items.json, `heldKenseiWeapons`, `hasElegantCourtier`) |
| Zdatnost se zbraní | `calculation/featureGrants.ts` (`pendingWeapons` → label + picks, `chosenWeaponGrants`), `calculation/proficiencies.ts` |
| Útoky | `calculation/weaponAttacks.ts` `isMonkWeapon` (Kensei jméno = monk weapon; DEX + Martial Arts die stávající logikou) |
| Saves | `calculation/savingThrows.ts` (`saveProficiencySources` vyčleněno, Elegant Courtier) |
| Wizard stav | `creation/wizardState.ts` (WizardData, seed, reducer, `wizardKenseiSlots`, krok `languages`, `saveCharacter`) |
| Wizard UI | `creation/CharacterWizard.tsx`; nové `kensei/KenseiWeaponSlots.tsx`, `kensei/ElegantCourtierChoice.tsx`, `kensei/useWisdomSaveHeld.ts` |
| Level up | `levelUp/levelGains.ts` (krok Proficiencies se projde na Monk 6/11/17 Kensei a Fighter 7 Samurai) |
| Remove level | `levelUp/levelRemoval.ts` |

## Co se změnilo
- Kensei: na kroku Proficiencies (new, level up, Edit) selecty „Kensei melee/ranged weapon (Monk 3)“ a „Kensei weapon (Monk 6/11/17)“. Volba dává pojmenovanou zdatnost a počítá se jako monk weapon. Řádek „Kensei weapons — not chosen“ zůstává, jen dokud je některý slot prázdný.
- Nabídka z items.json: 41 zbraní (obyčejné simple/martial bez Heavy/Special + Longbow podle textu featury), 17 ranged. Detaily v DATA.md.
- Elegant Courtier: Fighter XPHB Samurai 7+ má Wisdom save se zdrojem „Elegant Courtier“. Má‑li Wisdom už odjinud (první třída, Resilient, …), ukáže se volba Intelligence/Charisma a uloží se; bez volby je ve Wisdom breakdownu poznámka.
- Remove level: Monk z úrovně N maže volby s `level` N; Fighter ze 7 maže `elegantCourtierSave`. Pod 3 zmizí podtřída i volby úrovně 3.

## Ověřeno
- `typecheck`, `test` (181 souborů, 3278 testů), `validate-data` (175/175), `e2e`: 532/534 v plném běhu (2.5 min); 2 pády byly natvrdo zapsané `schemaVersion` 60 v `levelOrder.spec.ts` a `stableIds.spec.ts`, přepsáno na 61 a obě spec soubory znovu prošly (4/4).
- Unit `src/kensei/kensei.test.ts`: počet nabídky 41/17, Longbow in, Greatsword a Heavy Crossbow out; sloty 3/6/17; pravidlo save (Wis na 7, ne na 6; s Resilient Cha jen po volbě; uložená volba bez Wis odjinud se ignoruje); validace a čtení schématu 61. `migrations.test.ts`: 60→61.
- E2E `e2e/kenseiSamurai.spec.ts` a–g: Monk 2→3 Kensei Longsword+Longbow (Next blokuje do obou voleb, zdatnost, žádný pending řádek, Longsword +5 / 1d8 + 3, breakdown „Martial Arts“); Greatsword/Heavy Crossbow nenabízeny; Monk 5→6 Whip (1d8 Martial Arts die); Remove level 6→5 maže jen Whip; Fighter 6→7 Wis +4 se zdrojem bez volby; s Resilient volba Cha → Cha +2; Export/Import zachová obě pole.

## Rozhodnutí přijatá v práci
- Úložiště a vlastnictví zapsáno jako D344. Pole na úrovni postavy (ne `classFeatureChoices` — ty wizard filtruje podle featur z dat a Kensei volby by zahodil).
- Blokování Next: Kensei sloty i Courtier volba blokují stejně jako subclass tool/skill volby (stávající pravidlo kroku `languages`).
- Do nabídky patří i 8 XDMG palných zbraní (Laser Pistol, Antimatter Rifle…): splňují text pravidla a mastery picker je bere jako obyčejné zbraně taky. Pokud je nechceš, je to jeden filtr — rozhodni.
- Úroveň „už zdatný ve Wisdom“ se počítá ze všech zdrojů kromě custom itemů (wizard je nenačítá); list je počítá i s nimi.
- Shrnutí level upu Fightera 7 Samurai hlásí „Elegant Courtier save (only if Wisdom saves are already proficient)“ i tehdy, když se volba nakonec nezobrazí.

## Manual browser check for the user
Na https://familliar.vercel.app:
1. Vytvoř Monka 2 (Way of the Kensei se volí až na 3), Level up → „Monk 2 → 3“, na kroku Class zvol Way of the Kensei, krok **Proficiencies**: dva selecty „Kensei melee/ranged weapon (Monk 3)“ pod Kensei tool selectem — zarovnání, šířka selectu, zalamování popisku na mobilu.
2. Fighter 6 Samurai s featem Resilient (Wisdom) na úrovni 4 → Level up „Fighter 6 → 7“, krok **Proficiencies**: rámeček „Elegant Courtier (Samurai) …“ se dvěma radii — vzhled legendy a mezery.
3. U Monka z bodu 1 (Longsword jako Kensei zbraň): Inventory → Manage Inventory, přidej Longsword a vezmi do ruky; záložka **Actions**: řádek Longsword a jeho breakdown s „Martial Arts“ — čitelnost.
