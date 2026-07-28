# Decisions

Settled decisions for the Familliar project, and the reasoning behind
them. Entries are added here as decisions are made; they are never
rewritten when the code that implements them later changes. If a
decision is reversed, a new entry records that — this file is not
edited to erase what used to be true.

---

## D1 — Character storage — localStorage, versioned, with file export/import

**Where characters live.** In the browser's localStorage, on the machine
that created them. Keyed per browser: no accounts, no login, no server.
A character made in one browser is not visible in another, and two
players on two machines share nothing.

**What the store holds.** An ARRAY of characters, not a single one —
already decided below, unchanged here.

**The stored payload carries a schema version number, written from the
very first save.** Not added later when it is first needed. The version
is part of the payload from the first line of persistence code that ever
runs.

Rationale: the same argument as the array. Once a save exists in a
player's browser we cannot reach in and fix it. A stored blob with no
version can only be guessed at, so the day the format changes the honest
options are to guess or to discard the save. A number written from the
start means an old save can be recognised and MIGRATED to the new shape
instead of thrown away. Writing it now is one field; retrofitting it is
impossible for saves already on disk.

**Export writes a JSON file to disk; import reads one back.** Both are in
the definition of done, not optional extras.

Rationale, two reasons. First, localStorage is not durable storage — it
is wiped when the user clears browsing data, which people do routinely
and without connecting it to losing a character. Export is the only
backup a player has. Second, export is how a character moves between
machines: with no server and no accounts, a file is the transport.

**Import must validate what it reads, and refuse bad input with a clear
message.** An import that does not recognise the file, or finds it
malformed, or cannot handle its schema version, says so and changes
nothing. It must never write a partially-understood character into the
store, and must never leave the store in a worse state than before the
attempt. A failed import is a no-op plus an explanation the player can
act on.

Rationale: the imported file came from outside the app. It may be an
older export, a hand-edited file, or the wrong file entirely. The store
holds every character the player owns, so the cost of accepting garbage
is not one bad character — it is a store that may no longer load at all.

**Export file format — an ARRAY, always, even for one character.** An
export file's top level is a list of characters, never a bare single
character object. The phase 1 UI only ever exports one character at a
time, so in practice every file holds a one-element array.

Rationale: same argument as the storage array. Exporting the whole
roster at once is a plausible later feature, and with the array shape
already in place it needs no format change — only the UI gains a
button. Committing to a bare-object format now would mean either a
breaking format change later or permanently supporting two shapes.

**Import — never overwrites.** Every imported character is added to the
store as a NEW character with a freshly generated id, regardless of
whether a character with the same name or id already exists. Import
cannot destroy or replace anything already in the store.

Rationale: the whole point of export/import is to protect against loss
(see above). An import path that can silently overwrite an existing
character turns the safety net into a new way to lose one — importing
an old backup by mistake would clobber current progress. Duplicate
names are a cosmetic problem the UI can surface (e.g. showing the
import date), not a destructive one.

## D2 — How many characters per browser — a LIST from day one

Storage holds an ARRAY of characters, not a single character, from the
first line of persistence code.

The phase 1 UI may expose only one of them; that is a UI question and can
stay simple. The STORAGE SHAPE is not a UI question and is decided now.

Rationale: same argument as the multiclass array below. Storing a list
from the start is nearly free; retrofitting one later is expensive —
every load, save, migration and reference would have to change, plus a
migration for characters already saved in players' browsers.

Note the project description places "multiple characters" in phase 2.
That still holds for the UI. Only the data shape moves earlier.

## D3 — TypeScript, strict mode

The app is written in TypeScript with `strict: true` (tsconfig.app.json,
tsconfig.node.json and tsconfig.test.json). Not negotiable per-file: no
opting out with `any` where a real type is possible.

Rationale: the 5etools data is deeply nested and irregularly shaped (see
the whole "Traps" section of DATA.md — blank sources meaning PHB, fields
that are string-or-null, flags that only exist for some item kinds).
Those are exactly the mistakes the compiler catches for free.

Type definitions for the game data are written as the features that
consume them are built, not upfront.

## D4 — Markup renderer — two layers, references are not links yet

`src/markup/` is split so that display decisions never leak into parsing:

    parseMarkup.ts   string -> {name, args} nodes. Syntax only.
    tags.ts          what each tag MEANS: display text + reference target.
    Markup.tsx       React. Owns every visual decision.

Cross-references (`{@spell}`, `{@item}`, `{@condition}`, `{@creature}`)
render as plain styled text, NOT links. Routing does not exist yet.

They are structured so links can be added by changing Markup.tsx alone:
the parser keeps every argument, and the rendered element carries
`data-ref-category`, `data-ref-name` and `data-ref-source`. Nothing that
a link would need is discarded along the way.

Tag display semantics were taken from `js/render.js` in the 5etools
source (class `Renderer.tag`). Reimplemented for React, not copied.

## D5 — Markup — a blank source is preserved, never defaulted

`{@condition prone}` and `{@status concentration||concentrating}` carry no
source. The renderer records that as an empty string rather than filling in
a default.
Rationale: per DATA.md a blank source means the 2014 PHB, not "the current
book". Defaulting it inside the renderer would bury that distinction
somewhere the feature that eventually resolves these links cannot see it.

## D6 — Markup — unknown tags degrade, they never throw

An unrecognised tag renders its first argument, which for every 5etools tag
is human-readable text. Braces are never shown to the player. The same
applies to unrecognised nested entry types, which render their body.

A warning is logged once per distinct tag or type name — not once per
occurrence, which would flood the console on a single class page.

Because that fallback is silent by design, a test renders EVERY entry
structure in data/ and fails the build if anything warns. That is the real
guard; the graceful degradation is only there to protect a player mid-session.

## D7 — Markup — `ref*` entry types show a name, not the feature

`refClassFeature`, `refSubclassFeature`, `refOptionalfeature` and `refFeat`
(335 occurrences) point at a feature defined in a different file. Resolving
them needs a cross-file lookup the renderer does not have and should not
own.
They render as the target's name, with the full UID kept on the element in
`data-ref-uid`. Inlining the real feature text belongs to the feature that
builds class progressions.

## D8 — Tests — static HTML for the renderer, a real DOM for interactive components

Two different test styles now coexist, chosen per component:

Renderer tests (`src/markup/`) still use `renderToStaticMarkup` from
`react-dom/server` and assert on the HTML string. The renderer has no
state, no effects and no event handlers, so a DOM buys nothing there —
that reasoning was correct and is unchanged.

Interactive components — starting with the creation wizard and its
pickers — are tested through `jsdom` and `@testing-library/react`
(`@testing-library/user-event` for simulated clicks/typing), added as dev
dependencies. Vitest's default test environment stays `node`; jsdom is
opted into per file with a `// @vitest-environment jsdom` comment, so the
renderer's tests keep their original cost.

**Why this was revised.** The original decision assumed no component had
real interaction to test. `CharacterWizard.tsx` did: it navigates between
steps and the pickers it wires in own their in-progress selection. A bug
shipped where every picker except the class step lost its selection when
the player navigated away and back — the picker's own state unmounted
with the step; the wizard's state (proven correct by
`wizardState.test.ts`) was never wrong. The existing renderer-style and
pure-reducer tests could not have caught this: neither renders a picker
inside the wizard and drives it with real navigation. The fix was a
state-ownership change (pickers now display a `value` prop the wizard
supplies and only report changes upward) verified by
`CharacterWizard.test.tsx`, which renders the real wizard, makes a
selection on each step, navigates away and back, and asserts the
selection is still shown — the class of test the old decision had ruled
out.

None of this reaches a real browser; see QUESTIONS.md, "Browser
verification by the agent" (deferred, revisit at build order step 5).

Tests also get their own TypeScript project (tsconfig.test.json) because
one of them reads data/ off disk. Keeping Node types out of
tsconfig.app.json means browser code cannot reach for `fs` and still
compile.

## D9 — Manual override of calculated values — NO, except HP

Calculated fields (AC, to-hit, saves, DCs) cannot be hand-edited in
phase 1. HP is the exception: current HP and max HP are manually
editable.
Revisit in phase 2 if real play shows it is needed.

## D10 — Encumbrance and carrying capacity — NOT IMPLEMENTED

Deliberately excluded. Nobody at this table uses the rule.
Inventory is a list of items with no weight tracking.

## D11 — Multiclass — model from day one, UI at the end of phase 1

The character model stores classes as an ARRAY from the start:

    classes: [ { className, classSource, subclass, level }, ... ]

Phase 1 UI allows exactly one entry. All calculation code (HP,
proficiency bonus, spell slots, features) must be written to iterate
over the array rather than assume a single class.

Multiclass UI is the LAST step of phase 1, after everything else works.
Estimated cost with the array model in place: roughly 10-15% on top of
the rest of phase 1.

Multiclass rules that will need implementing at that point — all to be
verified against the 2024 rules text before coding:
- Ability score prerequisites for entering a class
- Reduced proficiencies when gaining a class after the first
- Hit die of the class being levelled, per level
- Proficiency bonus from TOTAL character level, not per class
- Combined multiclass spell slot table; caster level contributions
  (full / half / third) per class; Artificer rounding needs checking
  against EFA specifically
- Warlock Pact Magic slots stay a separate pool but may power spells
  from other classes
- Spells prepared calculated per class separately
- Extra Attack does not stack
- Only one Unarmored Defense applies

## D12 — Fighting Styles resolve through feats.json, not optional-features.json

**Verified.** `data/feats.json` contains 80 XPHB feats, including every
Fighting Style: Dueling, Two-Weapon Fighting, Archery, Defense, Great
Weapon Fighting, Protection, Blind Fighting, Interception, Thrown Weapon
Fighting and Unarmed Fighting. Each carries `category: "FS"` and
`prerequisite: [{ "feature": ["Fighting Style"] }]`.

The 2024 rules moved Fighting Styles out of class features and into
feats. `College of Swords` (XGE) is the one subclass in the data still
written the 2014 way: its `optionalfeatureProgression` grants
`featureType: ["FS:B"]`, a code that pointed at an entry in
`optional-features.json` under the old scheme. That entry no longer
exists — not because anything was deleted by this project, but because
Fighting Styles as a category moved to feats.json when 2014-era
optional-features got superseded by XPHB. Fighter, Paladin and Ranger
don't have this problem: none of them use `optionalfeatureProgression`
for Fighting Style at all, so whatever currently grants them a style
choice must already route through feats.json some other way.

**Decision:** Fighting Styles are feats.json entries with
`category: "FS"`, full stop. Any `FS:*` `optionalfeatureProgression`
reference (currently only College of Swords' `FS:B`) resolves to that
same feats.json category, not to optional-features.json. The `:B`
suffix does not name a different data source — the source is always
feats.json — it constrains WHICH of the category's feats are legal for
that particular grant (Bard subclass text only calls out Dueling and
Two-Weapon Fighting as sensible picks).

**What character creation will have to do:** when a class or subclass
grants a Fighting Style choice, the picker must resolve it against
`feats.json` filtered by `category === "FS"`, not against
`optional-features.json`. Where the grant is restricted to a named
subset (College of Swords: Dueling and Two-Weapon Fighting only), that
subset has to be read from the subclass's flavor text or hand-mapped,
since the `FS:B` code alone does not enumerate which two feats it means.
No resolution code is written yet — this only fixes what the picker
must look up and where.

## D13 — Character creation is a multi-step wizard, organised by category

Character creation is a MULTI-STEP WIZARD, not a single long page. The
player moves through numbered steps and can go back to an earlier step
before finishing. Nothing is written to storage until the flow completes.

The steps are organised by CATEGORY, not by character level:

1. Class and level — including subclass and every class feature choice
   the character is entitled to at that level
2. Species
3. Background — including the background ability bonus distribution
4. Ability scores
5. Spells, for characters that have them
6. Starting equipment and inventory

The order follows PHB 2024 character creation as already recorded in
section A. Ability scores come after background because the background
ability bonus applies to them.

A character created above level 1 still owns every choice granted at
levels 1 up to the target level — section A.1 is unchanged by this.
Those choices are presented within the category step they belong to
(all class feature choices inside the class step, all spells inside the
spell step), rather than as one screen per level.

Every step shows what the choice GRANTS, not just its name: a background
lists its skill proficiencies, tool proficiency, origin feat and starting
equipment; a species lists what it gives; a class feature says what it
does. The player should not have to look anything up elsewhere to choose.

This replaces the temporary `CharacterManager.tsx` flow. The existing
pickers (class/level, ability scores, species) are expected to be reused
inside the wizard rather than rewritten.

## D14 — Temporary scaffolding

Surfaces that exist only to prove a layer works by hand, not as finished
UI, are labelled on screen and in their file's top comment as temporary,
naming what replaces them, so none of them is later mistaken for real work.

## D15 — Level-1-to-target walkthrough — split into three slices

The remaining part of build order step 3 (section A.4) is built as three
separate tasks, not one:

1. Class skills, weapon masteries and fighting style.
2. Subclass and its choices.
3. Feat/ASI.

Rationale: a single task covering all of them is too large — an earlier
attempt at this size already caused one context exhaustion in this
project.

## D16 — Feat/ASI slice moved after the calculation layer

Slices 1 and 2 above stay in build order step 3. Slice 3 (feat/ASI) is
deferred until after step 4 (calculation layer) — see section E.

Rationale: feat prerequisites are stated against FINAL ability scores —
raw scores plus the background bonus, which are deliberately stored
separately and never combined anywhere yet (see D17).
Combining them is a derived value belonging to the calculation layer.
Building feat/ASI first would mean writing that sum twice.

## D17 — Ability-score total — written in the calculation layer, not earlier

The sum of raw ability scores and background bonus is written, when
first needed, in the module that will hold the calculation layer (build
order step 4), not inside whichever feature happens to need it first.
Consumers call it rather than each computing their own copy.

Rationale: putting it anywhere else guarantees a second implementation
later, when step 4 is built.

## D18 — Skill proficiency overlap between class and background

Background skill proficiencies are FIXED — always exactly two, named by
the background, never chosen (see "Background field shapes" in
DATA.md). Only the class's skills are picked by the player. Because the
wizard picks class skills before background is chosen, an overlap
cannot always be prevented at the moment of picking.

- On the background step: if a background's fixed skills collide with a
  skill already picked from the class, say so plainly and point the
  player back to the class step to change it. Nothing is silently
  dropped or reassigned.
- On the class step: when a background is already chosen (true whenever
  the player navigates back), skills the background grants are shown
  but not selectable, labelled with where they come from.

This follows section B's existing requirement that the source of every
proficiency is visible so overlaps can be seen.

## D19 — Feat eligibility — enforced by prerequisites, not by category

The app offers only feats the character qualifies for, and explains why
an ineligible feat cannot be taken rather than hiding it silently. The
feat list is NOT filtered by `category`: the 2024 rule for the level
4/8/12/16/19 choice grants the Ability Score Improvement feat or another
feat of the player's choice for which they qualify, with no category
restriction. Enforcing prerequisites handles categories on its own —
Fighting Style feats require the Fighting Style class feature, Epic Boon
feats require level 19, and an Origin feat remains legal at level 4 if
its prerequisites are met.

This does not contradict "Fighting Styles resolve through feats.json,
not optional-features.json" (D12) — that decision says where a fighting
style is looked up when a class grants one; this says a fighting style
is not separately offered at an ASI level unless the character
qualifies.

## D20 — ASI offered alongside feats

At each ASI level the player first chooses between an ability score
increase and a feat, then sees the options for whichever they chose.
The increase is +2 to one ability or +1 to two, capped at 20. The cap is
enforced.

## D21 — Only structured choices inside class features are driven by the app

Choices the data expresses structurally — `options` entries and
`optionalfeatureProgression` — are presented as real pickers. Choices
stated only in a feature's prose are displayed as text for the player to
resolve themselves.

Rationale: hand-mapping prose choices means a growing table of
per-feature exceptions, not worth it in phase 1.

## D22 — Every stored choice records the level it was made at

A feat, a skill, a fighting style or a subclass choice is stored
together with the character level at which it was taken, so a level 8
character can tell its level 4 feat from its level 8 one. Features the
character receives automatically are NOT stored this way — they are
derived from class and level, which already carries their level. The
sheet displays provenance for both: where a thing came from and at what
level.

## D23 — The species picker lists entries a player cannot act on

Same family of problem as the Magic Initiate parent entry in QUESTIONS.md. Two unrelated causes with
one symptom: a picker that reads `name` off data/species.json and lists
what it finds shows the player entries that are either unreadable or
indistinguishable. Both are recorded here because whatever is decided
about hiding, nesting or labelling entries has to answer both.
STATUS: decided. The built species picker (`src/species/`) implements
the answer:

- Only the newest printing of a species is offered. Entries carrying
  `reprintedAs` are filtered out, since that field is the older entry
  declaring itself superseded. No hand-written list of names is used.
  The filter lives in one place so it can be relaxed later if the table
  ever wants older printings.
- Genasi subraces are displayed with their parent's name prefixed,
  derived from `raceName` — "Genasi; Air" and so on — matching how
  `_versions` variants already name themselves. This is display only;
  the stored `name` is not rewritten.

**Cause 1 — Genasi subraces have names that mean nothing on their own**

Worse than Magic Initiate, because here the variant NAMES do not identify
their parent.

A species picker listing `name` would show five separate entries:

    Genasi
    Air
    Earth
    Fire
    Water

"Air", "Earth", "Fire" and "Water" are the four Genasi subraces. Nothing
in the name says so — the link lives in `raceName: "Genasi"` and
`raceSource: "MPMM"` (see D30, "Species variants come in TWO
shapes").

This is the ONLY species in data/ with that shape. All 87 entries were
checked: no other entry carries a `raceName` or `raceSource` field. The
other 38 variants come from `_versions` and name themselves properly
("Elf; Drow Lineage", "Dragonborn (Red)"), so they are unaffected.

Whatever is decided for Magic Initiate about hiding or nesting parents,
this one additionally needs the subrace to be DISPLAYED differently from
what `name` contains, or the player sees four bare elements.

**Cause 2 — Shifter is in the list twice, and the two are identical on
screen**

This records the situation as it stood before extraction-time
deduplication was added; the picker's `reprintedAs` filter is now a
second guard rather than the only one (see D31).

Nothing wrong with the names this time. The problem is that nine species
names occur twice over, because the species was reprinted in a second
book that is also in ALLOWED_SOURCES and both printings survive
extraction (see D31).

Shifter is the worst of them — the parent and all four of its variants
are doubled, once from EFA and once from MPMM:

    Shifter                 EFA + MPMM
    Shifter; Beasthide      EFA + MPMM
    Shifter; Longtooth      EFA + MPMM
    Shifter; Swiftstride    EFA + MPMM
    Shifter; Wildhunt       EFA + MPMM

So the picker offers ten Shifter rows where the player expects five, and
the two halves of each pair render as the same string. Aasimar,
Goliath, Changeling and Orc are doubled the same way at the parent only.

Unlike Genasi, this is not a display problem — the two entries are
genuinely different rulesets and the mechanics differ. The question is
which printing a player is allowed to pick, not how to label it.

The data can answer "which is older" without a hand-written list: the
superseded entry carries `reprintedAs` pointing at the newer one, and the
newer one has no `reprintedAs`. What it cannot answer is whether this
table wants the 2024 version only, or both.

## D24 — Where does the list of selectable LANGUAGES come from

STATUS: decided. The selectable list is `data/languages.json`, filtered to
`type === 'standard'` — the 2024 rules only allow standard languages to be
chosen at character creation; rare languages come from a DM's permission or
a feature, not the base picker. `src/languages/languageData.ts` implements
the filter.

Common is one of the ten standard entries in the data but is excluded from
the choice list: it is known automatically, not picked. The count of
languages a player CHOOSES (two, in addition to Common) is a PHB 2024 rule
stated only in book prose — nothing in data/ carries it — so it is
hardcoded as `CHOSEN_LANGUAGE_COUNT` in `languageData.ts`, with a comment
citing the rule and naming it as the place to update once class features
start granting extra languages (Rogue's Thieves' Cant plus one, Druid's
Druidic, Ranger's Deft Explorer). Those feature-granted languages are not
built yet — the wizard does not select class features at this slice.

## D25 — _copy resolution

295 entries use `_copy` (inherit from another entry), 77 also use `_mod`.
Six mod operations occur: appendArr, prependArr, insertArr, replaceArr,
removeArr, replaceTxt. All implemented in our own resolver.
Reference for semantics: js/utils.js, class _DataUtilBrewHelper,
method _doMod (~line 6094).
Copies point at sources we don't extract (PHB, DMG, SCAG, PSA, PSK,
DSotDQ), so the order is fixed: load everything → resolve copies →
expand _versions → only then filter by source. Never filter first.

## D26 — _versions and _abstract/_implementations — both implemented

_versions spawns real selectable variants (Magic Initiate → 3 class
versions). _abstract + _implementations is the template form with
{{variable}} substitution (Dragonborn → 10 colours).
Substitution applies to strings at any depth, never to object keys.
The parent entry stays selectable, matching 5etools.

## D27 — Subclass feature levels — RESOLVED, no manual work needed

5etools already ships XPHB-converted versions of XGE/TCE subclasses with
feature levels remapped to the 2024 progression (Forge Domain: level 1
and 2 features folded into level 3, level 8 features dropped).
Originals (classSource "PHB") and conversions (classSource "XPHB") both
exist in the same file. We take the conversions.

## D28 — Subclass filtering rule

classSource must be in ALLOWED_CLASS_SOURCES (XPHB, EFA) — the class
EDITION. AND source must be in ALLOWED_SOURCES — the BOOK it was printed
in. Both conditions.
All 57 XGE/TCE subclasses have XPHB conversions; all 4 TCE Artificer
subclasses have EFA conversions. Nothing is missing.

## D29 — Species scope

2024 species identified by `edition: "one"`. MPMM included as the 2014
species pool; it supersedes VGM/MTF, which are excluded as duplicates
(all 14 have reprintedAs pointing at MPMM).
MPMM has NO `ability` field — MPMM (2022) already replaced fixed ASIs
with floating ones. Nothing to strip. The stripping code is kept as a
guard and the validator asserts no species has an `ability` field.
Ability bonuses always come from the background.

## D30 — Species variants come in TWO shapes, and only one is self-describing

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
`raceName`/`raceSource` field at all (checked across all 87). See D23 —
a species picker reading `name` alone is the open question.

## D31 — Species reprints — RESOLVED, deduplicated during extraction

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
relies on (see D23).

Note this is NOT the same test as the VGM/MTF exclusion. There the whole
book was dropped up front. Here both books are wanted for other species
and only a handful of entries collided.

## D32 — Feature files kept separate, not inlined

classes.json keeps reference strings; feature text lives in
class-features.json and subclass-features.json. The app joins them via
the `id` fields. Avoids duplicating text in two structures.

## D33 — Feature reference IDs

Every feature has a stable `id`; classes/subclasses have matching
`classFeatureIds` / `subclassFeatureIds` alongside the original strings.
  cf|name|className|classSource|level|source
  scf|name|className|classSource|subclassShortName|subclassSource|level|source
All lowercase. Zero collisions, zero dangling references (744 checked).

## D34 — Item code legends

type -> itemType list in items-base.json
property -> itemProperty list, mastery -> itemMastery list (same file)
dmgType -> Parser.DMGTYPE_JSON_TO_FULL, js/parser.js:4483
rarity and weaponCategory need no lookup — already plain words.
Resolved fields added alongside originals: typeFull, propertyFull,
masteryFull, dmgTypeFull.
itemGroup (109 entries) is loaded so _copy resolves, but excluded from
output — it holds groupings, not ownable items.

## D35 — 5etools markup tags

Description text is not plain English. It contains 5etools' own syntax:
{@damage 8d6}, {@dice 1d10}, {@condition prone}, {@spell fireball},
{@item longsword}, {@variantrule Heroic Inspiration|XPHB},
{@filter Origin feat|feats|category=o}, {@scaledamage 8d6|3-9|1d6}.
Extraction leaves these untouched on purpose.

## D36 — `entries` arrays are not plain strings

They mix strings with nested objects ({type: "entries"}, {type: "list"},
tables...). The renderer recurses rather than joining.

## D37 — Languages are their own wizard step

D13 listed six category steps and folded languages into the origin
material. The built wizard has languages as a separate step between
background and ability scores.

Rationale: the number of languages a character chooses depends on
background-independent rules (see D24), and the picker needed its own
state in the wizard. Splitting it out cost nothing and made the step
list match what the player actually does.
