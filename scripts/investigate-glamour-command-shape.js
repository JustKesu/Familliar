/*
 * Sanity check: is College of Glamour's `innate.6` "Command" grant (the
 * bare-innate subclass case) genuinely wrapper-less despite the real 2014
 * Mantle of Majesty feature being usage-limited (proficiency-bonus times per
 * day)? Confirms whether "bare innate" can mean a genuinely limited-but-
 * unencoded grant for a subclass, as opposed to an unlimited one.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'classes.json'), 'utf8'))
const glamour = classes.filter((c) => c.entryType === 'subclass' && /Glamour/.test(c.name))
for (const s of glamour) {
	console.log(s.name, s.source)
	for (const entry of s.additionalSpells || []) {
		console.log('  prepared:', JSON.stringify(entry.prepared))
		console.log('  innate:', JSON.stringify(entry.innate))
	}
}

console.log('\n--- Path of the Ancestral Guardian, innate.10 (other bare-innate subclass case) ---')
const ancestral = classes.find((c) => c.entryType === 'subclass' && /Ancestral Guardian/.test(c.name))
if (ancestral) {
	for (const entry of ancestral.additionalSpells || []) {
		console.log('  innate:', JSON.stringify(entry.innate))
	}
}
