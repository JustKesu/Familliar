import { describe, expect, it } from 'vitest'
import { featSource, featuresTabGroups, grantsFeatureType } from './featuresTabData'
import type { GrantedFeature } from './grantedClassFeatures'

const feature = (name: string, level: number, entries: unknown[], className = 'Sorcerer'): GrantedFeature => ({
	id: `cf|${name}|${level}`,
	name,
	level,
	entries,
	kind: 'class',
	className,
})

describe('grantsFeatureType (D184)', () => {
	it('matches the optionalfeatures filter by its exact feature type, not a prefix', () => {
		const entries = ['{@filter Maneuvers Options|optionalfeatures|feature type=MV:B|source=XPHB}']
		expect(grantsFeatureType(entries, 'MV:B')).toBe(true)
		expect(grantsFeatureType(entries, 'MV')).toBe(false)
	})

	it('matches a fighting style through the feats filter, and nothing else through it', () => {
		const entries = [{ type: 'entries', entries: ['Gain a {@filter Fighting Style feat|feats|category=FS}.'] }]
		expect(grantsFeatureType(entries, 'FS')).toBe(true)
		expect(grantsFeatureType(entries, 'MM')).toBe(false)
	})
})

describe('featuresTabGroups — species feat not chosen (D276)', () => {
	const versatile = { name: 'Versatile', entries: ['You gain an Origin feat of your choice.'], grantsOriginFeat: true as const }
	const input = { classes: [], speciesName: 'Human', granted: [], classFeatureChoices: [], chosenOptions: [], optionOrigin: () => null, speciesTraits: [versatile, { name: 'Skillful', entries: [] }] }
	const speciesRows = (feats: Parameters<typeof featuresTabGroups>[0]['feats']) => featuresTabGroups({ ...input, feats }).find((group) => group.key === 'species')!.rows

	it('puts the line under the granting trait only while no species feat is stored', () => {
		expect(speciesRows([]).map((row) => row.options.map((option) => option.name))).toEqual([['Origin feat not chosen yet — choose it in Edit Character.'], []])
		const alert = { instance: { key: 'species' as const, origin: 'species' as const, name: 'Alert', source: 'XPHB' }, text: undefined, pending: [] }
		expect(speciesRows([alert]).every((row) => row.options.length === 0)).toBe(true)
	})
})

describe('featuresTabGroups (D184)', () => {
	const base = { speciesName: null, classFeatureChoices: [], optionOrigin: () => 'Sorcerer', speciesTraits: [], feats: [] }

	it('puts a chosen option under the lowest-level feature whose text filters for it', () => {
		const filter = '{@filter Metamagic Options|optionalfeatures|feature type=MM|source=XPHB}'
		const groups = featuresTabGroups({
			...base,
			classes: [{ className: 'Sorcerer', level: 10 }],
			granted: [feature('Metamagic', 2, [filter]), feature('Metamagic', 10, [filter])],
			chosenOptions: [{ name: 'Twinned Spell', source: 'XPHB', entries: ['Twin it.'], featureType: 'MM' }],
		})
		expect(groups[0].rows.map((row) => row.options.map((option) => option.name))).toEqual([['Twinned Spell'], []])
	})

	it('gives an option no feature links its own row at the end of the class group', () => {
		const groups = featuresTabGroups({
			...base,
			classes: [{ className: 'Sorcerer', level: 3 }],
			granted: [feature('Font of Magic', 2, ['Plain text.'])],
			chosenOptions: [{ name: 'Rune', source: 'TCE', entries: [], featureType: 'RN' }],
		})
		expect(groups[0].rows.map((row) => [row.name, row.source])).toEqual([
			['Font of Magic', 'Sorcerer 2'],
			['Rune', 'Sorcerer'],
		])
	})

	it('builds one class group per class, in the character’s order', () => {
		const groups = featuresTabGroups({ ...base, classes: [{ className: 'Fighter', level: 1 }, { className: 'Rogue', level: 1 }], granted: [], chosenOptions: [] })
		expect(groups.map((group) => group.label)).toEqual(['Fighter Features', 'Rogue Features', 'Species Traits', 'Feats'])
	})
})

describe('featSource', () => {
	it('names the origin, or nothing for an ASI feat of a multiclass character', () => {
		expect(featSource({ origin: 'background' }, [])).toBe('From Background')
		expect(featSource({ origin: 'asi', level: 4 }, [{ className: 'Fighter', level: 4 }])).toBe('From Fighter 4')
		expect(featSource({ origin: 'asi', level: 4 }, [{ className: 'Fighter', level: 2 }, { className: 'Rogue', level: 2 }])).toBeNull()
	})
})
