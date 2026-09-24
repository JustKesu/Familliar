// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpeciesSkillOrToolSlot, SubclassSkillSlots } from './SkillChoiceSlots'
import { subclassSkillGrantsFor } from './subclassSkillGrants'

vi.mock('../languages/languageData', () => ({
	loadLanguages: vi.fn(async () => [
		{ name: 'Dwarvish', source: 'XPHB' },
		{ name: 'Elvish', source: 'XPHB' },
	]),
}))

vi.mock('../toolProficiencies/toolProficiencyData', () => ({
	loadToolCategoryOptions: vi.fn(async (category: string) => (category === 'anyGamingSet' ? ['Dice Set'] : category === 'anyOtherTool' ? ["Thieves' Tools"] : [])),
}))

afterEach(cleanup)

const cavalier = subclassSkillGrantsFor([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Cavalier', level: 3 }])
const options = (slot: HTMLElement) => within(slot).getAllByRole('option').map((option) => option.textContent)

describe('SubclassSkillSlots (D177)', () => {
	it('Cavalier: one select offering its skills minus those held, and languages minus those known', async () => {
		render(<SubclassSkillSlots grants={cavalier} skills={[]} languages={[]} heldSkills={['history']} knownLanguages={['Dwarvish']} onChange={vi.fn()} />)
		expect(options(await screen.findByRole('combobox', { name: /Cavalier skill or language/ }))).toEqual(['— not chosen —', 'Animal handling', 'Insight', 'Performance', 'Persuasion', 'Elvish'])
	})

	it('Cavalier: storing a language removes the stored skill, and storing a skill removes the language', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const other = { name: 'Giant', source: 'XPHB', grantedBy: 'mastermind' as const }
		const { rerender } = render(
			<SubclassSkillSlots grants={cavalier} skills={[{ grantedBy: 'cavalier', name: 'history' }]} languages={[other]} heldSkills={[]} knownLanguages={[]} onChange={onChange} />,
		)
		await user.selectOptions(await screen.findByRole('combobox', { name: /Cavalier/ }), 'Elvish')
		expect(onChange).toHaveBeenLastCalledWith([], [other, { name: 'Elvish', source: 'XPHB', grantedBy: 'cavalier' }])

		rerender(
			<SubclassSkillSlots
				grants={cavalier}
				skills={[]}
				languages={[other, { name: 'Elvish', source: 'XPHB', grantedBy: 'cavalier' }]}
				heldSkills={[]}
				knownLanguages={[]}
				onChange={onChange}
			/>,
		)
		await user.selectOptions(screen.getByRole('combobox', { name: /Cavalier/ }), 'Insight')
		expect(onChange).toHaveBeenLastCalledWith([{ grantedBy: 'cavalier', name: 'insight' }], [other])
	})
})

describe('SpeciesSkillOrToolSlot (D177)', () => {
	it('Khoravar: picking a tool clears the skill', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(<SpeciesSkillOrToolSlot owner="Khoravar" skill="arcana" tool={null} heldSkills={['history']} heldTools={["Thieves' Tools"]} onChange={onChange} />)
		const slot = await screen.findByRole('combobox', { name: /Khoravar skill or tool/ })
		expect(options(slot)).not.toContain('History')
		expect(options(slot)).toContain('Dice Set')
		expect(options(slot)).not.toContain("Thieves' Tools")
		await user.selectOptions(slot, 'Dice Set')
		expect(onChange).toHaveBeenLastCalledWith({ skill: null, tool: 'Dice Set' })
	})
})
