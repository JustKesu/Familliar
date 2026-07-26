import { describe, expect, it } from 'vitest'
import { hasMarkup, parseMarkup, splitTagArgs } from './parseMarkup'

describe('splitTagArgs', () => {
	it('splits on top-level pipes', () => {
		expect(splitTagArgs('Fireball|XPHB')).toEqual(['Fireball', 'XPHB'])
	})

	it('preserves empty arguments, which carry meaning', () => {
		// A blank source is not an absent source — see NOTES.md.
		expect(splitTagArgs('concentration||concentrating')).toEqual([
			'concentration',
			'',
			'concentrating',
		])
		expect(splitTagArgs('Cover||3||total cover')).toEqual([
			'Cover',
			'',
			'3',
			'',
			'total cover',
		])
	})

	it('ignores pipes nested inside another tag', () => {
		expect(splitTagArgs('Wand|XDMG|a {@spell magic missile|XPHB} wand')).toEqual([
			'Wand',
			'XDMG',
			'a {@spell magic missile|XPHB} wand',
		])
	})

	it('returns a single empty argument for an empty body', () => {
		expect(splitTagArgs('')).toEqual([''])
	})
})

describe('parseMarkup', () => {
	it('returns plain text unchanged as a single node', () => {
		expect(parseMarkup('Just words.')).toEqual([
			{ kind: 'text', text: 'Just words.' },
		])
	})

	it('returns an empty list for an empty string', () => {
		expect(parseMarkup('')).toEqual([])
	})

	it('splits text and tags in order', () => {
		expect(parseMarkup('Deal {@damage 8d6} damage.')).toEqual([
			{ kind: 'text', text: 'Deal ' },
			{ kind: 'tag', name: 'damage', args: ['8d6'], raw: '{@damage 8d6}' },
			{ kind: 'text', text: ' damage.' },
		])
	})

	it('parses a tag at the very start and very end', () => {
		const nodes = parseMarkup('{@i Hit:} then {@dc 15}')
		expect(nodes).toHaveLength(3)
		expect(nodes[0]).toMatchObject({ kind: 'tag', name: 'i' })
		expect(nodes[2]).toMatchObject({ kind: 'tag', name: 'dc', args: ['15'] })
	})

	it('parses pipe-separated arguments', () => {
		expect(parseMarkup('{@spell Acid Splash|XPHB}')[0]).toEqual({
			kind: 'tag',
			name: 'spell',
			args: ['Acid Splash', 'XPHB'],
			raw: '{@spell Acid Splash|XPHB}',
		})
	})

	it('handles a tag with no arguments', () => {
		expect(parseMarkup('{@coinflip}')[0]).toMatchObject({
			kind: 'tag',
			name: 'coinflip',
			args: [''],
		})
	})

	it('keeps a nested tag intact inside its parent argument', () => {
		const nodes = parseMarkup('{@item Wand|XDMG|a {@spell magic missile} wand}')
		expect(nodes).toHaveLength(1)
		expect(nodes[0]).toMatchObject({
			kind: 'tag',
			name: 'item',
			args: ['Wand', 'XDMG', 'a {@spell magic missile} wand'],
		})
	})

	it('parses several tags in one string', () => {
		const nodes = parseMarkup(
			'{@spell Bless|XPHB} and {@condition Prone|XPHB} and {@dice 1d4}',
		)
		const tags = nodes.filter((node) => node.kind === 'tag')
		expect(tags.map((tag) => tag.name)).toEqual(['spell', 'condition', 'dice'])
	})

	it('treats an unbalanced brace as literal text rather than swallowing the rest', () => {
		expect(parseMarkup('a {@spell unterminated')).toEqual([
			{ kind: 'text', text: 'a {@spell unterminated' },
		])
	})

	it('leaves braces that are not tags alone', () => {
		expect(parseMarkup('a {plain} brace')).toEqual([
			{ kind: 'text', text: 'a {plain} brace' },
		])
	})

	it('never drops characters', () => {
		const samples = [
			'Deal {@damage 8d6} damage to {@creature Rat|XMM}.',
			'{@i Hit:} {@hit 8} to hit',
			'no tags at all',
			'{@spell a|b|c}{@spell d}',
		]
		for (const sample of samples) {
			const rebuilt = parseMarkup(sample)
				.map((node) => (node.kind === 'text' ? node.text : node.raw))
				.join('')
			expect(rebuilt).toBe(sample)
		}
	})
})

describe('hasMarkup', () => {
	it('detects tags', () => {
		expect(hasMarkup('{@dice 1d6}')).toBe(true)
		expect(hasMarkup('plain')).toBe(false)
	})
})
