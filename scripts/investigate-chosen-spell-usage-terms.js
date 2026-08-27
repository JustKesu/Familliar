/*
 * Part 2 of the "usage terms for player-CHOSEN spells" task. The granted-spell
 * usage labels (SpellUsage) never reached the spells a PLAYER picks: Pact of
 * the Tome's cantrips/rituals, Magic Initiate's picks, the filter-choice
 * feats. Those carry no additionalSpells wrapper, so the term has to come from
 * each source's own rules text (D70/D21 precedent: a short hand table, one
 * entry per source, each quoting the sentence it came from).
 *
 * This script prints, per source, ONLY the sentences of its own `entries`
 * prose that bear on how a picked spell is cast (slot / ritual / no slot /
 * once per rest / free casting). Nothing else from the entry is printed.
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

/** Flatten an entries tree to plain sentences. */
function sentences(node, out) {
	if (typeof node === 'string') {
		for (const s of node.split(/(?<=[.:])\s+/)) out.push(s.trim())
		return
	}
	if (Array.isArray(node)) {
		for (const n of node) sentences(n, out)
		return
	}
	if (node && typeof node === 'object') {
		if (node.name) out.push(`[${node.name}]`)
		sentences(node.entries ?? node.items ?? [], out)
	}
}

const KEYWORDS =
	/spell slots?|without expending|without using|without a spell slot|ritual|\bonce\b|long rest|short rest|cast (it|them|this|that|the spell|each|either)|regain the ability|prepared|expend|of your choice|you learn|you always have|any spell slots|at will|innately/i

function shapeOf(entry) {
	if (!Array.isArray(entry.additionalSpells)) return '(no additionalSpells)'
	return entry.additionalSpells
		.map((block) => {
			if (!block || typeof block !== 'object') return String(block)
			const ability = JSON.stringify(block.ability)
			const keys = ['known', 'prepared', 'innate']
				.filter((k) => block[k] !== undefined)
				.map((k) => {
					const m = block[k]
					const inner = m && typeof m === 'object' ? Object.entries(m).map(([lk, v]) => `${lk}:${Array.isArray(v) ? `[${v.join(',')}]` : JSON.stringify(v)}`).join(' ') : String(m)
					return `${k}={${inner}}`
				})
			return `ability=${ability} ${keys.join(' ')}`
		})
		.join('  ||  ')
}

function report(label, entry) {
	if (!entry) {
		console.log(`\n### ${label}\n  (NOT FOUND in data)`)
		return
	}
	const all = []
	sentences(entry.entries ?? [], all)
	const hits = all.filter((s) => KEYWORDS.test(s)).map((s) => (s.length > 260 ? s.slice(0, 260) + '…' : s))
	console.log(`\n### ${label}  —  ${entry.name} [${entry.source}]`)
	console.log('  additionalSpells:', shapeOf(entry))
	if (hits.length === 0) {
		console.log('  (no sentence mentions casting mechanics)')
	}
	for (const h of hits) console.log('  • ' + h)
}

const feats = load('feats.json')
const optionalFeatures = load('optional-features.json')

function feat(name) {
	return feats.find((f) => f.name === name)
}
function optFeat(name) {
	return optionalFeatures.find((f) => f.name === name)
}

console.log('SUMMARY: rules text bearing on how a PLAYER-CHOSEN spell is cast, per source.')

// Pact of the Tome — the optional feature whose grant is a choose filter.
report('Pact of the Tome (Pact Boon)', optFeat('Pact of the Tome'))

// Magic Initiate — every variant present.
for (const f of feats.filter((f) => f.name.startsWith('Magic Initiate'))) report('Magic Initiate variant', f)

// The 8 filter-choice feats (featSpellChoiceData.ts FILTER_CHOICE_FEAT_KEYS).
for (const name of ['Artificer Initiate', 'Blessed Warrior', 'Druidic Warrior', 'Wood Elf Magic', 'Aberrant Dragonmark', 'Fey Touched', 'Fey-Touched', 'Shadow Touched', 'Shadow-Touched', 'Ritual Caster']) {
	const f = feat(name)
	if (f) report(`filter-choice feat: ${name}`, f)
}
