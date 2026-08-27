/*
 * Spells granted by a CHOSEN optional feature (build order step 6a, final
 * slice part 1) — the third consumer of the same `additionalSpells` field
 * subclasses (d2b/d6a) and feats (d5a) already read, so the parsing helpers
 * come from subclassPreparedSpells.ts rather than being written a third time.
 *
 * Shape confirmed by scripts/investigate-optional-feature-spells.js (D46)
 * before this module was written; the findings that shaped it:
 *
 * - 19 optional-features.json entries carry `additionalSpells`, but only the
 *   17 with featureType "EI" (Warlock Eldritch Invocations) are reachable —
 *   the other 2 are FS:P/FS:R, and per D12 an `FS:*` code resolves against
 *   feats.json, so those two entries are never offered by any picker.
 * - Every grant sits under the `"_"` level key, never a class-level key: the
 *   same always-granted wrapper the d5a feats use. Keys seen are `innate`
 *   (16), `known` (1) and `prepared` (1) — no `expanded`, so none of
 *   subclassPreparedSpells.ts's pact-slot-rank machinery applies here.
 * - `ability` is ABSENT on 15 of the 17 and the literal "cha" on the other 2
 *   (Pact of the Chain, Pact of the Tome) — never "inherit", never a choice
 *   object. Charisma IS the Warlock's own spellcasting ability and EI is
 *   Warlock-only, so even the 2 that name one name the granting class's own.
 *   No grant here is cast with a DIFFERENT ability than the class already
 *   uses, so no new spellcasting entry exists to compute and this module
 *   deliberately carries no `ability` field (unlike FeatGrantedSpell, whose
 *   feats really do introduce other abilities). Re-check this if the data
 *   ever grows an option whose ability differs from its class's.
 * - 16 of the 17 grant exactly one literal spell. Pact of the Tome is the
 *   only one whose grant is a `choose` filter (3 cantrips, 2 level-1
 *   rituals) — a PICKER, not a derived grant. `extractRefs` keeps only
 *   strings, so the derive path below still yields nothing for it; its picks
 *   come from storage instead, via extractOptionalFeatureChosenSpells at the
 *   bottom of this module. The slot/filter parsing lives in
 *   optionalFeatureSpellChoiceData.ts, next to the picker that uses it.
 * - One spell is granted by TWO options (Invisibility, by One with Shadows
 *   and Shroud of Shadow), so the cross-option provenance merge is a real
 *   case, not a hypothetical. No option lists the same spell twice today.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { CharacterOptionalFeatureChoice } from '../storage/character'
import { chosenSpellUsageFor } from './chosenSpellUsage'
import {
	extractRefsWithUsage,
	findSpell,
	hasConcentration,
	isRawSpell,
	isRecord,
	parseSpellRef,
	spellIdentityKey,
	type RawSpell,
	type SpellUsage,
} from './subclassPreparedSpells'

export interface OptionalFeatureGrantedSpell {
	name: string
	source: string
	/** The spell's own level (0 = cantrip). */
	level: number
	ritual: boolean
	concentration: boolean
	/** Provenance (the sheet's "from invocation (Name)" label), distinct from a feat's and a subclass's: always a chosen optional feature. */
	origin: 'optionalFeature'
	/** Which option granted this spell — the name the "from invocation (...)" label needs. */
	optionName: string
	/**
	 * How this spell is cast (this task, subclassPreparedSpells.ts's `SpellUsage`
	 * doc). Unlike the other two grant modules, a BARE grant here (no wrapper at
	 * all) is `{kind:'noSlot'}`, not silence: every one of this data's 12 bare
	 * `innate` Eldritch Invocation grants (Mask of Many Faces among them) says
	 * "without expending/using a spell slot" in its own prose — confirmed
	 * individually, not inferred from the JSON shape (docs/REPORT.md lists the
	 * phrase for each). The exact frequency (e.g. "once per long rest") is
	 * deliberately NOT parsed out of that prose — a wrong frequency on the sheet
	 * is worse than none, per the decision recorded in docs/REPORT.md. A
	 * WRAPPED bare grant (will/daily/ritual/resource) still gets its normal,
	 * more specific label instead. A player-CHOSEN spell
	 * (extractOptionalFeatureChosenSpells) has no wrapper to read, so its term
	 * comes from chosenSpellUsage.ts's hand table by option name — null (no
	 * label) for Pact of the Tome, whose picks "function as Warlock spells".
	 */
	usage?: SpellUsage | null
}

/** The same fixed-grant keys the other two consumers read. `expanded` is absent from this data entirely (module comment). */
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate'] as const

interface RawOptionalFeatureEntry {
	name: string
	source: string
	featureType?: unknown
	additionalSpells?: unknown
}

function isRawOptionalFeatureEntry(value: unknown): value is RawOptionalFeatureEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/**
 * Collapses a spell listed more than once WITHIN one option. Per-option
 * scope on purpose, exactly as featSpells.ts's own dedupe is per-feat: two
 * DIFFERENT options granting the same spell is a real case (Invisibility) the
 * sheet must show once with both named, and that joining is
 * `combineSpellEntries`'s job — collapsing it here would delete the
 * provenance instead.
 */
function dedupeWithinOption(spells: OptionalFeatureGrantedSpell[]): OptionalFeatureGrantedSpell[] {
	const byKey = new Map<string, OptionalFeatureGrantedSpell>()
	for (const spell of spells) {
		const key = spellIdentityKey(spell.name, spell.source)
		if (!byKey.has(key)) byKey.set(key, spell)
	}
	return [...byKey.values()]
}

/**
 * Pure filter (D38). Takes the character's stored optional-feature picks and
 * the parsed optional-features.json / spells.json arrays; returns the spells
 * those picks grant. Fetches nothing.
 *
 * A stored pick carries only the option's NAME plus the featureType it was
 * picked under, so the option is matched on both — the featureType scopes the
 * lookup the same way the picker's own list was scoped, rather than trusting
 * a bare name to be unique across every featureType. A pick whose featureType
 * resolves elsewhere (an `FS:*` code, which D12 sends to feats.json) simply
 * matches nothing here and yields no spells, which is correct: those options
 * are not optional-features.json entries.
 *
 * These grants are ADDITIONAL — nothing here touches `Character.spellChoices`,
 * so they can never count against the class spell picker's cantrip/prepared
 * counts.
 */
export function extractOptionalFeatureGrantedSpells(
	parsedOptionalFeatures: unknown,
	parsedSpells: unknown,
	selection: CharacterOptionalFeatureChoice[],
): OptionalFeatureGrantedSpell[] {
	if (!Array.isArray(parsedOptionalFeatures)) {
		throw new Error('optional-features.json: expected a top-level array.')
	}
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	const spells: RawSpell[] = parsedSpells.filter(isRawSpell)
	const entries = parsedOptionalFeatures.filter(isRawOptionalFeatureEntry)
	const result: OptionalFeatureGrantedSpell[] = []

	for (const stored of selection) {
		for (const chosenName of stored.choices) {
			const option = entries.find(
				(candidate) =>
					candidate.name.toLowerCase() === chosenName.toLowerCase() &&
					Array.isArray(candidate.featureType) &&
					candidate.featureType.includes(stored.featureType),
			)
			if (!option || !Array.isArray(option.additionalSpells)) continue

			const granted: OptionalFeatureGrantedSpell[] = []
			for (const block of option.additionalSpells) {
				if (!isRecord(block)) continue
				for (const key of FIXED_GRANT_KEYS) {
					const levelMap = block[key]
					if (levelMap === undefined) continue
					if (!isRecord(levelMap)) continue // unexpected variant of the key itself — skip cleanly, don't invent handling.

					// Every grant in this data sits under "_" (always granted), so no level gate
					// applies; a numeric key would need the character's level threading through and
					// none exists here (module comment). Still unwrapped per level key (rather than
					// handed to extractRefsWithUsage as a whole) so a bare "_" value is recognised as
					// bare rather than as an unrecognised wrapper key named "_".
					for (const value of Object.values(levelMap)) {
						// A BARE grant is labeled `noSlot`, not silence — see OptionalFeatureGrantedSpell's
						// `usage` doc for why this consumer's default differs from the other two.
						for (const { ref, usage } of extractRefsWithUsage(value, undefined, { kind: 'noSlot' })) {
							const spell = findSpell(spells, parseSpellRef(ref))
							if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).

							granted.push({
								name: spell.name,
								source: spell.source,
								level: spell.level,
								ritual: spell.meta?.ritual === true,
								concentration: hasConcentration(spell.duration),
								origin: 'optionalFeature',
								optionName: option.name,
								usage,
							})
						}
					}
				}
			}
			result.push(...dedupeWithinOption(granted))
		}
	}

	return result
}

/**
 * Pure filter (D38). The spells the player PICKED for an option that offers a
 * choice — Pact of the Tome's 3 cantrips and 2 rituals. Reads the stored
 * picks directly rather than re-deriving anything from `additionalSpells`
 * (there is no fixed grant to derive: the `choose` nodes name a filter, not
 * spells), exactly as featSpells.ts's `extractFilterChoiceSpells` does for a
 * feat. level/ritual/concentration are still looked up from spells.json so
 * the sheet gets the same detail a fixed grant would.
 *
 * Deduped per option for the same reason the fixed path is: a pick that
 * somehow appears in both slots counts once. Across options nothing is
 * collapsed — that provenance join is `combineSpellEntries`'s job.
 */
export function extractOptionalFeatureChosenSpells(parsedSpells: unknown, selection: CharacterOptionalFeatureChoice[]): OptionalFeatureGrantedSpell[] {
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}
	const spells: RawSpell[] = parsedSpells.filter(isRawSpell)
	const result: OptionalFeatureGrantedSpell[] = []

	for (const stored of selection) {
		for (const pick of stored.spellChoices ?? []) {
			// Only picks for an option the character actually still has chosen count — clearing the
			// option must not leave its spells on the sheet.
			if (!stored.choices.some((name) => name.toLowerCase() === pick.optionName.toLowerCase())) continue

			const granted: OptionalFeatureGrantedSpell[] = []
			for (const ref of [...pick.cantrips, ...pick.spells]) {
				const spell = findSpell(spells, { name: ref.name.toLowerCase(), source: ref.source.toUpperCase() })
				if (!spell) continue // stored pick no longer resolves (data changed under it) — skip cleanly (D43).
				granted.push({
					name: spell.name,
					source: spell.source,
					level: spell.level,
					ritual: spell.meta?.ritual === true,
					concentration: hasConcentration(spell.duration),
					origin: 'optionalFeature',
					optionName: pick.optionName,
					// D21/D70: Pact of the Tome's picks "function as Warlock spells for you" — ordinary prepared, no term. chosenSpellUsageFor returns null for it; a future choice-offering option could differ.
					usage: spell.level >= 1 ? chosenSpellUsageFor(pick.optionName) : undefined,
				})
			}
			result.push(...dedupeWithinOption(granted))
		}
	}

	return result
}

/**
 * Fetches optional-features.json and spells.json through the shared cache
 * (D39) and returns BOTH halves of the character's optional-feature spells:
 * the fixed grants derived from `additionalSpells`, and the picks stored for
 * an option that offers a choice (Pact of the Tome).
 */
export async function loadOptionalFeatureGrantedSpells(character: {
	optionalFeatureChoices?: CharacterOptionalFeatureChoice[]
}): Promise<OptionalFeatureGrantedSpell[]> {
	const selection = character.optionalFeatureChoices ?? []
	if (selection.length === 0) return []
	const [optionalFeatures, spells] = await Promise.all([loadDataFile('data/optional-features.json'), loadDataFile('data/spells.json')])
	return [...extractOptionalFeatureGrantedSpells(optionalFeatures, spells, selection), ...extractOptionalFeatureChosenSpells(spells, selection)]
}
