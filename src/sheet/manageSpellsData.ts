import type { CharacterSpellChoice } from '../storage/character'
import { spellIdentityKey } from '../spells/subclassPreparedSpells'
import { compareText } from '../text/compareText'

export interface SpellRef {
	name: string
	source: string
}

/** Why a spell sits in a class's Prepared Spells list (D208): only a `pick` has a button and counts toward the limits. */
export type PreparedSpellKind = 'pick' | 'subclassChoice' | 'alwaysPrepared'

export interface PreparedSpellRow extends SpellRef {
	level: number | null
	kind: PreparedSpellKind
	/** A pick that a grant covers too: the button stays, the limits ignore it. */
	alsoGranted?: boolean
}

export interface ClassSpellHoldings {
	/** This class's own Character.spellChoices entry. */
	picks: readonly SpellRef[]
	/** Subclass filter-choice picks (subclassSpellChoiceData.ts) — edited in Edit Character, read-only here. */
	subclassChoicePicks: readonly SpellRef[]
	/** Class (D192) and subclass (D62) always-prepared grants. */
	alwaysPrepared: readonly SpellRef[]
}

/** One row per spell the class gives the character, cantrips first; a spell reachable twice keeps the removable kind. */
export function preparedSpellRows(holdings: ClassSpellHoldings, levelOf: (spell: SpellRef) => number | null): PreparedSpellRow[] {
	const rows = new Map<string, PreparedSpellRow>()
	const add = (spells: readonly SpellRef[], kind: PreparedSpellKind) => {
		for (const spell of spells) {
			const key = spellIdentityKey(spell.name, spell.source)
			if (!rows.has(key)) rows.set(key, { name: spell.name, source: spell.source, level: levelOf(spell), kind })
		}
	}
	add(holdings.picks, 'pick')
	add(holdings.subclassChoicePicks, 'subclassChoice')
	add(holdings.alwaysPrepared, 'alwaysPrepared')
	// F-7b: a pick the class or subclass now grants anyway is prepared without the pick, so it must not eat a prepared slot.
	const granted = new Set([...holdings.subclassChoicePicks, ...holdings.alwaysPrepared].map((spell) => spellIdentityKey(spell.name, spell.source)))
	for (const [key, row] of rows) if (row.kind === 'pick' && granted.has(key)) row.alsoGranted = true
	return [...rows.values()].sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || compareText(a.name, b.name))
}

/** The panel's two counters (D208): only the class's own picks count; a pick whose level is unknown counts toward neither, as the sheet's D106 notice does. */
export function pickCounts(rows: readonly PreparedSpellRow[]): { cantrips: number; prepared: number } {
	const picks = rows.filter((row) => row.kind === 'pick' && !row.alsoGranted && row.level !== null)
	return { cantrips: picks.filter((row) => row.level === 0).length, prepared: picks.filter((row) => row.level! > 0).length }
}

/** Character.spellChoices with one class's picks replaced; an empty pick list drops that class's entry. */
export function withClassPicks(spellChoices: readonly CharacterSpellChoice[], className: string, classSource: string, picks: readonly SpellRef[]): CharacterSpellChoice[] {
	const others = spellChoices.filter((choice) => !(choice.className === className && choice.classSource === classSource))
	if (picks.length === 0) return others
	const index = spellChoices.findIndex((choice) => choice.className === className && choice.classSource === classSource)
	const entry = { className, classSource, spells: picks.map((pick) => ({ name: pick.name, source: pick.source })) }
	if (index === -1) return [...others, entry]
	return [...others.slice(0, index), entry, ...others.slice(index)]
}
