const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclassFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subclass-features.json'), 'utf8'))

const ALLOWED_CLASS_SOURCES = ['XPHB', 'EFA']
const ALLOWED_SOURCES = ['XPHB', 'XGE', 'TCE', 'EFA', 'XDMG', 'MPMM']

const subs = classes.filter(c => c.entryType === 'subclass' && ALLOWED_CLASS_SOURCES.includes(c.classSource) && ALLOWED_SOURCES.includes(c.source) && !c.reprintedAs)

let mismatched = 0, matched = 0
const examples = []
for (const sc of subs) {
  const anyMatch = subclassFeatures.some(f => f.className === sc.className && f.classSource === sc.classSource && f.subclassShortName === sc.shortName && f.subclassSource === sc.source)
  if (anyMatch) matched++
  else {
    mismatched++
    if (examples.length < 3) examples.push(`${sc.name} (${sc.className}/${sc.classSource}, source=${sc.source})`)
  }
}
console.log('SUMMARY')
console.log('Total allowed subclasses:', subs.length)
console.log('Have >=1 subclass-features.json match on classSource:', matched)
console.log('Zero matches (classSource mismatch suspected):', mismatched)
console.log('Examples:', examples.join(' | '))
