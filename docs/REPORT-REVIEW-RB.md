# REPORT-REVIEW — RB (893c437 RB-1, 68285e8 RB-2)

Setup: `git fetch`, `git merge --ff-only origin/main` → „Already up to date“, HEAD `68285e8`. Jen čtení kódu, žádný npm skript nespuštěn.

## Nálezy

1. **medium** — src/languages/FeatureLanguageSlots.tsx:58, src/creation/wizardState.ts:993. Počet Hellborn slotů počítá „známé“ jen z Common + creation (+ fixed v UI), ne z picků jiných feature grantů; `taken` je ale vyřadí z nabídky.
   Scénář: Barbarian 3 Infernal + Rogue 3 Mastermind, creation Infernal, Master of Intrigue vybral Abyssal → Hellborn slot bez jediné volby, `isStepComplete` chce 1 pick → Next zablokovaný navždy. Sheet (proficiencies.ts:263, `otherKnown` = všechny ostatní jazyky) přitom nic nečeká — nekonzistence.
   Oprava: v obou místech brát jako known i `featureLanguages` ostatních grantů (v komponentě `taken` minus vlastní picky).
2. **medium** — src/masteries/MasteryPicker.tsx:116. Uložená mastery mimo nový pool (Longbow/Pistol u Barbariana, Staff, Wooden Staff, Psychic Blade u kohokoli) se v pickeru nevykreslí, ale počítá se do `value.length`.
   Scénář: Barbarian 2 uložený před RB-2 s Greataxe + Longbow → Edit: Longbow neviditelná, `remaining = 0`, ostatní volby disabled, Longbow nejde odznačit ani vyměnit; Next projde (kontrola jen počtem, wizardState.ts:235), uloží se beze změny, sheet Longbow dál ukazuje. Tiché, ne blokující.
   Oprava: hodnoty mimo pool vykreslit jako vybrané s poznámkou „no longer eligible“, aby šly odebrat.
3. **low** — src/creation/wizardState.ts:1520. `setSubclass` maže jen zdroje z `classSubclassGrantSources` (SUBCLASS_SKILL_GRANTS), ne podtřídní řádky CLASS_FEATURE_LANGUAGE_GRANTS (Hellborn, Mastermind, Banneret).
   Scénář: Edit Barbarian 3 Infernal (Hellborn Abyssal) → přepnutí na Berserker ve stejném běhu → Abyssal zůstává v `data.featureLanguages`, je v `taken` ostatních slotů; při návratu na Infernal se pick vrátí. Uložení ho zahodí (wizardState.ts:1731). Předexistující vzor (Mastermind), RB-1 rozšířil.
   Oprava: přidat do `ownSources` i `grantedBy` jazykových grantů s `subclass` dané třídy.
4. **low** — src/classSkills/SkillChoiceSlots.tsx:62. Held dovednosti se vyřazují jen v okamžiku výběru; College of Lore (18 dovedností) to zviditelňuje. Pick, který se později stane duplicitou (návrat na Background/Class skills v Edit), se tiše „promrhá“ — dvojí započtení nehrozí (proficiency je bool), ale chybí upozornění. Předexistující pro všechny D177 granty. Oprava později: v `isStepComplete` nebo ve slotu označit pick držený jinde.
5. **low** — src/sheet/classSaveAdvantages.ts:26. Gate `classSource === 'XPHB'` vynechá PHB-2014 Barbariana (Danger Sense existuje i tam); D395 to vědomě omezuje na XPHB, homebrew podtřídy (TGS2) tabulka nezná. Card i drawer čtou tutéž proměnnou `traitSaveAdvantages` (CharacterSheet.tsx:2370) → konzistentní.

Ověřeno bez nálezu: (1) kroky 64→65→66 jen značí, `canMigrateToCurrent` vede 64 na 66, validate.ts:218/:251–253 přijímá všechny 4 nové hodnoty. (2) Remove level 3→2 maže `primalKnowledge` (levelRemoval.ts:244, filtr bez podtřídy); změna třídy v běhu maže všechny picky (wizardState.ts:1377); uložení zahodí osiřelý pick (`keepHeldSubclassSkills`, :1737); sheet počítá jen picky platných grantů (`subclassSkillGrantsGiving` přes `subclassSkillGrantsFor`); Barbarian jako druhá třída projde `classes.some`. (3) `picks <= count` UI nepřekročí; starý pick při obou známých: slot zůstane (`max(…, picks.length)`), krok projde. (4) Lore nenabízí held ani vlastní ostatní sloty. (5) `className` parametr v multiclassu správně. (7) RB-2 3451/3451 zahrnuje migrations.test.ts → pokryto.

E2E mezery (8): Remove level 3→2 u Primal Knowledge; změna podtřídy Berserker↔Infernal v Edit (PK zůstane, Hellborn zmizí); Barbarian jako druhá třída; nález 1 (multiclass s jiným jazykovým pickem); nález 2 (uložená vyřazená mastery v Edit); Fey Wanderer Edit.

## Známé body

| Bod | Verdikt | Proč |
|---|---|---|
| a) starý Hellborn pick zůstává | keep | neškodí, krok nezablokuje, hráč ho může změnit |
| b) levelGains hlásí 1 jazyk i při obou známých | fix later | jen text shrnutí; jednořádkově přes `featureLanguageSlotCount` |
| c) Psychic Blade pryč i pro Soulknife | keep | dle vlastní poznámky se mastery nevybírá |
| d) Rage řádek trvale s „while raging“ | keep | stav raging se nesleduje, vzor Shell Defense |
| e) Zealous Presence, Fortifying Soul vynechány | keep | D395, výhoda pro jiné tvory |
| f) Rocborne jen text | keep | žádný kód, nulové riziko |
| g) Rage damage/odolnosti/STR skills nepočítány | fix later | samostatná funkce (stav rage), mimo RB |

## Otázky pro uživatele

1. Nález 1 a 2 opravit hned (malý slice), nebo se zbytkem později?
2. Uložená vyřazená mastery (nález 2): zobrazit k odebrání, nebo při načtení tiše zahodit s poznámkou?
3. Má D395 platit i pro PHB-2014 třídy (Rage/Danger Sense u PHB Barbariana)?

## Subagent use

Nepoužit.
