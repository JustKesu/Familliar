/*
 * investigate-subclass-shape.js
 * ==============================
 *
 * One-off investigation for the subclass picker slice. Confirms how
 * subclasses.json entries link to their class, at what level a class
 * gains a subclass, and how subclass-features.json ties feature text back
 * to a subclass. Prints a SUMMARY ONLY (per CLAUDE.md) — never whole
 * entries or files.
 *
 * Run: node scripts/investigate-subclass-shape.js
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
	const s = String(str);
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function heading(title) {
	console.log("");
	console.log("=".repeat(64));
	console.log(title);
	console.log("=".repeat(64));
}

const classes = readJson("classes.json");
const allSubclasses = classes.filter((e) => e.entryType === "subclass");
const baseClasses = classes.filter((e) => e.entryType === "class");

heading("Q1. subclass entry — top-level keys, linkage fields");
{
	const sc = allSubclasses[0];
	console.log(`Top-level keys on first subclass: ${Object.keys(sc).join(", ")}`);
	console.log(`Example: name=${sc.name} className=${sc.className} classSource=${sc.classSource} source=${sc.source} shortName=${sc.shortName}`);
}

heading("Q2. D28 filter applied — classSource in ALLOWED_CLASS_SOURCES AND source in ALLOWED_SOURCES");
{
	const filtered = allSubclasses.filter(
		(e) => ALLOWED_CLASS_SOURCES.includes(e.classSource) && ALLOWED_SOURCES.includes(e.source),
	);
	console.log(`Total subclass entries: ${allSubclasses.length}`);
	console.log(`After D28 filter: ${filtered.length}`);

	const perClass = {};
	for (const sc of filtered) {
		const key = `${sc.className}|${sc.classSource}`;
		perClass[key] = (perClass[key] || 0) + 1;
	}
	console.log("Count per class (className|classSource):");
	for (const [key, count] of Object.entries(perClass).sort()) {
		console.log(`  ${key}: ${count}`);
	}
}

heading("Q3. What level does each class gain a subclass? Look for 'Subclass' class-features.json entries");
{
	const classFeatures = readJson("class-features.json");
	const subclassGrantFeatures = classFeatures.filter((f) => /subclass/i.test(f.name));
	console.log(`class-features.json entries with 'subclass' in the name: ${subclassGrantFeatures.length}`);
	for (const f of subclassGrantFeatures) {
		console.log(`  name="${f.name}" className=${f.className} classSource=${f.classSource} level=${f.level} source=${f.source}`);
	}
}

heading("Q4. Does classes.json itself carry a subclass level field (e.g. subclassTitle / a table column)?");
{
	const cls = baseClasses[0];
	console.log(`Base class top-level keys: ${Object.keys(cls).join(", ")}`);
	for (const name of ["Fighter", "Wizard", "Cleric", "Rogue"]) {
		const c = baseClasses.find((e) => e.name === name && e.source === "XPHB");
		if (!c) {
			console.log(`  ${name}: not found under XPHB`);
			continue;
		}
		console.log(`  ${name}: subclassTitle=${JSON.stringify(c.subclassTitle)}`);
	}
}

heading("Q5. subclass-features.json — shape and level field, first entry for a filtered subclass");
{
	const subclassFeatures = readJson("subclass-features.json");
	console.log(`Top-level keys: ${Object.keys(subclassFeatures[0]).join(", ")}`);
	const fighterSc = allSubclasses.find(
		(e) => e.className === "Fighter" && e.classSource === "XPHB",
	);
	if (fighterSc) {
		const matches = subclassFeatures.filter(
			(f) =>
				f.className === fighterSc.className &&
				f.classSource === fighterSc.classSource &&
				f.subclassShortName === fighterSc.shortName &&
				f.subclassSource === fighterSc.source,
		);
		console.log(`Feature entries for "${fighterSc.name}" (${fighterSc.source}): ${matches.length}`);
		console.log(`Levels present: ${[...new Set(matches.map((m) => m.level))].sort((a, b) => a - b).join(", ")}`);
		console.log(`Lowest level (= subclass grant level for this class): ${Math.min(...matches.map((m) => m.level))}`);
	}
}

heading("Q6. Lowest subclass-feature level, per class — does it match a single per-class constant?");
{
	const subclassFeatures = readJson("subclass-features.json");
	const filtered = allSubclasses.filter(
		(e) => ALLOWED_CLASS_SOURCES.includes(e.classSource) && ALLOWED_SOURCES.includes(e.source),
	);
	const perClassLevels = {};
	for (const sc of filtered) {
		const matches = subclassFeatures.filter(
			(f) =>
				f.className === sc.className &&
				f.classSource === sc.classSource &&
				f.subclassShortName === sc.shortName &&
				f.subclassSource === sc.source,
		);
		if (matches.length === 0) continue;
		const lowest = Math.min(...matches.map((m) => m.level));
		const key = `${sc.className}|${sc.classSource}`;
		if (!perClassLevels[key]) perClassLevels[key] = new Set();
		perClassLevels[key].add(lowest);
	}
	console.log("Lowest granted-feature level, per class (should be one number per class):");
	for (const [key, levels] of Object.entries(perClassLevels).sort()) {
		console.log(`  ${key}: ${[...levels].join(", ")}`);
	}
}

heading("Q7. Example — first 2 subclass entries after D28 filter, with a feature name+entries snippet");
{
	const subclassFeatures = readJson("subclass-features.json");
	const filtered = allSubclasses
		.filter((e) => ALLOWED_CLASS_SOURCES.includes(e.classSource) && ALLOWED_SOURCES.includes(e.source))
		.slice(0, 2);
	for (const sc of filtered) {
		const matches = subclassFeatures.filter(
			(f) =>
				f.className === sc.className &&
				f.classSource === sc.classSource &&
				f.subclassShortName === sc.shortName &&
				f.subclassSource === sc.source,
		);
		const lowest = matches.length ? Math.min(...matches.map((m) => m.level)) : null;
		const firstFeature = matches.find((m) => m.level === lowest);
		console.log(`  ${sc.name} (${sc.source}) for ${sc.className}|${sc.classSource}: grant level=${lowest}`);
		if (firstFeature) {
			console.log(`    feature name="${firstFeature.name}", entries[0]=${truncate(JSON.stringify(firstFeature.entries?.[0]), 150)}`);
		}
	}
}

console.log("");
