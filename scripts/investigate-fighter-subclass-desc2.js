const fs = require('fs')
const path = require('path')

const subclassFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subclass-features.json'), 'utf8'))

const names = ['Arcane Archer', 'Cavalier', 'Samurai', 'Rune Knight']
for (const shortName of ['AA', 'Cavalier', 'Samurai', 'Rune Knight']) {
  // try matching by subclassShortName loosely
}

console.log('SUMMARY: all subclass-features.json entries whose subclassShortName looks related to the 4 silent subclasses')
const matches = subclassFeatures.filter(f => ['Arcane Archer','Cavalier','Samurai','Rune Knight','AA'].includes(f.subclassShortName))
console.log('count:', matches.length)
const uniqueCombos = new Map()
for (const m of matches) {
  const key = `${m.className}|${m.classSource}|${m.subclassShortName}|${m.subclassSource}|lvl${m.level}`
  uniqueCombos.set(key, (uniqueCombos.get(key)||0)+1)
}
for (const [k,v] of uniqueCombos) console.log(k, v)
