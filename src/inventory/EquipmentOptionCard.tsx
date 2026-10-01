import { useState, type ReactNode } from 'react'
import { itemKey } from './inventoryData'
import type { EquipmentOrigin, StartingEquipmentElement, StartingEquipmentOption } from './startingEquipmentData'

/*
 * W-7 (D263): one starting-equipment option as a card — label, what it grants,
 * a CHOOSE / CHOSEN button. The whole card is the click target; the button is
 * the keyboard one (its click bubbles to the card). A pack row's ▸ stops the
 * click, so opening a pack never takes the option, nor does a click inside
 * its contents (D269). Never owns the selection (D8);
 * a pack's open state is local only (D116).
 */

function PackRow({ element }: { element: Extract<StartingEquipmentElement, { kind: 'items' }> }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="equip-card__row">
			<button
				type="button"
				className="choice-row__head equip-card__pack"
				aria-expanded={open}
				aria-label={`${element.label} contents`}
				onClick={(event) => {
					event.stopPropagation()
					setOpen(!open)
				}}
			>
				<span className="choice-row__arrow" aria-hidden="true">
					{open ? '▾' : '▸'}
				</span>
				<span>{element.label}</span>
			</button>
			{open && (
				<ul className="equip-card__contents" onClick={(event) => event.stopPropagation()}>
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
}

/** A pack contributes its contents, not itself; a single item named like its label is a plain row. */
function isPack(element: Extract<StartingEquipmentElement, { kind: 'items' }>): boolean {
	return element.items.length !== 1 || element.items[0].name !== element.label.replace(/ ×\d+$/, '')
}

export function EquipmentOptionCard({
	origin,
	option,
	chosen,
	onChoose,
}: {
	origin: EquipmentOrigin
	option: StartingEquipmentOption
	chosen: boolean
	onChoose: () => void
}): ReactNode {
	// "Option A" → "option A", so the accessible name reads "Choose class option A".
	const optionName = option.label.charAt(0).toLowerCase() + option.label.slice(1)
	return (
		// The card click is a mouse convenience; the button inside is the keyboard and screen-reader route.
		<div
			className={chosen ? 'equip-card equip-card--on' : 'equip-card'}
			role="group"
			aria-label={`${origin === 'class' ? 'Class' : 'Background'} ${optionName}`}
			onClick={onChoose}
		>
			<div className="equip-card__head">
				<span className="equip-card__label">{option.label}</span>
				<button
					type="button"
					className={chosen ? 'manage-spells__button manage-spells__button--on' : 'manage-spells__button'}
					aria-label={`Choose ${origin} ${optionName}`}
					aria-pressed={chosen}
				>
					{chosen ? 'Chosen' : 'Choose'}
				</button>
			</div>
			<ul className="equip-card__list">
				{option.elements.map((element, index) =>
					element.kind === 'items' && isPack(element) ? (
						<PackRow key={index} element={element} />
					) : (
						<li key={index} className="equip-card__row">
							{element.label}
						</li>
					),
				)}
			</ul>
		</div>
	)
}
