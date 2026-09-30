import { screen } from '@testing-library/react'

/* W5: the CHOOSE / CHOSEN buttons of ChoiceRow, whose accessible name is always "Choose <name>" and whose state is aria-pressed. */

export const chooseButtons = (): HTMLButtonElement[] => screen.getAllByRole('button', { name: /^Choose / }) as HTMLButtonElement[]

export const chooseButton = (name: string | RegExp): HTMLButtonElement =>
	screen.getByRole('button', { name: typeof name === 'string' ? `Choose ${name}` : new RegExp(`^Choose ${name.source}`) }) as HTMLButtonElement

export const queryChooseButton = (name: string | RegExp): HTMLButtonElement | null =>
	screen.queryByRole('button', { name: typeof name === 'string' ? `Choose ${name}` : new RegExp(`^Choose ${name.source}`) }) as HTMLButtonElement | null

/** Names of every offered row, in order. */
export const chooseNames = (): string[] => chooseButtons().map((button) => (button.getAttribute('aria-label') ?? '').replace(/^Choose /, ''))

export const isChosen = (button: HTMLElement): boolean => button.getAttribute('aria-pressed') === 'true'
