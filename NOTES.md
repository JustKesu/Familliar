# Project Notes

## Where we are
Phase 0 complete. Tools installed, repo connected to GitHub, 5etools data
extracted into data/ via scripts/extract-data.js, verified by
scripts/validate-data.js (103 checks green).

Phase 1 build order (PHASE1.md section E): step 1 (markup renderer,
src/markup/) and step 2 (app skeleton + persistence, src/storage/ +
src/CharacterManager.tsx, including export/import) are DONE. Step 3
(character creation) is IN PROGRESS: class/level (src/classes/),
ability scores — all three methods (src/abilities/), species selection
(src/species/), background selection with the ability bonus
distribution (src/backgrounds/), and language selection — exactly two
standard languages plus the automatic Common (src/languages/) — are
built and on main, wired together behind a real wizard shell
(src/creation/) that walks class → species → background → languages →
ability scores and saves once, on the review step, through
CharacterStore. src/CharacterManager.tsx delegates creation to that
wizard; it still provides the temporary list/rename/delete/export/
import/inspect surface. The level-1-to-target walkthrough of per-level
choices is not yet built. See PHASE1.md section D for the storage
layer's actual shape, and PHASE1.md section D "Temporary scaffolding"
for every throwaway UI surface currently in the app.

Component testing (jsdom + @testing-library/react/user-event) was added
alongside a fix for a wizard bug: pickers kept their selection in their
own component state, which unmounted when the player navigated away from
a step, so only the class step survived a trip back and forth. Pickers
now display a `value` prop from the wizard instead. See PHASE1.md
section D, "Tests — static HTML for the renderer, a real DOM for
interactive components".

## Next step
Phase 1 step 3, remaining slice: the level-1-to-target walkthrough of
per-level choices, added to the wizard as a new step in
src/creation/wizardState.ts.

## Setup facts
Windows. VS Code + Claude Code. Node.js and npm installed.
Repo: https://github.com/JustKesu/Familliar
Local path: C:\Users\Danik\Documents\Familliar

Source data (gitignored, never modified):
  data-source/5etools-src-main/5etools-src-main/data/
  NOTE the doubled folder name — the zip nests one level.
Generated output (tracked in git): data/

Run:
  node scripts/extract-data.js     # regenerates data/
  node scripts/validate-data.js    # 103 checks, exit code 1 on failure

  scripts/package.json             # not a script — a 2-line config file.
    The root package.json sets "type": "module" for the Vite app, but the
    scripts here are CommonJS (require/module.exports). This file sets
    "type": "commonjs" for the folder so they keep running unchanged.

## Content scope
ALLOWED_SOURCES: XPHB, XGE, TCE, EFA, XDMG, MPMM
ALLOWED_CLASS_SOURCES: XPHB, EFA  (the class EDITION, not the book)

  XPHB  Player's Handbook 2024      — core
  XGE   Xanathar's Guide            — subclasses, spells, feats
  TCE   Tasha's Cauldron            — subclasses, spells, feats
  EFA   Eberron: Forge of Artificer — 2024-rules Artificer
  XDMG  Dungeon Master's Guide 2024 — magic item catalogue
  MPMM  Monsters of the Multiverse  — 2014 species pool

Deliberately excluded: PHB 2014, RHW (Reanimator subclass), all adventure
modules, UA/playtest, Plane Shift booklets, VGM/MTF (superseded by MPMM).
XMM (Monster Manual 2025) is NOT in the allowed list — monsters are a
separate feature, not needed for a character sheet.

## Output files

Counts as of the `reprintedAs` deduplication + languages addition (before ->
after shown where a category changed; unchanged categories listed too):

  data/feats.json               138 -> 128  (XPHB 80, EFA 28, XGE 15, TCE 15->5)
  data/spells.json              508 -> 489  (XPHB 391, XGE 95->85, TCE 21->12, EFA 1)
  data/species.json              87 -> 78   (XPHB 34, MPMM 44->35, EFA 9)
  data/backgrounds.json          33 -> 33   (XPHB 16, EFA 17) — unchanged
  data/classes.json             127 -> 127  (13 classes + 114 subclasses) — unchanged
  data/class-features.json      279 -> 279  — unchanged
  data/subclass-features.json   465 -> 465  — unchanged
  data/optional-features.json   131 -> 120  (XPHB 58, TCE 47->38, XGE 22->20, EFA 4)
  data/items.json               943 -> 899  (XDMG 593, XPHB 217, TCE 84->80,
                                      XGE 43->3, EFA 6)
  data/languages.json             0 -> 19   (XPHB 19) — new category

The drops are entries superseded by a newer reprint we also keep (e.g. TCE
"Chef" superseded by its XPHB reprint) — see extract-data.js's
`removeSuperseded()` and "Nine species names occur twice" below. `validate-data.js`
now asserts these counts and checks that no superseded duplicate survives.

## Open questions

### 5etools markup tags — RESOLVED, renderer built
Description text is not plain English. It contains 5etools' own syntax:
{@damage 8d6}, {@dice 1d10}, {@condition prone}, {@spell fireball},
{@item longsword}, {@variantrule Heroic Inspiration|XPHB},
{@filter Origin feat|feats|category=o}, {@scaledamage 8d6|3-9|1d6}.
Extraction leaves these untouched on purpose.
Renderer: src/markup/ (phase 1 build order step 1).
The exhaustive list of what actually occurs — 38 tags, 8,840 occurrences —
is MARKUP-INVENTORY.md, regenerated by `npm run survey-markup`.
The examples above are illustrative; the inventory is authoritative.

### `entries` arrays are not plain strings — RESOLVED
They mix strings with nested objects ({type: "entries"}, {type: "list"},
tables...). The renderer recurses rather than joining.
14 distinct nested types occur; all are handled. See MARKUP-INVENTORY.md.

### Fluff / lore text not extracted
Descriptive text and images live in separate fluff-*.json files, matched
to entries by name. Nothing from them is currently extracted. Decide in
phase 1 whether species/spell descriptions are needed.

### Where will data live at deployment time
Currently data/ is tracked in git and would deploy with the app.
Options if that becomes a licensing concern:
1. Public repo (current default) — simplest, works for everyone.
   MIT covers 5etools' code, not the content itself (WotC).
2. Private repo + Vercel/Netlify — data not publicly downloadable.
3. Each user uploads their own JSON files, stored in the browser.
Revisit before first deployment to a URL.

### Magic item variants — deferred to phase 2
magicvariants.json holds 214 templates ("+1 Weapon") combined with base
items at runtime via requires/inherits. Not pre-generated by 5etools;
expanding them would produce thousands of entries.
Phase 1: base equipment + named magic items only.

### Magic Initiate parent entry — UI decision
_versions expansion keeps the generic parent selectable alongside its
three class variants, matching 5etools. For a character sheet the generic
one may not be a valid pick. Decide whether to hide parents with variants.

### EFA background count — worth verifying
EFA contributes 17 backgrounds, more than XPHB's 16. Surprising for a
single-class book. Not blocking; sanity-check against the book sometime.

### Browser verification by the agent — deferred, revisit at build order step 5
The app is currently verified by hand: the user runs `npm run dev` and
clicks through the UI. Automated tests cover pure logic and, since the
wizard was built, component behaviour through a simulated DOM (see
"Tests — static HTML for the renderer, a real DOM for interactive
components" in PHASE1.md section D). Nothing verifies the app as it
actually renders in a real browser.

The option considered was connecting Claude Code to a real browser
through the Playwright MCP server, letting it navigate to the dev
server, click through a flow and assert on what it finds. Deliberately
NOT set up, for cost reasons: each look at a page returns the full
accessibility tree, which is expensive in context, and a session that
clicks through the whole creation wizard would spend a large share of
its budget on that alone.

Decision for now: manual verification by the user continues. Revisit
when build order step 5 (sheet display) begins — the sheet is a large,
dense, frequently re-rendered screen where a real browser check would
pay for itself. If adopted, it should be used for narrow, named checks
("fill steps 1 and 2, go back, assert step 1 still shows its
selection"), not open-ended "click around and tell me if it looks right".

### 50 extraction warnings, all in discarded sources
PHB (30) and EGW (20), all 2014 Dragonborn variants. They never reach
output. If EGW is ever allowed, the 20 need investigating first.

## Decisions

### _copy resolution
295 entries use `_copy` (inherit from another entry), 77 also use `_mod`.
Six mod operations occur: appendArr, prependArr, insertArr, replaceArr,
removeArr, replaceTxt. All implemented in our own resolver.
Reference for semantics: js/utils.js, class _DataUtilBrewHelper,
method _doMod (~line 6094).
Copies point at sources we don't extract (PHB, DMG, SCAG, PSA, PSK,
DSotDQ), so the order is fixed: load everything → resolve copies →
expand _versions → only then filter by source. Never filter first.

### _versions and _abstract/_implementations — both implemented
_versions spawns real selectable variants (Magic Initiate → 3 class
versions). _abstract + _implementations is the template form with
{{variable}} substitution (Dragonborn → 10 colours).
Substitution applies to strings at any depth, never to object keys.
The parent entry stays selectable, matching 5etools.

### Subclass feature levels — RESOLVED, no manual work needed
5etools already ships XPHB-converted versions of XGE/TCE subclasses with
feature levels remapped to the 2024 progression (Forge Domain: level 1
and 2 features folded into level 3, level 8 features dropped).
Originals (classSource "PHB") and conversions (classSource "XPHB") both
exist in the same file. We take the conversions.

### Subclass filtering rule
classSource must be in ALLOWED_CLASS_SOURCES (XPHB, EFA) — the class
EDITION. AND source must be in ALLOWED_SOURCES — the BOOK it was printed
in. Both conditions.
All 57 XGE/TCE subclasses have XPHB conversions; all 4 TCE Artificer
subclasses have EFA conversions. Nothing is missing.

### Species scope
2024 species identified by `edition: "one"`. MPMM included as the 2014
species pool; it supersedes VGM/MTF, which are excluded as duplicates
(all 14 have reprintedAs pointing at MPMM).
MPMM has NO `ability` field — MPMM (2022) already replaced fixed ASIs
with floating ones. Nothing to strip. The stripping code is kept as a
guard and the validator asserts no species has an `ability` field.
Ability bonuses always come from the background.

### Species variants come in TWO shapes, and only one is self-describing
87 species entries include both parents and their variants. Parents stay
selectable alongside their variants (same rule as _versions everywhere).
The two shapes differ in whether the variant's NAME says what it is:

1. `_versions` expansion — 38 entries. The parent name is baked into the
   variant name: "Elf; Drow Lineage", "Dragonborn (Red)",
   "Goliath; Stone Giant Ancestry", "Tiefling; Infernal Legacy",
   "Shifter; Beasthide", "Aasimar; Radiant Soul", "Kobold; Craftiness".
   These read correctly on their own.

2. `subrace` linkage — 4 entries, ALL Genasi, and the only ones in the
   file. They carry `raceName: "Genasi"` + `raceSource: "MPMM"` and are
   named just "Air", "Earth", "Fire", "Water". The parent name appears
   ONLY in those two fields, never in `name`.

Genasi is the sole case of shape 2: no other species in data/ has a
`raceName`/`raceSource` field at all (checked across all 87). See PHASE1.md
section F — a species picker reading `name` alone is the open question.

### Species reprints — RESOLVED, deduplicated during extraction
Some species were reprinted in a newer allowed book, and originally both
printings survived extraction because both books are in ALLOWED_SOURCES.
That caused several species names — Shifter and its four variants,
Aasimar, Goliath, Changeling, Orc — to occur twice, once per printing.

Deduplication now happens during extraction (`removeSuperseded()`), so
`data/species.json` currently has 78 entries, only 3 of which still carry
`reprintedAs`, and no species name occurs twice.

The older entry always says so itself: a superseded entry carries
`reprintedAs` pointing at the newer one ("Shifter|EFA", "Aasimar|XPHB",
"Goliath|XPHB", "Orc|XPHB", "Changeling|EFA"). The newer entry has no
`reprintedAs`. So a pair is detectable from the data without a
hand-written list — this is the field the species picker's dedup filter
relies on (see PHASE1.md section F).

Note this is NOT the same test as the VGM/MTF exclusion. There the whole
book was dropped up front. Here both books are wanted for other species
and only a handful of entries collided.

### Feature files kept separate, not inlined
classes.json keeps reference strings; feature text lives in
class-features.json and subclass-features.json. The app joins them via
the `id` fields. Avoids duplicating text in two structures.

### Feature reference IDs
Every feature has a stable `id`; classes/subclasses have matching
`classFeatureIds` / `subclassFeatureIds` alongside the original strings.
  cf|name|className|classSource|level|source
  scf|name|className|classSource|subclassShortName|subclassSource|level|source
All lowercase. Zero collisions, zero dangling references (744 checked).

### Item code legends
type -> itemType list in items-base.json
property -> itemProperty list, mastery -> itemMastery list (same file)
dmgType -> Parser.DMGTYPE_JSON_TO_FULL, js/parser.js:4483
rarity and weaponCategory need no lookup — already plain words.
Resolved fields added alongside originals: typeFull, propertyFull,
masteryFull, dmgTypeFull.
itemGroup (109 entries) is loaded so _copy resolves, but excluded from
output — it holds groupings, not ownable items.

## Traps — things that silently break

### Blank source means PHB, not "same as this"
In class-feature references AND item codes, a blank/missing source
defaults to the 2014 PHB. "Second Wind|Fighter||1" is the 2014 fighter.
Bare item type "M" is the 2014 melee weapon; "M|XPHB" is the 2024 one.

### Features must be kept by REFERENCE, not by owner match
Matching a feature's own className/classSource against a surviving class
drops 227 valid features. The EFA Artificer's subclasses are _copy-derived
from TCE and inherit references pointing at classSource=TCE features.

### Item legends must be built from the FULL list
58 kept items are typed via 2014 legend entries. Pruning the legend tables
to allowed sources silently loses their readable type.

### Feat reference casing
15 of 16 XPHB backgrounds use lowercase feat references ("skilled|xphb"),
but Noble uses "Skilled|xphb". Lowercase both sides before matching or
Noble silently loses its origin feat.

### Spell availability: `classes` vs `classVariants`
XGE and TCE spells were never on core class lists — they're granted as
optional/variant content and land in `classVariant`, not `class`.
109 spells have an empty `classes` array (all 95 XGE + 14 TCE); only 3
have no availability at all.
The UI must read both, ideally flagged differently, or every XGE/TCE
spell will look uncastable.

### Armour AC — the data won't tell you
`ac` is the base number. There is NO Dex cap field; the cap is implied by
the armour type code (LA light = uncapped, MA medium = +2, HA heavy = none).
The AC calculation must hardcode that rule.
`strength` is a string ("13") or null; `stealth: true` means disadvantage.

### Identifying item kinds
Weapons and armour have boolean flags (`weapon`, `armor`).
Shields have NO flag — identify by type abbreviation "S".
Containers have NO flag — identify by presence of `containerCapacity`.

### Artificer infusions
AI (Artificer Infusion, 16 entries) exists in optional-features.json, but
the EFA Artificer grants infusions through a regular class feature, not
via `optionalfeatureProgression`. A UI driving infusion selection off
optionalfeatureProgression alone will show nothing for Artificer.

### Background field shapes (XPHB) — confirmed against all 33 entries
`ability`: 2-element array; each element is
`{ choose: { weighted: { from: [threeAbilities], weights } } }`. Element
[0] always carries weights [2,1] (the +2/+1 spread), element [1] always
[1,1,1] (the +1 to all three), both offering the same three abilities.
`feats`: array of one object keyed by a "name|source" string, value true.
The feat name is the KEY, not a value. Lowercase for 32 of 33 (Noble
alone capitalizes it — see "Feat reference casing" above); lowercasing
both sides and title-casing the result for display matches feats.json's
own casing exactly.
`skillProficiencies`: always exactly 2, fixed.
`toolProficiencies`: named tool, or a category choice ({"anyArtisansTool": 1}).
`startingEquipment`: `[{ <A>: [...], <B>: [...] }]` — but the key casing
is NOT fixed to "A"/"B": all 17 EFA entries use lowercase "a"/"b", all 16
XPHB entries use uppercase "A"/"B". Read case-insensitively; don't branch
on source. Array elements come in four shapes: a bare item code string
("dagger|xphb"), `{ item, displayName?, quantity? }`, `{ value: <copper> }`
coins, or `{ equipmentType }` (only toolArtisan, instrumentMusical,
setGaming occur) meaning "your choice of that category". Three bare item
codes ("holy symbol|xphb", "gaming set|xphb", "musical instrument|xphb")
don't resolve against items.json — they're 5etools item-GROUP references,
which extraction excludes from items.json (see "Item code legends"
below); fall back to a humanized version of the code for those.
`languageProficiencies` absent — 2024 moved languages out of backgrounds.
Loader: `src/backgrounds/backgroundData.ts`.
