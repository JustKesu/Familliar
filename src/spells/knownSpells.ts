import { spellIdentityKey } from './subclassPreparedSpells'

/*
 * "Spells this character already has, and from where", derived from current
 * wizard state — the ONE computation every spell picker in the wizard consults
 * before offering an option (build order step 6, spell-overlap slice).
 *
 * D18/D44 applied to spells instead of skill proficiencies: an option the
 * character already has stays VISIBLE, is not selectable, and says where it
 * comes from. Nothing is hidden and nothing is silently dropped.
 *
 * Pure (D38): every source is passed in already loaded. Each entry carries the
 * key of the picker whose OWN selection produced it (null for a grant nobody
 * picked), so a picker can ignore its own contribution — otherwise unselecting
 * would become impossible.
 */

/** One reason the character already has a spell. A spell reachable from two sources yields two entries, the way D44 keeps every source of a proficiency visible. */
export interface KnownSpell {
	name: string
	source: string
	/** Player-facing phrase naming the source, e.g. "Archfey Patron, always prepared". */
	label: string
	/** The picker whose own selection produced this entry; null for a grant nobody picked. */
	pickerKey: string | null
}

export const CLASS_SPELL_PICKER_KEY = 'classSpells'
export const SUBCLASS_SPELL_CHOICE_PICKER_KEY = 'subclassSpellChoice'

/** Keyed by feat name, not by grant level: a feat's sub-pickers (Magic Initiate's, the filter-choice one) are the only controls that can undo that feat's own picks. */
export function featSpellPickerKey(featName: string): string {
	return `feat:${featName.toLowerCase()}`
}

export function optionalFeatureSpellPickerKey(optionName: string): string {
	return `optionalFeature:${optionName.toLowerCase()}`
}

export interface KnownSpellInputs {
	/** WizardData.spellChoices — the class spell step's picks. */
	classSpellPicks: readonly { name: string; source: string }[]
	/** Null when no subclass is chosen yet; the two subclass lists below are then ignored. */
	subclassName: string | null
	/** subclassPreparedSpells.ts's always-prepared grants for the chosen subclass. */
	subclassAlwaysPrepared: readonly { name: string; source: string }[]
	/** WizardData.subclassSpellChoices — the subclass filter-choice picker's own picks. */
	subclassSpellChoicePicks: readonly { name: string; source: string }[]
	/** featSpells.ts's grants: fixed AND the player's own Magic Initiate / filter-choice picks, both tagged with the granting feat. */
	featGrantedSpells: readonly { name: string; source: string; featName: string }[]
	/** optionalFeatureSpells.ts's grants: fixed AND the player's own option picks (Pact of the Tome), both tagged with the granting option. */
	optionalFeatureGrantedSpells: readonly { name: string; source: string; optionName: string }[]
}

export function collectKnownSpells(inputs: KnownSpellInputs): KnownSpell[] {
	const result: KnownSpell[] = []
	const seen = new Set<string>()

	function add(name: string, source: string, label: string, pickerKey: string | null): void {
		const key = `${spellIdentityKey(name, source)}|${label}`
		if (seen.has(key)) return
		seen.add(key)
		result.push({ name, source, label, pickerKey })
	}

	for (const pick of inputs.classSpellPicks) add(pick.name, pick.source, 'the Spells step', CLASS_SPELL_PICKER_KEY)

	if (inputs.subclassName !== null) {
		for (const spell of inputs.subclassAlwaysPrepared) add(spell.name, spell.source, `${inputs.subclassName}, always prepared`, null)
		for (const pick of inputs.subclassSpellChoicePicks) add(pick.name, pick.source, inputs.subclassName, SUBCLASS_SPELL_CHOICE_PICKER_KEY)
	}

	for (const spell of inputs.featGrantedSpells) add(spell.name, spell.source, `the ${spell.featName} feat`, featSpellPickerKey(spell.featName))

	for (const spell of inputs.optionalFeatureGrantedSpells) add(spell.name, spell.source, spell.optionName, optionalFeatureSpellPickerKey(spell.optionName))

	return result
}

/**
 * Where the character already has `spell` from, or null when this picker may
 * still offer it. Entries produced by `ownPickerKey` are ignored: a picker must
 * never disable an option the character has ONLY through its own current
 * selection, or unselecting would be impossible.
 */
export function knownSpellReason(known: readonly KnownSpell[], spell: { name: string; source: string }, ownPickerKey: string): string | null {
	const key = spellIdentityKey(spell.name, spell.source)
	const labels = known.filter((entry) => spellIdentityKey(entry.name, entry.source) === key && entry.pickerKey !== ownPickerKey).map((entry) => entry.label)
	return labels.length > 0 ? labels.join('; ') : null
}

/** The one wording every picker shows next to a disabled option, mirroring ClassSkillPicker's "(already granted by ...)". */
export function knownSpellNote(reason: string): string {
	return `(already have it from ${reason})`
}
