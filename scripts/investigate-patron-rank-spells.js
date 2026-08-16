/*
 * Confirms, ahead of build order step 6's Hexblade/Fathomless patron-spell
 * follow-up (D46): the exact `expanded` shape all three Warlock patrons
 * (Celestial, Hexblade, Fathomless) use, whether Celestial ALSO carries a
 * fixed grant under a different key (the "already-handled shape" the task
 * brief refers to), and the Warlock Pact Magic pactSlotsByLevel table so the
 * rank->level mapping can be read off it directly. Trimmed output only
 * (CLAUDE.md).
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass' && c.className === 'Warlock')

function showPatron(nameMatch) {
	const s = subclasses.find((c) => nameMatch.test(c.name))
	if (!s) {
		console.log(nameMatch, '-> NOT FOUND')
		return
	}
	console.log('\n===', s.name, '(source', s.source, ') additionalSpells entries:', s.additionalSpells?.length)
	for (const entry of s.additionalSpells || []) {
		console.log('  entry keys:', Object.keys(entry))
		for (const key of ['prepared', 'known', 'innate', 'expanded']) {
			if (!(key in entry)) continue
			console.log('   ', key, ':', JSON.stringify(entry[key]).slice(0, 300))
		}
	}
}

showPatron(/Celestial/)
showPatron(/Hexblade/)
showPatron(/Fathomless/)

console.log('\n=== Warlock base class: Pact Magic slot table (classTableGroups) ===')
const warlock = classes.find((c) => c.entryType === 'class' && c.name === 'Warlock')
console.log('casterProgression:', warlock.casterProgression)
const groups = warlock.classTableGroups || []
for (const g of groups) {
	console.log('title:', g.title, '| colLabels:', JSON.stringify(g.colLabels))
	if (JSON.stringify(g.colLabels).match(/Slot Level|Spell Slots/)) {
		console.log('  rows (level: row):')
		g.rows.forEach((row, i) => console.log('   level', i + 1, ':', JSON.stringify(row)))
	}
}
