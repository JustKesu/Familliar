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