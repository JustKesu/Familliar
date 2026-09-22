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
