/*
 * Groundwork for a resolver returning a character's FULL set of granted class
 * and subclass features (not the three narrow slices the sheet renders today).
 *
 * Answers four questions with counts, never with dumps:
 *   1. what a naive "every feature at or below level" filter returns;
 *   2. how "directly granted at a level" is told apart from "pulled in by
 *      D50's recursive ref-collection" — classes.json classFeatureIds /
 *      subclassFeatureIds;
 *   3. what would collide with the three sources the sheet already renders;
 *   4. how many of each set pass D86's isActionTableFeature.
 *
 * Run: node scripts/investigate-full-feature-resolution.js
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
}

const classes = readJson('classes.json')
const classFeatures = readJson('class-features.json')
const subclassFeatures = readJson('subclass-features.json')

const classEntries = classes.filter((e) => e.entryType === 'class')
const subclassEntries = classes.filter((e) => e.entryType === 'subclass')

// ---------------------------------------------------------------------------
// 1. Granted-by-id vs collected-by-ref
// ---------------------------------------------------------------------------

const grantedClassIds = new Set(classEntries.flatMap((e) => e.classFeatureIds || []))
const grantedSubclassIds = new Set(subclassEntries.flatMap((e) => e.subclassFeatureIds || []))

const classGranted = classFeatures.filter((f) => grantedClassIds.has(f.id))
const classRefOnly = classFeatures.filter((f) => !grantedClassIds.has(f.id))
const subGranted = subclassFeatures.filter((f) => grantedSubclassIds.has(f.id))
const subRefOnly = subclassFeatures.filter((f) => !grantedSubclassIds.has(f.id))

console.log('=== 1. granted-by-id vs collected-by-ref (D50) ===')
console.log(`class-features.json    ${classFeatures.length} total = ${classGranted.length} in a class classFeatureIds + ${classRefOnly.length} ref-collected only`)
console.log(`subclass-features.json ${subclassFeatures.length} total = ${subGranted.length} in a subclass subclassFeatureIds + ${subRefOnly.length} ref-collected only`)
console.log('ref-collected-only class features, first 3:')
for (const f of classRefOnly.slice(0, 3)) console.log(`  "${f.name}" ${f.className} L${f.level}  id=${f.id}`)
console.log('ref-collected-only subclass features, first 3:')
for (const f of subRefOnly.slice(0, 3)) console.log(`  "${f.name}" ${f.className}/${f.subclassShortName} L${f.level}`)

const refOnlyWithLevel = [...classRefOnly, ...subRefOnly].filter((f) => typeof f.level === 'number').length
console.log(`ref-collected-only entries that STILL carry a numeric level (invisible to a level filter): ${refOnlyWithLevel} of ${classRefOnly.length + subRefOnly.length}`)

// ---------------------------------------------------------------------------
// 2. gainSubclassFeature placeholders
// ---------------------------------------------------------------------------

const gainSubclassRefs = classEntries.flatMap((e) =>
	(e.classFeatures || []).filter((r) => r && typeof r === 'object' && r.gainSubclassFeature).map((r) => `${e.name}: ${r.classFeature.split('|')[0]}`),
)
console.log('')
console.log('=== 2. gainSubclassFeature markers on class classFeatures refs ===')
console.log(`count: ${gainSubclassRefs.length}; distinct feature names: ${[...new Set(gainSubclassRefs.map((s) => s.split(': ')[1]))].join(', ')}`)

// ---------------------------------------------------------------------------
// 3. Worked levels — what a naive resolver returns
// ---------------------------------------------------------------------------

function resolveNaive(className, classSource, level, subclassShort, subclassSource) {
	const cf = classFeatures.filter((f) => f.className === className && f.classSource === classSource && f.level <= level)
	const sf = subclassShort
		? subclassFeatures.filter(
				(f) => f.className === className && f.classSource === classSource && f.subclassShortName === subclassShort && f.subclassSource === subclassSource && f.level <= level,
			)
		: []
	return { cf, sf }
}

const CASES = [
	['Cleric', 'XPHB', 5, 'Life', 'XPHB'],
	['Sorcerer', 'XPHB', 5, 'Draconic', 'XPHB'],
	['Fighter', 'XPHB', 5, 'Champion', 'XPHB'],
	['Warlock', 'XPHB', 5, 'Fiend', 'XPHB'],
]

console.log('')
console.log('=== 3. naive "level <= N" resolve, per case (granted / ref-only split) ===')
for (const [cn, cs, lvl, sn, ss] of CASES) {
	const { cf, sf } = resolveNaive(cn, cs, lvl, sn, ss)
	const cfGranted = cf.filter((f) => grantedClassIds.has(f.id))
	const cfRef = cf.filter((f) => !grantedClassIds.has(f.id))
	const sfGranted = sf.filter((f) => grantedSubclassIds.has(f.id))
	const sfRef = sf.filter((f) => !grantedSubclassIds.has(f.id))
	console.log(`${cn} ${sn} L${lvl}: class ${cf.length} (${cfGranted.length} granted / ${cfRef.length} ref-only), subclass ${sf.length} (${sfGranted.length} / ${sfRef.length})`)
	if (cfRef.length > 0) console.log(`  class ref-only would wrongly list: ${cfRef.map((f) => `${f.name} L${f.level}`).join(', ')}`)
	if (sfRef.length > 0) console.log(`  subclass ref-only would wrongly list: ${sfRef.map((f) => `${f.name} L${f.level}`).join(', ')}`)
}

// ---------------------------------------------------------------------------
// 4. Collisions with the three sources the sheet renders today
// ---------------------------------------------------------------------------

function findNodesOfType(node, type, out) {
	if (Array.isArray(node)) for (const n of node) findNodesOfType(n, type, out)
	else if (node && typeof node === 'object') {
		if (node.type === type) out.push(node)
		for (const k of Object.keys(node)) findNodesOfType(node[k], type, out)
	}
}

console.log('')
console.log('=== 4a. D21 counted-options class features (sheet source: classFeatureChoices) ===')
for (const f of classFeatures) {
	const nodes = []
	findNodesOfType(f.entries, 'options', nodes)
	const node = nodes[0]
	if (!node || typeof node.count !== 'number') continue
	const kinds = [...new Set((node.entries || []).map((e) => (e && typeof e === 'object' ? e.type : typeof e)))]
	if (!(kinds.length === 1 && kinds[0] === 'refClassFeature')) continue
	const targets = node.entries.map((e) => e.classFeature.split('|')[0])
	const targetEntries = targets.map((name) => classFeatures.find((c) => c.name === name && c.className === f.className))
	const parentGranted = grantedClassIds.has(f.id)
	console.log(`  parent "${f.name}" ${f.className} L${f.level} granted=${parentGranted}; options -> ${targets.join(', ')}`)
	for (const t of targetEntries) {
		if (!t) continue
		console.log(`    option "${t.name}" is its own class-features entry: L${t.level}, granted=${grantedClassIds.has(t.id)}`)
	}
}

console.log('')
console.log('=== 4b. class-level optionalfeatureProgression names vs class-features names (sheet source: classOptionalFeatures) ===')
for (const c of classEntries) {
	for (const p of c.optionalfeatureProgression || []) {
		const match = classFeatures.find((f) => f.name === p.name && f.className === c.name && f.classSource === c.source)
		const hasStructuralLink = match
			? Object.keys(match).filter((k) => k === 'optionalfeatureProgression' || k === 'featureType' || k === 'consumes').join(',') || 'none'
			: 'n/a'
		console.log(
			`  ${c.name} progression name="${p.name}" featureType=${JSON.stringify(p.featureType)} -> class feature match: ${match ? `"${match.name}" L${match.level} granted=${grantedClassIds.has(match.id)} extraFields=${hasStructuralLink}` : 'NONE'}`,
		)
	}
}

console.log('')
console.log('=== 4c. feats reachable from class/subclass features (sheet source: featTextEntries) ===')
let refOptionalCount = 0
const refOptionalNames = new Set()
for (const f of [...classFeatures, ...subclassFeatures]) {
	const out = []
	findNodesOfType(f.entries, 'refOptionalfeature', out)
	if (out.length > 0) {
		refOptionalCount++
		refOptionalNames.add(f.name)
	}
}
console.log(`  features containing a refOptionalfeature node: ${refOptionalCount}; distinct names (first 5): ${[...refOptionalNames].slice(0, 5).join(', ')}`)
const featGrantNames = classFeatures.filter((f) => /Ability Score Improvement|Feat/i.test(f.name)).map((f) => f.name)
console.log(`  class features whose NAME mentions Feat/ASI (featAsiData's GRANT_KIND_BY_FEATURE_NAME keys): ${[...new Set(featGrantNames)].join(', ')}`)

// ---------------------------------------------------------------------------
// 5. What distinguishes "has an embedded choice" from "plain display text"
// ---------------------------------------------------------------------------

function classify(f) {
	const opts = []
	findNodesOfType(f.entries, 'options', opts)
	const counted = opts.filter((o) => typeof o.count === 'number')
	if (counted.length === 0) return 'plain'
	const kinds = [...new Set(counted.flatMap((o) => (o.entries || []).map((e) => (e && typeof e === 'object' ? e.type : typeof e))))]
	if (kinds.length === 1 && kinds[0] === 'refClassFeature') return 'choice:classFeature'
	if (kinds.includes('refOptionalfeature')) return 'choice:optionalFeature'
	return `choice:other(${kinds.join('/')})`
}

console.log('')
console.log('=== 5. embedded-choice classification over ALL features ===')
const buckets = {}
for (const f of [...classFeatures, ...subclassFeatures]) {
	const k = classify(f)
	buckets[k] = (buckets[k] || 0) + 1
}
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)
console.log(`  uncounted (no count) options nodes exist too — those are "you get ALL of these sub-parts", not a choice`)

// ---------------------------------------------------------------------------
// 6. D86 isActionTableFeature over each set
// ---------------------------------------------------------------------------

const REST_TAG = /\{@variantrule\s+(Long Rest|Short Rest)\b/i
function hasRestTag(node) {
	if (typeof node === 'string') return REST_TAG.test(node)
	if (Array.isArray(node)) return node.some(hasRestTag)
	if (!node || typeof node !== 'object') return false
	const body = Array.isArray(node.entries) ? node.entries : node.entry !== undefined ? [node.entry] : []
	if (hasRestTag(body)) return true
	if (hasRestTag(node.items)) return true
	if (hasRestTag(node.rows)) return true
	if (node.row && hasRestTag(node.row.row)) return true
	return false
}
function isActionTableFeature(f) {
	if (!f || typeof f !== 'object') return false
	if (f.consumes !== undefined) return true
	return hasRestTag(f.entries)
}

console.log('')
console.log('=== 6. D86 isActionTableFeature counts ===')
console.log(`  class granted:    ${classGranted.filter(isActionTableFeature).length} / ${classGranted.length}`)
console.log(`  class ref-only:   ${classRefOnly.filter(isActionTableFeature).length} / ${classRefOnly.length}`)
console.log(`  subclass granted: ${subGranted.filter(isActionTableFeature).length} / ${subGranted.length}`)
console.log(`  subclass ref-only:${subRefOnly.filter(isActionTableFeature).length} / ${subRefOnly.length}`)
for (const [cn, cs, lvl, sn, ss] of CASES) {
	const { cf, sf } = resolveNaive(cn, cs, lvl, sn, ss)
	const rows = [...cf.filter((f) => grantedClassIds.has(f.id)), ...sf.filter((f) => grantedSubclassIds.has(f.id))].filter(isActionTableFeature)
	console.log(`  ${cn} ${sn} L${lvl} granted-only action rows (${rows.length}): ${rows.map((f) => f.name).join(', ')}`)
}

// ---------------------------------------------------------------------------
// 7. WHO references a ref-collected feature, and from where in the tree
// ---------------------------------------------------------------------------

/* Collect refClassFeature/refSubclassFeature uids, tagging whether the node
 * sits inside a COUNTED options node (a choice — the target is an alternative,
 * not a grant) or in plain body text (a wrapper expanding into its parts). */
function collectRefs(node, insideCountedOptions, out) {
	if (Array.isArray(node)) {
		for (const n of node) collectRefs(n, insideCountedOptions, out)
		return
	}
	if (!node || typeof node !== 'object') return
	if (node.type === 'refClassFeature' || node.type === 'refSubclassFeature') {
		out.push({ type: node.type, uid: node.classFeature || node.subclassFeature, insideCountedOptions })
		return
	}
	const nowInside = insideCountedOptions || (node.type === 'options' && typeof node.count === 'number')
	for (const k of Object.keys(node)) collectRefs(node[k], nowInside, out)
}

const referrersByName = new Map()
for (const f of [...classFeatures, ...subclassFeatures]) {
	const out = []
	collectRefs(f.entries, false, out)
	for (const r of out) {
		const targetName = String(r.uid).split('|')[0]
		if (!referrersByName.has(targetName)) referrersByName.set(targetName, [])
		referrersByName.get(targetName).push({ from: f.name, fromLevel: f.level, choice: r.insideCountedOptions })
	}
}

console.log('')
console.log('=== 7. ref-collected-only features: referenced as a CHOICE or from plain text? ===')
let choiceOnly = 0
let plainOnly = 0
let bothWays = 0
let noReferrer = 0
for (const f of [...classRefOnly, ...subRefOnly]) {
	const refs = referrersByName.get(f.name) || []
	if (refs.length === 0) noReferrer++
	else if (refs.every((r) => r.choice)) choiceOnly++
	else if (refs.every((r) => !r.choice)) plainOnly++
	else bothWays++
}
console.log(`  referenced ONLY from inside a counted options node (an alternative, must NOT be a top-level row): ${choiceOnly}`)
console.log(`  referenced ONLY from plain body text (a parent expanding into its parts): ${plainOnly}`)
console.log(`  referenced both ways: ${bothWays}   |   no referrer found by name: ${noReferrer}`)
for (const name of ['Thaumaturge', 'Turn Undead', 'Disciple of Life', 'Draconic Resilience', 'Life Domain Spells']) {
	const refs = referrersByName.get(name) || []
	console.log(`  "${name}" <- ${refs.map((r) => `${r.from} L${r.fromLevel}${r.choice ? ' [CHOICE]' : ''}`).join('; ') || '(none)'}`)
}

const choiceOnlyNames = []
const bothWaysNames = []
for (const f of [...classRefOnly, ...subRefOnly]) {
	const refs = referrersByName.get(f.name) || []
	if (refs.length > 0 && refs.every((r) => r.choice)) choiceOnlyNames.push(f.name)
	else if (refs.some((r) => r.choice) && refs.some((r) => !r.choice)) bothWaysNames.push(`${f.name} (${refs.map((r) => r.from + (r.choice ? '[CHOICE]' : '')).join('+')})`)
}
console.log(`  choice-only names: ${choiceOnlyNames.join(', ')}`)
console.log(`  both-ways names:   ${bothWaysNames.join(' | ')}`)

// ---------------------------------------------------------------------------
// 8. The correct closure: id-list seeds + plain-text refs, choices excluded
// ---------------------------------------------------------------------------

const byName = new Map()
for (const f of [...classFeatures, ...subclassFeatures]) byName.set(`${f.name}|${f.className}`, f)

function grantedClosure(className, classSource, level, subclassShort, subclassSource) {
	const seeds = [
		...classFeatures.filter((f) => grantedClassIds.has(f.id) && f.className === className && f.classSource === classSource && f.level <= level),
		...subclassFeatures.filter(
			(f) =>
				grantedSubclassIds.has(f.id) && f.className === className && f.classSource === classSource && f.subclassShortName === subclassShort && f.subclassSource === subclassSource && f.level <= level,
		),
	]
	const result = new Map(seeds.map((f) => [f.id, f]))
	let frontier = seeds
	while (frontier.length > 0) {
		const next = []
		for (const f of frontier) {
			const out = []
			collectRefs(f.entries, false, out)
			for (const r of out) {
				if (r.insideCountedOptions) continue // an alternative, not a grant — the D21 pickers own it
				const target = byName.get(`${String(r.uid).split('|')[0]}|${className}`)
				if (!target || result.has(target.id)) continue
				result.set(target.id, target)
				next.push(target)
			}
		}
		frontier = next
	}
	return [...result.values()]
}

console.log('')
console.log('=== 8. granted closure (id seeds + plain-text refs, counted-options refs excluded) ===')
for (const [cn, cs, lvl, sn, ss] of CASES) {
	const closure = grantedClosure(cn, cs, lvl, sn, ss)
	const naive = resolveNaive(cn, cs, lvl, sn, ss)
	const wrappers = closure.filter((f) => {
		const out = []
		collectRefs(f.entries, false, out)
		return out.some((r) => !r.insideCountedOptions)
	})
	console.log(`  ${cn} ${sn} L${lvl}: closure ${closure.length} vs naive ${naive.cf.length + naive.sf.length}; of those, ${wrappers.length} are wrappers that also expand into a listed child`)
	console.log(`    ${closure.map((f) => `${f.name}(L${f.level})`).join(', ')}`)
	console.log(`    action-table rows in closure: ${closure.filter(isActionTableFeature).map((f) => f.name).join(', ')}`)
}

console.log('')
console.log('=== 7b. what a subclass subclassFeatureIds list actually holds (Cleric Life) ===')
const life = subclassEntries.find((e) => e.className === 'Cleric' && e.shortName === 'Life')
for (const id of life.subclassFeatureIds) {
	const f = subclassFeatures.find((x) => x.id === id)
	const out = []
	if (f) collectRefs(f.entries, false, out)
	console.log(`  granted id ${id} -> "${f ? f.name : '??'}" L${f ? f.level : '?'}; refs out: ${out.map((r) => String(r.uid).split('|')[0] + (r.insideCountedOptions ? '[CHOICE]' : '')).join(', ') || 'none'}`)
}
