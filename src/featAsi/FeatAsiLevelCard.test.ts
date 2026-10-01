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

	it('names an Epic Boon level as such, and a feat missing from the data by its stored name', () => {
		expect(featAsiCardTitle(19, undefined, feats, 'epicBoon')).toBe('Level 19 (Epic Boon) — Choose a feat or ASI')
		expect(featAsiCardTitle(19, { level: 19, kind: 'feat', name: 'Heavy Armor Master', source: 'XPHB' }, feats, 'epicBoon')).toBe('Level 19 (Epic Boon) — Heavy Armor Master (+1 STR)')
		expect(featAsiCardTitle(4, { level: 4, kind: 'feat', name: 'Gone', source: 'OLD' }, feats)).toBe('Level 4 — Gone')
	})

	it('falls back to "spells" when the sub-choices look done but the Next gate still says incomplete (Magic Initiate one cantrip short)', () => {
		const magicInitiate = { level: 4, kind: 'feat' as const, name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'intelligence' as const, magicInitiate: { className: 'Wizard', classSource: 'XPHB', cantrips: [{ name: 'Fire Bolt', source: 'XPHB' }], spell: null } }
		expect(featAsiMissing(magicInitiate, feats, new Set(), 4)).toEqual(['spells'])
	})

	it('lists what is missing', () => {
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
		expect(featOptionLabel({ feat, held: false, result: { eligible: false, reasons: ['Requires Strength 13+.', 'Requires Dexterity 13+.'] } })).toBe('Heavy Armor Master · XPHB (needs STR 13 or needs DEX 13)')
		expect(featOptionLabel({ feat, held: false, result: { eligible: false, reasons: ['Already has a Dark Gift.'] } })).toBe('Heavy Armor Master · XPHB (already has a Dark Gift)')
		expect(featOptionLabel({ feat, held: false, result: { eligible: false, reasons: ['Requires a Fighting Style feat. Already has a Dark Gift.'] } })).toBe(
			'Heavy Armor Master · XPHB (needs a Fighting Style feat, already has a Dark Gift)',
		)
	})
})
