const fs = require('fs')
const path = require('path')

const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

const blessEntries = spells.filter((s) => s.name.toLowerCase() === 'bless')

console.log('SUMMARY')
console.log('Bless entries found:', blessEntries.length)
console.log(JSON.stringify(blessEntries.map((s) => ({ name: s.name, source: s.source, level: s.level })), null, 2))
