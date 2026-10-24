# R-TGS2 — code review homebrew bloku TGS2

HEAD 80a0220 (fetch + ff-only: already up to date). Rozsah: ff9d81f…80a0220, D365–D371, D386–D388. Jen čtení kódu, žádné npm, žádný subagent.

## Nálezy (podle závažnosti)

1. **Střední — `HOMEBREW_WORDING` nahradí jen první výskyt, guard to nepozná.** `scripts/extract-data.js:1606-1610`: příznak `found` po prvním zásahu vypne další nahrazení v celé featuře; guard (`:1611`, `:1672`) počítá jen „dvojice se uplatnila aspoň jednou". Scénář: featura má „you can use your reaction" dvakrát (nebo „an extra ki point" ve dvou odstavcích) → druhý výskyt zůstane ve znění 2014 bez značky, extrakce projde; ki-guard (`:1673`) chytí jen „ki point", ne „bonus action"/„reaction"/„Hit Dice". Oprava malá: po smyčce `if (JSON.stringify(node).includes(from)) throw` (žádné `to` neobsahuje svoje `from`, ověřeno u všech 30 dvojic), nebo nahrazovat všechny výskyty a počítat je. Zda dnes nějaký druhý výskyt existuje, review bez otevření dat neověří — první běh extrakce s tímto guardem to řekne.
   mapStrings past (D387) je ošetřená správně: `applyWording` přiřazuje výsledek do `node` i do `feature.entries`/`entry.entries` (`:1616-1617`), rest-tagy do `feature.entries` (`:1622`), `additionalSpells` (`:1641`). `mapStrings(entry, redirectTags)` (`:1653`) výsledek zahazuje, ale vstup je objekt, který se mutuje na místě → funguje. Do oficiálních dat se nic nedostane: všechno běží nad nově načteným homebrew souborem, `readJson` oficiálních souborů jen čte.
2. **Nízká–střední — `HOMEBREW_REST_FEATURES` guard nemůže vystřelit pro 4 ze 6 featur.** `:1621`: bez `sentence` je `swapped = true` předem a `stats.restFeatures++` proběhne, i když regex `short/long rest` nic nenašel (Launch, Bloodbound, Hurricane, Arcane Conduit). Scénář: přejmenovaná featura nebo text „rests" → žádný tag, žádné počítadlo, extrakce projde. Kryje to jen e2e `tgs2Pools`. Oprava malá: počítat zásahy regexu, throw při 0.
3. **Nízká — `HOMEBREW_SUBCLASS_TABLES` nemá guard.** `:1636-1637`: překlep v klíči = tichý no-op; existující `subclassTableGroups` se přepíše bez kontroly. Oprava: throw, když `entry.subclassTableGroups` už existuje, a kontrola „každý klíč použit" vedle `missing` (`:1660`).
4. **Nízká — `HOMEBREW_SUBCLASS_SPELLS` hlídá jen kolizi, ne neuplatnění.** `:1639-1640`: klíč bez shody = tichý no-op (kryje e2e `tgs2Spells`). Oprava stejná jako 3.
5. **Nízká — `HOMEBREW_RACE_2014_BLOCKS` bez guardu.** `:1651`: jiný název bloku zůstane v datech; kryje jen e2e TGS2-2 a. Oprava: spočítat odstraněné bloky na rasu, throw při 0.
6. **Pokrytí testy — chybí multiclass.** D371: žádný test „Psi Warrior/Steel Hawk Fighter + Wizard" (cesta `own.length === 0 && bySubclass.length === 1`, `src/sheet/spellActionRowData.ts:138-139`, jednotkový test má jen Fighter+Wizard s `chosenBy`). D386: žádný test Paladin Spelldrinker + Cleric (oddělené pooly `Channel Divinity (Paladin)`/`(Cleric)` přes `resourceKeyFor`). Logika obojího podle čtení sedí; jde o chybějící ochranu, ne o chybu. Oprava: dva unit testy, malé.

Ověřeno bez nálezu:
- **D371 / casterFor** (`src/sheet/CharacterSheet.tsx:2461`): subclass entry vzniká jen pro třídu bez vlastního `spellcastingEntries` záznamu (shoda className+classSource). Psi Warrior × Eldritch Knight konflikt neexistuje — jedna Fighter třída má jednu podtřídu; EK dává Fighterovi class entry a jeho `additionalSpells` `ability` nemá. Multiclass Psi Warrior + Wizard: Telekinesis bez Wizard origin → Fighter INT; s Wizard origin → Wizard INT (stejná vlastnost). Okrajově: Aether Monk + Wizard, sloučený Mage Hand jde přes Wizard INT místo WIS — bez vlivu, Mage Hand nemá útok ani záchranu.
- **SHARED_OWNERS** (`src/calculation/freeCastResources.ts:34`): klíč je `originName` „Way of the Aether" + kouzlo etherealness, jiné postavy ani jiné zdroje Etherealness to nezasáhne.
- **HOMEBREW_SPLIT_OPTIONS** (`:1586-1600`): nové záznamy nesou `className: "Paladin"` z rodiče → `resourceKeyFor` je v multiclassu přiřadí k poolu Paladina. Guard (`:1592`, `:1669`) padá při chybějící volbě i rodiči. Wording se aplikuje až po splitu, klíče `Spelldrinker|Absorb Magic` sedí.
- **Značky akcí** (D387/D388): `classifyActionType` vrací jeden typ podle prvního rámce → žádné dvojité řádky; Ghost Walker (BA i Reaction) jde pod Bonus Action.
- **OFFICIAL_SUBCLASS_SPELL_ABILITY** (`:2356-2360`): přesná shoda `className|name|source`, throw při nenalezení, chybějícím `additionalSpells` i už existujícím `ability`. Zasáhne jen Psi Warrior|XPHB.
- **HOMEBREW_KEEP** (`:1660-1664`) a **HOMEBREW_RACE_RESIST** (`:1648`, `:1665`) mají plné guardy.

## Verdikty a–g

- a) Damage ridery jen text — **keep** (stejně jako oficiální ridery; čeká na krok útoků).
- b) Rest tagy → 6 featur v Actions — **keep**, je to účel D367/D86.
- c) Řádky bez počítadla (Medic, Soar, Steel Grace, Spirit Hand) — **keep**; `featureActionRowData.ts:119` kvalifikuje i podle typu akce, stejně jako oficiální featury.
- d) Grapple option bez značky — **fix later**, jen chybí odkaz, chování neovlivní.
- e) Vnitřní „bonus action" v Expeditious Command — **keep**; řádek už je pod Bonus Action (e2e TGS2-4c c).
- f) Psi Warrior TCE — **keep**; TCE verzi nahrazuje XPHB (`removeSuperseded`), neextrahuje se.
- g) Money Talks bez vlastního e2e — **fix later**; náhrady hlídá guard extrakce, zařazení je stejné jako u Magic Coin (TGS2-4d c).

## Otázky pro uživatele

1. Nálezy 1–5 (guardy v `loadHomebrew()`): opravit najednou v jednom malém tasku (návrh D389), nebo jen 1 a 2?
2. Nález 6: přidat dva multiclass unit testy do stejného tasku?
