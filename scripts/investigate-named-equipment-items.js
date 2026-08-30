/*
 * Investigation for the items counterpart of D72: which items does a class's or
 * background's starting equipment NAME that data/items.json does not contain,
 * and what is each of them in the source data — an item in a source we drop, or
 * an itemGroup (a category, D34)?
 *
 * Prints a SUMMARY only. Reads data/classes.json, data/backgrounds.json,
 * data/items.json and data-source items.json / items-base.json. Writes nothing.
 */
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");
const SRC_DIR = path.join(__dirname, "..", "data-source", "5etools-src-main", "5etools-src-main", "data");

const ALLOWED_SOURCES = ["XPHB", "XGE", "TCE", "EFA", "XDMG", "MPMM"];

function readJson(dir, name) {
	return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
}

const classes = readJson(DATA_DIR, "classes.json").filter((c) => c.entryType === "class");
const backgrounds = readJson(DATA_DIR, "backgrounds.json");
const items = readJson(DATA_DIR, "items.json");

const itemKeys = new Set(items.map((it) => `${String(it.name).toLowerCase()}|${String(it.source).toLowerCase()}`));
const itemNames = new Set(items.map((it) => String(it.name).toLowerCase()));

// name|source code -> the features that name it, so a finding can be traced back.
const namedBy = new Map();
const specials = new Map();

function note(map, key, owner) {
	if (!map.has(key)) map.set(key, new Set());
	map.get(key).add(owner);
}

function walk(option, owner) {
	for (const el of option) {
		if (typeof el === "string") {
			note(namedBy, el, owner);
			continue;
		}
		if (!el || typeof el !== "object") continue;
		if (typeof el.item === "string") note(namedBy, el.item, owner);
		if (typeof el.special === "string") note(specials, el.special, owner);
	}
}

for (const c of classes) {
	for (const row of (c.startingEquipment && c.startingEquipment.defaultData) || []) {
		for (const arr of Object.values(row || {})) if (Array.isArray(arr)) walk(arr, c.name);
	}
}
for (const bg of backgrounds) {
	for (const row of bg.startingEquipment || []) {
		for (const arr of Object.values(row || {})) if (Array.isArray(arr)) walk(arr, `${bg.name} (bg)`);
	}
}

// Pack contents are part of what a feature effectively names, so they count too.
let packContentsUnresolved = 0;
for (const it of items) {
	if (!Array.isArray(it.packContents)) continue;
	for (const el of it.packContents) {
		const code = typeof el === "string" ? el : el && typeof el.item === "string" ? el.item : null;
		if (code && !itemKeys.has(String(code).toLowerCase())) {
			packContentsUnresolved++;
			note(namedBy, code, `packContents of ${it.name}`);
		}
	}
}

const src = readJson(SRC_DIR, "items.json");
const base = readJson(SRC_DIR, "items-base.json");
const srcLists = [
	["item", src.item || []],
	["itemGroup", src.itemGroup || []],
	["baseitem", base.baseitem || []],
];

function findInSource(name, source) {
	const hits = [];
	for (const [list, entries] of srcLists) {
		for (const e of entries) {
			if (String(e.name).toLowerCase() !== name) continue;
			if (source && String(e.source).toLowerCase() !== source) continue;
			hits.push(`${list}:${e.name}|${e.source}(type=${e.type || "-"})`);
		}
	}
	return hits;
}

console.log("=".repeat(70));
console.log("A  CODES NAMED BY STARTING EQUIPMENT THAT data/items.json LACKS");
console.log("=".repeat(70));
console.log(`  distinct codes named: ${namedBy.size}   packContents entries unresolved: ${packContentsUnresolved}`);
const unresolved = [...namedBy.keys()].filter((code) => !itemKeys.has(String(code).toLowerCase()));
console.log(`  UNRESOLVED: ${unresolved.length}`);
for (const code of unresolved.sort()) {
	const [name, source] = String(code).toLowerCase().split("|");
	const hits = findInSource(name, source);
	console.log(`    ${code.padEnd(28)} named by: ${[...namedBy.get(code)].slice(0, 3).join(", ")}`);
	console.log(`      source data: ${hits.join(" ") || "(absent)"}`);
}

console.log("\n" + "=".repeat(70));
console.log("B  {special} NAMES (no source in the code — matched by name)");
console.log("=".repeat(70));
for (const [name, owners] of specials) {
	const hits = findInSource(name.toLowerCase(), null);
	console.log(`  "${name}" named by: ${[...owners].join(", ")}`);
	console.log(`    in data/items.json: ${itemNames.has(name.toLowerCase()) ? "yes" : "NO"}`);
	console.log(`    source data: ${hits.join(" ") || "(absent)"}`);
	const allowed = hits.filter((h) => ALLOWED_SOURCES.some((s) => h.includes(`|${s}(`)));
	console.log(`    of those, in an allowed source: ${allowed.join(" ") || "(none)"}`);
}

console.log("\n" + "=".repeat(70));
console.log("C  CANDIDATE NAME LIST (item entries in a dropped source, not groups)");
console.log("=".repeat(70));
const candidates = [];
for (const code of [...unresolved, ...specials.keys()]) {
	const [name, source] = String(code).toLowerCase().split("|");
	for (const [list, entries] of srcLists) {
		if (list === "itemGroup") continue;
		for (const e of entries) {
			if (String(e.name).toLowerCase() !== name) continue;
			if (source && String(e.source).toLowerCase() !== source) continue;
			candidates.push(`${e.name}|${e.source} (${list}, allowed=${ALLOWED_SOURCES.includes(e.source)})`);
		}
	}
}
console.log(candidates.length ? candidates.map((c) => `  ${c}`).join("\n") : "  (none)");
console.log("\ndone");
