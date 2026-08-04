/*
 * Confirms the sub-shape of availableTo.classes vs availableTo.classVariants
 * entries ahead of writing the class-spell-list filter (step 6c).
 */

const fs = require('fs')
const path = require('path')

const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

console.log('SUMMARY')

const withClasses = spells.find((s) => Array.isArray(s.availableTo.classes) && s.availableTo.classes.length > 0)
console.log('availableTo.classes[0] keys:', Object.keys(withClasses.availableTo.classes[0]))
console.log('example (trimmed):', JSON.stringify(withClasses.availableTo.classes[0]))

const withVariant = spells.find((s) => Array.isArray(s.availableTo.classVariants) && s.availableTo.classVariants.length > 0)
console.log('availableTo.classVariants[0] keys:', Object.keys(withVariant.availableTo.classVariants[0]))
console.log('example (trimmed):', JSON.stringify(withVariant.availableTo.classVariants[0]))

console.log()
console.log('level field:', typeof withClasses.level, '| ritual field:', 'ritual' in withClasses, '| concentration field present anywhere?')
const withConc = spells.find((s) => s.duration && JSON.stringify(s.duration).includes('concentration'))
console.log('duration example (trimmed, shows concentration flag location):', withConc ? JSON.stringify(withConc.duration).slice(0, 150) : 'none found')
console.log('meta.ritual example:', JSON.stringify(withClasses.meta))
console.log('top-level keys of a spell:', Object.keys(withClasses))
