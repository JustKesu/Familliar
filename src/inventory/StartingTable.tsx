import type { ReactNode } from 'react'
import type { CharacterInventoryItem } from '../storage/character'
import { itemKey } from './inventoryData'
import { copperToCoins } from './currency'

/** W-7 (D263): the "You will start with" card — money in the header, items in a NAME · QTY table like the sheet's Inventory tab. W-9: the Review step swaps the heading. */
export function StartingTable({ inventory, currencyCopper, heading }: { inventory: CharacterInventoryItem[]; currencyCopper: number; heading?: ReactNode }): ReactNode {
	const coins = copperToCoins(currencyCopper)
	return (
		<section className="starting-equipment__summary">
			<div className="start-table__header">
				{heading ?? <h3>You will start with</h3>}
				<span className="start-table__money">
					{coins.gp} gp · {coins.sp} sp · {coins.cp} cp
				</span>
			</div>
			{inventory.length === 0 ? (
				<p>No items — this character starts with money only.</p>
			) : (
				<table className="start-table">
					<thead>
						<tr>
							<th scope="col">Name</th>
							<th scope="col">Qty</th>
						</tr>
					</thead>
					<tbody>
						{inventory.map((item) => (
							<tr key={itemKey(item)}>
								<td>{item.name}</td>
								<td>{item.quantity}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</section>
	)
}
