import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './character'
import { MIGRATIONS, canMigrateToCurrent, migrateToCurrent } from './migrations'

describe('the migration chain (D69)', () => {
	it('has no hole between its oldest step and the current version', () => {
		const oldest = Math.min(...MIGRATIONS.map((step) => step.from))
		let at = oldest
		for (const _ of MIGRATIONS) {
			const step = MIGRATIONS.find((migration) => migration.from === at)
			expect(step).toBeDefined()
			at = step!.to
		}
		expect(at).toBe(CURRENT_SCHEMA_VERSION)
	})

	it('accepts the current version and every version a chain reaches', () => {
		expect(canMigrateToCurrent(CURRENT_SCHEMA_VERSION)).toBe(true)
		for (const step of MIGRATIONS) expect(canMigrateToCurrent(step.from)).toBe(true)
	})

	it('refuses a version older than the chain, and any future one', () => {
		const oldest = Math.min(...MIGRATIONS.map((step) => step.from))
		expect(canMigrateToCurrent(oldest - 1)).toBe(false)
		expect(canMigrateToCurrent(CURRENT_SCHEMA_VERSION + 1)).toBe(false)
	})

	it('raises the version tag and keeps every field the old shape had', () => {
		const oldest = Math.min(...MIGRATIONS.map((step) => step.from))
		const migrated = migrateToCurrent({ schemaVersion: oldest, id: '1', name: 'Rowan', classes: [] }) as Record<string, unknown>
		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		expect(migrated['name']).toBe('Rowan')
		expect(migrated['id']).toBe('1')
	})

	it('carries a version-18 character forward with its inventory intact and nothing equipped', () => {
		const migrated = migrateToCurrent({
			schemaVersion: 18,
			id: '1',
			name: 'Rowan',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }],
			currencyCopper: 500,
		}) as Record<string, unknown>
		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// Owning chain mail is not wearing it — the migration deliberately equips nothing.
		expect(migrated['inventory']).toEqual([{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }])
		expect(migrated['currencyCopper']).toBe(500)
	})

	it('carries a version-21 character forward without setting a magic bonus on anything', () => {
		const migrated = migrateToCurrent({
			schemaVersion: 21,
			id: '1',
			name: 'Rowan',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }],
		}) as Record<string, unknown>
		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// The ITEM's own bonus is read from items.json; only a player-set one would be stored, and none was.
		expect(migrated['inventory']).toEqual([{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }])
	})

	it('carries a version-22 character forward unchanged — an existing character gains no custom item', () => {
		const before = {
			schemaVersion: 22,
			id: '1',
			name: 'Rowan',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [
				{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
				{ name: 'Longsword', source: 'XPHB', quantity: 2, magicBonus: 1, attuned: true },
			],
			currencyCopper: 500,
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// Every row is exactly what it was: `custom` is what a row lacks unless the player made one (slice e2a).
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
	})

	it('carries a version-23 custom item forward with its computed fields simply absent', () => {
		const before = {
			schemaVersion: 23,
			id: '1',
			name: 'Rowan',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [
				{
					name: 'Bark Plate',
					source: 'Custom',
					quantity: 1,
					equipped: 'worn',
					// The whole definition a version-23 character could hold: no armour class, no category, no bonus of any kind.
					custom: { name: 'Bark Plate', kind: 'armour', valueCopper: 5000, description: 'Bark, mostly.' },
				},
			],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// Nothing is backfilled: an absent computed field means the item declares nothing there, which is exactly what it declared before.
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
	})

	it('carries a version-24 custom suit forward imposing neither penalty it never declared', () => {
		const before = {
			schemaVersion: 24,
			id: '1',
			name: 'Rowan',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [
				{
					name: 'Bark Plate',
					source: 'Custom',
					quantity: 1,
					equipped: 'worn',
					// The most a version-24 suit could say about itself: no Stealth flag and no Strength requirement existed to set.
					custom: { name: 'Bark Plate', kind: 'armour', armourClass: 16, armourCategory: 'heavy' },
				},
			],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// Backfilling either would change a number the player never set — the suit keeps hampering nothing and demanding nothing.
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
	})

	it('carries a version-25 held weapon forward in one hand', () => {
		const before = {
			schemaVersion: 25,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// An absent grip is one-handed, which is the die (dmg1) such a row was already being given.
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
	})

	it('carries a version-26 custom weapon forward taking one hand, exactly as it did before', () => {
		const before = {
			schemaVersion: 26,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			inventory: [
				{
					name: 'Bone Blade',
					source: 'Custom',
					quantity: 1,
					// The most a version-26 definition could say: no propertyFull-driving flag existed to set.
					custom: { name: 'Bone Blade', kind: 'weapon', damageDice: '1d8', damageType: 'slashing' },
				},
			],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// Backfilling twoHanded/versatile would change what the weapon costs to hold — the player never declared either.
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
	})

	it('carries a version-27 character forward without inventing any hit points', () => {
		const before = {
			schemaVersion: 27,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// currentHp/maxHp are manual (D9) — an existing character has neither, and absent means "not set".
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
		expect('currentHp' in migrated).toBe(false)
		expect('maxHp' in migrated).toBe(false)
	})

	it('carries a version-28 character forward with no species spellcasting ability recorded', () => {
		const before = {
			schemaVersion: 28,
			id: '1',
			name: 'Vex',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			species: { name: 'Aarakocra', source: 'XPHB' },
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// speciesSpellcastingAbility is D57-style optional — absent already means "not chosen yet" (computeSpeciesSpellcasting's existing placeholder).
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
		expect('speciesSpellcastingAbility' in migrated).toBe(false)
	})

	it('moves a version-29 character’s typed maxHp into the override, so its displayed maximum does not change', () => {
		const before = {
			schemaVersion: 29,
			id: '1',
			name: 'Bruiser',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
			currentHp: 18,
			maxHp: 44,
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		expect(migrated['maxHpOverride']).toBe(44)
		expect('maxHp' in migrated).toBe(false)
		// currentHp is untouched, and no per-level contributions are invented.
		expect(migrated['currentHp']).toBe(18)
		expect('hitPointLevels' in migrated).toBe(false)
	})

	it('carries a version-29 character with no typed maxHp forward with no override at all', () => {
		const before = {
			schemaVersion: 29,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
		expect('maxHpOverride' in migrated).toBe(false)
	})

	it('turns a version-30 character’s bare mastery names into objects with no level recorded', () => {
		const migrated = migrateToCurrent({
			schemaVersion: 30,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
			masteries: ['Longsword', 'Shortbow'],
		}) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// No level is guessed (D97): the save has no record of when either pick was made, and a
		// made-up one would let a later "remove level 5" strip a mastery that was never taken there.
		expect(migrated['masteries']).toEqual([{ name: 'Longsword' }, { name: 'Shortbow' }])
	})

	it('carries a version-30 character with no masteries forward without inventing the field', () => {
		const before = {
			schemaVersion: 30,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
		expect('masteries' in migrated).toBe(false)
	})

	it('turns a version-31 character’s bare expertise skill names into objects with no level recorded', () => {
		const migrated = migrateToCurrent({
			schemaVersion: 31,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 5 }],
			classSkills: ['stealth', 'perception'],
			expertiseSkills: ['stealth', 'perception'],
		}) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		// Same reason version 31 guessed no mastery level (D98 following D97/D43).
		expect(migrated['expertiseSkills']).toEqual([{ name: 'stealth' }, { name: 'perception' }])
		expect(migrated['classSkills']).toEqual(['stealth', 'perception'])
	})

	it('carries a version-31 character with no expertiseSkills forward without inventing the field', () => {
		const before = {
			schemaVersion: 31,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
		expect('expertiseSkills' in migrated).toBe(false)
	})

	it('carries a version-30 character through every shape change in one chain', () => {
		const migrated = migrateToCurrent({
			schemaVersion: 30,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
			masteries: ['Longsword'],
			expertiseSkills: ['athletics'],
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: ['Trip Attack'] }],
		}) as Record<string, unknown>

		expect(migrated['masteries']).toEqual([{ name: 'Longsword' }])
		expect(migrated['expertiseSkills']).toEqual([{ name: 'athletics' }])
		expect(migrated['optionalFeatureChoices']).toEqual([{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }] }])
	})

	it('turns every bare option name in every optionalFeatureChoices entry into an object with no level recorded', () => {
		const migrated = migrateToCurrent({
			schemaVersion: 32,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 10 }],
			optionalFeatureChoices: [
				// One featureType holding picks from several levels is exactly why the level sits on the pick (D99).
				{ featureType: 'MM', choices: ['Careful Spell', 'Distant Spell', 'Twinned Spell', 'Quickened Spell'] },
				{ featureType: 'EI', choices: ['Agonizing Blast'] },
			],
		}) as Record<string, unknown>

		expect(migrated['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION)
		expect(migrated['optionalFeatureChoices']).toEqual([
			{
				featureType: 'MM',
				choices: [{ name: 'Careful Spell' }, { name: 'Distant Spell' }, { name: 'Twinned Spell' }, { name: 'Quickened Spell' }],
			},
			{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] },
		])
	})

	it('leaves an optionalFeatureChoices entry’s spellChoices untouched and adds nothing to an entry without choices', () => {
		const tomePicks = [{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Guidance', source: 'XPHB' }], spells: [] }]
		const migrated = migrateToCurrent({
			schemaVersion: 32,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
			optionalFeatureChoices: [{ featureType: 'EI', choices: ['Pact of the Tome'], spellChoices: tomePicks }, { featureType: 'MM' }],
		}) as Record<string, unknown>

		// D99 keeps nested spell picks out of D22, so the migration must not reshape them either.
		expect(migrated['optionalFeatureChoices']).toEqual([
			{ featureType: 'EI', choices: [{ name: 'Pact of the Tome' }], spellChoices: tomePicks },
			{ featureType: 'MM' },
		])
	})

	it('carries a version-32 character with no optionalFeatureChoices forward without inventing the field', () => {
		const before = {
			schemaVersion: 32,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION })
		expect('optionalFeatureChoices' in migrated).toBe(false)
	})

	/* Slice 8e: an older character's creation level is not known, so nothing is invented. */
	it('carries a version-33 character forward with no created-at level', () => {
		const before = {
			schemaVersion: 33,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: 34 })
		expect('createdAtLevel' in migrated).toBe(false)
	})

	/* Reporting what is actually wrong with such a value is the validator's job, not this one's. */
	it('passes through anything that is not a versioned record', () => {
		expect(migrateToCurrent(null)).toBeNull()
		expect(migrateToCurrent('nonsense')).toBe('nonsense')
		expect(migrateToCurrent({ id: '1' })).toEqual({ id: '1' })
	})
})
