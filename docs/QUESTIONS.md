# Questions

Things not yet decided. An entry leaves this file only by being decided,
at which point it moves to DECISIONS.md.

---

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

