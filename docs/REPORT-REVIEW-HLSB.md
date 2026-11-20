# R-HLSB — review bloků HL a SB

HEAD při review: 293fe91 (fetch + ff-merge bez změny). Jen čtení kódu (Read/Grep), žádné npm skripty, žádný subagent.
Prošlo: D417–D425, migrations.ts 68→72, validate.ts (spellbooks, fightingStyles, attackAbility), manageSpellsData.ts,
wizardBookPicks.ts, wizardSpellbook.ts, wizardState.ts (seed knihy, spellbooksAfterRun), levelRemoval.ts (kniha, Savant,
Mastery, styl boje), CharacterSheet.tsx (fill efekt, bookPickGrants, managedClasses), CharacterManager.tsx, weaponAttacks.ts.

## Nálezy

1. **medium** — `src/creation/wizardState.ts:1716` (+ seed `:758`). `spellbooksAfterRun` bere Savant picky z `data.subclass` /
   `data.subclassSpellChoices`, tj. z AKTIVNÍ třídy běhu. Seed knihy (`:758`) se ale plní vždy, takže level up nebo Edit
   ne-Wizard třídy u multiclass postavy projde `prunedBookPicks` s `inBook` bez Savant kouzel. Scénář: Wizard 18 Evoker /
   Fighter 1, Mastery na Savant kouzle (Magic Missile), level up Fightera → Mastery tiše zmizí (dialog nic neukáže).
   Oprava: když aktivní třída není Wizard, vrátit `existing?.spellbooks` beze změny; jinak brát Savant z
   `savantSpellsOf(existing.subclassSpellChoices, 'Wizard', 'XPHB', wizard.subclass)` sloučené s picky běhu. Přidat test.
2. **low** — `src/levelUp/levelRemoval.ts:233-283`. `lostBookKeys` (zápisy s origin `level` k) odpřipraví pick, i když
   kouzlo v knize zůstává přes Savant pick (D424 říká, že Savant kouzlo je v knize). Opačný směr (`savantLossUnprepares`)
   stored knihu kontroluje, tenhle ne. Scénář: Abjurer zapsal Shield na úrovni 3 a zároveň ho má jako Savant pick; Remove
   level 3 → Shield odpřipraven, přestože je v knize. Oprava: z `lostBookKeys` pro filtr `spellChoices` vyřadit klíče z
   `savantSpellsOf(subclassSpellChoices, …)` po odebrání.
3. **low** — nekonzistentní `savantSpellsOf`: karta (`CharacterSheet.tsx:2298`, `:2825`) filtruje podle aktuální
   podtřídy, `spellbookFill` (`manageSpellsData.ts:117`) a `levelRemoval.ts:253,262` ne. Záznam Savant z předchozí podtřídy
   (import, starší data) by fill i Remove level braly jako „v knize“, karta ne → kouzlo bez `migrated` zápisu, ale
   připravené. Dnes je to dosažitelné jen importem (změna podtřídy picky maže). Oprava: posílat `subclass` všude.
4. **low** — `src/levelUp/levelRemoval.ts:144-154`. Odebrání stylu Blessed/Druidic Warrior zahodí i jeho
   `filterChoiceSpells`, ale dialog jmenuje jen „Fighting style: X“ a cantripy nejdou do `droppedSpells`. Oprava: přidat
   `Fighting style cantrip: <jméno>` do `dropped` (stejně jako Savant/Mastery).
5. **low** — `src/storage/validate.ts:755-795`. Validátor přijme dvě položky `spellbooks` pro Wizard|XPHB i duplicitní
   kouzla. `spellbookSpellsOf` čte první, `withSpellbookSpells` nahradí jen první a druhou nechá → duplikát přežívá každý
   zápis. Jen import ručně upraveného JSON. Oprava: odmítnout druhého vlastníka jako u `fightingStyles` (`:447`).
6. **low (dead/dup)** — `src/spells/wizardBookPicks.ts:104` `dropped.length > 0` je kumulativní přes všechny knihy; s jednou
   knihou (D422) nevadí, při víc knihách by přepsal i knihu beze změny. Stačí lokální příznak. Bez dopadu dnes.

Fokusové body bez nálezu:
- (1) Migrace 68→69→70→71→72 jsou jen přeznačení, řetěz souvislý (`migrations.ts:623-646`); validace přijímá
  `attackAbility: 'charisma'`, `fightingStyles[].filterChoiceSpells`, `spellbooks` vč. `mastery`/`signature` (max 2) a
  `toCharacter`/`toCharacterSpellbooks` je přenáší → round-trip export/import drží. Starší verze nemají nová pole → nic
  platného se neodmítne. Prázdné `spells: []` z importu projde a zůstane (neškodné, `setSpellbooks` ho zahodí).
- (2) Fill efekt (`CharacterSheet.tsx:1967-1979`): smyčka nehrozí (po úspěšném zápisu `spellbookFill` vrací null, odmítnutý
  zápis drží ref). `setSpellbooks` čte `list()` čerstvě a mění jen `spellbooks` (`spellChoices` nepředává) → nepřepíše HP
  z `withMaxHpFollow` (ten čte `latest` v `.then`). Ne-Wizard a PHB'14 Wizard vyřazuje `hasSpellbook`; multiclass Wizard
  jde po záznamech `spellChoices` Wizarda, OK.
- (4) `assignSpellbookOrigins` greedy (nejvyšší úroveň kouzla ↔ nejvyšší úroveň Wizarda) je správný (monotónní limit);
  ověřeno ručně pro L=1 (6×1), 2 (2,2→max1), 5 (max 3/2/2/1), 17 a 20 (max 9). Infeasible → `reason` blokuje Next
  (`wizardState.ts:1071`) a `resolveSpellbookEntries` navíc hází. Multiclass vstup do Wizarda: levelUp k=1 → 6 zápisů, max 1.
- (5) Limit: Savant pick po Prepare = obyčejný pick, počítá se 1×; Mastery/Signature jsou v `classGrantInfo` → pick je
  `alsoGranted` a nepočítá se (0×, správně, je vždy připravený); class granty beze změny.
- (6) Pact weapon: volba STR/DEX(/obě u Finesse či Monk)/CHA, výchozí nejvyšší se shodou STR>DEX>CHA; zdatnost jen s platnou
  značkou; ztráta Pact of the Blade maže značku při uložení (`characterStore.ts:464`), ztráta Improved Pact Weapon ruší
  ranged značku (`canBePactWeapon`); uložená `charisma` bez značky se ignoruje. OK.
- (7) Cantripy stylu na položce `fightingStyles` per třída; Remove level je odebere se stylem (viz nález 4).

## Známé body

| | Verdikt | Proč |
|---|---|---|
| a) kniha zůstane po Edit mimo Wizarda | keep | Kniha je předmět; při návratu do Wizarda se znovu nasadí (seed `:758`), validátor ji dovoluje. Totéž po Remove level poslední úrovně (copied/migrated zůstanou). |
| b) export před prvním otevřením karty bez knihy | fix later | Týká se jen postav < schéma 71 (nové dostanou `level` při uložení); import + otevření karty knihu doplní. |
| c) Savant kouzla vypadnou z prepared | keep (otázka 1) | Je to D424(6); auto-prepare by mohl přetéct limit. |
| d) Lay on Hands ±1 | fix later | Fond až 100; ±5 nebo číselné pole zvlášť. |
| e) Signature label | keep | Konzistentní se vzorem D190/D193. |
| f) Monk pact weapon STR/DEX/CHA | keep | Všechny tři jsou podle pravidel platné (Martial Arts + Pact). |
| g) změna stylu maže cantripy | keep | D419; cantripy patří stylu. |
| h) lint `spellsTabData.ts:229` rules-of-hooks | fix later | Pre-existing; samostatný malý úkol, porušení hooků může způsobit chybu stavu, nečekat dlouho. |
| i) e2e 9–15 min | fix later | Rozdělit/shardovat; teď neblokuje. |

## Otázky pro uživatele

1. **Savant kouzla u existujících postav.** U stolu: Wizard Evoker, který měl Savant kouzla vždy připravená, je po
   aktualizaci najednou nemá připravená a musí si je v Manage Spells připravit znovu.
   Možnosti: (A) nechat (hráč si je připraví sám, jak říká D424); (B) jednorázově je připravit, pokud se vejdou do limitu;
   (C) ukázat na kartě upozornění „Savant spells are no longer auto-prepared“.
2. **Multiclass Wizard a úroveň kouzel do knihy.** U stolu: Cleric 5 / Wizard 1 má sloty 3. úrovně, ale appka mu dovolí
   zapsat do knihy jen kouzla 1. úrovně (počítá podle úrovně Wizarda).
   Možnosti: (A) nechat podle úrovně Wizarda (jako by byl jen Wizard — dnešní stav); (B) podle slotů celé postavy.
3. **Lay on Hands ovládání.** U stolu: Paladin 20 má fond 100 a léčení za 20 bodů znamená 20 kliknutí.
   Možnosti: (A) nechat ±1; (B) přidat tlačítka ±5; (C) číselné pole „utratit N“.
4. **Nález 1 (multiclass ztráta Mastery).** U stolu: Wizard 18 s jinou třídou přijde při level upu té druhé třídy o Spell
   Mastery na Savant kouzle. Možnosti: (A) opravit hned malým úkolem; (B) později, scénář je vzácný (Wizard 18+ multiclass).
