import { ARTIFICER_SUBCLASS_TOOLS } from '../toolProficiencies/classToolChoices'
import type { Character } from '../storage/character'
import type { ProficiencySource } from './proficiencies'
import type { WeaponProficiencyGrant } from '../weapons/weaponProficiency'

export interface FeatureGrant {
	className: string
	source: ProficiencySource
	applies: (character: Character, parsedClasses: unknown) => boolean
	armor: string[]
	/** D178: the one source of feature-granted weapon proficiency, read by the Proficiencies card and by attacks. */
	weapons: WeaponProficiencyGrant[]
	tools?: string[]
	languages?: string[]
	/** D176: a weapon choice with no picker yet, shown as one pending row. It grants nothing to attacks. */
	pendingWeapons?: string
}

const MARTIAL: WeaponProficiencyGrant = { kind: 'category', category: 'martial' }
const MARTIAL_RANGED: WeaponProficiencyGrant = { kind: 'category', category: 'martial', ranged: true }
const SCIMITAR: WeaponProficiencyGrant = { kind: 'named', name: 'Scimitar' }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The stored subclass name resolved to the source of its offered classes.json entry (storage keeps no source). */
function subclassSourceOf(parsedClasses: unknown, cls: Character['classes'][number]): string | null {
	if (!Array.isArray(parsedClasses)) return null
	const entry = parsedClasses.find(
		(candidate) =>
			isRecord(candidate) &&
			candidate['entryType'] === 'subclass' &&
			candidate['className'] === cls.className &&
			candidate['classSource'] === cls.classSource &&
			candidate['name'] === cls.subclass &&
			!candidate['reprintedAs'],
	)
	return isRecord(entry) && typeof entry['source'] === 'string' ? entry['source'] : null
}

// D176: every non-XPHB grant arrives at class level 3, whatever level the 2014 feature entry carries (DATA.md).
function subclassGrant(className: string, subclass: string, subclassSource: string, grants: Partial<FeatureGrant>, classSource = 'XPHB'): FeatureGrant {
	return {
		className,
		source: { kind: 'subclass', name: subclass },
		applies: (character, parsedClasses) =>
			character.classes.some(
				(cls) => cls.className === className && cls.classSource === classSource && cls.subclass === subclass && cls.level >= 3 && subclassSourceOf(parsedClasses, cls) === subclassSource,
			),
		armor: [],
		weapons: [],
		...grants,
	}
}

function hasSubclass(character: Character, className: string, subclass: string, level: number): boolean {
	return character.classes.some((cls) => cls.className === className && cls.classSource === 'XPHB' && cls.subclass === subclass && cls.level >= level)
}

function hasChoice(character: Character, className: string, featureName: string, optionName: string): boolean {
	return (character.classFeatureChoices ?? []).some(
		(choice) => choice.className === className && choice.classSource === 'XPHB' && choice.featureName === featureName && choice.optionName === optionName,
	)
}

// D170: XPHB class/subclass grants exist only in feature text (DATA.md), so they are a hand table. D176 adds the non-XPHB subclasses, keyed by name AND source.
export const FEATURE_GRANTS: FeatureGrant[] = [
	{
		className: 'Cleric',
		source: { kind: 'classFeatureChoice', name: 'Cleric — Protector' },
		applies: (character) => hasChoice(character, 'Cleric', 'Divine Order', 'Protector'),
		armor: ['heavy'],
		weapons: [MARTIAL],
	},
	{
		className: 'Druid',
		source: { kind: 'classFeatureChoice', name: 'Druid — Warden' },
		applies: (character) => hasChoice(character, 'Druid', 'Primal Order', 'Warden'),
		armor: ['medium'],
		weapons: [MARTIAL],
	},
	{
		className: 'Bard',
		source: { kind: 'subclass', name: 'College of Valor' },
		applies: (character) => hasSubclass(character, 'Bard', 'College of Valor', 3),
		armor: ['medium', 'shield'],
		weapons: [MARTIAL],
	},
	{
		className: 'Monk',
		source: { kind: 'subclass', name: 'Warrior of Mercy' },
		applies: (character) => hasSubclass(character, 'Monk', 'Warrior of Mercy', 3),
		armor: [],
		weapons: [],
		tools: ['herbalism kit'],
	},
	subclassGrant('Artificer', 'Alchemist', 'EFA', { tools: ARTIFICER_SUBCLASS_TOOLS['Alchemist'] }, 'EFA'),
	subclassGrant('Artificer', 'Armorer', 'EFA', { armor: ['heavy'], tools: ARTIFICER_SUBCLASS_TOOLS['Armorer'] }, 'EFA'),
	subclassGrant('Artificer', 'Artillerist', 'EFA', { weapons: [MARTIAL_RANGED], tools: ARTIFICER_SUBCLASS_TOOLS['Artillerist'] }, 'EFA'),
	subclassGrant('Artificer', 'Battle Smith', 'EFA', { weapons: [MARTIAL], tools: ARTIFICER_SUBCLASS_TOOLS['Battle Smith'] }, 'EFA'),
	subclassGrant('Artificer', 'Cartographer', 'EFA', { tools: ARTIFICER_SUBCLASS_TOOLS['Cartographer'] }, 'EFA'),
	subclassGrant('Bard', 'College of Swords', 'XGE', { armor: ['medium'], weapons: [SCIMITAR] }),
	subclassGrant('Cleric', 'Forge Domain', 'XGE', { armor: ['heavy'], tools: ["Smith's Tools"] }),
	subclassGrant('Cleric', 'Order Domain', 'TCE', { armor: ['heavy'] }),
	subclassGrant('Cleric', 'Twilight Domain', 'TCE', { armor: ['heavy'], weapons: [MARTIAL] }),
	subclassGrant('Druid', 'Circle of the Shepherd', 'XGE', { languages: ['Sylvan'] }),
	subclassGrant('Fighter', 'Rune Knight', 'TCE', { tools: ["Smith's Tools"], languages: ['Giant'] }),
	subclassGrant('Monk', 'Way of the Drunken Master', 'XGE', { tools: ["Brewer's Supplies"] }),
	subclassGrant('Monk', 'Way of the Kensei', 'XGE', { pendingWeapons: 'Kensei weapons' }),
	subclassGrant('Rogue', 'Mastermind', 'XGE', { tools: ['Disguise Kit', 'Forgery Kit'] }),
	subclassGrant('Sorcerer', 'Storm Sorcery', 'XGE', { languages: ['Primordial'] }),
	subclassGrant('Warlock', 'The Hexblade', 'XGE', { armor: ['medium', 'shield'], weapons: [MARTIAL] }),
]

/** The weapon grants of every feature the character currently has (D178). */
export function featureWeaponGrantsFor(character: Character, parsedClasses: unknown): WeaponProficiencyGrant[] {
	return FEATURE_GRANTS.filter((grant) => grant.applies(character, parsedClasses)).flatMap((grant) => grant.weapons)
}
