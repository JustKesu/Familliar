/*
 * The user reports the running app already shows Celestial's leveled patron
 * spells (Cure Wounds, Guiding Bolt, Aid, Lesser Restoration, Daylight,
 * Revivify) as always-prepared, which doesn't match the single XGE Celestial
 * subclass entry found so far (whose `expanded` is unhandled and whose
 * `known` is cantrips-only). Checks for a SECOND Celestial subclass entry
 * (different source) or a different shape being read elsewhere.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const celestials = classes.filter((c) => c.entryType === 'subclass' && c.className === 'Warlock' && /Celestial/.test(c.name))
console.log('Celestial subclass entries found:', celestials.length)
for (const s of celestials) {
	console.log('\n--- name:', s.name, '| source:', s.source, '| classSource:', s.classSource)
	console.log('additionalSpells entries:', s.additionalSpells?.length)
	for (const entry of s.additionalSpells || []) {
		console.log(' entry keys:', Object.keys(entry))
		for (const key of ['prepared', 'known', 'innate', 'expanded']) {
			if (key in entry) console.log('  ', key, ':', JSON.stringify(entry[key]).slice(0, 300))
		}
	}
}
