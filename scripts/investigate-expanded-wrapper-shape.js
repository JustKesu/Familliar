/*
 * Does the rank-keyed `expanded` grant (Hexblade/Fathomless patron boon
 * spells, handled by extractRankGrantAlwaysPreparedSpells) ever carry a
 * will/daily/ritual/resource wrapper the way prepared/known/innate do, or is
 * it always a bare array of refs? Needed to know whether the new usage-term
 * extraction must also cover this second code path in
 * subclassPreparedSpells.ts.
 */
const fs = require('fs')
const path = require('path')

function isRecord(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'classes.json'), 'utf8'))
for (const s of classes.filter((c) => c.entryType === 'subclass' && c.className === 'Warlock' && /Hexblade|Fathomless/.test(c.name))) {
	for (const entry of s.additionalSpells || []) {
		if (!isRecord(entry.expanded)) continue
		console.log(s.name, s.source)
		for (const [rank, value] of Object.entries(entry.expanded)) {
			console.log('  expanded.' + rank, ':', JSON.stringify(value).slice(0, 150))
		}
	}
}
