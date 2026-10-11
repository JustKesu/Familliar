import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareText } from './compareText'

describe('compareText (F-18)', () => {
	it('sorts "Ch" before "H" the English way, whatever the process locale is', () => {
		expect(['Hex', 'Chill Touch', "Hunter's Mark"].sort(compareText)).toEqual(['Chill Touch', 'Hex', "Hunter's Mark"])
		// A Czech collator would put "Chill Touch" last; proves the helper does not follow it.
		expect(['Hex', 'Chill Touch'].sort(new Intl.Collator('cs').compare)).toEqual(['Hex', 'Chill Touch'])
	})
})

describe('no locale-dependent sorting in src (F-18)', () => {
	it('uses compareText instead of the locale-less string comparison', () => {
		const root = join(__dirname, '..')
		const needle = '.locale' + 'Compare('
		const offenders: string[] = []
		const walk = (dir: string): void => {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				const path = join(dir, entry.name)
				if (entry.isDirectory()) walk(path)
				else if (/\.tsx?$/.test(entry.name) && entry.name !== 'compareText.ts' && entry.name !== 'compareText.test.ts' && readFileSync(path, 'utf8').includes(needle)) {
					offenders.push(relative(root, path))
				}
			}
		}
		walk(root)
		expect(offenders, `${offenders.join(', ')}: use compareText from src/text/compareText.ts, the system-locale string comparison sorts "Ch" after "H" on Czech systems`).toEqual([])
	})
})
