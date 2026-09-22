import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/* Rework R2 (D153). jsdom has no layout engine, so the scroll containment is guarded on the stylesheet itself. */

const CSS = readFileSync('src/index.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function declarations(selector: string): Record<string, string> {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const match = CSS.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
	if (!match) throw new Error(`No rule for ${selector} in index.css`)
	return Object.fromEntries(
		match[1]
			.split(';')
			.map((part) => part.trim())
			.filter((part) => part.includes(':'))
			.map((part) => [part.slice(0, part.indexOf(':')).trim(), part.slice(part.indexOf(':') + 1).trim()]),
	)
}

describe('sheet scroll containment (D153)', () => {
	it('sizes the sheet view to the viewport through a chain of bounded flex columns', () => {
		expect(declarations('#root:has(> .sheet-view)')).toMatchObject({ display: 'flex', 'flex-direction': 'column', height: '100dvh' })
		expect(declarations('.sheet-view')).toMatchObject({ flex: '1', 'min-height': '0', display: 'flex', 'flex-direction': 'column' })
		expect(declarations('.sheet-view > .sheet')).toMatchObject({ flex: '1', 'min-height': '0', display: 'flex', 'flex-direction': 'column' })
		expect(declarations('.sheet__body')).toMatchObject({ flex: '1', 'min-height': '0', display: 'flex' })
	})

	it('lets the left column scroll on its own at a fixed width, bounded by the body row', () => {
		expect(declarations('.sheet__left-column')).toMatchObject({ flex: '0 0 580px', 'min-height': '0', 'overflow-y': 'auto' })
	})

	it('scrolls the tab panels inside the right side, below a tab bar that stays put', () => {
		expect(declarations('.sheet__right-panel')).toMatchObject({ 'min-height': '0', display: 'flex', 'flex-direction': 'column' })
		expect(declarations('.sheet__right-panel > .sheet__tabs')).toMatchObject({ flex: 'none' })
		expect(declarations('.sheet__panels')).toMatchObject({ flex: '1', 'min-height': '0', 'overflow-y': 'auto' })
	})

	it('gives no other sheet container a scroll of its own', () => {
		const scrolling = [...CSS.matchAll(/(?:^|\n)([^{}\n][^{}]*?)\s*\{([^}]*)\}/g)]
			.filter(([, , body]) => /overflow(-y)?\s*:\s*(auto|scroll)/.test(body))
			.map(([, selector]) => selector.trim())
			.filter((selector) => /sheet|^#root|^html$|^body$|^main$/.test(selector))
		expect(scrolling.sort()).toEqual(['.sheet__left-column', '.sheet__panels'])
	})
})
