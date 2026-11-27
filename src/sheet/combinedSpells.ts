import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import { genieEntryFor } from '../genie/genie'
import { loadFeatGrantedSpells } from '../spells/featSpells'
import { loadOptionalFeatureGrantedSpells } from '../spells/optionalFeatureSpells'
import { loadRaceSpells } from '../spells/raceSpells'
import { findSpellDetail, loadSpellDetails, type SpellDetail } from '../spells/spellDetailData'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import {
	dedupeAlwaysPreparedSpells,
	loadClassAlwaysPreparedSpells,
	loadSubclassAlwaysPreparedSpells,
	loadSubclassSpellcastingAbility,
	type AlwaysPreparedSpell,
} from '../spells/subclassPreparedSpells'
import { isSavantSubclass, loadSubclassChosenSpells } from '../spells/subclassSpellChoiceData'
import { activeBookPicks } from '../spells/wizardBookPicks'
import type { Character } from '../storage/character'
import { hasSpellbook, savantSpellsOf, spellbookSpellsOf } from './manageSpellsData'
import { loadSubclassSource } from './sheetData'
import { combineSpellEntries, type SheetSpellEntry } from './SpellList'

export interface SubclassSpellInfo {
	subclassName: string
	className: string
	classSource: string
	alwaysPrepared: AlwaysPreparedSpell[]
	ability: AbilityAbbreviation | null
}

export interface ClassSpellInfo {
	className: string
	spells: AlwaysPreparedSpell[]
}

/** D438: shared by the sheet and the encounter, so an NPC row's AC (Mage Armor) reads the same spell list the sheet does. */
export async function loadClassAndSubclassSpellInfo(
	character: Character,
	spellSlotsClassData: ClassSpellSlotsData[] | null,
): Promise<{ classInfos: ClassSpellInfo[]; subclassInfos: SubclassSpellInfo[] }> {
	const classesWithSubclass = character.classes.filter((c): c is typeof c & { subclass: string } => c.subclass !== null)
	// D192: the class record's own grants apply to every class, subclass or not (Druid 1, Ranger 1).
	const classGrants = Promise.all(
		character.classes.map(async (c) => ({ className: c.className, spells: await loadClassAlwaysPreparedSpells(c.className, c.classSource, c.level) })),
	)
	const subclassGrants = Promise.all(
		classesWithSubclass.map(async (c) => {
			const source = await loadSubclassSource(c.className, c.classSource, c.subclass)
			// Only Warlock's own Pact Magic table applies to a rank-keyed patron grant (subclassPreparedSpells.ts) — any other class's table would be the wrong shape's numbers entirely.
			// spellSlotsClassData loads in parallel via a separate effect — undefined here on an early run just means no rank grant yet; this effect re-runs (dep below) once it's in, same as any other race in this file.
			const pactSlotsByLevel = spellSlotsClassData?.find((d) => d.className === c.className && d.classSource === c.classSource)?.pactSlotsByLevel ?? undefined
			const alwaysPrepared = source ? await loadSubclassAlwaysPreparedSpells(c.subclass, source, c.className, c.classSource, c.level, pactSlotsByLevel, genieEntryFor(c, character.genieKind)) : []
			/** The subclass filter-choice spell picker's own picks (d6b) — same "always prepared (subclass)" provenance label as the fixed grants above, merged into the same group rather than a separate one (CharacterSheet.tsx module comment, SpellList.tsx). */
			// D424: Savant picks go into the spellbook, not into always prepared.
			const matchingChoices = (character.subclassSpellChoices ?? []).filter(
				(choice) =>
					choice.className === c.className &&
					choice.classSource === c.classSource &&
					choice.subclassName === c.subclass &&
					choice.subclassSource === source &&
					!isSavantSubclass(choice.subclassName, choice.subclassSource),
			)
			const chosen = matchingChoices.length > 0 ? await loadSubclassChosenSpells(matchingChoices) : []
			const ability = source ? await loadSubclassSpellcastingAbility(c.subclass, source, c.className, c.classSource) : null
			// dedupeAlwaysPreparedSpells: a d6b picked spell could in principle coincide with the subclass's own fixed grant — same "spell reachable via two paths" reasoning as subclassPreparedSpells.ts's own dedup, applied again here since this concatenation happens outside that module.
			return { subclassName: c.subclass, className: c.className, classSource: c.classSource, alwaysPrepared: dedupeAlwaysPreparedSpells([...alwaysPrepared, ...chosen]), ability }
		}),
	)
	const [classInfos, subclassInfos] = await Promise.all([classGrants, subclassGrants])
	return { classInfos, subclassInfos }
}

/** D425: Spell Mastery and Signature Spells are the Wizard's own always-prepared grants, cast without a slot. */
export function wizardBookGrants(character: Character, classSpellInfo: ClassSpellInfo[], spellDetails: SpellDetail[] | null) {
	const bookWizard = character.classes.find((c) => hasSpellbook(c.className, c.classSource))
	const wizardBookPicks = bookWizard
		? activeBookPicks(
				character.spellbooks?.find((book) => book.className === bookWizard.className && book.classSource === bookWizard.classSource),
				[...spellbookSpellsOf(character.spellbooks, bookWizard.className, bookWizard.classSource), ...savantSpellsOf(character.subclassSpellChoices, bookWizard.className, bookWizard.classSource, bookWizard.subclass)],
				bookWizard.level,
			)
		: { mastery: [], signature: [] }
	const bookPickGrants: AlwaysPreparedSpell[] = (
		[
			...wizardBookPicks.mastery.map((spell) => ({ spell, usage: { kind: 'atWill' } as const })),
			...wizardBookPicks.signature.map((spell) => ({ spell, usage: { kind: 'onceFreePerShortOrLongRest' } as const })),
		] as const
	).flatMap(({ spell, usage }) => {
		const detail = findSpellDetail(spellDetails ?? [], spell.name, spell.source)
		if (!detail) return []
		return [{ name: detail.name, source: detail.source, level: detail.level, grantedAtLevel: bookWizard!.level, ritual: detail.ritual, concentration: detail.concentration, origin: 'class' as const, usage }]
	})
	const classGrantInfo =
		bookWizard && bookPickGrants.length > 0
			? [
					...classSpellInfo.filter((info) => info.className !== bookWizard.className),
					{ className: bookWizard.className, spells: [...(classSpellInfo.find((info) => info.className === bookWizard.className)?.spells ?? []), ...bookPickGrants] },
				]
			: classSpellInfo
	return { bookWizard, wizardBookPicks, classGrantInfo }
}

/** The sheet's whole spell list without the sheet: the same loads and the same combine, plus the loads the spell numbers need (D439). */
export async function loadCombinedSpellParts(character: Character) {
	const [spellSlotsClassData, spellDetails] = await Promise.all([loadSpellSlotsClassData(), loadSpellDetails()])
	const [{ classInfos, subclassInfos }, featSpells, optionalFeatureSpells, raceSpells] = await Promise.all([
		loadClassAndSubclassSpellInfo(character, spellSlotsClassData),
		loadFeatGrantedSpells(character),
		loadOptionalFeatureGrantedSpells(character),
		loadRaceSpells(character),
	])
	const { classGrantInfo } = wizardBookGrants(character, classInfos, spellDetails)
	const entries = combineSpellEntries(
		character.spellChoices ?? [],
		subclassInfos.map((info) => ({ subclassName: info.subclassName, className: info.className, classSource: info.classSource, spells: info.alwaysPrepared })),
		featSpells,
		optionalFeatureSpells,
		raceSpells.spells,
		classGrantInfo,
	)
	return { entries, spellDetails, subclassInfos, featSpells, raceSpells: raceSpells.spells }
}

export async function loadCombinedSpells(character: Character): Promise<SheetSpellEntry[]> {
	return (await loadCombinedSpellParts(character)).entries
}
