/*
 * "Warn once" registries for the renderer.
 *
 * The renderer degrades gracefully rather than throwing: an unrecognised tag
 * or entry type still renders readable text. That is the right behaviour for
 * players, but it means a gap is invisible unless we say something — hence a
 * console warning.
 *
 * Once per distinct name, never once per occurrence: a single class page can
 * contain hundreds of the same tag, and a flooded console is as useless as a
 * silent one.
 *
 * Lives in its own module so that Markup.tsx exports components only, which
 * is what React Fast Refresh needs.
 */

export interface WarnOnceRegistry {
	/** Logs `message` the first time this `key` is seen, then stays quiet. */
	warn(key: string, message: string): void
	/** Forgets everything seen so far. Tests use this; nothing else should. */
	reset(): void
	/** Every key warned about so far, sorted. */
	seen(): string[]
}

export function createWarnOnceRegistry(): WarnOnceRegistry {
	const seen = new Set<string>()

	return {
		warn(key, message) {
			if (seen.has(key)) return
			seen.add(key)
			console.warn(message)
		},
		reset() {
			seen.clear()
		},
		seen() {
			return [...seen].sort()
		},
	}
}

/** Tags with no entry in the table in tags.ts. */
export const unknownTagWarnings = createWarnOnceRegistry()

/** Entry object `type` values with no case in Markup.tsx. */
export const unknownEntryWarnings = createWarnOnceRegistry()
