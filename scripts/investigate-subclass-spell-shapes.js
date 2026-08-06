/*
 * D46 investigation ahead of scoping the rest of step 6 (Spells): slice (d2b)
 * (D62) handled only the `prepared` shape of a subclass's additionalSpells.
 * investigate-spells.js already found 72 of 114 subclasses carry
 * additionalSpells across 14 outer-key shapes, counted per ENTRY. This script
 * classifies per SUBCLASS instead, splitting the non-`prepared` subclasses
 * into "fixed grant, different key" (needs only a derived lookup like d2b)
 * vs "player choice" (needs a picker + storage, like d2) so the remaining
 * work can be sliced.
 */

const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const subclasses = classes.filter((c) => c.entryType === 'subclass')
const withAdditional = subclasses.filter((s) => Array.isArray(s.additionalSpells) && s.additionalSpells.length > 0)

console.log('SUMMARY')
console.log('subclasses total:', subclasses.length, '| with additionalSpells:', withAdditional.length)

// --- 1. per-subclass outer key shape (union of keys across all entries on that subclass) ---
const perSubclassKeyShape = new Map() // shape string -> [{name, className, entry}]
for (const s of withAdditional) {
	const allKeys = new Set()
	for (const entry of s.additionalSpells) for (const k of Object.keys(entry)) allKeys.add(k)
	const shape = JSON.stringify([...allKeys].sort())
	if (!perSubclassKeyShape.has(shape)) perSubclassKeyShape.set(shape, [])
	perSubclassKeyShape.get(shape).push({ name: s.name, className: s.className, entry: s.additionalSpells[0] })
}
console.log('\n--- per-subclass outer key shapes (union of keys across all additionalSpells entries on the subclass) ---')
for (const [shape, list] of perSubclassKeyShape) {
	console.log(' ', list.length, shape, '  e.g.', list[0].className, '-', list[0].name)
}

// --- helper: does an entry (or nested value) contain a "choose" instruction? ---
function containsChoose(node) {
	if (node === null || typeof node !== 'object') return false
	if (Array.isArray(node)) return node.some(containsChoose)
	if (Object.prototype.hasOwnProperty.call(node, 'choose')) return true
	return Object.values(node).some(containsChoose)
}

// --- 2. classify each subclass: prepared-only (handled), fixed-other, or choice ---
const preparedOnly = []
const fixedOther = []
const choiceGroup = []
const uncategorized = []

for (const s of withAdditional) {
	const keys = new Set()
	for (const entry of s.additionalSpells) for (const k of Object.keys(entry)) keys.add(k)
	const onlyPrepared = keys.size === 1 && keys.has('prepared')
	const hasChoose = s.additionalSpells.some(containsChoose)

	if (onlyPrepared && !hasChoose) {
		preparedOnly.push(s)
	} else if (hasChoose) {
		choiceGroup.push(s)
	} else if (keys.size > 0) {
		fixedOther.push(s)
	} else {
		uncategorized.push(s)
	}
}

console.log('\n--- classification ---')
console.log('prepared-only (handled by d2b, D62):', preparedOnly.length)
console.log('fixed grant, other key (needs derived lookup only):', fixedOther.length)
console.log('player choice (needs a picker + storage):', choiceGroup.length)
console.log('uncategorized (does not fit any bucket):', uncategorized.length)
console.log('reconciled total:', preparedOnly.length + fixedOther.length + choiceGroup.length + uncategorized.length, '(should equal', withAdditional.length + ')')

if (uncategorized.length > 0) {
	console.log('\n--- UNCATEGORIZED subclasses (needs manual look) ---')
	for (const s of uncategorized) console.log(' ', s.className, '-', s.name, JSON.stringify(s.additionalSpells).slice(0, 200))
}

// --- 2a. fixedOther: which keys, trimmed examples ---
console.log('\n--- fixed-other: breakdown by key shape ---')
const fixedOtherByShape = new Map()
for (const s of fixedOther) {
	const keys = new Set()
	for (const entry of s.additionalSpells) for (const k of Object.keys(entry)) keys.add(k)
	const shape = JSON.stringify([...keys].sort())
	if (!fixedOtherByShape.has(shape)) fixedOtherByShape.set(shape, [])
	fixedOtherByShape.get(shape).push(s)
}
for (const [shape, list] of fixedOtherByShape) {
	console.log(' ', list.length, shape)
	const ex = list[0]
	console.log('    e.g.', ex.className, '-', ex.name, ':', JSON.stringify(ex.additionalSpells[0]).slice(0, 250))
}

// --- 2b. choiceGroup: names + which class ---
console.log('\n--- CHOICE GROUP: subclasses needing a picker (', choiceGroup.length, ') ---')
for (const s of choiceGroup) console.log(' ', s.className, '-', s.name)

// --- 2c. `expanded` key hides two different encodings: literal spell names vs a
// "{all: 'level=X|class=Y'}" pool-widening instruction (not a fixed grant, and not
// a self-contained choice either — it widens what the EXISTING class picker (d2)
// offers, rather than granting or asking the player to choose specific spells here).
console.log('\n--- `expanded` key: sub-shapes (fixed spell names vs pool-widening `all`) ---')
const expandedFixed = []
const expandedAll = []
for (const s of withAdditional) {
	for (const entry of s.additionalSpells) {
		if (!Object.prototype.hasOwnProperty.call(entry, 'expanded')) continue
		const exp = entry.expanded
		let hasAll = false
		let hasFixedNames = false
		for (const levelKey of Object.keys(exp)) {
			const v = exp[levelKey]
			if (!Array.isArray(v)) continue
			for (const item of v) {
				if (typeof item === 'object' && item !== null && 'all' in item) hasAll = true
				if (typeof item === 'string') hasFixedNames = true
			}
		}
		if (hasAll) expandedAll.push({ className: s.className, name: s.name, entry })
		if (hasFixedNames) expandedFixed.push({ className: s.className, name: s.name, entry })
	}
}
console.log('subclasses with `expanded.<level>` = [{all: "level=X|class=Y"}] (pool-widening, feeds into d2 picker eligibility, not a new grant):', expandedAll.length)
for (const ex of expandedAll.slice(0, 3)) console.log('   ', ex.className, '-', ex.name, ':', JSON.stringify(ex.entry.expanded).slice(0, 200))
console.log('subclasses with `expanded.<level>` = [fixed spell name, ...] (a real fixed grant, same as `known`):', expandedFixed.length)
for (const ex of expandedFixed.slice(0, 3)) console.log('   ', ex.className, '-', ex.name, ':', JSON.stringify(ex.entry.expanded).slice(0, 200))

// --- 3. choiceGroup: encoding shape of the `choose` instruction ---
console.log('\n--- choice group: encoding of `choose` instructions (distinct shapes) ---')
function findChooseNodes(node, path, out) {
	if (node === null || typeof node !== 'object') return
	if (Array.isArray(node)) {
		node.forEach((v, i) => findChooseNodes(v, path + `[${i}]`, out))
		return
	}
	if (Object.prototype.hasOwnProperty.call(node, 'choose')) out.push({ path, node })
	for (const [k, v] of Object.entries(node)) findChooseNodes(v, path + '.' + k, out)
}

const chooseEncodingShapes = new Map() // shape of `choose` value -> examples
for (const s of choiceGroup) {
	for (const entry of s.additionalSpells) {
		const found = []
		findChooseNodes(entry, 'additionalSpells[]', found)
		for (const { path, node } of found) {
			const chooseVal = node.choose
			const otherKeys = Object.keys(node).filter((k) => k !== 'choose')
			const shape = (typeof chooseVal === 'string' ? 'string' : Array.isArray(chooseVal) ? 'array' : typeof chooseVal) + ' + siblingKeys:' + JSON.stringify(otherKeys.sort())
			if (!chooseEncodingShapes.has(shape)) chooseEncodingShapes.set(shape, [])
			if (chooseEncodingShapes.get(shape).length < 3) {
				chooseEncodingShapes.get(shape).push({ className: s.className, name: s.name, path, chooseVal, node })
			}
		}
	}
}
for (const [shape, examples] of chooseEncodingShapes) {
	console.log('\n ', shape, '- count of distinct example slots shown:', examples.length, '(may repeat across subclasses)')
	for (const ex of examples) {
		console.log('    ', ex.className, '-', ex.name, '@', ex.path, ':', JSON.stringify(ex.chooseVal).slice(0, 200))
	}
}

// --- 3b. raw string values of `choose` (the actual filter syntax), deduped, trimmed ---
console.log('\n--- distinct raw `choose` string values (deduped, up to 15) ---')
const rawChooseStrings = new Set()
for (const s of choiceGroup) {
	for (const entry of s.additionalSpells) {
		const found = []
		findChooseNodes(entry, 'additionalSpells[]', found)
		for (const { node } of found) {
			if (typeof node.choose === 'string') rawChooseStrings.add(node.choose)
		}
	}
}
;[...rawChooseStrings].slice(0, 15).forEach((v) => console.log('  ', v))

// --- known Bard College of Lore / Wizard Evoker check ---
console.log('\n--- known odd cases: Bard College of Lore, Wizard Evoker ---')
const lore = withAdditional.find((s) => s.className === 'Bard' && /Lore/i.test(s.name))
const evoker = withAdditional.find((s) => s.className === 'Wizard' && /Evoker|Evocation/i.test(s.name))
console.log('Bard College of Lore found:', !!lore, lore ? '-> classified as ' + (choiceGroup.includes(lore) ? 'CHOICE' : fixedOther.includes(lore) ? 'fixed-other' : preparedOnly.includes(lore) ? 'prepared-only' : 'uncategorized') : '')
console.log('Wizard Evoker found:', !!evoker, evoker ? '-> classified as ' + (choiceGroup.includes(evoker) ? 'CHOICE' : fixedOther.includes(evoker) ? 'fixed-other' : preparedOnly.includes(evoker) ? 'prepared-only' : 'uncategorized') : '')
