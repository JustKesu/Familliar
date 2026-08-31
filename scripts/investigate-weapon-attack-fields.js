/*
 * investigate-weapon-attack-fields.js
 * ===================================
 *
 * Two questions for build order step 7 slice c (weapon attacks):
 *  1. Which fields do items.json weapons carry for damage, versatile damage,
 *     range, properties and mastery, and in what form?
 *  2. Is the Monk's Martial Arts die readable structurally (a class table
 *     column) or only in prose?
 *
 * Prints a SUMMARY ONLY: counts plus at most 3 short examples.
 *
 * Run: node scripts/investigate-weapon-attack-fields.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

const items = readJson("items.json");
const WEAPON_CODES = ["M", "R"];
const weapons = items.filter((i) => {
	const code = typeof i.type === "string" ? i.type.split("|")[0] : undefined;
	return i.weapon === true || (code !== undefined && WEAPON_CODES.includes(code));
});

console.log(`weapons (flag or M/R type code): ${weapons.length}`);

const FIELDS = [
	"dmg1",
	"dmg2",
	"dmgType",
	"dmgTypeFull",
	"property",
	"propertyFull",
	"mastery",
	"masteryFull",
	"range",
	"weaponCategory",
	"firearm",
	"ammoType",
	"reload",
	"bonusWeapon",
	"baseItem",
];
for (const field of FIELDS) {
	const present = weapons.filter((w) => w[field] !== undefined);
	const types = [...new Set(present.map((w) => (Array.isArray(w[field]) ? "array" : typeof w[field])))];
	console.log(`  ${field}: ${present.length} present, types ${types.join("/") || "-"}`);
}

const ranges = [...new Set(weapons.filter((w) => w.range !== undefined).map((w) => String(w.range)))];
console.log(`distinct range values: ${ranges.length}; first 6: ${ranges.slice(0, 6).join(", ")}`);

const thrown = weapons.filter((w) => (w.propertyFull || []).some((p) => String(p).startsWith("Thrown")));
const thrownWithRange = thrown.filter((w) => w.range !== undefined);
console.log(`thrown weapons: ${thrown.length}, of which carry range: ${thrownWithRange.length}`);
const rangedNoRange = weapons.filter((w) => (typeof w.type === "string" ? w.type.split("|")[0] : "") === "R" && w.range === undefined);
console.log(`type R weapons WITHOUT range: ${rangedNoRange.length}`);

const versatile = weapons.filter((w) => (w.propertyFull || []).some((p) => String(p).startsWith("Versatile")));
console.log(`versatile weapons: ${versatile.length}, of which carry dmg2: ${versatile.filter((w) => w.dmg2 !== undefined).length}`);
console.log(`propertyFull sample values: ${[...new Set(weapons.flatMap((w) => w.propertyFull || []))].slice(0, 8).join(" | ")}`);
console.log(`dmgTypeFull distinct: ${[...new Set(weapons.map((w) => w.dmgTypeFull).filter(Boolean))].join(", ")}`);
console.log(`masteryFull distinct: ${[...new Set(weapons.flatMap((w) => w.masteryFull || []))].join(", ")}`);

for (const name of ["Longsword", "Javelin", "Shortbow"]) {
	const w = weapons.find((x) => x.name === name && x.source === "XPHB");
	if (!w) {
		console.log(`example ${name}: not found in XPHB`);
		continue;
	}
	const keep = {};
	for (const f of ["type", "weaponCategory", "dmg1", "dmg2", "dmgTypeFull", "propertyFull", "masteryFull", "range"]) if (w[f] !== undefined) keep[f] = w[f];
	console.log(`example ${name}: ${JSON.stringify(keep)}`);
}

// Question 2: Martial Arts die.
const classes = readJson("classes.json");
const monk = classes.find((c) => c.entryType === "class" && c.name === "Monk" && c.source === "XPHB");
if (!monk) {
	console.log("Monk/XPHB: not found");
} else {
	const groups = monk.classTableGroups || [];
	console.log(`Monk classTableGroups: ${groups.length}`);
	groups.forEach((g, i) => {
		const labels = (g.colLabels || []).map((l) => String(l));
		console.log(`  group ${i}: colLabels ${JSON.stringify(labels)} rows ${(g.rows || []).length} rowsSpellProgression ${g.rowsSpellProgression ? "yes" : "no"}`);
		const idx = labels.findIndex((l) => l.toLowerCase().includes("martial arts"));
		if (idx >= 0) {
			const col = (g.rows || []).map((r) => JSON.stringify(r[idx]));
			console.log(`  martial arts column at ${idx}; distinct values: ${[...new Set(col)].join(", ")}`);
			console.log(`  level 1 / 5 / 11 / 17 rows: ${col[0]}, ${col[4]}, ${col[10]}, ${col[16]}`);
		}
	});
}
