/*
 * check-dangling-refs.js
 * =======================
 *
 * One-off verification: after extract-data.js drops entries superseded by a
 * newer reprint (removeSuperseded, see NOTES.md "Nine species names occur
 * twice"), does anything in data/ still reference one of the removed
 * entries by name?
 *
 * The previous check only covered spells -> feats / optionalFeatures
 * (buildSpellAvailability already filters those at extraction time). This
 * script covers every OTHER reference path found by inspecting the actual
 * generated files: prerequisites, granted features, class progressions,
 * and so on.
 *
 * Prints a SUMMARY ONLY (per CLAUDE.md): for each reference path, how many
 * references were checked, how many are dangling, and at most 3 examples.
 * Never prints whole entries.
 *
 * Run: node scripts/check-dangling-refs.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

// Walks any nested structure and collects every value found under `key`.
function collectByKey(root, key) {
	const out = [];
	(function walk(node) {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (node !== null && typeof node === "object") {
			if (Object.prototype.hasOwnProperty.call(node, key)) out.push(node[key]);
			for (const value of Object.values(node)) walk(value);
		}
	})(root);
	return out;
}

function lcKey(name, source) {
	return `${name}|${source}`.toLowerCase();
}

// A "Name|Source" string, lowercased, split into its parts.
function splitUid(uid) {
	const s = String(uid);
	const i = s.lastIndexOf("|");
	if (i === -1) return { name: s, source: "" };
	return { name: s.slice(0, i), source: s.slice(i + 1) };
}

let totalPathsWithDangling = 0;

function report(pathLabel, checked, dangling) {
	const status = dangling.length === 0 ? "OK  " : "FAIL";
	console.log(`  ${status}  ${pathLabel}: checked ${checked}, dangling ${dangling.length}`);
	if (dangling.length > 0) {
		totalPathsWithDangling++;
		for (const example of dangling.slice(0, 3)) console.log(`          - ${example}`);
		if (dangling.length > 3) console.log(`          ...and ${dangling.length - 3} more.`);
	}
}

// --- load everything once -------------------------------------------------

const feats = readJson("feats.json");
const optionalFeatures = readJson("optional-features.json");
const species = readJson("species.json");
const backgrounds = readJson("backgrounds.json");
const items = readJson("items.json");
const classEntries = readJson("classes.json");
const classFeatures = readJson("class-features.json");
const subclassFeatures = readJson("subclass-features.json");

const featKeys = new Set(feats.map((e) => lcKey(e.name, e.source)));
const optionalFeatureKeys = new Set(optionalFeatures.map((e) => lcKey(e.name, e.source)));
const classFeatureIds = new Set(classFeatures.map((e) => e.id));
const subclassFeatureIds = new Set(subclassFeatures.map((e) => e.id));
const optionalFeatureTypes = new Set(optionalFeatures.flatMap((e) => e.featureType || []));
const featCategories = new Set(feats.map((e) => e.category));

// A featureType code resolves either against optional-features.json (the
// 2014-era mechanism) or, for the 2024 Fighting Style feats, against
// feats.json's own `category` field. A restricted code like "FS:B" (Bard)
// has no exact match in either file — only the base "FS" category does —
// because Fighting Styles moved from optional-features to feats.json under
// XPHB and the restriction suffix names WHICH feats apply, not a distinct
// data source. See PHASE1.md section D, "Fighting Styles resolve through
// feats.json, not optional-features.json".
function featureTypeResolves(code) {
	if (optionalFeatureTypes.has(code)) return true;
	if (featCategories.has(code)) return true;
	const base = code.split(":")[0];
	return featCategories.has(base);
}

console.log("=".repeat(64));
console.log("Checking for dangling references to removed entries");
console.log("=".repeat(64));

// --- 1. classFeatureIds / subclassFeatureIds -> feature files -------------
// (Also checked in validate-data.js; repeated here for completeness.)
{
	let checked = 0;
	const dangling = [];
	for (const entry of classEntries) {
		const ids = entry.entryType === "class" ? entry.classFeatureIds : entry.subclassFeatureIds;
		const pool = entry.entryType === "class" ? classFeatureIds : subclassFeatureIds;
		for (const id of ids || []) {
			checked++;
			if (!pool.has(id)) dangling.push(`${entry.name} (${entry.source}) -> ${id}`);
		}
	}
	report("classes/subclasses -> classFeatureIds/subclassFeatureIds", checked, dangling);
}

// --- 2. classes/subclasses optionalfeatureProgression -> optional-features -
// or -> feats.json category (see featureTypeResolves above). References a
// featureType CODE (e.g. "MM"), not a specific entry, so "dangling" here
// means the code matches neither.
{
	let checked = 0;
	const dangling = [];
	for (const entry of classEntries) {
		for (const prog of entry.optionalfeatureProgression || []) {
			for (const code of prog.featureType || []) {
				checked++;
				if (!featureTypeResolves(code)) {
					dangling.push(`${entry.name} (${entry.source}) -> featureType "${code}" (${prog.name})`);
				}
			}
		}
	}
	report("classes/subclasses -> optionalfeatureProgression featureType", checked, dangling);
}

// --- 3. feats.json optionalfeatureProgression -> optional-features --------
{
	let checked = 0;
	const dangling = [];
	for (const entry of feats) {
		for (const prog of entry.optionalfeatureProgression || []) {
			for (const code of prog.featureType || []) {
				checked++;
				if (!featureTypeResolves(code)) {
					dangling.push(`${entry.name} (${entry.source}) -> featureType "${code}" (${prog.name})`);
				}
			}
		}
	}
	report("feats -> optionalfeatureProgression featureType", checked, dangling);
}

// --- 4. class-features / subclass-features -> optional-features -----------
// `{@optionalfeature Name|Source}` markup renders as a `refOptionalfeature`
// node with an `optionalfeature: "Name|Source"` string.
{
	let checked = 0;
	const dangling = [];
	for (const [label, arr] of [["class-features", classFeatures], ["subclass-features", subclassFeatures]]) {
		for (const entry of arr) {
			for (const ref of collectByKey(entry.entries, "optionalfeature")) {
				const refs = Array.isArray(ref) ? ref : [ref];
				for (const uid of refs) {
					checked++;
					const { name, source } = splitUid(uid);
					if (!optionalFeatureKeys.has(lcKey(name, source))) {
						dangling.push(`${label}: ${entry.name} (${entry.source}) -> ${uid}`);
					}
				}
			}
		}
	}
	report("class-features/subclass-features -> optional-features (refOptionalfeature)", checked, dangling);
}

// --- 5. optional-features.json -> optional-features.json (self-refs) ------
{
	let checked = 0;
	const dangling = [];
	for (const entry of optionalFeatures) {
		for (const ref of collectByKey(entry, "optionalfeature")) {
			const refs = Array.isArray(ref) ? ref : [ref];
			for (const uid of refs) {
				checked++;
				const { name, source } = splitUid(uid);
				if (!optionalFeatureKeys.has(lcKey(name, source))) {
					dangling.push(`${entry.name} (${entry.source}) -> ${uid}`);
				}
			}
		}
	}
	report("optional-features -> optional-features (self-references)", checked, dangling);
}

// --- 6. backgrounds.json / species.json -> feats.json ---------------------
// `feats` is an array of objects; the ones naming a specific feat use a
// single "name|source": true entry (lowercased). Entries like
// `anyFromCategory` are a category pick, not a reference, and are skipped.
function checkFeatRefs(entries, label) {
	let checked = 0;
	const dangling = [];
	for (const entry of entries) {
		for (const featChoice of entry.feats || []) {
			for (const rawKey of Object.keys(featChoice)) {
				if (rawKey === "anyFromCategory" || rawKey === "any") continue;
				checked++;
				if (!featKeys.has(rawKey.toLowerCase())) {
					dangling.push(`${entry.name} (${entry.source}) -> ${rawKey}`);
				}
			}
		}
	}
	report(`${label} -> feats`, checked, dangling);
}
checkFeatRefs(backgrounds, "backgrounds");
checkFeatRefs(species, "species");

// --- 7. feats.json -> feats.json (prerequisite feat refs) -----------------
{
	let checked = 0;
	const dangling = [];
	for (const entry of feats) {
		for (const alt of collectByKey(entry.prerequisite, "feat")) {
			const refs = Array.isArray(alt) ? alt : [alt];
			for (const uid of refs) {
				checked++;
				const { name, source } = splitUid(uid);
				if (!featKeys.has(lcKey(name, source))) {
					dangling.push(`${entry.name} (${entry.source}) -> ${uid}`);
				}
			}
		}
	}
	report("feats -> feats (prerequisite)", checked, dangling);
}

// --- 8. class-features.json -> feats.json ----------------------------------
{
	let checked = 0;
	const dangling = [];
	for (const entry of classFeatures) {
		for (const ref of collectByKey(entry.entries, "feat")) {
			const refs = Array.isArray(ref) ? ref : [ref];
			for (const uid of refs) {
				checked++;
				const { name, source } = splitUid(uid);
				if (!featKeys.has(lcKey(name, source))) {
					dangling.push(`${entry.name} (${entry.source}) -> ${uid}`);
				}
			}
		}
	}
	report("class-features -> feats", checked, dangling);
}

// --- 9. items.json -> class-features.json ----------------------------------
// uid shape is "name|className|classSource|level|source" (lowercase, no
// "cf|" prefix); class-features.json ids are "cf|name|className|classSource|level|source".
{
	let checked = 0;
	const dangling = [];
	for (const entry of items) {
		for (const ref of collectByKey(entry, "classFeatures")) {
			const refs = Array.isArray(ref) ? ref : [ref];
			for (const uid of refs) {
				checked++;
				const id = `cf|${String(uid).toLowerCase()}`;
				if (!classFeatureIds.has(id)) {
					dangling.push(`${entry.name} (${entry.source}) -> ${uid}`);
				}
			}
		}
	}
	report("items -> class-features", checked, dangling);
}

// --- 10. items.json -> optional-features.json ------------------------------
{
	let checked = 0;
	const dangling = [];
	for (const entry of items) {
		for (const ref of collectByKey(entry, "optionalfeatures")) {
			const refs = Array.isArray(ref) ? ref : [ref];
			for (const uid of refs) {
				checked++;
				const { name, source } = splitUid(uid);
				if (!optionalFeatureKeys.has(lcKey(name, source))) {
					dangling.push(`${entry.name} (${entry.source}) -> ${uid}`);
				}
			}
		}
	}
	report("items -> optional-features", checked, dangling);
}

console.log("=".repeat(64));
if (totalPathsWithDangling === 0) {
	console.log("SUMMARY: all reference paths clean — no dangling references found.");
} else {
	console.log(`SUMMARY: ${totalPathsWithDangling} reference path(s) have dangling references. See FAIL lines above.`);
	process.exitCode = 1;
}
