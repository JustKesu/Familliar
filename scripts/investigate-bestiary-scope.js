/*
 * Investigation only (no extraction change): scoping a possible future
 * Wild Shape / Find Familiar build order step. Answers, per session brief:
 *   1. bestiary source files present, and is a 2024-edition monster book
 *      among them (checked via `edition`, same field species use per D29 —
 *      not guessed)
 *   2. beast counts by CR (0-6) per source, Tiny+CR0 count (Find Familiar
 *      pool), swim/fly speed count (Wild Shape gate)
 *   3. top-level field shape of a beast entry, and cross-file refs
 *   5. rough extracted-size estimate for beasts at CR <= 6
 * SUMMARY ONLY — counts and up to 3 short examples (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const SOURCE_DATA_DIR = path.join(
	__dirname,
	'..',
	'data-source',
	'5etools-src-main',
	'5etools-src-main',
	'data',
)
const BESTIARY_DIR = path.join(SOURCE_DATA_DIR, 'bestiary')

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// --- Q1: which bestiary files exist, and is a 2024 monster book among them ---
const files = fs.readdirSync(BESTIARY_DIR).filter((f) => f.startsWith('bestiary-') && f.endsWith('.json'))
console.log('=== Q1: bestiary source files ===')
console.log('total bestiary-*.json files:', files.length)

// XMM (2025 Monster Manual) is explicitly excluded per DATA.md; XPHB/XDMG are
// the only 2024-line sources in ALLOWED_SOURCES. Check whether any bestiary
// file's entries actually carry edition:"one" or those sources.
let editionOneCount = 0
let editionOneSources = new Set()
let xphbOrXdmgCount = 0
const perFileMeta = []
for (const f of files) {
	const data = readJson(path.join(BESTIARY_DIR, f))
	const monsters = data.monster || []
	const sources = new Set(monsters.map((m) => m.source))
	const editionOne = monsters.filter((m) => m.edition === 'one')
	editionOneCount += editionOne.length
	editionOne.forEach((m) => editionOneSources.add(m.source))
	xphbOrXdmgCount += monsters.filter((m) => m.source === 'XPHB' || m.source === 'XDMG').length
	perFileMeta.push({ file: f, count: monsters.length, sources: [...sources] })
}
console.log('monsters with edition:"one" across ALL bestiary files:', editionOneCount, '- sources:', [...editionOneSources])
console.log('monsters with source XPHB or XDMG across ALL bestiary files:', xphbOrXdmgCount)
const xmmData = readJson(path.join(BESTIARY_DIR, 'bestiary-xmm.json'))
const xmmSample = xmmData.monster[0]
console.log('XMM sample monster top-level keys:', Object.keys(xmmSample))
console.log('XMM monsters with `edition` field at all:', xmmData.monster.filter((m) => m.edition !== undefined).length, '/', xmmData.monster.length)
console.log('XMM monsters with `basicRules2024` field:', xmmData.monster.filter((m) => m.basicRules2024 !== undefined).length, '/', xmmData.monster.length, '- sample value:', xmmSample.basicRules2024)
console.log('XMM monsters with `srd52` field:', xmmData.monster.filter((m) => m.srd52 !== undefined).length, '/', xmmData.monster.length, '- sample value:', xmmSample.srd52)

console.log('example per-file source tags (first 5 files):')
perFileMeta.slice(0, 5).forEach((m) => console.log(' ', m.file, '- monster count:', m.count, '- sources:', m.sources))
const bookLike = perFileMeta.filter((m) => m.count > 50).sort((a, b) => b.count - a.count)
console.log('largest bestiary files (likely core books):')
bookLike.slice(0, 6).forEach((m) => console.log(' ', m.file, m.count, m.sources))

// --- Q2/Q3: load ALL monsters, filter beasts ---
let allMonsters = []
for (const f of files) {
	const data = readJson(path.join(BESTIARY_DIR, f))
	allMonsters = allMonsters.concat((data.monster || []).map((m) => ({ ...m, __file: f })))
}
console.log('\n=== scope ===')
console.log('total monster entries across all bestiary files:', allMonsters.length)

function crToNumber(cr) {
	// cr can be a plain string ("1/4") or an object { cr: "1/4", ... } (legendary/coven CR)
	const raw = typeof cr === 'object' && cr !== null ? cr.cr : cr
	if (raw === undefined || raw === null) return undefined
	if (raw === '1/8') return 0.125
	if (raw === '1/4') return 0.25
	if (raw === '1/2') return 0.5
	const n = Number(raw)
	return Number.isNaN(n) ? undefined : n
}

const beasts = allMonsters.filter((m) => {
	const types = Array.isArray(m.type) ? m.type : [m.type]
	return types.some((t) => (typeof t === 'string' ? t === 'beast' : t && t.type === 'beast'))
})
console.log('total "beast"-type monster entries (all sources, all CR):', beasts.length)

// --- Q2 table: beast count per source x CR band 0-6 ---
console.log('\n=== Q2: beast counts by source x CR (0-6) ===')
const crBands = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6]
const bySource = {}
for (const b of beasts) {
	const cr = crToNumber(b.cr)
	if (cr === undefined || cr > 6) continue
	bySource[b.source] = bySource[b.source] || {}
	const key = String(cr)
	bySource[b.source][key] = (bySource[b.source][key] || 0) + 1
}
console.log('sources with beasts CR<=6:', Object.keys(bySource))
for (const [src, counts] of Object.entries(bySource)) {
	const total = Object.values(counts).reduce((a, b) => a + b, 0)
	console.log(` ${src}: total=${total}`, JSON.stringify(counts))
}

const beastsUnder6 = beasts.filter((b) => {
	const cr = crToNumber(b.cr)
	return cr !== undefined && cr <= 6
})
console.log('\nTOTAL beasts CR<=6 across all sources:', beastsUnder6.length)

// Find Familiar pool: Tiny size + CR 0
const tinyCr0 = beasts.filter((b) => crToNumber(b.cr) === 0 && Array.isArray(b.size) ? b.size.includes('T') : b.size === 'T')
const tinyCr0Fixed = beasts.filter((b) => {
	const cr = crToNumber(b.cr)
	const sizeArr = Array.isArray(b.size) ? b.size : [b.size]
	return cr === 0 && sizeArr.includes('T')
})
console.log('Tiny beasts at CR 0 (Find Familiar pool):', tinyCr0Fixed.length)
console.log('examples:', tinyCr0Fixed.slice(0, 3).map((b) => `${b.name} (${b.source})`))

// Wild Shape gate: swim or fly speed present (any nonzero value), among CR<=6 beasts
const swimOrFly = beastsUnder6.filter((b) => {
	const speed = b.speed || {}
	return !!speed.swim || !!speed.fly
})
console.log('\nbeasts CR<=6 with a swim or fly speed:', swimOrFly.length)
console.log('examples:', swimOrFly.slice(0, 3).map((b) => `${b.name} (CR ${b.cr}, swim=${!!(b.speed||{}).swim}, fly=${!!(b.speed||{}).fly})`))

// --- Q3: field shape of a typical beast entry ---
console.log('\n=== Q3: beast entry field shape ===')
const sample = beastsUnder6.find((b) => b.name === 'Wolf') || beastsUnder6[0]
console.log('sample entry:', sample.name, '- top-level keys:')
console.log(Object.keys(sample).sort())

const neededFields = ['ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'skill', 'senses', 'cr', 'size', 'trait', 'action', 'reaction', 'legendary']
console.log('\npresence of stat-block-relevant fields across', beastsUnder6.length, 'beasts (CR<=6):')
for (const field of neededFields) {
	const withField = beastsUnder6.filter((b) => b[field] !== undefined).length
	console.log(` ${field}: ${withField}/${beastsUnder6.length}`)
}

// cross-file reference check: _copy (derived stat blocks), otherSources, soundClip, etc.
const withCopy = beastsUnder6.filter((b) => b._copy !== undefined)
console.log('\nbeasts CR<=6 using `_copy` (derived from another entry, cross-file dependency):', withCopy.length)
console.log('examples:', withCopy.slice(0, 3).map((b) => `${b.name} copies ${b._copy && b._copy.name} (${b._copy && b._copy.source})`))

const withSpellcasting = beastsUnder6.filter((b) => JSON.stringify(b.trait || []).includes('{@spell'))
console.log('beasts CR<=6 whose traits reference {@spell ...} (cross-file spell ref):', withSpellcasting.length)

console.log('\napprox size of one raw beast JSON entry (bytes):', JSON.stringify(sample).length)
const totalBytesUnder6 = beastsUnder6.reduce((sum, b) => sum + JSON.stringify(b).length, 0)
console.log('sum of raw JSON.stringify length for all beasts CR<=6 (bytes, RAW not extracted shape):', totalBytesUnder6)
console.log('  (', (totalBytesUnder6 / 1024).toFixed(0), 'KB raw; extracted/trimmed fields would be smaller)')

// --- Q4: rule text from already-extracted data ---
console.log('\n=== Q4: rule text already extracted ===')
const dataDir = path.join(__dirname, '..', 'data')
const classFeatures = readJson(path.join(dataDir, 'class-features.json'))
const subclassFeatures = readJson(path.join(dataDir, 'subclass-features.json'))
const spells = readJson(path.join(dataDir, 'spells.json'))

function flattenEntries(entries) {
	if (!entries) return ''
	return entries
		.map((e) => {
			if (typeof e === 'string') return e
			if (e && e.entries) return flattenEntries(e.entries)
			if (e && e.items) return flattenEntries(e.items)
			return ''
		})
		.join(' ')
}

const wildShape = classFeatures.find((f) => f.name === 'Wild Shape' && f.className === 'Druid')
console.log('\nWild Shape feature found:', !!wildShape, wildShape ? `(source ${wildShape.source}, level ${wildShape.level})` : '')
if (wildShape) {
	const text = flattenEntries(wildShape.entries)
	console.log('Wild Shape full entries field is prose (no structured cr/speed cap fields on the feature object):', Object.keys(wildShape))
	const crMatch = text.match(/challenge rating of ([^.,;]+)/i)
	const swimFlyMatch = text.match(/[^.]*\b(swim(?:ming)? or fly(?:ing)?|fly(?:ing)? or swim(?:ming)?)[^.]*\./i)
	console.log('  CR clause found:', crMatch ? crMatch[0] : '(not matched, inspect manually)')
	console.log('  swim/fly clause found:', swimFlyMatch ? swimFlyMatch[0].trim() : '(not matched, inspect manually)')
	console.log('  --- full flattened text ---')
	console.log('  ', text)
}

const moonDruid = subclassFeatures.find((f) => f.name === 'Circle Forms' || (f.subclassName === 'Circle of the Moon' && /form/i.test(f.name)))
console.log('\nCircle of the Moon relevant feature found:', moonDruid ? moonDruid.name : '(none matched "Circle Forms"/form, listing subclass feature names)')
if (!moonDruid) {
	console.log('  Circle of the Moon feature names:', subclassFeatures.filter((f) => f.subclassName === 'Circle of the Moon').map((f) => f.name))
}
const moonFeature = moonDruid || subclassFeatures.find((f) => f.subclassName === 'Circle of the Moon' && /wild shape|combat/i.test(f.name))
if (moonFeature) {
	const text = flattenEntries(moonFeature.entries)
	const crMatch = text.match(/challenge rating of ([^.,;]+)/i)
	console.log('  found on feature:', moonFeature.name, '- CR clause:', crMatch ? crMatch[0] : '(not matched, inspect manually)')
	console.log('  --- full flattened text ---')
	console.log('  ', text)
}

const findFamiliar = spells.find((s) => s.name === 'Find Familiar')
console.log('\nFind Familiar spell found:', !!findFamiliar)
if (findFamiliar) {
	console.log('  top-level keys:', Object.keys(findFamiliar))
	const text = flattenEntries(findFamiliar.entries)
	const formsMatch = text.match(/choose[^.]*form[^.]*\./i) || text.match(/take the form[^.]*\./i)
	console.log('  forms clause found:', formsMatch ? formsMatch[0].trim() : '(not matched, inspect manually — printing first 400 chars)')
	if (!formsMatch) console.log('  first 400 chars:', text.slice(0, 400))
}
