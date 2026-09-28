import { useState, type ReactNode } from 'react'
import { applyDamage, applyHealing, grantTemporaryHitPoints, type HitPointPools } from '../hitPoints/damageHealing'
import type { FamiliarHitPoints } from './extrasData'
import { parseAmount } from './HitPoints'
import { UnresolvedValue } from './ValueBreakdown'

export interface FamiliarHitPointFields {
	currentHp?: number
	temporaryHitPoints?: number
}

/**
 * The familiar's Hit Points drawer (R11b, D213): the character's HP card without
 * death saves. D116: the amount is local state; the character is written only by
 * a click on Heal, Damage, Temp or Resummon. `hitPoints` is null when the stat
 * block cannot be resolved (D43) — nothing is then editable.
 */
export function FamiliarHitPointsPanel({
	hitPoints,
	unresolved,
	onEdit,
}: {
	hitPoints: FamiliarHitPoints | null
	unresolved: string
	onEdit?: (hitPoints: FamiliarHitPointFields) => void
}): ReactNode {
	const [draft, setDraft] = useState('')
	if (!hitPoints) return <UnresolvedValue reason={unresolved} />

	const amount = parseAmount(draft)
	const pools: HitPointPools = { currentHp: hitPoints.current, temporaryHitPoints: hitPoints.temporary }

	function apply(next: HitPointPools): void {
		onEdit?.({ currentHp: next.currentHp, temporaryHitPoints: next.temporaryHitPoints })
		setDraft('')
	}

	const disabled = amount === null || !onEdit

	return (
		<div className="familiar-hp">
			<div className="familiar-hp__card">
				<div className="familiar-hp__controls" role="group" aria-label="Damage and healing">
					<button type="button" className="btn--heal" disabled={disabled} onClick={() => amount !== null && apply(applyHealing(pools, amount, hitPoints.max))}>
						Heal
					</button>
					<input type="number" min={1} inputMode="numeric" aria-label="Amount" value={draft} onChange={(event) => setDraft(event.target.value)} />
					<button type="button" className="btn--damage" disabled={disabled} onClick={() => amount !== null && apply(applyDamage(pools, amount))}>
						Damage
					</button>
					<button type="button" className="familiar-hp__temp-button" disabled={disabled} onClick={() => amount !== null && apply(grantTemporaryHitPoints(pools, amount))}>
						Temp
					</button>
				</div>
				<div className="familiar-hp__block">
					<h2>Hit Points</h2>
					<p className="familiar-hp__value">
						{hitPoints.current}
						<span className="familiar-hp__slash"> / </span>
						{hitPoints.max}
					</p>
				</div>
				<div className="familiar-hp__block">
					<h2>Temp</h2>
					<p className="familiar-hp__temp">{hitPoints.temporary > 0 ? hitPoints.temporary : '—'}</p>
				</div>
			</div>
			{hitPoints.current === 0 && <p className="familiar-hp__gone">At 0 HP the familiar disappears. Resummon it when you cast Find Familiar again.</p>}
			{onEdit && (
				<div className="familiar-hp__resummon">
					<button type="button" className="manage-spells__button" onClick={() => onEdit({})}>
						Resummon
					</button>
					<span className="familiar-hp__hint">Restores full HP — use when you cast Find Familiar again.</span>
				</div>
			)}
		</div>
	)
}
