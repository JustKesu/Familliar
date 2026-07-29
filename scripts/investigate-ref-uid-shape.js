// What does a ref* node's uid string look like, and how does it map onto
// the `id` field already on class-features.json / subclass-features.json /
// optional-features.json / feats.json entries (D33)? Needed to write the
// resolver's lookup key derivation.
const { readFileSync } = require('node:fs')

function loadJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'))
}

const REF_FIELD = {
	refClassFeature: 'classFeature',
	refSubclassFeature: 'subclassFeature',
	refOptionalfeature: 'optionalfeature',
	refFeat: 'feat',
}

function isObj(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function entryBody(node) {
	if (Array.isArray(node.entries)) return node.entries
	if (node.entry !== undefined) return [node.entry]
	return []
}

const samples = { refClassFeature: [], refSubclassFeature: [], refOptionalfeature: [], refFeat: [] }

function walk(node) {
	if (Array.isArray(node)) {
		for (const item of node) walk(item)
		return
	}
	if (!isObj(node)) return
	if (REF_FIELD[node.type] && samples[node.type].length < 4) {
		samples[node.type].push(node[REF_FIELD[node.type]])
	}
	for (const body of entryBody(node)) walk(body)
	if (Array.isArray(node.items)) walk(node.items)
	if (Array.isArray(node.rows)) walk(node.rows)
}

for (const path of ['data/class-features.json', 'data/subclass-features.json']) {
	const data = loadJson(path)
	for (const feature of data) walk(feature.entries ?? [])
}

console.log('SUMMARY — ref uid samples')
console.log(JSON.stringify(samples, null, 2))

const cf = loadJson('data/class-features.json')
const scf = loadJson('data/subclass-features.json')
const of = loadJson('data/optional-features.json')
const feats = loadJson('data/feats.json')

console.log('\nclass-features.json[0] keys:', Object.keys(cf[0]))
console.log('class-features.json[0] id:', cf[0].id)
console.log('\nsubclass-features.json[0] keys:', Object.keys(scf[0]))
console.log('subclass-features.json[0] id:', scf[0].id)
console.log('\noptional-features.json[0] keys:', Object.keys(of[0]))
console.log('optional-features.json[0] name/source:', of[0].name, of[0].source)
console.log('\nfeats.json[0] keys:', Object.keys(feats[0]))
console.log('feats.json[0] name/source/category:', feats[0].name, feats[0].source, feats[0].category)
