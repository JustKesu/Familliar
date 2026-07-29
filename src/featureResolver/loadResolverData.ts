import type { ResolverData } from './refTypes'
import { loadDataFile } from '../dataLoader/dataLoader'

/** Fetches the four files a ref* node might resolve against, via the shared data loader (D39). */
export async function loadResolverData(): Promise<ResolverData> {
	const [classFeatures, subclassFeatures, optionalFeatures, feats] = await Promise.all([
		loadDataFile('data/class-features.json'),
		loadDataFile('data/subclass-features.json'),
		loadDataFile('data/optional-features.json'),
		loadDataFile('data/feats.json'),
	])
	return { classFeatures, subclassFeatures, optionalFeatures, feats }
}
