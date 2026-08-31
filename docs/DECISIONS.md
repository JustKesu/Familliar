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
