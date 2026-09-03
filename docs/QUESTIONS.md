# Questions

Things not yet decided. An entry leaves this file only by being decided,
at which point it moves to DECISIONS.md.

---

### Fluff / lore text

Species and spell descriptive text and images live in separate
fluff-*.json files, matched to entries by name, and are currently NOT
extracted (DATA.md). Decide whether the sheet needs it. Leaning: not
needed for phase 1, mechanical text is enough.
STATUS: undecided.

### Magic Initiate parent entry

`_versions` expansion keeps the generic parent feat selectable next to
its three class variants, matching 5etools. For a character sheet the
generic one is probably not a valid pick. Decide whether to hide parents
that have variants.
STATUS: undecided.

### Where data lives at deployment

Currently data/ is tracked in git and would deploy with the app.
Options if that becomes a licensing concern:
1. Public repo (current default) — simplest, works for everyone.
   MIT covers 5etools' code, not the content itself (WotC).
2. Private repo + Vercel/Netlify — data not publicly downloadable.
3. Each user uploads their own JSON files, stored in the browser.
Revisit before first deployment to a URL.
STATUS: deferred.

### EFA background count — worth verifying

EFA contributes 17 backgrounds, more than XPHB's 16. Surprising for a
single-class book. Not blocking; sanity-check against the book sometime.

### Fighting Style — ověřit detekci v reálné hře

Slice 1 detekuje nárok na Fighting Style podle jména class feature
"Fighting Style" v class-features.json, ne podle seznamu tříd.
Až bude build order krok 3 hotový celý, projít Fightera, Paladina,
Rangera (a College of Swords barda, viz D12) a ověřit, že se volba
nabídne přesně tam, kde má, a nikde jinde.
STATUS: k ověření po dokončení kroku 3.

### Mastery rule text je hardcodovaný

masteryData.ts obsahuje ručně opsaných 8 popisů (Cleave, Sap, Topple…),
protože data/items.json nese jen jméno mastery, ne text. Text existuje
v data-source/. Rozhodnout, jestli rozšířit extract-data.js a hardcode
nahradit.
STATUS: nerozhodnuto.

### D22 — formát uložení úrovně u volby

D22 říká, že každá uložená volba nese úroveň, na které byla vzata.
Zatím to neimplementuje nic — classSkills, masteries, fightingStyle
ani subclass úroveň nenesou. Formát se rozhodne jednou pro všechny
volby naráz, až začne level-up (build order krok 8), ne po jedné.
STATUS: odloženo do kroku 8.

### College of Swords — FS:B nabízí všech 10 stylů

D12 říká, že sufix :B v kódu FS:B omezuje volbu na podmnožinu stylů
(próza subclassy zmiňuje Dueling a Two-Weapon Fighting). Samotný kód
tu podmnožinu nenese — je jen v textu. Picker proto nabízí všech 10
fighting stylů a omezení neřeší; ruční mapování jmen z prózy je přesně
ten rostoucí seznam výjimek, kterému se D21 vyhýbá. Rozhodnout, jestli
to stačí, až se s appkou začne hrát.
STATUS: nerozhodnuto, nízká priorita.

### Koncentrace — výhoda na CON save

Screenshot z DnD Beyond ukazuje u savů poznámku "Advantage on CON to
maintain Concentration", která tam je kvůli featu. SPEC má koncentraci
jen jako play tracking (co postava zrovna drží), ne jako modifikátor
savu.

Souvisí s otázkou o featech výše — až se rozhodne, jak se featy
aplikují, rozhodne se i tohle.
STATUS: nerozhodnuto.

### Nevyřešený odkaz uvnitř textu — jak ho zobrazit

Dnes se rozbalí všech 420, takže otázka není akutní. Ale kdyby nějaká
budoucí kniha přinesla odkaz bez cíle, resolver se bude muset
rozhodnout: vykreslit jen jméno jako plain text, nebo viditelnou
poznámku "text nenalezen" (D43)? Rozhodnout, až bude resolver existovat.
STATUS: nerozhodnuto, nízká priorita.

### Volba velikosti chybí ve wizardu

23 species nabízí Small nebo Medium a wizard se na to neptá, takže
velikost u nich zůstává "neznámo" (D54). Krok wizardu na to zatím
v build orderu není. Rozhodnout, kam patří — nejspíš do species
kroku, vedle species skillů.
STATUS: nerozhodnuto, blokuje zobrazení velikosti na sheetu.

### ASI vzatý dřív v téže session se nezapočítá do prerekvizit

Prerekvizity featů se posuzují proti finálním hodnotám vlastností
z kalkulační vrstvy. Ta ale ASI vybraný o pár úrovní dřív v témže
průchodu wizardem zatím nenese. Postava, která si na úrovni 4 zvedne
STR z 13 na 15, se proto na úrovni 8 tváří pořád jako STR 13 a feat
vyžadující 15 jí wizard nenabídne.
Po uložení a znovunačtení je to v pořádku — problém je jen uvnitř
jednoho průchodu. Rozhodnout, jestli to řešit hned, nebo až s level-upem
(krok 8).
STATUS: nerozhodnuto.

### Výběr dovednosti u featu se nemá kam uložit

5 featů (Keen Mind, Observant, Prodigy, Squat Nimbleness, Skill
Expert) nechává hráče vybrat dovednost; wizard umí uložit jen výběr
vlastnosti. Zatím se hlásí jako "čeká na volbu" (D58). Rozhodnout,
jestli přidat pole a picker, nebo to nechat.
STATUS: nerozhodnuto.

### Warlock The Genie — deferred

Warlock The Genie — deferred. The Genie patron's bonus spells are stored as four separate per-genie-kind entries (Dao, Djinni, Efreeti, Marid), and the app has nowhere to record which kind a character chose, so none of them resolve. Implementing it needs a stored genie-kind choice (a subclass-flavour choice, a shape the app doesn't otherwise have). Deliberately skipped while closing step 6. Not blocking: the patron is selectable, it simply grants no bonus spells.

### Boon of Siberys — deferred

Boon of Siberys — deferred. This epic boon (level 19) offers a choice among 13 named alternatives (the 12 Eberron marks plus a Sorcerer option), a picker shape not built. It is currently HIDDEN from the feat list rather than shown broken. Deliberately skipped while closing step 6, along with other level 19/20 content.

### Eberron marks are unreachable in character creation

Eberron marks are unreachable in character creation. All 12 "Mark of ..." feats require the Eberron campaign setting, and the app does not track campaign settings, so they are greyed out and cannot be taken. Their spell handling (fixed grants and expanded pool-widening) is fully implemented but only reachable by importing a character that already has a mark. Undecided: whether to make the marks selectable without campaign-setting tracking, or leave them unreachable until settings are modelled.

### Two spells referenced but absent from the data

Two spells referenced but absent from the data. Two spells granted by other content (e.g. Branding Smite via a Warlock patron) are not present in this app's extracted spell data, so they are silently skipped where granted. Undecided whether this is a source-filtering gap needing re-extraction. Not blocking.

### Storm Herald — volba prostředí je jen v próze

Barbarian/Storm Herald si na 3. úrovni volí Desert, Sea nebo Tundra a ta
volba pak určuje chování features na 6. a 14. úrovni. V datech ale není
strukturovaná — `options` uzel u Storm Aura nenese `count`, volba je
popsaná jen v textu. Podle D21 se tedy zobrazí jako text a appka ji
neřídí, takže si hráč musí prostředí pamatovat sám a sheet o něm neví.

Zjištěno při stavbě pickerů pro Divine Order / Primal Order / Elemental
Fury. Souvisí: `count` je spolehlivý pozitivní signál (kde je, je volba),
ale jeho absence volbu nevylučuje — u Storm Heralda dává falešně
negativní výsledek.

Rozhodnout, jestli ručně namapovat tři prostředí (výjimka proti D21),
nebo nechat na hráči.
STATUS: nerozhodnuto.

### Invokace a features měnící útok — zkontrolovat při krocích 7 a 8

Improved Pact Weapon dává +1 k útoku i k damage, Lifedrinker přidává
damage, Thirsting Blade dává útok navíc, Eldritch Smite je zvláštní
útok. Nic z toho se dnes nepočítá, protože útoky zbraněmi v appce
neexistují.

Až se budou stavět, musí projít i vybrané class-level optional features,
ne jen zbraň, feat a fighting style. Platí tu stejný princip jako
u prózových featů (D55): co se neumí spočítat, musí se aspoň ohlásit
v rozkladu, aby si to hráč přičetl sám a věděl proč.

Nalezeno při ručním proklikání Warlocka (Hexblade, Improved Pact Weapon).
STATUS: nerozhodnuto, řešit v kroku 7/8.

### Armor of Vulnerability nemá v datech 2024 AC

V edici 2024 přišel o `ac`, `baseItem`, `strength`, `stealth` i `weight` —
z jedenácti polí zbylo šest. Bez `baseItem` je nemá odkud zdědit.

Vypadá to, že v edici 2024 to není samostatný předmět, ale obecná varianta
z `magicvariants.json`, a ten soubor extrakce schválně nerozbaluje (fáze 2).
Dopsat mu AC ručně by znamenalo hádat, jaká zbroj to vlastně je — a to je
přesně to, co D80 zakazuje.

Zatím to drží D43: zbroj bez AC se vykreslí viditelně jako nekompletní, ne
tiše špatně. Rozhodnout, až se bude řešit rozbalování variant.

Nalezeno při porovnání předmětů edic 2014 a 2024 (Cowork, průzkum).
STATUS: nerozhodnuto, čeká na fázi 2.

### Osm magických hudebních nástrojů přišlo o `type: "INS"`

`Instrument of Illusions`, `Instrument of Scribing`, `Instrument of the Bards`
a jeho tři varianty, `Pipes of Haunting`, `Pipes of the Sewers`.

Picker nástrojových zdatností filtruje strukturálně přes `type === "INS"`
a zároveň přes `rarity === "none"`. Ta druhá podmínka je právě teď jediné, co
těch osm drží mimo seznam — funguje to, ale náhodou, ne záměrem. Kdyby filtr
podle vzácnosti někdy odpadl, propadne osm magických nástrojů mezi obyčejné.

Není to chyba, kterou by dnes hráč viděl. Je to ztracená druhá vrstva ochrany,
na kterou jsme nespoléhali schválně.

Nalezeno při porovnání předmětů edic 2014 a 2024 (Cowork, průzkum).
STATUS: nerozhodnuto, nespěchá.

### Kouzla z rasy nikam nevedou

V `src/spells/` je modul pro kouzla ze třídy, z podtřídy, z featu i z optional
feature. **Pro rasu žádný není.** Dvacet devět ras nese v `additionalSpells`
kouzla a na sheet nedoručí nic — ani je nezobrazí, ani neřekne, že něco chybí.

Prakticky: Elf přichází o cantrip z linie a o kouzla na 3. a 5. úrovni, stejně
tak Tiefling; Gnome o cantripy a o Speak with Animals u Forest Gnoma.

Není to únik ani spolknutá volba, je to chybějící cesta — na rozdíl od
odolností a velikosti, které nevyřešenou volbu hlásí nahlas. Chce to vlastní
slici, postavenou podle vzoru těch čtyř modulů, které už existují.

Nalezeno při průzkumu kódu wizardu (Cowork, 3. 9.), potvrzeno v reportu ze
slice na rasové volby.
STATUS: rozhodnuto že se udělá, čeká na zadání.

### Tlačítko Delete v dočasném seznamu postav jde přes `confirm()`

`confirm()` je vyskakovací okno prohlížeče „opravdu to chceš smazat?". Když
appku ovládá skript místo člověka — což dělá každý úkol, který si ověřuje
změny v prohlížeči — prohlížeč takové okno sám zavře jako by se kliklo na Ne.
Smazání se tedy nikdy neprovede.

Důsledek: každý úkol, který si vyrobí testovací postavu, ji musí uklízet
zápisem přímo do úložiště prohlížeče, ne tlačítkem. Stalo se to už čtyřikrát.

Až se ten dočasný seznam postav bude nahrazovat pořádným, potvrzení má být
prvek uvnitř appky, ne `confirm()`.

STATUS: nerozhodnuto, spolu s náhradou dočasného seznamu.

### Bonus ke kouzlům se přičítá všem kouzlům, i když ho předmět váže na jednu třídu

Rod of the Pact Keeper mluví o warlockových kouzlech, Arcane Grimoire o svých,
Moon Sickle o druidských. To omezení je ale jen v próze (D21), takže appka
`bonusSpellAttack` a `bonusSpellSaveDc` přičte ke každému sesílání, které
postava má — třídnímu i z featu.

Dnes to skoro nevadí: takový předmět si postava jiné třídy obvykle nevezme,
a i kdyby, naladění se podle podmínky ve slovech nevynucuje (D78). Vadit to
začne u multiclass postavy v kroku 10, kde Warlock/Wizard dostane warlockův
bonus i na wizardí kouzla.

Bonus je vlastní pojmenovaný řádek v rozkladu, takže hráč aspoň vidí, co si má
odmyslet. Rozhodnout, až se bude řešit multiclass.

Nalezeno ve slice 7h.
STATUS: nerozhodnuto, spolu s krokem 10.

### `bonusWeaponDamage` nečte nikdo

Nese ho jediný předmět — Bracers of Archery (+2) — a nezapadá nikam: do cesty
pro zbraně ze slice 7e ne, protože je to nošený předmět bez `bonusWeapon`, a
mezi šest polí ze slice 7h taky ne, protože je to poškození zbraně.

Přičíst ho naplocho by bylo špatně: platí jen pro luky a kuše, a to omezení je
v próze. Chce to podmíněné bonusy, které v appce zatím neexistují.

Pro lučištníka je to běžný předmět, takže to není akademická díra.

Nalezeno ve slice 7h.
STATUS: nerozhodnuto, čeká na podmíněné bonusy.
