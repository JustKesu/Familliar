// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpellPicker } from './SpellPicker'
import type { ClassSpellListSpell } from './classSpellListData'
import type { SpellSlotsEntry } from '../calculation/spellSlots'

/*
 * Component test for the class spell picker (build order step 6, slice d2).
 * The class spell list loader is stubbed — data/ is never read into context
 * or loaded in tests directly (CLAUDE.md).
 */

function spell(name: string, level: number, extra: Partial<ClassSpellListSpell> = {}): ClassSpellListSpell {
	return { name, source: 'XPHB', level, ritual: false, concentration: false, viaVariant: false, ...extra }
}

const wizardList: ClassSpellListSpell[] = [
	spell('Prestidigitation', 0),
	spell('Fire Bolt', 0),
	spell('Magic Missile', 1),
	spell('Find Familiar', 1, { ritual: true }),
	spell('Misty Step', 2),
	spell('Fireball', 3),
	spell('Chromatic Orb', 1, { viaVariant: true }),
]

/** Mark of Detection's `expanded` spells (D46) — distinct names from wizardList so a test can tell which pool a spell came from. Magic Missile overlaps Wizard's own list (de-dup case). */
const markOfDetectionExpanded: ClassSpellListSpell[] = [spell('Detect Evil and Good', 1), spell('Identify', 1), spell('Magic Missile', 1)]

vi.mock('./classSpellListData', async () => {
	const actual = await vi.importActual<typeof import('./classSpellListData')>('./classSpellListData')
	return {
		...actual,
		loadClassSpellList: vi.fn(async (className: string) => {
			if (className === 'Wizard') return wizardList
			return []
		}),
		loadFeatExpandedSpellList: vi.fn(async (featName: string) => {
			if (featName === 'Mark of Detection') return markOfDetectionExpanded
			return []
		}),
	}
})

afterEach(cleanup)

const fullSlots: SpellSlotsEntry = { className: 'Wizard', classSource: 'XPHB', ordinarySlots: [4, 3, 2, 0, 0, 0, 0, 0, 0] }

describe('SpellPicker', () => {
	it('offers cantrips and leveled spells up to the slot cap, grouped, with counts enforced separately', async () => {
		render(
			<SpellPicker
				className="Wizard"
				classSource="XPHB"
				spellSlots={fullSlots}
				cantripCount={2}
				leveledSpellCount={3}
				label="prepared"
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByLabelText(/Prestidigitation/)).toBeTruthy()
		expect(screen.getByLabelText(/Fire Bolt/)).toBeTruthy()
		expect(screen.getByLabelText(/Magic Missile/)).toBeTruthy()
		expect(screen.getByLabelText(/Misty Step/)).toBeTruthy()
		expect(screen.getByLabelText(/Fireball/)).toBeTruthy()
		expect(screen.getByText('0 of 2 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 3 spells prepared chosen.')).toBeTruthy()
	})

	it('flags ritual, concentration and variant-sourced spells without hiding them', async () => {
		render(
			<SpellPicker
				className="Wizard"
				classSource="XPHB"
				spellSlots={fullSlots}
				cantripCount={2}
				leveledSpellCount={3}
				label="prepared"
				value={[]}
				onChange={() => {}}
			/>,
		)

		const ritualLabel = (await screen.findByLabelText(/Find Familiar/)).closest('label')
		expect(ritualLabel?.textContent).toContain('ritual')

		const variantCheckbox = screen.getByLabelText(/Chromatic Orb/)
		expect(variantCheckbox).toBeTruthy()
		expect((variantCheckbox as HTMLInputElement).disabled).toBe(false)
		expect(variantCheckbox.closest('label')?.textContent).toContain('variant')
	})

	it('cannot select more cantrips than the count allows, while leveled spells remain untouched', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<SpellPicker
				className="Wizard"
				classSource="XPHB"
				spellSlots={fullSlots}
				cantripCount={1}
				leveledSpellCount={3}
				label="prepared"
				value={[{ name: 'Prestidigitation', source: 'XPHB', level: 0 }]}
				onChange={onChange}
			/>,
		)

		const fireBolt = (await screen.findByLabelText(/Fire Bolt/)) as HTMLInputElement
		expect(fireBolt.disabled).toBe(true)
		await user.click(fireBolt)
		expect(onChange).not.toHaveBeenCalled()

		const magicMissile = screen.getByLabelText(/Magic Missile/) as HTMLInputElement
		expect(magicMissile.disabled).toBe(false)
	})

	it('cannot select more leveled spells than the count allows, cantrips and leveled counted separately', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<SpellPicker
				className="Wizard"
				classSource="XPHB"
				spellSlots={fullSlots}
				cantripCount={2}
				leveledSpellCount={1}
				label="prepared"
				value={[{ name: 'Magic Missile', source: 'XPHB', level: 1 }]}
				onChange={onChange}
			/>,
		)

		const fireball = (await screen.findByLabelText(/Fireball/)) as HTMLInputElement
		expect(fireball.disabled).toBe(true)
		await user.click(fireball)
		expect(onChange).not.toHaveBeenCalled()

		const fireBolt = screen.getByLabelText(/Fire Bolt/) as HTMLInputElement
		expect(fireBolt.disabled).toBe(false)
		await user.click(fireBolt)
		expect(onChange).toHaveBeenCalledWith([
			{ name: 'Magic Missile', source: 'XPHB', level: 1 },
			{ name: 'Fire Bolt', source: 'XPHB', level: 0 },
		])
	})

	it('toggling an already-chosen spell removes it', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<SpellPicker
				className="Wizard"
				classSource="XPHB"
				spellSlots={fullSlots}
				cantripCount={2}
				leveledSpellCount={3}
				label="prepared"
				value={[{ name: 'Magic Missile', source: 'XPHB', level: 1 }]}
				onChange={onChange}
			/>,
		)

		await user.click(await screen.findByLabelText(/Magic Missile/))
		expect(onChange).toHaveBeenCalledWith([])
	})

	it('labels leveled spells "known" or "prepared" per the label prop, and hides the cantrip section when cantripCount is 0', async () => {
		render(
			<SpellPicker
				className="Wizard"
				classSource="XPHB"
				spellSlots={fullSlots}
				cantripCount={0}
				leveledSpellCount={2}
				label="known"
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByText('0 of 2 spells known chosen.')).toBeTruthy()
		expect(screen.queryByLabelText(/Prestidigitation/)).toBeNull()
	})

	describe('featChoices (D46, the 12 marks\' `expanded` pool-widening)', () => {
		it("unions a taken feat's `expanded` spells into the pool alongside the class list, de-duping an overlap", async () => {
			render(
				<SpellPicker
					className="Wizard"
					classSource="XPHB"
					featChoices={[{ name: 'Mark of Detection', source: 'EFA' }]}
					spellSlots={fullSlots}
					cantripCount={2}
					leveledSpellCount={4}
					label="prepared"
					value={[]}
					onChange={() => {}}
				/>,
			)

			expect(await screen.findByLabelText(/Detect Evil and Good/)).toBeTruthy()
			expect(screen.getByLabelText(/Identify/)).toBeTruthy()
			// Magic Missile is on BOTH the Wizard list and the mark's expanded list — appears once.
			expect(screen.getAllByLabelText(/^Magic Missile/)).toHaveLength(1)
			// The Wizard list itself is still offered, unaffected.
			expect(screen.getByLabelText(/Fireball/)).toBeTruthy()
		})

		it('a feat with no `expanded` spells contributes nothing, and offering none at all does not crash the picker', async () => {
			render(
				<SpellPicker
					className="Wizard"
					classSource="XPHB"
					featChoices={[{ name: 'Tough', source: 'XPHB' }]}
					spellSlots={fullSlots}
					cantripCount={2}
					leveledSpellCount={3}
					label="prepared"
					value={[]}
					onChange={() => {}}
				/>,
			)

			expect(await screen.findByLabelText(/Fireball/)).toBeTruthy()
			expect(screen.queryByLabelText(/Detect Evil and Good/)).toBeNull()
		})

		it('a chosen mark-expanded spell can be selected and reported upward like any other pool spell', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()
			render(
				<SpellPicker
					className="Wizard"
					classSource="XPHB"
					featChoices={[{ name: 'Mark of Detection', source: 'EFA' }]}
					spellSlots={fullSlots}
					cantripCount={2}
					leveledSpellCount={1}
					label="prepared"
					value={[]}
					onChange={onChange}
				/>,
			)

			await user.click(await screen.findByLabelText(/Detect Evil and Good/))
			expect(onChange).toHaveBeenCalledWith([{ name: 'Detect Evil and Good', source: 'XPHB', level: 1 }])
		})
	})
})
