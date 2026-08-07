/*
 * Follow-up to investigate-d6a-shapes.js: 5 subclasses had a `known`/`innate`
 * level-map value that was neither a flat array nor the Monk `{resource:...}`
 * wrapper ("other" bucket). Also inspects Warlock The Genie's multi-entry
 * (per genie-kind) additionalSpells shape and Warlock Archfey's non-numeric
 * innate level key. Trimmed output only (CLAUDE.md) — one representative
 * level's value per subclass, not the whole entry.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass')

function show(className, nameMatch, key) {
	const s = subclasses.find((c) => c.className === className && nameMatch.test(c.name))
	if (!s) {
		console.log(className, nameMatch, '-> NOT FOUND')
		return
	}
	console.log('\n===', s.className, '-', s.name, '(entries:', s.additionalSpells?.length, ')')
	for (const entry of s.additionalSpells || []) {
		if (!(key in entry)) continue
		console.log('  entry name field:', entry.name ?? '(none)')
		for (const [lvl, val] of Object.entries(entry[key])) {
			console.log('   ', key + '.' + lvl, ':', JSON.stringify(val).slice(0, 200))
		}
	}
}

show('Artificer', /Alchemist/, 'innate')
show('Barbarian', /Wild Heart/, 'innate')
show('Fighter', /Psi Warrior/, 'innate')
show('Warlock', /Fathomless/, 'known')
show('Warlock', /Archfey/, 'innate')

console.log('\n=== Warlock - The Genie: all additionalSpells entries (names + top-level keys only) ===')
const genie = subclasses.find((c) => c.className === 'Warlock' && /Genie/.test(c.name))
if (genie) {
	for (const entry of genie.additionalSpells) {
		console.log('  name:', entry.name, '| keys:', Object.keys(entry))
	}
}
