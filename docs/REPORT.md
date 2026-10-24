# REPORT — TGS2-4c: znění 2024 a značky akcí v textu TGS2 (D387)

Setup: `git fetch`, `merge --ff-only` = už aktuální, HEAD 62fc502 při startu. Větev main.

## Co se změnilo
- `scripts/extract-data.js`: tabulka `HOMEBREW_WORDING` (klíč "subclassShortName|featura", rasa "Etherean|Etherean"), 24 dvojic
  starý → nový, aplikace po `HOMEBREW_SPLIT_OPTIONS` (Absorb Magic / Expeditious Command mají vlastní klíče). Extrakce spadne,
  když se dvojice nenajde, počet použitých ≠ očekaný, nebo ve výsledku zbyde "ki point(s)".
- Past: `mapStrings` vrací nové pole pro kořen-pole, výsledek se musí přiřadit zpět (první verze nechala holé řetězce v `entries`
  netknuté; chytil to ki guard). Zapsáno v DATA.md.
- `e2e/tgs2Wording.spec.ts` (a–d). Dokumentace: DATA.md, STATUS.md, DECISIONS.md D387.

| Featura | Před → Po |
|---|---|
| Spectral Guide | use an action to spend 2 ki points → take the Magic action and spend 2 Focus Points; harness your ki → Focus; ki save DC → DC 8 + Wisdom modifier + Proficiency Bonus |
| Ghost Walker | 1 ki point → 1 Focus Point; extra ki point → extra Focus Point; bonus action, reaction → variantrule tagy |
| Infernal Warrior | Attack action to grapple … grapple check → Grapple option of Unarmed Strike … fails its saving throw; `{@condition Grappled\|XPHB}` |
| Shrewd Consumer | Use an Object → `{@action Utilize\|XPHB}` (+ tag Bonus Action) |
| Planar Conspirator | Hit Dice → Hit Point Dice; use an action → Magic action |
| Medic | doubled proficiency → "You have Expertise in this skill." (+ 2× tag Bonus Action); Eagle Eye beze změny |
| Sight Beyond Sight | use an action to cast → take the Magic action to cast |
| Incinerating Wrath | (3rd-level version → (level 3 version; reaction tag |
| Značky Bonus Action / Reaction | Hellfire Claw, Launch, Steel Grace, Spirit Hand, Absorb Magic, Expeditious Command, Soar, Hurricane, Etherean |

## Ověřeno
- `typecheck` čistý; `npm test` 3442/3442; `validate-data` 177/177; `npm run e2e` 685/685 za 3,3 min (mírně nad 3 min).
- e2e: a) Aether 6 "2 Focus Points", žádné "ki point"; b) Steel Hawk 3 Launch v regionu Bonus Action; c) Spelldrinker 3 Absorb Magic
  v Reaction, Expeditious Command v Bonus Action, oba stále s boxy Channel Divinity; d) Mercantile 14 Shrewd Consumer obsahuje Utilize,
  ne Use an Object. tgs2ChannelDivinity a reviewFixesM10 prošly.

## Rozhodnutí v práci
- Spectral Guide: "use an action to spend 2 ki points to cast" → "take the Magic action and spend 2 Focus Points to cast" (spojení F+A).
- Infernal Warrior: "Grapple option of your Unarmed Strike" bez tagu (pro Grapple/Unarmed Strike jsem nenašel jistý XPHB tag).
- Expeditious Command: tagován jen úvodní "As a bonus action"; vnitřní "can use a bonus action to take Dash/Disengage" neměněno.
- Etherean "use an action … Ethereal Plane" ponecháno (mimo seznam F).

## K rozhodnutí uživatele
- Zda tagovat i zbylé "use an action" (Magic Coin, Money Talks, Etherean) a ostatní podtřídy mimo extrahovaných 7.
- SPEC/DECISIONS/QUESTIONS neměněno kromě přidaného D387 (zadáno).

Subagent: nepoužit. Dosud nezachycené untracked soubory (REPORT-*.md, scripts) do commitu nepatří.

Manual browser check for the user: none - the planning chat checks the looks from screenshots.
Změněné obrazovky: Features & Traits (Monk Aether, Bard Mercantile, Infernal Barbarian, Rogue Grim Surgeon), Actions (Steel Hawk, Spelldrinker, Rocborne, Aether), druh Etherean.
