import type { CharacterSpellbookSpell, SpellbookOrigin } from '../storage/character'

/** D423: the wizard's working copy of the book. `origin` null = written in this run; save assigns it by the run's mode. */
export interface WizardSpellbookEntry {
	name: string
	source: string
	level: number | null
	origin: SpellbookOrigin | null
}

export type SpellbookRunMode = 'create' | 'levelUp' | 'edit'

/** PHB 2024 Wizard Features table: a full caster gains a new spell level at every odd Wizard level up to 9th. */
export function wizardMaxSpellLevel(classLevel: number): number {
	return Math.max(1, Math.min(9, Math.ceil(classLevel / 2)))
}

/** D423: book entries this run must write — 6 at Wizard 1, then 2 per Wizard level; Edit owes none. */
export function spellbookEntriesOwed(mode: SpellbookRunMode, classLevel: number): number | null {
	if (mode === 'edit') return null
	if (mode === 'levelUp') return classLevel === 1 ? 6 : 2
	return 6 + 2 * (classLevel - 1)
}

/**
 * D423: an origin level for each spell level (same order) — six at Wizard 1, two at every later level,
 * each within the spell levels that Wizard level has slots for. Highest spell levels go to the highest
 * Wizard levels, which finds an assignment whenever one exists. Null when none does.
 */
export function assignSpellbookOrigins(spellLevels: readonly number[], classLevel: number): number[] | null {
	if (classLevel < 1 || spellLevels.length !== 6 + 2 * (classLevel - 1)) return null
	const originLevels: number[] = []
	for (let level = classLevel; level >= 2; level--) originLevels.push(level, level)
	for (let index = 0; index < 6; index++) originLevels.push(1)
	const order = spellLevels.map((level, index) => ({ level, index })).sort((a, b) => b.level - a.level)
	const result: number[] = new Array<number>(spellLevels.length)
	for (let index = 0; index < order.length; index++) {
		const { level, index: at } = order[index]
		if (level < 1 || level > wizardMaxSpellLevel(originLevels[index])) return null
		result[at] = originLevels[index]
	}
	return result
}

export interface SpellbookRunStatus {
	/** Entries written in this run. */
	count: number
	/** Null in Edit: the count is not enforced. */
	required: number | null
	/** Highest spell level this run may write; null in Edit. */
	maxSpellLevel: number | null
	/** Why Next stays disabled; null when the book is complete. */
	reason: string | null
}

export function spellbookRunStatus(entries: readonly WizardSpellbookEntry[], mode: SpellbookRunMode, classLevel: number): SpellbookRunStatus {
	const written = entries.filter((entry) => entry.origin === null)
	const required = spellbookEntriesOwed(mode, classLevel)
	if (required === null) return { count: written.length, required, maxSpellLevel: null, reason: null }
	const maxSpellLevel = wizardMaxSpellLevel(classLevel)
	const status = { count: written.length, required, maxSpellLevel }
	if (written.length !== required) return { ...status, reason: `Write exactly ${required} spells in the spellbook (${written.length} now).` }
	if (written.some((entry) => entry.level === null)) return { ...status, reason: 'A spellbook spell has an unknown level.' }
	const fits =
		mode === 'levelUp'
			? written.every((entry) => entry.level! >= 1 && entry.level! <= maxSpellLevel)
			: assignSpellbookOrigins(
					written.map((entry) => entry.level!),
					classLevel,
				) !== null
	if (!fits) return { ...status, reason: 'Too many higher-level spells: each Wizard level writes only spells of levels it has slots for.' }
	return { ...status, reason: null }
}

/** D423: the stored book — entries written in this run get their origin from the run's mode. */
export function resolveSpellbookEntries(entries: readonly WizardSpellbookEntry[], mode: SpellbookRunMode, classLevel: number): CharacterSpellbookSpell[] {
	const written = entries.filter((entry) => entry.origin === null)
	const assigned =
		mode === 'create' && written.length > 0
			? assignSpellbookOrigins(
					written.map((entry) => entry.level ?? 0),
					classLevel,
				)
			: null
	if (mode === 'create' && written.length > 0 && assigned === null) throw new Error('The spellbook spells do not fit the Wizard levels (D423).')
	let next = 0
	return entries.map((entry) => {
		if (entry.origin !== null) return { name: entry.name, source: entry.source, origin: entry.origin }
		const origin: SpellbookOrigin =
			mode === 'edit' ? { kind: 'copied' } : mode === 'levelUp' ? { kind: 'level', level: classLevel } : { kind: 'level', level: assigned![next++] }
		return { name: entry.name, source: entry.source, origin }
	})
}
