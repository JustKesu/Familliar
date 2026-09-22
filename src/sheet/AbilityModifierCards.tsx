import type { ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { AbilityScoreValue } from '../calculation/abilityScores'
import type { Calculated } from '../calculation/types'
import { formatModifier } from './calculatedValue'

export function AbilityModifierCards({
	abilityScores,
	labels,
}: {
	abilityScores: Record<Ability, Calculated<AbilityScoreValue>>
	labels: Record<Ability, string>
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
					</li>
				)
			})}
		</ul>
	)
}
