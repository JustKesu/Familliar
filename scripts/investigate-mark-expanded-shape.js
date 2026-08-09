// D46 step 6 slice: what shape does a Mark of ... feat's additionalSpells.expanded carry?
const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))

const marks = feats.filter((f) => typeof f.name === 'string' && f.name.startsWith('Mark of '))

const examples = []
const expandedShapes = new Set()
const noExpanded = []

for (const mark of marks) {
	if (!Array.isArray(mark.additionalSpells)) {
		noExpanded.push(mark.name + ' (no additionalSpells at all)')
		continue
	}
	for (const entry of mark.additionalSpells) {
		if (!entry || typeof entry !== 'object') continue
		if (entry.expanded === undefined) {
			noExpanded.push(mark.name)
			continue
		}
		expandedShapes.add(JSON.stringify(entry.expanded))
		if (examples.length < 3) {
			examples.push({ name: mark.name, expanded: entry.expanded, ability: entry.ability, prepared: entry.prepared, known: entry.known })
		}
	}
}

console.log('SUMMARY')
console.log('total marks:', marks.length)
console.log('marks missing expanded:', noExpanded)
console.log('distinct expanded shapes:', expandedShapes.size)
for (const shape of expandedShapes) {
	console.log('  shape:', shape)
}
console.log('examples:', JSON.stringify(examples, null, 2))
