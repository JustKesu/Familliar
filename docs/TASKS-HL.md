# Block HL - manager run (approved by the user 12. 11. 2026)

Source: test characters Hexadin (Tiefling Paladin 7 Vengeance / Warlock 5 Hexblade XGE, Pact of the Blade)
and Lirael (High Elf Wizard 18 Bladesinger), built at commit 1f985e3.

This run is an APPROVED EXCEPTION to "one task per session" and to the narrow-subagent rule in CLAUDE.md:
the main session is the MANAGER, each task below is done by ONE implementation subagent, strictly one
after another (never two subagents at once). Every other CLAUDE.md rule binds the manager and every subagent.

## How the manager works

1. Do the tasks in the order PC-1, LH-1, FS-1, WM-1. Before starting, empty docs/REPORT.md and write a heading
   "Block HL - manager run" plus a status table (task, commit, result).
2. For each task spawn ONE subagent with the model given at the task. Its prompt = the full task text below
   + these rules: CLAUDE.md applies; Edit files only with Edit/Write, never cat, heredoc, sed or any shell
   command; Read files with Read and Grep, not the shell; never Read a big file whole (CharacterSheet.tsx,
   CharacterWizard.tsx, wizardState.ts, CharacterSheet.test.tsx, characterStore*.ts, validate.ts,
   inventoryData.ts, index.css, scripts/extract-data.js, e2e/multiclassEndToEnd.spec.ts) - Grep for anchors
   and Read with offset/limit; run one e2e file only with exactly npm run e2e -- e2e/<file>.spec.ts, never
   npx; do not run git clean, git checkout, git switch, git commit or git push; do STEP 1 (table of every
   place it will change) first and obey every STOP rule of the task; write the next free D number into
   docs/DECISIONS.md (Czech, same style as the last entries, ending "Zadal plánovací chat (HL) 12. 11. 2026.");
   at the end return a short summary: files changed, D number, tests added, open questions, any STOP.
3. When the subagent returns, the manager CHECKS the work itself (do not trust the summary):
   - git status and git diff - every acceptance point of the task is really in the code, nothing unrelated
     changed, no new name exceptions or invented data;
   - npm run typecheck, npm test, npm run lint, then the full npm run e2e;
   - the new e2e scenarios exist and assert the numbers from the task.
4. If something is missing or a check fails: spawn ONE fix subagent (same model) with the exact list of
   problems. After that, check again. If it still fails: do not commit that task, run
   git stash push --include-untracked -m "HL <task> failed", write why in REPORT.md and go on to the next task.
5. If the task passes: stage the changed files by path (never git add .) including docs/DECISIONS.md and
   docs/REPORT.md, then git commit -m "<task id>: <short text> (D<number>)" with no semicolon or special
   characters, then git push origin HEAD:main. If commit or push is refused, say so at the top of REPORT.md.
6. A task that STOPs (its STOP rule fired) is not a failure: record the STOP and the reason, commit whatever
   finished part of it passes the checks, go on.
7. After WM-1: update docs/STATUS.md (English) and close with one REPORT.md section per task: what changed,
   D number, commit, tests, subagent use, decisions taken in code, questions for the user written for a
   beginner (one sentence what the problem means at the table, then the options). The report line
   "Manual browser check for the user: none - the planning chat checks the looks from screenshots." plus
   the list of changed screens. Do not take screenshots.
8. If the usage limit or context runs low, stop after the current task is committed and say where it stopped.

## PC-1 - Pact weapon uses Charisma (model: opus)

XPHB Pact of the Blade: "you can use your Charisma modifier for the attack and damage rolls instead of
Strength or Dexterity". Today abilityFor in src/calculation/weaponAttacks.ts (~line 203) knows only STR, DEX
and Martial Arts. For a weapon row marked pactWeapon (D401, canBePactWeapon D408) offer CHA in the ability
choice, the same way the Finesse selector works (abilityChoice), default = the highest of the options. The
breakdown shows Charisma. Only the pact weapon: Hex Warrior (Hexblade XGE) without the pact is NOT in scope.
Hexadin check: Longsword pact weapon +7 (STR) becomes +8 (CHA 18 with +4, prof +4).
E2E (extend e2e/pactWeapon.spec.ts): a) pact Longsword shows CHA to hit and damage; b) switching back to STR
works; c) the same Longsword without the pact mark has no CHA option.
STOP rule: if pactWeapon is not visible where abilityFor runs and making it visible needs changes in more
than ~15 places, STOP and propose a split.

## LH-1 - Lay on Hands pool (model: sonnet)

Lay on Hands (Paladin XPHB) = healing pool of 5 x Paladin level, back on a Long Rest. The data has only prose,
no column. Add a hand-written table row like LEVEL_SCALED_USES in src/calculation/resources.ts (new small
table "multiple of class level": Lay on Hands, Paladin, x5), so the pool is counted by Paladin level only
(multiclass Hexadin Paladin 7 / Warlock 5 = 35). It must appear in Actions and Features; pool > 10 is drawn as
the existing spent/max counter (UseBoxes in CharacterSheet.tsx ~line 588, steps of 1 - keep that, do not
build a new control). Long Rest restores it, Short Rest does not.
E2E (new e2e/layOnHands.spec.ts): a) Paladin 1 shows 5, Paladin 7 / Warlock 5 seed shows 35; b) spend 3,
counter shows 3/35; c) Short Rest keeps it, Long Rest resets it.
STOP rule: if Lay on Hands already has a uses source somewhere (consumes, table column), STOP and report.

## FS-1 - Blessed Warrior and Druidic Warrior in the Fighting Style choice (model: opus)

feats.json has class-only fighting styles with category FS:P (Paladin) and FS:R (Ranger) (DATA.md "Feat
categories"). The Fighting Style pickers filter category === 'FS' only (src/fightingStyle/fightingStyleData.ts
~line 88, src/optionalFeatures/optionalFeatureData.ts ~188, src/optionalFeatures/pickSources.ts ~19,
src/featureResolver/resolveRef.ts ~121, src/sheet/ManageFeatsPanel.tsx ~253). Paladin 2 must also offer
FS:P feats, Ranger 2 FS:R feats - only for that class, never for Fighter or for a Fighting Style feat. Both are
already in FILTER_CHOICE_FEAT_KEYS (src/storage/character.ts ~line 1027): the choice of 2 cantrips (Cleric for
Blessed Warrior, Druid for Druidic Warrior) must work in the wizard, level up and Edit, and the cantrips show
in Spells (CHA for Blessed, WIS for Druidic). First find in DECISIONS.md how fightingStyle is stored per class
(D-number into STEP 1).
E2E: a) Paladin 2 picker lists Blessed Warrior, Fighter does not; b) pick it with Guidance + Sacred Flame, both
on the Spells tab; c) Ranger 2 Druidic Warrior same.
STOP rule: STEP 1 table; if more than ~20 places, STOP and propose a split. If a style's text fits no
existing pattern, STOP for that style only.

## WM-1 - Spell Mastery, Signature Spells + two small fixes (model: opus)

A) Spell Mastery (Wizard 18, XPHB): pick one level 1 and one level 2 Wizard spell (action casting time);
cast them at their lowest level without a slot while prepared. B) Signature Spells (Wizard 20): pick two
level 3 Wizard spells, always prepared, each cast once without a slot, back on a Short or Long Rest. Today
both are text only. New per-character field (schema 68 -> 69, migration, follow the pattern of genieKind
D407 for the ~20 places). Choice appears in level up and Edit like other class options; picks show on the
Spells tab marked "at will" / "1 free cast" with a use box for Signature Spells. Pick from the Wizard spell
list (the spellbook comes later - say in DECISIONS that the source will change with the spellbook).
C) Hexblade's Curse (Warlock Hexblade XGE) gets 1 use, back on Short or Long Rest (text "short or long rest",
no tag in data - hand-written table row). D) Devil's Sight (invocation) adds "Devil's Sight 120 ft." to
Senses (follow src/sheet/grantedSenses.ts).
Update hard-coded schemaVersion in e2e (levelOrder.spec.ts, stableIds.spec.ts).
E2E: a) Wizard 18 level up asks for the two spells, both on Spells tab "at will"; b) Wizard 20 two signature
spells with 1 use each, Short Rest restores; c) Hexblade 3 shows a Hexblade's Curse use box; d) Devil's Sight
in Senses.
STOP rule: STEP 1 table; if more than ~25 places, STOP after C and D and propose a split for A and B.
