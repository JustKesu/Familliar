// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BeastStatBlock } from './BeastStatBlock'
import type { Beast } from '../beasts/beastData'

afterEach(cleanup)

function beast(overrides: Partial<Beast> = {}): Beast {
	return {
		name: 'Owl',
		source: 'XMM',
		size: ['T'],
		type: 'beast',
		cr: '0',
		crNumber: 0,
		ac: [11],
		hp: { average: 1, formula: '1d4 - 1' },
		speed: { walk: 5, fly: 60 },
		str: 3,
		dex: 13,
		con: 8,
		int: 2,
		wis: 12,
		cha: 7,
		skill: { perception: '+5', stealth: '+5' },
		senses: ['Darkvision 120 ft.'],
		passive: 15,
		trait: [{ name: 'Flyby', entries: ["The owl doesn't provoke an {@action Opportunity Attack|XPHB} when it flies out of an enemy's reach."] }],
		action: [{ name: 'Talons', entries: ['{@atkr m} {@hit 3}, reach 5 ft. {@h} 1 Slashing damage.'] }],
		...overrides,
	}
}

describe('BeastStatBlock', () => {
	it('renders the identity line, defences and every ability with its modifier', () => {
		const { container } = render(<BeastStatBlock beast={beast()} />)

		expect(screen.getByText(/Owl — Tiny Beast, CR 0/)).toBeTruthy()

		const text = container.textContent ?? ''
		expect(text).toContain('11') // AC
		expect(text).toContain('1 (1d4 - 1)') // HP average and formula
		expect(text).toContain('5 ft., fly 60 ft.') // walk unlabelled, other modes named

		// Modifiers come from the calculation layer's own rule, not a second copy.
		expect(text).toContain('STR 3 (-4)')
		expect(text).toContain('DEX 13 (+1)')
		expect(text).toContain('CHA 7 (-2)')
	})

	it('renders skills, senses and passive Perception', () => {
		const { container } = render(<BeastStatBlock beast={beast()} />)
		const text = container.textContent ?? ''
		expect(text).toContain('Perception +5')
		expect(text).toContain('Stealth +5')
		expect(text).toContain('Darkvision 120 ft.')
		expect(text).toContain('Passive Perception 15')
	})

	/*
	 * The real guard on slice 1's eight new markup tags: they have to survive a
	 * component render, not only the tag table's own unit tests.
	 */
	it('renders trait and action text through the markup renderer, leaving no raw markup', () => {
		const { container } = render(<BeastStatBlock beast={beast()} />)
		const text = container.textContent ?? ''

		expect(screen.getByRole('heading', { name: 'Traits' })).toBeTruthy()
		expect(text).toContain('Flyby')
		expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy()
		expect(text).toContain('Talons')

		expect(text).toContain('Melee Attack Roll:') // {@atkr m}
		expect(text).toContain('Hit:') // {@h}
		expect(text).toContain('+3') // {@hit 3}
		expect(text).toContain('Opportunity Attack') // a plain reference tag

		expect(text).not.toContain('{@')
		expect(container.innerHTML).not.toContain('{@')
	})

	it('renders the optional sections a beast actually has, and no empty ones', () => {
		const bare = beast({ name: 'Frog' })
		delete bare.skill
		delete bare.senses
		delete bare.passive
		delete bare.trait

		const { container } = render(<BeastStatBlock beast={bare} />)
		const text = container.textContent ?? ''

		expect(text).not.toContain('Skills')
		expect(text).not.toContain('Senses')
		expect(text).not.toContain('Resistances')
		expect(text).not.toContain('Condition immunities')
		expect(screen.queryByRole('heading', { name: 'Traits' })).toBeNull()
		expect(screen.queryByRole('heading', { name: 'Reactions' })).toBeNull()

		// The mandatory half still renders.
		expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy()
		expect(text).toContain('Frog')
	})

	it('renders the optional defence lines when the beast carries them', () => {
		const { container } = render(
			<BeastStatBlock
				beast={beast({
					save: { dex: '+3', wis: '+2' },
					resist: ['poison'],
					conditionImmune: ['charmed', 'frightened'],
					bonus: [{ name: 'Nimble Escape', entries: ['It takes the Disengage action.'] }],
					reaction: [{ name: 'Parry', entries: ['It adds 2 to its AC.'] }],
				})}
			/>,
		)
		const text = container.textContent ?? ''
		expect(text).toContain('Dex +3')
		expect(text).toContain('Wis +2')
		expect(text).toContain('poison')
		expect(text).toContain('charmed, frightened')
		expect(screen.getByRole('heading', { name: 'Bonus actions' })).toBeTruthy()
		expect(screen.getByRole('heading', { name: 'Reactions' })).toBeTruthy()
	})

	it('names a swarm and a tagged type readably', () => {
		const { container } = render(<BeastStatBlock beast={beast({ name: 'Swarm of Bats', size: ['M'], type: { type: 'beast', swarmSize: 'T' } })} />)
		expect(container.textContent).toContain('Swarm of Tiny Beasts')

		cleanup()
		const tagged = render(<BeastStatBlock beast={beast({ name: 'Allosaurus', type: { type: 'beast', tags: ['dinosaur'] } })} />)
		expect(tagged.container.textContent).toContain('Beast (dinosaur)')
	})

	it('is collapsed by default', () => {
		const { container } = render(<BeastStatBlock beast={beast()} />)
		const details = container.querySelector('details')
		expect(details).toBeTruthy()
		expect(details?.hasAttribute('open')).toBe(false)
	})
})
