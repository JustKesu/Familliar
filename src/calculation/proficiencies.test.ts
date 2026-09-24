import { describe, expect, it } from 'vitest'
import type { Character, CharacterClassFeatureChoice } from '../storage/character'
import { computeProficiencies, extractFeatProficiencyEntries, type Proficiencies, type TakenFeat } from './proficiencies'

const MONK_PROSE = 'Martial weapons that have the {@filter Light|items|type=martial weapon|property=light} property'
const ROGUE_PROSE = 'Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property'

function classEntry(name: string, armor: string[] | undefined, weapons: string[]): unknown {
	return { entryType: 'class', name, source: 'XPHB', classFeatures: [], startingProficiencies: { ...(armor ? { armor } : {}), weapons } }
}

const CLASSES = [
	classEntry('Fighter', ['light', 'medium', 'heavy', 'shield'], ['simple', 'martial']),
	classEntry('Rogue', ['light'], ['simple', ROGUE_PROSE]),
	classEntry('Monk', undefined, ['simple', MONK_PROSE]),
	classEntry('Cleric', ['light', 'medium', 'shield'], ['simple']),
	classEntry('Druid', ['light', 'shield'], ['simple']),
	classEntry('Bard', ['light'], ['simple']),
	classEntry('Wizard', undefined, ['simple']),
	classEntry('Ranger', ['light', 'medium', 'shield'], ['simple', 'martial']),
]

const FEATS = extractFeatProficiencyEntries([
	{ name: 'Fey Teleportation', source: 'XGE', languageProficiencies: [{ sylvan: true }] },
	{ name: 'Prodigy', source: 'XGE', languageProficiencies: [{ any: 1 }] },
	{ name: 'Lightly Armored', source: 'XPHB', armorProficiencies: [{ light: true, shield: true }] },
	{ name: 'Moderately Armored', source: 'XPHB', armorProficiencies: [{ medium: true }] },
	{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }] },
	{ name: 'Tavern Brawler', source: 'XPHB', weaponProficiencies: [{ improvised: true }] },
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

	it('Tavern Brawler lists Improvised weapons last', () => {
		expect(labels(compute(character('Rogue'), ['Tavern Brawler']).weapons)).toEqual([
			'Simple weapons',
			'Martial weapons with the Finesse or Light property',
			'Improvised weapons',
		])
	})
})
