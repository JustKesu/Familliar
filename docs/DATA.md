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
  node scripts/validate-data.js    # 129 checks, exit code 1 on failure

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
  data/items.json               943 -> 899  (XDMG 593, XPHB 217, TCE 84->80,
                                      XGE 43->3, EFA 6)
  data/languages.json             0 -> 19   (XPHB 19) — new category
  data/beasts.json               89 -> 96   (XMM 96) — 90.3 KB; type Beast at
                                      CR <= 6 (89) plus the 8 Pact of the
                                      Chain forms, 7 of them not Beasts, D67

The drops are entries superseded by a newer reprint we also keep (e.g. TCE
"Chef" superseded by its XPHB reprint) — see extract-data.js's
`removeSuperseded()` and "Nine species names occur twice" below. `validate-data.js`
now asserts these counts and checks that no superseded duplicate survives.

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

### Identifying item kinds
Weapons and armour have boolean flags (`weapon`, `armor`).
Shields have NO flag — identify by type abbreviation "S".
Containers have NO flag — identify by presence of `containerCapacity`.

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