/*
 * Follow-up to investigate-spell-usage-wrappers.js: that script assumed the
 * usage wrapper sits exactly one level below prepared/known/innate's level
 * key, but the survey's "daily" sub-key list turned up ability codes ("int",
 * "cha") instead of counts — a sign of an extra nesting layer for some
 * entries. Dumps the raw JSON for each affected entry's specific level so the
 * real nesting depth is visible. Trimmed to one level's value per entry.
 */
const fs = require('fs')
const path = require('path')

function load(file) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'))
}

function showSubclassLevel(className, nameMatch, key, levelKey) {
	const classes = load('classes.json')
	const matches = classes.filter((c) => c.entryType === 'subclass' && c.className === className && nameMatch.test(c.name))
	if (matches.length === 0) return console.log(className, nameMatch, '-> NOT FOUND')
	for (const s of matches) {
		for (const entry of s.additionalSpells || []) {
			if (!(key in entry)) continue
			if (!(levelKey in entry[key])) continue
			console.log(`${className} - ${s.name} (${s.source}) | ${key}.${levelKey} :`, JSON.stringify(entry[key][levelKey]))
		}
	}
}

function showFeatLevel(featName, key, levelKey) {
	const feats = load('feats.json')
	const f = feats.find((c) => c.name === featName)
	if (!f) return console.log(featName, '-> NOT FOUND')
	for (const entry of f.additionalSpells || []) {
		if (!(key in entry)) continue
		if (!(levelKey in entry[key])) continue
		console.log(`feat ${featName} | ${key}.${levelKey} :`, JSON.stringify(entry[key][levelKey]))
	}
}

console.log('--- Artificer Alchemist, innate.9 (the "int" daily sub-key) ---')
showSubclassLevel('Artificer', /Alchemist/, 'innate', '9')

console.log('\n--- Warlock Archfey Patron, innate._ (the "cha" daily sub-key) ---')
showSubclassLevel('Warlock', /Archfey/, 'innate', '_')

console.log('\n--- Fighter Psi Warrior, innate.18 ("1" appearing twice) ---')
showSubclassLevel('Fighter', /Psi Warrior/, 'innate', '18')

console.log('\n--- Aberrant Dragonmark, prepared._ (the "rest" wrapper) ---')
showFeatLevel('Aberrant Dragonmark', 'prepared', '_')

console.log('\n--- Drow High Magic, innate._ (the "will" wrapper) ---')
showFeatLevel('Drow High Magic', 'innate', '_')

console.log('\n--- Mask of Many Faces, ALL matching entries (full entry) ---')
const optionalFeatures = load('optional-features.json')
const masks = optionalFeatures.filter((f) => f.name === 'Mask of Many Faces')
for (const m of masks) console.log(JSON.stringify(m))
