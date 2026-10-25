# REPORT — P-PSI: investigace poolu Psionic Energy Die (Psi Warrior + Soulknife)

Setup: `git fetch`, `git merge --ff-only origin/main` → už aktuální, HEAD db37335. Bez změny větve. Kód ani testy beze změny; jen DATA.md, REPORT.md a `scripts/p-psi.js` (necommitnutý, nečištěno — zadání zakazuje `git clean`).

## 1. Data (XPHB, `scripts/p-psi.js`)
- Sloupce: Psi Warrior `{@tip Number|Psionic Energy Die Number}` + `…Die Size`; Soulknife `{@tip Number|Soulknife Energy Die Number}` + `…Die Size`. Hodnoty totožné (3: d6×4 … 17: d12×12), každý na úrovni své třídy.
- Próza tabulky nazývá ještě jinak: „Psi Warrior Energy Dice table“ / „Soulknife Energy Dice table“. Všechny spendery obou podtříd píšou „Psionic Energy Die“; „Soulknife Energy Die“ jen v té jedné větě o tabulce.
- `consumes` Psionic Energy Die: Psi Warrior 7 (Protective Field, Psionic Strike, Telekinetic Movement, Psi-Powered Leap, Guarded Mind, Bulwark of Force, Telekinetic Master), Soulknife 5 (Psi-Bolstered Knack, Psychic Whispers, Homing Strikes, Psychic Teleportation, Psychic Veil) + Rend Mind jen prózou (3 kostky).

## 2. Pravidla
- Obě Psionic Power: „You regain one of your expended Psionic Energy Dice when you finish a Short Rest, and you regain all of them when you finish a Long Rest.“ Jiný trigger není (jen Psychic Whispers: první použití po Long Rest kostku nestojí).
- Rozhodující věta, v obou podtřídách stejná: „Any features in this subclass that use a Psionic Energy Die use only the dice from this subclass.“ → pravidla chtějí dva oddělené pooly.
- Multiclass text o stejnojmenných rysech (Channel Divinity, Extra Attack, Unarmored Defense) v 15 datových souborech není (0 vět); PHB kapitola o multiclassu v datech chybí.

## 3. Kód
- Rozhodnutí o poolu: `lookupInTableGroups` [resources.ts:259](src/calculation/resources.ts:259) (shoda jen `<pool>` / `<pool> Number`, ř. 273) → `poolGrantingClasses` [resources.ts:292](src/calculation/resources.ts:292), maximum `computeResourceMax` [resources.ts:316](src/calculation/resources.ts:316), dělení D336 [resources.ts:475-486](src/calculation/resources.ts:475).
- Utrácení: `resourceKeyFor` [classPools.ts:11](src/calculation/classPools.ts:11) přes `className` rysu (Fighter/Rogue); UI: [CharacterSheet.tsx:2520-2538](src/sheet/CharacterSheet.tsx:2520) (Actions, resources, maxima, legacy klíče), featureActionRowData.ts, featuresTabData.ts; rest per resource name [rest.ts:57](src/rest/rest.ts:57); level up/down `poolGrantingClassNames` (multiclassLevelUp.ts:11, levelRemoval.ts:344).
- Mechanika D336 je obecná: jakmile `poolGrantingClasses` vrátí Fighter i Rogue, vzniknou „Psionic Energy Die (Fighter)“ a „(Rogue)“, každá s maximem z vlastní tabulky a vlastní obnovou; spend, rest, legacy save, split při level upu i návrat při remove level už fungují. Split = **1 místo v kódu** (rozpoznat Soulknife sloupec v `lookupInTableGroups`, např. alias `Soulknife Energy Die` → `Psionic Energy Die`) + unit test (resources.test.ts, classPools.test.ts) + e2e (vzor `e2e/multiclassPools.spec.ts`). Odhad 1 zdrojový soubor, 2–3 testové.
- Vedlejší nález: **jednotřídní Soulknife má dnes maximum „not in the data“** (stejná příčina), takže stejná oprava opraví i ji.
- Velikost kostky aplikace nikde neukazuje (žádné `dieSize` v src/); rozdělení ji nevyžaduje.

## 4. Stejná past jinde
Žádná. Jediný count sloupec, na který nedosáhne žádné `consumes.name`, je Soulknife („Bardic Die“ je velikost kostky). Ki/Superiority Die/Arcane Shot nemají sloupec vůbec (próza, známo). TGS2: žádné table groups, žádné `consumes`, žádný prózou utrácený pool.

## Možnosti pro uživatele
- **A: dva pooly** „Psionic Energy Die (Fighter)“ / „(Rogue)“, každý svým maximem a obnovou; rysy Psi Warrior berou z Fighter, Soulknife z Rogue. Odpovídá textu XPHB.
- **B: jeden sdílený pool s vyšším maximem** — u stolu méně kostek, než pravidla dávají; rysy si kostky „kradou“.
- **C: jeden sdílený pool se součtem** — počet sedí, ale rysy jedné podtřídy mohou vyčerpat kostky druhé, což věta „only the dice from this subclass“ zakazuje.
- **Doporučení: A** — XPHB to říká výslovně a D336 to umí bez nového mechanismu.

## Rozhodnutí / otázky
- Žádné rozhodnutí nepřijato; QUESTIONS.md („Psionic Energy Die u Psi Warrior + Soulknife“) a D337(5) čekají na uživatele. DATA.md: věta „Every other pool has exactly one table owner“ (D336 odstavec) doplněna o výjimku Soulknife.

## Subagent use
Žádný subagent nepoužit.

## Ověření
Jen `node scripts/p-psi.js`; typecheck/test/e2e nespuštěny (zadání, žádná změna kódu).

## Manual browser check for the user
Nic — beze změny UI.
