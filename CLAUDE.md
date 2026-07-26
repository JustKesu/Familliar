# CLAUDE.md

## Reporting

At the end of every task, write a report to `REPORT.md` in the repository root, overwriting the previous one. Do this regardless of task size.

Write it for a non-programmer. Cover three things: what changed, what was verified, and what needs my decision. Aim for under 40 lines. No code blocks unless something failed.

## Data files

Never read files in `data/` or `data-source/` into context. They are large generated data.

Use scripts, tests, or a counting command instead. If you need to see the shape of an entry, read one entry via a command, not the file.

## Verification

Do not re-run the full verification suite after every intermediate step. Run typecheck and tests once, at the end of a task.

## Git

After creating any commit, immediately push it to `origin/main`.
