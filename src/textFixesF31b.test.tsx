// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { skillLabel } from './calculation/skills'
import { ExpertisePicker } from './expertise/ExpertisePicker'
import { spellNotes } from './sheet/spellsTabData'
import type { SheetSpellEntry } from './sheet/SpellList'
import type { SpellDetail } from './spells/spellDetailData'

vi.mock('./expertise/expertiseData', async () => {
	const actual = await vi.importActual<typeof import('./expertise/expertiseData')>('./expertise/expertiseData')
	return { ...actual, loadExpertiseEligibility: vi.fn(async () => ({ count: 2, restrictedTo: null })) }
})

afterEach(cleanup)

describe('F-31b text fixes', () => {
	it('20/14: skill names get their SKILL_LABELS spelling, other strings a plain capital', () => {
		expect(skillLabel('animal handling')).toBe('Animal Handling')
		expect(skillLabel('sleight of hand')).toBe('Sleight of Hand')
		expect(skillLabel('stealth')).toBe('Stealth')
		expect(skillLabel('thieves')).toBe('Thieves')
	})

	it('12: an empty source never renders "(from )"', async () => {
		render(
			<ExpertisePicker
				className="Rogue"
				classSource="XPHB"
				level={1}
				proficientSkills={[
					{ skill: 'acrobatics', source: '' },
					{ skill: 'animal handling', source: 'Rogue' },
				]}
				value={[]}
				onChange={() => {}}
			/>,
		)
		expect(await screen.findByRole('checkbox', { name: /Animal Handling/ })).toBeTruthy()
		expect(screen.getByRole('checkbox', { name: /Acrobatics/ }).closest('label')?.textContent).toBe('Acrobatics')
		expect(screen.getByRole('checkbox', { name: /Animal Handling/ }).closest('label')?.textContent).toBe('Animal Handling (from Rogue)')
	})

	it('26/40: the no-slot usage note is left out of a CAST row, kept for a USE row', () => {
		const entry = { name: 'Divine Smite', source: 'XPHB', usages: [{ kind: 'onceFreePerLongRest' }] } as unknown as SheetSpellEntry
		const detail = { components: { v: true }, duration: [{ type: 'instant' }] } as unknown as SpellDetail
		expect(spellNotes(entry, detail)).toContain('(no slot)')
		expect(spellNotes(entry, detail, false)).not.toContain('(no slot)')
	})
})
