import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import { featAbilityScoreContributions, type FeatEffectEntry } from '../calculation/featEffects'
import { isCompleteFeatAsiChoice } from '../creation/wizardState'
import { missingFeatSubChoices } from '../sheet/featSubChoices'
import type { FeatAsiChoice } from '../storage/character'
import { isValidAbilityIncrease, unmetPrerequisiteText, type FeatAsiGrantKind, type FeatEntry, type FeatOffer } from './featAsiData'

const MISSING_LABEL: Record<string, string> = { college: 'a college', ability: 'an ability' }

/** W16/W17: "Level 4 — Athlete (+1 DEX)", "Level 8 — Ability Score Improvement (+2 STR)", "Level 19 (Epic Boon) — Skilled". */
export function featAsiCardTitle(level: number, choice: FeatAsiChoice | undefined, feats: readonly FeatEntry[], grantKind: FeatAsiGrantKind = 'asi'): string {
	const heading = `Level ${level}${grantKind === 'epicBoon' ? ' (Epic Boon)' : ''} — `
	if (!choice || (choice.kind === 'feat' && choice.name === '')) return `${heading}Choose a feat or ASI`
	// loadFeats keeps each feats.json object whole, so it carries the ability fields the calculation layer reads.
	const draft = { id: '', name: '', classes: [], featAsiChoices: [choice] }
	const bonus = ABILITIES.flatMap((ability) => {
		const amount = featAbilityScoreContributions(ability, draft, feats as unknown as FeatEffectEntry[]).reduce((sum, contribution) => sum + contribution.amount, 0)
		return amount > 0 ? [`+${amount} ${ABILITY_ABBREVIATIONS[ability].toUpperCase()}`] : []
	})
	const name = choice.kind === 'asi' ? 'Ability Score Improvement' : choice.name
	return `${heading}${name}${bonus.length > 0 ? ` (${bonus.join(', ')})` : ''}`
}

/** What the card still asks for; empty when the choice is complete. Completeness is the Next gate's own rule (isCompleteFeatAsiChoice); proficiency picks D179 lets wait are listed too. */
export function featAsiMissing(choice: FeatAsiChoice | undefined, feats: readonly FeatEntry[], featsRequiringAbilityChoice: ReadonlySet<string>, characterLevel: number): string[] {
	if (!choice || (choice.kind === 'feat' && choice.name === '')) return ['a feat or Ability Score Improvement']
	if (choice.kind === 'asi') return isValidAbilityIncrease(choice.increases) ? [] : ['the abilities to increase']
	// loadFeats keeps each feats.json object whole, so it carries the proficiency fields missingFeatSubChoices reads.
	const missing = missingFeatSubChoices({ ...choice, key: `asi:${choice.level}`, origin: 'asi' }, feats as unknown as FeatEffectEntry[]).map((item) => MISSING_LABEL[item] ?? item)
	if (missing.length === 0 && !isCompleteFeatAsiChoice(choice, featsRequiringAbilityChoice, characterLevel)) missing.push('spells')
	return missing
}

/** W18: "Name · Book", with why it cannot be taken: "(needs STR 13)", "(already taken)". */
export function featOptionLabel({ feat, result, held }: FeatOffer): string {
	const label = `${feat.name} · ${feat.source}`
	if (held) return `${label} (already taken)`
	if (result.eligible) return label
	return `${label} (${unmetPrerequisiteText(result)})`
}

/** W16/W17: one ASI level. Opens when something is missing on entering the step, and whenever its choice becomes invalid (D254); otherwise only the player toggles it. */
export function FeatAsiLevelCard({
	level,
	title,
	initiallyOpen,
	flagged = false,
	locked,
	children,
}: {
	level: number
	title: string
	initiallyOpen: boolean
	flagged?: boolean
	locked: boolean
	children: ReactNode
}): ReactNode {
	const [open, setOpen] = useState(initiallyOpen)
	useEffect(() => {
		if (flagged) setOpen(true)
	}, [flagged])
	return (
		<section className="feat-asi-card" role="group" aria-label={`Level ${level}`}>
			<button type="button" className="feat-asi-card__header" aria-expanded={open} onClick={() => setOpen(!open)}>
				<span className="feat-asi-card__toggle" aria-hidden="true">
					{open ? '▾' : '▸'}
				</span>
				<span>
					{title}
					{locked && ' (chosen at an earlier level)'}
				</span>
			</button>
			{open && (
				<fieldset className="feat-asi-card__body" disabled={locked}>
					{/* Without the level: the card itself is the group named "Level N", and specs find it by that name. */}
					<legend className="feat-asi-card__legend">Feat or ASI choice</legend>
					{children}
				</fieldset>
			)}
		</section>
	)
}
