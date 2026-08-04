/*
 * Feat-effects-into-calculation slice prep: exact shapes for the structured
 * fields the calculation layer will read (skillProficiencies, expertise,
 * savingThrowProficiencies, senses), the full pure-prose feat list (no
 * mechanical structured field at all), and whether Resilient's ability
 * choice and saving-throw choice are the same index.
 */

const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))

function truncate(obj) {
	const s = JSON.stringify(obj)
	return s.length > 400 ? s.slice(0, 400) + '…' : s
}

console.log('SUMMARY')

console.log()
console.log('1. skillProficiencies (full)')
for (const f of feats.filter((f) => f.skillProficiencies)) {
	console.log(' ', f.name, truncate(f.skillProficiencies))
}

console.log()
console.log('2. expertise (full)')
for (const f of feats.filter((f) => f.expertise)) {
	console.log(' ', f.name, truncate(f.expertise))
}

console.log()
console.log('3. savingThrowProficiencies (full)')
for (const f of feats.filter((f) => f.savingThrowProficiencies)) {
	console.log(' ', f.name, truncate(f.savingThrowProficiencies))
	console.log('   same feat\'s ability field:', truncate(f.ability))
}

console.log()
console.log('4. senses (full)')
for (const f of feats.filter((f) => f.senses)) {
	console.log(' ', f.name, truncate(f.senses))
}

console.log()
console.log('5. PURE PROSE feats (no mechanical structured field) — full name list')
const mechanicalFields = [
	'ability',
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
const pureProse = feats.filter((f) => !mechanicalFields.some((field) => f[field] !== undefined))
console.log('count:', pureProse.length)
for (const f of pureProse) console.log(' -', f.name, `(${f.source}, category ${f.category})`)

console.log()
console.log('6. Any feat with a "speed" or "hp"/"hitPoints" or "hd" key anywhere at top level?')
console.log(
	'  speed:', feats.filter((f) => 'speed' in f).map((f) => f.name),
)
