import type { CharacterSpellbook } from '../storage/character'
import type { SpellTime } from './spellDetailData'
import { spellIdentityKey } from './subclassPreparedSpells'

export const SPELL_MASTERY_LEVEL = 18
export const SIGNATURE_SPELLS_LEVEL = 20
export const SIGNATURE_SPELL_LEVEL = 3
const SIGNATURE_COUNT = 2

export type BookPickKind = 'mastery' | 'signature'

interface SpellRef {
	name: string
	source: string
}

export interface BookPicks {
	mastery: SpellRef[]
	signature: SpellRef[]
}

const FEATURE_NAMES: Record<BookPickKind, string> = { mastery: 'Spell Mastery', signature: 'Signature Spells' }

const keyOf = (spell: SpellRef) => spellIdentityKey(spell.name, spell.source)

/** D425 (PHB 2024): Spell Mastery takes a level 1 or 2 spell cast as an action; Signature Spells a level 3 spell. */
export function bookPickKindFor(spellLevel: number | null, time: readonly SpellTime[], wizardLevel: number): BookPickKind | null {
	if (spellLevel === SIGNATURE_SPELL_LEVEL && wizardLevel >= SIGNATURE_SPELLS_LEVEL) return 'signature'
	if ((spellLevel === 1 || spellLevel === 2) && wizardLevel >= SPELL_MASTERY_LEVEL && time.some((entry) => entry.unit === 'action' && entry.number === 1)) return 'mastery'
	return null
}

export function storedBookPicks(book: CharacterSpellbook | undefined): BookPicks {
	return { mastery: book?.mastery ?? [], signature: book?.signature ?? [] }
}

export function isBookPick(picks: BookPicks, kind: BookPickKind, spell: SpellRef): boolean {
	return picks[kind].some((pick) => keyOf(pick) === keyOf(spell))
}

/** D425: Spell Mastery holds one spell per level (1 and 2), Signature Spells two. A picked spell can always be unpicked. */
export function canToggleBookPick(picks: BookPicks, kind: BookPickKind, spell: SpellRef, levelOf: (spell: SpellRef) => number | null): boolean {
	if (isBookPick(picks, kind, spell)) return true
	if (kind === 'signature') return picks.signature.length < SIGNATURE_COUNT
	const level = levelOf(spell)
	return !picks.mastery.some((pick) => levelOf(pick) === level)
}

export function toggledBookPicks(picks: BookPicks, kind: BookPickKind, spell: SpellRef): BookPicks {
	const next = isBookPick(picks, kind, spell)
		? picks[kind].filter((pick) => keyOf(pick) !== keyOf(spell))
		: [...picks[kind], { name: spell.name, source: spell.source }]
	return { ...picks, [kind]: next }
}

/** The "x/2 chosen" lines above the book; none below the feature's level. */
export function bookPickStatus(picks: BookPicks, wizardLevel: number): string[] {
	const lines: string[] = []
	if (wizardLevel >= SPELL_MASTERY_LEVEL) lines.push(`${FEATURE_NAMES.mastery}: ${picks.mastery.length}/2 chosen`)
	if (wizardLevel >= SIGNATURE_SPELLS_LEVEL) lines.push(`${FEATURE_NAMES.signature}: ${picks.signature.length}/${SIGNATURE_COUNT} chosen`)
	return lines
}

/** The picks that count now: the feature is held and the spell is still in the book (stored or Savant, D424). */
export function activeBookPicks(book: CharacterSpellbook | undefined, inBook: readonly SpellRef[], wizardLevel: number): BookPicks {
	const keys = new Set(inBook.map(keyOf))
	const picks = storedBookPicks(book)
	return {
		mastery: wizardLevel >= SPELL_MASTERY_LEVEL ? picks.mastery.filter((pick) => keys.has(keyOf(pick))) : [],
		signature: wizardLevel >= SIGNATURE_SPELLS_LEVEL ? picks.signature.filter((pick) => keys.has(keyOf(pick))) : [],
	}
}

/** One class's book with its picks replaced; empty pick lists are left out. */
export function withBookPicks(book: CharacterSpellbook, picks: BookPicks): CharacterSpellbook {
	const { mastery: _mastery, signature: _signature, ...rest } = book
	return {
		...rest,
		...(picks.mastery.length > 0 ? { mastery: picks.mastery } : {}),
		...(picks.signature.length > 0 ? { signature: picks.signature } : {}),
	}
}

/**
 * D425: drops the picks whose spell left the book or whose feature the Wizard level no longer grants.
 * `inBook` is everything in the book (stored spells and Savant picks). `dropped` names each lost pick for the Remove level dialog.
 */
export function prunedBookPicks(
	spellbooks: readonly CharacterSpellbook[],
	className: string,
	classSource: string,
	inBook: readonly SpellRef[],
	wizardLevel: number,
): { spellbooks: CharacterSpellbook[]; dropped: string[] } {
	const dropped: string[] = []
	const next = spellbooks.map((book) => {
		if (book.className !== className || book.classSource !== classSource) return book
		const before = storedBookPicks(book)
		const kept = activeBookPicks(book, inBook, wizardLevel)
		let changed = false
		for (const kind of ['mastery', 'signature'] as const) {
			const keptKeys = new Set(kept[kind].map(keyOf))
			for (const pick of before[kind]) {
				if (keptKeys.has(keyOf(pick))) continue
				dropped.push(`${FEATURE_NAMES[kind]}: ${pick.name}`)
				changed = true
			}
		}
		return changed ? withBookPicks(book, kept) : book
	})
	return { spellbooks: dropped.length > 0 ? next : [...spellbooks], dropped }
}

/** E: the level up review points the player to Manage Spells, where these features are picked (D425). */
export function bookPickFeatureNote(featureName: string, className: string, classSource: string): string | null {
	if (className !== 'Wizard' || classSource !== 'XPHB') return null
	return Object.values(FEATURE_NAMES).includes(featureName) ? 'Choose in Manage Spells' : null
}
