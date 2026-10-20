import { useEffect, useState, type ReactNode } from 'react'
import { loadSubclassSpellChoiceOffers, type SubclassSpellChoiceOffer } from './subclassSpellChoiceData'
import { knownSpellNote, knownSpellReason, SUBCLASS_SPELL_CHOICE_PICKER_KEY, type KnownSpell } from './knownSpells'
import type { CharacterSubclassSpellChoicePick } from '../storage/character'

/*
 * The subclass filter-choice spell picker (build order step 6, slice d6b —
 * the LAST picker of step 6). Covers the 5 subclasses
 * subclassSpellChoiceData.ts's SUBCLASS_SPELL_CHOICE_KEYS names: only
 * spells matching the subclass's own filter (school, or College of Lore's
 * other-class list) and level cap are offered, one spell per slot, exactly
 * the slots unlocked at the character's class level — nothing shown below
 * the subclass's own grant level(s) (renders null, same as
 * AlwaysPreparedSpellsList when there is nothing to show).
 *
 * A dropdown per slot rather than one shared checkbox list (unlike
 * FilterChoiceSpellSubPicker in FeatAsiPicker.tsx): the 5 subclasses here
 * grant several slots with DIFFERENT level caps at once (Evoker at
 * character level 7 has a level-3 slot capped 0-2 alongside a level-7 slot
 * capped 0-4), so each slot must offer only its own candidates, not the
 * union of every unlocked slot's.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; offers: SubclassSpellChoiceOffer[] }
	| { status: 'error'; message: string }

function pickKey(grantedAtLevel: number, slotIndex: number): string {
	return `${grantedAtLevel}|${slotIndex}`
}

// XPHB feature names and their free-spell wording, keyed like SUBCLASS_SPELL_CHOICE_KEYS.
const FEATURE_BY_SUBCLASS: Record<string, { name: string; note: string }> = {
	'College of Lore|XPHB': { name: 'Magical Discoveries', note: 'These spells are always prepared and count as Bard spells for you.' },
	'Abjurer|XPHB': { name: 'Abjuration Savant', note: 'These spells are added to your spellbook for free.' },
	'Diviner|XPHB': { name: 'Divination Savant', note: 'These spells are added to your spellbook for free.' },
	'Evoker|XPHB': { name: 'Evocation Savant', note: 'These spells are added to your spellbook for free.' },
	'Illusionist|XPHB': { name: 'Illusion Savant', note: 'These spells are added to your spellbook for free.' },
}

export function SubclassSpellChoicePicker({
	subclassName,
	subclassSource,
	className,
	classSource,
	classLevel,
	value,
	onChange,
	alreadyKnown = [],
}: {
	subclassName: string
	subclassSource: string
	className: string
	classSource: string
	classLevel: number
	value: CharacterSubclassSpellChoicePick[]
	onChange: (picks: CharacterSubclassSpellChoicePick[]) => void
	/** Spells the character already has from elsewhere (knownSpells.ts) — offered but not selectable, with the source named. This picker's own picks are excluded by key. */
	alreadyKnown?: readonly KnownSpell[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadSubclassSpellChoiceOffers(subclassName, subclassSource, className, classSource, classLevel)
			.then((offers) => {
				if (!cancelled) setState({ status: 'ready', offers })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [subclassName, subclassSource, className, classSource, classLevel])

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load spells: {state.message}</p>
	}
	if (state.offers.length === 0) return null

	const { offers } = state

	function pickFor(grantedAtLevel: number, slotIndex: number): CharacterSubclassSpellChoicePick | undefined {
		return value.find((p) => p.grantedAtLevel === grantedAtLevel && p.slotIndex === slotIndex)
	}

	function choose(grantedAtLevel: number, slotIndex: number, candidate: { name: string; source: string } | null): void {
		const withoutSlot = value.filter((p) => !(p.grantedAtLevel === grantedAtLevel && p.slotIndex === slotIndex))
		if (!candidate) {
			onChange(withoutSlot)
			return
		}
		onChange([...withoutSlot, { grantedAtLevel, slotIndex, name: candidate.name, source: candidate.source }])
	}

	const feature = FEATURE_BY_SUBCLASS[`${subclassName}|${subclassSource}`]
	const slotsAtLevel = (level: number): number => offers.filter((o) => o.slot.grantedAtLevel === level).length

	return (
		<section className="wizard__card spell-picker__section spell-picker__section--subclass-choice">
			<h3>{feature?.name ?? subclassName}</h3>
			{feature && <p>{feature.note}</p>}
			<p className="spell-picker__remaining">
				{value.length} of {offers.length} {subclassName} spell{offers.length === 1 ? '' : 's'} chosen.
			</p>
			<ul className="spell-picker__list">
				{offers.map(({ slot, candidates }) => {
					const current = pickFor(slot.grantedAtLevel, slot.slotIndex)
					return (
						<li key={pickKey(slot.grantedAtLevel, slot.slotIndex)} className="spell-picker__item">
							<label>
								Level {slot.grantedAtLevel}
								{slotsAtLevel(slot.grantedAtLevel) > 1 ? `, choice ${slot.slotIndex + 1}` : ''}:{' '}
								<select
									value={current ? `${current.name}|${current.source}` : ''}
									onChange={(event) => {
										const raw = event.target.value
										if (!raw) {
											choose(slot.grantedAtLevel, slot.slotIndex, null)
											return
										}
										const [name, source] = raw.split('|')
										choose(slot.grantedAtLevel, slot.slotIndex, { name, source })
									}}
								>
									<option value="">— choose a spell —</option>
									{candidates.map((candidate) => {
										const known = knownSpellReason(alreadyKnown, candidate, SUBCLASS_SPELL_CHOICE_PICKER_KEY)
										// This slot's OWN current pick stays selectable — the dropdown has to be able to show it.
										const isCurrent = current?.name === candidate.name && current.source === candidate.source
										return (
											<option
												key={`${candidate.name}|${candidate.source}`}
												value={`${candidate.name}|${candidate.source}`}
												disabled={!isCurrent && known !== null}
											>
												{candidate.name}
												{known !== null ? ` ${knownSpellNote(known)}` : ''}
											</option>
										)
									})}
								</select>
							</label>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
