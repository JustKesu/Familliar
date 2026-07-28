/*
 * investigate-slice1.js
 * ======================
 *
 * One-off investigation for the weapon-mastery / fighting-style slice.
 * Prints a SUMMARY ONLY (per CLAUDE.md) — never whole entries or files.
 *
 * Run: node scripts/investigate-slice1.js
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

function heading(title) {
	console.log("");
	console.log("=".repeat(64));
	console.log(title);
	console.log("=".repeat(64));
}

// --- Q1: Weapon mastery counts per class and level -------------------------

heading("Q1. Weapon mastery counts per class and level");
{
	const classes = readJson("classes.json").filter((e) => e.entryType === "class");
	const matches = [];
	for (const cls of classes) {
		for (const group of cls.classTableGroups || []) {
			const labels = group.colLabels || [];
			const idx = labels.findIndex((l) => /master(y|ies)/i.test(String(l)));
			if (idx === -1) continue;
			const values = (group.rows || []).map((row) => row[idx]);
			matches.push({ name: cls.name, source: cls.source, values });
		}
	}
	if (matches.length === 0) {
		console.log("No class table column mentions Mastery or Masteries — this data does not contain that.");
	} else {
		console.log(`Classes with a Mastery/Masteries table column: ${matches.length}`);
		for (const m of matches.slice(0, 3)) {
			console.log(`  ${m.name} (${m.source}): [${m.values.join(", ")}]`);
		}
	}
}

// --- Q2: Fighting Style entitlement -----------------------------------------

heading("Q2. Fighting Style entitlement");
{
	const classFeatures = readJson("class-features.json");
	const classes = readJson("classes.json").filter((e) => e.entryType === "class");

	const fightingStyleFeatures = classFeatures.filter((e) => e.name === "Fighting Style");
	console.log(`"Fighting Style" class features found: ${fightingStyleFeatures.length}`);
	for (const f of fightingStyleFeatures) {
		console.log(`  ${f.className} (${f.classSource}), level ${f.level}`);
	}

	const otherGrants = [];
	for (const cls of classes) {
		for (const prog of cls.optionalfeatureProgression || []) {
			const codes = (prog.featureType || []).filter((code) => String(code).startsWith("FS"));
			if (codes.length > 0) {
				otherGrants.push({ name: cls.name, source: cls.source, codes });
			}
		}
	}
	if (otherGrants.length === 0) {
		console.log("No class grants a fighting style through optionalfeatureProgression (featureType starting \"FS\") — this data does not contain that.");
	} else {
		console.log(`Classes granting a fighting style via optionalfeatureProgression: ${otherGrants.length}`);
		for (const g of otherGrants) {
			console.log(`  ${g.name} (${g.source}): ${g.codes.join(", ")}`);
		}
	}
}

// --- Q3: Weapons that have a mastery property -------------------------------

heading("Q3. Weapons that have a mastery property");
{
	const items = readJson("items.json");
	const withMastery = items.filter((e) => Object.prototype.hasOwnProperty.call(e, "mastery"));
	console.log(`Items with a "mastery" field: ${withMastery.length}`);

	const valueCounts = new Map();
	for (const item of withMastery) {
		const values = Array.isArray(item.mastery) ? item.mastery : [item.mastery];
		for (const v of values) {
			const key = JSON.stringify(v);
			valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
		}
	}
	console.log(`Distinct mastery values: ${valueCounts.size}`);
	for (const [value, count] of valueCounts.entries()) {
		console.log(`  ${value}: ${count}`);
	}

	console.log("Examples:");
	for (const item of withMastery.slice(0, 3)) {
		console.log(`  ${item.name}: ${truncate(JSON.stringify(item.mastery), 120)}`);
	}
}

// --- Q4: Class weapon proficiencies -----------------------------------------

heading("Q4. Class weapon proficiencies");
{
	const classes = readJson("classes.json").filter((e) => e.entryType === "class");
	const wanted = ["Fighter", "Wizard", "Rogue"];
	for (const name of wanted) {
		const cls = classes.find((e) => e.name === name);
		if (!cls) {
			console.log(`${name}: not present in data/classes.json`);
			continue;
		}
		const prof = cls.startingProficiencies || {};
		const weaponsValue = Object.prototype.hasOwnProperty.call(prof, "weapons")
			? prof.weapons
			: undefined;
		if (weaponsValue === undefined) {
			console.log(`${name}: startingProficiencies has no "weapons" field`);
		} else {
			console.log(`${name}: startingProficiencies.weapons = ${truncate(JSON.stringify(weaponsValue), 120)}`);
		}
	}
}

console.log("");
