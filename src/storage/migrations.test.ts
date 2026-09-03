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

	/* Reporting what is actually wrong with such a value is the validator's job, not this one's. */
	it('passes through anything that is not a versioned record', () => {
		expect(migrateToCurrent(null)).toBeNull()
		expect(migrateToCurrent('nonsense')).toBe('nonsense')
		expect(migrateToCurrent({ id: '1' })).toEqual({ id: '1' })
	})
})
