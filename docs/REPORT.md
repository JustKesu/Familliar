# M10b — Channel Divinity po třídách a třída u level featů v Manage Feats (D336)

## Krok 1: inventura (10 míst, bez dělení a/b, bez změny schématu)
Klíč per-class poolu = viditelný název: `` `${pool} (${className})` `` → `"Channel Divinity (Cleric)"`, `"Channel Divinity (Paladin)"`. Jen když pool dávají tabulky ≥ 2 držených tříd; jinak prostý `"Channel Divinity"`.

| Soubor | Funkce | Změna |
|---|---|---|
| src/calculation/resources.ts | `computeCharacterResources`, `tableGrantedPools` | split poolu na zdroj per třída (`pool`, `className`, max z vlastní tabulky, short rest z rysů té třídy); `poolGrantingClassNames`; `ResourceFeature.className` |
| src/calculation/classPools.ts (nový) | `classPoolKey`, `resourceKeyFor`, `withLegacyPoolUses`, `poolUsesAfterLevelChange` | klíč, mapování spendera, legacy handover, návrat na prostý klíč |
| src/sheet/featureActionRowData.ts | `featureActionRows` | param `resourceKey`; dedupe jméno + pool (dvě řádky „Channel Divinity“) |
| src/sheet/featuresTabData.ts | `featuresTabGroups` | `resourceKey` pro granted rysy a nenavázané volby |
| src/sheet/CharacterSheet.tsx | `featureActions`, `storedResourceUses`, `featureGroups` | resources počítané před řádky; legacy handover při čtení |
| src/levelUp/levelRemoval.ts | blok `resourceUses` | handover (bez capu) → návrat na prostý klíč → clamp → D332 |
| src/sheet/ManageFeatsPanel.tsx | `levelFeatChip`, `instanceRow`, ASI řádek | „From Wizard 4“ přes `featSource` |
| src/rest/rest.ts | `afterShortRest`/`afterLongRest` | beze změny (per-class zdroje nesou vlastní `shortRest`) |
| src/storage/validate.ts | read repair | beze změny (klíče jsou libovolné stringy; handover potřebuje classes.json, proto v sheetu) |
| src/actions/actionTableFeatureData.ts | — | beze změny |

Všech 30 spenderů Channel Divinity jsou class/subclass rysy s `className` (skript, DATA.md) → spend je vždy navázaný.

## Co se změnilo
Viz tabulka. Single-class postava: žádný nový klíč ani pole (unit + e2e d). D334 bod 6 nahrazen v D336.

## Ověření
- `npm run typecheck` OK; `npm run validate-data` 175/175.
- `npm test` 176 souborů / 3232 testů OK. Jeden běh dřív padl na `CharacterSheet.test.tsx` „hides itself after the timeout“ (toast D165, časování pod zátěží), samostatně i v dalším plném běhu prošel — s touto změnou nesouvisí.
- `npm run e2e` 506/506 (5.6 min, nad limitem ~3 min). Nové `e2e/multiclassPools.spec.ts`: M10b a, a2, b, c, d, e, f, f2, g, g2.
- Unit: `classPools.test.ts` (split, prostý klíč, `resourceKeyFor`, handover s capem, short rest per pool, návrat na prostý klíč, chip), `levelRemoval.test.tsx` D336.

## Rozhodnutí přijatá při práci / otázky
- Scénář f podle zadání (Cleric 3 / Paladin 1) žádný Paladin pool nemá: Paladin dostává Channel Divinity až na úrovni 3. Přidán f2: Cleric 3 / Paladin 3 → Paladin 2, Cleric počet se vrací pod prostý klíč. Pravidlo 5 tedy v reálných datech nikdy neodebere Paladin pool odebráním třídy.
- Klesne-li třída jen pod úroveň poolu (Paladin 3 → 2), její klíč `(Paladin)` zůstává uložený jako nenárokovaný (konvence slice 9b1), nesmaže se. Potvrď, nebo chceš mazat.
- Legacy handover, když první třída pool nedává (např. Wizard první): připadne první granting třídě v pořadí `classes`.
- Level up, který pool rozdělí (Paladin 2 → 3), stávající prostý počet nepřesouvá; při čtení ho handover dá první třídě, i když ho utratil Cleric a první třída je Paladin. Otázka pro QUESTIONS.md.
- Akční řádky optional features (Actions tab) se na per-class pool nemapují (nemají třídu); v datech žádná volba Channel Divinity neutrácí.
- D334 bod 6 je teď zastaralý; D336 ho výslovně nahrazuje.

## Manual browser check for the user
Na https://familliar.vercel.app, šířky 1366 a 1920, tmavé i světlé téma:
- Actions tab, Cleric 3 / Paladin 3: dvě řádky „Channel Divinity“ (zdroj „Cleric 2“ a „Paladin 3“) a jejich use boxy s „/ Short Rest“ se nezalamují.
- Features & Traits, skupiny Cleric Features a Paladin Features: řádek „Channel Divinity“ s use boxy zarovnaný jako ostatní.
- Features & Traits → Manage Feats, Wizard 4 / Cleric 1: chip „From Wizard 4“ u Ability Score Improvement se vejde vedle názvu, nepřetéká.
