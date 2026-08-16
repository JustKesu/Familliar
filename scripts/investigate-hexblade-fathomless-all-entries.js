/*
 * Celestial turned out to have TWO subclass entries (XGE reprint with
 * rank-keyed `expanded`, and an XPHB entry with class-level-keyed `prepared`
 * that this app actually selects per D27's classSource-first join). Checks
 * whether Hexblade and Fathomless also have an XPHB entry with an
 * already-handled shape, which would mean there's nothing left to build.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

function showAll(nameMatch) {
	const found = classes.filter((c) => c.entryType === 'subclass' && c.className === 'Warlock' && nameMatch.test(c.name))
	console.log('\n=== matches for', nameMatch, ':', found.length)
	for (const s of found) {
		console.log('--- name:', s.name, '| source:', s.source, '| classSource:', s.classSource)
		for (const entry of s.additionalSpells || []) {
			console.log(' entry keys:', Object.keys(entry))
			for (const key of ['prepared', 'known', 'innate', 'expanded']) {
				if (key in entry) console.log('  ', key, ':', JSON.stringify(entry[key]).slice(0, 200))
			}
		}
	}
}

showAll(/Hexblade/)
showAll(/Fathomless/)
