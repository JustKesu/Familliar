/*
 * D46 shape check (step 6, Divine Soul expanded wiring): confirm the exact
 * `additionalSpells.expanded` shape for Sorcerer's Divine Soul subclass
 * before wiring the picker to it. Trimmed output only.
 */
const fs = require('node:fs')
const path = require('node:path')

const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'classes.json'), 'utf8')
const parsed = JSON.parse(raw)
const list = parsed.filter((e) => e.entryType === 'subclass')

const entries = list.filter((s) => s.name === 'Divine Soul')
console.log(`\n=== Divine Soul: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} ===`)
for (const e of entries) {
	console.log('source:', e.source, 'className:', e.className, 'classSource:', e.classSource)
	console.log('additionalSpells:', JSON.stringify(e.additionalSpells, null, 2))
}
