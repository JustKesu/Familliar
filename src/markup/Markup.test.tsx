import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Entries, Markup } from './Markup'
import { unknownEntryWarnings, unknownTagWarnings } from './warnings'

const html = (node: ReactNode): string => renderToStaticMarkup(<>{node}</>)

/** The rendered text with all tags stripped, for readability assertions. */
const text = (node: ReactNode): string =>
	html(node)
		.replace(/<[^>]+>/g, '')
		.replace(/&#x27;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')

beforeEach(() => {
	unknownTagWarnings.reset()
	unknownEntryWarnings.reset()
})
afterEach(() => vi.restoreAllMocks())

describe('<Markup>', () => {
	it('renders plain text untouched', () => {
		expect(html(<Markup text="Just words." />)).toBe('Just words.')
	})

	it('renders a value tag as styled text', () => {
		const out = html(<Markup text="Deal {@damage 8d6} damage." />)
		expect(out).toContain('Deal ')
		expect(out).toContain('8d6')
		expect(out).toContain('mk-value--damage')
	})

	it('renders a reference as a span, not a link', () => {
		const out = html(<Markup text="{@spell Fireball|XPHB}" />)
		expect(out).toContain('<span')
		expect(out).not.toContain('<a ')
		expect(out).not.toContain('href')
	})

	it('keeps the reference target on the element so links can be added later', () => {
		const out = html(<Markup text="{@item +1 Armor|XDMG|Armor +1}" />)
		expect(out).toContain('data-ref-category="item"')
		expect(out).toContain('data-ref-name="+1 Armor"')
		expect(out).toContain('data-ref-source="XDMG"')
		expect(text(<Markup text="{@item +1 Armor|XDMG|Armor +1}" />)).toBe('Armor +1')
	})

	it('renders emphasis as real elements', () => {
		expect(html(<Markup text="{@b Bold}" />)).toContain('<strong>Bold</strong>')
		expect(html(<Markup text="{@i Hit:}" />)).toContain('<em>Hit:</em>')
	})

	it('renders a tag nested inside another tag', () => {
		const out = html(<Markup text="{@item Wand|XDMG|a {@spell magic missile|XPHB} wand}" />)
		expect(out).toContain('mk-ref--item')
		expect(out).toContain('mk-ref--spell')
		expect(text(<Markup text="{@item Wand|XDMG|a {@spell magic missile|XPHB} wand}" />)).toBe(
			'a magic missile wand',
		)
	})

	it('renders emphasis nested inside a reference', () => {
		const out = html(<Markup text="{@item Rope|XPHB|{@i knotted} rope}" />)
		expect(out).toContain('<em>knotted</em>')
		expect(out).toContain('mk-ref--item')
	})

	it('never renders raw braces for an unknown tag', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const out = html(<Markup text="Before {@nonsenseTag inner text|XPHB} after" />)
		expect(out).not.toContain('{')
		expect(out).not.toContain('}')
		expect(out).toContain('inner text')
		expect(text(<Markup text="Before {@nonsenseTag inner text|XPHB} after" />)).toBe(
			'Before inner text after',
		)
		expect(warn).toHaveBeenCalled()
	})

	it('renders a realistic sentence end to end', () => {
		const source =
			'Make a {@dc 15} Constitution saving throw or take {@damage 4d6} damage ' +
			'and have the {@condition Prone|XPHB} condition.'
		expect(text(<Markup text={source} />)).toBe(
			'Make a DC 15 Constitution saving throw or take 4d6 damage and have the Prone condition.',
		)
	})
})

describe('<Entries> — recursion through nested objects', () => {
	it('renders an array of strings as paragraphs', () => {
		const out = html(<Entries entries={['One.', 'Two.']} />)
		expect(out).toBe('<p>One.</p><p>Two.</p>')
	})

	it('recurses rather than joining nested entries', () => {
		const entries = [
			'Top level.',
			{
				type: 'entries',
				name: 'Nested',
				entries: ['Inner one.', { type: 'entries', name: 'Deeper', entries: ['Innermost.'] }],
			},
		]
		const out = html(<Entries entries={entries} />)
		expect(out).toContain('Top level.')
		expect(out).toContain('<h4 class="mk-entries__name">Nested</h4>')
		expect(out).toContain('<h4 class="mk-entries__name">Deeper</h4>')
		expect(out).toContain('Innermost.')
		// The nested object must not have been stringified.
		expect(out).not.toContain('[object Object]')
	})

	it('renders markup inside nested entries', () => {
		const out = html(
			<Entries entries={[{ type: 'entries', entries: ['Take {@damage 2d6} damage.'] }]} />,
		)
		expect(out).toContain('2d6')
		expect(out).toContain('mk-value--damage')
	})
})

describe('<Entries> — every nested entry type found in data/', () => {
	it('list, with items that use `entry`', () => {
		const out = html(
			<Entries
				entries={[
					{
						type: 'list',
						style: 'list-hang-notitle',
						items: [
							{ type: 'item', name: 'Skill Proficiencies:', entry: '{@skill History|XPHB}' },
						],
					},
				]}
			/>,
		)
		expect(out).toContain('mk-list--list-hang-notitle')
		expect(out).toContain('<strong class="mk-list__name">Skill Proficiencies: </strong>')
		expect(out).toContain('History')
	})

	it('list item that uses `entries` instead of `entry`', () => {
		const out = html(
			<Entries
				entries={[
					{ type: 'list', items: [{ type: 'item', name: 'Feat:', entries: ['{@feat Skilled|XPHB}'] }] },
				]}
			/>,
		)
		expect(out).toContain('Feat:')
		expect(out).toContain('Skilled')
	})

	it('list of plain strings', () => {
		const out = html(<Entries entries={[{ type: 'list', items: ['Alpha', 'Beta'] }]} />)
		expect(out).toContain('<li class="mk-list__item">Alpha</li>')
		expect(out).toContain('<li class="mk-list__item">Beta</li>')
	})

	it('list with a column count', () => {
		const out = html(<Entries entries={[{ type: 'list', columns: 3, items: ['A'] }]} />)
		expect(out).toContain('column-count:3')
	})

	it('table with caption, headers, rows and footnotes', () => {
		const out = html(
			<Entries
				entries={[
					{
						type: 'table',
						caption: 'Magic Item Plans',
						colLabels: ['Magic Item Plan', 'Attunement'],
						colStyles: ['col-9', 'col-3 text-center'],
						rows: [['{@item Alchemy Jug|XDMG}', 'No']],
						footnotes: ['*You can learn this option multiple times.'],
					},
				]}
			/>,
		)
		expect(out).toContain('<caption class="mk-table__caption">Magic Item Plans</caption>')
		expect(out).toContain('scope="col"')
		expect(out).toContain('class="col-3 text-center"')
		expect(out).toContain('Alchemy Jug')
		expect(out).toContain('You can learn this option multiple times.')
	})

	it('table row containing a cell object', () => {
		const out = html(
			<Entries
				entries={[
					{
						type: 'table',
						colLabels: ['Roll', 'Effect'],
						rows: [[{ type: 'cell', roll: { exact: 3 } }, 'Something happens']],
					},
				]}
			/>,
		)
		expect(out).toContain('>3<')
		expect(out).toContain('Something happens')
	})

	it('cell with a min/max range', () => {
		const out = html(
			<Entries
				entries={[{ type: 'table', rows: [[{ type: 'cell', roll: { min: 1, max: 4 } }]] }]}
			/>,
		)
		expect(out).toContain('1-4')
	})

	it('inset callout', () => {
		const out = html(
			<Entries
				entries={[{ type: 'inset', name: 'Breaking Your Oath', entries: ['A Paladin tries…'] }]}
			/>,
		)
		expect(out).toContain('<aside class="mk-inset">')
		expect(out).toContain('Breaking Your Oath')
	})

	it('options with a count', () => {
		const out = html(
			<Entries
				entries={[
					{
						type: 'options',
						count: 2,
						entries: [
							{ type: 'refOptionalfeature', optionalfeature: 'Careful Spell|XPHB' },
							{ type: 'refOptionalfeature', optionalfeature: 'Distant Spell|XPHB' },
						],
					},
				]}
			/>,
		)
		expect(out).toContain('Choose 2 of the following:')
		expect(out).toContain('Careful Spell')
		expect(out).toContain('Distant Spell')
	})

	it('dice entry', () => {
		const out = html(
			<Entries entries={[{ type: 'dice', toRoll: [{ number: 1, faces: 6 }], rollable: true }]} />,
		)
		expect(out).toContain('1d6')
	})

	it('bonus and bonusSpeed entries', () => {
		expect(html(<Entries entries={[{ type: 'bonus', value: 2 }]} />)).toContain('+2')
		expect(html(<Entries entries={[{ type: 'bonusSpeed', value: 10 }]} />)).toContain('+10 ft.')
		expect(html(<Entries entries={[{ type: 'bonusSpeed', value: 0 }]} />)).toContain('+0 ft.')
	})

	it.each([
		['refClassFeature', 'classFeature', 'Protector|Cleric|XPHB|1|XPHB', 'Protector'],
		[
			'refSubclassFeature',
			'subclassFeature',
			'Tools of the Trade|Artificer|EFA|Alchemist|EFA|3|EFA',
			'Tools of the Trade',
		],
		['refOptionalfeature', 'optionalfeature', 'Careful Spell|XPHB', 'Careful Spell'],
		['refFeat', 'feat', 'Blessed Warrior|XPHB', 'Blessed Warrior'],
	])('%s renders its target name and keeps the full uid', (type, key, uid, name) => {
		const entry = [{ type, [key]: uid }]
		const out = html(<Entries entries={entry} />)
		// The uid survives on the element for whatever resolves it later...
		expect(out).toContain(`data-ref-uid="${uid}"`)
		// ...but the reader sees only the name, never the pipe-separated uid.
		expect(text(<Entries entries={entry} />)).toBe(name)
	})
})

describe('<Entries> — graceful degradation', () => {
	it('renders the body of an unknown entry type and warns once', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const entries = [
			{ type: 'someFutureType', name: 'Title', entries: ['Body text.'] },
			{ type: 'someFutureType', entries: ['More body text.'] },
		]
		const out = html(<Entries entries={entries} />)
		expect(out).toContain('Title')
		expect(out).toContain('Body text.')
		expect(out).toContain('More body text.')
		expect(warn).toHaveBeenCalledTimes(1)
	})

	it('ignores null and undefined entries', () => {
		expect(html(<Entries entries={[null, undefined, 'Kept.']} />)).toBe('<p>Kept.</p>')
	})

	it('accepts a bare string instead of an array', () => {
		expect(html(<Entries entries="Alone." />)).toBe('<p>Alone.</p>')
	})

	it('renders a numeric entry', () => {
		expect(html(<Entries entries={[3]} />)).toBe('<p>3</p>')
	})

	it('renders an entries object with no name', () => {
		expect(html(<Entries entries={[{ type: 'entries', entries: ['Body.'] }]} />)).toContain(
			'Body.',
		)
	})
})
