// D14 scaffolding: measures how much rules text SubclassPicker/FightingStylePicker
// options carry, to judge whether they belong in SearchableOptionList alongside
// the Battle Master maneuvers (step 7 fix slice, "long option lists").
const fs = require('fs')

const classes = JSON.parse(fs.readFileSync('data/classes.json', 'utf8'))
const classFeatures = JSON.parse(fs.readFileSync('data/class-features.json', 'utf8'))
const subclassFeatures = JSON.parse(fs.readFileSync('data/subclass-features.json', 'utf8'))
const feats = JSON.parse(fs.readFileSync('data/feats.json', 'utf8'))

const ALLOWED_CLASS_SOURCES = ['XPHB', 'EFA']
const ALLOWED_SOURCES = ['XPHB', 'XGE', 'TCE', 'EFA', 'XDMG', 'MPMM']

function subclassLevelFor(className, classSource) {
	const cls = classes.find((c) => c.entryType === 'class' && c.name === className && c.source === classSource)
	if (!cls || !cls.subclassTitle) return null
	const match = classFeatures.find((f) => f.name === cls.subclassTitle && f.className === className && f.classSource === classSource)
	return match ? match.level : null
}

function subclassesFor(className, classSource) {
	const grantLevel = subclassLevelFor(className, classSource)
	const subclasses = classes.filter(
		(c) =>
			c.entryType === 'subclass' &&
			c.className === className &&
			c.classSource === classSource &&
			ALLOWED_CLASS_SOURCES.includes(c.classSource) &&
			ALLOWED_SOURCES.includes(c.source) &&
			!c.reprintedAs,
	)
	return subclasses.map((sc) => {
		const strict = subclassFeatures.filter(
			(f) => f.className === sc.className && f.classSource === sc.classSource && f.subclassShortName === sc.shortName && f.subclassSource === sc.source,
		)
		const matches =
			strict.length > 0 ? strict : subclassFeatures.filter((f) => f.className === sc.className && f.subclassShortName === sc.shortName && f.subclassSource === sc.source)
		const feature =
			(grantLevel !== null && matches.find((f) => f.level === grantLevel)) ||
			matches.reduce((lowest, f) => (!lowest || f.level < lowest.level ? f : lowest), undefined)
		return { name: sc.name, entries: feature ? feature.entries : [] }
	})
}

console.log('== SubclassPicker: option count and entries-JSON length per class ==')
const baseClasses = classes.filter((c) => c.entryType === 'class' && ALLOWED_CLASS_SOURCES.includes(c.source))
let grandLens = []
for (const cls of baseClasses) {
	const options = subclassesFor(cls.name, cls.source)
	const lens = options.map((o) => JSON.stringify(o.entries).length)
	grandLens.push(...lens)
	console.log(
		`  ${cls.name}: ${options.length} options, entries-JSON chars min/avg/max = ${Math.min(...lens)}/${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}/${Math.max(...lens)}`,
	)
}
console.log(`Overall subclass option entries-JSON chars: min/avg/max = ${Math.min(...grandLens)}/${Math.round(grandLens.reduce((a, b) => a + b, 0) / grandLens.length)}/${Math.max(...grandLens)}`)

console.log('\n== FightingStylePicker: FS-category feat entries-JSON length ==')
const fsFeats = feats.filter((f) => f.category === 'FS')
const fsLens = fsFeats.map((f) => JSON.stringify(f.entries).length)
console.log(`  ${fsFeats.length} options, entries-JSON chars min/avg/max = ${Math.min(...fsLens)}/${Math.round(fsLens.reduce((a, b) => a + b, 0) / fsLens.length)}/${Math.max(...fsLens)}`)

console.log('\n== Comparison: Battle Master maneuvers (optional-features.json, featureType MV:B) ==')
const optionalFeatures = JSON.parse(fs.readFileSync('data/optional-features.json', 'utf8'))
const maneuvers = optionalFeatures.filter((o) => Array.isArray(o.featureType) && o.featureType.includes('MV:B'))
const mvLens = maneuvers.map((m) => JSON.stringify(m.entries).length)
console.log(`  ${maneuvers.length} options, entries-JSON chars min/avg/max = ${Math.min(...mvLens)}/${Math.round(mvLens.reduce((a, b) => a + b, 0) / mvLens.length)}/${Math.max(...mvLens)}`)
