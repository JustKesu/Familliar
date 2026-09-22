import type { ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { AbilityScoreValue } from '../calculation/abilityScores'
import type { Calculated } from '../calculation/types'
import { RollButton } from '../dice/RollButton'
import type { RollReport } from '../dice/RollHistory'
import { formatModifier } from './calculatedValue'

/**
 * R3b restores the ability-check roll R3 dropped (D155): the breakdown stays
 * out until R4 builds the shared drawer (D146), but the RollButton — same
 * wiring as the saves/skills rows use — goes back under the modifier.
 */
export function AbilityModifierCards({
	abilityScores,
	labels,
	onRoll,
}: {
	abilityScores: Record<Ability, Calculated<AbilityScoreValue>>
	labels: Record<Ability, string>
	onRoll?: (report: RollReport) => void
}): ReactNode {
	return (
		<ul className="ability-cards">
			{ABILITIES.map((ability) => {
				const result = abilityScores[ability]
				return (
					<li key={ability} className="ability-card" data-ability={ability}>
						<span className="ability-card__name" title={labels[ability]}>
							{labels[ability].slice(0, 3).toUpperCase()}
						</span>
						{/* D43: an unresolved score is a dash with its reason on hover, never a number. */}
						<span className="ability-card__modifier" title={result.status === 'unknown' ? result.reason : undefined}>
							{result.status === 'known' ? formatModifier(result.value.modifier) : '—'}
						</span>
						<span className="ability-card__score">{result.status === 'known' ? result.value.score : '—'}</span>
						{result.status === 'known' && (
							<RollButton modifier={result.value.modifier} label={`${labels[ability]} check`} onRoll={onRoll} />
						)}
					</li>
				)
			})}
		</ul>
	)
}
