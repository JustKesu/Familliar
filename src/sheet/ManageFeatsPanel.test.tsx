// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ResolverData } from '../featureResolver'
import { FeatText } from './ManageFeatsPanel'

afterEach(cleanup)

describe('FeatText', () => {
	it('names a feat without text by its display name (F-32a)', () => {
		render(<FeatText entries={null} name="Magic Initiate; Cleric" resolverData={{} as ResolverData} />)
		expect(screen.getByText('No text found for “Magic Initiate (Cleric)”.')).toBeTruthy()
	})
})
