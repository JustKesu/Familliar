/*
 * Species-granted spells ("kouzla z rasy", build order step 6 race slice,
 * first half) — the FIFTH consumer of the same `additionalSpells` field
 * subclasses (d2b/d6a), feats (d5a) and chosen optional features (6a) already
 * read, so every parsing helper comes from subclassPreparedSpells.ts rather
 * than being written a fifth time.
 *
 * Shape confirmed by scripts/investigate-race-spells.js (D46) before this
 * module was written, over all 78 species.json entries:
 *
 * - 30 entries carry `additionalSpells`, in only 4 key shapes:
 *   ["ability","innate","known"] (15), ["ability","known"] (8),
 *   ["ability","innate","known","name"] (6) and ["ability","innate"] (5).
 *   `prepared` and `expanded` NEVER occur on a species — so none of
 *   subclassPreparedSpells.ts's `expanded` machinery (pact-slot ranks,
 *   pool-widening) has anything to apply to here. FIXED_GRANT_KEYS below still
 *   lists `prepared` for symmetry with the other four modules; it simply never
 *   matches today.
 * - Levels are keyed by plain CHARACTER level (`known["1"]`, `innate["3"]`,
 *   `innate["5"]`) — not class level: a species is not tied to a class, the
 *   same reasoning featSpells.ts's D11 total-level sum already records. Plus
 *   the non-numeric `"_"` key meaning "always granted", featSpells.ts's own
 *   convention on the identical field.
 * - `ability` is present on every entry: 33 of 34 carry the CHOICE shape
 *   `{"choose":["int","wis","cha"]}`, and only Aasimar (XPHB) is fixed
 *   ("cha"). See `unresolvedAbilityReason` below for what the choice case
 *   does — it is deliberately visible, not silent, and closing it is a named
 *   follow-up task (a stored ability pick plus its picker), not this slice.
 * - The ["ability","innate","known","name"] shape is the UNRESOLVED
 *   multi-option form (`[{"name":"Drow",…},{"name":"High Elf",…},…]`) and
 *   occurs only on the three family-BASE records (Elf, Kobold, Tiefling) that
 *   also have resolved variants. D81/D82/D84 guarantee `Character.species`
 *   always holds a resolved variant ("Elf; Drow Lineage"), never an ambiguous
 *   family base, so this module looks `additionalSpells` up directly on the
 *   stored record and never has to disambiguate — the shape is simply never
 *   reached. Nothing is built for it.
 * - Three Aasimar variants (Necrotic Shroud, Radiant Consumption, Radiant
 *   Soul — MPMM) carry `additionalSpells` AND `reprintedAs`, which
 *   speciesData.ts already treats as never-selectable; nothing can store them,
 *   so nothing reaches them here.
 * - 11 of the 81 spell refs are written with a bare `#c` tag appended to the
 *   NAME and no `|source` ("light#c", "mage hand#c"). parseSpellRef stripped
 *   `#...` only from the source half, so all 11 failed to resolve; it now
 *   strips it from both (see its own doc). All 81 refs resolve.
 * - Gnome; Rock Gnome Lineage is the only carrier of a `daily: {"pb": …}`
 *   sub-key in the whole data set — proficiency-bonus-many free casts per Long
 *   Rest (parseDailySubkey's new `pb` case, fed the bonus computed here).
 *
 * Deliberately NOT built here (deferred, and visible rather than silent — the
 * same spirit as D43/D58): 5 entries (Elf base + Elf; High Elf Lineage,
 * Khoravar, Kobold base + Kobold; Draconic Sorcery) whose `known` value is a
 * `choose` FILTER node ("pick a cantrip from the Wizard spell list") rather
 * than a named spell. No picker and no storage is built for those; each
 * produces one plainly-marked note (`RaceSpellGrants.notes`) that the sheet
 * shows next to the granted spells, so the gap is honest instead of an empty
 * space.
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import { proficiencyBonusForLevel } from '../calculation/proficiencyBonus'
import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character } from '../storage/character'
import { findChooseNodes, type RawChooseNode } from './featSpellChoiceData'
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

export interface RaceGrantedSpell {
	name: string
	source: string
	/** The spell's own level (0 = cantrip). */
	level: number
	ritual: boolean
	concentration: boolean
	/** Provenance (the sheet's "from species (...)" label), distinct from a feat's, a subclass's and an option's. */
	origin: 'species'
	/** The stored species variant's own name ("Aasimar", "Gnome; Rock Gnome Lineage") — what the "from species (...)" label shows. */
	speciesName: string
	/** null for the `"_"` always-granted key; otherwise the TOTAL character level (D11) the grant unlocks at. */
	grantedAtLevel: number | null
	/** Set only when the species' `ability` field names a fixed code — Aasimar (XPHB) alone today. Absent for the 33 choice-ability entries. */
	ability?: AbilityAbbreviation
	/** Set exactly when `ability` is absent: why no attack bonus / save DC can be computed for this spell yet (D58 — visible, not silent). */
	unresolvedAbilityReason?: string
	/** How this spell is cast (subclassPreparedSpells.ts's `SpellUsage`) — null for a bare grant, cast like any other prepared spell. */
	usage?: SpellUsage | null
}

/** One deferred `choose`-filter grant, worded for display. Carries no spell: nothing was granted, and that is the point. */
export interface RaceSpellNote {
	speciesName: string
	text: string
}

export interface RaceSpellGrants {
	spells: RaceGrantedSpell[]
	notes: RaceSpellNote[]
}

/** Same set the other four consumers read. `prepared` never occurs on a species (module comment); listed so the five modules stay one shape. */
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate'] as const

const FIXED_ABILITIES: readonly AbilityAbbreviation[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** True only for a plain named ability code — excludes the `{choose:[…]}` shape 33 of the 34 entries carry. */
function isFixedAbility(value: unknown): value is AbilityAbbreviation {
	return typeof value === 'string' && (FIXED_ABILITIES as readonly string[]).includes(value)
}

/** D11: total level across every class, the same sum featSpells.ts and proficiencyBonus.ts use — a species' numeric grant keys gate on this, not on any one class's level. */
function totalCharacterLevel(character: Character): number {
	return (character.classes ?? []).reduce((sum, c) => sum + c.level, 0)
}

/** The data writes a `class=` clause's name in whatever case the book used ("wizard", "Wizard"); the note shows it the way a player writes it. */
function titleCase(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * The one visible line a deferred `choose`-filter grant produces. Reads the
 * `level=`/`class=` clauses straight off the choose string rather than through
 * featSpellChoiceData.ts's parser: that parser resolves a class NAME to a
 * class identity through a 5-entry lookup and returns null for anything else,
 * which would turn an unlisted class into no note at all — exactly the silent
 * omission this line exists to prevent.
 */
function deferredChoiceNote(speciesName: string, node: RawChooseNode): string {
	const parts = node.choose.split('|')
	const levels = /^level=([\d;]+)$/.exec(parts[0])?.[1].split(';') ?? []
	const what = levels.length === 1 && levels[0] === '0' ? 'a cantrip' : levels.length > 0 ? `a spell of level ${levels.join('/')}` : 'a spell'
	const classClause = parts.slice(1).find((clause) => clause.startsWith('class='))
	const from = classClause
		? `the ${classClause.slice('class='.length).split(';').map(titleCase).join('/')} spell list`
		: 'a class spell list'
	return `${speciesName} lets you pick ${what} from ${from} — not yet supported.`
}

interface RawSpeciesEntry {
	name: string
	source: string
	additionalSpells?: unknown
}

function isRawSpeciesEntry(value: unknown): value is RawSpeciesEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/** Collapses a spell listed under more than one grant key of the SAME species, exactly as the other four modules dedupe their own source. */
function dedupeWithinSpecies(spells: RaceGrantedSpell[]): RaceGrantedSpell[] {
	const byKey = new Map<string, RaceGrantedSpell>()
	for (const spell of spells) {
		const key = spellIdentityKey(spell.name, spell.source)
		const existing = byKey.get(key)
		// Keep the earliest grant: the spell is available as soon as ANY key grants it ("_" / null is earliest of all).
		if (!existing) byKey.set(key, spell)
		else if (existing.grantedAtLevel !== null && (spell.grantedAtLevel === null || spell.grantedAtLevel < existing.grantedAtLevel)) byKey.set(key, spell)
	}
	return [...byKey.values()]
}

const UNRESOLVED_ABILITY_REASON = 'spellcasting ability not chosen yet'

/**
 * Pure filter (D38). The spells the character's stored species grants at its
 * current total level, plus the notes for the deferred `choose`-filter grants.
 * Fetches nothing.
 *
 * The lookup is a direct name+source match on the STORED species record — the
 * same one-record lookup damageResponseData.ts's `buildSpeciesGrants` already
 * does, and the same flat, nothing-threaded shape optionalFeatureSpells.ts
 * has. No family/variant disambiguation happens here and none is needed
 * (D81/D82/D84, module comment).
 *
 * A species whose record is missing from the data yields nothing rather than
 * an error: the sheet already reports an unresolvable species elsewhere and a
 * second copy of that message on the spell list adds nothing.
 */
export function raceSpellsFor(character: Character, parsedSpecies: unknown, parsedSpells: unknown): RaceSpellGrants {
	const empty: RaceSpellGrants = { spells: [], notes: [] }
	if (!character.species) return empty
	if (!Array.isArray(parsedSpecies)) {
		throw new Error('species.json: expected a top-level array.')
	}
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	const stored = character.species
	const species = parsedSpecies.find((candidate): candidate is RawSpeciesEntry => isRawSpeciesEntry(candidate) && candidate.name === stored.name && candidate.source === stored.source)
	if (!species || !Array.isArray(species.additionalSpells)) return empty

	const spells: RawSpell[] = parsedSpells.filter(isRawSpell)
	const characterLevel = totalCharacterLevel(character)
	// No class yet means no proficiency bonus to report, so a "pb" grant carries no count rather than a guessed one (parseDailySubkey).
	const proficiencyBonus = characterLevel > 0 ? proficiencyBonusForLevel(characterLevel) : undefined
	const granted: RaceGrantedSpell[] = []
	const notes: RaceSpellNote[] = []

	for (const entry of species.additionalSpells) {
		if (!isRecord(entry)) continue
		// The three family-BASE records' unresolved multi-option shape carries a `name` field; D81 guarantees a character
		// never stores one of those, so reaching this would mean the guarantee broke — skip rather than grant all options.
		if (typeof entry['name'] === 'string') continue

		const abilityField = entry['ability']
		const ability = isFixedAbility(abilityField) ? abilityField : undefined

		for (const key of FIXED_GRANT_KEYS) {
			const levelMap = entry[key]
			if (levelMap === undefined) continue
			if (!isRecord(levelMap)) continue // unexpected variant of the key itself — skip cleanly, don't invent handling.

			for (const [levelKey, value] of Object.entries(levelMap)) {
				let grantedAtLevel: number | null
				if (levelKey === '_') {
					grantedAtLevel = null // always granted — featSpells.ts reads the same key the same way.
				} else {
					const parsed = Number(levelKey)
					if (!Number.isFinite(parsed)) continue // neither a character-level key nor "_" — skip cleanly (D43), not "unparseable means always".
					if (parsed > characterLevel) continue
					grantedAtLevel = parsed
				}

				// A `choose` filter node grants no concrete spell (the 5 deferred entries). One visible note each, no picker, no storage.
				for (const node of findChooseNodes(value)) notes.push({ speciesName: species.name, text: deferredChoiceNote(species.name, node) })

				for (const { ref, usage } of extractRefsWithUsage(value, undefined, null, proficiencyBonus)) {
					const spell = findSpell(spells, parseSpellRef(ref))
					if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).

					granted.push({
						name: spell.name,
						source: spell.source,
						level: spell.level,
						ritual: spell.meta?.ritual === true,
						concentration: hasConcentration(spell.duration),
						origin: 'species',
						speciesName: species.name,
						grantedAtLevel,
						...(ability ? { ability } : { unresolvedAbilityReason: UNRESOLVED_ABILITY_REASON }),
						usage,
					})
				}
			}
		}
	}

	// One line per distinct gap: a species listing the same choose node under two grant keys must not say it twice.
	const uniqueNotes = [...new Map(notes.map((note) => [note.text, note])).values()]
	return { spells: dedupeWithinSpecies(granted), notes: uniqueNotes }
}

/** Fetches species.json and spells.json through the shared cache (D39) and returns the character's species-granted spells. */
export async function loadRaceSpells(character: Character): Promise<RaceSpellGrants> {
	if (!character.species) return { spells: [], notes: [] }
	const [parsedSpecies, parsedSpells] = await Promise.all([loadDataFile('data/species.json'), loadDataFile('data/spells.json')])
	return raceSpellsFor(character, parsedSpecies, parsedSpells)
}
