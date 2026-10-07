# Review — M5 to M7 multiclass spells, level up and new class, `888f576..7fedca6`

Scope: `86d0e59` (M5a, D325), `2cad8c9` + `ac39cf4` (M5b, D326/D327), `06db67d` (M6, D328), `1e6bc6a` (M7a, D329),
`33281fc` + `7fedca6` (M7b, D330). HEAD has one commit beyond the range, `0bfb23b`, the first version of this report;
this is a second pass over the same range that re-checked every finding of the first and covered most of its
"Not reviewed" list. Read as diffs or by offset: SpellList.tsx `combineSpellEntries`, classSpellLimits.ts,
spellActionRowData.ts `casterFor`, spellsTabData.ts pools, the CharacterSheet spell/CAST hunks, levelGains.ts (languages,
class, spells steps), levelRemoval.ts, levelUpSteps.ts, featAsiCharacterLevels.ts, featAsiLevels.ts
(`abilityScoresBelowLevel`), characterLevel.ts, LevelUpButton, LevelUpClassDialog, LevelUpWizardGate, route.ts,
heldPicks.ts, multiclassLevelUp.ts, multiclassPrerequisites.ts, multiclassPicks.ts, classProficiencies.ts,
proficiencies.ts (tool section), savingThrows.ts, subclassSkillGrants.ts, skills.ts, mastery/expertise pickers, storage
(character.ts, characterStore.ts, migrations.ts 59→60, validate.ts). wizardState.ts and CharacterWizard.tsx by offset
(`saveCharacter`, `wizardToolGrants`, class-skill labels). Grepped: `classes[0]`, `classes.length`, `firstClass(`,
`grantedAtLevel`, Breath Weapon, `optionOrigin`, e2e test names and seeds. Nothing ran except git. Rules checked against
the 2024 PHB multiclassing text: 13 in the primary ability of the new and every held class, spells prepared per class
as if single-classed, any slot (ordinary or pact) may cast any class's spell, a later class gets only
`proficienciesGained` (no saves, no starting equipment), HP die of the class taking the level, ASI by class level,
Breath Weapon by character level.

## Findings

1. **Bug (reachable now).** `src/calculation/proficiencies.ts:179-180, :290`, `src/sheet/ManageFeatsPanel.tsx:81`. A
   subclass tool pick is read only for `firstClass(character)`. The wizard side is correct (`wizardToolGrants` reads the
   raised class at its class level; `saveCharacter` keeps the pick in `toolChoices`). Example: Wizard 5 / Fighter 2
   (levelOrder starts Wizard) raises Fighter to 3 and takes Battle Master. The Languages step asks for the Student of
   War artisan's tool and stores it, but the Proficiencies card shows neither the tool nor a pending line, and Manage
   Feats' held tools miss it, so a feat can offer the same tool again. Data is not lost.
   Fix: run the subclass-grant loop (`:290`) over every class with its own subclass; keep the starting-tool block
   (`:185`) on the first class only. Test: unit `computeProficiencies` with a second-class Battle Master; e2e
   Wizard → Fighter 3 Battle Master, tool on Proficiencies.

2. **Wrong number (reachable now).** `src/sheet/spellActionRowData.ts:116-122, :135`. A spell always prepared by two
   subclasses of different classes has two `subclassOwners`, `own.length === 2`, and the row falls through to "could
   belong to more than one casting class … multiclass is build order step 10": no DC, no attack. Example: Cleric 3
   (Light Domain) / Warlock 3 (Fiend Patron), both always-prepare Burning Hands; the row has no save DC on Spells or
   Actions. The message also cites a build step that is now live. Fix: give each owner its own row (as D325 does for
   two choosers), or pick the owner whose ability gives the higher DC; needs question 1. Test: unit `casterFor` with
   two subclass owners; e2e Cleric 3 Light / Warlock 3 Fiend, Burning Hands shows a DC.

3. **Wrong number (reachable now, known point a).** `src/sheet/SpellList.tsx:166-193`,
   `src/sheet/spellActionRowData.ts:108-114`. A spell chosen by class A and always prepared by class B (subclass, or
   class list such as Druid's Speak with Animals) is one row cast with A's numbers and counted against A's limit.
   Example: Wizard 3 / Cleric 3 (Light Domain), Wizard picks Burning Hands: INT DC shown, the WIS copy that is prepared
   anyway is unreachable, and the pick uses up a Wizard slot. Fix: the grant gets its own `rowKey` row with the owner,
   as a second chooser already does; or warn on the pick that another class already has it prepared. Test:
   `combineSpellEntries` unit, chosen by Wizard plus Light Domain grant, two rows with INT and WIS DCs. See question 1.

4. **Latent (M8).** `src/storage/validate.ts:254-268`; `src/storage/characterStore.ts:364`; read repair in
   validate.ts. A `multiclassPicks` entry naming a class the character no longer has blocks the whole write, and read
   repair drops the WHOLE list, not only that entry. Unreachable today: `levelRemovalCore` refuses to remove a class's
   last level. M8 must filter the removed class's picks; read repair should drop only stale entries. Validation also
   accepts a pick tagged with the first class (which never gets picks) and duplicates (import only). Test: unit
   removing Rogue 1 from Fighter 4 / Rogue 1, Rogue pick gone, Fighter records kept.

5. **Latent.** `src/levelUp/LevelUpButton.tsx:52-60`. All held classes' gains load in one `Promise.all`. One rejected
   load, or every held class unresolved, turns the whole button unavailable, so "+ New class…" cannot be reached either
   (a new class does not depend on the held classes' gains). Fix: `allSettled`, and keep the dialog reachable whenever
   a new class may remain. Test: LevelUpButton unit with one `loadGains` rejecting.

6. **Wrong choice offered (reachable now, known point f).** `src/creation/wizardState.ts:369-372` and the
   MulticlassPickSlots pool. The Bard multiclass instrument excludes the background tool and stored `toolChoices`, not
   feat or item tools. Example: Entertainer Fighter with Musician (three instruments) enters Bard and is offered the
   same three instruments; a duplicate is a wasted proficiency. Fix: add `featInstances` tool grants to the held list.
   Test: unit of the pick pool with Musician.

7. **Cosmetic (reachable now).** `src/sheet/CharacterSheet.tsx:2423, :2432`; `src/sheet/featuresTabData.ts:108`.
   Traced: `optionOrigin` returns null for 2+ classes, so chosen optional features (invocations, maneuvers, fighting
   style) on Actions and Features lose their class/subclass label; class features lose "From <class> n". Labels only:
   row keys and resources use name/source. Fix: resolve the owner from the option's stored `className` (fighting
   styles, D328) or the class whose progression offers it. Test: e2e Warlock 6 / Sorcerer 3, invocation row labelled
   Warlock.

8. **Test gap.** The specs cover the happy path of each slice with seeds the app can now produce (schema 59/60, a
   consistent levelOrder, per-class `spellChoices`; schema 59 seeds migrate to 60 by a tag only). Missing:
   - a non-first class with a subclass tool on the sheet (finding 1);
   - two subclass owners, and chosen + granted overlap (findings 2, 3);
   - a raised class with subclass optional features next to another class's (Battle Master maneuvers beside Warlock
     invocations), the `activeFeatureTypes` partition;
   - CAST disabled on an `unavailable` row (only the "unavailable" label is asserted in M5a c);
   - entering a martial class while already holding masteries (offset path `CharacterWizard.tsx:648, :681`);
   - LevelUpButton with a failing load (finding 5).

## Checked, no finding

- `classSpellLimits`: each class is capped and counted from its own table against its own picks; `chosenSpellCap`
  keeps the D106 single-class reading. A second chooser gets a pick-only row with its own numbers.
- `castSpell` spends only the pool its button names; upcast rows reach the pact section; the D327 pact row appears only
  when the spell has no slot of its own level.
- `levelGainsFor`: character vs class level correct on every step; the languages step reads the target class only, a
  new class gets only subclass tool grants plus the `proficienciesGained` picks; spell counts sum the target class
  only; `featAsiCharacterLevels` maps class-level grants onto levelOrder.
- `grantedAtLevel` of class-feature choices and subclass spell picks comes from the data's feature level, i.e. a class
  level, as `levelRemovalCore` (`ofClass` + class level) expects.
- `saveCharacter`: `checkOneClassRaised`, `otherClassRecords`, new class appended last, `levelOrderBeforeLevelUp`
  rebuilds history only from a single class; the write error for an inconsistent multiclass levelOrder is in place.
- `classProficiencyGrants`: first class gives starting armor/weapons, later classes only fixed `proficienciesGained`
  plus the stored instrument; saves only from the first class (`savingThrows.ts:83`).
- Subclass skills (`subclassSkillGrantsFor`) and Unfettered Mind (`SUBCLASS_SAVE_GRANTS`) iterate every class.
- Migration 59→60 tags only; validator, `toCharacter`, writer and readers (skills.ts, classProficiencies.ts, Expertise
  via `multiclassSkillSources`, Review) agree.
- `CharacterWizard.tsx:1036`: the first class's name is only the label of disabled class skills, correct per D321.

## Known points

- a) Wrong number: findings 2 and 3. The disabled CAST on an unavailable row also for single-class: acceptable, an
  over-cap pick cannot legally be cast.
- b) Acceptable now. Removal works by character-level stamps; a gap only for M9 Edit, which must re-attribute.
- c) Latent, claim holds. `fightingStyleFor` (`character.ts:954`) falls back to a classless style, but migration 58
  tags single-class saves, new saves always write `className`, and an old multiclass save has no levelOrder so
  `levelUpClassOptions` blocks it. Only a hand-made import reaches the fallback.
- d) Acceptable. Class/Spells steps go unknown on an unreadable subclass; the others read static tables by name.
- e) Acceptable. `abilityScoresBelowLevel` runs on the stored character without the background origin-feat override;
  XPHB origin feats grant no scores.
- f) Wrong choice offered: finding 6.
- g) Acceptable (cosmetic). One sentence per class, new class first.
- h) Confirmed: `LevelUpWizardGate` checks `loadUnmetMulticlassPrerequisite` and calls `onUnavailable`.
- i) Wizard side works for any class. Sheet: subclass skills and Unfettered Mind work for any class; the subclass tool
  does not (finding 1).
- j) Correct: `CharacterSheet.tsx:3254` passes `totalCharacterLevel`; 2024 Breath Weapon scales with character level.

## Not reviewed

- MulticlassPickSlots.tsx UI details and index.css.
- Bodies of e2e specs beyond names and seeds; bodies of `levelGains.test.ts`, `levelRemoval.test.tsx`,
  `multiclassEntry.test.ts`.

## Questions for the user

1. A spell held through two classes (findings 2 and 3): two rows, one per class, or one row with one class's numbers?
   Recommendation: one row per class, as D325 already does for two choosers; RAW lets the player cast it as either
   class. For finding 3 also show a notice on the pick that the other class already has it prepared.
