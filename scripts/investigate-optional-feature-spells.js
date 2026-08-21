/*
 * Build order step 6a, final slice part 1 (D46): confirm the shape of
 * `additionalSpells` on OPTIONAL FEATURES before writing the extractor.
 * Two questions decide everything downstream:
 *   1. Which additionalSpells KEYS occur (known/innate/prepared/expanded/
 *      something else), and is the level key the "_" wrapper feats use or a
 *      real class-level key?
 *   2. What does `ability` hold — a named ability, the literal "inherit", a
 *      choice object, or nothing?
 * Also reports which featureType codes carry them, so the caller knows which
 * are reachable through a class/subclass progression at all.
 * SUMMARY ONLY — counts and at most 3 examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
function load(file) {
	return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

const optionalFeatures = load('optional-features.json')

const carrying = optionalFeatures.filter((entry) => entry.additionalSpells !== undefined)

console.log('=== scope ===')
console.log('optional-features.json entries:', optionalFeatures.length)
console.log('carrying additionalSpells:', carrying.length)
console.log('array lengths seen:', [...new Set(carrying.map((e) => (Array.isArray(e.additionalSpells) ? e.additionalSpells.length : 'NOT-ARRAY')))].join(', '))

console.log('')
console.log('=== featureType codes carrying them ===')
const byType = {}
for (const entry of carrying) {
	for (const code of entry.featureType ?? []) byType[code] = (byType[code] ?? 0) + 1
}
for (const [code, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${code}: ${count}`)

console.log('')
console.log('=== 1. additionalSpells outer keys ===')
const outerKeys = {}
for (const entry of carrying) {
	for (const block of entry.additionalSpells ?? []) {
		for (const key of Object.keys(block)) outerKeys[key] = (outerKeys[key] ?? 0) + 1
	}
}
for (const [key, count] of Object.entries(outerKeys).sort((a, b) => b[1] - a[1])) console.log(`  ${key}: ${count}`)

console.log('')
console.log('=== level keys under each grant key (is it "_" or a class level?) ===')
const levelKeys = {}
for (const entry of carrying) {
	for (const block of entry.additionalSpells ?? []) {
		for (const [grantKey, grantValue] of Object.entries(block)) {
			if (grantKey === 'ability' || grantKey === 'name') continue
			if (grantValue === null || typeof grantValue !== 'object') continue
			for (const levelKey of Object.keys(grantValue)) {
				const composite = `${grantKey}.${levelKey}`
				levelKeys[composite] = (levelKeys[composite] ?? 0) + 1
			}
		}
	}
}
for (const [key, count] of Object.entries(levelKeys).sort((a, b) => b[1] - a[1])) console.log(`  ${key}: ${count}`)

console.log('')
console.log('=== 2. the `ability` field ===')
const abilityShapes = {}
for (const entry of carrying) {
	for (const block of entry.additionalSpells ?? []) {
		const raw = block.ability
		const shape =
			raw === undefined ? 'ABSENT' : typeof raw === 'string' ? `string:${raw}` : Array.isArray(raw) ? 'array' : `object:${Object.keys(raw).join('+')}`
		abilityShapes[shape] = (abilityShapes[shape] ?? 0) + 1
	}
}
for (const [shape, count] of Object.entries(abilityShapes).sort((a, b) => b[1] - a[1])) console.log(`  ${shape}: ${count}`)

console.log('')
console.log('=== 3 examples, whole additionalSpells value ===')
for (const entry of carrying.slice(0, 3)) {
	console.log(`  ${entry.name}|${entry.source} featureType=${JSON.stringify(entry.featureType)}`)
	console.log(`    ${JSON.stringify(entry.additionalSpells)}`)
}

console.log('')
console.log('=== do any two options grant the SAME spell? (provenance-merge case) ===')
const grants = new Map()
function refsIn(value) {
	if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
	if (value === null || typeof value !== 'object') return []
	return Object.values(value).flatMap(refsIn)
}
for (const entry of carrying) {
	for (const block of entry.additionalSpells ?? []) {
		for (const [grantKey, grantValue] of Object.entries(block)) {
			if (grantKey === 'ability' || grantKey === 'name') continue
			for (const ref of refsIn(grantValue)) {
				const spellName = ref.split('|')[0].split('#')[0].toLowerCase()
				if (!grants.has(spellName)) grants.set(spellName, new Set())
				grants.get(spellName).add(entry.name)
			}
		}
	}
}
const shared = [...grants.entries()].filter(([, owners]) => owners.size > 1)
console.log('distinct spells granted:', grants.size)
console.log('granted by more than one option:', shared.length)
for (const [spellName, owners] of shared.slice(0, 3)) console.log(`  ${spellName}: ${[...owners].join(', ')}`)

console.log('')
console.log('=== EI (invocations) ONLY — the reachable set, broken out ===')
const invocations = carrying.filter((entry) => (entry.featureType ?? []).includes('EI'))
console.log('EI options carrying additionalSpells:', invocations.length)
const eiKeys = {}
const eiAbility = {}
let nonStringGrantItems = 0
const nonStringExamples = []
for (const entry of invocations) {
	for (const block of entry.additionalSpells ?? []) {
		for (const [grantKey, grantValue] of Object.entries(block)) {
			if (grantKey === 'name') continue
			if (grantKey === 'ability') {
				const shape = typeof grantValue === 'string' ? `string:${grantValue}` : `object:${Object.keys(grantValue).join('+')}`
				eiAbility[shape] = (eiAbility[shape] ?? 0) + 1
				continue
			}
			eiKeys[grantKey] = (eiKeys[grantKey] ?? 0) + 1
			// A non-string item is a `choose` filter object — it would need a PICKER, not a derived grant.
			const walk = (value) => {
				if (Array.isArray(value)) {
					for (const item of value) {
						if (typeof item !== 'string') {
							nonStringGrantItems += 1
							if (nonStringExamples.length < 3) nonStringExamples.push(`${entry.name}: ${JSON.stringify(item)}`)
						}
					}
					return
				}
				if (value !== null && typeof value === 'object') for (const nested of Object.values(value)) walk(nested)
			}
			walk(grantValue)
		}
	}
}
console.log('  grant keys:', JSON.stringify(eiKeys))
console.log('  ability field present on:', Object.keys(eiAbility).length === 0 ? 'NONE (absent on every EI option)' : JSON.stringify(eiAbility))
console.log('  non-string grant items (choose objects needing a picker):', nonStringGrantItems)
for (const example of nonStringExamples) console.log(`    ${example}`)

console.log('')
console.log('=== EI options: one line each (grant key, ability, literal refs vs choose nodes) ===')
for (const entry of invocations) {
	const parts = []
	let chooseNodes = 0
	let ability = 'none'
	for (const block of entry.additionalSpells ?? []) {
		for (const [grantKey, grantValue] of Object.entries(block)) {
			if (grantKey === 'name') continue
			if (grantKey === 'ability') {
				ability = typeof grantValue === 'string' ? grantValue : JSON.stringify(grantValue)
				continue
			}
			const literals = refsIn(grantValue)
			const countNonString = (value) => {
				if (Array.isArray(value)) return value.filter((item) => typeof item !== 'string').length
				if (value !== null && typeof value === 'object') return Object.values(value).reduce((sum, nested) => sum + countNonString(nested), 0)
				return 0
			}
			chooseNodes += countNonString(grantValue)
			parts.push(`${grantKey}=[${literals.join(', ')}]`)
		}
	}
	console.log(`  ${entry.name}: ${parts.join(' ')} ability=${ability} chooseNodes=${chooseNodes}`)
}

console.log('')
console.log('=== EI grants: do they all resolve in spells.json, and what levels? ===')
const spells = load('spells.json')
const levelCounts = {}
const unresolved = []
for (const entry of invocations) {
	for (const block of entry.additionalSpells ?? []) {
		for (const [grantKey, grantValue] of Object.entries(block)) {
			if (grantKey === 'ability' || grantKey === 'name') continue
			for (const ref of refsIn(grantValue)) {
				const [namePart, sourcePart] = ref.split('|')
				const wantName = namePart.split('#')[0].toLowerCase()
				const wantSource = sourcePart ? sourcePart.split('#')[0].toUpperCase() : null
				const found = spells.find((s) => s.name.toLowerCase() === wantName && (wantSource === null || s.source.toUpperCase() === wantSource))
				if (!found) unresolved.push(`${entry.name} -> ${ref}`)
				else levelCounts[found.level] = (levelCounts[found.level] ?? 0) + 1
			}
		}
	}
}
console.log('  spell levels granted (level: count):', JSON.stringify(levelCounts))
console.log('  refs that do NOT resolve in spells.json:', unresolved.length)
for (const example of unresolved.slice(0, 3)) console.log(`    ${example}`)

console.log('')
console.log('=== does any single option list the same spell twice? (per-source dedupe case) ===')
let duplicatesWithinOption = 0
const duplicateExamples = []
for (const entry of carrying) {
	const seen = []
	for (const block of entry.additionalSpells ?? []) {
		for (const [grantKey, grantValue] of Object.entries(block)) {
			if (grantKey === 'ability' || grantKey === 'name') continue
			for (const ref of refsIn(grantValue)) seen.push(ref.split('|')[0].split('#')[0].toLowerCase())
		}
	}
	const dupes = seen.filter((name, index) => seen.indexOf(name) !== index)
	if (dupes.length > 0) {
		duplicatesWithinOption += 1
		if (duplicateExamples.length < 3) duplicateExamples.push(`${entry.name}: ${[...new Set(dupes)].join(', ')}`)
	}
}
console.log('options listing a spell more than once:', duplicatesWithinOption)
for (const example of duplicateExamples) console.log(`  ${example}`)
