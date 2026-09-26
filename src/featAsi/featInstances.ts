import { parseOriginFeat } from '../backgrounds/backgroundData'
import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character, CharacterBackground, FeatChoiceDetails, GrantedFeatOrigin } from '../storage/character'

export interface FeatRef {
	name: string
	source: string
}

export type FeatInstanceKey = `asi:${number}` | 'background' | 'species'

export type FeatInstanceOrigin = 'asi' | GrantedFeatOrigin

/** One feat the character has, whatever granted it (D156). */
export interface FeatInstance extends FeatChoiceDetails {
	key: FeatInstanceKey
	origin: FeatInstanceOrigin
	name: string
	source: string
	/** The ASI level that paid for the feat; absent for a granted feat. */
	level?: number
}

/** Where the feat came from, as the sheet labels it: "Background", "Species" or "level 4". */
export function featOriginLabel(instance: Pick<FeatInstance, 'origin' | 'level'>): string {
	if (instance.origin === 'background') return 'Background'
	if (instance.origin === 'species') return 'Species'
	return `level ${instance.level}`
}

/** One background's origin feat, named the way feats.json names it. */
export interface BackgroundOriginFeatLink {
	background: FeatRef
	feat: FeatRef
}

function sameRef(a: FeatRef, b: FeatRef): boolean {
	return a.name === b.name && a.source === b.source
}

function choiceDetails(details: FeatChoiceDetails): FeatChoiceDetails {
	return {
		...(details.chosenAbility !== undefined ? { chosenAbility: details.chosenAbility } : {}),
		...(details.magicInitiate !== undefined ? { magicInitiate: details.magicInitiate } : {}),
		...(details.filterChoiceSpells !== undefined ? { filterChoiceSpells: details.filterChoiceSpells } : {}),
		...(details.proficiencies !== undefined ? { proficiencies: details.proficiencies } : {}),
	}
}

/**
 * Every feat the character has (D156). The background's origin feat is derived
 * from the background, never read from storage; a stored 'background' entry only
 * contributes its sub-choices, and only while it names that same feat.
 * 'species' entries are not read until the wizard can set them (D157).
 */
export function featInstances(character: Character, backgroundOriginFeat: FeatRef | null): FeatInstance[] {
	const instances: FeatInstance[] = []

	if (backgroundOriginFeat) {
		const stored = (character.grantedFeats ?? []).find((entry) => entry.origin === 'background' && sameRef(entry, backgroundOriginFeat))
		instances.push({
			key: 'background',
			origin: 'background',
			name: backgroundOriginFeat.name,
			source: backgroundOriginFeat.source,
			...(stored ? choiceDetails(stored) : {}),
		})
	}

	for (const choice of character.featAsiChoices ?? []) {
		if (choice.kind !== 'feat') continue
		instances.push({ key: `asi:${choice.level}`, origin: 'asi', level: choice.level, name: choice.name, source: choice.source, ...choiceDetails(choice) })
	}

	return instances
}

/**
 * Each background's origin feat, resolved against feats.json case-insensitively:
 * title-casing the background's lowercase key gives "Mark Of Making" where
 * feats.json says "Mark of Making" (DATA.md). A feat missing from feats.json
 * keeps the background's own spelling, so readers can still name it.
 */
export function backgroundOriginFeatLinks(parsedBackgrounds: unknown, parsedFeats: unknown): BackgroundOriginFeatLink[] {
	if (!Array.isArray(parsedBackgrounds)) throw new Error('backgrounds.json: expected a top-level array.')
	if (!Array.isArray(parsedFeats)) throw new Error('feats.json: expected a top-level array.')

	const featsByKey = new Map<string, FeatRef>()
	for (const feat of parsedFeats) {
		if (typeof feat?.name !== 'string' || typeof feat?.source !== 'string') continue
		featsByKey.set(`${feat.name}|${feat.source}`.toLowerCase(), { name: feat.name, source: feat.source })
	}

	const links: BackgroundOriginFeatLink[] = []
	for (const background of parsedBackgrounds) {
		if (typeof background?.name !== 'string' || typeof background?.source !== 'string') continue
		const parsed = parseOriginFeat(background.feats)
		if (!parsed) continue
		links.push({
			background: { name: background.name, source: background.source },
			feat: featsByKey.get(`${parsed.name}|${parsed.source}`.toLowerCase()) ?? parsed,
		})
	}
	return links
}

export function backgroundOriginFeatFrom(links: readonly BackgroundOriginFeatLink[], background: Pick<CharacterBackground, 'name' | 'source'> | undefined | null): FeatRef | null {
	if (!background) return null
	return links.find((link) => sameRef(link.background, background))?.feat ?? null
}

export async function loadBackgroundOriginFeatLinks(): Promise<BackgroundOriginFeatLink[]> {
	const [parsedBackgrounds, parsedFeats] = await Promise.all([loadDataFile('data/backgrounds.json'), loadDataFile('data/feats.json')])
	return backgroundOriginFeatLinks(parsedBackgrounds, parsedFeats)
}

export async function loadBackgroundOriginFeat(background: Pick<CharacterBackground, 'name' | 'source'> | undefined | null): Promise<FeatRef | null> {
	if (!background) return null
	return backgroundOriginFeatFrom(await loadBackgroundOriginFeatLinks(), background)
}

export async function loadFeatInstances(character: Character): Promise<FeatInstance[]> {
	return featInstances(character, await loadBackgroundOriginFeat(character.background))
}
