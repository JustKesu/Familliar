const fs = require('fs')
const path = require('path')

const subclassFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subclass-features.json'), 'utf8'))

// For colliding keys, check whether the differing classSource groups carry
// the same set of levels/entries (harmless duplicate) or actually differ
// (would silently merge two editions' features under the relaxed join).
const byRelaxedKey = new Map()
for (const f of subclassFeatures) {
  const key = `${f.className}|${f.subclassShortName}|${f.subclassSource}`
  if (!byRelaxedKey.has(key)) byRelaxedKey.set(key, [])
  byRelaxedKey.get(key).push(f)
}

let sameContent = 0
let diffContent = 0
const diffExamples = []
for (const [key, feats] of byRelaxedKey) {
  const classSources = new Set(feats.map((f) => f.classSource))
  if (classSources.size <= 1) continue

  const byClassSource = new Map()
  for (const f of feats) {
    if (!byClassSource.has(f.classSource)) byClassSource.set(f.classSource, [])
    byClassSource.get(f.classSource).push(f)
  }
  const groups = [...byClassSource.entries()]
  const serialize = (arr) =>
    JSON.stringify(
      arr
        .map((f) => ({ level: f.level, entries: f.entries }))
        .sort((a, b) => a.level - b.level),
    )
  const serialized = groups.map(([cs, arr]) => serialize(arr))
  const allSame = serialized.every((s) => s === serialized[0])
  if (allSame) {
    sameContent++
  } else {
    diffContent++
    if (diffExamples.length < 3) {
      diffExamples.push(`${key} -> ${groups.map(([cs, arr]) => `${cs}: levels ${arr.map((f) => f.level).join(',')}`).join(' vs ')}`)
    }
  }
}

console.log('SUMMARY')
console.log('Colliding keys with identical entries/levels across classSource (harmless dup):', sameContent)
console.log('Colliding keys with differing entries/levels across classSource (real risk):', diffContent)
console.log('Diff examples:', diffExamples.length ? diffExamples.join(' || ') : 'none')
