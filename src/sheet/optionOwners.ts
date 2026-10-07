import { loadDataFile } from '../dataLoader/dataLoader'
import { classOptionalFeatureGrantsFor, type OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'
import { loadSubclassesFor } from '../subclass/subclassData'
import type { CharacterClass, CharacterFightingStyle } from '../storage/character'
import { matchesPick } from '../storage/choiceMatch'

/** Stored picks carry only a featureType; this says which held class (and subclass) offers it (F-10, finding 7). */
export interface OptionOwner {
	featureType: string
	className: string
	/** Set when the subclass's own progression offers the type; the label then names the subclass. */
	subclass: string | null
}

export async function loadOptionOwners(classes: readonly CharacterClass[]): Promise<OptionOwner[]> {
	const parsedClasses = await loadDataFile('data/classes.json')
	const owners: OptionOwner[] = []
	for (const held of classes) {
		for (const grant of classOptionalFeatureGrantsFor(parsedClasses, held.className, held.classSource, held.level)) {
			owners.push({ featureType: grant.featureType, className: held.className, subclass: null })
		}
		if (!held.subclass) continue
		const subclass = (await loadSubclassesFor(held.className, held.classSource)).find((candidate) => candidate.name === held.subclass)
		if (subclass?.featureType) owners.push({ featureType: subclass.featureType, className: held.className, subclass: held.subclass })
	}
	return owners
}

/**
 * The label of a chosen optional feature on a multiclass sheet: the class stored on a fighting style (D328), otherwise the class
 * (or its subclass) whose progression offers the option's featureType. Null when neither can be told.
 */
export function multiclassOptionOwner(option: OptionalFeatureOption, fightingStyles: readonly CharacterFightingStyle[], owners: readonly OptionOwner[]): { className: string; label: string } | null {
	const style = fightingStyles.find((candidate) => matchesPick(candidate, option))
	if (style?.className) return { className: style.className, label: style.className }
	const owner = owners.find((candidate) => candidate.featureType === option.featureType)
	return owner ? { className: owner.className, label: owner.subclass ?? owner.className } : null
}
