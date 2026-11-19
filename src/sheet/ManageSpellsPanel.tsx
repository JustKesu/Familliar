import { useState, type ReactNode } from 'react'
import type { ResolverData } from '../featureResolver'
import { compareText } from '../text/compareText'
import type { SpellSlotsEntry } from '../calculation/spellSlots'
import type { ClassSpellListSpell } from '../spells/classSpellListData'
import { expandedSpellListClassFor, spellListClassFor } from '../spells/classSpellListData'
import { useClassSpellPool } from '../spells/classSpellPool'
import { CLASS_SPELL_PICKER_KEY, knownSpellNote, knownSpellReason, type KnownSpell } from '../spells/knownSpells'
import { filterSpellsByLevel } from '../spells/spellLevelFilter'
import { findSpellDetail, type SpellDetail } from '../spells/spellDetailData'
import { spellIdentityKey } from '../spells/subclassPreparedSpells'
import { DrawerSection } from './Drawer'
import type { CharacterSpellbookSpell } from '../storage/character'
import { pickCounts, preparedSpellRows, type ClassSpellHoldings, type SpellRef } from './manageSpellsData'
import { bookPickKindFor, bookPickStatus, canToggleBookPick, isBookPick, toggledBookPicks, type BookPicks } from '../spells/wizardBookPicks'
import { SpellDetailBody } from './SpellList'
import { ordinalLevel, sectionLabel } from './spellsTabData'

function levelLabel(level: number | null): string {
	if (level === null) return '?'
	return level === 0 ? 'Cantrip' : ordinalLevel(level)
}

function groupByLevel<T extends { level: number | null }>(spells: readonly T[]): [number | null, T[]][] {
	const groups = new Map<number | null, T[]>()
	for (const spell of spells) groups.set(spell.level, [...(groups.get(spell.level) ?? []), spell])
	return [...groups.entries()].sort(([a], [b]) => (a ?? 99) - (b ?? 99))
}

function ManagedSpellRow({
	name,
	level,
	flags,
	note,
	magicalSecrets,
	action,
	wrapAction = false,
	detail,
	resolverData,
}: {
	name: string
	level: number | null
	flags?: { ritual: boolean; concentration: boolean }
	magicalSecrets?: boolean
	note?: ReactNode
	action: ReactNode
	/** F-WM: three buttons do not fit beside the name in the drawer, so the group may drop to a line of its own. */
	wrapAction?: boolean
	detail: SpellDetail | undefined
	resolverData: ResolverData
}): ReactNode {
	/* D116: which rows are open is panel state only. */
	const [open, setOpen] = useState(false)
	return (
		<li className="manage-spells__row">
			<div className={wrapAction ? 'manage-spells__line manage-spells__line--wrap' : 'manage-spells__line'}>
				<span className="manage-spells__name-cell">
					<span className="manage-spells__name">{name}</span> <span className="manage-spells__meta">({levelLabel(level)})</span>
					{magicalSecrets && <span className="manage-spells__meta manage-spells__secrets">Magical Secrets</span>}
					{flags?.concentration && (
						<span className="manage-spells__marker" title="Concentration" aria-label="Concentration">
							C
						</span>
					)}
					{flags?.ritual && (
						<span className="manage-spells__marker" title="Ritual" aria-label="Ritual">
							R
						</span>
					)}
					{note && <span className="manage-spells__meta manage-spells__note">{note}</span>}
				</span>
				{wrapAction ? <span className="manage-spells__actions">{action}</span> : action}
				<button type="button" className="manage-spells__expand" aria-expanded={open} aria-label={`${name} text`} onClick={() => setOpen(!open)}>
					{open ? '▾' : '▸'}
				</button>
			</div>
			{open && <div className="manage-spells__text">{detail ? <SpellDetailBody detail={detail} resolverData={resolverData} /> : <p>No text found for “{name}”.</p>}</div>}
		</li>
	)
}

function PickButton({ spell, picked, disabled, onClick }: { spell: { name: string; level: number | null }; picked: boolean; disabled?: boolean; onClick: () => void }): ReactNode {
	const text = spell.level === 0 ? (picked ? 'Delete' : 'Add') : picked ? 'Unprepare' : 'Prepare'
	return (
		<button type="button" className={picked ? 'manage-spells__button manage-spells__button--pick manage-spells__button--on' : 'manage-spells__button manage-spells__button--pick'} aria-label={`${text} ${spell.name}`} disabled={disabled} onClick={onClick}>
			{text}
		</button>
	)
}

/**
 * One casting class in the Manage Spells drawer (R9a, D208): what the class gives
 * the character, and its whole pool to prepare from. Counts only (plan decision
 * 21), never when a swap is allowed. Holds no slots, so the wizard can reuse it (R9c).
 */
export function ClassSpellsManager({
	className,
	classSource,
	classLevel,
	subclassName,
	cantripCount,
	leveledSpellCount,
	spellSlots,
	featChoices,
	holdings,
	alreadyKnown,
	preparedByOther,
	details,
	resolverData,
	onChange,
	spellbook,
}: {
	className: string
	classSource: string
	classLevel: number
	subclassName: string | null
	cantripCount: number
	leveledSpellCount: number
	spellSlots: SpellSlotsEntry | undefined
	featChoices: readonly SpellRef[]
	holdings: ClassSpellHoldings
	alreadyKnown: readonly KnownSpell[]
	/** D331: spells another held class has always prepared (identity key to class name); a pick here still counts for this class. */
	preparedByOther?: ReadonlyMap<string, string>
	details: SpellDetail[]
	resolverData: ResolverData
	/** A newly added pick carries its level (the wizard stores it, D210); picks passed in come back untouched. */
	onChange: (picks: (SpellRef & { level?: number })[]) => void
	/** D422: the Wizard's book. Present, leveled spells are prepared only from it; `picks` is given when the change unprepares too. */
	spellbook?: {
		spells: readonly CharacterSpellbookSpell[]
		/** `added` is the spell an Add to spellbook wrote, with its level (the wizard needs it, D423). */
		onChange: (spells: CharacterSpellbookSpell[], picks?: SpellRef[], added?: SpellRef & { level: number }) => void
		/** D423: the creation wizard's rules for this run; absent = the sheet's (any non-'level' entry). */
		removable?: (spell: SpellRef) => boolean
		/** D423: entries this run must write; Add to spellbook stops at the count. */
		counter?: { count: number; required: number }
		/** D423: the highest spell level this run may write. */
		maxSpellLevel?: number
		/** D424: Savant picks, in the book without being stored there; never removed here. */
		savant?: readonly SpellRef[]
		/** D425: Spell Mastery and Signature Spells, picked only here (the sheet); `active` holds the picks that count now. */
		bookPicks?: { wizardLevel: number; active: BookPicks; onChange: (picks: BookPicks) => void }
	}
}): ReactNode {
	const listClass = spellListClassFor(className, classSource, subclassName)
	const expandedClass = expandedSpellListClassFor(subclassName)
	const pool = useClassSpellPool({
		className: listClass.className,
		classSource: listClass.classSource,
		classLevel,
		expandedClassName: expandedClass?.className,
		expandedClassSource: expandedClass?.classSource,
		featChoices,
	})
	/* D116: search and level pills never reach the character. */
	const [search, setSearch] = useState('')
	const [levels, setLevels] = useState<ReadonlySet<number>>(new Set())

	const poolSpells = pool.status === 'ready' ? pool.spells : []
	const levelOf = (spell: SpellRef): number | null => {
		const key = spellIdentityKey(spell.name, spell.source)
		return poolSpells.find((candidate) => spellIdentityKey(candidate.name, candidate.source) === key)?.level ?? findSpellDetail(details, spell.name, spell.source)?.level ?? null
	}
	const secretKeys = new Set(poolSpells.filter((spell) => spell.viaClassExpanded).map((spell) => spellIdentityKey(spell.name, spell.source)))
	const isSecret = (spell: SpellRef) => secretKeys.has(spellIdentityKey(spell.name, spell.source))
	const rows = preparedSpellRows(holdings, levelOf)
	const counts = pickCounts(rows)
	const cantripsFull = counts.cantrips >= cantripCount
	const preparedFull = counts.prepared >= leveledSpellCount
	const pickedKeys = new Set(holdings.picks.map((pick) => spellIdentityKey(pick.name, pick.source)))
	const isPicked = (spell: SpellRef) => pickedKeys.has(spellIdentityKey(spell.name, spell.source))

	const add = (spell: SpellRef & { level: number | null }) =>
		onChange([...holdings.picks, { name: spell.name, source: spell.source, ...(spell.level !== null ? { level: spell.level } : {}) }])
	const remove = (spell: SpellRef) => onChange(holdings.picks.filter((pick) => spellIdentityKey(pick.name, pick.source) !== spellIdentityKey(spell.name, spell.source)))

	const savantKeys = new Set((spellbook?.savant ?? []).map((spell) => spellIdentityKey(spell.name, spell.source)))
	const isSavant = (spell: SpellRef) => savantKeys.has(spellIdentityKey(spell.name, spell.source))
	const storedKeys = new Set((spellbook?.spells ?? []).map((spell) => spellIdentityKey(spell.name, spell.source)))
	const bookKeys = new Set([...storedKeys, ...savantKeys])
	const inBook = (spell: SpellRef) => bookKeys.has(spellIdentityKey(spell.name, spell.source))
	const bookRows = [
		...(spellbook?.spells ?? []),
		...(spellbook?.savant ?? [])
			.filter((spell) => !storedKeys.has(spellIdentityKey(spell.name, spell.source)))
			.map((spell) => ({ name: spell.name, source: spell.source, origin: { kind: 'copied' as const } })),
	]
		.map((spell) => ({ ...spell, level: levelOf(spell) }))
		.sort((a, b) => compareText(a.name, b.name))
	const bookFull = spellbook?.counter !== undefined && spellbook.counter.count >= spellbook.counter.required
	const canRemoveFromBook = (row: CharacterSpellbookSpell) => !isSavant(row) && (spellbook?.removable ? spellbook.removable(row) : row.origin.kind !== 'level')
	const copyToBook = (spell: SpellRef & { level: number }) =>
		spellbook?.onChange([...(spellbook.spells ?? []), { name: spell.name, source: spell.source, origin: { kind: 'copied' } }], undefined, { name: spell.name, source: spell.source, level: spell.level })
	const removeFromBook = (spell: SpellRef) => {
		if (!spellbook) return
		const key = spellIdentityKey(spell.name, spell.source)
		spellbook.onChange(
			spellbook.spells.filter((entry) => spellIdentityKey(entry.name, entry.source) !== key),
			isPicked(spell) ? holdings.picks.filter((pick) => spellIdentityKey(pick.name, pick.source) !== key) : undefined,
		)
	}

	const bookPicks = spellbook?.bookPicks
	const bookPickStatusLines = bookPicks ? bookPickStatus(bookPicks.active, bookPicks.wizardLevel) : []
	function bookPickToggle(row: SpellRef & { level: number | null }): ReactNode {
		if (!bookPicks) return null
		const kind = bookPickKindFor(row.level, findSpellDetail(details, row.name, row.source)?.time ?? [], bookPicks.wizardLevel)
		if (kind === null) return null
		const on = isBookPick(bookPicks.active, kind, row)
		const label = kind === 'mastery' ? 'Mastery' : 'Signature'
		return (
			<button
				type="button"
				className={on ? 'manage-spells__button manage-spells__button--on' : 'manage-spells__button'}
				aria-pressed={on}
				aria-label={`${label} ${row.name}`}
				disabled={!canToggleBookPick(bookPicks.active, kind, row, levelOf)}
				onClick={() => bookPicks.onChange(toggledBookPicks(bookPicks.active, kind, row))}
			>
				{label}
			</button>
		)
	}

	const offered = filterSpellsByLevel(poolSpells, spellSlots).filter((spell) => (spell.level === 0 ? cantripCount > 0 : leveledSpellCount > 0))
	const pillLevels = [...new Set(offered.map((spell) => spell.level))].sort((a, b) => a - b)
	const needle = search.trim().toLowerCase()
	const shown = offered
		.filter((spell) => (levels.size === 0 || levels.has(spell.level)) && spell.name.toLowerCase().includes(needle))
		.sort((a, b) => compareText(a.name, b.name))

	function toggleLevel(level: number): void {
		const next = new Set(levels)
		if (next.has(level)) next.delete(level)
		else next.add(level)
		setLevels(next)
	}

	function renderOffered(spell: ClassSpellListSpell): ReactNode {
		const picked = isPicked(spell)
		const known = picked ? null : knownSpellReason(alreadyKnown, spell, CLASS_SPELL_PICKER_KEY)
		const full = spell.level === 0 ? cantripsFull : preparedFull
		const otherClass = preparedByOther?.get(spellIdentityKey(spell.name, spell.source))
		const otherNote = otherClass !== undefined ? `Already prepared by ${otherClass}` : null
		const knownNote = known !== null ? knownSpellNote(known) : null
		return (
			<ManagedSpellRow
				key={`${spell.name}|${spell.source}`}
				name={spell.name}
				level={spell.level}
				flags={spell}
				magicalSecrets={isSecret(spell)}
				note={knownNote !== null && otherNote !== null ? `${knownNote} · ${otherNote}` : (knownNote ?? otherNote ?? undefined)}
				action={
					spellbook && spell.level > 0 && !picked && !inBook(spell) ? (
						<button
								type="button"
								className="manage-spells__button"
								aria-label={`Add ${spell.name} to spellbook`}
								disabled={bookFull || (spellbook.maxSpellLevel !== undefined && spell.level > spellbook.maxSpellLevel)}
								onClick={() => copyToBook(spell)}
							>
							Add to spellbook
						</button>
					) : (
						<PickButton spell={spell} picked={picked} disabled={!picked && (full || known !== null)} onClick={() => (picked ? remove(spell) : add(spell))} />
					)
				}
				detail={findSpellDetail(details, spell.name, spell.source)}
				resolverData={resolverData}
			/>
		)
	}

	return (
		<DrawerSection title={className}>
			<DrawerSection title={`Prepared Spells (${rows.length})`}>
				<section aria-label="Prepared Spells" className="manage-spells__list">
					{rows.length === 0 && <p className="manage-spells__empty">No spells from this class yet.</p>}
					{groupByLevel(rows).map(([level, group]) => (
						<div key={String(level)}>
							<h4 className="manage-spells__level">{level === null ? 'Unknown level' : sectionLabel(level)}</h4>
							<ul>
								{group.map((row) => (
									<ManagedSpellRow
										key={`${row.name}|${row.source}`}
										name={row.name}
										level={row.level}
										magicalSecrets={isSecret(row)}
										action={
											row.kind === 'pick' ? (
												<PickButton spell={row} picked onClick={() => remove(row)} />
											) : (
												<span className="manage-spells__tag">{row.kind === 'alwaysPrepared' ? 'Always prepared' : subclassName}</span>
											)
										}
										detail={findSpellDetail(details, row.name, row.source)}
										resolverData={resolverData}
									/>
								))}
							</ul>
						</div>
					))}
				</section>
			</DrawerSection>
			{spellbook && (
				<DrawerSection title={`Spellbook (${bookRows.length})`}>
					<section aria-label="Spellbook" className="manage-spells__list">
						{bookPickStatusLines.length > 0 && (
							<p className="manage-spells__counters">
								{bookPickStatusLines.map((line) => (
									<span key={line} className="manage-spells__counter">
										{line}
									</span>
								))}
							</p>
						)}
						{bookRows.length === 0 && <p className="manage-spells__empty">No spells in the spellbook yet.</p>}
						{groupByLevel(bookRows).map(([level, group]) => (
							<div key={String(level)}>
								<h4 className="manage-spells__level">{level === null ? 'Unknown level' : sectionLabel(level)}</h4>
								<ul>
									{group.map((row) => {
										const picked = isPicked(row)
										const known = picked ? null : knownSpellReason(alreadyKnown, row, CLASS_SPELL_PICKER_KEY)
										const toggle = bookPickToggle(row)
										const removable = canRemoveFromBook(row)
										return (
											<ManagedSpellRow
												key={`${row.name}|${row.source}`}
												name={row.name}
												level={row.level}
												magicalSecrets={isSecret(row)}
												note={known !== null ? knownSpellNote(known) : undefined}
												wrapAction={toggle !== null && removable}
												action={
													<>
														{isSavant(row) && <span className="manage-spells__tag">Savant</span>}
														{toggle}
														{removable && (
															<button type="button" className="manage-spells__button" aria-label={`Remove ${row.name} from spellbook`} onClick={() => removeFromBook(row)}>
																Remove from spellbook
															</button>
														)}
														<PickButton spell={row} picked={picked} disabled={!picked && (preparedFull || known !== null)} onClick={() => (picked ? remove(row) : add(row))} />
													</>
												}
												detail={findSpellDetail(details, row.name, row.source)}
												resolverData={resolverData}
											/>
										)
									})}
								</ul>
							</div>
						))}
					</section>
				</DrawerSection>
			)}
			<DrawerSection title="Add Spells">
				<section aria-label="Add Spells" className="manage-spells__list">
					<p className="manage-spells__counters">
						{cantripCount > 0 && (
							<span className={cantripsFull ? 'manage-spells__counter manage-spells__counter--full' : 'manage-spells__counter'}>
								Cantrips: {counts.cantrips}/{cantripCount}
							</span>
						)}
						<span className={preparedFull ? 'manage-spells__counter manage-spells__counter--full' : 'manage-spells__counter'}>
							Prepared: {counts.prepared}/{leveledSpellCount}
						</span>
						{spellbook?.counter && (
							<span className={bookFull ? 'manage-spells__counter manage-spells__counter--full' : 'manage-spells__counter'}>
								Spellbook: {spellbook.counter.count}/{spellbook.counter.required}
							</span>
						)}
					</p>
					<input
						type="search"
						className="sheet__spells-search manage-spells__search"
						aria-label={`Search ${className} spells`}
						placeholder="Search spells"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<div className="sheet__actions-filters manage-spells__pills" role="group" aria-label="Filter by level">
						{pillLevels.map((level) => (
							<button key={level} type="button" className={levels.has(level) ? 'pill pill--active' : 'pill'} aria-pressed={levels.has(level)} onClick={() => toggleLevel(level)}>
								{levelLabel(level)}
							</button>
						))}
					</div>
					{pool.status === 'loading' && <p className="manage-spells__empty">Loading spells…</p>}
					{pool.status === 'error' && <p className="error">Could not load spells: {pool.message}</p>}
					{pool.status === 'ready' && shown.length === 0 && <p className="manage-spells__empty">No spells match.</p>}
					{groupByLevel(shown).map(([level, group]) => (
						<div key={String(level)}>
							<h4 className="manage-spells__level">{sectionLabel(level ?? 0)}</h4>
							<ul>{group.map(renderOffered)}</ul>
						</div>
					))}
				</section>
			</DrawerSection>
		</DrawerSection>
	)
}
