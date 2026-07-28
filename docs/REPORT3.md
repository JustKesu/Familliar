# Report

## What changed

Built a new fighting style picker, in its own new folder
(`src/fightingStyle/`). Nothing outside that folder was touched, and it is
not wired into the character creation wizard yet — that's a separate task,
same as the class skill picker before it.

- `fightingStyleData.ts` — looks up which classes grant a fighting style
  choice and at what level, by finding class features literally named
  "Fighting Style" in the game data (no hardcoded list of class names), and
  reads the ten selectable fighting styles from the feats data.
- `FightingStylePicker.tsx` — shows the choice to the player: nothing if
  their class doesn't grant one, or if they're not yet at the level it's
  granted. Each option's full rules text is shown through the existing
  markup renderer, so game syntax like `{@damage 1d8}` displays correctly
  instead of as raw text. It shows whatever selection it's given rather than
  remembering its own — the same pattern already used by the other pickers,
  so it won't lose the player's choice when they navigate the wizard.
- `FightingStylePicker.test.tsx` — covers a Fighter being offered a choice,
  a Wizard being offered nothing, a Paladin getting nothing at level 1 but
  a choice at level 2, changing the selection replacing rather than adding
  to it, and the component correctly displaying whatever value it's handed.
- `scripts/investigate-fighting-style.js` — one-off investigation script
  confirming the data shapes above before writing the real code, per the
  house rule against reading `data/` directly into context.

## What was verified

- `npm run typecheck` — clean.
- `npm test` — full suite, 227 tests across 17 files, all passing (5 new).

## What needs my decision

Nothing came up that isn't already settled. The three-class, feats.json-only
lookup was already confirmed in a prior investigation and in decision D12;
this task only built the picker against it.

## STATUS.md changes needed

(Not applied — a parallel session owns STATUS.md this round.)

- Add a bullet under "What exists": `Fighting style picker — src/fightingStyle/, standalone, not yet wired into the wizard.`
- Update "Next step" to mention fighting style is now built, alongside
  weapon masteries (still outstanding) and subclass/its choices, per D15.
