# REPORT — DS-1

Setup: `git fetch origin`, `git merge --ff-only origin/main` (fast-forward 4cb8912 → 2ff1b0d). HEAD = 2ff1b0d. Větev main.

## Co se změnilo

- `.gitignore`: místo `data-source/` negační vzory po úrovních (`data-source/*` → `!data-source/5etools-src-main/` → `.../5etools-src-main/*` → `!.../5etools-src-main/5etools-src-main/` → `.../5etools-src-main/5etools-src-main/*` → `!.../data/`), s komentářem DS-1.
- Do gitu přidána složka `data-source/5etools-src-main/5etools-src-main/data/`: **503 souborů**, `git diff --cached --stat`: 504 files changed (vč. `.gitignore`), 3 020 512 insertions.
- Velikost: `git count-objects -vH` po stagingu — loose objekty 47.05 MiB (zlib), pack 7.33 MiB. Nekomprimovaně cca 110 MB.
- Největší soubor: žádný ≥ 10 MB (kontrola přes `git ls-tree -r -l` na indexový strom), tedy hluboko pod limitem GitHubu 100 MB.
- `docs/DATA.md` ř. 15–19: věta, že od DS-1 je složka trackovaná a zbytek `data-source/` zůstává ignorovaný; z nadpisu odstraněno „gitignored“.

## Ověření

- `git status --short --untracked-files=normal --ignored data-source`: vše pod `data-source/` kromě `data/` je `!!` (web 5etools, audio, fonts, js, search, homebrew, `data-source/homebrew/` …).
- `git status --short --ignored .../data`: žádný `!!` uvnitř `data/` — vnořený `.gitignore` 5etools (sám ignorovaný) nic z `data/` nevyřadil.
- Žádné npm skripty, testy ani extraktor nespuštěny (dle zadání). Kód, `data/`, `homebrew/`, `src/` beze změny.

## Problémy / rozhodnutí

- Žádné. Stará untracked šablona `scripts/*.js` a další untracked soubory v rootu ponechány (git clean zakázán zadáním).

## Manual browser check for the user

None — no UI change.
