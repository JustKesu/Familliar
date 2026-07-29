import type { ResolverData } from './refTypes'

/*
 * Fetches the four files a ref* node might resolve against. There is no
 * shared data loader yet (D39 describes one but nothing in the codebase
 * implements it — every *Data.ts module still fetches independently, e.g.
 * subclassData.ts's fetchJson), so this follows the same pattern rather
 * than introducing the shared cache here.
 */

async function fetchJson(path: string): Promise<unknown> {
	const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
	if (!response.ok) {
		throw new Error(`${path} — HTTP ${response.status}`)
	}
	return response.json()
}

export async function loadResolverData(): Promise<ResolverData> {
	const [classFeatures, subclassFeatures, optionalFeatures, feats] = await Promise.all([
		fetchJson('data/class-features.json'),
		fetchJson('data/subclass-features.json'),
		fetchJson('data/optional-features.json'),
		fetchJson('data/feats.json'),
	])
	return { classFeatures, subclassFeatures, optionalFeatures, feats }
}
