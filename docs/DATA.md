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

The drops are entries superseded by a newer reprint we also keep (e.g. TCE
"Chef" superseded by its XPHB reprint) — see extract-data.js's
`removeSuperseded()` and "Nine species names occur twice" below. `validate-data.js`
now asserts these counts and checks that no superseded duplicate survives.

Feature origin (2026-09-21, one-off survey): all 302 class-features records
carry `className` and a numeric `level`; all 786 subclass-features records
also carry `subclassShortName`. The sheet's origin label ("Fighter 2",
"Champion, Fighter 3") reads these, so every granted class/subclass feature
has one. Optional-feature picks have no such level (D99 — a wizard pick
records none), and species traits are not listed on the sheet at all.

## Traps — things that silently break

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

### `damageInflict` and the `choose` spell-prerequisite filter grammar

A spell's `damageInflict` (array of damage types, absent when the spell deals none) is how "deals damage" is read structurally — never from a hand-written list of spell names (D21).

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

UID v odkazech ref* je totožné s polem id.

### Feat `ability` — 13 pevných, 68 s volbou, vždy +1

82 featů nese pole `ability`. 13 z nich zvyšuje vždy tutéž vlastnost,
68 nechává hráče vybrat z 2-6 jmenovaných, vždy +1 té vybrané.
Žádný feat obojí nemíchá a žádný nenabízí jiné rozdělení bodů.
Pozor na počet: dřívější zadání mluvilo o 70 choice featech — ty dva
navíc byla samotná "Ability Score Improvement", kterou picker
z nabídky featů vyřazuje.

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

Beast trait/action text uses eight markup tags that occur nowhere else in
data/: `{@atkr}`, `{@h}`, `{@recharge}`, `{@actTrigger}`, `{@actResponse}`,
`{@actSave}`, `{@actSaveFail}`, `{@actSaveSuccess}`. All eight are handled in
src/markup/tags.ts. Adding any further bestiary content will likely bring
more of that family with it (`{@m}`, `{@hom}`, `{@actSaveFailBy}`,
`{@actSaveSuccessOrFail}` exist in 5etools but do not occur here).

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
- `languageProficiencies: [{any:1}]` — Prodigy only.
- `expertise: [{anyProficientSkill:1}]` — Boon of Skill, Prodigy, Skill Expert.
- `skillToolLanguageProficiencies: [{choose:[{from:["anySkill","anyTool"],count:3}]}]`
  — Skilled only. TRAP: here `choose` is an ARRAY of groups, unlike every other
  `choose` above (an object). Any mix of skills and tools, 3 in total.

Repeatable: only Skilled among these (and it is also an origin feat 3
backgrounds grant). Of the 25 distinct origin feats backgrounds grant, three
carry a proficiency choice: Skilled, Crafter, Musician. (An earlier count of
26 took Noble's capitalised "Skilled|xphb" as a second feat.) Every background's
`feats` is a single fixed `{"name|source": true}`; the only species with a
`feats` field is Human (XPHB): `[{anyFromCategory:{category:["O"],count:1}}]`,
a free pick of any Origin feat. No feat carries a `feats` field.

Found in the feat-choice-storage investigation (2026-09-22, script consumed).

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
výsledky na zlomek skutečného počtu.
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
