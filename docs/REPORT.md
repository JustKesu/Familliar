# REPORT — F-31b: názvy skillů, zdroj Expertise, poznámka CAST

Jen zobrazení; uložené hodnoty, klíče a schéma (61) beze změny.

## Co se změnilo
- `skillLabel(name)` v `src/calculation/skills.ts` (SKILL_LABELS, fallback = první písmeno velké). Nahrazuje lokální `capitalize` v ExpertisePicker, ClassSkillPicker, SkillChoiceSlots, MulticlassPickSlots, SpeciesSkillPicker, FeatSubChoicePicker, BackgroundPicker, ReviewStep; `featuresTabData.ts` používá `skillLabel` pro `proficiencies.skills/expertise` (nástroje dál `titleCase`). `capitalize` pro jazyky/nástroje nedotčeno.
- `levelRemoval.ts`: „Expertise: …", „Skill proficiency: …" i multiclass varianta „(X multiclass)" přes `skillLabel` (3 místa).
- Inventář: 8 UI souborů + featuresTabData + levelRemoval + CharacterWizard + spellsTabData + CharacterSheet = 13 míst (pod limitem 15).
- Bod 12: příčina v `CharacterWizard.tsx` — zdroj picků podtřídy bral `state.data.subclass?.name`, které je při multiclass Edit prázdné (podtřída je v `draftClasses`). Nově `subclassPickSource(pick)` bere jméno z odpovídajícího grantu (`heldSubclassGrants`), fallback na `state.data.subclass`. Platí pro Expertise pool i `heldForFeat`. ExpertisePicker navíc nikdy nevykreslí „(from )" (prázdný zdroj → bez závorky).
- Body 26/40: `spellNotes(entry, detail, withUsage)`; CharacterSheet předává `action.kind !== 'cast'`. CAST řádek si ponechá V/S/M a trvání, USE a label řádky poznámku o použití.
- Upravená očekávání ve starých testech (velká písmena): SkillChoiceSlots.test, levelRemoval.test (3×).

## Ověřeno
- typecheck OK; `npm test` 184 souborů / 3350 testů OK; validate-data 175/175 OK.
- Nové unit/render testy `src/textFixesF31b.test.tsx`: skillLabel, prázdný zdroj v ExpertisePicker, spellNotes bez usage.
- e2e `e2e/textFixesF31b.spec.ts`: (b) Paladin 2 — CAST Divine Smite bez „(no slot)", USE s ním; (c) Warlock 5 se stampem Pact of the Tome — dialog obsahuje „Other known and prepared spells are kept." a žádný řádek „Expertise: x"/„Skill proficiency: x" malým písmenem. Celé e2e: 581/583 napoprvé (~2,2 min); 2 selhání byla stará očekávání malých písmen v `e2e/subclassProseGrants.spec.ts` (D203 e, h) — opravena, oba soubory pak 18/18 zelené.

## Nedostatky / rozhodnutí
- (c) Pro Warlocka neexistuje cesta, která by vyrobila řádek Expertise/skill v dialogu → pravopis skillů v dialogu pokrývá jen test `skillLabel` a aktualizované testy levelRemoval (Rogue/Cavalier); e2e hlídá jen absenci malých písmen. Seed Tome stampu na úrovni 5 (jako F-23), ne <3 — reálný stamp aplikace.
- Rozhodnutí: pro prázdný zdroj nezobrazuji závorku; jméno podtřídy doplněno z grantu (vnitřní detail, bez dopadu na data).
- Průzkum kategorií featů bez štítku a jmen se „; " (volitelný, přes scripts/) nebyl proveden — neudělán, nic nezjištěno.

## Manuální kontrola v prohlížeči (https://familliar.vercel.app)
- Vzhled „Animal Handling" / „Sleight of Hand" v seznamech a Review (zalamování řádků).
- Multiclass Edit, Rogue Expertise: u Acrobatics z Bladesingeru stojí „(from Bladesinger)" — chování pokrývá jen unit test na prázdný zdroj, konkrétní multiclass cestu pokrývá jen kód (bez e2e: nelze snadno seedovat).
