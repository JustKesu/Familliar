/*
 * investigate-mastery-sanity.js
 * ===============================
 *
 * Sanity-checks masteryCountFor/masteryWeaponsFor logic against the real
 * data (mirrors src/masteries/masteryData.ts, not imported directly since
 * that module is TS/ESM built for the browser). Prints a SUMMARY ONLY.
 *
 * Run: node scripts/investigate-mastery-sanity.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

const classes = readJson("classes.json").filter((e) => e.entryType === "class");
const items = readJson("items.json");
const masteryItems = items.filter((e) => Array.isArray(e.masteryFull));

function countFor(className, level) {
	const cls = classes.find((c) => c.name === className);
	for (const group of cls.classTableGroups || []) {
		const idx = (group.colLabels || []).indexOf("Weapon Mastery");
		if (idx === -1) continue;
		const row = group.rows[level - 1];
		return Number.parseInt(row[idx], 10);
	}
	return null;
}

function weaponsFor(className) {
	const cls = classes.find((c) => c.name === className);
	const weapons = cls.startingProficiencies.weapons;
	const structured = weapons.every((w) => typeof w === "string" && !w.includes("{@") && !w.includes(" "));
	const pool = structured ? masteryItems.filter((i) => weapons.includes(i.weaponCategory)) : masteryItems;
	return pool.length;
}

console.log(`Fighter L1 count: ${countFor("Fighter", 1)} (expect 3)`);
console.log(`Fighter L20 count: ${countFor("Fighter", 20)} (expect 6)`);
console.log(`Barbarian L1 count: ${countFor("Barbarian", 1)} (expect 2)`);
console.log(`Barbarian L20 count: ${countFor("Barbarian", 20)} (expect 4)`);
console.log(`Wizard count: ${countFor("Wizard", 5)} (expect null)`);
console.log(`Fighter mastery weapon pool size: ${weaponsFor("Fighter")}`);
console.log(`Barbarian mastery weapon pool size: ${weaponsFor("Barbarian")}`);
