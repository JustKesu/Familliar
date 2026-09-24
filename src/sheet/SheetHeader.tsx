/*
 * The persistent header of the character sheet (persistent-header rebuild,
 * slice 1). A plain block at the top of the sheet — not sticky — carrying the
 * values the player reads at a glance: name, Armour Class, Initiative, Speed,
 * Proficiency bonus, and Hit points. Every one keeps its class name and its
 * breakdown-on-demand behaviour (D40/D41) so the sheet's own tests still reach
 * it.
 *
 * Slice 9b5 adds the two rest buttons here (SPEC section on the persistent
 * header), because a rest is taken from every tab and moves the hit points among
 * other things. What each one restores is not decided here.
 *
 * Rework R2 splits the output into three stacked blocks: the header row (name,
 * identity, rest buttons, roll history), the number strip (abilities and the
 * five values) and the status row (defenses, conditions, concentration).
 *
 * R4c: the HP card, death saves included, is a caller-built slot (HitPoints.tsx).
 */

import { useContext, type ReactNode } from 'react'
import { RollButton } from '../dice/RollButton'
import { type RollReport } from '../dice/RollHistory'
import { RollModeContext, RollModeSwitch } from '../dice/RollUi'
import { type ArmourClassValue } from '../calculation/armourClass'
import { type SpeedValue } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { CalculatedValueOnly, formatModifier } from './calculatedValue'
import { UnresolvedValue } from './ValueBreakdown'

export type StatCard = 'proficiency' | 'speed' | 'initiative' | 'armour'

export function formatSpeed(speed: SpeedValue): string {
	const parts = [`${speed.walk} ft.`]
	if (speed.fly) parts.push(`fly ${speed.fly} ft.`)
	if (speed.swim) parts.push(`swim ${speed.swim} ft.`)
	if (speed.climb) parts.push(`climb ${speed.climb} ft.`)
	return parts.join(', ')
}

/** The non-walking speeds, for the small line under the Speed value; empty when there are none. */
function otherSpeeds(speed: SpeedValue): string {
	return formatSpeed(speed).split(', ').slice(1).join(' · ')
}

/** Short flags for the AC card; the full sentences are in the drawer (ArmourClassNotes). */
function armourClassNote(ac: ArmourClassValue, formulaError: string | null): string {
	const flags: string[] = []
	if (ac.incomplete.length > 0 || ac.armourNotSet.length > 0 || formulaError) flags.push('⚠ incomplete')
	if (ac.stealthDisadvantage.length > 0) flags.push('Stealth disadv.')
	return flags.join(' · ')
}

/** The AC card's own messages, in full — moved out of the 86px card into its drawer view (D166). */
export function ArmourClassNotes({ armourClass, formulaError }: { armourClass: ArmourClassValue; formulaError: string | null }): ReactNode {
	return (
		<>
			{armourClass.incomplete.length > 0 && (
				<p className="error">Incomplete — equipped but not found in the item data: {armourClass.incomplete.join(', ')}.</p>
			)}
			{/* A worn custom suit with no Armour Class on it. Named rather than left to read as "no armour equipped" (slice e2b). */}
			{armourClass.armourNotSet.length > 0 && <p className="error sheet__armour-not-set">Incomplete — {armourClass.armourNotSet.join('; ')}.</p>}
			{/* A Stealth penalty is shown, never computed into anything. */}
			{armourClass.stealthDisadvantage.length > 0 && (
				<p className="sheet__stealth-note">Disadvantage on Stealth checks ({armourClass.stealthDisadvantage.join(', ')}).</p>
			)}
			{formulaError && <p className="error">Could not check for alternative AC formulas: {formulaError}</p>}
		</>
	)
}

/** The card label is the button that opens its breakdown in the drawer; without a drawer to open it stays plain text. */
function CardLabel({ stat, text, aria, onOpen }: { stat: StatCard; text: string; aria: string; onOpen?: (stat: StatCard) => void }): ReactNode {
	if (!onOpen) return <h2>{text}</h2>
	return (
		<h2>
			<button type="button" className="sheet__card-label" aria-label={aria} onClick={() => onOpen(stat)}>
				{text}
			</button>
		</h2>
	)
}

export function SheetHeader({
	name,
	armourClass,
	armourClassLoading,
	acFormulaKeysError,
	initiative,
	speed,
	proficiencyBonus,
	hitPoints,
	concentratingOn,
	onDropConcentration,
	onShortRest,
	onLongRest,
	onRoll,
	onOpenBreakdown,
	heroicInspiration,
	onToggleHeroicInspiration,
	identity,
	abilities,
	defenses,
}: {
	/** R4b (D166): a card label opens that card's breakdown in the drawer. Absent leaves the labels plain text. */
	onOpenBreakdown?: (stat: StatCard) => void
	/** R4b (D167): a manual on/off. Absent handler shows it read-only. */
	heroicInspiration?: boolean
	onToggleHeroicInspiration?: (on: boolean) => void
	name: string
	/** Rework R2: the species/class/level line and the Edit/Level up controls beside it, built by the caller that holds the character. */
	identity?: ReactNode
	/** Rework R2: the ability modifiers leading the number strip. */
	abilities?: ReactNode
	/** R4c: the Defenses card of the status row. */
	defenses?: ReactNode
	/** R4c: the HP card closing the number strip (HitPointsCard). */
	hitPoints?: ReactNode
	armourClass: Calculated<ArmourClassValue>
	/** True only while the item list is still loading — the AC block says so rather than showing an unarmoured number it would then correct. */
	armourClassLoading: boolean
	acFormulaKeysError: string | null
	initiative: Calculated<number>
	speed: Calculated<SpeedValue>
	proficiencyBonus: Calculated<number>
	/** Slice 9d1: the spell being concentrated on. Null means none, shown as "—". */
	concentratingOn: string | null
	/** Absent on a read-only sheet — the card shows without its drop control. */
	onDropConcentration?: () => void
	/**
	 * Slice 9b5. What a rest restores is decided by the caller, which is the one
	 * that holds the resource list and the hit-point maximum; the header only says
	 * that a rest was taken. Absent on a read-only sheet.
	 */
	onShortRest?: () => void
	onLongRest?: () => void
	onRoll?: (report: RollReport) => void
}): ReactNode {
	const rollMode = useContext(RollModeContext)
	const initial = name.trim().charAt(0).toUpperCase()

	return (
		<>
		<header className="sheet__persistent-header">
			<div className="sheet__header-row">
				<div className="sheet__portrait" aria-hidden="true">
					{initial}
				</div>
				<div className="sheet__header-main">
					<h1>{name}</h1>
					{identity}
				</div>
				<RollModeSwitch mode={rollMode.mode} onChange={rollMode.setMode} />
				{/* Both apply on the click, like every other control in this header — a rest is undone by the same buttons that spend, not by a dialog. */}
				{(onShortRest || onLongRest) && (
					<div className="sheet__rest" role="group" aria-label="Rest">
						{onShortRest && (
							<button type="button" className="btn--accent-outline" onClick={onShortRest}>
								Short Rest
							</button>
						)}{' '}
						{onLongRest && (
							<button type="button" className="btn--accent-outline" onClick={onLongRest}>
								Long Rest
							</button>
						)}
					</div>
				)}
			</div>
		</header>

		<div className="sheet__strip">
			{abilities}

			<section className="sheet__proficiency-bonus">
				<CardLabel stat="proficiency" text="Prof." aria="Proficiency bonus breakdown" onOpen={onOpenBreakdown} />
				<div className="sheet__card-value">
					<CalculatedValueOnly result={proficiencyBonus} format={formatModifier} />
				</div>
			</section>

			<section className="sheet__speed">
				<CardLabel stat="speed" text="Speed" aria="Speed breakdown" onOpen={onOpenBreakdown} />
				<div className="sheet__card-value">
					{speed.status === 'unknown' ? (
						<UnresolvedValue reason={speed.reason} />
					) : (
						<>
							{speed.value.walk}
							<span className="sheet__card-unit"> ft</span>
						</>
					)}
				</div>
				{speed.status === 'known' && otherSpeeds(speed.value) && <p className="sheet__card-note">{otherSpeeds(speed.value)}</p>}
			</section>

			<section className="sheet__initiative">
				<CardLabel stat="initiative" text="Initiative" aria="Initiative breakdown" onOpen={onOpenBreakdown} />
				<div className="sheet__card-value">
					{initiative.status === 'unknown' ? (
						<UnresolvedValue reason={initiative.reason} />
					) : (
						<RollButton modifier={initiative.value} label="initiative" onRoll={onRoll}>
							{formatModifier(initiative.value)}
						</RollButton>
					)}
				</div>
			</section>

			<section className="sheet__armour-class">
				<CardLabel stat="armour" text="Armour Class" aria="Armour Class breakdown" onOpen={onOpenBreakdown} />
				{armourClassLoading ? (
					<p className="sheet__card-value">Loading…</p>
				) : armourClass.status === 'unknown' ? (
					<UnresolvedValue reason={armourClass.reason} />
				) : (
					<>
						<p className="sheet__card-value sheet__armour-class-value">{armourClass.value.value}</p>
						{armourClassNote(armourClass.value, acFormulaKeysError) && <p className="sheet__card-note">{armourClassNote(armourClass.value, acFormulaKeysError)}</p>}
					</>
				)}
			</section>

			<section className="sheet__heroic-inspiration">
				<label>
					<input
						type="checkbox"
						aria-label="Heroic Inspiration"
						checked={heroicInspiration ?? false}
						disabled={!onToggleHeroicInspiration}
						onChange={(event) => onToggleHeroicInspiration?.(event.target.checked)}
					/>
					<span className="sheet__card-note" aria-hidden="true">
						HEROIC
						<br />
						INSPIRATION
					</span>
				</label>
			</section>

			{hitPoints}
		</div>

		<div className="sheet__status-row">
			{defenses}

			{/* R4c: a placeholder until conditions exist — no state, no stored field (rework R12). */}
			<section className="sheet__status-card sheet__status-conditions">
				<h2>Conditions</h2>
				<button type="button" className="sheet__add-condition" disabled title="Coming later">
					+ Add condition
				</button>
			</section>

			<section className="sheet__status-card sheet__concentration">
				<h2>Concentration</h2>
				<span className="sheet__status-text">{concentratingOn ?? '—'}</span>
				{concentratingOn !== null && onDropConcentration && (
					<button type="button" className="sheet__status-drop" aria-label="Drop concentration" onClick={onDropConcentration}>
						Drop
					</button>
				)}
			</section>
		</div>
		</>
	)
}
