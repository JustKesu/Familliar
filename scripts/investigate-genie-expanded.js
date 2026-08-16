/*
 * Follow-up check: does Warlock The Genie's `expanded` also use the "s1".."s5"
 * rank-key shape? If so, a purely shape-based rule ("any expanded with sN
 * keys is a rank-keyed fixed grant") would wrongly grant all 4 genie kinds'
 * spells at once — Genie must stay excluded by name, not just by shape.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const genie = classes.find((c) => c.entryType === 'subclass' && c.className === 'Warlock' && /Genie/.test(c.name))
for (const entry of genie.additionalSpells) {
	console.log('name:', entry.name, '| keys:', Object.keys(entry), '| expanded:', JSON.stringify(entry.expanded).slice(0, 200))
}
