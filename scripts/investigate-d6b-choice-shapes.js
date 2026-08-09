/*
 * D46 investigation for step 6 slice (d6b): exact per-subclass choose-node
 * shape (grant level, count, filter string) for the 5 subclasses classified
 * as CHOICE by investigate-subclass-spell-shapes.js.
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass')

const targets = [
	{ className: 'Bard', nameMatch: /Lore/i },
	{ className: 'Wizard', nameMatch: /Abjurer/i },
	{ className: 'Wizard', nameMatch: /Diviner/i },
	{ className: 'Wizard', nameMatch: /Evoker/i },
	{ className: 'Wizard', nameMatch: /Illusionist/i },
]

for (const t of targets) {
	const s = subclasses.find((sc) => sc.className === t.className && t.nameMatch.test(sc.name))
	console.log('\n===', t.className, '-', s ? s.name : 'NOT FOUND', '===')
	if (!s) continue
	console.log('shortName:', s.shortName, 'source:', s.source)
	console.log('additionalSpells:', JSON.stringify(s.additionalSpells))
}
