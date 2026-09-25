// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { computeProficiencies, extractFeatProficiencyEntries } from '../calculation/proficiencies'
import { computeSkill } from '../calculation/skills'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { missingFeatSubChoices } from '../sheet/featSubChoices'
import { extractFeatGrantedSpells } from '../spells/featSpells'
import type { Character, FeatChoiceDetails } from '../storage/character'
import { FeatSubChoicePicker, LATER_CHOICE_NOTE, type FeatChoiceHeld } from './FeatSubChoicePicker'
import { featInstances } from './featInstances'

/* Task A3: the shared feat sub-choice picker. feats.json is stubbed with the real shapes (DATA.md). */

const CRAFTER_TOOLS = ["carpenter's tools", "leatherworker's tools", "mason's tools", "potter's tools", "smith's tools", "tinker's tools", "weaver's tools", "woodcarver's tools"]

const FEATS = [
	{ name: 'Skilled', source: 'XPHB', skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }] },
	{ name: 'Skill Expert', source: 'XPHB', skillProficiencies: [{ any: 1 }], expertise: [{ anyProficientSkill: 1 }] },
	{
		name: 'Prodigy',
		source: 'XGE',
		skillProficiencies: [{ choose: { from: ['arcana', 'history', 'stealth'] } }],
		toolProficiencies: [{ any: 1 }],
		languageProficiencies: [{ any: 1 }],
		expertise: [{ anyProficientSkill: 1 }],
	},
	{ name: 'Crafter', source: 'XPHB', toolProficiencies: [{ choose: { from: CRAFTER_TOOLS, count: 3 } }] },
	{ name: 'Tough', source: 'XPHB' },
	{ name: 'Magic Initiate; Cleric', source: 'XPHB' },
]

vi.mock('../dataLoader/dataLoader', () => ({
	loadDataFile: vi.fn(async (path: string) => {
		if (path === 'data/feats.json') return FEATS
		throw new Error(`unexpected ${path}`)
	}),
}))

vi.mock('../toolProficiencies/toolProficiencyData', () => ({
	loadToolCategoryOptions: vi.fn(async (category: string) => {
		const lists: Record<string, string[]> = {
			anyArtisansTool: ["Alchemist's Supplies", "Carpenter's Tools", "Smith's Tools", "Tinker's Tools", "Woodcarver's Tools"],
			anyGamingSet: ['Dice Set'],
			anyMusicalInstrument: ['Lute'],
			anyOtherTool: ["Thieves' Tools"],
		}
		return lists[category] ?? []
	}),
}))

vi.mock('../languages/languageData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../languages/languageData')>()),
	loadLanguages: vi.fn(async () => [
		{ name: 'Dwarvish', source: 'XPHB' },
		{ name: 'Elvish', source: 'XPHB' },
		{ name: 'Druidic', source: 'XPHB' },
	]),
}))

vi.mock('../spells/classSpellListData', () => ({
	loadClassSpellList: vi.fn(async (className: string) =>
		className === 'Cleric'
			? [
					{ name: 'Guidance', level: 0 },
					{ name: 'Sacred Flame', level: 0 },
					{ name: 'Thaumaturgy', level: 0 },
					{ name: 'Bless', level: 1 },
				].map((spell) => ({ ...spell, source: 'XPHB', ritual: false, concentration: false, viaVariant: false }))
			: [],
	),
}))

afterEach(cleanup)

const scores = { method: 'standardArray' as const, scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } }
const NOTHING: FeatChoiceHeld = { heldSkills: [], heldExpertise: [], heldTools: [], knownLanguages: [] }

function Harness({ feat, onValue, held = NOTHING, laterNote = false, magicInitiateRequired = false }: {
	feat: { name: string; source: string }
	onValue: (value: FeatChoiceDetails) => void
	held?: FeatChoiceHeld
	laterNote?: boolean
	magicInitiateRequired?: boolean
}) {
	const [value, setValue] = useState<FeatChoiceDetails>({})
	return (
		<FeatSubChoicePicker
			feat={feat}
			value={value}
			onChange={(next) => {
				setValue(next)
				onValue(next)
			}}
			held={held}
			laterNote={laterNote}
			magicInitiateRequired={magicInitiateRequired}
			idPrefix="test"
		/>
	)
}

function renderPicker(props: Omit<Parameters<typeof Harness>[0], 'onValue'>) {
	let latest: FeatChoiceDetails = {}
	render(<Harness {...props} onValue={(value) => (latest = value)} />)
	return () => latest
}

const optionTexts = (select: HTMLElement) => within(select).getAllByRole('option').map((option) => option.textContent)

describe('FeatSubChoicePicker (task A3)', () => {
	it('Skilled at ASI: 2 skills + 1 tool — the skills count on the sheet, the tool shows on the Proficiencies card', async () => {
		const user = userEvent.setup()
		const latest = renderPicker({ feat: { name: 'Skilled', source: 'XPHB' } })
		await user.selectOptions(await screen.findByLabelText('Skilled skill or tool 1'), 'skill:arcana')
		await user.selectOptions(screen.getByLabelText('Skilled skill or tool 2'), 'skill:history')
		await user.selectOptions(screen.getByLabelText('Skilled skill or tool 3'), "tool:Smith's Tools")
		expect(latest().proficiencies).toEqual({ skills: ['arcana', 'history'], tools: ["Smith's Tools"] })

		const character: Character = { id: '1', name: 'A', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }], abilityScores: scores, featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB', ...latest() }] }
		const entries = FEATS as unknown as FeatEffectEntry[]
		expect(computeSkill('arcana', character, entries)).toMatchObject({ value: { status: 'proficient' } })
		expect(computeSkill('history', character, entries)).toMatchObject({ value: { status: 'proficient' } })
		const card = computeProficiencies(character, [], featInstances(character, null), extractFeatProficiencyEntries(FEATS))
		expect(card.tools).toContainEqual(expect.objectContaining({ label: "Smith's Tools", sources: [{ kind: 'feat', name: 'Skilled (feat)' }] }))
		expect(missingFeatSubChoices(featInstances(character, null)[0], entries)).toEqual([])
	})

	it('Skill Expert: expertise may go on the skill the same feat just granted (D159)', async () => {
		const user = userEvent.setup()
		const latest = renderPicker({ feat: { name: 'Skill Expert', source: 'XPHB' }, held: { ...NOTHING, heldSkills: [{ skill: 'athletics', source: 'Fighter' }] } })
		const expertise = await screen.findByLabelText('Skill Expert expertise')
		expect(optionTexts(expertise)).not.toContain('Religion')
		await user.selectOptions(screen.getByLabelText('Skill Expert skill'), 'religion')
		expect(optionTexts(screen.getByLabelText('Skill Expert expertise'))).toEqual(expect.arrayContaining(['Athletics', 'Religion']))
		await user.selectOptions(screen.getByLabelText('Skill Expert expertise'), 'religion')
		expect(latest().proficiencies).toEqual({ skills: ['religion'], expertise: ['religion'] })

		// Taking the skill back takes the expertise on it with it.
		await user.selectOptions(screen.getByLabelText('Skill Expert skill'), 'stealth')
		expect(latest().proficiencies).toEqual({ skills: ['stealth'] })
	})

	it('Prodigy: skill, any tool, language and expertise; the language is on the card with the feat as source, not in Character.languages', async () => {
		const user = userEvent.setup()
		const latest = renderPicker({ feat: { name: 'Prodigy', source: 'XGE' }, held: { ...NOTHING, knownLanguages: ['Common', 'Dwarvish'] } })
		await user.selectOptions(await screen.findByLabelText('Prodigy skill'), 'stealth')
		const tools = screen.getByLabelText('Prodigy tool')
		expect(optionTexts(tools)).toEqual(expect.arrayContaining(["Alchemist's Supplies", 'Dice Set', 'Lute', "Thieves' Tools"]))
		await user.selectOptions(tools, "Thieves' Tools")
		const languages = screen.getByLabelText('Prodigy language')
		expect(optionTexts(languages)).not.toContain('Dwarvish')
		expect(optionTexts(languages)).not.toContain('Druidic')
		await user.selectOptions(languages, 'Elvish|XPHB')
		await user.selectOptions(screen.getByLabelText('Prodigy expertise'), 'stealth')
		expect(latest().proficiencies).toEqual({ skills: ['stealth'], tools: ["Thieves' Tools"], languages: [{ name: 'Elvish', source: 'XPHB' }], expertise: ['stealth'] })

		const character: Character = { id: '1', name: 'A', classes: [], featAsiChoices: [{ level: 4, kind: 'feat', name: 'Prodigy', source: 'XGE', ...latest() }] }
		expect(character.languages).toBeUndefined()
		const card = computeProficiencies(character, [], featInstances(character, null), extractFeatProficiencyEntries(FEATS))
		expect(card.languages).toContainEqual(expect.objectContaining({ label: 'Elvish', sources: [{ kind: 'feat', name: 'Prodigy (feat)' }] }))
		expect(card.languages.filter((item) => item.pending)).toEqual([])
	})

	it("Crafter: only its own artisan's tools, minus a tool already held", async () => {
		renderPicker({ feat: { name: 'Crafter', source: 'XPHB' }, held: { ...NOTHING, heldTools: ["Smith's Tools"] } })
		const first = await screen.findByLabelText('Crafter tool 1')
		expect(optionTexts(first)).toEqual(['— tool not chosen —', "Carpenter's Tools", "Tinker's Tools", "Woodcarver's Tools"])
	})

	it('a skill held elsewhere is shown but cannot be picked (D160)', async () => {
		renderPicker({ feat: { name: 'Skilled', source: 'XPHB' }, held: { ...NOTHING, heldSkills: [{ skill: 'Arcana', source: 'Sage' }], heldTools: ["Thieves' Tools"] } })
		const slot = await screen.findByLabelText('Skilled skill or tool 1')
		const arcana = within(slot).getByRole('option', { name: 'Arcana (from Sage)' }) as HTMLOptionElement
		expect(arcana.disabled).toBe(true)
		expect(optionTexts(slot)).not.toContain("Thieves' Tools")
	})

	it('Magic Initiate; Cleric from a background: the list is fixed, and the spells and ability picked count on the sheet', async () => {
		const user = userEvent.setup()
		const latest = renderPicker({ feat: { name: 'Magic Initiate; Cleric', source: 'XPHB' }, laterNote: true })
		expect(screen.getByText(LATER_CHOICE_NOTE)).toBeTruthy()
		expect(screen.queryByRole('radio')).toBeNull()
		await user.click(await screen.findByLabelText('Guidance'))
		await user.click(screen.getByLabelText('Sacred Flame'))
		await user.click(screen.getByLabelText('Bless'))
		await user.selectOptions(screen.getByLabelText('Ability'), 'wisdom')

		const acolyte: Character = {
			id: '1',
			name: 'A',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
			grantedFeats: [{ origin: 'background', name: 'Magic Initiate; Cleric', source: 'XPHB', ...latest() }],
		}
		const originFeat = { name: 'Magic Initiate; Cleric', source: 'XPHB' }
		const spells = ['Guidance', 'Sacred Flame', 'Bless'].map((name, index) => ({ name, source: 'XPHB', level: index === 2 ? 1 : 0 }))
		expect(extractFeatGrantedSpells([], spells, acolyte, originFeat).map((spell) => [spell.name, spell.ability])).toEqual([
			['Guidance', 'wis'],
			['Sacred Flame', 'wis'],
			['Bless', 'wis'],
		])
		expect(missingFeatSubChoices(featInstances(acolyte, originFeat)[0], [])).toEqual([])
	})

	it('shows the "later" line only when asked, and never for the ASI step\'s required Magic Initiate', async () => {
		const { unmount } = render(<Harness feat={{ name: 'Crafter', source: 'XPHB' }} onValue={() => {}} laterNote />)
		expect(await screen.findByText(LATER_CHOICE_NOTE)).toBeTruthy()
		unmount()
		render(<Harness feat={{ name: 'Magic Initiate; Cleric', source: 'XPHB' }} onValue={() => {}} laterNote magicInitiateRequired />)
		await screen.findByLabelText('Guidance')
		expect(screen.queryByText(LATER_CHOICE_NOTE)).toBeNull()
	})

	it('renders nothing for a feat with no sub-choice', async () => {
		const { container } = render(<Harness feat={{ name: 'Tough', source: 'XPHB' }} onValue={() => {}} laterNote />)
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(container.innerHTML).toBe('')
	})
})
