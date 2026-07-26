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
The app is written in TypeScript with `strict: true` (tsconfig.app.json
and tsconfig.node.json). Not negotiable per-file: no opting out with
`any` where a real type is possible.

Rationale: the 5etools data is deeply nested and irregularly shaped (see
the whole "Traps" section of NOTES.md — blank sources meaning PHB, fields
that are string-or-null, flags that only exist for some item kinds).
Those are exactly the mistakes the compiler catches for free.

Type definitions for the game data are written as the features that
consume them are built, not upfront.

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

---

## E. Build order

Each step is finished and tested before the next begins.

1. **5etools markup renderer** — converts `{@damage 8d6}`,
   `{@condition prone}` etc. into readable text or links, and recurses
   through `entries` arrays. See NOTES.md — Open questions.
   Required first: used everywhere.
2. **App skeleton + persistence** — project runs in the browser,
   a character can be saved and survives reload.
3. **Character creation** — class, species, background, ability scores
   (all three methods).
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

### Where data lives at deployment
See NOTES.md. Revisit before the first deploy to a public URL.
STATUS: deferred.
