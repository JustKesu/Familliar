# REPORT — SR-1: spell ref aliases (D406)

Setup: `git fetch origin`, `git merge --ff-only origin/main` → already up to date, HEAD eb50a41.

## What changed
- `src/spells/subclassPreparedSpells.ts`: `findSpell` = exact lookup (`findSpellExact`), then fallback to
  `SPELL_REF_ALIASES` (D406): "branding smite" (any source) → Shining Smite|XPHB, "summon elemental" + TCE →
  Summon Elemental|XPHB. Returned spell is the XPHB record (its own name/source). Applies to every caller
  (races, feats, optional features, subclasses). Module comment "Two of 406 string references…" updated.
- `src/spells/subclassPreparedSpells.test.ts`: fixture's fake "Branding Smite|XPHB" spell replaced by Shining Smite|XPHB
  (the old fixture made the Hexblade test pass on a spell that does not exist in data/); Summon Elemental|XPHB added;
  Fathomless fixture gains `s4: ['summon elemental|tce', 'no such spell']`. New tests: Hexblade rank 2 → Shining Smite|XPHB;
  Fathomless at level 9 → Summon Elemental|XPHB and the unknown ref skipped (exact name list).
- `e2e/spellAliases.spec.ts` (new): Warlock 9, schema 67, subclass The Hexblade / The Fathomless; Spells tab shows
  Shining Smite / Summon Elemental. Neither spell is on the Warlock list, so the assertion cannot pass without the alias.
- Docs: D406 added (DECISIONS.md), QUESTIONS.md item "Two spells referenced but absent from the data" removed,
  DATA.md section "Only two additionalSpells refs do not resolve", STATUS.md SR-1 entry.

## Verified
- `npm run typecheck` clean; `npm test` 190 files / 3476 tests pass; `npm run validate-data` 177/177;
  `npm run e2e` 738 passed (2.5 min), including spellAliases a–b.

## Decisions / questions
- Fixture Summon Elemental placed at `s4` (its real spell level 4) and tested at character level 9 (pact rank 5),
  as the prompt asked "rank 5". Internal to the test.
- Data was not re-surveyed; the two refs come from the planning chat's summary, recorded in DATA.md as such.

## Subagents
None used.

## Changed screens
None beyond the two spells now appearing on the Spells tab for Hexblade / Fathomless warlocks.

## Manual browser check for the user
None — the planning chat checks the looks from screenshots.
