# REPORT — NPC-1: záložka NPCs v DM části (NPC s plným listem, Duplicate, Delete)

Setup: `git fetch` + `merge --ff-only origin/main` = „Already up to date“, HEAD 3bfffb0.

## Co se změnilo
- Model: `Character.npc?: true`, schema 73, migrace 72→73 jen označí verzi. `validate.ts` přijme jen `true` (jinak
  „npc must be true when present“), `toCharacter` ho přenese. Export/import nesou příznak beze změny.
- `CharacterStore`: `update` zachová uložený příznak (Edit, level up, odebrání úrovně jdou přes `update`); nové `markNpc(id)`
  a `duplicateAsNpc(id, name)` (structuredClone celé postavy, nové id, oříznuté jméno, `npc: true`; prázdné jméno → chyba).
- Routy: `DmTab` + `'npcs'`, `DmRoute.newNpc`; `#/dm/npcs`, `#/dm/npcs/new`.
- `App.tsx`: `#/dm/npcs` = DmPage s panelem `<CharacterManager route=…>` (prop `npcs`), `#/dm/npcs/new` = CharacterManager
  sám (průvodce jako `#/new`). CharacterManager: větev `dm` → `src/dm/NpcList.tsx`, větev `newNpc` → CharacterWizard,
  `onSaved` = `markNpc` + list, Cancel → `#/dm/npcs`. Domovský seznam filtruje `!npc`.
- `NpcList.tsx`: „New NPC“ (toolbar jako Encounters), mřížka `CharacterCard`, Delete přes ConfirmDialog (Keep/Delete),
  Duplicate přes ConfirmDialog s polem „Name of the copy“. `CharacterCard`: volitelná položka menu Duplicate (jen NPC).
  `ConfirmDialog`: volitelné `destructiveDisabled`. CSS `.npcs__name`.
- Průvodce o NPC neví nic (0 míst v CharacterWizard/wizardState) — příznak přidá až `onSaved`.

## Rozhodnutí v kódu
- Příznak se při vytvoření zapisuje druhým zápisem (`markNpc`) po uložení průvodcem; selže-li, postava zůstane hráčská a
  chyba se ukáže nad listem.
- Karta NPC má i Rename a Export (stejná karta jako doma); Duplicate je v menu „⋯“, ne jako samostatné tlačítko.
- Import zůstává jen na domovském seznamu; NPC soubor se uloží jako NPC a objeví se jen v záložce NPCs (doma nic nepřibude).
- Duplikát hráčské postavy by vznikl jako NPC — v UI nedostupné (Duplicate je jen v NPCs).
- Výstupy z NPC: Cancel nového NPC → `#/dm/npcs`; Edit/level up Cancel → list NPC (jako dnes); zpět v prohlížeči z listu
  vede na `#/dm/npcs`, protože odtud byl otevřen. Wordmark i tlačítko DM v hlavičce beze změny. Přesměrování z neznámého id
  (smazaná postava) dál vede domů — u neexistujícího id nelze poznat, zda šlo o NPC.
- Prázdný seznam: „No NPCs yet.“; chyba načtení / akce se ukáže nad mřížkou.
- STOP podmínky (a), (b) nenastaly: počty, intro a import běžných souborů se nemění; průvodce nebylo nutné měnit.

## Ověření
- `npm run typecheck` OK; `npm test` 200 souborů / 3693 testů OK (nové `src/storage/npc.test.ts`: migrace 72 bez
  příznaku, validace, export/import, update, markNpc, duplicate; `migrations.test.ts` 72→73; `route.test.ts` 2 routy).
- `npm run validate-data` 191/191.
- `npm run e2e`: 871 passed (2,8 min). Nový `e2e/dmNpcs.spec.ts` (7 scénářů, a–h, + b2 Cancel), schemaVersion 73 v
  levelOrder/stableIds/spellbookSB1. `e2e/wizard.ts`: volba `alreadyOpen` (průvodce bez `goto('/#/new')`).
- Subagent nepoužit.

## Změněné obrazovky
- DM: třetí záložka „NPCs“ (seznam karet, New NPC, dialog Duplicate, dialog Delete).
- Domovský seznam: bez NPC.
- Menu karty postavy: v NPCs navíc „Duplicate“.

## Manual browser check for the user
none - the planning chat checks the looks from screenshots.
