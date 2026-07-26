# Project Notes


## Where we are
Phase 0 complete. Tools installed, repo connected to GitHub, 5etools data
extracted into data/ via scripts/extract-data.js, verified by
scripts/validate-data.js (103 checks green).

## Next step
Phase 1: build the actual app — character creation from the extracted data,
display, use at the table, saving.
Nothing has been built yet; data/ is the only output so far.


## Open questions

### Where will 5etools data live at deployment time (phase 1+)
For now: data stored locally in `data-source/`, not tracked by Git.
Problem: once the app runs from a URL, a browser on someone else's
computer can't see files on my disk. Data needs to be available
online somehow.

Options:
1. Data inside a public repo – simplest, works for everyone.
   Licensing question: MIT covers 5etools' code, not the content
   itself (which comes from WotC).
2. Private repo + deployment via Vercel/Netlify – data isn't
   publicly exposed for download.
3. Each user uploads their own JSON files, app stores them in
   the browser.

Decision needed before first deployment to a URL.
Until then, figure out how much data the app actually needs –
might be a fraction of the full set.

### Magic item variants — deferred to phase 2
data/magicvariants.json holds 214 templates ("+1 Weapon") that combine
with base items from items-base.json at runtime via a `requires`/`inherits`
match. 5etools does not pre-generate the combinations; they're computed in
the browser. Expanding them would produce thousands of entries.
Phase 1: base equipment + named magic items from XDMG only.

### _abstract / _implementations not yet supported
7 entries in races.json (Dragonborn XPHB and similar) use a template form
with {{variable}} substitution instead of plain _versions. The extractor
warns and skips them. Must be implemented before species extraction is
trustworthy.

### Magic Initiate parent entry — UI decision for later
Expanding _versions keeps the generic parent ("Magic Initiate") selectable
alongside its three class variants, matching how 5etools behaves.
For a character sheet the generic one may not be a valid pick. Decide at
the UI stage whether to hide parents that have variants.

## Decisions
### _copy resolution
295 entries across the data use `_copy` (inherit from another entry),
77 of those also use `_mod`. Only four mod operations occur in this data:
insertArr, replaceArr, appendArr, replaceTxt.
Decision: write our own small resolver rather than depending on 5etools
code. Reference implementation for checking semantics:
js/utils.js, class _DataUtilBrewHelper, method _doMod (~line 6094).
Copies may point at sources we don't extract (PHB, DMG, SCAG, PSA, PSK,
DSotDQ), so: load everything → resolve copies → only then filter by source.

### Optional features
data/optionalfeatures.json holds Eldritch Invocations, Fighting Styles,
Metamagic, Battle Master manoeuvres etc. 131 entries from our sources.
Class linkage is encoded in `featureType` (e.g. FS:F = Fighting Style,
Fighter), not in a separate field — we need our own lookup table for that.
Included in extraction.

### Subclass feature levels — RESOLVED
5etools already ships XPHB-converted versions of XGE/TCE subclasses,
with feature levels remapped to the 2024 progression (e.g. Forge Domain:
level 1 and 2 features folded into level 3, level 8 features dropped).
The originals (classSource "PHB") and the conversions (classSource "XPHB")
both exist in the same file.
Decision: filter subclasses by classSource "XPHB", not by source.
No manual level remapping needed.

### Content scope for phase 1
Sources: XPHB, XGE, TCE, EFA (2024-rules Artificer). Everything else
excluded for now. RHW (Reanimator subclass) deliberately skipped.

### Subclass filtering rule
Filter subclasses by `classSource` in ["XPHB", "EFA"], not by `source`.
All 57 XGE/TCE subclasses have XPHB conversions; all 4 TCE Artificer
subclasses have EFA conversions. Nothing is missing.
Caveat: Reanimator has source RHW but classSource EFA — excluded by an
additional check on `source` being in the allowed list.

### Species (races) scope
2024 species identified by `edition: "one"` (sources XPHB, EFA, RHW).
MPMM included as the 2014 species pool (30 entries) — it supersedes the
VGM/MTF versions, which are excluded as duplicates (all 14 have
reprintedAs pointing at MPMM).
MPMM entries carry an `ability` field (e.g. Aasimar cha +2); XPHB species
have none, because 2024 moves ability bonuses to backgrounds.
Decision: strip the `ability` field from MPMM species on extraction.
Ability bonuses always come from the background.

## Expected extraction counts (verify after each run)
Feats: XPHB 77, XGE 15, TCE 15
Subclasses: 57 (classSource XPHB) + 4 Artificer (classSource EFA)
Optional features: XPHB 58, TCE 47, XGE 22, EFA 4 = 131
Species: 18 with edition "one" (XPHB/EFA/RHW) + 30 MPMM
Backgrounds: XPHB 16
Items: XPHB 217, XDMG 593

### Spell availability: `classes` vs `classVariants`
XGE and TCE spells were never on core class lists — they're granted as
optional/variant content, so they land in `classVariant`, not `class`.
109 spells have an empty `classes` array (all 95 XGE + 14 TCE); only 3
have no availability at all.
UI must read both `classes` and `classVariants`, ideally flagged
differently, or every XGE/TCE spell will look uncastable.

### Spell counts extracted
XPHB 391, XGE 95, TCE 21, EFA 1. XDMG and MPMM have no spell files.

### Species `ability` field — correction
Earlier assumption was wrong: MPMM entries have NO `ability` field.
MPMM (2022) already replaced fixed ASIs with floating ones. Nothing to
strip; the stripping code is kept as a guard, and the validator asserts
no species has an `ability` field.

### Background field shapes (XPHB)
`ability`: 2-element array — [0] = +2/+1 spread, [1] = +1 to all three.
The trio of abilities differs per background. UI must let the player
choose which spread and which abilities.
`feats`: array of one object keyed by a lowercase "name|source" string,
value true — e.g. {"magic initiate; cleric|xphb": true}. The feat name is
the KEY, not a value.
`skillProficiencies`: always exactly 2, fixed.
`toolProficiencies`: named tool, or a category choice
({"anyArtisansTool": 1}) — 5 of 16 use the choice form.
`startingEquipment`: [{A: [...items...], B: [coins]}], only keys A and B.
`languageProficiencies` absent — 2024 moved languages out of backgrounds.

### TRAP: feat reference casing
15 of 16 XPHB backgrounds use lowercase feat references ("skilled|xphb"),
but Noble uses "Skilled|xphb". Always lowercase both sides before matching
or Noble silently loses its origin feat.

### Feature reference IDs
Every feature gets a stable `id`; classes/subclasses get matching
`classFeatureIds` / `subclassFeatureIds` alongside the original strings.
Format:
  cf|name|className|classSource|level|source
  scf|name|className|classSource|subclassShortName|subclassSource|level|source
All lowercase. Zero collisions, zero dangling references (744 checked).

TRAP: a blank classSource in a reference string means "PHB", NOT "same as
this class". "Second Wind|Fighter||1" is the 2014 fighter.

TRAP: features must be kept by REFERENCE, not by matching the feature's own
className/classSource against a surviving class. The EFA Artificer's
subclasses are _copy-derived from TCE and inherit references pointing at
classSource=TCE features. Owner-matching drops 227 valid features.

### Artificer infusions — UI note
AI (Artificer Infusion, 16 entries) exists in optional-features.json, but
the EFA Artificer grants infusions through a regular class feature, not via
`optionalfeatureProgression`. A UI driving infusion selection off
optionalfeatureProgression alone will show nothing for Artificer.