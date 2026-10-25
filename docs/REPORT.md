# REPORT — BA-1 Bracers of Archery (D402)

Setup: `git fetch` + `git merge --ff-only origin/main` -> already up to date, HEAD was 51273db. Branch main. No subagent used.

## What changed
- `src/inventory/inventoryData.ts`: `ItemRef.bonusWeaponDamage` (parsed via `bonusField`, "+2" -> 2). Data matches the brief: carried by Bracers of Archery|XDMG only, `reqAttune: true` (checked with a script, since removed).
- `src/calculation/weaponAttacks.ts`: `BRACERS_OF_ARCHERY` + hand rule `['Longbow','Shortbow']` (D70 style, comment cites the item text); new last param `bracers` of `computeWeaponAttacks`, spliced into `damageFor`'s item bonuses only for XPHB Longbow/Shortbow rows. Breakdown line "Bracers of Archery +2".
- `src/sheet/itemFlatBonusData.ts`: `buildBracersOfArcheryBonus` (attuned gate via `isAttuned`, same as the other item bonuses); wired in `CharacterSheet.tsx`.
- Docs: D402 added, QUESTIONS entry "bonusWeaponDamage nečte nikdo" removed, STATUS updated.

## Point 2 (proficiency): NOT done, by instruction
`weaponAttackData.grants` takes item grants from `itemWeaponGrants(buildItemProficiencyGrants(inventory, []))`, i.e. `customProficiencies` of CUSTOM items only (empty itemRefs). No path grants weapon proficiency from a catalog item. Not built. Consequence: a character without bow proficiency does not get it from the Bracers (Fighter/Ranger etc. unaffected). Needs a decision/task if wanted.

## Decisions taken in code
- "Magic variants" are not separate items in items.json (no baseItem anywhere on weapons; a +1 Shortbow is the plain Shortbow row with `magicBonus`), so the rule keys on `weapon.name` + source XPHB; no baseItem resolution was needed.
- Gate is attunement only; "worn" (`equipped`) is not checked, matching `buildItemFlatBonusGrants`. Unattuned Bracers add nothing and no "considered" line (differs from the D76 zero-line style of other withheld bonuses).

## Verified
- typecheck, `npm run test` (190 files / 3467 tests), validate-data (177/177), `npm run e2e` (724 passed, 2.4 min).
- Unit: `weaponAttacks.test.ts` "Bracers of Archery (D402)". E2E `e2e/bracersOfArchery.spec.ts`: a/b/c (Longbow 1d8+4 with breakdown dialog line, Shortbow +1 1d6+5, Light Crossbow 1d8+2 and Mace 1d6+3 unchanged), d (unattuned 1d8+2).

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Actions tab (damage text and breakdown dialog of Longbow/Shortbow rows).
