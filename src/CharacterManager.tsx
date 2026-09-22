import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CharacterStore, type CharacterTextField, type HitPointFields, type RestFields } from './storage/characterStore'
import { StorageError } from './storage/errors'
import type { Character, CharacterFamiliar, CharacterInventoryItem, SpentSpellSlots } from './storage/character'
import { CharacterWizard } from './creation/CharacterWizard'
import { CharacterSheet } from './sheet/CharacterSheet'
import { LevelUpWizardGate } from './levelUp/LevelUpWizardGate'
import { characterUpdateInput } from './levelUp/levelRemoval'
import { currentHpAfterMaxHpChange } from './calculation/maxHitPoints'
import { loadCharacterMaxHp } from './hitPoints/hpDefault'
import type { CharacterRoute } from './navigation/route'
import type { Navigate } from './navigation/useRoute'

/*
 * TEMPORARY UI for the storage layer (PHASE1.md build order step 2).
 *
 * Character creation itself is real: it delegates to CharacterWizard
 * (PHASE1.md build order step 3, section D — the multi-step wizard). What
 * remains temporary here is list, rename, delete, export and import —
 * proving the storage layer works by hand. The read-only inspect view
 * (CharacterInspector.tsx, D14) is gone now that the real sheet (step 5)
 * covers everything it used to show.
 *
 * Rework R1b (D145, D151): the list, the sheet and the wizard are separate
 * views selected by `route`, never rendered together. `route` and `navigate`
 * come from the one `useRoute` hook at App level.
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
	onRename,
	onDelete,
	onExport,
	onViewSheet,
}: {
	character: Character
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
		<li className="char-row">
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
					Sheet
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

function CharacterManager({ route, navigate }: { route: CharacterRoute; navigate: Navigate }) {
	const [store] = useState(() => {
		try {
			return { store: new CharacterStore(), error: null as string | null }
		} catch (error) {
			return { store: null, error: describeError(error) }
		}
	})

	const [characters, setCharacters] = useState<Character[]>([])
	/** Set once `refresh` has run at least once — guards the route-validation effect below against the initial render, where `characters` is still `[]` and a valid id would otherwise look unknown (see R1b report). */
	const [charactersLoaded, setCharactersLoaded] = useState(false)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	function refresh(): void {
		if (!store.store) return
		try {
			setCharacters(store.store.list())
			setLoadError(null)
		} catch (error) {
			setLoadError(describeError(error))
		} finally {
			setCharactersLoaded(true)
		}
	}

	useEffect(refresh, [store])

	/* Unknown/invalid id, or one that stopped existing (the character whose sheet/wizard was open got deleted) — back to the list, replacing rather than pushing (build order brief, R1b table). */
	useEffect(() => {
		if (!charactersLoaded) return
		if (route.view !== 'sheet' && route.view !== 'edit' && route.view !== 'level-up') return
		if (characters.some((character) => character.id === route.id)) return
		navigate({ view: 'list' }, { replace: true })
	}, [charactersLoaded, route, characters, navigate])

	function withErrorHandling(action: () => void): void {
		try {
			action()
			setActionError(null)
			refresh()
		} catch (error) {
			setActionError(describeError(error))
		}
	}

	function handleWizardSaved(character: Character): void {
		refresh()
		navigate({ view: 'sheet', id: character.id }, { replace: true })
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

	if (route.view === 'list') {
		return (
			<main>
				<h1>Familliar</h1>
				<p className="subtitle">
					Characters. Creation opens the real wizard (build order step 3). Listing, renaming,
					deleting and export/import are still temporary UI; "Sheet" opens the real character
					sheet (step 5).
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
					<ul className="char-list">
						{characters.length === 0 && <li className="char-row char-row--empty">No characters saved yet.</li>}
						{characters.map((character) => (
							<CharacterRow
								key={character.id}
								character={character}
								onRename={handleRename}
								onDelete={handleDelete}
								onExport={handleExport}
								onViewSheet={(id) => navigate({ view: 'sheet', id })}
							/>
						))}
					</ul>
				)}

				<div className="char-create">
					<button type="button" onClick={() => navigate({ view: 'new' })}>
						New character
					</button>
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

	if (route.view === 'new') {
		return (
			<main>
				<h1>Familliar</h1>
				{actionError && <p className="error">{actionError}</p>}
				<div className="char-create">
					<CharacterWizard store={characterStore} onSaved={handleWizardSaved} onCancel={() => navigate({ view: 'list' }, { replace: true })} />
				</div>
			</main>
		)
	}

	/* sheet / edit / level-up all need the character; while it is missing (route just arrived or is about to be redirected by the effect above), render nothing rather than a view for a character that is not there. */
	const character = characters.find((c) => c.id === route.id)
	if (!character) return null

	if (route.view === 'sheet') {
		return (
			<main>
				<h1>Familliar</h1>
				{actionError && <p className="error">{actionError}</p>}
				<CharacterSheet
					character={character}
					onChooseFamiliar={(familiar) => handleChooseFamiliar(character.id, familiar)}
					onEditInventory={(inventory) => handleEditInventory(character.id, inventory)}
					onEditCurrency={(copper) => handleEditCurrency(character.id, copper)}
					onEditHitPoints={(hitPoints) => handleEditHitPoints(character.id, hitPoints)}
					onEditResourceUses={(resourceUses) => handleEditResourceUses(character.id, resourceUses)}
					onEditSpentSpellSlots={(spentSpellSlots) => handleEditSpentSpellSlots(character.id, spentSpellSlots)}
					onEditSpentHitDice={(spentHitDice) => handleEditSpentHitDice(character.id, spentHitDice)}
					onEditConcentration={(spellName) => handleEditConcentration(character.id, spellName)}
					onEditText={(field, text) => handleEditText(character.id, field, text)}
					onRest={(rest) => handleRest(character.id, rest)}
					onEditCharacter={() => navigate({ view: 'edit', id: character.id })}
					onLevelUp={() => navigate({ view: 'level-up', id: character.id })}
					onRemoveLevel={(result) => {
						/* D107: currentHp drops by the same amount maxHp drops, only when it was already set. */
						if (character.currentHp === undefined) {
							withErrorHandling(() => store.store?.update(result.id, characterUpdateInput(result)))
							return
						}
						Promise.all([loadCharacterMaxHp(character), loadCharacterMaxHp(result)])
							.then(([before, after]) => {
								const currentHp = currentHpAfterMaxHpChange(character.currentHp, before, after)
								const adjusted = currentHp !== undefined ? { ...result, currentHp } : result
								withErrorHandling(() => store.store?.update(adjusted.id, characterUpdateInput(adjusted)))
							})
							.catch(() => withErrorHandling(() => store.store?.update(result.id, characterUpdateInput(result))))
					}}
				/>
			</main>
		)
	}

	if (route.view === 'edit') {
		return (
			<main>
				<h1>Familliar</h1>
				{actionError && <p className="error">{actionError}</p>}
				<div className="char-create">
					<CharacterWizard
						store={characterStore}
						character={character}
						onSaved={handleWizardSaved}
						/* Nothing has been written at this point — the stored character is untouched. */
						onCancel={() => navigate({ view: 'sheet', id: character.id }, { replace: true })}
					/>
				</div>
			</main>
		)
	}

	return (
		<main>
			<h1>Familliar</h1>
			{actionError && <p className="error">{actionError}</p>}
			<div className="char-create">
				<LevelUpWizardGate
					store={characterStore}
					character={character}
					onSaved={handleWizardSaved}
					onCancel={() => navigate({ view: 'sheet', id: character.id }, { replace: true })}
					onUnavailable={() => navigate({ view: 'sheet', id: character.id }, { replace: true })}
				/>
			</div>
		</main>
	)
}

export default CharacterManager
