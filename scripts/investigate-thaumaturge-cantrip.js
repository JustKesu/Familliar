/*
 * Whether Thaumaturge's (Cleric Divine Order) and Magician's (Druid Primal
 * Order) "+1 cantrip from your class list" is expressed structurally
 * anywhere in the data, or lives only in the feature's prose text.
 *
 * Checks: (1) does the Divine Order / Primal Order class-features.json entry
 * carry any field besides `entries` (a structured cantrip count, an
 * additionalSpells-shaped grant, etc.)? (2) does the Thaumaturge/Magician
 * OPTION's own resolved feature (found via the same refClassFeature uid the
 * picker resolves) carry any structured field beyond entries/prose?
 *
 * Run: node scripts/investigate-thaumaturge-cantrip.js
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
}

const classFeatures = readJson('class-features.json')

function dump(name, feature) {
	console.log(`\n=== ${name} ===`)
	if (!feature) {
		console.log('  NOT FOUND')
		return
	}
	console.log('  keys:', Object.keys(feature).join(', '))
	console.log('  entries (raw JSON):')
	console.log(JSON.stringify(feature.entries, null, 2).slice(0, 2000))
}

const divineOrder = classFeatures.find((f) => f.name === 'Divine Order' && f.className === 'Cleric')
const primalOrder = classFeatures.find((f) => f.name === 'Primal Order' && f.className === 'Druid')
dump('Divine Order (Cleric)', divineOrder)
dump('Primal Order (Druid)', primalOrder)

const thaumaturge = classFeatures.find((f) => f.name === 'Thaumaturge' && f.className === 'Cleric')
const magician = classFeatures.find((f) => f.name === 'Magician' && f.className === 'Druid')
dump('Thaumaturge (Cleric option)', thaumaturge)
dump('Magician (Druid option)', magician)
