# REPORT – F-15: opravy nálezů M11b (D340)

## Příčiny
| Nález | Příčina (před opravou) | Oprava | Míst |
|---|---|---|---|
| 1 Savant | Ne rozbitý stav: `isStepComplete('spells')` správně čeká na `subclassSpellChoices` (`wizardState.ts:967`), `SubclassSpellChoicePicker` existuje, ale byl renderován až POD celým katalogem kouzel třídy (`CharacterWizard.tsx:2292`), mimo dohled. M11b agent ho nenašel (ověřeno diagnostikou: "0 of 2 Evoker spells chosen." na konci panelu). | Picker přesunut nad `ClassSpellsManager` (`CharacterWizard.tsx:2246`). | 1 |
| 2 subclass skills | `setSubclass` držel jen skills/jazyky z grantů `otherClasses` (Edit stash, `wizardState.ts:1423–1440`); level up stash nemá → Bladesinger skill smazán. | Maže jen granty aktivní třídy: nová `classSubclassGrantSources(className)` (`subclassSkillGrants.ts:92`), reducer `wizardState.ts:1423`. | 3 |
| 3 Divine Smite | Efekt načítající class always-prepared (`CharacterWizard.tsx:~987`) nevolal `dropAlwaysPreparedPicks`; ten navíc vyžadoval `subclassName`. | Dispatch s `subclassName: null`; `DroppedAlwaysPrepared.subclassName: string \| null`; reducer guard; filtr poznámky; text poznámky jmenuje třídu. | 6 |

Všechny class granty jdou stejnou cestou (`loadClassAlwaysPreparedSpells` podle třídy a úrovně): Paladin Divine Smite 2, Find Steed 5; Druid Speak with Animals 1, Find Familiar 2; Ranger Hunter's Mark 1; Warlock Contact Other Plane 9; Bard Power Word Heal/Kill 20 (skript nad `data/classes.json`, shoduje se s DATA.md „Class-record additionalSpells“). Granty z úrovně 1 se ve výběru už nenabízejí, drop je u nich no-op.

## Změny
- `src/creation/CharacterWizard.tsx`: pozice Savant pickeru; dispatch dropu pro class granty; filtr poznámky (`subclassName === null`).
- `src/creation/wizardState.ts`: `setSubclass` (D340 bod 2), `dropAlwaysPreparedPicks` přijímá `subclassName: null`.
- `src/classSkills/subclassSkillGrants.ts`: `classSubclassGrantSources`.
- `src/creation/DroppedAlwaysPreparedNote.tsx`: „… always prepared by {subclass ?? class} …“.
- Testy: `wizardState.test.ts` (+3: Savant gate, class drop, setSubclass jiné třídy), `subclassSkillGrants.test.ts` (+1), nový `DroppedAlwaysPreparedNote.test.tsx` (2).
- e2e `multiclassEndToEnd.spec.ts`: 3× `test.fixme` → `test` s reálnými asercemi; `walkLevelUp` vyplňuje prázdné Savant sloty (`fillSavantSlots`); D používá Evoker, workaround s výběrem skillu v Editu odstraněn.
- Test D s Evokerem nemá Bladesinger skill, takže místo „skill zůstal po Cleric 3“ kontroluje, že Wizardovy `subclassSpellChoices` přežijí Cleric 3 i Edit. Skill po Cleric 3 + Edit bez znovuvýběru (Spells krok Wizarda otevíratelný) kontroluje test „M11b finding 2“.
- Docs: D340 (DECISIONS.md), STATUS.md. DATA.md beze změny (class granty už zapsané).

## Ověření
- `npm run typecheck` OK; `npm test` 178 souborů, 3258 testů zelených.
- e2e cíleně M11b: 5/5 passed (42 s).
- Celá e2e sada: 522 passed, 0 failed, 0 skipped, žádný `test.fixme` nezbyl; 6,3 min (nad limitem 3 min).

## Rozhodnutí během práce
- Nález 1 opraven přesunem (viditelnost), ne změnou podmínky — pravidlo (Savant picky povinné) zůstává.
- `setSubclass` bez `classChoice` nemaže nic (v UI nenastává).

## Ruční kontrola v prohlížeči (uživatel)
Na https://familliar.vercel.app:
- Wizard 2 → Level up Wizard 2 → 3, podtřída Evoker, krok Spells: blok „0 of 2 Evoker spells chosen.“ se dvěma rozbalovacími seznamy „Level 3 choice:“ je nahoře nad kartou kouzel třídy — posoudit vzhled a odsazení (picker je mimo `wizard__card`).
- Paladin 1 s vybraným Divine Smite → Level up Paladin 1 → 2, krok Spells: poznámka „Divine Smite is always prepared by Paladin and was removed from your picks.“ nad počítadlem — zalamování.
