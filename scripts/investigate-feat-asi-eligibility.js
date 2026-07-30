/*
 * Feat/ASI slice (4a) prep: confirms which levels grant an ASI-or-feat
 * choice per class, and the data shapes the prerequisite checker needs
 * (ability scores, weapon/armor proficiency, spellcasting, species names).
 */

const fs = require('fs')
const path = require('path')

const classFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/class-features.json'), 'utf8'))
const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))
const species = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/species.json'), 'utf8'))

console.log('SUMMARY')

console.log()
console.log('1. ASI-OR-FEAT GRANT LEVELS PER CLASS (class-features.json)')
const grantNames = ['Ability Score Improvement', 'Epic Boon']
const byClass = new Map()
for (const f of classFeatures) {
	if (!grantNames.includes(f.name)) continue
	const key = `${f.className}|${f.classSource}`
	if (!byClass.has(key)) byClass.set(key, [])
	byClass.get(key).push({ level: f.level, name: f.name })
}
for (const [key, entries] of byClass) {
	entries.sort((a, b) => a.level - b.level)
	console.log(' ', key, entries.map((e) => `${e.level}:${e.name === 'Epic Boon' ? 'EB' : 'ASI'}`).join(', '))
}

console.log()
console.log('2. STARTING PROFICIENCIES SHAPE (armor/weapons, all base classes)')
for (const c of classes) {
	if (!c.startingProficiencies) continue
	if (!c.classFeatures) continue // only base classes carry a feature table
	console.log(' ', c.name, 'armor=', JSON.stringify(c.startingProficiencies.armor), 'weapons=', JSON.stringify(c.startingProficiencies.weapons))
}

console.log()
console.log('3. SPELLCASTING ABILITY (base classes with spellcastingAbility field)')
const casters = classes.filter((c) => c.classFeatures && c.spellcastingAbility).map((c) => c.name)
console.log(' ', casters.join(', '))

console.log()
console.log('4. RACE PREREQUISITE VALUES vs SPECIES.JSON NAMES')
const raceValues = new Set()
for (const f of feats) {
	if (!f.prerequisite) continue
	for (const entry of f.prerequisite) {
		if (!entry.race) continue
		for (const r of entry.race) raceValues.add(JSON.stringify(r))
	}
}
console.log('  distinct race prereq values:', [...raceValues].join(' | '))
console.log('  species.json names containing relevant words:')
const relevant = species
	.map((s) => s.name)
	.filter((n) => /elf|orc|halfling|gnome|dwarf|tiefling|dragonborn|human/i.test(n))
console.log('   ', relevant.join(' | '))
console.log('  half-elf/half-orc present in species.json:', species.some((s) => /half-elf|half-orc/i.test(s.name)))

console.log()
console.log('5. FEAT NAME+SOURCE FOR "feat" PREREQUISITE MATCHING (lowercase name|source)')
const example = feats.find((f) => f.name === 'Greater Aberrant Mark')
console.log('  example prereq value:', JSON.stringify(example.prerequisite))
const target = feats.find((f) => f.name.toLowerCase() === 'aberrant dragonmark')
console.log('  matching feat found by lowercase name, source:', target.source)
