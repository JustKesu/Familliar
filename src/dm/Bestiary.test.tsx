// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Bestiary } from './Bestiary'

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
})

describe('Bestiary load failure (D43)', () => {
	it('shows an error card instead of crashing when monsters.json is missing', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
		render(<Bestiary />)
		expect((await screen.findByRole('alert')).textContent).toMatch(/bestiary could not be loaded/i)
	})

	it('shows an error card when the file is not a list', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{"broken": true}', { status: 200 })))
		render(<Bestiary />)
		expect((await screen.findByRole('alert')).textContent).toMatch(/expected a top-level array/)
	})
})
