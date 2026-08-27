import { describe, expect, it } from 'vitest'
import { chosenSpellUsageFor } from './chosenSpellUsage'

/*
 * The hand table (D21/D70) — one distinct usage shape it produces
 * (`onceFreePerLongRest`), plus the "source establishes nothing → no label"
 * case the task asks for explicitly.
 */

describe('chosenSpellUsageFor', () => {
	it('gives Magic Initiate / Artificer Initiate / Fey-Touched / Shadow-Touched their "once per long rest, no slot" term', () => {
		for (const source of ['Magic Initiate', 'Artificer Initiate', 'Fey-Touched', 'Shadow-Touched']) {
			expect(chosenSpellUsageFor(source)).toEqual({ kind: 'onceFreePerLongRest' })
		}
	})

	it('returns null for a source whose rules text establishes no special term (Pact of the Tome, Ritual Caster)', () => {
		expect(chosenSpellUsageFor('Pact of the Tome')).toBeNull()
		expect(chosenSpellUsageFor('Ritual Caster')).toBeNull()
	})

	it('returns null for a cantrip-only source and for an unknown name', () => {
		expect(chosenSpellUsageFor('Blessed Warrior')).toBeNull()
		expect(chosenSpellUsageFor('Some Future Feat')).toBeNull()
	})
})
