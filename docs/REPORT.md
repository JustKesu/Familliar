# REPORT — M5b follow-up: pact row for spells without a slot of their level (D327)

## Changed
- `spellsTabData.ts` (`spellsTabActionSections`): after the D207 upcast loop, a CAST spell below the pact level with
  no pool at its own level (`poolsAt(detail.level)` empty) and empty `entriesHigherLevel` gets one badged row
  `#cast@<pact level>` in the pact section, `pools: ['pact']`. Skipped when inPact (D189), `unavailable` (D325), or when
  `entriesHigherLevel` is non-empty (D207's loop already adds the pact row, so no duplicate). Own-section disabled CAST
  unchanged.
- Docs: D327 added (D326 untouched); STATUS.md M5b entry extended.

## Verified
- typecheck, test (168 files / 3106), validate-data (175/175), e2e 449 passed (4.5 min — over the ~3 min budget).
- Unit `spellsTabData.test.ts` "D327: Warlock 5 / Sorcerer 1 …": Misty Step → own 2nd row with no pool + `@3` pact row
  badge 2; Shield (has a 1st slot) no pact row; Burning Hands keeps the single D207 `@3` row.
- E2E `multiclassCast.spec.ts` M5b e: 3rd Level section has one Misty Step row with badge "2nd"; its CAST spends one
  Pact Magic box.

## Decisions taken / for the user
- The pact row offers only the pact pool even if the pact level also had ordinary slots (unreachable: then the spell
  would need no slot at its own level while the pact level has ordinary slots, which a combined table never gives).

## Manual browser check for the user
On https://familliar.vercel.app, a Warlock 3 / Sorcerer 3 character, Spells tab:
- 2nd Level section: Slot and Pact buttons side by side fit the first column, readable, not clipped; heading still shows
  ordinary boxes + PACT boxes.
- Burning Hands upcast row in 2nd Level: "1st" badge alignment next to the two buttons.
- Disabled Pact button look (and tooltip on hover).
- At 1366 and 1920 width, dark and light theme, and phone width (table scrolls horizontally).

A Warlock 5 / Sorcerer 1 with Misty Step, Spells tab:
- 3rd Level section: Misty Step row with the "2nd" badge sits with the other pact rows, badge aligned next to CAST.
