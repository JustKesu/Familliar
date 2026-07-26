import type { Character } from './character'

/*
 * The on-disk/on-file shape. Only the storage layer ever sees this — the
 * rest of the app works with `Character` (see character.ts).
 *
 * Both localStorage and export files store the SAME shape: a top-level
 * ARRAY of these records, each one carrying its own schema version. That
 * satisfies two separate rules from PHASE1.md section D at once:
 *   - "the stored payload carries a schema version... from the first write"
 *   - "an export file's top level is a list of characters, never a bare
 *      single character object"
 * A per-record version (rather than one version for the whole array) means
 * a future mixed-version import file could in principle be handled record
 * by record, though nothing does that yet since only version 1 exists.
 */
export interface StoredCharacter extends Character {
	schemaVersion: number
}
