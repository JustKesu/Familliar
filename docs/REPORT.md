# SM-3 (D409)

**Co se změnilo**
- A) Tlačítko „Pact weapon“ (ManageInventoryPanel.tsx) má třídu `toggle-pressed`; v index.css sdílí jedno pravidlo s `.spell-list__concentrate[aria-pressed='true']`. Vypnutý stav beze změny.
- B) `featureActionRows` předává `resourceKey` i záznam featury; nová `poolKeyFromText` (featureActionRowData.ts) vede featuru bez `consumes`, jejíž text jmenuje fond rozdělený po třídách, pod fondem její třídy. Klíč řádku pak obsahuje třídu (mechanismus D336), takže Psi Warrior + Soulknife = dva řádky „Psionic Power“ s `resourceName` „Psionic Energy Die (Fighter)“ / „(Rogue)“. Jedna třída: řádek jeden. Ostatní dedupe beze změny (Extra Attack ze dvou tříd = jeden, kryje unit test). Bez speciálního případu podle jména; shoda je podle textu featury (`comparableText` + `plainText` z resources.ts nově exportované). Záložka Features (`featuresTabData.ts`) se nemění.
- Docs: D409 v DECISIONS.md, STATUS.md.

**Testy**
- Unit: featureActionRowData.test.ts, blok „D409“ (multiclass 2 řádky s různým resourceName, jedna třída 1 řádek, Extra Attack 1 řádek).
- e2e: pactWeapon.spec.ts „SM-3 a“ (aria-pressed true + jiná barva rámečku), psionicPools.spec.ts „SM-3 b“ (dva řádky, Fighter/Rogue) a „SM-3 c“ (samotný Psi Warrior i samotný Soulknife = 1 řádek).
- typecheck OK, npm test 3495/3495 OK, e2e 752/752 OK, 7,9 min (nad 3 min).

**Decisions taken**
- Řešení B přes text featury (ne přes jméno); riziko: featura bez `consumes`, jejíž text jmenuje rozdělený fond, se u multiclassu přiřadí fondu své třídy (jen resourceName; řádek se rozdělí jen při shodném jménu u dvou tříd).

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Inventory → Manage Inventory (tlačítko Pact weapon), záložka Actions (dva řádky Psionic Power).
