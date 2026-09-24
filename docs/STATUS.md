# Status

Poslední aktualizace: 2026-09-24 (B6c: dovednosti z podtříd, nástroje druhů, skrytý prázdný krok level-upu, D177; před tím B6b: proficiency grants from non-XPHB subclasses, D176; před tím B5: pickery nástrojů třídy a volba velikosti druhu, D174/D175; před tím B3b: zalamování karty Proficiencies, volba extra jazyků Rogue/Ranger, D172; před tím B3: řádek LANGUAGES na kartě Proficiencies, D171; před tím B2: karta Proficiencies — armor a weapons, D170; před tím R4c: HP karta s death saves, drawer Hit Points, status row Defenses/Conditions/Concentration, D168; před tím R4b: kompaktní levý sloupec a pás čísel, D166/D167; před tím oprava: stav hodů se při přepnutí postavy maže — `CharacterSheet` je klíčovaný podle `character.id`; dřív: R4d globální advantage, toast s výsledkem hodu, Rolls v horní liště)

Tenhle soubor říká, co appka teď umí a co je dál. Proč je to tak a jak to
vzniklo je v DECISIONS.md (čísla D1–D109) a v REPORT.md (poslední session).
Zkráceno z deníku na stav — stará podoba zůstává v historii gitu.

## Build order

1. [done] Markup renderer — zobrazí i sdílené šablony předmětů
   (`{#itemEntry}`) a texty se škálováním kouzel.
2. [done] Skeleton appky + ukládání postav (localStorage, export/import).
3. [done] Tvorba postavy — wizard: class → species → background →
   [expertise] → languages → ability scores → [spells] → [class optional
   features] → [featAsi] → equipment → review. Volby ve wizardu se navzájem
   hlídají proti kolizi (stejná dovednost/kouzlo ze dvou zdrojů).
4. [done] Kalkulační vrstva — vlastnosti a modifikátory, proficiency bonus,
   saving throws, iniciativa, skilly, pasivní hodnoty, rychlost/velikost/
   darkvision, hit dice pool. Každé číslo nese rozklad (odkud vzniklo);
   chybějící data sheet nikdy nezhodí, jen se to viditelně ohlásí (D43).
4a. [done] Feat/ASI — výběr, uložení, efekty tam, kde je appka umí spočítat
    (vlastnosti, saving throws, skilly, poznámka u iniciativy). Neaplikováno:
    featy mířící na útoky/AC (kroky 7/8), nástroje a jazyky z featů (uloženy,
    nikam nepromítnuty — picker je další task).
    Task A1 (D156, schéma 42): origin feat backgroundu se odvozuje z
    backgroundu a aplikuje všude, kde feat z ASI (HP, vlastnosti, savy,
    skilly, iniciativa, kouzla, smysly, odolnosti, zdatnost se zbraněmi,
    masteries, zdroje/Uses, akce); na sheetu v seznamu Feats s popiskem
    „Background" a chybějící podvolby jako „Choices not made yet". Podvolby
    se ukládají do `Character.grantedFeats` (jen tvar; picker podvoleb je
    další task). ASI picker nenabídne neopakovatelný feat z backgroundu.
    `origin: 'species'` (Human Versatile) je jen v typu/validátoru (D157).
    Všechny čtení featů jdou přes `featInstances` (`src/featAsi/featInstances.ts`).
    Task A2 (schéma 43): `FeatChoiceDetails.proficiencies` (skills/tools/
    languages/expertise, flat po druhu — DATA.md "Feat proficiency /
    expertise / language choices", 10 featů). Uložený skill pick se počítá
    jako proficiency se zdrojem „feat (\<jméno\>)" (`skills.ts`); uložená
    expertise se počítá vedle `expertiseSkills`, smí mířit i na skill, který
    dal tentýž feat (D159). Nástroje a jazyky jsou jen uloženy (D158) — nic
    je nečte. D58 poznámka „čeká na volbu" zmizí pro danou instanci featu,
    jakmile má uložený pick pro dané pole (skills/expertise); na nástroje a
    jazyky se nerozšiřuje (D161). Sheet (`missingFeatSubChoices`) hlásí i
    chybějící skills/tools/languages/expertise podle toho, co feat v datech
    nabízí (`featRequestedProficiencyKinds`, `featEffects.ts`). Enforcement
    počtu a nabízeného poolu je pickerova práce (další task) — tady se
    aplikuje cokoli uloženého, pokud je to platné jméno dovednosti.
5. [done] Sheet — zobrazuje všechno z kroku 4 s rozklady na vyžádání.
6. [done] Kouzla — útočný bonus/DC, sloty (včetně třetinových casterů a Pact
   Magic), přístup ke class spell listu s filtrem podle úrovně, class spell
   picker, kouzla udělená subclassou/featem/optional feature/rasou (všechny
   pevné tvary grantu), popisky použití (bez slotu / na den / rituál / zdroj
   / PB za dlouhý odpočinek), hlídání kolizí napříč všemi pickery kouzel.
   Trvalé odklady: Warlock The Genie (chybí uložená volba džina), Boon of
   Siberys (schovaný), Eberron marks (nedosažitelné bez trackingu kampaně),
   2 kouzla chybí v datech — viz QUESTIONS.md.
6c. [done] Kouzla z rasy (D89, D90) — `src/spells/raceSpells.ts`, pátý
    konzument `additionalSpells`. Granty se dohledávají přímo na uložené
    (už vyřešené) variantě rasy, řadí se do téže složené množiny jako
    ostatní čtyři zdroje a ukazují se v záložce Kouzla. Sesílací vlastnost
    (int/wis/cha na 33 ze 34 záznamů) se ukládá na `Character.speciesSpellcastingAbility`
    (schéma 29, D90) a vybírá se v kroku SPECIES wizardu
    (`SpeciesSpellcastingAbilityPicker`) hned po vyřešení varianty rasy;
    Aasimar (pevná vlastnost) i každá rasa s uloženou volbou dostávají
    útočný bonus/DC a řádek v tabulce akcí, zbytek beze změny ukazuje
    "spellcasting ability not chosen yet". **Zbývá:** 5 záznamů nabízí
    volbu cantripu ze seznamu třídy (jiný tvar `choose` — filtr, ne
    vlastnost) a zatím jen hlásí jednu řádku, že to appka neumí —
    QUESTIONS.md.
6a. [done] Class-level volby schopností — Metamagic, Eldritch Invocations,
    Divine Order/Primal Order/Elemental Fury, vlastní krok wizardu za
    Kouzly. Aplikováno, kde je co počítat (Thaumaturge/Magician cantrip
    navíc); Protector/Warden zdatnosti čekají na krok 7; Storm Heraldova
    volba prostředí je jen v próze (QUESTIONS.md).
6b. [done] Beasti — známé podoby Wild Shape a Find Familiar (včetně forem
    Pact of the Chain), `data/beasts.json` (96 záznamů z XMM). Do kroku 9:
    počty použití za odpočinek, samotná proměna, dočasné životy/staty při
    proměně.
7. [in progress] Inventář a výbava

   | Slice | Co | Schéma |
   |---|---|---|
   | 7a | Předměty, inventář, startovní výbava, peníze | 17→18 |
   | 7b | Nasazená výbava a Armor Class, všech pět vzorců | 18→19 |
   | 7c | Útoky zbraněmi, útoky za akci, finesse (+ Monk fix na Dexteritu) | 19→20 |
   | 7d | Naladění, limit 3 (Artificer 4/5/6 od úrovně 10/14/18) | 20→21 |
   | 7e | Magické bonusy +1/+2/+3, datové i ruční | 21→22 |
   | 7f | Odolnosti, imunity, zranitelnosti ze všech zdrojů (+ fix: nevypitý lektvar nic nedává) | — |
   | 7h | Ploché bonusy z nošených předmětů (AC, savy, kouzla) | — |
   | 7g | Popisy předmětů na sheetu | — |
   | 7e2a–c | Custom předměty — existují, počítají, nesou stealth a min. Sílu | 22→25 |
   | b-fix | Ruce místo počtu zbraní — dvě ruce, versatile grip, displacement | 25→26 |
   | fix | Custom item form (5 oprav), inventářové ovládání, dlouhé seznamy přes SearchableOptionList | 26→27 |
   | hlavička | Trvalá hlavička sheetu (jméno, AC, iniciativa, rychlost, PB, životy); ruční životy `currentHp`/`maxHp` (D9) | 27→28 |

   Aktuální schéma: 28. **Přestavba sheetu je hotová** — všech 5 slice
   (poslední: slice 5 část A, řádky použitelných schopností v tabulce akcí).

   Přestavba sheetu (poslední kus kroku 7 — trvalá hlavička + záložky + jedna
   tabulka akcí místo plochého výpisu sekcí). Rozdělena na 5 slice; všechny
   hotové — viz níž. Groundwork k tabulce akcí:

   - Průzkum (bez kódu): co znamená "použitelná akce" pro tuhle tabulku. Žádné
     jedno pole to neoznačuje; `consumes` označuje jen ~125 SPENDERŮ
     pojmenovaného poolu (Ki, Channel Divinity, Sorcery Point...), nikdy
     featuru, která pool GRANTUJE (Second Wind, Rage, Font of Magic...). Viz
     docs/DECISIONS.md D86 pro celé zjištění.
   - `src/actions/actionTableFeatureData.ts`, `isActionTableFeature(feature)`
     podle D86: true, když featura nese `consumes`, NEBO její `entries`
     (rekurzivně) obsahují tag `{@variantrule Long Rest` / `{@variantrule Short
     Rest`. Ověřeno na 9 jmenovaných případech (Second Wind, Action Surge,
     Rage, Bardic Inspiration, Channel Divinity, Font of Magic, Innate
     Sorcery, Wild Shape, Lay on Hands) — všechny true; Draconic Resilience
     (passivní) — false.
   - Slice 1 (trvalá hlavička): `src/sheet/SheetHeader.tsx` +
     `src/sheet/calculatedValue.tsx` (sdílený `CalculatedNumber`/
     `formatModifier`). Šest hodnot v bloku nad obsahem sheetu, každá si drží
     rozklad na vyžádání (D40/D41). Pět odvozených (jméno, AC, iniciativa,
     rychlost, PB) přesunuto beze změny výpočtu z plochého výpisu; sekce
     `sheet__traits` přejmenována na "Size and darkvision" (rychlost je pryč).
     Životy jsou nové: ruční `currentHp`/`maxHp` na `Character` (schéma 27→28,
     migrace jen tag), nic je nepočítá (D9); prázdné pole = "nenastaveno"
     (hlavička ukazuje "—"), 0 je platná hodnota; `CharacterStore.setHitPoints`.
     Bez clampu current vůči max a bez odvození max z voleb po úrovních — to
     jsou kroky 8 a 9.
   - Slice 2 (záložky): `src/sheet/CharacterSheet.tsx` — plochý výpis sekcí
     rozdělen do pěti záložek (`Vlastnosti a hody` · `Kouzla` · `Inventář` ·
     `Schopnosti a rysy` · `Akce`), výchozí `stats`. Klientský stav
     (`activeTab`), bez URL routingu. Žádná sekce nezměnila obsah, výpočet ani
     markup — jen kam se renderuje. Sekce `Senses` (SensesList) šla do
     `Vlastnosti a hody` vedle Size and darkvision (rozhodnutí uživatele).
     `<header class="sheet__header">` (třída/rasa/background) zůstal nad
     záložkami, viditelný pořád. Neaktivní panely skrývá `.sheet__panel` v
     `index.css` (ne atribut `hidden`/inline `display:none` — ty by je vyřadily
     z accessibility stromu a testy sahají na sekce podle role bez ohledu na
     otevřenou záložku; jsdom CSS nenačítá, takže tam jsou všechny panely
     dosažitelné).
   - Slice 3 (tabulka akcí): `src/sheet/CharacterSheet.tsx` — `AttacksSection`
     nahrazena `ActionsSection`: reálná `<table class="sheet__actions-table">`
     se sloupci Name · Range · To Hit · Damage · Notes, jeden `<tr>` na
     drženou zbraň + Unarmed Strike (stejná množina jako dřív). Data beze
     změny z `computeWeaponAttacks` (jen prezentace). Řádkový model
     `ActionTableRow` = ReactNode na sloupec; `weaponAttackRow` je jeden
     builder, slice 4/5 přidají `spellRow`/`featureRow` + další `.map` bez
     zásahu do tabulky (save kouzlo dá DC do buňky To Hit, schopnost nechá
     Range/Damage prázdné). "Attacks per action" (Extra Attack) zůstává
     souhrnný řádek nad tabulkou. D43: nerozpoznaná držená zbraň má řádek v
     tabulce s pojmenováním a důvodem. Sekce/třída přejmenována
     `sheet__attacks`→`sheet__actions`, nadpis "Attacks"→"Actions".
   - Slice 4 (řádky kouzel): `src/sheet/spellActionRowData.ts` +
     `spellActionRow` v `CharacterSheet.tsx`. Řádek dostane každé kouzlo z
     TÉŽE složené množiny, kterou ukazuje záložka Kouzla (`combineSpellEntries`),
     které nese `spellAttack` nebo `savingThrow`; kouzlo bez obojího (Mage
     Armor, Detect Magic) řádek nemá a zůstává jen v Kouzlech. Sloupec "To
     Hit" přejmenován na "To Hit / DC" — útočné kouzlo tam dá bonus, savové
     "DC <n> <vlastnost>", 5 kouzel v datech nese obojí a ukáže obojí. Čísla
     se nepočítají znovu: berou se z `computeSpellcasting` /
     `computeFeatSpellcasting` (kouzlo z featu bere entry featu, jinak entry
     jediné kouzlící třídy; víc tříd = D43 nevyřešeno, multiclass je krok 10).
     Damage jen ze strukturovaného `scalingLevelDice` (24 cantripů, jeho
     `label` sám nese typ poškození) podle celkové úrovně postavy; u ostatních
     zůstává prázdná, protože kostky jsou jen v próze (D21). Notes u kouzel
     vždy prázdné — "half on a save" žádné pole neoznačuje.

   - Slice 5 část A (řádky schopností): `src/sheet/featureActionRowData.ts` +
     `featureActionRow` v `CharacterSheet.tsx`. Řádek (jen jméno, ostatní
     buňky prázdné) dostane každá udělená class/subclass featura z D87
     resolveru a každý vzatý feat, kterou `isActionTableFeature` (D86) označí.
     `GrantedFeature` nově nese i `consumes` — 72 z 215 kvalifikujících featur
     (Stunning Strike, Deflect Attacks…) nemá rest tag vůbec a tvar jen s
     `entries` by je ztratil. Deduplikace podle jména: data mají záznam na
     každou úroveň, kde se featura opakuje (Action Surge na 2 i 17), a dva
     stejně pojmenované řádky neřeknou nic navíc.
     Volby D21 (Divine Order/Primal Order/Elemental Fury) zapojovat netřeba —
     žádná ze 6 jejich options nekvalifikuje.
   - Slice 5, doplnění (volby optional feature): `OptionalFeatureOption` nově
     nese `consumes` a `featureActionRows` má třetí zdroj — vzaté volby optional
     feature. Tím mají řádek i Metamagic, Maneuvers a Arcane Shot (38 ze 41
     kvalifikujících options kvalifikuje jen přes `consumes`). Detaily níž v
     "Co appka umí navíc".
   - Zatím ne (otázka pro krok 9, zaznamenaná v D86): pool definitions (max
     použití, obnova) pro `consumes` cíle, které v těchto čtyřech souborech
     strukturovaně vůbec nejsou.
8. [done] Level up

   | Slice | Co | Schéma |
   |---|---|---|
   | 8a | Počítané maximum HP — příspěvek za úroveň, Constitution zpětně, tabulka tří bonusů, ruční přebití | 29→30 |
   | 8a-guard | Validace dat hlídá tabulku tří bonusů proti datům (D95) | — |
   | 8b | Krok wizardu "Hit points" — hod/průměr/ručně za úroveň 2+ | — |
   | 8c0 | `CharacterStore.create` přes jeden objekt místo pozičních argumentů | — |
   | 8c1 | `Character.masteries` je pole objektů `{ name, level? }` (D22 → D97) | 30→31 |
   | 8c2 | `Character.expertiseSkills` je pole objektů `{ name, level? }` (D22 → D98) | 31→32 |
   | 8c3 | `choices` v každém záznamu `optionalFeatureChoices` je pole objektů `{ name, level? }` (D22 → D99) | 32→33 |
   | 8d1 | Wizard běží i nad existující postavou — "Edit character" ze sheetu (D100) | — |
   | 8d2 | `levelGainsFor` — co přibývá na úrovni N, krok po kroku (D101) | — |
   | 8d3 | Tlačítko "Level up" a zkrácený wizard (D102) | — |
   | 8d5 | Level up žádá krok "Hit points" jen o nově získanou úroveň (D103) | — |
   | 8e | Odebrání úrovně, `Character.createdAtLevel` jako spodní hranice (D104) | 33→34 |
   | 8e3 | Úprava postavy úroveň vůbec nemění (D105) | — |
   | 8e2 | Přebytek nad úroveň (kouzla, Wild Shape formy) se na sheetu hlásí (D106) | — |
   | 8d3-fix | Level up nezmění volby z dřívějších úrovní (D108) | — |
   | 8d3-fix2 | Zámek rozšířen na feat/ASI a class optional features (D109) | — |
   | 8d3-fix3 | `currentHp` dostane výchozí hodnotu při tvorbě a posune se o rozdíl `maxHp` při level upu i odebrání úrovně (D107) | — |

   - Slice 8a (D91–D94): `src/calculation/maxHitPoints.ts` (nový soubor, D47 —
     kroky 4 se nepřepisovaly) počítá součet příspěvků za úrovně + modifikátor
     Constitution × celková úroveň + bonusy z tabulky. Úložiště drží
     `Character.hitPointLevels` (úroveň, výsledek kostky BEZ Constitution, jak
     vznikl: maximum/average/roll/manual) a nepovinné `maxHpOverride`, které
     vyhrává nad vším spočítaným; `maxHp` z verze 29 se do něj při migraci
     přesouvá, `currentHp` zůstává ruční a nedotčené (D9). Úroveň 1 je vždy
     maximum kostky (D92); postava bez uložených příspěvků (dnes každá) spadne
     na maximum + pevný průměr a rozklad to označí za výchozí hodnoty, ne volbu.
     Tabulka tří bonusů (Tough, Dwarven Toughness, Draconic Resilience) je
     ručně psaná jen v ČÁSTCE (D93); zda je postava má, se rozhoduje
     strukturálně z D87 featur, vzatých featů a pojmenovaných rysů rasy — ty
     dodává nový `src/sheet/speciesTraitNames.ts`. Každá položka si pamatuje
     úrovňovou osu kvůli kroku 10 (D94). Kostka se bere z kroku 4
     (`computeHitDicePool`), neduplikuje se. D43: víc tříd, neznámá třída ani
     nenastavené vlastnosti sheet nezhodí — hlásí se jako unresolved; uložená
     úroveň nad úrovní postavy nebo výsledek, který kostka neumí hodit, mají
     vlastní řádek v rozkladu. Hlavička (`SheetHeader.tsx`) bere maximum jako
     obyčejné `Calculated<number>` s rozkladem (D40/D41), druhé pole je teď
     "Max HP override".
   - Slice 8c0: `CharacterStore.create(input: CharacterCreateInput)` — jeden
     objekt s jednou vlastností na pole `Character`, žádná pozice. Čistý
     refaktor, žádná změna chování/schématu; jediný produkční caller
     (`saveCharacter` ve `wizardState.ts`) sestaví objekt místo dvaadvaceti
     argumentů. Test asertace (`toHaveBeenCalledWith`, `.at(-N)` na
     `mock.calls[0]`) přepsané na named properties
     (`mock.calls[0][0].hitPointLevels` apod.) — pozice v testech je přesně
     to, co slice odstraňuje.
   - Slice 8c1 (D97): `Character.masteries` je `CharacterMastery[]`
     (`{ name, level? }`) místo `string[]`; schéma 31, migrace 30→31 dělá z
     každého jména `{ name }` BEZ úrovně. Volby z wizardu úroveň nemají
     (`saveCharacter` mapuje jména na objekty na hranici úložiště); zapisovat
     úroveň bude až level-up (slice 8d), tady se jen zavádí tvar. Nový helper
     `masteryNames()` ve `storage/character.ts` vrací holá jména — odvozuje je,
     neukládá podruhé. Validace: `masteries[i].name` povinné, `level` nepovinné
     a jen 1–20. Produkčních čtenářů `Character.masteries` je zatím NULA —
     pole se dnes jen ukládá (picker wizardu jede na jménech ve `WizardData`).
     (Helper se ve slice 8c2 zobecnil na `choiceNames()`.)
   - Slice 8c2 (D98): `Character.expertiseSkills` je `CharacterExpertiseSkill[]`
     (`{ name, level? }`) místo `string[]`; schéma 32, migrace 31→32 dělá z
     každého jména `{ name }` BEZ úrovně, záznam bez toho pole ho nedostane.
     Volby z wizardu úroveň nemají (`saveCharacter` mapuje jména na objekty na
     hranici úložiště, stejně jako u masteries); `WizardData.expertiseSkills`
     zůstává `string[]`. Tvar je sdílený: `LeveledChoice` v
     `storage/character.ts`, `CharacterMastery` i `CharacterExpertiseSkill` jsou
     jeho aliasy, helper `masteryNames()` se přejmenoval na `choiceNames()` a
     slouží oběma, validátor je jeden (`describeLeveledChoicesError(value, field)`)
     a konverze taky (`toLeveledChoices`). Produkční čtenář je jediný —
     `computeSkill` ve `src/calculation/skills.ts` (zdvojení proficiency bonusu);
     čte přes `choiceNames()`, výsledky se nemění.
   - Slice 8c3 (D99): `choices` uvnitř každého záznamu
     `CharacterOptionalFeatureChoice` je `LeveledChoice[]` místo `string[]` —
     úroveň nese JEDNOTLIVÁ volba, ne celý záznam `featureType`; schéma 33,
     migrace 32→33 dělá z každého jména `{ name }` BEZ úrovně, záznam bez klíče
     `choices` i postava bez toho pole zůstávají nedotčené. Vnořené
     `spellChoices` se nemění vůbec (D99 je vynechává z D22). Volby z wizardu
     úroveň nemají: `saveCharacter` i `CharacterWizard` mapují jména na objekty
     na hranici úložiště, `WizardData.optionalFeatureChoices` (volby subclassy)
     zůstává `string[]`, a `ClassOptionalFeaturePicker.toggle` drží stávající
     volby (i s jejich úrovní) a novou přidává bez úrovně. Validace i konverze
     jdou přes týž `describeLeveledChoicesError` / `toLeveledChoices` jako 8c1/8c2,
     jen `choices` je na záznamu POVINNÉ. Produkční čtenáři (osm míst, všechny
     přes `choiceNames()`, žádný nemění výsledek): `hasPactOfTheChain`
     (`beasts/beastData.ts`), `extractOptionalFeatureGrantedSenses`
     (`sheet/grantedSenses.ts`), `extractOptionalFeatureGrantedSpells` a
     `extractOptionalFeatureChosenSpells` (`spells/optionalFeatureSpells.ts`),
     `evaluateClassOptionalFeatureGroups`, `chosenClassOptionalFeatures` a
     `chosenOptionalFeatureOptions` (`optionalFeatures/optionalFeatureData.ts`,
     jehož `OptionalFeatureSelection.choices` je teď `readonly LeveledChoice[]`)
     a výpočet požadavků na kouzla u vzatých options v `CharacterWizard.tsx`.
     Tím je **D22 splněné pro všechna pole, která ho potřebují** — `masteries`,
     `expertiseSkills`, `optionalFeatureChoices`; `featAsiChoices`,
     `hitPointLevels`, `classFeatureChoices` a `subclassSpellChoices` už úroveň
     nesly, `wildShapeForms`, `familiar` a spell picky jsou z D22 vědomě venku.
   - Slice 8a-guard (D95): `scripts/validate-data.js`, nová sekce
     `validateHitPointBonusTable`. Dvě kontroly — (1) všechna tři jména z
     `HIT_POINT_BONUS_RULES` odpovídají právě jednomu featu/rysu
     rasy/class featuře/subclass featuře napříč feats.json, species.json
     (rysy), class-features.json a subclass-features.json; (2) frázový scan
     "hit point maximum" (3 tvary, case-insensitive, PO stripnutí 5etools
     tagů — bez stripování najde jen 2 z 10, docs/DATA.md) přes těch pět
     souborů pořád vrací přesně těch 10 známých kandidátů
     (`KNOWN_HIT_POINT_MAXIMUM_CANDIDATES`). Selhání obou kontrol jmenuje
     přesně to, co je špatně, a odkazuje na `maxHitPoints.ts`. Investigace
     (`scripts/investigate-hp-bonus-guard.js`) potvrdila počty před zápisem
     kontroly a je spotřebovaná — smazána `git clean -fd scripts`.
   - Slice 8b (D96): nový krok wizardu "Hit points",
     `src/hitPoints/HitPointsPicker.tsx` + zapojení ve `wizardState.ts`/
     `CharacterWizard.tsx`. Pozice AŽ ZA featem/ASI a PŘED výbavou (D96) —
     feat i ASI mění Constitution a Tough přidává životy za úroveň. Krok se
     schová na úrovni 1 (D92, stejný mechanismus jako `expertise`/`languages`,
     D49/D37) — nové pole `WizardStepConditions.characterLevel`, protože
     `visibleSteps` nemá přístup k `WizardData`. Úroveň 1 je řádek jen ke
     čtení (maximum kostky); od úrovně 2 volba hod (appka hodí, opakování bez
     omezení, D96) / pevný průměr / ruční zadání, plus tlačítko, které
     nastaví průměr na všechny úrovně najednou. Průběžný součet je PŘÍMO
     `computeMaxHitPoints` nad konceptem postavy s rozpracovanými volbami —
     appka ho nepočítá podruhé. Ukládá se do `Character.hitPointLevels`
     (schéma se nemění, pole existuje od 8a) jedna položka na úroveň od 2 výš;
     úroveň 1 se neukládá. Krok nepustí dál, dokud každá úroveň od 2 do
     úrovně postavy nemá vlastní záznam (D96) — "nevybráno" a "vybral průměr"
     musí zůstat rozlišitelné. Ruční přebití (`maxHpOverride`) do kroku
     záměrně nejde — zůstává jen v hlavičce sheetu (D96). Testy:
     `wizardState.test.ts` (viditelnost, dokončenost, reducer, saveCharacter)
     a `HitPointsPicker.test.tsx` (všechny tři způsoby volby, tlačítko na
     průměr, součet shodný s `computeMaxHitPoints`). Level-up tlačítko a
     opětovný vstup do kroku při zvýšení úrovně je slice 8d — tady nepostaveno.
   - Slice 8d1 (D100): wizard umí běžet nad existující postavou. Tři části —
     (1) `CharacterStore.update(id, input)` bere stejný `CharacterCreateInput`
     jako `create` (sestavení postavy je teď jeden sdílený `buildCharacter`),
     drží `id` a verzi schématu a všechno ostatní nahradí; `CharacterCreateInput`
     kvůli tomu umí i `currentHp`/`maxHpOverride`/`familiar`, které wizard sám
     nesbírá a jen je protahuje. (2) `wizardDataFromCharacter(character, lookups)`
     ve `wizardState.ts` je inverze `saveCharacter`; `lookups` dodává dvě věci,
     které úložiště nedrží — zdroj + `featureType` podtřídy a úroveň každého
     uloženého kouzla (`SpellPick.level`). Úrovně u voleb se seedem ztratí
     (pickery jedou na jménech), ale ne natrvalo: `saveCharacter` dostane šestým
     argumentem původní postavu a každé volbě, která na ní už byla, úroveň vrátí
     — nová jde bez úrovně, stejné rozdělení jako `ClassOptionalFeaturePicker.toggle`.
     (3) `setClassChoice` maže jen při změně TŘÍDY (`className`+`classSource`),
     ne při změně úrovně. Úroveň smí jen nahoru: `ClassPicker` má nové
     `minLevel`, `saveCharacter` nižší úroveň odmítne (snížení = odebrání
     úrovně, to je 8e). **Zvyšování úrovně v úpravě zrušila slice 8e3 (D105) —
     viz níž.** Krok "Starting equipment" je při úpravě skrytý
     (`WizardStepConditions.editingExistingCharacter`) a inventář, peníze,
     `currentHp` i familiar projdou beze změny. Vstup: tlačítko "Edit character"
     v hlavičce sheetu (`CharacterSheet` `onEditCharacter`), `CharacterManager`
     drží `editingId` a předá postavu wizardu; do uložení se nezapisuje nic, což
     ze zrušení dělá no-op. Seed je asynchronní (načítá podtřídy a kouzla),
     takže wizard do té doby píše "Loading this character…"; selhání načtení
     flow zastaví (D43), nenaseeduje půlku. Testy: round trip seed→save beze
     změny včetně všech úrovní, zvýšení úrovně drží volby, změna třídy je maže,
     snížená úroveň se odmítne, `update` místo `create`, plus `update` ve
     `characterStore.test.ts`. Ověřeno i v prohlížeči na postavě úrovně 5.
     Tlačítko level-upu a zkrácený wizard jsou slice 8d3.
   - Slice 8d2 (D101): `src/levelUp/levelGains.ts` — `levelGainsFor(character,
     level, parsedClasses, resolverData)` odpoví, co na úrovni N přibývá, pro
     KAŽDÝ krok `WIZARD_STEPS`. Žádné UI, žádné `WizardStepConditions`: vrací
     `status` (`adds` / `none` / `never` / `unknown`), `count` a `parts`
     (jméno + počet za každého přispěvatele), k tomu `newFeatures` (featury,
     které úroveň udělí sama od sebe — ty nesbírá žádný krok wizardu) a
     `unresolved` pro multiclass, neznámou třídu nebo neplatnou úroveň.
     Všechno je rozdíl dvou kumulativních dotazů (N a N-1) nad existujícími
     funkcemi — `featAsiGrantsFor`, `expertiseEligibilityFor`, `masteryCountFor`,
     `classOptionalFeatureGrantsFor`, `optionalFeatureChoicesFor`,
     `computeSpellCounts`, `unlockedSubclassSpellChoiceSlots`, `wildShapeLimits`,
     `classFeatureChoicesFrom`, `subclassLevelFor`, `grantsFightingStyleAt`,
     `grantedClassFeaturesFrom` — žádná ručně psaná tabulka úrovní.
     `loadLevelGainsFor` je fetchující obal. Testy (13) na případech, kde
     odpověď plyne z pravidel: Fighter na 4 (ASI + mastery), Fighter na 5
     (žádné ASI, ale Extra Attack), Fighter na 7 (nic než HP), Rogue na 6
     (další expertise), Sorcerer na 10 (třetí metamagie + kouzla), Cleric na 3
     (podtřída i její featura psaná na úrovni 1), Cleric na 2 (nic), multiclass
     a neznámá třída/podtřída jako `unknown`.
   - Slice 8d3 (D102): tlačítko a zkrácený průchod. `src/levelUp/LevelUpButton.tsx`
     (v hlavičce sheetu vedle "Edit character", `CharacterSheet` `onLevelUp`)
     načte `loadLevelGainsFor` pro úroveň +1 a ukáže "Level up to N"; na úrovni
     20 a při `unresolved` je disabled a důvod nese v textu. `src/levelUp/levelUpSteps.ts`:
     `levelUpTarget`, `levelUpStepConditions` (`adds` + `unknown` + vždy
     `hitPoints`/`review` → nová `WizardStepConditions.levelUpSteps`, která ve
     `visibleSteps` rozhoduje sama) a `unknownLevelUpSteps` (důvody pro poznámku
     na kroku). `CharacterWizard` prop `levelUp`: seed zvedne `classChoice.level`,
     akce `seed` nově bere `conditions` a začne na prvním viditelném kroku; krok
     `class` v průchodu místo jména a `ClassPicker` vypíše "Fighter 4 → 5";
     review vypíše `newFeatures` jménem z dat; tlačítko "Save level N".
     `saveCharacter` sedmý argument `levelUpTo`: odmítne cokoli jiného než +1 v
     téže jediné třídě a nové volby (masteries, expertise, obě skupiny
     optional features) označí touto úrovní, uložené si nechávají svou.
     `CharacterManager` drží `levelUpGains`, wizard dostává `key` podle režimu.
     Fixtures z `levelGains.test.ts` přesunuty do `levelGains.fixtures.ts`.
     Testy: `levelUp.test.tsx` (Fighter 3→4 featAsi, 4→5 jen HP+review a
     Extra Attack, Cleric 2→3 class krok, `unknown` krok zůstává, tlačítko na
     20 a u multiclassu, zápis nové úrovně u voleb, odmítnutí skoku o 2) a
     `CharacterManager.test.tsx` (zrušení nechá uloženou postavu beze změny).
     Ověřeno v prohlížeči: Fighter 4 → 5, průchod Hit points → Review (Extra
     Attack, Tactical Shift), po reloadu úroveň 5, staré volby s úrovněmi
     beze změny, nový hod na úrovni 5 uložený.
   - Slice 8d5 (D103): krok "Hit points" v level-upu ukazuje a vyžaduje jen
     nově získanou úroveň. `HitPointsPicker` nový nepovinný prop `levelUpLevel`
     — když je nastaven, tabulka místo rozsahu 2..N vykreslí jediný řádek za
     tuto úroveň a tlačítko "Použít průměr pro každou úroveň" se schová;
     `CharacterWizard` ho plní `levelUp?.level`. `WizardStepConditions` nové
     pole `levelUpTargetLevel` (plní ho `levelUpStepConditions` vedle
     `levelUpSteps`) — `isStepComplete('hitPoints', …)` s ním vyžaduje záznam
     jen pro tuhle jednu úroveň místo `isCompleteHitPointLevels` na celém
     rozsahu. Tvorba postavy a editace (8d1) beze změny — obě dál nemají
     `levelUpTargetLevel` nastavené, takže žádají celý rozsah od 2 nahoru.
     Testy: `HitPointsPicker.test.tsx` (jediný řádek + skryté tlačítko v
     level-upu, řádek se pořád dá nastavit všemi třemi způsoby),
     `wizardState.test.ts` (kompletnost kroku podle `levelUpTargetLevel`),
     `levelUp.test.tsx` (`levelUpStepConditions` nese `levelUpTargetLevel`,
     krok se dokončí jedním novým záznamem na postavě bez historie).
     Neověřováno v prohlížeči — task instrukce: 8d3 tenhle tok už prošla, a
     které řádky se vykreslí je přesně to, co testy assertují.
   - Slice 8e (D104): odebrání úrovně. `Character.createdAtLevel` (schéma 34,
     migrace 33→34 jen tag, starší postava pole nedostane) — nastaví ho jen
     tvorba (`saveCharacter` bez `existing`), úprava i level up drží hodnotu
     postavy včetně "neznámo"; `CharacterCreateInput`/`buildCharacter`/validace
     (1–20) ho nesou. `src/levelUp/levelRemoval.ts`: `levelRemovalTarget`
     (důvody: bez třídy, multiclass, úroveň 1, neznámá úroveň vzniku, úroveň =
     úroveň vzniku), `levelRemovalPlan(character, classes, resolverData)` vrací
     `{ level, dropped, result }` nebo `{ reason }` (podtřída s nečitelnou
     úrovní volby), `characterUpdateInput`, `loadLevelRemovalPlan`. Maže volby
     s `level`/`grantedAtLevel` === N, `hitPointLevels` N, podtřídu podle
     `subclassLevelFor`, fighting style podle `grantsFightingStyleAt`, úroveň
     třídy −1; prázdný záznam optional features / subclass spell choices
     vypadne celý (optional features jen bez vnořených `spellChoices`). Volby
     bez úrovně, `spellChoices`, `wildShapeForms` nedotčené.
     `src/levelUp/RemoveLevelButton.tsx` v hlavičce sheetu vedle "Level up"
     (`CharacterSheet` `onRemoveLevel`): "Remove level N" → potvrzení uvnitř
     stránky (`role="alertdialog"`, výpis mazaných položek, Confirm/Cancel),
     nedostupný stav má pevný popisek "Remove level" a důvod v atributu `title`.
     `CharacterManager` zapíše jednou přes
     `store.update`. Testy: `levelRemoval.test.tsx` (Fighter 4→5→4 a 3→4→4
     bajtově shodné s úložištěm před level upem, mazání podle úrovně, spelly
     zůstávají, podtřída jen na úrovni volby, fighting style jen na úrovni
     grantu, sloty následují úroveň, čtyři odmítnutí, prvek bez použitelného
     ovládání a zrušení bez zápisu), `CharacterManager.test.tsx` (zrušení
     nezapíše nic, potvrzení zapíše úroveň 4), `wizardState.test.ts`
     (`createdAtLevel` při tvorbě / zachování při update), `migrations.test.ts`.
     Ověřeno v prohlížeči: Fighter vytvořený na 5 → level up na 6 (ASI + HP) →
     Remove level 6 (Cancel nic nezapsal, Confirm) → reload → uložená postava
     shodná se stavem před level upem (porovnání se seřazenými klíči).
     **Známá mez:** po odebrání může postava znát kouzla nad svou úrovní nebo
     víc kouzel / Wild Shape forem, než úroveň dovoluje — označení na sheetu je
     další slice.
   - Slice 8e3 (D105): úprava postavy úroveň vůbec nemění. Zvyšování úrovně
     v úpravě (8d1/D100) byla díra — volby sebrané při úpravě nenesou úroveň
     (D97/D100), takže postava zvýšená úpravou měla neoznačené volby nad svou
     `createdAtLevel` a odebrání úrovně (8e/D104) by je nechalo stát.
     `ClassPicker` prop `minLevel` nahrazen `fixedLevel`: při úpravě je
     `<select>` Level disabled a nabízí jedinou hodnotu (aktuální celková
     úroveň postavy), takže jinou nejde zvolit vůbec. `saveCharacter` odmítne
     zápis mimo `levelUpTo`, kde se úroveň liší od uložené (dřív jen `<`, teď
     `!==`) — zpráva "Editing a character cannot change its level". Zvýšení
     úrovně jde jen přes tlačítko Level up (D102), které úroveň na nových
     volbách zapisuje. Testy: `wizardState.test.ts` (odmítnutí zvýšení i
     snížení úrovně při úpravě). Neověřováno v prohlížeči — jde o zúžení
     existující kontroly, které testy pokrývají přesně.
   - Slice 8e2 (D106): sheet ukazuje přebytek nad to, co úroveň dovoluje, pro
     kouzla a Wild Shape formy — obojí D104 vědomě nemaže při odebrání úrovně.
     `src/spells/spellLevelFilter.ts` nově exportuje `highestSlotLevel` (jedno
     místo pro "nejvyšší sesílatelná úroveň", žádný druhý výpočet).
     `CharacterSheet.tsx`: kouzlo ze `spellChoices` (hráčova volba, jediná bez
     úrovně podle D104 — subclass/feat/optional feature/race granty se
     neoznačují, jsou vždy platné) nad touhle úrovní jde do `SpellList` s
     propem `unavailableAboveLevel`; `SpellRow` ho ukáže jako text
     "(unavailable at this level)" u jména, kouzlo zůstává v seznamu i
     úložišti. Počet kouzel navíc (`computeSpellCounts` proti storovaným
     cantripům/leveled kouzlům podle `spellDetails`) a Wild Shape forem navíc
     (`wildShapeLimits` proti `character.wildShapeForms`) hlásí jen ČÍSLO ("N
     known, M allowed"), nikdy které jméno — appka to neumí ukázat. Multiclass
     (víc než jedna třída) hlásí jednu větu "nejde zjistit" místo obojí notice
     u kouzel (D11 — `combineSpellEntries` ztrácí, které třídě kouzlo patří,
     takže nejvyšší sesílatelná úroveň sloučeného seznamu není spočitatelná
     bez kroku 10); Wild Shape zůstává určený i u multiclassu (limit čte jen
     tu jednu Druid třídu), neurčený jen když ta třída na postavě už není.
     Postava v mezích neukazuje žádnou z těchto notic. Nová
     `ClassSpellCountData` třídní data se načítají stejně jako
     `spellSlotsClassData` (`loadSpellCountClassData`). Testy: nová sekce
     `spell limits against level (slice 8e2, D106)` v `CharacterSheet.test.tsx`
     (označení nad úrovní, počet kouzel navíc, žádná notice v mezích,
     multiclass "nejde zjistit") a dva nové Wild Shape testy (počet forem
     navíc, žádná notice v mezích). Neověřováno v prohlížeči — jde o notice
     nad existujícími výpočty a testy assertují přesně, co se vykreslí.
   - Oprava 8d3 (D108): krok `class` při level upu nevykreslí picker podtřídy,
     fighting stylu ani class skills, pokud je postava už má; weapon masteries,
     manévry podtřídy, expertise a class feature choices ukazují starší picky
     zaškrtnuté a zamčené (`lockedValues` / `lockedFeatureNames`,
     `SearchableOption.locked`). Co postava drží, počítá
     `src/levelUp/heldPicks.ts` z uložené postavy; `saveCharacter` s
     `levelUpTo` odmítne zápis, který drženou volbu změní nebo vypustí.
     Wild Shape formy, kouzla, class optional features a feat/ASI se
     nezamykají. Testy: `levelUpClassStep.test.tsx` (wizard Fighter Battle
     Master 3 → 4), odmítnutí v `levelUp.test.tsx`, zamčení v testech
     `MasteryPicker`, `ExpertisePicker`, `ClassFeatureChoicePicker`.
     Neověřováno v prohlížeči.
   - Oprava 8d3-fix2 (D109): stejný zámek jako D108, rozšířený na krok
     `featAsi` a `classOptionalFeatures` (D64). `FeatAsiPicker` dostal
     `lockedLevels` — fieldset dřívějšího grantu je celý `disabled` a
     legenda říká „chosen at an earlier level". `ClassOptionalFeaturePicker`
     dostal `lockedChoices` (uložené `optionalFeatureChoices` bez podtřídiny
     progrese) a zamyká podle `featureType` stejným `SearchableOption.locked`
     vzorem jako subclass optional features. `heldPicks.ts` přibyly
     `featAsiChoices` (srovnání podle `level`, pak `kind`+`name`/`source`
     nebo `increases`) a `classOptionalFeatureChoices` (srovnání podle
     `featureType`+jméno); `overwrittenHeldPicks` odmítá stejně jako u D108.
     Wild Shape formy a kouzla se pořád nezamykají (D104/D106). Testy:
     rozšířené `it.each` odmítnutí a nový přímý test `overwrittenHeldPicks`
     v `levelUp.test.tsx`. Neověřováno v prohlížeči.
9. [in progress] Play tracking a odpočinky

   | Slice | Co | Schéma |
   |---|---|---|
   | 9a1 | Dočasné životy, panel poškození/léčení v hlavičce, clamp current HP na 0 (D110) | 34→35 |
   | 9a2 | Death saves — panel v hlavičce při 0 HP, hod appky i ruční klik, stabilizace/smrt (D111) | 35→36 |
   | 9b1 | Model zdrojů (výpočet + úložiště, BEZ UI), `Character.play`, clamp spotřeby při odebrání úrovně | 36→37 |
   | 9b2 | Uses v tabulce akcí pro 8 zdrojů s maximem (`UsesTracker`) | — |
   | 9b3 | Spotřebované sloty kouzel — zvlášť běžné a Pact Magic (D11) | 37→38 |
   | 9b4 | Spotřebované hit dice — jen úložiště a clamp, bez UI | 38→39 |
   | 9b5 | Tlačítka Short Rest a Long Rest v hlavičce, jeden atomický zápis | — |
   | 9b6 | Utracení hit die: hod v sekci Hit dice léčí a odečte kostku jedním kliknutím | — |
   | 9c1 | Pilot hodů kostkou: tlačítko Roll u to-hit zbraňových útoků | — |
   | 9c2 | Roll u vlastností, záchran, dovedností, iniciativy a poškození zbraně (víc kostek) | — |
   | 9c3a | Výhoda/nevýhoda u každého d20 Roll (ruční přepínač u tlačítka) | — |
   | 9c3b | Historie hodů v hlavičce (max 50, jen v paměti); režim přežije změnu modifikátoru | — |
   | 9d1 | Koncentrace: které kouzlo postava drží, tlačítko u kouzla + řádek v hlavičce | 39→40 |
   | 9d2 | Záložka „Vzhled a poznámky": tři volné textové pole na `Character` | 40→41 |
   | 9d3 | Střelivo u držené zbraně v tabulce akcí, „−1"; `quantity` smí být 0 | — |
   | 9d4 | To-hit hod držené zbraně se střelivem utratí 1 kus automaticky (jen při jednoznačné shodě) | — |

   - Slice 9a1 (D110) — PILOT pro ukládání play state, další slice kroku 9
     kopírují jeho tvar. `Character.temporaryHitPoints?: number` (schéma 35,
     migrace 34→35 jen tag — nepřítomnost je správná hodnota pro každou
     existující postavu); 0 se ukládá jako nepřítomnost pole, na rozdíl od
     `currentHp`, kde 0 je platný stav. Dočasné životy jsou DRUHÁ hromádka:
     hlavička je ukazuje jako „30 / 39 + 8 temporary", nikdy je nepřičítá.
     Nový `src/hitPoints/damageHealing.ts` (čisté funkce `applyDamage`,
     `applyHealing`, `grantTemporaryHitPoints`): poškození jde nejdřív z
     dočasných a teprve zbytek z current, léčení clampuje na
     `computeMaxHitPoints` (ne na uložené číslo — `maxHpOverride` existuje) a
     dočasné neobnovuje, nový grant se nesčítá (vyhrává vyšší). Panel
     `DamageHealingPanel` v `SheetHeader.tsx`: pole Amount + Damage / Heal /
     Gain temporary HP, jeden zápis obou hromádek. D43: bez nastaveného
     `currentHp` jsou tlačítka nedostupná s důvodem, při neznámém maximu
     odpadá jen Heal. Přímé zadání zůstává a přibylo třetí pole „Temporary
     HP". Current HP nikdy pod 0 — clamp v `buildCharacter`, `setHitPoints`,
     `HitPointField` i `currentHpAfterMaxHpChange` (zavírá otevřenou otázku z
     kroku 8, odebrání úrovně mohlo poslat current do minusu); clamp SHORA se
     dál nedělá. `CharacterStore.setHitPoints` bere objekt
     (`HitPointFields`) místo pozičních argumentů. Testy:
     `damageHealing.test.ts`, nový blok v `SheetHeader.test.tsx`, temp/clamp
     testy v `characterStore.test.ts`, migrace 34→35 v `migrations.test.ts`,
     jeden blok v `CharacterSheet.test.tsx`. Ověřeno v prohlížeči (Fighter 5,
     max 39): grant 8 → nižší grant 5 nezvýšil, poškození 12 sežralo 8
     dočasných a 4 z current, léčení 50 zastavilo na 39, poškození 99 na 0,
     přímé zadání dál funguje.
   - Slice 9a2 (D111) — death saving throws. `Character.deathSaves?: {
     successes, failures }` (schéma 36, migrace 35→36 jen tag), počty 0–3,
     nepřítomnost = neběží žádný. Pole existuje VÝHRADNĚ při `currentHp === 0`
     a je to invariant úložiště, ne jen podmínka zobrazení: jediná
     implementace pravidla `deathSavesAfterHitPointChange` běží v
     `buildCharacter`, `setHitPoints` i v hlavičce, takže léčení panelem,
     přímé zadání, level up i odebrání úrovně postup smažou samy a nezbyde
     nic, k čemu se vrátit. Nový `src/hitPoints/deathSaves.ts` (čisté funkce
     `classifyDeathSaveRoll`, `applyDeathSaveRoll`, `recordSuccesses`,
     `recordFailures`, `deathSaveState`, `describeDeathSaveRoll`).
     `DeathSavePanel` v `SheetHeader.tsx` (jen při 0 HP):
     počty, tlačítko „Roll death save" (d20 bez bonusů, hozené číslo se
     ukáže — nat 20 = 1 HP zpátky a konec, nat 1 = dva neúspěchy se stropem 3,
     10–19 úspěch, 2–9 neúspěch) a čtyři tlačítka pro fyzickou kostku —
     „Success" / „Failure" (přímý zápis jednoho počtu) a „Natural 20" /
     „Natural 1" (jdou stejnou cestou `applyDeathSaveRoll` jako appkin hod,
     takže hráč s fyzickou k20 nahlásí i tyto dva okraje — doplněno po 9a2
     click-through 2026-09-17), vše dostupné vedle sebe bez přepínače. Tři
     úspěchy = stabilizace,
     tři neúspěchy = smrt; v obou případech jsou všechna tři tlačítka disabled
     a panel zůstává viditelný — zmizelý panel by se četl jako chyba appky.
     `HitPointFields` nese čtvrté pole, aby hit pointy a death saves šly jedním
     zápisem. Testy: `deathSaves.test.ts`, blok v `SheetHeader.test.tsx`,
     invariant + round trip + odmítnutí mimo rozsah v `characterStore.test.ts`,
     migrace 35→36 v `migrations.test.ts`. Ověřeno v prohlížeči (Fighter 5,
     max 44): panel jen na 0 HP, hody 7/19/1/20 daly přesně své výsledky,
     ruční klikání se zastropovalo na 3, stabilizace i smrt zamkly tlačítka
     (smrt s panelem dál na obrazovce), léčení i přímé zadání panel i uložený
     postup smazaly.
   - Slice 9b1 — model limitovaných zdrojů. ŽÁDNÉ UI: výpočet, úložiště,
     migrace a jeden invariant. `Character.play?: { temporaryHitPoints?,
     deathSaves?, resourceUses? }` (schéma 37, migrace 36→37 PŘESOUVÁ obě
     stará pole pod `play`, `resourceUses` začíná nepřítomné). `resourceUses`
     je `Record<string, number>` SPOTŘEBOVANÝCH použití, klíčem je rozlišené
     jméno zdroje — data mají pro mnichův pool dvě jména („Ki" u TCE
     podtříd, „Focus Point" u Monka 2024) a obě padají do jednoho záznamu
     „Focus Point". Nový `src/calculation/resources.ts` (čisté funkce,
     `computeCharacterResources`, `resourceUsesWithinMaxima`,
     `resolveResourceName`): vrací každý zdroj s `Calculated<number>`
     maximem z per-level tabulky včetně rozkladu („Barbarian level 5:
     Rages"), nebo `unknown` s důvodem (D43) tam, kde je limit jen v próze.
     Test, co je zdroj, je ÚMYSLNĚ užší než D86 `isActionTableFeature`:
     `consumes.name` (8 poolů v datech) NEBO rest tag plus fráze o
     spotřebovaných použitích — samotný rest tag bere i Weapon Mastery, které
     se nespotřebovává. Podrobnosti a čísla v DATA.md. Invariant: spotřeba
     nikdy nepřeleze aktuální maximum — `levelRemovalPlan` ji po odebrání
     úrovně stáhne dolů (stejný nápad jako `deathSavesAfterHitPointChange`,
     jen navázaný na úroveň) a řádek o tom přidá do `dropped`; zdroj bez
     maxima v datech se neclampuje nikdy. Testy: `resources.test.ts`, blok v
     `levelRemoval.test.tsx`, migrace 36→37 a play/resourceUses v
     `migrations.test.ts` a `characterStore.test.ts`. Prohlížeč nebyl potřeba
     — slice nepřidává žádný ovládací prvek.
   - Slice 9b2 — Uses v tabulce akcí, jen pro 8 zdrojů se skutečným maximem.
     `FeatureActionData` (`featureActionRowData.ts`) nese nové pole
     `resourceName: string` — `consumes.name` řádku, resolvnuté stejným
     `resolveResourceName`, nebo (bez `consumes`) jméno samotné funkce (Rage,
     Second Wind — sebe-limitované zdroje nemají `consumes`, takže jejich
     vlastní jméno JE kandidátní jméno zdroje). Kandidát, ne rozhodnutí: teprve
     `CharacterSheet.tsx` ho hledá v `computeCharacterResources`' seznamu, a jen
     nalezené (8 zdrojů) dostanou `<UsesTracker>` v buňce Notes — zbylých ~90
     řádků zůstává beze změny (ověřeno testem s fixture bez `classTableGroups`).
     `UsesTracker` je stejná konvence jako death-save panel v `SheetHeader.tsx`:
     prostý počet plus dvě tlačítka disabled na okraji (0 a max), žádný nový
     styl komponenty. Zápis jde přes nový `onEditResourceUses` prop (vedle
     `onEditHitPoints`) do `CharacterStore.setResourceUses` — cílený zápis jako
     `setCurrency`/`setHitPoints`, mění jen `play.resourceUses`, `storedPlayState`
     (z 9b1) zůstal beze změny a dál filtruje nulové položky pryč. Sdílený zdroj
     (dva řádky se stejným rozlišeným jménem) čte i zapisuje jeden a týž klíč, což
     plyne přímo z toho, že klíč JE rozlišené jméno, ne řádek. `resources.ts`
     nezměněn (mimo rozsah slice). Testy: `featureActionRowData.test.ts` (nová
     pole, alias, bare-string `consumes`), nový blok `CharacterSheet.test.tsx`
     „Uses tracking…" (mark/undo/clamp/sdílený zdroj/not-in-data beze změny),
     `characterStore.test.ts` (nechybí — `setResourceUses` nemá vlastní
     testovací blok, pokryto integrací přes sheet testy a existující
     `storedPlayState`/`resourceUsesWithinMaxima` testy z 9b1). Ověřeno v
     prohlížeči: Fighter 1 (Second Wind 0/2 → mark → 2/2 → reload zachoval →
     undo → 0/2), tlačítka disabled na obou okrajích, `localStorage` ukládá
     `resourceUses` jen pro nenulové položky.
   - Slice 9b3 — spotřebované sloty kouzel, ve dvou oddělených poolech (D11).
     `Character.play.spentSpellSlots?: { ordinary?: Record<číslo slotu, počet>;
     pact?: number }` (schéma 38, migrace 37→38 jen tag). Pact Magic je jedno
     číslo bez klíče úrovně — postava má v jednu chvíli všechny pact sloty na
     jedné úrovni. `storedPlayState` normalizuje stejně jako u `resourceUses`
     (nula = nepřítomnost, prázdný záznam se nezapíše), zápis jde novým cíleným
     `CharacterStore.setSpentSpellSlots` přes prop `onEditSpentSpellSlots`.
     Výpočet slotů se NEMĚNIL — `computeSpellSlots` zůstává zdrojem maxim;
     přibyly k němu jen `spellSlotMaxima` (bound pro clamp; u víc tříd bere
     maximum z nich, protože slučování multiclass tabulek je krok 10) a
     `spentSpellSlotsWithinMaxima`. `levelRemovalPlan` clampuje po odebrání
     úrovně oba pooly a přidává řádky do `dropped` („Level 3 spell slots: 2
     spent, now 0"); když `computeSpellSlots` vrátí `unknown`, neclampuje se nic.
     UI: `UsesTracker` z 9b2 u každé úrovně s aspoň 1 slotem plus samostatný
     blok `.sheet__pact-slots` s vlastním nadpisem. Testy: `spellSlots.test.ts`,
     blok v `levelRemoval.test.tsx`, `characterStore.test.ts`, nový blok v
     `CharacterSheet.test.tsx`. Ověřeno v prohlížeči (Wizard 5, Warlock 3,
     odebrání úrovně 5→4).
   - Slice 9b4 — spotřebované hit dice, POUZE úložiště a clamp, BEZ UI.
     `Character.play.spentHitDice?: Record<'className|classSource', number>`
     (schéma 39, migrace 38→39 jen tag), klíč je stejný kompozit, jakým appka
     třídu identifikuje všude jinde. `storedPlayState` normalizuje stejně jako
     `resourceUses` (nula = nepřítomnost). Maximum je úroveň té třídy, takže
     `spentHitDiceWithinMaxima` v `calculation/hitDice.ts` nepotřebuje žádný
     datový soubor; `computeHitDicePool` se NEMĚNIL. `levelRemovalPlan` clampuje
     po odebrání úrovně a přidává řádky do `dropped` („Fighter hit dice: 4
     spent, now 3"); klíč třídy, kterou postava nemá, se zahodí. Ovládací prvek
     pro utracení kostky přijde až s krátkým odpočinkem (9b5) a hodem v panelu
     kostek (9c). Testy: `hitDice.test.ts`, blok v `levelRemoval.test.tsx`,
     `characterStore.test.ts`, `migrations.test.ts`. Bez kontroly v prohlížeči —
     slice nepřidává žádný ovládací prvek.
   - Slice 9b5 — tlačítka **Short Rest** a **Long Rest** v hlavičce sheetu vedle
     životů (`.sheet__rest`), obě se aplikují hned na klik, bez potvrzení. Co
     krátký odpočinek vrací, se čte z textu featury, ne z tagu: `shortRestRecovery`
     v `calculation/resources.ts` a nové pole `CharacterResource.shortRest`
     (`'all' | 'one' | null`). Z 8 zdrojů s maximem vrací krátký odpočinek JEDNO
     použití u Channel Divinity, Rage, Second Wind, Wild Shape a Psionic Energy
     Die, VŠECHNO u Focus Pointů, a NIC u Favored Enemy a Sorcery Pointů; Pact
     Magic sloty se ptají stejnou funkcí a vrací se celé (běžné sloty podle D11
     až po dlouhém odpočinku). Podrobná tabulka a pasti při čtení jsou v DATA.md.
     Dlouhý odpočinek maže `resourceUses`, oba pooly `spentSpellSlots` i celé
     `spentHitDice` a léčí na maximum přes `applyHealing` z 9a1. Dočasné životy
     se neruší ani jedním odpočinkem (D110), death saves zhasne až léčení
     dlouhého odpočinku (D111). Čistý výpočet je v `src/rest/rest.ts`
     (`afterShortRest`, `afterLongRest`), zápis jde jedním atomickým
     `CharacterStore.applyRest` přes prop `onRest` — čtyři hromádky se mění
     najednou, ne čtyřmi zápisy. Utracení hit die při krátkém odpočinku tady
     NENÍ, čeká na panel kostek (9c). Testy: nový blok v `resources.test.ts`,
     nový `rest/rest.test.ts`, bloky v `characterStore.test.ts` a
     `SheetHeader.test.tsx`. Ověřeno v prohlížeči (Barbarian 5 / Warlock 3).
   - Slice 9c1 — PILOT hodů kostkou, jeden spotřebitel: tlačítko **Roll** v buňce
     To Hit každého řádku zbraňového útoku (včetně Unarmed Strike) se známým
     to-hit; neznámý to-hit tlačítko nemá. Hod = 1d20 + vypsaný modifikátor,
     výsledek „13 + 5 = 18" vedle čísla, které se nemění. Appka nerozhoduje
     zásah ani kritický zásah. Výsledek je jen stav komponenty — neukládá se,
     zmizí po reloadu; komponenta je klíčovaná modifikátorem, takže změna čísla
     starý výsledek zahodí. Nový `src/dice/roll.ts` (`rollDie(sides, modifier,
     random = Math.random)` → `{ die, modifier, total }`) a
     `src/dice/RollButton.tsx` (obecné `sides`/`modifier`/`label`) pro 9c2 a
     utracení hit die. Testy: `dice/roll.test.ts`, blok v
     `CharacterSheet.test.tsx`. Ověřeno v prohlížeči (Fighter 5, Longsword).
   - Slice 9c2 — tlačítko **Roll** (d20 + vypsaný modifikátor, jen při známé
     hodnotě) u 6 vlastností („Roll Strength check"), 6 záchran („… saving
     throw"), 18 dovedností („… check") a u iniciativy v hlavičce; pasivní
     hodnoty ho nemají. U poškození zbraně (`AttackDamage.dice` „2d6") hodí tolik
     kostek, kolik výraz říká, a výsledek vypíše každou zvlášť („5, 2 + 2 = 9");
     `dice: null` (Unarmed Strike bez Martial Arts) tlačítko nemá. `rollDie` je
     nahrazen `rollDice(count, sides, modifier, random)` → `{ dice[], modifier,
     total }` a `parseDiceExpression("2d6")`; `RollButton` dostal `count`
     (výchozí 1). Stejná pravidla jako 9c1: jen stav komponenty, klíč = číslo,
     ze kterého se hází. Mimo rozsah: poškození kouzel, útoky kouzly a save DC.
     Testy: `dice/roll.test.ts`, bloky v `CharacterSheet.test.tsx` a
     `SheetHeader.test.tsx`. Ověřeno v prohlížeči (Fighter 5, Greatsword).
   - Slice 9c3a — výhoda/nevýhoda u každého d20 Roll (to-hit, vlastnosti,
     záchrany, dovednosti, iniciativa; 33 přepínačů na sheetu Fighter 5).
     Ruční přepínač Normal/Advantage/Disadvantage (`<select
     class="dice-roll__mode">`, „Roll mode for …") stojí před tlačítkem Roll,
     výchozí Normal; jeho změna nehází a starý výsledek nemaže (maže ho jen změna
     modifikátoru přes klíč). Advantage hodí 2d20 a počítá vyšší, disadvantage
     nižší; výsledek vypíše obě kostky a tu započtenou: „9, 14 (kept 14) + 5 =
     19", normální hod zůstává „14 + 5 = 19". `roll.ts`: nové `rollKeepOne(sides,
     modifier, mode, random)` → `{ mode, dice, kept, modifier, total }`
     (vyber jednu) vedle `rollDice` (součet všech, poškození). `RollButton` je
     teď jen d20 (`modifier`/`label`, bez `sides`/`count`); poškození zbraně
     používá samostatné `DamageRollButton` bez přepínače. Režim je stejně jako
     výsledek jen stav komponenty, takže změna modifikátoru (klíč) ho vrátí na
     Normal. Testy: `dice/roll.test.ts`, nový `dice/RollButton.test.tsx`, bloky v
     `CharacterSheet.test.tsx` a `SheetHeader.test.tsx`. Ověřeno v prohlížeči
     (Fighter 5, záchrana Strength: normal/advantage/disadvantage, Longsword
     damage bez přepínače).
   - Slice 9c3b — historie hodů pro celý sheet. Stav `rollHistory` v
     `CharacterSheet` (jen v paměti, ne v `Character.play`, po reloadu prázdná),
     nejnovější první, max 50 (`ROLL_HISTORY_LIMIT`, starší odpadá).
     `RollButton` i `DamageRollButton` mají `onRoll({ label, text })` — label =
     prop `label` (ten z aria-label), text = `formatKeepOneRoll`/`formatRoll`;
     vlastní inline výsledek zůstává. Všech 6 míst volání zapojeno (to-hit,
     poškození, vlastnosti, záchrany, dovednosti; iniciativa přes nové props
     `SheetHeader.rollHistory`/`onRoll`). Zobrazení: `<details
     class="sheet__roll-history">` „Roll history" na konci `SheetHeader`,
     výchozí zavřené (D41), položka „Label: výsledek" s velkým prvním písmenem
     (iniciativa má label „initiative"). Nový `src/dice/RollHistory.tsx`. Oprava
     z 9c3a: tlačítka už nemají `key` = modifikátor; výsledek maže reset stavu
     při renderu při změně modifikátoru (u poškození count/sides/modifikátor),
     zvolený režim zůstává. Ověřeno v prohlížeči (záchrana, poškození,
     iniciativa; historie otevřená z tabu Inventář).
   - Sloučení 9a2 s 9c3b (D117) — death save je hod jako každý jiný.
     `DeathSavePanel` hází `rollKeepOne(20, 0, 'normal')` ze sdíleného
     `src/dice/roll.ts` (vlastní `rollDeathSaveDie` v `deathSaves.ts` zrušen) a
     výsledek hlásí hlavičce: ta ho pošle do `onRoll` jako
     `{ label: 'death save', text: describeDeathSaveRoll(result) }`, takže v
     historii stojí jeden záznam „Death save: Rolled 1 — two failures." i pro
     přirozenou 1. Ruční „Natural 20"/„Natural 1" jdou toutéž cestou a taky se
     logují; „Success"/„Failure" ne (nejsou hod). Hozené číslo se zobrazuje v
     `<p class="sheet__death-save-roll" role="status">` v hlavičce, mimo panel —
     přirozená 20 panel odpojí a uvnitř by hláška zmizela s ním; drží se do
     dalšího hodu. Pravidla (`deathSaves.ts`) beze změny. Ověřeno v prohlížeči
     (13 → úspěch, ruční nat 1 → dva neúspěchy, ruční nat 20 → 1 HP, panel pryč,
     číslo i tři záznamy v historii dál vidět).
   - Slice 9d1 — sledování koncentrace, jen play tracking. `Character.play.
     concentratingOn?: string | null` (název kouzla; schéma 40, migrace 39→40 jen
     tag). Uložení píše „žádné" jako nepřítomnost pole, načtený `null` se čte
     jako žádné (`storedPlayState`, `toCharacterPlayState`). Nový
     `CharacterStore.setConcentration(id, name | null)` (cílený zápis jako
     `setSpentSpellSlots`); zápis HP i odpočinek ho nechávají být, protože
     `play` protékají přes `storedPlayState`. Tab Kouzla: u každého kouzla s
     `concentration: true` (z `spells.json`, ne z uložených dat) je v `<summary>`
     tlačítko „Concentrate on <název>" s `aria-pressed`; klik na jiné kouzlo
     přepíše bez dotazu, klik na aktivní ho zruší. Bez detailu kouzla (řádek
     „Unresolved") tlačítko není. Hlavička: `<p class="sheet__concentration">`
     „Concentrating: <název>" s tlačítkem „Drop concentration", jen když je
     kouzlo nastavené. Bez `onEditConcentration` (read-only sheet) hlavička
     řádek ukáže a tlačítka chybí. Nic dalšího: žádná detekce sesílání, žádné CON
     save, žádná vazba na odpočinek ani panel poškození. Testy: bloky v
     `CharacterSheet.test.tsx`, `characterStore.test.ts`, `migrations.test.ts`.
     Neověřováno v prohlížeči (zapojení `CharacterManager` → store kryjí jen
     testy store a sheetu zvlášť).
   - Slice 9d2 — šestá záložka `Vzhled a poznámky` (poslední v pořadí, za
     `Akce`). Tři sekce `<details>` (`Vzhled`, `Příběh`, `Poznámky`), každá s
     jedním prostým `<textarea>`; výchozí stav sbalené, sekce se otevírají
     nezávisle (prohlížeč drží stav, jako jinde na sheetu). Pole
     `Character.appearance`, `.backstory`, `.notes` (`string`, přímo na
     `Character`, ne pod `play` — popisují postavu, odpočinek se jich netýká;
     schéma 41, migrace 40→41 jen tag). Text se ukládá doslova: bez trim,
     bez parsování, prázdný řetězec = nepřítomnost pole (`buildCharacter`,
     `toCharacter`); import odmítne neřetězec. Nový
     `CharacterStore.setText(id, field, text)`, `CharacterSheet` prop
     `onEditText`. Zápis je odložený (D116): textarea zobrazuje jen lokální
     draft a `onEdit` se volá po 500 ms nečinnosti, na blur, při unmountu a na
     `beforeunload`/`pagehide` okna (D118 — zavřená karta jinak poslední text
     ztratila); je klíčovaná `character.id`, takže se text nepřenese na jinou postavu. Bez `onEditText` jsou textarey `readOnly`. Pozor:
     `wizardState.saveCharacter` skládá vstup pro `store.update` po polích, proto
     tři pole přenáší z `existing` — bez toho by je úprava/level up smazala.
     Žádné limity, markdown ani vazba na zbytek sheetu. Testy: bloky v
     `CharacterSheet.test.tsx`, `characterStore.test.ts`, `migrations.test.ts`,
     `wizardState.test.ts`, `CharacterManager.test.tsx` (skutečný store +
     sheet v jsdom). Neověřováno ve skutečném prohlížeči (CSS textarey,
     plynulost psaní při přerenderu celého sheetu na každý znak).
   - Slice 9d3 — střelivo v tabulce akcí. Držená zbraň s `ammoType` (17 v
     datech, všechny ranged) dostane v buňce Notes řádek za každý inventářový
     řádek, který ji živí, s počtem a tlačítkem „−1"; zbraň bez `ammoType`
     (včetně Thrown) beze změny. Vazba je čistě strukturální (DATA.md,
     „Ammunition"): `ammoType` je klíč `name|source` právě jednoho střeliva a
     balíček („Arrows (20)") ho drží v `packContents` — startovní výbava dává
     balíček, ne `Arrow`, takže párování jen podle `ammoType` by nováčkovi
     ukázalo 0. Nový `src/inventory/ammunition.ts` (čisté `ammoEntriesFor`,
     `canSpendAmmo`, `spendAmmo`): volný řádek jde o 1 dolů a na 0 se zastaví;
     balíček se při prvním utracení otevře (−1 balíček, zbylé kusy se přičtou
     k čistému řádku téže položky nebo z nich vznikne nový na místě balíčku);
     nic vhodného v inventáři = řádek „Arrow: 0" s vypnutým tlačítkem (D43).
     Zápis jde přes týž `onEditInventory` → `CharacterStore.setInventory` jako
     každá změna počtu v Inventáři; sdílený je i `withQuantity`. **Změna
     invariantu:** `quantity` smí být 0 (validátor `< 1` → `< 0`, pole v
     Inventáři `min` 1 → 0) — řádek se spotřebovaným střelivem zůstává k
     doplnění, Discard zůstává jediné odebrání. Schéma ani migrace beze změny
     (starší uložené postavy jsou platné dál). `ItemRef` nese `ammoType` a
     `packContents`, `WeaponAttack` nese `ammoType`. Guard v `validate-data`:
     každý `ammoType` a `packContents` střeliva míří na existující položku.
     Testy: `ammunition.test.ts`, blok v `CharacterSheet.test.tsx`,
     `inventoryData.test.ts`, `characterStore.test.ts`. Neověřováno v prohlížeči
     (testy assertují přesně, co se vykreslí).
   - Slice 9d4 — automatické utracení střeliva. Tlačítko Roll u to-hit držené
     zbraně s `ammoType` po hodu zavolá stejný `onSpend` → `spendAmmo` jako
     ruční „−1" z 9d3, takže Inventář vidí stejné číslo. Utrácí jen to-hit hod
     té zbraně (ne damage, ne jiný hod). Nová čistá `autoSpendEntry` v
     `ammunition.ts`: utrácí jen když je právě jeden řádek střeliva a jde
     utratit. Na 0, bez odpovídající položky, nebo bez `onEditInventory` hod
     proběhne a nic se nezapíše. Při víc řádcích (Arrow + Arrow +1, volné +
     balíček) se nic neutrácí a zbývají jen ruční „−1" — appka nehádá, které
     střelivo hráč vystřelil. Testy: `autoSpendEntry` v `ammunition.test.ts`,
     blok „the to-hit roll spends ammunition" v `CharacterSheet.test.tsx`.
     Neověřováno v prohlížeči. Tím je 9d hotové.
   - Slice 9b6 — utracení hit die z UI. Sekce „Hit dice" ukazuje u každé
     třídy `zbývá / maximum` (`count − spent`) a `DamageRollButton` (1 kostka
     třídy + modifikátor Constitution, ten, který list už počítá). Jedno
     kliknutí: hodí, vyléčí o výsledek přes `applyHealing` (strop = maximum HP,
     dočasné HP se nemění, death saves podle `deathSavesAfterHitPointChange`) a
     přidá jednu spotřebovanou kostku té třídy. Nejsou to jedna, ale dvě
     volání (`onEditHitPoints`, pak nový `onEditSpentHitDice`), protože žádná
     store metoda nepíše `currentHp` i `spentHitDice` společně; obě čtou
     čerstvé úložiště. Nová `CharacterStore.setSpentHitDice` (cílený zápis jako
     `setSpentSpellSlots`), `handleEditSpentHitDice` v `CharacterManager`,
     `HitDiceEntry.classSource`. Na 0 zbývajících je tlačítko `disabled`.
     Není za tlačítkem Short Rest — utratit jde kdykoli. Bez `onEditHitPoints`
     / `onEditSpentHitDice` hod proběhne a nic se nezapíše. `DamageRollButton`
     dostal `disabled` a předává `DiceRoll` jako druhý argument `onRoll`
     (součet je potřeba k léčení). Short Rest hit dice nechává, Long Rest je
     vrací všechny (beze změny, přidán test). Neověřováno v prohlížeči.
     Zbylé kolo testů: viz docs/REPORT.md.
   - Implicitní jedno použití — sebe-limitovaný zdroj bez sloupce v tabulce,
     který NENÍ pool (nic ho nespotřebovává přes `consumes`), dostane maximum 1,
     když jeho vlastní text říká jen „can't do so / use it / use this feature
     again until you finish a Short/Long Rest" a nejmenuje počet (`twice`,
     `uses`, `N times`, `number of times`). Zmínka o vlastnosti, `modifier` či
     `proficiency` ho neblokuje (D119 — byl to vždy DC nebo vzorec, ne počet).
     `isImplicitSingleUse` v `calculation/resources.ts`, rozklad „X: can't be
     used again until a rest, no count stated". 40 z 92 jmen v datech (seznam
     v DATA.md), UI beze změny — `UsesTracker` se ukáže sám. Aberrant Dragonmark
     a Natural Recovery jsou vyňaté jménem (`TWO_INDEPENDENT_LIMITS`, D119): dva
     nezávislé limity v jednom záznamu, tracker nemají. Testy: blok „one use
     where the text states only a recharge" a hlídač proti reálným datům v
     `resources.test.ts`. Ověřeno v prohlížeči (Monk 2: Uncanny Metabolism
     `Uses: 0 / 1`).
   - Implicitní jedno použití obnovuje i Short Rest, když to říká věta o
     dobití: „can't do so / use it / use this feature again until you finish a
     Short Rest or Long Rest". `singleUseRechargesOnShortRest` v
     `calculation/resources.ts`, platí jen pro zdroje s `isImplicitSingleUse`
     a jen tehdy, když `shortRestRecovery` nenašel nic — vrací `'all'`. 7 jmen
     v datech: Stroke of Luck, The Third Eye, Illusory Self, Telekinetic
     Movement, Clairvoyant Combatant, Mage Slayer, Unbreakable Majesty (poslední
     tři od D119). Long-Rest-only zdroje beze změny. Testy: blok „a single use that
     recharges on a Short Rest too" v `resources.test.ts` + jeden v
     `rest.test.ts`. Ověřeno v prohlížeči (Rogue 20: Stroke of Luck utracen
     `1 / 1` → Short Rest → `0 / 1`).
   - D120: `STATES_A_COUNT` chytá jen počet vlastních použití (ne „twice your
     X", ne „uses of Rage/Wild Shape") → Superior Atlas, Undying Sentinel,
     Psi-Powered Leap, Persistent Rage, Wild Resurgence, Archdruid mají max 1
     (46 jednoduchých použití). Magic Item Tinker v `TWO_INDEPENDENT_LIMITS`,
     bez trackeru. Action Surge (1, od Fighter 17 → 2) a Indomitable (1, od 13
     → 2, od 17 → 3) z ručně psané `LEVEL_SCALED_USES`. Short Rest vrací celý
     pool i Action Surge a Psi-Powered Leap (9 jmen celkem); Indomitable jen
     Long Rest. 48 známých maxim bez tabulky. Testy v `resources.test.ts`
     (fixtures + hlídač proti reálným datům).
   - Oprava 9d1 (click-through 2026-09-20): koncentrace na kouzlo, které už
     postava nemá (úprava ve wizardu, ztracený grant podtřídy/featu/rasy),
     se na sheetu neukazuje — hlavička ani tlačítko. Rozhoduje se při
     renderu v `CharacterSheet.tsx` proti `combinedSpells`, ne při zápisu:
     úplnou množinu kouzel skládá jen sheet. Platí jen když všechny čtyři
     načtené granty doběhly pro TUTÉŽ postavu a žádný neselhal (D43) — do té
     doby se uložená hodnota ukazuje. `play.concentratingOn` v úložišti
     zůstává, dokud hráč neklikne jinam. Testy: 3 nové v bloku `concentration`.
     Ověřeno v prohlížeči (Cleric Life 3, Bless z domény → Remove level 3 →
     hlavička i tlačítko pryč).
   - Původ featury (click-through 2026-09-20): za jménem je šedý štítek
     `.sheet__feature-origin` — v sekci „Class and subclass features" (místo
     „(level N)") a u řádků schopností v tabulce akcí. Class featura
     „(Fighter 2)", subclass „(Battle Master, Fighter 3)", feat „(Feat, level
     4)", volba optional feature jen třída/podtřída bez úrovně (D99) —
     „(Sorcerer)", „(Battle Master)"; u multiclassu nebo selhaného načtení
     Class options bez štítku. `GrantedFeature` nese `className` a
     `subclassShortName` z dat (resolver je dřív zahazoval),
     `FeatureActionData.origin`, `grantedFeatureOrigin`. Rasové rysy sheet
     nevypisuje, štítek nemají. Testy: `featureActionRowData.test.ts`, 3 v
     `CharacterSheet.test.tsx`.
   - Scroll na wizard (click-through 2026-09-21): „Level up" a „Edit character"
     po otevření wizardu odscrollují stránku na `.char-create` (wizard se dál
     vykresluje pod sheetem, `CharacterManager.tsx`). Wizard se připojí skoro
     prázdný a plní se po načtení dat, proto se `scrollIntoView` opakuje přes
     `ResizeObserver` prvních 2 s. Test: 1 v `CharacterManager.test.tsx`
     (jsdom nemá `ResizeObserver`, ověřuje jedno volání na `.char-create`).
   - Zbytek kroku 9: nic dalšího v tomhle výčtu; otevřené otázky jsou v posledním REPORT.md.
10. [not started] Multiclass

## Co appka umí navíc k build orderu

- Data extrakce + validace (`npm run validate-data`) — běží při každé
  změně, hlídá i ruční opravy dat proti PHB 2024 tam, kde 5etools nese
  starý (2014) tvar (D68, D80).
- Feature-reference resolver — text schopnosti, která odkazuje na jinou
  (subclass, feat, optional feature), se rozbalí přímo na místě, sbaleno
  v `<details>`.
- Resolver plné množiny class/subclass featur (D87) —
  `src/sheet/grantedClassFeatures.ts`. `grantedClassFeaturesFrom` vezme seed
  z `classFeatureIds`/`subclassFeatureIds` do úrovně postavy (match sdílený
  s `featureNamesFor` přes nový `src/sheet/featureReach.ts`), pak tranzitivní
  uzávěru přes `ref*` uzly v prostém textu (ne uvnitř counted `options`),
  párováno přes id/uid. Vynechává choice kontejnery (counted `options` plný
  `refClassFeature`/`refOptionalfeature`) a `gainSubclassFeature` placeholdery
  — ty už řeší sekce `classFeatureChoices` / `classOptionalFeatures` /
  hlavička. Wrapper featura (Life Domain) zůstává jako běžný řádek vedle svých
  částí. Výpis je nová sekce "Class and subclass features" na záložce
  "Schopnosti a rysy", stejný `<details>` + `ResolvedEntries` pattern jako
  featy (D51); nenahrazuje ani neslučuje stávající sekce. Read-only.
  `featureIdForRef` nově exportován z `src/featureResolver`. Testy:
  `grantedClassFeatures.test.ts` + blok v `CharacterSheet.test.tsx`.
- Weapon proficiency/mastery a Extra Attack — jeden sdílený modul,
  strukturálně (podle dat zbraně), ne podle jména třídy.
- Sdílený data loader — každý soubor z `data/` se stáhne nejvýš jednou.
- Uložení — localStorage, verzované schéma (teď 36), migrace fungují od
  verze 16 výš (D69); starší uložená postava se odmítne, ne převede. Migrace
  29→30 je první, která DATA PŘESOUVÁ, ne jen přepisuje tag: ručně napsané
  `maxHp` jde do `maxHpOverride` (D91). Migrace 30→31 je první, která hodnotu
  nechává NEZNÁMOU: z jmen v `masteries` dělá objekty bez úrovně (D97); 31→32
  dělá totéž s `expertiseSkills` (D98) a 32→33 s `choices` uvnitř každého
  záznamu `optionalFeatureChoices` (D99).
- Trvalá hlavička sheetu (přestavba sheetu, slice 1) —
  `src/sheet/SheetHeader.tsx`. Blok nad obsahem sheetu se šesti hodnotami:
  jméno, AC, iniciativa, rychlost, proficiency bonus, životy. Pět odvozených
  se přesunulo z plochého výpisu beze změny výpočtu a drží si rozklad na
  vyžádání (D40/D41). Životy jsou od slice 8a napůl počítané: MAXIMUM je
  šesté `Calculated<number>` s vlastním rozkladem (`.sheet__max-hit-points`),
  CURRENT zůstává ruční `currentHp` (D9) — 0 platná — ale od 8d3-fix3 (D107)
  dostane výchozí hodnotu samo: na plno při tvorbě, o rozdíl `maxHp` při level
  upu i odebrání úrovně; ruční přepsání kdykoli pak vyhrává. Druhé vstupní
  pole je "Max HP override" (`maxHpOverride`), ne maximum samo, třetí je od
  9a1 "Temporary HP" (D110) a pod nimi je panel poškození/léčení a — jen při
  0 current HP — panel death saves (9a2, D111), pod ním poslední hozené číslo
  death save (D117, zůstává i po zmizení panelu);
  `CharacterStore.setHitPoints` píše všechna čtyři pole jedním objektem.
  Od R4c (D168) je HP karta i drawer Hit Points v `src/sheet/HitPoints.tsx`
  a `SheetHeader` ji jen umisťuje (slot `hitPoints`).
  Není sticky (může se
  řešit později). Testy: `SheetHeader.test.tsx` a sekce v
  `CharacterSheet.test.tsx`.
- Záložky sheetu (přestavba sheetu, slice 2) — `src/sheet/CharacterSheet.tsx`.
  Pět záložek pod hlavičkou: `Vlastnosti a hody` (vlastnosti, savy, skilly,
  pasivní hodnoty, Size and darkvision, Senses, hit dice), `Kouzla`
  (spellcasting attack/DC, sloty, seznam kouzel), `Inventář` (předměty +
  odolnosti/imunity/zranitelnosti), `Schopnosti a rysy` (featy, class feature
  choices, class options, Wild Shape, familiar), `Akce` (tabulka akcí).
  Klientský stav, výchozí `stats`, bez URL routingu. Panely zůstávají
  mountnuté, neaktivní skrývá `.sheet__panel` CSS. Nový blok testů `sheet
  tabs (rebuild slice 2)`. Od slice 9d2 je záložek šest: za `Akce` přibyla
  `Vzhled a poznámky` (tři volná textová pole).
- Tabulka akcí (přestavba sheetu, slice 3) — `ActionsSection` v
  `src/sheet/CharacterSheet.tsx`. `<table class="sheet__actions-table">`,
  sloupce Name · Range · To Hit · Damage · Notes, řádek na drženou zbraň +
  Unarmed Strike. Prezentace jen — čísla z `computeWeaponAttacks` beze
  změny. Řádkový model `ActionTableRow` (ReactNode na sloupec) je připravený
  na řádky kouzel (slice 4) a schopností (slice 5). "Attacks per action"
  souhrnný řádek nad tabulkou. Selektory `.sheet__action-*`.
- Řádky kouzel v tabulce akcí (přestavba sheetu, slice 4) —
  `src/sheet/spellActionRowData.ts` (výběr a formát, čisté funkce) a
  `spellActionRow` v `CharacterSheet.tsx` (jen vykreslení). Řádek má každé
  kouzlo se `spellAttack` nebo `savingThrow`, řazeno podle úrovně a jména;
  jméno nese stejné popisky jako záložka Kouzla (`(Cantrip)` / `(Level 3)`,
  ritual, concentration), Range jde přes `formatRange`. Sloupec "To Hit / DC"
  ukazuje útočný bonus a/nebo "DC <n> <vlastnost>" — obojí s rozkladem
  (D40/D41) a obojí z už existujících výpočtů. Damage jen u cantripů se
  `scalingLevelDice`, jinak prázdná (D21); Notes u kouzel vždy prázdné. Testy:
  `spellActionRowData.test.ts` + blok `spell rows in the actions table
  (rebuild slice 4)` v `CharacterSheet.test.tsx`.
- Řádky použitelných schopností v tabulce akcí (přestavba sheetu, slice 5
  část A) — `src/sheet/featureActionRowData.ts` (výběr, čistá funkce) a
  `featureActionRow` v `CharacterSheet.tsx` (jen vykreslení). Zdroje: plná
  množina class/subclass featur z D87 resolveru a featy, které postava vzala
  (`featAsiChoices` + `FeatTextEntry`). Kvalifikaci rozhoduje výhradně
  `isActionTableFeature` (D86), nezměněné. Řádek nese JEN jméno — Range, To
  Hit / DC, Damage i Notes zůstávají prázdné, protože počet použití ani pool
  nejsou v datech čísla (`consumes` pojmenovává pool, ne počet). Pořadí:
  featury v pořadí resolveru (úroveň, pak jméno), pak featy; deduplikace podle
  jména. `GrantedFeature` nově nese `consumes` (jinak by vypadlo 72 z 215
  kvalifikujících featur, které nemají rest tag). Feat bez nalezeného textu
  řádek nedostane (D43 — chybějící text hlásí sekce Feats). Testy:
  `featureActionRowData.test.ts` (12 případů) + blok `usable-feature rows in the
  actions table (slice 5 part A, D86)` v `CharacterSheet.test.tsx` (Fighter,
  Barbarian, Cleric, feat, Metamagic, Maneuvers, fighting style).
- Volby optional feature v tabulce akcí (dokončení slice 5) —
  `OptionalFeatureOption` nově nese `consumes` (plní ho `optionalFeaturesByType`
  i `fightingStyleFeats`), takže tvar sdílený s wizardem a pickery už ho
  nezahazuje. `featureActionRows` má třetí zdroj: vzaté volby optional feature,
  testované týmž `isActionTableFeature` jako featury a featy, se stejnou
  deduplikací podle jména. Nová čistá funkce
  `chosenOptionalFeatureOptions(optionalFeatures, feats, selection, fightingStyle)`
  + `loadChosenOptionalFeatureOptions` v `src/optionalFeatures/optionalFeatureData.ts`
  vrací plné záznamy VŠECH vzatých options — class-level (Metamagic, Eldritch
  Invocations) i subclass-level (Maneuvers, Arcane Shot, Runes, FS:B) plus
  class-level fighting style. Záměrně nejde přes `chosenClassOptionalFeatures`:
  ta se ptá, která progression featureType udělila, a tou otázkou vypadnou
  právě subclassové volby. **Schéma se nemění** — úložiště drží jen jména
  (`optionalFeatureChoices` / `fightingStyle`) a plný záznam se dohledává až
  při čtení, přesně tam, kde `consumes` teď přežije. Fighting style nekvalifikuje
  (nemá `consumes` ani rest tag) a řádek nedostane. D43: uložená volba, kterou
  data už nenabízejí, se přeskočí. Zapsáno jako D88.
- Sekce "Subclass options" na "Schopnosti a rysy" (D88, zavírá mezeru,
  kterou D88 zaznamenalo) — `src/sheet/CharacterSheet.tsx`. Bere stejný
  `chosenOptionalFeatures` výsledek (`loadChosenOptionalFeatureOptions`) jako
  tabulka akcí, odečte od něj jména, která už ukazuje "Class options"
  (`classOptionalFeatures`), a zbytek vypíše stejným `<details>` +
  `ResolvedEntries` patternem jako featy (D51). Nic se nerenderuje, když po
  odečtení nezbyde nic. Zahrnuje i `character.fightingStyle` — nebyl zobrazen
  nikde jinde na sheetu. Testy: rozšířený blok `usable-feature rows in the
  actions table (slice 5 part A, D86)` v `CharacterSheet.test.tsx` — Battle
  Master maneuver jako plný text, fighting style jako plný text, a jedna
  dedup varianta (Class options už option ukazuje → Subclass options ji
  nezopakuje).
- Oprava množného čísla ve `formatRange` (přestavba sheetu, slice 5 část B) —
  `src/sheet/spellFormatting.ts`. `pluralize()` teď hledá nepravidelné tvary
  přes mapu `IRREGULAR_PLURALS` (`{ foot: 'feet' }`) dřív, než spadne na naivní
  `${label}s`; 60stopý dosah renderoval "60 foots", teď "60 feet". `miles` beze
  změny; atributivní větev pro plochu ("30-foot cone") `pluralize` nevolá a je
  nedotčená. Nový test `src/sheet/spellFormatting.test.ts` (6 případů `formatRange`).
- Přestavba sheetu, actionTableFeatureData — `src/actions/actionTableFeatureData.ts`
  (D86). `isActionTableFeature(feature)` je identifikační pravidlo pro
  budoucí tabulku akcí: true, když featura (class feature, subclass
  feature, feat nebo optional feature — cokoli s `entries`) nese pole
  `consumes`, NEBO její `entries` obsahují kdekoli v libovolné hloubce tag
  `{@variantrule Long Rest` nebo `{@variantrule Short Rest`. Ověřeno na 9
  featurách z průzkumu k D86 (Second Wind, Action Surge, Rage, Bardic
  Inspiration, Channel Divinity, Font of Magic, Innate Sorcery, Wild
  Shape, Lay on Hands — všechny true) plus Draconic Resilience (passivní,
  false). Vědomě přijaté false negatives podle D86: featura limitovaná
  jinak (např. "jednou za kolo") bez `consumes` a bez rest tagu se
  nezachytí a nedohledává se ručním seznamem — zůstává zobrazená jako
  běžný text ve Schopnostech a rysech. UI/tabulka zatím nepostavená. Test:
  `actionTableFeatureData.test.ts`.

## Dočasné scaffolding

- `src/CharacterManager.tsx` — list/rename/delete/export/import; nahradí
  ho sheet (krok 5).
- `src/CharacterInspector.tsx` — nepoužívaný (odpojený z UI), čeká na
  ruční smazání (nástroj pro delete to v tomhle repu opakovaně odmítl).
- `src/MarkupDemo.tsx` — ukázka rendereru; nahradí ho tvorba postavy a sheet.
- Investigation skripty čekající na ruční smazání (`git clean` je
  nesmazal, protože jsou trackované): `scripts/summarize-xmm-beasts.js`,
  `scripts/summarize-beast-display-shapes.js`,
  `scripts/investigate-wild-shape-rules.js`,
  `scripts/investigate-pact-of-the-chain.js`,
  `scripts/investigate-full-feature-resolution.js` (jeho zjištění jsou teď
  zapracovaná v D87 — spotřebovaný).
- Netrackované (nikdy commitnuté) soubory čekající na smazání:
  `src/featureResolver/surveyRefResolution.test.ts`,
  `scripts/survey-ref-resolution.txt`.

## Next step

**Rework sheetu (D121–D153) běží.** R1 hotový: `src/theme.css` (tokeny tmavé/světlé
téma na `html[data-theme]`, font stacky, @fontsource Bricolage Grotesque 500/600 a
Source Sans 3 400/600/700), `index.css` bez barevných literálů (hlídá
`theme.test.ts`), `src/storage/settingsStore.ts` (`familliar:settings`, `{ theme }`),
přepínač `ThemeToggle` v horní navigaci (zadání R2 ho tam nechalo), globální styly
button/input/select/checkbox a třídy `.btn--accent-outline` (Short/Long Rest),
`.btn--accent`, `.btn--heal`/`.btn--damage` (panel poškození/léčení), `.pill`,
`.pill--active`. Kontrola v prohlížeči po R1 neproběhla.

R1b hotový (D145, D151): seznam postav, sheet a wizard jsou tři oddělené pohledy
místo toho, aby seznam a sheet žily v jednom `<main>` a wizard se vykresloval pod
sheetem. Aktuální pohled nese URL hash (`src/navigation/route.ts` —
`parseRoute`/`formatRoute`, čistý pár funkcí, plus `useRoute` — jeden hashchange
listener na úrovni `App`; `CharacterManager` dostává `route`/`navigate` jako
props, hook nevolá sám). Tabulka hashů: `#/` seznam, `#/new` wizard nové postavy,
`#/character/<id>` sheet, `#/character/<id>/edit` a `.../level-up` wizard nad
existující postavou, `#/markup-demo` beze změny. F5 zůstává na pohledu; otevření
postavy / New / Edit / Level up / horní záložky PUSHují; dokončení nebo zrušení
wizardu REPLACE (Back ho znovu neotevře); neznámý hash nebo zmizelé id REPLACE na
seznam (`CharacterManager`'s route-validation effect, čeká na `charactersLoaded`
aby nekopla dřív, než se postavy načtou). `src/levelUp/LevelUpWizardGate.tsx`
dopočítá `LevelGains` z postavy při vstupu na level-up route (nejde v URL, ztratil
by se při F5) stejným `levelUpTarget`+`loadLevelGainsFor` jako `LevelUpButton`
(D101 — čisté/deterministické). Zrušen scroll-to-wizard z 4e67cad (D152) — wizard
už nesdílí stránku se sheetem. `CharacterManager.tsx` je teď per-view `if`/`return`
místo jednoho velkého návratu; `CharacterRow` ztratil "Hide" (sheet už nekoexistuje
vedle seznamu). Nové testy: `src/navigation/route.test.ts` (parse/format round
trip, neplatný hash, koncové lomítko), `src/App.test.tsx` (routing skrz opravdové
top-nav záložky a hashchange), `CharacterManager.test.tsx` přepsán na `Harness`
(vlastní `useRoute`) místo holého `<CharacterManager />`. Kontrola v prohlížeči
podle uživatele, viz REPORT.md.

R2 hotový (D153): kostra stránky sheetu. `SheetHeader` vrací tři sourozenecké bloky
— `.sheet__persistent-header` (portrét = první písmeno jména, jméno, řádek
`Species · Classes · Level N · Background` s Edit character / Level up / Remove
level, vpravo Short/Long Rest, pod tím historie hodů), `.sheet__strip` (šest
`AbilityModifierCards` z `src/sheet/AbilityModifierCards.tsx`, pak Proficiency,
Speed, Initiative, AC a HP blok beze změny chování) a `.sheet__status-row`
(`DamageResponsesSection` přesunutá z Inventáře, řádek koncentrace, prázdné místo
`.sheet__status-conditions` pro R12). Pod nimi `.sheet__body`: prázdný
`.sheet__left-column` (580px, vlastní scroll, plní R3) a `.sheet__right-panel`
(tab bar + `.sheet__panels` s vlastním scrollem). Pohled sheetu je
`main.sheet-view`, `#root:has(> .sheet-view)` má výšku 100dvh. Obsah záložek beze
změny; hodnoty vlastností jsou dočasně dvakrát (pás + záložka stats) do R3.
`LevelUpButton` má ikonu šipky a na úrovni 20 `title="Maximum level"`. CSS
kontejnmentu hlídá `src/sheet/sheetLayout.test.ts`. Kontrola v prohlížeči neproběhla
(viz REPORT.md).

R3 hotový (D154): levý sloupec naplněn, stats tab zrušen. `SHEET_TABS` má pět
položek (`spells`/`inventory`/`features`/`actions`/`notes`, pořadí a české
popisky beze změny — D123/D148 na zbylých pěti záložkách tímto úkolem
neaplikovány); výchozí `activeTab` je `'spells'`. `.sheet__left-column` (D153)
má teď dvě sub-sloupce: `.sheet__left-a` (Saving throws — grid, dvě sub-
sub-sloupce po třech — Passive values, Darkvision v `.sheet__traits`,
granted Senses) a `.sheet__left-b` (~252px, Skills). Každá hodnota nese svůj
inline rozklad (D40/D41) přesně jako ve starém stats tabu — jen kontejner a
pozice se mění. Ability scores ztratily vlastní seznam
(`.sheet__abilities` smazán) — karty `AbilityModifierCards` v pásu čísel
(R2) jsou od teď JEDINÉ místo, kde se vlastnosti zobrazují; nemají roll
tlačítko ani rozklad a task jim ho nepřidal (vědomý úbytek funkce, D154).
Size přešla do identity řádku v hlavičce vedle druhu (`.sheet__size`, bez
rozkladu). Hit dice přešly pod HP blok v `.sheet__strip`
(`.sheet__hit-dice`, stejná třída/markup/chování jako dřív) přes nový
nepovinný prop `SheetHeader`'s `hitDice: ReactNode`, obsah staví
`CharacterSheet`. **Proficiencies (Armor/Weapons/Tools/Languages) vynechány
— sheet je nikdy nezobrazoval, viz QUESTIONS.md.** Kontrola v prohlížeči
neproběhla (uživatel remote, viz REPORT.md). Další: R4 (rozklady do draweru,
D146).

R3b hotový (D155, D148): vrácen ability-check roll a anglické popisky/pořadí
záložek. `AbilityModifierCards` dostala nepovinný `onRoll`; karta pod
modifierem má teď `RollButton` (stejné zapojení do `recordRoll` jako saves/
skills, accessible name `"Roll <Ability> check"` jako před D154) — jediné,
co kartám R3 vzala a co bylo, podle zadání, chybou toho zadání, ne úmyslem.
Rozklad na kartách dál chybí, čeká na drawer (R4, D146). `SHEET_TABS`: pět
položek, pořadí a anglické popisky teď podle D123/D148 — `Actions · Spells ·
Inventory · Features & Traits · Notes`, výchozí `activeTab` je `'actions'`.
Id položek beze změny (testovací háčky). Záložka "Notes" nese pořád české
popisky svých tří polí (Vzhled/Příběh/Poznámky) — task se týkal jen popisků
záložek samotných. Kontrola v prohlížeči neproběhla (uživatel remote, viz
REPORT.md). Další: R4 (rozklady do draweru, D146).

R3c hotový (D162, hodnota šířky opravena R4-fixem/D164 na 1400px): šířkové
limity, čistě CSS/vizuální. `--page-max-width` (`src/index.css` `:root`) čte
jediná deklarace na elementu `main` —
seznam postav, wizard i sheet (`.sheet-view`) do `<main>` vykreslují, takže
je pokrývá jedna třída/proměnná místo tří kopií; `.sheet-view` ztratila svůj
vlastní `max-width: none`. Pod stropem `main` dál vyplňuje okno jako dřív.
Horní `.tabs` lišta zůstala na vlastním `max-width: 48rem` (mimo rozsah
zadání). D153 (sheet na jeden viewport) beze změny. Odstavce a seznamy z
markup rendereru dostaly čitelnou délku řádku: `Entry()` v
`src/markup/Markup.tsx` teď dává každému `<p>` ze stringu/čísla třídu
`mk-p`, `.mk-p`/`.mk-list` mají `max-width: 75ch` v `index.css` — jedno
místo, protože `Entry()`/`TypedEntry()` je jediný zdroj odstavců a seznamů
napříč celým rendererem (feature/feat/spell/item popisy). Tabulky
(`.mk-table-wrap`) limit nedostaly. Čtyři testy v `Markup.test.tsx`
přepsané na `<p class="mk-p">`. Osm číselných polí (`type="number"`) v
appce dostalo sdílenou třídu podle obsahu — `.input--narrow` (6ch:
množství v inventáři, custom item AC/rychlost/darkvision/Strength
requirement, Current/Max/Temp HP, HP Amount, ruční vlastnost i ruční
výsledek kostky ve wizardu) nebo `.input--narrow-money` (8ch: zlato/
stříbro/měď, custom item cena, přidané platinum) — jen šířka, typ pole a
chování beze změny. **Vědomě ponecháno:** pruh čísel v hlavičce se na
1400px přestane vejít na řádek a HP blok spadne pod něj — R4c HP kartu
zkompaktnil, šířku na 1366/1920 ale ověří až prohlížeč. Kontrola v prohlížeči neproběhla (zadání ji vyloučilo
— uživatel zkontroluje sám, viz REPORT.md).

R4 hotový (D163, breakpoint opraven R4-fixem/D164 na 1860px): sdílený boční
drawer existuje. `src/sheet/Drawer.tsx` exportuje `Drawer`, `DrawerSection`
(sekce, defaultně otevřená) a `DrawerRow` (řádek, defaultně zavřený); sekce i
řádek jsou `<details>`, značku ▾/▸ kreslí CSS. Drawer je `position: fixed`,
460px (`--drawer-width`), přes celou výšku okna, scrolluje jen
`.drawer__body` — sheet se kvůli němu nezužuje. Nad `1860px` (1400 + 460)
stojí vedle sheetu a `main:has(.drawer)` posune sheet o 230px doleva (dvojice
vycentrovaná jako celek), pod ní leží přes pravou část sheetu bez backdropu.
Otevřený obsah drží jeden `useState<DrawerContent | null>` v
`CharacterSheet.tsx` — UI stav, neukládá se, není v URL, jeden najednou;
zavírá `×` a Esc. Levý sloupec: `.sheet__passive-values` a `.sheet__traits`
zrušeny, místo nich karta `.sheet__senses-card` (nadpis Senses + ikona
ozubeného kola, accessible name "Senses details") se čtyřmi hodnotami BEZ
inline rozkladu (`CalculatedValueOnly` v `calculatedValue.tsx`); rozklady žijí
jen v draweru "Senses", jedna `DrawerSection` na hodnotu, obsah přes
`CalculatedNumber`/`ValueBreakdown` — od R4-fixu (D164) OTEVŘENÝ na první
vykreslení uvnitř draweru (`open`/`breakdownOpen` prop), jinde (saves, skills,
strip karty, HP) dál sbalený podle D41. `SensesList` (`.sheet__senses`) je
vnořený do té karty, nadpis `<h3>Granted senses`. Jméno vlastnosti na kartě v
pásu čísel je tlačítko, které otevře drawer s rozkladem SCORE (`score
(modifier)` + `ValueBreakdown`, obsah zrušeného stats tabu, rozklad taky
otevřený); roll tlačítko a advantage select na kartě beze změny. Testy:
`Drawer.test.tsx` (shell + oba bloky) a blok `side drawer (D146/D163)` v
`CharacterSheet.test.tsx` (rozšířený o kontrolu `open` na `<details>`).
Kontrola v prohlížeči neproběhla (zadání ji vyloučilo — uživatel zkontroluje
sám, viz REPORT.md). Další drawer obsahy (Manage Spells/Inventory/Feats)
čekají na své slice.

R4d hotový (D165): hody se spouštějí a zobrazují jinak. Advantage je jeden
globální přepínač Normal/Advantage/Disadvantage v hlavičce sheetu vlevo od
Short Rest (`RollModeContext`, UI stav v `CharacterSheet`), po každém d20 hodu
se vrací na Normal; `RollButton` nemá `<select>` ani inline výsledek. Výsledek
každého hodu ukáže `RollToast` (`src/dice/RollUi.tsx`, fixní vpravo dole, jeden
najednou, 6 s, ×, `aria-live="polite"`, u advantage obě d20 s nepoužitou
přeškrtnutou). Historie hodů je v draweru „Roll history" otevíraném tlačítkem
„Rolls" v horní liště (portál do slotu v `App`, jen při otevřeném sheetu);
disclosure v hlavičce zrušen. `<h1>Familliar</h1>` z `CharacterManager` zrušen.
Historie stále přežívá přepnutí postavy (známá chyba, samostatný task).
Testy: `RollButton.test.tsx`, bloky rolls/toast/roll history v
`CharacterSheet.test.tsx`, `SheetHeader.test.tsx`, `App.test.tsx`. Kontrola v
prohlížeči neproběhla (zadání ji vyloučilo).

R4b hotový (D166, D167): karty v pásu čísel (86px, HP karta beze změny) a levý
sloupec jsou kompaktní podle mockupu. Hodnota je tlačítko hodu (ability
modifikátor, save, skill, Initiative), jméno řádku / štítek karty otevře
rozklad v draweru, ozubené kolo na Saving throws a Skills ukáže všechny řádky
s otevřenými rozklady; inline „Roll" a `Breakdown` v těchto oblastech zmizely.
Nová karta Heroic Inspiration za Armour Class: ruční checkbox,
`Character.play.heroicInspiration` (schéma 44, migrace 43→44 jen tag),
`CharacterStore.setHeroicInspiration`; automatické udělování odložené. Hlášky
karty Armour Class jsou celé v draweru, na kartě jen krátká poznámka. Kontrola
v prohlížeči neproběhla (zadání ji vyloučilo — viz REPORT.md).

R4c hotový (D168): HP karta na konci pásu čísel (86px ve všech stavech) —
HEAL / Amount / DAMAGE, štítek HIT POINTS (otevře drawer „Hit Points") nad
„current / max", TEMP. Při 0 HP místo HIT POINTS blok DEATH SAVES (značky
úspěchů a neúspěchů, tlačítko d20, po konci slovo STABLE / DEAD). Drawer Hit
Points: rozklad maxima (otevřený), Current HP, Max HP override, Temporary HP,
„Gain temporary HP" s vlastním polem, Hit dice, při 0 HP ruční záznam death
saves (Success/Failure/Natural 20/Natural 1) s vysvětlením a poslední hozené
číslo. `SheetHeader` už death saves nemá. Status row: karty DEFENSES
(jednořádkový souhrn, štítek otevře drawer „Defenses" s původní sekcí),
CONDITIONS (jen placeholder, zakázané „+ Add condition"), CONCENTRATION (kouzlo
nebo „—", Drop). Nová komponenta `src/sheet/HitPoints.tsx`, testy
`HitPoints.test.tsx`. Kontrola v prohlížeči neproběhla (zadání ji vyloučilo —
viz REPORT.md).

R4c-fix (D169): poškození při 0 HP (přes dočasné HP) přidá jeden neúspěch
death save, stabilní postava přestane být stabilní (úspěchy na 0), třetí neúspěch
= dead; critický zásah ručně tlačítkem Failure (věta v draweru Hit Points).
Karta CONCENTRATION má min-width 260px a roste podle názvu kouzla, název se
zalamuje uvnitř karty a je i v `title`.

B2 (D170): karta Proficiencies v levém sloupci pod Senses, řádky ARMOR a
WEAPONS (jinak „None"); ozubené kolo otevře drawer se zdroji každé položky.
Výpočet `src/calculation/proficiencies.ts` (`computeProficiencies`): startovní
proficiency první třídy, XPHB Protector/Warden/College of Valor (ruční tabulka),
featy; stejná položka z více zdrojů = jeden záznam. Data jedou s
`loadWeaponAttackData` (pole `proficiencies`). Sub-sloupec A se natahuje do
výšky Skills a karta vyplní zbytek. Tools (B3) a languages (B4) zbývají.
Kontrola v prohlížeči neproběhla (zadání ji vyloučilo — viz REPORT.md).

B3 (D171): karta Proficiencies má třetí řádek LANGUAGES (Common, jazyky z
tvorby, Druidic, Thieves' Cant, Fey Teleportation, zvolený jazyk Prodigy) a
sekci Languages v draweru. Rogue +1, Ranger L2 +2 a Prodigy bez volby se
ukazují jako „N language(s) — not chosen" (picker zatím není, úložiště se
nemění). Tools zbývají, přijdou mezi WEAPONS a LANGUAGES.

B3b (D172): oprava zalamování karty Proficiencies (hodnota se zalamuje uvnitř
karty, štítek vždy na vlastním řádku). Extra jazyky Rogue (Thieves' Cant, 1) a
Ranger (Deft Explorer, 2) jdou zvolit: `character.languages` s `grantedBy`
`thievesCant`/`deftExplorer` (schéma 45, migrace 44→45 jen tag). Volba ve
wizardu (krok languages, `FeatureLanguageSlots` pod `LanguagePicker`), v
level-upu (krok languages se prochází na Ranger 2) a v draweru Proficiencies
(výběr / změna / smazání, `CharacterStore.setLanguages`). Nabídka = Standard +
Rare bez Common a bez už známých jazyků. Odebrání Ranger L2 maže Deft Explorer
jazyky. Tabulka grantů je `src/languages/classFeatureLanguages.ts`. Prodigy
zůstává „not chosen" (featové pod-volby jsou samostatný task).

B4 (D173): karta Proficiencies má řádek TOOLS mezi WEAPONS a LANGUAGES a sekci
Tools v draweru. Zdroje: background (`toolProficiency`), startovní
`toolProficiencies` první třídy (Druid, Rogue, Artificer, Bard, Monk), Warrior
of Mercy L3 (Herbalism Kit), Battle Master L3 (nástroj nezvolen), featy Chef,
Poisoner a uložené `proficiencies.tools` instance. Nezvolené volby (Bard 3
nástroje, Monk artisan/instrument, Artificer 1, Battle Master 1, Crafter,
Musician, Artificer Initiate, Prodigy) jsou „— not chosen"; Skilled nikdy.
Druidic a Thieves' Cant se už nenabízejí ve slotech extra jazyků (uložená volba
zůstává).

B5 (D174, D175): schéma 46 (`toolChoices`, `speciesSize`, migrace 45→46 jen
tag). Nástroje třídy/podtřídy jde zvolit (Bard 3, Monk 1 z artisan+instrument,
Artificer 1, Battle Master L3 1): sloty `ClassToolSlots` ve wizardu (krok
languages, pod sloty jazyků), v level-upu (Fighter 3 se prochází jako „unknown",
dokud se nezvolí podtřída) a v draweru Proficiencies, sekce Tools
(`CharacterStore.setToolChoices`, uloží se hned). Tabulka grantů
`src/toolProficiencies/classToolChoices.ts`; odebrání L3 volbu Battle Masteru
smaže. Featové volby nástrojů zůstávají „not chosen". Wizard u druhu s víc
velikostmi (23 druhů, např. Human) v kroku species žádá Small/Medium (radio,
`SpeciesSizePicker`); `computeSize` bere uloženou volbu, hlavička ukáže velikost,
bez volby zůstává „unresolved" (D54). Edit Character existujícího Battle Mastera
L3+ teď vyžaduje zvolit nástroj, jinak krok languages neprojde (stejně jako
Rogue u Thieves' Cant).

B6b (D176): schema 47 (new `grantedBy` values `mastermind` for languages and
`mastermind`/`kensei`/`artificerSubclass` for `toolChoices`, 46→47 tag only).
Fixed armor/weapon/tool/language grants from non-XPHB subclasses at class level
3 (EFA Artificer ×5, College of Swords, Forge/Order/Twilight, Shepherd, Rune
Knight, Drunken Master, Mastermind, Storm, Hexblade), keyed by subclass name +
source resolved through classes.json (`FEATURE_GRANTS` in `proficiencies.ts`).
New slots: Mastermind 1 gaming set + 2 languages, Kensei 1 of Calligrapher's /
Painter's Supplies, EFA Artificer replacement artisan's tool per subclass tool
already held elsewhere (computed, max 2; a surplus stored pick is kept and shown
as "no longer owed, not counted"). "Kensei weapons — not chosen" is a pending
WEAPONS row with no picker. Wizard step renamed "Languages & Tools". Level-up
banner on that step is gone once the class step has chosen the subclass; before
that it names the subclasses with a pick (Fighter, Rogue, Monk, Artificer 3).
Deferred: skills, Cavalier/Samurai, Scout expertise, species tools (B6c);
attack proficiency from subclass grants (B6d).

B6c (D177): schema 48 (`Character.subclassSkills`; `grantedBy` `cavalier`/
`samurai` for languages, `warforged`/`satyr`/`khoravar` for `toolChoices`; 47→48
tag only). Table `src/classSkills/subclassSkillGrants.ts`: fixed skills
(Drunken Master, Scout with expertise, Warrior of Mercy) derived; picks (Battle
Master Student of War — new, Order, Peace, Arcane Archer) and skill-or-language
(Cavalier, Samurai) stored. Skills table names "subclass (<name>)"; an unmade
pick notes its candidate skills. Species slots in "Languages & Tools":
Warforged/Satyr tool (`ClassToolSlots`), Khoravar skill-or-tool (skill →
`speciesSkills`). New slot UI `src/classSkills/SkillChoiceSlots.tsx` (wizard
only — no drawer editing for these). Expertise step never offers Scout's two
skills. Level-up: the "Languages & Tools" step is skipped at the subclass level
when the chosen subclass owes nothing (Fighter 3 Champion). Level removal at 3
drops the subclass skill picks and a Cavalier/Samurai language.
Next: attack proficiency from subclass grants (B6d).

**Krok 9 běží.** Slice 9a1 (D110) zavedla dočasné životy, panel
poškození/léčení v hlavičce a clamp current HP na 0 — a s ní tvar, který další
slice kroku 9 kopírují: nepovinné pole na `Character`, absence = nic
nespotřebováno, migrace jen tag. Slice 9a2 (D111) přidala death saves ve stejném
tvaru, navíc s invariantem vázaným na `currentHp === 0`. Slice 9b1 ta dvě pole
sloučila pod `Character.play` a přidala k nim `resourceUses` — od teď je play
state jeden objekt, ne rostoucí řada polí na `Character`.

Slice 9b2 postavila nad modelem UI (`UsesTracker` v tabulce akcí) a 9b3 ho
použila i pro sloty kouzel, ve dvou oddělených poolech podle D11.

Slice 9b4 přidala ke stejnému objektu spotřebované **hit dice** — jen úložiště
a clamp; ovládání přijde s 9c.

Slice 9b5 uzavřela 9b **odpočinky**: obě tlačítka v hlavičce a jeden atomický
zápis `applyRest` přes všechny čtyři hromádky.

Slice 9c1 přidala pilot hodů kostkou: `rollDie` a `RollButton` v `src/dice/`,
zapojené jen u to-hit zbraňových útoků. Slice 9c2 ho zapojila i u vlastností,
záchran, dovedností, iniciativy a poškození zbraně (víc kostek, `rollDice`).
Slice 9c3a přidala k d20 hodům ruční výhodu/nevýhodu (`rollKeepOne`, obě kostky
ve výsledku). Slice 9c3b přidala historii hodů v hlavičce (max 50, jen v
paměti). Slice 9d1 přidala sledování koncentrace (`play.concentratingOn`, schéma
40). Slice 9d2 přidala záložku `Vzhled a poznámky` (`Character.appearance`,
`.backstory`, `.notes`, schéma 41). Slice 9d3 přidala střelivo u držené zbraně
(bez schématu; `quantity` smí být 0). Slice 9d4 zapojila střelivo do to-hit
hodu (automatické −1 při jednoznačné shodě). Slice 9b6 dodala chybějící UI pro
hit dice: hod v sekci Hit dice léčí a utrácí kostku (`setSpentHitDice`).

Task A1 (D156) přidal `Character.grantedFeats` (schéma 42, migrace 41→42
jen tag): origin feat backgroundu se odvozuje, takže u starých postav začne
platit sám.

Task A2 přidal `FeatChoiceDetails.proficiencies` (schéma 43, migrace 42→43
jen tag): uložené skill/expertise picky se počítají v `skills.ts`, tools/
languages jen leží v úložišti. `featInstances`/`choiceDetails` je nese dál,
`featSkillChoiceAwaitingNotes` je zohledňuje při mazání D58 poznámky.

**Krok 8 je hotový** — poslední slice 8e2 (D106) označila na sheetu kouzla a
Wild Shape formy nad rámec toho, co postava smí mít.

Historie kroku 8: slice 8a (počítané maximum HP), 8a-guard (validace tabulky
bonusů, D95), 8b (krok wizardu pro volbu hod/průměr/ručně za úroveň, D96) a
8c0 (`CharacterStore.create` přes jeden objekt), 8c1 (`masteries` nese úroveň
volby, D97), 8c2 (`expertiseSkills` totéž, D98) a 8c3 (`optionalFeatureChoices`,
úroveň na jednotlivé volbě, D99) jsou hotové — **D22 je tím splněné pro všechna
pole, která ho potřebují**. Hotová je i **8d1** (D100): wizard běží nad
existující postavou, uložení ji přepíše, úroveň smí jen nahoru a už zapsané
volby si nechávají svou úroveň. Hotová je i **8d2** (D101): modul
`src/levelUp/levelGains.ts` odpoví, co na úrovni N přibývá, krok po kroku,
bez UI. Hotová je i **8d3** (D102): tlačítko "Level up" a zkrácený wizard,
první zápis `level` u nových voleb. Hotová je i **8d5** (D103): krok Hit
points v level-upu se ptá jen na nově získanou úroveň, ne na celou historii.
Hotová je i **8e** (D104): odebrání úrovně.

Krok 7 je hotový celý — přestavba sheetu, všech pět slice (trvalá hlavička,
záložky, tabulka akcí s útoky zbraněmi, řádky kouzel, řádky schopností +
oprava `formatRange`), včetně posledního odloženého bodu (volby optional
feature v tabulce akcí, D88) a sekce "Subclass options".

Otevřený kosmetický bod (vědomě odložený, D87 bod 5): wrapper featura (Life
Domain) se ve výpisu ukazuje jako běžný řádek vedle featur, které uvádí. Není
strukturální způsob, jak wrapper poznat, a jmenný seznam výjimek je přesně to,
čemu se projekt vyhýbá (D21). Znovu zvážit až po revizi skutečného sheetu.

Kouzla z rasy jsou hotová až na jednu mezeru (6c výš, D89/D90): picker
cantripu ze seznamu třídy pro 5 záznamů, které dnes jen hlásí, že appka to
neumí (QUESTIONS.md).

Pickery tří podtříd (Storm Herald, The Genie, Divine Soul) potřebují
rozhodnutí — viz QUESTIONS.md.
