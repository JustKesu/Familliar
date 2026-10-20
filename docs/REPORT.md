# REPORT F-39: Thirsting Blade a Devouring Blade v Attacks per Action (D363)

Setup: HEAD = ccb9931 (ff-only bez změny). V `scripts/` leží cizí neverzovaný `investigate-multi-dice-spells.js` z dřívějška — nedotčen, necommitnut.

## STEP 1 — data (`node -e` souhrn nad `data/optional-features.json`)

| name | source | featureType | prerequisite | věta |
|---|---|---|---|---|
| Thirsting Blade | XPHB | EI | Warlock 5 + Pact of the Blade | "You gain the Extra Attack feature for your pact weapon only. … attack twice …" |
| Devouring Blade | XPHB | EI | Warlock 12 + Thirsting Blade | "The Extra Attack of your Thirsting Blade invocation confers two extra attacks rather than one." |

Jen XPHB, starší tisk v datech není. Devouring Blade = 3 útoky potvrzeno. Zapsáno do DATA.md.

## Změny
- `src/attacks/extraAttackData.ts:42` — `TOTAL_ATTACKS_BY_INVOCATION_NAME` (Thirsting 2, Devouring 3) a `invocationAttackGrants` (:50; Devouring jen s Thirsting).
- `src/calculation/weaponAttacks.ts:442` — `computeAttacksPerAction(featureNames, invocationNames = [])`; invokace jdou do stejného výběru maxima, zdroj `"<jméno> (pact weapon only)"`, poražení zůstávají jako considered řádky. Import `totalAttacksAmong` odstraněn (funkce zůstává, má vlastní testy).
- `src/sheet/CharacterSheet.tsx:2374` — předává jména z `optionalFeatureChoices` s featureType `EI`.
- `src/calculation/weaponAttacks.test.ts:514+` — 4 nové testy (Warlock 5 = 2, Warlock 12 = 3 + considered Thirsting, Fighter 5/Warlock 5 = 2 + considered Thirsting, bez invokace = 1 a Devouring bez Thirsting = 1).
- `e2e/thirstingBlade.spec.ts` — seed schema 61, Warlock 5 Fiend Patron, 5 invokací vč. Pact of the Blade + Thirsting Blade, 9 kouzel, ASI 4, hitPointLevels, currentHp 38; Actions → „Attacks per Action" = 2, drawer obsahuje „Thirsting Blade (pact weapon only)".
- Docs: D363 (DECISIONS.md), STATUS.md (odstavec R5a), DATA.md (nová sekce o invokacích).

## Ověření
- `npm run typecheck` OK.
- `npm test`: 185 souborů, 3377 testů, vše prošlo.
- `npm run validate-data`: 175/175 PASS.
- `npm run e2e`: 601 passed, trvání 7,2 min (nad 3 min limitem z CLAUDE.md).

## Rozhodnutí v kódu
- Při shodě (Fighter 5 / Warlock 5) vyhrává Extra Attack, protože schopnosti jdou v seznamu před invokacemi; Thirsting Blade je considered řádek.
- Klíč tabulky je jen jméno (ne name+source), stejně jako u Extra Attack; data mají jediný tisk.

## Subagent
Nepoužit.

## Manual browser check for the user
None - the planning chat checks the looks from screenshots.

Změněné obrazovky: záložka Actions (hodnota „Attacks per Action"), drawer „Attacks per Action" (nový řádek „… (pact weapon only)").
