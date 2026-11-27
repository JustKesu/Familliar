import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMobileLayout } from '../sheet/useMobileLayout'
import { titleCase } from '../sheet/BeastStatBlock'
import { EMPTY_FILTER, filterMonsters, filterOptions, type BestiaryFilter } from '../monsters/bestiaryFilter'
import { MonsterStatBlock } from '../monsters/MonsterStatBlock'
import { formatMonsterType } from '../monsters/monsterFormat'
import { findLegendaryGroup, loadMonsterData, type Monster, type MonsterData } from '../monsters/monsterData'

const SOURCE_LABELS: Record<string, string> = {
	XMM: 'Monster Manual (2024)',
	XDMG: "Dungeon Master's Guide (2024)",
	EFA: 'Eberron: Forge of the Artificer',
	SCC: 'Strixhaven: A Curriculum of Chaos',
	RHW: 'Ravenloft: The Horror Within',
}

export type LoadState<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string }

export function useLoaded<T>(load: () => Promise<T>): LoadState<T> {
	const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
	useEffect(() => {
		let cancelled = false
		load()
			.then((data) => {
				if (!cancelled) setState({ status: 'ready', data })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [load])
	return state
}

const monsterKey = (monster: Monster): string => `${monster.name}|${monster.source}`

function crValue(value: string): number | null {
	return value === '' ? null : Number(value)
}

export function monsterCountText(count: number): string {
	return count === 1 ? '1 monster' : `${count} monsters`
}

export function Bestiary(): ReactNode {
	const state = useLoaded(loadMonsterData)
	if (state.status === 'loading') return <p className="dm__status">Loading bestiary…</p>
	if (state.status === 'error') {
		return (
			<div className="dm__error" role="alert">
				<strong>The bestiary could not be loaded.</strong> {state.message}
			</div>
		)
	}
	return <BestiaryBrowser data={state.data} />
}

/** With `onPick` the list is a picker (D433): each row gets "+ Add" and no stat block opens. */
export function BestiaryBrowser({ data, onPick }: { data: MonsterData; onPick?: (monster: Monster) => void }): ReactNode {
	const [filter, setFilter] = useState<BestiaryFilter>(EMPTY_FILTER)
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const mobile = useMobileLayout()

	const monsters = data.monsters
	const options = useMemo(() => filterOptions(monsters), [monsters])
	const visible = useMemo(() => filterMonsters(monsters, filter), [monsters, filter])

	const selected = onPick || selectedKey === null ? undefined : monsters.find((monster) => monsterKey(monster) === selectedKey)
	const update = (patch: Partial<BestiaryFilter>): void => setFilter((current) => ({ ...current, ...patch }))
	const card = selected ? (
		<MonsterStatBlock monster={selected} group={findLegendaryGroup(selected, data.legendaryGroups)} />
	) : (
		<p className="dm__status">Select a monster to see its stat block.</p>
	)

	if (mobile && selected) {
		return (
			<div className="bestiary bestiary--card-only">
				<button type="button" className="bestiary__back" onClick={() => setSelectedKey(null)}>
					← Back to list
				</button>
				{card}
			</div>
		)
	}

	const rowCells = (monster: Monster) => (
		<>
			<span className="bestiary__name">{monster.name}</span>
			<span>{monster.cr}</span>
			<span className="bestiary__type">{formatMonsterType(typeof monster.type === 'string' ? monster.type : { type: monster.type.type })}</span>
		</>
	)

	const list = (
		<div className="bestiary__list-column">
			<div className="bestiary__filters">
				<input
					type="search"
					className="bestiary__search"
					aria-label="Search monsters"
					placeholder="Search by name"
					value={filter.query}
					onChange={(event) => update({ query: event.target.value })}
				/>
				<label>
					CR from{' '}
					<select value={filter.crMin ?? ''} onChange={(event) => update({ crMin: crValue(event.target.value) })}>
						<option value="">Any</option>
						{options.cr.map((cr) => (
							<option key={cr.value} value={cr.value}>
								{cr.label}
							</option>
						))}
					</select>
				</label>
				<label>
					to{' '}
					<select aria-label="CR to" value={filter.crMax ?? ''} onChange={(event) => update({ crMax: crValue(event.target.value) })}>
						<option value="">Any</option>
						{options.cr.map((cr) => (
							<option key={cr.value} value={cr.value}>
								{cr.label}
							</option>
						))}
					</select>
				</label>
				<label>
					Type{' '}
					<select value={filter.type} onChange={(event) => update({ type: event.target.value })}>
						<option value="">All</option>
						{options.types.map((type) => (
							<option key={type} value={type}>
								{titleCase(type)}
							</option>
						))}
					</select>
				</label>
				<label>
					Environment{' '}
					<select value={filter.environment} onChange={(event) => update({ environment: event.target.value })}>
						<option value="">All</option>
						{options.environments.map((environment) => (
							<option key={environment} value={environment}>
								{titleCase(environment)}
							</option>
						))}
					</select>
				</label>
				<label className="bestiary__filter--wide">
					Book{' '}
					<select value={filter.source} onChange={(event) => update({ source: event.target.value })}>
						<option value="">All</option>
						{options.sources.map((source) => (
							<option key={source} value={source}>
								{SOURCE_LABELS[source] ?? source}
							</option>
						))}
					</select>
				</label>
			</div>
			<p className="bestiary__count" aria-live="polite">
				{monsterCountText(visible.length)}
			</p>
			<div className={onPick ? 'bestiary__row bestiary__row--head bestiary__row--pick' : 'bestiary__row bestiary__row--head'} aria-hidden="true">
				<span>Name</span>
				<span>CR</span>
				<span>Type</span>
				{onPick && <span />}
			</div>
			{visible.length === 0 && <p className="dm__status">No monsters match these filters.</p>}
			<ul className="bestiary__table" aria-label="Monsters">
				{visible.map((monster) => {
					const key = monsterKey(monster)
					return (
						<li key={key}>
							{onPick ? (
								<div className="bestiary__row bestiary__row--pick">
									{rowCells(monster)}
									<button type="button" className="bestiary__add" aria-label={`Add ${monster.name}`} onClick={() => onPick(monster)}>
										+ Add
									</button>
								</div>
							) : (
								<button
									type="button"
									className={key === selectedKey ? 'bestiary__row bestiary__row--selected' : 'bestiary__row'}
									aria-current={key === selectedKey ? 'true' : undefined}
									onClick={() => setSelectedKey(key)}
								>
									{rowCells(monster)}
								</button>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)

	if (onPick) return list

	return (
		<div className="bestiary">
			{list}
			{!mobile && <div className="bestiary__card-column">{card}</div>}
		</div>
	)
}
