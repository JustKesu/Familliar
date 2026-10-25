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
