# Status

Poslední aktualizace: 2026-09-25 (E2E-1: Playwright e2e — `npm run e2e`, scénáře smoke + podvolby featu, D180; před tím A3: picker podvoleb featu — wizard, level-up, Edit Character, D179; před tím B6d: jeden zdroj zbraňové proficiency pro kartu i útoky, D178; před tím B6c: dovednosti z podtříd, nástroje druhů, skrytý prázdný krok level-upu, D177; před tím B6b: proficiency grants from non-XPHB subclasses, D176; před tím B5: pickery nástrojů třídy a volba velikosti druhu, D174/D175; před tím B3b: zalamování karty Proficiencies, volba extra jazyků Rogue/Ranger, D172; před tím B3: řádek LANGUAGES na kartě Proficiencies, D171; před tím B2: karta Proficiencies — armor a weapons, D170; před tím R4c: HP karta s death saves, drawer Hit Points, status row Defenses/Conditions/Concentration, D168; před tím R4b: kompaktní levý sloupec a pás čísel, D166/D167; před tím oprava: stav hodů se při přepnutí postavy maže — `CharacterSheet` je klíčovaný podle `character.id`; dřív: R4d globální advantage, toast s výsledkem hodu, Rolls v horní liště)

Projekt běží i v Claude Code cloud sessions (C0): npm ci, typecheck, test a validate-data projdou; `npm run e2e:install` selže (403, host cdn.playwright.dev blokuje síťová politika), e2e tam zatím neběží.

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
    featy mířící na útoky/AC (kroky 7/8).
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
    nabízí. Enforcement počtu a nabízeného poolu dělá picker (A3).
    Task A3 (D179): `FeatSubChoicePicker` (`src/featAsi/`) — skill/tool/
    language/expertise picky 10 featů a kouzla + vlastnost Magic Initiate
    z backgroundu (seznam třídy u „Magic Initiate; X" pevný). Pod featem v ASI
    kroku (wizard, level-up, Edit Character) a pod origin featem v kroku
    backgroundu. Nikdy neblokuje Next; wizard a level-up ukazují „You can make
    this choice later in Edit Character.", sheet „Choices not made yet: … —
    make them in Edit Character." (počítá počty — Skilled 3 × skill/tool,
    Crafter/Musician 3 nástroje). Tvar volby: `featProficiencyChoiceShape`
    (`featEffects.ts`), pooly `loadFeatProficiencyChoice` (`featAsiData.ts`):
    Crafter jen svých 8 artisan's tools, Prodigy/Skilled jakýkoli nástroj.
    Co postava už má, se nenabídne (skill ukázán zakázaný se zdrojem, nástroj
    a jazyk skryté; nástroje/jazyky přes `computeProficiencies` +
    `toolsHeldElsewhere`), i picky ostatních featů. `WizardData.grantedFeats`
    (seed z postavy, ukládá se ze stavu); změna backgroundu maže jeho záznam.
    Jazyk z featu je jen na instanci (D158) a karta Proficiencies ho ukazuje
    se zdrojem „\<feat\> (feat)"; LanguagePicker ho nenabídne znovu.
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
10. [in progress] Multiclass — M0, M1a–c, F-8, M2, M3, M4, F-9, M5a, M5b done (see the entries below).

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
  (D40/D41) a obojí z už existujících výpočtů. Damage: cantrip ze
  `scalingLevelDice`, leveled kouzlo z tagů `{@damage}` na vlastní úrovni
  (`leveledSpellDice`, D206); Notes u kouzel vždy prázdné. Testy:
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

## E2E testy (D180)

`npm run e2e` (Playwright, headless Chromium; jednorázově `npm run e2e:install`).
`playwright.config.ts`: `webServer` = `npm run build` + `vite preview` na portu
4173 `--strictPort`, `reuseExistingServer: false`; timeout testu 60 s; screenshot
jen při selhání do `test-results/` (gitignorováno). Vitest dál jen `src/**/*.test.*`,
Playwright jen `e2e/*.spec.ts`; `e2e/` a config typecheckuje `tsconfig.node.json`.
Aktivní krok wizardu nese `aria-current="step"` (selektor scénářů).

- `e2e/wizard.ts` — průchod wizardem: Fighter (XPHB) N, background Acolyte,
  volitelně feat na úrovni 4, háčky pro krok druhu a krok featu.
- `e2e/smoke.spec.ts` — prázdný seznam, Fighter 1 přes wizard, sheet, seznam.
- `e2e/featSubChoices.spec.ts` — A3 a+b (origin feat Magic Initiate; Cleric
  s poznámkou „later", Next povolený; sheet hlásí 2× „Choices not made yet"),
  c (Prodigy jazyk na kartě Proficiencies a v draweru „Prodigy (feat)"; Human
  XPHB kvůli prerekvizitě), d (doplnění v Edit Character řádek odstraní).
- `e2e/featuresTab.spec.ts` — R6 a–f (Fighter 3 Battle Master: groups, options
  under their feature, pills, expand/collapse, shared Second Wind boxes through
  Finish Short Rest, "From Background", rest-button icons).
- `e2e/combatActions.spec.ts` — D187 a–e (Actions in Combat line: open/close/
  switch, Reaction and Other contents, Reaction filter, Two-Weapon Fighting with
  Dagger + Shortsword held vs. one in the backpack, Help's `{@note}` italic);
  D188 a–d (Dagger ×2: both into hand + TWF, put away back onto the stack,
  shield/Greatsword displacement, reload).
- `e2e/spellsTab.spec.ts` — R7a a–g (Cleric 3 / Warlock 5 written into
  localStorage before load: slot boxes, CAST, pact section + badge, Finish Short
  Rest, concentration via CAST, pills/search, AT WILL + cantrip dice, SAVE DC
  drawer; Magic Initiate "1/LR" through the wizard).
- `e2e/rhw.spec.ts` — D194 a–f (subclass pickers: Shadow Sorcery not Shadow
  Magic, one Grave/Phantom, no Bladesinging, Reanimator; Shadow Sorcerer 3
  always-prepared spells; Shadow Sorcerer 6 Summon Beast USE −3 Sorcery Points;
  Echoing Soul selectable at level 4 with "Dark Gift" and "Ravenloft campaign").
- `e2e/scc.spec.ts` — D199 a–d (Wizard spell step offers and picks Silvery
  Barbs; seeded Bard sheet resolves it with CAST and text; Lorehold Primer added
  from Inventory with "Requires attunement by a spellcaster"; no Owlin species,
  no SCC background, no Strixhaven feat at level 4).
- `e2e/frhof.spec.ts` — D201 a–d (Wizard 3 offers Bladesinger not Bladesinging;
  Wizard spell step picks Wardaway; level 19 Fighter sees an FRHoF Epic Boon and
  no FRHoF O / faction / Cold Caster feat in any feat group; no FRHoF background
  or language).
- `e2e/manageSpells.spec.ts` — R9a a–k (seeded Cleric 3 / Life Domain / Magic
  Initiate Cleric, Warlock 3, Sorcerer 1, Fighter 1: drawer layout and counters,
  Prepare/Unprepare live + after reload, full counters disable, level pills +
  search, always-prepared and feat notes, shared slot boxes, pact section, no
  button for a Fighter, ▸ text).
- `e2e/customItemBonuses.spec.ts` — R14a1 a–f (seeded Fighter 3 at schema 53:
  six bonuses via Add Custom Item reach Initiative/Stealth/passive
  Perception/Longsword/max HP + breakdowns; attunement gate; single save +
  all saves; Edit removes a row; target exclusion + per-level checkbox; old
  `bonusArmourClass` migrates to an Armor Class row).
- `e2e/customItemModes.spec.ts` — R14a2 a–d (Human Fighter 3 / Fighter 4:
  fly/swim via Add Custom Item in the Speed drawer; truesight + blindsight rows
  "from item"; attunement gate for speeds and senses; Level up to 5 with a
  per-level Max HP item leaves current HP = new maximum).
- `e2e/customItemProficiencies.spec.ts` — R14b a–h (Human Fighter 3 / Wizard 3 /
  Fighter 4: language, tool, INT save and Stealth expertise from Add Custom Item
  on the card, saves and skills; martial category on a Wizard's Longsword;
  vulnerability, condition immunity and save-advantage notes; attunement gate
  for all of them; form exclusion and Skill-only level select; level-up Hit
  points step maximum with an item bonus).
- `e2e/customItemFeats.spec.ts` — R14c1 a–g (Human Fighter 3 / Fighter 4: item Tough
  max HP + locked "From item" row; item Skilled choices in Manage Feats and removal;
  attunement gate; Edit Character does not offer the item feat; Witch Sight
  truesight + "From items" group; form exclusion; Conditions drawer order under cs-CZ).
- `e2e/familiarItemBonuses.spec.ts` — R14d a–g (Wizard 3 with Find Familiar and an
  Owl, Druid 2 for g: AC / max HP / speed in the Extras row and stat block + "Bonuses
  from items"; attack and damage in the action text; six saves; attunement gate;
  max HP per level; clamp after removing the item; Wild Shape row and Manage Extras
  unchanged).
- `e2e/itemAbilityScores.spec.ts` — R14e1 a–i (Human Fighter 3: Belt of Hill Giant
  Strength attuned / not attuned; Gauntlets at Str 20; Amulet of Health max HP;
  two belts; Belt of Dwarvenkind cap; potion + manual; Book of Vile Darkness line;
  level-up ASI from base Strength).
- `e2e/speciesFeat.spec.ts` — S1 a–i (Human species feat on the Background step:
  Next gate, Alert line in Initiative + "From Species" rows; Farmer/Tough disabled,
  Charlatan/Skilled allowed; background clash blocks Next; Human → Dwarf drops it;
  Edit Character keeps Skilled picks and switches to Tough (+2 max HP); older Human
  line + gate; level-up/edit: a level-4 feat is disabled in the species dropdown; Manage Feats Skilled picks;
  no Dark Gift in the dropdown).
- `e2e/speciesCantrip.spec.ts` — S2 a–h (High Elf Fighter: Species gate, Wizard
  list only, Fire Bolt on Spells/Actions with the species ability; Khoravar merged
  list with class labels; Kobold; Draconic Sorcery Sorcerer list; seeded Wizard High
  Elf: class cantrip disabled in the species dropdown, species cantrip disabled on
  the Spells step; High Elf → Wood Elf drops it; Edit keeps and changes it; schema-55
  High Elf note + gate; v55 import and malformed import refused).
- `e2e/wizardF5.spec.ts` — F-5 a–f plus finding-10 checks (Sage Human: species MI
  Wizard list disabled; seeded Rogue stale Expertise blocks Next; level 2 Alert →
  Tough after Hit points saves full HP; manual Alert disabled in species dropdown;
  Criminal Alert initiative +PB; malformed stored speciesCantrip loads; Manage Spells
  and background MI disable the species cantrip; Manage Feats MI list + known spells).
- `e2e/expertiseE1.spec.ts` — E-1 a–c (Human Rogue with species Skilled: Arcana offered
  in Expertise and shown as expertise on the sheet; swapping the species feat to Lucky
  leaves Arcana "(not proficient)" and blocks Next; Khoravar extra skill offered).
- `e2e/sheetCalculations.spec.ts` — F-7a a–f (Archery Longbow +7 with its row; Defense
  Chain Mail AC 17; Monk 6 Speed 45, with a Shield 30; Paladin 6 Aura of Protection on
  saves; three Magic Initiates: Guiding Bolt WIS in Actions and Spells, Thunderwave two
  USE rows; Tiefling Wizard Hellish Rebuke CAST DC = Actions DC; Draconic Resilience +3).
- `e2e/storageRepair.spec.ts` — F-8 (schema-59 seed with a bare-string concentration and an
  id-less manual Tough loads next to a valid character; Tough removed in Manage Feats stays
  removed after a reload).
- `e2e/multiclassProficiencies.spec.ts` — M2 a–b (Warlock 6 / Sorcerer 3, Warlock first: WIS/CHA saves only, no
  Sorcerer in the Saving throws drawer; Wizard 1 / Fighter 1: medium armor, shields, martial weapons "Fighter
  (multiclass)", no heavy armor, Longsword to hit +4).
- `e2e/multiclassHitPoints.spec.ts` — M4 a–c (Warlock 6 / Sorcerer 3 with levelOrder: max HP 54, drawer rows
  "Warlock d8 maximum" / "Sorcerer d6 average", Long Rest enabled; without levelOrder: max "—", reason in the drawer,
  Long Rest disabled; Fighter level up 1 → 2: Level 2 row, no Level 1 row).
- `e2e/multiclassSpells.spec.ts` — M5a a–e (Wizard 3 / Cleric 3: Wizard pick DC 13, Cleric pick DC 12, "player pick
  (<Class>)"; Hold Person chosen by both = two rows on Spells and Actions; Warlock 6 / Sorcerer 3: Sorcerer Fireball
  unavailable, Warlock Counterspell not; "Sorcerer cantrips: 5 known, 4 allowed."; Sorcerer Manage Spells up to 2nd).
- `e2e/multiclassCast.spec.ts` — M5b a–d2 (Warlock 3 / Sorcerer 3: 2nd-level Slot / Pact spend their own pool, Pact
  disabled when spent, Burning Hands "1st" upcast row with both buttons; single-class Warlock / Sorcerer one CAST).

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
Deferred: skills, Cavalier/Samurai, Scout expertise, species tools (B6c).

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

B6c-fix: reported "Scout Nature/Survival unmarked on the sheet" not reproduced
in code — a sheet render of a Rogue 3 Scout / Drunken Master / Warrior of Mercy
saved by the wizard's `saveCharacter` through a real `CharacterStore` shows the
grants (regression test in `CharacterSheet.test.tsx`). Skills card: skill name
14px, proficiency marks (skills and saves) 14px.

B6d (D178): weapon proficiency from subclass/class-option grants has one
source, `FEATURE_GRANTS` in `src/calculation/featureGrants.ts` (moved out of
`proficiencies.ts`), read by the Proficiencies card and by
`weaponProficiencyGrantsFor` (attacks). Grants gained `ranged` and `named`
(Scimitar). Kensei stays a pending row, grants attacks nothing. Proficiencies
card text 14px.

R5a (D181): Actions tab restyled. Filter row: pills All / Attack (local
`useState`, never stored) and "Attacks per Action: N" (label opens the breakdown
drawer); the `Actions` heading is gone. Attack table is a CSS grid over table
markup (rows are subgrids): ATTACK (name button → drawer with to-hit/damage or
spell attack/DC breakdowns, subtitle Melee/Ranged Weapon · Unarmed · spell level
+ Concentration/Ritual, Finesse select), RANGE, HIT / DC (to-hit is the
`RollButton`; spell attacks now roll too; save = "DC 14 DEX" box, not a button),
DAMAGE (dice are the `DamageRollButton`, which gained `children`; flat damage and
unparsed spell text stay text), NOTES. Features (Second Wind, Rage…) moved out
of the table into a temporary "Other" list under it; Attack hides it. Mastery
note only for weapon kinds in `Character.masteries`; `WeaponAttack.kind` added.
E2E `e2e/actions.spec.ts`. R5b: investigation only
(`scripts/investigate-r5b-action-types.js`).

R5c (D182): `classifyActionType` (R-phrase) in
`src/actions/actionTableFeatureData.ts`. `featureActionRows` rows carry
`actionType` and `entries`, and also admit D86-rejected features R-phrase puts
in Action/Bonus Action/Reaction. `spellGroupRows` (`spellActionRowData.ts`):
spells without attack/save whose `time[0].unit` is bonus/reaction. Actions tab:
pills All · Attack · Action · Bonus Action · Reaction · Other; groups Action /
Bonus Action / Reaction / Other under the table (the temporary Other list is
gone), empty groups not rendered, "Nothing here for this character." when the
filtered group is empty. Group rows (`ActionGroupRow`) collapse/expand by local
state; feature text via `ResolvedEntries`, spell text via `SpellDetailBody`
(extracted from `SpellList.tsx`). `UseBoxes`: ≤10 clickable boxes, >10 a
spent/max counter, "/ Short Rest" or "/ Long Rest" from 9b5's `shortRest`.
`UsesTracker` now serves spell slots only. E2E `e2e/actionGroups.spec.ts`.
Next: species traits in Actions, Actions in Combat (needs `actions.json`).

D183: header SHORT REST opens the shared drawer "Short Rest" (`DrawerContent`
kind `shortRest` in `CharacterSheet.tsx`) holding the Hit Dice section (the
unchanged `hitDiceLine`) and a full-width "Finish Short Rest" button
(`.btn--finish-rest`) that runs `takeShortRest` and closes the drawer. Closing
with × / Esc keeps rolled dice and HP and does not rest. `HitPointsPanel` lost
its `hitDice` prop and section. Read-only sheets have no rest button, so no hit
dice. E2E `e2e/shortRest.spec.ts`. No schema change (still 48).

R6 (D184): Features & Traits tab rebuilt as `FeaturesSection` in
`CharacterSheet.tsx` over `featuresTabGroups` (`src/sheet/featuresTabData.ts`,
pure). Pills All · Class Features · Species Traits · Feats (hide groups only).
Groups: one "<Class> Features" per entry of `character.classes` (class +
subclass features by level, then name; D21 parents such as Divine Order get a
row built from the pick), "Species Traits" (new `speciesTraitsFrom` /
`loadSpeciesTraits` in `speciesTraitNames.ts`, with a load-error line), "Feats"
(source "From Background" / "From Species" / "From <Class> <level>", none for a
multiclass ASI feat). Rows are `ActionGroupRow` (new `below` slot) with
`UseBoxes` on the same `play.resourceUses`. Chosen options sit in a list under
the feature whose text carries their `{@filter}` (`grantsFeatureType`; DATA.md),
each expandable; unlinked ones (AS, RN, FS:B) are own rows at the end of the
first class group. Feat sub-choices and the pending line sit under the feat.
Old sections Feats / Class and subclass features / Class feature choices /
Class options / Subclass options removed; Wild Shape forms and Familiar follow
the class groups (All, Class Features). `chosenOptionalFeatureOptions` tags each
option with `featureType` ("FS" for the class fighting style);
`ChosenClassFeatureChoice` gained `className` and `featureEntries`. Header
SHORT REST / LONG REST: `FireIcon` / `MoonIcon` (exported from `SheetHeader.tsx`,
fire reused by Finish Short Rest), `.sheet__rest button` 12px/700 uppercase,
padding 9px 16px, radius 8. E2E `e2e/featuresTab.spec.ts`; `e2e/wizard.ts`
gained `subclass`, `onClassStep`, `onLanguagesStep`. No schema change (still 48).
Next: "Manage Feats" button (later slice).

D185: species traits in the Actions tab. `featureActionRows` takes the loaded
`speciesTraits` and `character.species.name` (row key `species|<name>`, grey
source = species name, appended after granted features, feats and options); same
D86 / D182 tests, same row and filters as class features. No level gating (the
species data carries no level; Features & Traits has none either) and no use
boxes: species traits are not in `computeCharacterResources`' feature input, so
no maximum is known. E2E `e2e/speciesActions.spec.ts`. No schema change (still
48). Next: species traits into the resource model (21 traits are single-use).

D186: species traits follow-up. `classifyActionType` has an attack-replacement
frame ("replace one of your attacks" after the Attack action → Action; Breath
Weapon, War Magic, Commander's Strike). `speciesTraitMinLevel` /
`speciesTraitsAtLevel` (`speciesTraitNames.ts`) gate a trait whose first entry
opens with a character level; the sheet filters the loaded traits by total level
once, so Actions, Features & Traits and the HP bonus names all see the same list.
`speciesTraitUses` (`resources.ts`) reads two phrasings (once per rest → 1;
Proficiency Bonus uses → PB); `computeCharacterResources` takes species traits
as a 4th argument, a same-named class resource wins. A species trait joins
Actions only with an R-phrase group or a count; Species Traits rows in Features
& Traits now carry `resourceName`, so their boxes share the Actions count.
`levelRemoval.ts` still passes no species traits (a PB count is not clamped on
level loss). E2E `e2e/speciesActions.spec.ts` (5 scenarios). No schema change
(still 48).

D187: Actions in Combat. `extractActions()` in `extract-data.js` writes
`data/actions.json` (18 XPHB records, own `ACTIONS_SOURCE`). `src/actions/combatActions.ts`:
`loadCombatActions` (best-effort load in the sheet; a failed load just drops the
lines), `groupOfTime` (`time[].unit` → group, string time → Other),
`holdsTwoLightWeapons` (≥ 2 held rows with a Light weapon, from
`buildHeldWeapons`), `visibleCombatActions` (drops Two-Weapon Fighting
otherwise). `ActionsSection` ends each group with `CombatActionsLine`: names
alphabetical, one open at a time, text via `ResolvedEntries`; a group with only
combat actions renders (Reaction, Other). Bonus Action line exists only with
TWF. Markup: `{@note}` → italic (tags.ts, inventory regenerated, 47 tags).
E2E `e2e/combatActions.spec.ts` (a–e). No schema change (still 48).

D188: two weapons from one stack. `splitOneOff` and `returnToStack`
(`inventoryData.ts`): Equip on a held-slot row with quantity > 1 splits one item
into its own held row right after the stack; Put down and every hands
displacement merge the put-down row into a row with the same `inventoryRowKey`.
`takeInHand` takes the rows to work on. Hands rule and `holdsTwoLightWeapons`
unchanged. E2E D188 a–d in `e2e/combatActions.spec.ts`. No schema change
(still 48).

R7a (D189): Spells tab rebuilt. Header: per spellcasting source (class, feat,
species) MODIFIER · SPELL ATTACK · SAVE DC boxes (label "Cleric (WIS)" only with
more than one source); the two values open the Drawer (`DrawerContent` kinds
`spellcasting`, `spellSlots`), "Spell Slots" opens the slot breakdowns (Pact
Magic under its own heading). `SpellsSection` / `SpellTabRow` in
`CharacterSheet.tsx` over `src/sheet/spellsTabData.ts` (pure: sections by slot
level incl. single-pool pact placement with a level badge, filters, effect,
notes, short usage labels). Search + pills (local state). Sections carry
`UseBoxes` on `play.spentSpellSlots` (one per level with slots, from
`spellSlotMaxima`; pact boxes tagged PACT, "/ Short Rest" from the Pact Magic
text). Rows: CAST (spends the section's pool, starts concentration; disabled at
0; absent read-only) / AT WILL / short usage label; name toggles
`SpellDetailBody` + `provenanceLabel` + Concentrate. `SpellList`/`SpellRow` and
`UsesTracker` removed; `SpellDetail.conditionInflict` added. `validate-data`
checks `actions.json` (18, XPHB). E2E `e2e/spellsTab.spec.ts` (a–g; casters
seeded into storage). No schema change (still 48). Next: R7b (USE counter for
free-use grants), R8 (leveled damage dice).

R7b-1 (D190): free-cast data and counters, no new UI. `SheetSpellEntry.grants`
ties each usage to its source; subclass dedupe keeps one grant per usage
(Archfey Misty Step: slot + CHA/LR). `src/spells/alsoCastableWithSlot.ts` (hand
table, coverage test over data/). `src/calculation/freeCastResources.ts`:
`freeCastResources` (per spell per source, key
`spell:<origin>:<source>:<spell>|<SOURCE>`, shared owners Gnomish Lineage (Forest
Gnome) / Serpentine Spellcasting / Chemical Mastery / Steps of the Fey /
Restorative Reagents), `withFreeCastResources` (sheet appends them to
`characterResources`, so Steps of the Fey and Restorative Reagents now show
ability-modifier use boxes), `remainingUses`, `canSpendResource`.
`spellsTabActionSections` + `spellsTabRowCaster` in `spellsTabData.ts` build the
CAST / USE / label rows — additive, the tab still renders `spellsTabSections`
until R7b-2 (USE button, row split, e2e). `castsWithSlot` now reads grants. No
schema change (still 48).

R7b-2 (D191): the Spells tab now renders `spellsTabActionSections`
(`spellsTabSections`, `castsWithSlot` removed). A spell can have a CAST row and
one USE row per counter; USE (same look as CAST) spends the row's counter or the
Focus Point pool through `spendResource` (now takes an amount), starts
concentration, is disabled by `canSpendResource`, absent read-only. A USE row's
Notes open with `UseBoxes` on the shared record (or "Focus Point 2 / 3" for a
`resource` row). Hit/DC per row via `spellsTabRowCaster` + `rowHitDc`. E2E
`spellsTab.spec.ts` R7b-2 a–f (Magic Initiate test rewritten as b; concentration
g inside d). R7 (Spells) is done except upcast (R8) and Manage Spells (R9). No
schema change (still 48).

A-S1 (D192): class-record `additionalSpells` are read
(`extractClassAlwaysPreparedSpells` / `loadClassAlwaysPreparedSpells`, shared
`collectFixedGrants` with the subclass reader). Grant origin `class`, label
"always prepared (<Class>)", key = level in that class. The sheet effect loads
them for every class (`classSpellInfo`); `combineSpellEntries` takes a last
`classAlwaysPrepared` argument; `casterFor` casts them with that class's
ability. The wizard's spell step lists them and includes them in the D71
already-has set. `usage` is null (free casts: next task); Bard `expanded`
still unread. E2E `classGrants.spec.ts` a–f. No schema change (still 48).

A-S2 (D193): free casts of those grants from the hand table `CLASS_FREE_CASTS`
(`subclassPreparedSpells.ts`): Hunter's Mark spends Favored Enemy, Find Familiar
Wild Shape, Divine Smite / Find Steed / Contact Other Plane once per Long Rest on
the feature counter (Paladin's Smite, Faithful Steed, Contact Patron via
`SHARED_OWNERS`). All stay slot-castable (`ALSO_CASTABLE_WITH_SLOT` class keys).
Class spells now have a CAST and a USE row (classGrants.spec.ts looks at CAST
rows). E2E `classFreeCasts.spec.ts` a–d. No schema change (still 48).

D194: RHW is loaded whole (7 subclasses incl. Shadow Sorcery and Reanimator, 11
feats, 3 species, 4 backgrounds, 2 items; Dhampir out). Subclass `reprintedAs`
is matched on the 4-part uid, so 19 superseded XGE/TCE subclasses left
classes.json; Bladesinging|TCE stays hidden. Backgrounds take the named feat of
an "or any Dark Gift" pair; Mist Wanderer and Spirit Medium (DG only) are not
offered (both superseded by D205). `campaign` prerequisites count as met and show as a note in the feat
picker, DG feats carry a "Dark Gift" label, `exclusiveFeatCategory` is enforced.
D190 table: College of Spirits, Hexblood yes; Shadow Sorcery no. Not modelled:
DG feat spells (modelled since D204), RHW proficiency grants (Eyes of the Dark senses since D195,
Strength of the Grave counter since D197). E2E `rhw.spec.ts` a–f. No schema change (still 48).

D195: class and subclass senses reach the Senses card. `CLASS_SENSE_GRANTS`
(`grantedSenses.ts`, origin `classFeature`, "from class feature (Name)"): Feral
Senses (Ranger 18, Blindsight 30), Eyes of Night (Twilight Domain, Darkvision
300), Eyes of the Dark (Shadow Sorcery, Darkvision 120 + Blindsight 10), and the
additive Umbral Sight (Gloom Stalker) and Shadow Arts (Warrior of Shadow):
best other darkvision + 60, else 60 (`additive` in `combineDarkvision`).
Subclass gate `hasSubclassBySource` (featureGrants.ts). Not modelled: Wild
Heart Owl, Mortal Bulwark, The Third Eye, Manifest Mind. E2E
`classSenses.spec.ts` a–f. No schema change (still 48).

D196: a named pool (the 8 `consumes` names) now also exists when the
character's own class/subclass table counts it above 0 at their level
(`tableGrantedPools`, resources.ts), not only when a held feature `consumes` it.
A Shadow Sorcerer 6 with no Metamagic gets Sorcery Point 6 and a working
Summon Beast USE (−3, disabled below 3). No override table: the USE path
already reads the cost from the `resource` spell wrapper. E2E `rhw.spec.ts`
"D196". No schema change (still 48).

D197: the recharge regexes in resources.ts also read "can't use this benefit
again". Strength of the Grave (inside Power of Shadow, Shadow Sorcery 3) is a
1/Long Rest box on the "Power of Shadow" row in Features & Traits; Ritual
Caster (Quick Ritual) gets the same. Named sub-entries are still not split into
their own rows. E2E `rhw.spec.ts` "D197". No schema change (still 48).

D198: five conditional damage responses join `FEATURE_DAMAGE_RESPONSES`
(Superior Defense, Umbral Form, Full of Stars, Aura of Warding, Rage of the
Gods) and one prose-only feat joins the new `FEAT_DAMAGE_RESPONSES` (Boon of the
Night Spirit, read by `buildFeatGrants`). All are shown under "Only in certain
conditions" with a condition text, never counted (D76). Rage of the Wilds stays
out (unstored Bear/Eagle/Wolf pick). E2E `conditionalResponses.spec.ts`. No
schema change (still 48).

D199: SCC (Strixhaven, 2014 rules) joins ALLOWED_SOURCES. In: 5 spells
(Borrowed Knowledge, Kinetic Jaunt, Silvery Barbs, Vortex Warp, Wither and
Bloom — class lists via gendata) and 18 items (5 Primers, 5 Trinkets, Murgaxor's
Orb and Elixir, Masque Charm, Strixhaven Pennant, Cuddly Strixhaven Mascot,
Bottle of Boundless Coffee, Alchemist's Doom, Catapult Munition). Strixhaven
Initiate and Strixhaven Mascot are in feats.json but hidden (HIDDEN_FEAT_KEYS)
until their pickers exist. SCC backgrounds are excluded at extraction
(`EXCLUDED_BACKGROUND_SOURCES`); Owlin drops out through the species `edition`
filter. validate-data asserts 5/2/18/0/0 and the two feat names. E2E
`scc.spec.ts` a–d. No schema change (still 48).

D200: Strixhaven Initiate is now selectable at any ASI/feat level (out of
HIDDEN_FEAT_KEYS). Picker: college, then cantrip pair, then spellcasting
ability, then the level-1 spell; stored as `blockName` + `chosenAbility` +
`filterChoiceSpells`, the chosen block's cantrips granted through
`extractFixedFeatSpells`, the level-1 spell free 1/Long Rest and also castable
with slots. Unmade choices are pending (D57). Strixhaven Mascot and Boon of
Siberys stay hidden. E2E `strixhavenInitiate.spec.ts` a, b, d; `scc.spec.ts` d
doubles as c. No schema change (still 48).

D201: FRHoF (Heroes of Faerûn, 2024) joins ALLOWED_SOURCES in reduced scope: 8
subclasses (56 features), 19 spells, 27 items, 18 feats (13 Epic Boons + 5
General; Cold Caster hidden). Backgrounds, languages, all category-O feats and
the General feats that need one are excluded at extraction. Bladesinging|TCE and
Blade of Disaster|TCE drop as reprinted. Markup now renders `{@…}` in entry
names (Terrify's "{@dice 1d6}" leaked); alsoCastableWithSlot rules on College of
the Moon (yes) and Banneret (no); resources.test expects +12 single-use pools.
validate-data asserts 8/19/0/0/18/27. E2E `frhof.spec.ts` a–d. No schema change
(still 48).

D202: proficiency grants of Aberrant Anatomy, Boon of Terror, Echoing Soul,
Symbiotic Being and species Lupin/Reborn checked — all but two gaps already
worked. Fixed: a FIXED feat expertise (`expertise:[{perception:true}]`) now gives
expertise on the sheet and is never offered again by a feat or class expertise
picker; Echoing Soul asks for 2 skills (text over data). E2E
`proficiencyGrants.spec.ts` a–f (Fighter stands in for the Wizard; the e2e
helper gained `laterFeat` for ASI slots above 4). No schema change (still 48).

D203: prose proficiency grants of the RHW/FRHoF subclasses modelled. Fixed:
Bladesinger weapons (new `melee` + `noneOfProperties` on the category grant),
College of Spirits Playing Cards, Reanimator Alchemist's Supplies (EFA
replacement slot). Picks: Bladesinger / Banneret / Noble Genies / Moon skill,
Knowledge Domain 2 skills with Expertise (`choice.count`, `choice.expertise`)
+ artisan's tool, Banneret language. Unfettered Mind (Knowledge 6): Int saves,
or a breakdown note when already held. The class Expertise step now excludes
fixed expertise (D202 gap, all wizard modes). Schema 49 (tag-only migration).
E2E `subclassProseGrants.spec.ts` a–i (seeded characters for non-Fighters).

D204: feat spells of the 5 Dark Gifts (Gathered Whispers, Living Shadow, Second
Skin, Touch of Death, Watchers), Boon of Revelry, Telepathic and Telekinetic
reach the sheet. The 5 Dark Gifts and 12 marks ask for a required "Spellcasting
ability" (Int/Wis/Cha → `chosenAbility`) in `FeatSubChoicePicker`, derived by
`featSpellcastingAbilityOptions` (featAsiData.ts), which replaces the
`isMarkFeat` name guard. Revelry/Telepathic/Telekinetic cast with the feat's +1.
Augury, Alter Self, Beast Sense, Speak with Animals, Detect Thoughts and Otto's
Irresistible Dance: 1 free cast per Long Rest + slot-castable. A feat with no
ability stored no longer blanks every feat's attack/DC: its rows show "spellcasting
ability not chosen yet", other feats keep numbers. E2E `featSpellGrants.spec.ts`
a–f. No schema change (still 49).

D205: every background's origin feat can be swapped for one of the 9 Dark Gift
feats; Mist Wanderer and Spirit Medium are offered and require one
(`BackgroundEntry.originFeat` null). The Background step shows
`OriginFeatSwapPicker` (`src/featAsi/`): the named feat vs "A Dark Gift feat
instead", or only the DG list for a DG-only background (Next waits for a pick).
Stored as `CharacterBackground.originFeatOverride` (schema 50, 49→50 tag only);
`featInstances` reads it in place of the derived feat, so every reader (sheet,
spells, proficiencies, ASI "already granted") follows. Changing the background
or the override clears the background feat's sub-choices. Sub-choices of the
effective feat still never block (D179). E2E `darkGiftOriginFeat.spec.ts` a–f.

S1 (D271–D277): a species whose `feats` is one `anyFromCategory` O count 1
(Human|XPHB, Versatile) gets an origin feat chosen on the Background step —
`SpeciesOriginFeatPicker` + `speciesOriginFeat.ts` (`src/featAsi/`): dropdown of
category-O feats (no Dark Gift), feat text, FeatSubChoicePicker (prefix `species`).
A non-repeatable feat equal to the background's feat is disabled / flagged and
blocks Next (`speciesOriginFeatComplete` → `WizardStepConditions.speciesOriginFeatComplete`).
Stored as `grantedFeats` origin 'species' (schema still 55); dropped when the species
changes. `featInstances` reads it (key `species`, after the background feat), so all
feat readers follow; `grantedFeatsOf` counts it as taken ("Species") for ASI cards and
Manage Feats → Add Feats. Manage Feats edits its sub-choices (`setFeatChoiceDetails`
key `species`), not the feat. A character with the grant but no entry shows "Origin
feat not chosen yet — choose it in Edit Character." under the trait whose text names
an Origin feat (`SpeciesTrait.grantsOriginFeat`). validate-data's `stripEtoolsTags`
uses the tags.ts display segment. E2E `speciesFeat.spec.ts` a–i; `e2e/wizard.ts`
picks Lucky for a Human unless `speciesFeat` says otherwise.

S2 (D278–D282): schema 56, `Character.speciesCantrip { name, source }` (migration
55→56 tags only; validate refuses a malformed value on import). High Elf, Khoravar
and Kobold; Draconic Sorcery pick their class-list cantrip on the Species step:
`SpeciesCantripPicker` + `speciesCantripData.ts` (`src/spells/`), one dropdown under
the spellcasting-ability picker; Khoravar's Cleric/Druid/Wizard lists merged, each
option labelled with its classes. `isSpeciesCantripComplete` (wizardState.ts) →
`speciesCantripComplete` blocks Species Next; a species/lineage change drops the
pick; level-up never asks. `collectKnownSpells` gets `speciesCantrip` ("your
species cantrip"), so the Spells step, feat pickers and sheet Manage Spells disable
it, and the species dropdown disables cantrips known elsewhere. raceSpells.ts
turns the pick into an ordinary species row (Spells + Actions); with no pick the
note reads "Cantrip not chosen yet — choose it in Edit Character." E2E
`speciesCantrip.spec.ts` a–h; `e2e/wizard.ts` gained `speciesCantrip`.

F-5 (D283–D291, S1/S2 review fixes): Magic Initiate
class lists used by another MI instance are disabled ("(already chosen: Background)",
`FeatChoiceHeld.magicInitiateLists`, wizard + Manage Feats). Expertise step needs
every stored pick inside its pool (`expertiseSkillsAvailable`); ExpertisePicker lists a
stale pick as "(not proficient)" with an alert line and lets it be unchecked. Species
feat / cantrip data load only for a species with the grant, keyed by species. Species
feat dropdown's taken set = grantedFeatsOf + ASI feats (item feat warns only); failed
background feat-link load shows an error and keeps Background Next shut. Max HP effect
re-runs on grantedFeats / Dark Gift override. Manage Feats gets `alreadyKnown`.
SpeciesCantripPicker hint whenever the value is off the list. raceSpells' not-chosen
note only for an extractable slot. Malformed stored `speciesCantrip` dropped on read
(`withoutMalformedDroppableFields`). Alert|XPHB adds Proficiency Bonus to initiative
("feat (Alert): +N", any origin); `PROSE_FEAT_EFFECT_TARGETS` / `proseFeatEffectNotes`
removed. E2E `wizardF5.spec.ts`.

E-1 (D292–D294): the Expertise pool (`expertisePool`, `expertiseRequiredCount`,
`expertiseSkillsAvailable`, ExpertisePicker's `proficientSkills`) is built from the new
`expertiseSourceSkills` in CharacterWizard.tsx — class/background/species skills plus
every feat instance's skills (stored picks and fixed grants such as Boon of Skill via
`featProficiencyChoiceShape`), subclass skill picks and fixed grants, and the
Khoravar extra skill. `proficientSkills` is unchanged (it feeds `heldForFeat`). Step
order unchanged. E2E `expertiseE1.spec.ts` a–c.

W-9 (D295–D300) done. No schema bump. The Review step is `src/creation/review/ReviewStep.tsx`: portrait header
(`.review__header`), then cards (Ability scores via `AbilityScoreTable`, Proficiencies, Spells, Feats, Hit points,
Equipment via `StartingTable`'s new `heading` prop); in a level up a "Level N — What's new" card first (feature rows
with `ResolvedEntries`, HP gain, spells added, ASI / feat). Card headings jump with `goTo` when the step is in the
walk. `expertiseSkillsAvailable` false → alert line + "Go to Expertise". CharacterWizard passes the derived values
(`reviewProficiencies()`, `draftFeatInstances`, `maxHp`, `hitDie`); the old text lines and "Features gained" list are
gone. Max-HP load now also keys on `abilityScores` / `abilityBonus` (D300). E2E `wizardW9.spec.ts` a–e;
`e2e/wizard.ts` has `stopAtReview`.

F-6 (D303–D307, review fixes of E-1 and W-9): the pool arithmetic moved to `src/creation/expertisePool.ts`
(`featSkillSources`, `expertisePoolOf`; unit-tested). Item-granted feats no longer feed the pool; the Expertise step and
pool skip skills with a feat's chosen expertise; stale picks are measured against `expertiseSourceSkills` and carry a
reason (`proficiency` / `taken` / `restricted`). Review: "Go to Expertise" only if the walk has the step, else "Fix it
in Edit Character."; "Manual maximum: N" with `maxHpOverride`; "Spells added" includes class-option spells; species
cantrip suffix uses `speciesLabel`; Equipment card is a region (`StartingTable` `ariaLabel`); empty-name portrait. In
CharacterWizard `maxHp` is keyed (`maxHpKey`, `character`) and read as unresolved on a mismatch. Unit
`ReviewStep.test.tsx`, `expertisePool.test.ts`; e2e `wizardW9.spec.ts` (exact Fighter 1 maximum, creation `currentHp`,
stale Expertise in a level up).

U-1 (D308–D311) done. No schema bump. Home screen is a card grid: `src/characters/CharacterList.tsx` (heading, hidden
file input behind "Import character", New character card first, `ConfirmDialog` for Delete, focus to New character
afterwards), `CharacterCard.tsx` (one open button + sibling ⋯ disclosure with Rename/Export/Delete, in-card rename),
`characterSummary.ts` ("Elf · Fighter 3 / Wizard 2", species is `species.name` as in the sheet header). One header in
all views, `src/app/AppHeader.tsx` (wordmark → list, Rolls slot, Flame, theme); the Characters and Markup demo buttons
are gone, `#/markup-demo` still works by address. `CharacterManager` keeps the handlers only. E2E
`characterList.spec.ts` a–j; unit `characterSummary.test.ts`.

U-2 (D312) done. No schema bump. First-open intro "FAMILLIAR" ported from `docs/mockups/intro-preview.html`:
`src/app/IntroOverlay.tsx` (portal to body, mounted from App; sessionStorage `familliar:intro-played` set at the first
decision; plays only when the tab's first route parses to the list, motion is allowed and `matchMedia` exists; click or
key skips; `#root` inert and slid in via `html[data-intro]`), `introSparks.ts` (particles, timeline `T`, spawn/heat),
`intro.css`. Theme tokens `--hot --glow --glow-soft --spark --spark-hot --blend` in theme.css. Playwright runs with
`reducedMotion: 'reduce'` globally; `flame.spec.ts` opts back in and pre-marks the intro played. E2E `intro.spec.ts` a–g.

S3 (D313) done. No schema bump. Breath Weapon's Actions group row shows "15-foot cone / 30-foot line", "DC n DEX" and a
`SpellDamageLine` ("1d10" button + type, roll "Breath Weapon damage"), placed on the row line before the use boxes
(`ActionGroupRow` `cells` slot). `src/calculation/breathWeapon.ts`: `breathWeaponDiceCount` hand table, `computeBreathWeapon`
(DC from item-aware CON + PB; type from the species' resistance grant in `damageResponseData.speciesGrants`; bare
Dragonborn → unresolved). Unit `breathWeapon.test.ts`, E2E `breathWeapon.spec.ts` a–c.

S4 (D314) done. No schema bump. `src/sheet/speciesSaveAdvantages.ts`: hand table of 14 traits over 27 species records
(XPHB, MPMM, EFA, RHW) and `speciesSaveAdvantageLines(species)`; its lines follow the item lines in
`.sheet__save-advantages` under the Saving Throws card and at the bottom of the Saving throws drawer, above the custom
item hint. Tortle's Shell Defense has a conditional "while in your shell" line. Unit `speciesSaveAdvantages.test.ts`
(data guard: every record carries its trait), E2E `speciesSaveAdvantages.spec.ts` a–e.

F-7a (D315) done. No schema bump. Calculation fixes from sheet reviews A/A2: Draconic Resilience = Sorcerer level;
Fighting Style (`calculation/fightingStyles.ts`): Archery +2 ranged to-hit and Defense +1 AC in armour as rows,
Dueling / Thrown Weapon Fighting as "not included" damage notes; Martial Arts die replaces a smaller Monk-weapon die;
speed rows from Unarmored Movement (Monk table column, no armour/shield), Fast Movement, Roving (not heavy armour) and
Speedy (`calculation/featureSpeed.ts`, `unarmoredMovementFrom` in weaponAttackData.ts); save proficiency from
Disciplined Survivor / Slippery Mind and Aura of Protection (+Cha, min 1) in savingThrows.ts; additive darkvision note
shows the increment; flat unarmed damage floors at 0 (`damageText`). One `computeAbilitySpellcasting` behind class,
feat, species and item numbers; one `totalCharacterLevel(classes)` (`calculation/characterLevel.ts`). Feat spells
carry `featInstance`; `FeatSpellcastingEntry.featKey`, `SpellGrant.instanceKey`; free-cast counter key
`spell:feat:<name>#<instance>:<spell>|<src>`, old key read via `withLegacyFreeCastUses`. `casterFor(…, grant)` decides
Actions, CAST and USE (CAST of a species/feat-only spell uses that source). Aberrant Dragonmark's 1st-level pick: 1/SR
free + slot. Unit `sheetReviewFixes.test.ts`, E2E `sheetCalculations.spec.ts`.

F-7b done. No schema bump, no new decision. Play-state/UI fixes from sheet reviews B/B2. Long Rest (SheetHeader): disabled
600 ms after a click (Exhaustion −1 is not idempotent), while max HP is unknown, while `itemRefs`/granted features/species
traits have not settled (`restDataReady` in CharacterSheet) and at 0 HP (title "Needs at least 1 Hit Point"); Finish Short
Rest waits for `restDataReady`; hit die roll disabled at 0 HP (new `title` prop on `DamageRollButton`) and heals
`max(1, total)`. `afterLongRest` returns `concentratingOn: null`, `RestFields.concentratingOn`/`applyRest` clear it.
`saveCustom` runs a held row through `takeInHand` (Two-Handed edit puts the shield down, with the notice).
`RemoveLevelButton` keeps its availability probe but computes the plan on click, never re-entering "checking" on a save.
`Drawer` focuses its × on open and restores the opener's focus on close. `preparedSpellRows` flags a pick that a grant
also covers (`alsoGranted`): Unprepare stays, `pickCounts` skips it. Two Magic Initiates: spellcasting cards titled
"Magic Initiate (Cleric)" etc. FeatureLanguageSlots left as is (B7). Unit tests in CharacterSheet/rest/characterStore/
Drawer/levelRemoval/manageSpellsData tests, E2E `restsAndUi.spec.ts`.

M0 done (D316, multiclass safeguard). No schema bump. Edit Character is blocked for `classes.length > 1`
(`isMulticlass` in `calculation/characterLevel.ts`): disabled sheet button with reason, `#/character/<id>/edit` bounces
to the sheet (`BounceToSheet` in CharacterManager), `saveCharacter` throws. Import rejects a sum of levels > 20 and a
duplicate class (`describeImportedCharacterError`, called only from `parseStoredCharacters(raw, false)`); stored data is
not checked. E2E `multiclassGuard.spec.ts`.

M1a done (D317). Schema 57: `Character.levelOrder?: { className, classSource }[]` (level history; absent = unknown).
Migration 56→57: 0 classes → `[]`, 1 class → repeated `level` times, >1 → absent. `isConsistentLevelOrder` /
`singleClassLevelOrder` in storage/character.ts; `withoutInconsistentLevelOrder` (validate.ts) drops a bad one on list()
(inside `withoutMalformedDroppableFields`) and on import; `buildCharacter` never writes an inconsistent one. Writers:
`saveCharacter` (create/Edit rebuild, level up appends or keeps absent), `levelRemovalPlan` (drops last). Nothing reads
it yet; no visible change. E2E `levelOrder.spec.ts`.

M1b done (D318). Schema 58: `Character.fightingStyles?: CharacterFightingStyle[]` ({ className?, classSource?, name,
source? }, one per class) replaces `fightingStyle`; `CharacterOptionalFeatureChoice.choices` is
`CharacterOptionalFeaturePick[]` (optional `source`). Migration 57→58: style of a 1-class save gets that class, else it
stays unassigned; picks untouched. Matching rule `matchesPick`/`findPicked` (storage/choiceMatch.ts), used by
optionalFeatureData, optionalFeatureSpells, grantedSenses, beastData (`hasPactOfTheChain`), fightingStyles,
ManageFeatsPanel, CharacterSheet. `fightingStyleFor` (character.ts) picks a class's style or the unassigned one.
`describeFightingStylesError` (fatal on list(), as before; `buildCharacter` refuses a bad write). `saveCharacter`
takes a trailing `PickSourceLookup` (optionalFeatures/pickSources.ts, loaded by CharacterWizard) and writes class +
source; a sourceless held pick gets the first same-named row's source. Pickers still hold names. No visible change.
E2E `choiceSources.spec.ts`.

M1c done (D319). Schema 59: `play.concentratingOn?: ConcentrationRef | null` ({ name, source? }), matched by
`matchesConcentration` (choiceMatch.ts, exact name); sheet writes (Concentrate/CAST/USE) store the source, header shows
the name. `CharacterGrantedFeat.id` (required on 'manual', validated unique; none on other origins); instance key
`manual:<id>` via `manualFeatKey` (featInstances.ts). `addManualFeat` uses a random UUID; `removeManualFeat` also drops
its `spell:…#manual:<id>:…` resourceUses. Migration 58→59: string → `{ name }`, manual ids "0".. in order. Custom-item
feat keys (`item:<row>:<n>`) still positional. No visible change. E2E `stableIds.spec.ts`.

F-8 done (D320). M1 review fixes, schema still 59. `withRepairedFields` (validate.ts) runs on read and import for
records already at 59: bad `concentratingOn` dropped, `fightingStyles` one entry per class owner (bad shapes dropped),
manual feat ids re-assigned when missing/duplicate/not `^[^:#|]+$` (position id, else `repaired-<n>[-k]`), non-manual
feat `id` dropped. Narrow setters writing `play`/`grantedFeats` go through `CharacterStore.writeChanged`
(`describeCharacterError` before write). `removeManualFeat` throws on an unknown key and drops the pre-A2-1 counter
with the last instance of that feat. `hasFightingStyle` name fallback only when no same-named row exists. Migration
56→57 skips `levelOrder` above level 20. No visible change. E2E `storageRepair.spec.ts`.

M2 done (D321). No schema change (59). `firstClass` (calculation/characterLevel.ts): `levelOrder[0]`, else
`classes[0]`. Saves: class proficiency from the first class only (`computeSavingThrow`); feature/feat/item/aura saves
unchanged. New `calculation/classProficiencies.ts` `classProficiencyGrants`: first class's starting armor/weapons, every
other class's fixed `multiclassing.proficienciesGained` armor/weapons/`toolProficiencies` (`true` values only), origin
"<Class> (multiclass)". Read by `computeProficiencies` (card + drawer), `weaponProficiencyGrantsFor` (attacks) and
Manage Feats prerequisite ctx (armor/weapon tokens). `classToolGrantsFor` callers (computeProficiencies, sheet
ClassToolSlots) pass the first class. Not done (M7): Bard instrument, multiclass skill, subclass tools of a non-first
class. Wizard/level-up/mastery picker untouched (single class). Unit `classProficiencies.test.ts`,
`savingThrows.test.ts`, `characterLevel.test.ts`; E2E `multiclassProficiencies.spec.ts`.

M3 done (D322). No schema change (59). `characterSpellSlotMaxima(character, classData)` (spellSlots.ts): with 2+
Spellcasting classes (non-zero ordinary row; Pact Magic never counts) the ordinary pool is Wizard XPHB's row for the
summed caster level, `casterLevel` + per-class breakdown set; otherwise `spellSlotMaxima` of the class entries. Read by
the sheet (Spells tab sections/boxes, upcast rows, CAST, Manage Spells summary and boxes, Spell Slots drawer — one
"Multiclass Spellcaster (caster level N)" section when combined) and level removal's spent-slot clamp. Long Rest still
clears all spent slots. Not done (M5): per-class castable levels, `spellLimitReason`, Hit/DC, CAST pool choice. Unit
`spellSlots.test.ts`; E2E `multiclassSlots.spec.ts`.

M4 done (D323). No schema change (59). `hitDiePerLevel(character, classData)` (maxHitPoints.ts): class + faces of every
character level — one class for all levels, 2+ classes from a consistent `levelOrder`, else unknown "Cannot tell which
class each level came from (no level history). Set a manual maximum." Read by `computeMaxHitPoints` (level 1 = first
class's die max, later levels stored entry or that level's own fixed average, D43 note against that level's die;
multiclass breakdown rows name the class, single-class wording unchanged) and `HitPointsPicker` (per-row die and
"Level N · Class", average-all per die; multiclass refusal removed). Level-up walk no longer shows the read-only Level 1
row. Multiclass with levelOrder now gets a known max, so Long Rest is enabled. Wizard `hitDieKey` gate and draft max HP
stay single-class (M7). Unit `maxHitPoints.test.ts`, `HitPointsPicker.test.tsx`; E2E `multiclassHitPoints.spec.ts`,
`wizardW6.spec.ts` (W-6 a/e).

F-9 done (D324), review fixes for M2–M4. No schema change (59). `CharacterSpellSlotMaxima.pactSlotLevel` added (sheet
reads it instead of `spellSlotsEntries`). Unknown slot maxima now show their reason (`UnresolvedValue`) in the Spells
section and the Spell Slots drawer (button shown too) instead of zero slots. Manage Feats held tools use `firstClass`
(`heldToolsOf`); prerequisite proficiencies moved to exported `prerequisiteClassProficiencies`. validate-data pins Wizard
XPHB slot rows 1, 5, 19, 20 to the multiclass table. Tests: `spellSlots.test.ts` (Warlock + two casters, Arcane Trickster,
three classes, unknown), `ManageFeatsPanel.test.ts`, `CharacterSheet.test.tsx` (unknown reason), E2E
`multiclassSlots.spec.ts` (drawer; stale max HP override dropped). Findings 1–2 of the review stay open (M6/M7).

M5a done (D325). No schema change (59). `SheetSpellEntry.chosenBy` (+ `rowKey`, `subclassOwners`): a spell two classes
chose is two entries (`spellEntryKey` keys them apart); grants merge into the first chooser's row. `casterFor` uses the
chooser's class entry, a subclass grant the owning class. Provenance "player pick (<Class>)" and the Actions row origin
in multiclass. New `sheet/classSpellLimits.ts`: per-class cap (own table / pact level) and counts against that class's
picks; blanket multiclass `spellLimitReason` removed; over-limit notices "<Class> cantrips: …" in multiclass. Not done
(M5b): CAST pool choice, upcast into pact slots. Unit `classSpellLimits.test.ts`; E2E `multiclassSpells.spec.ts`.

M5b done (D326). No schema change (59). `SpellRowAction` cast carries `pools: ('ordinary'|'pact')[]` from its section
(`spellsTabActionSections`); a both-pools section renders Slot + Pact buttons (`CAST_POOL_NAME` / `CAST_POOL_EMPTY`,
`.sheet__spell-cast-pair`), `castSpell` spends the named pool. D207 upcast rows now also go to a pact section without
ordinary slots. An `unavailable` row's CAST is disabled. Unit `spellsTabData.test.ts` "cast pools (D326)"; E2E
`multiclassCast.spec.ts`. Follow-up (D327): a spell below the pact level with no slot of its own level and no
`entriesHigherLevel` gets a badged pact-only CAST row in the pact section (`#cast@<pact level>`); E2E M5b e.

R8a (D206): leveled spell dice in Effect (Spells tab) and Damage (Actions tab).
`leveledSpellDice(detail, slotLevel)` + `isScaledHealing` (spellActionRowData.ts)
read `{@damage}` (and `{@dice}` for `{@scaledice}` spells) from entries and scale
them by the `{@scale…}` tags of entriesHigherLevel; `spellEffect` now returns
`{dice, text}` (dice above the types / "Healing"). CAST rows use the section's
slot level (pact rows the pact level), USE/label rows and Actions the spell's own.
`SpellDamageLine` rolls "NdM + K" whole, never "2d8 + 1d6". `SpellDetail.miscTags`
added. Ice Storm XPHB scale base 2d8→2d10 in extraction, guarded by validate-data.
E2E `spellDice.spec.ts` a–d2. No schema change (still 50). Next: R8b (upcast rows).

R8b (D207): upcast rows in the Spells tab. A CAST spell with non-empty
`entriesHigherLevel` gets one more CAST row per higher ordinary-slot section
(`spellsTabActionSections` in spellsTabData.ts), badged with its own level;
CAST and Effect there already used `section.key`, so no change to `castSpell`
or `spellEffect` was needed. No upcast for USE/label rows, cantrips,
unresolved spells, `unavailable` (D106) spells, or pact-only casters (D189).
Section row order: unbadged rows first, then badged rows ascending by level,
then by name. Bundled: `leveledSpellDice` dedupes identical scaled lines
(Enervation, Backlash, Wall of Light); a scaled-healing roll (`isScaledHealing`)
is labelled "healing" in the roll history and button aria-label, not "damage"
(`SpellDamageLine`). E2E `spellDice.spec.ts` extended. No schema change (still 50).

R9a (D208): Manage Spells drawer on the sheet, every casting class. "Manage
Spells" button at the right end of the Spells tab toolbar (shown for any class
with spell counts, even with no picks; toolbar now renders for it alone; absent
without `onEditSpellChoices`). Drawer: Spell Slots / Pact Magic sections (same
`UseBoxes` on `play.spentSpellSlots`, header summary via new
`DrawerSection.summary`), then one `ClassSpellsManager` (src/sheet/ManageSpellsPanel.tsx,
no slot code, reusable by R9c) per class: "Prepared Spells (N)" (picks with
Delete/Unprepare; class/subclass always-prepared and subclass choice picks
read-only with a grey tag) and "Add Spells" (Cantrips/Prepared counters, search,
multi-select level pills, Prepare/Add disabled when full or had from elsewhere
via knownSpells.ts, ▸ spell text). Every click writes through
`CharacterStore.setSpellChoices` (empty list clears the field). Pool loading
moved to `src/spells/classSpellPool.ts` (`loadClassSpellPool` /
`useClassSpellPool`), used by both SpellPicker and the panel. Pure helpers in
src/sheet/manageSpellsData.ts. Wizard unchanged. E2E `manageSpells.spec.ts`
a–k. No schema change (still 50). Next: R9b (Bard Magical Secrets).

R9b (D209): Bard Magical Secrets. `loadClassSpellPool` takes `classLevel` and
reads the class record's `additionalSpells[].expanded` structurally
(`extractClassExpandedQueries` / `loadClassExpandedQueries` in
classSpellListData.ts; numeric key = class-level gate, `sN` ungated, slot filter
applies). From Bard 10 levels 1–5 of Cleric/Druid/Wizard join the pool, from 11
the 6th+ ones as slots allow; never cantrips. Spells not on the Bard list carry
`viaClassExpanded` and a grey "Magical Secrets" tag in Add Spells, Prepared
Spells and SpellPicker; dedupe by name|source. Picks live in the Bard's
`spellChoices`. Not handled: level removal below 10 leaves such picks in place.
`ClassSpellsManager` gained a `classLevel` prop. E2E `manageSpells.spec.ts`
R9b a–d, unit tests in classSpellPool.test.ts. No schema change (still 50).
Next: R9c (wizard rework).

R9c (D210): the wizard's Spells step renders `ClassSpellsManager` inline in
`wizard__panel` (creation, Edit Character, level-up) instead of SpellPicker;
wizard state (`spellChoices: SpellPick[]`, now defined in wizardState.ts) and the
stored Character are unchanged. The manager's `onChange` hands a new pick its
`level`. Always-prepared class/subclass spells show in Prepared Spells with the
"Always prepared" tag; subclass choice picks read-only. Next still needs the exact
counts (`isCompleteSpellChoices`). `SpellPicker` and `AlwaysPreparedSpellsList`
(with tests) deleted; the wizard loads `ResolverData` for the ▸ spell text.
SubclassSpellChoicePicker stays below the class section. E2E `wizardSpells.spec.ts`
(Eldritch Knight 3); frhof/scc specs moved to the new buttons. No schema change
(still 50).

R10a (D211): Manage Inventory drawer (`src/sheet/ManageInventoryPanel.tsx`),
opened by "Manage Inventory" in the Inventory tab. Sections: Add Items (search,
10 type pills, Magical checkbox, max 20 rows alphabetically + "Showing 20 of N",
ADD = +1 piece merged into the plain row), Add Custom Item (CustomItemForm
unchanged; Edit scrolls to it), Currency (unchanged controls), My Inventory
(−/number/+, Equip/Put down, Grip, Magic bonus, Attune, Edit, REMOVE; attunement
count and notice above). The Inventory tab is read-only (×N, money, attunement
count, descriptions) until R10b. ItemRef gained `wondrous`, `staff`, `rarity`;
`itemFilterKindsOf`/`isMagicItem` in inventoryData.ts (DATA.md "Item filter
kinds"). The old "Add an item" checkbox list (add/remove toggle) is gone. E2E
`manageInventory.spec.ts` a–i; combatActions/actions/scc specs moved to the
drawer. No schema change (still 50).

R10b (D211): the Inventory tab is `src/sheet/InventoryTab.tsx` (old read-only
list removed). Header (money, "X of Y attuned" + breakdown), toolbar (search,
pills All/Equipment/Attunement/Other possessions, MANAGE INVENTORY), table
ACTIVE·NAME·QTY·NOTES with ▸ description, empty states. ACTIVE checkbox (only
on equippable rows) = Equip/Put down through the shared
`src/inventory/equipActions.ts` (putDown, takeInHand, toggleEquip), also used by
the panel; the notice shows above the table. Search/filter/open rows are tab
state only (D116). Item price is no longer shown. E2E `inventoryTab.spec.ts`
a–f (+ g/d via panel); `manageInventory`, `combatActions`, `scc` specs adjusted.
No schema change (still 50). Next: see BUILD ORDER after R10.

R11a (D212) done: new last tab Extras (`src/sheet/ExtrasTab.tsx`, rows/notes/
overage notices in `extrasData.ts`): pills All/Familiar/Wild Shape, MANAGE EXTRAS,
table NAME·AC·HIT POINTS·SPEED·NOTES (familiar = average HP, Wild Shape forms =
"Uses your HP"), name opens the stat block in the shared drawer. Manage Extras
(`ManageExtrasPanel.tsx`): Add an Extra (category select, search, ADD/REPLACE/
"Current"/"Known", Wild Shape counter "Known forms: X / N" + "· FULL") and Current
Extras (DELETE). `characterStore.setWildShapeForms` (wired as
`onEditWildShapeForms`); the Familiar and Wild Shape sections and `classExtras`
are gone from Features & Traits. `BeastStatBlock` restyled and split into
`BeastStatBody` (drawer/panel) + the `<details>` wrapper (wizard); Initiative
shown (Dex + proficiency when the data says so). beasts.json now also loads for a
Wild Shape class with no stored forms. E2E `manageExtras.spec.ts` a–f;
`classGrants` spec adjusted. No schema change (still 50).

R11b (D213) done — R11 complete. Schema 51 (50→51 tag only):
`CharacterFamiliar.currentHp` / `.temporaryHitPoints` (absent = full / none),
`characterStore.setFamiliarHitPoints` (wired as `onEditFamiliarHitPoints`);
`setFamiliar` always drops both fields; `RestFields.resetFamiliarHp` (set by
`afterLongRest`) drops them on a Long Rest. Extras familiar HP cell = "current /
max" button (+ "+N temp"), max = stat block average (`familiarHitPoints` in
`extrasData.ts`); it opens the new drawer kind `familiarHitPoints`
(`FamiliarHitPointsPanel.tsx`: Heal/Damage/Temp on one amount input, Resummon,
"disappears" text at 0 HP). Manage Extras is also offered when a familiar or
Wild Shape form is stored but its category is no longer available (Current Extras
only). E2E `manageExtras.spec.ts` R11b a–g.

R12 (D214) done — Conditions only (Heroic Inspiration D167 and Defenses R4c were
already in). New `data/conditions.json` (15 XPHB, `extractConditions`, checked in
`validate-data`). Schema 52 (51→52 tag only): `play.conditions` (14 names, no
Exhaustion) and `play.exhaustion` (1–6), `characterStore.setConditions` /
`setExhaustion` (wired as `onEditConditions` / `onEditExhaustion`);
`afterLongRest` returns `exhaustion − 1` via `RestFields.exhaustion`, a Short Rest
omits it. `src/conditions/conditions.ts` (names, loader, penalty text) and
`src/sheet/Conditions.tsx` (status-row `ConditionsCard` with chips, drawer kinds
`conditions` and `condition`); the disabled placeholder in `SheetHeader` is
replaced by a `conditions` slot. Nothing is recalculated. E2E `conditions.spec.ts`
a–h. Next: R13 Manage Feats.

R13a (D215) done. Schema 53 (52→53 tag only): `GrantedFeatOrigin` gains
`'manual'` (a DM-granted feat; decides which feat, may repeat).
`featInstances` returns them last as `manual:<n>` (n = order among manual
entries), `featOriginLabel`/`featSource` → "Added manually";
`featAbilityScoreContributions` appends them (the one direct `featAsiChoices`
reader). `characterStore.addManualFeat` / `removeManualFeat` (wired as
`onAddManualFeat` / `onRemoveManualFeat`). Features & Traits toolbar has
MANAGE FEATS → drawer kind `manageFeats` (`ManageFeatsPanel.tsx`): My Feats
(background/species/level feats and the class Fighting Style locked with a
chip, ASI levels as "Ability Score Improvement", manual feats with REMOVE, ▸ =
text + stored sub-choices read-only), Add Feats (search, category pills, ADD;
held non-repeatable feats not offered; `featOffers`), Unavailable (collapsed,
reasons). `DrawerSection` gained `open`. E2E `manageFeats.spec.ts` a–h.

R13b (D215) done — **R13 complete**. My Feats' ▸ is now editable for
`asi:N`/`background`/`manual:n` instances: `FeatSubChoicePicker` (skills/
tools/languages/expertise, Magic Initiate, spellcasting ability), plus a
plain half-feat ability select (`featAbilityChoiceOptions`) the picker itself
doesn't cover, and `AsiSubPicker` (exported from `FeatAsiPicker.tsx`) for an
ASI level's own increases. Strixhaven Initiate and the 8 filter-choice feats
stay read-only (no picker for `blockName`/`filterChoiceSpells` — not built,
D215 report). `characterStore.setFeatChoiceDetails(id, key, feat, details)`
(asi:N and manual:n must already exist; background is created if no entry
names that feat yet) and `.setAsiIncreases(id, level, increases)` (shape only,
`isValidAbilityIncrease`; the level-20 cap is a picker-side disable, same as
the wizard) — wired as `onEditFeatChoice` / `onEditAsiIncreases`. No schema
change. Sheet's "Choices not made yet" and `LATER_CHOICE_NOTE` now say
"Manage Feats" wherever the panel can make that choice, "Edit Character" only
for the two feat types it can't (`FeatureTabRow.pendingEditableInManageFeats`).
Bundled: `FeatAsiPicker`'s `manualFeats` prop — a held non-repeatable manual
feat is now disabled ("Already added manually.") and counted in the
prerequisite context, same as `featOffers`. Bug found and fixed in the same
component: `AsiSubPicker`'s "+1 to two abilities" radio was unreachable (both
mode radios cleared `increases` to `{}`, and mode was derived purely from its
length) — mode is now local state, initialized from the stored value. E2E
`manageFeats.spec.ts` R13b a–g. Next: R14a (custom item — numbers and
senses).

R14a1 (D216) done. Schema 54 (53→54 migrates): `CustomItemDefinition.bonuses:
CustomItemBonus[]` replaces the five `bonus*` fields (armourClass,
initiative, maxHitPoints [+`perLevel`], weaponAttack, weaponDamage,
spellAttack, spellSaveDc, allSavingThrows, savingThrow+ability,
allAbilityChecks, skill+skill, passive+passive; one per target, non-zero
integer). `describeCustomItemProblem` checks it (D43). `customItemRef` writes
the five items.json-backed targets onto `bonusAc`/`bonusSavingThrow`/…, the
rest onto `ItemRef.customBonuses`; `buildItemFlatBonusGrants` reads both.
`flatBonusesByTarget(grants, characterLevel)` adds `initiative`,
`maxHitPoints`, `weaponAttack`, `weaponDamage` and `savingThrowFor` /
`skillFor` / `passiveFor`; new optional params on `computeInitiative`,
`computeSavingThrows`, `computeSkills`, `computePassive*`,
`computeMaxHitPoints`, `computeWeaponAttacks` (Unarmed Strike untouched). An
unresolved attuned item is now noted on 10 targets (was 6). `SKILL_LABELS`
moved to `skills.ts`. Form: `CustomItemBonusList.tsx` (rows: grouped target
select, amount, per-level checkbox for Max HP, Remove; "+ Add bonus"). Current
HP is not touched when an item changes max HP (same as a manual feat, R13a).
E2E `customItemBonuses.spec.ts` R14a1 a–f.

R14a2 (D216) done. No schema bump: `CustomItemDefinition` gained optional
`flySpeed`/`swimSpeed`/`climbSpeed` and `blindsight`/`tremorsense`/`truesight`
(positive whole feet; `describeCustomItemProblem` rejects the rest), the same
convention `speedBonus`/`darkvision` used in e2b. `computeSpeed` takes a fourth
parameter `GrantedSpeedMode[]` (`buildItemSpeedModeGrants`): each mode is the
highest of the species-derived value and the applied item grants, never summed,
unaffected by walking adjustments; zero-amount breakdown lines name the item
(unattuned: D76 note). Senses: `GrantedSense.origin` gained `'item'` +
`withheldReason`; `buildItemSenseGrants` feeds `combineSenseEntries`
(`itemOrigins`, `withheldItemOrigins`; an all-withheld type shows no range).
Form: six `OptionalNumberField`s ("Fly speed" … "Truesight") that drop 0/negative.
Bundled fix: `loadCharacterMaxHp` (level-up / level-removal current-HP shift) now
includes item max-HP bonuses (loads items.json only when the character carries
something); the wizard's max-HP draft carries the inventory. E2E
`customItemModes.spec.ts` R14a2 a–d.

R14b (D217) done. No schema bump (optional fields, same convention as R14a2):
`CustomItemDefinition.proficiencies: CustomItemProficiency[]` (weaponCategory,
weapon name+source, armor light/medium/heavy/shield, tool, language,
savingThrow, skill [+`expertise`]; each entry once, a skill once),
`vulnerable`, `conditionImmune`, `conditionAdvantage` (the 14 conditions +
Exhaustion). `describeCustomItemProblem` checks all four; `customItemRef` writes
`customProficiencies`/`vulnerable`/`conditionImmune`/`conditionAdvantage` onto
`ItemRef`. New `calculation/itemProficiencies.ts` (`ItemProficiencyGrant`,
`itemWeaponGrants`, `itemSaveProficiency`, `itemSkillProficiency`) and
`sheet/itemProficiencyData.ts` (`buildItemProficiencyGrants`,
`buildItemConditionGrants`, `conditionsGranted`, `conditionAdvantageLines`);
grants of an unattuned attunement item carry `withheldReason`. `computeSavingThrow(s)`,
`computeSkill(s)` and `computePassive*` take a trailing `itemProficiencies`
(source named "proficiency (<item>)"; highest status wins; unattuned → D76
"considered" line); `computeProficiencies` takes `itemGrants` (`ProficiencySource`
kind `'item'`; item tools never count in `toolsHeldElsewhere`); the weapon
proficiency grants of `loadWeaponAttackData` include the item's, so the HIT
gains the bonus (the mastery picker does not read them). `buildItemGrants` reads
`vulnerable` and withholds an unattuned item's vulnerability / condition immunity
like its resistance. Sheet: Defenses card "Immune:" also lists condition
immunities, the Defenses drawer a "condition immunity" line per condition,
Conditions drawer rows a "immune (<item>)" note (the switch still works), a
"Advantage on saving throws against …" note under Saving Throws. Form:
`CustomItemProficiencyList.tsx` (kind · value · Proficient/Expertise for Skill ·
Remove, "+ Add proficiency"; tool and language lists load on first use),
`ConditionChoice` (two checkbox groups), Vulnerabilities via `DamageTypeChoice`.
Bundled fix: `HitPointsPicker` loads `loadItemMaxHpBonuses` (extracted from
`loadCharacterMaxHp`), so the level-up Hit points step's maximum includes item
max-HP bonuses; the wizard's hit-points draft carries the inventory. E2E
`customItemProficiencies.spec.ts` R14b a–h.

R14c1 (D218) done. No schema bump (optional fields, same convention as R14a2/R14b):
`CustomItemDefinition.feats: CustomItemFeat[]` (name+source + `FeatChoiceDetails`,
each once) and `invocations: {name, source}[]` (EI options, each once);
`describeCustomItemProblem` checks both (sub-choices via the exported
`describeFeatChoiceDetailsError`). New `inventory/customItemGrants.ts`
(`itemFeatGrants`, `itemInvocationGrants`: D216 gate + malformed → nothing).
`featInstances` adds origin `'item'`, key `item:<row>:<n>`, `itemName`; label
"From item (<name>)" (Manage Feats chip, Features & Traits feat source; locked, no
Remove, choices editable — `setFeatChoiceDetails` writes into the row's
`custom.feats`). Wizard: the draft feat instances carry the inventory;
`FeatAsiPicker.itemFeats` ("Already granted by an item."). Invocations:
`itemInvocationOptions`/`loadItemInvocationOptions`/`loadAllInvocations`
(optionalFeatureData.ts); spells (`extractItemInvocationSpells`, grant origin
`'item'`, `SheetSpellEntry.itemInvocationOrigins`, cast with Warlock numbers only —
else `casterFor` reason), senses (`extractItemInvocationSenses`, "Invocation — Item"),
Actions/resources (item-only invocations, deduped by name against picks), Pact of
the Chain familiar forms, Features & Traits group "From items" (kind `'class'`).
No invocation has a damage response (D70 table), so nothing there. Form:
`CustomItemGrantList.tsx` (Feats / Invocations rows: select · Remove). Bundled fix:
Conditions drawer sorts by code unit, not `localeCompare`. E2E
`customItemFeats.spec.ts` R14c1 a–g. Next: R14c2.

R14c2 (D219) done. No schema bump: `CustomItemDefinition.spells: CustomItemSpell[]`
(name, source, `uses` atWill / perLongRest / perShortRest + count, optional
`castLevel`, `caster` own {ability int/wis/cha} | fixed {saveDc?, attackBonus?});
`describeCustomItemProblem` checks the shape. Spent counts on the ROW:
`CharacterInventoryItem.spellUses` (`name|source` → spent; validate.ts checks and
carries it). `itemSpellGrants`, `itemSpellKey`, `mapItemSpellUses`,
`withItemSpellSpent` (customItemGrants.ts). `SpellUsage` gains `perLongRest` /
`perShortRest` (labels "N/LR", "N/SR"). New `sheet/itemSpellRows.ts`: `itemSpells`
(never merged into `combineSpellEntries`; cantrip → at will; castLevel clamped to
≥ spell level; fixed caster → D43 reason when a needed number is empty; own →
`computeAbilitySpellcasting`, PB + mod + item spell attack/DC bonuses),
`itemSpellActionRows` (via the extracted `spellActionData`, dice at castLevel,
subtitle names the item). `spellsTabActionSections({ itemSpells })`: one row per
item spell in its castLevel section, badge = own level, USE row (counter key
`item:<row>:<name|source>`, per render only) or "At will" label, never CAST;
`SpellsTabRow.item` carries caster + castLevel. Sheet overlays the item counters
onto `resourceMaxima` / `resourceRecharge` / `resourceUses`; `spendResource`
writes them to the row via `onEditInventory`. Rests: `afterShortRest` /
`afterLongRest` take the inventory, `RestFields.inventory` (one write). Editing
an item drops counts of removed spells and clamps to the new count. Bonus/Reaction
groups list item spells deduped against the character's own entries. Form:
`CustomItemSpellList.tsx` (spell by level · uses · N · cast at level · DC and
attack · ability or Save DC / Attack bonus · Remove); `ManageInventoryPanel`
prop `defaultSpellAbility`. E2E `customItemSpells.spec.ts` R14c2 a–g (+c2).
Not done: an item's Find Familiar / Mage Armor does not enable the Extras /
Mage Armor features (they read `combineSpellEntries` only).

R14d (D220) done. No schema bump: `CustomItemBonus` gained `familiarArmourClass`,
`familiarMaxHitPoints` (per level allowed), `familiarAttack`, `familiarDamage`,
`familiarSavingThrows`, `familiarWalkingSpeed` (`CUSTOM_FAMILIAR_BONUS_TARGETS`,
`isFamiliarBonusTarget` in inventoryData.ts; `describeCustomItemProblem` accepts
them; `itemFlatBonusData` skips them, so no character number moves). Form: a
"Familiar" group ("Familiar: AC" …) in `CustomItemBonusList`. New
`sheet/familiarItemBonuses.ts`: `familiarItemBonuses` (D216 gate over the whole
inventory, per-level × total character level), `applyFamiliarBonuses` (a COPY of
the Beast: AC, average HP + formula, walk speed only when the form has one > 0,
all six saves when a save bonus applies, attack/damage in action text via
`rewriteAttackText`: first `{@hit}` and first `{@h}` damage of an `{@atkr}`
action, riders untouched), `familiarBonusLines`. `extraRows({ familiarBonuses })`
applies it to the familiar row only; `familiarHitPoints` clamps current to max.
`ExtrasTab` gets `familiarBonuses` + `onOpenFamiliar`; the familiar's stat block
drawer shows "Bonuses from items" (unattuned: "not applied: not attuned"). Wild
Shape rows and Manage Extras pass no bonuses. E2E `familiarItemBonuses.spec.ts`
R14d a–g.

R14e1 (D221) done. No schema bump. extract-data.js derives `abilityMax` for
additive `ability` items (validate-data asserts it). `ItemRef.abilityEffects`
(set / add+max) and `abilityChoice`. Pure `calculation/itemAbilityScores.ts`
(`ItemAbilityGrant`, `itemAbilityScoreContributions`: adds capped, then highest
set-to, "no effect" lines); `computeAbilityScore(s)` takes the grants as a 4th
argument, threaded as a trailing optional `itemAbilityGrants` through initiative,
AC, armourSpeedPenalty, weapon attacks, max HP, saves, skills/passives and the
four spellcasting functions. `sheet/itemAbilityScoreData.ts`
`buildItemAbilityGrants` (requires-attunement only; unattuned → "not attuned";
Vile Darkness attuned → six "ability choice not supported" lines). Sheet passes
them everywhere except Manage Feats prerequisites (`baseAbilityScores`);
`hpDefault.loadItemMaxHpBonuses` now returns `{ itemBonuses, itemAbilityGrants }`
so level-up HP shift and HitPointsPicker include Con items. Wizard untouched.
E2E `itemAbilityScores.spec.ts` R14e1 a–i.

R14e2 (D222) done. No schema bump. `CustomItemDefinition.abilityScores?`
(`{ability, kind:'set', value}` | `{ability, kind:'add', amount, max}`, each
ability once, 1–30, amount ≠ 0), proved by `describeCustomItemProblem`.
`buildItemAbilityGrants` now emits grants for custom rows under D216's gate
(requiresAttunement and not attuned → "not attuned" zero line; otherwise always,
pack included; malformed → nothing); the calculation is unchanged. Form block
`CustomItemAbilityScoreList.tsx` after Bonuses (Max only for Add, default 20,
used ability not offered again, invalid row disables Add/Save). Copy-from-item
does not carry ability scores. E2E `customItemAbilityScores.spec.ts` R14e2 a–e.

R15 (D223) done. No schema bump. New `data/rules.json` (`extractRuleTexts`,
checked in validate-data: 7 XPHB glossary + 4 senses + 18 skills), loaded by
`rules/ruleTexts.ts` (`loadRuleTexts`, `findRuleText`). `sheet/RuleText.tsx`:
`RuleTextRow` (collapsed `DrawerRow` + `Entries`), `CustomItemHint`,
`GrantedSenseSections` (non-Darkvision granted senses with range and the card's
provenance incl. "not applied"; `senseLabel`/`senseProvenanceLabel` now exported
from SensesList). Drawers: saves/save (Saving Throw), skills (Skill, Expertise,
per-skill description)/skill (description), proficiencies (Proficiency; Armor
Training in Armor, Weapon in Weapons; none for Tools/Languages), senses (Passive
Perception; Darkvision rule when > 0; granted-sense sections). Hint sentence at
the bottom of the four group drawers. Sheet cards unchanged. CustomItemSpellList
"+ Add spell" starts on `own` with `defaultAbility`. E2E `ruleTexts.spec.ts`
R15 a–e, `customItemSpells.spec.ts` R14c2 c / R15 f.

R16 (D224) done. No schema bump. `app/FlameBackground.tsx`: one fixed canvas
behind the app (particles and pointer in effect-local variables, rAF stops when
hidden or idle, not mounted under reduced motion), watches `data-flame` /
`data-theme` on `<html>`. `FlameToggle.tsx` ("Flame: On/Off") next to the theme
toggle; `AppSettings.flame` (default true) via `applyFlame`. `--flame-hot` in
theme.css; `main` has an opaque `var(--bg)`. E2E `flame.spec.ts` R16 a–d.

W-1 (D225–D236) done. No schema bump. Wizard shell: `creation/WizardShell.tsx`
(`WizardStepList` — sticky horizontal step bar, reachable steps are buttons;
`WizardNavButtons` — Cancel · Back + Next/save, rendered in the bar as "Quick
navigation" and under the step as "Step navigation"). Step title h2 per step,
fieldsets styled as cards, content centered at 960px. `wizardState.ts`:
`isStepReachable` + reducer action `goTo`. `app/ConfirmDialog.tsx` (portal,
role alertdialog, safe button focused, Esc/backdrop = safe, focus returns) used
by wizard Cancel (only when data differs from empty/seed) and Remove level
(keeps the dropped list; header button styled like Level up). `--backdrop`
token in theme.css. Step label "ASI / Feat". Tests target the "Step
navigation" row (`e2e/wizard.ts` `wizardNav`, `src/creation/wizardTestNav.ts`).
E2E `wizardShell.spec.ts` W9 a/b, W23 c–f, W28 g.

W-2 (D237) done. No schema bump. Class step / Class options lists with rule text
(subclass, fighting style, masteries, subclass options, invocations/metamagic, Wild
Shape forms, class feature "pick one" choices) are CHOOSE / CHOSEN rows:
`pickers/ChoiceRow.tsx` + `variant="choose"` on `SearchableOptionList` (other uses
unchanged). ▸ folds the rule text; `extra` keeps a chosen option's sub-picker
(Pact of the Tome spells) visible. Class skills stay checkboxes. Test helpers:
`pickers/choiceTestHelpers.ts`, e2e `chooseButton` / `textToggle` in `e2e/wizard.ts`.
E2E `chooseLists.spec.ts` W-2 a–g.

W-3 (D238–D240) done. No schema bump. Species step has a card (`species/SpeciesCard.tsx`):
Creature Type · Size · Speed and every species trait with full text, loaded per species
(`speciesTraitsFrom`, `computeSize`/`computeSpeed` now take `Pick<Character, 'species'…>`).
Background, Expertise, Proficiencies (renamed from "Languages & Tools"), Spells sit in
`wizard__card` sections. Class step's Next needs subclass, fighting style, exact masteries and
exact subclass options (`ClassPickRequirements` / `classPicksComplete` in `wizardState.ts`, loaded
in `CharacterWizard.tsx` through the pickers' own loaders). E2E `wizardW3.spec.ts` a–g; `e2e/wizard.ts`
helpers pick the Fighter mastery count by level.

W-4 (D241–D245) done. No schema bump. Ability scores step: method pills (Standard Array · Point
Buy · Manual / Rolled) over one table whose first row holds the inputs (`abilities/AbilityScorePicker.tsx`)
and whose rows come from the shared `abilities/AbilityScoreTable.tsx` (Base · Background · ASI / Feats ·
Total · Modifier via `computeAbilityScore`; W-5 passes feats). Standard Array and roll assignment swap
(`assignWithSwap` in `abilityScores.ts`); Point Buy selects show cost and disable unaffordable options;
Manual / Rolled merges typed dice and ROLL/REROLL cards. Class step's Next also needs the exact class
skill count (`ClassPickRequirements.skillCount`, null when a level up holds them). E2E `wizardW4.spec.ts`
a–e; `takeAllFighterLevel4Picks` also checks two class skills.

W-5 (D246–D248) done. No schema bump. ASI / Feat step: `AbilityScoreTable` on top with the step's
choices live, then one collapsible card per ASI level (`featAsi/FeatAsiLevelCard.tsx`: header summary,
"Choose …" line, open when something is missing on entry). One "Feat or ASI" `<select>` per card, feats
grouped by category; unmet prerequisites and held non-repeatable feats (background, manual, item, other
level) disabled with the reason in the option text. `featOffers` moved to `featAsiData.ts` and is shared
with Manage Feats; `isCompleteFeatAsiChoice` exported. E2E `wizardW5.spec.ts` a–h; `e2e/wizard.ts` has
`levelCard`, `openLevelCard`, `featOrAsiSelect`, `featOption`, `chooseLevelFeat`, `chooseLevelAsi`.

W-6 (D249, D250) done. No schema bump. Hit points step: big "Maximum hit points" with open breakdown, per
level row (`hitPoints/HitPointLevelRow.tsx`) with AVERAGE / ROLL / MANUAL pills, rolled die in the
ability-score die look plus REROLL, manual field validated 1..die size (red border, "1–N" hint, Next locked).
`isStepComplete('hitPoints')` checks each value via `hitPoints/hitPointEntry.ts` (die size arrives as the
`hitDieFaces` condition); `CharacterStore.buildCharacter` refuses hit point values `list()` would reject.
E2E `wizardW6.spec.ts` a–f; `e2e/wizard.ts` `stopAtHitPoints` option.

F-1 (D251, D252) done. No schema bump. Fixes from the W-1–W-4 review: a new character's lowered level
prunes class-step picks it no longer grants (`pruneClassPicks` action) and the class gate refuses them;
requirement loaders run through `Promise.allSettled`, a failed one only relaxes its own pick (`null`);
back jumps in the step bar are always allowed (`reachableSteps`, completeness evaluated once per render);
`ConfirmDialog` traps focus, makes the background inert and catches Esc on window before a drawer;
choose rows show their reason when chosen too, a collapsed list keeps chosen rows' sub-picks visible,
same-named options name their book ("Choose Champion (PHB)"); `SubclassPicker` takes name + source.
E2E `wizardF1.spec.ts`; `e2e/wizard.ts` `chooseButton` matches the book-qualified name (XPHB by default).

F-2a (D253–D256) done. No schema bump. Fixes from the W-5 review. New `featAsi/featAsiLevels.ts`: one
loader/hook for the ASI / Feat step data (`useFeatAsiStepData`, used by `FeatAsiPicker` and by the wizard's
Next gate), `abilityScoresBelowLevel` (prerequisites and the cap of 20 read lower levels' ASI/feats, the
background and manual feats, no items), `featAsiLevelOffers`, `featAsiChoiceProblem` /
`invalidFeatAsiLevels` (taken by a granted feat or a lower level, prerequisite no longer met, Dark Gift
conflict). A flagged card opens with the reason in its "Choose …" line; the new
`featAsiChoicesValid` step condition locks Next and save, except at a level up's locked levels ("Fix it
in Edit Character."). "Already taken" matches feat names across books (`featOffers`, Manage Feats
`addableFeatOffers`). Card title "Level 19 (Epic Boon) — …", bonus via `featAbilityScoreContributions`;
reasons joined with " or ", category labels, "already has a Dark Gift"; a saved feat missing from the
data keeps a disabled "(not in data)" option. Selects are named "Level N feat or ASI" / "Level N +2
ability" / "Level N ability", the "Choose …" line is their `aria-describedby`, the card body has a
visually hidden legend. A new character's lowered level also prunes ASI choices above it, Class options
picks of a progression it no longer grants (`pruneClassOptionalFeatures` action) and Proficiencies-step
language/tool/skill picks granted only above it. E2E `wizardF2a.spec.ts` 1–7.

F-2b (D257, D258) done. No schema bump. Fixes from the W-6 review. A feat's `level` prerequisite in the ASI /
Feat step is compared with the card's level (`contextAt` in `featAsiLevels.ts`; `FeatAsiLevels.characterLevel`
removed); Manage Feats still uses the total level. Hit points step: the Average pill re-applies on click,
the hint is per method ("Average is 6" / "Whole number 1–N", no `role="alert"`, linked to the radiogroup),
the big maximum is "—" while a row is invalid (`data-testid="hit-points-max"`), Reroll buttons are named
"Reroll level N", Manual takes digits only, `isValidHitPointEntry(entry, null)` is false so an unknown hit
die keeps the step incomplete, `setLevel` keeps levels sorted, the wizard reuses `computeHitDicePool` and
`rollDice`. E2E `wizardW6.spec.ts` rewritten on roles/testids plus five F-2b scenarios; `e2e/wizard.ts`
`stopAtAsi` option.

F-3 (D259–D262) done. No schema bump. Fixes from the F-2a/F-2b review. The ability cap (20; an Epic Boon's own
`max: 30` from feats.json via `featAbilityCap`) now applies on every ASI / Feat card: `featAsiChoiceProblem`
checks the card's own increase against `scoresBelow` (ASI, half-feat bonus, fixed feat bonus), so a later change
to a lower card flags it like D254; `HalfFeatAbilitySelect` disables abilities over the cap. A clash with an
item's feat is a warning only (`GrantedFeat.item`, non-blocking in `invalidFeatAsiLevels`). `pruneClassPicks`
also drops `hitPointLevels` above the new level. The Hit points error has a Retry button (`onRetry` also
retries the wizard's hit die lookup). `FeatAsiPicker` takes the wizard's `load` and a required `abilityDraft`
(`FeatAsiLevels.draft`, so the table counts the background origin feat); the Next gate is `featAsiStepValid`.
E2E `wizardF3.spec.ts` 1–4; `wizardF2a.spec.ts` seeds only states the app can produce.

W-7 (D263) done. No schema bump, no logic change. Starting equipment step: each offer ("From your class (…)" /
"From your background (…)", still a `fieldset` group) shows its options as equal-width cards
(`inventory/EquipmentOptionCard.tsx`): small-caps label, CHOOSE / CHOSEN button ("Choose class option A"), rows
of what the option grants; the whole card is clickable. A pack is a ▸/▾ row ("<pack> contents") with its items;
single items and coins are plain rows. A chosen option's category pick is a `SearchableOptionList` in the
`choose` variant under the cards. "You will start with" (`inventory/StartingTable.tsx`) is a card with money
("15 gp · 0 sp · 0 cp") in the header and a NAME · QTY table. Old radios and bullet lists are gone. Unit
`StartingEquipmentPicker.test.tsx`; E2E `wizardW7.spec.ts` a–d; `e2e/wizard.ts` has `equipmentSection`,
`equipmentChoose`, `equipmentChooseAny`, `takeStartingEquipment`, and the `stopAtEquipment` / `onBackgroundStep`
options.

W-8 (D264–D267) done. Schema 55: `Character.portrait` (cropped 256×256 JPEG data URL, ≤ 200 000 chars,
`isValidPortrait`); migration 54→55 tags only. Write paths (`buildCharacter`, new `CharacterStore.setPortrait`)
and Import reject a malformed one; `list()` drops it (`withoutMalformedPortrait`). New `src/portrait/`:
`cropMath.ts` (pure crop: zoom 1 = cover, max 4, clamped pan/zoom, source rect), `PortraitCropDialog.tsx`
("Crop portrait": drag, wheel, Zoom slider, arrow keys, Apply → canvas JPEG), `usePortraitUpload.tsx` (file
chooser, 20 MB / unreadable errors, decode via `<img>` with EXIF orientation), `WizardPortrait.tsx` (88px
square left of Character name; hidden in level up), `SheetPortrait.tsx` (header frame as "Portrait" button with
Upload image / Remove menu; plain on a read-only sheet). `useModal` extracted from `ConfirmDialog.tsx`.
`WizardData.portrait` + `setPortrait` action; `saveCharacter` writes it, so Edit/Level up keep it, Remove level
keeps it via `characterUpdateInput`. Review step does not show it yet (W-9). E2E `portrait.spec.ts` a–h;
fixtures `e2e/fixtures/portrait-600x400.png`, `not-an-image.png`.

F-4 (D268–D270) done. No schema bump. Fixes from the W-7/W-8 review. `usePortraitUpload` downscales an image
whose longer side is over 2048 px once after decode (`downscaledSize` in `cropMath.ts`, PNG copy, full-size URL
revoked), ignores a stale decode (request counter), revokes the open URL on unmount and takes an optional
`returnFocus` ref. `PortraitCropDialog` has `onFail` (Apply that cannot encode closes the dialog and shows the
unreadable text), drags with button 0 only and clears on `lostpointercapture`, anchors the wheel on the padding
box; the 0.3 quality fallback is gone. `SheetPortrait` is now a disclosure (button `aria-expanded`/`aria-controls`
+ group "Portrait options" with plain buttons, error as `role="alert"`, button named "Portrait of <name>" with an
image), and focus returns to the frame after Esc, a menu choice, Apply and Cancel. A click inside an open pack's
contents no longer chooses the option. `CategoryPicker` is keyed by option and index; the wizard tells "loading"
(nothing shown) from "failed" for the category items (`categoryItemsFailed`). Unit `usePortraitUpload.test.tsx`,
`cropMath.test.ts`, `characterStore.test.ts` (cap boundary), `wizardState.test.ts` (replaced portrait); E2E
`portrait.spec.ts` F-4 a–d, `wizardW7.spec.ts` e.

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

Task A3 (D179) přidal picker těch podvoleb (`FeatSubChoicePicker`) do ASI
kroku a kroku backgroundu; bez změny schématu.

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
