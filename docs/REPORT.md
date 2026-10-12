# REPORT — F-20b: výměna runy, manévru nebo stylu boje při level upu (D345, D346)

HEAD při startu `a93655e`. Počet míst se skutečnou změnou ~9, styl boje bez změny schématu → implementováno. Schéma zůstává 61.

## Co se změnilo
- `optionSwap.ts`: `SWAPPABLE_SUBCLASS_OPTION_TYPES = ['RN','MV:B']`, `SWAPPABLE_STYLE_CLASS = 'Fighter'`, `holdsSwappableSubclassOption`, `droppedName`, `undoNameSwap` (výměna nad prostými názvy).
- `ReplaceOptionControl.tsx`: nový `ReplaceNamedPickControl` (stejné „Replace one“ / „Replacing X“ / „Keep X“, bez prerekvizit).
- `OptionalFeaturePicker` (`replaceable`): ovládání nad seznamem, vyměněná volba je v seznamu zakázaná („Being replaced in this level up.“). `FightingStylePicker` (`heldStyle`): ovládání; seznam stylů se ukáže jen při výměně, držený styl je v něm zakázaný.
- `CharacterWizard.tsx`: styl se při level upu Fightera už neskrývá; runy/manévry dostávají `replaceable`.
- `levelGains.ts` `withClassStepSwap`: krok `class` je `swappable` pro Fightera držícího styl, runu nebo manévr (→ krok se prochází při každém level upu Fightera).
- `heldPicks.ts`: povolena 1 chybějící runa/manévr; styl Fightera smí být jiný (ne null); styl Paladina/Rangera zůstává zamčený.
- `wizardState.ts` `classRecordsFor`: vyměněná runa/manévr předá level stamp náhradě (`inheritSwapStamp`). Styl stamp nemá.
- Docs: STATUS.md, D346 v DECISIONS.md.

## Testy
- Unit: `optionSwap.test.ts` (name-list swap, holds), `levelGains.test.ts` (class step swappable: styl/runa/manévr, Cleric ne), `levelUp.test.tsx` (Fighter smí změnit styl, Paladin ne).
- Upravené unit testy (staré chování „žádná výměna“): `levelUp.test.tsx` — řádek „the fighting style“ → „removed“ (null), manévry `['Trip Attack','Parry']` nyní `[]` + nový případ se 2 ztracenými.
- e2e `levelUpSwap.spec.ts` g+k (Battle Master 4→5, Parry → Feinting Attack se stampem 3, Remove level 5 ho ponechá), h (Rune Knight), i (Archery → Defense, AC + luk), j (Fighter/Paladin).
- Odchylky od zadání: h je Rune Knight 4→5 a i Fighter 4→5 (ne 3→4 / 2→3): úroveň 4 žádá ASI+mastery a úroveň 3 výběr podtřídy, výměna je stejná.
- Upravené existující e2e (krok „Class and level“ se na Fighter level upu prochází, +1 Next): `multiclassHitPoints` M4 c, `multiclassLevelUp` M7a f, `wizardF1` F-1 d a F-1 e, `wizardShell` W23 f (2×), `reviewFixes` F-10 g. Dále seed doplněn o `classSkills` (`levelOrder` M1a) a o `classSkills` + Fighterův styl (`reviewFixes` F-10 g): jejich dřívější seed nebyl stav, který app vyrobí, a krok třídy by blokoval Next.
- typecheck, test (3287), validate-data zelené. Plný e2e (543): 536 prošlo, 7 pádů byly právě výše uvedené specy; po úpravě je 6 souborů (32 testů) a `reviewFixes` (9) zelených, `levelUpSwap` 9/9. Plný běh po úpravě nebyl opakován (~8 min).

## Rozhodnutí během práce (D346)
- Runy/manévry nemají prerekvizity → žádný blok; styl a runa/manévr jsou nezávislé výměny na jednom kroku (dvě „Replace one“ skupiny u Battle Mastera).
- Vyměnit lze styl s className Fighter bez ohledu na classSource.
- Runy se na listu ukazují jako samostatná tlačítka, ne v `.sheet__feature-options`.

## Manual browser check for the user
Na https://familliar.vercel.app, Battle Master (Fighter 4) → Level up → „Fighter 4 → 5“ → krok „Class and level“:
- Dva rámečky „Replace one“ (Fighting Style a maneuvery) pod sebou se nezalamují ošklivě, i na úzkém okně.
- Po „Replace …“ u stylu se objeví seznam stylů se zakázaným starým stylem a důvodem; vypadá čitelně.
- U Rune Knighta (Fighter 4 → 5) stejně rámeček s runami.
