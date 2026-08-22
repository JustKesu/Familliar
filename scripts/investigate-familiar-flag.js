/*
 * Step 6b slice 2 pre-check: does 5etools' own `familiar: true` flag agree
 * with what the Find Familiar spell text itself allows?
 * SUMMARY ONLY — counts and at most 3 short examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const beasts = JSON.parse(fs.readFileSync(path.join(dataDir, 'beasts.json'), 'utf8'))
const spells = JSON.parse(fs.readFileSync(path.join(dataDir, 'spells.json'), 'utf8'))

const flagged = beasts.filter((b) => b.familiar)
const cr0 = beasts.filter((b) => b.crNumber === 0)

console.log('beasts total:', beasts.length)
console.log('familiar:true :', flagged.length, '| crNumber === 0 :', cr0.length)

const flaggedNotCr0 = flagged.filter((b) => b.crNumber !== 0)
const cr0NotFlagged = cr0.filter((b) => !b.familiar)
console.log('\nflagged but NOT CR 0:', flaggedNotCr0.length)
flaggedNotCr0.forEach((b) => console.log(`  ${b.name} — cr "${b.cr}" (crNumber ${b.crNumber}), size ${JSON.stringify(b.size)}`))
console.log('CR 0 but NOT flagged:', cr0NotFlagged.length)
cr0NotFlagged.slice(0, 5).forEach((b) => console.log(`  ${b.name} — size ${JSON.stringify(b.size)}`))

// The 11 creatures the spell text names by hand.
const NAMED = ['Bat', 'Cat', 'Frog', 'Hawk', 'Lizard', 'Octopus', 'Owl', 'Rat', 'Raven', 'Spider', 'Weasel']
const namedMissing = NAMED.filter((n) => !beasts.some((b) => b.name === n))
const namedNotFlagged = NAMED.filter((n) => beasts.some((b) => b.name === n && !b.familiar))
const namedNotCr0 = NAMED.filter((n) => beasts.some((b) => b.name === n && b.crNumber !== 0))
console.log('\nnamed-in-spell missing from pool:', namedMissing.length ? namedMissing.join(',') : '(none)')
console.log('named-in-spell without familiar flag:', namedNotFlagged.length ? namedNotFlagged.join(',') : '(none)')
console.log('named-in-spell not at CR 0:', namedNotCr0.length ? namedNotCr0.join(',') : '(none)')

// What the spell text actually says about the limit.
// The spell's own {@filter} also excludes swarms — check whether that bites.
const isSwarm = (b) => Boolean(b.type && typeof b.type === 'object' && b.type.swarmSize)
console.log('\nswarms among CR 0 beasts:', cr0.filter(isSwarm).length)
console.log('swarms among familiar-flagged:', flagged.filter(isSwarm).length)

const spell = spells.find((s) => s.name === 'Find Familiar')
function flatten(entries) {
	if (!entries) return ''
	return entries
		.map((e) => {
			if (typeof e === 'string') return e
			if (e && e.entries) return flatten(e.entries)
			if (e && e.items) return flatten(e.items)
			return ''
		})
		.join(' ')
}
const text = flatten(spell && spell.entries)
const limit = text.match(/[^.]*Challenge Rating[^.]*\./i)
console.log('\nFind Familiar found:', !!spell)
console.log('CR clause in spell text:', limit ? limit[0].trim() : '(not matched)')
