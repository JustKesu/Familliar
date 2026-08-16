// Ahead of build order step 6 cantrip scaling display (D46): confirms the
// exact shape of scalingLevelDice across every spell that carries it.
const fs = require('fs')
const path = require('path')

const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

const withScaling = spells.filter((s) => s.scalingLevelDice)

const arrayLengthCounts = {}
const keySets = new Set()
const nonCantripWithScaling = []

for (const s of withScaling) {
	const raw = s.scalingLevelDice
	const asArray = Array.isArray(raw) ? raw : [raw]
	arrayLengthCounts[asArray.length] = (arrayLengthCounts[asArray.length] || 0) + 1
	for (const entry of asArray) {
		keySets.add(JSON.stringify(Object.keys(entry).sort()))
	}
	if (s.level !== 0) nonCantripWithScaling.push({ name: s.name, level: s.level })
}

const single = withScaling.find((s) => !Array.isArray(s.scalingLevelDice))
const arr = withScaling.find((s) => Array.isArray(s.scalingLevelDice))
const twoEntry = withScaling.find((s) => Array.isArray(s.scalingLevelDice) && s.scalingLevelDice.length > 1)

console.log('SUMMARY')
console.log('Total spells:', spells.length)
console.log('With scalingLevelDice:', withScaling.length)
console.log('Shape: array vs single object counts (by length after normalizing to array):', JSON.stringify(arrayLengthCounts, null, 2))
console.log('Distinct key sets seen per scaling entry:', JSON.stringify([...keySets], null, 2))
console.log('Non-cantrip (level != 0) spells with scalingLevelDice:', JSON.stringify(nonCantripWithScaling, null, 2))

console.log('\nExample: single (non-array) scalingLevelDice, spell:', single ? single.name : 'none found')
console.log(JSON.stringify(single ? single.scalingLevelDice : null, null, 2))

console.log('\nExample: array scalingLevelDice, spell:', arr ? arr.name : 'none found')
console.log(JSON.stringify(arr ? arr.scalingLevelDice : null, null, 2))

console.log('\nExample: TWO-entry array scalingLevelDice, spell:', twoEntry ? twoEntry.name : 'none found')
console.log(JSON.stringify(twoEntry ? twoEntry.scalingLevelDice : null, null, 2))

// Fire Bolt specifically, since the task brief names it
const fireBolt = spells.find((s) => s.name === 'Fire Bolt')
console.log('\nFire Bolt scalingLevelDice:', JSON.stringify(fireBolt ? fireBolt.scalingLevelDice : 'not found', null, 2))
