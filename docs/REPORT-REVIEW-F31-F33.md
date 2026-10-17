# Review F-31 až F-33 (85b9730, 39ecb0e, cf2be0d, f2e8afe, c3b3ae3)

Setup: `git fetch`, `git merge --ff-only origin/main` → „Already up to date", HEAD `c3b3ae3`. Jen čtení diffů a kódu, žádné npm skripty. Subagent nepoužit.

## Nálezy (od nejzávažnějšího)

1. **Střední — guard 16 kouzel je kruhový.** `src/sheet/spellActionRowData.test.ts:270` porovnává `diceTags` s prózou podle téhož pravidla „hned za kostkou" (`\d+d\d+\s*(?:\+|plus)\s+your…`). Fráze odsunutá od kostky („{@dice 2d8} Hit Points plus your spellcasting ability modifier", „… Fire damage, plus your …") chybí v obou stranách a test projde. Podezřelá absence: Prayer of Healing (léčení s modifikátorem v PHB i XPHB) mezi 16 není. Oprava: v prózové straně guardu povolit `.{0,40}?` mezi kostkou a frází a rozdíl vypsat jako seznam vědomě vynechaných kouzel.
2. **Nízká — modifier se čte ze stringu breakdownu.** `spellActionRowData.ts:157` hledá řádek `` `${ability} modifier` `` z `computeAbilitySpellcasting` (`spellcasting.ts:199`). Všechny cesty (třída, feat, species, CharacterSheet.tsx:2433) jdou přes tuto funkci, multiclass bere caster na řádek → dnes správně; přejmenování řádku (např. „Wisdom modifier (Tome)") tiše dá null → všude „+ mod" a žádný test třídy to nechytí (unit test skládá breakdown ručně). Oprava: přidat `abilityModifier` do návratu `computeAbilitySpellcasting` a v `toCaster` číst pole.
3. **Nízká — R12 d nic netestuje.** `e2e/conditions.spec.ts:64-73`: seed nemá species, Speed je neznámá, `speedBefore === speedAfter` platí vždy; po D360 by s rasou musel selhat. Oprava: seed s Human XPHB, očekávat `20 ft`, přejmenovat („Exhaustion 2 … and −10 ft Speed").
4. **Nízká — `readableEntryError` i při načtení z localStorage.** `src/storage/characterStore.ts:138/155`: `readStoredEntry` slouží importu i čtení uložených dat (rozlišuje jen `dropMalformedFields`), takže chyba úložiště zní „could not be imported". Oprava: sloveso podle `dropMalformedFields` („could not be read").
5. **Nízká — `olderSubclass` skrývá podle jména.** `src/sheet/featuresTabData.ts:149`: každý subclass feature starší edice se jménem shodným s class feature se schová. U Conquest je to jen wrapper (možnosti jsou vlastní řádky), ale pravidlo platí plošně; feature se stejným jménem a vlastním textem by zmizel. Oprava: skrývat jen, když entries obsahují pouze refy (`refSubclassFeature`), jinak nechat.

Zkontrolováno bez nálezu: `SpellDamageLine` regex (`+ mod` → hod 0, U+2212 → záporný flat, „2d8 + 1d6" dál jen text); upcast přidává jen kostky, mod jednou (`leveledSpellDice`, unit + e2e F-33 a); předmět s pevným DC → `abilityModifier: null` (`itemSpellRows.ts:32`); `{{spellcasting_mod}}` včetně záporné a null varianty; `applyConditionSpeed` (exhaustion per mód, min 0, Speed 0 přebíjí bonusy i item módy, `formatSpeed` ukazuje 0); `featDisplayName` jen v zobrazení, pickerKey a klíče ze stored name; `skillLabel`, `subclassPickSource`, `spellNotes(withUsage)`, `damageText` (Unarmed Strike součet, min 0), `cantripDamage` EB/Magic Stone.

Testy: F-33 e2e a–d a unit testy by špatnou implementaci chytily (hodnoty `2d8 + 3`, toast `+ 3 =`, `+ 0` nepřítomno, upcast `2d8 + 3`); F-32b unit pokrývá fly/swim, bonus + Restrained, floor 0. Slabá místa jsou jen nálezy 1–3.

## Verdikty na známé body

1. aria-label „Remove <stored name>" (`ManageFeatsPanel.tsx:299`) — **opravit hned**: viditelný text „Magic Initiate (Cleric)" ≠ jméno tlačítka (label-in-name); `featDisplayName(instance.name)`, upravit e2e selektory.
2. Species „; " (Genasi) — **nechat** do samostatného úkolu, D-rozhodnutí o zobrazení species jmen neexistuje → viz otázka B.
3. Default Manage Extras jen při otevření — **nechat**; záměr (smazání familiara nepřepne tab), zapsán v kódu i REPORT F-32a.
4. Počet beamů EB v Notes — **nechat**, D206 (jen próza); případně až s Cantrip Upgrade parserem.
5. Mooncloak / Holy Star — **nechat**, D206 (kostky mimo `{@damage}`); detekce modifikátoru nevadí.
6. Green-Flame Blade pod 5. úrovní „0 fire damage" / „3" / „0" — **rozhodnutí uživatele** (otázka A).
7. R12 d — **opravit hned**, je horší než jen název (nález 3).

## Otázky pro uživatele

A. Green-Flame Blade na úrovni 1–4: (a) nechat „0 fire damage" + „3 fire damage to secondary creature"; (b) skrýt řádek s „0" a u druhého nechat číslo; (c) při mod 0 a dice 0 skrýt oba. Doporučuji (b): „0 damage" je šum, druhý řádek je správný.
B. Species se středníkem: (a) zavést `speciesDisplayName` stejně jako u featů („Genasi (Air)"); (b) nechat. Doporučuji (a) — jednotnost s F-31, levné.
C. Guard 16 kouzel (nález 1): (a) rozšířit průzkum na odsunutou frázi a výsledek zapsat do DATA.md; (b) nechat. Doporučuji (a) — jeden investigační běh rozhodne, zda D361 nepokrývá další léčení.
