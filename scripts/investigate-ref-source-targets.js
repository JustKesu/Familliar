/*
 * investigate-ref-source-targets.js
 * ==================================
 *
 * D46 verification before extending extract-data.js to collect features
 * referenced from INSIDE another feature's text (ref* nodes in `entries`),
 * not just from the classFeatureIds/subclassFeatureIds lists.
 *
 * investigate-ref-expansion.js already showed 295 of 335 refClassFeature /
 * refSubclassFeature nodes in data/ have no target in data/. This script
 * answers, against data-source/ (the full unfiltered pool), not data/:
 *
 *   a) do those 295 targets exist in data-source/ at all?
 *   b) which file(s) would they need to come from?
 *   c) do those targets themselves contain further missing ref* nodes
 *      (nesting), and how deep does it go?
 *   d) how many entries would be added to class-features.json /
 *      subclass-features.json if collected?
 *
 * Run: node scripts/investigate-ref-source-targets.js
 */

const fs = require("fs");
const path = require("path");
const { SOURCE_DATA_DIR, readJson, prepareEntries, getReferenceString, makeClassFeatureIdFromEntry, makeSubclassFeatureIdFromEntry } = require("./extract-data.js");

const DATA_DIR = path.join(__dirname, "..", "data");

function readOutputJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function idPart(value) {
	return String(value ?? "").trim().toLowerCase();
}

function makeClassFeatureIdFromRef(uid) {
	let [name, className, classSource, level, source] = String(uid).split("|").map((p) => p.trim());
	classSource = classSource || "PHB";
	source = source || classSource;
	return ["cf", idPart(name), idPart(className), idPart(classSource), idPart(level), idPart(source)].join("|");
}

function makeSubclassFeatureIdFromRef(uid) {
	let [name, className, classSource, subclassShortName, subclassSource, level, source] = String(uid)
		.split("|")
		.map((p) => p.trim());
	classSource = classSource || "PHB";
	subclassSource = subclassSource || "PHB";
	source = source || subclassSource;
	return [
		"scf",
		idPart(name),
		idPart(className),
		idPart(classSource),
		idPart(subclassShortName),
		idPart(subclassSource),
		idPart(level),
		idPart(source),
	].join("|");
}

// --- load every class file's raw classFeature/subclassFeature list, --------
// --- same as extractClasses(), but tagging each raw entry with its file ----
const classDir = path.join(SOURCE_DATA_DIR, "class");
const index = readJson(path.join(classDir, "index.json"));
const fileNames = Object.values(index);

const raw = { classFeature: [], subclassFeature: [] };
for (const fileName of fileNames) {
	const data = readJson(path.join(classDir, fileName));
	for (const listName of Object.keys(raw)) {
		for (const entry of data[listName] || []) {
			raw[listName].push({ ...entry, __sourceFile: fileName });
		}
	}
}

// Resolve _copy / _versions, same pipeline extractClasses() uses, so ids and
// entries text match what extraction would actually produce.
const classFeaturePool = prepareEntries(raw.classFeature, "class:classFeature").entries;
const subclassFeaturePool = prepareEntries(raw.subclassFeature, "class:subclassFeature").entries;

for (const entry of classFeaturePool) entry.id = makeClassFeatureIdFromEntry(entry);
for (const entry of subclassFeaturePool) entry.id = makeSubclassFeatureIdFromEntry(entry);

const classFeatureById = new Map(classFeaturePool.map((e) => [e.id, e]));
const subclassFeatureById = new Map(subclassFeaturePool.map((e) => [e.id, e]));

// --- collect ref* nodes from any entries tree --------------------------
const REF_TYPE_KEYS = {
	refClassFeature: "classFeature",
	refSubclassFeature: "subclassFeature",
};

function collectRefs(root) {
	const found = [];
	(function walk(node) {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (node !== null && typeof node === "object") {
			const type = node.type;
			if (type && REF_TYPE_KEYS[type]) {
				const uid = node[REF_TYPE_KEYS[type]];
				if (typeof uid === "string") found.push({ type, uid });
			}
			for (const value of Object.values(node)) walk(value);
		}
	})(root);
	return found;
}

function resolve(type, uid) {
	if (type === "refClassFeature") return classFeatureById.get(makeClassFeatureIdFromRef(uid));
	if (type === "refSubclassFeature") return subclassFeatureById.get(makeSubclassFeatureIdFromRef(uid));
	return undefined;
}

// --- a) + b): the 295 refs currently unresolved in data/, checked against --
// --- the full data-source/ pool instead --------------------------------
const currentClassFeatures = readOutputJson("class-features.json");
const currentSubclassFeatures = readOutputJson("subclass-features.json");

const currentRefs = [];
for (const [label, arr] of [["class-features.json", currentClassFeatures], ["subclass-features.json", currentSubclassFeatures]]) {
	for (const entry of arr) {
		for (const ref of collectRefs(entry.entries || [])) currentRefs.push({ ...ref, file: label });
	}
}

console.log("=".repeat(64));
console.log("a) + b) do the missing targets exist in data-source/, and where");
console.log("=".repeat(64));

const filesNeeded = new Set();
let foundCount = 0;
let notFoundCount = 0;
const notFoundExamples = [];
for (const ref of currentRefs) {
	const target = resolve(ref.type, ref.uid);
	if (target) {
		foundCount++;
		filesNeeded.add(target.__sourceFile);
	} else {
		notFoundCount++;
		if (notFoundExamples.length < 5) notFoundExamples.push(`${ref.type}: ${ref.uid}`);
	}
}
console.log(`  refs checked: ${currentRefs.length}`);
console.log(`  found in data-source/: ${foundCount}`);
console.log(`  NOT found anywhere in data-source/: ${notFoundCount}`);
for (const example of notFoundExamples) console.log(`      - ${example}`);
console.log(`  files these targets come from (all already read by extractClasses()):`);
for (const f of [...filesNeeded].sort()) console.log(`      - ${f}`);

// --- c) nesting: do the found targets' own entries contain further ref* ----
// --- nodes, and how deep? Breadth-first collection until the set stabilizes.
console.log("=".repeat(64));
console.log("c) nesting depth of newly-found targets");
console.log("=".repeat(64));

const collected = new Map(); // id -> {type, target}
let frontier = [];
for (const ref of currentRefs) {
	const target = resolve(ref.type, ref.uid);
	if (target && !collected.has(target.id)) {
		collected.set(target.id, target);
		frontier.push(target);
	}
}

let depth = 0;
let stillMissing = 0;
while (frontier.length > 0) {
	depth++;
	const nextFrontier = [];
	for (const target of frontier) {
		for (const ref of collectRefs(target.entries || [])) {
			const inner = resolve(ref.type, ref.uid);
			if (!inner) {
				stillMissing++;
				continue;
			}
			if (!collected.has(inner.id)) {
				collected.set(inner.id, inner);
				nextFrontier.push(inner);
			}
		}
	}
	frontier = nextFrontier;
	if (depth > 20) {
		console.log("  !! depth exceeded 20 without stabilizing — possible unbounded recursion");
		break;
	}
}
console.log(`  levels walked until the collected set stopped growing: ${depth - 1}`);
console.log(`  total newly-collected features (any depth): ${collected.size}`);
console.log(`  ref* nodes inside collected features that still don't resolve: ${stillMissing}`);

// --- d) how many entries would be added to each output file ----------------
console.log("=".repeat(64));
console.log("d) projected growth of class-features.json / subclass-features.json");
console.log("=".repeat(64));

let newClassFeatures = 0;
let newSubclassFeatures = 0;
const currentClassIds = new Set(currentClassFeatures.map((e) => e.id));
const currentSubclassIds = new Set(currentSubclassFeatures.map((e) => e.id));
for (const target of collected.values()) {
	if (target.id.startsWith("cf|") && !currentClassIds.has(target.id)) newClassFeatures++;
	if (target.id.startsWith("scf|") && !currentSubclassIds.has(target.id)) newSubclassFeatures++;
}
console.log(`  class-features.json:    ${currentClassFeatures.length} -> ${currentClassFeatures.length + newClassFeatures}`);
console.log(`  subclass-features.json: ${currentSubclassFeatures.length} -> ${currentSubclassFeatures.length + newSubclassFeatures}`);

console.log("=".repeat(64));
console.log("SUMMARY");
console.log("=".repeat(64));
console.log(`  ${foundCount}/${currentRefs.length} missing refs resolve inside data-source/; ${notFoundCount} do not exist anywhere.`);
console.log(`  nesting stabilized after ${depth - 1} level(s); ${stillMissing} ref* nodes remain unresolved even after full collection.`);
