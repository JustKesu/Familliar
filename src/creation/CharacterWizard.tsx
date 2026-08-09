import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { ClassPicker } from '../classes/ClassPicker'
import { SpeciesPicker } from '../species/SpeciesPicker'
import { BackgroundPicker } from '../backgrounds/BackgroundPicker'
import { AbilityScorePicker } from '../abilities/AbilityScorePicker'
import { LanguagePicker } from '../languages/LanguagePicker'
import { ClassSkillPicker, type DisabledSkill } from '../classSkills/ClassSkillPicker'
import { SpeciesSkillPicker } from '../speciesSkills/SpeciesSkillPicker'
import { ToolProficiencyPicker } from '../toolProficiencies/ToolProficiencyPicker'
import { MasteryPicker } from '../masteries/MasteryPicker'
import { FightingStylePicker } from '../fightingStyle/FightingStylePicker'
import { SubclassPicker } from '../subclass/SubclassPicker'
import { OptionalFeaturePicker } from '../optionalFeatures/OptionalFeaturePicker'
import { ExpertisePicker } from '../expertise/ExpertisePicker'
import { loadExpertiseEligibility, type ExpertiseEligibility } from '../expertise/expertiseData'
import { loadBackgrounds, type BackgroundEntry } from '../backgrounds/backgroundData'
import { loadSubclassesFor, type SubclassOption } from '../subclass/subclassData'
import { FeatAsiPicker } from '../featAsi/FeatAsiPicker'
import { featsRequiringAbilityChoice, loadFeatAsiGrants, loadFeats } from '../featAsi/featAsiData'
import { computeAbilityScore } from '../calculation/abilityScores'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { SpellPicker } from '../spells/SpellPicker'
import { spellListClassFor } from '../spells/classSpellListData'
import { AlwaysPreparedSpellsList } from '../spells/AlwaysPreparedSpellsList'
import { SubclassSpellChoicePicker } from '../spells/SubclassSpellChoicePicker'
import { isSubclassSpellChoice, loadSubclassSpellChoiceShape, unlockedSubclassSpellChoiceSlots } from '../spells/subclassSpellChoiceData'
import { loadSpellCountClassData } from '../spells/spellCountClassData'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { computeSpellCounts } from '../calculation/spellCounts'
import { computeSpellSlots } from '../calculation/spellSlots'
import type { ClassSpellCountData } from '../calculation/spellCounts'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import {
	initialControllerState,
	isReadyToSave,
	isStepComplete,
	saveCharacter,
	stepIndex,
	visibleSteps,
	wizardReducer,
	type SpellRequirement,
	type WizardStep,
} from './wizardState'

/*
 * The wizard shell (PHASE1.md build order step 3, section D — "Character
 * creation is a multi-step wizard, organised by category"). Walks the
 * player through the four categories built so far, in the order that
 * decision records: class and level, species, background, ability scores.
 * Reuses the existing pickers unchanged; each already reports its
 * selection upward via onChange rather than saving directly.
 *
 * Nothing reaches CharacterStore until the review step's save button runs.
 * Every other step only dispatches to the in-memory reducer in
 * wizardState.ts.
 */

const STEP_LABELS: Record<WizardStep, string> = {
	class: 'Class and level',
	species: 'Species',
	background: 'Background',
	expertise: 'Expertise',
	languages: 'Languages',
	abilities: 'Ability scores',
	spells: 'Spells',
	featAsi: 'Ability Score Improvement / Feat',
	review: 'Review and save',
}

export function CharacterWizard({
	store,
	onSaved,
	onCancel,
}: {
	store: CharacterStore
	onSaved: (character: Character) => void
	onCancel: () => void
}): ReactNode {
	const [state, dispatch] = useReducer(wizardReducer, undefined, initialControllerState)
	const [saveError, setSaveError] = useState<string | null>(null)
	const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([])
	const [subclasses, setSubclasses] = useState<SubclassOption[]>([])
	const [expertiseEligibility, setExpertiseEligibility] = useState<ExpertiseEligibility | null>(null)
	const [featAsiGrantCount, setFeatAsiGrantCount] = useState(0)
	const [featsNeedingAbilityChoice, setFeatsNeedingAbilityChoice] = useState<ReadonlySet<string>>(new Set())
	const [spellSlotsClassData, setSpellSlotsClassData] = useState<ClassSpellSlotsData[]>([])
	const [spellCountClassData, setSpellCountClassData] = useState<ClassSpellCountData[]>([])
	const [subclassSpellChoiceSlotCount, setSubclassSpellChoiceSlotCount] = useState(0)

	useEffect(() => {
		let cancelled = false
		loadBackgrounds()
			.then((loaded) => {
				if (!cancelled) setBackgrounds(loaded)
			})
			.catch(() => {
				/* The background step's own picker already surfaces load errors; this lookup is best-effort. */
			})
		return () => {
			cancelled = true
		}
	}, [])

	/**
	 * The full spell-slots/spell-count class data (all classes, every
	 * level) — loaded once, independent of the chosen class, same reasoning
	 * as `backgrounds` above. Feeds computeSpellSlots/computeSpellCounts
	 * (already-built calculation layer, slice b and d2) against a draft
	 * Character below, rather than duplicating either function's own logic.
	 */
	useEffect(() => {
		let cancelled = false
		loadSpellSlotsClassData()
			.then((loaded) => {
				if (!cancelled) setSpellSlotsClassData(loaded)
			})
			.catch(() => {
				/* Best-effort, same as the other class-data lookups above; the spell step surfaces its own load errors. */
			})
		loadSpellCountClassData()
			.then((loaded) => {
				if (!cancelled) setSpellCountClassData(loaded)
			})
			.catch(() => {
				/* Best-effort, same as the other class-data lookups above; the spell step surfaces its own load errors. */
			})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		if (!state.data.classChoice) {
			setSubclasses([])
			return
		}
		loadSubclassesFor(state.data.classChoice.className, state.data.classChoice.classSource)
			.then((loaded) => {
				if (!cancelled) setSubclasses(loaded)
			})
			.catch(() => {
				/* SubclassPicker already surfaces load errors; this lookup (for the subclass's source) is best-effort. */
			})
		return () => {
			cancelled = true
		}
	}, [state.data.classChoice])

	/**
	 * The number of subclass spell-choice slots unlocked at the chosen class
	 * level (build order step 6, slice d6b) — needed synchronously for the
	 * 'spells' step's own completion check (isStepComplete/isReadyToSave in
	 * wizardState.ts), same reasoning as featAsiGrantCount/expertiseEligibility
	 * above: the picker's own panel loads this data too, but the wizard needs
	 * to know the required count before that panel would ever mount.
	 */
	useEffect(() => {
		let cancelled = false
		if (!state.data.classChoice || !state.data.subclass || !isSubclassSpellChoice(state.data.subclass)) {
			setSubclassSpellChoiceSlotCount(0)
			return
		}
		loadSubclassSpellChoiceShape(state.data.subclass.name, state.data.subclass.source, state.data.classChoice.className, state.data.classChoice.classSource)
			.then((shape) => {
				if (cancelled) return
				setSubclassSpellChoiceSlotCount(unlockedSubclassSpellChoiceSlots(shape, state.data.classChoice!.level).length)
			})
			.catch(() => {
				/* SubclassSpellChoicePicker itself surfaces load errors; this lookup (for step completion) is best-effort. */
			})
		return () => {
			cancelled = true
		}
	}, [state.data.classChoice, state.data.subclass])

	/**
	 * Loaded separately from ExpertisePicker's own fetch (same duplication
	 * SubclassPicker already accepts above) — the wizard needs to know
	 * whether the 'expertise' step exists at all, before that step's own
	 * panel would ever mount.
	 */
	useEffect(() => {
		let cancelled = false
		if (!state.data.classChoice) {
			setExpertiseEligibility(null)
			return
		}
		loadExpertiseEligibility(
			state.data.classChoice.className,
			state.data.classChoice.classSource,
			state.data.classChoice.level,
		)
			.then((eligibility) => {
				if (!cancelled) setExpertiseEligibility(eligibility)
			})
			.catch(() => {
				/* ExpertisePicker itself surfaces load errors; this lookup (for step visibility) is best-effort. */
			})
		return () => {
			cancelled = true
		}
	}, [state.data.classChoice])

	/** Same reasoning as the expertise effect above — the wizard needs the grant count for step visibility before FeatAsiPicker's own panel would mount. */
	useEffect(() => {
		let cancelled = false
		if (!state.data.classChoice) {
			setFeatAsiGrantCount(0)
			return
		}
		loadFeatAsiGrants(state.data.classChoice.className, state.data.classChoice.classSource, state.data.classChoice.level)
			.then((grants) => {
				if (!cancelled) setFeatAsiGrantCount(grants.length)
			})
			.catch(() => {
				/* FeatAsiPicker itself surfaces load errors; this lookup (for step visibility) is best-effort. */
			})
		return () => {
			cancelled = true
		}
	}, [state.data.classChoice])

	/**
	 * The feats needing an ability choice (half-feat ability-choice slice) —
	 * loaded once, independent of class/level like the feat list itself.
	 * Duplicates FeatAsiPicker's own `loadFeats` fetch, same as the other
	 * best-effort lookups above — the wizard needs this for the 'featAsi'
	 * step's completion check before that step's own panel would mount.
	 */
	useEffect(() => {
		let cancelled = false
		loadFeats()
			.then((feats) => {
				if (!cancelled) setFeatsNeedingAbilityChoice(featsRequiringAbilityChoice(feats))
			})
			.catch(() => {
				/* FeatAsiPicker itself surfaces load errors; this lookup (for step completion) is best-effort. */
			})
		return () => {
			cancelled = true
		}
	}, [])

	const selectedBackground = state.data.backgroundChoice
		? backgrounds.find(
				(b) => b.name === state.data.backgroundChoice!.name && b.source === state.data.backgroundChoice!.source,
			)
		: undefined

	/** D18: the background's two fixed skills are shown to the class skill picker as already granted, not offered again. */
	const backgroundSkillsAsDisabled: DisabledSkill[] = selectedBackground
		? selectedBackground.skillProficiencies.map((skill) => ({ skill, source: selectedBackground.name }))
		: []

	/** D18/D44: what the class step has already granted, shown to the species and background steps. */
	const classSkillsAsDisabled: DisabledSkill[] = state.data.classChoice
		? state.data.classSkills.map((skill) => ({ skill, source: state.data.classChoice!.className }))
		: []

	/**
	 * D44: species is chosen before background, so by the time the player
	 * reaches the background step its skills are already known and must be
	 * flagged there — the same way the class step already flags collisions
	 * with the background's fixed skills.
	 */
	const speciesSkillsAsDisabled: DisabledSkill[] = state.data.speciesChoice
		? state.data.speciesSkills.map((skill) => ({ skill, source: state.data.speciesChoice!.name }))
		: []

	/**
	 * Every skill the character is already proficient in, from all three
	 * sources the expertise step may draw from (task instructions, point 3) —
	 * the same three lists already assembled above for D18/D44's disabled-
	 * skill wiring. First source wins if a skill somehow appears in more than
	 * one (the earlier pickers already prevent picking the same skill twice
	 * across sources, so this is a defensive dedupe, not an expected case).
	 */
	const proficientSkills: DisabledSkill[] = [
		...classSkillsAsDisabled,
		...backgroundSkillsAsDisabled,
		...speciesSkillsAsDisabled,
	].filter((entry, index, all) => all.findIndex((other) => other.skill === entry.skill) === index)

	/**
	 * The expertise pool narrowed by the class's own restriction (Scholar),
	 * and the count clamped to what that pool can actually supply (task
	 * instructions, point 3) — never asks for more skills than the character
	 * has, and this is the exact number the 'expertise' step and the final
	 * save both require.
	 */
	const expertisePool = expertiseEligibility?.restrictedTo
		? proficientSkills.filter((entry) => expertiseEligibility.restrictedTo!.includes(entry.skill))
		: proficientSkills
	const expertiseRequiredCount = expertiseEligibility ? Math.min(expertiseEligibility.count, expertisePool.length) : null

	/**
	 * FINAL ability scores (base + background bonus) via the calculation
	 * layer's own computeAbilityScore (D16/D17, task instructions point 4) —
	 * built from a draft Character rather than a second sum, since the real
	 * Character doesn't exist until the review step saves. Feeds
	 * FeatAsiPicker's prerequisite checks.
	 */
	const draftCharacterForAbilityScores: Character = {
		id: '',
		name: state.data.name,
		classes: [],
		...(state.data.abilityScores ? { abilityScores: state.data.abilityScores } : {}),
		...(state.data.backgroundChoice?.abilityBonus ? { abilityBonus: state.data.backgroundChoice.abilityBonus } : {}),
	}
	const finalAbilityScores = Object.fromEntries(
		ABILITIES.map((ability) => {
			const calculated = computeAbilityScore(ability, draftCharacterForAbilityScores)
			return [ability, calculated.status === 'known' ? calculated.value.score : undefined]
		}),
	) as Partial<Record<Ability, number>>

	/**
	 * Slots (slice b) and counts (slice d2) via the calculation layer,
	 * reused unchanged — this only builds the draft Character they need
	 * (real classes.json data loaded once above) and reads off the single
	 * class's entry, phase-1 D11. Eldritch Knight/Arcane Trickster (D46)
	 * flow through for free: their subclass name is already on the draft,
	 * and both compute functions already fall back to the subclass's own
	 * table when the base class has none.
	 */
	const draftCharacterForSpells: Character = {
		id: '',
		name: state.data.name,
		classes: state.data.classChoice
			? [
					{
						className: state.data.classChoice.className,
						classSource: state.data.classChoice.classSource,
						subclass: state.data.subclass?.name ?? null,
						level: state.data.classChoice.level,
					},
				]
			: [],
	}
	const spellSlotsResult = computeSpellSlots(draftCharacterForSpells, spellSlotsClassData)
	const spellCountsResult = computeSpellCounts(draftCharacterForSpells, spellCountClassData)
	const spellSlotsEntry = spellSlotsResult.status === 'known' ? spellSlotsResult.value[0] : undefined
	const spellCountEntry = spellCountsResult.status === 'known' ? spellCountsResult.value[0] : undefined
	const spellRequirement: SpellRequirement | null = spellCountEntry
		? { cantripCount: spellCountEntry.cantripCount, leveledSpellCount: spellCountEntry.leveledSpellCount, label: spellCountEntry.label }
		: null
	/** D46: EK/AT's picker draws from the Wizard list, not Fighter's/Rogue's (classSpellListData.ts's THIRD_CASTER_SPELL_LIST). */
	const spellListClass = state.data.classChoice
		? spellListClassFor(state.data.classChoice.className, state.data.classChoice.classSource, state.data.subclass?.name)
		: null

	function handleSave(): void {
		try {
			const character = saveCharacter(
				store,
				state.data,
				selectedBackground?.skillProficiencies,
				expertiseRequiredCount,
				featAsiGrantCount,
				featsNeedingAbilityChoice,
				spellRequirement,
				subclassSpellChoiceSlotCount,
			)
			setSaveError(null)
			onSaved(character)
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : String(error))
		}
	}

	const canGoNext = isStepComplete(
		state.step,
		state.data,
		expertiseRequiredCount,
		featAsiGrantCount,
		featsNeedingAbilityChoice,
		spellRequirement,
		subclassSpellChoiceSlotCount,
	)

	return (
		<div className="wizard">
			<ol className="wizard__steps">
				{visibleSteps(expertiseRequiredCount, featAsiGrantCount, spellRequirement).map((step, index) => (
					<li
						key={step}
						className={step === state.step ? 'wizard__step wizard__step--active' : 'wizard__step'}
					>
						{index + 1}. {STEP_LABELS[step]}
					</li>
				))}
			</ol>

			{state.step === 'class' && (
				<div className="wizard__panel">
					<label className="wizard__field">
						Character name
						<input
							type="text"
							value={state.data.name}
							onChange={(event) => dispatch({ type: 'setName', name: event.target.value })}
						/>
					</label>
					<ClassPicker
						value={state.data.classChoice}
						onChange={(choice) => dispatch({ type: 'setClassChoice', choice })}
					/>
					{state.data.classChoice && (
						<>
							<ClassSkillPicker
								className={state.data.classChoice.className}
								classSource={state.data.classChoice.classSource}
								value={state.data.classSkills}
								onChange={(skills) => dispatch({ type: 'setClassSkills', skills })}
								disabledSkills={backgroundSkillsAsDisabled}
							/>
							<MasteryPicker
								className={state.data.classChoice.className}
								classSource={state.data.classChoice.classSource}
								level={state.data.classChoice.level}
								value={state.data.masteries}
								onChange={(weapons) => dispatch({ type: 'setMasteries', weapons })}
							/>
							<FightingStylePicker
								className={state.data.classChoice.className}
								classSource={state.data.classChoice.classSource}
								level={state.data.classChoice.level}
								value={state.data.fightingStyle}
								onChange={(style) => dispatch({ type: 'setFightingStyle', style })}
							/>
							<SubclassPicker
								className={state.data.classChoice.className}
								classSource={state.data.classChoice.classSource}
								level={state.data.classChoice.level}
								value={state.data.subclass?.name ?? null}
								onChange={(subclassName) => {
									const found = subclassName ? subclasses.find((sc) => sc.name === subclassName) : undefined
									dispatch({
										type: 'setSubclass',
										subclass: found ? { name: found.name, source: found.source, featureType: found.featureType } : null,
									})
								}}
							/>
							{state.data.subclass && (
								<OptionalFeaturePicker
									className={state.data.classChoice.className}
									classSource={state.data.classChoice.classSource}
									subclassName={state.data.subclass.name}
									subclassSource={state.data.subclass.source}
									level={state.data.classChoice.level}
									value={state.data.optionalFeatureChoices}
									onChange={(choices) => dispatch({ type: 'setOptionalFeatureChoices', choices })}
								/>
							)}
						</>
					)}
				</div>
			)}

			{state.step === 'species' && (
				<div className="wizard__panel">
					<SpeciesPicker
						value={state.data.speciesChoice}
						onChange={(choice) => dispatch({ type: 'setSpeciesChoice', choice })}
					/>
					{state.data.speciesChoice && (
						<SpeciesSkillPicker
							speciesName={state.data.speciesChoice.name}
							speciesSource={state.data.speciesChoice.source}
							value={state.data.speciesSkills}
							onChange={(skills) => dispatch({ type: 'setSpeciesSkills', skills })}
							disabledSkills={[...classSkillsAsDisabled, ...backgroundSkillsAsDisabled]}
						/>
					)}
				</div>
			)}

			{state.step === 'background' && (
				<div className="wizard__panel">
					<BackgroundPicker
						value={state.data.backgroundChoice}
						onChange={(choice) => dispatch({ type: 'setBackgroundChoice', choice })}
						disabledSkills={[...classSkillsAsDisabled, ...speciesSkillsAsDisabled]}
					/>
					{selectedBackground && (
						<ToolProficiencyPicker
							toolProficiency={selectedBackground.toolProficiency}
							value={state.data.backgroundToolProficiency}
							onChange={(tool) => dispatch({ type: 'setBackgroundToolProficiency', tool })}
						/>
					)}
				</div>
			)}

			{state.step === 'expertise' && state.data.classChoice && (
				<div className="wizard__panel">
					<ExpertisePicker
						className={state.data.classChoice.className}
						classSource={state.data.classChoice.classSource}
						level={state.data.classChoice.level}
						proficientSkills={proficientSkills}
						value={state.data.expertiseSkills}
						onChange={(skills) => dispatch({ type: 'setExpertiseSkills', skills })}
					/>
				</div>
			)}

			{state.step === 'languages' && (
				<div className="wizard__panel">
					<LanguagePicker
						value={state.data.languageChoice}
						onChange={(choice) => dispatch({ type: 'setLanguageChoice', choice })}
					/>
				</div>
			)}

			{state.step === 'abilities' && (
				<div className="wizard__panel">
					<AbilityScorePicker
						value={state.data.abilityScores}
						onChange={(scores) => dispatch({ type: 'setAbilityScores', scores })}
					/>
				</div>
			)}

			{state.step === 'spells' && state.data.classChoice && spellRequirement && spellListClass && (
				<div className="wizard__panel">
					<SpellPicker
						className={spellListClass.className}
						classSource={spellListClass.classSource}
						spellSlots={spellSlotsEntry}
						cantripCount={spellRequirement.cantripCount}
						leveledSpellCount={spellRequirement.leveledSpellCount}
						label={spellRequirement.label}
						value={state.data.spellChoices}
						onChange={(choices) => dispatch({ type: 'setSpellChoices', choices })}
					/>
					{state.data.subclass && (
						<AlwaysPreparedSpellsList
							subclassName={state.data.subclass.name}
							subclassSource={state.data.subclass.source}
							className={state.data.classChoice.className}
							classSource={state.data.classChoice.classSource}
							classLevel={state.data.classChoice.level}
						/>
					)}
					{state.data.subclass && isSubclassSpellChoice(state.data.subclass) && (
						<SubclassSpellChoicePicker
							subclassName={state.data.subclass.name}
							subclassSource={state.data.subclass.source}
							className={state.data.classChoice.className}
							classSource={state.data.classChoice.classSource}
							classLevel={state.data.classChoice.level}
							value={state.data.subclassSpellChoices}
							onChange={(picks) => dispatch({ type: 'setSubclassSpellChoices', picks })}
						/>
					)}
				</div>
			)}

			{state.step === 'featAsi' && state.data.classChoice && (
				<div className="wizard__panel">
					<FeatAsiPicker
						className={state.data.classChoice.className}
						classSource={state.data.classChoice.classSource}
						level={state.data.classChoice.level}
						finalAbilityScores={finalAbilityScores}
						speciesName={state.data.speciesChoice?.name ?? null}
						speciesSource={state.data.speciesChoice?.source ?? null}
						value={state.data.featAsiChoices}
						onChange={(choices) => dispatch({ type: 'setFeatAsiChoices', choices })}
					/>
				</div>
			)}

			{state.step === 'review' && (
				<div className="wizard__panel">
					<p>Name: {state.data.name}</p>
					<p>
						Class: {state.data.classChoice ? `${state.data.classChoice.className} (level ${state.data.classChoice.level})` : '—'}
					</p>
					<p>Species: {state.data.speciesChoice?.name ?? '—'}</p>
					<p>Background: {state.data.backgroundChoice?.name ?? '—'}</p>
					<p>Tool proficiency: {state.data.backgroundToolProficiency ?? '—'}</p>
					<p>
						Languages: Common
						{state.data.languageChoice.length > 0
							? `, ${state.data.languageChoice.map((l) => l.name).join(', ')}`
							: ''}
					</p>
					<p>
						Expertise: {state.data.expertiseSkills.length > 0 ? state.data.expertiseSkills.join(', ') : '—'}
					</p>
					<p>Ability score method: {state.data.abilityScores?.method ?? '—'}</p>
					<p>
						Spells: {state.data.spellChoices.length > 0 ? state.data.spellChoices.map((s) => s.name).join(', ') : '—'}
					</p>
					<p>
						Ability Score Improvements / feats:{' '}
						{state.data.featAsiChoices.length > 0
							? state.data.featAsiChoices
									.map((choice) =>
										choice.kind === 'asi'
											? `level ${choice.level}: ASI (${Object.entries(choice.increases)
													.map(([ability, amount]) => `${ability} +${amount}`)
													.join(', ')})`
											: `level ${choice.level}: ${choice.name}${choice.chosenAbility ? ` (${choice.chosenAbility})` : ''}`,
									)
									.join('; ')
							: '—'}
					</p>
					{saveError && <p className="error">{saveError}</p>}
				</div>
			)}

			<div className="wizard__nav">
				<button type="button" onClick={onCancel}>
					Cancel
				</button>
				<button
					type="button"
					onClick={() =>
						dispatch({ type: 'back', expertiseRequiredCount, featAsiEligibleLevelCount: featAsiGrantCount, spellRequirement })
					}
					disabled={stepIndex(state.step, expertiseRequiredCount, featAsiGrantCount, spellRequirement) === 0}
				>
					Back
				</button>
				{state.step === 'review' ? (
					<button
						type="button"
						onClick={handleSave}
						disabled={
							!isReadyToSave(
								state.data,
								expertiseRequiredCount,
								featAsiGrantCount,
								featsNeedingAbilityChoice,
								spellRequirement,
								subclassSpellChoiceSlotCount,
							)
						}
					>
						Create character
					</button>
				) : (
					<button
						type="button"
						onClick={() =>
							dispatch({
								type: 'next',
								expertiseRequiredCount,
								featAsiEligibleLevelCount: featAsiGrantCount,
								featsRequiringAbilityChoice: featsNeedingAbilityChoice,
								spellRequirement,
								subclassSpellChoiceSlotCount,
							})
						}
						disabled={!canGoNext}
					>
						Next
					</button>
				)}
			</div>
		</div>
	)
}

export default CharacterWizard
