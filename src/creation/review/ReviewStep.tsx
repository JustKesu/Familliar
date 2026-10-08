import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../../abilities/abilityScores'
import { AbilityScoreTable } from '../../abilities/AbilityScoreTable'
import { ABILITY_ABBREVIATIONS } from '../../calculation/abilityAbbreviations'
import type { FeatEffectEntry } from '../../calculation/featEffects'
import { featOriginLabel, type FeatInstance } from '../../featAsi/featInstances'
import { ResolvedEntries } from '../../featureResolver/ResolvedEntries'
import type { ResolverData } from '../../featureResolver'
import { StartingTable } from '../../inventory/StartingTable'
import type { LevelGains } from '../../levelUp/levelGains'
import { loadFeatEffectEntries } from '../../sheet/sheetData'
import { loadGrantedClassFeatures } from '../../sheet/grantedClassFeatures'
import { UnresolvedValue } from '../../sheet/ValueBreakdown'
import type { AbilityIncreaseMap, Character, CharacterInventoryItem, FeatAsiChoice } from '../../storage/character'
import type { UnfinishedClass, WizardData, WizardStep } from '../wizardState'

/** W-9 (D295–D300): the Review step — a portrait header, then one card per part of the character. Display only; every value is computed by CharacterWizard. */
export interface ReviewProficiencies {
	skills: string[]
	expertise: string[]
	armor: string[]
	weapons: string[]
	tools: string[]
	languages: string[]
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

function signed(value: number): string {
	return value >= 0 ? `+${value}` : `−${Math.abs(value)}`
}

function listOf(names: readonly string[]): string {
	return names.length > 0 ? names.join(', ') : '—'
}

/** D307: a lost proficiency is worded as before; the other two reasons name what is actually wrong. */
function staleExpertiseText(stale: readonly { skill: string; reason: 'proficiency' | 'taken' | 'restricted' }[]): string {
	const of = (reason: 'proficiency' | 'taken' | 'restricted') => stale.filter((entry) => entry.reason === reason).map((entry) => capitalize(entry.skill))
	const lost = of('proficiency')
	const taken = of('taken')
	const restricted = of('restricted')
	return [
		lost.length > 0 ? `Expertise in ${lost.join(' and ')} needs ${lost.length === 1 ? 'a proficiency' : 'proficiencies'} you no longer have.` : '',
		taken.length > 0 ? `${taken.join(' and ')} already has Expertise from another source.` : '',
		restricted.length > 0 ? `Expertise in ${restricted.join(' and ')} is not in this class's allowed list.` : '',
	]
		.filter((sentence) => sentence !== '')
		.join(' ')
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactNode {
	return (
		<div className="review__row">
			<div className="review__label">{label}</div>
			<div className="review__text">{children}</div>
		</div>
	)
}

/** D298: the heading is a button only while its step is in this walk; a level up leaves out the steps it adds nothing to. */
function CardHeading({ title, step, steps, onGoTo }: { title: string; step: WizardStep; steps: readonly WizardStep[]; onGoTo: (step: WizardStep) => void }): ReactNode {
	return (
		<h3>
			{steps.includes(step) ? (
				<button type="button" className="review__heading-link" onClick={() => onGoTo(step)}>
					{title}
				</button>
			) : (
				title
			)}
		</h3>
	)
}

/** The sheet's Features & Traits row (same classes, same ResolvedEntries), without use boxes. */
function NewFeatureRow({ name, entries, loading, resolverData }: { name: string; entries: unknown[] | undefined; loading: boolean; resolverData: ResolverData }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="sheet__group-row">
			<div className="sheet__group-row-line">
				<button type="button" className="sheet__group-row-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
					<span className="sheet__group-row-arrow" aria-hidden="true">
						{open ? '▾' : '▸'}
					</span>
					<span className="sheet__group-row-name">{name}</span>
				</button>
			</div>
			{open && (
				<div className="sheet__group-row-text">
					{entries ? <ResolvedEntries entries={entries} data={resolverData} /> : loading ? <p>Loading…</p> : <UnresolvedValue reason={`No text found for "${name}".`} />}
				</div>
			)}
		</li>
	)
}

/** The text of the features this level grants, by feature id — loaded for the draft character the same way the sheet loads it. */
function useFeatureEntries(draft: Character, wanted: boolean): { byId: Map<string, unknown[]>; loading: boolean } {
	const key = JSON.stringify(draft.classes)
	const [loaded, setLoaded] = useState<{ key: string; byId: Map<string, unknown[]> } | null>(null)
	useEffect(() => {
		if (!wanted) return
		let cancelled = false
		loadGrantedClassFeatures(draft)
			.then((features) => {
				if (!cancelled) setLoaded({ key, byId: new Map(features.map((feature) => [feature.id, feature.entries])) })
			})
			.catch(() => {
				// D43: the row says its text was not found rather than staying on "Loading…".
				if (!cancelled) setLoaded({ key, byId: new Map() })
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the draft's classes (class, subclass, level), not the object rebuilt each render.
	}, [key, wanted])
	return { byId: loaded?.key === key ? loaded.byId : new Map(), loading: wanted && loaded?.key !== key }
}

function featLabel(instance: FeatInstance): string {
	return instance.origin === 'asi' ? `Level ${instance.level}` : featOriginLabel(instance)
}

export function ReviewStep({
	data,
	baseline,
	speciesLabel,
	levelUp,
	draft,
	abilityDraft,
	resolverData,
	proficiencies,
	feats,
	maxHp,
	hitDice,
	hpGain,
	maxHpOverride,
	startingInventory,
	staleExpertise,
	steps,
	onGoTo,
	saveError,
	classLine,
	unfinishedClasses = [],
	loadErrors = [],
}: {
	/** D337: data a multiclass Edit could not load; any blocks the save. */
	loadErrors?: readonly string[]
	/** D329: every class with its level after a multiclass level up ("Warlock 6 / Sorcerer 4"); absent shows the wizard's one class. */
	classLine?: string
	/** D333: the held classes of a multiclass Edit whose own picks are unfinished; any blocks the save. */
	unfinishedClasses?: readonly UnfinishedClass[]
	data: WizardData
	/** The seeded data of an edit or level up, for "spells added in this level up". */
	baseline: WizardData
	speciesLabel: string
	levelUp?: LevelGains
	/** The draft character at the target class, subclass and level — what the new features' text is looked up for. */
	draft: Character
	/** The draft the Ability scores step's table reads (no item bonuses). */
	abilityDraft: Character
	resolverData: ResolverData
	proficiencies: ReviewProficiencies
	feats: readonly FeatInstance[]
	/** Null until the maximum has loaded. */
	maxHp: number | null
	hitDice: string | null
	/** Level up only: the maximum now minus the maximum before. */
	hpGain: number | null
	/** D305: a manual maximum is on both sides of a level up, so a gain would read +0. */
	maxHpOverride: number | null
	/** Creation only; null leaves the card out. */
	startingInventory: { inventory: CharacterInventoryItem[]; currencyCopper: number } | null
	/** Expertise picks that no longer fit the pool: proficiency lost, already given by a fixed source or a feat's choice, or outside the class's allowed list. */
	staleExpertise: { skill: string; reason: 'proficiency' | 'taken' | 'restricted' }[]
	steps: readonly WizardStep[]
	onGoTo: (step: WizardStep) => void
	saveError: string | null
}): ReactNode {
	const [featEffects, setFeatEffects] = useState<FeatEffectEntry[] | undefined>(undefined)
	useEffect(() => {
		let cancelled = false
		loadFeatEffectEntries()
			.then((entries) => {
				if (!cancelled) setFeatEffects(entries)
			})
			.catch(() => {
				/* The table's ASI / Feats row stays "—"; the Ability scores step shows no such row either. */
			})
		return () => {
			cancelled = true
		}
	}, [])
	const entries = useFeatureEntries(draft, levelUp !== undefined && levelUp.newFeatures.length > 0)

	const classChoice = data.classChoice
	const identity = [speciesLabel, classLine ?? (classChoice ? `${classChoice.className} ${classChoice.level}` : ''), data.backgroundChoice?.name ?? ''].filter((part) => part !== '')

	const pickKey = (pick: { name: string; source: string }) => `${pick.name}|${pick.source}`
	const optionSpells = data.classOptionalFeatureChoices.flatMap((entry) => (entry.spellChoices ?? []).flatMap((choice) => [...choice.cantrips.map((spell) => ({ ...spell, level: 0 })), ...choice.spells.map((spell) => ({ ...spell, level: 1 }))]))
	const cantrips = [
		...data.spellChoices.filter((pick) => pick.level === 0).map((pick) => pick.name),
		...optionSpells.filter((spell) => spell.level === 0).map((spell) => spell.name),
		...(data.speciesCantrip ? [`${data.speciesCantrip.name} (${speciesLabel || 'species'})`] : []),
	]
	const spellLevels = [...new Set(data.spellChoices.filter((pick) => pick.level > 0).map((pick) => pick.level))].sort((a, b) => a - b)
	const subclassSpells = data.subclassSpellChoices.map((pick) => pick.name)
	const optionLeveled = optionSpells.filter((spell) => spell.level > 0).map((spell) => spell.name)
	const hasSpells = cantrips.length > 0 || spellLevels.length > 0 || subclassSpells.length > 0 || optionLeveled.length > 0

	// D306: spells from class options taken at this level count too.
	const optionSpellsOf = (source: WizardData) => source.classOptionalFeatureChoices.flatMap((entry) => (entry.spellChoices ?? []).flatMap((choice) => [...choice.cantrips, ...choice.spells]))
	const knownBefore = new Set([...baseline.spellChoices, ...baseline.subclassSpellChoices, ...optionSpellsOf(baseline)].map(pickKey))
	const spellsAdded = [...data.spellChoices, ...data.subclassSpellChoices, ...optionSpellsOf(data)].filter((pick) => !knownBefore.has(pickKey(pick))).map((pick) => pick.name)

	const increaseText = (increases: AbilityIncreaseMap): string =>
		Object.entries(increases)
			.map(([ability, amount]) => `${ABILITY_ABBREVIATIONS[ability as Ability].toUpperCase()} ${signed(amount)}`)
			.join(', ')
	const asiChoices = data.featAsiChoices.filter((choice): choice is Extract<FeatAsiChoice, { kind: 'asi' }> => choice.kind === 'asi')
	const levelChoice = levelUp ? data.featAsiChoices.find((choice) => choice.level === levelUp.level) : undefined
	const levelChoiceText = !levelChoice ? null : levelChoice.kind === 'asi' ? increaseText(levelChoice.increases) : levelChoice.name
	const base = Object.fromEntries(ABILITIES.map((ability) => [ability, data.abilityScores?.scores[ability] ?? null])) as Record<Ability, number | null>

	return (
		<div className="wizard__panel review" role="region" aria-label="Review">
			<div className="review__header">
				<div className="review__portrait">
					{data.portrait ? (
						<img src={data.portrait} alt={data.name.trim() ? `Portrait of ${data.name}` : 'Portrait'} />
					) : (
						data.name.trim() !== '' && <span aria-hidden="true">{data.name.trim().charAt(0).toUpperCase()}</span>
					)}
				</div>
				<div className="review__identity">
					<h2 className="review__name">{data.name}</h2>
					<p className="review__line">{identity.join(' · ')}</p>
				</div>
			</div>

			{staleExpertise.length > 0 && (
				<p className="expertise-picker__stale review__stale" role="alert">
					<span>{staleExpertiseText(staleExpertise)}</span>
					{/* D304: a level up without an Expertise step cannot reach it; the character is fixed in Edit Character. */}
					{steps.includes('expertise') ? (
						<button type="button" className="btn--accent-outline" onClick={() => onGoTo('expertise')}>
							Go to Expertise
						</button>
					) : (
						<span>Fix it in Edit Character.</span>
					)}
				</p>
			)}

			{loadErrors.map((message) => (
				<p key={message} className="review__unfinished" role="alert">
					{message}
				</p>
			))}

			{unfinishedClasses.map((cls) => (
				<p key={`${cls.className}|${cls.classSource}`} className="review__unfinished" role="alert">
					{cls.className} has unfinished choices: {cls.missing.join(', ')}. Switch to {cls.className} in step Class to finish them.
				</p>
			))}

			{levelUp && (
				<section className="review__card" aria-label={`Level ${levelUp.level} — What's new`}>
					<h3>Level {levelUp.level} — What&rsquo;s new</h3>
					{levelUp.newFeatures.length > 0 && (
						<ul className="review__features">
							{levelUp.newFeatures.map((feature) => (
								<NewFeatureRow key={feature.id} name={feature.name} entries={entries.byId.get(feature.id)} loading={entries.loading} resolverData={resolverData} />
							))}
						</ul>
					)}
					{maxHpOverride !== null ? (
						<Row label="Hit points">{`Manual maximum: ${maxHpOverride}`}</Row>
					) : (
						hpGain !== null && maxHp !== null && <Row label="Hit points">{`${signed(hpGain)} → ${maxHp}`}</Row>
					)}
					{spellsAdded.length > 0 && <Row label="Spells added">{spellsAdded.join(', ')}</Row>}
					{levelChoiceText && <Row label={levelChoice?.kind === 'asi' ? 'Ability score improvement' : 'Feat'}>{levelChoiceText}</Row>}
				</section>
			)}

			<section className="review__card" aria-label="Ability scores">
				<CardHeading title="Ability scores" step="abilities" steps={steps} onGoTo={onGoTo} />
				<AbilityScoreTable base={base} background={data.backgroundChoice?.abilityBonus} feats={featEffects} draft={abilityDraft} />
			</section>

			<section className="review__card" aria-label="Proficiencies">
				<CardHeading title="Proficiencies" step="languages" steps={steps} onGoTo={onGoTo} />
				<Row label="Skills">{listOf(proficiencies.skills.map(capitalize))}</Row>
				<Row label="Expertise">{listOf(proficiencies.expertise.map(capitalize))}</Row>
				<Row label="Armor">{listOf(proficiencies.armor)}</Row>
				<Row label="Weapons">{listOf(proficiencies.weapons)}</Row>
				<Row label="Tools">{listOf(proficiencies.tools)}</Row>
				<Row label="Languages">{listOf(proficiencies.languages)}</Row>
			</section>

			{hasSpells && (
				<section className="review__card" aria-label="Spells">
					<CardHeading title="Spells" step="spells" steps={steps} onGoTo={onGoTo} />
					{cantrips.length > 0 && <Row label="Cantrips">{cantrips.join(', ')}</Row>}
					{spellLevels.map((level) => (
						<Row key={level} label={`Level ${level}`}>
							{data.spellChoices.filter((pick) => pick.level === level).map((pick) => pick.name).join(', ')}
						</Row>
					))}
					{optionLeveled.length > 0 && <Row label="From class options">{optionLeveled.join(', ')}</Row>}
					{subclassSpells.length > 0 && <Row label="Subclass">{subclassSpells.join(', ')}</Row>}
				</section>
			)}

			{(feats.length > 0 || asiChoices.length > 0) && (
				<section className="review__card" aria-label="Feats">
					<CardHeading title="Feats" step="featAsi" steps={steps} onGoTo={onGoTo} />
					{feats.map((feat) => (
						<div key={feat.key} className="review__row review__feat">
							<span className="review__feat-name">
								{feat.name}
								{feat.chosenAbility ? ` (${ABILITY_ABBREVIATIONS[feat.chosenAbility as Ability]?.toUpperCase() ?? feat.chosenAbility})` : ''}
							</span>
							<span className="review__origin">{featLabel(feat)}</span>
						</div>
					))}
					{asiChoices.map((choice) => (
						<div key={`asi:${choice.level}`} className="review__row review__feat">
							<span className="review__feat-name">
								Level {choice.level}: {increaseText(choice.increases)}
							</span>
						</div>
					))}
				</section>
			)}

			<section className="review__card" aria-label="Hit points">
				<CardHeading title="Hit points" step="hitPoints" steps={steps} onGoTo={onGoTo} />
				<Row label="Maximum">{maxHp ?? '—'}</Row>
				<Row label="Hit dice">{hitDice ?? '—'}</Row>
			</section>

			{startingInventory && (
				<StartingTable
					inventory={startingInventory.inventory}
					currencyCopper={startingInventory.currencyCopper}
					ariaLabel="Equipment"
					heading={<CardHeading title="Equipment" step="equipment" steps={steps} onGoTo={onGoTo} />}
				/>
			)}

			{saveError && <p className="error">{saveError}</p>}
		</div>
	)
}
