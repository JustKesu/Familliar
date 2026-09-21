import { useEffect, useState, type ReactNode } from 'react'
import type { Character } from '../storage/character'
import { levelRemovalTarget, loadLevelRemovalPlan, type LevelRemovalPlan } from './levelRemoval'

type ControlState =
	| { kind: 'checking' }
	| { kind: 'ready'; plan: LevelRemovalPlan }
	| { kind: 'confirming'; plan: LevelRemovalPlan }
	| { kind: 'unavailable'; reason: string }

/**
 * Removes exactly one level (slice 8e). D43: an unavailable removal names its
 * reason on the control. The confirmation is an element in the page, not
 * `confirm()` — a script driving the app dismisses that dialog as "no"
 * (QUESTIONS.md), so a removal guarded by it could never be exercised.
 */
export function RemoveLevelButton({
	character,
	onRemoveLevel,
	loadPlan = loadLevelRemovalPlan,
}: {
	character: Character
	onRemoveLevel: (result: Character) => void
	loadPlan?: (character: Character) => Promise<LevelRemovalPlan | { reason: string }>
}): ReactNode {
	const target = levelRemovalTarget(character)
	const available = !('reason' in target)
	const [state, setState] = useState<ControlState>({ kind: 'checking' })

	useEffect(() => {
		if (!available) return
		let cancelled = false
		setState({ kind: 'checking' })
		loadPlan(character)
			.then((plan) => {
				if (!cancelled) setState('reason' in plan ? { kind: 'unavailable', reason: plan.reason } : { kind: 'ready', plan })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ kind: 'unavailable', reason: `Could not read what the level holds: ${error instanceof Error ? error.message : String(error)}` })
			})
		return () => {
			cancelled = true
		}
	}, [character, available, loadPlan])

	const current: ControlState = 'reason' in target ? { kind: 'unavailable', reason: target.reason } : state

	if (current.kind === 'confirming') {
		const { plan } = current
		return (
			<div className="sheet__remove-level-confirm" role="alertdialog" aria-label={`Remove level ${plan.level}?`}>
				<p>
					Remove level {plan.level}? The character goes back to level {plan.level - 1}.
					{plan.dropped.length > 0 ? ' This deletes:' : ' Nothing stored carries this level.'}
				</p>
				{plan.dropped.length > 0 && (
					<ul>
						{plan.dropped.map((line, index) => (
							<li key={index}>{line}</li>
						))}
					</ul>
				)}
				<p>Known and prepared spells are kept.</p>
				<button type="button" onClick={() => onRemoveLevel(plan.result)}>
					Confirm removing level {plan.level}
				</button>
				<button type="button" onClick={() => setState({ kind: 'ready', plan })}>
					Cancel
				</button>
			</div>
		)
	}
	if (current.kind === 'ready') {
		const { plan } = current
		return (
			<button type="button" className="sheet__remove-level" onClick={() => setState({ kind: 'confirming', plan })}>
				Remove level {plan.level}
			</button>
		)
	}
	return (
		<button
			type="button"
			className="sheet__remove-level"
			disabled
			title={current.kind === 'checking' ? 'Checking what the level holds…' : `Remove level unavailable: ${current.reason}`}
		>
			Remove level
		</button>
	)
}
