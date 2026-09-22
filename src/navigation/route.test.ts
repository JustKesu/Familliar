import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type Route } from './route'

describe('route parse/format round trip', () => {
	const cases: { route: Route; hash: string }[] = [
		{ route: { view: 'list' }, hash: '#/' },
		{ route: { view: 'new' }, hash: '#/new' },
		{ route: { view: 'sheet', id: 'abc-123' }, hash: '#/character/abc-123' },
		{ route: { view: 'edit', id: 'abc-123' }, hash: '#/character/abc-123/edit' },
		{ route: { view: 'level-up', id: 'abc-123' }, hash: '#/character/abc-123/level-up' },
		{ route: { view: 'markup-demo' }, hash: '#/markup-demo' },
	]

	for (const { route, hash } of cases) {
		it(`round-trips ${JSON.stringify(route)}`, () => {
			expect(formatRoute(route)).toBe(hash)
			expect(parseRoute(hash)).toEqual(route)
		})
	}

	it('parses "" the same as "#/"', () => {
		expect(parseRoute('')).toEqual({ view: 'list' })
	})

	it('round-trips an id that needs URL-encoding', () => {
		const route: Route = { view: 'sheet', id: 'a/b c' }
		const hash = formatRoute(route)
		expect(parseRoute(hash)).toEqual(route)
	})
})

describe('route parse — invalid and trailing-slash hashes fall back to the list', () => {
	const invalid = [
		'#/character',
		'#/character/',
		'#/character/abc/',
		'#/character/abc/edit/',
		'#/character/abc/level-up/',
		'#/character//edit',
		'#/nope',
		'#/new/',
		'#/markup-demo/',
		'#character/abc',
	]

	for (const hash of invalid) {
		it(`treats ${JSON.stringify(hash)} as the list`, () => {
			expect(parseRoute(hash)).toEqual({ view: 'list' })
		})
	}
})
