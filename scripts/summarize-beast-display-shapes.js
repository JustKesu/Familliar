/*
 * TEMPORARY scaffolding (D14): field shapes the stat-block component must
 * render, measured across the CR 0 familiar pool AND all 89 beasts.
 * SUMMARY ONLY — counts and at most 3 short examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const beasts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'beasts.json'), 'utf8'))
const pool = beasts.filter((b) => b.crNumber === 0)

function shapeOf(value) {
	if (Array.isArray(value)) return `array<${[...new Set(value.map((v) => (typeof v === 'object' && v !== null ? 'object' : typeof v)))].join('|') || 'empty'}>`
	if (value === null) return 'null'
	return typeof value
}

const FIELDS = ['ac', 'hp', 'speed', 'save', 'skill', 'senses', 'passive', 'resist', 'immune', 'vulnerable', 'conditionImmune', 'alignment', 'initiative', 'trait', 'action', 'bonus', 'reaction', 'legendary', 'size', 'type']

console.log('CR 0 pool:', pool.length, '| all beasts:', beasts.length)
console.log('\nfield: presentInPool/24 presentInAll/89 shapes(all)')
for (const field of FIELDS) {
	const shapes = [...new Set(beasts.filter((b) => b[field] !== undefined).map((b) => shapeOf(b[field])))]
	console.log(`  ${field.padEnd(16)} ${String(pool.filter((b) => b[field] !== undefined).length).padStart(2)}/24  ${String(beasts.filter((b) => b[field] !== undefined).length).padStart(2)}/89  ${shapes.join(', ')}`)
}

// Object-valued fields: which keys do they carry?
for (const field of ['hp', 'skill', 'save']) {
	const keys = new Set()
	for (const b of beasts) if (b[field] && typeof b[field] === 'object') Object.keys(b[field]).forEach((k) => keys.add(k))
	console.log(`\n${field} keys:`, [...keys].sort().join(', '))
}

// trait/action element shape — the markup renderer's input.
for (const field of ['trait', 'action', 'bonus', 'reaction']) {
	const elementKeys = new Set()
	const entryTypes = new Set()
	for (const b of beasts) {
		for (const item of b[field] || []) {
			Object.keys(item).forEach((k) => elementKeys.add(k))
			for (const e of item.entries || []) entryTypes.add(typeof e === 'string' ? 'string' : `object:${e && e.type}`)
		}
	}
	console.log(`${field}: element keys [${[...elementKeys].sort().join(', ')}] entry types [${[...entryTypes].join(', ')}]`)
}

// The brief's claim to re-verify: no ref* nodes anywhere in trait/action text.
const REF_KEYS = ['refClassFeature', 'refSubclassFeature', 'refOptionalfeature', 'refFeat']
let refHits = 0
const raw = JSON.stringify(beasts)
for (const key of REF_KEYS) if (raw.includes(`"${key}"`)) refHits++
console.log('\nref* node types present anywhere in beasts.json:', refHits)

// senses / resist / conditionImmune element shapes
for (const field of ['senses', 'resist', 'immune', 'conditionImmune']) {
	const examples = beasts.filter((b) => b[field] !== undefined).slice(0, 2).map((b) => `${b.name}: ${JSON.stringify(b[field])}`)
	console.log(`${field} examples:`, examples.join(' | ') || '(none)')
}

// speed values, ac values, alignment
console.log('\nspeed example:', JSON.stringify(pool[0] && pool[0].speed))
console.log('ac shapes across all:', [...new Set(beasts.flatMap((b) => (b.ac || []).map((a) => (typeof a === 'object' ? `object:${Object.keys(a).sort().join('+')}` : typeof a))))].join(', '))
console.log('alignment example:', JSON.stringify(beasts[0] && beasts[0].alignment), '| distinct alignment arrays:', new Set(beasts.map((b) => JSON.stringify(b.alignment))).size)
console.log('type examples:', [...new Set(beasts.map((b) => JSON.stringify(b.type)))].slice(0, 3).join(' | '))
console.log('\n3 CR 0 pool examples:', pool.slice(0, 3).map((b) => `${b.name} (AC ${JSON.stringify(b.ac)}, HP ${b.hp && b.hp.average})`).join(' | '))
