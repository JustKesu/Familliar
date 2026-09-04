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
