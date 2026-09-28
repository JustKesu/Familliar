import { useEffect, useState, type ReactNode } from 'react'
import type { Ability } from '../abilities/abilityScores'
import {
	evaluateFeatPrerequisites,
	loadClassPrereqInfo,
	loadFeats,
	loadHasFightingStyleFeature,
	loadSpeciesPrereqInfo,
	type FeatEntry,
	type PrerequisiteContext,
	type PrerequisiteResult,
} from '../featAsi/featAsiData'
import type { FeatInstance, FeatRef } from '../featAsi/featInstances'
import { ResolvedEntries, type ResolverData } from '../featureResolver'
import type { Character } from '../storage/character'
import { DrawerSection } from './Drawer'
import type { FeatureTabRow } from './featuresTabData'
import type { FeatTextEntry } from './sheetData'

const CATEGORY_LABELS: Record<string, string> = { O: 'Origin', G: 'General', FS: 'Fighting Style', EB: 'Epic Boon', DG: 'Dark Gift' }
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

const categoryLabel = (code: string): string => CATEGORY_LABELS[code] ?? code

const titleCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const featKey = (feat: FeatRef): string => `${feat.name}|${feat.source}`.toLowerCase()

type Loaded = {
	feats: FeatEntry[]
	ctx: Omit<PrerequisiteContext, 'characterLevel' | 'abilityScores' | 'chosenFeats'>
	/** The first class whose Fighting Style feature the character has reached — the "From <Class>" of the class pick. */
	fightingStyleClass: string | null
}

async function loadPanelData(character: Character): Promise<Loaded> {
	const species = character.species
	const [feats, classInfo, speciesInfo] = await Promise.all([
		loadFeats(),
		Promise.all(
			character.classes.map(async (c) => ({
				className: c.className,
				info: await loadClassPrereqInfo(c.className, c.classSource),
				fightingStyle: await loadHasFightingStyleFeature(c.className, c.classSource, c.level),
			})),
		),
		species ? loadSpeciesPrereqInfo(species.name, species.source) : Promise.resolve(null),
	])
	return {
		feats,
		fightingStyleClass: classInfo.find((c) => c.fightingStyle)?.className ?? null,
		ctx: {
			hasFightingStyleFeature: classInfo.some((c) => c.fightingStyle),
			hasSpellcasting: classInfo.some((c) => c.info?.hasSpellcasting),
			armorProficiencies: [...new Set(classInfo.flatMap((c) => c.info?.armorProficiencies ?? []))],
			weaponProficiencies: [...new Set(classInfo.flatMap((c) => c.info?.weaponProficiencies ?? []))],
			speciesName: species?.name ?? null,
			speciesRaceTags: speciesInfo?.raceTags ?? [],
			speciesSize: speciesInfo?.size ?? character.speciesSize ?? null,
		},
	}
}

export interface FeatOffer {
	feat: FeatEntry
	result: PrerequisiteResult
}

/** Every feat Add Feats may list, with its prerequisite result. A held non-repeatable feat is left out; every held feat counts as chosen (manual ones included). */
export function featOffers(feats: readonly FeatEntry[], held: readonly FeatRef[], ctx: Omit<PrerequisiteContext, 'chosenFeats'>): FeatOffer[] {
	const heldKeys = new Set(held.map(featKey))
	const chosenFeats = held.map((feat) => ({ name: feat.name, source: feat.source, category: feats.find((entry) => featKey(entry) === featKey(feat))?.category ?? '' }))
	return feats.filter((feat) => feat.repeatable || !heldKeys.has(featKey(feat))).map((feat) => ({ feat, result: evaluateFeatPrerequisites(feat, { ...ctx, chosenFeats }) }))
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
 * The Manage Feats drawer (R13a, D215): every feat the character holds, and feats
 * the DM grants, added and removed one at a time. Level and background feats are
 * locked here; changing them stays in Edit Character.
 */
export function ManageFeatsPanel({
	character,
	instances,
	featRows,
	featTexts,
	abilityScores,
	resolverData,
	onAdd,
	onRemove,
}: {
	character: Character
	/** featInstances — manual feats included. */
	instances: readonly FeatInstance[]
	/** The Features & Traits feat rows, keyed `feat|<instance key>`: text, stored sub-choices, pending ones. */
	featRows: readonly FeatureTabRow[]
	featTexts: readonly FeatTextEntry[]
	abilityScores: Partial<Record<Ability, number>>
	resolverData: ResolverData
	onAdd: (feat: FeatRef) => void
	onRemove: (key: string) => void
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

	const fightingStyle = character.fightingStyle && loaded ? loaded.feats.find((feat) => feat.category === 'FS' && feat.name.toLowerCase() === character.fightingStyle?.toLowerCase()) : undefined
	const held: FeatRef[] = [...instances, ...(fightingStyle ? [fightingStyle] : [])]

	function instanceRow(instance: FeatInstance): ReactNode {
		const row = rowOf(instance)
		const chip = instance.origin === 'background' ? 'From Background' : instance.origin === 'species' ? 'From Species' : instance.origin === 'asi' ? `From level ${instance.level}` : undefined
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
				{row && (row.options.length > 0 || row.pending) && (
					<ul className="sheet__feature-options">
						{row.options.map((option) => (
							<li key={option.key}>{option.name}</li>
						))}
						{row.pending && <li className="sheet__feat-pending">Choices not made yet: {row.pending.join(', ')}.</li>}
					</ul>
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
			const increases = Object.entries(choice.increases).filter(([, amount]) => amount)
			return (
				<FeatRow key={`asi:${choice.level}`} name="Ability Score Improvement" chip={`From level ${choice.level}`}>
					<p>{increases.length > 0 ? increases.map(([ability, amount]) => `${titleCase(ability)} +${amount}`).join(', ') : 'No increases chosen yet.'}</p>
				</FeatRow>
			)
		})

	const myFeats = [
		...instances.filter((instance) => instance.origin === 'background' || instance.origin === 'species').map(instanceRow),
		...levelRows,
		...(fightingStyle && loaded?.fightingStyleClass
			? [
					<FeatRow key="fighting-style" name={fightingStyle.name} chip={`From ${loaded.fightingStyleClass}`}>
						<FeatText entries={textOf(fightingStyle)} name={fightingStyle.name} resolverData={resolverData} />
					</FeatRow>,
				]
			: []),
		...instances.filter((instance) => instance.origin === 'manual').map(instanceRow),
	]

	let offered: FeatOffer[] = []
	let categories: string[] = []
	if (loaded) {
		offered = featOffers(loaded.feats, held, { ...loaded.ctx, characterLevel: character.classes.reduce((sum, c) => sum + c.level, 0), abilityScores })
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
								key={featKey(feat)}
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
							<FeatRow key={featKey(feat)} name={feat.name} meta={categoryLabel(feat.category)} note={result.reasons.join(' ')}>
								<FeatText entries={textOf(feat)} name={feat.name} resolverData={resolverData} />
							</FeatRow>
						))}
					</ul>
				</section>
			</DrawerSection>
		</>
	)
}
