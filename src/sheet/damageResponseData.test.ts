import { describe, expect, it } from 'vitest'
import { buildFeatGrants, buildFeatureGrants, buildItemGrants, buildSpeciesGrants } from './damageResponseData'
import type { ItemRef } from '../inventory/inventoryData'
import { CUSTOM_ITEM_SOURCE, type Character, type CharacterInventoryItem } from '../storage/character'

function character(overrides: Partial<Character> = {}): Character {
	return { id: 'c1', name: 'Test', classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 1 }], ...overrides }
}

const ring: ItemRef = { name: 'Ring of Fire Resistance', source: 'XDMG', requiresAttunement: true, resist: ['fire'] }
const tattoo: ItemRef = { name: 'Acid Absorbing Tattoo', source: 'XDMG', resist: ['acid'] }
const potion: ItemRef = { name: 'Potion of Fire Resistance', source: 'XPHB', typeCode: 'P', resist: ['fire'] }
const periapt: ItemRef = { name: 'Periapt of Proof against Poison', source: 'XDMG', requiresAttunement: true, immune: ['poison'] }
const longsword: ItemRef = { name: 'Longsword', source: 'XPHB', weapon: true, typeCode: 'M' }

function row(name: string, source: string, extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem {
	return { name, source, quantity: 1, ...extra }
}

describe('buildItemGrants', () => {
	it('withholds a resistance from an item that requires attunement and is not attuned', () => {
		const grants = buildItemGrants([row('Ring of Fire Resistance', 'XDMG')], [ring])

		expect(grants).toHaveLength(1)
		expect(grants[0].damageTypes).toEqual([])
		expect(grants[0].withheldReason).toBe('requires attunement and you are not attuned to it')
	})

	it('grants it once the item is attuned', () => {
		const grants = buildItemGrants([row('Ring of Fire Resistance', 'XDMG', { attuned: true })], [ring])

		expect(grants).toEqual([{ kind: 'resistance', sourceName: 'Ring of Fire Resistance', damageTypes: ['fire'] }])
	})

	it('grants an item that needs no attunement while it is merely carried', () => {
		const grants = buildItemGrants([row('Acid Absorbing Tattoo', 'XDMG')], [tattoo])

		expect(grants).toEqual([{ kind: 'resistance', sourceName: 'Acid Absorbing Tattoo', damageTypes: ['acid'] }])
	})

	it('withholds a carried consumable’s resistance, with a reason pointing at step 9 (slice f-fix)', () => {
		const grants = buildItemGrants([row('Potion of Fire Resistance', 'XPHB')], [potion])

		expect(grants).toHaveLength(1)
		expect(grants[0].damageTypes).toEqual([])
		expect(grants[0].withheldReason).toBe('applies only while the item is used, and using items arrives in step 9')
	})

	// A consumable that requires attunement would prove the two gates are
	// independent, but scripts/investigate-consumable-resist.js found none in the
	// data (0 of 81 P/SC/FD items carry reqAttune), so there is no fixture for it.

	it('gates a consumable out even where its type code is the only signal, never the name (D21)', () => {
		const oddlyNamed: ItemRef = { name: 'Draught of the Salamander', source: 'HB', typeCode: 'P', resist: ['fire'] }
		const grants = buildItemGrants([row('Draught of the Salamander', 'HB')], [oddlyNamed])

		expect(grants[0].withheldReason).toContain('using items arrives in step 9')
	})

	it('reads the immune field as an immunity', () => {
		const grants = buildItemGrants([row('Periapt of Proof against Poison', 'XDMG', { attuned: true })], [periapt])

		expect(grants).toEqual([{ kind: 'immunity', sourceName: 'Periapt of Proof against Poison', damageTypes: ['poison'] }])
	})

	it('ignores an item that grants nothing', () => {
		expect(buildItemGrants([row('Longsword', 'XPHB')], [longsword])).toEqual([])
	})

	/* Slice e2b: a custom item declares resist/immune in the same shape, so the attunement gate applies to it unchanged. */
	describe('a custom item', () => {
		const bandOfAsh: CharacterInventoryItem = {
			name: 'Band of Ash',
			source: CUSTOM_ITEM_SOURCE,
			quantity: 1,
			custom: { name: 'Band of Ash', kind: 'worn', requiresAttunement: true, resist: ['fire'], immune: ['poison'] },
		}

		it('withholds its resistance while it is not attuned', () => {
			const grants = buildItemGrants([bandOfAsh], [])
			expect(grants).toHaveLength(1)
			expect(grants[0].damageTypes).toEqual([])
			expect(grants[0].withheldReason).toBe('requires attunement and you are not attuned to it')
		})

		it('grants it once attuned, resistance and immunity alike', () => {
			expect(buildItemGrants([{ ...bandOfAsh, attuned: true }], [])).toEqual([
				{ kind: 'resistance', sourceName: 'Band of Ash', damageTypes: ['fire'] },
				{ kind: 'immunity', sourceName: 'Band of Ash', damageTypes: ['poison'] },
			])
		})

		it('grants it while merely carried when it requires no attunement', () => {
			const ungated: CharacterInventoryItem = { ...bandOfAsh, custom: { name: 'Band of Ash', kind: 'worn', resist: ['fire'] } }
			expect(buildItemGrants([ungated], [])).toEqual([{ kind: 'resistance', sourceName: 'Band of Ash', damageTypes: ['fire'] }])
		})
	})

	it('names an unresolvable row with the problem stated (D43)', () => {
		const grants = buildItemGrants([row('Homebrew Cloak', 'HB')], [ring])

		expect(grants).toHaveLength(1)
		expect(grants[0].sourceName).toBe('Homebrew Cloak')
		expect(grants[0].unresolvedReason).toContain('not found in the item data')
	})

	it('shows a player-set magic bonus in the source name, so one item is not called two things (slice e)', () => {
		const grants = buildItemGrants([row('Acid Absorbing Tattoo', 'XDMG', { magicBonus: 1 })], [tattoo])

		expect(grants[0].sourceName).toBe('Acid Absorbing Tattoo +1')
	})
})

describe('buildSpeciesGrants', () => {
	const species = [
		{ name: 'Dwarf', source: 'XPHB', resist: ['poison'] },
		{ name: 'Dragonborn', source: 'XPHB', resist: [{ choose: { from: ['acid', 'fire'] } }] },
		{ name: 'Dragonborn (Red)', source: 'XPHB', resist: ['fire'] },
		{ name: 'Human', source: 'XPHB' },
	]

	it('reads a plain species resistance', () => {
		const grants = buildSpeciesGrants(character({ species: { name: 'Dwarf', source: 'XPHB' } }), species)

		expect(grants).toEqual([{ kind: 'resistance', sourceName: 'Dwarf', damageTypes: ['poison'] }])
	})

	it('turns the bare Dragonborn entry into an unmade choice rather than granting all of it', () => {
		const grants = buildSpeciesGrants(character({ species: { name: 'Dragonborn', source: 'XPHB' } }), species)

		expect(grants).toHaveLength(1)
		expect(grants[0].damageTypes).toEqual([])
		expect(grants[0].choiceFrom).toEqual(['acid', 'fire'])
	})

	it('resolves a concrete ancestry to its own damage type', () => {
		const grants = buildSpeciesGrants(character({ species: { name: 'Dragonborn (Red)', source: 'XPHB' } }), species)

		expect(grants).toEqual([{ kind: 'resistance', sourceName: 'Dragonborn (Red)', damageTypes: ['fire'] }])
	})

	it('grants nothing for a species that carries no field, and nothing at all without a species', () => {
		expect(buildSpeciesGrants(character({ species: { name: 'Human', source: 'XPHB' } }), species)).toEqual([])
		expect(buildSpeciesGrants(character(), species)).toEqual([])
	})

	it('names a species missing from the data (D43)', () => {
		const grants = buildSpeciesGrants(character({ species: { name: 'Gnome', source: 'XPHB' } }), species)

		expect(grants[0].unresolvedReason).toContain('no species data')
	})
})

describe('buildFeatGrants', () => {
	const feats = [{ name: 'Boon of Energy Resistance', source: 'XPHB', resist: [{ choose: { from: ['acid', 'cold'] } }] }]

	it('reads a chosen feat as an unmade choice when the data offers one', () => {
		const chooser = character({ featAsiChoices: [{ level: 19, kind: 'feat', name: 'Boon of Energy Resistance', source: 'XPHB' }] })
		const grants = buildFeatGrants(chooser, feats)

		expect(grants[0].choiceFrom).toEqual(['acid', 'cold'])
	})

	it('ignores an ASI pick and a character with no feats', () => {
		expect(buildFeatGrants(character({ featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] }), feats)).toEqual([])
		expect(buildFeatGrants(character(), feats)).toEqual([])
	})
})

describe('buildFeatureGrants', () => {
	it('turns Rage into a conditional grant naming its condition', () => {
		const grants = buildFeatureGrants(['Rage'])

		expect(grants).toHaveLength(1)
		expect(grants[0]).toMatchObject({ kind: 'resistance', damageTypes: ['bludgeoning', 'piercing', 'slashing'], condition: 'while your Rage is active' })
		expect(grants[0].sourceName).toBe('Rage (Barbarian)')
	})

	it('turns an unconditional feature into a grant with no condition', () => {
		const grants = buildFeatureGrants(['Oceanic Soul'])

		expect(grants[0].damageTypes).toEqual(['cold'])
		expect(grants[0].condition).toBeUndefined()
	})

	it('grants nothing for a feature the table does not record', () => {
		expect(buildFeatureGrants(['Second Wind', 'Nature’s Ward'])).toEqual([])
	})
})
