import type { ReactNode } from 'react'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import { itemKey, type ItemRef } from './inventoryData'
import {
	buildStartingInventory,
	categoryPickKey,
	findOption,
	type EquipmentCategory,
	type EquipmentOrigin,
	type StartingEquipmentChoice,
	type StartingEquipmentOffer,
	type StartingEquipmentOption,
} from './startingEquipmentData'
import { copperToCoins } from './currency'

/*
 * The wizard's starting-equipment step (build order step 7, slice a2). One
 * step, not two: D13 organises the wizard by category and "starting equipment
 * and inventory" is one category, both halves feed one inventory, and the
 * combined result is only meaningful shown together.
 *
 * D13 also requires each option to show what it GRANTS: every option lists its
 * items one by one, a pack shows the contents it expands into, and a coin
 * amount is shown in coins rather than as a copper number.
 *
 * D8: this picker owns no state. Every pick is reported through onChange and
 * handed back as `value`.
 */

function CategoryPicker({
	origin,
	option,
	elementIndex,
	categories,
	label,
	categoryItems,
	value,
	onChange,
}: {
	origin: EquipmentOrigin
	option: StartingEquipmentOption
	elementIndex: number
	categories: EquipmentCategory[]
	label: string
	categoryItems: Record<EquipmentCategory, ItemRef[]> | null
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	const pickKey = categoryPickKey(origin, option.key, elementIndex)
	const picked = value.categoryPicks[pickKey]

	if (categoryItems === null) {
		return <p className="error">Could not load the items {label} offers.</p>
	}

	const refs = categories.flatMap((category) => categoryItems[category] ?? [])
	const options: SearchableOption[] = refs.map((ref) => ({
		key: itemKey(ref),
		name: ref.name,
		label: `${ref.name} (${ref.source})`,
		selected: picked !== undefined && itemKey(picked) === itemKey(ref),
	}))

	function toggle(key: string): void {
		const ref = refs.find((candidate) => itemKey(candidate) === key)
		if (!ref) return
		onChange({ ...value, categoryPicks: { ...value.categoryPicks, [pickKey]: { name: ref.name, source: ref.source } } })
	}

	return (
		<SearchableOptionList
			legend={`Choose ${label}`}
			name={`starting-equipment-${pickKey}`}
			inputType="radio"
			options={options}
			required={1}
			renderCount={({ chosen }) => (chosen === 1 ? 'Chosen' : 'Choose 1')}
			onToggle={toggle}
		/>
	)
}

function ElementList({
	origin,
	option,
	selected,
	categoryItems,
	value,
	onChange,
}: {
	origin: EquipmentOrigin
	option: StartingEquipmentOption
	selected: boolean
	categoryItems: Record<EquipmentCategory, ItemRef[]> | null
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	return (
		<ul className="starting-equipment__grants">
			{option.elements.map((element, elementIndex) => {
				if (element.kind === 'coins') {
					return <li key={elementIndex}>{element.label}</li>
				}
				if (element.kind === 'category') {
					return (
						<li key={elementIndex}>
							{element.label}
							{selected && (
								<CategoryPicker
									origin={origin}
									option={option}
									elementIndex={elementIndex}
									categories={element.categories}
									label={element.label}
									categoryItems={categoryItems}
									value={value}
									onChange={onChange}
								/>
							)}
						</li>
					)
				}
				// A pack contributes its contents, not itself — show them, so the option says what it really grants.
				const expanded = element.items.length !== 1 || element.items[0].name !== element.label.replace(/ ×\d+$/, '')
				return (
					<li key={elementIndex}>
						{element.label}
						{expanded && (
							<ul className="starting-equipment__contents">
								{element.items.map((item) => (
									<li key={itemKey(item)}>
										{item.name}
										{item.quantity > 1 ? ` ×${item.quantity}` : ''}
									</li>
								))}
							</ul>
						)}
					</li>
				)
			})}
		</ul>
	)
}

function OfferSection({
	origin,
	legend,
	offer,
	error,
	categoryItems,
	value,
	onChange,
}: {
	origin: EquipmentOrigin
	legend: string
	offer: StartingEquipmentOffer | null
	error: string | null
	categoryItems: Record<EquipmentCategory, ItemRef[]> | null
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	const chosenKey = origin === 'class' ? value.classOptionKey : value.backgroundOptionKey

	function chooseOption(key: string): void {
		// Switching option drops the category picks made under the old one: their keys name the option they belong to.
		const categoryPicks = Object.fromEntries(
			Object.entries(value.categoryPicks).filter(([pickKey]) => !pickKey.startsWith(`${origin}:`)),
		)
		onChange({
			...value,
			...(origin === 'class' ? { classOptionKey: key } : { backgroundOptionKey: key }),
			categoryPicks,
		})
	}

	return (
		<fieldset className="starting-equipment__offer">
			<legend>{legend}</legend>
			{error && <p className="error">Could not load the starting equipment: {error}</p>}
			{offer === null && !error && <p>Loading…</p>}
			{offer?.options.map((option) => (
				<div key={option.key} className="starting-equipment__option">
					<label>
						<input
							type="radio"
							name={`starting-equipment-${origin}`}
							checked={chosenKey === option.key}
							onChange={() => chooseOption(option.key)}
						/>{' '}
						{option.label}
					</label>
					<ElementList
						origin={origin}
						option={option}
						selected={chosenKey === option.key}
						categoryItems={categoryItems}
						value={value}
						onChange={onChange}
					/>
				</div>
			))}
		</fieldset>
	)
}

export function StartingEquipmentPicker({
	className,
	backgroundName,
	classOffer,
	backgroundOffer,
	classOfferError,
	backgroundOfferError,
	categoryItems,
	value,
	onChange,
}: {
	className: string | null
	backgroundName: string | null
	classOffer: StartingEquipmentOffer | null
	backgroundOffer: StartingEquipmentOffer | null
	classOfferError: string | null
	backgroundOfferError: string | null
	categoryItems: Record<EquipmentCategory, ItemRef[]> | null
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	const { inventory, currencyCopper } = buildStartingInventory(classOffer, backgroundOffer, value)
	const coins = copperToCoins(currencyCopper)
	const bothChosen = findOption(classOffer, value.classOptionKey) !== null && findOption(backgroundOffer, value.backgroundOptionKey) !== null

	return (
		<div className="starting-equipment">
			<p>Take one option from your class and one from your background. You can add and remove things afterwards.</p>

			<OfferSection
				origin="class"
				legend={className ? `From your class (${className})` : 'From your class'}
				offer={classOffer}
				error={classOfferError}
				categoryItems={categoryItems}
				value={value}
				onChange={onChange}
			/>

			<OfferSection
				origin="background"
				legend={backgroundName ? `From your background (${backgroundName})` : 'From your background'}
				offer={backgroundOffer}
				error={backgroundOfferError}
				categoryItems={categoryItems}
				value={value}
				onChange={onChange}
			/>

			{bothChosen && (
				<section className="starting-equipment__summary">
					<h3>You will start with</h3>
					<p>
						Money: {coins.pp} pp, {coins.gp} gp, {coins.sp} sp, {coins.cp} cp
					</p>
					{inventory.length === 0 ? (
						<p>No items — this character starts with money only.</p>
					) : (
						<ul>
							{inventory.map((item) => (
								<li key={itemKey(item)}>
									{item.name}
									{item.quantity > 1 ? ` ×${item.quantity}` : ''}
								</li>
							))}
						</ul>
					)}
				</section>
			)}
		</div>
	)
}
