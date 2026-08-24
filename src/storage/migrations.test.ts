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

	/* Reporting what is actually wrong with such a value is the validator's job, not this one's. */
	it('passes through anything that is not a versioned record', () => {
		expect(migrateToCurrent(null)).toBeNull()
		expect(migrateToCurrent('nonsense')).toBe('nonsense')
		expect(migrateToCurrent({ id: '1' })).toEqual({ id: '1' })
	})
})
