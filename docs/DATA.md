# Data

How the 5etools data actually behaves, and how this project's copy of
it is produced. Reference material, consulted when writing code that
reads `data/`.

---

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
  node scripts/validate-data.js    # 140 checks, exit code 1 on failure

  scripts/package.json             # not a script — a 2-line config file.
    The root package.json sets "type": "module" for the Vite app, but the
    scripts here are CommonJS (require/module.exports). This file sets
    "type": "commonjs" for the folder so they keep running unchanged.

## Content scope

ALLOWED_SOURCES: XPHB, XGE, TCE, EFA, XDMG, MPMM, RHW, SCC
ALLOWED_CLASS_SOURCES: XPHB, EFA  (the class EDITION, not the book)
EXCLUDED_BACKGROUND_SOURCES: SCC  (backgrounds step only, D199)

  XPHB  Player's Handbook 2024      — core
  XGE   Xanathar's Guide            — subclasses, spells, feats
  TCE   Tasha's Cauldron            — subclasses, spells, feats
  EFA   Eberron: Forge of Artificer — 2024-rules Artificer
  XDMG  Dungeon Master's Guide 2024 — magic item catalogue
  MPMM  Monsters of the Multiverse  — 2014 species pool
  RHW   Ravenloft: The Horrors Within (2026-06, 2024 rules) — whole book, D194
  SCC   Strixhaven: A Curriculum of Chaos (2014 rules) — spells, items, 2
        hidden feats; backgrounds excluded, Owlin dropped by the species filter (D199)

Deliberately excluded: PHB 2014, FRHoF, all adventure modules,
UA/playtest, Plane Shift booklets, VGM/MTF (superseded by MPMM).

A second copy of ALLOWED_SOURCES lives in src/subclass/subclassData.ts and one
in scripts/validate-data.js; without the src copy the app does not offer a new
book's subclasses. The src copy has no SCC (the book has no subclasses).

### RHW, FRHoF, SCC — what the three books contain (survey 2026-09, D194)

Raw data before any filter (`scripts/investigate-books.mjs`, untracked):

| | RHW (2024) | FRHoF (2025-11, 2024) | SCC (2021, **2014 rules**) |
|---|---|---|---|
| subclasses (+features) | 7 (+44): Reanimator/Artificer (classSource EFA), College of Spirits, Grave Domain, Hollow Warden, Phantom, Shadow Sorcery, Undead Patron | 8 (+56): Moon/Bard, Knowledge/Cleric, Banneret, Noble Genies, Winter Walker, Scion of the Three, Spellfire, Bladesinger | 0 |
| spells | 0 (no spell file) | 19 | 5 (Borrowed Knowledge, Kinetic Jaunt, Silvery Barbs, Vortex Warp, Wither and Bloom) |
| feats | 11 (9 category `DG` Dark Gift, Survivor and Sharp Eye `O`) | 34 (13 EB, 10 O, 11 G…) | 2 (Strixhaven Initiate, Strixhaven Mascot; no category) |
| species | 4 (Dhampir, Hexblood, Lupin, Reborn) | 0 | 1 (Owlin) |
| backgrounds | 4 | 18 | 5 (colleges) |
| items | 2 | 24 + 3 baseitem + 1 itemGroup | 18 |
| other | 70 monsters, 8 bastions, deck + 54 cards, 5 rewards | 17 languages, 42 deities, 8 bastions | 47 monsters, 4 adventures |

- Classes/features are complete in class/*.json (not only book text); 0 dangling
  refs; no optional features in any of the three. RHW/FRHoF reference `|XPHB`
  everywhere; 0 markup tags unknown to MARKUP-INVENTORY.
- `edition: "one"` sits on 13 RHW + 26 FRHoF records; SCC has no `edition`
  anywhere. **Dhampir|RHW and Owlin|SCC have no `edition`**, so the species
  filter (`edition === "one" && allowed source`, or MPMM) drops them — Dhampir
  stays out by decision (D194).
- RHW subclasses, reprint targets: XGE Shadow Magic → Shadow Sorcery|RHW, XGE
  Grave → Grave|RHW, TCE Phantom → Phantom|RHW. Only TCE Bladesinging points at
  FRHoF (unloaded), so it stays in classes.json with `reprintedAs` and the app
  hides it (`!reprintedAs`, subclassData.ts / featureGrants.ts).
- FRHoF: 17 regional languages, all `type: standard`. Feats with `choose`
  (Cold Caster, Emerald Enclave Fledgling) need checking against the closed
  FILTER_CHOICE_FEAT_KEYS tables before FRHoF is loaded. Prose proficiency
  grants, **modelled since D203** (all class level 3 except Unfettered Mind 6):
  Bladesinger — Training in War and Song: Melee Martial weapons without the
  Two-Handed or Heavy property + 1 of Acrobatics/Athletics/Performance/
  Persuasion (Bladesong grants nothing lasting); Knowledge Domain — Blessings of
  Knowledge: 1 Artisan's Tools + 2 of Arcana/History/Nature/Religion, both with
  Expertise (a skill already held is still a valid pick); Unfettered Mind:
  Intelligence saves ("choose another" if already held — not tracked);
  Banneret — Knightly Envoy: 1 language (standard or rare; the Long Rest swap
  and Comprehend Languages not modelled) + 1 of Insight/Intimidation/Persuasion/
  Performance; Oath of the Noble Genies (the classes.json name) — Genie's
  Splendor: 1 of Acrobatics/Intimidation/Performance/Persuasion; College of the
  Moon — Primal Lore: 1 of Animal Handling/Insight/Medicine/Nature/Perception/
  Survival. Each name is unique among offered subclasses (one entry, source
  FRHoF, classSource XPHB). Boon of
  Terror is NOT prose: `skillProficiencies [{intimidation:true}]` + `expertise
  [{intimidation:true}]` (D202). Loading FRHoF also drops Blade of Disaster|TCE
  (reprinted).
- SCC is 2014: backgrounds have no `ability` (no ASI) and carry
  `languageProficiencies`, `fromFeature` and `additionalSpells` with `expanded`
  s1–s5 lists (no background spell path exists in the app); Strixhaven Initiate
  has no category (would default to `G`, i.e. level 4+, though it is a
  background feat) and 5 named `additionalSpells` blocks = a college choice (the
  app reads only `[0]`); Strixhaven Mascot summons SCC creatures (6×
  `{@creature …|SCC}`) outside beasts.json; 2 SCC spells keep an "At Higher
  Levels" header; 66 bare `{@spell}`, 20 `{@skill}`, 32 `{@item …|phb}` (render
  fine — no lookup, `parseSpellRef` matches by name). gendata gives all 24
  FRHoF/SCC spells XPHB classes (Silvery Barbs → Bard, Sorcerer, Wizard).
- New keys: feats `immune` (1), `conditionImmune` (2) — text only in the app.

### SCC records after extraction (D199)

Confirmed in data/ after the D199 run: spells 5, feats 2, items 18,
backgrounds 0, species 0.

- **Spells** (`availableTo.classes`, all via gendata, no new path):
  Borrowed Knowledge L2 — Bard, Cleric, Warlock, Wizard; Kinetic Jaunt L2 —
  Bard, Sorcerer, Wizard, Artificer|EFA; Silvery Barbs L1 (reaction) — Bard,
  Sorcerer, Wizard; Vortex Warp L2 — Sorcerer, Wizard, Artificer|EFA; Wither
  and Bloom L2 — Druid, Sorcerer, Wizard. `classVariants` empty on all five.
- **Feats**: `Strixhaven Initiate` (15 `additionalSpells` blocks, no category →
  defaulted to `G`, no prerequisite) and `Strixhaven Mascot` (not "Mascot";
  prerequisite `level 4` + `feat strixhaven initiate|scc`, category defaulted
  `G`). Mascot hidden in the picker (HIDDEN_FEAT_KEYS); Initiate offered (D200).
  Initiate's 15 blocks are "<College> 1..3", each `known._` = 2 cantrips
  (`name#c`), `ability.choose` int/wis/cha, and `innate._.daily.1` = one
  `{choose:"level=1|class=a;b"}` (cleric;wizard, bard;sorcerer, druid;wizard,
  bard;cleric). Bard is a class name the choose-string lookup needed (D200).
- **`availableTo.feats`**: 73 spells now list `Strixhaven Initiate|SCC` (its
  college lists). Nothing in src reads `availableTo.feats`.
- **Items** (18): 5 Primers (Lorehold, Prismari, Quandrix, Silverquill,
  Witherbloom — uncommon, `reqAttune "by a spellcaster"`, `charges`/`recharge`,
  `reqAttuneTags`), 5 matching Trinkets (Adventuring Gear, rarity `none`),
  Alchemist's Doom, Catapult Munition, Murgaxor's Elixir of Life (Adventuring
  Gear, rarity `unknown` — 2014 value; the app reads rarity only as `=== "none"`
  in tool/focus filters), Bottle of Boundless Coffee, Cuddly Strixhaven
  Mascot, Masque Charm (`attachedSpells`), Strixhaven Pennant (`light`),
  Murgaxor's Orb (legendary, `reqAttune: true`, `sentient`, `curse`,
  `attachedSpells`). `charges`, `attachedSpells`, `sentient`, `curse`, `light`
  are not read by the app (text only). Markup tags in SCC items: book,
  condition, creature, damage, dc, dice, item, sense, skill, spell — all
  handled by the renderer.

### FRHoF records after extraction (D201)

Scope list: TAKE subclasses, spells, items, feats of category EB and G (minus
exclusions); DROP backgrounds (18), languages (17), feats of category O (8),
deities and bastions (extract-data.js reads neither). Correction to the survey
table above: FRHoF has 13 EB, 13 G, 8 O feats (not 11 G / 10 O).

Confirmed in data/: subclasses 8, subclass-features 56, spells 19, items 27,
feats 18, backgrounds 0, languages 0.

- **Feats:** the 8 G feats excluded are the ones whose prerequisite is a
  faction O feat (Dragonscarred, Enclave Magic, Harper Teamwork, Lordly Resolve,
  Order's Resilience → Tyro of the Gauntlet, Purple Dragon Commandant, Zhentarim
  Tactics) plus Spellfire Adept → Spellfire Spark. Kept G: Cold Caster (hidden),
  Fairy Trickster, Genie Magic, Mythal Touched, Street Justice. Cold Caster's
  `additionalSpells` is two unnamed alternative blocks (`ray of frost|xphb#c`,
  and `{choose:"level=0|class=Wizard"}`), both with `ability.choose`. Boon of
  Revelry's `prepared._` (Otto's Irresistible Dance) has no `ability` field and
  no `daily` wrapper, though the text grants a free cast per Long Rest; since
  D204 it is read with the feat's own +1 as its ability and a hand-table term
  (`FEAT_BARE_GRANT_USAGE`). Boon of Terror carries
  structured `skillProficiencies` + a fixed `expertise` (see D202 below).
- **Reprints:** Bladesinging|TCE → Bladesinger|Wizard|XPHB|FRHoF and Blade of
  Disaster|TCE → FRHoF are both removed by removeSuperseded (classes TCE 17→16,
  spells TCE 12→11, subclass-features 685→734 = +56 −7).
- **Subclass spells:** Moon `innate` cantrip choice + `prepared 6 daily 1e`
  Moonbeam ("always prepared" → slot-castable); Banneret `innate ritual`
  Comprehend Languages (ritual only → not slot-castable); Knowledge, Noble
  Genies, Winter Walker, Spellfire `prepared` tables; Scion of the Three
  `innate` cantrip choice with `ability: int`.
- **Spells** all via gendata (Bard/Cleric/Druid/Paladin/Ranger/Sorcerer/
  Warlock/Wizard lists), e.g. Wardaway L1 — Bard, Cleric, Paladin, Wizard.
- **Items:** Bandore, Cittern, Yarting (baseitem); the eight faction Trinkets,
  Adventurer's Ring, Devil Mask, Genie Robe, Locking Spellbook, Prosthetic
  Limb, Thayan Spell Tattoo, camouflage/clothing gear, Covered Wagon and animals
  (Axe Beak, Flying Snake, Sled Dog).
- **Markup trap:** entry names may hold tags ("Terrify (Cost: {@dice 1d6})",
  a Rogue Cunning Strike option); the renderer printed them raw
  until D201.
- Single-use pools: 12 new (Blessing of Moonlight, Boon of Exquisite Radiance,
  Boon of Fluid Forms, Boon of Terror, Boon of the Soul Drinker, Crown of
  Spellfire, Frozen Haunt, Genie Magic, Group Recovery and others); Boon of
  Terror, Boon of the Soul Drinker and Group Recovery recharge on a Short Rest.

### RHW records — shapes the app meets (D194)

- **Background `feats` alternatives.** Haunted One `[{"survivor|rhw"},
  {anyFromCategory:{category:["DG"]}}]`, Investigator the same with Sharp Eye;
  Mist Wanderer and Spirit Medium ONLY `anyFromCategory` DG (no named feat). The
  33 older backgrounds are all one named feat. Every `anyFromCategory` here is
  exactly `{category:["DG"]}` (no `count`); `parseOriginFeat` throws on any other
  category. Since D205 the app reads the named feat as the default
  (`BackgroundEntry.originFeat`) and a DG-only background as `originFeat: null`
  (Dark Gift required); the DG alternative itself is not read, because D205 lets
  every background swap its feat. D194 hid the DG-only pair; `backgroundData.ts`
  threw on these shapes before D194.
- **Dark Gift feats** (`DG`, 9): every one has prerequisite
  `[{campaign:["Ravenloft"]}]` and nothing else; no `ability` field. Five grant
  spells under `ability:{choose:[int,wis,cha]}` + fixed spells (Gathered Whispers
  message + augury `daily 1`, Living Shadow mage hand, Second Skin alter self
  `daily 1`, Touch of Death chill touch, Watchers beast sense + speak with animals
  `daily 1e`) — read since D204 by the same choice-ability + fixed-grant path as
  the marks.
- **Spellcasting ability inside `additionalSpells` (D204).** Among selectable
  feats, those with `ability.choose` inside `additionalSpells` and no choice in
  the top-level `ability` are exactly these 5 Dark Gifts, the 12 marks, Magic
  Initiate and Strixhaven Initiate (the last two have their own UI). The top-level
  `ability` (the +1) is a different field: before D204 no UI asked for the 17
  others' ability (`featSpellcastingAbilityOptions`).
- Other `campaign` prerequisites: the 13 EFA Dragonmark feats (`campaign` +
  `exclusiveFeatCategory:["D"]`) and Boon of Siberys (`campaign` + `level`).
- **Shadow Sorcery**: shortName `Shadow`, `prepared` 3/5/7/9 (Bane, Darkness,
  Inflict Wounds, Pass without Trace / Hunger of Hadar, Nondetection / Greater
  Invisibility, Phantasmal Killer / Contagion, Creation) plus
  `innate {6:{resource:{3:[summon beast]}}}`, `resourceName "Sorcery Point"`.
  Beasts of Ill Omen itself has no `consumes`; since D196 the pool comes from
  the Sorcerer table's "Sorcery Points" column, spender or not. Power of Shadow nests Eyes of the Dark (Darkvision 120,
  Blindsight 10 — no `senses` field on subclass features) and Strength of the
  Grave (1/LR, nested; since D197 tracked as the whole record "Power of
  Shadow", see "can't use this benefit" below); Umbral Form
  `consumes` Sorcery Point ×6.
- **Phantom|RHW** Speak with Dead sits in a `rest` wrapper (1/rest), which
  `extractRefsWithUsage` reads as `usage: null` — same as Aberrant Dragonmark|EFA.
- **College of Spirits** `prepared {6:{daily:{1e:[spirit guardians]}}}`;
  **Hexblood** `prepared {_:{daily:{1e:[disguise self, hex]}}}` with an ability
  choice. Both texts say "always prepared" (slot-castable, D190 table).
- Single-use sentences ("can't … again until you finish a … Rest") on 9 RHW
  records: Refined Reanimation, Reanimated Companion, Empowered Channeling
  (Short or Long), Divine Reaper (Short or Long), Ancient Might, Ghost Walk,
  Umbral Form, Necrotic Husk (Short or Long), Survivor.
- Proficiency grants in prose, **modelled since D203**: College of Spirits —
  Channeler: Playing Cards (items.json `Playing Cards|XPHB`, type `GS`),
  proficiency only, no item; Reanimator (Artificer, classSource EFA) —
  Reanimator's Skill Set: Alchemist's Supplies, or 1 other Artisan's Tools if
  already held (the EFA replacement rule, D176). Not grants: Phantom's Whispers
  of the Dead (temporary), Refined Reanimation, Reanimated Companion.
- **Structured proficiency grants (D202)** — the earlier scan wrongly listed
  these as prose:
  - Aberrant Anatomy: `skillProficiencies [{perception:true}]`, `expertise
    [{perception:true}]`. Boon of Terror (FRHoF) has the same shape with
    intimidation. The `expertise` entry here is FIXED (skill-name key `true`);
    every other feat's `expertise` is `[{anyProficientSkill:N}]`.
  - Echoing Soul: `skillProficiencies [{any:1}]`, `languageProficiencies
    [{any:1}]`, `expertise [{anyProficientSkill:1}]`. **Data/text mismatch:** the
    text says "proficiency in two skills of your choice"; the app follows the
    text (2 skills).
  - Symbiotic Being: `skillProficiencies [{choose:{from:[10 skills]}}]` (no
    count = 1), `languageProficiencies [{any:1}]`.
  - Species Lupin `skillProficiencies [{choose:{from:[perception, stealth,
    survival]}}]`; Reborn `[{any:1}]`.

XMM (Monster Manual 2024) is NOT in ALLOWED_SOURCES and must not be added to
it. Per D67 it is allowed for ONE category only — `data/beasts.json`, for Wild
Shape and Find Familiar. `extractBeasts()` carries its own `BEAST_SOURCE`/
`BEAST_MAX_CR` constants for exactly that reason: widening ALLOWED_SOURCES
would let the other ~400 XMM monsters into every category.

That category has TWO intakes, both XMM-only:

1. by TYPE — creatures of type Beast up to CR 6 (89 entries);
2. by NAME — `PACT_OF_THE_CHAIN_FORMS`, the eight creatures the Pact of the
   Chain invocation names in its own text (Imp, Pseudodragon, Quasit,
   Skeleton, Slaad Tadpole, Sphinx of Wonder, Sprite, Venomous Snake). Seven
   are not Beasts (fiend, dragon, undead, aberration, celestial, fey) and no
   type or CR filter would reach them; Venomous Snake is a Beast at CR 1/8 and
   intake 1 already has it.

Intake 2 is a literal list of names taken from the feature's own text, never a
widened filter: a creature no feature names stays out. Its entries carry
`pactOfTheChain: true` — the only marker telling them from a Beast, and what
`pactOfTheChainForms()` in src/beasts/beastData.ts filters on. validate-data.js
asserts the flag marks exactly those eight.

Consequence for every consumer: **beasts.json is no longer all Beasts.** A pool
that means "a Beast" must check `type` (`isBeastCreature`) — Wild Shape does,
and so does Find Familiar's own CR 0 pool.

### Items named by a feature — the same second intake

`data/items.json` has the same two-intake shape, for the same reason:

1. by SOURCE — `ALLOWED_SOURCES`, minus `itemGroup` (D34);
2. by NAME — `NAMED_STARTING_EQUIPMENT_ITEMS`, the items a class's or a
   background's `startingEquipment` names that intake 1 would drop. Today that
   is one entry, `Spellbook|PHB`.

The Wizard's `startingEquipment` carries `{special: "Spellbook"}` and the only
Spellbook in the source data is the 2014 one; PHB is deliberately excluded, so
without intake 2 every Wizard starts holding a reference that cannot resolve and
the sheet flags it under D43. PHB is NOT in ALLOWED_SOURCES — this one entry is
in the file because a feature names it, and nothing else from that book follows.

Not the same problem: four codes named by starting equipment resolve against
nothing and stay that way on purpose — `holy symbol|xphb`, `druidic focus|xphb`,
`gaming set|xphb`, `musical instrument|xphb` are `itemGroup` entries, i.e.
categories the player picks a member of, handled by the equipment step's
category picker rather than by extraction.

`scripts/investigate-named-equipment-items.js` reads both findings back out of
the data. validate-data.js asserts each named item is present (and exempts it
from the source allowlist, the only exemption there).

### One field the extraction writes rather than reads

`ATTUNEMENT_RESTORED_ITEMS` sets `reqAttune: true` on the ten elemental Rings of
Resistance (`Ring of Acid/Cold/Fire/Force/Lightning/Necrotic/Poison/Psychic/
Radiant/Thunder Resistance`, all XDMG). The 2024 book requires attunement for
them and the source data omits the field; D80 applies D68 (rules over data) in
the extraction because there is no field to ignore, only a missing one to add.
It runs after the source filter and the superseded-reprint pass, and warns if a
named ring is not found. This is the ONLY place extraction changes a value
rather than selecting, resolving or dropping one.

Closed list. The three other items that lost `reqAttune` between the 2014 and
2024 data (`Eyes of the Eagle`, `Instrument of Illusions`, `Instrument of
Scribing`) really did lose it in the 2024 edition, and the `Ring of Resistance`
itemGroup stays out by D34. validate-data.js asserts all ten are present and
carry the flag.

### Item entry templates (`{#itemEntry ...}`)

An item's `entries` can carry a string like `{#itemEntry Ring of Resistance|XDMG}`.
This is NOT a `{@...}` markup tag — it is a reference to a SHARED description
template. 71 items use it (7 distinct targets): the ten elemental Rings of
Resistance, the ten Potions of Resistance, ten Dragon Scale Mails, the Ioun
Stones, the Absorbing Tattoos, the Scrolls of Protection and three Grenades.
Slice g's markup survey scanned for `{@` alone and missed this shape entirely,
so it reached the sheet verbatim.

The templates live in 5etools' `items-base.json` `itemEntry` list. Extraction
filters that list to `ALLOWED_SOURCES` (dropping the 2014 `|DMG` and `|WBtW`
duplicates) and writes `data/item-entries.json` — 8 templates, `{name, source,
entriesTemplate}`. A template's text carries `{{item.PROP}}` fill-ins read from
the REFERENCING item: `{{item.detail1}}` / `{{item.detail2}}` (the ring's gem,
the dragon's colour, the scroll's creature type) and `{{item.resist}}` /
`{{getFullImmRes item.resist}}` (the damage type, joined into an English list).

Resolution is at RENDER time, in `src/inventory/itemEntryResolver.ts` — not in
the markup renderer (D7 keeps that free of cross-file lookup, the same split as
`src/featureResolver/`). `resolveItemEntryRefs` replaces the reference with the
filled template before `<Entries>` sees it. A reference with no matching
template renders as a visible, named note (D43), never braces.

`extract-data.js` warns on any `{#itemEntry}` in items.json with no template;
`validate-data.js` fails on it. `survey-markup.js` now scans all three sigils
(`{@}`, `{#}`, `{{}}`) so a new shape lands in MARKUP-INVENTORY.md, not on a
player's screen.

The same survey turned up ONE other non-`{@` shape: `{{spellcasting_mod}}`, in
`spells.json` Green-Flame Blade's `scalingLevelDice` (4 occurrences, keys
1/5/11/17). `SpellList.tsx` renders that scaling line as plain text, so the
token reaches the DOM verbatim for a character who has that one cantrip. It is a
different mechanism (a per-character computed modifier, not a data lookup) and is
NOT fixed by the itemEntry work — left as a known gap.

## Output files

Counts as of the `reprintedAs` deduplication + languages addition (before ->
after shown where a category changed; unchanged categories listed too):

  data/feats.json               138 -> 128  (XPHB 80, EFA 28, XGE 15, TCE 15->5)
  data/spells.json              508 -> 489  (XPHB 391, XGE 95->85, TCE 21->12, EFA 1)
  data/species.json              87 -> 78   (XPHB 34, MPMM 44->35, EFA 9)
  data/backgrounds.json          33 -> 33   (XPHB 16, EFA 17) — unchanged
  data/classes.json             127 -> 127  (13 classes + 114 subclasses) — unchanged
  data/class-features.json      279 -> 302  (features reached only via a
                                      ref* node inside another feature's
                                      text, see "Traps" below)
  data/subclass-features.json   465 -> 786  (same cause)
  data/optional-features.json   131 -> 120  (XPHB 58, TCE 47->38, XGE 22->20, EFA 4)
  data/items.json               943 -> 900  (XDMG 593, XPHB 217, TCE 84->80,
                                      XGE 43->3, EFA 6, PHB 1 — the named
                                      Spellbook, see "Items named by a feature")
  data/languages.json             0 -> 19   (XPHB 19) — new category
  data/item-entries.json          0 -> 8    (XDMG 7, TCE 1) — new category;
                                      the {#itemEntry} description templates,
                                      see "Item entry templates" below
  data/beasts.json               89 -> 96   (XMM 96) — 90.3 KB; type Beast at
                                      CR <= 6 (89) plus the 8 Pact of the
                                      Chain forms, 7 of them not Beasts, D67
  data/actions.json               0 -> 18   (XPHB 18) — 15.5 KB, new category;
                                      XPHB only, D187 (see "actions.json" below)

  data/conditions.json            0 -> 15  (XPHB 15) — new category, R12/D214
                                      (see "conditions.json" below)
  data/rules.json                 0 -> 7+4+18 (XPHB, 8.5 KB) — new, R15/D223
                                      (see "rules.json" below)

D194 (RHW + subclass reprint dedupe), before -> after:

  data/feats.json               128 -> 139  (+RHW 11)
  data/species.json              78 -> 81   (+RHW 3: Hexblood, Lupin, Reborn)
  data/backgrounds.json          33 -> 37   (+RHW 4)
  data/classes.json             127 -> 115  (13 classes + 102 subclasses:
                                      XGE 31->25, TCE 30->17, +RHW 7)
  data/subclass-features.json   786 -> 685  (+44 RHW, -145 of the dropped
                                      subclasses)
  data/items.json               900 -> 902  (+RHW 2)
  spells, class-features, optional-features, languages unchanged.

The drops are entries superseded by a newer reprint we also keep (e.g. TCE
"Chef" superseded by its XPHB reprint) — see extract-data.js's
`removeSuperseded()` and "Nine species names occur twice" below. `validate-data.js`
now asserts these counts and checks that no superseded duplicate survives.

### conditions.json (R12, D214)

Source: `conditionsdiseases.json`, key `condition` (30 entries; the file also
holds `disease` 29 and `status` 5, both ignored). It has 15 PHB and 15 XPHB
entries under the same 15 names; only XPHB is kept, the PHB duplicates are
ignored. Kept fields: `name`, `source`, `entries` (the source `page`, `srd52`
and `basicRules2024` are dropped). `entries` is a string plus nested
`{type:"entries", name, entries}` blocks. Markup tags present in the XPHB texts:
`{@action}`, `{@variantrule}`, `{@status}`, `{@condition}` — all already handled
by src/markup/tags.ts. The sheet's Exhaustion chip text "−2N d20 · −5N ft" is
computed in code, not read from data (D214).

### rules.json (R15, D223)

One object, not an array: `{ variantrule, sense, skill }`, each a list of
`{ name, source, entries }`, XPHB only. Sources: `variantrules.json` (7 XPHB
Rules Glossary entries, ruleType "C": Saving Throw, Skill, Expertise,
Proficiency, Armor Training, Weapon, Passive Perception), `senses.json` (4 XPHB:
Blindsight, Darkvision, Tremorsense, Truesight), `skills.json` (all 18 XPHB).
Survey (scripts/investigate-rule-texts.js, 2026-09-29): every entry is real text,
no `_copy`; lengths 43–871 characters (skill texts are one sentence, 43–77).
Tags used: `{@variantrule}`, `{@book}`, `{@filter}`, `{@item}`, `{@skill}`,
`{@dice}`, `{@condition}` — all handled by src/markup/tags.ts. Nested entry
types: only `list`/`item`. The XPHB glossary has no entry with "Tool" or
"Language" in its name, and none named Darkvision/Blindsight/Tremorsense/
Truesight/Proficiency Bonus — the sense texts come from senses.json instead.
validate-data asserts the exact name sets.

Feature origin (2026-09-21, one-off survey): all 302 class-features records
carry `className` and a numeric `level`; all 786 subclass-features records
also carry `subclassShortName`. The sheet's origin label ("Fighter 2",
"Champion, Fighter 3") reads these, so every granted class/subclass feature
has one. Optional-feature picks have no such level (D99 — a wizard pick
records none), and species traits are not listed on the sheet at all.

## Traps — things that silently break

### A subclass's `reprintedAs` is its 4-part uid, not "name|source"
Subclass reprint targets read `shortName|className|classSource|source`
("Shadow|Sorcerer|XPHB|RHW"). Split on the last `|` they give the "name"
"Shadow|Sorcerer|XPHB", which never equals a subclass name, so until D194
`removeSuperseded` and validate's `checkNoSupersededDuplicates` never dropped a
superseded subclass. Both now key subclasses on the 4-part uid. The fix dropped
19 subclasses (their features follow, being kept by reference): TCE Alchemist,
Armorer, Artillerist, Battle Smith (→ EFA), Stars, Psi Warrior, Mercy, Glory, Fey
Wanderer, Soulknife, Aberrant Mind, Clockwork Soul (→ XPHB), Phantom (→ RHW); XGE
Zealot, Glamour, Gloom Stalker, The Celestial (→ XPHB), Grave, Shadow Magic (→
RHW). All were already hidden by the app's `!reprintedAs`. A subclass whose
target is not loaded (Bladesinging → FRHoF) stays in the data, still hidden.

### Blank source means PHB, not "same as this"
In class-feature references AND item codes, a blank/missing source
defaults to the 2014 PHB. "Second Wind|Fighter||1" is the 2014 fighter.
Bare item type "M" is the 2014 melee weapon; "M|XPHB" is the 2024 one.

### Features referenced from inside another feature's text aren't in any ID list
A class/subclass only lists the features it grants directly
(`classFeatureIds`/`subclassFeatureIds`). A feature's own TEXT can link to
another feature via `{@classFeature ...}`/`{@subclassFeature ...}` markup
(a `refClassFeature`/`refSubclassFeature` node in `entries`) — e.g. Circle
of Spores links to "Circle Spells", "Halo of Spores", "Symbiotic Entity".
Filtering by the ID lists alone misses these entirely. Collection must walk
every kept feature's `entries` for such nodes and pull the target in too,
repeating until the set stops growing (a newly-added feature can reference
another one) — one extra level is enough in practice, but nothing bounds it
except that features are only ever added once.

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

### Spell availability: `availableTo.classes` vs `availableTo.classVariants`
XGE and TCE spells were never on core class lists — they're granted as
optional/variant content and land in `availableTo.classVariants`, not
`availableTo.classes`. Both fields sit nested one level under a spell's
`availableTo` object, not top-level.
91 spells have an empty `classes` array but a populated `classVariants`;
0 have no availability at all (measured against the current filtered
data/spells.json, 489 spells — an older 109 figure was measured against a
larger/unfiltered set).
The UI must read both, ideally flagged differently, or every XGE/TCE
spell will look uncastable.

### Third-caster spell slots live on the subclass, not the base class
Eldritch Knight (Fighter) and Arcane Trickster (Rogue) keep their spell-slot
table under `subclassTableGroups` on the SUBCLASS entry, not under
`classTableGroups` on the base class where every other class's slot table
lives. Row shape matches the base-class tables (one row per character level,
per-spell-level slot counts, only reaching spell level 4). Of all 114
subclasses checked, these are the only two with their own slot table. Code
reading spell slots must fall through to the subclass's `subclassTableGroups`
when the base class has none.

### `casterProgression` names a table, not a class
`casterProgression` (data/classes.json) names a shared spell-slot
progression TABLE, not a class. Paladin and Ranger both carry the value
"artificer" — the same value the actual Artificer class carries — because
all three are half-casters sharing one slot progression. Code reading this
field must treat the value as a table name, never as a class-identity
check. Values seen: "full", "pact" (Warlock), "artificer" (Artificer,
Paladin, Ranger), "1/3" (Eldritch Knight, Arcane Trickster — carried on
the subclass entry, see "Third-caster spell slots" above). Non-casters
(Barbarian, Fighter, Monk, Rogue) have no `casterProgression` field at all.

### Pool maxima live in table groups, not on any feature record
No feature record (class-features.json, subclass-features.json, feats.json,
optional-features.json) carries a maximum for the pool it spends — confirmed
by enumerating every top-level key across all 1336 records in the four files;
no uses/max/recharge field is among them. Where a maximum exists, it lives in
`classTableGroups` in classes.json, one row per character level 1 to 20 — so
every such maximum scales with level. Psi Warrior and Soulknife are the two
exceptions: their pool's table sits in `subclassTableGroups` on the subclass
entry instead, the same split as "Third-caster spell slots" above. A cell in
one of these rows can be a plain number, a numeric string, a
`{type:"dice",toRoll:[{number,faces}]}` object, a `{type:"bonus",value}`
object, a `{type:"bonusSpeed",value}` object, or the literal `"—"`.

Psi Warrior's and Soulknife's own columns are `{@tip}` tags whose DISPLAYED
label differs from the pool name: `{@tip Die Size|Psionic Energy Die Size}`
renders as "Die Size" while the pool name sits in the tag's SECOND segment.
This is the first place in this project where a column's label and its key
differ — a lookup that reads the label finds nothing; it must read the tag's
second segment instead.

Separately, `consumes.name` on a feature is singular while the matching table
column label is plural ("Sorcery Point" against "Sorcery Points"), so any
lookup between the two needs normalisation.

The `{@tip}` split above is only half a match. Psi Warrior's pool is consumed
as "Psionic Energy Die" and tabled as "Psionic Energy Die Number" beside a
"Psionic Energy Die Size" column that holds a die, not a count — so a lookup
must also try the name plus a " Number" suffix, and must not settle for the
"Size" column. Soulknife consumes the SAME pool name ("Psionic Energy Die")
but tables it as "Soulknife Energy Die Number": the column carries the
subclass's name, not the pool's, so no normalisation reaches it and a
Soulknife's maximum reads as not in the data. Two subclasses, two conventions,
one pool name.

Only the `{@tip}` tag puts its key in the SECOND segment. Every resource
column outside those two subclasses is a bare string ("Rages", "Focus Points",
"Second Wind", "Channel Divinity", "Wild Shape", "Favored Enemy", "Sorcery
Points"); `{@filter Cantrips|spells|…}` columns, which are spell counts and not
resources, are keyed by their FIRST segment. A reader that takes the second
segment of every tag gets "spells" for all of them.

### Which features are limited-use resources — `consumes` plus a phrase test
Two structural signals, neither sufficient alone (step 9b1 investigation):

1. `consumes.name` names a pool something spends. Exactly 8 exist across the
   four feature files: Arcane Shot, Channel Divinity, Focus Point, Ki, Psionic
   Energy Die, Sorcery Point, Superiority Die, Wild Shape. This finds the
   spenders' pool but never a feature that limits only itself.
2. A rest tag plus an expended-uses phrase in the feature's own text
   (`expended use(s)`, `regain … uses`, `number of times equal to`, or "you
   can't do so again until you finish"). 92 class/subclass/optional/feat
   records match.

`consumes` does NOT list every spender. 24 class/subclass features spend one of
the 8 pools in prose only, with no `consumes` naming it
(`scripts/investigate-prose-pool-spends.js`, 2026-09-26, D196; match =
spend/expend within 40 characters of the pool name):

- Pool definers / general rules: Font of Magic, Metamagic, Monk's Focus,
  Psionic Power (Psi Warrior, Soulknife).
- Fixed cost: Beasts of Ill Omen (Shadow RHW 6, 3 SP), Revelation in Flesh
  (Aberrant 14, 1 SP), Heightened Focus (Monk 10, 1 FP), One with the Blade
  (Kensei 6, 1 ki), Radiant Sun Bolt (Sun Soul 3, 1 ki), Rend Mind (Soulknife
  17, 3 PED), Oceanic Gift (Sea 14, 2 Wild Shape), Wild Resurgence, Wild
  Companion, Nature's Sanctuary, Land's Aid, Wrath of the Sea (1 Wild Shape
  each), Divine Reaper (Grave RHW 17, 1 Channel Divinity), Know Your Enemy and
  Relentless (Battle Master, 1 Superiority Die).
- Variable cost: Arcane Apotheosis, Psionic Sorcery, Searing Sunburst,
  Flurry of Healing and Harm.

Only three spell grants carry a structured cost, via an additionalSpells
`resource` wrapper + `resourceName`: Summon Beast (Shadow Sorcery 6, Sorcery
Point 3), Burning Hands (Sun Soul XGE 6, Ki 2), Darkness (Warrior of Shadow
XPHB 3, Focus Point 1). The feature-row counter never reads `consumes.amount`.

The rest tag ALONE is far too broad, which is why D86's `isActionTableFeature`
cannot be reused: Weapon Mastery carries it ("you can change your choices
whenever you finish a Long Rest") and is not a resource. The phrase test is
what separates it from Rage, Second Wind, Favored Enemy and Action Surge.

The union is 97 distinct resource names after merging Ki into Focus Point —
an order of magnitude more than the "roughly 8" the step 9 planning assumed,
because most rest-limited features are subclass-level and were never counted.
Only 8 of the 97 have a maximum in a per-level table (Channel Divinity,
Favored Enemy, Focus Point, Psionic Energy Die on Psi Warrior only, Rage,
Second Wind, Sorcery Point, Wild Shape). Every other maximum is stated in
prose alone ("equal to your Charisma modifier", "twice"), so a structured
reader must report it as not in the data (D43) rather than parse it.

Action Surge is one of those prose-only ones, despite being a Fighter core
feature beside Second Wind: XPHB Fighter's only table group is
`["Second Wind", "Weapon Mastery"]`, no column in classes.json mentions
"surge", and neither Action Surge record (XPHB 2, 17) has `consumes` or any
count field. The count lives in two sentences: "can't do so again until you
finish a Short Rest or Long Rest" and, at 17, "use it twice before a rest".

Of the 92 self-limited names (rule 2 above, grouped by feature name across
the four files), 5 have a table column, 36 lack the single-use sentence
("can't do so / use it / use this feature again until you finish a Short/Long
Rest"), 18 have it but name a stat, "modifier" or "proficiency" somewhere in
their text, 9 have it but state a count ("twice", "uses", "N times", "number
of times"), and 24 have it with none of those. Of the 18 "stat" features, 17 name
the stat only as a save DC, an attack bonus or a damage formula, never as the
number of uses (D119), so they count as single-use too; the remaining one,
Aberrant Dragonmark, is excluded for another reason (below). Action
Surge sits in the "count" group because the level-2 record already
carries the level-17 "twice" sentence. A Proficiency
Bonus reference is `{@variantrule Proficiency|XPHB|Proficiency Bonus}`, which
strips to "Proficiency" — a search for "proficiency bonus" in stripped text
misses it.

The implicit single-use set, as classified (D119) — 24 + 17, minus Natural
Recovery, is 40:

- The 23 of the 24 that remain: Divine Intervention, Uncanny Metabolism, Stroke
  of Luck, Sorcerous Restoration, Magical Cunning, Arcane Recovery, Chemical
  Mastery, Zealous Presence, Rage of the Gods, Mantle of Majesty, Know Your Enemy,
  Elder Champion, Psychic Veil, Trance of Order, Clockwork Cavalcade, Dragon
  Wings, Tamed Surge, The Third Eye, Illusory Self, Eldritch Cannon, Telekinetic
  Movement, Boon of Recovery, Greater Mark of Scribing.
- The 17 once excluded by a stat mention: Avenging Angel, Beguiling Defenses,
  Beguiling Magic, Bulwark of Force, Clairvoyant Combatant, Greater Mark of
  Hospitality, Hand of Ultimate Mercy, Holy Nimbus, Hurl Through Hell,
  Intimidating Presence ("Wisdom saving throw (DC 8 plus your Strength
  modifier…)"), Living Legend, Mage Slayer, Rend Mind, Searing Vengeance, Spell
  Thief, Unbreakable Majesty, Warping Implosion.
- Excluded on purpose, no tracker: Aberrant Dragonmark and Natural Recovery. A
  single record carries TWO independent recharge limits — Aberrant Dragonmark
  a Long-Rest-only ability and a separate Short-or-Long-Rest spell use, Natural
  Recovery a free Circle-spell cast and a separate slot-recovery recharge — so a
  max-1 tracker would conflate them. Natural Recovery was in the first 24 and is
  now removed. Both stay "not in the data" until a feature can carry more than
  one resource. The exclusion is by name (`TWO_INDEPENDENT_LIMITS`), since nothing
  in the text tells them apart from a genuine single use.

The 9 "count" features, re-examined (D120). Only 2 state a real count of their
own uses: Action Surge ("twice before a rest" from 17) and Indomitable ("twice
before a Long Rest starting at level 13 and three times … starting at level
17"); every record of each (2 and 3 records) carries the full text. The other 7
matched on something else:

- A multiplier, not a count: Superior Atlas ("twice your Artificer level"),
  Undying Sentinel ("three times your Paladin level"), Psi-Powered Leap ("twice
  your walking speed" / "twice your Speed").
- "uses" of a different pool: Persistent Rage ("regain all expended uses of
  Rage"), Wild Resurgence and Archdruid ("uses of Wild Shape"). In both of the
  last two only one clause is rest-limited; the rest is unlimited or once per
  turn.
- A verb: Magic Item Tinker ("that uses charges") — and it has two
  independent Long-Rest limits (Drain, Transmute) plus an unlimited Charge.

`STATES_A_COUNT` now matches only "number of times|uses", "twice|thrice|N
times" not followed by "your", and "N uses" not followed by "of". The 6 of
the first two bullets are single-use (46 in all); Magic Item Tinker joins
`TWO_INDEPENDENT_LIMITS`. Action Surge and Indomitable read a hand-written
Fighter-level table, `LEVEL_SCALED_USES` (D120): 1/2 at 2/17 and 1/2/3 at
9/13/17.

9 recharge on a Short Rest: the 7 below plus Action Surge and Psi-Powered
Leap ("… until you finish a Short Rest or Long Rest"), for which the whole pool
comes back. Indomitable's recharge is Long Rest only.

7 of the 40 recharge on a Short Rest — Stroke of Luck, The Third Eye, Illusory
Self and Telekinetic Movement ("can't use it again until you finish a Short
Rest or Long Rest"; Telekinetic Movement adds "unless you expend a Psionic
Energy Die"), plus Clairvoyant Combatant, Mage Slayer and Unbreakable Majesty
(D119). Their sentence is neither `regain all|one` ordering, so
`shortRestRecovery` reads them as null; the recovery for these comes from
`singleUseRechargesOnShortRest` instead (a Short Rest returns the one use).
Sorcerous Restoration and Arcane Recovery name a Short Rest only as when you
may act ("When you finish a Short Rest, you can…"); their recharge sentence is
Long Rest only, so they are not among the 7. The other 33 name no Short Rest
in the recharge. `resources.test.ts` guards all of this against the real data.

Other recharge phrasings (D197, `scripts/investigate-strength-of-grave.js`).
"can't X again until you finish a Short/Long Rest" with X outside "do so / use
it / use this feature", across the four feature files: 8 phrasings, 11 hits.

- "use this benefit" ×2 — Power of Shadow|RHW (Strength of the Grave) and
  Ritual Caster|XPHB (Quick Ritual). Both rest-tagged, Long Rest only; since
  D197 in the regexes, one use each. Whispers of the Dead|RHW also says "use
  this benefit again", but about re-choosing a proficiency, with no rest clause.
- "do so in this way" ×2 (Contact Patron|XPHB, Telekinetic Master|XPHB), "cast
  that spell in this way" ×2 (Fey-Touched, Shadow-Touched), "cast them in this
  way" ×1 (Signature Spells) — free spell casts, left to the spell-usage path
  (Contact Patron's counter is D193's); whether each of the others has a
  counter was not checked.
- "create it" ×1 (Arcane Ward|XPHB) — a real 1/LR, not tracked.
- No rest tag, so never self-limited whatever the phrase: "use the feature"
  (Accursed Specter|XGE), "enter" (Bottled Respite|TCE), "cast it in this way"
  (Undying Servitude|TCE).

No mechanism splits a record's named `entries` sub-entries into separate
records: the resolver, the Features tab and resources.ts all see "Power of
Shadow" whole. "Eyes of the Dark" as a provenance name is only a string in
`CLASS_SENSE_GRANTS` (D195).

### What a rest gives back is only in the prose, and it is not "all"
The rest TAG says a feature cares about rests, never how much one returns
(step 9b5 investigation). Every short-rest-recoverable pool carries BOTH tags,
because one sentence names both rests. The amount is in the sentence only, in
two orderings:

```
"You regain one expended use when you finish a {@variantrule Short Rest|XPHB},
 and you regain all expended uses when you finish a {@variantrule Long Rest|XPHB}."   (Rage)
"…unavailable until you finish a {@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB},
 at the end of which you regain all your expended points."                            (Monk's Focus)
```

For the 8 resources with a computed maximum, what a Short Rest returns:

| Resource | Short Rest | Where the sentence is |
| --- | --- | --- |
| Channel Divinity | one use | Channel Divinity (Cleric and Paladin) |
| Favored Enemy | nothing | Favored Enemy (Long Rest only) |
| Focus Point / Ki | ALL | Monk's Focus |
| Psionic Energy Die | one die | Psionic Power (XPHB Psi Warrior and Soulknife) |
| Rage | one use | Rage |
| Second Wind | one use | Second Wind |
| Sorcery Point | nothing | Font of Magic (Long Rest only) |
| Wild Shape | one use | Wild Shape |

Warlock Pact Magic recovers ALL slots on a Short Rest ("You regain all expended
Pact Magic spell slots when you finish a Short Rest or Long Rest"); Wizard-style
Spellcasting says Long Rest only, which is D11's split confirmed in the text.

Three traps in reading it:

1. The defining feature is often NOT named after the pool — Monk's Focus,
   Psionic Power, Font of Magic. Matching by feature name alone finds nothing
   for three of the eight.
2. The pool is recovered in the PLURAL the consumer does not use: "Psionic
   Energy Dice" against `consumes.name` "Psionic Energy Die". Stripping a
   trailing `s` is not enough; `dice` → `die` is needed.
3. A loose "rest … regain" window swallows the `, and you regain all … Long
   Rest` half of the first ordering and reports every one-use pool as fully
   restored. The reversed ordering must be matched by its exact phrase
   ("at the end of which you regain").

TCE's Psionic Power reads as no short-rest recovery, correctly: its short-rest
sentence is the once-per-rest bonus action, not the pool refill, and it uses
lowercase "short or long rest" with no variantrule tag.

### Armour AC — the data won't tell you
`ac` is the base number. There is NO Dex cap field; the cap is implied by
the armour type code (LA light = uncapped, MA medium = +2, HA heavy = none).
The AC calculation must hardcode that rule.
`strength` is a string ("13") or null; `stealth: true` means disadvantage.

### Magický předmět se pozná podle `rarity`, ne podle jiných polí

Obyčejná zbraň nebo výbava má `rarity: "none"`. Cokoli jiného je magické.

Ověřeno na 92 předmětech nesoucích mastery: 49 z nich mělo `rarity: "none"`
a žádný z nich zároveň nenesl `reqAttune`, `wondrous`, `tier`, `baseItem`
ani `bonusWeapon`. Zbylých 43 magických zahrnuje i tři s rarity `"common"` —
takže „common znamená obyčejný" NEPLATÍ.

Pole jako `reqAttune` nebo `bonusWeapon` fungují jako indicie, ale ne jako
spolehlivý test: magický předmět bez attunementu a bez bonusu k útoku je
běžný. Test je `rarity`.

Poprvé potřeba u weapon mastery pickeru, který jinak nabízel volbu mastery
pro Sun Blade postavě na první úrovni. Inventář (krok 7) tenhle rozdíl
potřebuje na každém kroku.

### Identifying item kinds — the flags cover only MUNDANE gear

Zbraň a zbroj se NEPOZNAJÍ spolehlivě podle příznaků `weapon` / `armor`.
Ty nese jen obyčejné vybavení: 46 zbraní a 12 zbrojí.

**49 magických zbraní a 12 magických zbrojí ten příznak nemá** a poznají se
jen podle kódu v `type` — `M`/`R` u zbraní, `LA`/`MA`/`HA` u zbroje. Test na
druh předmětu proto musí číst obojí, příznak i `type`; jinak z každé nabídky
vypadnou všechny magické zbraně a zbroje.

Štíty nemají příznak — poznají se podle kódu `S`; jejich `ac` je vždy 2, tedy
bonus, ne výsledná hodnota.
Kontejnery nemají příznak — poznají se podle přítomnosti `containerCapacity`
(19 předmětů).

Zjištěno při průzkumu před krokem 7; původní znění tvrdilo, že příznaky stačí.

### Item filter kinds (R10a)

Průzkum `scripts/investigate-item-filter-kinds.js` nad data/items.json (947
předmětů) pro filtry panelu Add Items:
- Potion, Ring, Rod, Scroll, Wand mají vlastní kód v `type`: `P` (45), `RG`
  (37), `RD` (11), `SC` (31), `WD` (20). Všechny jsou magické.
- Hůl (staff) kód NEMÁ. Pozná se jen podle příznaku `staff: true` (27): 26
  magických holí má kód `M` (jsou to zároveň zbraně), obyčejná Staff|XPHB má
  kód `SCF`. Hůl proto patří do dvou filtrů, Weapon i Staff.
- Wondrous = příznak `wondrous: true` (325): 271 předmětů bez `type` (každý
  předmět bez `type` je wondrous, včetně 27 tetování), 39 `SCF`, 15 `INS`.
  Žádný wondrous předmět nemá příznak `weapon`/`armor`.
- Magický vs. obyčejný = `rarity`. Hodnoty: none 405, common 61, uncommon 136,
  rare 163, very rare 108, legendary 52, artifact 19, unknown 3. `unknown` mají
  jen 3 alchymistické spotřebáky ze SCC (Alchemist's Doom, Catapult Munition,
  Murgaxor's Elixir of Life, kód `G`) — počítají se jako obyčejné. Žádný
  předmět s `rarity: "none"` nemá `reqAttune` ani magický bonus.
- ItemRef nese `wondrous`, `staff` a `rarity`; třídění dělá
  `itemFilterKindsOf` / `isMagicItem` (src/inventory/inventoryData.ts).

### Ammunition and charges — the only structured spend-and-refresh fields
`ammoType` on a weapon names the exact ammunition item code that weapon
consumes — a direct item-to-item link, no name matching needed.

Confirmed for slice 9d3 (`scripts/investigate-ammo-pairing.js`, over
data/items.json):
- `ammoType` is a lowercase `"name|source"` string ("arrow|xphb") on 17 items,
  all type `R` (9 XPHB, 8 XDMG). 6 distinct values, and every one equals the
  key of exactly one item: Arrow, Bolt, Sling Bullet, Needle, Firearm Bullet
  (type `A`) and Energy Cell (XDMG, type `AF`).
- The link is ONE-WAY. The 12 ammunition items (`A`/`AF`) carry no `ammoType`,
  no `baseItem`, no `bonusWeapon` and no `quantity`; there are no "+1 arrow"
  items at all (0 names with a +N and ammunition). A "+1 arrows" row can only
  be a player-set `magicBonus` on the plain item.
- **The starting equipment does not hand out `Arrow`.** Every class and
  background that starts with arrows gets the PACK "Arrows (20)" x1, likewise
  "Bolts (20)" — a separate item with its own key. Matching a weapon on
  `ammoType` alone finds nothing in a fresh character's inventory.
- Ammunition packs carry `packContents`: `[{ "item": "arrow|xphb",
  "quantity": 20 }]` — `item` is exactly the weapon's `ammoType` key. 5 packs
  (Arrows 20, Bolts 20, Firearm Bullets 10, Needles 50, Sling Bullets 20), each
  with one entry. 13 items carry the field, the other 8 are type `G` gear
  packs that list ordinary equipment — those are not ammunition and must not be
  read as a source of it (hence the `A`/`AF` type gate). The count in the pack
  name ("(20)") is prose; read `quantity` instead.
- Thrown weapons carry no `ammoType` — the weapon itself is the thing thrown.
- `validate-data` guards both links (every `ammoType` and every ammunition
  `packContents.item` names an existing item).

Separately, `charges` / `recharge` / `rechargeAmount` on items are the only
fully structured spend-and-refresh fields anywhere in the data set;
`recharge`'s only value is `"dawn"`.

### Item `ability` — ability-score changes (survey R14e1)
`scripts/investigate-item-ability-scores.js`. Source items.json: 72 items carry
`ability`; data/items.json keeps the field untouched (the extractor copies whole
entries): 32 items. The app's `extractItemRefs` (src/inventory/inventoryData.ts)
does NOT carry it onto `ItemRef` today. Shapes in data/items.json (all XDMG):
- `{ static: { str: 21 } }` — set to N. 16 items: Amulet of Health (con 19),
  Headband of Intellect (int 19), Gauntlets of Ogre Power (str 19), Hand of
  Vecna (str 20), six Belts of Giant Strength (21–29) — all attunement — and six
  **Potions of Giant Strength** (21–29), no attunement: a consumable, its
  `static` is a temporary effect of drinking, not of carrying.
- `{ <abi>: N }` — flat addition, always +2. 14 items: Belt of Dwarvenkind
  (con), six Ioun Stones (Agility, Fortitude, Insight, Intellect, Leadership,
  Strength), Book of Exalted Deeds (wis) — all attunement — and six one-time
  books without attunement (Manual of Bodily Health / Gainful Exercise /
  Quickness of Action, Tome of Clear Thought / Leadership and Influence /
  Understanding). **No maximum is in the data**: the cap exists only in prose,
  and every one of the 14 has a "maximum of N" phrase — 20 for the Belt and the
  Ioun Stones, 24 for Book of Exalted Deeds, 30 for the six books.
- `{ choose: [{ from: [6 abilities], count: 1, amount: 2 }] }` — Book of Vile
  Darkness (attunement): player picks the ability.
- `{ from: [6 abilities], count: 1, amount: 2 }` (no `choose` wrapper) — Deck of
  Many Things: a one-time card effect, not a carried bonus.
- Source-only shapes in dropped books: `static{cha}` (Sword of Zariel|BGDIA),
  `choose` without `amount` (Deck of Several Things|LLK).
- No item in data/items.json describes a score change in prose without the field
  (phrase search over stripped markup: 0).
- **`abilityMax` (derived, R14e1/D221).** extract-data.js adds `abilityMax: N` to
  every item with the additive shape, read from its own "maximum of N" sentence
  (markup stripped). 14 items carry it (20 / 24 / 30 as above); `static`,
  `choose` and `from` items never do. validate-data fails if an additive item
  lacks it. The app's `extractItemRefs` turns `ability` into
  `ItemRef.abilityEffects` (set / add+max) or `abilityChoice` (choose); `from` is
  not read.

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

### Saving throw proficiency u tříd — pole se jmenuje `proficiency`

V classes.json stojí savy, ve kterých třída dává proficiency,
v top-level poli `proficiency` — NE ve `startingProficiencies.savingThrows`,
které neexistuje. Dvouprvkové pole malými písmeny: ["str", "con"].
Stejný tvar u všech 13 základních tříd.

### Multiclass prerequisites and picks — `primaryAbility`, `multiclassing.proficienciesGained` (M7b, D330)

Survey `scripts/investigate-multiclass-entry.js` over the 13 classes the creation picker offers (12 XPHB + Artificer EFA):

- Every class has a top-level `primaryAbility`: an array of objects, keys are 3-letter codes with `true`. Array = OR,
  keys inside one object = AND. Fighter `[{str},{dex}]` = STR or DEX; Monk `[{dex,wis}]` and Ranger `[{dex,wis}]` =
  DEX and WIS; Paladin `[{str,cha}]` = STR and CHA; the rest one ability (Artificer int, Barbarian str, Bard cha, Cleric
  wis, Druid wis, Rogue dex, Sorcerer cha, Warlock cha, Wizard int). `multiclassing.requirements` does not occur.
- The choice part of `proficienciesGained` has two shapes only: `skills: [{choose:{from,count:1}}]` (Artificer 7, Bard
  18 = every skill, Ranger 8, Rogue 10 skills, lowercase like class skills) and `toolProficiencies: [{anyMusicalInstrument:1}]`
  (Bard). Every other `toolProficiencies` key is a fixed `true` (Rogue thieves' tools, Artificer tinker's tools).
  Barbarian, Cleric, Druid, Fighter, Monk, Paladin, Sorcerer, Warlock, Wizard choose nothing.

### Warlock patron spells keyed by pact slot rank
Warlock patron spells keyed by pact slot rank. Celestial, Hexblade, and Fathomless keep their always-prepared patron spells under `additionalSpells.expanded` keyed by PACT SLOT RANK ("s1".."s5") rather than by character level, unlike every other always-prepared source. Rank R unlocks at the character level where the Warlock's Pact Magic slot level first reaches R (1st→s1, 3rd→s2, 5th→s3, 7th→s4, 9th→s5). Code resolving these must translate rank to character level via the Pact Magic slot progression (src/calculation/spellSlots.ts) rather than treating the key as a character level. The Genie uses a different, per-genie-kind shape and is not covered by this.

### Limit uvnitř feature nemusí být v próze — může být v tabulce

Wild Shape nese svoje limity (počet známých forem, maximální CR, od které
úrovně je povolená forma s Fly Speed) jako `table` uzel uvnitř `entries`
feature, ne jako prózu a ne jako strukturované pole na feature samotné.

Skript, který prochází jen `entries` a `items`, ten uzel nevidí a dojde
k závěru, že limit v datech není. U Wild Shape se to jednou stalo a vedlo
to k závěru, že se musí všechno natvrdo opsat z knihy. Než se limit
prohlásí za neexistující, musí se projít i tabulkové uzly.

Buňky takové tabulky navíc můžou nést `{@filter}` řetězce, které samy
o sobě nesou podmínky — u Wild Shape `miscellaneous=!swarm` (roje nejsou
legální forma) a `speed type=!fly` na řádcích pod 8. úrovní. Tyhle
podmínky nejsou nikde jinde v textu feature napsané.

### Activation cost — tags, not fields (R5b, D182)

No feature record carries a structured activation cost. It is only in the text, as `{@variantrule Bonus Action|…}`, `{@variantrule Reaction|…}` or `{@action X|…}` (the Attack/Dash/Magic… action). There is **no `{@variantrule Action}` tag** anywhere — a plain Action is only ever `{@action X} action` or untagged prose. A tag's first occurrence is often a trigger ("when you take a Reaction"), not the activation, which is why D182 matches frames around the tag rather than the first tag (scripts/investigate-r5b-action-types.js).

- **Feats** always nest their activation tag in a named sub-entry (`{type: "entries", name: …}`), never in the top-level string; a walk that reads only top-level strings finds none.
- **26 in-scope TCE/XGE records** carry no activation tag at all — 2014-era prose ("as a bonus action"). They classify as Other.
- **Channel Divinity** (XPHB Cleric/Paladin) has no activation of its own; its effects are separate records reached through `refClassFeature` (Divine Spark, Turn Undead) and each carries its own `{@action Magic}` frame.
- **Spells' `time`** is always structured: every spell has a `time` array, units `action`/`bonus`/`reaction`/`minute`/`hour`; exactly 1 spell has two entries; all 6 `reaction` entries carry a `condition` string (the trigger).

### `damageInflict` and the `choose` spell-prerequisite filter grammar

A spell's `damageInflict` (array of damage types, absent when the spell deals none) is how "deals damage" is read structurally — never from a hand-written list of spell names (D21).

`conditionInflict` is kept in `spells.json` too (the spell extractor keeps whole records): 98 of 489 spells, always an array of lowercase condition names ("paralyzed", "unconscious"), absent otherwise. 165 leveled spells carry `damageInflict`; 55 more leveled spells carry only `conditionInflict`. `scalingLevelDice` is not on every damage cantrip: XPHB Eldritch Blast has none (its extra beams are prose). R7a reads both arrays for the Spells tab's Effect column (D189; `scripts/investigate-spell-condition-inflict.js`, not kept).

### Leveled spell dice — `{@damage}` in entries, `{@scale…}` in entriesHigherLevel (R8a, D206)

Survey of data/spells.json (`scripts/investigate-leveled-spell-dice.js`), 465 leveled spells:

- **No leveled spell has `scalingLevelDice`** (cantrips only).
- **Base dice** are only `{@damage X}` tags in `entries` (179 leveled spells, 228 tags; up to 5 per spell — Divine Smite 2d8 + 1d8 vs Fiend/Undead, Ice Knife 1d10 + 2d6). No `{@damage}` carries a pipe. All values are `NdM` or `NdM + K` except Chaos Bolt `2d8 + 1d6`. `{@dice X}` also appears in entries, mostly for non-effect rolls (Confusion behaviour table, Bless 1d4, Chaos Bolt `d8` type roll).
- **Scale tags** sit only in `entriesHigherLevel`, never in `entries`: 92 spells — `{@scaledamage BASES|LEVELS|INC}` (85) or `{@scaledice …}` (7, all healing and all `miscTags` HL: Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word, Prayer of Healing, Healing Spirit, Heal). No tag has a 4th pipe part. `{@dice}` in those 7 spells' entries is always plain `NdM`/`NdM + K`.
  - BASES may be several `;`-separated values all scaling by INC (5: Melf's Acid Arrow `4d4;2d4`, Enervation `4d8;2d8`, Storm Sphere `2d6;4d6`, Conjure Elemental `8d8;4d8`, Lightning Arrow).
  - Two spells carry two scale tags (Bigby's Hand `5d8|5-9|2d8` + `4d6|5-9|2d6`; Wall of Ice `10d6|6-9|2d6` + `5d6|6-9|1d6`).
  - LEVELS is `MIN-MAX` everywhere except **Spirit Shroud `3,5,7,9`** — a list of the slot levels where INC applies (one more INC at 5, 7, 9).
  - A base may carry a flat part: Disintegrate `10d6 + 40|6-9|3d6` (the d6 term scales). Heal `{@scaledice 70|6-9|10}` is flat and matches no entry tag (70 is prose).
  - 10 spells have a base equal to 2+ entry tags (Backlash 4d6, Enervation 4d8, Wall of Light 4d8, …) — the same dice named twice in the text; both lines scale.
- **86 leveled spells** have `entriesHigherLevel` with no scale tag (more targets/rays/duration: Magic Missile, Scorching Ray, Hex) — their dice do not change with level.
- **Healing:** 34 leveled spells have `miscTags` HL; only the 7 `{@scaledice}` ones show healing dice. The other 27 (Aura of Vitality, Aura of Life, Aid, Goodberry, Heroes' Feast, Mass Heal, Power Word Heal, Regenerate, Vampiric Touch, Life Transference, Revivify, …) show no healing dice. False Life is not tagged HL (temporary HP).
- **Data bug, corrected in extraction (D206/D68):** XPHB Ice Storm's tag is `{@scaledamage 2d8|4-9|1d10}` while its entries (and the 2024 book) say `{@damage 2d10}` Bludgeoning; extract-data.js rewrites the base to 2d10 and validate-data.js checks it.

Optional-features.json prerequisites carry a `choose` filter string of the form `level=N|class=X|spell attack=m;r;o`: clauses pipe-separated, values within a clause semicolon-separated. `spell attack`'s value names 5etools' generic melee/ranged/other categories, but this data's own `spellAttack` field only ever holds `["M"]` or `["R"]` — never a third value (scripts/investigate-spell-attack-values.js).

## Fluff / lore text not extracted

Descriptive text and images live in separate fluff-*.json files, matched
to entries by name. Nothing from them is currently extracted. Whether the
sheet needs it is an open question — see QUESTIONS.md, "Fluff / lore
text".

## Magic item variants — deferred to phase 2

magicvariants.json holds 214 templates ("+1 Weapon") combined with base
items at runtime via requires/inherits. Not pre-generated by 5etools;
expanding them would produce thousands of entries.
Phase 1: base equipment + named magic items only.

## 246 extraction warnings, all in discarded sources

PHB (30) and EGW (20), all 2014 Dragonborn variants, plus 196 from the
bestiary pool: mostly `_mod: {"_": ...}` (a whole-entry mod our resolver does
not implement) on adventure-module NPCs and on the summon-spell stat blocks
(TCE/XPHB "Bestial Spirit" etc.), plus one failed `replaceArr`. None of them
is an entry beasts.json keeps — no XMM entry it keeps uses `_copy` at all — so
none reaches output. The count is unchanged by the Pact of the Chain intake.
If the monster intake is ever widened much further, the `"_"` mod needs
implementing first.

## Tool proficiencies
`toolProficiencies`: vždy právě jeden prvek — buď jmenovaný nástroj,
nebo kategorie. Kategorie jsou tři: `anyArtisansTool`,
`anyMusicalInstrument`, `anyGamingSet` (všech 33 backgroundů jednu
z těchto možností má, žádný ji nepostrádá).
Pozor u `anyMusicalInstrument`: kód typu položky sdílí 15 MAGICKÝCH
nástrojů (Horn of Valhalla, Lyre of Building, Rhythm-Maker's Drum
+1/+2/+3…). Filtr musí kromě kódu typu vyžadovat i `rarity: "none"`,
teprve pak zbyde 10 obyčejných nástrojů, které background nabízí.

## Species: creatureTypes (W-3)
species.json (81 záznamů) má `creatureTypes` (pole malých písmen, např. `["humanoid"]`, `["fey"]`)
u 57 druhů; u 24 chybí, a appka tam Creature Type nevypisuje. `creatureTypeTags` (8 záznamů) je
něco jiného — značky rodiny (`elf`, `gnome`), ne typ tvora. Všech 81 záznamů má alespoň jednu
pojmenovanou vlastnost v `entries`; `size` je u 77, `speed` u 79 (4 záznamy mají `raceName`/`raceSource`, přes které se chybějící pole doplňuje).

UID v odkazech ref* je totožné s polem id.

### Feat `ability` — 13 pevných, 68 s volbou, vždy +1

82 featů nese pole `ability`. 13 z nich zvyšuje vždy tutéž vlastnost,
68 nechává hráče vybrat z 2-6 jmenovaných, vždy +1 té vybrané.
Žádný feat obojí nemíchá a žádný nenabízí jiné rozdělení bodů.
Pozor na počet: dřívější zadání mluvilo o 70 choice featech — ty dva
navíc byla samotná "Ability Score Improvement", kterou picker
z nabídky featů vyřazuje.

Strop skóre (F-3, D259): položka `ability` nese `max: 30` u všech 26 Epic
Boonů (25 s volbou, Boon of Terror pevný) a u žádného jiného featu (13 pevných
a 60 s volbou kategorie G ho nemá). Strop 20 u ostatních featů a u ASI tedy
v datech není, je jen v pravidlech; `featAbilityCap` čte `max` a jinak vrací 20.

### Beast stat blocks — CR, type and the markup they carry

`cr` is a display string ("1/4", "2") OR an object `{ cr, xp }` — both shapes
occur among the kept entries. `type` is a bare string OR an object carrying
`type` plus `tags` or `swarmSize`; all three shapes occur. Any code touching
either field must handle both forms.

Extraction normalises CR into two fields: `cr` is always the display string
(unwrapped from `{cr, xp}`; `xp` is dropped), and `crNumber` is the sortable
number, fractions divided out (1/8 -> 0.125). Never compare `cr` numerically.

Other shapes, measured across all 96: `size` is always a 1-element array;
`ac` elements are always plain numbers; `hp` is always `{average, formula}`;
`speed` values are numbers or `{amount, from, note}`, and the keys seen are
walk/climb/swim/burrow/fly/`choose`.

`familiar: true` (31 of 96) is 5etools' own marker for creatures Find
Familiar can be cast as. It is a rules flag, not a filter tag, and is kept in
the file — but nothing reads it (D68: it disagrees with the 2024 spell text,
and it is false on the Imp, which Pact of the Chain names outright).

Three fields no Beast carries arrive with the Pact of the Chain forms and are
kept for them: `languages` (7 of the 8, plain strings), `spellcasting` (Imp,
Quasit, Sprite) and `gear` (Skeleton, item refs written `"shortsword|xphb"`).
Each `spellcasting` block sets `displayAs: "action"` and hides its own `will`
list, so `headerEntries` IS the printed line — that is all the stat block
renders.

`initiative` (R11a survey, scripts/investigate-beast-initiative.js): absent on
94 of 96 beasts; on the other two (Giant Shark, Mammoth) it is
`{ proficiency: 1 }` — the creature adds its proficiency bonus once. The data
carries no bonus number, so the stat block computes Dex modifier +
`proficiency` × the proficiency bonus of the creature's CR (2 up to CR 4, 3 for
CR 5–8: `proficiencyBonusForLevel(max(1, crNumber))`).

Beast trait/action text uses eight markup tags that occur nowhere else in
data/: `{@atkr}`, `{@h}`, `{@recharge}`, `{@actTrigger}`, `{@actResponse}`,
`{@actSave}`, `{@actSaveFail}`, `{@actSaveSuccess}`. All eight are handled in
src/markup/tags.ts. Adding any further bestiary content will likely bring
more of that family with it (`{@m}`, `{@hom}`, `{@actSaveFailBy}`,
`{@actSaveSuccessOrFail}` exist in 5etools but do not occur here).

Attack and damage numbers in the 32 familiar forms (CR 0 Beasts that are not
swarms + the pactOfTheChain creatures; R14d survey,
scripts/investigate-familiar-attack-text.js): 66 action/trait blocks, 33 of them
attacks, and every attack has the same skeleton — `{@atkr m}` or `{@atkr r}`,
then `{@hit N}`, then `{@h}A` where A is either a bare number ("`{@h}1`
Piercing damage", 18) or an average followed by `({@damage XdY}` or
`XdY ± K})` (15: "`{@h}4 ({@damage 1d4 + 2})`"). No plain "+N to hit" text, no
`{@hit}` outside an `{@atkr}` block, and the printed average always equals
floor(dice average) — so the number can be rewritten and the dice modifier moved
by the same amount. A tag may sit between `{@hit N}` and `{@h}` (Piranha's
`(with {@variantrule Advantage|XPHB} …)`), so the two are matched
independently. Extra damage after the hit damage is a rider, not a second
`{@h}`: "or 2 ({@damage 1d4})" (Goat charge) and "plus 3 ({@damage 1d6}) Poison
damage" (Scorpion, Spider). The one save-based action (Pseudodragon Sting,
`{@actSave con}`) has no `{@atkr}` and no `{@hit}`. A save bonus falls back to
the ability modifier for every ability the form's `save` map does not list (the
Owl has no `save` at all).

### Feats — čím pole `senses` a `speed` NEJSOU

Žádný ze 128 featů nemá pole `speed`. Pole `senses` má jen 3 featy
a vždy jde o blindsight nebo truesight, nikdy darkvision — jediný
smysl, který appka počítá. Ani jedno tedy nemá kam se promítnout.

### Feat proficiency / expertise / language choices — 11 feats, 7 shapes

Measured across all 128 feats (the `skillProficiencies`, `toolProficiencies`,
`languageProficiencies`, `expertise`, `skillToolLanguageProficiencies` fields;
a stripped-prose scan of the rest found no further feat that asks for such a
pick in text only). 13 feats carry one of these fields: 10 carry a player
choice (Keen Mind, Observant, Squat Nimbleness, Prodigy, Skill Expert,
Skilled, Crafter, Musician, Artificer Initiate, Boon of Skill), 3 carry only
fixed grants (Chef, Poisoner, Fey Teleportation's Sylvan). Boon of Skill has
both — a fixed grant of all 18 skills and an expertise choice. (An earlier
count of "11 with a choice, 4 fixed-only" counted Boon of Skill twice.)

- `skillProficiencies: [{choose:{from:[...]}}]` — no `count` key, meaning 1
  (Keen Mind, Observant, Squat Nimbleness, Prodigy). Prodigy's `from` lists all
  18 skills, i.e. "any" written as a list.
- `skillProficiencies: [{any:1}]` — Skill Expert.
- `toolProficiencies`: four different spellings — `{choose:{from:[8 named
  artisan's tools],count:3}}` (Crafter, NOT `anyArtisansTool`: the 8 are its
  Fast Crafting table), `{anyArtisansTool:1}` (Artificer Initiate),
  `{anyMusicalInstrument:3}` (Musician), `{any:1}` (Prodigy, any tool at all).
- `languageProficiencies: [{any:1}]` — Prodigy only. Fey Teleportation has
  `[{sylvan:true}]`. XPHB class features that grant languages (Druid Druidic
  L1, Rogue Thieves' Cant L1 + one, Ranger Deft Explorer L2 + two) carry no
  structured field, only prose (checked B3) — hence the hand table, now
  `src/languages/classFeatureLanguages.ts`. Both free picks say "from the
  language tables in chapter 2" (Thieves' Cant: "one other language of your
  choice"; Deft Explorer, sub-entry [Languages]: "two languages of your
  choice"), i.e. Standard AND Rare (checked B3b). languages.json: 19 entries,
  all XPHB — 10 `standard` (incl. Common) and 9 `rare` (incl. Druidic and
  Thieves' Cant themselves).
- `expertise: [{anyProficientSkill:1}]` — Boon of Skill, Prodigy, Skill Expert.
- `skillToolLanguageProficiencies: [{choose:[{from:["anySkill","anyTool"],count:3}]}]`
  — Skilled only. TRAP: here `choose` is an ARRAY of groups, unlike every other
  `choose` above (an object). Any mix of skills and tools, 3 in total.
- Class tools (checked B4), `startingProficiencies.toolProficiencies`, only 5
  classes: Druid `[{"herbalism kit":true}]`, Rogue `[{"thieves' tools":true}]`,
  Artificer (EFA) `[{"thieves' tools":true,"tinker's tools":true,"anyArtisansTool":1}]`
  (one object = all granted), Bard `[{"anyMusicalInstrument":3}]`, Monk
  `[{"anyArtisansTool":1},{"anyMusicalInstrument":1}]` (array elements =
  ALTERNATIVES, one or the other). The parallel `tools` field is prose. Fixed
  keys are lowercase item names (`cook's utensils`, `poisoner's kit`).
- XPHB subclass tool grants exist only as prose: Warrior of Mercy L3 "Implements
  of Mercy" ("proficiency with the Herbalism Kit", plus Insight and Medicine);
  Battle Master L3 "Student of War" ("one type of Artisan's Tools of your
  choice" plus one Fighter skill). Species tool grants (Githyanki, Warforged,
  Satyr, non-2024) are not covered by the tools row.

Repeatable: only Skilled among these (and it is also an origin feat 3
backgrounds grant). Of the 25 distinct origin feats backgrounds grant, three
carry a proficiency choice: Skilled, Crafter, Musician. (An earlier count of
26 took Noble's capitalised "Skilled|xphb" as a second feat.) Every background's
`feats` is a single fixed `{"name|source": true}`; the only species with a
`feats` field is Human (XPHB): `[{anyFromCategory:{category:["O"],count:1}}]`,
a free pick of any Origin feat. No feat carries a `feats` field.

Found in the feat-choice-storage investigation (2026-09-22, script consumed).

Option pools (task A3, 2026-09-25, script consumed): Crafter's `choose.from`
is exactly carpenter's, leatherworker's, mason's, potter's, smith's, tinker's,
weaver's and woodcarver's tools, `count: 3`, lowercase — all 8 match an
items.json `AT` item name case-insensitively (17 `AT` items exist), so the
picker filters the `anyArtisansTool` list by that set. Prodigy's `{any:1}` tool
means any tool at all: the same four item categories as a species' `{any:1}`
(`ANY_TOOL_CATEGORIES`: artisan's, gaming set, musical instrument, type `T`).
Skilled's `anyTool` uses the same pool. Every skill `choose.from` token across
feats is a lowercase ALL_SKILLS name. Prodigy is XGE, not XPHB.

### Background origin feats — casing, and which are repeatable

Title-casing a background's lowercase `feats` key does NOT always give the
feats.json name: the 12 Eberron marks come out "Mark Of Making" where
feats.json says "Mark of Making" (12 of the 25 distinct origin feats, 13 EFA
backgrounds). Anything that looks an origin feat up in feats.json must match
case-insensitively — featInstances.ts's `backgroundOriginFeatLinks` does, and
carries feats.json's own spelling onward.

`repeatable: true` is on 7 feats (always `true`, never `false`): Ability
Score Improvement, Elemental Adept, Magic Initiate and its three
"Magic Initiate; Cleric/Druid/Wizard" entries, Skilled. Of the origin feats,
the three Magic Initiate variants and Skilled are repeatable. Every variant
carries the same `additionalSpells` ability choice (int/wis/cha) as base
Magic Initiate, and no top-level `ability` field.

Found in task A1 (2026-09-22, scripts/investigate-origin-feat-repeatable.js, consumed).

### Feat categories, and the class Fighting Style as a feat

feats.json has 159 entries in 8 `category` codes: G 84, EB 26, O 15, D 13, FS 10,
DG 9, FS:P 1, FS:R 1. Every entry has an `entries` array. The 10 category-`FS`
entries are all XPHB and their names are unique (case-insensitively), so
`Character.fightingStyle` — a bare name, picked from exactly those 10 — maps to
one feats.json entry without a source. FS:P / FS:R are not offered by the class
Fighting Style picker. Found in R13a (2026-09-28, scripts/investigate-manage-feats.js).

### Feat names across books — none twice today (F-2a, D255)

No feat name occurs in two books in feats.json (159 entries, case-insensitive name match): Alert and
Tough exist only as XPHB. D255's "same name = same feat" therefore changes nothing on today's data; it
covers a future source. Alert is the origin feat of Criminal|XPHB, Guard|XPHB and Inquisitive|EFA
(among others possibly); Tough of Farmer|XPHB. feats.json carries no `grantedByBackgrounds` field —
`sheetData.ts` adds it at runtime from backgrounds.json, so a reader of plain `loadFeats` entries must
be told the background feat another way (featAsiLevels.ts passes it as `originFeatOverride`).
Found in F-2a (2026-10-01, scripts/investigate-feat-name-duplicates.js, consumed).

### Subclass names across books — none twice today (M1b)

data/classes.json holds 109 subclass entries with 109 distinct `name`s (exact match): no subclass
name occurs with more than one `source`. `CharacterClass.subclass`, stored by name only, is therefore
unambiguous on today's data; a future source reusing a name would make it ambiguous.
Found in M1b (2026-10-05, scripts/investigate-subclass-names.js, consumed).

### Option names across books — none twice today (M1b)

feats.json's 10 category-FS entries have 10 distinct names (case-insensitive, trimmed), and in
optional-features.json no `featureType` (11 codes) lists one name with two sources. So a pick stored
without a source (before schema 58, D318) resolves to exactly one row today, and the source a save
records for it is that row's. "Pact of the Chain" is one row, XPHB `EI` (beastData.ts relies on it).
Found in M1b (2026-10-06, scripts/investigate-same-name-options.js, consumed).

### Frázové vyhledávání v `entries` musí nejdřív stripnout 5etools markup

5etools tagy rozdělují frázi na dvě části, které nikdy neleží vedle sebe v
syrovém textu: `{@variantrule Hit Points|XPHB} maximum` je v datech
`"{@variantrule Hit Points|XPHB} maximum"`, ne `"Hit Points maximum"`.
Hledání fráze "hit point maximum" v syrovém textu (bez odstranění tagů) tak
najde jen 2 z 10 skutečných výskytů ve feats.json, species.json,
class-features.json, subclass-features.json a optional-features.json
(ověřeno na hledání, které stojí za D93/D95 — viz
`stripEtoolsTags`/`plainTextOfEntry` ve `scripts/validate-data.js`). Jakýkoli
budoucí frázový scan přes `entries` musí nejdřív tagy stripnout na jejich
zobrazovaný text (`{@tag text|zdroj}` -> `text`), jinak potichu minimalizuje
výsledky na zlomek skutečného počtu. Tag se 3+ segmenty zobrazuje segment
podle tabulky v src/markup/tags.ts (`{@variantrule Hit Points|XPHB|Hit Point}`
-> „Hit Point"), ne první (D277).
### Odkazy mezi featurami přeskakují úrovně — vždy dolů, nikdy nahoru

Tranzitivní uzávěr v `grantedClassFeaturesFrom` (D87) chodí po `ref*` uzlech
v prostém textu. Z 338 takových odkazů (`refClassFeature` /
`refSubclassFeature`, 0 nevyřešených) jich **293 míří na featuru téže úrovně
a 45 přeskakuje na jinou — všech 45 dolů, ani jeden nahoru.** Příklad:
`Cleric Order Domain (úroveň 3)` odkazuje na `Cleric Bonus Proficiencies
(úroveň 1)`; stejný tvar mají Peace Domain a další starší doménové wrappery.

Praktický důsledek: **„featury nové na úrovni N" NENÍ uzávěr filtrovaný na
`level === N`** — takový filtr těch 45 zahodí. Musí to být rozdíl dvou celých
uzávěrů, porovnaný podle `id` featury.

Past, která z toho plyne podruhé: strana N-1 musí odříznout podtřídu, kterou
si třída volí až nad N-1. Bez toho se subclassová featura zapsaná na úrovni 1
(Disciple of Life) počítá jako už držená na úrovni 2 a všechno, co podtřída
přináší, z odpovědi pro úroveň 3 zmizí. Hranici dodává `subclassLevelFor`.

Zjištěno průzkumem ve slice 8d2 (`scripts/investigate-closure-level-drift.js`,
spotřebovaný a smazaný). Souvisí s D101.

### Which feature grants a chosen option — the `{@filter}` tag, not a field

Nothing structured links an `optionalfeatureProgression` featureType (or the
fighting style) to the class/subclass feature that grants it; the progression's
`name` ("Maneuvers") is not a feature name. The link is the 5etools filter tag
in the granting feature's own text (R6, D184):

| featureType | granting feature (level) | tag |
|---|---|---|
| MM (Sorcerer) | Metamagic (2; restated 10, 17) | `{@filter …\|optionalfeatures\|feature type=MM\|source=XPHB}` |
| EI (Warlock) | Eldritch Invocations (1) | `… feature type=EI …` |
| MV:B (Battle Master) | Combat Superiority (3) | `… feature type=MV:B …` |
| fighting style | Fighting Style (Fighter 1, Paladin 2, Ranger 2); Champion's Additional Fighting Style (7) | `{@filter Fighting Style feat\|feats\|category=FS}` |
| AS (Arcane Archer, XGE), RN (Rune Knight, TCE), FS:B (College of Swords, XGE) | none | the options sit only in a counted `options` node of `refOptionalfeature` (Arcane Shot Options, Rune Carver, Fighting Style) — a choice container that D87 rule 3 keeps out of the granted list |

Sorcery Incarnate (Sorcerer 7) also carries the MM filter; the lowest-level
match is the granter. Found by an investigation script in R6 (not kept).

### Armor / weapon / tool / language proficiency sources

- Classes: `startingProficiencies.armor` tokens are `light`, `medium`, `heavy`,
  `shield` (Monk, Sorcerer, Wizard have no `armor` key); `weapons` tokens are
  `simple`, `martial`, except Monk and Rogue, which mix `simple` with one prose
  sentence (D70). Those two ALSO carry a structured
  `startingProficiencies.weaponProficiencies`:
  `[{"simple":true,"all":{"fromFilter":"type=martial weapon|property=light"}}]`
  (Rogue: `property=light;finesse`). Nothing reads it yet.
- Feats: `armorProficiencies` on Lightly Armored `{light, shield}`, Moderately
  Armored `{medium}`, Heavily Armored `{heavy}`; `weaponProficiencies` on
  Martial Weapon Training `{martial}`, Gunner `{firearms}`, Tavern Brawler
  `{improvised}`.
- Class and subclass feature grants are TEXT ONLY — no structured field. XPHB
  ones: Cleric Divine Order → Protector (Martial weapons, Heavy armor), Druid
  Primal Order → Warden (Martial weapons, Medium armor), both L1 options of a
  D21 choice; Bard College of Valor L3 Martial Training (Martial weapons,
  Medium armor, Shields). The only Valor subclass in classes.json is XPHB.
- 2024 (XPHB) species grant no tool, weapon or armor proficiencies and no
  languages; 5 of them do grant skills (see "Species grants beyond traits (S1)").
- Monk's `toolProficiencies` array lists ALTERNATIVES (pick one), not a set of
  grants. Background tool shapes: see "Tool proficiencies" above.
- The 2024 "Common + 2 languages of your choice" rule is not in the data.
- Multiclass (M2, D321, `scripts/investigate-multiclass-profs.js`, consumed): every class has a `multiclassing` key,
  but Monk, Sorcerer and Wizard have no `proficienciesGained`. `armor`/`weapons` are plain token arrays;
  `toolProficiencies` entries are `{toolName: true}` or a choice count. No `proficienciesGained` carries saves.

  | Class (source) | armor | weapons | toolProficiencies | other keys |
  |---|---|---|---|---|
  | Artificer (EFA) | light, medium, shield | — | `{"tinker's tools": true}` | tools, skills |
  | Barbarian | shield | martial | — | — |
  | Bard | light | — | `{"anyMusicalInstrument": 1}` (choice) | tools, skills |
  | Cleric | light, medium, shield | — | — | — |
  | Druid | light, shield | — | — | — |
  | Fighter | light, medium, shield | martial | — | — |
  | Paladin, Ranger | light, medium, shield | martial | — | Ranger: skills |
  | Rogue | light | — | `{"thieves' tools": true}` | tools, skills |
  | Warlock | light | — | — | — |
  | Monk, Sorcerer, Wizard | no `proficienciesGained` | | | |

  (All XPHB except Artificer; `tools` is the prose twin of `toolProficiencies`.)
- `casterProgression` values (M3, D322, `scripts/investigate-caster-progression.js`, consumed): base classes —
  "full" Bard, Cleric, Druid, Sorcerer, Wizard (XPHB); "artificer" Artificer (EFA), Paladin, Ranger (XPHB); "pact"
  Warlock (XPHB). Subclasses — "1/3" Eldritch Knight and Arcane Trickster (XPHB) only, each carrying
  `casterProgression`, `spellcastingAbility`, `preparedSpellsProgression` and a `subclassTableGroups` entry with
  `rowsSpellProgression`. No other value (e.g. "1/2") exists in the data.
- Wizard XPHB `rowsSpellProgression` has 20 rows of 9 numbers and is identical on all 20 levels to the XPHB
  Multiclass Spellcaster table (row 1 `2 0…`, row 5 `4 3 2 0…`, row 20 `4 3 3 3 3 2 2 1 1`); the app uses it as
  that table.

Found in investigation B1 (2026-09-24, scripts consumed); class/feat/Protector/
Warden/Valor shapes re-checked in B2 (`scripts/verify-b2.js`, consumed). The
species, Monk-tool and language lines are B1's and were not re-checked.

### Subclass proficiency grants (non-XPHB) — prose only

- No non-XPHB subclass entry and no subclass-feature entry carries a structured
  proficiency field (`armorProficiencies`, `weaponProficiencies`,
  `toolProficiencies`, `languageProficiencies`, …). Every grant is prose, hence
  the hand tables (D176).
- Wording differs by book: EFA uses the 2024 "gain training with Heavy armor";
  XGE/TCE "gain proficiency with". A scan must match both. EFA weapon grants are
  `{@filter}` tags (Artillerist's martial ranged weapons).
- Feature levels: Forge, Order, Peace, Twilight, Hexblade and Storm entries
  carry level 1, Shepherd level 2 (2014 levels); the XPHB-converted subclass
  references them at 3, and the app grants them at 3.
- Three condition shapes: "if you already have… choose another Artisan's Tool"
  (EFA Artificer subclasses — a replacement pick); "if you don't already have
  it" (no replacement: Drunken Master, Scout, Kensei); skill-or-language
  (Cavalier, Samurai).
- Bladesinging carries `reprintedAs` (FRHoF); the app does not offer it.
  Phantom, Grave and Shadow Magic left the data with D194 (RHW reprints).
- Offered names (classes.json, after subclassesFor's filter), checked B6b:
  `College of Swords`|XGE, `Forge Domain`|XGE, `Order Domain`|TCE,
  `Twilight Domain`|TCE, `Circle of the Shepherd`|XGE, `Rune Knight`|TCE,
  `Way of the Drunken Master`|XGE, `Way of the Kensei`|XGE, `Mastermind`|XGE,
  `Storm Sorcery`|XGE, `The Hexblade`|XGE (all classSource XPHB); `Alchemist`,
  `Armorer`, `Artillerist`, `Battle Smith`, `Cartographer` (EFA/EFA). No two
  offered subclasses of one class share a name. Mastermind's language/tool
  feature is "Master of Intrigue" (L3, filed under classSource PHB). Gaming sets
  (`GS`): Dice Set, Dragonchess Set, Playing Cards, Three-Dragon Ante Set.
- RHW/FRHoF prose grants (D203): see the RHW and FRHoF passages above. Weapon
  properties are matched on items.json `propertyFull` ("Two-Handed", "Heavy")
  and type code `M`.

Found in investigation B6a and checked in B6b (2026-09-24, scripts consumed).

### Class and subclass senses — prose only (D195)

- No class-features.json or subclass-features.json record carries a `senses`
  field; every sense grant is prose, hence `CLASS_SENSE_GRANTS`.
- Feral Senses (Ranger|XPHB L18) and Umbral Sight (Gloom Stalker|XPHB L3) are
  their own records. Eyes of Night (Twilight Domain|TCE) is filed at L1 under
  classSource PHB. Eyes of the Dark is a named sub-entry inside the Shadow
  Sorcery|RHW L3 record "Power of Shadow". Warrior of Shadow's (shortName
  "Shadow") L3 "Shadow Arts" has no inline sub-entries: its "Darkvision" is a
  `refSubclassFeature` node pointing at a separate record.
- Stored subclass names (classes.json `name`): `Twilight Domain`,
  `Shadow Sorcery`, `Warrior of Shadow`, `Gloom Stalker`; none has
  `reprintedAs`.

Checked by `scripts/investigate-class-senses.js` (2026-09-26, D195).

Skill grants, checked B6c (each name is one subclass entry in classes.json,
classSource XPHB; feature entries mostly filed under classSource PHB):
- Fixed: Way of the Drunken Master|XGE "Bonus Proficiencies" L3 (Performance);
  Scout|XGE "Survivalist" L3 (Nature, Survival, proficiency bonus doubled);
  Warrior of Mercy|XPHB "Implements of Mercy" L3 (Insight, Medicine + Herbalism
  Kit).
- Picks: Battle Master|XPHB "Student of War" L3 (1 skill "available to Fighters
  at level 1" = XPHB Fighter `startingProficiencies.skills`: acrobatics, animal
  handling, athletics, history, insight, intimidation, persuasion, perception,
  survival); Order Domain|TCE "Bonus Proficiencies" L1 (Intimidation or
  Persuasion); Peace Domain|TCE "Implement of Peace" L1 (Insight, Performance or
  Persuasion); Arcane Archer|XGE "Arcane Archer Lore" L3 (Arcana or Nature).
- Skill or language: Cavalier|XGE "Bonus Proficiency" L3 (Animal Handling,
  History, Insight, Performance, Persuasion — or 1 language); Samurai|XGE "Bonus
  Proficiency" L3 (History, Insight, Performance, Persuasion — or 1 language).

Species tool grants, checked B6c: Warforged|EFA `skillProficiencies [{any:1}]`,
`toolProficiencies [{any:1}]`; Satyr|MPMM `toolProficiencies
[{anyMusicalInstrument:1}]`; Khoravar|EFA no structured field — prose "one skill
or with one tool of your choice", and "Whenever you finish a Long Rest, you can
replace it" (the app stores it as a permanent pick, D177). Githyanki|MPMM
`toolProficiencies [{any:1}]` is the temporary grant; Kalashtar|EFA carries no
structured skill; Eladrin/Sea Elf/Shadar-Kai carry only fixed Perception.
items.json type `T` (rarity none) is exactly 6 items: Disguise Kit, Forgery Kit,
Herbalism Kit, Navigator's Tools, Poisoner's Kit, Thieves' Tools — with AT, GS
and mundane INS the pool of an untyped `{any:1}` tool pick.

Found in task B6c (2026-09-24, `scripts/investigate-b6c-skill-grants.js`, consumed).

### Species `size` — array of letters, a choice when it has two

`species.json` `size` is an array of size letters. One element (`["M"]`) is the
size; two (`["S","M"]`) is a player choice — 23 species, XPHB Human among them.
The four Genasi subraces carry no `size` and inherit the parent's via
`raceName`/`raceSource` (same fallback as speed and darkvision). The choice is
stored on the character as `speciesSize` (D175); nothing in the data records it.

### Species grants beyond traits (S1)

- `skillProficiencies` on 5 XPHB entries: Elf and its 3 lineages choose one of
  insight/perception/survival, Human `{any:1}`. Tools, weapons, armor and
  languages really are 0.
- No extracted species carries `languageProficiencies`, weapon/armor
  proficiencies, `immune`, `conditionImmune`, `vulnerable`, `blindsight` or
  `skillToolLanguageProficiencies` (raw races.json has them only on entries we
  do not extract).
- `feats`: 3 raw entries (Human XPHB, Variant PHB, Custom Lineage TCE); only
  Human|XPHB is extracted, shape `[{"anyFromCategory":{"category":["O"],"count":1}}]`.
  Its trait Versatile is the only one of its 3 named traits whose text mentions
  an Origin feat. feats.json has 15 category-O feats; repeatable are Skilled and
  the 4 Magic Initiate entries (D271–D273).
- Speed: base Elf|XPHB 30, Wood Elf lineage 35; Goliath and its 6 ancestries 35.
  An XPHB fly speed exists only in prose and is temporary (12 entries).
- Gnome|XPHB base has no `additionalSpells` (only its lineages); Elf|XPHB base
  carries all three lineage blocks, each with `name`.
- raw races.json: 160 races, 98 subraces, 17 `_copy`, `_versions` on 24 entries
  (55 versions, `_mod` only on `entries`).
- Markup: a 3-segment tag such as `{@variantrule Hit Points|XPHB|Hit Point}`
  displays the THIRD segment ("Hit Point"), the override index of
  src/markup/tags.ts REFERENCE_TAGS. validate-data's `stripEtoolsTags` follows
  that table since S1 (D277).

Found in task S1 (2026-10-01, `scripts/investigate-species-feats.js`, consumed)
and the species survey before it.

### Species cantrip choice — `choose` filter in `additionalSpells.known` (S2)

Exactly 5 species.json entries carry a `choose` node in `additionalSpells`, all
under `known`, all `level=0|class=…`, count 1 (explicit `count: 1` only on the
Kobold pair), all with `ability: {"choose":["int","wis","cha"]}`:

| Entry | Grant key | Filter | Stored by the wizard? |
|---|---|---|---|
| Elf\|XPHB (block `name: "High Elf"`) | `known["1"]` | `class=Wizard` | no — family base (D81) |
| Elf; High Elf Lineage\|XPHB | `known["1"]` | `class=Wizard` | yes |
| Khoravar\|EFA | `known["1"]` | `class=Cleric;Druid;Wizard` | yes (no variants) |
| Kobold\|MPMM (block without `name`) | `known["_"]` | `class=Sorcerer` | no — family base (D81) |
| Kobold; Draconic Sorcery\|MPMM | `known["_"]` | `class=Sorcerer` | yes |

The node sits in an array inside the level key: `{"1": {"_": [{"choose": …}]}}`
for Elf/Khoravar, `{"_": [{"choose": …, "count": 1}]}` for Kobold. Kobold|MPMM's
base block has no `name`, unlike Elf's. XPHB cantrip counts (core + variant
lists): Wizard 31, Sorcerer 31, Druid 22, Cleric 9. Single-list examples: Sacred
Flame (Cleric), Shillelagh (Druid); Fire Bolt and Ray of Frost are Sorcerer +
Wizard (+ Artificer).

Found in task S2 (2026-10-01, `scripts/investigate-species-cantrips.js`, consumed).

`extractSpeciesCantripSlot` returns a slot for Kobold|MPMM's family base too (its block has no `name`); only
Elf's named base block yields null. Harmless: the wizard never stores a base (D81).

### Alert — one entry only (F-5)

feats.json has exactly one Alert: Alert|XPHB, category O, keys `name, source, page, srd52, basicRules2024,
category, entries` — no structured field, so its effect lives only in prose. Initiative sentence (tags
stripped): "When you roll Initiative, you can add your Proficiency to the roll." (the tag is
`{@variantrule Proficiency|XPHB|Proficiency Bonus}`), plus the Initiative swap with an ally, which the app
does not model. No 2014 PHB Alert (+5) is in the filtered data. Backgrounds granting it: Criminal|XPHB,
Guard|XPHB, Inquisitive|EFA.

Found in task F-5 (2026-10-01, `scripts/investigate-alert-initiative.js`).

### Species traits against the Actions tab's tests (D185)

`species.json`: 78 records, 316 named top-level `entries` elements. 70 of them
pass D86 or the D182 R-phrase test — 36 by R-phrase (Action 4, Bonus Action 30,
Reaction 2), 34 by the rest tag alone and therefore Other. Lineage records repeat
the parent's traits (Dragonborn ×11 records, Goliath ×7), so a character sees
about 1–5 of them. Sources: XPHB 58, EFA 11, MPMM 1.

Traps: Breath Weapon opens "When you take the Attack action…", a trigger the
R-phrase frames skip, so it is Other, not Action. The rest tag also catches
passive traits that only mention a Long Rest (Trance, Fiendish Legacy, Elven
Lineage) — they land in Other. Trait records carry no `consumes` and no level; 26
of the 70 mention a character level in prose only (Celestial Revelation, Large
Form, Draconic Flight).

Resource model if species traits were fed to it: 21 records are single-use
(Healing Hands, Celestial Revelation, Draconic Flight, Large Form, Relentless
Endurance — recharge sentence, no count); 28 state a count in prose (Breath
Weapon: Proficiency Bonus) and would stay unknown.

Found in task "Actions: species traits" (`scripts/investigate-species-actions.mjs`).

### Breath Weapon records and the ancestry damage type (D313)

`species.json`: 11 records carry a top-level `Breath Weapon` trait, all XPHB —
bare `Dragonborn` plus the 10 `Dragonborn (Colour)` variants. No other source has
one. The prose is identical across the 11 except the damage word: Dexterity save,
"8 plus your Constitution modifier and Proficiency" (the markup strip leaves
"Proficiency" for the PB tag), 1d10 rising at character levels 5/11/17 to
2d10/3d10/4d10, 15-foot Cone or 30-foot Line, uses = PB per Long Rest.

The damage type is structured only as the variant's `resist`: a one-string array
(Black/Copper `acid`, Blue/Bronze `lightning`, Brass/Gold/Red `fire`, Green
`poison`, Silver/White `cold`), always equal to the type in the breath prose. The
bare record has `resist: [{ choose: { from: [5 types] } }]` and prose "1d10" with
no type. The dice and DC exist only in prose.

Found in task S3 (`scripts/investigate-breath-weapon.js`).

### Species advantage on saving throws (S4)

Stripped prose matching "advantage on … saving throw" / "saving throw … with
advantage": 28 of 81 species records, 18 distinct trait sentences. All prose,
no structured field.
- Named condition (21 hits): Fey Ancestry / Charmed — Elf|XPHB + 3 lineages,
  Khoravar|EFA, Bugbear, Eladrin, Goblin, Hobgoblin, Sea Elf, Shadar-Kai (MPMM);
  Poisoned — Dwarven Resilience (Dwarf|XPHB, Duergar|MPMM), Construct Resilience
  (Warforged|EFA), Poison Resilience (Yuan-Ti|MPMM); Frightened — Brave
  (Halfling|XPHB), Kobold Legacy (Kobold|MPMM base, Kobold; Defiance|MPMM);
  Charmed+Stunned — Psionic Fortitude (Duergar); Charmed+Frightened — Mental
  Discipline (Githzerai|MPMM).
- Abilities (6): Gnomish Cunning INT/WIS/CHA (Gnome|XPHB + 2 lineages), Dual Mind
  WIS/CHA (Kalashtar|EFA), Shell Defense STR/CON (Tortle|MPMM).
- Spells (3): Magic Resistance (Satyr, Yuan-Ti|MPMM), Gnomish Magic Resistance
  INT/WIS/CHA vs spells (Deep Gnome|MPMM).
- Other (1): Escaped Death — Death Saving Throws (Reborn|RHW).
- Damage type: 0. False positive: Howl (Lupin|RHW) — the save is the target's.
- Temporary: only Shell Defense ("Until you emerge…", while in the shell). No
  level gate in any of them. Duergar has two such traits; XPHB Dwarf's sentence
  starts "You also have…". Kobold|MPMM base is never stored (D81).
- Kobold; Defiance|MPMM names the trait "Kobold Legacy (Defiance)". Yuan-Ti|MPMM
  has size ["S","M"] and `additionalSpells`. D314's table (src/sheet/speciesSaveAdvantages.ts)
  covers all of the above except Howl and the never-stored Kobold base; Shell Defense
  gets a conditional "while in your shell" line.

Found in task S4 (2026-10-03, `scripts/investigate-species-save-advantage.js`).

### Species trait prose: attack replacement, level gates, use counts (D186)

"replace one of … attacks" occurs in 14 records across the four feature files
and species, always within 90 chars after "take the Attack action". The D186
frame changes the group of 13: Breath Weapon ×11 (Dragonborn XPHB records), War
Magic XPHB, Commander's Strike XPHB; all Other → Action.

Level phrasings in species traits: "When you reach character level N" ×18,
"Starting at character level N" ×7, "Starting at Nth/Nrd level" ×15, "When you
reach Nrd level" ×4. In the OPENING words of the first entry string they gate the
whole trait — 9 names: Celestial Revelation (+ 3 MPMM variants) 3, Wind Caller
3, Gift of the Svirfneblin 3, Duergar Magic 3, Draconic Flight 5 (×11), Large
Form 5 (×7). Later in the text they raise only part of a trait — 18 names, e.g.
Fey Step, Elven Lineage (Drow/High Elf/Wood Elf), Fiendish Legacy variants,
Blessing of the Raven Queen, the Genasi spell traits, Serpentine Spellcasting.

Use-count phrasings (plain text; the markup strip reads XPHB's
`{@variantrule Proficiency|XPHB|Proficiency Bonus}` as "Proficiency"):
- "Once you …, you can't do so / use it / use this trait again until you finish
  a Long Rest" — 30 records. Spell traits say "can't cast that spell with it
  again" or "regain the ability to cast it" instead, and do not match.
- "a number of times equal to your Proficiency Bonus" + "regain(ing) all
  expended uses when you finish a … Rest", same or next sentence — 42 records;
  only 15 if "Proficiency Bonus" is searched literally. "regaining" (Shifting
  MPMM, Merge with Stone) and a sentence break (Fey Gift) both occur.
- Only Adrenaline Rush (Orc XPHB) recharges on a Short or Long Rest.
- Merge with Stone (Earth Genasi) matches both: two independent limits.

Result: 70 trait records carry a count (29 once, 41 PB); the generic Gnome
record's Gnomish Lineage gets PB from its Forest Gnome paragraph. Actions tab
70 (D185) → 73 records (Action 15, Bonus 30, Reaction 2, Other 26). Found in
task D186 (`scripts/investigate-species-actions-d186.mjs`).

### actions.json — the Actions in Combat (D187)

Source file: one key `action`, 48 records, no `_copy`/`_versions`. By source:
PHB 20, XPHB 18, DMG 8, XGE 2. Fields on the XPHB records: `name`, `source`,
`page`, `entries`, `time`, plus `srd52`, `basicRules2024`, `seeAlsoAction`
(Attack ↔ Two-Weapon Fighting). Five have non-string top-level entries (Attack,
Help, Influence, Search, Study: `entries` blocks and `table`s).

`time` shapes: `[{number: 1, unit: "action" | "bonus" | "reaction"}]`, or a
bare string — `["Free"]` (End Concentration), `["Varies"]` (Improvising an
Action). XPHB groups: Action 15, Bonus Action 1 (Two-Weapon Fighting),
Reaction 1 (Opportunity Attack), Other 2.

Trap: the category's XGE records (Identify a Spell — time `reaction` AND
`action` — and Waking Someone) are in ALLOWED_SOURCES and carry no
`reprintedAs`, so a normal source filter keeps them. Hence the own XPHB
constant. 19 PHB records point `reprintedAs` at XPHB; Grapple and Shove point at
the `Unarmed Strike|XPHB` variantrule, not at an action. Other Activity (PHB)
has no reprint.

Markup: Help carries the only `{@note …}` in the category, wrapping a nested
`{@book stabilize a creature|XPHB|1|…}`. All other tags were already handled.
`{@action X|XPHB}` in the rest of data/ names only these 18 (492 occurrences,
42 more with no source argument); never referenced that way: Don or Doff a
Shield, End Concentration, Escape a Grapple, Improvising an Action, Ready,
Two-Weapon Fighting. Found by `scripts/investigate-actions-in-combat.mjs`.

### Free casts: slot or not, per-spell counters, double counting (D190)

**"Also castable with a slot?" is not in the data.** The same `daily:{"1":…}`
wrapper sits on sources that say yes and on ones that say nothing, so it is a
hand table (`src/spells/alsoCastableWithSlot.ts`). Stated yes: the 12 Marks
("You can also cast it/these spells using any spell slots you have"), Magic
Initiate, Artificer Initiate, Fey-/Shadow-Touched, XPHB Tiefling legacies and
Elf lineages, Duergar, Triton, Yuan-Ti ("…of 2nd level or higher"). Implicit
yes ("always prepared" / "learn"): Forest Gnome, Archfey Patron (Misty Step is
also in `prepared["3"]`), The Fathomless, Psi Warrior, College of Spirits (RHW);
Hexblood (RHW) says both. No: Shadow Sorcery (RHW, "3 Sorcery Points … without
expending a spell slot, without preparing the spell"), Alchemist (only
"without expending a spell slot"), Drow High Magic, Fey Teleportation, Wood Elf
Magic (XGE), MPMM Deep Gnome/Fairy/Githyanki/Githzerai/Genasi (records named
Air/Fire/Water), the 3 limited and 12 bare invocations, Wild Heart (ritual only),
Pact of the Chain, Monk resource spells.

**Counters are per spell.** "either spell … that spell" (Fey-/Shadow-Touched,
Deep Gnome), "any of these spells … that spell" (Triton), "each of which" (Wood
Elf Magic, Drow High Magic): each spell has its own once-per-rest. The only
shared pool is the `resource` kind — Focus Points, shared with every Monk
feature (Sun Soul Burning Hands `resourceName` "Ki" cost 2, Warrior of Shadow
Darkness "Focus Point" cost 1; both resolve to "Focus Point"). Ability-based
counts say "(minimum of once)" in both texts (Steps of the Fey, Restorative
Reagents). The 12 bare invocations state no limit at all.

**Double counting.** A record that already has (or should have) its own boxes
for the same casts: species trait Gnomish Lineage (Forest Gnome) (PB/LR) and
Serpentine Spellcasting (Yuan-Ti, 1/LR); Chemical Mastery (EFA) — its "Once you
use this feature, you can't use it again until you finish a Long Rest." is the
last sentence of the Conjured Cauldron benefit, so it covers Tasha's Bubbling
Cauldron; Steps of the Fey and Restorative Reagents — self-limited resources with
no table maximum ("equal to your … modifier" is prose only). Mark of Sentinel
(two limits) has no boxes. Future: Favored Enemy vs Hunter's Mark.

**Archfey Misty Step is two grants.** `prepared["3"]` (bare = slot) and
`innate["_"]` (`daily:{"cha":…}`). The old per-spell dedupe kept only the first,
so the CHA/LR term never reached the sheet. Checked over every non-reprinted
subclass: no other spell is granted twice with different usages.

**Class-record `additionalSpells`** (Ranger Hunter's Mark, Paladin Divine Smite,
Druid Speak with Animals + Find Familiar, Bard 20, Warlock 9, Artificer Mending;
shape: next subsection) are read since D192 and their free casts come from a hand
table since D193. Telepathic's detect thoughts and Telekinetic's mage hand
(ability "inherit") are reached by featSpells.ts since D204, cast with the feat's
own +1.

**Forest, not Rock.** The only `daily:{"pb":…}` carrier is Gnome; Forest Gnome
Lineage (Speak with Animals); the code once said Rock Gnome. Found by the R7b-0
investigation and task D190; `alsoCastableWithSlot.test.ts` re-derives the
reachable free-use sources from data/ on every test run.

### Class-record `additionalSpells` — shape and what the wrapper leaves out

Checked by `scripts/investigate-class-spells.mjs` (untracked). Extraction keeps
the field untouched: all 6 carriers are identical in data-source and data/.
6 classes, one entry each, 9 fixed grants, all BARE (no `daily`/`resource`/
`will` wrapper, no `ability`, no `resourceName`, no `"_"` key). Level keys are
the class's own level, same as subclasses.

| Class | Key | Spell (lvl) | Feature text | Free cast in text |
|---|---|---|---|---|
| Artificer EFA | `innate[1]` | Mending (0) | Tinker's Magic: "You know the Mending cantrip." | cantrip |
| Bard | `prepared[20]` | Power Word Heal, Power Word Kill (9) | Words of Creation: always prepared | none |
| Druid | `prepared[1]` | Speak with Animals (1) | Druidic: always prepared | none |
| Druid | `prepared[2]` | Find Familiar (1) | Wild Companion: "expend a spell slot or a use of Wild Shape" | 1 Wild Shape use per cast, slot also |
| Paladin | `prepared[2]` | Divine Smite (1) | Paladin's Smite: always prepared | 1 per Long Rest |
| Paladin | `prepared[5]` | Find Steed (2) | Faithful Steed: always prepared | 1 per Long Rest |
| Ranger | `prepared[1]` | Hunter's Mark (1) | Favored Enemy: always prepared | "Favored Enemy" column, Long Rest |
| Warlock | `prepared[9]` | Contact Other Plane (5) | Contact Patron: always prepared | 1 per Long Rest |

**The wrapper misses every free cast.** Five grants are bare in the data while
the text gives a free cast: Hunter's Mark, Divine Smite, Find Steed, Contact
Other Plane, Find Familiar. All five are also slot-castable (always prepared;
Wild Companion names the slot itself). The free cast can only come from a hand
table, like D190's.

**Counts and owners.** Ranger `classTableGroups` column "Favored Enemy" =
2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6; Favored Enemy passes resources.ts's
self-limited test, so it is already resource `Favored Enemy` with that maximum.
Druid column "Wild Shape" = 0,2,2,2,2,3…3,4,4,4,4 (4 from 17); Wild Shape is
self-limited and a consumed pool, resource `Wild Shape`. Paladin's Smite,
Faithful Steed and Contact Patron are NOT resources (no `consumes`, phrasing
misses EXPENDED_USES; Contact Patron's "can't do so in this way again" misses
only by "in this way"). D193 gives all three a counter through SHARED_OWNERS
(the free-cast maximum 1 fills in; the box then also shows in Features & Traits,
verified by e2e). Tinker's Magic is a resource (INT mod/LR) but counts
item creations, not Mending.

**Bard `expanded` is Magical Secrets, not a grant.** `{"10":[{"all":"level=1;2;3;4;5|class=Cleric;Druid;Wizard"}],"s6".."s9":[…level=N…]}`
— `"10"` is a class level, `s6`–`s9` are SPELL levels (not pact ranks). It
widens the Bard picker to three more lists. Bard XPHB is the ONLY class record
(entryType `class`) in data/classes.json with a class-level `expanded`; the other
records with one are subclasses (EK, AT, Divine Soul, Hexblade, Fathomless,
Genie) — confirmed R9b by a summary script. Every entry is `{"all": "level=…|
class=…"}` (levels `;`-separated, so `level=1;2;3;4;5` is one query). Gate
semantics (D209): a numeric key applies from that class level; an `sN` key has no
class-level gate of its own — filterSpellsByLevel (slots) is what holds it back,
so the pool for Bard 9 still contains the `s6`–`s9` spells and only the slot
filter hides them. Cantrips never appear (`level=1..9` only). Read by
`extractClassExpandedQueries` (classSpellListData.ts), `prepared` (power word
heal/kill at 20) is not read here. Sourced from the same-source class lists
(XPHB Cleric/Druid/Wizard).

**Same spell from another source** (11): Hunter's Mark — Oath of Vengeance,
Mark of Finding; Speak with Animals — Wild Heart, Oath of the Ancients, Mark of
Handling, Forest Gnome; Find Familiar — Mark of Handling, Pact of the Chain;
Mending — Mark of Making, Rock Gnome; Find Steed — Mark of Passage. Each is a
separate feature with its own limit, so no shared boxes across them.

### Sheet-review rule texts (F-7a) — prose only, no structured field

Checked by `scripts/investigate-f7a.js` (cleared after the task), markup
stripped first. One record each, all XPHB unless noted. Every amount below is
prose; the hand tables cite these sentences.

- **Draconic Resilience** (subclass, L3): "Hit Point maximum increases by 3,
  and it increases by 1 whenever you gain another Sorcerer level" — the total
  equals the Sorcerer level, not 3 + level.
- **Unarmored Movement** (Monk L2): "+10 feet while you aren't wearing armor or
  wielding a Shield". The real amount is the Monk `classTableGroups` column
  labelled exactly `"Unarmored Movement"`, cells `{type:"bonusSpeed",value}`
  (L1 0, L6 15) — the column exists from level 1 with value 0.
- **Fast Movement** (Barbarian L5) and **Roving** (Ranger L6): +10 ft "while you
  aren't wearing Heavy armor". Roving also gives Climb/Swim Speed equal to Speed
  (not computed).
- **Speedy** feat exists once (XPHB): "Your Speed increases by 10 feet", no
  condition.
- **Aura of Protection** (Paladin L6): bonus to saves = Cha modifier
  "(minimum bonus of +1)"; "inactive while you have the Incapacitated
  condition".
- **Disciplined Survivor** (Monk L14): proficiency in all saving throws.
  **Slippery Mind** (Rogue L15): Wisdom and Charisma saves.
- Fighting Style feats: **Archery** +2 to attack rolls "with Ranged weapons";
  **Defense** +1 AC "while you're wearing Light, Medium, or Heavy armor";
  **Dueling** +2 damage only holding a Melee weapon in one hand and no other
  weapons; **Thrown Weapon Fighting** +2 damage on a ranged attack with a
  Thrown weapon.
- **Aberrant Dragonmark** (EFA): the 1st-level pick is cast "once without a
  spell slot", regained on "a Short or Long Rest", and "You can also cast this
  spell using any spell slots you have". The feat's other benefit (the one
  Long-Rest limit) is separate — D119's two limits in one record.
- The background origin feat for Magic Initiate is stored under the
  "; Class" name (`Magic Initiate; Wizard` for Sage), the Human Versatile and
  ASI picks under base `Magic Initiate` — so two instances share a name only
  when both are base picks (species + ASI, ASI + manual, …).

### Rest rule texts (F-7b) — variantrules.json / conditionsdiseases.json, XPHB

Checked by `scripts/investigate-f7b.js` (cleared after the task), markup stripped.
Both rests are `variantrules.json` records (the 7 in rules.json are a different
subset); nothing named "Concentration" exists there.

- **Long Rest**: "To start a Long Rest, you must have at least 1 Hit Points."
  Benefits: all lost Hit Points and all spent Hit Point Dice back; Exhaustion
  level −1; "During sleep, you have the Unconscious condition." Nothing in the
  record says an interrupted rest gives partial benefits (not modelled).
- **Short Rest**: same "at least 1 Hit Points" start condition; each Hit Point
  Die spent heals "the total (minimum of 1 Hit Point)" — roll + Constitution
  modifier, clamped at 1.
- **Unconscious** (condition): "You have the Incapacitated and Prone
  conditions"; **Incapacitated**: "Your Concentration is broken." Together with
  sleep, a Long Rest ends Concentration.
