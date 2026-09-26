import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Ability } from '../abilities/abilityScores'
import type { Character, MagicInitiateChoice } from '../storage/character'
import { extractFeatGrantedSpells, extractFixedFeatSpells } from './featSpells'

describe('Strixhaven Initiate named blocks (D200)', () => {
	const block = (name: string, cantrips: string[], classes: string) => ({
		name,
		ability: { choose: ['int', 'wis', 'cha'] },
		known: { _: cantrips.map((c) => `${c}#c`) },
		innate: { _: { daily: { '1': [{ choose: `level=1|class=${classes}` }] } } },
	})
	const feats = [
		{
			name: 'Strixhaven Initiate',
			source: 'SCC',
			additionalSpells: [block('Lorehold 1', ['light', 'sacred flame'], 'cleric;wizard'), block('Quandrix 2', ['druidcraft', 'mage hand'], 'druid;wizard')],
		},
	]
	const spells = ['Light', 'Sacred Flame', 'Druidcraft', 'Mage Hand'].map((name) => ({ name, source: 'XPHB', level: 0 }))

	it('grants only the chosen block, with the chosen ability', () => {
		const granted = extractFixedFeatSpells(feats, spells, 'Strixhaven Initiate', 'SCC', 4, 'wis', 'Quandrix 2')
		expect(granted.map((s) => s.name)).toEqual(['Druidcraft', 'Mage Hand'])
		expect(granted.every((s) => s.ability === 'wis')).toBe(true)
	})

	it('grants nothing while no block is chosen', () => {
		expect(extractFixedFeatSpells(feats, spells, 'Strixhaven Initiate', 'SCC', 4, 'wis')).toEqual([])
	})
})

describe('D204 feat spell grants — against the generated data', () => {
	const read = (name: string): unknown => JSON.parse(readFileSync(`data/${name}`, 'utf8'))
	const realFeats = read('feats.json')
	const realSpells = read('spells.json')
	const LR = { kind: 'onceFreePerLongRest' }
	const grant = (name: string, source: string, chosenAbility?: 'int' | 'wis' | 'cha') =>
		extractFixedFeatSpells(realFeats, realSpells, name, source, 20, chosenAbility)
			.map((s) => ({ name: s.name, level: s.level, usage: s.usage ?? null, ability: s.ability }))
			.sort((a, b) => a.name.localeCompare(b.name))

	it.each([
		['Gathered Whispers', 'RHW', [{ name: 'Augury', level: 2, usage: LR }, { name: 'Message', level: 0, usage: null }]],
		['Living Shadow', 'RHW', [{ name: 'Mage Hand', level: 0, usage: null }]],
		['Second Skin', 'RHW', [{ name: 'Alter Self', level: 2, usage: LR }]],
		['Touch of Death', 'RHW', [{ name: 'Chill Touch', level: 0, usage: null }]],
		['Watchers', 'RHW', [{ name: 'Beast Sense', level: 2, usage: LR }, { name: 'Speak with Animals', level: 1, usage: LR }]],
		['Boon of Revelry', 'FRHoF', [{ name: "Otto's Irresistible Dance", level: 6, usage: LR }]],
		['Telepathic', 'XPHB', [{ name: 'Detect Thoughts', level: 2, usage: LR }]],
		['Telekinetic', 'XPHB', [{ name: 'Mage Hand', level: 0, usage: null }]],
	] as const)('%s (%s) grants its spells with the chosen ability', (name, source, expected) => {
		expect(grant(name, source, 'wis')).toEqual(expected.map((spell) => ({ ...spell, ability: 'wis' })))
	})

	it('Boon of Siberys (hidden, 13 alternatives) still grants nothing', () => {
		expect(grant('Boon of Siberys', 'EFA', 'int')).toEqual([])
	})

	it('a Dark Gift with no ability stored is still granted, carrying the unresolved reason instead of an ability', () => {
		const character: Character = { id: 't', name: 'T', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }], featAsiChoices: [{ level: 4, kind: 'feat', name: 'Touch of Death', source: 'RHW' }] }
		const [chillTouch] = extractFeatGrantedSpells(realFeats, realSpells, character, null)
		expect(chillTouch).toMatchObject({ name: 'Chill Touch', ability: undefined, unresolvedAbilityReason: 'spellcasting ability not chosen yet' })
	})
})

const markOfDetection = {
	name: 'Mark of Detection',
	source: 'EFA',
	additionalSpells: [
		{
			ability: { choose: ['int', 'wis', 'cha'] },
			prepared: {
				3: { daily: { 1: ['see invisibility'] } },
				_: { daily: { 1: ['detect magic'] } },
			},
			expanded: {
				s1: ['detect evil and good', 'identify'],
			},
		},
	],
}

const markOfStorm = {
	name: 'Mark of Storm',
	source: 'EFA',
	additionalSpells: [
		{
			ability: { choose: ['int', 'wis', 'cha'] },
			known: { _: ['thunderclap'] },
			prepared: { 3: { daily: { 1: ['gust of wind'] } } },
			expanded: {
				s1: ['feather fall', 'fog cloud'],
			},
		},
	],
}

const drowHighMagic = {
	name: 'Drow High Magic',
	source: 'XGE',
	additionalSpells: [
		{
			ability: 'cha',
			innate: {
				_: {
					will: ['detect magic'],
					daily: { '1e': ['levitate', 'dispel magic'] },
				},
			},
		},
	],
}

const feyTeleportation = {
	name: 'Fey Teleportation',
	source: 'XGE',
	additionalSpells: [
		{
			ability: 'int',
			innate: {
				_: { daily: { '1': ['misty step'] } },
			},
		},
	],
}

/** Synthetic — no real feat has this shape, but subclassPreparedSpells.ts's College of Glamour proved the SAME FIXED_GRANT_KEYS loop shape can double-emit a spell listed under two keys (this task); this fixture exercises the same dedup in extractFixedFeatSpells. */
const duplicateGrantFeat = {
	name: 'Test Duplicate Grant',
	source: 'XGE',
	additionalSpells: [
		{
			ability: 'wis',
			known: { _: ['thunderclap'] },
			innate: { _: ['thunderclap'] },
		},
	],
}

const feats = [drowHighMagic, feyTeleportation, markOfDetection, markOfStorm, duplicateGrantFeat]

const detectMagic = { name: 'Detect Magic', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }], meta: {} }
const levitate = { name: 'Levitate', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }], meta: {} }
const dispelMagic = { name: 'Dispel Magic', source: 'XPHB', level: 3, duration: [{ type: 'instant' }], meta: {} }
const mistyStep = { name: 'Misty Step', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }
const seeInvisibility = { name: 'See Invisibility', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }], meta: {} }
const thunderclap = { name: 'Thunderclap', source: 'XPHB', level: 0, duration: [{ type: 'instant' }], meta: {} }
const gustOfWind = { name: 'Gust of Wind', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }

const spells = [detectMagic, levitate, dispelMagic, mistyStep, seeInvisibility, thunderclap, gustOfWind]

function characterWithFeats(featChoices: { name: string; source: string; chosenAbility?: Ability }[], classes: Character['classes'] = []): Character {
	return {
		id: 'test',
		name: 'Test Character',
		classes,
		featAsiChoices: featChoices.map((f, i) => ({ level: (i + 1) * 4, kind: 'feat' as const, name: f.name, source: f.source, chosenAbility: f.chosenAbility })),
	}
}

describe('extractFeatGrantedSpells', () => {
	it('returns Drow High Magic\'s fixed spells, marked from-feat with the feat name, CHA carried as the ability', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name).sort()).toEqual(['Detect Magic', 'Dispel Magic', 'Levitate'])
		expect(result.every((s) => s.origin === 'feat')).toBe(true)
		expect(result.every((s) => s.featName === 'Drow High Magic')).toBe(true)
		expect(result.every((s) => s.ability === 'cha')).toBe(true)
	})

	it("Drow High Magic's `will` wrapper is labeled `atWill`, and its `daily` \"1e\" wrapper reads as its own text does — a free cast back on a Long Rest", () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.find((s) => s.name === 'Detect Magic')?.usage).toEqual({ kind: 'atWill' })
		expect(result.find((s) => s.name === 'Levitate')?.usage).toEqual({ kind: 'onceFreePerLongRest' })
		expect(result.find((s) => s.name === 'Dispel Magic')?.usage).toEqual({ kind: 'onceFreePerLongRest' })
	})

	it('returns Fey Teleportation\'s fixed spell, INT carried as the ability', () => {
		const character = characterWithFeats([{ name: 'Fey Teleportation', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Misty Step'])
		expect(result[0].featName).toBe('Fey Teleportation')
		expect(result[0].ability).toBe('int')
	})

	it("Fey Teleportation's daily wrapper is identical to every other one, but its own text says a SHORT rest restores the cast too", () => {
		const character = characterWithFeats([{ name: 'Fey Teleportation', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result[0].usage).toEqual({ kind: 'onceFreePerShortOrLongRest' })
	})

	it('a spell listed under two grant keys of the same feat (this task, same class of bug as College of Glamour) is returned once, not twice', () => {
		const character = characterWithFeats([{ name: 'Test Duplicate Grant', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Thunderclap'])
	})

	it('a character with neither feat returns nothing, cleanly', () => {
		const character = characterWithFeats([])
		expect(extractFeatGrantedSpells(feats, spells, character, null)).toEqual([])
	})

	it('a NON-caster (Fighter) with Fey Teleportation still gets the spell, with INT carried — the fixed ability needs no class caster', () => {
		const character = characterWithFeats([{ name: 'Fey Teleportation', source: 'XGE' }], [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Misty Step'])
		expect(result[0].ability).toBe('int')
	})

	it('carries concentration flags through and does not affect the class picker (these are additional, not stored in spellChoices)', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.find((s) => s.name === 'Detect Magic')?.concentration).toBe(true)
		expect(result.find((s) => s.name === 'Dispel Magic')?.concentration).toBe(false)
		expect(character.spellChoices ?? []).toEqual([])
	})

	it('Mark of Storm (a mark with TWO fixed grants) returns both once the character is high enough level for the gated one, with the chosen ability carried', () => {
		const character = characterWithFeats(
			[{ name: 'Mark of Storm', source: 'EFA', chosenAbility: 'wisdom' }],
			[{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 3 }],
		)
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name).sort()).toEqual(['Gust of Wind', 'Thunderclap'])
		expect(result.every((s) => s.featName === 'Mark of Storm')).toBe(true)
		expect(result.every((s) => s.ability === 'wis')).toBe(true)
		// Thunderclap is the mark's bare base cantrip (known._) — no usage label needed, it's already slot-free as a cantrip (this task).
		expect(result.find((s) => s.name === 'Thunderclap')?.usage).toBeFalsy()
		// Gust of Wind is wrapped `daily: {"1": [...]}`; the mark's own text says the free cast returns on a Long Rest.
		expect(result.find((s) => s.name === 'Gust of Wind')?.usage).toEqual({ kind: 'onceFreePerLongRest' })
	})

	it("a mark's level-3 spell is withheld below character level 3, but its always-on spell is not", () => {
		const character = characterWithFeats(
			[{ name: 'Mark of Detection', source: 'EFA', chosenAbility: 'intelligence' }],
			[{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 1 }],
		)
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Detect Magic'])
		expect(result[0].ability).toBe('int')
	})

	it("a mark's fixed spell(s) are still granted even if the character hasn't recorded a chosenAbility yet — ability comes back undefined, not invented", () => {
		const character = characterWithFeats([{ name: 'Mark of Detection', source: 'EFA' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Detect Magic'])
		expect(result[0].ability).toBeUndefined()
	})

	it("a mark's `expanded` pool-widening list does NOT leak in as a granted spell", () => {
		const character = characterWithFeats(
			[{ name: 'Mark of Storm', source: 'EFA', chosenAbility: 'charisma' }],
			[{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }],
		)
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).not.toContain('Feather Fall')
		expect(result.map((s) => s.name)).not.toContain('Fog Cloud')
	})

	it('a character with no mark returns nothing extra from that mark', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character, null)

		expect(result.map((s) => s.name)).not.toContain('Gust of Wind')
		expect(result.map((s) => s.name)).not.toContain('See Invisibility')
	})
})

describe('extractFeatGrantedSpells — base Magic Initiate (slice d5b-2)', () => {
	const fireBolt = { name: 'Fire Bolt', source: 'XPHB', level: 0, duration: [{ type: 'instant' }], meta: {} }
	const mageHand = { name: 'Mage Hand', source: 'XPHB', level: 0, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 } }], meta: {} }
	const rayOfSickness = { name: 'Ray of Sickness', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
	const magicInitiateSpells = [...spells, fireBolt, mageHand, rayOfSickness]

	function characterWithMagicInitiate(chosenAbility: Ability | undefined, magicInitiate: MagicInitiateChoice | undefined) {
		const character: Character = {
			id: 'test',
			name: 'Test Character',
			classes: [],
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Magic Initiate', source: 'XPHB', chosenAbility, magicInitiate }],
		}
		return character
	}

	it('reads the stored class-list + spell picks directly, not additionalSpells, and carries the chosen ability', () => {
		const character = characterWithMagicInitiate('intelligence', {
			className: 'Wizard',
			classSource: 'XPHB',
			cantrips: [
				{ name: 'Fire Bolt', source: 'XPHB' },
				{ name: 'Mage Hand', source: 'XPHB' },
			],
			spell: { name: 'Ray of Sickness', source: 'XPHB' },
		})
		const result = extractFeatGrantedSpells(feats, magicInitiateSpells, character, null)

		expect(result.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Mage Hand', 'Ray of Sickness'])
		expect(result.every((s) => s.origin === 'feat')).toBe(true)
		expect(result.every((s) => s.featName === 'Magic Initiate')).toBe(true)
		expect(result.every((s) => s.ability === 'int')).toBe(true)
		expect(result.find((s) => s.name === 'Fire Bolt')?.level).toBe(0)
		expect(result.find((s) => s.name === 'Ray of Sickness')?.level).toBe(1)
	})

	it('no pick recorded yet (feat just taken) returns nothing, cleanly', () => {
		const character = characterWithMagicInitiate(undefined, undefined)
		expect(extractFeatGrantedSpells(feats, magicInitiateSpells, character, null)).toEqual([])
	})

	describe('granted by the background (D156)', () => {
		const acolyteFeat = { name: 'Magic Initiate; Cleric', source: 'XPHB' }
		const acolyte: Character = { id: 'a', name: 'Acolyte', classes: [] }

		it('grants nothing while its picks are not stored — never a guess (D57)', () => {
			expect(extractFeatGrantedSpells(feats, magicInitiateSpells, acolyte, acolyteFeat)).toEqual([])
		})

		it("reads the picks from the character's grantedFeats entry", () => {
			const character: Character = {
				...acolyte,
				grantedFeats: [
					{
						origin: 'background',
						...acolyteFeat,
						chosenAbility: 'wisdom',
						magicInitiate: { className: 'Cleric', classSource: 'XPHB', cantrips: [{ name: 'Fire Bolt', source: 'XPHB' }], spell: { name: 'Ray of Sickness', source: 'XPHB' } },
					},
				],
			}
			const result = extractFeatGrantedSpells(feats, magicInitiateSpells, character, acolyteFeat)
			expect(result.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Ray of Sickness'])
			expect(result.every((s) => s.featName === 'Magic Initiate; Cleric' && s.ability === 'wis')).toBe(true)
		})
	})

	it('the level-1 pick carries the "1/long rest, no slot" term; the cantrip picks carry none (D21/D70)', () => {
		const character = characterWithMagicInitiate('intelligence', {
			className: 'Wizard',
			classSource: 'XPHB',
			cantrips: [
				{ name: 'Fire Bolt', source: 'XPHB' },
				{ name: 'Mage Hand', source: 'XPHB' },
			],
			spell: { name: 'Ray of Sickness', source: 'XPHB' },
		})
		const result = extractFeatGrantedSpells(feats, magicInitiateSpells, character, null)

		expect(result.find((s) => s.name === 'Ray of Sickness')?.usage).toEqual({ kind: 'onceFreePerLongRest' })
		expect(result.find((s) => s.name === 'Fire Bolt')?.usage).toBeFalsy()
		expect(result.find((s) => s.name === 'Mage Hand')?.usage).toBeFalsy()
	})
})

describe('extractFeatGrantedSpells — the 8 generic filter-choice feats (slice d5b-1)', () => {
	const feyTouched = {
		name: 'Fey-Touched',
		source: 'XPHB',
		additionalSpells: [{ ability: 'inherit', innate: { _: { daily: { '1e': ['misty step|xphb', { choose: 'level=1|school=E;D' }] } } } }],
	}
	const woodElfMagic = {
		name: 'Wood Elf Magic',
		source: 'XGE',
		additionalSpells: [
			{ ability: 'wis', innate: { _: { daily: { '1e': ['longstrider', 'pass without trace'] } } }, known: { _: [{ choose: 'level=0|class=Druid' }] } },
		],
	}
	const ritualCaster = {
		name: 'Ritual Caster',
		source: 'XPHB',
		additionalSpells: [{ prepared: { 1: [{ choose: 'level=1|components & miscellaneous=ritual' }] } }],
	}
	const filterChoiceFeats = [...feats, feyTouched, woodElfMagic, ritualCaster]

	const identify = { name: 'Identify', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
	const longstrider = { name: 'Longstrider', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }], meta: {} }
	const passWithoutTrace = { name: 'Pass without Trace', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }], meta: {} }
	const filterChoiceSpells = [...spells, identify, longstrider, passWithoutTrace]

	function characterWithFilterChoice(name: string, source: string, chosenAbility: Ability | undefined, filterChoiceSpells: { cantrips: { name: string; source: string }[]; spells: { name: string; source: string }[] } | undefined) {
		const character: Character = {
			id: 'test',
			name: 'Test Character',
			classes: [],
			featAsiChoices: [{ level: 4, kind: 'feat', name, source, chosenAbility, filterChoiceSpells }],
		}
		return character
	}

	it("Fey-Touched: the fixed companion spell (Misty Step) is granted even with no pick yet, ability from chosenAbility (not 'inherit')", () => {
		const character = characterWithFilterChoice('Fey-Touched', 'XPHB', 'wisdom', undefined)
		const result = extractFeatGrantedSpells(filterChoiceFeats, filterChoiceSpells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Misty Step'])
		expect(result[0].ability).toBe('wis')
	})

	it('Fey-Touched: the chosen school-filtered spell is ALSO granted, alongside the fixed one, both carrying chosenAbility', () => {
		const character = characterWithFilterChoice('Fey-Touched', 'XPHB', 'charisma', { cantrips: [], spells: [{ name: 'Identify', source: 'XPHB' }] })
		const result = extractFeatGrantedSpells(filterChoiceFeats, filterChoiceSpells, character, null)

		expect(result.map((s) => s.name).sort()).toEqual(['Identify', 'Misty Step'])
		expect(result.every((s) => s.ability === 'cha')).toBe(true)
		expect(result.every((s) => s.featName === 'Fey-Touched')).toBe(true)
	})

	it("Fey-Touched: the chosen spell AND the fixed Misty Step companion both show \"once per long rest, no slot\" — not the data's stale daily:'1e' (D21/D70, D68)", () => {
		const character = characterWithFilterChoice('Fey-Touched', 'XPHB', 'charisma', { cantrips: [], spells: [{ name: 'Identify', source: 'XPHB' }] })
		const result = extractFeatGrantedSpells(filterChoiceFeats, filterChoiceSpells, character, null)

		expect(result.find((s) => s.name === 'Misty Step')?.usage).toEqual({ kind: 'onceFreePerLongRest' })
		expect(result.find((s) => s.name === 'Identify')?.usage).toEqual({ kind: 'onceFreePerLongRest' })
	})

	it('Wood Elf Magic: fixed innate spells AND the chosen cantrip are granted, ability is the FIXED wis (chosenAbility ignored)', () => {
		const character = characterWithFilterChoice('Wood Elf Magic', 'XGE', undefined, { cantrips: [{ name: 'Druidcraft', source: 'XPHB' }], spells: [] })
		const druidcraft = { name: 'Druidcraft', source: 'XPHB', level: 0, duration: [{ type: 'instant' }], meta: {} }
		const result = extractFeatGrantedSpells(filterChoiceFeats, [...filterChoiceSpells, druidcraft], character, null)

		expect(result.map((s) => s.name).sort()).toEqual(['Druidcraft', 'Longstrider', 'Pass without Trace'])
		expect(result.every((s) => s.ability === 'wis')).toBe(true)
	})

	it('a character without any filter-choice feat is unaffected', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(filterChoiceFeats, filterChoiceSpells, character, null)
		expect(result.map((s) => s.name).sort()).toEqual(['Detect Magic', 'Dispel Magic', 'Levitate'])
	})

	it('Ritual Caster: its picked ritual spells carry NO usage label — the feat text ("cast them with any spell slots you have") establishes no special term (D21/D70)', () => {
		const character = characterWithFilterChoice('Ritual Caster', 'XPHB', 'intelligence', { cantrips: [], spells: [{ name: 'Identify', source: 'XPHB' }] })
		const result = extractFeatGrantedSpells(filterChoiceFeats, filterChoiceSpells, character, null)

		expect(result.map((s) => s.name)).toEqual(['Identify'])
		expect(result[0].usage).toBeFalsy()
	})
})
