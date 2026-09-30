import { useState, type ReactNode } from 'react'
import type { Ability } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { isCompleteFeatAsiChoice } from '../creation/wizardState'
import { missingFeatSubChoices } from '../sheet/featSubChoices'
import type { FeatAsiChoice } from '../storage/character'
import { featAbilityChoiceOptions, isValidAbilityIncrease, type FeatEntry, type FeatOffer } from './featAsiData'

const ABBREVIATION_BY_NAME: Record<string, string> = {
	Strength: 'STR',
	Dexterity: 'DEX',
	Constitution: 'CON',
	Intelligence: 'INT',
	Wisdom: 'WIS',
	Charisma: 'CHA',
}

const MISSING_LABEL: Record<string, string> = { college: 'a college', ability: 'an ability' }

const abbreviation = (ability: string): string => (ABILITY_ABBREVIATIONS[ability as Ability] ?? ability).toUpperCase()

const signed = (increases: Record<string, unknown>): string[] =>
	Object.entries(increases).flatMap(([ability, amount]) => (typeof amount === 'number' && amount > 0 ? [`+${amount} ${abbreviation(ability)}`] : []))

const findFeat = (feats: readonly FeatEntry[], choice: { name: string; source: string }): FeatEntry | undefined =>
	feats.find((feat) => feat.name === choice.name && feat.source === choice.source)

/** W16/W17: "Level 4 — Athlete (+1 DEX)", "Level 8 — Ability Score Improvement (+2 STR)", "Level 12 — Skilled". */
export function featAsiCardTitle(level: number, choice: FeatAsiChoice | undefined, feats: readonly FeatEntry[]): string {
	if (choice?.kind === 'asi') {
		const bonus = signed(choice.increases)
		return `Level ${level} — Ability Score Improvement${bonus.length > 0 ? ` (${bonus.join(', ')})` : ''}`
	}
	if (choice?.kind !== 'feat' || choice.name === '') return `Level ${level} — Choose a feat or ASI`
	const feat = findFeat(feats, choice)
	const fixed = (feat?.ability?.[0] ?? {}) as Record<string, unknown>
	const bonus = feat && featAbilityChoiceOptions(feat) ? (choice.chosenAbility ? [`+1 ${abbreviation(choice.chosenAbility)}`] : []) : signed(fixed)
	return `Level ${level} — ${choice.name}${bonus.length > 0 ? ` (${bonus.join(', ')})` : ''}`
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
	const reasons = result.reasons.map((reason) =>
		reason
			.replace(/^Requires /, 'needs ')
			.replace(/\.$/, '')
			.replace(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) (\d+)\+/g, (_, name: string, score: string) => `${ABBREVIATION_BY_NAME[name]} ${score}`),
	)
	return `${label} (${reasons.join('; ')})`
}

/** W16/W17: one ASI level. Opens when something is missing on entering the step; after that only the player toggles it. */
export function FeatAsiLevelCard({
	level,
	title,
	initiallyOpen,
	locked,
	children,
}: {
	level: number
	title: string
	initiallyOpen: boolean
	locked: boolean
	children: ReactNode
}): ReactNode {
	const [open, setOpen] = useState(initiallyOpen)
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
					{children}
				</fieldset>
			)}
		</section>
	)
}
