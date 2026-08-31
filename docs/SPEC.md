# Spec

What the app must be able to do. The requirement, not the plan and not
the current state.

---

Ruleset: D&D 5e 2024 (PHB 2024). Sources per ALLOWED_SOURCES in DATA.md.

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
AI character generation, magic item variants as generated items (a +1
bonus is set on an item the character owns instead — see build order 7),
containers and encumbrance, monsters (except the Beast stat blocks Wild
Shape and Find Familiar need — see build order 6b), character sharing
between players.

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
background offers (see DATA.md — Background field shapes).

### 4. Class and level choices
Skills, fighting style, expertise, weapon masteries, feat-or-ASI at every level the class grants it (read from the data,
not a fixed list — most classes 4/8/12/16, Fighter also 6 and 14,
Rogue also 10, plus Epic Boon at 19), spells, starting equipment.

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
See DATA.md — "Armour AC: the data won't tell you".
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

## D. Build order

Each step is finished and tested before the next begins.

1. **5etools markup renderer** — converts 5etools' tag syntax and nested
   entry structures into readable text.
2. **App skeleton + persistence** — app scaffold, plus versioned
   localStorage storage with file export/import.
3. **Character creation** — class, species, background, ability scores
   (all three methods), languages, and the level-1-to-target walkthrough
   of per-level choices.
3a. **Expertise** — the expertise picker for Rogue and Bard.
4. **Calculation layer** — proficiency bonus, skills, saves, AC, attacks,
   spell DCs.
4a. **Feat/ASI slice** — the level 4/8/12/16/19 feat-or-ASI choice.
5. **Sheet display** — the read-only view of a finished character.
6. **Spells** — spell list, preparation, slots.
6a. **Class feature choices** — selectable class/subclass features (Warlock Invocations, Fighter Maneuvers, and similar "choose from a list" features): their wizard picker, storage, sheet display, and the subset whose choice changes a calculated value. Usage trackers and rest replenishment for these features are step 9.
6b. **Beasts for Wild Shape and Find Familiar** — extraction of Beast
   stat blocks, the Wild Shape known-forms picker, and the Find Familiar
   form list.
7. **Inventory and equipment** — items, equipped state, Armour Class
   from worn armour, weapon attacks, attunement, magic bonuses and custom
   items, and resistances and immunities from every source.

   Magic bonuses are set on an item the character already owns (+1/+2/+3),
   not imported as separate generated variants. A custom item carries a few
   structured fields and free text; what the app cannot compute it displays
   and says so — D9 and D55 unchanged, no manual override of a calculated
   value.

   Conditional resistances (a Barbarian's Rage) are displayed as text here;
   they become an active state in step 9, which is where conditions live.

   Finally, once the above exists, the sheet is rearranged into a persistent
   header plus tabs, and gains an actions table listing weapon attacks,
   spells with an attack or a save, and usable features. Uses remaining
   ("2 of 3") are filled in by step 9. The rearrangement comes last because
   it moves finished sections rather than half-built ones.

   NOT in this step: weight and encumbrance (D10), containers, buying and
   selling, ammunition spent during play (step 9), and a shared library of
   custom items.
8. **Level up** — including the per-level HP choice.
9. **Play tracking and rests.**
10. **Multiclass.**
