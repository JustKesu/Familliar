# Report — M2: záchrany a zdatnosti multiclass postavy (schéma zůstává 59)

## STEP 1 — data a inventura
- `scripts/investigate-multiclass-profs.js` (po pushi smazán): `proficienciesGained` sedí přesně na očekávaný seznam (tabulka v DATA.md). Odchylky bez vlivu: Monk/Sorcerer/Wizard MAJÍ klíč `multiclassing`, jen bez `proficienciesGained`; Bard `toolProficiencies: [{"anyMusicalInstrument": 1}]` je volba (ne `{name: true}`) — podle rozhodnutí 2 se přeskočí (čtou se jen hodnoty `true`). `armor[0]` je string, tool entry `{"tinker's tools": true}`.
- Čtenáři: `savingThrows.ts` (iteroval všechny třídy), `proficiencies.ts` (classes[0]), `weaponProficiency.ts` `weaponProficiencyGrantsFor` (startovní zbraně VŠECH tříd), `classToolChoices.ts` `classToolGrantsFor` (classes[0]), sheet `ClassToolSlots` (classes[0]), `ManageFeatsPanel` ctx prerekvizit (sjednocení startovní zbroje/zbraní všech tříd). Drawery Saving throws a Proficiencies čtou stejné výsledky jako karty. Single-class/neměněné: wizard, levelGains, masteryData (picker jedné třídy).

## Co se změnilo
- `firstClass(character)` v `calculation/characterLevel.ts`: třída z `levelOrder[0]`, jinak `classes[0]`.
- `computeSavingThrow`: třídní záchrany jen z první třídy; rysy (Disciplined Survivor, Slippery Mind, Unfettered Mind), Aura of Protection, featy a předměty beze změny.
- Nový `calculation/classProficiencies.ts` `classProficiencyGrants`: první třída startovní zbroj+zbraně (zdroj „<Třída>“), ostatní třídy pevná zbroj/zbraně/`toolProficiencies` z `proficienciesGained` (zdroj „<Třída> (multiclass)“, kind 'class'). Čtou ho `computeProficiencies` (karta + drawer), `weaponProficiencyGrantsFor` (útoky) a ctx prerekvizit Manage Feats (armor tokeny, čisté kategorie zbraní).
- Startovní nástroje/volby a nástroje podtřídy jen z první třídy (`classToolGrantsFor([firstClass])` v computeProficiencies i v sheet ClassToolSlots).
- Import cyklus `weaponProficiency.ts` ↔ `classProficiencies.ts` (jen funkce, za běhu bez problému).
- Testy: `characterLevel.test.ts` (firstClass ×3), `savingThrows.test.ts` (Warlock 6/Sorcerer 3 oběma pořadími), nový `classProficiencies.test.ts` nad reálným classes.json (Fighter/Wizard oběma pořadími, Rogue druhý, útok vs karta Wizard+Rogue, single class). Přepsán `weaponProficiency.test.ts` „multiclass gets the union“ (testoval starý výklad D11) na D321.
- e2e nový `multiclassProficiencies.spec.ts`: M2 a (Saving Throws karta WIS/CHA proficient, ostatní none; drawer obsahuje „proficiency (Warlock)“, žádné „Sorcerer“), M2 b (karta Medium armor, Shields, Martial weapons, bez Heavy; drawer „Martial weapons — Fighter (multiclass)“; Longsword to hit +4).
- Docs: D321 (DECISIONS, zpřesňuje D11), DATA.md tabulka proficienciesGained, STATUS (M2 + krok 10 „in progress“).

## Ověřeno
- typecheck OK; `npm test` 167 souborů / 3071 testů OK; validate-data 174/174; e2e plný běh 432 passed (4,9 min — nad 3 min limitem z CLAUDE.md).

## K rozhodnutí
- Rozhodnuto při práci: ctx prerekvizit featů v Manage Feats přepojen na `classProficiencyGrants` (zadání chtělo všechny čtenáře startovních zdatností přes jeden zdroj); Wizard 1/Barbarian 1 už nesplní „Medium armor“ prerekvizitu (Barbarian multiclass dává jen shield). Uvedeno v D321.
- Wizard ASI krok (`featAsiLevels.ts`) dál čte jen startovní zdatnosti editované třídy — single class (D316), netýká se.

## Manual browser check for the user
Žádná — rozvržení se nezměnilo; nové jsou jen texty zdrojů („<Třída> (multiclass)“) v drawer Proficiencies (záložka listu, karta Proficiencies → ozubené kolo).
