import { useEffect, useState, type ReactNode } from 'react'
import type { Character } from '../storage/character'
import { loadLevelGainsFor, type LevelGains, type LevelUpClass } from './levelGains'
import { totalCharacterLevel } from '../calculation/characterLevel'
import { levelUpClassOptions, MAX_CHARACTER_LEVEL } from './levelUpSteps'
import { LevelUpClassDialog, type ClassFailure, type NewClassList } from './LevelUpClassDialog'
import { loadNewClassOptions, type NewClassOption } from '../multiclass/multiclassPrerequisites'

type ButtonState = { kind: 'checking' } | { kind: 'ready'; choices: LevelGains[]; failures: ClassFailure[] } | { kind: 'unavailable'; reason: string }

/**
 * Raises the character by exactly one level (slice 8d3). D43: an unavailable level up names its reason on the control itself.
 * D329/D330: a click first asks which class — one held, or a new one through "+ New class…".
 */
export function LevelUpButton({
	character,
	onLevelUp,
	loadGains = loadLevelGainsFor,
	loadNewClasses = loadNewClassOptions,
}: {
	character: Character
	onLevelUp: (gains: LevelGains) => void
	loadGains?: (character: Character, target: LevelUpClass) => Promise<LevelGains>
	loadNewClasses?: (character: Character) => Promise<NewClassOption[]>
}): ReactNode {
	const allowed = levelUpClassOptions(character)
	const [state, setState] = useState<ButtonState>({ kind: 'checking' })
	const [choosing, setChoosing] = useState(false)
	const [newClasses, setNewClasses] = useState<NewClassList>({ kind: 'loading' })

	useEffect(() => {
		if (!choosing) return
		let cancelled = false
		setNewClasses({ kind: 'loading' })
		loadNewClasses(character)
			.then((options) => {
				if (!cancelled) setNewClasses({ kind: 'ready', options })
			})
			.catch((error: unknown) => {
				if (!cancelled) setNewClasses({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [choosing, character, loadNewClasses])

	useEffect(() => {
		const next = levelUpClassOptions(character)
		if ('reason' in next) return
		let cancelled = false
		setState({ kind: 'checking' })
		// F-10: a held class that fails or cannot be resolved disables only its own row; "+ New class…" does not depend on it.
		Promise.allSettled(next.options.map((option) => loadGains(character, { className: option.className, classSource: option.classSource }))).then((settled) => {
			if (cancelled) return
			const choices: LevelGains[] = []
			const failures: ClassFailure[] = []
			settled.forEach((result, index) => {
				const option = next.options[index]!
				if (result.status === 'fulfilled') choices.push(result.value)
				else {
					const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
					failures.push({ className: option.className, classSource: option.classSource, classLevel: option.level + 1, reason: `Could not read what the next level adds: ${message}` })
				}
			})
			setState({ kind: 'ready', choices, failures })
		})
		return () => {
			cancelled = true
		}
	}, [character, loadGains])

	const current: ButtonState = 'reason' in allowed ? { kind: 'unavailable', reason: allowed.reason } : state

	if (current.kind === 'ready') {
		return (
			<>
				<button type="button" className="sheet__level-up sheet__header-button" onClick={() => setChoosing(true)}>
					<UpArrowIcon />
					Level up to {totalCharacterLevel(character.classes) + 1}
				</button>
				{choosing && (
					<LevelUpClassDialog
						choices={current.choices}
						failures={current.failures}
						newClasses={newClasses}
						onChoose={(gains) => {
							setChoosing(false)
							onLevelUp(gains)
						}}
						onChooseNew={async (target) => {
							try {
								const gains = await loadGains(character, target)
								if (gains.unresolved !== null) return gains.unresolved
								setChoosing(false)
								onLevelUp(gains)
								return null
							} catch (error) {
								return `Could not read what the next level adds: ${error instanceof Error ? error.message : String(error)}`
							}
						}}
						onCancel={() => setChoosing(false)}
					/>
				)}
			</>
		)
	}
	const atMaximum = totalCharacterLevel(character.classes) >= MAX_CHARACTER_LEVEL
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
