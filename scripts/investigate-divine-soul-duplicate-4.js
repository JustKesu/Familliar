const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const matches = classes.filter((c) => c.entryType === 'subclass' && c.name === 'Divine Soul')

console.log('SUMMARY')
console.log('ALL "Divine Soul" subclass entries (any class):', matches.length)
console.log(JSON.stringify(matches.map((m) => ({ source: m.source, className: m.className, classSource: m.classSource, reprintedAs: m.reprintedAs })), null, 2))
