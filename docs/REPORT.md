# F-9 — opravy z review M2–M4 (schéma zůstává 59)

Commit i push proběhly (viz git log); nic nebylo odmítnuto.

## Co se změnilo / čím je to pokryto
- **3** `ManageFeatsPanel` bere podtřídu přes `firstClass` (nový export `heldToolsOf`). Test: `ManageFeatsPanel.test.ts` — Artificer (Alchemist) + Fighter (Battle Master), levelOrder začíná Fighterem → drží se jen nástroje Alchemisty.
- **4** `characterSpellSlotMaxima` unknown → důvod přes `UnresolvedValue` v sekci Spells (`sheet__spell-slots-unknown`) i v drawer Spell Slots; tlačítko „Spell Slots" se ukáže i při unknown. Test: `CharacterSheet.test.tsx` (Cleric 2 / Sorcerer 2, data bez Wizard XPHB; 1× důvod v sekci, žádné boxy, důvod i v drawer).
- **5** `CharacterSpellSlotMaxima.pactSlotLevel`; sheet čte odtud. Test: `spellSlots.test.ts` (Warlock 5 → 3, Wizard → 0).
- **6** `multiclassSlots.spec.ts`: odstraněn komentář i `maxHpOverride: 40`; spec prošel.
- **7** Nový e2e `F-9: Wizard 3 / Cleric 3 …` — drawer: „Multiclass Spellcaster (caster level 6)", „1st 4 · 2nd 3 · 3rd 3", bez sekcí Wizard/Cleric.
- **8** `spellSlots.test.ts`: Warlock + dvě Spellcasting třídy, Arcane Trickster (⌊4/3⌋), tři třídy, unknown (chybí Wizard XPHB; chybí třída). `validate-data.js`: kontrola řádků 1, 5, 19, 20 Wizarda XPHB proti tabulce multiclass (PASS).
- **9** `ManageFeatsPanel.test.ts`: Wizard 1 / Fighter 1 (Wizard první) → Heavily Armored ano (přes „Fighter (multiclass)"), Wizard 1 sám → ne. Kvůli testu vyňato `prerequisiteClassProficiencies` z `loadPanelData` (beze změny chování).

## Nespraveno
- Nálezy 1 a 2 (rozhodnutí Daniela: M6 / M7).

## Ověřeno
typecheck OK; `npm test` 3095/3095; validate-data 175/175; e2e 438/438 (4,5 min v cloudu, ~5 min jak se čekalo).

## Vedlejší úprava testů
Tři stávající testy „non-caster Fighter … bez slotů" měly prázdná slot data → po F-9 správně vyšel důvod; dostaly mock Fighter záznamu (casterProgression null). Žádná změna chování pro reálná data.

## Rozhodnutí / otázky
- Rozhodnuto: D324 (přidáno do DECISIONS.md, česky). SPEC.md a QUESTIONS.md nedotčeny.
- Poznámka: tlačítko „Spell Slots" je nově vidět i při unknown maximech (jinak by drawer s důvodem nebyl dostupný).

## Manual browser check for the user
Na https://familliar.vercel.app:
- Karta postavy → záložka Spells: u postavy, jejíž data slotů nejdou spočítat, je pod seznamem vidět důvod (červený/„nevyřešený" styl jako u max HP). Reálná data to normálně nevyvolají, takže jde jen o vzhled; ověřit nejde bez rozbitých dat.
- Záložka Spells → tlačítko „Spell Slots" (drawer) u Wizard 3 / Cleric 3: vzhled sekce „Multiclass Spellcaster (caster level 6)" a rozpisu.
