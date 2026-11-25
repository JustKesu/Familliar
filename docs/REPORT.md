# REPORT — LINT-1

Setup: fetch, `merge --ff-only` (already up to date), `npm ci`, `e2e:install`. HEAD = e6fa344.

## Co se změnilo
- `src/sheet/spellsTabData.ts:123` — `function useLabel` → `function usageCounterLabel`.
- `src/sheet/spellsTabData.ts:229` — volání `useLabel(grant.usage)` → `usageCounterLabel(grant.usage)`.
- Grep `useLabel` v `src/`: jen tato definice a jedno volání, nikde neexportováno. Jiná změna kódu žádná, chování stejné.

## Ověření
- Lint před: exit 1, 1 error `react-hooks(rules-of-hooks)` na `spellsTabData.ts:229:134`.
- Lint po: exit 0, 0 errorů, 62 warningů (exhaustive-deps, only-export-components, no-unused-vars; 13 z nich v `scripts/investigate-*.js`).
- `npm run typecheck`: OK.
- `npm test`: 194 souborů, 3607 testů, vše prošlo (104 s).
- `npm run e2e` (celá sada): 849 passed, 10.5 min — přes limit ~3 min z CLAUDE.md. SC-1 a (`subclassSpellcastingPrereq.spec.ts`) prošel.
- Omylem jednou spuštěno `npx --no oxlint --format=json --quiet` (porušení pravidla „nikdy npx“); skončilo chybou „No files found to lint“, nic nezměnilo.

## Subagent
Nepoužit.

## Rozhodnutí / otázky
Žádné.

## Manual browser check for the user
Žádný — pouze přejmenování.
