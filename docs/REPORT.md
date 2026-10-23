# CB-1: vlastní background ve wizardu (D383)

Setup: fetch + `merge --ff-only` = již aktuální, HEAD b9b08a7. Plán míst před editací: ~18 (pod limitem 25).

## Co se změnilo
- Schema 63 → 64: `CharacterBackground.abilityChoices?` (jen u `source: 'custom'`), migrace jen tag. `CUSTOM_BACKGROUND_SOURCE` v `character.ts`.
- validate `describeBackgroundError`: pro 'custom' povinný `originFeatOverride` a 3 různé ability; `abilityChoices` u knižního = chyba.
- Nový `src/backgrounds/customBackground.ts`: `resolveBackgroundEntry` (knižní z dat / custom syntetizovaný: tool kategorie `anyPhbTool`, `originFeat: null`, vybavení 50 gp), `isCustomBackgroundComplete`, `CUSTOM_BACKGROUND_EQUIPMENT`, `ANY_PHB_TOOL`. Samostatný soubor, protože unit testy mockují `backgroundData` a `toolProficiencyData`.
- `CharacterWizard.tsx`: oba `backgrounds.find` (draft, selectedBackground) → resolver; vybavení pro custom bez načítání dat; `OriginFeatSwapPicker custom`.
- `wizardState.ts`: custom zůstává „stejný background“ při psaní jména (nemaže tool/feat/vybavení); gate kroku chce kompletní custom; Edit seed vrací skills+trojici; save ukládá `abilityChoices`.
- `BackgroundPicker.tsx`: volba „Custom background“, pole jména, 2 skills (zakázané třída/druh, D18), 3 ability (změna trojice maže rozdělení), pak +2/+1 / +1/+1/+1.
- `OriginFeatSwapPicker`: prop `custom` → seznam „Origin feats“ přes `originFeatsOf` (vytaženo z `useSpeciesOriginFeat`, nekopírováno).
- `toolProficiencyData`: kategorie `anyPhbTool` = sjednocení AT/GS/INS/T filtrovaných na source XPHB.
- Docs: D383 v DECISIONS.md, DATA.md (pool nástrojů), STATUS.md.

## Ověřeno
- typecheck OK; test 188 souborů / 3439 OK (nové: resolver, completeness, validate, 37 nástrojů, migrace 63→64); validate-data 177/177.
- e2e 674/674 (2,4 min). Nový `e2e/customBackgroundCB1.spec.ts` a–d: a) Next zakázaný dokud není jméno, 2 skills, tool, feat, trojice a bonus; b) Athletics (Fighter) zakázaná; c) sheet: „Temple Scholar“, History/Insight ●, Thieves' Tools, Alert, 205 gp (155 třída + 50), přežije reload; d) Edit bez změn zachová vše. `levelOrder`/`stableIds` → 64.

## Rozhodnutí v kódu
- Seznam nástrojů PHB 2024 = items.json AT 17 + GS 4 + INS 10 + T 6 se source XPHB = 37. Mundane INS má navíc 3 FRHoF nástroje — vyřazeny z custom poolu.
- Volba vybavení je jedna karta „Option A: 50 gp“ v kroku Starting equipment (hráč ji musí zvolit jako u knižního).
- Jméno se ukládá tak, jak je napsané (bez trim); gate jen vyžaduje neprázdné po trim.
- Custom background na sheetu u nástroje: label `<jméno> (background)` beze změny.

## Pro uživatele / otázky
- Nalezeno mimo scope: `anyMusicalInstrument` a species `{any:1}` nabízejí i 3 FRHoF nástroje (DATA.md dříve uváděla 10). Rozhodnout, zda knižní volby omezit na XPHB.
- Přepínání custom ↔ knižní v Edit = změna identity (maže tool, feat, expertise, vybavení background) — existující chování, netestováno e2e.
- Level up custom postavy netestován e2e (krok Background se přeskakuje, save bere resolver).
- Commit zahrnuje jen soubory tohoto tasku; netrackované soubory z gitStatus (REPORT-*.md, Mistari*.json, …) nechány.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: wizard krok Background (volba Custom background, pole jména, skills, ability, seznam Origin feats, seznam nástrojů), krok Starting equipment s custom backgroundem (karta 50 gp).
