# Questions

Things not yet decided. An entry leaves this file only by being decided,
at which point it moves to DECISIONS.md.

---

### Magic Initiate parent entry

`_versions` expansion keeps the generic parent feat selectable next to
its three class variants, matching 5etools. For a character sheet the
generic one is probably not a valid pick. Decide whether to hide parents
that have variants.
STATUS: Daniel 25. 10.: plánovací chat ověří, jestli se obecný feat ještě nabízí.

### Warlock The Genie — deferred

Warlock The Genie — deferred. The Genie patron's bonus spells are stored as four separate per-genie-kind entries (Dao, Djinni, Efreeti, Marid), and the app has nowhere to record which kind a character chose, so none of them resolve. Implementing it needs a stored genie-kind choice (a subclass-flavour choice, a shape the app doesn't otherwise have). Deliberately skipped while closing step 6. Not blocking: the patron is selectable, it simply grants no bonus spells.
STATUS: Daniel 25. 10.: řešit, task naplánován.

### Two spells referenced but absent from the data

Two spells referenced but absent from the data. Two spells granted by other content (e.g. Branding Smite via a Warlock patron) are not present in this app's extracted spell data, so they are silently skipped where granted. Undecided whether this is a source-filtering gap needing re-extraction. Not blocking.
STATUS: Daniel 25. 10.: řešit, task naplánován.

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
STATUS: Daniel 25. 10.: řešit, task naplánován. Thirsting Blade je hotový (D363); zbývá Improved Pact Weapon a Lifedrinker.

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
STATUS: hotovo z většiny — granty a zobrazení (D89) i uložená volba sesílací
vlastnosti (D90) jsou hotové. Zbývá jen volba cantripu ze seznamu třídy u 5
záznamů, viz níže.

### Pět rasových záznamů nabízí volbu cantripu ze seznamu třídy — bez pickeru

Elf (základ) + Elf; High Elf Lineage, Khoravar, Kobold (základ) + Kobold;
Draconic Sorcery nesou pod `additionalSpells.known` `choose`-FILTR
("level=0|class=Wizard") místo jmenovaného kouzla — hráč si má vybrat
cantrip ze seznamu dané třídy, a appka na to nemá ani uložené pole, ani
picker. Na rozdíl od volby sesílací vlastnosti (D90), pro kterou už teď
existuje D57/D82 vzor, tenhle tvar volby appka zatím nikde jinde neřeší.
Dnes se u kouzel jen ukáže jedna viditelná řádka, že appka tohle zatím
neumí (raceSpells.ts, `deferredChoiceNote`).

Není bojově relevantní — je to bonusový cantrip, ne útok/DC.
STATUS: Daniel 25. 10.: řešit, task naplánován.

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
STATUS: Daniel 25. 10.: řešit, task naplánován.

### `bonusWeaponDamage` nečte nikdo

Nese ho jediný předmět — Bracers of Archery (+2) — a nezapadá nikam: do cesty
pro zbraně ze slice 7e ne, protože je to nošený předmět bez `bonusWeapon`, a
mezi šest polí ze slice 7h taky ne, protože je to poškození zbraně.

Přičíst ho naplocho by bylo špatně: platí jen pro luky a kuše, a to omezení je
v próze. Chce to podmíněné bonusy, které v appce zatím neexistují.

Pro lučištníka je to běžný předmět, takže to není akademická díra.

Nalezeno ve slice 7h.
STATUS: Daniel 25. 10.: řešit, task naplánován.

### Boon of Fortitude — jednorázových +40 na úrovni 19

Tenhle epic boon maximum hit pointů skutečně zvyšuje: o 40, jednou. Není to
falešný zásah jako Arcane Ward nebo Preserve Life (viz investigaci v D93) —
je to reálný bonus a appka ho nepočítá.

Ze slice 8a je vynechaný vědomě, ze dvou důvodů: je JEDNORÁZOVÝ, takže do
tabulky tří položek za úroveň nepatří tvarem, a sedí na úrovni 19, kterou
appka jinak nedotahuje — stejný důvod, pro který je schovaný Boon of Siberys
(krok 6).

Kdyby se měl doplnit, je to čtvrtá položka tabulky s `perLevel: 0` a
`flat: 40`, plus rozhodnutí, jestli se epic boony vůbec nabízejí.

Nalezeno ve slice 8a.
STATUS: Daniel 25. 10.: řešit, task naplánován.

### Aberrant Dragonmark, Natural Recovery, Magic Item Tinker — dva nezávislé limity v jedné featuře

D119/D120: tyhle tři featury nesou v jednom datovém záznamu dva nezávislé
rest limity (např. Natural Recovery: bezplatné seslání kouzla Kruhu na
Long Rest + zvlášť obnova slotů). Jeden max-1 tracker by je tiše slil,
takže zůstávají v `TWO_INDEPENDENT_LIMITS` bez trackeru vůbec. Řešení
by znamenalo umět modelovat víc než jeden Uses zdroj na jednu featuru —
appka to dnes neumí nikde. Rozhodnout, až se na to dojde (možná víc
featur má stejný tvar, mezi zbylými ~48 se to nekontrolovalo).
STATUS: Daniel 25. 10.: řešit, task naplánován.
