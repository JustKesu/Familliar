# REPORT — PW-1: pact weapon flag, Improved Pact Weapon and Lifedrinker (D401)

Setup: `git fetch origin`, `git merge --ff-only origin/main` already up to date, HEAD 7d65f31. No subagent used.

## Data check (scripts/pw1-invocations.js, untracked)
`Pact of the Blade|XPHB`, `Improved Pact Weapon|XGE` (prereq `pact: Blade`; text "unless it is a magic weapon that already has a bonus to those rolls"), `Lifedrinker|XPHB` (prereq Warlock 9 + Pact of the Blade; "extra 1d6 Necrotic, Psychic, or Radiant"). Matches the brief; one entry each.

## Changed places (15)
- `src/storage/character.ts`: `CharacterInventoryItem.pactWeapon?: true`; `CURRENT_SCHEMA_VERSION` 66 → 67 (convention: every new optional inventory field bumped, cf. 20/21/22).
- `src/storage/migrations.ts`: 66 → 67 tag-only step.
- `src/storage/validate.ts`: `describeInventoryError` (must be `true` when present) and `toCharacterInventory` carry-through.
- `src/inventory/inventoryData.ts`: `inventoryRowKey` includes the flag (rows with different state never merge).
- `src/sheet/pactWeapon.ts` (new): `pactWeaponInvocations` (name+source, absent source = XPHB as in chainMaster.ts) and `togglePactWeapon` (marking one row clears the rest).
- `src/calculation/weaponAttacks.ts`: `HeldWeapon.pactWeapon`, `PactWeaponEffects` param on `computeWeaponAttacks`, `AttackDamage.extraDamage`. IPW: `{source:'Improved Pact Weapon', amount:1}` on to-hit and damage; with `magicBonus.carried !== 0` a zero-amount "considered (+1) — not applied" line instead. Lifedrinker: `extraDamage`, appended to `text`, zero-amount breakdown line.
- `src/sheet/weaponAttackData.ts`: `buildHeldWeapons` passes the flag.
- `src/sheet/CharacterSheet.tsx`: passes `pactWeaponInvocations(character)` to `computeWeaponAttacks` and `pactOfTheBlade` to the panel; action row renders `+ <extraDamage>` after the damage type (`.sheet__action-extra-damage`, no CSS added).
- `src/sheet/ManageInventoryPanel.tsx`: "Pact weapon" toggle button (`aria-pressed`) on weapon rows (`isWeapon`) only when Pact of the Blade is held; "pact weapon" in row meta.
- `src/sheet/InventoryTab.tsx`: "pact weapon" in the Notes column.
- `e2e/levelOrder.spec.ts`, `e2e/stableIds.spec.ts`: expected schemaVersion 67.
- Thirsting/Devouring Blade (`computeAttacksPerAction`) untouched.

## Tests
- Unit: `weaponAttacks.test.ts` "pact weapon (D401)" ×4 (IPW marked only, IPW blocked by magic bonus, Lifedrinker text not modifier, no marked weapon = no change); `src/sheet/pactWeapon.test.ts` ×3; `migrations.test.ts` 66→67 step + last-step 67.
- e2e `e2e/pactWeapon.spec.ts`: a (no toggle without Pact of the Blade), b (marking Sickle unmarks Mace; Rations has no toggle), c (+8 Sickle vs +7 Mace), d (Mace +1 marked → +8, `1d6 + 4`), e (Lifedrinker text on Sickle only), f (flag after reload).
- typecheck, test (190 files / 3466 tests), validate-data (177/177), e2e (722 passed, 2.3 min): pass.

## Decisions taken in code
- "Already has a bonus" read as `magicBonus.carried !== 0`: an unattuned weapon whose own bonus is withheld still blocks IPW (the weapon has the bonus; it is just not in effect).
- IPW and Lifedrinker need only the flag + their own invocation; Pact of the Blade itself gates only the toggle's visibility.
- A stored flag stays on the row if Pact of the Blade is later removed (toggle hidden, no effect without IPW/Lifedrinker).
- Toggle lives in Manage Inventory (all inventory edits live there since R10a), not on the Inventory tab.

## Docs
D401 added (Czech). QUESTIONS.md: removed "Invokace a features měnící útok" and "Kouzla z rasy nikam nevedou". STATUS.md updated.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Manage Inventory → My Inventory row (new "Pact weapon" button, meta "pact weapon"); Inventory tab Notes column; Actions tab weapon row damage cell ("+ 1d6 Necrotic, Psychic, or Radiant"); attack breakdown drawer (Improved Pact Weapon / Lifedrinker lines).
