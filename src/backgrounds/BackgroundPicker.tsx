import { useEffect, useState, type ReactNode } from 'react'
import { loadBackgrounds, type BackgroundEntry } from './backgroundData'
import type { StartingEquipmentElement } from '../inventory/startingEquipmentData'
import {
	abilityBonusDistributionToMap,
	isAbilityBonusDistributionComplete,
	type AbilityBonusDistribution,
} from './abilityBonus'
import type { Ability } from '../abilities/abilityScores'
import { Markup } from '../markup'
import type { DisabledSkill } from '../classSkills/ClassSkillPicker'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'

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
	/**
	 * The finished +2/+1 or +1/+1/+1 wire map once the distribution is complete;
	 * `{}` until then. Derived from `abilityBonusDistribution` (the source of
	 * truth) by the picker and written alongside it — kept on the choice so
	 * saveCharacter and the abilities-step preview don't need the background's
	 * offered trio. A non-empty map is exactly "the distribution is done".
	 */
	abilityBonus: Partial<Record<Ability, number>>
	/**
	 * The distribution chooser's UI state, held by the wizard (D8) so a
	 * partly-made choice — background picked, one or neither ability chosen —
	 * redisplays after this step unmounts and remounts. `null` until the player
	 * first touches the chooser.
	 */
	abilityBonusDistribution: AbilityBonusDistribution | null
}

function backgroundKey(entry: BackgroundEntry): string {
	return `${entry.name}|${entry.source}`
}

function findDisabled(skill: string, disabledSkills: DisabledSkill[]): DisabledSkill | undefined {
	return disabledSkills.find((d) => d.skill.toLowerCase() === skill.toLowerCase())
}

/*
 * A preview only: this step shows what each option grants, and the equipment
 * step is where one gets taken. Both read the same parsed elements, so a pack
 * is named here exactly as it is named there — its contents are only listed at
 * the point the player actually takes it.
 */
function EquipmentList({ elements }: { elements: StartingEquipmentElement[] }): ReactNode {
	return (
		<ul className="background-picker__equipment-list">
			{elements.map((element, index) => (
				<li key={index}>
					<Markup text={element.label} />
				</li>
			))}
		</ul>
	)
}

/**
 * The ability bonus distribution chooser for one background's offered trio.
 * CONTROLLED (D8): it holds none of its own state — it renders `distribution`
 * and reports every change up, so a partly-made choice lives in the wizard
 * and survives this step unmounting.
 */
function AbilityBonusChooser({
	offered,
	distribution,
	onChange,
}: {
	offered: readonly [Ability, Ability, Ability]
	distribution: AbilityBonusDistribution | null
	onChange: (next: AbilityBonusDistribution) => void
}): ReactNode {
	const mode: 'twoOne' | 'oneEach' = distribution?.mode ?? 'twoOne'
	const plusTwo = distribution?.mode === 'twoOne' ? distribution.plusTwo : null
	const plusOne = distribution?.mode === 'twoOne' ? distribution.plusOne : null

	return (
		<div className="background-picker__ability-bonus">
			<p className="background-picker__hint">
				Eligible abilities: {offered.map((a) => ABILITY_LABELS[a]).join(', ')}.
			</p>
			<label>
				<input
					type="radio"
					checked={mode === 'twoOne'}
					onChange={() => onChange({ mode: 'twoOne', plusTwo, plusOne })}
				/>
				+2 to one, +1 to another
			</label>
			{mode === 'twoOne' && (
				<div className="background-picker__ability-bonus-selects">
					<label>
						+2
						<select
							value={plusTwo ?? ''}
							onChange={(event) =>
								onChange({ mode: 'twoOne', plusTwo: (event.target.value || null) as Ability | null, plusOne })
							}
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
							value={plusOne ?? ''}
							onChange={(event) =>
								onChange({ mode: 'twoOne', plusTwo, plusOne: (event.target.value || null) as Ability | null })
							}
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
					onChange={() => onChange({ mode: 'oneEach' })}
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
				{background.startingEquipment.options.map((option) => (
					<div key={option.key}>
						<p>
							<strong>Starting equipment — {option.label}:</strong>
						</p>
						<EquipmentList elements={option.elements} />
					</div>
				))}
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

	const { backgrounds } = state
	const selectedKey = value ? `${value.name}|${value.source}` : ''
	const selected = backgrounds.find((b) => backgroundKey(b) === selectedKey)

	function handleSelect(nextKey: string): void {
		if (nextKey === selectedKey) return
		const entry = backgrounds.find((b) => backgroundKey(b) === nextKey)
		if (!entry) return
		// A fresh background starts with the distribution untouched; the wizard's
		// setBackgroundChoice keys tool proficiency / expertise off the name+source.
		onChange({ name: entry.name, source: entry.source, abilityBonus: {}, abilityBonusDistribution: null })
	}

	function handleDistribution(next: AbilityBonusDistribution): void {
		if (!selected || !value) return
		onChange({
			name: value.name,
			source: value.source,
			abilityBonusDistribution: next,
			abilityBonus: abilityBonusDistributionToMap(next, selected.abilityChoices),
		})
	}

	const options: SearchableOption[] = backgrounds.map((entry) => ({
		key: backgroundKey(entry),
		name: entry.name,
		label: `${entry.name} (${entry.source})`,
		selected: backgroundKey(entry) === selectedKey,
	}))

	return (
		<div className="background-picker">
			<SearchableOptionList
				legend="Background"
				name="background"
				inputType="radio"
				options={options}
				required={1}
				renderCount={({ chosen }) => (chosen === 0 ? 'Choose a background.' : 'Background chosen.')}
				onToggle={(key) => handleSelect(key)}
			/>

			{!selected && <p className="background-picker__hint">Pick a background to continue.</p>}

			{selected && (
				<>
					<BackgroundGrants background={selected} disabledSkills={disabledSkills} />
					<AbilityBonusChooser
						offered={selected.abilityChoices}
						distribution={value?.abilityBonusDistribution ?? null}
						onChange={handleDistribution}
					/>
					{!isAbilityBonusDistributionComplete(value?.abilityBonusDistribution ?? null, selected.abilityChoices) && (
						<p className="background-picker__hint">Choose how to distribute the ability bonus.</p>
					)}
				</>
			)}
		</div>
	)
}
