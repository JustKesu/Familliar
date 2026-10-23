# R-B: code review bloku B (edfe462..8699357)

Setup: fetch + `merge --ff-only` = „Already up to date“, HEAD 8699357. Jen čtení kódu (git diff, Read, Grep); žádný npm skript, žádný subagent.

## Nálezy

### Vysoká
Žádný. Schéma 62 (tag-only migrace, validace `invocation` s id unikátním per origin, oprava id) nevede k nečitelné postavě ani ke ztrátě voleb.

### Střední
1. **Wizard nepočítá feat z Lessons jako držený** — `src/creation/CharacterWizard.tsx:1314-1324, 1340`, `src/featAsi/featAsiLevels.ts:157`. `grantedFeatsOf` dostává jen `origin === 'manual'`; `'invocation'` chybí. Hráč s Alert z Lessons si v level upu/Edit vezme Alert znovu na ASI úrovni (nebo jako species/background origin feat, D273) bez varování; list pak ukáže Alert dvakrát. Manage Feats to opačným směrem hlídá (held = featInstances). Oprava: předat do `grantedFeatsOf` i probuzené `'invocation'` záznamy s popiskem „From Lessons of the First Ones“.

### Nízká
2. **Clear probudí spící záznam** — `src/storage/characterStore.ts:974-983` + `src/featAsi/featInstances.ts:122`. Drží 1× Lessons, uloženo [Alert, Skilled(spí)]; Clear na Alert → místo čekajícího slotu se objeví staré Skilled se starými volbami. Oprava: viz Otázky.
3. **Výměna featu v selectu nemaže čítače staré instance** — `src/storage/characterStore.ts:990-992`. Id zůstává, `#invocation:<id>:` čítače zůstanou; Magic Initiate → Alert → Magic Initiate (stejný seznam a kouzlo) ukáže free cast jako spotřebovaný. Oprava: při replace jiného jména smazat `spell:*#invocation:<id>:*` jako u Clear.
4. **Tři kopie sběru invokací** — `featInstances.ts:23-26`, `CharacterSheet.tsx:2399-2402`, `CharacterSheet.tsx:2397`. První dvě jsou dnes shodné; třetí (Thirsting Blade → attacks per action, starší kód) ignoruje invokace z vlastních předmětů, takže Thirsting Blade z předmětu nedá Extra Attack. Oprava: jedna exportovaná `heldInvocations(character)` pro všechna tři místa.
5. **Agonizing Blast na EB z jiné třídy/předmětu** — `src/sheet/spellActionRowData.ts:585, 593`. Řádek EB naučeného Wizardem dostane +INT, z předmětu modifikátor předmětu; RAW jen „Warlock cantrip“. D372 to neřeší; v praxi vzácné. Oprava: buď nechat (a zapsat do D372), nebo flag jen pro řádky s casterem Warlock/bez třídy.
6. **Čekající řádky Lessons klíčované indexem** — `src/sheet/ManageFeatsPanel.tsx` (`invocation-pending|${i}`). Při 2 čekajících slotech (Warlock + předmět): sbalit slot 0, v něm vybrat feat → zbylý slot zdědí stav „sbaleno“ (React drží klíč |0). Kosmetika. Oprava: nic, nebo klíč z `invocationInstances.length + i`.
7. **Review „Class options“ u multiclass Edit** — `src/creation/review/ReviewStep.tsx:96-101`. Karta ukazuje jen volby aktivní třídy (stash, `wizardState.ts:800-802`), popisek třídu nejmenuje. Nekoliduje s D378, jen neúplné pro multiclass. Oprava: nic, případně uvést třídu v popisku.

## Verdikty 1-10
1) **OK / nízká** — u Warlocka CHA správně; jiná třída/předmět viz nález 5.
2) **OK** — pick bez source je z dat před tagováním source; PHB'14 verze má source `PHB`, a ta se nepočítá. Riziko jen u starého uloženého PHB picku bez source; neověřitelné bez dat, nepravděpodobné.
3) **Problém, nízká** — nejsou jeden kolektor, jsou tři inline kopie (nález 4). B-1/B-2 a `invocationFeatSlots` se dnes neliší (stejné vstupy, stejný filtr EI + `itemInvocationGrants`); Thirsting Blade ano.
4) **Problém, střední (jen „dvakrát“)** — dvakrát: přes wizard (nález 1). Počítání ve spánku: ne — `'invocation'` čte jen `featInstances`/`pendingInvocationFeats` (grep), featEffects/concentration/spells jedou přes instance. Ztráta: ne — swap a Remove level nemažou, Edit nese `grantedFeats` beze změny (`wizardState.ts:756`, filtry 1401/1444/1516 sahají jen na species/background), import validuje + opravuje id. Vedlejší efekt Clear viz nález 2.
5) **OK** — oprava nemění pořadí, `slice(0, k)` ukáže tytéž záznamy. Záznam bez id měl klíč `invocation:<n>` a dostane id `String(n)` (n = pozice v originu) → klíč i čítače stejné. Jen při kolizi (`repaired-<n>`) se čítače odpojí — zanedbatelné.
6) **OK** — instance klíč používá jen `freeCastResources.ts:67` (`spell:…#<key>:…`). Zdroje featů (Lucky apod.) jsou klíčované jménem a zůstanou, stejně jako u `removeManualFeat`. Díra je jen u replace (nález 3).
7) **OK** — jiný feat = staré podvolby nedávají smysl; D377 to výslovně říká.
8) **OK** — effect běží jen při změně `defaultOpen` na true; sbalení uživatelem drží, dokud řádek zůstává pending. Jediný kosmetický případ nález 6.
9) **OK** — multiclass level up: `data` i `baseline` plní stash aktivní třídy, featureType má jednoho vlastníka (D334), takže `featureType|name` sedí. Swap: nová volba je „added“, stará se neukazuje (D378 vědomě). Porovnání bez source přehlédne jen swap PHB→XPHB téhož jména — zanedbatelné.
10) **OK** — žádný zapisovač v `characterStore.ts` nezvedá `currentHp` při růstu max HP (level up, předměty, featy stejně); Tough 63/81 je konzistentní.

## Testy
Testy B-4b/B-4c (`featInstances.test.ts`, `characterStore.test.ts`) testují to, co tvrdí; žádný neprochází z falešného důvodu. Chybí test na: Clear se spícím záznamem (nález 2), replace a čítače (nález 3), wizard held s `'invocation'` (nález 1).

## Otázky pro uživatele
- **Clear při spícím záznamu (nález 2):** (a) nechat — Clear ukáže starší spící feat (D376 doslova: první k záznamů); (b) Clear smaže i všechny spící `'invocation'` záznamy — slot je pak čistě čekající, ale vrácení invokace už starý feat nevrátí; (c) Clear přesune mazaný záznam na konec místo smazání — nic se neztratí, ale „Clear“ by nic nemazal. Doporučuji (a) a zapsat do D377, nebo (b).
- **Agonizing Blast mimo Warlocka (nález 5):** stačí doplnit D372, nebo omezit bonus na řádky Warlocka?
