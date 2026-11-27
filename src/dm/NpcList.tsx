import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import { CharacterCard } from '../characters/CharacterCard'
import type { Character } from '../storage/character'

export function NpcList({
	npcs,
	error,
	onNew,
	onOpen,
	onRename,
	onExport,
	onDuplicate,
	onDelete,
}: {
	npcs: Character[]
	error: string | null
	onNew: () => void
	onOpen: (id: string) => void
	onRename: (id: string, name: string) => void
	onExport: (id: string) => void
	onDuplicate: (id: string, name: string) => void
	onDelete: (id: string) => void
}): ReactNode {
	const [deletingId, setDeletingId] = useState<string | null>(null)
	const [duplicating, setDuplicating] = useState<{ id: string; name: string } | null>(null)
	const deleting = npcs.find((npc) => npc.id === deletingId)
	const duplicateSource = duplicating && npcs.find((npc) => npc.id === duplicating.id)

	return (
		<div className="encounters npcs">
			<div className="encounters__toolbar">
				<button type="button" className="btn--accent" onClick={onNew}>
					New NPC
				</button>
			</div>
			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}
			<ul className="char-grid">
				{npcs.map((npc) => (
					<CharacterCard
						key={npc.id}
						character={npc}
						onOpen={onOpen}
						onRename={onRename}
						onExport={onExport}
						onRequestDelete={setDeletingId}
						onRequestDuplicate={(id) => setDuplicating({ id, name: `${npc.name} copy` })}
					/>
				))}
			</ul>
			{npcs.length === 0 && <p className="char-empty">No NPCs yet.</p>}

			{deleting && (
				<ConfirmDialog
					title={`Delete ${deleting.name}?`}
					body="This removes the NPC from this browser. It cannot be undone."
					safeLabel="Keep"
					destructiveLabel="Delete"
					onSafe={() => setDeletingId(null)}
					onDestructive={() => {
						setDeletingId(null)
						onDelete(deleting.id)
					}}
				/>
			)}
			{duplicating && duplicateSource && (
				<ConfirmDialog
					title={`Duplicate ${duplicateSource.name}`}
					body="The copy is a separate NPC with everything the original has now."
					safeLabel="Cancel"
					destructiveLabel="Duplicate"
					destructiveDisabled={!duplicating.name.trim()}
					onSafe={() => setDuplicating(null)}
					onDestructive={() => {
						if (!duplicating.name.trim()) return
						setDuplicating(null)
						onDuplicate(duplicating.id, duplicating.name)
					}}
				>
					<label className="npcs__name">
						Name of the copy
						<input value={duplicating.name} onChange={(event) => setDuplicating({ ...duplicating, name: event.target.value })} />
					</label>
				</ConfirmDialog>
			)}
		</div>
	)
}
