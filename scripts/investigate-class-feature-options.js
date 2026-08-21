/*
 * investigate-class-feature-options.js
 * =====================================
 *
 * Enumerates the 20 class/subclass features (5 + 15) that carry an
 * `options`-type D21 text node — first found by
 * scripts/investigate-class-feature-choices.js (section 5) — with the ONE
 * fact per feature the task needs: name, class(+subclass), level, option
 * count, and each option's label (or, for a ref* pointer, the name of the
 * feature it points at).
 *
 * Step 1 below is ordinary investigation (D46, at most 3 examples). Step 2
 * is the deliverable enumeration itself — CLAUDE.md's "at most 3 examples"
 * rule is explicitly overridden for that one list per this task's brief,
 * because the list is the point. No entry body text or feature prose is
 * printed anywhere in this script.
 *
 * Run: node scripts/investigate-class-feature-options.js
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
}

function findNodesOfType(node, type, results) {
	if (Array.isArray(node)) {
		for (const n of node) findNodesOfType(n, type, results)
	} else if (node && typeof node === 'object') {
		if (node.type === type) results.push(node)
		for (const key of Object.keys(node)) findNodesOfType(node[key], type, results)
	}
}

const classFeatures = readJson('class-features.json')
const subclassFeatures = readJson('subclass-features.json')

function withOptionsNodes(features) {
	const out = []
	for (const f of features) {
		const nodes = []
		findNodesOfType(f.entries, 'options', nodes)
		if (nodes.length > 0) out.push({ feature: f, nodes })
	}
	return out
}

const classHits = withOptionsNodes(classFeatures)
const subclassHits = withOptionsNodes(subclassFeatures)

console.log('='.repeat(72))
console.log('STEP 1 — field shape check (investigation, <=3 examples per CLAUDE.md)')
console.log('='.repeat(72))
console.log('class-features.json record keys, 3 examples:')
for (const { feature } of classHits.slice(0, 3)) console.log('  ' + Object.keys(feature).join(', '))
console.log('subclass-features.json record keys, 3 examples:')
for (const { feature } of subclassHits.slice(0, 3)) console.log('  ' + Object.keys(feature).join(', '))

console.log('')
console.log(`class-features.json features with an "options" node: ${classHits.length}`)
console.log(`subclass-features.json features with an "options" node: ${subclassHits.length}`)
console.log(`total: ${classHits.length + subclassHits.length}`)

const multiNode = [...classHits, ...subclassHits].filter((h) => h.nodes.length > 1)
console.log(`features carrying MORE THAN ONE "options" node: ${multiNode.length}`)
if (multiNode[0]) console.log(`  e.g. "${multiNode[0].feature.name}" — ${multiNode[0].nodes.length} nodes`)

console.log('')
console.log('option-entry item shape across all nodes found (ref* type vs other):')
const allItems = [...classHits, ...subclassHits].flatMap((h) => h.nodes.flatMap((n) => n.entries || []))
const shapeCounts = new Map()
for (const item of allItems) {
	const shape = item && typeof item === 'object' ? item.type || 'plain-object-no-type' : typeof item
	shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1)
}
for (const [shape, count] of shapeCounts) console.log(`  ${shape}: ${count}`)

console.log('')
console.log('a non-ref option item — key names only, 1 example:')
const nonRefExample = allItems.find((item) => item && typeof item === 'object' && !String(item.type || '').startsWith('ref'))
if (nonRefExample) console.log('  ' + Object.keys(nonRefExample).join(', '))
else console.log('  none found')

console.log('')
console.log('a ref* option item — key names only, 1 example:')
const refExample = allItems.find((item) => item && typeof item === 'object' && String(item.type || '').startsWith('ref'))
if (refExample) console.log('  ' + Object.keys(refExample).join(', ') + '  (type=' + refExample.type + ')')
else console.log('  none found')

/*
 * Step 2 — the deliverable: one line per feature. Every option item found in
 * Step 1 turned out to be a ref* pointer (refClassFeature/refSubclassFeature/
 * refOptionalfeature — no plain/string options, no refFeat, in this data), so
 * resolving a label always means resolving a ref target's name. Same
 * id-matching scheme src/featureResolver/resolveRef.ts uses (D33's
 * cf|/scf|-prefixed id field for class/subclass features; name+source
 * lookup, with a feats.json category==="FS" fallback per D12, for
 * optionalfeature/feat refs) — reimplemented here rather than imported,
 * since this is a throwaway investigation script, not application code.
 *
 * CLAUDE.md's "at most 3 examples" cap is explicitly overridden for this one
 * 20-line list only (see module doc) — nothing else below prints entry body
 * text or feature prose.
 */

const optionalFeatures = readJson('optional-features.json')
const feats = readJson('feats.json')

function findByName(list, name, source) {
	const match = list.find((e) => e && typeof e === 'object' && String(e.name || '').toLowerCase() === name.toLowerCase() && String(e.source || '').toLowerCase() === source.toLowerCase())
	return match ? match.name : null
}
function findById(list, id) {
	const match = list.find((e) => e && typeof e === 'object' && String(e.id || '').toLowerCase() === id)
	return match ? match.name : null
}
/*
 * A refClassFeature/refSubclassFeature uid drops its trailing `|source`
 * segment whenever source equals the default (classSource for a class
 * feature, subclassSource for a subclass feature) — confirmed empirically
 * (node -e probe against class-features.json/subclass-features.json): the
 * "Magician|Druid|XPHB|1" uid has 4 parts, but its target's real `id` field
 * is "cf|magician|druid|xphb|1|xphb" (5 parts after the cf| prefix) — the
 * omitted 5th part equals classSource. resolveRef.ts's own doc comment
 * calls the uid "already in cf|/scf|... order" without spelling out this
 * shorthand, so it's noted here for whoever reads this script next.
 */
function resolveClassFeatureRef(uid) {
	const parts = uid.split('|')
	if (parts.length !== 4 && parts.length !== 5) return null
	const [name, className, classSource, level] = parts
	const source = parts[4] || classSource
	const id = `cf|${[name, className, classSource, level, source].join('|').toLowerCase()}`
	return findById(classFeatures, id)
}
function resolveSubclassFeatureRef(uid) {
	const parts = uid.split('|')
	if (parts.length !== 6 && parts.length !== 7) return null
	const [name, className, classSource, subclassShortName, subclassSource, level] = parts
	const source = parts[6] || subclassSource
	const id = `scf|${[name, className, classSource, subclassShortName, subclassSource, level, source].join('|').toLowerCase()}`
	return findById(subclassFeatures, id)
}
function resolveRefLabel(item) {
	if (item.type === 'refClassFeature') {
		return resolveClassFeatureRef(String(item.classFeature)) || `[unresolved cf: ${item.classFeature}]`
	}
	if (item.type === 'refSubclassFeature') {
		return resolveSubclassFeatureRef(String(item.subclassFeature)) || `[unresolved scf: ${item.subclassFeature}]`
	}
	if (item.type === 'refOptionalfeature') {
		const [name, source] = String(item.optionalfeature).split('|')
		if (!name) return `[unresolved optionalfeature: ${item.optionalfeature}]`
		if (source) {
			const viaOptional = findByName(optionalFeatures, name, source)
			if (viaOptional) return viaOptional
			const fightingStyles = feats.filter((e) => e && typeof e === 'object' && e.category === 'FS')
			return findByName(fightingStyles, name, source) || `[unresolved optionalfeature: ${item.optionalfeature}]`
		}
		// Two uids in this data ("Dueling", "Two-Weapon Fighting" — both
		// Fighting Style/D12 refs) carry no source segment at all, unlike
		// every other refOptionalfeature uid found. Each matches exactly one
		// feats.json (category "FS") entry by name alone, so name-only
		// lookup is unambiguous here — confirmed by a node -e probe, not
		// assumed.
		const fightingStylesByNameOnly = feats.filter((e) => e && typeof e === 'object' && e.category === 'FS' && String(e.name || '').toLowerCase() === name.toLowerCase())
		if (fightingStylesByNameOnly.length === 1) return fightingStylesByNameOnly[0].name
		return `[unresolved optionalfeature (no source in uid): ${item.optionalfeature}]`
	}
	if (item.type === 'refFeat') {
		const [name, source] = String(item.feat).split('|')
		if (!name || !source) return `[unresolved feat: ${item.feat}]`
		return findByName(feats, name, source) || `[unresolved feat: ${item.feat}]`
	}
	// No non-ref option item exists in this data (Step 1 found none), but
	// handle it rather than silently dropping it if that ever changes.
	if (item && typeof item === 'object' && item.name) return String(item.name)
	return '[option with no label and no ref]'
}

function describeHit(h, kind) {
	const f = h.feature
	const classPart = kind === 'class' ? f.className : `${f.className}/${f.subclassShortName}`
	const options = h.nodes[0].entries || []
	const labels = options.map(resolveRefLabel)
	return `${f.name} — ${classPart} (${kind === 'class' ? 'class' : 'subclass'} feature), level ${f.level}, ${labels.length} options: ${labels.join('; ')}`
}

console.log('')
console.log('='.repeat(72))
console.log('STEP 2 — the 20-feature enumeration (deliverable; 3-example cap overridden)')
console.log('='.repeat(72))
const lines = [...classHits.map((h) => describeHit(h, 'class')), ...subclassHits.map((h) => describeHit(h, 'subclass'))]
for (const line of lines) console.log(line)
console.log('')
console.log(`total lines: ${lines.length}`)
