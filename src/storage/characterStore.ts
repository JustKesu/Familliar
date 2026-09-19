import type { Ability, CharacterAbilityScores } from '../abilities/abilityScores'
import type {
	AbilityBonusMap,
	Character,
	CharacterBackground,
	CharacterClass,
	CharacterClassFeatureChoice,
	CharacterDeathSaves,
	CharacterFamiliar,
	CharacterHitPointLevel,
	CharacterInventoryItem,
	CharacterWildShapeForms,
	CharacterLanguage,
	CharacterExpertiseSkill,
	CharacterMastery,
	CharacterOptionalFeatureChoice,
	CharacterPlayState,
	CharacterSpecies,
	CharacterSpellChoice,
	CharacterSubclassSpellChoice,
	FeatAsiChoice,
	SpentSpellSlots,
} from './character'
import { CURRENT_SCHEMA_VERSION } from './character'
import { deathSavesAfterHitPointChange } from '../hitPoints/deathSaves'
import {
	CharacterNotFoundError,
	CorruptDataError,
	ImportValidationError,
	StorageFullError,
	StorageUnavailableError,
	UnknownSchemaVersionError,
} from './errors'
import { migrateToCurrent } from './migrations'
import { describeStoredCharacterError, isSupportedVersion, toStoredCharacter } from './validate'
import type { StoredCharacter } from './wireFormat'

/*
 * The storage layer. Nothing else in the app touches localStorage
 * directly (CLAUDE.md task instructions) — every read and write goes
 * through a CharacterStore instance.
 *
 * Storage access is behind this small interface so tests can inject an
 * in-memory fake instead of a real browser localStorage.
 */
export interface KeyValueStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

const STORAGE_KEY = 'familliar:characters'

function getBrowserStorage(): KeyValueStorage {
	try {
		const probeKey = '__familliar_storage_probe__'
		globalThis.localStorage.setItem(probeKey, '1')
		globalThis.localStorage.removeItem(probeKey)
		return globalThis.localStorage
	} catch {
		throw new StorageUnavailableError()
	}
}

function isQuotaExceeded(error: unknown): boolean {
	return (
		error instanceof DOMException &&
		(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
	)
}

/**
 * Parses and validates a raw JSON string into the array of stored records
 * it should contain. Throws `UnknownSchemaVersionError` directly (shared
 * between the two callers below); any other problem throws a plain `Error`
 * whose message the caller wraps in the error type appropriate to its
 * context (an app's own saved data vs. an imported file).
 */
function parseStoredCharacters(raw: string): StoredCharacter[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new Error('The data is not valid JSON.')
	}

	if (!Array.isArray(parsed)) {
		throw new Error('The data is not a list of characters.')
	}

	if (parsed.length === 0) {
		return []
	}

	for (let i = 0; i < parsed.length; i++) {
		const entry: unknown = parsed[i]
		const version = isRecordWithSchemaVersion(entry) ? entry.schemaVersion : undefined
		if (typeof version === 'number' && !isSupportedVersion(version)) {
			throw new UnknownSchemaVersionError(version)
		}
	}

	// D69: an older but supported save is carried forward here, so everything
	// below this line only ever sees the current shape.
	const records = parsed.map(migrateToCurrent)

	for (let i = 0; i < records.length; i++) {
		const error = describeStoredCharacterError(records[i], i)
		if (error) throw new Error(`Entry ${error} is malformed.`)
	}

	return (records as Record<string, unknown>[]).map(toStoredCharacter)
}

function isRecordWithSchemaVersion(value: unknown): value is { schemaVersion: unknown } {
	return typeof value === 'object' && value !== null && 'schemaVersion' in value
}

function toCharacter({ schemaVersion: _schemaVersion, ...character }: StoredCharacter): Character {
	return character
}

function toStoredCharacters(characters: Character[]): StoredCharacter[] {
	return characters.map((character) => ({ ...character, schemaVersion: CURRENT_SCHEMA_VERSION }))
}

function newId(): string {
	return crypto.randomUUID()
}

/**
 * Input to `CharacterStore.create`, one property per `Character` field it
 * populates (minus `id`, which `create` generates). Named fields instead of
 * positional arguments so callers and tests can match values up without
 * counting positions — see build order step 8, slice 8c0.
 */
export interface CharacterCreateInput {
	name: string
	classes?: CharacterClass[]
	abilityScores?: CharacterAbilityScores
	species?: CharacterSpecies
	background?: CharacterBackground
	abilityBonus?: AbilityBonusMap
	languages?: CharacterLanguage[]
	classSkills?: string[]
	masteries?: CharacterMastery[]
	fightingStyle?: string | null
	optionalFeatureChoices?: CharacterOptionalFeatureChoice[]
	speciesSkills?: string[]
	expertiseSkills?: CharacterExpertiseSkill[]
	featAsiChoices?: FeatAsiChoice[]
	spellChoices?: CharacterSpellChoice[]
	subclassSpellChoices?: CharacterSubclassSpellChoice[]
	classFeatureChoices?: CharacterClassFeatureChoice[]
	wildShapeForms?: CharacterWildShapeForms[]
	inventory?: CharacterInventoryItem[]
	currencyCopper?: number
	speciesSpellcastingAbility?: Ability
	hitPointLevels?: CharacterHitPointLevel[]
	/*
	 * Play-time state the wizard never collects: the hand-set current hit points
	 * and max override (D9) and the summoned familiar. `create` is never given
	 * them; `update` (slice 8d1) replaces every field from this input, so the
	 * edit path passes the character's own back in rather than losing them.
	 */
	currentHp?: number
	maxHpOverride?: number
	/** Slice 9b1: the three play fields arrive as one object, the shape they are stored in. */
	play?: CharacterPlayState
	familiar?: CharacterFamiliar
	createdAtLevel?: number
}

/**
 * The hit-point fields `setHitPoints` writes together (slice 9a1; death saves
 * joined them in 9a2). One object rather than positional arguments, for the
 * reason `create` took one in 8c0: damage and healing move several of them in a
 * single write, and a caller that forgets a position would silently clear a pile.
 */
export interface HitPointFields {
	currentHp?: number
	maxHpOverride?: number
	temporaryHitPoints?: number
	deathSaves?: CharacterDeathSaves
}

/**
 * Everything a rest moves, written in one go (slice 9b5). A rest changes four
 * things at once and a half-applied one is a character with its slots back and
 * its resources still spent, so this is one write rather than four: the reason
 * HitPointFields is one object, applied to a bigger set of fields.
 *
 * Every field is the value AFTER the rest, and an absent one means the field
 * becomes absent — nothing spent, or a current that was never set. A Short Rest
 * therefore passes the hit points and hit dice it does not touch back in
 * unchanged; `afterShortRest` (src/rest/rest.ts) is what assembles that.
 *
 * Temporary hit points and death saves are deliberately absent: they are not a
 * rest's business (D110), and riding through `play` untouched is what says so.
 */
export interface RestFields {
	currentHp?: number
	resourceUses?: Record<string, number>
	spentSpellSlots?: SpentSpellSlots
	spentHitDice?: Record<string, number>
}

/**
 * The one place `play` is normalised (slice 9b1), so `create`, `update` and
 * `setHitPoints` cannot disagree on what an empty play state is. Each field's own
 * "none is absence" rule is applied here — temporary 0 (D110), death saves that
 * do not go with this current (D111), a spent count of 0 — and a play object left
 * with nothing in it is itself dropped.
 */
function storedPlayState(currentHp: number | undefined, play: CharacterPlayState | undefined): CharacterPlayState | undefined {
	const temporaryHitPoints = play?.temporaryHitPoints
	const deathSaves = deathSavesAfterHitPointChange(currentHp, play?.deathSaves)
	const resourceUses = Object.fromEntries(Object.entries(play?.resourceUses ?? {}).filter(([, spent]) => spent > 0))
	const spentSpellSlots = storedSpentSpellSlots(play?.spentSpellSlots)
	const spentHitDice = Object.fromEntries(Object.entries(play?.spentHitDice ?? {}).filter(([, spent]) => spent > 0))
	const stored: CharacterPlayState = {
		...(temporaryHitPoints !== undefined && temporaryHitPoints > 0 ? { temporaryHitPoints } : {}),
		...(deathSaves ? { deathSaves } : {}),
		...(Object.keys(resourceUses).length > 0 ? { resourceUses } : {}),
		...(spentSpellSlots ? { spentSpellSlots } : {}),
		...(Object.keys(spentHitDice).length > 0 ? { spentHitDice } : {}),
		...(play?.concentratingOn ? { concentratingOn: play.concentratingOn } : {}),
	}
	return Object.keys(stored).length > 0 ? stored : undefined
}

/** Slice 9b3, under storedPlayState's own rule: a spent count of 0 is stored as absence, in each of D11's two pools separately, and an empty pair is no field at all. */
function storedSpentSpellSlots(spent: SpentSpellSlots | undefined): SpentSpellSlots | undefined {
	if (spent === undefined) return undefined
	const ordinary: Record<number, number> = {}
	for (const [level, count] of Object.entries(spent.ordinary ?? {})) {
		if (count > 0) ordinary[Number(level)] = count
	}
	const stored: SpentSpellSlots = {
		...(Object.keys(ordinary).length > 0 ? { ordinary } : {}),
		...(spent.pact !== undefined && spent.pact > 0 ? { pact: spent.pact } : {}),
	}
	return Object.keys(stored).length > 0 ? stored : undefined
}

/** The one place a Character is assembled from an input — shared by `create` and `update` so the two can never diverge on which fields an absent value omits. */
function buildCharacter(id: string, input: CharacterCreateInput): Character {
	const {
		classes = [],
		abilityScores,
		species,
		background,
		abilityBonus,
		languages,
		classSkills,
		masteries,
		fightingStyle,
		optionalFeatureChoices,
		speciesSkills,
		expertiseSkills,
		featAsiChoices,
		spellChoices,
		subclassSpellChoices,
		classFeatureChoices,
		wildShapeForms,
		inventory,
		currencyCopper,
		speciesSpellcastingAbility,
		hitPointLevels,
		currentHp,
		maxHpOverride,
		play,
		familiar,
		createdAtLevel,
	} = input

	const storedCurrentHp = currentHp === undefined ? undefined : Math.max(0, currentHp)
	const storedPlay = storedPlayState(storedCurrentHp, play)

	return {
		id,
		name: input.name.trim(),
		classes,
		...(abilityScores ? { abilityScores } : {}),
		...(species ? { species } : {}),
		...(background ? { background } : {}),
		...(abilityBonus ? { abilityBonus } : {}),
		...(languages ? { languages } : {}),
		...(classSkills && classSkills.length > 0 ? { classSkills } : {}),
		...(masteries && masteries.length > 0 ? { masteries } : {}),
		...(fightingStyle ? { fightingStyle } : {}),
		...(optionalFeatureChoices && optionalFeatureChoices.length > 0 ? { optionalFeatureChoices } : {}),
		...(speciesSkills && speciesSkills.length > 0 ? { speciesSkills } : {}),
		...(expertiseSkills && expertiseSkills.length > 0 ? { expertiseSkills } : {}),
		...(featAsiChoices && featAsiChoices.length > 0 ? { featAsiChoices } : {}),
		...(spellChoices && spellChoices.length > 0 ? { spellChoices } : {}),
		...(subclassSpellChoices && subclassSpellChoices.length > 0 ? { subclassSpellChoices } : {}),
		...(classFeatureChoices && classFeatureChoices.length > 0 ? { classFeatureChoices } : {}),
		...(wildShapeForms && wildShapeForms.length > 0 ? { wildShapeForms } : {}),
		...(inventory && inventory.length > 0 ? { inventory } : {}),
		...(currencyCopper ? { currencyCopper } : {}),
		...(speciesSpellcastingAbility ? { speciesSpellcastingAbility } : {}),
		...(hitPointLevels && hitPointLevels.length > 0 ? { hitPointLevels } : {}),
		// D110: negative hit points mean nothing under the 2024 rules, so the store never holds any, whichever path wrote them.
		...(storedCurrentHp !== undefined ? { currentHp: storedCurrentHp } : {}),
		...(maxHpOverride !== undefined ? { maxHpOverride } : {}),
		// D110/D111: temporary 0 is none, and death-save progress only survives a write that leaves the character at exactly 0.
		...(storedPlay ? { play: storedPlay } : {}),
		...(familiar ? { familiar } : {}),
		...(createdAtLevel !== undefined ? { createdAtLevel } : {}),
	}
}

export class CharacterStore {
	private readonly storage: KeyValueStorage

	constructor(storage?: KeyValueStorage) {
		this.storage = storage ?? getBrowserStorage()
	}

	/** All saved characters. Empty array if nothing has been saved yet. */
	list(): Character[] {
		let raw: string | null
		try {
			raw = this.storage.getItem(STORAGE_KEY)
		} catch {
			throw new StorageUnavailableError()
		}

		if (raw === null) return []

		try {
			return parseStoredCharacters(raw).map(toCharacter)
		} catch (error) {
			if (error instanceof UnknownSchemaVersionError) throw error
			const message = error instanceof Error ? error.message : String(error)
			throw new CorruptDataError(`Saved character data is corrupted: ${message}`)
		}
	}

	private writeAll(characters: Character[]): void {
		const payload = JSON.stringify(toStoredCharacters(characters))
		try {
			this.storage.setItem(STORAGE_KEY, payload)
		} catch (error) {
			if (isQuotaExceeded(error)) throw new StorageFullError()
			throw new StorageUnavailableError()
		}
	}

	create(input: CharacterCreateInput): Character {
		if (!input.name.trim()) throw new ImportValidationError('A character needs a name.')

		const character = buildCharacter(newId(), input)
		this.writeAll([...this.list(), character])
		return character
	}

	/**
	 * Replaces the character with this id by what `input` describes (build order
	 * step 8, slice 8d1 — the wizard run over an existing character). Its id and
	 * schema version survive; every other field comes from `input`, so a value
	 * the caller leaves out is genuinely removed rather than quietly kept. The
	 * narrow setters above stay the way to change a single field.
	 */
	update(id: string, input: CharacterCreateInput): Character {
		if (!input.name.trim()) throw new ImportValidationError('A character needs a name.')

		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const character = buildCharacter(id, input)
		const updated = [...characters]
		updated[index] = character
		this.writeAll(updated)
		return character
	}

	rename(id: string, name: string): void {
		const trimmed = name.trim()
		if (!trimmed) throw new ImportValidationError('A character needs a name.')

		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const updated = [...characters]
		updated[index] = { ...characters[index], name: trimmed }
		this.writeAll(updated)
	}

	/**
	 * Sets (or, with null, clears) the form the character's familiar has.
	 * A targeted write like `rename` rather than a general update: the sheet
	 * is otherwise read-only, and this is the one value it edits.
	 */
	setFamiliar(id: string, familiar: CharacterFamiliar | null): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { familiar: _previous, ...rest } = characters[index]
		const updated = [...characters]
		updated[index] = familiar ? { ...rest, familiar } : rest
		this.writeAll(updated)
	}

	/**
	 * Replaces the character's inventory (build order step 7, slice a1). A
	 * targeted write like `setFamiliar`: the sheet is otherwise read-only and
	 * the inventory section is the one place besides the familiar it edits. An
	 * empty array clears the field — owning nothing is stored as its absence,
	 * not as `inventory: []`.
	 */
	setInventory(id: string, inventory: CharacterInventoryItem[]): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { inventory: _previous, ...rest } = characters[index]
		const updated = [...characters]
		updated[index] = inventory.length > 0 ? { ...rest, inventory } : rest
		this.writeAll(updated)
	}

	/**
	 * Sets the character's money, as a single total in copper pieces (build
	 * order step 7, slice a1). Zero clears the field, matching how an absent
	 * `currencyCopper` already reads.
	 */
	setCurrency(id: string, currencyCopper: number): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { currencyCopper: _previous, ...rest } = characters[index]
		const updated = [...characters]
		updated[index] = currencyCopper > 0 ? { ...rest, currencyCopper } : rest
		this.writeAll(updated)
	}

	/**
	 * Sets the character's hit-point fields (persistent-header slice 1; the max
	 * became an OVERRIDE in slice 8a, temporary hit points arrived in 9a1). A
	 * targeted write like `setCurrency`: `currentHp` is still edited by hand and
	 * derived from nothing (D9), `maxHpOverride` replaces the computed maximum
	 * only when the player sets it, and `temporaryHitPoints` is the second pile
	 * damage spends first (D110). All three are replaced from the given object;
	 * `undefined` clears one, matching how an absent field reads — "not set" for
	 * the current, "use the computed maximum" for the override, "none" for the
	 * temporary. `currentHp` keeps 0 as a real value; temporary 0 IS none.
	 *
	 * `deathSaves` (9a2, D111) rides along because it is bound to `currentHp`:
	 * progress is kept only when this write leaves the character at exactly 0,
	 * so a heal — or a hand-typed current — clears it without the caller asking.
	 */
	setHitPoints(id: string, hitPoints: HitPointFields): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { currentHp: _currentHp, maxHpOverride: _maxHpOverride, play, ...rest } = characters[index]
		const { currentHp, maxHpOverride, temporaryHitPoints, deathSaves } = hitPoints
		// D110: clamped here too, so no writer of currentHp can leave a negative behind.
		const storedCurrentHp = currentHp === undefined ? undefined : Math.max(0, currentHp)
		// Slice 9b1: only the two hit-point piles are replaced from the input — resourceUses is nobody's business here and rides through.
		const storedPlay = storedPlayState(storedCurrentHp, { ...play, temporaryHitPoints, deathSaves })
		const updated = [...characters]
		updated[index] = {
			...rest,
			...(storedCurrentHp !== undefined ? { currentHp: storedCurrentHp } : {}),
			...(maxHpOverride !== undefined ? { maxHpOverride } : {}),
			...(storedPlay ? { play: storedPlay } : {}),
		}
		this.writeAll(updated)
	}

	/**
	 * Sets the character's spent counts for limited-use resources (slice 9b2),
	 * keyed by computeCharacterResources' resolved name — a targeted write like
	 * setCurrency and setHitPoints. Only resourceUses is replaced; the hit-point
	 * piles and death saves ride through unchanged, same reasoning as the
	 * comment on setHitPoints' own storedPlayState call.
	 */
	setResourceUses(id: string, resourceUses: Record<string, number> | undefined): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { currentHp, play, ...rest } = characters[index]
		const storedPlay = storedPlayState(currentHp, { ...play, resourceUses })
		const updated = [...characters]
		updated[index] = {
			...rest,
			...(currentHp !== undefined ? { currentHp } : {}),
			...(storedPlay ? { play: storedPlay } : {}),
		}
		this.writeAll(updated)
	}

	/**
	 * Sets the character's spent spell slots (slice 9b3) — a targeted write on the
	 * setResourceUses precedent, replacing only `spentSpellSlots` and letting the
	 * hit-point piles, death saves and resource uses ride through.
	 */
	setSpentSpellSlots(id: string, spentSpellSlots: SpentSpellSlots | undefined): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { currentHp, play, ...rest } = characters[index]
		const storedPlay = storedPlayState(currentHp, { ...play, spentSpellSlots })
		const updated = [...characters]
		updated[index] = {
			...rest,
			...(currentHp !== undefined ? { currentHp } : {}),
			...(storedPlay ? { play: storedPlay } : {}),
		}
		this.writeAll(updated)
	}

	/**
	 * Sets (or, with null, clears) the spell the character is concentrating on
	 * (slice 9d1) — a targeted write on the setSpentSpellSlots precedent that
	 * replaces only `concentratingOn`. A rest or a hit-point write never touches
	 * it: each spreads `play` through storedPlayState, which carries it along.
	 */
	setConcentration(id: string, spellName: string | null): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { currentHp, play, ...rest } = characters[index]
		const storedPlay = storedPlayState(currentHp, { ...play, concentratingOn: spellName })
		const updated = [...characters]
		updated[index] = {
			...rest,
			...(currentHp !== undefined ? { currentHp } : {}),
			...(storedPlay ? { play: storedPlay } : {}),
		}
		this.writeAll(updated)
	}

	/**
	 * Applies a finished rest (slice 9b5) — the first writer of `spentHitDice`, and
	 * the only one that replaces all four spent piles together. Temporary hit points
	 * ride through; death saves ride through storedPlayState, which drops them when
	 * the heal this write carries lifts the character off 0 (D111).
	 */
	applyRest(id: string, rest: RestFields): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const { currentHp: _currentHp, play, ...unchanged } = characters[index]
		const storedPlay = storedPlayState(rest.currentHp, {
			...play,
			resourceUses: rest.resourceUses,
			spentSpellSlots: rest.spentSpellSlots,
			spentHitDice: rest.spentHitDice,
		})
		const updated = [...characters]
		updated[index] = {
			...unchanged,
			...(rest.currentHp !== undefined ? { currentHp: rest.currentHp } : {}),
			...(storedPlay ? { play: storedPlay } : {}),
		}
		this.writeAll(updated)
	}

	delete(id: string): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		this.writeAll(characters.filter((character) => character.id !== id))
	}

	/** Serializes one saved character to an export file's contents (still an array — see wireFormat.ts). */
	exportCharacter(id: string): string {
		const character = this.list().find((c) => c.id === id)
		if (!character) throw new CharacterNotFoundError(id)
		return JSON.stringify(toStoredCharacters([character]), null, 2)
	}

	/**
	 * Reads an export file's contents and adds every character it contains
	 * to the store as NEW characters with freshly generated ids — existing
	 * characters are never overwritten (PHASE1.md section D). On any
	 * validation failure the store is left completely unchanged.
	 */
	import(raw: string): Character[] {
		let stored: StoredCharacter[]
		try {
			stored = parseStoredCharacters(raw)
		} catch (error) {
			if (error instanceof UnknownSchemaVersionError) throw error
			const message = error instanceof Error ? error.message : String(error)
			throw new ImportValidationError(`That file could not be imported: ${message}`)
		}

		if (stored.length === 0) {
			throw new ImportValidationError('That file does not contain any characters.')
		}

		const imported = stored.map((character) => ({ ...toCharacter(character), id: newId() }))
		this.writeAll([...this.list(), ...imported])
		return imported
	}
}
