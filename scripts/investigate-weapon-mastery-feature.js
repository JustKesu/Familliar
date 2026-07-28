/*
 * investigate-weapon-mastery-feature.js
 * ======================================
 *
 * Verifies which classes grant a "Weapon Mastery" class feature.
 * Prints a SUMMARY ONLY (per CLAUDE.md).
 *
 * Run: node scripts/investigate-weapon-mastery-feature.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

const classFeatures = readJson("class-features.json");
const matches = classFeatures.filter((e) => e.name === "Weapon Mastery");

console.log(`"Weapon Mastery" class features found: ${matches.length}`);
for (const f of matches) {
	console.log(`  ${f.className} (${f.classSource}), level ${f.level}`);
}

const distinctClasses = new Set(matches.map((f) => `${f.className}|${f.classSource}`));
console.log(`Distinct classes: ${distinctClasses.size}`);
