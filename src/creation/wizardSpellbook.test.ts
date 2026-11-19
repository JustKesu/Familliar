import { describe, expect, it } from 'vitest'
import { assignSpellbookOrigins, resolveSpellbookEntries, spellbookRunStatus, wizardMaxSpellLevel, type WizardSpellbookEntry } from './wizardSpellbook'

const written = (levels: number[]): WizardSpellbookEntry[] => levels.map((level, index) => ({ name: `Spell ${index}`, source: 'XPHB', level, origin: null }))

describe('assignSpellbookOrigins (D423)', () => {
	it('gives six level 1 spells to Wizard 1', () => {
		expect(assignSpellbookOrigins([1, 1, 1, 1, 1, 1], 1)).toEqual([1, 1, 1, 1, 1, 1])
	})

	it('puts the highest spell levels on the highest Wizard levels', () => {
		expect(assignSpellbookOrigins([1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], 4)).toEqual([3, 4, 3, 2, 2, 4, 1, 1, 1, 1, 1, 1])
	})

	it('is null when a Wizard level would hold a spell it has no slots for', () => {
		expect(assignSpellbookOrigins([2, 2, 1, 1, 1, 1, 1, 1, 1, 1], 3)).toEqual([3, 3, 2, 2, 1, 1, 1, 1, 1, 1])
		expect(assignSpellbookOrigins([2, 2, 2, 1, 1, 1, 1, 1, 1, 1], 3)).toBeNull()
		expect(assignSpellbookOrigins([2, 1, 1, 1, 1, 1], 1)).toBeNull()
	})

	it('is null when the count is not 6 + 2 per later level', () => {
		expect(assignSpellbookOrigins([1, 1, 1, 1, 1], 1)).toBeNull()
	})

	it('reads the spell level cap from the Wizard table', () => {
		expect([1, 2, 3, 5, 17, 20].map(wizardMaxSpellLevel)).toEqual([1, 1, 2, 3, 9, 9])
	})
})

describe('spellbookRunStatus (D423)', () => {
	it('creation needs the exact count and a feasible assignment', () => {
		expect(spellbookRunStatus(written([1, 1, 1, 1, 1]), 'create', 1).reason).toMatch(/exactly 6/)
		expect(spellbookRunStatus(written([1, 1, 1, 1, 1, 1]), 'create', 1).reason).toBeNull()
		expect(spellbookRunStatus(written([2, 2, 2, 1, 1, 1, 1, 1, 1, 1]), 'create', 3).reason).toMatch(/higher-level/)
	})

	it('a level up counts only what this run wrote', () => {
		const held: WizardSpellbookEntry = { name: 'Shield', source: 'XPHB', level: 1, origin: { kind: 'level', level: 1 } }
		const status = spellbookRunStatus([held, ...written([2, 1])], 'levelUp', 4)
		expect(status).toEqual({ count: 2, required: 2, maxSpellLevel: 2, reason: null })
		expect(spellbookRunStatus([held, ...written([3, 1])], 'levelUp', 4).reason).not.toBeNull()
	})

	it('Edit enforces nothing', () => {
		expect(spellbookRunStatus(written([1]), 'edit', 5)).toEqual({ count: 1, required: null, maxSpellLevel: null, reason: null })
	})
})

describe('resolveSpellbookEntries (D423)', () => {
	it('stamps what the run wrote by mode and keeps held origins', () => {
		const held: WizardSpellbookEntry = { name: 'Shield', source: 'XPHB', level: 1, origin: { kind: 'migrated' } }
		const [kept, added] = resolveSpellbookEntries([held, ...written([2])], 'levelUp', 4)
		expect(kept.origin).toEqual({ kind: 'migrated' })
		expect(added.origin).toEqual({ kind: 'level', level: 4 })
		expect(resolveSpellbookEntries(written([3]), 'edit', 5)[0].origin).toEqual({ kind: 'copied' })
		expect(resolveSpellbookEntries(written([1, 1, 1, 1, 1, 1]), 'create', 1).every((spell) => spell.origin.kind === 'level' && spell.origin.level === 1)).toBe(true)
	})
})
