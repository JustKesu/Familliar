/*
 * Ahead of the spell picker (slice d2): confirm cantripProgression /
 * preparedSpellsProgression / spellsKnownProgressionFixed(ByLevel) shapes —
 * specifically whether preparedSpellsProgression already bakes in an
 * ability modifier assumption, or is a level-only count the picker must add
 * the final ability modifier to itself.
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const baseClasses = classes.filter((c) => c.entryType === 'class' && c.hd)

console.log('SUMMARY')

for (const c of baseClasses) {
	if (!c.casterProgression) continue
	console.log(`\n--- ${c.name} (${c.casterProgression}, ability=${c.spellcastingAbility}) ---`)
	if (Array.isArray(c.cantripProgression)) {
		console.log('  cantripProgression[0,2,19]:', c.cantripProgression[0], c.cantripProgression[2], c.cantripProgression[19])
	} else {
		console.log('  cantripProgression: none')
	}
	if (Array.isArray(c.preparedSpellsProgression)) {
		console.log('  preparedSpellsProgression[0,2,19]:', c.preparedSpellsProgression[0], c.preparedSpellsProgression[2], c.preparedSpellsProgression[19])
	} else {
		console.log('  preparedSpellsProgression: none')
	}
	if (Array.isArray(c.spellsKnownProgressionFixed)) {
		console.log('  spellsKnownProgressionFixed[0,2,19]:', c.spellsKnownProgressionFixed[0], c.spellsKnownProgressionFixed[2], c.spellsKnownProgressionFixed[19])
	} else {
		console.log('  spellsKnownProgressionFixed: none')
	}
	if (c.spellsKnownProgressionFixedByLevel) {
		console.log('  spellsKnownProgressionFixedByLevel: present, keys:', Object.keys(c.spellsKnownProgressionFixedByLevel).slice(0, 5))
	}
	console.log('  preparedSpellsChange:', c.preparedSpellsChange)
}

// Cleric example: is level-1 prepared count = 1 + WIS mod, or already assuming a specific WIS?
const cleric = baseClasses.find((c) => c.name === 'Cleric')
console.log('\n--- Cleric raw preparedSpellsProgression (full array) ---')
console.log(JSON.stringify(cleric.preparedSpellsProgression))
console.log('If level-1 value is 1, the array is level-only (WIS mod not baked in, picker must add it).')
console.log('If level-1 value is e.g. 4, an assumed WIS mod (e.g. +3) is baked in and cannot be reused generically.')
