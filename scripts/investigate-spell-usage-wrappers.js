/*
 * D46 investigation ahead of the usage-terms task: subclassPreparedSpells.ts's
 * extractRefs (reused by featSpells.ts and optionalFeatureSpells.ts) already
 * unwraps a `will`/`daily`/`ritual`/`resource` wrapper recursively and throws
 * the key away. This script surveys every wrapper key that actually occurs
 * under `additionalSpells`'s prepared/known/innate level values, across all
 * three consumers, plus `daily`'s exact sub-key shapes (5etools distinguishes
 * "N" = N/day total from "Ne" = N/day EACH spell in the list by the key).
 * Trimmed output only (CLAUDE.md): counts plus up to 3 short examples per shape.
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate']

function isRecord(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isFlatSpellArray(v) {
	return Array.isArray(v) && v.every((item) => typeof item === 'string')
}

// wrapperKey -> { count, examples: [{source, entryName, level, subkeys}] }
const wrapperKeyCounts = new Map()
// daily sub-key (e.g. "1", "2e") -> { count, examples }
const dailySubkeyCounts = new Map()

function record(map, key, example) {
	if (!map.has(key)) map.set(key, { count: 0, examples: [] })
	const bucket = map.get(key)
	bucket.count++
	if (bucket.examples.length < 3) bucket.examples.push(example)
}

function inspectLevelValue(value, sourceLabel, entryName, levelKey) {
	if (isFlatSpellArray(value)) return // no wrapper — the ordinary case
	if (!isRecord(value)) return // some other unhandled shape, not this survey's concern
	for (const [wrapperKey, wrapperValue] of Object.entries(value)) {
		record(wrapperKeyCounts, wrapperKey, { sourceLabel, entryName, levelKey, sample: JSON.stringify(wrapperValue).slice(0, 100) })
		if (wrapperKey === 'daily' && isRecord(wrapperValue)) {
			for (const subkey of Object.keys(wrapperValue)) {
				record(dailySubkeyCounts, subkey, { sourceLabel, entryName, levelKey, sample: JSON.stringify(wrapperValue[subkey]).slice(0, 80) })
			}
		}
	}
}

function walkAdditionalSpells(additionalSpells, sourceLabel, entryName) {
	if (!Array.isArray(additionalSpells)) return
	for (const entry of additionalSpells) {
		if (!isRecord(entry)) continue
		for (const key of FIXED_GRANT_KEYS) {
			const levelMap = entry[key]
			if (!isRecord(levelMap)) continue
			for (const [levelKey, value] of Object.entries(levelMap)) {
				inspectLevelValue(value, sourceLabel, entryName, `${key}.${levelKey}`)
			}
		}
	}
}

const optionalFeatures = load('optional-features.json')
for (const entry of optionalFeatures) {
	walkAdditionalSpells(entry.additionalSpells, 'optional-features.json', entry.name)
}

const classes = load('classes.json')
for (const entry of classes.filter((c) => c.entryType === 'subclass')) {
	walkAdditionalSpells(entry.additionalSpells, 'classes.json (subclass)', `${entry.className} - ${entry.name}`)
}

const feats = load('feats.json')
for (const entry of feats) {
	walkAdditionalSpells(entry.additionalSpells, 'feats.json', entry.name)
}

console.log('=== wrapper keys found under a prepared/known/innate level value ===')
for (const [key, bucket] of wrapperKeyCounts) {
	console.log(`\n"${key}": ${bucket.count} occurrence(s)`)
	for (const ex of bucket.examples) {
		console.log(`   ${ex.sourceLabel} | ${ex.entryName} | ${ex.levelKey} -> ${ex.sample}`)
	}
}

console.log('\n=== "daily" sub-key shapes (the count/each key) ===')
for (const [subkey, bucket] of dailySubkeyCounts) {
	console.log(`\n"${subkey}": ${bucket.count} occurrence(s)`)
	for (const ex of bucket.examples) {
		console.log(`   ${ex.sourceLabel} | ${ex.entryName} | ${ex.levelKey} -> ${ex.sample}`)
	}
}
