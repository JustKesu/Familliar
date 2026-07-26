import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CharacterStore } from './storage/characterStore'
import { StorageError } from './storage/errors'
import type { Character } from './storage/character'
import { CharacterWizard } from './creation/CharacterWizard'
import { CharacterInspector } from './CharacterInspector'

/*
 * TEMPORARY UI for the storage layer (PHASE1.md build order step 2).
 *
 * Character creation itself is real: it delegates to CharacterWizard
 * (PHASE1.md build order step 3, section D — the multi-step wizard). What
 * remains temporary here is everything else — list, rename, delete,
 * export, import, and the read-only inspect view — proving the storage
 * layer works by hand pending the real sheet (step 5).
 */

function describeError(error: unknown): string {
	if (error instanceof StorageError) return error.message
	return error instanceof Error ? error.message : String(error)
}

function download(filename: string, contents: string): void {
	const blob = new Blob([contents], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	link.click()
	URL.revokeObjectURL(url)
}

function CharacterRow({
	character,
	selected,
	onRename,
	onDelete,
	onExport,
	onInspect,
}: {
	character: Character
	selected: boolean
	onRename: (id: string, name: string) => void
	onDelete: (id: string) => void
	onExport: (id: string) => void
	onInspect: (id: string) => void
}): ReactNode {
	const [editing, setEditing] = useState(false)
	const [draftName, setDraftName] = useState(character.name)

	function commitRename(): void {
		setEditing(false)
		if (draftName.trim() && draftName.trim() !== character.name) {
			onRename(character.id, draftName)
		} else {
			setDraftName(character.name)
		}
	}

	return (
		<li className={selected ? 'char-row char-row--selected' : 'char-row'}>
			{editing ? (
				<input
					className="char-row__name-input"
					autoFocus
					value={draftName}
					onChange={(event) => setDraftName(event.target.value)}
					onBlur={commitRename}
					onKeyDown={(event) => {
						if (event.key === 'Enter') commitRename()
						if (event.key === 'Escape') {
							setDraftName(character.name)
							setEditing(false)
						}
					}}
				/>
			) : (
				<span className="char-row__name" onDoubleClick={() => setEditing(true)}>
					{character.name}
				</span>
			)}

			<span className="char-row__meta">
				{character.classes.length === 0
					? 'no class yet'
					: character.classes.map((c) => `${c.className} ${c.level}`).join(' / ')}
			</span>

			<span className="char-row__actions">
				<button type="button" onClick={() => onInspect(character.id)}>
					Inspect
				</button>
				<button type="button" onClick={() => setEditing(true)}>
					Rename
				</button>
				<button type="button" onClick={() => onExport(character.id)}>
					Export
				</button>
				<button type="button" onClick={() => onDelete(character.id)}>
					Delete
				</button>
			</span>
		</li>
	)
}

function CharacterManager() {
	const [store] = useState(() => {
		try {
			return { store: new CharacterStore(), error: null as string | null }
		} catch (error) {
			return { store: null, error: describeError(error) }
		}
	})

	const [characters, setCharacters] = useState<Character[]>([])
	const [loadError, setLoadError] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const [creating, setCreating] = useState(false)
	const [inspectedId, setInspectedId] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	function refresh(): void {
		if (!store.store) return
		try {
			setCharacters(store.store.list())
			setLoadError(null)
		} catch (error) {
			setLoadError(describeError(error))
		}
	}

	useEffect(refresh, [store])

	function withErrorHandling(action: () => void): void {
		try {
			action()
			setActionError(null)
			refresh()
		} catch (error) {
			setActionError(describeError(error))
		}
	}

	function handleWizardSaved(): void {
		setCreating(false)
		setActionError(null)
		refresh()
	}

	function handleRename(id: string, name: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.rename(id, name))
	}

	function handleDelete(id: string): void {
		if (!store.store) return
		if (!confirm('Delete this character? This cannot be undone.')) return
		withErrorHandling(() => store.store?.delete(id))
		setInspectedId((current) => (current === id ? null : current))
	}

	function handleExport(id: string): void {
		if (!store.store) return
		try {
			const json = store.store.exportCharacter(id)
			const character = characters.find((c) => c.id === id)
			const filename = `${character?.name ?? 'character'}.json`.replace(/[\\/:*?"<>|]/g, '_')
			download(filename, json)
			setActionError(null)
		} catch (error) {
			setActionError(describeError(error))
		}
	}

	function handleImportFile(file: File): void {
		if (!store.store) return
		file
			.text()
			.then((text) => {
				withErrorHandling(() => store.store?.import(text))
			})
			.catch((error: unknown) => {
				setActionError(describeError(error))
			})
	}

	if (!store.store) {
		return (
			<main>
				<h1>Familliar</h1>
				<p className="error">Storage unavailable: {store.error}</p>
			</main>
		)
	}
	const characterStore = store.store

	return (
		<main>
			<h1>Familliar</h1>
			<p className="subtitle">
				Characters. Creation below is the real wizard (build order step 3). Listing, renaming,
				deleting, export/import and inspection are still temporary UI, replaced by the sheet
				(step 5).
			</p>

			{loadError && (
				<p className="error">
					Could not read saved characters: {loadError}
					<br />
					Delete or fix the saved data in this browser&apos;s storage, or import a character
					file below once the underlying problem is resolved.
				</p>
			)}

			{actionError && <p className="error">{actionError}</p>}

			{!loadError && (
				<div className="char-layout">
					<ul className="char-list">
						{characters.length === 0 && <li className="char-row char-row--empty">No characters saved yet.</li>}
						{characters.map((character) => (
							<CharacterRow
								key={character.id}
								character={character}
								selected={character.id === inspectedId}
								onRename={handleRename}
								onDelete={handleDelete}
								onExport={handleExport}
								onInspect={setInspectedId}
							/>
						))}
					</ul>

					<CharacterInspector character={characters.find((c) => c.id === inspectedId) ?? null} />
				</div>
			)}

			<div className="char-create">
				{creating ? (
					<CharacterWizard
						store={characterStore}
						onSaved={handleWizardSaved}
						onCancel={() => setCreating(false)}
					/>
				) : (
					<button type="button" onClick={() => setCreating(true)}>
						New character
					</button>
				)}
			</div>

			<div className="char-import">
				<input
					ref={fileInputRef}
					type="file"
					accept="application/json"
					onChange={(event) => {
						const file = event.target.files?.[0]
						if (file) handleImportFile(file)
						event.target.value = ''
					}}
				/>
				<span className="char-import__hint">Import a character file exported from this app.</span>
			</div>
		</main>
	)
}

export default CharacterManager
