import { describe, expect, it } from 'vitest'
import { flatBonusContributions, flatBonusesByTarget, type ItemFlatBonusGrant } from './itemFlatBonuses'

const cloakAc: ItemFlatBonusGrant = { sourceName: 'Cloak of Protection', target: 'armourClass', amount: 1 }
const cloakSave: ItemFlatBonusGrant = { sourceName: 'Cloak of Protection', target: 'savingThrow', amount: 1 }
const ringSave: ItemFlatBonusGrant = { sourceName: 'Ring of Protection', target: 'savingThrow', amount: 1 }

describe('flatBonusContributions', () => {
	it('returns only the grants aimed at the asked-for value, each as its own named line', () => {
		expect(flatBonusContributions('savingThrow', [cloakAc, cloakSave, ringSave])).toEqual([
			{ source: 'Cloak of Protection', amount: 1 },
			{ source: 'Ring of Protection', amount: 1 },
		])
	})

	it('turns a withheld grant into a zero-amount note naming what it would have given (D76)', () => {
		const withheld: ItemFlatBonusGrant = { ...cloakSave, withheldReason: 'requires attunement and you are not attuned to it' }

		expect(flatBonusContributions('savingThrow', [withheld])).toEqual([
			{
				source: 'Cloak of Protection',
				amount: 0,
				note: 'considered (+1) — not applied: requires attunement and you are not attuned to it',
			},
		])
	})

	it('states an unresolvable row rather than dropping it (D43)', () => {
		const unresolved: ItemFlatBonusGrant = { sourceName: 'Homebrew Amulet', target: 'spellAttack', amount: 0, unresolvedReason: 'attuned but not found in the item data (HB)' }

		expect(flatBonusContributions('spellAttack', [unresolved])).toEqual([{ source: 'Homebrew Amulet', amount: 0, note: 'attuned but not found in the item data (HB)' }])
	})

	it('never lets a proficiency bonus grant reach the number, and says why', () => {
		const ioun: ItemFlatBonusGrant = { sourceName: 'Ioun Stone, Mastery', target: 'proficiencyBonus', amount: 1 }
		const [line] = flatBonusContributions('proficiencyBonus', [ioun])

		expect(line.amount).toBe(0)
		expect(line.note).toContain('considered (+1) — not applied:')
		expect(line.note).toContain('would have to be re-routed')
	})
})

describe('flatBonusesByTarget', () => {
	it('splits one item that carries two bonuses across both values', () => {
		const byTarget = flatBonusesByTarget([cloakAc, cloakSave])

		expect(byTarget.armourClass).toEqual([{ source: 'Cloak of Protection', amount: 1 }])
		expect(byTarget.savingThrow).toEqual([{ source: 'Cloak of Protection', amount: 1 }])
		expect(byTarget.spellAttack).toEqual([])
		expect(byTarget.abilityCheck).toEqual([])
	})
})
