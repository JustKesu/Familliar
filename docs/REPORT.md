# SC-1 fix — stabilní e2e test „SC-1 a“

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD 61d0174 — OK.

## Chyba
Nebyla to pomalost, ale race na kroku Proficiencies. Reprodukováno i v samostatném běhu (2. spuštění souboru):

```
Test timeout of 60000ms exceeded.
Error: locator.click: Test timeout of 60000ms exceeded.
  - locator resolved to <button disabled type="button" class="btn--accent">Next</button>
  at next (e2e/wizard.ts:110) ← walkToAsi (subclassSpellcastingPrereq.spec.ts:83)
```

Krok: Proficiencies, „Choose 2 more languages (0/2 chosen)“. `waitForLoadState('networkidle')` se ustálil dřív, než se vykreslil seznam jazyků → `count()` checkboxu Dwarvish vrátil 0 → jazyky se nezaškrtly → Next zůstal disabled až do globálního timeoutu. Celkový timeout byl jen důsledek visícího `click`.

## Změna (jen `e2e/subclassSpellcastingPrereq.spec.ts`)
- :67 `walkToAsi(page, options: { languages?: boolean })`.
- :72–73 při `languages` na kroku Proficiencies `expect(checkbox Dwarvish).toBeVisible()` před `count()`. SC-1 b (level-up bez jazyků) se nemění.
- :106 `test.slow()` jako první řádek SC-1 a (dle zadání, protože v kroku 2 prošel); samotnou příčinu řeší čekání výše.

## Časy
- Krok 1 (soubor samostatně): 1. běh 4/4 pass, 37 s (bez per-test časů); 2. běh s `--reporter=list`: SC-1 a FAIL po 1,0 min (viz výše), soubor 1,6 min.
- Krok 2 (plný e2e před opravou): 849/849 pass, 8,9 min — SC-1 a tentokrát prošel.
- Krok 4: soubor po opravě 4/4, SC-1 a 2,0 s; plný e2e 849/849 pass, 8,4 min (přes 3 min limit z CLAUDE.md — délka celé sady, ne tohoto testu).

## Kontroly
- typecheck: OK
- test: 194 souborů / 3607 testů pass
- lint: **exit 1** — předchozí chyba v kódu aplikace, nesouvisí se změnou: `src/sheet/spellsTabData.ts:229:134 react-hooks(rules-of-hooks): React Hook "useLabel" is called in function "spellsTabActionSections"`. Zbytek jsou warningy. Neopravováno (mimo povolený rozsah).
- e2e: 849/849 pass

## K rozhodnutí uživatele
- Lint chyba v `spellsTabData.ts:229` — samostatný úkol.
- Stejný vzor `networkidle` + `count()` může být i v jiných spec souborech; neprověřováno (mimo rozsah).

Subagent: nepoužit.

## Manual browser check for the user
Žádný — změna jen v testu.
