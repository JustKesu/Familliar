import { screen, within } from '@testing-library/react'

/** W10: Next/Back/Cancel/save exist in the sticky bar and under the step; tests always use the one under the step. */
export function stepNav(): ReturnType<typeof within> {
	return within(screen.getByRole('group', { name: 'Step navigation' }))
}

/** W-4: the class step's Next needs the class skill count (2 in every wizard test's mock). */
export async function chooseClassSkills(user: { click: (element: Element) => Promise<void> }, names = ['Intimidation', 'Perception']): Promise<void> {
	for (const name of names) await user.click(await screen.findByRole('checkbox', { name }))
}

export function stepBar(): ReturnType<typeof within> {
	return within(screen.getByRole('navigation', { name: 'Wizard steps' }))
}
