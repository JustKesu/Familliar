# F-21: fokus na nadpis kroku průvodce

## Co se změnilo
- `src/creation/CharacterWizard.tsx`: `h2.wizard__title` má `ref` a `tabIndex={-1}`. `useEffect` na `state.step` (umístěný před předčasnými `return`, běží až po `seeded`) přesune fokus na nadpis (`preventScroll: true`, scroll se tedy nemění). Poslední zobrazený krok drží `useRef`; první zobrazený krok fokus nedostane. Zablokované Next krok nemění, takže se fokus nehýbe. Stejná cesta platí pro nový průvodce, level up i Edit.
- `src/index.css`: `.wizard__title:focus { outline: none }`. Nadpis není interaktivní prvek a kroužek na textu by byl šum. Ostatní `:focus-visible` styly jsou beze změny.
- `docs/STATUS.md`: jeden řádek F-21.

## Testy
- Unit: `CharacterWizard.test.tsx` (nový `describe` F-21): první render bez fokusu na nadpisu, zablokované Next bez fokusu, po Next i Back je `document.activeElement` nadpis.
- e2e `e2e/wizardFocus.spec.ts`:
  - a/b/d: otevření průvodce nefokusuje nadpis; Back na Species a Next na Background fokusují nadpis; po Tab je fokus uvnitř `.wizard__content`, ne v `.wizard__bar`; klik na krok v liště fokusuje nadpis.
  - Zablokované Next fokus nehýbe.
  - c: level up Fighter 3 → 4 (postaveného přes UI, ne seedem schématu 61), Next fokusuje nadpis.
- `typecheck` OK, `validate-data` OK (175/175), `npm run test` prošel mimo 1 chybu v mém novém unit testu (živě čtený `textContent` sdíleného uzlu), opraveno a soubor znovu prošel (35/35). Celé e2e: 545 prošlo, 1 padl můj nový spec (test fokusoval po vyplnění kroku Background, kde už fokus drží ovládací prvek). Spec jsem opravil a znovu pustil samostatně: 3/3. Zbytek sady jsem po úpravě specu už znovu nepouštěl, protože se změnil jen tento spec. Celé e2e trvá cca 7,6 min.

## Rozhodnutí
- Level up v e2e jde přes `createFighter` + dialog místo ručně seedovaného schématu 61 (méně křehké, stejný průchod aplikací). D-záznam nevznikl.
- Nadpis bez kroužku (`outline: none`) i při programovém fokusu; viditelný fokus zůstává na tlačítkách a polích.

## Manual browser check for the user
Na https://familliar.vercel.app:
- Nová postava, klik na Next, pak Tab: je kroužek na prvním prvku obsahu kroku (ne v horní liště)?
- Nadpis kroku po kliku na Next/Back nemá žádný divný obrys nebo rámeček?
- Při přechodu mezi kroky se stránka neposkočí na jiné místo než dřív?
