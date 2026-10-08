# Review M10 (fb9d5e5..9e39254: b3a8999 M10a, 5c97021 M10b, 9e39254 M10b follow-up)

Jen čtení kódu a diffu, nic nespuštěno. Měřítko: D335, D336.

## Nálezy

1. **Vysoká (existovalo už před M10, mimo scope M10) — level up může zapsat `abilityBonus: {}` a postava pak nejde načíst.**
   `src/creation/wizardState.ts:696` seeduje `backgroundChoice.abilityBonus: character.abilityBonus ?? {}`, `:1593` ho při save zapíše tak, jak je, a `src/storage/validate.ts:337` prázdnou mapu odmítne („must have exactly 2 abilities … got 0“), přitom chybějící pole (`:311`) přijme. Edit to zastaví, protože krok Background vyžaduje neprázdnou mapu (`:917`); level up krok Background neprochází, takže save projde. Tvorba v appce `abilityBonus` vždycky zapíše, takže se to týká postav uložených bez něj (starší savy, import, ručně psaná data), ne nových. Pak je to ale ztráta dat: postavu po level upu nejde otevřít.
   Oprava: v `saveCharacter` zapsat `abilityBonus` jen když je neprázdný, jinak `existing?.abilityBonus`. Chybí test: level up postavy bez `abilityBonus` → výsledek projde `describeCharacterError`. Třídní skilly a fighting style z fixture h jsem neověřil (viz Nezrevidováno).

2. **Střední/riziko — nová volba dostane „nejnižší volné místo“, i když ho už drží stará volba bez razítka.**
   `wizardState.ts:1884-1897` (`keepHeldClassLevels`): místo zabírají jen volby s `level`. Ze starých savů zůstávají volby bez razítka a ty žádné místo nedrží. Nová volba třídy proto dostane nejnižší úroveň grantu (např. Rogue 1), i když místo z Rogue 1 drží stará volba bez razítka a ve skutečnosti je volné až místo z Rogue 6. Remove level úrovně Rogue 6 pak novou volbu nenajde. D335 („první dosud neobsazené místo“) neříká, jestli volba bez razítka místo zabírá → otázka pro Daniela.
   Oprava (pokud ano): před přidělením odečíst z `free` tolik nejnižších slotů, kolik má třída ponechaných voleb bez razítka. Chybí test: třída s jednou ponechanou volbou bez razítka + jedna nová volba.

3. **Nízká — vlastníky voleb a požadované počty načítají dva oddělené loady.**
   Vlastníky voleb se nasadí z `lookups.heldClasses` (`CharacterWizard.tsx:357-358`, chyba → `.catch(() => null)` → třída nemá grant). Požadované počty bere `heldData` (`:738-739`). Když selže jen první load, uložené volby třídy nemají vlastníka a picker je skryje (`otherExpertise`). `heldPickConditions` ale chce plný počet → uživatel musí vybrat N dalších a save uloží víc Expertise, než třída dává.
   Oprava: při chybě grantu brát podmínky třídy jako neznámé (nebo Edit zablokovat). Chybí test.

4. **Nízká — `owners` si drží jména odebraných voleb.**
   `heldClassPicks.ts:99` záznamy jen přidává. Přidání a odebrání téže volby tak nechá navíc záznam v `pickOwners` a `sameWizardData` (`wizardState.ts:1131`, `pickOwners` je ve `shared`) vrátí false → Cancel se zbytečně ptá. Data neohrožuje.
   Oprava: ve `withOwnedPicks` mazat záznamy jmen, která nejsou v `names` ani v `seeded`. Chybí test `sameWizardData` po přidání a odebrání.

5. **Nízká (data, ne regrese) — Psionic Energy Die u Psi Warrior + Soulknife se nerozdělí.**
   `resources.ts` `poolGrantingClasses` hledá jen v tabulkách. Soulknife má sloupec „Soulknife Energy Die Number“ (DATA.md:557), takže granting třída je jen Fighter. Rysy Soulknife pak utrácí Fighterův pool s Fighterovým maximem. D336 říká „obecně“ → stojí za záznam v QUESTIONS.md.

6. **Chybějící testy pro rozhodnutá pravidla:**
   - Remove level u legacy savu s prostým klíčem na rozděleném poolu (cesta `withLegacyPoolUses(..., false)` → clamp → výpis dropped).
   - Level up legacy savu, který už pool rozdělený má (`poolUsesAfterSplit` musí prostý klíč nechat).
   - Guided Strike (Cleric War + Paladin Conquest): dva řádky, dva pooly.
   - `MasteryPicker excluded`: zbraň jiné třídy se nenabízí.
   - `resourceUsesAfterLevelUp` u jednotřídního level upu (beze změny).

## Verdikty a–j

a) **ok.** `assignHeldPicks` přesně odpovídá D335: razítko vyhrává, když třída dané úrovně volbu dává. Jinak volba připadne první granting třídě v pořadí `levelOrder`, která jméno povoluje a má volné místo, pak první granting třídě a nakonec žádné třídě. Volby s razítkem nad počet třídy zůstanou té třídě a Review hlásí „remove N“, což je správně.

b) **riziko.** Pravidlo je implementované, ale volby bez razítka místo nezabírají (nález 2). Pro savy, kde jsou všechny volby orazítkované, je ok.

c) **ok.** Brání duplicitě ve společném poolu masteries (D329). Skryje i volby bez vlastníka a ty projdou save beze změny.

d) **ok.** Neaktivní třídy dostávají `heldPickConditions` v obou větvích (`CharacterWizard.tsx:1648-1658`). Save je blokovaný, dokud `heldData` není načtené (`editMulticlassPicksComplete`, `:771-773`). Výjimky: třída, které selhal load `heldData`, se neptá na nic (politika D333), a nález 3.

e) **ok.** Jiné klíče `resourceUses` ve tvaru „X (Y)“ nejsou (free-cast používá `spell:…`). Kód klíč nikdy neparsuje, pracuje s poli `pool`/`className`. Kolize by nastala jen u zdroje, který by se v datech doslova jmenoval „Channel Divinity (Cleric)“, a takový není.

f) **ok.** Export a import přenesou prostý klíč beze změny a validate přijme libovolný string. Level up: `poolUsesAfterSplit` při dvou držitelích přeskočí, takže prostý klíč zůstane pro handover v sheetu. Edit nechá `play` beze změny. Remove level dělá vlastní handover. Spend i Short Rest zapisují `storedResourceUses` už po handoveru (`CharacterSheet.tsx:2505, 2516`). Chybí jen testy (nález 6).

g) **ok s aktuálními daty.** Podle DATA.md:543 žádný feat ani optional feature Channel Divinity neutrácí. Kdyby nějaký začal, utrácel by prostý klíč, který u rozděleného poolu nemá maximum, takže by počítadlo nefungovalo. Riziko jen pro budoucí data.

h) **bug, existoval už před M10.** Nejde jen o neúplnou fixture. Cesta: `wizardState.ts:696 → 1593 → validate.ts:337`. Postava bez `abilityBonus` (validní při čtení) se level upem stane nečitelnou. Postava vytvořená v appce se k tomu nedostane, starší nebo importovaná ano (nález 1).

i) **ok.** Mazání klíče třídy pod úrovní poolu výslovně rozhoduje D336 bod 5. Unclaimed klíče jiných zdrojů (9b1) zůstávají. Klíč „(Paladin)“ by mohl přežít jen z ručně upravených nebo importovaných dat; pak by znovuzískaná úroveň nezačala s plným poolem (`poolUsesAfterSplit` existující klíč nové třídy nesmaže). Zanedbatelné.

j) **ok.** XPHB Cleric i Paladin (Channel Divinity) shodně vracejí při Short Rest jedno použití. Short Rest se počítá z rysů filtrovaných podle `className` (`resources.ts`, větev `granters.length > 1`). Paladinův pool existuje až od Paladin 3, kdy už má i svůj rys. Pokrývá to e2e M10b c.

Jednotřídní postavy: beze změny. `wizardDataFromCharacter` vrací data před `pickOwners` (`wizardState.ts:741`), `activeClassPicks` vrací celý seznam, `resourceKeyFor` bez `pool` vrací klíč beze změny. `gone` v levelRemoval bez `className` funguje jako dřív. `resourceUsesAfterLevelUp` běží i u jednotřídního level upu, ale klíče nemění (jen prázdné `{}` se zahodí).

## Nezrevidováno

- Těla e2e scénářů a unit testů. Viděl jsem jen jejich názvy a diff `levelRemoval.test.tsx`.
- Požadovaný počet masteries aktivní třídy v multiclass Editu (`classPickShape.requirements.masteryCount` po odstranění `countOffset`, vliv featů).
- Další části bodu h: zápis třídních skillů a fighting style Paladina při level upu.
- Jak Remove level zachází s razítky Expertise a masteries po M10a (mimo `resourceUses`).
- `featSource` a `rest.ts` (beze změny, nečteno).
