/*
 * Build order step 6a, final slice part 2 (D46): confirm the shape of the
 * `senses` field on optional-features.json and feats.json before writing the
 * extractor. Questions to answer:
 *   1. Which sense TYPES occur (blindsight/darkvision/truesight/tremorsense),
 *      and is a grant ever a plain string rather than a structured object?
 *   2. How is a range expressed — always a plain number of feet?
 *   3. Is a grant ever more than one sense at once, or a `choose` node?
 *   4. Is any grant DARKVISION — speciesTraits.ts already computes darkvision
 *      from the character's species, so a granted darkvision would sit
 *      alongside that, not replace or feed it. Report every case plainly so
 *      this can be raised rather than merged silently.
 *   5. For each carrying entry, is it actually REACHABLE through a picker —
 *      an optional-features.json entry whose featureType is only `FS:*` codes
 *      resolves to feats.json instead (D12; optionalFeatureSpells.ts hit the
 *      same dead-data shape for additionalSpells), so it would never be
 *      offered even though the raw entry carries `senses`.
 * SUMMARY ONLY — counts and full examples for the (small) matching sets
 * (CLAUDE.md).
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'data')
function load(file) {
	return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

const optionalFeatures = load('optional-features.json')
const feats = load('feats.json')
const classes = load('classes.json')

console.log('=== scope ===')
console.log('optional-features.json entries:', optionalFeatures.length)
console.log('feats.json entries:', feats.length)

const optCarrying = optionalFeatures.filter((e) => e.senses !== undefined)
const featCarrying = feats.filter((e) => e.senses !== undefined)
console.log('optional-features.json carrying `senses`:', optCarrying.length)
console.log('feats.json carrying `senses`:', featCarrying.length)

function describeShape(value) {
	if (typeof value === 'string') return `STRING:"${value}"`
	if (!Array.isArray(value)) return `NOT-ARRAY:${typeof value}`
	return value.map((item) => (typeof item === 'string' ? `string:"${item}"` : `object:{${Object.keys(item ?? {}).join(',')}}`)).join(' | ')
}

console.log('')
console.log('=== 1/2/3. full `senses` value, every carrying entry ===')
for (const e of [...optCarrying, ...featCarrying]) {
	console.log(`  [${optionalFeatures.includes(e) ? 'OPT' : 'FEAT'}] ${e.name}|${e.source}${e.featureType ? ' featureType=' + JSON.stringify(e.featureType) : ''}`)
	console.log(`    raw: ${JSON.stringify(e.senses)}`)
	console.log(`    shape: ${describeShape(e.senses)}`)
}

console.log('')
console.log('=== 4. any grant DARKVISION? (speciesTraits.ts already computes darkvision — flag, do not merge) ===')
const darkvisionGrants = []
for (const e of [...optCarrying, ...featCarrying]) {
	if (!Array.isArray(e.senses)) continue
	for (const item of e.senses) {
		if (item && typeof item === 'object' && 'darkvision' in item) darkvisionGrants.push(`${e.name} (${optionalFeatures.includes(e) ? 'optional feature' : 'feat'}): darkvision ${item.darkvision}`)
	}
}
console.log('darkvision grants found:', darkvisionGrants.length)
for (const g of darkvisionGrants) console.log(`  ${g}`)

console.log('')
console.log('=== 5. reachability of each optional-features.json carrying entry ===')
// Mirrors optionalFeatureData.ts's own resolution: an FS:* featureType code
// resolves to feats.json's FS category instead (D12), so an entry reachable
// ONLY via FS:* codes is never offered by any picker despite carrying `senses`.
for (const e of optCarrying) {
	const codes = Array.isArray(e.featureType) ? e.featureType : []
	const reachableCodes = codes.filter((c) => !c.startsWith('FS:'))
	const grantingSubclasses = []
	for (const code of reachableCodes) {
		for (const cls of classes) {
			if (cls.entryType !== 'subclass') continue
			const prog = Array.isArray(cls.optionalfeatureProgression) ? cls.optionalfeatureProgression : []
			for (const p of prog) {
				if (Array.isArray(p.featureType) && p.featureType.includes(code)) grantingSubclasses.push(`${cls.name} (${cls.className}) via ${code}`)
			}
		}
	}
	console.log(`  ${e.name}: featureType=${JSON.stringify(codes)} reachableCodes=${JSON.stringify(reachableCodes)}`)
	console.log(`    reachable via: ${grantingSubclasses.length > 0 ? grantingSubclasses.join(', ') : reachableCodes.length === 0 ? 'NEVER — every code is FS:* (D12 dead data, same shape optionalFeatureSpells.ts found)' : 'no matching subclass progression found'}`)
}

console.log('')
console.log('=== each feats.json carrying entry: is it hidden from the feat picker? ===')
// featAsiData.ts's HIDDEN_FEAT_KEYS list decides this; read the module's own
// exported list rather than re-deriving a name/source key scheme here.
let hiddenKeys
try {
	const featAsiSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'featAsi', 'featAsiData.ts'), 'utf8')
	const match = featAsiSrc.match(/HIDDEN_FEAT_KEYS[^=]*=\s*(\[[\s\S]*?\])/)
	hiddenKeys = match ? match[1] : null
} catch {
	hiddenKeys = null
}
console.log('HIDDEN_FEAT_KEYS block found in featAsiData.ts:', hiddenKeys !== null)
for (const e of featCarrying) {
	const mentioned = hiddenKeys ? hiddenKeys.includes(e.name) : 'unknown (block not found)'
	console.log(`  ${e.name}|${e.source}: name appears in HIDDEN_FEAT_KEYS block: ${mentioned}`)
}

console.log('')
console.log('=== does any option/feat carrying `senses` also carry `additionalSpells`? (overlap with the already-built spell path) ===')
for (const e of [...optCarrying, ...featCarrying]) {
	if (e.additionalSpells !== undefined) console.log(`  ${e.name}: YES — also grants spells`)
}
console.log('(none printed above means no overlap)')
