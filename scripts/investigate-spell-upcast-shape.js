// Ahead of build order step 6 "At Higher Levels" display (D46): confirms the
// field(s) that carry upcasting/scaling text in spells.json.
const fs = require('fs')
const path = require('path')

const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

const withHigherLevel = spells.filter((s) => Array.isArray(s.entriesHigherLevel) && s.entriesHigherLevel.length > 0)
const withScalingDice = spells.filter((s) => s.scalingLevelDice)
const withBoth = spells.filter((s) => Array.isArray(s.entriesHigherLevel) && s.entriesHigherLevel.length > 0 && s.scalingLevelDice)

const healingWord = spells.find((s) => s.name === 'Healing Word')
const scalingCantrip = withScalingDice[0]

console.log('SUMMARY')
console.log('Total spells:', spells.length)
console.log('With entriesHigherLevel:', withHigherLevel.length)
console.log('With scalingLevelDice:', withScalingDice.length)
console.log('With both:', withBoth.length)

console.log('\nExample entriesHigherLevel (Healing Word, trimmed):')
console.log(JSON.stringify(healingWord ? healingWord.entriesHigherLevel : null, null, 2))

console.log('\nExample scalingLevelDice shape (trimmed):', scalingCantrip ? scalingCantrip.name : 'none found')
console.log(JSON.stringify(scalingCantrip ? scalingCantrip.scalingLevelDice : null, null, 2))
