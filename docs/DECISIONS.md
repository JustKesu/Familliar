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
- Saving throw proficiency dává POUZE první třída. Dnešní kód ji dá,
  když ji uvede kterákoli z tříd postavy — bez multiclass UI to není
  vidět, ale při kroku 10 se to musí opravit.

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

## D38 — Kalkulační vrstva jsou čisté funkce, data se předávají dovnitř

Výpočet nikdy sám nenačítá data. Funkce dostane postavu a potřebná
data jako vstup a vrátí výsledek okamžitě.

Rationale: polovina výpočtů (proficiency bonus, modifikátory) žádná
data nepotřebuje. Kdyby si je funkce načítala sama, čekaly by i ony a
testy by musely simulovat síť. Takhle testu stačí podstrčit vymyšlená
data.

## D39 — Jedno místo, které načítá data, sdílené wizardem i sheetem

Soubor z data/ se stáhne nejvýš jednou. Kdo si o něj řekne podruhé,
dostane už staženou kopii. Nenačítá se všechno dopředu — jen to, co
si někdo vyžádal.

Rationale: wizard dneska načítá classes.json opakovaně (viz REPORT
z 2026-07-28). Sheet přidá další čtenáře stejných souborů.

## D40 — Každá spočítaná hodnota vrací rozklad, ne jen číslo

Výsledek je číslo plus seznam příspěvků, ze kterých vzniklo
("STR +3, proficiency +3 z Fightera").

Rationale: mezivýsledky uvnitř funkce stejně existují — rozklad je
jen nezahodí. Cena teď je jeden řádek na funkci; dopsat to později
znamená přepsat každou funkci i každé její volání. Zároveň je to
jediná obrana proti chybě, kterou testy nepředvídaly: u stolu je
vidět, z čeho číslo vzniklo.

## D41 — Rozklad se zobrazuje až na vyžádání

Sheet ukazuje čísla a stav proficiency. Rozklad se dopočítá a zobrazí
teprve když hráč hodnotu rozklikne.

Rationale: sheet má 18 skillů, 6 savů a další hodnoty. Rozklad u všech
naráz je nečitelný pro hráče a zbytečná práce pro prohlížeč.

## D42 — Hodnota vlastnosti je SEZNAM příspěvků, ne součet dvou čísel

Finální hodnota vlastnosti se počítá jako součet seznamu, který dnes
obsahuje základ a bonus z backgroundu. ASI a feats do něj později
přibydou jako další položky.

Nulové příspěvky se do seznamu nezapisují — rozdíl mezi "žádné ASI" a
"ASI za nula" musí být v rozkladu vidět.

Rationale: napsané jako "základ + background" by to krok 4a musel
otevřít a přepsat, a s ním i všechno, co finální hodnotu čte.

## D43 — Chybějící data nikdy neshodí sheet

Když výpočet nedokáže hodnotu určit (třída, kterou v datech nenajde),
vrátí "neznámo" a UI to zobrazí viditelně jako chybu. Funkce nespadne
a zbytek sheetu se vykreslí.

Rationale: hráč u stolu nesmí přijít o celý sheet kvůli jedné hodnotě.
Zároveň se to nesmí tvářit jako platné číslo.

## D44 — Kolize proficiency se hlásí vždy, z jakéhokoli zdroje

Rozšiřuje D18 za dvojici class/background. Jakákoli kolize — class,
background, species, feat — se hlásí a hráč si musí vybrat něco
jiného. Nic se tiše nezahazuje ani nepřeřazuje.

Když už si hráč kolizi vytvořil (například species vybraná až po
class skillech), proficiency se počítá JEDNOU a rozklad ukáže
všechny zdroje.

## D45 — Skill a save vrací číslo A stav, ne jen číslo

Stav je none / proficient / expertise, u Barda navíc poloviční
(Jack of All Trades). Sheet ho zobrazuje tečkou, ne číslem.
Model stavů musí snést přidání dalšího.

Jack of All Trades se s expertise nikdy nepotká — poloviční
proficiency platí jen tam, kde hráč proficiency nemá.

## D46 — Ověřovací skript před funkcí, test po ní

Před každým výpočtem, který čte data/, jde krátký skript, který
zjistí, jestli a v jakém tvaru tam ta data vůbec jsou. Teprve pak se
píše funkce. Testy vznikají po ní.

Rationale: u weapon mastery to odhalilo, že tři třídy počet v datech
nemají vůbec, a ušetřilo slepou implementaci.

Správnost čísel se ověřuje proti ručně dopočítaným postavám:
Fighter 5 (základ), Bard 5 (poloviční proficiency), Rogue 5
(expertise), Barbarian 1 (hraniční úroveň), Fighter 4 vs 5
(zlom proficiency bonusu).

## D47 — Rozsah kroku 4 je to, co má vstupy

Krok 4 staví: hodnoty vlastností a modifikátory, proficiency bonus,
iniciativu, saving throws, skilly, rychlost/velikost/darkvision,
hit dice pool.

AC, maximální HP, útoky a kouzelné DC se do stejné složky
(src/calculation/, rozdělené po tématech) přidají jako NOVÉ soubory
ve svých krocích (7, 8, 6). Nic z kroku 4 se kvůli nim nepřepisuje.

Volat kalkulační vrstvu smí sheet i wizard — feat prerequisity čtou
finální hodnoty vlastností (D16).

## D48 — Pasivní hodnoty patří ke skillům

Passive Perception, Passive Investigation a Passive Insight se počítají
jako 10 + bonus příslušného skillu, ve stejném souboru jako skilly
(build order krok 4). SPEC je nezmiňuje; screenshot z DnD Beyond je má
a hráči je u stolu používají.

## D49 — Expertise má vlastní krok wizardu a tři zdroje, ne jen features jménem "Expertise"

Expertise je samostatný krok mezi backgroundem a languages, zobrazený
jen tehdy, když na ni postava má nárok. Ostatní ho nevidí a číslování
kroků zůstává souvislé.
 b
Rationale: pravidlo 2024 zní "vyber ze svých skill proficiencies" —
tedy ze VŠECH, ne jen z těch od classy. V class stepu ještě není známý
background ani species, takže tam nabídka nemůže být úplná. Stejný
důvod, proč vlastní krok dostaly languages (D37).

**Které features expertise udělují.** Ne jen těch šest, které se tak
jmenují (Bard 2/9, Ranger 9, Rogue 1/6):

- "Deft Explorer" (Ranger, level 2) — ANO. 1 skill, volný výběr.
  Jméno feature to neříká, próza ano.
- "Scholar" (Wizard, level 2) — ANO. 1 skill, ale jen z Arcana,
  History, Investigation, Medicine, Nature, Religion, a jen z těch,
  ve kterých už postava proficiency má. Nabídka je průnik obou
  podmínek; prázdný průnik se hlásí plainem, nespadne.
- "Infiltration Expertise" (Rogue/Assassin, level 9) — NE. Navzdory
  jménu neuděluje skill expertise vůbec: je to Masterful Mimicry
  a výjimka na Speed.

Feature se tedy nepozná podle jména, ale podle prózy obsahující
{@variantrule Expertise|XPHB}.

**Počet skillů ani seznam u Scholara nejsou v datech strukturovaně** —
existují jen v próze. Obojí je natvrdo v expertiseData.ts
s komentářem, odkud pochází. Stejný případ jako CHOSEN_LANGUAGE_COUNT
(D24).

## D50 — Features odkazované zevnitř textu se sbírají rekurzivně

Extrakce sbírá class/subclass features nejen podle seznamů
`classFeatureIds` / `subclassFeatureIds`, ale i podle uzlů `ref*`
uvnitř textu už posbíraných features. Sbírá opakovaně, dokud seznam
roste; každá feature se zpracuje jednou.

Důvod: 295 z 335 odkazů uvnitř textu nemělo v data/ cíl. Circle of
Spores odkazoval na "Circle Spells", "Halo of Spores" a "Symbiotic
Entity" — žádná z nich nebyla vyextrahovaná, protože v žádném ID
seznamu není. Zanoření se ustálí po jednom dalším kole.

Počty: class-features.json 279 -> 302, subclass-features.json
465 -> 786.

**Co D33 ve skutečnosti ověřovalo.** "Zero dangling references, 744
checked" platilo jen pro ID seznamy, ne pro odkazy uvnitř textu. Nebyl
to špatný výsledek, jen užší, než se dalo číst. `check-dangling-refs.js`
teď kontroluje obojí — 420 odkazů uvnitř textu, nula nevyřešených.

Odkaz refOptionalfeature na Fighting Style se kontroluje proti
feats.json category "FS" podle D12, ne proti optional-features.json.

## D51 — Rozbalení odkazu na feature je vlastní vrstva vedle rendereru

`src/featureResolver/` dohledá, na co odkaz ref* ukazuje, a vrátí text
cílové feature. Renderer v src/markup/ se nemění a dál zobrazuje jen
jméno — D7 platí beze změny, tahle vrstva stojí vedle něj, ne uvnitř.

Cíle se hledají podle `id` (D33); UID v odkazu
("Rage|Barbarian|XPHB|1|XPHB") je přesně to `id`. Fighting Style se
resolvuje proti feats.json category "FS" (D12).

Rozbalování je rekurzivní — text feature může odkazovat na další.
Každá feature se v řetězci rozbalí jednou, což je pojistka proti
smyčce.

Zobrazení: `<details>`, výchozí stav sbalený. Sbalení není kosmetika —
bez něj by picker vypsal plný text všech features u všech nabízených
subclass naráz. Nenalezený cíl zobrazí jméno plus viditelnou poznámku
(D43); dnes k tomu nedochází, validátor hlásí nula nevyřešených.

Nasazeno v subclass pickeru, fighting style pickeru a subclass
optional-feature pickeru.

## D52 — Chybu stažení řeší volající, ne loader

Když loader nedokáže soubor z data/ stáhnout, chybu propustí ven a
nechá rozhodnutí na tom, kdo si o data řekl. Sám nezkouší znovu
a nenahrazuje chybějící data prázdnými.

Rationale: jen volající ví, jestli je bez toho souboru obrazovka
nepoužitelná, nebo jde vykreslit zbytek (D43). Prázdná data místo
chyby jsou nejhorší varianta — picker by vypadal jako "není z čeho
vybírat" a hráč by se nedozvěděl, že šlo o výpadek sítě.

Neúspěšné stažení se do cache nezapisuje: další vyžádání téhož
souboru to zkusí znovu, jinak by jeden výpadek zablokoval soubor do
konce session.

## D53 — Subrace dědí od rodiče jen to, co sama nenese

Když entry species nemá pole rychlost / velikost / darkvision, vezme
se hodnota z rodičovské entry přes raceName/raceSource. Vlastní
hodnota má vždy přednost — Genasi; Air si rychlost 35 podrží, dědí se
jen chybějící pole. Když pole nemá ani rodič, je to "neznámo" (D43).

Rationale: 5etools u subrace zapisuje jen to, čím se liší od rodiče.
Chybějící pole tedy neznamená chybějící údaj, ale shodu s rodičem.
Je to stejný mechanismus, jaký speciesData.ts už používá na zobrazení
jména (D30) — jen rozšířený na další pole.

Rozklad musí ukázat, že hodnota přišla od rodiče, ne holé číslo.

## D54 — Nevybraná velikost je "neznámo", ne Medium

23 species (Human, Aasimar, Tiefling a další) nabízí volbu Small nebo
Medium. Dokud ji hráč neudělá, velikost se hlásí jako nevyřešená —
nedosazuje se Medium.

Rationale: jiný případ než D53. Tam data mlčí, protože hodnota je
jednoznačná. Tady mlčí, protože se hráč ještě nerozhodl. Dosazený
default se na sheetu tváří jako spočítaná hodnota a hráč nepozná
rozdíl mezi "vybral jsem Medium" a "appka to zvolila za mě". Rozdíl
mezi Small a Medium přitom u některých zbraní a průchodnosti je.

Až přibude krok wizardu na volbu velikosti, "neznámo" zmizí samo —
nebude co přepisovat.

## D55 — Feat se strukturovaným efektem se aplikuje, prózový se zobrazí a ohlásí

113 ze 128 featů nese aspoň jedno strukturované pole (nejčastěji
bonus k vlastnosti: 82 featů, z toho 13 pevných a 70 s volbou).
Ty se aplikují automaticky — bonus k vlastnosti přibude jako další
položka do seznamu příspěvků (D42), stejně tak skill/save/tool
proficiency, expertise, resistance, smysly a bonusová kouzla.

15 featů má efekt jen v próze. Ty se hráči zobrazí jako text
a použije je ručně, jako u papírového sheetu. Neaplikovaný neznamená
chybějící.

**Prózový feat, který mění POČÍTANOU hodnotu, se u té hodnoty
ohlásí.** Nedopočítá se — v rozkladu (D40) se objeví poznámka, že
feat efekt má a není započítaný. Hráč si ho přičte sám a ví proč.
K tomu slouží krátký ruční seznam "feat -> dotčená hodnota", jen pro
tyhle případy. Není to tabulka 128 výjimek, které se D21 vyhýbá —
je to nejvýš 15 položek a většina z nich žádnou počítanou hodnotu
nemění.

Známý případ dnes: Alert mění iniciativu, která se počítá od kroku 4.
Dueling, Archery a Defense míří na útoky a AC (kroky 7 a 8) — tam se
seznam doplní, až ty hodnoty vzniknou.

Prerekvizity mají 13 různých tvarů, 15 featů žádnou nemá. Vynucují se
podle D19.

"Ability Score Improvement" je ve feats.json obyčejný záznam se stejným
tvarem jako half-featy — D20 ho nemusí řešit jako zvláštní případ
mimo seznam.

## D56 — Úrovně s nárokem na feat/ASI se čtou z dat, ne z pevného výčtu

SPEC.md uvádí úrovně 4/8/12/16/19. To je zjednodušení a neplatí:
většina tříd má "Ability Score Improvement" na 4/8/12/16, Fighter
navíc na 6 a 14, Rogue navíc na 10. Nárok se proto čte
z class-features.json, ne z konstanty.

Úroveň 19 je v datech samostatná feature "Epic Boon", ne opakování
ASI. Nabízí ale stejnou volbu.

**Kategorie EB není omezení.** V datech vypadá jako filtr, pravidlo
jím ale není — ověřeno proti PHB 2024: hráč si bere Epic Boon feat
NEBO jiný feat dle své volby, na který splňuje podmínky. D19 tedy
platí i na úrovni 19: seznam se nefiltruje podle kategorie, EB featy
se jen řadí nahoru jako doporučená zásoba.

Dva tvary prerekvizit appka vyhodnotit nemůže: `campaign` (kampaň
v Eberronu) a `otherSummary` (vázané na okamžik, kdy třída sama
uděluje fighting style). Obojí se hlásí jako nesplněné s viditelným
důvodem — stejně jako každá jiná nesplněná podmínka, ne zvláštní
případ.

## D57 — Vybraná vlastnost se u featu ukládá jen tam, kde je co vybírat

Feat s volbou vlastnosti (68 kusů) nese u uložené volby i to, kterou
vlastnost hráč zvolil. Feat s pevným bonusem (13 kusů) takové pole
nemá vůbec — nezapisuje se prázdné.

Rationale: stejný důvod jako u nulových příspěvků v D42. Prázdné pole
se později čte jako "hráč nevybral", což u featu s pevným bonusem
není pravda — vybírat nebylo co.

Krok wizardu nejde dokončit, dokud volba u takového featu chybí.
Jinak by vznikla postava s featem, u kterého se neví, co zvyšuje.

## D58 — Feat čekající na volbu se hlásí jinak než feat nezapočítaný

Dvě různé poznámky v rozkladu, které se nesmí splést:

- "efekt není započítaný" (D55) — appka ten druh efektu neumí
  spočítat vůbec. Hráč si ho dopíše natrvalo.
- "čeká na volbu" — mechanismus je známý a strukturovaný, chybí jen
  pick hráče, protože wizard nemá kam ho uložit. Až picker přibude,
  poznámka zmizí sama.

Týká se 5 featů (Keen Mind, Observant, Prodigy, Squat Nimbleness,
Skill Expert) plus pole `expertise` u tří featů, které je vždy
"vyber jeden skill, ve kterém už proficiency máš". Poznámka se
připojí ke každému skillu, na který volba může dopadnout — u
`expertise` tedy ke všem, ve kterých postava proficiency má.

## D59 — Resilient: uložená vlastnost řeší i save proficiency

Resilient jako jediný feat nese `savingThrowProficiencies` a jeho
seznam je totožný s jeho vlastním `ability` seznamem. Uložený
`chosenAbility` (D57) tedy určuje obojí — žádné druhé pole se
neukládá.

Ověřeno čtením textu featu, ne odhadem z tvaru dat.

## D60 — Příspěvek bez čísla

Položka v rozkladu (D40) může nést poznámku místo částky; částka je
pak nula, takže se součet nemění. Slouží jen pro případy z D55 a D58.

## D61 — Cantrips and leveled spells are returned in one list, flagged by level

The class-spell-list function returns cantrips (level 0) and leveled spells
(1-9) in a SINGLE list, each spell carrying its own level, rather than split
into two separate lists at the function level. Splitting into "cantrips" vs
"spells" happens only at display time. Rationale: filtering by level is needed
regardless (a character can only take spells up to a level it has access to),
so a cantrip is just "level 0" in the same filter; splitting early would mean
two parallel code paths for what is one operation.

## D62 — Subclass additionalSpells: first pass supports only the `prepared` shape

72 of 114 subclasses carry an `additionalSpells` field, but in 14 distinct key
shapes (`prepared`, `known`, `innate`, `expanded`, plus variants carrying
`ability`/`resourceName`/`name`) — confirmed by scripts/investigate-spells.js.
The first implementation of subclass-granted spells (a later slice of step 6)
will support only the `prepared` shape — the always-prepared domain/oath/circle
spells that don't count against preparation limits, which is both the most
common shape and the SPEC-critical one. The other shapes are deferred and added
incrementally, not all at once. Rationale: supporting all 14 shapes in the
first pass would balloon that slice; `prepared` covers the core case and the
rest can follow one shape at a time. (This decision is RECORDED now but
implemented later — it is NOT part of slice (c), which does class spell
lists, not subclass spells.)

## D63 — Class feature choices are a new build order step (6a), separate from play-tracking

The build order gains step 6a, "Class feature choices," covering selectable class/subclass features the player must choose — Warlock Eldritch Invocations, Fighter Battle Master Maneuvers, and other "choose N from a list" features — including their wizard picker, storage, sheet display, and the subset whose choice modifies a calculated value (e.g. an invocation adding a Charisma bonus to a cantrip's damage), which feeds the affected value's breakdown the same way feats already feed the calculation layer.

Scope boundaries. IN: the selection of these features, their persistence, their display, and calculation effects that follow directly from the selection. NOT IN (deferred to step 9, Play tracking and rests): usage trackers and rest replenishment — Rage count, Channel Divinity charges, Lay on Hands HP pool, and long/short-rest refresh of any resource. Step 6a records WHICH features a character has; step 9 tracks their per-day/per-rest USE. Unchanged: pure-text features already shown by the feature renderer (e.g. Rage's description) need no new work here.

Rationale. These selectable features were absent from the original build order. They are creation-time choices like spells and feats, so they belong near those steps (hence 6a, after spells). They are distinct from usage tracking, which is inherently a play-time concern already scoped to step 9. Separating the two keeps each step bounded.

Existing coverage. Some selectable features are already partially handled — the optional-feature picker (src/optionalFeatures/) covers Battle Master Maneuvers, Rune Knight Runes, Arcane Shot, and College of Swords Fighting Style. Step 6a's first task is to assess this existing coverage and extend it (Warlock Invocations being the main known gap) rather than rebuild it.

## D64 — Volby, jejichž podmínky závisí na kouzlech, mají krok až za kouzly

D13 říká, že všechny class volby patří do class kroku. Platí to dál
s jednou výjimkou: class-level optional features (Sorcerer Metamagic,
Warlock Eldritch Invocations) dostávají vlastní krok wizardu až ZA
krokem Kouzla.

Rationale: několik invokací má prerekvizitu na už známý cantrip
s poškozením — Agonizing Blast, nejčastěji braná invokace ve hře, je
jednou z nich. V class kroku, který běží před výběrem kouzel, jsou
takové volby při prvním průchodu nedostupné a hráč se k nim musí
vracet. Přesunutí kroku ten problém odstraní místo toho, aby ho
vysvětlovalo.

Subclass-level optional features (Battle Master Maneuvers, Rune Knight
Runes, Arcane Shot, College of Swords Fighting Style) zůstávají v class
kroku beze změny — žádná z nich na kouzlech nezávisí.

## D65 — Poznámka v rozkladu platí i pro hodnoty, které nejsou součtem

D60 zavedl položku rozkladu bez čísla pro dva případy z D55 a D58.
Rozšiřuje se na každou hodnotu, která vzniká výběrem maxima místo
součtem — dnes darkvision ze species a z feature.

Vítězný zdroj nese svou hodnotu, ostatní nulu a poznámku, proč neplatí.

Rationale: součet položek rozkladu se musí rovnat výsledku, jinak by
rozklad u stolu nedával smysl. Kdyby každý zdroj nesl svou skutečnou
hodnotu, darkvision 60 od species a 120 od feature by se sečetly na 180.

## D66 — Podmínky kroků wizardu cestují jako pojmenovaný objekt

Funkce ve `wizardState.ts`, které rozhodují o viditelnosti a
dokončitelnosti kroků, neberou podmínky jako poziční parametry, ale jako
jeden objekt `WizardStepConditions` s pojmenovanými poli. Výchozí hodnoty
se dosazují na jednom místě, ne v každé funkci zvlášť.

Rationale: každý nový podmíněný krok přidával další poziční parametr;
došlo se na devět, většinou čísel a booleanů, kde prohození dvou projde
typovou kontrolou a projeví se až jako přeskočený nebo zablokovaný krok
u hráče. Další podmíněný krok proto přidává POLE do objektu, ne parametr
do funkce.

Nahrazuje otevřenou otázku "wizardState.ts — poziční parametry se blíží
limitu" (QUESTIONS.md), která tímto z toho souboru odchází.

## D67 — XMM je povolený zdroj, ale jen pro beasty

Monster Manual 2024 (XMM) se přidává do extrakce výhradně pro tvory typu
beast do CR 6, kvůli Wild Shape a Find Familiar. Ostatní monstra z něj se
neextrahují.

Rationale: projekt jinde důsledně drží edici 2024 (XPHB) a Find Familiar
ve svém vlastním textu odkazuje přímo na XMM záznamy. Brát beasty ze
starého Monster Manualu by znamenalo mít na sheetu statblok z jiné edice,
než jaká se hraje — a u zvířat se hodnoty mezi edicemi liší. Jediný zdroj
zároveň znamená, že nemůže vzniknout dvojí verze téhož zvířete, takže
odpadá deduplikace, kterou si u species vyžádal D31.

## D68 — Když si data a pravidla 2024 odporují, platí pravidla

5etools nese u některých záznamů příznaky a seznamy zděděné z edice 2014.
Kde takový příznak nesouhlasí s textem pravidla 2024, appka se řídí
pravidlem a příznak ignoruje. Nemaže se z dat — jen se nepoužije.

První případ: `familiar: true` označuje 25 tvorů, ale Find Familiar
v edici 2024 dovoluje beasta s CR 0, kterých je 24. Navíc je označený
Venomous Snake (CR 1/8), kterého jmenovitě dovolovala pravidla 2014.
Seznam forem pro familiara se proto odvozuje z CR, ne z příznaku.

Rationale: SPEC říká, že appka nabízí jen platné možnosti. Příznak od
dodavatele dat není pravidlo a nikdo ho neudržuje kvůli téhle appce.
Odvození z pravidla je zároveň odolnější — když přibude nový beast s CR 0,
objeví se v nabídce sám, i kdyby ho nikdo neoznačil.

## D69 — Od příštího bumpu schématu se píše migrace

Dosud každá změna verze schématu uloženou postavu odmítla (D1 verzování
zavedl právě proto, aby to jednou nemuselo platit). Od příští změny to
končí: každý další bump MUSÍ umět načíst postavu z bezprostředně
předchozí verze a převést ji.

Zpětně se nic nedohání — postavy ve verzích 1 až 16 nikdo nemá.

Rationale: migrace fungují jako řetěz kroků, kde každý umí jen o jednu
verzi zpět. Začít až v okamžiku, kdy existuje postava, o kterou nechceš
přijít, znamená mít v řetězu díru přesně tam, kde na ní záleží. Cena
jednoho kroku je malá, cena chybějícího kroku je ztracená postava.

Import souboru se řídí týmž pravidlem: exportovaná postava o verzi starší
se převede, ne odmítne. D1 dál platí v tom, že nerozpoznaný nebo poškozený
soubor se odmítá a nic nemění.

## D70 — Počty, které data nesou jen v próze nebo ve jméně feature, se opisují do krátké tabulky

Weapon Mastery u Paladina, Rangera a Roguea (počet zbraní je jen v próze
feature) a Extra Attack (počet útoků je ve jméně feature — "Extra Attack",
"Two Extra Attacks", "Three Extra Attacks") se řeší ručně opsanou tabulkou
s komentářem citujícím PHB 2024, ne parsováním textu.

Stejný precedens jako CHOSEN_LANGUAGE_COUNT (D24), počty skillů
v expertiseData.ts (D49) a EXTRA_CANTRIP_OPTIONS. Jde o jednotky položek,
ne o rostoucí seznam výjimek, kterému se vyhýbá D21.

Rationale: parsování prózy je křehké vůči formulaci a špatně se testuje;
u tří tříd a čtyř úrovní je ruční tabulka menší, čitelnější a poznatelně
špatná, když se splete. Obojí se dodělá až těsně před krokem 7, kde se to
poprvé použije.

## D71 — Kolize se hlásí i u kouzel, nejen u proficiencies

D18 a D44 říkají, že dovednost, kterou postava už má z jiného zdroje,
zůstane v pickeru vidět, ale nejde vybrat a je u ní napsáno, odkud ji má.
Totéž platí pro kouzla.

Kouzlo, které postava už má — z kroku Kouzla, jako always-prepared od
subclassy, z featu nebo z vybrané invokace — se v každém jiném pickeru
nabízí zašedle s uvedením zdroje. Nikdy se tiše neschová a nikdy se tiše
nezahodí.

Dvě pojistky, obě nutné: picker nikdy nezakáže položku, kterou drží jeho
vlastní výběr (jinak by ji nešlo odebrat), a už zaškrtnutá položka se
nezakazuje nikdy — jinak by mohla uvíznout nezapočítaná a neodebratelná.

Rationale: hráč v jednom kroku wizardu nevidí, co si vybral o tři kroky
dřív ani co dostal zadarmo od subclassy. Bez tohohle pravidla utratí
jeden ze tří cantripů Pact of the Tome za kouzlo, které už má — což se
při ručním testu Warlocka skutečně stalo. Zákaz sám nestačí: bez uvedení
zdroje hráč nepozná, jestli je volba zakázaná chybou, nebo právem.

Platí i pro každý budoucí picker, který nabízí kouzla.

## D72 — XMM má druhý, jmenný vstup: tvory, které nějaká feature vyjmenuje

Doplňuje D67, které říkalo, že z XMM se berou výhradně beasti do CR 6. To
už doslova neplatí a tenhle záznam to opravuje, D67 se nepřepisuje.

Extrakce má nově dva vstupy z XMM:

1. tvorové typu beast do CR 6 (D67, beze změny), a
2. krátký JMENNÝ seznam tvorů, které nějaká feature v appce výslovně
   uvádí. Dnes je to osm forem, které jmenuje Pact of the Chain: Imp,
   Pseudodragon, Quasit, Skeleton, Slaad Tadpole, Sphinx of Wonder,
   Sprite a Venomous Snake. Sedm z nich není zvíře.

Jména se čtou z textu té feature, ne z paměti, a rozšířit seznam smí jen
další feature, která nějakého tvora jmenuje — ne úvaha, že by se něco
hodilo. Cokoli, co žádná feature nejmenuje, zůstává venku.

Důsledek, na který se musí myslet: `beasts.json` už neobsahuje jen
zvířata. Každý filtr, který předpokládal opak, musí typ ověřovat sám —
jinak by Wild Shape nabídl podobu kostlivce. Na to se přišlo hned při
zavedení tohohle druhého vstupu.

Rationale: bez těch forem je Pact of the Chain prázdná invokace, protože
právě ony jsou důvod, proč si ji hráč bere. Jmenný seznam je zároveň
nejužší možné rozšíření — nepouští dovnitř celý bestiář ani celou
kategorii, a validátor hlídá, že v datech opravdu jsou.

## D73 — Popisek použití říká, co říká text zdroje, ne co je v datech

Kouzlo udělené nějakou feature nese na sheetu popisek toho, jak se sesílá
(„bez slotu", „1/dlouhý odpočinek"), jen tehdy, když to text té feature sám
určuje. Obal v datech je vodítko, ne pravda.

Konkrétně: klíč `daily` znamená v edici 2024 téměř vždy „jednou za dlouhý
odpočinek", ne „jednou denně". Ověřeno na všech 51 zdrojích, které ho nesou —
49 z nich mluví o dlouhém odpočinku, dva o krátkém nebo dlouhém a ani jeden
o dni nebo o úsvitu. Popisek „1/day" se proto nepoužívá vůbec.

Kde se text vymyká, je to ručně zapsaná výjimka s citací té věty, ne
odvozování z tvaru dat (stejný precedens jako D70). Kde text neříká nic,
popisek se nezobrazuje — nikdy se nedomýšlí frekvence.

Rationale: špatný popisek je horší než žádný. Hráč, který u kouzla čte
„1/day", ho použije podruhé po půlnoci; hráč, který nečte nic, si to dohledá
v knize. Chybějící informace se pozná, vymyšlená ne.

Platí i na frekvenci, kterou by šlo vyčíst z prózy: parsovat text na počty
se nedělá (D21). Buď je to strukturované, nebo v ručním seznamu, nebo se
mlčí.

## D74 — Peníze jsou jedno číslo v měďácích

Uloženo je `currencyCopper`, jedno nezáporné celé číslo. Mince — platina,
zlato, stříbro, měď — existují jen při zobrazení a zadávání; převod je
funkce nad tím jedním číslem, ne pět uložených polí.

Elektrum se nemodeluje: edice 2024 ho zrušila. Platina ano, 1 pp = 10 gp.

Rationale: pět samostatných polí umí být ve sporu samo se sebou — co
znamená uložených 15 stříbrných a zároveň 200 měďáků? — a každý výpočet by
je musel nejdřív srovnat. `value` v items.json je navíc taky v měďácích,
takže nakupování v pozdější slici nepotřebuje žádný převod.

Cena, kterou to má: zadaná částka se při dalším vykreslení normalizuje.
Napíšeš 25 do stříbra a uvidíš 2 zlaté a 5 stříbrných. Je to správně
spočítané, jen se číslice přesunou mezi poli.

## D75 — Předmět smí do dat mimo povolené zdroje, jen když ho nějaká feature jmenuje

Extrakce items.json má druhý, JMENNÝ vstup vedle filtru zdrojů: předmět,
který výslovně jmenuje výchozí výbava nějaké třídy nebo backgroundu, se
vezme i z knihy, která jinak povolená není.

Dnes je to jediná položka — Spellbook z PHB. Edice 2024 vlastní záznam
nemá a Wizard bez knihy kouzel nedává smysl; bez tohohle vstupu by ho
appka zapsala jako odkaz, který se nikdy nedohledá.

Je to přímá obdoba D72, které totéž zavedlo pro tvory (formy, které
jmenuje Pact of the Chain). Rozšířit seznam smí jen další feature, která
něco jmenuje — ne úvaha, že by se předmět hodil. Validátor kontroluje, že
jmenované položky v datech opravdu jsou, aby je příští změna extrakce
tiše nevyhodila.

Neplatí to na kategorie: kódy jako „hudební nástroj", „svatý symbol",
„sada na hry" a „druidské ohnisko" nejsou chybějící předměty, ale skupiny,
ze kterých si hráč vybírá. Ty řeší picker ve výchozí výbavě, ne extrakce.

## D76 — Co appka nevidí jako aktivní, to nezapočítá

Když appka pozná, že postava nějakou schopnost nebo kouzlo MÁ, ale neumí
zjistit, jestli je právě teď v účinku, nezapočítá to do výsledné hodnoty.
Zobrazí to jako zváženého kandidáta s poznámkou, kolik by to dělalo
a proč se to nepoužilo.

První případ: Mage Armor. Wizard, který ho má připravené, má AC 10 + Dex,
ne 13 + Dex; v rozkladu stojí, že s ním by to bylo o tři víc a že se
kouzlo sesílá při hraní.

Rationale: chyba směrem nahoru je horší než dolů. Nízké číslo
s vysvětlením donutí hráče se podívat; vysoké vypadá správně a pozná se,
až ho něco trefí.

Platí to i na Barkskin, Shield of Faith, Haste a každý další buff, který
mění spočítanou hodnotu. Až krok 9 bude vědět, co je právě v účinku,
změní se kandidát v započítanou položku — bez další změny pravidla.

Nezaměňovat s D55 („efekt není započítaný", protože ho appka neumí
spočítat vůbec) ani s D58 („čeká na volbu"). Tady appka efekt spočítat
umí; jen neví, jestli platí.

## D77 — Kterou vlastností se útočí, rozhoduje zbraň, ne hráč

Melee zbraň používá Sílu, ranged (type R) Dexteritu. Výjimku dělá jen
Finesse: tam appka vezme vyšší z obou a hráč to smí přepsat volbou
uloženou na řádku inventáře — volba tak zanikne spolu se zbraní a nemůže
ji přežít.

Monk je druhá výjimka a jiného druhu: Martial Arts nedává volbu, ale
nahrazuje pravidlo. U Unarmed Strike a monk zbraní se počítá Dexterita,
pokud je vyšší. Monk zbraň se pozná strukturálně — simple melee, nebo
martial melee s vlastností Light — ne z textu feature (D21).

Ostatní zbraně volbu nemají a picker ji nenabízí. Kdo chce útočit Silou
s lukem, nedělá chybu v appce, ale v pravidlech.

## D78 — Attunement se zobrazuje celý, vynucuje se jen to, co je jisté

Naladění je stav na řádku inventáře, ne samostatný seznam. Vynucuje se
počet — tři předměty, u Artificera 4/5/6 od úrovně 10/14/18 — protože to
je ploché pravidlo.

Podmínka vyjádřená slovy („by a spellcaster", „by a creature of good
alignment") se ukáže hráči tak, jak ji píšou data, a appka ji nekontroluje:
půlku z nich zjistit neumí a číst je by znamenalo rozebírat prózu (D21).
Strukturální je jen „vyžaduje / nevyžaduje", a podle toho se řídí, jestli
se u předmětu vůbec objeví přepínač.

Naladění samo o sobě nic nepočítá. Je to brána, kterou si přečtou slice e
(magic bonusy) a f (resistance) — prsten s resistancí nenaladěný nefunguje.

Překročený limit, který přišel zvenčí — z importu nebo z ručně upraveného
úložiště — se zobrazí, jak je („5 ze 4"), a neořezává se potichu. Odmítá se
jen nové naladění, ne existující stav; jinak by appka mazala data, kterým
nerozumí.

## D79 — Magický bonus: datový a ruční se nikdy nesčítají

Předmět může mít bonus ze dvou stran: z dat (`bonusWeapon`, `bonusAc`) nebo
ručně nastavený hráčem (+1/+2/+3). Použije se vždy jen jeden — ruční nahrazuje
datový — a v rozkladu je vidět, který vyhrál a co by dal ten druhý. Sčítat je
by z „+1 Longswordu" nastaveného na +1 udělalo +2.

Ruční bonus se nabízí na každé zbrani, zbroji a štítu, které postava vlastní,
a nevyžaduje naladění: je to způsob, jak si hráč nebo DM udělá magickou verzi
běžného předmětu, ne skutečný magický předmět z knihy. Naladění se vynucuje jen
tehdy, když ho vyžaduje sám předmět v datech — pak se bonus nezapočítá a ukáže
se jako zvážený kandidát s důvodem (D76, D78).

Bonus je vidět v názvu („Longsword +1"), protože v inventáři vedle sebe stojí
dva jinak stejné předměty. Název skládá jedno místo, takže se stejná zbraň
nikde nejmenuje jinak. Barevné odlišení sem nepatří — to je vizuální průchod,
mimo fázi 1.

## D80 — Deset prstenů odolnosti dostává naladění zpátky

`Ring of Fire Resistance` a jeho devět sourozenců v datech XDMG postrádají pole
o naladění, které kniha z roku 2024 vyžaduje. Extrakce jim ho vrací. Není to
nové pravidlo, jen použití D68: když se data a pravidla rozcházejí, platí
pravidla.

Rozšířit ten seznam smí jen další doložený rozpor s knihou, ne dojem, že by se
něco hodilo jinak. `Eyes of the Eagle` v něm schválně není — tam edice 2024
naladění zrušila doopravdy, takže data mají pravdu a kniha z roku 2014 je
zastaralá.

Validátor kontroluje, že těch deset v datech je a nese příznak, aby je příští
změna extrakce tiše nevyhodila (stejná ochrana jako u D75).

Co tím ale nevíme: že jinde problém není. Porovnání proběhlo jen na jednom poli
a jen mezi předměty, které v obou edicích existují pod stejným názvem. Rozpor,
který 5etools nikdy nezapsal, se takhle najít nedá — není co s čím porovnat.
Je to oprava jednoho doloženého případu, ne důkaz, že data jsou jinak správně.

## D81 — Rasa s neprovedenou volbou neprojde wizardem

Když rasa nese volbu, kterou kniha vyžaduje při tvorbě postavy — elfí linie,
dračí předky, tieflingovo dědictví, gnómí linie, obří předky — wizard nepustí
dál, dokud ji hráč neudělá. Nezobrazí se nedodělaná postava s poznámkou; prostě
to nejde odklikat.

Data nabízejí obojí: holý záznam („Elf") i předrozbalené varianty
(„Elf (Drow)"). Varianty čísla nesou správně, holý záznam má na jejich místě
nevyřešenou strukturu — a hráč, který klikne na něj, dostane postavu
s darkvision 60 místo 120 a nemá jak poznat, že je to špatně. Dvoje dveře,
jedny nikam.

Platí to jen na volby, které kniha váže k tvorbě postavy. Aasimarova Celestial
Revelation se vybírá při každé proměně, ne jednou — ta sem nepatří a řeší ji
krok 9.

Tohle je zúžení D58: „čeká na volbu" je správné zobrazení pro volbu, kterou
hráč udělat teprve může. Volbu, kterou udělat musel, appka nemá vykreslovat
jako čekající, ale vynutit.

## D82 — Vynucení volby u rasy má dvě podmínky, ne jednu

Doplňuje D81. Tam stálo, že wizard nepustí dál rasu s nevyřešenou volbou.
To je správně, ale nepokrývá to všechno.

Průzkum dat našel osm rodin variant: Dragonborn (10), Goliath (6), Shifter (4),
Genasi (4), Elf (3), Kobold (3), Tiefling (3), Gnome (2). U části z nich se
varianty od základního záznamu liší v polích, která appka počítá — Genasi
v devíti polích včetně `resist`, `speed` a `darkvision`. Ale u Goliatha
a Shiftera se liší **jen v próze**. Základní záznam u nich nenese nevyřešenou
volbu, protože není co nechat nevyřešené, a přesto kniha volbu vyžaduje.

Volba se tedy vynutí, když je splněna kterákoli z těchto podmínek:

1. záznam nese nevyřešenou volbu (`choose`) — sem patří Genasi, Elf,
   Dragonborn, Tiefling;
2. záznam je základem rodiny variant — sem navíc patří Goliath a Shifter.

Druhá podmínka je ta důležitá, protože ji nejde odvodit z jednoho záznamu:
poznává se tím, že vedle něj v datech stojí sourozenci. Kdo by hledal jen
nevyřešené volby, dvě rasy by minul a nepoznal by to.

Vedlejší zjištění: hypotéza, že rasy z MPMM přidávají atributy jako edice 2014,
je vyvrácená. MPMM je právě ta kniha, která rasové bonusy zrušila — `ability`
nenese ani jeden z 78 záznamů v `data/species.json` a `computeAbilityScore`
sčítá jen základ, povolání a featy. Rasa do atributů nemluví vůbec.

## D83 — O tom, kam volba patří, rozhoduje kniha, ne to, jak vypadá

Volby vypadají zvenčí stejně — vybíráš jednu možnost z několika a něco na tom
závisí. Rozdíl je v tom, kdy ji kniha nechá udělat, a podle toho se liší, kam
v appce patří.

Volba, kterou hráč udělá jednou při tvorbě postavy nebo při postupu na úroveň,
se ukládá a vynucuje ve wizardu: druh džina u Warlocka, božská spřízněnost
u Divine Soula, prostředí u Storm Heralda, linie u ras.

Volba, kterou pravidla nechají změnit po odpočinku nebo při každém použití, se
neukládá jako součást postavy a do wizardu nepatří vůbec. Je to stav při hraní
a řeší ji krok 9: krajina u Circle of the Land (po dlouhém odpočinku),
souhvězdí u Circle of the Stars (při každé proměně), model zbroje u Armorera
(po odpočinku), Celestial Revelation u Aasimara (při každé proměně).

Rozpoznat to podle dat nejde — obojí vypadá v JSON stejně. Pozná se to jen
z věty v knize, která říká „whenever you finish a Long Rest" nebo „when you
select this species". Proto se každý nový případ ověřuje proti knize, ne proti
datům.

Do kroku 9 to nepadá tiše: dokud tam ten stav není, sheet hodnotu nezobrazí
jako správnou, ale jako nedostupnou s důvodem (D76).

## D84 — Rodinu pozná jen sourozenectví, ne nevyřešená volba

D82 uvádělo dvě podmínky, za kterých wizard vynutí volbu u rasy. Při
implementaci se ukázalo, že první z nich — „záznam nese nevyřešenou volbu" —
vzatá doslova blokuje 33 ras, které volbu mají, ale žádnou variantu, kterou by
ji šlo vyřešit: jsou to volby dovedností a kouzel, ne linií. Zúženo na pole,
která appka počítá, splňují první podmínku jen Dragonborn a Tiefling, a ti jsou
rodiny tak jako tak.

Operativní test je tedy jediný: **je ten záznam základem rodiny variant?**
Druhá podmínka z D82 je nadmnožinou první a stačí sama.

Rodinu přitom poznáš třemi tvary, ne dvěma:

1. `"Elf; Drow Lineage"` — středník;
2. `"Dragonborn (Black)"` — závorky;
3. `raceName` / `raceSource` — Genasi, jehož varianty se jmenují jen „Air",
   „Earth", „Fire", „Water".

Kontrola postavená na jednom z těch tvarů propustí deset Dragonbornů.

Popisek volby se bere z nadpisu, kterým ji pojmenovává rodičovský záznam —
„Elven Lineage", „Draconic Ancestry", „Giant Ancestry", „Fiendish Legacy",
„Gnomish Lineage", „Kobold Legacy", „Shifting". Genasi žádný takový nadpis
nemá, a proto se u něj používá „Element": hráč tam hledá vzduch, zemi, oheň
a vodu, ne rodokmen.

## D85 — Co postava drží, se počítá na ruce, ne na kusy

Slice b určila, že zbraň se drží bez omezení a pravidlo jednoho kusu platí jen
na zbroj a štít. Při proklikání se ukázalo, že to pouští greatsword a greataxe
naráz, a že obouruční zbraň nesundá štít.

Správný model není limit na počet zbraní, ale **dvě ruce**: štít zabere jednu,
obouruční zbraň obě, ostatní zbraně jednu. Co se nevejde, vytlačí to nejstarší
drženou věc a řekne se to. Dva shortswordy tím zůstávají legální — jsou to dvě
jednoruční zbraně, ne výjimka z pravidla.

Versatile zbraň drží hráč jednou nebo obouruč, volba se ukládá na řádku
inventáře a mění kostku poškození, místo aby se obě jen vypsaly. Přepnutí do
obou rukou tedy taky vytlačuje — je to obsazení ruky, ne jen větší kostka.

Nerozlišený případ: řádek, který se nepodaří dohledat v datech, obsadí jednu
ruku (D43). Jinak by rozbitý záznam nechal postavu držet tři věci.

Kolik stojí zbraň tasit nebo schovat uprostřed boje appka neřeší — to je
pravidlo u stolu, ne stav postavy.

## D86 — Řádek do tabulky akcí pozná appka podle `consumes` nebo tagu {@variantrule Long/Short Rest}

Navazuje na REPORT.md ze session "sheet rebuild slice 1", které zjistilo, že
žádné strukturované pole neoznačuje featuru jako "usable action" napřímo, a
že `consumes` označuje jen ~125 SPENDERŮ pojmenovaného poolu (Ki, Channel
Divinity, Sorcery Point...), ne featury, které pool GRANTUJÍ (Second Wind,
Action Surge, Bardic Inspiration, Font of Magic...).

**Pravidlo:** featura patří do tabulky akcí, pokud nese pole `consumes`,
NEBO její `entries` (rekurzivně, kdekoli v textu) obsahují tag
`{@variantrule Long Rest|...}` nebo `{@variantrule Short Rest|...}`.

Ověřeno na datech (class-features, subclass-features, feats,
optional-features): tag samotný pokrývá 168 distinct featur a zasahuje
všech 13 dříve ručně vyjmenovaných "jistě usable" featur (Second Wind,
Action Surge, Indomitable, Rage, Bardic Inspiration, Lay on Hands, Font of
Magic, Channel Divinity, Monk Ki/Focus features, Innate Sorcery, Magical
Cunning) — 100 %. Ze 168 jich 157 nenese `consumes` vůbec, takže tag je
právě ta chybějící vrstva, kterou `consumes` sám neviděl.

**Vědomě přijaté false negatives.** Existují featury s limitovaným použitím
(fráze "X times", pojmenovaný zdroj), které tag ani `consumes` nenesou —
buď mají jiný limit než rest (např. "jednou za kolo"), nebo je to starší/
reprintovaný záznam s volným textem místo tagu. Nedohledávají se ručně a
nedoplňují se do žádného seznamu výjimek. Featura, která tímhle pravidlem
propadne, zůstane zobrazená jako text ve Schopnostech a rysech — stejné
chování jako u prózových featů (D55), ne pád ani tichá chyba.

Rationale: dvousignálové pravidlo (`consumes` + explicitní 5etools tag) je
strukturální test, ne parsování volné prózy — narozdíl od širší heuristiky
navržené v REPORT.md (fráze typu "as a bonus action"), která by měla vysokou
míru falešných zásahů. Cena je několik desítek featur bez limitu poznaného
appkou; cena alternativy (a) — ručně vyjmenovaný seznam 150–300 featur — je
seznam, který se musí ručně udržovat při každé nové knize dat, což D21
zásadně nechce.

Zůstává otevřené (REPORT.md, bod "Pool definitions"): kolik použití pool
má a kdy se obnovuje (Rage 2×/long rest na 1. úrovni, Ki = úroveň Mnicha...)
není v těchto čtyřech souborech strukturovaně vůbec — to je samostatná
otázka pro krok 9 (Play tracking), ne pro tenhle řádek identifikace.

## D87 — Plná množina udělených class/subclass featur: seed z id-seznamu + tranzitivní uzávěra přes ref* v prostém textu

Navazuje na `scripts/investigate-full-feature-resolution.js`. Resolver
(`src/sheet/grantedClassFeatures.ts`) vrací celou množinu class a subclass
featur, které postava má, a `CharacterSheet.tsx` ji vypisuje jako novou sekci
na záložce "Schopnosti a rysy". Nevstupuje do tabulky akcí ani do
`src/actions/` — to je slice 5 část A.

**Pravidlo:**

1. **Seed.** Pro třídu (a podtřídu, jakmile je udělená) vezmi záznamy z
   `class-features.json`/`subclass-features.json`, jejichž `id` je v
   `classFeatureIds`/`subclassFeatureIds` té třídy/podtřídy A jejichž `level`
   je ≤ úroveň postavy. Match třídy/podtřídy sdílí `featureNamesFor` přes
   `src/sheet/featureReach.ts` (`buildFeatureReachTest`) — nepíše se podruhé.
2. **Tranzitivní uzávěra.** Rozšiř seed sledováním `ref*` uzlů
   (refClassFeature/refSubclassFeature/refOptionalfeature/refFeat) v prostém
   textu `entries` každé posbírané featury, dokud množina neroste. Páruje se
   přes `id`/uid, nikdy přes jméno (Cleric i Druid mají vlastní „Potent
   Spellcasting" a chovají se různě). `ref*` uzly uvnitř counted `options`
   uzlu se NESLEDUJÍ — to jsou alternativy volby, ne grant.
3. **Choice kontejnery se do výsledku nedávají.** Featura, jejíž vlastní
   counted `options` uzel je plný `refOptionalfeature` nebo `refClassFeature`
   (dnes 6 + 3), je z výstupu vynechaná celá — její vybraná varianta se už
   ukazuje jinde (`classFeatureChoices`, `classOptionalFeatures`/fighting
   style). Strukturální test, ne jmenný seznam.
4. **Placeholder refy `gainSubclassFeature: true`** ("Cleric Subclass" apod.,
   ~51 v `classes.json`) se vynechávají — strukturální příznak, ne jméno.
   Skutečná podtřída je v hlavičce sheetu.
5. **Wrapper featury se nijak zvlášť neskrývají.** "Life Domain" (Cleric),
   která hlavně uvádí další featury přes ref, je ve výsledku jako běžný
   záznam vedle featur, které uvádí. Strukturální způsob, jak wrapper poznat,
   nebyl nalezen a jmenný seznam výjimek je přesně to, čemu se projekt vyhýbá
   (D21). Kosmeticky k přehodnocení po revizi skutečného sheetu.
6. Co projde (1079 „plain" class/subclass featur, párováno přes id/uid), je
   nový seznam. Je to NOVÁ, samostatná sekce — nenahrazuje ani neslučuje
   stávající sekce feats / `classFeatureChoices` / `classOptionalFeatures`.

Nový export `featureIdForRef` v `src/featureResolver` (id cíle classFeature/
subclassFeature refu, s defaultováním prázdných segmentů jako `resolveRef`).

## D88 — Tabulka akcí: `consumes` u optional feature voleb, a proč se nepoužil `chosenClassOptionalFeatures`

Navazuje na D86/D87 a na scripts/investigate-choice-option-usability.js
(slice 5 část A).

**`OptionalFeatureOption` nese `consumes` nečtený.** Stejné jednořádkové
protažení jako u `GrantedFeature` (D87) — `optionalFeaturesByType` a
`fightingStyleFeats` v `src/optionalFeatures/optionalFeatureData.ts` teď
mapují i tohle pole. Nic v pickerech ho nečte, je to čistě přídavek pro
tabulku akcí.

**Třetí zdroj tabulky akcí je `chosenOptionalFeatureOptions`, ne
`chosenClassOptionalFeatures`.** `chosenClassOptionalFeatures` se ptá, která
PROGRESE featuru udělila (aby sekce "Class options" měla nadpis), a ta
otázka nemá odpověď pro podtřídové volby — Maneuvers, Arcane Shot, Runes,
College of Swords styly. Nový resolver čte každou uloženou volbu
(`Character.optionalFeatureChoices`, `Character.fightingStyle`) napřímo
a znovu ji dohledá v datech při čtení — žádná změna uložení, schéma
zůstává 28.

**Zjištěná mezera, mimo rozsah tady:** podtřídové optional feature volby
(Maneuvers, Arcane Shot, Runes, College of Swords) se nikde na sheetu
nezobrazují — sekce "Class options" ukazuje jen ty class-level. Battle
Master teď v tabulce akcí uvidí řádek "Trip Attack", ale nikde si
nepřečte, co dělá.

## D89 — Kouzla z rasy: pátý konzument `additionalSpells`, bez nové volby

Uzavírá první polovinu bodu "Kouzla z rasy nikam nevedou" z QUESTIONS.md.
Modul je `src/spells/raceSpells.ts`.

**Data mají jen 4 tvary, a `prepared`/`expanded` mezi nimi nejsou.** Z 78
záznamů `data/species.json` nese `additionalSpells` 30, v klíčových tvarech
`["ability","innate","known"]` (15), `["ability","known"]` (8),
`["ability","innate","known","name"]` (6) a `["ability","innate"]` (5). Na
rase se nikdy nevyskytne `prepared` ani `expanded` — celá mašinérie kolem
`expanded` (pact-slot ranky, rozšiřování nabídky pickeru) sem tedy nemá co
aplikovat. Úrovně jsou klíčované prostou ÚROVNÍ POSTAVY (ne úrovní ve třídě
— rasa není vázaná na třídu, stejná úvaha jako D11 u featů), plus
nečíselný klíč `"_"` ve významu "vždy".

**Dohledává se přímo na uložené variantě, disambiguace se neřeší.**
`Character.species` je díky D81/D82/D84 vždy vyřešená varianta ("Elf; Drow
Lineage"), nikdy nejednoznačný rodinný základ. Modul proto dělá jediné
přímé dohledání podle name+source (stejné, jaké už dělá
`buildSpeciesGrants` v `damageResponseData.ts`) a nikdy nemusí rozhodovat
mezi variantami. Tvar `["ability","innate","known","name"]` je právě ta
nevyřešená vícevariantní forma a sedí jen na třech rodinných záznamech
(Elf, Kobold, Tiefling) — postava ho nemůže mít uložený, takže se nečte a
nic se pro něj nestavělo.

**Dvě opravy ve sdílených parserech, obě kvůli rase.**
`parseSpellRef` utínalo `#...` jen ze zdrojové poloviny reference. 11 z 81
rasových referencí je psaných jako `"light#c"` / `"mage hand#c"` — bez
`|source` — takže `#c` zůstávalo ve JMÉNĚ a dohledání selhalo. Utíná se
teď z obou polovin; je to totéž pravidlo aplikované dvakrát, ne nové.
`parseDailySubkey` umí nově podklíč `"pb"` (Gnome; Rock Gnome Lineage,
jediný výskyt v datech) — počet seslání rovný proficiency bonusu za dlouhý
odpočinek. Na rozdíl od `freePerLongRestByAbility`, kde se ukazuje jen
jméno vlastnosti, se tady ukazuje ČÍSLO: proficiency bonus se dá spočítat
jen z úrovní postavy, které volající už má. Odpočinek se čte jako dlouhý,
stejně jako u všech ostatních podklíčů `daily` (D68).

**`ability: {choose}` zůstává v tomhle úkolu viditelně nerozhodnuté.**
33 ze 34 záznamů nese volbu vlastnosti (`{"choose":["int","wis","cha"]}`),
pevnou má jen Aasimar (XPHB). Žádné nové ukládané pole se tady nezavádí:
kouzlo se udělí a zobrazí, ale místo útočného bonusu a DC nese text
"spellcasting ability not chosen yet" — stejná konvence viditelné mezery
jako D58. Řádek v tabulce akcí se přitom NESMÍ tiše spočítat z vlastnosti
třídy, kterou postava má; taková čísla by byla nepravdivá, proto se
i tam vypíše důvod. Zavírá to navazující úkol (picker + uložená volba
vlastnosti), ne tenhle.

**5 záznamů s volbou cantripu dostává jednu řádku, ne picker.** Elf
(základ) + Elf; High Elf Lineage, Khoravar, Kobold (základ) + Kobold;
Draconic Sorcery mají pod `known` `choose`-filtr ("vyber si cantrip ze
seznamu kouzelníka"), ne jmenované kouzlo. Picker ani úložiště se pro ně
nestavělo; místo toho se u kouzel vypíše jedna označená řádka, že to appka
zatím neumí — aby to byla přiznaná mezera, ne tichý výpadek (D43/D58).

**Výpočet útoku/DC zůstává v kalkulační vrstvě.** Zadání říkalo spočítat
rozklad přímo v `raceSpellsFor`; to nejde udělat správně — modifikátor
vlastnosti potřebuje i efekty featů, které podpis `(character,
parsedSpecies, parsedSpells)` nenese. Modul proto nese jen vyřešenou
vlastnost (nebo důvod, proč ji nemá) a čísla počítá
`computeSpeciesSpellcasting` v `src/calculation/spellcasting.ts`, přesně
podle vzoru `computeFeatSpellcasting`. Jeden vědomý rozdíl proti němu:
rasa s nevyřešenou vlastností se přeskočí, místo aby celý výsledek přepnula
na `unknown` — jinak by 33 ze 34 ras zhaslo sekci Spellcasting i pro
třídu.

## D90 — Uložená volba sesílací vlastnosti u rasy: pole, krok wizardu, migrace beze změny dat

Zavírá druhou polovinu D89 ("kouzlo se udělí a zobrazí, ale místo útočného
bonusu a DC nese text 'spellcasting ability not chosen yet'"). 33 ze 34
záznamů `additionalSpells` nese `ability: {"choose":["int","wis","cha"]}` —
tenhle úkol dodává, kam si appka tu volbu uloží a kde ji hráč udělá.

**Nové pole kopíruje D57, ne se od něj liší.** `Character.speciesSpellcastingAbility?: Ability`
je nepovinné přesně jako `FeatAsiChoice.chosenAbility` — chybí, dokud
uložená rasa nenabízí volbu (pevná vlastnost jako Aasimar, žádné
`additionalSpells` vůbec), i když nabízí a hráč ji ještě neudělal (starý
save, nebo wizard nějak obejitý). `WizardData.speciesSpellcastingAbility`
je naproti tomu `Ability | null` jako zbytek rozpracovaného stavu wizardu
(`speciesChoice`, `fightingStyle`) — `null` = "zatím nevybráno", na rozdíl
od uloženého pole, kde nic neznamená totéž jako "nebylo co vybírat".

**Krok SPECIES dostává třetí podmínku, ne nový krok.** D81/D82 už krok
species blokují na nevyřešené linii a na dokončených species skillech;
`speciesSpellcastingAbilityComplete` je stejná podmínka potřetí —
`true`, když uložená rasa (jednou vyřešená varianta, D81/D82/D84) nemá
co vybírat, jinak jen když je `speciesSpellcastingAbility` vyplněné.
Picker (`SpeciesSpellcastingAbilityPicker`, vzor `SpeciesSkillPicker`) se
načítá vlastní kopií dat stejně jako `speciesSkillShape` — wizard
potřebuje vědět, jestli volba visí, dřív než by se panel vůbec vykreslil.
Nabízené možnosti jsou přesně ty, co `additionalSpells.ability.choose`
v datech vyjmenuje (typicky int/wis/cha), ne napevno tři možnosti.

**Volba se čte přímo v `raceSpellsFor`, výpočet zůstává v kalkulační
vrstvě.** `raceSpells.ts` teď při `ability: {choose}` zkusí
`character.speciesSpellcastingAbility` — pokud je vyplněné, kouzlo dostane
`ability` stejně jako Aasimarovo pevné `"cha"`; pokud ne, zůstává
`unresolvedAbilityReason` beze změny. `computeSpeciesSpellcasting` se
NEMĚNIL VŮBEC — bere `ability`, ať přišlo z pevné hodnoty nebo z uložené
volby, přesně jak D89 popisuje.

**Migrace 28→29 je jen tag, žádná data se nedopočítávají.** Stará
postava nemá volbu uloženou nikdy, a chybějící pole už dnes znamená
přesně "not chosen yet" — stejná úvaha jako u každé aditivní migrace od
D69 (naposledy D9 pro `currentHp`/`maxHp`). Otevřená otázka, kterou tenhle
úkol neřeší: appka nemá editaci uložené postavy ani žádné znovuspuštění
species kroku wizardu na existující postavě — taková postava tedy zůstane
u "not chosen yet" navždy, dokud nevznikne editační cesta. Zapsáno do
REPORT.md, ne rozhodnuto zde.

**Volba cantripu ze seznamu třídy (5 záznamů) zůstává mimo tenhle úkol.**
Elf (základ) + Elf; High Elf Lineage, Khoravar, Kobold (základ) + Kobold;
Draconic Sorcery mají pod `known` `choose`-FILTR, ne volbu vlastnosti —
jiný tvar dat, jiný picker, viz QUESTIONS.md.

## D91 — Maximum HP se neukládá jako číslo, ale jako příspěvek za každou úroveň

Maximum hit points se NIKDY neukládá jako jedno hotové číslo. Ukládá se
příspěvek za každou úroveň zvlášť (`Character.hitPointLevels`), a to BEZ
Constitution: každý záznam nese úroveň, samotný výsledek kostky a to, jak
vznikl (maximum / průměr / hod / ručně zadané).

Constitution se přičítá až při výpočtu (`src/calculation/maxHitPoints.ts`),
násobená celkovou úrovní postavy.

Důvod: zvýšení Constitution (ASI) zvyšuje životy ZPĚTNĚ za všechny dosavadní
úrovně. Uložené hotové číslo by tiše zůstalo nízko — a nikdo by si toho
nevšiml, protože by nic nehlásilo chybu.

Vedle toho existuje jedno nepovinné ruční přebití výsledku
(`Character.maxHpOverride`). Když je nastavené, vyhrává nad vším spočítaným a
rozklad to říká výslovně. Migrace 29→30 do něj přesouvá dosavadní ručně
napsané `maxHp` (D9), takže postavě, která číslo měla, se zobrazené maximum
nezmění. `currentHp` zůstává ruční a nedotčené.

## D92 — Úroveň 1 je vždy maximum kostky

Úroveň 1 je vždy maximum třídní kostky, nikdy hod ani průměr. Platí i tehdy,
když je pro úroveň 1 uložený jiný záznam — výpočet ho pro tuhle jednu úroveň
ignoruje. Pevný průměr pro ostatní úrovně je hodnota z PHB: polovina kostky
zaokrouhlená dolů plus jedna (d6 → 4, d8 → 5, d10 → 6, d12 → 7).

Postava bez jediného uloženého příspěvku (dnes každá) spadne na úroveň 1 =
maximum a všechny další = pevný průměr, a rozklad řekne, že jde o výchozí
hodnoty, ne o volby hráče. Výběr hod/průměr po úrovních je slice 8b.

## D93 — Ručně psaná tabulka tří bonusů k maximu životů: vědomá výjimka proti D21

Bonusy k maximu životů za úroveň mají ručně psanou tabulku tří položek
(Tough, Dwarven Toughness, Draconic Resilience) v
`src/calculation/maxHitPoints.ts`.

Je to vědomá výjimka proti D21: v datech nejsou čísla vůbec, jen próza, a
textový vzorec kandidáty najde, ale neumí je roztřídit — 7 z 10 zásahů
maximum životů vůbec nemění (Arcane Ward je maximum WARDU, Preserve Life je
strop léčení, …). Viz investigaci v REPORT.md předchozí session.

Výjimka je omezená na ČÁSTKU. Zda postava schopnost má, se rozhoduje
strukturálně: z udělených class/subclass featur (D87), ze vzatých featů a z
pojmenovaných rysů uložené rasy (`src/sheet/speciesTraitNames.ts`) — nikdy
podle jména třídy, rasy nebo podtřídy. Klíčem tabulky je jméno FEATURY, a
všechna tři jsou napříč feats.json, subclass-features.json i rysy ras
jedinečná.

Tabulku bude hlídat validace dat v následující slice.

## D94 — Tabulka bonusů si u každé položky pamatuje úrovňovou osu

Draconic Resilience se odvíjí od úrovně SORCERERA, ne od úrovně postavy.
Každá položka tabulky proto nese tři věci: plochou část, část za úroveň, a
osu, kterou ta část za úroveň násobí — buď úroveň postavy, nebo úroveň v
jedné konkrétní třídě.

Dnes je appka single-class a obě čísla jsou stejná, takže osa nic nemění.
Zaznamenává se přesto: multiclass je krok 10 a osu, kterou tabulka nikdy
nezapsala, by tam už nešlo dohledat.

## D95 — Tabulka bonusů k maximu životů je hlídaná validací dat

D93 slíbilo, že ručně psanou tabulku tří bonusů (Tough, Dwarven Toughness,
Draconic Resilience) bude hlídat `npm run validate-data`. Slice 8a-guard tenhle
slib plní: jména z tabulky se ověřují proti datům a množina kandidátů z
frázového vyhledávání je připnutá na deset známých položek.

Jména se ověřují proti datům — každé musí odpovídat právě jednomu featu,
rysu rasy, class featuře nebo subclass featuře, jinak validace selže a řekne
proč. Množina kandidátů je připnutá — nový zdroj životů z budoucí knihy by se
projevil jako jedenáctý kandidát a shodí validaci místo aby zůstal
nepovšimnut; zmizelý známý kandidát (přejmenování, zrušený zdroj) shodí
validaci stejně.

## D96 — Krok wizardu pro životy: pozice, skrývání, opakovaný hod, přebití, blokace

Slice 8b přidává krok wizardu "Hit points", který plní `Character.hitPointLevels`
za úrovně 2 a výš (úroveň 1 se neukládá vůbec — D92).

**Pozice: až za featem/ASI, ne dřív.** Feat i ASI můžou zvýšit Constitution a
Tough přidává životy za úroveň; krok umístěný dřív by ukázal průběžný součet,
který by se o krok později změnil, aniž by hráč cokoliv na TOMHLE kroku udělal.

**Skrývání na úrovni 1.** Na úrovni 1 není co vybírat — je to vždy maximum
kostky (D92) — takže krok se schová úplně, stejně jako `expertise` (D49) nebo
`featAsi`, a číslování kroků zůstává souvislé.

**Hod lze opakovat bez omezení.** Appka nezamyká hozenou hodnotu a nelimituje
počet opakování. Je to hráčův vlastní sheet; hlídání poctivosti hodu není
úkol appky.

**Ruční přebití zůstává jen v hlavičce sheetu.** `Character.maxHpOverride`
(D91) se do tohoto kroku nedává — žije jen v hlavičce, jinak by stejné pole
mělo dvě místa k úpravě a ta by se časem rozešla.

**Nevybraná úroveň nepustí dál.** Krok se nedá dokončit, dokud každá úroveň od
2 výš nemá vlastní záznam — stejně jako ostatní kroky wizardu blokují
nedokončenou volbu (D57, D81). Důvod: záznam pro postavu BEZ voleb (výchozí
maximum + průměr, D92) musí zůstat rozeznatelný od záznamu, kde hráč vědomě
zvolil průměr — jinak by "nevybráno" a "vybral průměr" v úložišti vypadaly
stejně.

## D97 — `Character.masteries` nese úroveň volby: pole `level`, volby z tvorby postavy ji nemají

D22 chce, aby si každá uložená volba hráče pamatovala úroveň, na které padla.
`masteries` byla holá pole jmen, takže to nešlo doplnit polem — musel se změnit
TVAR. Od schématu 31 je to pole objektů `{ name, level? }`; `name` je přesně ten
řetězec, který tam byl dřív. Tímhle je D22 pro `masteries` splněné.
`expertiseSkills` a `optionalFeatureChoices` jsou stejný případ a přijdou ve
slice 8c2 podle tohohle vzoru.

**Pole se jmenuje `level`, ne `grantedAtLevel`.** Shoduje se s `featAsiChoices`
a `hitPointLevels`. `grantedAtLevel` u `CharacterClassFeatureChoice` a
`subclassSpellChoices[].picks` odpovídá na jinou otázku — kdy schopnost tu volbu
NABÍDLA, ne kdy si hráč vybral. U masteries se ptáme na to druhé.

**Volby z tvorby postavy úroveň NEMAJÍ.** Wizard vybírá všechny masteries v
jednom kroku, i když se postava tvoří rovnou na 5. úrovni — přiřazení konkrétní
úrovně by bylo vymyšlené. Kdyby se zapsala aktuální úroveň postavy, pozdější
"odeber tuhle úroveň" by sebralo i volby, které k ní nepatřily. Úroveň zapisuje
jen level-up (slice 8d).

**Chybějící úroveň je platný stav „nevíme", ne chyba.** Validace ji nevyžaduje a
čtenáři se kvůli ní nechovají jinak. Migrace 30→31 je první krok v řetězu, který
hodnotu nechává NEZNÁMOU místo aby ji přesunul nebo zachoval: postava uložená
před touhle slice nemá záznam o tom, kdy se co vybralo, a hádat by znamenalo
tiše lhát (D43).

## D98 — `Character.expertiseSkills` nese úroveň volby podle vzoru D97; tvar i helper jsou sdílené

Od schématu 32 je `expertiseSkills` pole objektů `{ name, level? }`, migrace
31→32 dělá z každého jména `{ name }` bez úrovně a volby z tvorby postavy úroveň
nemají. Důvody jsou D97, neopakují se. Tímhle je D22 splněné pro druhé ze tří
polí; třetí je `optionalFeatureChoices`.

**Tvar se nekopíroval, zobecnil se.** `LeveledChoice` je jedno rozhraní,
`CharacterMastery` i `CharacterExpertiseSkill` jsou jeho aliasy; `masteryNames()`
se přejmenoval na `choiceNames()`, validátor i konverze jsou parametrizované
jménem pole. Druhá kopie stejného tvaru by znamenala, že slice 8c3 píše třetí.

**Rozdíl proti `masteries`: tohle pole má produkčního čtenáře.** `computeSkill`
(`src/calculation/skills.ts`) podle něj zdvojuje proficiency bonus — jediné
místo, jedna změna `includes(skill)` na `choiceNames(...).includes(skill)`.
Úroveň u volby se čtenáře netýká: s ní i bez ní vychází stejné číslo, stejný
rozklad (D40/D41) i stejný stav proficiency (D45). Tohle je zároveň rozdíl, kvůli
kterému má slice 8c3 vlastní odhad rozsahu — počet čtenářů, ne tvar, je to, co
tuhle změnu prodražuje.

## D99 — `optionalFeatureChoices`: úroveň nese jednotlivá volba, ne záznam `featureType`; vnořené `spellChoices` jsou z D22 venku

Od schématu 33 je `choices` v každém záznamu
`CharacterOptionalFeatureChoice` pole `LeveledChoice` místo `string[]`, migrace
32→33 dělá z každého jména `{ name }` bez úrovně a volby z tvorby postavy úroveň
nemají. Tvar, helper `choiceNames()`, validátor i konverze jsou ty z D97/D98 a
neopakují se. Tímhle je D22 splněné pro všechna pole, která ho potřebují.

**Úroveň sedí na JEDNOTLIVÉ volbě, ne na záznamu.** Jeden `featureType` sbírá
volby z několika úrovní: sorcerer bere Metamagic na 3., 10. i 17. úrovni, a
všechny tři sedí pod `MM`. Jedna úroveň na záznamu by tedy byla nepravdivá u dvou
ze tří voleb — a `featureType` se rozdělit nedá, protože ho určují data
(`optionalfeatureProgression`), ne appka.

**Vnořené `spellChoices` se z D22 vynechávají.** Ze stejného důvodu jako
`wildShapeForms` a `familiar`: kouzla se dají kdykoli vyměnit, takže zapsaná
úroveň by tvrdila provenienci, kterou pravidla nedávají. Migrace se jich proto
nedotýká vůbec.

**Rozdíl proti D97/D98: osm produkčních čtenářů, ne jeden.** Všichni matchují na
jméno a jdou teď přes `choiceNames()` — invocations (Pact of the Chain → formy
familiara), udělené smysly, udělená i vybraná kouzla z options, tři čtenáři v
`optionalFeatureData.ts` (prerekvizity a počty v pickeru, sekce sheetu, tabulka
akcí) a počítání požadavků na kouzla ve wizardu. Žádnému z nich se výsledek
nemění, ať volba úroveň nese nebo ne; testy to u každého ověřují dvojicí
„s úrovní / bez úrovně".

## D100 — Wizard umí běžet nad existující postavou: uložení ji přepíše, úroveň jen nahoru, a už zapsané volby si nechávají svou úroveň

Slice 8d1. Doteď wizard běžel jen dopředu z prázdné postavy; level up (8d3)
i obyčejná oprava po vytvoření potřebují totéž.

**Uložení přepíše, nezdvojí.** `CharacterStore.update(id, input)` bere stejný
objekt jako `create` a nechává jen `id` a verzi schématu; všechno ostatní je
z `input`, takže pole, které se nepředá, opravdu zmizí. `saveCharacter`
dostane postavu, ze které se wizard naseedoval, a volá `update` místo
`create`. Dokud se nezmáčkne uložení, ve storage se nemění nic — zrušení
úpravy nechá postavu přesně tak, jak byla.

**Maže se při změně TŘÍDY, ne při změně úrovně.** `setClassChoice` čistil
tucet polí při každé změně. To je správně, když se změnila třída — jiná třída
má jiné dovednosti, jiné mastery, jinou kostku života. Při změně samotné
úrovně je to špatně: smazalo by to všechny už zapsané volby včetně úrovní, na
kterých byly vzaté (D97/D98/D99), tedy přesně tu historii, kterou 8e potřebuje.
Rozlišuje se podle `className` + `classSource`.

**Úroveň smí při úpravě jen nahoru.** Snížení úrovně je ve skutečnosti
ODEBRÁNÍ úrovně: musí spadnout přesně ty volby, které byly vzaté na rušených
úrovních, a nic víc. To je slice 8e a používá k tomu právě ty úrovně uložené
u jednotlivých voleb. Kdyby to směla udělat úprava, udělá se totéž potichu a
špatně. Nabídka úrovní tedy pod úrovní postavy nezačíná (`ClassPicker`
`minLevel`) a `saveCharacter` nižší úroveň odmítne. Zvýšení úrovně nepotřebuje
nic navíc — viditelné kroky se přepočítají a krok, který nově něco vyžaduje,
blokuje uložení stejně jako při tvorbě.

**Volba, která na postavě už byla, si nechá svou úroveň; nově přidaná žádnou
nedostane.** `WizardData` drží u masteries, expertise a optional features holá
jména, storage `LeveledChoice`. Při uložení se tedy každé jméno porovná s tím,
co na postavě bylo: co tam už bylo, si nese svou úroveň dál, co přibylo teď,
je bez úrovně — stejné rozdělení, jaké už dělá `ClassOptionalFeaturePicker.toggle`.

**Krok „Starting equipment" se při úpravě nezobrazuje.** Které možnosti se při
tvorbě vzaly, se neukládá, takže se nedá ani předvyplnit; odvodit inventář
znovu z nabídek by přepsalo to, co hráč mezitím měnil na sheetu, a ptát se
znovu by blokovalo uložení na volbě, která je už utracená. Inventář, peníze,
aktuální HP a familiar tedy projdou úpravou beze změny.

## D101 — „Co přibylo na úrovni N" je rozdíl dvou kumulativních dotazů, ne tabulka úrovní

Slice 8d2. Modul `src/levelUp/levelGains.ts` odpovídá, co na úrovni N přibývá,
pro každý krok `WIZARD_STEPS`. Nepotřebuje k tomu nic nového z dat.

**Odvozuje se, nepíše se.** Každá existující funkce odpovídá kumulativně —
„co má postava DO úrovně N" (`featAsiGrantsFor` filtruje `level <= N`,
`countAtLevel` bere nejvyšší klíč `<= N`, `expertiseEligibilityFor` a
`masteryCountFor` sčítají stejně, `cantripProgression` je pole indexované
úrovní). Odpověď na jednu úroveň je tedy rozdíl dvou takových volání, N a N-1.
Ručně psaná tabulka „na 4 je ASI, na 6 expertise" by byla druhý zdroj pravdy
vedle dat a při každé změně dat by tiše zestárla; navíc už dnes neplatí ani ta
zdánlivě univerzální (Fighter má ASI i na 6 a 14, Rogue na 10 — D16).

**Co zjistil ověřovací skript.** `scripts/investigate-closure-level-drift.js`
se ptal, jestli tranzitivní uzávěr v `grantedClassFeaturesFrom` (D87, bod 2)
umí přitáhnout featuru, jejíž vlastní `level` je jiný než úroveň té, která ji
přitáhla. Umí: z 338 ref hran v prostém textu jich 45 kříží úrovně, a všech 45
**dolů** (Cleric Order Domain na úrovni 3 táhne své vlastní featury psané na
úrovni 1); nahoru ani jedna. „Featury nové na úrovni N" tedy NEJDE udělat jako
uzávěr filtrovaný na `level === N` — přišlo by se právě o těch 45. Bere se
rozdíl dvou celých uzávěrů podle `id` featury.

**Podtřída se na straně N-1 odebírá.** Postava má podtřídu uloženou, ale
vzala si ji až na úrovni, kterou dává `subclassLevelFor`. Kdyby se dotaz na
N-1 ptal i s podtřídou, featura podtřídy psaná na úrovni 1 by se počítala jako
už držená a všechny volby, které podtřída přináší, by z odpovědi na úrovni 3
tiše zmizely.

**Kroky, které po tvorbě postavy nikdy nic nepřidají** (v odpovědi mají status
`never` i s důvodem, ne prázdnou nulu): `species` (rasa, její varianta,
dovednosti i sesílací vlastnost se volí při tvorbě, nic v `species.json` není
vázané na úroveň), `background` (pozadí, rozdělení bonusů, nástroj),
`languages` (dvě volené řeči jsou pevný grant při tvorbě), `abilities`
(hodnoty se zapisují při tvorbě; pozdější zvýšení jde výhradně krokem
`featAsi`), `equipment` (startovní výbava je jednorázový grant, D100) a
`review` (nesbírá nic nikdy, je to obrazovka uložení). Krok `hitPoints` naopak
přidává právě jednu položku na KAŽDÉ úrovni od 2 výš (D92), takže „úroveň,
která nepřidá vůbec nic" v praxi znamená „nic než hit pointy".

**„Nepřidává nic" a „nedá se zjistit" nesmí splynout** (D43). Multiclass
postava, třída, která ve `classes.json` není, uložená podtřída, která tam
není, a neplatná úroveň vracejí `unknown` s důvodem — u multiclassu proto, že
nic nezaznamenává, do které třídy nová úroveň patří, a hádat by znamenalo
odpovědět na otázku jiné třídy (multiclass je krok 10).

## D102 — Level up přidá přesně jednu úroveň ve stávající třídě a projde jen kroky, které ta úroveň nabízí

Slice 8d3. Tlačítko "Level up" na sheetu a zkrácený průchod wizardem.

**Vždy přesně jedna úroveň, vždy ve stávající třídě, na třídu se neptá.**
Multiclass je krok 10. Tlačítko je nedostupné na úrovni 20 a tehdy, když
`levelGainsFor` vrátí `unresolved` (víc tříd, třída chybějící v datech); v obou
případech nese důvod přímo na sobě (D43), ne jen zašedlé. Krok `class`, pokud
se v průchodu ukáže, místo pole pro jméno a `ClassPicker` jen vypíše
"Fighter 4 → 5". `saveCharacter` odmítne zápis, který nezvedá jednu uloženou
třídu právě o jednu úroveň.

**Které kroky se ukazují.** Podle stavů z `levelGainsFor` pro NOVOU úroveň:
každý krok se stavem `adds`; každý krok se stavem `unknown`, s poznámkou, že
appka neumí říct, jestli tahle úroveň do kroku něco přidává, i s důvodem, aby to
hráč zkontroloval ručně — schovat ho by potichu přeskočilo volbu, na kterou může
mít postava nárok; a vždy `hitPoints` (D92, kostka na každé úrovni od 2) a
`review`. Kroky `none` a `never` se neukazují. Jde to přes stávající
`visibleSteps`: nová podmínka `WizardStepConditions.levelUpSteps`, kterou plní
`levelUpStepConditions` (`src/levelUp/levelUpSteps.ts`); když je nastavená,
rozhoduje o viditelnosti sama.

**`newFeatures` se vypisují na review jako text ke čtení.** Žádný krok je
nesbírá, a přitom jsou to právě ony, kvůli kterým se leveluje — bez nich hráč
proklikne pickery a nedozví se, co mu úroveň dala. Jména přesně tak, jak je
nesou data.

**Úroveň se zapisuje atomicky až na konci.** Jedno `update` (D100) se všemi
volbami z průchodu. Zavřené nebo zrušené okno nechá postavu na původní úrovni;
žádný rozpracovaný stav ani koncept se neukládá. Volby přidané během průchodu
nesou NOVOU úroveň (D97/D98/D99); volby z tvorby postavy dál žádnou — 8e na tom
rozlišení staví.

## D103 — Krok životů se při level upu ptá jen na nově získanou úroveň

Slice 8d5. `HitPointsPicker` a `WizardStepConditions.levelUpTargetLevel`.

**Level up ukazuje a vyžaduje jen jeden řádek** — úroveň, na kterou postava
právě postupuje — místo všech úrovní od 2 nahoru (D92/8b). Postava založená
před 8b nemá `hitPointLevels` vůbec, a bez tohohle by první level up žádal o
kostku za každou dosavadní úroveň, než by se dostal k té skutečně nové.
Tlačítko "Průměr pro každou úroveň" (D92) v level-upu nemá smysl s jediným
řádkem, a proto se v tomto průchodu nezobrazuje.

**Starší úrovně bez uloženého příspěvku zůstávají na výchozích hodnotách.**
Level up jim žádný záznam nedoplňuje ani nemaže ty, co tam jsou — úroveň 1 je
podle D92 vždy maximum kostky, každá další bez záznamu je pevný průměr, a
rozklad na sheetu už tohle hlásí jako výchozí hodnoty, ne jako hráčovu volbu.

**Doplnit si historii jde přes úpravu postavy (D100/8d1), ne přes level up.**
Editační průchod dál ukazuje každou úroveň od 2 nahoru beze změny — míchat
„doplň si minulost" do „postoupil jsi o úroveň" by bylo matoucí a level up by
zase žádal o víc, než kolik ta jedna nová úroveň skutečně dává.

## D104 — Odebrání úrovně: spodní hranice je úroveň, na které postava vznikla; maže se jen to, co nese odebíranou úroveň

Slice 8e. `Character.createdAtLevel` (schéma 34), `src/levelUp/levelRemoval.ts`,
`RemoveLevelButton`.

**Nové pole `createdAtLevel`** — úroveň, na které wizard postavu vytvořil.
Nastaví ho jen tvorba, úprava ani level up ho nemění. Je to spodní hranice
odebírání: volby z tvorby úroveň nenesou (D97), takže postava vytvořená rovnou
na úrovni 5 by po odebrání úrovně nic neztratila a zůstala by postavou úrovně 4
s volbami úrovně 5. Migrace 33→34 nepřidává nic — u starší postavy úroveň vzniku
známá není (mohla mezitím postoupit) a chybějící hodnota je platný stav
„neznámo" (jako D97). Odebrání je pak odmítnuto s důvodem.

**Ovládací prvek odebere přesně jednu úroveň.** Nedostupný (důvod přímo na
prvku, D43) na úrovni 1, na úrovni vzniku, bez známé úrovně vzniku a u
multiclassu (krok 10 — nic neříká, které třídě úroveň vzít).

**Co se maže při odebrání úrovně N:** každá uložená volba s `level === N`
(masteries, expertise, volby optional features, feat/ASI) nebo
`grantedAtLevel === N` (class feature choices, picky subclass spell choices),
záznam `hitPointLevels` pro N a úroveň třídy o jedna. **Volba bez úrovně se nikdy
nesahá** — je z tvorby, tedy na hranici nebo pod ní. Záznam optional features /
subclass spell choices, kterému nezbyde žádná volba, zmizí celý (tvorba prázdné
záznamy neukládá, takže level up + odebrání vrátí postavu bajtově stejnou).

**Podtřída a fighting style se odvozují z dat, neukládá se jim úroveň.**
Podtřída se maže, když ji třída volí právě na N (`subclassLevelFor`), fighting
style, když ho třída dává na N (`grantsFightingStyleAt`, stejná funkce jako v
`levelGainsFor`). Když úroveň podtřídy z dat vyčíst nejde, odebrání se odmítne.

**Kouzla zůstávají.** Známá a připravená kouzla úroveň nenesou záměrně — appka
dovoluje kouzla kdykoli vyměnit, takže nic neříká, která patřila k odebírané
úrovni. Postava tak může znát kouzlo, které už nesešle, nebo víc kouzel, než
nová úroveň dovoluje. To je známá mez, ne chyba: smazaný pick by se opětovným
level upem nevrátil. Označení na sheetu je další slice. Sloty se ukládat
nemusí, počítají se z třídy a úrovně. Totéž platí pro Wild Shape formy (bez
úrovně podle D22).

**Potvrzení je prvek uvnitř appky, ne `confirm()`.** Skript, který appku ovládá,
zavře prohlížečový dialog jako „ne" (QUESTIONS.md), takže akce za ním by nešla
nikdy vyzkoušet. Zrušení nic nezapisuje; potvrzení zapíše jednou přes
`CharacterStore.update` (D100).

## D105 — Úprava postavy úroveň vůbec nemění

Slice 8e3. Ruší tu část D100, která při úpravě dovolovala úroveň zvýšit.

**Zvyšování úrovně v úpravě byla díra.** Volby sebrané při úpravě nenesou
žádnou úroveň (D97/D100 — jen level up ji zapisuje), takže postava zvýšená
úpravou ze 4 na 6 měla neoznačené volby nad svou spodní hranicí (`createdAtLevel`,
D104) a odebrání úrovně 6 by je nechalo stát — přesně to, čemu D104 měla
zabránit.

**Oprava nic nestojí, protože level up už existuje.** Zvednutí úrovně má svůj
vlastní ovládací prvek (tlačítko Level up), který na každou sebranou volbu
úroveň zapisuje (D102). Postava založená na špatné úrovni se opraví tlačítkem
Level up, což je pro appku míň rozhodování a pro data správnější výsledek, než
jaký by dala úprava. Úprava se tím vrací k tomu, k čemu je: opravě jména,
dovednosti, špatně zvolené volby.

**Nabídka úrovní v `ClassPicker` má při úpravě jedinou hodnotu.** Prop
`minLevel` (spodní hranice, D100) je nahrazen propem `fixedLevel`: když je
zadaný, `<select>` je disabled a nabízí jen tu jednu úroveň, takže uživatel
jinou nikdy nezvolí. `saveCharacter` navíc odmítne zápis, kde se úroveň při
úpravě (bez `levelUpTo`) liší od uložené — kdyby frontend přece jen poslal
jinou. Snížení úrovně zůstává odmítnuté (D100) a odebrání úrovně má dál svůj
vlastní krok (D104); tahle změna se týká jen zvyšování.

## D106 — Přebytek nad úroveň (kouzla, Wild Shape) se hlásí, ne maže

Slice 8e2. `src/sheet/CharacterSheet.tsx`, `src/sheet/SpellList.tsx`,
`src/spells/spellLevelFilter.ts` (`highestSlotLevel` exportovaná).

**Kouzla ani Wild Shape formy nenesou úroveň záměrně** (D104) — appka dovoluje
kouzla i formy měnit kdykoli, takže po odebrání úrovně appka neví, která volba
patřila k té úrovni. Smazaná volba by se navíc opětovným level upem nevrátila.
Řešení je proto zobrazit přebytek, nikdy nic smazat.

**Jednotlivě se označuje jen to, na co appka umí ukázat.** Kouzlo ze
`spellChoices` (hráčova volba — jediná věc, co appka volně mění) nad
nejvyšší sesílatelnou úrovní (`highestSlotLevel`, teď exportovaná ze
`spellLevelFilter.ts` — jedno místo, ne druhý výpočet) dostane na sheetu v
záložce Kouzla text "(unavailable at this level)" u svého jména; zůstává v
seznamu i v úložišti. Kouzlo z podtřídy/featu/optional feature/rasy se nikdy
neoznačuje — to jsou pevné granty, vždy platné.

**Zbytek se hlásí jako počet, ne jako konkrétní položka** — appka neví, KTERÉ
kouzlo nebo forma je navíc: "Cantrips: N known, M allowed", "Spells
known/prepared: N, M allowed" (z `computeSpellCounts`, beze změny), a
"<Class> Wild Shape forms: N known, M allowed" (z `wildShapeLimits`, beze
změny) — každý jen když N > M, jinak nic.

**Multiclass (víc než jedna třída) hlásí "nejde zjistit", ne ticho ani číslo
z jedné třídy.** Stejná mez, kterou `spellSlots.ts`/`spellCounts.ts`/
`spellLevelFilter.ts` už pojmenovávají (D11 — kombinování napříč třídami je
krok 10): `combineSpellEntries` navíc ztrácí, KTERÁ třída si které kouzlo
vybrala, takže „nejvyšší sesílatelná úroveň" pro sloučený seznam nejde určit
ani principiálně, dokud krok 10 tabulky nespojí. Ukazuje se jedna věta místo
obou notic výše — nikdy číslo spočtené jen z jedné z tříd. Wild Shape touhle
mezí netrpí (jeho limit čte jen tu jednu Druid třídu), takže zůstává určený i
u multiclassu; neurčený je jen tehdy, když postava tu třídu z
`wildShapeForms` záznamu už vůbec nemá (D43).

**Postava v mezích neukazuje nic.** Žádná ze tří notic se nerenderuje, dokud
není co hlásit — přebytek nikdy neukazuje nulu ani prázdný řádek.

## D107 — Current HP se automaticky vyplní: na plno při tvorbě, o rozdíl při level upu

Implementováno. `src/calculation/maxHitPoints.ts` (`currentHpAfterMaxHpChange`,
`maxHitPointsDelta`), `src/hitPoints/hpDefault.ts`, `src/creation/wizardState.ts`
(`saveCharacter`'s `computedCurrentHp`), `src/creation/CharacterWizard.tsx`,
`src/CharacterManager.tsx` (odebrání úrovně).

Při TVORBĚ postavy se `currentHp` nastaví rovnou na vypočtené `maxHp` —
postava začíná nezraněná. Při LEVEL UPU se `currentHp` zvýší o stejné číslo,
o kolik vzrostlo `maxHp` — ne na plno. Odpovídá pravidlu 2024: úroveň zvedne
current HP o stejnou částku jako max HP, není to léčení jako long rest.

Manuální přepsání (D9) zůstává možné kdykoliv v obou případech — tohle jen
mění výchozí hodnotu, kterou pole dostane, než do něj hráč sáhne.

**`maxHp` se počítá stejnou cestou jako na sheetu** (`computeMaxHitPoints` nad
classes.json/feats.json/species.json daty), ale `CharacterStore`/`saveCharacter`
k datům přístup nemají (D38) — volající (`CharacterWizard.tsx`) hodnotu spočítá
předem a předá ji přes nový parametr `computedCurrentHp`, stejně jako už dělá
u `backgroundSkillProficiencies`/`startingEquipment`. Necháno `undefined`
(výchozí, žádná změna chování) při obyčejné úpravě (D105) i když `maxHp` ještě
není spočtené.

**Odebrání úrovně (D104) — vlastní rozšíření tohoto úkolu, D107 to výslovně
nepokrývalo.** Ze symetrie: `currentHp` se sníží o stejné číslo, o kolik
kleslo `maxHp`, opět jen když už bylo nastavené. Bez toho by po odebrání
úrovně mohlo zůstat nad novým, nižším maximem. Řešeno v
`CharacterManager.tsx`'s `onRemoveLevel` (ne v `levelRemovalPlan` samotném,
aby zůstal čistý a testovatelný bez načítání dat).

## D108 — Level up volby z dřívějších úrovní jen ukazuje, nikdy je znovu neotevře

Oprava 8d3 (D102). `src/levelUp/heldPicks.ts`, `CharacterWizard.tsx`, pickery
masteries / manévrů / expertise / class feature choices.

**Chyba.** D102 v kroku `class` nahradila při level upu jen jméno a
`ClassPicker`; všechny ostatní pickery kroku se vykreslovaly jako při tvorbě.
Fighter Battle Master 3 → 4 (krok `class` se ukáže kvůli další weapon mastery)
tak mohl přepnout podtřídu, fighting style, class skills i odškrtnout starší
mastery a manévry — a uložení to přijalo.

**Volba s jednou hodnotou, kterou postava už má, se při level upu nevykreslí.**
Podtřída, fighting style a class skills: picker je jen tehdy, když postava tu
volbu ještě nemá (podtřída na úrovni volby, starší postava bez fighting stylu).
Chybějící volba, na kterou má postava nárok, se tím doplnit dá; hotová se
přepsat nedá.

**Seznamové volby ukazují starší picky zaškrtnuté a zamčené**, nové sloty
zůstávají otevřené: weapon masteries, manévry podtřídy (optionalfeatureProgression),
expertise, a u class feature choices (Divine Order apod.) celá skupina, která
už má vybranou verzi. `SearchableOptionList` dostal `locked` — jedinou výjimku
z pravidla D71, že vybraná položka nikdy není disabled.

**Co drží, se čte z uložené postavy, ne z `levelGainsFor`.** Tak to platí i pro
krok se stavem `unknown` (D102), kde appka neví, co úroveň přidává.

**`saveCharacter` s `levelUpTo` odmítne zápis, který drženou volbu změní nebo
vypustí** (`overwrittenHeldPicks`) — pojistka pro případ, že by UI přece jen
poslalo jinou hodnotu, stejně jako D105.

**Wild Shape formy, kouzla a class optional features (invocations, metamagic)
se nezamykají.** Formy a kouzla jde podle D104/D106 měnit kdykoli; class optional
features a feat/ASI nejsou v kroku `class` a touhle opravou se neřešily.

## D109 — D108 platí i pro feat/ASI a class optional features (D64 krok)

Rozšíření D108. `src/levelUp/heldPicks.ts`, `FeatAsiPicker.tsx`,
`ClassOptionalFeaturePicker.tsx`.

**Chyba.** D108 zamklo podtřídu, fighting style, class skills, masteries,
manévry, expertise a class feature choices — všechno v kroku `class`. Feat/ASI
(krok `featAsi`) a class-level optionalfeatureProgression (krok
`classOptionalFeatures`, D64) žijí mimo krok `class` a D108 je vědomě
nechalo otevřené (viz jeho poslední odstavec). Level up tak mohl přepsat
feat vzatý na dřívější úrovni nebo odebrat dřívější Metamagic/invocation.

**Stejný vzor jako D108, aplikovaný na tyhle dva kroky.** `HeldPicks` nese
navíc `featAsiChoices` (celé uložené `FeatAsiChoice[]`, srovnávané podle
`level`) a `classOptionalFeatureChoices` (uložené `optionalFeatureChoices`
bez podtřídiny vlastní progrese, srovnávané podle `featureType`). Shoda se
u feat/ASI kontroluje na `kind` + `name`/`source` (feat) nebo `increases`
(ASI) — vnořené `chosenAbility`, `magicInitiate` a `filterChoiceSpells` se
nekontrolují, stejně jako se u subclass optional features nekontrolují
vnořené `spellChoices`.

**`FeatAsiPicker` dostal `lockedLevels`**: fieldset dřívějšího grantu je
`disabled` (nativní chování vypne i vnořené radio/select prvky) a legenda
říká „chosen at an earlier level". **`ClassOptionalFeaturePicker` dostal
`lockedChoices`**: každá skupina (`featureType`) počítá vlastní zamčená
jména a `SearchableOptionList` je vykreslí stejně jako u subclass optional
features (D108) — `locked`, ne `disabled`, aby zůstala vidět jako vybraná.

**`overwrittenHeldPicks` odmítá stejně jako u D108** — změnu i zahození
dřívějšího feat/ASI pick nebo class-option pick.

**Wild Shape formy a kouzla se pořád nezamykají** — D104/D106 beze změny.

## D110 — Dočasné životy jsou druhá hromádka; poškození a léčení je panel v hlavičce; current HP nikdy neklesne pod 0

Slice 9a1, první stavební slice kroku 9 a **pilot pro ukládání play state**.
`src/storage/character.ts` (`temporaryHitPoints`, schéma 35),
`src/hitPoints/damageHealing.ts`, `src/sheet/SheetHeader.tsx`,
`CharacterStore.setHitPoints`.

**Úložiště.** `Character.temporaryHitPoints?: number` — nepovinné pole, jehož
NEPŘÍTOMNOST znamená „žádné". Schéma 34→35, migrace jen tag: nepřítomnost je
správná hodnota pro každou existující postavu, protože dočasné životy vznikají
až ve hře. 0 se ukládá jako nepřítomnost pole (na rozdíl od `currentHp`, kde 0
je platný stav — postava v bezvědomí); „žádné dočasné životy" má jen jeden
význam. Tenhle tvar (nepovinné pole, absence = nic nespotřebováno, migrace jen
tag) je vzor, který kopírují další slice kroku 9 — sloty, hit dice, death saves,
pool uses.

**Dočasné životy jsou DRUHÁ hromádka, nikdy se nepřičítají k current.**
Hlavička je ukazuje jako samostatnou položku — „30 / 39 + 8 temporary", nikdy
„38 / 47". Poškození jde nejdřív z nich a teprve zbytek z current. Léčení je
neobnovuje (nejsou to utržená zranění). Nový grant se NESČÍTÁ — vyhrává vyšší
hodnota, nižší grant nechá stávající hromádku být.

**Panel poškození/léčení v hlavičce.** Jedno pole „Amount" a tři tlačítka
(Damage / Heal / Gain temporary HP); každé zapíše obě hromádky JEDNÍM zápisem,
takže sheet nikdy neukáže půlku zásahu. Cíl clampu léčení je
`computeMaxHitPoints`, ne uložené číslo — `maxHpOverride` existuje a uložené
maximum neexistuje vůbec. Léčení nikdy nesnižuje current, které už sedí NAD
maximem (to nechá po sobě snížené maximum).

**D43 na obou vstupech panelu.** Bez nastaveného `currentHp` jsou všechna tři
tlačítka nedostupná a panel řekne proč — „not set" se nesmí tiše číst jako 0.
Když `computeMaxHitPoints` vrátí `unknown`, je nedostupné jen Heal a nese
důvod; Damage zůstává, protože maximum k němu není potřeba.

**Přímé zadání zůstává (D9).** Pole Current HP i nové Temporary HP se dál dají
vyplnit ručně vedle panelu — tak hráč opraví chybu nebo zapíše postavu, která
je už zraněná. Panel je pohodlí, ne jediná cesta.

**Current HP nikdy nejde pod 0.** Záporné životy podle pravidel 2024 nic
neznamenají. Clamp je na každé cestě zápisu: `buildCharacter` a `setHitPoints`
v `CharacterStore` (takže úložiště zápornou hodnotu nepobere bez ohledu na
volajícího), `HitPointField` a `currentHpAfterMaxHpChange` (D107) — ta mohla
při odebrání úrovně těžce zraněnou postavu poslat do minusu. Tím se zavírá
otevřená otázka z kroku 8. Clamp SHORA se pořád nedělá: maximum se neukládá a
čerstvě snížené maximum legitimně nechá current výš.

**`setHitPoints` bere objekt, ne poziční argumenty** — `setHitPoints(id, {
currentHp, maxHpOverride, temporaryHitPoints })`. Stejný důvod jako u 8c0:
poškození i léčení hýbou dvěma poli v jednom zápisu a zapomenutá pozice by
tiše vymazala hromádku. Vzor „jeden setter na starost" zůstává — hit pointy
jsou jedna starost.

## D111 — Death saves jsou nepovinné pole vázané na `currentHp === 0`; hod appky a ruční klik vedle sebe; stabilizace a smrt zastaví hody, ale panel nezmizí

Slice 9a2, druhá stavební slice kroku 9. Kopíruje tvar z D110.
`src/storage/character.ts` (`deathSaves`, schéma 36),
`src/hitPoints/deathSaves.ts`, `src/sheet/SheetHeader.tsx`,
`CharacterStore.setHitPoints` / `buildCharacter`.

**Úložiště.** `Character.deathSaves?: { successes: number; failures: number }`
— jedno nepovinné pole se dvěma počty 0–3. NEPŘÍTOMNOST znamená „žádný death
save neběží"; nula-nula se ukládá jako ta nepřítomnost, stejně jako dočasná 0
v D110. Které konkrétní políčko je zaškrtnuté nenese žádný význam, takže se
ukládají jen počty, ne pole boolů. Schéma 35→36, migrace jen tag: death save
běží jen ve hře a nic před touhle verzí ho nemohlo zaznamenat.

**Death saves existují VÝHRADNĚ při `currentHp === 0`.** Není to jen podmínka
zobrazení — je to invariant úložiště. `deathSavesAfterHitPointChange(currentHp,
deathSaves)` je jediná implementace toho pravidla a volá ji jak `buildCharacter`
a `setHitPoints` (takže žádný zapisovatel — léčení, přímé zadání, level up,
odebrání úrovně — nemůže nechat nemožnou dvojici), tak hlavička (aby hodnota,
kterou předává, už četla pravdivě). Jakmile je current nad 0, postup je pryč;
žádný „zbytek", ke kterému by se šlo vrátit. „Nenastaveno" není 0 (D43) —
postava bez `currentHp` neumírá a panel nemá.

**Dvě cesty vedle sebe, bez přepínače.** Tlačítko „Roll death save" hodí
appka vlastní d20 — hod bez jakéhokoli bonusu, takže není co sdílet s obecným
hodítkem kostek, které staví pozdější krok; hozené číslo se hráči VŽDY ukáže,
protože kostku neviděl. Tlačítka „Success" / „Failure" jsou pro hráče, který
hodil fyzickou kostkou: přičtou jedno políčko a nic neinterpretují — hráč už
ví, co padlo. Obě cesty jsou dostupné pořád.

**Přirozená 20 a přirozená 1 platí jen pro hod appky.** Nat 20 = postava má
hned 1 current HP, postup se maže a panel zmizí — je to léčení jako každé
jiné (zavírá se tím i přes obecné pravidlo výš). Nat 1 = DVA neúspěchy naráz,
zastropované na 3 (nat 1 při dvou neúspěších dá tři, ne čtyři). 10–19 úspěch,
2–9 neúspěch.

**Tři úspěchy = stabilizováno, tři neúspěchy = smrt; obojí zastaví všechna tři
tlačítka.** Stabilizovaná postava zůstává na 0 a v bezvědomí; „za 1k4 hodin"
appka neumí, protože nesleduje čas, takže ji zpátky dostane jen léčení —
což je už pokryté obecným pravidlem. **Panel po smrti NEZMIZÍ a nevynuluje
se**: prázdný nebo zmizelý panel by se četl jako chyba appky, ne jako smrt
postavy. Zmizí až se změnou `currentHp` (typicky přímé zadání, kterým hráč
opravuje omyl).

**`HitPointFields` nese čtvrté pole.** `setHitPoints` zapisuje death saves
spolu s hit pointy jedním zápisem — jsou na `currentHp` vázané a dva zápisy by
mezi sebou nechaly nemožný mezistav.

## D112 — Deployment data: public repo, revisit only if usage grows

Data (5etools content) deploys with the app as a public repository — option
1 from the now-closed QUESTIONS.md question "Where data lives at
deployment". No change from today's default.

Rationale: the app is for the author and a handful of friends, not a paying
product or public release. The licensing risk of an unpaid, small hobby
deployment is low enough not to justify a private repo or per-user uploads
now. Revisit if usage grows beyond a private circle or the project is
monetised.

## D115 — Hod na zásah stojí munici bez ohledu na to, jestli zasáhne

Slice 9d4. `CharacterSheet.tsx` `weaponAttackRow`, to-hit `RollButton` → `onSpend`.

Appka neadjudikuje zásah/minutí (SPEC.md) — hod na zásah proto odečte munici
hned při kliknutí na Roll, ne až po vyhodnocení výsledku. Odpovídá tomu, jak
hráč skutečně střílí: šíp je vystřelený, ať trefí nebo ne. Poškození munici
neodečítá — odečet už proběhl u to-hit hodu ve stejném útoku.

## D116 — Volná textová pole na sheetu se zapisují odloženě (500 ms nečinnosti, nebo blur), ne při každém stisku

Slice 9d2, oprava zpoždění psaní. `CharacterSheet.tsx` `TextSection`.

Zobrazená hodnota `<textarea>` je jen lokální draft. `onEdit` (→ `store.setText` →
`refresh()`) se volá až po 500 ms bez psaní, okamžitě při blur a při unmountu
(zavření sheetu / přepnutí postavy nevyvolá blur). Čekající zápis, který blur
předběhne, se zruší, takže se stejný text nezapíše dvakrát; blur bez změny nezapíše
nic. Dřívější zápis při každém stisku znovu naparsoval všechny uložené postavy,
dal `character` novou identitu a tím přerenderoval celý sheet po každém znaku.

Cena: při pádu karty v okně 500 ms po posledním stisku se poslední úsek textu ztratí;
blur a unmount to pokrývají v běžném použití.

**Širší problém zůstává a je vědomě odložený:** v celé kódové bázi není žádná
memoizace (`useMemo`/`useCallback`/`React.memo`), 13 `useEffect`ů je klíčovaných na
identitu celého `character` a všech šest panelů záložek je stále připojených. Každý
jiný zápis (inventář, HP, spotřeba zdrojů) tak dál platí plný přerender. Tady se řeší
jen příznak u tří textových polí; oprava příčin je samostatná práce. Z vyšetřování:
`refresh()` po každé mutaci vrací `store.list()`, tedy nově naparsované objekty, takže
`character` mění identitu při každém zápisu; efekty přepočítávají extraktory, které
se necachují (cachují se jen fetche, D39); `ResolvedEntries` volá `buildExpansions` při
každém renderu a `resolveRef` → `findById` je lineární průchod polem featur na každý
výskyt odkazu; `Markup` znovu parsuje každý řetězec. Pořadí příspěvků je odhad ze čtení
kódu, neměřený.

## D117 — Záchranné hody proti smrti se hází stejným kostkovým mechanismem jako ostatní hody a zapisují se do historie hodů

Slice 9a2 + 9c3b. Ruší část D111, která dala death save vlastní lokální d20
(`rollDeathSaveDie`) mimo sdílený roller.

`DeathSavePanel` teď hází `rollKeepOne(20, 0, 'normal')` z `src/dice/roll.ts` — tutéž
funkci, kterou používá `RollButton` — bez modifikátoru a bez výhody/nevýhody, protože
death save ani jedno nemá. Každý hod (i ruční tlačítka Natural 20 / Natural 1) se hlásí
sheetu přes `onRoll` a objeví se v historii hodů jako jeden záznam
`Death save: Rolled N — …`. Tlačítka Success / Failure zůstávají mimo historii: nejsou
hod, jen zatržení políčka.

Text záznamu je `describeDeathSaveRoll` ("Rolled 1 — two failures."), ne obvyklý rozpis
`N + 0 = N`. Death save nemá modifikátor, takže by rozpis nic nepřidal, a u přirozené 1
je podstatné, že se počítá za dvě neúspěchy — to se vejde do jednoho záznamu a nemusí
se to štěpit na dva.

Hozené číslo se zobrazuje v hlavičce (`.sheet__death-save-roll`, `role="status"`), ne
uvnitř panelu: přirozená 20 panel odpojí (postava je na 1 HP), a s ním by zmizelo i to,
co padlo — hráč by neviděl vůbec nic. Hláška zůstává až do dalšího death save hodu nebo
do zavření sheetu; je to poslední věc, která se s HP stala, a mizet sama nemá proč.

Pravidla samotná se nemění: prahy, přirozená 20 / 1 i stabilizace zůstávají v
`deathSaves.ts` beze změny.

## D118 — Volná textová pole se zapisují i při zavření karty (`beforeunload`, `pagehide`)

Doplňuje D116, jehož poslední odstavec uváděl ztrátu textu při pádu nebo zavření karty
v okně 500 ms po posledním stisku jako přijatou cenu. `TextSection` nově registruje
tentýž `flush()` na `beforeunload` a `pagehide` okna. `flush()` je idempotentní (zruší
čekající timer, bez čekajícího zápisu nedělá nic), takže se nic nezapíše dvakrát.
`pagehide` pokrývá případy, kdy `beforeunload` neproběhne (mobilní prohlížeče, bfcache).
Zbytek D116 — 500 ms prodleva, blur, unmount — beze změny.

## D119 — Implicitní jedno použití: zmínka o vlastnosti/modifikátoru ho neblokuje; Aberrant Dragonmark a Natural Recovery zůstávají bez trackeru

Step 9. Mění pravidlo `isImplicitSingleUse` z commitů 0e657a2 a 15eee36: feature, jejíž
text říká jen "can't … again until you finish a Short/Long Rest" a neuvádí počet, má
jedno použití (max 1).

**Vypuštěna výjimka `NAMES_A_STAT`.** Přeskakovala každou feature, která kdekoli v textu
jmenuje vlastnost, "modifier" nebo "Proficiency", z obavy, že jde o počet spočítaný ze
statu. Prošlo se všech 18 takto přeskočených features: v 17 je zmínka záchranný DC, bonus
k útoku nebo vzorec zranění, nikdy počet použití. Těch 17 (Avenging Angel, Beguiling
Defenses, Beguiling Magic, Bulwark of Force, Clairvoyant Combatant, Greater Mark of
Hospitality, Hand of Ultimate Mercy, Holy Nimbus, Hurl Through Hell, Intimidating
Presence, Living Legend, Mage Slayer, Rend Mind, Searing Vengeance, Spell Thief,
Unbreakable Majesty, Warping Implosion) tedy dostává Uses tracker s max 1. Počet
použití vyjádřený statem by pořád chytil `STATES_A_COUNT` ("number of times", "uses").
Tři z nich (Clairvoyant Combatant, Mage Slayer, Unbreakable Majesty) se nabíjejí i na
Short Rest ("Short Rest or Long Rest"); `singleUseRechargesOnShortRest` je vrací beze
změny.

**Osmnáctá feature, Aberrant Dragonmark, a Natural Recovery jsou jiný problém.** Každá
nese v jednom záznamu DVA nezávislé limity (Aberrant Dragonmark: schopnost jen na Long
Rest a zvlášť použití kouzla na Short nebo Long Rest; Natural Recovery: bezplatné
seslání kouzla Kruhu na Long Rest a zvlášť obnova slotů). Jeden max-1 tracker by je
tiše slil. Obě jsou v `TWO_INDEPENDENT_LIMITS` a zůstávají "not in the data" (D43), dokud
nepůjde modelovat víc zdrojů na jednu feature. Natural Recovery tím z trackeru vypadává:
patřila mezi původních 24 a před tímto rozhodnutím ukazovala jeden tracker s max 1.

Nemodeluje se nic nového; víc limitů na feature je samostatný úkol. Celkem je teď
40 implicitních jednoduchých použití (24 − Natural Recovery + 17), hlídaných testem
proti reálným datům v `resources.test.ts`.

## D120 — Action Surge a Indomitable mají ručně psanou tabulku úrovní: vědomá výjimka proti D21/D43; `STATES_A_COUNT` zúžen; Magic Item Tinker bez trackeru

Step 9. Navazuje na D119.

**Ručně psaná tabulka dvou features.** Action Surge a Indomitable (Fighter) mají skutečný,
úrovní odstupňovaný počet použití, který data nesou jen v próze — žádný sloupec v
`classTableGroups`, žádné pole. Action Surge: 1 na úrovních 2–16, 2 od 17 ("use it twice
before a rest"). Indomitable: 1 na 9–12, 2 na 13–16, 3 od 17 ("twice … starting at level
13 and three times … starting at level 17"). Každý záznam obou features nese celý text,
takže stačí úroveň třídy Fighter z `character.classes`. `LEVEL_SCALED_USES` v
`calculation/resources.ts` je tabulka klíčovaná jménem (className + zlomy úrovní),
opsaná z textu features. Je to vědomá výjimka proti D21 a D43 („nečíst číslo z volné
prózy") ve stejném duchu jako D93: číslo v datech existuje, je vázané na úroveň a
potřebují ho jen 2 features. Záměrně to NENÍ obecný parser počtů z prózy — další
feature se přidává jen novým rozhodnutím. Action Surge se obnovuje i na Short Rest
("Short Rest or Long Rest"), celý pool; Indomitable jen na Long Rest.

**`STATES_A_COUNT` zúžen na počet vlastních použití.** Nechytá už násobitel ("twice your
Artificer level", "three times your Paladin level", "twice your Speed") ani "uses"
jiného poolu ("uses of Rage", "uses of Wild Shape"). Superior Atlas, Undying Sentinel,
Psi-Powered Leap, Persistent Rage, Wild Resurgence a Archdruid tak dostávají max 1;
Psi-Powered Leap se obnovuje i na Short Rest. U Wild Resurgence a Archdruid se sleduje
jen ta část textu, která má limit na odpočinek, pod jménem feature.

**Magic Item Tinker** (Artificer) má stejný tvar jako Aberrant Dragonmark a Natural
Recovery: Drain Magic Item a Transmute Magic Item jsou každý zvlášť jednou za Long Rest,
Charge Magic Item bez limitu. Přidán do `TWO_INDEPENDENT_LIMITS`, tracker nemá.

Celkem 48 známých maxim bez tabulky: 46 jednoduchých použití (40 z D119 + 6) a 2 z
ručně psané tabulky. 9 z nich se obnovuje na Short Rest.

## D121 — Nejdřív rework sheetu, wizard až po něm

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Wizard sdílí stejný vizuální základ, proto jde druhý.

## D122 — Cílem je laptop/monitor (1366–1920 px); mobil mimo rozsah

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D123 — Záložky Actions, Spells, Inventory, Features & Traits, Notes, Extras; dnešní záložka statistik se rozpouští do pevného levého sloupce

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Levý sloupec nese záchranné hody, smysly, proficience a dovednosti.

## D124 — Položky v Actions jsou sbalené řádky, rozbalí se kliknutím

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D125 — Výběr kouzel se stěhuje do draweru „Manage Spells" na sheetu; wizard ho použije znovu

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Povinně filtr úrovně kouzla (víc úrovní naráz) a zvýraznění už vybraných kouzel.

## D126 — Žádný společný inventář družiny, žádná váha/zatížení; kontejnery mimo rozsah

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D127 — Políčka použití: jeden záznam, zobrazený v Actions i ve Features & Traits

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D128 — Manage Feats jen pro extra featy (dar od DM); featy z úrovní jsou zamčené

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D129 — Featy s volbou dovedností (Skilled apod.) jsou povinná samostatná oprava

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D130 — Záložka Extras: familiár a Wild Shape formy, statblock v draweru, HP familiára se sledují

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D131 — Heroic Inspiration, Defenses a Conditions na sheetu; Conditions jsou štítek plus text pravidel, bez automatických efektů

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D132 — Bonusy od DM/homebrew přes rozšířený custom item (pasivy, dovednosti, smysly), nikdy přes override pole

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D133 — Detaily a úpravy se schovávají za ikonu ozubeného kola, ne do nových prvků na sheetu

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D134 — Jeden sdílený boční drawer ~460 px; sheet se kvůli němu nikdy nezužuje

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Vedle sheetu, když se vejde, jinak přes jeho pravou část; otevřený jen jeden; zavírá X a Esc.

## D135 — Téma „Tyrkys" (akcent #00f4f8 tmavé / #007c80 světlé), tmavé výchozí, přepínač

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D136 — Pozadí s žhavými jiskrami reagujícími na kurzor, oddělené od sheetu, vypínatelné, respektuje reduced motion

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D137 — Ověřovací postava pro rework a step 10: Mistari, Tiefling Warlock 6 / Sorcerer 3

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D138 — Inventář, attunement a custom item si nechávají dnešní ovládání, přesunuté do draweru

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D139 — CAST utratí jeden slot úrovně sekce, pod kterou řádek stojí; při 0 slotech je vypnutý

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D140 — Volby featů jsou editovatelné v Manage Feats, i u zamčených featů z úrovní

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D141 — Appka hlídá počty připravených/známých kouzel, ne to, kdy se smějí měnit

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D142 — Multiclass (step 10) přichází až po reworku sheetu a wizardu

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D143 — Tlačítko Level Up v hlavičce sheetu

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D144 — Fonty: Bricolage Grotesque (nadpisy), Source Sans 3 (text)

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D145 — Seznam postav a sheet jsou oddělené pohledy; wizard dostane vlastní plný pohled místo sheetu (ne drawer); `main` max-width 48rem padá

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D146 — Rozpady hodnot (D40/D41) se stěhují z inline `<details>` do draweru

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Otevírá je ikona ozubeného kola / popisek; klik na hodnotu dál hází. Nahrazuje část D41 o inline rozpadu (D41 se needituje).

## D147 — Hit dice malým řádkem pod HP; velikost v hlavičce u druhu; pasivní hodnoty a darkvision pod Senses; defenses ve stavovém řádku

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D148 — Popisky UI záložek anglicky

Zdroj: plán reworku sheetu, 21.-22. 9. 2026.

## D149 — Fonty self-hostované přes @fontsource; za běhu žádný požadavek na cizí origin

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Appka musí fungovat offline.

## D150 — Nastavení appky v samostatném úložišti (`familliar:settings`), ne v postavě

Zdroj: plán reworku sheetu, 21.-22. 9. 2026. Bez zvýšení verze schématu.

## D151 — Aktuální pohled appky žije v URL hash; Back prochází pohledy; žádná routovací knihovna

Zdroj: task R1b (rework sheetu, D145), 22. 9. 2026. Seznam, sheet a wizard (`#/`, `#/new`, `#/character/<id>`, `#/character/<id>/edit`, `#/character/<id>/level-up`, `#/markup-demo`) jsou jeden `parse`/`format` pár v `src/navigation/route.ts` plus jeden `useRoute` hook na úrovni `App`, který poslouchá `hashchange`; pohledy dostávají route/navigate jako props, nevolají hook samy. F5 zůstává na stejném pohledu. Otevření postavy, New, Edit, Level up a horní záložky PUSHují novou položku historie; dokončení nebo zrušení wizardu ji REPLACE, takže Back wizard znovu neotevře. Neznámý hash nebo neexistující id postavy REPLACE na seznam — týž efekt řeší i smazání postavy, jejíž sheet byl otevřený. Level-up route nese jen id, ne spočtený `LevelGains` (ten se ztrácí při F5) — `src/levelUp/LevelUpWizardGate.tsx` ho dopočítá znovu z postavy stejně jako `LevelUpButton`, protože `levelUpTarget`+`loadLevelGainsFor` jsou čisté/deterministické (D101).

## D152 — Auto-scroll na wizard (část opravy 4e67cad) je zrušený — wizard má vlastní pohled

Zdroj: task R1b, 22. 9. 2026. D145 oddělil sheet a wizard na samostatné pohledy (D151 je zapojil do hash routingu); wizard už nesdílí stránku se sheetem, takže `wizardRef`/`scrollToWizard`/`ResizeObserver` z opravy 4e67cad (scroll na wizard po Level up / Edit character) i jejich test v `CharacterManager.test.tsx` odpadají jako mrtvý kód. Zbytek 4e67cad (proč k scrollování vůbec docházelo) zůstává platný jako historický záznam — tento zápis ruší jen samotný scroll efekt, ne důvod, proč vznikl.

## D153 — Sheet je layout na jeden viewport; scrolluje jen levý sloupec a pravý panel

Zdroj: task R2 (rework sheetu), 22. 9. 2026. Pohled sheetu má výšku viewportu (100dvh): hlavička, pás čísel a stavový řádek mají přirozenou výšku, zbytek vyplní řádek těla. Stránka sama nescrolluje; vlastní vertikální scroll mají jen levý sloupec (pevná šířka ~580px) a pravý panel se záložkami (tab bar zůstává stát, scrollují panely pod ním). Na nízké obrazovce levý sloupec scrolluje uvnitř, pás čísel nad ním se kvůli němu nezmenšuje.

## D154 — Stats tab se rozpouští do levého sloupce; size a hit dice mají nové domovy; Proficiencies vynechány

Zdroj: task R3 (rework sheetu), 22. 9. 2026.

Záložka "Vlastnosti a hody" (dnešní `stats` v `SHEET_TABS`) přestává
existovat. Zůstává pět záložek (Kouzla, Inventář, Schopnosti a rysy,
Akce, Vzhled a poznámky), pořadí a české popisky beze změny — D123
(pořadí Actions-první) a D148 (anglické popisky) na zbylých pěti
záložkách tímto úkolem NEaplikovány, jsou mimo jeho rozsah.

Levý sloupec (`.sheet__left-column`, prázdný od D153/R2) dostal obsah,
dvě sub-sloupce: `.sheet__left-a` (Saving throws — dvě sub-sub-sloupce
po třech, STR/DEX/CON | INT/WIS/CHA — Passive values, Darkvision,
Senses) a `.sheet__left-b` (~252px, Skills, všech 18). Žádný výpočet se
nemění, jen kontejner a pozice; každá hodnota si drží svůj inline
rozklad (D40/D41) přesně jako dřív — D146 (rozklady do draweru) na tenhle
task nedopadá, přijde s R4.

**Proficiencies (Armor / Weapons / Tools / Languages) vynechány.** D123
je počítala jako součást levého sloupce, ale sheet je nikdy nikde
nezobrazoval — `character.masteries` a `character.languages` se ukládají
a nikde nečtou, a pro zbrojní/zbraňové kategorie neexistuje žádný
výpočet. Uživatel při task R3 potvrdil vynechat a založit jako otevřenou
otázku (QUESTIONS.md), ne stavět novou kalkulační vrstvu uvnitř téhle
layoutové úlohy.

**Ability scores přestávají mít vlastní seznam.** R2 zavedla
`AbilityModifierCards` v pásu čísel jako DOČASNOU duplikaci vedle
textového seznamu ve stats tabu (`.sheet__abilities`, s roll tlačítky a
rozkladem). R3 seznam maže beze zbytku — karty v pásu jsou od teď JEDINÉ
místo, kde se vlastnosti zobrazují. Karty samy roll tlačítko ani rozklad
nemají a tenhle task jim ho nepřidává: bylo by to nová funkcionalita nad
rámec "dissolve stats tab", ne přesun existující. Hráč tak ztrácí
možnost hodit si ability check a rozkliknout rozklad vlastnosti přímo na
sheetu — zaznamenáno jako vědomý úbytek funkce, ne přehlédnutí.

**Size** se přesouvá do identity řádku v hlavičce, vedle jména druhu —
`"Tiefling (Medium) · Warlock 6 / Sorcerer 3 · Level 9 · <background>"`
(`.sheet__size`). Bez rozkladu tady (na rozdíl od levého sloupce) — jde o
řádek s `white-space: nowrap`, kam `<details>` nepatří, a D146 stejně
brzy přesune rozklady jinam.

**Hit dice** se přesouvá pod HP blok uvnitř `.sheet__strip`
(`.sheet__hit-dice`, zmenšeno CSS, stejná třída i markup jako dřív —
žádná změna chování, spend/restore přes Short/Long Rest beze změny).
`SheetHeader` dostal nový nepovinný prop `hitDice: ReactNode` — obsah
staví volající (`CharacterSheet`, který drží spend/roll stav), stejný
vzor jako `identity`/`abilities`/`defenses`.

`.sheet__traits` teď nese jen Darkvision (nadpis "Size and
darkvision" → "Darkvision"); Passive values a granted Senses zůstávají
samostatné sekce vedle sebe v `.sheet__left-a`, ne sloučené pod jeden
nadpis — žádný test ani zadání nevyžadovaly jeden spojený nadpis a
oddělené sekce zachovaly víc existujících testovacích selektorů beze
změny.

## D155 — Ability-check roll se vrací na karty v pásu čísel; rozklad zůstává vynechaný do draweru (R4)

Zdroj: task R3b (rework sheetu), 22. 9. 2026.

D154 smazala roll tlačítko u ability scores jako vědomý úbytek funkce
při rozpouštění stats tabu — v zadání R3 šlo o chybu, ne o záměr. R3b ho
vrací: `AbilityModifierCards` dostala nepovinný `onRoll`, karta pod
modifierem vykresluje stejný `RollButton` a stejné zapojení do
`recordRoll`/roll historie jako saves a skills v levém sloupci, se
stejným accessible name jako před D154 (`"Roll Strength check"` apod.).
Nevyřešená vlastnost (karta "—") nemá roll tlačítko, jako dřív.

RollButton je umístěn POD modifier span, ne jako obal/trigger čísla
samotného — `RollButton` renderuje vlastní `<select>` + `<button>` +
výsledek, takže by z modifieru udělal netriviální strukturu jen kvůli
vzhledu; umístění pod ním dává stejnou funkci bez přestavby komponenty.

Rozklad (`ValueBreakdown`) na kartách se NEVRACÍ — D146 ho stěhuje z
inline `<details>` do sdíleného draweru a ability cards na něj čekají
jako jediné místo, kde vlastnosti žijí. Do R4 tedy sheet nemá rozklad
ability score vůbec, jen re-implementovaný roll.

## D156 — Origin featy přes `grantedFeats`; feat z backgroundu se odvozuje; všichni čtenáři přes `featInstances`

Zdroj: task A1, 22. 9. 2026.

Feat, který nezaplatila ASI úroveň, se ukládá do `Character.grantedFeats`
(`origin: 'background' | 'species'`, jméno, zdroj a podvolby
`FeatChoiceDetails`, sdílené s featem v `featAsiChoices`). Feat
z backgroundu se NEukládá — odvozuje se z backgroundu a dat. Záznam
s `origin: 'background'` nese jen podvolby a platí, jen když jméno a zdroj
sedí na origin feat aktuálního backgroundu; jinak se ignoruje. Klíč
instance: `asi:<level>` | `background` | `species`. Každý čtenář efektů
featů jde přes `featInstances`, nikdy přímo přes `featAsiChoices`.

## D157 — Human Versatile: tvar dat teď, picker až s přestavbou wizardu

`origin: 'species'` existuje v typu a validátoru, ale nic ho nezapisuje
ani nečte, dokud přestavba wizardu nepřinese picker volného Origin featu.

## D158 — Jazyk z featu (Prodigy) se ukládá jen na instanci featu

Ne do `Character.languages`. Zdroj jazyka tak zůstává u featu, který ho dal.

## D159 — Expertise z featu smí padnout na skill, který dal tentýž feat

Prodigy a Skill Expert dávají skill i expertise; expertise smí jít na
skill vybraný tímtéž featem.

## D160 — Skill nebo nástroj, který postava už má, picker featu nenabídne

Stejné pravidlo jako D18 u skillů z backgroundu.

## D161 — Poznámka D58 se na nástroje a jazyky nerozšiřuje

Poznámka „čeká na volbu" zůstává jen u skillů; volby nástrojů a jazyků
z featů místo ní dostanou picker.

## D162 — R3c: sdílená šířka stránky 1440px, čitelná délka řádku 75ch, úzká čísla

Zdroj: task R3c (rework sheetu), 22. 9. 2026.

**Šířka stránky.** `--page-max-width: 1440px` (`src/index.css`, `:root`) —
jediná proměnná, kterou čte element `main`
(`max-width: var(--page-max-width); margin: 0 auto;`). Seznam postav, wizard
a sheet vykreslují do `<main>` (sheet navíc nese `.sheet-view`), takže
tahle jedna deklarace na `main` je platí všechny tři beze zbytku — R3c jí
nahradila dřívější `max-width: 48rem` (seznam/wizard) a `max-width: none`
(`.sheet-view`, mazáno). Pod 1440px `main` dál vyplňuje okno (`width: auto`
se přirozeně zmenší, žádný jiný zásah netřeba). Horní `.tabs` lištu (D148)
task záměrně nechává na vlastním `max-width: 48rem` — zadání ji z rozsahu
vyjímá. D153 (sheet na jeden viewport) beze změny — `.sheet-view` dál nese
`flex:1; min-height:0; box-sizing:border-box`, jen bez vlastního stropu
šířky.

**Čitelná délka řádku.** `.mk-p` (nová třída na každém `<p>`, který
`Entry()` v `src/markup/Markup.tsx` vykreslí ze stringu/čísla — string i
number case) a `.mk-list` (`<ul>` z entry typu `list`, třídu už nesla)
dostaly `max-width: 75ch` v `src/index.css`. Jde o JEDINÉ místo, kam pravidlo
patří — `Entry()`/`TypedEntry()` jsou jediný zdroj odstavců a seznamů napříč
celým rendererem (feature/feat/spell/item popisy, `ResolvedEntries`,
`ItemDescription`, `MarkupDemo` — všechny jdou skrz tutéž funkci), takže
třída na volajícím místě by se musela opakovat u každého callsite. Tabulky
(`.mk-table-wrap`/`.mk-table`) jsou jiný element a limit nedostaly — mají
zůstat široké, jak potřebují. Čtyři testy v `Markup.test.tsx`, které
assertovaly `<p>` bez třídy, jsou přepsané na `<p class="mk-p">`.

**Úzká číselná pole.** Dvě sdílené třídy v `src/index.css`:
`.input--narrow` (6ch — množství, životy) a `.input--narrow-money` (8ch —
peníze). Nasazené na všech osm `type="number"` polí v appce:
`CommitNumberField` (množství v inventáři defaultně `narrow="qty"`, zlato/
stříbro/měď na peníze volají `narrow="money"`), `CommitGoldField` (custom
item cena ve zlatě) a `AddPlatinumField` — obě vždy peníze — `OptionalNumberField`
(AC/rychlost/darkvision/Strength requirement custom itemu — vždy qty),
`HitPointField` (Current HP / Max HP override / Temporary HP —
`SheetHeader.tsx`), pole Amount v `DamageHealingPanel`, ruční zadání
vlastnosti (`AbilityScorePicker.tsx`) a ruční výsledek kostky
(`HitPointsPicker.tsx`) ve wizardu. Jen šířka — typ pole, chování ani
validace se nemění.

**Vědomě ponecháno.** Pruh čísel v hlavičce (D153/D147) se při 1440px
přestane vejít na jeden řádek a HP blok spadne pod ně na vlastní řádek —
očekávané, oprava je R4c (kompaktní HP blok), tenhle task ji záměrně
nedělá.

## D163 — R4: sdílený boční drawer (460px), karta Senses, rozpad ability score pod jménem vlastnosti

Zdroj: task R4 (rework sheetu), 22. 9. 2026. Provádí D134/D146/D133.

**Drawer.** `src/sheet/Drawer.tsx` — tři exporty: `Drawer` (obal),
`DrawerSection` (rozbalovací sekce, defaultně otevřená) a `DrawerRow`
(rozbalovací řádek, defaultně zavřený). Sekce i řádek jsou `<details>`, takže
stav otevření i klik drží prohlížeč, stejně jako u `ValueBreakdown` (D41);
značku ▾/▸ kreslí `::before` (sekce) a `::after` (řádek) v `src/index.css`,
nativní marker je vypnutý.

Šířka `--drawer-width: 460px`, `position: fixed` přes celou výšku okna, vlastní
scroll má jen `.drawer__body`. Protože je fixed, sheet se kvůli němu nikdy
nezužuje a na pořadí v DOM nezáleží. Dvě polohy, rozdělené jedinou media query
na `1900px` (= `--page-max-width` 1440 + 460): nad ní drawer stojí vpravo
těsně vedle sheetu (`left: calc(50vw + var(--page-max-width)/2 -
var(--drawer-width)/2)`) a `main:has(.drawer)` posune sheet o půl draweru
doleva, takže dvojice je vycentrovaná jako celek; pod ní leží drawer přes pravou
část sheetu — bez tmavého pozadí, zbytek sheetu zůstává klikatelný.

Který obsah je otevřený, drží jeden `useState<DrawerContent | null>` v
`CharacterSheet.tsx`. Je to výhradně UI stav: nikam se neukládá, není v URL a
po reloadu je pryč. Otevřít druhý obsah znamená přepsat tu jednu hodnotu, takže
"nejvýš jeden najednou" není pravidlo navíc, ale důsledek. Zavírá `×` v hlavičce
draweru a Esc (posluchač na `document`, odhlašovaný při unmountu).

**Karta Senses.** Bloky "Passive values" a "Darkvision" v levém sloupci jsou
jedna karta `.sheet__senses-card` s nadpisem Senses a ikonou ozubeného kola
(accessible name "Senses details", inline stroke SVG). Hodnoty jsou stejné, jen
bez inline rozpadu — `CalculatedValueOnly` (nový, `calculatedValue.tsx`)
vykreslí číslo bez `<details>`. Rozpady všech čtyř hodnot (Passive Perception,
Investigation, Insight, Darkvision) jsou teď dostupné JEDINĚ v draweru, jedna
`DrawerSection` na hodnotu, obsah beze změny přes `CalculatedNumber` /
`ValueBreakdown` (D40/D76). Bez textu pravidel, bez editovatelných polí a bez
overridů — to je na pozdější slice. Seznam udělených smyslů (`SensesList`,
`.sheet__senses`) je vnořený do téže karty a jeho nadpis se z `<h2>Senses`
změnil na `<h3>Granted senses`, aby v levém sloupci nestály dva bloky téhož
jména; jeho pravidlo "žádný prázdný nadpis" platí dál.

**Rozpad ability score.** Jméno vlastnosti na kartě v pásu čísel (STR, DEX…) je
tlačítko (`.ability-card__name-button`, accessible name "Strength score
breakdown"), které otevře drawer s celým jménem vlastnosti v titulku. Obsah je
ten, co ukazoval zrušený stats tab před 8507ed3: `score (modifier)` plus
`ValueBreakdown` nad `result.breakdown` z `computeAbilityScores` — stejná
hodnota, stejný seznam příspěvků, stejný renderer, mění se jen místo. Roll
tlačítko a advantage select na kartě zůstávají beze změny (D155).

## D164 — R4-fix: šířka stránky 1400px, breakpoint draweru 1860px, rozpady v draweru otevřené

Zdroj: task R4-fix, 22. 9. 2026. Dodatek k D162 (šířka stránky) a D163
(breakpoint draweru) — D162 a D163 se nepřepisují, tohle je oprava obou.

**Šířka.** `--page-max-width` (`src/index.css`, `:root`) z 1440px na 1400px.
Uživatelovo okno na 1920px monitoru je o něco užší než 1900px, takže se při
1440+460=1900 drawer položil přes sheet místo vedle něj. Breakpoint jde s ním:
`1900px` na `1860px` (= nová `--page-max-width` 1400 + `--drawer-width` 460),
i s komentářem u media query, že číslo musí sedět na součet obou proměnných —
CSS media query samo proměnné číst neumí. Obě polohovací formule
(`.drawer { left: calc(...) }` a `main:has(.drawer) { margin-left:
calc(...) }`) už dřív počítaly jen z `--page-max-width` a `--drawer-width`,
žádné další pevné číslo v nich nebylo, takže je nebylo co opravovat.
`--drawer-width` zůstává 460px.

**Rozpady v draweru otevřené.** `ValueBreakdown` (`src/sheet/ValueBreakdown.tsx`,
D41) dostal nepovinný prop `open` (`<details open={open}>`) — mimo drawer se
nepředává, takže D41 (sbalené, dokud si o rozklad uživatel neřekne) platí dál
beze změny. `CalculatedNumber` (`src/sheet/calculatedValue.tsx`) ho posílá dál
jako `breakdownOpen`. V draweru ho nastavují všechna čtyři volání v Senses
(Passive Perception/Investigation/Insight přes `CalculatedNumber`, Darkvision
přímo) a `AbilityScorePanel` — dřív se muselo kliknout dvakrát (otevřít drawer,
pak rozbalit Breakdown), teď stačí jednou.

## D165 — R4d: globální přepínač advantage, toast s výsledkem hodu, „Rolls" v horní liště, bez nadpisu „Familliar"

Zdroj: task R4d (rework sheetu), 24. 9. 2026. Mění D146/D163 v tom, kde se hody
spouštějí a zobrazují; ničemu dřívějšímu neodporuje kromě per-tlačítkového
`<select>` režimu (slice 9c3a) a inline výsledku (9c1), které se ruší.

**Přepínač.** Segmentovaný ovladač Normal · Advantage · Disadvantage v hlavičce
sheetu, těsně vlevo od Short Rest (`RollModeSwitch`, `src/dice/RollUi.tsx`).
Režim drží `useState` v `CharacterSheet` a rozdává ho přes `RollModeContext` —
čistě UI stav, neukládá se na postavu a není v URL. `RollButton` (d20) ho čte a
po KAŽDÉM hodu ho vrací na Normal. `DamageRollButton` a death save v hlavičce
advantage nikdy neměly, přepínač ignorují a nechávají ho být. `RollButton` už
nemá vlastní `<select>` ani stav výsledku.

**Toast.** Po každém hodu (i damage, hit die a death save) vpravo dole fixní
toast, 300px, jeden najednou — nový hod ho nahradí, po 6 s zmizí sám, má ×
a je v `aria-live="polite"` regionu, který je v DOM pořád. Ukazuje label
(stejný jako v historii), kostky (u advantage obě d20, nepoužitá přeškrtnutá v
`--text-mute`) a `kostky ± modifikátor = součet`. Data nese `RollReport.detail`
(`dice`, `keptIndex`, `modifier`, `total`); hod bez `detail` (death save) ukáže
jen `text`. Stav i časovač jsou uvnitř `RollToast`; `CharacterSheet` mu jen
volá funkci přes ref, takže tik časovače nepřekresluje sheet (D116).

**Rolls v horní liště.** Tlačítko „Rolls" vedle „Markup demo" a „Light" otevře
sdílený drawer (D163) s titulkem „Roll history" a stejným seznamem jako dřív
(pořadí, limit 50). `App` nese prázdný `<span>` slot v `<nav>` a dává ho do
`RollsNavSlot`; `CharacterSheet` do něj tlačítko vykreslí portálem, takže existuje
jen dokud je sheet otevřený. Disclosure „Roll history" v hlavičce sheetu je pryč.
Historie dál přežívá přepnutí na jinou postavu — samostatná chyba, tady se
neřeší.

**Nadpis.** `<h1>Familliar</h1>` z `CharacterManager` (všechny pohledy) je pryč
a nic ho nenahrazuje; `<title>` dokumentu zůstává. `MarkupDemo` má vlastní
`<h1>` beze změny.

## D166 — R4b: hodnota je tlačítko hodu, jméno/štítek otevře rozklad v draweru, ozubené kolo ukáže rozklady všech řádků

Zdroj: task R4b (rework sheetu), 24. 9. 2026. Zpřesňuje D146/D163/D165 pro
levý sloupec a pás čísel; nic z nich neruší kromě inline „Roll" tlačítek a
inline `Breakdown` v těchto oblastech.

**Model.** (1) HODNOTA sama je tlačítko hodu: modifikátor vlastnosti = ability
check, hodnota záchrany = saving throw, hodnota dovednosti = skill check,
hodnota Initiative = initiative. Stejná logika a stejný přepínač advantage jako
dřív (`RollButton` s `children`, třída `roll-value`, accessible name
`Roll <label>` beze změny). Útoky/damage dál používají tlačítko „Roll".
(2) JMÉNO řádku (save, skill) nebo ŠTÍTEK karty (Prof., Speed, Initiative,
Armour Class) je tlačítko, které otevře rozklad v draweru — nový obsah
`save`/`skill`/`stat` v `DrawerContent`. (3) Ozubené kolo na kartách Saving
throws a Skills otevře drawer se VŠEMI řádky, každý jako `DrawerSection`
s otevřeným rozkladem (obsahy `saves`/`skills`). Inline `<details>` v těchto
oblastech už nejsou.

**Co se z karet přesunulo.** Karta Armour Class je 86px, takže její hlášky
(equipped-but-unknown, brnění bez AC, Stealth disadvantage, chyba formulí)
žijí celé v draweru (`ArmourClassNotes`); na kartě zůstává jednořádková
poznámka (`⚠ incomplete`, `Stealth disadv.`). Létání/plavání/lezení u Speed
jsou malá poznámka pod hodnotou a celé v draweru.

**Značky proficiency** zůstávají textové (○ ● ◐ ★, D45) — vzhled tečky řeší
CSS (`data-status`), takže poloviční proficiency a expertise si drží vlastní
symbol.

## D167 — R4b: Heroic Inspiration je ruční boolean na postavě, automatické udělování odloženo

Zdroj: task R4b, 24. 9. 2026. Pole neexistovalo. `Character.play.heroicInspiration`
(pravda = zapnuto; vypnuto se ukládá jako absence, stejně jako ostatní pole
`play`), schéma 44, migrace 43→44 jen tag, `CharacterStore.setHeroicInspiration`.
Karta v pásu čísel za Armour Class: checkbox s accessible name „Heroic
Inspiration"; bez handleru je jen ke čtení. Nic ho neuděluje ani nespotřebovává
— ani odpočinek, ani druh, ani hod. Automatika je odložená, dokud nebude
rozhodnuto, kdy se uděluje a co ho utratí.

## D168 — R4c: kompaktní HP karta s death saves uvnitř, drawer Hit Points, status row se třemi kartami

Zdroj: task R4c, 24. 9. 2026. Zpřesňuje D110/D111/D117/D147 co do umístění;
logika hit pointů, death saves ani hit dice se nemění.

**HP karta** (`src/sheet/HitPoints.tsx`, `HitPointsCard`) je poslední karta
pásu čísel, `flex-grow 1`, výška 86px ve VŠECH stavech. Vlevo sloupec HEAL /
Amount / DAMAGE (stejná logika jako dřívější panel: dočasné HP se utrácí
první, léčení končí na maximu), štítek HIT POINTS (tlačítko „Hit points
details" → drawer) nad „current / max", vpravo TEMP („—" při 0). Při
`currentHp === 0` (a zapisovatelném sheetu) nahradí blok HIT POINTS ve stejné
kartě blok DEATH SAVES: řádek značek úspěchů, řádek značek neúspěchů a hod d20
(bez modifikátoru a bez přepínače advantage, D117; toast + historie). Po
stabilizaci / smrti místo tlačítka slovo STABLE / DEAD. HEAL/DAMAGE zůstávají
vidět. `SheetHeader` death saves nemá; kartu jen umisťuje (slot `hitPoints`).
Poslední hozené číslo death save drží `CharacterSheet` (přežije nat 20).

**Drawer „Hit Points"**: rozklad maxima (otevřený, D164), Current HP, Max HP
override (existující pole, přesunuté beze změny), Temporary HP (přímé zadání)
a „Gain temporary HP" s vlastním polem „Temporary HP to gain" (Amount zůstal
na kartě jen pro heal/damage), Hit dice (zbývající, hod, rozklad), při 0 HP
ruční záznam death saves (Success / Failure / Natural 20 / Natural 1 — D111
„fyzická kostka") s vysvětlujícím textem, a poslední hozené číslo death save.

**Status row** pod pásem čísel: DEFENSES (jednořádkový souhrn toho, co platí
teď — „Resistant: X · Immune: Y · Vulnerable: Z", jinak „—"; štítek otevře
drawer „Defenses" s původní sekcí včetně podmíněných a zdrojů), CONDITIONS
(jen placeholder: štítek a zakázané „+ Add condition" s titulkem „Coming
later" — žádný stav ani schéma, dokud nepřijde slice podmínek),
CONCENTRATION (kouzlo nebo „—", Drop; logika 9d1 beze změny).

## D169 — Poškození při 0 HP přidá automaticky jeden neúspěch death save; critický zásah ručně

Zdroj: task R4c-fix, 24. 9. 2026. Provádí SPEC C; doplňuje D111 a D168.

Poškození, které při `currentHp === 0` projde přes dočasné HP (zbytek > 0),
přidá jeden neúspěch (`deathSavesAfterDamageAtZero`, `damageHitPoints` v
`HitPoints.tsx`; jediná cesta poškození je tlačítko Damage na HP kartě).
Poškození plně pohlcené dočasnými HP nepřidá nic; pád z kladných HP na 0
nepřidá nic; mrtvé postavě se nepřidá nic. Stabilní postava (tři úspěchy —
samostatný příznak „stable" neexistuje, stabilita je `successes >= 3`) poškozením
přestane být stabilní: úspěchy se vynulují a započte se jeden neúspěch. Třetí
neúspěch = stav „dead" jako u ručního tlačítka. Bez změny tvaru dat.

Critický zásah se nedetekuje (aplikace nerozhoduje); druhý neúspěch hráč přidá
tlačítkem Failure v draweru Hit Points, kde je to napsáno jednou větou.

## D170 — B2: karta Proficiencies, řádky ARMOR a WEAPONS

Zdroj: task B2, 24. 9. 2026 (rozhodnutí uživatele 1–6). Řeší část otázky
„Sheet nikdy nezobrazoval Proficiencies" (QUESTIONS.md); tools a languages
přijdou v B3/B4.

**Rozhodnutí.** (1) Z grantů podtříd/featur jen 2024 (XPHB): Cleric Protector,
Druid Warden, Bard College of Valor od L3. Ne-2024 podtřídy (Hexblade, Forge,
Twilight, Bladesinging, College of Swords, …) jsou samostatný pozdější task;
do té doby se jejich proficiency neukazují. (2) Stejná proficiency z více zdrojů
= jeden záznam se všemi zdroji; náhradní volba se nenabízí. (3) Zbraň Pact of
the Blade se neuvádí. (4) Weapon masteries na kartě nejsou (patří k útokům).
(5) Magické předměty udělující proficiency se ignorují. (6) Neudělané volby se
budou ukazovat jako „— not chosen" (relevantní od B4).

**Návrh.** `src/calculation/proficiencies.ts` (`computeProficiencies`, čistý):
`Record<'armor' | 'weapons', ProficiencyItem[]>`, položka = `key`, anglický
`label`, `sources` (`kind` + zobrazované jméno). Nová kategorie = nový klíč,
tvar se nemění. Startovní proficiency jen z PRVNÍ třídy (multiclass je
pozdější krok); třída přes `classPrereqInfoFor` (armor) a
`weaponProficiencyGrantsForClass` (weapons, D70), featy přes
`weaponProficiencyGrantsForFeats` + `armorProficiencies`; Tavern Brawler
„Improvised weapons" se ukazuje, i když ho `weaponProficiency.ts` pro útoky
zahazuje. XPHB granty podtříd/featur jsou malá ruční tabulka (jen text, DATA.md).
Monk/Rogue podmnožina martial zmizí, má-li postava celé Martial weapons.
Rozhodování o zdatnosti pro útoky (`weaponProficiency.ts`) se nemění.
Karta v sub-sloupci A pod Senses, `flex-grow`; ozubené kolo → drawer
„Proficiencies" (vzor D166 pro kolo; nadpis karty klikací není, stejně jako u
Saving throws/Skills).

## D171 — B3: řádek LANGUAGES na kartě Proficiencies

Zdroj: task B3, 24. 9. 2026. Pořadí řádků karty: ARMOR / WEAPONS / (TOOLS,
později) / LANGUAGES. Languages patří do stejného `computeProficiencies`
(klíč `languages`) a do stejného draweru jako armor a weapons.

**Zdroje.** (1) `character.languages`: Common (`automatic`) se ukazuje jako
„Every character", výběr při tvorbě (`creation`) jako „Chosen at creation".
(2) XPHB class featury v ruční tabulce vedle grantů podtříd, pro libovolnou
třídu v `character.classes` na potřebné úrovni: Druid L1 Druidic (zdroj
„Druid"); Rogue L1 Thieves' Cant (zdroj „Rogue") + 1 volný jazyk; Ranger L2
Deft Explorer, 2 volné jazyky. (3) Featy z `languageProficiencies` v feats.json:
Fey Teleportation (XGE) Sylvan pevně; Prodigy (XGE) `{any: 1}` = 1 volný. Zvolený
jazyk Prodigy se čte z `FeatChoiceDetails.proficiencies.languages` instance
(D158). Všech pět zdrojů ověřeno proti datům.

**Nezvolené volby.** Rogue +1, Ranger +2 a Prodigy +1 nemají picker; každá se
ukazuje jako položka „N language(s) — not chosen" (`pending: true`) se zdrojem
„Rogue — Thieves' Cant", „Ranger — Deft Explorer", „Prodigy (feat)". Picker
později jen uloží volbu; u Prodigy počet čekajících = `any` minus uložené
jazyky, takže položka zmizí sama. Rogue/Ranger uložení zatím nemají — bez
schématu se nic nemění.

**Řazení a slučování.** Stejný jazyk z více zdrojů = jedna položka se všemi
zdroji (Sylvan při tvorbě + Fey Teleportation). Pořadí: Common, ostatní známé
abecedně, nezvolené položky nakonec.

## D172 — B3b: volba extra jazyků Rogue (Thieves' Cant) a Ranger (Deft Explorer)

Zdroj: task B3b, 24. 9. 2026 (místa volby rozhodl uživatel). Navazuje na D171.

**Úložiště.** Existující `character.languages`, nové hodnoty `grantedBy`:
`thievesCant` (Rogue L1, 1 jazyk) a `deftExplorer` (Ranger L2, 2 jazyky). Žádné
nové pole. Schéma 45, migrace 44→45 jen tag (vzor 43/44); staré postavy se
načtou beze změny a volba se u nich ukáže jako nezvolená. Pevné jazyky featur
(Thieves' Cant, Druidic) se dál neukládají, jen odvozují.

**Kde se volí.** (a) Wizard, krok languages: pod dvěma jazyky z tvorby jeden
select na každý volný jazyk featury, která na zvolené třídě a úrovni platí
(Rogue +1; Ranger vytvořený rovnou na L2+ dostane +2 stejně). Změna třídy
volbu smaže; při uložení se zahodí volby featury, která už neplatí. Edit
Character volbu ukáže a nevyplněná blokuje krok. (b) Level-up: krok languages
se prochází, když level přidá volné jazyky (Ranger 2); ukazuje jen selecty
featury, jazyky z tvorby ne. Odebrání toho levelu jazyky featury smaže
(odvozeno z úrovně featury, bez uložené úrovně). (c) Drawer Proficiencies:
pod seznamem jazyků selecty všech platných featur — volba, změna i smazání,
uloží se hned.

**Nabídka.** Text obou featur: „from the language tables in chapter 2" =
Standard i Rare (DATA.md). Nikdy Common, nikdy jazyk známý z jiného zdroje
(ve wizardu: Common, jazyky z tvorby, pevné jazyky featur a ostatní sloty;
v draweru: všechny známé jazyky z `computeProficiencies`). Jazyk zvolený
featurou se nenabízí mezi jazyky z tvorby.

**Znění nezvolené položky.** „Extra language (Thieves' Cant) — not chosen";
„2 extra languages (Deft Explorer) — not chosen", po jedné volbě „1 extra
language (Deft Explorer) — not chosen". Prodigy (feat) beze změny.

## D173 — B4: řádek TOOLS na kartě Proficiencies

Zdroj: task B4, 24. 9. 2026. Navazuje na D170–D172. Pořadí řádků: ARMOR /
WEAPONS / TOOLS / LANGUAGES; stejný drawer (sekce Tools) a `computeProficiencies`
(klíč `tools`).

**Zdroje.** (1) `character.background.toolProficiency`, zdroj „<Background>
(background)". (2) Strukturované `startingProficiencies.toolProficiencies` první
třídy (ne prózní `tools`): Druid Herbalism Kit, Rogue Thieves' Tools, Artificer
(EFA) Thieves' + Tinker's Tools a 1 artisan's tool, Bard 3 nástroje, Monk
alternativa. Prvky pole jsou ALTERNATIVY, jedna položka „1 artisan's tool or
musical instrument". (3) Ruční tabulka XPHB podtříd od L3: Warrior of Mercy
Herbalism Kit, Battle Master 1 artisan's tool. (4) Featy: Chef, Poisoner pevně;
Crafter, Musician, Artificer Initiate, Prodigy z uložených
`FeatChoiceDetails.proficiencies.tools`, zbytek je nezvolená položka. Skilled:
uložené nástroje se ukážou, nezvolená položka nikdy (volby mohou být dovednosti).
Druhové nástroje (Githyanki, Warforged, Satyr, ne-2024) mimo rozsah.

**Znění a řazení.** „3 musical instruments (Bard) — not chosen", „1 artisan's
tool (Battle Master) — not chosen", „2 musical instruments (Musician) — not
chosen". Popisek = jméno nástroje; stejný nástroj z více zdrojů = jedna položka
(Thieves' Tools — Rogue, Criminal (background)). Abecedně, nezvolené nakonec,
prázdné = „None". Bez změny úložiště; picker jen uloží volbu.

**Tajné jazyky.** Sloty extra jazyků (Rogue +1, Ranger +2) nenabízejí Druidic a
Thieves' Cant. Už uložená volba jednoho z nich zůstává a zobrazuje se.

## D174 — B5: volba nástrojů třídy a podtřídy

Zdroj: task B5, 24. 9. 2026. Navazuje na D172 (stejný vzor) a D173.

**Úložiště.** Nové nepovinné pole `Character.toolChoices: { grantedBy, name }[]`,
`grantedBy` = `bard` | `monk` | `artificer` | `battleMaster`, `name` = jméno
položky z items.json. Nové pole, ne `languages`: to je typované jazyky se
zdrojem a `background.toolProficiency` je jeden řetězec. Schéma 46 (společné s
D175), migrace 45→46 jen tag; staré postavy se načtou beze změny a volba se u
nich ukáže jako nezvolená.

**Granty.** Ruční tabulka `src/toolProficiencies/classToolChoices.ts`: Bard XPHB
L1 3 nástroje (instrumenty), Monk XPHB L1 1 z sjednocení artisan + instrument,
Artificer EFA L1 1 artisan, Fighter XPHB / Battle Master L3 1 artisan. Feat
volby (Crafter, Musician, Prodigy, Artificer Initiate) zůstávají nezvolené.

**Nabídka.** Stejné seznamy jako picker nástroje pozadí
(`loadToolCategoryOptions`: artisan `AT`, instrument `INS` jen `rarity: none`).
Nikdy nástroj, který postava už má z jakéhokoli zdroje ani který drží jiný slot;
vlastní volba slotu zůstává. Ve wizardu se „už má" počítá z nástroje pozadí,
jmen z uložených slotů a pevných nástrojů grantu (Artificer: Thieves' a
Tinker's Tools); nástroje z featů se tam nevidí. V draweru z `computeProficiencies`.

**Kde se volí.** (a) Wizard, krok languages, pod sloty jazyků (krok už level-up
prochází a je to místo, kde se volí třídní featury). Změna třídy volby smaže;
uložení zahodí volbu grantu, který už neplatí; Edit Character volby ukáže a
nevyplněná blokuje krok. (b) Level-up: Battle Master L3 — podtřída se volí
právě na tom levelu, takže krok languages je u Fighter 3 bez zvolené podtřídy
„unknown" (projde se a zůstane prázdný, když podtřída žádný nástroj nedává);
krok žádá jen granty, které level přináší. Odebrání L3 volbu smaže (odvozeno z
úrovně grantu). (c) Drawer Proficiencies, sekce Tools: sloty všech platných
grantů, volba / změna / smazání se uloží hned (`CharacterStore.setToolChoices`).

**Znění.** Uložená volba se ukáže jako nástroj (zdroj „Bard", „Battle Master");
částečná volba nechá zbytek nezvolený: „2 musical instruments (Bard) — not
chosen", „1 musical instrument (Bard) — not chosen".

## D175 — B5: volba velikosti druhu (Small / Medium)

Zdroj: task B5, 24. 9. 2026. Uzavírá otázku „Volba velikosti chybí ve wizardu"
a mění D54 jen tím, že velikost už lze zvolit; bez volby zůstává „neznámo".

**Úložiště.** Nové nepovinné pole `Character.speciesSize` (písmeno velikosti z
`species.json`, např. `S`); schéma 46 společné s D174. Nic jiného velikost
nečetlo, kromě předpokladu feta „small race" ve wizardu (`FeatAsiPicker`), který
teď bere uloženou volbu, když ji data sama nerozhodnou.

**Wizard.** Krok species: Small / Medium (radio, stejný styl jako skilly druhu)
u druhu, jehož data nabízejí víc než jednu velikost (po rozhodnutí varianty, jako
skilly). Bez volby krok nedokončí; nezobrazí se u druhu s jednou velikostí. Změna
druhu volbu smaže; Edit Character ji ukáže.

**Sheet.** `computeSize` bere uloženou volbu, je-li jednou z nabízených velikostí
(zastaralá volba, kterou druh nenabízí, se ignoruje); jinak zůstává „unresolved"
z D54. Hlavička ukáže „Small" / „Medium".

## D176 — B6b: proficiency z ne-XPHB podtříd (pevné granty a volby)

Zdroj: task B6b, 24. 9. 2026. Navazuje na D170 bod (1), D172–D174. Podklad:
průzkum B6a (DATA.md, „Subclass proficiency grants (non-XPHB)").

**Pevné granty.** Ruční tabulka v `proficiencies.ts` (`FEATURE_GRANTS`, dřív
`XPHB_FEATURE_GRANTS`, nově i jazyky), vše od úrovně třídy 3 (data nesou 1/2 z
2014). Záznam je klíčovaný jménem podtřídy A zdrojem: uložené jméno se přes
classes.json převede na zdroj nabízené položky, takže stejnojmenná podtřída
jiného zdroje nic nedostane. Artificer (EFA): Alchemist, Armorer, Artillerist
(„Martial ranged weapons"), Battle Smith, Cartographer; College of Swords
(Medium armor, Scimitar); Forge, Order, Twilight; Shepherd (Sylvan); Rune Knight
(Smith's Tools, Giant); Drunken Master; Mastermind (Disguise + Forgery Kit);
Storm (Primordial); Hexblade (Medium armor, Shields, Martial weapons).

**Volby.** Stejný vzor slotů jako D172/D174 (wizard krok „Languages & Tools",
level-up na úrovni grantu, drawer). Mastermind: 1 herní sada (`toolChoices`,
`mastermind`) + 2 jazyky (`languages`, `grantedBy: mastermind`). Kensei: 1 z
Calligrapher's / Painter's Supplies (`kensei`). Tabulky voleb
(`classToolChoices.ts`, `classFeatureLanguages.ts`) jsou klíčované jménem —
žádné dvě nabízené podtřídy jedné třídy jméno nesdílejí (ověřeno B6b).

**Náhrada u Artificera.** Za každý pevný nástroj podtřídy, který postava už má
z jiného zdroje, jeden slot „artisan's tool" (`artificerSubclass`), max. 2.
Počet se neukládá, počítá se: na kartě a v draweru z nástrojů
`computeProficiencies` s jiným zdrojem než podtřída (včetně featů), ve wizardu
z nástroje pozadí a ostatních slotů (featy wizard nevidí, jako v D174). Zmizí-li
duplicita, uložená volba se NEMAŽE: zůstane uložená, na kartě jako „<nástroj> —
no longer owed, not counted" (proficiency nedává), ve slotech jako navíc slot
„(no longer owed — not counted)", kde ji hráč může smazat; krok wizardu ji
nevyžaduje ani neblokuje.

**Odloženo.** Kensei zbraně: bez pickeru, jen řádek „Kensei weapons — not
chosen" ve WEAPONS. Dovednosti, Cavalier/Samurai (dovednost nebo jazyk), Scout
expertise a nástroje druhů → B6c. Proficiency pro útoky z grantů podtříd
(`weaponProficiency.ts`) → B6d.

**Úložiště.** Schéma 47, migrace 46→47 jen tag (nové hodnoty `grantedBy`).
Stará postava bez nové povinné volby má krok zablokovaný v Edit Character, dokud
ji nezvolí (jako D172/D174).

**Level-up banner.** Krok languages u úrovně volby podtřídy je „unknown", dokud
podtřída není zvolená; banner jmenuje podtřídy s volbou (u Artificera
s poznámkou, že jen pro už držený nástroj). Jakmile ji class step zvolí, banner
zmizí a sloty jsou přesné (Champion žádný, Battle Master jeden).

## D177 — B6c: dovednosti z podtříd, volby nástrojů druhů, skrytý prázdný krok level-upu

Zdroj: task B6c, 24. 9. 2026. Navazuje na D44, D172, D174, D176. Podklad:
DATA.md, „Subclass proficiency grants (non-XPHB)".

**Úložiště.** Nové volitelné pole `Character.subclassSkills?: { grantedBy:
SubclassSkillSource; name: string }[]` (tvar jako `toolChoices`; `name` je klíč
dovednosti ze `skills.ts`). `grantedBy`: `battleMaster`, `orderDomain`,
`peaceDomain`, `arcaneArcher`, `cavalier`, `samurai`. Nové `grantedBy` jazyka
`cavalier`, `samurai`; nástroje `warforged`, `satyr`, `khoravar`. Schéma 48,
migrace 47→48 jen tag.

**Pevné granty se odvozují, volby ukládají.** Ruční tabulka
`classSkills/subclassSkillGrants.ts`, vše od úrovně třídy 3, klíč třída XPHB +
jméno podtřídy (jména jsou v datech jedinečná). Pevné: Drunken Master
(Performance), Scout (Nature, Survival **s expertise**), Warrior of Mercy
(Insight, Medicine). Scoutova expertise se neukládá; expertise picker ji
nenabízí, jako by byla už zvolená. Volby: Battle Master (Student of War, 1
z dovedností Fightera L1 — dřív nikde uložená ani nabízená nebyla), Order
(Intimidation/Persuasion), Peace (Insight/Performance/Persuasion), Arcane Archer
(Arcana/Nature). Dovednost, kterou postava už má odjinud, se nenabízí. Zdroj ve
skills: „subclass (<jméno>)", D44 platí (proficiency jednou, všechny zdroje
jmenované). Nezvolená volba dává na kandidátních dovednostech poznámku „waiting
on a player pick" stejným mechanismem jako featy.

**Výlučnost.** Cavalier/Samurai: jeden select se dvěma skupinami — dovednost
(`subclassSkills`) NEBO jazyk (`languages`, `grantedBy` podtřídy); volba jednoho
smaže druhé. Khoravar stejně: dovednost NEBO nástroj, dovednost jde do
`speciesSkills` (zdroj „species"), nástroj do `toolChoices` (`khoravar`).

**Druhy.** Warforged (`{any:1}` = artisan's tools + gaming sets + hudební
nástroje + typ `T`) a Satyr (`{anyMusicalInstrument:1}`): trvalá volba ve
`toolChoices`, slot v kroku „Languages & Tools"; level-up je nežádá. Dočasné
granty se nezobrazují: nástroj Githyanki, dovednost Kalashtar, volby Trance
(Eladrin, Sea Elf, Shadar-Kai). Dovednost Githyanki (`any:1`) beze změny.

**Level-up.** Volba dovednosti podtřídy patří k úrovni podtřídy (3): level-up ji
žádá, odebrání úrovně 3 ji smaže (včetně jazyka Cavaliera/Samuraie). Krok
„Languages & Tools" se při level-upu na úrovni volby podtřídy neprochází, pokud
podtřída zvolená v class stepu nic nedluží (Fighter 3 Champion); dluží-li
(Battle Master, Order Domain), krok se objeví. Stará postava bez nové volby má
krok zablokovaný v Edit Character (D172/D174).

## D178 — B6d: jeden zdroj zbraňové proficiency pro kartu i útoky

Zdroj: task B6d, 25. 9. 2026. Navazuje na D70, D170, D176.

Proficiency se zbraněmi ze subclass/class-option grantů (Hexblade, Twilight,
Battle Smith, Artillerist, College of Swords, Protector, Warden, Valor) má jeden
zdroj: `FEATURE_GRANTS` v `calculation/featureGrants.ts`, kde `weapons` jsou
`WeaponProficiencyGrant[]`. Čte ho Proficiencies karta (`computeProficiencies`)
i `weaponProficiencyGrantsFor` (útoky), takže se nemohou rozejít. Nový tvar
grantu: `ranged` u kategorie (typ `R`; „Martial ranged weapons") a `named`
(jediná zbraň podle jména — Scimitar). Kensei zůstává pending řádek a útokům
nic nedává. Beze změny: Tavern Brawler, tabulka D70, rozdíl `classes[0]` vs.
všechny třídy.

## D179 — A3: podvolby featu lze nechat na později; sdílený picker

Zdroj: task A3, rozhodnutí uživatele 24. 9. 2026. Navazuje na D156–D161.

Volby dovedností, nástrojů, jazyků a expertise z featů a kouzla + vlastnost
Magic Initiate z backgroundu nikdy neblokují Next ve wizardu, v level-upu
ani v Edit Character. Záměrně jinak než pravidlo B3b/B5/B6, které pro volby
třídy, podtřídy a druhu platí dál. Hráč se o otevřené volbě dozví: pod
featem ve wizardu a level-upu řádek „You can make this choice later in Edit
Character.", na sheetu „Choices not made yet: … — make them in Edit
Character.". Magic Initiate vybraný na ASI úrovni zůstává povinný jako
dosud (d5b-2).

Picker je jedna komponenta `FeatSubChoicePicker` (D8, bez přístupu ke
store), kterou sdílí ASI krok a krok backgroundu; znovu ji použije Manage
Feats (R13). Změna featu nebo backgroundu podvolby dané instance maže.

## D180 — E2E-1: chování ověřují Playwright scénáře, uživatel jen vzhled

Zdroj: task E2E-1, rozhodnutí uživatele 25. 9. 2026.

Behaviorální kontroly (co se objeví, co se povolí, co se uloží, co ukáže
sheet) už neprokliká uživatel. Agent je píše jako Playwright scénáře v `e2e/`
a spouští je sám přes `npm run e2e` — headless Chromium, produkční build
servírovaný `vite preview` na portu 4173 (`--strictPort`, bez kolize s dev
serverem na 5173), každý test s prázdným localStorage. Běží bez okna a bez
ručně spuštěného serveru, takže funguje i přes Remote Control. Neprošlý e2e
blokuje commit stejně jako unit testy. Uživatel na nasazené appce kontroluje
jen to, co se musí posoudit okem: layout, velikosti, zalamování, vzhled.
Jiný prohlížeč než ten, který spustí Playwright, agent dál nepoužívá.

## D181 — R5: záložka Actions ve třech řezech; mastery jen u ovládnutých zbraní

Zdroj: task R5a (rework sheetu), 25. 9. 2026.

**Rozdělení.** R5a: tabulka útoků v novém vzhledu, filtry All / Attack,
oprava mastery. R5b: průzkum — zařazení featur do Action / Bonus Action /
Reaction podle tagů `{@variantrule Bonus Action}`, `{@variantrule Reaction}`
a `{@action …}` v jejich textu. R5c: skupiny Action / Bonus Action / Reaction
/ Other, sbalitelné řádky, use-boxy a zbývající filtry. Actions in Combat
(potřebuje 5etools `actions.json`, zatím neextrahovaný) je samostatný pozdější
slice. Do R5c jsou použitelné featury prostý seznam „Other" pod tabulkou;
filtr Attack ho skryje.

**Kouzla.** Kouzla s útokem nebo záchranou zůstávají v tabulce útoků. Ostatní
kouzla s časem seslání Bonus Action / Reaction přijdou v R5c do těchto skupin;
kouzla s časem Action bez útoku a záchrany se v Actions neuvádějí.

**Rozklad hodnot.** Stejně jako levý sloupec (D166): hodnota zásahu a damage
je tlačítko hodu, jméno řádku otevře rozklad v draweru; „Attacks per Action"
otevře rozklad počtu útoků. Inline `<details>` v tabulce nejsou.

**Mastery.** Poznámka „Mastery: X" jen u zbraně, jejíž druh má postava
v `Character.masteries` (holá jména zbraní, D97); porovnává se jméno zbraně
z items.json. Neovládnutá zbraň řádek Mastery nemá vůbec.

## D182 — R5c: skupiny Actions podle „R-phrase"; use-boxy

Zdroj: task R5c (rework sheetu), průzkum R5b, 25. 9. 2026.

**Zařazení (R-phrase).** `classifyActionType` prochází text featury ve stejném
tvaru stromu jako `hasRestTag` (entries/entry, items, rows, row.row), v pořadí
dokumentu; vyhrává první rámec. Bonus Action / Reaction: `(as|use|take|takes|
taking|using|spend) (a|an|your|one) {@variantrule Bonus Action|Reaction}`.
Action: `(as|take|takes|taking|use) (the|a|an|one) {@action X} action(s)`
a `take (both) the {@action X} and (the) {@action Y} actions` — ne když
hned následuje „as/using a Bonus Action|Reaction" (Step of the Wind → Bonus).
„(no action required)" → Other. Shoda, před níž stojí `(when|whenever|if|after|
once|until|before) (you|it|they|the target|a creature) (can)`, je spouštěč,
ne aktivace, a přeskakuje se. „its" není determinant (Commander's Strike —
Reaction spojence). Bez shody → Other. Uzavřené seznamy slov kolem tagu jsou
přijaté pod D21 ve stejném duchu jako D86; žádná tabulka jmen.

**Přijaté limity.** 26 záznamů TCE/XGE bez aktivačního tagu (próza z 2014)
→ Other. Rodič Channel Divinity → Other; jeho efekty (Divine Spark, Turn
Undead) jsou vlastní řádky Action.

**Rozsah.** K dnešní množině D86 (udělené class/subclass featury, featy,
zvolené optional features, bez duplicit podle jména) přibývá z týchž tří
zdrojů každá featura, kterou D86 odmítá, ale R-phrase dá Action / Bonus Action
/ Reaction (Cunning Action, Uncanny Dodge). Druhové rysy a Actions in Combat
jsou pozdější slice.

**Kouzla.** Kouzla s útokem nebo záchranou jen v tabulce. Ostatní kouzla
postavy podle strukturovaného `time[0].unit`: `bonus` → Bonus Action,
`reaction` → Reaction; ostatní časy seslání se v Actions neuvádějí. Jeden
řádek na položku seznamu záložky Spells.

**Use-boxy.** Tentýž záznam `play.resourceUses`. Známé maximum ≤ 10: tolik
políček, vyplněná zleva = spotřebované použití; klik na prázdné označí použití,
na vyplněné ho vrátí. Maximum > 10: kompaktní „spent / max" s −/+. Za tím
„/ Short Rest", když 9b5 čte obnovu na Short Rest, jinak „/ Long Rest".
Neznámé maximum (D43): nic.

## D183 — Short Rest otevře boční panel s kostkami života

Zdroj: task Short Rest drawer, 25. 9. 2026.

Tlačítko Short Rest v hlavičce už neodpočívá hned: otevře sdílený boční panel „Short Rest" se sekcí Hit Dice (stejné řádky a hod jako dřív, včetně záznamu hodu v historii). Odpočinek (obnova zásob, `afterShortRest`) se provede až tlačítkem **Finish Short Rest**, které pak panel zavře. Zavření křížkem nebo Esc bez Finish ponechá už provedené hody (utracené kostky i získané HP), ale zásoby neobnoví. Kostky života už nejsou v panelu Hit Points. Long Rest beze změny. Schéma postavy beze změny.

## D184 — R6: záložka Features & Traits; ikony u rest tlačítek

Zdroj: task R6 (rework sheetu), 25. 9. 2026.

**Filtry.** Nahoře pilulky All · Class Features · Species Traits · Feats (stejná
komponenta jako Actions). Filtr jen skrývá skupiny; stav filtru je UI stav (D116).

**Skupiny.** „<Třída> Features" — jedna skupina za každou třídu v seznamu tříd
postavy (iteruje se, nikdy `classes[0]`; připraveno na multiclass). Subclass
featury patří do skupiny své třídy; řazení podle úrovně, pak jména. Dál
„Species Traits" (pojmenované prvky `entries` druhu) a „Feats" se zdrojem
„From Background" / „From Species" / „From <Třída> <úroveň>". U featu z ASI se
třída zná jen u jedné třídy; u multiclassu se zdroj neukazuje.

**Řádky.** Každá featura / rys / feat je sbalený řádek stejný jako ve skupinách
Actions (▸/▾, jméno, šedý zdroj + úroveň, vpravo use-boxy). Klik na jméno
rozbalí plný text.

**Volby pod featurou.** Zvolená volba (Metamagic, Eldritch Invocations,
manévry, fighting style) je v kompaktním seznamu pod featurou, která ji dává —
viditelná i sbalená, každá volba rozbalitelná na svůj text. Vazba: text featury
nese 5etools filtr `{@filter …|optionalfeatures|feature type=<kód>}`, u fighting
style `{@filter …|feats|category=FS}`; bere se featura s nejnižší úrovní. Volba,
kterou žádná featura nepropojí (dnes RN, AS, FS:B — rodič je choice container,
D87 pravidlo 3), je vlastní řádek na konci skupiny třídy. D21 volby (Divine
Order…) dostanou řádek rodiče sestavený z volby. Sub-volby featu (dovednosti,
nástroje, jazyky, expertise, schopnost, kouzla) jsou řádky seznamu pod featem,
bez rozbalení (vlastní text nemají). Oddíly „Class options" / „Subclass
options" / „Class feature choices" (D88) zanikají.

**Use-boxy.** Tatáž komponenta a tentýž záznam `play.resourceUses` jako Actions
(D182) — klik v jedné záložce je vidět v druhé, Short/Long Rest nuluje obojí.
Neznámé maximum (D43): nic.

**Wild Shape formy a familiar** zůstávají na záložce, za skupinami tříd;
viditelné pod All a Class Features.

**Ikony.** SHORT REST (plamen z D183) a LONG REST (měsíc) v hlavičce mají ikonu
14 px vlevo, mezera 8 px, barva `currentColor`.

## D185 — Rysy druhu v záložce Actions

Rysy druhu (pojmenované prvky nejvyšší úrovně `entries` záznamu druhu) prochází
stejnými testy jako class featury: D86 (`consumes` nebo tag odpočinku) nebo
R-phrase mimo „Other" (D182). Stejný řádek, stejné skupiny a filtry; šedý zdroj
je název druhu. Na pořadí za featurami, featy a volbami nezáleží (deduplikace
podle jména).

**Políčka použití** jen tam, kde appka zná maximum. Rysy druhu se do
`computeCharacterResources` nepředávají, takže žádná zatím políčka nemá; nový
parser počtů ani nové pooly tento řez nepřidal.

**Úroveň.** Data druhu žádnou úroveň nenesou a Features & Traits žádné
podmiňování nemá, takže se nic nepodmiňuje: Celestial Revelation je vidět i na
úrovni 1.

## D186 — Rysy druhu v Actions: Breath Weapon, úroveň, šum, políčka

Navazuje na D185 a v bodech úrovně a políček ho mění.

**Nahrazení útoku → Action.** Věta „When you take the Attack action … you can
replace one of your attacks with …“ je nový R-phrase rámec (D182) se skupinou
Action; trigger „When you take“ ho nepřeskakuje. Pravidlo textem, ne seznamem
jmen (D21). V datech mění skupinu jen Breath Weapon (11 záznamů Dragonborn),
War Magic (XPHB) a Commander's Strike (XPHB) — obojí je podle pravidel součást
akce Attack, ponecháno.

**Podmínění úrovní.** Rys druhu, jehož první věta začíná „When you reach
character level N“, „Starting at character level N“, „Starting at/When you
reach Nth level“ nebo „Once you reach …“, se ukáže (Actions i Features &
Traits) až od celkové úrovně postavy N. Úroveň zmíněná až dál v textu rys
nepodmiňuje — zvyšuje jen jeho část (Fey Step, kouzla Elven Lineage).

**Šum.** Rys druhu jde do Actions jen se skupinou R-phrase Action / Bonus
Action / Reaction, nebo se sledovaným počtem použití. Samotný tag odpočinku
(Trance, Fiendish Legacy, Elven Lineage) nestačí; takový rys zůstane jen ve
Features & Traits. Class featury, featy a volby beze změny (D86).

**Políčka.** Rysy druhu jdou do `computeCharacterResources` jako samostatný
vstup, čtený jen dvěma vzory: „Once you …, you can't do so / use it / use this
trait again until you finish a Long Rest“ (i Short or Long) → max 1; „a number
of times equal to your Proficiency Bonus … regain(ing) all expended uses when
you finish a … Rest“ → max PB. Short Rest je vrací, jen když to věta říká;
Long Rest vrací vše. Rys se oběma vzory (Merge with Stone) má dva nezávislé
limity a nemá žádná políčka (jako D119). Cokoli jiného: bez políček (D43).
Klíč v `play.resourceUses` je jméno rysu — stejný tvar, schéma beze změny.

## D187 — Actions in Combat v záložce Actions

**Data.** Extrahuje se `actions.json`, jen zdroj XPHB (vlastní konstanta
`ACTIONS_SOURCE`, jako `BEAST_SOURCE` v D67), ne `ALLOWED_SOURCES` — ty by
pustily XGE Identify a Spell a Waking Someone. Výsledek: `data/actions.json`,
18 záznamů.

**Skupina** z `time[].unit`: action → Action, bonus → Bonus Action,
reaction → Reaction. `time` jako řetězec („Free", „Varies": End Concentration,
Improvising an Action) → Other.

**Rozsah.** Všech 18 záznamů kromě Two-Weapon Fighting, které je podmíněné
(níže). Grapple/Shove se nepřidávají — ve 2024 jsou volbami Unarmed Strike,
ne akcemi. Tagy `{@action X}` v textu featur a kouzel zůstávají stylovaný
text bez rozbalení.

**Forma.** Na konci každé skupiny (Action, Bonus Action, Reaction, Other) jeden
řádek „Actions in Combat: Attack · Dash · …", jména abecedně. Klik na jméno
rozbalí jeho text pod řádkem, druhý klik ho zavře, klik na jiné jméno přepne
(nejvýš jedno otevřené na skupinu). Bez políček použití a bez zdroje. Řádek patří
ke své skupině a filtry ho skrývají s ní; skupina jen s akcemi v boji (Reaction
s Opportunity Attack) se vykreslí i bez řádků featur. Read-only list ho ukazuje
také.

**Two-Weapon Fighting** je v řádku Bonus Action, jen když postava drží dvě
položky inventáře se zbraní s vlastností Light (držené = stejná množina jako
tabulka útoků, `equipped: 'held'`; batoh se nepočítá). Počítají se držené
**řádky**, ne množství: držený řádek je jedna věc v jedné ruce (kontrola rukou
počítá ruce po řádcích, tabulka útoků má řádek na držený záznam), takže řádek
Dagger ×2 je pořád jedna dýka v ruce. Dual Wielder a jiné výjimky mimo rozsah.

**Markup.** Tag `{@note …}` se vykresluje kurzívou, vnořené tagy se řeší.

## D188 — Dvě zbraně ze stohu

**Problém.** Equip na řádku Dagger ×2 dal `equipped: 'held'` celému řádku
(množství 2 zůstalo), takže stoh byl jedna věc v jedné ruce a druhou dýku
nešlo vzít — D187 počítá držené řádky, Two-Weapon Fighting se neobjevil.

**Vzetí do ruky ze stohu** (množství > 1) oddělí jeden kus do vlastního
drženého řádku hned pod stohem; stoh má o jeden méně a jeho Equip zůstává.
Řádek s množstvím 1 (nebo 0) se vezme celý jako dosud. Držené řádky se nikdy
neslučují — každý je jedna věc v jedné ruce.

**Odložení** (Put down i vytlačení jinou věcí) vrátí řádek do stohu: sloučí
se s řádkem, který má po odložení stejný `inventoryRowKey`, a množství se
sečtou. Slučují se jen právě odložené řádky; jiné shodné řádky, které hráč
drží odděleně (dvě stejné custom položky), zůstávají.

**Pravidlo rukou beze změny** (hands.ts): druhá dýka jde přes
`makeRoomForHands` jako každá jiná zbraň — co se nevejde, se odloží
(nejvýš v seznamu první) a oznámí; štít ani obouruční zbraň se neodmítá.
Pravidlo D187 (dva držené řádky s Light) beze změny. Bez změny schématu;
staré uložené postavy s drženým řádkem ×2 fungují dál (jedna zbraň v ruce).

## D189 — R7a: záložka Spells

Zdroj: task R7a (rework sheetu), 25. 9. 2026.

**Rozložení.** Nahoře sady čísel MODIFIER · SPELL ATTACK · SAVE DC, jedna na
každý zdroj kouzlení, který sheet počítá (třída, feat, druh); při více zdrojích
štítek „Cleric (WIS)" nad sadou. SPELL ATTACK a SAVE DC jsou tlačítka do
sdíleného Draweru s rozpadem; vpravo „Spell Slots" (jen když má postava sloty)
otevře rozpad běžných slotů a Pact Magic pod vlastním nadpisem (D11). Pod tím
vyhledávání podle jména a pilulky All · Cantrips · 1st … (jen existující sekce) ·
Concentration · Ritual — lokální stav, nic se neukládá (D116). Pak sekce po
úrovních („CANTRIPS", „1ST LEVEL" …, poslední „UNRESOLVED") s boxy slotů v
nadpisu (stejné `UseBoxes` a stejný záznam `play.spentSpellSlots` jako dřív) a
řádky: CAST / AT WILL / štítek použití · jméno (▸/▾ rozbalí text, plný
původ a Concentrate) · Time · Range · Hit / DC · Effect · Notes.

**Pact Magic.** Postava s pact sloty a bez běžných slotů (single-class Warlock):
každé kouzlo sesílané slotem (vybrané, subclass, invokace bez podmínky použití)
do úrovně paktu stojí v sekci úrovně paktu s odznakem své úrovně („1st"), boxy
pactu s tagem PACT a „/ Short Rest" — 2024 Pact Magic sesílá vždy na úrovni
slotu. Kouzla nad úrovní paktu a kouzla jen z featu/druhu zůstávají ve své
úrovni. Postava s oběma pooly: kouzla ve své úrovni, boxy pactu s tagem PACT v
nadpisu sekce úrovně paktu vedle běžných boxů. Výběr poolu je otázka kroku 10
(QUESTIONS.md).

**CAST** utratí jeden slot poolu sekce, pod kterou kouzlo stojí (běžný slot té
úrovně; pact slot v sekci paktu; při obou poolech běžný). Když pool nemá nic
volného nebo sekce sloty nemá, je CAST disabled. CAST nic nehází. Kouzlo s
koncentrací navíc přes `onEditConcentration` spustí koncentraci (nahradí
dosavadní). Na read-only sheetu CAST není.

**Effect.** Cantrip: kostky z `scalingLevelDice` na úrovni postavy (tlačítko
hodu jako v Actions). Jinak typy poškození z `damageInflict`, jinak podmínky z
`conditionInflict`, jinak prázdné. Kostky levelovaných kouzel jsou jen v próze
(D21) — až R8.

**Volné použití.** Levelované kouzlo jen z featu/druhu/volby s podmínkou
použití (1/long rest bez slotu apod.) má místo tlačítka jen krátký šedý štítek
(„1/LR", „1/SR", „PB/LR", „At will", „Ritual"). Tlačítko USE s počítadlem až
R7b; úložiště se pro to teď nezakládá. Schéma beze změny (48).

## D190 — R7b-1: volná seslání, data a počítadla

Zdroj: task R7b-1, rozhodnutí Daniela 25. 9. 2026 (průzkum R7b-0). Schéma beze
změny (48).

**Slotem?** Ruční tabulka ve stylu D21/D70 (`alsoCastableWithSlot.ts`), klíč =
jméno zdroje, hodnota ano/ne, u každé položky citovaná věta. ANO: 12 Marks,
Magic Initiate, Artificer Initiate, Fey-/Shadow-Touched, XPHB Tiefling ×3 a Elf
lineages, Duergar, Triton, Yuan-Ti a implicitně Forest Gnome, Archfey Patron,
The Fathomless, Psi Warrior. Ostatní NE. Zdroj mimo tabulku = NE; unit test
porovná tabulku se všemi dosažitelnými zdroji volného seslání v datech.

**Granty.** `combineSpellEntries` dál vrací jeden záznam na kouzlo (Actions beze
změny) a nese `grants: {origin, originName, usage}[]`; `usages` zůstává
odvozené pro `provenanceLabel`. Dedupe subclass kouzel drží kouzlo zvlášť pro
každý odlišný usage (Archfey Misty Step: slot i CHA/LR).

**Počítadla** v `play.resourceUses`, jedno na kouzlo na zdroj, klíč
`spell:<druh zdroje>:<jméno zdroje>:<kouzlo malými>|<SOURCE>`. Maximum: 1/LR a
1/SR → 1 (1/SR vrací Short Rest), schopnost → modifikátor, min. 1, PB → PB.
Sheet je připojí k resources, takže clamp i Short Rest jdou stávající cestou.
Level removal: clamp při zobrazení, `levelRemoval.ts` beze změny.

**Sdílení vlastníci.** Kde feature/rys už boxy má, volné seslání utrácí jeho
záznam: Gnomish Lineage (Forest Gnome), Serpentine Spellcasting, Chemical
Mastery (Tasha's Bubbling Cauldron), Steps of the Fey, Restorative Reagents.
Posledním dvěma dává maximum modifikátor schopnosti (min. 1), takže mají boxy i
ve Features & Traits a Actions. `resource` (Monk) utrácí `cost` z Focus Point.

**Řádky (model, UI až R7b-2).** CAST jen s nějakými sloty (bez slotů skrytý),
sekce podle D189. USE a štítek vždy ve vlastní úrovni kouzla. Štítek jen bez
CAST i USE. Hit/DC po řádcích jen v Spells: USE podle zdroje grantu, CAST podle
třídy; Actions beze změny.

## D191 — R7b-2: Spells tab na řádcích CAST / USE

Zdroj: task R7b-2. Schéma beze změny (48).

**Spells tab renderuje `spellsTabActionSections`.** Sekce, záhlaví, sloty,
pilulky, hledání a sloupce jako D189, mění se jen řádky. `spellsTabSections` a
`castsWithSlot` odstraněny (nikdo je nepoužíval); `filterSpellsTabSections` je
generické přes sekce. Kouzlo může mít CAST řádek a řádek USE na každé počítadlo,
pod jménem se rozbalují každý zvlášť; podtitulek USE řádku jmenuje jeho zdroj
(„Tiefling“), CAST řádku třídu.

**USE tlačítko** vypadá jako CAST (stejná třída a rozměry). Klik utratí
`cost` z počítadla řádku stávající cestou `spendResource` (`play.resourceUses`,
stejný clamp), u `resource` řádku (Monk) z Focus Point. Zakázané, když
`canSpendResource` řekne ne (0 zbývá, maximum neznámé). Kouzlo s koncentrací ji
USE spouští stejně jako CAST. Read-only list: žádné tlačítko, boxy zakázané.

**Počítadlo v Notes** USE řádku: `UseBoxes` (týž záznam jako Features & Traits a
Actions u sdílených vlastníků), za nimi „/ Long Rest“ nebo „/ Short Rest“, pak
obvyklé poznámky. U `resource` řádku místo boxů text „Focus Point 2 / 3“;
neznámé maximum = `UnresolvedValue`. Bez slotů se CAST řádek neukazuje (D190),
takže vybrané kouzlo postavy bez slotů je jen štítek.

## D192 — A-S1: always-prepared kouzla ze záznamu třídy

Zdroj: task A-S1 (průzkum v DATA.md). Schéma beze změny (48).

**Čte se `additionalSpells` záznamu třídy** (9 pevných grantů: Bard 20, Druid 1
a 2, Paladin 2 a 5, Ranger 1, Warlock 9, Artificer EFA 1). Nový původ grantu
`class`, štítek „always prepared (<Třída>)“. Klíč = úroveň v TÉ třídě (Fighter 5
/ Paladin 1 nemá Divine Smite). Do limitu připravených kouzel se nepočítají a
řádek se neduplikuje, když je hráč připraví také — jako u podtříd. Kouzlo se
sesílá s vlastností a Hit/DC té třídy a umisťuje se jako kouzlo té třídy
(Warlock: pact pravidla D189). Free casty (Hunter's Mark, Divine Smite, Find
Steed, Find Familiar, Contact Other Plane) přijdou v dalším tasku; `usage` je
zatím null. Bard `expanded` (Magical Secrets) se nečte, patří do Manage Spells.

## D193 — A-S2: volná seslání class always-prepared kouzel

Zdroj: task A-S2, pravidla 2024 PHB určil Daniel. Schéma beze změny (48).

Záznam třídy žádný wrapper nenese, proto ruční tabulka `CLASS_FREE_CASTS`
(třída|kouzlo → usage) v `subclassPreparedSpells.ts`:
- Ranger Hunter's Mark: `resource`, cost 1, Favored Enemy (existující boxy).
- Druid Find Familiar: `resource`, cost 1, Wild Shape (existující boxy).
- Paladin Divine Smite / Find Steed, Warlock Contact Other Plane: 1× za Long Rest.
  Počítadlo vlastní feature přes `SHARED_OWNERS` (klíč = název třídy): Paladin's
  Smite, Faithful Steed, Contact Patron — boxy jsou i ve Features & Traits.
Všech pět je i slotem: `ALSO_CASTABLE_WITH_SLOT` má Ranger, Paladin, Warlock,
Druid (CAST řádek zůstává). Bard Power Words, Speak with Animals a Mending bez
volného seslání. `alsoCastableWithSlot.test.ts` prochází i záznamy tříd.

## D194 — Kniha RHW, dedupe reprintů podtříd, Dark Gift featy

Zdroj: task D194, rozhodnutí Daniela 26. 9. 2026 (průzkum REPORT-KNIHY.md).
Schéma beze změny (48).

- **RHW celá kniha** v ALLOWED_SOURCES (extract, validate, subclassData.ts).
  FRHoF a SCC ne.
- **Dedupe reprintů podtříd (Q7).** `reprintedAs` podtřídy se porovnává jako
  4dílné uid `shortName|className|classSource|source` v extrakci i ve validate.
  Podtřída s načteným cílem vypadne i se svými features; s nenačteným cílem
  (Bladesinging → FRHoF) zůstane v datech a app ji dál skrývá (`!reprintedAs`).
- **Dhampir|RHW zůstává venku** (chybí `edition`, filtr species beze výjimky).
- **Bladesinging|TCE se neodkrývá**, čeká na FRHoF.
- **Dark Gift featy (DG).** Pravidlo knihy: DG místo Origin featu. App dnes volbu
  Origin featu nikde nenabízí, proto žádný DG picker. Backgroundy RHW: Haunted
  One a Investigator dávají svůj pojmenovaný feat (alternativa „any Dark Gift“
  se ignoruje, výměna je pozdější task); Mist Wanderer a Spirit Medium (jen DG)
  se v pickeru nenabízejí.
- **Prerekvizita `campaign` je vždy splněná** (app kampaně nesleduje, DG pravidlo
  už chce svolení DM). Picker ji ukazuje jako poznámku („Ravenloft campaign“) a
  DG featy nese štítkem „Dark Gift“. Týká se i 13 EFA Dragonmark featů; jejich
  `exclusiveFeatCategory` se proto vyhodnocuje (žádný jiný feat té kategorie).

## D195 — Smysly z class a subclass features

Zdroj: task D195, 26. 9. 2026. Navazuje na D176, D194. Schéma beze změny (48).
Smysly jsou jen v textu features, proto ruční tabulka `CLASS_SENSE_GRANTS`
(`grantedSenses.ts`), podtřídy přes jméno A zdroj (`hasSubclassBySource`, úroveň
3 dle D176). Provenance „from class feature (Name)“.

- **Pevné (největší vyhrává):** Ranger XPHB 18 Feral Senses → Blindsight 30;
  Twilight Domain|TCE Eyes of Night → Darkvision 300 (data L1, app od 3, D176);
  Shadow Sorcery|RHW 3 Eyes of the Dark (uvnitř Power of Shadow) → Darkvision
  120 + Blindsight 10.
- **Aditivní darkvision (nové pravidlo):** Gloom Stalker|XPHB 3 Umbral Sight
  a Warrior of Shadow|XPHB 3 Shadow Arts (podfeatura „Darkvision“; provenance
  „Shadow Arts“). Text zní „if you already have Darkvision, its range increases
  by 60“, ne „větší z obou“: hodnota = největší jiný (neaditivní, nezadržený)
  zdroj + 60, bez jiného zdroje 60. Tím vždy vyhraje max; ostatní řádky
  breakdownu „does not exceed“ ji. Dvě aditivní se navzájem nesčítají.
- **Mimo:** Wild Heart Aspect of the Wilds (Owl) — volba bez pickeru a
  úložiště; Watchers Mortal Bulwark — dočasný buff na 1 minutu; Diviner The
  Third Eye — dočasná volba do odpočinku; Scribes Manifest Mind — smysl patří
  vyvolané mysli, ne postavě.

## D196 — Pool existuje, když ho dává tabulka třídy, ne až když ho někdo utrácí

Zdroj: task D196, 26. 9. 2026. Navazuje na 9b1, D191, D194. Schéma beze změny (48).

- **Problém A:** `computeCharacterResources` zakládal pojmenovaný pool jen přes
  `consumes` nějaké držené featury. Beasts of Ill Omen (Shadow Sorcery|RHW 6)
  utrácí 3 Sorcery Points jen v próze; bez Metamagic volby pool chyběl a USE u
  Summon Beast byl vypnutý s „not known“.
- **Oprava A:** druhá, doplňková cesta: kterékoli z 8 jmen poolů, které má
  vlastní class/subclass tabulka postavy na její úrovni jako číslo > 0
  (`tableGrantedPools`, stejné `lookupInTableGroups` jako maximum), pool založí.
  Pomlčka v buňce (Sorcerer 1) nic nezakládá. Cesta přes `consumes` zůstává
  (pool z featu/předmětu bez tabulky).
- **Problém B se nepotvrdil:** USE u Summon Beast nečte `consumes`, ale cenu
  z `resource` wrapperu v additionalSpells (`freeCastCounter` → cost 3) a
  odečítá ji celou (`spendResource`, `canSpendResource`). Ruční tabulka cen
  proto nevznikla — neměla by čtenáře: řádek featury v Actions `consumes.amount`
  nečte nikdy, jen ±1 na poolu. Ostatní prózové utrácení (23 featur) je v
  DATA.md.
