import type { ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { SKILL_LABELS, SKILLS, type Skill } from '../calculation/skills'
import { CUSTOM_BONUS_PASSIVES, customBonusKey, type CUSTOM_BONUS_PLAIN_TARGETS } from '../inventory/inventoryData'
import type { CustomBonusPassive, CustomItemBonus } from '../storage/character'

/** One row as the form holds it: the amount stays text so a half-typed "-" is not lost (D116 — nothing reaches the character until submit). */
export interface BonusRow {
	/** customBonusKey's spelling ("skill:stealth"), or '' before a target is picked. */
	target: string
	amount: string
	perLevel: boolean
}

function capitalised(text: string): string {
	return text[0].toUpperCase() + text.slice(1)
}

const TARGET_GROUPS: readonly { label: string; options: readonly { key: string; label: string }[] }[] = [
	{
		label: 'General',
		options: [
			{ key: 'armourClass', label: 'Armor Class' },
			{ key: 'initiative', label: 'Initiative' },
			{ key: 'maxHitPoints', label: 'Max HP' },
			{ key: 'weaponAttack', label: 'Weapon attack rolls' },
			{ key: 'weaponDamage', label: 'Weapon damage rolls' },
			{ key: 'spellAttack', label: 'Spell attack' },
			{ key: 'spellSaveDc', label: 'Spell save DC' },
		],
	},
	{
		label: 'Saving throws',
		options: [{ key: 'allSavingThrows', label: 'All saving throws' }, ...ABILITIES.map((ability) => ({ key: `savingThrow:${ability}`, label: capitalised(ability) }))],
	},
	{
		label: 'Ability checks & skills',
		options: [{ key: 'allAbilityChecks', label: 'All ability checks' }, ...[...SKILLS].sort().map((skill) => ({ key: `skill:${skill}`, label: SKILL_LABELS[skill] }))],
	},
	{ label: 'Passive', options: CUSTOM_BONUS_PASSIVES.map((passive) => ({ key: `passive:${passive}`, label: `Passive ${capitalised(passive)}` })) },
	{
		label: 'Familiar',
		options: [
			{ key: 'familiarArmourClass', label: 'Familiar: AC' },
			{ key: 'familiarMaxHitPoints', label: 'Familiar: Max HP' },
			{ key: 'familiarAttack', label: 'Familiar: Attack rolls' },
			{ key: 'familiarDamage', label: 'Familiar: Damage rolls' },
			{ key: 'familiarSavingThrows', label: 'Familiar: Saving throws (all)' },
			{ key: 'familiarWalkingSpeed', label: 'Familiar: Walking speed' },
		],
	},
]

const PER_LEVEL_TARGETS: readonly string[] = ['maxHitPoints', 'familiarMaxHitPoints']

export function bonusRowsFrom(bonuses: readonly CustomItemBonus[] | undefined): BonusRow[] {
	return (bonuses ?? []).map((bonus) => ({ target: customBonusKey(bonus), amount: String(bonus.amount), perLevel: PER_LEVEL_TARGETS.includes(bonus.target) && 'perLevel' in bonus && bonus.perLevel === true }))
}

/** Rows without a target, or with an empty or 0 amount, are dropped. */
export function bonusesFromRows(rows: readonly BonusRow[]): CustomItemBonus[] {
	return rows.flatMap((row): CustomItemBonus[] => {
		const amount = Math.trunc(Number(row.amount))
		if (row.target === '' || row.amount.trim() === '' || !Number.isFinite(amount) || amount === 0) return []
		const [target, qualifier] = row.target.split(':')
		if (target === 'savingThrow') return [{ target, ability: qualifier as Ability, amount }]
		if (target === 'skill') return [{ target, skill: qualifier as Skill, amount }]
		if (target === 'passive') return [{ target, passive: qualifier as CustomBonusPassive, amount }]
		if (target === 'maxHitPoints' || target === 'familiarMaxHitPoints') return [row.perLevel ? { target, amount, perLevel: true } : { target, amount }]
		return [{ target: target as Exclude<(typeof CUSTOM_BONUS_PLAIN_TARGETS)[number], 'maxHitPoints' | 'familiarMaxHitPoints'>, amount }]
	})
}

/** R14a1 (D216): the custom item's numeric bonuses — D9/D55's sanctioned way to adjust a number, never an override. */
export function CustomItemBonusList({ rows, onChange }: { rows: readonly BonusRow[]; onChange: (rows: BonusRow[]) => void }): ReactNode {
	function change(index: number, patch: Partial<BonusRow>): void {
		onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
	}

	return (
		<div className="sheet__custom-item-bonuses" role="group" aria-label="Custom item bonuses">
			<p>Bonuses</p>
			{rows.map((row, index) => {
				const number = index + 1
				const usedElsewhere = new Set(rows.filter((_, i) => i !== index).map((other) => other.target))
				return (
					<p key={index}>
						<label>
							Target{' '}
							<select
								aria-label={`Custom item bonus ${number} target`}
								value={row.target}
								onChange={(event) => change(index, { target: event.target.value, perLevel: PER_LEVEL_TARGETS.includes(event.target.value) && row.perLevel })}
							>
								<option value="">choose…</option>
								{TARGET_GROUPS.map((group) => {
									const options = group.options.filter((option) => !usedElsewhere.has(option.key))
									return (
										options.length > 0 && (
											<optgroup key={group.label} label={group.label}>
												{options.map((option) => (
													<option key={option.key} value={option.key}>
														{option.label}
													</option>
												))}
											</optgroup>
										)
									)
								})}
							</select>
						</label>{' '}
						<label>
							Amount{' '}
							<input
								type="number"
								step={1}
								className="input--narrow"
								aria-label={`Custom item bonus ${number} amount`}
								value={row.amount}
								onChange={(event) => change(index, { amount: event.target.value })}
							/>
						</label>{' '}
						{PER_LEVEL_TARGETS.includes(row.target) && (
							<>
								<label>
									<input
										type="checkbox"
										aria-label={`Custom item bonus ${number} per level`}
										checked={row.perLevel}
										onChange={(event) => change(index, { perLevel: event.target.checked })}
									/>{' '}
									per level
								</label>{' '}
							</>
						)}
						<button type="button" aria-label={`Remove custom item bonus ${number}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
							Remove
						</button>
					</p>
				)
			})}
			<p>
				<button type="button" onClick={() => onChange([...rows, { target: '', amount: '', perLevel: false }])}>
					+ Add bonus
				</button>
			</p>
		</div>
	)
}
