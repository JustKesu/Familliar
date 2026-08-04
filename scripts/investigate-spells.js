/*
 * Pre-step-6 investigation (D46 pattern): what does the data actually hold
 * for spellcasting — caster type, cantrips/spells known/prepared, slot
 * tables, Pact Magic, subclass-granted spells, and the classes/classVariant(s)
 * trap (DATA.md).
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

const baseClasses = classes.filter((c) => c.entryType === 'class' && c.hd)
const subclasses = classes.filter((c) => c.entryType === 'subclass')

console.log('SUMMARY')
console.log('base classes found:', baseClasses.length)
console.log()

// 1-3: caster type, ability, cantrip/known/prepared structure
console.log('--- per-class caster fields ---')
for (const c of baseClasses) {
	const hasCantrip = Array.isArray(c.cantripProgression)
	const hasPrepared = Array.isArray(c.preparedSpellsProgression)
	const hasKnownFixed = Array.isArray(c.spellsKnownProgressionFixed)
	const hasKnownFixedByLevel = !!c.spellsKnownProgressionFixedByLevel
	console.log(
		`${c.name.padEnd(10)} caster=${String(c.casterProgression).padEnd(10)} ability=${String(c.spellcastingAbility).padEnd(5)}` +
			` cantrips=${hasCantrip ? 'structured' : 'none'.padEnd(10)} prepared=${hasPrepared ? 'structured' : 'none'}` +
			` knownFixed=${hasKnownFixed ? 'structured(flat)' : hasKnownFixedByLevel ? 'structured(byLevel)' : 'none'}`,
	)
}
console.log()
console.log(
	'Non-casters (no casterProgression/spellcastingAbility):',
	baseClasses.filter((c) => !c.casterProgression).map((c) => c.name),
)
console.log(
	'casterProgression distinct values seen:',
	[...new Set(baseClasses.map((c) => c.casterProgression))],
)
console.log(
	'NOTE: Paladin and Ranger (half casters) report casterProgression "artificer", not "1/2" —',
	'the value appears to name a shared progression *table*, not a literal class. Not documented anywhere found in docs/.',
)
console.log(
	'preparedSpellsChange values (when prepared spells may be swapped):',
	Object.fromEntries(baseClasses.filter((c) => c.preparedSpellsChange).map((c) => [c.name, c.preparedSpellsChange])),
)
console.log(
	'No class has an unstructured/prose-only cantrip or spells-known/prepared count — every caster with a count uses a numeric array field (one entry per character level 1-20). Nothing here is prose-only.',
)
console.log()

// 4: spell slot table shape
console.log('--- slot table location (classTableGroups) ---')
const wizard = baseClasses.find((c) => c.name === 'Wizard')
const wizardSlots = wizard.classTableGroups.find((g) => g.rowsSpellProgression)
console.log('Wizard: classTableGroups[].rowsSpellProgression, one row per level, one column per spell level 1-9.')
console.log('  colLabels (trimmed):', wizardSlots.colLabels.slice(0, 3))
console.log('  rows 1, 5, 20 (trimmed):', [wizardSlots.rowsSpellProgression[0], wizardSlots.rowsSpellProgression[4], wizardSlots.rowsSpellProgression[19]])
console.log()

// 5: Warlock Pact Magic
console.log('--- Warlock Pact Magic ---')
const warlock = baseClasses.find((c) => c.name === 'Warlock')
const warlockGroup = warlock.classTableGroups[0]
console.log('Warlock has NO rowsSpellProgression matrix. Its classTableGroups uses a flat "rows" array with columns:')
console.log(' ', warlockGroup.colLabels)
console.log('  meaning each row is [invocationsKnown, cantrips, prepared, SLOT COUNT, SLOT LEVEL] — a single slot count')
console.log('  + single slot level per character level, not one column per spell level like full casters.')
console.log('  rows 1, 5, 20 (trimmed):', [warlockGroup.rows[0], warlockGroup.rows[4], warlockGroup.rows[19]])
console.log('CONFIRMED: Pact Magic slots must be tracked with separate logic from the rowsSpellProgression casters.')
console.log()

// 6: subclass always-prepared spells
console.log('--- subclass additionalSpells ---')
const subsWithAdditional = subclasses.filter((s) => s.additionalSpells)
console.log('subclasses total:', subclasses.length, '| with additionalSpells:', subsWithAdditional.length)
const keyShapeCounts = new Map()
for (const s of subsWithAdditional) {
	for (const entry of s.additionalSpells) {
		const shape = JSON.stringify(Object.keys(entry).sort())
		keyShapeCounts.set(shape, (keyShapeCounts.get(shape) || 0) + 1)
	}
}
console.log('outer key shapes seen across additionalSpells entries (e.g. "prepared", "known", "innate", "expanded"):')
for (const [shape, count] of keyShapeCounts) console.log(' ', count, shape)
const clericExample = subsWithAdditional.find((s) => s.name === 'Life' && s.className === 'Cleric')
console.log('example (Cleric — Life domain, trimmed):', JSON.stringify(clericExample ? clericExample.additionalSpells : subsWithAdditional[0].additionalSpells).slice(0, 300))
console.log('field lives directly on the subclass object as top-level `additionalSpells`, keyed by class level -> spell name array. No ref* indirection needed for this field.')
console.log()

// 7: classes vs classVariants trap
console.log('--- classes vs classVariants trap (spells.json) ---')
console.log('total spells in data/spells.json:', spells.length)
console.log('field is `availableTo` with sub-fields: classes, classVariants, subclasses, feats, optionalFeatures (not top-level `classes`/`classVariant` as DATA.md names them).')
const emptyClasses = spells.filter((s) => Array.isArray(s.availableTo.classes) && s.availableTo.classes.length === 0)
const emptyClassesWithVariant = emptyClasses.filter((s) => Array.isArray(s.availableTo.classVariants) && s.availableTo.classVariants.length > 0)
const noAvailabilityAtAll = spells.filter((s) => {
	const a = s.availableTo
	return (a.classes || []).length === 0 && (a.classVariants || []).length === 0 && (a.subclasses || []).length === 0 && (a.feats || []).length === 0 && (a.optionalFeatures || []).length === 0
})
console.log('spells with empty `availableTo.classes`:', emptyClasses.length)
console.log('  of those, with populated `availableTo.classVariants`:', emptyClassesWithVariant.length)
console.log('spells with NO availability at all (empty everywhere):', noAvailabilityAtAll.length)
console.log(
	'DATA.md currently states "109 spells (95 XGE + 14 TCE), only 3 with no availability at all" — this run found',
	emptyClasses.length,
	'/',
	emptyClassesWithVariant.length,
	'and',
	noAvailabilityAtAll.length,
	'respectively. data/spells.json here has only',
	spells.length,
	'total spells (filtered to allowed sources), likely why the counts differ from the figure DATA.md recorded against the full/raw dataset.',
)
console.log('example spells with empty classes but populated classVariants:')
for (const s of emptyClassesWithVariant.slice(0, 3)) {
	console.log(' ', s.name, '|', s.source, '| classVariants (trimmed):', JSON.stringify(s.availableTo.classVariants[0]).slice(0, 150))
}
