import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import type { Character } from '../storage/character'
import { CharacterCard } from './CharacterCard'

export function CharacterList({
	characters,
	loadError,
	actionError,
	onNew,
	onOpen,
	onRename,
	onExport,
	onDelete,
	onImportFile,
}: {
	characters: Character[]
	loadError: string | null
	actionError: string | null
	onNew: () => void
	onOpen: (id: string) => void
	onRename: (id: string, name: string) => void
	onExport: (id: string) => void
	onDelete: (id: string) => void
	onImportFile: (file: File) => void
}): ReactNode {
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const newRef = useRef<HTMLButtonElement>(null)
	const focusNewAfterRender = useRef(false)
	const deleting = characters.find((character) => character.id === deletingId)

	// Runs after the dialog's own focus-restore (it points at a card that is gone by then).
	useEffect(() => {
		if (!focusNewAfterRender.current) return
		focusNewAfterRender.current = false
		newRef.current?.focus()
	})

	return (
		<main className="char-list-page">
			<div className="char-list-head">
				<h2>Your characters</h2>
				<button type="button" className="char-import-btn" onClick={() => fileInputRef.current?.click()}>
					Import character
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="application/json"
					hidden
					onChange={(event) => {
						const file = event.target.files?.[0]
						if (file) onImportFile(file)
						event.target.value = ''
					}}
				/>
			</div>

			{loadError && (
				<p className="error">
					Could not read saved characters: {loadError}
					<br />
					Delete or fix the saved data in this browser&apos;s storage, or import a character file once the underlying problem is resolved.
				</p>
			)}
			{actionError && <p className="error">{actionError}</p>}

			<ul className="char-grid">
				<li>
					<button ref={newRef} type="button" className="char-new" aria-label="New character" onClick={onNew}>
						<span className="char-new__plus" aria-hidden="true">
							+
						</span>
						<span className="char-new__label" aria-hidden="true">
							New character
						</span>
					</button>
				</li>
				{!loadError &&
					characters.map((character) => (
						<CharacterCard key={character.id} character={character} onOpen={onOpen} onRename={onRename} onExport={onExport} onRequestDelete={setDeletingId} />
					))}
			</ul>
			{!loadError && characters.length === 0 && <p className="char-empty">No characters yet.</p>}

			{deleting && (
				<ConfirmDialog
					title={`Delete ${deleting.name}?`}
					body="This removes the character from this browser. It cannot be undone."
					safeLabel="Keep"
					destructiveLabel="Delete"
					onSafe={() => setDeletingId(null)}
					onDestructive={() => {
						focusNewAfterRender.current = true
						setDeletingId(null)
						onDelete(deleting.id)
					}}
				/>
			)}
		</main>
	)
}
