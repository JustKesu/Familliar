import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

/** The modal behaviour of the in-app dialogs: background inert, focus moved in and trapped, Esc calls `onEscape`, focus returned on close. */
export function useModal(
	backdropRef: RefObject<HTMLElement | null>,
	dialogRef: RefObject<HTMLElement | null>,
	initialFocusRef: RefObject<HTMLElement | null>,
	onEscape: () => void,
): void {
	const onEscapeRef = useRef(onEscape)
	useEffect(() => {
		onEscapeRef.current = onEscape
	})

	useEffect(() => {
		const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
		const inerted = Array.from(document.body.children).filter((element) => element !== backdropRef.current && !element.hasAttribute('inert'))
		inerted.forEach((element) => element.setAttribute('inert', ''))
		initialFocusRef.current?.focus()

		// F-1: on window in the capture phase, so Esc works wherever focus is and never reaches an open drawer's document listener.
		function handleKeyDown(event: KeyboardEvent): void {
			const dialog = dialogRef.current
			if (!dialog) return
			if (event.key === 'Escape') {
				event.preventDefault()
				event.stopPropagation()
				onEscapeRef.current()
			} else if (event.key === 'Tab') {
				const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
				if (focusable.length === 0) return
				const index = focusable.indexOf(document.activeElement as HTMLElement)
				const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : index === -1 || index === focusable.length - 1 ? 0 : index + 1
				event.preventDefault()
				focusable[next].focus()
			}
		}
		window.addEventListener('keydown', handleKeyDown, true)
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true)
			inerted.forEach((element) => element.removeAttribute('inert'))
			trigger?.focus()
		}
	}, [backdropRef, dialogRef, initialFocusRef])
}

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
	const backdropRef = useRef<HTMLDivElement>(null)
	const dialogRef = useRef<HTMLDivElement>(null)
	const safeRef = useRef<HTMLButtonElement>(null)
	useModal(backdropRef, dialogRef, safeRef, onSafe)

	return createPortal(
		<div ref={backdropRef} className="confirm-dialog__backdrop" onClick={(event) => event.target === event.currentTarget && onSafe()}>
			{/* tabIndex -1: a click on the text keeps focus in the dialog instead of dropping it to body. */}
			<div
				ref={dialogRef}
				className="confirm-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-body`}
				tabIndex={-1}
			>
				<h2 id={`${id}-title`} className="confirm-dialog__title">
					{title}
				</h2>
				<p id={`${id}-body`} className="confirm-dialog__body">
					{body}
				</p>
				{children}
				<div className="confirm-dialog__actions">
					<button type="button" className="btn--accent-outline" onClick={onDestructive}>
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
