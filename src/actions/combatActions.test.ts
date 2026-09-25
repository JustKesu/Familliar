import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractCombatActions, groupOfTime, holdsTwoLightWeapons, visibleCombatActions, TWO_WEAPON_FIGHTING } from './combatActions'

const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), 'data', 'actions.json'), 'utf8'))

describe('data/actions.json (D187)', () => {
	it('holds the 18 XPHB actions and nothing from another source', () => {
		const records = parsed as { name: string; source: string }[]
		expect(records).toHaveLength(18)
		expect(records.every((record) => record.source === 'XPHB')).toBe(true)
		expect(records.map((record) => record.name)).not.toContain('Identify a Spell')
	})

	it('groups each action from its time', () => {
		const groups = Object.fromEntries(extractCombatActions(parsed).map((action) => [action.name, action.group]))
		expect(groups['Dash']).toBe('action')
		expect(groups[TWO_WEAPON_FIGHTING]).toBe('bonus')
		expect(groups['Opportunity Attack']).toBe('reaction')
		expect(groups['End Concentration']).toBe('other')
		expect(groups['Improvising an Action']).toBe('other')
	})
})

describe('groupOfTime', () => {
	it('reads the unit, and makes a string time or an unknown unit Other', () => {
		expect(groupOfTime([{ number: 1, unit: 'action' }])).toBe('action')
		expect(groupOfTime([{ number: 1, unit: 'bonus' }])).toBe('bonus')
		expect(groupOfTime([{ number: 1, unit: 'reaction' }])).toBe('reaction')
		expect(groupOfTime(['Free'])).toBe('other')
		expect(groupOfTime([{ number: 1, unit: 'minute' }])).toBe('other')
		expect(groupOfTime(undefined)).toBe('other')
	})
})

describe('Two-Weapon Fighting', () => {
	const light = { weapon: { propertyFull: ['Finesse', 'Light', 'Thrown'] } }
	const heavy = { weapon: { propertyFull: ['Heavy', 'Two-Handed'] } }
	const actions = extractCombatActions(parsed)

	it('needs two held entries with a Light weapon', () => {
		expect(holdsTwoLightWeapons([light, light])).toBe(true)
		expect(holdsTwoLightWeapons([light])).toBe(false)
		expect(holdsTwoLightWeapons([light, heavy])).toBe(false)
		expect(holdsTwoLightWeapons([light, { weapon: null }])).toBe(false)
	})

	it('is shown only while it can be taken; everything else always is', () => {
		expect(visibleCombatActions(actions, true)).toHaveLength(18)
		const without = visibleCombatActions(actions, false)
		expect(without).toHaveLength(17)
		expect(without.map((action) => action.name)).not.toContain(TWO_WEAPON_FIGHTING)
	})
})
