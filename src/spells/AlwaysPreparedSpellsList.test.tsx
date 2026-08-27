// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AlwaysPreparedSpellsList } from './AlwaysPreparedSpellsList'
import type { AlwaysPreparedSpell } from './subclassPreparedSpells'

/*
 * The wizard computes this list and the D71 "already have it" set from one
 * load; a failure of that load reaches this component only as the `error`
 * prop. D43: that failure must show, and must not look like an empty list.
 */

afterEach(cleanup)

function grant(name: string): AlwaysPreparedSpell {
	return { name, source: 'XPHB', level: 1, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' }
}

describe('AlwaysPreparedSpellsList', () => {
	it('shows the failure message when the wizard reports a load error (D43)', () => {
		render(<AlwaysPreparedSpellsList subclassName="Fiend" spells={[]} error="feats.json — HTTP 500" />)
		expect(screen.getByText(/Could not load Fiend.+always-prepared spells: feats\.json — HTTP 500/)).toBeTruthy()
	})

	it('still shows the failure message even if a previous (stale) list is present', () => {
		render(<AlwaysPreparedSpellsList subclassName="Fiend" spells={[grant('Command')]} error="network down" />)
		expect(screen.getByText(/Could not load Fiend.+always-prepared spells: network down/)).toBeTruthy()
		expect(screen.queryByText('Command')).toBeNull()
	})

	it('renders nothing when the result is genuinely empty (no error)', () => {
		const { container } = render(<AlwaysPreparedSpellsList subclassName="Fiend" spells={[]} error={null} />)
		expect(container.firstChild).toBeNull()
	})

	it('renders nothing when no error prop is passed and the list is empty', () => {
		const { container } = render(<AlwaysPreparedSpellsList subclassName="Fiend" spells={[]} />)
		expect(container.firstChild).toBeNull()
	})

	it('renders the list when there are grants and no error', () => {
		render(<AlwaysPreparedSpellsList subclassName="Fiend" spells={[grant('Command'), grant('Scorching Ray')]} error={null} />)
		expect(screen.getByText(/Always prepared from Fiend/)).toBeTruthy()
		expect(screen.getByText('Command')).toBeTruthy()
		expect(screen.getByText('Scorching Ray')).toBeTruthy()
	})
})
