// Ahead of the sheet's spell detail view (build order step 6 slice d4, D46):
// confirms which spells.json fields carry Casting Time, Range, Components,
// Duration, Attack/Save. Prints one trimmed example only.
const fs = require('fs')
const path = require('path')

const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

const example = spells.find((s) => s.name === 'Fireball') ?? spells[0]

const fieldCounts = {}
for (const s of spells) {
	for (const key of Object.keys(s)) {
		fieldCounts[key] = (fieldCounts[key] || 0) + 1
	}
}

console.log('SUMMARY')
console.log('Total spells:', spells.length)
console.log('Field presence counts:', JSON.stringify(fieldCounts, null, 2))
console.log('\nExample (trimmed):', example.name)
console.log(
	JSON.stringify(
		{
			time: example.time,
			range: example.range,
			components: example.components,
			duration: example.duration,
			savingThrow: example.savingThrow,
			spellAttack: example.spellAttack,
			meta: example.meta,
			level: example.level,
			school: example.school,
			source: example.source,
		},
		null,
		2,
	),
)
