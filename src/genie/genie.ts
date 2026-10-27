import type { CharacterClass, GenieKind } from '../storage/character'

export const GENIE_SUBCLASS = 'The Genie'

export const GENIE_KIND_NOT_CHOSEN = 'Genie kind not chosen yet — choose it in Edit Character.'

export function isGenieClass(cls: { className: string; classSource: string; subclass: string | null }): boolean {
	return cls.className === 'Warlock' && cls.classSource === 'XPHB' && cls.subclass === GENIE_SUBCLASS
}

export function hasGenie(classes: readonly CharacterClass[]): boolean {
	return classes.some(isGenieClass)
}

/** D407: the additionalSpells entry a class's rank grants read — the chosen kind for The Genie, nothing otherwise. */
export function genieEntryFor(cls: { className: string; classSource: string; subclass: string | null }, genieKind: GenieKind | undefined | null): GenieKind | null {
	return isGenieClass(cls) ? (genieKind ?? null) : null
}
