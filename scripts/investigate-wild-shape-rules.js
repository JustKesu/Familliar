/*
 * Step 6b slice 3, step one: establish Wild Shape's limits from the DATA,
 * quoted, before any of them is hardcoded into a rules table.
 * Answers, per session brief:
 *   1. Wild Shape's feature text at every level it appears, and whether the
 *      Druid's classTableGroups carries a forms-known or uses column
 *   2. forms known per level, and whether it grows
 *   3. the CR cap per level, and when a Fly Speed becomes legal
 *   4. Circle of the Moon's Circle Forms text and how its cap is expressed
 * SUMMARY ONLY — counts and short quotes (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'))

const classes = readJson('classes.json')
const classFeatures = readJson('class-features.json')
const subclassFeatures = readJson('subclass-features.json')

function flatten(entries) {
	if (!entries) return ''
	return entries
		.map((e) => {
			if (typeof e === 'string') return e
			if (e && Array.isArray(e.entries)) return flatten(e.entries)
			if (e && Array.isArray(e.items)) return flatten(e.items)
			return ''
		})
		.join(' ')
}

// --- 1: the Druid's own class table -----------------------------------------
const druid = classes.find((c) => c.entryType === 'class' && c.name === 'Druid' && c.source === 'XPHB')
console.log('=== 1: Druid class table ===')
console.log('Druid found:', !!druid)
const tableGroups = (druid && druid.classTableGroups) || []
for (const group of tableGroups) {
	console.log('  colLabels:', JSON.stringify(group.colLabels || group.title || '(none)'))
}

// --- 2/3: Wild Shape feature text at every level ----------------------------
const wildShape = classFeatures.filter((f) => f.name === 'Wild Shape' && f.className === 'Druid')
console.log('\n=== 2/3: Wild Shape class feature ===')
console.log('entries in class-features.json:', wildShape.length, '- levels:', wildShape.map((f) => f.level).join(','))
for (const feature of wildShape) {
	const text = flatten(feature.entries)
	console.log(`\n--- level ${feature.level} (${feature.source}), ${text.length} chars ---`)
	console.log(text)
}

/*
 * The text points at a "Beast Shapes table" — flatten() above walks only
 * entries/items, so a table node is invisible to it. That table is where the
 * per-level numbers actually live, so dump every one inside the feature.
 */
function collectTables(node, found) {
	if (Array.isArray(node)) {
		for (const child of node) collectTables(child, found)
		return
	}
	if (typeof node !== 'object' || node === null) return
	if (node.type === 'table') found.push(node)
	for (const value of Object.values(node)) collectTables(value, found)
}

console.log('\n=== Beast Shapes table (inside the Wild Shape feature) ===')
for (const feature of wildShape) {
	const tables = []
	collectTables(feature.entries, tables)
	console.log(`level ${feature.level}: ${tables.length} table node(s)`)
	for (const table of tables) {
		console.log('  caption:', JSON.stringify(table.caption ?? '(none)'))
		console.log('  colLabels:', JSON.stringify(table.colLabels))
		for (const row of table.rows || []) console.log('   ', JSON.stringify(row))
	}
}

// The class table's own Wild Shape column — uses, or forms known?
console.log('\n=== Druid Features table, Wild Shape column ===')
for (const group of tableGroups) {
	const index = (group.colLabels || []).indexOf('Wild Shape')
	if (index === -1) continue
	console.log('  level -> Wild Shape value:')
	;(group.rows || []).forEach((row, rowIndex) => {
		console.log(`    lvl ${String(rowIndex + 1).padStart(2)}: ${JSON.stringify(row[index])}`)
	})
}

// Any other Druid feature naming Wild Shape (improvements at later levels).
const mentions = classFeatures.filter(
	(f) => f.className === 'Druid' && f.name !== 'Wild Shape' && /wild shape/i.test(flatten(f.entries)),
)
console.log('\nother Druid class features mentioning Wild Shape:', mentions.map((f) => `${f.name} (lvl ${f.level})`).join(', ') || '(none)')
for (const feature of mentions) {
	const text = flatten(feature.entries)
	const sentences = text.split(/(?<=\.)\s+/).filter((s) => /wild shape|challenge rating|fly speed/i.test(s))
	console.log(`  ${feature.name} (lvl ${feature.level}):`, sentences.join(' ').slice(0, 400))
}

// --- 4: Circle of the Moon --------------------------------------------------
console.log('\n=== 4: Circle of the Moon ===')
const moon = subclassFeatures.filter((f) => f.subclassShortName === 'Moon' || f.subclassName === 'Circle of the Moon')
console.log('Circle of the Moon features:', moon.map((f) => `${f.name} (lvl ${f.level})`).join(', ') || '(none)')
for (const feature of moon) {
	const text = flatten(feature.entries)
	if (!/challenge rating|wild shape|fly speed/i.test(text)) continue
	console.log(`\n--- ${feature.name}, level ${feature.level} ---`)
	console.log(text.slice(0, 900))
}

// --- the beast pool those limits select from --------------------------------
const beasts = readJson('beasts.json')
console.log('\n=== pool sizes the limits produce ===')
const hasFly = (b) => Boolean(b.speed && b.speed.fly)
// Every row of the Beast Shapes filter carries `miscellaneous=!swarm`.
const isSwarm = (b) => Boolean(b.type && typeof b.type === 'object' && b.type.swarmSize)
for (const cap of [0.25, 0.5, 1, 2, 3, 4, 5, 6]) {
	const atCap = beasts.filter((b) => b.crNumber <= cap)
	const legal = atCap.filter((b) => !isSwarm(b))
	console.log(
		`  CR <= ${String(cap).padEnd(4)} : ${String(atCap.length).padStart(2)} beasts (${atCap.filter(isSwarm).length} swarm) -> ${String(legal.length).padStart(2)} legal; without fly: ${legal.filter((b) => !hasFly(b)).length}`,
	)
}
