import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	areClassOptionalFeaturesComplete,
	chosenClassOptionalFeatures,
	classOptionalFeatureGrantsFor,
	classOptionalFeatureGroupsFor,
	evaluateClassOptionalFeatureGroups,
	evaluateOptionalFeatureOptions,
	evaluateOptionalFeaturePrerequisites,
	optionsForFeatureType,
	type ClassOptionalFeatureContextBase,
	type OptionalFeatureOption,
	type OptionalFeaturePrerequisiteContext,
} from './optionalFeatureData'

// Shapes confirmed against data/classes.json and data/optional-features.json by
// scripts/investigate-class-feature-choices.js and scripts/investigate-pact-prereq.js.

// SPARSE OBJECT progression, keyed by class level — Sorcerer's real Metamagic steps.
const sorcerer = {
	entryType: 'class',
	name: 'Sorcerer',
	source: 'XPHB',
	optionalfeatureProgression: [{ name: 'Metamagic', featureType: ['MM'], progression: { 2: 2, 10: 4, 17: 6 } }],
}

// DENSE ARRAY progression, 0-indexed by (level-1) — Warlock's real Invocations Known column.
const warlockInvocations = [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12]
const warlock = {
	entryType: 'class',
	name: 'Warlock',
	source: 'XPHB',
	optionalfeatureProgression: [{ name: 'Eldritch Invocations', featureType: ['EI'], progression: warlockInvocations }],
}

const fighter = { entryType: 'class', name: 'Fighter', source: 'XPHB' }

describe('classOptionalFeatureGrantsFor — sparse object progression (Sorcerer)', () => {
	const at = (level: number) => classOptionalFeatureGrantsFor([sorcerer, warlock, fighter], 'Sorcerer', 'XPHB', level)

	it('grants nothing at level 1, before the first progression step', () => {
		expect(at(1)).toEqual([{ featureType: 'MM', count: 0, name: 'Metamagic' }])
	})

	it('reads each step and holds it until the next one', () => {
		expect(at(2)[0].count).toBe(2)
		expect(at(9)[0].count).toBe(2)
		expect(at(10)[0].count).toBe(4)
		expect(at(16)[0].count).toBe(4)
		expect(at(17)[0].count).toBe(6)
	})

	it('holds the last step at level 20', () => {
		expect(at(20)).toEqual([{ featureType: 'MM', count: 6, name: 'Metamagic' }])
	})
})

describe('classOptionalFeatureGrantsFor — dense array progression (Warlock)', () => {
	const at = (level: number) => classOptionalFeatureGrantsFor([sorcerer, warlock, fighter], 'Warlock', 'XPHB', level)

	it('reads index (level-1), not a level key — level 1 grants 1, not 0', () => {
		expect(at(1)).toEqual([{ featureType: 'EI', count: 1, name: 'Eldritch Invocations' }])
	})

	it('reads the array at several levels', () => {
		expect(at(2)[0].count).toBe(3)
		expect(at(5)[0].count).toBe(5)
		expect(at(12)[0].count).toBe(8)
	})

	it('reads level 20 as the last entry', () => {
		expect(at(20)).toEqual([{ featureType: 'EI', count: 12, name: 'Eldritch Invocations' }])
	})
})

describe('classOptionalFeatureGrantsFor — classes with no progression', () => {
	it('returns an empty array for a class that grants none', () => {
		expect(classOptionalFeatureGrantsFor([sorcerer, warlock, fighter], 'Fighter', 'XPHB', 20)).toEqual([])
	})

	it('returns an empty array for a class not present in the data', () => {
		expect(classOptionalFeatureGrantsFor([sorcerer], 'Bard', 'XPHB', 5)).toEqual([])
	})
})

// The guard that the dense-array shape is being read correctly, not a nicety:
// the count derived from `progression` must equal the class table's own
// "Invocations Known" column at EVERY level. A reader that mistook this array
// for a level-keyed object would be off by one at every level.
describe('classOptionalFeatureGrantsFor — Warlock against the real classTableGroups column', () => {
	const raw = readFileSync(join(__dirname, '..', '..', 'data', 'classes.json'), 'utf8')
	const parsed = JSON.parse(raw) as Record<string, unknown>[]

	it('agrees with the "Invocations" column for every level 1-20', () => {
		const warlockEntry = parsed.find((e) => e['entryType'] === 'class' && e['name'] === 'Warlock' && e['source'] === 'XPHB')
		expect(warlockEntry).toBeDefined()

		const groups = warlockEntry!['classTableGroups'] as { colLabels?: string[]; rows?: unknown[][] }[]
		const group = groups.find((g) => (g.colLabels ?? []).some((l) => /invocation/i.test(String(l))))
		expect(group).toBeDefined()
		const colIndex = group!.colLabels!.findIndex((l) => /invocation/i.test(String(l)))
		expect(group!.rows).toHaveLength(20)

		const fromTable: number[] = []
		const fromProgression: number[] = []
		for (let level = 1; level <= 20; level++) {
			fromTable.push(group!.rows![level - 1][colIndex] as number)
			fromProgression.push(classOptionalFeatureGrantsFor(parsed, 'Warlock', 'XPHB', level)[0].count)
		}
		expect(fromProgression).toEqual(fromTable)
	})
})

describe('optionsForFeatureType', () => {
	const optionalFeatures = [
		{ name: 'Agonizing Blast', source: 'XPHB', featureType: ['EI'], entries: [], prerequisite: [{ pact: 'Tome' }] },
		{ name: 'Quickened Spell', source: 'XPHB', featureType: ['MM'], entries: [] },
	]
	const feats = [{ name: 'Archery', source: 'XPHB', category: 'FS', entries: [], prerequisite: [{ feature: ['Fighting Style'] }] }]

	it('resolves a plain code against optional-features.json and carries the prerequisite through', () => {
		const options = optionsForFeatureType(optionalFeatures, feats, 'EI')
		expect(options.map((o) => o.name)).toEqual(['Agonizing Blast'])
		expect(options[0].prerequisite).toEqual([{ pact: 'Tome' }])
	})

	it('resolves an FS:* code against feats.json category FS (D12)', () => {
		const options = optionsForFeatureType(optionalFeatures, feats, 'FS:B')
		expect(options.map((o) => o.name)).toEqual(['Archery'])
		expect(options[0].prerequisite).toEqual([{ feature: ['Fighting Style'] }])
	})
})

// ---------------------------------------------------------------------------
// Prerequisite evaluation: one test per shape found in the data (7 shapes,
// combinations of 5 keys — scripts/investigate-class-feature-choices.js item 4).
// ---------------------------------------------------------------------------

const PACT_OPTIONS = [
	{ name: 'Pact of the Blade', source: 'XPHB' },
	{ name: 'Pact of the Chain', source: 'XPHB' },
	{ name: 'Pact of the Tome', source: 'XPHB' },
	{ name: 'Thirsting Blade', source: 'XPHB' },
]

function ctx(overrides: Partial<OptionalFeaturePrerequisiteContext> = {}): OptionalFeaturePrerequisiteContext {
	return {
		classLevels: [{ className: 'Warlock', level: 5, subclassName: null }],
		knownSpellNames: [],
		chosenOptions: [],
		availableOptions: PACT_OPTIONS,
		hasFightingStyleFeature: false,
		...overrides,
	}
}

function option(name: string, prerequisite?: OptionalFeatureOption['prerequisite']): OptionalFeatureOption {
	return { name, source: 'XPHB', entries: [], prerequisite }
}

describe('evaluateOptionalFeaturePrerequisites — shape [level]', () => {
	const ascendantStep = option('Ascendant Step', [{ level: { level: 5, class: { name: 'Warlock', source: 'XPHB' } } }])

	it('qualifies at the required class level', () => {
		expect(evaluateOptionalFeaturePrerequisites(ascendantStep, ctx())).toEqual({ eligible: true, reasons: [] })
	})

	it('does not qualify below it, and says why', () => {
		const result = evaluateOptionalFeaturePrerequisites(ascendantStep, ctx({ classLevels: [{ className: 'Warlock', level: 4 }] }))
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires Warlock level 5.'])
	})

	it('reads the CLASS level, not total character level — a Warlock 2/Fighter 3 does not qualify', () => {
		const result = evaluateOptionalFeaturePrerequisites(
			ascendantStep,
			ctx({
				classLevels: [
					{ className: 'Warlock', level: 2 },
					{ className: 'Fighter', level: 3 },
				],
			}),
		)
		expect(result.eligible).toBe(false)
	})

	it('does not qualify when the character has no level in that class at all', () => {
		const result = evaluateOptionalFeaturePrerequisites(ascendantStep, ctx({ classLevels: [{ className: 'Bard', level: 20 }] }))
		expect(result.eligible).toBe(false)
	})

	it('also checks a subclass clause when the entry carries one', () => {
		const gated = option('Gated', [{ level: { level: 3, class: { name: 'Warlock' }, subclass: { name: 'The Fiend' } } }])
		expect(evaluateOptionalFeaturePrerequisites(gated, ctx()).eligible).toBe(false)
		expect(
			evaluateOptionalFeaturePrerequisites(gated, ctx({ classLevels: [{ className: 'Warlock', level: 5, subclassName: 'The Fiend' }] }))
				.eligible,
		).toBe(true)
	})
})

describe('evaluateOptionalFeaturePrerequisites — shape [spell]', () => {
	const graspOfHadar = option('Grasp of Hadar', [{ spell: ['eldritch blast#c'] }])

	it('qualifies when the named spell is known — the "#" tag is not part of the name', () => {
		expect(evaluateOptionalFeaturePrerequisites(graspOfHadar, ctx({ knownSpellNames: ['Eldritch Blast'] })).eligible).toBe(true)
	})

	it('does not qualify without it, and names the spell', () => {
		const result = evaluateOptionalFeaturePrerequisites(graspOfHadar, ctx())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires the eldritch blast spell.'])
	})

	it('reads "hex/curse#x" as alternatives — either one satisfies it', () => {
		const maddeningHex = option('Maddening Hex', [{ spell: ['hex/curse#x'] }])
		expect(evaluateOptionalFeaturePrerequisites(maddeningHex, ctx({ knownSpellNames: ['Hex'] })).eligible).toBe(true)
		expect(evaluateOptionalFeaturePrerequisites(maddeningHex, ctx({ knownSpellNames: ['Curse'] })).eligible).toBe(true)
		expect(evaluateOptionalFeaturePrerequisites(maddeningHex, ctx({ knownSpellNames: ['Bless'] })).eligible).toBe(false)
	})
})

describe('evaluateOptionalFeaturePrerequisites — shape [level+spell]', () => {
	// The `choose` form ("a Warlock Cantrip That Deals Damage") has no structural test
	// the supplied input can answer, so it is reported unmet with its own text (decided this task).
	const agonizingBlast = option('Agonizing Blast', [
		{
			spell: [{ choose: 'level=0|class=Warlock', entry: 'a Warlock Cantrip That Deals Damage', entrySummary: 'Warlock Cantrip That Deals Damage' }],
			level: { level: 2, class: { name: 'Warlock', source: 'XPHB' } },
		},
	])

	it('stays ineligible even at the required level, and says the check cannot be made', () => {
		const result = evaluateOptionalFeaturePrerequisites(agonizingBlast, ctx())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires Warlock Cantrip That Deals Damage (this app cannot check that automatically).'])
	})

	it('ANDs both keys — below the level, the level failure is listed too', () => {
		const result = evaluateOptionalFeaturePrerequisites(agonizingBlast, ctx({ classLevels: [{ className: 'Warlock', level: 1 }] }))
		expect(result.reasons[0]).toContain('Warlock level 2')
		expect(result.reasons[0]).toContain('cannot check that automatically')
	})
})

describe('evaluateOptionalFeaturePrerequisites — shape [pact]', () => {
	const improvedPactWeapon = option('Improved Pact Weapon', [{ pact: 'Blade' }])

	it('qualifies once the matching Pact of the ... invocation is among the chosen options', () => {
		const result = evaluateOptionalFeaturePrerequisites(improvedPactWeapon, ctx({ chosenOptions: [{ name: 'Pact of the Blade', source: 'XPHB' }] }))
		expect(result).toEqual({ eligible: true, reasons: [] })
	})

	it('does not qualify without it, and names the boon', () => {
		const result = evaluateOptionalFeaturePrerequisites(improvedPactWeapon, ctx())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires the Pact of the Blade invocation.'])
	})

	it('can never qualify for "Talisman" — no such option exists in this data, said out loud rather than hidden', () => {
		const rebuke = option('Rebuke of the Talisman', [{ pact: 'Talisman' }])
		const result = evaluateOptionalFeaturePrerequisites(rebuke, ctx({ chosenOptions: PACT_OPTIONS }))
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(["Requires the Pact of the Talisman invocation, which this app's data does not offer."])
	})
})

describe('evaluateOptionalFeaturePrerequisites — shape [level+pact]', () => {
	const farScribe = option('Far Scribe', [{ level: { level: 5, class: { name: 'Warlock' } }, pact: 'Tome' }])

	it('needs both', () => {
		expect(evaluateOptionalFeaturePrerequisites(farScribe, ctx()).eligible).toBe(false)
		expect(
			evaluateOptionalFeaturePrerequisites(farScribe, ctx({ chosenOptions: [{ name: 'Pact of the Tome', source: 'XPHB' }] })).eligible,
		).toBe(true)
	})

	it('lists both unmet halves in one reason', () => {
		const result = evaluateOptionalFeaturePrerequisites(farScribe, ctx({ classLevels: [{ className: 'Warlock', level: 1 }] }))
		expect(result.reasons).toEqual(['Requires Warlock level 5, the Pact of the Tome invocation.'])
	})
})

describe('evaluateOptionalFeaturePrerequisites — shape [level+optionalfeature]', () => {
	const eldritchSmite = option('Eldritch Smite', [
		{ level: { level: 5, class: { name: 'Warlock', source: 'XPHB' } }, optionalfeature: ['pact of the blade|xphb'] },
	])

	it('qualifies when the required sibling option is among the already-chosen set', () => {
		const result = evaluateOptionalFeaturePrerequisites(eldritchSmite, ctx({ chosenOptions: [{ name: 'Pact of the Blade', source: 'XPHB' }] }))
		expect(result).toEqual({ eligible: true, reasons: [] })
	})

	it('does not qualify when the sibling is merely available but not chosen', () => {
		const result = evaluateOptionalFeaturePrerequisites(eldritchSmite, ctx())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires the pact of the blade option.'])
	})
})

describe('evaluateOptionalFeaturePrerequisites — shape [feature]', () => {
	const archery = option('Archery', [{ feature: ['Fighting Style'] }])

	it('qualifies when the character has the Fighting Style feature', () => {
		expect(evaluateOptionalFeaturePrerequisites(archery, ctx({ hasFightingStyleFeature: true })).eligible).toBe(true)
	})

	it('does not qualify otherwise', () => {
		expect(evaluateOptionalFeaturePrerequisites(archery, ctx()).reasons).toEqual(['Requires the Fighting Style feature.'])
	})
})

describe('evaluateOptionalFeaturePrerequisites — no prerequisite at all', () => {
	it('is always eligible', () => {
		expect(evaluateOptionalFeaturePrerequisites(option('Devil’s Sight'), ctx())).toEqual({ eligible: true, reasons: [] })
	})
})

describe('evaluateOptionalFeaturePrerequisites — alternatives are OR', () => {
	it('is eligible when ANY one alternative is fully met', () => {
		const either = option('Either', [{ level: { level: 12, class: { name: 'Warlock' } } }, { pact: 'Tome' }])
		const result = evaluateOptionalFeaturePrerequisites(either, ctx({ chosenOptions: [{ name: 'Pact of the Tome', source: 'XPHB' }] }))
		expect(result).toEqual({ eligible: true, reasons: [] })
	})

	it('reports every alternative when none is met', () => {
		const either = option('Either', [{ level: { level: 12, class: { name: 'Warlock' } } }, { pact: 'Tome' }])
		const result = evaluateOptionalFeaturePrerequisites(either, ctx())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toHaveLength(2)
	})
})

// The same-list dependency, in both directions, plus the removal case slice 2
// will need: the data layer must be able to say an already-chosen option no
// longer qualifies.
describe('same-list dependency', () => {
	const eldritchSmite = option('Eldritch Smite', [
		{ level: { level: 5, class: { name: 'Warlock', source: 'XPHB' } }, optionalfeature: ['pact of the blade|xphb'] },
	])
	const pactOfTheBlade = option('Pact of the Blade')

	it('is ineligible when the required sibling is not among the chosen set', () => {
		expect(evaluateOptionalFeaturePrerequisites(eldritchSmite, ctx({ chosenOptions: [] })).eligible).toBe(false)
	})

	it('is eligible when it is', () => {
		expect(evaluateOptionalFeaturePrerequisites(eldritchSmite, ctx({ chosenOptions: [pactOfTheBlade] })).eligible).toBe(true)
	})

	it('reports an ALREADY-CHOSEN option as no longer qualifying once its sibling is gone', () => {
		// The chosen set contains Eldritch Smite but NOT Pact of the Blade — the
		// removal case. What the UI does about it is slice 2's problem.
		const chosen = [{ name: 'Eldritch Smite', source: 'XPHB' }]
		const result = evaluateOptionalFeaturePrerequisites(eldritchSmite, ctx({ chosenOptions: chosen }))
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires the pact of the blade option.'])
	})
})

describe('evaluateOptionalFeatureOptions', () => {
	it('returns every option in list order, ineligible ones included with their reasons (D19)', () => {
		const options = [
			option('Pact of the Blade'),
			option('Eldritch Smite', [{ level: { level: 5, class: { name: 'Warlock' } }, optionalfeature: ['pact of the blade|xphb'] }]),
		]
		const evaluated = evaluateOptionalFeatureOptions(options, ctx())
		expect(evaluated.map((e) => e.option.name)).toEqual(['Pact of the Blade', 'Eldritch Smite'])
		expect(evaluated.map((e) => e.eligible)).toEqual([true, false])
		expect(evaluated[1].reasons).toHaveLength(1)
	})
})

// ---------------------------------------------------------------------------
// Slice 2: the `choose` form of a spell prerequisite, and the class-level
// groups the picker/wizard/sheet all read.
// ---------------------------------------------------------------------------

// The real filters, verbatim — scripts/investigate-damage-cantrip-prereq.js.
const AGONIZING_BLAST = option('Agonizing Blast', [
	{ spell: [{ choose: 'level=0|class=Warlock', entry: 'a Warlock Cantrip That Deals Damage', entrySummary: 'Warlock Cantrip That Deals Damage' }] },
])
const REPELLING_BLAST = option('Repelling Blast', [
	{
		spell: [
			{
				choose: 'level=0|class=Warlock|spell attack=m;r;o',
				entry: 'a Warlock Cantrip That Deals Damage via an Attack Roll',
				entrySummary: 'Warlock Cantrip That Deals Damage via an Attack Roll',
			},
		],
	},
])

describe('evaluateOptionalFeaturePrerequisites — shape [spell] in the `choose` form', () => {
	it('qualifies when the context names a damaging cantrip for that class', () => {
		const result = evaluateOptionalFeaturePrerequisites(AGONIZING_BLAST, ctx({ damagingCantripsByClass: { Warlock: ['Eldritch Blast'] } }))
		expect(result).toEqual({ eligible: true, reasons: [] })
	})

	it('does not qualify when the context can answer and the answer is none', () => {
		const result = evaluateOptionalFeaturePrerequisites(AGONIZING_BLAST, ctx({ damagingCantripsByClass: { Warlock: [] } }))
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires Warlock Cantrip That Deals Damage — none of your known cantrips qualifies.'])
	})

	it('falls back to slice 1 behaviour when the context cannot answer at all', () => {
		const result = evaluateOptionalFeaturePrerequisites(AGONIZING_BLAST, ctx())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires Warlock Cantrip That Deals Damage (this app cannot check that automatically).'])
	})

	it('falls back for a filter clause nothing supplied can test (Repelling Blast’s attack-roll narrowing)', () => {
		const result = evaluateOptionalFeaturePrerequisites(REPELLING_BLAST, ctx({ damagingCantripsByClass: { Warlock: ['Eldritch Blast'] } }))
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires Warlock Cantrip That Deals Damage via an Attack Roll (this app cannot check that automatically).'])
	})

	it('a class name the context does not cover falls back rather than reading another class’s cantrips', () => {
		expect(evaluateOptionalFeaturePrerequisites(AGONIZING_BLAST, ctx({ damagingCantripsByClass: { Sorcerer: ['Fire Bolt'] } })).reasons).toEqual([
			'Requires Warlock Cantrip That Deals Damage (this app cannot check that automatically).',
		])
	})
})

const INVOCATIONS: OptionalFeatureOption[] = [
	option('Pact of the Blade'),
	option('Eldritch Smite', [{ level: { level: 5, class: { name: 'Warlock', source: 'XPHB' } }, optionalfeature: ['pact of the blade|xphb'] }]),
	option('Bond of the Talisman', [{ level: { level: 12, class: { name: 'Warlock', source: 'XPHB' } }, pact: 'Talisman' }]),
	AGONIZING_BLAST,
]
const METAMAGIC: OptionalFeatureOption[] = [option('Careful Spell'), option('Distant Spell')]

const optionalFeaturesForGroups = [
	...INVOCATIONS.map((o) => ({ ...o, featureType: ['EI'] })),
	...METAMAGIC.map((o) => ({ ...o, featureType: ['MM'] })),
]

// A class carrying TWO progressions at once. No real class does; the point is
// that each group's count is enforced on its own, which one progression cannot show.
const twoProgressionClass = {
	entryType: 'class',
	name: 'Warlock',
	source: 'XPHB',
	optionalfeatureProgression: [
		{ name: 'Eldritch Invocations', featureType: ['EI'], progression: warlockInvocations },
		{ name: 'Metamagic', featureType: ['MM'], progression: { 2: 2 } },
	],
}

const groupsAt = (level: number) => classOptionalFeatureGroupsFor([twoProgressionClass], optionalFeaturesForGroups, [], 'Warlock', 'XPHB', level)

function groupContext(overrides: Partial<ClassOptionalFeatureContextBase> = {}): ClassOptionalFeatureContextBase {
	return { classLevels: [{ className: 'Warlock', level: 5, subclassName: null }], knownSpellNames: [], hasFightingStyleFeature: false, ...overrides }
}

describe('classOptionalFeatureGroupsFor', () => {
	it('returns one independently-counted group per granted featureType, each with its own options', () => {
		const groups = groupsAt(5)
		expect(groups.map((g) => [g.featureType, g.name, g.count])).toEqual([
			['EI', 'Eldritch Invocations', 5],
			['MM', 'Metamagic', 2],
		])
		expect(groups[0].options.map((o) => o.name)).toEqual(['Pact of the Blade', 'Eldritch Smite', 'Bond of the Talisman', 'Agonizing Blast'])
		expect(groups[1].options.map((o) => o.name)).toEqual(['Careful Spell', 'Distant Spell'])
	})

	it('drops a grant that is not yet worth anything at this level', () => {
		expect(groupsAt(1).map((g) => g.featureType)).toEqual(['EI'])
	})
})

describe('evaluateClassOptionalFeatureGroups', () => {
	it('counts each group separately and never lets one group’s picks satisfy another’s', () => {
		const groups = evaluateClassOptionalFeatureGroups(groupsAt(5), [{ featureType: 'MM', choices: ['Careful Spell'] }], groupContext())
		expect(groups.map((g) => g.remaining)).toEqual([5, 1])
	})

	it('a sibling pick unlocks a dependent option in the same pass (no remount)', () => {
		const before = evaluateClassOptionalFeatureGroups(groupsAt(5), [], groupContext())
		expect(before[0].evaluated.find((e) => e.option.name === 'Eldritch Smite')!.eligible).toBe(false)

		const after = evaluateClassOptionalFeatureGroups(groupsAt(5), [{ featureType: 'EI', choices: ['Pact of the Blade'] }], groupContext())
		expect(after[0].evaluated.find((e) => e.option.name === 'Eldritch Smite')!.eligible).toBe(true)
	})

	it('keeps an ineligible option in the list with its reasons, never dropping it (D19)', () => {
		const talisman = evaluateClassOptionalFeatureGroups(groupsAt(12), [], groupContext())[0].evaluated.find(
			(e) => e.option.name === 'Bond of the Talisman',
		)!
		expect(talisman.eligible).toBe(false)
		expect(talisman.reasons[0]).toContain("this app's data does not offer")
	})

	it('the removal case: a chosen option that stopped qualifying stays chosen and is reported', () => {
		const groups = evaluateClassOptionalFeatureGroups(groupsAt(5), [{ featureType: 'EI', choices: ['Eldritch Smite'] }], groupContext())
		expect(groups[0].chosen).toEqual(['Eldritch Smite'])
		expect(groups[0].invalidChosen).toEqual([{ name: 'Eldritch Smite', reasons: ['Requires the pact of the blade option.'] }])
	})
})

describe('areClassOptionalFeaturesComplete', () => {
	const fill = (count: number) => Array.from({ length: count }, (_, i) => `x${i}`)

	it('is false while any group still has picks left', () => {
		expect(areClassOptionalFeaturesComplete(evaluateClassOptionalFeatureGroups(groupsAt(5), [], groupContext()))).toBe(false)
	})

	it('is false when every count is filled but a pick is in the warning state', () => {
		const selection = [
			{ featureType: 'EI', choices: ['Eldritch Smite', ...fill(4)] },
			{ featureType: 'MM', choices: fill(2) },
		]
		expect(areClassOptionalFeaturesComplete(evaluateClassOptionalFeatureGroups(groupsAt(5), selection, groupContext()))).toBe(false)
	})

	it('is true once every count is filled and nothing is unqualified', () => {
		const selection = [
			{ featureType: 'EI', choices: ['Pact of the Blade', 'Eldritch Smite', ...fill(3)] },
			{ featureType: 'MM', choices: ['Careful Spell', 'Distant Spell'] },
		]
		expect(areClassOptionalFeaturesComplete(evaluateClassOptionalFeatureGroups(groupsAt(5), selection, groupContext()))).toBe(true)
	})
})

describe('chosenClassOptionalFeatures', () => {
	const classes = [{ className: 'Warlock', classSource: 'XPHB', level: 5 }]

	it('resolves a stored pick back to its full option entry, under the progression’s own name', () => {
		const groups = chosenClassOptionalFeatures([twoProgressionClass], optionalFeaturesForGroups, [], classes,[
			{ featureType: 'EI', choices: ['Pact of the Blade'] },
		])
		expect(groups).toHaveLength(1)
		expect(groups[0].name).toBe('Eldritch Invocations')
		expect(groups[0].options.map((o) => o.name)).toEqual(['Pact of the Blade'])
	})

	it('ignores a featureType the CLASS does not grant — that is a subclass-level pick', () => {
		const groups = chosenClassOptionalFeatures([twoProgressionClass], optionalFeaturesForGroups, [], classes,[
			{ featureType: 'MV:B', choices: ['Precision Attack'] },
		])
		expect(groups).toEqual([])
	})

	it('returns nothing for a character with no picks at all', () => {
		expect(chosenClassOptionalFeatures([twoProgressionClass], optionalFeaturesForGroups, [], classes,[])).toEqual([])
	})
})

