# REPORT — F-14: wizard odebere picky, které podtřída dává jako always prepared (D339)

## Inventura
- Načtení: `CharacterWizard.tsx` efekt nad `loadSubclassAlwaysPreparedSpells` (deps `classChoice`, `subclass`, `spellSlotsClassData`) → `subclassAlwaysPrepared`; chyba → `subclassAlwaysPreparedError`.
- Počítadlo: `ClassSpellsManager` → `preparedSpellRows` + `pickCounts` (`sheet/manageSpellsData.ts`, F-7b `alsoGranted`). Validace: `isCompleteSpellChoices` (`wizardState.ts`) počítá všechny `data.spellChoices`.
- `data.spellChoices` drží jen aktivní třídu (level up: `ofActive`; multiclass Edit: ostatní třídy v `otherClasses`), takže odebrání z nich nikdy nesahá na pick jiné třídy.
- Toky: tvorba 3+ (Spells je za Class; překryv jen přes Back), jednotřídní level up, multiclass level up, multiclass Edit (přepnutí třídy změní `subclass` → efekt znovu), Edit se změnou podtřídy (`setSubclass` picky stejně maže, M9b). Oprava = 4 místa, bez změny schématu.

## Co se změnilo
- `src/creation/alwaysPreparedOverlap.ts`: `splitAlwaysPreparedPicks(picks, alwaysPrepared)` → `{ kept, removed }`, shoda jménem + zdrojem.
- `wizardState.ts`: akce `dropAlwaysPreparedPicks` (className, classSource, subclassName, alwaysPrepared). Ignoruje seznam pro jinou třídu/podtřídu; bez překryvu vrací tentýž stav. Odebrané zapisuje do `WizardControllerState.droppedAlwaysPrepared` (mimo `data`, neukládá se; `seed` ho vynuluje).
- `CharacterWizard.tsx`: dispatch jednou v `.then` úspěšného načtení (ne při loading/chybě/zrušení); nová poznámka nad `ClassSpellsManager` filtrovaná na aktivní třídu a podtřídu.
- `src/creation/DroppedAlwaysPreparedNote.tsx`: `<p class="manage-spells__empty dropped-always-prepared-note">`, text např. „Bless and Cure Wounds are always prepared by Life Domain and were removed from your picks.“
- Edit postavy, jejíž uložené picky už překryv mají, je při otevření taky odebere (stejný efekt); uložená data se mění až uložením Editu.
- `e2e/multiclassEndToEnd.spec.ts`: seed B vrácen (Cleric s Bless a Cure Wounds, Paladin se Shield of Faith); `walkLevelUp` má `dropped` (poznámka + žádné `Unprepare X`) a po vyplnění ověří povolený Next.
- `docs/DECISIONS.md` D339, `docs/STATUS.md` řádek F-14.

## Testy
- Unit: `alwaysPreparedOverlap.test.ts` (2), `wizardState.test.ts` „dropAlwaysPreparedPicks (D339)“ (4: překryv pryč vč. PHB Bless ponechané, pick Druida v `otherClasses` zůstává, prázdný/nepřekrývající/cizí třída/podtřída = tentýž stav, druhé načtení nic nemění).
- e2e `F-14 a`: seed Cleric 2 (Thaumaturge, 4 cantripy + Bless, Command, Cure Wounds, Healing Word, Sanctuary) → Cleric 2 → 3 Life Domain: poznámka, `Cantrips: 4/4`, `Prepared: 3/6` (Cleric tabulka prepared 6 na úrovni 3; 5 picků − 2 odebrané), doplnění, Next povolen, uloženo 10 picků bez Bless/Cure Wounds, na sheetu oba jednou v sekci 1st Level s „always prepared (Life Domain)“.
- e2e `F-14 b`: Cleric 2 → + Paladin 1 s Bless a Cure Wounds → Cleric 2 → 3 Life Domain: odebrány jen Clericovy, Paladin má dál `['Bless', 'Cure Wounds']`. Zadání chtělo Wizard 3, ale Wizard seznam XPHB nemá žádné z Life Domain kouzel (Aid, Bless, Cure Wounds, Lesser Restoration), proto Paladin.
- e2e c) v `M11a B`: Paladin 2 → 3 Oath of Devotion — poznámka ke Shield of Faith, `Prepared: 2/4` (Paladin prepared 4 na úrovni 3; Divine Favor + Heroism), Next povolen. Cleric 2 → 3 v B: `Prepared: 3/6`.
- `npm run typecheck` OK; `npm test` 3252 passed (177 souborů); `npm run e2e` 517 passed, 5,6 min (první běh: 1 fail ve vlastním testu F-14 a — sheet opakuje Bless jako upcast v 2nd Level, test zúžen na sekci 1st Level).

## Rozhodnutí během práce
- Poznámka se ukazuje jen pro aktuální třídu + podtřídu (po změně podtřídy stará poznámka zmizí).
- Řeší jen always-prepared podtřídy (D62), ne class always-prepared (D192) ani subclass filter-choice picky, které `pickCounts` taky vynechává (`alsoGranted`) — tam může stejný rozpor počítadla a Next zůstat; neověřeno.

## Manual browser check for the user
- Vzhled poznámky: importuj Cleric 2 se seedem jako `cleric2` v `e2e/multiclassEndToEnd.spec.ts` (nebo vlastní Cleric 2 s Bless a Cure Wounds) → Level up „Cleric 2 → 3“ → Life Domain → krok Spells: šedá poznámka nad sekcí Prepared Spells — velikost, zalomení na telefonu, odsazení od karty.
