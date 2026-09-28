import { formKey, type Beast, type FamiliarFormOption } from '../beasts/beastData'
import { wildShapeLimits } from '../beasts/wildShapeData'
import type { CharacterClass, CharacterFamiliar, CharacterWildShapeForms } from '../storage/character'

/*
 * The Extras tab's rows (R11a, D212): the one familiar, then every stored Wild
 * Shape form. Storage carries name + source only, so each row's stat block is
 * looked up in beasts.json here and never stored.
 */

export type ExtraKind = 'familiar' | 'wildShape'

export interface ExtraRow {
	key: string
	kind: ExtraKind
	name: string
	source: string
	beast: Beast | null
	/** The class whose Wild Shape entry holds the form — what a DELETE has to edit. Null for the familiar. */
	owner: { className: string; classSource: string } | null
	/** Only the familiar: the form comes from Pact of the Chain, not from the spell (a Notes entry). */
	pactOfTheChain: boolean
	/** D43: why there is no stat block, or null while the file is pending (loading, or its own error already says so). */
	problem: string | null
}

/** `pending` is true while beasts.json is loading or has failed to — a row must not read "not a legal form" or blame its own name for the missing pool. */
export function extraRows({
	familiar,
	familiarForms,
	wildShapeForms,
	beasts,
	pending,
}: {
	familiar: CharacterFamiliar | null
	familiarForms: FamiliarFormOption[]
	wildShapeForms: CharacterWildShapeForms[]
	beasts: Beast[]
	pending: boolean
}): ExtraRow[] {
	const rows: ExtraRow[] = []
	if (familiar) {
		const option = familiarForms.find((candidate) => formKey(candidate.beast) === formKey(familiar))
		rows.push({
			key: `familiar|${formKey(familiar)}`,
			kind: 'familiar',
			name: familiar.name,
			source: familiar.source,
			beast: option?.beast ?? null,
			owner: null,
			pactOfTheChain: option?.origin === 'pact-of-the-chain',
			problem: option || pending ? null : `"${familiar.name}" (${familiar.source}) is not a form this familiar can take.`,
		})
	}
	for (const entry of wildShapeForms) {
		for (const form of entry.forms) {
			const beast = beasts.find((candidate) => formKey(candidate) === formKey(form)) ?? null
			rows.push({
				key: `wildShape|${entry.className}|${formKey(form)}`,
				kind: 'wildShape',
				name: form.name,
				source: form.source,
				beast,
				owner: { className: entry.className, classSource: entry.classSource },
				pactOfTheChain: false,
				problem: beast || pending ? null : `No stat block found for "${form.name}" (${form.source}).`,
			})
		}
	}
	return rows
}

/** "CR 1/4, Darkvision 60 ft." — the senses the data already writes without passive Perception. */
export function extraNotes(row: ExtraRow): string {
	const parts = row.beast ? [`CR ${row.beast.cr}`, ...(row.beast.senses ?? [])] : []
	if (row.pactOfTheChain) parts.push('Pact of the Chain')
	return parts.join(', ')
}

export interface WildShapeNotice {
	key: string
	status: 'unknown' | 'over'
	text: string
}

/*
 * Slice 8e2 (D106): storage keeps every Wild Shape pick regardless of level
 * (D104), so this is the count-only half of that gap — one entry per class with
 * ANY stored forms, read off that one class's own level (wildShapeLimits).
 * Only a class the character no longer has makes it undeterminable.
 */
export function wildShapeNotices(classes: CharacterClass[], stored: CharacterWildShapeForms[]): WildShapeNotice[] {
	return stored.flatMap((entry): WildShapeNotice[] => {
		const key = `${entry.className}|${entry.classSource}`
		const classEntry = classes.find((candidate) => candidate.className === entry.className && candidate.classSource === entry.classSource)
		if (!classEntry) {
			return [{ key, status: 'unknown', text: `Cannot tell the Wild Shape limit for "${entry.className}": that class is no longer on this character.` }]
		}
		const allowed = wildShapeLimits(entry.className, classEntry.level, classEntry.subclass)?.knownForms ?? 0
		return entry.forms.length > allowed ? [{ key, status: 'over', text: `${entry.className} Wild Shape forms: ${entry.forms.length} known, ${allowed} allowed.` }] : []
	})
}
