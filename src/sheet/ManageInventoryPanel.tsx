import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BASE_ATTUNEMENT_LIMIT, countAttuned, describeAttunementRefusal } from '../calculation/attunement'
import { putDown, takeInHand, toggleEquip, type EquipResult } from '../inventory/equipActions'
import { resolveMagicBonus } from '../calculation/magicBonus'
import { type Calculated } from '../calculation/types'
import { damageTypeLabel, DAMAGE_TYPES } from '../calculation/damageResponses'
import { Entries } from '../markup'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import { coinsToCopper, copperToCoins, platinumToCopper } from '../inventory/currency'
import {
	buildInventoryResolver,
	customItemFromRef,
	customItemRef,
	CUSTOM_ARMOUR_CATEGORIES,
	CUSTOM_ITEM_KINDS,
	CUSTOM_WEAPON_CATEGORIES,
	CUSTOM_WEAPON_RANGES,
	equipSlotOf,
	inventoryRowKey,
	isMagicItem,
	isVersatileWeapon,
	ITEM_FILTER_KINDS,
	itemFilterKindsOf,
	itemKey,
	itemMagicBonusOf,
	withQuantity,
	type ItemFilterKind,
	type ItemRef,
} from '../inventory/inventoryData'
import { resolveItemEntryRefs, type ItemEntryTemplate } from '../inventory/itemEntryResolver'
import {
	CUSTOM_ITEM_SOURCE,
	type CharacterInventoryItem,
	type CustomArmourCategory,
	type CustomItemDefinition,
	type CustomItemKind,
	type CustomWeaponCategory,
	type CustomWeaponRange,
	type MagicItemBonus,
	type WeaponGrip,
} from '../storage/character'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'
import { bonusesFromRows, bonusRowsFrom, CustomItemBonusList, type BonusRow } from './CustomItemBonusList'
import { ConditionChoice, CustomItemProficiencyList, proficienciesFromRows, proficiencyRowsFrom, type ProficiencyRow } from './CustomItemProficiencyList'
import { DrawerSection } from './Drawer'

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
	narrow = 'qty',
	showLabel = true,
}: {
	label: string
	value: number
	min: number
	onCommit: (value: number) => void
	/** R3c: width guide (6ch for quantities, 8ch for money) — 'qty' unless the caller says otherwise. */
	narrow?: 'qty' | 'money'
	showLabel?: boolean
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
			{showLabel && <>{label} </>}
			<input
				type="number"
				min={min}
				className={narrow === 'money' ? 'input--narrow-money' : 'input--narrow'}
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
 * A price entered in GOLD, committed to storage as whole copper (D74: coins
 * exist only at display and entry, and the stored number is copper). Gold can
 * carry a fraction — a torch costs one copper, which is 0.01 gp — so this
 * commits on `Number(draft)` rather than flooring it the way CommitNumberField
 * does; only the copper result is rounded, never the gold the player typed.
 */
function CommitGoldField({ label, copperValue, onCommit }: { label: string; copperValue: number; onCommit: (copper: number) => void }): ReactNode {
	const asGold = (copper: number) => String(copper / 100)
	const [draft, setDraft] = useState(asGold(copperValue))
	useEffect(() => {
		setDraft(asGold(copperValue))
	}, [copperValue])

	function commit(): void {
		const parsed = Number(draft)
		const gold = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
		const copper = Math.round(gold * 100)
		setDraft(asGold(copper))
		if (copper !== copperValue) onCommit(copper)
	}

	return (
		<label>
			{label}{' '}
			<input
				type="number"
				min={0}
				step={0.01}
				className="input--narrow-money"
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

/*
 * Platinum is entry-only: the breakdown beside this field reads in gp/sp/cp, so
 * there is no platinum value to show back. What is typed is ADDED to the stored
 * copper and the field clears itself — 5 typed here reappears as 50 gp.
 */
function AddPlatinumField({ onAdd }: { onAdd: (platinum: number) => void }): ReactNode {
	const [draft, setDraft] = useState('')

	function commit(): void {
		const parsed = Math.floor(Number(draft))
		setDraft('')
		if (Number.isFinite(parsed) && parsed > 0) onAdd(parsed)
	}

	return (
		<label>
			Add platinum{' '}
			<input
				type="number"
				min={0}
				className="input--narrow-money"
				aria-label="Add platinum"
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

/** The row back in one hand — the key is removed, since absent is what "one-handed" means in storage (slice b-fix). */
function oneHanded(row: CharacterInventoryItem): CharacterInventoryItem {
	const rest = { ...row }
	delete rest.grip
	return rest
}

/** The row with its attunement ended — the key is removed, since absent is what "not attuned" means in storage. */
function unattuned(row: CharacterInventoryItem): CharacterInventoryItem {
	const rest = { ...row }
	delete rest.attuned
	return rest
}

/** The row with a player-set magic bonus, or with the field removed — absent is what "none set" means in storage (slice e). */
function withMagicBonus(row: CharacterInventoryItem, bonus: MagicItemBonus | null): CharacterInventoryItem {
	if (bonus === null) {
		const rest = { ...row }
		delete rest.magicBonus
		return rest
	}
	return { ...row, magicBonus: bonus }
}

const MAGIC_BONUS_NONE = ''
const MAGIC_BONUS_OPTIONS: MagicItemBonus[] = [1, 2, 3]

/**
 * The item's own text (build order step 7, slice g), rendered through the
 * shared markup renderer — none of it is plain English (D35) and a second
 * renderer, or a regex stripping the tags, would drift from the first.
 *
 * The text is passed through unchanged: not summarised, not reordered, and the
 * parts the app cannot compute are left in, because those are exactly the ones
 * the player has to read for himself (D21).
 *
 * Collapsed regardless of length. The slice's survey
 * (scripts/investigate-item-descriptions.js) measured a median of 330
 * characters, 262 items over 500 and 108 over a thousand, the longest 9,971 —
 * so expanding by length would leave the ordinary row long enough to push its
 * own controls off the screen, and the threshold itself would be arbitrary.
 */
export function ItemDescription({ entries, label }: { entries: unknown[]; label: string }): ReactNode {
	return (
		<details className="sheet__item-description">
			<summary>Description of {label}</summary>
			<Entries entries={entries} />
		</details>
	)
}

/** An item's price in the coins the sheet reads money in (D74 — gold, silver, copper, never platinum). Zero denominations are left out; a free item still reads "0 cp". */
export function itemValueText(copper: number): string {
	const coins = copperToCoins(copper)
	const parts: string[] = []
	if (coins.gp > 0) parts.push(`${coins.gp} gp`)
	if (coins.sp > 0) parts.push(`${coins.sp} sp`)
	if (coins.cp > 0) parts.push(`${coins.cp} cp`)
	return parts.length > 0 ? parts.join(' ') : '0 cp'
}

/** An empty definition — the "start from nothing" route's opening state. */
function blankCustomItem(): CustomItemDefinition {
	return { name: '', kind: 'other' }
}

/**
 * A number the definition may simply not have (slice e2b). Blank means the field
 * is absent, which is not the same as zero: an armour-kind item with no Armour
 * Class is announced as unfinished, while one declaring 0 is a suit that really
 * gives nothing. The draft is local to the form, so this commits per keystroke —
 * unlike CommitNumberField, nothing round-trips through storage while typing.
 */
/** `text` is the visible label when it differs from the aria-label; `positive` drops zero and negatives, which a fixed speed or sense range cannot be (describeCustomItemProblem would otherwise leave the item unreadable). */
function OptionalNumberField({ label, text, positive, value, onChange }: { label: string; text?: string; positive?: true; value: number | undefined; onChange: (value: number | undefined) => void }): ReactNode {
	return (
		<label>
			{text ?? label}{' '}
			<input
				type="number"
				className="input--narrow"
				aria-label={label}
				value={value === undefined ? '' : String(value)}
				onChange={(event) => {
					const text = event.target.value.trim()
					const parsed = Number(text)
					onChange(text === '' || !Number.isFinite(parsed) || (positive && Math.trunc(parsed) <= 0) ? undefined : Math.trunc(parsed))
				}}
			/>
		</label>
	)
}

/**
 * The damage types a custom item resists or is immune to, picked from the 13
 * the data uses so two spellings can never become two lines.
 *
 * Fix slice: this was a native multi-select, which needs ctrl-click to pick
 * more than one and cannot be driven from a touch screen at all — walking the
 * app turned up a resistance and an immunity picked by accident. Checkboxes,
 * one per damage type, all visible at once: nothing to select except what is
 * clicked.
 */
function DamageTypeChoice({ label, selected, onChange }: { label: string; selected: string[] | undefined; onChange: (types: string[] | undefined) => void }): ReactNode {
	const chosen = selected ?? []
	function toggle(type: string, checked: boolean): void {
		const next = checked ? [...chosen, type] : chosen.filter((entry) => entry !== type)
		onChange(next.length === 0 ? undefined : next)
	}
	return (
		// A <fieldset> is a block element and this sits inside the form's <p>s (D8's <details>-in-<p> regression is the same class of bug), so a <span> carries the group instead.
		<span className="sheet__damage-type-choice" role="group" aria-label={label}>
			{label}:{' '}
			{DAMAGE_TYPES.map((type) => (
				<label key={type}>
					<input
						type="checkbox"
						aria-label={`${label}: ${damageTypeLabel(type)}`}
						checked={chosen.includes(type)}
						onChange={(event) => toggle(type, event.target.checked)}
					/>{' '}
					{damageTypeLabel(type)}
				</label>
			))}
		</span>
	)
}

/**
 * Creating and editing a custom item (build order step 7, slices e2a and e2b).
 * Two routes into the same form: copy an existing item and change what you
 * want, or start from nothing. The copy route is the one that matters — a DM
 * turning a scarf into a magic item, or a player writing chain mail that does
 * not hamper Stealth, should not retype every field.
 *
 * EDITING is the same form seeded from the definition already stored (slice
 * e2b). It exists because the only alternative was remove-and-recreate, which
 * makes one typo in a name cost the whole item — and with it the row's quantity,
 * attunement and magic bonus.
 *
 * D9/D55: the form offers only what the app can act on structurally. Anything
 * else the item does goes in the description and is SHOWN — never applied
 * behind a value's back, or every breakdown on the sheet becomes untrustworthy.
 * That is why there is no field for "+1d8 against undead": the app would have
 * to read prose to honour it (D21). The Stealth disadvantage is the opposite
 * case and is a checkbox (slice e2c) — armourClass.ts already reads a boolean
 * for it, so leaving it out made a copied chain mail lose the disadvantage
 * silently instead of the player switching it off.
 */
function CustomItemForm({
	itemRefs,
	editing,
	onSubmit,
	onCancel,
}: {
	itemRefs: ItemRef[]
	/** The definition being changed, or null when a new item is being made. */
	editing: CustomItemDefinition | null
	onSubmit: (custom: CustomItemDefinition) => void
	onCancel: () => void
}): ReactNode {
	const [draft, setDraft] = useState<CustomItemDefinition>(() => editing ?? blankCustomItem())
	/* The rows replace draft.bonuses until submit — a row may be half-typed, which a CustomItemBonus cannot hold. */
	const [bonusRows, setBonusRows] = useState<BonusRow[]>(() => bonusRowsFrom(editing?.bonuses))
	const [proficiencyRows, setProficiencyRows] = useState<ProficiencyRow[]>(() => proficiencyRowsFrom(editing?.proficiencies))
	const [copiedKey, setCopiedKey] = useState<string | null>(null)

	function update(change: Partial<CustomItemDefinition>): void {
		setDraft((current) => ({ ...current, ...change }))
	}

	/** An absent field is what "not set" means in storage, so a blank input removes the key rather than storing "" or 0. */
	function updateOptional<K extends keyof CustomItemDefinition>(key: K, value: CustomItemDefinition[K] | undefined): void {
		setDraft((current) => {
			const next = { ...current }
			if (value === undefined || (typeof value === 'string' && value === '')) delete next[key]
			else next[key] = value
			return next
		})
	}

	function copyFrom(key: string): void {
		const ref = itemRefs.find((candidate) => itemKey(candidate) === key)
		if (!ref) return
		setCopiedKey(key)
		const copied = customItemFromRef(ref)
		setDraft(copied)
		setBonusRows(bonusRowsFrom(copied.bonuses))
		setProficiencyRows(proficiencyRowsFrom(copied.proficiencies))
	}

	function submit(): void {
		if (draft.name.trim() === '') return
		const { bonuses: _replaced, proficiencies: _replacedProficiencies, ...rest } = draft
		const bonuses = bonusesFromRows(bonusRows)
		const proficiencies = proficienciesFromRows(proficiencyRows)
		onSubmit({ ...rest, name: draft.name.trim(), ...(bonuses.length > 0 ? { bonuses } : {}), ...(proficiencies.length > 0 ? { proficiencies } : {}) })
		if (editing === null) {
			setDraft(blankCustomItem())
			setBonusRows([])
			setProficiencyRows([])
			setCopiedKey(null)
		}
	}

	const copyOptions: SearchableOption[] = itemRefs.map((ref) => ({
		key: itemKey(ref),
		name: ref.name,
		label: `${ref.name} (${ref.source})`,
		selected: copiedKey === itemKey(ref),
	}))

	return (
		<details className="sheet__custom-item" open={editing !== null}>
			<summary>{editing === null ? 'Create a custom item' : `Edit ${editing.name}`}</summary>

			{/* Copying replaces the whole draft, so it is offered only while making a new item — not as a way to overwrite one that exists. */}
			{editing === null && (
				<SearchableOptionList
					legend="Copy an existing item"
					name="custom-item-copy"
					inputType="radio"
					options={copyOptions}
					required={0}
					defaultOpen={false}
					renderCount={() => (copiedKey === null ? 'starting from nothing' : `copied from ${copiedKey.split('|')[0]}`)}
					onToggle={copyFrom}
					searchPlaceholder="Search items by name…"
				/>
			)}

			<p>
				<label>
					Name <input type="text" aria-label="Custom item name" value={draft.name} onChange={(event) => update({ name: event.target.value })} />
				</label>{' '}
				<label>
					Kind{' '}
					<select aria-label="Custom item kind" value={draft.kind} onChange={(event) => update({ kind: event.target.value as CustomItemKind })}>
						{CUSTOM_ITEM_KINDS.map((kind) => (
							<option key={kind} value={kind}>
								{kind}
							</option>
						))}
					</select>
				</label>{' '}
				<CommitGoldField
					label="Value in gold"
					copperValue={draft.valueCopper ?? 0}
					onCommit={(copper) => update({ valueCopper: copper })}
				/>
			</p>

			<p>
				<label>
					<input
						type="checkbox"
						aria-label="Custom item requires attunement"
						checked={draft.requiresAttunement === true}
						onChange={(event) =>
							setDraft((current) => {
								const next = { ...current }
								if (event.target.checked) next.requiresAttunement = true
								else {
									delete next.requiresAttunement
									delete next.attunementCondition
								}
								return next
							})
						}
					/>{' '}
					Requires attunement
				</label>{' '}
				{draft.requiresAttunement === true && (
					<label>
						Condition{' '}
						{/* Shown to the player and never evaluated, exactly as items.json's own restriction sentence is (D78). */}
						<input
							type="text"
							aria-label="Custom item attunement condition"
							placeholder="by a spellcaster"
							value={draft.attunementCondition ?? ''}
							onChange={(event) => updateOptional('attunementCondition', event.target.value)}
						/>
					</label>
				)}
			</p>

			{/* The armour fields feed computeArmourClass exactly as a real suit's do — the category is what picks the Dexterity cap. */}
			{(draft.kind === 'armour' || draft.kind === 'shield') && (
				<p className="sheet__custom-item-armour">
					<OptionalNumberField
						label="Custom item armour class"
						value={draft.armourClass}
						onChange={(value) => updateOptional('armourClass', value)}
					/>{' '}
					{draft.kind === 'shield' ? (
						<span className="sheet__custom-item-hint">the bonus the shield adds</span>
					) : (
						<label>
							Armour category{' '}
							<select
								aria-label="Custom item armour category"
								value={draft.armourCategory ?? ''}
								onChange={(event) => updateOptional('armourCategory', (event.target.value || undefined) as CustomArmourCategory | undefined)}
							>
								<option value="">not set</option>
								{CUSTOM_ARMOUR_CATEGORIES.map((category) => (
									<option key={category} value={category}>
										{category}
									</option>
								))}
							</select>
						</label>
					)}
					{/*
					 * A shield carries neither field in the data — no book shield has
					 * Stealth disadvantage or a Strength requirement (fix slice) — so
					 * both controls are offered on armour only. A control that does
					 * nothing is worse than no control.
					 */}
					{draft.kind === 'armour' && (
						<>
							{' '}
							<label>
								<input
									type="checkbox"
									aria-label="Custom item stealth disadvantage"
									checked={draft.stealthDisadvantage === true}
									onChange={(event) => updateOptional('stealthDisadvantage', event.target.checked ? true : undefined)}
								/>{' '}
								Disadvantage on Stealth
							</label>{' '}
							<OptionalNumberField
								label="Custom item Strength requirement"
								value={draft.strengthRequirement}
								onChange={(value) => updateOptional('strengthRequirement', value)}
							/>{' '}
							{/* Only heavy armour is measured against it at all (armourSpeedPenalty) — light and medium accept a value that then does nothing. */}
							{draft.armourCategory !== 'heavy' && (
								<span className="sheet__custom-item-hint">only heavy armour is slowed by an unmet Strength requirement</span>
							)}
						</>
					)}
				</p>
			)}

			{draft.kind === 'weapon' && (
				<p className="sheet__custom-item-weapon">
					<label>
						Damage dice{' '}
						<input
							type="text"
							aria-label="Custom item damage dice"
							placeholder="1d8"
							value={draft.damageDice ?? ''}
							onChange={(event) => updateOptional('damageDice', event.target.value)}
						/>
					</label>{' '}
					<label>
						Damage type{' '}
						<select aria-label="Custom item damage type" value={draft.damageType ?? ''} onChange={(event) => updateOptional('damageType', event.target.value)}>
							<option value="">not set</option>
							{DAMAGE_TYPES.map((type) => (
								<option key={type} value={type}>
									{damageTypeLabel(type)}
								</option>
							))}
						</select>
					</label>{' '}
					{/* D77: melee attacks with Strength, ranged with Dexterity. The player does not choose the ability — the weapon does. */}
					<label>
						Range{' '}
						<select
							aria-label="Custom item weapon range"
							value={draft.weaponRange ?? 'melee'}
							onChange={(event) => update({ weaponRange: event.target.value as CustomWeaponRange })}
						>
							{CUSTOM_WEAPON_RANGES.map((range) => (
								<option key={range} value={range}>
									{range}
								</option>
							))}
						</select>
					</label>{' '}
					{/* Proficiency is decided by this and nothing else (isProficientWithWeapon), so a weapon with no category is one nobody is proficient with. */}
					<label>
						Weapon category{' '}
						<select
							aria-label="Custom item weapon category"
							value={draft.weaponCategory ?? ''}
							onChange={(event) => updateOptional('weaponCategory', (event.target.value || undefined) as CustomWeaponCategory | undefined)}
						>
							<option value="">not set</option>
							{CUSTOM_WEAPON_CATEGORIES.map((category) => (
								<option key={category} value={category}>
									{category}
								</option>
							))}
						</select>
					</label>{' '}
					{/*
					 * D85: a character has two hands, and these are the two properties
					 * that decide what a weapon costs (handsRequiredOf). Real data never
					 * carries both on one weapon, so picking one clears the other rather
					 * than leaving a state handsRequiredOf would have to arbitrate.
					 */}
					<label>
						<input
							type="checkbox"
							aria-label="Custom item two-handed"
							checked={draft.twoHanded === true}
							onChange={(event) =>
								setDraft((current) => {
									const next = { ...current }
									if (event.target.checked) {
										next.twoHanded = true
										delete next.versatile
										delete next.damageDice2
									} else {
										delete next.twoHanded
									}
									return next
								})
							}
						/>{' '}
						Two-Handed
					</label>{' '}
					<label>
						<input
							type="checkbox"
							aria-label="Custom item versatile"
							checked={draft.versatile === true}
							onChange={(event) =>
								setDraft((current) => {
									const next = { ...current }
									if (event.target.checked) {
										next.versatile = true
										delete next.twoHanded
									} else {
										delete next.versatile
										delete next.damageDice2
									}
									return next
								})
							}
						/>{' '}
						Versatile
					</label>{' '}
					{/* Without this the grip control (isVersatileWeapon) has a switch with nothing on the other side of it. */}
					{draft.versatile === true && (
						<label>
							Two-handed damage dice{' '}
							<input
								type="text"
								aria-label="Custom item two-handed damage dice"
								placeholder="1d10"
								value={draft.damageDice2 ?? ''}
								onChange={(event) => updateOptional('damageDice2', event.target.value)}
							/>
						</label>
					)}
				</p>
			)}

			<p className="sheet__custom-item-effects">
				<DamageTypeChoice label="Custom item resistances" selected={draft.resist} onChange={(types) => updateOptional('resist', types)} />{' '}
				<DamageTypeChoice label="Custom item immunities" selected={draft.immune} onChange={(types) => updateOptional('immune', types)} />{' '}
				<DamageTypeChoice label="Custom item vulnerabilities" selected={draft.vulnerable} onChange={(types) => updateOptional('vulnerable', types)} />{' '}
				<ConditionChoice label="Custom item condition immunities" selected={draft.conditionImmune} onChange={(names) => updateOptional('conditionImmune', names)} />{' '}
				<ConditionChoice label="Custom item advantage on saves against" selected={draft.conditionAdvantage} onChange={(names) => updateOptional('conditionAdvantage', names)} />{' '}
				<OptionalNumberField label="Custom item speed bonus" value={draft.speedBonus} onChange={(value) => updateOptional('speedBonus', value)} />{' '}
				<OptionalNumberField label="Custom item darkvision" value={draft.darkvision} onChange={(value) => updateOptional('darkvision', value)} />{' '}
				<OptionalNumberField label="Custom item fly speed" text="Fly speed" positive value={draft.flySpeed} onChange={(value) => updateOptional('flySpeed', value)} />{' '}
				<OptionalNumberField label="Custom item swim speed" text="Swim speed" positive value={draft.swimSpeed} onChange={(value) => updateOptional('swimSpeed', value)} />{' '}
				<OptionalNumberField label="Custom item climb speed" text="Climb speed" positive value={draft.climbSpeed} onChange={(value) => updateOptional('climbSpeed', value)} />{' '}
				<OptionalNumberField label="Custom item blindsight" text="Blindsight" positive value={draft.blindsight} onChange={(value) => updateOptional('blindsight', value)} />{' '}
				<OptionalNumberField label="Custom item tremorsense" text="Tremorsense" positive value={draft.tremorsense} onChange={(value) => updateOptional('tremorsense', value)} />{' '}
				<OptionalNumberField label="Custom item truesight" text="Truesight" positive value={draft.truesight} onChange={(value) => updateOptional('truesight', value)} />
			</p>

			<CustomItemBonusList rows={bonusRows} onChange={setBonusRows} />

			<CustomItemProficiencyList rows={proficiencyRows} itemRefs={itemRefs} onChange={setProficiencyRows} />

			{/* Last, because it is where everything the structured fields above cannot express ends up — and it is shown, never read (D9/D55/D21). */}
			<p>
				<label>
					Description{' '}
					<textarea
						aria-label="Custom item description"
						rows={3}
						value={draft.description ?? ''}
						onChange={(event) => updateOptional('description', event.target.value)}
					/>
				</label>
			</p>

			<p>
				<button type="button" onClick={submit} disabled={draft.name.trim() === ''}>
					{editing === null ? 'Add custom item' : 'Save changes'}
				</button>{' '}
				{editing !== null && (
					<button type="button" onClick={onCancel}>
						Cancel
					</button>
				)}
			</p>
		</details>
	)
}

/** One row of the panel, laid out like a Manage Spells row; ▸ opens the item's text. D116: which rows are open is panel state only. */
function ItemRow({ name, meta, action, description, children }: { name: string; meta?: ReactNode; action?: ReactNode; description: ReactNode; children?: ReactNode }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="manage-spells__row">
			<div className="manage-spells__line">
				<span className="manage-spells__name-cell">
					<span className="manage-spells__name">{name}</span>
					{meta && <> <span className="manage-spells__meta">{meta}</span></>}
				</span>
				{action}
				<button type="button" className="manage-spells__expand" aria-expanded={open} aria-label={`${name} description`} onClick={() => setOpen(!open)}>
					{open ? '▾' : '▸'}
				</button>
			</div>
			{children && <div className="manage-inventory__controls">{children}</div>}
			{open && <div className="manage-spells__text">{description ?? <p>No description.</p>}</div>}
		</li>
	)
}

const ADD_ITEMS_SHOWN = 20

/** R10a: browse the item data and add one piece at a time. Search and filters are panel state only (D116). */
function AddItemsList({ itemRefs, itemEntryTemplates, onAdd }: { itemRefs: ItemRef[]; itemEntryTemplates: ItemEntryTemplate[]; onAdd: (ref: ItemRef) => void }): ReactNode {
	const [search, setSearch] = useState('')
	const [kinds, setKinds] = useState<ReadonlySet<ItemFilterKind>>(new Set())
	const [magical, setMagical] = useState(false)
	const kindsByRef = useMemo(() => new Map(itemRefs.map((ref) => [ref, itemFilterKindsOf(ref)])), [itemRefs])

	function toggleKind(kind: ItemFilterKind): void {
		const next = new Set(kinds)
		if (next.has(kind)) next.delete(kind)
		else next.add(kind)
		setKinds(next)
	}

	const needle = search.trim().toLowerCase()
	const matches = itemRefs.filter(
		(ref) =>
			ref.name.toLowerCase().includes(needle) &&
			(kinds.size === 0 || (kindsByRef.get(ref) ?? []).some((kind) => kinds.has(kind))) &&
			(!magical || isMagicItem(ref)),
	)

	return (
		<section aria-label="Add Items" className="manage-spells__list">
			<input type="search" className="sheet__spells-search manage-spells__search" aria-label="Search items" placeholder="Search items" value={search} onChange={(event) => setSearch(event.target.value)} />
			<div className="sheet__actions-filters manage-spells__pills" role="group" aria-label="Filter by type">
				{ITEM_FILTER_KINDS.map((kind) => (
					<button key={kind} type="button" className={kinds.has(kind) ? 'pill pill--active' : 'pill'} aria-pressed={kinds.has(kind)} onClick={() => toggleKind(kind)}>
						{kind}
					</button>
				))}
			</div>
			<label className="manage-inventory__magical">
				<input type="checkbox" checked={magical} onChange={(event) => setMagical(event.target.checked)} /> Magical
			</label>
			{matches.length === 0 && <p className="manage-spells__empty">No items match.</p>}
			<ul>
				{matches.slice(0, ADD_ITEMS_SHOWN).map((ref) => (
					<ItemRow
						key={itemKey(ref)}
						name={ref.name}
						meta={(kindsByRef.get(ref) ?? []).join(', ')}
						action={
							<button type="button" className="manage-spells__button" aria-label={`Add ${ref.name}`} onClick={() => onAdd(ref)}>
								Add
							</button>
						}
						description={ref.entries && <Entries entries={resolveItemEntryRefs(ref.entries, ref, itemEntryTemplates)} />}
					/>
				))}
			</ul>
			{matches.length > ADD_ITEMS_SHOWN && (
				<p className="manage-spells__empty">
					Showing {ADD_ITEMS_SHOWN} of {matches.length} — narrow the search or filters.
				</p>
			)}
		</section>
	)
}

/**
 * The Manage Inventory drawer (R10a): every inventory and money edit, moved out
 * of the Inventory tab. The rules are the ones the tab carried — only the place
 * changed.
 *
 * Slice e2a: a row carrying its own definition resolves against that instead of
 * items.json, through the same resolver every other consumer uses, so it takes
 * part in quantity, equipping, attunement, the magic bonus and the name label
 * without a second code path.
 */
export function ManageInventoryPanel({
	inventory,
	currencyCopper,
	itemRefs,
	itemRefsError,
	itemEntryTemplates,
	attunementLimit,
	onEditInventory: inventoryCallback,
	onEditCurrency: currencyCallback,
}: {
	inventory: CharacterInventoryItem[]
	currencyCopper: number
	itemRefs: ItemRef[] | null
	itemRefsError: string | null
	itemEntryTemplates: ItemEntryTemplate[]
	attunementLimit: Calculated<number>
	/** Either callback may be absent; its sections are then left out, as the tab's controls were before R10a. */
	onEditInventory?: (inventory: CharacterInventoryItem[]) => void
	onEditCurrency?: (copper: number) => void
}): ReactNode {
	const onEditInventory = inventoryCallback ?? (() => {})
	const onEditCurrency = currencyCallback ?? (() => {})
	const resolve = buildInventoryResolver(itemRefs ?? [])
	const coins = copperToCoins(currencyCopper)
	/**
	 * The ONE thing this panel says back to the player: what an equip put down,
	 * or why an attunement was refused. Slice b-fix merged the two — a refusal
	 * nobody notices is the same failure as a silent displacement, and two
	 * mechanisms meant only one of them was ever styled to be seen.
	 */
	const [notice, setNotice] = useState<string | null>(null)
	/** Which custom row the form is currently editing (slice e2b). Null while it is making a new item. */
	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const formRef = useRef<HTMLDivElement>(null)
	const attunedCount = countAttuned(inventory)
	const limit = attunementLimit.status === 'known' ? attunementLimit.value : BASE_ATTUNEMENT_LIMIT

	// The form sits above My Inventory, so Edit has to bring it into view (and open its section if the player folded it).
	useEffect(() => {
		if (editingIndex === null || !formRef.current) return
		const section = formRef.current.closest('details.drawer-section')
		if (section instanceof HTMLDetailsElement) section.open = true
		formRef.current.scrollIntoView?.({ block: 'start' })
	}, [editingIndex])

	function editCoin(field: 'gp' | 'sp' | 'cp', amount: number): void {
		onEditCurrency(coinsToCopper({ ...coins, [field]: amount }))
	}

	function setQuantity(index: number, quantity: number): void {
		// Floor is 0 (slice 9d3): a spent stack stays as a row to restock, so a 0 must not be committed back up to 1. Removing is still REMOVE.
		onEditInventory(withQuantity(inventory, index, Math.max(0, quantity)))
	}

	function removeAt(index: number): void {
		// Positions shift when a row goes, so an open edit would follow the wrong row.
		setEditingIndex(null)
		onEditInventory(inventory.filter((_, i) => i !== index))
	}

	/**
	 * The player's own magic bonus (slice e). It REPLACES the item's own rather
	 * than adding to it — that reconciliation lives in resolveMagicBonus, so
	 * nothing here has to know the item carries one.
	 */
	function setMagicBonus(index: number, bonus: MagicItemBonus | null): void {
		onEditInventory(inventory.map((row, i) => (i === index ? withMagicBonus(row, bonus) : row)))
	}

	function applyEquip(result: EquipResult | null): void {
		if (!result) return
		setNotice(result.notice)
		onEditInventory(result.inventory)
	}

	function toggleEquipRow(index: number): void {
		applyEquip(toggleEquip(inventory, index, resolve))
	}
	/**
	 * A Versatile weapon's grip. Two-handing one is a real claim on a hand, not
	 * just a bigger damage die, so it goes through the same rule equipping does
	 * and can put a shield down; going back to one hand only frees one.
	 */
	function setGrip(index: number, grip: WeaponGrip): void {
		const item = inventory[index]
		const ref = resolve(item).ref
		if (!ref) return
		if (grip === 'one-handed') {
			setNotice(null)
			onEditInventory(inventory.map((row, i) => (i === index ? oneHanded(row) : row)))
			return
		}
		applyEquip(takeInHand(inventory, index, ref, { ...item, equipped: 'held', grip }, resolve))
	}

	/**
	 * Attuning and un-attuning. Attunement is independent of equipped state, so
	 * this touches nothing else on the row; the refusal at the limit is the one
	 * place the app acts on the requirement (D21 — the CONDITION is only shown).
	 */
	function toggleAttune(index: number): void {
		const item = inventory[index]

		if (item.attuned) {
			setNotice(null)
			onEditInventory(inventory.map((row, i) => (i === index ? unattuned(row) : row)))
			return
		}

		const refusal = describeAttunementRefusal(inventory, limit)
		if (refusal) {
			setNotice(`Cannot attune to ${item.name}: ${refusal}.`)
			return
		}
		setNotice(null)
		onEditInventory(inventory.map((row, i) => (i === index ? { ...row, attuned: true } : row)))
	}

	/**
	 * ADD owns ONE plain row — a row carrying no equipped state, attunement,
	 * ability pick or magic bonus (slice e) — and adds a piece to it, so a
	 * +1 Longsword the player has since changed is never the row that grows.
	 */
	function addOne(ref: ItemRef): void {
		const plain: CharacterInventoryItem = { name: ref.name, source: ref.source, quantity: 1 }
		const plainKey = inventoryRowKey(plain)
		const existing = inventory.findIndex((item) => inventoryRowKey(item) === plainKey)
		onEditInventory(existing === -1 ? [...inventory, plain] : withQuantity(inventory, existing, inventory[existing].quantity + 1))
	}

	/**
	 * A custom item joins the inventory as an ordinary row that happens to carry
	 * its own definition (slice e2a). It is always added, never merged into an
	 * existing row: two custom items are what the player made them, and
	 * inventoryRowKey keeps them apart if they differ by so much as one field.
	 */
	function addCustom(custom: CustomItemDefinition): void {
		onEditInventory([...inventory, { name: custom.name, source: CUSTOM_ITEM_SOURCE, quantity: 1, custom }])
	}

	/**
	 * A changed definition replaces the one on the row, keeping everything the
	 * row itself carries — quantity, attunement, the magic bonus, the Finesse
	 * pick. That is the whole reason editing exists rather than
	 * remove-and-recreate: none of that survives a delete.
	 *
	 * The one thing that cannot survive is an equipped slot the new kind does not
	 * have: a sword edited into a cloak is not still in hand. It is put down
	 * rather than left in a slot nothing can take it out of.
	 */
	function saveCustom(index: number, custom: CustomItemDefinition): void {
		setEditingIndex(null)
		onEditInventory(
			inventory.map((row, i) => {
				if (i !== index) return row
				const next: CharacterInventoryItem = { ...row, name: custom.name, custom }
				if (next.equipped !== undefined && equipSlotOf(customItemRef(custom, row.source)) !== next.equipped) return putDown(next)
				return next
			}),
		)
	}

	return (
		<>
			{inventoryCallback && (
			<DrawerSection title="Add Items">
				{itemRefsError && <p className="error">Could not load the item list: {itemRefsError}</p>}
				{itemRefs === null ? (
					!itemRefsError && <p className="manage-spells__empty">Loading items…</p>
				) : (
					<AddItemsList itemRefs={itemRefs} itemEntryTemplates={itemEntryTemplates} onAdd={addOne} />
				)}
			</DrawerSection>
			)}

			{inventoryCallback && (
			<DrawerSection title="Add Custom Item">
				{itemRefs !== null && (
					/*
					 * The key remounts the form when the target changes, so the draft is
					 * re-seeded from whichever definition is being worked on rather than
					 * keeping the previous one's half-typed state.
					 */
					<div ref={formRef}>
						<CustomItemForm
							key={editingIndex === null ? 'new' : `edit-${editingIndex}`}
							itemRefs={itemRefs}
							editing={editingIndex === null ? null : (inventory[editingIndex]?.custom ?? null)}
							onSubmit={(custom) => (editingIndex === null ? addCustom(custom) : saveCustom(editingIndex, custom))}
							onCancel={() => setEditingIndex(null)}
						/>
					</div>
				)}
			</DrawerSection>
			)}

			{currencyCallback && (
			<DrawerSection title="Currency">
				<p className="manage-inventory__currency">
					<CommitNumberField label="Gold" min={0} value={coins.gp} onCommit={(amount) => editCoin('gp', amount)} narrow="money" />{' '}
					<CommitNumberField label="Silver" min={0} value={coins.sp} onCommit={(amount) => editCoin('sp', amount)} narrow="money" />{' '}
					<CommitNumberField label="Copper" min={0} value={coins.cp} onCommit={(amount) => editCoin('cp', amount)} narrow="money" />{' '}
					<AddPlatinumField onAdd={(platinum) => onEditCurrency(currencyCopper + platinumToCopper(platinum))} />
				</p>
			</DrawerSection>
			)}

			{inventoryCallback && (
			<DrawerSection title="My Inventory">
				<section aria-label="My Inventory" className="manage-spells__list">
					<div className="sheet__attunement-count">
						<span>
							{attunedCount} of {limit} attuned
						</span>{' '}
						{attunementLimit.status === 'known' && <ValueBreakdown breakdown={attunementLimit.breakdown} />}
					</div>
					{/* role="status" so a refusal further down the list is announced, not just drawn — the whole point of merging the two notices (slice b-fix). */}
					{notice && (
						<p className="sheet__inventory-notice" role="status">
							{notice}
						</p>
					)}
					{inventory.length === 0 ? (
						<p className="manage-spells__empty">Nothing carried yet.</p>
					) : (
						<ul>
							{inventory.map((item, index) => {
								const { ref, problem } = resolve(item)
								const slot = ref ? equipSlotOf(ref) : null
								// A missing items.json entry is only a problem once the file has loaded; a broken custom definition is one either way (slice e2a).
								const showProblem = problem !== null && (problem.kind === 'malformed-custom' || (itemRefs !== null && itemRefsError === null))
								// An attuned row keeps its control even when its item data is missing (D43), or the attunement could never be ended.
								const attunable = ref?.requiresAttunement === true || item.attuned === true
								/* The grip is a choice about hands, so it is offered where equipping is, and only on a Versatile weapon actually in hand (slice b-fix). */
								const grippable = ref !== null && isVersatileWeapon(ref) && item.equipped === 'held'
								const bonus = resolveMagicBonus({
									name: item.name,
									itemBonus: ref ? itemMagicBonusOf(ref) : null,
									playerBonus: item.magicBonus ?? null,
									requiresAttunement: ref?.requiresAttunement === true,
									attuned: item.attuned === true,
								})
								const meta = [item.custom !== undefined && 'custom', item.equipped, item.attuned && 'attuned'].filter(Boolean).join(', ')
								// Two rows can legitimately end up identical (the same item set to the same bonus twice), so the position keeps the key unique.
								return (
									<ItemRow
										key={`${inventoryRowKey(item)}#${index}`}
										name={bonus.label}
										meta={meta || undefined}
										description={ref?.entries && <Entries entries={resolveItemEntryRefs(ref.entries, ref, itemEntryTemplates)} />}
									>
										{showProblem && <UnresolvedValue reason={problem!.message} />}
										<span className="manage-inventory__qty">
											<button type="button" aria-label={`Decrease quantity of ${bonus.label}`} disabled={item.quantity <= 0} onClick={() => setQuantity(index, item.quantity - 1)}>
												−
											</button>
											<CommitNumberField label={`Quantity of ${bonus.label}`} min={0} value={item.quantity} onCommit={(quantity) => setQuantity(index, quantity)} showLabel={false} />
											<button type="button" aria-label={`Increase quantity of ${bonus.label}`} onClick={() => setQuantity(index, item.quantity + 1)}>
												+
											</button>
										</span>
										{/* Only gear that can actually be worn or held offers the control at all. */}
										{slot !== null && (
											<button type="button" aria-label={`${item.equipped ? 'Put down' : 'Equip'} ${bonus.label}`} onClick={() => toggleEquipRow(index)}>
												{item.equipped ? 'Put down' : 'Equip'}
											</button>
										)}
										{grippable && (
											<label>
												Grip{' '}
												<select aria-label={`Grip for ${bonus.label}`} value={item.grip ?? 'one-handed'} onChange={(event) => setGrip(index, event.target.value as WeaponGrip)}>
													<option value="one-handed">one-handed</option>
													<option value="two-handed">two-handed</option>
												</select>
											</label>
										)}
										{/* Slice e: the same test the Equip control uses — a +2 backpack means nothing, so only weapons, armour and shields are offered a bonus. */}
										{slot !== null && (
											<label>
												Magic bonus{' '}
												<select
													aria-label={`Magic bonus for ${item.name}`}
													value={item.magicBonus ?? MAGIC_BONUS_NONE}
													onChange={(event) => setMagicBonus(index, event.target.value === MAGIC_BONUS_NONE ? null : (Number(event.target.value) as MagicItemBonus))}
												>
													<option value={MAGIC_BONUS_NONE}>none</option>
													{MAGIC_BONUS_OPTIONS.map((option) => (
														<option key={option} value={option}>
															+{option}
														</option>
													))}
												</select>
											</label>
										)}
										{attunable && (
											<button type="button" aria-label={`${item.attuned ? 'End attunement to' : 'Attune to'} ${bonus.label}`} onClick={() => toggleAttune(index)}>
												{item.attuned ? 'End attunement' : 'Attune'}
											</button>
										)}
										{/* Editing is offered on a custom row and nowhere else — a book item's fields are the book's (slice e2b). */}
										{item.custom !== undefined && (
											<button type="button" aria-label={`Edit ${bonus.label}`} onClick={() => setEditingIndex(index)}>
												Edit
											</button>
										)}
										{/* Separated and named for what it does to the item (gone for good), so it cannot be mistaken for Put down (out of hand, still carried). */}
										<button type="button" className="sheet__inventory-discard" aria-label={`Remove ${bonus.label} from inventory`} onClick={() => removeAt(index)}>
											Remove
										</button>
									</ItemRow>
								)
							})}
						</ul>
					)}
				</section>
			</DrawerSection>
			)}
		</>
	)
}
