import { describe, expect, it } from 'vitest'
import type { Character, CharacterClassFeatureChoice } from '../storage/character'
import { computeProficiencies, extractFeatProficiencyEntries, type Proficiencies, type TakenFeat } from './proficiencies'

const MONK_PROSE = 'Martial weapons that have the {@filter Light|items|type=martial weapon|property=light} property'
const ROGUE_PROSE = 'Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property'

function classEntry(name: string, armor: string[] | undefined, weapons: string[], toolProficiencies?: unknown[], source = 'XPHB'): unknown {
	return { entryType: 'class', name, source, classFeatures: [], startingProficiencies: { ...(armor ? { armor } : {}), weapons, ...(toolProficiencies ? { toolProficiencies } : {}) } }
}

const CLASSES = [
	classEntry('Fighter', ['light', 'medium', 'heavy', 'shield'], ['simple', 'martial']),
	classEntry('Rogue', ['light'], ['simple', ROGUE_PROSE], [{ "thieves' tools": true }]),
	classEntry('Monk', undefined, ['simple', MONK_PROSE], [{ anyArtisansTool: 1 }, { anyMusicalInstrument: 1 }]),
	classEntry('Cleric', ['light', 'medium', 'shield'], ['simple']),
	classEntry('Druid', ['light', 'shield'], ['simple'], [{ 'herbalism kit': true }]),
	classEntry('Bard', ['light'], ['simple'], [{ anyMusicalInstrument: 3 }]),
	classEntry('Wizard', undefined, ['simple']),
	classEntry('Ranger', ['light', 'medium', 'shield'], ['simple', 'martial']),
	classEntry('Artificer', ['light'], ['simple'], [{ "thieves' tools": true, "tinker's tools": true, anyArtisansTool: 1 }], 'EFA'),
	classEntry('Warlock', ['light'], ['simple']),
	classEntry('Sorcerer', undefined, ['simple']),
	subclassEntry('Warlock', 'The Hexblade', 'XGE'),
	subclassEntry('Fighter', 'Rune Knight', 'TCE'),
	subclassEntry('Sorcerer', 'Storm Sorcery', 'XGE'),
	subclassEntry('Rogue', 'Mastermind', 'XGE'),
	subclassEntry('Monk', 'Way of the Kensei', 'XGE'),
	subclassEntry('Artificer', 'Armorer', 'EFA', 'EFA'),
	subclassEntry('Artificer', 'Alchemist', 'EFA', 'EFA'),
]

function subclassEntry(className: string, name: string, source: string, classSource = 'XPHB'): unknown {
	return { entryType: 'subclass', className, classSource, name, shortName: name, source }
}

const FEATS = extractFeatProficiencyEntries([
	{ name: 'Fey Teleportation', source: 'XGE', languageProficiencies: [{ sylvan: true }] },
	{ name: 'Prodigy', source: 'XGE', languageProficiencies: [{ any: 1 }] },
	{ name: 'Lightly Armored', source: 'XPHB', armorProficiencies: [{ light: true, shield: true }] },
	{ name: 'Moderately Armored', source: 'XPHB', armorProficiencies: [{ medium: true }] },
	{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }] },
	{ name: 'Tavern Brawler', source: 'XPHB', weaponProficiencies: [{ improvised: true }] },
	{ name: 'Chef', source: 'XPHB', toolProficiencies: [{ "cook's utensils": true }] },
	{ name: 'Musician', source: 'XPHB', toolProficiencies: [{ anyMusicalInstrument: 3 }] },
	{ name: 'Skilled', source: 'XPHB' },
])

function character(className: string, options: { level?: number; subclass?: string; choices?: CharacterClassFeatureChoice[] } = {}): Character {
	return {
		id: 'c1',
		name: 'Test',
		classes: [{ className, classSource: 'XPHB', subclass: options.subclass ?? null, level: options.level ?? 1 }],
		classFeatureChoices: options.choices,
	}
}

function compute(c: Character, feats: string[] = []): Proficiencies {
	return computeProficiencies(c, CLASSES, feats.map((name) => ({ name, source: 'XPHB' })), FEATS)
}

const labels = (items: Proficiencies[keyof Proficiencies]) => items.map((item) => item.label)

describe('computeProficiencies', () => {
	it('Fighter: all armor and both weapon categories, from the class', () => {
		const result = compute(character('Fighter'))
		expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Heavy armor', 'Shields'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
		expect(result.weapons[1].sources).toEqual([{ kind: 'class', name: 'Fighter' }])
	})

	it('Rogue: light armor, simple weapons and the Finesse-or-Light subset', () => {
		const result = compute(character('Rogue'))
		expect(labels(result.armor)).toEqual(['Light armor'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons with the Finesse or Light property'])
	})

	it('Monk: no armor, simple weapons and the Light subset', () => {
		const result = compute(character('Monk'))
		expect(result.armor).toEqual([])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons with the Light property'])
	})

	it('Monk with Martial Weapon Training: the subset is dropped', () => {
		expect(labels(compute(character('Monk'), ['Martial Weapon Training']).weapons)).toEqual(['Simple weapons', 'Martial weapons'])
	})

	it('Cleric: Protector adds heavy armor and martial weapons, Thaumaturge does not', () => {
		const choice = (optionName: string) => [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName }]
		const plain = compute(character('Cleric', { choices: choice('Thaumaturge') }))
		expect(labels(plain.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(labels(plain.weapons)).toEqual(['Simple weapons'])

		const protector = compute(character('Cleric', { choices: choice('Protector') }))
		expect(labels(protector.armor)).toEqual(['Light armor', 'Medium armor', 'Heavy armor', 'Shields'])
		expect(protector.armor[2].sources).toEqual([{ kind: 'classFeatureChoice', name: 'Cleric — Protector' }])
		expect(labels(protector.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
	})

	it('Druid with Warden: medium armor and martial weapons', () => {
		const result = compute(character('Druid', { choices: [{ className: 'Druid', classSource: 'XPHB', featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Warden' }] }))
		expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(result.armor[1].sources.map((s) => s.name)).toEqual(['Druid — Warden'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
	})

	it('Bard College of Valor: Martial Training arrives at level 3, not 2', () => {
		expect(labels(compute(character('Bard', { level: 2, subclass: 'College of Valor' })).weapons)).toEqual(['Simple weapons'])
		const l3 = compute(character('Bard', { level: 3, subclass: 'College of Valor' }))
		expect(labels(l3.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(labels(l3.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
		expect(l3.weapons[1].sources).toEqual([{ kind: 'subclass', name: 'College of Valor' }])
	})

	it('Wizard with Lightly and Moderately Armored', () => {
		expect(compute(character('Wizard')).armor).toEqual([])
		const result = compute(character('Wizard'), ['Lightly Armored', 'Moderately Armored'])
		expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(result.armor[1].sources).toEqual([{ kind: 'feat', name: 'Moderately Armored (feat)' }])
	})

	it('the same proficiency from two sources is one entry listing both', () => {
		const result = compute(character('Fighter'), ['Martial Weapon Training'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
		expect(result.weapons[1].sources.map((s) => s.name)).toEqual(['Fighter', 'Martial Weapon Training (feat)'])
	})

	describe('languages (D171)', () => {
		const withLanguages = (c: Character, ...chosen: string[]): Character => ({
			...c,
			languages: [{ name: 'Common', source: 'Common', grantedBy: 'automatic' }, ...chosen.map((name) => ({ name, source: 'Elf', grantedBy: 'creation' as const }))],
		})
		const langs = (c: Character, feats: TakenFeat[] = []) => computeProficiencies(c, CLASSES, feats, FEATS).languages

		it('default character: Common first, then the chosen ones alphabetically, with their sources', () => {
			const result = langs(withLanguages(character('Fighter'), 'Sylvan', 'Elvish'))
			expect(labels(result)).toEqual(['Common', 'Elvish', 'Sylvan'])
			expect(result[0].sources).toEqual([{ kind: 'creation', name: 'Every character' }])
			expect(result[1].sources).toEqual([{ kind: 'creation', name: 'Chosen at creation' }])
		})

		it('Druid L1 knows Druidic', () => {
			const result = langs(withLanguages(character('Druid'), 'Elvish'))
			expect(labels(result)).toEqual(['Common', 'Druidic', 'Elvish'])
			expect(result[1].sources).toEqual([{ kind: 'class', name: 'Druid' }])
		})

		it("Rogue L1: Thieves' Cant plus one language not chosen, listed last", () => {
			const result = langs(withLanguages(character('Rogue'), 'Elvish'))
			expect(labels(result)).toEqual(['Common', 'Elvish', "Thieves' Cant", "Extra language (Thieves' Cant) — not chosen"])
			expect(result[3].pending).toBe(true)
			expect(result[3].sources.map((s) => s.name)).toEqual(["Rogue — Thieves' Cant"])
		})

		it("D172: Rogue's stored Thieves' Cant pick replaces the pending item", () => {
			const c = withLanguages(character('Rogue'), 'Elvish')
			const result = langs({ ...c, languages: [...c.languages!, { name: 'Abyssal', source: 'XPHB', grantedBy: 'thievesCant' }] })
			expect(labels(result)).toEqual(['Common', 'Abyssal', 'Elvish', "Thieves' Cant"])
			expect(result[1].sources).toEqual([{ kind: 'classFeatureChoice', name: "Rogue — Thieves' Cant" }])
		})

		it('Ranger: two languages pending from level 2, not level 1', () => {
			expect(labels(langs(withLanguages(character('Ranger', { level: 1 }))))).toEqual(['Common'])
			const l2 = langs(withLanguages(character('Ranger', { level: 2 })))
			expect(labels(l2)).toEqual(['Common', '2 extra languages (Deft Explorer) — not chosen'])
			expect(l2[1].sources.map((s) => s.name)).toEqual(['Ranger — Deft Explorer'])
		})

		it('D172: Ranger L2 partial choice leaves one pending, full choice none', () => {
			const c = withLanguages(character('Ranger', { level: 2 }))
			const pick = (name: string) => ({ name, source: 'XPHB', grantedBy: 'deftExplorer' as const })
			expect(labels(langs({ ...c, languages: [...c.languages!, pick('Giant')] }))).toEqual(['Common', 'Giant', '1 extra language (Deft Explorer) — not chosen'])
			expect(labels(langs({ ...c, languages: [...c.languages!, pick('Giant'), pick('Orc')] }))).toEqual(['Common', 'Giant', 'Orc'])
		})

		it('Fey Teleportation Sylvan merges with a Sylvan chosen at creation', () => {
			const result = langs(withLanguages(character('Fighter'), 'Sylvan'), [{ name: 'Fey Teleportation', source: 'XGE' }])
			expect(labels(result)).toEqual(['Common', 'Sylvan'])
			expect(result[1].sources.map((s) => s.name)).toEqual(['Chosen at creation', 'Fey Teleportation (feat)'])
		})

		it('Prodigy: pending until a language is stored on the instance, then shown as that language', () => {
			const c = withLanguages(character('Fighter'))
			const unchosen = langs(c, [{ name: 'Prodigy', source: 'XGE' }])
			expect(labels(unchosen)).toEqual(['Common', '1 language — not chosen'])
			expect(unchosen[1].sources.map((s) => s.name)).toEqual(['Prodigy (feat)'])

			const chosen = langs(c, [{ name: 'Prodigy', source: 'XGE', proficiencies: { languages: [{ name: 'Dwarvish', source: 'Prodigy' }] } }])
			expect(labels(chosen)).toEqual(['Common', 'Dwarvish'])
			expect(chosen[1].sources.map((s) => s.name)).toEqual(['Prodigy (feat)'])
		})
	})

	describe('tools (D173)', () => {
		const withBackground = (c: Character, name: string, toolProficiency: string): Character => ({
			...c,
			background: { name, source: 'XPHB', skillProficiencies: ['Insight', 'Religion'], toolProficiency },
		})
		const tools = (c: Character, feats: TakenFeat[] = []) => computeProficiencies(c, CLASSES, feats, FEATS).tools
		const sources = (item: { sources: { name: string }[] }) => item.sources.map((s) => s.name)

		it("Criminal Rogue: Thieves' Tools once, with both sources", () => {
			const result = tools(withBackground(character('Rogue'), 'Criminal', "Thieves' Tools"))
			expect(labels(result)).toEqual(["Thieves' Tools"])
			expect(sources(result[0])).toEqual(['Rogue', 'Criminal (background)'])
		})

		it('Hermit Druid: Herbalism Kit once, with both sources', () => {
			const result = tools(withBackground(character('Druid'), 'Hermit', 'Herbalism Kit'))
			expect(labels(result)).toEqual(['Herbalism Kit'])
			expect(sources(result[0])).toEqual(['Druid', 'Hermit (background)'])
		})

		it('a background tool sorts alphabetically with the class tools, pending last', () => {
			expect(labels(tools(withBackground(character('Bard'), 'Guide', "Cartographer's Tools")))).toEqual(["Cartographer's Tools", '3 musical instruments (Bard) — not chosen'])
		})

		it('Bard: three musical instruments pending', () => {
			const result = tools(character('Bard'))
			expect(labels(result)).toEqual(['3 musical instruments (Bard) — not chosen'])
			expect(result[0].pending).toBe(true)
		})

		it("Monk: one artisan's tool or musical instrument pending as a single item", () => {
			expect(labels(tools(character('Monk')))).toEqual(["1 artisan's tool or musical instrument (Monk) — not chosen"])
		})

		it('Monk Warrior of Mercy: Herbalism Kit from level 3 only', () => {
			expect(labels(tools(character('Monk', { level: 2, subclass: 'Warrior of Mercy' })))).toHaveLength(1)
			const l3 = tools(character('Monk', { level: 3, subclass: 'Warrior of Mercy' }))
			expect(labels(l3)).toEqual(['Herbalism Kit', "1 artisan's tool or musical instrument (Monk) — not chosen"])
			expect(sources(l3[0])).toEqual(['Warrior of Mercy'])
		})

		it("Battle Master: an artisan's tool is owed from level 3, not 2", () => {
			expect(tools(character('Fighter', { level: 2, subclass: 'Battle Master' }))).toEqual([])
			const l3 = tools(character('Fighter', { level: 3, subclass: 'Battle Master' }))
			expect(labels(l3)).toEqual(["1 artisan's tool (Battle Master) — not chosen"])
			expect(sources(l3[0])).toEqual(['Battle Master'])
		})

		it("Artificer: two fixed tools and one artisan's tool pending", () => {
			const artificer: Character = { ...character('Artificer'), classes: [{ className: 'Artificer', classSource: 'EFA', subclass: null, level: 1 }] }
			expect(labels(tools(artificer))).toEqual(["Thieves' Tools", "Tinker's Tools", "1 artisan's tool (Artificer) — not chosen"])
		})

		describe('stored class tool picks (D174)', () => {
			const withPicks = (c: Character, toolChoices: NonNullable<Character['toolChoices']>): Character => ({ ...c, toolChoices })

			it('Bard: a partial pick leaves the remainder pending, all three clear it', () => {
				const one = withPicks(character('Bard'), [{ grantedBy: 'bard', name: 'Lute' }])
				expect(labels(tools(one))).toEqual(['Lute', '2 musical instruments (Bard) — not chosen'])
				const two = withPicks(character('Bard'), [{ grantedBy: 'bard', name: 'Lute' }, { grantedBy: 'bard', name: 'Flute' }])
				expect(labels(tools(two))).toEqual(['Flute', 'Lute', '1 musical instrument (Bard) — not chosen'])
				const three = withPicks(character('Bard'), [{ grantedBy: 'bard', name: 'Lute' }, { grantedBy: 'bard', name: 'Flute' }, { grantedBy: 'bard', name: 'Drum' }])
				expect(labels(tools(three))).toEqual(['Drum', 'Flute', 'Lute'])
				expect(sources(tools(three)[0])).toEqual(['Bard'])
			})

			it('Monk: one pick from the union clears the single pending item', () => {
				expect(labels(tools(withPicks(character('Monk'), [{ grantedBy: 'monk', name: "Smith's Tools" }])))).toEqual(["Smith's Tools"])
			})

			it('Artificer: the pick joins the fixed tools', () => {
				const artificer: Character = { ...character('Artificer'), classes: [{ className: 'Artificer', classSource: 'EFA', subclass: null, level: 1 }], toolChoices: [{ grantedBy: 'artificer', name: "Smith's Tools" }] }
				expect(labels(tools(artificer))).toEqual(["Smith's Tools", "Thieves' Tools", "Tinker's Tools"])
			})

			it("Battle Master: L2 owes and shows nothing, L3 owes one, a stored pick clears it", () => {
				const picked = [{ grantedBy: 'battleMaster' as const, name: "Smith's Tools" }]
				expect(tools(withPicks(character('Fighter', { level: 2, subclass: 'Battle Master' }), picked))).toEqual([])
				const l3 = tools(withPicks(character('Fighter', { level: 3, subclass: 'Battle Master' }), picked))
				expect(labels(l3)).toEqual(["Smith's Tools"])
				expect(sources(l3[0])).toEqual(['Battle Master'])
			})

			it('a pick whose class no longer holds it is ignored', () => {
				expect(labels(tools(withPicks(character('Bard'), [{ grantedBy: 'monk', name: 'Lute' }])))).toEqual(['3 musical instruments (Bard) — not chosen'])
			})
		})

		it("Chef feat: Cook's Utensils", () => {
			const result = tools(character('Wizard'), [{ name: 'Chef', source: 'XPHB' }])
			expect(labels(result)).toEqual(["Cook's Utensils"])
			expect(sources(result[0])).toEqual(['Chef (feat)'])
		})

		it('Musician with one stored instrument: two pending', () => {
			const result = tools(character('Wizard'), [{ name: 'Musician', source: 'XPHB', proficiencies: { tools: ['Lute'] } }])
			expect(labels(result)).toEqual(['Lute', '2 musical instruments (Musician) — not chosen'])
		})

		it('Skilled shows a stored tool and never owes one', () => {
			const result = tools(character('Wizard'), [{ name: 'Skilled', source: 'XPHB', proficiencies: { tools: ["Smith's Tools"] } }])
			expect(labels(result)).toEqual(["Smith's Tools"])
			expect(tools(character('Wizard'), [{ name: 'Skilled', source: 'XPHB' }])).toEqual([])
		})
	})

	describe('non-XPHB subclass grants (D176)', () => {
		const sources = (item: { sources: { name: string }[] }) => item.sources.map((s) => s.name)
		const artificer = (subclass: string, extra: Partial<Character> = {}): Character => ({
			id: 'a1',
			name: 'Test',
			classes: [{ className: 'Artificer', classSource: 'EFA', subclass, level: 3 }],
			...extra,
		})
		const background = (toolProficiency: string): Partial<Character> => ({ background: { name: 'Guild Artisan', source: 'XPHB', skillProficiencies: ['Insight', 'Persuasion'], toolProficiency } })

		it('The Hexblade 3: Medium armor, Shields and Martial weapons, sourced to the subclass; nothing at 2', () => {
			expect(labels(compute(character('Warlock', { level: 2, subclass: 'The Hexblade' })).armor)).toEqual(['Light armor'])
			const result = compute(character('Warlock', { level: 3, subclass: 'The Hexblade' }))
			expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
			expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
			expect(sources(result.weapons[1])).toEqual(['The Hexblade'])
		})

		it("Rune Knight: Smith's Tools and Giant; Storm Sorcery: Primordial", () => {
			const rune = compute(character('Fighter', { level: 3, subclass: 'Rune Knight' }))
			expect(labels(rune.tools)).toEqual(["Smith's Tools"])
			expect(labels(rune.languages)).toEqual(['Giant'])
			expect(sources(rune.languages[0])).toEqual(['Rune Knight'])
			expect(labels(compute(character('Sorcerer', { level: 3, subclass: 'Storm Sorcery' })).languages)).toEqual(['Primordial'])
		})

		it("Armorer: Heavy armor and Smith's Tools", () => {
			const result = compute(artificer('Armorer'))
			expect(labels(result.armor)).toEqual(['Light armor', 'Heavy armor'])
			expect(labels(result.tools)).toEqual(["Smith's Tools", "Thieves' Tools", "Tinker's Tools", "1 artisan's tool (Artificer) — not chosen"])
		})

		it('a same-named subclass from another source gets nothing', () => {
			const xphbOnly = [...CLASSES.filter((entry) => (entry as { name: string }).name !== 'The Hexblade'), subclassEntry('Warlock', 'The Hexblade', 'XPHB')]
			const result = computeProficiencies(character('Warlock', { level: 3, subclass: 'The Hexblade' }), xphbOnly, [], FEATS)
			expect(labels(result.armor)).toEqual(['Light armor'])
			expect(labels(result.weapons)).toEqual(['Simple weapons'])
		})

		it('Mastermind 3: fixed kits, one gaming set and two languages pending; stored picks count down', () => {
			const rogue = character('Rogue', { level: 3, subclass: 'Mastermind' })
			const result = compute(rogue)
			expect(labels(result.tools)).toEqual(['Disguise Kit', 'Forgery Kit', "Thieves' Tools", '1 gaming set (Mastermind) — not chosen'])
			expect(labels(result.languages)).toEqual(["Thieves' Cant", "Extra language (Thieves' Cant) — not chosen", '2 extra languages (Master of Intrigue) — not chosen'])
			const picked = compute({ ...rogue, toolChoices: [{ grantedBy: 'mastermind', name: 'Dice Set' }], languages: [{ name: 'Elvish', source: 'XPHB', grantedBy: 'mastermind' }] })
			expect(labels(picked.tools)).toEqual(['Dice Set', 'Disguise Kit', 'Forgery Kit', "Thieves' Tools"])
			expect(labels(picked.languages)).toContain('1 extra language (Master of Intrigue) — not chosen')
			expect(sources(picked.languages.find((item) => item.label === 'Elvish')!)).toEqual(['Mastermind — Master of Intrigue'])
			expect(labels(compute(character('Rogue', { level: 2, subclass: 'Mastermind' })).tools)).toEqual(["Thieves' Tools"])
		})

		it('Kensei 3: a tool pick and a pending weapons row', () => {
			const result = compute(character('Monk', { level: 3, subclass: 'Way of the Kensei' }))
			expect(labels(result.weapons).at(-1)).toBe('Kensei weapons — not chosen')
			expect(labels(result.tools)).toContain("1 Calligrapher's Supplies or Painter's Supplies (Way of the Kensei) — not chosen")
		})

		it('Artificer replacement: 0, 1 or 2 extra picks for the subclass tools already held elsewhere', () => {
			const pending = (c: Character) => labels(compute(c).tools).filter((label) => label.includes('(Armorer)') || label.includes('(Alchemist)'))
			expect(pending(artificer('Armorer'))).toEqual([])
			expect(pending(artificer('Armorer', background("Smith's Tools")))).toEqual(["1 artisan's tool (Armorer) — not chosen"])
			const both = artificer('Alchemist', { ...background('Herbalism Kit'), toolChoices: [{ grantedBy: 'artificer', name: "Alchemist's Supplies" }] })
			expect(pending(both)).toEqual(["2 artisan's tools (Alchemist) — not chosen"])
		})

		it('Artificer replacement: a stored pick whose duplicate went away is kept, flagged and not counted', () => {
			const result = compute(artificer('Armorer', { toolChoices: [{ grantedBy: 'artificerSubclass', name: "Mason's Tools" }] }))
			expect(labels(result.tools)).toContain("Mason's Tools — no longer owed, not counted")
			expect(labels(result.tools)).not.toContain("Mason's Tools")
		})
	})

	it('Tavern Brawler lists Improvised weapons last', () => {
		expect(labels(compute(character('Rogue'), ['Tavern Brawler']).weapons)).toEqual([
			'Simple weapons',
			'Martial weapons with the Finesse or Light property',
			'Improvised weapons',
		])
	})
})
