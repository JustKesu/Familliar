// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { Character } from '../../storage/character'
import type { LevelGains } from '../../levelUp/levelGains'
import { emptyWizardData, type WizardData, type WizardStep } from '../wizardState'
import { ReviewStep } from './ReviewStep'

vi.mock('../../abilities/AbilityScoreTable', () => ({ AbilityScoreTable: () => null }))
vi.mock('../../sheet/sheetData', () => ({ loadFeatEffectEntries: vi.fn(async () => []) }))

afterEach(cleanup)

const LEVEL_UP = { level: 6, unresolved: null, newFeatures: [], steps: {} } as unknown as LevelGains
const ALL_STEPS: WizardStep[] = ['abilities', 'languages', 'spells', 'featAsi', 'hitPoints', 'expertise']

function renderReview(overrides: Partial<Omit<ComponentProps<typeof ReviewStep>, 'data'>> & { data?: Partial<WizardData> } = {}) {
	const { data, ...rest } = overrides
	return render(
		<ReviewStep
			data={{ ...emptyWizardData(), name: 'Mira', ...data }}
			baseline={emptyWizardData()}
			speciesLabel="Elf — High Elf"
			draft={{ classes: [] } as unknown as Character}
			abilityDraft={{} as Character}
			resolverData={{} as never}
			proficiencies={{ skills: [], expertise: [], armor: [], weapons: [], tools: [], languages: [] }}
			feats={[]}
			maxHp={20}
			hitDice="6d8"
			hpGain={null}
			maxHpOverride={null}
			startingInventory={null}
			staleExpertise={[]}
			steps={ALL_STEPS}
			onGoTo={() => {}}
			saveError={null}
			{...rest}
		/>,
	)
}

const spell = (name: string, level = 1) => ({ name, source: 'XPHB', level })

describe('ReviewStep spells', () => {
	it('lists cantrips (with the readable species label), leveled picks, class options and subclass picks in the Spells card', () => {
		renderReview({
			data: {
				spellChoices: [spell('Fire Bolt', 0), spell('Shield', 1), spell('Misty Step', 2)],
				subclassSpellChoices: [{ ...spell('Detect Magic', 1), grantedAtLevel: 3, slotIndex: 0 }],
				classOptionalFeatureChoices: [{ featureType: 'EI', choices: [], spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Guidance', source: 'XPHB' }], spells: [{ name: 'Find Familiar', source: 'XPHB' }] }] }],
				speciesCantrip: { name: 'Prestidigitation', source: 'XPHB' },
			},
		})
		const card = screen.getByRole('region', { name: 'Spells' })
		const row = (label: string) => within(card).getByText(label).parentElement!.textContent
		expect(row('Cantrips')).toBe('CantripsFire Bolt, Guidance, Prestidigitation (Elf — High Elf)')
		expect(row('Level 1')).toBe('Level 1Shield')
		expect(row('Level 2')).toBe('Level 2Misty Step')
		expect(row('From class options')).toBe('From class optionsFind Familiar')
		expect(row('Subclass')).toBe('SubclassDetect Magic')
	})

	it('has no Spells card without spells', () => {
		renderReview()
		expect(screen.queryByRole('region', { name: 'Spells' })).toBeNull()
	})

	it('"Spells added" counts spells from class options taken at this level and leaves out the ones the character already had', () => {
		const known = { name: 'Guidance', source: 'XPHB' }
		const baseline: WizardData = { ...emptyWizardData(), spellChoices: [spell('Shield')], classOptionalFeatureChoices: [{ featureType: 'EI', choices: [], spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [known], spells: [] }] }] }
		renderReview({
			levelUp: LEVEL_UP,
			baseline,
			data: {
				spellChoices: [spell('Shield'), spell('Sleep')],
				classOptionalFeatureChoices: [
					{ featureType: 'EI', choices: [], spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [known], spells: [{ name: 'Find Familiar', source: 'XPHB' }] }] },
				],
			},
		})
		const added = within(screen.getByRole('region', { name: /What.s new/ })).getByText('Spells added').parentElement!.textContent
		expect(added).toBe('Spells addedSleep, Find Familiar')
	})
})

describe('ReviewStep level up and header', () => {
	it('shows the hit point gain, or the manual maximum when one is set (D305)', () => {
		const { unmount } = renderReview({ levelUp: LEVEL_UP, hpGain: 6, maxHp: 30 })
		expect(screen.getByText('+6 → 30')).toBeTruthy()
		unmount()
		renderReview({ levelUp: LEVEL_UP, hpGain: 0, maxHp: 30, maxHpOverride: 30 })
		expect(screen.getByText('Manual maximum: 30')).toBeTruthy()
		expect(screen.queryByText(/→/)).toBeNull()
	})

	it('names the portrait "Portrait" and renders no letter when the name is empty', () => {
		const { unmount } = renderReview({ data: { name: '  ', portrait: 'data:image/png;base64,AAAA' } })
		expect(screen.getByAltText('Portrait')).toBeTruthy()
		unmount()
		const { container } = renderReview({ data: { name: '' } })
		expect(container.querySelector('.review__portrait span')).toBeNull()
	})

	it('makes the Equipment card a named region', () => {
		renderReview({ startingInventory: { inventory: [], currencyCopper: 0 } })
		expect(screen.getByRole('region', { name: 'Equipment' })).toBeTruthy()
	})
})

describe('ReviewStep stale Expertise', () => {
	it('offers "Go to Expertise" only while the walk has an Expertise step (D304)', async () => {
		const onGoTo = vi.fn()
		const stale = [{ skill: 'arcana', reason: 'proficiency' as const }]
		const { unmount } = renderReview({ staleExpertise: stale, onGoTo })
		expect(screen.getByRole('alert').textContent).toContain('Expertise in Arcana needs a proficiency you no longer have.')
		await userEvent.click(screen.getByRole('button', { name: 'Go to Expertise' }))
		expect(onGoTo).toHaveBeenCalledWith('expertise')
		unmount()

		renderReview({ staleExpertise: stale, steps: ['hitPoints'] })
		expect(screen.queryByRole('button', { name: 'Go to Expertise' })).toBeNull()
		expect(screen.getByRole('alert').textContent).toContain('Fix it in Edit Character.')
	})

	it('words a pick that is still proficient but excluded differently from a lost proficiency (D307)', () => {
		renderReview({
			staleExpertise: [
				{ skill: 'arcana', reason: 'taken' },
				{ skill: 'history', reason: 'restricted' },
			],
		})
		const text = screen.getByRole('alert').textContent!
		expect(text).toContain('Arcana already has Expertise from another source.')
		expect(text).toContain("Expertise in History is not in this class's allowed list.")
		expect(text).not.toContain('no longer have')
	})
})
