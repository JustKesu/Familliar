# Phase 1 — Specification

Agreed scope and decisions for the character sheet app itself.
Companion to NOTES.md (which covers phase 0: data extraction).

Ruleset: D&D 5e 2024 (PHB 2024). Sources per ALLOWED_SOURCES in NOTES.md.

---

## Definition of done

A web app running in the browser where the user can:

- Create a character at any level 1-20 from the extracted 5etools data
- See a complete sheet with correctly derived numbers
- Play a session with it: track HP, spend slots, take rests
- Close the browser and reopen the character in the same state
- Run it independently on each player's own machine (data stored locally
  per browser, no accounts, no server)
- Export a character to a file and import it back

NOT in phase 1: PDF export, homebrew, mobile layout, visual design,
AI character generation, magic item variants (+1 weapons), monsters,
character sharing between players.

---

## A. Character creation

Order follows PHB 2024 character creation.

### 1. Class and level
Class, level 1-20. Subclass chosen at level 3.

Creating a character above level 1 walks through EVERY choice from
level 1 up to the target level. Rationale: a level 5 character owns
everything granted at levels 1-4 — the level 4 feat, spells learned
along the way, fighting style, etc. The player must pick all of it.

The walkthrough may be presented as one continuous flow rather than
five separate screens, but no choice may be skipped.

### 2. Origin
Species, background, languages.

### 3. Ability scores — three methods, player picks one

**Standard array** — 15, 14, 13, 12, 10, 8. Player assigns to abilities.

**Point buy** — 27 points, scores range 8-15 before bonuses.
UI shows remaining points and the cost of each step.

**Roll** — 4d6 drop lowest, six times. App rolls and shows the
individual dice. Player then assigns results to abilities.
Also allow typing numbers in manually, for groups who roll physical
dice at the table.

After the method, the background ability bonus is applied:
either +2/+1 or +1/+1/+1, distributed among the three abilities that
background offers (see NOTES.md — Background field shapes).

### 4. Class and level choices
Skills, fighting style, expertise, weapon masteries, feat-or-ASI at
levels 4/8/12/16/19, spells, starting equipment.

The app offers only valid options for that class, level and origin.

### 5. Hit points — player picks per level

Level 1: max hit die + CON modifier. Not a choice.

Every level after, the player chooses:
- **Average** — fixed number: d6 -> 4, d8 -> 5, d10 -> 6, d12 -> 7
- **Roll** — app rolls the hit die and shows the result

Both the choice AND the resulting number are stored per level, so HP
never changes on reload. If CON changes later, HP recalculates
retroactively across all levels.

---

## B. Derived values the app calculates

**Proficiency bonus** — from total character level (+2 to +6).

**Skills** — all 18. Each has three states: none / proficient / expertise.
Value = ability modifier + PB (x2 for expertise).
UI shows the SOURCE of each proficiency (class / background / species /
feat) so overlaps are visible.
Half-proficiency handled (Bard Jack of All Trades).

**Saving throws** — all 6. Proficiency from class, plus from feats.

**Armour Class** — from equipped armour:
base value from data + Dex modifier capped by armour type
(light = uncapped, medium = max +2, heavy = none), shield +2.
See NOTES.md — "Armour AC: the data won't tell you".
Alternative AC formulas supported: Unarmored Defense (Barbarian CON,
Monk WIS), Mage Armor, Draconic Sorcerer.

**Initiative** — Dex modifier, plus PB if the character has Alert.

**Weapon attacks** — per weapon in inventory:
to-hit = ability modifier + PB (only if proficient with that weapon
type) + magic bonus.
damage = weapon dice + ability modifier, no PB.
Finesse weapons let the player choose STR or DEX.
Weapon mastery property shown.

**Spellcasting** — spell attack = ability mod + PB.
Save DC = 8 + PB + ability mod.
Spell slots from the class table, including half casters
(Paladin, Ranger, Artificer), third casters (Eldritch Knight,
Arcane Trickster) and Warlock Pact Magic tracked separately.
Prepared vs known spells distinguished. Cantrips, rituals,
concentration flagged.

**Other derived** — speed, size, darkvision, number of attunement
slots, hit dice pool.

---

## C. Play tracking

Everything below persists across browser restarts.

- Current HP, max HP, **temporary HP** (separate pool, not added to max)
- Hit dice — spending on short rest
- Death saves
- Spell slots — spending and restoring; Pact slots tracked separately
- Concentration — what is being concentrated on
- Conditions
- Exhaustion level
- Heroic Inspiration
- Currency
- Inventory with attunement tracking
- Free-text notes
- Short rest / long rest buttons that restore the correct resources

---

## D. Decisions taken

### Character storage — localStorage, versioned, with file export/import

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

**Status: implemented (build order step 2), including export/import.**
Nothing above is still to schedule — the rest of this subsection
describes the actual shape that was built, not a plan.

**Modules, in `src/storage/`:**
- `character.ts` — the placeholder `Character`/`CharacterClass` types
  (`id`, `name`, `classes: CharacterClass[]`, each class
  `{ className, classSource, subclass, level }`) and
  `CURRENT_SCHEMA_VERSION` (currently `1`).
- `wireFormat.ts` — `StoredCharacter`, the on-disk/on-file shape: a
  `Character` plus its own `schemaVersion`. Both localStorage and export
  files store the same shape: a top-level ARRAY of these records, each
  carrying its own version, so a future mixed-version import file could
  in principle be handled record by record.
- `validate.ts` — structural validation for data from outside the app's
  control (hand-edited localStorage, an imported file of unknown
  origin). Returns human-readable rejection reasons instead of throwing.
- `errors.ts` — typed failures (`StorageUnavailableError`,
  `StorageFullError`, `CorruptDataError`, `UnknownSchemaVersionError`,
  `ImportValidationError`, `CharacterNotFoundError`), all extending
  `StorageError`, so the UI can catch one type and show `.message`.
- `characterStore.ts` — the `CharacterStore` class. Constructed with an
  optional `KeyValueStorage` (defaults to `localStorage`, swappable in
  tests). Public API:
  - `list(): Character[]`
  - `create(name: string, classes?: CharacterClass[]): Character`
  - `rename(id: string, name: string): void`
  - `delete(id: string): void`
  - `exportCharacter(id: string): string` — JSON, still a top-level array
  - `import(raw: string): Character[]` — adds every character in the
    file as NEW characters with fresh ids; on any validation failure the
    store is left completely unchanged

**Storage key:** `familliar:characters` (a colon, not the dot used in
earlier drafts of this document).

**Not yet present:** `createdAt`/`updatedAt` timestamps. The `Character`
type is deliberately still just `id`, `name`, `classes` — timestamps
were never part of what got built and are not required by anything in
this document; add them if a later step needs them.

`src/CharacterManager.tsx` is a temporary UI proving the whole layer
works by hand (list/create/rename/delete/export/import) and is expected
to be replaced by real character creation (build order step 3) and the
sheet (step 5).

Tests: `src/storage/characterStore.test.ts`, 25 tests, covering
round-trip save/load, corrupt JSON, wrong shape, unknown schema
version, quota-exceeded and storage-unavailable errors, and import
never overwriting an existing character.

### How many characters per browser — a LIST from day one
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

### TypeScript, strict mode
The app is written in TypeScript with `strict: true` (tsconfig.app.json,
tsconfig.node.json and tsconfig.test.json). Not negotiable per-file: no
opting out with `any` where a real type is possible.

Rationale: the 5etools data is deeply nested and irregularly shaped (see
the whole "Traps" section of NOTES.md — blank sources meaning PHB, fields
that are string-or-null, flags that only exist for some item kinds).
Those are exactly the mistakes the compiler catches for free.

Type definitions for the game data are written as the features that
consume them are built, not upfront.

### Markup renderer — two layers, references are not links yet
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

### Markup — a blank source is preserved, never defaulted
`{@condition prone}` and `{@status concentration||concentrating}` carry no
source. The renderer records that as an empty string rather than filling in
a default.
Rationale: per NOTES.md a blank source means the 2014 PHB, not "the current
book". Defaulting it inside the renderer would bury that distinction
somewhere the feature that eventually resolves these links cannot see it.

### Markup — unknown tags degrade, they never throw
An unrecognised tag renders its first argument, which for every 5etools tag
is human-readable text. Braces are never shown to the player. The same
applies to unrecognised nested entry types, which render their body.

A warning is logged once per distinct tag or type name — not once per
occurrence, which would flood the console on a single class page.

Because that fallback is silent by design, a test renders EVERY entry
structure in data/ and fails the build if anything warns. That is the real
guard; the graceful degradation is only there to protect a player mid-session.

### Markup — `ref*` entry types show a name, not the feature
`refClassFeature`, `refSubclassFeature`, `refOptionalfeature` and `refFeat`
(335 occurrences) point at a feature defined in a different file. Resolving
them needs a cross-file lookup the renderer does not have and should not
own.
They render as the target's name, with the full UID kept on the element in
`data-ref-uid`. Inlining the real feature text belongs to the feature that
builds class progressions.

### Tests — static HTML for the renderer, a real DOM for interactive components
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

None of this reaches a real browser; see NOTES.md, "Browser
verification by the agent" (deferred, revisit at build order step 5).

Tests also get their own TypeScript project (tsconfig.test.json) because
one of them reads data/ off disk. Keeping Node types out of
tsconfig.app.json means browser code cannot reach for `fs` and still
compile.

### Manual override of calculated values — NO, except HP
Calculated fields (AC, to-hit, saves, DCs) cannot be hand-edited in
phase 1. HP is the exception: current HP and max HP are manually
editable.
Revisit in phase 2 if real play shows it is needed.

### Encumbrance and carrying capacity — NOT IMPLEMENTED
Deliberately excluded. Nobody at this table uses the rule.
Inventory is a list of items with no weight tracking.

### Multiclass — model from day one, UI at the end of phase 1
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

### Fighting Styles resolve through feats.json, not optional-features.json

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

### Character creation is a multi-step wizard, organised by category

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

**Status: shell built (build order step 3, this slice).** `src/creation/`
holds `wizardState.ts` (pure step order, navigation and save-assembly
logic, framework-free) and `CharacterWizard.tsx` (the React shell). The
shell currently wires in the four pickers that exist — class/level,
species, background (with its ability bonus distribution), ability
scores — as steps 1-4, followed by a review step that is the only place
`CharacterStore.create` is called. Steps 5 (spells) and 6 (equipment) are
not built; adding them means adding an entry to `WIZARD_STEPS` and a
matching panel, not reworking the shell. `CharacterManager.tsx` now
delegates creation to `CharacterWizard` instead of holding the pickers
itself — see "Temporary scaffolding" below for what in that file is still
throwaway.

### Temporary scaffolding

Surfaces that exist only to prove a layer works by hand, not as finished
UI. Each is labelled on screen and in its file's top comment as temporary,
naming what replaces it. Listed here so none of them is later mistaken
for real work:

- **`src/CharacterManager.tsx`** — creation itself is now the real
  `CharacterWizard` (see above), not temporary. What remains temporary in
  this file: lists, renames, deletes, exports and imports characters, and
  lets the player select one to inspect. Proves the storage layer (build
  order step 2) works end to end with the wizard. Replaced by the sheet
  (step 5); languages and the level-1-to-target walkthrough of per-level
  choices still need adding to the wizard as further slices of step 3.
- **`src/CharacterInspector.tsx`** — read-only dump of everything stored
  on a selected `Character`: id, name, classes, species, background,
  the chosen ability bonus distribution, and ability scores (including
  the rolled dice sets as stored, unconnected to a specific ability
  since that mapping is not persisted). No derived values. Replaced by
  the sheet (step 5).
- **`src/MarkupDemo.tsx`** — renders a handful of real data/ entries
  through the markup renderer (step 1) so it can be checked against real
  content. Replaced by character creation (step 3) and the sheet (step 5),
  which will use the renderer directly instead of demo panels.

---

## E. Build order

Each step is finished and tested before the next begins.

1. **5etools markup renderer** — DONE. Converts `{@damage 8d6}`,
   `{@condition prone}` etc. into readable text, and recurses through
   `entries` arrays. Lives in `src/markup/`.
   All 38 tags and all 14 nested entry types that occur in data/ are
   handled; the inventory is in MARKUP-INVENTORY.md, regenerated by
   `npm run survey-markup`. 104 tests, including one that renders every
   entry structure in data/ and fails if anything warns.
2. **App skeleton + persistence** — DONE (Vite + React + TypeScript, data
   served from public/data/). Storage layer lives in `src/storage/`:
   `character.ts` (the placeholder `Character`/`CharacterClass` types and
   `CURRENT_SCHEMA_VERSION`), `wireFormat.ts` (the on-disk/on-file
   `StoredCharacter` shape), `validate.ts` (structural validation for data
   from outside the app's control), `errors.ts` (typed failures the UI can
   catch and display), and `characterStore.ts` (the `CharacterStore` class
   that owns all localStorage access). Characters are stored under the
   localStorage key `familliar:characters`, versioned with schema version 1
   from the first write. Export/import (section D) is implemented as part
   of this step, not scheduled separately. A temporary UI,
   `src/CharacterManager.tsx`, exercises the whole layer by hand: list,
   create, rename, delete, export, import — replaced by real character
   creation and the sheet in later steps. 25 tests in
   `src/storage/characterStore.test.ts` cover round-trip save/load,
   corrupt data, unknown schema versions, quota/storage-unavailable
   errors, and import never overwriting existing characters.
3. **Character creation** — class, species, background, ability scores
   (all three methods), languages, and the level-1-to-target walkthrough
   of per-level choices. IN PROGRESS. Four picker slices done, on main:
   class/level selection (`src/classes/`), ability scores — all three
   methods, persisted with the method used and the individual rolls
   (`src/abilities/`), species selection — filtering entries
   superseded by a newer reprint and prefixing Genasi subrace display
   names with their parent species (`src/species/`), and background
   selection — displays skill/tool proficiencies, origin feat and both
   starting equipment options (item names resolved against items.json),
   plus the background's ability bonus distribution (+2/+1 or +1/+1/+1,
   validated against the three abilities that background offers)
   (`src/backgrounds/`). The wizard shell wiring those four pickers
   together is also done: `src/creation/` (`wizardState.ts` +
   `CharacterWizard.tsx`) — see PHASE1.md section D, "Character creation
   is a multi-step wizard, organised by category". Each picker now
   receives its current selection as a `value` prop from the wizard and
   only reports changes upward, so a selection survives navigating away
   from and back to its step (previously only the class step did — see
   section D, "Tests — static HTML for the renderer, a real DOM for
   interactive components"). Covered by `src/creation/CharacterWizard.test.tsx`.
   Not yet built: languages, and the level-1-to-target walkthrough of
   per-level choices.
   `src/CharacterManager.tsx` + `src/CharacterInspector.tsx` (see
   "Temporary scaffolding" below) still provide the temporary list/rename/
   delete/export/import/inspect surface around the real creation flow,
   pending the sheet.
4. **Calculation layer** — PB, skills, saves, AC, attacks, spell DCs.
5. **Sheet display** — the read-only view of a finished character.
6. **Spells** — spell list, preparation, slots.
7. **Inventory and equipment** — items, attunement, equipped state.
8. **Level up** — including the per-level HP choice.
9. **Play tracking and rests.**
10. **Multiclass.**

---

## F. Open questions for phase 1

### Fluff / lore text
Species and spell descriptive text lives in separate fluff-*.json files
and is currently NOT extracted (NOTES.md). Decide whether the sheet
needs it. Leaning: not needed for phase 1, mechanical text is enough.
STATUS: undecided.

### Magic Initiate parent entry
`_versions` expansion keeps the generic parent feat selectable next to
its three class variants. For a character sheet the generic one is
probably not a valid pick. Decide whether to hide parents that have
variants.
STATUS: undecided.

### The species picker lists entries a player cannot act on
Same family of problem as Magic Initiate above. Two unrelated causes with
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
`raceSource: "MPMM"` (see NOTES.md, "Species variants come in TWO
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

Nothing wrong with the names this time. The problem is that nine species
names occur twice over, because the species was reprinted in a second
book that is also in ALLOWED_SOURCES and both printings survive
extraction (see NOTES.md, "Nine species names occur twice").

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

### Where does the list of selectable LANGUAGES come from
Section A.2 says the player picks languages during origin. Nothing in the
extracted data currently supports that.

Per NOTES.md ("Background field shapes"), the 2024 rules moved languages
out of backgrounds, and `languageProficiencies` is absent from every
background in data/. So there is no per-background list to read, and no
list of the languages themselves has been identified anywhere in data/
either.

We do not currently know where the selectable set is meant to come from.
Candidates not yet checked: a languages table in the 5etools source that
extraction never touched, a species-level grant, or a fixed list from the
PHB 2024 text that would have to be typed in by hand.

Blocks A.2 as written. Either find the source or decide the sheet stores
languages as free text.
STATUS: undecided, source unknown.

### Where data lives at deployment
See NOTES.md. Revisit before the first deploy to a public URL.
STATUS: deferred.
