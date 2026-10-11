# REPORT – Investigace: skryté prvky staršího podtřídy na třídě 2024

HEAD při startu: f100a59 (fetch + ff-merge OK, "Already up to date"). Změněno jen docs/REPORT.md, docs/DATA.md, jeden skript.

## Příčina (hypotéza z zadání vyvrácena)
Zanořené reference NEJSOU příčina. Skript replikuje pravidla 1–2 z `grantedClassFeatures.ts`: z Oath of Conquest se pouhým plain-text closure dosáhne všech 9 záznamů včetně Channel Divinity, Conquering Presence a Guided Strike. Žádný `refSubclassFeature` v datech podtříd není uvnitř počítaného `options` uzlu (0 skrytých). `header 1` ani `consumes` nic nefiltrují (kód je nečte).

Skutečná příčina: **nesoulad `classSource`**. classes.json vede Oath of Conquest (XGE) pod třídou Paladin **XPHB**, ale záznamy v subclass-features.json mají `classSource` **PHB** (edice, pro kterou byly vydány). Seed (pravidlo 1) filtruje `reached(record)`:
- `src/sheet/featureReach.ts:40` – `feature.classSource !== characterClass.classSource` → false (PHB ≠ XPHB)
- `src/sheet/grantedClassFeatures.ts:257` – seed `subclassFeatures` se tím vyřadí, closure (řádky 260–283) tak nikdy nezačne.
Tedy mizí CELÁ podtřída (Oath of Conquest, Aura, Scornful Rebuke, Invincible Conqueror, Tenets, Channel Divinity, oba Guided Strike/Conquering Presence), ne jen vnořené děti. Zbývají jen spelly přísahy (jdou jinou cestou). Stejný test používá `featureNamesFor` (`weaponAttackData.ts:192`) → i útoky/odolnosti z těchto podtříd. Průvodce podtřídou už tento nesoulad zná: `subclassData.ts:221–230` má fallback bez `classSource`; `featureReach.ts` ho nemá.
Neověřeno v běžícím UI (zákaz browseru); závěr je z kódu + dat.

## Rozsah (scripts/investigate-hidden-nested-subclass-features.js)
| třída XPHB | podtříd | zahozených záznamů | s consumes |
|---|---|---|---|
| Barbarian | 4 | 30 | 0 |
| Bard | 4 | 25 | 0 |
| Cleric | 4 | 17 | 0 |
| Druid | 4 | 20 | 2 |
| Fighter | 4 | 37 | 0 |
| Monk | 4 | 26 | 7 |
| Paladin | 3 | 27 | 6 |
| Ranger | 3 | 20 | 0 |
| Rogue | 4 | 25 | 0 |
| Sorcerer | 2 | 11 | 1 |
| Warlock | 3 | 17 | 0 |
| Wizard | 2 | 10 | 0 |
| **Celkem** | **41** (XGE 25, TCE 16) | **265** | **16** |

- Actions-řádek (proxy: `consumes` NEBO `{@action}` v textu): 30 záznamů. Proxy je hrubý, skutečné řádky určuje akční tabulka.
- 15 ze 41 podtříd je částečných (část seedů XPHB, část PHB) → ty zobrazí jen část prvků.
- class-features.json: stejný vzor nehledán u třídních prvků (nemají `subclassShortName`, třídy 2024 mají vlastní XPHB záznamy); nezjištěno nic skrytého.
- Channel Divinity spenders z DATA.md ř. 541: z 30 je **6 skrytých**, všechny Paladin PHB (Conquest, Watchers…). Cleric War XPHB v pořádku.

## Srovnání
Cleric War XPHB: seedy i Guided Strike mají `classSource` XPHB = třída → `reached` projde; tvar dat (Channel Divinity → Guided Strike, header 1, consumes) je stejný jako u Conquest. Jediný rozdíl je `classSource`.

## Varianty opravy (neimplementováno)
1. **Reach test: při neshodě `classSource` povolit podtřídní záznam, jehož (className, subclassShortName, subclassSource) sedí na zvolenou podtřídu** (jen pro záznamy s `subclassShortName`). `featureReach.ts`, tj. +1 řádek logiky; opraví i `featureNamesFor`. Riziko: duplicity jen při podtřídě, která má OBĚ edice se stejným shortName+source – skript investigate-subclass-join-collisions.js tvrdí, že kolize nejsou. Nové děti nepřidává (closure beze změny). E2E: Paladin XPHB + Conquest L3 → řádek Guided Strike v Actions a spotřeba Channel Divinity; Features zobrazí Conquering Presence jednou.
2. **Normalizace v extract-data.js** (přepsat `classSource` PHB→XPHB u záznamů starších podtříd). Čistší u zdroje, ale mění data/, rozbíjí guard v `subclassData.ts` a hrozí kolize pro podtřídy s oběma edicemi; vyžaduje re-extract. Nedoporučuji.
3. Fallback jen v `grantedClassFeatures.ts`. Nechá `featureNamesFor` rozbitý. Nedoporučuji.

**Doporučení: varianta 1.** Doplnit unit test na `buildFeatureReachTest` (PHB-záznam, XPHB třída) a e2e výše; pokrýt i částečnou podtřídu (Druid/Sorcerer).

## Otevřené otázky
- Má se oprava týkat i PHB(2014) postavy s podtřídou z XGE (dnes funguje, nesmí se rozbít)? Předpokládám ano, varianta 1 to zachovává.
- Zdokumentovat jako D-záznam? (DECISIONS.md je Vaše.)
- Až po opravě: vyroste počet řádků v Actions/Features u 41 podtříd; je žádoucí zkontrolovat vizuálně.

## Manual browser check for the user
Nic nezměněno v kódu; není co kontrolovat.
