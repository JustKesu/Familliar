/*
 * A 5etools `options` node is not automatically a player choice — it is also
 * a plain container for sub-parts the character receives ALL of. The node's
 * `count` field is what distinguishes the two. Prints, per feature, whether
 * its options node carries a count and what value.
 *
 * Run: node scripts/investigate-options-count.js
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

function withOptionsNodes(features) {
	const out = []
	for (const f of features) {
		const nodes = []
		findNodesOfType(f.entries, 'options', nodes)
		if (nodes.length > 0) out.push({ feature: f, node: nodes[0] })
	}
	return out
}

const hits = [
	...withOptionsNodes(classFeatures).map((h) => ({ ...h, kind: 'class' })),
	...withOptionsNodes(subclassFeatures).map((h) => ({ ...h, kind: 'subclass' })),
]

console.log('feature | class(/subclass) | level | optionCount | count field')
console.log('-'.repeat(78))
for (const { feature: f, node, kind } of hits) {
	const where = kind === 'class' ? f.className : `${f.className}/${f.subclassShortName}`
	const hasCount = Object.prototype.hasOwnProperty.call(node, 'count')
	const countText = hasCount ? `count=${JSON.stringify(node.count)}` : 'NO count field'
	console.log(`${f.name} | ${where} | L${f.level} | ${(node.entries || []).length} options | ${countText}`)
}

console.log('')
const withCount = hits.filter((h) => Object.prototype.hasOwnProperty.call(h.node, 'count'))
console.log(`features whose options node HAS a count (=> a real choice): ${withCount.length}`)
console.log(`features whose options node has NO count (=> receives all): ${hits.length - withCount.length}`)
console.log(`distinct count values: ${JSON.stringify([...new Set(withCount.map((h) => h.node.count))])}`)
