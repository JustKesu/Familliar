import { describe, expect, it } from 'vitest'
import { extractSubclassAlwaysPreparedSpells } from './subclassPreparedSpells'

const forgeDomain = {
	entryType: 'subclass',
	name: 'Forge Domain',
	source: 'XPHB',
	className: 'Cleric',
	classSource: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'3': ['identify', 'searing smite|xphb'],
				'5': ['heat metal', 'magic weapon'],
			},
		},
	],
}

const knownOnlySubclass = {
	entryType: 'subclass',
	name: 'Fiend',
	source: 'XPHB',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{
			known: {
				'1': ['burning hands'],
			},
		},
	],
}

const noAdditionalSpells = {
	entryType: 'subclass',
	name: 'Champion',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
	additionalSpells: undefined,
}

const collegeOfLore = {
	entryType: 'subclass',
	name: 'College of Lore',
	source: 'XPHB',
	className: 'Bard',
	classSource: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'6': [{ choose: 'level=0;1;2;3|class=Cleric;Druid;Wizard' }],
			},
		},
	],
}

const classes = [forgeDomain, knownOnlySubclass, noAdditionalSpells, collegeOfLore]

const identify = { name: 'Identify', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const searingSmite = { name: 'Searing Smite', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const heatMetal = {
	name: 'Heat Metal',
	source: 'XPHB',
	level: 2,
	duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
	meta: {},
}
const magicWeapon = { name: 'Magic Weapon', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }
const burningHands = { name: 'Burning Hands', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }

const spells = [identify, searingSmite, heatMetal, magicWeapon, burningHands]

describe('extractSubclassAlwaysPreparedSpells', () => {
	it('returns the always-prepared spells granted at or below the given level, marked as subclass-sourced', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 3)
		expect(result.map((s) => s.name).sort()).toEqual(['Identify', 'Searing Smite'])
		expect(result.every((s) => s.origin === 'subclass')).toBe(true)
	})

	it('level gating: a spell granted at a higher subclass level is not returned below that level', () => {
		const belowGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 4)
		expect(belowGrant.map((s) => s.name)).not.toContain('Heat Metal')

		const atGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 5)
		expect(atGrant.map((s) => s.name).sort()).toEqual(['Heat Metal', 'Identify', 'Magic Weapon', 'Searing Smite'])
	})

	it('carries the granting class level and resolves a "name|source" reference', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 3)
		const searing = result.find((s) => s.name === 'Searing Smite')
		expect(searing?.grantedAtLevel).toBe(3)
		expect(searing?.source).toBe('XPHB')
	})

	it('carries concentration and ritual flags through', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 5)
		expect(result.find((s) => s.name === 'Heat Metal')?.concentration).toBe(true)
		expect(result.find((s) => s.name === 'Identify')?.concentration).toBe(false)
	})

	it('a subclass whose additionalSpells uses only a non-`prepared` shape returns nothing (D62 deferral)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Fiend', 'XPHB', 'Warlock', 'XPHB', 5)
		expect(result).toEqual([])
	})

	it('a subclass with no additionalSpells at all returns nothing, cleanly', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Champion', 'XPHB', 'Fighter', 'XPHB', 5)
		expect(result).toEqual([])
	})

	it('a nested choice inside `prepared` (Bard College of Lore) is skipped cleanly, not invented', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'College of Lore', 'XPHB', 'Bard', 'XPHB', 10)
		expect(result).toEqual([])
	})

	it('an unresolvable subclass identity returns nothing, cleanly', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Nonexistent', 'XPHB', 'Cleric', 'XPHB', 5)
		expect(result).toEqual([])
	})
})
