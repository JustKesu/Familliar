# Report — P-B4: šetření Lessons of the First Ones a voleb ručního featu

HEAD před úkolem: 4d5d939 (fetch + ff-only: already up to date). Lokální `main` má nesouvisející historii (ff-only odmítnut „unrelated histories“), nedotčen; push dle pokynu uživatele `git push origin HEAD:main` ze session větve.

## A) Uložení featů podle zdroje (schéma 61, `character.ts:1123`)
- Pozadí: feat odvozen z backgroundu (`featInstances.ts:79-90`), Dark Gift `background.originFeatOverride` (`character.ts:46`); podvolby v `grantedFeats` origin `'background'` (`character.ts:194`, typ `:1083`), platí jen dokud jméno sedí.
- Druh: `grantedFeats` origin `'species'`, feat i podvolby (`featInstances.ts:92-93`).
- ASI: `featAsiChoices[]` kind `'feat'` + `FeatChoiceDetails` (`character.ts:188`, `:1023`), klíč `asi:<level>`.
- Ruční: `grantedFeats` origin `'manual'` + `id` (D319, `character.ts:1087`), klíč `manual:<id>` (`featInstances.ts:100-101`).
- Předmět: `CustomItemDefinition.feats` (`character.ts:765`, `:791`), klíč `item:<row>:<n>` (`featInstances.ts:103-105`).
Vše se čte jen přes `featInstances()`; společný tvar podvoleb `FeatChoiceDetails` (`character.ts:1033`).

## B) Kde se edituje podvolba
- Pozadí: wizard/Edit `CharacterWizard.tsx:2091` (FeatSubChoicePicker) + Manage Feats.
- Druh: `CharacterWizard.tsx:2104` → `SpeciesOriginFeatPicker.tsx:84` + Manage Feats (D275).
- ASI: `FeatAsiPicker.tsx:195` (wizard, level up, Edit; `CharacterWizard.tsx:2377`), filter-choice/Strixhaven `FeatAsiPicker.tsx:212-223` + Manage Feats.
- Ruční a předmět: jen Manage Feats (`ManageFeatsPanel.tsx:377-378` → `instanceRow` `:328`; store `characterStore.ts:1012`, `:1027`).
- Bez editoru: `filterChoiceSpells`/`blockName` (8 filter-choice featů + Strixhaven Initiate) mimo ASI úroveň — `ManageFeatsPanel.tsx:288` `editable=false`, důvod „not built“ (STATUS.md:2412, D215); pozadí/druh FilterChoiceSpellSubPicker nemají vůbec.
- Skilled NENÍ mezi nimi (seznam `character.ts:1001-1003`): `editable=true`, picker existuje (`FeatSubChoicePicker.tsx:237`, 3× skill-or-tool), e2e `manageFeats.spec.ts:210` (ruční Skilled) pokrývá. Ovládání se ale vykreslí až po rozbalení „▸“ s aria-label „Skilled text“ (`ManageFeatsPanel.tsx:140-144`) → problém je objevitelnost, ne chybějící kód. V prohlížeči neověřeno; jiná příčina u konkrétní postavy vyloučena není.

## C) Data (skript `scripts/investigate-feat-granting-options.js`, necommitnut)
- Lessons of the First Ones|XPHB [EI] má strukturované `featProgression: [{"name":"Origin Feat","category":["O"],"progression":{"*":1}}]`; prereq Warlock 2; opakovatelnost jen prózou („more than once“), žádné `isRepeatable`. Kód `featProgression` nikde nečte (Grep src: 0).
- `featProgression` celkem 15×: jinak jen classes.json (Epic Boon 19, Fighting Style Fighter/Paladin/Ranger…); žádná jiná invokace/optional feature.
- Próza „feat of your choice“ mimo ASI/Epic Boon: Human|XPHB (+`feats`), 4 RHW backgroundy (Dark Gift), Fighting Style ×3, Additional Fighting Style (Champion) — vše řešeno jinde. Lessons je jediný nový případ.
- Opakovatelné EI: Agonizing Blast, Eldritch Spear, Lessons of the First Ones, Repelling Blast (vše XPHB).
- Patří do DATA.md — tento task smí měnit jen REPORT.md, zapsat v příštím tasku.

## D) Návrh pro Lessons
Zjištění: invokace se volí checkboxem podle jména (`ClassOptionalFeaturePicker.tsx:148-150`, `CharacterOptionalFeaturePick` `character.ts:938`) → Lessons dnes nejde vzít dvakrát.
- **A (doporučeno)**: `grantedFeats` nový origin `'invocation'` + `id`; `featInstances` ukáže prvních k záznamů, k = počet držených Lessons; přebytek spí jako záznam pozadí (D156) → výměna invokace / odebrání úrovně bez dalšího kódu. Volba v Manage Feats: zamčený řádek „From Lessons of the First Ones“ se selectem Origin featů (kategorie O, filtr `addableFeatOffers` `ManageFeatsPanel.tsx:123`) + FeatSubChoicePicker; pending řádek na Features. Schéma ANO → 62 (`validate.ts:603`, precedens 53 `migrations.ts:472`). ~9 souborů (character, validate, migrations, featInstances, featEffects `:206`, characterStore, ManageFeatsPanel, featuresTabData/CharacterSheet) + testy + e2e, ~300 řádků.
- **B**: vnořit do invokace jako `spellChoices` (`character.ts:974`): `featChoices[{optionName, feat+details}]`, volba v kroku invokací (wizard/level up/Edit) v `extra` (`ClassOptionalFeaturePicker.tsx:200`), Next gate ve wizardState, úklid v `optionSwap.ts:75/98/167` + heldPicks, Manage Feats jen podvolby. Schéma ANO. ~13 souborů, ~500 řádků.

## E) Ruční feat v Manage Feats — nejmenší oprava
`FeatRow` dostane `defaultOpen`; řádek s `row.pending` startuje rozbalený. `ManageFeatsPanel.tsx` (~10 ř.) + e2e v `manageFeats.spec.ts` bez klikání na ▸ (~20 ř.). Editor filter-choice/Strixhaven v Manage Feats je samostatná větší věc (reuse `FilterChoiceSpellSubPicker`, ~4 soubory).

## F) Tasky (pořadí)
1. P-B5: E + editor filter-choice/Strixhaven v Manage Feats (ManageFeatsPanel, featuresTabData `:277`, CharacterSheet `:1365`, e2e) ~15-20 míst.
2. P-B6: model Lessons (A): typ, validate, migrace 62, featInstances, featEffects, store metoda, unit testy ~15-20 míst.
3. P-B7: UI Lessons v Manage Feats + pending řádek na Features + e2e ~15-20 míst.
4. P-B8 (po rozhodnutí): opakovatelné invokace v pickeru (volba podle jména → duplicity v optionSwap/heldPicks/validate) ~20-25 míst.

## Verdikty
- Opakovaný Lessons = jeden feat za každé vzetí (próza + `progression {"*":1}`). Varianta A unese libovolné k; dnes ale k ≤ 1, viz F4.
- Skilled opakovatelný: už funguje — ruční feat jde přidat znovu (`characterStore.ts:920`), každá instance má vlastní `proficiencies`, `heldForFeat` vyřadí jen vlastní klíč (`ManageFeatsPanel.tsx:254`). Beze změny.

## Rozhodnutí pro uživatele
1. Varianta A vs B (doporučuji A). 2. Opakované vzetí invokací (Lessons + 3 další): nový task, nebo zatím max. 1. 3. Počítá se Lessons z vlastního předmětu (`character.ts:767`)? Doporučuji ano (jako D372/D373). 4. Přebytečné feat záznamy po výměně invokace: spát (doporučeno), nebo mazat.

Ověření: nic nespuštěno (zadání zakazuje npm). Necommitnuté: můj skript výše a cizí `scripts/investigate-b3-prose-counts.mjs` (git clean zakázán).
