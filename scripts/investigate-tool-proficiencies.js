const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function truncate(str, max) {
	const s = String(str);
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

const backgrounds = readJson("backgrounds.json");
const items = readJson("items.json");

console.log(`Total backgrounds: ${backgrounds.length}`);

console.log("\n=== (a) With / without toolProficiencies ===");
const withField = backgrounds.filter((b) => b.toolProficiencies !== undefined);
const withoutField = backgrounds.filter((b) => b.toolProficiencies === undefined);
console.log(`WITH toolProficiencies: ${withField.length}`);
console.log(`WITHOUT toolProficiencies: ${withoutField.length}`);
if (withoutField.length > 0) {
	console.log("  Backgrounds without it:", withoutField.map((b) => `${b.name} (${b.source})`).join(", "));
}

console.log("\n=== (b) Distinct shapes of toolProficiencies entries ===");

function classifyEntry(entry) {
	if (entry && typeof entry === "object" && !Array.isArray(entry)) {
		const keys = Object.keys(entry);
		if (keys.length === 1) {
			const k = keys[0];
			if (entry[k] === true) return `named-tool:{"${k}":true}`;
			if (typeof entry[k] === "number") return `category:{"${k}":<number>}`;
			return `single-key other (${k}=${JSON.stringify(entry[k])})`;
		}
		return `multi-key object (${keys.length} keys: ${keys.join(",")})`;
	}
	return `non-object entry (${typeof entry}: ${JSON.stringify(entry)})`;
}

const shapeBuckets = new Map();
const examplesPerShape = new Map();
const categoryKeys = new Set();

for (const bg of withField) {
	const arr = Array.isArray(bg.toolProficiencies) ? bg.toolProficiencies : [bg.toolProficiencies];
	for (const entry of arr) {
		const shape = classifyEntry(entry);
		shapeBuckets.set(shape, (shapeBuckets.get(shape) || 0) + 1);
		if (!examplesPerShape.has(shape)) {
			examplesPerShape.set(shape, { name: bg.name, source: bg.source, entry });
		}
		if (shape.startsWith("category:")) {
			categoryKeys.add(Object.keys(entry)[0]);
		}
	}
}

for (const [shape, count] of shapeBuckets) {
	const ex = examplesPerShape.get(shape);
	console.log(`  ${shape}: ${count} occurrence(s) -- example: ${ex.name} (${ex.source}): ${truncate(JSON.stringify(ex.entry), 200)}`);
}

console.log(`\nDistinct category keys found: ${[...categoryKeys].join(", ") || "(none)"}`);

console.log("\n=== (c) Element count of toolProficiencies array, per background ===");
let oneElement = 0;
const multiElement = [];
for (const bg of withField) {
	const arr = Array.isArray(bg.toolProficiencies) ? bg.toolProficiencies : [bg.toolProficiencies];
	if (arr.length === 1) oneElement++;
	else multiElement.push({ name: bg.name, source: bg.source, length: arr.length, value: bg.toolProficiencies });
}
console.log(`Backgrounds with exactly 1 element: ${oneElement}`);
console.log(`Backgrounds with more than 1 element: ${multiElement.length}`);
for (const m of multiElement.slice(0, 3)) {
	console.log(`  ${m.name} (${m.source}): length=${m.length} value=${truncate(JSON.stringify(m.value), 300)}`);
}

console.log("\n=== Full list: every background's toolProficiencies ===");
for (const bg of backgrounds) {
	console.log(`  ${bg.name} (${bg.source}): ${truncate(JSON.stringify(bg.toolProficiencies), 150)}`);
}

console.log("\n=== (d) Can items.json filter each category key structurally? ===");

// type field looks like "AT|XPHB" (Artisan's Tools), "T|XPHB" (tools), etc.
// Check what type codes exist and their typeFull, to see which map to which category key.
const typeCounts = new Map();
for (const it of items) {
	if (typeof it.type !== "string") continue;
	const code = it.type.split("|")[0];
	if (!typeCounts.has(code)) {
		typeCounts.set(code, { count: 0, typeFull: it.typeFull, examples: [] });
	}
	const bucket = typeCounts.get(code);
	bucket.count++;
	if (bucket.examples.length < 3) bucket.examples.push(it.name);
}

console.log("All item type codes present (code: typeFull, count, examples):");
for (const [code, info] of typeCounts) {
	console.log(`  ${code}: typeFull=${JSON.stringify(info.typeFull)}, count=${info.count}, examples=[${info.examples.join(", ")}]`);
}

for (const key of categoryKeys) {
	console.log(`\n-- Category key "${key}" --`);
	if (key === "anyArtisansTool") {
		const matches = items.filter((it) => typeof it.type === "string" && it.type.startsWith("AT|"));
		console.log(`  Items with type starting "AT|": ${matches.length}`);
		console.log(`  Sample: ${matches.slice(0, 3).map((i) => i.name).join(", ")}`);
	} else {
		console.log(`  No structural filter defined in this script for "${key}" -- needs manual mapping.`);
	}
}
