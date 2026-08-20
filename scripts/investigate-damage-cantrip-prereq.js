/*
 * Build order step 6a, slice 2 (D46): confirm three data shapes before the
 * picker relies on them.
 *   1. spells.json `damageInflict` — does it exist, what type, non-empty on
 *      damaging cantrips and absent/empty on non-damaging ones?
 *   2. The `choose` form of an optional feature's `spell` prerequisite — how
 *      many entries, and what does the filter actually say?
 *   3. Does a CLASS optionalfeatureProgression entry carry a display `name`
 *      the sheet can use as a heading?
 * SUMMARY ONLY — counts and at most 3 examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'public', 'data')
function load(file) {
	return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

const spells = load('spells.json')
const optionalFeatures = load('optional-features.json')
const classes = load('classes.json')

console.log('=== 1. spells.json damageInflict ===')
console.log('total spells:', spells.length)
const withField = spells.filter((s) => s.damageInflict !== undefined)
console.log('with damageInflict:', withField.length)
console.log('types seen:', [...new Set(withField.map((s) => (Array.isArray(s.damageInflict) ? 'array' : typeof s.damageInflict)))].join(', '))
console.log('empty arrays:', withField.filter((s) => Array.isArray(s.damageInflict) && s.damageInflict.length === 0).length)
const cantrips = spells.filter((s) => s.level === 0)
console.log('cantrips total:', cantrips.length)
console.log('cantrips with non-empty damageInflict:', cantrips.filter((s) => Array.isArray(s.damageInflict) && s.damageInflict.length > 0).length)
for (const name of ['Eldritch Blast', 'Prestidigitation', 'Fire Bolt']) {
	const found = cantrips.find((s) => s.name === name)
	console.log(`  ${name}: level=${found ? found.level : '?'} damageInflict=${found ? JSON.stringify(found.damageInflict) : 'NOT FOUND'}`)
}

console.log('')
console.log('=== 2. `choose` form of a spell prerequisite ===')
const chooseEntries = []
for (const entry of optionalFeatures) {
	for (const alt of entry.prerequisite ?? []) {
		for (const req of alt.spell ?? []) {
			if (req && typeof req === 'object') chooseEntries.push({ option: entry.name, req })
		}
	}
}
console.log('options carrying a `choose` spell prerequisite:', chooseEntries.length)
console.log('distinct serialised filters:', new Set(chooseEntries.map((e) => JSON.stringify(e.req))).size)
console.log('option names:', chooseEntries.map((e) => e.option).join(', '))
for (const e of chooseEntries.slice(0, 3)) console.log('  example:', e.option, '->', JSON.stringify(e.req))

console.log('')
console.log('=== 3. class optionalfeatureProgression display name ===')
for (const c of classes) {
	if (c.entryType !== 'class' || !c.optionalfeatureProgression) continue
	for (const p of c.optionalfeatureProgression) {
		console.log(`  ${c.name}|${c.source}: name=${JSON.stringify(p.name)} featureType=${JSON.stringify(p.featureType)}`)
	}
}
