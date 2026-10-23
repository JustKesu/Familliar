# Report — B-4c: výběr featu z Lessons of the First Ones v Manage Feats (D377)

HEAD před úkolem: fetch + `merge --ff-only origin/main` → „Already up to date“, d3e9cf3. Větev nezměněna.

## Změny (13 souborů)
- `ManageFeatsPanel.tsx`: čekající slot = otevřený řádek „Origin feat“ + chip „From Lessons of the First Ones“ se selectem
  (aria „Lessons of the First Ones feat“). Nabídka `addableFeatOffers` (držené bez aktuálního featu), filtr na kategorie
  z `loadFeatProgressionCategories(LESSONS)`, nesplněné předpoklady `disabled` s důvodem v textu. Vybraný feat: běžný řádek,
  chip, týž select (výměna), tlačítko Clear, podvolby přes `FeatSubChoicePicker` / `onEditFeatChoice`. Bez Remove.
- `featInstances.ts`: `pendingInvocationFeats(c)` = max(0, sloty − uložené `'invocation'`).
- `featuresTabData.ts`: input `pendingInvocationFeats`; skupina Feats dostane řádek „Origin feat“ (zdroj „From Lessons…“,
  text invokace, `pending: ['feat']`) → „Choices not made yet: feat — make them in Manage Feats.“
- `characterStore.ts`: `setFeatChoiceDetails` větev `manual|invocation`; `setInvocationFeat(…, null)` maže i čítače
  `#invocation:<id>:`; společná `writeWithoutFeat` (z `removeManualFeat`, chování beze změny).
- `validate.ts`: `repairedGrantedFeats` opraví id zvlášť pro `'manual'` a `'invocation'`.
- `CharacterManager.tsx`, `CharacterSheet.tsx`: prop `onSetInvocationFeat(n, feat|null)`.
- Docs: D377 (DECISIONS), STATUS (B-4c).

## Ověření
- `npm run typecheck` OK; `npm run test` 187 souborů / 3413 OK; `npm run validate-data` 177/177; `npm run e2e` 648 passed (3.2 min,
  těsně nad 3 min).
- Unit: B-4b test „rejects invocation bez id / s opakovaným id“ přepsán na opravu (`'0'`, `['a','1']`, id unikátní per origin);
  `setFeatChoiceDetails('invocation:<id>')`; Clear maže jen vlastní čítače; pending řádek ve featuresTabGroups.
- `e2e/lessonsFeatB4c.spec.ts`: a) pending řádek ve F&T + otevřený řádek, Tough → max HP +4, chip; b) Skilled, 3 selecty,
  dovednosti proficient, uložený záznam; c) uložený Tough bez invokace spí (bez řádku, HP beze změny), předmět s Lessons → HP +4,
  řádek zpět; c2) spící Skilled se vrátí i s dovednostmi; d) Clear → pending znovu, `grantedFeats` zmizí.

## Rozhodnutí během práce / otázky
- Výměna featu ve selectu podvolby nuluje (staré nepatří novému featu); id zůstává.
- Více čekajících slotů (dnes nemožné, k ≤ 1) by každý připojil nový záznam (n = počet uložených).
- Pending řádek ve F&T je samostatný řádek „Origin feat“ ve skupině Feats, ne řádek pod invokací v Class Features.

## Necommitnuté
- `scripts/b4b-featprogression.js`, `scripts/tgs2-*.js`, `docs/REPORT-*.md`, `CLAUDE-1.md` aj. — ležely tu před úkolem, nechány.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Manage Feats → My Feats (řádek „Origin feat“ se selectem; řádek featu z Lessons se selectem a Clear);
Features & Traits → Feats (řádek „Origin feat“ s čekající volbou).
