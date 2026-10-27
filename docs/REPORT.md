# REPORT — F-Q: opravy z review Q (D408)

Setup: fetch, `merge --ff-only` (already up to date), `npm ci`, `e2e:install`; HEAD ba163db. Bez změny schématu.

## Změněná místa
- `src/inventory/inventoryData.ts` `splitOneOff` — oddělený kus bez `pactWeapon`; příznak zůstává na stohu (A, nález 1).
- `src/calculation/weaponAttacks.ts` — `canBePactWeapon` (melee vždy; ranged jen s IPW a jen Shortbow/Longbow/Light Crossbow/
  Heavy Crossbow podle jména); `computeWeaponAttacks` bere pact efekty jen pro takový řádek; `AttackDamage.rollNote` (B, D).
- `src/sheet/ManageInventoryPanel.tsx` — prop `improvedPactWeapon`, přepínač jen u `canBePactWeapon` (B, nález 2).
- `src/sheet/CharacterSheet.tsx` — předání IPW panelu; `weaponAttackRow` přidá k hodu damage `note` (B, D).
- `src/dice/RollHistory.tsx`, `src/dice/RollUi.tsx` — `RollReport.note`, zobrazený v toastu (`.roll-toast__note`) i historii (D, nález 3).
- `src/levelUp/levelGains.ts` `languagesStepGain` — část „Genie kind (not chosen yet)“, když držená Genie nemá `genieKind` (C).
- `src/creation/CharacterWizard.tsx` `genieOffered` — i při level upu, když uložená postava nemá `genieKind` (C, nález 5).
- `src/sheet/pactWeapon.ts` `withoutPactWeapon`; `src/storage/characterStore.ts` `buildCharacter` — bez Pact of the Blade se
  `pactWeapon` smaže ze všech řádků (E, bod d).
- Testy: weaponAttacks (+4), inventoryData (+1), characterStore (+3: odmítnutí `pactWeapon:false`/`genieKind:'dao'`, round-trip,
  E), wizardState (+1 setSubclass/genieKind), resources (+1 afterShortRest Dragonmark spell vs benefit), levelGains (+1).
- `e2e/reviewFixesQ.spec.ts` a, b1, b2, c, d, e (seed schema 68).
- Docs: D408 v DECISIONS.md, STATUS.md (dvě místa).

## Ověření
- typecheck OK; unit 190 souborů / 3492 testů OK; validate-data 177/177 OK.
- e2e nový soubor 6/6 OK (~28 s); celé e2e 749/749 OK za 6.6 min (nad cílem ~3 min, 2 workery).

## Rozhodnutí v kódu
- Při vybavení jedné dýky z označeného stohu 2 zůstává značka na stohu (nevybaveném), ne na kusu v ruce — přímý důsledek zadání A;
  hráč pak značku přesune přepínačem. `returnToStack` označený a neoznačený řádek nespojí (klíč obsahuje `pact`).
- Ranged pact weapon podle jména zbraně (`weapon.name`), takže pojmenované magické luky/kuše (jiné jméno) nejsou povoleny.
- E je v `buildCharacter` (jediná cesta create/update = wizard, Edit, level up, Remove level). Manage Extras invokace nemění,
  takže nic nepotřebuje. Nepokryto: ztráta Pact of the Blade odebráním vlastního předmětu, který invokaci uděluje (zápis přes
  inventářové metody, ne `buildCharacter`) — značka pak zůstane, ale bez efektu.
- Lifedrinker poznámka jde do nového pole `RollReport.note` (toast s detailem kostek `text` nezobrazuje).

## Subagent
Nepoužit.

## Změněné obrazovky
- Manage Inventory: přepínač Pact weapon chybí u střelných zbraní bez IPW / mimo 4 povolené.
- Roll toast a Roll history: řádek „+ 1d6 Lifedrinker (roll separately)“ (bez nového CSS, `.roll-toast__note`).
- Level up Proficiencies: volba Genie Kind pro starou Genie postavu.

## Manual browser check for the user
Žádná — vzhled kontroluje plánovací chat ze screenshotů.
