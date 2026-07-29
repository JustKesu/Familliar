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

const species = readJson("species.json");

// Only the selectable set matters: drop reprintedAs (superseded) entries, matching speciesData.ts.
const selectable = species.filter((sp) => sp.reprintedAs === undefined);

console.log(`Total species records: ${species.length}, selectable (no reprintedAs): ${selectable.length}`);

console.log("\n=== (a) Parent vs variant skillProficiencies inheritance ===");

function findParentAndVariants(parentName, parentSource) {
	const parent = selectable.find((sp) => sp.name === parentName && sp.source === parentSource);
	const variants = selectable.filter((sp) => sp.raceName === parentName && sp.raceSource === parentSource);
	return { parent, variants };
}

// Elf (XPHB) variants come from _versions, not raceName linkage — check both shapes.
function describeCase(label, parentName, parentSource) {
	console.log(`\n-- ${label} --`);
	const parent = selectable.find((sp) => sp.name === parentName && sp.source === parentSource);
	if (!parent) {
		console.log(`  Parent "${parentName}" (${parentSource}) not found among selectable species.`);
		return;
	}
	console.log(`  Parent skillProficiencies: ${JSON.stringify(parent.skillProficiencies)}`);

	// Variants that are separate top-level selectable entries naming this as raceName/raceSource.
	const raceLinked = selectable.filter((sp) => sp.raceName === parentName && sp.raceSource === parentSource);
	for (const v of raceLinked) {
		const same = JSON.stringify(v.skillProficiencies) === JSON.stringify(parent.skillProficiencies);
		console.log(`  [raceName-linked] ${v.name} (${v.source}): ${JSON.stringify(v.skillProficiencies)} -- ${same ? "SAME as parent" : "DIFFERENT from parent"}`);
	}

	// Variants embedded in the parent's own _versions array (e.g. Elf; Drow Lineage).
	if (Array.isArray(parent._versions)) {
		for (const v of parent._versions) {
			const same = JSON.stringify(v.skillProficiencies) === JSON.stringify(parent.skillProficiencies);
			console.log(`  [_versions] ${v.name ?? "(unnamed)"}: skillProficiencies=${JSON.stringify(v.skillProficiencies)} -- ${v.skillProficiencies === undefined ? "NOT PRESENT on variant (would fall back to parent's)" : same ? "SAME as parent" : "DIFFERENT from parent"}`);
		}
	} else {
		console.log("  No _versions array on parent.");
	}
}

describeCase("Elf (XPHB)", "Elf", "XPHB");
describeCase("Shifter (EFA)", "Shifter", "EFA");
describeCase("Kobold (MPMM)", "Kobold", "MPMM");

console.log("\n=== (b) All distinct skillProficiencies shapes across selectable species ===");

const shapeBuckets = new Map(); // shapeKey -> { count, example }

function classifyEntry(entry) {
	if (entry && typeof entry === "object" && !Array.isArray(entry)) {
		const keys = Object.keys(entry);
		if (keys.length === 1 && entry[keys[0]] === true && keys[0] !== "choose") {
			return "fixed:{skill:true}";
		}
		if ("choose" in entry) {
			const choose = entry.choose;
			if (choose && typeof choose === "object") {
				const hasFrom = Array.isArray(choose.from);
				const hasCount = typeof choose.count === "number";
				const hasAny = "any" in choose || "anySkill" in choose;
				if (hasFrom && hasCount) return "choose:{from,count}";
				if (hasFrom && !hasCount) return "choose:{from} (no count)";
				if (hasAny) return "choose:{any/anySkill}";
				return `choose: unrecognised shape (${JSON.stringify(choose)})`;
			}
		}
		if (keys.length > 1) return `multi-key fixed object (${keys.length} keys)`;
		return `unrecognised object shape (keys=${keys.join(",")})`;
	}
	return `non-object entry (${typeof entry}: ${JSON.stringify(entry)})`;
}

let entriesWithField = 0;
let entriesWithoutField = 0;
const examplesPerShape = new Map();

for (const sp of selectable) {
	if (sp.skillProficiencies === undefined) {
		entriesWithoutField++;
		continue;
	}
	entriesWithField++;
	const arr = Array.isArray(sp.skillProficiencies) ? sp.skillProficiencies : [sp.skillProficiencies];
	for (const entry of arr) {
		const shape = classifyEntry(entry);
		shapeBuckets.set(shape, (shapeBuckets.get(shape) || 0) + 1);
		if (!examplesPerShape.has(shape)) {
			examplesPerShape.set(shape, { name: sp.name, source: sp.source, entry });
		}
	}
}

console.log(`Species WITH skillProficiencies: ${entriesWithField}`);
console.log(`Species WITHOUT skillProficiencies: ${entriesWithoutField}`);
console.log("\nDistinct entry shapes found:");
for (const [shape, count] of shapeBuckets) {
	const ex = examplesPerShape.get(shape);
	console.log(`  ${shape}: ${count} occurrence(s) -- example: ${ex.name} (${ex.source}): ${truncate(JSON.stringify(ex.entry), 200)}`);
}

console.log("\n=== (c) Element count of skillProficiencies array, per species ===");

let oneElement = 0;
let multiElement = [];
for (const sp of selectable) {
	if (sp.skillProficiencies === undefined) continue;
	const arr = Array.isArray(sp.skillProficiencies) ? sp.skillProficiencies : [sp.skillProficiencies];
	if (arr.length === 1) oneElement++;
	else multiElement.push({ name: sp.name, source: sp.source, length: arr.length, value: sp.skillProficiencies });
}
console.log(`Species with exactly 1 element: ${oneElement}`);
console.log(`Species with more than 1 element: ${multiElement.length}`);
for (const m of multiElement.slice(0, 3)) {
	console.log(`  ${m.name} (${m.source}): length=${m.length} value=${truncate(JSON.stringify(m.value), 300)}`);
}

console.log("\n=== Full list: every selectable species WITH skillProficiencies (name/source/value) ===");
for (const sp of selectable) {
	if (sp.skillProficiencies === undefined) continue;
	console.log(`  ${sp.name} (${sp.source}): ${truncate(JSON.stringify(sp.skillProficiencies), 200)}`);
}
