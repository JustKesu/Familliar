/*
 * Far Scribe is one of the 12 bare-`innate` EI grants, but its truncated
 * prose (investigate-ei-grant-prose.js) didn't show a "without expending a
 * spell slot" phrase the way the other 11 did. Checking its full entry and
 * additionalSpells content before labeling it "no spell slot" too — per the
 * user's decision, a bare grant that does NOT actually verify as slot-free
 * must get no label at all, not the same default as the rest.
 */
const fs = require('fs')
const path = require('path')

const optionalFeatures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'optional-features.json'), 'utf8'))
const farScribe = optionalFeatures.find((f) => f.name === 'Far Scribe')
console.log('additionalSpells:', JSON.stringify(farScribe.additionalSpells))
console.log('\nfull prose:')
console.log(farScribe.entries.filter((e) => typeof e === 'string').join('\n'))
