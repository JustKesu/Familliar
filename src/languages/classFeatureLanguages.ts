import type { CharacterClass, CharacterLanguage, FeatureLanguageSource } from '../storage/character'

export interface ClassFeatureLanguageGrant {
	className: string
	featureName: string
	level: number
	fixed?: string
	/** D172: free picks, stored in Character.languages under `grantedBy`. */
	choice?: { count: number; grantedBy: FeatureLanguageSource }
}

// D171: XPHB class features that grant languages — prose only (DATA.md), hence a hand table.
export const CLASS_FEATURE_LANGUAGE_GRANTS: readonly ClassFeatureLanguageGrant[] = [
	{ className: 'Druid', featureName: 'Druidic', level: 1, fixed: 'Druidic' },
	{ className: 'Rogue', featureName: "Thieves' Cant", level: 1, fixed: "Thieves' Cant", choice: { count: 1, grantedBy: 'thievesCant' } },
	{ className: 'Ranger', featureName: 'Deft Explorer', level: 2, choice: { count: 2, grantedBy: 'deftExplorer' } },
]

// D172: the picks come "from the language tables in chapter 2" — Standard AND Rare (DATA.md).
export const FEATURE_LANGUAGE_TYPES: readonly string[] = ['standard', 'rare']

// D173: secret class languages are never a free pick; an already stored one stays.
const SECRET_LANGUAGES: readonly string[] = ['Druidic', "Thieves' Cant"]

/** What a slot offers: not taken elsewhere, not secret; the slot's own current pick always stays. */
export function featureLanguageOptions<T extends { name: string }>(languages: readonly T[], taken: ReadonlySet<string>, current?: string): T[] {
	return languages.filter((language) => language.name === current || (!taken.has(language.name.toLowerCase()) && !SECRET_LANGUAGES.includes(language.name)))
}

/** The grants these classes hold at their current levels. */
export function classFeatureLanguageGrantsFor(classes: readonly Pick<CharacterClass, 'className' | 'classSource' | 'level'>[]): ClassFeatureLanguageGrant[] {
	return CLASS_FEATURE_LANGUAGE_GRANTS.filter((grant) =>
		classes.some((cls) => cls.className === grant.className && cls.classSource === 'XPHB' && cls.level >= grant.level),
	)
}

/** Stored feature picks whose grant no longer applies (class changed or level lowered) are dropped. */
export function keepHeldFeatureLanguages(languages: readonly CharacterLanguage[], grants: readonly ClassFeatureLanguageGrant[]): CharacterLanguage[] {
	const held = new Set(grants.flatMap((grant) => (grant.choice ? [grant.choice.grantedBy] : [])))
	return languages.filter((language) => held.has(language.grantedBy as FeatureLanguageSource))
}
