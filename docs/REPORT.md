# CB-2: vlastní background v Edit a level up, CSS opravy

Setup: fetch + `merge --ff-only` = již aktuální, HEAD 6d95848.

## Co se změnilo
- Část A: žádná změna aplikačního kódu nebyla potřeba — `setBackgroundChoice` (wizardState.ts ~1431) už mění identitu správně a resolver z CB-1 pokrývá Edit i level up. Přibyly jen e2e scénáře.
- `e2e/customBackgroundCB1.spec.ts` rozšířen (samostatný spec by nemohl importovat helpery z jiného spec souboru): helpery `editToBackground`, `openBackgroundList` (v Edit je seznam backgroundů sbalený), `saveEdit` (po změně backgroundu znovu vezme poslední kartu vybavení background).
  - CB-2 a: Temple Scholar → Edit → Acolyte (XPHB): hlavička Acolyte, History ne ●, Insight + Religion ●, Calligrapher's Supplies bez Thieves' Tools, Magic Initiate ano, Alert ne.
  - CB-2 b: Acolyte → Edit → Custom: Next zakázaný po každém kroku (jméno, 2 skills, tool, feat, trojice, +2, +1), po uložení sheet Temple Scholar vč. 205 gp.
  - CB-2 c (přidáno do CB-1 d): v Edit jsou vlastní History/Insight zaškrtnuté a povolené, bez „already granted“.
  - CB-2 d: level up Fighter 1 → 2: jméno, skills, Thieves' Tools, Alert, 205 gp, WIS 12 a INT 13 (bonus +2/+1) beze změny.
- Část B (CSS, index.css + BackgroundPicker.tsx):
  1. `label.wizard__field` = flex column, gap 4px (Character name). Selektor zúžen na `label`, protože `wizard__field` nese i `<div>` v ClassSwitcher. Label „Background name“ dostal třídu `wizard__field`.
  2. `.background-picker__custom .class-skill-picker__list` a `.tool-proficiency-picker__list` = grid `repeat(auto-fill, minmax(200px, 1fr))`. ToolProficiencyPicker se používá jen v kroku Background, takže grid platí i pro knižní background s volbou nástroje (Soldier, …); ClassSkillPicker třídy beze změny.
  3. `.background-picker__ability-bonus`: border, radius 12px, padding 14px 16px jako fieldsety wizardu (+ margin-top 12px); bez pozadí, protože je přímo v kartě.
  4. `.class-optional-feature-picker__copies`: flex, gap 8px.
- docs/STATUS.md: řádek CB-2.

## Ověřeno
- typecheck OK; test 188 souborů / 3439 OK; validate-data 177/177.
- e2e 677/677 (2,4 min), z toho CB spec 7/7.

## Rozhodnutí v kódu
- Scénáře CB-2 v existujícím specu místo nového souboru (Playwright nedovolí import ze spec souboru).
- Grid nástrojů platí pro celý ToolProficiencyPicker (jediné použití = krok Background), ne jen pro custom.

## Pro uživatele / otázky
- Commit zahrnuje jen soubory tohoto tasku; netrackované soubory z gitStatus nechány.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: wizard krok Class and level (Character name nad polem), krok Background (Background name nad polem, skills a nástroje v mřížce, rámeček ability bonusu — i u knižních backgroundů), krok s Eldritch Invocations (tlačítka Take again / Remove one s mezerou).
