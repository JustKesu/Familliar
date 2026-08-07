const fs = require('fs')
const path = require('path')
const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass')
const alchemist = subclasses.filter((c) => c.className === 'Artificer' && /Alchemist/.test(c.name))
for (const s of alchemist) {
	console.log('subclass source:', s.source, 'classSource:', s.classSource)
	for (const entry of s.additionalSpells) {
		console.log(' entry keys:', Object.keys(entry))
		if (entry.innate) console.log('  innate:', JSON.stringify(entry.innate).slice(0, 200))
	}
}
