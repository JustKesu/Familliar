AU-1 hotovo (D412). HEAD na startu 711d9be.

## STEP 1: featury s počtem „number of times equal to your <Ability> modifier“
Skript `scripts/investigate-ability-mod-uses.js` (class/subclass features, feats, optional features; feats/optfeats 0 zásahů). Všechny přidané: minimum 1, obnova Long Rest; Short Rest jen kde uvedeno.

| Vlastnost | Featury (zdroj) | Short Rest |
|---|---|---|
| CHA | Bardic Inspiration (XPHB) | vše od Barda 5 (Font of Inspiration) |
| CHA | Glorious Defense, Dark One's Own Luck, Restore Balance, Steps of the Fey (XPHB); Infectious Inspiration (TCE); Elemental Rebuke (FRHoF); Form of Dread (RHW); Money Talks (TGS2) | – |
| WIS | War Priest (XPHB) | vše (vlastní text) |
| WIS | Warding Flare (XPHB) | vše od Improved Warding Flare |
| WIS | Tireless, Nature's Veil, Corona of Light, Moonlight Step, Cosmic Omen, Flurry of Healing and Harm, Wholeness of Body, Misty Wanderer, Star Map, Dread Ambusher (XPHB); Embodiment of the Law, Fungal Infestation (TCE); Hidden Paths, Unerring Eye, Hunter's Sense (XGE); Sentinel at Death's Door (RHW); Chilling Retribution (FRHoF); Ghost Walker, Whispers of Knowledge (TGS2) | – |
| INT | Bloodthirst (FRHoF) | jedno (Dread Incarnate) |
| INT | Bladesong (FRHoF); Tinker's Magic, Flash of Genius, Restorative Reagents, Arcane Jolt, Mapping Magic, Dreadnaught (EFA) | – (viz níže Flash of Genius) |
| STR / CON / DEX | Unwavering Mark, Warding Maneuver (XGE); Wails from the Grave (RHW) | – |

Celkem 41 (17 XPHB + 24 z dalších knih). Zastaveno pro jednotlivé featury, nepřidány:
- Spell-Storing Item (EFA): „twice your Intelligence modifier (minimum of twice)“, náboje předmětu, bez odpočinku.
- Perfected Armor (EFA): dva počty, jeden na každý model zbroje.
- Reanimator's Skill Set (RHW): minimum není uvedeno (modifikátor 0 → 0 použití?).
- 28× Proficiency Bonus, 1× Renown Score (Favored in House) — jiný vzor, mimo rozsah.

## Co se změnilo
- src/calculation/resources.ts: `ABILITY_MODIFIER_USES`, `abilityModifierMax` (před fallbackem „not in data“, za `LEVEL_SCALED_USES`); řádek platí jen, když text držené featury obsahuje větu s tou vlastností. `computeCharacterResources(..., abilityScores?)`, typ `AbilityScores`.
- src/sheet/CharacterSheet.tsx: předává `abilityScores` (computeAbilityScores s featy a předměty) — jediné místo. levelRemoval/multiclassLevelUp skóre nepředávají: maximum tam zůstane unknown, počet se neořízne (zobrazení ořezává `remainingUses`).
- Unit testy resources.test.ts „D412“ (4). e2e/abilityUses.spec.ts a–e.
- docs: D412, STATUS.md, DATA.md (nová sekce „Use counts stated as an ability modifier“).

## Testy
- typecheck čistý; `npm test` 190 souborů / 3504 testů prošlo; validate-data 177/177.
- e2e/abilityUses.spec.ts: a (CHA 14 + 2 z pozadí → 3 boxy „/ Long Rest“, Short Rest nechá použitý, Long Rest vrátí), b (Bard 5, Short Rest vrátí), c (CHA 8 → 1), d (Fighter 5 / Bard 6, CHA 18 → 4), e (Warlock 3 Archfey, CHA 16 → 3 Steps of the Fey).
- Plné `npm run e2e`: 766 prošlo, 7,4 min (nad 3 min limitem, hlásím).

## Subagent
Nepoužit.

## Decisions taken
- Pojistka proti stejnojmenné featuře jiné edice: tabulka se použije jen, když text featury tu frázi s danou vlastností obsahuje.
- Pod minimem rozpis dva řádky („Charisma modifier -1“, „minimum of once“ +2).
- Flash of Genius: Short Rest návrat z EFA Advanced Artifice („When you finish a Short Rest, you regain one…“) čtečka obnovy nezná (pořadí věty); ponecháno, otázka pro plánovací chat.

## Otevřené
- Netrackovaný `scripts/investigate-bm-table.js` z dřívější session a `scripts/investigate-ability-mod-uses.js`: necommitnuty, `git clean` nespuštěn (zakázáno zadáním).

## Manual browser check for the user
None - the planning chat checks the looks from screenshots. Změněné obrazovky: Actions tab (nové počítadlo u 41 featur, např. Bardic Inspiration, Steps of the Fey), Features & Traits, kde se počítadla zdrojů zobrazují (netestováno e2e), rozpis maxima počítadla.
