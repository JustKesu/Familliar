import { useState, type ReactNode } from 'react'
import { formKey, type Beast, type FamiliarFormOption } from '../beasts/beastData'
import { wildShapeForms as wildShapePool, wildShapeHint, type WildShapeLimits } from '../beasts/wildShapeData'
import type { CharacterFamiliar, CharacterWildShapeForms } from '../storage/character'
import { BeastStatBody, beastKind } from './BeastStatBlock'
import { DrawerSection } from './Drawer'
import { extraRows, type ExtraKind } from './extrasData'
import { UnresolvedValue } from './ValueBreakdown'

type Category = ExtraKind

const CATEGORY_LABELS: Record<Category, string> = { familiar: 'Familiar', wildShape: 'Wild Shape' }

/** One creature, laid out like a Manage Spells row; ▸ opens its stat block. D116: which rows are open is panel state only. */
function CreatureRow({ name, meta, label, action, beast }: { name: string; meta: string; label?: string; action: ReactNode; beast: Beast | null }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="manage-spells__row">
			<div className="manage-spells__line">
				<span className="manage-spells__name-cell">
					<span className="manage-spells__name">{name}</span> <span className="manage-spells__meta">{meta}</span>
					{label && <span className="manage-spells__meta manage-spells__secrets">{label}</span>}
				</span>
				{action}
				{beast && (
					<button type="button" className="manage-spells__expand" aria-expanded={open} aria-label={`${name} stat block`} onClick={() => setOpen(!open)}>
						{open ? '▾' : '▸'}
					</button>
				)}
			</div>
			{open && beast && (
				<div className="manage-spells__text">
					<BeastStatBody beast={beast} />
				</div>
			)}
		</li>
	)
}

const creatureMeta = (beast: Beast): string => `${beastKind(beast)} · CR ${beast.cr}`

function ActionButton({ text, name, disabled, onClick }: { text: string; name: string; disabled?: boolean; onClick: () => void }): ReactNode {
	return (
		<button type="button" className="manage-spells__button" aria-label={`${text} ${name}`} disabled={disabled} onClick={onClick}>
			{text}
		</button>
	)
}

/**
 * The Manage Extras drawer (R11a, D212): add a familiar or Wild Shape form, and
 * delete what the character has. Every click saves at once. Wild Shape checks the
 * COUNT only, never when a form may be swapped (D104/D106).
 */
export function ManageExtrasPanel({
	familiar,
	familiarAvailable,
	familiarForms,
	wildShape,
	wildShapeForms,
	beasts,
	beastsError,
	beastsLoading,
	onChooseFamiliar,
	onEditWildShapeForms,
}: {
	familiar: CharacterFamiliar | null
	/** The character has Find Familiar (however it got it). */
	familiarAvailable: boolean
	familiarForms: FamiliarFormOption[]
	/** The class that has Wild Shape and its limits, or null. */
	wildShape: { className: string; classSource: string; limits: WildShapeLimits } | null
	wildShapeForms: CharacterWildShapeForms[]
	beasts: Beast[]
	beastsError: string | null
	beastsLoading: boolean
	/** Either callback may be absent; its category is then not offered. */
	onChooseFamiliar?: (familiar: CharacterFamiliar | null) => void
	onEditWildShapeForms?: (forms: CharacterWildShapeForms[]) => void
}): ReactNode {
	const categories: Category[] = [...(familiarAvailable && onChooseFamiliar ? (['familiar'] as const) : []), ...(wildShape && onEditWildShapeForms ? (['wildShape'] as const) : [])]
	const [chosenCategory, setCategory] = useState<Category>('familiar')
	const category = categories.includes(chosenCategory) ? chosenCategory : categories[0]
	/* D116: the search never reaches the character. */
	const [search, setSearch] = useState('')

	const ownEntry = wildShape ? wildShapeForms.find((entry) => entry.className === wildShape.className && entry.classSource === wildShape.classSource) : undefined
	const knownKeys = new Set((ownEntry?.forms ?? []).map(formKey))
	const knownCount = ownEntry?.forms.length ?? 0
	const wildShapeFull = wildShape !== null && knownCount >= wildShape.limits.knownForms

	/** SPREADS the picks already made — rebuilding the list from the one form being added has dropped earlier picks before (WildShapeFormPicker). */
	function addForm(beast: Beast): void {
		if (!wildShape || !onEditWildShapeForms) return
		const form = { name: beast.name, source: beast.source }
		onEditWildShapeForms(
			ownEntry
				? wildShapeForms.map((entry) => (entry === ownEntry ? { ...entry, forms: [...entry.forms, form] } : entry))
				: [...wildShapeForms, { className: wildShape.className, classSource: wildShape.classSource, forms: [form] }],
		)
	}

	const rows = extraRows({ familiar, familiarForms, wildShapeForms, beasts, pending: beastsLoading || beastsError !== null })

	function deleteRow(row: (typeof rows)[number]): void {
		if (row.kind === 'familiar') {
			onChooseFamiliar?.(null)
			return
		}
		onEditWildShapeForms?.(
			wildShapeForms.map((entry) =>
				entry.className === row.owner?.className && entry.classSource === row.owner.classSource
					? { ...entry, forms: entry.forms.filter((form) => formKey(form) !== formKey(row)) }
					: entry,
			),
		)
	}

	const needle = search.trim().toLowerCase()
	const offered: { beast: Beast; label?: string }[] =
		category === 'familiar'
			? familiarForms.map(({ beast, origin }) => ({ beast, label: origin === 'pact-of-the-chain' ? 'Pact of the Chain' : undefined }))
			: category === 'wildShape' && wildShape
				? wildShapePool(beasts, wildShape.limits).map((beast) => ({ beast }))
				: []
	const shown = offered.filter(({ beast }) => beast.name.toLowerCase().includes(needle)).sort((a, b) => a.beast.name.localeCompare(b.beast.name))

	function renderAction(beast: Beast): ReactNode {
		if (category === 'familiar') {
			if (familiar && formKey(familiar) === formKey(beast)) return <span className="manage-spells__tag">Current</span>
			return <ActionButton text={familiar ? 'Replace' : 'Add'} name={beast.name} onClick={() => onChooseFamiliar?.({ name: beast.name, source: beast.source })} />
		}
		if (knownKeys.has(formKey(beast))) return <span className="manage-spells__tag">Known</span>
		return <ActionButton text="Add" name={beast.name} disabled={wildShapeFull} onClick={() => addForm(beast)} />
	}

	return (
		<>
			{categories.length > 0 && (
				<DrawerSection title="Add an Extra">
					<section aria-label="Add an Extra" className="manage-spells__list">
						<label className="manage-extras__category">
							Category{' '}
							<select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
								{categories.map((id) => (
									<option key={id} value={id}>
										{CATEGORY_LABELS[id]}
									</option>
								))}
							</select>
						</label>
						{category === 'wildShape' && wildShape && (
							<>
								<p className="manage-spells__counters">
									<span className={wildShapeFull ? 'manage-spells__counter manage-spells__counter--full' : 'manage-spells__counter'}>
										Known forms: {knownCount} / {wildShape.limits.knownForms}
									</span>
								</p>
								<p className="manage-spells__empty">{wildShapeHint(wildShape.limits)}</p>
							</>
						)}
						<input
							type="search"
							className="sheet__spells-search manage-spells__search"
							aria-label="Search creatures"
							placeholder="Search creatures"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						{beastsLoading && <p className="manage-spells__empty">Loading creatures…</p>}
						{beastsError && <p className="error">Could not load the Beast stat blocks: {beastsError}</p>}
						{!beastsLoading && !beastsError && shown.length === 0 && <p className="manage-spells__empty">No creatures match.</p>}
						<ul>
							{shown.map(({ beast, label }) => (
								<CreatureRow key={formKey(beast)} name={beast.name} meta={creatureMeta(beast)} label={label} beast={beast} action={renderAction(beast)} />
							))}
						</ul>
					</section>
				</DrawerSection>
			)}

			<DrawerSection title="Current Extras">
				<section aria-label="Current Extras" className="manage-spells__list">
					{rows.length === 0 && <p className="manage-spells__empty">No extras yet.</p>}
					{(['familiar', 'wildShape'] as const).map((kind) => {
						const group = rows.filter((row) => row.kind === kind)
						return (
							group.length > 0 && (
								<div key={kind}>
									<h4 className="manage-spells__level">{CATEGORY_LABELS[kind]}</h4>
									<ul>
										{group.map((row) => (
											<CreatureRow
												key={row.key}
												name={row.name}
												meta={row.beast ? beastKind(row.beast) : `Stored form (${row.source})`}
												label={row.pactOfTheChain ? 'Pact of the Chain' : undefined}
												beast={row.beast}
												action={<ActionButton text="Delete" name={row.name} onClick={() => deleteRow(row)} />}
											/>
										))}
									</ul>
									{group.map((row) => row.problem && <UnresolvedValue key={row.key} reason={row.problem} />)}
								</div>
							)
						)
					})}
				</section>
			</DrawerSection>
		</>
	)
}
