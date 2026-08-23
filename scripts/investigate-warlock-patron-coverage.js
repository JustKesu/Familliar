/*
 * Surveys EVERY selectable Warlock patron (classes.json, after D27/D28's
 * source filter and D31's reprintedAs dedup — the same filter
 * src/subclass/subclassData.ts applies) and classifies each one's
 * additionalSpells against what src/spells/subclassPreparedSpells.ts
 * actually reads today: the fixed level-keyed prepared/known/innate loop,
 * and the pact-slot-rank `expanded` path.
 *
 * Asked for by the task brief: confirm the patrons the Hexblade/Fathomless
 * work did not name either already resolve or are a documented deferral, so
 * "the Warlock is complete apart from The Genie" can be stated from data
 * rather than assumed. Trimmed output only (CLAUDE.md).
 */
const fs = require('fs')
const path = require('path')

const ALLOWED_CLASS_SOURCES = ['XPHB', 'EFA']
const ALLOWED_SOURCES = ['XPHB', 'XGE', 'TCE', 'EFA', 'XDMG', 'MPMM']
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate']

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))

const patrons = classes.filter(
	(c) =>
		c.entryType === 'subclass' &&
		c.className === 'Warlock' &&
		ALLOWED_CLASS_SOURCES.includes(c.classSource) &&
		ALLOWED_SOURCES.includes(c.source) &&
		!c.reprintedAs,
)

function countRefs(value) {
	if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').length
	if (typeof value !== 'object' || value === null) return 0
	return Object.values(value).reduce((n, v) => n + countRefs(v), 0)
}

function classify(subclass) {
	const entries = subclass.additionalSpells || []
	if (entries.length === 0) return 'no additionalSpells -> nothing to grant'

	const notes = []
	let levelKeyed = 0
	let nonLevelKeyed = 0
	let rankKeyed = 0
	let otherExpanded = 0

	for (const entry of entries) {
		for (const key of FIXED_GRANT_KEYS) {
			const map = entry[key]
			if (typeof map !== 'object' || map === null) continue
			for (const [levelKey, value] of Object.entries(map)) {
				if (Number.isFinite(Number(levelKey))) levelKeyed += countRefs(value)
				else nonLevelKeyed += countRefs(value)
			}
		}
		const expanded = entry.expanded
		if (typeof expanded === 'object' && expanded !== null) {
			for (const [levelKey, value] of Object.entries(expanded)) {
				if (/^s[1-5]$/.test(levelKey)) rankKeyed += countRefs(value)
				else otherExpanded += countRefs(value)
			}
		}
	}

	if (levelKeyed) notes.push(`${levelKeyed} refs level-keyed fixed grant [HANDLED]`)
	if (nonLevelKeyed) notes.push(`${nonLevelKeyed} refs non-level key ("_") [SKIPPED by design]`)
	if (rankKeyed) notes.push(`${rankKeyed} refs rank-keyed expanded [${entries.length === 1 ? 'HANDLED' : 'DEFERRED, >1 entry'}]`)
	if (otherExpanded) notes.push(`${otherExpanded} refs other expanded key [not read]`)
	return notes.join('; ') || 'additionalSpells present but no readable refs'
}

console.log(`Selectable Warlock patrons: ${patrons.length}\n`)
for (const p of patrons) {
	console.log(`${p.name} (${p.source}) | entries=${(p.additionalSpells || []).length} | ${classify(p)}`)
}

const archfey = patrons.find((p) => /Archfey/.test(p.name))
console.log('\nArchfey non-level key detail:', JSON.stringify(archfey.additionalSpells[0].innate).slice(0, 160))
