/*
 * Typed loader for subclass optionalfeatureProgression choices — the shape
 * shared by all four in-scope subclasses that grow a list of picks with
 * level: Battle Master (Maneuvers), Rune Knight (Runes), Arcane Archer
 * (Arcane Shot), College of Swords (Fighting Style). Confirmed by
 * scripts/investigate-subclass-choices.js and
 * scripts/investigate-optional-feature-progression.js — one
 * optionalfeatureProgression entry per subclass, one featureType code each.
 *
 * Per D12, an `FS:*` featureType code resolves against feats.json filtered
 * by category "FS" — the `:B` suffix on College of Swords' FS:B does not
 * narrow that set; see docs/QUESTIONS.md, "College of Swords — FS:B nabízí
 * všech 10 stylů". Every other code (MV:B, AS, RN, ...) resolves against
 * optional-features.json filtered by an exact featureType match.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawProgression {
	name?: unknown
	featureType?: unknown
	progression?: unknown
}

interface RawSubclass {
	entryType: string
	name: string
	source: string
	className: string
	classSource: string
	optionalfeatureProgression?: RawProgression[]
}

function isRawSubclass(value: unknown): value is RawSubclass {
	if (!isRecord(value)) return false
	return (
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

function findSubclass(
	parsedClasses: unknown,
	className: string,
	classSource: string,
	subclassName: string,
	subclassSource: string,
): RawSubclass | undefined {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	return parsedClasses.find(
		(candidate) =>
			isRawSubclass(candidate) &&
			candidate.className === className &&
			candidate.classSource === classSource &&
			candidate.name === subclassName &&
			candidate.source === subclassSource,
	) as RawSubclass | undefined
}

/**
 * The number of picks a subclass's optionalfeatureProgression grants at
 * `level` — the highest progression level at or below `level`, or 0 before
 * the first one. Returns null when the subclass has no
 * optionalfeatureProgression at all.
 */
function countAtLevel(progression: Record<string, unknown>, level: number): number {
	const levels = Object.keys(progression)
		.map(Number)
		.filter((lvl) => lvl <= level)
		.sort((a, b) => a - b)
	if (levels.length === 0) return 0
	const highest = levels[levels.length - 1]
	const raw = progression[String(highest)]
	return typeof raw === 'number' ? raw : 0
}

/**
 * One alternative in an option's `prerequisite` array. The 7 shapes found in
 * the data are combinations of these 5 keys (scripts/investigate-class-feature-choices.js,
 * item 4) — no other key occurs.
 */
export interface OptionalFeaturePrerequisiteEntry {
	/** A CLASS level, not a character level — unlike feats.json, where `level` is a bare number. */
	level?: { level?: unknown; class?: { name?: unknown; source?: unknown }; subclass?: { name?: unknown; source?: unknown } }
	/** Either a spell ref string ("eldritch blast#c", "hex/curse#x") or a `choose` object naming a filter. */
	spell?: unknown[]
	/** "Blade" | "Chain" | "Tome" | "Talisman" — the pact boon, which XPHB models as an invocation of the same list. */
	pact?: unknown
	/** "name|source" refs into the SAME resolved option list. */
	optionalfeature?: unknown[]
	feature?: unknown[]
}

export interface OptionalFeatureOption {
	name: string
	source: string
	entries: unknown[]
	prerequisite?: OptionalFeaturePrerequisiteEntry[]
}

export interface OptionalFeatureChoice {
	featureType: string
	count: number
	options: OptionalFeatureOption[]
}

function readPrerequisite(entry: unknown): OptionalFeaturePrerequisiteEntry[] | undefined {
	if (!isRecord(entry)) return undefined
	const raw = entry['prerequisite']
	if (!Array.isArray(raw)) return undefined
	return raw.filter(isRecord) as OptionalFeaturePrerequisiteEntry[]
}

interface RawOptionalFeature {
	name?: unknown
	source?: unknown
	featureType?: unknown
	entries?: unknown
}

function isRawOptionalFeature(value: unknown): value is RawOptionalFeature & { name: string; source: string; entries: unknown[] } {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && Array.isArray(value['entries'])
}

/** Every optional-features.json entry whose featureType array includes `code` exactly. */
function optionalFeaturesByType(parsedOptionalFeatures: unknown, code: string): OptionalFeatureOption[] {
	if (!Array.isArray(parsedOptionalFeatures)) {
		throw new Error('optional-features.json: expected a top-level array.')
	}
	return parsedOptionalFeatures
		.filter(isRawOptionalFeature)
		.filter((entry) => Array.isArray(entry.featureType) && entry.featureType.includes(code))
		.map((entry) => ({ name: entry.name, source: entry.source, entries: entry.entries, prerequisite: readPrerequisite(entry) }))
}

interface RawFeat {
	name?: unknown
	source?: unknown
	category?: unknown
	entries?: unknown
}

function isRawFeat(value: unknown): value is RawFeat & { name: string; source: string; entries: unknown[] } {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && Array.isArray(value['entries'])
}

/** Every feats.json entry with category "FS" — per D12, this is what every `FS:*` code resolves to, suffix ignored. */
function fightingStyleFeats(parsedFeats: unknown): OptionalFeatureOption[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsedFeats
		.filter(isRawFeat)
		.filter((entry) => entry.category === 'FS')
		.map((entry) => ({ name: entry.name, source: entry.source, entries: entry.entries, prerequisite: readPrerequisite(entry) }))
}

/**
 * The subclass's optionalfeatureProgression choice at `level`: how many
 * picks the character has and what they can pick from. Returns null when
 * the subclass has no optionalfeatureProgression, or when `level` is below
 * its first progression entry (count would be 0).
 */
export function optionalFeatureChoicesFor(
	parsedClasses: unknown,
	parsedOptionalFeatures: unknown,
	parsedFeats: unknown,
	className: string,
	classSource: string,
	subclassName: string,
	subclassSource: string,
	level: number,
): OptionalFeatureChoice | null {
	const subclass = findSubclass(parsedClasses, className, classSource, subclassName, subclassSource)
	const progression = subclass?.optionalfeatureProgression?.[0]
	if (!progression) return null

	const featureTypes = Array.isArray(progression.featureType) ? progression.featureType : []
	const code = featureTypes.find((ft): ft is string => typeof ft === 'string')
	if (!code) return null

	const rawProgression = isRecord(progression.progression) ? progression.progression : {}
	const count = countAtLevel(rawProgression, level)
	if (count === 0) return null

	return { featureType: code, count, options: optionsForFeatureType(parsedOptionalFeatures, parsedFeats, code) }
}

// ---------------------------------------------------------------------------
// CLASS-level optionalfeatureProgression (build order step 6a, slice 1)
// ---------------------------------------------------------------------------

interface RawClass {
	entryType: string
	name: string
	source: string
	optionalfeatureProgression?: RawProgression[]
}

function isRawClass(value: unknown): value is RawClass {
	if (!isRecord(value)) return false
	return value['entryType'] === 'class' && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

export interface ClassOptionalFeatureGrant {
	featureType: string
	/** How many options of this featureType the character is entitled to at the given class level. 0 before the first grant. */
	count: number
	/** The progression's own display name — "Metamagic", "Eldritch Invocations" (scripts/investigate-damage-cantrip-prereq.js, item 3). Null when the data omits it; never a hand-written code→label map. */
	name: string | null
}

/**
 * The `progression` field's shape differs between the only two classes that
 * carry one — Sorcerer keys a sparse object by class level, Warlock uses a
 * dense array 0-indexed by (level-1); a reader written for one silently
 * returns wrong numbers for the other, so the branch is structural and never
 * by class name (docs/STATUS.md, scripts/investigate-class-feature-choices.js).
 */
function countFromProgression(progression: unknown, level: number): number {
	if (level < 1) return 0
	if (Array.isArray(progression)) {
		if (progression.length === 0) return 0
		const raw = level > progression.length ? progression[progression.length - 1] : progression[level - 1]
		return typeof raw === 'number' ? raw : 0
	}
	if (isRecord(progression)) return countAtLevel(progression, level)
	return 0
}

/**
 * Every featureType a CLASS's own optionalfeatureProgression grants at
 * `level`, with the count for each. An entry is returned even when the count
 * is still 0 (Sorcerer at level 1), so a caller can tell "this class grants
 * Metamagic, just not yet" from "this class grants nothing at all" (empty
 * array).
 */
export function classOptionalFeatureGrantsFor(
	parsedClasses: unknown,
	className: string,
	classSource: string,
	level: number,
): ClassOptionalFeatureGrant[] {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	const found = parsedClasses.find(
		(candidate) => isRawClass(candidate) && candidate.name === className && candidate.source === classSource,
	) as RawClass | undefined
	if (!found?.optionalfeatureProgression) return []

	const grants: ClassOptionalFeatureGrant[] = []
	for (const progression of found.optionalfeatureProgression) {
		const featureTypes = Array.isArray(progression.featureType) ? progression.featureType : []
		const name = typeof progression.name === 'string' ? progression.name : null
		for (const code of featureTypes) {
			if (typeof code !== 'string') continue
			grants.push({ featureType: code, count: countFromProgression(progression.progression, level), name })
		}
	}
	return grants
}

/** The options a featureType code resolves to — the same D12-aware resolution the subclass picker already uses. */
export function optionsForFeatureType(parsedOptionalFeatures: unknown, parsedFeats: unknown, code: string): OptionalFeatureOption[] {
	return code.startsWith('FS:') ? fightingStyleFeats(parsedFeats) : optionalFeaturesByType(parsedOptionalFeatures, code)
}

// ---------------------------------------------------------------------------
// Prerequisite evaluation (build order step 6a, slice 1)
// ---------------------------------------------------------------------------

export interface OptionRef {
	name: string
	source: string
}

/**
 * Everything a prerequisite might need, resolved by the caller (D38: this
 * module takes data in, it never fetches and never reads character storage).
 */
export interface OptionalFeaturePrerequisiteContext {
	/** One entry per class the character has (D11), with the subclass chosen for it if any. */
	classLevels: { className: string; level: number; subclassName?: string | null }[]
	/** Every spell the character knows/has prepared, by name — source-insensitive, the way the prerequisite refs are written. */
	knownSpellNames: string[]
	/** Options ALREADY CHOSEN from this same list. 6 options depend on a sibling of the same list. */
	chosenOptions: OptionRef[]
	/** Every option the list offers — lets an unmet `pact` say whether the boon is merely unchosen or absent from the data entirely. */
	availableOptions: OptionRef[]
	hasFightingStyleFeature: boolean
	/**
	 * Cantrips the character knows FROM A GIVEN CLASS's own picks whose
	 * spells.json `damageInflict` is non-empty (D21: "deals damage" is read
	 * structurally, never from a list of spell names), keyed by class name.
	 * This is what answers Agonizing Blast's `choose: "level=0|class=Warlock"`.
	 * Omit the key — or the whole field — when the caller cannot answer; the
	 * `choose` prerequisite then falls back to reporting unmet with its own text.
	 */
	damagingCantripsByClass?: Record<string, string[]>
	/**
	 * The same idea as damagingCantripsByClass, narrowed further to cantrips
	 * that deal that damage via an attack roll (spellDetailData.ts's
	 * `damagingAttackCantripsAmong`). Answers Repelling Blast's
	 * `choose: "level=0|class=Warlock|spell attack=m;r;o"` — the one filter in
	 * the data that adds a `spell attack` clause. Omit the key/field the same
	 * way as damagingCantripsByClass when the caller cannot answer.
	 */
	damagingAttackCantripsByClass?: Record<string, string[]>
}

export interface OptionalFeaturePrerequisiteResult {
	eligible: boolean
	/** One line per unmet alternative — empty when eligible. Always shown, never a silent hide (D19). */
	reasons: string[]
}

function normalizeName(value: string): string {
	return value.trim().toLowerCase()
}

/** "pact of the blade|xphb" -> "pact of the blade"; "eldritch blast#c" -> "eldritch blast". */
function refName(ref: string): string {
	return normalizeName(ref.split('|')[0].split('#')[0])
}

function hasChosen(ctx: OptionalFeaturePrerequisiteContext, name: string): boolean {
	return ctx.chosenOptions.some((o) => normalizeName(o.name) === name)
}

function optionExists(ctx: OptionalFeaturePrerequisiteContext, name: string): boolean {
	return ctx.availableOptions.some((o) => normalizeName(o.name) === name)
}

function levelFailure(entry: OptionalFeaturePrerequisiteEntry, ctx: OptionalFeaturePrerequisiteContext): string | null {
	const req = entry.level
	if (!isRecord(req)) return null
	const required = typeof req['level'] === 'number' ? (req['level'] as number) : null
	if (required === null) return null

	const classClause = isRecord(req['class']) ? req['class'] : null
	const className = classClause && typeof classClause['name'] === 'string' ? (classClause['name'] as string) : null
	const subclassClause = isRecord(req['subclass']) ? req['subclass'] : null
	const subclassName = subclassClause && typeof subclassClause['name'] === 'string' ? (subclassClause['name'] as string) : null

	const label = subclassName ? `${subclassName} ${className ?? ''}`.trim() : (className ?? 'character')
	const held = className
		? ctx.classLevels.find((c) => normalizeName(c.className) === normalizeName(className))
		: ctx.classLevels.reduce<OptionalFeaturePrerequisiteContext['classLevels'][number] | undefined>(
				(acc, c) => (acc === undefined || c.level > acc.level ? c : acc),
				undefined,
			)

	if (!held || held.level < required) return `${label} level ${required}`
	if (subclassName && normalizeName(held.subclassName ?? '') !== normalizeName(subclassName)) return `the ${subclassName} subclass`
	return null
}

/**
 * The `choose` form of a `spell` prerequisite. Only 3 options carry one
 * (scripts/investigate-damage-cantrip-prereq.js): Agonizing Blast and
 * Eldritch Spear share `"level=0|class=Warlock"`; Repelling Blast adds a
 * third clause, `"spell attack=m;r;o"` (scripts/investigate-spell-attack-values.js
 * confirms this verbatim, and that its own `entry` text reads "a Warlock
 * Cantrip That Deals Damage via an Attack Roll"). The filter names the
 * level and class; the "deals damage [via an attack roll]" half lives only
 * in the prose, so the context supplies a list already narrowed to
 * damaging cantrips (damagingCantripsByClass), or — when a `spell attack`
 * clause is present — narrowed further to damaging cantrips with an attack
 * roll (damagingAttackCantripsByClass). The clause's own value (which of
 * m/r/o) is not parsed further: the only instance in the data requests all
 * three, and this app's data never carries a fourth spellAttack value.
 *
 * Returns true (satisfied), false (answerable and unmet), or null — the
 * filter asks something no supplied input can answer, which stays slice 1's
 * "unmet, with the prerequisite's own text".
 */
function chooseFilterSatisfied(req: Record<string, unknown>, ctx: OptionalFeaturePrerequisiteContext): boolean | null {
	const filter = req['choose']
	if (typeof filter !== 'string') return null

	let level: string | null = null
	let className: string | null = null
	let requiresAttackRoll = false
	for (const part of filter.split('|')) {
		const separator = part.indexOf('=')
		if (separator === -1) return null
		const key = part.slice(0, separator).trim()
		const value = part.slice(separator + 1).trim()
		if (key === 'level') level = value
		else if (key === 'class') className = value
		else if (key === 'spell attack') requiresAttackRoll = true
		// Any further clause narrows the set in a way nothing supplied can test.
		else return null
	}
	if (level !== '0' || className === null) return null

	const byClass = (requiresAttackRoll ? ctx.damagingAttackCantripsByClass : ctx.damagingCantripsByClass) ?? {}
	const key = Object.keys(byClass).find((candidate) => normalizeName(candidate) === normalizeName(className))
	if (key === undefined) return null
	return byClass[key].length > 0
}

function spellFailures(entry: OptionalFeaturePrerequisiteEntry, ctx: OptionalFeaturePrerequisiteContext): string[] {
	if (!Array.isArray(entry.spell)) return []
	const known = ctx.knownSpellNames.map(normalizeName)
	const failures: string[] = []
	for (const req of entry.spell) {
		if (typeof req === 'string') {
			// "hex/curse#x" is a set of alternatives; the "#" tag is a 5etools display hint, not part of the name.
			const alternatives = req.split('#')[0].split('/').map(normalizeName)
			if (!alternatives.some((name) => known.includes(name))) failures.push(`the ${alternatives.join(' or ')} spell`)
			continue
		}
		if (isRecord(req)) {
			const verdict = chooseFilterSatisfied(req, ctx)
			if (verdict === true) continue
			const text = typeof req['entrySummary'] === 'string' ? req['entrySummary'] : typeof req['entry'] === 'string' ? req['entry'] : 'an unnamed spell'
			// verdict === null: the caller didn't supply the field this filter needs (e.g.
			// damagingAttackCantripsByClass omitted) — unmet with the prerequisite's own text.
			failures.push(verdict === null ? `${text} (this app cannot check that automatically)` : `${text} — none of your known cantrips qualifies`)
		}
	}
	return failures
}

function pactFailure(entry: OptionalFeaturePrerequisiteEntry, ctx: OptionalFeaturePrerequisiteContext): string | null {
	if (typeof entry.pact !== 'string') return null
	// XPHB models the pact boon as an invocation of this same list ("Pact of the Blade"),
	// so a `pact` prerequisite is satisfied by that sibling choice. "Talisman" has no such
	// option in this data, so those invocations can never qualify — said out loud, not hidden.
	const boonName = normalizeName(`Pact of the ${entry.pact}`)
	if (hasChosen(ctx, boonName)) return null
	const label = `Pact of the ${entry.pact}`
	return optionExists(ctx, boonName) ? `the ${label} invocation` : `the ${label} invocation, which this app's data does not offer`
}

function optionalFeatureFailures(entry: OptionalFeaturePrerequisiteEntry, ctx: OptionalFeaturePrerequisiteContext): string[] {
	if (!Array.isArray(entry.optionalfeature)) return []
	const failures: string[] = []
	for (const ref of entry.optionalfeature) {
		if (typeof ref !== 'string') continue
		if (!hasChosen(ctx, refName(ref))) failures.push(`the ${ref.split('|')[0]} option`)
	}
	return failures
}

/** Evaluates one alternative (every present key AND'd). Returns the unmet reason, or null when fully satisfied. */
function evaluateEntry(entry: OptionalFeaturePrerequisiteEntry, ctx: OptionalFeaturePrerequisiteContext): string | null {
	const failures: string[] = []

	const level = levelFailure(entry, ctx)
	if (level) failures.push(level)
	failures.push(...spellFailures(entry, ctx))
	const pact = pactFailure(entry, ctx)
	if (pact) failures.push(pact)
	failures.push(...optionalFeatureFailures(entry, ctx))
	// "Fighting Style" is the only `feature` value in the data — same single value featAsiData.ts already handles.
	if (Array.isArray(entry.feature) && entry.feature.includes('Fighting Style') && !ctx.hasFightingStyleFeature) {
		failures.push('the Fighting Style feature')
	}

	return failures.length > 0 ? `Requires ${failures.join(', ')}.` : null
}

/**
 * D19: an ineligible option is never hidden — it comes back with a reason per
 * unmet alternative. `prerequisite` is an array of ALTERNATIVES (OR); the keys
 * inside one alternative are AND'd, the same rule feats.json follows.
 */
export function evaluateOptionalFeaturePrerequisites(
	option: OptionalFeatureOption,
	ctx: OptionalFeaturePrerequisiteContext,
): OptionalFeaturePrerequisiteResult {
	if (!option.prerequisite || option.prerequisite.length === 0) return { eligible: true, reasons: [] }

	const reasons = option.prerequisite.map((entry) => evaluateEntry(entry, ctx)).filter((r): r is string => r !== null)
	const eligible = reasons.length < option.prerequisite.length
	return { eligible, reasons: eligible ? [] : reasons }
}

export interface EvaluatedOptionalFeatureOption {
	option: OptionalFeatureOption
	eligible: boolean
	reasons: string[]
}

/** Every option, in list order, each with its own verdict — nothing filtered out (D19). */
export function evaluateOptionalFeatureOptions(
	options: OptionalFeatureOption[],
	ctx: OptionalFeaturePrerequisiteContext,
): EvaluatedOptionalFeatureOption[] {
	return options.map((option) => ({ option, ...evaluateOptionalFeaturePrerequisites(option, ctx) }))
}

// ---------------------------------------------------------------------------
// CLASS-level groups: composition, live evaluation, sheet lookup (slice 2)
// ---------------------------------------------------------------------------

/** One granted featureType with everything the picker needs: how many picks, what to call the group, and what to pick from. */
export interface ClassOptionalFeatureGroup extends ClassOptionalFeatureGrant {
	options: OptionalFeatureOption[]
}

/** Composes classOptionalFeatureGrantsFor with optionsForFeatureType — neither is recomputed here. Grants of count 0 are dropped: nothing to pick yet. */
export function classOptionalFeatureGroupsFor(
	parsedClasses: unknown,
	parsedOptionalFeatures: unknown,
	parsedFeats: unknown,
	className: string,
	classSource: string,
	level: number,
): ClassOptionalFeatureGroup[] {
	return classOptionalFeatureGrantsFor(parsedClasses, className, classSource, level)
		.filter((grant) => grant.count > 0)
		.map((grant) => ({ ...grant, options: optionsForFeatureType(parsedOptionalFeatures, parsedFeats, grant.featureType) }))
}

/** One featureType's picks, the shape Character.optionalFeatureChoices stores — no schema change was needed for class-level picks. */
export interface OptionalFeatureSelection {
	featureType: string
	choices: string[]
}

/** Everything about a prerequisite EXCEPT the two fields that depend on which group is being evaluated. */
export type ClassOptionalFeatureContextBase = Omit<OptionalFeaturePrerequisiteContext, 'chosenOptions' | 'availableOptions'>

export interface EvaluatedClassOptionalFeatureGroup extends ClassOptionalFeatureGroup {
	chosen: string[]
	/** count - chosen.length; never negative in practice, since the picker refuses a pick past the count. */
	remaining: number
	evaluated: EvaluatedOptionalFeatureOption[]
	/**
	 * Picks that no longer qualify. An option that stops qualifying is NOT
	 * dropped — deleting a player's choice silently is the behaviour to avoid —
	 * so it stays selected, carries its unmet reasons, and blocks the step.
	 */
	invalidChosen: { name: string; reasons: string[] }[]
}

/**
 * Re-evaluates every group against the CURRENT selection, so a prerequisite
 * that a sibling pick satisfies (Pact of the Blade → Eldritch Smite) flips in
 * the same session. `chosenOptions`/`availableOptions` are scoped per group:
 * no prerequisite in the data crosses from one featureType to another.
 */
export function evaluateClassOptionalFeatureGroups(
	groups: ClassOptionalFeatureGroup[],
	selection: OptionalFeatureSelection[],
	base: ClassOptionalFeatureContextBase,
): EvaluatedClassOptionalFeatureGroup[] {
	return groups.map((group) => {
		const chosen = selection.find((entry) => entry.featureType === group.featureType)?.choices ?? []
		const ctx: OptionalFeaturePrerequisiteContext = {
			...base,
			chosenOptions: group.options.filter((option) => chosen.includes(option.name)).map(({ name, source }) => ({ name, source })),
			availableOptions: group.options.map(({ name, source }) => ({ name, source })),
		}
		const evaluated = evaluateOptionalFeatureOptions(group.options, ctx)
		const invalidChosen = evaluated
			.filter((entry) => !entry.eligible && chosen.includes(entry.option.name))
			.map((entry) => ({ name: entry.option.name, reasons: entry.reasons }))
		return { ...group, chosen, remaining: group.count - chosen.length, evaluated, invalidChosen }
	})
}

/** Every granted count filled and no pick left in the warning state — the class step's gate. */
export function areClassOptionalFeaturesComplete(groups: EvaluatedClassOptionalFeatureGroup[]): boolean {
	return groups.every((group) => group.remaining === 0 && group.invalidChosen.length === 0)
}

/** One class-level group as the SHEET needs it: the heading, and the full entry of each option the player actually took. */
export interface ChosenClassOptionalFeatureGroup {
	featureType: string
	name: string | null
	options: OptionalFeatureOption[]
}

/**
 * The class-level picks of `selection`, resolved back to their full option
 * entries. Storage tags a pick with its featureType only, so a class-level
 * pick is told from a subclass-level one by whether the CLASS's own
 * progression grants that featureType — no second stored field.
 */
export function chosenClassOptionalFeatures(
	parsedClasses: unknown,
	parsedOptionalFeatures: unknown,
	parsedFeats: unknown,
	classes: { className: string; classSource: string; level: number }[],
	selection: OptionalFeatureSelection[],
): ChosenClassOptionalFeatureGroup[] {
	const groups: ChosenClassOptionalFeatureGroup[] = []
	for (const characterClass of classes) {
		for (const grant of classOptionalFeatureGrantsFor(parsedClasses, characterClass.className, characterClass.classSource, characterClass.level)) {
			const chosen = selection.find((entry) => entry.featureType === grant.featureType)?.choices ?? []
			if (chosen.length === 0) continue
			const all = optionsForFeatureType(parsedOptionalFeatures, parsedFeats, grant.featureType)
			const options = chosen
				.map((name) => all.find((option) => normalizeName(option.name) === normalizeName(name)))
				.filter((option): option is OptionalFeatureOption => option !== undefined)
			if (options.length > 0) groups.push({ featureType: grant.featureType, name: grant.name, options })
		}
	}
	return groups
}

/** Fetches classes.json, optional-features.json and feats.json and returns classOptionalFeatureGroupsFor's result. */
export async function loadClassOptionalFeatureGroups(className: string, classSource: string, level: number): Promise<ClassOptionalFeatureGroup[]> {
	const [classes, optionalFeatures, feats] = await Promise.all([
		loadDataFile('data/classes.json'),
		loadDataFile('data/optional-features.json'),
		loadDataFile('data/feats.json'),
	])
	return classOptionalFeatureGroupsFor(classes, optionalFeatures, feats, className, classSource, level)
}

/** Fetches the same three files and returns chosenClassOptionalFeatures' result — the sheet's entry point. */
export async function loadChosenClassOptionalFeatures(
	classes: { className: string; classSource: string; level: number }[],
	selection: OptionalFeatureSelection[],
): Promise<ChosenClassOptionalFeatureGroup[]> {
	if (classes.length === 0 || selection.length === 0) return []
	const [parsedClasses, optionalFeatures, feats] = await Promise.all([
		loadDataFile('data/classes.json'),
		loadDataFile('data/optional-features.json'),
		loadDataFile('data/feats.json'),
	])
	return chosenClassOptionalFeatures(parsedClasses, optionalFeatures, feats, classes, selection)
}

/** Fetches classes.json, optional-features.json and feats.json and returns optionalFeatureChoicesFor's result. */
export async function loadOptionalFeatureChoicesFor(
	className: string,
	classSource: string,
	subclassName: string,
	subclassSource: string,
	level: number,
): Promise<OptionalFeatureChoice | null> {
	const [classes, optionalFeatures, feats] = await Promise.all([
		loadDataFile('data/classes.json'),
		loadDataFile('data/optional-features.json'),
		loadDataFile('data/feats.json'),
	])
	return optionalFeatureChoicesFor(classes, optionalFeatures, feats, className, classSource, subclassName, subclassSource, level)
}
