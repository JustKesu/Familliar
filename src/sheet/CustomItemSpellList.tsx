import { useEffect, useState, type ReactNode } from 'react'
import { loadSpellDetails } from '../spells/spellDetailData'
import type { CustomItemSpell, CustomItemSpellAbility } from '../storage/character'
import { englishOrder } from './CustomItemGrantList'
import { ordinalLevel } from './spellsTabData'

/** One row of the Spells block as typed; D116: nothing reaches the character until submit. `spell` is name|source, '' not chosen yet. */
export interface SpellRow {
	spell: string
	uses: CustomItemSpell['uses']['kind']
	count: string
	/** null is the spell's own level. */
	castLevel: number | null
	caster: 'own' | 'fixed'
	ability: CustomItemSpellAbility | ''
	saveDc: string
	attackBonus: string
}

const ABILITY_LABELS: Record<CustomItemSpellAbility, string> = { int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }

function wholeNumber(text: string): number | undefined {
	const value = Number(text)
	return text.trim() !== '' && Number.isInteger(value) ? value : undefined
}

export function spellRowsFrom(spells: readonly CustomItemSpell[] | undefined): SpellRow[] {
	return (spells ?? []).map((spell) => ({
		spell: `${spell.name}|${spell.source}`,
		uses: spell.uses.kind,
		count: spell.uses.kind === 'atWill' ? '1' : String(spell.uses.count),
		castLevel: spell.castLevel ?? null,
		caster: spell.caster.kind,
		ability: spell.caster.kind === 'own' ? spell.caster.ability : '',
		saveDc: spell.caster.kind === 'fixed' && spell.caster.saveDc !== undefined ? String(spell.caster.saveDc) : '',
		attackBonus: spell.caster.kind === 'fixed' && spell.caster.attackBonus !== undefined ? String(spell.caster.attackBonus) : '',
	}))
}

/** A chosen spell whose required values are missing or not whole numbers — the item cannot be saved while one exists. */
export function spellRowsIncomplete(rows: readonly SpellRow[]): boolean {
	return rows.some(
		(row) =>
			row.spell !== '' &&
			((row.uses !== 'atWill' && !((wholeNumber(row.count) ?? 0) >= 1)) ||
				(row.caster === 'own' && row.ability === '') ||
				(row.caster === 'fixed' && [row.saveDc, row.attackBonus].some((text) => text.trim() !== '' && wholeNumber(text) === undefined))),
	)
}

/** Blank rows are dropped and a repeated spell keeps its first row. Call only when spellRowsIncomplete is false. */
export function spellsFromRows(rows: readonly SpellRow[]): CustomItemSpell[] {
	const chosen = rows.filter((row, index) => row.spell !== '' && rows.findIndex((other) => other.spell === row.spell) === index)
	return chosen.map((row) => {
		const [name = '', source = ''] = row.spell.split('|')
		const saveDc = wholeNumber(row.saveDc)
		const attackBonus = wholeNumber(row.attackBonus)
		return {
			name,
			source,
			uses: row.uses === 'atWill' ? { kind: 'atWill' } : { kind: row.uses, count: wholeNumber(row.count) ?? 1 },
			...(row.castLevel !== null ? { castLevel: row.castLevel } : {}),
			caster:
				row.caster === 'own'
					? { kind: 'own', ability: row.ability as CustomItemSpellAbility }
					: { kind: 'fixed', ...(saveDc !== undefined ? { saveDc } : {}), ...(attackBonus !== undefined ? { attackBonus } : {}) },
		}
	})
}

interface SpellOption {
	value: string
	label: string
	level: number
}

/** R14c2 (D219): the spells a custom item grants — row = spell · uses · cast level · DC and attack · Remove. */
export function CustomItemSpellList({
	rows,
	defaultAbility,
	onChange,
}: {
	rows: readonly SpellRow[]
	/** The first casting class's ability, preselected when a row switches to "Use my own". */
	defaultAbility: CustomItemSpellAbility | null
	onChange: (rows: SpellRow[]) => void
}): ReactNode {
	const [options, setOptions] = useState<SpellOption[] | null>(null)
	const needed = rows.length > 0
	useEffect(() => {
		if (!needed || options !== null) return
		let cancelled = false
		loadSpellDetails()
			.then((details) => {
				if (cancelled) return
				const repeated = new Set(details.filter((detail, i) => details.findIndex((other) => other.name === detail.name) !== i).map((detail) => detail.name))
				const labelled = details.map((detail) => ({
					value: `${detail.name}|${detail.source}`,
					label: repeated.has(detail.name) ? `${detail.name} (${detail.source})` : detail.name,
					level: detail.level,
				}))
				setOptions(labelled.sort((a, b) => a.level - b.level || englishOrder(a.label, b.label)))
			})
			.catch(() => {
				if (!cancelled) setOptions([])
			})
		return () => {
			cancelled = true
		}
	}, [needed, options])

	const set = (index: number, change: Partial<SpellRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))
	const levels = [...new Set((options ?? []).map((option) => option.level))]

	return (
		<div className="sheet__custom-item-proficiencies" role="group" aria-label="Custom item spells">
			<p>Spells</p>
			{rows.map((row, index) => {
				const number = index + 1
				const label = `Custom item spell ${number}`
				const usedElsewhere = new Set(rows.filter((_, i) => i !== index).map((other) => other.spell))
				const offered = (options ?? []).filter((option) => option.value === row.spell || !usedElsewhere.has(option.value))
				const level = options?.find((option) => option.value === row.spell)?.level
				return (
					<p key={index}>
						<label>
							Spell{' '}
							<select
								aria-label={label}
								value={row.spell}
								onChange={(event) => {
									const chosenLevel = options?.find((option) => option.value === event.target.value)?.level
									set(index, { spell: event.target.value, castLevel: null, ...(chosenLevel === 0 ? { uses: 'atWill' } : {}) })
								}}
							>
								<option value="">choose…</option>
								{/* A stored spell stays selectable while the list loads or if the data no longer has it. */}
								{row.spell !== '' && level === undefined && <option value={row.spell}>{row.spell.split('|')[0]}</option>}
								{levels.map((optionLevel) => (
									<optgroup key={optionLevel} label={optionLevel === 0 ? 'Cantrips' : ordinalLevel(optionLevel)}>
										{offered
											.filter((option) => option.level === optionLevel)
											.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
									</optgroup>
								))}
							</select>
						</label>{' '}
						{level !== undefined && level > 0 && (
							<>
								<label>
									Uses{' '}
									<select aria-label={`${label} uses`} value={row.uses} onChange={(event) => set(index, { uses: event.target.value as SpellRow['uses'] })}>
										<option value="atWill">At will</option>
										<option value="perLongRest">N per Long Rest</option>
										<option value="perShortRest">N per Short Rest</option>
									</select>
								</label>{' '}
								{row.uses !== 'atWill' && (
									<label>
										N{' '}
										<input type="number" min={1} step={1} aria-label={`${label} uses per rest`} value={row.count} onChange={(event) => set(index, { count: event.target.value })} />
									</label>
								)}{' '}
								<label>
									Cast at level{' '}
									<select
										aria-label={`${label} cast at level`}
										value={row.castLevel ?? level}
										onChange={(event) => set(index, { castLevel: Number(event.target.value) === level ? null : Number(event.target.value) })}
									>
										{Array.from({ length: 10 - level }, (_, i) => level + i).map((castLevel) => (
											<option key={castLevel} value={castLevel}>
												{ordinalLevel(castLevel)}
											</option>
										))}
									</select>
								</label>{' '}
							</>
						)}
						<label>
							DC and attack{' '}
							<select
								aria-label={`${label} DC and attack`}
								value={row.caster}
								onChange={(event) => {
									const caster = event.target.value as SpellRow['caster']
									set(index, { caster, ...(caster === 'own' && row.ability === '' ? { ability: defaultAbility ?? '' } : {}) })
								}}
							>
								<option value="fixed">Fixed by the item</option>
								<option value="own">Use my own</option>
							</select>
						</label>{' '}
						{row.caster === 'own' ? (
							<label>
								Spellcasting ability{' '}
								<select
									aria-label={`${label} spellcasting ability`}
									required
									value={row.ability}
									onChange={(event) => set(index, { ability: event.target.value as SpellRow['ability'] })}
								>
									<option value="">choose…</option>
									{(Object.keys(ABILITY_LABELS) as CustomItemSpellAbility[]).map((ability) => (
										<option key={ability} value={ability}>
											{ABILITY_LABELS[ability]}
										</option>
									))}
								</select>
							</label>
						) : (
							<>
								<label>
									Save DC{' '}
									<input type="number" step={1} aria-label={`${label} save DC`} value={row.saveDc} onChange={(event) => set(index, { saveDc: event.target.value })} />
								</label>{' '}
								<label>
									Attack bonus{' '}
									<input type="number" step={1} aria-label={`${label} attack bonus`} value={row.attackBonus} onChange={(event) => set(index, { attackBonus: event.target.value })} />
								</label>
							</>
						)}{' '}
						<button type="button" aria-label={`Remove custom item spell ${number}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
							Remove
						</button>
					</p>
				)
			})}
			<p>
				<button
					type="button"
					onClick={() => onChange([...rows, { spell: '', uses: 'atWill', count: '1', castLevel: null, caster: 'own', ability: defaultAbility ?? '', saveDc: '', attackBonus: '' }])}
				>
					+ Add spell
				</button>
			</p>
		</div>
	)
}
