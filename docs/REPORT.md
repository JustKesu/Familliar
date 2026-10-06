# REPORT — M5b (step 10): CAST pool choice and pact upcast (D326)

## Changed
- `spellsTabData.ts`: `SpellRowAction` cast = `{ kind: 'cast'; pools: CastPool[] }`, pools from the row's section
  (`poolsAt`: ordinary if `ordinarySlots[L-1] > 0`, pact if `pact.slotLevel === L`). D207 upcast loop now targets every
  higher level with any pool, so a pact section above the ordinary levels gets badged upcast rows too; when the pact
  level also has ordinary slots the existing ordinary upcast row simply carries both pools (no duplicate row).
  Pact-only path (D189) untouched. `CAST_POOL_NAME`, `CAST_POOL_EMPTY` exported.
- `CharacterSheet.tsx`: `SpellTabRow` takes `ordinaryLeft` / `pactLeft` (was `slotsLeft`); two pools → "Slot" / "Pact"
  buttons ("Cast X with a spell slot" / "Cast X with a Pact Magic slot", disabled + `title` "No spell slots left" /
  "No Pact Magic slots left"); else one CAST as before. `castSpell(row, section, pool)` spends the named pool. An
  `unavailable` (D325) row's CAST/Slot/Pact is disabled (title "Unavailable at this level" on the pair).
- `index.css`: `.sheet__spell-cast-pair` (flex, 3px gap, tighter letter spacing inside the 72px column).
- Docs: D326 added; STATUS.md updated. QUESTIONS.md untouched — D326 resolves "CAST s oběma pooly slotů — běžný, nebo
  pact slot?" (status there still "nerozhodnuto").

## Step 1 inventory
No STOP condition: `pactSlots` is non-zero only where `pact.slotLevel === level`; pact upcast needs no class distinction
(all CAST spells below the pact level qualify), so `chosenBy` was not needed.

## Verified
- typecheck, test (168 files / 3105), validate-data (175/175), e2e 448 passed (4.5 min — over the ~3 min budget).
- Unit `spellsTabData.test.ts` "cast pools (D326)": both-pools section, pact upcast with and without ordinary slots at
  the pact level, single-pool unchanged. `CharacterSheet.test.tsx` both-pools test rewritten to Slot/Pact.
- E2E `multiclassCast.spec.ts` M5b a (Pact/Slot spend own pool), b (Pact disabled + title when spent, Slot works),
  c (Burning Hands "1st" upcast in 2nd with both buttons), d1/d2 (single-class Warlock / Sorcerer one CAST).

## Decisions taken / for the user
- Pact upcast rows keep D207's `entriesHigherLevel` filter. Consequence: Warlock 5 / Sorcerer 1 (pact 3rd, ordinary
  1st only) — a 2nd-level Warlock spell without higher-level text (Misty Step) sits in a slotless 2nd section with a
  disabled CAST and has no pact row. Rules allow casting it with a pact slot; dropping the filter for pact rows would fix
  it. Needs your call.
- Disabling CAST on `unavailable` rows also applies single-class; there such rows have no slots in their section, so no
  visible change.

## Manual browser check for the user
On https://familliar.vercel.app, a Warlock 3 / Sorcerer 3 character, Spells tab:
- 2nd Level section: Slot and Pact buttons side by side fit the first column, readable, not clipped; heading still shows
  ordinary boxes + PACT boxes.
- Burning Hands upcast row in 2nd Level: "1st" badge alignment next to the two buttons.
- Disabled Pact button look (and tooltip on hover).
- At 1366 and 1920 width, dark and light theme, and phone width (table scrolls horizontally).
