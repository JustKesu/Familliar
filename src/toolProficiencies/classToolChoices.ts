import type { CharacterClass, CharacterToolChoice, ToolChoiceSource } from '../storage/character'
import type { ToolCategory } from './toolProficiencyData'

export interface ClassToolChoiceGrant {
	className: string
	classSource: string
	/** Set for a subclass grant: held once the class is at `level` with this subclass. */
	subclass?: string
	/** Class level from which the grant is held: 1 for a class start, 3 for Battle Master. */
	level: number
	/** Named in the pending item, "3 musical instruments (Bard) — not chosen". */
	owner: string
	count: number
	/** One pick from the union of these lists. */
	categories: ToolCategory[]
	/** A named short list instead of categories (Kensei). */
	options?: string[]
	grantedBy: ToolChoiceSource
	/** Tools the same class hands out by name — a slot never offers them again even where no computed proficiencies are at hand (the wizard). */
	fixedTools?: string[]
	/** D176, EFA Artificer subclass: one pick per listed tool the character already has elsewhere, so `count` is computed by classToolGrantsFor. */
	replaces?: string[]
}

/** D176: the EFA Artificer subclasses' fixed tools — both the proficiency and what the replacement pick replaces. */
export const ARTIFICER_SUBCLASS_TOOLS: Readonly<Record<string, string[]>> = {
	Alchemist: ["Alchemist's Supplies", 'Herbalism Kit'],
	Armorer: ["Smith's Tools"],
	Artillerist: ["Woodcarver's Tools"],
	'Battle Smith': ["Smith's Tools"],
	Cartographer: ["Calligrapher's Supplies", "Cartographer's Tools"],
}

// D174: the class tool picks. XPHB Bard/Monk and EFA Artificer are structured in classes.json, Battle Master is prose only (D173).
// D176: the non-XPHB subclass picks, prose only too; keyed by name alone, which no two offered subclasses of a class share (DATA.md).
export const CLASS_TOOL_CHOICE_GRANTS: readonly ClassToolChoiceGrant[] = [
	{ className: 'Bard', classSource: 'XPHB', level: 1, owner: 'Bard', count: 3, categories: ['anyMusicalInstrument'], grantedBy: 'bard' },
	{ className: 'Monk', classSource: 'XPHB', level: 1, owner: 'Monk', count: 1, categories: ['anyArtisansTool', 'anyMusicalInstrument'], grantedBy: 'monk' },
	{ className: 'Artificer', classSource: 'EFA', level: 1, owner: 'Artificer', count: 1, categories: ['anyArtisansTool'], grantedBy: 'artificer', fixedTools: ["Thieves' Tools", "Tinker's Tools"] },
	{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3, owner: 'Battle Master', count: 1, categories: ['anyArtisansTool'], grantedBy: 'battleMaster' },
	{ className: 'Rogue', classSource: 'XPHB', subclass: 'Mastermind', level: 3, owner: 'Mastermind', count: 1, categories: ['anyGamingSet'], grantedBy: 'mastermind' },
	{ className: 'Monk', classSource: 'XPHB', subclass: 'Way of the Kensei', level: 3, owner: 'Way of the Kensei', count: 1, categories: [], options: ["Calligrapher's Supplies", "Painter's Supplies"], grantedBy: 'kensei' },
	...Object.entries(ARTIFICER_SUBCLASS_TOOLS).map(
		([subclass, tools]): ClassToolChoiceGrant => ({
			className: 'Artificer',
			classSource: 'EFA',
			subclass,
			level: 3,
			owner: subclass,
			count: 0,
			categories: ['anyArtisansTool'],
			grantedBy: 'artificerSubclass',
			fixedTools: tools,
			replaces: tools,
		}),
	),
]

/**
 * The grants the starting class holds at its current level and subclass (starting proficiencies are the first class's only, D170).
 * `heldElsewhere` names the tools the character has from other sources; it sets a `replaces` grant's count (D176).
 */
export function classToolGrantsFor(classes: readonly Pick<CharacterClass, 'className' | 'classSource' | 'level' | 'subclass'>[], heldElsewhere: readonly string[] = []): ClassToolChoiceGrant[] {
	const [start] = classes
	if (!start) return []
	const held = new Set(heldElsewhere.map((name) => name.toLowerCase()))
	return CLASS_TOOL_CHOICE_GRANTS.filter(
		(grant) => grant.className === start.className && grant.classSource === start.classSource && start.level >= grant.level && (!grant.subclass || start.subclass === grant.subclass),
	).map((grant) => (grant.replaces ? { ...grant, count: grant.replaces.filter((tool) => held.has(tool.toLowerCase())).length } : grant))
}

/** Stored picks whose grant no longer applies (class changed, subclass changed, level lowered) are dropped. */
export function keepHeldToolChoices(choices: readonly CharacterToolChoice[], grants: readonly ClassToolChoiceGrant[]): CharacterToolChoice[] {
	const held = new Set(grants.map((grant) => grant.grantedBy))
	return choices.filter((choice) => held.has(choice.grantedBy))
}

/** What a slot offers: not taken elsewhere; the slot's own current pick always stays. */
export function toolChoiceOptions(options: readonly string[], taken: ReadonlySet<string>, current?: string): string[] {
	return options.filter((name) => name === current || !taken.has(name.toLowerCase()))
}
