# Questions

Things not yet decided. An entry leaves this file only by being decided,
at which point it moves to DECISIONS.md.

---

### Fluff / lore text

Species and spell descriptive text and images live in separate
fluff-*.json files, matched to entries by name, and are currently NOT
extracted (DATA.md). Decide whether the sheet needs it. Leaning: not
needed for phase 1, mechanical text is enough.
STATUS: undecided.

### Magic Initiate parent entry

`_versions` expansion keeps the generic parent feat selectable next to
its three class variants, matching 5etools. For a character sheet the
generic one is probably not a valid pick. Decide whether to hide parents
that have variants.
STATUS: undecided.

### Where data lives at deployment

Currently data/ is tracked in git and would deploy with the app.
Options if that becomes a licensing concern:
1. Public repo (current default) — simplest, works for everyone.
   MIT covers 5etools' code, not the content itself (WotC).
2. Private repo + Vercel/Netlify — data not publicly downloadable.
3. Each user uploads their own JSON files, stored in the browser.
Revisit before first deployment to a URL.
STATUS: deferred.

### EFA background count — worth verifying

EFA contributes 17 backgrounds, more than XPHB's 16. Surprising for a
single-class book. Not blocking; sanity-check against the book sometime.

### Browser verification by the agent — deferred, revisit at build order step 5

The app is currently verified by hand: the user runs `npm run dev` and
clicks through the UI. Automated tests cover pure logic and, since the
wizard was built, component behaviour through a simulated DOM (see D8,
"Tests — static HTML for the renderer, a real DOM for interactive
components"). Nothing verifies the app as it actually renders in a real
browser.

The option considered was connecting Claude Code to a real browser
through the Playwright MCP server, letting it navigate to the dev
server, click through a flow and assert on what it finds. Deliberately
NOT set up, for cost reasons: each look at a page returns the full
accessibility tree, which is expensive in context, and a session that
clicks through the whole creation wizard would spend a large share of
its budget on that alone.

Decision for now: manual verification by the user continues. Revisit
when build order step 5 (sheet display) begins — the sheet is a large,
dense, frequently re-rendered screen where a real browser check would
pay for itself. If adopted, it should be used for narrow, named checks
("fill steps 1 and 2, go back, assert step 1 still shows its
selection"), not open-ended "click around and tell me if it looks right".
