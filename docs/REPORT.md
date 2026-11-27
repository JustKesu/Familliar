# REPORT — MON-1: bestiář 2024, legendary groups, tabulky XP

## Co se změnilo
- `scripts/extract-data.js`: `extractEncounterRules()` + `extractMonsters(xpByCr)` za `extractBeasts()`. Nové `data/monsters.json` (1.28 MB), `data/legendary-groups.json` (46.8 KB), `data/encounter-rules.json` (3.5 KB). `data/beasts.json` a ostatní `data/` beze změny (`git status`).
- `scripts/validate-data.js`: `validateMonsters()` (13 kontrol).
- `src/markup/tags.ts`: tagy `atk` (`attackTagToFull(…, false)`), `hom`, `actSaveFailBy`, `actSaveSuccessOrFail`. Navíc oprava existující chyby v `attackTagToFull`: kombinace psaly dvojitou mezeru („Melee  or Ranged …“), týká se i `{@atkr m,r}`.
- `src/markup/tags.test.ts`: 4 nové TAG_CASES (47 → 51) + test čtyř forem `{@atk}` a kombinace.
- DATA.md: sekce „Monsters (MON-1)“. DECISIONS.md: D431.

## Počty (výstup extraktoru)
- Bestiář: 107 souborů, 4528 záznamů, `_copy` 1141, `_versions` 186 → 416. Bez CR vyřazeno 57 (summony).
- Kept 648: XMM 506, RHW 69, SCC 47, EFA 25, XDMG 1, XPHB 0.
- CR pásma: 0–1/2 146, 1–4 218, 5–10 175, 11–16 64, 17–30 45.
- legendary 77, legendaryGroup 54, xpLair 53, spellcasting 205, `{@recharge}` v názvu 171, „/Day“ v názvu 127.
- Legendary groups 40/40, `_copy` 16. XP budget 20 řádků, XP by CR 34 řádků.
- Warnings celkem 246 (beze změny); na kept monstrech 0.

## Překvapení
- XPHB nedává žádné monstrum — všechny jeho stat blocky jsou summony bez CR.
- `legendaryHeader` se v kept monstrech nevyskytuje; `legendaryActions` jen 2× (= 2).
- Monster texty přinesly 4 tagy, které renderer neznal → padaly `tags.test.ts` a `dataCoverage.test.tsx` (vyřešeno výše).

## Ověření
- `npm run extract-data` OK, `npm run validate-data` 191/191, `npm run typecheck` OK, `npm test` 3612/3612.
- `npm run e2e` 849/849 — trvá 9.4 min (nad limitem ~3 min z CLAUDE.md).

## Rozhodnutí (schválená uživatelem, D431)
- Vyřadit monstra bez CR; `xp` z vlastního `cr.xp` (0 u Giant Fly, Seahorse, Shrieker Fungus); `cr` jako text + `xpLair`.

## K rozhodnutí uživatele
- `docs/MARKUP-INVENTORY.md` regenerován `npm run survey-markup` (18 souborů, 57 tagů), ale **necommitnut** — není v seznamu souborů ke commitu. Commitnout příště?
- `docs/STATUS.md` neaktualizován ze stejného důvodu (CLAUDE.md ho jinak vyžaduje).
- Untracked zůstávají `scripts/probe-mon1.js` a `scripts/investigate-lh2-sorcery-points.js` (dle pokynu).

## Manual browser check for the user
none - no UI change.

## Subagent use
Žádný.
