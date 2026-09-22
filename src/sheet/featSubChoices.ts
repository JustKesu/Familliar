import type { FeatEffectEntry } from '../calculation/featEffects'
import type { FeatInstance } from '../featAsi/featInstances'
import { MAGIC_INITIATE_FEAT_SOURCE, MAGIC_INITIATE_FEAT_NAME } from '../featAsi/featAsiData'
import { isFilterChoiceFeat } from '../spells/featSpellChoiceData'

/** Base Magic Initiate and the three "Magic Initiate; <Class>" entries backgrounds grant share one pick shape. */
function isMagicInitiateFamily(feat: { name: string; source: string }): boolean {
	return feat.source === MAGIC_INITIATE_FEAT_SOURCE && (feat.name === MAGIC_INITIATE_FEAT_NAME || feat.name.startsWith(`${MAGIC_INITIATE_FEAT_NAME}; `))
}

/**
 * The sub-choices a feat asks for that are not stored yet (D57: shown as
 * pending, never guessed). The wizard cannot finish an ASI feat without them,
 * so in practice this names what an origin feat still waits for (D156).
 */
export function missingFeatSubChoices(instance: FeatInstance, feats: readonly FeatEffectEntry[]): string[] {
	const missing: string[] = []
	const entry = feats.find((feat) => feat.name === instance.name && feat.source === instance.source)
	const abilityEntry = entry?.ability?.[0]
	const asksForAbility = isMagicInitiateFamily(instance) || (abilityEntry !== undefined && 'choose' in abilityEntry)
	if (asksForAbility && instance.chosenAbility === undefined) missing.push('ability')
	if (isMagicInitiateFamily(instance) && instance.magicInitiate === undefined) missing.push('spells')
	if (isFilterChoiceFeat(instance) && instance.filterChoiceSpells === undefined) missing.push('spells')
	return missing
}
