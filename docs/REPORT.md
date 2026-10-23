# H-1: aktuální HP sleduje změny maxima HP (D381)

Setup: fetch + `merge --ff-only` = již aktuální, HEAD c2cb85e.

## STEP 1 — zápisy, které mění spočtené maximum (vše jde přes CharacterManager, jiný zápis do store neexistuje)
| Zápis | Místo | Dřív D107? | Teď |
|---|---|---|---|
| Level up | CharacterWizard.tsx `computedCurrentHp` (~1772) | ano | beze změny |
| Odebrání levelu | CharacterManager.tsx `onRemoveLevel` (~395) | ano | beze změny |
| Edit Character (species, class, scores, feats ve wizardu) | CharacterWizard.tsx `computedCurrentHp` | ne | `maxHp.previous/current` → helper |
| Manage Feats add / remove (Tough…) | CharacterManager `handleAddManualFeat` / `handleRemoveManualFeat` | ne | `withMaxHpFollow` |
| Feat choice details (half-feat ASI, swap, B-4c) | `handleEditFeatChoice` | ne | `withMaxHpFollow` |
| Lessons of the First Ones feat (invokace) | `handleSetInvocationFeat` | ne | `withMaxHpFollow` |
| ASI increases na sheetu | `handleEditAsiIncreases` | ne | `withMaxHpFollow` |
| Inventář: add/remove/attune/unattune/equip/edit custom item (max HP, CON, feat z předmětu, invokace z předmětu) | `handleEditInventory` | ne | `withMaxHpFollow` |
| Max HP override ručně | `handleEditHitPoints` | — | záměrně ne (D381 c) |
| Import | `store.import` | — | nová postava, není „před“ |
| Rest, jazyky, nástroje, kouzla, text, portrét, familiar | ostatní handlery | — | maximum nemění |

## Mechanismus
- Jeden wrapper `withMaxHpFollow(id, action)` v CharacterManager: snapshot před, zápis, snapshot po, async `maxHpShift(before, after)` (hpDefault.ts, stejné `loadCharacterMaxHp` jako D107; undefined při změně override) → `currentHpFollowingMaxHp` (maxHitPoints.ts) → `setHitPoints` na **aktuálně uloženou** postavu (temp HP, override, death saves projdou). Rychlé attune+unattune se tak sčítají správně.
- Proč ne ve store: store je synchronní a nemá data (feats/classes/items); výpočet maxima je async. Wrapper je jediný průchod všech zápisů ze sheetu, takže ~8 míst = 1 mechanismus.

## Ověření
- typecheck OK; test 3429/3429 (nové v hpDefault.test.ts: Tough add/remove, item +6 attune/unattune, CON 13→15 v Edit, override, 0/clamp/undefined); validate-data 177/177; e2e 666/666 (2.4 min).
- `e2e/currentHpFollowsMaxH1.spec.ts`: a Tough přes Manage Feats 25/25 → 31/31; b 19/25 attune → 25, unattune → 19; c 0 HP + attune → max 31, current 0; d override 40 ručně → 20/40.
- c a d kontrolují „nezměnilo se“ po 500 ms čekání (async zápis nemá jiný signál).

## Rozhodnutí v kódu / otázky
- 0 HP zůstává 0 (scénář 3) jen u nové cesty; level up z 0 HP dál dělá D107 (0 + zisk). Pokud má platit i tam, je to jeden řádek v `computedCurrentHp` — rozhodnutí uživatele.
- Chyba načtení dat při follow-up = currentHp beze změny (tiše, jako D107 cesta).
- Podagent nebyl použit.

## Manual browser check for the user
Žádný — vzhled ověří planning chat ze screenshotů.
