/*
 * investigate-mastery-shape.js
 * =============================
 *
 * Checks item mastery/masteryFull field shape and class weapon
 * proficiency shape for classes with a Weapon Mastery table column.
 * Prints a SUMMARY ONLY (per CLAUDE.md).
 *
 * Run: node scripts/investigate-mastery-shape.js
 */

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

const items = readJson("items.json");
const withMastery = items.filter((e) => Object.prototype.hasOwnProperty.call(e, "mastery"));

console.log(`Items with mastery: ${withMastery.length}`);
const withMasteryFull = withMastery.filter((e) => Object.prototype.hasOwnProperty.call(e, "masteryFull"));
console.log(`Items with masteryFull: ${withMasteryFull.length}`);
for (const item of withMastery.slice(0, 3)) {
	console.log(`  ${item.name}: mastery=${truncate(JSON.stringify(item.mastery), 80)} masteryFull=${truncate(JSON.stringify(item.masteryFull), 200)}`);
}

console.log("");
console.log("Weapon field / weapon type check on mastery items:");
for (const item of withMastery.slice(0, 3)) {
	console.log(`  ${item.name}: weapon=${item.weapon}, weaponCategory=${item.weaponCategory}, type=${item.type}`);
}

console.log("");
console.log("Barbarian / Fighter startingProficiencies.weapons:");
const classes = readJson("classes.json").filter((e) => e.entryType === "class");
for (const name of ["Barbarian", "Fighter"]) {
	const cls = classes.find((e) => e.name === name);
	const prof = (cls && cls.startingProficiencies) || {};
	console.log(`  ${name}: ${truncate(JSON.stringify(prof.weapons), 200)}`);
}
