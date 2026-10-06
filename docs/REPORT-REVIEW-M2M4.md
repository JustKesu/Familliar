# Review — M2/M3/M4 multiclass saves, slots and hit points, `e061dfb..9cba183`

Scope: `841a1b5` (M2, D321), `ecca051` (M3, D322), `9cba183` (M4, D323) on main — characterLevel.ts `firstClass`,
classProficiencies.ts, proficiencies.ts, savingThrows.ts, weaponProficiency.ts, spellSlots.ts
`characterSpellSlotMaxima`, maxHitPoints.ts `hitDiePerLevel`, HitPointsPicker/HitPointLevelRow, levelRemoval.ts,
the CharacterSheet and ManageFeatsPanel hunks, the three new e2e specs, unit test names of the changed modules, and
the DATA.md notes. Remaining `classes[0]` / `classes.length` readers in `src/` were grepped and classified. Nothing
ran except git. No rule error found against the 2024 PHB on the data shapes DATA.md records: saves from the first
class only, `proficienciesGained` fixed parts for later classes, caster level full ×1 / Paladin-Ranger-Artificer ½
up / EK-AT ⅓ down / Warlock excluded / combined table only with 2+ Spellcasting classes, level 1 = first class die
maximum, later levels = that level's class average or stored value, CON × total level. All findings are latent
(behind D316) or test gaps.

## Findings

1. **Data loss (latent, M6/M7).** `src/levelUp/levelRemoval.ts:86, :186, :195`; `src/creation/wizardState.ts:1459`;
   `src/storage/characterStore.ts:397`. Remove level reduces `classes[0]` and slices the last `levelOrder` entry;
   level up appends `classes[0]`. Both are correct only for one class. Once D316 lifts, removing a level from a
   Wizard 1 / Fighter 2 stored as `classes: [Fighter, Wizard]`, `levelOrder: [Wizard, Fighter, Fighter]` lowers
   Fighter and drops the last Fighter — fine by luck — but `classes: [Wizard, Fighter]` lowers Wizard to 0 while
   `levelOrder` loses a Fighter. `characterStore.ts:397` then silently drops the inconsistent `levelOrder` on write,
   and `hitDiePerLevel` turns max HP into "Cannot tell which class…" with no error at save time.
   Fix (M6): remove/add the level of `levelOrder.at(-1)` / the chosen class, and make an inconsistent `levelOrder` on
   a multiclass write an error rather than a silent drop. Test: a levelRemoval/wizardState unit test with a
   two-class character whose `classes` order differs from `levelOrder` order.

2. **Wrong number (latent, M7).** `src/featAsi/featAsiLevels.ts:51-63`, `src/masteries/masteryData.ts:194`. The
   wizard/level-up feat step builds the prerequisite context from ONE class's starting armor/weapons
   (`loadClassPrereqInfo(className)`), and the mastery pool from one class's starting weapons. ManageFeatsPanel now
   uses `classProficiencyGrants` (D321), so the same character would see different feat eligibility in Manage Feats
   vs a level-up feat step: Wizard 3 / Fighter 1 (Wizard first) levelling Wizard to 4 gets a context of Wizard
   starting proficiencies only, so Heavily Armored (needs medium armor) is blocked in the step but allowed in
   Manage Feats. Fix: pass the character into `loadFeatAsiStepData` and read
   `classProficiencyGrants`; same for the mastery pool. Test: none today (multiclass level up blocked).

3. **Cosmetic.** `src/sheet/ManageFeatsPanel.tsx:258` still passes `character.classes[0]?.subclass` to
   `toolsHeldElsewhere`, while M2 changed the sheet's tool slots to `firstClass` (`CharacterSheet.tsx:3635`) and
   `computeProficiencies` to `startingClasses`. Example: `classes: [Artificer (Alchemist), Fighter (Battle Master)]`,
   `levelOrder` starting Fighter — the panel excludes Alchemist tools, the sheet excludes Battle Master tools, so the
   held-tool list for a feat tool pick differs from the Proficiencies card. Fix: `firstClass(character)?.subclass`.
   Test: no.

4. **Missing (low).** `src/sheet/CharacterSheet.tsx:2563-2564`. When `characterSpellSlotMaxima` is `unknown` (new
   case: no Wizard XPHB row for the caster level; old case: a class missing from slot data) the sheet silently shows
   zero slots; the reason is never displayed, unlike max HP. Fix: show the reason in the Spell Slots drawer/card.
   Test: a sheet unit test with slot data lacking Wizard XPHB.

5. **Missing (M5 friction).** `src/sheet/CharacterSheet.tsx:2565`. Pact slot level is computed in the sheet from
   `spellSlotsEntries`, not returned by `CharacterSpellSlotMaxima` (`spellSlots.ts:176-183`), so the "one function for
   every reader" of D322 covers counts but not the pact level. M5's upcast-into-pact and CAST pool choice will need
   it in the same place as `pact`. Fix: add `pactSlotLevel` to `CharacterSpellSlotMaxima`. Test: unit on maxima.

6. **Cosmetic.** `e2e/multiclassSlots.spec.ts:9` comment "Multiclass max HP is not computed yet" is stale after M4
   (it is, from `levelOrder`, which the seed carries). The `maxHpOverride: 40` now only masks M4 in this spec.
   Fix: drop the comment and override. Test: n/a.

7. **Test gap.** The Spell Slots drawer's "Multiclass Spellcaster (caster level N)" section and the hiding of
   per-class ordinary sections (`CharacterSheet.tsx:3404-3418`) are not checked by any unit or e2e test (grep of
   CharacterSheet.test.tsx and e2e/ finds no "Multiclass Spellcaster"); M3 e2e only counts slot boxes.

8. **Test gap.** `characterSpellSlotMaxima` tests (`spellSlots.test.ts:177-271`) use a 6-row fake table. Untested:
   Warlock + two Spellcasting classes (combined ordinary AND pact together), Arcane Trickster, three classes, the
   `unknown` branch. The claim "Wizard XPHB rowsSpellProgression = multiclass table" (DATA.md) rests on a consumed
   script; no validate-data guard pins it (suggest rows 1, 5, 19, 20 in `validate-data`).

9. **Test gap.** ManageFeatsPanel prerequisite context from `classProficiencyGrants` (D321 claims it) has no test
   (0 multiclass matches in ManageFeatsPanel tests). Example to pin: Wizard 1 / Fighter 1 qualifies for Heavily
   Armored (needs medium armor) only via "Fighter (multiclass)".

## Checked, no finding

- `firstClass`: `levelOrder[0]` matched by name+source, fallback `classes[0]`; same rule as `hitDiePerLevel`'s
  level 1. An inconsistent `levelOrder` cannot reach readers: validate.ts:1367 strips it on read, store:397 on write.
- Saves: only first class's proficiencies; class-feature saves (Disciplined Survivor, Slippery Mind) and Unfettered
  Mind still read any class (correct). Later class missing from save data no longer makes saves unknown (fine).
- `classProficiencyGrants`: first class starting armor/weapons, later classes only `armor`/`weapons`
  simple|martial/`toolProficiencies` true entries; Bard's numeric choice skipped (deferred, D321). Card, attack
  rolls (`weaponProficiency.ts:177`) and Manage Feats share it.
- Caster level arithmetic and the "non-zero own row = Spellcasting class" test: Paladin/Ranger XPHB and Artificer
  EFA have slots at 1, EK/AT at 3; Fighter without EK and Warlock contribute nothing. Shared `spentSpellSlots.ordinary`
  pool matches the rule. levelRemoval clamps against the same `characterSpellSlotMaxima` as the sheet.
- Spell data loaded in the sheet is the full class list (`loadSpellSlotsClassData()`), so Wizard XPHB is always
  present for the combined row.
- HP: Warlock 6 / Sorcerer 3, CON +1 = 8 + 5×5 + 3×4 + 9 = 54 (e2e M4 a). D43 cannot-roll note uses that level's die;
  Draconic Resilience on Sorcerer level. Picker and sheet both use `hitDiePerLevel` + `computeMaxHitPoints`;
  "Apply average to all" uses each level's own die and is hidden in level-up; level-up hides the Level 1 row.
- Single class: `hitDiePerLevel` ignores `levelOrder`; single class without `levelOrder` still computes.
- Remaining `classes[0]` readers (levelGains, heldPicks, wizardState:584/1241/1307, CharacterWizard:298/1160,
  levelRemoval) are behind D316 guards (`levelGains.ts:271`, `levelRemoval.ts:27`) or single-class by D323.

## Not reviewed

- Full CharacterSheet.test.tsx, savingThrows.test.ts and classProficiencies.test.ts bodies (names only).
- `extractSpellSlotsClassData` / `findSubclassSpellSlotsData` internals; token format parity between
  `startingProficiencies.armor` and `proficienciesGained.armor` (assumed equal; e2e M2 b shows "Shields").
- wizardState/CharacterWizard beyond the anchors above; validate.ts and migrations (covered by the M1 review).
- e2e/wizardW6.spec.ts change and HitPointsPicker.test.tsx bodies.
