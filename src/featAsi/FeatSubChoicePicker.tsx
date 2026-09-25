import { useEffect, useState, type ReactNode } from 'react'
import type { Ability } from '../abilities/abilityScores'
import { ALL_SKILLS } from '../classSkills/classSkillData'
import type { DisabledSkill } from '../classSkills/ClassSkillPicker'
import { featureLanguageOptions } from '../languages/classFeatureLanguages'
import { loadClassSpellList, type ClassSpellListSpell } from '../spells/classSpellListData'
import { featSpellPickerKey, knownSpellNote, knownSpellReason, type KnownSpell } from '../spells/knownSpells'
import type { FeatChoiceDetails, FeatChoiceProficiencies, MagicInitiateChoice } from '../storage/character'
import { toolChoiceOptions } from '../toolProficiencies/classToolChoices'
import {
	isMagicInitiateFamily,
	loadFeatProficiencyChoice,
	magicInitiateFixedClass,
	MAGIC_INITIATE_ABILITY_OPTIONS,
	MAGIC_INITIATE_CLASS_OPTIONS,
	type FeatProficiencyChoice,
} from './featAsiData'

export const LATER_CHOICE_NOTE = 'You can make this choice later in Edit Character.'

const ABILITY_LABEL: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

/** What the character has from everywhere except the feat being edited (D160). */
export interface FeatChoiceHeld {
	heldSkills: DisabledSkill[]
	heldExpertise: string[]
	heldTools: string[]
	knownLanguages: string[]
}

const NOTHING_HELD: FeatChoiceHeld = { heldSkills: [], heldExpertise: [], heldTools: [], knownLanguages: [] }

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Slot `index` set to `pick` (or emptied); the list stays gap-free. */
function setAt<T>(list: readonly T[], index: number, pick: T | null): T[] {
	const next: (T | null)[] = [...list]
	next[index] = pick
	return next.filter((entry): entry is T => entry !== null && entry !== undefined)
}

type LoadState = { key: string; choice: FeatProficiencyChoice | null } | { key: string; error: string } | null

/**
 * A feat's own sub-choices (task A3): Magic Initiate's spells and ability, and
 * the skill / tool / language / expertise picks of the 10 feats that offer one.
 * D8: edits `value` through `onChange`, holds no store; shared by the wizard's
 * ASI and background steps and, later, Manage Feats (D179).
 */
export function FeatSubChoicePicker({
	feat,
	value,
	onChange,
	held = NOTHING_HELD,
	alreadyKnown = [],
	magicInitiateRequired = false,
	laterNote = false,
	legend,
	idPrefix,
}: {
	feat: { name: string; source: string }
	value: FeatChoiceDetails
	onChange: (details: FeatChoiceDetails) => void
	held?: FeatChoiceHeld
	alreadyKnown?: readonly KnownSpell[]
	/** The ASI step still requires base Magic Initiate's spells; everything else may wait (D179). */
	magicInitiateRequired?: boolean
	/** D179: tell the player the choice can wait for Edit Character. */
	laterNote?: boolean
	legend?: string
	idPrefix: string
}): ReactNode {
	const key = `${feat.name}|${feat.source}`
	const [loaded, setLoaded] = useState<LoadState>(null)

	useEffect(() => {
		let cancelled = false
		loadFeatProficiencyChoice(feat.name, feat.source)
			.then((choice) => {
				if (!cancelled) setLoaded({ key: `${feat.name}|${feat.source}`, choice })
			})
			.catch((error: unknown) => {
				if (!cancelled) setLoaded({ key: `${feat.name}|${feat.source}`, error: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [feat.name, feat.source])

	const current = loaded?.key === key ? loaded : null
	const loadError = current && 'error' in current ? current.error : null
	const choice = current && 'choice' in current ? current.choice : null
	const shape = choice?.shape
	const hasProficiencyChoice = !!shape && (shape.skills !== null || shape.tools !== null || shape.skillsOrTools > 0 || shape.languages > 0 || shape.expertise > 0)
	const magicInitiate = isMagicInitiateFamily(feat)
	if (!magicInitiate && !hasProficiencyChoice && loadError === null) return null

	const showNote = laterNote && (hasProficiencyChoice || (magicInitiate && !magicInitiateRequired))

	return (
		<fieldset className="feat-sub-choices">
			{legend && <legend>{legend}</legend>}
			{showNote && <p className="feat-sub-choices__later">{LATER_CHOICE_NOTE}</p>}
			{magicInitiate && (
				<MagicInitiateSubPicker
					fixedClass={magicInitiateFixedClass(feat)}
					magicInitiate={value.magicInitiate ?? null}
					chosenAbility={value.chosenAbility}
					alreadyKnown={alreadyKnown}
					ownPickerKey={featSpellPickerKey(feat.name)}
					radioName={`${idPrefix}-magic-initiate-class`}
					onChangeMagicInitiate={(magicInitiate) => onChange({ ...value, magicInitiate })}
					onSelectAbility={(chosenAbility) => onChange({ ...value, chosenAbility })}
				/>
			)}
			{loadError !== null && <p className="error">Could not load this feat&rsquo;s choices: {loadError}</p>}
			{choice && hasProficiencyChoice && <ProficiencySlots featName={feat.name} choice={choice} value={value} onChange={onChange} held={held} />}
		</fieldset>
	)
}

function ProficiencySlots({
	featName,
	choice,
	value,
	onChange,
	held,
}: {
	featName: string
	choice: FeatProficiencyChoice
	value: FeatChoiceDetails
	onChange: (details: FeatChoiceDetails) => void
	held: FeatChoiceHeld
}): ReactNode {
	const { shape, toolOptions, languages } = choice
	const picks = value.proficiencies ?? {}
	const skills = picks.skills ?? []
	const tools = picks.tools ?? []
	const chosenLanguages = picks.languages ?? []
	const expertise = picks.expertise ?? []
	const heldSkill = (skill: string) => held.heldSkills.find((entry) => entry.skill.toLowerCase() === skill)
	const takenTools = (own: string | undefined) => new Set([...held.heldTools, ...tools.filter((tool) => tool !== own)].map((tool) => tool.toLowerCase()))

	function update(next: FeatChoiceProficiencies): void {
		// D159: expertise may sit on this feat's own skill, but not on one it no longer grants.
		const proficient = new Set([...held.heldSkills.map((entry) => entry.skill.toLowerCase()), ...shape.fixedSkills, ...(next.skills ?? [])])
		const kept: FeatChoiceProficiencies = {
			...(next.skills?.length ? { skills: next.skills } : {}),
			...(next.tools?.length ? { tools: next.tools } : {}),
			...(next.languages?.length ? { languages: next.languages } : {}),
			...(next.expertise?.filter((skill) => proficient.has(skill)).length ? { expertise: next.expertise.filter((skill) => proficient.has(skill)) } : {}),
		}
		const { proficiencies: _dropped, ...rest } = value
		onChange(Object.keys(kept).length > 0 ? { ...rest, proficiencies: kept } : rest)
	}

	function skillOptions(from: readonly string[], own: string | undefined): ReactNode {
		return from.map((skill) => {
			const source = heldSkill(skill)
			return (
				<option key={skill} value={skill} disabled={skill !== own && (source !== undefined || skills.includes(skill))}>
					{capitalize(skill)}
					{source ? ` (from ${source.source})` : ''}
				</option>
			)
		})
	}

	const slot = (label: string, count: number, index: number) => `${featName} ${label}${count > 1 ? ` ${index + 1}` : ''}`
	const range = (count: number) => Array.from({ length: count }, (_, index) => index)

	const mixed = [...skills.map((skill) => `skill:${skill}`), ...tools.map((tool) => `tool:${tool}`)]
	const heldExpertise = held.heldExpertise.map((skill) => skill.toLowerCase())
	const expertisePool = ALL_SKILLS.filter(
		(skill) => (heldSkill(skill) !== undefined || shape.fixedSkills.includes(skill) || skills.includes(skill)) && !heldExpertise.includes(skill),
	)

	return (
		<ul className="feat-sub-choices__slots">
			{shape.skills &&
				range(shape.skills.count).map((index) => (
					<li key={`skill-${index}`}>
						<select aria-label={slot('skill', shape.skills!.count, index)} value={skills[index] ?? ''} onChange={(event) => update({ ...picks, skills: setAt(skills, index, event.target.value || null) })}>
							<option value="">— skill not chosen —</option>
							{skillOptions(shape.skills!.from, skills[index])}
						</select>
					</li>
				))}
			{shape.tools &&
				range(shape.tools.count).map((index) => (
					<li key={`tool-${index}`}>
						<select aria-label={slot('tool', shape.tools!.count, index)} value={tools[index] ?? ''} onChange={(event) => update({ ...picks, tools: setAt(tools, index, event.target.value || null) })}>
							<option value="">— tool not chosen —</option>
							{toolChoiceOptions(toolOptions, takenTools(tools[index]), tools[index]).map((tool) => (
								<option key={tool} value={tool}>
									{tool}
								</option>
							))}
						</select>
					</li>
				))}
			{range(shape.skillsOrTools).map((index) => {
				const own = mixed[index]
				const choose = (key: string): void => {
					const next = setAt(mixed, index, key || null)
					update({ ...picks, skills: next.filter((k) => k.startsWith('skill:')).map((k) => k.slice(6)), tools: next.filter((k) => k.startsWith('tool:')).map((k) => k.slice(5)) })
				}
				return (
					<li key={`mixed-${index}`}>
						<select aria-label={slot('skill or tool', shape.skillsOrTools, index)} value={own ?? ''} onChange={(event) => choose(event.target.value)}>
							<option value="">— skill or tool not chosen —</option>
							<optgroup label="Skill">
								{ALL_SKILLS.map((skill) => {
									const source = heldSkill(skill)
									return (
										<option key={skill} value={`skill:${skill}`} disabled={own !== `skill:${skill}` && (source !== undefined || skills.includes(skill))}>
											{capitalize(skill)}
											{source ? ` (from ${source.source})` : ''}
										</option>
									)
								})}
							</optgroup>
							<optgroup label="Tool">
								{toolChoiceOptions(toolOptions, takenTools(own?.slice(5)), own?.startsWith('tool:') ? own.slice(5) : undefined).map((tool) => (
									<option key={tool} value={`tool:${tool}`}>
										{tool}
									</option>
								))}
							</optgroup>
						</select>
					</li>
				)
			})}
			{range(shape.languages).map((index) => {
				const own = chosenLanguages[index]
				const taken = new Set([...held.knownLanguages, ...chosenLanguages.filter((language) => language !== own).map((language) => language.name)].map((name) => name.toLowerCase()))
				return (
					<li key={`language-${index}`}>
						<select
							aria-label={slot('language', shape.languages, index)}
							value={own ? `${own.name}|${own.source}` : ''}
							onChange={(event) => {
								const entry = languages.find((language) => `${language.name}|${language.source}` === event.target.value)
								update({ ...picks, languages: setAt(chosenLanguages, index, entry ? { name: entry.name, source: entry.source } : null) })
							}}
						>
							<option value="">— language not chosen —</option>
							{featureLanguageOptions(languages, taken, own?.name).map((language) => (
								<option key={`${language.name}|${language.source}`} value={`${language.name}|${language.source}`}>
									{language.name}
								</option>
							))}
						</select>
					</li>
				)
			})}
			{range(shape.expertise).map((index) => (
				<li key={`expertise-${index}`}>
					<select aria-label={slot('expertise', shape.expertise, index)} value={expertise[index] ?? ''} onChange={(event) => update({ ...picks, expertise: setAt(expertise, index, event.target.value || null) })}>
						<option value="">— expertise not chosen —</option>
						{expertisePool.map((skill) => (
							<option key={skill} value={skill} disabled={skill !== expertise[index] && expertise.includes(skill)}>
								{capitalize(skill)}
							</option>
						))}
					</select>
				</li>
			))}
		</ul>
	)
}

type MagicInitiateLoadState =
	| { status: 'loading' }
	| { status: 'ready'; spells: ClassSpellListSpell[] }
	| { status: 'error'; message: string }

/**
 * Magic Initiate's own picker (slice d5b-2): choose ONE class list, then
 * exactly 2 cantrips + 1 level-1 spell from that same list — the SpellPicker/
 * slice d2 pattern, reused here with the feat's own fixed counts instead of
 * spell-slot-derived ones. Guided (task instructions): only the chosen
 * class's cantrips/level-1 spells are ever offered. The ability choice reuses
 * the shared `chosenAbility` slot on the feat entry (D57), just with its own
 * narrower int/wis/cha option set (MAGIC_INITIATE_ABILITY_OPTIONS) rather
 * than the half-feat ABILITIES list, since it lives in `additionalSpells`,
 * not the half-feat `ability` field featAbilityChoiceOptions reads.
 */
function MagicInitiateSubPicker({
	fixedClass,
	magicInitiate: stored,
	chosenAbility,
	alreadyKnown,
	ownPickerKey,
	radioName,
	onChangeMagicInitiate,
	onSelectAbility,
}: {
	/** A background's "Magic Initiate; <Class>" names its list; base Magic Initiate leaves it to the player. */
	fixedClass: { className: string; classSource: string } | null
	magicInitiate: MagicInitiateChoice | null
	chosenAbility: Ability | undefined
	alreadyKnown: readonly KnownSpell[]
	ownPickerKey: string
	radioName: string
	onChangeMagicInitiate: (value: MagicInitiateChoice) => void
	onSelectAbility: (ability: Ability) => void
}): ReactNode {
	const [state, setState] = useState<MagicInitiateLoadState>({ status: 'loading' })
	const magicInitiate = stored ?? (fixedClass ? { ...fixedClass, cantrips: [], spell: null } : null)
	const className = magicInitiate?.className ?? null
	const classSource = magicInitiate?.classSource ?? null

	useEffect(() => {
		if (!className || !classSource) return
		let cancelled = false
		setState({ status: 'loading' })
		loadClassSpellList(className, classSource)
			.then((spells) => {
				if (!cancelled) setState({ status: 'ready', spells })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [className, classSource])

	function selectClass(option: { className: string; classSource: string }): void {
		// A new class list clears any picks made against the previous one — they're not valid against this list.
		onChangeMagicInitiate({ className: option.className, classSource: option.classSource, cantrips: [], spell: null })
	}

	const cantrips = magicInitiate?.cantrips ?? []
	const chosenSpell = magicInitiate?.spell ?? null

	function toggleCantrip(candidate: ClassSpellListSpell): void {
		if (!magicInitiate) return
		const isChosen = cantrips.some((c) => c.name === candidate.name && c.source === candidate.source)
		if (isChosen) {
			onChangeMagicInitiate({
				...magicInitiate,
				cantrips: cantrips.filter((c) => !(c.name === candidate.name && c.source === candidate.source)),
			})
			return
		}
		if (cantrips.length >= 2) return
		onChangeMagicInitiate({ ...magicInitiate, cantrips: [...cantrips, { name: candidate.name, source: candidate.source }] })
	}

	function toggleSpell(candidate: ClassSpellListSpell): void {
		if (!magicInitiate) return
		const isChosen = chosenSpell !== null && chosenSpell.name === candidate.name && chosenSpell.source === candidate.source
		onChangeMagicInitiate({ ...magicInitiate, spell: isChosen ? null : { name: candidate.name, source: candidate.source } })
	}

	return (
		<div className="feat-asi-picker__magic-initiate">
			{!fixedClass && (
				<fieldset>
					<legend>Class list</legend>
					{MAGIC_INITIATE_CLASS_OPTIONS.map((option) => (
						<label key={option.className}>
							<input type="radio" name={radioName} checked={className === option.className} onChange={() => selectClass(option)} />
							{option.className}
						</label>
					))}
				</fieldset>
			)}

			{magicInitiate && state.status === 'ready' && (
				<>
					<div className="feat-asi-picker__magic-initiate-section">
						<p>{cantrips.length} of 2 cantrips chosen.</p>
						<ul className="feat-asi-picker__magic-initiate-list">
							{state.spells
								.filter((candidate) => candidate.level === 0)
								.map((candidate) => {
									const checked = cantrips.some((c) => c.name === candidate.name && c.source === candidate.source)
									const atLimit = !checked && cantrips.length >= 2
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

					<div className="feat-asi-picker__magic-initiate-section">
						<p>{chosenSpell ? 1 : 0} of 1 level-1 spell chosen.</p>
						<ul className="feat-asi-picker__magic-initiate-list">
							{state.spells
								.filter((candidate) => candidate.level === 1)
								.map((candidate) => {
									const checked = chosenSpell !== null && chosenSpell.name === candidate.name && chosenSpell.source === candidate.source
									const atLimit = !checked && chosenSpell !== null
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
				</>
			)}

			{magicInitiate && state.status === 'error' && <p className="error">Could not load spells: {state.message}</p>}

			<label className="feat-asi-picker__feat-ability">
				Ability
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
