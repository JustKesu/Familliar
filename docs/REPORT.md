# REPORT — TGS2-3: ZASTAVENO po STEP 1 (text se liší od zadání)

HEAD po `git merge --ff-only origin/main`: 115051f („Already up to date“). Nic neimplementováno: extract-data.js, data/, src/, e2e/, DATA.md, STATUS.md, DECISIONS.md beze změny. Část B nezačata (zadání ji řadí za část A). Typecheck/test/validate/e2e nespuštěny — kód se neměnil.

## STEP 1 — souhrn (scripts/tgs2-pools.js, nesledovaný, necommitnut)
| prvek | podtřída, úroveň | text (bez markupu) | odpovídá zadání |
|---|---|---|---|
| Launch | Fighter / Steel Hawk 3 | „You can use this feature three times, and you regain all expended uses of it when you finish a short or long rest.“ + „Beginning at 7th level … four times between rests, and beginning at 15th level … five times“ | ano (3/4/5, 3/7/15, SR) |
| Improved Launch | Fighter / Steel Hawk 18 | „Once you use this feature, you **shouldn't do so again before** you finish a short or long rest.“ | počet ano; formulace jiná |
| Bloodbound | **Rogue / Grim Surgeon 17** | „Once you use this feature, you can't use it again until you finish a short or long rest.“ | počet ano; **třída ne** (zadání e2e c) říká Barbarian) |
| Sight Beyond Sight | Monk / Aether 17 | „Once you **cast this spell**, you can't **cast it again** until you finish a long rest.“ | počet ano; formulace jiná |

Jiné prvky z 46 s pevným počtem a odpočinkem:
- **Ranger / Rocborne 15 Hurricane**: „Once you use this feature, you can't use it again until you finish a short or long rest.“ — stejný vzor jako Bloodbound, mimo seznam → podmínka STOP.
- Paladin / Spelldrinker 20 Arcane Conduit: totéž, ale „long rest“ (1/LR).
- Monk / Aether 11 Ghost Walker: počet = WIS mod (D43 unknown, ne pevný). Rogue / Grim Surgeon 9 Field Surgeon: limit per tvor, ne pool.

## Proč nestačí jen přepsat slova na tagy
`isSelfLimitedFeature` (resources.ts:114) chce rest tag A frázi `EXPENDED_USES`; `isImplicitSingleUse` chce `SINGLE_USE_RECHARGE` = „can't (do so|use it|use this feature|use this benefit) again until you finish a … Rest“.
- Launch, Bloodbound (a Hurricane, Arcane Conduit) po přepisu tagů projdou stávající cestou.
- Improved Launch („shouldn't do so again before“) a Sight Beyond Sight („can't cast it again“) **neprojdou** — nevzniknou jako pool. Zadání pro tento případ říká STOP.

## Otázky pro uživatele
1. Hurricane (1/SR) a Arcane Conduit (1/LR): přidat do D367 také, nebo nechat bez počítadla? Přidání = dva další trackery zdarma (stávající cesta je přečte po přepisu tagů).
2. Improved Launch a Sight Beyond Sight: (a) v normalizaci přepsat i jejich větu na znění, které app zná („you can't use it again until you finish a Short or Long Rest“ / „… a Long Rest“) — žádný nový kód v src/, ale mění se homebrew text; (b) rozšířit `SINGLE_USE_RECHARGE`/`EXPENDED_USES` v resources.ts o „shouldn't do so again before“ a „can't cast it again“ — nová logika v src/, týká se jen těchto dvou textů; (c) bez počítadla.
3. Bloodbound je Rogue (Grim Surgeon 17), ne Barbarian — e2e c) přepsat na Rogue 17 Grim Surgeon? (předpokládám ano, jen chyba v zadání).

## Rozhodnutí během práce
- Nic neimplementováno; Launch tabulka a tagy čekají na odpovědi výše.
- Nesledované docs/REPORT-*.md, CLAUDE-1.md aj. ponechány mimo commit (ležely nesledované i přes předchozí commity).

## Subagent
Nepoužit.

Manual browser check for the user: none - nothing changed in the app.
