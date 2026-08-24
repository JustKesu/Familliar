import { useEffect, useState, type ReactNode } from 'react'
import { loadClassSpellList, loadFeatExpandedSpellList, type ClassSpellListSpell } from './classSpellListData'
import { filterSpellsByLevel } from './spellLevelFilter'
import { CLASS_SPELL_PICKER_KEY, knownSpellNote, knownSpellReason, type KnownSpell } from './knownSpells'
import type { SpellSlotsEntry } from '../calculation/spellSlots'
import type { SpellCountLabel } from '../calculation/spellCounts'

/*
 * The class spell picker (build order step 6, slice d2). ONE picker for
 * every class — prepared vs known vs Wizard's spellbook is a LABEL only
 * (task instructions), never a different flow. Subclass always-prepared
 * spells (domains/oaths/circles) are slice d2b, not here.
 *
 * Mirrors ExpertisePicker (D8): state lives in the wizard, this component
 * only displays `value` and reports changes upward. `spellSlots`,
 * `cantripCount`, `leveledSpellCount` and `label` are all computed by the
 * caller from the calculation layer (spellSlots.ts, spellCounts.ts) against
 * a draft Character — this component only fetches the class's spell LIST
 * (slice c) and applies the level filter (slice d1) on top of it.
 *
 * Cantrips and leveled spells are counted and capped SEPARATELY (a cantrip
 * is not a leveled-spell pick) — two independent running totals, not one
 * shared pool.
 */

/** What the wizard stores per pick — `level` rides along so completion/count checks never need to re-fetch the spell list to classify a pick as cantrip vs leveled. */
export interface SpellPick {
	name: string
	source: string
	level: number
}

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; spells: ClassSpellListSpell[] }
	| { status: 'error'; message: string }

export function SpellPicker({
	className,
	classSource,
	expandedClassName,
	expandedClassSource,
	featChoices,
	spellSlots,
	cantripCount,
	leveledSpellCount,
	label,
	value,
	onChange,
	alreadyKnown = [],
}: {
	className: string
	classSource: string
	/** D46 (Divine Soul): an extra class list to UNION into the pool, e.g. Cleric alongside Sorcerer. Omitted for every other class/subclass. */
	expandedClassName?: string
	expandedClassSource?: string
	/** D46 (the 12 marks): every feat the character has taken (Character.featAsiChoices) — each feat's own `expanded` pool-widening spells (classSpellListData.ts's extractFeatExpandedSpellList) are unioned in too. A feat with no `expanded` key (i.e. every feat but a mark) contributes nothing. */
	featChoices?: { name: string; source: string }[]
	spellSlots: SpellSlotsEntry | undefined
	cantripCount: number
	leveledSpellCount: number
	label: SpellCountLabel
	value: SpellPick[]
	onChange: (spells: SpellPick[]) => void
	/** Spells the character already has from elsewhere (knownSpells.ts) — shown, not hidden, but not selectable here. This picker's own picks are excluded by key, so unselecting stays possible. */
	alreadyKnown?: readonly KnownSpell[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([
			loadClassSpellList(className, classSource),
			expandedClassName && expandedClassSource ? loadClassSpellList(expandedClassName, expandedClassSource) : Promise.resolve([]),
			Promise.all((featChoices ?? []).map((feat) => loadFeatExpandedSpellList(feat.name, feat.source))),
		])
			.then(([spells, expandedSpells, featExpandedSpells]) => {
				if (cancelled) return
				const merged = new Map<string, ClassSpellListSpell>()
				for (const spell of [...spells, ...expandedSpells, ...featExpandedSpells.flat()]) merged.set(`${spell.name}|${spell.source}`, spell)
				setState({ status: 'ready', spells: [...merged.values()] })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
				}
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- featChoices is a fresh array each render; its content (JSON) is the real dependency.
	}, [className, classSource, expandedClassName, expandedClassSource, JSON.stringify(featChoices)])

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load spells: {state.message}</p>
	}

	const offered = filterSpellsByLevel(state.spells, spellSlots)
	const cantrips = offered.filter((spell) => spell.level === 0)
	const leveledByLevel = new Map<number, ClassSpellListSpell[]>()
	for (const spell of offered) {
		if (spell.level === 0) continue
		const bucket = leveledByLevel.get(spell.level) ?? []
		bucket.push(spell)
		leveledByLevel.set(spell.level, bucket)
	}
	const leveledLevels = [...leveledByLevel.keys()].sort((a, b) => a - b)

	const cantripsChosen = value.filter((pick) => pick.level === 0).length
	const leveledChosen = value.filter((pick) => pick.level > 0).length

	function isChosen(spell: ClassSpellListSpell): boolean {
		return value.some((pick) => pick.name === spell.name && pick.source === spell.source)
	}

	function toggle(spell: ClassSpellListSpell): void {
		if (isChosen(spell)) {
			onChange(value.filter((pick) => !(pick.name === spell.name && pick.source === spell.source)))
			return
		}
		if (spell.level === 0) {
			if (cantripsChosen >= cantripCount) return
		} else if (leveledChosen >= leveledSpellCount) {
			return
		}
		onChange([...value, { name: spell.name, source: spell.source, level: spell.level }])
	}

	function renderSpell(spell: ClassSpellListSpell): ReactNode {
		const checked = isChosen(spell)
		const atLimit = !checked && (spell.level === 0 ? cantripsChosen >= cantripCount : leveledChosen >= leveledSpellCount)
		const known = knownSpellReason(alreadyKnown, spell, CLASS_SPELL_PICKER_KEY)
		return (
			<li key={`${spell.name}|${spell.source}`} className="spell-picker__item">
				<label>
					{/* An already-checked pick stays toggleable even once another source grants it too — otherwise a pick made before the subclass was chosen could never be undone. */}
					<input type="checkbox" checked={checked} disabled={!checked && (atLimit || known !== null)} onChange={() => toggle(spell)} />
					{spell.name}
					{spell.ritual && <span className="spell-picker__flag"> (ritual)</span>}
					{spell.concentration && <span className="spell-picker__flag"> (concentration)</span>}
					{spell.viaVariant && <span className="spell-picker__flag spell-picker__flag--variant"> (variant)</span>}
					{known !== null && <span className="spell-picker__already-known"> {knownSpellNote(known)}</span>}
				</label>
			</li>
		)
	}

	return (
		<div className="spell-picker">
			{cantripCount > 0 && (
				<div className="spell-picker__section">
					<p className="spell-picker__remaining">
						{cantripsChosen} of {cantripCount} cantrip{cantripCount === 1 ? '' : 's'} chosen.
					</p>
					<ul className="spell-picker__list">{cantrips.map(renderSpell)}</ul>
				</div>
			)}
			{leveledSpellCount > 0 && (
				<div className="spell-picker__section">
					<p className="spell-picker__remaining">
						{leveledChosen} of {leveledSpellCount} spell{leveledSpellCount === 1 ? '' : 's'} {label} chosen.
					</p>
					{leveledLevels.map((level) => (
						<div key={level} className="spell-picker__level-group">
							<h4>Level {level}</h4>
							<ul className="spell-picker__list">{(leveledByLevel.get(level) ?? []).map(renderSpell)}</ul>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
