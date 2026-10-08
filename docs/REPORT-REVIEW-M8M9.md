# Review M8–M9b (6fc4b77..399a8c1)

Jen code review, nic se nespouštělo (žádné testy, typecheck, e2e). Zdroje: diff levelRemoval.ts, wizardState.ts, CharacterWizard.tsx (výřezy), validate.ts, levelUpSteps.ts, RemoveLevelButton.tsx, testy (názvy + wizardState.test.ts 1530–1730).

## Nálezy

1. **high** — `src/creation/wizardState.ts:1547` + `src/toolProficiencies/classToolChoices.ts:69-75`. Save drží tool picky přes `classToolGrantsFor(classes)`, které čte jen `classes[0]`. Subclass tool kterékoli další třídy (Battle Master jako 2. třída) save vždy zahodí — nezávisle na pořadí. Sheet slot ho přitom nabízí (`CharacterSheet.tsx:3699`, `subclassToolGrantsForAll`). Scénář: Rogue 1 / Fighter 3 Battle Master, na sheetu vybrat Smith's Tools → otevřít Edit → Save bez změn → pick zmizí. Totéž level up Fightera na 3 (wizard se ptá přes `[cls]`, save zahodí) a multiclass Edit se na něj vůbec nezeptá (`wizardToolGrants` s heldClasses → jen heldClasses[0]). Fix: v save i `wizardToolGrants` použít `classToolGrantsFor([first])` + `subclassToolGrantsForAll(ostatní)` jako sheet.
2. **medium** — `wizardState.ts:743` (seed) + held větev `fightingStyles` v `saveCharacter`. Pre-58 netagovaný fighting style: seed ho nedá žádné třídě, takže aktivní Fighter má `fightingStyle: null` a class step vyžaduje styl → untouched save není možný. Když hráč styl zvolí (stejný), save zapíše netagovaný + nově tagovaný = dva styly. Dosažitelné z appky: pre-58 Fighter 3 → level up „+ New class“ Rogue (level up styl Fightera netaguje, `otherFightingStyles`). Fix: při seedu přiřadit netagovaný styl první třídě, jejíž grant level ≤ level třídy (jako `fightingStyleFor`), a při save ho nahradit.
3. **medium** — `wizardState.ts:1563-1566` (`keepRecordedLevels` s `levelUpTo` undefined). Mastery/Expertise nově zvolená v Editu nedostane level stamp; výměna stampnutého picku stamp ztratí. Remove level pak na tom levelu nic neodebere. Scénář: Fighter 4 / Rogue 1 (Rogue na char. levelu 5, Expertise stamp 5) → Edit vymění Expertise Stealth→Athletics → Remove level odebere Rogue, Athletics expertise zůstane. Platí i pro single-class Edit (pre-existing), M9b to rozšiřuje. Fix: nový pick převezme stamp nahrazeného (pozičně/podle slotu).
4. **low** — `wizardState.ts:747`. Entry s featureType, který mají v `featureTypes` dvě held třídy, dostanou oba stashe → save ho zapíše dvakrát. V XPHB datech jsem shodu nenašel (FS:F/FS:P/FS:R, EI, MM liší), proto low. Fix: claimovat entry jen první třídou.
5. **low** — `wizardState.ts:1769`. `subclassSpellChoices.subclassSource` se při save bere z lookupu, ne z uloženého záznamu; nenalezený subclass → `''`, stejnojmenný subclass jiného zdroje → přepsaný zdroj. Untouched multiclass Edit tak může přepsat záznam ne-aktivní třídy. Pre-existing vzor ze single-class. Fix: při beze změny subclassu ponechat uložený subclassSource.
6. **low** — `levelRemoval.ts:300-307`. Pool odebrané třídy se maže jen když zmizí jménem; sdílený název (Channel Divinity Cleric+Paladin) se jen clampne. Asi správně, ale netestováno.

## Verdikty
a) **bug (jinak než popsáno)**: pro postavy z appky se pořadí neliší (create = 1 třída, „+ New class“ appenduje `classesAfterLevelUp`, M8 `filter` pořadí drží, classes[0] nejde odebrat bez levelu 1); liší se jen u ručně upraveného importu (validate pořadí nekontroluje). Skutečný problém je nález 1 — ztráta nastane i při shodném pořadí.
b) **needs user decision**: v Editu volnější než level up (D329 omezuje pick zvednuté třídy Scholarem); Rogue/Wizard-Scholar dovolí Scholar expertise na Stealth.
c) **acceptable**: blokuje save jen dočasně, nic neztratí; recorded podmínky se po změně sdílených polí neinvalidují, ale per-class počty na nich v XPHB nezávisí.
d) **acceptable** (jen UI); v kombinaci s h) uživatel nevidí, které třídě pick patří.
e) **acceptable**: kanonizace + seřazení klíčů; e2e M9b h pokrývá.
f) **acceptable**; concentration na spellu z featu/species, který měla i odebraná třída, skončí neprávem — low, ne ztráta dat postavy.
g) **bug** pro styl (nález 2); optional-feature bez vlastníka s classes[0] je **acceptable** (save ho vrátí beze změny).
h) **bug**: viz nález 3 — Edit stampy nově zvolených picků nevytváří, Remove level je pak k nim slepý.
i) **acceptable**, konzistentní s F-1.
j) **potvrzeno**: `fixedLevel={totalCharacterLevel(...)}` jen přesunuto do ternáru za ClassSwitcher, beze změny; single-class save dál hází na změnu levelu (`!multiclassEdit` guard).

## Mezery v testech
- Žádný test subclass toolu ne-první třídy (Edit ani level up save); untouched test má Battle Master jako classes[0], takže chybu 1 nezachytí.
- Untouched multiclass Edit test nekontroluje `toolChoices`, `languages`, `expertiseSkills`, `featAsiChoices`, `grantedFeats`, `hitPointLevels`; `optionalFeatureChoices` jen `arrayContaining` + délka.
- Žádný test netagovaného stylu v multiclass Editu; žádný řetězec Edit (výměna mastery/expertise) → Remove level.
- e2e multiclassEdit nemá scénář pro počty Mastery/Expertise/ASI ani Hit points step (jen unit `hitDieFacesByLevel`) a nesrovnává je s level upem.
- M8: chybí test sdíleného resource poolu a concentration na spellu drženém i featem.

## Nezrevidováno
- `ClassSwitcher.tsx`, `HeldClassPrerequisiteNotes.tsx`, `multiclassPrerequisites.ts`, `ReviewStep.tsx`, `CharacterManager.tsx`, `CharacterSheet.tsx` diff, `index.css`.
- Výpočet `characterLevel` podmínky pro ASI v multiclass Editu a `useFeatAsiStepData` s `multiclassDraft` (nečteno, jen využití).
- Seed `heldClasses` lookupu (CharacterWizard ~338–360) při selhání načtení subclassů jedné třídy.
- e2e spec soubory přečteny jen po názvech testů.
