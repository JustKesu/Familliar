import { describe, expect, it } from 'vitest'
import { featureActionRows, grantedFeatureOrigin, poolKeyFromText } from './featureActionRowData'
import type { GrantedFeature } from './grantedClassFeatures'
import type { FeatTextEntry } from './sheetData'
import type { OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'
import type { FeatInstance } from '../featAsi/featInstances'

function granted(name: string, over: Partial<GrantedFeature> = {}): GrantedFeature {
	return { id: `cf|${name.toLowerCase()}`, name, level: 1, entries: [], kind: 'class', className: 'Fighter', ...over }
}

function option(name: string, over: Partial<OptionalFeatureOption> = {}): OptionalFeatureOption {
	return { name, source: 'XPHB', entries: [], ...over }
}

function asiFeat(name: string, source: string, level: number): FeatInstance {
	return { key: `asi:${level}`, origin: 'asi', level, name, source }
}

const REST = 'You regain the expended use when you finish a {@variantrule Short Rest|XPHB}.'

describe('featureActionRows', () => {
	it('keeps a granted feature qualifying by its rest tag, and drops one qualifying by neither test', () => {
		const rows = featureActionRows(
			[granted('Second Wind', { entries: [REST] }), granted('Improved Critical', { entries: ['You score a critical hit on a 19 or 20.'] })],
			[],
			[],
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Second Wind'])
	})

	it('keeps a granted feature qualifying only by `consumes` — the 72 features with no rest tag at all', () => {
		const rows = featureActionRows([granted('Stunning Strike', { consumes: { name: 'Focus Point' }, entries: ['When you hit with an attack…'] })], [], [], [])
		expect(rows.map((row) => row.name)).toEqual(['Stunning Strike'])
	})

	it('leaves every cell but the name to the caller — a row carries a key, a name, its resource candidate and its origin only', () => {
		const [row] = featureActionRows([granted('Rage', { entries: [REST] })], [], [], [])
		// No `consumes`, so the candidate falls back to the feature's own resolved name (Rage is one of the 8 self-limited resources).
		expect(row).toEqual({ key: 'feature|rage', name: 'Rage', resourceName: 'Rage', origin: 'Fighter 1', actionType: 'other', entries: [REST] })
	})

	it('D182: adds a feature D86 rejects when R-phrase puts it in Action/Bonus Action/Reaction, and still drops an unmatched one', () => {
		const rows = featureActionRows(
			[
				granted('Cunning Action', { entries: ['You can take the {@action Dash|XPHB}, {@action Disengage|XPHB}, or {@action Hide|XPHB} action as a {@variantrule Bonus Action|XPHB}.'] }),
				granted('Uncanny Dodge', { entries: ['When an attacker you can see hits you, you can take a {@variantrule Reaction|XPHB} to halve the damage.'] }),
				granted('Improved Critical', { entries: ['You score a critical hit on a 19 or 20.'] }),
			],
			[],
			[],
			[],
		)
		expect(rows.map((row) => [row.name, row.actionType])).toEqual([
			['Cunning Action', 'bonus'],
			['Uncanny Dodge', 'reaction'],
		])
	})

	it('D415: adds an untagged feature, feat or option whose count a hand table gives, in the Other group, and not the same name without the phrase', () => {
		const pb = 'You can use this feature a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.'
		const rows = featureActionRows(
			[
				granted("Giant's Might", { entries: [pb], subclassShortName: 'Rune Knight', level: 3 }),
				granted('Unwavering Mark', { entries: ['You can make this special attack a number of times equal to your Strength modifier (minimum of once), and you regain all expended uses of it when you finish a long rest.'] }),
				granted('Runic Shield', { entries: ['When another creature you can see within 60 feet of you is hit by an attack roll, you can react.'] }),
			],
			[asiFeat('Mythal Touched', 'FRHoF', 4)],
			[{ name: 'Mythal Touched', source: 'FRHoF', entries: ['You can use this benefit a number of times equal to your {@variantrule Proficiency Bonus|XPHB}.'] }],
			[option('Bond of the Talisman', { source: 'TCE', entries: [pb] })],
		)
		expect(rows.map((row) => [row.name, row.actionType, row.resourceName])).toEqual([
			["Giant's Might", 'other', "Giant's Might"],
			['Unwavering Mark', 'other', 'Unwavering Mark'],
			['Mythal Touched', 'other', 'Mythal Touched'],
			['Bond of the Talisman', 'other', 'Bond of the Talisman'],
		])
	})

	it('collapses a feature the data restates at a later level into one row (Action Surge at 2 and 17), keeping the level first gained', () => {
		const rows = featureActionRows(
			[
				granted('Action Surge', { id: 'cf|action surge|fighter|xphb|2|xphb', level: 2, entries: [REST] }),
				granted('Action Surge', { id: 'cf|action surge|fighter|xphb|17|xphb', level: 17, entries: [REST] }),
			],
			[],
			[],
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Action Surge'])
		expect(rows[0].origin).toBe('Fighter 2')
	})

	it('keeps the resolver order — granted features by the level they were gained at, then feats, then chosen options', () => {
		const rows = featureActionRows(
			[granted('Rage', { level: 1, entries: [REST] }), granted('Relentless Rage', { level: 11, entries: [REST] })],
			[asiFeat('Lucky', 'XPHB', 4)],
			[{ name: 'Lucky', source: 'XPHB', entries: [REST] }],
			[option('Quickened Spell', { consumes: { name: 'Sorcery Points', amount: 2 } })],
		)
		expect(rows.map((row) => row.name)).toEqual(['Rage', 'Relentless Rage', 'Lucky', 'Quickened Spell'])
	})

	it('D185/D186: species traits need an R-phrase group or a tracked use count, are labelled with the species and ordered last', () => {
		const rows = featureActionRows(
			[granted('Second Wind', { entries: [REST] })],
			[],
			[],
			[],
			undefined,
			[
				{ name: 'Celestial Revelation', entries: ['As a {@variantrule Bonus Action|XPHB}, you can transform. Once you use it, you can\'t again until you finish a {@variantrule Long Rest|XPHB}.'] },
				{ name: 'Darkvision', entries: ['You have Darkvision.'] },
				{ name: 'Trance', entries: ['You finish a {@variantrule Long Rest|XPHB} in 4 hours.'] },
				{ name: 'Relentless Endurance', entries: ['You drop to 1 Hit Point instead. Once you use this trait, you can\'t do so again until you finish a {@variantrule Long Rest|XPHB}.'] },
			],
			'Aasimar',
		)
		expect(rows.map((r) => [r.key, r.origin, r.actionType])).toEqual([
			['feature|second wind', 'Fighter 1', 'other'],
			['species|celestial revelation', 'Aasimar', 'bonus'],
			['species|relentless endurance', 'Aasimar', 'other'],
		])
	})

	it('adds a feat whose own text carries the rest tag, and skips a feat that carries neither', () => {
		const featTexts: FeatTextEntry[] = [
			{ name: 'Lucky', source: 'XPHB', entries: [REST] },
			{ name: 'Alert', source: 'XPHB', entries: ['You gain a bonus to Initiative equal to your Proficiency Bonus.'] },
		]
		const rows = featureActionRows(
			[],
			[
				asiFeat('Lucky', 'XPHB', 4),
				asiFeat('Alert', 'XPHB', 8),
			],
			featTexts,
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Lucky'])
		expect(rows[0].key).toBe('feat|lucky')
	})

	it('matches a feat on name AND source, so a same-named feat from another book is not tested against the wrong text', () => {
		const rows = featureActionRows([], [asiFeat('Lucky', 'XPHB', 4)], [{ name: 'Lucky', source: 'PHB', entries: [REST] }], [])
		expect(rows).toEqual([])
	})

	it('gives no row to a feat whose text is missing entirely (D43 — the Feats list reports it)', () => {
		expect(featureActionRows([], [asiFeat('Ghostly Gift', 'HOMEBREW', 4)], [], [])).toEqual([])
	})

	/*
	 * The third source. All 38 usable Metamagic / Maneuver / Arcane Shot options
	 * qualify only through `consumes`, so these two cases are the whole gap part A
	 * left open: the pool spender gets a row, the passive style does not.
	 */
	it('gives a chosen Metamagic option a row from `consumes` alone, with no rest tag in its text', () => {
		const rows = featureActionRows([], [], [], [option('Twinned Spell', { consumes: { name: 'Sorcery Points', amount: 1 }, entries: ['When you cast a spell…'] })])
		expect(rows).toEqual([{ key: 'option|twinned spell', name: 'Twinned Spell', resourceName: 'Sorcery Points', origin: null, actionType: 'other', entries: ['When you cast a spell…'] }])
	})

	it('gives no row to a chosen fighting style, which carries neither `consumes` nor a rest tag', () => {
		expect(featureActionRows([], [], [], [option('Defense', { entries: ['While you are wearing armor, you gain a +1 bonus to AC.'] })])).toEqual([])
	})

	it('collapses an option that shares its name with a granted feature into the one row', () => {
		const rows = featureActionRows([granted('Eldritch Smite', { entries: [REST] })], [], [], [option('Eldritch Smite', { consumes: { name: 'Pact Slot' } })])
		expect(rows).toEqual([{ key: 'feature|eldritch smite', name: 'Eldritch Smite', resourceName: 'Eldritch Smite', origin: 'Fighter 1', actionType: 'other', entries: [REST] }])
	})

	it("labels the background's origin feat by its origin (D156)", () => {
		const rows = featureActionRows([], [{ key: 'background', origin: 'background', name: 'Lucky', source: 'XPHB' }], [{ name: 'Lucky', source: 'XPHB', entries: [REST] }], [])
		expect(rows.map((row) => row.origin)).toEqual(['Feat, Background'])
	})

	it('returns nothing for a character with no features, feats or chosen options', () => {
		expect(featureActionRows([], [], [], [])).toEqual([])
	})

	it('resolves a `consumes` name through resources.ts\'s own alias, same as computeCharacterResources (slice 9b2)', () => {
		const rows = featureActionRows([granted('Stunning Strike', { consumes: { name: 'Ki' }, entries: ['When you hit with an attack…'] })], [], [], [])
		expect(rows).toEqual([{ key: 'feature|stunning strike', name: 'Stunning Strike', resourceName: 'Focus Point', origin: 'Fighter 1', actionType: 'other', entries: ['When you hit with an attack…'] }])
	})

	it('reads a bare-string `consumes` the same as a `{ name }` record', () => {
		const rows = featureActionRows([granted('Wild Shape', { consumes: 'Wild Shape', entries: ['When you finish a rest…'] })], [], [], [])
		expect(rows[0].resourceName).toBe('Wild Shape')
	})

	it('labels each source with its origin: class and level, subclass with its class level, feat with its level, option through the caller', () => {
		const rows = featureActionRows(
			[
				granted('Second Wind', { level: 1, entries: [REST] }),
				granted('Relentless', { level: 18, kind: 'subclass', className: 'Fighter', subclassShortName: 'Battle Master', entries: [REST] }),
			],
			[asiFeat('Lucky', 'XPHB', 4)],
			[{ name: 'Lucky', source: 'XPHB', entries: [REST] }],
			[option('Precision Attack', { consumes: { name: 'Superiority Die' } })],
			(chosen) => (chosen.name === 'Precision Attack' ? 'Battle Master' : null),
		)
		expect(rows.map((row) => [row.name, row.origin])).toEqual([
			['Second Wind', 'Fighter 1'],
			['Relentless', 'Battle Master, Fighter 18'],
			['Lucky', 'Feat, level 4'],
			['Precision Attack', 'Battle Master'],
		])
	})

	describe('D409 Psionic Power per class', () => {
		const POWER = ['You regain one of your expended Psionic Energy Dice when you finish a {@variantrule Short Rest|XPHB}, and you regain all of them when you finish a {@variantrule Long Rest|XPHB}.']
		const fighterPower = granted('Psionic Power', { level: 3, kind: 'subclass', className: 'Fighter', subclassShortName: 'Psi Warrior', entries: POWER })
		const roguePower = granted('Psionic Power', { level: 3, kind: 'subclass', className: 'Rogue', subclassShortName: 'Soulknife', entries: POWER })
		const split = [
			{ name: 'Psionic Energy Die (Fighter)', pool: 'Psionic Energy Die', className: 'Fighter' },
			{ name: 'Psionic Energy Die (Rogue)', pool: 'Psionic Energy Die', className: 'Rogue' },
		]
		const plain = [{ name: 'Psionic Energy Die' }]
		const rowsFor = (features: GrantedFeature[], resources: { name: string; pool?: string; className?: string }[]) =>
			featureActionRows(features, [], [], [], undefined, [], null, (candidate, className, record) => poolKeyFromText(candidate, className, record, resources))

		it('gives a multiclass character one row per class, each tied to its own pool', () => {
			expect(rowsFor([fighterPower, roguePower], split).map((row) => [row.name, row.resourceName, row.origin])).toEqual([
				['Psionic Power', 'Psionic Energy Die (Fighter)', 'Psi Warrior, Fighter 3'],
				['Psionic Power', 'Psionic Energy Die (Rogue)', 'Soulknife, Rogue 3'],
			])
		})

		it('keeps one row for a single Psi Warrior and for a single Soulknife', () => {
			expect(rowsFor([fighterPower], plain)).toHaveLength(1)
			expect(rowsFor([roguePower], plain)).toHaveLength(1)
		})

		it('still folds Extra Attack from two classes into one row', () => {
			const attack = (className: string) => granted('Extra Attack', { className, entries: ['You can attack twice, and take the {@action Attack|XPHB} action.'] })
			expect(rowsFor([attack('Fighter'), attack('Rogue')], split)).toHaveLength(1)
		})
	})

	describe('D410 pool-granting features', () => {
		const REGAIN = ['You regain all expended uses when you finish a {@variantrule Long Rest|XPHB}.']
		const rows = featureActionRows(
			[
				granted('Font of Magic', { className: 'Sorcerer', entries: REGAIN }),
				granted('Sorcerous Restoration', { className: 'Sorcerer', level: 5, entries: REGAIN }),
				granted('Elder Champion', { className: 'Paladin', kind: 'subclass', entries: ['Enemies have Disadvantage against your Channel Divinity options. You regain all expended uses of Channel Divinity on a {@variantrule Long Rest|XPHB}.'] }),
				granted('Extra Attack', { entries: ['You can attack twice, and take the {@action Attack|XPHB} action.'] }),
			],
			[],
			[],
			[],
		)
		const resourceOf = (name: string) => rows.find((row) => row.name === name)?.resourceName

		it('files Font of Magic under the Sorcery Point pool', () => expect(resourceOf('Font of Magic')).toBe('Sorcery Point'))
		it('leaves a feature that is its own resource, a pool-naming feature outside the table and Extra Attack unchanged', () => {
			expect(resourceOf('Sorcerous Restoration')).toBe('Sorcerous Restoration')
			expect(resourceOf('Elder Champion')).toBe('Elder Champion')
			expect(resourceOf('Extra Attack')).toBe('Extra Attack')
		})
	})
})

describe('grantedFeatureOrigin', () => {
	it('names the class and level, and puts the subclass first for a subclass feature', () => {
		expect(grantedFeatureOrigin({ className: 'Cleric', level: 2 })).toBe('Cleric 2')
		expect(grantedFeatureOrigin({ className: 'Cleric', subclassShortName: 'Life', level: 3 })).toBe('Life, Cleric 3')
	})
})
