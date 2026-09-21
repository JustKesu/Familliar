import { describe, expect, it } from 'vitest'
import { computeCharacterResources, resolveResourceName, resourceUsesWithinMaxima, shortRestRecovery, type CharacterResource, type ResourceFeature } from './resources'
import type { Character } from '../storage/character'

/** classes.json is only read for its table groups, so the fixtures carry nothing else. */
const CLASSES = [
	{
		entryType: 'class',
		name: 'Barbarian',
		source: 'XPHB',
		classTableGroups: [{ colLabels: ['Rages', 'Rage Damage'], rows: [[2, { type: 'bonus', value: 2 }], [2, { type: 'bonus', value: 2 }], [3, { type: 'bonus', value: 2 }], [3, { type: 'bonus', value: 2 }], [4, { type: 'bonus', value: 2 }]] }],
	},
	{
		entryType: 'class',
		name: 'Monk',
		source: 'XPHB',
		classTableGroups: [{ colLabels: ['Focus Points'], rows: [['—'], [2], [3], [4], [5]] }],
	},
	{
		entryType: 'class',
		name: 'Fighter',
		source: 'XPHB',
		classTableGroups: [{ colLabels: ['Second Wind'], rows: [[2], [2], [2], [3], [3]] }],
	},
	{
		entryType: 'subclass',
		name: 'Psi Warrior',
		shortName: 'Psi Warrior',
		className: 'Fighter',
		classSource: 'XPHB',
		subclassTableGroups: [
			{
				colLabels: ['{@tip Die Size|Psionic Energy Die Size}', '{@tip Number|Psionic Energy Die Number}'],
				rows: [[6, 4], [6, 4], [6, 4], [6, 4], [8, 6]],
			},
		],
	},
]

function character(className: string, level: number, subclass: string | null = null): Character {
	return { id: 'c1', name: 'Test', classes: [{ className, classSource: 'XPHB', subclass, level }] }
}

const RAGE: ResourceFeature = {
	name: 'Rage',
	entries: ['You can enter it as a Bonus Action. You regain one expended use when you finish a {@variantrule Short Rest|XPHB}.'],
}
const WEAPON_MASTERY: ResourceFeature = {
	name: 'Weapon Mastery',
	entries: ['You can change your choices whenever you finish a {@variantrule Long Rest|XPHB}.'],
}
const ACTION_SURGE: ResourceFeature = {
	name: 'Action Surge',
	entries: ["Once you use this feature, you can't do so again until you finish a {@variantrule Short Rest|XPHB}."],
}
const STUNNING_STRIKE: ResourceFeature = { name: 'Stunning Strike', consumes: { name: 'Focus Point', amount: 1 }, entries: [] }
const VISAGE: ResourceFeature = { name: 'Visage of the Astral Self', consumes: { name: 'Ki' }, entries: [] }
const AMBUSH: ResourceFeature = { name: 'Ambush', consumes: { name: 'Superiority Die' }, entries: [] }
const GUARDED_MIND: ResourceFeature = { name: 'Guarded Mind', consumes: { name: 'Psionic Energy Die' }, entries: [] }

describe('identifying a limited-use resource (slice 9b1)', () => {
	it('takes a pool something consumes, under the pool name rather than the spender name', () => {
		const resources = computeCharacterResources(character('Monk', 5), CLASSES, [STUNNING_STRIKE])
		expect(resources.map((resource) => resource.name)).toEqual(['Focus Point'])
	})

	it('takes a feature whose own text says its uses are expended and regained on a rest', () => {
		const resources = computeCharacterResources(character('Barbarian', 5), CLASSES, [RAGE])
		expect(resources.map((resource) => resource.name)).toEqual(['Rage'])
	})

	it('takes the once-per-rest phrasing that names no count', () => {
		const resources = computeCharacterResources(character('Fighter', 5), CLASSES, [ACTION_SURGE])
		expect(resources.map((resource) => resource.name)).toEqual(['Action Surge'])
	})

	it('leaves out a rest-tagged feature that spends nothing — the gap isActionTableFeature would not close', () => {
		expect(computeCharacterResources(character('Fighter', 5), CLASSES, [WEAPON_MASTERY])).toEqual([])
	})

	it('merges the data’s two names for the Monk pool into one resource', () => {
		const resources = computeCharacterResources(character('Monk', 5), CLASSES, [STUNNING_STRIKE, VISAGE])
		expect(resources).toHaveLength(1)
		expect(resources[0].name).toBe('Focus Point')
		expect(resources[0].dataNames).toEqual(['Focus Point', 'Ki'])
	})

	it('resolves Ki to Focus Point and leaves every other name alone', () => {
		expect(resolveResourceName('Ki')).toBe('Focus Point')
		expect(resolveResourceName('Sorcery Point')).toBe('Sorcery Point')
	})
})

describe('the maximum, from the per-level tables (slice 9b1)', () => {
	it('reads the class table column at the character’s level, and says which column it came from', () => {
		const [rage] = computeCharacterResources(character('Barbarian', 5), CLASSES, [RAGE])
		expect(rage.max).toEqual({ status: 'known', value: 4, breakdown: [{ source: 'Barbarian level 5: Rages', amount: 4 }] })
	})

	it('matches the singular pool name against the plural column label', () => {
		const [focus] = computeCharacterResources(character('Monk', 4), CLASSES, [STUNNING_STRIKE])
		expect(focus.max).toEqual({ status: 'known', value: 4, breakdown: [{ source: 'Monk level 4: Focus Points', amount: 4 }] })
	})

	it('reads a subclass table, keyed by the {@tip} tag’s second segment and the " Number" suffix', () => {
		const [psi] = computeCharacterResources(character('Fighter', 5, 'Psi Warrior'), CLASSES, [GUARDED_MIND])
		expect(psi.max).toEqual({ status: 'known', value: 6, breakdown: [{ source: 'Psi Warrior level 5: Psionic Energy Die Number', amount: 6 }] })
	})

	it('reports a pool with no column as not in the data rather than guessing (D43)', () => {
		const [superiority] = computeCharacterResources(character('Fighter', 5), CLASSES, [AMBUSH])
		expect(superiority.max.status).toBe('unknown')
		expect(superiority.max.status === 'unknown' && superiority.max.reason).toContain('not in the data')
	})

	it('reports an em-dash cell as no number at that level, naming the column', () => {
		const [focus] = computeCharacterResources(character('Monk', 1), CLASSES, [STUNNING_STRIKE])
		expect(focus.max.status).toBe('unknown')
		expect(focus.max.status === 'unknown' && focus.max.reason).toContain('Focus Points')
	})

	it('refuses a classes.json that is not an array', () => {
		expect(() => computeCharacterResources(character('Monk', 5), {}, [STUNNING_STRIKE])).toThrow(/expected a top-level array/)
	})
})

/* The data's own XPHB sentences, markup and all (scripts, implicit-single-use investigation). */
const UNCANNY_METABOLISM: ResourceFeature = {
	name: 'Uncanny Metabolism',
	entries: ["Once you use this feature, you can't use it again until you finish a {@variantrule Long Rest|XPHB}."],
}
const DIVINE_INTERVENTION: ResourceFeature = {
	name: 'Divine Intervention',
	entries: ["You can't use this feature again until you finish a {@variantrule Long Rest|XPHB}."],
}
const INTIMIDATING_PRESENCE: ResourceFeature = {
	name: 'Intimidating Presence',
	entries: [
		'When you do so, each creature of your choice in a 30-foot {@variantrule Emanation [Area of Effect]|XPHB|Emanation} originating from you must make a Wisdom saving throw ({@dc 8} plus your Strength modifier and {@variantrule Proficiency|XPHB|Proficiency Bonus}).',
		"Once you use this feature, you can't use it again until you finish a {@variantrule Long Rest|XPHB} unless you expend a use of your Rage (no action required) to restore your use of it.",
	],
}
const ACTION_SURGE_XPHB: ResourceFeature = {
	name: 'Action Surge',
	entries: [
		"Once you use this feature, you can't do so again until you finish a {@variantrule Short Rest|XPHB|Short} or {@variantrule Long Rest|XPHB}. Starting at level 17, you can use it twice before a rest but only once on a turn.",
	],
}
const EXTRA_ATTACK: ResourceFeature = {
	name: 'Extra Attack',
	entries: ['You can attack twice instead of once whenever you take the {@action Attack|XPHB} action on your turn.'],
}
const PROFICIENCY_ONLY: ResourceFeature = {
	name: 'Proficiency Only',
	entries: ["You add your {@variantrule Proficiency|XPHB|Proficiency Bonus}. You can't use it again until you finish a {@variantrule Long Rest|XPHB}."],
}

describe('one use where the text states only a recharge', () => {
	it('gives 1 to a feature that says only it can’t be used again until a rest', () => {
		for (const feature of [UNCANNY_METABOLISM, DIVINE_INTERVENTION]) {
			const [resource] = computeCharacterResources(character('Monk', 5), CLASSES, [feature])
			expect(resource.max.status === 'known' && resource.max.value).toBe(1)
		}
	})

	it('stays unknown where the text names a stat, even as a save DC', () => {
		const [presence] = computeCharacterResources(character('Barbarian', 5), CLASSES, [INTIMIDATING_PRESENCE])
		expect(presence.max.status).toBe('unknown')
	})

	it('reads a Proficiency Bonus tag by its first segment and stays unknown', () => {
		const [resource] = computeCharacterResources(character('Fighter', 5), CLASSES, [PROFICIENCY_ONLY])
		expect(resource.max.status).toBe('unknown')
	})

	it('stays unknown where the text states a count', () => {
		const [surge] = computeCharacterResources(character('Fighter', 5), CLASSES, [ACTION_SURGE_XPHB])
		expect(surge.max.status).toBe('unknown')
	})

	it('makes no resource of a feature with no rest tag', () => {
		expect(computeCharacterResources(character('Fighter', 5), CLASSES, [EXTRA_ATTACK])).toEqual([])
	})

	it('leaves a table maximum alone', () => {
		const rage: ResourceFeature = { name: 'Rage', entries: ["You can't use it again until you finish a {@variantrule Long Rest|XPHB}."] }
		const [resource] = computeCharacterResources(character('Barbarian', 5), CLASSES, [rage])
		expect(resource.max.status === 'known' && resource.max.value).toBe(4)
	})

	it('does not give a pool something else spends a single use from one feature’s wording', () => {
		const spender: ResourceFeature = { name: 'Trick', consumes: { name: 'Uncanny Metabolism' }, entries: [] }
		const [resource] = computeCharacterResources(character('Fighter', 5), CLASSES, [UNCANNY_METABOLISM, spender])
		expect(resource.max.status).toBe('unknown')
	})
})

/* Slice 9b5: the sentences are the data's own, markup and all — the amount is only in the prose, so a paraphrase would test nothing. */
const RAGE_BOTH_RESTS: ResourceFeature = {
	name: 'Rage',
	entries: [
		'You regain one expended use when you finish a {@variantrule Short Rest|XPHB}, and you regain all expended uses when you finish a {@variantrule Long Rest|XPHB}.',
	],
}
const MONKS_FOCUS: ResourceFeature = {
	name: "Monk's Focus",
	entries: [
		'When you expend a Focus Point, it is unavailable until you finish a {@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB}, at the end of which you regain all your expended points.',
	],
}
const PSIONIC_POWER: ResourceFeature = {
	name: 'Psionic Power',
	entries: [
		'You regain one of your expended Psionic Energy Dice when you finish a {@variantrule Short Rest|XPHB}, and you regain all of them when you finish a {@variantrule Long Rest|XPHB}.',
	],
}
const FAVORED_ENEMY: ResourceFeature = {
	name: 'Favored Enemy',
	entries: ['You regain all expended uses of this ability when you finish a {@variantrule Long Rest|XPHB}.'],
}
const FONT_OF_MAGIC: ResourceFeature = {
	name: 'Font of Magic',
	entries: ['You regain all expended Sorcery Points when you finish a {@variantrule Long Rest|XPHB}.'],
}
const METAMAGIC: ResourceFeature = { name: 'Quickened Spell', consumes: { name: 'Sorcery Point' }, entries: [] }
const PACT_MAGIC: ResourceFeature = {
	name: 'Pact Magic',
	entries: ['You regain all expended Pact Magic spell slots when you finish a {@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB}.'],
}

describe('what a Short Rest gives back (slice 9b5)', () => {
	it('reads one use back from the feature’s own sentence, which never repeats the resource name', () => {
		const [rage] = computeCharacterResources(character('Barbarian', 5), CLASSES, [RAGE_BOTH_RESTS])
		expect(rage.shortRest).toBe('one')
	})

	it('does not read the Long Rest half of that same sentence as a full short-rest restore', () => {
		expect(shortRestRecovery(['Rage'], [RAGE_BOTH_RESTS])).not.toBe('all')
	})

	it('reads the whole pool back from a feature not named after it, in the reversed "at the end of which" phrasing', () => {
		const [focus] = computeCharacterResources(character('Monk', 5), CLASSES, [STUNNING_STRIKE, MONKS_FOCUS])
		expect(focus.shortRest).toBe('all')
	})

	it('matches the data’s plural Dice against the singular Die the pool is consumed as', () => {
		const [psi] = computeCharacterResources(character('Fighter', 5, 'Psi Warrior'), CLASSES, [GUARDED_MIND, PSIONIC_POWER])
		expect(psi.shortRest).toBe('one')
	})

	it('gives back nothing where the text names only a Long Rest', () => {
		const [favored] = computeCharacterResources(character('Fighter', 5), CLASSES, [FAVORED_ENEMY])
		expect(favored.shortRest).toBeNull()
		const [sorcery] = computeCharacterResources(character('Fighter', 5), CLASSES, [METAMAGIC, FONT_OF_MAGIC])
		expect(sorcery.shortRest).toBeNull()
	})

	it('answers the same question for Pact Magic, which is not a resource (D11)', () => {
		expect(shortRestRecovery(['Pact Magic'], [PACT_MAGIC])).toBe('all')
		expect(shortRestRecovery(['Pact Magic'], [RAGE_BOTH_RESTS])).toBeNull()
	})
})

const STROKE_OF_LUCK: ResourceFeature = {
	name: 'Stroke of Luck',
	entries: ["Once you use this feature, you can't use it again until you finish a {@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB}."],
}
const TELEKINETIC_MOVEMENT: ResourceFeature = {
	name: 'Telekinetic Movement',
	entries: [
		"Once you take this action, you can't do so again until you finish a {@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB} unless you expend a Psionic Energy Die (no action required) to restore your use of it.",
	],
}
const ARCANE_RECOVERY: ResourceFeature = {
	name: 'Arcane Recovery',
	entries: [
		'When you finish a {@variantrule Short Rest|XPHB}, you can choose expended spell slots to recover.',
		"Once you use this feature, you can't do so again until you finish a {@variantrule Long Rest|XPHB}.",
	],
}

describe('a single use that recharges on a Short Rest too', () => {
	it('gives back the one use of a feature whose recharge sentence names a Short Rest', () => {
		for (const feature of [STROKE_OF_LUCK, TELEKINETIC_MOVEMENT]) {
			const [resource] = computeCharacterResources(character('Rogue', 20), CLASSES, [feature])
			expect(resource.max.status === 'known' && resource.max.value).toBe(1)
			expect(resource.shortRest).toBe('all')
		}
	})

	it('leaves a Long-Rest-only single use unchanged', () => {
		for (const feature of [UNCANNY_METABOLISM, DIVINE_INTERVENTION]) {
			const [resource] = computeCharacterResources(character('Monk', 5), CLASSES, [feature])
			expect(resource.shortRest).toBeNull()
		}
	})

	it('does not read a Short Rest mentioned outside the recharge sentence as a recharge', () => {
		const [resource] = computeCharacterResources(character('Wizard', 5), CLASSES, [ARCANE_RECOVERY])
		expect(resource.max.status === 'known' && resource.max.value).toBe(1)
		expect(resource.shortRest).toBeNull()
	})

	it('leaves a resource with a stated count unchanged, Action Surge included', () => {
		const [surge] = computeCharacterResources(character('Fighter', 5), CLASSES, [ACTION_SURGE_XPHB])
		expect(surge.shortRest).toBeNull()
	})
})

describe('clamping spent counts to the current maximum (slice 9b1)', () => {
	const resources: CharacterResource[] = [
		{ name: 'Rage', dataNames: ['Rage'], max: { status: 'known', value: 3, breakdown: [] }, shortRest: 'one' },
		{ name: 'Superiority Die', dataNames: ['Superiority Die'], max: { status: 'unknown', reason: 'not in the data' }, shortRest: null },
	]

	it('brings a count above the maximum down to it', () => {
		expect(resourceUsesWithinMaxima({ Rage: 4 }, resources)).toEqual({ Rage: 3 })
	})

	it('leaves a count at or below the maximum alone', () => {
		expect(resourceUsesWithinMaxima({ Rage: 2 }, resources)).toEqual({ Rage: 2 })
	})

	it('never clamps a resource whose maximum is not in the data', () => {
		expect(resourceUsesWithinMaxima({ 'Superiority Die': 9 }, resources)).toEqual({ 'Superiority Die': 9 })
	})

	it('leaves a key no resource in the list claims alone', () => {
		expect(resourceUsesWithinMaxima({ 'Sorcery Point': 5 }, resources)).toEqual({ 'Sorcery Point': 5 })
	})

	it('writes a zeroed count, and an emptied record, as absence', () => {
		expect(resourceUsesWithinMaxima({ Rage: 0 }, resources)).toBeUndefined()
		expect(resourceUsesWithinMaxima({}, resources)).toBeUndefined()
		expect(resourceUsesWithinMaxima(undefined, resources)).toBeUndefined()
	})
})
