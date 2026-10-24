import type { CharacterClass } from '../storage/character'

export interface ClassSaveAdvantage {
	className: string
	/** Absent for a class feature. */
	subclass?: string
	level: number
	feature: string
	text: string
}

// XPHB class and subclass features, hand-copied from prose (D395).
export const CLASS_SAVE_ADVANTAGES: readonly ClassSaveAdvantage[] = [
	{ className: 'Barbarian', level: 1, feature: 'Rage', text: 'Advantage on Strength saves while raging' },
	{ className: 'Barbarian', level: 2, feature: 'Danger Sense', text: 'Advantage on Dexterity saves unless Incapacitated' },
	{ className: 'Fighter', subclass: 'Champion', level: 18, feature: 'Survivor', text: 'Advantage on Death Saving Throws' },
	{ className: 'Paladin', subclass: 'Oath of Devotion', level: 20, feature: 'Holy Nimbus', text: 'Advantage on saves forced by a Fiend or an Undead while Holy Nimbus is active' },
	{ className: 'Ranger', subclass: 'Fey Wanderer', level: 7, feature: 'Beguiling Twist', text: 'Advantage on saves to avoid or end Charmed or Frightened' },
	{ className: 'Sorcerer', subclass: 'Aberrant Sorcery', level: 6, feature: 'Psychic Defenses', text: 'Advantage on saves to avoid or end Charmed or Frightened' },
	{ className: 'Wizard', subclass: 'Abjurer', level: 14, feature: 'Spell Resistance', text: 'Advantage on saves against spells' },
]

/** "Advantage on Dexterity saves unless Incapacitated (Danger Sense)" — one line per feature the character's classes have reached. */
export function classSaveAdvantageLines(classes: readonly Pick<CharacterClass, 'className' | 'classSource' | 'level' | 'subclass'>[]): string[] {
	return CLASS_SAVE_ADVANTAGES.filter((entry) =>
		classes.some((cls) => cls.className === entry.className && cls.classSource === 'XPHB' && cls.level >= entry.level && (!entry.subclass || cls.subclass === entry.subclass)),
	).map((entry) => `${entry.text} (${entry.feature})`)
}
