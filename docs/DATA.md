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
  node scripts/validate-data.js    # 103 checks, exit code 1 on failure

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
XMM (Monster Manual 2025) is NOT in the allowed list — monsters are a
separate feature, not needed for a character sheet.

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

### Spell availability: `classes` vs `classVariants`
XGE and TCE spells were never on core class lists — they're granted as
optional/variant content and land in `classVariants`, not `classes`.
91 spells have an empty `classes` array but a populated `classVariants`;
0 have no availability at all (measured against the current filtered
data/spells.json, 489 spells — an older 109 figure was measured against a
larger/unfiltered set).
The UI must read both, ideally flagged differently, or every XGE/TCE
spell will look uncastable.

### `casterProgression` names a table, not a class
`casterProgression` (data/classes.json) names a shared spell-slot
progression TABLE, not a class. Paladin and Ranger both carry the value
"artificer" — the same value the actual Artificer class carries — because
all three are half-casters sharing one slot progression. Code reading this
field must treat the value as a table name, never as a class-identity
check. Values seen: "full", "pact" (Warlock), "artificer" (Artificer,
Paladin, Ranger). Non-casters (Barbarian, Fighter, Monk, Rogue) have no
`casterProgression` field at all.

### Armour AC — the data won't tell you
`ac` is the base number. There is NO Dex cap field; the cap is implied by
the armour type code (LA light = uncapped, MA medium = +2, HA heavy = none).
The AC calculation must hardcode that rule.
`strength` is a string ("13") or null; `stealth: true` means disadvantage.

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

## 50 extraction warnings, all in discarded sources

PHB (30) and EGW (20), all 2014 Dragonborn variants. They never reach
output. If EGW is ever allowed, the 20 need investigating first.

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

### Feats — čím pole `senses` a `speed` NEJSOU

Žádný ze 128 featů nemá pole `speed`. Pole `senses` má jen 3 featy
a vždy jde o blindsight nebo truesight, nikdy darkvision — jediný
smysl, který appka počítá. Ani jedno tedy nemá kam se promítnout.