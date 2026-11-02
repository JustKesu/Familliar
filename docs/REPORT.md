SP-1 ZASTAVENO v STEP 1. Žádná změna kódu, nic necommitnuto ani nepushnuto. HEAD b2f67ea (ověřeno).

## STEP 1: XPHB featury bez `consumes`, jejichž text jmenuje pool, a které by měly řádek v Actions

Zdroj: scripts/investigate-pool-grantors.js (projde class-features + subclass-features, source XPHB, bez `consumes`, text jmenuje pool z POOL_NAMES, má rest tag nebo R-frázi). Odhad, ne přesná simulace isActionTableFeature.

| Feature | Třída | Pool | Vztah k poolu |
|---|---|---|---|
| Font of Magic | Sorcerer | Sorcery Point | grant + konverze |
| Monk's Focus | Monk | Focus Point | grant |
| Combat Superiority | Battle Master | Superiority Die | grant |
| Heightened Focus | Monk | Focus Point | utrácí (Flurry) |
| Wild Companion | Druid | Wild Shape | utrácí (prózou) |
| Wild Resurgence | Druid | Wild Shape | utrácí i obnovuje |
| Archdruid | Druid | Wild Shape | obnovuje |
| Nature's Sanctuary | Land | Wild Shape | utrácí |
| Land's Aid | Land | Wild Shape | utrácí |
| Wrath of the Sea | Sea | Wild Shape | utrácí |
| Revelation in Flesh | Aberrant Mind | Sorcery Point | utrácí |
| Rend Mind | Soulknife | Psionic Energy Die | utrácí; pool dělený po třídách, D409 už platí |
| **Elder Champion** | Paladin/Ancients | Channel Divinity | **ani neutrácí, ani neuděluje**: "tvé spelly a Channel Divinity options" jen odkazuje |
| **Flurry of Healing and Harm** | Monk/Mercy | Focus Point | **neutrácí**: "bez utracení Focus Points" |
| **Wild Magic Surge** | Sorcerer/Wild Magic | Sorcery Point | **pravděpodobně jen zmínka** (první věta s poolem je tabulka surge; netestováno dál) |

Vlastní počítadlo (mají zůstat): Uncanny Metabolism, Sorcerous Restoration, Know Your Enemy; Channel Divinity a Wild Shape a Psionic Power už fungují.

## Důvod zastavení
Tabulka obsahuje featury, které pool neutrácí ani neuděluje (tučně). Zadání: nepřidávat výjimku podle jména, ale zastavit. Pravidlo "text jmenuje pool" je pro ně příliš volné.

## K rozhodnutí
Zúžit pravidlo na featury, které pool skutečně utrácí/uděluje? Možnosti:
1. Vyžadovat ve větě s názvem poolu sloveso expend/spend/regain (a ne "without expending"). Vyloučí Elder Champion, Flurry of Healing and Harm; Wild Magic Surge nutno ověřit. Je to parsování prózy (D21 to omezuje).
2. Omezit na featury s rest tagem (vynechá Heightened Focus, Nature's Sanctuary, Land's Aid, Wrath of the Sea, Revelation in Flesh; Elder Champion zůstane).
3. Přijmout i nepřesné řádky (nedoporučeno).

Dotčená místa kódu: 1 (poolKeyFromText v src/sheet/featureActionRowData.ts), plus testy a e2e; pod limitem 10.

Neuklizeno: scripts/investigate-pool-grantors.js (untracked; `git clean -fd scripts` nespuštěn, protože se nic necommitovalo).

Manual browser check for the user: none - the planning chat checks the looks from screenshots. Změněná obrazovka: žádná.
