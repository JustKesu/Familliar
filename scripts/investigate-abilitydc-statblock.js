const fs = require("fs")
const path = require("path")

const dataDir = path.join(__dirname, "..", "data")

const KNOWN_TYPES = new Set([
	"entries",
	"section",
	"inset",
	"insetReadaloud",
	"list",
	"item",
	"itemSpell",
	"itemSub",
	"table",
	"options",
	"dice",
	"bonus",
	"bonusSpeed",
	"cell",
	"refClassFeature",
	"refSubclassFeature",
	"refOptionalfeature",
	"refFeat",
])

function truncate(value, max = 300) {
	const s = JSON.stringify(value)
	return s.length > max ? s.slice(0, max) + "…" : s
}

// Only nodes reached through an "entries"/"entry" chain are markup entries.
// A bare top-level `type` field (e.g. an item's "AT|XPHB" category code) is
// not part of the entry tree the renderer walks, so it must not count here.
function walk(node, file, visit, inEntryTree) {
	if (Array.isArray(node)) {
		for (const item of node) walk(item, file, visit, inEntryTree)
		return
	}
	if (node !== null && typeof node === "object") {
		if (inEntryTree && typeof node.type === "string") visit(node, file)
		for (const key of Object.keys(node)) {
			const nextInTree = inEntryTree || key === "entries" || key === "entry"
			walk(node[key], file, visit, nextInTree)
		}
	}
}

const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"))

const targetStats = {
	abilityDc: { count: 0, files: new Set(), keys: new Map(), examples: [] },
	statblock: { count: 0, files: new Set(), keys: new Map(), examples: [] },
}
const unknownTypes = new Map() // type -> {count, files:Set, examples:[]}

for (const file of files) {
	const full = path.join(dataDir, file)
	let json
	try {
		json = JSON.parse(fs.readFileSync(full, "utf8"))
	} catch {
		continue
	}
	walk(json, file, (node, fileName) => {
		const type = node.type
		if (type === "abilityDc" || type === "statblock") {
			const stat = targetStats[type]
			stat.count++
			stat.files.add(fileName)
			for (const key of Object.keys(node)) {
				stat.keys.set(key, (stat.keys.get(key) ?? 0) + 1)
			}
			if (stat.examples.length < 3) stat.examples.push(truncate(node))
			return
		}
		if (!KNOWN_TYPES.has(type) && type !== "abilityDc" && type !== "statblock") {
			const entry = unknownTypes.get(type) ?? { count: 0, files: new Set(), examples: [] }
			entry.count++
			entry.files.add(fileName)
			if (entry.examples.length < 3) entry.examples.push(truncate(node))
			unknownTypes.set(type, entry)
		}
	}, false)
}

console.log("=== SUMMARY ===")
for (const [type, stat] of Object.entries(targetStats)) {
	console.log(`\n-- ${type} --`)
	console.log("count:", stat.count)
	console.log("files:", [...stat.files].join(", "))
	console.log("keys:", [...stat.keys.entries()].map(([k, c]) => `${k}(${c})`).join(", "))
	console.log("examples:")
	stat.examples.forEach((e, i) => console.log(`  [${i}]`, e))
}

console.log("\n-- other unknown types (not abilityDc/statblock, not in KNOWN_TYPES) --")
if (unknownTypes.size === 0) {
	console.log("none")
} else {
	for (const [type, entry] of unknownTypes.entries()) {
		console.log(`\ntype: ${type}`)
		console.log("count:", entry.count)
		console.log("files:", [...entry.files].join(", "))
		entry.examples.forEach((e, i) => console.log(`  [${i}]`, e))
	}
}
