/*
 * Wild Shape's known-form limits (build order step 6b, slice 3).
 *
 * The limits are hardcoded here, from the PHB 2024 Druid's Wild Shape feature
 * (level 2) — the same precedent expertiseData.ts's skill counts,
 * languageData.ts's CHOSEN_LANGUAGE_COUNT and spellCounts.ts's
 * EXTRA_CANTRIP_OPTIONS already set (D21): a rule the extracted data states
 * only as prose or as a rendered table gets one findable table in code.
 *
 * They are NOT invented. scripts/investigate-wild-shape-rules.js reads them
 * back out of class-features.json, where the feature's own entries carry a
 * table captioned "Beast Shapes":
 *
 *     Druid Level | Known Forms | Max CR | Fly Speed
 *              2  |      4      |  1/4   |    No
 *              4  |      6      |  1/2   |    No
 *              8  |      8      |   1    |    Yes
 *
 * matching the feature text: "You know four Beast forms for this feature,
 * chosen from among Beast stat blocks that have a maximum Challenge Rating of
 * 1/4 and that lack a Fly Speed", "your number of known forms and the maximum
 * Challenge Rating for those forms increases, as shown in the Beast Shapes
 * table", and "starting at level 8, you can adopt a form that has a Fly
 * Speed".
 *
 * The Druid Features table's own "Wild Shape" column is the number of USES
 * (2/3/4 by level), not the number of known forms — uses are play tracking,
 * build order step 9, and nothing here reads them.
 */

import { hasFlySpeed, isSwarmBeast, type Beast } from './beastData'

export const WILD_SHAPE_CLASS_NAME = 'Druid'
export const CIRCLE_OF_THE_MOON = 'Circle of the Moon'

/** The Druid level at which Circle Forms (Circle of the Moon) starts applying. */
const CIRCLE_FORMS_LEVEL = 3

interface BeastShapesRow {
	minLevel: number
	knownForms: number
	maxCr: number
	flyAllowed: boolean
}

/** The "Beast Shapes" table above, highest level first so a lookup takes the first match. */
const BEAST_SHAPES: readonly BeastShapesRow[] = [
	{ minLevel: 8, knownForms: 8, maxCr: 1, flyAllowed: true },
	{ minLevel: 4, knownForms: 6, maxCr: 0.5, flyAllowed: false },
	{ minLevel: 2, knownForms: 4, maxCr: 0.25, flyAllowed: false },
]

export interface WildShapeLimits {
	/** How many Beast forms the Druid knows at this level. */
	knownForms: number
	/** The CR cap, as a number, for comparison against a beast's `crNumber`. */
	maxCr: number
	/** The same cap written the way a stat block writes it ("1/4"), for display. */
	maxCrLabel: string
	/** Whether a form with a Fly Speed is legal yet (level 8 in the base table). */
	flyAllowed: boolean
	/** True when Circle of the Moon's formula raised the cap above the table's. */
	moonCap: boolean
}

/** Writes a CR the way a stat block does — the fractions are the only special cases. */
export function formatCr(cr: number): string {
	if (cr === 0.125) return '1/8'
	if (cr === 0.25) return '1/4'
	if (cr === 0.5) return '1/2'
	return String(cr)
}

/**
 * The limits for one class entry, or null when Wild Shape does not apply —
 * not a Druid, or below level 2.
 *
 * Circle of the Moon's Circle Forms (level 3) states its cap as a formula,
 * not a table: "The maximum Challenge Rating for the form equals your Druid
 * level divided by 3 (round down)." It is computed rather than tabulated, and
 * taken as the higher of the two caps — from level 3 up, floor(level / 3) is
 * never below the Beast Shapes row's cap, so the two never actually disagree.
 * Circle Forms says nothing about known forms or Fly Speed, so both stay as
 * the base table has them.
 */
export function wildShapeLimits(className: string, level: number, subclassName?: string | null): WildShapeLimits | null {
	if (className !== WILD_SHAPE_CLASS_NAME) return null

	const row = BEAST_SHAPES.find((entry) => level >= entry.minLevel)
	if (!row) return null

	const moonApplies = subclassName === CIRCLE_OF_THE_MOON && level >= CIRCLE_FORMS_LEVEL
	const moonCr = Math.floor(level / 3)
	const maxCr = moonApplies ? Math.max(row.maxCr, moonCr) : row.maxCr

	return {
		knownForms: row.knownForms,
		maxCr,
		maxCrLabel: formatCr(maxCr),
		flyAllowed: row.flyAllowed,
		moonCap: moonApplies && maxCr > row.maxCr,
	}
}

/** The first class entry that has Wild Shape, with its limits. Written to iterate the array (D11). */
export function wildShapeLimitsFor(
	classes: { className: string; classSource: string; subclass: string | null; level: number }[],
): { className: string; classSource: string; limits: WildShapeLimits } | null {
	for (const entry of classes) {
		const limits = wildShapeLimits(entry.className, entry.level, entry.subclass)
		if (limits) return { className: entry.className, classSource: entry.classSource, limits }
	}
	return null
}

/**
 * The forms a Druid may learn under those limits (D38 — pure, data passed in).
 *
 * The swarm exclusion is not prose: every row of the Beast Shapes table states
 * its Max CR as a filter carrying `miscellaneous=!swarm`
 * ("challenge rating=[&0;&1/4]|type=beast|speed type=!fly|miscellaneous=!swarm"),
 * the same clause Find Familiar's own filter carries. It changes the pool —
 * 3 of the 51 beasts at CR 1/4 or below are swarms.
 */
export function wildShapeForms(beasts: Beast[], limits: WildShapeLimits): Beast[] {
	return beasts.filter(
		(beast) => beast.crNumber <= limits.maxCr && !isSwarmBeast(beast) && (limits.flyAllowed || !hasFlySpeed(beast)),
	)
}

/** True when a stored/chosen form is still legal under the given limits. */
export function isLegalWildShapeForm(beasts: Beast[], limits: WildShapeLimits, form: { name: string; source: string }): boolean {
	return wildShapeForms(beasts, limits).some((beast) => beast.name === form.name && beast.source === form.source)
}
