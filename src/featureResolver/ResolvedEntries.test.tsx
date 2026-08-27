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

	// The shape every picker and the sheet render through: a subclass feature
	// referenced with an empty classSource (Hexblade's Curse, Divine Magic, …)
	// used to reach the not-found note here instead of its text.
	it('expands a subclassFeature ref whose classSource segment is empty', () => {
		const shortFormData: ResolverData = {
			...data,
			subclassFeatures: [
				{ name: "Hexblade's Curse", id: "scf|hexblade's curse|warlock|phb|hexblade|xge|3|xge", entries: ['Curse text.'] },
			],
		}
		const entries = [{ type: 'refSubclassFeature', subclassFeature: "Hexblade's Curse|Warlock||Hexblade|XGE|3" }]
		const { container } = render(<ResolvedEntries entries={entries} data={shortFormData} />)

		expect(container.querySelector('details')).not.toBeNull()
		expect(screen.getByText('Curse text.')).toBeTruthy()
		expect(screen.queryByText(/nepodařilo dohledat/)).toBeNull()
	})

	// The short-form uid now defaults its empty segments before looking up; a
	// short form whose target genuinely does not exist must still reach D43's
	// note rather than resolving to something else or rendering nothing.
	it('shows the note for a short-form subclassFeature uid with no target', () => {
		const entries = [{ type: 'refSubclassFeature', subclassFeature: 'Nonexistent|Rogue||Phantom|TCE|3' }]
		render(<ResolvedEntries entries={entries} data={data} />)

		expect(screen.getByText(/nepodařilo dohledat/)).toBeTruthy()
	})
})
