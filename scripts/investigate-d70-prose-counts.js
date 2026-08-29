/*
 * D46 check ahead of the two D70 hand tables (weapon mastery counts for
 * Paladin/Ranger/Rogue, and Extra Attack's number of attacks). D70 says both
 * counts live only in prose or in a feature NAME; before writing either table
 * this confirms they are still genuinely absent structurally — a hand table
 * duplicating something the data already carries would be a liability.
 *
 * Prints a SUMMARY ONLY (CLAUDE.md): counts, the structured fields that do or
 * do not exist, and the one sentence behind each number.
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

function isRecord(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Flattens a 5etools entry tree to plain prose, dropping tables and stripping {@tag ...} markup. */
function flattenText(node, out) {
	if (typeof node === 'string') {
		out.push(node)
		return
	}
	if (Array.isArray(node)) {
		for (const item of node) flattenText(item, out)
		return
	}
	if (!isRecord(node)) return
	if (node.type === 'table') return
	for (const key of ['entry', 'entries', 'items']) {
		if (key in node) flattenText(node[key], out)
	}
}

function proseOf(entries) {
	const parts = []
	flattenText(entries, parts)
	return parts
		.join(' ')
		.replace(/\{@\w+ ([^|}]+)(\|[^}]*)?\}/g, '$1')
		.replace(/\s+/g, ' ')
}

function sentencesMatching(prose, pattern) {
	return prose.split(/(?<=[.!?])\s+/).filter((s) => pattern.test(s))
}

const classes = load('classes.json')
const classFeatures = load('class-features.json')
const subclassFeatures = load('subclass-features.json')

// ---------------------------------------------------------------------------
// 1. Weapon Mastery
// ---------------------------------------------------------------------------

console.log('=== Weapon Mastery: which classes carry the count structurally? ===')

const masteryFeatures = classFeatures.filter((f) => f.name === 'Weapon Mastery')
for (const feature of masteryFeatures) {
	const cls = classes.find((c) => c.entryType === 'class' && c.name === feature.className && c.source === feature.classSource)
	let column = null
	for (const group of cls?.classTableGroups ?? []) {
		const index = (group.colLabels ?? []).findIndex((label) => label === 'Weapon Mastery')
		if (index === -1) continue
		column = (group.rows ?? []).map((row) => row[index])
	}
	// Only levels where the value CHANGES, so a 20-row table stays one short line.
	const changes = []
	if (column) {
		column.forEach((value, i) => {
			if (i === 0 || String(value) !== String(column[i - 1])) changes.push(`L${i + 1}:${value}`)
		})
	}
	const numericKeys = Object.keys(feature).filter((k) => typeof feature[k] === 'number' && k !== 'level')
	console.log(
		`  ${feature.className} (${feature.classSource}) lvl ${feature.level} | table column: ${column ? changes.join(' ') : 'ABSENT'} | other numeric keys on the feature: ${numericKeys.length ? numericKeys.join(',') : 'none'}`,
	)
}

console.log('\n=== Weapon Mastery: the sentence naming the number, per class ===')
for (const feature of masteryFeatures) {
	const prose = proseOf(feature.entries)
	const sentences = sentencesMatching(prose, /\b(one|two|three|four|five|six|number)\b/i)
	console.log(`  ${feature.className}: "${(sentences[0] ?? prose).slice(0, 260)}"`)
}

console.log('\n=== Weapon Mastery: any OTHER feature (class OR subclass) that changes the number ===')
const masteryClasses = new Set(masteryFeatures.map((f) => `${f.className}|${f.classSource}`))
for (const feature of [...classFeatures, ...subclassFeatures]) {
	if (!masteryClasses.has(`${feature.className}|${feature.classSource}`)) continue
	if (feature.name === 'Weapon Mastery') continue
	const prose = proseOf(feature.entries)
	if (!/mastery propert|Weapon Mastery feature/i.test(prose)) continue
	const sentences = sentencesMatching(prose, /mastery propert|Weapon Mastery feature/i)
	console.log(`  ${feature.className} lvl ${feature.level} — ${feature.name}: "${(sentences[0] ?? '').slice(0, 240)}"`)
}

// ---------------------------------------------------------------------------
// 2. Extra Attack
// ---------------------------------------------------------------------------

console.log('\n=== Extra Attack: every feature whose name carries the count ===')
const extraAttack = [
	...classFeatures.map((f) => ({ ...f, where: 'class' })),
	...subclassFeatures.map((f) => ({ ...f, where: `subclass ${f.subclassShortName}` })),
].filter((f) => /extra attack/i.test(f.name))

const byName = new Map()
for (const feature of extraAttack) {
	if (!byName.has(feature.name)) byName.set(feature.name, [])
	byName.get(feature.name).push(`${feature.className} ${feature.where === 'class' ? '' : `(${feature.where}) `}lvl ${feature.level}`)
}
for (const [name, holders] of byName) {
	console.log(`  "${name}" — ${holders.length}: ${holders.join(', ')}`)
}

console.log('\n=== Extra Attack: is the number anywhere but the name? ===')
for (const name of byName.keys()) {
	const feature = extraAttack.find((f) => f.name === name)
	const numericKeys = Object.keys(feature).filter((k) => typeof feature[k] === 'number' && k !== 'level')
	const prose = proseOf(feature.entries)
	const sentences = sentencesMatching(prose, /\b(one|two|three|twice|thrice|number)\b/i)
	console.log(`  "${name}" | numeric keys besides level: ${numericKeys.length ? numericKeys.join(',') : 'none'}`)
	console.log(`      "${(sentences[0] ?? prose).slice(0, 240)}"`)
}

console.log('\n=== Extra Attack: does any class table carry an attack-count column? ===')
const attackColumns = []
for (const cls of classes) {
	for (const group of cls.classTableGroups ?? []) {
		for (const label of group.colLabels ?? []) {
			if (typeof label === 'string' && /attack/i.test(label)) attackColumns.push(`${cls.name}: ${label}`)
		}
	}
}
console.log(`  ${attackColumns.length ? attackColumns.join(' | ') : 'none — no class table has an attack-count column'}`)
