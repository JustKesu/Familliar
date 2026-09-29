import { useState, type ReactNode } from 'react'
import type { Beast, FamiliarFormOption } from '../beasts/beastData'
import type { CharacterClass, CharacterFamiliar, CharacterWildShapeForms } from '../storage/character'
import { beastAverageHp, beastKind, formatSpeed } from './BeastStatBlock'
import { extraNotes, extraRows, wildShapeNotices, type ExtraKind } from './extrasData'
import type { FamiliarItemBonuses } from './familiarItemBonuses'
import { UnresolvedValue } from './ValueBreakdown'

type Filter = 'all' | ExtraKind

const FILTERS: { id: Filter; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'familiar', label: 'Familiar' },
	{ id: 'wildShape', label: 'Wild Shape' },
]

/** R11a (D212): the Extras tab — the familiar and the Wild Shape forms as one table. Read-only; every edit is in Manage Extras. The filter is tab state only (D116). */
export function ExtrasTab({
	familiar,
	familiarForms,
	wildShapeForms,
	classes,
	beasts,
	beastsError,
	beastsLoading,
	onOpenBeast,
	onOpenFamiliar,
	familiarBonuses,
	onManageExtras,
	onOpenFamiliarHitPoints,
}: {
	familiar: CharacterFamiliar | null
	familiarForms: FamiliarFormOption[]
	wildShapeForms: CharacterWildShapeForms[]
	classes: CharacterClass[]
	beasts: Beast[]
	beastsError: string | null
	beastsLoading: boolean
	onOpenBeast: (beast: Beast) => void
	/** R14d: the familiar's row opens through this when given, so its drawer can list the item bonuses. */
	onOpenFamiliar?: (beast: Beast) => void
	/** R14d (D220): custom item bonuses for the familiar's row. */
	familiarBonuses?: FamiliarItemBonuses
	onManageExtras?: () => void
	/** D213: opens the familiar's Hit Points drawer. Absent shows the numbers without the button. */
	onOpenFamiliarHitPoints?: () => void
}): ReactNode {
	const [filter, setFilter] = useState<Filter>('all')
	const rows = extraRows({ familiar, familiarForms, wildShapeForms, beasts, pending: beastsLoading || beastsError !== null, familiarBonuses })
	const visible = rows.filter((row) => filter === 'all' || row.kind === filter)

	return (
		<section className="sheet__extras">
			<div className="sheet__actions-toolbar">
				<div className="sheet__actions-filters" role="group" aria-label="Filter extras">
					{FILTERS.map(({ id, label }) => (
						<button key={id} type="button" className={filter === id ? 'pill pill--active' : 'pill'} aria-pressed={filter === id} onClick={() => setFilter(id)}>
							{label}
						</button>
					))}
				</div>
				{onManageExtras && (
					<button type="button" className="sheet__manage-spells" onClick={onManageExtras}>
						Manage Extras
					</button>
				)}
			</div>

			{beastsError && <p className="error extras-tab__notice">Could not load the Beast stat blocks: {beastsError}</p>}
			{/* Slice 8e2 (D106): which form is surplus is unknowable (D104), so only how many is shown. */}
			{wildShapeNotices(classes, wildShapeForms).map((notice) =>
				notice.status === 'unknown' ? (
					<p key={notice.key} className="sheet__wild-shape-count-unknown extras-tab__notice">
						<UnresolvedValue reason={notice.text} />
					</p>
				) : (
					<p key={notice.key} className="sheet__wild-shape-count-over extras-tab__notice">
						{notice.text}
					</p>
				),
			)}

			{rows.length === 0 ? (
				<p className="extras-tab__empty">No extras yet.</p>
			) : visible.length === 0 ? (
				<p className="extras-tab__empty">No extras match.</p>
			) : (
				<div className="extras-tab__table">
					<div className="extras-tab__row extras-tab__head">
						<span>Name</span>
						<span>AC</span>
						<span>Hit points</span>
						<span>Speed</span>
						<span>Notes</span>
					</div>
					<ul className="extras-tab__list">
						{visible.map((row) => (
							<li key={row.key} className="extras-tab__item">
								<div className="extras-tab__row">
									<span className="sheet__action-name-cell">
										{row.beast ? (
											<button type="button" className="sheet__action-name" onClick={() => (row.kind === 'familiar' && onOpenFamiliar ? onOpenFamiliar(row.beast!) : onOpenBeast(row.beast!))}>
												{row.name}
											</button>
										) : (
											<span className="sheet__action-name">{row.name}</span>
										)}
										<span className="sheet__action-subtitle">{row.beast ? beastKind(row.beast) : `Stored form (${row.source})`}</span>
										{row.problem && <UnresolvedValue reason={row.problem} />}
									</span>
									<span className="extras-tab__cell">{row.beast ? row.beast.ac.join('/') : '—'}</span>
									<span className={row.kind === 'wildShape' ? 'extras-tab__cell extras-tab__cell--mute' : 'extras-tab__cell'}>
										{row.kind === 'wildShape' ? (
												'Uses your HP'
											) : row.hitPoints ? (
												<>
													{onOpenFamiliarHitPoints ? (
														<button type="button" className="extras-tab__hp" aria-label={`${row.name} hit points`} onClick={onOpenFamiliarHitPoints}>
															{row.hitPoints.current}
															<span className="familiar-hp__slash"> / </span>
															{row.hitPoints.max}
														</button>
													) : (
														`${row.hitPoints.current} / ${row.hitPoints.max}`
													)}
													{row.hitPoints.temporary > 0 && <span className="extras-tab__temp">+{row.hitPoints.temporary} temp</span>}
												</>
											) : row.beast ? (
												beastAverageHp(row.beast)
											) : (
												'—'
											)}
									</span>
									<span className="extras-tab__cell">{row.beast ? formatSpeed(row.beast.speed) : '—'}</span>
									<span className="extras-tab__notes">{extraNotes(row)}</span>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	)
}
