import { useEffect, useState, type ReactNode } from 'react'
import { rollKeepOne } from '../dice/roll'
import { type Calculated } from '../calculation/types'
import { applyDamage, applyHealing, grantTemporaryHitPoints, type HitPointPools } from '../hitPoints/damageHealing'
import {
	applyDeathSaveRoll,
	DEATH_SAVE_BOXES,
	deathSavesAfterDamageAtZero,
	deathSavesAfterHitPointChange,
	deathSaveState,
	NO_DEATH_SAVES,
	recordFailures,
	recordSuccesses,
	type DeathSaveProgress,
	type DeathSaveRollResult,
} from '../hitPoints/deathSaves'
import type { CharacterDeathSaves } from '../storage/character'
import type { HitPointFields } from '../storage/characterStore'
import { DrawerSection } from './Drawer'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

/** The hit-point fields as stored, plus the writer. Absent writer = read-only sheet: values only, no controls, no death saves. */
export interface HitPointProps {
	currentHp: number | undefined
	/** Computed (slice 8a). Already carries the override when one is set — the breakdown is what says so. */
	maxHitPoints: Calculated<number>
	maxHpOverride: number | undefined
	/** A second pile, never added into the pair (D110). Absent or 0 is none. */
	temporaryHitPoints: number | undefined
	/** Absent means no death save is in progress (D111). */
	deathSaves: CharacterDeathSaves | undefined
	onEditHitPoints?: (hitPoints: HitPointFields) => void
	/** D117: the rolled number goes up to the sheet, which logs it and keeps it readable after a natural 20 ends the dying. */
	onDeathSaveRolled?: (result: DeathSaveRollResult) => void
}

function hpText(value: number | undefined): string {
	return value === undefined ? '—' : String(value)
}

function knownMax(maxHitPoints: Calculated<number>): number | null {
	return maxHitPoints.status === 'known' ? maxHitPoints.value : null
}

function parseAmount(draft: string): number | null {
	const parsed = Math.floor(Number(draft.trim()))
	return draft.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function pools(hp: HitPointProps): HitPointPools {
	return { currentHp: hp.currentHp ?? 0, temporaryHitPoints: hp.temporaryHitPoints ?? 0 }
}

/** Both piles in one commit, so the sheet never shows a half-applied hit (D110); death saves follow the one rule of D111. */
function writePools(hp: HitPointProps, next: HitPointPools, deathSaves: DeathSaveProgress | undefined = hp.deathSaves): void {
	hp.onEditHitPoints?.({
		currentHp: next.currentHp,
		maxHpOverride: hp.maxHpOverride,
		temporaryHitPoints: next.temporaryHitPoints,
		deathSaves: deathSavesAfterHitPointChange(next.currentHp, deathSaves),
	})
}

/** Damage: at 0 hit points, whatever gets past the temporary pile is a death save failure (D169). */
export function damageHitPoints(hp: HitPointProps, amount: number): void {
	const before = pools(hp)
	const next = applyDamage(before, amount)
	const reachedHitPoints = hp.currentHp === 0 && next.temporaryHitPoints === 0 && amount > before.temporaryHitPoints
	writePools(hp, next, reachedHitPoints ? deathSavesAfterDamageAtZero(hp.deathSaves ?? NO_DEATH_SAVES) : hp.deathSaves)
}

function writeDeathSaves(hp: HitPointProps, next: { currentHp: number; deathSaves: DeathSaveProgress | undefined }): void {
	hp.onEditHitPoints?.({ currentHp: next.currentHp, maxHpOverride: hp.maxHpOverride, temporaryHitPoints: hp.temporaryHitPoints, deathSaves: next.deathSaves })
}

function applyDeathSave(hp: HitPointProps, rolled: number): void {
	const result = applyDeathSaveRoll(hp.deathSaves ?? NO_DEATH_SAVES, rolled)
	hp.onDeathSaveRolled?.(result)
	// A natural 20 is a heal like any other: 1 hit point back, and the progress goes with the dying.
	writeDeathSaves(hp, { currentHp: result.regainsHitPoint ? 1 : 0, deathSaves: result.regainsHitPoint ? undefined : result.progress })
}

/** Why a heal cannot happen, or null when it can (D43: "not set" and "cannot be computed" are never read as 0). */
function healBlockedReason(hp: HitPointProps): string | null {
	if (hp.currentHp === undefined) return 'Set current HP first — damage and healing have nothing to act on.'
	if (hp.maxHitPoints.status === 'unknown') return `Healing is unavailable: ${hp.maxHitPoints.reason}`
	return null
}

function HpLabel({ text, onOpen }: { text: string; onOpen?: () => void }): ReactNode {
	if (!onOpen) return <h2>{text}</h2>
	return (
		<h2>
			<button type="button" className="sheet__card-label" aria-label="Hit points details" onClick={onOpen}>
				{text}
			</button>
		</h2>
	)
}

function DamageHealingColumn(hp: HitPointProps): ReactNode {
	const [draft, setDraft] = useState('')
	const amount = parseAmount(draft)
	const maximum = knownMax(hp.maxHitPoints)
	const noCurrent = hp.currentHp === undefined ? 'Set current HP first' : undefined

	function apply(next: HitPointPools): void {
		writePools(hp, next)
		setDraft('')
	}

	function damage(value: number): void {
		damageHitPoints(hp, value)
		setDraft('')
	}

	return (
		<div className="sheet__damage-healing" role="group" aria-label="Damage and healing">
			<button
				type="button"
				className="btn--heal"
				title={healBlockedReason(hp) ?? undefined}
				disabled={amount === null || hp.currentHp === undefined || maximum === null}
				onClick={() => amount !== null && maximum !== null && apply(applyHealing(pools(hp), amount, maximum))}
			>
				Heal
			</button>
			<input
				type="number"
				min={1}
				inputMode="numeric"
				aria-label="Amount"
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
			/>
			<button
				type="button"
				className="btn--damage"
				title={noCurrent}
				disabled={amount === null || hp.currentHp === undefined}
				onClick={() => amount !== null && damage(amount)}
			>
				Damage
			</button>
		</div>
	)
}

function DeathSaveMarks({ label, count, className }: { label: string; count: number; className: string }): ReactNode {
	return (
		<span className={className} role="img" aria-label={`${label}: ${count} / ${DEATH_SAVE_BOXES}`}>
			{Array.from({ length: DEATH_SAVE_BOXES }, (_, index) => (index < count ? '●' : '○')).join('')}
		</span>
	)
}

/** D111 inside the HP card: the marks and the app's own d20 (no modifier, no advantage — a death save takes neither, D117). */
function DeathSaveCard({ hp, onOpen }: { hp: HitPointProps; onOpen?: () => void }): ReactNode {
	const progress = hp.deathSaves ?? NO_DEATH_SAVES
	const state = deathSaveState(progress)
	return (
		<div className="sheet__death-saves" role="group" aria-label="Death saving throws">
			<HpLabel text="Death Saves" onOpen={onOpen} />
			<div className="sheet__death-save-body">
				<div className="sheet__death-save-marks">
					<DeathSaveMarks label="Successes" count={progress.successes} className="sheet__death-save-successes" />
					<DeathSaveMarks label="Failures" count={progress.failures} className="sheet__death-save-failures" />
				</div>
				{state === 'rolling' ? (
					<button type="button" className="sheet__death-save-roll-button" aria-label="Roll death save" onClick={() => applyDeathSave(hp, rollKeepOne(20, 0, 'normal').kept)}>
						d20
					</button>
				) : (
					<span className="sheet__death-save-word" data-state={state}>
						{state === 'stabilized' ? 'Stable' : 'Dead'}
					</span>
				)}
			</div>
		</div>
	)
}

/**
 * The HP card at the end of the number strip (R4c). Fixed at the strip's 86px:
 * everything that does not fit — fields, breakdown, manual death save
 * entry — is in the Hit Points drawer (HitPointsPanel). Hit dice are in the Short Rest drawer (D183).
 */
export function HitPointsCard({ onOpen, ...hp }: HitPointProps & { onOpen?: () => void }): ReactNode {
	const temporary = hp.temporaryHitPoints ?? 0
	// D111: only while dying, and "not set" is not 0 (D43).
	const dying = hp.currentHp === 0 && hp.onEditHitPoints !== undefined
	return (
		<section className="sheet__hit-points">
			{hp.onEditHitPoints && <DamageHealingColumn {...hp} />}
			{dying ? (
				<DeathSaveCard hp={hp} onOpen={onOpen} />
			) : (
				<div className="sheet__hp-main">
					<HpLabel text="Hit Points" onOpen={onOpen} />
					<p className="sheet__hit-points-value">
						{hpText(hp.currentHp)}
						<span className="sheet__hp-slash"> / </span>
						{hpText(knownMax(hp.maxHitPoints) ?? undefined)}
					</p>
				</div>
			)}
			{/* D110: a separate pile, never folded into the pair. */}
			<div className="sheet__hp-temp">
				<h2>Temp</h2>
				<p className="sheet__temporary-hit-points">{temporary > 0 ? temporary : '—'}</p>
			</div>
		</section>
	)
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
				className="input--narrow"
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

function GainTemporaryHitPoints(hp: HitPointProps): ReactNode {
	const [draft, setDraft] = useState('')
	const amount = parseAmount(draft)
	return (
		<p className="sheet__gain-temporary" role="group" aria-label="Gain temporary hit points">
			<label>
				Temporary HP to gain{' '}
				<input
					type="number"
					min={1}
					inputMode="numeric"
					className="input--narrow"
					aria-label="Temporary HP to gain"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
			</label>{' '}
			<button
				type="button"
				disabled={amount === null || hp.currentHp === undefined}
				onClick={() => {
					if (amount === null) return
					writePools(hp, grantTemporaryHitPoints(pools(hp), amount))
					setDraft('')
				}}
			>
				Gain temporary HP
			</button>
		</p>
	)
}

/** The manual half of D111 — for a player who rolled a physical die — and the state in full words. */
function DeathSaveRecord(hp: HitPointProps): ReactNode {
	const progress = hp.deathSaves ?? NO_DEATH_SAVES
	const state = deathSaveState(progress)
	const finished = state !== 'rolling'
	return (
		<div className="sheet__death-save-record" role="group" aria-label="Death save record">
			<p className="sheet__death-save-counts">
				Successes: {progress.successes} / {DEATH_SAVE_BOXES} · Failures: {progress.failures} / {DEATH_SAVE_BOXES}
			</p>
			<p className="sheet__death-save-state">Damage at 0 HP adds one failure automatically. Critical hit: add one more with Failure.</p>
			<p>
				<button type="button" disabled={finished} onClick={() => writeDeathSaves(hp, { currentHp: 0, deathSaves: recordSuccesses(progress) })}>
					Success
				</button>{' '}
				<button type="button" disabled={finished} onClick={() => writeDeathSaves(hp, { currentHp: 0, deathSaves: recordFailures(progress) })}>
					Failure
				</button>{' '}
				<button type="button" disabled={finished} onClick={() => applyDeathSave(hp, 20)}>
					Natural 20
				</button>{' '}
				<button type="button" disabled={finished} onClick={() => applyDeathSave(hp, 1)}>
					Natural 1
				</button>
			</p>
			{state === 'rolling' && (
				<p className="sheet__death-save-state">
					Dying at 0 hit points. Roll from the HP card, or record a physical roll here. Three successes stabilize; three failures kill. Any healing brings the
					character back up.
				</p>
			)}
			{state === 'stabilized' && (
				<p className="sheet__death-save-state">Stabilized — still at 0 hit points and unconscious. Only healing brings this character back up.</p>
			)}
			{state === 'dead' && <p className="sheet__death-save-state">This character has died.</p>}
		</div>
	)
}

/** The Hit Points drawer (R4c): everything the 86px card leaves out. */
export function HitPointsPanel({ deathSaveRoll, ...hp }: HitPointProps & { deathSaveRoll: string | null }): ReactNode {
	const { currentHp, maxHitPoints, maxHpOverride, temporaryHitPoints, deathSaves, onEditHitPoints } = hp
	const temporary = temporaryHitPoints ?? 0
	/** What the death saves are worth on a write that does not touch the current hit points (D111). */
	const carriedDeathSaves = deathSavesAfterHitPointChange(currentHp, deathSaves)
	const blocked = healBlockedReason(hp)
	return (
		<>
			<DrawerSection title="Hit points">
				<p className="drawer__value">
					{hpText(currentHp)} / {hpText(knownMax(maxHitPoints) ?? undefined)}
					{temporary > 0 && ` + ${temporary} temporary`}
				</p>
				<div className="sheet__max-hit-points">
					{maxHitPoints.status === 'unknown' ? <UnresolvedValue reason={maxHitPoints.reason} /> : <ValueBreakdown breakdown={maxHitPoints.breakdown} open />}
				</div>
				{onEditHitPoints && (
					<>
						<p className="sheet__hp-fields">
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
						<GainTemporaryHitPoints {...hp} />
						{blocked && <p className="sheet__damage-healing-note">{blocked}</p>}
					</>
				)}
			</DrawerSection>
			{currentHp === 0 && onEditHitPoints && (
				<DrawerSection title="Death saving throws">
					<DeathSaveRecord {...hp} />
				</DrawerSection>
			)}
			{/* Outside the death save section: a natural 20 removes it, and the number rolled must still be readable (D117). */}
			{deathSaveRoll !== null && (
				<p className="sheet__death-save-roll" role="status">
					{deathSaveRoll}
				</p>
			)}
		</>
	)
}
