# REPORT — R-Q: review PW-1 až GN-1

Setup: `git fetch origin`, `git merge --ff-only origin/main` → „Already up to date“, HEAD b048526. Subagent nepoužit. Žádné npm
skripty nespuštěny; kód čten přes Read/Grep a `git diff 7d65f31 b048526`. Přečteny REPORT.md všech 7 commitů a D401–D407.

## Nálezy

1. **`src/inventory/inventoryData.ts:564` (`splitOneOff`) + `src/sheet/pactWeapon.ts:23`** — **bug**.
   Rozdělení stohu kopíruje `...row` včetně `pactWeapon`, takže po vzetí jedné dýky ze stohu 2 označeného jako pact weapon
   nesou příznak OBA řádky. Hráč: dvě dýky v rukou, obě dostanou Improved Pact Weapon +1 i Lifedrinker, v Manage Inventory
   svítí „Pact weapon“ dvakrát; invariant „nejvýš jeden řádek“ z D401 neplatí. Oprava: `splitOneOff` nechá příznak jen na
   jednom řádku (smaže ho z odděleného kusu), nebo přepínač nabízet jen řádkům s `quantity === 1`.

2. **`src/sheet/ManageInventoryPanel.tsx:1132`** — **riziko**. Přepínač se ukáže u každé zbraně (`isWeapon`), i u luku/kuše.
   XPHB Pact of the Blade dovoluje jen melee zbraň; střelné povoluje až XGE Improved Pact Weapon. Hráč bez IPW si označí
   Longbow a dostane na něm Lifedrinker. Oprava: střelnou zbraň nabízet jen s IPW (nebo to ponechat a zapsat do D401).

3. **`src/sheet/CharacterSheet.tsx:389`** — **kosmetické**. Hod damage parsuje jen `damage.dice`; Lifedrinker 1d6 je jen v
   textu (`extraDamage`), tlačítko hodu ho nehodí ani nepřipomene. Hráč klikne na hod a 1d6 musí dohodit ručně. Oprava:
   v hlášení hodu připsat „+ 1d6 Lifedrinker (hoď zvlášť)“, nebo extra kostku hodit jako druhý řádek.

4. **`src/storage/validate.ts:924` a `:727`** — **riziko (nízké)**. `pactWeapon` ≠ `true` nebo neznámý `genieKind` odmítne
   celou postavu (Damaged karta) místo zahození pole. Shodné se vzorem `attuned`/`elegantCourtierSave`; aplikace sama
   `pactWeapon: false` nikdy nezapíše (ověřeno grepem: jen `togglePactWeapon` a `toCharacterInventory`). Týká se jen ručně
   upraveného souboru. Oprava: žádná, nebo později tolerantní zahození těchto dvou polí.

5. **`src/creation/CharacterWizard.tsx:1406`** — **riziko (neověřeno)**. Stará Genie postava (bez `genieKind`) se ke
   kouzlům dostane jen přes Edit; level up 3→4 volbu nenabízí (`held.subclass !== null`). Pokud je Edit pro postavu
   zablokovaný (`editCharacterBlockedReason`, např. multiclass bez historie úrovní), druh džina nejde zvolit vůbec a poznámka
   na Spells posílá do Edit, které nejde otevřít. Oprava: nabídnout volbu i při level upu, když `genieKind` chybí.

Bez nálezu (body zadání):
- Migrace 66→67→68 jen přeznačí; stará postava bez nových polí projde `describeCharacterError` i `toCharacter`, round-trip
  nese `pactWeapon` (`validate.ts:1156`) i `genieKind` (`:1653`). Falešná Damaged karta nevzniká.
- TL-1: Short Rest čte `shortRest` z `computeCharacterResources` — Dragonmark (spell) `'all'`, ostatní sub-limity `null`;
  `withFreeCastResources` ponechá záznam featury (shortRest se nepřepíše free-cast verzí). Staré holé klíče nechávají
  `resourceUsesWithinMaxima` i `afterShortRest` beze změny, `afterLongRest` je smaže; chyby nevznikají.
- GN-1: `setSubclass` maže druh jen u Warlocka, `saveCharacter` ukládá jen s `hasGenie`, Remove level maže při
  `subclass === null`; s1–s5 jen u záznamu se jménem zvoleného druhu, klíč „9“ `parsePactSlotRankKey` zahodí. Multiclass:
  `genieEntryFor` per třída, gate jen u právě editované třídy.
- PW-1/BA-1: IPW blokuje jen `magicBonus.carried`; Bracers (+2) a IPW (+1) se na označeném luku sčítají správně (Bracers
  nejsou bonus zbraně). Magický bonus nastavený hráčem Bracers neruší.
- IB-1/BF-1: `onlyForClasses` filtruje v jediné funkci, feat/species/item/subclass-only zdroje dostanou nic; multiclass per
  třída správně. `maxHpOverride` vrací hodnotu před bonusy, `includes` počítá Boon jednou — dvojí započtení nehrozí.
- SR-1: alias se čte až po neúspěšném přesném hledání, nemůže zastínit existující kouzlo; „summon elemental“ jen se zdrojem TCE.

6. **Chybějící testy** — **riziko**:
   - `splitOneOff` s `pactWeapon` (nález 1).
   - `validate.ts`: odmítnutí `pactWeapon: false` / `genieKind: "dao"` a round-trip obou polí (v diffu žádný validate test).
   - `wizardReducer` `setSubclass` mazání `genieKind` a `saveCharacter` bez Genie (wizardState.test.ts +1 řádek fixture).
   - `afterShortRest` s `Aberrant Dragonmark (spell)` vs `(benefit)` — unit ani e2e (twoLimits testuje jen Natural Recovery, obojí LR).
   - `weaponAttacks`: IPW + Lifedrinker zároveň, IPW + Bracers na Longbow, neattunovaná zbraň s vlastním bonusem (bod g).
   - Multiclass Warlock The Genie (level up i Edit) — genieKind.spec.ts a–f jsou jednotřídní.
   - GN-1 e2e běží 6.6 min (nad cílem ~3 min, uvedeno v jeho reportu).

## Verdikty známých bodů

- a) **keep** — stejný vzor jako Elegant Courtier, jedno kliknutí, Spells tab to vysvětluje (viz ale nález 5).
- b) **keep** — hodnoty se ve skutečnosti nezahazují, jen nic nečtou a smaže je nejbližší Long Rest; spojený počet nemá kam mapovat.
- c) **keep** — je to tentýž limit z textu featu, jeden čítač brání dvojímu evidování.
- d) **fix later** — bez efektu, ale po znovuzískání Pact of the Blade se tiše vrátí stará značka; úklid při odebrání je levný.
- e) **keep** — jména tříd jsou jednoznačná a aplikace pracuje s XPHB třídami.
- f) **keep** — shodné se všemi bonusy předmětů (D402); attunement prakticky znamená nošení.
- g) **keep** — doslovné čtení „magic weapon that already has a bonus“, vzácný případ, rozklad to vysvětluje.

## Otázky pro uživatele

1. Když označíš jako pact weapon hromádku dvou dýk a vezmeš jednu do každé ruky, mají obě dostat bonus? Navrhuju, aby
   značku nesla vždy jen jedna dýka (pravidla mluví o jedné pact weapon).
2. Má jít luk nebo kuše označit jako pact weapon i bez invokace Improved Pact Weapon? Podle pravidel 2024 ne.
