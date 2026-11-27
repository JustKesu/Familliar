import { useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import { difficultyLabel, encounterXp, loadEncounterRules, monsterIndex, partyThresholds } from '../encounters/encounterDifficulty'
import { EncounterStore, type Encounter } from '../encounters/encounterStore'
import { loadMonsterData } from '../monsters/monsterData'
import type { Navigate } from '../navigation/useRoute'
import { useLoaded } from './Bestiary'

export function encounterSummary(encounter: Encounter): string {
	return encounter.groups.map((group) => (group.members.length > 1 ? `${group.monster.name} x${group.members.length}` : group.monster.name)).join(', ')
}

export function EncounterList({ navigate }: { navigate: Navigate }): ReactNode {
	const store = useMemo(() => new EncounterStore(), [])
	const [result, setResult] = useState(() => store.read())
	const [pendingDelete, setPendingDelete] = useState<Encounter | null>(null)
	const [confirmClear, setConfirmClear] = useState(false)
	const [writeError, setWriteError] = useState<string | null>(null)
	const monsters = useLoaded(loadMonsterData)
	const rules = useLoaded(loadEncounterRules)
	const index = useMemo(() => (monsters.status === 'ready' ? monsterIndex(monsters.data.monsters) : null), [monsters])

	const run = (action: () => void): void => {
		try {
			action()
			setWriteError(null)
		} catch (error) {
			setWriteError(error instanceof Error ? error.message : String(error))
		}
		setResult(store.read())
	}

	const xpText = (encounter: Encounter): string => {
		if (!index) return ''
		const total = encounterXp(encounter.groups, index)
		const thresholds = rules.status === 'ready' ? partyThresholds(rules.data, encounter.party) : null
		return thresholds ? `${total} XP · ${difficultyLabel(total, thresholds)}` : `${total} XP`
	}

	return (
		<div className="encounters">
			<div className="encounters__toolbar">
				<button type="button" className="btn--accent" onClick={() => navigate({ view: 'dm', tab: 'encounters', encounter: 'new' })}>
					New encounter
				</button>
			</div>
			{result.error && (
				<div className="dm__error" role="alert">
					<strong>Saved encounters could not be read.</strong> {result.error}{' '}
					<button type="button" className="encounters__clear" onClick={() => setConfirmClear(true)}>
						Clear encounter data
					</button>
				</div>
			)}
			{result.skipped > 0 && (
				<div className="dm__error" role="alert">
					{result.skipped === 1 ? '1 saved encounter could not be read and is hidden.' : `${result.skipped} saved encounters could not be read and are hidden.`}
				</div>
			)}
			{writeError && (
				<div className="dm__error" role="alert">
					{writeError}
				</div>
			)}
			{result.encounters.length === 0 && !result.error && <p className="dm__status">No encounters yet.</p>}
			<ul className="encounters__list" aria-label="Encounters">
				{result.encounters.map((encounter) => (
					<li key={encounter.id} className="encounters__item">
						<div className="encounters__main">
							<strong className="encounters__name">{encounter.name}</strong>
							<span className="encounters__summary">{encounterSummary(encounter) || 'No monsters'}</span>
							<span className="encounters__xp">{xpText(encounter)}</span>
						</div>
						<div className="encounters__actions">
							<button type="button" aria-label={`Edit ${encounter.name}`} onClick={() => navigate({ view: 'dm', tab: 'encounters', encounter: { id: encounter.id } })}>
								Edit
							</button>
							<button type="button" aria-label={`Delete ${encounter.name}`} onClick={() => setPendingDelete(encounter)}>
								Delete
							</button>
						</div>
					</li>
				))}
			</ul>
			{pendingDelete && (
				<ConfirmDialog
					title={`Delete ${pendingDelete.name}?`}
					body="The encounter is removed from this browser. This cannot be undone."
					safeLabel="Keep"
					destructiveLabel="Delete"
					onSafe={() => setPendingDelete(null)}
					onDestructive={() => {
						const id = pendingDelete.id
						setPendingDelete(null)
						run(() => store.delete(id))
					}}
				/>
			)}
			{confirmClear && (
				<ConfirmDialog
					title="Clear encounter data?"
					body="Everything stored under saved encounters is removed, including the part that could not be read. Characters are not affected."
					safeLabel="Keep"
					destructiveLabel="Clear"
					onSafe={() => setConfirmClear(false)}
					onDestructive={() => {
						setConfirmClear(false)
						run(() => store.clearAll())
					}}
				/>
			)}
		</div>
	)
}
