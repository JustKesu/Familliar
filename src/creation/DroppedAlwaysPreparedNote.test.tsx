// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DroppedAlwaysPreparedNote } from './DroppedAlwaysPreparedNote'

afterEach(cleanup)

describe('DroppedAlwaysPreparedNote', () => {
	it('names the subclass for a subclass grant (D339)', () => {
		const { container } = render(
			<DroppedAlwaysPreparedNote dropped={[{ className: 'Cleric', classSource: 'XPHB', subclassName: 'Life Domain', spellNames: ['Bless', 'Cure Wounds'] }]} />,
		)
		expect(container.textContent).toBe('Bless and Cure Wounds are always prepared by Life Domain and were removed from your picks.')
	})

	it('names the class for a class grant (D340)', () => {
		const { container } = render(<DroppedAlwaysPreparedNote dropped={[{ className: 'Paladin', classSource: 'XPHB', subclassName: null, spellNames: ['Divine Smite'] }]} />)
		expect(container.textContent).toBe('Divine Smite is always prepared by Paladin and was removed from your picks.')
	})
})
