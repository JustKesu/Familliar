/*
 * Follow-up to investigate-spell-usage-wrappers.js: Mask of Many Faces (the
 * task's own motivating example) turned out to have NO wrapper key at all in
 * additionalSpells (`innate._: ["disguise self|xphb"]`, flat) even though its
 * prose entry says "without expending a spell slot" — contradicting the
 * premise that the usage info sits in a structured wrapper for every grant.
 * This script lists every optional-features.json entry with additionalSpells,
 * pairing its additionalSpells shape (wrapped or bare) against its own prose
 * entries, to see whether "bare" correlates with any consistent real-world
 * meaning for this consumer specifically. Entries text trimmed to 200 chars.
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

function isRecord(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate']

const optionalFeatures = load('optional-features.json')
const withSpells = optionalFeatures.filter((f) => Array.isArray(f.additionalSpells) && f.additionalSpells.length > 0)

console.log('SUMMARY:', withSpells.length, 'optional-features.json entries carry additionalSpells\n')

for (const f of withSpells) {
	const shapes = []
	for (const entry of f.additionalSpells) {
		if (!isRecord(entry)) continue
		for (const key of FIXED_GRANT_KEYS) {
			const levelMap = entry[key]
			if (!isRecord(levelMap)) continue
			for (const [levelKey, value] of Object.entries(levelMap)) {
				if (Array.isArray(value)) {
					shapes.push(`${key}.${levelKey}=bare(${value.length})`)
				} else if (isRecord(value)) {
					shapes.push(`${key}.${levelKey}=wrapped(${Object.keys(value).join('+')})`)
				}
			}
		}
	}
	const prose = Array.isArray(f.entries) ? f.entries.filter((e) => typeof e === 'string').join(' ').slice(0, 200) : ''
	console.log(`${f.name} [${(f.featureType || []).join(',')}]`)
	console.log('  shape:', shapes.join(', ') || '(none)')
	console.log('  prose:', prose)
	console.log()
}
