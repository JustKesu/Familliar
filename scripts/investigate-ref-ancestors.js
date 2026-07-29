const { readFileSync } = require('node:fs')
function loadJson(p) { return JSON.parse(readFileSync(p, 'utf8')) }
const REF_TYPES = new Set(['refClassFeature', 'refSubclassFeature', 'refOptionalfeature', 'refFeat'])
function isObj(v) { return typeof v === 'object' && v !== null && !Array.isArray(v) }
function entryBody(node) {
	if (Array.isArray(node.entries)) return node.entries
	if (node.entry !== undefined) return [node.entry]
	return []
}
const ancestorChains = new Set()
function walk(node, chain) {
	if (Array.isArray(node)) { for (const it of node) walk(it, chain); return }
	if (!isObj(node)) return
	if (typeof node.type === 'string' && REF_TYPES.has(node.type)) {
		ancestorChains.add(chain.join('>'))
		return
	}
	const nextChain = node.type ? [...chain, node.type] : [...chain, '(entries/undefined)']
	for (const body of entryBody(node)) walk(body, nextChain)
	if (Array.isArray(node.items)) walk(node.items, [...chain, (node.type||'?') + '.items'])
	if (Array.isArray(node.rows)) walk(node.rows, [...chain, (node.type||'?') + '.rows'])
}
for (const path of ['data/class-features.json', 'data/subclass-features.json']) {
	const data = loadJson(path)
	for (const f of data) walk(f.entries ?? [], [])
}
console.log('SUMMARY - distinct ancestor chains leading to a ref node:')
console.log([...ancestorChains].join('\n'))
