import { describe, expect, it } from 'vitest'
import { extractOptionalFeatureChosenSpells, extractOptionalFeatureGrantedSpells } from './optionalFeatureSpells'

/*
 * Fixtures mirror the real shapes scripts/investigate-optional-feature-spells.js
 * found in optional-features.json (D46), trimmed to the fields the extractor
 * reads. data/ is never opened here.
 */

const spells = [
	{ name: 'Disguise Self', source: 'XPHB', level: 1, meta: { ritual: false } },
	{ name: 'Invisibility', source: 'XPHB', level: 2, duration: [{ concentration: true }] },
	{ name: 'Speak with Dead', source: 'XPHB', level: 3 },
	{ name: 'Find Familiar', source: 'XPHB', level: 1, meta: { ritual: true } },
]

/** Mask of Many Faces' real shape: one literal ref under `innate._`, no ability field. */
const maskOfManyFaces = {
	name: 'Mask of Many Faces',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [{ innate: { _: ['disguise self|xphb'] } }],
}

/** The two options that really do grant the SAME spell — one names a source, the other does not. */
const oneWithShadows = {
	name: 'One with Shadows',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [{ innate: { _: ['invisibility|xphb'] } }],
}
const shroudOfShadow = {
	name: 'Shroud of Shadow',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [{ innate: { _: ['invisibility'] } }],
}

/** Pact of the Tome's real shape: `choose` filter objects only, no literal ref — a picker, not a derived grant. */
const pactOfTheTome = {
	name: 'Pact of the Tome',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [
		{
			ability: 'cha',
			known: { _: [{ choose: 'level=0', count: 3 }] },
			prepared: { _: [{ choose: 'level=1|components & miscellaneous=ritual', count: 2 }] },
		},
	],
}

/** Pact of the Chain — the other option that names an ability ("cha", the Warlock's own). */
const pactOfTheChain = {
	name: 'Pact of the Chain',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [{ ability: 'cha', innate: { _: ['find familiar|xphb'] } }],
}

const optionalFeatures = [maskOfManyFaces, oneWithShadows, shroudOfShadow, pactOfTheTome, pactOfTheChain]

function extract(selection: { featureType: string; choices: string[] }[]) {
	return extractOptionalFeatureGrantedSpells(optionalFeatures, spells, selection)
}

describe('extractOptionalFeatureGrantedSpells', () => {
	it('resolves an `innate._` grant, carrying the option name as provenance', () => {
		expect(extract([{ featureType: 'EI', choices: ['Mask of Many Faces'] }])).toEqual([
			{
				name: 'Disguise Self',
				source: 'XPHB',
				level: 1,
				ritual: false,
				concentration: false,
				origin: 'optionalFeature',
				optionName: 'Mask of Many Faces',
				usage: { kind: 'noSlot' },
			},
		])
	})

	it('a bare grant (no will/daily/ritual/resource wrapper) is labeled `noSlot`, not silence — this consumer\'s only default (this task)', () => {
		const [disguiseSelf] = extract([{ featureType: 'EI', choices: ['Mask of Many Faces'] }])
		expect(disguiseSelf.usage).toEqual({ kind: 'noSlot' })
	})

	it('a `will`-wrapped grant is labeled `atWill`, overriding the bare default', () => {
		const willWrapped = {
			name: 'Will Wrapped Option',
			source: 'XPHB',
			featureType: ['EI'],
			additionalSpells: [{ innate: { _: { will: ['disguise self|xphb'] } } }],
		}
		const [result] = extractOptionalFeatureGrantedSpells([willWrapped], spells, [{ featureType: 'EI', choices: ['Will Wrapped Option'] }])
		expect(result.usage).toEqual({ kind: 'atWill' })
	})

	it('a `daily`-wrapped grant is labeled as one free cast per Long Rest, which is what every such source’s text says', () => {
		const dailyWrapped = {
			name: 'Daily Wrapped Option',
			source: 'XPHB',
			featureType: ['EI'],
			additionalSpells: [{ innate: { _: { daily: { '1e': ['disguise self|xphb'] } } } }],
		}
		const [result] = extractOptionalFeatureGrantedSpells([dailyWrapped], spells, [{ featureType: 'EI', choices: ['Daily Wrapped Option'] }])
		expect(result.usage).toEqual({ kind: 'onceFreePerLongRest' })
	})

	it('carries the spell’s own ritual and concentration flags rather than defaulting them', () => {
		const [familiar] = extract([{ featureType: 'EI', choices: ['Pact of the Chain'] }])
		expect(familiar.ritual).toBe(true)
		expect(familiar.concentration).toBe(false)
		const [invisibility] = extract([{ featureType: 'EI', choices: ['One with Shadows'] }])
		expect(invisibility.concentration).toBe(true)
	})

	it('two options granting the same spell BOTH come back, so the sheet can join their provenance', () => {
		const result = extract([{ featureType: 'EI', choices: ['One with Shadows', 'Shroud of Shadow'] }])
		expect(result).toHaveLength(2)
		expect(result.map((s) => s.name)).toEqual(['Invisibility', 'Invisibility'])
		expect(result.map((s) => s.optionName)).toEqual(['One with Shadows', 'Shroud of Shadow'])
		// The sourceless ref resolves to the same spell identity as the sourced one, or the merge downstream would miss.
		expect(result.map((s) => s.source)).toEqual(['XPHB', 'XPHB'])
	})

	it('a spell listed twice within ONE option is returned once', () => {
		const twice = {
			name: 'Doubled Option',
			source: 'XPHB',
			featureType: ['EI'],
			additionalSpells: [{ prepared: { _: ['invisibility|xphb'] }, innate: { _: ['invisibility|xphb'] } }],
		}
		const result = extractOptionalFeatureGrantedSpells([twice], spells, [{ featureType: 'EI', choices: ['Doubled Option'] }])
		expect(result).toHaveLength(1)
		expect(result[0].optionName).toBe('Doubled Option')
	})

	it('reads `known` and `prepared` as well as `innate`', () => {
		const mixed = {
			name: 'Mixed Keys',
			source: 'XPHB',
			featureType: ['EI'],
			additionalSpells: [{ known: { _: ['disguise self|xphb'] }, prepared: { _: ['speak with dead|xphb'] } }],
		}
		const result = extractOptionalFeatureGrantedSpells([mixed], spells, [{ featureType: 'EI', choices: ['Mixed Keys'] }])
		expect(result.map((s) => s.name).sort()).toEqual(['Disguise Self', 'Speak with Dead'])
	})

	it('a `choose` filter grant yields nothing rather than being half-applied (Pact of the Tome)', () => {
		expect(extract([{ featureType: 'EI', choices: ['Pact of the Tome'] }])).toEqual([])
	})

	it('an option chosen under a DIFFERENT featureType is not matched', () => {
		// A subclass-level pick (e.g. a Maneuver under MV:B) must never pick up an EI option's grants.
		expect(extract([{ featureType: 'MV:B', choices: ['Mask of Many Faces'] }])).toEqual([])
	})

	it('a ref that does not resolve against spells.json is skipped cleanly (D43)', () => {
		const dangling = {
			name: 'Dangling Option',
			source: 'XPHB',
			featureType: ['EI'],
			additionalSpells: [{ innate: { _: ['no such spell|xphb', 'disguise self|xphb'] } }],
		}
		const result = extractOptionalFeatureGrantedSpells([dangling], spells, [{ featureType: 'EI', choices: ['Dangling Option'] }])
		expect(result.map((s) => s.name)).toEqual(['Disguise Self'])
	})

	it('an option with no additionalSpells, an unknown option, and an empty selection all yield nothing', () => {
		const plain = { name: 'Agonizing Blast', source: 'XPHB', featureType: ['EI'] }
		expect(extractOptionalFeatureGrantedSpells([plain], spells, [{ featureType: 'EI', choices: ['Agonizing Blast'] }])).toEqual([])
		expect(extract([{ featureType: 'EI', choices: ['Not An Option'] }])).toEqual([])
		expect(extract([])).toEqual([])
	})

	it('throws a named error when either data file is not the array it must be', () => {
		expect(() => extractOptionalFeatureGrantedSpells({}, spells, [])).toThrow(/optional-features\.json/)
		expect(() => extractOptionalFeatureGrantedSpells(optionalFeatures, {}, [])).toThrow(/spells\.json/)
	})
})

/*
 * The other half: an option whose grant is a `choose` filter has no fixed spell
 * to derive, so the player's stored picks ARE the grant (Pact of the Tome).
 */
describe('extractOptionalFeatureChosenSpells', () => {
	const tomePick = {
		featureType: 'EI',
		choices: ['Pact of the Tome'],
		spellChoices: [
			{
				optionName: 'Pact of the Tome',
				cantrips: [{ name: 'Disguise Self', source: 'XPHB' }],
				spells: [{ name: 'Find Familiar', source: 'XPHB' }],
			},
		],
	}

	it('returns the stored picks with the option named, and the spell’s own detail looked up', () => {
		const result = extractOptionalFeatureChosenSpells(spells, [tomePick])
		expect(result).toHaveLength(2)
		expect(result.map((s) => s.optionName)).toEqual(['Pact of the Tome', 'Pact of the Tome'])
		expect(result.map((s) => s.name)).toEqual(['Disguise Self', 'Find Familiar'])
		// level/ritual come from spells.json, not from the stored pick.
		expect(result[1]).toMatchObject({ level: 1, ritual: true, origin: 'optionalFeature' })
	})

	it('Pact of the Tome picks carry NO usage label — "they function as Warlock spells for you" establishes no special term (D21/D70)', () => {
		const result = extractOptionalFeatureChosenSpells(spells, [tomePick])
		expect(result.find((s) => s.name === 'Find Familiar')?.usage).toBeFalsy() // level-1 pick
		expect(result.find((s) => s.name === 'Disguise Self')?.usage).toBeFalsy() // cantrip pick
	})

	it('a stored pick whose option is no longer chosen is ignored', () => {
		const orphaned = { ...tomePick, choices: ['Mask of Many Faces'] }
		expect(extractOptionalFeatureChosenSpells(spells, [orphaned])).toEqual([])
	})

	it('matches the option name case-insensitively against the chosen list', () => {
		const oddCase = { ...tomePick, choices: ['pact of the tome'] }
		expect(extractOptionalFeatureChosenSpells(spells, [oddCase])).toHaveLength(2)
	})

	it('a spell picked in both slots of one option counts once', () => {
		const doubled = {
			featureType: 'EI',
			choices: ['Pact of the Tome'],
			spellChoices: [
				{
					optionName: 'Pact of the Tome',
					cantrips: [{ name: 'Find Familiar', source: 'XPHB' }],
					spells: [{ name: 'Find Familiar', source: 'XPHB' }],
				},
			],
		}
		expect(extractOptionalFeatureChosenSpells(spells, [doubled])).toHaveLength(1)
	})

	it('a stored pick that no longer resolves against spells.json is skipped cleanly (D43)', () => {
		const stale = {
			featureType: 'EI',
			choices: ['Pact of the Tome'],
			spellChoices: [
				{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Deleted Spell', source: 'XPHB' }], spells: [{ name: 'Find Familiar', source: 'XPHB' }] },
			],
		}
		expect(extractOptionalFeatureChosenSpells(spells, [stale]).map((s) => s.name)).toEqual(['Find Familiar'])
	})

	it('a selection with no spellChoices at all yields nothing', () => {
		expect(extractOptionalFeatureChosenSpells(spells, [{ featureType: 'EI', choices: ['Mask of Many Faces'] }])).toEqual([])
		expect(extractOptionalFeatureChosenSpells(spells, [])).toEqual([])
	})

	it('throws a named error when spells.json is not an array', () => {
		expect(() => extractOptionalFeatureChosenSpells({}, [])).toThrow(/spells\.json/)
	})
})
