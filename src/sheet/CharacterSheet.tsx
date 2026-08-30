/*
 * Character sheet (build order step 5, complete). 5a (skeleton, header, top
 * value block) plus 5b: skills, passive values, speed/size/darkvision, hit
 * dice pool, and the feat list — see docs/STATUS.md.
 *
 * Read-only. Replaces CharacterInspector.tsx (D14) in function — the wiring
 * to it (import, "Inspect" button, inspectedId state) is removed from
 * CharacterManager.tsx in this task, but the file itself is still on disk:
 * a settings deny rule blocks deleting it here (see docs/REPORT.md).
 *
 * Every number comes from src/calculation/ (D38: pure functions, data
 * fetched here and passed in, never fetched by the calculation layer
 * itself). Data acquisition goes through the shared loader (D39).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { familiarFormOptions, formKey, hasFindFamiliar, hasPactOfTheChain, loadBeasts, type Beast, type FamiliarFormOption } from '../beasts/beastData'
import { computeAbilityScores } from '../calculation/abilityScores'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { computeHitDicePool, type ClassHitDie } from '../calculation/hitDice'
import { computeInitiative } from '../calculation/initiative'
import { computeProficiencyBonus } from '../calculation/proficiencyBonus'
import { computeSavingThrows, type ClassSavingThrowProficiencies, type SavingThrowValue } from '../calculation/savingThrows'
import { computePassiveInsight, computePassiveInvestigation, computePassivePerception, computeSkills, SKILLS, type Skill, type SkillValue } from '../calculation/skills'
import { computeFeatSpellcasting, computeSpellcasting, type ClassSpellcastingAbility } from '../calculation/spellcasting'
import { computeSpellSlots, type ClassSpellSlotsData } from '../calculation/spellSlots'
import { computeDarkvision, computeSize, computeSpeed, type GrantedDarkvision, type SpeciesTraitsData, type SpeedValue } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import { loadChosenClassOptionalFeatures, type ChosenClassOptionalFeatureGroup } from '../optionalFeatures/optionalFeatureData'
import { loadChosenClassFeatureChoices, type ChosenClassFeatureChoice } from '../classFeatureChoices/classFeatureChoiceData'
import { loadFeatGrantedSpells, type FeatGrantedSpell } from '../spells/featSpells'
import { loadOptionalFeatureGrantedSpells, type OptionalFeatureGrantedSpell } from '../spells/optionalFeatureSpells'
import { loadSpellDetails, type SpellDetail } from '../spells/spellDetailData'
import { BeastStatBlock } from './BeastStatBlock'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import { coinsToCopper, copperToCoins } from '../inventory/currency'
import { itemKey, loadItemRefs, type ItemRef } from '../inventory/inventoryData'
import { loadGrantedSenses, type GrantedSense } from './grantedSenses'
import { combineSenseEntries, SensesList } from './SensesList'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { dedupeAlwaysPreparedSpells, loadSubclassAlwaysPreparedSpells, type AlwaysPreparedSpell } from '../spells/subclassPreparedSpells'
import { loadSubclassChosenSpells } from '../spells/subclassSpellChoiceData'
import {
	loadFeatEffectEntries,
	loadFeatTextEntries,
	loadHitDiceClassData,
	loadSavingThrowClassData,
	loadSpeciesTraitsData,
	loadSpellcastingAbilityClassData,
	loadSubclassSource,
	type FeatTextEntry,
} from './sheetData'
import { combineSpellEntries, SpellList } from './SpellList'
import type { Character, CharacterFamiliar, CharacterInventoryItem } from '../storage/character'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

const SKILL_LABELS: Record<Skill, string> = {
	acrobatics: 'Acrobatics',
	'animal handling': 'Animal Handling',
	arcana: 'Arcana',
	athletics: 'Athletics',
	deception: 'Deception',
	history: 'History',
	insight: 'Insight',
	intimidation: 'Intimidation',
	investigation: 'Investigation',
	medicine: 'Medicine',
	nature: 'Nature',
	perception: 'Perception',
	performance: 'Performance',
	persuasion: 'Persuasion',
	religion: 'Religion',
	'sleight of hand': 'Sleight of Hand',
	stealth: 'Stealth',
	survival: 'Survival',
}

/** D45 — a mark per proficiency status, never a number standing in for it. */
const SKILL_STATUS_MARKS: Record<SkillValue['status'], string> = {
	none: '○',
	half: '◐',
	proficient: '●',
	expertise: '★',
}

/** Same pattern as SKILL_STATUS_MARKS — a mark per status, not a breakdown-length check. */
const SAVE_STATUS_MARKS: Record<SavingThrowValue['status'], string> = {
	none: '○',
	proficient: '●',
}

const SIZE_LABELS: Record<string, string> = {
	T: 'Tiny',
	S: 'Small',
	M: 'Medium',
	L: 'Large',
	H: 'Huge',
	G: 'Gargantuan',
}

const ABILITY_LABELS: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function formatModifier(modifier: number): string {
	return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

function formatSpeed(speed: SpeedValue): string {
	const parts = [`${speed.walk} ft.`]
	if (speed.fly) parts.push(`fly ${speed.fly} ft.`)
	if (speed.swim) parts.push(`swim ${speed.swim} ft.`)
	if (speed.climb) parts.push(`climb ${speed.climb} ft.`)
	return parts.join(', ')
}

const NO_FAMILIAR_KEY = ''

/**
 * The familiar-form options for the sheet's one editable control. "No familiar
 * summoned" leads (its key is the empty string, which maps back to
 * onChooseFamiliar(null)); then the Find Familiar pool, then any Pact of the
 * Chain forms — the order the old <select> used its optgroups in. Each form's
 * stat block rides in `detail` as a default-collapsed <details>, so a search
 * result narrows the summaries shown without flinging stat blocks open.
 */
function familiarPickerOptions(forms: FamiliarFormOption[], storedFamiliar: CharacterFamiliar | null): SearchableOption[] {
	const ordered = [
		...forms.filter((option) => option.origin === 'spell'),
		...forms.filter((option) => option.origin === 'pact-of-the-chain'),
	]
	return [
		{ key: NO_FAMILIAR_KEY, name: 'No familiar summoned', selected: storedFamiliar === null },
		...ordered.map(({ beast, origin }) => ({
			key: formKey(beast),
			name: beast.name,
			label: (
				<>
					{beast.name} (CR {beast.cr})
					{origin === 'pact-of-the-chain' && <span className="sheet__familiar-origin"> Pact of the Chain</span>}
				</>
			),
			detail: <BeastStatBlock beast={beast} />,
			selected: storedFamiliar !== null && formKey(beast) === formKey(storedFamiliar),
		})),
	]
}

/** Renders any Calculated<number> as its value plus breakdown, or D43's visible "unresolved" state. */
function CalculatedNumber({ result, format }: { result: Calculated<number>; format?: (value: number) => string }): ReactNode {
	if (result.status === 'unknown') return <UnresolvedValue reason={result.reason} />
	return (
		<>
			<span>{format ? format(result.value) : result.value}</span> <ValueBreakdown breakdown={result.breakdown} />
		</>
	)
}

/**
 * A number input that commits only on blur or Enter, not on every keystroke.
 * The sheet persists each edit straight through to storage; committing
 * mid-type would fight the player as the round-tripped value snapped the
 * field back. `value` seeds the field and re-seeds it whenever storage
 * changes it from elsewhere (e.g. gp/sp/cp normalising after a copper edit).
 */
function CommitNumberField({
	label,
	value,
	min,
	onCommit,
}: {
	label: string
	value: number
	min: number
	onCommit: (value: number) => void
}): ReactNode {
	const [draft, setDraft] = useState(String(value))
	useEffect(() => {
		setDraft(String(value))
	}, [value])

	function commit(): void {
		const parsed = Math.floor(Number(draft))
		const next = Number.isFinite(parsed) ? Math.max(min, parsed) : min
		setDraft(String(next))
		if (next !== value) onCommit(next)
	}

	return (
		<label>
			{label}{' '}
			<input
				type="number"
				min={min}
				aria-label={label}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur()
				}}
			/>
		</label>
	)
}

/**
 * Inventory and money (build order step 7, slice a1). The second editable
 * place on an otherwise read-only sheet (the familiar is the first): editing
 * is confined to this section and stays a plain list, not a form. Without the
 * callbacks the section still renders read-only.
 *
 * An empty inventory is a normal state, shown as a plain line — never an
 * error (contrast itemRefsError, which is the item DATA failing to load, D43).
 * A stored item whose (name, source) isn't in the loaded list is kept and
 * shown with a note, never dropped (D43).
 */
function InventorySection({
	inventory,
	currencyCopper,
	itemRefs,
	itemRefsError,
	onEditInventory,
	onEditCurrency,
}: {
	inventory: CharacterInventoryItem[]
	currencyCopper: number
	itemRefs: ItemRef[] | null
	itemRefsError: string | null
	onEditInventory?: (inventory: CharacterInventoryItem[]) => void
	onEditCurrency?: (copper: number) => void
}): ReactNode {
	const known = new Set((itemRefs ?? []).map(itemKey))
	const coins = copperToCoins(currencyCopper)

	function editCoin(field: 'pp' | 'gp' | 'sp' | 'cp', amount: number): void {
		onEditCurrency?.(coinsToCopper({ ...coins, [field]: amount }))
	}

	function setQuantity(index: number, quantity: number): void {
		// Quantity floor is 1 — removing is its own action, never "set to 0"; CommitNumberField already clamps to min={1}.
		onEditInventory?.(inventory.map((item, i) => (i === index ? { ...item, quantity } : item)))
	}

	function removeAt(index: number): void {
		onEditInventory?.(inventory.filter((_, i) => i !== index))
	}

	function toggleAdd(key: string): void {
		if (!onEditInventory) return
		const existing = inventory.findIndex((item) => itemKey(item) === key)
		if (existing !== -1) {
			onEditInventory(inventory.filter((_, i) => i !== existing))
			return
		}
		const ref = (itemRefs ?? []).find((candidate) => itemKey(candidate) === key)
		if (ref) onEditInventory([...inventory, { name: ref.name, source: ref.source, quantity: 1 }])
	}

	const addOptions: SearchableOption[] = (itemRefs ?? []).map((ref) => ({
		key: itemKey(ref),
		name: ref.name,
		label: `${ref.name} (${ref.source})`,
		selected: inventory.some((item) => itemKey(item) === itemKey(ref)),
	}))

	return (
		<section className="sheet__inventory">
			<h2>Inventory</h2>

			<div className="sheet__currency">
				<h3>Money</h3>
				{onEditCurrency ? (
					<p>
						<CommitNumberField label="Platinum" min={0} value={coins.pp} onCommit={(amount) => editCoin('pp', amount)} />{' '}
						<CommitNumberField label="Gold" min={0} value={coins.gp} onCommit={(amount) => editCoin('gp', amount)} />{' '}
						<CommitNumberField label="Silver" min={0} value={coins.sp} onCommit={(amount) => editCoin('sp', amount)} />{' '}
						<CommitNumberField label="Copper" min={0} value={coins.cp} onCommit={(amount) => editCoin('cp', amount)} />
					</p>
				) : (
					<p>
						{coins.pp} pp, {coins.gp} gp, {coins.sp} sp, {coins.cp} cp
					</p>
				)}
			</div>

			{itemRefsError && <p className="error">Could not load the item list: {itemRefsError}</p>}

			{inventory.length === 0 ? (
				<p className="sheet__inventory-empty">Nothing carried yet.</p>
			) : (
				<ul className="sheet__inventory-list">
					{inventory.map((item, index) => (
						<li key={itemKey(item)}>
							<span>{item.name}</span>
							{itemRefs !== null && itemRefsError === null && !known.has(itemKey(item)) && (
								<> <UnresolvedValue reason={`Item data not found for "${item.name}" (${item.source}).`} /></>
							)}
							{onEditInventory ? (
								<>
									{' '}
									<CommitNumberField
										label={`Quantity of ${item.name}`}
										min={1}
										value={item.quantity}
										onCommit={(quantity) => setQuantity(index, quantity)}
									/>{' '}
									<button type="button" onClick={() => removeAt(index)}>
										Remove
									</button>
								</>
							) : (
								<> ×{item.quantity}</>
							)}
						</li>
					))}
				</ul>
			)}

			{onEditInventory && itemRefs !== null && (
				<SearchableOptionList
					legend="Add an item"
					name="inventory-add"
					inputType="checkbox"
					options={addOptions}
					required={0}
					defaultOpen={false}
					renderCount={() => `${inventory.length} item${inventory.length === 1 ? '' : 's'} carried`}
					onToggle={toggleAdd}
					searchPlaceholder="Search items by name…"
				/>
			)}
		</section>
	)
}

/**
 * The sheet is read-only except for two controls: the familiar's form and the
 * inventory section (build order step 7). Both are chosen/changed in play, not
 * at creation, so they belong here and not in the wizard. The callbacks are
 * optional — without them each section still renders and shows its current
 * state, it just cannot be changed.
 */
export function CharacterSheet({
	character,
	onChooseFamiliar,
	onEditInventory,
	onEditCurrency,
}: {
	character: Character
	onChooseFamiliar?: (familiar: CharacterFamiliar | null) => void
	onEditInventory?: (inventory: CharacterInventoryItem[]) => void
	onEditCurrency?: (copper: number) => void
}): ReactNode {
	const [savingThrowClassData, setSavingThrowClassData] = useState<ClassSavingThrowProficiencies[] | null>(null)
	const [hitDiceClassData, setHitDiceClassData] = useState<ClassHitDie[] | null>(null)
	const [speciesTraitsData, setSpeciesTraitsData] = useState<SpeciesTraitsData[] | null>(null)
	const [feats, setFeats] = useState<FeatEffectEntry[] | null>(null)
	const [featTextEntries, setFeatTextEntries] = useState<FeatTextEntry[] | null>(null)
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)
	const [spellcastingAbilityData, setSpellcastingAbilityData] = useState<ClassSpellcastingAbility[] | null>(null)
	const [spellSlotsClassData, setSpellSlotsClassData] = useState<ClassSpellSlotsData[] | null>(null)
	const [spellDetails, setSpellDetails] = useState<SpellDetail[] | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	/** The item list backing the inventory section — its own load (large file, D43-style error state) so it never blocks the rest of the sheet. Null until it resolves. */
	const [itemRefs, setItemRefs] = useState<ItemRef[] | null>(null)
	const [itemRefsError, setItemRefsError] = useState<string | null>(null)

	/** One entry per class carrying a subclass — resolved and fetched separately from the main load (it depends on `character`, not just static data), starts empty rather than blocking the rest of the sheet on the D46-style subclass source resolution (sheetData.ts). */
	const [subclassSpellInfo, setSubclassSpellInfo] = useState<{ subclassName: string; alwaysPrepared: AlwaysPreparedSpell[] }[]>([])
	/** Fixed feat-granted spells (d5a) — depends on `character.featAsiChoices`, fetched separately from the main load same as subclassSpellInfo. */
	const [featSpells, setFeatSpells] = useState<FeatGrantedSpell[]>([])
	/** The CLASS's own optionalfeatureProgression picks (step 6a slice 2) — Metamagic, Eldritch Invocations. Depends on `character`, fetched separately same as featSpells. */
	const [classOptionalFeatures, setClassOptionalFeatures] = useState<ChosenClassOptionalFeatureGroup[]>([])
	/** Spells granted BY those picks (step 6a final slice) — separate from the option text above, which classOptionalFeatures already renders. */
	const [optionalFeatureSpells, setOptionalFeatureSpells] = useState<OptionalFeatureGrantedSpell[]>([])
	/** Senses granted by a chosen optional feature or a chosen feat (step 6a, final piece — closes 6a). Depends on `character`, fetched separately same as featSpells/optionalFeatureSpells above. */
	const [grantedSenses, setGrantedSenses] = useState<GrantedSense[]>([])
	/** The D21 class-feature choices (Divine Order, Primal Order, Elemental Fury) joined to their chosen option's text. Depends on `character`, fetched separately same as the effects above. */
	const [classFeatureChoices, setClassFeatureChoices] = useState<ChosenClassFeatureChoice[]>([])
	/** The Find Familiar beast pool (step 6b slice 2). Fetched only for a character that actually has the spell — see the effect below. */
	const [beasts, setBeasts] = useState<Beast[]>([])

	/*
	 * D43: each per-`character` effect above starts empty and stays empty when its
	 * fetch fails, which on its own is indistinguishable from "this character has
	 * none". One error state per effect, rendered by the section that effect feeds,
	 * so an incomplete sheet never reads as a complete one.
	 */
	const [subclassSpellsError, setSubclassSpellsError] = useState<string | null>(null)
	const [featSpellsError, setFeatSpellsError] = useState<string | null>(null)
	const [optionalFeatureSpellsError, setOptionalFeatureSpellsError] = useState<string | null>(null)
	const [grantedSensesError, setGrantedSensesError] = useState<string | null>(null)
	const [classOptionalFeaturesError, setClassOptionalFeaturesError] = useState<string | null>(null)
	const [classFeatureChoicesError, setClassFeatureChoicesError] = useState<string | null>(null)
	/** Same rule as the six above, for the one load that was still swallowing: without it a failed beasts.json fetch removed the whole Familiar section (docs/REPORT.md). */
	const [beastsError, setBeastsError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		Promise.all([
			loadSavingThrowClassData(),
			loadHitDiceClassData(),
			loadSpeciesTraitsData(),
			loadFeatEffectEntries(),
			loadFeatTextEntries(),
			loadResolverData(),
			loadSpellcastingAbilityClassData(),
			loadSpellSlotsClassData(),
			loadSpellDetails(),
		])
			.then(([classData, hitDiceData, speciesData, featData, featTexts, resolver, spellcastingData, spellSlotsData, spellDetailData]) => {
				if (cancelled) return
				setSavingThrowClassData(classData)
				setHitDiceClassData(hitDiceData)
				setSpeciesTraitsData(speciesData)
				setFeats(featData)
				setFeatTextEntries(featTexts)
				setResolverData(resolver)
				setSpellcastingAbilityData(spellcastingData)
				setSpellSlotsClassData(spellSlotsData)
				setSpellDetails(spellDetailData)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setLoadError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		loadItemRefs()
			.then((refs) => {
				if (cancelled) return
				setItemRefs(refs)
				setItemRefsError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setItemRefs([])
				setItemRefsError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		const classesWithSubclass = character.classes.filter((c): c is typeof c & { subclass: string } => c.subclass !== null)
		if (classesWithSubclass.length === 0) {
			setSubclassSpellInfo([])
			setSubclassSpellsError(null)
			return
		}
		Promise.all(
			classesWithSubclass.map(async (c) => {
				const source = await loadSubclassSource(c.className, c.classSource, c.subclass)
				// Only Warlock's own Pact Magic table applies to a rank-keyed patron grant (subclassPreparedSpells.ts) — any other class's table would be the wrong shape's numbers entirely.
				// spellSlotsClassData loads in parallel via a separate effect — undefined here on an early run just means no rank grant yet; this effect re-runs (dep below) once it's in, same as any other race in this file.
				const pactSlotsByLevel = spellSlotsClassData?.find((d) => d.className === c.className && d.classSource === c.classSource)?.pactSlotsByLevel ?? undefined
				const alwaysPrepared = source ? await loadSubclassAlwaysPreparedSpells(c.subclass, source, c.className, c.classSource, c.level, pactSlotsByLevel) : []
				/** The subclass filter-choice spell picker's own picks (d6b) — same "always prepared (subclass)" provenance label as the fixed grants above, merged into the same group rather than a separate one (CharacterSheet.tsx module comment, SpellList.tsx). */
				const matchingChoices = (character.subclassSpellChoices ?? []).filter(
					(choice) => choice.className === c.className && choice.classSource === c.classSource && choice.subclassName === c.subclass && choice.subclassSource === source,
				)
				const chosen = matchingChoices.length > 0 ? await loadSubclassChosenSpells(matchingChoices) : []
				// dedupeAlwaysPreparedSpells: a d6b picked spell could in principle coincide with the subclass's own fixed grant — same "spell reachable via two paths" reasoning as subclassPreparedSpells.ts's own dedup, applied again here since this concatenation happens outside that module.
				return { subclassName: c.subclass, alwaysPrepared: dedupeAlwaysPreparedSpells([...alwaysPrepared, ...chosen]) }
			}),
		)
			.then((infos) => {
				if (cancelled) return
				setSubclassSpellInfo(infos)
				setSubclassSpellsError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setSubclassSpellInfo([])
				setSubclassSpellsError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character, spellSlotsClassData])

	useEffect(() => {
		let cancelled = false
		loadFeatGrantedSpells(character)
			.then((spells) => {
				if (cancelled) return
				setFeatSpells(spells)
				setFeatSpellsError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setFeatSpells([])
				setFeatSpellsError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadChosenClassOptionalFeatures(character.classes, character.optionalFeatureChoices ?? [])
			.then((groups) => {
				if (cancelled) return
				setClassOptionalFeatures(groups)
				setClassOptionalFeaturesError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setClassOptionalFeatures([])
				setClassOptionalFeaturesError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadOptionalFeatureGrantedSpells(character)
			.then((spells) => {
				if (cancelled) return
				setOptionalFeatureSpells(spells)
				setOptionalFeatureSpellsError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setOptionalFeatureSpells([])
				setOptionalFeatureSpellsError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadGrantedSenses(character)
			.then((senses) => {
				if (cancelled) return
				setGrantedSenses(senses)
				setGrantedSensesError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setGrantedSenses([])
				setGrantedSensesError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadChosenClassFeatureChoices(character)
			.then((choices) => {
				if (cancelled) return
				setClassFeatureChoices(choices)
				setClassFeatureChoicesError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setClassFeatureChoices([])
				setClassFeatureChoicesError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	/*
	 * The character's whole spell list, however each spell was come by. Computed
	 * here rather than further down because the Find Familiar section keys off
	 * it: a spell reaching the character through a subclass, a feat or an
	 * invocation counts exactly as much as a player pick.
	 */
	const combinedSpells = combineSpellEntries(
		character.spellChoices ?? [],
		subclassSpellInfo.map((info) => ({ subclassName: info.subclassName, spells: info.alwaysPrepared })),
		featSpells,
		optionalFeatureSpells,
	)
	const knowsFindFamiliar = hasFindFamiliar(combinedSpells)
	const storedWildShapeForms = character.wildShapeForms ?? []
	const needsBeasts = knowsFindFamiliar || storedWildShapeForms.length > 0

	// beasts.json is 80 KB, so a character with neither Find Familiar nor a
	// known Wild Shape form never fetches it.
	useEffect(() => {
		if (!needsBeasts) {
			setBeastsError(null)
			return
		}
		let cancelled = false
		loadBeasts()
			.then((loaded) => {
				if (cancelled) return
				setBeasts(loaded)
				setBeastsError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setBeasts([])
				setBeastsError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [needsBeasts])

	if (loadError) {
		return (
			<article className="sheet">
				<p className="error">Could not load the data this sheet needs: {loadError}</p>
			</article>
		)
	}

	if (
		!savingThrowClassData ||
		!hitDiceClassData ||
		!speciesTraitsData ||
		!feats ||
		!featTextEntries ||
		!resolverData ||
		!spellcastingAbilityData ||
		!spellSlotsClassData ||
		!spellDetails
	) {
		return (
			<article className="sheet">
				<p>Loading…</p>
			</article>
		)
	}

	const abilityScores = computeAbilityScores(character, feats)
	const proficiencyBonus = computeProficiencyBonus(character.classes)
	const savingThrows = computeSavingThrows(character, savingThrowClassData, feats)
	const initiative = computeInitiative(character, feats)
	const skills = computeSkills(character, feats)
	const passivePerception = computePassivePerception(character, feats)
	const passiveInvestigation = computePassiveInvestigation(character, feats)
	const passiveInsight = computePassiveInsight(character, feats)
	const speed = computeSpeed(character, speciesTraitsData)
	const size = computeSize(character, speciesTraitsData)
	// Darkvision is the one granted sense that reconciles with the species value (D40/D53) rather than
	// standing alone in the Senses section below — split out here, before combineSenseEntries sees the rest.
	const darkvisionGrants: GrantedDarkvision[] = grantedSenses
		.filter((sense) => sense.senseType.toLowerCase() === 'darkvision')
		.map((sense) => ({ range: sense.range, origin: sense.origin, name: sense.name }))
	const darkvision = computeDarkvision(character, speciesTraitsData, darkvisionGrants)
	const hitDice = computeHitDicePool(character.classes, hitDiceClassData)
	const chosenFeats = (character.featAsiChoices ?? []).filter((choice) => choice.kind === 'feat')

	const spellcasting = computeSpellcasting(character, spellcastingAbilityData, feats)
	const spellcastingEntries = spellcasting.status === 'known' ? spellcasting.value : []
	const spellSlots = computeSpellSlots(character, spellSlotsClassData)
	const spellSlotsEntries = spellSlots.status === 'known' ? spellSlots.value : []
	const featSpellcasting = computeFeatSpellcasting(character, featSpells, feats)
	const featSpellcastingEntries = featSpellcasting.status === 'known' ? featSpellcasting.value : []
	// D46-style: a class with no spellcasting ability (spellcasting.ts) but slots via a subclass table (spellSlots.ts's EK/AT fallback) still counts as a caster for section visibility, even though its attack/DC entry is empty — see docs/REPORT.md.
	const isCaster = spellcastingEntries.length > 0 || spellSlotsEntries.length > 0 || featSpellcastingEntries.length > 0
	// The invocation's eight extra forms are offered only to a character who took it (D68's rule-over-flag reasoning: what the feature says, not what a creature is tagged with).
	const familiarForms = knowsFindFamiliar ? familiarFormOptions(beasts, hasPactOfTheChain(character.optionalFeatureChoices ?? [])) : []
	const storedFamiliar = character.familiar ?? null
	const chosenFamiliar = storedFamiliar ? (familiarForms.find((option) => formKey(option.beast) === formKey(storedFamiliar)) ?? null) : null
	/* The stat block is re-derived from beasts.json, never stored — storage carries name+source only. */
	const wildShapeForms = storedWildShapeForms.flatMap((entry) =>
		entry.forms.map((form) => ({
			form,
			className: entry.className,
			beast: beasts.find((beast) => beast.name === form.name && beast.source === form.source) ?? null,
		})),
	)
	// Darkvision grants are folded into the traits row above, not shown again here.
	const combinedSenses = combineSenseEntries(grantedSenses.filter((sense) => sense.senseType.toLowerCase() !== 'darkvision'))

	/* D43: the three grants feeding the spell list each name themselves, so the player can tell which part of the list is short rather than just that something is. */
	const spellLoadErrors: { what: string; message: string }[] = [
		{ what: 'always-prepared subclass spells', message: subclassSpellsError },
		{ what: 'feat-granted spells', message: featSpellsError },
		{ what: 'spells granted by your chosen options', message: optionalFeatureSpellsError },
	].filter((entry): entry is { what: string; message: string } => entry.message !== null)

	return (
		<article className="sheet">
			<header className="sheet__header">
				<h1>{character.name}</h1>

				<p className="sheet__classes">
					{character.classes.length === 0 ? (
						<UnresolvedValue reason="No class chosen yet." />
					) : (
						character.classes.map((c, index) => (
							<span key={index}>
								{index > 0 ? ', ' : ''}
								{c.className} {c.level}
								{c.subclass ? ` (${c.subclass})` : ''}
							</span>
						))
					)}
				</p>

				<p className="sheet__species">{character.species ? character.species.name : <UnresolvedValue reason="No species chosen yet." />}</p>

				<p className="sheet__background">
					{character.background ? character.background.name : <UnresolvedValue reason="No background chosen yet." />}
				</p>
			</header>

			<section className="sheet__abilities">
				<h2>Ability scores</h2>
				<ul>
					{ABILITIES.map((ability) => {
						const result = abilityScores[ability]
						return (
							<li key={ability}>
								{ABILITY_LABELS[ability]}:{' '}
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<>
										<span>
											{result.value.score} ({formatModifier(result.value.modifier)})
										</span>{' '}
										<ValueBreakdown breakdown={result.breakdown} />
									</>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			<section className="sheet__proficiency-bonus">
				<h2>Proficiency bonus</h2>
				<p>
					<CalculatedNumber result={proficiencyBonus} format={formatModifier} />
				</p>
			</section>

			<section className="sheet__saving-throws">
				<h2>Saving throws</h2>
				<ul>
					{ABILITIES.map((ability) => {
						const result = savingThrows[ability]
						return (
							<li key={ability}>
								{result.status === 'known' ? SAVE_STATUS_MARKS[result.value.status] : '?'} {ABILITY_LABELS[ability]}:{' '}
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<>
										<span>{formatModifier(result.value.modifier)}</span> <ValueBreakdown breakdown={result.breakdown} />
									</>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			<section className="sheet__initiative">
				<h2>Initiative</h2>
				<p>
					<CalculatedNumber result={initiative} format={formatModifier} />
				</p>
			</section>

			<section className="sheet__skills">
				<h2>Skills</h2>
				<ul>
					{SKILLS.map((skill) => {
						const result = skills[skill]
						return (
							<li key={skill}>
								{result.status === 'known' ? SKILL_STATUS_MARKS[result.value.status] : '?'} {SKILL_LABELS[skill]}:{' '}
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<>
										<span>{formatModifier(result.value.modifier)}</span> <ValueBreakdown breakdown={result.breakdown} />
									</>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			<section className="sheet__passive-values">
				<h2>Passive values</h2>
				<ul>
					<li>
						Passive Perception: <CalculatedNumber result={passivePerception} />
					</li>
					<li>
						Passive Investigation: <CalculatedNumber result={passiveInvestigation} />
					</li>
					<li>
						Passive Insight: <CalculatedNumber result={passiveInsight} />
					</li>
				</ul>
			</section>

			<section className="sheet__traits">
				<h2>Speed, size, darkvision</h2>
				<ul>
					<li>
						Speed:{' '}
						{speed.status === 'unknown' ? (
							<UnresolvedValue reason={speed.reason} />
						) : (
							<>
								<span>{formatSpeed(speed.value)}</span> <ValueBreakdown breakdown={speed.breakdown} />
							</>
						)}
					</li>
					<li>
						Size:{' '}
						{size.status === 'unknown' ? (
							<UnresolvedValue reason={size.reason} />
						) : (
							<>
								<span>{SIZE_LABELS[size.value] ?? size.value}</span> <ValueBreakdown breakdown={size.breakdown} />
							</>
						)}
					</li>
					<li>
						Darkvision:{' '}
						{darkvision.status === 'unknown' ? (
							<UnresolvedValue reason={darkvision.reason} />
						) : (
							<>
								<span>{darkvision.value > 0 ? `${darkvision.value} ft.` : 'None'}</span>{' '}
								<ValueBreakdown breakdown={darkvision.breakdown} />
							</>
						)}
					</li>
				</ul>
			</section>

			<SensesList entries={combinedSenses} error={grantedSensesError} />

			<section className="sheet__hit-dice">
				<h2>Hit dice</h2>
				{hitDice.status === 'unknown' ? (
					<UnresolvedValue reason={hitDice.reason} />
				) : (
					<>
						<ul>
							{hitDice.value.map((entry, index) => (
								<li key={index}>
									{entry.count}d{entry.faces} ({entry.className})
								</li>
							))}
						</ul>
						<ValueBreakdown breakdown={hitDice.breakdown} />
					</>
				)}
			</section>

			<InventorySection
				inventory={character.inventory ?? []}
				currencyCopper={character.currencyCopper ?? 0}
				itemRefs={itemRefs}
				itemRefsError={itemRefsError}
				onEditInventory={onEditInventory}
				onEditCurrency={onEditCurrency}
			/>

			<section className="sheet__feats">
				<h2>Feats</h2>
				{chosenFeats.length === 0 ? (
					<p>No feats chosen yet.</p>
				) : (
					<ul>
						{chosenFeats.map((choice, index) => {
							const featText = featTextEntries.find((f) => f.name === choice.name && f.source === choice.source)
							return (
								<li key={index}>
									<details>
										<summary>
											{choice.name} (level {choice.level})
										</summary>
										{featText ? (
											<ResolvedEntries entries={featText.entries} data={resolverData} />
										) : (
											<UnresolvedValue reason={`No text found for feat "${choice.name}" (${choice.source}).`} />
										)}
									</details>
								</li>
							)
						})}
					</ul>
				)}
			</section>

			{/* The D21 class-feature choices, one row per chosen alternative naming the feature it replaces. Nothing renders at all when the character made none — no empty heading, same rule the sections around it follow, except when the load itself failed (D43). */}
			{(classFeatureChoices.length > 0 || classFeatureChoicesError) && (
				<section className="sheet__class-feature-choices">
					<h2>Class feature choices</h2>
					{classFeatureChoicesError && <p className="error">Could not load class feature choices: {classFeatureChoicesError}</p>}
					<ul>
						{classFeatureChoices.map((choice) => (
							<li key={`${choice.featureName}|${choice.optionName}`}>
								<details>
									<summary>
										{choice.optionName} — {choice.featureName} (level {choice.grantedAtLevel})
									</summary>
									{choice.found ? (
										<ResolvedEntries entries={choice.entries} data={resolverData} />
									) : (
										<UnresolvedValue reason={`No text found for "${choice.optionName}" (${choice.featureName}).`} />
									)}
								</details>
							</li>
						))}
					</ul>
				</section>
			)}

			{/* Headed generically: the progression's own name comes with the data that failed to load, so it isn't known here. */}
			{classOptionalFeaturesError && (
				<section className="sheet__class-optional-features">
					<h2>Class options</h2>
					<p className="error">Could not load the options chosen for your class: {classOptionalFeaturesError}</p>
				</section>
			)}

			{/* One section per granted featureType, headed by the progression's own name ("Eldritch Invocations", "Metamagic"). A character with no class-level picks renders nothing at all — no empty heading. */}
			{classOptionalFeatures.map((group) => (
				<section key={group.featureType} className="sheet__class-optional-features">
					<h2>{group.name ?? group.featureType}</h2>
					<ul>
						{group.options.map((option) => (
							<li key={`${option.name}|${option.source}`}>
								<details>
									<summary>{option.name}</summary>
									<ResolvedEntries entries={option.entries} data={resolverData} />
								</details>
							</li>
						))}
					</ul>
				</section>
			))}

			{isCaster && (
				<>
					{(spellcastingEntries.length > 0 || featSpellcastingEntries.length > 0) && (
						<section className="sheet__spell-attacks">
							<h2>Spellcasting</h2>
							<ul>
								{spellcastingEntries.map((entry) => (
									<li key={`${entry.className}|${entry.classSource}`}>
										<h3>
											{entry.className} ({ABILITY_LABELS[entry.ability]})
										</h3>
										<p>
											Spell attack bonus: <span>{formatModifier(entry.spellAttackBonus)}</span>{' '}
											<ValueBreakdown breakdown={entry.spellAttackBreakdown} />
										</p>
										<p>
											Spell save DC: <span>{entry.spellSaveDC}</span> <ValueBreakdown breakdown={entry.spellSaveDCBreakdown} />
										</p>
									</li>
								))}
								{featSpellcastingEntries.map((entry) => (
									<li key={`feat|${entry.featName}`}>
										<h3>
											{entry.featName} ({ABILITY_LABELS[entry.ability]})
										</h3>
										<p>
											Spell attack bonus: <span>{formatModifier(entry.spellAttackBonus)}</span>{' '}
											<ValueBreakdown breakdown={entry.spellAttackBreakdown} />
										</p>
										<p>
											Spell save DC: <span>{entry.spellSaveDC}</span> <ValueBreakdown breakdown={entry.spellSaveDCBreakdown} />
										</p>
									</li>
								))}
							</ul>
						</section>
					)}

					{spellSlotsEntries.length > 0 && (
						<section className="sheet__spell-slots">
							<h2>Spell slots</h2>
							<ul>
								{spellSlotsEntries.map((entry) => (
									<li key={`${entry.className}|${entry.classSource}`}>
										<h3>{entry.className}</h3>
										{entry.ordinarySlots && (
											<>
												<ul>
													{entry.ordinarySlots.map(
														(count, index) => count > 0 && <li key={index}>Level {index + 1}: {count}</li>,
													)}
												</ul>
												<ValueBreakdown breakdown={entry.ordinarySlotsBreakdown ?? []} />
											</>
										)}
										{entry.pactSlots && (
											<p>
												Pact Magic: {entry.pactSlots.count} slot{entry.pactSlots.count === 1 ? '' : 's'} (level {entry.pactSlots.slotLevel})
												<ValueBreakdown breakdown={entry.pactSlotsBreakdown ?? []} />
											</p>
										)}
									</li>
								))}
							</ul>
						</section>
					)}
				</>
			)}

			{/* The section appears for a failed grant load even with nothing to list — an empty spell list and a spell list that could not be built must not look alike (D43). */}
			{(combinedSpells.length > 0 || spellLoadErrors.length > 0) && (
				<section className="sheet__spells">
					<h2>Spells</h2>
					{spellLoadErrors.map((error) => (
						<p key={error.what} className="error">
							Could not load {error.what}: {error.message}
						</p>
					))}
					{combinedSpells.length > 0 && <SpellList entries={combinedSpells} spellDetails={spellDetails} resolverData={resolverData} />}
				</section>
			)}

			{/* The Beast forms a Druid knows for Wild Shape. Nothing renders for a character with none — no empty heading. Uses per rest and transforming are play tracking (step 9), not shown. */}
			{wildShapeForms.length > 0 && (
				<section className="sheet__wild-shape-forms">
					<h2>Wild Shape forms</h2>
					{/* The forms are listed from storage, so this section never vanished — but without this line every one of them reads "no stat block found", blaming the form for a failure of the whole fetch. */}
					{beastsError && <p className="error">Could not load Beast stat blocks: {beastsError}</p>}
					<ul>
						{wildShapeForms.map(({ form, beast }) => (
							<li key={`${form.name}|${form.source}`}>
								{beast ? (
									<BeastStatBlock beast={beast} />
								) : (
									// D43: a stored form whose stat block is missing is still listed, with the gap stated.
									<UnresolvedValue reason={`No stat block found for "${form.name}" (${form.source}).`} />
								)}
							</li>
						))}
					</ul>
				</section>
			)}

			{/*
			 * A failed beast load empties familiarForms, which would silently remove the section below — a character who
			 * knows the spell would look like one who doesn't (D43). This states the failure instead; it and the section
			 * below are mutually exclusive, since familiarForms is non-empty only when the load succeeded.
			 */}
			{knowsFindFamiliar && beastsError !== null && (
				<section className="sheet__familiar">
					<h2>Familiar</h2>
					<p className="error">Could not load the Beast forms a familiar can take: {beastsError}</p>
					{/* Named from storage rather than dropped — no form can be offered, but the player still sees what is on record. */}
					{storedFamiliar && (
						<p>
							Summoned form on record: {storedFamiliar.name} ({storedFamiliar.source}).
						</p>
					)}
				</section>
			)}

			{/* The familiar. Nothing renders for a character without the spell — no empty heading, same rule the sections above follow. With the spell but nothing chosen, the section says so rather than showing an empty list. */}
			{familiarForms.length > 0 && (
				<section className="sheet__familiar">
					<h2>Familiar</h2>

					{/*
					 * The one editable control on the sheet. It carries a full stat block per
					 * form (as the old "All eligible forms" list did) so a form can be compared
					 * before switching; each block is a default-collapsed <details>, and the
					 * list itself collapses once a familiar is chosen, so it stays out of the
					 * way of the summoned form shown below. Radio, so exactly one form (or none)
					 * is summoned — nothing about that changed with the control swap.
					 */}
					<SearchableOptionList
						legend="Familiar form"
						name="familiar-form"
						inputType="radio"
						options={familiarPickerOptions(familiarForms, storedFamiliar)}
						required={1}
						defaultOpen={storedFamiliar === null}
						renderCount={() =>
							storedFamiliar ? `Current form: ${storedFamiliar.name}` : 'No familiar summoned'
						}
						onToggle={(key) => {
							if (key === NO_FAMILIAR_KEY) {
								onChooseFamiliar?.(null)
								return
							}
							const picked = familiarForms.find((option) => formKey(option.beast) === key)
							if (picked) onChooseFamiliar?.({ name: picked.beast.name, source: picked.beast.source })
						}}
					/>

					{storedFamiliar === null ? (
						<p className="sheet__familiar-none">No familiar is summoned. Choose a form above to summon one.</p>
					) : chosenFamiliar ? (
						<>
							{chosenFamiliar.origin === 'pact-of-the-chain' && <p className="sheet__familiar-origin">Special form from Pact of the Chain.</p>}
							<BeastStatBlock beast={chosenFamiliar.beast} defaultOpen />
						</>
					) : (
						// D43: a stored form that is no longer offered (the invocation was dropped, or the data changed) is named, with the gap stated.
						<UnresolvedValue reason={`"${storedFamiliar.name}" (${storedFamiliar.source}) is not a form this familiar can take.`} />
					)}
				</section>
			)}
		</article>
	)
}

export default CharacterSheet
