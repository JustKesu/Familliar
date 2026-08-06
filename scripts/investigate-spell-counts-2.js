/*
 * Follow-up to investigate-spell-counts.js: what is Wizard's
 * spellsKnownProgressionFixed for (distinct from preparedSpellsProgression),
 * what is Warlock's spellsKnownProgressionFixedByLevel for, and where do
 * Eldritch Knight / Arcane Trickster (third casters) carry their cantrip/
 * spell counts since they have no casterProgression of their own.
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const wizard = classes.find((c) => c.entryType === 'class' && c.name === 'Wizard')
const warlock = classes.find((c) => c.entryType === 'class' && c.name === 'Warlock')

console.log('SUMMARY')
console.log('\n--- Wizard spellsKnownProgressionFixed (full) ---')
console.log(JSON.stringify(wizard.spellsKnownProgressionFixed))
console.log('preparedSpellsProgression (full):', JSON.stringify(wizard.preparedSpellsProgression))
console.log('Hypothesis: spellsKnownProgressionFixed = spells ADDED to spellbook this level (level-up gain), not a')
console.log('cumulative "known" count. preparedSpellsProgression = max spells preparable per day (the picker count).')

console.log('\n--- Warlock spellsKnownProgressionFixedByLevel (full) ---')
console.log(JSON.stringify(warlock.spellsKnownProgressionFixedByLevel))
console.log('preparedSpellsProgression (full):', JSON.stringify(warlock.preparedSpellsProgression))
console.log('preparedSpellsChange:', warlock.preparedSpellsChange)

console.log('\n--- Eldritch Knight / Arcane Trickster: where do THEY carry cantrip/spell counts? ---')
const ek = classes.find((c) => c.entryType === 'subclass' && c.name === 'Eldritch Knight')
const at = classes.find((c) => c.entryType === 'subclass' && c.name === 'Arcane Trickster')
for (const sub of [ek, at]) {
	if (!sub) {
		console.log('  not found')
		continue
	}
	console.log(`  ${sub.name}: cantripProgression=${JSON.stringify(sub.cantripProgression)}`)
	console.log(`    preparedSpellsProgression=${JSON.stringify(sub.preparedSpellsProgression)}`)
	console.log(`    spellsKnownProgressionFixed=${JSON.stringify(sub.spellsKnownProgressionFixed)}`)
	console.log(`    preparedSpellsChange=${sub.preparedSpellsChange}`)
	console.log(`    spellcastingAbility=${sub.spellcastingAbility}`)
	console.log(`    subclassTableGroups keys:`, sub.subclassTableGroups ? sub.subclassTableGroups.map((g) => g.colLabels) : null)
}

console.log('\n--- preparedSpellsChange values across all base classes + EK/AT ---')
const baseClasses = classes.filter((c) => c.entryType === 'class' && c.hd && c.casterProgression)
for (const c of baseClasses) console.log(' ', c.name, '->', c.preparedSpellsChange)
