# Status

Poslední aktualizace: 2026-09-10 (přestavba sheetu slice 1 — trvalá hlavička + ruční životy, schéma 28)

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

   Aktuální schéma: 28. Zbývá z **přestavby sheetu**: záložky + jedna tabulka
   akcí — viz Next step.

   Přestavba sheetu (poslední kus kroku 7 — trvalá hlavička + záložky + jedna
   tabulka akcí místo plochého výpisu sekcí). Rozdělena na 5 slice; slice 1
   (trvalá hlavička) hotová — viz níž. Groundwork k tabulce akcí:

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

   Zatím ne: samotná tabulka akcí (UI/rozvržení záložek), a — samostatně,
   otázka pro krok 9 zaznamenaná v D86 — pool definitions (max použití,
   obnova) pro `consumes` cíle, které v těchto čtyřech souborech strukturovaně
   vůbec nejsou.
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
  nesmazal, protože jsou to soubory ze session před zavedením toho
  postupu): `scripts/summarize-xmm-beasts.js`,
  `scripts/summarize-beast-display-shapes.js`,
  `scripts/investigate-wild-shape-rules.js`,
  `scripts/investigate-pact-of-the-chain.js`.
- Netrackované (nikdy commitnuté) soubory čekající na smazání:
  `src/featureResolver/surveyRefResolution.test.ts`,
  `scripts/survey-ref-resolution.txt`.

## Next step

Krok 7 zbývá dokončit přestavbou sheetu. Trvalá hlavička (jméno, AC,
iniciativa, rychlost, proficiency bonus, životy) je hotová (slice 1).
Zbývá: pět záložek (Akce · Vlastnosti a hody · Kouzla · Inventář ·
Schopnosti a rysy) a jedna tabulka akcí pro útoky, kouzla s hodem/savem
i použitelné schopnosti (identifikace přes `isActionTableFeature`, D86).
Rozvržení je hotové rozhodnutí (Danielův mockup), zadání dalších slice se
teprve píše.

Než se začne krok 7a (kouzla z rasy) nebo pickery tří podtříd (Storm
Herald, The Genie, Divine Soul), potřebují rozhodnutí — viz QUESTIONS.md.
