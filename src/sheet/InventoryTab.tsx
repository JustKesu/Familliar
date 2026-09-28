import { useMemo, useState, type ReactNode } from 'react'
import { BASE_ATTUNEMENT_LIMIT, countAttuned } from '../calculation/attunement'
import { resolveMagicBonus } from '../calculation/magicBonus'
import { type Calculated } from '../calculation/types'
import { Entries } from '../markup'
import { copperToCoins } from '../inventory/currency'
import { toggleEquip } from '../inventory/equipActions'
import { buildInventoryResolver, equipSlotOf, inventoryRowKey, itemFilterKindsOf, itemMagicBonusOf, type ItemRef } from '../inventory/inventoryData'
import { resolveItemEntryRefs, type ItemEntryTemplate } from '../inventory/itemEntryResolver'
import { type CharacterInventoryItem } from '../storage/character'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

type Filter = 'all' | 'equipment' | 'attunement' | 'other'

const FILTERS: { id: Filter; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'equipment', label: 'Equipment' },
	{ id: 'attunement', label: 'Attunement' },
	{ id: 'other', label: 'Other possessions' },
]

/** R10b (D211): the Inventory tab. Read-only except the ACTIVE checkbox, which is Equip/Put down from the panel (shared in equipActions.ts). Search, filter and open rows are tab state only (D116). */
export function InventoryTab({
	inventory,
	currencyCopper,
	itemRefs,
	itemRefsError,
	itemEntryTemplates,
	attunementLimit,
	onEditInventory,
	onManageInventory,
}: {
	inventory: CharacterInventoryItem[]
	currencyCopper: number
	itemRefs: ItemRef[] | null
	itemRefsError: string | null
	itemEntryTemplates: ItemEntryTemplate[]
	attunementLimit: Calculated<number>
	onEditInventory?: (inventory: CharacterInventoryItem[]) => void
	onManageInventory?: () => void
}): ReactNode {
	const resolve = useMemo(() => buildInventoryResolver(itemRefs ?? []), [itemRefs])
	const coins = copperToCoins(currencyCopper)
	const attunedCount = countAttuned(inventory)
	const limit = attunementLimit.status === 'known' ? attunementLimit.value : BASE_ATTUNEMENT_LIMIT
	const [search, setSearch] = useState('')
	const [filter, setFilter] = useState<Filter>('all')
	const [notice, setNotice] = useState<string | null>(null)
	const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

	function toggleActive(index: number): void {
		const result = toggleEquip(inventory, index, resolve)
		if (!result || !onEditInventory) return
		setNotice(result.notice)
		onEditInventory(result.inventory)
	}

	function toggleOpen(key: string): void {
		const next = new Set(open)
		if (next.has(key)) next.delete(key)
		else next.add(key)
		setOpen(next)
	}

	const needle = search.trim().toLowerCase()
	const rows = inventory.map((item, index) => {
		const { ref, problem } = resolve(item)
		const slot = ref ? equipSlotOf(ref) : null
		const attunement = ref?.requiresAttunement === true || item.attuned === true
		const bonus = resolveMagicBonus({
			name: item.name,
			itemBonus: ref ? itemMagicBonusOf(ref) : null,
			playerBonus: item.magicBonus ?? null,
			requiresAttunement: ref?.requiresAttunement === true,
			attuned: item.attuned === true,
		})
		return { item, index, ref, problem, slot, attunement, label: bonus.label, key: `${inventoryRowKey(item)}#${index}` }
	})
	const visible = rows.filter((row) => {
		if (needle !== '' && !row.label.toLowerCase().includes(needle) && !row.item.name.toLowerCase().includes(needle)) return false
		if (filter === 'equipment') return row.slot !== null
		if (filter === 'attunement') return row.attunement
		if (filter === 'other') return row.slot === null && !row.attunement
		return true
	})

	return (
		<section className="sheet__inventory">
			<div className="inventory-tab__header">
				<span className="sheet__currency">
					{coins.gp} gp, {coins.sp} sp, {coins.cp} cp
				</span>
				<span className="sheet__attunement">
					<span className="sheet__attunement-count">
						<span>
							{attunedCount} of {limit} attuned
						</span>{' '}
						{attunementLimit.status === 'known' && <ValueBreakdown breakdown={attunementLimit.breakdown} />}
					</span>
				</span>
			</div>

			<div className="sheet__actions-toolbar">
				<input type="search" className="sheet__spells-search" aria-label="Search inventory" placeholder="Search inventory" value={search} onChange={(event) => setSearch(event.target.value)} />
				<div className="sheet__actions-filters" role="group" aria-label="Filter inventory">
					{FILTERS.map(({ id, label }) => (
						<button key={id} type="button" className={filter === id ? 'pill pill--active' : 'pill'} aria-pressed={filter === id} onClick={() => setFilter(id)}>
							{label}
						</button>
					))}
				</div>
				{onManageInventory && (
					<button type="button" className="sheet__manage-spells" onClick={onManageInventory}>
						Manage Inventory
					</button>
				)}
			</div>

			{itemRefsError && <p className="error">Could not load the item list: {itemRefsError}</p>}
			{/* role="status" so a displaced suit or hand is announced, not just drawn — the same notice the panel shows. */}
			{notice && (
				<p className="sheet__inventory-notice inventory-tab__notice" role="status">
					{notice}
				</p>
			)}

			{inventory.length === 0 ? (
				<p className="inventory-tab__empty">Nothing carried yet.</p>
			) : visible.length === 0 ? (
				<p className="inventory-tab__empty">No items match.</p>
			) : (
				<div className="inventory-tab__table">
					<div className="inventory-tab__row inventory-tab__head">
						<span>Active</span>
						<span>Name</span>
						<span>Qty</span>
						<span>Notes</span>
					</div>
					<ul className="sheet__inventory-list inventory-tab__list">
					{visible.map(({ item, index, ref, problem, slot, label, key }) => {
						// A missing items.json entry is only a problem once the file has loaded; a broken custom definition is one either way (slice e2a).
						const showProblem = problem !== null && (problem.kind === 'malformed-custom' || (itemRefs !== null && itemRefsError === null))
						const kinds = ref ? itemFilterKindsOf(ref).join(', ') : ''
						const subtitle = [kinds, item.custom !== undefined && 'custom'].filter(Boolean).join(', ')
						// The condition is printed verbatim as items.json writes it — the app never reads it (D21).
						const notes = [
							item.equipped,
							item.grip === 'two-handed' && item.equipped === 'held' && 'two-handed',
							item.attuned && 'attuned',
							ref?.requiresAttunement && `requires attunement${ref.attunementCondition ? ` ${ref.attunementCondition}` : ''}`,
							item.custom !== undefined && 'custom',
						]
							.filter(Boolean)
							.join(', ')
						const hasDescription = ref?.entries !== undefined
						const expanded = open.has(key)
						return (
							<li key={key} className="inventory-tab__item">
								<div className="inventory-tab__row">
									<span>
										{slot !== null && (
											<input
												type="checkbox"
												className="inventory-tab__active"
												aria-label={`Active ${label}`}
												checked={item.equipped !== undefined}
												disabled={!onEditInventory}
												onChange={() => toggleActive(index)}
											/>
										)}
									</span>
									<span className="inventory-tab__name-cell">
										<span className="inventory-tab__name-line">
											{hasDescription ? (
												<button type="button" className="manage-spells__expand" aria-expanded={expanded} aria-label={`${label} description`} onClick={() => toggleOpen(key)}>
													{expanded ? '▾' : '▸'}
												</button>
											) : (
												<span className="inventory-tab__toggle-spacer" aria-hidden="true" />
											)}
											<span className="inventory-tab__name">{label}</span>
										</span>
										{subtitle && <span className="inventory-tab__subtitle">{subtitle}</span>}
										{showProblem && <UnresolvedValue reason={problem!.message} />}
									</span>
									<span className="inventory-tab__qty">
										{item.quantity}
									</span>
									<span className="inventory-tab__notes">
										{notes}
									</span>
								</div>
								{expanded && ref?.entries && (
									<div className="inventory-tab__description">
										<Entries entries={resolveItemEntryRefs(ref.entries, ref, itemEntryTemplates)} />
									</div>
								)}
							</li>
						)
					})}
					</ul>
				</div>
			)}
		</section>
	)
}
