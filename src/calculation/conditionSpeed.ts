import type { SpeedValue } from './speciesTraits'
import type { Contribution } from './types'

// D360, XPHB condition texts: "Your Speed is 0 and can't increase." (DATA.md: Prone sets no number).
export const SPEED_ZERO_CONDITIONS: readonly string[] = ['Grappled', 'Paralyzed', 'Petrified', 'Restrained', 'Unconscious']

export interface SpeedConditions {
	conditions: readonly string[]
	exhaustion: number
}

const OTHER_MODES = ['fly', 'swim', 'climb'] as const

/**
 * D360: applied after every other source to each movement mode shown. Lines keep
 * the breakdown summing to the walking speed.
 */
export function applyConditionSpeed(value: SpeedValue, { conditions, exhaustion }: SpeedConditions): Contribution[] {
	const lines: Contribution[] = []
	const setAll = (next: (current: number) => number): void => {
		value.walk = next(value.walk)
		for (const mode of OTHER_MODES) {
			const current = value[mode]
			if (current !== undefined) value[mode] = next(current)
		}
	}
	if (exhaustion > 0) {
		const reduction = 5 * exhaustion
		const walkBefore = value.walk
		setAll((current) => Math.max(0, current - reduction))
		lines.push({
			source: `Exhaustion ${exhaustion}`,
			amount: 0 - Math.min(reduction, walkBefore),
			note: reduction > walkBefore ? `−${reduction} ft. (not below 0)` : `−${reduction} ft.`,
		})
	}
	for (const name of SPEED_ZERO_CONDITIONS) {
		if (!conditions.includes(name)) continue
		lines.push({ source: name, amount: 0 - value.walk, note: 'Speed 0' })
		setAll(() => 0)
	}
	return lines
}
