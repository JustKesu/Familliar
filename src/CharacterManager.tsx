import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CharacterStore, type CharacterTextField, type HitPointFields, type RestFields } from './storage/characterStore'
import { StorageError } from './storage/errors'
import type { Character, CharacterFamiliar, CharacterInventoryItem, SpentSpellSlots } from './storage/character'
import { CharacterWizard } from './creation/CharacterWizard'
import { CharacterSheet } from './sheet/CharacterSheet'
import type { LevelGains } from './levelUp/levelGains'
import { characterUpdateInput } from './levelUp/levelRemoval'
import { currentHpAfterMaxHpChange } from './calculation/maxHitPoints'
import { loadCharacterMaxHp } from './hitPoints/hpDefault'

/*
 * TEMPORARY UI for the storage layer (PHASE1.md build order step 2).
 *
 * Character creation itself is real: it delegates to CharacterWizard
 * (PHASE1.md build order step 3, section D — the multi-step wizard). What
 * remains temporary here is list, rename, delete, export and import —
 * proving the storage layer works by hand. The read-only inspect view
 * (CharacterInspector.tsx, D14) is gone now that the real sheet (step 5)
 * covers everything it used to show.
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
	sheetSelected,
	onRename,
	onDelete,
	onExport,
	onViewSheet,
}: {
	character: Character
	sheetSelected: boolean
	onRename: (id: string, name: string) => void
	onDelete: (id: string) => void
	onExport: (id: string) => void
	onViewSheet: (id: string) => void
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
		<li className={sheetSelected ? 'char-row char-row--selected' : 'char-row'}>
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
				<button type="button" onClick={() => onViewSheet(character.id)}>
					{sheetSelected ? 'Hide' : 'Sheet'}
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
	/** The character the wizard is currently open over (slice 8d1) — null while creating or while nothing is being edited. */
	const [editingId, setEditingId] = useState<string | null>(null)
	/** Set when that wizard run is a one-level walk (slice 8d3) rather than a whole-character edit. */
	const [levelUpGains, setLevelUpGains] = useState<LevelGains | null>(null)
	const [sheetId, setSheetId] = useState<string | null>(null)
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
		setEditingId(null)
		setLevelUpGains(null)
		setActionError(null)
		refresh()
	}

	function handleRename(id: string, name: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.rename(id, name))
	}

	function handleChooseFamiliar(id: string, familiar: CharacterFamiliar | null): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setFamiliar(id, familiar))
	}

	function handleEditInventory(id: string, inventory: CharacterInventoryItem[]): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setInventory(id, inventory))
	}

	function handleEditCurrency(id: string, copper: number): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setCurrency(id, copper))
	}

	function handleEditHitPoints(id: string, hitPoints: HitPointFields): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setHitPoints(id, hitPoints))
	}

	function handleEditResourceUses(id: string, resourceUses: Record<string, number> | undefined): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setResourceUses(id, resourceUses))
	}

	function handleEditSpentSpellSlots(id: string, spentSpellSlots: SpentSpellSlots | undefined): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setSpentSpellSlots(id, spentSpellSlots))
	}

	function handleEditSpentHitDice(id: string, spentHitDice: Record<string, number> | undefined): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setSpentHitDice(id, spentHitDice))
	}

	function handleEditConcentration(id: string, spellName: string | null): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setConcentration(id, spellName))
	}

	function handleEditText(id: string, field: CharacterTextField, text: string): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.setText(id, field, text))
	}

	function handleRest(id: string, rest: RestFields): void {
		if (!store.store) return
		withErrorHandling(() => store.store?.applyRest(id, rest))
	}

	function handleDelete(id: string): void {
		if (!store.store) return
		if (!confirm('Delete this character? This cannot be undone.')) return
		withErrorHandling(() => store.store?.delete(id))
		setSheetId((current) => (current === id ? null : current))
		setEditingId((current) => (current === id ? null : current))
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
	const editingCharacter = editingId === null ? undefined : characters.find((c) => c.id === editingId)

	return (
		<main>
			<h1>Familliar</h1>
			<p className="subtitle">
				Characters. Creation below is the real wizard (build order step 3). Listing, renaming,
				deleting and export/import are still temporary UI; the "Sheet" button opens the real
				character sheet (step 5).
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
								sheetSelected={character.id === sheetId}
								onRename={handleRename}
								onDelete={handleDelete}
								onExport={handleExport}
								onViewSheet={(id) => setSheetId((current) => (current === id ? null : id))}
							/>
						))}
					</ul>

					{sheetId &&
						(() => {
							const sheetCharacter = characters.find((c) => c.id === sheetId)
							return sheetCharacter ? (
								<CharacterSheet
									character={sheetCharacter}
									onChooseFamiliar={(familiar) => handleChooseFamiliar(sheetCharacter.id, familiar)}
									onEditInventory={(inventory) => handleEditInventory(sheetCharacter.id, inventory)}
									onEditCurrency={(copper) => handleEditCurrency(sheetCharacter.id, copper)}
									onEditHitPoints={(hitPoints) => handleEditHitPoints(sheetCharacter.id, hitPoints)}
									onEditResourceUses={(resourceUses) => handleEditResourceUses(sheetCharacter.id, resourceUses)}
								onEditSpentSpellSlots={(spentSpellSlots) => handleEditSpentSpellSlots(sheetCharacter.id, spentSpellSlots)}
									onEditSpentHitDice={(spentHitDice) => handleEditSpentHitDice(sheetCharacter.id, spentHitDice)}
									onEditConcentration={(spellName) => handleEditConcentration(sheetCharacter.id, spellName)}
									onEditText={(field, text) => handleEditText(sheetCharacter.id, field, text)}
									onRest={(rest) => handleRest(sheetCharacter.id, rest)}
									onEditCharacter={() => {
										setCreating(false)
										setLevelUpGains(null)
										setEditingId(sheetCharacter.id)
									}}
									onRemoveLevel={(result) => {
										setEditingId((current) => (current === sheetCharacter.id ? null : current))
										setLevelUpGains(null)
										/* D107 (this task's own extension, for symmetry with the level-up side): currentHp drops by the same amount maxHp drops, only when it was already set. */
										if (sheetCharacter.currentHp === undefined) {
											withErrorHandling(() => store.store?.update(result.id, characterUpdateInput(result)))
											return
										}
										Promise.all([loadCharacterMaxHp(sheetCharacter), loadCharacterMaxHp(result)])
											.then(([before, after]) => {
												const currentHp = currentHpAfterMaxHpChange(sheetCharacter.currentHp, before, after)
												const adjusted = currentHp !== undefined ? { ...result, currentHp } : result
												withErrorHandling(() => store.store?.update(adjusted.id, characterUpdateInput(adjusted)))
											})
											.catch(() => withErrorHandling(() => store.store?.update(result.id, characterUpdateInput(result))))
									}}
									onLevelUp={(gains) => {
										setCreating(false)
										setLevelUpGains(gains)
										setEditingId(sheetCharacter.id)
									}}
								/>
							) : null
						})()}
				</div>
			)}

			<div className="char-create">
				{editingCharacter ? (
					<CharacterWizard
						/* A fresh run per mode and character: the wizard seeds itself once, on mount. */
						key={`${editingCharacter.id}|${levelUpGains ? `up${levelUpGains.level}` : 'edit'}`}
						store={characterStore}
						character={editingCharacter}
						levelUp={levelUpGains ?? undefined}
						onSaved={handleWizardSaved}
						/* Nothing has been written at this point — the stored character is untouched. */
						onCancel={() => {
							setEditingId(null)
							setLevelUpGains(null)
						}}
					/>
				) : creating ? (
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
