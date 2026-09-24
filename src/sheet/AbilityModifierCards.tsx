import type { ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { AbilityScoreValue } from '../calculation/abilityScores'
import type { Calculated } from '../calculation/types'
import { RollButton } from '../dice/RollButton'
import type { RollReport } from '../dice/RollHistory'
import { formatModifier } from './calculatedValue'

/**
 * R3b restores the ability-check roll R3 dropped (D155). R4b (D166): the
 * modifier itself is that roll's button. R4 gives
 * the score breakdown back too (D146): the name is the button that opens it in
 * the shared drawer.
 */
export function AbilityModifierCards({
	abilityScores,
	labels,
	onRoll,
	onOpenBreakdown,
}: {
	abilityScores: Record<Ability, Calculated<AbilityScoreValue>>
	labels: Record<Ability, string>
	onRoll?: (report: RollReport) => void
	/** Absent leaves the name plain text — the card renders without a drawer to open. */
	onOpenBreakdown?: (ability: Ability) => void
}): ReactNode {
	return (
		<ul className="ability-cards">
			{ABILITIES.map((ability) => {
				const result = abilityScores[ability]
				return (
					<li key={ability} className="ability-card" data-ability={ability}>
						{onOpenBreakdown ? (
							<button
								type="button"
								className="ability-card__name ability-card__name-button"
								title={labels[ability]}
								aria-label={`${labels[ability]} score breakdown`}
								onClick={() => onOpenBreakdown(ability)}
							>
								{labels[ability].slice(0, 3).toUpperCase()}
							</button>
						) : (
							<span className="ability-card__name" title={labels[ability]}>
								{labels[ability].slice(0, 3).toUpperCase()}
							</span>
						)}
						{/* D43: an unresolved score is a dash with its reason on hover, never a number. */}
						<span className="ability-card__modifier" title={result.status === 'unknown' ? result.reason : undefined}>
							{result.status === 'known' ? (
								<RollButton modifier={result.value.modifier} label={`${labels[ability]} check`} onRoll={onRoll}>
									{formatModifier(result.value.modifier)}
								</RollButton>
							) : (
								'—'
							)}
						</span>
						<span className="ability-card__score">{result.status === 'known' ? result.value.score : '—'}</span>
					</li>
				)
			})}
		</ul>
	)
}
