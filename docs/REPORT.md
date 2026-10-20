# REPORT F-37

| Item | File | Change |
|---|---|---|
| a | SubclassSpellChoicePicker.tsx:33, :101 | Picker is now `<section className="wizard__card …--subclass-choice">` with `<h3>` feature name (Abjuration/Divination/Evocation/Illusion Savant, Lore: Magical Discoveries) and one note line (wizards: "These spells are added to your spellbook for free."; Lore: always prepared, count as Bard spells). Feature names are a hardcoded map keyed like SUBCLASS_SPELL_CHOICE_KEYS. |
| a | SubclassSpellChoicePicker.tsx:117 | Label "Level 3, choice 1:" / "Level 3, choice 2:" when several slots share a level; single slots stay "Level 5:" etc. |
| b | CharacterSheet.tsx:608 | No change: already a `DamageRollButton` via SpellDamageLine; covered by existing e2e/breathWeapon.spec.ts S3 a-c. Only an unchosen ancestry shows no dice (UnresolvedValue). |
| c | subclassData.ts:239 | `subclassesFor` result sorted with compareText. |
| d | — | STOPPED after step 1 (see below). No code change. |
| e | HitPointsPicker.tsx:140 | While any row is invalid, the breakdown replaces that level's "average, no choice recorded" row with "level N: enter a value" (no amount) and drops the "per-level hit points … no choices recorded" header row. Maximum stays "—". maxHitPoints.ts unchanged. |

(d) Effect cell: `leveledSpellDice` (spellActionRowData.ts:259) emits one line per distinct `{@damage}` tag in entries plus unmatched `{@scale…}` bases; `cantripDamageAtLevel` one per `scalingLevelDice` entry with its label. Survey (scripts/investigate-multi-dice-spells.js, left untracked — git clean forbidden by the task): 30 action-row spells with >1 line; 9 cantrips already labelled by `scalingLevelDice.label`, 21 leveled unlabelled. Examples:
```
Melf's Acid Arrow|XPHB  4d4 "… Acid damage and 2d4 Acid damage at the end of its" / 2d4 "… Acid damage at the end of its next turn"
Ice Knife, Bigby's Hand, Witch Bolt, Vitriolic Sphere, Wall of Ice, Storm Sphere, Enervation …
```
Over 15 and the text after each tag differs per spell, so no single rule. Recorded in DATA.md (Leveled spell dice). Needs user decision: hand-written label table per spell, or leave unlabelled.

e2e: a — multiclassEndToEnd.spec.ts M11b finding 1 extended (wizard__card, heading "Evocation Savant", note, both "Level 3, choice N:" labels). b — existing breathWeapon.spec.ts S3 c. c — rhw.spec.ts "F-37 c" (Fighter 3 Choose buttons in en-collator order). e — wizardW6.spec.ts "F-37 e".

Verified: typecheck; test 3373 passed; validate-data 175/175; e2e 600 passed in 6.9m (over the 3 minute guideline).

Decisions taken: Lore's card note text and feature name chosen from PHB 2024 (Magical Discoveries); label wording "Level 3, choice 1" rather than bare "Choice 1" to keep the level visible.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots.

Changed screens: wizard Spells step for Abjurer/Diviner/Evoker/Illusionist 3+ and College of Lore 6+ (new card); wizard Class step subclass list order; wizard Hit points step breakdown with an invalid Manual value.
