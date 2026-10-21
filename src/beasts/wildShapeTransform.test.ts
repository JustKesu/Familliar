import { describe, expect, it } from 'vitest'
import { grantTemporaryHitPoints } from '../hitPoints/damageHealing'
import { wildShapeTemporaryHitPoints } from './wildShapeTransform'

const WILD_SHAPE = { id: 'cf|wild shape|druid|xphb|2|xphb', name: 'Wild Shape', kind: 'class' }
const CIRCLE_FORMS = { id: 'scf|circle forms|druid|xphb|moon|xphb|3|xphb', name: 'Circle Forms', kind: 'subclass' }

describe('wildShapeTemporaryHitPoints (D364)', () => {
	it('is the Druid level', () => {
		expect(wildShapeTemporaryHitPoints([{ className: 'Druid', level: 4 }], [WILD_SHAPE])).toBe(4)
	})

	it('is three times the Druid level with the XPHB Circle Forms', () => {
		expect(wildShapeTemporaryHitPoints([{ className: 'Druid', level: 3 }], [WILD_SHAPE, CIRCLE_FORMS])).toBe(9)
	})

	it('counts only Druid levels on a multiclass', () => {
		const classes = [
			{ className: 'Fighter', level: 5 },
			{ className: 'Druid', level: 2 },
		]
		expect(wildShapeTemporaryHitPoints(classes, [WILD_SHAPE])).toBe(2)
	})

	it('is null without the XPHB Wild Shape (a PHB 2014 Druid)', () => {
		expect(wildShapeTemporaryHitPoints([{ className: 'Druid', level: 4 }], [{ id: 'cf|wild shape|druid|phb|2|phb', name: 'Wild Shape', kind: 'class' }])).toBeNull()
	})

	it('ignores the PHB 2014 Circle Forms', () => {
		const older = { id: 'scf|circle forms|druid|xphb|moon|phb|2|phb', name: 'Circle Forms', kind: 'subclass' }
		expect(wildShapeTemporaryHitPoints([{ className: 'Druid', level: 3 }], [WILD_SHAPE, older])).toBe(3)
	})

	it('keeps a higher existing temporary HP through grantTemporaryHitPoints', () => {
		const amount = wildShapeTemporaryHitPoints([{ className: 'Druid', level: 4 }], [WILD_SHAPE])!
		expect(grantTemporaryHitPoints({ currentHp: 20, temporaryHitPoints: 10 }, amount)).toEqual({ currentHp: 20, temporaryHitPoints: 10 })
		expect(grantTemporaryHitPoints({ currentHp: 20, temporaryHitPoints: 2 }, amount)).toEqual({ currentHp: 20, temporaryHitPoints: 4 })
	})
})
