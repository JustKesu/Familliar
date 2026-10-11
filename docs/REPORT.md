# REPORT — F-20a: výměna jedné Eldritch Invocation / Metamagic při level upu (D345)

Repo aktuální (`git merge --ff-only` → Already up to date, HEAD `c1711a1`). STEP 1: ~8 míst se skutečnou změnou, pravidlo 5 drží bez změny schématu → implementováno. Schéma zůstává 61.

## Co se změnilo
- `src/optionalFeatures/optionSwap.ts` (nový): `SWAPPABLE_CLASS_OPTION_TYPES = ['EI','MM']`, `swappedOut` (vyměněná = držená volba chybějící ve value; žádné nové pole ve WizardData), `swapBlockedBy` (prereq blok přes `evaluateClassOptionalFeatureGroups` bez volby), `swapOut` (zahodí i `spellChoices` volby), `undoSwap`, `inheritSwapStamp`.
- `ReplaceOptionControl.tsx` (nový): fieldset „Replace one“ nad seznamem ve `ClassOptionalFeaturePicker`, jen když jsou `lockedChoices` (= level up). Tlačítka „Replace X“, zakázané s „Required by Y.“; po výběru „Replacing X…“ + „Keep X“. Vyměněná volba je v seznamu zakázaná s „Being replaced in this level up.“
- `levelGains.ts`: `LevelGain.swappable`; `classOptionalFeatures` je `swappable`, drží-li postava volbu EI/MM třídy. `levelUpSteps.ts` takový krok prochází i při `none`.
- `heldPicks.ts` `overwrittenHeldPicks`: u EI/MM toleruje 1 chybějící drženou volbu.
- `wizardState.ts` (uložení level upu): první nová volba druhu, kterému chybí držená, přebírá její `level` (i chybějící).

## Testy
- Unit: `optionSwap.test.ts` (prereq blok, prereq náhrady na nové úrovni, Tome spells pryč + Keep vrací, stamp/žádný stamp), `levelGains.test.ts` (Sorcerer 9 s MM: `swappable`, krok walked; bez MM ne).
- Upravené unit testy (staré chování „žádná výměna“): `levelUp.test.tsx` — overwrittenHeldPicks a „refuses … class optional-feature pick“ nyní ztrácí 2 volby.
- e2e `levelUpSwap.spec.ts`: a+d (Warlock 4→5 Agonizing → Repelling, 5 invokací dle EI progrese; Remove level 5 Repelling ponechá), b, c, e, f — vše prošlo.
- Upravené e2e (jen jeden Next navíc na kroku Metamagic): `multiclassLevelUp.spec.ts` „M7a b“, `multiclassEdit.spec.ts` „F-11 d“.
- typecheck, test (3283), validate-data, e2e (539) — vše zelené po úpravě dvou výše.

## Rozhodnutí během práce
- Která nová volba je „náhrada“ (pro stamp): první nová volba v uloženém pořadí (= první zaškrtnutá po kliknutí). Při Warlock 4→5 (swap + 2 nové) Remove level 5 smaže ty dvě další.
- „Keep X“ vrací volbu i její Tome kouzla a ořízne nové volby nad počet úrovně.
- Necommitnuté untracked `docs/REPORT-*.md`, `CLAUDE-1.md`, `Claude outputs/` ponechány mimo commit jako v minulých úlohách.

## F-20b podklad (ze survey)
| Druh | Kde se vybírá | Uloženo |
|---|---|---|
| Runes `RN` Rune Knight TCE L3 | krok `class`, `OptionalFeaturePicker` (CharacterWizard.tsx:1963), `lockedValues` | `optionalFeatureChoices[RN]` |
| Maneuvers `MV:B` Battle Master XPHB L3 (D345 bod 7: každý level Fightera) | totéž | `optionalFeatureChoices[MV:B]` |
| Fighting Style feat (feats.json `FS`) Fighter XPHB L1 | krok `class`, `FightingStylePicker` (CharacterWizard.tsx:1929), při level upu skrytý | `fightingStyles[]` bez stampu |
`heldPicks.ts` `missing('option', …subclassOptionalFeatures…)` a `fightingStyle` kontrola bude třeba uvolnit stejně; `SWAPPABLE_CLASS_OPTION_TYPES` rozšířit; krok `class` walked přes `swappable`.

## Manual browser check for the user
Na https://familliar.vercel.app, Warlock 4 s invokacemi → Level up → „Warlock 4 → 5“ → krok Eldritch Invocations:
- Rámeček „Replace one“ nad seznamem: tlačítka „Replace …“ a důvod „Required by …“ (u Pact of the Blade + Thirsting Blade) se nezalamují ošklivě, i na úzkém okně.
- Po kliknutí „Replace …“ řádek „Replacing … Keep …“ a zakázaný řádek vyměněné volby s důvodem vypadají čitelně.
- Totéž u Sorcerera (krok Metamagic, např. Sorcerer 4 → 5).
