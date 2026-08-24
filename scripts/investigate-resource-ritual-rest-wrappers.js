/*
 * Follow-up to investigate-spell-usage-wrappers.js: checks what the
 * `resource`, `ritual`, and `rest` wrappers actually mean by pairing each
 * with its entry-level metadata (resourceName, ability) and, for the
 * subclass/feat cases, the relevant class-features.json prose if easy to
 * find. Trimmed output only (CLAUDE.md).
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

console.log('--- Monk subclasses with a `resource` wrapper: entry-level fields ---')
const classes = load('classes.json')
for (const s of classes.filter((c) => c.entryType === 'subclass' && c.className === 'Monk' && /Sun Soul|Warrior of Shadow/.test(c.name))) {
	for (const entry of s.additionalSpells || []) {
		if (!entry.innate) continue
		console.log(s.name, s.source, '| ability:', entry.ability, '| resourceName:', entry.resourceName)
		for (const [lvl, val] of Object.entries(entry.innate)) {
			console.log('   innate.' + lvl, ':', JSON.stringify(val))
		}
	}
}

console.log('\n--- Pact of the Chain: full additionalSpells entry (ritual wrapper) ---')
const optionalFeatures = load('optional-features.json')
const chain = optionalFeatures.find((f) => f.name === 'Pact of the Chain')
console.log(chain ? JSON.stringify(chain.additionalSpells) : 'NOT FOUND')

console.log('\n--- Path of the Wild Heart: full additionalSpells entry (ritual wrapper, subclass) ---')
const wildHeart = classes.find((c) => c.entryType === 'subclass' && c.className === 'Barbarian' && /Wild Heart/.test(c.name))
console.log(wildHeart ? JSON.stringify(wildHeart.additionalSpells) : 'NOT FOUND')

console.log('\n--- Aberrant Dragonmark: full additionalSpells entry (rest wrapper) + ability/resourceName ---')
const feats = load('feats.json')
const dragonmark = feats.find((f) => f.name === 'Aberrant Dragonmark')
if (dragonmark) {
	for (const entry of dragonmark.additionalSpells || []) {
		console.log('ability:', JSON.stringify(entry.ability), '| resourceName:', entry.resourceName)
		console.log('prepared:', JSON.stringify(entry.prepared))
	}
} else {
	console.log('NOT FOUND')
}
console.log('prose:', (dragonmark.entries || []).filter((e) => typeof e === 'string').join(' ').slice(0, 400))
