import { useEffect, useState, type ReactNode } from 'react'
import type { Ability } from '../abilities/abilityScores'
import { ALL_SKILLS } from '../classSkills/classSkillData'
import type { DisabledSkill } from '../classSkills/ClassSkillPicker'
import { subclassSkillSourceNames } from '../classSkills/subclassSkillGrants'
import { firstClass, totalCharacterLevel } from '../calculation/characterLevel'
import { classProficiencyGrants } from '../calculation/classProficiencies'
import { computeProficiencies, extractFeatProficiencyEntries, toolsHeldElsewhere, type ProficiencyItem } from '../calculation/proficiencies'
import { loadDataFile } from '../dataLoader/dataLoader'
import { AsiSubPicker } from '../featAsi/FeatAsiPicker'
import {
	FEAT_CATEGORY_LABELS,
	featAbilityChoiceOptions,
	featCategoryLabel as categoryLabel,
	featOffers,
	featRefKey,
	isValidAbilityIncrease,
	loadClassPrereqInfo,
	loadFeats,
	loadHasFightingStyleFeature,
	loadSpeciesPrereqInfo,
	type FeatEntry,
	type PrerequisiteContext,
	type FeatOffer,
} from '../featAsi/featAsiData'
import { featOriginLabel, type FeatInstance, type FeatInstanceKey, type FeatRef } from '../featAsi/featInstances'
import { FeatSubChoicePicker, magicInitiateListsOf, type FeatChoiceHeld } from '../featAsi/FeatSubChoicePicker'
import { ResolvedEntries, type ResolverData } from '../featureResolver'
import { isFilterChoiceFeat, isNamedBlockFeat } from '../spells/featSpellChoiceData'
import type { KnownSpell } from '../spells/knownSpells'
import { choiceNames, type AbilityIncreaseMap, type Character, type FeatChoiceDetails } from '../storage/character'
import { findPicked } from '../storage/choiceMatch'
import { DrawerSection } from './Drawer'
import type { FeatureTabRow } from './featuresTabData'
import type { FeatTextEntry } from './sheetData'

const CATEGORY_ORDER = Object.keys(FEAT_CATEGORY_LABELS)

const titleCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** The current ability scores minus one ASI level's own increases — AsiSubPicker's cap check needs the scores WITHOUT that level's contribution. */
function withoutIncreases(scores: Partial<Record<Ability, number>>, increases: AbilityIncreaseMap): Partial<Record<Ability, number>> {
	const next = { ...scores }
	for (const [ability, amount] of Object.entries(increases)) {
		if (amount) next[ability as Ability] = (next[ability as Ability] ?? 0) - amount
	}
	return next
}

function asiIncreasesSummary(increases: AbilityIncreaseMap): string {
	const chosen = Object.entries(increases).filter(([, amount]) => amount)
	return chosen.length > 0 ? chosen.map(([ability, amount]) => `${titleCase(ability)} +${amount}`).join(', ') : 'No increases chosen yet.'
}

/** Only the sub-choice fields (featInstances.ts's own choiceDetails, not exported) — never the instance's key/origin/name/source/level, which setFeatChoiceDetails would otherwise store as stray fields. */
function choiceDetailsOf(instance: FeatInstance): FeatChoiceDetails {
	return {
		...(instance.chosenAbility !== undefined ? { chosenAbility: instance.chosenAbility } : {}),
		...(instance.magicInitiate !== undefined ? { magicInitiate: instance.magicInitiate } : {}),
		...(instance.filterChoiceSpells !== undefined ? { filterChoiceSpells: instance.filterChoiceSpells } : {}),
		...(instance.blockName !== undefined ? { blockName: instance.blockName } : {}),
		...(instance.proficiencies !== undefined ? { proficiencies: instance.proficiencies } : {}),
	}
}

type Loaded = {
	feats: FeatEntry[]
	ctx: Omit<PrerequisiteContext, 'characterLevel' | 'abilityScores' | 'chosenFeats'>
	/** The first class whose Fighting Style feature the character has reached — the "From <Class>" of the class pick. */
	fightingStyleClass: string | null
	/** D160, via computeProficiencies — what heldForFeat needs for tools/languages. */
	rawClasses: unknown
	featProficiencyEntries: ReturnType<typeof extractFeatProficiencyEntries>
}

/** D321: the same class proficiencies the Proficiencies card shows. */
export function prerequisiteClassProficiencies(character: Pick<Character, 'classes' | 'levelOrder'>, rawClasses: unknown): { armorProficiencies: string[]; weaponProficiencies: string[] } {
	const classGrants = classProficiencyGrants(character, rawClasses)
	return {
		armorProficiencies: [...new Set(classGrants.armor.map(({ token }) => token))],
		weaponProficiencies: [
			...new Set(classGrants.weapons.flatMap(({ grant }) => (grant.kind === 'category' && !grant.anyOfProperties && !grant.ranged && !grant.melee ? [grant.category] : []))),
		],
	}
}

/** Same subclass rule as the sheet's tool slots (M2): the first class, not classes[0]. */
export function heldToolsOf(character: Pick<Character, 'classes' | 'levelOrder'>, tools: readonly ProficiencyItem[]): string[] {
	return toolsHeldElsewhere(tools, firstClass(character)?.subclass ?? null)
}

async function loadPanelData(character: Character): Promise<Loaded> {
	const species = character.species
	const [feats, classInfo, speciesInfo, rawClasses, rawFeats] = await Promise.all([
		loadFeats(),
		Promise.all(
			character.classes.map(async (c) => ({
				className: c.className,
				info: await loadClassPrereqInfo(c.className, c.classSource),
				fightingStyle: await loadHasFightingStyleFeature(c.className, c.classSource, c.level),
			})),
		),
		species ? loadSpeciesPrereqInfo(species.name, species.source) : Promise.resolve(null),
		loadDataFile('data/classes.json'),
		loadDataFile('data/feats.json'),
	])
	return {
		feats,
		fightingStyleClass: classInfo.find((c) => c.fightingStyle)?.className ?? null,
		rawClasses,
		featProficiencyEntries: extractFeatProficiencyEntries(rawFeats),
		ctx: {
			hasFightingStyleFeature: classInfo.some((c) => c.fightingStyle),
			hasSpellcasting: classInfo.some((c) => c.info?.hasSpellcasting),
			...prerequisiteClassProficiencies(character, rawClasses),
			speciesName: species?.name ?? null,
			speciesRaceTags: speciesInfo?.raceTags ?? [],
			speciesSize: speciesInfo?.size ?? character.speciesSize ?? null,
		},
	}
}

/** Every feat Add Feats may list, with its prerequisite result. A held non-repeatable feat is left out (D255: by name, any book); every held feat counts as chosen (manual ones included). */
export function addableFeatOffers(feats: readonly FeatEntry[], held: readonly FeatRef[], ctx: Omit<PrerequisiteContext, 'chosenFeats'>): FeatOffer[] {
	return featOffers(feats, held, ctx).filter((offer) => !offer.held)
}

/** One row laid out like a Manage Spells row; ▸ opens its text. D116: which rows are open is panel state only. */
function FeatRow({ name, meta, note, chip, action, children }: { name: string; meta?: string; note?: string; chip?: string; action?: ReactNode; children: ReactNode }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="manage-spells__row">
			<div className="manage-spells__line">
				<span className="manage-spells__name-cell">
					<span className="manage-spells__name">{name}</span>
					{meta && <> <span className="manage-spells__meta">{meta}</span></>}
					{note && <span className="manage-spells__meta manage-spells__note">{note}</span>}
				</span>
				{chip && <span className="manage-spells__tag">{chip}</span>}
				{action}
				<button type="button" className="manage-spells__expand" aria-expanded={open} aria-label={`${name} text`} onClick={() => setOpen(!open)}>
					{open ? '▾' : '▸'}
				</button>
			</div>
			{open && <div className="manage-spells__text">{children}</div>}
		</li>
	)
}

function FeatText({ entries, name, resolverData }: { entries: unknown[] | null | undefined; name: string; resolverData: ResolverData }): ReactNode {
	return entries ? <ResolvedEntries entries={entries} data={resolverData} /> : <p>No text found for “{name}”.</p>
}

/**
 * Wraps AsiSubPicker with a local draft: the schema has no "empty" or
 * half-chosen state for a stored 'asi' choice (setAsiIncreases refuses one),
 * so switching mode or filling only one of two slots stays local and is
 * written only once the shape is complete — same principle as the wizard
 * never persisting until Save, just scoped to this one row.
 */
function AsiRow({
	level,
	increases,
	abilityScores,
	onEdit,
}: {
	level: number
	increases: AbilityIncreaseMap
	abilityScores: Partial<Record<Ability, number>>
	onEdit?: (level: number, increases: AbilityIncreaseMap) => void
}): ReactNode {
	const [draft, setDraft] = useState(increases)
	useEffect(() => setDraft(increases), [increases])

	if (!onEdit) return <p>{asiIncreasesSummary(increases)}</p>
	const edit = onEdit

	function handleChange(next: AbilityIncreaseMap): void {
		setDraft(next)
		if (isValidAbilityIncrease(next)) edit(level, next)
	}

	return <AsiSubPicker grantLevel={level} increases={draft} currentScores={withoutIncreases(abilityScores, increases)} onChange={handleChange} />
}

/**
 * The Manage Feats drawer (R13a, D215): every feat the character holds, and feats
 * the DM grants, added and removed one at a time. Level and background feats are
 * locked here; changing them stays in Edit Character.
 */
export function ManageFeatsPanel({
	character,
	instances,
	alreadyKnown = [],
	featRows,
	featTexts,
	abilityScores,
	resolverData,
	onAdd,
	onRemove,
	onEditFeatChoice,
	onEditAsiIncreases,
}: {
	character: Character
	/** featInstances — manual feats included. */
	instances: readonly FeatInstance[]
	/** The sheet's collectKnownSpells result, so Magic Initiate does not offer a spell the character already has (D280). */
	alreadyKnown?: readonly KnownSpell[]
	/** The Features & Traits feat rows, keyed `feat|<instance key>`: text, stored sub-choices, pending ones. */
	featRows: readonly FeatureTabRow[]
	featTexts: readonly FeatTextEntry[]
	abilityScores: Partial<Record<Ability, number>>
	resolverData: ResolverData
	onAdd: (feat: FeatRef) => void
	onRemove: (key: string) => void
	/** Replaces one feat instance's sub-choices (R13b, D215). Absent leaves My Feats' ▸ read-only. */
	onEditFeatChoice?: (key: FeatInstanceKey, feat: FeatRef, details: FeatChoiceDetails) => void
	/** Replaces one ASI level's ability increases (R13b, D215). Absent leaves the Ability Score Improvement row read-only. */
	onEditAsiIncreases?: (level: number, increases: AbilityIncreaseMap) => void
}): ReactNode {
	const [loaded, setLoaded] = useState<Loaded | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	/* D116: search and category never reach the character. */
	const [search, setSearch] = useState('')
	const [category, setCategory] = useState<string | null>(null)

	const classKey = character.classes.map((c) => `${c.className}|${c.classSource}|${c.level}`).join(';')
	useEffect(() => {
		let cancelled = false
		loadPanelData(character)
			.then((data) => {
				if (!cancelled) setLoaded(data)
			})
			.catch((error: unknown) => {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error))
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what the prerequisite lookups read, not on every write to the character.
	}, [classKey, character.species?.name, character.species?.source, character.speciesSize])

	const textOf = (feat: FeatRef) => featTexts.find((text) => text.name === feat.name && text.source === feat.source)?.entries
	const rowOf = (instance: FeatInstance) => featRows.find((row) => row.key === `feat|${instance.key}`)

	const styleFeats = loaded ? loaded.feats.filter((feat) => feat.category === 'FS') : []
	const fightingStyles = (character.fightingStyles ?? []).flatMap((style) => {
		const feat = findPicked(styleFeats, style)
		return feat ? [{ style, feat }] : []
	})
	const held: FeatRef[] = [...instances, ...fightingStyles.map(({ feat }) => feat)]

	/** D160: what the character has apart from the feat at `key` — same shape FeatAsiPicker's heldForFeat builds for the wizard, but read straight off the saved character instead of wizard draft state. */
	function heldForFeat(key: FeatInstanceKey): FeatChoiceHeld {
		const others = instances.filter((instance) => instance.key !== key)
		const heldSkills: DisabledSkill[] = [
			...(character.classSkills ?? []).map((skill) => ({ skill, source: 'class' })),
			...(character.speciesSkills ?? []).map((skill) => ({ skill, source: 'species' })),
			...(character.background?.skillProficiencies ?? []).map((skill) => ({ skill, source: 'background' })),
			...(character.subclassSkills ?? []).map((entry) => ({ skill: entry.name, source: entry.grantedBy })),
			...ALL_SKILLS.flatMap((skill) => subclassSkillSourceNames(skill, character).map((source) => ({ skill, source }))),
			...others.flatMap((instance) => (instance.proficiencies?.skills ?? []).map((skill) => ({ skill, source: instance.name }))),
		]
		const heldExpertise = [...choiceNames(character.expertiseSkills), ...others.flatMap((instance) => instance.proficiencies?.expertise ?? [])]
		const proficiencies = loaded ? computeProficiencies(character, loaded.rawClasses, others, loaded.featProficiencyEntries) : null
		return {
			heldSkills,
			heldExpertise,
			heldTools: proficiencies ? heldToolsOf(character, proficiencies.tools) : [],
			knownLanguages: proficiencies ? proficiencies.languages.filter((item) => !item.pending).map((item) => item.label) : [],
			magicInitiateLists: magicInitiateListsOf(others),
		}
	}

	function instanceRow(instance: FeatInstance): ReactNode {
		const row = rowOf(instance)
		const chip =
			instance.origin === 'background'
				? 'From Background'
				: instance.origin === 'species'
					? 'From Species'
					: instance.origin === 'asi'
						? `From level ${instance.level}`
						: instance.origin === 'item'
							? featOriginLabel(instance)
							: undefined
		/* R13b (D215): everything FeatSubChoicePicker covers is editable here, including on a locked (level/background/species, D275) feat — Strixhaven Initiate and the 8 filter-choice feats aren't, and stay read-only. */
		const editable = !isNamedBlockFeat(instance) && !isFilterChoiceFeat(instance)
		const entry = loaded?.feats.find((feat) => feat.name === instance.name && feat.source === instance.source)
		/* A half-feat's plain ability choice — FeatSubChoicePicker doesn't render it (that select lives in FeatAsiPicker's own FeatSubPicker, alongside choosing the feat itself); Magic Initiate/spellcasting-ability feats never have this field set, so there's no double select (featSpellcastingAbilityOptions). */
		const abilityOptions = editable && entry ? featAbilityChoiceOptions(entry) : null
		return (
			<FeatRow
				key={instance.key}
				name={instance.name}
				chip={chip}
				action={
					instance.origin === 'manual' && (
						<button type="button" className="manage-spells__button" aria-label={`Remove ${instance.name}`} onClick={() => onRemove(instance.key)}>
							Remove
						</button>
					)
				}
			>
				<FeatText entries={row?.entries} name={instance.name} resolverData={resolverData} />
				{editable && onEditFeatChoice ? (
					<>
						{abilityOptions && (
							<label className="feat-asi-picker__feat-ability">
								Ability
								<select
									value={instance.chosenAbility ?? ''}
									onChange={(event) =>
										onEditFeatChoice(instance.key, { name: instance.name, source: instance.source }, { ...choiceDetailsOf(instance), chosenAbility: event.target.value as Ability })
									}
								>
									<option value="" disabled>
										Choose an ability
									</option>
									{abilityOptions.map((ability) => (
										<option key={ability} value={ability}>
											{titleCase(ability)}
										</option>
									))}
								</select>
							</label>
						)}
						<FeatSubChoicePicker
							feat={{ name: instance.name, source: instance.source }}
							value={choiceDetailsOf(instance)}
							onChange={(details) => onEditFeatChoice(instance.key, { name: instance.name, source: instance.source }, details)}
							held={heldForFeat(instance.key)}
							alreadyKnown={alreadyKnown}
							idPrefix={`manage-feats-${instance.key}`}
						/>
					</>
				) : (
					row &&
					(row.options.length > 0 || row.pending) && (
						<ul className="sheet__feature-options">
							{row.options.map((option) => (
								<li key={option.key}>{option.name}</li>
							))}
							{row.pending && <li className="sheet__feat-pending">Choices not made yet: {row.pending.join(', ')}.</li>}
						</ul>
					)
				)}
			</FeatRow>
		)
	}

	const byKey = new Map(instances.map((instance) => [instance.key, instance]))
	const levelRows = [...(character.featAsiChoices ?? [])]
		.sort((a, b) => a.level - b.level)
		.map((choice) => {
			if (choice.kind === 'feat') {
				const instance = byKey.get(`asi:${choice.level}`)
				return instance && instanceRow(instance)
			}
			return (
				<FeatRow key={`asi:${choice.level}`} name="Ability Score Improvement" chip={`From level ${choice.level}`}>
					<AsiRow level={choice.level} increases={choice.increases} abilityScores={abilityScores} onEdit={onEditAsiIncreases} />
				</FeatRow>
			)
		})

	const myFeats = [
		...instances.filter((instance) => instance.origin === 'background' || instance.origin === 'species').map(instanceRow),
		...levelRows,
		...(loaded?.fightingStyleClass
			? fightingStyles.map(({ style, feat }) => (
					<FeatRow key={`fighting-style|${style.className ?? ''}|${style.classSource ?? ''}`} name={feat.name} chip={`From ${style.className ?? loaded.fightingStyleClass}`}>
						<FeatText entries={textOf(feat)} name={feat.name} resolverData={resolverData} />
					</FeatRow>
				))
			: []),
		...instances.filter((instance) => instance.origin === 'manual').map(instanceRow),
		...instances.filter((instance) => instance.origin === 'item').map(instanceRow),
	]

	let offered: FeatOffer[] = []
	let categories: string[] = []
	if (loaded) {
		offered = addableFeatOffers(loaded.feats, held, { ...loaded.ctx, characterLevel: totalCharacterLevel(character.classes), abilityScores })
		const present = new Set(loaded.feats.map((feat) => feat.category))
		categories = [...CATEGORY_ORDER.filter((code) => present.has(code)), ...[...present].filter((code) => !CATEGORY_ORDER.includes(code)).sort()]
	}
	const needle = search.trim().toLowerCase()
	const shown = offered
		.filter(({ feat }) => feat.name.toLowerCase().includes(needle) && (category === null || feat.category === category))
		.sort((a, b) => a.feat.name.localeCompare(b.feat.name))
	const available = shown.filter(({ result }) => result.eligible)
	const unavailable = shown.filter(({ result }) => !result.eligible)

	return (
		<>
			<DrawerSection title="My Feats">
				<section aria-label="My Feats" className="manage-spells__list">
					{myFeats.length === 0 && <p className="manage-spells__empty">No feats yet.</p>}
					<ul>{myFeats}</ul>
				</section>
			</DrawerSection>

			<DrawerSection title="Add Feats">
				<section aria-label="Add Feats" className="manage-spells__list">
					<input type="search" className="sheet__spells-search manage-spells__search" aria-label="Search feats" placeholder="Search feats" value={search} onChange={(event) => setSearch(event.target.value)} />
					<div className="sheet__actions-filters manage-spells__pills" role="group" aria-label="Filter by category">
						{[null, ...categories].map((code) => (
							<button key={code ?? 'all'} type="button" className={category === code ? 'pill pill--active' : 'pill'} aria-pressed={category === code} onClick={() => setCategory(code)}>
								{code === null ? 'All' : categoryLabel(code)}
							</button>
						))}
					</div>
					{loadError && <p className="error">Could not load feats: {loadError}</p>}
					{!loaded && !loadError && <p className="manage-spells__empty">Loading feats…</p>}
					{loaded && available.length === 0 && <p className="manage-spells__empty">No feats match.</p>}
					<ul>
						{available.map(({ feat }) => (
							<FeatRow
								key={featRefKey(feat)}
								name={feat.name}
								meta={categoryLabel(feat.category)}
								action={
									<button type="button" className="manage-spells__button" aria-label={`Add ${feat.name}`} onClick={() => onAdd({ name: feat.name, source: feat.source })}>
										Add
									</button>
								}
							>
								<FeatText entries={textOf(feat)} name={feat.name} resolverData={resolverData} />
							</FeatRow>
						))}
					</ul>
				</section>
			</DrawerSection>

			<DrawerSection title="Unavailable — prerequisites not met" open={false}>
				<section aria-label="Unavailable" className="manage-spells__list">
					{loaded && unavailable.length === 0 && <p className="manage-spells__empty">No feats match.</p>}
					<ul>
						{unavailable.map(({ feat, result }) => (
							<FeatRow key={featRefKey(feat)} name={feat.name} meta={categoryLabel(feat.category)} note={result.reasons.join(' ')}>
								<FeatText entries={textOf(feat)} name={feat.name} resolverData={resolverData} />
							</FeatRow>
						))}
					</ul>
				</section>
			</DrawerSection>
		</>
	)
}
