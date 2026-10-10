# Review M11 (998ed75..6662330: 671d2c3 M11a, 484efd0 F-13, e96bb7e F-14, cf53e84 M11b, 6662330 F-15)

Jen čtení kódu a diffu, nic nespuštěno. Měřítko: D338, D339, D340 (D335 pro vlastnictví voleb třídou).

## Nálezy

1. **Vysoká — v level upu stačí překlik podtřídy (A → B) a dřívější kouzla třídy zmizí.**
   `src/creation/wizardState.ts:1426` bere jako „první výběr“ jen `state.data.subclass === null`, tedy stav uvnitř běhu wizardu, ne uloženou postavu. Level up Wizard 2 → 3: klik na Bladesinger, pak Evoker → druhý `setSubclass` už není první, `spellChoices` (seedované z uložené postavy, `:732`, včetně kouzel z úrovní 1–2) se vymaže, stejně Wild Shape formy a volby podtřídy. D338 říká, že mazat se má jen při změně *už existující* podtřídy (Edit, M9b); uložená postava ji neměla. Hráč musí celou knihu vybrat znovu (jestli jsou dřívější volby v level upu zamčené, nejde to vůbec — neověřeno).
   Oprava: „první výběr“ odvodit od podtřídy uložené postavy (např. seed `initialSubclass` ve stavu), ne od posledního kliknutí. Chybí test: level up z `subclass: null`, `setSubclass` A a pak B → `spellChoices` beze změny.

2. **Nízká — poznámka třídy (D340) zůstává po snížení úrovně a může se zdvojit.**
   `CharacterWizard.tsx:2262-2267` filtruje záznamy `subclassName === null` jen podle třídy, ne podle úrovně. Tvorba/Edit: Paladin 2 (Divine Smite odebrán) → úroveň zpět na 1 → poznámka „Divine Smite is always prepared by Paladin…“ dál svítí, přitom na úrovni 1 to neplatí a kouzlo je znovu k výběru. Když ho hráč vybere a vrátí úroveň na 2, reducer (`wizardState.ts:1468`) přidá druhý stejný záznam → dva stejné odstavce se stejným React key (`DroppedAlwaysPreparedNote.tsx:15`, varování duplicate key).
   Oprava: při `dropAlwaysPreparedPicks` nahradit existující záznam téže třídy/podtřídy místo přidání a při změně úrovně záznamy s `subclassName === null` zahodit. Chybí test: drop → snížení úrovně → poznámka zmizí; dvojí drop → jeden záznam.

3. **Nízká — Remove level pod úroveň grantu kouzlo nevrátí.**
   Paladin 1 s Divine Smite → level up na 2 (pick odebrán, D340) → Remove level na 1: Divine Smite není ani pick, ani always prepared; postava má 1/2 prepared. Nic se nerozbije (validate kontroluje jen tvar, `validate.ts:687-702`), jen tichá ztráta volby. D340 tenhle případ neřeší → otázka 1.

4. **Nízká — wizard „migruje“ uložený duplikát při libovolném běhu.**
   Effecty `CharacterWizard.tsx:968` a `:992` běží i v Editu a level upu uložené postavy; uložený duplikát (pick + always prepared z doby před F-14) se odebere, ukáže se poznámka a Next čeká na náhradní pick. Je to v souladu s D339 („wizard odebere“), ale „uložené postavy se nemigrují“ tím platí jen do prvního otevření wizardu. Spíš žádoucí; zmíněno kvůli otázce 2.

5. **Nízká — e2e hlavička odkazuje na `docs/REPORT.md` jako zdroj očekávaných hodnot.**
   `e2e/multiclassEndToEnd.spec.ts:6`. REPORT.md se každý task přepisuje, odkaz už teď neplatí. Hodnoty samotné mají u sebe komentář s tabulkou třídy (např. `:405`, `:443`, `:466`, `:1126`), takže jde jen o hlavičku.
   Oprava: odkázat na tabulky v `data/classes.json`.

6. **Chybějící testy pro rozhodnutá pravidla:**
   - D338 v level upu s překlikem podtřídy (nález 1).
   - D338 Wild Shape: Druid 2 → 3 Circle of the Moon v level upu, formy zůstanou (je jen unit test reduceru `wizardState.test.ts:520`).
   - D340(2) v Editu: změna podtřídy jedné třídy nechá subclass skills druhé (unit test `:651` pokrývá jen stav bez `otherClasses`; e2e finding 2 končí na `:1101` jen `expectStep`, nic neověří).
   - D340(3) ostatní třídy: Find Familiar (Druid 2), Find Steed (Paladin 5) — jen Divine Smite.
   - Mastery při vstupu do Paladina (viz verdikt j).

## Verdikty a–j

a) **bug** — `wizardState.ts:1426`. Undefined nenastane (typ `SubclassChoice | null`); stejná podtřída znovu nic nespustí (`ChoiceRow.tsx:51` ignoruje klik na vybranou radio volbu). Edit nemůže chybně trefit „první výběr“: `subclassChoiceFor` (`:805-808`) vrací pro uložené jméno vždy objekt, i když podtřída chybí v datech. Chyba je opačná: v level upu A → B v jednom běhu se maže, ač uložená postava podtřídu neměla (nález 1). Cesta null → B po `pruneClassPicks` (`:237`) maže už při snížení úrovně, takže tam nic nezůstane.

b) **ok** — `spellChoices`, `optionalFeatureChoices`, `wildShapeForms` ve `WizardData` jsou jen aktivní třídy (`:732-737`, ostatní ve stashi `:777-780` nebo v uložené postavě, merge `:1707`). `setSubclass` stash nečte. Invokace (`classOptionalFeatureChoices`) se nemažou vůbec (`wizardState.test.ts:549`).

c) **ok** — `dropAlwaysPreparedPicks` (`wizardState.ts:1457-1468`) mění jen `state.data.spellChoices` aktivní třídy a odmítne akci pro jinou třídu/podtřídu. Pick Wizarda ve stashi/uložené postavě nevidí (unit `:598`, e2e F-14 b `:486`). Příklad ze zadání nenastane i z jiného důvodu: Bless ani Cure Wounds nejsou na seznamu Wizarda.

d) **riziko, jen legacy** — `pickCounts` (`manageSpellsData.ts:48`) pick s `alsoGranted` nepočítá, `isCompleteSpellChoices` (`wizardState.ts:1028-1031`) ano. Nový běh duplikát nevytvoří: oba pickery dostávají `alreadyKnownSpells`, které obsahuje class picks i Savant picks (`CharacterWizard.tsx:1503-1508`). Konkrétní rozpor jen u uložené postavy s Evoker Savant pickem a stejným class pickem: Edit ukáže „Prepared: 5/6“, Next je povolený (počítá 6).

e) **ok / riziko** — drop jen od úrovně grantu: `loadClassAlwaysPreparedSpells(..., classChoice.level)` (`CharacterWizard.tsx:987`) a effect běží znovu při změně úrovně (`:1000`). Po snížení úrovně ve wizardu se kouzlo vrátí do nabídky (je mimo `classAlwaysPrepared`), ale zpět do picků ne a poznámka zůstane (nález 2). Remove level na listu pick nevrací (nález 3).

f) **ok / nízké riziko** — záznam vzniká jen když `removed.length > 0` (`wizardState.ts:1460`), stav se neukládá. Back/Next effecty znovu nespustí (závislosti `classChoice`, `subclass`) a druhý drop je no-op (unit `:610`), poznámka tedy zůstane jedna a viditelná. Zdvojení a stará poznámka jen při změně úrovně (nález 2).

g) **ok** — přesunuto jen JSX (`CharacterWizard.tsx:2247-2258`), hodnota jde ze stavu, výběr se drží. Next je disabled bez vlastního důvodu; důvod dává čítač pickeru („0 of 2 Evoker spells chosen.“, e2e `:1066`) a ten je teď nad seznamem. Seznam chybějících voleb (`wizardState.ts:1199`) Savant sloty zná, ale ten je pro přepínač tříd.

h) **ok** — `classSubclassGrantSources` (`subclassSkillGrants.ts:93-99`) vrací klíče všech podtříd dané třídy; klíče jsou mezi třídami unikátní (`:24-50`), takže level up, Edit i Edit se stashem maží jen vlastní třídu. Remove level jde přes `levelRemoval.ts` (mimo diff). Skill daný podtřídou i jiným zdrojem: `subclassSkills` jsou samostatné záznamy s `grantedBy`, filtr maže jen záznam podtřídy, nic se nezdvojí. Okrajově: `classChoice === null` → prázdná množina → nic se nesmaže (`wizardState.ts:1424`); nedosažitelné, `setSubclass` je jen s vybranou třídou.

i) **ok** — validate kontroluje jen tvar (`validate.ts:687-702`), list počítá přes `pickCounts` bez `alsoGranted` a řádek je jeden (`manageSpellsData.ts:29-44`). Jediné místo, kde duplikát mění počet, je wizard (`isCompleteSpellChoices`), a tam se pro always prepared odebere při načtení (nález 4); pro Savant viz d).

j) **riziko** — `test.fixme`/`skip`/`only` nikde. Hodnoty jsou literály s odkazem na tabulku třídy, nic se nečte z appky; jen hlavička odkazuje na REPORT.md (nález 5). Slabé: `:1097-1101` (finding 2 v Editu jen `expectStep`), `:388`, `:893` (jen viditelnost řádku kouzla, to je ale účel). Mastery při vstupu do Paladina **není ověřené nikde**: `:494` a `:533` vyberou Longsword/Warhammer jen `if (count > 0)`, takže test projde, i když se mastery nenabídne, a uložené `masteries` po vstupu se nekontrolují (jediná kontrola je Fighter `:731`).

## Otázky pro Daniela

1. Remove level pod úroveň, od které třída/podtřída dává kouzlo jako always prepared (Paladin 2 → 1, Cleric Life 3 → 2): má se odebraný pick vrátit, nebo zůstane prázdné místo k doplnění? D339/D340 řeší jen odebrání.
2. Má poznámka D339/D340 vzniknout i v Editu/level upu, kde wizard odebere duplikát už uložený (ne vybraný v tomto běhu)? Teď vznikne.

## Nezrevidováno

- Zbytek M11a/M11b e2e (`:511-1050`, scénáře B–E) jsem četl jen přes grep; hodnoty slotů, HP a DC jsem proti `data/classes.json` nepřepočítal (data nesmím otevírat).
- `loadClassAlwaysPreparedSpells` a `levelRemoval.ts` (mimo diff), jen jejich použití.
- Zda level up zamyká dřívější kouzla (dopad nálezu 1).
