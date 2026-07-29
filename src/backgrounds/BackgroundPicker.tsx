import { useEffect, useState, type ReactNode } from 'react'
import { loadBackgrounds, type BackgroundEntry, type BackgroundEquipmentEntry } from './backgroundData'
import { abilityBonusChoiceToMap, isValidAbilityBonusChoice, type AbilityBonusChoice } from './abilityBonus'
import type { Ability } from '../abilities/abilityScores'
import { Markup } from '../markup'
import type { DisabledSkill } from '../classSkills/ClassSkillPicker'

/*
 * Character creation, background slice (PHASE1.md build order step 3).
 * Lets the player pick exactly one background and, per PHASE1.md A.3,
 * distribute its ability bonus (+2/+1 or +1/+1/+1) among the three
 * abilities it offers. Does NOT apply the bonus to raw ability scores,
 * grant the skill/tool proficiencies, the origin feat, or the starting
 * equipment — this slice only displays what the background grants and
 * stores what the player chose. Consuming any of it is a later step.
 */

const ABILITY_LABELS: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; backgrounds: BackgroundEntry[] }
	| { status: 'error'; message: string }

export interface BackgroundChoice {
	name: string
	source: string
	abilityBonus: Partial<Record<Ability, number>>
}

function backgroundKey(entry: BackgroundEntry): string {
	return `${entry.name}|${entry.source}`
}

function findDisabled(skill: string, disabledSkills: DisabledSkill[]): DisabledSkill | undefined {
	return disabledSkills.find((d) => d.skill.toLowerCase() === skill.toLowerCase())
}

/**
 * Reconstructs the ability-bonus UI choice from the stored map — the inverse
 * of `abilityBonusChoiceToMap` — so the chooser can redisplay a previously
 * made choice after this component remounts. `null` if the map doesn't match
 * either shape (e.g. nothing chosen yet).
 */
function abilityBonusMapToChoice(map: Partial<Record<Ability, number>> | undefined): AbilityBonusChoice | null {
	if (!map) return null
	const entries = Object.entries(map) as [Ability, number][]
	if (entries.length === 3 && entries.every(([, bonus]) => bonus === 1)) {
		return { kind: 'oneEach' }
	}
	if (entries.length === 2) {
		const plusTwo = entries.find(([, bonus]) => bonus === 2)?.[0]
		const plusOne = entries.find(([, bonus]) => bonus === 1)?.[0]
		if (plusTwo && plusOne) return { kind: 'twoOne', plusTwo, plusOne }
	}
	return null
}

function EquipmentList({ items }: { items: BackgroundEquipmentEntry[] }): ReactNode {
	return (
		<ul className="background-picker__equipment-list">
			{items.map((item, index) => (
				<li key={index}>
					{item.kind === 'coins' ? (
						`${(item.copper / 100).toFixed(item.copper % 100 === 0 ? 0 : 2)} gp`
					) : (
						<>
							<Markup text={item.label} />
							{item.kind === 'item' && item.quantity ? ` (×${item.quantity})` : null}
						</>
					)}
				</li>
			))}
		</ul>
	)
}

/** The ability bonus distribution chooser for one background's offered trio. */
function AbilityBonusChooser({
	offered,
	initialChoice,
	onChoose,
}: {
	offered: readonly [Ability, Ability, Ability]
	initialChoice: AbilityBonusChoice | null
	onChoose: (choice: AbilityBonusChoice | null) => void
}): ReactNode {
	const [mode, setMode] = useState<'twoOne' | 'oneEach'>(initialChoice?.kind ?? 'twoOne')
	const [plusTwo, setPlusTwo] = useState<Ability | ''>(
		initialChoice?.kind === 'twoOne' ? initialChoice.plusTwo : '',
	)
	const [plusOne, setPlusOne] = useState<Ability | ''>(
		initialChoice?.kind === 'twoOne' ? initialChoice.plusOne : '',
	)

	function report(nextMode: 'twoOne' | 'oneEach', nextPlusTwo: Ability | '', nextPlusOne: Ability | ''): void {
		if (nextMode === 'oneEach') {
			onChoose({ kind: 'oneEach' })
			return
		}
		if (!nextPlusTwo || !nextPlusOne) {
			onChoose(null)
			return
		}
		const choice: AbilityBonusChoice = { kind: 'twoOne', plusTwo: nextPlusTwo, plusOne: nextPlusOne }
		onChoose(isValidAbilityBonusChoice(choice, offered) ? choice : null)
	}

	return (
		<div className="background-picker__ability-bonus">
			<p className="background-picker__hint">
				Eligible abilities: {offered.map((a) => ABILITY_LABELS[a]).join(', ')}.
			</p>
			<label>
				<input
					type="radio"
					checked={mode === 'twoOne'}
					onChange={() => {
						setMode('twoOne')
						report('twoOne', plusTwo, plusOne)
					}}
				/>
				+2 to one, +1 to another
			</label>
			{mode === 'twoOne' && (
				<div className="background-picker__ability-bonus-selects">
					<label>
						+2
						<select
							value={plusTwo}
							onChange={(event) => {
								const next = event.target.value as Ability | ''
								setPlusTwo(next)
								report(mode, next, plusOne)
							}}
						>
							<option value="">Choose…</option>
							{offered.map((a) => (
								<option key={a} value={a} disabled={a === plusOne}>
									{ABILITY_LABELS[a]}
								</option>
							))}
						</select>
					</label>
					<label>
						+1
						<select
							value={plusOne}
							onChange={(event) => {
								const next = event.target.value as Ability | ''
								setPlusOne(next)
								report(mode, plusTwo, next)
							}}
						>
							<option value="">Choose…</option>
							{offered.map((a) => (
								<option key={a} value={a} disabled={a === plusTwo}>
									{ABILITY_LABELS[a]}
								</option>
							))}
						</select>
					</label>
				</div>
			)}
			<label>
				<input
					type="radio"
					checked={mode === 'oneEach'}
					onChange={() => {
						setMode('oneEach')
						report('oneEach', plusTwo, plusOne)
					}}
				/>
				+1 to each of {offered.map((a) => ABILITY_LABELS[a]).join(', ')}
			</label>
		</div>
	)
}

/**
 * Shows everything a background grants: proficiencies, feat, equipment
 * options, and offered abilities. `disabledSkills` (D18, D44) flags the
 * background's own fixed skills that the class or species steps already
 * granted — the background's two skills are fixed (no picker here), so this
 * is annotation only, the same wording ClassSkillPicker uses for its own
 * disabled skills.
 */
function BackgroundGrants({
	background,
	disabledSkills,
}: {
	background: BackgroundEntry
	disabledSkills: DisabledSkill[]
}): ReactNode {
	return (
		<div className="background-picker__grants">
			<p>
				<strong>Skill proficiencies:</strong>{' '}
				{background.skillProficiencies
					.map((skill) => {
						const disabled = findDisabled(skill, disabledSkills)
						return disabled
							? `${capitalize(skill)} (already granted by ${disabled.source})`
							: capitalize(skill)
					})
					.join(', ')}
			</p>
			<p>
				<strong>Tool proficiency:</strong>{' '}
				<Markup
					text={background.toolProficiency.kind === 'named' ? background.toolProficiency.name : background.toolProficiency.label}
				/>
			</p>
			<p>
				<strong>Origin feat:</strong> <Markup text={background.originFeat.name} /> ({background.originFeat.source})
			</p>
			<div className="background-picker__equipment">
				<p>
					<strong>Starting equipment — Option A:</strong>
				</p>
				<EquipmentList items={background.equipmentOptionA} />
				<p>
					<strong>Starting equipment — Option B:</strong>
				</p>
				<EquipmentList items={background.equipmentOptionB} />
			</div>
		</div>
	)
}

/**
 * Lets the player pick exactly one background and distribute its ability
 * bonus. Displays `value` — the choice as the caller currently has it — and
 * reports every change upward via `onChange`, matching ClassPicker,
 * AbilityScorePicker and SpeciesPicker: the caller owns the selection, so it
 * survives this component unmounting and remounting.
 */
export function BackgroundPicker({
	value,
	onChange,
	disabledSkills = [],
}: {
	value: BackgroundChoice | null
	onChange: (choice: BackgroundChoice | null) => void
	disabledSkills?: DisabledSkill[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [selectedKey, setSelectedKey] = useState(value ? `${value.name}|${value.source}` : '')
	const [bonusChoice, setBonusChoice] = useState<AbilityBonusChoice | null>(
		abilityBonusMapToChoice(value?.abilityBonus),
	)

	useEffect(() => {
		let cancelled = false
		loadBackgrounds()
			.then((backgrounds) => {
				if (!cancelled) setState({ status: 'ready', backgrounds })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({
						status: 'error',
						message: error instanceof Error ? error.message : String(error),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (state.status === 'loading') return <p>Loading backgrounds…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load backgrounds: {state.message}</p>
	}

	const selected = state.backgrounds.find((b) => backgroundKey(b) === selectedKey)

	function handleSelect(nextKey: string): void {
		setSelectedKey(nextKey)
		setBonusChoice(null)
		onChange(null)
	}

	function handleBonusChoice(choice: AbilityBonusChoice | null): void {
		setBonusChoice(choice)
		if (!selected || !choice) {
			onChange(null)
			return
		}
		onChange({
			name: selected.name,
			source: selected.source,
			abilityBonus: abilityBonusChoiceToMap(choice, selected.abilityChoices),
		})
	}

	return (
		<div className="background-picker">
			<label className="background-picker__field">
				Background
				<select
					value={selectedKey}
					onChange={(event) => handleSelect(event.target.value)}
				>
					<option value="">Choose a background…</option>
					{state.backgrounds.map((entry) => (
						<option key={backgroundKey(entry)} value={backgroundKey(entry)}>
							{entry.name} ({entry.source})
						</option>
					))}
				</select>
			</label>

			{!selected && <p className="background-picker__hint">Pick a background to continue.</p>}

			{selected && (
				<>
					<BackgroundGrants background={selected} disabledSkills={disabledSkills} />
					<AbilityBonusChooser
						offered={selected.abilityChoices}
						initialChoice={bonusChoice}
						onChoose={handleBonusChoice}
					/>
					{!bonusChoice && <p className="background-picker__hint">Choose how to distribute the ability bonus.</p>}
				</>
			)}
		</div>
	)
}
