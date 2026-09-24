import type { Character, CharacterClass, CharacterLanguage, CharacterSubclassSkill, FeatureLanguageSource, SubclassSkillSource } from '../storage/character'

export interface SubclassSkillGrant {
	className: string
	subclass: string
	/** Class level the grant arrives at: 3 for every entry, whatever level the 2014 feature carries (D176). */
	level: number
	fixed?: readonly string[]
	/** Scout's Survivalist doubles the proficiency bonus for its fixed skills. */
	expertise?: true
	/** One pick from `from`; with `orLanguage`, a language instead (Cavalier, Samurai). */
	choice?: { grantedBy: SubclassSkillSource; from: readonly string[]; orLanguage?: FeatureLanguageSource }
}

type ClassRef = Pick<CharacterClass, 'className' | 'classSource' | 'level' | 'subclass'>

// "from the skills available to Fighters at level 1" — XPHB Fighter's startingProficiencies.skills (DATA.md).
const FIGHTER_SKILLS = ['acrobatics', 'animal handling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival']

// D177: prose only (DATA.md). XPHB class, keyed by subclass name, which no two offered subclasses of a class share.
export const SUBCLASS_SKILL_GRANTS: readonly SubclassSkillGrant[] = [
	{ className: 'Monk', subclass: 'Way of the Drunken Master', level: 3, fixed: ['performance'] },
	{ className: 'Rogue', subclass: 'Scout', level: 3, fixed: ['nature', 'survival'], expertise: true },
	{ className: 'Monk', subclass: 'Warrior of Mercy', level: 3, fixed: ['insight', 'medicine'] },
	{ className: 'Fighter', subclass: 'Battle Master', level: 3, choice: { grantedBy: 'battleMaster', from: FIGHTER_SKILLS } },
	{ className: 'Cleric', subclass: 'Order Domain', level: 3, choice: { grantedBy: 'orderDomain', from: ['intimidation', 'persuasion'] } },
	{ className: 'Cleric', subclass: 'Peace Domain', level: 3, choice: { grantedBy: 'peaceDomain', from: ['insight', 'performance', 'persuasion'] } },
	{ className: 'Fighter', subclass: 'Arcane Archer', level: 3, choice: { grantedBy: 'arcaneArcher', from: ['arcana', 'nature'] } },
	{
		className: 'Fighter',
		subclass: 'Cavalier',
		level: 3,
		choice: { grantedBy: 'cavalier', from: ['animal handling', 'history', 'insight', 'performance', 'persuasion'], orLanguage: 'cavalier' },
	},
	{ className: 'Fighter', subclass: 'Samurai', level: 3, choice: { grantedBy: 'samurai', from: ['history', 'insight', 'performance', 'persuasion'], orLanguage: 'samurai' } },
]

export const SUBCLASS_LANGUAGE_SOURCES: ReadonlySet<string> = new Set(SUBCLASS_SKILL_GRANTS.flatMap((grant) => (grant.choice?.orLanguage ? [grant.choice.orLanguage] : [])))

export function subclassSkillGrantsFor(classes: readonly ClassRef[]): SubclassSkillGrant[] {
	return SUBCLASS_SKILL_GRANTS.filter((grant) =>
		classes.some((cls) => cls.className === grant.className && cls.classSource === 'XPHB' && cls.subclass === grant.subclass && cls.level >= grant.level),
	)
}

/** Whether a choice grant is filled: a stored skill, or for a skill-or-language grant a stored language. */
export function isSubclassSkillChoiceMade(grant: SubclassSkillGrant, skills: readonly CharacterSubclassSkill[], languages: readonly CharacterLanguage[]): boolean {
	const choice = grant.choice
	if (!choice) return true
	return skills.some((pick) => pick.grantedBy === choice.grantedBy) || (choice.orLanguage !== undefined && languages.some((language) => language.grantedBy === choice.orLanguage))
}

/** The subclasses whose fixed grant or stored pick gives `skill`. */
export function subclassSkillSourceNames(skill: string, character: Character): string[] {
	return subclassSkillGrantsFor(character.classes)
		.filter((grant) => grant.fixed?.includes(skill) || (grant.choice && (character.subclassSkills ?? []).some((pick) => pick.grantedBy === grant.choice?.grantedBy && pick.name === skill)))
		.map((grant) => grant.subclass)
}

/** Skills a subclass gives expertise in outright (Scout) — never offered by an expertise picker. */
export function subclassExpertiseSkills(classes: readonly ClassRef[]): string[] {
	return subclassSkillGrantsFor(classes).flatMap((grant) => (grant.expertise ? (grant.fixed ?? []) : []))
}

/** Stored picks whose grant no longer applies (class, subclass or level changed) are dropped. */
export function keepHeldSubclassSkills(skills: readonly CharacterSubclassSkill[], grants: readonly SubclassSkillGrant[]): CharacterSubclassSkill[] {
	const held = new Set(grants.flatMap((grant) => (grant.choice ? [grant.choice.grantedBy] : [])))
	return skills.filter((pick) => held.has(pick.grantedBy))
}

/** The same for a skill-or-language grant's language. */
export function keepHeldSubclassLanguages(languages: readonly CharacterLanguage[], grants: readonly SubclassSkillGrant[]): CharacterLanguage[] {
	const held = new Set<string>(grants.flatMap((grant) => (grant.choice?.orLanguage ? [grant.choice.orLanguage] : [])))
	return languages.filter((language) => held.has(language.grantedBy))
}
