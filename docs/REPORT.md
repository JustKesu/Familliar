# REPORT — F-30 (layout ze screenshot review)

HEAD na startu 6edff97 (ff-only: už aktuální).

## Inventura (krok 1) — 7 míst, vše `src/index.css`, žádná logika

| Nález | Soubor | Změna |
|---|---|---|
| 1 ASI legend roztahuje stránku | index.css `.feat-asi-card__legend` | `.wizard__content legend {float; width:100%}` přebíjelo sr-only; selektor zesílen + float:none, margin -1px, padding/border 0; `position: relative` na `.feat-asi-card__body` |
| 2 Character name 416 px na 390 | index.css (nové `.wizard__field`) | `min-width:0` na labelu, input `max-width:100%`, `box-sizing` |
| 3 save advantages uříznuté | index.css (nové `.sheet__save-advantages`) | zrušen 2sloupcový grid z `.sheet__saving-throws ul`, li `display:block; white-space:normal`, 12px `--text-sub` |
| 4 tabulka vlastností na telefonu | index.css `@media (max-width: 600px)` | `min-width:0`, řádkový popisek 64 px se zalomením, padding 4px 1px, select padding 2px 0 |
| 5a Replace one | index.css (nové `.replace-option`) | `margin-bottom: 14px` když není poslední, mezera 6 px mezi tlačítky |
| 5b ASI rádia | index.css (nové `.feat-asi-picker__asi`) | flex-wrap, gap 8px 16px |
| 5c sloty Proficiencies | index.css `.language-picker__list li > label:has(> select)` | grid `minmax(0,14rem) minmax(0,1fr)`; ≤600 px jeden sloupec |

## Změněno
- Vše dle tabulky, jen CSS + nový `e2e/layoutF30.spec.ts`. Navíc oproti tabulce: `.wizard__field` potřeboval i `white-space: normal` (globální `label {nowrap}` držel input na řádku s textem → 416 px i s max-width).
- Příčina 3: `.sheet__saving-throws ul` (2sloupcový grid) a `.sheet__left-column li` (flex, nowrap) platily i pro `ul.sheet__save-advantages`. Drawer dostává stejný styl (`.sheet__save-advantages` bez rodiče).
- 5c pokrývá všechny jednovýběrové sloty se stejným markupem (ClassToolSlots, KenseiWeaponSlots, FeatureLanguageSlots, SkillChoiceSlots, MulticlassPickSlots); checkboxové labely LanguagePickeru netknuté (`:has(> select)`).
- 4: první `@media` pro telefon v index.css (`max-width: 600px`); desktop beze změny pravidel.
- Edit Character používá stejný `label.wizard__field` v CharacterWizard → oprava 2 platí i tam.

## Ověřeno
- typecheck OK; test 182 souborů / 3341 OK; validate-data 175/175; e2e 578/578 (8,0 min — nad 3 min).
- `layoutF30.spec.ts` a–e: všech 5 selhalo na původním index.css (1586 > 1366; 416 > 390; li pravý okraj 425 > karta 335; tabulka 460 > 314 ×2), na novém projdou.
- 5a/5b/5c (mezery, zarovnání) nemají e2e — čistě vizuální, viz níže.
- Prostředí: Playwright chtěl chromium_headless_shell-1243, k dispozici 1194 → symlink v /opt/pw-browsers (mimo repo).

## Rozhodnutí v kódu
- Breakpoint telefonu 600 px (nikde dosud nedefinován).
- Sloupec popisku slotů 14rem.

## Manual browser check for the user
None - the planning chat checks the looks from screenshots. Změněné obrazovky: wizard ASI / Feat (karta, řádek rádií), Class and level na telefonu (Character name, i Edit Character), Ability scores a Review na telefonu (tabulka), Proficiencies (sloty nástrojů/Kensei/jazyků), level up kroky s „Replace one“ (manévry, runy, styl, invocations), sheet Saving Throws karta + drawer.
