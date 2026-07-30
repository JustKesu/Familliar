/*
 * Step 4a prep: which of the 128 feats carry their effect in a structured
 * field (readable programmatically) vs. only in prose (`entries`).
 * Feeds the D21/D42 decision on whether feats need a manual exception table.
 */

const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))

function truncate(obj) {
	const s = JSON.stringify(obj)
	return s.length > 300 ? s.slice(0, 300) + '…' : s
}

console.log('SUMMARY')
console.log('total feats:', feats.length)

// 1. Ability bonuses
console.log()
console.log('1. ABILITY BONUSES')
const withAbility = feats.filter((f) => f.ability)
console.log('feats with "ability" field:', withAbility.length)

const fixedShape = []
const choiceShape = []
for (const f of withAbility) {
	for (const entry of f.ability) {
		const keys = Object.keys(entry)
		if (keys.includes('choose')) {
			choiceShape.push(f)
		} else {
			fixedShape.push(f)
		}
	}
}
console.log('  fixed bonus to a specific ability: entries counted =', fixedShape.length)
console.log('  choice among several abilities (half-feats): entries counted =', choiceShape.length)
if (fixedShape[0]) console.log('  example fixed:', fixedShape[0].name, truncate(fixedShape[0].ability))
if (choiceShape[0]) console.log('  example choice:', choiceShape[0].name, truncate(choiceShape[0].ability))

// 2. Other structured fields
console.log()
console.log('2. OTHER STRUCTURED FIELDS (mechanical, non-prose)')
const structuredFieldNames = [
	'skillProficiencies',
	'savingThrowProficiencies',
	'expertise',
	'toolProficiencies',
	'weaponProficiencies',
	'armorProficiencies',
	'languageProficiencies',
	'skillToolLanguageProficiencies',
	'resist',
	'senses',
	'additionalSpells',
	'optionalfeatureProgression',
]
for (const field of structuredFieldNames) {
	const withField = feats.filter((f) => f[field] !== undefined)
	console.log(`  ${field}: ${withField.length} feats`)
	if (withField[0]) console.log('    example:', withField[0].name, truncate(withField[0][field]))
}

// non-mechanical / metadata fields, listed for completeness, not counted as "effect" fields
console.log()
console.log('  (metadata fields seen, not mechanical effects): category, prerequisite, repeatable, repeatableHidden, traitTags, hasFluffImages, basicRules2024, srd52, page, source, name, entries')

// 3. Pure prose feats
console.log()
console.log('3. PURE PROSE FEATS (no mechanical structured field at all)')
const mechanicalFields = ['ability', ...structuredFieldNames]
const pureProse = feats.filter((f) => !mechanicalFields.some((field) => f[field] !== undefined))
console.log('count:', pureProse.length)
console.log('sample:', pureProse.slice(0, 5).map((f) => f.name))

// 4. Prerequisite shapes
console.log()
console.log('4. PREREQUISITE SHAPES')
const noPrereq = feats.filter((f) => !f.prerequisite)
console.log('feats with no prerequisite field:', noPrereq.length)

const prereqKeyShapes = new Map()
for (const f of feats) {
	if (!f.prerequisite) continue
	for (const entry of f.prerequisite) {
		const keys = Object.keys(entry).sort().join('+')
		if (!prereqKeyShapes.has(keys)) prereqKeyShapes.set(keys, { count: 0, example: null })
		const rec = prereqKeyShapes.get(keys)
		rec.count++
		if (!rec.example) rec.example = { name: f.name, prerequisite: entry }
	}
}
for (const [shape, rec] of prereqKeyShapes) {
	console.log(`  [${shape}]: ${rec.count}`)
	console.log('    example:', truncate(rec.example))
}

// 5. Ability Score Improvement feat
console.log()
console.log('5. ABILITY SCORE IMPROVEMENT FEAT')
const asi = feats.find((f) => f.name === 'Ability Score Improvement')
console.log(asi ? truncate(asi) : 'NOT FOUND in feats.json')

// 6. Categories
console.log()
console.log('6. CATEGORIES')
const catCounts = new Map()
for (const f of feats) {
	catCounts.set(f.category, (catCounts.get(f.category) || 0) + 1)
}
for (const [cat, count] of catCounts) {
	console.log(`  ${cat}: ${count}`)
}
