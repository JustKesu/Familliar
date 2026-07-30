/*
 * D46 investigation ahead of the second calculation slice: speed/size/
 * darkvision shape across species (and whether it's consistent across
 * XPHB/MPMM/EFA sources), where classes.json stores hit die, and how
 * Jack of All Trades (Bard) is represented in class-features.json.
 */
const fs = require('fs')

const species = JSON.parse(fs.readFileSync('data/species.json', 'utf8'))
const classes = JSON.parse(fs.readFileSync('data/classes.json', 'utf8'))
const classFeatures = JSON.parse(fs.readFileSync('data/class-features.json', 'utf8'))

function summarizeField(list, field) {
	const present = list.filter((e) => e[field] !== undefined)
	const missing = list.filter((e) => e[field] === undefined)
	const shapesBySource = {}
	for (const e of present) {
		const src = e.source ?? 'unknown'
		shapesBySource[src] = shapesBySource[src] || new Set()
		shapesBySource[src].add(JSON.stringify(typeof e[field] === 'object' ? Object.keys(e[field]).sort() : typeof e[field]))
	}
	return { presentCount: present.length, missingCount: missing.length, missingExamples: missing.slice(0, 3).map((e) => `${e.name} (${e.source})`), shapesBySource: Object.fromEntries(Object.entries(shapesBySource).map(([k, v]) => [k, [...v]])) }
}

console.log('=== species total:', species.length)
console.log('=== speed ===', JSON.stringify(summarizeField(species, 'speed'), null, 2))
console.log('=== size ===', JSON.stringify(summarizeField(species, 'size'), null, 2))
console.log('=== darkvision ===', JSON.stringify(summarizeField(species, 'darkvision'), null, 2))

console.log('\n=== speed examples ===')
for (const s of species.slice(0, 3)) console.log(s.name, s.source, JSON.stringify(s.speed))

console.log('\n=== size examples (distinct shapes) ===')
const sizeShapes = new Map()
for (const s of species) {
	const key = JSON.stringify(s.size)
	if (!sizeShapes.has(key)) sizeShapes.set(key, s.name)
}
console.log([...sizeShapes.entries()].slice(0, 6))

console.log('\n=== darkvision examples ===')
for (const s of species.filter((s) => s.darkvision !== undefined).slice(0, 3)) console.log(s.name, s.source, s.darkvision)

console.log('\n=== hit die: classes.json field names ===')
console.log('classes total:', classes.length)
const hdKeys = new Set()
for (const c of classes) {
	for (const k of Object.keys(c)) if (/hit|hd/i.test(k)) hdKeys.add(k)
}
console.log('candidate keys:', [...hdKeys])
for (const c of classes.slice(0, 3)) console.log(c.name, c.source, JSON.stringify(c.hd))

console.log('\n=== Jack of All Trades in class-features.json ===')
const joat = classFeatures.filter((f) => f.name && f.name.toLowerCase().includes('jack of all trades'))
console.log('matches:', joat.length)
for (const f of joat.slice(0, 3)) console.log(JSON.stringify({ name: f.name, className: f.className, classSource: f.classSource, level: f.level, source: f.source }))
