# CLAUDE.md

## The four rules that cost the most

This project runs on a personal token budget and that budget is the binding
constraint. Breaking any of these four either burns the budget or interrupts
the user; everything below them is about doing the work well.

1. **Never open a file in `data/`, `data-source/` or `public/data/`.** Not
   with the file tool, not with `cat` or `Get-Content`, not "just the first
   few lines", not to check one field. One read of `items.json` costs more
   than a whole task. The only route is a script that prints a summary — see
   "Data files".

2. **List and read files with the built-in Glob, Grep and Read tools, never
   with a shell command.** Those tools need no permission, so they never
   interrupt the user; a shell listing does. This exact call has happened and
   must not happen again:

       powershell -NoProfile -Command "Get-ChildItem -Path src -Directory | Select-Object -ExpandProperty Name"

   Use Glob. The shell is for npm scripts, `node scripts/...` and git —
   nothing else.

3. **One plain command per call.** A single command and its arguments:
   no `|`, no `&&`, no `||`, no `;`, no redirection (`>`, `2>/dev/null`), no
   `cd` (every session starts in the repo root). Anything else falls outside
   the permission allowlist in `.claude/settings.json` and prompts the user on
   every run. If output is too long, make the script print less and run it
   again — never filter it in the shell.

4. **Two failures of the same command end the attempt.** Fix an obvious
   mistake in it and run it once more. If that fails, STOP: write down what
   you were trying to achieve, the exact command and the exact error, and end
   the task. A tool that refused twice will not yield on the fifth try, and a
   task that stops early is cheap to resume.

## Scope

One task per session. Do not expand scope beyond what was asked. If a prompt
appears to contain several separate tasks, do the first one and tell the user
the rest need their own session.

## Data files

The only way to look at that data is a script in `scripts/` that prints a
SUMMARY: counts, plus at most 3 short examples. The script's output lands in
context too, so keep it small on purpose — never print whole entries, whole
arrays or whole files. The same applies to `package-lock.json`, `dist/` and
`node_modules/`.

If a script has already printed what you needed, that summary is your source.
Do not "verify" it afterwards by opening the data file — the summary was the
point.

Phrase searches over `data/` must strip 5etools markup before matching, or
they find a fraction of the real hits. DATA.md records why.

## Investigation scripts

An investigation script PRINTS its summary to the console. It never writes
output into the repository — no `.txt` beside the script, no generated report
committed next to it. The console output is the deliverable and it reaches the
user through the report you write.

A one-off survey test is either rewritten as a permanent guard worth running on
every build, or it is not created at all. Several files nobody wants have
already accumulated here because a task produced scaffolding and could not
remove it afterwards.

The script itself must be written to disk to run at all. Do not try to delete
it with `rm` or `Remove-Item`; both are refused here. Clear it AFTER the commit
and push at the end of the task, with this exact command, on its own and only
ever with that path:

    git clean -fd scripts

It removes only untracked files under `scripts/` — which by that point is
exactly the investigation scripts, because anything worth keeping was committed
a moment earlier. It cannot touch tracked code.

## Verification

Do not re-run the full suite after every intermediate step. Run typecheck,
tests and validate-data once, at the end of a task.

**The browser is the most expensive thing a task here does.** Open it only when
the task changed what a control DOES: a button that now displaces something, a
picker that now enforces a count, a state that has to survive a reload. Do NOT
open it when the task changed a number — tests cover those, and a browser walk
adds cost without adding certainty.

**Never take screenshots.** They are the single largest cost and in this project
they have repeatedly come back blank. Read the page's text and its DOM instead;
that is what the assertions are made of anyway.

A browser check never replaces a test. If the server will not start or a screen
cannot be reached, say so in the report as unverified — never report as verified
something you did not see.

## Reporting

At the end of every task, write a report to `docs/REPORT.md`, overwriting the
previous one. Do this regardless of task size.

The report is read by the planning agent that scopes the next task, not by a
beginner learning to code. Write it densely and technically: no explanations of
programming terms, no restating what the code plainly does, no encouragement.
Cover three things — what changed, what was verified, and what needs the user's
decision. Aim for under 40 lines. Code blocks only where a data shape or an
error message is itself the finding.

## Documentation

Seven files, each answering one question: CLAUDE.md (how the agent works),
SPEC.md (what the app must do), DECISIONS.md (why things are the way they are),
STATUS.md (what exists now and what is next), QUESTIONS.md (what is not decided
yet), DATA.md (how the 5etools data behaves), REPORT.md (what happened last
session). All of them live in `docs/` except CLAUDE.md itself.
MARKUP-INVENTORY.md is generated by `npm run survey-markup` and is never edited
by hand.

**Update, without being asked:** STATUS.md, every time a task changes what
exists. It is the only file the agent keeps in step with the code.

**Never change on your own initiative:** SPEC.md, DECISIONS.md, QUESTIONS.md.
Those are the user's. If a task's findings make one of them stale or wrong, say
so in REPORT.md and leave the file alone — unless the prompt for that task
explicitly asks for the edit.

DATA.md is where everything learned about how the 5etools data behaves is
recorded — not only changes to the extraction scripts or the shape of `data/`,
but any finding from an investigation, INCLUDING one that changed no code. If a
task discovers how the data actually behaves, that belongs in DATA.md in the
same task, as well as wherever else it is cited. A finding recorded only in
REPORT.md is lost at the next task, and one recorded only as the rationale of a
decision is not findable by someone asking about the data.

Decisions are added to DECISIONS.md, never rewritten in place; a reversed
decision gets a new entry recording the reversal. Documentation edits stay
factual and short, and do not restate reasoning that is already recorded.

## Undecided questions

When a task hits a question the documentation does not answer — a rule that
could reasonably be implemented more than one way, a data shape nobody has ruled
on, a conflict between two existing decisions — stop and ask rather than
choosing and continuing. A quiet choice ends up buried in code, nobody knows a
decision was made, and it surfaces later as rework.

Two exceptions, where continuing is correct: the answer is already recorded in
the documentation and simply had not been read yet, or the choice is genuinely
internal to the implementation and invisible in behaviour, data shape and UI
(variable naming, file layout within a module, which loop to write).

When stopping to ask, state what the question is, what the plausible answers
are, and what each would mean for the user — not just that you are stuck.

In REPORT.md, list any decision that was needed and taken during the work, and
any question noticed and worked around. One line each. Decisions in
DECISIONS.md and open questions in QUESTIONS.md stay the user's to settle
regardless.

## Git

At the end of every task, after typecheck and tests have run, commit all
changes with a short message naming the build order step or slice, then
immediately push to `origin/main`. Never leave a finished task uncommitted. If
typecheck or tests fail, do not commit — report the failure instead.

If the task wrote an investigation script, clear it after the push — see
"Investigation scripts".

An uncommitted change to a `.md` file in `docs/` or to CLAUDE.md that the task
did not make was written by the user between sessions. Include it in the commit
exactly as it stands, and say in the report that you did. Do not edit it, do not
unstage it, and do not ask — it is a decision the user has already made, and
leaving it behind means the next session works from documentation that does not
match the repository. This applies only to those documentation files; an
uncommitted change anywhere else is a surprise worth stopping for.

## Running commands

Use the npm scripts defined in `package.json` (`typecheck`, `test`, `build`,
`validate-data`, `survey-markup`) rather than invoking tools directly via
`npx`. The npm scripts are pre-approved in `.claude/settings.json`; `npx` is
not, so every `npx` call costs a permission prompt.

Prefer one command that answers the question over several exploratory ones. If
you find yourself running more than about 10 commands to answer one question,
stop and tell the user what you are stuck on instead.

Do not guess at two possible paths with a fallback. If you do not know where
something lives, use the search tool.

Write temporary scripts into `scripts/`, not into `/tmp`, and run them as a
separate command.

## Comments

Comments explain WHY, never WHAT. The code already says what it does; a comment
restating it is waste.

Write a comment only when the reason is not visible in the code itself — a rule
taken from the PHB, a data trap recorded in DATA.md, a constraint from a
numbered decision (cite it as D<n>). One or two lines. Never a paragraph.

Do not write comments explaining the code to a non-programmer. The user does not
read the code; explanations belong in REPORT.md.

Do not add file-header comments summarising a module, except the one D14
requires on temporary scaffolding.

Leave existing comments alone unless the code under them changes.
