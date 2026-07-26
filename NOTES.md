# Project Notes

## Open questions

### Where will 5etools data live at deployment time (phase 1+)
For now: data stored locally in `data-source/`, not tracked by Git.
Problem: once the app runs from a URL, a browser on someone else's
computer can't see files on my disk. Data needs to be available
online somehow.

Options:
1. Data inside a public repo – simplest, works for everyone.
   Licensing question: MIT covers 5etools' code, not the content
   itself (which comes from WotC).
2. Private repo + deployment via Vercel/Netlify – data isn't
   publicly exposed for download.
3. Each user uploads their own JSON files, app stores them in
   the browser.

Decision needed before first deployment to a URL.
Until then, figure out how much data the app actually needs –
might be a fraction of the full set.

## Decisions
(empty for now)

### Subclass feature levels — RESOLVED
5etools already ships XPHB-converted versions of XGE/TCE subclasses,
with feature levels remapped to the 2024 progression (e.g. Forge Domain:
level 1 and 2 features folded into level 3, level 8 features dropped).
The originals (classSource "PHB") and the conversions (classSource "XPHB")
both exist in the same file.
Decision: filter subclasses by classSource "XPHB", not by source.
No manual level remapping needed.

### Content scope for phase 1
Sources: XPHB, XGE, TCE, EFA (2024-rules Artificer). Everything else
excluded for now. RHW (Reanimator subclass) deliberately skipped.

### Subclass filtering rule
Filter subclasses by `classSource` in ["XPHB", "EFA"], not by `source`.
All 57 XGE/TCE subclasses have XPHB conversions; all 4 TCE Artificer
subclasses have EFA conversions. Nothing is missing.
Caveat: Reanimator has source RHW but classSource EFA — excluded by an
additional check on `source` being in the allowed list.

### Species (races) scope
2024 species identified by `edition: "one"` (sources XPHB, EFA, RHW).
MPMM included as the 2014 species pool (30 entries) — it supersedes the
VGM/MTF versions, which are excluded as duplicates (all 14 have
reprintedAs pointing at MPMM).
MPMM entries carry an `ability` field (e.g. Aasimar cha +2); XPHB species
have none, because 2024 moves ability bonuses to backgrounds.
Decision: strip the `ability` field from MPMM species on extraction.
Ability bonuses always come from the background.