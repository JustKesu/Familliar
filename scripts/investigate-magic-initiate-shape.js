/*
 * investigate-magic-initiate-shape.js
 * ====================================
 * Step 6 slice d5b-2. Confirms, before writing the picker, base Magic
 * Initiate's exact additionalSpells shape (the "pick one named alternative"
 * class-list choice, then cantrip + level-1 picks within it), and that the
 * three ";Class" variants + Boon of Siberys are the only feats to hide.
 *
 * Trimmed SUMMARY output only (CLAUDE.md).
 * Run: node scripts/investigate-magic-initiate-shape.js
 */

const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'feats.json'), 'utf8'))

console.log('SUMMARY')
const miNames = feats.filter((f) => /Magic Initiate/i.test(f.name)).map((f) => `${f.name}|${f.source}`)
console.log('feats matching /Magic Initiate/i:', miNames.length)
for (const n of miNames) console.log('  -', n)

const boon = feats.filter((f) => /Boon of Siberys/i.test(f.name)).map((f) => `${f.name}|${f.source}`)
console.log('feats matching /Boon of Siberys/i:', boon.length)
for (const n of boon) console.log('  -', n)

const base = feats.find((f) => f.name === 'Magic Initiate')
console.log('\nbase "Magic Initiate" additionalSpells (trimmed):')
console.log(JSON.stringify(base.additionalSpells).slice(0, 1200))

console.log('\nbase "Magic Initiate" ability field:', JSON.stringify(base.ability))

const variant = feats.find((f) => f.name.startsWith('Magic Initiate;'))
console.log('\none variant, e.g.', variant.name, 'additionalSpells (trimmed):')
console.log(JSON.stringify(variant.additionalSpells).slice(0, 1200))
