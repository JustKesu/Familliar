/*
 * investigate-weapon-prof-shapes.js
 * ===================================
 *
 * Surveys startingProficiencies.weapons across all classes to find the
 * boundary between "structured list" (categories/uids) and "prose"
 * (free text describing a filter). Prints a SUMMARY ONLY.
 *
 * Run: node scripts/investigate-weapon-prof-shapes.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

const classes = readJson("classes.json").filter((e) => e.entryType === "class");

for (const cls of classes) {
	const prof = cls.startingProficiencies || {};
	const weapons = prof.weapons;
	if (weapons === undefined) {
		console.log(`${cls.name} (${cls.source}): no weapons field`);
		continue;
	}
	console.log(`${cls.name} (${cls.source}): ${JSON.stringify(weapons)}`);
}
