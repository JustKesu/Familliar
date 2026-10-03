import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Character } from '../storage/character'
import { characterSummary } from './characterSummary'

export function CharacterCard({
	character,
	onOpen,
	onRename,
	onExport,
	onRequestDelete,
}: {
	character: Character
	onOpen: (id: string) => void
	onRename: (id: string, name: string) => void
	onExport: (id: string) => void
	onRequestDelete: (id: string) => void
}): ReactNode {
	const { id, name, portrait } = character
	const [menuOpen, setMenuOpen] = useState(false)
	const [editing, setEditing] = useState(false)
	const [draftName, setDraftName] = useState(name)
	const wrapRef = useRef<HTMLLIElement>(null)
	const menuButtonRef = useRef<HTMLButtonElement>(null)
	const menuId = useId()

	useEffect(() => {
		if (!menuOpen) return
		function handlePointerDown(event: PointerEvent): void {
			if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false)
		}
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key !== 'Escape') return
			setMenuOpen(false)
			menuButtonRef.current?.focus()
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [menuOpen])

	function commitRename(): void {
		setEditing(false)
		const next = draftName.trim()
		if (next && next !== name) onRename(id, next)
		else setDraftName(name)
	}

	function choose(action: () => void): void {
		setMenuOpen(false)
		menuButtonRef.current?.focus()
		action()
	}

	const body = (
		<>
			<span className="char-card__portrait">
				{portrait ? <img src={portrait} alt={`Portrait of ${name}`} /> : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
			</span>
			<span className="char-card__text">
				{editing ? (
					<input
						className="char-card__name-input"
						aria-label={`Name of ${name}`}
						autoFocus
						value={draftName}
						onFocus={(event) => event.target.select()}
						onChange={(event) => setDraftName(event.target.value)}
						onBlur={commitRename}
						onKeyDown={(event) => {
							if (event.key === 'Enter') commitRename()
							if (event.key === 'Escape') {
								setDraftName(name)
								setEditing(false)
							}
						}}
					/>
				) : (
					<span className="char-card__name">{name}</span>
				)}
				<span className="char-card__sub">{characterSummary(character)}</span>
			</span>
		</>
	)

	return (
		<li ref={wrapRef} className="char-card">
			{editing ? (
				<div className="char-card__open">{body}</div>
			) : (
				<button type="button" className="char-card__open" aria-label={name} onClick={() => onOpen(id)}>
					{body}
				</button>
			)}
			<button
				ref={menuButtonRef}
				type="button"
				className="char-card__more"
				aria-label={`More actions for ${name}`}
				aria-expanded={menuOpen}
				aria-controls={menuOpen ? menuId : undefined}
				onClick={() => setMenuOpen(!menuOpen)}
			>
				⋯
			</button>
			{menuOpen && (
				// A disclosure of plain buttons, not role="menu" (arrow-key navigation would be owed) — same as the portrait popup.
				<div id={menuId} className="portrait-menu char-card__menu" role="group" aria-label={`Actions for ${name}`}>
					<button
						type="button"
						autoFocus
						onClick={() => {
							setMenuOpen(false)
							setDraftName(name)
							setEditing(true)
						}}
					>
						Rename
					</button>
					<button type="button" onClick={() => choose(() => onExport(id))}>
						Export
					</button>
					<button type="button" onClick={() => choose(() => onRequestDelete(id))}>
						Delete
					</button>
				</div>
			)}
		</li>
	)
}
