/*
 * Which CLASS features carrying a counted `options` node are alternate-FEATURE
 * choices (this picker's job) versus optionalfeatureProgression options the
 * existing ClassOptionalFeaturePicker already owns? Checks whether the ref*
 * KIND inside the options node separates them cleanly, so the picker can key
 * off structure rather than a hardcoded feature list.
 *
 * Run: node scripts/investigate-class-feature-choice-kind.js
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

console.log('CLASS features with a counted options node — ref kinds inside:')
let refClassFeatureOnly = 0
let otherKindOnly = 0
let mixed = 0
for (const f of classFeatures) {
	const nodes = []
	findNodesOfType(f.entries, 'options', nodes)
	if (nodes.length === 0) continue
	const node = nodes[0]
	if (!Object.prototype.hasOwnProperty.call(node, 'count')) continue
	const kinds = [...new Set((node.entries || []).map((e) => (e && typeof e === 'object' ? e.type : typeof e)))]
	const onlyClassFeature = kinds.length === 1 && kinds[0] === 'refClassFeature'
	if (onlyClassFeature) refClassFeatureOnly++
	else if (kinds.includes('refClassFeature')) mixed++
	else otherKindOnly++
	console.log(`  ${f.name} (${f.className} L${f.level}, count=${node.count}) -> ${kinds.join(',')}`)
}

console.log('')
console.log(`options entirely refClassFeature (alternate-feature choice): ${refClassFeatureOnly}`)
console.log(`options with no refClassFeature at all (progression options):  ${otherKindOnly}`)
console.log(`MIXED (would break the discriminator):                        ${mixed}`)
