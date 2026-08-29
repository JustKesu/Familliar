/*
 * D46 investigation for the "is 1/day ever the right label?" task. The `daily`
 * wrapper under additionalSpells drives spellFormatting.ts's "N/day" label, but
 * the 2024 rules largely replaced "once per day" with "once per Long Rest"
 * (D68: where data and 2024 text disagree, the text wins).
 *
 * For every source carrying a `daily` wrapper, this collects the source's OWN
 * rules text and prints the sentence that says when the ability comes back,
 * grouped by what that sentence claims. Trimmed output only (CLAUDE.md).
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

function isRecord(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate', 'expanded']

/** Every `daily` sub-key reachable under `value`, however deeply the level value nests it. */
function collectDailySubkeys(value, out) {
	if (Array.isArray(value)) {
		for (const item of value) collectDailySubkeys(item, out)
		return
	}
	if (!isRecord(value)) return
	for (const [key, inner] of Object.entries(value)) {
		if (key === 'daily' && isRecord(inner)) {
			for (const subkey of Object.keys(inner)) out.add(subkey)
		} else {
			collectDailySubkeys(inner, out)
		}
	}
}

function dailySubkeysOf(additionalSpells) {
	const out = new Set()
	if (!Array.isArray(additionalSpells)) return out
	for (const entry of additionalSpells) {
		if (!isRecord(entry)) continue
		for (const key of FIXED_GRANT_KEYS) {
			if (key in entry) collectDailySubkeys(entry[key], out)
		}
	}
	return out
}

/** The spell names granted under a `daily` wrapper, so a quote can be tied to the grant rather than to any feature that happens to mention a rest. */
function collectDailySpellNames(value, out) {
	if (Array.isArray(value)) {
		for (const item of value) collectDailySpellNames(item, out)
		return
	}
	if (!isRecord(value)) return
	for (const [key, inner] of Object.entries(value)) {
		if (key === 'daily' && isRecord(inner)) {
			const refs = []
			flattenRefs(inner, refs)
			for (const ref of refs) out.add(ref)
		} else {
			collectDailySpellNames(inner, out)
		}
	}
}

function flattenRefs(value, out) {
	if (typeof value === 'string') {
		out.push(value.split('|')[0].toLowerCase())
		return
	}
	if (Array.isArray(value)) {
		for (const item of value) flattenRefs(item, out)
		return
	}
	if (isRecord(value)) {
		for (const inner of Object.values(value)) flattenRefs(inner, out)
	}
}

/**
 * One group per `daily` sub-key AT ONE character level — the unit the "N times"
 * count actually applies to. Flattening every level together instead would make
 * a species that grants a different spell at each of three levels look like a
 * three-spell grant.
 */
function collectDailyGroups(value, out) {
	if (Array.isArray(value)) {
		for (const item of value) collectDailyGroups(item, out)
		return
	}
	if (!isRecord(value)) return
	for (const [key, inner] of Object.entries(value)) {
		if (key === 'daily' && isRecord(inner)) {
			for (const [subkey, spells] of Object.entries(inner)) {
				const refs = []
				flattenRefs(spells, refs)
				out.push({ subkey, spells: refs })
			}
		} else {
			collectDailyGroups(inner, out)
		}
	}
}

function dailyGroupsOf(additionalSpells) {
	const out = []
	if (!Array.isArray(additionalSpells)) return out
	for (const entry of additionalSpells) {
		if (!isRecord(entry)) continue
		for (const key of FIXED_GRANT_KEYS) {
			if (key in entry) collectDailyGroups(entry[key], out)
		}
	}
	return out
}

function dailySpellNamesOf(additionalSpells) {
	const out = new Set()
	if (!Array.isArray(additionalSpells)) return out
	for (const entry of additionalSpells) {
		if (!isRecord(entry)) continue
		for (const key of FIXED_GRANT_KEYS) {
			if (key in entry) collectDailySpellNames(entry[key], out)
		}
	}
	return out
}

/** Flattens 5etools entry trees to plain prose, dropping tables and stripping {@tag ...} markup. */
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

function proseOf(entriesNodes) {
	const parts = []
	flattenText(entriesNodes, parts)
	return parts
		.join(' ')
		.replace(/\{@\w+ ([^|}]+)(\|[^}]*)?\}/g, '$1')
		.replace(/\s+/g, ' ')
}

const RECHARGE_CUE = /long rest|short rest|dawn|per day|a day|each day|daily/i
const CAST_CUE = /cast|again|regain|use|expend/i

function rechargeSentences(prose) {
	return prose
		.split(/(?<=[.!?])\s+/)
		.filter((s) => RECHARGE_CUE.test(s) && CAST_CUE.test(s))
}

function classify(sentences) {
	const joined = sentences.join(' ')
	if (sentences.length === 0) return 'nothing'
	// Checked before plain Long Rest — both wordings contain "long rest".
	if (/short (rest )?or long rest/i.test(joined)) return 'Short Rest or Long Rest'
	if (/long rest/i.test(joined)) return 'Long Rest'
	if (/short rest/i.test(joined)) return 'Short Rest'
	if (/dawn/i.test(joined)) return 'dawn'
	if (/per day|a day|each day|daily/i.test(joined)) return 'a day'
	return 'nothing'
}

// --- gather every source carrying a daily wrapper, with its own prose ---

const sources = [] // { file, name, subkeys, spellNames, features: [{ featureName, prose }] }

function add(file, name, entry, features) {
	const subkeys = dailySubkeysOf(entry.additionalSpells)
	if (subkeys.size === 0) return
	sources.push({ file, name, subkeys, spellNames: [...dailySpellNamesOf(entry.additionalSpells)], groups: dailyGroupsOf(entry.additionalSpells), features })
}

for (const entry of load('feats.json')) add('feats', entry.name, entry, [{ featureName: entry.name, prose: proseOf(entry.entries) }])
for (const entry of load('optional-features.json')) add('optfeat', entry.name, entry, [{ featureName: entry.name, prose: proseOf(entry.entries) }])
for (const entry of load('species.json')) add('species', entry.name, entry, [{ featureName: entry.name, prose: proseOf(entry.entries) }])

const subclassFeatures = load('subclass-features.json')
for (const entry of load('classes.json')) {
	// A subclass's own text lives in subclass-features.json; the strict join can
	// miss (D27 edition split), so fall back to shortName+subclassSource.
	const strict = subclassFeatures.filter(
		(f) =>
			f.className === entry.className &&
			f.classSource === entry.classSource &&
			f.subclassShortName === entry.shortName &&
			f.subclassSource === entry.source,
	)
	const matches = strict.length > 0 ? strict : subclassFeatures.filter((f) => f.subclassShortName === entry.shortName && f.subclassSource === entry.source)
	add(
		entry.entryType === 'subclass' ? 'subclass' : String(entry.entryType),
		`${entry.className ?? ''} ${entry.name} [${entry.source}]`.trim(),
		entry,
		matches.map((f) => ({ featureName: `${f.name} (lvl ${f.level})`, prose: proseOf(f.entries) })),
	)
	// Whether a 2014 subclass entry is superseded decides if its (older) wording can still reach a sheet.
	const last = sources[sources.length - 1]
	if (last && last.file === 'subclass' && last.name.startsWith(`${entry.className} ${entry.name}`)) {
		last.reprint = `classSource=${entry.classSource} reprintedAs=${JSON.stringify(entry.reprintedAs ?? null)}`
	}
}

/**
 * The recharge sentence from the feature that actually grants the spell,
 * preferring a feature whose prose names one of the granted spells — a
 * multi-feature subclass otherwise quotes whichever unrelated feature happens
 * to mention a rest first.
 */
function quoteFor(source) {
	const named = source.features.filter((f) => source.spellNames.some((spell) => spell.length > 3 && f.prose.toLowerCase().includes(spell)))
	for (const pool of [named, source.features]) {
		for (const f of pool) {
			const sentences = rechargeSentences(f.prose)
			if (sentences.length > 0) return { featureName: f.featureName, sentence: sentences[0], tiedToSpell: pool === named }
		}
	}
	return { featureName: named[0]?.featureName ?? '', sentence: '', tiedToSpell: named.length > 0 }
}

// --- group and print ---

const groups = new Map()
let wrapperOccurrences = 0
for (const s of sources) {
	wrapperOccurrences += s.subkeys.size
	const quote = quoteFor(s)
	const group = classify(quote.sentence ? [quote.sentence] : [])
	if (!groups.has(group)) groups.set(group, [])
	groups.get(group).push({ ...s, ...quote })
}

console.log(`sources carrying a daily wrapper: ${sources.length} (distinct daily sub-keys across them: ${wrapperOccurrences})`)

/** `node investigate-daily-recharge-text.js nothing-only` skips the full listing and prints just the unexplained sources. */
const nothingOnly = process.argv[2] === 'nothing-only'

for (const [group, members] of nothingOnly ? [] : [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
	console.log(`\n=== says "${group}": ${members.length} source(s) ===`)
	const bySentence = new Map()
	for (const m of members) {
		const key = m.sentence.slice(0, 200)
		if (!bySentence.has(key)) bySentence.set(key, [])
		bySentence.get(key).push(`${m.name}${m.tiedToSpell ? '' : ' [quote NOT from the granting feature]'}`)
	}
	for (const [sentence, names] of [...bySentence.entries()].sort((a, b) => b[1].length - a[1].length)) {
		console.log(`\n  "${sentence}"`)
		console.log(`    ${names.length}x: ${names.join(', ')}`)
	}
}

for (const m of groups.get('nothing') ?? []) {
	console.log(`\n=== "${m.name}" says nothing — what its text actually is ===`)
	console.log(`  granted under daily: ${m.spellNames.join(', ')}`)
	console.log(`  features joined: ${m.features.length} — ${m.features.map((f) => f.featureName).join(' | ')}`)
	for (const f of m.features.filter((f) => m.spellNames.some((s) => f.prose.toLowerCase().includes(s)))) {
		console.log(`  ${f.featureName}: "${f.prose.slice(0, 300)}"`)
	}
	// Is the sentence genuinely absent from the data, or only missed by the join above?
	const anywhere = subclassFeatures.filter((f) => m.spellNames.some((s) => proseOf(f.entries).toLowerCase().includes(s)))
	console.log(`  entries anywhere in subclass-features.json naming that spell: ${anywhere.length}`)
	for (const f of anywhere.slice(0, 3)) {
		console.log(`    ${f.name} | ${f.className}/${f.classSource} | ${f.subclassShortName}/${f.subclassSource}: "${proseOf(f.entries).slice(0, 420)}"`)
	}
}

/*
 * Two claims the label depends on, checked rather than assumed:
 *  - "each": a source granting SEVERAL spells under one `daily` key could mean
 *    one shared use across the list. Its own text settles it.
 *  - "no slot": the label says the cast is free, so every source has to say so.
 */
const EACH_CUE = /\beach\b|\beither\b|\bthat spell\b|any of these/i
const NO_SLOT_CUE = /without (a spell slot|expending a spell slot|expending any spell slot)|with this trait|without a spell slot or spell components|without expending/i

console.log('\n=== one daily key covering SEVERAL spells at one level: shared use, or one use each? ===')
for (const s of sources) {
	const multi = s.groups.filter((g) => g.spells.length > 1)
	if (multi.length === 0) continue
	const { sentence } = quoteFor(s)
	if (EACH_CUE.test(sentence)) continue
	console.log(`  ${s.name} | ${multi.map((g) => `daily:${g.subkey}x${g.spells.length}`).join(' ')}`)
	console.log(`    "${sentence.slice(0, 200)}"`)
}

console.log('\n=== sources whose text does NOT say the cast is slot-free ===')
const notFree = sources.filter((s) => !s.features.some((f) => NO_SLOT_CUE.test(f.prose)))
console.log(`  ${notFree.length} of ${sources.length}: ${notFree.map((s) => s.name).join(', ') || '(none)'}`)
for (const s of notFree) {
	const f = s.features.find((f) => s.spellNames.some((spell) => f.prose.toLowerCase().includes(spell))) ?? s.features[0]
	const prose = f?.prose ?? ''
	const at = s.spellNames.map((spell) => prose.toLowerCase().indexOf(spell)).find((i) => i >= 0) ?? 0
	console.log(`  ${s.name} — ${f?.featureName}: "${prose.slice(Math.max(0, at - 60), at + 320)}"`)
}

console.log('\n=== subclass sources (is the 2014 wording still reachable?) ===')
for (const s of sources.filter((s) => s.file === 'subclass')) console.log(`  ${s.name} | ${s.reprint}`)

console.log('\n=== daily sub-keys in use ===')
const subkeyCounts = new Map()
for (const s of sources) for (const k of s.subkeys) subkeyCounts.set(k, (subkeyCounts.get(k) ?? 0) + 1)
for (const [k, n] of subkeyCounts) console.log(`  "${k}": ${n} source(s)`)
