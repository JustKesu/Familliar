import type { Character, CharacterClass, CharacterLanguage, CharacterSubclassSkill, FeatureLanguageSource, SubclassSkillSource } from '../storage/character'

export interface SubclassSkillGrant {
	className: string
	subclass: string
	/** Class level the grant arrives at: 3 for every entry, whatever level the 2014 feature carries (D176). */
	level: number
	fixed?: readonly string[]
	/** Scout's Survivalist doubles the proficiency bonus for its fixed skills. */
	expertise?: true
	/**
	 * `count` picks (default 1) from `from`; with `orLanguage`, a language instead (Cavalier, Samurai).
	 * With `expertise` the picks also get Expertise, so a skill held elsewhere is still offered (Knowledge Domain, D203).
	 */
	choice?: { grantedBy: SubclassSkillSource; from: readonly string[]; orLanguage?: FeatureLanguageSource; count?: number; expertise?: true }
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
	// D203: RHW/FRHoF, prose only too.
	{ className: 'Wizard', subclass: 'Bladesinger', level: 3, choice: { grantedBy: 'bladesinger', from: ['acrobatics', 'athletics', 'performance', 'persuasion'] } },
	{ className: 'Cleric', subclass: 'Knowledge Domain', level: 3, choice: { grantedBy: 'knowledgeDomain', from: ['arcana', 'history', 'nature', 'religion'], count: 2, expertise: true } },
	{ className: 'Fighter', subclass: 'Banneret', level: 3, choice: { grantedBy: 'banneret', from: ['insight', 'intimidation', 'performance', 'persuasion'] } },
	{ className: 'Paladin', subclass: 'Oath of the Noble Genies', level: 3, choice: { grantedBy: 'nobleGenies', from: ['acrobatics', 'intimidation', 'performance', 'persuasion'] } },
	{
		className: 'Bard',
		subclass: 'College of the Moon',
		level: 3,
		choice: { grantedBy: 'collegeOfTheMoon', from: ['animal handling', 'insight', 'medicine', 'nature', 'perception', 'survival'] },
	},
]

export function subclassSkillChoiceCount(grant: SubclassSkillGrant): number {
	return grant.choice?.count ?? 1
}

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
	return skills.filter((pick) => pick.grantedBy === choice.grantedBy).length >= subclassSkillChoiceCount(grant) || (choice.orLanguage !== undefined && languages.some((language) => language.grantedBy === choice.orLanguage))
}

/** The subclasses whose fixed grant or stored pick gives `skill`. */
export function subclassSkillSourceNames(skill: string, character: Character): string[] {
	return subclassSkillGrantsFor(character.classes)
		.filter((grant) => grant.fixed?.includes(skill) || (grant.choice && (character.subclassSkills ?? []).some((pick) => pick.grantedBy === grant.choice?.grantedBy && pick.name === skill)))
		.map((grant) => grant.subclass)
}

/** Skills a subclass gives expertise in outright (Scout) or through its own pick (Knowledge Domain) — never offered by an expertise picker. */
export function subclassExpertiseSkills(classes: readonly ClassRef[], picks: readonly CharacterSubclassSkill[] = []): string[] {
	return subclassSkillGrantsFor(classes).flatMap((grant) => [
		...(grant.expertise ? (grant.fixed ?? []) : []),
		...(grant.choice?.expertise ? picks.filter((pick) => pick.grantedBy === grant.choice?.grantedBy).map((pick) => pick.name) : []),
	])
}

/** Stored picks whose grant no longer applies (class, subclass or level changed) are dropped. */
export function keepHeldSubclassSkills(skills: readonly CharacterSubclassSkill[], grants: readonly SubclassSkillGrant[]): CharacterSubclassSkill[] {
	const held = new Set(grants.flatMap((grant) => (grant.choice ? [grant.choice.grantedBy] : [])))
	return skills.filter((pick) => held.has(pick.grantedBy))
}

/** The grantedBy keys of every subclass grant of `className`, whichever subclass — what a new subclass pick for that class invalidates (D340). */
export function classSubclassGrantSources(className: string): ReadonlySet<string> {
	return new Set(
		SUBCLASS_SKILL_GRANTS.filter((grant) => grant.className === className).flatMap((grant) =>
			grant.choice ? [grant.choice.grantedBy, ...(grant.choice.orLanguage ? [grant.choice.orLanguage] : [])] : [],
		),
	)
}

/** The same for a skill-or-language grant's language. */
export function keepHeldSubclassLanguages(languages: readonly CharacterLanguage[], grants: readonly SubclassSkillGrant[]): CharacterLanguage[] {
	const held = new Set<string>(grants.flatMap((grant) => (grant.choice?.orLanguage ? [grant.choice.orLanguage] : [])))
	return languages.filter((language) => held.has(language.grantedBy))
}
