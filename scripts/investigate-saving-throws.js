/*
 * D46 verification: where classes.json states saving-throw proficiencies,
 * and whether the shape is consistent across all 13 base classes.
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const baseClasses = classes.filter((c) => c.entryType === 'class' && c.hd)

const shapes = new Map()

for (const cls of baseClasses) {
	const key = JSON.stringify({
		isArray: Array.isArray(cls.proficiency),
		length: Array.isArray(cls.proficiency) ? cls.proficiency.length : null,
	})
	shapes.set(key, (shapes.get(key) || 0) + 1)
}

console.log('SUMMARY')
console.log('base classes found:', baseClasses.length)
console.log('field: top-level "proficiency" — array of lowercase 3-letter ability codes (e.g. "str")')
console.log('shapes:')
for (const [shape, count] of shapes) {
	console.log(' ', count, shape)
}
console.log('examples:')
console.log(' ', JSON.stringify({ name: 'Fighter', proficiency: baseClasses.find((c) => c.name === 'Fighter').proficiency }))
console.log(' ', JSON.stringify({ name: 'Barbarian', proficiency: baseClasses.find((c) => c.name === 'Barbarian').proficiency }))
console.log(' ', JSON.stringify({ name: 'Wizard', proficiency: baseClasses.find((c) => c.name === 'Wizard').proficiency }))
