# REPORT — P-TGS2-4: inventura kouzel, ki, Channel Divinity a 2014 pojmů v TGS2

HEAD 69f698b (ověřeno po `git merge --ff-only`). Jen průzkum: nový `scripts/investigate-tgs2-4.js` (režimy `sentences|feature|subclass|shapes|cd|markup|targets|monkdc`, čte extrahovaná data v `data/`), tento report. Testy/e2e nespuštěny (kód beze změny). Subagent nepoužit.

## 1. Kouzla z prózy (dnes 0 z prvků; jen Spelldrinker `prepared` a Rocborne `known` na podtřídě)
Cesty v app: `additionalSpells` se čte jen na PODTŘÍDĚ (`extractSubclassAlwaysPreparedSpells`, subclassPreparedSpells.ts:528 → `collectFixedGrants` :417). Obal: `will` :389, `daily{1}` :391/`parseDailySubkey` :349 (1×/LR), `ritual` :396, `resource{N}`+`resourceName` :398 (utrácí existující pool, freeCastResources.ts:107; ki→Focus Point přes RESOURCE_NAME_ALIASES, resources.ts:77). Vzory v data/: Monk Shadow|XPHB `innate.resource{1}` Focus Point, Sun Soul|XGE `innate.resource{2}` Ki, Wild Heart|XPHB `innate.ritual`, Psi Warrior|XPHB `innate.daily{1}`, 12 podtříd `known` bare. Sdílení počítadla s existujícím trackerem: `SHARED_OWNERS`, freeCastResources.ts:27.
| prvek (podtř., úr.) | věta | kouzlo / jak | cesta → doporučení | míst |
|---|---|---|---|---|
| Spirit Hand (Aether 3) | "you learn the mage hand cantrip, which you can cast … as a bonus action" | mage hand, známý cantrip | `known{"3"}` bare; BA jen text | 2 |
| Spectral Guide (Aether 6) | "spend 2 ki points to cast either the gentle repose or see invisibility spell" | 2 Focus | `innate{"6":{resource:{"2":[…]}}}`, `resourceName:"Focus Point"` | 2 |
| Spectral Guide (Aether 6) | "You also gain the spare the dying cantrip" | cantrip | `known{"6"}` bare | 1 |
| Sight Beyond Sight (Aether 17) | "you can use an action to cast the etherealness spell … can't use it again until … Long Rest" | 1×/LR | `innate.daily{1}` + SHARED_OWNERS "Way of the Aether"→"Sight Beyond Sight" (už pool z TGS2-3; jinak 2 počítadla) | 3 |
| Bird Caller (Steel Hawk 3) | "cast the animal messenger spell, but only as a ritual" | jen rituál | `innate{"3":{ritual:[…]}}`; omezení na létající bestii jen text | 2 |
| Planar Conspirator (Infernal 10) | "spend 2 Hit Dice, without regaining any hit points, to cast the detect thoughts spell" | stojí Hit Dice | **no path** (Hit Dice v `play.spentHitDice`, `resource` utrácí jen `play.resourceUses`) → nechat prózu, nebo nový `SpellUsage` ~8 míst | 0/8 |
| Incinerating Wrath (Infernal 14) | "use your reaction … duplicating the effect of the hellish rebuke spell (3rd-level version…)" | reakce, není seslání | no path (bare grant = slotové seslání, chybně) → próza | 0 |
| Bloodbound (Grim Surgeon 17) | "under the effect of the dominate beast or dominate person spell" | efekt, ne seslání | próza (pool už z TGS2-3) | 0 |
Mimo: Shrewd Consumer ("whenever you cast a spell that consumes…") a Oath Spells/Rocborne Magic (už v `additionalSpells`) — nic.

## 2. Ki (jen Aether; 6 vět)
| prvek | věta | změna při ki→Focus | míst |
|---|---|---|---|
| Way of the Aether (h1) | "aligning the ki and aether within themselves" | jen text (flavor) — doporučuji nechat | 0–1 |
| Spectral Guide | "spend 2 ki points to cast …" | text + cena čitelná app (bod 1, `resourceName`) | 1 (+2 z b.1) |
| Spectral Guide | "when you harness your ki" | jen text | 1 |
| Spectral Guide / Dismiss Undead | "Wisdom saving throw against your ki save DC" | text: XPHB Monk's Focus "The save DC equals 8 plus your Wisdom modifier and Proficiency Bonus" (pojmenované DC v XPHB není) | 1 |
| Ghost Walker / Etherstep | "spend 1 ki point as a bonus action to turn invisible" | text; `consumes:{name:"Focus Point"}` by app četla (resources.ts:450, featureActionRowData.ts:67), ale řádek pak utrácí Focus místo vlastních použití Phase → doporučuji jen text | 1 |
| Ghost Walker / Etherstep | "spend an extra ki point as part of your Step of the Wind" | jen text | 1 |
Mechanismus pro všechny textové výměny: tabulka vět v extract-data.js jako `HOMEBREW_REST_FEATURES` (:102, uplatněno :1516).

## 3. Oath of the Spelldrinker — Channel Divinity
- Homebrew: 1 záznam "Channel Divinity" (L3, header 2), možnosti jako vnořené `entries` "Absorb Magic" (reakce, ruší kouzlo ≤ ⌈(1+lvl)/3⌉, max 6; temp HP = CHA + 5×úr.) a "Expeditious Command" (BA, CHA-mod tvorů Dash/Disengage). Žádné `consumes`.
- XGE/TCE vzor: rodič "Channel Divinity" bez `consumes`, jen `refSubclassFeature` na samostatné záznamy možností, každá `consumes:{"name":"Channel Divinity"}` (XGE 4, TCE 2). XPHB: 5 prvků s `consumes:{"name":"Channel Divinity"}` přímo (Sacred Weapon, Nature's Wrath…).
- Pool: sloupec "Channel Divinity" v tabulce Paladin|XPHB → `tableGrantedPools` (resources.ts:461); spender přes `consumedPoolName` (resources.ts:94/450) a řádek akce `consumedResourceName` (featureActionRowData.ts:67); multiclass split `resourceKeyFor` (classPools.ts:11, D336).
- Chybí: `consumes` a samostatné záznamy možností. Varianta A (rozdělit jako XGE: 2 nové záznamy + 2 refy v rodiči, ids) ~6 míst; varianta B (`consumes` na rodiči, 1 řádek) ~3 místa. Riziko: e2e reviewFixesM10 počítá řádky "Channel Divinity".

## 4. 2014 pojmy
| prvek | věta | 2024 znění | míst |
|---|---|---|---|
| Infernal Warrior (Infernal 6) | "when you use the Attack action to grapple a creature … if your grapple check succeeds" + `{@action grapple}` (cíl v data/ neexistuje) | "when you use the Grapple option of your Unarmed Strike … if the target fails its saving throw" (`{@condition Grappled|XPHB}`; XPHB Unarmed Strike v data/ jako tag-cíl není, jen "Escape a Grapple|XPHB") | 1 |
| Shrewd Consumer (Mercantile 14) | "take the Use an Object action or drink a potion" | `{@action Utilize|XPHB}` (existuje) | 1 |
| Planar Conspirator (Infernal 10) | "spend 2 Hit Dice" | "Hit Point Dice" (+ "use an action to cast" → Magic action) | 1 |
| Medic (Grim Surgeon 3) | "Your proficiency bonus is doubled for any ability check … this skill" | = Expertise (2024); app expertise z prózy nečte — text | 1 |
| Eagle Eye (Steel Hawk 10) | "proficiency bonus is doubled for any Wisdom (Perception) check … relies on sight" | podmíněné, ne Expertise → nechat | 0 |
| Incinerating Wrath | "(3rd-level version…)" | "level 3 version" — kosmetika | 1 |
| Spectral Guide, Sight Beyond Sight, Planar Conspirator | "use an action to cast" | "take the Magic action to cast" — kosmetika | 3 |

## 5. Syrový markup
46 prvků + 2 druhy: neznámé tagy 0 (proti 47 jménům v src/markup/tags.ts), typy entries refSubclassFeature/entries/table/list — všechny v Markup.tsx, zbytky závorek 0. Jediné tagy bez cíle: `{@action grapple}` (Infernal Warrior), `{@action Use an Object}` (Shrewd Consumer) → řeší bod 4.

## 6. Návrh rozdělení TGS2-4
1. **TGS2-4a kouzla** (~10): `HOMEBREW_SUBCLASS_SPELLS` v extract-data.js (Aether: known 3/6, innate.resource{2} 6, innate.daily{1} 17; Steel Hawk innate.ritual 3) + slučování do `additionalSpells`, SHARED_OWNERS etherealness, DATA.md, STATUS.md, e2e Spells tab (USE řádek 2 FP, rituál, 1×/LR sdílený s trackerem).
2. **TGS2-4b Channel Divinity** (~6 A / ~3 B) + e2e utracení poolu, kontrola reviewFixesM10.
3. **TGS2-4c textové výměny** (~12): ki→Focus (5 vět), grapple, Utilize, Hit Point Dice, Medic, volitelně Magic action/level 3; tabulka vět v extract-data.js, DATA.md, e2e na text.
4. (volitelně, po rozhodnutí) detect thoughts za Hit Dice jako tlačítko (~8, nový druh ceny).

## Decisions taken / noticed
- Efekty "duplicating the effect of"/"under the effect of" (hellish rebuke, dominate) beru jako ne-seslání → próza.
- Ghost Walker: `consumes` nedoporučuji (přebil by vlastní počítadlo Phase).

## Open questions for the user
1. **Ki → Focus Points v textu:** pravidla 2024 říkají mnichovým bodům „Focus Points“, homebrew píše „ki“. Přepsat text (list mluví jednotně), nebo nechat původní znění? Cena 2 bodů u Spectral Guide se bude z poolu Focus odečítat v obou případech.
2. **Channel Divinity Spelldrinkera:** ukazovat dva řádky (Absorb Magic, Expeditious Command — každý ubere použití, jako oficiální přísahy), nebo jeden řádek „Channel Divinity“, který ubere použití a možnosti jsou jen v textu?
3. **Detect thoughts za 2 Hit Dice:** jen text (hráč si kostky odškrtne ručně), nebo tlačítko, které Hit Dice samo utratí (větší nová práce)?
4. **Grapple u Infernal Warrior:** přepsat na pravidla 2024 (úchop přes Unarmed Strike, cíl hází záchranný hod; oheň zraní, když hod nevyjde), nebo nechat 2014 „grapple check“ (u stolu nesedí s 2024 pravidly)?
5. **Kosmetika:** přepsat i „use an action“ → „Magic action“, „3rd-level“ → „level 3“ a Medic → „Expertise“, nebo jen věci, které mění hru (ki, grapple, Use an Object, Hit Dice)?

Manual browser check for the user: none - investigation only.
