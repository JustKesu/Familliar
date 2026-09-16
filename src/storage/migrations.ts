import { CURRENT_SCHEMA_VERSION } from './character'

/*
 * Schema migrations (D69). From version 16 on, every bump ships a step that
 * reads the IMMEDIATELY previous version and returns the next one; a save is
 * carried to CURRENT_SCHEMA_VERSION by walking those steps in order, so no
 * step ever has to know about more than one version change.
 *
 * A step takes and returns a plain record rather than a Character: an older
 * save is by definition not the current type. Validation runs after the walk,
 * against the migrated record, so a step is free to produce fields the older
 * shape did not have.
 *
 * Adding the next one: append `{ from: CURRENT, to: CURRENT + 1, migrate }`
 * here in the same commit that raises CURRENT_SCHEMA_VERSION. Nothing else
 * needs changing — isSupportedVersion and the store read this table.
 */

export interface SchemaMigration {
	from: number
	to: number
	migrate: (record: Record<string, unknown>) => Record<string, unknown>
}

export const MIGRATIONS: readonly SchemaMigration[] = [
	{
		from: 16,
		to: 17,
		/*
		 * 17 adds Character.familiar. A version-16 character has no familiar
		 * summoned, and an absent field already means exactly that — so this
		 * step only moves the version tag. It exists anyway because D69's chain
		 * must have no holes: the next step needs a 16->17 to build on.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 17 }),
	},
	{
		from: 17,
		to: 18,
		/*
		 * 18 adds Character.inventory and Character.currencyCopper. A version-17
		 * character carries neither, and an absent inventory / currency already
		 * means "owns nothing" / "no money" — so this step only moves the
		 * version tag, same as 16->17.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 18 }),
	},
	{
		from: 18,
		to: 19,
		/*
		 * 19 adds CharacterInventoryItem.equipped. A version-18 character has
		 * nothing equipped, and an absent field already means exactly that — so
		 * this step only moves the version tag, same as the two before it.
		 * Deliberately does NOT auto-equip armour the character happens to own:
		 * changing a number the player never asked to change is worse than a
		 * low AC with a stated reason (this slice's brief).
		 */
		migrate: (record) => ({ ...record, schemaVersion: 19 }),
	},
	{
		from: 19,
		to: 20,
		/*
		 * 20 adds CharacterInventoryItem.attackAbility. A version-19 character
		 * has never overridden a Finesse weapon's ability, and an absent field
		 * already means exactly that — the default, whichever of Strength and
		 * Dexterity is higher. Version tag only, same as the three before it.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 20 }),
	},
	{
		from: 20,
		to: 21,
		/*
		 * 21 adds CharacterInventoryItem.attuned. A version-20 character is
		 * attuned to nothing, and an absent flag already means exactly that —
		 * version tag only, same as the four before it. Deliberately does NOT
		 * attune anything the character owns: attuning is the player's action,
		 * and the limit is theirs to spend (this slice's brief).
		 */
		migrate: (record) => ({ ...record, schemaVersion: 21 }),
	},
	{
		from: 21,
		to: 22,
		/*
		 * 22 adds CharacterInventoryItem.magicBonus. A version-21 character has
		 * set no bonus on anything, and an absent field already means exactly that
		 * — the item's OWN bonus is read from items.json and was never stored, so
		 * nothing has to be backfilled. Version tag only, same as the five before it.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 22 }),
	},
	{
		from: 22,
		to: 23,
		/*
		 * 23 adds CharacterInventoryItem.custom. A version-22 character owns no
		 * custom items — every row it carries is a reference into items.json, and
		 * an absent definition already means exactly that. Version tag only, same
		 * as the six before it: nothing an existing character holds gains a field.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 23 }),
	},
	{
		from: 23,
		to: 24,
		/*
		 * 24 grows CustomItemDefinition with the computed fields (armour class,
		 * damage dice, resistances, speed, darkvision, the flat bonuses). Every
		 * one is optional and an absent one means "this item declares nothing
		 * there" — which is exactly what a version-23 custom item is. Version tag
		 * only, same as the seven before it.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 24 }),
	},
	{
		from: 24,
		to: 25,
		/*
		 * 25 adds CustomItemDefinition.stealthDisadvantage and .strengthRequirement.
		 * A version-24 custom suit declares neither, and an absent field already
		 * means "no disadvantage" / "no requirement" — which is the behaviour such
		 * a suit has today. Version tag only, same as the eight before it:
		 * backfilling either would change a number the player never set.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 25 }),
	},
	{
		from: 25,
		to: 26,
		/*
		 * 26 adds CharacterInventoryItem.grip. A version-25 character has
		 * two-handed nothing, and an absent grip already means one-handed — the
		 * default the rules give and the damage die (`dmg1`) the sheet was already
		 * printing first. Version tag only, same as the nine before it.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 26 }),
	},
	{
		from: 26,
		to: 27,
		/*
		 * 27 adds CustomItemDefinition.twoHanded, .versatile and .damageDice2. A
		 * version-26 custom weapon declares none of the three, and absent already
		 * means "takes one hand" — the behaviour such a weapon has today, since
		 * handsRequiredOf falls through to 1 when propertyFull carries neither
		 * property. Version tag only, same as the ten before it.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 27 }),
	},
	{
		from: 27,
		to: 28,
		/*
		 * 28 adds Character.currentHp and .maxHp — manual fields, no derivation.
		 * A version-27 character has neither, and an absent field already means
		 * "not set" (the header shows "—"). Version tag only, same as the eleven
		 * before it: no HP is invented for an existing character.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 28 }),
	},
	{
		from: 28,
		to: 29,
		/*
		 * 29 adds Character.speciesSpellcastingAbility (D89 follow-up). A
		 * version-28 character has never recorded one, and an absent field
		 * already means "not chosen yet" — the placeholder computeSpeciesSpellcasting
		 * already showed for every choose-ability species before this field
		 * existed. Version tag only, same as the twelve before it.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 29 }),
	},
	{
		from: 29,
		to: 30,
		/*
		 * 30 replaces the manual `maxHp` with a computed maximum (hitPointLevels
		 * plus Constitution plus the bonus table) and an optional override. The
		 * first step in this chain that MOVES data rather than only tagging: a
		 * number the player typed is exactly what the override means, so it goes
		 * there and the character's displayed maximum does not change. No
		 * hitPointLevels are invented — an absent list already means "no per-level
		 * choices recorded", which computeMaxHitPoints reports as defaults.
		 * `currentHp` is untouched.
		 */
		migrate: (record) => {
			const { maxHp, ...rest } = record
			return { ...rest, ...(typeof maxHp === 'number' ? { maxHpOverride: maxHp } : {}), schemaVersion: 30 }
		},
	},
	{
		from: 30,
		to: 31,
		/*
		 * 31 turns Character.masteries from bare weapon names into objects
		 * carrying that name and, once slice 8d writes them, the level the pick
		 * was made at (D97's application of D22). The first step in this chain
		 * that leaves a value UNKNOWN rather than moving or preserving one: a
		 * version-30 character has no record of when any mastery was chosen, and
		 * a guessed level would later let "remove this level" strip a pick that
		 * never belonged to it — so each name becomes `{ name }` and no level is
		 * invented (D43). A character without the field gains nothing.
		 */
		migrate: (record) => {
			const masteries = record['masteries']
			return {
				...record,
				...(Array.isArray(masteries) ? { masteries: masteries.map((name) => ({ name })) } : {}),
				schemaVersion: 31,
			}
		},
	},
	{
		from: 31,
		to: 32,
		/*
		 * 32 does to Character.expertiseSkills exactly what 31 did to masteries
		 * (D98 following D97): each bare skill name becomes `{ name }`, with no
		 * level invented, for the same reason 31 invented none (D43). A character
		 * without the field gains nothing.
		 */
		migrate: (record) => {
			const expertiseSkills = record['expertiseSkills']
			return {
				...record,
				...(Array.isArray(expertiseSkills) ? { expertiseSkills: expertiseSkills.map((name) => ({ name })) } : {}),
				schemaVersion: 32,
			}
		},
	},
	{
		from: 32,
		to: 33,
		/*
		 * 33 does to the `choices` INSIDE each optionalFeatureChoices entry what
		 * 31 and 32 did to masteries and expertiseSkills (D99 following D97/D98):
		 * each bare option name becomes `{ name }`, no level is invented (D43).
		 * Everything else on the entry — featureType and the nested spellChoices,
		 * which D99 leaves out of D22 — is carried through untouched, and an entry
		 * or a record without the key gains nothing.
		 */
		migrate: (record) => {
			const optionalFeatureChoices = record['optionalFeatureChoices']
			return {
				...record,
				...(Array.isArray(optionalFeatureChoices)
					? {
							optionalFeatureChoices: optionalFeatureChoices.map((entry) => {
								if (entry === null || typeof entry !== 'object') return entry
								const choices = (entry as Record<string, unknown>)['choices']
								if (!Array.isArray(choices)) return entry
								return { ...entry, choices: choices.map((name) => ({ name })) }
							}),
						}
					: {}),
				schemaVersion: 33,
			}
		},
	},
	{
		from: 33,
		to: 34,
		/*
		 * 34 adds Character.createdAtLevel (slice 8e). An older character's
		 * creation level is not known — its current level may already include
		 * levels gained afterwards — so nothing is added (D43, as D97).
		 */
		migrate: (record) => ({ ...record, schemaVersion: 34 }),
	},
	{
		from: 34,
		to: 35,
		/*
		 * 35 adds Character.temporaryHitPoints (slice 9a1, D110). Absent is the
		 * right value for every existing character — temporary hit points are
		 * gained in play and nothing before this version could grant any — so the
		 * step only tags.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 35 }),
	},
	{
		from: 35,
		to: 36,
		/*
		 * 36 adds Character.deathSaves (slice 9a2, D111). Absent is the right
		 * value for every existing character — a death save is in progress only
		 * while play has a character at 0 hit points, and nothing before this
		 * version could record one — so the step only tags.
		 */
		migrate: (record) => ({ ...record, schemaVersion: 36 }),
	},
]

/**
 * The steps that carry `version` to the current one, or null when no chain
 * reaches it — an unknown older version, or a version from a future release.
 */
function stepsToCurrent(version: number): SchemaMigration[] | null {
	if (version === CURRENT_SCHEMA_VERSION) return []
	if (!Number.isInteger(version) || version > CURRENT_SCHEMA_VERSION) return null

	const steps: SchemaMigration[] = []
	let at = version
	while (at !== CURRENT_SCHEMA_VERSION) {
		const step = MIGRATIONS.find((migration) => migration.from === at)
		if (!step) return null
		steps.push(step)
		at = step.to
	}
	return steps
}

/** True when a save at this version can be read — either it is current, or a chain of steps reaches current. */
export function canMigrateToCurrent(version: number): boolean {
	return stepsToCurrent(version) !== null
}

/**
 * Applies every step between the record's own version and the current one.
 * A value that is not a record, or carries no numeric version, is returned
 * untouched — describeStoredCharacterError is what reports that, with a
 * message about the actual problem.
 */
export function migrateToCurrent(value: unknown): unknown {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
	const record = value as Record<string, unknown>
	const version = record['schemaVersion']
	if (typeof version !== 'number') return value

	const steps = stepsToCurrent(version)
	if (!steps) return value

	let migrated = record
	for (const step of steps) migrated = step.migrate(migrated)
	return migrated
}
