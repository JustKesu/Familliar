import { useEffect, useState, type ReactNode } from 'react'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import { CharacterWizard } from '../creation/CharacterWizard'
import { levelUpTarget } from './levelUpSteps'
import { loadLevelGainsFor, type LevelGains } from './levelGains'

type GateState = { kind: 'loading' } | { kind: 'ready'; gains: LevelGains } | { kind: 'unavailable' }

/**
 * The level-up route (rework R1b) carries only the character's id in the
 * URL, not the LevelGains LevelUpButton computes to enable its own click —
 * so an F5 on this route has nothing to resume from but the character
 * itself. levelUpTarget + loadLevelGainsFor are pure/deterministic over the
 * stored character (D101), so recomputing them here on mount is exactly
 * what the button already does, just without a click to trigger it.
 */
export function LevelUpWizardGate({
	store,
	character,
	onSaved,
	onCancel,
	onUnavailable,
}: {
	store: CharacterStore
	character: Character
	onSaved: (character: Character) => void
	onCancel: () => void
	/** The character cannot be levelled up right now (already resolved, at level 20, multiclass, …) — the caller decides where that bounces to. */
	onUnavailable: () => void
}): ReactNode {
	const target = levelUpTarget(character)
	const targetLevel = 'level' in target ? target.level : null
	const [state, setState] = useState<GateState>({ kind: 'loading' })

	useEffect(() => {
		if (targetLevel === null) {
			onUnavailable()
			return
		}
		let cancelled = false
		loadLevelGainsFor(character, targetLevel)
			.then((gains) => {
				if (cancelled) return
				if (gains.unresolved === null) setState({ kind: 'ready', gains })
				else onUnavailable()
			})
			.catch(() => {
				if (!cancelled) onUnavailable()
			})
		return () => {
			cancelled = true
		}
	}, [character, targetLevel, onUnavailable])

	if (state.kind === 'ready') {
		return <CharacterWizard store={store} character={character} levelUp={state.gains} onSaved={onSaved} onCancel={onCancel} />
	}
	return <p>Loading what the next level adds…</p>
}
