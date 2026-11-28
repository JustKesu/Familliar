import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Character } from '../storage/character'
import { CharacterStore, type KeyValueStorage } from '../storage/characterStore'
import { crTitle, estimateCr, extractCrStatistics, loadNpcCr, loadNpcOffence } from './npcCr'
import { loadNpcStats } from './npcStats'

class MemoryStorage implements KeyValueStorage {
	private data = new Map<string, string>()
	getItem(key: string): string | null {
		return this.data.get(key) ?? null
	}
	setItem(key: string, value: string): void {
		this.data.set(key, value)
	}
	removeItem(key: string): void {
		this.data.delete(key)
	}
}

/* data/cr-statistics.json rows used below: 0 hp 1-6 dpr 0-1; 1/8 ac 13 hp 7-35 atk 3 dpr 2-3; 1/4 ac 13 hp 36-49 dpr 4-5;
   1 ac 13 hp 71-85 atk 3 dpr 9-14 dc 13; 2 ac 13 hp 86-100 atk 3 dpr 15-20 dc 13; 3 hp 101-115; 30 hp 805-850. */
const rows = extractCrStatistics(JSON.parse(readFileSync(join(process.cwd(), 'data/cr-statistics.json'), 'utf8')))

function seed(classes: Character['classes'], scores: Record<string, number>, extra: Record<string, unknown> = {}): Character {
	const store = new CharacterStore(new MemoryStorage())
	const created = store.create({ name: 'N', classes, abilityScores: { method: 'standardArray', scores }, ...extra } as Parameters<CharacterStore['create']>[0])
	return store.list().find((c) => c.id === created.id)!
}

beforeAll(() => {
	vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(join(process.cwd(), url.replace(/^\//, '')), 'utf8')))
})

describe('estimateCr (DMG 2014, D439)', () => {
	it('reads 34 rows', () => {
		expect(rows).toHaveLength(34)
		expect(rows[1]).toMatchObject({ cr: '1/8', crNumber: 0.125, ac: 13, hpMin: 7, hpMax: 35, attackBonus: 3, dprMin: 2, dprMax: 3, saveDc: 13 })
	})

	it('AC 1 below the row moves nothing; 2 above moves one step', () => {
		expect(estimateCr(rows, 25, 12, { dpr: 3, bonus: 4, kind: 'attack' })).toEqual({ cr: '1/8', defence: '1/8', offence: '1/8' })
		// HP 39 → 1/4 (AC 13); AC 17 is +4 → two steps → CR 1.
		expect(estimateCr(rows, 39, 17, { dpr: 3, bonus: 3, kind: 'attack' })?.defence).toBe('1')
	})

	it('averages defence and offence and rounds to the nearest CR', () => {
		// Defence 1/4; DPR 18 → CR 2 (atk 3), +5 is +2 → CR 3; (0.25 + 3) / 2 = 1.625 → 2.
		expect(estimateCr(rows, 39, 12, { dpr: 18, bonus: 5, kind: 'attack' })).toEqual({ cr: '2', defence: '1/4', offence: '3' })
		// 1/8 and 1/4 average to 0.1875, equally near both: rounds up.
		expect(estimateCr(rows, 25, 13, { dpr: 4, bonus: 3, kind: 'attack' })?.cr).toBe('1/4')
	})

	it('a save cantrip compares its DC with the row save DC', () => {
		// DPR 11 → CR 1 (DC 13); DC 15 is +2 → CR 2.
		expect(estimateCr(rows, 25, 12, { dpr: 11, bonus: 15, kind: 'save' })?.offence).toBe('2')
		// The same +15 as an attack bonus is +12 over atk 3 → six steps from CR 1 → CR 7.
		expect(estimateCr(rows, 25, 12, { dpr: 11, bonus: 15, kind: 'attack' })?.offence).toBe('7')
	})

	it('fractional DPR counts in the lower row; values outside the table clamp', () => {
		expect(estimateCr(rows, 25, 13, { dpr: 3.5, bonus: 3, kind: 'attack' })?.offence).toBe('1/8')
		expect(estimateCr(rows, 2000, 40, { dpr: 900, bonus: 30, kind: 'attack' })).toEqual({ cr: '30', defence: '30', offence: '30' })
		expect(estimateCr(rows, 0, 0, { dpr: 0, bonus: -10, kind: 'attack' })).toEqual({ cr: '0', defence: '0', offence: '0' })
	})

	it('nothing without max HP, AC or an offence', () => {
		expect(estimateCr(rows, null, 12, { dpr: 3, bonus: 4, kind: 'attack' })).toBeNull()
		expect(estimateCr(rows, 25, null, { dpr: 3, bonus: 4, kind: 'attack' })).toBeNull()
		expect(estimateCr(rows, 25, 12, null)).toBeNull()
	})

	it('tooltip text', () => {
		expect(crTitle({ cr: '1', defence: '1/8', offence: '2' })).toBe('Estimate (DMG 2014 method): defence CR 1/8, offence CR 2. Spells of level 1+ and other features are not counted.')
	})
})

describe('NPC numbers for the estimate from the sheet calculations (D439)', () => {
	it('Fighter 5 with a held Greatsword: 2d6 + 2 = 9 × 2 attacks, +5 to hit; HP 39, AC 12 → CR 2', async () => {
		const fighter = seed([{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }], { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 }, {
			inventory: [{ name: 'Greatsword', source: 'XPHB', quantity: 1, equipped: 'held' }],
		})
		expect(await loadNpcOffence(fighter)).toEqual({ dpr: 18, bonus: 5, kind: 'attack' })
		const stats = await loadNpcStats(fighter)
		expect([stats.maxHp, stats.ac]).toEqual([39, 12])
		expect(await loadNpcCr(fighter)).toEqual({ cr: '2', defence: '1/4', offence: '3' })
	}, 30000)

	it('H: Thirsting Blade doubles only the weapon marked as the pact weapon', async () => {
		const scores = { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 }
		const invocations = { optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Blade', source: 'XPHB' }, { name: 'Thirsting Blade', source: 'XPHB' }] }] }
		const warlock = (pactWeapon: boolean) =>
			seed([{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }], scores, {
				...invocations,
				inventory: [{ name: 'Greatsword', source: 'XPHB', quantity: 1, equipped: 'held', ...(pactWeapon ? { pactWeapon: true } : {}) }],
			})
		// Greatsword 2d6 + 2 (STR) = 9; marked: proficient (+2 STR +3 PB) and two attacks; unmarked: not proficient, one attack.
		expect(await loadNpcOffence(warlock(true))).toEqual({ dpr: 18, bonus: 5, kind: 'attack' })
		expect(await loadNpcOffence(warlock(false))).toEqual({ dpr: 9, bonus: 2, kind: 'attack' })
	}, 30000)

	it('Wizard 5 with Fire Bolt: 2d10 = 11, spell attack +5 beats the 0-damage Unarmed Strike; HP 27, AC 12 → CR 1', async () => {
		const wizard = seed([{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 5 }], { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }, {
			spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Fire Bolt', source: 'XPHB' }] }],
		})
		expect(await loadNpcOffence(wizard)).toEqual({ dpr: 11, bonus: 5, kind: 'attack' })
		const stats = await loadNpcStats(wizard)
		expect([stats.maxHp, stats.ac]).toEqual([27, 12])
		expect(await loadNpcCr(wizard)).toEqual({ cr: '1', defence: '1/8', offence: '2' })
	}, 30000)
})
