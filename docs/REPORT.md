# REPORT — F-12: opravy z review M10 (D337)

## Co se změnilo
- **Nález 1:** `saveCharacter` (`wizardState.ts`) zapíše `abilityBonus` jen neprázdný, jinak `existing?.abilityBonus` (chybějící zůstane chybět).
- **1b (výsledek):** třídní skilly ani fighting style při level upu nic, co validace odmítne, nezapíšou. `classSkills` chybějící → `[]`
  (validate prázdné pole přijme). Fighting style: jednotřídní level up zapíše nejvýš jeden; multiclass `otherFightingStyles` + vlastní
  styl nikdy nedá dva záznamy stejného vlastníka. Fixture h je potřebovala kvůli průchodu wizardem (krok Class chce skilly/styl),
  ne kvůli zápisu. Kód beze změny, ověřeno testem (Paladin 2 / Cleric 2 bez skillů, stylu a bonusu → `describeCharacterError` null).
  Mimo scope, jen pro informaci: u Paladin/Fighter s netagovaným stylem (pre-58), kde raised třída nemá vlastní tag, si level up
  netagovaný styl přivlastní (D318/D329) — validní, ale druhá třída styl ztratí.
- **Nález 2:** `keepHeldClassLevels` seřadí volné sloty a odebere z nich tolik nejnižších, kolik má třída ponechaných voleb bez razítka.
- **Nález 3:** seed multiclass Editu označí třídu s neúspěšným loadem grantu (`HeldClassLookup.grantLoadFailed`). `assignHeldPicks`
  jí nechá volby orazítkované jejími úrovněmi (`HeldPickGrant.loadFailed`), `heldPickConditions` se jí na nic neptá. Save je blokovaný;
  text „<Class> data failed to load. Reload the page and try again.“ je na Review (`ReviewStep.loadErrors`) a vedle Save
  (`WizardNavButtons.note`, nová třída `.wizard__nav-note`). Aktivní třída s neúspěšným grantem se ptá podle vlastních loadů kroku
  Class jako dřív (ty sdílejí stejné soubory, takže v praxi selže celý seed).
- **Nález 4:** `withOwnedPicks(names, held, cls, picks)` maže záznamy jmen, která nejsou ve výsledných jménech ani v `seeded`.
- **Nález 5:** jen záznam v QUESTIONS.md (Psionic Energy Die Psi Warrior + Soulknife).
- Docs: D337 v DECISIONS.md, QUESTIONS.md, STATUS.md.

## Ověřeno
- `npm run typecheck` OK; `npm test` 176 souborů / 3245 testů OK; `npm run validate-data` 175/175; `npm run e2e` 510/510 (5,7 min).
- Unit: `multiclassEntry.test.ts` D337 (Fighter 4 → 5 bez abilityBonus, uložený bonus zůstane, 1b Paladin/Cleric);
  `heldClassPicks.test.ts` D337 (nová volba dostane slot 5 místo 4; přidání+odebrání → `sameWizardData` true; selhaný grant drží
  orazítkované volby); `classPools.test.ts` (jednotřídní level up beze změny klíčů; legacy save s rozděleným poolem si prostý klíč
  nechá); `levelRemoval.test.tsx` (legacy prostý klíč → Cleric, clamp 3 → 2, řádek dropped); `ReviewStep.test.tsx` D337 (alert
  na Review, text vedle zakázaného Save).
- E2E `reviewFixesM10.spec.ts`: F-12 a (Fighter 4 bez abilityBonus → level up oknem „Fighter 4 → 5“, sheet i seznam), c, d.
- **b není e2e:** granty (`class-features.json`, `classes.json`) sdílí všechny třídy i loady podtříd a `loadDataFile` je cachuje,
  takže úzké selhání jen pro Rogue přes `page.route` nejde; selhání souboru shodí celý seed. Pokryto unit + render testy výše
  (vlastnictví voleb, hláška, zakázané Save); samotné propojení `grantLoadError` → `readyToSave` v CharacterWizard test nemá.
- **c:** Oath of Conquest (XGE) na Paladinovi XPHB na sheetu žádný řádek Guided Strike (ani Conquering Presence) neukáže, jen
  always-prepared kouzla. Scénář proto používá dva stejnojmenné řádky „Channel Divinity“ (Cleric 2 a Paladin 3), každý utrácí svůj pool.
  Proč se Conquest Channel Divinity rysy neukazují, nezkoumáno — kandidát na samostatný task.

## Rozhodnutí / k řešení
- Rozhodnuto při práci: zpráva vedle Save je v obou navigacích wizardu (horní lišta i spodek), jako tlačítko samo.
- Netrackovaný `scripts/investigate-m10b-pools.mjs` existoval už před taskem, necommitnut, nesmazán (git clean v tomto tasku zakázán).

## Manual browser check for the user
Na https://familliar.vercel.app, šířky 1366 a 1920, tmavé i světlé téma:
- Krok Review a spodní/horní lišta s tlačítkem Save changes: červený text vedle Save — zarovnání s tlačítky, zalomení dlouhého
  textu, nepřetéká. Stav selhání grantu jde vyvolat jen umělým výpadkem sítě (DevTools → blokovat `class-features.json` po načtení
  sheetu nedává smysl, protože selže celý seed); pokud to nejde navodit, bod přeskoč.
- Lišta wizardu bez hlášky (běžný Edit/level up): Back/Save vypadají jako dřív (`.wizard__nav-main` má nově `flex-wrap` a `align-items: center`).
