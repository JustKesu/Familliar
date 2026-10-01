import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { AbilityScoreTable } from '../abilities/AbilityScoreTable'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { ResolvedEntries, type ResolverData } from '../featureResolver'
import { Entries } from '../markup'
import type { Character, FeatAsiChoice, FilterChoiceSpellsChoice } from '../storage/character'
import {
	isFilterChoiceFeat,
	isNamedBlockFeat,
	loadFilterChoiceFeatShape,
	loadNamedBlockOptions,
	loadSlotCandidates,
	ritualCasterSpellCount,
	type FilterChoiceCandidateSpell,
	type FilterChoiceFeatShape,
	type NamedBlockOption,
} from '../spells/featSpellChoiceData'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import { loadFixedFeatSpells, type FeatGrantedSpell } from '../spells/featSpells'
import { featSpellPickerKey, knownSpellNote, knownSpellReason, type KnownSpell } from '../spells/knownSpells'
import {
	ABILITY_LABEL,
	exceedsAbilityScoreCap,
	FEAT_CATEGORY_LABELS,
	featAbilityCap,
	featAbilityChoiceOptions,
	featCampaignNote,
	featCategoryLabel,
	isMagicInitiateFeat,
	isValidAbilityIncrease,
	MAGIC_INITIATE_ABILITY_OPTIONS,
	type FeatAsiGrant,
	type FeatOffer,
} from './featAsiData'
import { featAsiCardTitle, featAsiMissing, FeatAsiLevelCard, featOptionLabel } from './FeatAsiLevelCard'
import { featAsiChoiceProblem, featAsiLevelOffers, featAsiLevels, grantedFeatsOf, type FeatAsiLevels, type FeatAsiStepLoad } from './featAsiLevels'
import type { FeatInstanceKey, FeatRef } from './featInstances'
import { FeatSubChoicePicker, type FeatChoiceHeld } from './FeatSubChoicePicker'

/*
 * Feat/ASI picker (build order step 4a). One card per level that grants a
 * choice (D19/D20, W16): one dropdown with ASI and every feat, then only the
 * sub-choices of what was picked.
 *
 * Mirrors ExpertisePicker/D8: state lives in the wizard (`value`), this
 * component only displays it and reports changes upward. Renders nothing
 * when the class has no grant by `level`.
 */

const ASI_TEXT = 'Increase one ability score by 2, or two ability scores by 1 each. No score can go above 20.'

const NO_LOCKED_LEVELS: readonly number[] = []
const NO_MANUAL_FEATS: readonly FeatRef[] = []

export function FeatAsiPicker({
	load,
	level,
	value,
	onChange,
	alreadyKnown = [],
	lockedLevels = NO_LOCKED_LEVELS,
	backgroundOriginFeat = null,
	manualFeats = NO_MANUAL_FEATS,
	itemFeats = NO_MANUAL_FEATS,
	heldForFeat,
	laterNote = false,
	abilityDraft,
	resolverData,
}: {
	/** F-3: the wizard's own load (useFeatAsiStepData), so the step's gate and the picker read one state. */
	load: FeatAsiStepLoad
	level: number
	value: FeatAsiChoice[]
	onChange: (choices: FeatAsiChoice[]) => void
	/** Spells the character already has from elsewhere (knownSpells.ts) — shown but not selectable in either spell sub-picker below. A feat's own picks are excluded by key so unselecting stays possible. */
	alreadyKnown?: readonly KnownSpell[]
	/** D110: during a level up, the grant levels the character already made a choice for — shown, not changeable. */
	lockedLevels?: readonly number[]
	/** The feat the background grants (D156) — counts as already taken, so a non-repeatable one is not offered again. */
	backgroundOriginFeat?: FeatRef | null
	/** Feats added manually (R13b, D215: grantedFeats origin 'manual') — count as already taken and in the prerequisite context, same as featOffers in the Manage Feats panel. */
	manualFeats?: readonly FeatRef[]
	/** R14c1 (D218): feats an item grants right now — count as already taken; never in the ability scores (D253). */
	itemFeats?: readonly (FeatRef & { itemName?: string })[]
	/** D160: what the character has apart from the feat at this instance key. */
	heldForFeat?: (key: FeatInstanceKey) => FeatChoiceHeld
	/** D179: show that a feat's own picks can wait for Edit Character. */
	laterNote?: boolean
	/** W16: the draft character the ability table on top reads (scores, background bonus, other feats). D253: also the base of each card's prerequisite scores. */
	abilityDraft: Character
	resolverData?: ResolverData
}): ReactNode {
	const levels = useMemo(
		() => (load.status === 'ready' ? featAsiLevels(load.data, value, grantedFeatsOf(backgroundOriginFeat, manualFeats, itemFeats), abilityDraft) : null),
		[load, value, abilityDraft, backgroundOriginFeat, manualFeats, itemFeats],
	)

	if (load.status === 'error') {
		return <p className="error">Could not load feats: {load.message}</p>
	}
	if (!levels) return null
	const { grants, feats, featsRequiringAbilityChoice } = levels.data
	if (grants.length === 0) return null

	// loadFeats keeps each feats.json object whole, so it carries the ability fields the calculation layer reads.
	const featEffects = feats as unknown as FeatEffectEntry[]

	function setChoiceAt(index: number, choice: FeatAsiChoice): void {
		if (lockedLevels.includes(grants[index].level)) return
		// Choosing a later card first must not leave holes: readers iterate the array, and the unchosen card is the empty feat placeholder.
		const next = Array.from({ length: index }, (_, i): FeatAsiChoice => value[i] ?? { level: grants[i].level, kind: 'feat', name: '', source: '' })
		next.push(choice, ...value.slice(index + 1))
		onChange(next.slice(0, grants.length))
	}

	function selectOption(index: number, grantLevel: number, option: string): void {
		if (option === 'asi') return setChoiceAt(index, { level: grantLevel, kind: 'asi', increases: {} })
		const split = option.lastIndexOf('|')
		setChoiceAt(index, { level: grantLevel, kind: 'feat', name: option.slice(0, split), source: option.slice(split + 1) })
	}

	return (
		<div className="feat-asi-picker">
			<div className="feat-asi-picker__table">
				<AbilityScoreTable
					base={Object.fromEntries(ABILITIES.map((ability) => [ability, abilityDraft.abilityScores?.scores[ability] ?? null])) as Record<Ability, number | null>}
					background={abilityDraft.abilityBonus}
					feats={featEffects}
					draft={levels.draft}
				/>
			</div>
			{grants.map((grant, index) => {
				const current = value[index]
				const locked = lockedLevels.includes(grant.level)
				const selectedFeat = current?.kind === 'feat' && current.name !== '' ? feats.find((f) => f.name === current.name && f.source === current.source) : undefined
				const abilityOptions = selectedFeat ? featAbilityChoiceOptions(selectedFeat) : null
				const campaignNote = selectedFeat ? featCampaignNote(selectedFeat) : null
				const missing = locked ? [] : featAsiMissing(current, feats, featsRequiringAbilityChoice, level)
				const problem = featAsiChoiceProblem(levels, current)
				const line = [...(problem ? [locked ? `${problem} Fix it in Edit Character.` : problem] : []), ...(missing.length > 0 ? [`Choose ${missing.join(', ')}.`] : [])].join(' ')
				const lineId = `feat-asi-${grant.level}-missing`
				const selectValue = current?.kind === 'asi' ? 'asi' : current?.kind === 'feat' && current.name !== '' ? `${current.name}|${current.source}` : ''

				return (
					<FeatAsiLevelCard
						key={grant.level}
						level={grant.level}
						title={featAsiCardTitle(grant.level, current, feats, grant.kind)}
						initiallyOpen={line !== ''}
						flagged={problem !== null}
						locked={locked}
					>
						<FeatOrAsiSelect
							levels={levels}
							grant={grant}
							value={selectValue}
							describedBy={line !== '' ? lineId : undefined}
							onChange={(option) => selectOption(index, grant.level, option)}
						/>
						{line !== '' && (
							<p className="feat-asi-card__missing" id={lineId}>
								{line}
							</p>
						)}

						{current?.kind === 'asi' && (
							<>
								<AsiSubPicker
									grantLevel={grant.level}
									increases={current.increases}
									currentScores={levels.scoresBelow(grant.level)}
									onChange={(increases) => setChoiceAt(index, { level: grant.level, kind: 'asi', increases })}
								/>
								<p className="feat-asi-card__text">{ASI_TEXT}</p>
							</>
						)}

						{current?.kind === 'feat' && abilityOptions && (
							<HalfFeatAbilitySelect
								grantLevel={grant.level}
								options={abilityOptions}
								currentScores={levels.scoresBelow(grant.level)}
								cap={featAbilityCap(selectedFeat!)}
								value={current.chosenAbility}
								onChange={(ability) => setChoiceAt(index, { ...current, chosenAbility: ability })}
							/>
						)}

						{current?.kind === 'feat' && current.name && (
							<FeatSubChoicePicker
								feat={current}
								value={current}
								onChange={(details) => setChoiceAt(index, { ...details, level: grant.level, kind: 'feat', name: current.name, source: current.source })}
								held={heldForFeat?.(`asi:${grant.level}`)}
								alreadyKnown={alreadyKnown}
								magicInitiateRequired={isMagicInitiateFeat(current)}
								laterNote={laterNote}
								idPrefix={`asi-${grant.level}`}
							/>
						)}

						{current?.kind === 'feat' && current.name && isNamedBlockFeat(current) && (
							<NamedBlockSubPicker
								featName={current.name}
								featSource={current.source}
								grantLevel={grant.level}
								blockName={current.blockName}
								chosenAbility={current.chosenAbility}
								onSelectBlock={(blockName, resetSpells) => {
									const { blockName: _block, filterChoiceSpells, ...rest } = current
									setChoiceAt(index, { ...rest, ...(resetSpells || !filterChoiceSpells ? {} : { filterChoiceSpells }), ...(blockName ? { blockName } : {}) })
								}}
								onSelectAbility={(ability) => setChoiceAt(index, { ...current, chosenAbility: ability })}
							/>
						)}

						{current?.kind === 'feat' && current.name && isFilterChoiceFeat(current) && (!isNamedBlockFeat(current) || current.blockName !== undefined) && (
							<FilterChoiceSpellSubPicker
								featName={current.name}
								featSource={current.source}
								blockName={current.blockName}
								characterLevel={level}
								chosenAbility={current.chosenAbility}
								alreadyKnown={alreadyKnown}
								filterChoiceSpells={current.filterChoiceSpells ?? null}
								onChange={(filterChoiceSpells) => setChoiceAt(index, { ...current, filterChoiceSpells })}
							/>
						)}

						{campaignNote && <p className="feat-asi-picker__note">{campaignNote}</p>}
						{selectedFeat?.entries && (
							<div className="feat-asi-card__text">{resolverData ? <ResolvedEntries entries={selectedFeat.entries} data={resolverData} /> : <Entries entries={selectedFeat.entries} />}</div>
						)}
					</FeatAsiLevelCard>
				)
			})}
		</div>
	)
}

/** +2 to one ability, or +1 to two — the level-20 cap (D20) disables any option that would exceed it. Exported for the Manage Feats panel (R13b, D215), which edits an ASI level's increases the same way. */
export function AsiSubPicker({
	grantLevel,
	increases,
	currentScores,
	onChange,
}: {
	grantLevel: number
	increases: Partial<Record<Ability, number>>
	currentScores: Partial<Record<Ability, number>>
	onChange: (increases: Partial<Record<Ability, number>>) => void
}): ReactNode {
	/*
	 * The mode can't be derived from `increases.length` alone: switching to
	 * "+1 to two abilities" starts from zero choices, which is as empty as
	 * "+2 to one ability" also is — deriving it would snap back to plusTwo
	 * on the very next render, making the second radio unreachable. Local
	 * state remembers which one the player picked; the initializer still
	 * derives it once, so a level loaded with two increases already opens
	 * on the right radio.
	 */
	const [mode, setMode] = useState<'plusTwo' | 'plusOneTwice'>(Object.keys(increases).length === 2 ? 'plusOneTwice' : 'plusTwo')
	const [ability1] = Object.keys(increases)
	const chosenAbilities = Object.keys(increases) as Ability[]

	function wouldExceedCap(ability: Ability, amount: number): boolean {
		return exceedsAbilityScoreCap(currentScores, { [ability]: amount })
	}

	function setPlusTwo(ability: Ability): void {
		const next = { [ability]: 2 }
		if (isValidAbilityIncrease(next) && !wouldExceedCap(ability, 2)) onChange(next)
	}

	function setPlusOne(slot: 0 | 1, ability: Ability): void {
		const others = chosenAbilities.filter((_, i) => i !== slot)
		if (others.includes(ability)) return
		const next: Partial<Record<Ability, number>> = { ...increases }
		const previous = chosenAbilities[slot]
		if (previous) delete next[previous]
		if (wouldExceedCap(ability, 1)) return
		next[ability] = 1
		onChange(next)
	}

	return (
		<div className="feat-asi-picker__asi">
			<label>
				<input
					type="radio"
					name={`asi-mode-${grantLevel}`}
					checked={mode === 'plusTwo'}
					onChange={() => {
						setMode('plusTwo')
						onChange({})
					}}
				/>
				+2 to one ability
			</label>
			<label>
				<input
					type="radio"
					name={`asi-mode-${grantLevel}`}
					checked={mode === 'plusOneTwice'}
					onChange={() => {
						setMode('plusOneTwice')
						onChange({})
					}}
				/>
				+1 to two abilities
			</label>

			{mode === 'plusTwo' ? (
				<select aria-label={`Level ${grantLevel} +2 ability`} value={ability1 ?? ''} onChange={(event) => setPlusTwo(event.target.value as Ability)}>
					<option value="" disabled>
						Choose an ability
					</option>
					{ABILITIES.map((ability) => (
						<option key={ability} value={ability} disabled={wouldExceedCap(ability, 2)}>
							{ABILITY_LABEL[ability]}
							{wouldExceedCap(ability, 2) ? ' (would exceed 20)' : ''}
						</option>
					))}
				</select>
			) : (
				<>
					{([0, 1] as const).map((slot) => (
						<select key={slot} aria-label={`Level ${grantLevel} +1 ability ${slot + 1}`} value={chosenAbilities[slot] ?? ''} onChange={(event) => setPlusOne(slot, event.target.value as Ability)}>
							<option value="" disabled>
								Choose an ability
							</option>
							{ABILITIES.map((ability) => (
								<option
									key={ability}
									value={ability}
									disabled={wouldExceedCap(ability, 1) || (chosenAbilities.includes(ability) && chosenAbilities[slot] !== ability)}
								>
									{ABILITY_LABEL[ability]}
									{wouldExceedCap(ability, 1) ? ' (would exceed 20)' : ''}
								</option>
							))}
						</select>
					))}
				</>
			)}
		</div>
	)
}

/**
 * W16: every feat in one dropdown, grouped by category; D19 still holds — an ineligible or held one
 * stays listed, disabled, with the reason in its text (W18). Epic Boon levels list that pool first.
 */
function FeatOrAsiSelect({
	levels,
	grant,
	value,
	describedBy,
	onChange,
}: {
	levels: FeatAsiLevels
	grant: FeatAsiGrant
	value: string
	describedBy: string | undefined
	onChange: (value: string) => void
}): ReactNode {
	// D116: built only while the card is open, and once per change of the step's choices.
	const { groups, categories } = useMemo(() => {
		const offers = featAsiLevelOffers(levels, grant.level).sort((a, b) => a.feat.name.localeCompare(b.feat.name))
		const groups = new Map<string, FeatOffer[]>()
		for (const offer of offers) {
			const group = groups.get(offer.feat.category)
			if (group) group.push(offer)
			else groups.set(offer.feat.category, [offer])
		}
		const order = Object.keys(FEAT_CATEGORY_LABELS)
		const rank = (category: string) => (grant.kind === 'epicBoon' && category === 'EB' ? -1 : order.includes(category) ? order.indexOf(category) : order.length)
		return { groups, categories: [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)) }
	}, [levels, grant])
	const missingFeat = value !== '' && value !== 'asi' && ![...groups.values()].some((group) => group.some((offer) => `${offer.feat.name}|${offer.feat.source}` === value))

	return (
		<label className="feat-asi-card__field">
			<span aria-hidden="true">Feat or ASI</span>
			<select
				className="feat-asi-card__select"
				aria-label={`Level ${grant.level} feat or ASI`}
				aria-describedby={describedBy}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				<option value="" disabled>
					Choose a feat or ASI…
				</option>
				<option value="asi">Ability Score Improvement</option>
				{missingFeat && (
					<option value={value} disabled>
						{value.slice(0, value.lastIndexOf('|'))} · {value.slice(value.lastIndexOf('|') + 1)} (not in data)
					</option>
				)}
				{categories.map((category) => (
					<optgroup key={category} label={featCategoryLabel(category)}>
						{groups.get(category)!.map((offer) => (
							<option key={`${offer.feat.name}|${offer.feat.source}`} value={`${offer.feat.name}|${offer.feat.source}`} disabled={offer.held || !offer.result.eligible}>
								{featOptionLabel(offer)}
							</option>
						))}
					</optgroup>
				))}
			</select>
		</label>
	)
}

/** A half-feat's +1 (task instructions point 4); an ability already at the feat's cap is listed but disabled, like the ASI select. */
function HalfFeatAbilitySelect({
	grantLevel,
	options,
	currentScores,
	cap,
	value,
	onChange,
}: {
	grantLevel: number
	options: Ability[]
	currentScores: Partial<Record<Ability, number>>
	cap: number
	value: Ability | undefined
	onChange: (ability: Ability) => void
}): ReactNode {
	return (
		<label className="feat-asi-picker__feat-ability">
			<span aria-hidden="true">Ability</span>
			<select aria-label={`Level ${grantLevel} ability`} value={value ?? ''} onChange={(event) => onChange(event.target.value as Ability)}>
				<option value="" disabled>
					Choose an ability
				</option>
				{options.map((ability) => {
					const over = exceedsAbilityScoreCap(currentScores, { [ability]: 1 }, cap)
					return (
						<option key={ability} value={ability} disabled={over}>
							{ABILITY_LABEL[ability]}
							{over ? ` (would exceed ${cap})` : ''}
						</option>
					)
				})}
			</select>
		</label>
	)
}

/**
 * D200: two-step pick for a named-block feat (Strixhaven Initiate) — college,
 * then which of that college's cantrip pairs — plus the block's own spellcasting
 * ability. Only the block name is stored; the L1 spell is the ordinary
 * filter-choice pick below, and a college change drops it (another class list).
 */
function NamedBlockSubPicker({
	featName,
	featSource,
	grantLevel,
	blockName,
	chosenAbility,
	onSelectBlock,
	onSelectAbility,
}: {
	featName: string
	featSource: string
	grantLevel: number
	blockName: string | undefined
	chosenAbility: Ability | undefined
	onSelectBlock: (blockName: string | undefined, resetSpells: boolean) => void
	onSelectAbility: (ability: Ability) => void
}): ReactNode {
	const [options, setOptions] = useState<NamedBlockOption[] | null>(null)
	const [pendingGroup, setPendingGroup] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		loadNamedBlockOptions(featName, featSource).then((loaded) => {
			if (!cancelled) setOptions(loaded)
		})
		return () => {
			cancelled = true
		}
	}, [featName, featSource])

	if (!options) return null
	const groups = [...new Set(options.map((option) => option.group))]
	const college = options.find((option) => option.name === blockName)?.group ?? pendingGroup

	return (
		<div className="feat-asi-picker__filter-choice">
			<fieldset>
				<legend>College</legend>
				{groups.map((group) => (
					<label key={group}>
						<input
							type="radio"
							name={`block-college-${grantLevel}`}
							checked={college === group}
							onChange={() => {
								setPendingGroup(group)
								if (blockName !== undefined && college !== group) onSelectBlock(undefined, true)
							}}
						/>
						{group}
					</label>
				))}
			</fieldset>
			{college && (
				<fieldset>
					<legend>{college} cantrips</legend>
					{options
						.filter((option) => option.group === college)
						.map((option) => (
							<label key={option.name}>
								<input type="radio" name={`block-pair-${grantLevel}`} checked={blockName === option.name} onChange={() => onSelectBlock(option.name, false)} />
								{option.cantrips.join(' + ')}
							</label>
						))}
				</fieldset>
			)}
			<label className="feat-asi-picker__feat-ability">
				Spellcasting ability
				<select value={chosenAbility ?? ''} onChange={(event) => onSelectAbility(event.target.value as Ability)}>
					<option value="" disabled>
						Choose an ability
					</option>
					{MAGIC_INITIATE_ABILITY_OPTIONS.map((ability) => (
						<option key={ability} value={ability}>
							{ABILITY_LABEL[ability]}
						</option>
					))}
				</select>
			</label>
		</div>
	)
}

type FilterChoiceLoadState =
	| { status: 'loading' }
	| { status: 'ready'; shape: FilterChoiceFeatShape; cantripCandidates: FilterChoiceCandidateSpell[]; spellCandidates: FilterChoiceCandidateSpell[]; fixedCompanions: FeatGrantedSpell[] }
	| { status: 'error'; message: string }

/**
 * The generic filter-choice feat picker (slice d5b-1 — the LAST feat-spell
 * picker): offers ONLY the spells matching the feat's own filter (class
 * list / school / ritual tag) and level, counts enforced (task instructions'
 * "guided" decision). Any fixed companion spell the feat also grants
 * (Fey-Touched's Misty Step, Wood Elf Magic's Longstrider/Pass without
 * Trace) is shown as already granted, reusing extractFixedFeatSpells rather
 * than a second lookup — both halves of the feat's spells come from the
 * same data path the sheet later reads (featSpells.ts). Unlike
 * MagicInitiateSubPicker, there's no class-list radio choice here — each of
 * these 8 feats' filter is fixed by the feat itself, only the individual
 * spells are the player's choice.
 */
function FilterChoiceSpellSubPicker({
	featName,
	featSource,
	blockName,
	characterLevel,
	chosenAbility,
	alreadyKnown,
	filterChoiceSpells,
	onChange,
}: {
	featName: string
	featSource: string
	blockName: string | undefined
	characterLevel: number
	chosenAbility: Ability | undefined
	alreadyKnown: readonly KnownSpell[]
	filterChoiceSpells: FilterChoiceSpellsChoice | null
	onChange: (value: FilterChoiceSpellsChoice) => void
}): ReactNode {
	const [state, setState] = useState<FilterChoiceLoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([
			loadFilterChoiceFeatShape(featName, featSource, blockName),
			loadFixedFeatSpells(featName, featSource, characterLevel, chosenAbility ? ABILITY_ABBREVIATIONS[chosenAbility] : undefined, blockName),
		])
			.then(([shape, fixedCompanions]) =>
				Promise.all([
					shape.cantripSlot ? loadSlotCandidates(shape.cantripSlot) : Promise.resolve([]),
					shape.spellSlot ? loadSlotCandidates(shape.spellSlot) : Promise.resolve([]),
				]).then(([cantripCandidates, spellCandidates]) => {
					if (cancelled) return
					setState({ status: 'ready', shape, cantripCandidates, spellCandidates, fixedCompanions })
				}),
			)
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [featName, featSource, blockName, characterLevel, chosenAbility])

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load spells: {state.message}</p>
	}

	const { shape, cantripCandidates, spellCandidates, fixedCompanions } = state
	const ownPickerKey = featSpellPickerKey(featName)
	const cantrips = filterChoiceSpells?.cantrips ?? []
	const spells = filterChoiceSpells?.spells ?? []
	const cantripLimit = shape.cantripSlot?.count ?? 0
	const spellLimit = shape.spellSlot ? (shape.spellSlot.count ?? ritualCasterSpellCount(characterLevel)) : 0

	function current(): FilterChoiceSpellsChoice {
		return filterChoiceSpells ?? { cantrips: [], spells: [] }
	}

	function toggleCantrip(candidate: FilterChoiceCandidateSpell): void {
		const value = current()
		const isChosen = value.cantrips.some((c) => c.name === candidate.name && c.source === candidate.source)
		if (isChosen) {
			onChange({ ...value, cantrips: value.cantrips.filter((c) => !(c.name === candidate.name && c.source === candidate.source)) })
			return
		}
		if (value.cantrips.length >= cantripLimit) return
		onChange({ ...value, cantrips: [...value.cantrips, { name: candidate.name, source: candidate.source }] })
	}

	function toggleSpell(candidate: FilterChoiceCandidateSpell): void {
		const value = current()
		const isChosen = value.spells.some((s) => s.name === candidate.name && s.source === candidate.source)
		if (isChosen) {
			onChange({ ...value, spells: value.spells.filter((s) => !(s.name === candidate.name && s.source === candidate.source)) })
			return
		}
		if (value.spells.length >= spellLimit) return
		onChange({ ...value, spells: [...value.spells, { name: candidate.name, source: candidate.source }] })
	}

	return (
		<div className="feat-asi-picker__filter-choice">
			{fixedCompanions.length > 0 && (
				<div className="feat-asi-picker__filter-choice-section">
					<p>Already granted:</p>
					<ul className="feat-asi-picker__magic-initiate-list">
						{fixedCompanions.map((spell) => (
							<li key={`${spell.name}|${spell.source}`}>{spell.name}</li>
						))}
					</ul>
				</div>
			)}

			{shape.cantripSlot && (
				<div className="feat-asi-picker__filter-choice-section">
					<p>
						{cantrips.length} of {cantripLimit} cantrip{cantripLimit === 1 ? '' : 's'} chosen.
					</p>
					<ul className="feat-asi-picker__magic-initiate-list">
						{cantripCandidates.map((candidate) => {
							const checked = cantrips.some((c) => c.name === candidate.name && c.source === candidate.source)
							const atLimit = !checked && cantrips.length >= cantripLimit
							const known = knownSpellReason(alreadyKnown, candidate, ownPickerKey)
							return (
								<li key={`${candidate.name}|${candidate.source}`}>
									<label>
										<input type="checkbox" checked={checked} disabled={!checked && (atLimit || known !== null)} onChange={() => toggleCantrip(candidate)} />
										{candidate.name}
										{known !== null && <span className="feat-asi-picker__already-known"> {knownSpellNote(known)}</span>}
									</label>
								</li>
							)
						})}
					</ul>
				</div>
			)}

			{shape.spellSlot && (
				<div className="feat-asi-picker__filter-choice-section">
					<p>
						{spells.length} of {spellLimit} spell{spellLimit === 1 ? '' : 's'} chosen.
					</p>
					<ul className="feat-asi-picker__magic-initiate-list">
						{spellCandidates.map((candidate) => {
							const checked = spells.some((s) => s.name === candidate.name && s.source === candidate.source)
							const atLimit = !checked && spells.length >= spellLimit
							const known = knownSpellReason(alreadyKnown, candidate, ownPickerKey)
							return (
								<li key={`${candidate.name}|${candidate.source}`}>
									<label>
										<input type="checkbox" checked={checked} disabled={!checked && (atLimit || known !== null)} onChange={() => toggleSpell(candidate)} />
										{candidate.name}
										{known !== null && <span className="feat-asi-picker__already-known"> {knownSpellNote(known)}</span>}
									</label>
								</li>
							)
						})}
					</ul>
				</div>
			)}
		</div>
	)
}
