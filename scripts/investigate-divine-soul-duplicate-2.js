const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const matches = classes.filter((c) => c.entryType === 'subclass' && c.name === 'Divine Soul' && c.className === 'Sorcerer')

console.log('SUMMARY')
console.log('Divine Soul subclass entry count:', matches.length)
console.log(JSON.stringify(matches.map((m) => ({ source: m.source, classSource: m.classSource })), null, 2))
