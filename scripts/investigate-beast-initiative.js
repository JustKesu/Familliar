/*
 * R11a pre-check: the shape of beasts.json's untyped `initiative` field.
 * SUMMARY ONLY — counts and at most 3 short examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const beasts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'beasts.json'), 'utf8'))

const shapes = new Map()
for (const beast of beasts) {
	const value = beast.initiative
	const key = value === undefined ? 'absent' : typeof value === 'object' ? `object{${Object.keys(value).sort().join(',')}}` : typeof value
	shapes.set(key, [...(shapes.get(key) ?? []), beast])
}
console.log('beasts total:', beasts.length)
for (const [key, group] of shapes) {
	console.log(`${key}: ${group.length}`)
	group.slice(0, 3).forEach((beast) => console.log(`  ${beast.name} dex ${beast.dex} -> ${JSON.stringify(beast.initiative)}`))
}
