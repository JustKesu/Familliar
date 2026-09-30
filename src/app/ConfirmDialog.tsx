import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * W23/W28: the in-app confirmation, never `confirm()` — a script driving the
 * app dismisses that as "no" (QUESTIONS.md). The safe choice is the filled,
 * focused button, and Esc or a backdrop click take it too.
 */
export function ConfirmDialog({
	title,
	body,
	children,
	safeLabel,
	destructiveLabel,
	onSafe,
	onDestructive,
}: {
	title: string
	body: string
	children?: ReactNode
	safeLabel: string
	destructiveLabel: string
	onSafe: () => void
	onDestructive: () => void
}): ReactNode {
	const id = useId()
	const safeRef = useRef<HTMLButtonElement>(null)
	const destructiveRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
		safeRef.current?.focus()
		return () => trigger?.focus()
	}, [])

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault()
			onSafe()
		} else if (event.key === 'Tab') {
			// Only two focusable controls: Tab keeps focus inside the modal.
			event.preventDefault()
			;(document.activeElement === safeRef.current ? destructiveRef : safeRef).current?.focus()
		}
	}

	return createPortal(
		<div className="confirm-dialog__backdrop" onClick={(event) => event.target === event.currentTarget && onSafe()}>
			<div
				className="confirm-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-body`}
				onKeyDown={handleKeyDown}
			>
				<h2 id={`${id}-title`} className="confirm-dialog__title">
					{title}
				</h2>
				<p id={`${id}-body`} className="confirm-dialog__body">
					{body}
				</p>
				{children}
				<div className="confirm-dialog__actions">
					<button ref={destructiveRef} type="button" className="btn--accent-outline" onClick={onDestructive}>
						{destructiveLabel}
					</button>
					<button ref={safeRef} type="button" className="btn--accent" onClick={onSafe}>
						{safeLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	)
}
