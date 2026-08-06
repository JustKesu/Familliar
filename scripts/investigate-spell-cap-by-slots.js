/*
 * Ahead of step 6 slice (d1): confirms "highest spell-slot level == highest
 * castable spell level" across caster types, and whether third-caster
 * (Eldritch Knight / Arcane Trickster) slots live in the same
 * classTableGroups/rowsSpellProgression shape that spellSlots.ts (slice b)
 * already reads.
 */

const fs = require('fs')
const path = require('path')
const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const base = classes.filter((c) => c.entryType === 'class' && c.hd)
const subclasses = classes.filter((c) => c.entryType === 'subclass')

function slotGroup(c) {
	return c.classTableGroups?.find((g) => g.rowsSpellProgression)
}

console.log('SUMMARY')
console.log()
console.log('--- Full caster (Wizard) ---')
const wizard = base.find((c) => c.name === 'Wizard')
const wg = slotGroup(wizard)
console.log('casterProgression:', wizard.casterProgression, '| table width (max slot level):', wg.rowsSpellProgression[wg.rowsSpellProgression.length - 1].length)
console.log('level 20 row:', JSON.stringify(wg.rowsSpellProgression[19]))
console.log('-> highest slot level reached == 9 == highest spell level Wizard can cast: yes')

console.log()
console.log('--- Half casters (Paladin, Ranger, Artificer) ---')
for (const name of ['Paladin', 'Ranger', 'Artificer']) {
	const c = base.find((cc) => cc.name === name)
	if (!c) {
		console.log(name, ': NOT FOUND in base classes')
		continue
	}
	const g = slotGroup(c)
	const lastRow = g.rowsSpellProgression[g.rowsSpellProgression.length - 1]
	console.log(name, '| casterProgression:', c.casterProgression, '| table max width (highest slot level):', lastRow.length, '| last row:', JSON.stringify(lastRow))
}
console.log('-> table just stops at a lower column count; same "max slot level = max spell level" rule holds')

console.log()
console.log('--- Warlock Pact Magic ---')
const warlock = base.find((c) => c.name === 'Warlock')
const wlg = warlock.classTableGroups.find((g) => g.rowsSpellProgression || g.rows)
console.log('casterProgression:', warlock.casterProgression)
console.log('colLabels:', JSON.stringify(wlg.colLabels))
console.log('level 1 row:', JSON.stringify(wlg.rows ? wlg.rows[0] : wlg.rowsSpellProgression[0]))
console.log('level 11 row:', JSON.stringify(wlg.rows ? wlg.rows[10] : wlg.rowsSpellProgression[10]))
console.log('-> single pact slot level IS the max castable spell level: yes (that is the whole point of the {count, slotLevel} shape slice b already returns)')

console.log()
console.log('--- Third casters: Eldritch Knight (Fighter), Arcane Trickster (Rogue) ---')
for (const subName of ['Eldritch Knight', 'Arcane Trickster']) {
	const sc = subclasses.find((c) => c.name === subName)
	console.log(subName, '| entryType:', sc.entryType, '| className/classSource (base class):', sc.className, sc.classSource)
	console.log('  top-level casterProgression field on subclass entry:', sc.casterProgression)
	console.log('  has classTableGroups (the shape spellSlots.ts reads)?', !!sc.classTableGroups)
	console.log('  has subclassTableGroups?', !!sc.subclassTableGroups, '| count:', sc.subclassTableGroups?.length)
	const slotTable = sc.subclassTableGroups?.find((g) => g.rowsSpellProgression)
	if (slotTable) {
		console.log('  slot table found INSIDE subclassTableGroups, title:', slotTable.title)
		console.log('  colLabels:', JSON.stringify(slotTable.colLabels))
		console.log('  row for level 3 (index 2):', JSON.stringify(slotTable.rowsSpellProgression[2]))
		console.log('  row for level 19 (index 18):', JSON.stringify(slotTable.rowsSpellProgression[18]))
	}
	const baseClass = base.find((c) => c.name === sc.className && c.classSource === sc.classSource)
	console.log('  base class (', sc.className, ') casterProgression field:', baseClass?.casterProgression, '(null/absent means slice b skips it as a non-caster)')
}
console.log()
console.log('-> Third-caster slots are NOT in classTableGroups/rowsSpellProgression (the shape spellSlots.ts reads).')
console.log('   They live in subclassTableGroups on the SUBCLASS entry, keyed by className=Fighter/Rogue (a non-caster base class).')
console.log('   spellSlots.ts looks up classData by (characterClass.className, characterClass.classSource) = ("Fighter","XPHB"),')
console.log('   whose casterProgression is null/absent -> slice b silently returns NO SpellSlotsEntry for an EK/AT character today.')
