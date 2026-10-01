import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePortraitUpload } from './usePortraitUpload'

/** W3: the header frame. With `onChange` it is a button opening Upload image / Remove; without (read-only sheet) it only shows. */
export function SheetPortrait({ name, portrait, onChange }: { name: string; portrait?: string; onChange?: (portrait: string | null) => void }): ReactNode {
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const popupId = useId()
	const upload = usePortraitUpload((next) => onChange?.(next), buttonRef)
	const { clearError } = upload
	const content = portrait ? <img src={portrait} alt={`Portrait of ${name}`} /> : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
	const shown = open || upload.error !== null

	useEffect(() => {
		if (!shown) return
		function close(): void {
			setOpen(false)
			clearError()
		}
		function handlePointerDown(event: PointerEvent): void {
			if (!wrapRef.current?.contains(event.target as Node)) close()
		}
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key !== 'Escape') return
			close()
			buttonRef.current?.focus()
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [shown, clearError])

	if (!onChange) return <div className="sheet__portrait">{content}</div>

	// A disclosure (button + popup of plain buttons), not role="menu", which would owe arrow-key navigation.
	return (
		<div ref={wrapRef} className="sheet__portrait-wrap">
			<button
				ref={buttonRef}
				type="button"
				className="sheet__portrait"
				aria-label={portrait ? `Portrait of ${name}` : 'Portrait'}
				aria-expanded={shown}
				aria-controls={shown ? popupId : undefined}
				onClick={() => {
					upload.clearError()
					setOpen(!shown)
				}}
			>
				{content}
			</button>
			{shown && (
				<div id={popupId} className="portrait-menu" role="group" aria-label="Portrait options">
					{upload.error && (
						<p className="error portrait-menu__error" role="alert">
							{upload.error}
						</p>
					)}
					<button
						type="button"
						autoFocus
						onClick={() => {
							setOpen(false)
							upload.clearError()
							buttonRef.current?.focus()
							upload.choose()
						}}
					>
						Upload image
					</button>
					{portrait && (
						<button
							type="button"
							onClick={() => {
								setOpen(false)
								buttonRef.current?.focus()
								onChange(null)
							}}
						>
							Remove
						</button>
					)}
				</div>
			)}
			{upload.elements}
		</div>
	)
}
