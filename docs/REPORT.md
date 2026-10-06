# Report — M1c: concentration source and stable manual feat ids, schema 59

## What changed
- Schema 59 (D319). `play.concentratingOn?: ConcentrationRef | null` ({ name, source? }); `CharacterGrantedFeat.id?: string` (required + unique on 'manual', refused on other origins by `describeGrantedFeatsError`).
- Migration 58→59: string → `{ name }`; null/absent untouched; manual entries get id "0", "1", … in order (non-manual untouched). Malformed values pass through for validation. Stored `manual:<n>` and `spell:…#manual:<n>:…` keys stay byte-identical.
- Matching: `matchesConcentration` (choiceMatch.ts) — D318 rule with exact name comparison (as the sheet compared before; `matchesPick` is case-insensitive, so not reused).
- Writers: CharacterSheet toggle/CAST/USE now pass `{ name, source }`; `setConcentration(id, ConcentrationRef | null)`; CharacterManager handler retyped. Long Rest (rest.ts) and Drop still write null. Header: SheetHeader unchanged, CharacterSheet passes `concentratingOn.name`.
- Readers/writers vs. the listed set: SheetHeader.tsx and rest/rest.ts needed no change. Extra: CharacterManager.tsx, featAsi/featInstances.ts (`manualFeatKey`, `FeatInstanceKey` is now `manual:${string}`), storage/choiceMatch.ts.
- Manual feats: `addManualFeat` writes `id: crypto.randomUUID()` (never reused). `removeManualFeat` and `setFeatChoiceDetails` match by `manual:<id>`; the edit keeps the id. Remove did NOT previously drop resourceUses — it now drops keys starting `spell:` and containing `#manual:<id>:` (the shared pre-A2-1 legacyKey is left alone).
- `manualFeatKey` falls back to the position only for an in-memory character without ids (unit fixtures); stored data always has ids.
- Docs: D319 (DECISIONS), STATUS M1c. DATA.md not touched (no data finding).

## Verified
- typecheck, `npm test` 166 files / 3047 tests, validate-data 174/174, full e2e 429 passed (4.9 min, re-run in full after fixing levelOrder.spec).
- New unit: migrations.test "version 58 to 59" (string/null/absent; manual 0/1/2 with a background entry between; malformed; last step); choiceMatch.test "D319 concentration rule" (with/without source, exact case); characterStore.test "M1c" (schema-58 character with concentration + two manual Magic Initiates with spent free casts: same resourceUses, keys manual:0/1, remaining 0 via `freeCastCounter`; remove first keeps second's key/use and drops only first's; fresh id after deletion; edit keeps id; rejection cases; export→import round trip).
- New e2e `e2e/stableIds.spec.ts`: a) spend 2nd Magic Initiate's Bless, remove 1st → still spent, Use disabled, stored keys checked; b) Concentrate on Bless from Spells → header + localStorage `{name:'Bless',source:'XPHB'}` + schema 59, reload, Long Rest clears; c) schema-58 `concentratingOn: "Bless"` → header Bless, button pressed.

## Existing tests changed (expectation/shape only)
- rest.test.ts F-7b: fixture string → `{ name, source }`.
- characterStore.test.ts: concentration tests (setConcentration args + stored object); manual feats (R13a/R13b): fixtures at current schema get ids, removal/edit use real `manual:<id>` keys, expected entries include ids.
- CharacterSheet.test.tsx concentration/CAST/USE: `onEditConcentration` now called with `{ name, source: 'XPHB' }`; fixtures `{ name }`; Harness param type.
- migrations.test.ts: 40/43/51 expect `{ name: 'Bless' }`; 56→ and 57→58 expected `schemaVersion` 58→59; "is the last step" moved to the 58→59 block (59).
- e2e/levelOrder.spec.ts: stored schemaVersion 58→59. e2e/wizardF5.spec.ts F-5 d: injected manual Alert at current schema gets `id` (an id-less manual entry at schema 59 is now corrupt data).

## Decisions taken / noted
- A stored schema-59 manual entry without id, or a bare-string concentration, is rejected as corrupt (strict, like other fields) rather than tolerated.
- New ids are random UUIDs (keys look like `manual:3f2a…`), not a counter — no extra stored field needed for "never reused".
- Process slip: the CharacterSheet.test.tsx fixture rewrite (12 lines) was done with one `node -e` script instead of the Edit tool; result checked by Grep and typecheck.

## Known, not done
- Custom-item feats `item:<row>:<n>` keep positional keys (same renumbering problem); needs stable inventory row ids.
- Untracked `scripts/investigate-same-name-options.js` predates this task; left uncommitted and not cleaned (git clean not run per instructions).

## Manual browser check for the user
- Nothing to check by eye: no visible change (header still shows only the spell name; keys are not displayed).
