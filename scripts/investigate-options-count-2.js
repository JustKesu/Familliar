/*
 * Follow-up to investigate-options-count.js: the three Barbarian/Storm Herald
 * features were expected to be choices but carry no `count`. Checks whether
 * some OTHER field on the node (or its parent) marks the choice, and whether
 * the ref targets differ structurally between the count and no-count groups.
 * Key names and counts only — no entry text.
 *
 * Run: node scripts/investigate-options-count-2.js
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
}

function findNodesOfType(node, type, results) {
	if (Array.isArray(node)) {
		for (const n of node) findNodesOfType(n, type, results)
	} else if (node && typeof node === 'object') {
		if (node.type === type) results.push(node)
		for (const key of Object.keys(node)) findNodesOfType(node[key], type, results)
	}
}

const classFeatures = readJson('class-features.json')
const subclassFeatures = readJson('subclass-features.json')

const hits = []
for (const f of [...classFeatures, ...subclassFeatures]) {
	const nodes = []
	findNodesOfType(f.entries, 'options', nodes)
	if (nodes.length > 0) hits.push({ feature: f, node: nodes[0] })
}

console.log('options-node key names, grouped by whether a count is present:')
const keySets = new Map()
for (const { node } of hits) {
	const hasCount = Object.prototype.hasOwnProperty.call(node, 'count')
	const key = `${hasCount ? 'WITH count' : 'NO count'}: ${Object.keys(node).sort().join(',')}`
	keySets.set(key, (keySets.get(key) || 0) + 1)
}
for (const [k, v] of keySets) console.log(`  ${k}  (${v} features)`)

console.log('')
console.log('the 6 features named in the task brief, and how the count test reads them:')
const NAMED = ['Divine Order', 'Primal Order', 'Elemental Fury', 'Storm Aura', 'Storm Soul', 'Raging Storm']
for (const name of NAMED) {
	const h = hits.find((x) => x.feature.name === name)
	if (!h) {
		console.log(`  ${name}: NOT FOUND`)
		continue
	}
	const hasCount = Object.prototype.hasOwnProperty.call(h.node, 'count')
	console.log(`  ${name}: ${hasCount ? `count=${h.node.count} -> choice` : 'no count -> receives all'}`)
}

console.log('')
console.log('does the FEATURE text around a no-count node say "choose"/"chosen"? (word check only)')
for (const { feature: f, node } of hits) {
	if (Object.prototype.hasOwnProperty.call(node, 'count')) continue
	const text = JSON.stringify(f.entries).toLowerCase()
	const words = ['choose', 'chosen', 'you choose', 'select']
	const found = words.filter((w) => text.includes(w))
	const where = f.subclassShortName ? `${f.className}/${f.subclassShortName}` : f.className
	console.log(`  ${f.name} (${where} L${f.level}): ${found.length ? found.join(',') : 'none of choose/chosen/select'}`)
}
