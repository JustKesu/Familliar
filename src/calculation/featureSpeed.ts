import type { EquippedArmour, EquippedShield } from './armourClass'
import type { Contribution } from './types'

/*
 * A4 (D70 hand table, XPHB text): class features and feats that raise the walking
 * speed, keyed by the feature's own name. Unarmored Movement's amount is the Monk
 * table's "Unarmored Movement" column, read by the caller; the others are fixed.
 */
type SpeedCondition = 'noArmourNoShield' | 'notHeavyArmour' | 'none'

const SPEED_FEATURES: readonly { name: string; amount: number | 'table'; condition: SpeedCondition }[] = [
	// "Your speed increases by 10 feet while you aren't wearing armor or wielding a Shield." (the bonus grows with the table column)
	{ name: 'Unarmored Movement', amount: 'table', condition: 'noArmourNoShield' },
	// "Your speed increases by 10 feet while you aren't wearing Heavy armor."
	{ name: 'Fast Movement', amount: 10, condition: 'notHeavyArmour' },
	// "Your Speed increases by 10 feet while you aren't wearing Heavy armor."
	{ name: 'Roving', amount: 10, condition: 'notHeavyArmour' },
	// Speedy feat: "Your Speed increases by 10 feet."
	{ name: 'Speedy', amount: 10, condition: 'none' },
]

function blockedBy(condition: SpeedCondition, armour: EquippedArmour | null, shield: EquippedShield | null): string | null {
	if (condition === 'noArmourNoShield') {
		if (armour) return `not while wearing ${armour.name}`
		if (shield) return `not while wielding ${shield.name}`
	}
	if (condition === 'notHeavyArmour' && armour?.category === 'heavy') return `not while wearing ${armour.name} (heavy armour)`
	return null
}

/** Speed rows for `featureNames` (class features and feats the character has), worn gear judged the way computeArmourClass judges it. */
export function featureSpeedAdjustments(
	featureNames: readonly string[],
	unarmoredMovement: number | null,
	armour: EquippedArmour | null,
	shield: EquippedShield | null,
): Contribution[] {
	const rows: Contribution[] = []
	for (const feature of SPEED_FEATURES) {
		if (!featureNames.includes(feature.name)) continue
		const amount = feature.amount === 'table' ? (unarmoredMovement ?? 0) : feature.amount
		if (amount <= 0) continue
		const blocked = blockedBy(feature.condition, armour, shield)
		rows.push(blocked ? { source: feature.name, amount: 0, note: `considered (+${amount} ft.) — not applied: ${blocked}` } : { source: feature.name, amount })
	}
	return rows
}
