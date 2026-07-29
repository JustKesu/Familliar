// Where do refClassFeature/refSubclassFeature/refOptionalfeature/refFeat
// nodes sit inside a feature's `entries` tree? Top-level, or nested inside
// list/table/options containers? Determines whether a resolver wrapping
// only the top-level array is enough, or whether it must walk the tree.
const { readFileSync } = require('node:fs')

const REF_TYPES = new Set(['refClassFeature', 'refSubclassFeature', 'refOptionalfeature', 'refFeat'])

function loadJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'))
}

let topLevel = 0
let nested = 0
const nestedExamples = []

function isObj(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function entryBody(node) {
	if (Array.isArray(node.entries)) return node.entries
	if (node.entry !== undefined) return [node.entry]
	return []
}

function walk(node, depth, path) {
	if (Array.isArray(node)) {
		for (const item of node) walk(item, depth, path)
		return
	}
	if (!isObj(node)) return
	if (typeof node.type === 'string' && REF_TYPES.has(node.type)) {
		if (depth === 0) {
			topLevel++
		} else {
			nested++
			if (nestedExamples.length < 3) nestedExamples.push({ path, depth, type: node.type })
		}
		return
	}
	for (const body of entryBody(node)) walk(body, depth + 1, path)
	if (Array.isArray(node.items)) walk(node.items, depth + 1, path)
	if (Array.isArray(node.rows)) walk(node.rows, depth + 1, path)
}

function scanFile(path) {
	const data = loadJson(path)
	for (const feature of data) {
		walk(feature.entries ?? [], 0, `${path}:${feature.name ?? '?'}`)
	}
}

scanFile('data/class-features.json')
scanFile('data/subclass-features.json')

console.log('SUMMARY')
console.log('top-level ref nodes (direct child of feature.entries):', topLevel)
console.log('nested ref nodes (inside list/entries/table/options):', nested)
console.log('examples of nested:', JSON.stringify(nestedExamples, null, 2))
