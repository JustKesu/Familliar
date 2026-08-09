import { useEffect, useState, type ReactNode } from 'react'
import { loadSubclassSpellChoiceOffers, type SubclassSpellChoiceOffer } from './subclassSpellChoiceData'
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

export function SubclassSpellChoicePicker({
	subclassName,
	subclassSource,
	className,
	classSource,
	classLevel,
	value,
	onChange,
}: {
	subclassName: string
	subclassSource: string
	className: string
	classSource: string
	classLevel: number
	value: CharacterSubclassSpellChoicePick[]
	onChange: (picks: CharacterSubclassSpellChoicePick[]) => void
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

	return (
		<div className="spell-picker__section spell-picker__section--subclass-choice">
			<p className="spell-picker__remaining">
				{value.length} of {offers.length} {subclassName} spell{offers.length === 1 ? '' : 's'} chosen.
			</p>
			<ul className="spell-picker__list">
				{offers.map(({ slot, candidates }) => {
					const current = pickFor(slot.grantedAtLevel, slot.slotIndex)
					return (
						<li key={pickKey(slot.grantedAtLevel, slot.slotIndex)} className="spell-picker__item">
							<label>
								Level {slot.grantedAtLevel} choice:{' '}
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
									{candidates.map((candidate) => (
										<option key={`${candidate.name}|${candidate.source}`} value={`${candidate.name}|${candidate.source}`}>
											{candidate.name}
										</option>
									))}
								</select>
							</label>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
