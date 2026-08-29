/*
 * investigate-weapon-proficiency-fields.js
 * ========================================
 *
 * Two questions for the "is this character proficient with this weapon"
 * slice:
 *  1. which item fields a structural proficiency test can stand on
 *     (weaponCategory / type / propertyFull) for mastery-bearing weapons;
 *  2. whether species, backgrounds and feats carry weapon proficiencies at
 *     all, and in what shape.
 *
 * Prints a SUMMARY ONLY.
 *
 * Run: node scripts/investigate-weapon-proficiency-fields.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function tally(values) {
	const counts = new Map();
	for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
	return [...counts.entries()].map(([k, n]) => `${k}=${n}`).join(" ");
}

const items = readJson("items.json");
const mastery = items.filter((i) => Array.isArray(i.masteryFull) && i.masteryFull.length > 0);

console.log(`items: ${items.length}, with masteryFull: ${mastery.length}`);
console.log(`  weaponCategory: ${tally(mastery.map((i) => String(i.weaponCategory)))}`);
console.log(`  typeFull:       ${tally(mastery.map((i) => String(i.typeFull)))}`);
console.log(`  has propertyFull: ${mastery.filter((i) => Array.isArray(i.propertyFull)).length}`);
console.log(`  weapon flag true: ${mastery.filter((i) => i.weapon === true).length}`);
console.log(`  distinct propertyFull values: ${[...new Set(mastery.flatMap((i) => i.propertyFull || []))].join(", ")}`);

const finesseOrLight = mastery.filter(
	(i) => i.weaponCategory === "martial" && (i.propertyFull || []).some((p) => p === "Finesse" || p === "Light"),
);
const martialLight = mastery.filter((i) => i.weaponCategory === "martial" && (i.propertyFull || []).includes("Light"));
console.log(`  martial + (Finesse|Light): ${finesseOrLight.length} -> ${finesseOrLight.map((i) => i.name).join(", ")}`);
console.log(`  martial + Light:           ${martialLight.length} -> ${martialLight.map((i) => i.name).join(", ")}`);

for (const example of mastery.slice(0, 3)) {
	console.log(
		`  eg ${example.name} (${example.source}): cat=${example.weaponCategory} type=${example.type}/${example.typeFull} props=${JSON.stringify(example.propertyFull)}`,
	);
}

const weaponItems = items.filter((i) => i.weaponCategory !== undefined);
console.log(`items with weaponCategory: ${weaponItems.length} (${tally(weaponItems.map((i) => String(i.weaponCategory)))})`);
console.log(`  firearm flag: ${items.filter((i) => i.firearm).length}, improvised-ish names: ${items.filter((i) => /improvised/i.test(String(i.name))).length}`);

for (const file of ["species.json", "backgrounds.json", "feats.json"]) {
	const entries = readJson(file);
	const withWeapons = entries.filter((e) => e && e.weaponProficiencies !== undefined);
	console.log(`${file}: ${entries.length} entries, weaponProficiencies on ${withWeapons.length}`);
	for (const e of withWeapons.slice(0, 3)) {
		console.log(`  eg ${e.name} (${e.source}): ${JSON.stringify(e.weaponProficiencies).slice(0, 160)}`);
	}
}
