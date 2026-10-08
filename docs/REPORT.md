# REPORT — M9b: UI Editu multiclass postavy, Edit odemčený (D333)

Krok 1: všechna místa 1, 2, 14–27, 29–32 z inventury M9 existují, pokrytá rozhodnutími → bez STOP. Schéma 60 beze změny.

## Změny po místech
- **1, 2** `editCharacterBlockedReason` (levelUpSteps.ts): tlačítko Edit vypnuté jen u multiclass bez konzistentního `levelOrder`, text „Edit character“, `title` „Edit unavailable: Cannot tell…“; route bounce jen tehdy. Text „cannot be edited yet“ pryč.
- **14** seed effect načte subclasses + featureTypes každé držené třídy (`WizardSeedLookups.heldClasses`).
- **15–17** `multiclassEdit`; `draftClasses` = uložené třídy s podtřídami ze stashe (`heldDraftClasses`), `multiclassDraft` = ty + uložený `levelOrder`; `draftCharacterLevel` = součet.
- **18** jazykové/subclass-skill granty ze všech tříd; tool granty první uložené třídy (`classes[0]`, jak je drží save). Nová podmínka `heldClasses`.
- **19** `ClassSwitcher.tsx` místo `ClassPicker`; class skills = první třída (D321).
- **20, 21** jeden MasteryPicker/ExpertisePicker pro všechny třídy, počty sečtené per třída na zamčené úrovni (`sharedMasteryCount`, `sharedExpertise`).
- **22–26** classSkillsSource = firstClass; featAsi přes `multiclassDraft` + celková úroveň; HP: `hitDieFacesByLevel` (každá úroveň proti své kostce), průběžné max HP s historií.
- **27** „Already prepared by“ z ostatních držených tříd. **29** `HeldClassPrerequisiteNotes.tsx` + `heldClassPrerequisiteNote`. **30** `MulticlassPickSlots` pro každou ne-první třídu, podmínka `multiclassPicksComplete`.
- **31** Review: řádek tříd, kostky, `.review__unfinished` z `unfinishedHeldClasses`. **32** Cancel přes `sameWizardData` (pořadí aktivní třídy ignoruje).

## Ověření
- typecheck OK; test 3199/3199 (nový `multiclassEdit.test.ts`); validate-data 175/175; e2e 485/485 za 5,3 min (nad ~3 min, známé).
- `e2e/multiclassEdit.spec.ts` a–h: a) invokace + Metamagic přes přepínač, „Already prepared by Warlock“, Review „Warlock 6 / Sorcerer 3“ + „6d8 + 3d6“, classes/levelOrder v localStorage beze změny; b) Life → Light, nová Cleric kouzla, Light řádky, Life pryč, Wizard kouzla beze změny; c) STR i DEX pod 13 (obě poznámky Fighter OR + Rogue), Save funguje; d) bez levelOrder: disabled + title, URL zpět; e) neúplný Cleric ve stashi: Save vypnutý, řádek „Cleric has unfinished choices: choose 3 more cantrips, choose 6 more spells. Switch to Cleric in step Class to finish them.“, po doplnění Save zapnutý; f) Rogue multiclass skill Stealth → Deception; g) jednotřídní Fighter → Rogue; h) Cancel bez změny / se změnou ve stashi.
- Upraveny `multiclassGuard.spec.ts` a–b (title místo textu), `multiclassLevelUp.spec.ts` g (Edit povolený).

## Rozhodnutí během práce / k posouzení
- g): úroveň v jednotřídním Editu měnit nejde (dosavadní `fixedLevel` + throw v `saveCharacter`); test ověřuje vypnutý select Level. Zadání „změnit třídu a úroveň“ tak platí jen pro třídu.
- Expertise: neomezená, má-li ji kterákoli třída neomezenou, jinak sjednocené seznamy (M9 místo 21).
- Mastery/Expertise picker se ukazuje za aktivní třídu, nemá-li žádnou, za první třídu s grantem.
- Stashovaná třída se posuzuje podmínkami z doby, kdy byla naposled aktivní; nikdy aktivní = jako uložená; změněná podtřída, jejíž data se nestihla načíst = „requirements still loading“, dokud se na ni nepřepne.
- Neúspěšné načtení multiclass slotů požadavek uvolní (chybu ukáže slot), jako F-1.
- Otázka: save drží tool granty `classes[0]`, kdežto multiclass picky řeší `firstClass` podle `levelOrder`; u postavy, kde se to liší, by subclass nástroj ne-první třídy (Battle Master) Edit zahodil. Nechal jsem jako dřív.
- DECISIONS.md: přidán D333 (vč. potvrzení dvou rozhodnutí M9a a formátu řádku Review). STATUS.md aktualizován. DATA.md beze změny (žádné nové zjištění o datech).

## Manual browser check for the user
- Edit multiclass postavy, krok **Class and level**: přepínač tříd (tlačítka „Warlock 6 (Fiend Patron)“…) při 1366 a 1920 px a na šířce telefonu, tmavé i světlé téma — zalamování, zvýraznění aktivní, text nápovědy pod ním.
- Krok **Ability scores**: tlumená poznámka pod tabulkou (velikost, barva).
- Krok **Review and save**: řádek „<Class> has unfinished choices…“ (barva, zalamování).
- Krok **Proficiencies**: sloty „Rogue multiclass skill:“ v Editu vedle ostatních slotů.
- Sheet multiclass postavy bez historie: tooltip vypnutého tlačítka Edit character.
