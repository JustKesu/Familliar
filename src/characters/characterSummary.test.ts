import { describe, expect, it } from 'vitest'
import { characterSummary } from './characterSummary'

const fighter = { className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }
const wizard = { className: 'Wizard', classSource: 'XPHB', subclass: null, level: 2 }

describe('characterSummary', () => {
	it('joins species and class', () => {
		expect(characterSummary({ species: { name: 'Elf', source: 'XPHB' }, classes: [fighter] })).toBe('Elf · Fighter 3')
	})

	it('joins several classes with " / "', () => {
		expect(characterSummary({ species: { name: 'Elf', source: 'XPHB' }, classes: [fighter, wizard] })).toBe('Elf · Fighter 3 / Wizard 2')
	})

	it('drops the species when there is none', () => {
		expect(characterSummary({ classes: [wizard] })).toBe('Wizard 2')
	})

	it('says so when there is no class', () => {
		expect(characterSummary({ classes: [] })).toBe('No class yet')
	})
})
