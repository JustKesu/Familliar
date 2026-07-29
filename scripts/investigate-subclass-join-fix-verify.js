const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclassFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subclass-features.json'), 'utf8'))

const ALLOWED_CLASS_SOURCES = ['XPHB', 'EFA']
const ALLOWED_SOURCES = ['XPHB', 'XGE', 'TCE', 'EFA', 'XDMG', 'MPMM']

const subs = classes.filter(
  (c) => c.entryType === 'subclass' && ALLOWED_CLASS_SOURCES.includes(c.classSource) && ALLOWED_SOURCES.includes(c.source) && !c.reprintedAs,
)

// The 22 collision keys from investigate-subclass-join-collisions.js: className+subclassShortName+subclassSource
// with more than one classSource group.
const byRelaxedKey = new Map()
for (const f of subclassFeatures) {
  const key = `${f.className}|${f.subclassShortName}|${f.subclassSource}`
  if (!byRelaxedKey.has(key)) byRelaxedKey.set(key, new Set())
  byRelaxedKey.get(key).add(f.classSource)
}
const collisionKeys = new Set([...byRelaxedKey.entries()].filter(([, cs]) => cs.size > 1).map(([k]) => k))

let zeroFeatures = 0
let strictResolved = 0
let fallbackResolved = 0
const fallbackList = []
const zeroExamples = []
let fallbackHitsCollision = 0

for (const sc of subs) {
  const strictMatches = subclassFeatures.filter(
    (f) => f.className === sc.className && f.classSource === sc.classSource && f.subclassShortName === sc.shortName && f.subclassSource === sc.source,
  )
  if (strictMatches.length > 0) {
    strictResolved++
    continue
  }
  const relaxedMatches = subclassFeatures.filter(
    (f) => f.className === sc.className && f.subclassShortName === sc.shortName && f.subclassSource === sc.source,
  )
  if (relaxedMatches.length > 0) {
    fallbackResolved++
    fallbackList.push(`${sc.name} (${sc.className}/${sc.classSource}, source=${sc.source})`)
    const key = `${sc.className}|${sc.shortName}|${sc.source}`
    if (collisionKeys.has(key)) fallbackHitsCollision++
  } else {
    zeroFeatures++
    if (zeroExamples.length < 3) zeroExamples.push(`${sc.name} (${sc.className}/${sc.classSource}, source=${sc.source})`)
  }
}

console.log('SUMMARY')
console.log('Total offered subclasses:', subs.length)
console.log('Resolved by strict (classSource-matching) join:', strictResolved)
console.log('Resolved by relaxed fallback join:', fallbackResolved)
console.log('Still zero features after fallback:', zeroFeatures)
console.log('Zero examples:', zeroExamples.join(' | ') || 'none')
console.log('Fallback resolutions that also hit a collision key (should be 0):', fallbackHitsCollision)
console.log('Subclasses resolved via fallback:')
for (const s of fallbackList) console.log(' -', s)
