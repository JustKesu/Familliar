# M5a — vybraná kouzla po třídách, limity po třídách (D325, schéma zůstává 59)

## Co se změnilo
- `SpellList.tsx`: `SheetSpellEntry` + `chosenBy`, `rowKey`, `subclassOwners` (vše volitelné, `chosen` zůstává).
  `combineSpellEntries` bere `className/classSource` ze `spellChoices` a ze skupin podtříd; kouzlo vybrané 2 třídami =
  2 záznamy (druhý jen s pickem, `rowKey` = `name|SRC|Class|Src`); granty se slévají do řádku první vybírající třídy.
  `spellEntryKey()` = klíč řádku pro Spells i Actions. `provenanceLabel(entry, multiclass)` → „player pick (Class)“.
- `casterFor`: pick → spellcasting entry své třídy (bez entry a víc tříd → vlastní důvod); grant podtřídy → třída
  vlastnící podtřídu (`subclassOwners`, sloučeno s D192 `classOrigins`). Fallback „could belong to more than one casting
  class“ zůstává jen pro ne-pick zdroje (optional feature v multiclassu). `spellActionRows`: v multiclassu `origin` = třída.
- Nový `sheet/classSpellLimits.ts`: `classSpellLimits` počítá každou třídu samostatně (`computeSpellSlots/Counts` nad
  postavou s jedinou třídou) → vlastní cap, počty, důvod; `chosenSpellCap` pro `spellsTabActionSections`
  (nový parametr `unavailableAboveFor`, `unavailableAboveLevel` zůstal). Jedna třída: všechny picky patří jí (beze změny).
- `CharacterSheet.tsx`: plošný multiclass `spellLimitReason` smazán; notice po třídách, v multiclassu
  „Sorcerer cantrips: 5 known, 4 allowed.“ / „Sorcerer spells prepared: …“. `spellSubtitle(row, castingClassName, multiclass)`.
- Manage Spells beze změny — už filtroval podle vlastního `SpellSlotsEntry` třídy (krok 1 inventury, STOP nenastal).

## Ověřeno
- typecheck, test (3102), validate-data (175), e2e (443, 4,5 min — nad 3 min) — vše zelené.
- Unit `classSpellLimits.test.ts`: split Detect Magic Wizard/Cleric (DC 13/12), Warlock/Sorcerer Hold Person dva řádky,
  subclass grant → vlastník, merge grantu do řádku pickující třídy, limity Warlock 6 (3) / Sorcerer 3 (2), neznámá třída.
- E2E `multiclassSpells.spec.ts` a–e (zadání a–e).
- Upravený existující test: `CharacterSheet.test.tsx` „says the limit cannot be determined for a multiclass character“ →
  „D325: … reason of the class that chose the spell only“ — testoval přesně smazané chování. Jednotřídní testy beze změny.

## Odchylky a rozhodnutí
- E2E skóre INT 15 / WIS 12 (standardArray jako `multiclassSlots.spec.ts`) místo INT 16 / WIS 14; DC 13 vs 12.
- Kouzlo vybrané třídou A a zároveň always-prepared třídy B → jeden řádek, čísla třídy A (pick vyhrává).
- Druhá vybírající třída nedostane granty (USE řádky) — ty zůstávají na řádku první.
- Starší zmínky „multiclass = nejde zjistit“ v historických záznamech STATUS.md (ř. ~174, ~472–483) nechány.

## Rozhodnutí pro uživatele
- Žádné otevřené. M5b (volba poolu u CAST, upcast do pact) zbývá.

## Manual browser check for the user
Na https://familliar.vercel.app, 1366 i 1920, tmavý i světlý režim, postava Wizard 3 / Cleric 3 s Hold Person u obou:
- Spells tab: dva řádky Hold Person pod sebou — podtitul „Wizard“ / „Cleric“ se nezalamuje divně, DC buňka zarovnaná.
- Rozbalený řádek: „player pick (Wizard)“ čitelné, nepřetéká.
- Actions tab: dva řádky Hold Person, „· Wizard“ / „· Cleric“ v podtitulu se vejde.
- Warlock 6 / Sorcerer 3 s 5 cantripy Sorcereru: notice „Sorcerer cantrips: …“ vzhled a zalomení.
