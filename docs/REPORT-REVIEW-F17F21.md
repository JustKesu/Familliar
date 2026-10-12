# Review F-17 až F-21 (f100a59..1d29388: c1b507a, 5cdd5d8 F-17, 9c39bae F-18, ec1cd20 F-19, c1711a1, a93655e F-20a, 1ca01ef + 2aabc96 F-20b, 1d29388 F-21)

Jen čtení kódu a diffu, nic nespuštěno (žádné npm, testy ani e2e). Měřítko: D343, D344, D345, D346 (D335, D341 kde se dotýkají stejného kódu).

## Nálezy

1. **Střední — Remove level po výměně může nechat volbu bez prerekvizity nebo pod její úrovní.**
   `src/optionalFeatures/optionSwap.ts:104-122` dává stamp vyměněné volby PRVNÍ nové volbě v uloženém pořadí, ne té, kterou hráč vybral jako náhradu; `src/levelUp/levelRemoval.ts:157-173` maže jen podle stampu a prerekvizity nekontroluje.
   Reprodukce (přímo z D345 bod 5): Warlock 4 drží Pact of the Blade z tvorby (bez stampu) a invokaci X z L2 → level up na 5: Replace X → Thirsting Blade (prerekvizita Warlock 5 + Pact of the Blade). Náhrada zdědí stamp L2 → Remove level 5 ji nesmaže; Warlock 4 drží Thirsting Blade pod její úrovní. Se swapem volby z tvorby (chybějící stamp) ji nesmaže žádné Remove level.
   Pořadí (known point f): dokud `choices` drží pořadí kliknutí, závislá volba nemůže předběhnout svou prerekvizitu (bez ní je v seznamu zakázaná), takže starý stamp dostane prerekvizita — to je bezpečné. Pokud by se `choices` někde přeřadily (podle seznamu/abecedy; neověřeno), Eldritch Smite (E) před Pact of the Blade (P) dostane starý stamp a Remove level 5 smaže Pact of the Blade, Eldritch Smite zůstane bez prerekvizity.
   Oprava: (a) v `inheritSwapStamp` brát jako náhradu novou volbu, na které žádná jiná nová volba nezávisí a jejíž úrovňová prerekvizita ≤ úroveň stampu; nebo (b) v Remove level po smazání podle stampu kaskádově odebrat volby, které přestaly splňovat prerekvizity (`evaluateClassOptionalFeatureGroups` → `invalidChosen`), a vypsat je v `dropped`. Rozhodnutí je pravidlové → otázka 1.
   Chybí test: výměna + nový přírůstek v jednom level upu v obou pořadích kliknutí, pak Remove level; výměna za volbu s úrovňovou prerekvizitou, pak Remove level.

2. **Nízká — multiclass Edit: neúplné Kensei zbraně neaktivní třídy neblokují Save.**
   `src/creation/wizardState.ts:987` volá `wizardKenseiSlots(data, …)` (`:412-416`), která čte jen `wizardClass(data)` = aktivní třídu. Sourozenecké kontroly (`:982` nástroje, `:985` subclass skills) dostávají `heldClasses`. Reprodukce: Monk 6 Kensei / Fighter 1, uložená postava s jedinou Kensei zbraní (import), Edit s aktivním Fighterem → Save projde, list ukáže „Kensei weapons — not chosen“.
   Oprava: předat `heldClasses` jako u `wizardSubclassSkillGrants`. Data se neztratí (`:1804` filtruje přes všechny třídy). Chybí test: multiclass Edit s neaktivním Kensei Monkem a chybějící zbraní → Save blokovaný (nebo rozhodnout, že ne → otázka 4).

3. **Nízká — rozdělení melee/ranged na Monk 3 se nikde nevynucuje.**
   `src/kensei/kensei.ts:52-54` (`kenseiSlotsFilled`) počítá jen kusy na úroveň, `validate.ts:273-283` jen tvar, `heldKenseiWeapons` (`kensei.ts:46-49`) počet neořezává. Reprodukce: import se dvěma melee zbraněmi s `level: 3` → krok je „hotový“; `KenseiWeaponSlots.tsx:43-44` ukáže ranged slot prázdný; výběr ranged přidá třetí pick s `level: 3`, uloží se a dá zdatnost i monk weapon třem zbraním.
   Oprava: `kenseiSlotsFilled` párovat slot po slotu podle druhu (stejně jako `pickFor`), a `heldKenseiWeapons` brát nejvýš tolik picků na úroveň, kolik má slotů. Chybí test: dvě melee na úrovni 3 → neúplné.

4. **Nízká — výměna Pact of the Chain nechá familiara v pact formě.**
   `optionSwap.ts:62-71` bere s volbou jen `spellChoices`. Familiar (Imp, Quasit…) zůstane uložený a `src/sheet/extrasData.ts:73` ukáže řádek s problémem „… is not a form this familiar can take.“ D345 bod 4 jmenuje jako pod-volby „dnes jen kouzla Pact of the Tome“ → otázka 2.
   Chybí test: swap Pact of the Chain s uloženým Impem → co ukáže Extras.

5. **Nízká — výměna EI/MM (a MV:B každou úroveň) platí i pro třídy PHB 2014.**
   `optionSwap.ts:9`, `src/levelUp/levelGains.ts:497-498` (`holdsSwappableOption`) ani `withClassStepSwap` (`:482-487`) neověřují `classSource`. DATA.md (F-20 survey) cituje text jen u Warlock/Sorcerer XPHB a Battle Master XPHB. PHB Sorcerer 2014 nemá výměnu Metamagic při každé úrovni. D345 zdroj neomezuje → otázka 3.

6. **Nízká — `fightingStyleFor` padá na neoznačený styl.**
   `src/storage/character.ts:958`: když Fighter nemá vlastní označený styl, vezme se první styl bez `className` (starý save). Fighter level up pak nabídne „Replace one“ i na styl, který patřil Paladinovi/Rangerovi (`CharacterWizard.tsx:1945`, `heldPicks.ts:83-84`), proti D346 bod 3. Jen u savů z doby před označováním stylů třídou; reálně vzácné. Oprava: pro swap brát jen styl s `className === 'Fighter'`. Odpovídá i na known point h (classSource se ignoruje — to samo o sobě selhání nedělá, Fighter PHB a XPHB zároveň držet nejde).

7. **Nízká — `undoSwap` porovnává `optionName` citlivě na velikost písmen, `swapOut` ne.**
   `optionSwap.ts:66` lowercase vs. `:89-90` přesná shoda. Pokud uložené `spellChoices[].optionName` má jinou velikost písmen než jméno volby, „Keep“ vrátí volbu bez jejích kouzel (ty swapOut už smazal a undoSwap je z `held` nenajde). Oprava: stejné porovnání v obou. Chybí test s rozdílnou velikostí písmen (nebo potvrdit, že se uloží vždy shodně).

8. **Nízká — F-21: `focus({ preventScroll: true })` nescrolluje.**
   `CharacterWizard.tsx:1802`. Po Next dole na dlouhém kroku zůstane viewport dole a fokus je na nadpisu mimo obrazovku (klávesnice „skáče“ neviditelně). Jen pokud se wizard sám neposune nahoru — scroll nikde v `src/creation` není. Ruční kontrola, nebo `preventScroll` vynechat.

## Verdikty a–k

a) **ok / chybí guard.** `src/sheet/featureReach.ts:40-44`: `className` se kontroluje vždy, u záznamu podtřídy `subclassShortName` + `subclassSource`, takže stejný shortName jiné třídy nebo jiného zdroje neprojde. Duplikáty PHB/XPHB DATA.md změřilo na 0 a 0 záznamů navíc u tříd PHB — ale jen jednorázovým skriptem. Při obnově dat (5etools přidá XPHB kopie) by vznikly dvojí záznamy ve Features (Actions dedupují podle jména, `featureActionRowData.ts:124`). Chybí trvalý test nad daty.

b) **ok.** Maxima poolů jdou z tabulek tříd (`src/calculation/resources.ts:278-325`, `classSource` tam zůstal), F-17 je nemění; spender PHB záznamu má `className` Paladin → pool Paladina (D336). Actions: stejnojmenný „Channel Divinity“ podtřídy se odfiltruje podle jména (`featureActionRowData.ts:124-126`). Wild Shape: jeden pool. Ve Features se „Channel Divinity“ ukáže dvakrát (třída + podtřída) jako u 2014. Chybí test: Cleric XPHB / Paladin XPHB Conquest → Conquering Presence utrácí „Channel Divinity (Paladin)“.

c) **ok.** Migrace jen taguje (`migrations.ts:575-580`), `describeKenseiWeaponsError` a kontrola `elegantCourtierSave` jsou pro `undefined` no-op (`validate.ts:273-283`, `:1366-1369`), `toCharacter` pole jen podmíněně přidá (`:1606-1609`), `buildCharacter` stejně (`characterStore.ts:417-418`). Čtenáři: `kensei.ts:48` `picks ?? []`, `savingThrows.ts:133-134` porovnání s `undefined`, `levelRemoval.ts:248` `?.`, `wizardState.ts:732-733` `?? []`/`?? null`. `withRepairedFields` jsem neotevřel (viz Nezrevidováno).

d) **ok, s nálezy 2 a 3.** Změna podtřídy v Editu: save bere `heldKenseiWeapons(classes, …)` (`wizardState.ts:1804`) → picky mimo Kensei se neuloží. Remove level: `levelRemoval.ts:248-252` maže picky se stampem odebrané úrovně Monka XPHB. Zdatnost (`featureGrants.ts:115-122` + `proficiencies.ts:242`) i monk weapon (`weaponAttacks.ts:153`, `:307`, `:322`) čtou jen držené picky. Monk weapon i pro Longbow a XDMG zbraně — podle D344 záměrně.

e) **riziko (nízké).** Kromě textu v souhrnu (`levelGains.ts:305`): když je hook vypnutý (`courtierOffered` false — level up mimo Fighter 7, multiclass Edit s jinou aktivní třídou; `CharacterWizard.tsx:1363-1367`), uložená hodnota projde savem beze změny (`wizardState.ts:1805`), i když už Wisdom z jiného zdroje není. List ji pak ignoruje (`savingThrows.ts:133`), ale znovu oživí bez dotazu, jakmile Wisdom save zase přibude (např. Resilient přes Manage Feats). D344 to připouští („list ho čte jen tehdy…“); nová stale hodnota se uložit nedá, jen stará přežije.

f) **riziko — nález 1** (pořadí samo dnes bezpečné, úrovňová prerekvizita náhrady ne). `levelOrder` u multiclass se nerozbije: EI a MM patří jediné třídě, stamp se dědí uvnitř stejného `featureType` (`wizardState.ts:1925-1933`), jiná třída se nedotkne.

g) **částečně.** `swapOut` maže `spellChoices` vyměněné volby a `undoSwap` je vrací (`optionSwap.ts:62-97`, kromě nálezu 7). Neošetřené: familiar Pact of the Chain (nález 4). Remove level náhrady se stampem té úrovně nechá její `spellChoices` (`levelRemoval.ts:160-170` maže kouzla jen při odebrání třídy) — existující záměr (komentář D332), ne nové chování F-20.

h) **ok, s nálezem 6.** Kontrola Replace je per skupina aktivní třídy (`ClassOptionalFeaturePicker.tsx:216-218`), styl jen když aktivní třída je Fighter (`CharacterWizard.tsx:1945`), `heldPicks.ts:83` stejně. Ignorovaný `classSource` sám chybu nedělá.

i) **ok.** Prerekvizity mezi volbami mají v datech jen EI; MM, RN, MV:B a FS žádné (D346 bod 1). `swapBlockedBy` (`optionSwap.ts:48-59`) počítá nad `value` včetně voleb přidaných v tomtéž běhu, takže blokuje i závislost na nové volbě. Prerekvizity na kouzla (cantrip) mimo rozsah. Neověřil jsem, jestli test pokrývá blokování novou volbou z téhož běhu.

j) **ok.** `localeCompare`, `toLocaleLowerCase` ani jiný `Intl.Collator` v `src/` nezůstal (jen `compareText.ts:2`). Holé `.sort()` na řetězcích (`Conditions.tsx:100`, `inventoryData.ts:297`, `CustomItemBonusList.tsx:38`, `CustomItemProficiencyList.tsx:164`, `ManageFeatsPanel.tsx:386`, `ClassToolSlots.tsx:26`, `markup/warnings.ts:39`) a `CustomItemGrantList.tsx:25` řadí podle code units — deterministicky, nezávisle na locale; jen se od `compareText` liší u velkých/malých písmen.

k) **ok, s nálezem 8.** Efekt (`CharacterWizard.tsx:1798-1805`) fokusuje jen při změně `state.step` po seedu; krok mění jen `seed`/`next`/`back`/`goTo` (`wizardState.ts:1295-1317`); `seed` a `setSeeded(true)` jsou v jednom callbacku (`CharacterWizard.tsx:392-395`), takže při otevření se nefokusuje; blokovaný Next vrací stejný stav. Chybové hlášky ani dialog krok nemění.

## Chybějící testy

- Nález 1: swap + nový přírůstek v obou pořadích → Remove level; swap za volbu s úrovňovou prerekvizitou → Remove level.
- Nález 2: multiclass Edit s neaktivním Kensei Monkem bez zbraní.
- Nález 3: dvě melee na Monk 3 → krok neúplný.
- Nález 4: swap Pact of the Chain s uloženým familiarem.
- Nález 7: Keep po swapu Pact of the Tome se `optionName` jiné velikosti písmen.
- a) trvalý datový guard: 0 záznamů podtřídy pod dvěma `classSource`, 0 záznamů navíc u tříd PHB.
- b) multiclass Cleric/Paladin Conquest: spender PHB záznamu → pool Paladina.
- e) level up jiné třídy s uloženým `elegantCourtierSave` a odebraným zdrojem Wisdom → list dává Wisdom.
- k) fokus po `goTo` (navigace kroků, odkaz „Edit“ v Review).

## Otázky pro Daniela

1. **Remove level po výměně (nález 1).** Má Remove level odebrat i volby, které po odebrání úrovně přestanou splňovat prerekvizity (Thirsting Blade bez Pact of the Blade, nebo pod Warlock 5)? Možnosti: (a) kaskádově odebrat a vypsat v potvrzení — postava zůstane platná; (b) nechat a ukázat jen varování jako u `invalidChosen` — nic se tiše nemaže. Doporučuji (a).
2. **Pact of the Chain (nález 4).** Je familiar v pact formě pod-volba, která odchází s výměnou? (a) ano — form/familiar smazat nebo vrátit na obyčejný Find Familiar; (b) ne — nechat a ukázat problém v Extras. Doporučuji (a), stejný princip jako kouzla Pact of the Tome.
3. **Výměna u tříd 2014 (nález 5).** Omezit EI/MM/MV:B/RN swap na třídy XPHB (a Rune Knight TCE na XPHB Fighteru), nebo nechat pro všechny? Doporučuji omezit MM na Sorcerer XPHB (PHB text výměnu nedává), EI nechat pro obě (PHB Warlock výměnu má).
4. **Multiclass Edit a Kensei (nález 2).** Má neúplná Kensei volba neaktivní třídy blokovat Save jako Expertise/Mastery (D335)? Doporučuji ano, kvůli konzistenci s nástroji a subclass skills.

## Nezrevidováno

- `withRepairedFields` (characterStore) — neotevřeno, zda nová pole nepotřebují opravu.
- Obsah e2e spec souborů (`kenseiSamurai`, `levelUpSwap`, `olderSubclassFeatures`, `sortOrder`, `wizardFocus`) a úpravy existujících spec — jen podle seznamu souborů.
- Unit testy (`kensei.test.ts`, `optionSwap.test.ts`, `levelGains.test.ts`, `levelUp.test.tsx`, `featureReach.test.ts`) — neověřeno, co přesně pokrývají.
- Mechanická náhrada `localeCompare` → `compareText` v ~25 souborech — jen grepem, ne diff po souboru.
- `useWisdomSaveHeld`: co přesně obsahuje `draftCharacterForProficiencies` (featy z běhu).
- `src/levelUp/levelUpSteps.ts` a průchod kroků při `swappable` beyond diff; `levelRemoval.ts` výpočet `classLevel` (předpokládána úroveň před odebráním).
- `FightingStylePicker` / `OptionalFeaturePicker` chování „Keep“ u stylu (`undoNameSwap` s count 1) — jen přečteno, nereprodukováno.
