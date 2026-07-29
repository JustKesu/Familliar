// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ResolvedEntries } from './ResolvedEntries'
import type { ResolverData } from './refTypes'

afterEach(cleanup)

const data: ResolverData = {
	classFeatures: [{ name: 'Rage', id: 'cf|rage|barbarian|xphb|1|xphb', entries: ['Reckless fury.'] }],
	subclassFeatures: [],
	optionalFeatures: [],
	feats: [],
}

describe('ResolvedEntries', () => {
	it('renders the original ref badge unchanged (D7)', () => {
		const entries = [{ type: 'refClassFeature', classFeature: 'Rage|Barbarian|XPHB|1|XPHB' }]
		const { container } = render(<ResolvedEntries entries={entries} data={data} />)

		const badge = container.querySelector('[data-ref-uid="Rage|Barbarian|XPHB|1|XPHB"]')
		expect(badge).not.toBeNull()
		expect(badge?.textContent).toBe('Rage')
	})

	it('puts the resolved text in a <details> that starts collapsed', () => {
		const entries = [{ type: 'refClassFeature', classFeature: 'Rage|Barbarian|XPHB|1|XPHB' }]
		const { container } = render(<ResolvedEntries entries={entries} data={data} />)

		const details = container.querySelector('details')
		expect(details).not.toBeNull()
		expect(details?.hasAttribute('open')).toBe(false)
		expect(screen.getByText('Reckless fury.')).toBeTruthy()
	})

	it('expands a nested ref inside the resolved feature too', () => {
		const nestedData: ResolverData = {
			classFeatures: [
				{
					name: 'Channel Divinity',
					id: 'cf|channel divinity|cleric|xphb|2|xphb',
					entries: [{ type: 'refFeat', feat: 'Blessed Warrior|XPHB' }],
				},
			],
			subclassFeatures: [],
			optionalFeatures: [],
			feats: [{ name: 'Blessed Warrior', source: 'XPHB', entries: ['Weapon of the faithful.'] }],
		}
		const entries = [{ type: 'refClassFeature', classFeature: 'Channel Divinity|Cleric|XPHB|2|XPHB' }]
		const { container } = render(<ResolvedEntries entries={entries} data={nestedData} />)

		const detailsBlocks = container.querySelectorAll('details')
		expect(detailsBlocks.length).toBe(2)
		expect(screen.getByText('Weapon of the faithful.')).toBeTruthy()
	})

	it('shows a visible note, not a crash, when the target is missing', () => {
		const entries = [{ type: 'refFeat', feat: 'Nonexistent Feat|XPHB' }]
		render(<ResolvedEntries entries={entries} data={data} />)

		expect(screen.getByText(/nepodařilo dohledat/)).toBeTruthy()
	})
})
