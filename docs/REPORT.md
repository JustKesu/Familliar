# F-B1: opravy z review bloku B (D379)

Setup: fetch + `merge --ff-only` = již aktuální, HEAD 51f669f. Krok 1 (tabulka míst): 10 zdrojových míst (+ testy, docs), pod limitem 20.

## Co se změnilo
- **Nález 1** — wizard (level up, Edit): `draftFeatInstances` teď nese `optionalFeatureChoices` (aktivní třída + stashe `otherClasses` + uložené typy, které wizard nedrží), takže feat z Lessons je vzhůru a `featAsiManualFeats` ho předá do `grantedFeatsOf` s popiskem „From Lessons of the First Ones“ (nový volitelný `label`). Blokuje opakování na ASI úrovni i u species/background feat.
- **Nález 2** — `setInvocationFeat(…, null)` smaže všechny uložené záznamy `'invocation'` (i spící) a jejich `#invocation:<id>:` čítače; chyba „No invocation feat at position n“ platí dál.
- **Nález 3** — výměna za jiný feat smaže čítače původního záznamu (stejný feat je nechá). `writeWithoutFeat` bere seznam klíčů.
- **Nález 4** — `heldInvocations(character)` (featInstances.ts) je jediná sbírka: slots, Agonizing Blast, Eldritch Mind, attacks per action (CharacterSheet.tsx). Thirsting Blade z předmětu se tím počítá.
- **Nález 5** — `SpellCaster` má volitelné `className` (z `toCaster`); `agonizingBlastFor(caster, held)` vyžaduje `className === 'Warlock'` (spellActionData i SpellTabRow). EB od Wizarda/featu/druhu/předmětu bonus nemá; EB z předmětu-invokace počítaný s Warlock čísly (D325/R14c1) ho má, protože sesílatelem je Warlock.
- D379 v DECISIONS.md, STATUS.md doplněn. Bez změny schématu.

## Co se ověřilo
- typecheck OK; test 187 souborů / 3417 OK (jedna očekávaná úprava `customItemGrants.test.ts` o `className`); validate-data 177/177; e2e 656/656 za 2,3 min.
- Nové unit testy: store (Clear maže i spící + čítače; výměna maže čítače jen při jiném featu), `heldInvocations`, `agonizingBlastFor`.
- Nové e2e `e2e/reviewFixesB1.spec.ts`: a) Edit Warlocka 4 s Alertem z Lessons — Alert na ASI úrovni disabled „already taken“; b) dva uložené záznamy, Clear — čekající řádek, nic se nevrátí, `grantedFeats` undefined; c) Thirsting Blade jen z předmětu — Attacks per Action 2; d) Wizard s Agonizing z předmětu — EB bez `+`; d2) Warlock — „1d10 + 3“.

## Rozhodnutí a poznámky
- Wizard drží u multiclass level upu jen uložené picks typů, které žádná aktivní/stashnutá třída neobsahuje; Lessons zvolená v téže session v nestashnuté třídě se bere z wizardu (aktivní třída). Dostačuje; hraniční případ jiné třídy s EI neexistuje (EI má jen Warlock).
- Nálezy 6 a 7 ponechány dle zadání.

## Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Manage Feats (Clear u Lessons feat), ASI / Feat krok v Edit/level up (Alert „already taken“ u Lessons feat), Spells a Actions (Eldritch Blast bez bonusu mimo Warlocka), Actions (Attacks per Action z Thirsting Blade předmětu).
