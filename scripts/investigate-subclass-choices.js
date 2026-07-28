/*
 * investigate-subclass-choices.js
 * ================================
 *
 * One-off investigation for build order step 3, slice 2 (subclass
 * choices). Per D21 only STRUCTURAL choices (`options` entries and
 * `optionalfeatureProgression`) get real pickers; this counts how many
 * of those actually exist inside subclasses this project offers (D28
 * scope). Prints a SUMMARY ONLY — never whole entries or files.
 *
 * Run: npm run investigate-subclass-choices
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ALLOWED_CLASS_SOURCES = ["XPHB", "EFA"];
const ALLOWED_SOURCES = ["XPHB", "XGE", "TCE", "EFA", "XDMG", "MPMM"];

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function truncate(str, max) {
	const s = String(str).replace(/\s+/g, " ");
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function heading(title) {
	console.log("");
	console.log("=".repeat(64));
	console.log(title);
	console.log("=".repeat(64));
}

function findNodesOfType(node, type, results) {
	if (Array.isArray(node)) {
		for (const n of node) findNodesOfType(n, type, results);
	} else if (node && typeof node === "object") {
		if (node.type === type) results.push(node);
		for (const key of Object.keys(node)) findNodesOfType(node[key], type, results);
	}
}

function containsText(node, needleLowerList) {
	if (Array.isArray(node)) {
		return node.some((n) => containsText(n, needleLowerList));
	}
	if (node && typeof node === "object") {
		return Object.keys(node).some((k) => containsText(node[k], needleLowerList));
	}
	if (typeof node === "string") {
		const lower = node.toLowerCase();
		return needleLowerList.some((needle) => lower.includes(needle));
	}
	return false;
}

const classes = readJson("classes.json");
const allSubclasses = classes.filter((e) => e.entryType === "subclass");
const inScopeSubclasses = allSubclasses.filter(
	(e) => ALLOWED_CLASS_SOURCES.includes(e.classSource) && ALLOWED_SOURCES.includes(e.source),
);

heading("Scope (D28 filter): classSource in ALLOWED_CLASS_SOURCES AND source in ALLOWED_SOURCES");
console.log(`Total subclass entries in classes.json: ${allSubclasses.length}`);
console.log(`In scope for this project: ${inScopeSubclasses.length}`);

function isInScopeSubclassFeature(f) {
	return inScopeSubclasses.some(
		(sc) =>
			sc.className === f.className &&
			sc.classSource === f.classSource &&
			sc.shortName === f.subclassShortName &&
			sc.source === f.subclassSource,
	);
}

const subclassFeatures = readJson("subclass-features.json");
const inScopeFeatures = subclassFeatures.filter(isInScopeSubclassFeature);

heading("Q1. Subclass features containing an `options` entry");
{
	const withOptions = [];
	for (const f of inScopeFeatures) {
		const results = [];
		findNodesOfType(f.entries, "options", results);
		if (results.length > 0) withOptions.push({ feature: f, optionsNodes: results });
	}
	console.log(`In-scope subclass features containing at least one 'options' entry: ${withOptions.length}`);
	for (const { feature, optionsNodes } of withOptions) {
		const counts = optionsNodes.map((n) => (n.count === undefined ? "none" : n.count)).join(", ");
		console.log(
			`  "${feature.name}" | ${feature.className} (${feature.classSource}) | ${feature.subclassShortName} (${feature.subclassSource}) | level ${feature.level} | count field(s): ${counts}`,
		);
	}
}

heading("Q2. Subclasses with optionalfeatureProgression");
{
	const withProg = inScopeSubclasses.filter((sc) => sc.optionalfeatureProgression);
	console.log(`In-scope subclasses carrying optionalfeatureProgression: ${withProg.length}`);
	const allFeatureTypes = new Set();
	for (const sc of withProg) {
		for (const prog of sc.optionalfeatureProgression) {
			const featureTypes = prog.featureType || [];
			featureTypes.forEach((ft) => allFeatureTypes.add(ft));
			const levels = Object.keys(prog.progression || {}).map(Number).sort((a, b) => a - b);
			const shape = levels.map((lvl) => `${lvl}:${prog.progression[lvl]}`).join(", ");
			console.log(
				`  ${sc.name} | ${sc.className} (${sc.classSource}) | featureType=${featureTypes.join(",")} | progression: ${shape}`,
			);
		}
	}
	global.__q2FeatureTypes = allFeatureTypes;
}

heading("Q3. Do those featureType codes resolve?");
{
	const optionalFeatures = readJson("optional-features.json");
	const feats = readJson("feats.json");
	const fsFeats = feats.filter((f) => f.category === "FS");

	const featureTypes = [...global.__q2FeatureTypes];
	if (featureTypes.length === 0) {
		console.log("No featureType codes found in Q2 — nothing to check.");
	}
	for (const code of featureTypes) {
		if (code.startsWith("FS:")) {
			const matches = fsFeats.length;
			console.log(`  ${code}: per D12 this resolves against feats.json category "FS" — ${matches} FS feats available${matches === 0 ? " (ZERO — nothing to offer)" : ""}`);
		} else {
			const matches = optionalFeatures.filter((f) => (f.featureType || []).includes(code));
			console.log(`  ${code}: ${matches.length} entries in optional-features.json${matches.length === 0 ? " (ZERO — this code resolves to nothing)" : ""}`);
		}
	}
}

heading("Q4. Prose-only choices, roughly");
{
	const needles = ["choose", "of your choice"];
	let proseOnlyCount = 0;
	const examples = [];
	for (const f of inScopeFeatures) {
		const hasOptionsNode = (() => {
			const results = [];
			findNodesOfType(f.entries, "options", results);
			return results.length > 0;
		})();
		if (hasOptionsNode) continue;
		if (containsText(f.entries, needles)) {
			proseOnlyCount++;
			if (examples.length < 3) examples.push(`${f.name} (${f.className}, ${f.subclassShortName})`);
		}
	}
	console.log(`In-scope subclass features mentioning "choose" or "of your choice" with NO structural options entry: ${proseOnlyCount}`);
	console.log("Examples:");
	for (const ex of examples) console.log(`  ${truncate(ex, 80)}`);
}

console.log("");
