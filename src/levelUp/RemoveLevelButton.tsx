import { useEffect, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import type { Character } from '../storage/character'
import { levelRemovalTarget, loadLevelRemovalPlan, type LevelRemovalPlan } from './levelRemoval'

type ControlState =
	| { kind: 'checking' }
	| { kind: 'ready' }
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

	function failed(error: unknown): ControlState {
		return { kind: 'unavailable', reason: `Could not read what the level holds: ${error instanceof Error ? error.message : String(error)}` }
	}

	// Availability is checked ahead so the reason shows on the control (D43), but the plan that gets confirmed is
	// always computed on the click: a plan held from before the latest save would overwrite it (F-7b), and
	// re-entering "checking" on every save swapped the button out from under a click that began on a blur.
	useEffect(() => {
		if (!available) return
		let cancelled = false
		loadPlan(character)
			.then((plan) => {
				if (!cancelled) setState((prev) => (prev.kind === 'confirming' ? prev : 'reason' in plan ? { kind: 'unavailable', reason: plan.reason } : { kind: 'ready' }))
			})
			.catch((error: unknown) => {
				if (!cancelled) setState((prev) => (prev.kind === 'confirming' ? prev : failed(error)))
			})
		return () => {
			cancelled = true
		}
	}, [character, available, loadPlan])

	function openConfirm(): void {
		loadPlan(character)
			.then((plan) => setState('reason' in plan ? { kind: 'unavailable', reason: plan.reason } : { kind: 'confirming', plan }))
			.catch((error: unknown) => setState(failed(error)))
	}

	const current: ControlState = 'reason' in target ? { kind: 'unavailable', reason: target.reason } : state

	if (current.kind === 'ready' || current.kind === 'confirming') {
		const plan = current.kind === 'confirming' ? current.plan : null
		return (
			<>
				<button type="button" className="sheet__remove-level sheet__header-button" onClick={openConfirm}>
					<DownArrowIcon />
					Remove level {plan?.level ?? ('level' in target ? target.level : '')}
				</button>
				{plan && (
					<ConfirmDialog
						title={`Remove level ${plan.level}?`}
						body="Choices made at this level will be lost."
						safeLabel="Keep level"
						destructiveLabel="Remove level"
						onSafe={() => setState({ kind: 'ready' })}
						onDestructive={() => {
							// Closed first: a character that can lose another level would otherwise keep showing this, now stale, plan.
							setState({ kind: 'ready' })
							onRemoveLevel(plan.result)
						}}
					>
						<div className="confirm-dialog__extra">
							{plan.removedClass && <p className="confirm-dialog__warning">{plan.removedClass} will be removed from this character.</p>}
							<p>
								The character goes back to level {plan.level - 1}.
								{plan.dropped.length > 0 ? ' This deletes:' : ' Nothing stored carries this level.'}
							</p>
							{plan.dropped.length > 0 && (
								<ul>
									{plan.dropped.map((line, index) => (
										<li key={index}>{line}</li>
									))}
								</ul>
							)}
							<p>{plan.removedClass ? 'Known and prepared spells of the other classes are kept.' : 'Known and prepared spells are kept.'}</p>
						</div>
					</ConfirmDialog>
				)}
			</>
		)
	}
	return (
		<button
			type="button"
			className="sheet__remove-level sheet__header-button"
			disabled
			title={current.kind === 'checking' ? 'Checking what the level holds…' : `Remove level unavailable: ${current.reason}`}
		>
			<DownArrowIcon />
			Remove level
		</button>
	)
}

function DownArrowIcon(): ReactNode {
	return (
		<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M6 1.5v9M2 6.5l4 4 4-4" />
		</svg>
	)
}
