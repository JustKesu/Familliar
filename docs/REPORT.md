# P-CB: vlastní background — průzkum

Setup: fetch + `merge --ff-only` = již aktuální, HEAD 7ae13ea. Jen průzkum, žádný kód, žádný skript, žádný subagent, žádné npm.

## 1. Jak se background drží dnes
- Wizard: `backgroundChoice {name, source, abilityBonus, abilityBonusDistribution}` (`BackgroundPicker.tsx:39`), `backgroundToolProficiency`, `backgroundOriginFeatOverride` (D205), `grantedFeats` origin 'background' (`wizardState.ts:456-510`). Reset při změně identity `wizardState.ts:1426-1448`.
- Storage: `CharacterBackground {name, source, skillProficiencies:[2], toolProficiency, originFeatOverride?}` (`character.ts:27-47`); `abilityBonus` vedle (`character.ts:134`). Schema 63 (`character.ts:1140`); override přidán v 50 (`migrations.ts:442`).
- validate: `describeBackgroundError` `validate.ts:168-189` (name/source neprázdné, 2 skills, tool, override shape); trojici abilit NEkontroluje (`validate.ts:322`) → custom bonus projde beze změny.
- Lookup v datech podle name+source: `loadBackgrounds` `backgroundData.ts:219`; wizard `backgrounds.find` `CharacterWizard.tsx:463` (draftBackgroundEntry) a `:1171` (selectedBackground); origin feat `backgroundOriginFeatFrom` `featInstances.ts:165`, `backgroundOriginFeatAmong` `featEffects.ts:108`; vybavení `extractBackgroundStartingEquipment` `startingEquipmentData.ts:332` (throw „no background“ `:345`).
- Klíčové: `featInstances` už bere `originFeatOverride ?? derived` (`featInstances.ts:101`) → feat vlastního backgroundu = override, všechny čtenáře feat už pokrývá.

## 2. Čtenáři
| Místo | Čte | Bez záznamu v datech |
|---|---|---|
| skills `calculation/skills.ts:119` | stored skillProficiencies | OK |
| tools `proficiencies.ts:215` | stored toolProficiency + name | OK (label „<jméno> (background)“) |
| ability bonus `AbilityScoreTable.tsx:45`, Review `:304` | abilityBonus | OK |
| featInstances + sheet/spells/senses/weapons/damage/levelRemoval (`featSpells.ts:424`, `grantedSenses.ts:208`, `weaponAttackData.ts:219`, `damageResponseData.ts:211`, `levelRemoval.ts:424`) | override ?? link | OK, pokud feat jde do override |
| `featAsiLevels.ts:197` | override | OK |
| expertise pool `CharacterWizard.tsx:1225`, `ManageFeatsPanel.tsx:270` | stored skills | OK |
| wizard selectedBackground `CharacterWizard.tsx:1171` → tool picker `:2089`, OriginFeatSwapPicker `:2097`, D18 disabled skills `:1177`, feat gate `:1740` | BackgroundEntry z dat | **rozbité**: nic se nezobrazí, gate trvale false |
| draftBackground `CharacterWizard.tsx:463-471` (HP, featAsi, ability draft `:1306`) | BackgroundEntry | **rozbité**: draft bez backgroundu |
| save `CharacterWizard.tsx:1784` → `wizardState.ts:1688` | selectedBackground?.skillProficiencies | **ztráta dat**: background se při uložení (i Edit/level up) zahodí |
| Edit seed `wizardState.ts:719-757` | stored | OK, ale pak viz řádky výše |
| level up `levelGains.ts:249` (krok přeskočen) | — | rozbité přes save výše |
| equipment `CharacterWizard.tsx:645-662` | loadBackgroundStartingEquipment | **error, blokuje krok** (`:1657`) |
| Review `ReviewStep.tsx:201`, sheet header `CharacterSheet.tsx:2917` | name | OK |
| home karta `characterSummary.ts:5` | nečte background | — |
| import/export `validate.ts:1526,1545` | describeBackgroundError | OK |
| HP picker `HitPointsPicker.tsx:91` | jen deps klíč | OK |

## 3. Návrh tvaru
- Žádné nové pole: `CharacterBackground {name: <vlastní>, source: 'custom', skillProficiencies, toolProficiency, originFeatOverride: <zvolený O feat>}`. Rozpoznání `source === 'custom'` (sentinel, nekoliduje s 5etools zdroji). Sub-choices featu dál v `grantedFeats` origin 'background' — `featInstances` je páruje proti override beze změny. Schema: ideálně beze změny (validate projde už dnes); jen pokud chceme validate přísněji (override povinný pro 'custom') → 64.
- Jeden resolver ve wizardu: `resolveBackgroundEntry(choice, backgrounds, custom)` vrací `BackgroundEntry` — pro custom syntetizuje `{abilityChoices: zvolená trojice, skillProficiencies: zvolené 2, toolProficiency: {kind:'any'}, originFeat: null, startingEquipment: <dle Q1>}`. Nahradí oba `backgrounds.find` (`:463`, `:1171`) → tool picker, D18, gate, save, draft fungují bez větvení.
- Wizard state navíc: `customBackground {abilityChoices, skills}` (název jde do backgroundChoice.name). Edit seed z uloženého (trojice = klíče abilityBonus jen u +1/+1/+1; u +2/+1 je třetí abilita neznámá → buď ji uložit, nebo ji při Editu nechat vybrat znovu — viz Q5).
- Nové UI: přepínač Custom v `BackgroundPicker`, výběr 2 skills, `ToolProficiencyPicker` s kindem 'any' (nový), origin feat picker se seznamem z `useSpeciesOriginFeat` (category 'O', `speciesOriginFeat.ts:60`) — vytáhnout loader, ne kopírovat.
- `OriginFeatSwapPicker` (Dark Gift) pro custom skrýt nebo nechat? → Q6.

## 4. Otázky pro uživatele
1. **Startovní vybavení**: (a) jen 50 GP — nejjednodušší, `StartingEquipmentOffer` s jednou volbou; (b) volba 50 GP / nic; (c) volný balík itemů — nové UI, velké. Doporučení (a).
2. **Skill, který už dává třída/druh**: (a) zakázat jako u knižního (D18, disabled) — konzistentní; (b) dovolit a ignorovat duplicitu. Pozor: pořadí kroků je class→species→background (D44), takže (a) jde zadarmo.
3. **Jméno = knižní background**: (a) povolit (source 'custom' je rozliší); (b) zakázat — zbytečné; (c) varovat. Doporučení (a); prázdné jméno zakázat.
4. **Přepnutí custom ↔ knižní v Edit**: (a) jako změna identity — smaže tool, expertise, background grantedFeats, override, background vybavení (`wizardState.ts:1440-1448`); (b) zachovat shodné skills/tool. Doporučení (a), už existuje.
5. **Trojice abilit u +2/+1**: (a) uložit `abilityChoices` do CharacterBackground (schema 64 + migrace aditivní); (b) neukládat, při Editu odvodit 2 a třetí nechat prázdnou. (b) mění UX Editu, (a) je čisté.
6. **Dark Gift u custom**: custom feat je volný O feat; Dark Gifty (D205) mají jinou kategorii — nabídnout i je? (a) ne, jen 'O' (jako Versatile, D272); (b) ano.
7. **Libovolný nástroj**: jen tools z kategorií artisan/instrument/gaming + pojmenované, nebo vše s typem T/AT/INS/GS z items.json? Nutný rozpis přes skript (DATA.md).

## 5. Slicy
| Slice | Obsah | Model | Schema | e2e | review |
|---|---|---|---|---|---|
| CB-1 | resolver + wizard state + UI (custom přepínač, jméno, 2 skills, trojice + bonus, tool 'any', O feat + sub-choices), save; vybavení dle Q1 | Opus | ne / 64 dle Q5 | ano (vytvořit custom, sheet ukáže skills/tool/feat) | ano |
| CB-2 | Edit + level up custom postavy, přepínání custom↔knižní, validate přísněji (override povinný) | Sonnet | možná 64 | ano (edit zachová background, level up neztratí) | ano |
| CB-3 | docs: DATA.md (tool seznam), STATUS.md | Sonnet | ne | ne | ne |
CB-1 a CB-2 lze spojit, pokud Q5 = (a); jinak CB-2 obsahuje migraci.

## Rozhodnutí / otázky během práce
- Žádné rozhodnutí nepřijato. Nalezeno mimo scope: save bere skills ze `selectedBackground` z dat (`CharacterWizard.tsx:1784`), ne z uloženého backgroundu — pokud backgrounds.json při Editu selže v načtení, background se zahodí. Netestováno.

## Manual browser check for the user
Nic — průzkum bez změny UI.
