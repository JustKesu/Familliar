# M-1 — mobile sheet layout (D428)

Setup: fetch, `merge --ff-only` (already up to date), npm ci, e2e:install; HEAD 802f30c — OK.

## STEP 1 — kam co jde na mobilu (≤ 760 px)

| # | Dnes (desktop) | Mobil |
|---|---|---|
| 1 | Portrét 56 px (tlačítko + menu) | Hlavička, 40 px, stejné menu |
| 2 | Jméno h1 | Hlavička, 20px/600, ellipsis |
| 3 | Identita (species · size · classes · level · background) | Hlavička, 12px řádek jen species · classes, ellipsis |
| 4 | Edit character | Menu „More actions“ (⋮, 44×44) |
| 5 | Level up (+ dialog) | Menu „More actions“ |
| 6 | Remove level (+ confirm) | Menu „More actions“ |
| 7 | RollModeSwitch (advantage) | Stats view, nahoře |
| 8 | Short Rest | Hlavička řádek 3, ikona 36×36, aria „Short rest“ |
| 9 | Long Rest | Hlavička řádek 3, ikona 36×36, aria „Long rest“ |
| 10 | 6 karet schopností | Stats view, mřížka 3×2 |
| 11 | Prof. | Stats view, řádek Prof / Initiative / HI |
| 12 | Initiative | Stats view, týž řádek |
| 13 | Heroic Inspiration | Stats view, týž řádek |
| 14 | Speed | Hlavička řádek 2 |
| 15 | Armour Class | Hlavička řádek 2 |
| 16 | HP karta: hodnota / max, Temp, death saves | Hlavička řádek 2, polovina šířky |
| 17 | HP: Heal | Hlavička řádek 3 (za Amount) |
| 18 | HP: Amount | Hlavička řádek 3, 3.2em |
| 19 | HP: Damage | Hlavička řádek 3, první |
| 20 | Defenses | Stats view, status karty |
| 21 | Conditions | Stats view, status karty |
| 22 | Concentration (+ Drop) | Stats view, status karty |
| 23 | Rolls (v app headeru, portál) | Beze změny, app header |

Každý prvek má místo, 23 řádků — pokračuji.

## Co se změnilo

- `src/sheet/useMobileLayout.ts`: `matchMedia('(max-width: 760px)')`, bez matchMedia (jsdom) = desktop.
- `SheetHeader.tsx`: karty rozdělené na komponenty (Prof, Speed, Initiative, AC, HI, Concentration, `LongRestButton` s F-7b busy stavem); desktop `SheetHeader` skládá stejný DOM. Nové `MobileSheetHeader` (sticky) a `MobileStatsTop`, `MoreActionsMenu` (obsah zůstává namountovaný, aby dialogy Level up / Remove level nezanikly; klik do `.confirm-dialog__backdrop` menu nezavře).
- `HitPoints.tsx`: export `DamageHealingColumn`, prop `controls` u `HitPointsCard` (mobil: ovládání v řádku 3, pořadí Damage/Amount/Heal přes CSS `order`).
- `CharacterSheet.tsx`: `headerProps` sdílené oběma hlavičkami; stav `mobileView` ('stats' | 'tabs'), třída `sheet__body--<view>` jen na mobilu, pilulky More (`.pill`), bottom nav `role=tablist` "Sheet views". `activeTab` zůstává jediným zdrojem panelů; More si pamatuje poslední pilulku přes `activeTab`.
- `index.css`: blok `@media (max-width: 760px)` (D153 rámec, vnitřní scroll a desktopové záložky vypnuté, drawer `left:0`, toast nad nav) + styly mobilních prvků. Žádné nové barvy.
- Tabulky: při 390 px nic nepřetéká (ani Actions tabulka s Greatsword), wrapper nebyl potřeba.

## Ověření

- typecheck OK; test 194 souborů / 3607 OK; validate-data 177/177 PASS.
- e2e nový `e2e/mobileSheetM1.spec.ts` 7/7: a) M-1 a, b) M-1 b (+ sticky hlavička po scrollu, rest ikony), c) M-1 c, d) M-1 d (44×44), e) M-1 e, f) M-1 f, navíc M-1 g (postava s výzbrojí a kouzly, overflow Actions/Spells/Inventory).
- Celé e2e: 834 passed, 1 failed (9,0 min — přes limit 3 min): `subclassSpellcastingPrereq.spec.ts:103` SC-1 a, stejný timeout jako v minulém reportu, samostatně 4/4 passed; průvodce M-1 nemění. Commitnuto přesto, protože selhání je pre-existing a nesouvisí se změnou.
- `sheetLayout.test.ts` (D153) dál prochází; jeho regex nevidí pravidla uvnitř `@media`, mobilní override je tím pro něj neviditelný.

## Rozhodnutí v kódu

- Hlavička je `position: sticky; top: 0` (ne `fixed`): app header se Rolls odroluje, list-hlavička zůstane; netřeba znát její výšku.
- Výchozí mobilní pohled je Stats; přepnutí nav scrolluje na začátek stránky.
- Identity na mobilu: jen species · classes (bez size, level, background).
- Menu More actions má i Remove level (byl v hlavičce vedle Edit a Level up).

## Subagent

Nepoužit.

## Otázky pro uživatele

- SC-1 a padá v plném běhu opakovaně (3. report); možná zvýšit timeout.
- Netrackovaný `scripts/investigate-lh2-sorcery-points.js` z LH-2 zůstává (git clean zakázán zadáním).

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky (jen ≤ 760 px): hlavička listu postavy, menu More actions, Stats view, Actions / Spells / Inventory view, More view (Features & Traits, Notes, Extras), drawery na celou šířku, toast hodu.
