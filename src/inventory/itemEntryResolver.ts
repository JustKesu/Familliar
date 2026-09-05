/*
 * itemEntryResolver — resolves `{#itemEntry Name|Source}` references inside an
 * item's `entries`.
 *
 * This is the ONE brace shape the step-1 markup renderer does not know: it
 * handles `{@...}` tags only, so a `{#itemEntry ...}` string reaches the DOM
 * verbatim (the bug this module fixes — slice g's markup survey missed it
 * because it scanned for `{@` alone).
 *
 * The reference points at a SHARED description template that lives in
 * data/item-entries.json (5etools' items-base.json `itemEntry` list), not on
 * the item itself. The template's own text carries `{{item.PROP}}` tokens that
 * are filled from the REFERENCING item's fields — `resist`, `detail1`,
 * `detail2` — the same substitution 5etools' Renderer.utils.applyTemplate does
 * (js/render.js ~4970). "Ring of Fire Resistance" carries `resist: ["fire"]`,
 * so `{{getFullImmRes item.resist}}` in the "Ring of Resistance" template
 * renders as "fire".
 *
 * It lives OUTSIDE src/markup/ for the same reason src/featureResolver/ does:
 * D7 keeps the markup renderer free of cross-file lookup. Resolution happens
 * before <Entries> ever sees the text, so the renderer is untouched.
 *
 * D43: a reference with no matching template renders as a visible, named note,
 * never as braces and never as nothing.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

/** One shared description template, as extracted into data/item-entries.json. */
export interface ItemEntryTemplate {
	name: string
	source: string
	/** The 5etools `entriesTemplate` array — strings (with `{{...}}` tokens) and nested entry objects. */
	entriesTemplate: unknown[]
}

/**
 * The referencing item's fields the `{{...}}` tokens read. `ItemRef` already
 * satisfies this shape (it carries `resist`; `detail1`/`detail2` were added
 * alongside), so the sheet passes the resolved ref straight in.
 */
export interface ItemEntryContext {
	resist?: string[]
	immune?: string[]
	detail1?: string
	detail2?: string
}

/*
 * A `{#itemEntry X}` with no source. 5etools defaults this to the 2014 DMG;
 * this app's item catalogue is the 2024 book, and every occurrence in the data
 * writes `|XDMG` explicitly, so the default is only ever a fallback for text a
 * future extraction might add.
 */
const DEFAULT_ITEM_ENTRY_SOURCE = 'XDMG'

/** A whole-string `{#itemEntry Name|Source}` entry — the only shape that occurs (every one of the 71 in the data is a standalone array element). */
const STANDALONE_ITEM_ENTRY = /^\{#itemEntry\s+([^}]+)\}$/

export function extractItemEntryTemplates(parsed: unknown): ItemEntryTemplate[] {
	if (!Array.isArray(parsed)) {
		throw new Error('item-entries.json: expected a top-level array.')
	}
	return parsed
		.filter(
			(entry): entry is Record<string, unknown> =>
				typeof entry === 'object' &&
				entry !== null &&
				typeof (entry as Record<string, unknown>)['name'] === 'string' &&
				typeof (entry as Record<string, unknown>)['source'] === 'string',
		)
		.map((entry) => ({
			name: entry['name'] as string,
			source: entry['source'] as string,
			entriesTemplate: Array.isArray(entry['entriesTemplate']) ? (entry['entriesTemplate'] as unknown[]) : [],
		}))
}

export async function loadItemEntryTemplates(): Promise<ItemEntryTemplate[]> {
	return extractItemEntryTemplates(await loadDataFile('data/item-entries.json'))
}

/** 5etools' `Parser.getFullImmRes`: an English list — "fire", "fire and cold", "fire, cold, and acid". Lowercase, to read inside a sentence. */
function formatDamageList(types: readonly string[]): string {
	if (types.length === 0) return ''
	if (types.length === 1) return types[0]
	if (types.length === 2) return `${types[0]} and ${types[1]}`
	return `${types.slice(0, -1).join(', ')}, and ${types[types.length - 1]}`
}

/**
 * Fills one `{{...}}` token. The vocabulary that actually occurs
 * (scripts/investigate-brace-shapes.js): `item.detail1`, `item.detail2`,
 * `item.resist`, `getFullImmRes item.resist`. An unrecognised token resolves
 * to nothing rather than leaking braces to the DOM.
 */
function resolveToken(token: string, context: ItemEntryContext): string {
	const parts = token.trim().split(/\s+/)
	const fn = parts.length > 1 ? parts[0] : null
	const prop = (parts[parts.length - 1] ?? '').replace(/^item\./, '')

	const value = (context as Record<string, unknown>)[prop]

	if (fn === 'getFullImmRes') {
		return formatDamageList(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
	}
	if (Array.isArray(value)) return value.join(', ')
	return value === undefined || value === null ? '' : String(value)
}

function applyTokens(text: string, context: ItemEntryContext): string {
	return text.replace(/\{\{([^}]+)\}\}/g, (_match, token: string) => resolveToken(token, context))
}

/** Deep-clones a template tree, substituting `{{...}}` tokens in every string it contains. */
function substituteTokens(node: unknown, context: ItemEntryContext): unknown {
	if (typeof node === 'string') return applyTokens(node, context)
	if (Array.isArray(node)) return node.map((child) => substituteTokens(child, context))
	if (node !== null && typeof node === 'object') {
		const out: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(node)) out[key] = substituteTokens(value, context)
		return out
	}
	return node
}

/** The D43 note for a reference whose template is not in the data. Named, visible, never blank. */
function notFoundNote(ref: string): string {
	return `(This item's shared description "${ref}" is not in the data, so its text is incomplete.)`
}

/**
 * Walks an `entries` tree and replaces every standalone `{#itemEntry Name|Source}`
 * string with the resolved template nodes. Everything else — plain strings,
 * `{@...}` markup, nested `entries`/`list`/`table` objects — passes through
 * untouched. Any OTHER `{#...}` string is left in place deliberately, so a new
 * shape shows up in the markup-coverage guard rather than being silently eaten.
 */
export function resolveItemEntryRefs(
	entries: readonly unknown[] | undefined,
	context: ItemEntryContext,
	templates: readonly ItemEntryTemplate[],
): unknown[] {
	if (!Array.isArray(entries)) return []

	const findTemplate = (name: string, source: string): ItemEntryTemplate | undefined =>
		templates.find(
			(candidate) =>
				candidate.name.toLowerCase() === name.toLowerCase() &&
				candidate.source.toLowerCase() === source.toLowerCase(),
		)

	const expand = (node: unknown): unknown[] => {
		if (typeof node === 'string') {
			const match = node.trim().match(STANDALONE_ITEM_ENTRY)
			if (!match) return [node]

			const ref = match[1].trim()
			const [rawName, rawSource] = ref.split('|')
			const template = findTemplate((rawName ?? '').trim(), (rawSource ?? '').trim() || DEFAULT_ITEM_ENTRY_SOURCE)
			if (!template) return [notFoundNote(ref)]

			return (substituteTokens(template.entriesTemplate, context) as unknown[])
		}

		if (Array.isArray(node)) return node.flatMap(expand)

		if (node !== null && typeof node === 'object') {
			const out: Record<string, unknown> = {}
			for (const [key, value] of Object.entries(node)) {
				out[key] = Array.isArray(value) ? value.flatMap(expand) : value
			}
			return [out]
		}

		return [node]
	}

	return entries.flatMap(expand)
}
