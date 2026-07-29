/*
 * Shared shapes for the ref-expansion resolver.
 *
 * This is a layer OUTSIDE src/markup/ on purpose (D7 stays unchanged — the
 * renderer still shows only a name and keeps the UID on the element). It
 * takes the four ref* kinds Markup.tsx already recognises and does the
 * cross-file lookup the renderer deliberately doesn't own.
 */

export type RefKind = 'classFeature' | 'subclassFeature' | 'optionalfeature' | 'feat'

export interface RefOccurrence {
	kind: RefKind
	uid: string
}

export interface ResolvedFeature {
	name: string
	entries: unknown[]
}

/** The four data/ files a ref* node might resolve against (D33, D12). */
export interface ResolverData {
	classFeatures: unknown
	subclassFeatures: unknown
	optionalFeatures: unknown
	feats: unknown
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

export function asArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined
}
