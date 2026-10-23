# Report — B-4b: model featu z Lessons of the First Ones, schéma 62 (D376)

HEAD před úkolem: fetch + `merge --ff-only origin/main` → ffdad77. Větev nezměněna.

## Změny (18 souborů, pod limitem 25)
- `character.ts`: `GrantedFeatOrigin` + `'invocation'`, `id` i pro něj; `CURRENT_SCHEMA_VERSION` 62.
- `validate.ts`: origin `'invocation'` povolen a opakovatelný, vyžaduje platné `id` (stejné pravidlo jako manual), unikátnost id v rámci originu; `toCharacterGrantedFeats` zachová id.
- `migrations.ts`: krok 61→62 jen mění verzi.
- `featInstances.ts`: `invocationFeatSlots(character)` = počet Lessons of the First Ones|XPHB z EI voleb (`source ?? 'XPHB'`) + `itemInvocationGrants`; `featInstances` přidá prvních k záznamů s klíčem `invocation:<id>`, zbytek spí. `featOriginLabel` → „From Lessons of the First Ones“ (i `featSource` ve featuresTabData).
- `featEffects.ts:206`: invocation feat v ability příspěvcích jako manual. HP (Tough), proficience atd. jdou přes `characterFeats` → `featInstances` bez další změny.
- `characterStore.ts`: `setInvocationFeat(id, n, feat | null, details = {})` — n = stored count přidá (nové id), jinak nahradí se zachováním id, `null` smaže.
- `optionalFeatureData.ts`: `featProgressionCategories(parsed, ref)` + `loadFeatProgressionCategories` — čte `featProgression[].category` (Lessons → `["O"]`), bez natvrdo kategorie.
- e2e: `levelOrder.spec.ts`, `stableIds.spec.ts` očekávají 62. Ostatní seedy na 61 a starších se dál migrují (e2e prošlo).
- Docs: D376 (DECISIONS, česky dle zadání), STATUS (B-4b), DATA.md (featProgression 15×, jediný v optional-features je Lessons; potvrzeno skriptem `scripts/b4b-featprogression.js`: 1 z 120 záznamů).

## Ověření
- `npm run typecheck` OK; `npm run test` 187 souborů / 3410 testů OK; `npm run validate-data` 177/177; `npm run e2e` 643 passed (2.6 min).
- Nové unit testy: migrace 61→62 (+ „last step“); store načtení / odmítnutí bez id a duplicitního id; `setInvocationFeat` set/replace/clear/chyby; featInstances k=0, k=1 se spícím 2. záznamem, Lessons z vlastního předmětu, k=1 bez záznamu (pending); Tough +2/úroveň z invocation featu jen při držené invokaci (`hpDefault.test.ts`); `featProgressionCategories` proti reálným datům.

## Rozhodnutí během práce / otázky
- Neplatné `id` u `'invocation'` je fatální (validace odmítne), oprava D320 (`repairedGrantedFeats`) pokrývá jen `'manual'`. Záznamy píše jen store s `newId()`, riziko jen u ručně upraveného importu. Rozšířit opravu? Rozhodnutí uživatele.
- `setFeatChoiceDetails` klíč `invocation:<id>` nezná; podvolby se mění přes `setInvocationFeat`. B-4c buď routuje, nebo rozšíří.
- Smazání invocation featu neuklízí `resourceUses` čítače `#invocation:<id>:` (na rozdíl od `removeManualFeat`); id se nerecyklují, takže jen sirotci. Řešit v B-4c, pokud UI nabídne mazání.
- Pending slot: B-4c spočte `invocationFeatSlots(c) > počet uložených 'invocation'`.

## Necommitnuté
- `scripts/b4b-featprogression.js` a starší `scripts/tgs2-*.js` (git clean zakázán zadáním).
- Nesledované `docs/REPORT-*.md` (13 souborů), `CLAUDE-1.md` aj. ležely v pracovním stromu už před úkolem a předchozí tasky je necommitovaly; nechány být (zadání: stage jen změněné soubory po cestě). Pokud je chcete v repu, řekněte.

## Manual browser check for the user
none - no UI change.
