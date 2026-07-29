/*
 * investigate-ref-expansion.js
 * =============================
 *
 * D46 verification before writing the feature-reference resolver (see the
 * task: expand refClassFeature/refSubclassFeature/refOptionalfeature/refFeat
 * links to their target's text, not just its name).
 *
 * Answers three questions, SUMMARY ONLY (counts + at most 3-5 examples):
 *   a) how many occurrences of each of the four ref types exist across data/?
 *   b) does each resolve to an existing target feature by id (D33 shapes
 *      cf|... / scf|...) or by name+source (feat/optionalfeature)?
 *   c) do resolved targets' own entries contain further ref* nodes (nesting),
 *      and could that recurse forever?
 *
 * Run: node scripts/investigate-ref-expansion.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function lcKey(name, source) {
	return `${name}|${source}`.toLowerCase();
}

function splitUid(uid) {
	const s = String(uid);
	const i = s.lastIndexOf("|");
	if (i === -1) return { name: s, source: "" };
	return { name: s.slice(0, i), source: s.slice(i + 1) };
}

// Walks every JSON file in data/ and collects {type, uid, file} for the four
// ref types, wherever they occur (not just class-features/subclass-features).
const REF_TYPE_KEYS = {
	refClassFeature: "classFeature",
	refSubclassFeature: "subclassFeature",
	refOptionalfeature: "optionalfeature",
	refFeat: "feat",
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

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
const allRefs = [];
for (const file of files) {
	const json = readJson(file);
	for (const ref of collectRefs(json)) allRefs.push({ ...ref, file });
}

console.log("=".repeat(64));
console.log("a) ref occurrence counts, by type");
console.log("=".repeat(64));
const byType = {};
for (const ref of allRefs) byType[ref.type] = (byType[ref.type] || 0) + 1;
for (const type of Object.keys(REF_TYPE_KEYS)) {
	console.log(`  ${type}: ${byType[type] || 0}`);
}
console.log(`  TOTAL: ${allRefs.length}`);

// --- build target pools, same matching rules as check-dangling-refs.js ----

const feats = readJson("feats.json");
const optionalFeatures = readJson("optional-features.json");
const classFeatures = readJson("class-features.json");
const subclassFeatures = readJson("subclass-features.json");

const featKeys = new Set(feats.map((e) => lcKey(e.name, e.source)));
const optionalFeatureKeys = new Set(optionalFeatures.map((e) => lcKey(e.name, e.source)));
const classFeatureById = new Map(classFeatures.map((e) => [e.id, e]));
const subclassFeatureById = new Map(subclassFeatures.map((e) => [e.id, e]));

function resolve(type, uid) {
	if (type === "refClassFeature") {
		const id = `cf|${uid.toLowerCase()}`;
		return classFeatureById.get(id);
	}
	if (type === "refSubclassFeature") {
		const id = `scf|${uid.toLowerCase()}`;
		return subclassFeatureById.get(id);
	}
	if (type === "refOptionalfeature") {
		const { name, source } = splitUid(uid);
		return optionalFeatureKeys.has(lcKey(name, source)) || undefined;
	}
	if (type === "refFeat") {
		const { name, source } = splitUid(uid);
		return featKeys.has(lcKey(name, source)) || undefined;
	}
	return undefined;
}

console.log("=".repeat(64));
console.log("b) resolution against target pools");
console.log("=".repeat(64));

const missingByType = {};
for (const type of Object.keys(REF_TYPE_KEYS)) {
	const refs = allRefs.filter((r) => r.type === type);
	const missing = refs.filter((r) => !resolve(type, r.uid));
	missingByType[type] = missing;
	console.log(`  ${type}: ${refs.length} checked, ${missing.length} NOT found`);
	for (const example of missing.slice(0, 5)) {
		console.log(`      - ${example.file}: ${example.uid}`);
	}
}

// --- c) nesting: do resolved class/subclass feature targets themselves ----
// contain refClassFeature/refSubclassFeature/refOptionalfeature/refFeat?

console.log("=".repeat(64));
console.log("c) nesting inside resolved targets");
console.log("=".repeat(64));

let nestedCount = 0;
const nestedExamples = [];
for (const type of ["refClassFeature", "refSubclassFeature"]) {
	const refs = allRefs.filter((r) => r.type === type);
	for (const ref of refs) {
		const target = resolve(type, ref.uid);
		if (!target || typeof target !== "object") continue;
		const innerRefs = collectRefs(target.entries || []);
		if (innerRefs.length > 0) {
			nestedCount += innerRefs.length;
			if (nestedExamples.length < 3) {
				nestedExamples.push(`${ref.uid} -> contains ${innerRefs.map((r) => r.type).join(", ")}`);
			}
		}
	}
}
console.log(`  nested ref* nodes found inside resolved class/subclass feature targets: ${nestedCount}`);
for (const example of nestedExamples) console.log(`      - ${example}`);

console.log("=".repeat(64));
console.log("SUMMARY");
console.log("=".repeat(64));
const totalMissing = Object.values(missingByType).reduce((sum, arr) => sum + arr.length, 0);
console.log(`  total refs: ${allRefs.length}, total unresolved: ${totalMissing}, nested ref* found: ${nestedCount > 0 ? "YES" : "no"}`);
