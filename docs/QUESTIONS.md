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

### Browser verification by the agent — deferred, revisit at build order step 9

The app is currently verified by hand: the user runs `npm run dev` and
clicks through the UI. Automated tests cover pure logic and, since the
wizard was built, component behaviour through a simulated DOM (see D8,
"Tests — static HTML for the renderer, a real DOM for interactive
components"). Nothing verifies the app as it actually renders in a real
browser.

The option considered was connecting Claude Code to a real browser
through the Playwright MCP server, letting it navigate to the dev
server, click through a flow and assert on what it finds. Deliberately
NOT set up, for cost reasons: each look at a page returns the full
accessibility tree, which is expensive in context, and a session that
clicks through the whole creation wizard would spend a large share of
its budget on that alone.

Decision for now: manual verification by the user continues. Revisited
at build order step 5 as planned and deferred again — the sheet is
mostly a display of numbers the calculation layer already has tests
for, so a browser check would cost context without catching much.
Revisit at build order step 9 (play tracking and rests), where state
changes through clicking and a wrong click is not visible in a unit
test. If adopted, it should be used for narrow, named checks ("spend a
spell slot, take a long rest, assert the slot is back"), not
open-ended "click around and tell me if it looks right".

### Fighting Style — ověřit detekci v reálné hře

Slice 1 detekuje nárok na Fighting Style podle jména class feature
"Fighting Style" v class-features.json, ne podle seznamu tříd.
Až bude build order krok 3 hotový celý, projít Fightera, Paladina,
Rangera (a College of Swords barda, viz D12) a ověřit, že se volba
nabídne přesně tam, kde má, a nikde jinde.
STATUS: k ověření po dokončení kroku 3.

### Weapon Mastery — Paladin, Ranger, Rogue nepodporovaní

Pět tříd má feature "Weapon Mastery", ale jen Barbarian a Fighter
mají počet v tabulce. U Paladina, Rangera a Roguea je počet jen v
próze feature, takže picker jim nic nenabídne. Rozhodnout, jestli
prózu parsovat, nebo počty ručně namapovat.
STATUS: nerozhodnuto.

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

### Migrace uložených postav — zatím se neřeší, odmítá se

Schema se od začátku verzuje (D1) právě proto, aby šla stará uložená
postava převést na nový tvar místo zahození. Zatím se to tak ale
nedělá: bumpy v1 -> v2 i v2 -> v3 starou postavu odmítly. Bylo to
vědomé — nikdo ještě nehraje, žádná postava k záchraně neexistuje.
Jakmile se s appkou začne opravdu hrát, tohle přestane platit a další
bump už migraci napsat MUSÍ. Rozhodnout nejpozději před prvním
skutečným použitím u stolu.
STATUS: nerozhodnuto, blokuje reálné použití.

### College of Swords — FS:B nabízí všech 10 stylů

D12 říká, že sufix :B v kódu FS:B omezuje volbu na podmnožinu stylů
(próza subclassy zmiňuje Dueling a Two-Weapon Fighting). Samotný kód
tu podmnožinu nenese — je jen v textu. Picker proto nabízí všech 10
fighting stylů a omezení neřeší; ruční mapování jmen z prózy je přesně
ten rostoucí seznam výjimek, kterému se D21 vyhýbá. Rozhodnout, jestli
to stačí, až se s appkou začne hrát.
STATUS: nerozhodnuto, nízká priorita.

### Extra Attack — počet je ve jméně feature, ne v datech

Fighter má v tabulce sloupce Second Wind a Weapon Mastery s čísly, ale
Extra Attack tam sloupec NEMÁ. Počet útoků je schovaný ve jméně
feature: "Extra Attack" (lvl 5), "Two Extra Attacks" (11),
"Three Extra Attacks" (20). Jak se ta feature jmenuje u ostatních tříd
(Barbarian, Paladin, Ranger, Monk) nikdo neověřil.

Před implementací jde ověřovací skript: projít všechny třídy, najít
každou feature se jménem obsahujícím "Extra Attack", vypsat přesná
jména a úrovně. Teprve pak se rozhodne, jestli mapovat jména na čísla
(krátká tabulka) nebo parsovat text (křehké).

Patří ke kroku 7 (útoky) — bez zbraní není co počítat.
STATUS: nerozhodnuto, ověřit před krokem 7.


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

### Class feature choices (step 6a) — open scope

Which selectable "choose N from a list" class/subclass features step 6a covers beyond Warlock Invocations and Fighter Maneuvers is not yet inventoried (a full pass over class/subclass features is needed). It is also undecided how far to model the subset that changes a calculated value — which invocations/maneuvers actually alter a computed number, and whether all are feasible to model — versus showing them as text only. To be resolved when step 6a is scoped, after step 6 is complete.

### Výběr dovednosti u featu se nemá kam uložit

5 featů (Keen Mind, Observant, Prodigy, Squat Nimbleness, Skill
Expert) nechává hráče vybrat dovednost; wizard umí uložit jen výběr
vlastnosti. Zatím se hlásí jako "čeká na volbu" (D58). Rozhodnout,
jestli přidat pole a picker, nebo to nechat.
STATUS: nerozhodnuto.

### Missing subclass feature descriptions

Missing subclass feature descriptions. Some subclasses render a named feature with "text not found" instead of its description — e.g. Sorcerer Divine Soul's "Divine Magic" and "Favored by the Gods". The feature resolver (src/featureResolver/) correctly shows a D43-style "not found" note rather than crashing, but it is not yet established whether the target text is genuinely absent from this app's extracted data (a source-filtering gap needing re-extraction) or present but not matched by the resolver's join (fixable like the 26/94 classSource fallback, D27). To investigate and resolve separately from step 6 — likely alongside step 6a (class feature choices) or as a standalone data-quality fix. Not blocking: the character is still creatable.