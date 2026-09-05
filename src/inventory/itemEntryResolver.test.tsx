import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Entries } from '../markup'
import {
	extractItemEntryTemplates,
	resolveItemEntryRefs,
	type ItemEntryTemplate,
} from './itemEntryResolver'

/*
 * {#itemEntry Name|Source} is the one brace shape the step-1 renderer does not
 * know. resolveItemEntryRefs fills it from a shared template before <Entries>
 * ever sees it, substituting {{item.*}} tokens from the referencing item.
 */

const RING_TEMPLATE: ItemEntryTemplate = {
	name: 'Ring of Resistance',
	source: 'XDMG',
	entriesTemplate: [
		'You have {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage while wearing this ring. The ring is set with {{item.detail1}}.',
	],
}

const NESTED_TEMPLATE: ItemEntryTemplate = {
	name: 'Absorbing Tattoo',
	source: 'TCE',
	entriesTemplate: [
		'This tattoo emphasizes one color ({{item.detail1}}).',
		{
			type: 'entries',
			name: 'Tattoo Attunement',
			entries: ['While attuned you have resistance to {{getFullImmRes item.resist}} damage.'],
		},
	],
}

const TEMPLATES = [RING_TEMPLATE, NESTED_TEMPLATE]

function render(entries: unknown[]): string {
	return renderToStaticMarkup(<Entries entries={entries} />)
}

describe('resolveItemEntryRefs', () => {
	it('replaces a standalone {#itemEntry} with the template, tokens filled', () => {
		const out = resolveItemEntryRefs(
			['{#itemEntry Ring of Resistance|XDMG}'],
			{ resist: ['fire'], detail1: 'a pearl' },
			TEMPLATES,
		)
		expect(out).toEqual([
			'You have {@variantrule Resistance|XPHB} to fire damage while wearing this ring. The ring is set with a pearl.',
		])
		const html = render(out)
		expect(html).toContain('fire damage')
		expect(html).toContain('a pearl')
		expect(html).not.toContain('{{')
		expect(html).not.toContain('{#')
	})

	it('joins multiple damage types the way getFullImmRes does', () => {
		expect(
			resolveItemEntryRefs(['{#itemEntry Ring of Resistance|XDMG}'], { resist: ['fire', 'cold'], detail1: 'x' }, TEMPLATES),
		).toEqual(['You have {@variantrule Resistance|XPHB} to fire and cold damage while wearing this ring. The ring is set with x.'])

		expect(
			resolveItemEntryRefs(['{#itemEntry Ring of Resistance|XDMG}'], { resist: ['fire', 'cold', 'acid'], detail1: 'x' }, TEMPLATES),
		).toEqual([
			'You have {@variantrule Resistance|XPHB} to fire, cold, and acid damage while wearing this ring. The ring is set with x.',
		])
	})

	it('substitutes tokens inside nested entry objects too', () => {
		const out = resolveItemEntryRefs(
			['{#itemEntry Absorbing Tattoo|TCE}'],
			{ resist: ['lightning'], detail1: 'blue' },
			TEMPLATES,
		)
		expect(out).toHaveLength(2)
		expect(out[0]).toBe('This tattoo emphasizes one color (blue).')
		expect(out[1]).toMatchObject({
			type: 'entries',
			name: 'Tattoo Attunement',
			entries: ['While attuned you have resistance to lightning damage.'],
		})
		const html = render(out)
		expect(html).not.toContain('{{')
		expect(html).toContain('lightning damage')
	})

	it('defaults a source-less reference to XDMG', () => {
		expect(resolveItemEntryRefs(['{#itemEntry Ring of Resistance}'], { resist: ['acid'], detail1: 'x' }, TEMPLATES)).toEqual([
			'You have {@variantrule Resistance|XPHB} to acid damage while wearing this ring. The ring is set with x.',
		])
	})

	it('renders a visible, named note when the template is missing (D43) — never braces', () => {
		const out = resolveItemEntryRefs(['{#itemEntry Made Up Thing|XDMG}'], { resist: ['fire'] }, TEMPLATES)
		expect(out).toEqual([
			'(This item\'s shared description "Made Up Thing|XDMG" is not in the data, so its text is incomplete.)',
		])
		const html = render(out)
		expect(html).toContain('Made Up Thing|XDMG')
		expect(html).not.toContain('{#')
		expect(html).not.toContain('{{')
	})

	it('an empty template list makes every reference fall to the D43 note', () => {
		expect(resolveItemEntryRefs(['{#itemEntry Ring of Resistance|XDMG}'], { resist: ['fire'] }, [])).toEqual([
			'(This item\'s shared description "Ring of Resistance|XDMG" is not in the data, so its text is incomplete.)',
		])
	})

	it('leaves ordinary entries untouched — strings, {@…} markup and nested objects', () => {
		const entries = [
			'A plain paragraph with {@item Dagger|XPHB} in it.',
			{ type: 'entries', name: 'Heading', entries: ['nested text'] },
		]
		expect(resolveItemEntryRefs(entries, {}, TEMPLATES)).toEqual(entries)
	})

	it('leaves any OTHER {#…} shape in place so the coverage guard can catch it', () => {
		expect(resolveItemEntryRefs(['{#somethingNew Foo|Bar}'], {}, TEMPLATES)).toEqual(['{#somethingNew Foo|Bar}'])
	})

	it('handles an absent or non-array entries argument', () => {
		expect(resolveItemEntryRefs(undefined, {}, TEMPLATES)).toEqual([])
	})
})

describe('extractItemEntryTemplates', () => {
	it('keeps name, source and entriesTemplate; skips malformed rows', () => {
		const parsed = [
			{ name: 'Ring of Resistance', source: 'XDMG', entriesTemplate: ['text'] },
			{ name: 'No Template', source: 'XDMG' },
			{ source: 'XDMG', entriesTemplate: ['orphan'] },
			'not an object',
		]
		expect(extractItemEntryTemplates(parsed)).toEqual([
			{ name: 'Ring of Resistance', source: 'XDMG', entriesTemplate: ['text'] },
			{ name: 'No Template', source: 'XDMG', entriesTemplate: [] },
		])
	})

	it('throws when the top level is not an array', () => {
		expect(() => extractItemEntryTemplates({})).toThrow()
	})
})
