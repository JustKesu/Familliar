/*
 * Shared cache for data/ files (D39): a file is fetched at most once, and
 * concurrent requests for the same file share the in-flight fetch instead of
 * triggering a second one. Nothing is loaded ahead of a request — only the
 * paths callers actually ask for.
 *
 * A failed fetch is not cached (D39 talks about a "downloaded copy"; a
 * failed attempt never became one), so the next request for the same path
 * retries rather than replaying the same rejection forever.
 *
 * For callers that COMPUTE from the data — not just fetch it — see D38:
 * loadDataFile is for the code that acquires data (wizard, sheet), not for
 * calculation functions, which take parsed data as a parameter instead.
 */

const cache = new Map<string, Promise<unknown>>()

export async function loadDataFile(path: string): Promise<unknown> {
	const cached = cache.get(path)
	if (cached) return cached

	const promise = (async () => {
		const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
		if (!response.ok) {
			throw new Error(`${path} — HTTP ${response.status}`)
		}
		return response.json()
	})()

	cache.set(path, promise)
	promise.catch(() => cache.delete(path))
	return promise
}
