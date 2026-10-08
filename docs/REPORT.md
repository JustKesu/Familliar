# REPORT — F-13: první výběr podtřídy při level upu nemaže dřívější volby (D338)

## Inventura `setSubclass` (`src/creation/wizardState.ts`)
| Pole | Závisí na podtřídě? | Před F-13 | Po F-13 (předchozí podtřída null) |
|---|---|---|---|
| `spellChoices` | jen u third-casterů (EK/AT) a rozšířených seznamů; při prvním výběru zůstávají picky ze základního seznamu platné | mazalo | ponechá |
| `optionalFeatureChoices` (volby podtřídy: manévry, runy…) | ano, ale bez podtřídy picker není, takže je prázdné | mazalo | ponechá |
| `wildShapeForms` | ano (Moon zvedá CR limit); první výběr limit jen zvedne nebo nechá | mazalo | ponechá |
| `subclassSpellChoices` | ano (savant/Lore sloty) | maže | maže |
| `subclassSkills`, `featureLanguages` z podtřídy | ano | maže (kromě ostatních držených tříd, M9) | beze změny |
| `classOptionalFeatureChoices` (invokace, Metamagic) | ne | nemaže | nemaže — invokace nebyly zasažené ani před opravou |

- Jednotřídní level up byl zasažený stejně (stejný reducer): `M11a finding 1` jde jednotřídní cestou `/level-up` (Warlock 2 → 3) a nový test Wizard 2 → 3.
- Tvorba na úrovni 3+: krok Spells je za krokem Class, takže při prvním výběru obvykle nic vybráno není; když hráč jde zpět a podtřídu vybere až po kouzlech, kouzla teď zůstanou (neškodné).
- Změna podtřídy (Edit, M9b, i `pruneClassPicks` podtřída → null) maže dál jako dřív. Stash ostatních tříd (`otherClasses`) beze změny.

## Co se změnilo
- `wizardState.ts` `setSubclass`: `firstPick = state.data.subclass === null` → `spellChoices`, `optionalFeatureChoices`, `wildShapeForms` zůstanou. Jedno místo, bez změny schématu.
- `wizardState.test.ts`: test „clears the Wild Shape forms…“ začíná z existující podtřídy (Circle of the Land → Moon); nový test „a first subclass pick keeps…; a change still clears them“.
- `e2e/multiclassEndToEnd.spec.ts`: `M11a finding 1` bez `test.fixme`. A a B už kouzla po výběru podtřídy znovu nevybírají; `walkLevelUp` má `kept` a před doplněním ověří počítadla, jména v Prepared Spells a vybrané invokace:
  Warlock 2→3 `Cantrips: 2/2`, `Prepared: 3/4` + 3 invokace; Sorcerer 2→3 `4/4`, `4/6`; Cleric 2→3 `4/4`, `5/6`; Paladin 2→3 `Prepared: 3/4`.
  Nový test `F-13: single-class Wizard 2 → 3` (seed Wizard 2, schema 60, `levelOrder` 2, Scholar Arcana, Bladesinger): Spells `Cantrips: 3/3`, `Prepared: 5/6` (Wizard tabulka cantrips 3/3/3, prepared 4/5/6).
- Seed B: Cleric bez Bless a Cure Wounds, Paladin Compelled Duel místo Shield of Faith — kvůli nálezu níže.
- `docs/DECISIONS.md` D338, `docs/STATUS.md` řádek F-13.

## Výsledky
- `npm run typecheck` OK; `npm test` 3246 passed (176 souborů).
- `npm run e2e` celá sada **515 passed**, 0 failed, 0 skipped, 5,4 min.

## Nový nález (potřebuje rozhodnutí)
Rozpor počítadla a validace, dosud skrytý, protože level up kouzla mazal. Kroky: seed Cleric 1 s Bless a Cure Wounds → Level up Cleric 1→2 →
„Cleric 2 → 3“ → Life Domain → Spells. Počítadlo nepočítá pick, který podtřída dává jako always-prepared (F-7b, `pickCounts`), takže ukáže
`Prepared: 3/6`; po doplnění `6/6 · full` je Next zakázaný, protože `isCompleteSpellChoices` počítá všech 8 picků ≠ 6. Hráč se dostane dál jen
tak, že Bless a Cure Wounds sám odebere (Unprepare), nic mu to neřekne. Totéž Paladin se Shield of Faith → Oath of Devotion. V Editu
pravděpodobně stejně (neověřeno). Možnosti: (a) validace počítá jako `pickCounts` (bez picků, které podtřída dává) — wizard by potřeboval
always-prepared seznam ve validaci; (b) při výběru podtřídy překrývající se picky odebrat; (c) nechat a ukázat hlášku u počítadla.

## Manual browser check for the user
- Nic vizuálního se nezměnilo.
