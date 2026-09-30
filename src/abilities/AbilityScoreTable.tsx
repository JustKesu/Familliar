import type { ReactNode } from 'react'
import { ABILITIES, type Ability } from './abilityScores'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import { computeAbilityScore } from '../calculation/abilityScores'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { AbilityBonusMap, Character } from '../storage/character'

function signed(value: number): string {
	return value >= 0 ? `+${value}` : `−${Math.abs(value)}`
}

/**
 * W12: Base · Background · ASI / Feats · Total · Modifier per ability, shared by the
 * Ability scores step and the ASI / Feat step (W-5). Totals come from computeAbilityScore (D17);
 * no override row (D9). `feats` omitted shows "—" in the ASI / Feats row.
 */
export function AbilityScoreTable({
	base,
	background,
	feats,
	draft,
	inputs,
}: {
	base: Record<Ability, number | null>
	background: AbilityBonusMap | undefined
	feats?: FeatEffectEntry[]
	/** The rest of the draft character the feat contributions read (W-5). */
	draft?: Partial<Character>
	/** One control per column, rendered as the first row so it lines up with the table. */
	inputs?: Record<Ability, ReactNode>
}): ReactNode {
	const character: Character = {
		id: '',
		name: '',
		classes: [],
		...draft,
		abilityScores: { method: 'standardArray', scores: Object.fromEntries(ABILITIES.map((a) => [a, base[a] ?? 0])) as Record<Ability, number> },
		...(background ? { abilityBonus: background } : {}),
	}
	const rows = ABILITIES.map((ability) => {
		const calculated = computeAbilityScore(ability, character, feats ?? [])
		const breakdown = calculated.status === 'known' ? calculated.breakdown : []
		const asi = breakdown.filter((c) => c.source !== 'base' && c.source !== 'background').reduce((sum, c) => sum + c.amount, 0)
		const value = base[ability] !== null && calculated.status === 'known' ? calculated.value : null
		return { ability, background: background?.[ability] ?? 0, asi, value }
	})

	return (
		<div className="ability-table__scroll">
			<table className="ability-table">
				<thead>
					<tr>
						<td />
						{ABILITIES.map((ability) => (
							<th key={ability} scope="col" className="ability-table__heading">
								{ABILITY_ABBREVIATIONS[ability].toUpperCase()}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{inputs && (
						<tr className="ability-table__inputs">
							<td />
							{ABILITIES.map((ability) => (
								<td key={ability}>{inputs[ability]}</td>
							))}
						</tr>
					)}
					<tr>
						<th scope="row">Base</th>
						{ABILITIES.map((ability) => (
							<td key={ability}>{base[ability] ?? '—'}</td>
						))}
					</tr>
					<tr>
						<th scope="row">Background</th>
						{rows.map((row) => (
							<td key={row.ability}>{row.background ? signed(row.background) : '—'}</td>
						))}
					</tr>
					<tr>
						<th scope="row">ASI / Feats</th>
						{rows.map((row) => (
							<td key={row.ability}>{feats && row.asi ? signed(row.asi) : '—'}</td>
						))}
					</tr>
					<tr className="ability-table__total">
						<th scope="row">Total</th>
						{rows.map((row) => (
							<td key={row.ability}>{row.value ? row.value.score : '—'}</td>
						))}
					</tr>
					<tr className="ability-table__modifier">
						<th scope="row">Modifier</th>
						{rows.map((row) => (
							<td key={row.ability}>{row.value ? signed(row.value.modifier) : '—'}</td>
						))}
					</tr>
				</tbody>
			</table>
		</div>
	)
}
