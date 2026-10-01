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
import { EquipmentOptionCard } from './EquipmentOptionCard'
import { StartingTable } from './StartingTable'

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
	categoryItemsFailed,
	value,
	onChange,
}: {
	origin: EquipmentOrigin
	option: StartingEquipmentOption
	elementIndex: number
	categories: EquipmentCategory[]
	label: string
	categoryItems: Record<EquipmentCategory, ItemRef[]> | null
	categoryItemsFailed: boolean
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	const pickKey = categoryPickKey(origin, option.key, elementIndex)
	const picked = value.categoryPicks[pickKey]

	if (categoryItems === null) {
		// Still loading shows nothing, so a quick step entry does not flash the error.
		return categoryItemsFailed ? <p className="error">Could not load the items {label} offers.</p> : null
	}

	const refs = categories.flatMap((category) => categoryItems[category] ?? [])
	const options: SearchableOption[] = refs.map((ref) => ({
		key: itemKey(ref),
		name: ref.name,
		book: ref.source,
		selected: picked !== undefined && itemKey(picked) === itemKey(ref),
	}))

	function toggle(key: string): void {
		const ref = refs.find((candidate) => itemKey(candidate) === key)
		if (!ref) return
		onChange({ ...value, categoryPicks: { ...value.categoryPicks, [pickKey]: { name: ref.name, source: ref.source } } })
	}

	return (
		<SearchableOptionList
			legend={label.charAt(0).toUpperCase() + label.slice(1)}
			name={`starting-equipment-${pickKey}`}
			inputType="radio"
			variant="choose"
			options={options}
			required={1}
			renderCount={({ chosen }) => (chosen === 1 ? 'Chosen' : 'Choose 1')}
			onToggle={toggle}
		/>
	)
}

function OfferSection({
	origin,
	legend,
	offer,
	error,
	categoryItems,
	categoryItemsFailed,
	value,
	onChange,
}: {
	origin: EquipmentOrigin
	legend: string
	offer: StartingEquipmentOffer | null
	error: string | null
	categoryItems: Record<EquipmentCategory, ItemRef[]> | null
	categoryItemsFailed: boolean
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	const chosenKey = origin === 'class' ? value.classOptionKey : value.backgroundOptionKey
	const chosenOption = findOption(offer, chosenKey)

	function chooseOption(key: string): void {
		// Like a radio: taking the option already taken changes nothing, so its category picks survive a second click.
		if (key === chosenKey) return
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
			{offer && (
				<div className="equip-cards">
					{offer.options.map((option) => (
						<EquipmentOptionCard
							key={option.key}
							origin={origin}
							option={option}
							chosen={chosenKey === option.key}
							onChoose={() => chooseOption(option.key)}
						/>
					))}
				</div>
			)}
			{/* Under the cards at full width, only for the chosen option. */}
			{chosenOption?.elements.map((element, elementIndex) =>
				element.kind === 'category' ? (
					<CategoryPicker
						key={`${chosenOption.key}:${elementIndex}`}
						origin={origin}
						option={chosenOption}
						elementIndex={elementIndex}
						categories={element.categories}
						label={element.label}
						categoryItems={categoryItems}
						categoryItemsFailed={categoryItemsFailed}
						value={value}
						onChange={onChange}
					/>
				) : null,
			)}
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
	categoryItemsFailed = false,
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
	categoryItemsFailed?: boolean
	value: StartingEquipmentChoice
	onChange: (choice: StartingEquipmentChoice) => void
}): ReactNode {
	const { inventory, currencyCopper } = buildStartingInventory(classOffer, backgroundOffer, value)
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
				categoryItemsFailed={categoryItemsFailed}
				value={value}
				onChange={onChange}
			/>

			<OfferSection
				origin="background"
				legend={backgroundName ? `From your background (${backgroundName})` : 'From your background'}
				offer={backgroundOffer}
				error={backgroundOfferError}
				categoryItems={categoryItems}
				categoryItemsFailed={categoryItemsFailed}
				value={value}
				onChange={onChange}
			/>

			{bothChosen && (
				<StartingTable inventory={inventory} currencyCopper={currencyCopper} />
			)}
		</div>
	)
}
