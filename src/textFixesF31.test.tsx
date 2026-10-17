// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { damageText } from './calculation/weaponAttacks'
import { featDisplayName } from './featAsi/featInstances'
import { FEAT_CATEGORY_LABELS, featCategoryLabel } from './featAsi/featAsiData'
import { keptSpellsText } from './levelUp/RemoveLevelButton'
import { ReplaceNamedPickControl } from './optionalFeatures/ReplaceOptionControl'
import { formatSpeciesName } from './species/speciesData'
import { readableEntryError } from './storage/characterStore'

afterEach(cleanup)

describe('F-31a text fixes', () => {
	it('6: a "; Class" feat name is displayed with parentheses, other names are untouched', () => {
		expect(featDisplayName('Magic Initiate; Cleric')).toBe('Magic Initiate (Cleric)')
		expect(featDisplayName('Alert')).toBe('Alert')
	})

	it('15: Dragonmark and the two class Fighting Style categories have labels', () => {
		expect(featCategoryLabel('D')).toBe('Dragonmark')
		expect(FEAT_CATEGORY_LABELS['FS:P']).toBe('Fighting Style (Paladin)')
		expect(FEAT_CATEGORY_LABELS['FS:R']).toBe('Fighting Style (Ranger)')
	})

	it('8: the replace text uses the plural noun it is given', () => {
		render(<ReplaceNamedPickControl label="maneuvers" held={['Riposte']} value={['Riposte']} count={1} onChange={() => {}} />)
		expect(screen.getByText('You may replace one of your maneuvers with another one.')).toBeTruthy()
	})

	it('1: "Other" is added only when the list above removes spells', () => {
		expect(keptSpellsText(['Fighting style: Defense'], false)).toBe('Known and prepared spells are kept.')
		expect(keptSpellsText(['Pact of the Tome spell: Guidance'], false)).toBe('Other known and prepared spells are kept.')
		expect(keptSpellsText(['Wizard spell: Shield'], true)).toBe('Other known and prepared spells of the other classes are kept.')
	})

	it('3: flat damage shows the computed number, never below 0', () => {
		expect(damageText(null, -1, 'bludgeoning')).toBe('0 bludgeoning')
		expect(damageText(null, 3, '')).toBe('4')
		expect(damageText('1d8', -1, 'slashing')).toBe('1d8 - 1 slashing')
	})

	it('21: an import error is one sentence counted from 1 and keeps the field path', () => {
		expect(readableEntryError('[0].hitPointLevels[19].level must be a whole number from 1 to 20')).toBe(
			'Character 1 in the file could not be imported: hitPointLevels[19].level must be a whole number from 1 to 20.',
		)
		expect(readableEntryError('[0].name is missing', 'read')).toBe('Character 1 in storage could not be read: name is missing.')
		expect(formatSpeciesName('Genasi; Air')).toBe('Genasi (Air)')
		expect(formatSpeciesName('Elf; Drow Lineage')).toBe('Elf (Drow Lineage)')
		expect(formatSpeciesName('Air', 'MPMM')).toBe('Genasi (Air)')
		expect(formatSpeciesName('Air')).toBe('Air')
		expect(formatSpeciesName('Human')).toBe('Human')
	})
})
