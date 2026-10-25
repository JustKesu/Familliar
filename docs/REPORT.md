# REPORT — IB-1 item spell bonus per class (D403)

Setup: `git fetch origin`, `git merge --ff-only origin/main` → "Already up to date", HEAD f12d45e.

## Changed places (STEP 1: 6 code/test files + 4 docs)
- `src/calculation/types.ts`: `Contribution.onlyForClasses?: readonly string[]`.
- `src/calculation/itemFlatBonuses.ts`: `ItemFlatBonusGrant.onlyForClasses`; `flatBonusContributions` copies it onto applied and withheld (not-attuned) lines.
- `src/sheet/itemFlatBonusData.ts`: exported `CLASS_LIMITED_SPELL_BONUS` (19 exact names: +1/+2/+3 All-Purpose Tool, Arcane Grimoire, Bloodwell Vial, Moon Sickle, Rhythm-Maker's Drum, Rod of the Pact Keeper; Reveler's Concertina has no +N variants and only `bonusSpellSaveDc`); attached to spellAttack/spellSaveDc grants only.
- `src/calculation/spellcasting.ts`: `computeAbilitySpellcasting` gets trailing `className?`; item lines with `onlyForClasses` kept only when it includes `className`. `computeSpellcasting` passes the class name; feat, species and item callers (incl. `CharacterSheet.tsx` 2468/2473) pass none, so they get no limited line. CharacterSheet.tsx not edited. Slice-h comment updated.
- `src/sheet/itemFlatBonusData.test.ts`: old "+2 Rod on a Wizard" test switched to Robe of the Archmagi (unchanged behaviour); new D403 block.
- `e2e/itemSpellBonusClass.spec.ts` (new).
- Docs: D403 (Czech, table of 7) in DECISIONS.md; QUESTIONS entry "Bonus ke kouzlům se přičítá všem kouzlům…" removed; STATUS.md IB-1 line.

All 7 item names confirmed in items.json via `scripts/ib1-names.js` (untracked investigation script, not committed and not cleared — this task's prompt forbids `git clean`).

## Verified
- `npm run typecheck` clean; `npm run test` 190 files / 3471 passed; `npm run validate-data` 177/177; `npm run e2e` 729 passed (2.6 min).
- Unit (`itemFlatBonusData.test.ts` "D403"): table size/contents; Warlock/Wizard +2 Rod → Warlock 7/15 with named line, Wizard 6/14 without line; unattuned Rod → withheld line on Warlock only; classless `computeAbilitySpellcasting` keeps Robe, drops Rod.
- E2E `e2e/itemSpellBonusClass.spec.ts`: a) Warlock/Wizard + Rod: Warlock +6/14 (dialog names the Rod), Wizard +4/12 (dialog without it); b) Grimoire: Wizard +5/13, Warlock +5/13; c) Druid 2 + Moon Sickle +4/12; d) Wizard 2 + Robe +6/14; e) Warlock 2 + Rod + Magic Initiate (Cleric, WIS): Warlock +6, Magic Initiate +3/DC 11.

## Decisions taken in code
- Restriction carried on the breakdown line (`onlyForClasses`) and filtered in the one shared function, rather than passing separate per-class lists from CharacterSheet.
- Class match is by `className` only (any classSource), so XPHB and older class versions both qualify.
- A class not named gets no withheld "not attuned" line either (rule 3).

## Notes
- Single-initiate feat card is titled "Magic Initiate", not "Magic Initiate (Cleric)" (that suffix appears only with two initiates, F-7b g).
- No subagent used.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Spells tab spellcasting cards (Spell Attack / Save DC numbers and their breakdown dialogs) for characters with one of the 7 items.
