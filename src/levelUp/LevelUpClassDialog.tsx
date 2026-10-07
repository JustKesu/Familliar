import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '../app/ConfirmDialog'
import type { NewClassOption } from '../multiclass/multiclassPrerequisites'
import type { LevelGains, LevelUpClass } from './levelGains'

/** The "+ New class…" list: loading, failed, or the offered classes. */
export type NewClassList = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; options: readonly NewClassOption[] }

/** A held class whose next level could not be read: its row is disabled with the reason. */
export interface ClassFailure {
	className: string
	classSource: string
	classLevel: number
	reason: string
}

/**
 * D329: which class takes the new level, asked before the wizard opens.
 * D330: shown for every character; "+ New class…" lists the classes not held, an unmet prerequisite disabled with its reason.
 */
export function LevelUpClassDialog({
	choices,
	failures = [],
	newClasses,
	onChoose,
	onChooseNew,
	onCancel,
}: {
	choices: readonly LevelGains[]
	failures?: readonly ClassFailure[]
	newClasses: NewClassList
	onChoose: (gains: LevelGains) => void
	/** Resolves to why the class cannot be levelled into after all (its level gains unreadable), or null once handed on. */
	onChooseNew: (target: LevelUpClass) => Promise<string | null>
	onCancel: () => void
}): ReactNode {
	const id = useId()
	const backdropRef = useRef<HTMLDivElement>(null)
	const dialogRef = useRef<HTMLDivElement>(null)
	const firstRef = useRef<HTMLButtonElement>(null)
	const cancelRef = useRef<HTMLButtonElement>(null)
	const firstNewRef = useRef<HTMLButtonElement>(null)
	const [listing, setListing] = useState(false)
	const [pending, setPending] = useState<string | null>(null)
	const [failure, setFailure] = useState<string | null>(null)
	const firstEnabled = choices.findIndex((gains) => gains.unresolved === null)
	useModal(backdropRef, dialogRef, firstEnabled === -1 ? cancelRef : firstRef, onCancel)

	const options = newClasses.kind === 'ready' ? newClasses.options : []
	const firstNewEnabled = options.findIndex((option) => option.unmet === null)
	useEffect(() => {
		if (listing) firstNewRef.current?.focus()
	}, [listing, newClasses.kind])

	const chooseNew = (option: NewClassOption): void => {
		const key = `${option.className}|${option.classSource}`
		setPending(key)
		setFailure(null)
		void onChooseNew(option).then((reason) => {
			setPending(null)
			if (reason !== null) setFailure(`${option.className}: ${reason}`)
		})
	}

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
					{failures.map((failure) => (
						<button
							key={`${failure.className}|${failure.classSource}`}
							type="button"
							className="btn--accent-outline level-up-class__option"
							disabled
							title={failure.reason}
						>
							{failure.className} {failure.classLevel - 1} → {failure.classLevel}
						</button>
					))}
					<button type="button" className="btn--accent-outline level-up-class__new-toggle" aria-expanded={listing} onClick={() => setListing((open) => !open)}>
						+ New class…
					</button>
				</div>
				{listing && (
					<div className="level-up-class__new" role="region" aria-label="New class">
						{newClasses.kind === 'loading' && <p>Checking which classes you can take…</p>}
						{newClasses.kind === 'error' && <p className="error">Could not read the classes: {newClasses.message}</p>}
						{newClasses.kind === 'ready' && options.length === 0 && <p>There is no other class to take.</p>}
						{newClasses.kind === 'ready' && options.length > 0 && (
							<ul className="level-up-class__new-list">
								{options.map((option, index) => {
									const key = `${option.className}|${option.classSource}`
									const reasonId = `${id}-reason-${index}`
									return (
										<li key={key} className="level-up-class__new-item">
											<button
												ref={index === firstNewEnabled ? firstNewRef : undefined}
												type="button"
												className="btn--accent-outline level-up-class__new-option"
												disabled={option.unmet !== null || pending !== null}
												aria-describedby={option.unmet !== null ? reasonId : undefined}
												onClick={() => chooseNew(option)}
											>
												{option.className}
											</button>
											{option.unmet !== null && (
												<p id={reasonId} className="level-up-class__reason">
													{option.unmet}
												</p>
											)}
										</li>
									)
								})}
							</ul>
						)}
						{failure !== null && <p className="error">{failure}</p>}
					</div>
				)}
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
