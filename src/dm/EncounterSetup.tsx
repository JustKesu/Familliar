import { useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import { difficultyLabel, encounterXp, loadEncounterRules, monsterIndex, monsterRefKey, partyThresholds, type Thresholds } from '../encounters/encounterDifficulty'
import { addMonster, MAX_GROUP_COUNT, setGroupCount } from '../encounters/encounterEdit'
import { EncounterStore, type EncounterGroup, type EncounterInput, type EncounterParty } from '../encounters/encounterStore'
import { loadMonsterData, type Monster } from '../monsters/monsterData'
import type { Navigate } from '../navigation/useRoute'
import { BestiaryBrowser, useLoaded } from './Bestiary'

interface Draft {
	name: string
	size: string
	level: string
	players: string[]
	groups: EncounterGroup[]
}

function partyFrom(draft: Pick<Draft, 'size' | 'level'>): EncounterParty | null {
	const size = Number(draft.size)
	const level = Number(draft.level)
	const valid = (value: number, text: string) => text.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 20
	return valid(size, draft.size) && valid(level, draft.level) ? { size, level } : null
}

function toInput(draft: Draft): EncounterInput {
	return { name: draft.name.trim() || 'Untitled encounter', party: partyFrom(draft), players: draft.players, groups: draft.groups }
}

const EMPTY_DRAFT: Draft = { name: '', size: '', level: '', players: [], groups: [] }

function DifficultyBar({ total, thresholds }: { total: number; thresholds: Thresholds | null }): ReactNode {
	if (!thresholds) return null
	const label = difficultyLabel(total, thresholds)
	const scale = thresholds.high * 1.25
	const percent = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
	return (
		<section className="encounter-difficulty" aria-label="Difficulty">
			<p className="encounter-difficulty__head">
				<span className="encounter-difficulty__total">{total} XP</span>
				<strong className="encounter-difficulty__label">{label}</strong>
			</p>
			<div className="encounter-difficulty__track" aria-hidden="true">
				<div className="encounter-difficulty__fill" style={{ width: percent(total) }} />
				{(['low', 'moderate', 'high'] as const).map((key) => (
					<span key={key} className="encounter-difficulty__tick" style={{ left: percent(thresholds[key]) }} />
				))}
			</div>
			<p className="encounter-difficulty__thresholds">
				<span>Low {thresholds.low}</span>
				<span>Moderate {thresholds.moderate}</span>
				<span>High {thresholds.high}</span>
			</p>
		</section>
	)
}

function GroupCard({
	group,
	monster,
	unknown,
	onChange,
	onRemove,
}: {
	group: EncounterGroup
	monster: Monster | undefined
	unknown: boolean
	onChange: (group: EncounterGroup) => void
	onRemove: () => void
}): ReactNode {
	const name = group.monster.name
	const count = group.members.length
	return (
		<section className="encounter-group" aria-label={`${name} group`}>
			<div className="encounter-group__head">
				<div className="encounter-group__title">
					<strong>{unknown ? 'Unknown monster' : name}</strong>
					<span className="encounter-group__meta">
						{unknown ? `“${name}” is not in the bestiary` : monster ? `CR ${monster.cr} · ${monster.xp ?? 0} XP each` : ''}
					</span>
				</div>
				<button type="button" className="encounter-group__remove" aria-label={`Remove ${name}`} onClick={onRemove}>
					Remove
				</button>
			</div>
			<div className="encounter-group__controls">
				<div className="encounter-group__count">
					<button type="button" className="encounter-group__step" aria-label={`Fewer ${name}`} disabled={count <= 1} onClick={() => onChange(setGroupCount(group, count - 1))}>
						−
					</button>
					<output className="encounter-group__count-value" aria-label={`${name} count`}>
						{count}
					</output>
					<button type="button" className="encounter-group__step" aria-label={`More ${name}`} disabled={count >= MAX_GROUP_COUNT} onClick={() => onChange(setGroupCount(group, count + 1))}>
						+
					</button>
				</div>
				{count > 1 && (
					<label className="encounter-group__initiative">
						<input type="checkbox" checked={group.oneInitiative} onChange={(event) => onChange({ ...group, oneInitiative: event.target.checked })} /> One initiative roll
					</label>
				)}
			</div>
			<ul className="encounter-group__members">
				{group.members.map((member, index) => (
					<li key={member.id}>
						<input
							type="text"
							aria-label={`${name} name ${index + 1}`}
							value={member.name}
							onChange={(event) => onChange({ ...group, members: group.members.map((m) => (m.id === member.id ? { ...m, name: event.target.value } : m)) })}
						/>
					</li>
				))}
			</ul>
		</section>
	)
}

export function EncounterSetup({ id, navigate }: { id: string | null; navigate: Navigate }): ReactNode {
	const store = useMemo(() => new EncounterStore(), [])
	const stored = useMemo(() => (id === null ? undefined : store.get(id)), [store, id])
	const initial = useMemo<Draft>(
		() =>
			stored
				? { name: stored.name, size: stored.party ? String(stored.party.size) : '', level: stored.party ? String(stored.party.level) : '', players: stored.players, groups: stored.groups }
				: EMPTY_DRAFT,
		[stored],
	)
	const [draft, setDraft] = useState<Draft>(initial)
	const [savedDraft, setSavedDraft] = useState<Draft>(initial)
	const [playerInput, setPlayerInput] = useState('')
	const [confirmBack, setConfirmBack] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const monsters = useLoaded(loadMonsterData)
	const rules = useLoaded(loadEncounterRules)
	const index = useMemo(() => (monsters.status === 'ready' ? monsterIndex(monsters.data.monsters) : null), [monsters])

	const toList = () => navigate({ view: 'dm', tab: 'encounters' })

	if (id !== null && !stored) {
		return (
			<div className="encounter-setup__missing">
				<p className="dm__error" role="alert">
					This encounter was not found.
				</p>
				<button type="button" onClick={toList}>
					Back
				</button>
			</div>
		)
	}

	const dirty = JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(savedDraft))
	const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
	const setGroups = (change: (groups: EncounterGroup[]) => EncounterGroup[]) => setDraft((current) => ({ ...current, groups: change(current.groups) }))
	const total = index ? encounterXp(draft.groups, index) : 0
	const thresholds = rules.status === 'ready' ? partyThresholds(rules.data, partyFrom(draft)) : null

	const addPlayer = () => {
		const name = playerInput.trim()
		if (name === '') return
		if (!draft.players.includes(name)) update({ players: [...draft.players, name] })
		setPlayerInput('')
	}

	const save = () => {
		try {
			store.save(id, toInput(draft))
			setSavedDraft(draft)
			toList()
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : String(error))
		}
	}

	return (
		<div className="encounter-setup">
			<div className="encounter-setup__main">
				<div className="encounter-setup__bar">
					<button type="button" onClick={() => (dirty ? setConfirmBack(true) : toList())}>
						Back
					</button>
					<h2 className="encounter-setup__title">{id === null ? 'New encounter' : 'Edit encounter'}</h2>
					<button type="button" className="btn--accent" onClick={save}>
						Save
					</button>
				</div>
				{saveError && (
					<div className="dm__error" role="alert">
						{saveError}
					</div>
				)}
				<div className="encounter-setup__fields">
					<label className="encounter-setup__name">
						Name
						<input type="text" value={draft.name} placeholder="Untitled encounter" onChange={(event) => update({ name: event.target.value })} />
					</label>
					<label>
						Players
						<input type="number" inputMode="numeric" min={1} max={20} value={draft.size} onChange={(event) => update({ size: event.target.value })} />
					</label>
					<label>
						Level
						<input type="number" inputMode="numeric" min={1} max={20} value={draft.level} onChange={(event) => update({ level: event.target.value })} />
					</label>
				</div>

				<DifficultyBar total={total} thresholds={thresholds} />
				{!thresholds && draft.groups.length > 0 && <p className="encounter-setup__total">{total} XP</p>}

				<h3 className="encounter-setup__heading">Monsters</h3>
				{draft.groups.length === 0 && <p className="dm__status">Add monsters from the list.</p>}
				{draft.groups.map((group) => {
					const monster = index?.get(monsterRefKey(group.monster))
					return (
						<GroupCard
							key={group.id}
							group={group}
							monster={monster}
							unknown={index !== null && !monster}
							onChange={(next) => setGroups((groups) => groups.map((g) => (g.id === group.id ? next : g)))}
							onRemove={() => setGroups((groups) => groups.filter((g) => g.id !== group.id))}
						/>
					)
				})}

				<h3 className="encounter-setup__heading">Players</h3>
				<ul className="encounter-setup__chips" aria-label="Players">
					{draft.players.map((player) => (
						<li key={player} className="encounter-setup__chip">
							{player}
							<button type="button" aria-label={`Remove player ${player}`} onClick={() => update({ players: draft.players.filter((p) => p !== player) })}>
								×
							</button>
						</li>
					))}
				</ul>
				<div className="encounter-setup__add-player">
					<input
						type="text"
						aria-label="Player name"
						placeholder="Player name"
						value={playerInput}
						onChange={(event) => setPlayerInput(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') addPlayer()
						}}
					/>
					<button type="button" onClick={addPlayer}>
						Add player
					</button>
				</div>
			</div>

			<div className="encounter-setup__picker">
				{monsters.status === 'loading' && <p className="dm__status">Loading bestiary…</p>}
				{monsters.status === 'error' && (
					<div className="dm__error" role="alert">
						<strong>The bestiary could not be loaded.</strong> {monsters.message}
					</div>
				)}
				{monsters.status === 'ready' && <BestiaryBrowser data={monsters.data} onPick={(monster) => setGroups((groups) => addMonster(groups, monster))} />}
			</div>

			{confirmBack && (
				<ConfirmDialog
					title="Discard changes?"
					body="This encounter has unsaved changes."
					safeLabel="Keep editing"
					destructiveLabel="Discard"
					onSafe={() => setConfirmBack(false)}
					onDestructive={() => {
						setConfirmBack(false)
						toList()
					}}
				/>
			)}
		</div>
	)
}
