const fs = require('fs')
const path = require('path')
const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const base = classes.filter((c) => c.entryType === 'class' && c.hd)

function slotGroup(c) {
	return c.classTableGroups.find((g) => g.rowsSpellProgression)
}

const wizard = base.find((c) => c.name === 'Wizard')
const wg = slotGroup(wizard)
console.log('Wizard colLabels:', JSON.stringify(wg.colLabels))
console.log('Wizard level 5 row (index 4):', JSON.stringify(wg.rowsSpellProgression[4]))

const paladin = base.find((c) => c.name === 'Paladin')
const pg = slotGroup(paladin)
console.log('Paladin casterProgression:', paladin.casterProgression)
console.log('Paladin colLabels:', JSON.stringify(pg.colLabels))
console.log('Paladin level 5 row (index 4):', JSON.stringify(pg.rowsSpellProgression[4]))

const fighter = base.find((c) => c.name === 'Fighter')
console.log('Fighter casterProgression:', fighter.casterProgression, 'classTableGroups has rowsSpellProgression?', !!slotGroup(fighter))

const warlock = base.find((c) => c.name === 'Warlock')
const wlg = warlock.classTableGroups[0]
console.log('Warlock colLabels:', JSON.stringify(wlg.colLabels))
console.log('Warlock level 5 row (index 4):', JSON.stringify(wlg.rows[4]))

console.log('All base class names + casterProgression:')
for (const c of base) console.log(' ', c.name, c.casterProgression)

console.log()
console.log('Wizard rows 0-4:', JSON.stringify(wg.rowsSpellProgression.slice(0,5)))
console.log('Paladin rows 0-4:', JSON.stringify(pg.rowsSpellProgression.slice(0,5)))
console.log('Warlock rows 0-4:', JSON.stringify(wlg.rows.slice(0,5)))
console.log('Wizard rows length:', wg.rowsSpellProgression.length)
console.log('Paladin rows length:', pg.rowsSpellProgression.length)
console.log('Warlock rows length:', wlg.rows.length)
