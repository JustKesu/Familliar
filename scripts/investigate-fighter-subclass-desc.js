const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclassFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subclass-features.json'), 'utf8'))

const fighterSubs = classes.filter(c => c.entryType === 'subclass' && c.className === 'Fighter' && c.classSource === 'XPHB')

console.log('SUMMARY')
console.log('Fighter subclass entries in classes.json:', fighterSubs.length)
console.log('---')
for (const sc of fighterSubs) {
  const keys = Object.keys(sc).sort()
  console.log(`${sc.name} | source=${sc.source} | reprintedAs=${!!sc.reprintedAs} | keys: ${keys.join(',')}`)
}

console.log('---')
console.log('subclass-features.json matches per subclass (className=Fighter, classSource=XPHB):')
for (const sc of fighterSubs) {
  const matches = subclassFeatures.filter(f => f.className === 'Fighter' && f.classSource === 'XPHB' && f.subclassShortName === sc.shortName && f.subclassSource === sc.source)
  const levels = matches.map(m => m.level).sort((a,b)=>a-b)
  const level3 = matches.find(m => m.level === 3)
  console.log(`${sc.name} (source=${sc.source}): ${matches.length} feature entries at levels [${levels.join(',')}]; level3 entries count = ${level3 ? level3.entries.length : 'NO LEVEL 3 MATCH'}`)
}
