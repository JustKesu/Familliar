# REPORT — GN-1: Genie kind choice and expanded spells (D407)

Setup: fetch + `merge --ff-only origin/main` → HEAD 4cb8912. Bash classifier gave transient "no verdict" errors on several setup calls; each retried and succeeded. No subagent used.

## STEP 1 — how `elegantCourtierSave` is wired (Genie mirrors each)

| Layer | Place | Genie counterpart |
|---|---|---|
| type/field | `storage/character.ts` (`ElegantCourtierSave`, `Character.elegantCourtierSave`, schema comment) | `GENIE_KINDS`, `GenieKind`, `Character.genieKind`, schema 68 |
| migration | `storage/migrations.ts` 60→61 tag-only | 67→68 tag-only |
| validate | `storage/validate.ts` describe + toCharacter | same, rejects unknown kind |
| store | `storage/characterStore.ts` input type, destructure, build | same |
| wizard state | `wizardState.ts` WizardData, initial, fromCharacter, action, reducer, save (`hasElegantCourtier`) | same + `setSubclass` clears when Warlock leaves The Genie; save keeps only with `hasGenie` |
| step gate | `wizardState.ts` `elegantCourtierComplete` condition (languages step) | `genieKindComplete` |
| wizard UI | `CharacterWizard.tsx` `courtierOffered`, condition, `<ElegantCourtierChoice>` | `genieOffered` (level up: only when `held.subclass === null`), `<GenieKindChoice>` (`src/genie/`) |
| level up | `levelUp/levelGains.ts` part on the languages step | Warlock XPHB subclass-level pending owing `The Genie` → languages step walked only if Genie chosen |
| removal | `levelUp/levelRemoval.ts` drop + dropped line | "Genie kind: X" when the subclass goes |
| consumer | `calculation/savingThrows.ts` | `subclassPreparedSpells.ts` (`chosenEntryName`), `CharacterSheet.tsx` (load arg + note) |

~22 places, under the 25 limit.

## What changed
- `extractSubclassAlwaysPreparedSpells`/`loadSubclassAlwaysPreparedSpells`: new last arg `chosenEntryName`; rank grants read a multi-entry subclass's entry only when its `name` equals it. `"9"` was already not a rank key → Wish never granted.
- Wizard (Proficiencies step, next to Elegant Courtier), level up at Warlock 3 and Edit Character show a "Genie Kind (The Genie)" radio group; Next waits for it while offered.
- Sheet Spells tab: "Genie kind not chosen yet — choose it in Edit Character." when The Genie has no kind.
- Docs: D407; DATA.md Genie shape + `"9"` key; STATUS.md; QUESTIONS.md — removed "Warlock The Genie — deferred" and the stale species class-list cantrip item (built in S2: D278–D280, `Character.speciesCantrip`, `SpeciesCantripPicker.tsx`).

## Verified
- typecheck, `npm test` (190 files / 3481 tests), validate-data (177/177): pass.
- Unit: Genie fixture rewritten to the real shape; Efreeti @5 = Burning Hands, Scorching Ray, Fireball + Detect Evil and Good, Phantasmal Force, Create Food and Water, nothing of Dao/Djinni/Marid; no Wish 1–20 for any kind; no kind → none. Migration 67→68, removal at Warlock 3/4.
- e2e `e2e/genieKind.spec.ts`: a+b wizard Djinni → Thunderwave, Edit → Marid → Fog Cloud, no Thunderwave; c schema-67 seed note, no Genie spells; d Warlock 17 Efreeti: Flame Strike, no Wish; e level up 2→3 asks on Proficiencies, Efreeti → Burning Hands; f Remove level 3 lists and drops the kind. `levelOrder.spec.ts`, `stableIds.spec.ts` → 68.
- Full e2e: 743 passed in 6.6 min (over the ~3 min target).

## Decisions taken / questions noticed
- The prompt says "class-options step"; the courtier pattern it also names lives on the Proficiencies step, and Class options is not walked by a Warlock 2→3 level up. Placed on Proficiencies. Say if it should move.
- The pick is required (blocks Next) wherever offered, like Elegant Courtier; an old Genie character must choose it to save an Edit.
- STATUS.md said Storm Herald/Divine Soul pickers were in QUESTIONS.md; they are not. Line reworded, no QUESTIONS.md change.

## Changed screens
Wizard / level up / Edit: Proficiencies step (new Genie Kind group). Sheet: Spells tab (not-chosen note; Genie spells listed). Remove level dialog (new line).

## Manual browser check for the user
None — the planning chat checks the looks from screenshots.
