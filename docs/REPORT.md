# Block HL - manager run

Setup: HEAD 81f6b85 at start (requirement met). All commits and pushes to origin/main succeeded.

| Task | Commit | Result |
|---|---|---|
| PC-1 | 7dc5c65 | passed (D417) |
| LH-1 | f9d7925 | passed (D418), 1 fix subagent |
| FS-1 | 98dc0fc | passed (D419) |
| WM-1 | see git log (WM-1 part 1 D420) | STOP: C and D done, A and B not started (D420) |

Manager checks after every task: git diff read, typecheck, npm test, lint, full e2e. Final state: 191 unit files / 3549 tests pass, 790 e2e pass in 8.8 min (over the 3 min guideline, as before). `npm run lint` has ONE error, pre-existing and in a file no HL task touched: `src/sheet/spellsTabData.ts:229` rules-of-hooks (`useLabel` inside `spellsTabActionSections`); lint on each task's changed files is clean. Schema: 68 -> 69 (PC-1) -> 70 (FS-1); WM-1 A/B will need 71, not 69 as TASKS-HL.md says. Untracked investigation scripts left in `scripts/` (git clean was forbidden for this run): investigate-lay-on-hands.js, investigate-fs1.mjs, investigate-wm1.js plus 6 older ones.

## PC-1 - Pact weapon uses Charisma (D417, 7dc5c65)
- `abilityFor` (weaponAttacks.ts) gets `pactWeapon`; options = normal ones + CHA, default highest (tie: STR, DEX, CHA order); breakdown "charisma modifier (Pact of the Blade)". Stored pick outside options ignored. Unknown CHA drops the option only. `attackAbility` accepts 'charisma', schema 69 + tag-only migration.
- Tests: 6 unit (Hexadin Longsword +8 CHA / +7 STR), e2e `pactWeapon.spec.ts` PC-1 a+b, c.
- Subagent: opus, implementation. Decisions in code: schema bump (validator would reject 'charisma'); a Monk weapon that is the pact weapon now gets a STR/DEX/CHA selector.
- Question: a Warlock-only character is not proficient with a martial pact weapon on the sheet (XPHB: "you have proficiency with it while you wield it" is not modelled). At the table: a pure Warlock with a pact Longsword shows +4 instead of +7. Options: a) new task to grant proficiency for the pact weapon, b) leave it.

## LH-1 - Lay on Hands pool (D418, f9d7925)
- New hand table `MULTIPLE_OF_CLASS_LEVEL` in resources.ts (Lay on Hands, Paladin, x5), gated on the text "five times your Paladin level"; counts Paladin level only (P7/W5 = 35). Existing Actions row, Features counter and Long Rest reset; no UI change. STOP check: no `consumes`/column source exists.
- Tests: 3 unit; e2e `layOnHands.spec.ts` a (5 boxes), a2 (0 / 35 in Actions and Features & Traits), b/c (3 / 35, Short Rest keeps, Long Rest resets).
- Subagents: sonnet implementation; one sonnet fix subagent because the Features tab was not asserted (no code change needed).
- Questions: none.

## FS-1 - Blessed Warrior / Druidic Warrior (D419, 98dc0fc)
- Storage per D318 (`fightingStyles[]`, one per class). Picker reads the class's `featProgression` "Fighting Style" categories from classes.json (Paladin FS+FS:P, Ranger FS+FS:R, Fighter FS; no row = FS). Cantrip sub-picker (existing `FilterChoiceSpellSubPicker`) in wizard, level up, Edit; stored as `fightingStyles[].filterChoiceSpells` (schema 70); Spells tab uses the feat's ability (CHA / WIS). Features tab, pick sources, Manage Feats resolve FS:P/FS:R. DATA.md "Feat categories" updated.
- Tests: new `fightingStyleData.test.ts`, wizardState and migration tests; e2e `fightingStyleClassFeats.spec.ts` a (Fighter lacks warriors), a+b (Paladin level up, Guidance + Sacred Flame, DC 13 = CHA), c (Ranger Edit, Druidic Warrior, Thorn Whip +5 = WIS).
- Subagent: opus implementation. It once ran `npx vitest` (rule slip, no prompt).
- Decisions in code: switching style clears the cantrips; cantrips cannot be edited from Manage Feats; candidates already known are greyed.
- Questions: none.

## WM-1 - part 1 (D420), STOP for A and B
- C: hand table `UNTAGGED_SINGLE_USE` (Hexblade's Curse, 1 use, Short Rest all, gated on its lowercase "short or long rest" sentence) + Actions row. D: `OPTIONAL_FEATURE_TEXT_SENSES` in grantedSenses.ts: "Devil's Sight: 120 ft." as its own sense, not darkvision. DATA.md: untagged recharges and text-only senses; Signature Spells' limit sentence matches no pattern today.
- Tests: unit (resources, grantedSenses; data-wide guard 108/78 -> 109/79); e2e `hexbladeDevilsSight.spec.ts` c, d.
- STOP: A + B counted at 30+ places (field + schema 71, migration, validate, characterStore x3, wizardState ~9, CharacterWizard x3, new picker, levelGains, levelRemoval, Spells tab rows, Signature use boxes + Short Rest, e2e). Proposed split: WM-1b = field, schema 71, picker in level up/Edit, Spells tab "at will"/"1 free cast", e2e a; WM-1c = Signature Spells use boxes, Short Rest restore, Remove level drops picks, e2e b.
- Subagent: opus implementation.
- Question: Spell Mastery and Signature Spells are still only text on the sheet; a Wizard 18/20 player has to track them by hand. Options: a) schedule WM-1b and WM-1c as proposed, b) one bigger task, c) wait for the spellbook (the pick source would change then anyway).

## Manual browser check for the user
Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Actions tab (pact weapon "Attack with" selector with CHA, Lay on Hands counter, Hexblade's Curse box); Features & Traits (Lay on Hands counter, Hexblade's Curse); wizard / level up / Edit Class step (Fighting Style list with Blessed/Druidic Warrior and cantrip sub-picker); Spells tab (fighting-style cantrips); Senses (Devil's Sight 120 ft.).
