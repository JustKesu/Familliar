# REPORT — RB-1: Primal Knowledge a Hellborn

Setup: `git fetch` + `git merge --ff-only origin/main` → „Already up to date“, HEAD `bc551de`.

## Změny (STEP 1 inventář, provedeno)

| Soubor:řádek | Změna |
|---|---|
| src/storage/character.ts:69, :75–87, :1146 | `'hellborn'` ve FeatureLanguageSource, `'primalKnowledge'` v SubclassSkillSource, schéma 65 |
| src/storage/validate.ts:218, :239–252 | nové grantedBy hodnoty povolené |
| src/storage/migrations.ts:599 | krok 64→65, jen značí |
| src/languages/classFeatureLanguages.ts:11, :22–34 | `choice.from`, řádek Hellborn, `featureLanguageSlotCount` |
| src/languages/FeatureLanguageSlots.tsx:48–61 | počet slotů dle `featureLanguageSlotCount`, nabídka omezená na `from` |
| src/classSkills/subclassSkillGrants.ts | `subclass?` + `featureName?`, řádek Primal Knowledge, `subclassSkillGrantOwner/Source`, `subclassSkillGrantsGiving`; `classSubclassGrantSources` vynechá řádky bez podtřídy (změna podtřídy pick nemaže) |
| src/classSkills/SkillChoiceSlots.tsx:54 | popisek „Primal Knowledge skill“ |
| src/calculation/skills.ts:123, :133 | zdroj „Barbarian (Primal Knowledge)“ |
| src/calculation/proficiencies.ts:254, :263 | pending poznámka respektuje `from` |
| src/levelUp/levelGains.ts:302 | název části přes owner |
| src/creation/wizardState.ts:989 | dokončení kroku: `slotCount ≤ picks ≤ count` |
| src/creation/CharacterWizard.tsx:1224, :1233, :1412 | owner místo `grant.subclass` |
| e2e/wizard.ts | `FighterOptions.classStep` (jiná třída než Fighter) |
| e2e/primalHellbornRB1.spec.ts | nový, 8 scénářů |
| e2e/levelOrder.spec.ts, e2e/stableIds.spec.ts | schemaVersion 65 |
| src/storage/migrations.test.ts, src/languages/classFeatureLanguages.test.ts | krok 64→65, `featureLanguageSlotCount` |

## Další prose-only volby chybějící v obou tabulkách (neopraveno)

Skript `scripts/rb1-prose-choices.js` (regex nad textem bez markupu):
- Bard College of Lore — Bonus Proficiencies (3, dovednosti)
- Ranger Fey Wanderer — Otherworldly Glamour (3, dovednost)
- Ranger Rocborne (TGS2) — Whispers of Knowledge (3, dovednost)

Ostatní zásahy (Deft Explorer, Thieves' Cant, Knowledge, Banneret, Battle Master, Noble Genies, Bladesinger) už v tabulkách jsou. Neověřeno, zda Lore/Fey Wanderer nemají strukturované pole, které appka čte jinde — v src se jejich názvy nevyskytují. Zapsáno do DATA.md.

## Ověření

typecheck OK; test: celý běh 3444/3446, 2 selhání v migrations.test.ts (očekávaná verze 64) → test opraven a přidán krok 64→65, opakovaný běh migrations.test.ts + src/languages 77/77 OK (celá sada znovu nespuštěna); validate-data 177/177; e2e 702 passed (3.6 min). RB-1 a–e: `e2e/primalHellbornRB1.spec.ts` (a průvodce Barbarian 4 Infernal → Survival ●, Infernal na kartě; b jen Abyssal/Infernal, jen neznámý, bez slotu při obou známých; c level up 2→3; d Edit drží oba picky i po uložení; e Barbarian 2 bez obou, Berserker 3 jen Primal Knowledge).

## Rozhodnutí během práce

- D392 zapsáno (DECISIONS.md) dle zadání.
- Starý Hellborn pick, když jsou pak oba jazyky známé, se dál zobrazí a počítá (krok nezablokuje).
- `levelGains` hlásí Hellborn jako 1 jazyk i při obou známých (shrnutí level upu); průvodce pak slot nemá. Ponecháno.
- Primal Knowledge zdroj na sheetu: „Barbarian (Primal Knowledge)“.

Subagent nepoužit.

## Manual browser check for the user

none - the planning chat checks the looks from screenshots. Změněné obrazovky: průvodce/level up/Edit krok Proficiencies (selecty „Primal Knowledge skill“, „Hellborn language“), sheet Skills (Survival) a karta Languages.
