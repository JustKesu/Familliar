# R-MON — review DM bloku MON-1 až NPC-3

HEAD při review: 8f66e33 (fetch + `merge --ff-only` = „Already up to date“). Jen čtení (Read/Grep, git log/show), žádné npm
skripty, žádný skript, žádný subagent. Prošlo: D431–D439, encounterStore.ts, combat.ts, trackedUses.ts, npcCharacter.ts,
npcStats.ts, npcCr.ts, encounterDifficulty.ts, sheet/combinedSpells.ts + diff NPC-2 v CharacterSheet.tsx/HitPoints.tsx,
EncounterRun.tsx (useNpcs, overlay, CombatScreen handlery), EncounterSetup.tsx (addNpc), DmPage.tsx, RollUi.tsx,
Markup.tsx (TagRoll), dice/roll.ts, MonsterStatBlock.tsx (Value/RollScope), characterStore.ts (update/markNpc/
duplicateAsNpc), CharacterManager.tsx (New NPC, import), migrations.ts 72→73, ConfirmDialog.tsx, NpcList.tsx,
extract-data.js `extractMonsters()`, index.css (.roll-value, .roll-toast), seznam unit a e2e testů bloku.

## Nálezy

1. **high** — `src/dm/EncounterRun.tsx:91-92`. `max = Math.max(1, own?.maxHp ?? character?.currentHp ?? 1)`. Když
   `loadNpcStats` selže (known d) nebo list max HP nespočítá (`maxHp: null`), max je current HP, a bez current HP rovnou 1.
   Scénář: NPC bez `currentHp`, statistiky selžou → řádek ukáže 1/1; Damage 7 zapíše přes `setHitPoints` do uložené postavy
   `currentHp: 0` + death save. Je to trvalá změna listu z vymyšleného maxima. Druhý scénář: max neznámé, current 12 → Heal
   nic nevyléčí (strop 12). Oprava: `max` neznámé = HP buňka „—“, NPC vyřadit z Damage/Heal (a říct proč); žádný zápis HP
   s náhradním maximem. Test: npcCombat.test s `maxHp: null`.
2. **medium** — `src/encounters/encounterDifficulty.ts:64` `crXpTable` staví tabulku CR→XP z bestiáře, který nemá CR 26–29
   (DATA.md:2255). Přitom `encounter-rules.json` má `xpByCr` se všemi 34 řádky (D431). Scénář: NPC 20. úrovně s odhadem
   CR 27 → `EncounterSetup.tsx:225` ho zahodí (CR není v nabídce), DM ho nemůže zvolit ani ručně, NPC zůstane nezapočtené.
   Oprava: `crs` brát z `rules.xpByCr` (`EncounterSetup.tsx:191`, `EncounterRun.tsx:754`); CR 0 = 10 už tam je.
3. **low** — `src/encounters/combat.ts:160-166` `removeEntry`. Odebrání jednajícího posledního záznamu dá `turn` 0 bez
   `round + 1` a bez `refillLegendary`/připomínky recharge. Scénář: smazané NPC je na tahu jako poslední v kole 3 → Remove →
   na tahu je první v pořadí, lišta dál ukazuje kolo 3, legendární akce nedoplněny. Oprava: když `index === turn`, posunout
   jako `nextTurn` (round při přetečení, refill). Test chybí.
4. **low** — `src/encounters/combat.ts:244` `applyDamage` maže `saveResults` všech, nejen zasažených. Scénář: záchrana pro
   4 vlky, DM dá Damage jen dvěma vybraným (zbytek odznačí, aby jim dal damage zvlášť) → výsledky zbylých dvou zmizí, druhý
   Damage jde plně. Oprava: smazat jen `memberIds` (a id NPC). Okrajové, ale levné.
5. **low** — `src/dm/EncounterRun.tsx:772-775`. Damage nejdřív zapíše NPC (character store), pak `commit` boje. Selže-li
   `commit` (plné úložiště), NPC damage už platí, `saveResults` zůstanou → druhý klik dá NPC damage znovu. Smyčka přes víc
   NPC není atomická. Oprava: pořadí commit → NPC; přijatelné nechat, výskyt jen při plném localStorage.
6. **low** — `src/encounters/trackedUses.ts:73,84` + `combat.ts:182`. Přepnutí In lair mění `total`, `used` zůstává. Scénář:
   v doupěti spotřebovány 4/4 Legendary Resistance, lair vypnut → 4 použití při total 3 (zkratka v řádku „LR 4/3“; v UI jsem
   neověřoval, jen z kódu). Oprava: zobrazovat `min(used, total)`.
7. **low** — `src/dm/NpcList.tsx:86` dialog Delete neříká, že NPC je ve střetnutí. Vede přímo na known b. Oprava: spočítat
   střetnutí s `characterId` a přidat do textu „Used in N encounters; they will show it as deleted.“
8. **low** — `src/CharacterManager.tsx:301-306` import z domovského seznamu: soubor s `npc: true` se uloží jako NPC (D437)
   a v seznamu se nic neobjeví. Uživatel neví, kam zmizel. Oprava: hláška „Imported as NPC — see DM › NPCs“.
9. **low** — `src/encounters/encounterDifficulty.ts:77,80`. Smazané NPC se dál započítává svým CR; CR, které v tabulce není,
   dá tiše 0 a nepočítá se do „N NPC not counted“. Oprava: nezapočtené = `cr === null` nebo CR mimo tabulku nebo smazané.
10. **low (dup)** — `combineSpellEntries` se volá se stejnými argumenty na dvou místech: `CharacterSheet.tsx:2307` a
    `combinedSpells.ts:113`. Diff NPC-2 je čistý přesun (efekt `loadClassAndSubclassSpellInfo`, `wizardBookGrants` 1:1, deps
    stejné), chování listu se nemění. Riziko je jen budoucí rozjezd, když někdo změní jedno volání. Oprava: list volá sdílenou
    čistou funkci `combineSheetSpells(character, parts)`.
11. **low** — `src/encounters/npcCr.ts:120` `computeAttacksPerAction` dostane všechny invokace, takže Thirsting Blade
    násobí i útok zbraní, která není pact weapon (known g). Oprava: Thirsting Blade jen pro útoky s pact značkou.

Fokusové body bez dalšího nálezu:
- (1) Migrace v1→v3 (`migrateV1` + `migrateV2`) a v2→v3 jsou čisté; vadné položky se přeskočí, při zápisu uloží už
  migrované pod schema 3 (OK). Duplicitní `characterId` → celé střetnutí vadné (záměr). Monstrum, které z dat zmizí: setup
  „Unknown monster“ (`EncounterSetup.tsx:123`), v boji HP 1, iniciativa +0, 0 XP, bez karty — bez označení v řádku (kosmetika).
  Chybějící NPC: setup „This NPC no longer exists“, boj „(NPC deleted)“ + Remove (D438).
- (2) Migrace 72→73 jen značí. Validace odmítne `npc` ≠ `true` (`validate.ts:1477`), `toCharacter` příznak přenáší (:1720).
  `update` příznak zachová (`characterStore.ts:645`), `duplicateAsNpc` je `structuredClone` + nové id (play state včetně).
  Filtry home/NPC v `CharacterManager.tsx:343,358`.
- (3) Viz nález 10; `npcStats.ts` volá stejné `computeSavingThrows/computeInitiative/computeArmourClass` se stejnými
  argumenty jako list (`CharacterSheet.tsx:2449-2459`); pořadí `SAVE_ABILITIES` = `ABILITIES` (str…cha), indexace sedí.
- (4) Přepis navzájem nehrozí: při otevřeném overlay je boj `hidden`, nejde z něj zapisovat; overlay je nový
  `CharacterManager` (`App.tsx:33`), čte úložiště při mountu; „← Back“ volá `npcs.refresh()`. Každý zápis z řádku čte
  postavu z čerstvého `list()` po předchozím refresh. Stará hodnota hrozí jen při opuštění overlay jinak než „← Back“ (to
  ale EncounterRun odmontuje) nebo ve dvou záložkách prohlížeče (mimo rozsah).
- (5) `nextTurn` přeskakuje mrtvé i smazané, přetečení = kolo +1, při všech mrtvých posune o 1. Legendární akce se doplní na
  začátku tahu (pravidlo). LR a N/Day jsou políčka; Recharge připomínka po Next turn jen pro položku na tahu (pravidlo).
  Damage/heal více cílů a half/none odpovídají D434; NPC čte `damageTaken` před smazáním výsledků (správně).
- (6) `difficultyLabel` jako strop (D434) OK; nezapočtená NPC viz nálezy 2 a 9.
- (7) `estimateCr` odpovídá DMG 2014: řádek dle HP, ±1 krok za celé 2 body AC (`Math.trunc`), DPR řádek, ±1 za 2 body
  útoku / DC u záchranného cantripu, průměr, shoda nahoru (`<=` v reduce na vzestupných řádcích). HP 760/805 na hraně dvou
  řádků padne do vyššího. Zjednodušení: DPR jen jedno kolo (DMG chce průměr 3 kol), bez efektivních HP/AC — v tooltipu.
- (8) `parseDamageDice` drží jen `NdM [±K]`, × a víc skupin → text (test `roll.test.ts:13`). `MarkupRollContext` poskytuje
  jen `RollScope` v `MonsterStatBlock`, a ten jen při `RollReportContext` (DmPage); `MonsterStatBlock` se renderuje jen v
  Bestiary a EncounterRun → mimo DM se markup nemění. Overlay list NPC má vlastní `RollModeContext` a toast (list :3036), DM
  režim neovlivní. Advantage se po d20 hodu vrací na Normal (RollButton).
- (9) Příčina přepisu `monsters.json`: řazení `kept.sort(... a.name.localeCompare(b.name) ...)` (`extract-data.js:2352`) a
  `groups.sort` (:2403) bez locale → kolace podle výchozího locale stroje. Commitované soubory pravděpodobně vznikly
  v cloudu (en-US, DS-1), NPC-3 běžel lokálně (Windows, pravděpodobně cs-CZ: „ch“ se řadí za „h“, jiná váha diakritiky
  a velkých písmen). Názvy „Ch…“ (Chimera, Chuul, Chain Devil…) se přestěhují → velký diff blokově přesunutých řádků při
  stejném obsahu. Stejné riziko mají `beasts.json` (:2148, jen shody v rámci CR) a item entry šablony (:2995). Ostatní
  výstupy řadí `Object.keys().sort()` (kódové body, deterministické). `readdirSync` není příčina (výsledek se řadí),
  `writeJson` píše `\n` bez CRLF. Ověření bez spuštění: `git diff --stat` po extrakci má mít stejný počet + a − řádků.
  Oprava: `localeCompare(b.name, 'en')` nebo `Intl.Collator('en')` na všech čtyřech místech; jednorázová regenerace dat.
- (10) Mezery v testech: nález 1 (NPC s neznámým max HP), 3 (removeEntry na konci kola), 4 (částečný Damage po
  záchraně), 6 (lair přepnutý po spotřebě), 2 (CR 26–29 v Add NPC), markNpc selhání po wizardu, smíšený Damage monstra +
  NPC s polovičním poškozením v jednom kliknutí (e2e c–h testuje NPC zvlášť), monstrum zmizelé z dat v běžícím boji,
  determinismus extrakce (žádný guard na pořadí monsters.json).

## Známé body

| | Verdikt | Proč |
|---|---|---|
| a) markNpc druhým zápisem | fix later | Selže jen při plném/nedostupném úložišti; čistá oprava = `create(input, { npc: true })` v jednom zápisu. |
| b) smazané NPC jako down | keep | D438 to tak chce, je tu štítek i Remove; doplnit varování v Delete (nález 7). |
| c) NPC bez current HP na max | keep | D438; rozumné u nového NPC. Neplatí, když max není známé (nález 1). |
| d) statistiky nenačteny: AC „—“, +0 | fix now | Samotné „—“/+0 je OK, ale stejná větev vede k zápisu HP s maximem 1 (nález 1) = poškození listu. |
| e) Exhaustion z boje = 1 | keep | D434 je bez úrovně; existující úroveň se nepřepisuje; úroveň se mění na listu. |
| f) „No CR“ před odhadem přepsán | fix later | Okno je zlomek sekundy; oprava = příznak „DM sáhl na CR“ místo `cr === null`. |
| g) odhad bez kouzel 1+, Sneak Attack, Rage; Thirsting Blade | fix later | Je v tooltipu i D439; Thirsting Blade (nález 11) je malá oprava, zbytek je hrubý odhad záměrně. |
| h) shoda: hráč před monstrem | keep | D434; čísla jdou ručně přepsat. |
| i) člen přidaný po startu není v pořadí | fix later | U „One initiative roll“ skupin nový člen v pořadí je (`entryMemberIds`); chybí jen u jednotlivých členů, nových skupin a NPC → tlačítko „Add to initiative“. |
| j) historie, výběr, Amount, Save, DC, připomínka neuloženy | keep | Přechodný stav obrazovky, D435/D436 to tak určují. |
| k) „+N (+N while in snake form)“ hází první | keep | Vzácné, první číslo je běžná forma. |

## Vzhled (L1–L3)

- **L1** — hodnoty k hodu na stat blocku nemají rámeček. Základ `.roll-value` (`src/index.css:809-823`) má záměrně průhledný
  okraj. Listový rámeček je pravidlo `src/index.css:1573-1584` (`.sheet__actions-table .roll-value, .sheet__spell-table
  .roll-value` — `border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); padding: 2px 8px`) a hover
  `:1599-1602`. Přidat `.monster-card .roll-value` do obou selektorů (kořen stat blocku je `article.monster-card`,
  `src/monsters/MonsterStatBlock.tsx:86`); v próze možná menší padding (`0 6px`), aby nerozhodil řádek.
- **L2** — `src/app/ConfirmDialog.tsx:100-105`: tlačítko „destructive“ je vždy `btn--accent-outline`, „safe“ vždy
  `btn--accent` a dostane fokus (W23/W28 — správné pro mazání). Duplicate (`src/dm/NpcList.tsx:97-114`) ho používá
  s „Duplicate“ jako destructive. Komponentu sdílí 8 souborů (CharacterList ×2, CharacterWizard, EncounterList ×2,
  EncounterRun, EncounterSetup, NpcList ×2, RemoveLevelButton) — všude jinde jde o mazání/ztrátu dat. Oprava: volitelný
  prop (např. `primary="action"`) jen pro Duplicate, ostatní beze změny.
- **L3** — `src/dm/DmPage.tsx:78` `<RollToast>` je mimo `panel`, takže přežije přepnutí záložky a dál běží 6 s časovač
  (`src/dice/RollUi.tsx:50-54`); `.roll-toast` je `position: fixed; right: 24px; bottom: 24px; z-index: 20`
  (`src/index.css:147-151`), přesně nad „+ Add“ v pickeru. Oprava: `<RollToast key={tab + encounterKey} …>` (remount =
  zavření při změně route), případně zavírat v efektu na `route`.

## Otázky pro uživatele

1. **NPC, kterému appka nedokáže spočítat max HP (nález 1).** U stolu: NPC s nedotaženým listem má v boji 1/1 HP a první
   zásah mu na listu natrvalo zapíše 0 HP a neúspěšný death save. Možnosti: (A) takové NPC v boji ukázat s „—“ a damage/heal
   mu nepovolit, DM upraví HP na listu; (B) zeptat se DM na max HP při startu boje; (C) nechat. Doporučuji A, malý úkol hned.
2. **CR 26–29 pro silná NPC (nález 2).** U stolu: NPC 20. úrovně, kterému odhad vyjde CR 27, nejde ohodnotit vůbec, protože
   v nabídce CR 26–29 chybí (žádné monstrum v bestiáři je nemá). Možnosti: (A) nabízet všech 34 CR z tabulky XP; (B) nechat.
   Doporučuji A.
3. **Mazání NPC, které je ve střetnutí (nález 7, known b).** U stolu: DM smaže NPC a v připraveném střetnutí pak najde
   „(NPC deleted)“. Možnosti: (A) v dialogu Delete napsat, ve kolika střetnutích je; (B) smazání rovnou odebrat i ze
   střetnutí; (C) nechat. Doporučuji A (B by tiše měnilo uložená střetnutí).
4. **Přeřazení monsters.json při extrakci (bod 9).** Netýká se hry, jen dat v repozitáři: extrakce na tvém počítači přeskládá
   pořadí monster. Možnosti: (A) opravit řazení na pevné anglické a jednou data přegenerovat; (B) nechat a extrakci pouštět
   jen v cloudu. Doporučuji A.
