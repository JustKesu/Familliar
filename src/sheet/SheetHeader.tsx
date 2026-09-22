/*
 * The persistent header of the character sheet (persistent-header rebuild,
 * slice 1). A plain block at the top of the sheet — not sticky — carrying the
 * six values the player reads at a glance: name, Armour Class, Initiative,
 * Speed, Proficiency bonus, and Hit points. Every one but Hit points is moved
 * verbatim from the flat section list, keeping its class name and its
 * breakdown-on-demand behaviour (D40/D41) so the sheet's own tests still reach
 * it.
 *
 * Hit points is now half computed (build order step 8, slice 8a): the MAXIMUM
 * arrives as an ordinary Calculated<number> with its own breakdown, like the
 * five values above it, while CURRENT stays hand-edited and derived from
 * nothing (D9). The second input is no longer the maximum itself but an
 * override that replaces it.
 *
 * Slice 9a1 (D110) adds the second pile — temporary hit points, shown beside
 * the pair and never added into it — and the damage/healing panel that moves
 * both. Direct entry stays: it is how a mistake is corrected.
 *
 * Slice 9a2 (D111) adds the death saving throws beside it, rendered only while
 * the current is exactly 0 and gone the moment anything lifts it above 0.
 *
 * Slice 9b5 adds the two rest buttons here (SPEC section on the persistent
 * header), because a rest is taken from every tab and moves the hit points among
 * other things. What each one restores is not decided here.
 *
 * Rework R2 splits the output into three stacked blocks: the header row (name,
 * identity, rest buttons, roll history), the number strip (abilities and the
 * five values) and the status row (defenses, concentration).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { RollButton } from '../dice/RollButton'
import { rollKeepOne } from '../dice/roll'
import { RollHistory, type RollHistoryEntry, type RollReport } from '../dice/RollHistory'
import { type ArmourClassValue } from '../calculation/armourClass'
import { type SpeedValue } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { applyDamage, applyHealing, grantTemporaryHitPoints, type HitPointPools } from '../hitPoints/damageHealing'
import {
	applyDeathSaveRoll,
	DEATH_SAVE_BOXES,
	deathSavesAfterHitPointChange,
	deathSaveState,
	describeDeathSaveRoll,
	NO_DEATH_SAVES,
	recordFailures,
	recordSuccesses,
	type DeathSaveProgress,
	type DeathSaveRollResult,
} from '../hitPoints/deathSaves'
import type { CharacterDeathSaves } from '../storage/character'
import type { HitPointFields } from '../storage/characterStore'
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

/**
 * Damage and healing (D110). One amount and three things to do with it, each
 * writing both piles in a single commit so the sheet never shows a half-applied
 * hit. All three need a current value to act on, and healing also needs a
 * maximum to stop at — when either is missing the panel says so rather than
 * treating "not set" as 0 (D43). Direct entry stays available meanwhile.
 */
function DamageHealingPanel({
	currentHp,
	temporaryHitPoints,
	maxHitPoints,
	onApply,
}: {
	currentHp: number | undefined
	temporaryHitPoints: number | undefined
	maxHitPoints: Calculated<number>
	onApply: (pools: HitPointPools) => void
}): ReactNode {
	const [draft, setDraft] = useState('')

	const parsed = Math.floor(Number(draft.trim()))
	const amount = draft.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
	const maximum = maxHitPoints.status === 'known' ? maxHitPoints.value : null
	const pools: HitPointPools = { currentHp: currentHp ?? 0, temporaryHitPoints: temporaryHitPoints ?? 0 }

	function apply(next: HitPointPools): void {
		onApply(next)
		setDraft('')
	}

	return (
		<div className="sheet__damage-healing" role="group" aria-label="Damage and healing">
			<label>
				Amount{' '}
				<input
					type="number"
					min={1}
					inputMode="numeric"
					aria-label="Amount"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
			</label>{' '}
			<button type="button" className="btn--damage" disabled={amount === null || currentHp === undefined} onClick={() => amount !== null && apply(applyDamage(pools, amount))}>
				Damage
			</button>{' '}
			<button
				type="button"
				className="btn--heal"
				disabled={amount === null || currentHp === undefined || maximum === null}
				onClick={() => amount !== null && maximum !== null && apply(applyHealing(pools, amount, maximum))}
			>
				Heal
			</button>{' '}
			<button
				type="button"
				disabled={amount === null || currentHp === undefined}
				onClick={() => amount !== null && apply(grantTemporaryHitPoints(pools, amount))}
			>
				Gain temporary HP
			</button>
			{currentHp === undefined ? (
				<p className="sheet__damage-healing-note">Set current HP first — damage and healing have nothing to act on.</p>
			) : (
				maximum === null && <p className="sheet__damage-healing-note">Healing is unavailable: {maxHitPoints.status === 'unknown' ? maxHitPoints.reason : ''}</p>
			)}
		</div>
	)
}

/**
 * Death saving throws (D111). Rendered only at exactly 0 current hit points; the
 * caller mounts and unmounts it, so there is no state to clear when the
 * character comes back up. Two ways to record a result side by side, with no
 * toggle between them: the app rolls its own plain d20, or the player who rolled
 * a physical die clicks the box themselves. Both stop once the third box on
 * either row is ticked — the character is stabilized or dead, and the panel
 * stays put saying which until the hit points change.
 *
 * The rolled number is not shown here (D117): it is reported up to the header,
 * which outlives this panel.
 */
function DeathSavePanel({
	deathSaves,
	onApply,
	onRolled,
}: {
	deathSaves: DeathSaveProgress
	onApply: (next: { currentHp: number; deathSaves: DeathSaveProgress | undefined }) => void
	/** D117: the result goes to the header, which shows it and logs it — a natural 20 unmounts this panel, and the number must not go with it. */
	onRolled: (result: DeathSaveRollResult) => void
}): ReactNode {
	const state = deathSaveState(deathSaves)
	const finished = state !== 'rolling'

	function applyRoll(rolled: number): void {
		const result = applyDeathSaveRoll(deathSaves, rolled)
		onRolled(result)
		// A natural 20 is a heal like any other: 1 hit point back, and the progress goes with the dying.
		onApply({ currentHp: result.regainsHitPoint ? 1 : 0, deathSaves: result.regainsHitPoint ? undefined : result.progress })
	}

	function roll(): void {
		// D117: the same d20 RollButton makes, with no modifier and no advantage — a death save takes neither.
		applyRoll(rollKeepOne(20, 0, 'normal').kept)
	}

	return (
		<div className="sheet__death-saves" role="group" aria-label="Death saving throws">
			<h3>Death saving throws</h3>
			<p className="sheet__death-save-counts">
				<span className="sheet__death-save-successes">
					Successes: {deathSaves.successes} / {DEATH_SAVE_BOXES}
				</span>{' '}
				<span className="sheet__death-save-failures">
					Failures: {deathSaves.failures} / {DEATH_SAVE_BOXES}
				</span>
			</p>
			<button type="button" disabled={finished} onClick={roll}>
				Roll death save
			</button>{' '}
			<button type="button" disabled={finished} onClick={() => onApply({ currentHp: 0, deathSaves: recordSuccesses(deathSaves) })}>
				Success
			</button>{' '}
			<button type="button" disabled={finished} onClick={() => onApply({ currentHp: 0, deathSaves: recordFailures(deathSaves) })}>
				Failure
			</button>{' '}
			<button type="button" disabled={finished} onClick={() => applyRoll(20)}>
				Natural 20
			</button>{' '}
			<button type="button" disabled={finished} onClick={() => applyRoll(1)}>
				Natural 1
			</button>
			{state === 'stabilized' && (
				<p className="sheet__death-save-state">Stabilized — still at 0 hit points and unconscious. Only healing brings this character back up.</p>
			)}
			{state === 'dead' && <p className="sheet__death-save-state">This character has died.</p>}
		</div>
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
	currentHp,
	maxHitPoints,
	maxHpOverride,
	temporaryHitPoints,
	deathSaves,
	concentratingOn,
	onDropConcentration,
	onEditHitPoints,
	onShortRest,
	onLongRest,
	rollHistory = [],
	onRoll,
	identity,
	abilities,
	defenses,
}: {
	name: string
	/** Rework R2: the species/class/level line and the Edit/Level up controls beside it, built by the caller that holds the character. */
	identity?: ReactNode
	/** Rework R2: the ability modifiers leading the number strip. */
	abilities?: ReactNode
	/** Rework R2: the damage responses, shown in the status row. */
	defenses?: ReactNode
	armourClass: Calculated<ArmourClassValue>
	/** True only while the item list is still loading — the AC block says so rather than showing an unarmoured number it would then correct. */
	armourClassLoading: boolean
	acFormulaKeysError: string | null
	initiative: Calculated<number>
	speed: Calculated<SpeedValue>
	proficiencyBonus: Calculated<number>
	currentHp: number | undefined
	/** Computed (slice 8a). Already carries the override when one is set — the breakdown is what says so. */
	maxHitPoints: Calculated<number>
	maxHpOverride: number | undefined
	/** A second pile, never added into the pair above it (D110). Absent or 0 is none. */
	temporaryHitPoints: number | undefined
	/** Absent means no death save is in progress (D111) — which is the only possible state above 0 hit points. */
	deathSaves: CharacterDeathSaves | undefined
	/** Slice 9d1: the spell being concentrated on. Null means none, and the header then shows nothing for it. */
	concentratingOn: string | null
	/** Absent on a read-only sheet — the line shows without its drop control. */
	onDropConcentration?: () => void
	/** Absent on a read-only sheet — the HP block then shows the values without the fields or the panel. */
	onEditHitPoints?: (hitPoints: HitPointFields) => void
	/**
	 * Slice 9b5. What a rest restores is decided by the caller, which is the one
	 * that holds the resource list and the hit-point maximum; the header only says
	 * that a rest was taken. Absent on a read-only sheet, like the HP editors.
	 */
	onShortRest?: () => void
	onLongRest?: () => void
	/** Slice 9c3b: the sheet-wide history, held by CharacterSheet so every tab's buttons feed one list; shown here because the header is on every tab. */
	rollHistory?: RollHistoryEntry[]
	onRoll?: (report: RollReport) => void
}): ReactNode {
	/** What the death saves are worth on a write that does not touch the current hit points (D111). */
	const carriedDeathSaves = deathSavesAfterHitPointChange(currentHp, deathSaves)
	/* D117: held here, not in the panel, because a natural 20 unmounts the panel. It stays until the next death save roll. */
	const [deathSaveRoll, setDeathSaveRoll] = useState<string | null>(null)

	function recordDeathSaveRoll(result: DeathSaveRollResult): void {
		const text = describeDeathSaveRoll(result)
		setDeathSaveRoll(text)
		onRoll?.({ label: 'death save', text })
	}

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

			<RollHistory entries={rollHistory} />
		</header>

		<div className="sheet__strip">
			{abilities}

			<section className="sheet__proficiency-bonus">
				<h2>Proficiency bonus</h2>
				<div>
					<CalculatedNumber result={proficiencyBonus} format={formatModifier} />
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

			<section className="sheet__initiative">
				<h2>Initiative</h2>
				{/* A div, not a p: CalculatedNumber renders a <details>, which is not valid inside a paragraph. */}
				<div>
					<CalculatedNumber result={initiative} format={formatModifier} />
					{initiative.status === 'known' && (
						<>
							{' '}
							<RollButton modifier={initiative.value} label="initiative" onRoll={onRoll} />
						</>
					)}
				</div>
			</section>

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

			<section className="sheet__hit-points">
				<h2>Hit points</h2>
				{/* Current is hand-edited (D9) and "—" is "not set", distinct from 0; the maximum is computed and shows "—" only when it cannot be. */}
				{/* D110: temporary hit points are a SEPARATE figure — "44 / 44 + 8 temporary", never folded into either number. */}
				<p className="sheet__hit-points-value">
					{hpText(currentHp)} / {hpText(maxHitPoints.status === 'known' ? maxHitPoints.value : undefined)}
					{temporaryHitPoints !== undefined && temporaryHitPoints > 0 && (
						<span className="sheet__temporary-hit-points"> + {temporaryHitPoints} temporary</span>
					)}
				</p>
				<div className="sheet__max-hit-points">
					{maxHitPoints.status === 'unknown' ? <UnresolvedValue reason={maxHitPoints.reason} /> : <ValueBreakdown breakdown={maxHitPoints.breakdown} />}
				</div>
				{onEditHitPoints && (
					<>
					<p>
							{/* D111: a hand-typed current clears the death saves exactly like a heal does — the rule is the same one function either way. */}
							<HitPointField
								label="Current HP"
								value={currentHp}
								onCommit={(value) =>
									onEditHitPoints({ currentHp: value, maxHpOverride, temporaryHitPoints, deathSaves: deathSavesAfterHitPointChange(value, deathSaves) })
								}
							/>{' '}
							<HitPointField
								label="Max HP override"
								value={maxHpOverride}
								onCommit={(value) => onEditHitPoints({ currentHp, maxHpOverride: value, temporaryHitPoints, deathSaves: carriedDeathSaves })}
							/>{' '}
							<HitPointField
								label="Temporary HP"
								value={temporaryHitPoints}
								onCommit={(value) => onEditHitPoints({ currentHp, maxHpOverride, temporaryHitPoints: value, deathSaves: carriedDeathSaves })}
							/>
						</p>
						<DamageHealingPanel
							currentHp={currentHp}
							temporaryHitPoints={temporaryHitPoints}
							maxHitPoints={maxHitPoints}
							onApply={(pools) =>
								onEditHitPoints({
									currentHp: pools.currentHp,
									maxHpOverride,
									temporaryHitPoints: pools.temporaryHitPoints,
									deathSaves: deathSavesAfterHitPointChange(pools.currentHp, deathSaves),
								})
							}
						/>
						{/* D111: only while the character is dying. Healing or a typed-in number unmounts it, and the progress is gone with it. */}
						{currentHp === 0 && (
							<DeathSavePanel
								deathSaves={deathSaves ?? NO_DEATH_SAVES}
								onApply={(next) =>
									onEditHitPoints({ currentHp: next.currentHp, maxHpOverride, temporaryHitPoints, deathSaves: next.deathSaves })
								}
								onRolled={recordDeathSaveRoll}
							/>
						)}
						{/* Outside the panel: on a natural 20 the panel is gone by the time this renders, and the number rolled must still be readable (D117). */}
						{deathSaveRoll !== null && (
							<p className="sheet__death-save-roll" role="status">
								{deathSaveRoll}
							</p>
						)}
					</>
				)}
			</section>
		</div>

		<div className="sheet__status-row">
			{defenses}

			{concentratingOn !== null && (
				<p className="sheet__concentration">
					Concentrating: {concentratingOn}
					{onDropConcentration && (
						<>
							{' '}
							<button type="button" aria-label="Drop concentration" onClick={onDropConcentration}>
								Drop
							</button>
						</>
					)}
				</p>
			)}

			{/* Room held for Conditions, which have no stored field yet (rework R12). */}
			<div className="sheet__status-conditions" aria-hidden="true" />
		</div>
		</>
	)
}
