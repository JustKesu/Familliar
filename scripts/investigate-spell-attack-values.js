/*
 * Build order step 6a, cleanup (Repelling Blast). Confirm before coding:
 *   1. Repelling Blast's actual `choose` filter string, verbatim from the data.
 *   2. Every distinct raw `spellAttack` value across spells.json (casing,
 *      whether "O" ever occurs alongside "M"/"R").
 *   3. Whether any damaging cantrip carries a spellAttack value NOT in {M, R}.
 * SUMMARY ONLY — counts and at most 3 examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
function load(file) {
	return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

const spells = load('spells.json')
const optionalFeatures = load('optional-features.json')

console.log('=== 1. Repelling Blast prerequisite, verbatim ===')
const repellingBlast = optionalFeatures.find((e) => e.name === 'Repelling Blast')
console.log(JSON.stringify(repellingBlast?.prerequisite, null, 2))

console.log('')
console.log('=== 2. spellAttack raw values ===')
const withField = spells.filter((s) => s.spellAttack !== undefined)
console.log('spells with spellAttack:', withField.length, '/', spells.length)
const distinctValues = new Set()
for (const s of withField) for (const v of s.spellAttack) distinctValues.add(v)
console.log('distinct single values seen:', [...distinctValues].join(', '))
const distinctArrayShapes = new Set(withField.map((s) => JSON.stringify(s.spellAttack)))
console.log('distinct array shapes:', [...distinctArrayShapes].join(' | '))

console.log('')
console.log('=== 3. damaging cantrips: spellAttack value distribution ===')
const damagingCantrips = spells.filter((s) => s.level === 0 && Array.isArray(s.damageInflict) && s.damageInflict.length > 0)
console.log('damaging cantrips total:', damagingCantrips.length)
const withoutSpellAttack = damagingCantrips.filter((s) => !Array.isArray(s.spellAttack) || s.spellAttack.length === 0)
console.log('damaging cantrips with NO spellAttack field:', withoutSpellAttack.length)
console.log(
	'  examples:',
	withoutSpellAttack
		.slice(0, 3)
		.map((s) => s.name)
		.join(', '),
)
const outsideMR = damagingCantrips.filter((s) => Array.isArray(s.spellAttack) && s.spellAttack.some((v) => v !== 'M' && v !== 'R'))
console.log('damaging cantrips with a spellAttack value outside {M, R}:', outsideMR.length)
for (const s of outsideMR.slice(0, 3)) console.log('  example:', s.name, JSON.stringify(s.spellAttack))
