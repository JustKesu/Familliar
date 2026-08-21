/*
 * Confirms, ahead of the resolveRef.ts fix: (1) "Dueling" and "Two-Weapon
 * Fighting" each match exactly one feats.json entry with category "FS", so a
 * source-less refOptionalfeature uid can resolve by name alone unambiguously
 * for these two; (2) they are still the only source-less refOptionalfeature
 * uids across class-features.json and subclass-features.json (D21's 74-uid
 * inventory), so the fix isn't quietly papering over a wider shape change.
 *
 * Run: node scripts/investigate-sourceless-optionalfeature-refs.js
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
}

function findRefOptionalfeatureUids(node, results) {
	if (Array.isArray(node)) {
		for (const child of node) findRefOptionalfeatureUids(child, results)
	} else if (node && typeof node === 'object') {
		if (node.type === 'refOptionalfeature' && typeof node.optionalfeature === 'string') {
			results.push(node.optionalfeature)
		}
		for (const key of Object.keys(node)) findRefOptionalfeatureUids(node[key], results)
	}
}

const feats = readJson('feats.json')
const classFeatures = readJson('class-features.json')
const subclassFeatures = readJson('subclass-features.json')

console.log('--- Part 1: do "Dueling" / "Two-Weapon Fighting" match exactly one FS feat each? ---')
for (const name of ['Dueling', 'Two-Weapon Fighting']) {
	const matches = feats.filter((f) => f.category === 'FS' && f.name === name)
	console.log(`  ${name}: ${matches.length} match(es) -> ${matches.map((m) => m.source).join(', ')}`)
}

console.log('\n--- Part 2: every refOptionalfeature uid across class/subclass features, by part count ---')
const uids = []
for (const f of classFeatures) findRefOptionalfeatureUids(f.entries, uids)
for (const f of subclassFeatures) findRefOptionalfeatureUids(f.entries, uids)

const sourceless = uids.filter((uid) => uid.split('|').length === 1)
console.log(`  total refOptionalfeature uids: ${uids.length}`)
console.log(`  source-less (1 part, no "|"): ${sourceless.length} -> ${[...new Set(sourceless)].join(', ')}`)
