/*
 * The persistent header of the character sheet (persistent-header rebuild,
 * slice 1). A plain block at the top of the sheet — not sticky — carrying the
 * six values the player reads at a glance: name, Armour Class, Initiative,
 * Speed, Proficiency bonus, and Hit points. Every one but Hit points is moved
 * verbatim from the flat section list, keeping its class name and its
 * breakdown-on-demand behaviour (D40/D41) so the sheet's own tests still reach
 * it. Hit points is the sole hand-edited value (D9): nothing derives it, and
 * the two fields round-trip straight through storage.
 *
 * Tabs and the actions table are later slices and are not built here.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { type ArmourClassValue } from '../calculation/armourClass'
import { type SpeedValue } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { CalculatedNumber, formatModifier } from './calculatedValue'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

function formatSpeed(speed: SpeedValue): string {
	const parts = [`${speed.walk} ft.`]
	if (speed.fly) parts.push(`fly ${speed.fly} ft.`)
	if (speed.swim) parts.push(`swim ${speed.swim} ft.`)
	if (speed.climb) parts.push(`climb ${speed.climb} ft.`)
	return parts.join(', ')
}

/** A blank field is "not set" (shown as "—"), which is not 0. Commits on blur or Enter, never per keystroke — the value round-trips through storage. */
function HitPointField({ label, value, onCommit }: { label: string; value: number | undefined; onCommit: (value: number | undefined) => void }): ReactNode {
	const [draft, setDraft] = useState(value === undefined ? '' : String(value))
	useEffect(() => {
		setDraft(value === undefined ? '' : String(value))
	}, [value])

	function commit(): void {
		const text = draft.trim()
		if (text === '') {
			setDraft('')
			if (value !== undefined) onCommit(undefined)
			return
		}
		const parsed = Math.floor(Number(text))
		const next = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
		setDraft(String(next))
		if (next !== value) onCommit(next)
	}

	return (
		<label>
			{label}{' '}
			<input
				type="number"
				min={0}
				inputMode="numeric"
				aria-label={label}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur()
				}}
			/>
		</label>
	)
}

function hpText(value: number | undefined): string {
	return value === undefined ? '—' : String(value)
}

export function SheetHeader({
	name,
	armourClass,
	armourClassLoading,
	acFormulaKeysError,
	initiative,
	speed,
	proficiencyBonus,
	currentHp,
	maxHp,
	onEditHitPoints,
}: {
	name: string
	armourClass: Calculated<ArmourClassValue>
	/** True only while the item list is still loading — the AC block says so rather than showing an unarmoured number it would then correct. */
	armourClassLoading: boolean
	acFormulaKeysError: string | null
	initiative: Calculated<number>
	speed: Calculated<SpeedValue>
	proficiencyBonus: Calculated<number>
	currentHp: number | undefined
	maxHp: number | undefined
	/** Absent on a read-only sheet — the HP block then shows the pair without the fields. */
	onEditHitPoints?: (currentHp: number | undefined, maxHp: number | undefined) => void
}): ReactNode {
	return (
		<header className="sheet__persistent-header">
			<h1>{name}</h1>

			<section className="sheet__armour-class">
				<h2>Armour Class</h2>
				{armourClassLoading ? (
					<p>Loading…</p>
				) : armourClass.status === 'unknown' ? (
					<UnresolvedValue reason={armourClass.reason} />
				) : (
					<>
						<p className="sheet__armour-class-value">{armourClass.value.value}</p>
						<ValueBreakdown breakdown={armourClass.breakdown} />
						{armourClass.value.incomplete.length > 0 && (
							<p className="error">
								Incomplete — equipped but not found in the item data: {armourClass.value.incomplete.join(', ')}.
							</p>
						)}
						{/* A worn custom suit with no Armour Class on it. Named rather than left to read as "no armour equipped" (slice e2b). */}
						{armourClass.value.armourNotSet.length > 0 && (
							<p className="error sheet__armour-not-set">Incomplete — {armourClass.value.armourNotSet.join('; ')}.</p>
						)}
						{/* A Stealth penalty is shown, never computed into anything. */}
						{armourClass.value.stealthDisadvantage.length > 0 && (
							<p className="sheet__stealth-note">
								Disadvantage on Stealth checks ({armourClass.value.stealthDisadvantage.join(', ')}).
							</p>
						)}
						{acFormulaKeysError && <p className="error">Could not check for alternative AC formulas: {acFormulaKeysError}</p>}
					</>
				)}
			</section>

			<section className="sheet__initiative">
				<h2>Initiative</h2>
				{/* A div, not a p: CalculatedNumber renders a <details>, which is not valid inside a paragraph. */}
				<div>
					<CalculatedNumber result={initiative} format={formatModifier} />
				</div>
			</section>

			<section className="sheet__speed">
				<h2>Speed</h2>
				<div>
					{speed.status === 'unknown' ? (
						<UnresolvedValue reason={speed.reason} />
					) : (
						<>
							<span>{formatSpeed(speed.value)}</span> <ValueBreakdown breakdown={speed.breakdown} />
						</>
					)}
				</div>
			</section>

			<section className="sheet__proficiency-bonus">
				<h2>Proficiency bonus</h2>
				<div>
					<CalculatedNumber result={proficiencyBonus} format={formatModifier} />
				</div>
			</section>

			<section className="sheet__hit-points">
				<h2>Hit points</h2>
				{/* D9: manually editable, never derived. "—" is "not set", distinct from 0. */}
				<p className="sheet__hit-points-value">
					{hpText(currentHp)} / {hpText(maxHp)}
				</p>
				{onEditHitPoints && (
					<p>
						<HitPointField label="Current HP" value={currentHp} onCommit={(value) => onEditHitPoints(value, maxHp)} />{' '}
						<HitPointField label="Max HP" value={maxHp} onCommit={(value) => onEditHitPoints(currentHp, value)} />
					</p>
				)}
			</section>
		</header>
	)
}
