import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { buildFeatureReachTest } from './featureReach'

const parsedClasses: unknown[] = [
	{ entryType: 'subclass', name: 'Oath of Conquest', shortName: 'Conquest', source: 'XGE', className: 'Paladin', classSource: 'XPHB' },
	{ entryType: 'subclass', name: 'Oath of Devotion', shortName: 'Devotion', source: 'XPHB', className: 'Paladin', classSource: 'XPHB' },
]

const paladin: Character = { id: '1', name: 'Ser', classes: [{ className: 'Paladin', classSource: 'XPHB', subclass: 'Oath of Conquest', level: 3 }] }
const conquest = { className: 'Paladin', classSource: 'PHB', subclassShortName: 'Conquest', subclassSource: 'XGE' }

describe('buildFeatureReachTest (D343)', () => {
	const reached = buildFeatureReachTest(paladin, parsedClasses)

	it('reaches a PHB-filed record of the XPHB class’s older subclass', () => {
		expect(reached({ ...conquest, level: 3 })).toBe(true)
	})

	it('keeps class records strict on classSource', () => {
		expect(reached({ className: 'Paladin', classSource: 'PHB', level: 1 })).toBe(false)
		expect(reached({ className: 'Paladin', classSource: 'XPHB', level: 1 })).toBe(true)
	})

	it('does not reach another subclass’s record', () => {
		expect(reached({ className: 'Paladin', classSource: 'XPHB', subclassShortName: 'Devotion', subclassSource: 'XPHB', level: 3 })).toBe(false)
	})

	it('does not reach a record above the class level', () => {
		expect(reached({ ...conquest, level: 7 })).toBe(false)
	})
})
