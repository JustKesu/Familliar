/*
 * D46 follow-up ahead of slice (d6a): investigate-subclass-spell-shapes.js
 * already classified the 35 "fixed grant, other key" subclasses at a coarse
 * level. This script looks closer at three things that matter for HOW to
 * write the derived lookup, without printing whole entries (CLAUDE.md):
 * - is `known`/`innate` always a flat { level: [refs] } map like `prepared`,
 *   or does it ever nest (Monk's `resource` wrapping)?
 * - are level keys always character levels, or does `expanded`'s fixed-name
 *   group use pact-slot-rank keys ("s1".."s5") instead?
 * - which subclasses fall in each bucket, so the code path can be scoped.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass')
const withAdditional = subclasses.filter((s) => Array.isArray(s.additionalSpells) && s.additionalSpells.length > 0)

function containsChoose(node) {
	if (node === null || typeof node !== 'object') return false
	if (Array.isArray(node)) return node.some(containsChoose)
	if (Object.prototype.hasOwnProperty.call(node, 'choose')) return true
	return Object.values(node).some(containsChoose)
}

const fixedOther = []
for (const s of withAdditional) {
	const keys = new Set()
	for (const entry of s.additionalSpells) for (const k of Object.keys(entry)) keys.add(k)
	const onlyPrepared = keys.size === 1 && keys.has('prepared')
	const hasChoose = s.additionalSpells.some(containsChoose)
	if (!onlyPrepared && !hasChoose && keys.size > 0) fixedOther.push(s)
}

console.log('SUMMARY: fixedOther subclasses:', fixedOther.length)

// classify each subclass's `known`/`innate` map shape: flat vs nested-resource
function levelMapShape(map) {
	if (typeof map !== 'object' || map === null) return 'not-an-object'
	let flatArray = 0
	let nestedResource = 0
	let other = 0
	const levelKeyKinds = new Set()
	for (const [levelKey, val] of Object.entries(map)) {
		levelKeyKinds.add(/^\d+$/.test(levelKey) ? 'numeric' : levelKey.startsWith('s') ? 's-rank' : 'other')
		if (Array.isArray(val)) flatArray++
		else if (val && typeof val === 'object' && 'resource' in val) nestedResource++
		else other++
	}
	return { flatArray, nestedResource, other, levelKeyKinds: [...levelKeyKinds] }
}

const buckets = new Map() // bucket label -> [{className, name}]
function addBucket(label, s) {
	if (!buckets.has(label)) buckets.set(label, [])
	buckets.get(label).push(`${s.className} - ${s.name}`)
}

for (const s of fixedOther) {
	for (const entry of s.additionalSpells) {
		for (const key of ['known', 'innate']) {
			if (!(key in entry)) continue
			const shape = levelMapShape(entry[key])
			const label = `${key}: flat=${shape.flatArray} nestedResource=${shape.nestedResource} other=${shape.other} keys=${JSON.stringify(shape.levelKeyKinds)}`
			addBucket(label, s)
		}
		if ('expanded' in entry) {
			const shape = levelMapShape(entry.expanded)
			// distinguish fixed-name expanded from pool-widening {all:...} expanded
			let hasAll = false
			let hasFixedString = false
			for (const v of Object.values(entry.expanded)) {
				if (!Array.isArray(v)) continue
				for (const item of v) {
					if (item && typeof item === 'object' && 'all' in item) hasAll = true
					if (typeof item === 'string') hasFixedString = true
				}
			}
			const label = `expanded: hasAll=${hasAll} hasFixedString=${hasFixedString} keys=${JSON.stringify(shape.levelKeyKinds)}`
			addBucket(label, s)
		}
	}
}

console.log('\n--- known/innate/expanded shape buckets (subclass count, up to 3 example names) ---')
for (const [label, names] of buckets) {
	console.log(' ', names.length, '|', label)
	console.log('    e.g.', names.slice(0, 3).join('; '))
}

// trimmed example of the nested-resource shape, since that one needs careful field-level detail
console.log('\n--- trimmed example: nested-resource innate (Monk) ---')
const sunSoul = withAdditional.find((s) => /Sun Soul/i.test(s.name))
if (sunSoul) {
	const entry = sunSoul.additionalSpells[0]
	console.log('  ability:', entry.ability, '| resourceName:', entry.resourceName)
	console.log('  innate level keys:', Object.keys(entry.innate))
	const lvl = Object.keys(entry.innate)[0]
	console.log('  innate.' + lvl + ' shape:', JSON.stringify(entry.innate[lvl]).slice(0, 150))
}

// trimmed example of s-rank keyed expanded (Warlock patrons)
console.log('\n--- trimmed example: s-rank expanded (Warlock patron) ---')
const celestial = withAdditional.find((s) => /Celestial/i.test(s.name) && s.className === 'Warlock')
if (celestial) {
	const entry = celestial.additionalSpells[0]
	console.log('  expanded level keys:', Object.keys(entry.expanded))
	const k = Object.keys(entry.expanded)[0]
	console.log('  expanded.' + k + ':', JSON.stringify(entry.expanded[k]).slice(0, 150))
}
