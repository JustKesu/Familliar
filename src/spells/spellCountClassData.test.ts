import { describe, expect, it } from 'vitest'
import { extractSpellCountClassData } from './spellCountClassData'

const wizard = {
	entryType: 'class',
	name: 'Wizard',
	source: 'XPHB',
	hd: { number: 1, faces: 6 },
	cantripProgression: [3, 3, 3],
	preparedSpellsProgression: [4, 5, 6],
	preparedSpellsChange: 'restLong',
}

const bard = {
	entryType: 'class',
	name: 'Bard',
	source: 'XPHB',
	hd: { number: 1, faces: 8 },
	cantripProgression: [2, 2, 2],
	preparedSpellsProgression: [4, 5, 6],
	preparedSpellsChange: 'level',
}

const paladin = {
	entryType: 'class',
	name: 'Paladin',
	source: 'XPHB',
	hd: { number: 1, faces: 10 },
	preparedSpellsProgression: [2, 3, 4],
	preparedSpellsChange: 'restLong',
}

const fighter = {
	entryType: 'class',
	name: 'Fighter',
	source: 'XPHB',
	hd: { number: 1, faces: 10 },
}

const eldritchKnight = {
	entryType: 'subclass',
	name: 'Eldritch Knight',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
	cantripProgression: [0, 0, 2],
	preparedSpellsProgression: [0, 0, 3],
	preparedSpellsChange: 'level',
}

const champion = {
	entryType: 'subclass',
	name: 'Champion',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
}

const classes = [wizard, bard, paladin, fighter, eldritchKnight, champion]

describe('extractSpellCountClassData', () => {
	it('a "restLong" class (Wizard) is labeled "prepared"', () => {
		const result = extractSpellCountClassData(classes)
		const entry = result.find((c) => c.className === 'Wizard')
		expect(entry?.label).toBe('prepared')
		expect(entry?.cantripProgression).toEqual([3, 3, 3])
		expect(entry?.leveledSpellProgression).toEqual([4, 5, 6])
	})

	it('a "level" class (Bard) is labeled "known"', () => {
		const result = extractSpellCountClassData(classes)
		const entry = result.find((c) => c.className === 'Bard')
		expect(entry?.label).toBe('known')
	})

	it('a class with no cantripProgression field at all (Paladin): cantripProgression is null, not an error', () => {
		const result = extractSpellCountClassData(classes)
		const entry = result.find((c) => c.className === 'Paladin')
		expect(entry?.cantripProgression).toBeNull()
		expect(entry?.leveledSpellProgression).toEqual([2, 3, 4])
	})

	it('a non-caster base class with no preparedSpellsChange field (Fighter): label null', () => {
		const result = extractSpellCountClassData(classes)
		const entry = result.find((c) => c.className === 'Fighter')
		expect(entry?.label).toBeNull()
	})

	it('Eldritch Knight (D46): its own counts are attached under Fighter\'s subclasses, labeled "known"', () => {
		const result = extractSpellCountClassData(classes)
		const fighterEntry = result.find((c) => c.className === 'Fighter')
		expect(fighterEntry?.subclasses).toEqual([
			{ subclassName: 'Eldritch Knight', cantripProgression: [0, 0, 2], leveledSpellProgression: [0, 0, 3], label: 'known' },
		])
	})

	it('a subclass with no preparedSpellsChange at all (Champion) is not attached', () => {
		const result = extractSpellCountClassData(classes)
		const fighterEntry = result.find((c) => c.className === 'Fighter')
		expect(fighterEntry?.subclasses?.some((s) => s.subclassName === 'Champion')).toBe(false)
	})
})
