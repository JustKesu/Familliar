import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Entries } from './Markup'
import { unknownEntryWarnings, unknownTagWarnings } from './warnings'
import { extractItemEntryTemplates, resolveItemEntryRefs } from '../inventory/itemEntryResolver'

/*
 * The end-to-end guard: render EVERY entry structure in data/ and require the
 * console to stay silent.
 *
 * The renderer degrades gracefully by design — an unknown tag or entry type
 * still produces readable output — which means a gap would otherwise show up
 * only as a warning in a player's console, where nobody would see it. This
 * test turns that warning into a build failure.
 *
 * It also proves the "no console errors" part of the acceptance check without
 * needing a browser.
 */

/** Keys whose values are entry structures worth rendering. */
const ENTRY_KEYS = ['entries', 'entriesHigherLevel', 'headerEntries', 'fluff']

function collectEntryArrays(node: unknown, found: unknown[][]): void {
	if (Array.isArray(node)) {
		for (const child of node) collectEntryArrays(child, found)
		return
	}
	if (typeof node !== 'object' || node === null) return

	const record = node as Record<string, unknown>
	for (const [key, value] of Object.entries(record)) {
		if (ENTRY_KEYS.includes(key) && Array.isArray(value)) found.push(value)
		collectEntryArrays(value, found)
	}
}

describe('rendering the whole of data/', () => {
	beforeEach(() => {
		unknownTagWarnings.reset()
		unknownEntryWarnings.reset()
	})
	afterEach(() => vi.restoreAllMocks())

	it('renders every entry structure without warning or throwing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})

		const dataDir = join(process.cwd(), 'data')
		const files = readdirSync(dataDir).filter((name) => name.endsWith('.json'))
		let rendered = 0

		// The shared {#itemEntry} description templates. An item's `entries` can
		// carry "{#itemEntry Ring of Resistance|XDMG}" — the ONE brace shape the
		// renderer does not know. The sheet fills it from these before <Entries>,
		// so the guard must too, or a broken reference would slip past silently
		// exactly as slice g's {@-only survey did.
		const itemEntryTemplates = extractItemEntryTemplates(
			JSON.parse(readFileSync(join(dataDir, 'item-entries.json'), 'utf8')),
		)

		for (const file of files) {
			// item-entries.json holds description TEMPLATES carrying unfilled
			// {{item.*}} tokens — they are only ever rendered after
			// resolveItemEntryRefs substitutes them, which the items.json branch
			// below exercises. Rendering them raw would (correctly) trip the
			// {{ guard, but for the wrong reason.
			if (file === 'item-entries.json') continue

			const parsed: unknown = JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
			const arrays: unknown[][] = []

			if (file === 'items.json' && Array.isArray(parsed)) {
				// Resolve per-item so the {{item.*}} tokens see the right fields.
				for (const item of parsed) {
					const record = item as Record<string, unknown>
					if (Array.isArray(record['entries'])) {
						arrays.push(resolveItemEntryRefs(record['entries'], record, itemEntryTemplates))
					}
					collectEntryArrays({ ...record, entries: undefined }, arrays)
				}
			} else {
				collectEntryArrays(parsed, arrays)
			}

			for (const entries of arrays) {
				const html = renderToStaticMarkup(<Entries entries={entries} />)
				// Nothing may leak raw 5etools markup to the reader — any of the
				// three sigils: {@tag}, {#itemEntry ...} or a {{token}} fill-in.
				expect(html).not.toContain('{@')
				expect(html).not.toContain('{#')
				expect(html).not.toContain('{{')
				expect(html).not.toContain('[object Object]')
				rendered++
			}
		}

		expect(rendered).toBeGreaterThan(1000)
		expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([])
		expect(error).not.toHaveBeenCalled()
	})
})
