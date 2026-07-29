const fs = require('fs')
const path = require('path')

const subclassFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subclass-features.json'), 'utf8'))

// The relaxed join drops classSource from the match key. If two different
// classSource groups exist for the same className+subclassShortName+subclassSource,
// dropping classSource would silently merge their feature sets.
const byRelaxedKey = new Map()
for (const f of subclassFeatures) {
  const key = `${f.className}|${f.subclassShortName}|${f.subclassSource}`
  if (!byRelaxedKey.has(key)) byRelaxedKey.set(key, new Set())
  byRelaxedKey.get(key).add(f.classSource)
}

let collisions = 0
const examples = []
for (const [key, classSources] of byRelaxedKey) {
  if (classSources.size > 1) {
    collisions++
    if (examples.length < 3) examples.push(`${key} -> classSources: ${[...classSources].join(', ')}`)
  }
}

console.log('SUMMARY')
console.log('Distinct className+subclassShortName+subclassSource keys:', byRelaxedKey.size)
console.log('Keys with more than one classSource (collision risk):', collisions)
console.log('Examples:', examples.length ? examples.join(' | ') : 'none')
