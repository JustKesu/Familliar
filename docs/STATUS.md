# Status

Poslední aktualizace: 2026-09-10 (resolver plné množiny class/subclass featur
+ jeho výpis na záložce "Schopnosti a rysy" — D87; schéma 28 beze změny)

Tenhle soubor říká, co appka teď umí a co je dál. Proč je to tak a jak to
vzniklo je v DECISIONS.md (čísla D1–D86) a v REPORT.md (poslední session).
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
   picker, kouzla udělená subclassou/featem/optional feature (všechny pevné
   tvary grantu), popisky použití (bez slotu / na den / rituál / zdroj),
   hlídání kolizí napříč všemi pickery kouzel. Trvalé odklady: Warlock The
   Genie (chybí uložená volba džina), Boon of Siberys (schovaný), Eberron
   marks (nedosažitelné bez trackingu kampaně), 2 kouzla chybí v datech —
   viz QUESTIONS.md.
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

   Aktuální schéma: 28. Zbývá z **přestavby sheetu**: řádky použitelných
   schopností (slice 5 část A) do tabulky akcí — blokované návrhovou otázkou,
   viz Next step. Slice 5 část B (oprava `formatRange`) je hotová, samostatná.

   Přestavba sheetu (poslední kus kroku 7 — trvalá hlavička + záložky + jedna
   tabulka akcí místo plochého výpisu sekcí). Rozdělena na 5 slice; slice 1
   (trvalá hlavička), slice 2 (záložky), slice 3 (tabulka akcí, útoky
   zbraněmi) a slice 4 (řádky kouzel) hotové — viz níž. Groundwork k tabulce
   akcí:

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

   Zatím ne: řádky použitelných schopností v tabulce akcí (slice 5 část A).
   Odblokováno — záložka "Schopnosti a rysy" teď renderuje plnou množinu
   class/subclass featur (D87, `src/sheet/grantedClassFeatures.ts`), takže
   `isActionTableFeature` má nad čím běžet pro featury, na kterých D86 vzniklo
   (Second Wind, Rage, Channel Divinity, Lay on Hands, Wild Shape…). Část A
   sama je pořád nenapsaná: musí vzít výstup `grantedClassFeaturesFrom`,
   profiltrovat ho `isActionTableFeature` a přidat řádky do `ActionsSection`
   bez Range/Damage/To Hit/Notes (D86). Nesmí sahat do `src/actions/` — to je
   ta část. A — samostatně, otázka pro krok 9 zaznamenaná v D86 — pool
   definitions (max použití, obnova) pro `consumes` cíle, které v těchto
   čtyřech souborech strukturovaně vůbec nejsou.
8. [not started] Level up
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
- Uložení — localStorage, verzované schéma (teď 28), migrace fungují od
  verze 16 výš (D69); starší uložená postava se odmítne, ne převede.
- Trvalá hlavička sheetu (přestavba sheetu, slice 1) —
  `src/sheet/SheetHeader.tsx`. Blok nad obsahem sheetu se šesti hodnotami:
  jméno, AC, iniciativa, rychlost, proficiency bonus, životy. Pět odvozených
  se přesunulo z plochého výpisu beze změny výpočtu a drží si rozklad na
  vyžádání (D40/D41). Životy jsou ruční `currentHp`/`maxHp` na `Character`
  (D9) — nic je nepočítá, prázdné = "nenastaveno" ("—"), 0 platná;
  `CharacterStore.setHitPoints`. Není sticky (může se řešit později). Testy:
  `SheetHeader.test.tsx` a nová sekce v `CharacterSheet.test.tsx`.
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

Krok 7 zbývá dokončit přestavbou sheetu. Trvalá hlavička (slice 1), záložky
(slice 2), tabulka akcí s útoky zbraněmi (slice 3), řádky kouzel (slice 4)
a slice 5 část B (oprava množného čísla ve `formatRange`) jsou hotové.

Zbývá slice 5 část A — řádky použitelných schopností v tabulce akcí,
identifikace přes `isActionTableFeature` (D86), bez Range/Damage/To Hit/Notes.
Řádkový model `ActionTableRow` na to čeká připravený. Odblokováno: resolver
plné množiny class/subclass featur je hotový (D87, `grantedClassFeatures.ts`),
takže "Schopnosti a rysy" tu množinu renderuje a část A ji může profiltrovat
`isActionTableFeature` a přidat řádky do `ActionsSection`. Je to vlastní
budoucí task; nesmí sahat do `src/actions/` ani do `isActionTableFeature`.

Otevřený kosmetický bod (vědomě odložený, D87 bod 5): wrapper featura (Life
Domain) se ve výpisu ukazuje jako běžný řádek vedle featur, které uvádí. Není
strukturální způsob, jak wrapper poznat, a jmenný seznam výjimek je přesně to,
čemu se projekt vyhýbá (D21). Znovu zvážit až po revizi skutečného sheetu.

Než se začne krok 7a (kouzla z rasy) nebo pickery tří podtříd (Storm
Herald, The Genie, Divine Soul), potřebují rozhodnutí — viz QUESTIONS.md.
