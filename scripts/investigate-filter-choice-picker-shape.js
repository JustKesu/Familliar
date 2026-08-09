/*
 * investigate-filter-choice-picker-shape.js
 * ==========================================
 * D46 short read for build order step 6 slice d5b-1 (generic filter-choice
 * spell picker). Confirms, trimmed SUMMARY only:
 *  - the `school` field's value shape on spells.json entries (letter code?)
 *  - the ritual flag + level-1 ritual spell count (for Ritual Caster's count)
 *  - the exact `choose` string shape + count field across the 8 in-scope
 *    feats (Artificer Initiate, Blessed Warrior, Druidic Warrior, Wood Elf
 *    Magic, Aberrant Dragonmark, Fey-Touched, Shadow-Touched, Ritual Caster)
 *
 * Investigation only. Run: node scripts/investigate-filter-choice-picker-shape.js
 */
const fs = require('fs')
const path = require('path')
const DATA_DIR = path.join(__dirname, '..', 'data')
function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
}

const spells = readJson('spells.json')
const schools = new Set(spells.map((s) => s.school).filter(Boolean))
console.log('SUMMARY')
console.log('distinct spell.school values:', [...schools].sort())

const ritualLevel1 = spells.filter((s) => s.level === 1 && s.meta?.ritual === true)
console.log('level-1 ritual spells count:', ritualLevel1.length)
console.log('sample:', ritualLevel1.slice(0, 3).map((s) => s.name))

const feats = readJson('feats.json')
const NAMES = [
	['Artificer Initiate', 'TCE'],
	['Blessed Warrior', 'XPHB'],
	['Druidic Warrior', 'XPHB'],
	['Wood Elf Magic', 'XGE'],
	['Aberrant Dragonmark', 'EFA'],
	['Fey-Touched', 'XPHB'],
	['Shadow-Touched', 'XPHB'],
	['Ritual Caster', 'XPHB'],
]
console.log('\nfeat additionalSpells (trimmed):')
for (const [name, source] of NAMES) {
	const f = feats.find((x) => x.name === name && x.source === source)
	if (!f) {
		console.log(' -', name, ': NOT FOUND with source', source)
		continue
	}
	console.log(' -', name, ':', JSON.stringify(f.additionalSpells))
}

const classes = readJson('classes.json')
console.log('\nclass sources for the 4 classes our filter-choice feats reference:')
for (const n of ['Cleric', 'Druid', 'Artificer', 'Sorcerer']) {
	const matches = classes.filter((c) => c.name === n && c.classFeatures !== undefined)
	console.log(' -', n, ':', matches.map((c) => c.source).join(', '))
}

console.log('\ntop-level `ability` field (half-feat +1 choice) on the 8 in-scope feats:')
for (const [name, source] of NAMES) {
	const f = feats.find((x) => x.name === name && x.source === source)
	console.log(' -', name, ':', JSON.stringify(f?.ability))
}

console.log('\ndone.')
