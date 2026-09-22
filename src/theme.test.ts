import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = 'src'
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/

function cssFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return cssFiles(path)
		return entry.name.endsWith('.css') ? [path] : []
	})
}

describe('theme tokens', () => {
	it('no stylesheet under src/ other than theme.css holds a colour literal', () => {
		const offenders = cssFiles(SRC)
			.filter((path) => relative(SRC, path) !== 'theme.css')
			.flatMap((path) =>
				readFileSync(path, 'utf8')
					.split('\n')
					.map((line, index) => ({ line, index }))
					.filter(({ line }) => COLOUR_LITERAL.test(line))
					.map(({ line, index }) => `${relative(SRC, path)}:${index + 1}: ${line.trim()}`),
			)
		expect(offenders).toEqual([])
	})
})
