# Report

## What changed

Added a new weapon mastery picker under `src/masteries/` (a new folder — no
other picker, the wizard, or any other part of `src/` was touched):

- `masteryData.ts` — reads how many weapon masteries a class may choose at a
  given level, and which weapons it can choose from.
- `MasteryPicker.tsx` — the picker component. It shows the player's
  remaining picks, prevents picking more than allowed, and displays what
  each weapon's mastery property actually does so the player doesn't have
  to look it up. It does not remember its own selection — like the other
  pickers in this project, it only displays what it's told and reports
  changes upward, so a selection survives the player navigating elsewhere
  in the wizard and back.
- `MasteryPicker.test.tsx` — automated tests covering the two known classes
  at different levels, a class with no mastery, the pick limit, and that
  the picker always shows whatever selection it's given.

This picker is not connected to the character creation wizard yet — that's
a separate task, same as the fighting style and class skill pickers before
it.

## What was verified

- A check of the game data confirmed only two classes (Barbarian, Fighter)
  have a table stating how many masteries they get per level — matching
  what an earlier session had found.
- Type checking passed with no errors.
- The full automated test suite passed: 232 tests across 18 files,
  including the 5 new tests for this picker.
- The mastery counts the picker reads were spot-checked against the real
  data: Fighter goes from 3 to 6 across levels, Barbarian from 2 to 4,
  and a class with no mastery (checked with Wizard) correctly shows nothing.

## What needs my decision

- **Three more classes turned out to grant Weapon Mastery, but this picker
  doesn't support them.** The investigation step (required by this task)
  found that "Weapon Mastery" is actually a class feature on five classes:
  Barbarian, Fighter, Paladin, Ranger, and Rogue — not just the two known
  from before. Only Barbarian and Fighter state their count in a data
  table; Paladin, Ranger, and Rogue state it only in the feature's
  descriptive text, which this task was not scoped to parse. I asked you
  how to handle this, and you chose: build only for Barbarian and Fighter,
  leave Paladin/Ranger/Rogue unsupported (the picker will show nothing for
  them) rather than guessing or hardcoding their counts. This is a known
  gap, not a bug — someone should decide, in `docs/QUESTIONS.md`, whether
  and how to add those three classes later (parsing prose vs. hand-mapping
  fixed values).
- **Mastery rule text (what Cleave, Sap, Topple, etc. actually do) is
  hardcoded, not read from data.** `data/items.json` has the resolved
  mastery *name* for each weapon but not the rule text describing what it
  does. That text does exist in the original source files
  (`data-source/`), but pulling it into `data/` would mean changing the
  extraction script, which this task wasn't scoped to do. I hardcoded the
  eight rule descriptions directly in `masteryData.ts` instead, the same
  way this project already hardcodes the armour Dex-cap rule. If the
  extraction script is ever extended to include this text, the hardcoded
  copy in `masteryData.ts` should be replaced with real data instead.

## STATUS.md changes needed

(Not applied — a parallel session owns STATUS.md this session. Whoever
updates it next should add:)

- New: `src/masteries/` — a weapon mastery picker (`MasteryPicker.tsx`,
  `masteryData.ts`), covering Barbarian and Fighter only. Not wired into
  the character creation wizard.
- Known gap: Paladin, Ranger, and Rogue also grant Weapon Mastery but are
  unsupported — their per-level count is stated only in feature prose, not
  a data table.

## Commit status

Changes are committed locally but **not pushed** — this session was told
other parallel sessions share this branch, so the push is waiting on you
or a coordinating session.
