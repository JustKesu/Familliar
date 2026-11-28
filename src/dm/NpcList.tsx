import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import { CharacterCard } from '../characters/CharacterCard'
import { EncounterStore } from '../encounters/encounterStore'
import { crTitle, loadNpcCr, type CrEstimate } from '../encounters/npcCr'
import type { Character } from '../storage/character'

/** D439: the estimate per stored character object, so an edited NPC recomputes; undefined while loading. */
export function useNpcCrs(npcs: Character[]): (npc: Character) => CrEstimate | null | undefined {
	const cache = useRef(new WeakMap<Character, CrEstimate | null | 'loading'>())
	const [, rerender] = useState(0)
	useEffect(() => {
		for (const npc of npcs) {
			if (cache.current.has(npc)) continue
			cache.current.set(npc, 'loading')
			void loadNpcCr(npc).then((estimate) => {
				cache.current.set(npc, estimate)
				rerender((n) => n + 1)
			})
		}
	}, [npcs])
	return (npc) => {
		const entry = cache.current.get(npc)
		return entry === 'loading' ? undefined : entry
	}
}

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
	const crOf = useNpcCrs(npcs)
	const deleting = npcs.find((npc) => npc.id === deletingId)
	const usedIn = deleting ? new EncounterStore().list().filter((encounter) => encounter.npcs.some((npc) => npc.characterId === deleting.id)).length : 0
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
				{npcs.map((npc) => {
					const estimate = crOf(npc)
					return (
					<CharacterCard
						key={npc.id}
						character={npc}
						badge={estimate ? { text: `≈ CR ${estimate.cr}`, title: crTitle(estimate) } : null}
						onOpen={onOpen}
						onRename={onRename}
						onExport={onExport}
						onRequestDelete={setDeletingId}
						onRequestDuplicate={(id) => setDuplicating({ id, name: `${npc.name} copy` })}
					/>
					)
				})}
			</ul>
			{npcs.length === 0 && <p className="char-empty">No NPCs yet.</p>}

			{deleting && (
				<ConfirmDialog
					title={`Delete ${deleting.name}?`}
					body={[
						'This removes the NPC from this browser. It cannot be undone.',
						usedIn > 0 && `Used in ${usedIn} encounter${usedIn === 1 ? '' : 's'}. ${usedIn === 1 ? 'It' : 'They'} will show it as deleted.`,
					]
						.filter(Boolean)
						.join(' ')}
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
					actionIsPrimary
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
