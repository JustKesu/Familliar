# REPORT — F-20: výměna známé volby při zvýšení úrovně — ZASTAVENO po STEP 1

**STOP: kvalifikuje se 5 druhů voleb (limit zadání je 4).** Kód nezměněn, D345 nezapsáno, e2e nepsáno.
Repo bylo aktuální (`git merge --ff-only` → Already up to date, HEAD `ec1cd20`).

## Inventura (survey `scripts/investigate-f20-swap.js`, detail v DATA.md)

| Druh | Třída/podtřída, zdroj | Fráze | Kde se vybírá při level upu | Uloženo |
|---|---|---|---|---|
| Eldritch Invocations `EI` | Warlock XPHB L1 | „Whenever you gain a Warlock level, you can replace one…“ | krok `classOptionalFeatures`, `ClassOptionalFeaturePicker` (CharacterWizard.tsx:2324), held = `lockedChoices` | `optionalFeatureChoices[EI].choices{name,level,source}` + `spellChoices` (Tome) |
| Metamagic `MM` | Sorcerer XPHB L2/L10/L17 | „…replace one of your Metamagic options with one you don't know.“ | totéž | `optionalFeatureChoices[MM]` |
| Runes `RN` | Rune Knight TCE (Fighter) L3 | „each time you gain a level in this class, you can replace one rune…“ | krok `class`, `OptionalFeaturePicker` (CharacterWizard.tsx:1963), `lockedValues` | `optionalFeatureChoices[RN]` |
| Maneuvers `MV:B` | Battle Master XPHB L3 | „Each time you learn new maneuvers, you can also replace one…“ — jen na úrovních, které manévry přidávají | totéž | `optionalFeatureChoices[MV:B]` |
| Fighting Style **feat** (feats.json `FS`, ne optional feature) | Fighter XPHB L1 | „Whenever you gain a Fighter level, you can replace the feat you chose…“ | krok `class`, `FightingStylePicker` (CharacterWizard.tsx:1929) — při level upu skrytý, je-li styl držen | `fightingStyles[]{className,classSource,name,source}` — **bez level stampu** |

Mimo „volby“ (jde o kouzla): výměna cantripů (Bard, Cleric, Druid, Sorcerer, Warlock, EK, AT, Moon bard), Mystic Arcanum, Lore Magical Discoveries. Artificer plány: app je nevybírá.
Lessons of the First Ones nemá v appce žádnou uloženou pod-volbu (grep bez nálezu) — jediné pod-volby k zahození jsou `spellChoices` (Pact of the Tome).

## Odhad míst se skutečnou změnou (~14, pod limitem 25)

levelGains.ts (krok walked i bez přírůstku: EI/MM každou úrovní, RN každou úrovní Fighteru), levelUpSteps.ts, wizardState.ts (akce swap + reducer + completion počty), heldPicks.ts (`missing()` dnes hlídá, že held volba nezmizí — swap ji musí povolit), CharacterWizard.tsx ×2–3 místa, ClassOptionalFeaturePicker, OptionalFeaturePicker, FightingStylePicker, ukládání level upu (převzetí stampu), nová komponenta, unit testy, e2e.

## Otázky pro uživatele

1. **Rozsah druhů.** (a) Jen optional feature typy EI, MM, RN, MV:B = 4 → lze pokračovat v jednom úkolu; Fighting Style feat zvlášť. (b) Všech 5 → navrhuji split: **F-20a** = EI + MM (krok classOptionalFeatures, Pact of the Tome, prerekvizity, e2e a–e + Metamagic); **F-20b** = RN + MV:B + Fighting Style (krok class). Pravidlo 5 (stamp) u FS triviálně platí — styl stamp nemá.
2. **Battle Master.** Text dovoluje výměnu jen „each time you learn new maneuvers“ (Fighter BM 3, 7, 10, 15), ne při každé úrovni Fighteru. Omezit swap na tyto úrovně? (doporučuji ano — doslovně dle dat)
3. **Krok bez přírůstku.** Warlock 5→6 nepřidává invokaci, krok `classOptionalFeatures` se dnes nezobrazí. Má se kvůli „Replace one“ zobrazit při každém level upu Warlocku/Sorcereru (od úrovně, kdy volby drží)? To mění průchod wizardem (scénář e „behaves exactly as before“). Varianty: (a) ano, krok vždy walked, swap volitelný; (b) swap jen na úrovních, kdy krok beztak běží (porušuje „Whenever you gain a level“).

## Ověření

Bez změny kódu: typecheck/test/validate-data/e2e nespuštěny. Survey výstup je zdrojem tabulky.

## Rozhodnutí během práce

- Necommitnuté `docs/REPORT-*.md`, `CLAUDE-1.md`, `Claude outputs/` (untracked, přetrvávají přes předchozí commity) ponechány mimo commit.
- Commit má jinou zprávu než předepsanou (úkol nedokončen): „F-20 survey: …“.

## Manual browser check for the user

Nic — UI se nezměnilo.
