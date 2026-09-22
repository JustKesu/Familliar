import { useEffect, useState, type ReactNode } from 'react'
import type { Character } from '../storage/character'
import { loadLevelGainsFor, type LevelGains } from './levelGains'
import { levelUpTarget, MAX_CHARACTER_LEVEL, totalCharacterLevel } from './levelUpSteps'

type ButtonState = { kind: 'checking' } | { kind: 'ready'; gains: LevelGains } | { kind: 'unavailable'; reason: string }

/**
 * Raises the character by exactly one level in the class it already has (slice
 * 8d3). D43: an unavailable level up names its reason on the control itself.
 */
export function LevelUpButton({
	character,
	onLevelUp,
	loadGains = loadLevelGainsFor,
}: {
	character: Character
	onLevelUp: (gains: LevelGains) => void
	loadGains?: (character: Character, level: number) => Promise<LevelGains>
}): ReactNode {
	const target = levelUpTarget(character)
	const targetLevel = 'level' in target ? target.level : null
	const [state, setState] = useState<ButtonState>({ kind: 'checking' })

	useEffect(() => {
		if (targetLevel === null) return
		let cancelled = false
		setState({ kind: 'checking' })
		loadGains(character, targetLevel)
			.then((gains) => {
				if (cancelled) return
				setState(gains.unresolved === null ? { kind: 'ready', gains } : { kind: 'unavailable', reason: gains.unresolved })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ kind: 'unavailable', reason: `Could not read what the next level adds: ${error instanceof Error ? error.message : String(error)}` })
			})
		return () => {
			cancelled = true
		}
	}, [character, targetLevel, loadGains])

	const current: ButtonState = 'reason' in target ? { kind: 'unavailable', reason: target.reason } : state

	if (current.kind === 'ready') {
		return (
			<button type="button" className="sheet__level-up sheet__header-button" onClick={() => onLevelUp(current.gains)}>
				<UpArrowIcon />
				Level up to {current.gains.level}
			</button>
		)
	}
	const atMaximum = totalCharacterLevel(character) >= MAX_CHARACTER_LEVEL
	return (
		<button type="button" className="sheet__level-up sheet__header-button" disabled title={atMaximum ? 'Maximum level' : undefined}>
			<UpArrowIcon />
			{current.kind === 'checking' ? 'Level up (checking what the next level adds…)' : `Level up unavailable: ${current.reason}`}
		</button>
	)
}

function UpArrowIcon(): ReactNode {
	return (
		<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M6 10.5V1.5M2 5.5l4-4 4 4" />
		</svg>
	)
}
