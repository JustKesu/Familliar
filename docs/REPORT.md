# M-2 — two-line mobile rows for actions, spells and extras (D429)

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD 985f62e — OK.

## STEP 1 — row types and their mobile lines (≤ 760 px)

| # | Tab / container | Row type | Line 1 | Line 2 (12px muted, " · ") | Expanded only |
|---|---|---|---|---|---|
| 1 | Actions `table.sheet__actions-table` | weapon attack | name (breakdown button) · to-hit · damage (+type, Versatile) | kind subtitle · range · "Attack with" select · notes (properties, ammo tracker) | — (no expand on this row) |
| 2 | Actions table | spell attack/save row | name · hit/DC · damage lines | level · Concentration · Ritual · origin · range · notes | — |
| 3 | Actions groups `li.sheet__group-row` | feature action (+uses boxes / pool counter) | already one flex-wrap line, fits | — | text |
| 4 | Actions groups | Breath Weapon (cells) | already flex-wrap | — | text |
| 5 | Actions groups | bonus/reaction spell | already flex-wrap | — | text |
| 6 | Actions groups | Actions in Combat line | already wrapping text | — | text |
| 7 | Spells `li.sheet__spell-row--cast` | CAST (one pool) | CAST · ▸ name + badge · hit/DC · effect | subtitle (sources, Concentration/Ritual) · time · range | notes text |
| 8 | Spells `--cast` | CAST pair Slot/Pact (D326) | Slot+Pact · name · hit/DC · effect | as 7 | notes text |
| 9 | Spells `--use` | USE + boxes / counter / text counter | USE · name · hit/DC · effect | as 7 + counter | notes text |
| 10 | Spells `--label` | AT WILL / RITUAL / usage label | label · name · hit/DC · effect | as 7 | notes text |
| 11 | Spells, any kind | spell text not found | button/label · name | subtitle · unresolved reason | provenance |
| 12 | Extras `.extras-tab__table` | familiar (HP button, temp) | name · AC · HP | type · speed · notes | — |
| 13 | Extras | Wild Shape form | name · AC · "Uses your HP" + Transform | type · speed · notes | — |
| 14 | Extras | stored form without stat block | name · AC "—" · HP "—" | "Stored form (src)" · speed · notes | — |

Chain Master card under a familiar row and the group rows 3–6 are already flex-wrap blocks; only width fixes, no restructure.
Note: the Actions tab renders no `.sheet__spell-row`; its spell rows are actions-table rows (type 2).

## Changed
- `src/index.css` (inside `@media (max-width: 760px)` only): actions table, spell table, extras table → `display:block`,
  headers hidden; each row `display:flex; flex-wrap:wrap`, name cells `display:contents`, `order` 1–3 = line 1,
  `::after` (order 4, basis 100%) breaks the line, order 5 = line 2 at 12px muted with `· ` prefixes; empty cells
  hidden. Roll buttons, DC/flat boxes, CAST/USE, names/toggles, "Attack with" select, ammo −1 ≥ 36px. Extras AC cell
  prefixed "AC ". Ability cards `align-items:center` (overrode `.sheet__left-column li`). Identity line wraps, no ellipsis.
- `CharacterSheet.tsx` `SpellTabRow`: `useMobileLayout()`; on mobile the notes cell holds only the USE counter and the
  notes text renders as `.sheet__spell-row-notes` in the open row. Desktop markup unchanged.
- `SheetHeader.tsx`: `ArmourClassCard` `label` prop; `MobileSheetHeader` passes "AC" (aria-label unchanged).
- `e2e/mobileRowsM2.spec.ts` (new, Row Warlock 6: Tiefling Infernal Legacy, Pact of the Chain + Pseudodragon, Longsword).
- D429 added to DECISIONS.md (as requested); STATUS.md updated.

## Verified
- typecheck OK; test 3607/3607; validate-data 177/177.
- `mobileRowsM2.spec.ts` M-2 a (scrollWidth ≤ clientWidth+1 for every table/row/group container in Actions, Spells,
  Extras; every hit/DC/damage/CAST box right ≤ 390), b (to-hit and damage roll → toast), c (CAST Hex fills a pact box),
  d (Hex notes absent until opened), e (AC at 390), e/f (Armour Class at 1366; thead 5 cells, spell head 7, rows `grid`).
- Full e2e: 840 passed, 1 failed = SC-1 a (`subclassSpellcastingPrereq.spec.ts:103`, timeout), passes alone (4/4). Run 8.6 min.

## Decisions taken / questions
- Actions-table rows have no expand toggle, so their notes (weapon properties, ammo tracker with −1) stay on line 2
  instead of an expanded area; adding an expander was outside scope. Planning chat may want a toggle there.
- USE counter (boxes) stays visible on line 2; use boxes themselves stay 16px (shared with feature rows), not 36px.
- Line-2 separator is a CSS prefix: a row with no subtitle would start line 2 with "· " (not seen in the seed).
- Untracked `scripts/investigate-lh2-sorcery-points.js` from an earlier session left in place (task forbade git clean).
- No subagent used.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens (≤ 760px only): Actions tab table, Spells tab rows (closed and open), Extras tab rows, mobile header
(AC label, wrapped identity line), Stats view ability cards.
