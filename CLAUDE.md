# CLAUDE.md

## Scope

One task per session. Do not expand scope beyond what was asked. If a prompt appears to contain several separate tasks, do the first one and tell the user the rest need their own session.

## Reporting

At the end of every task, write a report to `REPORT.md` in the repository root, overwriting the previous one. Do this regardless of task size.

Write it for a non-programmer. Cover three things: what changed, what was verified, and what needs my decision. Aim for under 40 lines. No code blocks unless something failed.

## Data files

Never read files in `data/` or `data-source/` into context. They are large generated data.

Use scripts, tests, or a counting command instead. If you need to see the shape of an entry, read one entry via a command, not the file.

When investigating the shape of `data/` or `data-source/`, write a script to `scripts/` and have it print a SUMMARY: counts, and at most 3 examples. Never print whole entries or whole files to the console — the output lands in context and is the single biggest cost in this project.

## Documentation

Every task keeps the project documentation in step with the code, alongside writing REPORT.md.

**Update, without being asked:** NOTES.md "Where we are" and "Next step", and the build order status in PHASE1.md section E (marking steps or slices done, in the same style as the steps already marked DONE). These record what exists, and a task that changes what exists must leave them true.

**Never change on your own initiative:** any decision in PHASE1.md section D, any open question in PHASE1.md section F, or any decision in NOTES.md. Those are the user's to settle. If a task's findings make one of them stale or wrong, say so in REPORT.md and leave the file alone — unless the prompt for that task explicitly asks for the edit.

Documentation edits stay factual and short. Do not restate reasoning that is already recorded.

## Verification

Do not re-run the full verification suite after every intermediate step. Run typecheck and tests once, at the end of a task.

## Git

After creating any commit, immediately push it to `origin/main`.

## Running commands

Use the npm scripts defined in `package.json` (`typecheck`, `test`, `build`, `validate-data`, `survey-markup`) rather than invoking tools directly via `npx`. The npm scripts are pre-approved in `.claude/settings.json`; `npx` is not, so every `npx` call costs a permission prompt.

Prefer one command that answers the question over several exploratory ones. If you find yourself running more than about 10 commands to answer one question, stop and tell the user what you are stuck on instead.
