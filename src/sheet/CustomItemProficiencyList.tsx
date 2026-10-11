import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { compareText } from '../text/compareText'
import { SKILL_LABELS, SKILLS, type Skill } from '../calculation/skills'
import { CUSTOM_CONDITION_NAMES, CUSTOM_PROFICIENCY_ARMOR, CUSTOM_WEAPON_CATEGORIES, customProficiencyKey, type ItemRef } from '../inventory/inventoryData'
import { FEATURE_LANGUAGE_TYPES } from '../languages/classFeatureLanguages'
import { loadLanguages } from '../languages/languageData'
import type { CustomItemProficiency, CustomProficiencyArmor, CustomWeaponCategory } from '../storage/character'
import { loadToolCategoryOptions } from '../toolProficiencies/toolProficiencyData'

/** One row as the form holds it (D116: nothing reaches the character until submit). `value` is the kind's own key: 'martial', 'Longsword|XPHB', 'heavy', a tool or language name, an ability or a skill. */
export interface ProficiencyRow {
	kind: string
	value: string
	expertise: boolean
}

const KIND_OPTIONS = [
	{ kind: 'weaponCategory', label: 'Weapon category' },
	{ kind: 'weapon', label: 'Weapon' },
	{ kind: 'armor', label: 'Armor' },
	{ kind: 'tool', label: 'Tool' },
	{ kind: 'language', label: 'Language' },
	{ kind: 'savingThrow', label: 'Saving throw' },
	{ kind: 'skill', label: 'Skill' },
] as const

const ARMOR_LABELS: Record<CustomProficiencyArmor, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy', shield: 'Shields' }

// The tool categories a species' "any tool" pick draws from (ToolCategory in toolProficiencyData.ts).
const TOOL_CATEGORIES = ['anyArtisansTool', 'anyGamingSet', 'anyMusicalInstrument', 'anyOtherTool']

function capitalised(text: string): string {
	return text[0].toUpperCase() + text.slice(1)
}

export function proficiencyRowsFrom(entries: readonly CustomItemProficiency[] | undefined): ProficiencyRow[] {
	return (entries ?? []).map((entry): ProficiencyRow => {
		switch (entry.kind) {
			case 'weaponCategory':
				return { kind: entry.kind, value: entry.category, expertise: false }
			case 'weapon':
				return { kind: entry.kind, value: `${entry.name}|${entry.source}`, expertise: false }
			case 'armor':
				return { kind: entry.kind, value: entry.armor, expertise: false }
			case 'tool':
				return { kind: entry.kind, value: entry.tool, expertise: false }
			case 'language':
				return { kind: entry.kind, value: entry.language, expertise: false }
			case 'savingThrow':
				return { kind: entry.kind, value: entry.ability, expertise: false }
			case 'skill':
				return { kind: entry.kind, value: entry.skill, expertise: entry.expertise === true }
		}
	})
}

function entryFromRow(row: ProficiencyRow): CustomItemProficiency | null {
	if (row.value === '') return null
	switch (row.kind) {
		case 'weaponCategory':
			return { kind: row.kind, category: row.value as CustomWeaponCategory }
		case 'weapon': {
			const [name, source] = row.value.split('|')
			return { kind: row.kind, name, source }
		}
		case 'armor':
			return { kind: row.kind, armor: row.value as CustomProficiencyArmor }
		case 'tool':
			return { kind: row.kind, tool: row.value }
		case 'language':
			return { kind: row.kind, language: row.value }
		case 'savingThrow':
			return { kind: row.kind, ability: row.value as Ability }
		case 'skill':
			return row.expertise ? { kind: row.kind, skill: row.value as Skill, expertise: true } : { kind: row.kind, skill: row.value as Skill }
		default:
			return null
	}
}

/** Rows without a kind or a value are dropped; a repeated entry keeps its first row. */
export function proficienciesFromRows(rows: readonly ProficiencyRow[]): CustomItemProficiency[] {
	const seen = new Set<string>()
	return rows.flatMap((row) => {
		const entry = entryFromRow(row)
		if (entry === null || seen.has(customProficiencyKey(entry))) return []
		seen.add(customProficiencyKey(entry))
		return [entry]
	})
}

interface Option {
	value: string
	label: string
}

function baseWeaponOptions(itemRefs: readonly ItemRef[]): Option[] {
	return itemRefs
		.filter((ref) => ref.weapon === true)
		.map((ref) => ({ value: `${ref.name}|${ref.source}`, label: `${ref.name} (${ref.source})` }))
		.sort((a, b) => compareText(a.label, b.label))
}

function namesToOptions(names: readonly string[] | null): Option[] {
	return (names ?? []).map((name) => ({ value: name, label: name }))
}

/** The tool and language lists are the wizard's own; each loads only once a row of that kind exists. */
function useLoadedNames(needed: boolean, load: () => Promise<string[]>): string[] | null {
	const [names, setNames] = useState<string[] | null>(null)
	useEffect(() => {
		if (!needed || names !== null) return
		let cancelled = false
		load()
			.then((loaded) => {
				if (!cancelled) setNames(loaded)
			})
			.catch(() => {
				if (!cancelled) setNames([])
			})
		return () => {
			cancelled = true
		}
	}, [needed, names, load])
	return names
}

const loadAllTools = async (): Promise<string[]> => {
	const lists = await Promise.all(TOOL_CATEGORIES.map((category) => loadToolCategoryOptions(category)))
	return [...new Set(lists.flat())].sort(compareText)
}
const loadAllLanguages = async (): Promise<string[]> => (await loadLanguages(FEATURE_LANGUAGE_TYPES)).map((language) => language.name)

/** R14b (D217): the proficiencies a custom item grants, laid out like the bonus rows. */
export function CustomItemProficiencyList({
	rows,
	itemRefs,
	onChange,
}: {
	rows: readonly ProficiencyRow[]
	itemRefs: readonly ItemRef[]
	onChange: (rows: ProficiencyRow[]) => void
}): ReactNode {
	const tools = useLoadedNames(rows.some((row) => row.kind === 'tool'), loadAllTools)
	const languages = useLoadedNames(rows.some((row) => row.kind === 'language'), loadAllLanguages)
	const weapons = baseWeaponOptions(itemRefs)

	function optionsFor(kind: string): Option[] {
		switch (kind) {
			case 'weaponCategory':
				return CUSTOM_WEAPON_CATEGORIES.map((category) => ({ value: category, label: capitalised(category) }))
			case 'weapon':
				return weapons
			case 'armor':
				return CUSTOM_PROFICIENCY_ARMOR.map((armor) => ({ value: armor, label: ARMOR_LABELS[armor] }))
			case 'tool':
				return namesToOptions(tools)
			case 'language':
				return namesToOptions(languages)
			case 'savingThrow':
				return ABILITIES.map((ability) => ({ value: ability, label: capitalised(ability) }))
			case 'skill':
				return [...SKILLS].sort().map((skill) => ({ value: skill, label: SKILL_LABELS[skill] }))
			default:
				return []
		}
	}

	function change(index: number, patch: Partial<ProficiencyRow>): void {
		onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
	}

	return (
		<div className="sheet__custom-item-proficiencies" role="group" aria-label="Custom item proficiencies">
			<p>Proficiencies</p>
			{rows.map((row, index) => {
				const number = index + 1
				const usedElsewhere = new Set(
					rows
						.filter((_, i) => i !== index)
						.map((other) => entryFromRow(other))
						.flatMap((entry) => (entry === null ? [] : [customProficiencyKey(entry)])),
				)
				const options = optionsFor(row.kind)
				// A stored value stays selectable while its list is still loading or if the list no longer has it.
				const listed = row.value === '' || options.some((option) => option.value === row.value) ? options : [...options, { value: row.value, label: row.value }]
				return (
					<p key={index}>
						<label>
							Kind{' '}
							<select
								aria-label={`Custom item proficiency ${number} kind`}
								value={row.kind}
								onChange={(event) => change(index, { kind: event.target.value, value: '', expertise: false })}
							>
								<option value="">choose…</option>
								{KIND_OPTIONS.map((option) => (
									<option key={option.kind} value={option.kind}>
										{option.label}
									</option>
								))}
							</select>
						</label>{' '}
						{row.kind !== '' && (
							<label>
								Value{' '}
								<select aria-label={`Custom item proficiency ${number} value`} value={row.value} onChange={(event) => change(index, { value: event.target.value })}>
									<option value="">choose…</option>
									{listed
										.filter((option) => {
											const entry = entryFromRow({ ...row, value: option.value })
											return option.value === row.value || entry === null || !usedElsewhere.has(customProficiencyKey(entry))
										})
										.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
								</select>
							</label>
						)}{' '}
						{row.kind === 'skill' && (
							<>
								<label>
									Level{' '}
									<select
										aria-label={`Custom item proficiency ${number} level`}
										value={row.expertise ? 'expertise' : 'proficient'}
										onChange={(event) => change(index, { expertise: event.target.value === 'expertise' })}
									>
										<option value="proficient">Proficient</option>
										<option value="expertise">Expertise</option>
									</select>
								</label>{' '}
							</>
						)}
						<button type="button" aria-label={`Remove custom item proficiency ${number}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
							Remove
						</button>
					</p>
				)
			})}
			<p>
				<button type="button" onClick={() => onChange([...rows, { kind: '', value: '', expertise: false }])}>
					+ Add proficiency
				</button>
			</p>
		</div>
	)
}

/**
 * The 15 conditions as checkboxes, built like DamageTypeChoice (ManageInventoryPanel.tsx). A <span> carries the
 * group because this sits inside the form's <p>s.
 */
export function ConditionChoice({ label, selected, onChange }: { label: string; selected: string[] | undefined; onChange: (names: string[] | undefined) => void }): ReactNode {
	const chosen = selected ?? []
	function toggle(name: string, checked: boolean): void {
		const next = checked ? [...chosen, name] : chosen.filter((entry) => entry !== name)
		onChange(next.length === 0 ? undefined : next)
	}
	return (
		<span className="sheet__damage-type-choice" role="group" aria-label={label}>
			{label}:{' '}
			{CUSTOM_CONDITION_NAMES.map((name) => (
				<label key={name}>
					<input type="checkbox" aria-label={`${label}: ${name}`} checked={chosen.includes(name)} onChange={(event) => toggle(name, event.target.checked)} />{' '}
					{name}
				</label>
			))}
		</span>
	)
}
