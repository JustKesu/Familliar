import { useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../app/ConfirmDialog'
import {
	addCondition,
	applyDamage,
	applyHeal,
	COMBAT_CONDITIONS,
	currentHp,
	entryKey,
	entryMemberIds,
	flipSave,
	initiativeEntries,
	isDown,
	isInLair,
	nextTurn,
	removeCondition,
	rollRecharge,
	rollSaves,
	SAVE_ABILITIES,
	setUsed,
	startCombat,
	toggleAdv,
	toggleLair,
	toggleUseBox,
	usedCount,
	type Combat,
	type InitiativeEntry,
	type OnSuccess,
	type SaveResult,
} from '../encounters/combat'
import { difficultyLabel, encounterXp, loadEncounterRules, monsterIndex, monsterRefKey, partyThresholds } from '../encounters/encounterDifficulty'
import { EncounterStore, type Encounter, type EncounterGroup, type EncounterMember } from '../encounters/encounterStore'
import { hasLairUses, trackedUses, type TrackedUse } from '../encounters/trackedUses'
import { MonsterStatBlock } from '../monsters/MonsterStatBlock'
import { findLegendaryGroup, loadMonsterData, monsterInitiative, monsterSave, type AbilityKey, type Monster, type MonsterData } from '../monsters/monsterData'
import type { Navigate } from '../navigation/useRoute'
import { formatModifier } from '../sheet/BeastStatBlock'
import { useMobileLayout } from '../sheet/useMobileLayout'
import { useLoaded } from './Bestiary'

const ABILITY_LABEL: Record<AbilityKey, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }
const SHORT_LABEL: Record<AbilityKey, string> = { str: 'S', dex: 'D', con: 'C', int: 'I', wis: 'W', cha: 'Ch' }

const parseInteger = (text: string): number | null => (/^\s*-?\d+\s*$/.test(text) ? Number(text) : null)
const parsePositive = (text: string): number | null => {
	const value = parseInteger(text)
	return value !== null && value > 0 ? value : null
}

interface MemberInfo {
	member: EncounterMember
	group: EncounterGroup
	monster: Monster | undefined
	max: number
}

/** D434: a monster missing from the bestiary (renamed in the data) gets 1 max HP and +0 bonuses rather than blocking the fight. */
const maxHpOf = (monster: Monster | undefined): number => Math.max(1, monster?.hp.average ?? 1)
const saveBonus = (monster: Monster | undefined, ability: AbilityKey): number => (monster ? monsterSave(monster, ability).bonus : 0)

function groupLabel(group: EncounterGroup): string {
	return group.members.length > 1 ? `${group.monster.name} x${group.members.length}` : group.monster.name
}

function entryLabel(entry: InitiativeEntry, groups: EncounterGroup[]): string {
	if (entry.kind === 'player') return entry.name
	const group = groups.find((g) => g.id === entry.groupId)
	if (!group) return 'Removed'
	if (entry.kind === 'group') return groupLabel(group)
	return group.members.find((member) => member.id === entry.memberId)?.name ?? 'Removed'
}

export function EncounterRun({ id, navigate }: { id: string; navigate: Navigate }): ReactNode {
	const store = useMemo(() => new EncounterStore(), [])
	const [encounter, setEncounter] = useState<Encounter | undefined>(() => store.get(id))
	const [writeError, setWriteError] = useState<string | null>(null)
	const monsters = useLoaded(loadMonsterData)
	const toList = () => navigate({ view: 'dm', tab: 'encounters' })

	if (!encounter) {
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
	if (monsters.status === 'loading') return <p className="dm__status">Loading bestiary…</p>
	if (monsters.status === 'error') {
		return (
			<div className="dm__error" role="alert">
				<strong>The bestiary could not be loaded.</strong> {monsters.message}
			</div>
		)
	}

	const commit = (combat: Combat | null): void => {
		try {
			setEncounter(store.setCombat(encounter.id, combat))
			setWriteError(null)
		} catch (error) {
			setWriteError(error instanceof Error ? error.message : String(error))
		}
	}

	const error = writeError && (
		<div className="dm__error" role="alert">
			{writeError}
		</div>
	)

	return encounter.combat ? (
		<CombatScreen encounter={encounter} combat={encounter.combat} data={monsters.data} commit={commit} error={error} onBack={toList} onEnded={toList} />
	) : (
		<InitiativeStep encounter={encounter} data={monsters.data} commit={commit} error={error} onBack={toList} />
	)
}

function useMonsterLookup(data: MonsterData, groups: EncounterGroup[]) {
	const index = useMemo(() => monsterIndex(data.monsters), [data])
	return useMemo(() => {
		const monsterOf = (group: EncounterGroup) => index.get(monsterRefKey(group.monster))
		const members = new Map<string, MemberInfo>()
		for (const group of groups) {
			const monster = monsterOf(group)
			for (const member of group.members) members.set(member.id, { member, group, monster, max: maxHpOf(monster) })
		}
		return { index, monsterOf, members }
	}, [index, groups])
}

function InitiativeStep({ encounter, data, commit, error, onBack }: { encounter: Encounter; data: MonsterData; commit: (combat: Combat) => void; error: ReactNode; onBack: () => void }): ReactNode {
	const { monsterOf } = useMonsterLookup(data, encounter.groups)
	const [entries] = useState(() =>
		initiativeEntries(encounter.groups, encounter.players, (group) => {
			const monster = monsterOf(group)
			return monster ? monsterInitiative(monster) : 0
		}),
	)
	const [values, setValues] = useState<Record<string, string>>(() =>
		Object.fromEntries(entries.map((entry) => [entryKey(entry), entry.initiative === null ? '' : String(entry.initiative)])),
	)

	const begin = () => {
		const order = entries.map((entry): InitiativeEntry => {
			const typed = parseInteger(values[entryKey(entry)] ?? '')
			if (entry.kind === 'player') return { ...entry, initiative: typed }
			return { ...entry, initiative: typed ?? entry.initiative }
		})
		commit(startCombat(order, encounter.groups, (group) => maxHpOf(monsterOf(group))))
	}

	return (
		<div className="combat-init">
			<div className="encounter-setup__bar">
				<button type="button" onClick={onBack}>
					Back
				</button>
				<h2 className="encounter-setup__title">{encounter.name} · Initiative</h2>
				<button type="button" className="btn--accent" onClick={begin}>
					Begin
				</button>
			</div>
			{error}
			<p className="dm__status">Monsters are rolled as d20 + initiative; change any number. A player left blank acts last.</p>
			<ul className="combat-init__list">
				{entries.map((entry) => {
					const key = entryKey(entry)
					const label = entryLabel(entry, encounter.groups)
					return (
						<li key={key} className="combat-init__item">
							<span className="combat-init__name">
								{label}
								{entry.kind === 'player' ? <span className="combat__tag">Player</span> : <span className="combat__sub"> d20 {formatModifier(entry.bonus)}</span>}
							</span>
							<input
								type="number"
								inputMode="numeric"
								aria-label={`Initiative ${label}`}
								value={values[key] ?? ''}
								onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
							/>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function SaveChip({ result, name, onFlip }: { result: SaveResult | undefined; name: string; onFlip: () => void }): ReactNode {
	if (!result) return null
	return (
		<button
			type="button"
			className={result.success ? 'combat__save-chip combat__save-chip--success' : 'combat__save-chip combat__save-chip--fail'}
			aria-label={`Save for ${name}: ${ABILITY_LABEL[result.ability]} ${result.total} ${result.success ? 'success' : 'failure'}, click to flip`}
			onClick={onFlip}
		>
			{ABILITY_LABEL[result.ability]} {result.total} {result.success ? '✓' : '✗'}
		</button>
	)
}

function HpCell({ hp, max }: { hp: number; max: number }): ReactNode {
	const ratio = hp / max
	const tone = hp === 0 ? 'zero' : ratio > 0.5 ? 'high' : 'low'
	return (
		<span className="combat__hp">
			<span className="combat__hp-text">
				{hp} / {max}
			</span>
			<span className="combat__hp-track" aria-hidden="true">
				<span className={`combat__hp-fill combat__hp-fill--${tone}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
			</span>
		</span>
	)
}

function SaveBonuses({ monster, short }: { monster: Monster | undefined; short?: boolean }): ReactNode {
	return (
		<span className={short ? 'combat__saves combat__saves--short' : 'combat__saves'}>
			{SAVE_ABILITIES.map((ability) => {
				const save = monster ? monsterSave(monster, ability) : { bonus: 0, proficient: false }
				return (
					<span key={ability} className={save.proficient ? 'combat__save combat__save--proficient' : 'combat__save'}>
						{short ? SHORT_LABEL[ability] : `${ABILITY_LABEL[ability]} `}
						{formatModifier(save.bonus)}
					</span>
				)
			})}
		</span>
	)
}

const usesOf = (info: MemberInfo, combat: Combat): TrackedUse[] => (info.monster ? trackedUses(info.monster, isInLair(combat, info.member.id)) : [])

/** A lair toggle can lower the total below what was already used. */
const shownUsed = (combat: Combat, memberId: string, use: TrackedUse): number => Math.min(use.total, usedCount(combat, memberId, use.key))

function UseCounts({ info, combat }: { info: MemberInfo; combat: Combat }): ReactNode {
	const counts = usesOf(info, combat)
		.filter((use) => !use.key.startsWith('s:'))
		.map((use) => {
			const used = shownUsed(combat, info.member.id, use)
			if (use.recharge !== undefined) return used > 0 ? `${use.short} spent` : null
			return `${use.short} ${used}/${use.total}`
		})
		.filter((text): text is string => text !== null)
	return counts.length > 0 ? <span className="combat__use-counts">{counts.join(' · ')}</span> : null
}

function TrackedUses({ info, combat, update }: { info: MemberInfo; combat: Combat; update: (change: (combat: Combat) => Combat) => void }): ReactNode {
	const { member, monster } = info
	const uses = usesOf(info, combat)
	if (!monster || uses.length === 0) return null
	return (
		<section className="tracked-uses" aria-label={`Tracked uses ${member.name}`}>
			<div className="tracked-uses__head">
				<h3 className="tracked-uses__title">Tracked uses · {member.name}</h3>
				{hasLairUses(monster) && (
					<label className="tracked-uses__lair">
						<input type="checkbox" checked={isInLair(combat, member.id)} onChange={() => update((c) => toggleLair(c, member.id))} />
						In lair
					</label>
				)}
			</div>
			<ul className="tracked-uses__list">
				{uses.map((use) => {
					const used = shownUsed(combat, member.id, use)
					return (
						<li key={use.key} className="tracked-uses__item" aria-label={`${use.name} uses`}>
							<span className="tracked-uses__name">
								{use.name}
								<span className="tracked-uses__note">{use.note}</span>
							</span>
							{use.recharge !== undefined ? (
								used > 0 ? (
									<button type="button" className="tracked-uses__spent" aria-label={`${use.name} spent, mark ready`} onClick={() => update((c) => setUsed(c, member.id, use.key, 0))}>
										SPENT · {use.note}
									</button>
								) : (
									<span className="tracked-uses__ready">
										READY
										<button type="button" className="tracked-uses__use" aria-label={`Use ${use.name}`} onClick={() => update((c) => setUsed(c, member.id, use.key, 1))}>
											USE
										</button>
									</span>
								)
							) : (
								<span className="tracked-uses__boxes">
									{Array.from({ length: use.total }, (_, box) => (
										<button
											key={box}
											type="button"
											className="use-box"
											aria-pressed={box < used}
											aria-label={`${use.name} use ${box + 1}`}
											onClick={() => update((c) => toggleUseBox(c, member.id, use.key, box))}
										/>
									))}
								</span>
							)}
						</li>
					)
				})}
			</ul>
		</section>
	)
}

interface Reminder {
	memberId: string
	memberName: string
	use: TrackedUse
	roll?: number
}

function rechargeReminders(combat: Combat, groups: EncounterGroup[], members: Map<string, MemberInfo>): Reminder[] {
	const entry = combat.order[combat.turn]
	if (!entry) return []
	return entryMemberIds(entry, groups).flatMap((memberId) => {
		const info = members.get(memberId)
		if (!info || isDown(combat, memberId)) return []
		return usesOf(info, combat)
			.filter((use) => use.recharge !== undefined && usedCount(combat, memberId, use.key) > 0)
			.map((use) => ({ memberId, memberName: info.member.name, use }))
	})
}

interface Controls {
	selected: Set<string>
	toggle: (id: string) => void
	combat: Combat
	update: (change: (combat: Combat) => Combat) => void
	openStats: (memberId: string) => void
	mobile: boolean
}

function MemberRow({ info, initiative, current, showSubtitle, controls }: { info: MemberInfo; initiative: number | null; current: boolean; showSubtitle: boolean; controls: Controls }): ReactNode {
	const { member, group, monster, max } = info
	const { combat, selected, toggle, update, openStats, mobile } = controls
	const hp = currentHp(combat, member.id, max)
	const down = isDown(combat, member.id)
	const conditions = combat.conditions[member.id] ?? []
	const className = ['combat-row', current && 'combat-row--current', down && 'combat-row--down'].filter(Boolean).join(' ')
	const chips = conditions.length > 0 && (
		<span className="combat__conditions">
			{conditions.map((condition) => (
				<span key={condition} className="combat__condition">
					{condition}
					<button type="button" aria-label={`Remove ${condition} from ${member.name}`} onClick={() => update((c) => removeCondition(c, member.id, condition))}>
						×
					</button>
				</span>
			))}
		</span>
	)
	const checkbox = <input type="checkbox" aria-label={`Select ${member.name}`} checked={selected.has(member.id)} onChange={() => toggle(member.id)} />
	const saveChip = <SaveChip result={combat.saveResults[member.id]} name={member.name} onFlip={() => update((c) => flipSave(c, member.id))} />
	const statButton = (
		<button type="button" className="combat__stat-button" aria-label={`Stat block for ${member.name}`} disabled={!monster} onClick={() => openStats(member.id)}>
			≡
		</button>
	)
	const name = (
		<span className="combat__name">
			{member.name}
			{down && <span className="combat__down">down</span>}
		</span>
	)
	const subtitle = showSubtitle && <span className="combat__sub">{monster ? `${group.monster.name} · CR ${monster.cr}` : group.monster.name}</span>
	const useCounts = <UseCounts info={info} combat={combat} />

	if (mobile) {
		return (
			<li className={className} aria-label={member.name} aria-current={current ? 'true' : undefined}>
				{checkbox}
				<span className="combat__who">
					{name}
					{subtitle}
					{showSubtitle && <SaveBonuses monster={monster} short />}
					{useCounts}
					{chips}
				</span>
				{saveChip}
				<HpCell hp={hp} max={max} />
				{statButton}
			</li>
		)
	}

	return (
		<li className={className} aria-label={member.name} aria-current={current ? 'true' : undefined}>
			{checkbox}
			<span className="combat__init">
				{current && <span className="combat__play">▶</span>}
				{initiative ?? ''}
			</span>
			<span className="combat__who">
				{name}
				{subtitle}
				{useCounts}
				{chips}
			</span>
			<span className="combat__ac">{monster ? (typeof monster.ac[0] === 'number' ? monster.ac[0] : monster.ac[0]?.ac) : '—'}</span>
			<HpCell hp={hp} max={max} />
			<span className="combat__save-cell">
				<SaveBonuses monster={monster} />
				<span className="combat__save-actions">
					{saveChip}
					<button type="button" className="combat__adv" aria-pressed={combat.adv[member.id] === true} aria-label={`Advantage for ${member.name}`} onClick={() => update((c) => toggleAdv(c, member.id))}>
						ADV
					</button>
				</span>
			</span>
			{statButton}
		</li>
	)
}

function CombatScreen({
	encounter,
	combat,
	data,
	commit,
	error,
	onBack,
	onEnded,
}: {
	encounter: Encounter
	combat: Combat
	data: MonsterData
	commit: (combat: Combat | null) => void
	error: ReactNode
	onBack: () => void
	onEnded: () => void
}): ReactNode {
	const groups = encounter.groups
	const { index, members } = useMonsterLookup(data, groups)
	const rules = useLoaded(loadEncounterRules)
	const mobile = useMobileLayout()
	const [selected, setSelected] = useState<Set<string>>(() => new Set())
	const [amount, setAmount] = useState('')
	const [ability, setAbility] = useState<AbilityKey | ''>('')
	const [dc, setDc] = useState('')
	const [onSuccess, setOnSuccess] = useState<OnSuccess>('half')
	const [stats, setStats] = useState<string[]>([])
	const [reminders, setReminders] = useState<Reminder[]>([])
	const [confirmEnd, setConfirmEnd] = useState(false)
	const [panelOpen, setPanelOpen] = useState(false)

	const maxOf = (memberId: string) => members.get(memberId)?.max ?? 1
	const update = (change: (combat: Combat) => Combat) => commit(change(combat))
	const toggle = (memberId: string) =>
		setSelected((current) => {
			const next = new Set(current)
			if (next.has(memberId)) next.delete(memberId)
			else next.add(memberId)
			return next
		})
	const selectedIds = [...selected].filter((memberId) => members.has(memberId))
	const amountValue = parsePositive(amount)
	const dcValue = parsePositive(dc)
	// Newest card first, at most two side by side.
	const openStats = (memberId: string) => setStats((current) => [memberId, ...current.filter((id) => id !== memberId)].slice(0, 2))
	const controls: Controls = { selected, toggle, combat, update, openStats, mobile }

	const total = encounterXp(groups, index)
	const thresholds = rules.status === 'ready' ? partyThresholds(rules.data, encounter.party) : null
	const difficulty = thresholds ? `${total} XP · ${difficultyLabel(total, thresholds)}` : `${total} XP`
	const current = combat.order[combat.turn]
	const currentName = current ? entryLabel(current, groups) : ''

	const rollSelected = () => {
		if (ability === '' || dcValue === null) return
		update((c) => rollSaves(c, selectedIds, ability, dcValue, (memberId) => saveBonus(members.get(memberId)?.monster, ability)))
	}
	const damage = () => amountValue !== null && update((c) => applyDamage(c, selectedIds, amountValue, ability !== '', onSuccess, maxOf))
	const heal = () => amountValue !== null && update((c) => applyHeal(c, selectedIds, amountValue, maxOf))
	const condition = (name: string) => name !== '' && update((c) => addCondition(c, selectedIds, name))
	const selectAlive = (group: EncounterGroup) =>
		setSelected((currentSet) => new Set([...currentSet, ...group.members.filter((member) => !isDown(combat, member.id)).map((member) => member.id)]))

	const statCard = (memberId: string) => {
		const info = members.get(memberId)
		if (!info?.monster) return null
		return (
			<section key={memberId} className={mobile ? 'combat__stats combat__stats--full' : 'combat__stats'} aria-label={`Stat block ${info.member.name}`}>
				<button type="button" className="combat__stats-close" onClick={() => setStats((current) => current.filter((id) => id !== memberId))}>
					{mobile ? '← Back' : 'Close'}
				</button>
				<TrackedUses info={info} combat={combat} update={update} />
				<MonsterStatBlock monster={info.monster} group={findLegendaryGroup(info.monster, data.legendaryGroups)} rollName={info.member.name} />
			</section>
		)
	}
	const cards = stats.map(statCard).filter((card) => card !== null)

	if (mobile && cards.length > 0) return cards[0]

	const goNext = () => {
		const after = nextTurn(combat, groups)
		commit(after)
		setReminders(rechargeReminders(after, groups, members))
	}
	const rollReminder = (reminder: Reminder) => {
		const result = rollRecharge(combat, reminder.memberId, reminder.use.key, reminder.use.recharge ?? 6)
		commit(result.combat)
		setReminders((current) => current.map((item) => (item === reminder ? { ...item, roll: result.roll } : item)))
	}
	const reminderStrip = reminders.length > 0 && (
		<ul className="recharge-reminders" aria-label="Recharge reminders">
			{reminders.map((reminder) => {
				const ready = usedCount(combat, reminder.memberId, reminder.use.key) === 0
				return (
					<li key={`${reminder.memberId}:${reminder.use.key}`} className="recharge-reminder">
						<span className="recharge-reminder__text">
							{reminder.memberName}: {reminder.use.name} is spent - roll d6, recharges on {reminder.use.recharge === 6 ? '6' : `${reminder.use.recharge}-6`}
						</span>
						{reminder.roll !== undefined && <span className="recharge-reminder__result">Rolled {reminder.roll}{ready ? ' - READY' : ' - still spent'}</span>}
						{!ready && (
							<button type="button" className="recharge-reminder__roll" onClick={() => rollReminder(reminder)}>
								ROLL d6
							</button>
						)}
						<button type="button" aria-label="Dismiss reminder" onClick={() => setReminders((current) => current.filter((item) => item !== reminder))}>
							×
						</button>
					</li>
				)
			})}
		</ul>
	)

	const conditionSelect = (
		<select aria-label="Add condition" value="" disabled={selectedIds.length === 0} onChange={(event) => condition(event.target.value)}>
			<option value="">+ Condition</option>
			{COMBAT_CONDITIONS.map((name) => (
				<option key={name} value={name}>
					{name}
				</option>
			))}
		</select>
	)
	const saveFields = (
		<>
			<label className="combat__field">
				<span>Save</span>
				<select aria-label="Save" value={ability} onChange={(event) => setAbility(event.target.value as AbilityKey | '')}>
					<option value="">None</option>
					{SAVE_ABILITIES.map((key) => (
						<option key={key} value={key}>
							{ABILITY_LABEL[key]}
						</option>
					))}
				</select>
			</label>
			<label className="combat__field">
				<span>DC</span>
				<input type="number" inputMode="numeric" aria-label="DC" className="combat__number" value={dc} onChange={(event) => setDc(event.target.value)} />
			</label>
			<button type="button" className="combat__roll" disabled={ability === '' || dcValue === null || selectedIds.length === 0} onClick={rollSelected}>
				Roll saves
			</button>
			<label className="combat__field">
				<span>On success</span>
				<select aria-label="On success" value={onSuccess} onChange={(event) => setOnSuccess(event.target.value as OnSuccess)}>
					<option value="half">Half damage</option>
					<option value="none">No damage</option>
				</select>
			</label>
		</>
	)
	const amountField = (
		<label className="combat__field">
			<span>Amount</span>
			<input type="number" inputMode="numeric" min={1} aria-label="Amount" className="combat__number" value={amount} onChange={(event) => setAmount(event.target.value)} />
		</label>
	)
	const damageButtons = (
		<>
			<button type="button" className="combat__damage" disabled={amountValue === null || selectedIds.length === 0} onClick={damage}>
				Damage
			</button>
			<button type="button" className="combat__heal" disabled={amountValue === null || selectedIds.length === 0} onClick={heal}>
				Heal
			</button>
		</>
	)
	const clearButton = (
		<button type="button" className="combat__clear" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
			Clear selection
		</button>
	)

	const list = (
		<ul className="combat__list" aria-label="Turn order">
			{combat.order.map((entry, position) => {
				const isCurrent = position === combat.turn
				const key = entryKey(entry)
				if (entry.kind === 'player') {
					return (
						<li key={key} className={isCurrent ? 'combat-row combat-row--player combat-row--current' : 'combat-row combat-row--player'} aria-label={entry.name} aria-current={isCurrent ? 'true' : undefined}>
							{!mobile && <span />}
							<span className="combat__init">
								{isCurrent && <span className="combat__play">▶</span>}
								{entry.initiative ?? '—'}
							</span>
							<span className="combat__who">
								<span className="combat__name">
									{entry.name}
									<span className="combat__tag">Player</span>
								</span>
							</span>
						</li>
					)
				}
				const ids = entryMemberIds(entry, groups)
				const infos = ids.map((memberId) => members.get(memberId)).filter((info): info is MemberInfo => info !== undefined)
				if (entry.kind === 'member') {
					const info = infos[0]
					return info ? <MemberRow key={key} info={info} initiative={entry.initiative} current={isCurrent} showSubtitle controls={controls} /> : null
				}
				const group = infos[0]?.group
				if (!group) return null
				return (
					<li key={key} className="combat-group" aria-label={`${group.monster.name} group`}>
						<div className={isCurrent ? 'combat-group__head combat-row--current' : 'combat-group__head'} aria-current={isCurrent ? 'true' : undefined}>
							{!mobile && <span />}
							<span className="combat__init">
								{isCurrent && <span className="combat__play">▶</span>}
								{entry.initiative}
							</span>
							<span className="combat-group__title">
								<strong>{groupLabel(group)}</strong> · one initiative roll
								{infos[0]?.monster && <span className="combat__sub">{mobile ? <SaveBonuses monster={infos[0].monster} short /> : ` · CR ${infos[0].monster.cr}`}</span>}
							</span>
							<button type="button" className="combat-group__select" onClick={() => selectAlive(group)}>
								Select all alive
							</button>
						</div>
						<ul className="combat-group__members">
							{infos.map((info) => (
								<MemberRow key={info.member.id} info={info} initiative={null} current={isCurrent} showSubtitle={false} controls={controls} />
							))}
						</ul>
					</li>
				)
			})}
		</ul>
	)

	const endDialog = confirmEnd && (
		<ConfirmDialog
			title="End encounter?"
			body="The turn order, HP, conditions and save results are cleared. The encounter itself is kept."
			safeLabel="Keep fighting"
			destructiveLabel="End encounter"
			onSafe={() => setConfirmEnd(false)}
			onDestructive={() => {
				setConfirmEnd(false)
				commit(null)
				onEnded()
			}}
		/>
	)
	const next = (
		<button type="button" className="btn--accent combat__next" onClick={goNext}>
			Next turn
		</button>
	)

	if (mobile) {
		const saveSummary = ability === '' ? 'Save: none' : `Save: ${ABILITY_LABEL[ability]}${dcValue !== null ? ` DC ${dcValue}` : ''}`
		return (
			<div className="combat combat--mobile">
				<div className="combat__topbar">
					<button type="button" onClick={onBack}>
						Back
					</button>
					<div className="combat__topbar-title">
						<strong className="combat__title">{encounter.name}</strong>
						<span className="combat__round-line">
							Round {combat.round} · {currentName} turn
						</span>
					</div>
					{next}
				</div>
				{error}
				{reminderStrip}
				{list}
				<button type="button" className="combat__end combat__end--mobile" onClick={() => setConfirmEnd(true)}>
					End encounter
				</button>
				{panelOpen && (
					<section className="combat__panel" aria-label="Save settings">
						{saveFields}
						{clearButton}
						<button type="button" onClick={() => setPanelOpen(false)}>
							Done
						</button>
					</section>
				)}
				<div className="combat__bottombar" role="toolbar" aria-label="Selected creatures">
					<div className="combat__bottom-row">
						<span className="combat__count">{selectedIds.length} selected</span>
						<button type="button" className="combat__save-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen((open) => !open)}>
							{saveSummary}
						</button>
						{conditionSelect}
					</div>
					<div className="combat__bottom-row">
						<input type="number" inputMode="numeric" min={1} aria-label="Amount" className="combat__amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
						{damageButtons}
					</div>
				</div>
				{endDialog}
			</div>
		)
	}

	return (
		<div className="combat">
			<div className="combat__header">
				<button type="button" onClick={onBack}>
					Back
				</button>
				<div className="combat__heading">
					<h2 className="combat__title">{encounter.name}</h2>
					<span className="combat__difficulty">{difficulty}</span>
				</div>
				<div className="combat__round" aria-label="Round">
					<span className="combat__round-label">Round</span>
					<strong className="combat__round-value">{combat.round}</strong>
				</div>
				{next}
				<button type="button" className="combat__end" onClick={() => setConfirmEnd(true)}>
					End encounter
				</button>
			</div>
			{error}
			{reminderStrip}
			<div className="combat__body">
				<div className="combat__main">
					<div className="combat__toolbar" role="toolbar" aria-label="Selected creatures">
						<span className="combat__count">{selectedIds.length} selected</span>
						{amountField}
						{saveFields}
						{damageButtons}
						{conditionSelect}
						{clearButton}
					</div>
					<div className="combat__list-card">
						<div className="combat-row combat-row--head" aria-hidden="true">
							<span />
							<span>Init</span>
							<span>Name</span>
							<span>AC</span>
							<span>HP</span>
							<span>Saves</span>
							<span />
						</div>
						{list}
					</div>
				</div>
				{cards.length > 0 && <div className={cards.length > 1 ? 'combat__cards combat__cards--two' : 'combat__cards'}>{cards}</div>}
			</div>
			{endDialog}
		</div>
	)
}
