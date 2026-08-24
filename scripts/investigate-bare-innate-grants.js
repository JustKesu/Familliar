/*
 * Follow-up: does a BARE `innate` grant (no will/daily/resource/ritual
 * wrapper) mean something consistent across all three consumers, or is its
 * meaning consumer-specific? Lists every bare (flat-array) prepared/known/
 * innate level value across classes.json subclasses and feats.json, split by
 * grant key, so "bare innate" can be compared against "bare prepared"/"bare
 * known" for the SAME consumer. Counts only, 3 examples per bucket.
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

function survey(entries, label) {
	const buckets = new Map() // "key:bare"|"key:wrapped" -> {count, examples}
	for (const entry of entries) {
		if (!Array.isArray(entry.additionalSpells)) continue
		for (const block of entry.additionalSpells) {
			if (!isRecord(block)) continue
			for (const key of FIXED_GRANT_KEYS) {
				const levelMap = block[key]
				if (!isRecord(levelMap)) continue
				for (const [levelKey, value] of Object.entries(levelMap)) {
					const isBare = Array.isArray(value) && value.every((v) => typeof v === 'string')
					const bucketKey = `${key}:${isBare ? 'bare' : 'wrapped-or-other'}`
					if (!buckets.has(bucketKey)) buckets.set(bucketKey, { count: 0, examples: [] })
					const b = buckets.get(bucketKey)
					b.count++
					if (b.examples.length < 3) b.examples.push(`${entry.name} (${entry.source}) ${key}.${levelKey}`)
				}
			}
		}
	}
	console.log(`\n=== ${label} ===`)
	for (const [bucketKey, b] of buckets) {
		console.log(`  ${bucketKey}: ${b.count}`)
		for (const ex of b.examples) console.log('    e.g.', ex)
	}
}

const classes = load('classes.json')
survey(classes.filter((c) => c.entryType === 'subclass'), 'classes.json subclasses')

const feats = load('feats.json')
survey(feats, 'feats.json')

const optionalFeatures = load('optional-features.json')
survey(optionalFeatures, 'optional-features.json')
