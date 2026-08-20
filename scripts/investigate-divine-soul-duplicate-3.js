const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const spells = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/spells.json'), 'utf8'))

// Mirror extractSubclassAlwaysPreparedSpells's FIXED_GRANT_KEYS loop manually to see raw output, no TS build needed.
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate']

function isRecord(v) {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function extractRefs(value) {
	if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
	if (!isRecord(value)) return []
	return Object.values(value).flatMap(extractRefs)
}

function parseSpellRef(ref) {
	const [namePart, sourcePart] = ref.split('|')
	const source = sourcePart ? sourcePart.split('#')[0].toUpperCase() : null
	return { name: namePart.toLowerCase(), source }
}

function findSpell(spellList, ref) {
	return spellList.find((s) => s.name.toLowerCase() === ref.name && (ref.source === null || s.source.toUpperCase() === ref.source))
}

const subclass = classes.find((c) => c.entryType === 'subclass' && c.name === 'Divine Soul' && c.className === 'Sorcerer' && c.classSource === 'XPHB')

const classLevel = 20
const result = []
for (const entry of subclass.additionalSpells) {
	if (!isRecord(entry)) continue
	for (const key of FIXED_GRANT_KEYS) {
		const levelMap = entry[key]
		if (levelMap === undefined || !isRecord(levelMap)) continue
		for (const [levelKey, value] of Object.entries(levelMap)) {
			const grantedAtLevel = Number(levelKey)
			if (!Number.isFinite(grantedAtLevel) || grantedAtLevel > classLevel) continue
			for (const ref of extractRefs(value)) {
				const spell = findSpell(spells, parseSpellRef(ref))
				if (!spell) continue
				result.push({ name: spell.name, entrySource: entry.name, key, grantedAtLevel })
			}
		}
	}
}

console.log('SUMMARY')
console.log('Total spells from FIXED_GRANT_KEYS loop:', result.length)
console.log(JSON.stringify(result, null, 2))
