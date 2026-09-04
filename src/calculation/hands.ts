/*
 * Hands (build order step 7, slice b-fix). A new file in this folder per D47.
 *
 * A character has two hands and everything held occupies one or both of them.
 * That single number answers every case a count of weapons gets wrong: two
 * Shortswords are legal because they are two one-handed weapons, while a
 * Greatsword and a Greataxe are four hands' worth and a Greatsword and a Shield
 * are three.
 *
 * Pure (D38): how many hands a given item takes is an items.json question the
 * caller answers (src/inventory/inventoryData.ts, `handsRequiredOf`); this file
 * only decides what has to be put down for the newcomer to fit.
 */

/** PHB 2024: a character has two hands, and the rules count nothing else. */
export const HANDS_AVAILABLE = 2

/** One thing already in hand, or the one being taken up. `index` is the caller's own row position, returned untouched. */
export interface HeldThing {
	index: number
	name: string
	hands: number
}

export interface HandsDisplacement {
	/** What has to be put down, oldest first, for `taking` to fit. Empty when it already does. */
	displaced: HeldThing[]
	/** The line naming what was put down, or null when nothing was. */
	message: string | null
}

function handsPhrase(hands: number): string {
	return hands >= HANDS_AVAILABLE ? 'both hands' : 'a free hand'
}

/**
 * What the character has to put down to take `taking` in hand. `held` is every
 * other thing currently held, in INVENTORY ORDER — which is the only record of
 * age this app keeps, so the oldest row is the first one dropped.
 *
 * A row already held (a Versatile weapon changing its grip) is re-taken rather
 * than counted twice: the caller passes it as `taking` and leaves it out of
 * `held`.
 */
export function makeRoomForHands(held: readonly HeldThing[], taking: HeldThing): HandsDisplacement {
	let used = held.reduce((total, thing) => total + thing.hands, 0)
	const displaced: HeldThing[] = []
	for (const thing of held) {
		if (used + taking.hands <= HANDS_AVAILABLE) break
		displaced.push(thing)
		used -= thing.hands
	}
	if (displaced.length === 0) return { displaced, message: null }
	return {
		displaced,
		message: `Unequipped ${displaced.map((thing) => thing.name).join(', ')} — ${taking.name} needs ${handsPhrase(taking.hands)}.`,
	}
}
