import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveRef } from './resolveRef'
import { scanRefs } from './scanRefs'
import type { ResolverData } from './refTypes'

/*
 * The only guard that runs the app's OWN resolver over the real generated
 * files. scripts/check-dangling-refs.js re-implements the same join in
 * CommonJS (scripts/ cannot import TS), so it can agree with the resolver
 * only by mirroring it; when the two drift, this test is the one that speaks
 * for what the player actually sees. A ref that fails here renders as D43's
 * "text not found" note in every picker and on the sheet.
 *
 * Reading data/ from disk is deliberate and stays cheap: nothing is printed,
 * only counts and the offending uids on failure.
 */

function read(name: string): unknown {
	return JSON.parse(readFileSync(`data/${name}`, 'utf8'))
}

const data: ResolverData = {
	classFeatures: read('class-features.json'),
	subclassFeatures: read('subclass-features.json'),
	optionalFeatures: read('optional-features.json'),
	feats: read('feats.json'),
}

const FILES = [
	['class-features', data.classFeatures],
	['subclass-features', data.subclassFeatures],
	['optional-features', data.optionalFeatures],
	['feats', data.feats],
] as const

function unresolved(): { checked: number; failures: string[] } {
	const failures: string[] = []
	let checked = 0
	for (const [label, entries] of FILES) {
		for (const holder of entries as Record<string, unknown>[]) {
			for (const occurrence of scanRefs(holder['entries'])) {
				checked++
				if (resolveRef(occurrence, data) === null) {
					failures.push(`${label}: ${String(holder['name'])} -> ${occurrence.kind} ${occurrence.uid}`)
				}
			}
		}
	}
	return { checked, failures }
}

describe('resolveRef against the generated data', () => {
	const { checked, failures } = unresolved()

	it('resolves every ref* node in the four feature files', () => {
		expect(failures).toEqual([])
	})

	// A scan that silently found nothing would make the assertion above pass
	// for the wrong reason.
	it('actually scanned the refs', () => {
		expect(checked).toBeGreaterThan(400)
	})
})
