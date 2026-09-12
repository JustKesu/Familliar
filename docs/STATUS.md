# Status

Poslední aktualizace: 2026-09-12 (krok 8 slice 8c1: `Character.masteries` nese
úroveň volby, schéma 31)

Tenhle soubor říká, co appka teď umí a co je dál. Proč je to tak a jak to
vzniklo je v DECISIONS.md (čísla D1–D98) a v REPORT.md (poslední session).
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
    featy mířící na útoky/AC (kroky 7/8), 5 featů s volbou dovednosti, kterou
    nemá appka kam uložit (QUESTIONS.md).
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
8. [in progress] Level up

   | Slice | Co | Schéma |
   |---|---|---|
   | 8a | Počítané maximum HP — příspěvek za úroveň, Constitution zpětně, tabulka tří bonusů, ruční přebití | 29→30 |
   | 8a-guard | Validace dat hlídá tabulku tří bonusů proti datům (D95) | — |
   | 8b | Krok wizardu "Hit points" — hod/průměr/ručně za úroveň 2+ | — |
   | 8c0 | `CharacterStore.create` přes jeden objekt místo pozičních argumentů | — |
   | 8c1 | `Character.masteries` je pole objektů `{ name, level? }` (D22 → D97) | 30→31 |
   | 8c2 | `Character.expertiseSkills` je pole objektů `{ name, level? }` (D22 → D98) | 31→32 |

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
9. [not started] Play tracking a odpočinky
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
- Uložení — localStorage, verzované schéma (teď 32), migrace fungují od
  verze 16 výš (D69); starší uložená postava se odmítne, ne převede. Migrace
  29→30 je první, která DATA PŘESOUVÁ, ne jen přepisuje tag: ručně napsané
  `maxHp` jde do `maxHpOverride` (D91). Migrace 30→31 je první, která hodnotu
  nechává NEZNÁMOU: z jmen v `masteries` dělá objekty bez úrovně (D97); 31→32
  dělá totéž s `expertiseSkills` (D98).
- Trvalá hlavička sheetu (přestavba sheetu, slice 1) —
  `src/sheet/SheetHeader.tsx`. Blok nad obsahem sheetu se šesti hodnotami:
  jméno, AC, iniciativa, rychlost, proficiency bonus, životy. Pět odvozených
  se přesunulo z plochého výpisu beze změny výpočtu a drží si rozklad na
  vyžádání (D40/D41). Životy jsou od slice 8a napůl počítané: MAXIMUM je
  šesté `Calculated<number>` s vlastním rozkladem (`.sheet__max-hit-points`),
  CURRENT zůstává ruční `currentHp` (D9) — prázdné = "nenastaveno" ("—"), 0
  platná. Druhé vstupní pole je "Max HP override" (`maxHpOverride`), ne
  maximum samo; `CharacterStore.setHitPoints` píše obě. Není sticky (může se
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
  tabs (rebuild slice 2)`.
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

Krok 8 běží. Slice 8a (počítané maximum HP), 8a-guard (validace tabulky
bonusů, D95), 8b (krok wizardu pro volbu hod/průměr/ručně za úroveň, D96) a
8c0 (`CharacterStore.create` přes jeden objekt), 8c1 (`masteries` nese úroveň
volby, D97) a 8c2 (`expertiseSkills` totéž, D98) jsou hotové; další je
**slice 8c3** — stejná změna tvaru pro `optionalFeatureChoices`, jehož holá
jména sedí o úroveň hlouběji uvnitř objektu, a pak **slice 8d** — tlačítko
level-upu, opětovný vstup do kroku 8b při zvýšení úrovně existující postavy a
první zápis `level` u voleb z level-upu.

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
