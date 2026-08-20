// Investigating the reported Bless duplicate for Sorcerer Divine Soul (bug fix task).
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const divineSoul = classes.find((c) => c.entryType === 'subclass' && c.name === 'Divine Soul' && c.className === 'Sorcerer')

console.log('SUMMARY')
console.log('Divine Soul entry found:', !!divineSoul)
console.log('additionalSpells length:', divineSoul?.additionalSpells?.length)
console.log(JSON.stringify(divineSoul?.additionalSpells, null, 2))
