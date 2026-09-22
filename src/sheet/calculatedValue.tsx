/*
 * Display helpers shared by the sheet body and the persistent header
 * (persistent-header rebuild, slice 1). Split out of CharacterSheet.tsx so the
 * header can render the same "value plus breakdown, or D43's unresolved state"
 * without a circular import back into the sheet.
 */

import { type ReactNode } from 'react'
import { type Calculated } from '../calculation/types'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

export function formatModifier(modifier: number): string {
	return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

/** The same value WITHOUT its breakdown — for a place that has moved its breakdown into the drawer (D146/D163), keeping D43's unresolved state. */
export function CalculatedValueOnly({ result, format }: { result: Calculated<number>; format?: (value: number) => string }): ReactNode {
	if (result.status === 'unknown') return <UnresolvedValue reason={result.reason} />
	return <span>{format ? format(result.value) : result.value}</span>
}

/** Renders any Calculated<number> as its value plus breakdown, or D43's visible "unresolved" state. */
export function CalculatedNumber({ result, format }: { result: Calculated<number>; format?: (value: number) => string }): ReactNode {
	if (result.status === 'unknown') return <UnresolvedValue reason={result.reason} />
	return (
		<>
			<span>{format ? format(result.value) : result.value}</span> <ValueBreakdown breakdown={result.breakdown} />
		</>
	)
}
