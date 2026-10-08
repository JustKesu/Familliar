/*
 * The Features & Traits tab's groups (R6, D184): one per class, Species Traits,
 * Feats. Pure (D38) over records the sheet already loads — no second resolution.
 */

import type { ChosenClassFeatureChoice } from '../classFeatureChoices/classFeatureChoiceData'
import { featOriginLabel, type FeatInstance } from '../featAsi/featInstances'
import type { ItemInvocationOption, OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'
import { isFilterChoiceFeat, isNamedBlockFeat } from '../spells/featSpellChoiceData'
import { grantedFeatureOrigin, resourceCandidateName } from './featureActionRowData'
import type { GrantedFeature } from './grantedClassFeatures'
import type { FeatTextEntry } from './sheetData'
import type { SpeciesTrait } from './speciesTraitNames'

export interface FeatureTabOption {
	key: string
	name: string
	/** Null: nothing to expand (a feat's skill pick has no text of its own). */
	entries: unknown[] | null
	/** D43: set when a stored pick's text was not found. */
	missing?: string
}

export interface FeatureTabRow {
	key: string
	name: string
	source: string | null
	/** Null when the record's text is not in the data (D43). */
	entries: unknown[] | null
	/** The name to look the row's use boxes up under — the same candidate the Actions rows use; null for a record no resource list covers. */
	resourceName: string | null
	/** Shown under the row even while it is collapsed. */
	options: FeatureTabOption[]
	/** A feat's sub-choices not made yet (missingFeatSubChoices). */
	pending?: string[]
	/** R13b (D215): whether the Manage Feats drawer can make `pending`'s choices — false for Strixhaven Initiate/the filter-choice feats, which FeatSubChoicePicker doesn't cover. */
	pendingEditableInManageFeats?: boolean
}

export type FeatureTabGroupKind = 'class' | 'species' | 'feats'

export interface FeatureTabGroup {
	key: string
	kind: FeatureTabGroupKind
	label: string
	/** The class a 'class' group is for. */
	className?: string
	rows: FeatureTabRow[]
}

export interface FeatsTabFeat {
	instance: FeatInstance
	text: FeatTextEntry | undefined
	pending: string[]
}

export interface FeaturesTabInput {
	classes: readonly { className: string; level: number }[]
	/** One entry per character level, the class that took it (Character.levelOrder). */
	levelOrder?: readonly { className: string; classSource: string }[]
	speciesName: string | null
	granted: readonly GrantedFeature[]
	classFeatureChoices: readonly ChosenClassFeatureChoice[]
	chosenOptions: readonly OptionalFeatureOption[]
	/** R14c1 (D218): invocations custom items grant right now — their own "From items" group. */
	itemOptions?: readonly ItemInvocationOption[]
	/** Where an option no feature could be linked to came from, as its own row labels it (the Actions tab's optionOrigin). */
	optionOrigin: (option: OptionalFeatureOption) => string | null
	/** With several classes: the class an unlinked option belongs to, so its row lands in that class's group (F-10). */
	optionClassName?: (option: OptionalFeatureOption) => string | null
	speciesTraits: readonly SpeciesTrait[]
	feats: readonly FeatsTabFeat[]
	/** D336: the key a class's feature spends a resource under (resourceKeyFor); identity when absent. */
	resourceKey?: (candidate: string, className: string | null) => string
}

/**
 * Whether a feature's own text carries the 5etools filter for a featureType — how
 * Metamagic, Eldritch Invocations and Combat Superiority name their option lists
 * (`feature type=MM` into optionalfeatures), and Fighting Style its feats
 * (`category=FS`). DATA.md "Which feature grants a chosen option".
 */
export function grantsFeatureType(entries: readonly unknown[], featureType: string): boolean {
	const code = featureType.toLowerCase()
	for (const match of JSON.stringify(entries).matchAll(/\{@filter ([^}]*)\}/g)) {
		const parts = match[1].split('|').map((part) => part.trim().toLowerCase())
		const values = (key: string) => parts.filter((part) => part.startsWith(`${key}=`)).flatMap((part) => part.slice(key.length + 1).split(';'))
		if (code.startsWith('fs')) {
			if (parts[1] === 'feats' && values('category').includes('fs')) return true
		} else if (parts[1] === 'optionalfeatures' && values('feature type').includes(code)) {
			return true
		}
	}
	return false
}

export const ORIGIN_FEAT_MISSING = 'Origin feat not chosen yet — choose it in Edit Character.'

function optionItem(option: OptionalFeatureOption): FeatureTabOption {
	return { key: `${option.name}|${option.source}`, name: option.name, entries: option.entries }
}

function titleCase(text: string): string {
	return text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

/** A feat row's source text; null when it cannot be told (report). */
export function featSource(instance: Pick<FeatInstance, 'origin' | 'level' | 'itemName'>, classes: FeaturesTabInput['classes'], levelOrder?: FeaturesTabInput['levelOrder']): string | null {
	if (instance.origin === 'background') return 'From Background'
	if (instance.origin === 'species') return 'From Species'
	if (instance.origin === 'manual') return 'Added manually'
	if (instance.origin === 'item') return featOriginLabel(instance)
	// FeatAsiChoice stores the character level only; with one class that is the class level, with several levelOrder says which class took that level (F-10).
	if (classes.length === 1) return `From ${classes[0].className} ${instance.level}`
	const taken = instance.level === undefined ? undefined : levelOrder?.[instance.level - 1]
	if (!taken || instance.level === undefined) return null
	const classLevel = levelOrder!.slice(0, instance.level).filter((entry) => entry.className === taken.className && entry.classSource === taken.classSource).length
	return `From ${taken.className} ${classLevel}`
}

/** The sub-choices stored on a feat, one line each; none of them carries text of its own. */
function featSubChoiceItems(instance: FeatInstance): FeatureTabOption[] {
	const names = (list: readonly { name: string }[]) => list.map((entry) => entry.name).join(', ')
	const lines: [string, string][] = []
	if (instance.chosenAbility) lines.push(['ability', `Ability: ${titleCase(instance.chosenAbility)}`])
	if (instance.blockName) lines.push(['block', `Choice: ${instance.blockName}`])
	if (instance.magicInitiate) {
		const spells = [...instance.magicInitiate.cantrips, ...(instance.magicInitiate.spell ? [instance.magicInitiate.spell] : [])]
		lines.push(['magic-initiate', `Spells (${instance.magicInitiate.className}): ${names(spells)}`])
	}
	if (instance.filterChoiceSpells) lines.push(['filter-spells', `Spells: ${names([...instance.filterChoiceSpells.cantrips, ...instance.filterChoiceSpells.spells])}`])
	const proficiencies = instance.proficiencies
	if (proficiencies?.skills?.length) lines.push(['skills', `Skills: ${proficiencies.skills.map(titleCase).join(', ')}`])
	if (proficiencies?.tools?.length) lines.push(['tools', `Tools: ${proficiencies.tools.map(titleCase).join(', ')}`])
	if (proficiencies?.languages?.length) lines.push(['languages', `Languages: ${names(proficiencies.languages)}`])
	if (proficiencies?.expertise?.length) lines.push(['expertise', `Expertise: ${proficiencies.expertise.map(titleCase).join(', ')}`])
	return lines.filter(([, text]) => !text.endsWith(': ')).map(([key, name]) => ({ key, name, entries: null }))
}

/** A chosen option no feature could be linked to becomes its own row at the end of a class group. */
export function featuresTabGroups(input: FeaturesTabInput): FeatureTabGroup[] {
	const classGroups = input.classes.map((characterClass) => {
		const items: { level: number; row: FeatureTabRow; record?: GrantedFeature }[] = input.granted
			.filter((feature) => feature.className === characterClass.className)
			.map((feature) => ({
				level: feature.level,
				record: feature,
				row: {
					key: `feature|${feature.id}`,
					name: feature.name,
					source: grantedFeatureOrigin(feature),
					entries: feature.entries,
					resourceName: input.resourceKey ? input.resourceKey(resourceCandidateName(feature), feature.className) : resourceCandidateName(feature),
					options: [],
				},
			}))

		// D87 rule 3 keeps a D21 parent (Divine Order…) out of the granted list, so its row is built from the pick.
		const byParent = new Map<string, ChosenClassFeatureChoice[]>()
		for (const choice of input.classFeatureChoices) {
			if (choice.className !== characterClass.className) continue
			const key = `${choice.featureName}|${choice.grantedAtLevel}`
			byParent.set(key, [...(byParent.get(key) ?? []), choice])
		}
		for (const [key, picks] of byParent) {
			const { featureName, grantedAtLevel, featureEntries } = picks[0]
			items.push({
				level: grantedAtLevel,
				row: {
					key: `choice|${key}`,
					name: featureName,
					source: `${characterClass.className} ${grantedAtLevel}`,
					entries: featureEntries,
					resourceName: null,
					options: picks.map((pick) => ({
						key: pick.optionName,
						name: pick.optionName,
						entries: pick.found ? pick.entries : null,
						...(pick.found ? {} : { missing: `No text found for "${pick.optionName}" (${featureName}).` }),
					})),
				},
			})
		}

		items.sort((a, b) => a.level - b.level || a.row.name.localeCompare(b.row.name))
		return { characterClass, items }
	})

	const unlinked: OptionalFeatureOption[] = []
	for (const option of input.chosenOptions) {
		const featureType = option.featureType
		const host = featureType
			? classGroups.flatMap((group) => group.items).find((item) => item.record && grantsFeatureType(item.record.entries, featureType))
			: undefined
		if (host) host.row.options.push(optionItem(option))
		else unlinked.push(option)
	}
	// Which class an unlinked pick belongs to is not stored (D99); optionClassName resolves it from the progression, else the first group.
	for (const option of unlinked) {
		const owner = input.optionClassName?.(option)
		const group = (owner ? classGroups.find((candidate) => candidate.characterClass.className === owner) : undefined) ?? classGroups[0]
		group?.items.push({
			level: Infinity,
			row: {
				key: `option|${option.name}|${option.source}`,
				name: option.name,
				source: input.optionOrigin(option),
				entries: option.entries,
				resourceName: input.resourceKey ? input.resourceKey(resourceCandidateName(option), owner ?? null) : resourceCandidateName(option),
				options: [],
			},
		})
	}

	const groups: FeatureTabGroup[] = classGroups.map(({ characterClass, items }) => ({
		key: `class|${characterClass.className}`,
		kind: 'class',
		label: `${characterClass.className} Features`,
		className: characterClass.className,
		rows: items.map((item) => item.row),
	}))

	// Kind 'class' so the Class Features filter shows it, after the class groups (R14c1).
	if (input.itemOptions?.length) {
		groups.push({
			key: 'items',
			kind: 'class',
			label: 'From items',
			rows: input.itemOptions.map(({ option, itemNames }) => ({
				key: `item-option|${option.name}|${option.source}`,
				name: option.name,
				source: itemNames.join(', '),
				entries: option.entries,
				resourceName: resourceCandidateName(option),
				options: [],
			})),
		})
	}

	// D276: an older Human saved before the species feat existed has no 'species' entry.
	const speciesFeatMissing = !input.feats.some(({ instance }) => instance.origin === 'species')
	groups.push({
		key: 'species',
		kind: 'species',
		label: 'Species Traits',
		rows: input.speciesTraits.map((trait) => ({
			key: `trait|${trait.name}`,
			name: trait.name,
			source: input.speciesName,
			entries: trait.entries,
			resourceName: resourceCandidateName(trait),
			options: trait.grantsOriginFeat && speciesFeatMissing ? [{ key: 'origin-feat-missing', name: ORIGIN_FEAT_MISSING, entries: null }] : [],
		})),
	})

	groups.push({
		key: 'feats',
		kind: 'feats',
		label: 'Feats',
		rows: input.feats.map(({ instance, text, pending }) => ({
			key: `feat|${instance.key}`,
			name: instance.name,
			source: featSource(instance, input.classes, input.levelOrder),
			entries: text?.entries ?? null,
			resourceName: text ? resourceCandidateName(text) : null,
			options: featSubChoiceItems(instance),
			...(pending.length > 0 ? { pending, pendingEditableInManageFeats: !isNamedBlockFeat(instance) && !isFilterChoiceFeat(instance) } : {}),
		})),
	})

	return groups
}
