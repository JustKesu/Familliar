import { describe, expect, it } from 'vitest'
import { featAsiCardTitle, featAsiMissing, featOptionLabel } from './FeatAsiLevelCard'
import type { FeatEntry } from './featAsiData'

const feats = [
	{ name: 'Athlete', source: 'XPHB', category: 'G', ability: [{ choose: { from: ['str', 'dex'] } }] },
	{ name: 'Heavy Armor Master', source: 'XPHB', category: 'G', ability: [{ str: 1 }] },
	{ name: 'Skilled', source: 'XPHB', category: 'O', repeatable: true, skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }] },
] as unknown as FeatEntry[]

describe('W16/W17 card summary', () => {
	it('names the choice and its ability bonus', () => {
		expect(featAsiCardTitle(4, undefined, feats)).toBe('Level 4 — Choose a feat or ASI')
		expect(featAsiCardTitle(4, { level: 4, kind: 'feat', name: '', source: '' }, feats)).toBe('Level 4 — Choose a feat or ASI')
		expect(featAsiCardTitle(8, { level: 8, kind: 'asi', increases: {} }, feats)).toBe('Level 8 — Ability Score Improvement')
		expect(featAsiCardTitle(8, { level: 8, kind: 'asi', increases: { strength: 2 } }, feats)).toBe('Level 8 — Ability Score Improvement (+2 STR)')
		expect(featAsiCardTitle(8, { level: 8, kind: 'asi', increases: { strength: 1, dexterity: 1 } }, feats)).toBe('Level 8 — Ability Score Improvement (+1 STR, +1 DEX)')
		expect(featAsiCardTitle(4, { level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB' }, feats)).toBe('Level 4 — Athlete')
		expect(featAsiCardTitle(4, { level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'dexterity' }, feats)).toBe('Level 4 — Athlete (+1 DEX)')
		expect(featAsiCardTitle(6, { level: 6, kind: 'feat', name: 'Heavy Armor Master', source: 'XPHB' }, feats)).toBe('Level 6 — Heavy Armor Master (+1 STR)')
		expect(featAsiCardTitle(12, { level: 12, kind: 'feat', name: 'Skilled', source: 'XPHB' }, feats)).toBe('Level 12 — Skilled')
	})

	it('lists what is missing — the open/collapsed rule opens a card exactly when this is not empty', () => {
		const requiring = new Set(['Athlete|XPHB'])
		expect(featAsiMissing(undefined, feats, requiring, 4)).toEqual(['a feat or Ability Score Improvement'])
		expect(featAsiMissing({ level: 4, kind: 'asi', increases: { strength: 1 } }, feats, requiring, 4)).toEqual(['the abilities to increase'])
		expect(featAsiMissing({ level: 4, kind: 'asi', increases: { strength: 2 } }, feats, requiring, 4)).toEqual([])
		expect(featAsiMissing({ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB' }, feats, requiring, 4)).toEqual(['an ability'])
		expect(featAsiMissing({ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }, feats, requiring, 4)).toEqual([])
		expect(featAsiMissing({ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB' }, feats, requiring, 4)).toEqual(['skills or tools'])
		expect(featAsiMissing({ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana', 'history'], tools: ['Lute'] } }, feats, requiring, 4)).toEqual([])
	})

	it('W18: an option says why it cannot be taken', () => {
		const feat = feats[1]
		expect(featOptionLabel({ feat, held: false, result: { eligible: true, reasons: [] } })).toBe('Heavy Armor Master · XPHB')
		expect(featOptionLabel({ feat, held: true, result: { eligible: true, reasons: [] } })).toBe('Heavy Armor Master · XPHB (already taken)')
		expect(featOptionLabel({ feat, held: false, result: { eligible: false, reasons: ['Requires character level 4, Strength 13+.'] } })).toBe('Heavy Armor Master · XPHB (needs character level 4, STR 13)')
	})
})
