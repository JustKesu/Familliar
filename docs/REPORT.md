# Report — F-8: opravy po review M1 (schéma zůstává 59)

## Co se změnilo
- Čtení + import (jen postavy, které už byly ve schématu 59): `withRepairedFields` (validate.ts), volané z `parseStoredCharacters`. Špatné `play.concentratingOn` → zahozeno; `fightingStyles` → první položka na vlastníka, špatně tvarované pryč (neřadí-li se k poli, zůstává fatální); ruční feat bez id / s id mimo formát / s duplicitním id → deterministické id; `id` na ne-manual featu se zahodí v `toCharacterGrantedFeats` (už není fatální).
- Schéma fallback id: pozice mezi ručními featy (pravidlo migrace 58→59: "0","1",…); je-li zabraná, `repaired-<n>`, pak `repaired-<n>-2`, … Zabraná id (všechna platná, první držitel) se sbírají předem, takže kolize nevznikne.
- Formát id `^[^:#|]+$` (`isValidManualFeatId`), validátor ho vynucuje na zápisu.
- Zápis: nový `CharacterStore.writeChanged` (describeCharacterError → `ImportValidationError`, než se zapíše). Použit v setHitPoints, setResourceUses, setSpentSpellSlots, setSpentHitDice, setConcentration, setHeroicInspiration, writePlay, applyRest, writeGrantedFeats, removeManualFeat.
- `removeManualFeat`: jeden zápis; vyhodí „No manual feat at key: <key>“ před jakoukoli změnou; odebere i legacy čítač `spell:feat:<jméno>:…`, pokud nezůstala jiná instance (grantedFeats, featAsiChoices, custom feats v inventáři).
- `hasFightingStyle`: záloha podle jména jen když v `feats` není žádný řádek toho jména.
- Migrace 56→57: `levelOrder` se nestaví pro level > 20 (ani necelé/záporné).
- Testy: levelRemoval — první test s `pickSources` a doloženým rozdílem (zdroj doplněn na stylu), `fighter4()` typované `CharacterCreateInput` se `fightingStyles`; characterStore (oprava po jednom případu na pole, import, write guard, removeManualFeat, legacy čítač); choiceMatch; migrations. Dva staré testy „odmítne uložené…“ (concentration `7`, fightingStyles se špatnými položkami) přepsány na „opraví“; „fightingStyles není pole“ zůstává fatální.
- e2e `storageRepair.spec.ts`: seed schéma 59 (validní postava + postava s holým řetězcem concentration a ručním Tough bez id) → oba na seznamu, list se otevře bez koncentrace, Tough v Features & Traits, odebrání v Manage Feats přetrvá reload.
- Docs: D320 (DECISIONS), STATUS. DATA.md beze změny.

## Ověřeno
- typecheck OK; `npm test` 166 souborů / 3061 testů OK; validate-data 174/174.
- e2e: plný běh 429 passed, 1 failed (můj nový spec: selektor `.char-grid > li` počítal i dlaždici „nová postava“); po opravě na `.char-grid .char-card` spuštěn samostatně → passed. Plný běh po opravě znovu neběžel (5,0 min); zbylých 429 se opravou nedotkla.

## K rozhodnutí
- Rozhodnuto při práci: repair se aplikuje jen na záznamy původně ve schématu 59 (starší zůstávají odmítány jako dřív); `fightingStyles`, které není pole, zůstává fatální (zadání mluví jen o položkách).
- `writeChanged` je v každém setteru, který píše `play`/`grantedFeats`; ostatní setery (languages, toolChoices, spellChoices, wildShapeForms, inventář) ho nemají.

## Manual browser check for the user
Žádná — nic vizuálního se nezměnilo.
