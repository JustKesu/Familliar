/*
 * ASI-choice slice prep: for the 82 non-ASI feats with an `ability` field,
 * confirm exactly what a "choice" looks like — how many named options, how
 * many points, and whether any feat mixes a fixed bonus with a choice.
 * Feeds the wizard step that asks which ability a half-feat's bonus goes to.
 */

const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))

function truncate(obj) {
	const s = JSON.stringify(obj)
	return s.length > 300 ? s.slice(0, 300) + '…' : s
}

const withAbility = feats.filter((f) => f.ability && f.name !== 'Ability Score Improvement')
console.log('SUMMARY')
console.log('non-ASI feats with "ability" field:', withAbility.length)

const shapeCounts = new Map()
const examplesByShape = new Map()
const mixed = []

for (const f of withAbility) {
	const entryShapes = f.ability.map((entry) => {
		const keys = Object.keys(entry)
		if (keys.includes('choose')) {
			const choose = entry.choose
			return `choose(from=${choose.from ? choose.from.length : '?'},amount=${choose.amount ?? '1(default)'},count=${choose.count ?? '-'})`
		}
		return `fixed(${keys.join(',')}=${Object.values(entry).join(',')})`
	})
	const shape = entryShapes.join(' + ')
	shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1)
	if (!examplesByShape.has(shape)) examplesByShape.set(shape, { name: f.name, ability: f.ability })

	const hasFixed = f.ability.some((e) => !('choose' in e))
	const hasChoice = f.ability.some((e) => 'choose' in e)
	if (hasFixed && hasChoice) mixed.push(f)

	if (f.ability.length > 1) {
		console.log('MULTI-ENTRY ability array:', f.name, truncate(f.ability))
	}
}

console.log()
console.log('SHAPES (count of feats with this exact ability-array shape):')
for (const [shape, count] of shapeCounts) {
	console.log(`  ${count}x ${shape}`)
	console.log('    example:', examplesByShape.get(shape).name, truncate(examplesByShape.get(shape).ability))
}

console.log()
console.log('feats mixing a fixed bonus and a choice in the same ability array:', mixed.length)
for (const f of mixed) console.log('  ', f.name, truncate(f.ability))

console.log()
console.log('choose.from values seen (to confirm it is always all 6 abilities, never a subset):')
const fromSets = new Set()
for (const f of withAbility) {
	for (const entry of f.ability) {
		if (entry.choose) fromSets.add(JSON.stringify([...entry.choose.from].sort()))
	}
}
console.log([...fromSets])
