import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, singleClassLevelOrder } from './character'
import { MIGRATIONS, canMigrateToCurrent, migrateToCurrent } from './migrations'
import { describeLanguagesError, describeSubclassSkillsError, describeToolChoicesError } from './validate'

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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
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

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('createdAtLevel' in migrated).toBe(false)
	})

	/* Slice 9a1 (D110): nobody had temporary hit points before this version, so absent is already right. */
	it('carries a version-34 character forward with no temporary hit points', () => {
		const before = {
			schemaVersion: 34,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }],
			currentHp: 12,
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('temporaryHitPoints' in migrated).toBe(false)
	})

	/* Slice 9a2 (D111): a death save is in progress only during play, so no stored character has one. */
	it('carries a version-35 character forward with no death saves in progress', () => {
		const before = {
			schemaVersion: 35,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }],
			currentHp: 0,
			temporaryHitPoints: 4,
		}
		const { temporaryHitPoints: _temporary, ...withoutTemporary } = before
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		// 36->37 moved it under `play`; the value is the same one a version-35 save carried.
		expect(migrated).toEqual({ ...withoutTemporary, play: { temporaryHitPoints: 4 }, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('deathSaves' in migrated).toBe(false)
	})

	/* Slice 9b1: the step that MOVES the two play fields rather than only tagging. */
	it('moves a version-36 character’s temporary hit points and death saves under `play`, with nothing spent', () => {
		const before = {
			schemaVersion: 36,
			id: '1',
			name: 'Aria',
			classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: 'Berserker', level: 5 }],
			currentHp: 0,
			temporaryHitPoints: 4,
			deathSaves: { successes: 1, failures: 2 },
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated['play']).toEqual({ temporaryHitPoints: 4, deathSaves: { successes: 1, failures: 2 } })
		expect('temporaryHitPoints' in migrated).toBe(false)
		expect('deathSaves' in migrated).toBe(false)
		expect((migrated['play'] as Record<string, unknown>)['resourceUses']).toBeUndefined()
	})

	it('gives a version-36 character with neither play field no `play` at all', () => {
		const before = { schemaVersion: 36, id: '1', name: 'Aria', classes: [], currentHp: 12 }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('play' in migrated).toBe(false)
	})

	/* Slice 9b4: a purely additive field, so the step only tags — nothing spent is what absence already means. */
	it('tags a version-38 character without inventing spent hit dice', () => {
		const before = { schemaVersion: 38, id: '1', name: 'Aria', classes: [], play: { temporaryHitPoints: 4 } }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect((migrated['play'] as Record<string, unknown>)['spentHitDice']).toBeUndefined()
	})

	/* Slice 9d1: a purely additive field, so the step only tags — no concentration is what absence already means. */
	it('tags a version-39 character without inventing a concentration spell', () => {
		const before = { schemaVersion: 39, id: '1', name: 'Aria', classes: [], play: { temporaryHitPoints: 4 } }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect((migrated['play'] as Record<string, unknown>)['concentratingOn']).toBeUndefined()
	})

	/* R4b (D167): heroicInspiration is purely additive, so a version-43 character loads as "off" with nothing written. */
	it('tags a version-43 character without inventing Heroic Inspiration', () => {
		const before = { schemaVersion: 43, id: '1', name: 'Aria', classes: [], play: { concentratingOn: 'Bless' } }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, play: { concentratingOn: { name: 'Bless' } }, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect((migrated['play'] as Record<string, unknown>)['heroicInspiration']).toBeUndefined()
	})

	/* B3b (D172): new language grantedBy values only; an old Rogue's languages load as they were and the pick reads as pending. */
	it('tags a version-44 character and keeps its languages unchanged', () => {
		const languages = [
			{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
			{ name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
		]
		const before = { schemaVersion: 44, id: '1', name: 'Aria', classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 1 }], languages }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect(describeLanguagesError(migrated['languages'])).toBeNull()
		expect(describeLanguagesError([...languages, { name: 'Abyssal', source: 'XPHB', grantedBy: 'thievesCant' }])).toBeNull()
		expect(describeLanguagesError([{ name: 'Abyssal', source: 'XPHB', grantedBy: 'feat' }])).toContain('grantedBy')
	})

	/* B5 (D174/D175): two additive fields; a version-45 character loads unchanged, with no picks and no size chosen. */
	it('tags a version-45 character without inventing tool picks or a size', () => {
		const before = { schemaVersion: 45, id: '1', name: 'Aria', classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 1 }] }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect(describeToolChoicesError([{ grantedBy: 'bard', name: 'Lute' }])).toBeNull()
		expect(describeToolChoicesError([{ grantedBy: 'wizard', name: 'Lute' }])).toContain('grantedBy')
		expect(describeToolChoicesError([{ grantedBy: 'bard', name: '' }])).toContain('name')
	})

	/* B6c (D177): an additive field and new grantedBy values; a version-47 character loads unchanged, with no skill pick invented. */
	it('tags a version-47 character without inventing subclass skill picks', () => {
		const before = { schemaVersion: 47, id: '1', name: 'Aria', classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Order Domain', level: 3 }] }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('subclassSkills' in migrated).toBe(false)
		expect(describeSubclassSkillsError([{ grantedBy: 'orderDomain', name: 'persuasion' }])).toBeNull()
		expect(describeSubclassSkillsError([{ grantedBy: 'champion', name: 'persuasion' }])).toContain('grantedBy')
		expect(describeToolChoicesError([{ grantedBy: 'warforged', name: 'Dice Set' }])).toBeNull()
		expect(describeLanguagesError([{ name: 'Elvish', source: 'XPHB', grantedBy: 'samurai' }])).toBeNull()
	})

	/* Slice 9d2: three purely additive fields, so the step only tags — nothing written is what absence already means. */
	it('tags a version-40 character without inventing any free text', () => {
		const before = { schemaVersion: 40, id: '1', name: 'Aria', classes: [], play: { concentratingOn: 'Bless' } }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, play: { concentratingOn: { name: 'Bless' } }, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		for (const field of ['appearance', 'backstory', 'notes']) expect(field in migrated).toBe(false)
	})

	/* D156: the background's origin feat is derived, so the step only tags — the feat starts applying with nothing written. */
	it('tags a version-41 character without inventing granted feats', () => {
		const before = {
			schemaVersion: 41,
			id: '1',
			name: 'Aria',
			classes: [],
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'dexterity' }],
			notes: 'x',
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('grantedFeats' in migrated).toBe(false)
	})

	/* Task A2: a purely additive field, so the step only tags — no stored pick is what absence already means. */
	it('tags a version-42 character without inventing any proficiency pick', () => {
		const before = {
			schemaVersion: 42,
			id: '1',
			name: 'Aria',
			classes: [],
			grantedFeats: [{ origin: 'background', name: 'Skilled', source: 'XPHB' }],
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		const [grantedFeat] = migrated['grantedFeats'] as Record<string, unknown>[]
		expect('proficiencies' in grantedFeat).toBe(false)
	})

	/* D205: an older background keeps its derived origin feat — the step only tags. */
	it('tags a version-49 character without inventing an origin-feat override', () => {
		const before = {
			schemaVersion: 49,
			id: '1',
			name: 'Aria',
			classes: [],
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
		}
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
		expect('originFeatOverride' in (migrated['background'] as Record<string, unknown>)).toBe(false)
	})

	/* D213: an older familiar has no hit-point fields, which reads as full — the step only tags. */
	it('tags a version-50 character and adds nothing to its familiar', () => {
		const before = { schemaVersion: 50, id: '1', name: 'Aria', classes: [], familiar: { name: 'Imp', source: 'XMM' } }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
	})

	/* D214: an older character has no conditions or exhaustion, which reads as none — the step only tags. */
	it('tags a version-51 character and adds no conditions or exhaustion', () => {
		const before = { schemaVersion: 51, id: '1', name: 'Aria', classes: [], play: { concentratingOn: 'Bless' } }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, play: { concentratingOn: { name: 'Bless' } }, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
	})

	/* D215: an older character has no manually added feats — the step only tags. */
	it('tags a version-52 character and keeps its grantedFeats as they were', () => {
		const before = { schemaVersion: 52, id: '1', name: 'Aria', classes: [], grantedFeats: [{ origin: 'background', name: 'Alert', source: 'XPHB' }] }
		const migrated = migrateToCurrent({ ...before }) as Record<string, unknown>

		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
	})

	/* D216: the five flat-bonus fields become one `bonuses` list. */
	it('moves a version-53 custom item’s five bonus fields into `bonuses`, dropping zeros', () => {
		const plainRow = { name: 'Rope', source: 'XPHB', quantity: 1 }
		const noBonuses = { name: 'Scarf', source: 'custom', quantity: 1, custom: { name: 'Scarf', kind: 'worn', speedBonus: 10 } }
		const before = {
			schemaVersion: 53,
			id: '1',
			name: 'Aria',
			classes: [],
			inventory: [
				plainRow,
				noBonuses,
				{
					name: 'Charm',
					source: 'custom',
					quantity: 1,
					attuned: true,
					custom: { name: 'Charm', kind: 'worn', bonusArmourClass: 1, bonusSavingThrow: 2, bonusAbilityCheck: -1, bonusSpellAttack: 0, bonusSpellSaveDc: 3 },
				},
			],
		}
		const migrated = migrateToCurrent(structuredClone(before)) as Record<string, unknown>

		expect(migrated).toEqual({
			...before,
			schemaVersion: CURRENT_SCHEMA_VERSION,
			levelOrder: [],
			inventory: [
				plainRow,
				noBonuses,
				{
					name: 'Charm',
					source: 'custom',
					quantity: 1,
					attuned: true,
					custom: {
						name: 'Charm',
						kind: 'worn',
						bonuses: [
							{ target: 'armourClass', amount: 1 },
							{ target: 'allSavingThrows', amount: 2 },
							{ target: 'allAbilityChecks', amount: -1 },
							{ target: 'spellSaveDc', amount: 3 },
						],
					},
				},
			],
		})
	})

	it('tags a version-53 character with no inventory', () => {
		const before = { schemaVersion: 53, id: '1', name: 'Aria', classes: [] }
		expect(migrateToCurrent({ ...before })).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
	})

	/* W-8: an older character has no portrait — the step only tags. */
	it('tags a version-54 character and adds no portrait', () => {
		const before = { schemaVersion: 54, id: '1', name: 'Aria', classes: [], notes: 'x' }
		expect(migrateToCurrent({ ...before })).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: singleClassLevelOrder(before.classes) })
	})

	/* S2: an older character has no species cantrip — the step only tags, the sheet then asks for the pick. */
	it('tags a version-55 character and adds no species cantrip', () => {
		const before = { schemaVersion: 55, id: '1', name: 'Aria', classes: [], species: { name: 'Elf; High Elf Lineage', source: 'XPHB' } }
		const migrated = migrateToCurrent({ ...before })
		expect(migrated).toEqual({ ...before, schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: [] })
		expect('speciesCantrip' in (migrated as object)).toBe(false)
	})

	/* M1a (D317): one class (or none) gives a certain order; several leave it unknown rather than guessed. */
	it('gives a version-56 character a level history only when it has at most one class', () => {
		const rogue = { className: 'Rogue', classSource: 'XPHB', subclass: null, level: 3 }
		const wizard = { className: 'Wizard', classSource: 'XPHB', subclass: null, level: 2 }
		const rogueEntry = { className: 'Rogue', classSource: 'XPHB' }
		const base = { schemaVersion: 56, id: '1', name: 'Aria' }

		expect(migrateToCurrent({ ...base, classes: [] })).toEqual({ ...base, classes: [], levelOrder: [], schemaVersion: 59 })
		expect(migrateToCurrent({ ...base, classes: [rogue] })).toEqual({ ...base, classes: [rogue], levelOrder: [rogueEntry, rogueEntry, rogueEntry], schemaVersion: 59 })
		const multi = migrateToCurrent({ ...base, classes: [rogue, wizard] })
		expect(multi).toEqual({ ...base, classes: [rogue, wizard], schemaVersion: 59 })
		expect('levelOrder' in (multi as object)).toBe(false)
	})

	/* M1b (D318): the style gets its class only when that is certain; old optional-feature picks stay sourceless. */
	describe('version 57 to 58', () => {
		const fighter = { className: 'Fighter', classSource: 'XPHB', subclass: null, level: 2 }
		const paladin = { className: 'Paladin', classSource: 'XPHB', subclass: null, level: 2 }
		const base = { schemaVersion: 57, id: '1', name: 'Aria' }

		it('drops a null or absent style', () => {
			expect(migrateToCurrent({ ...base, classes: [fighter], levelOrder: [] })).toEqual({ ...base, classes: [fighter], levelOrder: [], schemaVersion: 59 })
			const fromNull = migrateToCurrent({ ...base, classes: [fighter], fightingStyle: null }) as Record<string, unknown>
			expect(fromNull).toEqual({ ...base, classes: [fighter], schemaVersion: 59 })
			expect('fightingStyles' in fromNull || 'fightingStyle' in fromNull).toBe(false)
		})

		it('assigns the style to the one class', () => {
			expect(migrateToCurrent({ ...base, classes: [fighter], fightingStyle: 'Archery' })).toEqual({
				...base,
				classes: [fighter],
				fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Archery' }],
				schemaVersion: 59,
			})
		})

		it('leaves the style unassigned with two classes or none', () => {
			expect(migrateToCurrent({ ...base, classes: [fighter, paladin], fightingStyle: 'Defense' })).toEqual({
				...base,
				classes: [fighter, paladin],
				fightingStyles: [{ name: 'Defense' }],
				schemaVersion: 59,
			})
			expect(migrateToCurrent({ ...base, classes: [], fightingStyle: 'Defense' })).toEqual({ ...base, classes: [], fightingStyles: [{ name: 'Defense' }], schemaVersion: 59 })
		})

		it('leaves optional-feature picks as they are', () => {
			const optionalFeatureChoices = [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', level: 3 }, { name: 'Riposte' }] }]
			expect(migrateToCurrent({ ...base, classes: [], optionalFeatureChoices })).toEqual({ ...base, classes: [], optionalFeatureChoices, schemaVersion: 59 })
		})

		it('carries a malformed style across for validation to reject', () => {
			expect(migrateToCurrent({ ...base, classes: [fighter], fightingStyle: 5 })).toEqual({ ...base, classes: [fighter], fightingStyles: 5, schemaVersion: 59 })
		})
	})

	/* M1c (D319): concentration gains a shape, manual feats an id equal to their old position; nothing else moves. */
	describe('version 58 to 59', () => {
		const base = { schemaVersion: 58, id: '1', name: 'Aria', classes: [] }

		it('wraps a concentration name in { name } with no source, and leaves null and absent alone', () => {
			expect(migrateToCurrent({ ...base, play: { concentratingOn: 'Bless', temporaryHitPoints: 2 } })).toEqual({
				...base,
				play: { concentratingOn: { name: 'Bless' }, temporaryHitPoints: 2 },
				schemaVersion: 59,
			})
			expect(migrateToCurrent({ ...base, play: { concentratingOn: null } })).toEqual({ ...base, play: { concentratingOn: null }, schemaVersion: 59 })
			expect(migrateToCurrent({ ...base, play: { resourceUses: { Rage: 1 } } })).toEqual({ ...base, play: { resourceUses: { Rage: 1 } }, schemaVersion: 59 })
			expect(migrateToCurrent({ ...base })).toEqual({ ...base, schemaVersion: 59 })
		})

		it('gives manual feats ids "0", "1", "2" in their order and leaves other granted feats untouched', () => {
			const background = { origin: 'background', name: 'Magic Initiate; Cleric', source: 'XPHB', chosenAbility: 'wisdom' }
			const grantedFeats = [
				{ origin: 'manual', name: 'Alert', source: 'XPHB' },
				background,
				{ origin: 'manual', name: 'Tough', source: 'XPHB' },
				{ origin: 'manual', name: 'Lucky', source: 'XPHB' },
			]
			expect(migrateToCurrent({ ...base, grantedFeats })).toEqual({
				...base,
				grantedFeats: [
					{ origin: 'manual', name: 'Alert', source: 'XPHB', id: '0' },
					background,
					{ origin: 'manual', name: 'Tough', source: 'XPHB', id: '1' },
					{ origin: 'manual', name: 'Lucky', source: 'XPHB', id: '2' },
				],
				schemaVersion: 59,
			})
		})

		it('carries malformed values across for validation to reject', () => {
			expect(migrateToCurrent({ ...base, play: { concentratingOn: 7 }, grantedFeats: [null, 'x'] })).toEqual({
				...base,
				play: { concentratingOn: 7 },
				grantedFeats: [null, 'x'],
				schemaVersion: 59,
			})
		})

		it('is the last step', () => {
			expect(CURRENT_SCHEMA_VERSION).toBe(59)
		})
	})

	/* Reporting what is actually wrong with such a value is the validator's job, not this one's. */
	it('passes through anything that is not a versioned record', () => {
		expect(migrateToCurrent(null)).toBeNull()
		expect(migrateToCurrent('nonsense')).toBe('nonsense')
		expect(migrateToCurrent({ id: '1' })).toEqual({ id: '1' })
	})
})
