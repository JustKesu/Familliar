// D46: confirm only the 12 Mark feats carry additionalSpells.expanded (no other feat needs guarding against).
const fs = require('fs')
const path = require('path')

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/feats.json'), 'utf8'))

const withExpanded = []
for (const feat of feats) {
	if (!Array.isArray(feat.additionalSpells)) continue
	if (feat.additionalSpells.some((e) => e && typeof e === 'object' && e.expanded !== undefined)) {
		withExpanded.push(feat.name)
	}
}

console.log('SUMMARY')
console.log('feats with additionalSpells.expanded:', withExpanded.length)
console.log(withExpanded)
