/*
 * D46 investigation ahead of slice (d2b): the exact shape of the `prepared`
 * key inside a subclass's additionalSpells array (D62 — first pass supports
 * only this shape). investigate-spells.js already confirmed additionalSpells
 * lives directly on the subclass object (no ref* indirection) and enumerated
 * the 14 outer-key shapes; this script looks INSIDE `prepared` specifically:
 * how spells are keyed by level, and what a spell reference looks like.
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass')

const withPrepared = []
for (const s of subclasses) {
	if (!Array.isArray(s.additionalSpells)) continue
	for (const entry of s.additionalSpells) {
		if (Object.prototype.hasOwnProperty.call(entry, 'prepared')) {
			withPrepared.push({ subclass: s.name, className: s.className, entry })
		}
	}
}

console.log('SUMMARY')
console.log('subclass additionalSpells entries carrying a `prepared` key:', withPrepared.length)

// shape of the `prepared` value itself: object keyed by level? array? level keys as strings?
const preparedValueShapes = new Map()
for (const { entry } of withPrepared) {
	const p = entry.prepared
	const shape = Array.isArray(p) ? 'array' : typeof p === 'object' && p !== null ? 'object-keyed-by:' + JSON.stringify(Object.keys(p)) : typeof p
	preparedValueShapes.set(shape, (preparedValueShapes.get(shape) || 0) + 1)
}
console.log('\nshape of `prepared` value across all entries:')
for (const [shape, count] of preparedValueShapes) console.log(' ', count, shape.length > 120 ? shape.slice(0, 120) + '...' : shape)

// for object-keyed entries, look at what a single level's value looks like
console.log('\n--- sample: level-value shapes (first 5 distinct) ---')
const levelValueShapes = new Map()
for (const { entry } of withPrepared) {
	const p = entry.prepared
	if (typeof p !== 'object' || p === null || Array.isArray(p)) continue
	for (const levelKey of Object.keys(p)) {
		const v = p[levelKey]
		const shape = Array.isArray(v) ? `array[${v.length}] of ${typeof v[0]}${typeof v[0] === 'object' ? ':' + JSON.stringify(Object.keys(v[0] || {})) : ''}` : typeof v
		levelValueShapes.set(shape, (levelValueShapes.get(shape) || 0) + 1)
	}
}
for (const [shape, count] of levelValueShapes) console.log(' ', count, shape)

// does `prepared` ever coexist with other keys on the same entry (e.g. `ability`, `name`)?
console.log('\n--- other keys coexisting with `prepared` on the same entry ---')
const coexistCounts = new Map()
for (const { entry } of withPrepared) {
	for (const k of Object.keys(entry)) {
		if (k === 'prepared') continue
		coexistCounts.set(k, (coexistCounts.get(k) || 0) + 1)
	}
}
if (coexistCounts.size === 0) console.log('  none — `prepared` always occurs alone on its entry')
else for (const [k, count] of coexistCounts) console.log(' ', count, k)

// full trimmed example: a Cleric domain
console.log('\n--- trimmed example: first Cleric subclass with `prepared` ---')
const clericExample = withPrepared.find((w) => w.className === 'Cleric')
if (clericExample) {
	console.log('subclass:', clericExample.subclass)
	console.log(JSON.stringify(clericExample.entry.prepared, null, 0).slice(0, 500))
}

// a second example from a different class to compare keying (e.g. Paladin oath, Druid circle)
console.log('\n--- trimmed example: first Paladin or Druid subclass with `prepared` ---')
const secondExample = withPrepared.find((w) => w.className === 'Paladin' || w.className === 'Druid')
if (secondExample) {
	console.log('subclass:', secondExample.subclass, '(' + secondExample.className + ')')
	console.log(JSON.stringify(secondExample.entry.prepared, null, 0).slice(0, 500))
}

// check: does any level's spell array contain a nested choice (object with e.g. "choose") instead of plain refs?
console.log('\n--- checking for nested choice objects inside prepared level arrays ---')
let nestedChoiceFound = false
for (const { subclass, className, entry } of withPrepared) {
	const p = entry.prepared
	if (typeof p !== 'object' || p === null || Array.isArray(p)) continue
	for (const levelKey of Object.keys(p)) {
		const arr = p[levelKey]
		if (!Array.isArray(arr)) continue
		for (const item of arr) {
			if (typeof item === 'object' && item !== null) {
				nestedChoiceFound = true
				console.log('  NESTED OBJECT found:', className, subclass, 'level', levelKey, JSON.stringify(item).slice(0, 200))
			}
		}
	}
}
if (!nestedChoiceFound) console.log('  none found — every prepared-level entry is a plain spell reference (string), no nested choice objects')

// what does a plain string spell reference look like? (name only, or name|source?)
console.log('\n--- sample raw spell reference strings ---')
const sampleRefs = new Set()
for (const { entry } of withPrepared) {
	const p = entry.prepared
	if (typeof p !== 'object' || p === null || Array.isArray(p)) continue
	for (const levelKey of Object.keys(p)) {
		const arr = p[levelKey]
		if (!Array.isArray(arr)) continue
		for (const item of arr) {
			if (typeof item === 'string') sampleRefs.add(item)
			if (sampleRefs.size >= 8) break
		}
		if (sampleRefs.size >= 8) break
	}
	if (sampleRefs.size >= 8) break
}
console.log([...sampleRefs])
