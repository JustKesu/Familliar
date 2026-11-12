# R-PB: code review D409–D415

Rozsah: b2f67ea (SM-3), b0733fa (SP-1), 711d9be (LS-1), eb1ca8f (AU-1), d1a96cd (SC-1), 3df8f8c (PB-1), 5a80ff1 (PB-1b). HEAD = 5a80ff1. Jen čtení kódu, nic nespuštěno (npm skripty zakázány zadáním). Data (`data/`) neotevřena; tvrzení o datech jen z DATA.md.

Celkově: žádná chyba vysoké závažnosti. Klíče zdrojů, Long/Short Rest a deduplikace řádků Actions sedí. Nálezy jsou okrajové případy a mezery v testech.

## Nálezy

1. **Střední — textové pravidlo D409 obchází zákaz z D410.** `src/sheet/featureActionRowData.ts:104-112` (`poolKeyFromText`) přidělí řádku fond třídy, kdykoli text featury, která sama zdrojem není, jmenuje fond rozdělený po třídách. D410 pravidlo „text jmenuje fond“ zamítlo (Elder Champion apod.). U multiclass Cleric + Paladin (Channel Divinity rozdělený podle D336) tak featura, která Channel Divinity jen zmiňuje, dostane políčka fondu té třídy. Hráč pak vidí políčka, kterými by „utrácel“ Channel Divinity u featury, která ho neutrácí. Nevím, které featury to v datech zasáhne. Oprava: omezit `poolKeyFromText` na ruční seznam (Psionic Power), nebo skriptem vypsat zasažené featury Cleric/Paladin a rozhodnout.
2. **Nízká — maximum Superiority Die nepočítá kostky navíc.** `src/calculation/resources.ts:188` (`LEVEL_SCALED_USES`, D410). Battle Master s featem Martial Adept nebo stylem Superior Technique má podle pravidel o 1 kostku víc, list ukáže 4 místo 5. Oprava: přičíst +1 za každý držený udělovatel kostky. Nejdřív rozhodnout (otázka 1).
3. **Nízká — hodnoty AU-1 se při hraní mění, ale utracená použití se neořežou.** Maximum ze skóre (D412) klesne, když hráč sundá předmět nebo odebere úroveň s ASI. `resourceUsesWithinMaxima` se volá jen při změně úrovně a `CharacterSheet.tsx:2585` ořezává až při dalším utracení. Uložený počet utracených tak může převýšit maximum. Jak to list vykreslí, jsem neověřil. Oprava: při vykreslení vzít min(spent, max), uložená data nechat (otázka 2).
4. **Nízká — `subclassHasSpellcasting` nekontroluje zdroj podtřídy.** `src/featAsi/featAsiData.ts:411`. Uložená postava drží jen jméno podtřídy, takže porovnává jen jméno + třída + zdroj třídy. Dnes to nevadí: `casterProgression` mají jen XPHB Eldritch Knight a Arcane Trickster (DATA.md). Ponechat.
5. **Nízká — LS-1 je správně, ale testy pokrývají jen změnu podtřídy jedním směrem.** `CharacterWizard.tsx:283-305`: přepočet je klíčovaný jménem podtřídy, předchozí požadavek se zruší (`cancelled`) a Next mezitím čeká. Sekvence A→B→A načte data znovu, takže nic nezůstane zastaralé. Reducer `setSubclass` (`wizardState.ts:1514-1540`) maže `optionalFeatureChoices` a podle D342 kouzla. Remove level s LS-1 nesouvisí, LS-1 nic neukládá navíc. Chybí ale e2e: EK (vybrat kouzla) → Champion → EK → uložit a ověřit, že na listu nezůstala kouzla z prvního průchodu.
6. **Nízká — mezery v testech (bod 8).** Unit i e2e testy ověřují skutečné chování: počty políček, utracení, obnovu po Long/Short Rest, multiclass PB podle celkové úrovně, Psionic po třídách. Nejen to, že se něco vykreslí. Chybí:
   (a) e2e, že Short Rest NEvrátí použití řádku PB-1 (Giant's Might);
   (b) unit test, že `levelRemoval` u zdroje z AU-1 zachová utracený počet (maximum je neznámé);
   (c) unit test deduplikace v `featureActionRows`, když feat a featura mají stejné jméno a obě jsou v tabulce;
   (d) e2e pro bod 5.
7. **Info — `featureActionRowData.test.ts` (D415 test) fixuje Giant's Might jako `'other'`.** Až se bude řešit bod h, musí se změnit i tento test.

Ověřeno bez nálezu:
- Klíč zdroje = `resolveResourceName(feature.name)` a sedí s `resourceName` řádku.
- 28 + 9 nových zdrojů se vrací jen na Long Rest. Short Rest se čte z textu stejně jako dosud (DATA.md: Greater Aberrant Mark a Mist Walker regex nechytí).
- Žádný jméno z tabulek není zároveň fondem z `consumes`, takže nevzniknou dva čítače (podle DATA.md, data jsem neotevřel).
- Řádky v Actions se deduplikují podle jména napříč featurou, featem i volitelnou featurou (`seen`).
- PB se bere z celkové úrovně. Při dělení fondu po třídách (D336) se `text` ani skóre nepředávají, ale žádná featura z tabulek fondem děleným po třídách není.
- Minimum 1 a kontrola textu podle edice (`isAbilityModifierCounted`) jsou v pořádku a mají unit test.
- `POOL_GRANTING_FEATURES` jde přes `resourceKey`, takže dělení po třídách (D336) dál platí.
- Battle Master se podle `subclass === 'Battle Master'` páruje správně, protože se ukládá plné jméno podtřídy.
- Řádek tříd v Review bere plné jméno podtřídy (`data.subclass.name` / `entry.subclass`), stejně jako `.sheet__classes`. Multiclass Edit jde přes `heldDraftClasses`.

## Verdikty ke známým bodům

- a) levelRemoval/multiclassLevelUp bez skóre: **ponechat**. Neznámé maximum se neořezává (`resourceUsesWithinMaxima`), takže se nic neztratí. `multiclassLevelUp` stejně předává prázdné featury. Mezera po odebrání ASI je nález 3.
- b) Flash of Genius bez obnovy na Short Rest: **opravit později**. Jde o jednu featuru Artificera EFA 18+ a stačí rozšířit regex o pořadí „When you finish a Short Rest, you regain“.
- c) Občas padající e2e SC-1 a: **opravit hned**. Pravděpodobná příčina: `walkToAsi` zkouší `count()` bez čekání (`subclassSpellcastingPrereq.spec.ts:56`, `:71`) dřív, než se krok načte, takže výběr přeskočí a Next zůstane zakázaný. Stačí počkat na obsah kroku.
- d) Spell-Storing Item, Perfected Armor, Reanimator's Skill Set: **ponechat**. Mají jiný tvar (dvojnásobek, dva počty, chybí minimum), je to zdokumentované v D412/DATA.md.
- e) Velikost kostky Superiority/Psionic se neukazuje: **opravit později**. Je to jen zobrazení a údaj je ve sloupcích tabulek. Hraní to neblokuje.
- f) Battle Master ze starší knihy bez maxima: **ponechat**. Podmínka je `classSource === 'XPHB'` u TŘÍDY a aplikace nabízí XPHB třídy, takže se to v praxi nestane.
- g) Featury, které fond utrácejí jen v próze, nemají políčka: **ponechat**. Pravidlo podle textu D410 výslovně zamítl, řešilo by se ruční tabulkou případ od případu.
- h) Giant's Might ve skupině Other: **opravit později**. Řádek i políčka existují, jen je ve špatné skupině. Oprava potřebuje rozpoznat malé „as a bonus action“ v TCE (a upravit test z nálezu 7).

## Otázky pro uživatele

1. Má Battle Master s featem Martial Adept nebo stylem Superior Technique mít o 1 Superiority Die víc? (Podle pravidel ano, dnes list ukazuje jen kostky z úrovně.) Doporučuji ano, jako samostatný malý úkol.
2. Když sundáš předmět a klesne ti třeba Charisma, má list automaticky ubrat utracená políčka Bardic Inspiration, která přesahují nové maximum? Doporučuji jen je zobrazit ořezaně a uložený počet nechat. Po vrácení předmětu se pak nic neztratí.
3. Postava Cleric + Paladin má dva oddělené fondy Channel Divinity. Má featura, která Channel Divinity jen zmiňuje (neutrácí ho), dostat jeho políčka? D409 to podle textu dělá, D410 stejné pravidlo pro jiné featury zakázal. Doporučuji nedostat: omezit to na ruční seznam (zatím jen Psionic Power).

## Použití subagenta

Žádný subagent nebyl použit.
