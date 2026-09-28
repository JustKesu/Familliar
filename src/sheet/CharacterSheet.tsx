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

import { Fragment, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LevelUpButton } from '../levelUp/LevelUpButton'
import { RemoveLevelButton } from '../levelUp/RemoveLevelButton'
import { totalCharacterLevel } from '../levelUp/levelUpSteps'
import type { LevelGains } from '../levelUp/levelGains'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { familiarFormOptions, formKey, hasFindFamiliar, hasPactOfTheChain, loadBeasts, type Beast, type FamiliarFormOption } from '../beasts/beastData'
import { computeAbilityScores, type AbilityScoreValue } from '../calculation/abilityScores'
import { armourSpeedPenalty, computeArmourClass, type AcFormulaKey } from '../calculation/armourClass'
import { BASE_ATTUNEMENT_LIMIT, computeAttunementLimit, countAttuned } from '../calculation/attunement'
import { characterFeats, type FeatEffectEntry } from '../calculation/featEffects'
import { missingFeatSubChoices } from './featSubChoices'
import { resolveMagicBonus } from '../calculation/magicBonus'
import { computeHitDicePool, hitDiceKey, type ClassHitDie, type HitDiceEntry } from '../calculation/hitDice'
import { deathSavesAfterHitPointChange, describeDeathSaveRoll, type DeathSaveRollResult } from '../hitPoints/deathSaves'
import { applyHealing } from '../hitPoints/damageHealing'
import { computeMaxHitPoints } from '../calculation/maxHitPoints'
import { computeInitiative } from '../calculation/initiative'
import { flatBonusesByTarget } from '../calculation/itemFlatBonuses'
import { computeProficiencyBonus } from '../calculation/proficiencyBonus'
import { canSpendResource, freeCastResources, remainingUses, withFreeCastResources } from '../calculation/freeCastResources'
import { computeCharacterResources, shortRestRecovery, type ResourceFeature } from '../calculation/resources'
import { loadDataFile } from '../dataLoader/dataLoader'
import { toolsHeldElsewhere, type ProficiencyCategory } from '../calculation/proficiencies'
import { computeSavingThrows, type ClassSavingThrowProficiencies, type SavingThrowValue } from '../calculation/savingThrows'
import { computePassiveInsight, computePassiveInvestigation, computePassivePerception, computeSkills, SKILL_ABILITIES, SKILLS, type Skill, type SkillValue } from '../calculation/skills'
import { computeFeatSpellcasting, computeSpeciesSpellcasting, computeSpellcasting, type ClassSpellcastingAbility } from '../calculation/spellcasting'
import { computeSpellSlots, spellSlotMaxima, type ClassSpellSlotsData } from '../calculation/spellSlots'
import { computeSpellCounts, type ClassSpellCountData } from '../calculation/spellCounts'
import { loadSpellCountClassData } from '../spells/spellCountClassData'
import { highestSlotLevel } from '../spells/spellLevelFilter'
import { wildShapeLimits } from '../beasts/wildShapeData'
import { computeDarkvision, computeSize, computeSpeed, type GrantedDarkvision, type SpeciesTraitsData } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { computeAttacksPerAction, computeWeaponAttacks, damageText, type WeaponAttack } from '../calculation/weaponAttacks'
import {
	computeDamageResponses,
	damageResponseBreakdown,
	damageResponseKindLabel,
	damageTypeLabel,
	type DamageResponse,
	type DamageResponses,
} from '../calculation/damageResponses'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import {
	loadChosenClassOptionalFeatures,
	loadChosenOptionalFeatureOptions,
	type ChosenClassOptionalFeatureGroup,
	type OptionalFeatureOption,
} from '../optionalFeatures/optionalFeatureData'
import { loadChosenClassFeatureChoices, type ChosenClassFeatureChoice } from '../classFeatureChoices/classFeatureChoiceData'
import { loadFeatGrantedSpells, type FeatGrantedSpell } from '../spells/featSpells'
import { loadOptionalFeatureGrantedSpells, type OptionalFeatureGrantedSpell } from '../spells/optionalFeatureSpells'
import { loadRaceSpells, type RaceSpellGrants } from '../spells/raceSpells'
import { findSpellDetail, loadSpellDetails, type SpellDetail } from '../spells/spellDetailData'
import { BeastStatBlock } from './BeastStatBlock'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import { copperToCoins } from '../inventory/currency'
import {
	buildInventoryResolver,
	inventoryRowKey,
	itemMagicBonusOf,
	loadItemRefs,
	type ItemRef,
} from '../inventory/inventoryData'
import { ammoEntriesFor, autoSpendEntry, canSpendAmmo, spendAmmo, type AmmoEntry } from '../inventory/ammunition'
import { loadItemEntryTemplates, resolveItemEntryRefs, type ItemEntryTemplate } from '../inventory/itemEntryResolver'
import { buildEquippedGear, hasMageArmor, loadAcFormulaKeys } from './armourClassData'
import { buildItemFlatBonusGrants } from './itemFlatBonusData'
import { buildItemDarkvisionGrants, buildItemSpeedAdjustments } from './itemEffectData'
import { buildHeldWeapons, loadWeaponAttackData, type WeaponAttackData } from './weaponAttackData'
import { loadGrantedClassFeatures, type GrantedFeature } from './grantedClassFeatures'
import { buildItemGrants, loadDamageResponseData, type DamageResponseData } from './damageResponseData'
import { loadGrantedSenses, type GrantedSense } from './grantedSenses'
import { combineSenseEntries, SensesList } from './SensesList'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { dedupeAlwaysPreparedSpells, loadClassAlwaysPreparedSpells, loadSubclassAlwaysPreparedSpells, type AlwaysPreparedSpell } from '../spells/subclassPreparedSpells'
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
import { combineSpellEntries, provenanceLabel, SpellDetailBody } from './SpellList'
import {
	filterSpellsTabSections,
	ordinalLevel,
	sectionLabel,
	rowHitDc,
	shortCastingTime,
	spellEffect,
	spellNotes,
	spellsTabActionSections,
	spellsTabRowCaster,
	spellSubtitle,
	type SpellsTabActionRow,
	type SpellsTabActionSection,
	type SpellsTabFilter,
} from './spellsTabData'
import { featureActionRows, type FeatureActionData } from './featureActionRowData'
import { isScaledHealing, spellActionRows, spellGroupRows, type SpellActionData, type SpellCaster, type SpellGroupData } from './spellActionRowData'
import type { ActionType } from '../actions/actionTableFeatureData'
import { holdsTwoLightWeapons, loadCombatActions, visibleCombatActions, type CombatAction } from '../actions/combatActions'
import { formatRange, spellLevelLabel } from './spellFormatting'
import { FeatureLanguageSlots } from '../languages/FeatureLanguageSlots'
import { classFeatureLanguageGrantsFor } from '../languages/classFeatureLanguages'
import { ClassToolSlots } from '../toolProficiencies/ClassToolSlots'
import { classToolGrantsFor } from '../toolProficiencies/classToolChoices'
import {
	type Character,
	type CharacterFamiliar,
	type CharacterInventoryItem,
	type CharacterLanguage,
	type CharacterSpellChoice,
	type CharacterToolChoice,
	type SpentSpellSlots,
	type WeaponAttackAbility,
} from '../storage/character'
import { afterLongRest, afterShortRest } from '../rest/rest'
import { DamageRollButton, RollButton } from '../dice/RollButton'
import { addRollHistoryEntry, RollHistory, type RollHistoryEntry, type RollReport } from '../dice/RollHistory'
import { RollModeContext, RollsNavSlot, RollToast } from '../dice/RollUi'
import type { RollMode } from '../dice/roll'
import { parseDiceExpression, type DiceRoll } from '../dice/roll'
import type { CharacterTextField, HitPointFields, RestFields } from '../storage/characterStore'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'
import { CalculatedNumber, CalculatedValueOnly, formatModifier } from './calculatedValue'
import { ArmourClassNotes, FireIcon, formatSpeed, SheetHeader, type StatCard } from './SheetHeader'
import { AbilityModifierCards } from './AbilityModifierCards'
import { Drawer, DrawerSection } from './Drawer'
import { ClassSpellsManager } from './ManageSpellsPanel'
import { ItemDescription, itemValueText, ManageInventoryPanel } from './ManageInventoryPanel'
import { withClassPicks } from './manageSpellsData'
import { collectKnownSpells } from '../spells/knownSpells'
import { spellIdentityKey } from '../spells/subclassPreparedSpells'
import { HitPointsCard, HitPointsPanel, type HitPointProps } from './HitPoints'
import { loadSpeciesTraits, speciesTraitsAtLevel, type SpeciesTrait } from './speciesTraitNames'
import { featuresTabGroups, type FeatureTabGroup, type FeatureTabGroupKind, type FeatureTabOption } from './featuresTabData'

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

/*
 * Sheet rebuild slice 2: the flat section list is grouped into tabs. Rework
 * R3 (D123) dissolves the 'stats' tab into the left column, leaving five.
 * R3b applies D148 (English tab labels) and the planned order; ids stay as
 * they are since tests hook them.
 */
type SheetTabId = 'spells' | 'inventory' | 'features' | 'actions' | 'notes'

const SHEET_TABS: readonly { id: SheetTabId; label: string }[] = [
	{ id: 'actions', label: 'Actions' },
	{ id: 'spells', label: 'Spells' },
	{ id: 'inventory', label: 'Inventory' },
	{ id: 'features', label: 'Features & Traits' },
	{ id: 'notes', label: 'Notes' },
]

/** The Notes tab's sections (slice 9d2), in display order — each one Character field. */
const TEXT_SECTIONS: readonly { field: CharacterTextField; label: string }[] = [
	{ field: 'appearance', label: 'Vzhled' },
	{ field: 'backstory', label: 'Příběh' },
	{ field: 'notes', label: 'Poznámky' },
]

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** What the drawer is showing, if anything (D163). UI state only — never stored, never in the URL. */
type DrawerContent =
	| { kind: 'senses' }
	| { kind: 'ability'; ability: Ability }
	| { kind: 'rolls' }
	| { kind: 'save'; ability: Ability }
	| { kind: 'skill'; skill: Skill }
	| { kind: 'saves' }
	| { kind: 'skills' }
	| { kind: 'proficiencies' }
	| { kind: 'stat'; stat: StatCard }
	| { kind: 'hitPoints' }
	| { kind: 'shortRest' }
	| { kind: 'defenses' }
	| { kind: 'action'; key: string }
	| { kind: 'attacksPerAction' }
	| { kind: 'spellcasting'; key: string; part: 'attack' | 'dc' }
	| { kind: 'spellSlots' }
	| { kind: 'manageSpells' }
	| { kind: 'manageInventory' }

const PROFICIENCY_ROWS: [ProficiencyCategory, string][] = [
	['armor', 'Armor'],
	['weapons', 'Weapons'],
	['tools', 'Tools'],
	['languages', 'Languages'],
]

/** D45: the dot per proficiency status; half and expertise keep their own symbols. */
function ProfMark({ mark, status }: { mark: string; status: string }): ReactNode {
	return (
		<span className="sheet__prof-mark" data-status={status}>
			{mark}
		</span>
	)
}

/** One row's value and its breakdown, open — the drawer's view of a save or skill (D166). */
function RowBreakdown({ result }: { result: Calculated<{ modifier: number }> }): ReactNode {
	if (result.status === 'unknown') return <UnresolvedValue reason={result.reason} />
	return (
		<>
			<p className="drawer__value">{formatModifier(result.value.modifier)}</p>
			<ValueBreakdown breakdown={result.breakdown} open />
		</>
	)
}

/** D133: details hide behind a gear, not behind new controls on the sheet. Stroke only, so it takes the button's own colour. */
function GearIcon(): ReactNode {
	return (
		<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="8" cy="8" r="2.4" />
			<path d="M8 1.6v1.7M8 12.7v1.7M1.6 8h1.7M12.7 8h1.7M3.5 3.5l1.2 1.2M11.3 11.3l1.2 1.2M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2" />
		</svg>
	)
}

/**
 * The ability SCORE breakdown the retired stats tab showed (D154), back in the
 * drawer (D146/D163). Same Calculated value, same Contribution list, same
 * renderer — only the place it is read in changed.
 */
function AbilityScorePanel({ result }: { result: Calculated<AbilityScoreValue> }): ReactNode {
	if (result.status === 'unknown') return <UnresolvedValue reason={result.reason} />
	return (
		<>
			<p className="drawer__value">
				{result.value.score} ({formatModifier(result.value.modifier)})
			</p>
			<ValueBreakdown breakdown={result.breakdown} open />
		</>
	)
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

/**
 * Inventory and money (build order step 7, slice a1). Read-only since R10a:
 * every edit lives in the Manage Inventory drawer (ManageInventoryPanel.tsx).
 *
 * An empty inventory is a normal state, shown as a plain line — never an
 * error (contrast itemRefsError, which is the item DATA failing to load, D43).
 * A stored item whose (name, source) isn't in the loaded list is kept and
 * shown with a note, never dropped (D43).
 *
 * Slice e2a: a row carrying its own definition resolves against that instead of
 * items.json, through the same resolver every other consumer uses, so it takes
 * part in quantity, equipping, attunement, the magic bonus and the name label
 * without a second code path.
 */
function InventorySection({
	inventory,
	currencyCopper,
	itemRefs,
	itemRefsError,
	itemEntryTemplates,
	attunementLimit,
	onManageInventory,
}: {
	inventory: CharacterInventoryItem[]
	currencyCopper: number
	itemRefs: ItemRef[] | null
	itemRefsError: string | null
	itemEntryTemplates: ItemEntryTemplate[]
	attunementLimit: Calculated<number>
	/** R10a: opens the Manage Inventory drawer; absent on a read-only sheet. */
	onManageInventory?: () => void
}): ReactNode {
	const resolve = buildInventoryResolver(itemRefs ?? [])
	const coins = copperToCoins(currencyCopper)
	const attunedCount = countAttuned(inventory)
	const limit = attunementLimit.status === 'known' ? attunementLimit.value : BASE_ATTUNEMENT_LIMIT

	return (
		<section className="sheet__inventory">
			{onManageInventory && (
				<div className="sheet__actions-toolbar">
					<button type="button" className="sheet__manage-spells" onClick={onManageInventory}>
						Manage Inventory
					</button>
				</div>
			)}
			<h2>Inventory</h2>

			<div className="sheet__currency">
				<h3>Money</h3>
				<p>
					{coins.gp} gp, {coins.sp} sp, {coins.cp} cp
				</p>
			</div>

			{/* The count is plain text, not behind the breakdown: how many slots are spent has to be readable without opening anything (this slice's brief). */}
			<div className="sheet__attunement">
				<h3>Attunement</h3>
				<div className="sheet__attunement-count">
					<span>
						{attunedCount} of {limit} attuned
					</span>{' '}
					{attunementLimit.status === 'known' && <ValueBreakdown breakdown={attunementLimit.breakdown} />}
				</div>
			</div>

			{itemRefsError && <p className="error">Could not load the item list: {itemRefsError}</p>}

			{inventory.length === 0 ? (
				<p className="sheet__inventory-empty">Nothing carried yet.</p>
			) : (
				<ul className="sheet__inventory-list">
					{inventory.map((item, index) => {
						const { ref, problem } = resolve(item)
						/*
						 * A missing items.json entry is only a problem once the file has
						 * loaded; a broken custom definition is one either way, since
						 * nothing about it depends on that file (slice e2a).
						 */
						const showProblem = problem !== null && (problem.kind === 'malformed-custom' || (itemRefs !== null && itemRefsError === null))
						/* Slice e: one place computes the displayed name, so the AC breakdown and the attacks section call this sword the same thing. */
						const bonus = resolveMagicBonus({
							name: item.name,
							itemBonus: ref ? itemMagicBonusOf(ref) : null,
							playerBonus: item.magicBonus ?? null,
							requiresAttunement: ref?.requiresAttunement === true,
							attuned: item.attuned === true,
						})
						// Two rows can legitimately end up identical (the same item set to the same bonus twice), so the position keeps the key unique.
						return (
							<li key={`${inventoryRowKey(item)}#${index}`}>
								<span>{bonus.label}</span>
								{item.custom !== undefined && <span className="sheet__inventory-custom"> (custom)</span>}
								{ref?.value !== undefined && <span className="sheet__inventory-value"> {itemValueText(ref.value)}</span>}
								{item.equipped && <span className="sheet__inventory-equipped"> ({item.equipped})</span>}
								{item.attuned && <span className="sheet__inventory-attuned"> (attuned)</span>}
								{ref?.requiresAttunement && (
									<span className="sheet__attunement-requirement">
										{' '}
										{/* The condition is printed verbatim as items.json writes it — the app never reads it (D21). */}
										Requires attunement{ref.attunementCondition ? ` ${ref.attunementCondition}` : ''}
									</span>
								)}
								{showProblem && (
									<>
										{' '}
										<UnresolvedValue reason={problem!.message} />
									</>
								)}
								<> ×{item.quantity}</>
								{/* Absent text is not an error: an item with no description gets no section at all, and an unresolvable row already carries its own note (D43).
								    resolveItemEntryRefs fills any {#itemEntry ...} reference from the shared templates before <Entries> — the one brace shape the markup renderer does not know. */}
								{ref?.entries && (
									<ItemDescription entries={resolveItemEntryRefs(ref.entries, ref, itemEntryTemplates)} label={bonus.label} />
								)}
							</li>
						)
					})}
				</ul>
			)}

		</section>
	)
}

/**
 * One row of the actions table (sheet rebuild slice 3). The five cells ARE the
 * columns — Name, Range, To Hit, Damage, Notes — each an arbitrary node so a
 * later row type fills only what it has: slice 4's save spell puts a DC where a
 * weapon shows a to-hit, slice 5's usable feature leaves Range and Damage null.
 * `null` renders an empty cell. Adding those row types is a new builder like
 * `weaponAttackRow` below plus more `.map`s in `ActionsSection` — never a change
 * to this shape or the table.
 */
interface ActionTableRow {
	key: string
	name: ReactNode
	range: ReactNode
	toHit: ReactNode
	damage: ReactNode
	notes: ReactNode
}

/**
 * A held weapon (or the Unarmed Strike) as an actions-table row. Presentation
 * only — every value comes straight from computeWeaponAttacks (build order step
 * 7 slice c), unchanged by this slice.
 */
const WEAPON_KIND_LABELS: Record<NonNullable<WeaponAttack['kind']>, string> = {
	melee: 'Melee Weapon',
	ranged: 'Ranged Weapon',
	unarmed: 'Unarmed',
}

/** R5a (D166's pattern): the row's name opens its breakdown in the drawer; the values beside it are roll buttons. */
function ActionNameButton({ name, onOpen }: { name: string; onOpen?: () => void }): ReactNode {
	return (
		<button type="button" className="sheet__action-name" aria-label={`${name} breakdown`} onClick={onOpen}>
			{name}
		</button>
	)
}

function weaponAttackRow(
	attack: WeaponAttack,
	onRoll: (report: RollReport) => void,
	onOpenBreakdown?: () => void,
	onChooseAttackAbility?: (key: string, ability: WeaponAttackAbility) => void,
	ammo?: { entries: AmmoEntry[]; onSpend?: (entry: AmmoEntry) => void },
): ActionTableRow {
	const damageDice = attack.damage.status === 'known' && attack.damage.value.dice ? parseDiceExpression(attack.damage.value.dice) : null
	/* Slice 9d4: the to-hit roll (and only it) spends the weapon's one unambiguous ammunition, through the same onSpend as the manual −1. */
	const onSpend = ammo?.onSpend
	const autoSpend = ammo && onSpend ? autoSpendEntry(ammo.entries) : null
	const onToHitRoll = (report: RollReport): void => {
		onRoll(report)
		if (autoSpend && onSpend) onSpend(autoSpend)
	}
	return {
		key: attack.key,
		name: (
			<>
				<ActionNameButton name={attack.name} onOpen={onOpenBreakdown} />
				{attack.kind && <span className="sheet__action-subtitle">{WEAPON_KIND_LABELS[attack.kind]}</span>}
				{attack.abilityChoice && onChooseAttackAbility && (
					<label className="sheet__action-ability">
						Attack with{' '}
						<select
							aria-label={`Attack ability for ${attack.name}`}
							value={attack.abilityChoice.using}
							onChange={(event) => onChooseAttackAbility(attack.key, event.target.value as WeaponAttackAbility)}
						>
							{attack.abilityChoice.options.map((option) => (
								<option key={option} value={option}>
									{ABILITY_LABELS[option]}
								</option>
							))}
						</select>
					</label>
				)}
			</>
		),
		/* Range is printed as the data writes it ("30/120"); a plain melee weapon carries none. */
		range: attack.range ? `${attack.range} ft.` : null,
		toHit:
			attack.toHit.status === 'unknown' ? (
				<UnresolvedValue reason={attack.toHit.reason} />
			) : (
				<RollButton modifier={attack.toHit.value} label={`${attack.name} to hit`} onRoll={onToHitRoll}>
					{formatModifier(attack.toHit.value)}
				</RollButton>
			),
		damage:
			attack.damage.status === 'unknown' ? (
				<UnresolvedValue reason={attack.damage.reason} />
			) : (
				<>
					<span className="sheet__action-damage">
						{/* A null dice is a flat amount (Unarmed Strike without a Martial Arts die): nothing random to roll. */}
						{damageDice ? (
							<DamageRollButton
								count={damageDice.count}
								sides={damageDice.sides}
								modifier={attack.damage.value.modifier}
								label={`${attack.name} damage`}
								onRoll={onRoll}
							>
								{damageText(attack.damage.value.dice, attack.damage.value.modifier, '')}
							</DamageRollButton>
						) : (
							<span className="sheet__action-flat">{damageText(attack.damage.value.dice, attack.damage.value.modifier, '')}</span>
						)}
						{attack.damage.value.damageType && (
							<>
								{' '}
								<span className="sheet__action-damage-type">{attack.damage.value.damageType}</span>
							</>
						)}
					</span>
					{/* The die above already follows the grip; this says which grip that was (slice b-fix). */}
					{attack.damage.value.grip && (
						<span className="sheet__action-versatile">Versatile — held in {attack.damage.value.grip === 'two-handed' ? 'two hands' : 'one hand'}</span>
					)}
				</>
			),
		notes: ammo ? (
			<>
				{attack.notes.length > 0 && <>{attack.notes.join(' · ')} </>}
				<AmmoTracker weapon={attack.name} entries={ammo.entries} onSpend={ammo.onSpend} />
			</>
		) : attack.notes.length > 0 ? (
			attack.notes.join(' · ')
		) : null,
	}
}

/**
 * The ammunition a held weapon fires (slice 9d3): one line per matching
 * inventory row, each with its own count and a quick "spend one". Nothing is
 * stored here — the count IS the inventory row's quantity, so the Inventář tab
 * reads the same number. Without an edit callback the counts still show.
 */
function AmmoTracker({ weapon, entries, onSpend }: { weapon: string; entries: AmmoEntry[]; onSpend?: (entry: AmmoEntry) => void }): ReactNode {
	return (
		<span className="sheet__action-ammo">
			{entries.map((entry) => (
				<span key={`${entry.kind}#${entry.index}`} className="sheet__action-ammo-item" role="group" aria-label={`${entry.name} ammunition for ${weapon}`}>
					{entry.name}: {entry.quantity}
					{/* A pack's number counts packs, not pieces — "1" beside "Arrows (20)" would otherwise read as one arrow. */}
					{entry.kind === 'pack' && (entry.quantity === 1 ? ' pack' : ' packs')}
					{onSpend && (
						<>
							{' '}
							<button
								type="button"
								disabled={!canSpendAmmo(entry)}
								onClick={() => onSpend(entry)}
								aria-label={entry.kind === 'pack' && entry.looseItem ? `Spend one ${entry.looseItem.name} from ${entry.name}` : `Spend one ${entry.name}`}
							>
								−1
							</button>
						</>
					)}{' '}
				</span>
			))}
		</span>
	)
}

/**
 * A spell with an attack roll or a saving throw as an actions-table row (sheet
 * rebuild slice 4). Presentation only: which spells qualify and what their
 * cells hold is spellActionRowData.ts, and the numbers are the same ones the
 * Kouzla tab's Spellcasting section prints.
 *
 * The Damage cell is empty for most spells on purpose — outside cantrip
 * `scalingLevelDice` the dice live only in prose, which D21 does not parse.
 * Notes is empty for every spell row for the same reason ("half on a save" is
 * prose, not a flag).
 */
/** "2d10 fire damage" / "1d4 + 1": the dice are the roll button, a trailing label stays text; anything else ("2d8 + 1d6") is only text (D206). D207: a scaled-healing spell's roll is labelled "healing", not "damage". */
function SpellDamageLine({ line, spellName, healing, onRoll }: { line: string; spellName: string; healing?: boolean; onRoll: (report: RollReport) => void }): ReactNode {
	const match = /^(\d+)d(\d+)(?:\s*\+\s*(\d+))?(?: ([A-Za-z].*))?$/.exec(line)
	if (!match || Number(match[1]) === 0) return <span>{line}</span>
	const label = match[4]
	return (
		<span>
			<DamageRollButton count={Number(match[1])} sides={Number(match[2])} modifier={Number(match[3] ?? 0)} label={`${spellName} ${healing ? 'healing' : 'damage'}`} onRoll={onRoll}>
				{label === undefined ? line : line.slice(0, -label.length - 1)}
			</DamageRollButton>
			{label !== undefined && <span className="sheet__action-damage-type"> {label}</span>}
		</span>
	)
}

function spellActionRow(spell: SpellActionData, onRoll: (report: RollReport) => void, onOpenBreakdown?: () => void): ActionTableRow {
	return {
		key: `spell|${spell.key}`,
		name: (
			<>
				<ActionNameButton name={spell.name} onOpen={onOpenBreakdown} />
				{/* The same level wording the Spells tab uses (SpellList.tsx) — the table has no level grouping to carry it instead. */}
				<span className="sheet__action-subtitle">
					{spellLevelLabel(spell.level)}
					{spell.concentration && ' · Concentration'}
					{spell.ritual && ' · Ritual'}
				</span>
			</>
		),
		range: spell.range,
		toHit: spell.unresolved ? (
			<UnresolvedValue reason={spell.unresolved} />
		) : (
			<>
				{spell.attack && (
					<RollButton modifier={spell.attack.bonus} label={`${spell.name} spell attack`} onRoll={onRoll}>
						{formatModifier(spell.attack.bonus)}
					</RollButton>
				)}
				{/* 5 spells carry an attack roll AND a save (spellActionRowData.ts) — both are shown, stacked, neither replaces the other. */}
				{spell.save && (
					<span className="sheet__action-dc">
						DC {spell.save.dc} {spell.save.abilities.map((ability) => ability.slice(0, 3).toUpperCase()).join('/')}
					</span>
				)}
			</>
		),
		damage:
			spell.damage.length > 0 ? (
				<span className="sheet__action-damage sheet__action-damage--lines">
					{spell.damage.map((line, index) => (
						<SpellDamageLine key={index} line={line} spellName={spell.name} onRoll={onRoll} />
					))}
				</span>
			) : null,
		notes: null,
	}
}

/**
 * A feature resource's uses on its Actions row (D182): one box per use up to 10,
 * filled from the left by the spent count; a bigger pool (Lay on Hands, Sorcery
 * Points) is a spent / max counter. Same `play.resourceUses` record as ever.
 */
function UseBoxes({ name, spent, max, recharge, onChange }: { name: string; spent: number; max: number; recharge: string | undefined; onChange?: (delta: 1 | -1) => void }): ReactNode {
	return (
		<span className="sheet__use-boxes" role="group" aria-label={`${name} uses`}>
			{max <= 10 ? (
				Array.from({ length: max }, (_, index) => {
					const used = index < spent
					return (
						<button
							key={index}
							type="button"
							className={used ? 'sheet__use-box sheet__use-box--used' : 'sheet__use-box'}
							aria-label={used ? `Undo a use of ${name}` : `Use ${name}`}
							aria-pressed={used}
							disabled={!onChange}
							onClick={() => onChange?.(used ? -1 : 1)}
						/>
					)
				})
			) : (
				<span className="sheet__use-counter">
					<button type="button" disabled={!onChange || spent <= 0} onClick={() => onChange?.(-1)} aria-label={`Undo a use of ${name}`}>
						−
					</button>
					{spent} / {max}
					<button type="button" disabled={!onChange || spent >= max} onClick={() => onChange?.(1)} aria-label={`Use ${name}`}>
						+
					</button>
				</span>
			)}
			{recharge && <span className="sheet__use-recharge">/ {recharge}</span>}
		</span>
	)
}

/** One collapsible Actions-group row (D182): ▸ name source … uses, the full text below when open. Open state is this row's own UI state (D116). */
function ActionGroupRow({ name, source, uses, below, children }: { name: string; source: string | null; uses?: ReactNode; below?: ReactNode; children: ReactNode }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="sheet__action-row sheet__group-row">
			<div className="sheet__group-row-line">
				<button type="button" className="sheet__group-row-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
					<span className="sheet__group-row-arrow" aria-hidden="true">
						{open ? '▾' : '▸'}
					</span>
					<span className="sheet__action-name sheet__group-row-name">{name}</span>
				</button>
				{source && <span className="sheet__feature-origin sheet__group-row-source">{source}</span>}
				<span className="sheet__group-row-spacer" />
				{uses}
			</div>
			{below}
			{open && <div className="sheet__group-row-text">{children}</div>}
		</li>
	)
}

/** D187: a group's Actions in Combat as one line of names; a name opens its text under the line, at most one at a time. */
function CombatActionsLine({ actions, resolverData }: { actions: CombatAction[]; resolverData: ResolverData }): ReactNode {
	const [openName, setOpenName] = useState<string | null>(null)
	const open = actions.find((action) => action.name === openName)
	return (
		<div className="sheet__combat-actions">
			<p className="sheet__combat-actions-line">
				<span className="sheet__combat-actions-label">Actions in Combat:</span>{' '}
				{actions.map((action, index) => (
					<Fragment key={action.name}>
						{index > 0 && <span className="sheet__combat-actions-sep"> · </span>}
						<button
							type="button"
							className={action === open ? 'sheet__combat-action sheet__combat-action--open' : 'sheet__combat-action'}
							aria-expanded={action === open}
							onClick={() => setOpenName(action === open ? null : action.name)}
						>
							{action.name}
						</button>
					</Fragment>
				))}
			</p>
			{open && (
				<div className="sheet__combat-action-text">
					<h4>{open.name}</h4>
					<ResolvedEntries entries={open.entries} data={resolverData} />
				</div>
			)}
		</div>
	)
}

type ActionFilter = 'all' | 'attack' | ActionType

const ACTION_FILTERS: readonly { id: ActionFilter; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'attack', label: 'Attack' },
	{ id: 'action', label: 'Action' },
	{ id: 'bonus', label: 'Bonus Action' },
	{ id: 'reaction', label: 'Reaction' },
	{ id: 'other', label: 'Other' },
]

const ACTION_GROUPS: readonly { id: ActionType; label: string }[] = [
	{ id: 'action', label: 'Action' },
	{ id: 'bonus', label: 'Bonus Action' },
	{ id: 'reaction', label: 'Reaction' },
	{ id: 'other', label: 'Other' },
]

/**
 * The Actions tab (sheet rebuild slice 3, restyled by R5a). The attack table
 * holds the weapons the character is HOLDING plus the Unarmed Strike everyone
 * has (build order step 7 slice c) and — slice 4 — every spell they have
 * access to that carries an attack roll or a saving throw. Usable features
 * (slice 5 part A) and bonus-action/reaction spells sit in R5c's groups under
 * it, Action / Bonus Action / Reaction / Other (D182).
 *
 * Attacks per action (Extra Attack) is a property of the character's turn, not
 * of any one row, so it stays a summary beside the filters.
 */
function ActionsSection({
	attacks,
	attacksPerAction,
	spellActions,
	featureActions,
	spellGroups,
	combatActions,
	resourceMaxima,
	resourceRecharge,
	resourceUses,
	resolverData,
	loading,
	dataError,
	onRoll,
	onOpenBreakdown,
	onOpenAttacksPerAction,
	onChooseAttackAbility,
	onSpendResource,
	ammoFor,
	onSpendAmmo,
}: {
	attacks: WeaponAttack[]
	attacksPerAction: Calculated<number>
	spellActions: SpellActionData[]
	featureActions: FeatureActionData[]
	spellGroups: SpellGroupData[]
	/** D187: the actions.json entries shown, already without a Two-Weapon Fighting the character cannot take. */
	combatActions: CombatAction[]
	/** The 8 resources with a computed maximum, resolved name to that maximum (slice 9b2) — the ~90 "not in data" resources are absent, so their rows below never look them up successfully. */
	resourceMaxima: ReadonlyMap<string, number>
	/** The rest that gives a resource back, as the rest logic (9b5) reads it. */
	resourceRecharge: ReadonlyMap<string, string>
	/** Character.play.resourceUses, or {} for a character who has spent nothing yet. */
	resourceUses: Record<string, number>
	resolverData: ResolverData
	loading: boolean
	dataError: string | null
	onRoll: (report: RollReport) => void
	/** Opens a row's to-hit/damage (or spell attack/DC) breakdown in the drawer, by the row's key (D166's pattern). */
	onOpenBreakdown?: (key: string) => void
	onOpenAttacksPerAction?: () => void
	onChooseAttackAbility?: (key: string, ability: WeaponAttackAbility) => void
	onSpendResource?: (name: string, delta: 1 | -1) => void
	/** The inventory rows that feed a weapon firing this ammoType (slice 9d3). */
	ammoFor: (ammoType: string) => AmmoEntry[]
	onSpendAmmo?: (entry: AmmoEntry) => void
}): ReactNode {
	/* D116/R5a: which rows show is UI state of this tab only, never written to the character. */
	const [filter, setFilter] = useState<ActionFilter>('all')
	const open = (key: string) => (onOpenBreakdown ? () => onOpenBreakdown(key) : undefined)
	const rows = [
		...attacks.map((attack) =>
			weaponAttackRow(
				attack,
				onRoll,
				open(attack.key),
				onChooseAttackAbility,
				attack.ammoType !== undefined ? { entries: ammoFor(attack.ammoType), onSpend: onSpendAmmo } : undefined,
			),
		),
		...spellActions.map((spell) => spellActionRow(spell, onRoll, open(`spell|${spell.key}`))),
	]
	const showTable = filter === 'all' || filter === 'attack' || filter === 'action'
	const groups = ACTION_GROUPS.filter((group) => filter === 'all' || filter === group.id).map((group) => ({
		...group,
		features: featureActions.filter((feature) => feature.actionType === group.id),
		spells: spellGroups.filter((spell) => spell.actionType === group.id),
		combat: combatActions.filter((action) => action.group === group.id),
	}))
	const hasRows = (group: (typeof groups)[number]) => group.features.length > 0 || group.spells.length > 0 || group.combat.length > 0
	const filteredGroupEmpty = filter !== 'all' && filter !== 'attack' && !groups.some(hasRows)
	return (
		<section className="sheet__actions">
			<div className="sheet__actions-toolbar">
				<div className="sheet__actions-filters" role="group" aria-label="Filter actions">
					{ACTION_FILTERS.map(({ id, label }) => (
						<button key={id} type="button" className={filter === id ? 'pill pill--active' : 'pill'} aria-pressed={filter === id} onClick={() => setFilter(id)}>
							{label}
						</button>
					))}
				</div>
				<div className="sheet__actions-per-action">
					<button type="button" className="sheet__actions-per-action-label" aria-label="Attacks per Action breakdown" onClick={onOpenAttacksPerAction}>
						Attacks per Action:
					</button>{' '}
					<strong>
						<CalculatedValueOnly result={attacksPerAction} />
					</strong>
				</div>
			</div>
			{dataError && <p className="error">Could not load the weapon data this section needs: {dataError}</p>}
			{!showTable ? null : loading ? (
				<p>Loading…</p>
			) : (
				<table className="sheet__actions-table">
					<thead>
						<tr>
							<th scope="col">Attack</th>
							<th scope="col">Range</th>
							{/* Widened by slice 4: a weapon puts a to-hit here, a save spell a DC, and 5 spells put both. */}
							<th scope="col">Hit / DC</th>
							<th scope="col">Damage</th>
							<th scope="col">Notes</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => (
							<tr key={`${row.key}#${index}`} className="sheet__action-row">
								<th scope="row" className="sheet__action-name-cell">
									{row.name}
								</th>
								<td className="sheet__action-range">{row.range}</td>
								<td className="sheet__action-to-hit">{row.toHit}</td>
								<td className="sheet__action-damage-cell">{row.damage}</td>
								<td className="sheet__action-notes">{row.notes}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{groups.map(
				(group) =>
					hasRows(group) && (
						<section key={group.id} className="sheet__action-group" aria-label={group.label}>
							<h3>{group.label}</h3>
							<ul>
								{group.features.map((feature) => {
									const max = resourceMaxima.get(feature.resourceName)
									return (
										<ActionGroupRow
											key={feature.key}
											name={feature.name}
											source={feature.origin}
											uses={
												max !== undefined && (
													<UseBoxes
														name={feature.resourceName}
														spent={resourceUses[feature.resourceName] ?? 0}
														max={max}
														recharge={resourceRecharge.get(feature.resourceName)}
														onChange={onSpendResource ? (delta) => onSpendResource(feature.resourceName, delta) : undefined}
													/>
												)
											}
										>
											<ResolvedEntries entries={feature.entries} data={resolverData} />
										</ActionGroupRow>
									)
								})}
								{group.spells.map((spell) => (
									<ActionGroupRow key={`spell|${spell.key}`} name={spell.entry.name} source={`Spell · ${spellLevelLabel(spell.detail.level)} · ${provenanceLabel(spell.entry)}`}>
										<SpellDetailBody detail={spell.detail} resolverData={resolverData} />
									</ActionGroupRow>
								))}
							</ul>
							{group.combat.length > 0 && <CombatActionsLine actions={group.combat} resolverData={resolverData} />}
						</section>
					),
			)}
			{filteredGroupEmpty && <p className="sheet__action-group-empty">Nothing here for this character.</p>}
		</section>
	)
}

/** One spell row of the Spells tab (R7a/R7b, D189/D191): CAST / USE / label, name, time, range, hit/DC, effect, notes (a USE row's counter first); the text below when open. */
function SpellTabRow({
	row,
	section,
	castingClassName,
	caster,
	characterLevel,
	slotsLeft,
	concentrating,
	resolverData,
	resourceUses,
	resourceMaxima,
	resourceRecharge,
	onRoll,
	onCast,
	onUse,
	onSpendResource,
	onToggleConcentration,
}: {
	row: SpellsTabActionRow
	section: SpellsTabActionSection
	castingClassName: string | null
	caster: SpellCaster
	characterLevel: number
	/** In the pool CAST spends from; 0 when the section has no slots. */
	slotsLeft: number
	concentrating: boolean
	resolverData: ResolverData
	resourceUses: Record<string, number>
	resourceMaxima: ReadonlyMap<string, number>
	resourceRecharge: ReadonlyMap<string, string>
	onRoll: (report: RollReport) => void
	onCast?: (row: SpellsTabActionRow, section: SpellsTabActionSection) => void
	onUse?: (row: SpellsTabActionRow) => void
	onSpendResource?: (name: string, delta: 1 | -1) => void
	onToggleConcentration?: (spellName: string) => void
}): ReactNode {
	/* D116: open state is this row's own UI state. */
	const [open, setOpen] = useState(false)
	const { entry, detail, action } = row
	// D206: a CAST row is worked out at its section's slot level (a D189 pact row too), every other row at the spell's own.
	const effect = detail ? spellEffect(detail, characterLevel, action.kind === 'cast' && typeof section.key === 'number' ? section.key : detail.level) : null
	const hitDc = detail ? rowHitDc(detail, caster) : null
	let use: ReactNode = null
	let counter: ReactNode = null
	if (action.kind === 'cast') {
		if (onCast) {
			use = (
				<button type="button" className="btn--accent-outline sheet__spell-cast" aria-label={`Cast ${entry.name}`} disabled={slotsLeft <= 0} onClick={() => onCast(row, section)}>
					Cast
				</button>
			)
		}
	} else if (action.kind === 'use') {
		const spent = resourceUses[action.counterKey] ?? 0
		const max = resourceMaxima.get(action.counterKey)
		if (onUse) {
			use = (
				<button type="button" className="btn--accent-outline sheet__spell-cast" aria-label={`Use ${entry.name}`} disabled={!canSpendResource(max, spent, action.cost)} onClick={() => onUse(row)}>
					Use
				</button>
			)
		}
		if (max === undefined) counter = <UnresolvedValue reason="The number of uses is not known yet." />
		else if (action.grant.usage?.kind === 'resource') {
			counter = (
				<span className="sheet__spell-counter">
					{action.counterKey} {remainingUses(max, spent)} / {max}
				</span>
			)
		} else {
			counter = (
				<span className="sheet__spell-counter">
					<UseBoxes
						name={action.counterKey.startsWith('spell:') ? `${entry.name} free cast` : action.counterKey}
						spent={spent}
						max={max}
						recharge={resourceRecharge.get(action.counterKey)}
						onChange={onSpendResource ? (delta) => onSpendResource(action.counterKey, delta) : undefined}
					/>
				</span>
			)
		}
	} else if (action.label !== '') {
		use = <span className={detail?.level === 0 ? 'sheet__spell-use-label' : 'sheet__spell-use-label sheet__spell-use-label--usage'}>{action.label}</span>
	}
	return (
		<li className={`sheet__spell-row sheet__spell-row--${action.kind}`}>
			<div className="sheet__spell-use">{use}</div>
			<div className="sheet__spell-name-cell">
				<span className="sheet__spell-name-line">
					<button type="button" className="sheet__group-row-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
						<span className="sheet__group-row-arrow" aria-hidden="true">
							{open ? '▾' : '▸'}
						</span>
						<span className="sheet__spell-name">{entry.name}</span>
					</button>
					{row.badgeLevel !== null && <span className="sheet__spell-badge">{ordinalLevel(row.badgeLevel)}</span>}
				</span>
				<span className="sheet__action-subtitle">{spellSubtitle(row, castingClassName)}</span>
			</div>
			{detail ? (
				<>
					<div className="sheet__spell-cell">{shortCastingTime(detail)}</div>
					<div className="sheet__spell-cell">{formatRange(detail.range)}</div>
					<div className="sheet__action-to-hit">
						{hitDc?.unresolved ? (
							<UnresolvedValue reason={hitDc.unresolved} />
						) : (
							<>
								{hitDc?.attack && (
									<RollButton modifier={hitDc.attack.bonus} label={`${entry.name} spell attack`} onRoll={onRoll}>
										{formatModifier(hitDc.attack.bonus)}
									</RollButton>
								)}
								{hitDc?.save && (
									<span className="sheet__action-dc">
										DC {hitDc.save.dc} {hitDc.save.abilities.map((ability) => ability.slice(0, 3).toUpperCase()).join('/')}
									</span>
								)}
							</>
						)}
					</div>
					<div className="sheet__spell-effect">
						{effect && effect.dice.length > 0 && (
							<span className="sheet__action-damage sheet__action-damage--lines">
								{effect.dice.map((line, index) => (
									<SpellDamageLine key={index} line={line} spellName={entry.name} healing={isScaledHealing(detail)} onRoll={onRoll} />
								))}
							</span>
						)}
						{effect?.text}
					</div>
					<div className="sheet__spell-notes">
						{counter}
						{spellNotes(entry, detail)}
					</div>
				</>
			) : (
				<div className="sheet__spell-unresolved">
					<UnresolvedValue reason={`Spell text not found for "${entry.name}" (${entry.source}).`} />
				</div>
			)}
			{open && (
				<div className="sheet__spell-row-text">
					{detail && <SpellDetailBody detail={detail} resolverData={resolverData} />}
					<p className="sheet__spell-provenance">{provenanceLabel(entry)}</p>
					{detail?.concentration && onToggleConcentration && (
						<button
							type="button"
							className="spell-list__concentrate"
							aria-label={`Concentrate on ${entry.name}`}
							aria-pressed={concentrating}
							onClick={() => onToggleConcentration(entry.name)}
						>
							{concentrating ? 'Concentrating' : 'Concentrate'}
						</button>
					)}
				</div>
			)}
		</li>
	)
}

/**
 * The Spells tab below the header numbers (R7a, D189): search and pills (local
 * state, D116), notices, then one section per slot level with its boxes on the
 * same `play.spentSpellSlots` record as before (9b3).
 */
function SpellsSection({
	sections,
	notices,
	casterOf,
	characterLevel,
	castingClassName,
	spentSpellSlots,
	pactRecharge,
	concentratingOn,
	resolverData,
	resourceUses,
	resourceMaxima,
	resourceRecharge,
	onRoll,
	onSpendOrdinary,
	onSpendPact,
	onCast,
	onUse,
	onSpendResource,
	onToggleConcentration,
	onManageSpells,
}: {
	sections: SpellsTabActionSection[]
	notices: ReactNode
	casterOf: (row: SpellsTabActionRow) => SpellCaster
	characterLevel: number
	castingClassName: string | null
	spentSpellSlots: SpentSpellSlots
	pactRecharge: string
	concentratingOn: string | null
	resolverData: ResolverData
	resourceUses: Record<string, number>
	resourceMaxima: ReadonlyMap<string, number>
	resourceRecharge: ReadonlyMap<string, string>
	onRoll: (report: RollReport) => void
	onSpendOrdinary?: (slotLevel: number, max: number, delta: 1 | -1) => void
	onSpendPact?: (max: number, delta: 1 | -1) => void
	onCast?: (row: SpellsTabActionRow, section: SpellsTabActionSection) => void
	onUse?: (row: SpellsTabActionRow) => void
	onSpendResource?: (name: string, delta: 1 | -1) => void
	onToggleConcentration?: (spellName: string) => void
	/** R9a (D208): opens the Manage Spells drawer; absent for a non-caster or a read-only sheet. */
	onManageSpells?: () => void
}): ReactNode {
	const [filter, setFilter] = useState<SpellsTabFilter>('all')
	const [search, setSearch] = useState('')
	const visible = filterSpellsTabSections(sections, filter, search)
	const pills: { id: SpellsTabFilter; label: string }[] = [
		{ id: 'all', label: 'All' },
		...sections.flatMap((section) => (typeof section.key === 'number' ? [{ id: section.key, label: section.key === 0 ? 'Cantrips' : ordinalLevel(section.key) }] : [])),
		{ id: 'concentration', label: 'Concentration' },
		{ id: 'ritual', label: 'Ritual' },
	]
	const spentOrdinary = spentSpellSlots.ordinary ?? {}
	const spentPact = spentSpellSlots.pact ?? 0
	return (
		<section className="sheet__spells">
			{(sections.length > 0 || onManageSpells) && (
				<div className="sheet__actions-toolbar sheet__spells-toolbar">
					{sections.length > 0 && (
						<>
							<input type="search" className="sheet__spells-search" aria-label="Search spells" placeholder="Search spells" value={search} onChange={(event) => setSearch(event.target.value)} />
							<div className="sheet__actions-filters" role="group" aria-label="Filter spells">
								{pills.map(({ id, label }) => (
									<button key={String(id)} type="button" className={filter === id ? 'pill pill--active' : 'pill'} aria-pressed={filter === id} onClick={() => setFilter(id)}>
										{label}
									</button>
								))}
							</div>
						</>
					)}
					{onManageSpells && (
						<button type="button" className="sheet__manage-spells" onClick={onManageSpells}>
							Manage Spells
						</button>
					)}
				</div>
			)}
			<div className="sheet__spells-notices">{notices}</div>
			{sections.length > 0 &&
				(visible.length === 0 ? (
					<p className="sheet__action-group-empty">Nothing here for this character.</p>
				) : (
					<div className="sheet__spell-table">
						<div className="sheet__spell-table-head" aria-hidden="true">
							<span />
							<span>Name</span>
							<span>Time</span>
							<span>Range</span>
							<span>Hit / DC</span>
							<span>Effect</span>
							<span>Notes</span>
						</div>
						{visible.map((section) => {
							const level = typeof section.key === 'number' ? section.key : 0
							const label = sectionLabel(section.key)
							const ordinaryLeft = section.ordinarySlots - (spentOrdinary[level] ?? 0)
							const slotsLeft = section.ordinarySlots > 0 ? ordinaryLeft : section.pactSlots - spentPact
							return (
								<section key={String(section.key)} className="sheet__spell-section" aria-label={label}>
									<div className="sheet__spell-section-heading">
										<h3>{label}</h3>
										{section.ordinarySlots > 0 && (
											<UseBoxes
												name={`level ${level} spell slots`}
												spent={spentOrdinary[level] ?? 0}
												max={section.ordinarySlots}
												recharge="Long Rest"
												onChange={onSpendOrdinary ? (delta) => onSpendOrdinary(level, section.ordinarySlots, delta) : undefined}
											/>
										)}
										{/* D11: the pact pool keeps its own boxes and tag, never merged into the ordinary count. */}
										{section.pactSlots > 0 && (
											<span className="sheet__spell-pact">
												<span className="sheet__spell-pact-tag">Pact</span>
												<UseBoxes
													name="Pact Magic slots"
													spent={spentPact}
													max={section.pactSlots}
													recharge={pactRecharge}
													onChange={onSpendPact ? (delta) => onSpendPact(section.pactSlots, delta) : undefined}
												/>
											</span>
										)}
									</div>
									<ul>
										{section.rows.map((row) => (
											<SpellTabRow
												key={row.key}
												row={row}
												section={section}
												castingClassName={castingClassName}
												caster={casterOf(row)}
												characterLevel={characterLevel}
												slotsLeft={slotsLeft}
												concentrating={concentratingOn === row.entry.name}
												resolverData={resolverData}
												resourceUses={resourceUses}
												resourceMaxima={resourceMaxima}
												resourceRecharge={resourceRecharge}
												onRoll={onRoll}
												onCast={onCast}
												onUse={onUse}
												onSpendResource={onSpendResource}
												onToggleConcentration={onToggleConcentration}
											/>
										))}
									</ul>
								</section>
							)
						})}
					</div>
				))}
		</section>
	)
}

type FeaturesFilter = 'all' | FeatureTabGroupKind

const FEATURE_FILTERS: readonly { id: FeaturesFilter; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'class', label: 'Class Features' },
	{ id: 'species', label: 'Species Traits' },
	{ id: 'feats', label: 'Feats' },
]

const EMPTY_GROUP_TEXT: Record<FeatureTabGroupKind, string> = {
	class: 'No class or subclass features found.',
	species: 'No species traits found.',
	feats: 'No feats chosen yet.',
}

/** A chosen option under its feature's row (D184): its name opens its own text; a pick with no text of its own is a plain line. */
function FeatureOptionItem({ option, resolverData }: { option: FeatureTabOption; resolverData: ResolverData }): ReactNode {
	const [open, setOpen] = useState(false)
	if (option.missing) {
		return (
			<li>
				{option.name} <UnresolvedValue reason={option.missing} />
			</li>
		)
	}
	if (option.entries === null) return <li>{option.name}</li>
	return (
		<li>
			<button type="button" className="sheet__group-row-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
				<span className="sheet__group-row-arrow" aria-hidden="true">
					{open ? '▾' : '▸'}
				</span>
				<span className="sheet__feature-option-name">{option.name}</span>
			</button>
			{open && (
				<div className="sheet__group-row-text">
					<ResolvedEntries entries={option.entries} data={resolverData} />
				</div>
			)}
		</li>
	)
}

/**
 * The Features & Traits tab (R6, D184): filter pills, then one group per class,
 * Species Traits and Feats, each record a collapsed row like the Actions groups,
 * with the same use boxes on the same play.resourceUses record.
 */
function FeaturesSection({
	groups,
	errors,
	classExtras,
	resourceMaxima,
	resourceRecharge,
	resourceUses,
	resolverData,
	onSpendResource,
}: {
	groups: FeatureTabGroup[]
	errors: ReactNode
	/** Wild Shape forms and the familiar — shown after the class groups (docs/REPORT.md). */
	classExtras: ReactNode
	resourceMaxima: ReadonlyMap<string, number>
	resourceRecharge: ReadonlyMap<string, string>
	resourceUses: Record<string, number>
	resolverData: ResolverData
	onSpendResource?: (name: string, delta: 1 | -1) => void
}): ReactNode {
	/* D116: which groups show is UI state of this tab only, never written to the character. */
	const [filter, setFilter] = useState<FeaturesFilter>('all')
	const shown = (kind: FeatureTabGroupKind) => filter === 'all' || filter === kind
	const renderGroup = (group: FeatureTabGroup) => (
		<section key={group.key} className="sheet__action-group" aria-label={group.label}>
			<h3>{group.label}</h3>
			{group.rows.length === 0 ? (
				<p className="sheet__feature-group-empty">{EMPTY_GROUP_TEXT[group.kind]}</p>
			) : (
				<ul>
					{group.rows.map((row) => {
						const max = row.resourceName !== null ? resourceMaxima.get(row.resourceName) : undefined
						const resourceName = row.resourceName ?? ''
						return (
							<ActionGroupRow
								key={row.key}
								name={row.name}
								source={row.source}
								uses={
									max !== undefined && (
										<UseBoxes
											name={resourceName}
											spent={resourceUses[resourceName] ?? 0}
											max={max}
											recharge={resourceRecharge.get(resourceName)}
											onChange={onSpendResource ? (delta) => onSpendResource(resourceName, delta) : undefined}
										/>
									)
								}
								below={
									(row.options.length > 0 || row.pending) && (
										<ul className="sheet__feature-options">
											{row.pending && <li className="sheet__feat-pending">Choices not made yet: {row.pending.join(', ')} — make them in Edit Character.</li>}
											{row.options.map((option) => (
												<FeatureOptionItem key={option.key} option={option} resolverData={resolverData} />
											))}
										</ul>
									)
								}
							>
								{row.entries ? <ResolvedEntries entries={row.entries} data={resolverData} /> : <UnresolvedValue reason={`No text found for "${row.name}".`} />}
							</ActionGroupRow>
						)
					})}
				</ul>
			)}
		</section>
	)
	return (
		<section className="sheet__features">
			<div className="sheet__actions-toolbar">
				<div className="sheet__actions-filters" role="group" aria-label="Filter features">
					{FEATURE_FILTERS.map(({ id, label }) => (
						<button key={id} type="button" className={filter === id ? 'pill pill--active' : 'pill'} aria-pressed={filter === id} onClick={() => setFilter(id)}>
							{label}
						</button>
					))}
				</div>
			</div>
			{errors}
			{groups.filter((group) => group.kind === 'class' && shown('class')).map(renderGroup)}
			{shown('class') && classExtras}
			{groups.filter((group) => group.kind !== 'class' && shown(group.kind)).map(renderGroup)}
		</section>
	)
}

/** R5a: a row's numbers opened from its name (D166's pattern) — the weapon's to-hit and damage, or the spell's attack and DC. */
function ActionBreakdown({ attack, spell }: { attack?: WeaponAttack; spell?: SpellActionData }): ReactNode {
	if (attack) {
		return (
			<>
				<DrawerSection title="To hit">
					<CalculatedNumber result={attack.toHit} format={formatModifier} breakdownOpen />
				</DrawerSection>
				<DrawerSection title="Damage">
					{attack.damage.status === 'unknown' ? (
						<UnresolvedValue reason={attack.damage.reason} />
					) : (
						<>
							<p className="drawer__value">{attack.damage.value.text}</p>
							<ValueBreakdown breakdown={attack.damage.breakdown} open />
						</>
					)}
				</DrawerSection>
			</>
		)
	}
	if (!spell) return null
	if (spell.unresolved) return <UnresolvedValue reason={spell.unresolved} />
	return (
		<>
			{spell.attack && (
				<DrawerSection title="Spell attack">
					<p className="drawer__value">{formatModifier(spell.attack.bonus)}</p>
					<ValueBreakdown breakdown={spell.attack.breakdown} open />
				</DrawerSection>
			)}
			{spell.save && (
				<DrawerSection title="Save DC">
					<p className="drawer__value">
						DC {spell.save.dc} {spell.save.abilities.map((ability) => ability.slice(0, 3).toUpperCase()).join('/')}
					</p>
					<ValueBreakdown breakdown={spell.save.breakdown} open />
				</DrawerSection>
			)}
		</>
	)
}

/** One collapsed line: "Fire — resistance (Dwarf, Ring of Fire Resistance)", with the reason when it is shown but does not apply. */
function DamageResponseLine({ response }: { response: DamageResponse }): ReactNode {
	return (
		<li data-superseded={response.supersededBy !== null ? 'true' : undefined}>
			<span className="sheet__damage-response-type">{damageTypeLabel(response.damageType)}</span> — {damageResponseKindLabel(response.kind)}{' '}
			<span className="sheet__damage-response-sources">({response.sources.join(', ')})</span>
			{response.condition && <span className="sheet__damage-response-condition"> — only {response.condition}</span>}
			{response.supersededBy && <span className="sheet__damage-response-superseded"> — not applied: superseded by {response.supersededBy}</span>}
		</li>
	)
}

/**
 * What damage the character resists, is immune to, or is vulnerable to, from
 * every source at once (build order step 7, slice f).
 *
 * The conditional ones are their OWN list, never mixed into the set that always
 * applies: the app cannot see whether a Rage is running until step 9, so it
 * states the condition instead of counting the resistance (D76, the same
 * treatment Mage Armor gets in the Armour Class section).
 */
function DamageResponsesSection({ responses, loading, dataError }: { responses: DamageResponses; loading: boolean; dataError: string | null }): ReactNode {
	const applying = responses.unconditional.filter((response) => response.supersededBy === null)
	return (
		<section className="sheet__damage-responses">
			<h2>Damage resistances and immunities</h2>
			{dataError && <p className="error">Could not load the data this section needs: {dataError}</p>}
			{loading ? (
				<p>Loading…</p>
			) : (
				<>
					{responses.unconditional.length === 0 ? (
						<p>No damage resistances, immunities or vulnerabilities.</p>
					) : (
						<ul className="sheet__damage-response-list">
							{responses.unconditional.map((response) => (
								<DamageResponseLine key={response.key} response={response} />
							))}
						</ul>
					)}
					{responses.conditional.length > 0 && (
						<>
							<h3>Only in certain conditions</h3>
							{/* Kept visually and structurally apart from the list above — these are never part of the set that applies. */}
							<ul className="sheet__damage-response-conditional">
								{responses.conditional.map((response) => (
									<DamageResponseLine key={response.key} response={response} />
								))}
							</ul>
						</>
					)}
					{responses.notes.length > 0 && (
						<ul className="sheet__damage-response-notes">
							{responses.notes.map((note, index) => (
								<li key={`${note.sourceName}-${index}`}>
									{note.sourceName}: {note.reason}
								</li>
							))}
						</ul>
					)}
					{/* A div, not a p: ValueBreakdown renders a <details>, which is not valid inside a paragraph. */}
					<div className="sheet__damage-response-summary">
						{applying.length} applying now
						<ValueBreakdown breakdown={damageResponseBreakdown(responses)} />
					</div>
				</>
			)}
		</section>
	)
}

const DEFENSE_PREFIXES: readonly { kind: DamageResponse['kind']; prefix: string }[] = [
	{ kind: 'resistance', prefix: 'Resistant' },
	{ kind: 'immunity', prefix: 'Immune' },
	{ kind: 'vulnerability', prefix: 'Vulnerable' },
]

/** R4c: the status row's one line — only what applies now; the conditional ones and the sources are in the drawer. */
function DefensesCard({ responses, loading, dataError, onOpen }: { responses: DamageResponses; loading: boolean; dataError: string | null; onOpen: () => void }): ReactNode {
	const applying = responses.unconditional.filter((response) => response.supersededBy === null)
	const parts = DEFENSE_PREFIXES.flatMap(({ kind, prefix }) => {
		const types = applying.filter((response) => response.kind === kind).map((response) => damageTypeLabel(response.damageType))
		return types.length === 0 ? [] : [{ prefix, types: types.join(', ') }]
	})
	return (
		<section className="sheet__status-card sheet__defenses">
			<h2>
				<button type="button" className="sheet__card-label" aria-label="Defenses details" onClick={onOpen}>
					Defenses
				</button>
			</h2>
			<span className="sheet__status-text">
				{loading
					? 'Loading…'
					: parts.length === 0
						? '—'
						: parts.map(({ prefix, types }, index) => (
								<span key={prefix}>
									{index > 0 && ' · '}
									{prefix}: <strong>{types}</strong>
								</span>
							))}
				{dataError && ' ⚠ incomplete'}
			</span>
		</section>
	)
}

const TEXT_COMMIT_IDLE_MS = 500

/**
 * One collapsible free-text field (slice 9d2). The <details> is uncontrolled like
 * every other on the sheet, so each section opens and closes on its own. The
 * displayed value is the local draft alone; the write to storage is debounced
 * and flushed on blur, on unmount and when the page goes away (D116). The parent
 * keys this by character id.
 */
function TextSection({
	label,
	stored,
	onEdit,
}: {
	label: string
	stored: string | undefined
	onEdit: ((text: string) => void) | undefined
}): ReactNode {
	const [draft, setDraft] = useState(stored ?? '')
	const pending = useRef<{ timer: ReturnType<typeof setTimeout>; text: string } | null>(null)
	// onEdit is a fresh closure every render; the timer and the unmount flush must call the latest one.
	const latestOnEdit = useRef(onEdit)
	useEffect(() => {
		latestOnEdit.current = onEdit
	})

	function flush(): void {
		const scheduled = pending.current
		if (scheduled === null) return
		clearTimeout(scheduled.timer)
		pending.current = null
		latestOnEdit.current?.(scheduled.text)
	}

	// Closing the sheet or switching character unmounts this without a blur event.
	useEffect(() => flush, [])

	// Closing the tab or window fires neither blur nor unmount, so text typed within
	// the idle window would be lost; pagehide covers the cases beforeunload misses (D116).
	useEffect(() => {
		const onLeave = (): void => flush()
		window.addEventListener('beforeunload', onLeave)
		window.addEventListener('pagehide', onLeave)
		return () => {
			window.removeEventListener('beforeunload', onLeave)
			window.removeEventListener('pagehide', onLeave)
		}
	}, [])

	return (
		<details className="sheet__text-section">
			<summary>{label}</summary>
			<textarea
				aria-label={label}
				rows={10}
				value={draft}
				readOnly={onEdit === undefined}
				onChange={(event) => {
					const text = event.target.value
					setDraft(text)
					if (pending.current !== null) clearTimeout(pending.current.timer)
					pending.current = { timer: setTimeout(flush, TEXT_COMMIT_IDLE_MS), text }
				}}
				onBlur={flush}
			/>
		</details>
	)
}

/**
 * The sheet is read-only except for three controls: the familiar's form, the
 * inventory section (build order step 7) and the persistent header's hit
 * points (D9). All are changed in play, not at creation, so they belong here
 * and not in the wizard. The callbacks are optional — without them each
 * section still renders and shows its current state, it just cannot be changed.
 */
/* Keyed by id so roll history, mode, toast and drawer state (session-only) never carry over to another character. */
export function CharacterSheet(props: ComponentProps<typeof CharacterSheetBody>): ReactNode {
	return <CharacterSheetBody key={props.character.id} {...props} />
}

function CharacterSheetBody({
	character,
	onChooseFamiliar,
	onEditInventory,
	onEditCurrency,
	onEditHitPoints,
	onEditResourceUses,
	onEditSpentSpellSlots,
	onEditSpentHitDice,
	onEditConcentration,
	onEditHeroicInspiration,
	onEditLanguages,
	onEditToolChoices,
	onEditSpellChoices,
	onEditText,
	onRest,
	onEditCharacter,
	onLevelUp,
	onRemoveLevel,
}: {
	character: Character
	onChooseFamiliar?: (familiar: CharacterFamiliar | null) => void
	onEditInventory?: (inventory: CharacterInventoryItem[]) => void
	onEditCurrency?: (copper: number) => void
	onEditHitPoints?: (hitPoints: HitPointFields) => void
	/** Marks or undoes one use of a limited resource in the actions table (slice 9b2). Absent leaves the row showing the count with no buttons to change it. */
	onEditResourceUses?: (resourceUses: Record<string, number> | undefined) => void
	/** Marks or undoes one spent spell slot on the Spells tab (slice 9b3). Absent leaves the slot counts showing with no buttons to change them. */
	onEditSpentSpellSlots?: (spentSpellSlots: SpentSpellSlots | undefined) => void
	/** Marks one spent hit die per class from the Hit dice section (slice 9b6), keyed by hitDiceKey. Absent leaves the roll working but writing nothing — the remaining count then never changes. */
	onEditSpentHitDice?: (spentHitDice: Record<string, number> | undefined) => void
	/** Sets or, with null, drops the spell being concentrated on (slice 9d1). Absent leaves the buttons and the header control off; the header line still shows a stored one. */
	onEditConcentration?: (spellName: string | null) => void
	/** Turns Heroic Inspiration on or off (R4b, D167). Absent leaves the checkbox showing the stored state, disabled. */
	onEditHeroicInspiration?: (on: boolean) => void
	/** Replaces the known languages — the Proficiencies drawer's class-feature picks (D172). Absent leaves the drawer without the selects. */
	onEditLanguages?: (languages: CharacterLanguage[]) => void
	onEditToolChoices?: (toolChoices: CharacterToolChoice[]) => void
	/** Replaces the class spell picks from the Manage Spells drawer (R9a, D208). Absent leaves the Spells tab without the button. */
	onEditSpellChoices?: (spellChoices: CharacterSpellChoice[]) => void
	/** Writes one of the three free-text fields, exactly as typed (slice 9d2). Absent leaves the textareas showing the stored text, read-only. */
	onEditText?: (field: CharacterTextField, text: string) => void
	/** Applies a finished rest in one write (slice 9b5). Absent leaves the header without the two rest buttons. */
	onRest?: (rest: RestFields) => void
	/** Reopens the creation wizard over this character (slice 8d1). Absent leaves the sheet without the button. */
	onEditCharacter?: () => void
	/** Opens the one-level walk (slice 8d3) with what the next level adds. Absent leaves the sheet without the button. */
	onLevelUp?: (gains: LevelGains) => void
	/** Writes the character with its top level removed (slice 8e). Absent leaves the sheet without the control. */
	onRemoveLevel?: (result: Character) => void
}): ReactNode {
	/* Sheet rebuild slice 2: plain client-side tab state, no URL routing (brief). */
	const [activeTab, setActiveTab] = useState<SheetTabId>('actions')
	/* D163: one drawer at a time, held here and nowhere else — opening another replaces this value. */
	const [drawer, setDrawer] = useState<DrawerContent | null>(null)
	/* Slice 9c3b: in memory only, like each button's own result — never written to Character.play. */
	const [rollHistory, setRollHistory] = useState<RollHistoryEntry[]>([])
	const nextRollId = useRef(0)
	/* D165: UI state only — never saved, never in the URL; every roll that used it puts it back to Normal. */
	const [rollMode, setRollMode] = useState<RollMode>('normal')
	const toastRef = useRef<((report: RollReport) => void) | null>(null)
	const rollsSlot = useContext(RollsNavSlot)
	function recordRoll(report: RollReport): void {
		const entry = { ...report, id: nextRollId.current++ }
		setRollHistory((history) => addRollHistoryEntry(history, entry))
		toastRef.current?.(report)
	}
	/* D117: kept here, not in the HP card, so the number stays readable after a natural 20 ends the dying. */
	const [deathSaveRoll, setDeathSaveRoll] = useState<string | null>(null)
	function recordDeathSaveRoll(result: DeathSaveRollResult): void {
		const text = describeDeathSaveRoll(result)
		setDeathSaveRoll(text)
		recordRoll({ label: 'death save', text })
	}
	const [savingThrowClassData, setSavingThrowClassData] = useState<ClassSavingThrowProficiencies[] | null>(null)
	const [hitDiceClassData, setHitDiceClassData] = useState<ClassHitDie[] | null>(null)
	const [speciesTraitsData, setSpeciesTraitsData] = useState<SpeciesTraitsData[] | null>(null)
	const [feats, setFeats] = useState<FeatEffectEntry[] | null>(null)
	const [featTextEntries, setFeatTextEntries] = useState<FeatTextEntry[] | null>(null)
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)
	const [spellcastingAbilityData, setSpellcastingAbilityData] = useState<ClassSpellcastingAbility[] | null>(null)
	const [spellSlotsClassData, setSpellSlotsClassData] = useState<ClassSpellSlotsData[] | null>(null)
	/** Slice 8e2: computeSpellCounts' own class data (known/prepared allowances), loaded the same way spellSlotsClassData is. */
	const [spellCountClassData, setSpellCountClassData] = useState<ClassSpellCountData[] | null>(null)
	const [spellDetails, setSpellDetails] = useState<SpellDetail[] | null>(null)
	/** Slice 9b2: classes.json's own top-level array, raw — the shape computeCharacterResources' `parsedClasses` wants, unlike the transformed savingThrowClassData/hitDiceClassData above. loadDataFile caches the fetch (D39), so this is free. */
	const [resourceClassData, setResourceClassData] = useState<unknown>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	/** The item list backing the inventory section — its own load (large file, D43-style error state) so it never blocks the rest of the sheet. Null until it resolves. */
	const [itemRefs, setItemRefs] = useState<ItemRef[] | null>(null)
	const [itemRefsError, setItemRefsError] = useState<string | null>(null)
	/** Shared `{#itemEntry}` description templates. Starts empty rather than null: an item description is inside a collapsed <details>, and until this resolves an unresolved reference just shows the D43 note (itemEntryResolver.ts) — it is never a blocking dependency. */
	const [itemEntryTemplates, setItemEntryTemplates] = useState<ItemEntryTemplate[]>([])
	const [combatActions, setCombatActions] = useState<CombatAction[]>([])

	/** One entry per class carrying a subclass — resolved and fetched separately from the main load (it depends on `character`, not just static data), starts empty rather than blocking the rest of the sheet on the D46-style subclass source resolution (sheetData.ts). */
	const [subclassSpellInfo, setSubclassSpellInfo] = useState<{ subclassName: string; alwaysPrepared: AlwaysPreparedSpell[] }[]>([])
	/** D192: class-record always-prepared grants, one group per class. */
	const [classSpellInfo, setClassSpellInfo] = useState<{ className: string; spells: AlwaysPreparedSpell[] }[]>([])
	/** Fixed feat-granted spells (d5a) — depends on the character's feats (featInstances, D156), fetched separately from the main load same as subclassSpellInfo. */
	const [featSpells, setFeatSpells] = useState<FeatGrantedSpell[]>([])
	/** The CLASS's own optionalfeatureProgression picks (step 6a slice 2) — Metamagic, Eldritch Invocations. Depends on `character`, fetched separately same as featSpells. */
	const [classOptionalFeatures, setClassOptionalFeatures] = useState<ChosenClassOptionalFeatureGroup[]>([])
	/**
	 * EVERY chosen optional-feature option, class-level and subclass-level alike,
	 * plus the class fighting style — the actions table's third source.
	 * Deliberately not derived from classOptionalFeatures
	 * above: that one is scoped to the CLASS's own progressions, so a Battle
	 * Master's maneuvers and an Arcane Archer's shots are absent from it.
	 */
	const [chosenOptionalFeatures, setChosenOptionalFeatures] = useState<OptionalFeatureOption[]>([])
	/** Spells granted BY those picks (step 6a final slice) — separate from the option text above, which classOptionalFeatures already renders. */
	const [optionalFeatureSpells, setOptionalFeatureSpells] = useState<OptionalFeatureGrantedSpell[]>([])
	/** Species-granted spells plus the notes for the deferred cantrip-choice entries (race slice). Depends on `character.species`, fetched separately same as featSpells. */
	const [raceSpells, setRaceSpells] = useState<RaceSpellGrants>({ spells: [], notes: [] })
	/** Senses granted by a chosen optional feature or a chosen feat (step 6a, final piece — closes 6a). Depends on `character`, fetched separately same as featSpells/optionalFeatureSpells above. */
	const [grantedSenses, setGrantedSenses] = useState<GrantedSense[]>([])
	/** The D21 class-feature choices (Divine Order, Primal Order, Elemental Fury) joined to their chosen option's text. Depends on `character`, fetched separately same as the effects above. */
	const [classFeatureChoices, setClassFeatureChoices] = useState<ChosenClassFeatureChoice[]>([])
	/** The full class/subclass feature list (D87), its own fetch (classes.json + the resolver files); starts empty and stays empty on failure, same D43 rule as the effects above. */
	const [grantedFeatures, setGrantedFeatures] = useState<GrantedFeature[]>([])
	const [grantedFeaturesError, setGrantedFeaturesError] = useState<string | null>(null)
	/** The species' own traits (slice 8a) — the third name source the max-HP bonus table matches against, beside the D87 features and the taken feats, and the Species Traits group (D184). Empty on failure: a missing name only means a bonus is not applied, which computeMaxHitPoints' breakdown shows by omission; the group states the failure (D43). */
	const [loadedSpeciesTraits, setSpeciesTraits] = useState<SpeciesTrait[]>([])
	const [speciesTraitsError, setSpeciesTraitsError] = useState<string | null>(null)
	/** The Find Familiar beast pool (step 6b slice 2). Fetched only for a character that actually has the spell — see the effect below. */
	const [beasts, setBeasts] = useState<Beast[]>([])
	/** Which alternative Armour Class formulas the character is eligible for (step 7 slice b). Depends on `character` and on whether Mage Armor is in the spell list, fetched separately same as the effects above. */
	const [acFormulaKeys, setAcFormulaKeys] = useState<AcFormulaKey[]>([])
	const [acFormulaKeysError, setAcFormulaKeysError] = useState<string | null>(null)
	/** Weapon proficiency grants, the Monk's Martial Arts die and the feature names carrying an attack count (step 7 slice c). Depends on `character`, fetched separately same as the effects above. */
	const [weaponAttackData, setWeaponAttackData] = useState<WeaponAttackData | null>(null)
	const [weaponAttackDataError, setWeaponAttackDataError] = useState<string | null>(null)
	/** The species, feat and D70 feature damage responses (step 7 slice f). The item half needs only itemRefs, which the inventory section already holds. */
	const [damageResponseData, setDamageResponseData] = useState<DamageResponseData | null>(null)
	const [damageResponseDataError, setDamageResponseDataError] = useState<string | null>(null)

	/*
	 * D43: each per-`character` effect above starts empty and stays empty when its
	 * fetch fails, which on its own is indistinguishable from "this character has
	 * none". One error state per effect, rendered by the section that effect feeds,
	 * so an incomplete sheet never reads as a complete one.
	 */
	const [subclassSpellsError, setSubclassSpellsError] = useState<string | null>(null)
	const [featSpellsError, setFeatSpellsError] = useState<string | null>(null)
	const [optionalFeatureSpellsError, setOptionalFeatureSpellsError] = useState<string | null>(null)
	const [raceSpellsError, setRaceSpellsError] = useState<string | null>(null)
	const [grantedSensesError, setGrantedSensesError] = useState<string | null>(null)
	const [classOptionalFeaturesError, setClassOptionalFeaturesError] = useState<string | null>(null)
	const [classFeatureChoicesError, setClassFeatureChoicesError] = useState<string | null>(null)
	/** Same rule as the six above, for the one load that was still swallowing: without it a failed beasts.json fetch removed the whole Familiar section (docs/REPORT.md). */
	const [beastsError, setBeastsError] = useState<string | null>(null)
	/* Which character object each granted-spell load last settled for. Until all four match the one on screen, the spell list may be short a grant, and the concentration guard below must not act on it. */
	const [spellGrantsSettledFor, setSpellGrantsSettledFor] = useState<Record<'subclass' | 'feat' | 'optionalFeature' | 'race', Character | null>>({
		subclass: null,
		feat: null,
		optionalFeature: null,
		race: null,
	})
	function spellGrantsSettled(grant: keyof typeof spellGrantsSettledFor, settledFor: Character): void {
		setSpellGrantsSettledFor((previous) => ({ ...previous, [grant]: settledFor }))
	}

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
			loadSpellCountClassData(),
			loadSpellDetails(),
			loadDataFile('data/classes.json'),
		])
			.then(([classData, hitDiceData, speciesData, featData, featTexts, resolver, spellcastingData, spellSlotsData, spellCountData, spellDetailData, rawClassesData]) => {
				if (cancelled) return
				setSavingThrowClassData(classData)
				setHitDiceClassData(hitDiceData)
				setSpeciesTraitsData(speciesData)
				setFeats(featData)
				setFeatTextEntries(featTexts)
				setResolverData(resolver)
				setSpellcastingAbilityData(spellcastingData)
				setSpellSlotsClassData(spellSlotsData)
				setSpellCountClassData(spellCountData)
				setSpellDetails(spellDetailData)
				setResourceClassData(rawClassesData)
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
		// Best-effort: a failed load leaves the array empty, so a {#itemEntry}
		// reference shows itemEntryResolver's D43 note rather than raw braces.
		loadItemEntryTemplates()
			.then((templates) => {
				if (!cancelled) setItemEntryTemplates(templates)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		// Best-effort like the templates above: without the file the groups just lack their Actions in Combat line.
		loadCombatActions()
			.then((actions) => {
				if (!cancelled) setCombatActions(actions)
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		const classesWithSubclass = character.classes.filter((c): c is typeof c & { subclass: string } => c.subclass !== null)
		// D192: the class record's own grants apply to every class, subclass or not (Druid 1, Ranger 1).
		const classGrants = Promise.all(
			character.classes.map(async (c) => ({ className: c.className, spells: await loadClassAlwaysPreparedSpells(c.className, c.classSource, c.level) })),
		)
		const subclassGrants = Promise.all(
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
		Promise.all([classGrants, subclassGrants])
			.then(([classInfos, infos]) => {
				if (cancelled) return
				setClassSpellInfo(classInfos)
				setSubclassSpellInfo(infos)
				setSubclassSpellsError(null)
				// The run before the slot tables arrive has no rank-keyed patron grants yet; only the re-run after them is the full list.
				if (spellSlotsClassData !== null) spellGrantsSettled('subclass', character)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setClassSpellInfo([])
				setSubclassSpellInfo([])
				setSubclassSpellsError(messageOf(error))
				spellGrantsSettled('subclass', character)
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
				spellGrantsSettled('feat', character)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setFeatSpells([])
				setFeatSpellsError(messageOf(error))
				spellGrantsSettled('feat', character)
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
		// D43: an empty result on failure, same as the granted-feature source the
		// actions table already has — a missing row never claims the feature is passive.
		loadChosenOptionalFeatureOptions(character.optionalFeatureChoices ?? [], character.fightingStyle ?? null)
			.then((options) => {
				if (!cancelled) setChosenOptionalFeatures(options)
			})
			.catch(() => {
				if (!cancelled) setChosenOptionalFeatures([])
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
				spellGrantsSettled('optionalFeature', character)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setOptionalFeatureSpells([])
				setOptionalFeatureSpellsError(messageOf(error))
				spellGrantsSettled('optionalFeature', character)
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadRaceSpells(character)
			.then((grants) => {
				if (cancelled) return
				setRaceSpells(grants)
				setRaceSpellsError(null)
				spellGrantsSettled('race', character)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setRaceSpells({ spells: [], notes: [] })
				setRaceSpellsError(messageOf(error))
				spellGrantsSettled('race', character)
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

	useEffect(() => {
		let cancelled = false
		loadGrantedClassFeatures(character)
			.then((features) => {
				if (cancelled) return
				setGrantedFeatures(features)
				setGrantedFeaturesError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setGrantedFeatures([])
				setGrantedFeaturesError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadSpeciesTraits(character)
			.then((traits) => {
				if (cancelled) return
				setSpeciesTraits(traits)
				setSpeciesTraitsError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setSpeciesTraits([])
				setSpeciesTraitsError(messageOf(error))
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
		raceSpells.spells,
		classSpellInfo,
	)
	const knowsFindFamiliar = hasFindFamiliar(combinedSpells)
	const knowsMageArmor = hasMageArmor(combinedSpells)
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

	useEffect(() => {
		let cancelled = false
		loadAcFormulaKeys(character, knowsMageArmor)
			.then((keys) => {
				if (cancelled) return
				setAcFormulaKeys(keys)
				setAcFormulaKeysError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setAcFormulaKeys([])
				setAcFormulaKeysError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character, knowsMageArmor])

	useEffect(() => {
		let cancelled = false
		loadWeaponAttackData(character)
			.then((data) => {
				if (cancelled) return
				setWeaponAttackData(data)
				setWeaponAttackDataError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				// D43: no grants means "proficient with nothing", which is a real state — the error line is what keeps it from reading as one.
				setWeaponAttackData({ grants: [], martialArtsDie: null, featureNames: [], proficiencies: { armor: [], weapons: [], tools: [], languages: [] } })
				setWeaponAttackDataError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

	useEffect(() => {
		let cancelled = false
		loadDamageResponseData(character)
			.then((data) => {
				if (cancelled) return
				setDamageResponseData(data)
				setDamageResponseDataError(null)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				// D43: empty grants is indistinguishable from "this character has none" — the error line is what keeps it from reading as one.
				setDamageResponseData({ speciesGrants: [], featGrants: [], featureGrants: [] })
				setDamageResponseDataError(messageOf(error))
			})
		return () => {
			cancelled = true
		}
	}, [character])

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
		!spellCountClassData ||
		!spellDetails ||
		!resourceClassData
	) {
		return (
			<article className="sheet">
				<p>Loading…</p>
			</article>
		)
	}

	const abilityScores = computeAbilityScores(character, feats)
	/* Step 7 slice h: a worn magic item's flat bonuses, gated on attunement, each landing on the value that owns it. */
	const itemFlatBonuses = flatBonusesByTarget(buildItemFlatBonusGrants(character.inventory ?? [], itemRefs ?? []))
	const proficiencyBonusResult = computeProficiencyBonus(character.classes)
	/* The proficiency bonus item bonus is a note only — itemFlatBonuses.ts says why the number is left alone. Every amount is 0, so the total does not move. */
	const proficiencyBonus =
		proficiencyBonusResult.status === 'known' && itemFlatBonuses.proficiencyBonus.length > 0
			? { ...proficiencyBonusResult, breakdown: [...proficiencyBonusResult.breakdown, ...itemFlatBonuses.proficiencyBonus] }
			: proficiencyBonusResult
	const savingThrows = computeSavingThrows(character, savingThrowClassData, feats, itemFlatBonuses.savingThrow)
	const initiative = computeInitiative(character, feats)
	const skills = computeSkills(character, feats, itemFlatBonuses.abilityCheck)
	const passivePerception = computePassivePerception(character, feats, itemFlatBonuses.abilityCheck)
	const passiveInvestigation = computePassiveInvestigation(character, feats, itemFlatBonuses.abilityCheck)
	const passiveInsight = computePassiveInsight(character, feats, itemFlatBonuses.abilityCheck)
	/* Step 7 slice b: what the character has in use. itemRefs is null only while the item list is still loading — the AC section says so rather than reporting an unarmoured number it would then have to correct. */
	const equippedGear = buildEquippedGear(character.inventory ?? [], itemRefs ?? [])
	const armourClass = computeArmourClass(character, equippedGear, acFormulaKeys, feats, itemFlatBonuses.armourClass)
	/* Step 7 slice e2b: an item's own speed adjustment arrives through the same `adjustments` parameter slice b's heavy-armour penalty does. */
	const speed = computeSpeed(character, speciesTraitsData, [
		...armourSpeedPenalty(character, equippedGear.armour, feats),
		...buildItemSpeedAdjustments(character.inventory ?? [], itemRefs ?? []),
	])
	/* Step 7 slice c: only the weapons in hand become attack lines; everything else stays in the inventory. */
	const heldWeapons = buildHeldWeapons(character.inventory ?? [], itemRefs ?? [])
	const weaponAttacks = computeWeaponAttacks(character, heldWeapons, weaponAttackData?.grants ?? [], feats, weaponAttackData?.martialArtsDie ?? null)
	const attacksPerAction = computeAttacksPerAction(weaponAttackData?.featureNames ?? [])
	/* Step 7 slice d: the limit needs the character's own levels only, so it is not waiting on any fetch. */
	const attunementLimit = computeAttunementLimit(character)
	/* Step 7 slice f: every source in one list. Items are gated on attunement inside buildItemGrants; species/feats/features arrive from the effect above. */
	const damageResponses = computeDamageResponses([
		...buildItemGrants(character.inventory ?? [], itemRefs ?? []),
		...(damageResponseData?.speciesGrants ?? []),
		...(damageResponseData?.featGrants ?? []),
		...(damageResponseData?.featureGrants ?? []),
	])

	/** The Finesse pick lives on the inventory row (storage/character.ts), so switching it is an ordinary inventory edit. Keyed by ROW, not by item: two Longswords with different bonuses are two attack lines (slice e). */
	function chooseAttackAbility(key: string, ability: WeaponAttackAbility): void {
		if (!onEditInventory) return
		onEditInventory((character.inventory ?? []).map((item) => (inventoryRowKey(item) === key ? { ...item, attackAbility: ability } : item)))
	}
	/** Goes through the same onEditInventory as every quantity change in the Inventář tab (slice 7a-1), so the two tabs read one number. */
	function spendAmmoEntry(entry: AmmoEntry): void {
		if (!onEditInventory) return
		onEditInventory(spendAmmo(character.inventory ?? [], entry))
	}
	const size = computeSize(character, speciesTraitsData)
	// Darkvision is the one granted sense that reconciles with the species value (D40/D53) rather than
	// standing alone in the Senses section below — split out here, before combineSenseEntries sees the rest.
	const darkvisionGrants: GrantedDarkvision[] = [
		...grantedSenses.filter((sense) => sense.senseType.toLowerCase() === 'darkvision').map((sense) => ({ range: sense.range, origin: sense.origin, name: sense.name, ...(sense.additive ? { additive: sense.additive } : {}) })),
		/* Step 7 slice e2b: an item's darkvision is another candidate for the same reconciliation, never an addition to it. */
		...buildItemDarkvisionGrants(character.inventory ?? [], itemRefs ?? []),
	]
	const darkvision = computeDarkvision(character, speciesTraitsData, darkvisionGrants)
	const hitDice = computeHitDicePool(character.classes, hitDiceClassData)
	const chosenFeats = characterFeats(character, feats)
	// D186: a trait whose text starts at a character level is absent below it, on every tab.
	const speciesTraits = speciesTraitsAtLevel(loadedSpeciesTraits, character.classes.reduce((sum, c) => sum + c.level, 0))
	/* Slice 8a: every feature name the character has, from the three sources that can carry a max-HP bonus. computeMaxHitPoints reads only the three names its table knows, so no filtering is needed here. */
	const maxHitPoints = computeMaxHitPoints(
		character,
		hitDiceClassData,
		[...grantedFeatures.map((feature) => feature.name), ...chosenFeats.map((choice) => choice.name), ...speciesTraits.map((trait) => trait.name)],
		feats,
	)

	const spellcasting = computeSpellcasting(character, spellcastingAbilityData, feats, itemFlatBonuses.spellAttack, itemFlatBonuses.spellSaveDc)
	const spellcastingEntries = spellcasting.status === 'known' ? spellcasting.value : []
	const spellSlots = computeSpellSlots(character, spellSlotsClassData)
	const spellSlotsEntries = spellSlots.status === 'known' ? spellSlots.value : []
	const spellCounts = computeSpellCounts(character, spellCountClassData)
	const spellCountEntries = spellCounts.status === 'known' ? spellCounts.value : []
	/*
	 * Slice 8e2 (D106): what this character stores against what its level
	 * allows, for the two things that carry no level of their own (D104) —
	 * known/prepared spells and Wild Shape forms. D11's phase-1 single-class
	 * assumption runs through spellSlots.ts/spellCounts.ts/spellLevelFilter.ts
	 * already; a multiclass character (more than one class) is the same gap
	 * those modules already name, so it reads as "cannot tell" (D43) rather
	 * than silently showing nothing or, worse, a number computed off just one
	 * of its classes.
	 */
	const singleCastingClass = character.classes.length === 1 ? character.classes[0] : null
	const spellLimitReason: string | null =
		character.classes.length > 1
			? 'Cannot tell this character’s spell limits: combining more than one class’s spellcasting is build order step 10.'
			: spellSlots.status === 'unknown'
				? spellSlots.reason
				: spellCounts.status === 'unknown'
					? spellCounts.reason
					: null
	const castableSlotsEntry = singleCastingClass
		? spellSlotsEntries.find((entry) => entry.className === singleCastingClass.className && entry.classSource === singleCastingClass.classSource)
		: undefined
	const highestCastableLevel = spellLimitReason === null ? highestSlotLevel(castableSlotsEntry) : null
	const spellCountEntry = singleCastingClass
		? spellCountEntries.find((entry) => entry.className === singleCastingClass.className && entry.classSource === singleCastingClass.classSource)
		: undefined
	/* Only CHOSEN spells (spellChoices) are the freely-swapped known/prepared pool D104 leaves untouched by level removal — a subclass/feat/species grant is always legal by construction and isn't counted here. */
	const chosenSpellLevels = combinedSpells
		.filter((entry) => entry.chosen)
		.map((entry) => findSpellDetail(spellDetails, entry.name, entry.source)?.level)
		.filter((level): level is number => level !== undefined)
	const cantripsStored = chosenSpellLevels.filter((level) => level === 0).length
	const leveledSpellsStored = chosenSpellLevels.filter((level) => level > 0).length
	const hasChosenSpells = combinedSpells.some((entry) => entry.chosen)
	const featSpellcasting = computeFeatSpellcasting(character, featSpells, feats, itemFlatBonuses.spellAttack, itemFlatBonuses.spellSaveDc)
	const featSpellcastingEntries = featSpellcasting.status === 'known' ? featSpellcasting.value : []
	const speciesSpellcasting = computeSpeciesSpellcasting(character, raceSpells.spells, feats, itemFlatBonuses.spellAttack, itemFlatBonuses.spellSaveDc)
	const speciesSpellcastingEntries = speciesSpellcasting.status === 'known' ? speciesSpellcasting.value : []
	/* Sheet rebuild slice 4: the SAME combined spell list the Kouzla tab shows, filtered to the spells that carry an attack roll or a save — never re-derived from the grants. */
	const spellActions = spellActionRows(
		combinedSpells,
		spellDetails,
		character.classes.reduce((sum, c) => sum + c.level, 0),
		spellcastingEntries,
		featSpellcastingEntries,
		speciesSpellcastingEntries,
	)
	/* Sheet rebuild slice 5: the D87 feature list, the character's feats and their chosen optional features, filtered to the ones D86 calls usable — the same records the Features tab shows, never a second resolution. */
	/*
	 * An option is the class's when the class's own progression resolved it (Class options) or it is the class-level fighting
	 * style, otherwise the subclass's (D88's split). One class only: which class a pick belongs to under multiclassing is step 10.
	 */
	const singleClass = character.classes.length === 1 ? character.classes[0] : null
	const classOptionNames = new Set(classOptionalFeatures.flatMap((group) => group.options.map((option) => option.name.toLowerCase())))
	function optionOrigin(option: OptionalFeatureOption): string | null {
		if (!singleClass || classOptionalFeaturesError) return null
		const name = option.name.toLowerCase()
		if (classOptionNames.has(name) || name === character.fightingStyle?.toLowerCase()) return singleClass.className
		return singleClass.subclass
	}
	const featureActions = featureActionRows(grantedFeatures, chosenFeats, featTextEntries, chosenOptionalFeatures, optionOrigin, speciesTraits, character.species?.name ?? null)
	/*
	 * Slice 9b2: the same three feature sources computeCharacterResources asks for
	 * (its own doc comment) — granted features, the chosen feats' own text, and the
	 * chosen optional-feature options — assembled exactly as featureActionRows'
	 * inputs above and levelRemoval.ts's resourceFeaturesFor already do, not a new
	 * selection. Only the 8 resources whose maximum resolves get a Map entry; the
	 * ~90 "not in data" resources are left out on purpose, so featureActionRow below
	 * has no maximum to key a Uses tracker off and renders those rows unchanged.
	 */
	const chosenFeatTexts = chosenFeats.flatMap((choice) => featTextEntries.filter((text) => text.name === choice.name && text.source === choice.source))
	const resourceFeatures: ResourceFeature[] = [...grantedFeatures, ...chosenFeatTexts, ...chosenOptionalFeatures]
	// D190: free-cast counters join the list, so spending clamps and Short Rest recovery run through the same path.
	const characterResources = withFreeCastResources(
		computeCharacterResources(character, resourceClassData, resourceFeatures, speciesTraits),
		freeCastResources(combinedSpells, abilityScores),
	)
	const resourceMaxima = new Map(characterResources.filter((resource) => resource.max.status === 'known').map((resource) => [resource.name, resource.max.status === 'known' ? resource.max.value : 0]))
	// A Long Rest returns every resource (afterLongRest); a Short Rest only the ones 9b5 reads as short-rest recoverable.
	const resourceRecharge = new Map(characterResources.map((resource) => [resource.name, resource.shortRest ? 'Short Rest' : 'Long Rest']))
	const resourceUses = character.play?.resourceUses ?? {}
	function spendResource(name: string, delta: number): void {
		if (!onEditResourceUses) return
		const max = resourceMaxima.get(name)
		const spent = resourceUses[name] ?? 0
		const next = Math.max(0, max !== undefined ? Math.min(spent + delta, max) : spent + delta)
		onEditResourceUses({ ...resourceUses, [name]: next })
	}
	/*
	 * Slice 9b5: what a rest gives back is decided here, where the resource list and
	 * the hit-point maximum already are. Pact Magic is asked the same question as
	 * the resources instead of being assumed short-rest recoverable — its own
	 * feature text is what separates it from the ordinary slots D11 keeps apart,
	 * which come back only on a Long Rest.
	 */
	const pactShortRest = shortRestRecovery(['Pact Magic'], resourceFeatures)
	function takeShortRest(): void {
		onRest?.(afterShortRest(character.currentHp, character.play, characterResources, pactShortRest))
	}
	function takeLongRest(): void {
		onRest?.(afterLongRest(character.currentHp, character.play, maxHitPoints.status === 'known' ? maxHitPoints.value : null))
	}
	/*
	 * Slice 9b3: the same spend/undo shape one pool over, kept as two functions
	 * rather than one with a pool argument — D11's two pools are keyed differently
	 * (ordinary by spell level, Pact Magic by nothing), so a shared writer would
	 * spend its body telling them apart again.
	 */
	const spentSpellSlots = character.play?.spentSpellSlots ?? {}
	function spendOrdinarySlot(slotLevel: number, max: number, delta: 1 | -1): void {
		if (!onEditSpentSpellSlots) return
		const next = Math.min(Math.max(0, (spentSpellSlots.ordinary?.[slotLevel] ?? 0) + delta), max)
		onEditSpentSpellSlots({ ...spentSpellSlots, ordinary: { ...spentSpellSlots.ordinary, [slotLevel]: next } })
	}
	function spendPactSlot(max: number, delta: 1 | -1): void {
		if (!onEditSpentSpellSlots) return
		const next = Math.min(Math.max(0, (spentSpellSlots.pact ?? 0) + delta), max)
		onEditSpentSpellSlots({ ...spentSpellSlots, pact: next })
	}
	/*
	 * Slice 9b6: spending one hit die, in the same shape as the two pools above but
	 * one-directional — a die comes back only on a Long Rest, never by an undo.
	 * The roll's click does all of it: heal by the total (applyHealing, so the
	 * maximum and temporary hit points behave exactly as in the damage panel, D110)
	 * and mark the die. They are two writes because no store method updates both
	 * currentHp and spentHitDice; both read fresh storage, so neither undoes the other.
	 */
	const spentHitDice = character.play?.spentHitDice ?? {}
	function spendHitDie(key: string, max: number): void {
		if (!onEditSpentHitDice) return
		const next = Math.min(Math.max(0, (spentHitDice[key] ?? 0) + 1), max)
		onEditSpentHitDice({ ...spentHitDice, [key]: next })
	}
	const currentHp = character.currentHp
	/* D43/D110: healing needs a current value to act on and a maximum to stop at; neither is guessed. */
	const hitDiceCanHeal = currentHp !== undefined && maxHitPoints.status === 'known'
	function rollHitDie(entry: HitDiceEntry, roll: DiceRoll): void {
		if (onEditHitPoints && currentHp !== undefined && maxHitPoints.status === 'known') {
			const healed = applyHealing({ currentHp, temporaryHitPoints: character.play?.temporaryHitPoints ?? 0 }, roll.total, maxHitPoints.value)
			onEditHitPoints({
				currentHp: healed.currentHp,
				maxHpOverride: character.maxHpOverride,
				temporaryHitPoints: healed.temporaryHitPoints,
				deathSaves: deathSavesAfterHitPointChange(healed.currentHp, character.play?.deathSaves),
			})
		}
		spendHitDie(hitDiceKey(entry.className, entry.classSource), entry.count)
	}
	/* Slice 9d1: absent and null are both "none" (Character.play.concentratingOn). Clicking the active spell again drops it; any other replaces it without asking. */
	const storedConcentration = character.play?.concentratingOn ?? null
	/*
	 * A spell that has left the character (an edit, a lost subclass or feat grant) is not concentrated on. Decided here, not at
	 * the write, because only the sheet assembles all five spell sources; and only once the list is complete (D43) — a grant still
	 * loading or failed to load would otherwise drop a concentration that is still valid.
	 */
	const spellListComplete =
		Object.values(spellGrantsSettledFor).every((settledFor) => settledFor === character) &&
		[subclassSpellsError, featSpellsError, optionalFeatureSpellsError, raceSpellsError].every((error) => error === null)
	const concentratingOn =
		storedConcentration !== null && spellListComplete && !combinedSpells.some((entry) => entry.name === storedConcentration) ? null : storedConcentration
	function toggleConcentration(spellName: string): void {
		onEditConcentration?.(concentratingOn === spellName ? null : spellName)
	}
	/* R7a (D189): one set of header numbers per spellcasting source the sheet computes. */
	const spellcastingSources = [
		...spellcastingEntries.map((entry) => ({ ...entry, key: `class|${entry.className}|${entry.classSource}`, name: entry.className })),
		...featSpellcastingEntries.map((entry) => ({ ...entry, key: `feat|${entry.featName}`, name: entry.featName })),
		...speciesSpellcastingEntries.map((entry) => ({ ...entry, key: `species|${entry.speciesName}`, name: entry.speciesName })),
	]
	const slotMaxima = spellSlotMaxima(spellSlotsEntries)
	const pactSlotLevel = spellSlotsEntries.reduce((level, entry) => Math.max(level, entry.pactSlots?.slotLevel ?? 0), 0)
	const hasSpellSlots = slotMaxima.pact > 0 || slotMaxima.ordinary.some((count) => count > 0)
	const spellSections = spellsTabActionSections({
		entries: combinedSpells,
		details: spellDetails,
		ordinarySlots: slotMaxima.ordinary,
		pact: slotMaxima.pact > 0 ? { count: slotMaxima.pact, slotLevel: pactSlotLevel } : null,
		unavailableAboveLevel: spellLimitReason === null ? (highestCastableLevel ?? undefined) : undefined,
		resourceMaxima,
	})
	/* D189: CAST spends one slot of its section's pool (ordinary first when a section has both, QUESTIONS.md) and starts concentration. */
	function castSpell(row: SpellsTabActionRow, section: SpellsTabActionSection): void {
		const level = typeof section.key === 'number' ? section.key : 0
		if (section.ordinarySlots > 0) spendOrdinarySlot(level, section.ordinarySlots, 1)
		else if (section.pactSlots > 0) spendPactSlot(section.pactSlots, 1)
		if (row.detail?.concentration) onEditConcentration?.(row.entry.name)
	}
	/* D191: USE spends the row's counter (or a resource pool's cost) through the shared resource path, and starts concentration like CAST. */
	function useSpell(row: SpellsTabActionRow): void {
		if (row.action.kind !== 'use') return
		spendResource(row.action.counterKey, row.action.cost)
		if (row.detail?.concentration) onEditConcentration?.(row.entry.name)
	}
	/* D184: every chosen option (class- and subclass-level, fighting style) sits under the feature that grants it; D88's separate option sections are gone. */
	const featureGroups = featuresTabGroups({
		classes: character.classes,
		speciesName: character.species?.name ?? null,
		granted: grantedFeatures,
		classFeatureChoices,
		chosenOptions: chosenOptionalFeatures,
		optionOrigin,
		speciesTraits,
		feats: chosenFeats.map((instance) => ({
			instance,
			text: featTextEntries.find((f) => f.name === instance.name && f.source === instance.source),
			pending: missingFeatSubChoices(instance, feats),
		})),
	})
	// D46-style: a class with no spellcasting ability (spellcasting.ts) but slots via a subclass table (spellSlots.ts's EK/AT fallback) still counts as a caster for section visibility, even though its attack/DC entry is empty — see docs/REPORT.md.
	const isCaster = spellcastingEntries.length > 0 || spellSlotsEntries.length > 0 || featSpellcastingEntries.length > 0 || speciesSpellcastingEntries.length > 0
	/* R9a (D208): one Manage Spells section per class that has spell counts; species, feat and option spells stay with their sources. */
	const managedClasses = character.classes.flatMap((c) => {
		const counts = spellCountEntries.find((entry) => entry.className === c.className && entry.classSource === c.classSource)
		if (!counts) return []
		const choicePicks = (character.subclassSpellChoices ?? [])
			.filter((choice) => choice.className === c.className && choice.classSource === c.classSource && choice.subclassName === c.subclass)
			.flatMap((choice) => choice.picks.map((pick) => ({ name: pick.name, source: pick.source })))
		const choiceKeys = new Set(choicePicks.map((pick) => spellIdentityKey(pick.name, pick.source)))
		const subclassGrants = subclassSpellInfo.find((info) => info.subclassName === c.subclass)?.alwaysPrepared ?? []
		// subclassSpellInfo merges the fixed grants with the filter-choice picks; the panel shows the two differently.
		const subclassFixed = subclassGrants.filter((spell) => !choiceKeys.has(spellIdentityKey(spell.name, spell.source)))
		const classFixed = classSpellInfo.find((info) => info.className === c.className)?.spells ?? []
		const picks = (character.spellChoices ?? []).find((choice) => choice.className === c.className && choice.classSource === c.classSource)?.spells ?? []
		const alreadyKnown = collectKnownSpells({
			classSpellPicks: picks,
			classAlwaysPrepared: { className: c.className, spells: classFixed },
			subclassName: c.subclass,
			subclassAlwaysPrepared: subclassFixed,
			subclassSpellChoicePicks: choicePicks,
			featGrantedSpells: featSpells,
			optionalFeatureGrantedSpells: optionalFeatureSpells,
		})
		return [{ characterClass: c, counts, alreadyKnown, holdings: { picks, subclassChoicePicks: choicePicks, alwaysPrepared: [...classFixed, ...subclassFixed] } }]
	})
	const canManageSpells = onEditSpellChoices !== undefined && managedClasses.length > 0
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
	/*
	 * Slice 8e2 (D106): storage keeps every Wild Shape pick regardless of level
	 * (D104) — this is the count-only half of that gap, one entry per class
	 * that has ANY stored forms. Unlike the spell limits above, Wild Shape's
	 * allowance is read off that one class's own level (wildShapeLimits), so
	 * multiclassing elsewhere on the sheet doesn't make it undeterminable —
	 * only a class the character no longer has does.
	 */
	const wildShapeOverages = storedWildShapeForms.map((entry) => {
		const classEntry = character.classes.find((c) => c.className === entry.className && c.classSource === entry.classSource)
		if (!classEntry) {
			return {
				key: `${entry.className}|${entry.classSource}`,
				className: entry.className,
				status: 'unknown' as const,
				reason: `Cannot tell the Wild Shape limit for "${entry.className}": that class is no longer on this character.`,
			}
		}
		const limits = wildShapeLimits(entry.className, classEntry.level, classEntry.subclass)
		return {
			key: `${entry.className}|${entry.classSource}`,
			className: entry.className,
			status: 'known' as const,
			stored: entry.forms.length,
			allowed: limits?.knownForms ?? 0,
		}
	})
	// Darkvision grants are folded into the traits row above, not shown again here.
	const combinedSenses = combineSenseEntries(grantedSenses.filter((sense) => sense.senseType.toLowerCase() !== 'darkvision'))

	/* D43: the three grants feeding the spell list each name themselves, so the player can tell which part of the list is short rather than just that something is. */
	const spellLoadErrors: { what: string; message: string }[] = [
		{ what: 'always-prepared subclass spells', message: subclassSpellsError },
		{ what: 'feat-granted spells', message: featSpellsError },
		{ what: 'spells granted by your chosen options', message: optionalFeatureSpellsError },
		{ what: 'species-granted spells', message: raceSpellsError },
	].filter((entry): entry is { what: string; message: string } => entry.message !== null)

	/* D183: in the Short Rest drawer (moved out of the Hit Points drawer) — same section class, no logic change. */
	const hitDiceLine = (
		<section className="sheet__hit-dice">
			{hitDice.status === 'unknown' ? (
				<UnresolvedValue reason={hitDice.reason} />
			) : (
				<>
					<ul>
						{hitDice.value.map((entry) => {
							const remaining = entry.count - Math.min(spentHitDice[hitDiceKey(entry.className, entry.classSource)] ?? 0, entry.count)
							const constitution = abilityScores.constitution
							return (
								<li key={hitDiceKey(entry.className, entry.classSource)}>
									d{entry.faces} ({entry.className}): {remaining} / {entry.count} remaining
									{/* A hit die adds the Constitution modifier, so an unresolved one leaves nothing to roll (D43). */}
									{constitution.status === 'known' && (
										<>
											{' '}
											<DamageRollButton
												count={1}
												sides={entry.faces}
												modifier={constitution.value.modifier}
												label={`${entry.className} hit die`}
												disabled={remaining === 0 || (onEditHitPoints !== undefined && !hitDiceCanHeal)}
												onRoll={(report, roll) => {
													recordRoll(report)
													rollHitDie(entry, roll)
												}}
											/>
										</>
									)}
								</li>
							)
						})}
					</ul>
					{onEditHitPoints && !hitDiceCanHeal && (
						<p className="sheet__hit-dice-note">Hit dice cannot be rolled: healing needs a current HP and a computable maximum.</p>
					)}
					<ValueBreakdown breakdown={hitDice.breakdown} />
				</>
			)}
		</section>
	)

	const hitPointProps: HitPointProps = {
		currentHp,
		maxHitPoints,
		maxHpOverride: character.maxHpOverride,
		temporaryHitPoints: character.play?.temporaryHitPoints,
		deathSaves: character.play?.deathSaves,
		onEditHitPoints,
		onDeathSaveRolled: recordDeathSaveRoll,
	}

	return (
		<RollModeContext.Provider value={{ mode: rollMode, setMode: setRollMode }}>
		<article className="sheet">
			{rollsSlot &&
				createPortal(
					<button type="button" className="tabs__button" onClick={() => setDrawer({ kind: 'rolls' })}>
						Rolls
					</button>,
					rollsSlot,
				)}
			<SheetHeader
				name={character.name}
				armourClass={armourClass}
				armourClassLoading={itemRefs === null}
				acFormulaKeysError={acFormulaKeysError}
				initiative={initiative}
				speed={speed}
				proficiencyBonus={proficiencyBonus}
				hitPoints={<HitPointsCard {...hitPointProps} onOpen={() => setDrawer({ kind: 'hitPoints' })} />}
				concentratingOn={concentratingOn}
				onDropConcentration={onEditConcentration ? () => onEditConcentration(null) : undefined}
				onShortRest={onRest ? () => setDrawer({ kind: 'shortRest' }) : undefined}
				onLongRest={onRest ? takeLongRest : undefined}
				onRoll={recordRoll}
				onOpenBreakdown={(stat) => setDrawer({ kind: 'stat', stat })}
				heroicInspiration={character.play?.heroicInspiration ?? false}
				onToggleHeroicInspiration={onEditHeroicInspiration}
				identity={
					<div className="sheet__header">
						<p className="sheet__identity">
							<span className="sheet__species">
								{character.species ? character.species.name : <UnresolvedValue reason="No species chosen yet." />}
								{character.species && (
									<span className="sheet__size">
										{' ('}
										{size.status === 'unknown' ? <UnresolvedValue reason={size.reason} /> : (SIZE_LABELS[size.value] ?? size.value)}
										{')'}
									</span>
								)}
							</span>
							{' · '}
							<span className="sheet__classes">
								{character.classes.length === 0 ? (
									<UnresolvedValue reason="No class chosen yet." />
								) : (
									character.classes.map((c, index) => (
										<span key={index}>
											{index > 0 ? ' / ' : ''}
											{c.className} {c.level}
											{c.subclass ? ` (${c.subclass})` : ''}
										</span>
									))
								)}
							</span>
							{character.classes.length > 0 && ` · Level ${totalCharacterLevel(character)}`}
							{' · '}
							<span className="sheet__background">
								{character.background ? character.background.name : <UnresolvedValue reason="No background chosen yet." />}
							</span>
						</p>

						{onEditCharacter && (
							<button type="button" className="sheet__edit-character sheet__header-button" onClick={onEditCharacter}>
								Edit character
							</button>
						)}
						{onLevelUp && <LevelUpButton character={character} onLevelUp={onLevelUp} />}
						{onRemoveLevel && <RemoveLevelButton character={character} onRemoveLevel={onRemoveLevel} />}
					</div>
				}
				abilities={
					<AbilityModifierCards
						abilityScores={abilityScores}
						labels={ABILITY_LABELS}
						onRoll={recordRoll}
						onOpenBreakdown={(ability) => setDrawer({ kind: 'ability', ability })}
					/>
				}
				defenses={
					<DefensesCard
						responses={damageResponses}
						loading={itemRefs === null || damageResponseData === null}
						dataError={damageResponseDataError}
						onOpen={() => setDrawer({ kind: 'defenses' })}
					/>
				}
			/>

			<div className="sheet__body">
			{/* Rework R3 (D123/D147): saves, senses (passive values + darkvision + granted senses) and skills — the dissolved stats tab's content, now always visible beside every other tab. B2 (D170) adds Proficiencies (armor/weapons; tools/languages pending). */}
			<div className="sheet__left-column">
			<div className="sheet__left-a">

			<section className="sheet__saving-throws">
				<div className="sheet__card-heading">
					<h2>Saving throws</h2>
					<button type="button" className="sheet__icon-button" aria-label="Saving throws details" onClick={() => setDrawer({ kind: 'saves' })}>
						<GearIcon />
					</button>
				</div>
				<ul>
					{ABILITIES.map((ability) => {
						const result = savingThrows[ability]
						return (
							<li key={ability} className="sheet__row">
								<ProfMark mark={result.status === 'known' ? SAVE_STATUS_MARKS[result.value.status] : '?'} status={result.status === 'known' ? result.value.status : 'unknown'} />
								<button
									type="button"
									className="sheet__row-name"
									title={ABILITY_LABELS[ability]}
									aria-label={`${ABILITY_LABELS[ability]} saving throw breakdown`}
									onClick={() => setDrawer({ kind: 'save', ability })}
								>
									{ABILITY_LABELS[ability].slice(0, 3).toUpperCase()}
								</button>
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<RollButton modifier={result.value.modifier} label={`${ABILITY_LABELS[ability]} saving throw`} onRoll={recordRoll}>
										{formatModifier(result.value.modifier)}
									</RollButton>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			{/*
			 * R4 (D163): the passive values and darkvision are one "Senses" card, and
			 * every breakdown they used to carry inline now lives only in the drawer the
			 * gear opens (D133/D146). The granted-sense list keeps its own class and its
			 * "no empty heading" rule, nested here so the left column has one Senses card
			 * rather than two blocks under the same word.
			 */}
			<section className="sheet__senses-card">
				<div className="sheet__card-heading">
					<h2>Senses</h2>
					<button type="button" className="sheet__icon-button" aria-label="Senses details" onClick={() => setDrawer({ kind: 'senses' })}>
						<GearIcon />
					</button>
				</div>
				<ul>
					<li>
						<span className="sheet__sense-number"><CalculatedValueOnly result={passivePerception} /></span> Passive Perception
					</li>
					<li>
						<span className="sheet__sense-number"><CalculatedValueOnly result={passiveInvestigation} /></span> Passive Investigation
					</li>
					<li>
						<span className="sheet__sense-number"><CalculatedValueOnly result={passiveInsight} /></span> Passive Insight
					</li>
					<li>
						Darkvision:{' '}
						{darkvision.status === 'unknown' ? (
							<UnresolvedValue reason={darkvision.reason} />
						) : (
							<span>{darkvision.value > 0 ? `${darkvision.value} ft.` : 'None'}</span>
						)}
					</li>
				</ul>
				<SensesList entries={combinedSenses} error={grantedSensesError} />
			</section>

			<section className="sheet__proficiencies">
				<div className="sheet__card-heading">
					<h2>Proficiencies</h2>
					<button type="button" className="sheet__icon-button" aria-label="Proficiencies details" onClick={() => setDrawer({ kind: 'proficiencies' })}>
						<GearIcon />
					</button>
				</div>
				{weaponAttackDataError && <p role="alert">{weaponAttackDataError}</p>}
				<ul>
					{PROFICIENCY_ROWS.map(([category, label]) => (
						<li key={category}>
							<span className="sheet__proficiency-label">{label.toUpperCase()}</span>
							<span>{weaponAttackData === null ? 'Loading…' : weaponAttackData.proficiencies[category].map((item) => item.label).join(', ') || 'None'}</span>
						</li>
					))}
				</ul>
			</section>

			</div>
			<div className="sheet__left-b">

			<section className="sheet__skills">
				<div className="sheet__card-heading">
					<h2>Skills</h2>
					<button type="button" className="sheet__icon-button" aria-label="Skills details" onClick={() => setDrawer({ kind: 'skills' })}>
						<GearIcon />
					</button>
				</div>
				<ul>
					{SKILLS.map((skill) => {
						const result = skills[skill]
						return (
							<li key={skill} className="sheet__row">
								<ProfMark mark={result.status === 'known' ? SKILL_STATUS_MARKS[result.value.status] : '?'} status={result.status === 'known' ? result.value.status : 'unknown'} />
								<span className="sheet__row-ability" title={ABILITY_LABELS[SKILL_ABILITIES[skill]]}>
									{ABILITY_LABELS[SKILL_ABILITIES[skill]].slice(0, 3).toUpperCase()}
								</span>
								<button
									type="button"
									className="sheet__row-name sheet__row-name--skill"
									aria-label={`${SKILL_LABELS[skill]} breakdown`}
									onClick={() => setDrawer({ kind: 'skill', skill })}
								>
									{SKILL_LABELS[skill]}
								</button>
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<RollButton modifier={result.value.modifier} label={`${SKILL_LABELS[skill]} check`} onRoll={recordRoll}>
										{formatModifier(result.value.modifier)}
									</RollButton>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			</div>
			</div>
			<div className="sheet__right-panel">

			{/*
			 * Sheet rebuild slice 2 — the sections below are split across tabs.
			 * Panels stay mounted and are hidden by the `.sheet__panel` stylesheet
			 * rule, not the `hidden` attribute or an inline display:none: those drop
			 * a panel out of the accessibility tree, and the sheet's tests query
			 * sections by role no matter which tab is open (jsdom loads no
			 * stylesheet, so every panel stays reachable there).
			 */}
			<nav className="sheet__tabs" role="tablist" aria-label="Sekce listu postavy">
				{SHEET_TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						role="tab"
						id={`sheet-tab-${tab.id}`}
						aria-controls={`sheet-panel-${tab.id}`}
						aria-selected={activeTab === tab.id}
						className={activeTab === tab.id ? 'sheet__tab sheet__tab--active' : 'sheet__tab'}
						onClick={() => setActiveTab(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</nav>

			<div className="sheet__panels">

			<div
				role="tabpanel"
				id="sheet-panel-spells"
				aria-labelledby="sheet-tab-spells"
				className={activeTab === 'spells' ? 'sheet__panel sheet__panel--active' : 'sheet__panel'}
			>
			{isCaster && (
				<div className="sheet__spell-header">
					{spellcastingSources.length > 0 && (
						<div className="sheet__spell-attacks">
							{spellcastingSources.map((source) => {
								const abilityScore = abilityScores[source.ability]
								return (
									<div key={source.key} className="sheet__spell-source" role="group" aria-label={`${source.name} spellcasting`}>
										{spellcastingSources.length > 1 && (
											<p className="sheet__spell-source-label">
												{source.name} ({ABILITY_LABELS[source.ability].slice(0, 3).toUpperCase()})
											</p>
										)}
										<div className="sheet__spell-stats">
											<div className="sheet__spell-stat">
												<span className="sheet__spell-stat-label">Modifier</span>
												<span className="sheet__spell-stat-value">
													{abilityScore.status === 'known' ? formatModifier(abilityScore.value.modifier) : <UnresolvedValue reason={abilityScore.reason} />}
												</span>
											</div>
											<div className="sheet__spell-stat">
												<span className="sheet__spell-stat-label">Spell Attack</span>
												<button
													type="button"
													className="sheet__spell-stat-value sheet__spell-stat-button"
													aria-label={`${source.name} spell attack breakdown`}
													onClick={() => setDrawer({ kind: 'spellcasting', key: source.key, part: 'attack' })}
												>
													{formatModifier(source.spellAttackBonus)}
												</button>
											</div>
											<div className="sheet__spell-stat">
												<span className="sheet__spell-stat-label">Save DC</span>
												<button
													type="button"
													className="sheet__spell-stat-value sheet__spell-stat-button"
													aria-label={`${source.name} save DC breakdown`}
													onClick={() => setDrawer({ kind: 'spellcasting', key: source.key, part: 'dc' })}
												>
													{source.spellSaveDC}
												</button>
											</div>
										</div>
									</div>
								)
							})}
						</div>
					)}
					{hasSpellSlots && (
						<button type="button" className="sheet__actions-per-action-label sheet__spell-slots-button" onClick={() => setDrawer({ kind: 'spellSlots' })}>
							Spell Slots
						</button>
					)}
				</div>
			)}

			{/* The section appears for a failed grant load even with nothing to list — an empty spell list and a spell list that could not be built must not look alike (D43). */}
			{(isCaster || combinedSpells.length > 0 || spellLoadErrors.length > 0 || raceSpells.notes.length > 0) && (
				<SpellsSection
					sections={spellSections}
					casterOf={(row) => spellsTabRowCaster(row, spellcastingEntries, featSpellcastingEntries, speciesSpellcastingEntries)}
					characterLevel={character.classes.reduce((sum, c) => sum + c.level, 0)}
					castingClassName={spellcastingEntries.length === 1 ? spellcastingEntries[0]!.className : null}
					spentSpellSlots={spentSpellSlots}
					pactRecharge={pactShortRest !== null ? 'Short Rest' : 'Long Rest'}
					concentratingOn={concentratingOn}
					resolverData={resolverData}
					resourceUses={resourceUses}
					resourceMaxima={resourceMaxima}
					resourceRecharge={resourceRecharge}
					onRoll={recordRoll}
					onSpendOrdinary={onEditSpentSpellSlots ? spendOrdinarySlot : undefined}
					onSpendPact={onEditSpentSpellSlots ? spendPactSlot : undefined}
					onCast={onEditSpentSpellSlots ? castSpell : undefined}
					onUse={onEditResourceUses ? useSpell : undefined}
					onSpendResource={onEditResourceUses ? spendResource : undefined}
					onToggleConcentration={onEditConcentration ? toggleConcentration : undefined}
					onManageSpells={canManageSpells ? () => setDrawer({ kind: 'manageSpells' }) : undefined}
					notices={
				<>
					{spellLoadErrors.map((error) => (
						<p key={error.what} className="error">
							Could not load {error.what}: {error.message}
						</p>
					))}
					{/* The 5 species whose grant is a "pick a cantrip from a class list" filter (raceSpells.ts): no picker exists yet, so the gap is stated rather than left blank (D43/D58). */}
					{raceSpells.notes.map((note) => (
						<p key={note.text} className="sheet__spells-note">
							<UnresolvedValue reason={note.text} />
						</p>
					))}
					{/* Slice 8e2 (D106): the "cannot tell" case (D43) — multiclassing, or a class this app's data has nothing for — replaces both notices below rather than showing a count that would silently ignore the gap. */}
					{spellLimitReason !== null && hasChosenSpells && (
						<p className="sheet__spell-limit-unknown">
							<UnresolvedValue reason={spellLimitReason} />
						</p>
					)}
					{/* The count-only notice (D106): which spell is over the limit is unknowable (freely swapped, D104), so only how many is shown — never a guess at which one. */}
					{spellLimitReason === null && spellCountEntry && cantripsStored > spellCountEntry.cantripCount && (
						<p className="sheet__spell-count-over">
							Cantrips: {cantripsStored} known, {spellCountEntry.cantripCount} allowed.
						</p>
					)}
					{spellLimitReason === null && spellCountEntry && leveledSpellsStored > spellCountEntry.leveledSpellCount && (
						<p className="sheet__spell-count-over">
							Spells {spellCountEntry.label}: {leveledSpellsStored} {spellCountEntry.label}, {spellCountEntry.leveledSpellCount} allowed.
						</p>
					)}
				</>
					}
				/>
			)}
			</div>

			<div
				role="tabpanel"
				id="sheet-panel-inventory"
				aria-labelledby="sheet-tab-inventory"
				className={activeTab === 'inventory' ? 'sheet__panel sheet__panel--active' : 'sheet__panel'}
			>
			<InventorySection
				inventory={character.inventory ?? []}
				currencyCopper={character.currencyCopper ?? 0}
				itemRefs={itemRefs}
				itemRefsError={itemRefsError}
				itemEntryTemplates={itemEntryTemplates}
				attunementLimit={attunementLimit}
				onManageInventory={onEditInventory || onEditCurrency ? () => setDrawer({ kind: 'manageInventory' }) : undefined}
			/>
			</div>

			<div
				role="tabpanel"
				id="sheet-panel-features"
				aria-labelledby="sheet-tab-features"
				className={activeTab === 'features' ? 'sheet__panel sheet__panel--active' : 'sheet__panel'}
			>
			<FeaturesSection
				groups={featureGroups}
				errors={
					<>
						{grantedFeaturesError && <p className="error">Could not load class and subclass features: {grantedFeaturesError}</p>}
						{classFeatureChoicesError && <p className="error">Could not load class feature choices: {classFeatureChoicesError}</p>}
						{classOptionalFeaturesError && <p className="error">Could not load the options chosen for your class: {classOptionalFeaturesError}</p>}
						{speciesTraitsError && <p className="error">Could not load species traits: {speciesTraitsError}</p>}
					</>
				}
				resourceMaxima={resourceMaxima}
				resourceRecharge={resourceRecharge}
				resourceUses={resourceUses}
				resolverData={resolverData}
				onSpendResource={onEditResourceUses ? spendResource : undefined}
				classExtras={
				<>
				{/* The Beast forms a Druid knows for Wild Shape. Nothing renders for a character with none — no empty heading. Uses per rest and transforming are play tracking (step 9), not shown. */}
				{wildShapeForms.length > 0 && (
				<section className="sheet__wild-shape-forms">
					<h2>Wild Shape forms</h2>
					{/* The forms are listed from storage, so this section never vanished — but without this line every one of them reads "no stat block found", blaming the form for a failure of the whole fetch. */}
					{beastsError && <p className="error">Could not load Beast stat blocks: {beastsError}</p>}
					{/* Slice 8e2 (D106): the count-only notice — which form is surplus is unknowable (D104), so only how many is shown, same spirit as the spell counts above. */}
					{wildShapeOverages.map((overage) =>
						overage.status === 'unknown' ? (
							<p key={overage.key} className="sheet__wild-shape-count-unknown">
								<UnresolvedValue reason={overage.reason} />
							</p>
						) : (
							overage.stored > overage.allowed && (
								<p key={overage.key} className="sheet__wild-shape-count-over">
									{overage.className} Wild Shape forms: {overage.stored} known, {overage.allowed} allowed.
								</p>
							)
						),
					)}
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
				</>
				}
			/>
			</div>

			<div
				role="tabpanel"
				id="sheet-panel-actions"
				aria-labelledby="sheet-tab-actions"
				className={activeTab === 'actions' ? 'sheet__panel sheet__panel--active' : 'sheet__panel'}
			>
			<ActionsSection
				attacks={weaponAttacks}
				attacksPerAction={attacksPerAction}
				spellActions={spellActions}
				featureActions={featureActions}
				spellGroups={spellGroupRows(combinedSpells, spellDetails)}
				combatActions={visibleCombatActions(combatActions, holdsTwoLightWeapons(heldWeapons))}
				resourceMaxima={resourceMaxima}
				resourceRecharge={resourceRecharge}
				resourceUses={resourceUses}
				resolverData={resolverData}
				loading={itemRefs === null || weaponAttackData === null}
				dataError={weaponAttackDataError}
				onRoll={recordRoll}
				onOpenBreakdown={(key) => setDrawer({ kind: 'action', key })}
				onOpenAttacksPerAction={() => setDrawer({ kind: 'attacksPerAction' })}
				onChooseAttackAbility={onEditInventory ? chooseAttackAbility : undefined}
				onSpendResource={onEditResourceUses ? spendResource : undefined}
				ammoFor={(ammoType) => ammoEntriesFor(ammoType, character.inventory ?? [], itemRefs ?? [])}
				onSpendAmmo={onEditInventory ? spendAmmoEntry : undefined}
			/>
			</div>

			<div
				role="tabpanel"
				id="sheet-panel-notes"
				aria-labelledby="sheet-tab-notes"
				className={activeTab === 'notes' ? 'sheet__panel sheet__panel--active' : 'sheet__panel'}
			>
				{TEXT_SECTIONS.map(({ field, label }) => (
					<TextSection
						key={`${character.id}|${field}`}
						label={label}
						stored={character[field]}
						onEdit={onEditText ? (text) => onEditText(field, text) : undefined}
					/>
				))}
			</div>
			</div>
			</div>
			</div>

			{/* D163: fixed to the window, so where it sits in the markup decides nothing about the layout. */}
			{drawer?.kind === 'senses' && (
				<Drawer title="Senses" onClose={() => setDrawer(null)}>
					<DrawerSection title="Passive Perception">
						<CalculatedNumber result={passivePerception} breakdownOpen />
					</DrawerSection>
					<DrawerSection title="Passive Investigation">
						<CalculatedNumber result={passiveInvestigation} breakdownOpen />
					</DrawerSection>
					<DrawerSection title="Passive Insight">
						<CalculatedNumber result={passiveInsight} breakdownOpen />
					</DrawerSection>
					<DrawerSection title="Darkvision">
						{darkvision.status === 'unknown' ? (
							<UnresolvedValue reason={darkvision.reason} />
						) : (
							<>
								<span>{darkvision.value > 0 ? `${darkvision.value} ft.` : 'None'}</span> <ValueBreakdown breakdown={darkvision.breakdown} open />
							</>
						)}
					</DrawerSection>
				</Drawer>
			)}

			{drawer?.kind === 'hitPoints' && (
				<Drawer title="Hit Points" onClose={() => setDrawer(null)}>
					<HitPointsPanel {...hitPointProps} deathSaveRoll={deathSaveRoll} />
				</Drawer>
			)}

			{drawer?.kind === 'shortRest' && (
				<Drawer title="Short Rest" onClose={() => setDrawer(null)}>
					<DrawerSection title="Hit Dice">{hitDiceLine}</DrawerSection>
					{/* D183: the rest itself happens here; closing the drawer any other way leaves the rolls and skips the recovery. */}
					<button
						type="button"
						className="btn--accent btn--finish-rest"
						onClick={() => {
							takeShortRest()
							setDrawer(null)
						}}
					>
						<FireIcon />
						Finish Short Rest
					</button>
				</Drawer>
			)}

			{drawer?.kind === 'defenses' && (
				<Drawer title="Defenses" onClose={() => setDrawer(null)}>
					<DamageResponsesSection
						responses={damageResponses}
						loading={itemRefs === null || damageResponseData === null}
						dataError={damageResponseDataError}
					/>
				</Drawer>
			)}

			{drawer?.kind === 'rolls' && (
				<Drawer title="Roll history" onClose={() => setDrawer(null)}>
					<RollHistory entries={rollHistory} />
				</Drawer>
			)}

			{drawer?.kind === 'ability' && (
				<Drawer title={ABILITY_LABELS[drawer.ability]} onClose={() => setDrawer(null)}>
					<AbilityScorePanel result={abilityScores[drawer.ability]} />
				</Drawer>
			)}

			{drawer?.kind === 'action' && (() => {
				const attack = weaponAttacks.find((candidate) => candidate.key === drawer.key)
				const spell = spellActions.find((candidate) => `spell|${candidate.key}` === drawer.key)
				const title = attack?.name ?? spell?.name
				return (
					title !== undefined && (
						<Drawer title={title} onClose={() => setDrawer(null)}>
							<ActionBreakdown attack={attack} spell={spell} />
						</Drawer>
					)
				)
			})()}

			{drawer?.kind === 'attacksPerAction' && (
				<Drawer title="Attacks per Action" onClose={() => setDrawer(null)}>
					<CalculatedNumber result={attacksPerAction} breakdownOpen />
				</Drawer>
			)}

			{drawer?.kind === 'spellcasting' &&
				(() => {
					const source = spellcastingSources.find((candidate) => candidate.key === drawer.key)
					if (!source) return null
					const label = `${source.name} (${ABILITY_LABELS[source.ability]})`
					return (
						<Drawer title={drawer.part === 'attack' ? 'Spell Attack' : 'Save DC'} onClose={() => setDrawer(null)}>
							<DrawerSection title={label}>
								<p className="drawer__value">{drawer.part === 'attack' ? formatModifier(source.spellAttackBonus) : source.spellSaveDC}</p>
								<ValueBreakdown breakdown={drawer.part === 'attack' ? source.spellAttackBreakdown : source.spellSaveDCBreakdown} open />
							</DrawerSection>
						</Drawer>
					)
				})()}

			{drawer?.kind === 'spellSlots' && (
				<Drawer title="Spell Slots" onClose={() => setDrawer(null)}>
					{spellSlotsEntries.map((entry) => (
						<Fragment key={`${entry.className}|${entry.classSource}`}>
							{entry.ordinarySlots && (
								<DrawerSection title={entry.className}>
									<ValueBreakdown breakdown={entry.ordinarySlotsBreakdown ?? []} open />
								</DrawerSection>
							)}
							{/* D11: Pact Magic under its own heading, never a line of the ordinary list. */}
							{entry.pactSlots && (
								<DrawerSection title="Pact Magic">
									<p className="drawer__value">
										{entry.pactSlots.count} slot{entry.pactSlots.count === 1 ? '' : 's'} (level {entry.pactSlots.slotLevel})
									</p>
									<ValueBreakdown breakdown={entry.pactSlotsBreakdown ?? []} open />
								</DrawerSection>
							)}
						</Fragment>
					))}
				</Drawer>
			)}

			{drawer?.kind === 'manageSpells' && onEditSpellChoices && (
				<Drawer title="Manage Spells" onClose={() => setDrawer(null)}>
					{slotMaxima.ordinary.some((count) => count > 0) && (
						<DrawerSection
							title="Spell Slots"
							summary={slotMaxima.ordinary.flatMap((count, index) => (count > 0 ? [`${ordinalLevel(index + 1)} ${count}`] : [])).join(' · ')}
						>
							{slotMaxima.ordinary.map((count, index) => {
								const level = index + 1
								return (
									count > 0 && (
										<div key={level} className="manage-spells__slot-row">
											<span className="manage-spells__slot-label">{sectionLabel(level)}</span>
											<UseBoxes
												name={`level ${level} spell slots`}
												spent={spentSpellSlots.ordinary?.[level] ?? 0}
												max={count}
												recharge="Long Rest"
												onChange={onEditSpentSpellSlots ? (delta) => spendOrdinarySlot(level, count, delta) : undefined}
											/>
										</div>
									)
								)
							})}
						</DrawerSection>
					)}
					{slotMaxima.pact > 0 && (
						<DrawerSection title="Pact Magic" summary={`${ordinalLevel(pactSlotLevel)} ${slotMaxima.pact}`}>
							<div className="manage-spells__slot-row">
								<span className="manage-spells__slot-label">{sectionLabel(pactSlotLevel)}</span>
								<UseBoxes
									name="Pact Magic slots"
									spent={spentSpellSlots.pact ?? 0}
									max={slotMaxima.pact}
									recharge={pactShortRest !== null ? 'Short Rest' : 'Long Rest'}
									onChange={onEditSpentSpellSlots ? (delta) => spendPactSlot(slotMaxima.pact, delta) : undefined}
								/>
							</div>
						</DrawerSection>
					)}
					{managedClasses.map(({ characterClass, counts, holdings, alreadyKnown }) => (
						<ClassSpellsManager
							key={`${characterClass.className}|${characterClass.classSource}`}
							className={characterClass.className}
							classSource={characterClass.classSource}
							classLevel={characterClass.level}
							subclassName={characterClass.subclass}
							cantripCount={counts.cantripCount}
							leveledSpellCount={counts.leveledSpellCount}
							spellSlots={spellSlotsEntries.find((entry) => entry.className === characterClass.className && entry.classSource === characterClass.classSource)}
							featChoices={chosenFeats.map((feat) => ({ name: feat.name, source: feat.source }))}
							holdings={holdings}
							alreadyKnown={alreadyKnown}
							details={spellDetails}
							resolverData={resolverData}
							onChange={(picks) => onEditSpellChoices(withClassPicks(character.spellChoices ?? [], characterClass.className, characterClass.classSource, picks))}
						/>
					))}
				</Drawer>
			)}

			{drawer?.kind === 'manageInventory' && (
				<Drawer title="Manage Inventory" onClose={() => setDrawer(null)}>
					<ManageInventoryPanel
						inventory={character.inventory ?? []}
						currencyCopper={character.currencyCopper ?? 0}
						itemRefs={itemRefs}
						itemRefsError={itemRefsError}
						itemEntryTemplates={itemEntryTemplates}
						attunementLimit={attunementLimit}
						onEditInventory={onEditInventory}
						onEditCurrency={onEditCurrency}
					/>
				</Drawer>
			)}

			{drawer?.kind === 'save' && (
				<Drawer title={`${ABILITY_LABELS[drawer.ability]} saving throw`} onClose={() => setDrawer(null)}>
					<RowBreakdown result={savingThrows[drawer.ability]} />
				</Drawer>
			)}

			{drawer?.kind === 'skill' && (
				<Drawer title={SKILL_LABELS[drawer.skill]} onClose={() => setDrawer(null)}>
					<RowBreakdown result={skills[drawer.skill]} />
				</Drawer>
			)}

			{drawer?.kind === 'saves' && (
				<Drawer title="Saving throws" onClose={() => setDrawer(null)}>
					{ABILITIES.map((ability) => (
						<DrawerSection key={ability} title={ABILITY_LABELS[ability]}>
							<RowBreakdown result={savingThrows[ability]} />
						</DrawerSection>
					))}
				</Drawer>
			)}

			{drawer?.kind === 'skills' && (
				<Drawer title="Skills" onClose={() => setDrawer(null)}>
					{SKILLS.map((skill) => (
						<DrawerSection key={skill} title={SKILL_LABELS[skill]}>
							<RowBreakdown result={skills[skill]} />
						</DrawerSection>
					))}
				</Drawer>
			)}

			{drawer?.kind === 'proficiencies' && (
				<Drawer title="Proficiencies" onClose={() => setDrawer(null)}>
					{PROFICIENCY_ROWS.map(([category, label]) => (
						<DrawerSection key={category} title={label}>
							{weaponAttackData === null ? (
								<p>Loading…</p>
							) : weaponAttackData.proficiencies[category].length === 0 ? (
								<p>None</p>
							) : (
								<ul>
									{weaponAttackData.proficiencies[category].map((item) => (
										<li key={item.key}>
											{item.label} — {item.sources.map((source) => source.name).join(', ')}
										</li>
									))}
								</ul>
							)}
							{category === 'tools' && weaponAttackData !== null && onEditToolChoices && (
								<ClassToolSlots
									grants={classToolGrantsFor(character.classes, toolsHeldElsewhere(weaponAttackData.proficiencies.tools, character.classes[0]?.subclass ?? null))}
									value={character.toolChoices ?? []}
									known={weaponAttackData.proficiencies.tools.filter((item) => !item.pending).map((item) => item.label)}
									onChange={onEditToolChoices}
								/>
							)}
							{category === 'languages' && weaponAttackData !== null && onEditLanguages && (
								<FeatureLanguageSlots
									grants={classFeatureLanguageGrantsFor(character.classes)}
									value={(character.languages ?? []).filter((language) => language.grantedBy !== 'automatic' && language.grantedBy !== 'creation')}
									known={weaponAttackData.proficiencies.languages.filter((item) => !item.pending).map((item) => item.label)}
									onChange={(picks) =>
										onEditLanguages([...(character.languages ?? []).filter((language) => language.grantedBy === 'automatic' || language.grantedBy === 'creation'), ...picks])
									}
								/>
							)}
						</DrawerSection>
					))}
				</Drawer>
			)}

			{drawer?.kind === 'stat' && drawer.stat === 'proficiency' && (
				<Drawer title="Proficiency bonus" onClose={() => setDrawer(null)}>
					<CalculatedNumber result={proficiencyBonus} format={formatModifier} breakdownOpen />
				</Drawer>
			)}

			{drawer?.kind === 'stat' && drawer.stat === 'initiative' && (
				<Drawer title="Initiative" onClose={() => setDrawer(null)}>
					<CalculatedNumber result={initiative} format={formatModifier} breakdownOpen />
				</Drawer>
			)}

			{drawer?.kind === 'stat' && drawer.stat === 'speed' && (
				<Drawer title="Speed" onClose={() => setDrawer(null)}>
					{speed.status === 'unknown' ? (
						<UnresolvedValue reason={speed.reason} />
					) : (
						<>
							<p className="drawer__value">{formatSpeed(speed.value)}</p>
							<ValueBreakdown breakdown={speed.breakdown} open />
						</>
					)}
				</Drawer>
			)}

			{drawer?.kind === 'stat' && drawer.stat === 'armour' && (
				<Drawer title="Armour Class" onClose={() => setDrawer(null)}>
					{armourClass.status === 'unknown' ? (
						<UnresolvedValue reason={armourClass.reason} />
					) : (
						<>
							<p className="drawer__value">{armourClass.value.value}</p>
							<ValueBreakdown breakdown={armourClass.breakdown} open />
							<ArmourClassNotes armourClass={armourClass.value} formulaError={acFormulaKeysError} />
						</>
					)}
				</Drawer>
			)}
		</article>
		<RollToast showRef={toastRef} />
		</RollModeContext.Provider>
	)
}

export default CharacterSheet
