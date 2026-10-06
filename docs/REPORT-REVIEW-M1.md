# Review — M1a/M1b/M1c (schema 56 → 59), `fd367f3..91262cd`

Scope: migrations 56→59, validate.ts, characterStore.ts write/read/import paths, wizardState.saveCharacter,
levelRemoval, choiceMatch/pickSources and its readers, ManageFeatsPanel, CharacterSheet concentration, test diffs.
Nothing ran except git. No blocking defect found on realistic data: every app writer produces a shape the new
validator accepts, every pre-59 shape the old validator accepted migrates to an accepted one.

## Findings

1. **Data loss (locked list), low likelihood.** `src/storage/characterStore.ts:695` (`setConcentration`),
   `:763` (`addManualFeat`), `:431` (`writeAll`). The three new fatal-on-`list()` checks (`concentratingOn` must be
   `{name, source?}` with non-empty strings; manual feat `id` required and unique; `fightingStyles` shape) are guarded
   only by writer discipline. `buildCharacter` checks `fightingStyles` (`:347`) but nothing checks `play` or
   `grantedFeats` before `writeAll`. A future spell row with `source: ''`, or any new code path that creates a manual
   entry without `id`, writes data that makes the whole list unreadable on next load. Today all callers pass
   data-file sources and keep ids (verified: wizard passes `grantedFeats` objects through; `setFeatChoiceDetails`
   keeps `id`; level removal spreads the character).
   Fix: run `describeCharacterError` on the changed character in the narrow setters (as W20 does for HP), or make
   these fields droppable/repairable on read like `levelOrder`. Test: none would catch it today.

2. **Data loss policy (asymmetry), low likelihood.** `src/storage/validate.ts:381-399, 587-591, 990-998` vs
   `:1361`. `levelOrder` is dropped when bad (D317), but a duplicate `fightingStyles` owner, a missing/duplicate manual
   `id`, or a bare-string `concentratingOn` at schema 59 is fatal for the entire list on read. D316's principle
   ("one bad stored character must not lock the list") is applied to one of four new fields. Only reachable via
   hand-edited storage or finding 1. Fix: on the read path drop a bad `concentratingOn`, keep the first entry per
   style owner, assign deterministic ids to id-less manual entries. Test: would need a stored-data case per field.

3. **Cosmetic (hardening).** `src/storage/characterStore.ts:778`. Free-cast cleanup matches `#manual:<id>:` by
   `includes`; an imported id containing `:` (e.g. `"1:x"`) makes removing feat `"1"` also delete `"1:x"`'s counters.
   Validator accepts any non-empty id. Fix: validate ids as `^[^:#|]+$`. Test: no.

4. **Cosmetic.** `src/storage/characterStore.ts:767-772`. `removeManualFeat` with a key that matches no entry is a
   silent no-op (then scans resourceUses), while `setFeatChoiceDetails` throws "No manual feat at key". A stale key
   from a re-rendered panel would fail silently. Fix: throw when nothing was removed. Test: no.

5. **Missing (rule not applied).** `src/calculation/fightingStyles.ts:8`. `hasFightingStyle` falls back to
   `style.name` when `findPicked` finds no row, so a style stored with source X still counts against a same-named row
   of source Y — effectively name-only, unlike D318. No same-name FS pair exists today (DATA.md), so no wrong number
   now. Fix: use the fallback only when `feats` has no row of that name at all. Test: choiceMatch.test covers
   `hasFightingStyle` only with matching sources.

6. **Cosmetic (stale undo guarantee).** `src/levelUp/levelRemoval.test.tsx` "level up followed by removing" passes
   no `pickSources`; in the real wizard a level up backfills sources on held picks/style, so level up + Remove level
   is no longer byte-identical in production (M1b report admits it). Harmless (source = row the sheet showed), but the
   test now proves a property the app does not have. Fix: pass a lookup and assert the documented difference.

7. **Cosmetic (test fitted to old field).** `src/levelUp/levelRemoval.test.tsx` `fighter4()` (M1a block) still sets
   `fightingStyle: 'Archery'`; since M1b `buildCharacter` ignores it, so the levelOrder tests run on a styleless
   Fighter and no longer cover style + history together. No type error because the literal is returned untyped.
   Fix: `fightingStyles: [{ className:'Fighter', classSource:'XPHB', name:'Archery' }]`, type the helper.

8. **Cosmetic (malformed input).** `src/storage/migrations.ts:516`. 56→57 builds `Array.from({length: level})` for
   any non-negative integer; a corrupt `level: 1e9` hangs/throws before validation. Old data with that was already
   fatal, so no new loss. Fix: skip `levelOrder` when `level > 20`. Test: no.

9. **Cosmetic.** `src/storage/validate.ts:591`. `id` on a non-manual `grantedFeats` entry is now fatal; before 59
   unknown keys were silently dropped. App exports never carried it, so only hand-made files are affected.

10. **Cosmetic (pre-existing interaction).** `src/calculation/freeCastResources.ts:63-65,77`. Removing a manual feat
    leaves its pre-A2-1 `legacyKey`; a feat of the same name added later starts from that legacy count. Only for
    characters older than A2-1. Fix: drop the legacy key too when no other instance of that feat remains.

## Checked, no finding
- Chain 56→57→58→59 on: single class, multiclass (no `levelOrder`, unassigned style), classless (`[]`, unassigned
  style), malformed class/style/concentration (moved through, rejected exactly as before), manual ids "0","1"
  skipping non-manual entries — keys byte-identical. Import uses the same chain + `withoutInconsistentLevelOrder`.
- `levelOrder` on every writer: create/Edit rebuild (single class, M0), level up appends, Remove level slices,
  `characterUpdateInput` spreads it, narrow setters spread `rest`, `buildCharacter` stores only a consistent one.
  Multiclass level up/removal refused (`levelGains.ts:271`, `levelRemoval.ts:27`), so the one-entry
  `fightingStyles` rewrite in `saveCharacter` cannot drop another class's style.
- D318 readers: optionalFeatureData, optionalFeatureSpells, grantedSenses, beastData, ManageFeatsPanel, sheet
  option origin, levelRemoval, heldPicks all go through `findPicked`/`matchesPick`/`fightingStyleFor`.
  `pickSourceLookup` resolves FS against the same feats.json FS list in the same order as the picker; held subclass
  picks keep their stored source (`keepRecordedLevels` spreads the record).
- `crypto.randomUUID`: already used for character ids before M1c; https and e2e's localhost are secure contexts.
  No new risk (plain-http LAN access would already fail at character creation).
- Test changes listed in the M1b/M1c reports are renames/schema numbers; only 6 and 7 weaken coverage.

## Not reviewed
- e2e specs (`choiceSources`, `levelOrder`, `stableIds`) and the new unit tests in detail; `npm test` not run.
- `ClassOptionalFeaturePicker` round-trip of stored pick sources on Edit (whether a held class pick keeps `source`
  after the picker rewrites its value; harmless today since no same-name pairs exist).
- `featAsiLevels`/`speciesOriginFeat` consumers of manual feats; CharacterSheet free-cast UI for `manual:<uuid>` keys.
- M1a report (REPORT.md was gitignored then, no committed copy).
