const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const glamour = classes.find((c) => c.entryType === 'subclass' && c.name === 'College of Glamour' && c.className === 'Bard' && c.source === 'XPHB')

console.log('SUMMARY')
console.log(JSON.stringify(glamour?.additionalSpells, null, 2))
