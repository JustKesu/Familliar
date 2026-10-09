# REPORT – M11b: multiclass e2e Wizard/Cleric a Monk/Ranger

**E2E:** 522 testů celkem = 519 passed, 0 failed, 3 skipped (`test.fixme`, viz nálezy). typecheck a `npm test` (3252) zelené. Celá sada 5,6 min. Nové zelené testy: D ≈ 36 s, E o srovnatelné délce (měřeno jen D samostatně; E běžel vedle dalších testů, přesný čas neměřen). Všech 5 nových testů je v `e2e/multiclassEndToEnd.spec.ts`, `src/` beze změny.

## Nálezy (3, pod limitem 5)
| # | Kombinace | Kroky | Očekáváno | Skutečnost | Verdikt |
|---|---|---|---|---|---|
| 1 | D (single-class repro) | Wizard 2 → 3, podtřída Evoker (stejně Abjurer, Diviner, Illusionist), Spells krok naplněn na 3/3 a 6/6 | Next povolen (oba čítače plné) | Next zůstane disabled, žádný viditelný důvod. Bladesinger projde. | Pravděpodobně bug (nebo chybějící UI pro Savant dva zdarma kouzla do spellbooku); nejisté → nález. `test.fixme` "M11b finding 1" |
| 2 | D | Wizard 3 (Bladesinger, skill vybrán) → Cleric 1, 2 → Cleric 3 s podtřídou Trickery Domain | `subclassSkills` Wizarda zůstane | `subclassSkills` existuje po Wizard 3, Cleric 1, Cleric 2; po Cleric 3 (level-up s výběrem podtřídy) zmizí. Edit pak hlásí "Bladesinger skill: — not chosen —" a zablokuje kroky od Ability scores výš (Spells nejde otevřít). | Bug (ztráta dat; F-13/D338-příbuzný, klíč `subclassSkills` ne `spellChoices`). `test.fixme` "M11b finding 2". V testu D obejito: v Editu se skill znovu vybere na kroku Proficiencies. |
| 3 | F | Paladin 1 se seedem Divine Smite + Bless → Paladin 2, krok Spells | čítač a Next souhlasí | Čítač 1/3 (Divine Smite se nepočítá), vypsané 2 picky, bez poznámky o odstraněném picku. Po doplnění na 3/3 je vypsáno 4 kouzel a Next je disabled. Čítač hlásí plno, Next odmítá. Dvojče F-14 na úrovni třídy. | Bug. `test.fixme` "M11b F (finding 3)" |

## Očekávané hodnoty a zdroje
Zdroj tabulek: `data/classes.json` přes `scripts/m11b-tables.js` (XPHB), pravidla 2024 PHB.
- D: Wizard d6, Cleric d8 (tabulka `hd`). HP = 6 + 4 + 4 (Wizard 2, 3 průměr) + 5×3 (Cleric průměr) = 29; CON 14 (+2) × 6 = 12; Dwarven Toughness +1 × 6 → **47**. Po odebrání úrovně 6: 39; po odebrání do Wizard 2: 6+4 + 2×2 + 2 = **16**.
- D saves: Wizard `proficiency` int, wis (první třída; multiclass saves nepřidává) → Intelligence, Wisdom.
- D sloty: PHB 2024 multiclass tabulka, caster level 3 + 3 = 6 → 4/3/3 (Wizard i Cleric `casterProgression: full`). Po odebrání Cleric 3: level 5 → 4/3/2. Wizard 2 samotný: tabulka Wizard 3×1st.
- D DC: PB +3 na character level 6; Wizard 8+3+INT 2 = 13, Cleric 8+3+WIS 1 = 12.
- D Channel Divinity: Cleric tabulka sloupec Channel Divinity = 2 na úrovních 2 i 3; bez suffixu, protože jen Cleric ho má.
- E: Monk d8, Ranger d10. HP = 8 + 5 + 5 + 6×3 = 36; CON 13 (+1) × 6; Toughness × 6 → **48**. Po odebrání úrovně 6: 40; Monk 2: 8+5+2+2 = **17**.
- E saves: Monk `proficiency` str, dex → Strength, Dexterity.
- E sloty: Ranger jediný caster (`casterProgression: artificer` = polovina, vlastní tabulka), `rowsSpellProgression` úroveň 3 = 3×1st, 0×2nd. Ranger 2: 2×1st.
- E AC: Unarmored Defense 10 + DEX (15+1 Soldier = 16 → +3) + WIS 14 (+2) = 15.
- E Focus Points: Monk tabulka sloupec Focus Points na úrovni 3 = 3. Martial Arts: sloupec úroveň 3 = d6 → 1d6 u Unarmed Strike.
- E Favored Enemy: Ranger tabulka = 2 na úrovni 3 (Hunter's Mark 2/2).
- E Ranger multiclass: `multiclassing.proficienciesGained` = martial weapons, light/medium armor, shield, 1 skill ze seznamu. Monk již má "Martial weapons with the Light property", proto regex `Martial weapons(?! with the Light property)`.
- Spell čísla: Cantrips Wizard 3, prepared 4/5/6 (úr. 1–3); Cleric cantrips 3 (+1 Thaumaturge), prepared 4/5/6; Ranger prepared 2/3/4; Paladin prepared 2/3 (tabulky).

## Seedováno místo klikáno
Pouze úroveň 1 (schema 60, `levelOrder`, všechny picky úrovně 1): Wizard (INT 15, WIS 13, CON 14; kouzla Fire Bolt, Light, Mage Hand, Magic Missile, Shield, Detect Magic, Mage Armor), Monk (DEX 15, WIS 14; skills; `toolChoices` Lute – bez něj Edit blokoval krok Proficiencies, protože Monk tool "not chosen"), Paladin 1 (check F) a Wizard 2 (nálezy 1 a 2, jako F-13). Vše ostatní přes UI. Divine Order (Thaumaturge) se u Cleric 1 volí jen pokud je nabídnut.

## Rozhodnutí / poznámky
- D používá Bladesinger místo Evokera kvůli nálezu 1; WIS 13 místo 14, aby se DC Wizarda (13) a Clerica (12) lišila.
- Ranger weapon mastery picky (Dagger, Shortsword) a Defense jako fighting style vybrány testem; Hunter + Colossus Slayer podle nabídky.
- Fixme testy 1–3 jsem před přepnutím na fixme spustil a ověřil, že padají (nález 3 ve finální zkrácené podobě už nespuštěn; pozorované hodnoty v komentáři).
- Stale/nezměněno: DECISIONS/SPEC/QUESTIONS nedotčeny. DATA.md: nic nového o datech (nálezy jsou chování appky).

## Ruční kontrola v prohlížeči (uživatel)
Vše chování pokrývají scénáře M11b D, E; rozložení/vzhled: zkontrolovat na https://familliar.vercel.app multiclass postavu Wizard 3 / Cleric 3 a Monk 3 / Ranger 3 – štítky tříd u kouzel (zalamování "Wizard"/"Cleric" podtitulku), dvě řady Hold Person vedle sebe, čitelnost Focus Point / Favored Enemy krabiček. Nic dalšího nelze automatizovat vizuálně.
