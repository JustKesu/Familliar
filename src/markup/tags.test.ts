import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseMarkup } from './parseMarkup'
import {
	getHandledTagNames,
	getUnknownTagsSeen,
	resetUnknownTagWarnings,
	resolveTag,
} from './tags'

/** Parses a single-tag string and resolves it. */
function resolve(markup: string) {
	const nodes = parseMarkup(markup)
	const node = nodes[0]
	if (!node || node.kind !== 'tag') throw new Error(`not a tag: ${markup}`)
	return resolveTag(node)
}

/*
 * Every tag that occurs in data/, taken from MARKUP-INVENTORY.md.
 * The example strings are real, copied from the inventory, not invented.
 */
const TAG_CASES: ReadonlyArray<[tag: string, markup: string, display: string]> = [
	['variantrule', '{@variantrule Spellcasting Focus|XPHB}', 'Spellcasting Focus'],
	['spell', '{@spell Acid Splash|XPHB}', 'Acid Splash'],
	['item', '{@item Disguise Kit|XPHB}', 'Disguise Kit'],
	['condition', '{@condition Incapacitated|XPHB}', 'Incapacitated'],
	['damage', '{@damage 1d10}', '1d10'],
	['dice', '{@dice d6}', 'd6'],
	['action', '{@action Opportunity Attack|XPHB|Opportunity Attacks}', 'Opportunity Attacks'],
	['skill', '{@skill History|XPHB}', 'History'],
	['creature', '{@creature Rat|XMM}', 'Rat'],
	['dc', '{@dc 15}', 'DC 15'],
	['filter', '{@filter Artificer cantrips|spells|level=0|class=Artificer}', 'Artificer cantrips'],
	['i', '{@i Hit:}', 'Hit:'],
	['feat', '{@feat Skilled|XPHB}', 'Skilled'],
	['book', '{@book chapter 7|XPHB|7}', 'chapter 7'],
	['sense', '{@sense Darkvision|XPHB}', 'Darkvision'],
	['scaledamage', '{@scaledamage 1d8|3,5,7,9|1d8}', '1d8'],
	['b', '{@b 1}', '1'],
	['status', '{@status concentration||concentrating}', 'concentrating'],
	['5etools', '{@5etools feat|feats.html}', 'feat'],
	['table', '{@table Skill List; Skills|XPHB|skills}', 'skills'],
	['deity', '{@deity Erathis|Dawn War|DMG}', 'Erathis'],
	['quickref', '{@quickref Cover||3||total cover}', 'total cover'],
	['hit', '{@hit 8}', '+8'],
	['chance', '{@chance 50}', '50 percent'],
	['itemProperty', '{@itemProperty LD|XPHB|Loading}', 'Loading'],
	['hazard', '{@hazard burning|XPHB}', 'burning'],
	['race', '{@race Elf|XPHB}', 'Elf'],
	['scaledice', '{@scaledice 1d6|2-9|1d6}', '1d6'],
	['subclass', '{@subclass Alchemist|Artificer|EFA|EFA}', 'Alchemist'],
	['itemMastery', '{@itemMastery Push|XPHB}', 'Push'],
	['classFeature', '{@classFeature Replicate Magic Item|Artificer|EFA|2|EFA}', 'Replicate Magic Item'],
	['tip', '{@tip Die Size|Psionic Energy Die Size}', 'Die Size'],
	['optfeature', '{@optfeature Thirsting Blade|XPHB}', 'Thirsting Blade'],
	['deck', '{@deck Tarokka Deck|CoS|tarokka decks}', 'tarokka decks'],
	['object', '{@object Eldritch Cannon|EFA}', 'Eldritch Cannon'],
	['language', '{@language Sylvan}', 'Sylvan'],
	['class', '{@class fighter|phb|Battle Master|Battle Master|phb|2-0}', 'Battle Master'],
	['subclassFeature', '{@subclassFeature Arcane Jolt|Artificer|EFA|Battle Smith|EFA|9|EFA}', 'Arcane Jolt'],
]

describe('resolveTag — every tag found in data/', () => {
	beforeEach(resetUnknownTagWarnings)

	it.each(TAG_CASES)('{@%s} displays %s as "%s"', (tag, markup, display) => {
		const resolved = resolve(markup)
		expect(resolved.name).toBe(tag)
		expect(resolved.display).toBe(display)
		expect(resolved.isUnknown).toBe(false)
	})

	it('covers all 38 tags the inventory found', () => {
		expect(TAG_CASES).toHaveLength(38)
	})

	it('exercises every tag the module claims to handle', () => {
		const exercised = new Set(TAG_CASES.map(([tag]) => tag))
		const unexercised = getHandledTagNames().filter((name) => !exercised.has(name))
		expect(unexercised).toEqual([])
	})
})

describe('resolveTag — value semantics', () => {
	beforeEach(resetUnknownTagWarnings)

	it('writes versatile damage alternatives with a slash', () => {
		expect(resolve('{@damage 1d8;1d10}').display).toBe('1d8/1d10')
	})

	it('signs a to-hit bonus, including a negative one', () => {
		expect(resolve('{@hit 5}').display).toBe('+5')
		expect(resolve('{@hit -1}').display).toBe('-1')
	})

	it('leaves a non-numeric to-hit alone', () => {
		expect(resolve('{@hit special}').display).toBe('special')
	})

	it('honours an explicit display override on a DC', () => {
		expect(resolve('{@dc 15|fifteen}').display).toBe('DC fifteen')
	})

	it('ignores the success/failure flavour arguments on a chance', () => {
		// {@chance 25|||Random reading!|Regular reading} — arguments 4 and 5 are
		// roll outcomes, not display text.
		expect(resolve('{@chance 25|||Random reading!|Regular reading}').display).toBe(
			'25 percent',
		)
	})

	it('shows the per-step increment for upcast scaling', () => {
		expect(resolve('{@scaledamage 3d8|2-9|1d8}').display).toBe('1d8')
	})

	it('marks emphasis tags', () => {
		expect(resolve('{@b bold}')).toMatchObject({ kind: 'emphasis', emphasis: 'bold' })
		expect(resolve('{@i italic}')).toMatchObject({ kind: 'emphasis', emphasis: 'italic' })
	})
})

describe('resolveTag — references keep their target', () => {
	beforeEach(resetUnknownTagWarnings)

	it('preserves name and source so a link can be built later', () => {
		expect(resolve('{@spell Fireball|XPHB}').reference).toEqual({
			category: 'spell',
			name: 'Fireball',
			source: 'XPHB',
			args: ['Fireball', 'XPHB'],
		})
	})

	it('preserves the target even when a display override hides it', () => {
		const resolved = resolve('{@item +1 Armor|XDMG|Armor +1}')
		expect(resolved.display).toBe('Armor +1')
		expect(resolved.reference?.name).toBe('+1 Armor')
		expect(resolved.reference?.source).toBe('XDMG')
	})

	it('does not invent a source when the data omitted one', () => {
		// A blank source means the 2014 PHB (NOTES.md). Defaulting it here would
		// hide that from whatever resolves the reference.
		expect(resolve('{@condition prone}').reference?.source).toBe('')
		expect(resolve('{@status concentration||concentrating}').reference?.source).toBe('')
	})

	it('keeps every argument for multi-part targets', () => {
		expect(
			resolve('{@classFeature Replicate Magic Item|Artificer|EFA|2|EFA}').reference?.args,
		).toEqual(['Replicate Magic Item', 'Artificer', 'EFA', '2', 'EFA'])
	})
})

describe('resolveTag — unknown tags', () => {
	beforeEach(resetUnknownTagWarnings)
	afterEach(() => vi.restoreAllMocks())

	it('falls back to the first argument and never shows braces', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const resolved = resolve('{@madeUpTag some text|XPHB}')
		expect(resolved.display).toBe('some text')
		expect(resolved.isUnknown).toBe(true)
		expect(resolved.display).not.toContain('{')
		expect(resolved.display).not.toContain('}')
		warn.mockRestore()
	})

	it('warns once per tag name, not once per occurrence', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		resolve('{@madeUpTag first}')
		resolve('{@madeUpTag second}')
		resolve('{@madeUpTag third}')
		expect(warn).toHaveBeenCalledTimes(1)

		resolve('{@anotherFakeTag x}')
		expect(warn).toHaveBeenCalledTimes(2)

		expect(getUnknownTagsSeen()).toEqual(['anotherFakeTag', 'madeUpTag'])
		warn.mockRestore()
	})

	it('handles an unknown tag with no arguments', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		expect(resolve('{@mystery}').display).toBe('')
		warn.mockRestore()
	})
})

/*
 * A guard, not a unit test: if extract-data.js ever starts emitting a tag the
 * renderer has never seen, this fails instead of a warning appearing quietly
 * in a player's console.
 */
describe('coverage of the real data', () => {
	it('handles every tag that actually occurs in data/', () => {
		const dataDir = join(process.cwd(), 'data')
		const handled = new Set(getHandledTagNames())
		const found = new Set<string>()

		for (const file of readdirSync(dataDir).filter((name) => name.endsWith('.json'))) {
			const raw = readFileSync(join(dataDir, file), 'utf8')
			for (const match of raw.matchAll(/\{@([A-Za-z0-9]+)/g)) {
				const name = match[1]
				if (name) found.add(name)
			}
		}

		expect(found.size).toBeGreaterThan(0)
		expect([...found].filter((name) => !handled.has(name)).sort()).toEqual([])
	})
})
