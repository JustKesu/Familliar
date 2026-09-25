import { featProficiencyChoiceShape, type FeatEffectEntry } from '../calculation/featEffects'
import type { FeatInstance } from '../featAsi/featInstances'
import { isMagicInitiateFamily } from '../featAsi/featAsiData'
import { isFilterChoiceFeat } from '../spells/featSpellChoiceData'

/**
 * The sub-choices a feat asks for that are not stored yet, or not fully (D57:
 * shown as pending, never guessed). D179: proficiency picks and an origin
 * feat's spells may be left for Edit Character.
 */
export function missingFeatSubChoices(instance: FeatInstance, feats: readonly FeatEffectEntry[]): string[] {
	const missing: string[] = []
	const entry = feats.find((feat) => feat.name === instance.name && feat.source === instance.source)
	const abilityEntry = entry?.ability?.[0]
	const asksForAbility = isMagicInitiateFamily(instance) || (abilityEntry !== undefined && 'choose' in abilityEntry)
	if (asksForAbility && instance.chosenAbility === undefined) missing.push('ability')
	if (isMagicInitiateFamily(instance) && instance.magicInitiate === undefined) missing.push('spells')
	if (isFilterChoiceFeat(instance) && instance.filterChoiceSpells === undefined) missing.push('spells')

	if (entry) {
		const shape = featProficiencyChoiceShape(entry)
		const skills = instance.proficiencies?.skills?.length ?? 0
		const tools = instance.proficiencies?.tools?.length ?? 0
		if (shape.skills && skills < shape.skills.count) missing.push('skills')
		if (shape.tools && tools < shape.tools.count) missing.push('tools')
		if (skills + tools < shape.skillsOrTools) missing.push('skills or tools')
		if ((instance.proficiencies?.languages?.length ?? 0) < shape.languages) missing.push('languages')
		if ((instance.proficiencies?.expertise?.length ?? 0) < shape.expertise) missing.push('expertise')
	}

	return missing
}
