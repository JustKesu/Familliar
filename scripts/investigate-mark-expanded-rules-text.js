// D46: what does the rules text say about a mark's "expanded" spells?
const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))
const mark = feats.find((f) => f.name === 'Mark of Detection')

console.log('SUMMARY')
console.log('name:', mark.name, 'source:', mark.source)
console.log('prerequisite:', JSON.stringify(mark.prerequisite))
console.log('additionalSpells keys:', mark.additionalSpells.map((e) => Object.keys(e)))
console.log('entries (rules text):')
console.log(JSON.stringify(mark.entries, null, 1).slice(0, 4000))
