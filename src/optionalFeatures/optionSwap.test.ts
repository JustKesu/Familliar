import { describe, expect, it } from 'vitest'
import { evaluateClassOptionalFeatureGroups, type ClassOptionalFeatureContextBase, type ClassOptionalFeatureGroup, type OptionalFeatureOption } from './optionalFeatureData'
import {
	countedNames,
	droppedName,
	lostCopies,
	withoutOneCopy,
	familiarAfterOptionChange,
	holdsSwappableSubclassOption,
	inheritSwapStamp,
	swapBlockedBy,
	swapOut,
	swappableFightingStyle,
	swappedOut,
	undoNameSwap,
	undoSwap,
} from './optionSwap'
import type { CharacterInventoryItem, CharacterOptionalFeatureChoice } from '../storage/character'
import { describeOptionalFeatureChoicesError } from '../storage/validate'

const warlockLevel = (level: number) => ({ level, class: { name: 'Warlock', source: 'XPHB' } })
const option = (name: string, prerequisite?: OptionalFeatureOption['prerequisite']): OptionalFeatureOption => ({ name, source: 'XPHB', entries: [], prerequisite })

const group: ClassOptionalFeatureGroup = {
	featureType: 'EI',
	name: 'Eldritch Invocations',
	count: 3,
	options: [
		option('Pact of the Blade'),
		option('Pact of the Tome'),
		option('Armor of Shadows'),
		option('Thirsting Blade', [{ level: warlockLevel(5), pact: 'Blade' }]),
		option('Ascendant Step', [{ level: warlockLevel(5) }]),
	],
}
const base = (level: number): ClassOptionalFeatureContextBase => ({
	classLevels: [{ className: 'Warlock', level, subclassName: null }],
	knownSpellNames: [],
	hasFightingStyleFeature: false,
})
const tomeSpells = { optionName: 'Pact of the Tome', cantrips: [{ name: 'Guidance', source: 'XPHB' }], spells: [] }
const held: CharacterOptionalFeatureChoice[] = [
	{
		featureType: 'EI',
		choices: [{ name: 'Pact of the Blade' }, { name: 'Thirsting Blade', level: 5 }, { name: 'Pact of the Tome', level: 2 }],
		spellChoices: [tomeSpells],
	},
]

describe('D345 option swap', () => {
	it('blocks swapping out an option another held option requires, naming it', () => {
		expect(swapBlockedBy(group, held, base(6), 'Pact of the Blade')).toEqual(['Thirsting Blade'])
		expect(swapBlockedBy(group, held, base(6), 'Thirsting Blade')).toEqual([])
	})

	it('checks the replacement at the new level', () => {
		const dropped = swapOut(held, 'EI', 'Pact of the Tome')
		const eligible = (level: number) =>
			evaluateClassOptionalFeatureGroups([group], dropped, base(level))[0].evaluated.find((entry) => entry.option.name === 'Ascendant Step')!.eligible
		expect(eligible(4)).toBe(false)
		expect(eligible(5)).toBe(true)
	})

	it('drops the swapped-out option with its own spell picks, and Keep restores both', () => {
		const dropped = swapOut(held, 'EI', 'Pact of the Tome')
		expect(dropped[0].choices.map((choice) => choice.name)).toEqual(['Pact of the Blade', 'Thirsting Blade'])
		expect(dropped[0].spellChoices).toBeUndefined()
		expect(swappedOut(dropped, held, 'EI')).toEqual({ name: 'Pact of the Tome', level: 2 })
		const restored = undoSwap([{ ...dropped[0], choices: [...dropped[0].choices, { name: 'Armor of Shadows' }] }], held, 'EI', 3)
		expect(restored[0].choices.map((choice) => choice.name)).toEqual(['Pact of the Blade', 'Thirsting Blade', 'Pact of the Tome'])
		expect(restored[0].spellChoices).toEqual([tomeSpells])
	})

	it('gives the replacement the swapped-out pick\'s stamp, or none for a creation pick', () => {
		const stored = [{ name: 'Agonizing Blast' }, { name: 'Armor of Shadows', level: 3 }]
		const fromCreation = inheritSwapStamp([{ name: 'Repelling Blast' }, { name: 'Armor of Shadows', level: 3 }, { name: 'Ascendant Step' }], stored)
		expect(fromCreation.replacement).toBe('Repelling Blast')
		expect(fromCreation.choices[0]).toEqual({ name: 'Repelling Blast' })
		const fromLevel = inheritSwapStamp([{ name: 'Agonizing Blast' }, { name: 'Repelling Blast' }], stored)
		expect(fromLevel.choices[1]).toEqual({ name: 'Repelling Blast', level: 3 })
		expect(inheritSwapStamp(stored, stored).replacement).toBeNull()
	})

	it('F-20b: name-list swap for maneuvers, runes and the Fighter style', () => {
		const heldNames = ['Parry', 'Riposte', 'Trip Attack']
		expect(droppedName(heldNames, heldNames)).toBeNull()
		expect(droppedName(['Parry', 'Trip Attack', 'Feinting Attack'], heldNames)).toBe('Riposte')
		expect(undoNameSwap(['Parry', 'Trip Attack', 'Feinting Attack'], heldNames, 3)).toEqual(['Parry', 'Trip Attack', 'Riposte'])
		// A level that adds two picks keeps the two new ones beside the restored one.
		expect(undoNameSwap(['Parry', 'Trip Attack', 'A', 'B', 'C'], heldNames, 5)).toEqual(['Parry', 'Trip Attack', 'Riposte', 'A', 'B'])
		expect(undoNameSwap(['Defense'], ['Archery'], 1)).toEqual(['Archery'])
	})

	it('F-22 item 7: Keep restores the spell picks even when their optionName differs in case', () => {
		const lower = { optionName: 'pact of the tome', cantrips: [{ name: 'Guidance', source: 'XPHB' }], spells: [] }
		const stored: CharacterOptionalFeatureChoice[] = [{ ...held[0], spellChoices: [lower] }]
		const dropped = swapOut(stored, 'EI', 'Pact of the Tome')
		expect(dropped[0].spellChoices).toBeUndefined()
		const restored = undoSwap([{ ...dropped[0], choices: [...dropped[0].choices, { name: 'Armor of Shadows' }] }], stored, 'EI', 3)
		expect(restored[0].choices.map((choice) => choice.name)).toEqual(['Pact of the Blade', 'Thirsting Blade', 'Pact of the Tome'])
		expect(restored[0].spellChoices).toEqual([lower])
	})

	it('D348: swapping out Pact of the Chain takes the familiar; Keep (the boon back) or a granting item keeps it', () => {
		const imp = { name: 'Imp', source: 'XMM' }
		const chain: CharacterOptionalFeatureChoice[] = [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain' }, { name: 'Armor of Shadows', level: 2 }] }]
		const swapped = swapOut(chain, 'EI', 'Pact of the Chain')
		expect(familiarAfterOptionChange(imp, chain, swapped, undefined)).toBeUndefined()
		expect(familiarAfterOptionChange(imp, chain, undoSwap(swapped, chain, 'EI', 2), undefined)).toEqual(imp)
		const item: CharacterInventoryItem[] = [
			{ name: 'Chain Ring', source: 'custom', quantity: 1, custom: { name: 'Chain Ring', kind: 'worn', invocations: [{ name: 'Pact of the Chain', source: 'XPHB' }] } },
		]
		expect(familiarAfterOptionChange(imp, chain, swapped, item)).toEqual(imp)
		expect(familiarAfterOptionChange(imp, swapped, swapped, undefined)).toEqual(imp)
	})

	it('F-22 item 6 (D346 rule 3): only a style tagged Fighter is swappable, never the untagged pre-58 one', () => {
		const fighter = { className: 'Fighter', classSource: 'XPHB' }
		expect(swappableFightingStyle([{ name: 'Archery' }], fighter)).toBeUndefined()
		expect(swappableFightingStyle([{ name: 'Archery' }, { ...fighter, name: 'Defense' }], fighter)?.name).toBe('Defense')
		expect(swappableFightingStyle([{ className: 'Paladin', classSource: 'XPHB', name: 'Defense' }], { className: 'Paladin', classSource: 'XPHB' })).toBeUndefined()
	})

	it('F-20b: only runes and maneuvers count as held swappable subclass options', () => {
		expect(holdsSwappableSubclassOption([{ featureType: 'MV:B', choices: [{ name: 'Parry' }] }], 'MV:B')).toBe(true)
		expect(holdsSwappableSubclassOption([{ featureType: 'RN', choices: [] }], 'RN')).toBe(false)
		expect(holdsSwappableSubclassOption([{ featureType: 'AI', choices: [{ name: 'Curving Shot' }] }], 'AI')).toBe(false)
	})
})

describe('D382 repeated invocations', () => {
	const twice: CharacterOptionalFeatureChoice[] = [
		{ featureType: 'EI', choices: [{ name: 'Pact of the Blade' }, { name: 'Lessons of the First Ones', level: 2 }, { name: 'Lessons of the First Ones', level: 5 }] },
	]

	it('swaps one copy out and Keep puts that copy back', () => {
		const dropped = swapOut(twice, 'EI', 'Lessons of the First Ones')
		expect(dropped[0].choices).toEqual([{ name: 'Pact of the Blade' }, { name: 'Lessons of the First Ones', level: 2 }])
		expect(swappedOut(dropped, twice, 'EI')).toEqual({ name: 'Lessons of the First Ones', level: 5 })
		const restored = undoSwap([{ ...dropped[0], choices: [...dropped[0].choices, { name: 'Armor of Shadows' }] }], twice, 'EI', 3)
		expect(restored[0].choices).toEqual(twice[0].choices)
	})

	it('treats a second copy taken in this walk as fresh, not held', () => {
		const withThird = [{ ...twice[0], choices: [...twice[0].choices, { name: 'Lessons of the First Ones' }] }]
		expect(swappedOut(withThird, twice, 'EI')).toBeNull()
		const swapped = inheritSwapStamp([{ name: 'Pact of the Blade' }, { name: 'Lessons of the First Ones', level: 2 }, { name: 'Agonizing Blast' }], twice[0].choices)
		expect(swapped.choices[2]).toEqual({ name: 'Agonizing Blast', level: 5 })
	})

	it('counts lost and added copies per copy', () => {
		expect(lostCopies(['A', 'A', 'B'], ['A', 'B'])).toEqual(['A'])
		expect(lostCopies(['A', 'B'], ['B', 'A'])).toEqual([])
		expect(countedNames(['Lessons of the First Ones', 'Agonizing Blast', 'Lessons of the First Ones'])).toEqual(['Agonizing Blast', 'Lessons of the First Ones (x2)'])
		expect(withoutOneCopy([{ name: 'A', level: 2 }, { name: 'A' }], 'A')).toEqual([{ name: 'A', level: 2 }])
	})

	it('validate accepts the four repeatable invocations twice and refuses any other', () => {
		expect(describeOptionalFeatureChoicesError(twice)).toBeNull()
		expect(describeOptionalFeatureChoicesError([{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }, { name: 'Agonizing Blast', level: 5 }] }])).toBeNull()
		expect(describeOptionalFeatureChoicesError([{ featureType: 'EI', choices: [{ name: 'Eldritch Mind' }, { name: 'Eldritch Mind', level: 5 }] }])).toMatch(/repeats Eldritch Mind/)
	})
})
