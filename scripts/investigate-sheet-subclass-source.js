// Ad-hoc check ahead of build order step 6 slice d4 (sheet spell display):
// Character.classes[].subclass stores only the subclass NAME (wizardState.ts
// line ~435), not its source. subclassPreparedSpells.ts's lookup needs both
// name+source to be unambiguous. This checks whether, within one class, two
// subclasses ever share the same name across different sources (which would
// make a name-only lookup ambiguous) — never prints whole entries.
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const subclasses = classes.filter((c) => c.entryType === 'subclass')
const byClassAndName = new Map()
for (const sc of subclasses) {
	const key = `${sc.className}|${sc.classSource}|${sc.name}`
	if (!byClassAndName.has(key)) byClassAndName.set(key, [])
	byClassAndName.get(key).push(sc.source)
}

const ambiguous = [...byClassAndName.entries()].filter(([, sources]) => sources.length > 1)

console.log('SUMMARY')
console.log('Total subclass entries:', subclasses.length)
console.log('Distinct (class, subclass name) keys:', byClassAndName.size)
console.log('Ambiguous keys (same class+name, >1 source):', ambiguous.length)
if (ambiguous.length > 0) {
	console.log('Examples:', ambiguous.slice(0, 3).map(([key, sources]) => ({ key, sources })))
}
