import { screen, within } from '@testing-library/react'

/** W10: Next/Back/Cancel/save exist in the sticky bar and under the step; tests always use the one under the step. */
export function stepNav(): ReturnType<typeof within> {
	return within(screen.getByRole('group', { name: 'Step navigation' }))
}

export function stepBar(): ReturnType<typeof within> {
	return within(screen.getByRole('navigation', { name: 'Wizard steps' }))
}
