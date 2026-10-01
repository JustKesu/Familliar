import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePortraitUpload } from './usePortraitUpload'

/** W3: the header frame. With `onChange` it is a button opening Upload image / Remove; without (read-only sheet) it only shows. */
export function SheetPortrait({ name, portrait, onChange }: { name: string; portrait?: string; onChange?: (portrait: string | null) => void }): ReactNode {
	const [open, setOpen] = useState(false)
	const wrapRef = useRef<HTMLDivElement>(null)
	const upload = usePortraitUpload((next) => onChange?.(next))
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
			if (event.key === 'Escape') close()
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [shown, clearError])

	if (!onChange) return <div className="sheet__portrait">{content}</div>

	return (
		<div ref={wrapRef} className="sheet__portrait-wrap">
			<button
				type="button"
				className="sheet__portrait"
				aria-label="Portrait"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => {
					upload.clearError()
					setOpen(!open)
				}}
			>
				{content}
			</button>
			{shown && (
				<div className="portrait-menu" role="menu" aria-label="Portrait">
					{upload.error && <p className="error portrait-menu__error">{upload.error}</p>}
					<button
						type="button"
						role="menuitem"
						autoFocus
						onClick={() => {
							setOpen(false)
							upload.clearError()
							upload.choose()
						}}
					>
						Upload image
					</button>
					{portrait && (
						<button
							type="button"
							role="menuitem"
							onClick={() => {
								setOpen(false)
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
