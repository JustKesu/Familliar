import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '../app/ConfirmDialog'
import type { LevelGains } from './levelGains'

/** D329: which class of a multiclass character takes the new level, asked before the wizard opens. */
export function LevelUpClassDialog({ choices, onChoose, onCancel }: { choices: readonly LevelGains[]; onChoose: (gains: LevelGains) => void; onCancel: () => void }): ReactNode {
	const id = useId()
	const backdropRef = useRef<HTMLDivElement>(null)
	const dialogRef = useRef<HTMLDivElement>(null)
	const firstRef = useRef<HTMLButtonElement>(null)
	const cancelRef = useRef<HTMLButtonElement>(null)
	const firstEnabled = choices.findIndex((gains) => gains.unresolved === null)
	useModal(backdropRef, dialogRef, firstEnabled === -1 ? cancelRef : firstRef, onCancel)

	return createPortal(
		<div ref={backdropRef} className="confirm-dialog__backdrop" onClick={(event) => event.target === event.currentTarget && onCancel()}>
			<div ref={dialogRef} className="confirm-dialog level-up-class" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
				<h2 id={`${id}-title`} className="confirm-dialog__title">
					Level up which class?
				</h2>
				<div className="level-up-class__options">
					{choices.map((gains, index) => (
						<button
							key={`${gains.className}|${gains.classSource}`}
							ref={index === firstEnabled ? firstRef : undefined}
							type="button"
							className="btn--accent-outline level-up-class__option"
							disabled={gains.unresolved !== null}
							title={gains.unresolved ?? undefined}
							onClick={() => onChoose(gains)}
						>
							{gains.className} {gains.classLevel - 1} → {gains.classLevel}
						</button>
					))}
				</div>
				<div className="confirm-dialog__actions">
					<button ref={cancelRef} type="button" className="btn--accent-outline" onClick={onCancel}>
						Cancel
					</button>
				</div>
			</div>
		</div>,
		document.body,
	)
}
