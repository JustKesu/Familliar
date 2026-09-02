import { describe, expect, it } from 'vitest'
import { computeDamageResponses, damageResponseBreakdown, damageTypeLabel, type DamageResponseGrant } from './damageResponses'

function resistance(sourceName: string, ...damageTypes: string[]): DamageResponseGrant {
	return { kind: 'resistance', sourceName, damageTypes }
}

describe('computeDamageResponses', () => {
	it('reports a species-granted resistance with its source', () => {
		const result = computeDamageResponses([resistance('Dwarf', 'poison')])

		expect(result.unconditional).toHaveLength(1)
		expect(result.unconditional[0]).toMatchObject({ damageType: 'poison', kind: 'resistance', sources: ['Dwarf'], condition: null, supersededBy: null })
		expect(result.conditional).toHaveLength(0)
	})

	it('collapses two sources of the same resistance into one line naming both', () => {
		const result = computeDamageResponses([resistance('Dwarf', 'poison'), resistance('Belt of Dwarvenkind', 'poison')])

		expect(result.unconditional).toHaveLength(1)
		expect(result.unconditional[0].sources).toEqual(['Dwarf', 'Belt of Dwarvenkind'])
	})

	it('does not repeat a source that grants the same type twice', () => {
		const result = computeDamageResponses([resistance('Dwarf', 'poison'), resistance('Dwarf', 'poison')])

		expect(result.unconditional[0].sources).toEqual(['Dwarf'])
	})

	it('keeps a conditional response out of the unconditional set and states its condition', () => {
		const result = computeDamageResponses([
			{ kind: 'resistance', sourceName: 'Rage (Barbarian)', damageTypes: ['bludgeoning', 'piercing', 'slashing'], condition: 'while your Rage is active' },
		])

		expect(result.unconditional).toHaveLength(0)
		expect(result.conditional).toHaveLength(3)
		expect(result.conditional.map((entry) => entry.damageType)).toEqual(['bludgeoning', 'piercing', 'slashing'])
		expect(result.conditional[0].condition).toBe('while your Rage is active')
	})

	it('never merges a conditional grant into an unconditional one of the same type', () => {
		const result = computeDamageResponses([resistance('Dwarf', 'poison'), { kind: 'resistance', sourceName: 'Rage', damageTypes: ['poison'], condition: 'while raging' }])

		expect(result.unconditional).toHaveLength(1)
		expect(result.unconditional[0].sources).toEqual(['Dwarf'])
		expect(result.conditional).toHaveLength(1)
		expect(result.conditional[0].sources).toEqual(['Rage'])
	})

	it('lets an immunity supersede a resistance to the same damage type, showing both', () => {
		const result = computeDamageResponses([
			resistance('Soul of the Forge (Cleric)', 'fire'),
			{ kind: 'immunity', sourceName: 'Saint of Forge and Fire (Cleric)', damageTypes: ['fire'] },
		])

		expect(result.unconditional).toHaveLength(2)
		const resist = result.unconditional.find((entry) => entry.kind === 'resistance')
		const immune = result.unconditional.find((entry) => entry.kind === 'immunity')
		expect(immune?.supersededBy).toBeNull()
		expect(resist?.supersededBy).toBe('immunity to Fire from Saint of Forge and Fire (Cleric)')
	})

	it('does not let a CONDITIONAL immunity supersede a resistance that always applies', () => {
		const result = computeDamageResponses([
			resistance('Dwarf', 'poison'),
			{ kind: 'immunity', sourceName: 'Some Form', damageTypes: ['poison'], condition: 'while transformed' },
		])

		expect(result.unconditional[0].supersededBy).toBeNull()
	})

	it('leaves an immunity to a different damage type alone', () => {
		const result = computeDamageResponses([resistance('Dwarf', 'poison'), { kind: 'immunity', sourceName: 'Wind Soul', damageTypes: ['lightning'] }])

		expect(result.unconditional.every((entry) => entry.supersededBy === null)).toBe(true)
	})

	it('withholds an unattuned item and names it with the reason (D76)', () => {
		const result = computeDamageResponses([
			{ kind: 'resistance', sourceName: 'Ring of Fire Resistance', damageTypes: [], withheldReason: 'requires attunement and you are not attuned to it' },
		])

		expect(result.unconditional).toHaveLength(0)
		expect(result.notes).toEqual([{ sourceName: 'Ring of Fire Resistance', reason: 'requires attunement and you are not attuned to it' }])
	})

	it('lists an unmade choice as a note rather than granting every option', () => {
		const result = computeDamageResponses([{ kind: 'resistance', sourceName: 'Dragonborn', damageTypes: [], choiceFrom: ['acid', 'fire'] }])

		expect(result.unconditional).toHaveLength(0)
		expect(result.notes[0].sourceName).toBe('Dragonborn')
		expect(result.notes[0].reason).toContain('one of Acid, Fire')
	})

	it('renders an unresolvable source as a note instead of dropping it (D43)', () => {
		const result = computeDamageResponses([{ kind: 'resistance', sourceName: 'Homebrew Cloak', damageTypes: [], unresolvedReason: 'not found in the item data (HB)' }])

		expect(result.notes).toEqual([{ sourceName: 'Homebrew Cloak', reason: 'not found in the item data (HB)' }])
	})

	it('returns empty lists for a character with no sources at all', () => {
		const result = computeDamageResponses([])

		expect(result).toEqual({ unconditional: [], conditional: [], notes: [] })
	})
})

describe('damageResponseBreakdown', () => {
	it('gives every entry a zero amount so the section never reads as a sum (D60)', () => {
		const responses = computeDamageResponses([
			resistance('Dwarf', 'poison'),
			{ kind: 'resistance', sourceName: 'Rage', damageTypes: ['slashing'], condition: 'while raging' },
			{ kind: 'resistance', sourceName: 'Ring', damageTypes: [], withheldReason: 'not attuned' },
		])
		const breakdown = damageResponseBreakdown(responses)

		expect(breakdown).toHaveLength(3)
		expect(breakdown.every((contribution) => contribution.amount === 0)).toBe(true)
		expect(breakdown[0].note).toBe('applies')
		expect(breakdown[1].note).toBe('not counted: only while raging')
		expect(breakdown[2].note).toBe('not attuned')
	})
})

describe('damageTypeLabel', () => {
	it('capitalises the lowercase strings the data stores', () => {
		expect(damageTypeLabel('fire')).toBe('Fire')
		expect(damageTypeLabel('bludgeoning')).toBe('Bludgeoning')
	})
})
