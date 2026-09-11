/*
 * Pre-implementation investigation (D46): how racial spells are stored in
 * data/species.json's `additionalSpells` — key shapes, how the grant level is
 * keyed, whether the field sits on the base race or its variants, spell refs
 * that don't resolve, and grants depending on data the character record does
 * not hold. Same approach as scripts/investigate-spells.js used for subclasses
 * (D62). Prints a summary only; writes nothing.
 */

const fs = require('fs')
const path = require('path')

const species = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/species.json'), 'utf8'))
const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

const withAdditional = species.filter((s) => s.additionalSpells)
const key = (s) => `${s.name}|${s.source}`
const trim = (value, max) => {
	const text = JSON.stringify(value)
	return text.length > max ? `${text.slice(0, max)}…` : text
}

console.log('=== 1. SCOPE AND KEY SHAPES ===')
console.log('species.json entries:', species.length, '| with additionalSpells:', withAdditional.length)
console.log('additionalSpells array lengths seen:', [...new Set(withAdditional.map((s) => (Array.isArray(s.additionalSpells) ? s.additionalSpells.length : 'NOT-AN-ARRAY')))])

const shapes = new Map()
for (const s of withAdditional) {
	const entries = Array.isArray(s.additionalSpells) ? s.additionalSpells : []
	for (const entry of entries) {
		const shape = JSON.stringify(Object.keys(entry).sort())
		if (!shapes.has(shape)) shapes.set(shape, [])
		shapes.get(shape).push(s)
	}
}
console.log('distinct outer key shapes:', shapes.size)
for (const [shape, owners] of [...shapes].sort((a, b) => b[1].length - a[1].length)) {
	console.log(` ${String(owners.length).padStart(2)}  ${shape}`)
}

console.log()
console.log('=== 2. EXAMPLES PER SHAPE (raw additionalSpells) ===')
for (const [shape, owners] of [...shapes].sort((a, b) => b[1].length - a[1].length)) {
	console.log(shape)
	const distinct = [...new Map(owners.map((o) => [key(o), o])).values()]
	for (const owner of distinct.slice(0, 2)) {
		console.log(`  ${owner.name} (${owner.source}): ${trim(owner.additionalSpells, 320)}`)
	}
}

console.log()
console.log('=== 3. HOW THE GRANT LEVEL IS KEYED ===')
const GRANT_KEYS = ['prepared', 'known', 'innate', 'expanded']
const levelKeyCounts = new Map()
const oddLevelKeys = []
for (const s of withAdditional) {
	for (const entry of Array.isArray(s.additionalSpells) ? s.additionalSpells : []) {
		for (const grantKey of GRANT_KEYS) {
			const levelMap = entry[grantKey]
			if (!levelMap || typeof levelMap !== 'object' || Array.isArray(levelMap)) continue
			for (const levelKey of Object.keys(levelMap)) {
				const id = `${grantKey}["${levelKey}"]`
				levelKeyCounts.set(id, (levelKeyCounts.get(id) || 0) + 1)
				if (!Number.isFinite(Number(levelKey))) oddLevelKeys.push(`${s.name} (${s.source}) ${id}`)
			}
		}
	}
}
for (const [id, count] of [...levelKeyCounts].sort()) console.log(` ${String(count).padStart(2)}  ${id}`)
console.log('non-numeric level keys (would be a pact-rank-style surprise):', oddLevelKeys.length === 0 ? 'NONE' : '')
for (const odd of oddLevelKeys.slice(0, 10)) console.log('  ', odd)

console.log()
console.log('=== 4. BASE RECORD vs VARIANT RECORD ===')
/** The three family linkages speciesData.ts recognises (D84): raceName/raceSource, "Parent; Suffix", "Parent (Suffix)". */
function parentOf(entry) {
	if (entry.raceName !== undefined || entry.raceSource !== undefined) {
		return species.find((p) => p.name === entry.raceName && p.source === entry.raceSource) || null
	}
	return (
		species.find(
			(p) => p !== entry && p.source === entry.source && (entry.name.startsWith(`${p.name}; `) || (entry.name.startsWith(`${p.name} (`) && entry.name.endsWith(')'))),
		) || null
	)
}
const parentByEntry = new Map(species.map((s) => [key(s), parentOf(s)]))
const childrenByParent = new Map()
for (const s of species) {
	const parent = parentByEntry.get(key(s))
	if (!parent) continue
	if (!childrenByParent.has(key(parent))) childrenByParent.set(key(parent), [])
	childrenByParent.get(key(parent)).push(s)
}
const roleOf = (s) => (parentByEntry.get(key(s)) ? 'variant' : childrenByParent.has(key(s)) ? 'family-base' : 'standalone')
const roleCounts = new Map()
for (const s of withAdditional) roleCounts.set(roleOf(s), (roleCounts.get(roleOf(s)) || 0) + 1)
console.log('role of the records carrying additionalSpells:', Object.fromEntries(roleCounts))
console.log('per record (role | reprintedAs = never selectable, speciesData.ts):')
for (const s of withAdditional) {
	const parent = parentByEntry.get(key(s))
	console.log(
		`  ${s.name} (${s.source})`.padEnd(42),
		roleOf(s).padEnd(12),
		parent ? `of ${parent.name}` : '',
		s.reprintedAs ? '[reprintedAs -> superseded]' : '',
	)
}
console.log('families where BOTH the base and at least one variant carry additionalSpells:')
const bothLevels = withAdditional.filter((s) => childrenByParent.has(key(s)) && childrenByParent.get(key(s)).some((c) => c.additionalSpells))
console.log('  ', bothLevels.length === 0 ? 'NONE' : bothLevels.map((s) => s.name).join(', '))
console.log('families whose BASE has no additionalSpells but whose variants do:')
const variantOnly = new Set()
for (const s of withAdditional) {
	const parent = parentByEntry.get(key(s))
	if (parent && !parent.additionalSpells) variantOnly.add(`${parent.name} (${parent.source})`)
}
console.log('  ', variantOnly.size === 0 ? 'NONE' : [...variantOnly].join(', '))

console.log()
console.log('=== 5. SPELL REFS THAT DO NOT RESOLVE AGAINST data/spells.json ===')
function collectRefs(value, out) {
	if (typeof value === 'string') out.push(value)
	else if (Array.isArray(value)) for (const item of value) collectRefs(item, out)
	else if (value && typeof value === 'object') for (const v of Object.values(value)) collectRefs(v, out)
	return out
}
let refTotal = 0
let filterRefs = 0
const unresolved = []
for (const s of withAdditional) {
	// Only the grant keys hold spell refs — `ability`/`name` strings are not spells.
	const refs = []
	for (const entry of Array.isArray(s.additionalSpells) ? s.additionalSpells : []) {
		for (const grantKey of GRANT_KEYS) if (entry[grantKey] !== undefined) collectRefs(entry[grantKey], refs)
	}
	for (const ref of refs) {
		if (ref.includes('=')) {
			// A `choose` filter expression ("level=0|class=Wizard"), not a spell name.
			filterRefs += 1
			continue
		}
		refTotal += 1
		const [namePart, sourcePart] = ref.split('|')
		const wantName = namePart.toLowerCase()
		const wantSource = sourcePart ? sourcePart.split('#')[0].toUpperCase() : null
		const found = spells.find((sp) => sp.name.toLowerCase() === wantName && (wantSource === null || sp.source.toUpperCase() === wantSource))
		if (found) continue
		// Retry with a trailing "#..." tag stripped from the NAME (subclassPreparedSpells.ts's parseSpellRef strips it only
		// from the source half) — separates "this app's parser can't read the ref" from "the spell is genuinely absent".
		const stripped = wantName.split('#')[0]
		const foundStripped = spells.find((sp) => sp.name.toLowerCase() === stripped && (wantSource === null || sp.source.toUpperCase() === wantSource))
		unresolved.push(`${s.name} (${s.source}) -> "${ref}"  ${foundStripped ? `[resolves as "${foundStripped.name}|${foundStripped.source}" once the #tag is stripped from the NAME]` : '[absent from spells.json entirely]'}`)
	}
}
console.log('literal spell refs under prepared/known/innate/expanded:', refTotal, '| choose-filter expressions skipped:', filterRefs, '| unresolved:', unresolved.length)
for (const u of unresolved) console.log('  ', u)

console.log()
console.log('=== 6. GRANTS DEPENDING ON SOMETHING THE CHARACTER RECORD MAY NOT HOLD ===')
function findChooseNodes(value, out, trail) {
	if (Array.isArray(value)) value.forEach((item, i) => findChooseNodes(item, out, `${trail}[${i}]`))
	else if (value && typeof value === 'object') {
		for (const [k, v] of Object.entries(value)) {
			if (k === 'choose') out.push({ at: `${trail}.choose`, node: v })
			else findChooseNodes(v, out, `${trail}.${k}`)
		}
	}
	return out
}
console.log('a) races whose additionalSpells has MORE THAN ONE entry (the Genie ambiguity shape):')
const multi = withAdditional.filter((s) => Array.isArray(s.additionalSpells) && s.additionalSpells.length > 1)
console.log('  ', multi.length === 0 ? 'NONE' : multi.map((s) => `${s.name} (${s.source}) x${s.additionalSpells.length}`).join(', '))

console.log('b) `choose` nodes (a player pick, not a fixed grant — needs storage):')
let chooseTotal = 0
for (const s of withAdditional) {
	const nodes = findChooseNodes(s.additionalSpells, [], 'additionalSpells')
	chooseTotal += nodes.length
	for (const node of nodes.slice(0, 2)) console.log(`   ${s.name} (${s.source}) ${node.at} = ${trim(node.node, 150)}`)
}
console.log('   total choose nodes:', chooseTotal)

console.log('c) `ability` field values (what the grant is cast with):')
const abilityValues = new Map()
for (const s of withAdditional) {
	for (const entry of Array.isArray(s.additionalSpells) ? s.additionalSpells : []) {
		const value = JSON.stringify(entry.ability === undefined ? '(absent)' : entry.ability)
		if (!abilityValues.has(value)) abilityValues.set(value, [])
		abilityValues.get(value).push(s.name)
	}
}
for (const [value, owners] of abilityValues) console.log(`   ${value} x${owners.length}  e.g. ${owners.slice(0, 3).join(', ')}`)

console.log('d) other non-grant keys carried on an entry (name/resourceName/...):')
const otherKeys = new Map()
for (const s of withAdditional) {
	for (const entry of Array.isArray(s.additionalSpells) ? s.additionalSpells : []) {
		for (const k of Object.keys(entry)) {
			if (GRANT_KEYS.includes(k) || k === 'ability') continue
			if (!otherKeys.has(k)) otherKeys.set(k, [])
			otherKeys.get(k).push(`${s.name}=${trim(entry[k], 60)}`)
		}
	}
}
for (const [k, owners] of otherKeys) console.log(`   ${k} x${owners.length}  e.g. ${owners.slice(0, 2).join(' | ')}`)
if (otherKeys.size === 0) console.log('   NONE')

console.log('e) usage wrappers inside the grants (will/daily/ritual/resource/rest):')
const wrappers = new Map()
for (const s of withAdditional) {
	for (const entry of Array.isArray(s.additionalSpells) ? s.additionalSpells : []) {
		for (const grantKey of GRANT_KEYS) {
			const levelMap = entry[grantKey]
			if (!levelMap || typeof levelMap !== 'object' || Array.isArray(levelMap)) continue
			for (const value of Object.values(levelMap)) {
				if (Array.isArray(value) || !value || typeof value !== 'object') {
					if (!wrappers.has('(bare array)')) wrappers.set('(bare array)', [])
					wrappers.get('(bare array)').push(s.name)
					continue
				}
				for (const [wrapperKey, wrapperValue] of Object.entries(value)) {
					const sub = wrapperValue && typeof wrapperValue === 'object' && !Array.isArray(wrapperValue) ? Object.keys(wrapperValue).join(',') : '(array)'
					const id = `${wrapperKey} -> {${sub}}`
					if (!wrappers.has(id)) wrappers.set(id, [])
					wrappers.get(id).push(s.name)
				}
			}
		}
	}
}
for (const [id, owners] of [...wrappers].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`   ${String(owners.length).padStart(2)}  ${id}  e.g. ${[...new Set(owners)].slice(0, 3).join(', ')}`)
}
