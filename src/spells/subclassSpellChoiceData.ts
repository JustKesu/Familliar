/*
 * Subclass filter-choice spell picker data layer (build order step 6, slice
 * d6b — the LAST picker of step 6). Covers the 5 subclasses
 * scripts/investigate-subclass-spell-shapes.js classified as CHOICE (a
 * `choose` node in additionalSpells): Bard College of Lore and the 4 core
 * Wizard subclasses (Abjurer, Diviner, Evoker, Illusionist). Reuses
 * featSpellChoiceData.ts's "level=N[;N...]|filter" mini-language parser and
 * offeredSpellsForSlot, generalized there (d6b) rather than copied — see
 * that module's own comment for exactly what generalized.
 *
 * Shapes confirmed by scripts/investigate-d6b-choice-shapes.js:
 *   - Bard College of Lore, class level 6: TWO independent choose nodes
 *     under `prepared["6"]`, each "level=0;1;2;3|class=Cleric;Druid;Wizard"
 *     — a one-time grant of 2 spells from another class's list, level <= 3.
 *   - Wizard Abjurer/Diviner/Evoker/Illusionist, under `known`: choose nodes
 *     at class levels 3 (TWO nodes, cap level 0-2), 5, 7, 9, 11, 13, 15, 17
 *     (one node each, cap growing by one spell level per node, always
 *     "class=Wizard|school=<code>" for the subclass's own school) — 9 slots
 *     total, unlocked progressively as the character's own class level
 *     rises. No choose node in any of the 5 carries an explicit `count` —
 *     every slot is a single pick (confirmed by the investigate script).
 *
 * Each slot is identified by (grantedAtLevel, slotIndex) rather than a flat
 * array position — `slotIndex` disambiguates the 2 simultaneous slots at
 * Lore's level 6 and each Wizard subclass's level 3, and keeps a stored pick
 * (storage/character.ts CharacterSubclassSpellChoicePick) self-describing
 * instead of fragile to reordering.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { CharacterSubclassSpellChoice } from '../storage/character'
import { findChooseNodes, offeredSpellsForSlot as offeredSpellsForFilterSlot, parseChooseString, type FilterChoiceCandidateSpell, type SpellChoiceFilter } from './featSpellChoiceData'
import { findSpell, hasConcentration, isRawSpell, isRecord, type AlwaysPreparedSpell } from './subclassPreparedSpells'

export interface SubclassSpellChoiceSlot {
	/** The class level this slot is granted at. */
	grantedAtLevel: number
	/** 0-based position among slots granted at the SAME grantedAtLevel — 0 and 1 for Lore's 2 slots at level 6 and each Wizard subclass's 2 slots at level 3; always 0 for every other slot (one per level). */
	slotIndex: number
	levels: number[]
	filter: SpellChoiceFilter
}

/** The 5 subclasses this module covers, keyed `${name}|${source}` — investigate-subclass-spell-shapes.js's CHOICE group. Every other subclass's additionalSpells is either a fixed grant (subclassPreparedSpells.ts) or has none. */
export const SUBCLASS_SPELL_CHOICE_KEYS = new Set(['College of Lore|XPHB', 'Abjurer|XPHB', 'Diviner|XPHB', 'Evoker|XPHB', 'Illusionist|XPHB'])

export function isSubclassSpellChoice(subclass: { name: string; source: string }): boolean {
	return SUBCLASS_SPELL_CHOICE_KEYS.has(`${subclass.name}|${subclass.source}`)
}

interface RawSubclassEntry {
	entryType: string
	name: string
	source: string
	className: string
	classSource: string
	additionalSpells?: unknown
}

function isRawSubclassEntry(value: unknown): value is RawSubclassEntry {
	return (
		isRecord(value) &&
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

/** Same fixed-grant key set subclassPreparedSpells.ts reads a spell name out of — a choose node can be nested under any of the three (only `known`/`prepared` are seen across the 5 subclasses this module covers, `innate` included for consistency with that module). */
const CHOICE_GRANT_KEYS = ['known', 'prepared', 'innate'] as const

/**
 * Pure filter (D38). Every choice slot this subclass's additionalSpells
 * grants, ordered by grantedAtLevel then data order within that level.
 * Empty if the subclass isn't in SUBCLASS_SPELL_CHOICE_KEYS, isn't found, or
 * has no additionalSpells.
 */
export function subclassSpellChoiceShape(
	parsedClasses: unknown,
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
): SubclassSpellChoiceSlot[] {
	if (!isSubclassSpellChoice({ name: subclassName, source: subclassSource })) return []
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const subclass = parsedClasses.find(
		(c): c is RawSubclassEntry =>
			isRawSubclassEntry(c) && c.name === subclassName && c.source === subclassSource && c.className === className && c.classSource === classSource,
	)
	if (!subclass || !Array.isArray(subclass.additionalSpells)) return []

	const slots: SubclassSpellChoiceSlot[] = []
	const slotIndexByLevel = new Map<number, number>()

	for (const entry of subclass.additionalSpells) {
		if (!isRecord(entry)) continue
		for (const key of CHOICE_GRANT_KEYS) {
			const levelMap = entry[key]
			if (!isRecord(levelMap)) continue
			for (const [levelKey, value] of Object.entries(levelMap)) {
				const grantedAtLevel = Number(levelKey)
				if (!Number.isFinite(grantedAtLevel)) continue // covers non-level keys like Warlock Archfey's "_" — none occur in the 5 subclasses here, kept defensive.
				if (!Array.isArray(value)) continue

				for (const item of value) {
					const nodes = findChooseNodes(item)
					for (const node of nodes) {
						const parsed = parseChooseString(node.choose)
						if (!parsed) continue // unexpected mini-language shape — skip cleanly (D43).
						const slotIndex = slotIndexByLevel.get(grantedAtLevel) ?? 0
						slotIndexByLevel.set(grantedAtLevel, slotIndex + 1)
						slots.push({ grantedAtLevel, slotIndex, levels: parsed.levels, filter: parsed.filter })
					}
				}
			}
		}
	}

	slots.sort((a, b) => a.grantedAtLevel - b.grantedAtLevel || a.slotIndex - b.slotIndex)
	return slots
}

/** The slots unlocked at or below `classLevel`. */
export function unlockedSubclassSpellChoiceSlots(shape: SubclassSpellChoiceSlot[], classLevel: number): SubclassSpellChoiceSlot[] {
	return shape.filter((slot) => slot.grantedAtLevel <= classLevel)
}

export async function loadSubclassSpellChoiceShape(subclassName: string, subclassSource: string, className: string, classSource: string): Promise<SubclassSpellChoiceSlot[]> {
	const parsed = await loadDataFile('data/classes.json')
	return subclassSpellChoiceShape(parsed, subclassName, subclassSource, className, classSource)
}

export interface SubclassSpellChoiceOffer {
	slot: SubclassSpellChoiceSlot
	candidates: FilterChoiceCandidateSpell[]
}

/** Fetches classes.json and spells.json once and returns every unlocked slot alongside its offered candidates — what the picker (SubclassSpellChoicePicker.tsx) renders. */
export async function loadSubclassSpellChoiceOffers(
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
	classLevel: number,
): Promise<SubclassSpellChoiceOffer[]> {
	const [parsedClasses, parsedSpells] = await Promise.all([loadDataFile('data/classes.json'), loadDataFile('data/spells.json')])
	const shape = subclassSpellChoiceShape(parsedClasses, subclassName, subclassSource, className, classSource)
	const unlocked = unlockedSubclassSpellChoiceSlots(shape, classLevel)
	return unlocked.map((slot) => ({ slot, candidates: offeredSpellsForFilterSlot(parsedSpells, slot) }))
}

/**
 * Pure filter (D38). The character's own stored subclass spell-choice picks
 * (Character.subclassSpellChoices), resolved into the SAME AlwaysPreparedSpell
 * shape subclassPreparedSpells.ts's fixed grants use — `origin: 'subclass'`,
 * `grantedAtLevel` read straight off the stored pick (no need to re-derive
 * the shape here; only the player's own picker writes this field, and it
 * always matches a real slot's grantedAtLevel). Lets the sheet merge these
 * into the SAME "always prepared (subclass name)" provenance label a fixed
 * subclass grant already uses (CharacterSheet.tsx, SpellList.tsx) rather than
 * inventing a second label for what is, on the sheet, the same kind of thing
 * — additional to the class picker's own counts, never a player's chosen
 * spell in the ordinary sense.
 */
export function extractSubclassChosenSpells(parsedSpells: unknown, choices: CharacterSubclassSpellChoice[]): AlwaysPreparedSpell[] {
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}
	const spells = parsedSpells.filter(isRawSpell)
	const result: AlwaysPreparedSpell[] = []

	for (const choice of choices) {
		for (const pick of choice.picks) {
			const spell = findSpell(spells, { name: pick.name.toLowerCase(), source: pick.source.toUpperCase() })
			if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).
			result.push({
				name: spell.name,
				source: spell.source,
				level: spell.level,
				grantedAtLevel: pick.grantedAtLevel,
				ritual: spell.meta?.ritual === true,
				concentration: hasConcentration(spell.duration),
				origin: 'subclass',
			})
		}
	}
	return result
}

/** Fetches spells.json and returns extractSubclassChosenSpells's result for `choices`. */
export async function loadSubclassChosenSpells(choices: CharacterSubclassSpellChoice[]): Promise<AlwaysPreparedSpell[]> {
	const parsed = await loadDataFile('data/spells.json')
	return extractSubclassChosenSpells(parsed, choices)
}
