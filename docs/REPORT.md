# SM-1: Infernal Warrior tag, Money Talks e2e, name field gap, Tortle warning

Setup: fetch + ff-only merge clean, HEAD fe7555c at start. No commit/push problems expected (see bottom if any).

## Changed
- **1) Infernal Warrior**: survey (`scripts/sm1-grapple-tag.js`, markup stripped) — official XPHB has 2 strings pairing Unarmed Strike with grapple, one shape: `Grapple or Shove option of your {@variantrule Unarmed Strike|XPHB}` ("Grapple" untagged). `HOMEBREW_WORDING` "Infernal|Infernal Warrior" now reads `the Grapple option of your {@variantrule Unarmed Strike|XPHB}`. `npm run extract-data`: only `data/subclass-features.json` changed (git status; I could not diff-stat, `git diff` is denied). DATA.md updated.
- **2) Money Talks**: Bard/Mercantile feature, level 6 (verified by script). New scenario in `e2e/tgs2Wording.spec.ts`: Bard 6 Mercantile, feature text contains "the Magic action", not "use an action"; Actions tab → Action region has a Money Talks row (`.first()` — row count not pinned).
- **3) Character name gap**: NO CHANGE. `label.wizard__field` is already `flex column; gap: 4px` (index.css:542-546). The other labelled wizard inputs use the same 4px: `.feat-asi-card__field` index.css:3280, `.species-picker__field` index.css:3373. `.wizard__field` is used in 3 places (CharacterWizard.tsx:1911, BackgroundPicker.tsx:94, ClassSwitcher.tsx:15 — a div). Matching "the gap others use" = already satisfied.
- **4) Tortle warning**: no duplicate found in code. `ValueBreakdown.tsx:26` prints `source: note` verbatim, `ArmourClassNotes` (SheetHeader.tsx:56) adds nothing, no CSS pseudo-content. Added to `e2e/speciesNatural.spec.ts` S5 d: AC breakdown dialog text matches /warning/gi exactly once — passes. The text reads "Leather Armor worn: warning: by the rules a Tortle cannot wear armor" (one "warning").

## Verified
typecheck clean; test 3444/3444; validate-data 177/177; e2e 694/694 (2.6 min).

## Decisions needed from you
- 3): if the name field should sit further from its label, pick a value (e.g. 6px or 8px) — it would be a deliberate departure from the 4px used by every other labelled input; I did not choose one.
- 4): if you saw a doubled word on screen, it is not "warning" twice in the DOM; possibly the note text itself reads oddly ("worn: warning: by the rules") — send the screenshot or wording wanted.

Decisions taken: none. Subagents: none.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots. Changed screens: Infernal Warrior feature text (Barbarian, Path of the Infernal, Features & Traits); Money Talks row (Bard 6 Mercantile, Features & Traits / Actions); no visual change on wizard step 1 or the Armour Class drawer.
