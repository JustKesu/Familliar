// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SpeciesCantripPicker } from './SpeciesCantripPicker'

const options = [{ name: 'Fire Bolt', source: 'XPHB', classNames: ['Wizard'] }]
const HINT = 'Choose your species cantrip to continue.'

afterEach(cleanup)

describe('SpeciesCantripPicker hint (finding 9)', () => {
	it('shows the hint for a stored cantrip that is not on the list, and hides it for one that is', () => {
		const { rerender } = render(<SpeciesCantripPicker options={options} value={{ name: 'Light', source: 'XPHB' }} onChange={() => {}} alreadyKnown={[]} />)
		expect(screen.queryByText(HINT)).toBeTruthy()
		rerender(<SpeciesCantripPicker options={options} value={{ name: 'Fire Bolt', source: 'XPHB' }} onChange={() => {}} alreadyKnown={[]} />)
		expect(screen.queryByText(HINT)).toBeNull()
	})
})
