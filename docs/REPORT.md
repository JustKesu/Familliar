# TL-1 — two use limits per feature (D405)

Setup: fetch + `merge --ff-only` → "Already up to date", HEAD bef24fc. No subagent used.

## STEP 1 findings (scripts/tl1-texts.js, one record each, all split into exactly two limits)
- Aberrant Dragonmark|EFA: "Once you've used this benefit … until you finish a Long Rest" → **benefit** 1/LR; 1st-level spell "once without a spell slot … regain … Short Rest or Long Rest" → **spell** 1/SR.
- Natural Recovery|XPHB (Land 6): free Circle spell "must finish a Long Rest before you do so again" → **free spell** 1/LR; slot recovery (done on a Short Rest) "can't do so again until you finish a Long Rest" → **slot recovery** 1/LR.
- Magic Item Tinker|EFA (Artificer 6): Charge unlimited; **Drain** 1/LR, **Transmute** 1/LR.
- Old `resourceUses["Natural Recovery"]`: nothing reads a bare key any more; `afterLongRest` empties `resourceUses`, unclaimed keys are already left alone elsewhere (resourceUsesWithinMaxima, afterShortRest). Option chosen: **drop**, no mapping (a conflated max-1 count has no single target), no schema bump.

## Changed places (9)
- `src/calculation/resources.ts`: `TWO_INDEPENDENT_LIMITS` → exported `TWO_LIMIT_FEATURES` table (labels + rest, text cited), `subLimitKey`, `subLimitKeys`; `computeCharacterResources` emits two resources `Name (label)`, max known 1, own `shortRest`.
- `src/calculation/freeCastResources.ts`: `SHARED_OWNER_ANY_SPELL` — Aberrant Dragonmark's free cast spends `Aberrant Dragonmark (spell)` whichever spell was picked (D190 pattern), so the spell row and the feature row share one counter. The old `spell:feat:Aberrant Dragonmark…` key is dropped the same way.
- `src/sheet/CharacterSheet.tsx`: new `FeatureUses` component, used by Actions groups and Features & Traits; one plain `UseBoxes` for normal features, a labelled stack for two-limit ones.
- `src/index.css`: `.sheet__use-limits`, `.sheet__use-limit`, `.sheet__use-limit-label`.
- `scripts/validate-data.js`: HP bonus guard names list + comment now include Boon of Fortitude (4 names resolve).
- Tests: `resources.test.ts`, `freeCastResources.test.ts`, new `e2e/twoLimits.spec.ts`.
- Docs: D405 (DECISIONS), QUESTIONS entry removed, DATA.md texts, STATUS.md.

## Verified
- typecheck clean; unit 3474/3474; validate-data 177/177; e2e 736/736 (2.5 min).
- Unit: sub-limit names/max/rest for all three; `subLimitKeys` null for others; real-data guard now 80 known maxima (78 single uses, +6), `Aberrant Dragonmark (spell)` in the Short Rest set; Dragonmark free cast key.
- e2e `twoLimits.spec.ts`: a) Land Druid 6 — two Natural Recovery rows, one box each, labels, no bare counter, also on Features & Traits; b) using free spell leaves slot recovery, stored `{ "Natural Recovery (free spell)": 1 }`; c) Short Rest keeps both, Long Rest clears both; d) Wild Resurgence keeps its single unlabelled set, an old bare `Natural Recovery: 1` shows nowhere.

## Decisions taken in code
- Labels: benefit / spell, free spell / slot recovery, Drain / Transmute.
- Dragonmark spell limit shares the free-cast counter rather than a second independent box (avoids two counters for one limit).
- Old values dropped, not mapped; cleared at the next Long Rest.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Changed screens: Actions and Features & Traits rows of Natural Recovery (Land Druid 6+), Aberrant Dragonmark (feat), Magic Item Tinker (Artificer 6+) — two labelled box lines right-aligned in the row.
