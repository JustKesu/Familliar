import { WILD_SHAPE_CLASS_NAME } from './wildShapeData'

const XPHB_WILD_SHAPE_ID = 'cf|wild shape|druid|xphb|2|xphb'

/**
 * D364: Temporary Hit Points for assuming a Wild Shape form — the Druid level
 * (Wild Shape, XPHB), three times it with Circle Forms (Circle of the Moon,
 * XPHB). Null when the character does not hold the XPHB Wild Shape: the PHB
 * 2014 feature grants none.
 */
export function wildShapeTemporaryHitPoints(
	classes: readonly { className: string; level: number }[],
	features: readonly { id: string; name: string; kind: string }[],
): number | null {
	if (!features.some((feature) => feature.id === XPHB_WILD_SHAPE_ID)) return null
	const druidLevel = classes.filter((entry) => entry.className === WILD_SHAPE_CLASS_NAME).reduce((sum, entry) => sum + entry.level, 0)
	// scf|name|class|classSource|subclass|subclassSource|level|source — the 2014 Moon's Circle Forms is a different rule.
	const circleForms = features.some((feature) => {
		const parts = feature.id.split('|')
		return feature.kind === 'subclass' && parts[1] === 'circle forms' && parts[2] === 'druid' && parts[3] === 'xphb' && parts[5] === 'xphb'
	})
	return circleForms ? 3 * druidLevel : druidLevel
}
