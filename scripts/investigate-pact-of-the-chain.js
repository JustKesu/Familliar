/*
 * Find Familiar picker (step 6b follow-up): which creature forms does Pact of
 * the Chain actually name in the 2024 data? The list must come from the
 * invocation's own text, not from memory or the 2014 edition.
 * Also checks whether those creatures exist in the bestiary under XMM, since
 * the extraction takes XMM only (D67).
 * SUMMARY ONLY — counts and at most 3 examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
const bestiaryDir = path.join(__dirname, '..', 'data-source', '5etools-src-main', '5etools-src-main', 'data', 'bestiary')

const optionalFeatures = JSON.parse(fs.readFileSync(path.join(dataDir, 'optional-features.json'), 'utf8'))

const matches = optionalFeatures.filter((entry) => /chain/i.test(entry.name))
console.log('=== optional features whose name mentions "chain" ===')
for (const entry of matches) {
	console.log(`  ${entry.name} | ${entry.source} | featureType=${JSON.stringify(entry.featureType)}`)
}

const chain = matches.find((entry) => entry.name === 'Pact of the Chain' && entry.source === 'XPHB')
if (!chain) {
	console.log('NONE FOUND')
	process.exit(0)
}

console.log('')
console.log(`=== "${chain.name}" (${chain.source}) entries, verbatim ===`)
function printEntries(value, indent) {
	if (typeof value === 'string') {
		console.log(indent + value)
		return
	}
	if (Array.isArray(value)) {
		for (const item of value) printEntries(item, indent)
		return
	}
	if (value && typeof value === 'object') {
		console.log(`${indent}[${value.type}${value.name ? ' "' + value.name + '"' : ''}]`)
		printEntries(value.entries ?? value.items ?? [], indent + '  ')
	}
}
printEntries(chain.entries ?? [], '  ')

console.log('')
console.log('=== {@creature ...} tags found in that text ===')
const flat = JSON.stringify(chain.entries ?? [])
const tagged = [...flat.matchAll(/\{@creature ([^}]+)\}/g)].map((m) => m[1])
const names = [...new Set(tagged.map((raw) => raw.split('|')[0]))]
console.log('  raw tags:', JSON.stringify([...new Set(tagged)]))
console.log('  distinct names:', JSON.stringify(names))

console.log('')
console.log('=== do those creatures exist under XMM in the bestiary? ===')
const files = fs.readdirSync(bestiaryDir).filter((n) => n.startsWith('bestiary-') && n.endsWith('.json'))
const bySource = new Map()
for (const file of files) {
	for (const monster of JSON.parse(fs.readFileSync(path.join(bestiaryDir, file), 'utf8')).monster || []) {
		const key = `${String(monster.name).toLowerCase()}|${monster.source}`
		if (!bySource.has(key)) bySource.set(key, monster)
	}
}
const KEPT = ['name', 'source', 'size', 'type', 'cr', 'ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha',
	'save', 'skill', 'senses', 'passive', 'resist', 'immune', 'vulnerable', 'conditionImmune', 'alignment',
	'initiative', 'familiar', 'trait', 'action', 'bonus', 'reaction', 'legendary']
const REQUIRED = ['name', 'source', 'size', 'type', 'cr', 'ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'action']
const BOOKKEEPING = new Set(['page', 'soundClip', 'hasToken', 'hasFluff', 'hasFluffImages', 'srd52', 'basicRules2024',
	'otherSources', 'referenceSources', 'reprintedAs', 'traitTags', 'damageTags', 'damageTagsSpell', 'senseTags',
	'miscTags', 'actionTags', 'conditionInflict', 'conditionInflictSpell', 'savingThrowForced', 'environment',
	'group', 'languageTags', 'spellcastingTags', 'attachedItems', 'dragonAge', 'summonedBySpell', '_versions',
	'damageTagsLegendary', 'conditionInflictLegendary', 'savingThrowForcedLegendary', 'alignmentPrefix', 'level',
	'gearTags', 'treasure', 'familiar', 'legendaryGroup', 'token', 'tokenUrl', 'altArt', 'edition', 'name', 'source'])
const missingRequired = []
const unexpectedFields = new Set()
for (const name of names) {
	const xmm = bySource.get(`${name.toLowerCase()}|XMM`)
	if (!xmm) {
		const anywhere = [...bySource.keys()].filter((k) => k.startsWith(`${name.toLowerCase()}|`))
		console.log(`  ${name}: NOT in XMM; sources = ${JSON.stringify(anywhere.map((k) => k.split('|')[1]))}`)
		continue
	}
	const type = typeof xmm.type === 'string' ? xmm.type : xmm.type && xmm.type.type
	const missing = REQUIRED.filter((f) => xmm[f] === undefined || (Array.isArray(xmm[f]) && xmm[f].length === 0))
	if (missing.length) missingRequired.push(`${name}: ${missing.join(',')}`)
	for (const key of Object.keys(xmm)) if (!KEPT.includes(key) && !BOOKKEEPING.has(key)) unexpectedFields.add(key)
	console.log(`  ${name}: XMM ok — type=${type} cr=${JSON.stringify(xmm.cr)} size=${JSON.stringify(xmm.size)} familiarFlag=${Boolean(xmm.familiar)}`)
}
console.log('')
console.log('=== stat-block completeness of the named forms ===')
console.log('  missing required fields:', missingRequired.length ? JSON.stringify(missingRequired) : 'none')
console.log('  fields present that the beast extractor neither keeps nor knowingly drops:', JSON.stringify([...unexpectedFields]))
for (const field of unexpectedFields) {
	const who = names.filter((n) => (bySource.get(`${n.toLowerCase()}|XMM`) || {})[field] !== undefined)
	console.log(`    ${field}: ${JSON.stringify(who)}`)
}
console.log('')
console.log('=== shape of the three new fields (1 example each) ===')
const imp = bySource.get('imp|XMM')
console.log('  Imp.languages:', JSON.stringify(imp.languages))
console.log('  Imp.spellcasting:', JSON.stringify(imp.spellcasting).slice(0, 600))
console.log('  Skeleton.gear:', JSON.stringify(bySource.get('skeleton|XMM').gear))
console.log('')
console.log('  same fields among the 89 XMM beasts already extracted (CR <= 6):')
for (const field of unexpectedFields) {
	const hits = [...bySource.values()].filter((m) => m.source === 'XMM' && m[field] !== undefined
		&& (typeof m.type === 'string' ? m.type === 'beast' : m.type && m.type.type === 'beast'))
	console.log(`    ${field}: ${hits.length}${hits.length ? ' e.g. ' + hits.slice(0, 3).map((m) => m.name).join(', ') : ''}`)
}
