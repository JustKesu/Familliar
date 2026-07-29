import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The cache is module-level state, so each test re-imports the module fresh
 * (vi.resetModules) rather than sharing one cache across tests.
 */

beforeEach(() => {
	vi.resetModules()
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hello: 'world' }) })),
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('loadDataFile', () => {
	it('fetches a requested path and returns its parsed JSON', async () => {
		const { loadDataFile } = await import('./dataLoader')
		const result = await loadDataFile('data/classes.json')
		expect(result).toEqual({ hello: 'world' })
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it('does not refetch on a second request for the same path', async () => {
		const { loadDataFile } = await import('./dataLoader')
		await loadDataFile('data/classes.json')
		await loadDataFile('data/classes.json')
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it('fetches once for concurrent requests of the same path', async () => {
		const { loadDataFile } = await import('./dataLoader')
		const [a, b] = await Promise.all([loadDataFile('data/classes.json'), loadDataFile('data/classes.json')])
		expect(fetch).toHaveBeenCalledTimes(1)
		expect(a).toEqual(b)
	})

	it('fetches each distinct path separately', async () => {
		const { loadDataFile } = await import('./dataLoader')
		await loadDataFile('data/classes.json')
		await loadDataFile('data/species.json')
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('rejects with the same HTTP-status message the old per-module fetchJson threw', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
		)
		const { loadDataFile } = await import('./dataLoader')
		await expect(loadDataFile('data/missing.json')).rejects.toThrow('data/missing.json — HTTP 404')
	})

	it('retries on the next request after a failed fetch, instead of caching the rejection', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ hello: 'world' }) })
		vi.stubGlobal('fetch', fetchMock)
		const { loadDataFile } = await import('./dataLoader')

		await expect(loadDataFile('data/classes.json')).rejects.toThrow('data/classes.json — HTTP 500')
		const result = await loadDataFile('data/classes.json')

		expect(result).toEqual({ hello: 'world' })
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})
})
