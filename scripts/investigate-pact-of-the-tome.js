/*
 * Build order step 6a, Pact of the Tome picker (D46): read the option's
 * `choose` grant exactly as the data expresses it, before writing anything.
 * Questions that decide the picker's shape:
 *   1. The exact filter strings, verbatim.
 *   2. The pick COUNTS as the data states them — not as the rules text does.
 *   3. Does the cantrip node carry a class clause at all, or is it unfiltered
 *      across every class's list?
 *   4. Which grant key each node sits under, and the `ability` field.
 * Also sizes the candidate pools, since an unfiltered "any cantrip" list is a
 * very different picker from a class-scoped one.
 * SUMMARY ONLY — counts and at most 3 examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
function load(file) {
	return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

const optionalFeatures = load('optional-features.json')
const tome = optionalFeatures.find((entry) => entry.name === 'Pact of the Tome')

console.log('=== 1-2-4. Pact of the Tome additionalSpells, verbatim ===')
console.log(JSON.stringify(tome.additionalSpells, null, 2))

console.log('')
console.log('=== per-node breakdown ===')
for (const block of tome.additionalSpells ?? []) {
	for (const [grantKey, grantValue] of Object.entries(block)) {
		if (grantKey === 'ability') {
			console.log(`  ability = ${JSON.stringify(grantValue)}`)
			continue
		}
		if (grantKey === 'name') continue
		for (const [levelKey, nodes] of Object.entries(grantValue)) {
			for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
				if (typeof node === 'string') {
					console.log(`  ${grantKey}.${levelKey}: LITERAL ref ${node}`)
					continue
				}
				console.log(`  ${grantKey}.${levelKey}: choose=${JSON.stringify(node.choose)} count=${JSON.stringify(node.count)}`)
				// Question 3: does the filter carry a class clause?
				const clauses = String(node.choose).split('|')
				const keys = clauses.map((clause) => (clause.includes('=') ? clause.slice(0, clause.indexOf('=')) : clause))
				console.log(`      clause keys: ${JSON.stringify(keys)} — class clause present: ${keys.includes('class')}`)
			}
		}
	}
}

console.log('')
console.log('=== candidate pool sizes (what the picker would offer) ===')
const spells = load('spells.json')
const cantrips = spells.filter((s) => s.level === 0)
console.log('level-0 spells in this app’s data:', cantrips.length)
const levelOneRituals = spells.filter((s) => s.level === 1 && s.meta && s.meta.ritual === true)
console.log('level-1 ritual spells:', levelOneRituals.length)
console.log('  3 examples:', levelOneRituals.slice(0, 3).map((s) => `${s.name}|${s.source}`).join(', '))

console.log('')
console.log('=== who else has a BARE `level=` choose (no filter clause)? ===')
// The existing parser (featSpellChoiceData.ts parseChooseString) requires a filter
// clause after `level=`. Generalizing it to accept a bare one is only safe if nothing
// else in the data relies on such a string being rejected, so count them per file.
function chooseStringsIn(value, out) {
	if (Array.isArray(value)) {
		for (const item of value) chooseStringsIn(item, out)
		return
	}
	if (value === null || typeof value !== 'object') return
	if (typeof value.choose === 'string') out.push(value.choose)
	for (const nested of Object.values(value)) chooseStringsIn(nested, out)
	return out
}
for (const file of ['feats.json', 'classes.json', 'optional-features.json']) {
	const entries = load(file)
	const bare = []
	for (const entry of entries) {
		const found = []
		chooseStringsIn(entry.additionalSpells, found)
		for (const s of found) if (!s.includes('|')) bare.push(`${entry.name}: ${s}`)
	}
	console.log(`  ${file}: ${bare.length}`)
	for (const example of bare.slice(0, 3)) console.log(`      ${example}`)
}
